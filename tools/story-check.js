/* Story Builder - level checks. Run: node tools/story-check.js                */
/* Every build and mountain round must be winnable with the tiles on offer,   */
/* and must not start out already won; tile sentences must read properly.     */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "story-builder", "js");
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["words.js", "levels.js"]) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
const SB = sandbox.SB, W = SB.Words;
let bad = 0, rounds = 0;
const fail = (where, m) => { bad++; console.log("✗ " + where + ": " + m); };
const tile = (cat, tiles) => ({ w: ((tiles && tiles[cat]) || SB.WORDS[cat])[0], cat });

// Build a winning answer from tiles only, following each rule in turn.
function solve(r, toks) {
  const has = (c) => r.tabs.includes(c);
  // Word-order rules first, so later tiles land after the who and the verb.
  r.rules.slice().sort((a, b) => (b.order ? 1 : 0) - (a.order ? 1 : 0)).forEach((x) => {
    if (x.order) x.order.forEach((c) => { if (!toks.some((t) => t.cat === c)) toks.push(tile(c, r.tiles)); });
    if (x.cat) { const c = [].concat(x.cat).find(has); while (W.count(toks, x.cat) < (x.min || 1) && c) toks.push(tile(c, r.tiles)); }
    if (x.first) toks.unshift(tile(x.first, r.tiles));
    if (x.senses) SB.SENSES.filter(has).slice(0, x.senses).forEach((c) => toks.push(tile(c, r.tiles)));
    if (x.words) while (W.words(toks) < x.words) toks.push(tile(r.tabs.find((c) => c !== "mark" && c !== x.first) || r.tabs[0], r.tiles));
  });
  return toks;
}

SB.CHAPTERS.forEach((ch) => ch.levels.forEach((lv, li) => lv.rounds.forEach((r, ri) => {
  rounds++;
  const where = `${ch.name} ${li + 1}.${ri + 1}`;
  if (r.kind === "choose") {
    if (r.options.filter((o) => o.ok).length !== 1) fail(where, "needs exactly one right option");
    if (r.show && r.show.filter((s) => !s).length !== 1) fail(where, "show needs exactly one missing part");
    if (r.q.includes("___") && r.options.some((o) => o.t.includes(" ") && o.t.split(" ").length > 3)) fail(where, "gap options should be single words");
    return;
  }
  if (r.kind === "sort") { r.items.forEach(([w, b]) => { if (!r.bins.some((x) => x.id === b)) fail(where, "no bin " + b); }); return; }
  if (r.kind === "order") { if (r.parts.length !== 5) fail(where, "order needs 5 parts"); return; }
  (r.tabs || []).forEach((c) => { if (!SB.WORDS[c] || !SB.TABS[c]) fail(where, "unknown tab " + c); });
  r.rules.forEach((x) => { if (!x.tip) fail(where, "every rule needs a tip"); [].concat(x.cat || [], x.order || [], x.first || []).forEach((c) => { if (!SB.WORDS[c]) fail(where, "rule on unknown kind " + c); if (!r.tabs.includes(c) && !(r.start || []).some((t) => t.cat === c) && !([].concat(x.cat || [])).some((k) => r.tabs.includes(k))) fail(where, "rule needs " + c + " tiles but no tab offers them"); }); });
  if (r.kind === "build") {
    const start = (r.start || []).map((t) => Object.assign({}, t));
    if (r.rules.every((x) => W.check(x, start))) fail(where, "starts already solved");
    const win = solve(r, start);
    const miss = r.rules.filter((x) => !W.check(x, win));
    if (miss.length) fail(where, "couldn't solve with tiles: " + miss.map((x) => x.tip).join(" / ") + " -> " + W.text(win));
    return;
  }
  if (r.kind === "mountain") {
    const parts = SB.PARTS.map(() => []);
    if (r.rules.every((x) => W.checkStory(x, parts))) fail(where, "starts already solved");
    r.rules.forEach((x) => {
      if (x.every) parts.forEach((p) => { while (W.words(p) < x.every) p.push(tile("who"), tile("wow"), tile("where")); });
      else if (x.part != null) { const p = parts[x.part]; if (x.first) p.unshift(tile(x.first)); if (x.cat) p.push(tile([].concat(x.cat)[0])); }
      else if (x.cat) for (let n = W.count([].concat(...parts), x.cat); n < (x.min || 1); n++) parts[1].push(tile([].concat(x.cat)[0]));
    });
    const miss = r.rules.filter((x) => !W.checkStory(x, parts));
    if (miss.length) fail(where, "couldn't write a passing story: " + miss.map((x) => x.tip).join(" / "));
    return;
  }
  fail(where, "unknown kind " + r.kind);
})));
// Tiles must read as proper sentences once formatted.
const s = W.text([{ w: "one stormy night,", cat: "opener" }, { w: "the dog", cat: "who" }, { w: "raced", cat: "wow" }, { w: "at the beach", cat: "where" }, { w: "!", cat: "mark" }, { w: "grandpa", cat: "own" }, { w: "giggled", cat: "wow" }]);
if (s !== "One stormy night, the dog raced at the beach! Grandpa giggled.") fail("format", s);
SB.QUIZ.forEach((pool, i) => pool.forEach((q) => { if (!(q.right >= 0 && q.right < q.a.length && q.why)) fail("quiz " + (i + 1), q.q); }));
if (SB.JOBS.length !== 3) fail("jobs", "should be 3");
console.log(bad ? `${bad} problem(s)` : `✓ ${rounds} rounds OK`);
process.exit(bad ? 1 : 0);
