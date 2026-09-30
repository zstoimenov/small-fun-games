/* Vet Clinic - sound effects, made on the fly with WebAudio.                  */
/* Nothing to download, so the game still works offline and stays tiny.        */
"use strict";
window.VC = window.VC || {};

VC.Audio = (function () {
  let ctx = null;
  let noise = null;
  let muted = false;

  // Built on the first touch: mobile browsers refuse to start audio before one.
  function ready() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      // One second of white noise, reused for every whoosh and hiss.
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function notes(list, type, vol) {
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
      t += d * 0.8;
    });
  }

  // Filtered noise. A falling filter sounds like a whoosh; a flat one, a hiss.
  function whoosh(dur, from, to, vol) {
    if (muted || !ready()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // A drum-ish thump: a sine that drops fast in pitch.
  function thump(from, vol) {
    if (muted || !ready()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.32);
  }

  return {
    ready,
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
    click() { notes([[660, 0.06]], "sine", 0.15); },
    // Lub-dub, short enough that a mouse's 600 a minute still sounds like one.
    beat() { thump(90, 0.55); },
    check() { notes([[700, 0.06], [880, 0.08]], "sine", 0.12); },
    clue() { notes([[520, 0.08], [780, 0.08], [1040, 0.12]], "triangle", 0.16); },
    hmm() { notes([[330, 0.12], [294, 0.18]], "triangle", 0.15); },
    win() { notes([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.32]]); },
    nope() { notes([[220, 0.14]], "triangle", 0.18); },
    right() { notes([[880, 0.1], [1320, 0.16]]); },
    wrong() { notes([[220, 0.22]], "square", 0.12); },
    star(i) { notes([[784 + i * 196, 0.18]], "sine", 0.22); }
  };
})();
