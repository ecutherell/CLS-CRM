let prAthleteId = null;
const _prToggles = { squat: null, bench: null, dead: null };
let _prLogsCache = {}; // String(athlete_id) → array of entries (newest first)

// ── Data layer — Supabase backed ────────────────────────────

async function loadPrLogs() {
  if (!sb) {
    // No Supabase — pull from server-storage fallback
    const stored = sGet('pr_logs', {});
    _prLogsCache = {};
    Object.entries(stored).forEach(([aid, entries]) => {
      // Ensure each entry has an id for deletion
      _prLogsCache[aid] = entries.map((e, i) => e.id ? e : { ...e, id: 'local-' + aid + '-' + i });
    });
    return;
  }
  try {
    const { data, error } = await sb.from('pr_logs').select('*').order('date', { ascending: false });
    if (error) { console.warn('loadPrLogs error:', error.message); return; }
    _prLogsCache = {};
    (data || []).forEach(row => {
      const key = String(row.athlete_id);
      if (!_prLogsCache[key]) _prLogsCache[key] = [];
      _prLogsCache[key].push(row);
    });
  } catch (e) { console.warn('loadPrLogs exception:', e); }
}

function getPrLog(id) {
  return _prLogsCache[String(id)] || [];
}

async function _insertPrEntry(athleteId, entry) {
  if (!sb) {
    const key = String(athleteId);
    const newEntry = { ...entry, id: 'local-' + Date.now() };
    _prLogsCache[key] = [newEntry, ...(_prLogsCache[key] || [])];
    // Also persist to server-storage fallback
    const all = sGet('pr_logs', {});
    all[key] = _prLogsCache[key];
    sSet('pr_logs', all);
    return newEntry;
  }
  const row = {
    athlete_id: athleteId,
    block:      entry.block,
    date:       entry.date,
    squat_pr:   entry.squat_pr,
    bench_pr:   entry.bench_pr,
    dead_pr:    entry.dead_pr,
    squat:      entry.squat ? parseFloat(entry.squat) : null,
    bench:      entry.bench ? parseFloat(entry.bench) : null,
    dead:       entry.dead  ? parseFloat(entry.dead)  : null,
    notes:      entry.notes || null,
  };
  const { data, error } = await sb.from('pr_logs').insert(row).select().single();
  if (error) { alert('Save failed: ' + error.message); return null; }
  const key = String(athleteId);
  _prLogsCache[key] = [data, ...(_prLogsCache[key] || [])];
  return data;
}

async function _deletePrEntryById(athleteId, entryId) {
  const key = String(athleteId);
  _prLogsCache[key] = (_prLogsCache[key] || []).filter(e => String(e.id) !== String(entryId));
  if (!sb) {
    const all = sGet('pr_logs', {});
    all[key] = _prLogsCache[key];
    sSet('pr_logs', all);
    return;
  }
  const { error } = await sb.from('pr_logs').delete().eq('id', entryId);
  if (error) console.warn('Delete PR entry error:', error.message);
}

// ── Toggle UI ───────────────────────────────────────────────

function setPrToggle(lift, val) {
  _prToggles[lift] = val; // 'yes' | 'no' | null
  const yes = document.getElementById('pr-' + lift + '-yes');
  const no  = document.getElementById('pr-' + lift + '-no');
  if (!yes || !no) return;
  [yes, no].forEach(b => {
    b.style.background   = 'var(--surface2)';
    b.style.color        = 'var(--text3)';
    b.style.borderColor  = 'var(--border2)';
    b.style.fontWeight   = '';
  });
  if (val === 'yes') {
    yes.style.background  = 'rgba(76,175,80,0.15)';
    yes.style.color       = 'var(--green-text,#16a34a)';
    yes.style.borderColor = 'rgba(76,175,80,0.4)';
    yes.style.fontWeight  = '700';
  } else if (val === 'no') {
    no.style.background   = 'rgba(229,57,53,0.12)';
    no.style.color        = 'var(--red-text,#e53935)';
    no.style.borderColor  = 'rgba(229,57,53,0.3)';
    no.style.fontWeight   = '700';
  }
}

function resetPrToggles() {
  ['squat', 'bench', 'dead'].forEach(lift => {
    _prToggles[lift] = null;
    const yes = document.getElementById('pr-' + lift + '-yes');
    const no  = document.getElementById('pr-' + lift + '-no');
    if (yes) { yes.style.background = 'var(--surface2)'; yes.style.color = 'var(--text3)'; yes.style.borderColor = 'var(--border2)'; yes.style.fontWeight = ''; }
    if (no)  { no.style.background  = 'var(--surface2)'; no.style.color  = 'var(--text3)'; no.style.borderColor  = 'var(--border2)'; no.style.fontWeight  = ''; }
  });
}

