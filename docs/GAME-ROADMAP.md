# Game roadmap

Four games planned, **all four now built**, plus two added later that were never
on the original list — Deal or No Deal (§5) and Lemonade Stand (§6). This file is
the handover between sessions: it holds the briefs, the cost estimates and the
decisions already made, so a fresh session can start building without re-deriving
any of it. Nothing here is outstanding work any more — what it is now is the
record of what each game cost against what it was estimated at, and of the
handful of things that turned out to be worth knowing in advance.

Build conventions are in [`../CLAUDE.md`](../CLAUDE.md). Catalogue fields are in
[`../README.md`](../README.md#add-a-new-game).

## Decisions already made

- **Every game is `players: [1, 2]`.** Two people face to face on one device,
  *and* one person against the computer. Both modes, every game — including
  Mastermind, which is a two-player game (one sets a code, the other breaks it)
  before it is a solver showcase. (Deal or No Deal, added later, is the one
  exception at `[1, 3]` — see §5. It takes three because each player has a
  separate board rather than a shared one, which is a different arrangement
  entirely and not something the other four could copy.)
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
| 5 | ✅ Deal or No Deal | `deal-or-no-deal/` | not on the list → **3,063 actual** | not estimated |
| 6 | ✅ Lemonade Stand | `lemonade-stand/` | 3,600 → **2,790**, then **3,318** (till + risk), then **4,089** (pacing + one-at-a-time) | 600k–900k |

For scale, the games measure: Lemonade Stand 4,089 (comfortably the largest in
the repo), Yatzy 3,098, Battleship 3,072, Deal or No Deal 3,063, Nine Men's
Morris 2,928, Mastermind 2,817, Connect Four 2,202, Footy Tactics Lab 2,048,
Times Table Blaster 1,186, AFL Goal Kick 1,058, Robo Rules 913.

**Deal or No Deal is a fifth data point for `lines ≈ 2,000 + the game's own
logic`, and it lands on it.** Its rules and Banker together are 545 lines; the
other 2,518 are the house furniture. It is also the cheapest game in the
collection per line of anything interesting, because it has no search in it at
all — see §5.

**Lemonade Stand is the counter-example worth keeping next to it.** It has grown
to 4,089 over three passes without its economy getting much bigger — `economy.js`
is 900-odd lines of the total. The growth is all *pacing*: a step-through morning,
a day that stops to be read, a bank book, a cause-and-effect panel. **Teaching a
thing costs more lines than modelling it**, and none of that shows up in an
estimate that only counts the rules.

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

## 5. Deal or No Deal — `deal-or-no-deal/` ✅ built

Not on the original list. Added afterwards, from a one-line brief: *"1, 2 or 3
human players, use some of the elements from previous games, follow the real game
mechanics with box openings and offers."*

- 10, 16 or 22 boxes holding a money ladder from 1c to $250,000. Keep one back,
  open the rest to a fixed schedule, and the Banker calls after every round.
- Deal and you bank the money; no deal and you play on. Two boxes left is a
  final offer and then the swap.
- Catalogue: `category: "board"`, `players: [1, 3]`.

3,063 lines, one session. Five things are worth carrying forward, and the first
two are the ones that would have cost a lot to find late.

- **The mean cannot rank the difficulties, and it is a trap laid by the game
  itself.** Refusing every offer wins the board average *by construction* — your
  box is a uniform pick from the ladder — so a greedier Robo always has the
  higher mean take. Measured on the first attempt, Medium and Hard came out
  "better" than Easy on mean while dealing in 18% and 0% of games respectively:
  they were not hard opponents, they were opponents that never played. What
  separates good from bad here is the **median** and how often you walk away with
  small change. On those, the shipped ladder is monotone both ways: Easy $2,550
  median and busts 46% of the time, Medium $10,100 / 23%, Hard $12,000 / 7%,
  with Hard within a few hundred dollars of the best any fixed threshold manages.
  **Before tuning a difficulty ladder, work out which number actually moves.**
- **Difficulty must not touch the rules, only the opponent — and this game
  proves why by breaking when it does.** The first cut had the Banker get
  stingier at Hard *and* Robo get shrewder. Those pull opposite ways: a meaner
  Banker shrinks Robo's takings too, so "Hard" measured as the level with the
  *lowest* score to beat. There is now one Banker for everybody and difficulty is
  Robo alone, which is what Connect Four, Morris, Mastermind and Battleship all
  do already. The board-size picker is where "how hard is this game" lives.
- **No search, and that is the whole cost story.** The board is pure chance;
  there is nothing to work out about it. What replaces `ai.js` is `banker.js`, a
  *price* — the average of what's left, times a cut that climbs each round, times
  a discount for how much of that average rides on one box. 208 lines, no tree.
  It is why this game came in at Battleship's size while being much less work:
  rank by how much a second person can see *and* by whether there is a search at
  all.
- **The acceptance test wrote itself, and it is the best one in the repo.**
  Never dealing must average the ladder mean exactly — a known number, not a
  judgement, the equivalent of Knuth's 4.4761 or density's 44.6. Measured over
  40,000 games per board it lands within 0.5%, and *swapping at the end changes
  nothing*, which is the counterintuitive half and so is measured separately.
  The average is also computed two ways throughout (running remainder vs the
  whole ladder minus the opened set) and compared after every single opening.
  390,000 assertions, all in node.
- **A fairness panel at p = 0.05 cries wolf one run in twenty, and a test nobody
  believes is worse than no test.** The 22-box check failed a build on a
  perfectly good shuffle. Repeated runs showed mean chi-square landing within a
  point of the degrees of freedom every time — the shuffle was never the problem,
  the false-alarm rate was. The in-game panel now draws its line at p = 0.01, and
  the build gate checks the *mean* over ten runs instead of one run against a
  threshold. Yatzy's dice check has the same 1-in-20 property and is worth
  revisiting.

- **"Too fast" was not a tuning problem, and reading it as one would have wasted
  the fix.** Play-tested, opening a box had no tension in it. The obvious
  response is to make the pauses longer, and it would not have worked: the
  original `openBox()` called `Rules.open()` and `render()` in the *same tick as
  the tap*, so the amount was on screen before the finger left the glass, and
  every millisecond of delay after that was a cooldown on a question already
  answered. The gap between committing to a box and knowing what is in it — the
  only place suspense can live — was exactly zero, and no amount of retuning
  creates a phase that isn't there. What shipped is a three-beat opening (hold →
  reveal → settle) with **`Rules.open` moved to the reveal**, so during the hold
  the amount is not in the game state, not in the DOM and not in the save. It is
  checkable, and it is checked: a browser test watches every frame between the
  tap and the reveal and asserts the box still shows its own number and its
  amount appears in no box and on no struck-out rail. **When something feels
  wrong, find the missing phase before reaching for the constants.**
