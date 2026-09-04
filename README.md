# Web app: Technology Lag (paper 3)

Static sub-site of the disclosure-series domain, modeled on paper 1's app:
plain HTML/CSS/JS, no build step, hand-rolled SVG charts reading the validated
palette from CSS custom properties, data baked from `02_analysis/*/outputs/`.

## Running locally

```bash
cd 04_web_app
python -m http.server 8766     # fetch is blocked on file:// URLs
# open http://localhost:8766
```

## Rebuilding the data

```bash
python build_data.py           # reads 02_analysis outputs, writes data/*.json
```

`build_data.py` **never recomputes a statistic**. `data/precision.json` bakes
to `null` until analysis 02's three-model precision check has run; the
Precision view says so instead of breaking.

## Views

| View | What it does |
|---|---|
| **Overview** | the entry matrix: every technology x industry sustained-entry year, construction's lag annotated (with ≥ lower bounds where the leader is left-censored), plus the lag table |
| **Filings** | the landing grid: one cell per firm-year FY1996-2025, coloured by how many confirmed technology families the filing mentions, hover lists them, click opens the filing on sec.gov (one industry at a time; search spans all seven) |
| **Technologies** | pick any family: its 30-year adoption curve in all seven industries, first mentions, sustained entries, peak shares, entry framing (risk-first vs capability-first) |
| **Statistics** | analysis 03 as live charts: the laggard permutation ranks (who is actually late), firm-level pickup odds vs construction per technology, the vocabulary-lifecycle slope, and hype vs steady in event time |
| **Precision** | the three-model precision check behind every keyword-measured family, with the ex-ante tier rule and any demotions/promotions |
| **Method** | panel floor, form variants, entry-dating rule, screen deviation, what the study is not |
