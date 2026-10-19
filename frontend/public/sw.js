// AutoStudio service worker.
// Intentionally does not cache API responses or application pages.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // API requests must always go to the server.
  if (url.pathname.startsWith("/api/")) return;
});
