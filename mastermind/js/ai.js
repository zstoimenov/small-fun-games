/* Mastermind — the code breaker, and the reasoning behind the hint button.     */
/*                                                                              */
/* One idea does all the work: keep the set of codes that still fit every peg    */
/* handed out so far. Everything else is a question about that set — how big is  */
/* it, which colours have vanished from it, and which guess would cut it down    */
/* the most.                                                                     */
/*                                                                              */
/* Hard is Knuth's 1977 minimax: try every code as the next guess, sort what's   */
/* left into piles by the pegs it would score, and play the guess whose biggest  */
/* pile is smallest — the guess that can't go badly. At 4 pegs and 6 colours it  */
/* provably never needs more than five goes, which is what makes this solver     */
/* worth testing: it either reproduces that number or it is wrong.               */
"use strict";
window.MM = window.MM || {};

MM.Ai = (function () {
  const Rules = MM.Rules;
  const C = Rules.COLOURS;

  // A full feedback table is count² bytes. 1,296 codes is 1.6 MB and pays for
  // itself many times over; 7,776 codes would be 60 MB, so that size scores
  // pairs as it goes instead. fb() hides which of the two is in use.
  const TABLE_MAX = 3e6;

  // Pool × survivors lookups allowed in one move. Above this, the guess pool is
  // cut back to codes that could themselves be the answer — the usual way to
  // keep minimax affordable, and it costs surprisingly little accuracy.
  const POOL_BUDGET = 3e6;

  const tables = new Map();
  const openings = new Map();

  /* ── Scoring a pair of codes by index ──────────────────────────────────── */

  // Same answer as Rules.score, reached the other way round: the whole-code
  // colour overlap, minus the pegs that were already exact. Two independent
  // routes to the same number, which is a gift when testing.
  function scoreIdx(sp, i, j) {
    const pegs = sp.pegs, F = sp.flat;
    const a = i * pegs, b = j * pegs;
    let black = 0;
    for (let p = 0; p < pegs; p++) if (F[a + p] === F[b + p]) black++;
    const T = sp.tally, ta = i * C, tb = j * C;
    let both = 0;
    for (let c = 0; c < C; c++) {
      const x = T[ta + c], y = T[tb + c];
      both += x < y ? x : y;
    }
    return black * (pegs + 1) + (both - black);
  }

  function table(sp) {
    if (tables.has(sp.spec.id)) return tables.get(sp.spec.id);
    let t = null;
    if (sp.count * sp.count <= TABLE_MAX) {
      t = new Uint8Array(sp.count * sp.count);
      // Feedback is symmetric, so each pair is worked out once and written twice.
      for (let i = 0; i < sp.count; i++) {
        for (let j = i; j < sp.count; j++) {
          const v = scoreIdx(sp, i, j);
          t[i * sp.count + j] = v;
          t[j * sp.count + i] = v;
        }
      }
    }
    tables.set(sp.spec.id, t);
    return t;
  }

  const fb = (sv, i, j) => (sv.tbl ? sv.tbl[i * sv.sp.count + j] : scoreIdx(sv.sp, i, j));

  /* ── The set of codes that still fit ───────────────────────────────────── */

  function solver(spec) {
    const sp = Rules.space(spec);
    const alive = new Int32Array(sp.count);
    for (let i = 0; i < sp.count; i++) alive[i] = i;
    return {
      spec, sp,
      tbl: table(sp),
      alive,
      aliveLen: sp.count,
      in: new Uint8Array(sp.count).fill(1),  // membership, for minimax's tie-break
      // The same set kept a second time, but only ever narrowed by the black
      // pegs. This is what Easy plays from — see nearsighted().
      blind: Int32Array.from(alive),
      blindLen: sp.count,
      tried: new Uint8Array(sp.count),
      rows: []                                // { gi, key } — the guesses so far
    };
  }

  // Take one row of pegs into account. Everything that would not have scored
  // exactly those pegs is dropped, and can never come back.
  function observe(sv, code, black, white) {
    const gi = Rules.indexOf(sv.sp, code);
    if (gi < 0) return;
    const pegs = sv.sp.pegs;
    const k = Rules.key(pegs, black, white);

    let n = 0;
    for (let x = 0; x < sv.aliveLen; x++) {
      const j = sv.alive[x];
      if (fb(sv, gi, j) === k) sv.alive[n++] = j;
      else sv.in[j] = 0;
    }
    sv.aliveLen = n;

    let m = 0;
    for (let x = 0; x < sv.blindLen; x++) {
      const j = sv.blind[x];
      if (Math.floor(fb(sv, gi, j) / (pegs + 1)) === black) sv.blind[m++] = j;
    }
    sv.blindLen = m;

    sv.tried[gi] = 1;
    sv.rows.push({ gi, key: k });
  }

  // Rebuilt from a list of rows rather than mutated backwards — undo happens
  // once in a while and correctness matters more than the microsecond.
  function replay(spec, rows) {
    const sv = solver(spec);
    for (const r of rows) observe(sv, r.code, r.black, r.white);
    return sv;
  }

  /* ── Choosing a guess ──────────────────────────────────────────────────── */

  function minimax(sv) {
    const sp = sv.sp;
    const parts = new Int32Array(Rules.keyCount(sp.pegs));
    const full = sp.count * sv.aliveLen <= POOL_BUDGET;
    const poolLen = full ? sp.count : sv.aliveLen;

    let bestWorst = Infinity, best = -1, bestIn = false;
    for (let p = 0; p < poolLen; p++) {
      const g = full ? p : sv.alive[p];
      if (sv.tried[g]) continue;

      parts.fill(0);
      let worst = 0;
      for (let x = 0; x < sv.aliveLen; x++) {
        const n = ++parts[fb(sv, g, sv.alive[x])];
        if (n > worst) {
          worst = n;
          // It is already worse than the best we have; nothing later in this
          // loop can bring it back down.
          if (worst > bestWorst) break;
        }
      }
      if (worst > bestWorst) continue;

      // Knuth's tie-break, and it matters: among guesses with the same
      // worst case, prefer one that could itself be the answer — it might win
      // outright — and then the lowest-numbered, so the choice is repeatable.
      const inS = sv.in[g] === 1;
      if (worst < bestWorst || (inS && !bestIn)) {
        bestWorst = worst; best = g; bestIn = inS;
      }
    }
    return best;
  }

  // Every game at a given size opens with the same guess, so it is worked out
  // once. Knuth's opener at 4 pegs is 1122 — two of one colour and two of
  // another — and the same shape scales to the other sizes. Small spaces are
  // cheap enough to just solve outright.
  function opening(sv) {
    const key = sv.spec.id;
    if (openings.has(key)) return openings.get(key);
    let gi;
    if (sv.sp.count <= 500) {
      gi = minimax(sv);
    } else {
      const code = [];
      for (let p = 0; p < sv.sp.pegs; p++) code.push(sv.spec.repeats ? Math.floor(p / 2) : p);
      gi = Rules.indexOf(sv.sp, code);
    }
    openings.set(key, gi);
    return gi;
  }

  function randomFrom(list, len) {
    return len ? list[Rules.randomIndex(len)] : -1;
  }

  // Easy only counts the black pegs. It never contradicts what it has been told
  // about right-place colours, so it doesn't read as broken — it just misses
  // everything the white pegs were trying to tell it, which is exactly the
  // mistake a child makes first. Measured over the full 1,296: it cracks the
  // code 99% of the time and takes about seven goes, against Hard's four and a
  // half. The first version of this forgot everything but the last row, and
  // failed 78% of the time — dim enough to look faulty.
  function nearsighted(sv) {
    const pool = [];
    for (let x = 0; x < sv.blindLen; x++) if (!sv.tried[sv.blind[x]]) pool.push(sv.blind[x]);
    if (pool.length) return randomFrom(pool, pool.length);
    const any = [];
    for (let i = 0; i < sv.sp.count; i++) if (!sv.tried[i]) any.push(i);
    return randomFrom(any, any.length);
  }

  function untriedAlive(sv) {
    const pool = [];
    for (let x = 0; x < sv.aliveLen; x++) if (!sv.tried[sv.alive[x]]) pool.push(sv.alive[x]);
    return pool;
  }

  // The one entry point app.js uses on the computer's go. Returns the guess plus
  // what it cost, for the "what was it thinking" panel.
  function chooseGuess(sv, difficulty) {
    const started = Date.now();
    const before = sv.aliveLen;
    let gi;

    if (!sv.rows.length) {
      gi = opening(sv);
    } else if (difficulty === "easy") {
      gi = nearsighted(sv);
    } else if (difficulty === "medium") {
      // Always a code that still fits — sound, just not clever about which.
      const pool = untriedAlive(sv);
      gi = pool.length ? randomFrom(pool, pool.length) : minimax(sv);
    } else {
      gi = sv.aliveLen === 1 ? sv.alive[0] : minimax(sv);
    }

    if (gi < 0) return null;
    return {
      code: Rules.codeAt(sv.sp, gi),
      left: before,
      guessNo: sv.rows.length + 1,
      ms: Date.now() - started
    };
  }

  /* ── What the surviving codes have in common ───────────────────────────── */

  // Facts a child could check by hand, pulled out of the surviving set. These
  // are what turn a hint from "play this" into "play this, because…".
  function facts(sv) {
    const sp = sv.sp;
    const seen = new Array(C).fill(false);
    const fixed = [];
    for (let p = 0; p < sp.pegs; p++) fixed.push(-2);   // -2 = nothing seen yet

    for (let x = 0; x < sv.aliveLen; x++) {
      const base = sv.alive[x] * sp.pegs;
      for (let p = 0; p < sp.pegs; p++) {
        const c = sp.flat[base + p];
        seen[c] = true;
        if (fixed[p] === -2) fixed[p] = c;
        else if (fixed[p] !== c) fixed[p] = -1;        // -1 = not settled
      }
    }

    const absent = [];
    for (let c = 0; c < C; c++) if (!seen[c]) absent.push(c);
    const known = [];
    for (let p = 0; p < sp.pegs; p++) if (fixed[p] >= 0) known.push({ slot: p, colour: fixed[p] });

    return { left: sv.aliveLen, absent, known };
  }

  const ruledOut = (sv, code) => {
    const gi = Rules.indexOf(sv.sp, code);
    return gi >= 0 && sv.in[gi] !== 1;
  };

  /* ── The hint button ───────────────────────────────────────────────────── */

  // Leads with whatever the player could have worked out themselves, and only
  // falls back on "the solver likes it" when there is nothing plainer to say.
  function hint(sv) {
    if (!sv.aliveLen) return null;
    const f = facts(sv);
    const name = (c) => Rules.COLOUR_NAMES[c].toLowerCase();

    if (sv.aliveLen === 1) {
      return {
        code: Rules.codeAt(sv.sp, sv.alive[0]),
        text: "This is it — it's the only row left that fits every peg you've been given. 🎉",
        left: 1
      };
    }

    const gi = minimax(sv);
    if (gi < 0) return null;
    const code = Rules.codeAt(sv.sp, gi);

    let text;
    if (f.absent.length === 1) {
      text = "There's no " + name(f.absent[0]) + " in the code at all — you can stop using it. 🚫";
    } else if (f.absent.length > 1) {
      text = "Neither " + name(f.absent[0]) + " nor " + name(f.absent[1]) +
        " is in the code — rule them both out. 🚫";
    } else if (f.known.length) {
      const k = f.known[0];
      text = "Slot " + (k.slot + 1) + " is " + name(k.colour) +
        " — every row that still fits has it there. 📌";
    } else if (f.left <= 6) {
      text = "Only " + f.left + " rows still fit. Try this one — it tells them apart. 🔎";
    } else {
      text = f.left + " rows still fit. This one splits them into the smallest piles, " +
        "whatever the answer turns out to be. 🔎";
    }

    return { code, text, left: f.left };
  }

  return { solver, observe, replay, chooseGuess, hint, facts, ruledOut, scoreIdx, minimax };
})();
