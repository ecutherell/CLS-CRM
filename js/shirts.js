const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
let inventoryLocked = true;
let rosterCollapsed = true;
let _editingOrderId = null;
let _editingOrderText = '';

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Roster collapse ─────────────────────────────────────────
function toggleRosterCollapse() {
  rosterCollapsed = !rosterCollapsed;
  renderShirts();
}

// ── Order entries (list-based) ──────────────────────────────
function getShirtOrders() {
  // Migrate old single-note format on first use
  const existing = sGet('shirt_orders', null);
  if (existing) return existing;
  const oldNote = sGet('shirt_order_notes', '');
  if (oldNote && oldNote.trim()) {
    const migrated = [{ id: Date.now(), date: new Date().toISOString().slice(0, 10), text: oldNote.trim() }];
    sSet('shirt_orders', migrated);
    return migrated;
  }
  return [];
}

function saveShirtOrders(orders) {
  sSet('shirt_orders', orders);
}

function saveShirtOrderEntry() {
  const ta = document.getElementById('shirt-order-new');
  if (!ta || !ta.value.trim()) return;
  const orders = getShirtOrders();
  orders.unshift({ id: Date.now(), date: new Date().toISOString().slice(0, 10), text: ta.value.trim() });
  saveShirtOrders(orders);
  ta.value = '';
  renderShirts();
}

function editShirtOrder(id) {
  const orders = getShirtOrders();
  const entry = orders.find(o => o.id === id);
  if (!entry) return;
  _editingOrderId = id;
  _editingOrderText = entry.text;
  renderShirts();
  const ta = document.getElementById('shirt-inline-edit-' + id);
  if (ta) ta.focus();
}

function saveShirtOrderInline(id) {
  const ta = document.getElementById('shirt-inline-edit-' + id);
  if (!ta) return;
  const orders = getShirtOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx >= 0) orders[idx].text = ta.value.trim() || orders[idx].text;
  saveShirtOrders(orders);
  _editingOrderId = null;
  _editingOrderText = '';
  renderShirts();
}

function deleteShirtOrder(id) {
  if (!confirm('Delete this order entry?')) return;
  saveShirtOrders(getShirtOrders().filter(o => o.id !== id));
  if (_editingOrderId === id) { _editingOrderId = null; _editingOrderText = ''; }
  renderShirts();
}

function cancelShirtOrderEdit() {
  _editingOrderId = null;
  _editingOrderText = '';
  renderShirts();
}

// ── Inventory ───────────────────────────────────────────────
function toggleInventoryLock() {
  inventoryLocked = !inventoryLocked;
  renderShirts();
}

function loadShirtInventory() { return sGet('shirt_inventory', {}); }
function saveShirtInventory(inv) { sSet('shirt_inventory', inv); }

function adjustInventory(size, delta) {
  const inv = loadShirtInventory();
  inv[size] = Math.max(0, (inv[size] || 0) + delta);
  saveShirtInventory(inv);
  renderShirts();
}

// ── Shirt roster toggle ─────────────────────────────────────
function toggleShirt(id) {
  const a = athletes.find(x => String(x.id) === String(id));
  if (!a) return;
  const msg = a.tshirt ? 'Remove shirt from ' + a.name + '?' : 'Mark ' + a.name + ' as has shirt?';
  if (!confirm(msg)) return;
  updateAthlete(a.id, { tshirt: !a.tshirt });
}

