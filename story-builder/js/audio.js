/* Story Builder - sound effects, made on the fly with WebAudio, and the     */
/* tablet's own voice for reading stories aloud.                             */
"use strict";
window.SB = window.SB || {};

SB.Audio = (function () {
  let ctx = null, muted = false;

  // Built on the first touch: mobile browsers refuse to start audio before one.
  function ready() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function notes(list, type, vol) {
    if (muted || !ready()) return;
    let t = ctx.currentTime + 0.02;
    list.forEach(([f, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + d + 0.02);
      t += d * 0.8;
    });
  }
  // Reading aloud uses the voice built into the tablet (speechSynthesis), so
  // there's nothing to download. An Australian or British English voice is
  // picked when there is one; a little slower than normal suits a new reader.
  const canSpeak = () => "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
  function voice() {
    const vs = canSpeak() ? speechSynthesis.getVoices() : [];
    return vs.find((v) => /en-AU/i.test(v.lang)) || vs.find((v) => /en-GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  }
  function speak(text, onEnd) {
    if (!canSpeak() || !text) { if (onEnd) onEnd(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-AU";
    u.rate = 0.9;
    u.onend = u.onerror = () => { if (onEnd) onEnd(); };
    speechSynthesis.speak(u);
  }
  const hush = () => { if (canSpeak()) speechSynthesis.cancel(); };

  return {
    ready, speak, hush, canSpeak,
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
    click() { notes([[660, 0.05]], "sine", 0.12); },
    right() { notes([[880, 0.1], [1320, 0.16]]); },
    wrong() { notes([[220, 0.22]], "square", 0.1); },
    win() { notes([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.32]]); },
    star(i) { notes([[784 + i * 196, 0.18]], "sine", 0.2); }
  };
})();
