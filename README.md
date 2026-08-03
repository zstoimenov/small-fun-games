# 🎮 Game Box — Small Fun Games

A little collection of homemade web games with a single launcher page. Tap a game to
play; every game has a **‹ Games** link to come back to the catalogue. No build step,
no dependencies — plain HTML/CSS/JS, and it works offline once loaded.

## Games

Every game belongs to exactly one **category**, and declares how many players it
takes. The launcher filters on both, with two rows of pills at the top:

- **Category** — All, Board & Strategy, Coding, Puzzles, Maths, Sport.
- **Players** — Any, On my own, With a friend, 3 or more.

The two combine, so you can ask for coding games you can play on your own. A
player pick matches against the game's **range**, not a single number: Yatzy Dice
is a 1–3 player game, so it turns up under *on my own*, *with a friend* and
*3 or more* alike.

Each pill shows how many games it would leave you, counting the other row's pick
too — and a pill that would empty the grid is dimmed instead of removed, so you
can't tap your way into a dead end.

Inside any shelf, games are ordered newest first, and the two most recent wear a
**NEW** ribbon for a month.

The picks are remembered between visits and mirrored in the URL, so
`…/small-fun-games/#cat=board&players=duo` opens straight onto board games you
can play with someone else. (The older short form, `#coding`, still works.)

### ♟️ Board & Strategy

| Game | Folder | What it is |
| --- | --- | --- |
| 💼 **Deal or No Deal** | [`deal-or-no-deal/`](deal-or-no-deal/) | Keep one sealed box back, open the others a few at a time, and every few boxes the Banker rings up and offers to buy yours. 1–3 players: everyone gets their own boxes and play goes round a *round* at a time, so nobody sits watching — or take on a robot contestant on Easy/Medium/Hard. Three board sizes (10, 16 or 22 boxes, top prize $1,000 to $250,000), the endgame swap, a hint that says whether the offer beats the odds *and* why, and a panel showing the Banker's actual arithmetic — the average of what's left, his cut, and how much of that average is riding on one box. Deal early and you still watch your board play out, so you always find out what you turned down. The boxes are filled by `crypto.getRandomValues`, and there's a built-in check that proves the top prize lands in every box equally often (~age 7+). |
| 🚢 **Battleship** | [`battleship/`](battleship/) | Морски бой. Hide a fleet on a hidden grid, then call out squares until you've sunk theirs. 1–2 players: pass-and-play on one tablet, with the screen *cleared* between turns rather than covered — the other player's ships are never in the page at all — or an Easy/Medium/Hard opponent that counts where every ship could still be lying and fires where most of them cross. Three sea sizes (6×6, 8×8, 10×10), a drag-free ship placer with a "do it for me" button, an optional extra-go-after-a-hit rule, undo, hints that name a square *and* the reason, and a heat map in the menu showing how obvious your own hiding place is (~age 6+). |
| ⚫ **Nine Men's Morris** | [`nine-mens-morris/`](nine-mens-morris/) | Дама, on 24 spots. Place nine pieces each, line three up to take one of theirs, then slide — and fly anywhere once you're down to three. 1–2 players, pass-and-play with a flip-the-screen mode, and an Easy/Medium/Hard opponent that searches the game tree. Undo, a hint button that names a spot and its reason, warnings when someone is one piece from a line, and a menu panel showing how far the computer thought. The board is one SVG built from the same 24-point adjacency list the rules use, so the picture can't disagree with the game (~age 7+). |
| 🔴 **Connect Four** | [`connect-four/`](connect-four/) | Drop discs down a 7×6 grid and line up four. 1–2 players, pass-and-play with a flip-the-screen mode, and an Easy/Medium/Hard opponent that searches the game tree rather than guessing — Hard looks about ten moves ahead. Undo, a hint button that explains itself, and a menu panel showing how far the computer actually thought on its last go. |
| 🎲 **Yatzy Dice** | [`yatzy-dice/`](yatzy-dice/) | Five dice, three rolls a turn, a card full of boxes. 1–3 players, an Easy/Medium/Hard computer opponent for solo games, a flip-the-screen mode so two people can sit opposite one device, **Yatzy EU and Yatzy US** rules, and a scorecard-only mode for when you'd rather roll real dice. Dice come from `crypto.getRandomValues`, and there's a built-in fairness check to prove it. |

### 🧩 Puzzles

| Game | Folder | What it is |
| --- | --- | --- |
| 🎯 **Mastermind** | [`mastermind/`](mastermind/) | Somebody hides a row of colours; you work it out from the pegs. 1–2 players — crack the computer's code, set one for it to break, or take turns with a friend and see who needs fewest goes. Three puzzle sizes (3, 4 or 5 slots), an Easy/Medium/Hard breaker whose Hard setting is Knuth's minimax and provably never needs more than five goes, a live count of how many codes still fit, hints that name the reason, undo, and a shape on every peg so colour isn't the only clue (~age 6+). |

### 🧠 Coding

| Game | Folder | What it is |
| --- | --- | --- |
| 🥅 **Footy Tactics Lab** | [`footy-tactics-lab/`](footy-tactics-lab/) | Learn to code with footy. Build a play from move/turn/repeat/handball blocks, run it one step at a time and debug your way to a goal. 10 levels, sequencing through nested loops (~age 8+). |
| 🤖 **Robo Rules** | [`robo-rules/`](robo-rules/) | Teach Chip the robot pet with IF-THIS-THEN-THAT rules — a first taste of coding for kids (~age 7+). |

### 🔢 Maths

| Game | Folder | What it is |
| --- | --- | --- |
| ⭐ **Times Table Blaster** | [`times-table-blaster/`](times-table-blaster/) | Practise your times tables. Ninja Belt mode ranks you up one table at a time; Classic mode adds timers, streaks and a leaderboard. |

### ⚽ Sport

| Game | Folder | What it is |
| --- | --- | --- |
| 🏉 **AFL Goal Kick** | [`afl-goal-kick/`](afl-goal-kick/) | Aim, load the power bar, time your run-up and kick goals. 1–2 players, wind, a man on the mark, and Easy/Medium/Hard. |

### Planned

Nothing outstanding. All four games on the original roadmap are built, and
Deal or No Deal was added on top of them.

[`docs/GAME-ROADMAP.md`](docs/GAME-ROADMAP.md) is still worth reading before
starting a new one: it holds what each build actually cost against what it was
estimated at, and the handful of things that turned out to be worth knowing in
advance.

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
     players: [1, 2],         // [min, max] — the whole range the game supports
     age: 8,                  // optional, renders as "Age 8+"
     blurb: "One or two sentences a kid would understand.",
     colors: ["#4fc3f7", "#8a7bff"],   // the thumbnail gradient
     highlights: ["🔁 Loops"]          // optional extra chips, 0–2 is plenty
   }
   ```

   The chips on the card are **generated** from `category`, `players`, `age` and
   `highlights` — don't hand-write them, or they drift from the real game.

   Get `players` right: it drives the second filter row, so `[2, 2]` for a game
   that *needs* two people is a different claim from `[1, 2]` for one with a
   computer opponent. `[1, 1]` renders as "1 player", any wider range as "1–2
   players".

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
