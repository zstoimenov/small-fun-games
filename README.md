# 🎮 Game Box — Small Fun Games

A little collection of homemade web games with a single launcher page. Tap a game to
play; every game has a **‹ Games** link to come back to the catalogue. No build step,
no dependencies — plain HTML/CSS/JS, and it works offline once loaded.

## Games

The home page opens on **shelves**: sideways rows you swipe with a finger (or drag,
or use the ‹ › arrows, with a mouse). A row always shows whole cards plus **half**
of the next one, at any screen size, so it's obvious there's more. In order:
**Keep playing** (what you opened last), **New**, **Favourites** (tap ♡ on any
card), **Discover jobs** (the careers track), then one row per category.

A card is just the game's emoji, name and one-line `hook`, with a badge: ★ stars
so far, ✓ Played, NEW, or "Try me!" for one never opened. Tap it for the full
description and a big **Play** button. The name and search box stay pinned at
the top.

Every game belongs to exactly one **category**, may carry extra **tags**, and
declares how many players it takes. Picking a filter, or typing in the search,
swaps the shelves for a plain grid of matches:

- **Pills**: All, Favourites, Jobs, then Board & Strategy, Coding, Puzzles, Maths,
  Science, Languages, Arts & Music, Sport. On a phone they are one sideways row.
- **Players**: Anyone, On my own, With a friend, 3 or more. A pick matches the
  game's **range**, not a single number: Yatzy Dice (1–3) turns up under all three.
- **Search** looks through names, hooks, descriptions and chips ("spy" finds
  Morse Agent).

Each pill shows how many games it would leave you, and one that would empty the
page is dimmed rather than removed. Stars, favourites and "last played" are kept
on the device only.

The picks are remembered between visits and mirrored in the URL, so
`…/small-fun-games/#cat=board&players=duo` opens straight onto board games you
can play with someone else. (The older short form, `#coding`, still works.)

### ♟️ Board & Strategy

| Game | Folder | What it is |
| --- | --- | --- |
| 💼 **Deal or No Deal** | [`deal-or-no-deal/`](deal-or-no-deal/) | Keep one sealed box back, open the others a few at a time, and every few boxes the Banker rings up and offers to buy yours. 1–3 players: everyone gets their own boxes and play goes round a *round* at a time, so nobody sits watching — or take on a robot contestant on Easy/Medium/Hard. Three board sizes (10, 16 or 22 boxes, top prize $1,000 to $250,000), the endgame swap, a hint that says whether the offer beats the odds *and* why, and a panel showing the Banker's actual arithmetic — the average of what's left, his cut, and how much of that average is riding on one box. Every box lifts off the board and rattles before it opens, so there's a real wait before you find out — set the **Pace** to Quick, Normal or Full drama to taste. Deal early and you still watch your board play out, so you always find out what you turned down. The boxes are filled by `crypto.getRandomValues`, and there's a built-in check that proves the top prize lands in every box equally often (~age 7+). |
| 🚢 **Battleship** | [`battleship/`](battleship/) | Морски бой. Hide a fleet on a hidden grid, then call out squares until you've sunk theirs. 1–2 players: pass-and-play on one tablet, with the screen *cleared* between turns rather than covered — the other player's ships are never in the page at all — or an Easy/Medium/Hard opponent that counts where every ship could still be lying and fires where most of them cross. Three sea sizes (6×6, 8×8, 10×10), a drag-free ship placer with a "do it for me" button, an optional extra-go-after-a-hit rule, undo, hints that name a square *and* the reason, and a heat map in the menu showing how obvious your own hiding place is (~age 6+). |
| ⚫ **Nine Men's Morris** | [`nine-mens-morris/`](nine-mens-morris/) | Дама, on 24 spots. Place nine pieces each, line three up to take one of theirs, then slide — and fly anywhere once you're down to three. 1–2 players, pass-and-play with a flip-the-screen mode, and an Easy/Medium/Hard opponent that searches the game tree. Undo, a hint button that names a spot and its reason, warnings when someone is one piece from a line, and a menu panel showing how far the computer thought. The board is one SVG built from the same 24-point adjacency list the rules use, so the picture can't disagree with the game (~age 7+). |
| 🔴 **Connect Four** | [`connect-four/`](connect-four/) | Drop discs down a 7×6 grid and line up four. 1–2 players, pass-and-play with a flip-the-screen mode, and an Easy/Medium/Hard opponent that searches the game tree rather than guessing — Hard looks about ten moves ahead. Undo, a hint button that explains itself, and a menu panel showing how far the computer actually thought on its last go. |
| 🎲 **Yatzy Dice** | [`yatzy-dice/`](yatzy-dice/) | Five dice, three rolls a turn, a card full of boxes. 1–3 players, an Easy/Medium/Hard computer opponent for solo games, a flip-the-screen mode so two people can sit opposite one device, **Yatzy EU and Yatzy US** rules, and a scorecard-only mode for when you'd rather roll real dice. Dice come from `crypto.getRandomValues`, and there's a built-in fairness check to prove it. |

