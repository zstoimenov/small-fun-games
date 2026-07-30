/* Mastermind — the rules, and nothing else.                                    */
/*                                                                              */
/* This file owns three things: what a legal code is, what a guess scores, and   */
/* what a game in progress looks like. It knows nothing about screens, whose go  */
/* it is, or how clever the opponent should be.                                  */
/*                                                                              */
/* It also owns the *code space* — the list of every legal code for a puzzle     */
/* size — because "which codes are legal" is a rule, and the solver in ai.js is  */
/* just a customer of it.                                                        */
"use strict";
window.MM = window.MM || {};

MM.Rules = (function () {
  const COLOURS = 6;

  // Colour is the whole game, so the six have to be as far apart as six hues
  // can be — and each carries a shape as well, for anyone who can't tell red
  // from green. The hex values live in the stylesheet; these are the names the
  // game says out loud.
  const COLOUR_NAMES = ["Red", "Yellow", "Green", "Blue", "Purple", "Pink"];
  const COLOUR_SHAPES = ["●", "★", "■", "◆", "✚", "▲"];

  const PRESETS = [
    { id: "easy",    label: "Easy",    pegs: 3, guesses: 12, repeats: false },
    { id: "classic", label: "Classic", pegs: 4, guesses: 10, repeats: true },
    { id: "tricky",  label: "Tricky",  pegs: 5, guesses: 10, repeats: true }
  ];

  const specOf = (id) => PRESETS.find((p) => p.id === id) || PRESETS[1];

  /* ── The code space ────────────────────────────────────────────────────── */

  // Every legal code, once per puzzle size, held flat: code i occupies
  // flat[i*pegs .. i*pegs+pegs-1]. The solver walks this a million times a move,
  // and a flat typed array is several times quicker than an array of arrays.
  //
  // Sizes are 120 (easy), 1,296 (classic) and 7,776 (tricky) — all small enough
  // to just build, and building beats deriving an index scheme that has to know
  // about the no-repeats rule.
  const spaceCache = new Map();

  function space(spec) {
    const cached = spaceCache.get(spec.id);
    if (cached) return cached;

    const codes = [];
    const cur = new Array(spec.pegs);
    const used = new Array(COLOURS).fill(false);
    (function fill(i) {
      if (i === spec.pegs) { codes.push(cur.slice()); return; }
      for (let c = 0; c < COLOURS; c++) {
        if (!spec.repeats && used[c]) continue;
        cur[i] = c;
        used[c] = true;
        fill(i + 1);
        used[c] = false;
      }
    })(0);

    const count = codes.length;
    const flat = new Uint8Array(count * spec.pegs);
    // Per-code colour tallies, so scoring a pair costs one pass over the pegs
    // plus one over the six colours, rather than counting both codes each time.
    const tally = new Uint8Array(count * COLOURS);
    for (let i = 0; i < count; i++) {
      for (let p = 0; p < spec.pegs; p++) {
        const c = codes[i][p];
        flat[i * spec.pegs + p] = c;
        tally[i * COLOURS + c]++;
      }
    }

    const built = { spec, count, pegs: spec.pegs, flat, tally };
    spaceCache.set(spec.id, built);
    return built;
  }

  const codeAt = (sp, i) => Array.from(sp.flat.subarray(i * sp.pegs, i * sp.pegs + sp.pegs));

  function indexOf(sp, code) {
    for (let i = 0; i < sp.count; i++) {
      let same = true;
      for (let p = 0; p < sp.pegs; p++) {
        if (sp.flat[i * sp.pegs + p] !== code[p]) { same = false; break; }
      }
      if (same) return i;
    }
    return -1;
  }

  function isLegal(spec, code) {
    if (!Array.isArray(code) || code.length !== spec.pegs) return false;
    const seen = new Array(COLOURS).fill(false);
    for (const c of code) {
      if (!Number.isInteger(c) || c < 0 || c >= COLOURS) return false;
      if (!spec.repeats && seen[c]) return false;
      seen[c] = true;
    }
    return true;
  }

  /* ── Scoring ───────────────────────────────────────────────────────────── */

  // The one function in this game that has to be right. Black pegs are counted
  // first and those positions taken out of the running altogether; only what is
  // left over is matched up by colour. Counting whites against the whole code
  // is the classic bug — with a secret of RRYY, a guess of RYYR would otherwise
  // be credited for the two reds it has already been paid for.
  function score(guess, secret) {
    const n = guess.length;
    const g = new Array(COLOURS).fill(0);
    const s = new Array(COLOURS).fill(0);
    let black = 0;
    for (let i = 0; i < n; i++) {
      if (guess[i] === secret[i]) black++;
      else { g[guess[i]]++; s[secret[i]]++; }
    }
    let white = 0;
    for (let c = 0; c < COLOURS; c++) white += Math.min(g[c], s[c]);
    return { black, white };
  }

  // The same answer packed into one small integer, for the solver's partition
  // counts. (pegs + 1) is the number of possible white counts for a given black.
  const key = (pegs, black, white) => black * (pegs + 1) + white;
  const keyCount = (pegs) => (pegs + 1) * (pegs + 1);

  /* ── Random codes ──────────────────────────────────────────────────────── */

  // crypto rather than Math.random: the code is the whole puzzle, and a run of
  // predictable secrets is exactly the thing a determined nine-year-old notices.
  function randomIndex(n) {
    const c = window.crypto || window.msCrypto;
    if (c && c.getRandomValues) {
      // Reject the tail of the range so every value stays equally likely.
      const limit = Math.floor(0xffffffff / n) * n;
      const buf = new Uint32Array(1);
      for (let tries = 0; tries < 32; tries++) {
        c.getRandomValues(buf);
        if (buf[0] < limit) return buf[0] % n;
      }
    }
    return Math.floor(Math.random() * n);
  }

  const randomCode = (spec) => codeAt(space(spec), randomIndex(space(spec).count));

  /* ── A game ────────────────────────────────────────────────────────────── */

  function newGame(spec, secret) {
    return {
      spec,
      secret: secret.slice(),
      rows: [],          // { code, black, white }
      over: false,
      cracked: false     // true if the code was broken, false if the goes ran out
    };
  }

  function guess(game, code) {
    if (game.over) return null;
    const marks = score(code, game.secret);
    const row = { code: code.slice(), black: marks.black, white: marks.white };
    game.rows.push(row);
    if (row.black === game.spec.pegs) { game.over = true; game.cracked = true; }
    else if (game.rows.length >= game.spec.guesses) { game.over = true; }
    return row;
  }

  function undo(game) {
    if (!game.rows.length) return null;
    const row = game.rows.pop();
    game.over = false;
    game.cracked = false;
    return row;
  }

  const goesLeft = (game) => game.spec.guesses - game.rows.length;

  /* ── Does this code still fit? ─────────────────────────────────────────── */

  // A code is still possible if scoring it against every guess already made
  // reproduces the pegs that guess actually got. This is the whole of the
  // deduction in the game, and both the solver and the hint button lean on it.
  function fits(code, rows, from) {
    for (let i = from || 0; i < rows.length; i++) {
      const m = score(rows[i].code, code);
      if (m.black !== rows[i].black || m.white !== rows[i].white) return false;
    }
    return true;
  }

  /* ── Save and restore ──────────────────────────────────────────────────── */

  // The secret plus the guesses *is* the game — the pegs are rebuilt by scoring,
  // so a saved game can never show feedback that disagrees with its own code.
  const snapshot = (game) => ({
    preset: game.spec.id,
    secret: game.secret.slice(),
    guesses: game.rows.map((r) => r.code.slice())
  });

  function restore(snap) {
    if (!snap || typeof snap.preset !== "string") return null;
    const spec = PRESETS.find((p) => p.id === snap.preset);
    if (!spec || !isLegal(spec, snap.secret)) return null;
    if (!Array.isArray(snap.guesses) || snap.guesses.length > spec.guesses) return null;

    const game = newGame(spec, snap.secret);
    for (const code of snap.guesses) {
      if (!isLegal(spec, code) || game.over) return null;
      guess(game, code);
    }
    return game;
  }

  return {
    COLOURS, COLOUR_NAMES, COLOUR_SHAPES, PRESETS,
    specOf, space, codeAt, indexOf, isLegal,
    score, key, keyCount, randomCode, randomIndex,
    newGame, guess, undo, goesLeft, fits, snapshot, restore
  };
})();
