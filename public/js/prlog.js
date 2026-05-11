let prAthleteId = null;

function getPrLog(id) {
  const all = sGet('pr_logs', {});
  return all[String(id)] || [];
}

function savePrLog(id, log) {
  const all = sGet('pr_logs', {});
  all[String(id)] = log;
  sSet('pr_logs', all);
}

function openPrModal(id) {
  prAthleteId = id;
  const a = athletes.find(x => x.id == id);
  document.getElementById('pr-modal-title').textContent = '📊 ' + a.name + ' — PR Log';
  document.getElementById('pr-block').value = '';
  document.getElementById('pr-squat').value = '';
  document.getElementById('pr-bench').value = '';
  document.getElementById('pr-dead').value = '';
  document.getElementById('pr-notes').value = '';
  renderPrHistory(id);
  document.getElementById('pr-modal').style.display = 'flex';
}

function closePrModal() {
  document.getElementById('pr-modal').style.display = 'none';
  prAthleteId = null;
}

function savePrEntry() {
  const block = document.getElementById('pr-block').value.trim();
  if (!block) { document.getElementById('pr-block').focus(); return; }
  const entry = {
    date: TODAY.toISOString().slice(0, 10),
    block,
    squat: document.getElementById('pr-squat').value || null,
    bench: document.getElementById('pr-bench').value || null,
    dead: document.getElementById('pr-dead').value || null,
    notes: document.getElementById('pr-notes').value.trim() || null,
  };
  const log = getPrLog(prAthleteId);
  log.unshift(entry);
  savePrLog(prAthleteId, log);
  document.getElementById('pr-block').value = '';
  document.getElementById('pr-squat').value = '';
  document.getElementById('pr-bench').value = '';
  document.getElementById('pr-dead').value = '';
  document.getElementById('pr-notes').value = '';
  renderPrHistory(prAthleteId);
}

let _pendingPrDelete = null;

function confirmDeletePrEntry(id, idx, block) {
  _pendingPrDelete = { id, idx };
  document.getElementById('pr-del-msg').textContent = 'Delete "' + block + '"?';
  document.getElementById('pr-del-overlay').style.display = 'flex';
}

function doPrDelete() {
  if (!_pendingPrDelete) return;
  deletePrEntry(_pendingPrDelete.id, _pendingPrDelete.idx);
  _pendingPrDelete = null;
  document.getElementById('pr-del-overlay').style.display = 'none';
}

function cancelPrDelete() {
  _pendingPrDelete = null;
  document.getElementById('pr-del-overlay').style.display = 'none';
}

function deletePrEntry(id, idx) {
  const log = getPrLog(id);
  log.splice(idx, 1);
  savePrLog(id, log);
  renderPrHistory(id);
}

function renderPrHistory(id) {
  const log = getPrLog(id);
  const el = document.getElementById('pr-history');
  if (!log.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text3)">No entries yet — add one above.</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin-bottom:10px">Past entries</div>' +
    log.map((e, i) =>
      '<div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:13px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
      '<div><div style="font-weight:600;color:var(--text)">' + e.block + '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + fmtDay(e.date) + '</div></div>' +
      '<button onclick="confirmDeletePrEntry(\'' + id + '\',' + i + ',\'' + e.block.replace(/'/g,"\\'") + '\')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:0;line-height:1">×</button>' +
      '</div>' +
      '<div style="display:flex;gap:16px;margin-top:8px">' +
      (e.squat ? '<div style="flex:1;min-width:0"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em">Squat</div><div style="font-weight:500;color:var(--text);font-size:12px">' + e.squat + '</div></div>' : '') +
      (e.bench ? '<div style="flex:1;min-width:0"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em">Bench</div><div style="font-weight:500;color:var(--text);font-size:12px">' + e.bench + '</div></div>' : '') +
      (e.dead  ? '<div style="flex:1;min-width:0"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em">Deadlift</div><div style="font-weight:500;color:var(--text);font-size:12px">' + e.dead + '</div></div>' : '') +
      '</div>' +
      (e.notes ? '<div style="margin-top:6px;font-size:12px;color:var(--text2)">' + e.notes + '</div>' : '') +
      '</div>'
    ).join('');
}