### 🧩 Puzzles

| Game | Folder | What it is |
| --- | --- | --- |
| ⏱️ **Cube Timer** | [`cube-timer/`](cube-timer/) | Time your cube solves. It hands you a scramble — with a **picture of the cube it makes**, so you can check you did it right before the clock starts — then it's hold the big pad until it goes green, let go, solve, tap to stop. 2×2, 3×3 and 4×4, each keeping its own times. +2 and DNF on the last solve, best time, average of the last five (dropping the best and the worst, the way a competition counts it), a chart of the last twenty and the whole list to scroll back through. Optional 15-second inspection with the 8- and 12-second calls. Up to four people in the house each have their own times, and the 🏆 board ranks everybody's fastest time on each cube with **the day and time they set it**. Two of them can race: the **same scramble each round**, taking turns with one cube, first to win two rounds of three or three of five. The screen is kept awake the whole time the timer is open, and the times are saved on the device the moment each solve ends — they stay until somebody clears the browser's data for the site (~age 7+). |
| 🎯 **Mastermind** | [`mastermind/`](mastermind/) | Somebody hides a row of colours; you work it out from the pegs. 1–2 players — crack the computer's code, set one for it to break, or take turns with a friend and see who needs fewest goes. Three puzzle sizes (3, 4 or 5 slots), an Easy/Medium/Hard breaker whose Hard setting is Knuth's minimax and provably never needs more than five goes, a live count of how many codes still fit, hints that name the reason, undo, and a shape on every peg so colour isn't the only clue (~age 6+). |

### 🧠 Coding

