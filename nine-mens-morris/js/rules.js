/* Nine Men's Morris — the board and the rules of it.                           */
/*                                                                              */
/* Nothing here knows about the DOM or about the opponent. Both the screen and   */
/* the solver ask the same questions of it, so they can never disagree about a   */
/* position.                                                                    */
/*                                                                              */
/* The board is 24 points, not a grid, so it is an adjacency list: point         */
/* `ring * 8 + i`, ring 0 outermost, and i running clockwise from the top-left   */
/* corner (0 corner, 1 edge middle, 2 corner, …). Corners have two neighbours,   */
/* edge middles three — four on the middle ring, where the spokes cross. The     */
/* grid coordinates are here too, but only the drawing code reads them, so the   */
/* picture on screen can never disagree with the connections in play.           */
/*                                                                              */
/* One shape covers all three phases: a move is { from, to, remove }, with       */
/* from = -1 while placing and remove = -1 when no mill closed. That is what     */
/* lets play/undo stay O(1), which the search leans on hard.                     */
"use strict";
window.NMM = window.NMM || {};

NMM.Rules = (function () {
  const WHITE = 1;
  const BLACK = 2;
  const NODES = 24;
  const PIECES = 9;        // each player places nine
  const FLY_AT = 3;        // down to three pieces and you may jump anywhere
  const LOSE_AT = 2;       // down to two and you have lost
  const QUIET_PLIES = 100; // 50 moves each with nothing taken is a draw

  /* ── The shape of the board ────────────────────────────────────────────── */

  // Grid coordinates, 0-6 on both axes. Each ring is the previous one inset by
  // one, and the eight points of a ring run: corner, edge middle, corner, …
  const XY = (function () {
    const out = [];
    for (let r = 0; r < 3; r++) {
      const lo = r, hi = 6 - r, mid = 3;
      const pts = [[lo, lo], [mid, lo], [hi, lo], [hi, mid],
                   [hi, hi], [mid, hi], [lo, hi], [lo, mid]];
      for (const p of pts) out.push(p);
    }
    return out;
  })();

  // 32 edges: eight round each ring, plus the four spokes, which only touch the
  // edge middles (odd i). Corners are never joined across rings — that is the
  // rule the whole board geometry rests on.
  const ADJ = (function () {
    const a = [];
    for (let n = 0; n < NODES; n++) a.push([]);
    const link = (p, q) => { a[p].push(q); a[q].push(p); };
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 8; i++) link(r * 8 + i, r * 8 + (i + 1) % 8);
    }
    for (const i of [1, 3, 5, 7]) { link(i, 8 + i); link(8 + i, 16 + i); }
    for (const list of a) list.sort((x, y) => x - y);
    return a;
  })();

  // 16 mills: four sides on each of the three rings, plus one down each spoke.
  const MILLS = (function () {
    const out = [];
    for (let r = 0; r < 3; r++) {
      const b = r * 8;
      out.push([b + 0, b + 1, b + 2], [b + 2, b + 3, b + 4],
               [b + 4, b + 5, b + 6], [b + 6, b + 7, b + 0]);
    }
    for (const i of [1, 3, 5, 7]) out.push([i, 8 + i, 16 + i]);
    return out;
  })();

  // For each point, the other two points of every mill through it. Two entries
  // for a corner, three for an edge middle — so "did that close a mill?" is two
  // or three comparisons rather than a sweep of all sixteen.
  const PAIRS = (function () {
    const out = [];
    for (let n = 0; n < NODES; n++) out.push([]);
    for (const m of MILLS) {
      for (const n of m) out[n].push(m.filter((x) => x !== n));
    }
    return out;
  })();

  /* ── A position ────────────────────────────────────────────────────────── */

  function create() {
    return {
      cells: new Int8Array(NODES),   // 0 empty, 1 white, 2 black
      toPlace: [PIECES, PIECES],     // indexed by colour - 1, throughout
      onBoard: [0, 0],
      turn: WHITE,                   // white always opens the *board*
      hist: [],                      // every move played, in order — that's the game
      sinceMill: 0,                  // plies since anything was taken
      reps: new Map()                // position -> times seen, for the draw rule
    };
  }

  const at = (s, n) => s.cells[n];
  const other = (who) => 3 - who;

  // Derived, never stored: a phase that could disagree with the piece counts
  // would be a bug waiting to happen.
  function phase(s, who) {
    if (s.toPlace[who - 1] > 0) return "placing";
    return s.onBoard[who - 1] <= FLY_AT ? "flying" : "moving";
  }

  /* ── Mills ─────────────────────────────────────────────────────────────── */

  // Is the point part of a completed line of `who`? Reads cells as they stand,
  // so callers that are trying a move out must have applied it first.
  function millThrough(s, n, who) {
    const c = s.cells;
    for (const [a, b] of PAIRS[n]) if (c[a] === who && c[b] === who) return true;
    return false;
  }

  function inMill(s, n) {
    const who = s.cells[n];
    return who ? millThrough(s, n, who) : false;
  }

  // Would moving from -> to close a mill? The piece has to leave `from` first,
  // or a line it was already part of would count itself.
  function closes(s, from, to, who) {
    const c = s.cells;
    const was = from >= 0 ? c[from] : 0;
    if (from >= 0) c[from] = 0;
    c[to] = who;
    const yes = millThrough(s, to, who);
    c[to] = 0;
    if (from >= 0) c[from] = was;
    return yes;
  }

  // The mill (or mills) the piece on `n` completes, as a flat list of points —
  // only used to light them up on screen.
  function millCells(s, n) {
    const who = s.cells[n];
    if (!who) return null;
    const out = [];
    for (const [a, b] of PAIRS[n]) {
      if (s.cells[a] === who && s.cells[b] === who) out.push(n, a, b);
    }
    return out.length ? out : null;
  }

  // Which enemy pieces may be taken. A piece in a mill is safe *unless* every
  // one of them is in a mill — this exception is the rule everybody forgets,
  // and without it a game can deadlock with a legal capture nobody can make.
  function removable(s, foe) {
    const free = [];
    const all = [];
    for (let n = 0; n < NODES; n++) {
      if (s.cells[n] !== foe) continue;
      all.push(n);
      if (!millThrough(s, n, foe)) free.push(n);
    }
    return free.length ? free : all;
  }

  /* ── Moves ─────────────────────────────────────────────────────────────── */

  // Every from/to for the player to move, ignoring what a mill would then let
  // them take. This is also the stalemate test: an empty list is a loss.
  function steps(s) {
    const who = s.turn;
    const c = s.cells;
    const out = [];

    if (phase(s, who) === "placing") {
      for (let n = 0; n < NODES; n++) if (!c[n]) out.push({ from: -1, to: n });
      return out;
    }

    const fly = phase(s, who) === "flying";
    for (let n = 0; n < NODES; n++) {
      if (c[n] !== who) continue;
      if (fly) {
        for (let t = 0; t < NODES; t++) if (!c[t]) out.push({ from: n, to: t });
      } else {
        for (const t of ADJ[n]) if (!c[t]) out.push({ from: n, to: t });
      }
    }
    return out;
  }

  // The same list with the capture spelled out, which is what the search plays.
  // A move that closes a mill appears once per piece it could take.
  function legalMoves(s) {
    const who = s.turn;
    const foe = other(who);
    // A move of ours can't change which of *their* pieces sit in mills, so the
    // takeable list is the same for every move and is worked out once.
    const takeable = removable(s, foe);
    const out = [];
    for (const mv of steps(s)) {
      if (closes(s, mv.from, mv.to, who)) {
        for (const r of takeable) out.push({ from: mv.from, to: mv.to, remove: r });
      } else {
        out.push({ from: mv.from, to: mv.to, remove: -1 });
      }
    }
    return out;
  }

  function isLegal(s, from, to) {
    const who = s.turn;
    if (to < 0 || to >= NODES || s.cells[to]) return false;
    if (phase(s, who) === "placing") return from === -1;
    if (from < 0 || s.cells[from] !== who) return false;
    if (phase(s, who) === "flying") return true;
    return ADJ[from].indexOf(to) !== -1;
  }

  /* ── Playing and taking back ───────────────────────────────────────────── */

  // Repetition is only counted once both players have finished placing: a
  // position with pieces still in hand can't come round again.
  function repKey(s) {
    if (s.toPlace[0] || s.toPlace[1]) return null;
    return s.cells.join("") + ":" + s.turn;
  }

  function bumpRep(s, by) {
    const k = repKey(s);
    if (!k) return;
    const n = (s.reps.get(k) || 0) + by;
    if (n > 0) s.reps.set(k, n); else s.reps.delete(k);
  }

  // `remove` may be left at -1 even when a mill closed: that is the half-played
  // state a human sits in while choosing whose piece to take. takePiece()
  // finishes it, and undo() reverses whichever of the two states it finds.
  function play(s, mv) {
    const who = s.turn;
    const foe = other(who);
    const rec = { from: mv.from, to: mv.to, remove: -1, sinceMill: s.sinceMill };

    if (mv.from < 0) { s.toPlace[who - 1]--; s.onBoard[who - 1]++; }
    else s.cells[mv.from] = 0;
    s.cells[mv.to] = who;

    s.sinceMill++;
    s.turn = foe;
    s.hist.push(rec);
    bumpRep(s, +1);

    if (mv.remove !== undefined && mv.remove >= 0) takePiece(s, mv.remove);
    return rec;
  }

  // Applies the capture the move just earned. Called straight after play() by
  // the solver, or a tap later by a person.
  function takePiece(s, n) {
    const rec = s.hist[s.hist.length - 1];
    if (!rec || rec.remove >= 0) return false;
    const foe = s.turn;                 // the turn already flipped: their pieces
    if (s.cells[n] !== foe) return false;

    bumpRep(s, -1);                     // the position is about to change again
    s.cells[n] = 0;
    s.onBoard[foe - 1]--;
    rec.remove = n;
    s.sinceMill = 0;
    bumpRep(s, +1);
    return true;
  }

  function undo(s) {
    if (!s.hist.length) return null;
    bumpRep(s, -1);
    const rec = s.hist.pop();
    const who = other(s.turn);          // whoever made the move being undone
    const foe = s.turn;

    if (rec.remove >= 0) { s.cells[rec.remove] = foe; s.onBoard[foe - 1]++; }
    s.cells[rec.to] = 0;
    if (rec.from < 0) { s.toPlace[who - 1]++; s.onBoard[who - 1]--; }
    else s.cells[rec.from] = who;

    s.sinceMill = rec.sinceMill;
    s.turn = who;
    return rec;
  }

  /* ── Is it over? ───────────────────────────────────────────────────────── */

  // Only ever asked about the player to move, which is enough: a capture flips
  // the turn to whoever just lost a piece, so "two left" is caught immediately.
  function outcome(s) {
    if (!s.toPlace[0] && !s.toPlace[1]) {
      if (s.onBoard[0] <= LOSE_AT) return { winner: BLACK, reason: "pieces" };
      if (s.onBoard[1] <= LOSE_AT) return { winner: WHITE, reason: "pieces" };
    }
    if (!steps(s).length) return { winner: other(s.turn), reason: "stuck" };
    const k = repKey(s);
    if (k && (s.reps.get(k) || 0) >= 3) return { winner: 0, reason: "repetition" };
    if (s.sinceMill >= QUIET_PLIES) return { winner: 0, reason: "quiet" };
    return null;
  }

  /* ── Saving ────────────────────────────────────────────────────────────── */
  // The move list *is* the game, so a save is a list of small numbers and a
  // replayed position can never disagree with the moves that made it.

  function snapshot(s) {
    const out = [];
    for (const m of s.hist) out.push(m.from, m.to, m.remove);
    return out;
  }

  function restore(flat) {
    if (!Array.isArray(flat) || flat.length % 3) return null;
    const s = create();
    for (let i = 0; i < flat.length; i += 3) {
      const from = flat[i], to = flat[i + 1], remove = flat[i + 2];
      if (!isLegal(s, from, to)) return null;      // corrupt save — start fresh
      const mustTake = closes(s, from, to, s.turn);
      if (mustTake !== (remove >= 0)) return null;
      if (remove >= 0 && removable(s, other(s.turn)).indexOf(remove) === -1) return null;
      play(s, { from: from, to: to, remove: remove });
    }
    return s;
  }

  return {
    WHITE, BLACK, NODES, PIECES, FLY_AT, LOSE_AT, QUIET_PLIES,
    XY, ADJ, MILLS, PAIRS,
    create, at, other, phase, repKey,
    millThrough, inMill, closes, millCells, removable,
    steps, legalMoves, isLegal,
    play, takePiece, undo, outcome,
    snapshot, restore
  };
})();