// ── Main render ─────────────────────────────────────────────
function renderShirts() {
  const active = athletes.filter(a => a.is_active);
  const hasShirt = active.filter(a => a.tshirt);
  const noShirt  = active.filter(a => !a.tshirt);
  const onOrder  = active.filter(a => a.shirt_note);
  const inv = loadShirtInventory();
  const totalInv = SHIRT_SIZES.reduce((n, s) => n + (inv[s] || 0), 0);

  document.getElementById('shirts-stats').innerHTML =
    '<div class="stat"><div class="stat-label">Have shirt</div><div class="stat-val green">' + hasShirt.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">No shirt</div><div class="stat-val red">' + noShirt.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">On order list</div><div class="stat-val amber">' + onOrder.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">In stock</div><div class="stat-val">' + totalInv + '</div></div>';

  // Roster — collapsible
  const rosterEl = document.getElementById('shirts-roster');
  const collapseBtn =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
    '<div style="font-size:12px;color:var(--text3)">' +
      (rosterCollapsed
        ? hasShirt.length + ' have shirt · ' + noShirt.length + ' need shirt'
        : active.length + ' athletes') +
    '</div>' +
    '<button onclick="toggleRosterCollapse()" style="font-size:12px;padding:4px 10px;border-radius:var(--radius-sm);border:1px solid var(--border2);background:var(--surface2);color:var(--text2);cursor:pointer">' +
    (rosterCollapsed ? '▾ Show all' : '▴ Collapse') + '</button></div>';

  if (rosterCollapsed) {
    rosterEl.innerHTML = collapseBtn +
      (noShirt.length
        ? '<div style="font-size:12px;color:var(--amber-text);margin-top:4px">Needs shirt: ' +
          noShirt.map(a => a.name).join(', ') + '</div>'
        : '<div style="font-size:12px;color:var(--green-text)">Everyone has a shirt ✓</div>');
  } else {
    const sorted = [...noShirt, ...hasShirt];
    rosterEl.innerHTML = collapseBtn + sorted.map(a =>
      '<div class="shirt-row">' +
      '<div class="name-wrap" style="flex:1"><div class="avatar" style="' + avStyle(a.id) + '">' + ini(a.name) + '</div>' +
      '<div class="athlete-name">' + a.name + '</div></div>' +
      '<button onclick="toggleShirt(\'' + a.id + '\')" style="' +
        'padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;' +
        (a.tshirt
          ? 'background:rgba(76,175,80,0.15);color:var(--green-text);border:1px solid var(--green-text)'
          : 'background:var(--surface2);color:var(--text3);border:1px dashed var(--border2)') +
        '">' + (a.tshirt ? '✓ Has shirt' : '+ Give shirt') + '</button>' +
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
      '<div class="shirt-inv-row"><span class="shirt-size-label">' + s + '</span>' +
      '<div class="shirt-inv-controls">' +
      '<button class="inv-btn" ' + (inventoryLocked ? 'disabled style="opacity:0.3;cursor:not-allowed"' : '') + ' onclick="adjustInventory(\'' + s + '\',-1)">−</button>' +
      '<span class="inv-qty">' + (inv[s] || 0) + '</span>' +
      '<button class="inv-btn" ' + (inventoryLocked ? 'disabled style="opacity:0.3;cursor:not-allowed"' : '') + ' onclick="adjustInventory(\'' + s + '\',1)">+</button>' +
      '</div></div>'
    ).join('');

  // Order list — inline editing per entry, new-entry textarea at bottom
  const orders = getShirtOrders();
  const orderEl = document.getElementById('shirts-orders');

  const entriesHtml = orders.map(o => {
    const d = new Date(o.date + 'T12:00:00');
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const isThis = _editingOrderId === o.id;
    if (isThis) {
      return '<div style="background:var(--surface2);border-radius:8px;padding:12px 14px;margin-bottom:10px">' +
        '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px">' + dateStr + '</div>' +
        '<textarea id="shirt-inline-edit-' + o.id + '" style="width:100%;min-height:90px;padding:8px 10px;border-radius:6px;border:1px solid var(--accent);background:var(--surface);color:var(--text);font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box">' +
        escapeHtml(o.text) + '</textarea>' +
        '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<button onclick="saveShirtOrderInline(' + o.id + ')" style="font-size:12px;padding:4px 14px;border-radius:6px;border:none;background:var(--accent);color:#fff;cursor:pointer">Save</button>' +
        '<button onclick="cancelShirtOrderEdit()" style="font-size:12px;padding:4px 12px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--text3);cursor:pointer">Cancel</button>' +
        '</div></div>';
    }
    const lines = o.text.split('\n').filter(l => l.trim());
    return '<div style="background:var(--surface2);border-radius:8px;padding:12px 14px;margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<div style="font-size:13px;font-weight:600;color:var(--text)">' + dateStr + '</div>' +
      '<div style="display:flex;gap:6px">' +
      '<button onclick="editShirtOrder(' + o.id + ')" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid var(--border2);background:var(--surface);color:var(--text2);cursor:pointer">✎ Edit</button>' +
      '<button onclick="deleteShirtOrder(' + o.id + ')" style="font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--text3);cursor:pointer">🗑</button>' +
      '</div></div>' +
      lines.map(l => '<div style="font-size:13px;color:var(--text2);padding:3px 0;border-bottom:1px solid var(--border)">' + escapeHtml(l.trim()) + '</div>').join('') +
      '</div>';
  }).join('');

  orderEl.innerHTML =
    entriesHtml +
    '<div style="' + (orders.length ? 'border-top:1px solid var(--border);padding-top:12px;margin-top:4px' : '') + '">' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:6px">New order</div>' +
    '<textarea id="shirt-order-new" placeholder="Add order notes…" ' +
    'style="width:100%;min-height:90px;padding:10px;border-radius:var(--radius-sm);border:1px solid var(--border2);' +
    'background:var(--surface2);color:var(--text);font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box"></textarea>' +
    '<div style="margin-top:6px">' +
    '<button onclick="saveShirtOrderEntry()" style="padding:5px 16px;border-radius:var(--radius-sm);border:none;background:var(--accent);color:#fff;font-size:12px;cursor:pointer">Save</button>' +
    '</div></div>';

  const badgeShirts = document.getElementById('badge-shirts');
  if (badgeShirts) badgeShirts.style.display = 'none';
}

function getToShipMap() { return sGet('shirts_toship', {}); }
function saveToShipMap(map) { sSet('shirts_toship', map); }

function markShirtShipped(id) {
  const a = athletes.find(x => x.id == id) || {};
  if (!confirm('Mark shirt as shipped for ' + a.name + '?')) return;
  const map = getToShipMap();
  const size = map[String(id)]?.size;
  if (size) {
    const inv = loadShirtInventory();
    inv[size] = Math.max(0, (inv[size] || 0) - 1);
    saveShirtInventory(inv);
  }
  delete map[String(id)];
  saveToShipMap(map);
  updateAthlete(id, { tshirt: true, shirt_note: null });
}
