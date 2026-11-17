const CACHE_NAME = "pantryai-hosted-static-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter(key => key.startsWith("pantryai") && key !== CACHE_NAME).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !(url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME), cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
