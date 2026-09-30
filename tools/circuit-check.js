/* Circuit Lab - plays a real solution to every level.                         */
/*                                                                              */
/* circuit.js and levels.js are pure, so plain node can load them. For each    */
/* level this checks that the starting board is NOT already won, that the      */
/* solution below IS won, and that it takes exactly `par` moves, so the star   */
/* thresholds can't drift from the levels. Then a few sums that the chapters   */
/* lean on: series is dim, parallel is bright, a short is a short.             */
/*                                                                              */
/*   node tools/circuit-check.js                                                */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "circuit-lab", "js");
const sandbox = { Math, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["circuit.js", "levels.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
}
const { Circuit: C, CHAPTERS, THINGS } = sandbox.window.CL;

// A move is [key, type] to place, [key, null] to remove. Switches are all
// flipped on at the end, which isn't a move.
const SOLUTIONS = {
  "1-0": [["v:3:0", "wire"], ["h:1:2", "wire"]],
  "1-1": [["v:0:1", "wire"], ["h:0:2", "wire"], ["h:1:2", "wire"], ["h:0:0", "wire"],
          ["h:1:0", "wire"], ["h:2:0", "wire"], ["v:3:0", "wire"], ["v:3:1", "wire"]],
  "1-2": [["h:1:2", "switch"], ["v:3:1", "wire"]],
  "1-3": [["h:0:0", "wire"], ["h:1:0", "wire"], ["h:2:0", "wire"], ["h:3:0", "switch"]],
  "2-0": [["h:1:0", "bulb"], ["h:1:2", "bulb"]],
  "2-1": [["v:1:0", "bulb"], ["v:2:0", "bulb"], ["h:0:0", "wire"], ["h:1:0", "wire"], ["h:0:1", "wire"], ["h:1:1", "wire"]],
  "2-2": [["v:1:0", "switch"], ["v:1:1", "bulb"], ["v:3:0", "switch"], ["v:3:1", "bulb"]],
  "2-3": [["v:0:0", "battery"]],
  "3-0": THINGS.map((t) => ["h:1:2", t]),
  "3-1": [["h:1:2", "key"], ["v:3:0", "clip"]],
  "3-2": [["h:2:0", "pencil"]],
  "3-3": [["v:1:0", null]]
};

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log("  FAIL " + msg); } };

function board(lv) {
  const parts = {};
  Object.entries(lv.parts || {}).forEach(([k, t]) => { parts[k] = { type: t, locked: true, on: false }; });
  Object.entries(lv.loose || {}).forEach(([k, t]) => { parts[k] = { type: t, on: false }; });
  return parts;
}
function check(lv, parts, tested) {
  const res = C.settle(lv.grid, parts);
  return C.goal(lv.goal, lv.grid, parts, res, { tested });
}

CHAPTERS.forEach((ch) => ch.levels.forEach((lv, i) => {
  const id = ch.id + "-" + i;
  console.log(id + " " + lv.name);
  const parts = board(lv);
  const inv = Object.assign({}, lv.inv);
  const tested = {};
  ok(!check(lv, parts, tested).ok, "already won before any move");
  const sol = SOLUTIONS[id];
  ok(sol, "no solution written");
  if (!sol) return;
  const keys = C.edges(lv.grid);
  sol.forEach(([k, t]) => {
    ok(keys.indexOf(k) >= 0, k + " is not on the board");
    ok(!lv.open || lv.open.indexOf(k) >= 0, k + " is not an open spot");
    const p = parts[k];
    ok(!(p && p.locked), k + " is glued down");
    if (p) inv[p.type] = (inv[p.type] || 0) + 1;
    if (t == null) { delete parts[k]; return; }
    ok((inv[t] || 0) > 0, "no " + t + " left for " + k);
    inv[t]--;
    parts[k] = { type: t, on: false };
    if (lv.test === k) tested[t] = C.verdict(C.settle(lv.grid, parts).level["h:1:0"] || 0);
  });
  Object.values(parts).forEach((p) => { if (p.type === "switch") p.on = true; });
  const g = check(lv, parts, tested);
  ok(g.ok, "solution doesn't win" + (g.hint ? " (" + g.hint + ")" : ""));
  ok(sol.length === lv.par, "par is " + lv.par + " but the solution takes " + sol.length);
  if (id === "3-0") console.log("  " + JSON.stringify(tested));
}));

// ── The sums the chapters rely on ──────────────────────────────────────────
console.log("physics");
const G = { cols: 4, rows: 3 };
const lvl = (parts, k) => C.solve(G, parts).level[k];
const P = (o) => Object.fromEntries(Object.entries(o).map(([k, t]) => [k, { type: t, on: true }]));
const RING = ["h:0:0", "h:1:0", "h:2:0", "v:3:0", "v:3:1", "h:2:2", "h:1:2", "h:0:2", "v:0:1", "v:0:0"];
const ring = (over) => P(Object.fromEntries(RING.map((k) => [k, over[k] || "wire"])));
const one = lvl(ring({ "v:0:1": "battery", "h:1:0": "bulb" }), "h:1:0");
const series = lvl(ring({ "v:0:1": "battery", "h:1:0": "bulb", "h:1:2": "bulb" }), "h:1:0");
const par2 = P({ "v:0:0": "battery", "v:1:0": "bulb", "v:2:0": "bulb", "h:0:0": "wire", "h:1:0": "wire", "h:0:1": "wire", "h:1:1": "wire" });
const parallel = lvl(par2, "v:2:0");
const two = lvl(ring({ "v:0:1": "battery", "v:0:0": "battery", "h:1:0": "bulb" }), "h:1:0");
console.log("  one bulb " + one.toFixed(2) + ", series " + series.toFixed(2) + ", parallel " + parallel.toFixed(2) + ", two batteries " + two.toFixed(2));
ok(one > 0.9 && one <= 1, "one bulb on one battery should be ~1");
ok(C.on(series) && series < C.BRIGHT, "series should be lit but dim");
ok(parallel >= C.BRIGHT, "parallel should be bright");
ok(two >= C.SUPER && two < C.BLOW, "two batteries should be super but not pop");
const three = { cols: 4, rows: 4 };
const tp = {};
["h:0:0", "h:1:0", "h:2:0", "v:3:0", "v:3:1", "v:3:2", "h:2:3", "h:1:3", "h:0:3"].forEach((k) => { tp[k] = { type: "wire" }; });
tp["h:1:0"] = { type: "bulb" };
["v:0:0", "v:0:1", "v:0:2"].forEach((k) => { tp[k] = { type: "battery" }; });
const r3 = C.settle(three, tp);
ok(r3.popped.length === 1, "three batteries should pop the bulb");
const sh = ring({ "v:0:1": "battery", "h:1:0": "bulb" });
sh["v:1:0"] = { type: "wire" }; sh["v:1:1"] = { type: "wire" };
const rs = C.solve(G, sh);
ok(rs.short, "a wire across the battery should be a short");
ok(!C.on(rs.level["h:1:0"]), "a shorted bulb should be dark");
console.log("  short: battery " + Math.abs(rs.cur["v:0:1"]).toFixed(1) + " A");

console.log(fails ? fails + " failure(s)" : "all good");
process.exit(fails ? 1 : 0);
