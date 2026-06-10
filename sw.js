// CLS CRM — Service Worker
const CACHE = 'cls-crm-v3';

const PRECACHE = [
  'css/styles.css',
  'js/storage.js',
  'js/state.js',
  'js/utils.js',
  'js/app.js',
  'js/supabase-client.js',
  'js/dashboard.js',
  'js/athletes.js',
  'js/meets.js',
  'js/mymeets.js',
  'js/churn.js',
  'js/sales.js',
  'js/payments.js',
  'js/stripe.js',
  'js/bizmetrics.js',
  'js/shirts.js',
  'js/testimonials.js',
  'js/content.js',
  'js/calendar.js',
  'js/calls.js',
  'js/format.js',
  'js/hotleads.js',
  'js/prlog.js',
  'js/prcharts.js',
  'js/davidcall.js',
  'js/officepurchase.js',
  'js/meetweekend.js',
  'js/birthdays.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
];

// Install — pre-cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate — drop old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - HTML navigation requests → always network-first (so refreshes pick up new code)
// - API / Supabase / external → always network
// - Static assets (JS/CSS/images) → cache-first
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network for API, Supabase, external CDNs
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('jsdelivr') ||
    url.hostname.includes('open-meteo') ||
    url.hostname.includes('zippopotam') ||
    url.hostname.includes('stripe')
  ) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Network-first for HTML navigation (index.html) — ensures updates load on refresh
  if (e.request.mode === 'navigate' || e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets (JS/CSS/images)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
