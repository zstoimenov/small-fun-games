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
/*                                                                              */
/* The second pass added one more assertion class, and it is the one that made   */
/* the game followable: a well-played run's own money must go UP, night after    */
/* night, most of the time. See "The shape of a good run" at the bottom.         */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "bank-boss", "js");
const sandbox = { Math, console, JSON };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["rng.js", "bank.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
}
const B = sandbox.window.BB.Bank;
const money = B.money;

// 1,500 is not a round number picked for comfort: the bands below are a few
// percentage points wide, and at 400 runs one of them cries wolf about one time
// in three. A check nobody believes is worse than no check.
const RUNS = Number(process.argv[2]) || 1500;
let assertions = 0, failures = 0;

function ok(cond, what) {
  assertions++;
  if (!cond) { failures++; if (failures < 12) console.log("  ✗ " + what); }
}

/* ── Policies ──────────────────────────────────────────────────────────────
 * A policy answers the two questions the game asks: what rates, and who gets a
 * loan. Everything else is the model. Taking deposits is no longer a decision,
 * so a policy no longer has an opinion about it.
 */

// Keep back what you have already promised somebody — the number the morning
// board prints. This is the rule the game asks a child to follow.
const keepsLine = (run, bank, c) =>
  bank.cash - c.amount >= B.reserveNeeded(run, bank);

const picky = (run, bank, c) => B.person(c.id).star > 1 && keepsLine(run, bank, c);

const POLICIES = {
  // Pay as little as you can, charge as much as you can, lend to anybody.
  gouge: { rates: () => ({ save: 1, loan: 10 }), lend: () => true },
  // Everybody's friend: best rate for savers, cheapest loans, never says no.
  generous: { rates: () => ({ save: 3, loan: 6 }), lend: () => true },
  // Take the deposits and sit on them. A vault full of coins earning nothing,
  // still paying interest out every night.
  hoard: { rates: () => ({ save: 2, loan: 8 }), lend: () => false },
  // Fair rates, but lend every coin to anybody who asks.
  lendAll: { rates: () => ({ save: 2, loan: 8 }), lend: () => true },
  // Fair rates, refuse the risky, keep back what you have promised.
  sensible: { rates: () => ({ save: 2, loan: 8 }), lend: picky },
  // Picky, but pay top rate for deposits.
  buyDeposits: { rates: () => ({ save: 3, loan: 8 }), lend: picky },
  // Picky, and charge the most.
  dear: { rates: () => ({ save: 2, loan: 10 }), lend: picky },
  // Picky, and charge the least.
  cheap: { rates: () => ({ save: 2, loan: 6 }), lend: picky },
  // Only ever lend to somebody with three stars. The safest real strategy in
  // the game: the tightest spread of outcomes and the best worst case, and it
  // gives away some of the top of the ladder to get them.
  only3: {
    rates: () => ({ save: 2, loan: 8 }),
    lend: (run, bank, c) => B.person(c.id).star > 2 && keepsLine(run, bank, c)
  },
  // The save dial used as a tap rather than set once and forgotten: when the
  // vault is full of money with nowhere to go, stop buying more of it. This is
  // the row that decides whether "money asleep costs you" is a lesson a child
  // can act on or just a thing that happens to them.
  tap: {
    rates: (run, bank) => ({ save: B.spare(run, bank) > 12000 ? 1 : 2, loan: 8 }),
    lend: picky
  },
  // Every dollar the vault can spare, lent to anybody who pays their way. This
  // is the ceiling the ladder is set against — a child who has understood the
  // game plays somewhere between only3 and here.
  best: {
    rates: () => ({ save: 2, loan: 8 }),
    lend: (run, bank, c) => B.person(c.id).star > 1 && keepsLine(run, bank, c)
  }
};

/* ── One run ───────────────────────────────────────────────────────────────── */

