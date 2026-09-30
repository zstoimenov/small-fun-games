/* Design Studio - level checks. Run: node tools/design-check.js               */
/* Mixing rounds must have one right small recipe (no other small ratio      */
/* within the match tolerance), sorting must agree with the colour maths, and every brief must */
/* start out unmet and be possible with the palette.                          */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "design-studio", "js");
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["colour.js", "levels.js", "mixer.js", "poster.js"]) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
const DS = sandbox.DS, C = DS.Colour;
let bad = 0, rounds = 0;
const fail = (where, m) => { bad++; console.log("✗ " + where + ": " + m); };

// Every pot of up to POT_MAX drops from the given paints.
function* pots(paints, left, i = 0, pot = {}) {
  if (i === paints.length) { if (C.drops(pot)) yield Object.assign({}, pot); return; }
  for (let n = 0; n <= left; n++) { pot[paints[i]] = n; yield* pots(paints, left - n, i + 1, pot); }
  delete pot[paints[i]];
}
const ratio = (p) => { const k = Object.keys(p).filter((x) => p[x]).sort(); const g = k.reduce((a, x) => { const gcd = (m, n) => (n ? gcd(n, m % n) : m); return gcd(a, p[x]); }, 0); return k.map((x) => x + p[x] / g).join(","); };

DS.CHAPTERS.forEach((ch) => ch.levels.forEach((lv, li) => lv.rounds.forEach((r, ri) => {
  rounds++;
  const where = `${ch.name} ${li + 1}.${ri + 1}`;
  if (r.kind === "choose") {
    if (r.options.filter((o) => o.ok).length !== 1) fail(where, "needs exactly one right option");
    if (r.options[0].poster) {
      const best = r.options.map((o) => C.contrast(o.poster.fg, o.poster.bg));
      const right = best[r.options.findIndex((o) => o.ok)];
      if (right < 4.5) fail(where, "the right poster isn't very readable (" + right.toFixed(1) + ")");
      best.forEach((c, i) => { if (!r.options[i].ok && c >= 3) fail(where, "a wrong poster is readable too (" + c.toFixed(1) + ")"); });
    }
    return;
  }
  if (r.kind === "mix") {
    Object.keys(r.target).forEach((k) => { if (!r.paints.includes(k)) fail(where, "target needs " + k + " but it isn't offered"); });
    if (C.drops(r.target) > DS.POT_MAX) fail(where, "target needs more drops than the pot holds");
    const want = C.mix(r.target), tr = ratio(r.target);
    // Big pots can creep up on the target (5:2 is near enough 2:1, as a real
    // painter would say). What must not match is a small pot with the wrong
    // idea, like 1:1 for a 2:1 target.
    const size = C.drops(r.target) + 1;
    const used = (p) => Object.keys(p).filter((x) => p[x]).sort().join();
    const sameIdea = (p) => used(p) === used(r.target) && Object.keys(r.target).every((k) => Math.abs((p[k] || 0) - r.target[k]) <= 1);
    for (const p of pots(r.paints, size)) if (ratio(p) !== tr && !sameIdea(p) && C.distance(C.mix(p), want) < DS.MATCH) fail(where, `${JSON.stringify(p)} also matches`);
    return;
  }
  if (r.kind === "sort") {
    r.items.forEach(([hex, bin]) => { if (C.temp(hex) !== bin) fail(where, `${hex} is ${C.temp(hex)}, not ${bin}`); });
    return;
  }
  if (r.kind === "design") {
    const start = r.start;
    if (r.rules.every((x) => DS.Poster.passes(x, start))) fail(where, "brief is met before doing anything");
    r.rules.forEach((x) => { if (!x.tip) fail(where, "every rule needs a tip"); });
    // Build a poster that meets the brief from the palette, as a kid could.
    const p = JSON.parse(JSON.stringify(start));
    const want = r.rules.find((x) => x.bg);
    if (want) p.bg = DS.PALETTE.find((h) => C.temp(h) === want.bg);
    p.title.color = DS.PALETTE.slice().sort((a, b) => C.contrast(b, p.bg) - C.contrast(a, p.bg))[0];
    const st = r.rules.find((x) => x.stickers);
    if (st) for (let i = 0; i < st.stickers; i++) p.items.push({ k: "sticker", e: "⭐", x: 100, y: 100, s: 50 });
    if (r.rules.some((x) => x.colours)) p.items = p.items.filter((i) => i.k !== "shape");
    const miss = r.rules.filter((x) => !DS.Poster.passes(x, p));
    if (miss.length) fail(where, "couldn't meet: " + miss.map((x) => x.tip).join(" / "));
    return;
  }
  fail(where, "unknown kind " + r.kind);
})));
DS.QUIZ.forEach((pool, i) => pool.forEach((q) => { if (!(q.right >= 0 && q.right < q.a.length && q.why)) fail("quiz " + (i + 1), q.q); }));
if (DS.JOBS.length !== 3) fail("jobs", "should be 3");
console.log(bad ? `${bad} problem(s)` : `✓ ${rounds} rounds OK`);
process.exit(bad ? 1 : 0);
