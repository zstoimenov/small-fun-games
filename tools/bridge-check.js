/* Bridge Builder - drives trucks over bridges with no browser.                */
/*                                                                              */
/* physics.js and levels.js are pure, so plain node can load them. Part one    */
/* tunes the physics against the ideas the chapters teach (a long plank snaps, */
/* a pillar saves it, squares fold, triangles hold). Part two builds a written */
/* solution for every level and checks it holds, that the starting bridge      */
/* does NOT, and that the solution uses exactly `par` pieces. Part three does */
/* the same for the Bridge Trail (trail.js), where par is coins on a budget.  */
/*                                                                              */
/*   node tools/bridge-check.js                                                 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "bridge-builder", "js");
const sandbox = { Math, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["physics.js", "levels.js", "trail.js"]) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, "utf8"), sandbox, { filename: f });
}
const BB = sandbox.window.BB;
const Ph = BB.Physics;

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log("  FAIL " + msg); } };

// Drive `truck` from the left bank to the right. Returns how it went.
function drive(members, anchors, banks, truck, extraLoads) {
  const ms = members.map((m) => Object.assign({}, m));
  let peak = 0, broke = [];
  for (let x = banks[0] - 1; x <= banks[1] + 1; x += 0.05) {
    const t = Ph.truckLoads(ms, 0, banks, truck, x);
    if (t.air) return { held: false, at: x, peak, broke, why: "fell" };
    const res = Ph.settle(ms, anchors, t.loads);
    broke = broke.concat(res.broke);
    ms.forEach((m) => { if (!m.gone) peak = Math.max(peak, m.strain); });
    const t2 = Ph.truckLoads(ms, 0, banks, truck, x);
    if (t2.air) return { held: false, at: x, peak, broke, why: "road broke" };
  }
  return { held: true, peak, broke };
}

const M = (a, b, mat) => ({ a: a.join(","), b: b.join(","), mat: mat || "beam" });
function roadAcross(L, R) { const out = []; for (let x = L; x < R; x++) out.push(M([x, 0], [x + 1, 0], "road")); return out; }
const anchorsFor = (L, R, extra) => [[L, 0], [R, 0], [L, 1], [R, 1]].concat(extra || []).map((p) => p.join(","));

function report(name, r, expect) {
  console.log("  " + (r.held ? "holds" : "FAILS") + "  peak " + r.peak.toFixed(2) + "  " + name + (r.held ? "" : " (" + r.why + " at x=" + r.at.toFixed(2) + ")"));
  if (expect != null) ok(r.held === expect, name + " should " + (expect ? "hold" : "fail"));
}

console.log("physics");
report("gap 2, road only, car", drive(roadAcross(0, 2), anchorsFor(0, 2), [0, 2], "car"), true);
report("gap 2, road only, truck", drive(roadAcross(0, 2), anchorsFor(0, 2), [0, 2], "truck"), true);
report("gap 4, road only, car", drive(roadAcross(0, 4), anchorsFor(0, 4), [0, 4], "car"), false);
const pillar = roadAcross(0, 4).concat([M([2, 2], [2, 1]), M([2, 1], [2, 0])]);
report("gap 4, road + pillar, car", drive(pillar, anchorsFor(0, 4, [[2, 2]]), [0, 4], "car"), true);
report("gap 4, road + pillar, truck", drive(pillar, anchorsFor(0, 4, [[2, 2]]), [0, 4], "truck"), null);
// Squares over the top: posts at every deck joint and a top chord.
const squares = roadAcross(0, 4);
for (let x = 0; x <= 4; x++) squares.push(M([x, 0], [x, -1]));
for (let x = 0; x < 4; x++) squares.push(M([x, -1], [x + 1, -1]));
report("gap 4, squares over, car", drive(squares, anchorsFor(0, 4), [0, 4], "car"), false);
// The same squares with a diagonal in each: triangles.
const tri = squares.concat([M([0, 0], [1, -1]), M([1, -1], [2, 0]), M([2, 0], [3, -1]), M([3, -1], [4, 0])]);
report("gap 4, triangles over, car", drive(tri, anchorsFor(0, 4), [0, 4], "car"), true);
report("gap 4, triangles over, truck", drive(tri, anchorsFor(0, 4), [0, 4], "truck"), true);
report("gap 4, triangles over, big", drive(tri, anchorsFor(0, 4), [0, 4], "big"), null);
// A lean truss: no posts on the banks, no top chord beyond the triangles.
const lean = roadAcross(0, 4).concat([M([0, 0], [1, -1]), M([1, -1], [2, 0]), M([2, 0], [3, -1]), M([3, -1], [4, 0]),
  M([1, -1], [2, -1]), M([2, -1], [3, -1]), M([1, -1], [1, 0]), M([3, -1], [3, 0])]);
report("gap 4, lean truss, truck", drive(lean, anchorsFor(0, 4), [0, 4], "truck"), null);
// Truss underneath, hung off the bank faces.
const under = roadAcross(0, 4).concat([M([0, 1], [1, 1]), M([1, 1], [2, 1]), M([2, 1], [3, 1]), M([3, 1], [4, 1]),
  M([0, 0], [1, 1]), M([1, 1], [2, 0]), M([2, 0], [3, 1]), M([3, 1], [4, 0]), M([1, 1], [1, 0]), M([3, 1], [3, 0])]);
report("gap 4, truss under, truck", drive(under, anchorsFor(0, 4), [0, 4], "truck"), null);

// ── Every level ────────────────────────────────────────────────────────────
// Pieces the kid places, as "x,y x,y material".
const SOLUTIONS = {
  "1-0": ["0,0 1,0 road", "1,0 2,0 road"],
  "1-1": ["0,0 1,0 road", "1,0 2,0 road", "2,0 3,0 road", "3,0 4,0 road", "2,2 2,1 beam", "2,1 2,0 beam"],
  "1-2": ["0,0 1,0 road", "1,0 2,0 road", "2,0 3,0 road", "3,0 4,0 road", "4,0 5,0 road", "5,0 6,0 road", "2,1 2,0 beam", "4,1 4,0 beam"],
  "2-0": ["0,0 1,-1 beam", "3,-1 4,0 beam"],
  "2-1": ["0,0 1,-1 beam", "1,-1 2,0 beam", "2,0 3,-1 beam", "3,-1 4,0 beam", "1,-1 2,-1 beam", "2,-1 3,-1 beam", "2,-1 2,0 beam"],
  "2-2": ["1,0 0,1 beam", "3,0 4,1 beam"],
  "3-0": ["0,0 1,-1 steel", "1,-1 2,-1 steel", "2,-1 3,-1 steel", "3,-1 4,0 steel",
          "1,-1 1,0 beam", "2,-1 2,0 beam", "3,-1 3,0 beam", "1,-1 2,0 beam", "3,-1 2,0 beam"],
  "3-1": ["3,2 3,1 beam", "3,1 3,0 beam", "1,0 0,1 beam", "5,0 6,1 beam"],
  "3-2": ["0,0 1,-1 steel", "5,-1 6,0 steel", "1,-1 2,-1 steel", "2,-1 3,-1 steel", "3,-1 4,-1 steel", "4,-1 5,-1 steel",
          "1,-1 1,0 beam", "2,-1 2,0 beam", "3,-1 3,0 beam", "4,-1 4,0 beam", "5,-1 5,0 beam",
          "1,-1 2,0 beam", "2,-1 3,0 beam", "4,-1 3,0 beam", "5,-1 4,0 beam"]
};
const parse = (s) => { const [a, b, mat] = s.split(" "); return { a, b, mat }; };

if (BB.CHAPTERS) {
  console.log("levels");
  BB.CHAPTERS.forEach((ch) => ch.levels.forEach((lv, i) => {
    const id = ch.id + "-" + i;
    const base = lv.parts.map(parse);
    const A = Ph.anchors(lv);
    const empty = drive(base, A, [0, lv.gap], lv.truck);
    ok(!empty.held, id + " holds before the kid builds anything");
    const sol = (SOLUTIONS[id] || []).map(parse);
    ok(sol.length, id + " has no solution written");
    const inv = Object.assign({}, lv.inv);
    const seen = new Set(base.map((m) => Ph.key(m.a, m.b)));
    sol.forEach((m) => {
      const why = Ph.canJoin(lv, m.a, m.b, m.mat);
      ok(!why, id + " " + m.a + "-" + m.b + ": " + why);
      ok(!seen.has(Ph.key(m.a, m.b)), id + " " + m.a + "-" + m.b + " is already there");
      seen.add(Ph.key(m.a, m.b));
      ok((inv[m.mat] || 0) > 0, id + " runs out of " + m.mat);
      inv[m.mat]--;
    });
    ok(sol.length === lv.par, id + " par is " + lv.par + " but the solution uses " + sol.length);
    const r = drive(base.concat(sol), A, [0, lv.gap], lv.truck);
    report(id + " " + lv.name + " (" + lv.truck + ")", r, true);
  }));
}

// ── The Bridge Trail ───────────────────────────────────────────────────────
// The same truck drive, but every Trail rule counts: ground and islands,
// snow, the convoy behind the first truck.
function driveLevel(lv, members) {
  const ms = members.map((m) => Object.assign({}, m));
  const A = Ph.anchors(lv);
  let peak = 0;
  for (let x = -1; x <= Ph.finishX(lv); x += 0.05) {
    const t = Ph.loadsAt(lv, ms, lv.truck, x);
    if (t.air) return { held: false, at: x, peak, why: "fell" };
    const res = Ph.settle(ms, A, t.loads);
    if (res.broke.length) return { held: false, at: x, peak, why: res.broke[0].gone + " " + res.broke[0].a + "-" + res.broke[0].b };
    ms.forEach((m) => { if (!m.gone) peak = Math.max(peak, m.strain); });
  }
  return { held: true, peak };
}

// TRAIL SOLUTIONS START (written by the level lab; one real design per level)
const TRAIL_SOLUTIONS = {
  "t1-0": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "2,1 3,1 beam",
    "1,0 0,1 steel",
    "1,0 2,1 beam",
    "3,0 2,1 beam",
    "3,0 3,1 beam",
    "4,0 3,1 beam"
  ],
  "t1-1": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "2,1 3,1 beam",
    "1,0 0,1 steel",
    "1,0 1,1 beam",
    "1,1 2,1 beam",
    "2,0 1,1 beam",
    "3,0 2,1 beam",
    "3,0 3,1 beam",
    "4,0 3,1 beam"
  ],
  "t1-2": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "3,0 4,1 beam",
    "1,0 0,1 beam",
    "4,0 3,1 beam",
    "3,1 4,1 beam",
    "3,1 3,2 beam",
    "4,1 3,2 beam"
  ],
  "t1-3": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "2,-1 3,-1 beam",
    "2,-1 1,0 beam",
    "2,-1 2,0 beam",
    "3,-1 4,-1 beam",
    "3,-1 4,0 beam",
    "4,-1 5,0 beam",
    "4,-1 4,0 beam",
    "1,0 0,1 steel",
    "5,0 6,1 steel"
  ],
  "t1-4": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "6,0 7,0 road",
    "0,0 1,1 beam",
    "1,0 0,1 beam",
    "1,0 1,1 beam",
    "2,0 1,1 steel",
    "2,0 3,1 beam",
    "3,0 3,1 beam",
    "3,0 4,1 beam",
    "4,0 4,1 beam",
    "4,0 5,1 beam",
    "5,0 5,1 beam",
    "6,0 5,1 steel",
    "6,0 6,1 beam",
    "6,0 7,1 steel",
    "0,1 1,1 steel",
    "3,1 4,1 beam",
    "4,1 5,1 beam",
    "5,1 6,1 beam",
    "6,1 7,1 steel"
  ],
  "t2-0": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "3,1 4,2 beam",
    "2,0 3,1 beam",
    "4,0 3,1 beam"
  ],
  "t2-1": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "1,-1 2,-1 beam",
    "1,-1 0,0 beam",
    "1,-1 2,0 beam",
    "2,-1 3,0 beam",
    "3,-1 4,-1 beam",
    "3,-1 2,0 beam",
    "2,-1 3,-1 beam",
    "4,-1 3,0 beam",
    "4,-1 5,0 beam"
  ],
  "t2-2": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "1,0 0,1 steel",
    "1,0 2,1 beam",
    "2,0 1,1 beam",
    "3,0 2,1 beam",
    "3,0 4,1 beam",
    "5,0 4,1 beam",
    "5,0 6,1 beam",
    "6,0 5,1 beam",
    "0,1 1,1 beam",
    "1,1 2,1 beam",
    "4,1 5,1 beam",
    "5,1 6,1 beam"
  ],
  "t2-3": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "0,0 1,1 steel",
    "2,0 1,1 beam",
    "2,0 3,1 beam",
    "3,0 2,1 beam",
    "3,0 4,1 beam",
    "4,0 3,1 beam",
    "5,0 4,1 beam",
    "5,0 5,1 beam",
    "6,0 5,1 steel",
    "1,1 2,1 steel",
    "2,1 3,1 steel",
    "3,1 4,1 steel",
    "4,1 5,1 beam"
  ],
  "t2-4": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "6,0 7,0 road",
    "0,0 1,1 steel",
    "1,0 1,1 beam",
    "2,0 3,1 beam",
    "3,0 3,1 beam",
    "4,0 5,1 beam",
    "5,0 5,1 beam",
    "5,0 6,1 steel",
    "6,0 5,1 beam",
    "7,0 6,1 beam",
    "1,1 2,1 beam",
    "1,1 2,2 beam",
    "2,1 3,1 beam",
    "3,1 3,2 beam",
    "5,1 4,2 beam",
    "5,1 5,2 beam",
    "5,1 6,2 beam",
    "6,1 5,2 beam",
    "6,1 7,2 steel",
    "3,2 4,2 beam",
    "2,2 3,2 beam",
    "2,2 3,3 beam",
    "3,2 3,3 beam",
    "4,2 3,3 beam",
    "5,2 6,2 beam",
    "1,0 2,1 beam",
    "6,2 7,2 beam"
  ],
  "t3-0": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "1,0 0,1 steel",
    "1,0 1,1 beam",
    "2,0 1,1 beam",
    "4,0 5,1 beam",
    "5,0 5,1 steel",
    "5,0 6,1 steel",
    "6,0 5,1 beam",
    "0,1 1,1 beam"
  ],
  "t3-1": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "2,-1 3,-1 beam",
    "2,-1 1,0 beam",
    "2,-1 3,0 beam",
    "3,-1 4,-1 beam",
    "3,-1 4,0 beam",
    "4,-1 5,-1 beam",
    "4,-1 3,0 beam",
    "5,-1 4,0 beam",
    "5,-1 6,0 beam",
    "1,0 0,1 steel"
  ],
  "t3-2": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "6,0 7,0 road",
    "7,0 8,0 road",
    "0,0 1,1 beam",
    "1,0 1,1 beam",
    "3,0 2,1 steel",
    "7,0 6,1 beam",
    "7,0 7,1 beam",
    "5,0 5,1 beam",
    "8,0 7,1 beam",
    "0,1 1,1 steel",
    "1,1 2,1 beam",
    "1,1 2,2 beam",
    "2,1 2,2 beam",
    "5,1 6,1 beam",
    "5,1 6,2 beam",
    "6,1 7,1 beam"
  ],
  "t3-3": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "6,0 7,0 road",
    "2,-1 2,0 beam",
    "1,-1 2,-1 beam",
    "1,-1 0,0 beam",
    "1,-1 2,0 beam",
    "2,-1 3,-1 beam",
    "3,-1 4,-1 beam",
    "3,-1 3,0 beam",
    "4,-1 5,-1 beam",
    "4,-1 4,0 beam",
    "5,-1 4,0 beam",
    "5,-1 6,0 beam",
    "6,0 6,1 beam",
    "6,0 7,1 beam",
    "7,0 6,1 beam",
    "6,1 7,1 beam"
  ],
  "t3-4": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "6,0 7,0 road",
    "7,0 8,0 road",
    "1,0 1,1 beam",
    "2,-1 3,-1 beam",
    "2,-1 1,0 beam",
    "2,-1 2,0 beam",
    "3,-1 4,-1 steel",
    "3,-1 2,0 beam",
    "3,-1 4,0 beam",
    "4,-1 5,-1 steel",
    "4,-1 4,0 beam",
    "4,-1 5,0 beam",
    "5,-1 6,-1 steel",
    "5,-1 6,0 beam",
    "6,-1 5,0 beam",
    "6,-1 6,0 beam",
    "6,-1 7,0 steel",
    "0,0 1,1 beam",
    "1,0 0,1 steel",
    "2,0 1,1 beam",
    "7,0 8,1 steel",
    "0,1 1,1 steel"
  ],
  "t4-0": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "0,0 1,1 beam",
    "1,0 0,1 beam",
    "2,0 1,1 beam",
    "2,0 3,1 beam",
    "3,0 2,1 beam",
    "3,0 4,1 beam",
    "1,0 2,1 beam",
    "4,0 5,1 beam",
    "5,0 4,1 beam",
    "0,1 1,1 beam",
    "1,1 2,1 beam",
    "2,1 3,1 beam",
    "3,1 4,1 beam"
  ],
  "t4-1": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "1,-1 0,0 old",
    "1,-1 1,0 old",
    "1,-1 2,0 old",
    "1,0 0,1 beam",
    "1,0 1,1 old",
    "2,0 1,1 old",
    "2,0 2,1 old",
    "2,0 3,1 old",
    "3,0 2,1 old",
    "3,0 3,1 old",
    "3,0 4,1 beam",
    "4,0 3,1 old",
    "1,1 2,1 old"
  ],
  "t4-2": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "0,2 1,1 beam",
    "1,1 2,0 beam",
    "5,2 4,1 beam",
    "4,1 3,0 beam",
    "0,0 1,1 old",
    "5,0 4,1 old",
    "2,0 3,1 old",
    "2,0 2,1 old",
    "3,0 3,1 old",
    "2,1 3,1 old",
    "1,1 2,1 old",
    "4,1 3,1 old"
  ],
  "t5-0": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "0,-2 1,0 rope",
    "4,-2 3,0 rope"
  ],
  "t5-1": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "0,-2 1,0 rope",
    "0,-2 3,0 rope"
  ],
  "t5-2": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "5,0 6,0 road",
    "0,-2 1,0 rope",
    "0,-2 2,0 rope",
    "6,-2 4,0 rope",
    "6,-2 5,0 rope"
  ],
  "t6-0": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "5,0 6,0 road",
    "6,0 7,0 road",
    "7,0 8,0 road",
    "2,0 3,1 beam",
    "6,0 5,1 beam"
  ],
  "t6-1": [
    "0,0 1,0 road",
    "1,0 2,0 road",
    "2,0 3,0 road",
    "3,0 4,0 road",
    "4,0 5,0 road",
    "1,0 0,1 steel",
    "1,0 1,1 beam",
    "2,0 1,1 beam",
    "4,0 5,1 beam",
    "0,1 1,1 beam"
  ]
};
// TRAIL SOLUTIONS END

if (BB.TRAIL) {
  console.log("bridge trail");
  BB.TRAIL.forEach((w) => w.levels.forEach((lv, i) => {
    const id = w.id + "-" + i;
    const base = lv.parts.map(parse);
    ok(!driveLevel(lv, base).held, id + " holds before the kid builds anything");
    const sol = (TRAIL_SOLUTIONS[id] || []).map(parse);
    ok(sol.length, id + " has no solution written");
    const inv = Object.assign({}, lv.inv);
    const seen = new Set(base.map((m) => Ph.key(m.a, m.b)));
    sol.forEach((m) => {
      const why = Ph.canJoin(lv, m.a, m.b, m.mat);
      ok(!why, id + " " + m.a + "-" + m.b + ": " + why);
      ok(!seen.has(Ph.key(m.a, m.b)), id + " " + m.a + "-" + m.b + " is already there");
      seen.add(Ph.key(m.a, m.b));
      ok((inv[m.mat] || 0) > 0, id + " runs out of " + m.mat);
      inv[m.mat]--;
    });
    const n = lv.budget != null ? Ph.cost(sol) : sol.length;
    ok(n === lv.par, id + " par is " + lv.par + " but the solution " + (lv.budget != null ? "costs " : "uses ") + n);
    if (lv.budget != null) ok(Ph.cost(sol) <= lv.budget, id + " solution is over budget");
    const r = driveLevel(lv, base.concat(sol));
    console.log("  " + (r.held ? "holds" : "FAILS") + "  peak " + r.peak.toFixed(2) + "  " + id + " " + lv.name + " (" + lv.truck + (lv.convoy ? "+" + lv.convoy.join("+") : "") + ")" + (r.held ? "" : " " + r.why));
    ok(r.held, id + " solution should hold");
  }));
}

module.exports = { drive, driveLevel, M, roadAcross, anchorsFor, report, ok };
if (require.main === module) {
  console.log(fails ? fails + " failure(s)" : "all good");
  process.exit(fails ? 1 : 0);
}
