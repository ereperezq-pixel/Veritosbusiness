/**
 * sw.js — Service Worker de VeritosBusiness
 * Estrategia: Cache First para recursos estáticos, Network First para datos
 */

const CACHE_NAME  = 'veritosbusiness-v1';
const CACHE_URLS  = [
  './index.html',
  './manifest.json',
  './css/main.css',
  './js/app.js',
  './js/db.js',
  './js/auth.js',
  './js/ui.js',
  './js/utils/prices.js',
  './js/utils/whatsapp.js',
  './js/utils/backup.js',
  './js/views/dashboard.js',
  './js/views/orders.js',
  './js/views/clients.js',
  './js/views/products.js',
  './js/views/promotions.js',
  './js/views/stats.js',
  './js/views/settings.js',
  './assets/placeholder.png',
];

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
  // Solo interceptar peticiones GET al mismo origen
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Cache first: si existe en caché, devolver; si no, red
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Guardar en caché si la respuesta es válida
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline: devolver index.html para rutas de navegación
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
