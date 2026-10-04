/* Enigma - the clicks, made on the fly with WebAudio (nothing to download).     */
/*                                                                              */
/* Two sounds only: a key going down (a dry clack) and a rotor turning (a small  */
/* ratchet). Both are a burst of noise through a filter, because a plain beep    */
/* sounds like a phone and the real machine sounds like typewriter parts.        */
"use strict";
window.EN = window.EN || {};

EN.Audio = (function () {
  let ctx = null;
  let muted = false;
  let noise = null;

  // Built on first use: mobile browsers refuse to start audio before a touch.
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

  function noiseBuffer(ac) {
    if (noise) return noise;
    noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.1), ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  }

  function knock(freq, dur, vol, delay) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 1.4;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // A plain sine note, for the mission sounds: the knocks are the machine,
  // these are the game talking.
  function tone(freq, dur, vol, delay) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
    key() { knock(900, 0.07, 0.5); knock(200, 0.05, 0.4); },
    rotor() { knock(2200, 0.03, 0.25); knock(1500, 0.03, 0.2, 0.04); },
    // A little rising run for "Random secret start".
    random() { [0, 1, 2].forEach((i) => knock(1200 + i * 300, 0.04, 0.25, i * 0.06)); },
    oops() { tone(220, 0.18, 0.2); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 0.18, i * 0.12)); }
  };
})();
