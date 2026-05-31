// ── Google Calendar frontend ───────────────────────────────
let gcalConnected = false;
let gcalEvents = [];

async function initCalendarPage() {
  try {
    const res = await fetch('/api/gcal/status');
    const { connected } = await res.json();
    gcalConnected = connected;
  } catch (e) {
    gcalConnected = false;
  }
  renderCalendarPage();
}

async function gcalConnect() {
  window.open('/api/gcal/auth', '_blank', 'width=500,height=650');
}

async function gcalDisconnect() {
  if (!confirm('Disconnect Google Calendar?')) return;
  await fetch('/api/gcal/disconnect', { method: 'POST' });
  gcalConnected = false;
  gcalEvents = [];
  renderCalendarPage();
}

async function gcalRefresh() {
  if (!gcalConnected) return;
  const btn = document.getElementById('gcal-refresh-btn');
  if (btn) { btn.textContent = '⟳ Refreshing…'; btn.disabled = true; }
  try {
    const res = await fetch('/api/gcal/events');
    if (res.status === 401) { gcalConnected = false; renderCalendarPage(); return; }
    const { events } = await res.json();
    gcalEvents = events || [];
    renderCalendarEvents();
  } catch (e) {}
  if (btn) { btn.textContent = '⟳ Refresh'; btn.disabled = false; }
}

function gcalAfterConnect() {
  // Called when user comes back from auth tab
  gcalConnected = true;
  gcalRefresh();
  renderCalendarPage();
}

