/* Yatzy Dice — the dice themselves.                                            */
/*                                                                              */
/* Every die in this game comes from crypto.getRandomValues, never Math.random. */
/* There is no seed and no PRNG state to rewind, so a roll cannot be predicted,  */
/* replayed or nudged — not by the game, not by the player, not by the clock.    */
/*                                                                              */
/* Two details matter for real fairness:                                        */
/*                                                                              */
/*   1. Modulo bias. 256 doesn't divide by 6, so a naive byte % 6 makes 1-4      */
/*      very slightly more likely than 5-6. We reject any byte >= 252           */
/*      (252 = 42 x 6) and draw again, which makes all six faces exactly equal.  */
/*                                                                              */
/*   2. When the value is decided. Faces are drawn the instant a roll is asked   */
/*      for. The tumbling animation in ui.js is decoration painted on top of an  */
/*      answer that already exists — it never re-rolls at the end, and nothing   */
/*      about the animation can change the result.                              */
"use strict";
window.YZ = window.YZ || {};

YZ.Rng = (function () {
  /* ── Entropy pool ──────────────────────────────────────────────────────── */
  // Bytes are pulled from the OS in chunks because one getRandomValues call per
  // die would be wasteful; the bytes themselves are used exactly once each.
  const POOL_SIZE = 256;
  const pool = new Uint8Array(POOL_SIZE);
  let poolAt = POOL_SIZE; // forces a fill on first use

  const cryptoObj = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto : null;

  // Pre-2012 browsers have no Web Crypto. We still work, but the game says so
  // in the Dice check panel rather than quietly claiming to be better than it is.
  const secure = !!cryptoObj;

  let drawn = 0; // how many dice this session — shown in the fairness panel

  function nextByte() {
    if (poolAt >= POOL_SIZE) {
      if (secure) cryptoObj.getRandomValues(pool);
      else for (let i = 0; i < POOL_SIZE; i++) pool[i] = (Math.random() * 256) | 0;
      poolAt = 0;
    }
    return pool[poolAt++];
  }

  /* ── Unbiased integers ─────────────────────────────────────────────────── */

  // A uniform integer in [0, n). We take the largest multiple of n that fits in
  // the byte range and throw away anything at or above it, so what's left
  // divides evenly and every value is exactly as likely as every other. Ranges
  // wider than a byte pull as many bytes as they need and reject the same way.
  function int(n) {
    if (n <= 1) return 0;
    let bytes = 1, max = 256;
    while (max < n) { bytes++; max *= 256; }
    const limit = max - (max % n);
    for (;;) {
      let v = 0;
      for (let i = 0; i < bytes; i++) v = v * 256 + nextByte();
      if (v < limit) return v % n; // rejection sampling
    }
  }

  /* ── Dice ──────────────────────────────────────────────────────────────── */

  function die() {
    drawn++;
    return int(6) + 1;
  }

  function roll(n) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = die();
    return out;
  }

  // Rerolls only the dice that aren't being kept, returning a fresh array so the
  // caller never mutates the hand it was given.
  function rollKept(dice, held) {
    return dice.map((d, i) => (held[i] ? d : die()));
  }

  // Fisher-Yates on the crypto source, for shuffling anything that needs it.
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ── Fairness check ────────────────────────────────────────────────────── */

  // Rolls n real dice and measures how evenly the six faces landed. Chi-square
  // with 5 degrees of freedom: under about 11.07 means the spread is what honest
  // dice look like (that's the p = 0.05 line). Used by the in-game Dice check
  // panel and by YZ.debug.diceTest.
  function test(n) {
    n = n || 60000;
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) counts[die() - 1]++;
    const expected = n / 6;
    let chi = 0;
    for (const c of counts) chi += ((c - expected) * (c - expected)) / expected;
    return {
      n: n,
      counts: counts,
      expected: expected,
      chi: chi,
      fair: chi < 11.07,
      secure: secure
    };
  }

  function stats() {
    return { drawn: drawn, secure: secure };
  }

  return { roll, rollKept, die, int, shuffle, test, stats, secure };
})();
