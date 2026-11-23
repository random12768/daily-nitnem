const STATIC = "daily-nitnem-static-v3";   // bump this when the page changes
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(STATIC).then(c => Promise.allSettled(FILES.map(f => c.add(new Request(f, { cache: "reload" }))))));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  // Removes older caches, including the old saved audio, which is no longer used
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== STATIC).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // let YouTube etc. go straight to the network

  // Network first so updates reach her phone; cached copy only when offline
  e.respondWith((async () => {
    const cache = await caches.open(STATIC);
    try {
      const fresh = await fetch(e.request);
      if (fresh.ok) cache.put(e.request, fresh.clone());
      return fresh;
    } catch (err) {
      return (await cache.match(e.request, { ignoreSearch: true })) || (await cache.match("index.html")) || Response.error();
    }
  })());
});
