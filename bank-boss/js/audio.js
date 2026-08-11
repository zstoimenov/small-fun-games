/* Bank Boss — every sound in the game, synthesised.                            */
/*                                                                              */
/* No audio files, so nothing extra to download and nothing to cache. Two        */
/* primitives — a shaped tone and a burst of filtered noise — and every named    */
/* sound is a couple of lines composed from them. The AudioContext is created on */
/* the first tap because mobile browsers refuse to start one before the user has */
/* touched the page.                                                             */
"use strict";
window.BB = window.BB || {};

BB.Audio = (function () {
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

  const setMuted = (v) => { muted = !!v; };
  const isMuted = () => muted;

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

  const tap = () => tone(520, 0.06, 0, "square", 0.05);
  const pick = () => tone(700, 0.07, 0, "square", 0.06);

  // Somebody at the counter.
  const step = () => tone(300, 0.07, 0, "triangle", 0.05);

  // Coins going into the vault.
  const take = () => { tone(880, 0.05, 0, "square", 0.05); tone(1320, 0.07, 0.04, "square", 0.045); };

  // Coins going out of the door.
  const lend = () => { tone(660, 0.07, 0, "triangle", 0.06); tone(440, 0.11, 0.06, "triangle", 0.055); };

  // A loan coming back with more than it left with — the sound the game most
  // wants a child to like.
  const back = () => { [784, 988, 1319].forEach((f, i) => tone(f, 0.18, i * 0.075, "sine", 0.08)); };

  // Money that is not coming back.
  const bad = () => { tone(300, 0.2, 0, "sawtooth", 0.06); tone(180, 0.28, 0.12, "sawtooth", 0.055); };

  // Calling your loans in early. The worst noise in the game, on purpose.
  const fire = () => { noise(0.45, 300, 0.16); tone(160, 0.4, 0.05, "sawtooth", 0.07); };

  const vault = () => { tone(220, 0.16, 0, "triangle", 0.07); tone(150, 0.22, 0.1, "triangle", 0.06); };
  const morning = () => { tone(523, 0.14, 0, "sine", 0.06); tone(784, 0.18, 0.1, "sine", 0.06); };
  const no = () => tone(240, 0.12, 0, "square", 0.05);
  const goal = () => { [659, 880, 1047, 1319].forEach((f, i) => tone(f, 0.2, i * 0.085, "sine", 0.085)); };
  const win = () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.24, i * 0.13, "sine", 0.09));
  };

  return { setMuted, isMuted, tap, pick, step, take, lend, back, bad, fire, vault,
           morning, no, goal, win };
})();
