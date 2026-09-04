/* ============================================================================
   Technology Lag: views and routing.

   Plain JS, no framework, no build step (same stance as papers 1-2's sites).
   All data is baked JSON under data/; nothing here computes a statistic.
   ========================================================================= */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  const css = Charts.css;
  const fmtPct = Charts.fmtPct;

  const INDUSTRIES = ['Construction', 'Construction machinery', 'Auto manufacturing',
                      'Software & IT services', 'Computers & chips',
                      'Pharma & biotech', 'Utilities',
                      'Retail', 'Aerospace & defense'];
  /* Construction machinery -- the upstream Caterpillar/Deere band -- wears a
     darker member of construction's blue family, so the kinship shows. */
  const IND_COLOR = {
    'Construction': '--c1', 'Construction machinery': '--s4',
    'Software & IT services': '--c3', 'Computers & chips': '--ink',
    'Pharma & biotech': '--c4', 'Auto manufacturing': '--c2',
    'Utilities': '--s1', 'Retail': '--risk', 'Aerospace & defense': '--neutral',
  };
  const SHORT = {
    'Construction': 'Construction', 'Construction machinery': 'Constr. machinery',
    'Auto manufacturing': 'Auto mfg',
    'Software & IT services': 'Software & IT', 'Computers & chips': 'Computers & chips',
    'Pharma & biotech': 'Pharma & biotech',
    'Utilities': 'Utilities', 'Retail': 'Retail', 'Aerospace & defense': 'Aerospace & def',
  };

  /* SIC subgroups inside each industry (SEC's own SIC titles). */
  function subgroup(industry, sic) {
    sic = +sic;
    if (industry === 'Construction') {
      if (sic >= 1500 && sic < 1600) return 'General building contractors';
      if (sic >= 1600 && sic < 1700) return 'Heavy construction';
      if (sic >= 1700 && sic < 1800) return 'Special trade contractors';
      return 'Engineering services';
    }
    return ({
      3523: 'Farm & agricultural machinery (crosses into construction: Deere, AGCO)',
      3531: 'Construction & mining machinery (Caterpillar, Terex)',
      3537: 'Industrial trucks & lifts',
      3711: 'Motor vehicles & car bodies', 3713: 'Truck & bus bodies',
      3714: 'Motor vehicle parts & accessories',
      7370: 'Data processing & internet platforms (Alphabet, Meta)',
      7371: 'IT services & custom programming', 7372: 'Prepackaged software',
      3570: 'Computer & office equipment (IBM)',
      3571: 'Electronic computers (Apple, Dell)',
      3674: 'Semiconductors (NVIDIA, Intel, AMD)',
      2834: 'Pharmaceutical preparations', 2836: 'Biological products',
      8731: 'Commercial physical & biological research',
      4911: 'Electric services', 4931: 'Electric & other services combined',
      5311: 'Department stores', 5411: 'Grocery stores', 5912: 'Drug stores',
      3721: 'Aircraft', 3812: 'Search, detection & navigation systems',
    })[sic] || 'SIC ' + sic;
  }

  const D = {};

  // ---------------------------------------------------------------- routing
  function show(view, updateHash = true) {
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    // entering the site keeps a clean URL: the hash is only written on
    // navigation, or when the visitor already arrived with one
    if (updateHash && (location.hash || view !== 'filings')) location.hash = view;
    window.scrollTo({ top: 0 });
  }
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (b) show(b.dataset.view);
  });

  // ------------------------------------------------------- the entry matrix
  /* One row per technology: a grey span from the leading industry's entry to
     the latest entrant, a dot per industry, construction emphasised. The one
     chart charts.js does not have, so it is drawn here with the same tokens. */
  function entryMatrix(host, rows) {
    host.innerHTML = '';
    const rowH = 30, labelW = 168, w = 780;
    const m = { t: 8, r: 86, b: 30, l: labelW };
    const h = rows.length * rowH + m.t + m.b;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('role', 'img');
    host.appendChild(svg);
    const el = (tag, attrs, parent) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      (parent || svg).appendChild(e); return e;
    };
    const x0 = 1995, x1 = 2026;
    const xS = (v) => m.l + ((v - x0) / (x1 - x0)) * (w - m.l - m.r);
    for (let yr = 1996; yr <= 2025; yr += 4) {
      el('line', { x1: xS(yr), y1: m.t, x2: xS(yr), y2: h - m.b,
                   stroke: css('--line'), 'stroke-width': 1 });
      el('text', { x: xS(yr), y: h - 10, class: 'ax-txt',
                   'text-anchor': 'middle' }).textContent = yr;
    }
    rows.forEach((r, i) => {
      const y = m.t + i * rowH + rowH / 2;
      el('text', { x: labelW - 10, y: y + 4, class: 'ax-txt',
                   'text-anchor': 'end' }).textContent = D.lag.labels[r.family] || r.family;
      const entries = INDUSTRIES.map(ind => ({ ind, yr: r['entry_' + ind] }))
        .filter(d => d.yr !== null && d.yr !== undefined);
      if (entries.length > 1) {
        const yrs = entries.map(d => d.yr);
        el('line', { x1: xS(Math.min(...yrs)), y1: y, x2: xS(Math.max(...yrs)), y2: y,
                     stroke: css('--line-2'), 'stroke-width': 3,
                     'stroke-linecap': 'round' });
      }
      entries.sort((a, b) => (a.ind === 'Construction') - (b.ind === 'Construction'));
      entries.forEach(d => {
        const focal = d.ind === 'Construction';
        const c = el('circle', { cx: xS(d.yr), cy: y, r: focal ? 7 : 4.5,
                                 fill: css(IND_COLOR[d.ind]),
                                 stroke: css('--surface'),
                                 'stroke-width': focal ? 1.8 : 1.2 });
        c.addEventListener('mousemove', (ev) => Charts.showTip(
          `<b>${SHORT[d.ind]}</b><br>${D.lag.labels[r.family]}: sustained entry FY${d.yr}`, ev));
        c.addEventListener('mouseleave', Charts.hideTip);
      });
      let note = '', cls = 'ax-txt';
      if (r.construction_lag_years !== null && r.construction_lag_years !== undefined) {
        const v = r.construction_lag_years;
        note = v <= 0 ? 'with leader'
             : (r.leader_left_censored ? '≥' + v + ' yr' : v + ' yr');
      } else if (r.construction_never_entered) { note = 'never'; cls = 'brk-txt'; }
      if (note) {
        const t = el('text', { x: w - m.r + 8, y: y + 4, class: cls });
        t.textContent = note;
        if (note === 'never') t.setAttribute('fill', css('--risk'));
      }
    });
    Charts.legend(host, INDUSTRIES.map(i => ({ name: SHORT[i], color: IND_COLOR[i] })));
  }

  // ---------------------------------------------------------------- overview
  function renderOverview() {
    const h = D.headline;
    $('#ov-lag').textContent = h.lag.median_lag_years + ' yr';
    $('#ov-never').textContent = h.lag.n_never_entered;
    $('#ov-filings').textContent = h.filings_total.toLocaleString('en-US');
    $('#ov-firms').textContent = h.firms_total.toLocaleString('en-US');

    const rows = D.lag.rows.filter(r => r.leader_entry !== null && r.leader_entry !== undefined)
      .sort((a, b) => a.leader_entry - b.leader_entry);
    entryMatrix($('#ch-matrix'), rows);

    $('#tbl-lag').innerHTML =
      '<thead><tr><th>Technology</th><th>Leader</th><th class="num">Leader FY</th>' +
      '<th class="num">Constr. FY</th><th class="num">Lag</th></tr></thead><tbody>' +
      rows.map(r => {
        const lag = r.construction_lag_years;
        const lagTxt = (lag === null || lag === undefined)
          ? (r.construction_never_entered ? '<span class="pill" style="color:var(--risk)">never</span>' : '·')
          : lag <= 0 ? '<span class="pill yes">with leader</span>'
          : (r.leader_left_censored ? '≥' : '') + lag + ' yr';
        return `<tr><td>${D.lag.labels[r.family]}</td>` +
          `<td>${(r.leader_industry || '').split(', ').map(i => SHORT[i] || i).join(', ')}</td>` +
          `<td class="num">${r.leader_entry}</td>` +
          `<td class="num">${r.construction_entry || '·'}</td>` +
          `<td class="num">${lagTxt}</td></tr>`;
      }).join('') + '</tbody>';
  }

  // ---------------------------------------------------------------- technologies
  function renderTech(fam) {
    const A = D.adoption;
    fam = fam || 'cybersecurity';
    const sel = $('#t-fam');
    if (!sel.options.length) {
      sel.innerHTML = A.families
        .map(f => `<option value="${f}"${f === fam ? ' selected' : ''}>${A.labels[f] || f}</option>`)
        .join('');
      sel.addEventListener('change', () => renderTech(sel.value));
    }
    const s = A.series[fam];
    Charts.lineChart($('#ch-tech'), {
      years: A.years, height: 360, everyX: 4,
      series: INDUSTRIES.filter(i => s[i]).map(i => ({
        name: SHORT[i], color: IND_COLOR[i],
        width: i === 'Construction' ? 3.4 : 1.5,
        dot: i === 'Construction' ? 3.2 : 0,
        opacity: i === 'Construction' ? 1 : .72,
        values: s[i].map(v => v === null ? null : v * 100),
      })),
      ymax: 100, yFmt: v => v + '%', yLabel: 'Filings mentioning (%)',
      tipFmt: v => v.toFixed(1) + '% of filings',
    });

    const ent = D.entries.filter(e => e.family === fam);
    const rf = D.risk_first.filter(e => e.family === fam);
    $('#tbl-tech').innerHTML =
      '<thead><tr><th>Industry</th><th class="num">First mention</th>' +
      '<th class="num">Sustained entry</th><th class="num">Peak share</th>' +
      '<th class="num">Entry framing</th></tr></thead><tbody>' +
      INDUSTRIES.filter(i => ent.some(x => x.industry === i)).map(i => {
        const e = ent.find(x => x.industry === i) || {};
        const r = rf.find(x => x.industry === i);
        const fr = r && r.risk_first !== null && r.risk_first !== undefined
          ? (r.risk_first ? '<span class="pill" style="color:var(--risk)">risk-first</span>'
                          : '<span class="pill yes">capability-first</span>')
          : '·';
        const focal = i === 'Construction';
        return `<tr${focal ? ' style="font-weight:650"' : ''}>` +
          `<td><span class="seg-dot" style="background:${css(IND_COLOR[i])}"></span>${SHORT[i]}</td>` +
          `<td class="num">${e.first_any_mention || '·'}</td>` +
          `<td class="num">${e.entry_headline || '·'}</td>` +
          `<td class="num">${e.peak_pct ? fmtPct(e.peak_pct, 1) : '0%'}</td>` +
          `<td class="num">${fr}</td></tr>`;
      }).join('') + '</tbody>';
    $('#t-note').textContent = 'entry framing: where the located mentions sat in the first three entry years (2006+ entries only)';
  }

  // ---------------------------------------------------------------- filings grid
  /* One cell per firm-year, every cell a link to the filing on sec.gov.
     41,880 filings cannot render at once, so one industry at a time
     (searching looks across all seven), in chunks. */
  const secDoc = (cik, adsh, doc) =>
    `https://www.sec.gov/Archives/edgar/data/${cik}/${adsh.replace(/-/g, '')}/` +
    (doc || `${adsh}-index.htm`);
  const secCompany = (cik) =>
    `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${String(cik).padStart(10, '0')}&type=10-K`;

  const INV = { q: '',
                ind: new URLSearchParams(location.search).get('ind') || 'Construction' };

  // ----------------------------------------------------- filing review panel
  /* Click a square with technology language: a panel lists the first sentence
     of every technology family that filing mentions, each with its own deep
     link (verified anchors exist for the construction and machinery bands).
     Sentence files load lazily, one JSON per industry. */
  const SLUG = (ind) => ind.replace(/\W+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  const sentCache = {};
  async function sentencesFor(ind) {
    if (!(ind in sentCache)) {
      sentCache[ind] = await fetch('data/sentences/' + SLUG(ind) + '.json')
        .then(r => r.ok ? r.json() : {}).catch(() => ({}));
    }
    return sentCache[ind];
  }

  /* Two-tone highlighting in the review panel: the whole sentence sits on its
     own soft ground (css .m-txt), and that row's technology terms pop in a
     second colour. The term patterns are baked from the study's own lexicon
     (data/termrx.json): ci = case-insensitive phrases, cs = case-sensitive
     abbreviations. */
  const ESCH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  function hlParts(escaped, rx) {
    return escaped.split(/(<mark class="kw">[\s\S]*?<\/mark>)/).map(seg =>
      seg.startsWith('<mark') ? seg
        : seg.replace(rx, m => `<mark class="kw">${m}</mark>`)).join('');
  }
  function hlFam(s, fam) {
    const t = (D.termrx || {})[fam] || {};
    let out = ESCH(s);
    // ci patterns are often stems ("cyber[\s-]?secur"); extend the match to
    // the word's end so the mark never cuts a word in half
    try { if (t.ci) out = hlParts(out, new RegExp('(?:' + t.ci + ')[A-Za-z]*', 'gi')); } catch (e) {}
    try { if (t.cs) out = hlParts(out, new RegExp(t.cs, 'g')); } catch (e) {}
    return out;
  }

  /* Verified scroll-to-text anchors, one JSON per industry, loaded lazily so
     the first paint never waits for them. Until an industry's file lands its
     links open the document top -- the documented progressive-enhancement
     behaviour -- and the grid's hrefs upgrade in place when it arrives. */
  const anchLoaded = {};
  function loadAnchors(ind) {
    const slug = SLUG(ind);
    if (!anchLoaded[slug]) {
      anchLoaded[slug] = fetch('data/anchors/' + slug + '.json')
        .then(r => r.ok ? r.json() : {})
        .then(a => { Object.assign(D.anchors, a); upgradeAnchors(ind); })
        .catch(() => {});
    }
    return anchLoaded[slug];
  }
  function upgradeAnchors(ind) {
    $$('a.inv-cell[data-cik]').forEach(a => {
      if (a.dataset.ind !== ind || a.dataset.hl) return;
      const anch = D.anchors[`f:${a.dataset.cik}:${a.dataset.fy}`];
      if (anch && anch.f) { a.href = a.href.split('#')[0] + anch.f; a.dataset.hl = '1'; }
    });
  }

  function closeModal() {
    const m = $('.modal-back');
    if (m) m.remove();
    document.removeEventListener('keydown', escClose);
  }
  function escClose(e) { if (e.key === 'Escape') closeModal(); }

  async function openReview(cell) {
    const { name, fy } = cell.dataset;
    const cik = cell.dataset.cik, ind = cell.dataset.ind;
    const docUrl = cell.href.split('#')[0];
    // sentence anchors ride in the industry's lazy anchor file; wait for it so
    // the per-sentence deep links are there on first open
    const [sentMap] = await Promise.all([sentencesFor(ind), loadAnchors(ind)]);
    const rows = sentMap[`${cik}:${fy}`] || [];
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.innerHTML =
      `<div class="modal" role="dialog" aria-label="Technology sentences in this filing">
        <div class="modal-head">
          <h3>${name} · FY${fy}</h3>
          <span class="m-meta">${rows.length} technology famil${rows.length === 1 ? 'y' : 'ies'} mentioned</span>
          <a class="modal-open" target="_blank" rel="noopener" href="${cell.href}">Open the filing ↗</a>
          <button class="modal-x" aria-label="Close">×</button>
        </div>
        <div class="modal-body">` +
      (rows.length ? rows.map(([fam, s]) => {
        const anch = D.anchors && D.anchors[`s:${cik}:${fy}:${fam}`];
        return `<div class="m-sent"><div class="m-txt">${hlFam(s, fam)}</div>
          <div class="m-foot"><span>${D.inventory.labels[fam] || fam} · first mention in this filing</span>
          <a target="_blank" rel="noopener" href="${docUrl}${anch ? anch.f : ''}">
            open at this sentence${anch ? '' : ' (top of document)'} ↗</a></div></div>`;
      }).join('')
        : '<p class="m-note">No technology sentences extracted for this filing.</p>') +
      `<p class="m-note">Every link opens the original filing on sec.gov; where a
        verified anchor exists the browser scrolls to the sentence and highlights
        it (plain-text era filings cannot carry anchors).</p></div></div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('.modal-x')) closeModal();
    });
    document.addEventListener('keydown', escClose);
  }

  function renderFilings() {
    const sel = $('#inv-ind');
    if (!sel.options.length) {
      const avail = INDUSTRIES.filter(i => D.inventory.firms.some(f => f.industry === i));
      sel.innerHTML = avail.map(i =>
        `<option${i === INV.ind ? ' selected' : ''}>${i}</option>`).join('');
      sel.addEventListener('change', () => { INV.ind = sel.value; renderFilings(); });
      $('#inv-search').addEventListener('input', (e) => {
        INV.q = e.target.value.toLowerCase().trim(); renderFilings();
      });
      $('#inv-grid').addEventListener('mouseover', (e) => {
        const a = e.target.closest('a.inv-cell'); if (!a) return;
        const techs = a.dataset.t
          ? a.dataset.t.split(',').map(i => D.inventory.labels[D.inventory.families[+i]]).join(', ')
          : '';
        Charts.showTip(`<b>${a.dataset.name}</b> · FY${a.dataset.fy}<br>` +
          (a.dataset.x === '1' ? 'under the word-count screen this year'
            : techs ? techs : 'no technology language') +
          (a.dataset.t
            ? `<i>click to review each technology's sentence, linked into the filing</i>`
            : `<i>click to open the filing on sec.gov</i>`), e);
      });
      $('#inv-grid').addEventListener('mouseout', Charts.hideTip);
      $('#inv-grid').addEventListener('click', (e) => {
        const a = e.target.closest('a.inv-cell');
        if (!a || !a.dataset.t) return;                 // no-tech cells stay direct links
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        Charts.hideTip();
        openReview(a);
      });
    }
    sel.disabled = !!INV.q;

    let firms = INV.q
      ? D.inventory.firms.filter(f => f.name.toLowerCase().includes(INV.q))
      : D.inventory.firms.filter(f => f.industry === INV.ind);
    $('#inv-count').textContent = firms.length.toLocaleString('en-US') + ' firms';

    const years = D.inventory.years;
    const head = `<div class="inv-row inv-head"><span></span>` +
      years.map(y => `<span class="yh">${y % 2 ? '' : "'" + String(y).slice(2)}</span>`).join('') +
      `<span class="yh">tech</span></div>`;

    const rowOf = (f) => {
      const byFy = {};
      f.cells.forEach(c => { byFy[c.fy] = c; });
      const maxT = f.cells.reduce((s, c) => Math.max(s, c.t.length), 0);
      const cells = years.map(y => {
        const c = byFy[y];
        if (!c) return '<span class="inv-cell"></span>';
        const n = c.t.length;
        const lvl = c.x ? 'x' : n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : 3;
        const anch = (D.anchors && D.anchors[`f:${f.cik}:${y}`]) || null;
        return `<a class="inv-cell lv-${lvl}" target="_blank" rel="noopener"
          href="${secDoc(f.cik, c.adsh, c.doc)}${anch ? anch.f : ''}"
          data-name="${f.name.replace(/"/g, '&quot;')}" data-cik="${f.cik}"
          data-ind="${f.industry}"
          data-fy="${y}" data-t="${c.t.join(',')}" data-x="${c.x}"
          ${anch ? 'data-hl="1"' : ''}
          aria-label="${f.name} FY${y}, review its technology sentences"></a>`;
      }).join('');
      const ind = INV.q ? ` <small style="color:var(--ink-3)">· ${SHORT[f.industry]}</small>` : '';
      return `<div class="inv-row">` +
        `<a class="inv-name" style="text-decoration:none" target="_blank" rel="noopener"
           href="${secCompany(f.cik)}" title="${f.name} on EDGAR">${f.name}${ind}</a>` +
        cells +
        `<span class="inv-tot${maxT ? '' : ' zero'}">${maxT || ''}</span></div>`;
    };

    let html = head;
    if (INV.q) {
      firms = firms.slice().sort((a, b) => a.name.localeCompare(b.name));
      html += firms.map(rowOf).join('');
    } else {
      const groups = new Map();
      firms.forEach(f => {
        const g = subgroup(f.industry, f.sic);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(f);
      });
      [...groups.keys()].sort().forEach(g => {
        const list = groups.get(g).sort((a, b) => a.name.localeCompare(b.name));
        html += `<div class="inv-seg">${g}<span>${list.length} firms</span></div>`;
        html += list.map(rowOf).join('');
      });
    }
    $('#inv-grid').innerHTML = html;
    // fetch this industry's verified anchors (no-op if already here); the
    // grid's links upgrade in place when they land
    if (!INV.q) loadAnchors(INV.ind);
    else INDUSTRIES.forEach(loadAnchors);
  }

  // ---------------------------------------------------------------- statistics
  function renderStats() {
    const host = $('#stats-body');
    if (!D.lagstats) {
      host.innerHTML = '<div class="card"><p class="sub">Run analysis 03 and ' +
        '<code>build_data.py</code> to bake this view.</p></div>';
      return;
    }
    const S = D.lagstats, sm = S.summary;
    host.innerHTML =
      `<div class="stats">
        <div class="stat"><div class="v">${sm.laggard.construction_mean_rank.toFixed(1)} / 9</div>
          <div class="k">construction's mean entry rank across ${sm.laggard.n_technologies} technologies</div></div>
        <div class="stat accent"><div class="v">p = ${sm.laggard.p_permutation.toFixed(2)}</div>
          <div class="k">permutation test: NOT significantly later than chance: mid-pack, not last</div></div>
        <div class="stat"><div class="v">×${sm.hazard.software_median_or.toFixed(1)}</div>
          <div class="k">software's odds of picking a technology's language up first, vs construction</div></div>
        <div class="stat risk"><div class="v">+1.2 pp/yr</div>
          <div class="k">Item 1A share rises with vocabulary age (p ${sm.lifecycle.p < .001 ? '&lt; .001' : '= ' + sm.lifecycle.p.toFixed(3)}): capability first, risk accretes</div></div>
      </div>

      <div class="card"><h2>Who is actually late? Mean entry rank, with its permutation p</h2>
        <p class="sub">Rank 1 = first industry whose disclosure the technology
        enters; never entering ranks last; 20,000 within-technology label
        permutations. Ties at the 1996 panel floor work AGAINST finding a lag,
        so the test is conservative. The statistically late industries are not
        the one the folk claim names.</p>
        <div id="st-rank" class="chart"></div></div>

      <div class="card"><h2>Firm-level pickup speed vs construction</h2>
        <p class="sub">Median odds ratio from ${new Set(S.hazard.map(h => h.family)).size}
        discrete-time first-mention models (one per technology): year FE,
        filing length as the size proxy, SE clustered by firm. Hover a bar for
        the technology count behind it.</p>
        <div id="st-hazard" class="chart"></div></div>

      <div class="grid2">
        <div class="card"><h2>The vocabulary lifecycle</h2>
          <p class="sub">Share of a technology's located mentions sitting in
          Item 1A, by years since the industry's sustained entry (2006+
          entries). The talk enters as capability and accretes risk language
          as it matures.</p>
          <div id="st-life" class="chart"></div></div>
        <div class="card"><h2>Hype against steady, in event time</h2>
          <p class="sub">Once a hype technology clears the entry bar it does
          not collapse faster than a steady one (quadratic difference
          p = ${sm.hype_shape.p.toFixed(2)}); the hype signature is never
          clearing the bar at all: the "never" rows on the entry matrix.</p>
          <div id="st-shape" class="chart"></div></div>
      </div>`;

    Charts.barsH($('#st-rank'), {
      labelW: 170,
      items: S.laggard.map(r => ({
        label: SHORT[r.industry] || r.industry,
        value: r.mean_entry_rank, color: IND_COLOR[r.industry],
        display: r.mean_entry_rank.toFixed(1) +
          (r.p_perm_later_than_chance < .05 ? ' · late*'
            : r.p_perm_later_than_chance > .95 ? ' · early' : ''),
        tip: `mean rank ${r.mean_entry_rank.toFixed(2)} across ${r.n_technologies} technologies<br>` +
             `P(later than chance) = ${r.p_perm_later_than_chance.toFixed(3)}`,
      })),
    });

    Charts.barsH($('#st-hazard'), {
      labelW: 170,
      items: S.hazard_summary.map(r => ({
        label: SHORT[r.industry] || r.industry,
        value: r.median, color: IND_COLOR[r.industry],
        display: '×' + r.median.toFixed(2),
        tip: `median odds ×${r.median.toFixed(2)} vs construction<br>` +
             `IQR ×${r.q25.toFixed(2)}–×${r.q75.toFixed(2)} across ${r.n} technologies`,
      })),
    });

    const lys = S.lifecycle_binned.map(r => r.yse);
    Charts.lineChart($('#st-life'), {
      years: lys, height: 250, everyX: 2,
      series: [{ name: 'risk share', color: '--risk', width: 2.4,
                 values: S.lifecycle_binned.map(r => r.m * 100) }],
      yFmt: v => v + '%', yLabel: 'Item 1A share of located mentions (%)',
      tipFmt: (v, y) => `${v.toFixed(0)}% in Item 1A, ${y} years after entry`,
    });

    const sys = [...new Set(S.shape_binned.map(r => r.yse))].sort((a, b) => a - b);
    Charts.lineChart($('#st-shape'), {
      years: sys, height: 250, everyX: 2,
      series: [['steady', '--accent', 'steady operational'],
               ['hype', '--risk', 'hype-and-fade']].map(([g, color, name]) => ({
        name, color, width: 2.2,
        values: sys.map(y => {
          const r = S.shape_binned.find(x => x.grp === g && x.yse === y);
          return r ? r.m * 100 : null;
        }),
      })),
      yFmt: v => v + '%', yLabel: 'Filings mentioning (%)',
      tipFmt: (v, y) => `${v.toFixed(1)}% of filings, ${y} years after entry`,
    });
    if (D.night) renderNight(host);
  }

  /* The night-batch panels (analyses 11-13): word mortality, the rhetorical
     moves by era, and the co-mention constellations. */
  const GROUPS = [
    ['risk_first', 'risk-first', '--risk'],
    ['wave90s', 'the 90s wave', '--neutral'],
    ['management', 'management ideas', '--c3'],
    ['steady', 'steady tools', '--c1'],
    ['robotisation', 'robotisation', '--c2'],
    ['hype', 'hyped tech', '--c4'],
  ];
  const ERAS3 = ['1996-2004', '2005-2014', '2015-2025'];
  function renderNight(host) {
    const N = D.night;
    host.insertAdjacentHTML('beforeend',
      `${N.lifecycle ? `<div class="grid2">
        <div class="card"><h2>Once said, kept? The mortality of technology words</h2>
          <p class="sub">Once a firm first mentions a family, the share still
          mentioning it t years later (counted only in years the firm files).
          Risk language never lets go; hype words half-vanish within five
          years. TQM now stands at 6% of its 1998 peak: words die like fads.</p>
          <div id="nt-ret" class="chart"></div></div>
        <div class="card"><h2>What gets abandoned</h2>
          <p class="sub">Odds of dropping the family from next year's 10-K,
          against steady tools (logit, industry + year fixed effects, tenure
          control). Below ×1 = stickier than a tool.</p>
          <div id="nt-haz" class="chart"></div></div>
      </div>` : ''}
      ${N.moves ? `<div class="card"><h2>The moves of technology talk, era by era</h2>
        <p class="sub">Three open-weight models coded what each sampled technology
        sentence is DOING. The capability showcase leads in every era, but the
        threat narrative climbs 19% → 32% → 49% of its own passages across the
        three eras, and the governance signal is almost entirely a post-2015
        invention. Sentences without a two-model majority are not shown.</p>
        <div id="nt-moves" class="chart"></div></div>` : ''}
      ${N.constellations ? `<div class="card"><h2>The sky fills in: technologies arrive as a bundle</h2>
        <p class="sub">Family pairs co-mentioned in the SAME filing more often than
        chance (lift ≥ 1.5, Fisher exact, Bonferroni). The wiring triples and then
        doubles: technology talk has consolidated into one bundle.</p>
        <div class="stats">
          ${ERAS3.map(e => `<div class="stat${e === '2015-2025' ? ' accent' : ''}">
            <div class="v">${N.constellations.edges_per_era[e] || 0}</div>
            <div class="k">significant pairings, ${e}</div></div>`).join('')}
        </div>
        <div id="nt-pairs"></div></div>` : ''}`);

    if (N.lifecycle) {
      const ts = Array.from({ length: 16 }, (_, i) => i);
      Charts.lineChart($('#nt-ret'), {
        years: ts, height: 260, everyX: 3,
        series: GROUPS.map(([g, name, color]) => ({
          name, color, width: g === 'risk_first' || g === 'hype' ? 2.4 : 1.6,
          values: ts.map(t => {
            const r = N.lifecycle.retention.find(x => x.group === g && x.t === t);
            return r ? r.retained * 100 : null;
          }),
        })),
        ymax: 100, yFmt: v => v + '%', yLabel: 'Still mentioning it (%)',
        tipFmt: (v, t) => `${t} yr after first mention: ${v.toFixed(0)}% still say it`,
      });
      Charts.barsH($('#nt-haz'), {
        labelW: 150,
        items: N.lifecycle.hazard.slice()
          .sort((a, b) => a.odds_ratio - b.odds_ratio)
          .map(r => {
            const g = GROUPS.find(x => x[0] === r.group) || [r.group, r.group, '--ink'];
            return { label: g[1], value: r.odds_ratio, color: g[2],
                     display: '×' + r.odds_ratio.toFixed(2),
                     tip: `odds ×${r.odds_ratio.toFixed(2)} ` +
                          `[${r.ci_lo.toFixed(2)}, ${r.ci_hi.toFixed(2)}] vs steady tools` };
          }),
      });
    }
    if (N.moves) {
      const MOVES = [
        ['showcase', 'Capability showcase', '--c1'],
        ['housekeeping', 'Housekeeping', '--neutral'],
        ['bandwagon', 'Industry bandwagon', '--c4'],
        ['threat_narrative', 'Threat narrative', '--thr'],
        ['hedged_plan', 'Hedged plan', '--c3'],
        ['safe_harbor', 'Generic disclaimer', '--risk'],
        ['compliance_signal', 'Governance signal', '--c2'],
      ];
      const rows = N.moves.by_era;
      Charts.stackedBar($('#nt-moves'), {
        categories: ERAS3, labels: ERAS3, height: 280,
        counts: ERAS3.map(e => rows.find(r => r.era === e).n_passages),
        yLabel: 'share of coded technology sentences',
        series: MOVES.map(([key, name, color]) => ({
          name, color,
          values: ERAS3.map(e => rows.find(r => r.era === e)[`pct_${key}`] || 0),
        })),
      });
    }
    if (N.constellations) {
      $('#nt-pairs').innerHTML =
        '<p class="sub" style="margin-top:12px">The tightest pairings of each era:</p>' +
        ERAS3.map(e => {
          const ps = N.constellations.top_pairs.filter(p => p.era === e);
          return `<div class="m-sent"><div class="m-foot"><span><b>${e}</b></span>
            <span>${ps.map(p =>
              `${D.adoption.labels[p.fam_a] || p.fam_a} + ${D.adoption.labels[p.fam_b] || p.fam_b}
               (×${p.lift.toFixed(1)})`).join(' · ')}</span></div></div>`;
        }).join('');
    }
  }

  // ---------------------------------------------------------------- precision
  function renderPrecision() {
    const host = $('#prec-body');
    if (!D.precision) {
      host.innerHTML = '<div class="card"><p class="sub">The three-model precision ' +
        'run has not been baked into the site yet. Run analysis 02, then ' +
        '<code>build_data.py</code>.</p></div>';
      return;
    }
    const P = D.precision, s = P.summary;
    host.innerHTML =
      `<div class="stats">` +
      `<div class="stat accent"><div class="v">${s.n_contexts_voted.toLocaleString('en-US')}</div>` +
      `<div class="k">hit contexts judged by all three models</div></div>` +
      `<div class="stat"><div class="v">${fmtPct(s.mean_pairwise_agreement, 0)}</div>` +
      `<div class="k">mean pairwise agreement between labs</div></div>` +
      `<div class="stat risk"><div class="v">${s.demoted_to_llm.length}</div>` +
      `<div class="k">families demoted to passage-level coding</div></div>` +
      `<div class="stat good"><div class="v">${s.promoted_to_lexicon.length}</div>` +
      `<div class="k">noisy families that turned out clean</div></div>` +
      `</div>` +
      `<div class="card"><h2>Precision by family</h2>` +
      `<p class="sub">Share of sampled hits the 2-of-3 vote judged true. The rule, ` +
      `fixed before results: keyword tier needs ≥ 80% overall and ≥ 70% in ` +
      `every era with 30+ hits.</p><div class="chart" id="ch-prec"></div></div>`;

    const rows = P.families.slice().sort((a, b) => a.precision - b.precision);
    Charts.barsH($('#ch-prec'), {
      labelW: 190, rowH: 24,
      items: rows.map(r => ({
        label: (D.lag.labels[r.family] || r.family),
        value: r.precision,
        color: r.tier_decision === 'lexicon' ? '--c2' : '--risk',
        display: fmtPct(r.precision, 0) +
          (r.changed ? (r.tier_decision === 'llm' ? ' ↓ demoted' : ' ↑ promoted') : ''),
        tip: `${r.n_sampled} contexts · ${fmtPct(r.pct_unanimous, 0)} unanimous · stays ${r.tier_decision}`,
      })),
      legend: [{ name: 'keyword tier (clean)', color: '--c2' },
               { name: 'passage-coding tier (noisy)', color: '--risk' }],
    });
  }

  // ---------------------------------------------------------------- boot
  /* Two phases, so the landing view paints as soon as ITS data is here rather
     than after every byte of the site's data:
       1. inventory.json alone (the filings grid, the landing view) -- the
          selected view shows immediately, with a loading note until then;
       2. the small per-view files in parallel, then the other views.
     Anchors never block anything: they stream in per industry (loadAnchors)
     and upgrade links in place. */
  async function boot() {
    D.anchors = {};
    const start = location.hash.replace('#', '');
    show(['overview', 'filings', 'technologies', 'stats', 'precision', 'method']
         .includes(start) ? start : 'filings', false);
    const smallP = Promise.all(
      ['headline', 'lag', 'adoption', 'entries', 'risk_first', 'precision',
       'lagstats']
        .map(n => fetch('data/' + n + '.json').then(r => r.json())));
    // the night-batch statistics view degrades gracefully when absent
    const nightP = fetch('data/night.json')
      .then(r => r.ok ? r.json() : null).catch(() => null);
    // lexicon term patterns for the review-panel keyword highlight
    const termP = fetch('data/termrx.json')
      .then(r => r.ok ? r.json() : null).catch(() => null);
    try {
      D.inventory = await fetch('data/inventory.json').then(r => r.json());
    } catch (e) {
      $('#main').insertAdjacentHTML('afterbegin',
        '<div class="card callout"><b>Could not load data/.</b> Browsers block ' +
        '<code>fetch</code> on <code>file://</code>. Serve the folder: ' +
        '<code>python -m http.server 8766</code> and open ' +
        '<code>http://localhost:8766</code>.</div>');
      throw e;
    }
    renderFilings();
    // ?review=<cik>:<fy> deep-links straight into a filing's review panel
    const rv = new URLSearchParams(location.search).get('review');
    if (rv) {
      const [cik, fy] = rv.split(':');
      const cell = $(`a.inv-cell[data-cik="${cik}"][data-fy="${fy}"]`);
      if (cell) openReview(cell);
    }
    const files = await smallP;
    [D.headline, D.lag, D.adoption, D.entries, D.risk_first, D.precision,
     D.lagstats] = files;
    D.night = await nightP;
    D.termrx = await termP;
    renderOverview();
    renderTech();
    renderStats();
    renderPrecision();
    // idle prefetch: the remaining industries' anchors, one at a time, so a
    // later industry switch or review click finds them already cached
    for (const ind of INDUSTRIES) await loadAnchors(ind);
  }
  boot();
})();
