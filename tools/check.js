/* Lemonade Stand — the balancing harness.                                      */
/*                                                                              */
/* economy.js is pure, so plain node can load it and play tens of thousands of  */
/* fortnights in a second. Nothing here ships to the browser; this is how the   */
/* numbers in economy.js get chosen, and how a change to one of them gets       */
/* checked against the others.                                                  */
/*                                                                              */
/*   node tools/check.js            the whole report                            */
/*   node tools/check.js 5000       with a different number of runs             */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "lemonade-stand", "js");
// The game files write `window.LS` and then read bare `LS`, which only works
// where window IS the global — so give them a context that says so.
const sandbox = { Math, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["rng.js", "economy.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
}
const E = sandbox.window.LS.Economy;
const R = sandbox.window.LS.Rng;
const money = E.money;

/* ── Policies ──────────────────────────────────────────────────────────────
 * A policy answers the two questions the morning asks: how many cups, and at
 * what price. `plan` returns the number of cups it WANTS; the driver buys as
 * close to that as packs and money allow.
 */

// What the morning can honestly estimate: the forecast's footfall at this
// price, plus the regulars who are likely to show up.
function expected(run, info, priceCents) {
  const tier = E.priceTier(priceCents);
  const pass = E.WEATHER[info.forecast].footfall * tier.pull;
  return pass + E.regularsExpected(run.regulars, info.forecast, priceCents);
}

const POLICIES = {
  // The complaint under test: fill the stall, every single day.
  max: { price: () => 75, plan: () => E.STALL_LIMIT },
  // Fill the stall but never borrow to do it.
  greedy: { price: () => 75, plan: () => E.STALL_LIMIT },
  // Buy what the forecast says you can sell.
  forecast: { price: () => 75, plan: (run, info) => Math.round(expected(run, info, 75)) },
  // Buy a bit under the forecast — the newsvendor answer when cups are dear.
  tight: { price: () => 75, plan: (run, info) => Math.round(expected(run, info, 75) * 0.8) },
  // Never adapt: the same modest stall whatever the sky is doing.
  flat: { price: () => 75, plan: () => 15 },
  // Cheap and cheerful.
  cheap: { price: () => 50, plan: (run, info) => Math.round(expected(run, info, 50)) },
  // Charge as much as you can get away with.
  dear: { price: () => 100, plan: (run, info) => Math.round(expected(run, info, 100)) },
  // The ceiling: pick the price that makes the most money against the forecast,
  // stock a shade under what it predicts, and borrow when a hot day is coming.
  // Nothing here is beyond a child who has understood the game — which is why
  // this is the row the top rung has to be set against.
  best: {
    price: (run, info) => {
      let bestP = 75, bestV = -1e9;
      for (const p of E.PRICES) {
        const cups = Math.min(E.STALL_LIMIT, expected(run, info, p.cents));
        const v = cups * (p.cents - E.packPrice(info.unit, E.PACKS[1]) / 15);
        if (v > bestV) { bestV = v; bestP = p.cents; }
      }
      return bestP;
    },
    plan: (run, info) => Math.round(expected(run, info, run.price) * 0.95)
  }
};

/* ── One run ───────────────────────────────────────────────────────────── */

function playDay(run, policy, opt) {
  const info = run.today;
  E.setPrice(run, policy.price(run, info));

  if (opt.loans && !run.loan && run.day <= 3 && info.forecast >= 3 &&
      E.affordable(run) < 600) {
    const offers = E.loanOffers(run);
    if (offers.length) E.takeLoan(run, offers[offers.length - 1].id);
  }

  // The shop, played the way it pays: sign first (it compounds), then the
  // bucket (it turns leftovers back into stock). Both as soon as affordable
  // while leaving enough for a decent stall.
  if (opt.treats && opt.treats.length) {
    for (const id of opt.treats) {
      const t = E.treatById(id);
      if (E.treatAvailable(run, id) && E.affordable(run) > t.cost + 600) E.buyTreat(run, id);
    }
  }

  const want = Math.max(0, Math.min(E.STALL_LIMIT, policy.plan(run, info)));
  // Big packs first, then top up with small ones — the value lesson, played.
  let guard = 0;
  while (run.cups < want && guard++ < 40) {
    const room = want - run.cups;
    const big = E.PACKS[1], small = E.PACKS[0];
    const bigCost = E.packPrice(info.unit, big), smallCost = E.packPrice(info.unit, small);
    if (room >= big.cups && run.cups + big.cups <= E.STALL_LIMIT && E.canAfford(run, bigCost)) {
      if (!E.buyPack(run, info, 1)) break;
    } else if (room >= 3 && run.cups + small.cups <= E.STALL_LIMIT && E.canAfford(run, smallCost)) {
      if (!E.buyPack(run, info, 0)) break;
    } else break;
  }

  const res = E.openStall(run);
  // The till, played as well as the policy says.
  const r = R.stream(run.seed, run.day * 12345);
  for (let i = 0; i < (res.moments || []).length; i++) {
    const m = res.moments[run.changeAt];
    if (!m) break;
    E.giveChange(run, r.chance(opt.tillSkill) ? m.due : Math.max(0, m.due - 5));
  }
  E.closeDay(run);
  E.bankChoice(run, opt.bank);
  const n = E.night(run);
  return { res, n };
}

function play(policy, opt, seed) {
  const run = E.newRun(opt.difficulty, seed);
  E.startDay(run);
  const stats = { soldOut: 0, binnedDays: 0, cups: 0, sold: 0, wasted: 0, days: 0, full: 0 };
  for (;;) {
    const { res } = playDay(run, policy, opt);
    stats.days++;
    stats.cups += res.sold + res.wasted + (res.lost || 0);
    stats.sold += res.sold;
    stats.wasted += res.wasted;
    if (res.turned > 0) stats.soldOut++;
    if (res.wasted > 0) stats.binnedDays++;
    if (res.sold + res.wasted + (res.lost || 0) >= E.STALL_LIMIT) stats.full++;
    if (!E.nextDay(run)) break;
  }
  return { run, summary: E.summary(run), stats };
}

/* ── Reporting ─────────────────────────────────────────────────────────── */

const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length * p)]; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function sweep(name, policy, opt, runs) {
  const finals = [], rungs = [], out = { soldOut: 0, binned: 0, cups: 0, sold: 0, wasted: 0, days: 0, full: 0 };
  let won = 0;
  for (let i = 0; i < runs; i++) {
    const g = play(policy, opt, (i * 2654435761) >>> 0);
    finals.push(g.summary.final);
    rungs.push(g.summary.rung);
    if (g.summary.won) won++;
    out.soldOut += g.stats.soldOut; out.binned += g.stats.binnedDays;
    out.cups += g.stats.cups; out.sold += g.stats.sold; out.wasted += g.stats.wasted;
    out.days += g.stats.days; out.full += g.stats.full;
  }
  return {
    name,
    median: median(finals), p10: pct(finals, 0.1), p90: pct(finals, 0.9),
    win: won / runs, rung: mean(rungs),
    soldOut: out.soldOut / out.days, binned: out.binned / out.days,
    full: out.full / out.days,
    cupsPerDay: out.cups / out.days, waste: out.wasted / Math.max(1, out.cups)
  };
}

