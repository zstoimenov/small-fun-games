/* Bank Boss — the balancing harness.                                           */
/*                                                                              */
/* bank.js is pure, so plain node can load it and play thousands of runs in a    */
/* second. Nothing here ships to the browser: this is how the numbers in bank.js */
/* get chosen, and how a change to one of them gets checked against the others.  */
/*                                                                              */
/*   node tools/bank-check.js            the whole report                       */
/*   node tools/bank-check.js 3000       with a different number of runs        */
/*                                                                              */
/* The balance rule is asserted after EVERY event in EVERY run, not sampled.     */
/* It is the one identity the game is about, so it is the one thing that must    */
/* never be true only most of the time.                                         */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "bank-boss", "js");
const sandbox = { Math, console, JSON };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["rng.js", "bank.js", "rival.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
}
const B = sandbox.window.BB.Bank;
const Rival = sandbox.window.BB.Rival;
const money = B.money;

// 1,500 is not a round number picked for comfort: the bands below are a few
// percentage points wide, and at 400 runs one of them cries wolf about one time
// in three. Deal or No Deal's fairness panel taught this — a check nobody
// believes is worse than no check.
const RUNS = Number(process.argv[2]) || 1500;
let assertions = 0, failures = 0;

function ok(cond, what) {
  assertions++;
  if (!cond) { failures++; if (failures < 12) console.log("  ✗ " + what); }
}

/* ── Policies ──────────────────────────────────────────────────────────────
 * A policy answers the two questions the game asks: what rates, and who gets a
 * loan. Everything else is the model.
 */

const reserveKeeper = (run, bank, c) =>
  bank.cash - c.amount >= B.reserveNeeded(bank);

const picky = (run, bank, c) => B.person(c.id).star > 1 && reserveKeeper(run, bank, c);
// Take money you can put to work; turn away money that would only cost you.
const roomFor = (run, bank) => B.spare(bank) < 8000;
const takeAll = () => true;

const POLICIES = {
  // Pay as little as you can, charge as much as you can, lend to anybody.
  gouge: { rates: () => ({ save: 1, loan: 10 }), lend: () => true, take: takeAll },
  // Everybody's friend: best rate for savers, cheapest loans, never says no.
  generous: { rates: () => ({ save: 3, loan: 6 }), lend: () => true, take: takeAll },
  // Take the deposits and sit on them. A vault full of coins earning nothing,
  // still paying interest out every night.
  hoard: { rates: () => ({ save: 2, loan: 8 }), lend: () => false, take: takeAll },
  // Fair rates, but lend every coin to anybody who asks.
  lendAll: { rates: () => ({ save: 2, loan: 8 }), lend: () => true, take: takeAll },
  // Fair rates, refuse the risky, keep the keep-back line.
  sensible: { rates: () => ({ save: 2, loan: 8 }), lend: picky, take: takeAll },
  // Picky, but pay top rate for deposits.
  buyDeposits: { rates: () => ({ save: 3, loan: 8 }), lend: picky, take: takeAll },
  // Picky, and charge the most.
  dear: { rates: () => ({ save: 2, loan: 10 }), lend: picky, take: takeAll },
  // Picky, and charge the least.
  cheap: { rates: () => ({ save: 2, loan: 6 }), lend: picky, take: takeAll },
  // Only ever lend to somebody with three stars. A real strategy rather than a
  // careful version of the last one: it finishes with the tightest spread of
  // outcomes in the game and the best worst-case, and it gives away the top of
  // the ladder to do it.
  only3: {
    rates: () => ({ save: 2, loan: 8 }),
    lend: (run, bank, c) => B.person(c.id).star > 2 && reserveKeeper(run, bank, c),
    take: roomFor
  },
  // Fair rates, lend to anybody who pays their way, keep the line, and turn away
  // money the vault has no use for. Nothing here is beyond a child who has
  // understood the game, which is why the top rung is set against this row.
  best: { rates: () => ({ save: 2, loan: 8 }), lend: picky, take: roomFor }
};

