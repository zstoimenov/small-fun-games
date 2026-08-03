/* Lemonade Stand — seeded randomness.                                          */
/*                                                                              */
/* The opposite choice to Yatzy, and for a reason. Yatzy draws every die from    */
/* crypto so a roll can't be replayed; here a day MUST be replayable. The save   */
/* blob holds a seed and a ledger, not a pre-rolled fortnight, so every forecast, */
/* lemon price and thirsty customer is regenerated from (seed, day) when a run    */
/* is resumed. Without that, closing the tab on a scorcher and coming back to     */
/* rain would look — correctly — like cheating.                                  */
/*                                                                              */
/* mulberry32: one multiply-xor-shift round, 32 bits of state, passes the small  */
/* statistical batteries and is about ten lines. Nothing here is a secret, so    */
/* cryptographic quality is beside the point; determinism is the whole feature.  */
/* Only the run's opening seed comes from crypto, so two runs differ.            */
"use strict";
window.LS = window.LS || {};

LS.Rng = (function () {
  /* ── The generator ─────────────────────────────────────────────────────── */

  // Returns an independent stream for a (seed, salt) pair. Days ask for their
  // own stream rather than sharing one running generator, so the number of times
  // a previous day happened to call next() can never shift what today looks
  // like. That independence is what makes a partial replay safe.
  function stream(seed, salt) {
    let a = (seed ^ (Math.imul(salt | 0, 0x9e3779b1) >>> 0)) >>> 0;

    function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Uniform integer in [0, n). The stream is 32-bit uniform to begin with, so
    // plain multiplication is unbiased enough here — this decides weather, not
    // money, and the money never touches it.
    function int(n) {
      return n <= 1 ? 0 : Math.floor(next() * n) % n;
    }

    // A fair coin, spelled out because `int(2) === 1` reads badly at the call site.
    function chance(p) {
      return next() < p;
    }

    // Uniform integer in [lo, hi] inclusive — the shape most callers actually want.
    function between(lo, hi) {
      return lo + int(hi - lo + 1);
    }

    return { next, int, chance, between };
  }

  /* ── Seeds ─────────────────────────────────────────────────────────────── */

  // A fresh run's seed. crypto when it exists so two runs on the same tablet in
  // the same second don't play out identically; Math.random is a fine fallback
  // because a repeated seed costs a child nothing.
  function newSeed() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const out = new Uint32Array(1);
      crypto.getRandomValues(out);
      return out[0] >>> 0;
    }
    return (Math.random() * 4294967296) >>> 0;
  }

  return { stream, newSeed };
})();
