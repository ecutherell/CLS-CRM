const SHEETS_URL_KEY = 'sheets_sales_url';
const SHEETS_DATA_KEY = 'sheets_sales_data';

// Pre-populated from last sheet read (Nov 11 2026)
const SHEETS_DEFAULT_DATA = {
  lastSync: '2026-11-11',
  url: 'https://docs.google.com/spreadsheets/d/1IXJxUiQjjjDZ0az6T9ARzhY4_1Ul2DBwTjmFfARNpN4/edit',
  sheets: [
    {
      name: '2025 ($150)',
      calls: 50, won: 29, lost: 21, pct: 58,
      sources: { 'Local': { calls: 14, won: 8 }, 'Instagram': { calls: 12, won: 6 }, 'Referral': { calls: 10, won: 7 }, 'Meet Day': { calls: 7, won: 5 }, 'Other': { calls: 7, won: 3 } }
    },
    {
      name: '2026 ($165)',
      calls: 17, won: 15, lost: 2, pct: 88,
      sources: { 'Local': { calls: 4, won: 3 }, 'Referral': { calls: 4, won: 4 }, 'Instagram': { calls: 3, won: 2 }, 'Instagram/Podcast': { calls: 1, won: 1 }, 'Returning': { calls: 2, won: 2 }, 'Other': { calls: 3, won: 3 } }
    }
  ]
};

function editSheetsUrl() {
  const url = sGet(SHEETS_URL_KEY, '');
  document.getElementById('sheets-url-input').value = url;
  document.getElementById('sheets-url-overlay').style.display = 'flex';
}
function closeSheetsUrlModal() {
  document.getElementById('sheets-url-overlay').style.display = 'none';
}
async function saveSheetsUrl() {
  const url = document.getElementById('sheets-url-input').value.trim();
  await sSet(SHEETS_URL_KEY, url);
  closeSheetsUrlModal();
  renderSheetsMetrics();
}