/* ── One run ───────────────────────────────────────────────────────────────── */

function play(policy, difficulty, seed, level, watch) {
  const run = B.newRun(difficulty, seed, "solo");
  run.robotLevel = level || "medium";
  B.startDay(run);

  const audit = [];
  const verify = (where) => {
    for (const bank of run.banks) {
      const bad = B.check(bank, where === "close");
      ok(!bad, where + ": " + bad);
    }
  };
  verify("start");

  for (;;) {
    const r = policy.rates(run, run.banks[0]);
    B.setRates(run, 0, r.save, r.loan);
    Rival.takeMorning(run);
    B.openCounter(run);

    let guard = 0;
    for (;;) {
      const c = B.current(run);
      if (!c) break;
      if (++guard > 200) { ok(false, "the counter never emptied"); break; }
      let out = B.serve(run);
      while (out && out.asking) {
        const bank = run.banks[out.bank];
        if (out.kind === "save") {
          out = B.serve(run, policy.take(run, bank, c) ? "take" : "no");
        } else {
          out = B.serve(run, out.canPay && policy.lend(run, bank, c) ? "lend" : "no");
        }
      }
      verify("day " + run.day + " counter");
    }

    const rep = B.night(run);
    verify("day " + run.day + " night");
    if (watch) {
      const a = run.banks[0];
      audit.push({ day: run.day, own: a.own, cash: a.cash, out: a.loansOut,
        owed: a.deposits, trust: a.trust, inN: rep.banks[0].interestIn,
        outN: rep.banks[0].interestOut, bad: rep.banks[0].bad.length });
    }
    if (!B.nextDay(run)) break;
    verify("day " + run.day + " morning");
  }
  verify("close");
  const s = B.summary(run);
  s.audit = audit;
  s.run = run;
  return s;
}

/* ── Reporting ─────────────────────────────────────────────────────────────── */

const median = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

function sweep(policy, difficulty, runs, level) {
  const own = [], rung = [], trust = [], bad = [], fires = [], beat = [];
  for (let i = 0; i < runs; i++) {
    const s = play(POLICIES[policy], difficulty, 1000 + i * 7717, level);
    own.push(s.own); rung.push(s.rung); trust.push(s.trust);
    bad.push(s.badDebts); fires.push(s.fires ? 1 : 0); beat.push(s.won ? 1 : 0);
  }
  return {
    policy, median: median(own), mean: mean(own),
    top: mean(rung.map((r) => (r === 4 ? 1 : 0))),
    any: mean(rung.map((r) => (r >= 1 ? 1 : 0))),
    trust: mean(trust), bad: mean(bad), fires: mean(fires), beat: mean(beat),
    broke: mean(own.map((v) => (v < B.START_OWN ? 1 : 0)))
  };
}

function table(title, rows) {
  console.log("\n" + title);
  console.log("  " + pad("policy", 14) + rpad("median", 9) + rpad("top rung", 10) +
    rpad("any rung", 10) + rpad("trust", 7) + rpad("bad debt", 10) +
    rpad("fire sale", 11) + rpad("beat rival", 12) + rpad("went backwards", 16));
  for (const r of rows) {
    console.log("  " + pad(r.policy, 14) + rpad(money(r.median), 9) +
      rpad((r.top * 100).toFixed(0) + "%", 10) + rpad((r.any * 100).toFixed(0) + "%", 10) +
      rpad(r.trust.toFixed(1), 7) + rpad(money(Math.round(r.bad / 5) * 5), 10) +
      rpad((r.fires * 100).toFixed(0) + "%", 11) + rpad((r.beat * 100).toFixed(0) + "%", 12) +
      rpad((r.broke * 100).toFixed(0) + "%", 16));
  }
}

/* ── The report ────────────────────────────────────────────────────────────── */

console.log("Bank Boss — " + RUNS + " runs per policy\n" + "=".repeat(78));

