/**
 * sw.js — Service Worker de VeritosBusiness
 * Compatible con subcarpeta de GitHub Pages (/Veritosbusiness/)
 */

const CACHE_NAME = 'veritosbusiness-v1';

// La base se calcula desde la ubicación del propio SW
const BASE = self.location.pathname.replace(/\/sw\.js$/, '/');

const CACHE_PATHS = [
  'index.html',
  'manifest.json',
  'css/main.css',
  'js/app.js',
  'js/db.js',
  'js/auth.js',
  'js/ui.js',
  'js/utils/prices.js',
  'js/utils/whatsapp.js',
  'js/utils/backup.js',
  'js/views/dashboard.js',
  'js/views/orders.js',
  'js/views/clients.js',
  'js/views/products.js',
  'js/views/promotions.js',
  'js/views/stats.js',
  'js/views/settings.js',
  'assets/placeholder.png',
];

const CACHE_URLS = CACHE_PATHS.map(p => BASE + p);

// ─── Instalación ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activación ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Interceptar peticiones ───────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match(BASE + 'index.html');
        }
      });
    })
  );
});