function table(rows) {
  const head = ["policy", "median", "p10", "p90", "win%", "rung", "soldout%", "binned%", "full%", "cups/day", "waste%"];
  const fmt = (r) => [r.name, money(r.median), money(r.p10), money(r.p90),
    (r.win * 100).toFixed(0), r.rung.toFixed(2), (r.soldOut * 100).toFixed(0),
    (r.binned * 100).toFixed(0), (r.full * 100).toFixed(0),
    r.cupsPerDay.toFixed(1), (r.waste * 100).toFixed(0)];
  const all = [head].concat(rows.map(fmt));
  const w = head.map((_, i) => Math.max(...all.map((r) => String(r[i]).length)));
  for (const r of all) console.log(r.map((c, i) => String(c).padEnd(w[i])).join("  "));
}

const RUNS = Number(process.argv[2]) || 2000;
const BASE = { bank: "float", tillSkill: 0.9, loans: false, treats: ["sign", "bucket"] };

for (const difficulty of ["easy", "normal", "tricky"]) {
  const sp = E.spec(difficulty);
  console.log("\n=== " + difficulty + "  (" + sp.days + " days, goal " + money(sp.goal[3]) + ") ===");
  const rows = [];
  for (const [name, p] of Object.entries(POLICIES)) {
    rows.push(sweep(name, p, Object.assign({}, BASE, { difficulty, loans: name === "max" || name === "best" }), RUNS));
  }
  table(rows);
}

/* The question the morning is supposed to be: how much of the forecast do you
 * buy? If the best answer is "more than you can sell", the stall has no
 * decision in it and the child is right to fill it every day.
 */
const mult = (m) => ({ price: () => 75,
  plan: (run, info) => Math.round(expected(run, info, 75) * m) });

for (const treats of [["sign", "bucket"], []]) {
  console.log("\n=== how much of the forecast to buy (normal, " +
              (treats.length ? "with the shop" : "no shop") + ") ===");
  const rows = [];
  for (const m of [0.6, 0.8, 1.0, 1.2, 1.5, 2.0]) {
    rows.push(sweep("x" + m.toFixed(1), mult(m),
      Object.assign({}, BASE, { difficulty: "normal", treats }), RUNS));
  }
  rows.push(sweep("fill it", POLICIES.max,
    Object.assign({}, BASE, { difficulty: "normal", treats }), RUNS));
  table(rows);
}

/* Where to put the rungs. The top one is meant to be a stretch that good play
 * reaches sometimes, not a line that "fill the stall" walks over.
 */
