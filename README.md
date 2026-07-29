# 🎮 Game Box — Small Fun Games

A little collection of homemade web games with a single launcher page. Tap a game to
play; every game has a **‹ Games** link to come back to the catalogue. No build step,
no dependencies — plain HTML/CSS/JS, and it works offline once loaded.

## Games

Every game belongs to exactly one **category**, and the launcher has a row of
category pills at the top to filter by it. Inside a category — and inside the
unfiltered **All** shelf — games are ordered newest first, and the two most
recent ones wear a **NEW** ribbon for a month.

The pick is remembered between visits and mirrored in the URL, so
`…/small-fun-games/#coding` opens straight onto the coding shelf.

### 🧠 Coding

| Game | Folder | What it is |
| --- | --- | --- |
| 🥅 **Footy Tactics Lab** | [`footy-tactics-lab/`](footy-tactics-lab/) | Learn to code with footy. Build a play from move/turn/repeat/handball blocks, run it one step at a time and debug your way to a goal. 10 levels, sequencing through nested loops (~age 8+). |
| 🤖 **Robo Rules** | [`robo-rules/`](robo-rules/) | Teach Chip the robot pet with IF-THIS-THEN-THAT rules — a first taste of coding for kids (~age 7+). |

### 🎲 Dice & Board

| Game | Folder | What it is |
| --- | --- | --- |
| 🎲 **Yatzy Dice** | [`yatzy-dice/`](yatzy-dice/) | Five dice, three rolls a turn, a card full of boxes. 1–3 players, an Easy/Medium/Hard computer opponent for solo games, a flip-the-screen mode so two people can sit opposite one device, **Yatzy EU and Yatzy US** rules, and a scorecard-only mode for when you'd rather roll real dice. Dice come from `crypto.getRandomValues`, and there's a built-in fairness check to prove it. |

### 🔢 Maths

| Game | Folder | What it is |
| --- | --- | --- |
| ⭐ **Times Table Blaster** | [`times-table-blaster/`](times-table-blaster/) | Practise your times tables. Ninja Belt mode ranks you up one table at a time; Classic mode adds timers, streaks and a leaderboard. |

### ⚽ Sport

| Game | Folder | What it is |
| --- | --- | --- |
| 🏉 **AFL Goal Kick** | [`afl-goal-kick/`](afl-goal-kick/) | Aim, load the power bar, time your run-up and kick goals. 1–2 players, wind, a man on the mark, and Easy/Medium/Hard. |

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
3. Add one entry to the `GAMES` array in the root [`index.html`](index.html). The
   entry can go anywhere in the array — the launcher sorts by `added`, newest
   first. The fields:

   ```js
   {
     title: "My Game",
     folder: "my-game",
     emoji: "🕹️",
     added: "2026-08-01",     // YYYY-MM-DD, drives the sort and the NEW ribbon
     category: "coding",      // exactly one id from the CATEGORIES list above
     players: "1–2",          // "1" renders as "1 player", anything else as "N players"
     age: 8,                  // optional, renders as "Age 8+"
     blurb: "One or two sentences a kid would understand.",
     colors: ["#4fc3f7", "#8a7bff"],   // the thumbnail gradient
     highlights: ["🔁 Loops"]          // optional extra chips, 0–2 is plenty
   }
   ```

   The chips on the card are **generated** from `category`, `players`, `age` and
   `highlights` — don't hand-write them, or they drift from the real game.

   Needs a category that doesn't exist yet? Add it to the `CATEGORIES` array in
   the same file (`{ id, label, emoji }`). The filter bar picks it up on its own,
   and only shows a pill once at least one game uses it.
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
