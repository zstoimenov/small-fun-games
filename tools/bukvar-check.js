/* Буквар - checks for the pure parts: the alphabet, the decodability of        */
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
for (const f of ["letters.js", "missions.js", "rules.js", "cards.js", "quiz.js"]) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
const { Letters: L, MISSIONS: M, Rules: R, CARDS: C, STAMPS: S, Quiz: Q } = sandbox.BQ;

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


// History cards: readable when they open, and the quiz clue never gives the
// name away (clues are English, so any Cyrillic in one is a leak).
ok(new Set(C.map((c) => c.id)).size === C.length, "card ids unique");
C.forEach((c) => {
  const bad = R.unreadable(c.name + " " + c.line, R.known(c.m));
  ok(!bad.length, "card " + c.id + " uses unlearned " + bad.join(" "));
  ok(!/[\u0400-\u04FF]/.test(c.clue + c.ask.join("")), "card " + c.id + " clue and question have no Cyrillic");
  ok(c.e && c.when && c.hook && c.clue && (c.year === null || Number.isInteger(c.year)), "card " + c.id + " complete");
  ok(Array.isArray(c.pages) && c.pages.length >= 2 && c.pages.every((t) => t.length > 20), "card " + c.id + " has story pages");
  ok(c.ask.length === 4 && new Set(c.ask.slice(1)).size === 3, "card " + c.id + " Remember it has 3 distinct options");
  ok(c.m >= 0 && c.m < M.length, "card " + c.id + " opens with a real mission");
});
C.filter((c) => c.year !== null).forEach((c) => {
  const first = +c.when.replace(/,/g, "").match(/\d{3,}|\d+(?= BC)/)[0] * (/BC/.test(c.when) ? -1 : 1);
  ok(first === c.year, "card " + c.id + " year " + c.year + " matches the first year shown (" + c.when + ")");
});
ok(C.length >= 40, "at least 40 cards (" + C.length + ")");
ok(new Set(C.map((c) => c.name)).size === C.length, "card names unique");
ok(new Set(C.map((c) => c.e)).size === C.length, "card pictures unique");
ok(S.length === 9 && S.every((s, i) => s.m === i + 1), "one stamp per mission 2-10");

// The quiz: five questions, no repeats, exactly one right answer, every
// Bulgarian option readable, and a pool of at least 12 different questions.
S.forEach((st) => {
  const n = st.m, set = R.known(n), keys = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const qs = Q.round(n, R.rng(seed * 7 + n));
    ok(qs.length === Q.QUESTIONS, st.place + " deals " + Q.QUESTIONS + " questions");
    ok(new Set(qs.map((q) => q.key)).size === qs.length, st.place + " has no repeated question");
    qs.forEach((q) => {
      keys.add(q.key);
      if (q.kind === "timeline") {
        ok(q.cards.length === 3 && Q.isRight(q, q.answer), "timeline is answerable");
        ok(q.cards.every((c) => c.m <= n), "timeline cards are open");
        return;
      }
      ok(q.options.filter((o) => o === q.answer).length === 1, st.place + " " + q.kind + ": one right answer");
      ok(new Set(q.options).size === q.options.length && q.options.length >= 2, st.place + " " + q.kind + ": options distinct");
      if (q.bg) q.options.forEach((o) => ok(!R.unreadable(o, set).length, st.place + " " + q.kind + ": \"" + o + "\" readable"));
      if (q.word) ok(!R.unreadable(q.word, set).length, st.place + " " + q.kind + ": \"" + q.word + "\" readable");
      if (q.kind === "missing") q.options.forEach((o) => {
        const w = q.word.replace("_", o);
        ok((o === q.answer) === R.pool(n).some((p) => p.w === w), st.place + " missing: only the answer spells a real word (" + w + ")");
      });
      if (q.kind === "word2pic") ok(R.pool(n).find((p) => p.w === q.word).e === q.answer, "word2pic answer is the word's picture");
      if (q.kind === "group") ok(C.filter((c) => q.options.includes(c.name) && c.m <= n).length === q.options.length, "group options are open cards");
      if (q.card) ok(q.card.m <= n, "story question's card is open");
      if (q.kind === "first") ok(q.cards.every((c) => c.year !== null), "first only uses dated cards");
      if (q.kind === "first") ok(q.cards.find((c) => c.name === q.answer).year < q.cards.find((c) => c.name !== q.answer).year, "first picks the older");
    });
  }
  ok(keys.size >= 12, st.place + " quiz pool has " + keys.size + " questions (need 12)");
});
ok(Q.stamp(5, 0) === "gold" && Q.stamp(5, 1) === "ink" && Q.stamp(4, 0) === null, "stamp rules");

ok(R.stars(6, 10) === 1 && R.stars(7, 10) === 2 && R.stars(9, 10) === 3, "stars thresholds");

console.log((fails ? "FAILED " + fails : "ok") + " - " + passes + " checks passed");
process.exit(fails ? 1 : 0);
