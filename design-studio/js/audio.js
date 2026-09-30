/* Design Studio - sound effects, made on the fly with WebAudio.               */
"use strict";
window.DS = window.DS || {};

DS.Audio = (function () {
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
  // A paint drop: a sine that bends up fast, like a "bloop".
  function plop() {
    if (muted || !ready()) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(720, t + 0.09);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.16);
  }
  return {
    ready, plop,
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
    click() { notes([[660, 0.05]], "sine", 0.12); },
    pour() { notes([[500, 0.08], [380, 0.1], [260, 0.16]], "sine", 0.14); },
    right() { notes([[880, 0.1], [1320, 0.16]]); },
    wrong() { notes([[220, 0.22]], "square", 0.1); },
    win() { notes([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.32]]); },
    star(i) { notes([[784 + i * 196, 0.18]], "sine", 0.2); }
  };
})();