- **A pace setting, because the right answer differs by play-through.** Quick /
  Normal / Full drama, defaulting to Normal, as an ordinary `chooser()` row. The
  first game wants the full treatment; the fifth 22-box game does not. It also
  gave the browser suites something they badly needed — a `DND.debug.setSpeed()`
  hook scaling every delay, without which a three-player 22-box run goes from a
  minute to many and the drivers' guard loops time out on a game that is working
  perfectly.
- **Reduce the motion, not the suspense.** Under `prefers-reduced-motion` the
  box stops rattling but still lifts, still lights up, and waits exactly as long.
  Worth knowing: the reset needs `.box.opening` named explicitly, because a bare
  `.box{animation:none}` is one class less specific and loses to it — the rattle
  played on regardless, and only a computed-style check caught it.

Two layout notes:

- **`bestLayout` must apply its size cap after choosing the columns, not
  during.** Capping first makes every roomy layout tie at the maximum and the
  first candidate wins — which on a tall tablet was two columns, drawing a
  chimney of boxes down the middle with the money rails stranded either side.
  Choose on raw fit; among layouts big enough to be capped, the widest wins.
- **Twenty-two amounts down a rail on a phone lying on its side is nine pixels
  each.** The rails switch to two columns when a row would fall under 24px, and
  the text is sized from the row height that actually resulted rather than from
  the viewport. Found by measuring `scrollHeight > clientHeight` on every element
  at seven viewports, not by looking — the overflow was invisible in a screenshot.

Elements taken from the other games, as the brief asked: the setup sheet and its
`chooser`/`setChooser` controls, rows hidden rather than disabled, Yatzy's
flip-the-screen mode and its `crypto` RNG, Battleship's two-tap commit and its
`savedGame`-as-the-record save, the seven-page lesson drawn with the real rules,
the menu's what-was-it-thinking panel, and the running tally. New here: three
players (a first for this repo), the rotating-round turn order, and a lesson that
teaches expected value without ever using the words.

**No undo, deliberately.** Every other game here has one. Opening a box is the
drama, and being able to take it back destroys the game — the two-tap commit
covers the mis-tap that undo was really there for. **No handover screen either:**
nobody, not even the player, knows what is in a box, so there is no hidden state
to protect and Battleship's whole secrecy problem simply does not arise.

## 6. Lemonade Stand — `lemonade-stand/` ✅ built

Not on the original four-game list — the shelf had no game about money, and
`maths` had only Times Table Blaster on it. Solo, one run ≈ 5–10 minutes, aimed
squarely at an 8-year-old.

