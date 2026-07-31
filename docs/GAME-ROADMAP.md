# Game roadmap

Four games planned, **all four now built**. This file is the handover between
sessions: it holds the briefs, the cost estimates and the decisions already made,
so a fresh session can start building without re-deriving any of it. Nothing here
is outstanding work any more — what it is now is the record of what each game
cost against what it was estimated at, and of the handful of things that turned
out to be worth knowing in advance.

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
| 2 | ✅ Mastermind | `mastermind/` | 700–900 → **2,817 actual** | 180k–280k → **~330k actual** |
| 3 | ✅ Nine Men's Morris | `nine-mens-morris/` | 1,000–1,400 → **2,928 actual** | 300k–450k → **~500k actual** |
| 4 | ✅ Battleship | `battleship/` | 1,800–2,600 → **3,072 actual** | 550k–850k → 700k–1.1M → **inside it** |

For scale, the games measure: Yatzy 3,098 lines, Battleship 3,072, Nine Men's
Morris 2,928, Mastermind 2,817, Connect Four 2,202, Footy Tactics Lab 2,048,
Times Table Blaster 1,186, AFL Goal Kick 1,058, Robo Rules 913.

**Three games in, the line estimates looked consistently ~2.5× low. Battleship
was the first to come in under its adjusted figure, and the reason is the useful
part.** The correction was being applied as a multiplier, and the thing being
corrected for is not a multiplier — it is the fixed ~2,000 lines of house
furniture that every game pays whatever it is. Battleship's own game logic
(`rules.js` 320 + `ai.js` 271) is *smaller* than Morris's, and its two full
screens cost less than feared because they share one grid builder. The rule that
actually holds across four games:

> **lines ≈ 2,000 + the game's own logic.** Estimate the second term only, and
> do not scale the first one by anything.

Mastermind is the data point that says the floor matters more than the game:
its rules and solver together are 536 lines, and the other 2,280 are the house
furniture. **Every game in this repo costs about 2,000 lines before it does
anything.** That is the number to plan Battleship around.

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

**Battleship came in at 1.4× Connect Four, not 4×, and the ranking rule is still
right — it was the arithmetic on top of it that was wrong.** Hidden information
and two full screens genuinely were where the work went; they just landed on top
of a fixed floor rather than multiplying it. Rank games by how much a second
person can see, then add, don't multiply.

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

## 2. Mastermind — `mastermind/` ✅ built

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

### What shipped, and where it differs

2,817 lines, ~330k tokens, one session. The brief was right about everything it
covered; five things are worth carrying into Battleship.

- **The brief's own warning was the cheapest bug to avoid and the most valuable
  thing to test.** Scoring is written once in `rules.js` the way the brief says,
  and a second time in `ai.js` by the other route — whole-code colour overlap
  minus the exact matches — because the solver needs it as one packed integer.
  Checking those two against each other over all 1,296² pairs costs nothing and
  pins the function down completely. **Do the same in Battleship**: any rule
  worth getting right is worth computing twice.
- **Knuth's published numbers are an acceptance test, and they should be used as
  one.** Hard plays all 1,296 secrets in about 40 seconds of node and comes back
  max 5, mean 4.4761 — the known figure to four decimal places. Nothing else in
  this repo has been verifiable to that standard. The distribution is
  `{1:1, 2:6, 3:62, 4:533, 5:694}`. If a future change moves any of those, it
  broke something.
- **The difficulty ladder came out of measurement, not taste, and the first
  attempt was wrong.** Easy was written as a forgetful solver that only checked
  the last row of pegs; played out over 432 secrets it *failed to crack the code
  78% of the time*, which reads as faulty rather than easy. What shipped is
  **Easy ignores the white pegs** — it never contradicts anything it has been
  told, it just misses everything the whites were saying. Measured: cracks it
  99.6% of the time in about 7 goes, against Medium's 4.65 and Hard's 4.476. It
  is also the only one of the variants that can be explained to a child in one
  sentence, which is why the setup sheet now says exactly that.
- **A saved game was being wiped on every visit, and the same bug is live in
  Connect Four.** `save()` derived the stored game from `state` — and boot calls
  `setMuted()`, which calls `save()`, before any game exists, so `game: null`
  went straight over the top of it. It survived one reload only because the
  snapshot had already been read into memory. Fixed here by making `savedGame`
  the record and having `save()` refresh it rather than re-derive it. **Worth
  fixing in `connect-four/js/app.js` and checking in `nine-mens-morris/`.** The
  browser check that catches it is reloading three times, not once.
- **Two bugs were invisible in a screenshot and obvious from measurement, which
  is the Morris lesson again.** A white peg on a white card was pixel-identical
  to an empty socket in the light theme — two thirds of the feedback silently
  missing — and `fit()` only ever shrank the board, so a tablet showed a phone-
  sized one in a sea of empty space. Also worth knowing: **`offsetParent` is null
  for every `position:fixed` element**, so the obvious way to count what is
  visible reports every overlay in the app as hidden. Use `getClientRects()`.

Extras beyond the brief, mostly lifted from Connect Four: undo, a hint that
fills the row in *and* names its reason, a running two-player match score, the
flip-the-screen mode, the seven-page lesson, and the depth/nodes panel — here
reporting how many codes still fit, which is far more legible to a child than a
node count. New here: three puzzle sizes (3/4/5 slots, the 3-slot one with no
repeats for a five-year-old), a shape on every peg for colour blindness, a live
"N codes still fit" counter, and a warning when the row you are about to play is
one your own pegs have already ruled out.

