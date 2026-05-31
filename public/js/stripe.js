let stripeCustomers = [];
let stripeMonthlyRevenue = {};

function updatePaymentsBadge(pastDueCount) {
  const today = new Date().toISOString().slice(0, 10);
  const unpauseDatesNow = getUnpauseDates();
  const overdueUnpauseCount = stripeCustomers.filter(c =>
    c.subscriptionStatus === 'paused' && unpauseDatesNow[c.id] && unpauseDatesNow[c.id] <= today
  ).length;
  const overdueManualCount = getManualPayers().filter(p =>
    p.nextPaymentDate && p.nextPaymentDate <= today
  ).length;
  // If pastDueCount not passed, calculate it from current stripeCustomers
  if (pastDueCount === undefined) {
    pastDueCount = stripeCustomers.filter(c =>
      c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid'
    ).length;
  }
  const badgeCount = pastDueCount + overdueUnpauseCount + overdueManualCount;
  const bp = document.getElementById('badge-payments');
  if (bp) { bp.textContent = badgeCount; bp.style.display = badgeCount ? '' : 'none'; }
}

function renderStripeStats() {
  const statsEl = document.getElementById('stripe-stats');
  if (!statsEl) return;
  const c = sGet('stripe_last_counts', null);
  if (!c) return;
  // Use live athlete count if available, fall back to cached
  const total = (typeof athletes !== 'undefined' && athletes.length)
    ? athletes.filter(a => a.is_active).length
    : (c.crmActive || (c.activeCount + c.pausedCount + c.pastDueCount));
  const sub = () => '<span style="font-size:14px;color:var(--text3);font-weight:400">/' + total + '</span>';
  const manualOverdue = c.manualOverdue || 0;
  const manualPaused = c.manualPaused != null ? c.manualPaused : (c.manualCount || 0);
  const displayPastDue = c.pastDueCount + manualOverdue;
  const displayPaused = c.pausedCount + manualPaused;
  // Build name lists for manual payer tooltips
  const todayForStats = new Date().toISOString().slice(0, 10);
  const allManual = getManualPayers();
  const manualOverdueNames = allManual
    .filter(p => p.nextPaymentDate && p.nextPaymentDate <= todayForStats)
    .map(p => { const a = athletes.find(x => String(x.id) === String(p.athleteId)); return a ? a.name : null; })
    .filter(Boolean);
  const manualPausedNames = allManual
    .filter(p => !p.nextPaymentDate || p.nextPaymentDate > todayForStats)
    .map(p => { const a = athletes.find(x => String(x.id) === String(p.athleteId)); return a ? a.name : null; })
    .filter(Boolean);

  const manualNote = (n, names) => n > 0
    ? '<span title="' + names.join(', ') + '" style="font-size:11px;color:var(--text3);font-weight:400;cursor:help;border-bottom:1px dotted var(--text3)"> incl. ' + n + ' manual</span>'
    : '';
  const accounted = c.activeCount + displayPaused + displayPastDue;
  const unaccounted = total - accounted;
  const activeAlert = unaccounted > 0
    ? '<div style="font-size:11px;color:var(--amber-text,#b45309);font-weight:600;margin-top:4px">⚠ ' + unaccounted + ' client' + (unaccounted > 1 ? 's' : '') + ' not in Stripe</div>'
    : '';

  statsEl.innerHTML =
    '<div class="stat"><div class="stat-label">Active</div><div class="stat-val green">' + c.activeCount + sub() + '</div>' + activeAlert + '</div>' +
    '<div class="stat"><div class="stat-label">Paused</div><div class="stat-val amber">' + displayPaused + sub() + manualNote(manualPaused, manualPausedNames) + '</div></div>' +
    '<div class="stat"><div class="stat-label">Past due / unpaid</div><div class="stat-val red">' + displayPastDue + sub() + manualNote(manualOverdue, manualOverdueNames) + '</div></div>' +
    (c.missing > 0 ? '<div class="stat"><div class="stat-label">Missing in Stripe</div><div class="stat-val amber">' + c.missing + '</div></div>' : '');
}

