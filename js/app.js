function updateBadges() {
  const active = athletes.filter(a => a.is_active);
  const due = active.filter(a => getStatus(a) === 'due').length;
  const overdue = active.filter(a => getStatus(a) === 'overdue').length;
  const meetKeys = new Set();
  active.forEach(a => (a.meets || []).filter(m => daysDiff(m.date) >= 0).forEach(m => meetKeys.add(m.name + '|' + m.date)));
  const meets = meetKeys.size;
  const cc = athletes.filter(a => !a.is_active).length;

  const bd = document.getElementById('badge-due');
  bd.textContent = overdue;
  bd.style.display = overdue ? '' : 'none';
  bd.className = 'nav-badge';

  const bm = document.getElementById('badge-meets');
  bm.textContent = meets;
  bm.style.display = meets ? '' : 'none';

  const bc = document.getElementById('badge-churn');
  bc.style.display = 'none';

  updateBirthdayBadge();

  const upcoming = myMeets.filter(m => !mmIsPast(m.date)).length;
  const bmm = document.getElementById('badge-mymeets');
  bmm.textContent = upcoming;
  bmm.style.display = upcoming ? '' : 'none';
}

function renderAll() {
  updateBadges();
  updateFormatBadge();
  renderDashboard();
  renderTable();
  renderMeetPage();
  renderChurnPage();
  renderSalesPage();
  renderMyMeets();
  renderContentPage();
  renderShirts();
  renderTestimonials();
  renderPayments();
  renderBizMetrics();
  renderPlannedCalls();
  renderBirthdaysPage();
}

function goTo(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (window.innerWidth <= 700) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('backdrop').classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('backdrop').classList.toggle('open');
}

const NAV_ITEMS = ['meets','mymeets','youtube','podcast','shortform','sales','payments','churn','bizmetrics','shirts','testimonials','birthdays','calendar'];

function loadNavPrefs() {
  const prefs = sGet('nav_prefs', {});
  NAV_ITEMS.forEach(id => {
    const visible = prefs[id] !== false; // default on
    const btn = document.getElementById('nav-' + id);
    if (btn) btn.style.display = visible ? '' : 'none';
    const cb = document.getElementById('snav-' + id);
    if (cb) cb.checked = visible;
  });
}

function saveNavPrefs() {
  const prefs = {};
  NAV_ITEMS.forEach(id => {
    const cb = document.getElementById('snav-' + id);
    if (cb) prefs[id] = cb.checked;
  });
  sSet('nav_prefs', prefs);
  loadNavPrefs();
}

function updateSbLink() {
  const keys = loadKeys();
  if (keys.url) {
    const match = keys.url.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      document.getElementById('sb-link').href = 'https://supabase.com/dashboard/project/' + match[1];
      return;
    }
  }
  document.getElementById('sb-link').href = 'https://supabase.com/dashboard';
}

function loadPrefs() {
  const zip       = localStorage.getItem('pref_zip') || '';
  const mins      = localStorage.getItem('pref_mins') || 11;
  const goal      = localStorage.getItem('pref_client_goal') || '';
  const rateAmt   = localStorage.getItem('pref_rate_amount') || '';
  const rateWeeks = localStorage.getItem('pref_rate_weeks') || '4';
  const zipEl   = document.getElementById('pref-zip');
  const minsEl  = document.getElementById('pref-mins');
  const goalEl  = document.getElementById('pref-client-goal');
  const rateAmtEl   = document.getElementById('pref-rate-amount');
  const rateWeeksEl = document.getElementById('pref-rate-weeks');
  if (zipEl)   zipEl.value   = zip;
  if (minsEl)  minsEl.value  = mins;
  if (goalEl)  goalEl.value  = goal;
  if (rateAmtEl)   rateAmtEl.value   = rateAmt;
  if (rateWeeksEl) rateWeeksEl.value = rateWeeks;
}

function savePrefs() {
  const zip       = (document.getElementById('pref-zip').value || '').trim();
  const mins      = parseInt(document.getElementById('pref-mins').value) || 11;
  const goal      = parseInt(document.getElementById('pref-client-goal').value) || 0;
  const rateAmt   = parseFloat(document.getElementById('pref-rate-amount').value) || 0;
  const rateWeeks = parseFloat(document.getElementById('pref-rate-weeks').value) || 4;
  if (zip) localStorage.setItem('pref_zip', zip); else localStorage.removeItem('pref_zip');
  localStorage.setItem('pref_mins', mins);
  if (goal)    localStorage.setItem('pref_client_goal', goal);   else localStorage.removeItem('pref_client_goal');
  if (rateAmt) localStorage.setItem('pref_rate_amount', rateAmt); else localStorage.removeItem('pref_rate_amount');
  localStorage.setItem('pref_rate_weeks', rateWeeks);
  fetchWeather();
  renderDashboard();
}

function loadDevNotes() {
  const el = document.getElementById('dev-notes-input');
  if (el) el.value = localStorage.getItem('dev_notes') || '';
}

