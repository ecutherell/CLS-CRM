// Storage — works on both localhost (Node server) and GitHub Pages (Supabase only).
// sGet/sSet are synchronous against an in-memory cache (_sc).
// On load, cache is filled from Supabase. Writes go to Supabase async + localStorage backup.

const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

let _sc = {};

async function loadServerStorage() {
  // Try local server first (when running locally)
  if (IS_LOCAL) {
    try {
      const res = await fetch('/api/data/all');
      if (res.ok) {
        const json = await res.json();
        _sc = json || {};
        return;
      }
    } catch {}
  }

  // Fall back to Supabase (required for GitHub Pages)
  if (typeof sb !== 'undefined' && sb) {
    try {
      const { data } = await sb.from('app_settings').select('key, value');
      if (data) {
        _sc = {};
        data.forEach(row => { _sc[row.key] = row.value; });
        return;
      }
    } catch {}
  }

  // Last resort: restore from localStorage backups
  _sc = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sc_')) {
        const realKey = k.slice(3);
        try { _sc[realKey] = JSON.parse(localStorage.getItem(k)); } catch {}
      }
    }
  } catch {}
}

function sGet(key, fallback) {
  if (key in _sc) return _sc[key];
  // Try localStorage backup
  try {
    const stored = localStorage.getItem('sc_' + key);
    if (stored !== null) return JSON.parse(stored);
  } catch {}
  return fallback !== undefined ? fallback : null;
}

function sSet(key, val) {
  _sc[key] = val;

  // Always keep a localStorage backup so data survives before Supabase loads
  try { localStorage.setItem('sc_' + key, JSON.stringify(val)); } catch {}

  if (IS_LOCAL) {
    // Write to local server (keeps server-data.json in sync for local use)
    fetch('/api/data/' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(val),
    }).catch(() => {});
  }

  // Always write to Supabase if connected (used on GitHub Pages + syncs local too)
  if (typeof sb !== 'undefined' && sb) {
    sb.from('app_settings').upsert({ key, value: val }).then(() => {}).catch(() => {});
  }
}
