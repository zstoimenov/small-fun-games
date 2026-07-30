/* Nine Men's Morris — the computer opponent, and the hint button behind it.     */
/*                                                                              */
/* The search is Connect Four's, lifted almost as it stands: negamax with        */
/* alpha-beta, iterative deepening under a stopwatch, best-move-first ordering.  */
/* What is new is the move generator, because this game has three phases and a   */
/* far worse branching factor — up to 24 placements, and up to 63 moves once a    */
/* player is flying, each multiplied again by the choice of which piece to take.  */
/*                                                                              */
/* Two things keep that tree walkable:                                          */
/*                                                                              */
/*   1. Ordering. Mill-closing moves first, then moves that block a mill, then   */
/*      the rest. Alpha-beta only pays for itself if the good move comes first.  */
/*   2. Capping the capture. When a mill closes there can be nine pieces to      */
/*      choose from, and they are nearly all the same move. The search tries the */
/*      best two or three and ignores the rest.                                  */
/*                                                                              */
/* Inherited from Connect Four, and worth repeating: the root searches on a full */
/* window. Narrowing it prunes faster, but a move that fails low comes back with */
/* an upper bound rather than a score, and two matching upper bounds are not a   */
/* tie — which matters here because equal moves are broken at random.            */
"use strict";
window.NMM = window.NMM || {};

