let bmCharts = {};

function toggleCohort(btn) {
  const body = document.getElementById('cohort-body');
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? '' : 'none';
  btn.textContent = hidden ? 'Hide' : 'Show';
}

function getLast6Months() {
  const out = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      label: MONTHS[d.getMonth()].slice(0, 3) + " '" + String(d.getFullYear()).slice(2),
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    });
  }
  return out;
}

function athleteActiveAtEndOf(a, me) {
  const snap = new Date(Math.min(me.getTime(), Date.now()));
  if (a.start_date) {
    const sd = new Date(a.start_date + 'T12:00:00');
    if (sd <= snap) {
      if (a.is_active) return true;
      if (a.end_date) {
        const ed = new Date(a.end_date + 'T12:00:00');
        if (ed > snap) return true;
      }
    }
  }
  for (const p of (a.coaching_periods || [])) {
    if (!p.start_date || !p.end_date) continue;
    const sd = new Date(p.start_date + 'T12:00:00');
    const ed = new Date(p.end_date + 'T12:00:00');
    if (sd <= snap && ed > snap) return true;
  }
  return false;
}

function getMonthStats(ms, me) {
  const active = athletes.filter(a => athleteActiveAtEndOf(a, me)).length;

  let churned = 0;
  athletes.forEach(a => {
    if (a.end_date) {
      const ed = new Date(a.end_date + 'T12:00:00');
      if (ed >= ms && ed <= me) churned++;
    }
    (a.coaching_periods || []).forEach(p => {
      if (p.end_date) {
        const ed = new Date(p.end_date + 'T12:00:00');
        if (ed >= ms && ed <= me) churned++;
      }
    });
  });

  const prevMe = new Date(ms.getTime() - 1);
  const activeAtStart = athletes.filter(a => athleteActiveAtEndOf(a, prevMe)).length;
  const base = activeAtStart + churned;
  const churnRate = base > 0 ? Math.round(churned / base * 100) : 0;

  let newClients = 0, reactivated = 0;
  athletes.forEach(a => {
    if (a.start_date) {
      const sd = new Date(a.start_date + 'T12:00:00');
      if (sd >= ms && sd <= me) {
        if ((a.coaching_periods || []).length > 0) reactivated++;
        else newClients++;
      }
    }
  });

  return { active, churned, churnRate, newClients, reactivated, netGrowth: newClients + reactivated - churned };
}

function salesForMonth(ms, me) {
  const entries = (salesLog || []).filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date + 'T12:00:00');
    return d >= ms && d <= me;
  });
  const calls = entries.reduce((n, e) => n + (e.calls || 0), 0);
  const closes = entries.reduce((n, e) => n + (e.closes || 0), 0);
  return calls > 0 ? Math.round(closes / calls * 100) : null;
}

function makeBmChart(id, type, labels, datasets, yOpts) {
  if (bmCharts[id]) { bmCharts[id].destroy(); delete bmCharts[id]; }
  const canvas = document.getElementById(id);
  if (!canvas) return;
  bmCharts[id] = new Chart(canvas, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { size: 10 } }, beginAtZero: true, ...(yOpts || {}) }
      }
    }
  });
}

