function renderPayments() {
  // Badge is driven by Stripe past_due count (set in stripe.js)

  const body = document.getElementById('payments-body');
  if (!body) return; // payments-body removed from HTML — nothing to render

  const active = athletes.filter(a => a.is_active);

  function paymentPriority(a) {
    if (!a.next_payment_date && !a.payment_note) return 5; // green (standard, no note)
    const diff = a.next_payment_date ? daysDiff(a.next_payment_date) : null;
    if (diff !== null && diff < 0) return 0;              // red — overdue
    if (diff !== null && diff <= 7) return 1;             // amber — due soon
    if (diff !== null) return 2;                          // grey date — upcoming
    if (a.payment_note) return 3;                         // grey text — note but no date
    return 4;
  }

  const sorted = [...active].sort((a, b) => {
    const pa = paymentPriority(a), pb = paymentPriority(b);
    if (pa !== pb) return pa - pb;
    // within same priority, overdue sorts most overdue first, others alphabetical
    if (pa === 0) return daysDiff(a.next_payment_date) - daysDiff(b.next_payment_date);
    if (pa === 1 || pa === 2) return new Date(a.next_payment_date) - new Date(b.next_payment_date);
    return a.name.localeCompare(b.name);
  });

  body.innerHTML = sorted.map(a => {
    const hasDue = a.next_payment_date;
    const diff = hasDue ? daysDiff(a.next_payment_date) : null;
    const isOverdue = diff !== null && diff < 0;
    const isDueSoon = diff !== null && diff >= 0 && diff <= 7;
    const dueText = hasDue
      ? (isOverdue ? '<span style="color:var(--red-text);font-weight:600">' + Math.abs(diff) + 'd overdue</span>'
        : isDueSoon ? '<span style="color:var(--amber-text);font-weight:600">' + fmtDay(a.next_payment_date) + '</span>'
        : '<span style="color:var(--text2)">' + fmtDay(a.next_payment_date) + '</span>')
      : '<span style="color:var(--text3)">—</span>';
    const rowClass = isOverdue ? 'row-urgent' : a.payment_note ? '' : 'row-ok';
    return '<tr class="' + rowClass + '" onclick="openModal(\'' + a.id + '\')" style="cursor:pointer">' +
      '<td><div class="name-wrap"><div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
      '<div class="athlete-name">' + a.name + '</div></div></td>' +
      '<td style="font-size:13px;color:var(--text2)">' + (a.payment_note || '<span style="color:var(--text3)">Standard subscription</span>') + '</td>' +
      '<td style="font-size:13px">' + dueText + '</td>' +
      '<td></td></tr>';
  }).join('');
}
