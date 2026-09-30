/* Career Compass - sound effects, made on the fly with WebAudio.              */
"use strict";
window.CC = window.CC || {};

CC.Audio = (function () {
  let ctx = null;
  let muted = false;

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

  function notes(list, type, vol, gap) {
    if (muted || !ready()) return;
    let t = ctx.currentTime + 0.02;
    list.forEach(([f, d]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + d + 0.02);
      t += gap || d * 0.8;
    });
  }

  return {
    ready,
    isMuted: () => muted,
    setMuted: (m) => { muted = !!m; },
    click: () => notes([[660, 0.06]], "square", 0.08),
    pick: () => notes([[523, 0.08], [784, 0.12]], "triangle", 0.2),
    // A quick tick-tick-tick as the needle swings, then a chime where it lands.
    spin: () => {
      notes(Array.from({ length: 10 }, (_, i) => [900 + i * 40, 0.04]), "square", 0.05, 0.07);
      setTimeout(() => notes([[523, 0.15], [659, 0.15], [784, 0.15], [1047, 0.4]], "triangle", 0.22), 750);
    }
  };
})();