- Run a stall for a fixed number of days (7 on Easy, 14 otherwise). Each day is
  one loop: **morning** (forecast, today's lemon price, buy stock, pick a price
  from five preset tiles — no typed numbers), **selling** (a short animation over
  an already-decided result), **evening** (the sums in words, then bank / half /
  pocket), **night** (interest lands, any loan's running cost is noted).
- Demand is `footfall(weather) × pull(price) × event × jitter`, plus your regulars
  (§ fifth and sixth passes; it was `× reputation` until the fifth), and
  is monotonically non-increasing in price. Reputation (0–100, drawn as stars) is
  what makes 75c beat $1.00 across a fortnight while $1.00 wins on any one day.
- **Interest both ways.** The bank pays 3c a night per dollar banked and charges
  6c a night per dollar borrowed — twice as much — and the game says exactly
  that. One loan at a time, fixed repayment stated up front, never offered if it
  would fall due after the last day, settled automatically, any shortfall written
  off. Debt cannot grow and balances never go negative.
- A four-rung savings goal is pinned to the topbar all run ($30 / $60 / $90 /
  **$120 a bike** on Normal). Three shop items: two that earn their money back
  and one ice cream that does nothing at all.
- **Catalogue**: `category: "maths"`, `players: [1, 1]`, `age: 8`.

**Watch for**: the balancing is a measurement job, not a taste job — build the
economy and the node sweep before wiring a single button.

### What shipped, and where it differs

**2,790 lines against an estimate of 3,600** — one session, and the second game
to come in under. The rule held; the estimate of the *second* term was too fat.
This game's own logic is `economy.js` 665 + `chart.js` 106 + `rng.js` 70 = 841
lines, not the ~1,500 guessed, and the house furniture came to ~1,950. So
`lines ≈ 2,000 + own logic` predicted 2,841 against 2,790 actual.

The lesson repeats Battleship's: **the fixed floor is the reliable part of the
estimate and the game-specific part is the one that gets inflated by anxiety.**
An economy is a page of arithmetic. What made this game feel expensive up front
was the number of screens, and screens are house furniture — already paid for in
the 2,000. Five phases cost less than Battleship's two boards, because none of
them is a bespoke geometry problem.

**The sweep earned its keep three times over, and every one of the three was a
number that looked fine and taught the wrong thing.**

- **`$1.00` was quietly the best price.** The tiers had been tuned against
  revenue per customer; what a run accumulates is *profit* per customer, and at
  a 40c cup `0.62 × 60c` beats `1.00 × 35c`. The game would have taught "charge
  as much as you can get away with". Dropping the $1.00 pull to 0.52 put the
  peak back on 75c where the lesson is.
- **Banking everything made you poorer.** Money in the bank was not spendable in
  the morning, so banking your takings starved the stall of the cash it needed
  for tomorrow's lemons: pocketing finished at $136 against banking's $48, and
  the game taught the exact opposite of its third lesson. Spending now draws
  pocket-first then bank, free and instant. **The lesson is "money you leave
  alone grows", not a liquidity puzzle — and that had to be a design decision
  rather than an accident.**
- **5c a night was too generous.** It made interest 48% of a well-played
  fortnight, which teaches "don't bother trading". 3c lands it at 33%.

**The goal price is the one number that cannot be reasoned out, only read off a
distribution.** $120 was picked because it separates the lessons rather than
because it is any particular percentile: good play reaches it 82% of the time,
buying an ice cream every day drops that to 20%, gouging at $1.50 gets 9%, and
selling under cost gets 0%. Those five numbers are the acceptance test now — if a
later change moves the ranking, it broke the teaching, not the code.

**One assertion had to be weakened, and weakening it was the honest move.** The
brief claimed never banking should be unable to reach the bike. It reaches it
56% of the time, because pocketed money is just as safe in this game — hoarding
forgoes the interest, it doesn't lose. Asserting the *gap* (82% vs 56%) states
what the model actually does; the original assertion would have been asserting a
punishment the design never had.

Verification split the way Morris predicted: 78,838 node assertions over the pure
economy (the money invariant — every balance and every ledger field an integer
and a multiple of 5c — caught the most), and 162 browser checks for the things
that are genuinely visual. Two browser "failures" were the test being wrong, not
the game: `3c a night for every dollar` is a *rate*, not a coin, and the goal bar
was measured mid-transition.

Extras beyond the brief: a shut-the-stall day (a child who can't afford lemons
still has to reach tomorrow), Grandma's $2.00 floor so nobody is locked out of
the back half of a run, an ice bucket that makes leftovers keep, and a result
chart that shades the gap between what you had and what you would have had
without the bank — the compounding is an *area*, not two lines that happen to
diverge.

Decisions worth recording:

- **Seeded RNG, the opposite of Yatzy.** Yatzy draws from crypto so a roll can't
  be replayed; here a day must be. The save holds a seed and a ledger, not a
  pre-rolled fortnight, so resuming regenerates the same forecast and the same
  lemon price. Closing the tab on a scorcher and coming back to rain would look,
  correctly, like cheating.
- **Money is integer cents everywhere, with one rounding function and one
  formatter, both called only at the edges.** Every visible amount is a multiple
  of 5c like real Australian cash. This is the single most useful constraint in
  the game and it is worth copying wholesale into anything else that handles
  money.
- **Icons need a build step of their own.** There is no ImageMagick, rsvg-convert,
  Inkscape or PIL on the box. The three PNGs come out of headless Chromium
  screenshotting an inline SVG at 192, 512 and 180.

### Second pass: the till, risk, and making the prize rare

Three things were asked for after the first build: customers should pay with a
note so the child has to count out change, the game should have real risk and
reward, and **the top prize should be rare**, because the point is that big
things take work and consistency rather than a dopamine hit.

**The till.** Up to two customers a day (one on Easy) pay with a note instead of
the exact money, and the day stops until the change is counted out of real
Australian coins. Exact change sometimes earns a tip; too much is simply gone,
and the customer keeps it; too little is noticed and costs reputation. The
running total is shown on Easy and Normal and **hidden on Tricky**, which is the
difficulty dial that matters most — with it on, the child checks the arithmetic
as they go; with it off, they have to hold the sum in their head.

Two rules made this safe rather than fiddly:

- **Nothing at the till moves a balance.** Tips and overpayments accumulate on
  the run and are paid in as one lump at `closeDay`, so a day abandoned
  half-served replays from the start instead of paying out twice.
- **Skip may skip the animation, never a sum.** `fastForward` jumps to the next
  customer owed change, not past them, and the visibility handler explicitly
  refuses to fast-forward while somebody is waiting. Otherwise the arithmetic —
  the whole mechanic — would be optional, and free money.

**Risk.** Six events, revealed when the stall OPENS and never in the morning:
you commit your money to stock and a price first, and then the world happens.
A rival stall halves the crowd, wasps take 40% of the stock before you sell a
cup, a downpour sends everybody home; a parade or an early school pickup goes
the other way. Normal runs 30% event days at roughly 2:1 bad-to-good. Measured:
an ordinary day makes $8.42 and a bad day makes $2.14.

**The rare prize, and how it was set.** The bike went from $120 to $200 and the
whole distribution moved under it. The acceptance test was rewritten from
scratch, because the old assertions encoded the *old* design goal — "good play
should usually get the bike" is precisely what is no longer wanted. What it
asserts now is the ordering and the size of the gaps:

| how it is played | median | gets the bike |
| --- | --- | --- |
| reads the weather, banks, sums right | $166 | **34%** |
| ...but half the till sums wrong | $147 | 26% |
| ...but every till sum wrong | $127 | 15% |
| steady, but never adapts the stock | $130 | **0%** |
| ...and an ice cream every day | $99 | 0% |
| ...and never banks a cent | $109 | 2% |
| charges $1.50 for everything | $68 | 0% |
| sells at 25c, under what they cost | $2 | 0% |

**That 0% for "steady but never adapts the stock" is the consistency lesson
working.** A child who buys the same fifteen cups every day and plays perfectly
otherwise finishes around $130 and never gets there, because the bike needs the
hot days to be backed properly. One good day is not enough; a fortnight of
paying attention is.

**The floor matters as much as the ceiling.** A well-played run reaches rung 2
or better 90% of the time and finishes with nothing 0% of the time. A rare top
rung reads as failure without that, and a child who feels the game is
unwinnable learns nothing at all.

Decisions worth recording:

- **Assertions encode design intent, so changing the intent means rewriting
  them, not weakening them.** The first build asserted "good play usually gets
  the bike" and passed; the same assertion is now exactly the thing that must
  fail. Keeping it and loosening the bound would have hidden the change.
- **A rate is not a coin.** `3c a night for every dollar` is quoted to the cent
  like a real interest rate, while every payable amount stays 5c-clean. The
  browser check that scrapes visible money had to learn the difference.
- **The panel has to fit before the sum is worth asking.** On a 360x640 phone
  the coin pad pushed "Give it to them" below the fold inside the panel's own
  scroller — no page overflow, so the layout check passed, and a child would
  still have been stuck with a customer waiting and no visible way to pay them.
  The stall scene now gets out of the way while the till is open, and the
  buttons are sticky.

### Third pass: pacing, cause and effect, and a purse worth borrowing against

Playing it properly turned up five things, four of which are the same complaint:
**the game showed correct numbers too fast and all at once.**

**The morning asks one question at a time now.** It used to put four decisions
and six facts on one screen. It is now a walk-through of sheets — the weather,
then how many cups, then what to charge, then a recap — with the answers kept on
a plan card behind, one line each, tappable to change. `#step` reuses the how-to
carousel's furniture. The weather deliberately gets its own sheet: reading it
*before* committing money is the lesson, and folded into the buying step it
would have been decoration above a button.

Two details that matter for anyone doing this again:

- **One set of controls, two ways in.** `#buyBig`, `#priceChooser` and the rest
  live in the step sheet and keep their ids. With the walk-through off, a plan
  row opens that same sheet as a *single* step that closes on Done. There is no
  second layout to maintain, and the browser checks only needed teaching where
  to tap.
- **The bank has to be offered where the money runs out.** The buying step shows
  the 15-cup pack greyed out when you can't afford it; without a "the bank will
  lend you $5" row right there, the whole borrowing mechanic is two sheets away
  and never gets found.

**The day stops and waits.** The selling animation ran at `4000/want` ms and
then the evening arrived on its own and wiped it. It now runs at `6000/want`
(floor 110ms, ceiling 320ms), carries a permanent legend saying what 🙂 and 😕
mean with live counts, and ends on a `#dayDone` card that holds until tapped.
Skipping skips the animation, never the hold and never a till sum.

**The evening says what caused what.** A `#causes` panel pairs every decision
with its consequence — *"You made 20 cups for $4.80 → you sold every one, and 3
more people wanted one you didn't have"*, *"You charged 75c → each cost you 40c,
so you kept 35c of every cup"*. The evening used to report outcomes without
naming the decision that produced them, which is the difference between a
scoreboard and a lesson.

**The bank book.** Interest was one sentence. It is now a sum laid out the way a
sum is laid out on paper — last night, what the bank added, tonight — with the
total counting up in 5c steps (never a raw number tween, which would print
fractions of a cent), the running total paid so far, and a bar per night that
grows across the fortnight. `Chart.bank()` reserves a slot for every night of
the run so the bars march across a fixed row instead of rescaling every evening.

**The till: once a day, worth more, and never the same sum twice.**

- `changes: 1` everywhere. Two a day was a chore that got tapped through.
- Stakes up to compensate: tips 20-50c at 55%, short-changing costs 4 reputation
  a time. **Measured: the gap between getting every sum right and every sum
  wrong is still 19 points on reaching the bike (32% vs 13%), so the >15-point
  assertion did not have to move.**
- `paymentFor()` replaces `noteFor()`: four shapes — a single piece, a piece
  rounded up so the change comes back a round 50c, a piece plus a stray coin,
  two of the same. **Distinct change amounts per price went from 4 to 20-33,
  with no single sum more than 17% of draws**, and that is asserted.
- **Customers buy more than one.** `partiesFor()` groups the cups the demand
  model already decided into people (68% one, then two, occasionally three), so
  the economy is untouched and the queue stops being a row of identical faces.
  The till sum becomes a multiply *then* a subtract: two cups at 75c is $1.50,
  they hand you a $2 coin.

**The purse got small, and that is what made the bank real.** Starting cash went
from $10.00 to **$3.00** — deliberately not enough for the 15-cup pack, which
costs $3.60-$7.20. The 5-cup pack stays affordable at every lemon price, so
borrowing is a choice and never a requirement. Measured over 1,500 runs:
borrowing early finishes at **$155 against $138**, and reaches the bike **42% of
the time against 32%**. At $10 the loan was decoration; there was no day on which
you needed it.

Everything downstream moved with it and the goal ladder was re-measured, not
guessed: the bike went $200 → **$170** ($30 / $70 / $110 / $170), which puts a
really well-played fortnight back at 32% — inside the 25-45% band the second
pass set. Easy's ladder came down to $10 / $20 / $30 / $42 and sits at 69%.

Decisions worth recording:

- **A smaller purse is a better teacher than a bigger goal.** Making the prize
  dearer only makes the run longer; making the *starting capital* tight makes
  every early decision matter and gives the bank something to do. If a mechanic
  is being ignored, look at whether the player is ever short of anything.
- **"Buy the big pack" stopped being unconditional advice**, which is a better
  lesson than it was. On day one it is genuinely out of reach, and the honest
  answer is either five cups or a loan — the browser checks had to learn this
  too, because three of them hung on a `#buyBig` that is now disabled.
- **The queue draws people; the money counts cups.** Keeping those two units
  separate is what let parties be added without touching a single balance
  number — `wanted()` still returns cups, and `partiesFor()` only decides how
  they are grouped.

### Fourth pass: the decision screens, the purse, and a pay-off

Played again, and the complaints were all one complaint wearing four hats: **the
one-question-at-a-time sheets from the third pass were the old screens moved
into pop-ups, not screens designed to be pop-ups.** A sheet covers everything
behind it, and what it covered was the purse, the coach and every button.

**A sheet that asks you to spend money now shows the money.** `Ui.purseInto()`
draws the same three chips — purse, bank, what you owe — into the step sheet,
the bank sheet and the shop sheet. The topbar copy is still there for the
uncovered screens; this is the same component, labelled, because a sheet has
room to say which number is which.

**The buying screen carries everything the buying decision needs.** It used to
carry two pack buttons and a link to the bank; the ice bucket and the big sign
were three taps away behind a 🎁 button on a screen you only see with the
walk-through turned off, and the loan came *after* you had already decided about
the lemons. It now carries, in order: today's lemon price, the packs, the
basket, **the bank's live offers inline**, and **the shop**, with anything
already owned dropped from the list so the shelf only ever holds live decisions.
`loansInto()` and `shopInto()` render into whatever node they are handed, so the
inline copy and the sheet copy cannot drift.

- **"Offered where the money runs out" was right and did not go far enough.**
  The third pass showed a borrow row only when you were short of the 15-cup
  pack — so a child who could afford a full stall but wanted more never met the
  bank at all. The offers are now always on the buying screen.
- **A tip belongs on the screen it is a tip about.** The coach lives on the
  morning screen, under the sheet. Each step now has its own line: the buying
  step names the shortfall and points at the offer below it, the price step
  names what the lemons cost, the ready step says what is missing.

**Red means walking away.** "Don't buy any", "Stay shut today" and "Give up and
start again" were the same green as "Open the stall". They are `.btn-no` now,
and `--no` is a separate colour from `--bad` so that a warning and a decline
don't have to share a swatch.

**The 15-cup pack had a gold border and no meaning.** It read as *selected* on a
pair of buttons where nothing is ever selected — they are tills you tap. Both
packs are identical now and the saving is a chip that says `save $1.35`.

#### The purse was redundant, so it was given a cost to avoid

Money in the bank paid interest and was spendable, so **"bank every last cent"
was strictly correct every night** and the evening's question was not a
question. Fixed with one number: fetching money out of the bank costs a flat fee,
charged the first time you dip in on a given day and never again that day.

The size was measured, not chosen. Keeping $X in your purse forgoes 3c per
dollar per night, so a float only pays for itself when
`FEE × P(it covers the day's shopping) > 0.03X`. Over 1,200 fortnights:

| fee | float | bank every cent | keep the float | never bank |
| --- | --- | --- | --- | --- |
| 25c | $5 | **$117.60** (fees $3.25) | $115.10 (fees $1.79) | $85.25 |
| 50c | $5 | $112.40 (fees $6.50) | **$112.50** (fees $3.57) | $85.25 |
| 50c | **$8** | $112.40 (fees $6.50) | **$113.20** (fees $2.09) | $85.25 |
| 75c | $8 | $106.55 (fees $9.75) | **$112.00** (fees $3.12) | $85.25 |

**At 25c the mechanic was decoration** — banking everything still won, which is
the exact thing it was added to fix. 50c with an $8 float is the first cell
where the ordering flips, and 75c only widens it by making the toll punitive.
The two strategies finish within a dollar of each other, which is the target:
neither should dominate, or it stops being a decision again. What makes it
*teachable* is not the aggregate, it is that the fee is named four times on the
day it happens — a toast when it is charged, a line in the evening sums, a row
in "what your choices did", and the tip on tomorrow's buying screen.

**The big lesson is untouched: never banking finishes at $86.30 against $113.40,
and reaches the bike 2% of the time against 22%.** The consistency lesson holds
too — steady 15 cups a day still reaches the top rung 0% of the time.

The evening's question grew a fourth answer, `bankChoice(run, "float")`, and all
four buttons now print the actual money underneath: *Bank half — bank $6.25*.
The recommended one is marked honestly rather than always pointing at the bank:
with $5 in your purse on day two, banking the lot earns 15c of interest and
costs 50c to get back, so **"keep it all" really is the answer** and saying
otherwise would be a lie the child can check.

#### The end of a fortnight has to buy something

The result screen ended on a ladder of tickboxes, which is a receipt. Fourteen
days of saving up now end at a shop counter: the total counts up from the $3.00
you started with, the best thing your money actually reaches lands on the
counter with a pop and a handful of confetti, and it says what it cost and what
you have left. The ladder became a shelf — the things you can afford in colour,
the ones you can't behind the glass with **the gap written on them** (*"$13.15
more and it was yours"*), which is the number a child comes back for.

Two implementation notes worth keeping:

- **A CSS animation only plays on a node that is new to the document.** Setting
  `textContent` on the prize would have shown it without the moment where it
  lands. The emoji element is rebuilt on every draw, and the result overlay is
  un-hidden *before* it is drawn, not after.
- **`countUpTo` had a step, not a duration.** It counted in fixed 5c steps and
  bailed out above 400 of them — so it worked for the bank book's few cents a
  night and silently did nothing for a $170 total. It now sizes the step to the
  distance and keeps it a whole multiple of 5c.

### Fifth pass: the business grows

"Is there a growing-business mechanic?" There was a `rep` score, 0–100, and two
things were wrong with it.

**It was invisible.** It multiplied demand by 0.73…1.27 and appeared nowhere on
screen — no number, no bar, no face. Two sentences mentioned "your regulars" in
passing; that was the whole surface area. (An earlier draft of this document
claims it is "drawn as stars". It never was.)

**And for a child playing well it went DOWN.** Averaged over 600 fortnights:

| how it was played | day 1 | day 14 |
| --- | --- | --- |
| 75c, stocks to the weather | 49 | **46** |
| 75c, steady 15 cups | 49 | 50 |
| 75c + the big sign | 49 | 76 |
| $1.50 | 44 | 5 |
| every till sum wrong | 45 | 5 |

Reading the forecast and stocking tightly means selling out, and selling out
cost 3 a day against the +2 a fair price earned. **The punishment side worked
loudly and the growth side was only reachable by buying the sign or by
underpricing.**

**Regulars replace it: a count, not a score.** Demand is now
`passers-by + your regulars`, two halves a child can reason about separately —
the weather decides one, you built the other. Regulars turn up whatever the sky
is doing (`REG_WEATHER`, 0.35 in freezing rain up to 1.0 when it's hot), forgive
a price rise a stranger wouldn't, and a rival stall up the road only tempts away
some of them. That is the whole value of having them, and it is what makes a bad
day survivable rather than merely cheaper.

**You win them by serving people, not by avoiding mistakes.** The old rule
punished you for turning people away. The new one doesn't: the people you turned
away simply never become regulars. That is the honest shape of the loss — an
opportunity missed, not a fine — and it is what fixes the direction. Growth
scales with cups sold (`GROW_AT = 10` for a full day's worth), capped per day, so
the loop is **linear in regulars and compounding in money**: predictable enough
to measure, and the stall still visibly grows.

| how it's played | regulars, day 14 |
| --- | --- |
| 75c, stocks to the weather | 19 |
| 75c + the big sign | 25 (the cap) |
| $1.00 | 13 |
| $1.50 | 0 |
| every till sum wrong | 0 |
| half the till sums wrong | 8 |

The whole run moved with it, and stayed inside its bands: good play goes from
22% to **30%** on the top rung, still inside the 25–45% the second pass set;
never banking still finishes at $94.90 against $125.30; steady-15-cups still
reaches the bike **0%** of the time, so the consistency lesson is untouched.

Two tuning results worth keeping:

- **A harsher till penalty measures as nothing, because the floor saturates.**
  Going from −2 to −4 regulars per wrong sum changed the "every sum wrong" run
  by literally zero — it sits on 0 regulars either way. It only shows up on a
  player who gets *some* wrong: at −2, half-wrong finishes with 8 regulars
  against 19. −2 was kept, because leaving a careless child with a smaller
  business teaches better than leaving them with none.
- **`GROW_AT` barely matters** (10 / 15 / 20 moved the median by 40c). The lever
  that matters is `back` per price tier, not the saturation point.

**Making it visible was most of the work**, and it is deliberately modelled on
the bank book — the same idea in another currency, a thing you build up that
pays you back every day whether you do anything or not:

- the weather step says *"😀 5 regulars will come whatever the weather does"*,
  next to the forecast, so the known half of the crowd sits beside the guessed
  half at the moment you decide how much to make;
- your own faces are starred in the queue and counted in their own legend chip;
- the evening gets a card laid out exactly like the bank book — yesterday, who
  came back, who gave up, tomorrow — with a line naming the reason;
- "what your choices did" gains a row: *"3 of your customers were regulars →
  that's 3 cups you'd have sold whatever the weather did"*;
- the result says what the fortnight actually built: *"you started with nobody
  and finished with 21 regulars"*.

#### Quality check on the regulars, and three things it caught

Played, and the report was that the screen promised 25 regulars and the next day
they weren't there. All three defects were real, and the day-by-day audit that
found them is the tool worth keeping — printing *what the screen said* next to
*what the model did*, one row per day, for a whole run.

**1. The screen was lying, and the model was right.** The weather step printed
`run.regulars` and the words "will come whatever the weather does", while
`wanted()` scaled turnout by weather (0.35 in the rain) and by price. Over a
fortnight only **74%** of promised regulars actually turned up: *"15 regulars
will come whatever the weather does"*, then nine came. Fixed at both ends —
`regularShare()` is now one function that `wanted()` and the morning estimate
both call, so the promise and the turnout cannot disagree, and the screen states
today's honest number: *"About 6 of your 12 regulars will come out in this — the
rest will stay home"*, or *"All 12 of your regulars should come today."*
`REG_WEATHER` was softened to `[0.5, 0.75, 1, 1, 1]` so loyalty means something,
which takes turnout to 82%.

**2. More regulars turned up than existed.** Day 14 of the audit: it said 20 and
served 26. A good event multiplied the regulars — `evReg = min(ev, 1.3)` — so a
parade conjured six loyal customers out of nothing. **A good event brings
strangers, never regulars: a parade cannot make somebody turn up twice.** Every
factor on the regulars line is now `<= 1` and the result is clamped to the count
you actually have, which is asserted in the audit harness rather than trusted.

**3. Regulars were people, and their cups were counted as people.** `wanted()`
returns CUPS; `run.regulars` counts PEOPLE; `partiesFor()` then grouped some of
those cups into two- and three-cup customers. So "5 regulars" on the legend
could be three people. Regulars now buy one cup each and are kept out of the
party grouping, which makes the count mean the same thing everywhere; the field
is `regularCups` rather than `cameBack`, because that is what it is.

**The cap came down from 25 to 12, and it is a decision about the DECISION, not
about the balance.** A stall you can actually stock holds 20–30 cups, so 25
guaranteed customers meant the back half of a run stopped being about the
forecast at all. Measured across 8 / 10 / 12 / 16 / 25 the money does not move —
median $122.45 to $122.50, top rung 28–29% — so nothing was bought with it
except the weather mattering again. Good play now reaches 12 right at the end of
a fortnight, so the ceiling reads as an achievement rather than a wall, and the
big sign gets you there by day five.

Balance after all four changes, unchanged where it matters: good play **29%** on
the top rung, never banking **$93.65 against $124.30**, steady-15-cups still
**0%**, gouging and every-sum-wrong still finish with **no regulars at all**.

### Sixth pass: the stall was permanently oversubscribed

"Too many clients coming back. I can't satisfy the demand with 30 cups a day."
The regulars were the smaller half of that, and the bigger half had been there
since the first build without anybody noticing.

**A child stocking as hard as they possibly could sold out on 91% of days and
binned six cups in a fortnight.** Demand on an ordinary warm day was 22
passers-by, and a hot day 32, against a stall that physically held 40 — so once
a dozen regulars were added on top, every day from warm upwards was
oversubscribed no matter what the child did. The answer to "how many cups?" was
"as many as you can afford", every single morning, and **"don't make more than
you can sell" cannot be taught by a game in which you can never make enough.**

The measurement that made it obvious was demand against *what you can put out*,
rather than demand on its own:

| weather | demand (12 regulars) | fits in 30 cups? | fits in 40? |
| --- | --- | --- | --- |
| cold and rainy | 14 | yes | yes |
| cloudy | 23 | yes | yes |
| warm | 34 | **never** | yes |
| hot | 44 | never | **14%** |
| a scorcher | 54 | never | never |

**Footfall came down about a quarter, to `[6, 10, 16, 23, 29]`, and the stall
went up to 45 cups** — three big packs, deliberately a little more than the
busiest plausible day can ask for. A ceiling has to sit *above* the demand, or
the decision underneath it isn't one.

What that buys is a morning with three real answers instead of one:

| how the stall is stocked | sold out | binned something | finished |
| --- | --- | --- | --- |
| tight (0.8× the forecast) | 82% of days | 16% | $115.00 |
| to the forecast | 55% | 37% | **$127.55** |
| generously (1.3×) | 29% | 67% | $118.75 |

There is a peak, it is in the middle, and both mistakes cost real money — which
is the whole shape the game was missing. People turned away across a fortnight
went from 181 to 53.

**Two things fell out of it that weren't the point but are worth recording.**
The ice bucket finally earns its keep: waste happens on a third of days now
instead of 7%, so it is worth **+$3.70 and three points** on the top rung
instead of being a curiosity. And the till lesson got much sharper without being
touched — every sum wrong now finishes at $82.45 against $127.55, a **23-point
gap** on the top rung where it used to be 10, because regulars are a larger
share of a smaller crowd and losing them all costs more.

**The goal ladder did not move**, which was checked rather than assumed: at
$30 / $70 / $110 / $170 the best play lands at 25-28% on the top rung, inside
the 25-45% band the second pass set, and every ordering holds — steady-15-cups
0%, never-banking 3%, an ice cream a day 10%, gouging and selling under cost 0%
with nothing at all to show for it.

**The withdrawal fee had to be re-measured, and it had stopped working.** It is
a ratio between a flat toll and the interest forgone on an idle float, and the
rebalance changed the size of a day's shopping underneath it: at 50c, banking
every last cent came back ahead by $0.70-$2.20, so the game would have been
recommending a play that loses. At 75c the float is ahead by $3.15 again.
**A tuned constant is only tuned against the numbers it was measured with —
change the scale and every ratio in the game has to be re-run.**

### Seventh pass: the ice bucket was eating the only decision in the game

"Most days I just have to buy the maximum number of lemons. This is not a good
gameplay." The sixth pass had raised the ceiling above the demand and declared
the morning a real question. It wasn't, and the reason was a $4 shop item.

**"Leftovers keep till tomorrow" quietly made overstocking free.** With the ice
bucket bought — and every child buys it, it is cheap and obviously good — an
unsold cup was not a loss, it was a cup bought early. So the sixth pass's peak
in the middle flattened out completely:

| stocked | without the bucket | with the bucket |
| --- | --- | --- |
| 0.8× the forecast | $116.55 | $118.15 |
| **1.0× the forecast** | **$131.10** | $139.25 |
| 1.5× the forecast | $108.80 | $148.45 |
| fill the stall, every day | $88.05 | **$159.60** |

Read the right-hand column: **filling the stall was the best play in the game,
and it took the bike 44% of the time against a thoughtful player's 31%.** Every
sentence the game says about not making more than you can sell was false, and
the child was right to ignore it. That is the whole complaint, and it was one
item.

**A tuned constant is only tuned against the numbers it was measured with —
and that applies to items as much as to rates.** The bucket was priced and
written when waste was rare and the note in the sixth pass ("the ice bucket
finally earns its keep") was the warning: an item that gets *better* as the
economy gets harsher is an item that will eventually cancel the harshness.

Five numbers moved, and the order matters — the first is the fix and the rest
are the consequences of it:

- **The bucket keeps half, and costs $2.50 instead of $4.00.** Insurance, not
  immunity. Measured: it costs a tight stocker nothing (they have no waste to
  save) and pays a generous one $8 across a fortnight, while generous-with-a-
  bucket still finishes behind tight-without-one. Worth buying when you have
  *chosen* to stock deep; never a reason to.
- **Footfall down about a third, to `[5, 9, 14, 20, 25]`.** This is the
  arithmetic the whole morning rests on: a cup costs about 36c and sells for
  75c, so an extra cup pays for itself at a 48% chance of selling — which means
  the profitable stock level sits just *below* the day you expect, and it can
  only sit below it if the expected day is comfortably below what the stall
  holds and what the purse can buy. At 29 passers-by against a 45-cup stall
  neither was true.
- **Lemons 40c → 45c, and the stall 45 → 40 cups.** The nickel is what moves
  break-even sell-through from 43% to 48%, i.e. what moves the best answer from
  a little *above* the expected day to a little below it. The clamp stays at
  60c so the 5-cup pack still never costs more than the $3.00 you start with.
- **Regulars 12 → 8.** A dozen guaranteed customers against a warm day's twelve
  strangers is not a cushion, it is half the shop; the weather has to stay the
  thing the morning is about.
- **Grandma's floor $2.00 → $3.00.** Not a balance change — a bug the rebalance
  exposed. The floor promises "you can always buy the 5-cup pack", that pack
  costs five times the day's lemon price, and at $2.00 the promise silently
  broke on any morning dearer than 40c a lemon. It now equals `START_CASH`,
  which is the only value that can't drift out of true.

What that buys, measured over 3,000 fortnights on Normal with the shop bought:

| how the stall is stocked | sold out | binned something | finished |
| --- | --- | --- | --- |
| 0.6× the forecast | 87% of days | 8% | $54.00 |
| 0.8× the forecast | 83% | 12% | $69.95 |
| **1.0× the forecast** | 56% | 35% | **$82.30** |
| 1.2× the forecast | 40% | 55% | $82.25 |
| 1.5× the forecast | 31% | 65% | $74.80 |
| fill the stall, every day | 29% | 68% | $61.60 |

**The peak is back in the middle and filling the stall is now the worst play on
the board** — $21 behind, binning a third of everything it makes. The optimum is
deliberately broad (1.0× and 1.2× are within a nickel of each other), because a
child should be rewarded for being roughly right rather than punished for
missing an exact number; what matters is that both edges cost real money. That
is the shape the sixth pass claimed and did not have.

**The prize ladder was re-measured rather than re-guessed**, since the user's
other complaint was that the bike came too easily. Normal and Tricky go
$25 / $60 / $100 / **$150**; Easy goes $8 / $16 / $26 / $40.

| how it is played | median | gets the bike |
| --- | --- | --- |
| best play — prices to the forecast, stocks just under, banks the surplus | $89.50 | **8%** |
| stocks to the forecast at 75c | $82.30 | 3% |
| fills the stall every morning | $61.60 | 4% |
| steady 15 cups, never adapts | $71.80 | **0%** |
| charges $1.00 for everything | $64.65 | 1% |
| charges $1.50 for everything | $15.35 | 0% |
| sells at 50c, barely over cost | $11.05 | 0% |

The floor held while the ceiling came down, which is the half that is easy to
lose: a run played to the forecast clears the first rung 95% of the time and the
second 80%, so the fortnight still pays for something. A rare top rung reads as
failure without that.

Two knock-ons had to be chased down, and both are the sixth pass's own lesson
repeating:

- **$1.00 had quietly become the best price again.** Dearer lemons help a dear
  price more than a fair one, because the margin is a bigger share of it —
  measured, $1.00 came back $3 ahead of 75c, which is exactly the thing the
  first build's sweep was written to catch. Its pull went 0.52 → **0.46**,
  which puts 75c back on top — by $18 once the slower regulars are counted,
  since a low-volume price wins fewer of them — and leaves $1.00 a respectable
  second at $64.65. A fall-off teaches; a cliff just removes a button.
- **The shop stopped paying for itself**, which is how the bucket's price got
  measured rather than picked. The big sign is +$1.65 over its $3.00 and the
  bucket at $2.50 is free-to-positive; at $4.00 it was a $4.40 loss, i.e. an
  item that took your money and gave nothing back.

Two things that were wrong before this pass and are worth recording as a class
of bug on their own:

- **The sign's blurb promised ten regulars and the constant gave five.** Both
  strings are now built from `SIGN_REGULARS`, and `takeaway()`'s hardcoded
  `regulars >= 12` is `>= MAX_REGULARS`. A game about money must not print a
  number it does not honour, and the only reliable fix is to not have the number
  written down twice.
- **The how-to taught 40c lemons after the lemons became 45c**, and the evening
  told a child with a bucket that it "keeps the other 6" when it keeps three.
  Every worked example is now derived from the same constants the economy uses.

**`tools/check.js` finally exists.** `economy.js` has claimed since the first
build that it is pure so that "tools/check.js can load this file into plain node
and play tens of thousands of days" — and the harness had never been committed,
so every number in the comments was a measurement nobody could re-run. It plays
policies (fill it / to the forecast / tight / never adapt / one price all
fortnight / best play) across all three difficulties and prints the stocking
curve, the rung-placement table, the shop's value, the float against the
withdrawal fee, and demand by weather against the stall's capacity. `node
tools/check.js` is now the thing to run before and after touching a constant.

One more thing the pass turned up, which is a comment bug rather than a code
one and still worth the entry: **the note on `MAX_REGULARS` claimed good play
reaches the cap "right at the end of a fortnight", and it never did.** Measured,
it lands on day 7 of 14, and 10% of runs never reach it. `GROW_AT` turns out to
be a weak lever on that — 12 / 20 / 30 / 40 move the median only from day 6 to
day 8, because `back` is what sets the pace — so the honest fix was to write
down what the model does (first week the business growing, second week the
business you built) rather than tune the model to match a sentence. **A comment
that states a measurement is a claim, and claims go stale exactly like code.**

### Eighth pass: the business stopped growing on day seven

Two reports, and they turned out to be the same report:

> When there are odd number of cups left the bucket saves less than what gets
> thrown away. Having 1 cup leftover and throwing it away while having a bucket
> is not right.

> Now it is too hard to get anything above 60-70 dollars in 14 days.

**The bucket first, because it is a one-line bug.** `Math.floor(wasted * 0.5)`
means one leftover cup keeps *none* and three keep one and bin two — a bucket
that throws away more than it saves, on exactly the small numbers a careful
stocker actually gets. Half of an odd number has to round somewhere, and the
only defensible direction is *into the bucket*: `bucketKeeps()` is `ceil`, it
is exported, and `ui.js` calls it instead of repeating the arithmetic, which is
how the two had drifted apart in the first place. 1 → keeps 1, 3 → keeps 2.
Worth at most half a cup a day, so it moves no balance; it just stops the item
lying.

**The money was the seventh pass's own footnote coming due.** That pass closed
by recording that `MAX_REGULARS` was reached on day 7 of 14, decided `GROW_AT`
was a weak lever on it, and wrote the observation down instead of acting on it.
The observation was the whole bug. Regulars are the *only* thing a child can
grow — footfall is the weather's and the stall's capacity is fixed — so when
they stop climbing the business stops climbing. Measured day by day, holding
75c and stocking to the forecast:

| | day 1-7 | day 8-14 |
| --- | --- | --- |
| regulars | 0-0-2-4-6-7-7 | 7-8-8-8-8-8-8 |
| cups sold | 5-8-11-13-15-17-18 | 18-19-19-19-19-19-19 |

Eight days of a flat line. The last seven mornings were the same morning, cash
piled up in the bank with nothing to spend it on ($82 by day 14 against a stall
that wanted $7 of lemons), and the fortnight was pinned near $85 *however well
it was played*. That is what "can't get past $60-70" is from inside a run: not
a hard game, a game with nowhere left to go — and a ladder whose top two rungs
no amount of playing well would move, at 8-10% for every policy on the board.

**`MAX_REGULARS` 8 → 14, and `STALL_LIMIT` 40 → 52, and the second is not
optional.** Regulars are demand, so lifting the ceiling on them lifts what an
ordinary day asks for; measured at a 40-cup stall with 14 regulars, "fill it
every morning" caught right back up with reading the forecast ($94 against
$96) and the sixth pass's whole fight was undone. **The gap between the day you
expect and what the stall holds IS the lesson**, so the two numbers have to
move together. Held at 52, filling the stall bins 36% of what it buys and
finishes $28 behind stocking to the forecast.

What that buys, 1,500 fortnights per row on Normal:

| | before | after |
| --- | --- | --- |
| stock to the forecast | $82.80 | $97.60 |
| best play | $90.10 | $106.00 |
| fill the stall every day | $61.90 | $69.25 |
| never look at the sky | $72.50 | $75.35 |
| reaches the bike | 8-10%, every policy | 26% forecast, 22% best, 0% flat |

The lessons all still hold, which is the only thing that made the change
allowed: 1.0× the forecast still beats 1.2× and 1.5× and filling it; 75c still
beats $1.00 by $30; keeping the float back still beats banking every cent
($106.00 vs $102.20) which still beats never banking ($83.80). Growth now runs
0-0-2-4-7-9-11-12-12-13-13-13-14-14 and is still climbing on the last day,
which is the shape the game always claimed: the first week is the business
growing, the second is the business you built.

**A footnote that explains a complaint is a bug report you have already
written.** The seventh pass measured the plateau, described it accurately, and
filed it as a comment fix. It was the top item on the next issue list.
