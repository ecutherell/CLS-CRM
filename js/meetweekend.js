const MEETWKND_KEY = 'meet_weekend_data';

function loadMeetWkndData() {
  return sGet(MEETWKND_KEY, { meets: [] });
}

function saveMeetWkndData(data) {
  sSet(MEETWKND_KEY, data);
}

const DEFAULT_TEMPLATE = "Hey! Just a heads up — I'll be at a meet this weekend so I won't be available. I'll be back in touch next week!";

let _mwTemplateTimer = null;
function saveMeetWkndTemplate() {
  clearTimeout(_mwTemplateTimer);
  _mwTemplateTimer = setTimeout(() => {
    const el = document.getElementById('meetwknd-template');
    if (!el) return;
    const data = loadMeetWkndData();
    data.template = el.value;
    saveMeetWkndData(data);
  }, 600);
}

function getCurrentMeetWknd() {
  const data = loadMeetWkndData();
  return data.meets && data.meets.length ? data.meets[data.meets.length - 1] : null;
}

function startNewMeetWeekend() {
  const label = prompt('Name this meet (e.g. "June 2026 Meet"):');
  if (!label || !label.trim()) return;
  const data = loadMeetWkndData();
  // Build a checklist from all active athletes
  const active = (athletes || []).filter(a => a.is_active !== false && !a.end_date);
  const checklist = active.map(a => ({
    id: a.id,
    name: a.name,
    phone: a.phone || '',
    messaged: false,
  }));
  data.meets = data.meets || [];
  data.meets.push({ label: label.trim(), date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), checklist });
  saveMeetWkndData(data);
  renderMeetWeekendPage();
}

function toggleMeetWkndMessaged(athleteId) {
  const data = loadMeetWkndData();
  const meet = data.meets && data.meets[data.meets.length - 1];
  if (!meet) return;
  const entry = meet.checklist.find(e => String(e.id) === String(athleteId));
  if (!entry) return;
  entry.messaged = !entry.messaged;
  saveMeetWkndData(data);
  renderMeetWeekendPage();
}

function switchMeetWknd(index) {
  window._meetWkndView = index;
  renderMeetWeekendPage();
}

function renderMeetWeekendPage() {
  const wrap = document.getElementById('meetwknd-body');
  if (!wrap) return;

  const data = loadMeetWkndData();
  const meets = data.meets || [];
  const viewIndex = window._meetWkndView !== undefined ? window._meetWkndView : meets.length - 1;
  const meet = meets[viewIndex];

  // Header with meet selector + new button
  let html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">';
  if (meets.length > 0) {
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    meets.forEach((m, i) => {
      html += '<button onclick="switchMeetWknd(' + i + ')" style="font-size:12px;padding:4px 12px;border-radius:20px;border:1px solid ' + (i === viewIndex ? 'var(--accent)' : 'var(--border2)') + ';background:' + (i === viewIndex ? 'var(--accent)' : 'none') + ';color:' + (i === viewIndex ? '#fff' : 'var(--text2)') + ';cursor:pointer">' + m.label + '</button>';
    });
    html += '</div>';
  } else {
    html += '<div style="color:var(--text3);font-size:13px">No meets yet — start your first one.</div>';
  }
  html += '<button onclick="startNewMeetWeekend()" style="padding:7px 16px;border-radius:var(--radius-sm);border:1px solid var(--accent);background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer">+ New Meet Weekend</button>';
  html += '</div>';

  if (!meet) {
    wrap.innerHTML = html;
    return;
  }

  const checklist = meet.checklist || [];
  const doneCount = checklist.filter(e => e.messaged).length;
  const total = checklist.length;

  // Progress bar
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  html += '<div style="margin-bottom:16px">' +
    '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text3);margin-bottom:6px">' +
      '<span>Messaged <strong style="color:var(--text1)">' + doneCount + ' / ' + total + '</strong> athletes</span>' +
      '<span>' + pct + '%</span>' +
    '</div>' +
    '<div style="height:6px;background:var(--border);border-radius:4px;overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:4px;transition:width 0.3s"></div>' +
    '</div>' +
  '</div>';

  // Message template
  const savedTemplate = data.template || DEFAULT_TEMPLATE;
  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;margin-bottom:16px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
      '<span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text3)">Message template</span>' +
      '<button onclick="navigator.clipboard.writeText(document.getElementById(\'meetwknd-template\').value).then(()=>{this.textContent=\'Copied!\';setTimeout(()=>this.textContent=\'Copy\',1500)})" style="font-size:11px;padding:3px 10px;border-radius:4px;border:1px solid var(--border2);background:none;color:var(--text3);cursor:pointer">Copy</button>' +
    '</div>' +
    '<textarea id="meetwknd-template" oninput="saveMeetWkndTemplate()" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:8px 10px;font-size:13px;color:var(--text1);resize:vertical;font-family:inherit;line-height:1.6">' + escMW(savedTemplate) + '</textarea>' +
  '</div>';

  // Athlete list
  if (!checklist.length) {
    html += '<div class="dash-empty">No athletes on this list.</div>';
  } else {
    // Not messaged first, then messaged
    const sorted = [...checklist].sort((a, b) => a.messaged - b.messaged);
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    sorted.forEach(entry => {
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:var(--radius-sm);border:1px solid ' + (entry.messaged ? 'var(--accent)' : 'var(--border)') + ';background:var(--surface);opacity:' + (entry.messaged ? '0.55' : '1') + '">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:var(--accent-dim, var(--border));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--accent)">' + entry.name.charAt(0).toUpperCase() + '</div>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:600;color:var(--text1);' + (entry.messaged ? 'text-decoration:line-through' : '') + '">' + escMW(entry.name) + '</div>' +
            (entry.phone ? '<div style="font-size:11px;color:var(--text3)">' + escMW(entry.phone) + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<button onclick="toggleMeetWkndMessaged(\'' + entry.id + '\')" style="padding:6px 14px;border-radius:var(--radius-sm);border:1px solid ' + (entry.messaged ? 'var(--accent)' : 'var(--border2)') + ';background:' + (entry.messaged ? 'var(--accent)' : 'none') + ';color:' + (entry.messaged ? '#fff' : 'var(--text2)') + ';font-size:12px;font-weight:600;cursor:pointer">' +
          (entry.messaged ? '✓ Messaged' : 'Mark messaged') +
        '</button>' +
      '</div>';
    });
    html += '</div>';
  }

  wrap.innerHTML = html;
}

function escMW(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
