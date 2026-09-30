/* Music Studio - every sound made on the fly with WebAudio, and the player    */
/* that steps through a song on the audio clock.                               */
/*                                                                             */
/* Nothing to download, so the studio works offline and stays tiny. Sounds are */
/* scheduled a little ahead on the audio clock (not with setTimeout), because  */
/* a timer that drifts by 30 ms is enough to make a beat sound drunk.          */
"use strict";
window.MS = window.MS || {};

MS.Audio = (function () {
  let ctx = null, noise = null, out = null, muted = false;

  // Built on the first touch: mobile browsers refuse to start audio before one.
  function ready() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // One gentle compressor on the way out, so a full grid doesn't clip.
      out = ctx.createDynamicsCompressor();
      out.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  // The clock everything is timed against. Without WebAudio the playhead
  // still moves, on the page clock.
  const now = () => (ctx ? ctx.currentTime : performance.now() / 1000);
  // How long after scheduling a sound actually leaves the speaker. Taps are
  // made to what is heard, so the tap check takes this off.
  const latency = () => (ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0);

  function env(t, vol, attack, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    g.connect(out);
    return g;
  }
  function burst(t, dur, type, freq, vol, q) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q) f.Q.value = q;
    src.connect(f).connect(env(t, vol, 0.002, dur));
    src.start(t);
    src.stop(t + dur + 0.05);
  }
  function tone(t, freq, type, vol, attack, decay) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(env(t, vol, attack, decay));
    o.start(t);
    o.stop(t + attack + decay + 0.05);
    return o;
  }

  // ── Drums ──────────────────────────────────────────────────────────────────
  const DRUMS = {
    // A sine that drops fast in pitch: the boom of a bass drum.
    kick(t) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      o.connect(env(t, 0.9, 0.003, 0.32));
      o.start(t);
      o.stop(t + 0.4);
    },
    snare(t) { burst(t, 0.16, "highpass", 1500, 0.5); tone(t, 190, "triangle", 0.3, 0.002, 0.08); },
    hat(t) { burst(t, 0.05, "highpass", 7000, 0.28); },
    // Three quick slaps close together sound like hands clapping.
    clap(t) { [0, 0.012, 0.024].forEach((d, i) => burst(t + d, i === 2 ? 0.14 : 0.02, "bandpass", 1300, 0.55, 1.5)); }
  };

  // ── Notes ──────────────────────────────────────────────────────────────────
  // Five-note scales: every mix of notes sounds nice, which is the point for
  // a beginner. Happy is C major pentatonic, sad is C minor pentatonic.
  const SCALES = {
    happy: { do: 261.63, re: 293.66, mi: 329.63, so: 392.0, la: 440.0, hi: 523.25 },
    sad: { do: 261.63, re: 311.13, mi: 349.23, so: 392.0, la: 466.16, hi: 523.25 }
  };
  const INSTRUMENTS = {
    keys(t, f) { tone(t, f, "triangle", 0.34, 0.005, 0.55); tone(t, f * 2, "sine", 0.06, 0.005, 0.3); },
    // A bell rings on: a pure tone plus a quieter, faster-fading overtone.
    bells(t, f) { tone(t, f * 2, "sine", 0.26, 0.002, 1.1); tone(t, f * 5.4, "sine", 0.05, 0.002, 0.25); },
    synth(t, f) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
      o.connect(lp).connect(env(t, 0.2, 0.005, 0.35));
      o.start(t);
      o.stop(t + 0.45);
    }
  };

  // One sound, by grid row id, at audio time t.
  function hit(id, t, mood, inst) {
    if (muted || !ready()) return;
    t = Math.max(t || 0, ctx.currentTime);
    if (DRUMS[id]) DRUMS[id](t);
    else (INSTRUMENTS[inst] || INSTRUMENTS.keys)(t, SCALES[mood === "sad" ? "sad" : "happy"][id]);
  }

  function notes(list, type, vol) {
    if (muted || !ready()) return;
    let t = ctx.currentTime + 0.02;
    list.forEach(([f, d]) => { tone(t, f, type || "triangle", vol || 0.22, 0.01, d); t += d * 0.8; });
  }

  return {
    ready, now, latency, hit,
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
    click() { notes([[660, 0.05]], "sine", 0.12); },
    right() { notes([[880, 0.1], [1320, 0.16]]); },
    wrong() { notes([[220, 0.22]], "square", 0.1); },
    win() { notes([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.32]]); },
    star(i) { notes([[784 + i * 196, 0.18]], "sine", 0.2); }
  };
})();

// ── The player ───────────────────────────────────────────────────────────────
// play(song, { loop, onStep, onHit, onEnd }): loop is true (forever) or a
// number of times through. onStep(step) fires as each step is heard, for the
// playhead; onHit(id, time) fires as each sound is scheduled, for the tap game.
MS.Player = (function () {
  const A = MS.Audio;
  let timer = 0, cur = null;
  const timeouts = new Set();

  function later(fn, t) {
    const id = setTimeout(() => { timeouts.delete(id); fn(); }, Math.max(0, (t - A.now()) * 1000));
    timeouts.add(id);
  }

  function pump() {
    if (!cur) return;
    const { song, o } = cur;
    const len = song.len || 8;
    const dur = 60 / song.bpm / 2;            // a step is half a beat
    while (cur && cur.next < A.now() + 0.12) {
      const t = cur.next, s = cur.step;
      Object.keys(song.cells).forEach((id) => {
        if (song.cells[id][s]) { A.hit(id, t, song.mood, song.inst); if (o.onHit) o.onHit(id, t); }
      });
      if (o.onStep) later(() => { if (cur && cur.o === o) o.onStep(s); }, t);
      cur.next += dur;
      cur.step++;
      if (cur.step >= len) {
        cur.step = 0;
        cur.round++;
        if (o.loop !== true && cur.round >= (o.loop || 1)) {
          const end = cur.next;
          clearInterval(timer);
          cur = null;
          later(() => { if (o.onStep) o.onStep(-1); if (o.onEnd) o.onEnd(); }, end);
        }
      }
    }
  }

  function play(song, o) {
    stop();
    A.ready();
    cur = { song, o: o || {}, step: 0, round: 0, next: A.now() + 0.08 };
    timer = setInterval(pump, 25);
    pump();
  }
  function stop() {
    const was = cur;
    clearInterval(timer);
    cur = null;
    timeouts.forEach(clearTimeout);
    timeouts.clear();
    if (was && was.o.onStep) was.o.onStep(-1);
  }
  // Tempo and notes can change while a song plays; the next step picks it up.
  function swap(song) { if (cur) cur.song = song; }

  return { play, stop, swap, playing: () => !!cur };
})();
