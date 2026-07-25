/* Footy Tactics Lab — every sound is synthesised, so the game ships no audio files */
"use strict";
window.FTL = window.FTL || {};

FTL.Audio = (function () {

  let ctx = null;
  let muted = false;

  function beep(freq, dur, delay, type, vol) {
    if (muted) return;
    dur = dur === undefined ? 0.12 : dur;
    delay = delay || 0;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol === undefined ? 0.08 : vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch (e) { /* no audio on this device — the game plays fine silently */ }
  }

  // A referee's whistle: a fast warble rather than a plain tone.
  function whistle() {
    if (muted) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 2100;
      lfo.type = "sine";
      lfo.frequency.value = 26;
      lfoGain.gain.value = 130;
      lfo.connect(lfoGain).connect(osc.frequency);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain).connect(ctx.destination);
      lfo.start(t); osc.start(t);
      lfo.stop(t + 0.6); osc.stop(t + 0.6);
    } catch (e) {}
  }

  return {
    beep: beep,
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; },

    tap:      function () { beep(520, 0.06, 0, "square", 0.07); },
    remove:   function () { beep(300, 0.07, 0, "square", 0.06); },
    step:     function () { beep(440, 0.05, 0, "triangle", 0.06); },
    turn:     function () { beep(620, 0.05, 0, "sine", 0.06); beep(760, 0.05, 0.05, "sine", 0.05); },
    handball: function () { beep(300, 0.05, 0, "square", 0.07); beep(880, 0.09, 0.06, "sine", 0.07); },
    kick:     function () { beep(180, 0.09, 0, "sawtooth", 0.09); },
    goal:     function () { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.16, i * 0.1, "triangle", 0.1)); },
    unlock:   function () { [659, 784, 988].forEach((f, i) => beep(f, 0.14, i * 0.09, "sine", 0.09)); },
    denied:   function () { beep(200, 0.12, 0, "sawtooth", 0.07); },
    whistle:  whistle
  };
})();
