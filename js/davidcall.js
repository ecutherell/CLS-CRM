const DAVID_KEY = 'david_call_data';

function loadDavidData() {
  return sGet(DAVID_KEY, { pending: '', calls: [], deleted: [] });
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

// Soft delete — moves to trash
function deleteDavidCall(index) {
  const data = loadDavidData();
  const removed = data.calls.splice(index, 1)[0];
  data.deleted = [removed, ...(data.deleted || [])];
  saveDavidData(data);
  renderDavidCall();
}

// Save edited call
function saveDavidCallEdit(index) {
  const el = document.getElementById('davidcall-edit-' + index);
  if (!el) return;
  const data = loadDavidData();
  data.calls[index].notes = el.value;
  saveDavidData(data);
  renderDavidCall();
}

// Restore from trash back to past calls
function restoreDavidCall(index) {
  const data = loadDavidData();
  const restored = data.deleted.splice(index, 1)[0];
  data.calls = [restored, ...(data.calls || [])];
  saveDavidData(data);
  renderDavidCall();
}

// Permanently delete from trash
function permanentlyDeleteDavidCall(index) {
  if (!confirm('Permanently delete this call? This cannot be undone.')) return;
  const data = loadDavidData();
  data.deleted.splice(index, 1);
  saveDavidData(data);
  renderDavidCall();
}

function renderDavidCall() {
  const pendingEl = document.getElementById('davidcall-pending');
  const historyEl = document.getElementById('davidcall-history');
  const dateEl    = document.getElementById('davidcall-date');
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
  const deleted = data.deleted || [];

  const editing = window._davidEditIndex;
  let html = '';

  if (!calls.length) {
    html += '<div class="dash-empty">No past calls yet.</div>';
  } else {
    html += calls.map((c, i) => {
      const isEditing = editing === i;
      return '<div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
          '<span style="font-size:12px;font-weight:600;color:var(--accent)">' + c.date + '</span>' +
          '<div style="display:flex;gap:6px">' +
            (isEditing
              ? '<button onclick="saveDavidCallEdit(' + i + ');window._davidEditIndex=null;" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer">✓ Save</button>' +
                '<button onclick="window._davidEditIndex=null;renderDavidCall();" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);cursor:pointer">Cancel</button>'
              : '<button onclick="window._davidEditIndex=' + i + ';renderDavidCall();" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);cursor:pointer">✏ Edit</button>') +
            '<button onclick="deleteDavidCall(' + i + ')" title="Move to trash" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);cursor:pointer">🗑</button>' +
          '</div>' +
        '</div>' +
        (isEditing
          ? '<textarea id="davidcall-edit-' + i + '" style="width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:8px 10px;font-size:13px;color:var(--text1);resize:vertical;font-family:inherit;line-height:1.6;min-height:120px" rows="6">' + escHtml(c.notes) + '</textarea>'
          : '<div style="font-size:13px;color:var(--text2);white-space:pre-wrap;line-height:1.6">' + escHtml(c.notes) + '</div>') +
      '</div>';
    }).join('');
  }

  // Trash section
  if (deleted.length) {
    html += '<div style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px">' +
      '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin-bottom:10px">🗑 Trash (' + deleted.length + ')</div>' +
      deleted.map((c, i) =>
        '<div style="border:1px solid var(--border2);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:8px;opacity:0.6">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
            '<span style="font-size:12px;font-weight:600;color:var(--text3)">' + c.date + '</span>' +
            '<div style="display:flex;gap:6px">' +
              '<button onclick="restoreDavidCall(' + i + ')" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--accent);cursor:pointer">↩ Restore</button>' +
              '<button onclick="permanentlyDeleteDavidCall(' + i + ')" style="font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--border2);background:none;color:#e55353;cursor:pointer">✕ Delete forever</button>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--text3);white-space:pre-wrap;line-height:1.5;max-height:60px;overflow:hidden">' + escHtml(c.notes) + '</div>' +
        '</div>'
      ).join('') +
    '</div>';
  }

  historyEl.innerHTML = html;
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