// Manual links: { stripeCustomerId: athleteId }
function getStripeLinks() { return sGet('stripe_links', {}); }
function saveStripeLinks(links) { sSet('stripe_links', links); }

// Manual off-Stripe payers: [{ athleteId, lastPaymentDate, nextPaymentDate, note }]
function getManualPayers() { return sGet('stripe_manual', []); }
function saveManualPayers(list) { sSet('stripe_manual', list); }

// Unpause dates: { stripeCustomerId: 'YYYY-MM-DD' }
function getUnpauseDates() { return sGet('stripe_unpause_dates', {}); }
function setUnpauseDate(stripeId, date) {
  const map = getUnpauseDates();
  if (date) { map[stripeId] = date; } else { delete map[stripeId]; }
  sSet('stripe_unpause_dates', map);
  renderStripeTable();
}

function linkStripeCustomer(stripeId, athleteId) {
  const links = getStripeLinks();
  if (athleteId === '') { delete links[stripeId]; } else { links[stripeId] = athleteId; }
  saveStripeLinks(links);
  renderStripeTable();
}

function confirmUnlink(stripeId) {
  if (confirm('Unlink this athlete from the Stripe customer?')) linkStripeCustomer(stripeId, '');
}

function confirmRemoveManual(athleteId) {
  if (confirm('Remove this manual payer?')) removeManualPayer(athleteId);
}

function matchAthleteByName(name) {
  if (!name) return null;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n = norm(name);
  return athletes.find(a => norm(a.name) === n) || null;
}

function getLinkedAthlete(c) {
  const links = getStripeLinks();
  if (links[c.id]) return athletes.find(a => String(a.id) === String(links[c.id])) || null;
  return matchAthleteByName(c.name);
}

async function loadStripeCachedData() {
  try {
    const res = await fetch('/api/stripe/cached');
    if (!res.ok) throw new Error('status ' + res.status);
    const cache = await res.json();
    const customers = Array.isArray(cache) ? cache : (cache.results || []);
    if (customers.length) {
      stripeCustomers = customers;
      renderStripeTable();
      updatePaymentsBadge();
    }
    if (cache.monthlyRevenue) stripeMonthlyRevenue = cache.monthlyRevenue;
    renderStripeStats();
    renderBizMetrics();
    if (cache.recentPayments) renderRecentPayments(cache.recentPayments);
    if (cache.savedAt) {
      const saved = new Date(cache.savedAt);
      const daysSinceRefresh = Math.floor((new Date() - saved) / 86400000);
      const isStale = daysSinceRefresh >= 7;
      const status = document.getElementById('stripe-status');
      if (status && !status.textContent) {
        const timeStr = saved.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' +
          saved.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        status.innerHTML = isStale
          ? '<span style="color:#e53935;font-weight:700;font-size:13px">⚠ Last refresh: ' + timeStr + ' — data may be outdated, refresh now!</span>'
          : '<span style="color:var(--text3);font-size:12px">Last refresh: ' + timeStr + '</span>';
      }
    }
  } catch (e) {
    console.warn('Stripe cache load failed:', e.message);
    renderStripeStats();
  }
}

function renderRecentPayments(payments) {
  const el = document.getElementById('stripe-recent-payments');
  if (!el) return;
  if (!payments || !payments.length) { el.innerHTML = ''; return; }

  el.innerHTML =
    '<div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:12px">💰 Recent Payments</div>' +
    payments.map(p => {
      const linked = stripeCustomers.length ? stripeCustomers.find(c => c.id === p.customerId) : null;
      const athlete = linked ? getLinkedAthlete(linked) : null;
      const displayName = athlete ? athlete.name : p.name;
      const d = new Date(p.date + 'T12:00:00');
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const daysAgo = Math.floor((new Date() - d) / 86400000);
      const agoStr = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo + 'd ago';
      const failed = p.status === 'failed';
      const amountColor = failed ? 'var(--red-text,#e53935)' : 'var(--green-text,#16a34a)';
      const statusBadge = failed ? ' <span style="font-size:10px;font-weight:600;background:rgba(229,57,53,0.12);color:var(--red-text,#e53935);padding:1px 6px;border-radius:4px;vertical-align:middle">Failed</span>' : '';
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border2)">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:500;color:var(--text)">' + displayName + statusBadge + '</div>' +
          '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + dateStr + ' · <span style="color:var(--text2)">' + agoStr + '</span></div>' +
        '</div>' +
        '<div style="font-size:15px;font-weight:700;color:' + amountColor + '">' + (failed ? '-' : '') + '$' + p.amount.toFixed(2) + '</div>' +
      '</div>';
    }).join('');
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date() - new Date(dateStr + 'T12:00:00')) / 86400000);
}

