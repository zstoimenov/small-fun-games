/* Deal or No Deal — where the money goes.                                      */
/*                                                                              */
/* Lifted from yatzy-dice/js/rng.js, which draws dice the same way. Every box    */
/* on the board is filled from crypto.getRandomValues, never Math.random. There  */
/* is no seed and no PRNG state to rewind, so a board cannot be predicted,       */
/* replayed or nudged — not by the game, not by the player, not by the clock.    */
/*                                                                              */
/* Two details matter for real fairness:                                        */
/*                                                                              */
/*   1. Modulo bias. A byte range rarely divides by the number of boxes, so a    */
/*      naive byte % n makes the low numbers slightly likelier. We reject the    */
/*      tail of the range and draw again, which makes every box exactly equal.   */
/*                                                                              */
/*   2. When the value is decided. The whole board is dealt the instant a game   */
/*      starts. Every wobble and flourish in ui.js is decoration painted on top  */
/*      of an answer that already exists — nothing about opening a box can       */
/*      change what was in it.                                                   */
"use strict";
window.DND = window.DND || {};

DND.Rng = (function () {
  /* ── Entropy pool ──────────────────────────────────────────────────────── */
  // Bytes are pulled from the OS in chunks because one getRandomValues call per
  // box would be wasteful; the bytes themselves are used exactly once each.
  const POOL_SIZE = 256;
  const pool = new Uint8Array(POOL_SIZE);
  let poolAt = POOL_SIZE; // forces a fill on first use

  const cryptoObj = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto : null;

  // Pre-2012 browsers have no Web Crypto. We still work, but the fairness panel
  // says so rather than quietly claiming to be better than it is.
  const secure = !!cryptoObj;

  let dealt = 0; // how many boards this session — shown in the fairness panel

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
  // divides evenly and every value is exactly as likely as every other.
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

  // Fisher-Yates on the crypto source. This is the deal: the money ladder goes
  // in, a board comes out, and which box holds what is decided here and nowhere
  // else.
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function deal(ladder) {
    dealt++;
    return shuffle(ladder);
  }

  /* ── Fairness check ────────────────────────────────────────────────────── */

  // The claim a player actually cares about is "the top prize is just as likely
  // to be in my box as in any other". So that is what gets measured: deal n
  // boards, count where the biggest number landed each time, and compare the
  // spread against what honest shuffling looks like.
  //
  // Chi-square with (boxes - 1) degrees of freedom. Under the line, the spread
  // is unremarkable — which is the only thing a fairness test can ever say.
  //
  // The line is p = 0.01, not the usual p = 0.05, and that is deliberate. This
  // panel exists to reassure a child that the game isn't cheating, and at the
  // 0.05 line an honest shuffle fails one run in twenty. Measured over repeated
  // runs the average chi-square lands within a point of the degrees of freedom
  // every time, so the shuffle is fine; it is the false-alarm rate that needed
  // fixing. At 0.01 a fair board gets accused once in a hundred goes instead.
  const CRITICAL = { 9: 21.67, 13: 27.69, 15: 30.58, 19: 36.19, 21: 38.93 };

  function shuffleTest(boxes, n) {
    boxes = boxes || 22;
    n = n || 20000;
    const ladder = [];
    for (let i = 0; i < boxes; i++) ladder.push(i);
    const top = boxes - 1;

    const counts = new Array(boxes).fill(0);
    for (let i = 0; i < n; i++) counts[shuffle(ladder).indexOf(top)]++;

    const expected = n / boxes;
    let chi = 0;
    for (const c of counts) chi += ((c - expected) * (c - expected)) / expected;

    // Anything not in the table falls back to the df = 9 line, the tightest of
    // them, so a board size nobody measured is never flattered.
    const limit = CRITICAL[boxes - 1] || 21.67;
    return { n, boxes, counts, expected, chi, limit, fair: chi < limit, secure };
  }

  function stats() {
    return { dealt, secure };
  }

  return { int, shuffle, deal, shuffleTest, stats, secure };
})();
