/**
 * WaterWallet Service Worker
 * Focuses on caching Esri World Imagery map tiles to allow offline access
 * and near-instant load times for the Thane region.
 */

const CACHE_NAME = 'waterwallet-map-tiles-v1';
const ESRI_TILE_DOMAIN = 'server.arcgisonline.com';

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim clients immediately so the page is controlled by the service worker on first load
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept requests directed to the Esri World Imagery tile server
  if (url.hostname === ESRI_TILE_DOMAIN && url.pathname.includes('/MapServer/tile/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // Return the cached tile if found
          if (cachedResponse) {
            return cachedResponse;
          }

          // Otherwise, fetch from network and cache
          return fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                // Store a clone of the response in cache
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch((err) => {
              console.warn('[SW] Offline or network error fetching tile:', url.pathname, err);
              // Fail gracefully
              return new Response('Tile unavailable offline', { status: 404, statusText: 'Offline' });
            });
        });
      })
    );
  }
});
