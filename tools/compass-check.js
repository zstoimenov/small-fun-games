/* Career Compass - data checks. Run: node tools/compass-check.js              */
/* The quiz must stay fair (every style offered equally often, never against  */
/* itself), and every game must name real styles so none silently drops out. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
// games.js uses top-level const, so pull GAMES out explicitly.
vm.runInContext(fs.readFileSync(path.join(root, "games.js"), "utf8") + "\nwindow.GAMES = GAMES;", sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "career-compass/js/areas.js"), "utf8"), sandbox);
const { AREAS, QUIZ } = sandbox.CC;
const ids = new Set(AREAS.map((a) => a.id));
let bad = 0;
const fail = (m) => { bad++; console.log("✗ " + m); };

const count = {};
QUIZ.forEach((pair, i) => {
  if (pair.length !== 2) fail(`question ${i + 1} needs two choices`);
  if (pair[0].a === pair[1].a) fail(`question ${i + 1} pits a style against itself`);
  pair.forEach((c) => { if (!ids.has(c.a)) fail(`question ${i + 1}: unknown style ${c.a}`); count[c.a] = (count[c.a] || 0) + 1; });
});
AREAS.forEach((a) => {
  if ((count[a.id] || 0) !== 4) fail(`${a.name} is offered ${count[a.id] || 0} times, not 4 (score.js divides by 4)`);
  if (a.jobs.length !== 3) fail(`${a.name} should have 3 jobs`);
});
const covered = new Set();
sandbox.GAMES.forEach((g) => {
  if (!Array.isArray(g.compass)) return fail(`${g.folder} has no compass field`);
  g.compass.forEach((id) => { if (!ids.has(id)) fail(`${g.folder}: unknown style ${id}`); covered.add(id); });
});
AREAS.forEach((a) => { if (!covered.has(a.id)) console.log(`! no game counts towards ${a.name} yet`); });
AREAS.forEach((a) => console.log(`  ${a.emoji} ${a.name}: ${sandbox.GAMES.filter((g) => (g.compass || []).includes(a.id)).map((g) => g.title).join(", ")}`));
console.log(bad ? `${bad} problem(s)` : "✓ compass data OK");
process.exit(bad ? 1 : 0);
