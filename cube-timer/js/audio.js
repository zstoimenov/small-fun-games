/* Cube Timer — the beeps, synthesised.                                          */
/*                                                                              */
/* No audio files, so there is nothing extra to download and nothing to cache.   */
/* The AudioContext is only built on the first tap, because mobile browsers      */
/* refuse to start one before the user has touched the page.                     */
/*                                                                              */
/* Everything here is short. A sound that outlasts the moment it marks is a      */
/* sound you turn off, and the inspection calls in particular have to land       */
/* inside the second they belong to.                                            */
"use strict";
window.CT = window.CT || {};

CT.Audio = (function () {
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

  function tone(freq, dur, delay, type, vol) {
    const c = ready();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.12));
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + (dur || 0.12) + 0.02);
  }

  return {
    setMuted,
    // Fingers down: barely there, so it doesn't nag when a kid rests a hand.
    hold: () => tone(320, 0.05, 0, "sine", 0.03),
    // Green light. One note up, so you can hear it without looking.
    ready: () => tone(660, 0.09, 0, "triangle", 0.07),
    // The clock has stopped. A flat knock, not a fanfare — the time is the news.
    stop: () => { tone(520, 0.07, 0, "square", 0.05); tone(390, 0.1, 0.05, "sine", 0.05); },
    // Inspection: two pips at eight seconds, three at twelve. Same as a comp.
    pip: (n) => { for (let i = 0; i < n; i++) tone(880, 0.06, i * 0.12, "square", 0.06); },
    // Out of time.
    buzz: () => { tone(180, 0.18, 0, "sawtooth", 0.07); tone(140, 0.22, 0.14, "sawtooth", 0.06); },
    // A personal best deserves the only real tune in the app.
    best: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, i * 0.09, "triangle", 0.075));
    },
    // Somebody won a round; somebody won the race.
    point: () => { tone(587, 0.1, 0, "triangle", 0.06); tone(880, 0.14, 0.09, "triangle", 0.06); },
    win: () => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, i * 0.11, "triangle", 0.08));
    },
    // A penalty, or throwing a solve away.
    tap: () => tone(300, 0.06, 0, "sine", 0.05)
  };
})();
