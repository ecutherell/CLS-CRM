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
    },
    {
      name: '2026 ($200)',
      calls: 0, won: 0, lost: 0, pct: 0,
      sources: {}
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
    const empty = s.calls === 0;
    const c = empty ? 'var(--text3)' : pctColor(s.pct);
    const pctLabel = empty ? '—' : s.pct + '%';
    const callLabel = empty ? 'No calls yet' : s.calls + ' calls';
    return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;font-size:13px;color:var(--text2)">${s.name}</div>
      <div style="font-size:12px;color:var(--text3)">${callLabel}</div>
      <div style="font-size:13px;font-weight:700;color:${c};min-width:36px;text-align:right">${pctLabel}</div>
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
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:11px;color:var(--text3)">Synced ${syncDate}</div>
        <button class="action-btn" style="font-size:11px;padding:4px 10px;border-radius:6px" onclick="openSheetsSyncModal()">↻ Sync</button>
      </div>
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

function openSheetsSyncModal() {
  const data = sGet(SHEETS_DATA_KEY, SHEETS_DEFAULT_DATA);
  const container = document.getElementById('sheets-sync-tiers');
  if (!container) return;
  container.innerHTML = (data.sheets || []).map((s, i) => `
    <div style="background:var(--surface2);border-radius:8px;padding:12px 14px">
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:10px">${s.name}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Total Calls</div>
          <input type="number" class="log-input" id="sync-calls-${i}" value="${s.calls}" min="0" style="width:100%;box-sizing:border-box"/>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Won</div>
          <input type="number" class="log-input" id="sync-won-${i}" value="${s.won}" min="0" style="width:100%;box-sizing:border-box"/>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lost</div>
          <input type="number" class="log-input" id="sync-lost-${i}" value="${s.lost}" min="0" style="width:100%;box-sizing:border-box"/>
        </div>
      </div>
    </div>
  `).join('');
  document.getElementById('sheets-sync-overlay').style.display = 'flex';
}

function closeSheetsSyncModal() {
  document.getElementById('sheets-sync-overlay').style.display = 'none';
}

async function saveSheetsSyncData() {
  const data = sGet(SHEETS_DATA_KEY, SHEETS_DEFAULT_DATA);
  const updated = { ...data, lastSync: new Date().toISOString().slice(0, 10) };
  updated.sheets = (data.sheets || []).map((s, i) => {
    const calls = parseInt(document.getElementById('sync-calls-' + i)?.value) || 0;
    const won   = parseInt(document.getElementById('sync-won-'   + i)?.value) || 0;
    const lost  = parseInt(document.getElementById('sync-lost-'  + i)?.value) || 0;
    const pct   = calls > 0 ? Math.round(won / calls * 100) : 0;
    return { ...s, calls, won, lost, pct };
  });
  await sSet(SHEETS_DATA_KEY, updated);
  closeSheetsSyncModal();
  renderSheetsMetrics();
}

function renderSalesPage() {
  // Seed/refresh sheets data — bump version to pick up new price tiers
  const existingData = sGet(SHEETS_DATA_KEY, null);
  if (!existingData || existingData.lastSync !== SHEETS_DEFAULT_DATA.lastSync || (existingData.sheets || []).length < SHEETS_DEFAULT_DATA.sheets.length) {
    sSet(SHEETS_DATA_KEY, SHEETS_DEFAULT_DATA);
  }
  if (!sGet(SHEETS_URL_KEY, '')) sSet(SHEETS_URL_KEY, SHEETS_DEFAULT_DATA.url);
  renderSheetsMetrics();
}
