/* Lemonade Stand — every sound in the game, synthesised.                       */
/*                                                                              */
/* No audio files, so nothing extra to download and nothing to cache. Two        */
/* primitives — a shaped tone and a burst of filtered noise — and every named    */
/* sound is a couple of lines composed from them. The AudioContext is created on */
/* the first tap because mobile browsers refuse to start one before the user has */
/* touched the page.                                                             */
"use strict";
window.LS = window.LS || {};

LS.Audio = (function () {
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

  // Filtered noise. High and short it is ice in a cup; low and long it is the
  // shutters coming down at the end of a bad day.
  function noise(dur, freq, vol) {
    const c = ready();
    if (!c) return;
    dur = dur || 0.3;
    const frames = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const fade = 1 - i / frames;
      data[i] = (Math.random() * 2 - 1) * fade * fade;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq || 2400;
    filter.Q.value = 0.9;
    const gain = c.createGain();
    gain.gain.value = vol || 0.14;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  /* ── Named sounds ──────────────────────────────────────────────────────── */

  const tap = () => tone(520, 0.06, 0, "square", 0.05);
  const pick = () => tone(700, 0.07, 0, "square", 0.06);

  // Buying: a paper-bag rustle.
  const buy = () => noise(0.16, 1100, 0.1);

  // One cup sold. Two quick bright tones — this fires up to forty times in a
  // day, so it is deliberately the shortest sound in the game.
  const coin = () => { tone(880, 0.05, 0, "square", 0.045); tone(1320, 0.06, 0.035, "square", 0.04); };

  // Lemonade going into a cup.
  const pour = () => noise(0.22, 900, 0.08);

  // The till closing at the end of the day.
  const till = () => { tone(420, 0.09, 0, "triangle", 0.07); tone(280, 0.16, 0.07, "triangle", 0.06); };

  // Interest landing overnight — the sound the game most wants a child to like.
  const ding = () => { [784, 988, 1319].forEach((f, i) => tone(f, 0.18, i * 0.075, "sine", 0.08)); };

  // Money going the other way.
  const owe = () => { tone(330, 0.16, 0, "sawtooth", 0.055); tone(220, 0.22, 0.1, "sawtooth", 0.05); };

  const treat = () => { [660, 880, 1100].forEach((f, i) => tone(f, 0.12, i * 0.06, "triangle", 0.07)); };
  const bin = () => noise(0.3, 420, 0.1);
  const morning = () => { tone(523, 0.14, 0, "sine", 0.06); tone(784, 0.18, 0.1, "sine", 0.06); };

  // A rung on the goal ladder.
  const goal = () => { [659, 880, 1047, 1319].forEach((f, i) => tone(f, 0.2, i * 0.085, "sine", 0.085)); };

  // The bike.
  const win = () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.24, i * 0.13, "sine", 0.09));
  };

  return { setMuted, isMuted, tap, pick, buy, coin, pour, till, ding, owe, treat, bin,
           morning, goal, win };
})();
