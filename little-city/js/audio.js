/* Little City - sound effects, made on the fly with WebAudio.                 */
"use strict";
window.LC = window.LC || {};

LC.Audio = (function () {
  let ctx = null, muted = false;

  // Built on the first touch: mobile browsers refuse to start audio before one.
  function ready() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function notes(list, type, vol) {
    if (muted || !ready()) return;
    let t = ctx.currentTime + 0.02;
    list.forEach(([f, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + d + 0.02);
      t += d * 0.8;
    });
  }
  // A soft thud for a building going up; a quick tick for a road square.
  function thud(f, vol, dur) {
    if (muted || !ready()) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f / 2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  return {
    ready,
    build(small) { if (small) notes([[520, 0.04]], "square", 0.05); else { thud(220, 0.35, 0.18); notes([[660, 0.06], [880, 0.1]], "triangle", 0.12); } },
    boom() { thud(140, 0.4, 0.3); },
    nope() { notes([[260, 0.12]], "triangle", 0.12); },
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
    click() { notes([[660, 0.05]], "sine", 0.12); },
    right() { notes([[880, 0.1], [1320, 0.16]]); },
    wrong() { notes([[220, 0.22]], "square", 0.1); },
    win() { notes([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.32]]); },
    star(i) { notes([[784 + i * 196, 0.18]], "sine", 0.2); }
  };
})();
