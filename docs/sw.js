const CACHE_VERSION = 'custard-v5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './calendar.html',
  './forecast-map.html',
  './quiz.html',
  './widget.html',
  './quizzes/engine.js',
  './quizzes/flavor-archetypes.json',
  './quizzes/quiz-classic-v1.json',
  './quizzes/quiz-weather-v1.json',
  './quizzes/quiz-date-night-v1.json',
  './planner-shared.js',
  './cone-renderer.js',
  './style.css',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
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

// Fetch: stale-while-revalidate for static assets, network-first for API/ics
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache non-GET requests, Worker API requests, or .ics data
  if (event.request.method !== 'GET'
    || url.hostname.includes('workers.dev')
    || url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/v1/')
    || url.pathname.endsWith('.ics')) {
    event.respondWith(fetch(event.request));
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
