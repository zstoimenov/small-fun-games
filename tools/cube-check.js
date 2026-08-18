/* Cube Timer — the checker.                                                     */
/*                                                                              */
/* scramble.js and stats.js never touch the page, so plain node can load them   */
/* and prove the parts that a screenshot cannot: that a turn actually turns the  */
/* right stickers, and that an average of five is the competition's average of   */
/* five and not the mean of five.                                               */
/*                                                                              */
/*   node tools/cube-check.js                                                    */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "cube-timer", "js");
const sandbox = { Math, console, crypto };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["scramble.js", "stats.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
}
const S = sandbox.window.CT.Scramble;
const St = sandbox.window.CT.Stats;

let pass = 0, fail = 0;
function ok(cond, what) {
  if (cond) { pass++; return; }
  fail++;
  console.log("  FAIL  " + what);
}
function eq(a, b, what) { ok(a === b, what + "  (got " + a + ", wanted " + b + ")"); }
function section(name) { console.log("\n" + name); }

const state = (cube) => JSON.stringify(S.grids(cube));
const isSolved = (cube) => {
  const g = S.grids(cube);
  return S.FACES.every((f) => g[f].every((row) => row.every((c) => c === f)));
};
const parse = (s) => s.trim().split(/\s+/).filter(Boolean);
const run = (size, alg) => S.apply(S.solved(size), parse(alg));
const invert = (alg) => parse(alg).reverse().map((m) =>
  m.endsWith("2") ? m : m.endsWith("'") ? m.slice(0, -1) : m + "'").join(" ");

/* ── The cube turns ────────────────────────────────────────────────────── */
section("Turning the cube");

for (const size of [2, 3, 4]) {
  ok(isSolved(S.solved(size)), size + "x" + size + " starts solved");
  for (const m of ["U", "D", "L", "R", "F", "B"]) {
    ok(isSolved(run(size, [m, m, m, m].join(" "))), size + "x" + size + ": " + m + " four times comes home");
    ok(!isSolved(run(size, m)), size + "x" + size + ": " + m + " actually changes something");
    ok(isSolved(run(size, m + " " + m + "'")), size + "x" + size + ": " + m + " then " + m + "' undoes it");
    ok(isSolved(run(size, m + "2 " + m + "2")), size + "x" + size + ": " + m + "2 twice comes home");
  }
}

// Wide moves: two layers, and only on the big cube.
for (const m of ["Uw", "Dw", "Lw", "Rw", "Fw", "Bw"]) {
  ok(isSolved(run(4, [m, m, m, m].join(" "))), "4x4: " + m + " four times comes home");
  ok(state(run(4, m)) !== state(run(4, m[0])), "4x4: " + m + " moves more than " + m[0] + " does");
}
// On a 4x4 the outer layer plus the inner one is exactly the wide move.
ok(state(run(4, "Rw")) !== state(run(4, "R")), "4x4: Rw and R are different turns");
// Two layers of a 2x2 would be the whole cube, so a 2x2 never offers them.
ok(S.PUZZLES["2x2"].moves.every((m) => m.indexOf("w") < 0), "2x2 has no wide moves");

// A long algorithm and its inverse must cancel exactly.
const algs = [
  "R U R' U'", "F R U R' U' F'", "R U R' U R U2 R'",
  "R U2 R' U' R U' R'", "L' U2 L U L' U L", "B D2 B' L F2 L' D B2"
];
for (const a of algs) ok(isSolved(run(3, a + " " + invert(a))), "3x3: " + a + " then its inverse");
ok(isSolved(run(4, "Rw U Rw' F2 Lw D " + invert("Rw U Rw' F2 Lw D"))), "4x4: wide alg then its inverse");

// The sexy move six times over is a whole-cube identity — the classic check
// that the corner AND edge cycles are both right, not just the face grid.
ok(isSolved(run(3, "R U R' U' ".repeat(6))), "3x3: (R U R' U') six times is solved");
ok(isSolved(run(2, "R U R' U' ".repeat(6))), "2x2: (R U R' U') six times is solved");
// A U turn on its own has an order of four; a U-perm-ish pair takes longer.
ok(!isSolved(run(3, "R U R' U' ".repeat(3))), "3x3: (R U R' U') three times is NOT solved");

/* ── Which stickers moved ──────────────────────────────────────────────── */
section("Where the stickers went");