Two decisions worth recording:

- **The difficulty row is hidden in the commonest mode, and that is correct.**
  Setting a code takes no skill, so the computer only has a difficulty when it
  is the one *guessing*. In "crack the computer's code" the puzzle size is the
  difficulty. Rows hidden rather than disabled, as everywhere else.
- **Two-player is round-based with the roles swapping**, scored on goes used —
  a single round leaves the setter with nothing to do for ten turns. A round
  that runs out of goes scores `guesses + 2`, or never cracking a code would
  look better than taking every go and getting there.

Not solved, and the same question Battleship has to answer: the secret sits in
`localStorage` and in memory, so two-player secrecy holds against a sibling
looking over your shoulder, not against one who opens devtools.

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

## 4. Battleship (Морски бой) — `battleship/` ✅ built

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

### What shipped, and where it differs

3,072 lines, one session, inside the token estimate. The brief was right about
the shape of the game and about the AI; five things are worth carrying forward.

- **Secrecy came out structural, and it cost almost nothing.** `Rules.publicView`
  turns a board into the shots fired at it plus the squares of ships already
  sunk — everything the shooter has been told out loud, and nothing else. The
  computer, the hint button and the grid you shoot at all take a *view*, never a
  board, so there is one function to check rather than a dozen call sites, and
  the opponent's fleet is not in the page at all. The handover screen then
  *hides* both game screens rather than covering them. Both were verified by
  counting in the browser, not by reading the code: `0` elements matching `.sq`
  anywhere on the page during a handover, and `0` matching `#enemyGrid .ship` at
  any point in a game. **Do the same next time a game has hidden state** — it is
  cheaper than auditing, and it is checkable.
- **What is *not* solved is the same thing Mastermind left open**, and it is
  worth being honest about: a resumable game has to write both fleets to
  `localStorage`, so two-player secrecy holds against a sibling looking over your
  shoulder, not against one who opens devtools. Placement is *not* saved (it
  takes twenty seconds to redo), and a resumed two-player game comes back
  through the handover screen, because whoever picks the device up is not
  necessarily whoever put it down.
- **The difficulty ladder was measured, and the brief's Easy was wrong.** 400
  full games each on the classic sea (17 ship squares in 100): pure random
  **95.8** shots, Easy **63.3**, Medium **50.4**, Hard **44.6**. The brief said
  "pure random at Easy" — at 96 shots out of 100 squares that is not an easy
  opponent, it is a broken one, and the game never ends. Easy is instead
  "shoots anywhere, and pokes next door when it hits something, but never
  notices that two hits in a row point somewhere". Same shape as Mastermind's
  Easy: it never contradicts what it has been told, it just misses one idea, and
  it can be explained to a child in a sentence. Hard's 44.6 is the published
  figure for probability density, which makes it an acceptance test.
- **Density needs no separate hunt/target mode, and that is worth copying.**
  Count every way each surviving ship could still be lying and add one to each
  square it covers. When a hit has no sinking to explain it, count *only* the
  placements covering that hit, weighted by how many they cover. Following the
  line falls out of the arithmetic — there is no second code path to keep in
  step with the first. The whole thing is 40 lines.
- **Compute anything worth getting right twice, again.** `density` is written
  flat and fast; the node harness recomputes it the slow obvious way from the
  placement rules and compares every square. Ship damage is kept as a running
  count while firing and recomputed from the shot marks afterwards. Undo does
  not unwind the board at all — it truncates the shot log and calls
  `Rules.restore`, which is the path already tested hardest, so there is no
  second way of reversing a shot to get wrong. 1,300 assertions, all in node.

Two layout notes, both of which cost more than the AI did:

- **Two boards on one screen is a sizing loop waiting to happen.** The little
  grid was first sized from the box it sits in — which grows to fit it. It
  settled at a different size depending on which screen you arrived from. The
  fix is that only *one* of the two boards may be measured from its parent: the
  big one is, and the little one is told a size worked out from the viewport.
  Where the two boards sit relative to each other is a media query, so `ui.js`
  reads `flexDirection` off the side column rather than writing the breakpoints
  out a second time.
- **A phone on its side is the case that breaks.** A flex column inside a flex
  row needs `min-height:0` or it spills off both ends of the screen instead of
  shrinking — which it did, over the top bar and under the buttons. Seven
  viewports are now checked by measuring `scrollHeight > clientHeight` on every
  box on both game screens, which found it; the screenshot did not, because the
  overflow was drawn outside the area anyone was looking at.

Extras beyond the brief, mostly lifted from the other three: undo (steps back
over the computer's reply), a hint that names a square *and* the reason, a
running score, the flip-the-screen mode, the seven-page lesson — every picture in
it drawn by firing real shots at a real board through `Rules.fire` — and the
menu's what-was-it-thinking panel. New here: three sea sizes (6×6, 8×8, 10×10),
an optional extra-go-after-a-hit rule, two-tap firing so a mis-tap never costs a
turn, ships that slide back onto the board rather than being refused when you tap
near the edge, and a heat map in the menu showing where the computer thinks
*your* ships are — which is the most useful thing in the game for teaching a
child not to hide them all in one corner.
