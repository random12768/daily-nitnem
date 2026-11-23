const STATIC = "daily-nitnem-static-v2";   // bump this when the page changes
const AUDIO = "daily-nitnem-audio";         // kept across updates so the audio isn't re-downloaded
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "khanda-top.png"];

self.addEventListener("install", e => {
  e.waitUntil(Promise.all([
    caches.open(STATIC).then(c => Promise.allSettled(FILES.map(f => c.add(new Request(f, { cache: "reload" }))))),
    caches.open(AUDIO).then(c => c.match("audio.mp3").then(hit => hit || c.add("audio.mp3").catch(() => {})))
  ]));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== STATIC && k !== AUDIO).map(k => caches.delete(k))
  )));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Audio: serve from cache, with Range support (iOS needs it)
  if (url.pathname.endsWith("audio.mp3")) {
    e.respondWith((async () => {
      const cache = await caches.open(AUDIO);
      let res = await cache.match("audio.mp3");
      if (!res) {
        try { res = await fetch("audio.mp3"); if (res.ok) await cache.put("audio.mp3", res.clone()); }
        catch (err) { return new Response("", { status: 504 }); }
      }
      const range = e.request.headers.get("range");
      if (!range) return res;
      const buf = await res.arrayBuffer();
      const m = /bytes=(\d+)-(\d*)/.exec(range);
      const start = Number(m[1]);
      const end = m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
      return new Response(buf.slice(start, end + 1), {
        status: 206,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
          "Content-Length": String(end - start + 1),
          "Accept-Ranges": "bytes"
        }
      });
    })());
    return;
  }

  // Everything else: network first (so updates reach her phone), cache as fallback when offline
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
