function pickDate(currentVal, onChange, e) {
  const inp = document.getElementById('global-date-picker');
  inp.value = currentVal || '';
  inp.onchange = function() { if (this.value) onChange(this.value); };
  if (e) {
    inp.style.left = e.clientX + 'px';
    inp.style.top = e.clientY + 'px';
  }
  inp.showPicker();
}

function confirmUpdateDue(id, newDate) {
  const a = athletes.find(x => x.id == id);
  if (!a) return;
  if (!confirm('Update ' + a.name + '\'s due date to ' + new Date(newDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '?')) return;
  quickUpdateDue(id, newDate);
  renderDashboard();
}

function getTextedKey() {
  return 'texted_' + getThisMonday().toISOString().slice(0, 10);
}

function getTextedSet() {
  return new Set(sGet(getTextedKey(), []));
}

let _pendingTextId = null;

function promptTextCheck(id, name, markingDone) {
  _pendingTextId = id;
  document.getElementById('text-confirm-icon').textContent = markingDone ? '✅' : '↩️';
  document.getElementById('text-confirm-msg').textContent = markingDone ? 'Mark as texted?' : 'Unmark ' + name + '?';
  document.getElementById('text-confirm-sub').textContent = markingDone
    ? 'Log that you reached out to ' + name + ' this week.'
    : 'Move ' + name + ' back to your to-do list.';
  document.getElementById('text-confirm-btn').textContent = markingDone ? 'Yes, mark done' : 'Yes, unmark';
  document.getElementById('text-confirm-overlay').style.display = 'flex';
}

function confirmTextCheck() {
  if (!_pendingTextId) return;
  const set = getTextedSet();
  const id = String(_pendingTextId);
  if (set.has(id)) set.delete(id); else set.add(id);
  sSet(getTextedKey(), [...set]);
  _pendingTextId = null;
  document.getElementById('text-confirm-overlay').style.display = 'none';
  renderTextChecks(athletes.filter(a => a.is_active && a.low_contact).sort((a, b) => a.name.localeCompare(b.name)));
}

function cancelTextCheck() {
  _pendingTextId = null;
  document.getElementById('text-confirm-overlay').style.display = 'none';
}

function renderTextChecks(lc) {
  const texted = getTextedSet();
  const done = lc.filter(a => texted.has(String(a.id))).length;
  const titleEl = document.querySelector('#dash-low-contact-wrap .dash-card-title');
  if (titleEl) titleEl.innerHTML = '💬 Text this week <span style="font-size:11px;color:var(--text3);font-weight:400;margin-left:6px">' + done + '/' + lc.length + '</span>';
  document.getElementById('dash-low-contact').innerHTML = lc.map(a => {
    const done = texted.has(String(a.id));
    return '<div class="dash-row" style="gap:10px">' +
      '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1">' +
      '<input type="checkbox" ' + (done ? 'checked' : '') + ' onclick="event.preventDefault();promptTextCheck(\'' + a.id + '\',\'' + a.name.replace(/'/g, "\\'") + '\',' + (!done) + ')" style="width:15px;height:15px;cursor:pointer;accent-color:#5c9cf5;flex-shrink:0"/>' +
      '<div style="' + (done ? 'opacity:0.4;text-decoration:line-through' : '') + '"><div class="dash-row-name">' + a.name + '</div>' +
      '<div class="dash-row-meta">' + (a.program ? (a.program.startsWith('http') ? '<a href="' + a.program + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue-text);font-size:12px">Open sheet ↗</a>' : a.program) : '—') + '</div></div>' +
      '</label></div>';
  }).join('');
}

function calcAnnualChurn() {
  const now = new Date();
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const churnedThisYear = athletes.filter(a => {
    if (a.is_active || !a.end_date) return false;
    const ed = new Date(a.end_date + 'T12:00:00');
    return ed >= yearAgo && ed <= now;
  }).length;
  const base = athletes.filter(a => {
    if (a.is_active) return true;
    if (!a.end_date) return false;
    const ed = new Date(a.end_date + 'T12:00:00');
    return ed >= yearAgo;
  }).length;
  return base === 0 ? null : Math.round(churnedThisYear / base * 100);
}

function renderDashboard() {
  const active = athletes.filter(a => a.is_active);
  const ch = calcChurn();
  const pct = ch ? Math.round(ch.rate * 100) : 0;
  const meets = active.filter(a => (a.meets || []).some(m => daysDiff(m.date) >= 0)).length;
  const sm = salesThisMonth();
  const mCalls = sm.reduce((n, e) => n + e.calls, 0);
  const mCloses = sm.reduce((n, e) => n + e.closes, 0);
  const conv = mCalls > 0 ? Math.round(mCloses / mCalls * 100) : 0;

  const thisMonday = getThisMonday();
  const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
  const nxtMonday = new Date(thisMonday); nxtMonday.setDate(nxtMonday.getDate() + 7);
  const wkAfter = new Date(nxtMonday); wkAfter.setDate(wkAfter.getDate() + 7);
  const dueNextWk = active.filter(a => {
    if (!a.due_date) return false;
    const d = new Date(a.due_date + 'T12:00:00');
    return d >= nxtMonday && d < wkAfter;
  }).length;

  const MINS_PER_PROGRAM = parseInt(sGet('pref_mins', 11));
  const fmtTime = n => { const h = Math.floor(n * MINS_PER_PROGRAM / 60), m = (n * MINS_PER_PROGRAM) % 60; return h ? h + 'h ' + (m ? m + 'm' : '') : m + 'm'; };
  const dueThisWk = active.filter(a => getStatus(a) === 'due').length;

  document.getElementById('dash-stats').innerHTML =
    '<div class="stat"><div class="stat-label">Active clients</div><div class="stat-val">' + active.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Due this week</div><div class="stat-val amber">' + dueThisWk + '</div>' + (dueThisWk ? '<div style="font-size:11px;color:var(--text3);margin-top:4px">~' + fmtTime(dueThisWk) + ' to write</div>' : '') + '</div>' +
    '<div class="stat"><div class="stat-label">Due next week</div><div class="stat-val" style="color:var(--text2)">' + dueNextWk + '</div>' + (dueNextWk ? '<div style="font-size:11px;color:var(--text3);margin-top:4px">~' + fmtTime(dueNextWk) + ' to write</div>' : '') + '</div>' +
    (() => { const od = active.filter(a => getStatus(a) === 'overdue').length; return '<div class="stat"><div class="stat-label">Overdue</div><div class="stat-val red">' + od + '</div>' + (od ? '<div style="font-size:11px;color:var(--text3);margin-top:4px">~' + fmtTime(od) + ' to write</div>' : '') + '</div>'; })() +
    '<div class="stat"><div class="stat-label">Athletes in prep</div><div class="stat-val purple">' + meets + '</div></div>' +
    '<div class="stat"><div class="stat-label">Monthly churn <span class="info-tip" data-tipid="monthly">ⓘ</span></div><div class="stat-val" style="color:' + (pct <= 4 ? '#4caf50' : pct <= 7 ? '#8bc34a' : pct <= 11 ? '#ffc107' : pct <= 15 ? '#ff7043' : '#e53935') + '">' + pct + '%</div></div>' +
    '';

  const od = active.filter(a => getStatus(a) === 'overdue').sort((a, b) => {
    if (!!a.priority_day !== !!b.priority_day) return a.priority_day ? -1 : 1;
    const da = getDeadlineDate(a), db = getDeadlineDate(b);
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });
  document.getElementById('dash-overdue').innerHTML = od.length
    ? od.slice(0, 5).map(a =>
        '<div class="dash-row"><div><div class="dash-row-name">' + a.name + '</div><div class="dash-row-meta">' + (a.program ? (a.program.startsWith('http') ? '<a href="' + a.program + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue-text);font-size:12px">Open sheet ↗</a>' : a.program) : '—') + '</div></div>' +
        '<div style="display:inline-flex;align-items:center;gap:4px;cursor:pointer" title="Click to change due date" onclick="pickDate(\'' + (a.due_date || '') + '\',function(v){confirmUpdateDue(\'' + a.id + '\',v)},event)">' +
        '<span class="pill pill-red" style="font-size:10px">' + deadlineHint(a) + ' ✎</span>' +
        '</div></div>'
      ).join('')
    : '<div class="dash-empty">All programs up to date ✓</div>';

  const meetMap = {};
  active.forEach(a => (a.meets || []).filter(m => daysDiff(m.date) >= 0).forEach(m => {
    const k = m.name + '|' + m.date;
    if (!meetMap[k]) meetMap[k] = { name: m.name, date: m.date, athletes: [] };
    meetMap[k].athletes.push(a.name);
  }));
  const groupedMeets = Object.values(meetMap).sort((a, b) => daysDiff(a.date) - daysDiff(b.date));
  document.getElementById('dash-meets').innerHTML = groupedMeets.length
    ? groupedMeets.slice(0, 5).map(m => {
        const cd = meetCountdown(m.date);
        return '<div class="dash-row" style="align-items:flex-start"><div style="flex:1"><div class="dash-row-name">' + m.name + '</div>' +
          '<div class="dash-row-meta" style="margin-top:2px">' + m.athletes.join(', ') + '</div></div>' +
          '<span style="font-size:12px;color:var(--purple-text);font-weight:600;white-space:nowrap;margin-left:12px">' + (cd ? (typeof cd.val === 'string' ? cd.val : cd.val + ' ' + cd.unit) : '') + '</span></div>';
      }).join('')
    : '<div class="dash-empty">No meets scheduled yet.</div>';

  const dw = active.filter(a => getStatus(a) === 'due').sort((a, b) => {
    if (!!a.priority_day !== !!b.priority_day) return a.priority_day ? -1 : 1;
    const da = getDeadlineDate(a), db = getDeadlineDate(b);
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });
  document.getElementById('dash-due').innerHTML = dw.length
    ? dw.map(a =>
        '<div class="dash-row"><div><div class="dash-row-name">' + a.name + (a.priority_day ? ' <span style="color:#ffc107;font-size:10px">★</span>' : '') + ' <button onclick="event.stopPropagation();openPrModal(\'' + a.id + '\')" title="PR log" style="background:none;border:1px solid var(--border2);border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;color:var(--text3);margin-left:4px">📊</button></div><div class="dash-row-meta">' + (a.program ? (a.program.startsWith('http') ? '<a href="' + a.program + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue-text);font-size:12px">Open sheet ↗</a>' : a.program) : '—') + '</div></div>' +
        '<div style="display:inline-flex;align-items:center;gap:4px;cursor:pointer" title="Click to change due date" onclick="pickDate(\'' + (a.due_date || '') + '\',function(v){confirmUpdateDue(\'' + a.id + '\',v)},event)">' +
        '<span style="font-size:12px;color:var(--amber-text);font-weight:600">' + deadlineHint(a) + '</span>' +
        '<span style="font-size:10px;color:var(--text3)">✎</span>' +
        '</div></div>'
      ).join('')
    : '<div class="dash-empty">Nothing due this week.</div>';

  const lw = active.filter(a => {
    if (!a.due_date) return false;
    const d = new Date(a.due_date + 'T12:00:00');
    return d >= lastMonday && d < thisMonday;
  }).sort((a, b) => a.name.localeCompare(b.name));
  const lwWrap = document.getElementById('dash-due-last-wrap');
  lwWrap.style.display = lw.length ? '' : 'none';
  document.getElementById('dash-due-last').innerHTML = lw.map(a =>
    '<div class="dash-row"><div><div class="dash-row-name" style="color:var(--text2)">' + a.name + (a.priority_day ? ' <span style="color:#ffc107;font-size:10px">★</span>' : '') + ' <button onclick="event.stopPropagation();openPrModal(\'' + a.id + '\')" title="PR log" style="background:none;border:1px solid var(--border2);border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;color:var(--text3);margin-left:4px">📊</button></div>' +
    '<div class="dash-row-meta">' + (a.program ? (a.program.startsWith('http') ? '<a href="' + a.program + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue-text);font-size:12px">Open sheet ↗</a>' : a.program) : '—') + '</div></div>' +
    '<span style="font-size:11px;color:var(--text3)">' + (a.priority_day || 'Sunday') + '</span>' +
    '</div>'
  ).join('');

  const nextMonday = getThisMonday();
  nextMonday.setDate(nextMonday.getDate() + 7);
  const weekAfterMonday = new Date(nextMonday);
  weekAfterMonday.setDate(weekAfterMonday.getDate() + 7);
  const nw = active.filter(a => {
    if (!a.due_date) return false;
    const d = new Date(a.due_date + 'T12:00:00');
    return d >= nextMonday && d < weekAfterMonday;
  }).sort((a, b) => {
    if (!!a.priority_day !== !!b.priority_day) return a.priority_day ? -1 : 1;
    const da = getDeadlineDate(a), db = getDeadlineDate(b);
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });
  const nwWrap = document.getElementById('dash-due-next-wrap');
  nwWrap.style.display = nw.length ? '' : 'none';
  document.getElementById('dash-due-next').innerHTML = nw.map(a =>
    '<div class="dash-row"><div><div class="dash-row-name">' + a.name + (a.priority_day ? ' <span style="color:#ffc107;font-size:10px">★</span>' : '') + ' <button onclick="event.stopPropagation();openPrModal(\'' + a.id + '\')" title="PR log" style="background:none;border:1px solid var(--border2);border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;color:var(--text3);margin-left:4px">📊</button></div><div class="dash-row-meta">' + (a.program ? (a.program.startsWith('http') ? '<a href="' + a.program + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue-text);font-size:12px">Open sheet ↗</a>' : a.program) : '—') + '</div></div>' +
    '<div style="display:inline-flex;align-items:center;gap:4px;cursor:pointer" title="Click to change due date" onclick="pickDate(\'' + (a.due_date || '') + '\',function(v){confirmUpdateDue(\'' + a.id + '\',v)},event)">' +
    '<span style="font-size:12px;color:var(--text3);font-weight:500">' + (a.priority_day || 'Sunday') + '</span>' +
    '<span style="font-size:10px;color:var(--text3)">✎</span>' +
    '</div></div>'
  ).join('');

  const lc = active.filter(a => a.low_contact).sort((a, b) => a.name.localeCompare(b.name));
  const lcWrap = document.getElementById('dash-low-contact-wrap');
  lcWrap.style.display = lc.length ? 'flex' : 'none';
  renderTextChecks(lc);

  document.getElementById('dash-sales').innerHTML = mCalls > 0
    ? '<div class="dash-row"><div class="dash-row-name">Calls this month</div><strong>' + mCalls + '</strong></div>' +
      '<div class="dash-row"><div class="dash-row-name">Closes this month</div><strong style="color:var(--green-text)">' + mCloses + '</strong></div>' +
      '<div class="dash-row"><div class="dash-row-name">Conversion rate</div><strong style="color:' + (conv >= 30 ? 'var(--green-text)' : conv >= 15 ? 'var(--amber-text)' : 'var(--red-text)') + '">' + conv + '%</strong></div>'
    : '<div class="dash-empty">No sales logged this month yet.</div>';
}
