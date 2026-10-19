const SHELL_CACHE = 'autostudio-shell-v4';
const IMAGE_CACHE = 'autostudio-images-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(['/', '/favicon.svg']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key =>
        (key.startsWith('autostudio-shell-') && key !== SHELL_CACHE) ||
        (key.startsWith('autostudio-images-') && key !== IMAGE_CACHE)
      )
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Images: return a cached copy immediately and refresh it in the background.
  // Opaque responses are allowed so third-party image hosts can be cached too.
  if (request.destination === 'image') {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(request);
      const refresh = fetch(request).then(response => {
        if (response.ok || response.type === 'opaque') {
          cache.put(request, response.clone()).catch(() => undefined);
        }
        return response;
      }).catch(() => cached);
      return cached || refresh;
    })());
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(fetch(request).then(response => {
    if (response.ok && (
      url.pathname === '/' ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.svg')
    )) {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request)));
});