// ── Modal open / close ──────────────────────────────────────

function openPrModal(id) {
  prAthleteId = id;
  const a = athletes.find(x => x.id == id);
  document.getElementById('pr-modal-title').textContent = '📊 ' + a.name + ' — PR Log';
  document.getElementById('pr-block').value = '';
  document.getElementById('pr-squat').value = '';
  document.getElementById('pr-bench').value = '';
  document.getElementById('pr-dead').value  = '';
  document.getElementById('pr-notes').value = '';
  resetPrToggles();
  renderPrHistory(id);
  document.getElementById('pr-modal').style.display = 'flex';
}

function closePrModal() {
  document.getElementById('pr-modal').style.display = 'none';
  prAthleteId = null;
}

// ── Save entry ──────────────────────────────────────────────

async function savePrEntry() {
  const block = document.getElementById('pr-block').value.trim();
  if (!block) { document.getElementById('pr-block').focus(); return; }

  const entry = {
    date:     TODAY.toISOString().slice(0, 10),
    block,
    squat_pr: _prToggles.squat === 'yes' ? true : _prToggles.squat === 'no' ? false : null,
    bench_pr: _prToggles.bench === 'yes' ? true : _prToggles.bench === 'no' ? false : null,
    dead_pr:  _prToggles.dead  === 'yes' ? true : _prToggles.dead  === 'no' ? false : null,
    squat:    document.getElementById('pr-squat').value || null,
    bench:    document.getElementById('pr-bench').value || null,
    dead:     document.getElementById('pr-dead').value  || null,
    notes:    document.getElementById('pr-notes').value.trim() || null,
  };

  // Disable save button while inserting
  const saveBtn = document.querySelector('#pr-modal .save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  await _insertPrEntry(prAthleteId, entry);

  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save entry'; }

  document.getElementById('pr-block').value = '';
  document.getElementById('pr-squat').value = '';
  document.getElementById('pr-bench').value = '';
  document.getElementById('pr-dead').value  = '';
  document.getElementById('pr-notes').value = '';
  resetPrToggles();
  renderPrHistory(prAthleteId);
  // Also refresh the mini strip inside the athlete modal if it's open
  renderPrInModal(prAthleteId);
}

// ── Delete ──────────────────────────────────────────────────

let _pendingPrDelete = null;

function confirmDeletePrEntry(athleteId, entryId, block) {
  _pendingPrDelete = { athleteId, entryId };
  document.getElementById('pr-del-msg').textContent = 'Delete "' + block + '"?';
  document.getElementById('pr-del-overlay').style.display = 'flex';
}

async function doPrDelete() {
  if (!_pendingPrDelete) return;
  const { athleteId, entryId } = _pendingPrDelete;
  _pendingPrDelete = null;
  document.getElementById('pr-del-overlay').style.display = 'none';
  await _deletePrEntryById(athleteId, entryId);
  renderPrHistory(athleteId);
  renderPrInModal(athleteId);
}

function cancelPrDelete() {
  _pendingPrDelete = null;
  document.getElementById('pr-del-overlay').style.display = 'none';
}

// ── Render helpers ──────────────────────────────────────────

function prDot(val) {
  if (val === true)  return '<span style="font-size:16px">✅</span>';
  if (val === false) return '<span style="font-size:16px">❌</span>';
  return '<span style="font-size:16px;color:var(--text3)">—</span>';
}

// ── Full PR history (inside the PR modal) ───────────────────

function renderPrHistory(id) {
  const log = getPrLog(id);
  const el = document.getElementById('pr-history');
  if (!el) return;
  if (!log.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text3)">No entries yet — add one above.</div>';
    return;
  }
  el.innerHTML =
    '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin-bottom:10px">Past entries</div>' +
    log.map(e => {
      const allPr   = e.squat_pr && e.bench_pr && e.dead_pr;
      const nonePr  = e.squat_pr === false && e.bench_pr === false && e.dead_pr === false;
      const bgColor = allPr ? 'rgba(76,175,80,0.07)' : nonePr ? 'rgba(229,57,53,0.07)' : 'transparent';
      const weight  = lift => e[lift] ? '<span style="font-size:11px;color:var(--text3);margin-left:4px">@ ' + e[lift] + 'lbs</span>' : '';
      const safeBlock = String(e.block).replace(/'/g, "\\'");
      return '<div style="padding:10px;border-bottom:1px solid var(--border);border-radius:6px;background:' + bgColor + ';margin-bottom:2px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div><div style="font-weight:600;color:var(--text);font-size:13px">' + e.block + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + fmtDay(e.date) + '</div></div>' +
          '<button onclick="confirmDeletePrEntry(\'' + id + '\',\'' + e.id + '\',\'' + safeBlock + '\')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:0">×</button>' +
        '</div>' +
        '<div style="display:flex;gap:16px;margin-top:8px">' +
          '<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">Squat</div>' + prDot(e.squat_pr) + weight('squat') + '</div>' +
          '<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">Bench</div>' + prDot(e.bench_pr) + weight('bench') + '</div>' +
          '<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">Deadlift</div>' + prDot(e.dead_pr) + weight('dead') + '</div>' +
        '</div>' +
        (e.notes ? '<div style="margin-top:6px;font-size:12px;color:var(--text2)">' + e.notes + '</div>' : '') +
      '</div>';
    }).join('');
}

// ── Inline PR dots for the athletes table ───────────────────
// Shows last 5 blocks as small colored dots (oldest → newest, left → right)
// Click opens the PR modal for that athlete

function prBlockDots(id) {
  const log = getPrLog(id);
  if (!log.length) {
    return '<button onclick="openPrModal(\'' + id + '\')" title="Log first PR block" ' +
      'style="background:none;border:1px dashed var(--border2);border-radius:5px;color:var(--text3);font-size:10px;padding:2px 7px;cursor:pointer;line-height:1.6">+ PR</button>';
  }

  // Log is newest-first; show up to 5, display oldest→newest (left→right)
  const recent = log.slice(0, 5).reverse();

  const dots = recent.map(e => {
    const allPr  = e.squat_pr === true  && e.bench_pr === true  && e.dead_pr === true;
    const nonePr = e.squat_pr === false && e.bench_pr === false && e.dead_pr === false;
    const hasAny = [e.squat_pr, e.bench_pr, e.dead_pr].some(v => v !== null && v !== undefined);
    const bg = allPr  ? '#4caf50'
             : nonePr ? '#e53935'
             : hasAny ? '#ffc107'
             :          'var(--border2)';
    const tip = e.block + ': ' +
      (e.squat_pr === true ? '✅' : e.squat_pr === false ? '❌' : '—') + 'S ' +
      (e.bench_pr === true ? '✅' : e.bench_pr === false ? '❌' : '—') + 'B ' +
      (e.dead_pr  === true ? '✅' : e.dead_pr  === false ? '❌' : '—') + 'D';
    return '<div title="' + tip + '" style="width:10px;height:10px;border-radius:3px;background:' + bg + ';flex-shrink:0"></div>';
  }).join('');

  return '<div onclick="openPrModal(\'' + id + '\')" title="Click to log / view PR history" ' +
    'style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;padding:3px 5px;border-radius:6px;' +
    'border:1px solid var(--border2);background:var(--surface2)">' +
    dots + '</div>';
}

// ── Mini PR strip inside athlete modal ──────────────────────

function renderPrInModal(id) {
  const el = document.getElementById('modal-pr-mini');
  if (!el) return;
  const log = getPrLog(id);

  if (!log.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">No PR blocks logged yet.</div>';
    return;
  }

  // Show up to 6 most recent blocks
  const recent = log.slice(0, 6);
  const miniDot = val => {
    if (val === true)  return '<span style="font-size:13px">✅</span>';
    if (val === false) return '<span style="font-size:13px">❌</span>';
    return '<span style="font-size:13px;color:var(--text3)">—</span>';
  };

  el.innerHTML = recent.map(e => {
    const isAllPr  = e.squat_pr === true  && e.bench_pr === true  && e.dead_pr === true;
    const isNonePr = e.squat_pr === false && e.bench_pr === false && e.dead_pr === false;
    const rowBg    = isAllPr ? 'rgba(76,175,80,0.08)' : isNonePr ? 'rgba(229,57,53,0.08)' : 'transparent';
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:7px;background:' + rowBg + ';border:1px solid var(--border);margin-bottom:4px">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + e.block + '</div>' +
        '<div style="font-size:10px;color:var(--text3)">' + fmtDay(e.date) + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:4px;align-items:center">' +
        miniDot(e.squat_pr) + miniDot(e.bench_pr) + miniDot(e.dead_pr) +
      '</div>' +
    '</div>';
  }).join('') +
  (log.length > 6 ? '<div style="font-size:11px;color:var(--text3);margin-top:4px;text-align:center">+ ' + (log.length - 6) + ' more — click "Full history" to see all</div>' : '');
}