function play(policy, difficulty, seed, watch) {
  const run = B.newRun(difficulty, seed);
  B.startDay(run);

  const audit = [];
  const verify = (where) => {
    const bad = B.check(run.bank, where === "close");
    ok(!bad, where + ": " + bad);
  };
  verify("start");

  for (;;) {
    const r = policy.rates(run, run.bank);
    B.setRates(run, r.save, r.loan);
    B.openCounter(run);

    let guard = 0;
    for (;;) {
      const c = B.current(run);
      if (!c) break;
      if (++guard > 200) { ok(false, "the counter never emptied"); break; }
      let out = B.serve(run);
      while (out && out.asking) {
        out = B.serve(run, out.canPay && policy.lend(run, run.bank, c) ? "lend" : "no");
      }
      verify("day " + run.day + " counter");
    }

    const rep = B.night(run);
    verify("day " + run.day + " night");

    // The night sum on the screen is arithmetic the child is invited to check,
    // so it had better be arithmetic. Every line of it, against the books.
    ok(rep.kept === rep.interestIn - rep.interestOut - rep.badDebt - rep.fire,
      "day " + run.day + ": the night sum does not add up");
    ok(rep.interestIn === B.nightlyOn(rep.lentOut, rep.loan),
      "day " + run.day + ": interest in is not the rate times what is out on loan");

    if (watch) {
      audit.push({ day: run.day, own: rep.own, cash: rep.cash, out: rep.lentOut,
        owed: rep.deposits, trust: rep.trust, inN: rep.interestIn,
        outN: rep.interestOut, bad: rep.bad.length, kept: rep.kept });
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
const pct = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  return (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
};
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

function sweep(policy, difficulty, runs) {
  const own = [], rung = [], trust = [], bad = [], fires = [];
  for (let i = 0; i < runs; i++) {
    const s = play(POLICIES[policy], difficulty, 1000 + i * 7717);
    own.push(s.own); rung.push(s.rung); trust.push(s.trust);
    bad.push(s.badDebts); fires.push(s.fires ? 1 : 0);
  }
  const q = pct(own);
  return {
    policy, median: median(own), mean: mean(own), worst: q(0.1),
    top: mean(rung.map((r) => (r === 4 ? 1 : 0))),
    any: mean(rung.map((r) => (r >= 1 ? 1 : 0))),
    trust: mean(trust), bad: mean(bad), fires: mean(fires),
    broke: mean(own.map((v) => (v < B.START_OWN ? 1 : 0)))
  };
}

function table(title, rows) {
  console.log("\n" + title);
  console.log("  " + pad("policy", 14) + rpad("median", 9) + rpad("worst 10%", 11) +
    rpad("top rung", 10) + rpad("any rung", 10) + rpad("trust", 7) +
    rpad("bad debt", 10) + rpad("fire sale", 11) + rpad("went backwards", 16));
  for (const r of rows) {
    console.log("  " + pad(r.policy, 14) + rpad(money(r.median), 9) +
      rpad(money(r.worst), 11) +
      rpad((r.top * 100).toFixed(0) + "%", 10) + rpad((r.any * 100).toFixed(0) + "%", 10) +
      rpad(r.trust.toFixed(1), 7) + rpad(money(Math.round(r.bad / 5) * 5), 10) +
      rpad((r.fires * 100).toFixed(0) + "%", 11) +
      rpad((r.broke * 100).toFixed(0) + "%", 16));
  }
}

/* ── The report ────────────────────────────────────────────────────────────── */

console.log("Bank Boss — " + RUNS + " runs per policy\n" + "=".repeat(78));

const order = ["tap", "best", "only3", "sensible", "cheap", "dear", "buyDeposits",
  "lendAll", "generous", "hoard", "gouge"];
const normal = order.map((p) => sweep(p, "normal", RUNS));
table("Normal — 10 days", normal);

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
ok(by.sensible.median > by.dear.median,
  "the dearest rate should lose to the middle one (" + money(by.sensible.median) +
  " vs " + money(by.dear.median) + ")");
ok(by.sensible.median > by.cheap.median,
  "the cheapest rate should lose to the middle one (" + money(by.sensible.median) +
  " vs " + money(by.cheap.median) + ")");
ok(by.sensible.median > by.buyDeposits.median,
  "paying the top rate for money should lose to paying the middle one (" +
  money(by.sensible.median) + " vs " + money(by.buyDeposits.median) + ")");
ok(by.lendAll.bad > by.sensible.bad * 2,
  "lending to anybody should cost a lot more in bad debts");
ok(by.gouge.bad > by.sensible.bad,
  "the dearest rate should attract the worst borrowers (" + money(by.gouge.bad) +
  " vs " + money(by.sensible.bad) + ")");
ok(by.hoard.fires < 0.02, "a bank that never lends should never have to call loans in");
ok(by.lendAll.fires > by.sensible.fires,
  "lending every coin should mean fire sales (" + (by.lendAll.fires * 100).toFixed(0) +
  "% vs " + (by.sensible.fires * 100).toFixed(0) + "%)");
ok(by.tap.top >= 0.18 && by.tap.top <= 0.45,
  "the top rung should land in 18-45% of really well played runs, got " +
  (by.tap.top * 100).toFixed(0) + "%");
ok(by.tap.any >= 0.8,
  "a well-played run should nearly always clear the first rung, got " +
  (by.tap.any * 100).toFixed(0) + "%");

// The cautious strategy must protect you, and carelessness must be far worse
// than either. A child who plays carefully and still loses money most of the
// time has been taught that the game is unfair.
// Being too careful is its own way to lose, and the game is allowed to say so:
// a bank that lends to almost nobody still pays its savers every night. What
// must hold is that it is far safer than carelessness, not that it is free.
ok(by.only3.broke < 0.3,
  "playing it safe should usually keep your money, went backwards " +
  (by.only3.broke * 100).toFixed(0) + "% of the time");
ok(by.best.broke < 0.2, "the good strategy should rarely go backwards, got " +
  (by.best.broke * 100).toFixed(0) + "%");
// The save dial has to be worth touching. If setting it once and forgetting it
// were as good as using it, one of the game's two decisions would be a label.
ok(by.tap.median > by.sensible.median * 1.05,
  "using the save dial as a tap should beat leaving it alone (" +
  money(by.tap.median) + " vs " + money(by.sensible.median) + ")");
ok(by.tap.broke < by.sensible.broke,
  "using the save dial should also make going backwards less likely");
ok(by.lendAll.broke > by.best.broke * 2,
  "lending to anybody should go backwards far more often than being picky (" +
  (by.lendAll.broke * 100).toFixed(0) + "% vs " + (by.best.broke * 100).toFixed(0) + "%)");
ok(by.gouge.broke > by.best.broke, "gouging should be the way to go backwards");
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
  const perNight = (d * 100) / 3.5;   // an average loan runs about 3.5 nights
  console.log("  " + pad("★".repeat(star), 8) + rpad((B.DEFAULT_RATE[star] * 100).toFixed(0) + "%", 18) +
    rpad(perNight.toFixed(1) + "c", 12) +
    rpad((6 - perNight).toFixed(1) + "c", 9) + rpad((8 - perNight).toFixed(1) + "c", 9) +
    rpad((10 - perNight).toFixed(1) + "c", 9));
}
ok(10 - (B.DEFAULT_RATE[1] * (1 - B.RECOVERY[1]) * 100) / 3.5 - 2 < 0,
  "no rate on the dial should make a one-star loan worth taking");
ok(8 - (B.DEFAULT_RATE[3] * (1 - B.RECOVERY[3]) * 100) / 3.5 > 2,
  "a three-star loan at the middle rate should be clearly worth taking");

console.log("\nWho says yes to your loan rate\n" + "-".repeat(78));
console.log("  " + pad("rate", 8) + rpad("★★★", 9) + rpad("★★", 9) + rpad("★", 9) +
  rpad("share of the queue that is ★", 30));
const share = (r) => {
  const w = [3, 2, 1].map((s) => B.ACCEPT[s][r]);
  const mix = [0.45, 0.35, 0.20];
  return (w[2] * mix[2]) / (w[0] * mix[0] + w[1] * mix[1] + w[2] * mix[2]);
};
for (const r of B.LOAN_RATES) {
  const w = [3, 2, 1].map((s) => B.ACCEPT[s][r]);
  console.log("  " + pad(r + "c", 8) + rpad((w[0] * 100).toFixed(0) + "%", 9) +
    rpad((w[1] * 100).toFixed(0) + "%", 9) + rpad((w[2] * 100).toFixed(0) + "%", 9) +
    rpad((share(r) * 100).toFixed(0) + "%", 30));
}
ok(share(10) > share(6) * 1.9,
  "the dearest rate should fill the queue with the people who don't pay back (" +
  (share(6) * 100).toFixed(0) + "% -> " + (share(10) * 100).toFixed(0) + "%)");

/* ── The keep-back number ──────────────────────────────────────────────────── */

console.log("\nKeeping back what you have promised\n" + "-".repeat(78));
for (const [label, p] of [["keeps the line", "sensible"], ["lends every coin", "lendAll"]]) {
  const r = by[p];
  console.log("  " + pad(label, 20) + "fire sale in " + rpad((r.fires * 100).toFixed(0) + "%", 5) +
    " of runs, finishes " + money(r.median));
}

/* ── The shape of a good run ───────────────────────────────────────────────
 * The assertion that the second pass exists for. A child watches one number,
 * and if that number falls while they are playing well, the game is teaching
 * the opposite of what it says. Nightly interest in both directions is what
 * makes this pass; with interest only landing when a loan matured, a well
 * played run fell for the first six of twelve nights and then jumped at the
 * close, and no amount of copy could explain that away.
 */

console.log("\nThe shape of a good run\n" + "-".repeat(78));
{
  let upNights = 0, allNights = 0, everFell = 0, runs = 0;
  const firstHalfUp = [];
  for (let i = 0; i < Math.min(RUNS, 600); i++) {
    const s = play(POLICIES.tap, "normal", 90000 + i * 7717, true);
    let prev = B.START_OWN, up = 0, fell = false;
    for (const row of s.audit) {
      allNights++;
      if (row.own >= prev) { up++; upNights++; } else fell = true;
      prev = row.own;
    }
    const half = s.audit[Math.floor(s.audit.length / 2)];
    firstHalfUp.push(half.own >= B.START_OWN ? 1 : 0);
    if (fell) everFell++;
    runs++;
  }
  console.log("  nights where your own money went up, playing well   " +
    ((upNights / allNights) * 100).toFixed(0) + "%");
  console.log("  runs that are already ahead at halfway              " +
    (mean(firstHalfUp) * 100).toFixed(0) + "%");
  console.log("  runs where it fell on at least one night            " +
    ((everFell / runs) * 100).toFixed(0) + "%");
  ok(upNights / allNights > 0.8,
    "playing well, your own money should go up on most nights, got " +
    ((upNights / allNights) * 100).toFixed(0) + "%");
  ok(mean(firstHalfUp) > 0.8,
    "playing well, you should be ahead by halfway, got " +
    (mean(firstHalfUp) * 100).toFixed(0) + "%");
}

/* ── Every difficulty's ladder ─────────────────────────────────────────────── */

console.log("\nThe prize ladder, per difficulty\n" + "-".repeat(78));
for (const d of Object.keys(B.LEVELS)) {
  const r = sweep("tap", d, Math.min(RUNS, 800));
  const s = sweep("lendAll", d, Math.min(RUNS, 800));
  console.log("  " + pad(d, 9) + "best play " + rpad(money(r.median), 9) +
    " top rung " + rpad((r.top * 100).toFixed(0) + "%", 5) +
    " first rung " + rpad((r.any * 100).toFixed(0) + "%", 5) +
    "  |  careless " + rpad(money(s.median), 9) +
    " top rung " + (s.top * 100).toFixed(0) + "%");
  ok(r.median > s.median, d + ": playing well should beat playing carelessly");
  // The floor, asserted per difficulty rather than trusted. Both settings used
  // to sit under this: the long game cleared its first rung 90% of the time and
  // the SHORT one only 82%, which is the wrong way round for the gentler
  // setting. It was given away once by nobody measuring it; the guard is here so
  // it cannot go quietly a second time.
  ok(r.any >= 0.85, d + ": a good run should nearly always reach the first rung, got " +
    (r.any * 100).toFixed(0) + "%");
  ok(r.top >= 0.2 && r.top <= 0.45,
    d + ": the top rung should land in 20-45% of good runs, got " +
    (r.top * 100).toFixed(0) + "%");
}

/* ── A short game must not be the hard one ─────────────────────────────────── */

// The bug this guard exists for: SHORT sent a smaller queue as well as having
// fewer days, so it made 6.9 loans against the long game's 10.8, and at seven
// loans one bad debt decides the run. Fewer days should be the only thing that
// makes a short game short.
console.log("\nA short game should be the gentler one\n" + "-".repeat(78));
{
  const rows = {};
  for (const d of Object.keys(B.LEVELS)) {
    const r = sweep("tap", d, Math.min(RUNS, 800));
    rows[d] = r;
    console.log("  " + pad(d, 9) + rpad(B.spec(d).days + " days", 9) +
      "  first rung " + rpad((r.any * 100).toFixed(0) + "%", 5) +
      "  finishes behind " + rpad((r.broke * 100).toFixed(0) + "%", 5) +
      "  queue " + B.spec(d).queue.join("-"));
  }
  ok(rows.short.any >= rows.normal.any - 0.06,
    "the short game should not be the harder one to get a rung on (" +
    (rows.short.any * 100).toFixed(0) + "% vs " + (rows.normal.any * 100).toFixed(0) + "%)");
  const q = (d) => B.spec(d).queue.join("-");
  ok(q("short") === q("normal"),
    "both lengths should send the same business a day, got " + q("short") + " and " + q("normal"));
}

/* ── One run played fairly, day by day ─────────────────────────────────────── */

console.log("\nOne run played fairly, day by day\n" + "-".repeat(78));
{
  const s = play(POLICIES.tap, "normal", 424242, true);
  console.log("  " + pad("day", 6) + rpad("in the vault", 14) + rpad("out on loan", 13) +
    rpad("owed to savers", 16) + rpad("yours", 9) + rpad("kept tonight", 14) +
    rpad("trust", 7));
  for (const r of s.audit) {
    console.log("  " + pad(r.day, 6) + rpad(money(r.cash), 14) + rpad(money(r.out), 13) +
      rpad(money(r.owed), 16) + rpad(money(r.own), 9) + rpad(money(r.kept), 14) +
      rpad(r.trust, 7));
  }
}

/* ── Money ─────────────────────────────────────────────────────────────────── */

console.log("\nMoney\n" + "-".repeat(78));
{
  let worst = 0;
  for (const bal of [1000, 2500, 3333, 7777, 12345, 50000]) {
    for (const r of B.SAVE_RATES.concat(B.LOAN_RATES)) {
      worst = Math.max(worst, Math.abs(B.nightlyOn(bal, r) - (bal * r) / 100));
    }
  }
  ok(worst <= 2.5, "interest rounding is never more than 2.5c out, got " + worst);
  console.log("  interest rounding is never more than " + worst.toFixed(1) + "c out");

  // Quoted two ways on the loan card — a night at a time and the whole run of
  // nights — and a child is entitled to find that those two agree.
  let drift = 0;
  for (const amount of B.BORROWS) {
    for (const r of B.LOAN_RATES) {
      for (let n = 2; n <= 5; n++) {
        drift = Math.max(drift, Math.abs(B.interestOver(amount, r, n) - B.nightlyOn(amount, r) * n));
      }
    }
  }
  ok(drift <= 10, "the two quotes on a loan card agree to within 10c, got " + drift);
  console.log("  a night at a time and the whole loan agree to within " + drift + "c");
}

console.log("\n" + "=".repeat(78));
console.log(assertions.toLocaleString() + " assertions, " + failures + " failed");
process.exit(failures ? 1 : 0);
