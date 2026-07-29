/* Connect Four — the computer opponent, and the hint button behind it.         */
/*                                                                              */
/* It's a minimax (negamax) search with alpha-beta pruning, iterative deepening  */
/* and a stopwatch. Two cheap rules do most of the pruning before the search     */
/* even starts on a node:                                                       */
/*                                                                              */
/*   1. If I can make four right now, stop looking — nothing beats winning.     */
/*   2. If the other side can make four right now, the only move worth trying   */
/*      is the block. And if they can do it in *two* different columns, the     */
/*      position is already lost, because one move can only plug one hole.      */
/*                                                                              */
/* That second rule is what makes the search see traps coming: it prices a fork */
/* as a loss the moment it appears, so the solver steers around one many moves  */
/* earlier without any special "fork" code.                                     */
/*                                                                              */
/* Hard is capped by a time budget rather than a depth, so it thinks as far as   */
/* it can in about a second and plays the deepest answer it actually finished.   */
/* That is not a solved-from-move-one Connect Four engine — it is an opponent    */
/* that will punish a loose move and can be beaten by a good one.                */
"use strict";
window.C4 = window.C4 || {};

C4.Ai = (function () {
  const Board = C4.Board;
  const { COLS, ROWS } = Board;

  const WIN = 100000;
  const INF = 1000000;

  // The middle column sits on more four-in-a-rows than any other, so trying it
  // first makes alpha-beta cut the most branches. Pure search-speed ordering.
  const ORDER = [3, 2, 4, 1, 5, 0, 6];

  const LEVELS = {
    easy:   { maxDepth: 2,  budget: 150, blunder: 0.35 },
    medium: { maxDepth: 7,  budget: 450, blunder: 0.06 },
    hard:   { maxDepth: 16, budget: 950, blunder: 0 }
  };

  // The hint runs the same search on the player's behalf, on a shorter clock —
  // it's answering a tap, so it has to come back before the tap feels ignored.
  const HINT = { maxDepth: 12, budget: 500, blunder: 0 };

  const now = () => (window.performance && performance.now ? performance.now() : Date.now());

  /* ── Every four-in-a-row the board has ─────────────────────────────────── */
  // 69 of them on a 7x6 grid. Worked out once, then only ever read.

  const WINDOWS = (function () {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    const out = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        for (const [dc, dr] of dirs) {
          const ec = c + dc * 3, er = r + dr * 3;
          if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
          const w = new Int8Array(4);
          for (let i = 0; i < 4; i++) w[i] = (c + dc * i) * ROWS + (r + dr * i);
          out.push(w);
        }
      }
    }
    return out;
  })();

  // What a window of my discs and nothing else is worth. Three-with-a-gap is
  // worth far more than two, because it's one move off a threat.
  const SHAPE = [0, 1, 8, 45];

  function evaluate(b, me) {
    const foe = 3 - me;
    const cells = b.cells;
    let score = 0;
    for (let w = 0; w < WINDOWS.length; w++) {
      const win = WINDOWS[w];
      let mine = 0, theirs = 0;
      for (let i = 0; i < 4; i++) {
        const v = cells[win[i]];
        if (v === me) mine++;
        else if (v === foe) theirs++;
      }
      if (mine && theirs) continue;      // both colours in it — dead to both
      if (mine) score += SHAPE[mine];
      else if (theirs) score -= SHAPE[theirs];
    }
    // A disc in the middle column belongs to more lines than one at the edge.
    for (let r = 0; r < ROWS; r++) {
      const v = cells[3 * ROWS + r];
      if (v === me) score += 4;
      else if (v === foe) score -= 4;
    }
    return score;
  }

  /* ── The search ────────────────────────────────────────────────────────── */

  let nodes = 0;
  let deadline = 0;
  let aborted = false;

  // Scores are from the point of view of whoever is to move, and a win is worth
  // less the further off it is (WIN - ply), so the solver takes the quickest win
  // and drags out a loss instead of resigning into it.
  //
  // Note the invariant that makes the "can I win right now?" test enough on its
  // own: a winning move is scored and returned *without being played*, so the
  // search never steps into a node where the game is already over. think() takes
  // the same shortcut at the root for exactly that reason.
  function negamax(b, depth, alpha, beta, ply) {
    nodes++;
    if ((nodes & 2047) === 0 && now() > deadline) { aborted = true; return 0; }

    const me = b.turn;
    const foe = 3 - me;

    for (let i = 0; i < COLS; i++) {
      const c = ORDER[i];
      if (Board.wouldWin(b, c, me)) return WIN - ply;
    }
    if (Board.full(b)) return 0;
    if (depth <= 0) return evaluate(b, me);

    const theirs = Board.winningCols(b, foe);
    if (theirs.length >= 2) return -(WIN - ply - 1);   // one move, two holes: lost
    const moves = theirs.length === 1
      ? theirs                                          // forced: plug it
      : ORDER.filter((c) => Board.canPlay(b, c));

    let best = -INF;
    for (let i = 0; i < moves.length; i++) {
      Board.play(b, moves[i]);
      const v = -negamax(b, depth - 1, -beta, -alpha, ply + 1);
      Board.undo(b);
      if (aborted) return 0;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Searches one ply deeper each pass and keeps the deepest answer it finished,
  // so an abandoned pass costs nothing and the clock can be trusted.
  function think(b, cfg) {
    const legal = Board.legalMoves(b);
    if (!legal.length) return null;

    nodes = 0;
    aborted = false;
    deadline = now() + cfg.budget;
    const started = now();

    const ordered = ORDER.filter((c) => Board.canPlay(b, c));
    for (const c of ordered) {
      if (Board.wouldWin(b, c, b.turn)) {
        return { col: c, score: WIN - 1, depth: 0, nodes: 0, ms: 0 };
      }
    }

    let bestCol = ordered[0];
    let bestScore = 0;
    let reached = 0;

    for (let d = 1; d <= cfg.maxDepth; d++) {
      let localBest = -INF;
      let ties = [];
      for (const c of ordered) {
        Board.play(b, c);
        // Full window at the root, deliberately. Narrowing it to (-INF, -best)
        // would prune faster, but then a move that fails low comes back with an
        // upper bound rather than its real score — and two upper bounds that
        // happen to match are not a tie. Since ties are broken at random below,
        // that difference is the gap between "picks another equally good
        // column" and "picks a column it never actually looked at".
        const v = -negamax(b, d - 1, -INF, INF, 1);
        Board.undo(b);
        if (aborted) break;
        if (v > localBest) { localBest = v; ties = [c]; }
        else if (v === localBest) ties.push(c);
      }
      if (aborted) break;

      // Equally good moves are picked between at random, so the same opening
      // doesn't play out identically every single game.
      bestCol = ties[Math.floor(Math.random() * ties.length)];
      bestScore = localBest;
      reached = d;

      // Best move first next time round — that's most of what makes deepening
      // pay for itself.
      ordered.splice(ordered.indexOf(bestCol), 1);
      ordered.unshift(bestCol);

      if (Math.abs(localBest) >= WIN - 1000) break;  // forced either way; stop
      if (now() > deadline) break;
    }

    return { col: bestCol, score: bestScore, depth: reached, nodes, ms: Math.round(now() - started) };
  }

  /* ── What the opponent actually plays ──────────────────────────────────── */

  function chooseMove(b, level) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const me = b.turn;
    const legal = Board.legalMoves(b);
    if (!legal.length) return null;

    // Every level takes a win it can see. An opponent that walks past four in a
    // row doesn't read as "easy", it reads as broken.
    for (const c of ORDER) {
      if (Board.wouldWin(b, c, me)) return { col: c, score: WIN, depth: 0, nodes: 0, ms: 0 };
    }

    // Easy misses things on purpose — that's the whole difference. Math.random
    // is fine for this: it's flavour, not a dice roll anyone's score depends on.
    if (cfg.blunder && Math.random() < cfg.blunder) {
      return { col: legal[Math.floor(Math.random() * legal.length)], score: 0, depth: 0, nodes: 0, ms: 0, sloppy: true };
    }

    return think(b, cfg);
  }

  /* ── The hint button ───────────────────────────────────────────────────── */
  // Same search, but it has to explain itself, so it leads with the reason a
  // kid can check for themselves before falling back to "this is the best one".

  function hint(b) {
    const me = b.turn;
    const foe = 3 - me;
    if (Board.full(b)) return null;

    const mine = Board.winningCols(b, me);
    if (mine.length) {
      return { col: mine[0], text: "That's four in a row — go on, win it! 🏆" };
    }

    const theirs = Board.winningCols(b, foe);
    if (theirs.length === 1) {
      return { col: theirs[0], text: "Block this one, quick — they've got three in a row. 🛡️" };
    }
    if (theirs.length > 1) {
      return { col: theirs[0], text: "They can win in two different columns, so blocking one won't be enough. Plug the nearest and hope. 😬" };
    }

    const best = think(b, HINT);
    if (!best) return null;

    // Does it build a trap? Look at the position it leads to and count the ways
    // to win from there — two is the fork the opponent can't cover.
    Board.play(b, best.col);
    const forks = Board.winningCols(b, me).length;
    const gift = Board.winningCols(b, foe).length;
    Board.undo(b);

    let text;
    if (forks >= 2) text = "Drop here and you'll have two ways to win — they can only block one. 🪤";
    else if (gift > 0) text = "Nothing on the board is safe now, so this is the least bad square. 😬";
    else if (forks === 1) text = "This sets up three in a row, ready to finish next go. 👀";
    else text = "Safe square, and it builds towards a line. 👍";

    return { col: best.col, text };
  }

  return { chooseMove, hint };
})();
