/* Comic Studio - level checks. Run: node tools/comic-check.js                 */
/* Every panel must use real scenes, characters, faces and bubble kinds;      */
/* choose rounds need one right answer; every brief must start unmet and be   */
/* possible to meet with the editor's tools.                                  */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "comic-studio", "js");
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["art.js", "comic.js", "levels.js"]) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
const CS = sandbox.CS;
const scenes = new Set(CS.SCENES.map((s) => s.id)), chars = new Set(CS.CHARS.map((c) => c.id)), faces = new Set(CS.FACES.map((f) => f.id)), kinds = new Set(CS.KINDS.map((k) => k.id));
let bad = 0, rounds = 0;
const fail = (where, m) => { bad++; console.log("✗ " + where + ": " + m); };
function panel(where, p) {
  if (!p) return;
  if (!scenes.has(p.scene)) fail(where, "unknown scene " + p.scene);
  p.chars.forEach((c) => { if (!chars.has(c.c)) fail(where, "unknown character " + c.c); if (!faces.has(c.face)) fail(where, "unknown face " + c.face); });
  p.bubbles.forEach((b) => { if (!kinds.has(b.kind)) fail(where, "unknown bubble " + b.kind); if (b.x < 0 || b.x > 300 || b.y < 0 || b.y > 240) fail(where, "bubble off the panel: " + b.text); });
  p.props.forEach((x) => { if (x.x < 0 || x.x > 300 || x.y < 0 || x.y > 240) fail(where, "prop off the panel: " + x.e); });
}

CS.CHAPTERS.forEach((ch) => ch.levels.forEach((lv, li) => lv.rounds.forEach((r, ri) => {
  rounds++;
  const where = `${ch.name} ${li + 1}.${ri + 1}`;
  if (r.kind === "order") { if (r.panels.length !== 3) fail(where, "order needs 3 panels"); r.panels.forEach((p) => panel(where, p)); return; }
  if (r.kind === "choose") {
    if (r.options.filter((o) => o.ok).length !== 1) fail(where, "needs exactly one right option");
    (r.show || []).forEach((p) => panel(where, p));
    r.options.forEach((o) => { if (o.panel) panel(where, o.panel); if (o.face && (!chars.has(o.face.c) || !faces.has(o.face.f))) fail(where, "bad face option"); if (o.bub && !kinds.has(o.bub)) fail(where, "bad bubble option"); });
    if (r.show && r.show.filter((p) => !p).length > 1) fail(where, "show can have at most one ? panel");
    return;
  }
  if (r.kind !== "build") return fail(where, "unknown kind " + r.kind);
  r.start.panels.forEach((p) => panel(where, p));
  if (r.rules.every((x) => CS.Comic.passes(x, r.start))) fail(where, "brief is met before doing anything");
  r.rules.forEach((x) => { if (!x.tip) fail(where, "every rule needs a tip"); });
  // Meet the brief the way a kid could with the editor, then check it passes.
  const c = JSON.parse(JSON.stringify(r.start));
  const hero = r.rules.find((x) => typeof x.hero === "string") ? r.rules.find((x) => typeof x.hero === "string").hero : "sam";
  c.panels.forEach((p) => { if (!p.chars.length) p.chars.push({ c: hero, face: "happy", x: 150, y: 228, s: 120 }); });
  r.rules.forEach((x) => {
    if (x.hero === true) c.panels.forEach((p) => { if (!p.chars.some((k) => k.c === c.panels[0].chars[0].c)) p.chars.push({ c: c.panels[0].chars[0].c, face: "happy", x: 150, y: 228, s: 120 }); });
    if (x.face) { const ps = x.panel != null ? [c.panels[x.panel]] : c.panels; ps.forEach((p) => { const k = p.chars.find((kk) => !x.who || kk.c === x.who); if (k) k.face = x.face[0]; }); }
    if (x.kind) for (let n = 0; n < x.min; n++) c.panels[x.panels ? x.panels[0] : n % c.panels.length].bubbles.push({ kind: x.kind === "any" ? "say" : x.kind, text: "Hi", x: 150, y: 40, tail: -1 });
    if (x.changes) { const ks = c.panels.map((p) => p.chars.find((k) => k.c === x.changes)).filter(Boolean); if (ks.length) ks[ks.length - 1].face = ks[0].face === "sad" ? "happy" : "sad"; }
    if (x.moves) c.panels[c.panels.length - 1].scene = CS.SCENES.find((s) => s.id !== c.panels[0].scene).id;
  });
  const miss = r.rules.filter((x) => !CS.Comic.passes(x, c));
  if (miss.length) fail(where, "couldn't meet: " + miss.map((x) => x.tip).join(" / "));
})));
CS.QUIZ.forEach((pool, i) => pool.forEach((q) => { if (!(q.right >= 0 && q.right < q.a.length && q.why)) fail("quiz " + (i + 1), q.q); }));
if (CS.JOBS.length !== 3) fail("jobs", "should be 3");
console.log(bad ? `${bad} problem(s)` : `✓ ${rounds} rounds OK`);
process.exit(bad ? 1 : 0);
