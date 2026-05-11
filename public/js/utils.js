function daysDiff(ds) {
  if (!ds) return Infinity;
  const d = new Date(ds);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - TODAY) / 86400000);
}

function getDeadlineDate(a) {
  if (!a.due_date) return null;
  const map = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
  const offset = a.priority_day && map[a.priority_day] !== undefined ? map[a.priority_day] : 6;
  const d = new Date(a.due_date + 'T12:00:00');
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function deadlineHint(a) {
  const dl = getDeadlineDate(a);
  if (!dl) return '';
  const d = Math.round((dl - TODAY) / 86400000);
  if (d < 0) return Math.abs(d) + 'd overdue';
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return 'Due ' + (a.priority_day || 'Sunday') + ' · in ' + d + 'd';
}

function getThisMonday() {
  const d = new Date(TODAY);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStatus(a) {
  if (!a.is_active) return 'churned';
  if (!a.due_date) return 'ok';
  const thisMonday = getThisMonday();
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const dueWeek = new Date(a.due_date + 'T12:00:00');
  if (dueWeek < thisMonday) return 'overdue'; // past week entirely
  if (dueWeek < nextMonday) {
    // this week — only overdue if the deadline day has passed
    const dl = getDeadlineDate(a);
    if (dl && dl < TODAY) return 'overdue';
    return 'due';
  }
  return 'ok';
}

function daysHint(ds) {
  const d = daysDiff(ds);
  if (d === Infinity) return '';
  if (d < 0) return Math.abs(d) + 'd overdue';
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return 'in ' + d + 'd';
}

function meetCountdown(ds) {
  const d = daysDiff(ds);
  if (d === Infinity || d < 0) return null;
  if (d === 0) return { val: 'Today', unit: '' };
  if (d < 7) return { val: d, unit: d === 1 ? 'day' : 'days' };
  if (d < 60) return { val: Math.floor(d / 7), unit: Math.floor(d / 7) === 1 ? 'week' : 'weeks' };
  const m = Math.floor(d / 30.44);
  return { val: m, unit: m === 1 ? 'month' : 'months' };
}

function nextMeet(a) {
  const ms = (a.meets || []).filter(m => daysDiff(m.date) >= 0);
  ms.sort((a, b) => daysDiff(a.date) - daysDiff(b.date));
  return ms[0] || null;
}

function fmtDate(ds, ts) {
  const d = new Date(ds + 'T12:00:00');
  let s = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (ts) {
    const parts = ts.split(':').map(Number);
    s += ' · ' + (parts[0] % 12 || 12) + ':' + String(parts[1]).padStart(2, '0') + ' ' + (parts[0] >= 12 ? 'PM' : 'AM');
  }
  return s;
}

function fmtShort(ds) {
  if (!ds) return '—';
  return new Date(ds + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function tenure(s, e) {
  if (!s) return '—';
  const end = e ? new Date(e + 'T12:00:00') : new Date();
  const mo = Math.round((end - new Date(s + 'T12:00:00')) / (1000 * 60 * 60 * 24 * 30.44));
  if (mo < 1) return '< 1 month';
  if (mo < 12) return mo + 'mo';
  const y = Math.floor(mo / 12), r = mo % 12;
  return r ? y + 'y ' + r + 'mo' : y + 'yr';
}

function avStyle(id) {
  const i = typeof id === 'string' ? (id.charCodeAt(0) + (id.charCodeAt(4) || 0)) % 6 : id % 6;
  return AV[i];
}

function ini(n) {
  return n.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function fmtDay(ds) {
  if (!ds) return '—';
  return new Date(ds + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function pillHTML(s) {
  if (s === 'overdue') return '<span class="pill pill-red">Overdue</span>';
  if (s === 'due') return '<span class="pill pill-amber">Due this week</span>';
  if (s === 'churned') return '<span class="pill pill-gray">Churned</span>';
  return '<span class="pill pill-green">Active</span>';
}
