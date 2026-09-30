/* Music Studio - level checks. Run: node tools/music-check.js                 */
/* Every round must be winnable and must not start out already won: a copy    */
/* round whose grid already matches, or a rules round that passes untouched,  */
/* would hand out stars for nothing.                                          */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "music-studio", "js");
const sandbox = { console, performance: { now: () => 0 }, setTimeout, clearTimeout, setInterval, clearInterval };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["levels.js", "audio.js", "grid.js", "lesson.js"]) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
const MS = sandbox.MS;
const ids = new Set(MS.ROWS.map((r) => r.id));
let bad = 0, rounds = 0;
const fail = (where, m) => { bad++; console.log("✗ " + where + ": " + m); };

function patterns(where, spec) {
  Object.keys(spec).forEach((k) => {
    if (["bpm", "mood", "inst", "len"].includes(k)) return;
    if (!ids.has(k)) fail(where, "unknown row " + k);
    if (typeof spec[k] !== "string" || spec[k].length !== (spec.len || 8) || /[^x.]/.test(spec[k])) fail(where, `row ${k} should be ${spec.len || 8} of x and .`);
  });
}

MS.CHAPTERS.forEach((ch) => ch.levels.forEach((lv, li) => {
  let prev = null;
  lv.rounds.forEach((r, ri) => {
    rounds++;
    const where = `${ch.name} ${li + 1}.${ri + 1}`;
    if (r.kind === "tap") { if (!(r.bpm >= 60 && r.need > 0)) fail(where, "tap needs bpm and need"); return; }
    if (r.kind === "choose") {
      if (r.clip) patterns(where, r.clip);
      if (r.seq) r.seq.forEach((t) => { if (!ids.has(t)) fail(where, "unknown sound " + t); });
      if (r.options) { if (r.options.filter((o) => o.ok).length !== 1) fail(where, "needs exactly one right option"); }
      else if (!ids.has(r.answer)) fail(where, "answer must be a sound");
      if (!r.clip && !r.seq) fail(where, "nothing to listen to");
      return;
    }
    if (r.kind !== "build") return fail(where, "unknown kind " + r.kind);
    r.rows.forEach((id) => { if (!ids.has(id)) fail(where, "unknown row " + id); });
    if (r.target) patterns(where, r.target);
    if (r.start) patterns(where, r.start);
    const target = r.target ? MS.make(r.target) : null;
    let song = r.carry && prev ? MS.copy(prev) : r.start ? MS.make(r.start) : MS.make({ bpm: target.bpm });
    if (r.lock) r.rows.forEach((id) => { for (let s = 0; s < r.lock; s++) song.cells[id][s] = target.cells[id][s]; });
    if (target) {
      // Everything the target uses must be on a row the kid can see.
      MS.ROWS.forEach((row) => { if (!r.rows.includes(row.id) && target.cells[row.id].some(Boolean)) fail(where, "target uses hidden row " + row.id); });
      if (!MS.diff(song, target, r.rows).length) fail(where, "starts already solved");
      if (r.lock && MS.diff(song, target, r.rows).some(([, s]) => s < r.lock)) fail(where, "locked steps differ from the target");
      prev = target;
    } else {
      if (r.rules.every((rule) => MS.Lesson.passes(rule, song))) fail(where, "rules pass without doing anything");
      r.rules.forEach((rule) => { if (!rule.tip) fail(where, "every rule needs a tip"); if (rule.row && !r.rows.includes(rule.row)) fail(where, "rule on hidden row " + rule.row); });
      if (r.rules.some((rule) => rule.bpmMax || rule.bpmMin) && !r.tempo) fail(where, "tempo rule without a tempo slider");
      if (r.rules.some((rule) => rule.mood) && !r.mood) fail(where, "mood rule without mood buttons");
      // Build a song that follows every rule, to prove the round can be won.
      const win = MS.copy(song);
      r.rules.forEach((rule) => {
        if (rule.bpmMax) win.bpm = Math.min(win.bpm, rule.bpmMax);
        if (rule.bpmMin) win.bpm = Math.max(win.bpm, rule.bpmMin);
        if (rule.mood) win.mood = rule.mood;
        if (rule.on) rule.on.forEach((s) => { win.cells[rule.row][s] = 1; });
        if (rule.min) for (let s = 0; s < rule.min; s++) win.cells[rule.row][s] = 1;
        if (rule.notes) for (let s = 0; s < rule.notes; s++) win.cells.do[s] = 1;
      });
      if (!r.rules.every((rule) => MS.Lesson.passes(rule, win))) fail(where, "no way to pass every rule");
      if (win.bpm < MS.TEMPO.min || win.bpm > MS.TEMPO.max) fail(where, "needs a tempo off the slider");
      prev = win;
    }
  });
}));
if (MS.JOBS.length !== 3) fail("jobs", "should be 3");
MS.QUIZ.forEach((pool, i) => pool.forEach((q) => { if (!(q.right >= 0 && q.right < q.a.length && q.why)) fail("quiz " + (i + 1), q.q); }));
console.log(bad ? `${bad} problem(s)` : `✓ ${rounds} rounds in ${MS.CHAPTERS.reduce((n, c) => n + c.levels.length, 0)} levels OK`);
process.exit(bad ? 1 : 0);
