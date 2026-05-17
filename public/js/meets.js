let meetMap = {};
let _weekOutItems = []; // referenced by index from onclick handlers

// ── 1 Week Out reminders ────────────────────────────────────

function renderOneWeekOut() {
  const el = document.getElementById('meet-week-out-wrap');
  if (!el) return;

  // Gather all athletes with a meet 0–7 days out
  _weekOutItems = [];
  athletes.filter(a => a.is_active).forEach(a => {
    (a.meets || []).forEach(m => {
      const d = daysDiff(m.date);
      if (d >= 0 && d <= 7) {
        const myMeet    = myMeets.find(mm => mm.name === m.name && mm.date === m.date);
        const isHandling  = !!myMeet;
        // Only flag as traveling if a location is set (on athlete entry OR myMeet city)
        const location    = m.location || (myMeet && myMeet.city) || '';
        const isTraveling = isHandling && !!location.trim();
        _weekOutItems.push({ a, m, d, isHandling, isTraveling });
      }
    });
  });
  _weekOutItems.sort((x, y) => x.d - y.d);

  if (!_weekOutItems.length) {
    el.style.display = 'none';
    return;
  }

  const allDone = _weekOutItems.every(({ m, isTraveling }) =>
    m.attempts_asked && (!isTraveling || m.gift_told)
  );

  const borderColor = allDone ? 'rgba(76,175,80,0.3)'  : 'rgba(239,68,68,0.3)';
  const bgColor     = allDone ? 'rgba(76,175,80,0.05)' : 'rgba(239,68,68,0.05)';
  el.style.display  = '';
  el.style.background   = bgColor;
  el.style.border       = '1px solid ' + borderColor;

  const rows = _weekOutItems.map(({ a, m, d, isTraveling }, i) => {
    const dLabel = d === 0 ? '<span style="color:#e53935;font-weight:700">TODAY</span>'
                 : d === 1 ? '<span style="color:#e53935">1 day out</span>'
                 :           '<span style="color:#ffc107">' + d + ' days out</span>';

    const mkBtn = (flag, doneLabel, todoLabel) => {
      const done = m[flag];
      return '<button onclick="toggleMeetFlag(' + i + ',\'' + flag + '\')" ' +
        'style="font-size:11px;padding:5px 11px;border-radius:7px;cursor:pointer;white-space:nowrap;' +
        'border:1px solid ' + (done ? 'rgba(76,175,80,0.4)' : 'var(--border2)') + ';' +
        'background:'       + (done ? 'rgba(76,175,80,0.12)' : 'var(--surface2)') + ';' +
        'color:'            + (done ? '#4caf50' : 'var(--text2)') + ';' +
        'font-weight:'      + (done ? '600' : '400') + '">' +
        (done ? '✓ ' + doneLabel : '○ ' + todoLabel) +
      '</button>';
    };

    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;' +
      'padding:10px 0;border-bottom:1px solid var(--border2);flex-wrap:wrap">' +
      '<div style="display:flex;align-items:center;gap:10px;min-width:160px">' +
        '<div class="mini-avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
        '<div>' +
          '<div style="font-size:13px;font-weight:600;color:var(--text)">' + a.name + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + m.name + ' · ' + dLabel + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        mkBtn('attempts_asked', 'Attempts asked', 'Ask attempts') +
        (isTraveling ? mkBtn('gift_told', 'Told it\'s free', 'Tell it\'s a gift (free)') : '') +
      '</div>' +
    '</div>';
  });

  el.innerHTML =
    '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;' +
      'color:' + (allDone ? 'var(--green-text,#16a34a)' : '#ef4444') + ';margin-bottom:10px">' +
      (allDone ? '✅ 1 Week Out — all done!' : '⚡ 1 Week Out — action needed') +
    '</div>' +
    rows.join('');
}

