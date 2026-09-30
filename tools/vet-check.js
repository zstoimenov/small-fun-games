/* Vet Clinic - checks the cases before a kid sees them.                       */
/*                                                                              */
/* cases.js is pure data, so plain node can load it. For every case: each of   */
/* the seven checks has a finding, at least one is the `key` clue and shows as */
/* not normal, every number sits against the right animal's range, and every   */
/* question has three answers, a valid right one and a reason. The heartbeat  */
/* and thermometer games are checked against the vet's chart too.              */
/*                                                                              */
/*   node tools/vet-check.js                                                    */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sandbox = { Math, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "vet-clinic", "js", "cases.js"), "utf8"), sandbox, { filename: "cases.js" });
const VC = sandbox.window.VC;

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log("  FAIL " + msg); } };
const question = (id, q) => {
  ok(q && q.a && q.a.length === 3, id + " needs three answers");
  ok(q && q.a[q.right] != null, id + " has no right answer");
  ok(q && q.why && q.why.length > 15, id + " has no reason");
};

VC.CHAPTERS.forEach((ch) => ch.levels.forEach((lv, i) => {
  const id = ch.id + "-" + i;
  console.log(id + " " + lv.name + " (" + lv.kind + ")");
  ok(lv.win && lv.win.length > 10, id + " has no win line");
  if (lv.kind === "heart") {
    lv.rounds.forEach((sp) => ok(lv.choices.indexOf(sp) >= 0, id + " round " + sp + " isn't one of the choices"));
    // The middles have to be far enough apart to tell by ear.
    const mids = lv.choices.map((sp) => (VC.NORMAL[sp].heart[0] + VC.NORMAL[sp].heart[1]) / 2).sort((a, b) => a - b);
    mids.slice(1).forEach((m, k) => ok(m / mids[k] >= 1.5, id + " heartbeats " + mids[k] + " and " + m + " are too close to hear apart"));
    return;
  }
  if (lv.kind === "temp") {
    const kinds = new Set(lv.rounds.map((r) => {
      const [lo, hi] = VC.NORMAL[r.sp].temp;
      return r.v > hi ? "hot" : r.v < lo ? "cold" : "ok";
    }));
    ok(kinds.size === 3, id + " should have normal, hot and cold patients");
    const same = {};
    lv.rounds.forEach((r) => { (same[r.v] = same[r.v] || []).push(r.sp); });
    ok(Object.values(same).some((s) => s.length > 1), id + " should show one number that's normal for one animal and not another");
    return;
  }
  VC.TOOLS.forEach((t) => ok(lv.checks[t.id], id + " has no " + t.id + " finding"));
  const healthy = lv.dx.a[lv.dx.right].indexOf("healthy") >= 0;
  const keys = Object.keys(lv.checks).filter((k) => lv.checks[k].key);
  ok(healthy || keys.length >= 1, id + " has no key clue");
  keys.forEach((k) => ok(VC.isBad(lv.checks[k]), id + " key clue " + k + " reads as normal"));
  if (healthy) ok(!Object.values(lv.checks).some((r) => !r.waste && VC.isBad(r)), id + " is healthy but a check reads not normal");
  Object.entries(lv.checks).forEach(([k, r]) => {
    ok(r.t || r.num, id + " " + k + " says nothing");
    if (r.num) ok(lv.sp && r.num.range === VC.NORMAL[lv.sp][k === "heart" ? "heart" : "temp"], id + " " + k + " is against the wrong animal's range");
    ok(!(r.waste && r.key), id + " " + k + " can't be the key and not needed");
  });
  ok(Object.values(lv.checks).filter((r) => r.waste).length <= 1, id + " has more than one wasted check");
  ["dx", "tx", "care"].forEach((q) => question(id + " " + q, lv[q]));
}));
VC.QUIZ.forEach((pool, p) => pool.forEach((q, k) => question("quiz " + p + "." + k, q)));
ok(VC.CHAPTERS.some((c) => /wildlife/i.test(c.name)), "needs the Australian wildlife chapter");

console.log(fails ? fails + " failure(s)" : "all good");
process.exit(fails ? 1 : 0);
