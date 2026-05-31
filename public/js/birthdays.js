// ── Birthday helpers ───────────────────────────────────────

function bdayMMDD() {
  const d = new Date();
  return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function daysUntilBirthday(mmdd) {
  if (!mmdd || !/^\d{2}-\d{2}$/.test(mmdd)) return null;
  const today = new Date();
  const todayClean = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [m, d] = mmdd.split('-').map(Number);
  let bday = new Date(today.getFullYear(), m - 1, d);
  if (bday < todayClean) bday = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((bday - todayClean) / 86400000);
}

function fmtBirthday(mmdd) {
  if (!mmdd) return '—';
  const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [m, d] = mmdd.split('-').map(Number);
  if (!MS[m - 1]) return mmdd;
  return MS[m - 1] + ' ' + d;
}

// ── Badge ──────────────────────────────────────────────────

function updateBirthdayBadge() {
  const today = bdayMMDD();
  const count = athletes.filter(a => a.is_active && a.birthday === today).length;
  const b = document.getElementById('badge-birthdays');
  if (b) { b.textContent = count; b.style.display = count ? '' : 'none'; }
}

// ── Page ───────────────────────────────────────────────────

function renderBirthdaysPage() {
  const statsEl = document.getElementById('bday-stats');
  const listEl  = document.getElementById('bday-list');
  if (!statsEl || !listEl) return;

  const active    = athletes.filter(a => a.is_active);
  const withBday  = active.filter(a => a.birthday);
  const noBday    = active.filter(a => !a.birthday);
  const today     = bdayMMDD();
  const todayBdays = active.filter(a => a.birthday === today);
  const onPhone   = active.filter(a => a.birthday_on_phone);

  statsEl.innerHTML =
    '<div class="stat"><div class="stat-label">Birthday set</div><div class="stat-val green">' + withBday.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Missing</div><div class="stat-val amber">' + noBday.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">🎂 Today</div><div class="stat-val' + (todayBdays.length ? ' red' : '') + '">' + todayBdays.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">📱 On phone</div><div class="stat-val">' + onPhone.length + '</div></div>';

  const sorted = withBday
    .map(a => ({ a, days: daysUntilBirthday(a.birthday) }))
    .filter(x => x.days !== null)
    .sort((a, b) => a.days - b.days);

  let html = '';

  if (sorted.length) {
    html += sorted.map(({ a, days }) => {
      const isToday    = days === 0;
      const isTomorrow = days === 1;
      const isSoon     = days > 1 && days <= 7;

      const rowBg = isToday
        ? 'background:rgba(229,57,53,0.07);border-radius:10px;padding:8px 10px;margin:0 -10px;'
        : '';

      const daysLabel = isToday
        ? '<span style="font-weight:700;color:var(--red-text)">🎂 Today!</span>'
        : isTomorrow
          ? '<span style="color:var(--amber-text);font-weight:600">Tomorrow</span>'
          : isSoon
            ? '<span style="color:var(--amber-text);font-weight:600">In ' + days + ' days</span>'
            : days <= 30
              ? '<span style="color:var(--text2)">In ' + days + ' days</span>'
              : '<span style="color:var(--text3)">' + fmtBirthday(a.birthday) + ' · ' + days + 'd away</span>';

      const phoneStatus = a.birthday_on_phone
        ? '<span style="font-size:12px;color:var(--green-text);white-space:nowrap">📱 ✓</span>'
        : '<button onclick="openModal(\'' + a.id + '\')" title="Open profile to mark as added"'
          + ' style="font-size:11px;padding:3px 9px;border-radius:6px;border:1px dashed var(--border2);background:none;color:var(--text3);cursor:pointer;white-space:nowrap">📱 Add</button>';

      return '<div class="birthday-row" style="' + rowBg + '">' +
        '<div class="name-wrap" style="cursor:pointer" onclick="openModal(\'' + a.id + '\')">' +
          '<div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
          '<div>' +
            '<div class="athlete-name">' + a.name + (isToday ? ' 🎂' : '') + '</div>' +
            '<div style="font-size:12px;color:var(--text3)">' + fmtBirthday(a.birthday) + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0">' +
          daysLabel + phoneStatus +
        '</div>' +
      '</div>';
    }).join('');
  }

  if (noBday.length) {
    html +=
      '<div style="margin-top:1.5rem;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);margin-bottom:8px">' +
      'No birthday set (' + noBday.length + ')</div>' +
      noBday.sort((a, b) => a.name.localeCompare(b.name)).map(a =>
        '<div class="birthday-row" style="opacity:0.5">' +
          '<div class="name-wrap">' +
            '<div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
            '<div class="athlete-name">' + a.name + '</div>' +
          '</div>' +
          '<button onclick="openModal(\'' + a.id + '\')" style="font-size:11px;padding:3px 12px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text2);cursor:pointer;white-space:nowrap">+ Add birthday</button>' +
        '</div>'
      ).join('');
  }

  if (!sorted.length && !noBday.length) {
    html = '<div class="dash-empty">No active athletes yet.</div>';
  }

  listEl.innerHTML = html;
}
