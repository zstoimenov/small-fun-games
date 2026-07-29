# Game roadmap

Four games planned. This file is the handover between sessions: it holds the
briefs, the cost estimates and the decisions already made, so a fresh session can
start building without re-deriving any of it.

Build conventions are in [`../CLAUDE.md`](../CLAUDE.md). Catalogue fields are in
[`../README.md`](../README.md#add-a-new-game).

## Decisions already made

- **Every game is `players: [1, 2]`.** Two people face to face on one device,
  *and* one person against the computer. Both modes, every game — including
  Mastermind, which is a two-player game (one sets a code, the other breaks it)
  before it is a solver showcase.
- **Categories**: Connect Four, Nine Men's Morris and Battleship are
  `board`. Mastermind is `puzzle` — it is the first game on that shelf, so its
  filter pill appears on the launcher only once it ships.
- Build in the order below. It is cheapest-first, and it is also the order that
  builds shared machinery before the games that lean hardest on it.

## Build order and cost

Estimated tokens for a complete, browser-verified build in this repo's style.
Treat as ±40%; the biggest variance is how many rounds of visual iteration a
game needs.

| # | Game | Folder | Est. lines | Est. tokens |
| --- | --- | --- | --- | --- |
| 1 | Connect Four | `connect-four/` | 500–700 | 120k–200k |
| 2 | Mastermind | `mastermind/` | 700–900 | 180k–280k |
| 3 | Nine Men's Morris | `nine-mens-morris/` | 1,000–1,400 | 300k–450k |
| 4 | Battleship | `battleship/` | 1,800–2,600 | 550k–850k |

Total ≈ **1.2M–1.8M tokens**. Battleship alone is about 45% of it.

For scale, the existing games measure: Yatzy 3,098 lines, Footy Tactics Lab
2,048, Times Table Blaster 1,186, AFL Goal Kick 1,058, Robo Rules 913.

### What actually drives the cost

The algorithms are the cheap part. Alpha-beta is ~60 lines and is *verifiable* —
it either plays a known position correctly or it does not. The money goes on
**hidden-information UI** and **board geometry**, which are matters of taste and
need looking at.

That is why Battleship costs four times Connect Four despite both being "a grid
and a search". Rank by how much of the game a second human being can see, not by
how clever the AI is.

## One session per game

**Yes — build each game in its own session.** Roughly 30–40% cheaper than one
long session for all four.

A single session carrying all four games re-sends an ever-larger context on every
turn, and will hit compaction two or three times — which is also when
hard-won conventions get quietly dropped. Separate sessions each pay a cold-start
cost instead: re-reading the repo and re-deriving house style, perhaps 25–50k
tokens.

Cold start is the smaller cost **only because this file and `CLAUDE.md` exist**.
Without them a fresh session re-derives everything from source and the maths
inverts. Keep both current — that is what makes the next session cheap.

The real risk of splitting is not tokens, it is **divergence**: four games built
cold, each inventing its own mode picker and difficulty selector. Mitigate by
having each session read this file, `CLAUDE.md`, and the previous game in the
list before writing anything.

## Shared machinery

Three of the four need the same furniture:

- a start screen offering **vs computer / vs a friend**
- a **difficulty** picker (Easy / Medium / Hard) for the computer
- an alternating **turn loop** that does not care which seat is human
- a **pass-the-device handover** for two humans sharing one screen

None of it exists yet. `yatzy-dice/js/ai.js` has an opponent but no game-tree
search — **there is no minimax anywhere in this repo**. The handover *does*
exist: Yatzy's flip-the-screen mode (`yatzy-dice/js/app.js`, the `flip` state).
Reuse that pattern rather than reinventing it; it is the single biggest saving
available on Battleship.

**Open decision:** whether to extract the above into a shared `versus/` module or
keep every game self-contained as they are today. Self-contained is the current
convention and the safer default; a shared module would cut games 2–4 but changes
the repo's architecture and adds entries to the `sw.js` `ASSETS` list. Worth
revisiting after Connect Four, when there is one real implementation to look at.

---

## 1. Connect Four — `connect-four/`

Cheapest of the four and the pattern-setter: whatever the vs-computer/vs-friend
start screen looks like here, the other three copy it.

- 7×6 grid, pieces drop to the lowest empty cell in a column.
- Win = four in a row horizontally, vertically or on either diagonal. Draw when
  the board fills.
- **AI**: minimax with alpha-beta. Order moves centre-column-first — it prunes far
  harder. Difficulty by search depth (~4 / ~6 / ~8) plus a little deliberate
  blundering at Easy so a kid can win.
- Nothing is hidden, so two-player mode is a turn swap with no handover screen.
- Catalogue: `category: "board"`, `players: [1, 2]`.

Watch for: the classic off-by-one in diagonal win detection near the edges. Test
wins in all four directions and in every corner.

## 2. Mastermind — `mastermind/`

- 4 slots, 6 colours, 10 guesses. Feedback pegs: black = right colour right
  place, white = right colour wrong place.
- **Two modes.** You break the computer's code, or you set a code and the
  computer breaks it with Knuth's five-guess algorithm. Face-to-face is the same
  code-setting screen with the code hidden from the second player.
- **AI**: Knuth minimax over the 1,296 codes. Precompute the feedback table once
  — 1,296² lookups is fine precomputed and painful if recalculated per guess.
  Open with 1122, which is Knuth's first guess.
- Catalogue: `category: "puzzle"`, `players: [1, 2]`. **First game on the Puzzles
  shelf** — the pill appears on the launcher when this ships.

Watch for: white-peg counting with duplicate colours. It is the single most
common Mastermind bug. Count exact matches first, remove them, then match the
remainder by colour multiset.

## 3. Nine Men's Morris (Дама) — `nine-mens-morris/`

- 24 points, 3 phases: **placing** 9 pieces each, **moving** along lines,
  **flying** anywhere once a player is down to 3 pieces.
- Forming a mill (3 in a line) removes an enemy piece. A piece in a mill may not
  be taken unless every enemy piece is in a mill.
- Loss at 2 pieces or no legal move. Draw on repetition / 50 moves without a
  mill.
- **AI**: minimax again, but move generation is phase-dependent — reuse the
  search from Connect Four, not the move generator.
- Catalogue: `category: "board"`, `players: [1, 2]`.

Watch for: **the board is the expensive part, not the AI.** Three concentric
squares with connecting spokes, responsive, with tap targets big enough for a
child. Model it as a 24-node adjacency list and render as SVG; do not try to
express the geometry in CSS grid.

## 4. Battleship (Морски бой) — `battleship/`

The big one. Effectively two games: a placement game and a guessing game, each
needing its own full UI, times two players.

- Two hidden 10×10 grids. Standard fleet: 5, 4, 3, 3, 2.
- **Placement phase** per player: rotate and position ships, reject overlaps and
  off-board placements, offer a "place randomly for me" button (it will get more
  use than the manual placer).
- **Battle phase**: alternate shots, mark hit/miss, announce sinkings, win when a
  fleet is gone.
- **Handover** for two humans: a "pass the tablet to X — don't peek" screen
  between turns, covering the board until the next player confirms. Build on
  Yatzy's `flip` pattern.
- **AI**: probability density. For each cell, count how many legal placements of
  each surviving ship cover it; shoot the maximum. On a hit, bias to the
  neighbours in line with previous hits. Difficulty by degrading this — pure
  random at Easy, hunt/target at Medium, full density at Hard.
- Catalogue: `category: "board"`, `players: [1, 2]`.

Watch for: secrecy is a real requirement, not decoration. The whole two-player
mode is worthless if a player can see the opponent's ships by scrolling, resizing
or reloading mid-game. Decide early what happens on refresh.
