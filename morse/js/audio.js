/* Morse Agent - the beeps, made on the fly with WebAudio (nothing to download). */
/*                                                                              */
/* One oscillator runs the whole time at zero volume, and the gain is opened    */
/* and closed to make each beep. Starting a fresh oscillator per beep costs a   */
/* few ms of lag on a tablet, which is the difference between a dit and a dah   */
/* when you are the one pressing the key.                                       */
/*                                                                              */
/* Every edge is a 5 ms ramp, not a hard switch: a square edge on a sine wave   */
/* is a click, and at 12 wpm a click on every dit is most of what you hear.     */
"use strict";
window.MO = window.MO || {};

MO.Audio = (function () {
  const PITCH = 600;
  const VOL = 0.35;
  const EDGE = 0.005;
  let ctx = null;
  let gain = null;
  let muted = false;
  let timers = [];
  let endTimer = 0;
  let endResolve = null;

  // Built on the first touch: mobile browsers refuse to start audio before one.
  function ready() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = PITCH;
      gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // The key's own beep: on while held, off when let go.
  function toneOn() {
    if (muted || !ready()) return;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(VOL, t + EDGE);
  }
  function toneOff() {
    if (!ctx) return;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + EDGE);
  }

  // Play a list of { at, dur } segments (ms). `lamp(on)` is called in step with
  // each beep, and still is when the sound is off - the lamp is how a muted
  // tablet plays. Resolves when the last beep ends, or at once if stopped.
  function play(segs, total, lamp) {
    stop();
    const ac = muted ? null : ready();
    const lead = 0.08;                 // a moment of silence so the first dit is not clipped
    if (ac) {
      const t0 = ac.currentTime + lead;
      const g = gain.gain;
      g.cancelScheduledValues(ac.currentTime);
      g.setValueAtTime(0, ac.currentTime);
      segs.forEach((s) => {
        const a = t0 + s.at / 1000;
        const b = a + s.dur / 1000;
        g.setValueAtTime(0, a);
        g.linearRampToValueAtTime(VOL, a + EDGE);
        g.setValueAtTime(VOL, b - EDGE);
        g.linearRampToValueAtTime(0, b);
      });
    }
    segs.forEach((s) => {
      timers.push(setTimeout(() => lamp && lamp(true), lead * 1000 + s.at));
      timers.push(setTimeout(() => lamp && lamp(false), lead * 1000 + s.at + s.dur));
    });
    return new Promise((res) => {
      endResolve = res;
      endTimer = setTimeout(() => { endResolve = null; res(true); }, lead * 1000 + total + 60);
    });
  }

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    clearTimeout(endTimer);
    if (endResolve) { const r = endResolve; endResolve = null; r(false); }
    if (ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
    }
  }

  // Little jingles, on their own oscillators so they never fight the key tone.
  function notes(list, type) {
    if (muted || !ready()) return;
    let t = ctx.currentTime + 0.02;
    list.forEach(([f, d]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + d + 0.02);
      t += d * 0.8;
    });
  }

  return {
    ready,
    setMuted(v) { muted = !!v; if (muted) toneOff(); },
    isMuted() { return muted; },
    toneOn, toneOff, play, stop,
    right() { notes([[880, 0.1], [1320, 0.16]]); },
    wrong() { notes([[220, 0.22]], "square"); },
    unlock() { notes([[660, 0.12], [880, 0.12], [1100, 0.12], [1320, 0.3]]); }
  };
})();
