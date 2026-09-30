/* Little City - level checks. Run: node tools/city-check.js                   */
/* Each build round has a worked answer below: the check proves the round     */
/* starts unsolved, that the answer uses only its tools and passes every      */
/* rule, and that the map choose rounds really have one right plan.           */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "little-city", "js");
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["sim.js", "levels.js"]) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
const LC = sandbox.LC, Sim = LC.Sim;
let bad = 0, rounds = 0;
const fail = (where, m) => { bad++; console.log("✗ " + where + ": " + m); };
const R = (pts) => pts.map(([x, y]) => ["road", x, y]);

// "chapter.level.round": [[type | "remove", x, y], ...]
const SOLUTIONS = {
  "1.1.2": R([[1, 2], [2, 2], [3, 2], [4, 2]]),
  "1.2.1": [["house", 1, 1], ["house", 2, 1], ["house", 3, 1]],
  "1.3.1": R([[1, 2], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4], [4, 5], [5, 5], [6, 5], [6, 4], [6, 3]]),
  "1.4.1": [["remove", 3, 1], ...R([[3, 1], [3, 2], [1, 2], [4, 4]])],
  "2.1.1": [["school", 3, 1]],
  "2.2.1": [["clinic", 4, 3]],
  "2.3.1": [["factory", 4, 1]],
  "3.1.1": [["house", 2, 1], ["house", 4, 1], ["house", 2, 3], ["house", 4, 3], ["park", 3, 1], ["school", 3, 3]],
  "3.2.1": [["house", 2, 1], ["house", 4, 1], ["school", 3, 1], ["clinic", 3, 3]],
  "3.4.1": [...R([[1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3]]), ["flats", 1, 2], ["flats", 2, 2], ["flats", 3, 2], ["school", 4, 2], ["clinic", 1, 4], ["shop", 2, 4], ["fire", 3, 4]]
};

function mapOk(where, rows) {
  if (rows.some((r) => r.length !== rows[0].length)) fail(where, "map rows differ in length");
  if (!rows.some((r) => r.includes("E"))) fail(where, "map has no road out of town (E)");
}

LC.CHAPTERS.forEach((ch) => ch.levels.forEach((lv, li) => lv.rounds.forEach((r, ri) => {
  rounds++;
  const tag = `${ch.id}.${li + 1}.${ri + 1}`, where = `${ch.name} ${tag}`;
  if (r.kind === "choose") {
    if (r.options.filter((o) => o.ok).length !== 1) fail(where, "needs exactly one right option");
    if (r.options.some((o) => o.map)) {
      r.options.forEach((o) => mapOk(where, o.map));
      // Map questions are about coverage or noise: only the right plan may pass.
      const needs = /fire/.test(r.q) ? ["fire"] : ["noise"];
      r.options.forEach((o) => {
        const st = Sim.evaluate(Sim.parse(o.map), needs);
        if (st.allHappy !== !!o.ok) fail(where, `${o.t} is ${st.allHappy ? "fine" : "not fine"} but marked ${o.ok ? "right" : "wrong"}`);
      });
    }
    return;
  }
  mapOk(where, r.map);
  r.rules.forEach((x) => { if (!x.tip) fail(where, "every rule needs a tip"); if ((x.budget || x.balance) && r.money == null) fail(where, "money rule without a budget"); });
  const g = Sim.parse(r.map);
  if (r.rules.every((x) => Sim.check(x, Sim.evaluate(g, r.needs), r))) fail(where, "starts already solved");
  const sol = SOLUTIONS[tag];
  if (!sol) return fail(where, "no worked answer in SOLUTIONS");
  sol.forEach(([t, x, y]) => {
    const c = g[y] && g[y][x];
    if (t === "remove") { if (!r.tools.includes("bulldoze")) fail(where, "answer bulldozes without the tool"); if (!c || c.fixed) fail(where, `can't bulldoze (${x},${y})`); g[y][x] = null; return; }
    if (!r.tools.includes(t)) fail(where, "answer uses " + t + " which isn't offered");
    if (c) fail(where, `(${x},${y}) is already taken`);
    g[y][x] = { t };
  });
  if (r.limits) Object.keys(r.limits).forEach((t) => { if (g.flat().filter((c) => c && c.t === t && !c.fixed).length > r.limits[t]) fail(where, "answer goes over the " + t + " limit"); });
  const st = Sim.evaluate(g, r.needs);
  const miss = r.rules.filter((x) => !Sim.check(x, st, r));
  if (miss.length) fail(where, "answer fails: " + miss.map((x) => x.tip).join(" / ") + ` (people ${st.people}, happy ${st.happy}, cost ${st.cost}, balance ${st.balance})`);
})));
LC.QUIZ.forEach((pool, i) => pool.forEach((q) => { if (!(q.right >= 0 && q.right < q.a.length && q.why)) fail("quiz " + (i + 1), q.q); }));
if (LC.JOBS.length !== 3) fail("jobs", "should be 3");
console.log(bad ? `${bad} problem(s)` : `✓ ${rounds} rounds OK`);
process.exit(bad ? 1 : 0);
