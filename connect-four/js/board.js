/* Connect Four — the board and the rules of it.                                */
/*                                                                              */
/* Nothing here knows about the DOM or about the opponent: it is just a grid,    */
/* gravity, and "are there four in a row?". Both the screen and the solver ask   */
/* the same questions of it, so they can never disagree about the position.      */
/*                                                                              */
/* Cells are column-major with row 0 at the *bottom*, which is the way discs     */
/* stack — `heights[col]` is both the number of discs in that column and the row */
/* the next one lands on. Values: 0 empty, 1 red, 2 yellow.                      */
"use strict";
window.C4 = window.C4 || {};

C4.Board = (function () {
  const COLS = 7;
  const ROWS = 6;
  const LINE = 4;          // four in a row wins
  const RED = 1;
  const YELLOW = 2;

  const idx = (c, r) => c * ROWS + r;

  function create() {
    return {
      cells: new Int8Array(COLS * ROWS),
      heights: new Int8Array(COLS),
      moves: [],       // the columns played, in order — that's the whole history
      turn: RED        // red always starts the *board*; who that is, is app.js's problem
    };
  }

  function at(b, c, r) {
    return b.cells[idx(c, r)];
  }

  function canPlay(b, c) {
    return c >= 0 && c < COLS && b.heights[c] < ROWS;
  }

  function full(b) {
    return b.moves.length === COLS * ROWS;
  }

  // Drops a disc for whoever's turn it is and returns the row it landed on.
  function play(b, c) {
    const r = b.heights[c]++;
    b.cells[idx(c, r)] = b.turn;
    b.moves.push(c);
    b.turn = 3 - b.turn;
    return r;
  }

  // Exactly undoes the last play — the solver leans on this hard, so it stays
  // O(1) and touches the same three fields play() does.
  function undo(b) {
    const c = b.moves.pop();
    const r = --b.heights[c];
    b.cells[idx(c, r)] = 0;
    b.turn = 3 - b.turn;
    return c;
  }

  function legalMoves(b) {
    const out = [];
    for (let c = 0; c < COLS; c++) if (canPlay(b, c)) out.push(c);
    return out;
  }

  /* ── Four in a row ──────────────────────────────────────────────────────── */

  // Right, up, up-right, down-right. Every line is checked from its middle
  // outwards in both directions, so these four cover all eight compass points.
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  // How far the run through (c,r) reaches in one direction.
  function reach(b, c, r, dc, dr, who) {
    let n = 0;
    let cc = c + dc;
    let rr = r + dr;
    while (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && b.cells[idx(cc, rr)] === who) {
      n++;
      cc += dc;
      rr += dr;
    }
    return n;
  }

  // The four (or more) cells the disc at (c,r) completes, or null. Only ever
  // called about a cell that just changed, which is why it's this cheap.
  function lineThrough(b, c, r) {
    const who = at(b, c, r);
    if (!who) return null;
    for (const [dc, dr] of DIRS) {
      const back = reach(b, c, r, -dc, -dr, who);
      const fwd = reach(b, c, r, dc, dr, who);
      if (back + fwd + 1 >= LINE) {
        const cells = [];
        for (let i = -back; i <= fwd; i++) cells.push([c + dc * i, r + dr * i]);
        return cells;
      }
    }
    return null;
  }

  // The winning line from the move just played, if it won.
  function lastLine(b) {
    if (!b.moves.length) return null;
    const c = b.moves[b.moves.length - 1];
    return lineThrough(b, c, b.heights[c] - 1);
  }

  // Would `who` win by dropping into column c right now? Answered without
  // touching the board, because the solver asks this at every single node.
  function wouldWin(b, c, who) {
    if (!canPlay(b, c)) return false;
    const r = b.heights[c];
    const wasEmpty = b.cells[idx(c, r)];
    b.cells[idx(c, r)] = who;
    let win = false;
    for (const [dc, dr] of DIRS) {
      if (reach(b, c, r, -dc, -dr, who) + reach(b, c, r, dc, dr, who) + 1 >= LINE) {
        win = true;
        break;
      }
    }
    b.cells[idx(c, r)] = wasEmpty;
    return win;
  }

  // Every column that wins for `who` on the spot. Two of them at once is a
  // fork — the trap the solver plays for and the coach warns about.
  function winningCols(b, who) {
    const out = [];
    for (let c = 0; c < COLS; c++) if (wouldWin(b, c, who)) out.push(c);
    return out;
  }

  /* ── Saving ────────────────────────────────────────────────────────────── */
  // The move list *is* the game, so a save is a list of small numbers and a
  // replay can never disagree with the position it came from.

  function snapshot(b) {
    return b.moves.slice();
  }

  function restore(moves) {
    const b = create();
    for (const c of moves) {
      if (!canPlay(b, c)) return null;   // corrupt save — caller starts fresh
      play(b, c);
    }
    return b;
  }

  return {
    COLS, ROWS, LINE, RED, YELLOW,
    create, at, canPlay, full, play, undo, legalMoves,
    lastLine, wouldWin, winningCols,
    snapshot, restore
  };
})();