let _devNoteTimer = null;
function saveDevNotes() {
  const el = document.getElementById('dev-notes-input');
  const status = document.getElementById('dev-notes-status');
  if (!el) return;
  localStorage.setItem('dev_notes', el.value);
  if (status) { status.textContent = '✓ Saved'; setTimeout(() => status.textContent = '', 2000); }
}

function onDevNotesInput() {
  const status = document.getElementById('dev-notes-status');
  if (status) status.textContent = 'Saving…';
  clearTimeout(_devNoteTimer);
  _devNoteTimer = setTimeout(saveDevNotes, 1000);
}

async function loadGitStatus() {
  const el = document.getElementById('git-last-push');
  if (!el) return;
  try {
    const res = await fetch('/api/git-status');
    const json = await res.json();
    if (json.ok) {
      const d = new Date(json.date);
      const when = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
                   ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      el.innerHTML = 'Last push: <strong style="color:var(--text2)">' + when + '</strong>' +
                     ' <span style="color:var(--text3)">· ' + json.message + '</span>';
    } else {
      el.textContent = 'No commits yet';
    }
  } catch { el.textContent = ''; }
}

async function pushToGitHub() {
  const msg = (document.getElementById('git-commit-msg').value.trim()) || 'Update CRM';
  const status = document.getElementById('git-push-status');
  const btn = document.querySelector('#git-push-status').previousElementSibling.querySelector('button');
  status.style.color = 'var(--text3)';
  status.textContent = '⏳ Pushing…';
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/git-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });
    const json = await res.json();
    if (json.ok) {
      status.style.color = 'var(--green-text,#16a34a)';
      status.textContent = '✓ ' + (json.output || 'Pushed successfully.');
      document.getElementById('git-commit-msg').value = '';
      loadGitStatus();
    } else {
      status.style.color = 'var(--red-text,#e53935)';
      status.textContent = '✗ ' + (json.error || 'Push failed.');
    }
  } catch (e) {
    status.style.color = 'var(--red-text,#e53935)';
    status.textContent = '✗ Could not reach server.';
  }
  if (btn) btn.disabled = false;
}

function loadSmsSettings() {
  const settings = sGet('sms_settings', {});
  const cb = document.getElementById('sms-enabled');
  const sel = document.getElementById('sms-hour');
  if (cb) cb.checked = !!settings.enabled;
  if (sel) sel.value = settings.send_hour ?? 8;
}

function saveSmsSettings() {
  const enabled = document.getElementById('sms-enabled').checked;
  const send_hour = parseInt(document.getElementById('sms-hour').value);
  sSet('sms_settings', { enabled, send_hour });
  const status = document.getElementById('sms-status');
  if (status) {
    status.textContent = enabled
      ? '✓ Will text you daily at ' + document.getElementById('sms-hour').options[document.getElementById('sms-hour').selectedIndex].text
      : 'Daily text disabled.';
    status.style.color = enabled ? 'var(--green-text)' : 'var(--text3)';
  }
}

async function sendTestSms() {
  const status = document.getElementById('sms-status');
  if (status) { status.textContent = '⏳ Sending…'; status.style.color = 'var(--text3)'; }
  try {
    const res = await fetch('/api/sms/test', { method: 'POST' });
    const json = await res.json();
    if (json.ok) {
      const parts = [];
      if (json.overdue)     parts.push(json.overdue + ' overdue');
      if (json.dueToday)    parts.push(json.dueToday + ' due today');
      if (json.dueTomorrow) parts.push(json.dueTomorrow + ' due tomorrow');
      if (status) {
        status.textContent = '✓ Sent! ' + (parts.length ? '(' + parts.join(', ') + ')' : '(all clear)');
        status.style.color = 'var(--green-text)';
      }
    } else {
      if (status) { status.textContent = '✗ ' + (json.error || 'Failed'); status.style.color = 'var(--red-text,#e53935)'; }
    }
  } catch {
    if (status) { status.textContent = '✗ Could not reach server'; status.style.color = 'var(--red-text,#e53935)'; }
  }
}

function openSetup() {
  loadNavPrefs();
  loadPrefs();
  updateSbLink();
  loadDevNotes();
  loadSmsSettings();
  // Git push and SMS only work on the local Node server
  const gitEl = document.getElementById('git-section');
  const smsEl = document.getElementById('sms-section');
  if (IS_LOCAL) {
    if (gitEl) gitEl.style.display = '';
    if (smsEl) smsEl.style.display = '';
    loadGitStatus();
  } else {
    if (gitEl) gitEl.style.display = 'none';
    if (smsEl) smsEl.style.display = 'none';
  }
  document.getElementById('setup-overlay').classList.add('open');
}

function closeSetup() {
  document.getElementById('setup-overlay').classList.remove('open');
}

