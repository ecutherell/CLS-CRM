function renderTestimonials() {
  const active = athletes.filter(a => a.is_active);
  const done = active.filter(a => a.testimonial);
  const oos = active.filter(a => !a.testimonial && a.out_of_state);
  const pending = active.filter(a => !a.testimonial && !a.out_of_state);

  document.getElementById('testimonials-stats').innerHTML =
    '<div class="stat"><div class="stat-label">Done</div><div class="stat-val green">' + done.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Not yet</div><div class="stat-val red">' + pending.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Out of state</div><div class="stat-val amber">' + oos.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Total active</div><div class="stat-val">' + active.length + '</div></div>';

  function rowHTML(a) {
    return '<div class="shirt-row">' +
      '<div class="name-wrap" style="flex:1"><div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
      '<div class="athlete-name">' + a.name + '</div></div>' +
      '</div>';
  }

  document.getElementById('testimonials-done').innerHTML =
    done.length ? done.map(rowHTML).join('') : '<div class="dash-empty">None yet.</div>';

  document.getElementById('testimonials-pending').innerHTML =
    pending.length ? pending.map(rowHTML).join('') : '<div class="dash-empty">All accounted for!</div>';

  document.getElementById('testimonials-oos').innerHTML =
    oos.length ? oos.map(rowHTML).join('') : '<div class="dash-empty">None.</div>';
}
