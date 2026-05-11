async function loadAthletes() {
  if (!sb) return;
  const { data, error } = await sb.from('athletes').select('*').order('name');
  if (error) { setSS('err'); return; }
  athletes = data.map(a => ({ ...a, meets: a.meets || [], is_active: a.is_active !== false }));
}

async function addAthlete(name, program, start) {
  const row = { name, program, due_date: null, notes: '', meets: [], start_date: start || null, end_date: null, churn_reason: null, is_active: true };
  if (sb) {
    const { data, error } = await sb.from('athletes').insert(row).select().single();
    if (error) { alert('Error: ' + error.message); return; }
    athletes.push(data);
  } else {
    athletes.push({ ...row, id: 'local-' + Date.now() });
  }
  renderAll();
}

async function updateAthlete(id, fields) {
  athletes = athletes.map(a => a.id === id ? { ...a, ...fields } : a);
  renderAll();
  if (sb) {
    const { error } = await sb.from('athletes').update(fields).eq('id', id);
    if (error) alert('Save failed: ' + error.message);
  }
}

function quickUpdateDue(id, date) {
  updateAthlete(id, { due_date: date || null });
}

async function quickChurn(id) {
  const a = athletes.find(x => x.id === id);
  const typed = prompt('Type "' + a.name + '" to mark them as churned:');
  if (typed === null) return;
  if (typed.trim().toLowerCase() !== a.name.trim().toLowerCase()) {
    alert('Name didn\'t match — cancelled.');
    return;
  }
  updateAthlete(id, { is_active: false, end_date: TODAY.toISOString().slice(0, 10) });
}

async function deleteAthlete(id) {
  if (!confirm('Remove this athlete?')) return;
  athletes = athletes.filter(a => a.id !== id);
  renderAll();
  if (sb) await sb.from('athletes').delete().eq('id', id);
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  document.querySelectorAll('.sort-icon').forEach(el => el.textContent = '');
  const el = document.getElementById('sort-' + col);
  if (el) el.textContent = sortDir === 1 ? '↑' : '↓';
  renderTable();
}

function sv(a, col) {
  if (col === 'meet') { const m = nextMeet(a); return m ? daysDiff(m.date) : 9999; }
  if (col === 'status') {
    const s = getStatus(a);
    if (s === 'overdue') return a.priority_day ? 0 : 0.5;
    if (s === 'due')     return a.priority_day ? 1 : 1.5;
    if (s === 'ok')      return 2;
    return 3;
  }
  if (col === 'due_date') return daysDiff(a.due_date);
  if (col === 'start_date') return a.start_date || '9999';
  return (a[col] || '').toLowerCase();
}

async function autoAdvanceDueDates() {
  const thisMonday = getThisMonday();
  const mondayStr = thisMonday.toISOString().slice(0, 10);
  let changed = false;
  athletes = athletes.map(a => {
    if (!a.is_active || !a.due_date) return a;
    if (new Date(a.due_date + 'T12:00:00') < thisMonday) {
      if (sb) sb.from('athletes').update({ due_date: mondayStr }).eq('id', a.id);
      changed = true;
      return { ...a, due_date: mondayStr };
    }
    return a;
  });
  if (changed) renderAll();
}

function setFilter(f, btn) {
  activeFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTable();
}

function toggleAdd() {
  addOpen = !addOpen;
  renderTable();
}