// U clockwise takes the front face's top row round to the left. Seen from the
// front that means F's top row is wearing R's colour afterwards.
{
  const g = S.grids(run(3, "U"));
  eq(g.F[0].join(""), "RRR", "U: the front's top row comes from the right");
  eq(g.L[0].join(""), "FFF", "U: the left's top row comes from the front");
  eq(g.B[0].join(""), "LLL", "U: the back's top row comes from the left");
  eq(g.R[0].join(""), "BBB", "U: the right's top row comes from the back");
  eq(g.U.map((r) => r.join("")).join(""), "UUUUUUUUU", "U: the top face keeps its colour");
  eq(g.D.map((r) => r.join("")).join(""), "DDDDDDDDD", "U: the bottom face is untouched");
}
// R clockwise lifts the front up: U's right column comes from the front.
{
  const g = S.grids(run(3, "R"));
  eq(g.U.map((r) => r[2]).join(""), "FFF", "R: the top's right column comes from the front");
  eq(g.F.map((r) => r[2]).join(""), "DDD", "R: the front's right column comes from the bottom");
  eq(g.B.map((r) => r[0]).join(""), "UUU", "R: the back's left column comes from the top");
  eq(g.D.map((r) => r[2]).join(""), "BBB", "R: the bottom's right column comes from the back");
}
// F clockwise: the top's bottom row swings to the right face.
{
  const g = S.grids(run(3, "F"));
  eq(g.U[2].join(""), "LLL", "F: the top's front row comes from the left");
  eq(g.R.map((r) => r[0]).join(""), "UUU", "F: the right's front column comes from the top");
}
// The centre of a face never moves on an odd cube — that is what makes the
// colour scheme fixed, and it is worth knowing the model agrees.
{
  const g = S.grids(run(3, S.generate("3x3").join(" ")));
  for (const f of S.FACES) eq(g[f][1][1], f, "3x3: the " + f + " centre stays put through a scramble");
}
// Nothing is ever created or destroyed: nine of each colour, always.
for (const size of [2, 3, 4]) {
  const g = S.grids(S.scrambled(size === 2 ? "2x2" : size === 3 ? "3x3" : "4x4",
    S.generate(size === 2 ? "2x2" : size === 3 ? "3x3" : "4x4")));
  const count = {};
  for (const f of S.FACES) for (const row of g[f]) for (const c of row) count[c] = (count[c] || 0) + 1;
  ok(S.FACES.every((f) => count[f] === size * size),
    size + "x" + size + ": every colour still appears " + size * size + " times after a scramble");
}

/* ── The scrambles themselves ──────────────────────────────────────────── */
section("The scrambles");

