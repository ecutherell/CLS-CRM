async function toggleMeetFlagFromDash(athleteId, meetNameEnc, meetDate, field) {
  const meetName = decodeURIComponent(meetNameEnc);
  const a = athletes.find(x => String(x.id) === String(athleteId));
  if (!a) return;
  const meets = (a.meets || []).map(m =>
    m.name === meetName && m.date === meetDate ? { ...m, [field]: !m[field] } : m
  );
  athletes = athletes.map(x => String(x.id) === String(athleteId) ? { ...x, meets } : x);
  if (sb) await sb.from('athletes').update({ meets }).eq('id', athleteId);
  renderDashboard();
}

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

function getWeeklyTaskKey(task) {
  return task + '_' + getThisMonday().toISOString().slice(0, 10);
}

function weeklyTaskDone(task) {
  return sGet(getWeeklyTaskKey(task), false);
}

function markWeeklyTask(task, overlayId) {
  if (weeklyTaskDone(task)) {
    sSet(getWeeklyTaskKey(task), false);
    renderDashboard();
    return;
  }
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.style.display = 'flex';
}

function confirmWeeklyTask(task, overlayId) {
  sSet(getWeeklyTaskKey(task), true);
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.style.display = 'none';
  renderDashboard();
}

function cancelWeeklyTask(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.style.display = 'none';
}

