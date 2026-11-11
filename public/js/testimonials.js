function getTestimonialStatuses() { return sGet('testimonial_statuses', {}); }
function saveTestimonialStatuses(map) { sSet('testimonial_statuses', map); }

function setTestimonialStatus(id, status) {
  const map = getTestimonialStatuses();
  if (map[String(id)] === status) {
    delete map[String(id)];
  } else {
    map[String(id)] = status;
  }
  saveTestimonialStatuses(map);
  renderTestimonials();
}

function toggleTestimonial(id) {
  const a = athletes.find(x => String(x.id) === String(id));
  if (!a) return;
  if (!a.testimonial) {
    // Clear any pending status when marking done
    const map = getTestimonialStatuses();
    delete map[String(id)];
    saveTestimonialStatuses(map);
  }
  updateAthlete(a.id, { testimonial: !a.testimonial });
}

function renderTestimonials() {
  const active   = athletes.filter(a => a.is_active);
  const statuses = getTestimonialStatuses();
  const done     = active.filter(a => a.testimonial);
  const needAsk  = active.filter(a => !a.testimonial && statuses[String(a.id)] === 'need_to_ask');
  const waitLater = active.filter(a => !a.testimonial && statuses[String(a.id)] === 'wait_later');
  const pending  = active.filter(a => !a.testimonial && !statuses[String(a.id)]);

  document.getElementById('testimonials-stats').innerHTML =
    '<div class="stat"><div class="stat-label">Done</div><div class="stat-val green">' + done.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Need to ask</div><div class="stat-val amber">' + needAsk.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Wait for later</div><div class="stat-val" style="color:var(--text2)">' + waitLater.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Not yet</div><div class="stat-val red">' + pending.length + '</div></div>';

  // Sorted: pending → need_to_ask → wait_later → done
  const sorted = [...pending, ...needAsk, ...waitLater, ...done];
  const rosterEl = document.getElementById('testimonials-roster');
  if (!active.length) {
    rosterEl.innerHTML = '<div class="dash-empty">No active athletes.</div>';
    return;
  }

  rosterEl.innerHTML = sorted.map(a => {
    const isDone      = !!a.testimonial;
    const isNeedAsk   = !isDone && statuses[String(a.id)] === 'need_to_ask';
    const isWaitLater = !isDone && statuses[String(a.id)] === 'wait_later';

    const btnBase = 'padding:5px 12px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;';
    const btnInactive = btnBase + 'background:var(--surface2);color:var(--text3);border:1px dashed var(--border2)';

    const needAskBtn =
      '<button onclick="setTestimonialStatus(\'' + a.id + '\',\'need_to_ask\')" style="' +
      (isNeedAsk
        ? btnBase + 'background:rgba(255,193,7,0.15);color:var(--amber-text,#b45309);border:1px solid var(--amber-text,#b45309)'
        : btnInactive) + '">Need to ask</button>';

    const waitBtn =
      '<button onclick="setTestimonialStatus(\'' + a.id + '\',\'wait_later\')" style="' +
      (isWaitLater
        ? btnBase + 'background:rgba(100,181,246,0.15);color:#64b5f6;border:1px solid #64b5f6'
        : btnInactive) + '">Wait for later</button>';

    const doneBtn =
      '<button onclick="toggleTestimonial(\'' + a.id + '\')" style="' +
      (isDone
        ? btnBase + 'background:rgba(76,175,80,0.15);color:var(--green-text);border:1px solid var(--green-text)'
        : btnInactive) + '">' + (isDone ? '✓ Done' : '+ Mark done') + '</button>';

    return '<div class="shirt-row">' +
      '<div class="name-wrap" style="flex:1"><div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
      '<div class="athlete-name">' + a.name + '</div></div>' +
      '<div style="display:flex;gap:6px">' + needAskBtn + waitBtn + doneBtn + '</div>' +
      '</div>';
  }).join('');
}