const order = ["best", "only3", "sensible", "cheap", "dear", "buyDeposits", "lendAll", "generous", "hoard", "gouge"];
const normal = order.map((p) => sweep(p, "normal", RUNS, "medium"));
table("Normal, against a Medium rival", normal);

const by = {};
for (const r of normal) by[r.policy] = r;

/* ── What the sweep has to show ────────────────────────────────────────────── */

console.log("\nWhat the numbers have to say\n" + "-".repeat(78));

// The peak is in the middle on both dials, and neither edge is free.
ok(by.sensible.median > by.gouge.median,
  "charging the most should lose to a fair rate (" + money(by.sensible.median) +
  " vs " + money(by.gouge.median) + ")");
ok(by.sensible.median > by.generous.median,
  "giving it all away should lose to a fair rate (" + money(by.sensible.median) +
  " vs " + money(by.generous.median) + ")");
ok(by.sensible.median > by.hoard.median,
  "refusing every loan should lose (" + money(by.sensible.median) + " vs " +
  money(by.hoard.median) + ")");
ok(by.sensible.median > by.lendAll.median,
  "lending to anybody who asks should lose to being picky (" + money(by.sensible.median) +
  " vs " + money(by.lendAll.median) + ")");
ok(by.best.median > by.sensible.median,
  "turning away money you cannot lend should beat taking every last cent (" +
  money(by.best.median) + " vs " + money(by.sensible.median) + ")");
ok(by.lendAll.bad > by.sensible.bad * 2,
  "lending to anybody should cost a lot more in bad debts");
ok(by.gouge.bad > by.sensible.bad,
  "the dearest rate should attract the worst borrowers (" + money(by.gouge.bad) +
  " vs " + money(by.sensible.bad) + ")");
ok(by.hoard.fires < 0.02, "a bank that never lends should never have to call loans in");
ok(by.lendAll.fires > by.sensible.fires,
  "lending every coin should mean fire sales (" + (by.lendAll.fires * 100).toFixed(0) +
  "% vs " + (by.sensible.fires * 100).toFixed(0) + "%)");
ok(by.best.top >= 0.18 && by.best.top <= 0.45,
  "the top rung should land in 18-45% of really good runs, got " +
  (by.best.top * 100).toFixed(0) + "%");
ok(by.best.any >= 0.65,
  "a well-played run should usually clear the first rung, got " +
  (by.best.any * 100).toFixed(0) + "%");

// A bank that lends money can lose money, and this game does not pretend
// otherwise — but the two things it must get right are that the CAUTIOUS
// strategy protects you and that carelessness is far worse than either.
// Lending only to three-star people finishes behind where it started about one
// run in six; lending to anybody who asks, about seven in ten.
ok(by.only3.broke < 0.25,
  "playing it safe should usually keep your money, went backwards " +
  (by.only3.broke * 100).toFixed(0) + "% of the time");
ok(by.best.broke < 0.35, "even the greedier good strategy should usually keep its money");
ok(by.lendAll.broke > by.best.broke * 2,
  "lending to anybody should go backwards far more often than being picky (" +
  (by.lendAll.broke * 100).toFixed(0) + "% vs " + (by.best.broke * 100).toFixed(0) + "%)");
ok(by.gouge.broke > by.best.broke,
  "gouging should be the way to go backwards");
ok(by.only3.bad < by.sensible.bad / 2,
  "refusing everybody but three-star borrowers should roughly halve the bad debts");
ok(by.best.trust > by.gouge.trust,
  "looking after people should win more of the town than gouging does");

/* ── The one-star trap ─────────────────────────────────────────────────────── */

console.log("\nWhat a star is worth, per dollar lent per night\n" + "-".repeat(78));
console.log("  " + pad("stars", 8) + rpad("goes wrong", 18) + rpad("costs you", 12) +
  rpad("at 6c", 9) + rpad("at 8c", 9) + rpad("at 10c", 9));
