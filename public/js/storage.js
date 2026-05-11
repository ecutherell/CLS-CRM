// Server-backed storage — loads everything at startup into a local cache.
// sGet/sSet are synchronous so existing code needs no async changes.
// Writes are fire-and-forget to /api/data/:key.

let _sc = {}; // server cache

async function loadServerStorage() {
  try {
    const res = await fetch('/api/data/all');
    _sc = (await res.json()) || {};
  } catch { _sc = {}; }
}

function sGet(key, fallback) {
  return key in _sc ? _sc[key] : (fallback !== undefined ? fallback : null);
}

function sSet(key, val) {
  _sc[key] = val;
  fetch('/api/data/' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(val),
  }).catch(() => {});
}
