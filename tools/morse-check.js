/* Morse Agent - checks for the pure parts: the code table, the timing sums,   */
/* the lesson decks and the key's dot/dash classifier. No browser needed.      */
/*                                                                              */
/*   node tools/morse-check.js                                                  */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "morse", "js");
const timers = [];
const sandbox = { Math, console, setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: () => {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["rules.js", "key.js"]) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
const R = sandbox.MO.Rules;

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log("FAIL", msg); } };

// The table: 36 characters, every pattern unique, ORDER covers them all once.
ok(Object.keys(R.CODE).length === 36, "36 characters");
ok(Object.keys(R.DECODE).length === 36, "patterns are unique");
ok(R.ORDER.length === 36 && new Set(R.ORDER).size === 36, "ORDER has every character once");
ok(R.ORDER.split("").every((c) => R.CODE[c]), "ORDER only uses known characters");

// Timing: 12 wpm is a 100 ms dit; Ace is textbook spacing; Rookie is wider.
ok(R.DIT === 100, "dit is 100 ms");
const g = R.LEVELS.map((_, i) => R.gaps(i));
ok(g[2].beep === 100 && g[2].letter === 300 && g[2].word === 700, "Ace gaps are 1, 3 and 7 dits");
ok(g[0].beep === 125, "Rookie beep gap is 25% longer");
{ const ta = ((60 * 12 - 37.2 * 5) / 60) * 1000; ok(Math.abs(g[0].letter - 1.25 * 3 * ta / 19) < 1e-9, "Rookie letter gap is 25% longer"); }
ok(R.schedule("S", 0).total === 3 * 100 + 2 * 125, "Rookie S is three dits and two 125 ms gaps");
ok(g[0].letter > g[1].letter && g[1].letter > g[2].letter, "gaps shrink up the lever");
// PARIS is the standard word: 50 dits including the word gap after it.
const paris = R.schedule("PARIS", 2);
ok(paris.total === 4300, "PARIS is 43 dits without the trailing word gap (" + paris.total + ")");
ok(R.schedule("K", 0).segs.map((s) => s.dur).join() === "300,100,300", "K is dah dit dah, beeps not stretched");

// Lessons: mission 1 teaches K and M; every mission adds exactly one.
ok(R.lettersFor(1).join("") === "KM" && R.newFor(1).join("") === "KM", "mission 1 is K and M");
for (let n = 2; n <= R.MISSIONS; n++) {
  ok(R.lettersFor(n).length === n + 1 && R.lettersFor(n).slice(-1)[0] === R.newFor(n)[0], "mission " + n + " adds one letter");
}
for (let n = 1; n <= R.MISSIONS; n++) {
  for (let rep = 0; rep < 50; rep++) {
    const d = R.interceptDeck(n, 10);
    const fresh = R.newFor(n);
    ok(d.length === 10 && d.every((c) => R.lettersFor(n).includes(c)), "deck uses learned letters, mission " + n);
    ok(d.filter((c) => fresh.includes(c)).length >= 5, "half the deck is new letters, mission " + n);
    for (let lv = 0; lv < 3; lv++) {
      const ws = R.words(n, 2, R.LEVELS[lv].maxWord);
      ok(ws.length === 2 && ws.every((w) => w.length >= 2 && w.length <= R.LEVELS[lv].maxWord), "word length obeys the lever, mission " + n);
      ok(ws.every((w) => w.split("").every((c) => R.lettersFor(n).includes(c))), "words use learned letters only, mission " + n + " " + ws);
      ok(ws.every((w) => R.newFor(n).some((c) => w.includes(c))), "every word has the new letter, mission " + n + " " + ws);
    }
  }
}

// The key. A kid at a steady 180 ms dit (much slower than the start guess of
// 150) should still come out right, and so should a fast one at 80 ms.
function keyed(word, dit, jitter) {
  const out = [];
  const k = sandbox.MO.Key({ unit: 150, onLetter: (ch) => out.push(ch) });
  let t = 0;
  for (const ch of word) {
    for (const s of R.CODE[ch]) {
      const j = 1 + (Math.random() * 2 - 1) * jitter;
      k.down(t); t += (s === "." ? dit : 3 * dit) * j; k.up(t); t += dit * j;
    }
    // Letter gap: fire the pending timer, as the real clock would.
    const last = timers.pop(); timers.length = 0; if (last) last.f();
    t += 3 * dit;
  }
  return out.join("");
}
for (const [dit, jitter] of [[180, 0.25], [120, 0.25], [80, 0.2], [250, 0.3]]) {
  let right = 0;
  for (let i = 0; i < 200; i++) if (keyed("KMRSUAPTLOWINJEFYVGQZHBCDX", dit, jitter) === "KMRSUAPTLOWINJEFYVGQZHBCDX") right++;
  ok(right >= 180, "key reads a " + dit + " ms fist with " + jitter * 100 + "% wobble (" + right + "/200)");
}

console.log(passes + " passed, " + fails + " failed");
process.exit(fails ? 1 : 0);
