async function loadMyMeets() {
  if (!sb) {
    try { myMeets = JSON.parse(localStorage.getItem('my_meets') || '[]'); }
    catch { myMeets = []; }
    return;
  }

  // One-time migration from localStorage → Supabase
  if (!localStorage.getItem('meets_migrated')) {
    const local = JSON.parse(localStorage.getItem('my_meets') || '[]');
    if (local.length) {
      const rows = local.map(m => ({ name: m.name, date: m.date, time: m.time || '', city: m.city || '' }));
      await sb.from('my_meets').insert(rows);
    }
    localStorage.setItem('meets_migrated', '1');
  }

  const { data, error } = await sb.from('my_meets').select('*').order('date');
  if (error) { console.error(error); return; }
  myMeets = data || [];
}

function homeCity() {
  return sGet('mm_home', '');
}

function isTravel(city) {
  const home = homeCity().trim().toLowerCase();
  if (!home || !city) return null;
  return city.trim().toLowerCase() !== home;
}

function mmIsPast(ds) {
  return daysDiff(ds) < 0;
}

function mmCountdown(ds) {
  const d = daysDiff(ds);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d < 0) return '';
  if (d < 7) return d + 'd out';
  if (d < 60) return Math.floor(d / 7) + 'wk out';
  return Math.floor(d / 30.44) + 'mo out';
}

async function addMyMeet() {
  const name = document.getElementById('mm-name').value.trim();
  const date = document.getElementById('mm-date').value;
  const time = document.getElementById('mm-time').value;
  const city = document.getElementById('mm-city').value.trim();
  const home = document.getElementById('mm-home').value.trim();
  if (!name || !date) { alert('Enter a meet name and date.'); return; }
  if (home) sSet('mm_home', home);

  if (sb) {
    const { data, error } = await sb.from('my_meets').insert({ name, date, time: time || '', city: city || '' }).select().single();
    if (error) { alert('Error: ' + error.message); return; }
    myMeets.push(data);
    myMeets.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else {
    myMeets.push({ id: Date.now(), name, date, time: time || '', city: city || '' });
    myMeets.sort((a, b) => new Date(a.date) - new Date(b.date));
    localStorage.setItem('my_meets', JSON.stringify(myMeets));
  }

  document.getElementById('mm-name').value = '';
  document.getElementById('mm-date').value = '';
  document.getElementById('mm-time').value = '';
  document.getElementById('mm-city').value = '';
  toggleMMForm(false);
  renderMyMeets();
  updateBadges();
}

async function deleteMyMeet(id) {
  const m = myMeets.find(x => x.id === id);
  if (!confirm('Remove "' + (m ? m.name : 'this meet') + '" from your handling list?')) return;
  myMeets = myMeets.filter(m => m.id !== id);
  renderMyMeets();
  updateBadges();
  if (sb) await sb.from('my_meets').delete().eq('id', id);
  else localStorage.setItem('my_meets', JSON.stringify(myMeets));
}

function toggleMMForm(show) {
  document.getElementById('mm-add-form').style.display = show ? 'flex' : 'none';
  document.getElementById('mm-add-btn').style.display = show ? 'none' : '';
  if (show) {
    document.getElementById('mm-date').value = TODAY.toISOString().slice(0, 10);
    const h = homeCity();
    if (h) document.getElementById('mm-home').value = h;
    setTimeout(function () { document.getElementById('mm-name').focus(); }, 50);
  }
}

function renderMyMeets() {
  const upcoming = myMeets.filter(m => !mmIsPast(m.date));
  const past = myMeets.filter(m => mmIsPast(m.date)).reverse();
  const totalHandled = past.length;
  const traveling = upcoming.filter(m => isTravel(m.city) === true).length;

  document.getElementById('mm-stats').innerHTML =
    '<div class="stat"><div class="stat-label">Upcoming</div><div class="stat-val purple">' + upcoming.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Handled</div><div class="stat-val green">' + totalHandled + '</div></div>' +
    '<div class="stat"><div class="stat-label">Travel meets</div><div class="stat-val blue">' + traveling + '</div></div>';

  const upEl = document.getElementById('mm-upcoming');
  upEl.innerHTML = upcoming.length ? upcoming.map(m => {
    const travel = isTravel(m.city);
    const cityChip = m.city ? '<div class="mm-item-city' + (travel === false ? ' local' : '') + '">' + (travel === true ? '✈️' : '📍') + ' ' + m.city + '</div>' : '';
    return '<div class="mm-item"><div class="mm-item-left"><div class="mm-item-name">' + m.name + '</div>' +
      '<div class="mm-item-meta">' + fmtDate(m.date, m.time) + '</div>' + cityChip + '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">' +
      '<div class="mm-cd">' + mmCountdown(m.date) + '</div>' +
      '<button class="action-btn" onclick="deleteMyMeet(' + m.id + ')" title="Remove">✕</button></div></div>';
  }).join('') : '<div class="dash-empty" style="padding:0.5rem 0">No upcoming meets added yet.</div>';

  const pastEl = document.getElementById('mm-past');
  pastEl.innerHTML = past.length ? past.map(m => {
    const cityChip = m.city ? '<span style="font-size:11px;color:var(--text3);margin-left:4px">· ' + m.city + '</span>' : '';
    return '<div class="mm-item"><div class="mm-item-left">' +
      '<div class="mm-item-name">' + m.name + cityChip + '</div>' +
      '<div class="mm-item-meta">' + fmtDate(m.date, m.time) + '</div></div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">' +
      '<span class="mm-handled">Handled ✓</span>' +
      '<button class="action-btn" onclick="deleteMyMeet(' + m.id + ')" title="Remove">✕</button></div></div>';
  }).join('') : '<div class="dash-empty" style="padding:0.5rem 0">No meets handled yet — they\'ll appear here automatically.</div>';
}