function renderCohortTable() {
  const el = document.getElementById('cohort-table-wrap');
  if (!el) return;

  const now = new Date();
  const checkpoints = [1, 3, 6, 12];

  const cohortMap = {};
  athletes.forEach(a => {
    if (!a.start_date) return;
    const sd = new Date(a.start_date + 'T12:00:00');
    const key = sd.getFullYear() + '-' + String(sd.getMonth() + 1).padStart(2, '0');
    if (!cohortMap[key]) cohortMap[key] = { year: sd.getFullYear(), month: sd.getMonth(), athletes: [] };
    cohortMap[key].athletes.push(a);
  });

  const cohorts = Object.entries(cohortMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 18);

  if (!cohorts.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text3)">No data yet — add start dates to clients.</div>';
    return;
  }

  const th = txt => '<th style="text-align:center;padding:8px 14px;color:var(--text3);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--border);white-space:nowrap">' + txt + '</th>';
  const thL = txt => '<th style="text-align:left;padding:8px 14px;color:var(--text3);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--border)">' + txt + '</th>';

  let html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">';
  html += '<thead><tr>' + thL('Cohort') + th('Size') + checkpoints.map(n => th('Mo ' + n)).join('') + '</tr></thead><tbody>';

  cohorts.forEach(([key, c]) => {
    const label = MONTHS[c.month].slice(0, 3) + " '" + String(c.year).slice(2);
    const border = 'border-bottom:1px solid var(--border)';
    html += '<tr>';
    html += '<td style="padding:8px 14px;color:var(--text);font-weight:500;' + border + '">' + label + '</td>';
    html += '<td style="text-align:center;padding:8px 14px;color:var(--text2);' + border + '">' + c.athletes.length + '</td>';

    checkpoints.forEach(n => {
      const checkDate = new Date(c.year, c.month + n, 1);
      if (checkDate > now) {
        html += '<td style="text-align:center;padding:8px 14px;color:var(--text3);' + border + '">—</td>';
        return;
      }
      const still = c.athletes.filter(a => {
        if (a.is_active) return true;
        if (!a.end_date) return false;
        return new Date(a.end_date + 'T12:00:00') > checkDate;
      }).length;
      const pct = Math.round(still / c.athletes.length * 100);
      const color = pct >= 80 ? 'var(--green-text)' : pct >= 60 ? '#8bc34a' : pct >= 40 ? '#ffc107' : 'var(--red-text)';
      html += '<td style="text-align:center;padding:8px 14px;font-weight:600;color:' + color + ';' + border + '">' + pct + '%</td>';
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function renderBizMetrics() {
  if (!document.getElementById('bm-active')) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Active Clients
  document.getElementById('bm-active').textContent = athletes.filter(a => a.is_active).length;

  // Annual Churn %
  const apct = calcAnnualChurn();
  const annualEl = document.getElementById('bm-annual-churn');
  annualEl.textContent = apct === null ? '—' : apct + '%';
  annualEl.style.color = apct === null ? 'var(--text2)' : apct <= 25 ? '#4caf50' : apct <= 40 ? '#8bc34a' : apct <= 55 ? '#ffc107' : apct <= 70 ? '#ff7043' : '#e53935';
  document.getElementById('bm-annual-churn-sub').textContent = apct === null ? 'No churn data in the last 12 months' : apct + '% of clients lost over the past 12 months';

  // Monthly Churn %
  const ch = calcChurn();
  const churnPct = ch ? Math.round(ch.rate * 100) : 0;
  const churnEl = document.getElementById('bm-churn');
  churnEl.textContent = ch ? churnPct + '%' : '—';
  churnEl.style.color = !ch ? 'var(--text2)' : churnPct === 0 ? 'var(--green-text)' : churnPct <= 5 ? '#4caf50' : churnPct <= 10 ? '#ffc107' : 'var(--red-text)';
  document.getElementById('bm-churn-sub').textContent = ch
    ? ch.churned + ' left out of ' + ch.base + ' at start of ' + MONTHS[now.getMonth()]
    : 'No churn data this month';

  // Avg Client Lifetime — confirmed (completed) + predicted (includes active)
  const fmtMos = m => m < 12 ? Math.round(m) + ' mo' : Math.floor(m / 12) + 'y ' + (Math.round(m % 12) ? Math.round(m % 12) + 'mo' : '');
  const completedTenures = [];
  athletes.forEach(a => {
    if (!a.is_active && a.start_date && a.end_date) {
      const m = (new Date(a.end_date + 'T12:00:00') - new Date(a.start_date + 'T12:00:00')) / (1000 * 60 * 60 * 24 * 30.44);
      if (m >= 1) completedTenures.push(m);
    }
    (a.coaching_periods || []).forEach(p => {
      if (p.start_date && p.end_date) {
        const m = (new Date(p.end_date + 'T12:00:00') - new Date(p.start_date + 'T12:00:00')) / (1000 * 60 * 60 * 24 * 30.44);
        if (m >= 1) completedTenures.push(m);
      }
    });
  });
  const activeTenures = athletes.filter(a => a.is_active && a.start_date).map(a =>
    (now - new Date(a.start_date + 'T12:00:00')) / (1000 * 60 * 60 * 24 * 30.44)
  ).filter(m => m >= 1);
  const allTenures = [...completedTenures, ...activeTenures];
  const confirmedEl = document.getElementById('bm-lifetime-confirmed');
  const predictedEl = document.getElementById('bm-lifetime-predicted');
  const lifetimeSub = document.getElementById('bm-lifetime-sub');
  if (completedTenures.length) {
    const confirmed = completedTenures.reduce((s, m) => s + m, 0) / completedTenures.length;
    confirmedEl.textContent = fmtMos(confirmed);
  } else {
    confirmedEl.textContent = '—';
  }
  if (allTenures.length) {
    const predicted = allTenures.reduce((s, m) => s + m, 0) / allTenures.length;
    predictedEl.textContent = fmtMos(predicted);
  } else {
    predictedEl.textContent = '—';
  }
  lifetimeSub.textContent = completedTenures.length
    ? completedTenures.length + ' completed · ' + activeTenures.length + ' active included in predicted'
    : 'No completed periods yet';

  // Net Client Growth
  const startedThisMonth = athletes.filter(a => {
    if (!a.start_date) return false;
    const sd = new Date(a.start_date + 'T12:00:00');
    return sd >= monthStart && sd <= monthEnd;
  });
  const newClients = startedThisMonth.filter(a => !(a.coaching_periods || []).length).length;
  const reactivated = startedThisMonth.filter(a => (a.coaching_periods || []).length > 0).length;
  const churnedCount = ch ? ch.churned : 0;
  const netGrowth = newClients + reactivated - churnedCount;
  const growthEl = document.getElementById('bm-growth');
  growthEl.textContent = (netGrowth > 0 ? '+' : '') + netGrowth;
  growthEl.style.color = netGrowth > 0 ? 'var(--green-text)' : netGrowth < 0 ? 'var(--red-text)' : 'var(--text2)';
  document.getElementById('bm-growth-sub').textContent =
    newClients + ' new · ' + reactivated + ' reactivated · ' + churnedCount + ' churned';

  // Close Rate
  const sm = salesThisMonth();
  const calls = sm.reduce((n, e) => n + e.calls, 0);
  const closes = sm.reduce((n, e) => n + e.closes, 0);
  const closeEl = document.getElementById('bm-close');
  const closeSub = document.getElementById('bm-close-sub');
  if (calls > 0) {
    const rate = Math.round(closes / calls * 100);
    closeEl.textContent = rate + '%';
    closeEl.style.color = rate >= 30 ? 'var(--green-text)' : rate >= 15 ? 'var(--amber-text)' : 'var(--red-text)';
    closeSub.textContent = closes + ' closes from ' + calls + ' calls this month';
  } else {
    closeEl.textContent = '—';
    closeSub.textContent = 'No sales calls logged this month';
  }

  // Hourly Rate — last month's total collected (all invoices) ÷ 160 hrs (40h/wk × 4 wks)
  const hourlyEl = document.getElementById('bm-hourly');
  const hourlySub = document.getElementById('bm-hourly-sub');
  if (hourlyEl) {
    const lmDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lmKey   = lmDate.getFullYear() + '-' + String(lmDate.getMonth() + 1).padStart(2, '0');
    const lmLabel = MONTHS[lmDate.getMonth()].slice(0, 3) + " '" + String(lmDate.getFullYear()).slice(2);
    const lmRevenue = (typeof stripeMonthlyRevenue !== 'undefined' ? stripeMonthlyRevenue : {})[lmKey] || 0;
    if (lmRevenue > 0) {
      const hourly = Math.round(lmRevenue / 160);
      hourlyEl.textContent = '$' + hourly;
      hourlyEl.style.color = hourly >= 75 ? '#4caf50' : hourly >= 40 ? '#ffc107' : 'var(--text2)';
      if (hourlySub) hourlySub.textContent = '$' + Math.round(lmRevenue).toLocaleString() + ' in ' + lmLabel + ' ÷ 160 hrs';
    } else {
      hourlyEl.textContent = '—';
      hourlyEl.style.color = 'var(--text2)';
      if (hourlySub) hourlySub.textContent = 'No ' + lmLabel + ' data — refresh Stripe on Payments page';
    }
  }

  // ── Charts ──────────────────────────────────────────────
  if (typeof Chart === 'undefined') return;

  const hist = getLast6Months();
  const labels = hist.map(m => m.label);
  const mStats = hist.map(m => getMonthStats(m.start, m.end));

  makeBmChart('chart-churn', 'bar', labels, [{
    data: mStats.map(s => s.churnRate),
    backgroundColor: mStats.map(s =>
      s.churnRate === 0 ? 'rgba(76,175,80,0.7)' :
      s.churnRate <= 5 ? 'rgba(139,195,74,0.7)' :
      s.churnRate <= 10 ? 'rgba(255,193,7,0.7)' : 'rgba(229,57,53,0.7)'
    ),
    borderRadius: 4
  }]);

  makeBmChart('chart-growth', 'bar', labels, [{
    data: mStats.map(s => s.netGrowth),
    backgroundColor: mStats.map(s => s.netGrowth >= 0 ? 'rgba(76,175,80,0.7)' : 'rgba(229,57,53,0.7)'),
    borderRadius: 4
  }]);

  const closeRates = hist.map(m => salesForMonth(m.start, m.end));
  makeBmChart('chart-close', 'line', labels, [{
    data: closeRates,
    borderColor: '#26a69a',
    backgroundColor: 'rgba(38,166,154,0.15)',
    fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#26a69a',
    spanGaps: true
  }], { max: 100 });

  renderCohortTable();
}