async function toggleMeetFlag(idx, field) {
  const item = _weekOutItems[idx];
  if (!item) return;
  const { a, m } = item;
  const meets = (a.meets || []).map(mx =>
    mx.name === m.name && mx.date === m.date ? { ...mx, [field]: !mx[field] } : mx
  );
  await updateAthlete(a.id, { meets });
}

function renderMeetPage() {
  const wrap = document.getElementById('meet-grid-wrap');
  renderOneWeekOut();

  // ── Stats bar ──────────────────────────────────────────
  const statsEl = document.getElementById('meet-page-stats');
  if (statsEl) {
    const active = athletes.filter(a => a.is_active);
    // Count unique upcoming meets
    const upcomingKeys = new Set();
    active.forEach(a => (a.meets || []).forEach(m => { if (daysDiff(m.date) >= 0) upcomingKeys.add(m.name + '|' + m.date); }));
    const totalMeets = upcomingKeys.size;
    // Handling count
    const handlingCount = myMeets.filter(m => !mmIsPast(m.date)).length;
    // Prep planned: athletes who have at least one upcoming meet and all upcoming meets are prep_planned
    let prepDone = 0, prepTotal = 0;
    active.forEach(a => {
      const upcoming = (a.meets || []).filter(m => daysDiff(m.date) >= 0);
      if (!upcoming.length) return;
      prepTotal++;
      if (upcoming.every(m => m.prep_planned)) prepDone++;
    });
    statsEl.innerHTML =
      '<div class="stat"><div class="stat-label">Upcoming meets</div><div class="stat-val purple">' + totalMeets + '</div></div>' +
      '<div class="stat"><div class="stat-label">Handling</div><div class="stat-val green">' + handlingCount + '</div></div>' +
      '<div class="stat"><div class="stat-label">Prep planned</div><div class="stat-val' + (prepDone === prepTotal && prepTotal > 0 ? ' green' : ' amber') + '">' + prepDone + '<span style="font-size:14px;color:var(--text3);font-weight:400">/' + prepTotal + '</span></div></div>';
  }

  // "Need to ask" banner at the top
  const askWrap = document.getElementById('meet-ask-wrap');
  if (askWrap) {
    const needAsk = athletes.filter(a => a.is_active && a.needs_meet_ask);
    if (needAsk.length) {
      askWrap.style.display = '';
      askWrap.innerHTML =
        '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--amber-text,#b45309);margin-bottom:10px">❓ Need to ask about meets</div>' +
        needAsk.map(a =>
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">' +
            '<div style="display:flex;align-items:center;gap:10px">' +
              '<div class="mini-avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
              '<span style="font-size:14px;font-weight:500;color:var(--text);cursor:pointer" onclick="openModal(\'' + a.id + '\')">' + a.name + '</span>' +
            '</div>' +
            '<button onclick="openModal(\'' + a.id + '\')" style="font-size:11px;padding:3px 12px;border-radius:5px;border:1px solid var(--border2);background:var(--surface2);color:var(--accent);cursor:pointer">+ Add meet</button>' +
          '</div>'
        ).join('');
    } else {
      askWrap.style.display = 'none';
      askWrap.innerHTML = '';
    }
  }

  meetMap = {};
  athletes.filter(a => a.is_active).forEach(a => {
    (a.meets || []).forEach(m => {
      if (daysDiff(m.date) < 0) return;
      const k = m.name + '|' + m.date;
      if (!meetMap[k]) meetMap[k] = { name: m.name, date: m.date, time: m.time, location: '', notes: '', aths: [] };
      meetMap[k].aths.push(a);
      if (m.location && !meetMap[k].location) meetMap[k].location = m.location;
      if (m.notes && !meetMap[k].notes) meetMap[k].notes = m.notes;
    });
  });
  const meets = Object.values(meetMap).sort((a, b) => daysDiff(a.date) - daysDiff(b.date));
  if (!meets.length) {
    wrap.innerHTML = '<div class="empty">No upcoming meets. Open an athlete to add one.</div>';
    return;
  }
  wrap.innerHTML = '<div class="meet-grid">' + meets.map(m => {
    const k = encodeURIComponent(m.name + '|' + m.date);
    const cd = meetCountdown(m.date);
    const handling = myMeets.some(mm => mm.name === m.name && mm.date === m.date);
    return '<div class="meet-card" onclick="openMeetDetail(\'' + k + '\')" style="cursor:pointer">' +
      '<div class="meet-card-top">' +
      '<div><div class="meet-card-name">' + m.name + '</div>' +
      '<div class="meet-card-date">' + fmtDate(m.date, m.time) + '</div>' +
      (m.location ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">📍 ' + m.location + '</div>' : '') +
      (m.notes ? '<div style="font-size:11px;color:var(--blue-text);margin-top:3px;font-weight:500">📝 Read notes</div>' : '') + '</div>' +
      '<div style="text-align:right"><div class="meet-card-cd">' + (cd ? (typeof cd.val === 'string' ? cd.val : cd.val) : '—') + '</div>' +
      '<div class="meet-card-unit">' + (cd && typeof cd.val !== 'string' ? cd.unit + ' out' : '') + '</div>' +
      (handling ? '<div style="font-size:10px;color:var(--green-text);font-weight:600;margin-top:4px">✓ Handling</div>' : '') +
      '</div></div>' +
      '<div class="meet-athletes">' + m.aths.map(a => {
        const athMeet = (a.meets || []).find(mx => mx.name === m.name && mx.date === m.date);
        const prepped = athMeet && athMeet.prep_planned;
        const mName = encodeURIComponent(m.name);
        const mDate = m.date;
        return '<div class="meet-ath-chip" onclick="showMeetAthPopup(event,\'' + a.id + '\',\'' + mName + '\',\'' + mDate + '\')" style="cursor:pointer;border:1px solid ' + (prepped ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.06)') + ';border-radius:20px;padding:2px 8px 2px 2px;user-select:none">' +
          '<div class="mini-avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
          a.name +
          (prepped ? ' <span style="font-size:10px;color:var(--green-text,#16a34a)">✓</span>' : ' <span style="font-size:10px;color:var(--text3)">○</span>') +
        '</div>';
      }).join('') + '</div></div>';
  }).join('') + '</div>';
}

function openMeetDetail(encodedKey) {
  const key = decodeURIComponent(encodedKey);
  const m = meetMap[key];
  if (!m) return;
  const existing = myMeets.find(mm => mm.name === m.name && mm.date === m.date);
  document.getElementById('md-title').textContent = m.name;
  document.getElementById('md-date').textContent = fmtDate(m.date, m.time);
  document.getElementById('md-location').value = m.location || (existing ? existing.city : '');
  document.getElementById('md-notes').value = m.notes || '';
  document.getElementById('md-handling').checked = !!existing;
  document.getElementById('md-athletes').innerHTML = m.aths.map(a =>
    '<div class="meet-ath-chip"><div class="mini-avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' + a.name + '</div>'
  ).join('');
  document.getElementById('md-key').value = encodedKey;
  document.getElementById('meet-detail-modal').classList.add('open');
}

function closeMeetDetail() {
  document.getElementById('meet-detail-modal').classList.remove('open');
}

async function saveMeetDetail() {
  const key = decodeURIComponent(document.getElementById('md-key').value);
  const m = meetMap[key];
  if (!m) return;
  const location = document.getElementById('md-location').value.trim();
  const notes = document.getElementById('md-notes').value.trim();
  const handling = document.getElementById('md-handling').checked;

  // Save location + notes to each athlete's meet entry
  for (const a of m.aths) {
    const meets = (a.meets || []).map(mm =>
      mm.name === m.name && mm.date === m.date ? { ...mm, location, notes } : mm
    );
    athletes = athletes.map(x => x.id === a.id ? { ...x, meets } : x);
    if (sb) await sb.from('athletes').update({ meets }).eq('id', a.id);
  }
  meetMap[key].location = location;
  meetMap[key].notes = notes;

  // Sync with My Meets
  const existing = myMeets.find(mm => mm.name === m.name && mm.date === m.date);
  if (handling && !existing) {
    if (sb) {
      const { data, error } = await sb.from('my_meets').insert({ name: m.name, date: m.date, time: m.time || '', city: location || '' }).select().single();
      if (!error) { myMeets.push(data); myMeets.sort((a, b) => new Date(a.date) - new Date(b.date)); }
      else alert('Error: ' + error.message);
    } else {
      myMeets.push({ id: Date.now(), name: m.name, date: m.date, time: m.time || '', city: location || '' });
    }
  } else if (!handling && existing) {
    myMeets = myMeets.filter(mm => mm.id !== existing.id);
    if (sb) await sb.from('my_meets').delete().eq('id', existing.id);
  } else if (handling && existing && location !== existing.city) {
    existing.city = location;
    if (sb) await sb.from('my_meets').update({ city: location }).eq('id', existing.id);
  }

  closeMeetDetail();
  renderAll();
}

// ── Athlete chip popup ─────────────────────────────────────
let _popupAthId = null, _popupMeetName = null, _popupMeetDate = null;

function showMeetAthPopup(e, athId, meetNameEnc, meetDate) {
  e.stopPropagation();
  const meetName = decodeURIComponent(meetNameEnc);
  _popupAthId = athId; _popupMeetName = meetName; _popupMeetDate = meetDate;

  const a = athletes.find(x => String(x.id) === String(athId));
  if (!a) return;
  const athMeet = (a.meets || []).find(m => m.name === meetName && m.date === meetDate);
  const prepped = !!(athMeet && athMeet.prep_planned);

  const popup = document.getElementById('meet-ath-popup');
  popup.innerHTML =
    '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:12px">' + a.name + '</div>' +
    '<button onclick="togglePrepPlannedById()" style="width:100%;padding:9px 14px;border-radius:7px;border:1px solid ' + (prepped ? 'rgba(74,222,128,0.4)' : 'var(--border2)') + ';background:' + (prepped ? 'rgba(74,222,128,0.1)' : 'var(--surface2)') + ';color:' + (prepped ? 'var(--green-text,#16a34a)' : 'var(--text2)') + ';font-size:13px;font-weight:600;cursor:pointer;text-align:left">' +
    (prepped ? '✓ Prep planned' : '○ Mark prep planned') + '</button>' +
    '<button onclick="openModal(\'' + a.id + '\');closeMeetAthPopup()" style="width:100%;margin-top:8px;padding:7px 14px;border-radius:7px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:12px;cursor:pointer;text-align:left">Open full profile →</button>';

  // Position near click
  const x = Math.min(e.clientX, window.innerWidth - 220);
  const y = Math.min(e.clientY + 8, window.innerHeight - 160);
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
  popup.style.display = 'block';
}

function closeMeetAthPopup() {
  document.getElementById('meet-ath-popup').style.display = 'none';
}

async function togglePrepPlannedById() {
  const a = athletes.find(x => String(x.id) === String(_popupAthId));
  if (!a) return;
  const meets = (a.meets || []).map(m =>
    m.name === _popupMeetName && m.date === _popupMeetDate ? { ...m, prep_planned: !m.prep_planned } : m
  );
  athletes = athletes.map(x => String(x.id) === String(_popupAthId) ? { ...x, meets } : x);
  if (sb) await sb.from('athletes').update({ meets }).eq('id', _popupAthId);
  closeMeetAthPopup();
  renderMeetPage();
}

// Close popup when clicking outside
document.addEventListener('click', function(e) {
  const popup = document.getElementById('meet-ath-popup');
  if (popup && popup.style.display !== 'none' && !popup.contains(e.target)) {
    closeMeetAthPopup();
  }
});
