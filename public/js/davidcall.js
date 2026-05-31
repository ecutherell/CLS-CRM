const DAVID_KEY = 'david_call_data';

function loadDavidData() {
  return sGet(DAVID_KEY, { pending: '', calls: [] });
}

function saveDavidData(data) {
  sSet(DAVID_KEY, data);
}

let _davidSaveTimer = null;
function saveDavidPending() {
  clearTimeout(_davidSaveTimer);
  _davidSaveTimer = setTimeout(() => {
    const el = document.getElementById('davidcall-pending');
    if (!el) return;
    const data = loadDavidData();
    data.pending = el.value;
    saveDavidData(data);
  }, 800);
}

function archiveDavidCall() {
  const el = document.getElementById('davidcall-pending');
  if (!el) return;
  const text = el.value.trim();
  if (!text) { alert('Nothing to archive — write your call notes first.'); return; }
  if (!confirm('Archive this call and start fresh for next week?')) return;
  const data = loadDavidData();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  data.calls = [{ date: today, notes: text }, ...(data.calls || [])];
  data.pending = '';
  saveDavidData(data);
  el.value = '';
  renderDavidCall();
}

function deleteDavidCall(index) {
  if (!confirm('Delete this past call entry?')) return;
  const data = loadDavidData();
  data.calls.splice(index, 1);
  saveDavidData(data);
  renderDavidCall();
}

function renderDavidCall() {
  const pendingEl  = document.getElementById('davidcall-pending');
  const historyEl  = document.getElementById('davidcall-history');
  const dateEl     = document.getElementById('davidcall-date');
  if (!pendingEl || !historyEl) return;

  const data = loadDavidData();

  // Fill current notes
  pendingEl.value = data.pending || '';

  // Date label
  if (dateEl) {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    dateEl.textContent = today;
  }

  // Past calls
  const calls = data.calls || [];
  if (!calls.length) {
    historyEl.innerHTML = '<div class="dash-empty">No past calls yet.</div>';
    return;
  }

  historyEl.innerHTML = calls.map((c, i) =>
    '<div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<span style="font-size:12px;font-weight:600;color:var(--accent)">' + c.date + '</span>' +
        '<button onclick="deleteDavidCall(' + i + ')" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);cursor:pointer">✕</button>' +
      '</div>' +
      '<div style="font-size:13px;color:var(--text2);white-space:pre-wrap;line-height:1.6">' + escHtml(c.notes) + '</div>' +
    '</div>'
  ).join('');
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
