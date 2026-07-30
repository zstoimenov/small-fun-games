/* Mastermind — all the noises, made on the fly.                                */
/*                                                                              */
/* WebAudio only: nothing extra to download and nothing to cache. Three          */
/* primitives (a tone, a slide, a knock) and every sound in the game is a couple */
/* of lines over the top of them.                                                */
"use strict";
window.MM = window.MM || {};

MM.Audio = (function () {
  let ctx = null;
  let muted = false;

  // Built on first use rather than at load: mobile browsers refuse to start an
  // audio context before the user has touched something.
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

  function tone(freq, dur, delay, type, vol) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol || 0.06, t);
    // exponentialRamp can't reach zero, so it lands just above it instead.
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function slide(from, to, dur, type, vol) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    gain.gain.setValueAtTime(vol || 0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function knock(vol, delay) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const len = Math.floor(ac.sampleRate * 0.05);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1100;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t);
  }

  const tap = () => tone(520, 0.06, 0, "square", 0.05);
  const nope = () => tone(150, 0.16, 0, "sawtooth", 0.05);
  // Dropping a peg into a slot: a short click that rises with the slot, so a
  // filling row sounds like it's getting somewhere.
  const place = (slot) => { knock(0.16); tone(420 + slot * 60, 0.07, 0, "triangle", 0.06); };
  const clear = () => tone(300, 0.09, 0, "triangle", 0.045);
  const check = () => slide(400, 620, 0.14, "triangle", 0.05);

  // The pegs coming back. Blacks are a rising run, whites a soft tick after
  // them — so you can hear how well you did before you've finished reading it.
  const marks = (black, white) => {
    for (let i = 0; i < black; i++) tone(600 + i * 130, 0.11, i * 0.09, "sine", 0.07);
    for (let i = 0; i < white; i++) tone(340, 0.07, black * 0.09 + i * 0.07, "sine", 0.04);
    if (!black && !white) tone(190, 0.16, 0, "sine", 0.05);
  };

  const turn = () => { tone(440, 0.08, 0, "sine", 0.05); tone(587, 0.1, 0.06, "sine", 0.05); };
  const hint = () => { [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, i * 0.05, "sine", 0.05)); };
  const undo = () => { tone(500, 0.09, 0, "triangle", 0.05); tone(340, 0.11, 0.06, "triangle", 0.05); };
  const win = () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.24, i * 0.13, "sine", 0.09)); };
  const lose = () => { [392, 349, 294, 233].forEach((f, i) => tone(f, 0.26, i * 0.14, "triangle", 0.06)); };

  return { setMuted, tap, nope, place, clear, check, marks, turn, hint, undo, win, lose };
})();
