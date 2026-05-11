function calcChurn() {
  const now = new Date();
  const ms = new Date(now.getFullYear(), now.getMonth(), 1);
  const me = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const churned = athletes.filter(a => {
    if (a.is_active || !a.end_date) return false;
    const ed = new Date(a.end_date + 'T12:00:00');
    return ed >= ms && ed <= me;
  }).length;
  const base = athletes.filter(a => a.is_active).length + churned;
  return base === 0 ? null : { rate: churned / base, churned, base };
}

function renderChurnPage() {
  const ch = calcChurn();
  const pct = ch ? Math.round(ch.rate * 100) : 0;
  const big = document.getElementById('churn-rate-big');
  big.textContent = pct + '%';
  big.className = 'churn-rate-big' + (pct === 0 ? ' good' : pct <= 5 ? ' ok' : ' bad');
  document.getElementById('churn-sublabel').textContent = ch
    ? ch.churned + ' left out of ' + ch.base + ' active at start of ' + MONTHS[new Date().getMonth()]
    : 'No data yet — add start dates to clients.';

  const churned = athletes.filter(a => !a.is_active && a.churn_reason);
  const reasons = {};
  churned.forEach(a => { const r = a.churn_reason || 'Unknown'; reasons[r] = (reasons[r] || 0) + 1; });
  const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  const maxR = sorted[0] ? sorted[0][1] : 1;

  document.getElementById('reason-bars').innerHTML = sorted.length
    ? sorted.map(([r, n]) =>
        '<div class="reason-row"><div class="reason-label" title="' + r + '">' + r + '</div>' +
        '<div class="reason-bar-wrap"><div class="reason-bar" style="width:' + Math.round(n / maxR * 100) + '%"></div></div>' +
        '<div class="reason-count">' + n + '</div></div>'
      ).join('')
    : '<div style="font-size:13px;color:var(--text3)">No churn data yet.</div>';

  // Tenure stats
  const allTenures = athletes.filter(a => !a.is_active && a.start_date && a.end_date).map(a =>
    Math.round((new Date(a.end_date + 'T12:00:00') - new Date(a.start_date + 'T12:00:00')) / (1000 * 60 * 60 * 24 * 30.44))
  );
  const withTenure = allTenures.filter(m => m >= 1);
  const needsUpdate = athletes.filter(a => !a.is_active && a.start_date && a.end_date).filter((_, i) => allTenures[i] < 1).length +
    athletes.filter(a => !a.is_active && (!a.start_date || !a.end_date)).length;
  const tenureEl = document.getElementById('churn-tenure-stats');
  if (tenureEl) {
    if (withTenure.length) {
      const avg = Math.round(withTenure.reduce((s, m) => s + m, 0) / withTenure.length);
      const sorted2 = [...withTenure].sort((a, b) => a - b);
      const mid = Math.floor(sorted2.length / 2);
      const median = sorted2.length % 2 ? sorted2[mid] : Math.round((sorted2[mid - 1] + sorted2[mid]) / 2);
      const fmt = m => m < 12 ? m + ' mo' : Math.floor(m / 12) + 'y ' + (m % 12 ? m % 12 + 'mo' : '');
      tenureEl.innerHTML =
        '<div><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text2);margin-bottom:4px">Average tenure</div><div style="font-size:24px;font-weight:700;color:var(--text)">' + fmt(avg) + '</div><div style="font-size:11px;color:var(--text3);margin-top:2px">across ' + withTenure.length + ' churned clients</div></div>' +
        '<div style="width:1px;background:var(--border);margin:0 8px"></div>' +
        '<div><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text2);margin-bottom:4px">Median tenure</div><div style="font-size:24px;font-weight:700;color:var(--text)">' + fmt(median) + '</div><div style="font-size:11px;color:var(--text3);margin-top:2px">half stayed longer, half shorter</div></div>' +
        (needsUpdate ? '<div style="width:1px;background:var(--border);margin:0 8px"></div><div style="display:flex;align-items:center"><div><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--amber-text);margin-bottom:4px">Needs update</div><div style="font-size:24px;font-weight:700;color:var(--amber-text)">' + needsUpdate + '</div><div style="font-size:11px;color:var(--text3);margin-top:2px">athletes missing accurate dates</div></div></div>' : '');
    } else {
      tenureEl.innerHTML = '<div style="font-size:13px;color:var(--text3)">No data yet — add start and end dates to churned clients.</div>';
    }
  }

  const churnedAthletes = athletes.filter(a => !a.is_active);
  const reEnrolled = athletes.filter(a => a.is_active && (a.coaching_periods || []).length > 0);
  const history = [...churnedAthletes, ...reEnrolled].sort((a, b) => {
    const ap = (a.coaching_periods || []);
    const bp = (b.coaching_periods || []);
    const aDate = !a.is_active ? (a.end_date || '0') : (ap.length ? ap[ap.length - 1].end_date || '0' : '0');
    const bDate = !b.is_active ? (b.end_date || '0') : (bp.length ? bp[bp.length - 1].end_date || '0' : '0');
    return new Date(bDate) - new Date(aDate);
  });
  document.getElementById('churn-timeline').innerHTML = history.length
    ? history.map(a => {
        if (!a.is_active) {
          return '<div class="timeline-row tl-clickable" onclick="openChurnAction(\'' + a.id + '\', \'' + a.name.replace(/'/g, "\\'") + '\')">' +
            '<div><div class="tl-name">' + a.name + '</div>' +
            '<div class="tl-meta">' + fmtShort(a.start_date) + ' → ' + fmtShort(a.end_date) + ' · ' + tenure(a.start_date, a.end_date) + '</div></div>' +
            (a.churn_reason ? '<div class="tl-reason">' + a.churn_reason + '</div>' : '<div style="font-size:12px;color:var(--text3)">No reason</div>') +
            '</div>';
        } else {
          const cp = (a.coaching_periods || []);
          const last = cp.length ? cp[cp.length - 1] : null;
          return '<div class="timeline-row tl-clickable" onclick="openModal(\'' + a.id + '\')">' +
            '<div><div class="tl-name">' + a.name + ' <span style="font-size:10px;background:var(--green-text);color:#fff;border-radius:3px;padding:1px 6px;font-weight:600;vertical-align:middle">Re-enrolled</span></div>' +
            '<div class="tl-meta">' + (last ? fmtShort(last.start_date) + ' → ' + fmtShort(last.end_date) + ' · ' + tenure(last.start_date, last.end_date) : '—') + '</div>' +
            '<div style="font-size:11px;color:var(--green-text);margin-top:2px">Back since ' + fmtShort(a.start_date) + '</div></div>' +
            (last && last.churn_reason ? '<div class="tl-reason">' + last.churn_reason + '</div>' : '<div style="font-size:12px;color:var(--text3)">No reason</div>') +
            '</div>';
        }
      }).join('')
    : '<div style="font-size:13px;color:var(--text3);padding:1rem 0">No churned clients yet.</div>';
}

let churnActionId = null;

function openChurnAction(id, name) {
  churnActionId = id;
  document.getElementById('churn-action-name').textContent = name;
  document.getElementById('churn-action-modal').classList.add('open');
}

function closeChurnAction() {
  churnActionId = null;
  document.getElementById('churn-action-modal').classList.remove('open');
}

function editChurnedProfile() {
  const id = churnActionId;
  closeChurnAction();
  openModal(id);
}

function reactivateFromChurn() {
  if (!churnActionId) return;
  const a = athletes.find(x => x.id === churnActionId);
  const periods = [...(a.coaching_periods || []), {
    start_date: a.start_date,
    end_date: a.end_date,
    churn_reason: a.churn_reason,
  }];
  updateAthlete(churnActionId, {
    is_active: true,
    end_date: null,
    churn_reason: null,
    start_date: TODAY.toISOString().slice(0, 10),
    coaching_periods: periods,
  });
  closeChurnAction();
}

async function confirmDeleteForever() {
  if (!churnActionId) return;
  const name = document.getElementById('churn-action-name').textContent;
  const typed = prompt('Type the athlete\'s name to permanently delete them:\n\n"' + name + '"\n\nThis cannot be undone.');
  if (typed === null) return;
  if (typed.trim().toLowerCase() !== name.trim().toLowerCase()) {
    alert('Name didn\'t match — delete cancelled.');
    return;
  }
  const id = churnActionId;
  closeChurnAction();
  athletes = athletes.filter(a => a.id !== id);
  renderAll();
  if (sb) {
    const { error } = await sb.from('athletes').delete().eq('id', id);
    if (error) alert('Delete failed: ' + error.message);
  }
}
