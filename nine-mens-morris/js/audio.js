/* Nine Men's Morris — every sound in the game, synthesised.                     */
/*                                                                              */
/* Connect Four's audio file, retuned for a board game played with counters      */
/* rather than one where things fall: putting a piece down is a wooden click,     */
/* sliding one is a short scrape, a mill is a bright three-note run (one note per */
/* piece in the line), and losing a piece is a low thud.                         */
/*                                                                              */
/* No audio files, so there is nothing extra to download and nothing to cache.   */
/* The AudioContext is only created on the first tap, because mobile browsers     */
/* won't start one before the user has touched the page.                          */
"use strict";
window.NMM = window.NMM || {};

NMM.Audio = (function () {
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

  function slideTone(from, to, dur, type, vol) {
    const c = ready();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Filtered noise. A high cutoff is a counter clicking onto wood; a low one is
  // the duller thud of one being lifted off.
  function knock(vol, cutoff, dur) {
    const c = ready();
    if (!c) return;
    const len = dur || 0.09;
    const frames = Math.floor(c.sampleRate * len);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const fade = 1 - i / frames;
      data[i] = (Math.random() * 2 - 1) * fade * fade;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff || 1400;
    const gain = c.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  /* ── Named sounds ──────────────────────────────────────────────────────── */

  const tap = () => tone(520, 0.06, 0, "square", 0.05);
  const nope = () => tone(150, 0.16, 0, "sawtooth", 0.05);

  const place = () => { knock(0.2, 1600); tone(330, 0.07, 0, "sine", 0.06); };
  const lift = () => tone(700, 0.05, 0, "sine", 0.035);
  const slide = () => { slideTone(300, 420, 0.22, "triangle", 0.04); knock(0.08, 700, 0.06); };

  // One note per piece in the line, so a mill sounds like three of something.
  const mill = () => { [659, 831, 988].forEach((f, i) => tone(f, 0.18, i * 0.07, "sine", 0.07)); };
  const taken = () => { knock(0.24, 420, 0.14); tone(160, 0.18, 0, "triangle", 0.07); };

  const turn = () => { tone(440, 0.08, 0, "sine", 0.05); tone(587, 0.1, 0.06, "sine", 0.05); };
  const hint = () => { [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, i * 0.05, "sine", 0.05)); };
  const undo = () => { tone(500, 0.09, 0, "triangle", 0.05); tone(340, 0.11, 0.06, "triangle", 0.05); };

  const win = () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.24, i * 0.13, "sine", 0.09));
  };
  const lose = () => { [392, 349, 294, 233].forEach((f, i) => tone(f, 0.26, i * 0.14, "triangle", 0.06)); };
  const draw = () => { [440, 440].forEach((f, i) => tone(f, 0.2, i * 0.18, "sine", 0.06)); };

  return { setMuted, tap, nope, place, lift, slide, mill, taken, turn, hint, undo, win, lose, draw };
})();
