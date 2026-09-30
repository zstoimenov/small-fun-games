/* Music Studio - runs one level: its rounds, one after another, in #stage.    */
/*                                                                             */
/* start(level, onDone(mistakes)). A mistake is a wrong answer, a Check that   */
/* isn't right yet, or a few taps off the beat; app.js turns them into stars. */
"use strict";
window.MS = window.MS || {};

MS.Lesson = (function () {
  const $ = (id) => document.getElementById(id);
  const A = MS.Audio, P = MS.Player;
  const rowOf = (id) => MS.ROWS.find((r) => r.id === id);
  let lv = null, ri = 0, mistakes = 0, done = null, prev = null, box = null, cleanup = null;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function button(cls, html, fn) { const b = el("button", cls, html); b.type = "button"; b.addEventListener("click", fn); return b; }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function start(level, onDone) {
    stop();
    lv = level; ri = 0; mistakes = 0; done = onDone; prev = null;
    box = $("stage");
    round();
  }
  function stop() {
    P.stop();
    if (cleanup) cleanup();
    cleanup = null;
    lv = null;
  }
  function round() {
    const r = lv.rounds[ri];
    $("roundCount").textContent = lv.rounds.length > 1 ? "Round " + (ri + 1) + " of " + lv.rounds.length : "";
    box.innerHTML = "";
    if (cleanup) cleanup();
    cleanup = null;
    ({ tap, choose, build })[r.kind](r);
  }
  function nextButton(label) {
    const last = ri === lv.rounds.length - 1;
    return button("btn go wide", label || (last ? "Finish ✓" : "Next ›"), () => {
      P.stop();
      if (!lv) return;
      if (++ri < lv.rounds.length) round();
      else { const m = mistakes, d = done; stop(); d(m); }
    });
  }
  // Listening rounds need sound. Say so, rather than let a muted tablet look
  // like a broken game.
  function soundHint() {
    return el("p", "hint sound", A.isMuted() ? "🔇 Sound is off. Tap 🔇 at the top to hear this one." : "🔊 Turn your sound on for this one.");
  }

  // ── Tap along ──────────────────────────────────────────────────────────────
  function tap(r) {
    const beats = [], used = new Set();
    let good = 0, off = 0, over = false;
    const count = el("p", "tap-count", "");
    const pad = el("button", "pad", '<span aria-hidden="true">🥁</span><b>Tap!</b>');
    pad.type = "button";
    const say = el("p", "say", "Listen for the boom... then tap along!");
    const paint = () => { count.innerHTML = "★".repeat(good) + '<span class="dim">' + "★".repeat(Math.max(0, r.need - good)) + "</span>"; };
    box.append(soundHint(), count, pad, say);
    paint();

    const hit = () => {
      if (over) return;
      A.ready();
      const t = A.now() - A.latency();
      let best = -1, d = 1e9;
      beats.forEach((b, i) => { const x = Math.abs(t - b); if (x < d) { d = x; best = i; } });
      // A fifth of a second either way: generous, because tablets add their
      // own delay to both the sound and the touch.
      const ok = best >= 0 && d < 0.2 && !used.has(best);
      pad.classList.remove("good", "off"); void pad.offsetWidth;
      pad.classList.add(ok ? "good" : "off");
      if (ok) { used.add(best); good++; say.textContent = ["Yes!", "Right on the beat!", "Nice!", "Keep going!"][good % 4]; }
      else { off++; say.textContent = "Wait for the boom..."; }
      paint();
      if (good >= r.need) {
        over = true;
        P.stop();
        mistakes += Math.floor(off / 3);
        say.textContent = off < 3 ? "Perfect drummer! 🥁" : "You kept the beat!";
        A.right();
        const tail = el("div", "tail");
        tail.appendChild(nextButton());
        box.appendChild(tail);
      }
    };
    pad.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(); });
    pad.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); hit(); } });
    P.play(MS.make({ bpm: r.bpm, kick: "x.x.x.x." }), {
      loop: true,
      onHit: (id, t) => beats.push(t),
      onStep: (s) => { if (s >= 0 && s % 2 === 0) { pad.classList.remove("pulse"); void pad.offsetWidth; pad.classList.add("pulse"); } }
    });
  }

  // ── Listen and choose ──────────────────────────────────────────────────────
  function seqSong(seq, bpm) {
    const spec = { bpm: bpm || 120, len: seq.length };
    seq.forEach((id, i) => { spec[id] = (spec[id] || ".".repeat(seq.length)).slice(0, i) + "x" + ".".repeat(seq.length - i - 1); });
    return MS.make(spec);
  }
  function optionsFor(r) {
    if (r.options) return r.options;
    const ids = [...new Set(r.seq.concat(r.answer))];
    const spare = (rowOf(r.answer).note ? ["so", "mi", "la"] : ["hat", "snare", "clap", "kick"]).filter((x) => !ids.includes(x));
    while (ids.length < 3 && spare.length) ids.push(spare.shift());
    return shuffle(ids.map((id) => ({ e: rowOf(id).emoji, t: rowOf(id).long || rowOf(id).name, ok: id === r.answer, id })));
  }
  function choose(r) {
    const q = el("h2", "q", r.q);
    const chips = r.seq ? el("div", "seq") : null;
    if (chips) {
      r.seq.concat("?").forEach((id) => chips.appendChild(el("span", "tok" + (id === "?" ? " ask" : ""),
        id === "?" ? "?" : r.hide ? "🎵" : rowOf(id).emoji)));
    }
    const song = r.clip ? MS.make(r.clip) : seqSong(r.seq, r.bpm);
    const listen = () => P.play(song, {
      loop: r.times || 1,
      onStep: (s) => { if (chips) chips.querySelectorAll(".tok").forEach((c, i) => c.classList.toggle("lit", i === s)); }
    });
    const again = button("btn ghost", "▶ Listen again", listen);
    const options = optionsFor(r);
    const opts = el("div", "options" + (options.length > 3 ? " four" : ""));
    const why = el("p", "why", "");
    const tail = el("div", "tail");
    options.forEach((o) => {
      const b = button("option", `<span aria-hidden="true">${o.e}</span><b>${o.t}</b>`, () => {
        if (o.id) A.hit(o.id, 0, "happy", "keys");
        if (!o.ok) {
          mistakes++;
          A.wrong();
          b.classList.add("wrong");
          b.disabled = true;
          why.className = "why bad";
          why.textContent = "Not that one. Listen again and have another go!";
          return;
        }
        A.right();
        b.classList.add("right");
        opts.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        if (chips) chips.lastChild.textContent = rowOf(o.id) ? rowOf(o.id).emoji : o.e;
        why.className = "why good";
        why.textContent = "Yes! " + (r.why || "");
        tail.appendChild(nextButton());
      });
      opts.appendChild(b);
    });
    box.append(soundHint(), q);
    if (chips) box.appendChild(chips);
    box.append(again, opts, why, tail);
    setTimeout(() => { if (lv && box.contains(again)) listen(); }, 350);
  }

  // ── Build it on the grid ───────────────────────────────────────────────────
  function passes(rule, song) {
    if (rule.bpmMax != null) return song.bpm <= rule.bpmMax;
    if (rule.bpmMin != null) return song.bpm >= rule.bpmMin;
    if (rule.mood) return song.mood === rule.mood;
    if (rule.notes) return MS.count(song, MS.NOTE_ROWS) >= rule.notes;
    if (rule.on) return rule.on.every((s) => song.cells[rule.row][s]);
    return MS.count(song, [rule.row]) >= rule.min;
  }
  function build(r) {
    const target = r.target ? MS.make(r.target) : null;
    let song;
    if (r.carry && prev) song = MS.copy(prev);
    else if (r.start) song = MS.make(r.start);
    else song = MS.make({ bpm: target.bpm, mood: target.mood, inst: target.inst });
    // Finish the loop: the steps before `lock` come filled in and fixed.
    if (r.lock) r.rows.forEach((id) => { for (let s = 0; s < r.lock; s++) song.cells[id][s] = target.cells[id][s]; });

    const prompt = r.q || (r.hear ? "Listen 👂, then make yours the same." : r.lock ? "Fill in the last two steps so the pattern keeps going." : "Find the mistake and fix it.");
    const q = el("h2", "q", prompt);
    const tools = el("div", "tools");
    let playing = false, g = null;
    const mine = button("btn", "▶ Play mine", () => {
      if (playing) { P.stop(); return; }
      playing = true;
      mine.textContent = "■ Stop";
      P.play(song, { loop: true, onStep: (s) => { g.head(s); if (s < 0) { playing = false; mine.textContent = "▶ Play mine"; } } });
    });
    if (r.hear) tools.appendChild(button("btn hear", "👂 Hear it", () => { playing = false; mine.textContent = "▶ Play mine"; P.play(target, { loop: 2 }); }));
    tools.appendChild(mine);
    const extra = el("div", "tools");
    if (r.tempo) extra.appendChild(MS.tempo(song, () => P.swap(song)));
    if (r.mood) extra.appendChild(MS.seg(MS.MOODS, () => song.mood, (m) => { song.mood = m; P.swap(song); }, "Mood"));
    const gridBox = el("div");
    const fb = el("p", "why", "");
    const tail = el("div", "tail");
    let wrong = 0, solved = false;
    const check = button("btn go wide", "✓ Check", () => {
      if (solved) return;
      P.stop();
      if (target) {
        const d = MS.diff(song, target, r.rows);
        if (!d.length) return win("Yes! That's exactly it! 🎉");
        wrong++;
        mistakes++;
        A.wrong();
        fb.className = "why bad";
        fb.textContent = "Not yet: " + d.length + (d.length === 1 ? " box is" : " boxes are") + " different." +
          (wrong >= 2 ? " The wiggling ones need changing." : r.hear ? " Listen again!" : "");
        if (wrong >= 2) g.flash(d);
        return;
      }
      const fail = r.rules.find((rule) => !passes(rule, song));
      if (!fail) return win("Brilliant, that fits! 🎉");
      mistakes++;
      A.wrong();
      fb.className = "why bad";
      fb.textContent = fail.tip;
    });
    function win(msg) {
      solved = true;
      prev = song;
      A.right();
      fb.className = "why good";
      fb.textContent = msg;
      check.hidden = true;
      tail.appendChild(nextButton());
      // Play it back once, as the reward.
      setTimeout(() => { if (lv && solved && box.contains(tail)) P.play(song, { loop: 1, onStep: (s) => g.head(s) }); }, 500);
    }
    box.append(q, tools);
    if (extra.children.length) box.appendChild(extra);
    box.append(gridBox, check, fb, tail);
    g = MS.grid(gridBox, { rows: r.rows, song, locked: r.lock ? (s) => s < r.lock : null, onChange: () => { if (playing) P.swap(song); } });
    if (r.hear) setTimeout(() => { if (lv && box.contains(gridBox)) P.play(target, { loop: 2 }); }, 400);
  }

  return { start, stop, passes };
})();
