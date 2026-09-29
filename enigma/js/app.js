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

  // What a friend needs to read the message: the start, the code, and where the
  // machine is.
  function message() {
    const r = rounds.filter((x) => x.typed).pop();
    if (!r) return null;
    return "Secret start: " + r.start + "\nCode: " + R.groups(r.coded).join(" ");
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
      text: "I sent you a secret message! Set the rings to the secret start and type the code.\n\n" + text + "\n\nDecode it here:",
      url
    }).catch((e) => {
      // Closing the share sheet is not an error worth a message.
      if (e && e.name !== "AbortError") copy();
    });
  }

  function copy() {
    const text = message();
    if (!text) { UI.toast("Type something first!"); return; }
    const ok = () => UI.toast("Copied! Send it to a friend.");
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
      UI.toast(done ? "Copied! Send it to a friend." : "Could not copy - write the code down.");
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

  UI.build({ keyDown, keyUp, turn, reset, clear, copy, undo, share, random, mute });
  UI.muteState(muted);
  UI.showRotors(pos);
  UI.showStart(cur().start);
  UI.tape(rounds);

  // Physical keyboard. Only plain letters: Ctrl/Cmd+C must still copy, and
  // ignoring repeats stops a held key from typing a whole row of letters.
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.key === "Backspace") { e.preventDefault(); undo(); return; }
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
