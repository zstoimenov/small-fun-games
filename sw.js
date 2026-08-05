/* Game Box — ONE service worker for the whole app (launcher + every game).      */
/*                                                                                */
/* Strategy: network-first. When you're online, every request goes to the        */
/* network first, so a fresh deploy shows up on the very next refresh. The cache  */
/* is only a fallback, so the app still works offline once it has been loaded.    */
/*                                                                                */
/* The old per-game service workers (robo-rules/, times-table-blaster/) have been */
/* retired to self-unregistering stubs — this root worker now covers them.        */
/* Bump CACHE whenever you want to force old caches to be cleared.                */
const CACHE = "game-box-v18";

const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",

  "./afl-goal-kick/", "./afl-goal-kick/index.html",

  "./robo-rules/", "./robo-rules/index.html", "./robo-rules/style.css", "./robo-rules/app.js",
  "./robo-rules/manifest.webmanifest",
  "./robo-rules/icons/icon-192.png", "./robo-rules/icons/icon-512.png", "./robo-rules/icons/apple-touch-icon.png",

  "./times-table-blaster/", "./times-table-blaster/index.html", "./times-table-blaster/manifest.json",
  "./times-table-blaster/icons/icon-192.png", "./times-table-blaster/icons/icon-512.png",

  "./footy-tactics-lab/", "./footy-tactics-lab/index.html", "./footy-tactics-lab/manifest.webmanifest",
  "./footy-tactics-lab/css/style.css",
  "./footy-tactics-lab/js/levels.js", "./footy-tactics-lab/js/audio.js",
  "./footy-tactics-lab/js/game.js", "./footy-tactics-lab/js/engine.js",
  "./footy-tactics-lab/js/blocks.js", "./footy-tactics-lab/js/app.js",
  "./footy-tactics-lab/icons/icon-192.png", "./footy-tactics-lab/icons/icon-512.png",
  "./footy-tactics-lab/icons/apple-touch-icon.png",

  "./yatzy-dice/", "./yatzy-dice/index.html", "./yatzy-dice/manifest.webmanifest",
  "./yatzy-dice/css/style.css",
  "./yatzy-dice/js/rng.js", "./yatzy-dice/js/rules.js", "./yatzy-dice/js/ai.js",
  "./yatzy-dice/js/audio.js", "./yatzy-dice/js/ui.js", "./yatzy-dice/js/tutorial.js",
  "./yatzy-dice/js/app.js",
  "./yatzy-dice/icons/icon-192.png", "./yatzy-dice/icons/icon-512.png",
  "./yatzy-dice/icons/apple-touch-icon.png",

  "./connect-four/", "./connect-four/index.html", "./connect-four/manifest.webmanifest",
  "./connect-four/css/style.css",
  "./connect-four/js/board.js", "./connect-four/js/ai.js", "./connect-four/js/audio.js",
  "./connect-four/js/ui.js", "./connect-four/js/tutorial.js", "./connect-four/js/app.js",
  "./connect-four/icons/icon-192.png", "./connect-four/icons/icon-512.png",
  "./connect-four/icons/apple-touch-icon.png",

  "./nine-mens-morris/", "./nine-mens-morris/index.html", "./nine-mens-morris/manifest.webmanifest",
  "./nine-mens-morris/css/style.css",
  "./nine-mens-morris/js/rules.js", "./nine-mens-morris/js/ai.js",
  "./nine-mens-morris/js/audio.js", "./nine-mens-morris/js/ui.js",
  "./nine-mens-morris/js/tutorial.js", "./nine-mens-morris/js/app.js",
  "./nine-mens-morris/icons/icon-192.png", "./nine-mens-morris/icons/icon-512.png",
  "./nine-mens-morris/icons/apple-touch-icon.png",

  "./mastermind/", "./mastermind/index.html", "./mastermind/manifest.webmanifest",
  "./mastermind/css/style.css",
  "./mastermind/js/rules.js", "./mastermind/js/ai.js",
  "./mastermind/js/audio.js", "./mastermind/js/ui.js",
  "./mastermind/js/tutorial.js", "./mastermind/js/app.js",
  "./mastermind/icons/icon-192.png", "./mastermind/icons/icon-512.png",
  "./mastermind/icons/apple-touch-icon.png",

  "./battleship/", "./battleship/index.html", "./battleship/manifest.webmanifest",
  "./battleship/css/style.css",
  "./battleship/js/rules.js", "./battleship/js/ai.js",
  "./battleship/js/audio.js", "./battleship/js/ui.js",
  "./battleship/js/tutorial.js", "./battleship/js/app.js",
  "./battleship/icons/icon-192.png", "./battleship/icons/icon-512.png",
  "./battleship/icons/apple-touch-icon.png",

  "./deal-or-no-deal/", "./deal-or-no-deal/index.html", "./deal-or-no-deal/manifest.webmanifest",
  "./deal-or-no-deal/css/style.css",
  "./deal-or-no-deal/js/rng.js", "./deal-or-no-deal/js/rules.js",
  "./deal-or-no-deal/js/banker.js", "./deal-or-no-deal/js/audio.js",
  "./deal-or-no-deal/js/ui.js", "./deal-or-no-deal/js/tutorial.js",
  "./deal-or-no-deal/js/app.js",
  "./deal-or-no-deal/icons/icon-192.png", "./deal-or-no-deal/icons/icon-512.png",
  "./deal-or-no-deal/icons/apple-touch-icon.png",

  "./lemonade-stand/", "./lemonade-stand/index.html", "./lemonade-stand/manifest.webmanifest",
  "./lemonade-stand/css/style.css",
  "./lemonade-stand/js/rng.js", "./lemonade-stand/js/economy.js",
  "./lemonade-stand/js/audio.js", "./lemonade-stand/js/chart.js",
  "./lemonade-stand/js/ui.js", "./lemonade-stand/js/tutorial.js",
  "./lemonade-stand/js/app.js",
  "./lemonade-stand/icons/icon-192.png", "./lemonade-stand/icons/icon-512.png",
  "./lemonade-stand/icons/apple-touch-icon.png",
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