| Game | Folder | What it is |
| --- | --- | --- |
| 📡 **Morse Agent** | [`morse/`](morse/) | Learn Morse code by ear, the way radio operators do. **Boot Camp** starts from nothing: hear a dot and a dash, make them on the telegraph key, copy a few rhythms. Then 35 spy missions, each adding one letter (Koch's method: K and M first, digits last), and you need 9 out of 10 to unlock the next. Every mission is *listen* (tap the letter you heard), *send* (tap words out on the key) and *decode* (spell out a word you hear). Letters are always sent at 12 words a minute; a **difficulty lever** (Rookie / Agent / Ace) changes the gaps between letters, how many dots and dashes are shown and how long the words are. The key learns each kid's own tapping speed. 1–2 players: in **Field Agents** one agent taps a secret word and the other hears it played back in *their* rhythm. A lamp flashes with every beep, so it still works with the sound off. A picture-book **story of Morse code** covers who invented it, the first message, SOS and the *Titanic*, where it is still used today, and why it is worth learning. Up to four agents per tablet, progress saved on the device (~age 8+). |
| 🥅 **Footy Tactics Lab** | [`footy-tactics-lab/`](footy-tactics-lab/) | Learn to code with footy. Build a play from move/turn/repeat/handball blocks, run it one step at a time and debug your way to a goal. 10 levels, sequencing through nested loops (~age 8+). |
| 🤖 **Robo Rules** | [`robo-rules/`](robo-rules/) | Teach Chip the robot pet with IF-THIS-THEN-THAT rules — a first taste of coding for kids (~age 7+). |

### 🔢 Maths

| Game | Folder | What it is |
| --- | --- | --- |
| 🏦 **Bank Boss** | [`bank-boss/`](bank-boss/) | You're the bank. All day people come to the counter — some want to leave their money with you, some want to borrow it — and you set two rates: what you pay savers, and what you charge borrowers. The gap between them is everything your bank earns, and it has to cover the loans that never come back. **The vault is on screen the whole time**, as two bars of the same length: whose the money is (savers / yours) and where it has actually got to (in the vault / out on loan). Nan's $25 doesn't sit in a box with her name on it — you watch it walk out of the door as somebody's new bike. Keep a quarter back or you'll have to call your loans in early at 75c in the dollar; charge the most you can and the only people who still borrow from you are the ones who never pay you back. 1–2 players: against Robo Bank on Easy/Medium/Hard, or two banks on one street sharing one town, each setting its rates in secret behind a pass-the-tablet screen. Twenty named townsfolk who always behave the same way, so you learn who's good for it — and on Tricky you only see somebody's stars once you've dealt with them (~age 8+). |
| 🍋 **Lemonade Stand** | [`lemonade-stand/`](lemonade-stand/) | Run a lemonade stall for a fortnight. Each morning asks one thing at a time — what's the weather, how many cups, what price — and the evening shows every decision next to what it caused. Count out real change when somebody pays with a handful of coins, and sometimes they want two or three cups, so the sum is a multiply before it is a subtract. Serve people fairly and they come back: your **regulars** are a number you can watch grow, they turn up when other people don't, and you lose them by gouging or getting their change wrong. Money in the bank grows overnight and you watch it go up; money you borrow costs twice as much as it pays; and fetching money back out of the bank costs 75c a trip, so keeping tomorrow's lemon money in your purse and banking the rest is the answer rather than emptying one into the other. You start with $3.00, which is not enough for a full stall, so the bank is a real choice on day one — the lemon screen carries the loan offers, the ice bucket and the big sign, so nothing has to be found behind another menu. The fortnight ends at a shop counter: the total counts up and you walk out with the best thing your money reaches. Saving up for the bike takes a genuinely good fortnight (~age 8+). |
| ⭐ **Times Table Blaster** | [`times-table-blaster/`](times-table-blaster/) | Practise your times tables. Ninja Belt mode ranks you up one table at a time; Classic mode adds timers, streaks and a leaderboard. |

### ⚽ Sport

| Game | Folder | What it is |
| --- | --- | --- |
| 🏉 **AFL Goal Kick** | [`afl-goal-kick/`](afl-goal-kick/) | Aim, load the power bar, time your run-up and kick goals. 1–2 players, wind, a man on the mark, and Easy/Medium/Hard. |

### 🔬 Science

| Game | Folder | What it is |
| --- | --- | --- |
| 🍎 **Newton's Playground** | [`newtons-laws/`](newtons-laws/) | Newton's three laws of motion, one chapter each. Every chapter opens with a no-rules "Try it" sandbox, then four levels where you stop something on a green flag. **Law 1** - slingshot a puck over ice, grass and sand, and watch it slide forever in space. **Law 2** - push a cart loaded with a teddy, a box or an elephant; pick the push, pick the load, and make a 4x-heavier elephant keep up with the teddy. **Law 3** - throw balls off a skateboard and roll the other way, ride a balloon rocket, and guess who rolls further when two kids push apart. Force arrows show every push and its pair. Stars per level, a line on what you learned after each law, and a 3-question quiz (~age 8+). |
| ⚡ **Circuit Lab** | [`circuit-lab/`](circuit-lab/) | Snap batteries, wires, bulbs, switches, buzzers and fans onto a board of dots, and watch moving dots show the electricity flowing. Four chapters of four levels, and **Stay Safe comes first**: every other chapter, the free build and the quiz stay locked until each of its levels has a star. **Full Circle** - close the loop, build round a corner, add a light switch, make a doorbell. **One Path or Two** - two bulbs in a row glow dim (series), on their own paths they glow bright (parallel), each light gets its own switch, and two batteries make a bulb extra bright. **Safe Paths** - test a coin, a key, a pencil, wood, paper and a balloon to find conductors and insulators, fix a loop with the right things, and remove a dangerous short circuit. **Stay Safe** - spot the dangers at home and outside, sort safe from danger, and pick what to do in an emergency (call 000). Safety is everywhere, not just in its own chapter: a daily Lab Rules pledge that only "I promise" gets past, a hazard-striped safety line on home, a real-world "safety spark" on every win screen, a short-circuit talk about house fires and safety switches, a safety question in every quiz, and a Safety Expert badge. A free build with every part, a "Who works with circuits?" card with three real jobs, and a 4-question quiz. Real nodal analysis under the hood; `node tools/circuit-check.js` plays a solution to every level (~age 8+). |
| 🌉 **Bridge Builder** | [`bridge-builder/`](bridge-builder/) | Tap dot to dot to build a bridge from road, wood and steel, then press Test and a car, truck, fire truck or big truck drives over while every piece glows green, yellow or red with how hard it is working. Pieces that break snap and splash into the river. Three chapters of three levels. **Plank and Pillar** - a long plank snaps, a pillar on a rock saves it. **Triangle Power** - a frame of squares folds, two diagonals lock it; build a truss; props off the riverbank. **Smart Engineer** - steel where the squashing is worst, a rescue run, and a long gap. A static stiffness solver, not a spring simulation, so a bridge never jiggles itself apart; pars were found by brute-force search, and `node tools/bridge-check.js` drives a truck over a solution to every level. Free build with any truck, a "Who builds bridges?" card, and a 3-question quiz (~age 8+). |
| 🧭 **Career Compass** | [`career-compass/`](career-compass/) | Which kind of work sounds like you? Six styles from Holland's interest types, in kid words: Builders, Explorers, Creators, Helpers, Leaders, Organisers. Twelve would-you-rather questions (every style offered four times), a 👍 😐 👎 rating for each game played, and how often each game gets picked from Game Box point a compass needle at the favourite. Stars won show beside it as "doing well", never mixed in, because choosing a game is not being good at it. Each style opens three real jobs, an "ask a grown-up" nudge and the games that build it. A grown-ups corner shows the four signals side by side; everything stays on the device (~age 7+). |
| 🩺 **Vet Clinic** | [`vet-clinic/`](vet-clinic/) | Be the vet. Read what the owner says, pick from seven checks (heartbeat, temperature, eyes and ears, mouth and teeth, skin and fur, weight, X-ray), and see every number against the green band of what is normal for that animal. Then diagnose, treat, and give home-care advice; a check you did not need costs a star. **Check-up** - whose heartbeat is it (mouse 600 a minute, elephant 30), is 38.8 °C a fever (not for a dog, yes for you), a puppy's first visit. **What's Wrong?** - a broken leg, fleas (never dog flea drops on a cat), overgrown rabbit teeth, chocolate poisoning. **Wildlife Rescue** - an orphaned joey, a koala with chlamydia, a turtle that swallowed a fishing hook, and never touch a bat. A vet's chart of normal ranges, a jobs popup (vet, vet nurse, wildlife carer) and a 3-question quiz; `node tools/vet-check.js` checks every case is solvable from its clues (~age 8+). |

### 🗣️ Languages

| Game | Folder | What it is |
| --- | --- | --- |
| 🔤 **Буквар** | [`bulgarian-bukvar/`](bulgarian-bukvar/) | Learn to read Bulgarian, one letter at a time, the way a Буквар teaches it. Ten missions cover all 30 letters, easy ones first. Each mission has five steps: **Learn** the letter, **Blend** sounds into words, **Match** pictures to words, **Build** words from loose letters and **Read** a sentence. There is no sound on purpose, because computer voices say Bulgarian letters wrong. A grown-up says the sounds in the together steps, and the solo steps check themselves. Every word only uses letters already learned. **Tricky letters** drills the ones that look English but aren't (Р, В, Н, С, Х, У, п, и). Missions open **42 history cards**: history from Спартак to 1908, science and art, sport (ФК Левски, Гунди, Стоичков and more) and traditions. Each card is a little story book with a surprising true detail to remember it by, a Bulgarian line to read together, and a "Remember it?" question that earns a ✓. The **passport** has nine stamps for places in Bulgaria: get all 5 quiz questions right to win one, and win it with no help for gold. It works for 1 player, or 2 passing the tablet (~age 7+). |

### 🎨 Arts & Music

| Game | Folder | What it is |
| --- | --- | --- |
| 🎹 **Music Studio** | [`music-studio/`](music-studio/) | Make beats and tunes on an 8-step grid: four drum rows (Boom, Tak, Tss, Clap) and six note rows on a five-note scale, so anything you tap sounds nice. Every sound is made in the browser. **Feel the Beat** - tap along to a drum, hear fast or slow, copy rhythms by ear, make a sleepy beat and a race beat. **Patterns** - what comes next, finish the loop, spot the mistake, build a track in layers. **Melody & Mood** - higher or lower, which way a tune goes, copy a tune, and write sad music for a lost puppy by switching to the minor scale. The studio is always open (tempo slider, three instruments, happy/sad scale) with a gallery of up to 12 saved songs on the device, plus a jobs popup (musician, composer, sound designer) and a quiz. `node tools/music-check.js` proves every round can be won and none starts already won (~age 8+). |

### Planned

All four games on the original roadmap are built, and four
more were added on top of them — Deal or No Deal, Lemonade Stand, Bank Boss and
Cube Timer.

[`docs/GAME-ROADMAP.md`](docs/GAME-ROADMAP.md) is worth reading before starting a
new one: it holds what each build actually cost against what it was estimated at,
and the handful of things that turned out to be worth knowing in advance.

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
3. Add one entry to the `GAMES` array in [`games.js`](games.js) (shared by the
   launcher and Career Compass). The
   entry can go anywhere in the array — the launcher sorts by `added`, newest
   first. The fields:

   ```js
   {
     title: "My Game",
     folder: "my-game",
     emoji: "🕹️",
     hook: "Tap secret messages like a spy",  // the one line on the card; keep it short
     added: "2026-08-01",     // YYYY-MM-DD, drives the sort and the NEW badge
     category: "coding",      // exactly one id from the CATEGORIES list above
     players: [1, 2],         // [min, max] — the whole range the game supports
     age: 8,                  // optional, renders as "Age 8+"
     blurb: "The longer story, shown when the card is opened.",
     tags: ["jobs"],          // optional extra shelves (see TAGS), e.g. the careers track
     compass: ["builder"],    // 1-2 Career Compass styles it builds ([] if none), see below
     colors: ["#4fc3f7", "#8a7bff"],   // the thumbnail gradient
     highlights: ["🔁 Loops"]          // optional extra chips, 0–2 is plenty
   }
   ```

   Cards show only the emoji, title and `hook`. Tapping one opens the details,
   whose chips are **generated** from `category`, `tags`, `players`, `age` and
   `highlights`. Don't hand-write them, or they drift from the real game.

   Get `players` right: it drives the second filter row, so `[2, 2]` for a game
   that *needs* two people is a different claim from `[1, 2]` for one with a
   computer opponent. `[1, 1]` renders as "1 player", any wider range as "1–2
   players".

   Needs a category that doesn't exist yet? Add it to the `CATEGORIES` array in
   the same file (`{ id, label, emoji }`).

   `compass` feeds **Career Compass**: pick one or two of `builder`, `explorer`,
   `creator`, `helper`, `leader`, `organiser` (the six Holland interest types,
   described in [`career-compass/js/areas.js`](career-compass/js/areas.js)) for
   the kind of work the game is like. `node tools/compass-check.js` checks the
   ids. The launcher counts Play taps in `gamebox:plays` for it. The filter bar picks it up on its own,
   and only shows a pill once at least one game uses it.
4. If the game has stars, report them to the home page so its card shows
   "★ 7/12" and it joins **Keep playing**. Write, whenever progress is saved and
   once on load:

   ```js
   localStorage.setItem("gamebox:progress:my-game",
     JSON.stringify({ stars: got, max: possible, at: Date.now() }));
   ```

   Games without stars need nothing: tapping Play on the home page marks them
   played.
5. Register the shared worker from the new game with
   `navigator.serviceWorker.register('../sw.js')`.
6. For offline use, add the game's files to the `ASSETS` list in [`sw.js`](sw.js).

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