// Legacy aliases kept for existing HTML
function checkMeetsDone()    { return weeklyTaskDone('check_meets'); }
function markCheckMeetsDone() { markWeeklyTask('check_meets', 'check-meets-overlay'); }
function confirmCheckMeets() { confirmWeeklyTask('check_meets', 'check-meets-overlay'); }
function cancelCheckMeets()  { cancelWeeklyTask('check-meets-overlay'); }

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
  const overdueCount = active.filter(a => getStatus(a) === 'overdue').length;
  const dueThisWkTotal = dueThisWk + overdueCount;

  const clientGoal = parseInt(localStorage.getItem('pref_client_goal')) || 0;
  const clientGoalStr = clientGoal ? '<span style="font-size:14px;color:var(--text3);font-weight:400">/' + clientGoal + '</span>' : '';

  document.getElementById('dash-stats').innerHTML =
    '<div class="stat"><div class="stat-label">Active clients</div><div class="stat-val">' + active.length + clientGoalStr + '</div></div>' +
    '<div class="stat"><div class="stat-label">Overdue</div><div class="stat-val red">' + overdueCount + '</div>' + (overdueCount ? '<div style="font-size:11px;color:var(--text3);margin-top:4px">~' + fmtTime(overdueCount) + ' to write</div>' : '') + '</div>' +
    '<div class="stat"><div class="stat-label">Due this week</div><div class="stat-val amber">' + dueThisWkTotal + '</div>' + (dueThisWkTotal ? '<div style="font-size:11px;color:var(--text3);margin-top:4px">~' + fmtTime(dueThisWkTotal) + ' to write</div>' : '') + '</div>' +
    '<div class="stat"><div class="stat-label">Due next week</div><div class="stat-val" style="color:var(--text2)">' + dueNextWk + '</div>' + (dueNextWk ? '<div style="font-size:11px;color:var(--text3);margin-top:4px">~' + fmtTime(dueNextWk) + ' to write</div>' : '') + '</div>' +
    '<div class="stat"><div class="stat-label">Athletes in prep</div><div class="stat-val purple">' + meets + '</div></div>' +
    (function() {
      const rateAmt   = parseFloat(localStorage.getItem('pref_rate_amount')) || 0;
      const rateWeeks = parseFloat(localStorage.getItem('pref_rate_weeks'))  || 4;
      if (!rateAmt) return '<div class="stat" style="cursor:pointer" onclick="openSetup()" title="Set your rate in Settings"><div class="stat-label">Current rate</div><div class="stat-val" style="font-size:16px;color:var(--text3)">Set rate →</div></div>';
      const perMonth = Math.round(rateAmt * (52 / rateWeeks) / 12);
      const perYear  = Math.round(rateAmt * (52 / rateWeeks));
      return '<div class="stat"><div class="stat-label">Current rate</div>' +
        '<div class="stat-val green" style="font-size:22px">$' + rateAmt.toLocaleString() + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:4px">every ' + rateWeeks + ' wks · ~$' + perMonth.toLocaleString() + '/mo · $' + perYear.toLocaleString() + '/yr</div>' +
        '</div>';
    })() +
    '';

  const od = active.filter(a => {
    if (getStatus(a) === 'overdue') return true;
    if (getStatus(a) === 'due') {
      const dl = getDeadlineDate(a);
      if (!dl) return false;
      return Math.round((dl - TODAY) / 86400000) <= 1;
    }
    return false;
  }).sort((a, b) => {
    const aOd = getStatus(a) === 'overdue', bOd = getStatus(b) === 'overdue';
    if (aOd !== bOd) return aOd ? -1 : 1; // overdue always first
    if (!!a.priority_day !== !!b.priority_day) return a.priority_day ? -1 : 1;
    const da = getDeadlineDate(a), db = getDeadlineDate(b);
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });
  document.getElementById('dash-overdue').innerHTML = od.length
    ? od.slice(0, 8).map(a => {
        const isOd = getStatus(a) === 'overdue';
        const pill = isOd
          ? '<span class="pill pill-red" style="font-size:10px">' + deadlineHint(a) + ' ✎</span>'
          : '<span class="pill" style="font-size:10px;background:rgba(255,112,67,0.15);color:#ff7043;border:1px solid #ff7043">' + deadlineHint(a) + ' ✎</span>';
        return '<div class="dash-row"><div><div class="dash-row-name">' + a.name + '</div><div class="dash-row-meta">' + (a.program ? (a.program.startsWith('http') ? '<a href="' + a.program + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue-text);font-size:12px">Open sheet ↗</a>' : a.program) : '—') + '</div></div>' +
          '<div style="display:inline-flex;align-items:center;gap:4px;cursor:pointer" title="Click to change due date" onclick="pickDate(\'' + (a.due_date || '') + '\',function(v){confirmUpdateDue(\'' + a.id + '\',v)},event)">' +
          pill + '</div></div>';
      }).join('')
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

  const odSorted = od.slice(0, 5);
  const odIds = new Set(odSorted.map(a => a.id));
  const dw = active.filter(a => getStatus(a) === 'due' && !odIds.has(a.id)).sort((a, b) => {
    if (!!a.priority_day !== !!b.priority_day) return a.priority_day ? -1 : 1;
    const da = getDeadlineDate(a), db = getDeadlineDate(b);
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });
  const dwAll = [...odSorted, ...dw];
  function weeklyRow(label, task, overlayId) {
    const done = weeklyTaskDone(task);
    return '<div class="dash-row" style="' + (done ? 'opacity:0.5' : 'background:rgba(100,181,246,0.07);border-radius:8px') + ';padding:8px 10px;gap:10px">' +
      '<div style="flex:1"><div class="dash-row-name" style="' + (done ? 'text-decoration:line-through;color:var(--text3)' : 'color:var(--blue-text)') + '">' + label + '</div></div>' +
      '<button onclick="markWeeklyTask(\'' + task + '\',\'' + overlayId + '\')" style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;' +
      (done
        ? 'background:rgba(76,175,80,0.15);color:var(--green-text);border:1px solid var(--green-text)'
        : 'background:var(--surface2);color:var(--text3);border:1px dashed var(--border2)') + '">' +
      (done ? '✓ Done' : '+ Mark done') + '</button>' +
      '</div>';
  }
  // Dynamic: ask for attempts rows for anyone with a meet in the next 7 days
  const attemptsRows = active.flatMap(a =>
    (a.meets || [])
      .filter(m => { const d = daysDiff(m.date); return d >= 0 && d <= 7 && !m.attempts_asked; })
      .map(m => {
        const d = daysDiff(m.date);
        const when = d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + 'd';
        return '<div class="dash-row" style="background:rgba(255,112,67,0.07);border-radius:8px;padding:8px 10px;gap:10px">' +
          '<div style="flex:1"><div class="dash-row-name" style="color:#ff7043">Ask ' + a.name + ' for attempts</div>' +
          '<div class="dash-row-meta">' + m.name + ' · ' + when + '</div></div>' +
          '<button onclick="toggleMeetFlagFromDash(\'' + a.id + '\',\'' + encodeURIComponent(m.name) + '\',\'' + m.date + '\',\'attempts_asked\')" ' +
          'style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;background:var(--surface2);color:var(--text3);border:1px dashed var(--border2)">+ Mark done</button>' +
          '</div>';
      })
  );

  const checkRow = weeklyRow("Double check everyone's meets", 'check_meets', 'check-meets-overlay') +
                   weeklyRow("Double check that everyone's prep is planned", 'check_prep', 'check-prep-overlay') +
                   attemptsRows.join('');
  document.getElementById('dash-due').innerHTML = checkRow + (dwAll.length
    ? dwAll.map(a => {
        const isOd = getStatus(a) === 'overdue';
        return '<div class="dash-row"><div><div class="dash-row-name">' + a.name + (a.priority_day ? ' <span style="color:#ffc107;font-size:10px">★</span>' : '') + ' <button onclick="event.stopPropagation();openPrModal(\'' + a.id + '\')" title="PR log" style="background:none;border:1px solid var(--border2);border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;color:var(--text3);margin-left:4px">📊</button></div><div class="dash-row-meta">' + (a.program ? (a.program.startsWith('http') ? '<a href="' + a.program + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue-text);font-size:12px">Open sheet ↗</a>' : a.program) : '—') + '</div></div>' +
          '<div style="display:inline-flex;align-items:center;gap:4px;cursor:pointer" title="Click to change due date" onclick="pickDate(\'' + (a.due_date || '') + '\',function(v){confirmUpdateDue(\'' + a.id + '\',v)},event)">' +
          (isOd
            ? '<span class="pill pill-red" style="font-size:10px">' + deadlineHint(a) + ' ✎</span>'
            : '<span style="font-size:12px;color:var(--amber-text);font-weight:600">' + deadlineHint(a) + '</span><span style="font-size:10px;color:var(--text3)">✎</span>') +
          '</div></div>';
      }).join('')
    : '<div class="dash-empty">Nothing due this week.</div>');

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

  document.getElementById('dash-sales').innerHTML = mCalls > 0
    ? '<div class="dash-row"><div class="dash-row-name">Calls this month</div><strong>' + mCalls + '</strong></div>' +
      '<div class="dash-row"><div class="dash-row-name">Closes this month</div><strong style="color:var(--green-text)">' + mCloses + '</strong></div>' +
      '<div class="dash-row"><div class="dash-row-name">Conversion rate</div><strong style="color:' + (conv >= 30 ? 'var(--green-text)' : conv >= 15 ? 'var(--amber-text)' : 'var(--red-text)') + '">' + conv + '%</strong></div>'
    : '<div class="dash-empty">No sales logged this month yet.</div>';

  // Birthday alert
  const bdayAlertEl = document.getElementById('dash-birthday-alert');
  if (bdayAlertEl && typeof bdayMMDD === 'function') {
    const todayBdays = athletes.filter(a => a.is_active && a.birthday === bdayMMDD());
    if (todayBdays.length) {
      bdayAlertEl.style.display = 'flex';
      const names = todayBdays.map(a => a.name).join(', ');
      bdayAlertEl.innerHTML =
        '<span style="font-size:26px;flex-shrink:0">🎂</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600;font-size:14px;color:var(--text)">Birthday' + (todayBdays.length > 1 ? 's' : '') + ' today!</div>' +
          '<div style="font-size:13px;color:var(--text2);margin-top:2px">' + names + '</div>' +
        '</div>' +
        '<button onclick="goTo(\'birthdays\',document.getElementById(\'nav-birthdays\'))" ' +
          'style="font-size:12px;padding:5px 14px;border-radius:6px;border:1px solid rgba(229,57,53,0.35);background:none;color:var(--red-text);cursor:pointer;flex-shrink:0;font-weight:500">View →</button>';
    } else {
      bdayAlertEl.style.display = 'none';
    }
  }
}
