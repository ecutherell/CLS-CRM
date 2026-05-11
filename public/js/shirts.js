const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
let inventoryLocked = true;

function toggleInventoryLock() {
  inventoryLocked = !inventoryLocked;
  renderShirts();
}

function loadShirtInventory() {
  return sGet('shirt_inventory', {});
}

function saveShirtInventory(inv) {
  sSet('shirt_inventory', inv);
}

function adjustInventory(size, delta) {
  const inv = loadShirtInventory();
  inv[size] = Math.max(0, (inv[size] || 0) + delta);
  saveShirtInventory(inv);
  renderShirts();
}

function renderShirts() {
  const active = athletes.filter(a => a.is_active);
  const hasShirt = active.filter(a => a.tshirt);
  const noShirt = active.filter(a => !a.tshirt);
  const onOrder = active.filter(a => a.shirt_note);
  const inv = loadShirtInventory();
  const totalInv = SHIRT_SIZES.reduce((n, s) => n + (inv[s] || 0), 0);

  document.getElementById('shirts-stats').innerHTML =
    '<div class="stat"><div class="stat-label">Have shirt</div><div class="stat-val green">' + hasShirt.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">No shirt</div><div class="stat-val red">' + noShirt.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">On order list</div><div class="stat-val amber">' + onOrder.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">In stock</div><div class="stat-val">' + totalInv + '</div></div>';

  // Roster — no shirt first, then has shirt
  const rosterEl = document.getElementById('shirts-roster');
  if (!active.length) {
    rosterEl.innerHTML = '<div class="dash-empty">No active athletes.</div>';
  } else {
    const sorted = [...noShirt, ...hasShirt];
    rosterEl.innerHTML = sorted.map(a =>
      '<div class="shirt-row">' +
      '<div class="name-wrap" style="flex:1"><div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
      '<div class="athlete-name">' + a.name + '</div></div>' +
      (a.tshirt ? '<span class="pill pill-green">✓ Has shirt</span>' : '<span class="pill pill-gray">No shirt</span>') +
      '</div>'
    ).join('');
  }

  // Inventory
  document.getElementById('shirts-inventory').innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
    '<span style="font-size:12px;color:var(--text3)">' + (inventoryLocked ? '🔒 Locked' : '🔓 Editing') + '</span>' +
    '<button onclick="toggleInventoryLock()" style="font-size:12px;padding:4px 10px;border-radius:var(--radius-sm);border:1px solid var(--border2);background:var(--surface2);color:var(--text2);cursor:pointer">' +
    (inventoryLocked ? 'Edit inventory' : 'Done') + '</button></div>' +
    SHIRT_SIZES.map(s =>
      '<div class="shirt-inv-row">' +
      '<span class="shirt-size-label">' + s + '</span>' +
      '<div class="shirt-inv-controls">' +
      '<button class="inv-btn" ' + (inventoryLocked ? 'disabled style="opacity:0.3;cursor:not-allowed"' : '') + ' onclick="adjustInventory(\'' + s + '\',-1)">−</button>' +
      '<span class="inv-qty">' + (inv[s] || 0) + '</span>' +
      '<button class="inv-btn" ' + (inventoryLocked ? 'disabled style="opacity:0.3;cursor:not-allowed"' : '') + ' onclick="adjustInventory(\'' + s + '\',1)">+</button>' +
      '</div></div>'
    ).join('');

  // Order list
  const orderEl = document.getElementById('shirts-orders');
  orderEl.innerHTML = onOrder.length
    ? onOrder.map(a =>
        '<div class="shirt-row">' +
        '<div class="name-wrap" style="flex:1"><div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
        '<div><div class="athlete-name">' + a.name + '</div>' +
        '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + a.shirt_note + '</div></div></div>' +
        '</div>'
      ).join('')
    : '<div class="dash-empty">No orders noted yet. Add a shirt note in an athlete\'s profile.</div>';

  // To ship out
  const toShipMap = getToShipMap();
  const toShip = active.filter(a => toShipMap[String(a.id)]).sort((a, b) => a.name.localeCompare(b.name));
  const addFormHtml =
    '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">' +
    '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Add athlete to ship list:</div>' +
    '<select id="ship-select" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-size:13px;margin-bottom:6px">' +
    '<option value="">— pick an athlete —</option>' +
    active.filter(a => !toShipMap[String(a.id)]).sort((a,b) => a.name.localeCompare(b.name)).map(a =>
      '<option value="' + a.id + '">' + a.name + '</option>'
    ).join('') +
    '</select>' +
    '<select id="ship-size-select" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-size:13px;margin-bottom:6px">' +
    '<option value="">— shirt size —</option>' +
    SHIRT_SIZES.map(s => '<option value="' + s + '">' + s + '</option>').join('') +
    '</select>' +
    '<button onclick="addToShipList()" style="width:100%;padding:7px;border-radius:6px;border:none;background:var(--accent);color:#fff;font-size:13px;cursor:pointer">Add to ship list</button>' +
    '</div>';

  const shipCount = Object.keys(toShipMap).length;
  const badgeShirts = document.getElementById('badge-shirts');
  if (badgeShirts) { badgeShirts.textContent = shipCount; badgeShirts.style.display = shipCount ? '' : 'none'; }

  const toShipEl = document.getElementById('shirts-toship');
  toShipEl.innerHTML = toShip.length
    ? toShip.map(a => {
        const entry = toShipMap[String(a.id)];
        const size = entry && entry.size ? entry.size : null;
        return '<div class="shirt-row" style="gap:10px">' +
          '<div class="name-wrap" style="flex:1"><div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
          '<div><div class="athlete-name">' + a.name + (size ? ' <span class="pill pill-blue" style="font-size:10px;vertical-align:middle">' + size + '</span>' : '') + '</div>' +
          '</div></div>' +
          '<button onclick="markShirtShipped(\'' + a.id + '\')" style="font-size:11px;padding:4px 10px;border-radius:6px;border:none;background:var(--surface2);color:var(--text2);cursor:pointer;white-space:nowrap;border:1px solid var(--border2)">✓ Shipped</button>' +
          '<button onclick="removeFromShipList(\'' + a.id + '\')" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--text3);cursor:pointer">✕</button>' +
          '</div>';
      }).join('') + addFormHtml
    : '<div class="dash-empty" style="margin-bottom:0">No shirts queued to ship.</div>' + addFormHtml;
}

function getToShipMap() {
  return sGet('shirts_toship', {});
}

function saveToShipMap(map) {
  sSet('shirts_toship', map);
}

function addToShipList() {
  const sel = document.getElementById('ship-select');
  const sizeSel = document.getElementById('ship-size-select');
  if (!sel || !sel.value) return;
  const map = getToShipMap();
  map[String(sel.value)] = { size: sizeSel ? sizeSel.value : '' };
  saveToShipMap(map);
  renderShirts();
}

function removeFromShipList(id) {
  const map = getToShipMap();
  delete map[String(id)];
  saveToShipMap(map);
  renderShirts();
}

function markShirtShipped(id) {
  const a = athletes.find(x => x.id == id) || {};
  if (!confirm('Mark shirt as shipped for ' + a.name + '?')) return;
  const map = getToShipMap();
  const entry = map[String(id)];
  const size = entry && entry.size;
  if (size) {
    const inv = loadShirtInventory();
    inv[size] = Math.max(0, (inv[size] || 0) - 1);
    saveShirtInventory(inv);
  }
  removeFromShipList(id);
  updateAthlete(id, { tshirt: true, shirt_note: null });
}
