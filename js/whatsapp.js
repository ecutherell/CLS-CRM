let _waNotesTimer = null;

function toggleWhatsapp(id) {
  const a = athletes.find(x => String(x.id) === String(id));
  if (!a) return;
  updateAthlete(a.id, { on_whatsapp: !a.on_whatsapp });
}

function debounceWaNotes() {
  clearTimeout(_waNotesTimer);
  _waNotesTimer = setTimeout(saveWaNotes, 600);
}

function saveWaNotes() {
  const ta = document.getElementById('wa-notes-textarea');
  if (!ta) return;
  sSet('whatsapp_notes', ta.value);
  const lbl = document.getElementById('wa-notes-saved');
  if (lbl) { lbl.textContent = 'Saved'; setTimeout(() => { if (lbl) lbl.textContent = ''; }, 1500); }
}

function renderWhatsapp() {
  const active = athletes.filter(a => a.is_active);
  const onWa   = active.filter(a => a.on_whatsapp);
  const notWa  = active.filter(a => !a.on_whatsapp);
  const pct    = active.length ? Math.round(onWa.length / active.length * 100) : 0;

  document.getElementById('wa-stats').innerHTML =
    '<div class="stat"><div class="stat-label">On WhatsApp</div><div class="stat-val green">' + onWa.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Not yet</div><div class="stat-val red">' + notWa.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Progress</div><div class="stat-val amber">' + pct + '%</div></div>' +
    '<div class="stat"><div class="stat-label">Total active</div><div class="stat-val">' + active.length + '</div></div>';

  const sorted = [...notWa, ...onWa];
  const rosterEl = document.getElementById('wa-roster');
  if (!active.length) {
    rosterEl.innerHTML = '<div class="dash-empty">No active athletes.</div>';
  } else {
    rosterEl.innerHTML = sorted.map(a => {
      const done = !!a.on_whatsapp;
      return '<div class="shirt-row">' +
        '<div class="name-wrap" style="flex:1"><div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
        '<div class="athlete-name">' + a.name + '</div></div>' +
        '<button onclick="toggleWhatsapp(\'' + a.id + '\')" style="' +
          'padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;' +
          (done
            ? 'background:rgba(76,175,80,0.15);color:var(--green-text);border:1px solid var(--green-text)'
            : 'background:var(--surface2);color:var(--text3);border:1px dashed var(--border2)') +
          '">' + (done ? '✓ On WhatsApp' : '+ Move to WA') + '</button>' +
        '</div>';
    }).join('');
  }

  // Progress bar
  const barEl = document.getElementById('wa-progress-bar');
  if (barEl) {
    barEl.style.width = pct + '%';
    barEl.style.background = pct === 100 ? 'var(--green-text)' : pct >= 50 ? '#ffc107' : '#ff7043';
  }

  // Notes
  const notesEl = document.getElementById('wa-notes');
  const saved = sGet('whatsapp_notes', '');
  notesEl.innerHTML =
    '<textarea id="wa-notes-textarea" placeholder="Notes about the WhatsApp migration…" ' +
    'style="width:100%;min-height:100px;padding:10px;border-radius:var(--radius-sm);border:1px solid var(--border2);' +
    'background:var(--surface2);color:var(--text);font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box">' +
    String(saved).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</textarea>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
    '<button onclick="saveWaNotes()" style="padding:5px 14px;border-radius:var(--radius-sm);border:none;background:var(--accent);color:#fff;font-size:12px;cursor:pointer">Save</button>' +
    '<span style="font-size:11px;color:var(--text3)" id="wa-notes-saved"></span>' +
    '</div>';
  const ta = document.getElementById('wa-notes-textarea');
  if (ta) ta.addEventListener('input', debounceWaNotes);
}
