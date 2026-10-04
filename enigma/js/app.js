/* Enigma - the glue: state, the physical keyboard, and what each button does.  */
"use strict";
(function () {
  const R = EN.Rules;
  const UI = EN.UI;
  const MAX_ROUNDS = 4;             // how much paper we keep; older strips fall off the end

  let pos = [0, 0, 0];              // where the rotors are right now
  // One "round" = one go with one start. Turning a rotor after you have already
  // typed starts a NEW round instead of wiping the paper, so a mis-tap never
  // throws away a message somebody just typed.
  // `before` is where the rotors were before each letter, so Undo can wind them
  // back. Without that, undoing the letter would leave the rotors one step ahead
  // and every letter after it would come out wrong.
  let rounds = [{ start: "AAA", typed: "", coded: "", before: [] }];
  const held = {};                  // keys that are down or still glowing, see keyDown
  let muted = false;
  let ms = null;                    // the mission being played, or null in free play
  let freeSaved = null;             // free play's paper, kept while a mission runs

  try { muted = localStorage.getItem("enigma-muted") === "1"; } catch (e) { /* private mode */ }
  EN.Audio.setMuted(muted);

  const cur = () => rounds[rounds.length - 1];

  // Begin a fresh round at the given positions (only adds a strip if the current
  // one already has letters on it).
  function startRound(p, dirs) {
    pos = p.slice();
    const start = R.posToLetters(pos);
    if (cur().typed) {
      rounds.push({ start, typed: "", coded: "", before: [] });
      if (rounds.length > MAX_ROUNDS) rounds.shift();
    } else {
      cur().start = start;
    }
    UI.showRotors(pos, dirs);
    UI.showStart(start);
    UI.tape(rounds);
  }

  // held[letter] = { lamp, down, timer } from the moment a key goes down until its
  // lamp has finished fading.
  function keyDown(ch) {
    const h = held[ch];
    if (h && h.down) return;        // still physically down: ignore auto-repeat
    if (ms && !missionKey(ch)) return;
    press(ch);
    if (ms) afterKey();
  }

  // The machine itself: one key goes down, one lamp lights. Returns the lamp.
  function press(ch) {
    const h = held[ch];
    if (h) {                        // released but the lamp is still glowing: a fast
      clearTimeout(h.timer);        // typist re-pressing the same letter must not be
      UI.lamp(h.lamp, false);       // swallowed, so cut the old glow short
    }
    const r = R.press(pos, ch);
    cur().before.push(pos);
    pos = r.pos;
    cur().typed += ch;
    cur().coded += r.out;
    // The lamp belongs to the OUTPUT letter but the key that goes down is the one
    // pressed, so remember both.
    held[ch] = { lamp: r.out, down: true, timer: 0 };
    UI.keyDown(ch, true);
    UI.lamp(r.out, true);
    UI.showRotors(pos, r.moved.map((m) => (m ? 1 : 0)));
    UI.tape(rounds);
    EN.Audio.key();
    if (r.moved[1]) EN.Audio.rotor();
    return r.out;
  }

  function keyUp(ch) {
    const h = held[ch];
    if (!h || !h.down) return;
    h.down = false;
    UI.keyDown(ch, false);
    // Let the glow hang around a moment: on a fast tap the lamp would otherwise
    // flick on and off before anybody saw which letter it was.
    h.timer = setTimeout(() => {
      UI.lamp(h.lamp, false);
      if (held[ch] === h) delete held[ch];
    }, 350);
  }

  function turn(i, by) {
    EN.Audio.rotor();
    startRound(R.turn(pos, i, by), [0, 1, 2].map((k) => (k === i ? by : 0)));
  }

  function random() {
    EN.Audio.random();
    startRound([0, 0, 0].map(() => Math.floor(Math.random() * 26)), [1, 1, 1]);
  }

  function reset() {
    EN.Audio.rotor();
    startRound(R.lettersToPos(cur().start), [1, 1, 1]);
    if (ms) render();
  }

  function clear() {
    // Clear wipes the paper only. It keeps the start you were using: the rotors
    // have moved on while typing, so they go back to it rather than staying put.
    rounds = [{ start: cur().start, typed: "", coded: "", before: [] }];
    pos = R.lettersToPos(cur().start);
    UI.lampsOff();
    UI.showRotors(pos, [1, 1, 1]);
    UI.showStart(cur().start);
    UI.tape(rounds);
  }

  // Take back the last letter: off the paper, and the rotors turn back to where
  // they were before it, so the next letter codes the same as if it never happened.
  function undo() {
    const r = cur();
    if (!r.typed) { UI.toast("Nothing to undo."); return; }
    r.typed = r.typed.slice(0, -1);
    r.coded = r.coded.slice(0, -1);
    const was = pos;
    pos = r.before.pop();
    UI.lampsOff();
    // Roll back only the rotors that actually move, as the real ones would.
    UI.showRotors(pos, pos.map((p, i) => (p !== was[i] ? -1 : 0)));
    UI.tape(rounds);
    EN.Audio.rotor();
  }

  // The code only. The start letters are the key, and a key sent in the same
  // message as the code is no secret: anybody who sees the message can read it.
  // The help pop-up tells kids to pass the start on another way.
  function message() {
    const r = rounds.filter((x) => x.typed).pop();
    if (!r) return null;
    return R.groups(r.coded).join(" ");
  }

  // The phone's own share sheet (Messages, WhatsApp, email...). Where there is
  // none - most desktop browsers - it copies instead, so the button always works.
  function share() {
    const text = message();
    if (!text) { UI.toast("Type something first!"); return; }
    if (!navigator.share) { copy(); return; }
    const url = new URL("./", location.href).href;
    navigator.share({
      title: "A secret Enigma message",
      text: "I sent you a secret message! Ask me for the 3 secret start letters, set the rings, then type this code:\n\n" + text + "\n\nThe machine is here:",
      url
    }).catch((e) => {
      // Closing the share sheet is not an error worth a message.
      if (e && e.name !== "AbortError") copy();
    });
  }

  function copy() {
    const text = message();
    if (!text) { UI.toast("Type something first!"); return; }
    const ok = () => UI.toast("Code copied! Tell your friend the start letters.");
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let done = false;
      try { done = document.execCommand("copy"); } catch (e) { /* ignore */ }
      ta.remove();
      UI.toast(done ? "Code copied! Tell your friend the start letters." : "Could not copy - write the code down.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else {
      fallback();
    }
  }

  function mute() {
    muted = !muted;
    EN.Audio.setMuted(muted);
    try { localStorage.setItem("enigma-muted", muted ? "1" : "0"); } catch (e) { /* ignore */ }
    UI.muteState(muted);
  }

  UI.build({ keyDown, keyUp, turn, reset, clear, undo, share, random, mute });
  UI.muteState(muted);
  UI.showRotors(pos);
  UI.showStart(cur().start);
  UI.tape(rounds);

  // ── Menu, story and missions ─────────────────────────────────────────────
  const M = EN.Missions;
  const same = (a, b) => a.every((v, i) => v === b[i]);
  let best = {};
  try { best = JSON.parse(localStorage.getItem("enigma-missions")) || {}; } catch (e) { /* private mode */ }
  let onScreen = "home";

  function show(name) {
    onScreen = name;
    UI.screen(name);
  }

  function showStory() {
    UI.story(M.STORY);
    show("story");
  }

  // A mission opens once the one before it has at least one star.
  function showHome() {
    leaveMission();
    const items = M.LIST.map((m, i) => ({ name: m.name, line: m.line, best: best[i + 1] || 0, locked: i > 0 && !best[i] }));
    const total = items.reduce((t, it) => t + it.best, 0);
    // The big button offers the next new mission, then one still short of 3
    // stars, then free play.
    const n = items.findIndex((it) => !it.best && !it.locked);
    const again = items.findIndex((it) => it.best && it.best < 3);
    const next = n >= 0 ? { label: "▶ Mission " + (n + 1) + ": " + M.LIST[n].name, go: () => startMission(n) }
      : again >= 0 ? { label: "▶ Mission " + (again + 1) + " again for ★★★", go: () => startMission(again) }
      : { label: "🔐 Free play ›", go: startFree };
    UI.home(items, total, M.MAX, next, startMission);
    show("home");
  }

  function save(i, stars) {
    if (stars <= (best[i] || 0)) return;
    best[i] = stars;
    const total = Object.keys(best).reduce((t, k) => t + best[k], 0);
    try {
      localStorage.setItem("enigma-missions", JSON.stringify(best));
      localStorage.setItem("gamebox:progress:enigma", JSON.stringify({ stars: total, max: M.MAX, at: Date.now() }));
    } catch (e) { /* private mode: the stars just are not kept */ }
  }

  function setMachine(p, r) {
    rounds = r;
    pos = p.slice();
    UI.lampsOff();
    UI.showRotors(pos, [1, 1, 1]);
    UI.showStart(cur().start);
    UI.tape(rounds);
  }

  function startFree() {
    leaveMission();
    UI.mode(false);
    UI.rotorState([false, false, false]);
    if (freeSaved) { setMachine(freeSaved.pos, freeSaved.rounds); freeSaved = null; }
    show("play");
  }

  function leaveMission() {
    if (ms) ms.gone = true;         // stops a Try that is still typing
    ms = null;
    UI.glowKey(null);
  }

  function startMission(i) {
    leaveMission();
    if (!freeSaved) freeSaved = { pos, rounds };
    const m = M.LIST[i];
    const start = R.lettersToPos(m.start);
    ms = { i: i + 1, m, phase: m.kind === "reply" ? "write" : "read", idx: 0, count: 0, hinted: false,
      done: false, busy: false, out: "", tried: [], spot: null, ruled: [], clash: [],
      say: m.kind === "crib" ? [m.brief, m.rule] : m.brief };
    // Where the rings begin: at A for anything the kid has to find or set,
    // already in place for what the mission gives away.
    let p = [0, 0, 0];
    if (m.kind === "crack") p = start.map((v, k) => (m.missing.indexOf(k) >= 0 ? 0 : v));
    if (m.kind === "crib") p = start;
    UI.mode(true, m.kind);
    setMachine(p, [{ start: R.posToLetters(p), typed: "", coded: "", before: [] }]);
    const missing = [0, 1, 2].map((k) => m.kind === "crack" && m.missing.indexOf(k) >= 0);
    UI.rotorState(m.kind === "crack" ? missing.map((x) => !x) : [m.kind === "crib", m.kind === "crib", m.kind === "crib"], missing);
    show("play");
    render();
  }

  // What the kid has to type right now, in the typing missions.
  function target() {
    return ms.m.kind === "reply" && ms.phase === "write" ? ms.m.plain : ms.m.code;
  }

  // Every key in a mission comes through here first. Wrong letters never reach
  // the machine: they count as a mistake and the rotors stay where they were,
  // so one slip cannot turn the rest of the message into nonsense.
  function missionKey(ch) {
    const m = ms.m;
    if (ms.done) { UI.toast("Mission done! Tap Next."); return false; }
    if (ms.busy) return false;
    if (m.kind === "crack") { UI.toast("Tap Try. The machine types the code for you."); return false; }
    if (m.kind === "crib") { UI.toast("First find where WEATHER fits."); return false; }
    if (ms.idx === 0 && !same(pos, R.lettersToPos(m.start))) {
      UI.toast(ms.phase === "check" ? "Tap Reset first." : "First spin the rings to " + m.start.split("").join(" ") + ".");
      UI.nudgeRotors();
      return false;
    }
    if (ch !== target()[ms.idx]) {
      ms.count++;
      ms.say = "Oops! Not that one. Find the boxed letter on the note.";
      UI.shakeKey(ch);
      EN.Audio.oops();
      render();
      return false;
    }
    return true;
  }

  function afterKey() {
    ms.idx++;
    // Turning a ring halfway through would scramble the rest, so the rings
    // lock as soon as the first letter is in.
    if (ms.idx === 1) UI.rotorState([true, true, true]);
    if (ms.idx === target().length) {
      if (ms.m.kind === "reply" && ms.phase === "write") {
        ms.phase = "check";
        ms.idx = 0;
        ms.say = ms.m.check;
      } else {
        return finish();
      }
    } else if (ms.say !== ms.m.brief && ms.phase !== "check") {
      ms.say = ms.m.brief;
    }
    render();
  }

  // The crack missions: the machine types the whole code by itself at the
  // rings' current start, then winds back so the next guess starts clean.
  function tryIt() {
    if (ms.busy || ms.done) return;
    const run = ms;
    const from = pos.slice();
    const code = run.m.code;
    run.busy = true;
    run.out = "";
    run.tried.push(run.m.missing.map((k) => R.ABC[from[k]]).join(""));
    startRound(from);
    let i = 0;
    const step = () => {
      if (run.gone) return;
      if (i === code.length) return tried(run, from);
      const ch = code[i++];
      run.out += press(ch);
      setTimeout(() => keyUp(ch), 60);
      render();
      setTimeout(step, 90);
    };
    render();
    step();
  }

  function tried(run, from) {
    run.busy = false;
    if (run.out === run.m.plain) return finish();
    run.count++;
    run.say = "Try " + run.tried.length + ": no real words. Spin the ? ring" + (run.m.missing.length > 1 ? "s" : "") + " and Try again.";
    startRound(from);
    render();
  }

  // Turing's trick.
  function pickSpot(s) {
    if (ms.done || ms.busy) return;
    ms.spot = s;
    // Red marks follow the word only where they are earned: after the hint,
    // or back on a spot already ruled out.
    ms.clash = ms.hinted || ms.ruled.indexOf(s) >= 0 ? M.clashes(ms.m, s) : [];
    render();
  }

  function checkSpot() {
    const m = ms.m;
    if (ms.done || ms.busy) return;
    if (ms.spot == null) { UI.toast("Tap a spot first."); return; }
    if (ms.ruled.indexOf(ms.spot) >= 0) { UI.toast("We already know it's not there."); return; }
    if (ms.spot !== m.answer) {
      ms.count++;
      ms.clash = M.clashes(m, ms.spot);
      ms.ruled.push(ms.spot);
      const ch = m.code[ms.clash[0]];
      ms.say = ["Look: " + ch + " is under " + ch + "!", "Enigma never turns a letter into itself, so WEATHER can't be here. Try another spot."];
      EN.Audio.oops();
      render();
      return;
    }
    // Found it. Now the machine reads the whole message, the way the bombes
    // gave Bletchley the start once they knew where the word was.
    ms.clash = [];
    ms.busy = true;
    ms.say = "Yes! No letter sits on itself here. Now watch the machine read it…";
    const run = ms;
    let i = 0;
    const step = () => {
      if (run.gone) return;
      if (i === m.code.length) { run.busy = false; return finish(); }
      const ch = m.code[i++];
      press(ch);
      setTimeout(() => keyUp(ch), 70);
      setTimeout(step, 110);
    };
    render();
    step();
  }

  function hint() {
    const m = ms.m;
    if (ms.done || ms.busy) return;
    ms.hinted = true;
    if (m.kind === "crib") {
      if (ms.spot != null) ms.clash = M.clashes(m, ms.spot);
    }
    ms.say = "💡 " + m.hint;
    render();
  }

  function finish() {
    const m = ms.m;
    ms.done = true;
    ms.stars = M.stars(m, ms.count, ms.hinted);
    save(ms.i, ms.stars);
    ms.say = ["🎉 You did it! The message says:", m.say];
    UI.rotorState([true, true, true]);
    UI.glowKey(null);
    EN.Audio.win();
    render();
  }

  function render() {
    const m = ms.m;
    const stars = ms.done ? ms.stars : M.stars(m, ms.count, ms.hinted);
    UI.missionInfo("Mission " + ms.i + " of " + M.LIST.length, m.name, stars, ms.say);
    const typing = m.kind === "decode" || m.kind === "reply";
    UI.glowKey(typing && ms.hinted && !ms.done ? target()[ms.idx] : null);

    const items = [];
    const start = m.kind === "crack"
      ? m.start.split("").map((c, k) => (m.missing.indexOf(k) >= 0 ? "?" : c)).join("")
      : m.start;
    if (ms.done) {
      items.push({ lab: "Message", text: m.plain });
      items.push({ fact: m.fact });
    } else if (m.kind === "decode") {
      items.push({ lab: "Start", big: start });
      items.push({ lab: "Code", letters: m.code, at: ms.idx });
      items.push({ lab: "Message", text: cur().coded });
    } else if (m.kind === "reply") {
      items.push({ lab: "Start", big: start });
      if (ms.phase === "write") {
        items.push({ lab: "Type", letters: m.plain, at: ms.idx });
        items.push({ lab: "Your code", text: cur().coded });
      } else {
        items.push({ lab: "Type your code", letters: m.code, at: ms.idx });
        items.push({ lab: "Comes out", text: cur().coded });
      }
    } else if (m.kind === "crack") {
      // What the last try gave comes before the start: on a short phone the
      // note scrolls, and the rings already show the start.
      items.push({ clue: m.clue || "Clue: middle ring " + m.choices[0].split("").join(", ").replace(/, (\w)$/, " or $1") +
        ", right ring " + m.choices[1].split("").join(", ").replace(/, (\w)$/, " or $1") + "." });
      items.push({ lab: "Code", letters: m.code, at: -1 });
      items.push({ lab: ms.tried.length ? "Try " + ms.tried.length + " gave" : "Comes out", text: ms.out, empty: "Tap Try!" });
      if (ms.tried.length) items.push({ lab: "Tried", raw: ms.tried.join(" ") });
      items.push({ lab: "Start", big: start });
    } else {
      items.push({ crib: { code: m.code, crib: m.crib, spot: ms.spot, spots: m.spots, ruled: ms.ruled, clash: ms.clash, locked: ms.busy } });
    }
    UI.note(items, pickSpot);

    const hintBtn = { label: ms.hinted ? "💡 Hint" : "💡 Hint (-1 ★)", go: hint, off: ms.busy };
    if (ms.done) {
      const last = ms.i === M.LIST.length;
      UI.actions([
        { label: "↺ Play again", go: () => startMission(ms.i - 1) },
        { label: last ? "All done! Menu ›" : "Next mission ›", main: true, go: () => (last ? showHome() : startMission(ms.i)) }
      ]);
    } else if (m.kind === "crack") {
      UI.actions([hintBtn, { label: ms.busy ? "Typing…" : "🔍 Try", main: true, go: tryIt, off: ms.busy }]);
    } else if (m.kind === "crib") {
      UI.actions([hintBtn, { label: "✔ It's here!", main: true, go: checkSpot, off: ms.busy }]);
    } else if (ms.phase === "check") {
      UI.actions([hintBtn, { label: "↺ Reset", main: true, go: reset }]);
    } else {
      UI.actions([hintBtn]);
    }
  }

  document.getElementById("toMenu").addEventListener("click", showHome);
  document.getElementById("freeBtn").addEventListener("click", startFree);
  document.getElementById("storyBtn").addEventListener("click", showStory);
  document.getElementById("storyGo").addEventListener("click", () => {
    try { localStorage.setItem("enigma-seen-story", "1"); } catch (e) { /* private mode */ }
    showHome();
  });

  // The story shows by itself once, on the very first visit; after that the
  // menu opens and the story is one tap away.
  let seenStory = false;
  try { seenStory = !!localStorage.getItem("enigma-seen-story"); } catch (e) { /* private mode */ }
  if (seenStory) showHome(); else showStory();

  // Physical keyboard. Only plain letters: Ctrl/Cmd+C must still copy, and
  // ignoring repeats stops a held key from typing a whole row of letters.
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    // A pop-up is on top of the machine; typing should not code letters unseen.
    if (document.querySelector("dialog[open]")) return;
    if (onScreen !== "play") return;
    // Undo is free play only (its button is hidden in missions): rewinding the
    // rotors there would leave the mission's place in the message behind.
    if (e.key === "Backspace") { e.preventDefault(); if (!ms) undo(); return; }
    if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
      e.preventDefault();
      keyDown(e.key.toUpperCase());
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key.length === 1 && /[a-z]/i.test(e.key)) keyUp(e.key.toUpperCase());
  });
  // If the tab loses focus mid-press the keyup never arrives; drop the lamps.
  window.addEventListener("blur", () => {
    Object.keys(held).forEach((k) => { clearTimeout(held[k].timer); delete held[k]; });
    UI.lampsOff();
  });
})();
