const CACHE_NAME = 'weatheros-v1';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@400;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[WeatherOS SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[WeatherOS SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[WeatherOS SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Weather API calls: Network first, fall back to cache
// - Everything else: Cache first, fall back to network
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Weather API — always try network first for fresh data
  if (url.hostname === 'api.openweathermap.org' || url.hostname === 'ipapi.co') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache a copy of the fresh response
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline — return cached weather data if available
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            // Return a fallback offline response
            return new Response(
              JSON.stringify({ offline: true, message: 'No internet connection. Showing last known data.' }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If offline and nothing cached, return the app shell
        return caches.match('./index.html');
      });
    })
  );
});

// Listen for skip waiting message from the app
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