for (const star of [3, 2, 1]) {
  const d = B.DEFAULT_RATE[star] * (1 - B.RECOVERY[star]);
  const perNight = (d * 100) / 4.5;   // an average loan runs about 4.5 nights
  console.log("  " + pad("★".repeat(star), 8) + rpad((B.DEFAULT_RATE[star] * 100).toFixed(0) + "%", 18) +
    rpad(perNight.toFixed(1) + "c", 12) +
    rpad((6 - perNight).toFixed(1) + "c", 9) + rpad((8 - perNight).toFixed(1) + "c", 9) +
    rpad((10 - perNight).toFixed(1) + "c", 9));
}
ok(10 - (B.DEFAULT_RATE[1] * (1 - B.RECOVERY[1]) * 100) / 4.5 - 2 < 0,
  "no rate on the dial should make a one-star loan worth taking");
ok(8 - (B.DEFAULT_RATE[3] * (1 - B.RECOVERY[3]) * 100) / 4.5 > 2,
  "a three-star loan at the middle rate should be clearly worth taking");

console.log("\nWho says yes to your loan rate\n" + "-".repeat(78));
console.log("  " + pad("rate", 8) + rpad("★★★", 9) + rpad("★★", 9) + rpad("★", 9) +
  rpad("share of the queue that is ★", 30));
for (const r of B.LOAN_RATES) {
  const w = [3, 2, 1].map((s) => B.ACCEPT[s][r]);
  const mix = [0.45, 0.35, 0.20];
  const total = w[0] * mix[0] + w[1] * mix[1] + w[2] * mix[2];
  console.log("  " + pad(r + "c", 8) + rpad((w[0] * 100).toFixed(0) + "%", 9) +
    rpad((w[1] * 100).toFixed(0) + "%", 9) + rpad((w[2] * 100).toFixed(0) + "%", 9) +
    rpad(((w[2] * mix[2]) / total * 100).toFixed(0) + "%", 30));
}
{
  const share = (r) => {
    const w = [3, 2, 1].map((s) => B.ACCEPT[s][r]);
    const mix = [0.45, 0.35, 0.20];
    return (w[2] * mix[2]) / (w[0] * mix[0] + w[1] * mix[1] + w[2] * mix[2]);
  };
    ok(share(10) > share(6) * 1.9,
    "the dearest rate should fill the queue with the people who don't pay back (" +
    (share(6) * 100).toFixed(0) + "% -> " + (share(10) * 100).toFixed(0) + "%)");
}

/* ── The keep-back line ────────────────────────────────────────────────────── */

console.log("\nThe keep-back line\n" + "-".repeat(78));
const lines = [
  ["keeps the line", "sensible"],
  ["lends every coin", "lendAll"]
];
for (const [label, p] of lines) {
  const r = by[p];
  console.log("  " + pad(label, 20) + "fire sale in " + rpad((r.fires * 100).toFixed(0) + "%", 5) +
    " of runs, finishes " + money(r.median));
}

/* ── The difficulty ladder is the rival, and only the rival ────────────────── */

console.log("\nThe same play against each rival\n" + "-".repeat(78));
console.log("  " + pad("rival", 10) + rpad("you finish", 12) + rpad("you beat them", 15) +
  rpad("they finish", 13));
for (const level of ["easy", "medium", "hard"]) {
  const own = [], beat = [], theirs = [];
  for (let i = 0; i < Math.min(RUNS, 600); i++) {
    const s = play(POLICIES.sensible, "normal", 5000 + i * 7717, level);
    own.push(s.own); beat.push(s.won ? 1 : 0); theirs.push(s.rival);
  }
  console.log("  " + pad(level, 10) + rpad(money(median(own)), 12) +
    rpad((mean(beat) * 100).toFixed(0) + "%", 15) + rpad(money(median(theirs)), 13));
  by["rival_" + level] = { own: median(own), beat: mean(beat), theirs: median(theirs) };
}
ok(by.rival_easy.beat > by.rival_hard.beat,
  "a harder rival should be harder to beat (" + (by.rival_easy.beat * 100).toFixed(0) +
  "% vs " + (by.rival_hard.beat * 100).toFixed(0) + "%)");
