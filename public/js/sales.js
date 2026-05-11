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
