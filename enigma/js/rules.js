/* Enigma - the machine itself, and nothing else.                               */
/*                                                                              */
/* Pure logic: no DOM, no audio, no clock. That is what lets a plain node script */
/* check it against the famous test vector (AAAAA -> BDZGO) without a browser.  */
/*                                                                              */
/* This is the real wiring of an Enigma I army machine, cut down for kids:      */
/*   - three rotors, always I, II, III from left to right                       */
/*   - reflector B                                                              */
/*   - NO plugboard and NO ring settings (the real ones had both)               */
/* The only thing a player can choose is where the three rotors start.          */
/* Positions are numbers 0-25 (A-Z), always in [left, middle, right] order.     */
"use strict";
window.EN = window.EN || {};

EN.Rules = (function () {
  const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Each string is "what does A come out as, what does B come out as, ..." for a
  // signal travelling right-to-left through that rotor.
  const ROTORS = [
    { name: "I",   wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
    { name: "II",  wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
    { name: "III", wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" }
  ];
  const REFLECTOR = "YRUHQSLDPXNGOKMIEBFZCWVJAT";

  const idx = (ch) => ABC.indexOf(ch);
  const mod = (n) => ((n % 26) + 26) % 26;

  // Forward and backward lookup tables, worked out once. The backward table is
  // the same wiring read the other way, for the signal coming back from the
  // reflector.
  const FWD = ROTORS.map((r) => r.wiring.split("").map(idx));
  const BWD = FWD.map((f) => {
    const b = new Array(26);
    f.forEach((out, i) => { b[out] = i; });
    return b;
  });
  const REF = REFLECTOR.split("").map(idx);
  const NOTCH = ROTORS.map((r) => idx(r.notch));

  // A rotor turns the wiring by its position, so the signal goes in at (pin +
  // position), through the fixed wires, and comes out at (pin - position).
  function through(table, rotor, pos, pin) {
    return mod(table[rotor][mod(pin + pos)] - pos);
  }

  // The stepping rule, including the famous quirk. The right rotor moves on every
  // key. When it passes its notch it drags the middle one along. And when the
  // middle rotor is sitting AT its notch it moves itself AND the left rotor - so
  // the middle rotor can turn on two keys in a row ("double step"). Both checks
  // look at the positions BEFORE anything moves.
  function step(pos) {
    let [l, m, r] = pos;
    const middleAtNotch = m === NOTCH[1];
    const rightAtNotch = r === NOTCH[2];
    if (middleAtNotch) { l = mod(l + 1); m = mod(m + 1); }
    else if (rightAtNotch) { m = mod(m + 1); }
    r = mod(r + 1);
    return [l, m, r];
  }

  // Press one key. The rotors turn FIRST and then the current flows, exactly like
  // the real machine - which is why the very first letter already uses a moved
  // rotor. Returns the lit letter, the new positions and which rotors moved (so
  // the screen can animate only those).
  function press(pos, letter) {
    const next = step(pos);
    let c = idx(letter);
    c = through(FWD, 2, next[2], c);
    c = through(FWD, 1, next[1], c);
    c = through(FWD, 0, next[0], c);
    c = REF[c];
    c = through(BWD, 0, next[0], c);
    c = through(BWD, 1, next[1], c);
    c = through(BWD, 2, next[2], c);
    return {
      out: ABC[c],
      pos: next,
      moved: [next[0] !== pos[0], next[1] !== pos[1], next[2] !== pos[2]]
    };
  }

  // Whole message at once (used by tests, and handy for a friend to check).
  function encode(start, text) {
    let pos = start.slice();
    let out = "";
    for (const ch of text.toUpperCase()) {
      if (idx(ch) < 0) continue;
      const r = press(pos, ch);
      pos = r.pos;
      out += r.out;
    }
    return out;
  }

  function posToLetters(pos) { return pos.map((p) => ABC[mod(p)]).join(""); }
  function lettersToPos(s) { return s.toUpperCase().split("").map(idx); }
  function turn(pos, which, by) {
    const p = pos.slice();
    p[which] = mod(p[which] + by);
    return p;
  }

  // Code goes out in groups of five, the way real Enigma messages were sent -
  // easier to read out loud and easier to spot a slip.
  function groups(text, size) {
    const n = size || 5;
    const out = [];
    for (let i = 0; i < text.length; i += n) out.push(text.slice(i, i + n));
    return out;
  }

  return {
    ABC, ROTORS, REFLECTOR,
    // QWERTY, not the real machine's QWERTZ: kids know the keyboard on their own
    // tablet, and hunting for Z and Y in the wrong places is not the fun part.
    LAYOUT: ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"],
    step, press, encode, turn, groups, posToLetters, lettersToPos, mod
  };
})();
