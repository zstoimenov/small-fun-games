/* Morse Agent - the telegraph key: turning presses into dots and dashes.       */
/*                                                                              */
/* A fixed rule ("under 200 ms is a dot") fails kids: their pace is slower than */
/* the textbook and it drifts as they concentrate. Nudging a running guess      */
/* fails too - a fast tapper whose dashes all start out below the line reads    */
/* as "all dots" forever, and the guess never learns otherwise. So the key      */
/* keeps the last few presses and, at the end of each letter, splits them into  */
/* a short group and a long group (the biggest gap on a log scale). The line    */
/* between dot and dash sits between the two groups. When there is no clear     */
/* split - a run of S, O, M - it keeps the line it had.                         */
/*                                                                              */
/* Pure timing, no DOM: the app feeds it down/up times and gets letters back.   */
"use strict";
window.MO = window.MO || {};

MO.Key = function (opts) {
  const R = MO.Rules;
  const KEEP = 16;
  let line = 2 * (opts.unit || 150);   // dot/dash boundary in ms; a dit is about half of it
  let hist = [];                       // recent press lengths, across letters
  let durs = [];
  let presses = [];                    // [{ d, u }] ms from the first press of this letter
  let first = 0;
  let downAt = 0;
  let timer = 0;
  let isDown = false;

  const unit = () => line / 2;
  const read = (list) => list.map((d) => (d < line ? "." : "-")).join("");

  // The widest gap between neighbouring press lengths, on a log scale (a dash
  // is "three times" a dot, not "200 ms more"). Only trusted if the two sides
  // really are different: 1.8x apart, where a clean fist is 3x.
  function relearn() {
    if (hist.length < 2) return;
    const s = hist.map(Math.log).sort((a, b) => a - b);
    let best = 0, at = -1;
    for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > best) { best = s[i] - s[i - 1]; at = i; }
    if (at < 0) return;
    const lo = s.slice(0, at), hi = s.slice(at);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const a = mean(lo), b = mean(hi);
    if (b - a < Math.log(1.8)) return;
    line = Math.max(90, Math.min(900, Math.exp((a + b) / 2)));
  }

  function finish() {
    clearTimeout(timer);
    if (!durs.length) return;
    relearn();
    const p = read(durs), pr = presses;
    durs = [];
    presses = [];
    opts.onLetter(R.DECODE[p] || null, p, pr, unit());
  }

  function down(t) {
    if (isDown) return;
    isDown = true;
    clearTimeout(timer);
    if (!durs.length) first = t;
    downAt = t;
  }

  function up(t) {
    if (!isDown) return;
    isDown = false;
    const dur = t - downAt;
    // A bounce or a brushed screen: too short to be anything, so not a dot.
    if (dur < 25) { if (durs.length) wait(); return; }
    durs.push(dur);
    hist.push(dur);
    if (hist.length > KEEP) hist.shift();
    presses.push({ d: downAt - first, u: t - first });
    // Shown straight away with the current line; the final reading at the end of
    // the letter may tidy it up once this letter's own presses have been counted.
    opts.onSymbol && opts.onSymbol(read(durs));
    // No letter is longer than five; a sixth press means something went wrong,
    // so end it now rather than let it grow.
    if (durs.length > 5) { finish(); return; }
    wait();
  }

  function wait() {
    clearTimeout(timer);
    timer = setTimeout(finish, Math.max(R.END_GAP * unit(), 420));
  }

  function cancel() {
    clearTimeout(timer);
    durs = [];
    presses = [];
    isDown = false;
  }

  return { down, up, cancel, unit, busy: () => isDown || durs.length > 0 };
};
