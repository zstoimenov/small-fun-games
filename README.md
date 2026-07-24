# 🎮 Game Box — Small Fun Games

A little collection of homemade web games with a single launcher page. Tap a game to
play; every game has a **‹ Games** link to come back to the catalogue. No build step,
no dependencies — plain HTML/CSS/JS, and it works offline once loaded.

## Games

| Game | Folder | What it is |
| --- | --- | --- |
| 🤖 **Robo Rules** | [`robo-rules/`](robo-rules/) | Teach Chip the robot pet with IF-THIS-THEN-THAT rules — a first taste of coding for kids (~age 7+). |
| 🏉 **AFL Goal Kick** | [`afl-goal-kick/`](afl-goal-kick/) | Aim, load the power bar, time your run-up and kick goals. 1–2 players, wind, a man on the mark, and Easy/Medium/Hard. |
| ⭐ **Times Table Blaster** | [`times-table-blaster/`](times-table-blaster/) | Practise your times tables. Ninja Belt mode ranks you up one table at a time; Classic mode adds timers, streaks and a leaderboard. |

## Run locally

```bash
cd small-fun-games
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy to GitHub Pages

This repo is set up to serve straight from the `main` branch root:

**Settings → Pages → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save.**

After a minute it's live at `https://<your-username>.github.io/small-fun-games/`. All paths
are relative, so the launcher and every game work from that subpath out of the box.

## Install on a kid's tablet

Open the Pages URL, then:

- **Android/Chrome**: tap ⋮ → *Add to Home screen* (or the “Install Game Box” button).
- **iPad/iPhone (Safari)**: tap Share → *Add to Home Screen*.

It launches full-screen like a real app. From the home-screen icon the kid sees the
catalogue and picks a game.

## Add a new game

1. Drop the game in its own folder (e.g. `my-game/`) with an `index.html`, using
   **relative** paths so it works from a subpath.
2. Add a **‹ Games** link back to the catalogue: `<a href="../">‹ Games</a>`.
3. Add one entry to the `GAMES` array in the root [`index.html`](index.html).
4. Register the shared worker from the new game with
   `navigator.serviceWorker.register('../sw.js')`.
5. For offline use, add the game's files to the `ASSETS` list in [`sw.js`](sw.js).

## Offline / caching notes

The whole app is served by **one** service worker at the site root
([`sw.js`](sw.js)) — the launcher and every game register it (`./sw.js` from the
root, `../sw.js` from a game folder). The two games that used to ship their own
worker (`robo-rules/sw.js`, `times-table-blaster/sw.js`) are now retired stubs
that unregister themselves on first visit.

- **Updates show on the next refresh.** The worker is *network-first*: while
  you're online it always tries the network, so a new deploy appears the next
  time the page loads. The cache is only a fallback so the app still works
  offline once it has been loaded.
- Bump the `CACHE` version string in `sw.js` if you ever want to force every
  cached copy to be discarded.
