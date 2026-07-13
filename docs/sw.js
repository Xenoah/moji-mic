const CACHE = "local-transcriber-shell-v5";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const APP_ROOT = `${SCOPE_PATH}/`;
const RUNTIME_ORIGINS = new Set([
  self.location.origin,
  "https://cdn.jsdelivr.net",
]);

function scopedPath(path) {
  return `${SCOPE_PATH}/${path.replace(/^\/+/, "")}`;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(APP_ROOT);
    const html = await response.clone().text();
    await cache.put(APP_ROOT, response);
    const urls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => match[1])
      .filter((url) => url.startsWith("/") && !url.startsWith("//"));
    const shell = [
      scopedPath("manifest.webmanifest"),
      scopedPath("icon-192.png"),
      scopedPath("icon-512.png"),
      ...urls,
    ];
    await Promise.allSettled([...new Set(shell)].map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("local-transcriber-shell-") && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== "GET" || !RUNTIME_ORIGINS.has(requestUrl.origin)) return;
  event.respondWith((async () => {
    if (event.request.mode === "navigate" && requestUrl.origin === self.location.origin) {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(APP_ROOT, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(APP_ROOT)) || Response.error();
      }
    }
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok || response.type === "opaque") {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