// ── Event listeners ────────────────────────────────────────
document.getElementById('athlete-modal').addEventListener('click', function (e) {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('churn-action-modal').addEventListener('click', function (e) {
  if (e.target === e.currentTarget) closeChurnAction();
});
document.getElementById('meet-detail-modal').addEventListener('click', function (e) {
  if (e.target === e.currentTarget) closeMeetDetail();
});
document.getElementById('setup-overlay').addEventListener('click', function (e) {
  if (e.target === e.currentTarget) closeSetup();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeModal();
    closeSetup();
    if (addOpen) { addOpen = false; renderTable(); }
  }
});

// ── Rich tooltips ──────────────────────────────────────────
const TIP_CONTENT = {
  monthly: [
    { label: 'Elite: 2–4%',      color: '#4caf50' },
    { label: 'Very Good: 5–7%',  color: '#8bc34a' },
    { label: 'Normal: 8–11%',    color: '#ffc107' },
    { label: 'Weak: 12–15%',     color: '#ff7043' },
    { label: 'Problem: 16%+',    color: '#e53935' },
  ],
  lifetime: [
    { label: 'Confirmed — churned clients only. The floor.', color: 'var(--text)' },
    { label: 'Predicted — includes active clients\' tenure so far.', color: 'var(--text2)' },
    { label: 'Real number is between the two.', color: 'var(--text3)' },
  ],
  annual: [
    { label: 'Elite: 15–25%',    color: '#4caf50' },
    { label: 'Good: 26–40%',     color: '#8bc34a' },
    { label: 'Normal: 41–55%',   color: '#ffc107' },
    { label: 'Weak: 56–70%',     color: '#ff7043' },
    { label: 'Problem: 70%+',    color: '#e53935' },
  ],
};

(function () {
  const tip = document.getElementById('rich-tooltip');
  document.addEventListener('mouseover', function (e) {
    const el = e.target.closest('.info-tip[data-tipid]');
    if (!el) return;
    const rows = TIP_CONTENT[el.dataset.tipid];
    if (!rows) return;
    tip.innerHTML = rows.map(r => '<div style="color:' + r.color + '">' + r.label + '</div>').join('');
    tip.style.display = 'block';
  });
  document.addEventListener('mousemove', function (e) {
    if (tip.style.display === 'none') return;
    tip.style.left = (e.clientX - tip.offsetWidth / 2) + 'px';
    tip.style.top = (e.clientY - tip.offsetHeight - 10) + 'px';
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest('.info-tip[data-tipid]')) tip.style.display = 'none';
  });
})();

// ── Weather ────────────────────────────────────────────────
async function fetchWeather() {
  try {
    let lat = 29.757, lon = -95.498, tz = 'America%2FChicago';
    const zip = localStorage.getItem('pref_zip') || '';
    if (zip && /^\d{5}$/.test(zip)) {
      const geo = await fetch('https://api.zippopotam.us/us/' + zip);
      if (geo.ok) {
        const gj = await geo.json();
        lat = parseFloat(gj.places[0].latitude);
        lon = parseFloat(gj.places[0].longitude);
        tz = 'auto';
      }
    }
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=precipitation_sum&timezone=' + tz + '&forecast_days=1');
    const json = await res.json();
    const rain = json.daily && json.daily.precipitation_sum && json.daily.precipitation_sum[0];
    const setPill = (el, rain) => {
      if (!el) return;
      if (rain > 0) { el.textContent = '🌧 Rain'; el.className = 'weather-rain'; }
      else          { el.textContent = '☀️ Clear'; el.className = 'weather-clear'; }
    };
    setPill(document.getElementById('weather-pill'), rain);
    setPill(document.getElementById('mobile-weather-pill'), rain);
  } catch (e) {}
}

// ── Data loading ───────────────────────────────────────────
async function loadAllData() {
  await loadServerStorage();
  await Promise.all([loadAthletes(), loadSalesLog(), loadMyMeets(), loadHotLeads(), loadPrLogs()]);
  renderAll();
  await loadStripeCachedData();
}

// ── Init ───────────────────────────────────────────────────
document.getElementById('date-short').textContent = TODAY.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
fetchWeather();
document.getElementById('dash-greeting').textContent = 'Good ' + (TODAY.getHours() < 12 ? 'morning' : TODAY.getHours() < 17 ? 'afternoon' : 'evening') + ' — here\'s your roster at a glance.';
document.getElementById('log-date').value = TODAY.toISOString().slice(0, 10);

(async () => {
  loadNavPrefs();

  // Pull credentials from server .env first, fall back to localStorage
  let url = '', key = '';
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    if (cfg.url && cfg.key) { url = cfg.url; key = cfg.key; }
  } catch (e) {}

  if (!url || !key) {
    const stored = loadKeys();
    url = stored.url; key = stored.key;
  }

  if (url && key) {
    document.getElementById('input-url').value = url;
    document.getElementById('input-key').value = key;
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);
    initSB(url, key);
  } else {
    await Promise.all([loadSalesLog(), loadMyMeets()]);
    renderAll();
    setTimeout(openSetup, 600);
  }
})();