function stripeProgress(pct, label) {
  const bar = document.getElementById('stripe-progress-bar');
  const lbl = document.getElementById('stripe-progress-label');
  const wrap = document.getElementById('stripe-progress-wrap');
  if (wrap) wrap.style.display = pct >= 100 ? 'none' : '';
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = label || '';
}

async function loadStripeData() {
  const btn = document.getElementById('stripe-refresh-btn');
  const status = document.getElementById('stripe-status');
  if (btn) { btn.textContent = '↻ Loading...'; btn.disabled = true; }
  if (status) status.textContent = '';

  stripeProgress(5, 'Connecting to Stripe…');

  // Simulate progress ticks while the server does its paginated fetches
  // Real milestones: customers done ~40%, invoices done ~85%, render ~100%
  const steps = [
    [15, 'Fetching customers…'],
    [30, 'Fetching customers…'],
    [45, 'Fetching invoices…'],
    [60, 'Fetching invoices…'],
    [75, 'Fetching invoices…'],
    [88, 'Building payment map…'],
  ];
  let stepIdx = 0;
  const ticker = setInterval(() => {
    if (stepIdx < steps.length) {
      stripeProgress(...steps[stepIdx]);
      stepIdx++;
    }
  }, 600);

  try {
    const res = await fetch('/api/stripe/customers');
    clearInterval(ticker);
    if (!res.ok) throw new Error('Server error');
    stripeProgress(95, 'Rendering…');
    stripeCustomers = await res.json();
    // Cache displayable customers so table loads instantly next time
    const displayable = stripeCustomers.filter(c =>
      c.subscriptionStatus === 'active' || c.subscriptionStatus === 'paused' ||
      c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid'
    );
    sSet('stripe_customers_cache', displayable);
    renderStripeTable();
    stripeProgress(100, '');
    const activeCount = stripeCustomers.filter(c => c.subscriptionStatus === 'active').length;
    const pausedCount = stripeCustomers.filter(c => c.subscriptionStatus === 'paused').length;
    const pastDueCount = stripeCustomers.filter(c => c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid').length;
    const crmActive = athletes.filter(a => a.is_active).length;
    const manualAll = getManualPayers();
    const manualCount = manualAll.length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const manualOverdue = manualAll.filter(p => p.nextPaymentDate && p.nextPaymentDate <= todayStr).length;
    const manualPaused = manualCount - manualOverdue;
    const missing = crmActive - activeCount - pausedCount - pastDueCount - manualCount;

    // Save counts and render stat cards
    sSet('stripe_last_counts', { activeCount, pausedCount, pastDueCount, manualCount, manualOverdue, manualPaused, missing, crmActive });
    renderStripeStats();

    // Save daily snapshot (one per day, overwrites if same date)
    const todaySnap = new Date().toISOString().slice(0, 10);
    const snapshots = sGet('stripe_snapshots', []).filter(s => s.date !== todaySnap);
    snapshots.push({ date: todaySnap, activeCount, pausedCount, pastDueCount, manualCount });
    snapshots.sort((a, b) => a.date.localeCompare(b.date));
    sSet('stripe_snapshots', snapshots);

    updatePaymentsBadge(pastDueCount);

    // Derive recent payments from customer data (paid + failed)
    const recentPaidDerived = stripeCustomers
      .filter(c => c.lastPaymentDate && c.lastPaymentAmount)
      .sort((a, b) => b.lastPaymentDate.localeCompare(a.lastPaymentDate))
      .slice(0, 5)
      .map(c => ({ date: c.lastPaymentDate, amount: c.lastPaymentAmount, name: c.name, customerId: c.id, status: 'paid' }));
    const recentFailedDerived = stripeCustomers
      .filter(c => c.failedPaymentDate && (c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid'))
      .sort((a, b) => b.failedPaymentDate.localeCompare(a.failedPaymentDate))
      .slice(0, 5)
      .map(c => ({ date: c.failedPaymentDate, amount: c.lastPaymentAmount || 0, name: c.name, customerId: c.id, status: 'failed' }));
    const recentPayments = [...recentPaidDerived, ...recentFailedDerived].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
    renderRecentPayments(recentPayments);

    const visibleCustomers = stripeCustomers.filter(c =>
      c.subscriptionStatus === 'active' || c.subscriptionStatus === 'paused' ||
      c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid'
    );
    const unlinkCount = visibleCustomers.filter(c => !getLinkedAthlete(c)).length;

    if (status) status.innerHTML =
      '<span style="color:var(--green-text);font-weight:600">' + activeCount + ' active</span>' +
      (pausedCount ? ' · <span style="color:var(--amber-text,#b45309);font-weight:600">' + pausedCount + ' paused</span>' : '') +
      (pastDueCount ? ' · <span style="color:var(--red-text);font-weight:600">' + pastDueCount + ' past due / unpaid</span>' : '') +
      (manualCount ? ' · <span style="color:var(--text2);font-weight:600">' + manualCount + ' manual</span>' : '') +
      ' · <span style="color:var(--text3);font-weight:400">' + crmActive + ' active clients in CRM</span>' +
      (missing > 0 ? ' · <span style="color:var(--amber-text);font-weight:600">missing ' + missing + ' in Stripe</span>' : '') +
      (unlinkCount > 0 ? ' · <span style="color:var(--amber-text,#b45309);font-weight:600">⚠ ' + unlinkCount + ' need to link</span>' : '') +
      ' · <span style="color:var(--text3);font-size:11px">refreshed ' + new Date().toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ' at ' + new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) + '</span>';
  } catch (e) {
    clearInterval(ticker);
    stripeProgress(100, '');
    if (status) status.textContent = 'Failed to load Stripe data: ' + e.message;
  }
  if (btn) { btn.textContent = '↻ Refresh'; btn.disabled = false; }
}

function addManualPayer() {
  const athleteId = document.getElementById('manual-athlete-sel').value;
  const lastDate = document.getElementById('manual-last-date').value;
  const nextDate = document.getElementById('manual-next-date').value;
  const note = document.getElementById('manual-note').value.trim();
  if (!athleteId) return;
  const list = getManualPayers().filter(p => String(p.athleteId) !== String(athleteId));
  list.push({ athleteId, lastPaymentDate: lastDate || null, nextPaymentDate: nextDate || null, note });
  saveManualPayers(list);
  renderStripeTable();
  document.getElementById('manual-payer-form').style.display = 'none';
}

function removeManualPayer(athleteId) {
  saveManualPayers(getManualPayers().filter(p => String(p.athleteId) !== String(athleteId)));
  renderStripeTable();
}

function setManualPayerDate(athleteId, field, val) {
  const list = getManualPayers().map(p =>
    String(p.athleteId) === String(athleteId) ? { ...p, [field]: val || null } : p
  );
  saveManualPayers(list);
  renderStripeTable();
}

function renderStripeTable() {
  const body = document.getElementById('stripe-body');
  if (!body) return;

  const activeAthletes = athletes.filter(a => a.is_active).sort((a, b) => a.name.localeCompare(b.name));
  const manualPayers = getManualPayers();
  const unpauseDates = getUnpauseDates();

  function sectionHeader(label) {
    return '<tr><td colspan="5" style="padding:10px 0 4px;font-size:11px;font-weight:700;color:var(--text3);letter-spacing:0.08em;border-bottom:1px solid var(--border2)">' + label + '</td></tr>';
  }

  // Helper: build a Stripe row (past_due or paused or active)
  function buildStripeRow(c) {
    const subStatus = c.subscriptionStatus;
    const isPastDue = subStatus === 'past_due' || subStatus === 'unpaid';
    const isPaused = subStatus === 'paused';
    const linked = getLinkedAthlete(c);
    const links = getStripeLinks();
    const isManualLink = !!links[c.id];
    const isAutoMatch = !isManualLink && !!linked;

    // Status cell
    let statusCell = '';
    if (isPastDue) {
      const days = daysSince(c.failedPaymentDate);
      const attemptsLabel = c.attemptCount && c.attemptCount > 1 ? ' · ' + c.attemptCount + ' attempts' : '';
      statusCell = '<span class="pill pill-red" style="font-size:12px">' +
        (days !== null ? days + 'd past due' : subStatus.replace('_', ' ')) + attemptsLabel + '</span>';
      if (c.attemptCount >= 2) {
        statusCell += '<div style="margin-top:5px"><span style="font-size:12px;font-weight:600;color:var(--amber-text,#b45309);background:rgba(180,83,9,0.12);border:1px solid var(--amber-text,#b45309);border-radius:5px;padding:2px 8px;display:inline-block">💬 DM them</span></div>';
      }
      if (c.nextRetryDate) {
        const retryDays = Math.ceil((new Date(c.nextRetryDate + 'T12:00:00') - new Date()) / 86400000);
        statusCell += '<div style="font-size:11px;color:var(--text3);margin-top:3px">retry ' +
          (retryDays <= 0 ? 'today' : 'in ' + retryDays + 'd') +
          ' · ' + fmtDay(c.nextRetryDate) + '</div>';
      } else {
        statusCell += '<div style="font-size:11px;color:var(--text3);margin-top:3px">no retry scheduled</div>';
      }
    } else if (isPaused) {
      statusCell = '<span class="pill" style="font-size:12px;background:var(--amber-bg,#fff8e1);color:var(--amber-text,#b45309);border:1px solid var(--amber-text,#b45309)">paused</span>';
      // Stripe resume date (set in Stripe dashboard)
      if (c.pausedResumesAt) {
        const resumeDays = Math.ceil((new Date(c.pausedResumesAt + 'T12:00:00') - new Date()) / 86400000);
        statusCell += '<div style="font-size:11px;color:var(--text3);margin-top:4px">auto-resumes ' +
          (resumeDays <= 0 ? 'today' : 'in ' + resumeDays + 'd') +
          ' · ' + fmtDay(c.pausedResumesAt) + '</div>';
      }
      // Manual unpause reminder date
      const unpauseDate = unpauseDates[c.id] || '';
      const unpauseDays = unpauseDate ? Math.ceil((new Date(unpauseDate + 'T12:00:00') - new Date()) / 86400000) : null;
      if (unpauseDate) {
        const isUnpauseOverdue = unpauseDays !== null && unpauseDays <= 0;
        const urgency = isUnpauseOverdue
          ? 'color:var(--red-text,#e53935);font-weight:700'
          : unpauseDays <= 3 ? 'color:var(--amber-text,#b45309);font-weight:600' : 'color:var(--text3)';
        const unpauseLabel = isUnpauseOverdue
          ? (unpauseDays === 0 ? 'today!' : Math.abs(unpauseDays) + 'd ago!')
          : 'in ' + unpauseDays + 'd';
        const unpauseDisplay = isUnpauseOverdue
          ? '<span style="background:rgba(229,57,53,0.12);border:1px solid var(--red-text,#e53935);border-radius:5px;padding:2px 8px;display:inline-block">🔴 unpause ' + unpauseLabel + ' · ' + fmtDay(unpauseDate) + '</span>'
          : '📅 unpause ' + unpauseLabel + ' · ' + fmtDay(unpauseDate);
        statusCell += '<div style="font-size:11px;margin-top:5px;' + urgency + '">' + unpauseDisplay +
          ' <button onclick="setUnpauseDate(\'' + c.id + '\',\'\')" style="font-size:10px;color:var(--text3);background:none;border:none;cursor:pointer;padding:0 0 0 4px">✕</button></div>';
      } else {
        statusCell += '<div style="margin-top:5px"><input type="date" placeholder="Set unpause date" value="" ' +
          'onchange="setUnpauseDate(\'' + c.id + '\',this.value)" ' +
          'style="font-size:11px;padding:3px 6px;border-radius:5px;border:1px dashed var(--border2);background:var(--surface2);color:var(--text2);cursor:pointer"/></div>';
      }
    } else {
      statusCell = '<span class="pill pill-green" style="font-size:12px">active</span>';
    }

    const lastPmt = c.lastPaymentDate
      ? fmtDay(c.lastPaymentDate) + (c.lastPaymentAmount ? ' · $' + c.lastPaymentAmount.toFixed(0) : '')
      : '—';
    const nextPmt = c.nextPaymentDate ? fmtDay(c.nextPaymentDate) : '—';

    let crmCell = '';
    if (linked) {
      crmCell = '<div style="font-size:14px;color:var(--text2);font-weight:500;cursor:pointer" onclick="openModal(\'' + linked.id + '\')">' +
        linked.name + ' <span style="color:var(--blue-text);font-size:12px">' + (isAutoMatch ? '(auto)' : '(linked)') + ' ↗</span></div>' +
        (linked.payment_note ? '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + linked.payment_note + '</div>' : '') +
        '<button onclick="confirmUnlink(\'' + c.id + '\')" style="font-size:11px;color:var(--text3);background:none;border:none;cursor:pointer;padding:0;margin-top:2px">unlink</button>';
    } else {
      crmCell = '<div style="font-size:11px;color:var(--amber-text,#b45309);font-weight:600;margin-bottom:4px">⚠ need to link</div>' +
        '<select onchange="linkStripeCustomer(\'' + c.id + '\',this.value)" style="font-size:12px;padding:3px 6px;border-radius:4px;border:1px solid var(--amber-text,#b45309);background:var(--surface2);color:var(--text2);max-width:160px">' +
        '<option value="">— link athlete —</option>' +
        activeAthletes.map(a => '<option value="' + a.id + '">' + a.name + '</option>').join('') +
        '</select>';
    }

    const rowBg = isPastDue ? 'background:rgba(229,57,53,0.08)' : isPaused ? 'background:rgba(180,83,9,0.06)' : '';
    return '<tr style="' + rowBg + '">' +
      '<td style="font-size:15px;font-weight:' + (isPastDue ? '600' : '500') + '">' + (c.name || '—') + '<div style="font-size:12px;color:var(--text3);font-weight:400;margin-top:2px">' + (c.email || '') + '</div></td>' +
      '<td>' + crmCell + '</td>' +
      '<td style="font-size:14px;color:var(--text2)">' + lastPmt + '</td>' +
      '<td style="font-size:14px;color:var(--text2)">' + nextPmt + '</td>' +
      '<td>' + statusCell + '</td>' +
      '</tr>';
  }

  // Helper: build a manual payer row
  function buildManualRow(p) {
    const a = athletes.find(x => String(x.id) === String(p.athleteId));
    if (!a) return '';
    const daysUntil = p.nextPaymentDate ? Math.floor((new Date(p.nextPaymentDate + 'T12:00:00') - new Date()) / 86400000) : null;
    const isOverdue = daysUntil !== null && daysUntil < 0;
    const isDueSoon = !isOverdue && daysUntil !== null && daysUntil <= 7;

    const rowBg = isOverdue ? 'background:rgba(229,57,53,0.08)' : 'background:rgba(180,83,9,0.06)';

    // Status cell — pill + calendar charge reminder (same style as paused unpause date)
    let statusCell = '<span class="pill" style="font-size:12px;background:var(--amber-bg,#fff8e1);color:var(--amber-text,#b45309);border:1px solid var(--amber-text,#b45309)">manual</span>';
    if (p.nextPaymentDate) {
      const isUrgent = daysUntil !== null && daysUntil <= 1; // today or tomorrow
      const urgency = (isOverdue || isUrgent)
        ? 'color:var(--red-text,#e53935);font-weight:700'
        : isDueSoon ? 'color:var(--amber-text,#b45309);font-weight:600' : 'color:var(--text3)';
      const label = isOverdue
        ? Math.abs(daysUntil) + 'd overdue'
        : daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : 'in ' + daysUntil + 'd';
      const useRedPill = isOverdue || isUrgent;
      const chargeDisplay = useRedPill
        ? '<span style="background:rgba(229,57,53,0.12);border:1px solid var(--red-text,#e53935);border-radius:5px;padding:2px 8px;display:inline-block">🔴 charge ' + label + ' · ' + fmtDay(p.nextPaymentDate) + '</span>'
        : '📅 charge ' + label + ' · ' + fmtDay(p.nextPaymentDate);
      statusCell += '<div style="font-size:11px;margin-top:5px;' + urgency + '">' + chargeDisplay +
        ' <button onclick="setManualPayerDate(\'' + p.athleteId + '\',\'nextPaymentDate\',\'\')" ' +
        'style="font-size:10px;color:var(--text3);background:none;border:none;cursor:pointer;padding:0 0 0 4px">✕</button></div>';
    } else {
      statusCell += '<div style="margin-top:5px"><input type="date" ' +
        'onchange="setManualPayerDate(\'' + p.athleteId + '\',\'nextPaymentDate\',this.value)" ' +
        'style="font-size:11px;padding:3px 6px;border-radius:5px;border:1px dashed var(--border2);background:var(--surface2);color:var(--text2);cursor:pointer"/></div>';
    }

    const dateInputStyle = 'font-size:12px;padding:3px 6px;border-radius:5px;border:1px dashed var(--border2);background:transparent;color:var(--text2);cursor:pointer;width:130px';

    const lastCell = '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">Last paid</div>' +
      '<input type="date" value="' + (p.lastPaymentDate || '') + '" ' +
      'onchange="setManualPayerDate(\'' + p.athleteId + '\',\'lastPaymentDate\',this.value)" ' +
      'style="' + dateInputStyle + '"/>';

    const nextCell = '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">Next billing</div>' +
      '<input type="date" value="' + (p.nextPaymentDate || '') + '" ' +
      'onchange="setManualPayerDate(\'' + p.athleteId + '\',\'nextPaymentDate\',this.value)" ' +
      'style="' + dateInputStyle + '"/>';

    return '<tr style="' + rowBg + '">' +
      '<td style="font-size:15px;font-weight:500">' + a.name + '<div style="font-size:12px;color:var(--text3);font-weight:400;margin-top:2px">' + (p.note || 'manual payment') + '</div></td>' +
      '<td><span style="font-size:14px;color:var(--text2)">' + a.name + ' <span style="color:var(--text3);font-size:12px">(manual)</span></span>' +
      '<br><button onclick="confirmRemoveManual(\'' + p.athleteId + '\')" style="font-size:11px;color:var(--text3);background:none;border:none;cursor:pointer;padding:0;margin-top:2px">remove</button></td>' +
      '<td>' + lastCell + '</td>' +
      '<td>' + nextCell + '</td>' +
      '<td>' + statusCell + '</td>' +
      '</tr>';
  }

  // ── Partition customers ──────────────────────────────────────────
  const pastDueCustomers = stripeCustomers.filter(c =>
    c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid'
  ).sort((a, b) => daysSince(b.failedPaymentDate) - daysSince(a.failedPaymentDate));

  const pausedCustomers = stripeCustomers.filter(c => c.subscriptionStatus === 'paused');

  const activeCustomers = stripeCustomers.filter(c => c.subscriptionStatus === 'active');

  // Sort key for paused/manual: unpause date or next payment date (no date = null)
  const FAR = '9999-12-31';
  const today = new Date().toISOString().slice(0, 10);
  function pausedSortDate(c) { return unpauseDates[c.id] || c.pausedResumesAt || null; }
  function manualSortDate(p) { return p.nextPaymentDate || null; }

  // Rank: 0 = overdue (red), 1 = no date set, 2 = upcoming (yellow)
  function sortRank(dateStr) {
    if (!dateStr) return 1;
    return dateStr <= today ? 0 : 2;
  }

  // All paused/manual items with type + sortDate
  const allPausedManual = [
    ...pausedCustomers.map(c => ({ type: 'stripe', data: c, sortDate: pausedSortDate(c) })),
    ...manualPayers.filter(p => athletes.find(x => String(x.id) === String(p.athleteId)))
                   .map(p => ({ type: 'manual', data: p, sortDate: manualSortDate(p) })),
  ];

  // Split: overdue ones go to PAST DUE, the rest stay in PAUSED/MANUAL
  const overdueFromPausedManual = allPausedManual.filter(item => item.sortDate && item.sortDate <= today);
  const nonOverduePausedManual  = allPausedManual.filter(item => !item.sortDate || item.sortDate > today);

  // Sort overdue: most overdue first
  overdueFromPausedManual.sort((a, b) => (a.sortDate || FAR).localeCompare(b.sortDate || FAR));

  // Sort non-overdue: no date in middle, upcoming by soonest
  nonOverduePausedManual.sort((a, b) => {
    const ra = a.sortDate ? 2 : 1, rb = b.sortDate ? 2 : 1;
    if (ra !== rb) return ra - rb;
    return (a.sortDate || FAR).localeCompare(b.sortDate || FAR);
  });

  // ── Build HTML sections ──────────────────────────────────────────
  const pastDueRows = [
    ...pastDueCustomers.map(c => buildStripeRow(c)),
    ...overdueFromPausedManual.map(item => item.type === 'stripe' ? buildStripeRow(item.data) : buildManualRow(item.data)),
  ];
  const pausedManualRows = nonOverduePausedManual.map(item =>
    item.type === 'stripe' ? buildStripeRow(item.data) : buildManualRow(item.data)
  );
  const activeRows = activeCustomers.map(c => buildStripeRow(c));

  const parts = [];
  if (pastDueRows.length)      parts.push(sectionHeader('PAST DUE / UNPAID'), ...pastDueRows);
  if (pausedManualRows.length) parts.push(sectionHeader('PAUSED / MANUAL'), ...pausedManualRows);
  if (activeRows.length)       parts.push(sectionHeader('ACTIVE'), ...activeRows);

  // Add manual payer form row
  const formRow = '<tr id="manual-payer-form" style="display:none">' +
    '<td colspan="5" style="padding:12px;background:var(--surface2)">' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' +
    '<div><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Athlete</div>' +
    '<select id="manual-athlete-sel" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px">' +
    '<option value="">— pick —</option>' +
    activeAthletes.map(a => '<option value="' + a.id + '">' + a.name + '</option>').join('') +
    '</select></div>' +
    '<div><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Last payment</div>' +
    '<input type="date" id="manual-last-date" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px"/></div>' +
    '<div><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Next payment</div>' +
    '<input type="date" id="manual-next-date" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px"/></div>' +
    '<div style="flex:1"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Note</div>' +
    '<input type="text" id="manual-note" placeholder="e.g. pays on 1st each month" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:13px"/></div>' +
    '<button onclick="addManualPayer()" style="padding:7px 16px;border-radius:6px;border:none;background:var(--accent);color:#fff;font-size:13px;cursor:pointer">Add</button>' +
    '<button onclick="document.getElementById(\'manual-payer-form\').style.display=\'none\'" style="padding:7px 12px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--text2);font-size:13px;cursor:pointer">Cancel</button>' +
    '</div></td></tr>';

  const addRow = '<tr><td colspan="5" style="padding:8px 0">' +
    '<button onclick="document.getElementById(\'manual-payer-form\').style.display=\'\'" style="font-size:12px;color:var(--text3);background:none;border:1px dashed var(--border2);border-radius:6px;padding:6px 14px;cursor:pointer;width:100%">+ Add manual payer</button>' +
    '</td></tr>';

  if (!parts.length) {
    body.innerHTML = '<tr><td colspan="5" style="color:var(--text3);font-size:13px;padding:12px">No data — click Refresh or add a manual payer.</td></tr>' + formRow + addRow;
    return;
  }

  body.innerHTML = parts.join('') + formRow + addRow;
}
