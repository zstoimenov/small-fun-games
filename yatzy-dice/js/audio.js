/* Yatzy Dice — every sound in the game, synthesised.                           */
/*                                                                              */
/* No audio files, so nothing extra to download and nothing to cache. The dice   */
/* rattle is filtered noise; everything else is a couple of short tones.         */
/* The AudioContext is created on the first tap because mobile browsers refuse   */
/* to start one before the user has touched the page.                            */
"use strict";
window.YZ = window.YZ || {};

YZ.Audio = (function () {
  let ctx = null;
  let muted = false;

  function ready() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function setMuted(v) { muted = !!v; }
  function isMuted() { return muted; }

  /* ── Building blocks ───────────────────────────────────────────────────── */

  function tone(freq, dur, delay, type, vol) {
    const c = ready();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.09, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.12));
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + (dur || 0.12) + 0.02);
  }

  // A short burst of noise through a bandpass — the closest thing to five dice
  // hitting a table that two oscillator nodes can manage.
  function rattle(dur) {
    const c = ready();
    if (!c) return;
    dur = dur || 0.5;
    const frames = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // Clatter fades as the dice settle.
      const fade = 1 - i / frames;
      data[i] = (Math.random() * 2 - 1) * fade * fade;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1600;
    filter.Q.value = 0.8;
    const gain = c.createGain();
    gain.gain.value = 0.18;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  /* ── Named sounds ──────────────────────────────────────────────────────── */

  const tap = () => tone(520, 0.06, 0, "square", 0.05);
  const hold = () => tone(700, 0.07, 0, "square", 0.06);
  const release = () => tone(380, 0.07, 0, "square", 0.05);
  const roll = (dur) => rattle(dur);
  const land = () => tone(240, 0.1, 0, "sine", 0.07);

  const score = () => { tone(660, 0.1, 0, "sine", 0.08); tone(880, 0.12, 0.08, "sine", 0.07); };
  const zero = () => { tone(300, 0.16, 0, "triangle", 0.06); tone(200, 0.2, 0.1, "triangle", 0.05); };

  // The big one: five of a kind.
  const fanfare = () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, i * 0.09, "sine", 0.09));
    tone(1568, 0.4, 0.38, "sine", 0.07);
  };

  const bonus = () => {
    [784, 988, 1175].forEach((f, i) => tone(f, 0.16, i * 0.07, "triangle", 0.08));
  };

  const win = () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.24, i * 0.13, "sine", 0.09));
  };

  const turn = () => { tone(440, 0.09, 0, "sine", 0.06); tone(587, 0.11, 0.07, "sine", 0.06); };

  return { setMuted, isMuted, tap, hold, release, roll, land, score, zero, fanfare, bonus, win, turn };
})();
