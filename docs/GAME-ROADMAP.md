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
| 1 | ✅ Connect Four | `connect-four/` | 500–700 → **2,202 actual** | 120k–200k |
| 2 | Mastermind | `mastermind/` | 700–900 → **~1,600 expected** | 180k–280k → **250k–400k** |
| 3 | ✅ Nine Men's Morris | `nine-mens-morris/` | 1,000–1,400 → **2,928 actual** | 300k–450k → **~500k actual** |
| 4 | Battleship | `battleship/` | 1,800–2,600 → **~4,000 expected** | 550k–850k → **700k–1.1M** |

Total ≈ **1.5M–2M tokens**. Battleship alone is still about 45% of it.

For scale, the existing games measure: Yatzy 3,098 lines, Nine Men's Morris
2,928, Connect Four 2,202, Footy Tactics Lab 2,048, Times Table Blaster 1,186,
AFL Goal Kick 1,058, Robo Rules 913.

**Two games in, the line estimates are consistently ~2.2× low and the token
estimates ~1.3× low.** Scale the two remaining briefs by those factors rather
than trusting the original numbers — the figures in the table already are.

**The line estimates are low — Connect Four came in at 3× its brief.** Not
because the game grew, but because "in this repo's style" is expensive: the
board and the search together are only ~370 lines, and the other ~1,800 are the
setup sheet, the how-to-play lesson, sound, the result screen, saving and the
responsive board sizing. Scale the remaining three from the *actual* figure, not
the estimate — the fixed cost of the house furniture lands on every game.

### What actually drives the cost

The algorithms are the cheap part. Alpha-beta is ~60 lines and is *verifiable* —
it either plays a known position correctly or it does not. The money goes on
**hidden-information UI** and **board geometry**, which are matters of taste and
need looking at.

**Morris confirmed the shape of that, with one correction worth having.** The
board was indeed the expensive part to get *right*, but the expensive part to
*debug* was the evaluation function, and it was cheap to debug because a node
harness could play positions out and print numbers. The rule that fell out:

- **Anything checkable, check in node.** `rules.js` and `ai.js` load into plain
  node with `global.window = global` and a `new Function(...)` — no build step,
  no browser. 900-odd assertions cost almost nothing and caught every rules bug.
- **Only look in a browser at things that are actually visual.** Screenshots are
  the single most expensive thing in the session. Morris needed about a dozen.
- **Then verify the visual state by measuring it, not by looking.** Two bugs
  here were invisible in a screenshot and obvious in `getComputedStyle`.

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

**All four now exist, in `connect-four/`.** Copy from there rather than from
this description:

- Start screen and difficulty picker: `connect-four/index.html` (the `#setup`
  sheet) plus `renderSetup()` in `js/app.js`. One row per decision, label left
  and a segmented control right, and rows that don't apply are hidden rather
  than disabled — `chooser()` / `setChooser()` are generic and copy over as-is.
- Turn loop: `dropIn()` → `afterTurn()` in the same file. Seats are colours, and
  `players[seat].kind` is the only thing that says whether a seat is human, so
  the loop never branches on "am I in one-player mode".
- Handover: Yatzy's flip-the-screen mode, reused (`state.flip`, `body.flipped`).

`connect-four/js/ai.js` is now the repo's **minimax reference** — negamax,
alpha-beta, centre-first ordering, iterative deepening on a time budget. Nine
Men's Morris took the search from it and supplied its own move generator, and
that worked exactly as planned: the search copied over almost line for line, and
all of the thinking went into the generator, the ordering and the evaluation.
Two things had to be added for a game with a worse branching factor — ordering
mill-closing moves ahead of blocking moves ahead of everything else, and capping
how many capture choices a mill-closing move expands into. Battleship should
expect the same split: cheap search, expensive everything-around-it.

**Open decision, now answerable:** the shared `versus/` module is still not worth
it. Of Connect Four's 2,202 lines the genuinely reusable furniture is perhaps
150 — the chooser controls and the turn loop — and both are short enough to copy
in a minute and adapt in five. What is *not* reusable is everything that made the
file long: the board geometry, the lesson, the sounds. Extracting 150 lines would
buy a shared module, a new `sw.js` entry and a coupling between four games, to
save less than a session's cold start. **Keep games self-contained.**

