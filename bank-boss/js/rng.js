/* Bank Boss — seeded randomness.                                               */
/*                                                                              */
/* Lemonade Stand's generator, and for Lemonade Stand's reason: a day has to be  */
/* replayable. The save holds a seed and a ledger rather than a pre-rolled       */
/* fortnight, so resuming a run regenerates exactly the same queue of customers. */
/* Closing the tab halfway through a day and coming back to a different set of   */
/* people at the counter would look, correctly, like cheating.                   */
/*                                                                              */
/* mulberry32. Nothing here is a secret, so cryptographic quality is beside the  */
/* point; determinism is the whole feature. Only the opening seed comes from     */
/* crypto, so two runs differ.                                                   */
"use strict";
window.BB = window.BB || {};

BB.Rng = (function () {
  // An independent stream per (seed, salt). Days ask for their own stream rather
  // than sharing one running generator, so how many times yesterday happened to
  // call next() can never shift what today looks like.
  function stream(seed, salt) {
    let a = (seed ^ (Math.imul(salt | 0, 0x9e3779b1) >>> 0)) >>> 0;

    function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    const int = (n) => (n <= 1 ? 0 : Math.floor(next() * n) % n);
    const chance = (p) => next() < p;
    const between = (lo, hi) => lo + int(hi - lo + 1);
    const pick = (arr) => arr[int(arr.length)];

    return { next, int, chance, between, pick };
  }

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
