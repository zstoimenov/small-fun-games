'use strict';
// Every sound is synthesised, so the game ships with no audio files.

let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  return AC;
}
function tone(freq, dur, type, vol, slideTo) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}
function roar(big) {
  const a = ac(); if (!a) return;
  const len = a.sampleRate * 1.6, buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = big ? 900 : 500;
  const g = a.createGain();
  g.gain.setValueAtTime(0.001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(big ? 0.45 : 0.15, a.currentTime + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 1.6);
  src.connect(f); f.connect(g); g.connect(a.destination); src.start();
}
const sndKick = () => tone(110, 0.12, 'sine', 0.5, 45);
const sndLock = () => tone(660, 0.08, 'square', 0.12);
