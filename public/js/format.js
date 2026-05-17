const FORMAT_KEY = 'format_flags';

function getFormatFlags() {
  try {
    const raw = localStorage.getItem(FORMAT_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveFormatFlags(set) {
  localStorage.setItem(FORMAT_KEY, JSON.stringify([...set]));
}

function toggleFormatFlag(id) {
  const flags = getFormatFlags();
  if (flags.has(String(id))) flags.delete(String(id)); else flags.add(String(id));
  saveFormatFlags(flags);
  renderFormatPage();
  updateFormatBadge();
}

function formatSelectAll() {
  const flags = new Set(athletes.filter(a => a.is_active).map(a => String(a.id)));
  saveFormatFlags(flags);
  renderFormatPage();
  updateFormatBadge();
}

function formatClearAll() {
  const flags = getFormatFlags();
  athletes.filter(a => a.is_active).forEach(a => flags.delete(String(a.id)));
  saveFormatFlags(flags);
  renderFormatPage();
  updateFormatBadge();
}

function updateFormatBadge() {
  const count = getFormatFlags().size;
  const b = document.getElementById('badge-format');
  b.textContent = count;
  b.style.display = count ? '' : 'none';
}

function renderFormatPage() {
  const body = document.getElementById('format-body');
  if (!body) return;
  const flags = getFormatFlags();
  const list = [...athletes.filter(a => a.is_active)].sort((a, b) => {
    const af = flags.has(String(a.id)), bf = flags.has(String(b.id));
    if (af !== bf) return af ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  body.innerHTML = list.map(a => {
    const flagged = flags.has(String(a.id));
    return '<tr style="' + (flagged ? '' : 'opacity:0.45') + '">' +
      '<td><input type="checkbox" ' + (flagged ? 'checked' : '') + ' onchange="toggleFormatFlag(\'' + a.id + '\')" style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent)"/></td>' +
      '<td><div class="name-wrap"><div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
      '<div class="athlete-name">' + a.name + '</div></div></td>' +
      '<td style="font-size:13px;color:var(--text2)">' + (a.program ? (a.program.startsWith('http') ? '<a href="' + a.program + '" target="_blank" style="color:var(--blue-text)">Open sheet ↗</a>' : a.program) : '—') + '</td>' +
      '<td>' + (flagged ? '<span class="pill pill-amber" style="font-size:11px">Needs update</span>' : '<span class="pill pill-green" style="font-size:11px">Done</span>') + '</td>' +
      '</tr>';
  }).join('');

  const total = flags.size;
  document.getElementById('format-count').textContent = total + ' athlete' + (total === 1 ? '' : 's') + ' flagged';
  updateFormatBadge();
}