ok(by.rival_hard.theirs > by.rival_easy.theirs,
  "a harder rival should make more money than an easy one");

/* ── Every difficulty's ladder ─────────────────────────────────────────────── */

console.log("\nThe prize ladder, per difficulty\n" + "-".repeat(78));
for (const d of ["easy", "normal", "tricky"]) {
  const r = sweep("best", d, Math.min(RUNS, 800), "medium");
  const s = sweep("lendAll", d, Math.min(RUNS, 800), "medium");
  console.log("  " + pad(d, 9) + "best play " + rpad(money(r.median), 9) +
    " top rung " + rpad((r.top * 100).toFixed(0) + "%", 6) +
    " first rung " + rpad((r.any * 100).toFixed(0) + "%", 6) +
    "  |  careless " + rpad(money(s.median), 9) + " top rung " +
    (s.top * 100).toFixed(0) + "%");
  ok(r.median > s.median, d + ": playing well should beat playing carelessly");
  ok(r.any > 0.65, d + ": a well-played run should usually clear the first rung");
}

/* ── One run, day by day ───────────────────────────────────────────────────── */

console.log("\nOne run played fairly, day by day\n" + "-".repeat(78));
{
  const s = play(POLICIES.sensible, "normal", 424242, "medium", true);
  console.log("  " + pad("day", 5) + rpad("in the vault", 14) + rpad("out on loan", 13) +
    rpad("owed to savers", 16) + rpad("yours", 9) + rpad("trust", 7) +
    rpad("paid out", 10) + rpad("earned", 8));
  for (const a of s.audit) {
    console.log("  " + pad(a.day, 5) + rpad(money(a.cash), 14) + rpad(money(a.out), 13) +
      rpad(money(a.owed), 16) + rpad(money(a.own), 9) + rpad(a.trust, 7) +
      rpad(money(a.outN), 10) + rpad(money(a.inN), 8));
  }
  // Growth has to still be happening on the last day. Lemonade Stand's eighth
  // pass is the whole reason this row is here: a business that plateaus halfway
  // through leaves the back half of the run with nothing to decide.
  const half = s.audit[Math.floor(s.audit.length / 2)];
  // The last day but one. On the final night every loan has come back and every
  // saver has been paid, by design — the run ends with the books straight — so
  // the closing row is all zeroes and says nothing about growth.
  const end = s.audit[s.audit.length - 2];
  ok(end.owed > half.owed * 1.15,
    "the deposit base should still be growing in the second half (" + money(half.owed) +
    " -> " + money(end.owed) + ")");
  ok(end.trust > half.trust, "trust should still be climbing in the second half (" +
    half.trust + " -> " + end.trust + ")");
}

/* ── Rounding ──────────────────────────────────────────────────────────────── */

console.log("\nMoney\n" + "-".repeat(78));
{
  let worst = 0;
  for (let c = 0; c < 20000; c += 5) {
    for (const r of B.SAVE_RATES) {
      const i = B.interestOn(c, r);
      ok(i % 5 === 0, "interest is not 5c-clean: " + i);
      worst = Math.max(worst, Math.abs(i - (c * r) / 100));
    }
  }
  console.log("  interest rounding is never more than " + worst.toFixed(1) + "c out");
  ok(worst <= 2.5, "rounding drifts more than half a nickel");

  for (const a of B.BORROWS) {
    for (const r of B.LOAN_RATES) {
      for (let n = 2; n <= 7; n++) {
        const rep = B.repayFor(a, r, n);
        ok(rep % 5 === 0, "a repayment is not 5c-clean: " + rep);
        ok(rep > a, "a loan should always come back bigger than it went out");
      }
    }
  }
  console.log("  every repayment on the dial is 5c-clean and bigger than the loan");
}

/* ── Verdict ───────────────────────────────────────────────────────────────── */

console.log("\n" + "=".repeat(78));
console.log(assertions.toLocaleString() + " assertions, " + failures + " failed");
process.exit(failures ? 1 : 0);
