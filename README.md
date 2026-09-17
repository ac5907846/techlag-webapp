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
| **Overview** | the entry matrix: every technology x industry sustained-entry year, construction's lag annotated (with ≥ lower bounds where the leader is left-censored), plus the lag table. A player replays FY1996-2025: a playhead sweeps the years, each dot appears in its entry year and the lag notes appear once settled; it runs once when the view first opens (not under reduced motion) and the slider scrubs to any year |
| **Filings** | the landing grid: one cell per firm-year FY1996-2025, coloured by how many confirmed technology families the filing mentions, hover lists them, click opens the review panel (first sentence of each family, linked into the filing on sec.gov); one industry at a time, search spans all nine |
| **Technologies** | pick any family: its 30-year adoption curve in all nine industries (drawn in when the view opens), first mentions, sustained entries, peak shares, entry framing (risk-first vs capability-first) |
| **Statistics** | analyses 03, 11-13 and 15 as live charts: the laggard permutation ranks (who is actually late), firm-level pickup odds vs construction per technology, the vocabulary-lifecycle slope with its calendar-year check, hype vs steady in event time, retention, moves by era, co-mention pairings |
| **Precision** | the three-model precision check behind every keyword-measured family, with the ex-ante tier rule and any demotions/promotions |
| **Method** | panel floor, form variants, entry-dating rule, screen deviation, what the study is not |
