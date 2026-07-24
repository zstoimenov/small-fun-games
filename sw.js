/* Game Box — ONE service worker for the whole app (launcher + every game).      */
/*                                                                                */
/* Strategy: network-first. When you're online, every request goes to the        */
/* network first, so a fresh deploy shows up on the very next refresh. The cache  */
/* is only a fallback, so the app still works offline once it has been loaded.    */
/*                                                                                */
/* The old per-game service workers (robo-rules/, times-table-blaster/) have been */
/* retired to self-unregistering stubs — this root worker now covers them.        */
/* Bump CACHE whenever you want to force old caches to be cleared.                */
const CACHE = "game-box-v3";

const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",

  "./afl-goal-kick/", "./afl-goal-kick/index.html",

  "./robo-rules/", "./robo-rules/index.html", "./robo-rules/style.css", "./robo-rules/app.js",
  "./robo-rules/manifest.webmanifest",
  "./robo-rules/icons/icon-192.png", "./robo-rules/icons/icon-512.png", "./robo-rules/icons/apple-touch-icon.png",

  "./times-table-blaster/", "./times-table-blaster/index.html", "./times-table-blaster/manifest.json",
  "./times-table-blaster/icons/icon-192.png", "./times-table-blaster/icons/icon-512.png",
];

// Precache fresh copies — cache:"reload" bypasses the HTTP cache so the offline
// fallback is never stale. allSettled means one missing file can't abort install.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(ASSETS.map((u) => c.add(new Request(u, { cache: "reload" }))))
    )
  );
  self.skipWaiting();
});

// On activate, delete every other cache (including the retired per-game ones)
// and take control of open pages immediately.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first with a cache fallback. A successful same-origin response also
// refreshes the cache so the offline copy stays current.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then(
          (hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())
        )
      )
  );
});
