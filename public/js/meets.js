let meetMap = {};

function renderMeetPage() {
  const wrap = document.getElementById('meet-grid-wrap');
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
      '<div class="meet-athletes">' + m.aths.map(a =>
        '<div class="meet-ath-chip"><div class="mini-avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' + a.name + '</div>'
      ).join('') + '</div></div>';
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