---

## 1. Connect Four — `connect-four/` ✅ built

The pattern-setter: whatever the vs-computer/vs-friend start screen looks like
here, the other three copy it.

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

### What shipped, and where it differs

- **Depths are 2 / 7 / time-budgeted**, not 4 / 6 / 8. Hard runs iterative
  deepening against a ~950ms clock and reaches depth 10–11 from the opening,
  which beats a fixed 8 and stays responsive on a slow tablet. Easy went *down*
  to 2: at depth 4 it still blocks every threat it sees, and the 35% blunder rate
  alone was not enough to make it losable by a young child. Easy always takes a
  win it can see — an opponent that walks past four in a row reads as broken
  rather than easy.
- **Two-player mode does offer the flip.** Off by default, since the brief is
  right that nothing is hidden — but two people sitting opposite each other still
  want the board the right way up, and reusing Yatzy's `flip` cost almost nothing.
- **Extras not in the brief**: undo (steps back over the opponent's reply), a
  hint button that names a column *and* the reason, threat warnings for younger
  players, a running score across games, and a menu panel reporting the depth and
  node count of the opponent's last move.
- The diagonal off-by-one was **specifically tested** — all four directions from
  every legal starting cell, both colours, each of the four discs checked as the
  one completing the line (552 cases), plus every corner. No failures.

One bug worth knowing about for games 2–4: the root search originally collected
equal-scoring moves from alpha-beta results and broke ties at random. Fail-low
values are only *upper bounds*, so two that happen to match are not a tie — in
one test position it picked a move worth +108 to the opponent. The root now
searches on a full window. **If you copy the search, copy that comment with it.**

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

## 3. Nine Men's Morris (Дама) — `nine-mens-morris/` ✅ built

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

### What shipped, and where it differs

2,928 lines, ~500k tokens, one session. The brief above was right about the
board and wrong about nothing, but four things are worth carrying forward.

- **The advice about SVG was right, and cheaper than expected.** The whole board
  — three squares, four spokes, 24 points, sockets, pieces — is generated from
  the rules' own `XY` coordinate table and `ADJ` list in about 60 lines of
  `ui.js`. Nothing about the geometry is written down twice, so the picture
  cannot disagree with which points are joined. `fit()` is Connect Four's, minus
  the two-pass measurement, because a square board only needs one number.
- **A turn can take three taps, and that is the real structural difference.**
  Pick a piece up, put it down, and if that closed a mill, choose which enemy
  piece to take. The middle of that is a genuine state, not a modal:
  `state.awaiting` says a capture is owed and `state.mover` says who owes it,
  because `rules.js` has already flipped the turn by then. `play()` accepts
  `remove: -1` and `takePiece()` finishes the job later, so one `undo()` still
  reverses a whole go, and a save taken mid-capture just stops one move short.
- **The evaluation function needed two corrections, both found by playing
  positions out in node, not by reading the code.** First, material has to
  outrank a standing mill: a captured piece never comes back, and with a mill
  priced above a piece the search declines free captures. Second — and this is
  the one to copy into Battleship's endgame — **a fixed-depth search with no
  repetition awareness draws three games in four.** Both sides shuffle a piece
  back and forth for ever. Scoring an already-twice-seen position as 0 near the
  root fixes it in six lines, because a draw is worth nothing to whoever is
  ahead. Measured before and after; the draw rate is the number that moved.
- **"Always take a win it can see" does not generalise to "always take a
  mill."** Two test positions were written asserting it and both were wrong: from
  an open board, building a double threat beats cashing one mill, and in a
  cramped position a mill can freeze three of your four pieces — played out, the
  greedy line loses a piece back and the patient one wins. Easy still follows the
  rule of thumb, because an opponent that walks past a capture reads as broken;
  Medium and Hard are left to search. Only a capture that *ends the game* is
  worth asserting as forced.

Extras beyond the brief, all lifted from Connect Four: undo (over the computer's
reply, and un-counting a finished game), a hint that names a spot and its reason,
threat warnings, a seven-page lesson drawn with the real board's own code, a
running score, the flip-the-screen mode, and the depth/nodes/ms panel. New here:
a row of counters per player showing what is still in hand and what has been
lost, so nobody has to count the board.

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
