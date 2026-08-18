/* Cube Timer — the numbers.                                                     */
/*                                                                              */
/* A solve is { ms, penalty, scramble, at }. Nothing here touches the page or    */
/* the clock, so the checker in tools/cube-check.js can load it into plain node  */
/* and prove the averages. That matters more than it sounds: an average of five  */
/* is not the mean of five, and getting it wrong is the classic timer bug.       */
/*                                                                              */
/* The rules are the competition ones, because they are the ones a kid will meet */
/* at their first comp:                                                         */
/*   +2   — two seconds added, for finishing with one face a fraction out.       */
/*   DNF  — didn't finish; it counts as the worst time, not as no time at all.   */
/*   ao5  — drop the best and the worst, average the middle three. One DNF is    */
/*          survivable because it is the one that gets dropped; two are not.     */
"use strict";
window.CT = window.CT || {};

CT.Stats = (function () {

  const PLUS_TWO = 2000;

  // What the solve is actually worth. null means DNF — deliberately not
  // Infinity, so an accidental sum with one in it comes out obviously wrong
  // rather than plausibly huge.
  function effective(solve) {
    if (!solve || solve.penalty === "dnf") return null;
    return solve.ms + (solve.penalty === "+2" ? PLUS_TWO : 0);
  }

  // Hundredths, truncated rather than rounded — 12.999 is a 12, the way the
  // timer at a competition would call it.
  function format(ms) {
    if (ms === null || ms === undefined) return "DNF";
    const total = Math.floor(ms / 10);           // in hundredths
    const cs = total % 100;
    const secs = Math.floor(total / 100);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    const cc = cs < 10 ? "0" + cs : String(cs);
    if (mins > 0) return mins + ":" + (s < 10 ? "0" + s : s) + "." + cc;
    return s + "." + cc;
  }

  // What the big digits show while a solve is running: no hundredths, because a
  // number that changes 100 times a second is a blur, not a reading.
  function formatRunning(ms) {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    const tenth = Math.floor((ms % 1000) / 100);
    if (mins > 0) return mins + ":" + (s < 10 ? "0" + s : s) + "." + tenth;
    return s + "." + tenth;
  }

  const times = (solves) => solves.map(effective);

  function best(solves) {
    let b = null;
    for (const t of times(solves)) if (t !== null && (b === null || t < b)) b = t;
    return b;
  }

  function worst(solves) {
    let w = null;
    for (const t of times(solves)) if (t !== null && (w === null || t > w)) w = t;
    return w;
  }

  // Every solve that finished, averaged. DNFs sit this one out.
  function mean(solves) {
    const done = times(solves).filter((t) => t !== null);
    if (!done.length) return null;
    return done.reduce((a, b) => a + b, 0) / done.length;
  }

  /* An average of n: the last n solves, best and worst dropped.
   * Returns undefined when there aren't n solves yet (nothing to show), and
   * null when there are but it's a DNF (something to show, and it's bad news).*/
  function averageOf(solves, n) {
    if (solves.length < n) return undefined;
    const slice = times(solves.slice(-n));
    const dnfs = slice.filter((t) => t === null).length;
    if (dnfs > 1) return null;
    // The single DNF is the worst time by definition, so it is the one dropped.
    const done = slice.filter((t) => t !== null).sort((a, b) => a - b);
    const middle = dnfs === 1 ? done.slice(1) : done.slice(1, -1);
    if (!middle.length) return null;
    return middle.reduce((a, b) => a + b, 0) / middle.length;
  }

  const ao5 = (solves) => averageOf(solves, 5);
  const ao12 = (solves) => averageOf(solves, 12);

  // Is this solve the best of the lot? Used for the party, so a DNF or a +2
  // that lands on the old best doesn't set one off.
  function isPersonalBest(solves, index) {
    const t = effective(solves[index]);
    if (t === null) return false;
    for (let i = 0; i < solves.length; i++) {
      if (i === index) continue;
      const o = effective(solves[i]);
      if (o !== null && o <= t) return false;
    }
    return true;
  }

  // The sparkline wants everything on one scale, DNFs included — a DNF draws as
  // a full-height bar, which is honest: it was the worst thing that happened.
  function bars(solves, count) {
    const slice = solves.slice(-count);
    const done = times(slice).filter((t) => t !== null);
    if (!done.length) return [];
    const lo = Math.min.apply(null, done), hi = Math.max.apply(null, done);
    const span = hi - lo || 1;
    return times(slice).map((t) => ({
      dnf: t === null,
      // Taller means slower, so the shape reads the way a kid expects: the
      // little bars are the good days. Never below a tenth, or a personal best
      // draws as nothing at all.
      h: t === null ? 1 : 0.1 + 0.9 * ((t - lo) / span)
    }));
  }

  return {
    PLUS_TWO, effective, format, formatRunning,
    best, worst, mean, averageOf, ao5, ao12, isPersonalBest, bars
  };
})();
