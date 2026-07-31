/* Battleship — all the noises, made on the fly.                                */
/*                                                                              */
/* WebAudio only: nothing extra to download and nothing to cache. Four           */
/* primitives (a tone, a slide, a knock and a hiss) and every sound in the game  */
/* is a couple of lines over the top of them.                                    */
"use strict";
window.BS = window.BS || {};

BS.Audio = (function () {
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

  function slide(from, to, dur, type, vol, delay) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
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

  // Filtered noise, which is what both a splash and an explosion actually are.
  // `cut` is where the lowpass sits: high for water, low for a hit.
  function hiss(dur, cut, vol, delay, rise) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cut, t);
    if (rise) filter.frequency.exponentialRampToValueAtTime(Math.max(60, rise), t + dur);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t);
  }

  const tap = () => tone(520, 0.06, 0, "square", 0.05);
  const nope = () => tone(150, 0.16, 0, "sawtooth", 0.05);
  const place = () => { hiss(0.06, 900, 0.14); tone(300, 0.08, 0, "triangle", 0.05); };
  const rotate = () => { tone(420, 0.06, 0, "triangle", 0.05); tone(560, 0.07, 0.05, "triangle", 0.05); };
  const clear = () => slide(420, 200, 0.16, "triangle", 0.05);

  // The shell going up, then whatever it lands in.
  const shoot = () => slide(260, 900, 0.22, "sawtooth", 0.035);
  const splash = () => { hiss(0.34, 2600, 0.16, 0, 500); tone(230, 0.12, 0.02, "sine", 0.04); };
  const boom = () => {
    hiss(0.42, 900, 0.3, 0, 90);
    tone(90, 0.3, 0, "square", 0.09);
    tone(160, 0.16, 0.02, "triangle", 0.05);
  };
  // A ship going down: the bang, then a long groan under it.
  const sink = () => {
    boom();
    slide(300, 70, 1.1, "sawtooth", 0.07, 0.12);
    [392, 330, 262].forEach((f, i) => tone(f, 0.3, 0.35 + i * 0.16, "triangle", 0.05));
  };

  const turn = () => { tone(440, 0.08, 0, "sine", 0.05); tone(587, 0.1, 0.06, "sine", 0.05); };
  const hint = () => { [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, i * 0.05, "sine", 0.05)); };
  const undo = () => { tone(500, 0.09, 0, "triangle", 0.05); tone(340, 0.11, 0.06, "triangle", 0.05); };
  const win = () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.24, i * 0.13, "sine", 0.09)); };
  const lose = () => { [392, 349, 294, 233].forEach((f, i) => tone(f, 0.26, i * 0.14, "triangle", 0.06)); };

  return {
    setMuted, tap, nope, place, rotate, clear,
    shoot, splash, boom, sink, turn, hint, undo, win, lose
  };
})();