// ── Helpers ────────────────────────────────────────────────
function gcalFmtDate(event) {
  const s = event.start;
  if (!s) return '';
  if (s.date) {
    // All-day event
    const d = new Date(s.date + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const d = new Date(s.dateTime);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function gcalDateKey(event) {
  const s = event.start;
  if (!s) return '';
  return s.date || s.dateTime.slice(0, 10);
}

function gcalSortKey(event) {
  const s = event.start;
  if (!s) return '';
  return s.date || s.dateTime;
}

function fmtDateHeader(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  if (dateStr === todayStr) return 'Today — ' + d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  if (dateStr === tomorrowStr) return 'Tomorrow — ' + d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Build CRM events (athlete meets + due dates) for the next 60 days
function getCrmEvents() {
  if (typeof athletes === 'undefined') return [];
  const events = [];
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 60);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Athlete meets
  const meetSeen = new Set();
  athletes.filter(a => a.is_active).forEach(a => {
    (a.meets || []).forEach(m => {
      if (!m.date || m.date < today || m.date > cutoffStr) return;
      const key = m.name + '|' + m.date;
      if (meetSeen.has(key)) return;
      meetSeen.add(key);
      // gather athletes for this meet
      const athlNames = athletes.filter(x => x.is_active && (x.meets || []).some(mx => mx.name === m.name && mx.date === m.date)).map(x => x.name);
      events.push({ type: 'meet', date: m.date, summary: '🏋️ ' + m.name, sub: athlNames.join(', '), id: key });
    });
  });

  // Due dates
  athletes.filter(a => a.is_active && a.due_date && a.due_date >= today && a.due_date <= cutoffStr).forEach(a => {
    events.push({ type: 'due', date: a.due_date, summary: '📋 Program due — ' + a.name, sub: a.program ? (a.program.startsWith('http') ? 'Has sheet' : a.program) : '', id: 'due-' + a.id });
  });

  return events;
}

// ── Render ─────────────────────────────────────────────────
function renderCalendarPage() {
  const wrap = document.getElementById('gcal-wrap');
  if (!wrap) return;

  if (!gcalConnected) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div style="font-size:48px;margin-bottom:16px">📅</div>
        <h2 style="margin:0 0 10px;font-size:20px;color:var(--text)">Connect Google Calendar</h2>
        <p style="color:var(--text2);font-size:14px;margin:0 0 28px;max-width:380px;margin-left:auto;margin-right:auto">
          See your Google Calendar events alongside athlete meet dates and program due dates — all in one place.
        </p>
        <button onclick="gcalConnect()" style="padding:12px 28px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">
          Connect Google Calendar
        </button>
        <div style="margin-top:16px">
          <button onclick="gcalCheckConnected()" style="background:none;border:none;color:var(--text3);font-size:12px;cursor:pointer;text-decoration:underline">
            Already connected? Click to reload
          </button>
        </div>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:13px;color:var(--green-text);font-weight:600">✓ Connected</span>
        <button id="gcal-refresh-btn" onclick="gcalRefresh()" style="font-size:12px;padding:5px 14px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text2);cursor:pointer">⟳ Refresh</button>
        <button onclick="gcalDisconnect()" style="font-size:12px;padding:5px 14px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--red-text,#e53935);cursor:pointer">Disconnect</button>
      </div>
      <button onclick="gcalOpenAdd()" style="padding:8px 18px;background:var(--accent);color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer">+ Add Event</button>
    </div>

    <!-- Add event form (hidden by default) -->
    <div id="gcal-add-form" style="display:none;background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:18px;margin-bottom:20px">
      <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:14px">New Event</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div style="grid-column:1/-1">
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Title *</label>
          <input id="gcal-title" placeholder="Event title" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Date *</label>
          <input id="gcal-date" type="date" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">
            <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="gcal-allday" onchange="gcalToggleAllDay(this)" checked> All day
            </label>
          </label>
        </div>
        <div id="gcal-time-fields" style="display:none;grid-column:1/-1;display:none;gap:12px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Start time</label>
              <input id="gcal-start" type="time" value="09:00" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">End time</label>
              <input id="gcal-end" type="time" value="10:00" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box">
            </div>
          </div>
        </div>
        <div style="grid-column:1/-1">
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Notes (optional)</label>
          <input id="gcal-desc" placeholder="Optional description" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box">
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="gcalSubmitAdd()" style="padding:8px 20px;background:var(--accent);color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">Save to Google Calendar</button>
        <button onclick="gcalCloseAdd()" style="padding:8px 16px;background:none;border:1px solid var(--border2);border-radius:6px;font-size:13px;color:var(--text2);cursor:pointer">Cancel</button>
      </div>
    </div>

    <!-- Legend -->
    <div style="display:flex;gap:16px;margin-bottom:18px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2)">
        <div style="width:10px;height:10px;border-radius:50%;background:var(--accent)"></div> Google Calendar
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2)">
        <div style="width:10px;height:10px;border-radius:50%;background:var(--purple-text,#9c27b0)"></div> Athlete meets
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2)">
        <div style="width:10px;height:10px;border-radius:50%;background:var(--amber-text,#b45309)"></div> Program due dates
      </div>
    </div>

    <div id="gcal-events-list"><div style="font-size:13px;color:var(--text3);padding:20px 0">Loading events…</div></div>`;

  gcalRefresh();
}

function renderCalendarEvents() {
  const list = document.getElementById('gcal-events-list');
  if (!list) return;

  const today = new Date().toISOString().slice(0, 10);

  // Merge Google events + CRM events
  const crmEvts = getCrmEvents();
  const allEvts = [
    ...gcalEvents.map(e => ({ source: 'google', date: gcalDateKey(e), sortKey: gcalSortKey(e), title: e.summary || '(No title)', sub: gcalFmtTime(e), id: e.id, gcalEvent: e })),
    ...crmEvts.map(e => ({ source: e.type, date: e.date, sortKey: e.date, title: e.summary, sub: e.sub, id: e.id })),
  ].filter(e => e.date >= today).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  if (!allEvts.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:20px 0">No upcoming events in the next 60 days.</div>';
    return;
  }

  // Group by date
  const grouped = {};
  allEvts.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });

  list.innerHTML = Object.keys(grouped).sort().map(date => {
    const isToday = date === today;
    const headerStyle = isToday
      ? 'font-size:13px;font-weight:700;color:var(--accent);margin:20px 0 8px'
      : 'font-size:13px;font-weight:600;color:var(--text2);margin:20px 0 8px';

    const rows = grouped[date].map(e => {
      const dotColor = e.source === 'google' ? 'var(--accent)' : e.source === 'meet' ? 'var(--purple-text,#9c27b0)' : 'var(--amber-text,#b45309)';
      const deleteBtn = e.source === 'google'
        ? `<button onclick="gcalDeleteEvent('${e.id}')" title="Delete" style="margin-left:8px;background:none;border:none;color:var(--text3);font-size:13px;cursor:pointer;padding:2px 5px;border-radius:4px" onmouseover="this.style.color='var(--red-text,#e53935)'" onmouseout="this.style.color='var(--text3)'">✕</button>`
        : '';
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div style="margin-top:5px;flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${dotColor}"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;color:var(--text);font-weight:500">${e.title}${deleteBtn}</div>
          ${e.sub ? `<div style="font-size:12px;color:var(--text3);margin-top:2px">${e.sub}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div style="${headerStyle}">${fmtDateHeader(date)}${isToday ? ' 🔵' : ''}</div>${rows}`;
  }).join('');
}

function gcalFmtTime(event) {
  const s = event.start;
  if (!s) return '';
  if (s.date) return 'All day';
  const d = new Date(s.dateTime);
  const e = event.end && event.end.dateTime ? new Date(event.end.dateTime) : null;
  const start = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const end = e ? e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  return end ? start + ' – ' + end : start;
}

// ── Add event form ─────────────────────────────────────────
function gcalOpenAdd() {
  const form = document.getElementById('gcal-add-form');
  if (!form) return;
  form.style.display = 'block';
  const dateEl = document.getElementById('gcal-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
  document.getElementById('gcal-title').focus();
}

function gcalCloseAdd() {
  const form = document.getElementById('gcal-add-form');
  if (form) form.style.display = 'none';
}

function gcalToggleAllDay(cb) {
  const tf = document.getElementById('gcal-time-fields');
  if (tf) tf.style.display = cb.checked ? 'none' : 'block';
}

async function gcalSubmitAdd() {
  const title = (document.getElementById('gcal-title').value || '').trim();
  const date = document.getElementById('gcal-date').value;
  const allDay = document.getElementById('gcal-allday').checked;
  const startTime = document.getElementById('gcal-start').value;
  const endTime = document.getElementById('gcal-end').value;
  const desc = (document.getElementById('gcal-desc').value || '').trim();

  if (!title || !date) { alert('Title and date are required.'); return; }

  const btn = document.querySelector('#gcal-add-form button');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  try {
    const res = await fetch('/api/gcal/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: title, description: desc, date, startTime, endTime, allDay }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    gcalCloseAdd();
    document.getElementById('gcal-title').value = '';
    document.getElementById('gcal-date').value = '';
    document.getElementById('gcal-desc').value = '';
    await gcalRefresh();
  } catch (e) {
    alert('Error: ' + e.message);
  }

  if (btn) { btn.textContent = 'Save to Google Calendar'; btn.disabled = false; }
}

async function gcalDeleteEvent(id) {
  if (!confirm('Delete this event from Google Calendar?')) return;
  try {
    await fetch('/api/gcal/events/' + id, { method: 'DELETE' });
    gcalEvents = gcalEvents.filter(e => e.id !== id);
    renderCalendarEvents();
  } catch (e) {
    alert('Error deleting event');
  }
}

// Called by the "Already connected? Click to reload" button
async function gcalCheckConnected() {
  await initCalendarPage();
}
