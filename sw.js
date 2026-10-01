/* Game Box — ONE service worker for the whole app (launcher + every game).      */
/*                                                                                */
/* Strategy: network-first. When you're online, every request goes to the        */
/* network first, so a fresh deploy shows up on the very next refresh. The cache  */
/* is only a fallback, so the app still works offline once it has been loaded.    */
/*                                                                                */
/* The old per-game service workers (robo-rules/, times-table-blaster/) have been */
/* retired to self-unregistering stubs — this root worker now covers them.        */
/* Bump CACHE whenever you want to force old caches to be cleared.                */
const CACHE = "game-box-v67";

const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
  "./games.js", "./shared/screen.css",

  "./little-city/", "./little-city/index.html", "./little-city/manifest.webmanifest",
  "./little-city/css/style.css",
  "./little-city/js/sim.js", "./little-city/js/audio.js", "./little-city/js/map.js", "./little-city/js/mayor.js", "./little-city/js/mayor-ui.js",
  "./little-city/js/levels.js", "./little-city/js/lesson.js", "./little-city/js/studio.js",
  "./little-city/js/ui.js", "./little-city/js/app.js",
  "./little-city/icons/icon-192.png", "./little-city/icons/icon-512.png",
  "./little-city/icons/apple-touch-icon.png",

  "./story-builder/", "./story-builder/index.html", "./story-builder/manifest.webmanifest",
  "./story-builder/css/style.css",
  "./story-builder/js/words.js", "./story-builder/js/audio.js", "./story-builder/js/writer.js",
  "./story-builder/js/levels.js", "./story-builder/js/lesson.js", "./story-builder/js/studio.js",
  "./story-builder/js/ui.js", "./story-builder/js/app.js",
  "./story-builder/icons/icon-192.png", "./story-builder/icons/icon-512.png",
  "./story-builder/icons/apple-touch-icon.png",

  "./comic-studio/", "./comic-studio/index.html", "./comic-studio/manifest.webmanifest",
  "./comic-studio/css/style.css",
  "./comic-studio/js/art.js", "./comic-studio/js/comic.js", "./comic-studio/js/levels.js",
  "./comic-studio/js/audio.js", "./comic-studio/js/lesson.js", "./comic-studio/js/studio.js",
  "./comic-studio/js/ui.js", "./comic-studio/js/app.js",
  "./comic-studio/icons/icon-192.png", "./comic-studio/icons/icon-512.png",
  "./comic-studio/icons/apple-touch-icon.png",

  "./design-studio/", "./design-studio/index.html", "./design-studio/manifest.webmanifest",
  "./design-studio/css/style.css",
  "./design-studio/js/colour.js", "./design-studio/js/levels.js", "./design-studio/js/audio.js",
  "./design-studio/js/mixer.js", "./design-studio/js/poster.js", "./design-studio/js/lesson.js",
  "./design-studio/js/studio.js", "./design-studio/js/ui.js", "./design-studio/js/app.js",
  "./design-studio/icons/icon-192.png", "./design-studio/icons/icon-512.png",
  "./design-studio/icons/apple-touch-icon.png",

  "./music-studio/", "./music-studio/index.html", "./music-studio/manifest.webmanifest",
  "./music-studio/css/style.css",
  "./music-studio/js/levels.js", "./music-studio/js/audio.js", "./music-studio/js/grid.js",
  "./music-studio/js/lesson.js", "./music-studio/js/studio.js", "./music-studio/js/ui.js",
  "./music-studio/js/app.js",
  "./music-studio/icons/icon-192.png", "./music-studio/icons/icon-512.png",
  "./music-studio/icons/apple-touch-icon.png",

  "./career-compass/", "./career-compass/index.html", "./career-compass/manifest.webmanifest",
  "./career-compass/css/style.css",
  "./career-compass/js/areas.js", "./career-compass/js/score.js", "./career-compass/js/audio.js",
  "./career-compass/js/ui.js", "./career-compass/js/app.js",
  "./career-compass/icons/icon-192.png", "./career-compass/icons/icon-512.png",
  "./career-compass/icons/apple-touch-icon.png",

  "./bulgarian-bukvar/", "./bulgarian-bukvar/index.html", "./bulgarian-bukvar/manifest.webmanifest",
  "./bulgarian-bukvar/css/style.css",
  "./bulgarian-bukvar/js/letters.js", "./bulgarian-bukvar/js/missions.js", "./bulgarian-bukvar/js/rules.js",
  "./bulgarian-bukvar/js/cards.js", "./bulgarian-bukvar/js/quiz.js",
  "./bulgarian-bukvar/js/ui.js", "./bulgarian-bukvar/js/app.js",
  "./bulgarian-bukvar/icons/icon-192.png", "./bulgarian-bukvar/icons/icon-512.png",
  "./bulgarian-bukvar/icons/apple-touch-icon.png",

  "./afl-goal-kick/", "./afl-goal-kick/index.html", "./afl-goal-kick/css/style.css",
  "./afl-goal-kick/js/rules.js", "./afl-goal-kick/js/audio.js", "./afl-goal-kick/js/figures.js",
  "./afl-goal-kick/js/scene.js", "./afl-goal-kick/js/hud.js", "./afl-goal-kick/js/app.js",

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

  "./bank-boss/", "./bank-boss/index.html", "./bank-boss/manifest.webmanifest",
  "./bank-boss/css/style.css",
  "./bank-boss/js/rng.js", "./bank-boss/js/bank.js",
  "./bank-boss/js/audio.js", "./bank-boss/js/chart.js", "./bank-boss/js/ui.js",
  "./bank-boss/js/tutorial.js", "./bank-boss/js/app.js",
  "./bank-boss/icons/icon-192.png", "./bank-boss/icons/icon-512.png",
  "./bank-boss/icons/apple-touch-icon.png",

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

  "./cube-timer/", "./cube-timer/index.html", "./cube-timer/manifest.webmanifest",
  "./cube-timer/css/style.css",
  "./cube-timer/js/scramble.js", "./cube-timer/js/stats.js", "./cube-timer/js/store.js",
  "./cube-timer/js/audio.js", "./cube-timer/js/ui.js", "./cube-timer/js/app.js",
  "./cube-timer/icons/icon-192.png", "./cube-timer/icons/icon-512.png",
  "./cube-timer/icons/apple-touch-icon.png",

  "./morse/", "./morse/index.html", "./morse/manifest.webmanifest",
  "./morse/css/style.css",
  "./morse/js/rules.js", "./morse/js/audio.js", "./morse/js/key.js", "./morse/js/ui.js", "./morse/js/app.js",
  "./morse/icons/icon-192.png", "./morse/icons/icon-512.png",
  "./morse/icons/apple-touch-icon.png",

  "./enigma/", "./enigma/index.html", "./enigma/manifest.webmanifest",
  "./enigma/css/style.css",
  "./enigma/js/rules.js", "./enigma/js/audio.js", "./enigma/js/ui.js", "./enigma/js/app.js",
  "./enigma/icons/icon-192.png", "./enigma/icons/icon-512.png",
  "./enigma/icons/apple-touch-icon.png",

  "./newtons-laws/", "./newtons-laws/index.html", "./newtons-laws/manifest.webmanifest",
  "./newtons-laws/css/style.css",
  "./newtons-laws/js/physics.js", "./newtons-laws/js/levels.js", "./newtons-laws/js/audio.js",
  "./newtons-laws/js/scenes.js", "./newtons-laws/js/draw.js", "./newtons-laws/js/ui.js",
  "./newtons-laws/js/app.js",
  "./newtons-laws/icons/icon-192.png", "./newtons-laws/icons/icon-512.png",
  "./newtons-laws/icons/apple-touch-icon.png",

  "./circuit-lab/", "./circuit-lab/index.html", "./circuit-lab/manifest.webmanifest",
  "./circuit-lab/css/style.css",
  "./circuit-lab/js/circuit.js", "./circuit-lab/js/levels.js", "./circuit-lab/js/audio.js",
  "./circuit-lab/js/board.js", "./circuit-lab/js/safety.js", "./circuit-lab/js/ui.js", "./circuit-lab/js/app.js",
  "./circuit-lab/icons/icon-192.png", "./circuit-lab/icons/icon-512.png",
  "./circuit-lab/icons/apple-touch-icon.png",

  "./bridge-builder/", "./bridge-builder/index.html", "./bridge-builder/manifest.webmanifest",
  "./bridge-builder/css/style.css",
  "./bridge-builder/js/physics.js", "./bridge-builder/js/levels.js", "./bridge-builder/js/trail.js", "./bridge-builder/js/audio.js",
  "./bridge-builder/js/board.js", "./bridge-builder/js/ui.js", "./bridge-builder/js/app.js",
  "./bridge-builder/icons/icon-192.png", "./bridge-builder/icons/icon-512.png",
  "./bridge-builder/icons/apple-touch-icon.png",

  "./vet-clinic/", "./vet-clinic/index.html", "./vet-clinic/manifest.webmanifest",
  "./vet-clinic/css/style.css",
  "./vet-clinic/js/cases.js", "./vet-clinic/js/audio.js", "./vet-clinic/js/clinic.js",
  "./vet-clinic/js/ui.js", "./vet-clinic/js/app.js",
  "./vet-clinic/icons/icon-192.png", "./vet-clinic/icons/icon-512.png",
  "./vet-clinic/icons/apple-touch-icon.png",
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
// refreshes the cache so the offline copy stays current. "no-cache" makes the
// browser ask the server whether a file changed: GitHub Pages lets browsers
// keep files for 10 minutes, which would run old code just after a fix.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    fetch(req, { cache: "no-cache" })
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
