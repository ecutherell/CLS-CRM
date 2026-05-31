function getPlannedCalls() { return sGet('planned_calls', []); }
function savePlannedCalls(list) { sSet('planned_calls', list); }

function addPlannedCall() {
  const sel = document.getElementById('call-athlete-sel');
  const dateEl = document.getElementById('call-date');
  const athleteId = sel.value;
  if (!athleteId) return;
  const a = athletes.find(x => String(x.id) === String(athleteId));
  if (!a) return;
  const list = getPlannedCalls();
  list.push({ athleteId, date: dateEl.value || null, addedAt: new Date().toISOString() });
  savePlannedCalls(list);
  sel.value = '';
  dateEl.value = '';
  renderPlannedCalls();
}

function markCallDone(athleteId) {
  savePlannedCalls(getPlannedCalls().filter(c => String(c.athleteId) !== String(athleteId)));
  renderPlannedCalls();
}

function renderPlannedCalls() {
  const body = document.getElementById('dash-calls');
  if (!body) return;

  // Populate athlete dropdown
  const sel = document.getElementById('call-athlete-sel');
  if (sel && sel.options.length <= 1) {
    athletes.filter(a => a.is_active).sort((a, b) => a.name.localeCompare(b.name)).forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      sel.appendChild(opt);
    });
  }

  const list = getPlannedCalls();
  if (!list.length) {
    body.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:8px 0">No calls planned.</div>';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const sorted = [...list].sort((a, b) => {
    const da = a.date || '9999', db = b.date || '9999';
    return da.localeCompare(db);
  });

  body.innerHTML = sorted.map(c => {
    const a = athletes.find(x => String(x.id) === String(c.athleteId));
    if (!a) return '';
    const daysUntil = c.date ? Math.floor((new Date(c.date + 'T12:00:00') - new Date()) / 86400000) : null;
    const isOverdue = daysUntil !== null && daysUntil < 0;
    const isToday = daysUntil === 0;
    const isSoon = daysUntil !== null && daysUntil <= 2 && !isOverdue;

    const dateColor = isOverdue ? 'color:var(--red-text,#e53935);font-weight:600'
      : isToday ? 'color:var(--red-text,#e53935);font-weight:600'
      : isSoon ? 'color:var(--amber-text,#b45309);font-weight:600'
      : 'color:var(--text3)';

    const dateLabel = !c.date ? '<span style="color:var(--text3);font-size:11px">no date set</span>'
      : isOverdue ? '<span style="' + dateColor + ';font-size:11px">' + Math.abs(daysUntil) + 'd overdue</span>'
      : isToday ? '<span style="' + dateColor + ';font-size:11px">today</span>'
      : '<span style="' + dateColor + ';font-size:11px">' + fmtDay(c.date) + (daysUntil <= 7 ? ' · in ' + daysUntil + 'd' : '') + '</span>';

    const rowBg = isOverdue || isToday ? 'background:rgba(229,57,53,0.07);border-radius:6px;' : '';

    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 4px;border-bottom:1px solid var(--border2);' + rowBg + '">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:500;color:var(--text);cursor:pointer" onclick="openModal(\'' + a.id + '\')">' + a.name + '</div>' +
        dateLabel +
      '</div>' +
      '<button onclick="markCallDone(\'' + a.id + '\')" title="Mark as called" ' +
        'style="font-size:11px;padding:3px 10px;border-radius:5px;border:1px solid var(--border2);background:var(--surface2);color:var(--green-text);cursor:pointer;white-space:nowrap">✓ Called</button>' +
    '</div>';
  }).filter(Boolean).join('');
}
