/* Буквар Quest - checks for the pure parts: the alphabet, the decodability of  */
/* every word and sentence, and the rounds each step deals. No browser needed.  */
/*                                                                              */
/*   node tools/bukvar-check.js                                                 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "bulgarian-bukvar", "js");
const sandbox = { Math, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["letters.js", "missions.js", "rules.js"]) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
const { Letters: L, MISSIONS: M, Rules: R } = sandbox.BQ;

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log("FAIL", msg); } };

// The alphabet: 30 letters, each with a hint.
ok(L.ALPHABET.length === 30, "30 letters");
ok(L.ALPHABET.every((l) => l.hint && l.up.toLowerCase() === l.lo), "every letter has a hint and a matching small form");

// Every letter taught exactly once, across all missions.
const taught = M.flatMap((m) => m.letters);
ok(taught.length === 30 && new Set(taught).size === 30, "missions teach all 30 letters once each (" + taught.length + ")");
ok(taught.every((c) => L.BY[c] && L.BY[c].up === c), "missions use capital letters from the alphabet");

// Decodability: the rule the whole reader rests on.
M.forEach((m, n) => {
  const set = R.known(n);
  const texts = [...m.blend, ...m.words.map((w) => w[0]), ...m.read, ...Object.values(m.examples)];
  texts.forEach((t) => {
    const bad = R.unreadable(t, set);
    ok(!bad.length, "mission " + (n + 1) + ": \"" + t + "\" uses unlearned " + bad.join(" "));
  });
  // Each new letter has an example word that contains it.
  m.letters.forEach((c) => {
    const ex = m.examples[c];
    ok(ex && R.lettersOf(ex).includes(c), "mission " + (n + 1) + ": example for " + c + " contains it");
  });
  // Every new letter turns up somewhere in the mission's own reading.
  const used = new Set(texts.flatMap(R.lettersOf));
  m.letters.forEach((c) => ok(used.has(c), "mission " + (n + 1) + " actually uses " + c));
  ok(m.read.length >= 2, "mission " + (n + 1) + " has sentences to read");
  ok(m.blend.length >= 4, "mission " + (n + 1) + " has blends");
});

// No word or picture appears twice anywhere: a repeated emoji would give a
// picture-match question two right answers.
const allW = M.flatMap((m) => m.words.map((w) => w[0]));
const allE = M.flatMap((m) => m.words.map((w) => w[1]));
ok(new Set(allW).size === allW.length, "picture words are unique");
ok(new Set(allE).size === allE.length, "pictures are unique: " + allE.filter((e, i) => allE.indexOf(e) !== i).join(" "));

// Dealing rounds, many seeds, every mission.
for (let seed = 1; seed <= 200; seed++) {
  const rand = R.rng(seed);
  M.forEach((m, n) => {
    const set = R.known(n);
    const mr = R.matchRounds(n, rand);
    ok(mr.length === R.MATCH_ROUNDS, "match deals " + R.MATCH_ROUNDS + " rounds");
    mr.forEach((r) => {
      ok(r.options.length >= Math.min(3, R.pool(n).length), "match has enough options (m" + (n + 1) + ")");
      ok(r.options.filter((o) => o.w === r.answer.w).length === 1, "match answer appears once");
      ok(new Set(r.options.map((o) => o.e)).size === r.options.length, "match pictures distinct");
      ok(new Set(r.options.map((o) => o.w)).size === r.options.length, "match words distinct");
    });
    ok(mr.filter((r) => r.answer.m === n).length >= Math.min(R.MATCH_ROUNDS, m.words.length), "match asks about the new words first");

    R.buildRounds(n, rand).forEach((b) => {
      const tiles = b.tiles.slice();
      const can = b.answer.w.split("").every((c) => { const i = tiles.indexOf(c); if (i < 0) return false; tiles.splice(i, 1); return true; });
      ok(can, "build tiles spell " + b.answer.w);
      ok(b.tiles.every((c) => set.includes(c.toUpperCase())), "build tiles are known letters");
      ok(b.tiles.length <= 8, "build fits on a row");
    });

    const tr = R.trapRounds(n, rand);
    if (R.trapsKnown(n).length) {
      ok(tr.length === R.TRAP_ROUNDS, "trap drill deals rounds (m" + (n + 1) + ")");
      tr.forEach((r) => {
        ok(r.options.filter((o) => o === r.answer).length === 1, "trap answer appears once: " + r.show);
        ok(new Set(r.options).size === r.options.length && r.options.length >= 2, "trap options distinct");
        if (r.kind === "which") ok(r.options.every((c) => set.includes(c.toUpperCase())), "trap letters are known");
        else ok(r.options.includes(r.trap.wrong), "sound round offers the English misreading");
      });
    } else ok(!tr.length, "no drill before a trap letter is learned");
  });
}

ok(R.stars(6, 10) === 1 && R.stars(7, 10) === 2 && R.stars(9, 10) === 3, "stars thresholds");

console.log((fails ? "FAILED " + fails : "ok") + " - " + passes + " checks passed");
process.exit(fails ? 1 : 0);
