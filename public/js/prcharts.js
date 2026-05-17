let _prRosterFilter = 'all'; // 'all' | 'streak' | 'attention' | 'nologs'

function setPrRosterFilter(f, btn) {
  _prRosterFilter = f;
  document.querySelectorAll('#page-prcharts .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderPrCharts();
}

function renderPrCharts() {
  const el = document.getElementById('prchart-roster');
  if (!el) return;

  const sortVal = (document.getElementById('prchart-sort') || {}).value || 'name';

  // Build per-athlete stats
  const roster = athletes.filter(a => a.is_active).map(a => {
    const log    = getPrLog(a.id);
    const sorted = [...log].sort((x, y) => x.date.localeCompare(y.date)); // oldest→newest

    // Per-lift PR counts
    const prCount = { squat: 0, bench: 0, dead: 0 };
    const logged  = { squat: 0, bench: 0, dead: 0 };
    sorted.forEach(e => {
      ['squat','bench','dead'].forEach(l => {
        if (e[l + '_pr'] !== null && e[l + '_pr'] !== undefined) {
          logged[l]++;
          if (e[l + '_pr'] === true) prCount[l]++;
        }
      });
    });

    const totalLogged = logged.squat + logged.bench + logged.dead;
    const totalPr     = prCount.squat + prCount.bench + prCount.dead;
    const overallPct  = totalLogged ? Math.round(totalPr / totalLogged * 100) : null;

    // Current all-PR streak (consecutive recent blocks where ALL 3 PR'd)
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const e = sorted[i];
      if (e.squat_pr === true && e.bench_pr === true && e.dead_pr === true) streak++;
      else break;
    }

    // Last block result
    const last = sorted[sorted.length - 1] || null;
    const lastAllPr  = last && last.squat_pr === true  && last.bench_pr === true  && last.dead_pr === true;
    const lastNonePr = last && last.squat_pr === false && last.bench_pr === false && last.dead_pr === false;
    const lastMixed  = last && !lastAllPr && !lastNonePr &&
      [last.squat_pr, last.bench_pr, last.dead_pr].some(v => v !== null && v !== undefined);

    return { a, log, sorted, prCount, logged, overallPct, streak, last, lastAllPr, lastNonePr, lastMixed };
  });

  // Filter
  let filtered = roster;
  if (_prRosterFilter === 'streak')    filtered = roster.filter(r => r.streak >= 2);
  if (_prRosterFilter === 'attention') filtered = roster.filter(r => r.log.length > 0 && (r.lastNonePr || r.lastMixed || r.overallPct < 50));
  if (_prRosterFilter === 'nologs')    filtered = roster.filter(r => r.log.length === 0);

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortVal === 'name')      return a.a.name.localeCompare(b.a.name);
    if (sortVal === 'pct')       return (b.overallPct ?? -1) - (a.overallPct ?? -1);
    if (sortVal === 'streak')    return b.streak - a.streak;
    if (sortVal === 'recent')    return (b.last ? b.last.date : '') > (a.last ? a.last.date : '') ? 1 : -1;
    if (sortVal === 'attention') {
      // No logs first, then last-block no-PR, then mixed, then low %, then high %
      const score = r => {
        if (r.log.length === 0) return 0;
        if (r.lastNonePr) return 1;
        if (r.lastMixed)  return 2;
        if (r.overallPct !== null && r.overallPct < 50) return 3;
        return 4;
      };
      return score(a) - score(b);
    }
    return 0;
  });

  if (!filtered.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:40px 0;text-align:center">No athletes match this filter.</div>';
    return;
  }

  // ── Summary row ─────────────────────────────────────────────
  const withLogs  = roster.filter(r => r.log.length > 0);
  const onStreak  = roster.filter(r => r.streak >= 2).length;
  const allPrLast = roster.filter(r => r.lastAllPr).length;
  const needsAttn = roster.filter(r => r.log.length > 0 && (r.lastNonePr || r.lastMixed)).length;

  const sc = (label, val, sub, color) =>
    '<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:10px 14px;flex:1;min-width:90px">' +
    '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin-bottom:3px">' + label + '</div>' +
    '<div style="font-size:20px;font-weight:700;color:' + color + '">' + val + '</div>' +
    (sub ? '<div style="font-size:10px;color:var(--text3);margin-top:1px">' + sub + '</div>' : '') +
    '</div>';

  const summary =
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">' +
    sc('Athletes tracked', withLogs.length, 'of ' + roster.length + ' active', 'var(--text)') +
    sc('All PR last block', allPrLast, 'athletes', '#4caf50') +
    sc('On a streak 🔥', onStreak, '2+ consecutive', '#ffc107') +
    sc('Needs attention', needsAttn, 'last block not all PR', '#e53935') +
    '</div>';

  // ── Roster rows ──────────────────────────────────────────────
  const rows = filtered.map(r => {
    const { a, sorted, prCount, logged, overallPct, streak, last, lastAllPr, lastNonePr, lastMixed } = r;

    // Status badge
    const badge = lastAllPr  ? '<span style="font-size:10px;background:rgba(76,175,80,0.18);color:#4caf50;border-radius:5px;padding:2px 7px;font-weight:700">All PR' + (streak > 1 ? ' 🔥×' + streak : '') + '</span>'
                : lastNonePr ? '<span style="font-size:10px;background:rgba(229,57,53,0.15);color:#e53935;border-radius:5px;padding:2px 7px;font-weight:700">No PR</span>'
                : lastMixed  ? '<span style="font-size:10px;background:rgba(255,193,7,0.15);color:#ffc107;border-radius:5px;padding:2px 7px;font-weight:700">Mixed</span>'
                : r.log.length === 0 ? '<span style="font-size:10px;color:var(--text3)">No entries</span>'
                : '';

    // Mini block dots (last 8, oldest→newest)
    const recent = sorted.slice(-8);
    const blockDots = recent.map(e => {
      const allPr  = e.squat_pr === true  && e.bench_pr === true  && e.dead_pr === true;
      const nonePr = e.squat_pr === false && e.bench_pr === false && e.dead_pr === false;
      const hasAny = [e.squat_pr, e.bench_pr, e.dead_pr].some(v => v !== null && v !== undefined);
      const bg = allPr ? '#4caf50' : nonePr ? '#e53935' : hasAny ? '#ffc107' : 'var(--border2)';
      const tip = e.block + ' · ' + fmtDay(e.date);
      return '<div title="' + tip + '" style="width:12px;height:12px;border-radius:3px;background:' + bg + ';flex-shrink:0"></div>';
    }).join('');

    // Per-lift PR%
    const liftPct = ['squat','bench','dead'].map(l => {
      const pct = logged[l] ? Math.round(prCount[l] / logged[l] * 100) : null;
      const color = pct === null ? 'var(--text3)' : pct >= 70 ? '#4caf50' : pct >= 40 ? '#ffc107' : '#e53935';
      const name  = l === 'dead' ? 'DL' : l.charAt(0).toUpperCase() + l.slice(1);
      return '<div style="text-align:center;min-width:36px">' +
        '<div style="font-size:10px;color:var(--text3)">' + name + '</div>' +
        '<div style="font-size:12px;font-weight:700;color:' + color + '">' + (pct !== null ? pct + '%' : '—') + '</div>' +
        '</div>';
    }).join('');

    const rowBg = lastAllPr ? 'rgba(76,175,80,0.04)' : lastNonePr ? 'rgba(229,57,53,0.04)' : 'transparent';

    return '<div style="display:grid;grid-template-columns:180px 1fr auto auto;gap:12px;align-items:center;' +
      'background:' + rowBg + ';border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:6px">' +

      // Name + badge
      '<div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<div class="avatar" style="' + avStyle(a.id) + ';width:28px;height:28px;font-size:11px;flex-shrink:0">' + ini(a.name) + '</div>' +
          '<div>' +
            '<div style="font-weight:600;font-size:13px;color:var(--text)">' + a.name + '</div>' +
            '<div style="margin-top:2px">' + badge + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Block dots strip
      '<div style="display:flex;align-items:center;gap:3px;flex-wrap:nowrap;overflow:hidden">' +
        (r.log.length === 0
          ? '<span style="font-size:11px;color:var(--text3);font-style:italic">No blocks logged</span>'
          : blockDots) +
      '</div>' +

      // Per-lift PR%
      '<div style="display:flex;gap:10px;align-items:center">' + liftPct + '</div>' +

      // Action
      '<div>' +
        '<button onclick="openPrModal(\'' + a.id + '\')" ' +
          'style="font-size:11px;padding:5px 10px;border-radius:7px;border:1px solid var(--border2);background:var(--surface2);color:var(--text2);cursor:pointer;white-space:nowrap">+ Log block</button>' +
      '</div>' +

    '</div>';
  }).join('');

  el.innerHTML = summary + rows;
}
