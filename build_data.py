"""Bake the site's data/*.json from 02_analysis outputs.

This script NEVER recomputes a statistic. Every value is copied from an
analysis output, so the site and the manuscript cannot disagree.

Run:  python build_data.py     (re-run after any analysis re-run)
"""
import gzip
import json
import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
A01DIR = next(p for p in sorted((ROOT / "02_analysis").iterdir())
              if p.name.startswith("01_"))
A01 = A01DIR / "outputs"
sys.path.insert(0, str(A01DIR))
import lib as a01lib                                              # noqa: E402

SENT_SPLIT = re.compile(r"(?<=[\.\?\!])\s+(?=[A-Z\"'(“])")


def _first_sentences(args):
    """Worker: the first sentence of each present family in one filing."""
    cik, fy, adsh, fams = args
    p = ROOT / "01_raw_data" / "filings_text" / f"{cik}_{fy}_{adsh}.txt.gz"
    if not p.exists():
        return None
    with gzip.open(p, "rt", encoding="utf-8") as fh:
        txt = fh.read()
    sents = None
    out = []
    for fam in fams:
        rxs = a01lib.TECH_RX[fam]
        if sents is None:
            sents = [" ".join(s.split()) for s in SENT_SPLIT.split(txt)]
        found = None
        for s in sents:
            if 40 <= len(s) <= 600 and any(rx.search(s) for rx in rxs):
                found = s
                break
        if found is None:
            # the family's hits all sit in passages outside the sentence
            # bounds (a long run-on list, a table): show a clipped context
            # around the first raw match so NO present family goes missing
            for rx in rxs:
                m = rx.search(txt)
                if m:
                    a, b = m.span()
                    found = ("… " + " ".join(txt[max(0, a - 160):b + 160].split())
                             + " …")
                    break
        if found is not None:
            out.append([fam, found])
    return (f"{cik}:{fy}", out)
A02 = next((p for p in sorted((ROOT / "02_analysis").iterdir())
            if p.name.startswith("02_")), None)
A02 = A02 / "outputs" if A02 else None
DATA = HERE / "data"
DATA.mkdir(exist_ok=True)

INDUSTRIES = ["Construction", "Auto manufacturing", "Software & IT services",
              "Pharma & biotech", "Utilities", "Retail", "Aerospace & defense"]

LABEL = {
    "bim": "BIM", "gps_telematics": "GPS / telematics", "rfid": "RFID",
    "drone": "Drones / UAV", "iot": "IoT", "erp": "ERP",
    "cloud": "Cloud computing", "wearable": "Wearables",
    "blockchain": "Blockchain", "vr_ar": "VR / AR", "print3d": "3D printing",
    "quantum": "Quantum computing", "cybersecurity": "Cybersecurity",
    "big_data": "Big data / analytics", "robotics": "Robotics",
    "autonomous": "Autonomous equipment", "exoskeleton": "Exoskeletons",
    "internet": "Internet / e-commerce", "ai_ml": "AI / ML",
    "lean": "Lean", "modular_prefab": "Modular / prefab",
    "automation": "Automation", "tqm": "TQM", "six_sigma": "Six Sigma",
}


def jput(obj, name):
    def clean(o):
        if isinstance(o, dict):
            return {k: clean(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [clean(v) for v in o]
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating, float)):
            return None if (o != o or np.isinf(o)) else round(float(o), 5)
        if isinstance(o, (np.bool_, bool)):
            return bool(o)
        return o
    p = DATA / f"{name}.json"
    p.write_text(json.dumps(clean(obj), separators=(",", ":")), encoding="utf-8")
    print(f"  {name}.json  {p.stat().st_size/1024:.0f} KB")