function reach(policy, difficulty, runs) {
  const finals = [];
  for (let i = 0; i < runs; i++) {
    finals.push(play(policy, Object.assign({}, BASE, { difficulty, loans: true }),
      (i * 2654435761) >>> 0).summary.final);
  }
  finals.sort((a, b) => a - b);
  return finals;
}

for (const difficulty of ["easy", "normal", "tricky"]) {
  const sp = E.spec(difficulty);
  console.log("\n=== rungs on " + difficulty + " — % of runs that clear each ===");
  const cols = [["best", reach(POLICIES.best, difficulty, RUNS)],
                ["forecast", reach(POLICIES.forecast, difficulty, RUNS)],
                ["fill it", reach(POLICIES.max, difficulty, RUNS)],
                ["flat", reach(POLICIES.flat, difficulty, RUNS)]];
  const marks = difficulty === "easy"
    ? [800, 1600, 2400, 3000, 3600, 4200, 5000]
    : [2500, 5000, 8000, 10000, 12000, 15000, 18000];
  console.log("  goal      " + cols.map((c) => c[0].padStart(9)).join(""));
  for (const g of marks) {
    const row = cols.map((c) => ((c[1].filter((v) => v >= g).length / c[1].length * 100).toFixed(0) + "%").padStart(9));
    console.log("  " + money(g).padEnd(9) + row.join("") +
                (sp.goal.includes(g) ? "   <- rung now" : ""));
  }
}

/* Banking, at the policy a decent child actually plays. */
console.log("\n=== banking (normal, forecast policy) ===");
{
  const rows = [];
  for (const bank of ["all", "float", "half", "none"]) {
    rows.push(sweep(bank, POLICIES.forecast, { difficulty: "normal", bank, tillSkill: 0.9, loans: false }, RUNS));
  }
  table(rows);
}

/* Is the shop worth the money? Two of the three are supposed to earn it back. */
console.log("\n=== the shop (normal, best play) ===");
{
  const rows = [];
  for (const m of [1.0, 1.2]) {
    for (const treats of [[], ["bucket"]]) {
      rows.push(sweep("x" + m.toFixed(1) + (treats.length ? " +bucket" : ""), mult(m),
        Object.assign({}, BASE, { difficulty: "normal", treats }), RUNS));
    }
  }
  for (const treats of [[], ["sign"], ["bucket"], ["sign", "bucket"]]) {
    rows.push(sweep(treats.length ? treats.join("+") : "nothing", POLICIES.best,
      Object.assign({}, BASE, { difficulty: "normal", treats, loans: true }), RUNS));
  }
  table(rows);
}

/* How big a float to keep back. The withdrawal fee only teaches anything if
 * the answer is "about a day's shopping" rather than "all of it" or "none".
 */
console.log("\n=== the float, against the " + money(E.WITHDRAW_FEE) + " trip fee " +
            "(keeping " + money(E.FLOAT) + " back) ===");
{
  const rows = [];
  for (const bank of ["all", "float", "half", "none"]) {
    rows.push(sweep(bank, POLICIES.best,
      Object.assign({}, BASE, { difficulty: "normal", bank, loans: true }), RUNS));
  }
  table(rows);
}

/* One price, all fortnight, everything else equal. 75c is meant to be the peak
 * with a visible fall-off on both sides — not a coin toss with $1.00.
 */
console.log("\n=== one price, all fortnight (normal) ===");
{
  const rows = [];
  for (const p of E.PRICES) {
    rows.push(sweep(E.price(p.cents),
      { price: () => p.cents, plan: (run, info) => Math.round(expected(run, info, p.cents)) },
      Object.assign({}, BASE, { difficulty: "normal" }), RUNS));
  }
  table(rows);
}

/* What the day actually asks for, against what the stall can hold. */
console.log("\n=== demand at 75c, by weather (at the regulars cap) ===");
for (let w = 0; w < E.WEATHER.length; w++) {
  const s = [];
  for (let i = 0; i < 4000; i++) {
    const info = { day: (i % 14) + 1, weather: w, forecast: w, unit: 40, event: null };
    s.push(E.wanted(info, 75, E.MAX_REGULARS, (i * 2654435761) >>> 0).total);
  }
  console.log("  " + E.WEATHER[w].name.padEnd(16) + " median " + median(s) +
              "  p10 " + pct(s, 0.1) + "  p90 " + pct(s, 0.9) + "  max " + Math.max(...s));
}

console.log("\n=== cup economics at 75c ===");
for (const unit of [30, 35, 45, 55, 60]) {
  const per = E.packPrice(unit, E.PACKS[1]) / E.PACKS[1].cups;
  console.log("  lemons " + unit + "c/cup -> big pack " + money(E.packPrice(unit, E.PACKS[1])) +
    " = " + per.toFixed(1) + "c a cup, margin at 75c = " + (75 - per).toFixed(1) +
    "c, break-even sell-through " + ((per / 75) * 100).toFixed(0) + "%");
}
