/* Battleship — where to shoot next.                                            */
/*                                                                              */
/* Everything here works from a *view* (Rules.publicView) and never from a       */
/* board, so none of it can see where the ships actually are. That is not tidy-  */
/* mindedness: the hint button runs the same code as the computer, and a hint    */
/* that could peek would quietly be a cheat button.                              */
/*                                                                              */
/* The strong method is probability density. For every ship still afloat, count  */
/* every way it could still be lying — every position that doesn't run off the   */
/* board, cross a miss, or cross a ship already sunk — and add one to each       */
/* square it would cover. Shoot the square the most of those pass through. It    */
/* needs no special case for "hunting" versus "finishing one off": once there is */
/* a hit with no sinking to explain it, only the positions that cover that hit   */
/* are counted, and the arithmetic follows the line on its own.                  */
"use strict";
window.BS = window.BS || {};

BS.Ai = (function () {
  const Rules = BS.Rules;
  const { WATER, MISS, HIT } = Rules;

  // A position covering two loose hits is far better news than one covering a
  // single hit, and this is what makes the search follow a line rather than
  // poke round one end of it. Anything above about 4 behaves the same.
  const LINE_BONUS = 8;

  /* ── Probability density ───────────────────────────────────────────────── */

  // Returns a weight per square, plus the best square to fire at. `weight` is
  // zero everywhere that has already been fired at, so the caller can hand the
  // whole grid straight to a heat map without filtering it first.
  function density(view) {
    const n = view.size;
    const w = new Float64Array(n * n);
    const hits = Rules.liveHits(view);
    const hunting = hits.length === 0;

    // Squares a surviving ship cannot be lying on: open water somebody has
    // already missed in, and the squares of ships that have gone down.
    const blocked = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) {
      if (view.shots[i] === MISS || view.sunkCells[i]) blocked[i] = 1;
    }
    const live = new Uint8Array(n * n);
    for (const [r, c] of hits) live[r * n + c] = 1;

    let total = 0;
    for (const len of view.remaining) {
      for (let dir = 0; dir < 2; dir++) {
        const horiz = dir === 0;
        const maxR = horiz ? n : n - len + 1;
        const maxC = horiz ? n - len + 1 : n;
        for (let r = 0; r < maxR; r++) {
          for (let c = 0; c < maxC; c++) {
            let ok = true, covers = 0;
            for (let k = 0; k < len; k++) {
              const i = horiz ? r * n + c + k : (r + k) * n + c;
              if (blocked[i]) { ok = false; break; }
              if (live[i]) covers++;
            }
            // While a wounded ship is out there, nothing else is worth shooting
            // at: finish it, and the board gets simpler for everything after.
            if (!ok || (!hunting && covers === 0)) continue;
            const gain = hunting ? 1 : Math.pow(LINE_BONUS, covers);
            for (let k = 0; k < len; k++) {
              const i = horiz ? r * n + c + k : (r + k) * n + c;
              if (view.shots[i] === WATER) { w[i] += gain; total += gain; }
            }
          }
        }
      }
    }

    return { w, total, hunting, hits, best: bestOf(w, view) };
  }

  // Ties are common early on — the opening board is symmetrical — so they are
  // broken at random rather than always landing in the top left corner.
  function bestOf(w, view) {
    let top = 0;
    const picks = [];
    for (let i = 0; i < w.length; i++) {
      if (view.shots[i] !== WATER || w[i] <= 0) continue;
      if (w[i] > top) { top = w[i]; picks.length = 0; }
      if (w[i] === top) picks.push(i);
    }
    if (!picks.length) return null;
    const i = Rules.pick(picks);
    return { r: Math.floor(i / view.size), c: i % view.size, weight: top, tied: picks.length };
  }

  const openSquares = (view) => {
    const out = [];
    for (let i = 0; i < view.shots.length; i++) {
      if (view.shots[i] === WATER) out.push([Math.floor(i / view.size), i % view.size]);
    }
    return out;
  };

  const neighbours = (view, r, c) => {
    const out = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rr = r + dr, cc = c + dc;
      if (Rules.inside(view.size, rr, cc) && view.shots[rr * view.size + cc] === WATER) {
        out.push([rr, cc]);
      }
    }
    return out;
  };

  /* ── The three opponents ───────────────────────────────────────────────── */

  // Easy: shoots anywhere at all, and when it has hit something it pokes at a
  // square next door — but it never notices that two hits in a row point
  // somewhere. That one missing idea is the whole difference, and it is a
  // sentence a child can be told. (An opponent that ignored its own hits
  // entirely would read as broken rather than easy, which is the same thing
  // Mastermind found.)
  function easyMove(view) {
    const hits = Rules.liveHits(view);
    if (hits.length) {
      const near = [];
      for (const [r, c] of hits) near.push(...neighbours(view, r, c));
      if (near.length) return { pick: Rules.pick(near), mode: "poke" };
    }
    const open = openSquares(view);
    return open.length ? { pick: Rules.pick(open), mode: "anywhere" } : null;
  }

  // Medium: hunt and target, the way most people play. It fires on a lattice
  // spaced by the smallest ship still out there — no ship can hide between the
  // gaps — and once it has a hit it works along the line.
  function mediumMove(view) {
    const hits = Rules.liveHits(view);
    if (hits.length) {
      const line = lineEnds(view, hits);
      if (line.length) return { pick: Rules.pick(line), mode: "line" };
      const near = [];
      for (const [r, c] of hits) near.push(...neighbours(view, r, c));
      if (near.length) return { pick: Rules.pick(near), mode: "poke" };
    }
    const step = Math.max(2, Math.min.apply(null, view.remaining));
    const open = openSquares(view);
    const lattice = open.filter(([r, c]) => (r + c) % step === 0);
    const from = lattice.length ? lattice : open;
    return from.length ? { pick: Rules.pick(from), mode: "sweep" } : null;
  }

  // Two or more loose hits in a row say which way the ship is lying, so the
  // only squares worth trying are the two ends of that run.
  function lineEnds(view, hits) {
    const n = view.size;
    const live = new Set(hits.map(([r, c]) => r * n + c));
    const out = [];
    for (const [r, c] of hits) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        if (!live.has((r + dr) * n + (c + dc))) continue;   // needs a partner
        // Walk both ways off the end of the run.
        for (const sign of [1, -1]) {
          let rr = r, cc = c;
          while (live.has(rr * n + cc)) { rr += dr * sign; cc += dc * sign; }
          if (Rules.inside(n, rr, cc) && view.shots[rr * n + cc] === WATER) out.push([rr, cc]);
        }
      }
    }
    return out;
  }

  /* ── The one the game actually asks ────────────────────────────────────── */

  // Always returns a legal square if there is one left, whatever the difficulty
  // — a game that stalls because the opponent has nothing to say is worse than
  // any amount of bad play.
  function choose(view, difficulty) {
    const started = Date.now();
    const d = density(view);
    let pick = null, mode = "density";

    if (difficulty === "easy") {
      const m = easyMove(view);
      if (m) { pick = m.pick; mode = m.mode; }
    } else if (difficulty === "medium") {
      const m = mediumMove(view);
      if (m) { pick = m.pick; mode = m.mode; }
    } else if (d.best) {
      pick = [d.best.r, d.best.c];
    }
    if (!pick) {
      if (d.best) { pick = [d.best.r, d.best.c]; mode = "density"; }
      else {
        const open = openSquares(view);
        if (!open.length) return null;
        pick = Rules.pick(open);
        mode = "anywhere";
      }
    }

    const i = pick[0] * view.size + pick[1];
    return {
      r: pick[0], c: pick[1], mode,
      hunting: d.hunting,
      weight: d.w[i],
      share: d.total ? d.w[i] / d.total : 0,
      heat: d.w,
      ms: Date.now() - started
    };
  }

  /* ── The hint button ───────────────────────────────────────────────────── */

  // Same view, same maths, then said out loud. The point of a hint is to get a
  // stuck player moving *and* to teach them why, so every one of these names
  // both the square and the reason it is the square.
  function hint(view) {
    const d = density(view);
    if (!d.best) return null;
    const where = Rules.square(d.best.r, d.best.c);
    const shortest = Math.min.apply(null, view.remaining);

    if (!d.hunting) {
      const lined = d.hits.length > 1;
      return {
        r: d.best.r, c: d.best.c,
        text: lined
          ? "You've hit the same ship twice, so you know which way it's lying. " +
            where + " carries the line on."
          : "There's a hit at " + Rules.square(d.hits[0][0], d.hits[0][1]) +
            " that hasn't sunk anything yet, so the rest of that ship is right " +
            "next to it. Try " + where + "."
      };
    }
    return {
      r: d.best.r, c: d.best.c,
      text: "Nothing's half-sunk, so go where there's most room. More of the ships " +
        "still out there would fit across " + where + " than anywhere else." +
        (shortest >= 3
          ? " Nothing shorter than " + shortest + " squares is left, so the tight gaps are safe."
          : "")
    };
  }

  /* ── Talking about the position ────────────────────────────────────────── */

  // Used by the coach line and the menu panel. Everything here is worked out
  // from the view, so it says the same things to a player as it would to the
  // computer looking at the same board.
  function facts(view) {
    const d = density(view);
    const open = openSquares(view).length;
    return {
      hunting: d.hunting,
      loose: d.hits.length,
      remaining: view.remaining.slice(),
      open,
      // How much of the sea would still hold something, as a share of what is
      // left to shoot at. It is the honest answer to "am I getting anywhere".
      live: open ? countLive(d.w) / open : 0,
      best: d.best,
      heat: d.w,
      total: d.total
    };
  }

  function countLive(w) {
    let n = 0;
    for (let i = 0; i < w.length; i++) if (w[i] > 0) n++;
    return n;
  }

  return { density, choose, hint, facts, lineEnds };
})();