def main():
    summary = json.loads((A01 / "summary.json").read_text(encoding="utf-8"))
    jput(summary, "headline")

    # ------------------------------------------------------------- lag matrix
    lag = pd.read_csv(A01 / "construction_lag.csv")
    jput({"labels": LABEL, "rows": lag.to_dict("records")}, "lag")

    # ------------------------------------------------------------- adoption series
    adopt = pd.read_csv(A01 / "adoption_by_tech_industry_year.csv")
    years = sorted(adopt.fy.unique().tolist())
    fams = sorted(adopt.family.unique().tolist(),
                  key=lambda f: LABEL.get(f, f))
    series = {}
    for fam in fams:
        d = adopt[adopt.family == fam]
        series[fam] = {}
        for ind in INDUSTRIES:
            g = d[d.industry == ind].set_index("fy").pct_mentioning
            series[fam][ind] = [None if fy not in g.index or pd.isna(g[fy])
                                else float(g[fy]) for fy in years]
    jput({"years": years, "families": fams, "labels": LABEL,
          "series": series}, "adoption")

    entries = pd.read_csv(A01 / "entry_years.csv")
    jput(entries.to_dict("records"), "entries")

    rf = pd.read_csv(A01 / "risk_first_by_tech_industry.csv")
    jput(rf.to_dict("records"), "risk_first")

    cov = pd.read_csv(A01 / "panel_coverage.csv")
    cov_out = {}
    for ind in INDUSTRIES:
        g = cov[cov.industry == ind].set_index("fy").n_filings
        cov_out[ind] = [int(g[fy]) if fy in g.index else 0 for fy in years]
    jput({"years": years, "filings": cov_out}, "coverage")

    # ------------------------------------------------------------- inventory
    # The landing grid: one cell per firm-year, each linking to its filing on
    # sec.gov (the primary document when the universe names one, else the
    # accession index page). Colour = how many confirmed-lexicon technology
    # families the filing mentions; the hover lists them.
    sys.path.insert(0, str(next(p for p in sorted((ROOT / "02_analysis").iterdir())
                                if p.name.startswith("01_"))))
    import lib as a01lib
    lex = [f for f in a01lib.LEXICON_FAMILIES]
    panel = pd.read_csv(next(p for p in sorted((ROOT / "02_analysis").iterdir())
                             if p.name.startswith("01_")) / "outputs" / "tech_panel.csv")
    uni = pd.read_csv(ROOT / "01_raw_data" / "sec_metadata" /
                      "industries_10k_universe_long.csv")
    doc_of = uni.set_index("adsh").primary_doc.to_dict()

    inv_firms = []
    for (cik, ind), g in panel.groupby(["cik", "industry"]):
        g = g.sort_values("fy")
        cells = []
        for r in g.itertuples():
            techs = [i for i, f in enumerate(lex) if getattr(r, f"c_{f}") > 0]
            doc = doc_of.get(r.adsh)
            cells.append({"fy": int(r.fy), "t": techs,
                          "adsh": r.adsh,
                          "doc": doc if isinstance(doc, str) and doc else None,
                          "x": int(r.is_operating == 0)})
        inv_firms.append({"cik": int(cik), "name": g.name.iloc[-1],
                          "industry": ind, "sic": int(g.sic.iloc[-1]),
                          "cells": cells})
    jput({"years": sorted(panel.fy.unique().tolist()),
          "families": lex,
          "labels": {f: LABEL.get(f, f) for f in lex},
          "firms": inv_firms}, "inventory")

    # ------------------------------------------------------------- sentences
    # For the grid's review panel: the first sentence of each technology
    # family in each filing, extracted from the frozen text on all cores.
    # One lazily-loaded file per industry, keyed "cik:fy". Skipped when the
    # files already exist (pass --sentences to force a rebuild).
    sd = DATA / "sentences"
    if sd.exists() and any(sd.iterdir()) and "--sentences" not in sys.argv:
        print("  sentences/ exists -- kept (pass --sentences to rebuild)")
    else:
        sd.mkdir(exist_ok=True)
        jobs, key_ind = [], {}
        for r in panel.itertuples():
            fams = [f for f in lex if getattr(r, f"c_{f}") > 0]
            if not fams:
                continue
            jobs.append((int(r.cik), int(r.fy), r.adsh, fams))
            key_ind[f"{int(r.cik)}:{int(r.fy)}"] = r.industry
        print(f"  extracting technology sentences from {len(jobs):,} filings ...")
        per_ind = {}
        with ProcessPoolExecutor(max_workers=os.cpu_count() or 4) as ex:
            for res in ex.map(_first_sentences, jobs, chunksize=64):
                if res is None:
                    continue
                key, rows = res
                per_ind.setdefault(key_ind[key], {})[key] = rows
        for ind, m in per_ind.items():
            slug = re.sub(r"\W+", "_", ind).strip("_").lower()
            p = sd / f"{slug}.json"
            p.write_text(json.dumps(m, separators=(",", ":")), encoding="utf-8")
            print(f"  sentences/{slug}.json  {p.stat().st_size/1024:.0f} KB")

    # ------------------------------------------------------------- lag statistics (analysis 03)
    A03 = next((p for p in sorted((ROOT / "02_analysis").iterdir())
                if p.name.startswith("03_")), None)
    if A03 and (A03 / "outputs" / "laggard_permutation.csv").exists():
        o3 = A03 / "outputs"
        rsd = pd.read_csv(o3 / "lifecycle_panel.csv")
        life_b = (rsd.groupby("yse")
                  .agg(m=("risk_share", "mean"), n=("risk_share", "size"))
                  .reset_index())
        shp = pd.read_csv(o3 / "shape_panel.csv")
        shp_b = (shp.groupby(["grp", "yse"])
                 .agg(m=("pct_mentioning", "mean"), n=("pct_mentioning", "size"))
                 .reset_index())
        jput({"laggard": pd.read_csv(o3 / "laggard_permutation.csv").to_dict("records"),
              "hazard": pd.read_csv(o3 / "hazard_by_technology.csv").to_dict("records"),
              "hazard_summary": pd.read_csv(o3 / "hazard_summary.csv").to_dict("records"),
              "lifecycle_binned": life_b[life_b.n >= 5].to_dict("records"),
              "shape_binned": shp_b[shp_b.n >= 5].to_dict("records"),
              "summary": json.loads((o3 / "summary.json")
                                    .read_text(encoding="utf-8"))}, "lagstats")
    else:
        jput(None, "lagstats")

    # ------------------------------------------------------------- precision (analysis 02)
    if A02 and (A02 / "precision_by_family.csv").exists():
        fam = pd.read_csv(A02 / "precision_by_family.csv")
        agree = pd.read_csv(A02 / "model_agreement.csv")
        s2 = json.loads((A02 / "summary.json").read_text(encoding="utf-8"))
        jput({"families": fam.to_dict("records"),
              "agreement": agree.to_dict("records"),
              "summary": s2}, "precision")
    else:
        jput(None, "precision")

    # ------------------------------------------------- lexicon term patterns
    # the review panel's keyword highlight uses the study's OWN term regexes,
    # baked straight from the analysis lib so site and paper agree on what
    # counts as the technology's vocabulary
    sys.path.insert(0, str(next((ROOT / "02_analysis").glob("01_*"))))
    import lib as p3lib
    jput({fam: {"ci": spec.get("ci") or "", "cs": spec.get("cs") or ""}
          for fam, spec in p3lib.TECH.items()}, "termrx")

    # -------------------------------------------- the night batch (analyses 11-13)
    def adir(prefix):
        p = next((d for d in sorted((ROOT / "02_analysis").iterdir())
                  if d.name.startswith(prefix)), None)
        return p / "outputs" if p else None

    night = {}
    a11 = adir("11_")
    if a11 and (a11 / "rhetoric_by_era.csv").exists():
        night["moves"] = {
            "by_era": pd.read_csv(a11 / "rhetoric_by_era.csv").to_dict("records"),
            "totals": pd.read_csv(a11 / "rhetoric_totals.csv").to_dict("records")}
    a12 = adir("12_")
    if a12 and (a12 / "retention_by_group.csv").exists():
        ret = pd.read_csv(a12 / "retention_by_group.csv")
        haz = pd.read_csv(a12 / "abandonment_hazard.csv")
        bio = pd.read_csv(a12 / "family_biography.csv")
        night["lifecycle"] = {
            "retention": ret[ret.n >= 30].to_dict("records"),
            "hazard": haz.to_dict("records"),
            "biography": bio.to_dict("records")}
    a13 = adir("13_")
    if a13 and (a13 / "era_edges.csv").exists():
        ee = pd.read_csv(a13 / "era_edges.csv")
        top = (ee.sort_values("lift", ascending=False).groupby("era").head(4)
               .to_dict("records"))
        night["constellations"] = {
            "edges_per_era": ee.groupby("era").size().to_dict(),
            "top_pairs": top}
    jput(night or None, "night")

    print("done")


if __name__ == "__main__":
    main()
