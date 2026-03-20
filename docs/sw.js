const CACHE_VERSION = 'custard-v22';
const STATIC_ASSETS = [
  './',
  './index.html',
  './forecast-map.html',
  './quiz.html',
  './quizzes/engine.js',
  './quizzes/flavor-archetypes.json',
  './quizzes/quiz-classic-v1.json',
  './quizzes/quiz-weather-v1.json',
  './quizzes/quiz-date-night-v1.json',
  './planner-shared.js',
  './planner-data.js',
  './planner-domain.js',
  './planner-ui.js',
  './shared-nav.js',
  './cone-renderer.js',
  './today-page.js',
  './compare.html',
  './compare-page.js',
  './fun.html',
  './fun-page.js',
  './updates.html',
  './updates-page.js',
  './todays-drive.js',
  './style.css',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './stores.json',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate for cacheable flavor API reads (same-origin only)
var CACHEABLE_API_PREFIXES = [
  '/api/v1/flavors',
  '/api/v1/forecast/',
  '/api/v1/today',
  '/api/v1/flavor-colors',
  '/api/v1/flavor-config'
];

// Location-sensitive API paths that must NEVER be cached (privacy + correctness)
var NEVER_CACHE_API_PATHS = [
  '/api/v1/geolocate',
  '/api/v1/nearby-flavors'
];

function isCacheableApiRequest(requestUrl) {
  if (requestUrl.hostname !== self.location.hostname) return false;
  for (var i = 0; i < NEVER_CACHE_API_PATHS.length; i++) {
    if (requestUrl.pathname.startsWith(NEVER_CACHE_API_PATHS[i])) return false;
  }
  for (var i = 0; i < CACHEABLE_API_PREFIXES.length; i++) {
    if (requestUrl.pathname.startsWith(CACHEABLE_API_PREFIXES[i])) return true;
  }
  return false;
}

// Fetch: stale-while-revalidate for static assets + cacheable API, network-first for other API/ics
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Stale-while-revalidate for flavor API GET requests (must come before the catch-all bypass)
  if (event.request.method === 'GET' && isCacheableApiRequest(url)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        var fetched = fetch(event.request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_VERSION).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(function() { return cached; });
        return cached || fetched;
      })
    );
    return;
  }

  // Never cache: non-GET, workers.dev, non-cacheable API paths, .ics
  if (event.request.method !== 'GET'
    || url.hostname.includes('workers.dev')
    || url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/v1/')
    || url.pathname.endsWith('.ics')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Runtime cache for hero cone PNGs (stale-while-revalidate, not pre-cached)
  if (url.pathname.includes('/assets/cones/') && url.pathname.endsWith('.png')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        var fetched = fetch(event.request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_VERSION).then(function(cache) { cache.put(event.request, clone); });
          }
          return response;
        }).catch(function() { return cached; });
        return cached || fetched;
      })
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetched;
    })
  );
});