NMM.Ai = (function () {
  const R = NMM.Rules;
  const { NODES, MILLS, ADJ, PAIRS } = R;

  const WIN = 100000;
  const INF = 1000000;

  const LEVELS = {
    easy:   { maxDepth: 1, budget: 200, blunder: 0.35, cap: 1 },
    medium: { maxDepth: 4, budget: 500, blunder: 0.05, cap: 2 },
    hard:   { maxDepth: 12, budget: 950, blunder: 0,    cap: 3 }
  };

  // The hint is answering a tap, so it has to come back before the tap feels
  // ignored — a shorter clock than Hard plays on.
  const HINT = { maxDepth: 10, budget: 550, blunder: 0, cap: 2 };

  const now = () => (window.performance && performance.now ? performance.now() : Date.now());

  /* ── What a position is worth ──────────────────────────────────────────── */

  // Weights per phase. Material leads every one of them, because a captured
  // piece never comes back: a mill is worth having, but it is worth having
  // mostly for the piece it took, and that is already counted. Being hemmed in
  // hardly matters until you have to slide, and by the time someone is flying a
  // single piece is nearly the whole game.
  //
  // These numbers were set by playing positions out, not by taste. With a mill
  // priced above a piece the search declines a free capture in the opening —
  // technically arguable, unwatchable in practice, and it fails the "takes what
  // it can see" rule the whole family of these games is built on.
  const W = {
    placing: { mat: 40, mill: 20, two: 8,  free: 3, dbl: 12 },
    moving:  { mat: 45, mill: 22, two: 8,  free: 6, dbl: 14 },
    flying:  { mat: 60, mill: 18, two: 12, free: 4, dbl: 8 }
  };

  function evaluate(s, me) {
    const foe = 3 - me;
    const c = s.cells;

    let myMill = 0, foeMill = 0, myTwo = 0, foeTwo = 0;
    for (let i = 0; i < MILLS.length; i++) {
      const m = MILLS[i];
      let mine = 0, theirs = 0, empty = 0;
      for (let k = 0; k < 3; k++) {
        const v = c[m[k]];
        if (v === me) mine++;
        else if (v === foe) theirs++;
        else empty++;
      }
      if (mine === 3) myMill++;
      else if (theirs === 3) foeMill++;
      else if (mine === 2 && empty === 1) myTwo++;
      else if (theirs === 2 && empty === 1) foeTwo++;
    }

    // One pass for mobility and double mills. A piece with nowhere to go is half
    // a piece; a piece in two mills at once can open one and close it again for
    // ever, which is the strongest thing there is.
    let myFree = 0, foeFree = 0, myDbl = 0, foeDbl = 0;
    for (let n = 0; n < NODES; n++) {
      const v = c[n];
      if (!v) continue;
      let free = false;
      const nb = ADJ[n];
      for (let k = 0; k < nb.length; k++) if (!c[nb[k]]) { free = true; break; }
      let lines = 0;
      const pr = PAIRS[n];
      for (let k = 0; k < pr.length; k++) {
        if (c[pr[k][0]] === v && c[pr[k][1]] === v) lines++;
      }
      if (v === me) { if (free) myFree++; if (lines > 1) myDbl++; }
      else { if (free) foeFree++; if (lines > 1) foeDbl++; }
    }

    const myMat = s.onBoard[me - 1] + s.toPlace[me - 1];
    const foeMat = s.onBoard[foe - 1] + s.toPlace[foe - 1];

    const w = W[R.phase(s, me)];
    return w.mat * (myMat - foeMat)
         + w.mill * (myMill - foeMill)
         + w.two * (myTwo - foeTwo)
         + w.free * (myFree - foeFree)
         + w.dbl * (myDbl - foeDbl);
  }

  /* ── Generating moves, in a useful order ───────────────────────────────── */

  // Empty points that would finish a mill for `who` — the squares to take and
  // the squares to block, which between them are nearly every move worth trying.
  function threats(s, who) {
    const c = s.cells;
    const out = [];
    for (const m of MILLS) {
      let mine = 0, hole = -1;
      for (const n of m) {
        if (c[n] === who) mine++;
        else if (!c[n]) hole = n;
        else { mine = -9; break; }
      }
      if (mine === 2 && hole >= 0) out.push(hole);
    }
    return out;
  }

  // Which of their pieces to take, best first. Breaking up a line they are one
  // move from finishing is worth more than any other capture, and a piece on
  // the middle ring's edge points sits on four connections rather than two.
  function victims(s, foe, cap) {
    const list = R.removable(s, foe);
    if (list.length <= 1) return list;
    const hot = new Set();
    for (const m of MILLS) {
      let theirs = 0, empty = 0;
      for (const n of m) {
        if (s.cells[n] === foe) theirs++;
        else if (!s.cells[n]) empty++;
      }
      if (theirs === 2 && empty === 1) for (const n of m) if (s.cells[n] === foe) hot.add(n);
    }
    const scored = list.map((n) => ({
      n: n,
      v: (hot.has(n) ? 8 : 0) + ADJ[n].length
    }));
    scored.sort((a, b) => b.v - a.v);
    return scored.slice(0, Math.max(1, cap)).map((x) => x.n);
  }

  function generate(s, cap) {
    const who = s.turn;
    const foe = 3 - who;
    const take = victims(s, foe, cap);
    const block = new Set(threats(s, foe));
    const mine = new Set(threats(s, who));

    const out = [];
    for (const mv of R.steps(s)) {
      if (R.closes(s, mv.from, mv.to, who)) {
        for (const r of take) out.push({ from: mv.from, to: mv.to, remove: r, rank: 6 });
      } else {
        // Blocking beats building, and building beats everything else.
        const rank = block.has(mv.to) ? 4 : mine.has(mv.to) ? 2 : 0;
        out.push({ from: mv.from, to: mv.to, remove: -1, rank: rank });
      }
    }
    out.sort((a, b) => b.rank - a.rank);
    return out;
  }

  /* ── The search ────────────────────────────────────────────────────────── */

  let nodes = 0;
  let deadline = 0;
  let aborted = false;

  // Lost on pieces, without building a repetition key — that check costs a
  // string per node and the app enforces the draw anyway.
  function beaten(s, who) {
    return !s.toPlace[who - 1] && s.onBoard[who - 1] <= R.LOSE_AT;
  }

  // Scores are from the point of view of whoever is to move, and a win is worth
  // less the further off it is (WIN - ply), so it takes the quickest win and
  // drags out a loss rather than walking into it.
  function negamax(s, depth, alpha, beta, ply, cap) {
    nodes++;
    if ((nodes & 1023) === 0 && now() > deadline) { aborted = true; return 0; }

    const me = s.turn;
    if (beaten(s, me)) return -(WIN - ply);
    if (beaten(s, 3 - me)) return WIN - ply;
    if (s.sinceMill >= R.QUIET_PLIES) return 0;      // nothing taken for ages: a draw

    // A position that has already come round twice is a draw waiting to happen,
    // and a draw is worth nothing to whoever is ahead. Without this both sides
    // shuffle a piece back and forth in the endgame and three games in four end
    // in a threefold repetition — measured, not guessed. Only checked near the
    // root: that is where it changes the move actually played, and the key costs
    // a 24-character string, which is not something to build at every node.
    if (ply <= 3) {
      const key = R.repKey(s);
      if (key && (s.reps.get(key) || 0) >= 2) return 0;
    }

    if (depth <= 0) return evaluate(s, me);

    const moves = generate(s, cap);
    if (!moves.length) return -(WIN - ply);          // nowhere to go is a loss

    let best = -INF;
    for (let i = 0; i < moves.length; i++) {
      R.play(s, moves[i]);
      const v = -negamax(s, depth - 1, -beta, -alpha, ply + 1, cap);
      R.undo(s);
      if (aborted) return 0;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // One ply deeper each pass, keeping the deepest answer it actually finished,
  // so an abandoned pass costs nothing and the clock can be trusted.
  function think(s, cfg) {
    const ordered = generate(s, cfg.cap);
    if (!ordered.length) return null;

    nodes = 0;
    aborted = false;
    deadline = now() + cfg.budget;
    const started = now();

    let best = ordered[0];
    let bestScore = 0;
    let reached = 0;

    for (let d = 1; d <= cfg.maxDepth; d++) {
      let localBest = -INF;
      let ties = [];
      for (const mv of ordered) {
        R.play(s, mv);
        const v = -negamax(s, d - 1, -INF, INF, 1, cfg.cap);   // full window — see the header
        R.undo(s);
        if (aborted) break;
        if (v > localBest) { localBest = v; ties = [mv]; }
        else if (v === localBest) ties.push(mv);
      }
      if (aborted) break;

      // Equally good moves are picked between at random, so the same opening
      // doesn't play out identically every single game.
      best = ties[Math.floor(Math.random() * ties.length)];
      bestScore = localBest;
      reached = d;

      // Best move first next time round — most of what makes deepening pay.
      ordered.splice(ordered.indexOf(best), 1);
      ordered.unshift(best);

      if (Math.abs(localBest) >= WIN - 1000) break;   // forced either way; stop
      if (now() > deadline) break;
    }

    return {
      from: best.from, to: best.to, remove: best.remove,
      score: bestScore, depth: reached, nodes: nodes, ms: Math.round(now() - started)
    };
  }

  /* ── What the opponent actually plays ──────────────────────────────────── */

  function chooseMove(s, level) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const who = s.turn;
    const foe = 3 - who;
    const legal = R.steps(s);
    if (!legal.length) return null;

    // Easy is the only level that plays by rules of thumb rather than by
    // searching, and even Easy makes a mill it can see and blocks one it can
    // see. An opponent that walks past a free capture reads as broken, not easy.
    if (cfg.blunder >= 0.2) {
      const mill = legal.filter((mv) => R.closes(s, mv.from, mv.to, who));
      if (mill.length) {
        const mv = mill[Math.floor(Math.random() * mill.length)];
        const take = victims(s, foe, 1);
        return { from: mv.from, to: mv.to, remove: take[0], score: 0, depth: 0, nodes: 0, ms: 0 };
      }
      const holes = threats(s, foe);
      const stop = legal.filter((mv) => holes.indexOf(mv.to) !== -1);
      if (stop.length) {
        const mv = stop[Math.floor(Math.random() * stop.length)];
        return { from: mv.from, to: mv.to, remove: -1, score: 0, depth: 0, nodes: 0, ms: 0 };
      }
    }

    // Missing things on purpose is the whole difference at Easy. Math.random is
    // fine for this: it's flavour, not a dice roll anyone's score depends on.
    if (cfg.blunder && Math.random() < cfg.blunder) {
      const mv = legal[Math.floor(Math.random() * legal.length)];
      const remove = R.closes(s, mv.from, mv.to, who) ? victims(s, foe, 1)[0] : -1;
      return { from: mv.from, to: mv.to, remove: remove, score: 0, depth: 0, nodes: 0, ms: 0, sloppy: true };
    }

    return think(s, cfg);
  }

  /* ── The hint button ───────────────────────────────────────────────────── */
  // Same search, but it has to explain itself, so it leads with reasons a child
  // can check on the board before falling back to "this is the best one".

  function hint(s) {
    const who = s.turn;
    const foe = 3 - who;
    const legal = R.steps(s);
    if (!legal.length) return null;
    const placing = R.phase(s, who) === "placing";

    const mill = legal.filter((mv) => R.closes(s, mv.from, mv.to, who));
    if (mill.length) {
      return Object.assign({}, mill[0], {
        remove: victims(s, foe, 1)[0],
        text: "that finishes a line of three — you get to take one of theirs! 🏆"
      });
    }

    const holes = threats(s, foe);
    if (holes.length) {
      const stop = legal.filter((mv) => holes.indexOf(mv.to) !== -1);
      if (stop.length) {
        return Object.assign({}, stop[0], {
          remove: -1,
          text: holes.length > 1
            ? "they can finish a line in two places, so block the one you'd hate most. 😬"
            : "block it — they finish a line of three next go otherwise. 🛡️"
        });
      }
    }

    const best = think(s, HINT);
    if (!best) return null;

    // Look at the position the move leads to: two open lines at once is the trap
    // they can only half block.
    R.play(s, { from: best.from, to: best.to, remove: best.remove });
    const mine = threats(s, who).length;
    const gift = threats(s, foe).length;
    R.undo(s);

    let text;
    if (mine >= 2) text = "that gives you two ways to finish a line, and they can only block one. 🪤";
    else if (gift > 0) text = "nothing is really safe now, so this is the least bad go. 😬";
    else if (mine === 1) text = "that lines two up, ready to finish next go. 👀";
    else if (placing) text = "a good spot — it joins onto plenty of lines. 👍";
    else text = "safe, and it keeps your pieces free to move. 👍";

    return Object.assign({}, best, { text: text });
  }

  return { chooseMove, hint, evaluate, threats, generate, LEVELS };
})();
