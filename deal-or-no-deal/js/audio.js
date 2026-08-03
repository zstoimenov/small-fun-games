/* Deal or No Deal — all the noises, made on the fly.                           */
/*                                                                              */
/* WebAudio only: nothing extra to download and nothing to cache. Three          */
/* primitives (a tone, a slide and a knock) and every sound in the game is a     */
/* couple of lines over the top of them.                                        */
"use strict";
window.DND = window.DND || {};

DND.Audio = (function () {
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

  function slide(from, to, dur, delay, type, vol) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(vol || 0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // A short burst of noise through a band-pass — the lid coming off.
  function knock(delay, vol) {
    const ac = ready();
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const len = Math.floor(ac.sampleRate * 0.08);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    const gain = ac.createGain();
    gain.gain.value = vol || 0.14;
    src.connect(bp).connect(gain).connect(ac.destination);
    src.start(t);
  }

  const tap = () => tone(560, 0.05, 0, "square", 0.035);
  const aim = () => tone(760, 0.07, 0, "triangle", 0.045);

  // The wait before a box opens. A note that climbs for exactly as long as the
  // hold lasts, so it runs out at the moment the lid comes off — which is why
  // it takes the duration rather than owning one: the hold changes with the
  // pace setting, and a drum roll that finishes early is worse than none.
  function lift(seconds) {
    const dur = Math.max(0.12, Math.min(3, seconds || 0.9));
    slide(220, 660, dur, 0, "triangle", 0.04);
    // A quickening tick under it, so the wait has a pulse and not just a tone.
    const ticks = Math.min(9, Math.max(2, Math.round(dur * 6)));
    for (let i = 0; i < ticks; i++) {
      // Spaced by the square of the progress, so they crowd together at the end.
      tone(430, 0.04, dur * Math.pow(i / ticks, 1.7), "square", 0.03);
    }
  }

  // Small money is a shrug; big money is a groan. The board decides which is
  // which (Ui.bigMoney), so a 10-box game gets its own idea of a gasp.
  function small() {
    knock(0, 0.12);
    tone(620, 0.12, 0.03, "triangle", 0.05);
    tone(820, 0.1, 0.1, "triangle", 0.04);
  }
  function big() {
    knock(0, 0.16);
    slide(420, 150, 0.55, 0.04, "sawtooth", 0.07);
    tone(190, 0.4, 0.06, "sine", 0.05);
  }

  // The phone. Two short double-rings, which is enough to be recognisable
  // without becoming the most annoying sound in the collection.
  function phone() {
    for (const d of [0, 0.42]) {
      for (const k of [0, 0.13]) {
        tone(1050, 0.1, d + k, "square", 0.045);
        tone(790, 0.1, d + k, "square", 0.035);
      }
    }
  }

  function deal() {
    for (let i = 0; i < 4; i++) tone(523 * Math.pow(1.26, i), 0.18, i * 0.09, "triangle", 0.06);
  }
  function noDeal() {
    slide(300, 520, 0.22, 0, "sawtooth", 0.055);
  }
  const turn = () => { tone(500, 0.1, 0, "sine", 0.05); tone(700, 0.12, 0.09, "sine", 0.05); };

  function win() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => tone(f, 0.4, i * 0.12, "triangle", 0.07));
  }
  function lose() {
    slide(400, 130, 0.7, 0, "sawtooth", 0.06);
  }

  return { setMuted, tap, aim, lift, small, big, phone, deal, noDeal, turn, win, lose };
})();
