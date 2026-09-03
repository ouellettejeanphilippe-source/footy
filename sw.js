/* Service worker de Guide des Sports.

   Stratégie : réseau d'abord, cache en repli. Le cache sert donc uniquement quand le
   réseau est indisponible ; en ligne, l'utilisateur voit toujours la version déployée.

   Trois défauts corrigés par rapport à la version précédente :

   1. Clé de cache polluée par les paramètres anti-cache. `data/streams.json?t=<horodatage>`
      et `data/schedule.json?t=<horodatage>` changent d'adresse à chaque chargement :
      chaque passage créait une nouvelle entrée (le cache grossissait sans fin) et le
      repli hors ligne ne retrouvait jamais l'entrée précédente, puisque son `t` différait.
      Les requêtes de même origine sont désormais rangées sous leur adresse sans requête.
   2. Seules les requêtes GET aboutissant à une réponse valide sont stockées :
      `cache.put` refuse les autres méthodes et rangeait jusqu'ici les 404.
   3. Le pré-cache ne contenait que `index.html` et `manifest.json`. L'application ayant
      été découpée en modules, il lui manquait hors ligne sa feuille de style et tout son
      code : elle ne pouvait pas démarrer. La coquille complète est maintenant pré-chargée,
      fichier par fichier pour qu'une seule ressource absente ne fasse pas échouer
      l'installation entière. */

const CACHE_NAME = 'sports-guide-v3';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './styles.css',
  './tv.css',
  './js/main.js',
  './js/state.js',
  './js/utils.js',
  './js/fetcher.js',
  './js/config.js',
  './js/db.js',
  './js/teams.js',
  './js/match.js',
  './js/api.js',
  './js/scrapers.js',
  './js/extractors.js',
  './js/ui.js',
  './js/multiview.js',
  './js/tv-navigation.js',
  './data/streams.json',
  './data/schedule.json'
];

/* Adresse de rangement : même origine → on ignore la chaîne de requête, qui ne sert
   qu'à contourner le cache HTTP du navigateur et ferait diverger la clé à chaque appel. */
function cacheKey(request) {
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    url.search = '';
    return new Request(url.toString(), { method: 'GET' });
  }
  return request;
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // addAll échoue en bloc dès qu'une ressource manque : on ajoute une par une.
      Promise.all(APP_SHELL.map(url => cache.add(url).catch(() => null)))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(cacheNames.map(name => (name !== CACHE_NAME ? caches.delete(name) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  const key = cacheKey(request);

  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then(response => {
        // Une 404 ou une réponse opaque ne doit pas remplacer une copie valide.
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(key, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(key).then(hit => hit || caches.match(request)))
  );
});