function renderTable() {
  const body = document.getElementById('athlete-body');
  const dueTh = document.getElementById('th-due-date');
  if (dueTh) dueTh.childNodes[0].textContent = activeFilter === 'churned' ? 'Ended ' : 'Program due ';
  let list = athletes;
  if (activeFilter === 'active') list = list.filter(a => a.is_active);
  else if (activeFilter === 'overdue') list = list.filter(a => getStatus(a) === 'overdue');
  else if (activeFilter === 'due') list = list.filter(a => getStatus(a) === 'due');
  else if (activeFilter === 'meet') list = list.filter(a => a.is_active && nextMeet(a));
  else if (activeFilter === 'churned') list = list.filter(a => !a.is_active);
  list = [...list].sort((a, b) => {
    if ((activeFilter === 'due' || activeFilter === 'overdue') && sortCol !== 'status') {
      if (!!a.priority_day !== !!b.priority_day) return a.priority_day ? -1 : 1;
    }
    const av = sv(a, sortCol), bv = sv(b, sortCol);
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });
  let html = '';
  list.forEach(a => {
    const status = getStatus(a);
    const nm = nextMeet(a);
    const cd = nm ? meetCountdown(nm.date) : null;
    const rowClass = !a.is_active ? 'churned-row' : (status === 'overdue' || status === 'due') ? 'row-urgent' : 'row-ok';
    html +=
      '<tr class="' + rowClass + '" onclick="openModal(\'' + a.id + '\')">' +
      '<td><div class="name-wrap"><div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
      '<div><div class="athlete-name">' + a.name + (a.priority_day && a.is_active ? ' <span title="Priority — done by ' + a.priority_day + '" style="color:#ffc107;font-size:11px;vertical-align:middle">★</span>' : '') + '</div>' + (a.notes ? '<div class="sub-text">' + a.notes + '</div>' : '') + '</div></div></td>' +
      '<td style="color:var(--text2);font-size:13px">' + (a.program ? (a.program.startsWith('http') ? '<a href="' + a.program + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue-text)">Open sheet ↗</a>' : a.program) : '—') + '</td>' +
      '<td style="font-size:13px;color:var(--text2)">' + fmtShort(a.start_date) + '</td>' +
      '<td style="font-size:13px;color:var(--text2)">' + (!a.is_active ? (a.end_date ? '<span style="color:var(--text3)">Left ' + fmtShort(a.end_date) + '</span>' : '—') : '<div style="position:relative;display:inline-flex;align-items:center;cursor:pointer"><span>' + (a.due_date ? fmtDay(a.due_date) : '<span style=\'color:var(--text3)\'>Set date</span>') + '</span><input type="date" value="' + (a.due_date || '') + '" onclick="event.stopPropagation()" onchange="quickUpdateDue(\'' + a.id + '\',this.value)" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;top:0;left:0"/></div>') + '</td>' +
      '<td>' + (a.is_active
        ? (nm
          ? '<div class="meet-chip">🏋️ ' + nm.name + '</div><div class="meet-countdown">' + (cd ? (typeof cd.val === 'string' ? cd.val : cd.val + ' ' + cd.unit + ' out') : 'Past') + '</div>'
          : '<span class="no-meet">No meet</span>')
        : '<span class="no-meet">—</span>') + '</td>' +
      '<td>' + pillHTML(status) + '</td>' +
      '<td onclick="event.stopPropagation()">' + (a.is_active ? '<button class="action-btn churn-btn" onclick="quickChurn(\'' + a.id + '\')" title="Mark as churned">✕</button>' : '') + '</td></tr>';
  });
  if (addOpen) {
    html +=
      '<tr class="add-row">' +
      '<td><input type="text" id="new-name" placeholder="Athlete name" onclick="event.stopPropagation()"/></td>' +
      '<td><input type="text" id="new-program" placeholder="Program name" onclick="event.stopPropagation()"/></td>' +
      '<td><input type="date" id="new-start" class="date-input" value="' + TODAY.toISOString().slice(0, 10) + '" onclick="event.stopPropagation()"/></td>' +
      '<td></td><td></td>' +
      '<td style="display:flex;gap:6px">' +
      '<button class="save-btn" onclick="event.stopPropagation();submitAdd()">Save</button>' +
      '<button class="cancel-btn" onclick="event.stopPropagation();toggleAdd()">Cancel</button></td></tr>';
  }
  if (!html) html = '<tr><td colspan="6" class="empty">No athletes match this filter.</td></tr>';
  body.innerHTML = html;
  if (addOpen && document.getElementById('new-name')) document.getElementById('new-name').focus();
}

function submitAdd() {
  const name = document.getElementById('new-name') && document.getElementById('new-name').value.trim();
  const prog = document.getElementById('new-program') && document.getElementById('new-program').value.trim();
  const start = document.getElementById('new-start') && document.getElementById('new-start').value;
  if (!name) { document.getElementById('new-name').focus(); return; }
  addOpen = false;
  addAthlete(name, prog || 'No program', start);
}

function openModal(id) {
  modalId = id;
  const a = athletes.find(x => x.id == id);
  document.getElementById('modal-title').textContent = a.name;
  document.getElementById('m-name').value = a.name;
  document.getElementById('m-program').value = a.program || '';
  document.getElementById('m-due').value = a.due_date || '';
  document.getElementById('m-start').value = a.start_date || '';
  document.getElementById('m-notes').value = a.notes || '';
  document.getElementById('m-end').value = a.end_date || '';
  document.getElementById('m-churn-reason').value = a.churn_reason || '';
  document.getElementById('m-tenure').textContent = tenure(a.start_date, a.end_date);
  renderCoachingPeriods(a);
  togglePeriodForm(false);
  document.getElementById('m-priority-day').value = a.priority_day || '';
  document.getElementById('m-low-contact').checked = a.low_contact || false;
  document.getElementById('m-tshirt').checked = a.tshirt || false;
  document.getElementById('m-shirt-note').value = a.shirt_note || '';
  document.getElementById('m-testimonial').checked = a.testimonial || false;
  document.getElementById('m-out-of-state').checked = a.out_of_state || false;
  document.getElementById('m-source').value = a.source || '';
  document.getElementById('m-payment-note').value = a.payment_note || '';
  document.getElementById('m-next-payment').value = a.next_payment_date || '';
  document.getElementById('m-start').oninput = function () {
    document.getElementById('m-tenure').textContent = tenure(this.value, athletes.find(x => x.id == modalId).end_date);
  };
  const isChurned = !a.is_active;
  document.getElementById('churn-fields').style.display = isChurned ? 'block' : 'none';
  document.getElementById('churn-active-msg').style.display = isChurned ? 'none' : 'block';
  const btn = document.getElementById('churn-toggle-btn');
  btn.textContent = isChurned ? 'Mark as active' : 'Mark as churned';
  btn.className = 'churn-toggle-btn' + (isChurned ? ' undo' : '');
  toggleMeetForm(false);
  renderMeetsList(a);
  document.getElementById('athlete-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('athlete-modal').classList.remove('open');
  modalId = null;
}

function saveModal() {
  const name = document.getElementById('m-name').value.trim();
  if (!name) { document.getElementById('m-name').focus(); return; }
  const a = athletes.find(x => x.id == modalId);
  updateAthlete(modalId, {
    name,
    program: document.getElementById('m-program').value.trim(),
    due_date: document.getElementById('m-due').value || null,
    start_date: document.getElementById('m-start').value || null,
    notes: document.getElementById('m-notes').value,
    end_date: document.getElementById('m-end').value || null,
    churn_reason: document.getElementById('m-churn-reason').value || null,
    is_active: a.is_active,
    priority_day: document.getElementById('m-priority-day').value || null,
    low_contact: document.getElementById('m-low-contact').checked,
    tshirt: document.getElementById('m-tshirt').checked,
    shirt_note: document.getElementById('m-shirt-note').value.trim() || null,
    testimonial: document.getElementById('m-testimonial').checked,
    out_of_state: document.getElementById('m-out-of-state').checked,
    source: document.getElementById('m-source').value || null,
    payment_note: document.getElementById('m-payment-note').value.trim() || null,
    next_payment_date: document.getElementById('m-next-payment').value || null,
  });
  closeModal();
}

function toggleChurn() {
  const a = athletes.find(x => x.id == modalId);
  const nowChurned = a.is_active; // true = currently active, about to be churned
  if (nowChurned) {
    updateAthlete(modalId, {
      is_active: false,
      end_date: TODAY.toISOString().slice(0, 10),
      churn_reason: null,
    });
  } else {
    // Reactivating — archive the current period before resetting
    const periods = [...(a.coaching_periods || []), {
      start_date: a.start_date,
      end_date: a.end_date,
      churn_reason: a.churn_reason,
    }];
    updateAthlete(modalId, {
      is_active: true,
      end_date: null,
      churn_reason: null,
      start_date: TODAY.toISOString().slice(0, 10),
      coaching_periods: periods,
    });
  }
  openModal(modalId);
}

function renderCoachingPeriods(a) {
  const list = document.getElementById('coaching-periods-list');
  if (!list) return;
  const periods = a.coaching_periods || [];
  if (!periods.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text3);margin-bottom:4px">No past coaching periods recorded.</div>';
    return;
  }
  list.innerHTML = periods.map((p, i) =>
    '<div class="meet-item">' +
    '<div class="meet-item-left">' +
    '<div class="meet-item-name">' + fmtShort(p.start_date) + ' → ' + fmtShort(p.end_date) + ' · ' + tenure(p.start_date, p.end_date) + '</div>' +
    '<div class="meet-item-meta">' + (p.churn_reason || 'No reason recorded') + '</div>' +
    '</div>' +
    '<button class="action-btn" onclick="removePastPeriod(' + i + ')" title="Remove">✕</button></div>'
  ).join('');
}

function togglePeriodForm(show) {
  document.getElementById('add-period-form').style.display = show ? 'flex' : 'none';
  document.getElementById('add-period-btn').style.display = show ? 'none' : '';
}

function addPastPeriod() {
  const start = document.getElementById('period-start').value;
  const end = document.getElementById('period-end').value;
  const reason = document.getElementById('period-reason').value;
  if (!start || !end) { alert('Enter both a start and end date.'); return; }
  const a = athletes.find(x => x.id == modalId);
  const periods = [...(a.coaching_periods || []), { start_date: start, end_date: end, churn_reason: reason || null }];
  updateAthlete(modalId, { coaching_periods: periods });
  togglePeriodForm(false);
  document.getElementById('period-start').value = '';
  document.getElementById('period-end').value = '';
  document.getElementById('period-reason').value = '';
  renderCoachingPeriods({ ...a, coaching_periods: periods });
}

function removePastPeriod(idx) {
  if (!confirm('Remove this past coaching period?')) return;
  const a = athletes.find(x => x.id == modalId);
  const periods = (a.coaching_periods || []).filter((_, i) => i !== idx);
  updateAthlete(modalId, { coaching_periods: periods });
  renderCoachingPeriods({ ...a, coaching_periods: periods });
}

function toggleMeetForm(show) {
  document.getElementById('add-meet-form').style.display = show ? 'flex' : 'none';
  document.getElementById('add-meet-btn').style.display = show ? 'none' : '';
  if (show) {
    const seen = {};
    const meets = [];
    athletes.forEach(a => (a.meets || []).forEach(m => {
      const k = m.name + '|' + m.date;
      if (!seen[k]) { seen[k] = true; meets.push(m); }
    }));
    meets.sort((a, b) => daysDiff(a.date) - daysDiff(b.date));
    const sel = document.getElementById('new-meet-pick');
    sel.innerHTML = '<option value="">— Pick an existing meet or enter new below —</option>' +
      meets.map((m, i) => '<option value="' + i + '">' + m.name + ' · ' + fmtDay(m.date) + '</option>').join('');
    sel._meets = meets;
    setTimeout(function () { document.getElementById('new-meet-name').focus(); }, 50);
  }
}

function pickExistingMeet(sel) {
  if (!sel.value) return;
  const m = sel._meets[parseInt(sel.value)];
  if (!m) return;
  document.getElementById('new-meet-name').value = m.name;
  document.getElementById('new-meet-date').value = m.date;
  document.getElementById('new-meet-time').value = m.time || '';
}

function renderMeetsList(a) {
  const list = document.getElementById('meets-list');
  const meets = (a.meets || []).slice().sort((x, y) => daysDiff(x.date) - daysDiff(y.date));
  if (!meets.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text3);margin-bottom:4px">No meets yet.</div>';
    return;
  }
  list.innerHTML = meets.map((m, i) => {
    const cd = meetCountdown(m.date);
    const past = daysDiff(m.date) < 0;
    return '<div class="meet-item">' +
      '<div class="meet-item-left"><div class="meet-item-name">' + m.name + '</div>' +
      '<div class="meet-item-meta">' + fmtDate(m.date, m.time) + '</div></div>' +
      '<div class="meet-item-cd">' + (past ? '<span style="color:var(--text3)">Past</span>' : (cd ? (typeof cd.val === 'string' ? cd.val : cd.val + ' ' + cd.unit + ' out') : '')) + '</div>' +
      '<button class="action-btn" onclick="removeMeet(' + i + ')" title="Remove">✕</button></div>';
  }).join('');
}

function addMeet() {
  const name = document.getElementById('new-meet-name').value.trim();
  const date = document.getElementById('new-meet-date').value;
  const time = document.getElementById('new-meet-time').value;
  if (!name || !date) { alert('Enter a meet name and date.'); return; }
  const a = athletes.find(x => x.id == modalId);
  const meets = [...(a.meets || []), { name, date, time: time || '' }];
  updateAthlete(modalId, { meets });
  document.getElementById('new-meet-name').value = '';
  document.getElementById('new-meet-date').value = '';
  document.getElementById('new-meet-time').value = '';
  toggleMeetForm(false);
  renderMeetsList({ ...a, meets });
}

function removeMeet(idx) {
  const a = athletes.find(x => x.id == modalId);
  const meets = (a.meets || []).filter((_, i) => i !== idx);
  updateAthlete(modalId, { meets });
  renderMeetsList({ ...a, meets });
}
