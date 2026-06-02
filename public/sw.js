const CACHE_NAME = 'smart-stock-opname-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app-icon.svg',
  '/app-icon-maskable.svg'
];

// Installs and precaches critical files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Cleans up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepts network requests
self.addEventListener('fetch', (event) => {
  // Only cache GET requests and skip tracking, foreign APIs, and database sync endpoints
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Focus only on application assets of the same origin
  if (url.origin === self.location.origin) {
    // Avoid caching Firebase Auth, Firestore standard requests or custom external endpoints
    if (
      url.pathname.includes('/api/') || 
      url.host.includes('firestore') || 
      url.host.includes('firebase')
    ) {
      return;
    }

    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch((err) => {
            console.log('SW fetch failed, using cache if available', err);
            // If offline and request is a navigation, display cached shell index
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });

        // Dynamic Stale-While-Revalidate: Return fast from cache, fetch new in background
        return cachedResponse || fetchPromise;
      })
    );
  }
});