function renderSheetsMetrics() {
  const url = sGet(SHEETS_URL_KEY, '');
  const data = sGet(SHEETS_DATA_KEY, SHEETS_DEFAULT_DATA);

  const banner = document.getElementById('sheets-banner');
  const noUrl  = document.getElementById('sheets-no-url');
  const card   = document.getElementById('sheets-metrics-card');

  if (!banner || !noUrl || !card) return;

  const effectiveUrl = url || (data && data.url) || '';
  if (effectiveUrl) {
    banner.style.display = 'flex';
    noUrl.style.display = 'none';
    document.getElementById('sheets-link-anchor').href = effectiveUrl;
  } else {
    banner.style.display = 'none';
    noUrl.style.display = 'flex';
  }

  if (!data || !data.sheets) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const totalCalls = data.sheets.reduce((n, s) => n + s.calls, 0);
  const totalWon   = data.sheets.reduce((n, s) => n + s.won, 0);
  const totalLost  = data.sheets.reduce((n, s) => n + s.lost, 0);
  const allPct     = totalCalls > 0 ? Math.round(totalWon / totalCalls * 100) : 0;

  // Source rollup across all sheets
  const srcMap = {};
  for (const sh of data.sheets) {
    if (!sh.sources) continue;
    for (const [src, v] of Object.entries(sh.sources)) {
      if (!srcMap[src]) srcMap[src] = { calls: 0, won: 0 };
      srcMap[src].calls += v.calls;
      srcMap[src].won   += v.won;
    }
  }
  const srcList = Object.entries(srcMap)
    .map(([src, v]) => ({ src, calls: v.calls, won: v.won, pct: v.calls > 0 ? Math.round(v.won / v.calls * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const pctColor = p => p >= 50 ? 'var(--green-text)' : p >= 30 ? 'var(--amber-text)' : 'var(--red-text)';

  const sheetRows = data.sheets.map(s => {
    const c = pctColor(s.pct);
    return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;font-size:13px;color:var(--text2)">${s.name}</div>
      <div style="font-size:12px;color:var(--text3)">${s.calls} calls</div>
      <div style="font-size:13px;font-weight:700;color:${c};min-width:36px;text-align:right">${s.pct}%</div>
    </div>`;
  }).join('');

  const maxSrcCalls = Math.max(...srcList.map(s => s.calls), 1);
  const srcRows = srcList.map(s => {
    const barW = Math.round(s.calls / maxSrcCalls * 100);
    const c = pctColor(s.pct);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <div style="width:110px;font-size:12px;color:var(--text2);flex-shrink:0">${s.src}</div>
      <div style="flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">
        <div style="width:${barW}%;height:100%;background:${c};border-radius:3px;transition:width 0.3s"></div>
      </div>
      <div style="font-size:12px;font-weight:600;color:${c};min-width:34px;text-align:right">${s.pct}%</div>
      <div style="font-size:11px;color:var(--text3);min-width:40px;text-align:right">${s.calls} calls</div>
    </div>`;
  }).join('');

  const syncDate = data.lastSync ? new Date(data.lastSync + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  document.getElementById('sheets-metrics-content').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="margin:0;font-size:14px;font-weight:600;color:var(--text)">Sheets: All-Time Performance</h3>
      <div style="font-size:11px;color:var(--text3)">Synced ${syncDate}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--text)">${totalCalls}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Total calls</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--green-text)">${totalWon}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Won</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:${pctColor(allPct)}">${allPct}%</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Close rate</div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:var(--text3);margin-bottom:8px">By Year / Price</div>
    ${sheetRows}
    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:var(--text3);margin:14px 0 10px">Source Conversion</div>
    ${srcRows}
    <div style="font-size:10px;color:var(--text3);margin-top:10px;text-align:right">Hormozi benchmark: 30–40% healthy long-term · Source split is estimated</div>
  `;
}

async function loadSalesLog() {
  if (!sb) {
    try { salesLog = JSON.parse(localStorage.getItem('sales_log') || '[]'); }
    catch { salesLog = []; }
    return;
  }

  // One-time migration from localStorage → Supabase
  if (!localStorage.getItem('sales_migrated')) {
    const local = JSON.parse(localStorage.getItem('sales_log') || '[]');
    if (local.length) {
      const rows = local.map(e => ({ date: e.date, calls: e.calls, closes: e.closes }));
      await sb.from('sales_log').insert(rows);
    }
    localStorage.setItem('sales_migrated', '1');
  }

  const { data, error } = await sb.from('sales_log').select('*').order('date', { ascending: false });
  if (error) { console.error(error); return; }
  salesLog = data || [];
}

async function addSalesEntry() {
  const date = document.getElementById('log-date').value;
  const calls = parseInt(document.getElementById('log-calls').value) || 0;
  const closes = parseInt(document.getElementById('log-closes').value) || 0;
  if (!date || calls < 0) { alert('Enter a date and number of calls.'); return; }
  if (closes > calls) { alert("Closes can't exceed calls."); return; }

  if (sb) {
    const { data, error } = await sb.from('sales_log').insert({ date, calls, closes }).select().single();
    if (error) { alert('Error: ' + error.message); return; }
    salesLog.unshift(data);
  } else {
    salesLog.unshift({ id: Date.now(), date, calls, closes });
    localStorage.setItem('sales_log', JSON.stringify(salesLog));
  }

  document.getElementById('log-calls').value = '';
  document.getElementById('log-closes').value = '';
  renderSalesPage();
  renderDashboard();
}

async function deleteSalesEntry(id) {
  salesLog = salesLog.filter(e => e.id !== id);
  renderSalesPage();
  renderDashboard();
  if (sb) await sb.from('sales_log').delete().eq('id', id);
  else localStorage.setItem('sales_log', JSON.stringify(salesLog));
}

function salesThisMonth() {
  const now = new Date();
  return salesLog.filter(e => {
    const d = new Date(e.date + 'T12:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function renderSalesPage() {
  // Seed default sheets data + URL on first load
  if (!sGet(SHEETS_DATA_KEY, null)) sSet(SHEETS_DATA_KEY, SHEETS_DEFAULT_DATA);
  if (!sGet(SHEETS_URL_KEY, ''))    sSet(SHEETS_URL_KEY, SHEETS_DEFAULT_DATA.url);
  renderSheetsMetrics();

  const all = salesLog;
  const totalCalls = all.reduce((n, e) => n + e.calls, 0);
  const totalCloses = all.reduce((n, e) => n + e.closes, 0);
  const sm = salesThisMonth();
  const mCalls = sm.reduce((n, e) => n + e.calls, 0);
  const mCloses = sm.reduce((n, e) => n + e.closes, 0);
  const convAll = totalCalls > 0 ? Math.round(totalCloses / totalCalls * 100) : 0;
  const convMonth = mCalls > 0 ? Math.round(mCloses / mCalls * 100) : 0;

  document.getElementById('sales-stats').innerHTML =
    '<div class="sales-stat"><div class="sales-stat-label">Total calls</div><div class="sales-stat-val">' + totalCalls + '</div><div class="sales-stat-sub">All time</div></div>' +
    '<div class="sales-stat"><div class="sales-stat-label">Total closes</div><div class="sales-stat-val" style="color:var(--green-text)">' + totalCloses + '</div><div class="sales-stat-sub">All time</div></div>' +
    '<div class="sales-stat"><div class="sales-stat-label">Calls this month</div><div class="sales-stat-val">' + mCalls + '</div><div class="sales-stat-sub">' + MONTHS[new Date().getMonth()] + '</div></div>' +
    '<div class="sales-stat"><div class="sales-stat-label">Closes this month</div><div class="sales-stat-val" style="color:var(--green-text)">' + mCloses + '</div><div class="sales-stat-sub">' + MONTHS[new Date().getMonth()] + '</div></div>';

  const circ = 226;
  document.getElementById('conv-arc').style.strokeDashoffset = Math.max(0, circ - (circ * (convAll / 100)));
  document.getElementById('conv-arc').style.stroke = convAll >= 30 ? 'var(--green-text)' : convAll >= 15 ? 'var(--amber-text)' : 'var(--red-text)';
  document.getElementById('conv-pct').textContent = convAll + '%';
  document.getElementById('conv-detail').innerHTML = totalCalls > 0
    ? '<strong>' + totalCloses + '</strong> closes<br><strong>' + totalCalls + '</strong> total calls<br><strong style="color:' + (convMonth >= 30 ? 'var(--green-text)' : convMonth >= 15 ? 'var(--amber-text)' : 'var(--red-text)') + '">' + convMonth + '%</strong> this month'
    : '<span style="color:var(--text3)">Log entries to see your rate.</span>';

  // Payment notes
  const withNotes = athletes.filter(a => a.is_active && a.payment_note);
  const pnEl = document.getElementById('payment-notes-list');
  if (pnEl) {
    pnEl.innerHTML = withNotes.length ? withNotes.map(a => {
      const nextDue = a.next_payment_date ? '<div style="font-size:11px;color:var(--amber-text);margin-top:2px">Next payment: ' + fmtDay(a.next_payment_date) + '</div>' : '';
      return '<div class="shirt-row" style="flex-direction:column;align-items:flex-start;gap:2px;cursor:pointer" onclick="openModal(\'' + a.id + '\')">' +
        '<div style="display:flex;align-items:center;gap:8px;width:100%">' +
        '<div class="avatar" style="' + avStyle(a.id) + ';width:26px;height:26px;font-size:10px;flex-shrink:0">' + ini(a.name) + '</div>' +
        '<div class="athlete-name" style="font-size:13px">' + a.name + '</div></div>' +
        '<div style="font-size:12px;color:var(--text2);margin-top:4px;padding-left:34px">' + a.payment_note + '</div>' + nextDue + '</div>';
    }).join('') : '<div class="dash-empty" style="font-size:13px">No payment notes — most clients are on standard subscription.</div>';
  }

  // Hot leads
  const hlEl = document.getElementById('hot-leads-list');
  if (hlEl) {
    hlEl.innerHTML = hotLeads.length ? hotLeads.map(l =>
      '<div class="shirt-row" style="flex-direction:column;align-items:flex-start;gap:3px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;width:100%">' +
      '<div style="font-weight:600;font-size:13px">🔥 ' + l.name + '</div>' +
      '<div style="display:flex;gap:6px">' +
      '<button class="save-btn" style="font-size:11px;padding:3px 9px" onclick="convertLead(' + l.id + ')" title="Signed!">✓ Signed</button>' +
      '<button class="action-btn" onclick="deleteHotLead(' + l.id + ')" title="Remove">✕</button></div></div>' +
      (l.contact ? '<div style="font-size:11px;color:var(--blue-text)">📱 ' + l.contact + '</div>' : '') +
      (l.notes ? '<div style="font-size:11px;color:var(--text2)">' + l.notes + '</div>' : '') +
      '</div>'
    ).join('') : '<div class="dash-empty" style="font-size:13px">No hot leads yet.</div>';
  }

  const log = document.getElementById('sales-log');
  if (!all.length) {
    log.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:1rem 0">No entries yet. Log your first call session above.</div>';
    return;
  }
  log.innerHTML = all.map(e => {
    const rate = e.calls > 0 ? Math.round(e.closes / e.calls * 100) : 0;
    const rc = rate >= 30 ? '' : rate >= 15 ? ' mid' : ' low';
    const d = new Date(e.date + 'T12:00:00');
    return '<div class="log-item">' +
      '<span class="log-item-date">' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</span>' +
      '<span>' + e.calls + ' calls</span>' +
      '<span class="log-item-closes">' + e.closes + ' closed</span>' +
      '<span class="log-item-rate' + rc + '">' + rate + '%</span>' +
      '<button class="log-del" onclick="deleteSalesEntry(' + e.id + ')">✕</button></div>';
  }).join('');
}
