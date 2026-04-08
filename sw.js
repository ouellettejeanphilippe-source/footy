const CACHE_NAME = 'sports-guide-v2';
const urlsToCache = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only cache same-origin requests like index.html or manifest.json
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      // Use no-cache to force validation with the server, ensuring we get the latest version from GitHub pages.
      fetch(event.request, { cache: 'no-cache' })
        .then(fetchRes => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchRes.clone());
            return fetchRes;
          });
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});