const AXIS = { U: "y", D: "y", R: "x", L: "x", F: "z", B: "z" };
for (const id of S.ORDER) {
  const p = S.PUZZLES[id];
  let sameFace = 0, tripleAxis = 0, badMove = 0, shortOne = 0;
  const faceUse = {}, suffixUse = { "": 0, "'": 0, "2": 0 };
  for (let i = 0; i < 4000; i++) {
    const sc = S.generate(id);
    if (sc.length !== p.length) shortOne++;
    for (let j = 0; j < sc.length; j++) {
      const m = sc[j];
      const base = m.replace(/['2]$/, "");
      if (p.moves.indexOf(base) < 0) badMove++;
      faceUse[base] = (faceUse[base] || 0) + 1;
      suffixUse[/['2]$/.test(m) ? m.slice(-1) : ""]++;
      if (j > 0 && sc[j - 1][0] === m[0]) sameFace++;
      if (j > 1 && AXIS[sc[j - 2][0]] === AXIS[m[0]] && AXIS[sc[j - 1][0]] === AXIS[m[0]]
          && sc[j - 2][0] === m[0]) tripleAxis++;
    }
  }
  eq(shortOne, 0, id + ": every scramble is " + p.length + " moves");
  eq(badMove, 0, id + ": every move is one this puzzle has");
  eq(sameFace, 0, id + ": never the same face twice running");
  eq(tripleAxis, 0, id + ": never the same face again one move later on the same axis");
  // Rough fairness. Each face should turn up about as often as the others.
  const uses = p.moves.map((m) => faceUse[m] || 0);
  const lo = Math.min.apply(null, uses), hi = Math.max.apply(null, uses);
  ok(hi / lo < 1.15, id + ": the faces come up about equally (" + lo + "–" + hi + ")");
  const sfx = [suffixUse[""], suffixUse["'"], suffixUse["2"]];
  ok(Math.max.apply(null, sfx) / Math.min.apply(null, sfx) < 1.1,
    id + ": plain, prime and double turns come up about equally");
  // A scramble has to actually scramble.
  ok(!isSolved(S.scrambled(id, S.generate(id))), id + ": a scramble leaves the cube unsolved");
  // Two scrambles running should not be the same one.
  ok(S.generate(id).join(" ") !== S.generate(id).join(" "), id + ": two scrambles differ");
}
eq(S.inGroups("a b c d e f g".split(" "), 5).length, 2, "moves come out in rows of five");

/* ── The numbers ───────────────────────────────────────────────────────── */
section("Times and averages");

const solve = (ms, penalty) => ({ ms: ms, penalty: penalty || "", scramble: [], at: 0 });

eq(St.format(0), "0.00", "zero");
eq(St.format(9999), "9.99", "just under ten seconds");
eq(St.format(12999), "12.99", "hundredths are truncated, not rounded");
eq(St.format(60000), "1:00.00", "a minute");
eq(St.format(83450), "1:23.45", "over a minute");
eq(St.format(null), "DNF", "a DNF says so");
eq(St.formatRunning(12999), "12.9", "the running clock shows tenths");
eq(St.formatRunning(65400), "1:05.4", "the running clock past a minute");

eq(St.effective(solve(10000)), 10000, "a clean solve is worth its time");
eq(St.effective(solve(10000, "+2")), 12000, "a +2 adds two seconds");
eq(St.effective(solve(10000, "dnf")), null, "a DNF is worth nothing");

const five = [solve(10000), solve(12000), solve(14000), solve(16000), solve(30000)];
eq(St.best(five), 10000, "best of five");
eq(St.worst(five), 30000, "worst of five");
eq(St.ao5(five), 14000, "ao5 drops the 10 and the 30 and means the rest");
eq(St.mean(five), 16400, "the session mean keeps everything");
eq(St.ao5(five.slice(0, 4)), undefined, "no ao5 until there are five solves");
eq(St.ao12(five), undefined, "no ao12 until there are twelve");

const withDnf = [solve(10000), solve(12000), solve(14000), solve(16000), solve(0, "dnf")];
eq(St.ao5(withDnf), 14000, "one DNF is the worst time, so it is the one dropped");
const twoDnf = [solve(10000), solve(12000), solve(14000), solve(0, "dnf"), solve(0, "dnf")];
eq(St.ao5(twoDnf), null, "two DNFs make the whole average a DNF");
eq(St.best(twoDnf), 10000, "a DNF never counts as a best time");
eq(St.mean([solve(0, "dnf")]), null, "a mean of nothing but DNFs is nothing");

const plusTwo = [solve(10000), solve(12000), solve(14000), solve(16000), solve(9000, "+2")];
// 9.00 + 2 = 11.00, so the five are 10, 11, 12, 14, 16 and the middle three stand.
eq(Math.round(St.ao5(plusTwo)), 12333, "the +2 is counted before the average is trimmed");
eq(St.best(plusTwo), 10000, "a 9.00 with a +2 is an 11.00, so it is not the best");

const twelve = [];
for (let i = 1; i <= 12; i++) twelve.push(solve(i * 1000));
eq(St.ao12(twelve), 6500, "ao12 drops the 1 and the 12");

ok(St.isPersonalBest(five, 0), "the fastest solve is the personal best");
ok(!St.isPersonalBest(five, 4), "the slowest is not");
ok(!St.isPersonalBest([solve(10000), solve(10000)], 1),
  "a tie is not a new best — the party only starts for a real one");
ok(!St.isPersonalBest([solve(9000, "dnf")], 0), "a DNF is never a personal best");

const bars = St.bars(five, 5);
eq(bars.length, 5, "one bar per solve");
ok(bars[0].h < bars[4].h, "the quick solve draws a shorter bar than the slow one");
ok(St.bars([solve(0, "dnf"), solve(10000)], 5)[0].dnf, "a DNF bar is flagged as one");
eq(St.bars([], 5).length, 0, "no solves, no bars");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
