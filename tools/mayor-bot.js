/* Little City - Be the Mayor balance harness. Run: node tools/mayor-bot.js    */
/* Bot mayors play the same seeded towns so the economy can be tuned by        */
/* numbers: a sensible mayor should reach City in 20 years, a lazy one or one  */
/* who never builds services must not.                                         */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "little-city", "js");
const sandbox = { console, Date };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ["sim.js", "mayor.js"]) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
const LC = sandbox.LC, M = LC.Mayor, T = LC.TYPES;
const N = +process.argv[2] || 200;

function roadSide(g) {
  const out = [];
  g.forEach((row, y) => row.forEach((c, x) => { if (!c && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] && g[y + dy][x + dx].t === "road")) out.push({ x, y }); }));
  return out;
}
function layRoads(town) {
  const g = town.grid, ey = g.findIndex((row) => row[0] && row[0].entry);
  const path = [];
  const W = g[0].length, H = g.length;
  for (let x = 1; x < W; x++) path.push([x, ey]);
  [2, 5, 8, 11].forEach((x) => { for (let y = 0; y < H; y++) if (y !== ey) path.push([x, y]); });
  path.forEach(([x, y]) => { const c = g[y][x]; if (c && c.t === "trees") M.bulldoze(town, x, y); if (!g[y][x]) M.build(town, "road", x, y); });
}
// Services go where they reach the most families who are missing them;
// if no spot reaches anyone, don't waste the money.
function place(town, t, spots, near) {
  if (!spots.length) return false;
  if (!near.length) return !M.build(town, t, spots[0].x, spots[0].y);
  const R = T[t].range || (T[t].jobs ? LC.JOB_RANGE : 0);
  let best = null, bn = 0;
  spots.forEach((p) => { const n = near.filter((h) => Math.abs(h.x - p.x) + Math.abs(h.y - p.y) <= R).length; if (n > bn) { bn = n; best = p; } });
  return !!best && !M.build(town, t, best.x, best.y);
}
function sensible(town) {
  const g = town.grid;
  for (let loop = 0; loop < 30; loop++) {
    const st = M.look(town), un = M.unlocked(town);
    g.forEach((row, y) => row.forEach((c, x) => { if (c && c.damaged) M.repair(town, x, y); }));
    const spots = roadSide(g).filter((p) => !st.homes.some(() => false));
    const quiet = spots.filter((p) => !g.some((row, y) => row.some((c, x) => c && c.t === "factory" && Math.abs(x - p.x) <= 1 && Math.abs(y - p.y) <= 1)));
    const wants = M.wantsFor(st.people).filter((w) => !["road", "noise"].includes(w));
    let did = false;
    for (const w of wants) {
      const t = w === "job" ? (un.includes("factory") ? "factory" : "shop") : w;
      const missing = st.homes.filter((h) => h.missing.includes(w));
      if (!missing.length) continue;
      if (town.coins < T[t].cost && town.loan < M.loanLimit(town) / 2) M.borrow(town, T[t].cost);
      const where = t === "factory" ? spots.filter((p) => !st.homes.some((h) => Math.abs(h.x - p.x) <= 1 && Math.abs(h.y - p.y) <= 1)) : spots;
      if (place(town, t, where, missing)) { did = true; break; }
      // No room near them: knock down one of their houses for the service.
      if (t !== "factory" && town.coins >= T[t].cost + 3) {
        const h = missing.find((q) => q.t === "house");
        if (h) { M.bulldoze(town, h.x, h.y); if (!M.build(town, t, h.x, h.y)) { did = true; break; } }
      }
    }
    if (did) continue;
    if (town.coins >= T.house.cost + 4 && place(town, "house", quiet, [])) continue;
    // Out of land: upgrade full, happy homes (house -> flats -> tower).
    if (!quiet.length) {
      const h = st.homes.find((q) => q.face === "happy" && M.nextStep(town, town.grid[q.y][q.x]) && town.rank >= M.nextStep(town, town.grid[q.y][q.x]).rank && town.coins >= M.nextStep(town, town.grid[q.y][q.x]).cost + 5);
      if (h && !M.upgrade(town, h.x, h.y)) continue;
    }
    break;
  }
  if (town.loan && town.coins > 40) M.repay(town, town.coins - 30);
}
const lazy = (town) => { if (town.year === 1) { for (let i = 0; i < 4; i++) { const s = roadSide(town.grid); if (s.length) M.build(town, "house", s[0].x, s[0].y); } } };
const housesOnly = (town) => { for (let k = 0; k < 10; k++) { const s = roadSide(town.grid); if (!s.length || M.build(town, "house", s[0].x, s[0].y)) break; } };

function play(bot, seed, years) {
  const town = M.create("Test", "challenge", seed);
  if (bot === sensible || bot === housesOnly) layRoads(town);
  const log = { events: {}, pop10: 0 };
  for (let y = 0; y < years; y++) {
    bot(town);
    const s = M.endYear(town);
    if (!s) break;
    log.events[s.event.e] = (log.events[s.event.e] || 0) + 1;
    if (town.offer) M.answer(town, town.offer.kind === "house");
    if (s.year === 10) log.pop10 = s.people;
  }
  return { town, log, sc: M.score(town) };
}
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const [name, bot] of [["sensible", sensible], ["houses only", housesOnly], ["lazy", lazy]]) {
  const runs = Array.from({ length: N }, (_, i) => play(bot, i + 1, M.CHALLENGE_YEARS));
  const stars = [0, 0, 0, 0];
  runs.forEach((r) => stars[r.sc.stars]++);
  const ranks = [0, 0, 0, 0, 0];
  runs.forEach((r) => ranks[r.town.rank]++);
  const ev = {};
  runs.forEach((r) => Object.entries(r.log.events).forEach(([k, v]) => { ev[k] = (ev[k] || 0) + v; }));
  console.log(`${name.padEnd(12)} pop@10 ${med(runs.map((r) => r.log.pop10))}  pop@20 ${med(runs.map((r) => r.sc.people))}  score ${med(runs.map((r) => r.sc.pts))}  coins ${med(runs.map((r) => r.town.coins))}  loan ${med(runs.map((r) => r.town.loan))}  medals ${med(runs.map((r) => r.town.medals.length))}`);
  console.log(`             stars 0/1/2/3: ${stars.join(" / ")}   ranks H/V/T/C/B: ${ranks.join(" / ")}`);
  const el = runs.flatMap((r) => r.town.elections);
  const lostAt = {};
  runs.forEach((r) => { const l = r.town.elections.find((e) => !e.won); if (l) lostAt[l.year] = (lostAt[l.year] || 0) + 1; });
  console.log(`             elections won ${el.filter((e) => e.won).length}/${el.length} (median share ${med(el.map((e) => e.share))}%)  lost a town in year: ${JSON.stringify(lostAt)}`);
  if (name === "sensible") console.log("             events: " + Object.entries(ev).map(([k, v]) => k + " " + (v / N).toFixed(1)).join("  "));
}
if (process.argv[3] === "trace") {
  const town = M.create("Trace", "challenge", +process.argv[4] || 3);
  layRoads(town);
  console.log("after roads coins", town.coins, "land", town.land);
  for (let y = 0; y < 20; y++) {
    sensible(town);
    const st = M.look(town);
    const s = M.endYear(town);
    const faces = st.homes.reduce((o, h) => { o[h.face] = (o[h.face] || 0) + 1; return o; }, {});
    const miss = {}; st.homes.forEach((h) => h.missing.forEach((m) => { miss[m] = (miss[m] || 0) + 1; }));
    console.log(`y${s.year} pop ${s.people} +${s.inn}/-${s.out} tax ${s.tax} earn ${s.earn} up ${s.upkeep} int ${s.interest} coins ${town.coins} loan ${town.loan} homes ${st.homes.length} ${JSON.stringify(faces)} miss ${JSON.stringify(miss)} ${s.event.e}`);
  }
}

// ── Safety checks ────────────────────────────────────────────────────────────
{
  let bad = 0;
  const fail = (m) => { bad++; console.log("✗ " + m); };
  // The same town played the same way ends the same way.
  const a = play(sensible, 42, 20), b = play(sensible, 42, 20);
  if (JSON.stringify(a.town.grid) !== JSON.stringify(b.town.grid) || a.town.coins !== b.town.coins) fail("same seed played twice gave different towns");
  // A long endless town stays sane: whole numbers, nothing negative.
  const t = M.create("Long", "endless", 7);
  layRoads(t);
  for (let y = 0; y < 60 && !t.over; y++) { sensible(t); M.endYear(t); if (t.offer) M.answer(t, false); }
  if (![t.coins, t.loan, M.people(t)].every((v) => Number.isInteger(v) && v >= 0)) fail("endless town went strange: " + JSON.stringify({ coins: t.coins, loan: t.loan }));
  // Losing an election can be retried from the start of that year.
  const lose = M.create("Lose", "endless", 9);
  layRoads(lose);
  for (let y = 0; y < 30 && !lose.over; y++) { housesOnly(lose); M.endYear(lose); }
  if (!lose.lost) fail("a town with no services never lost an election");
  else {
    const back = M.retry(lose);
    if (!back || back.over || back.year !== lose.year - 1 || !back.campaign) fail("retry didn't go back to the election year");
  }
  console.log(bad ? `${bad} safety problem(s)` : "✓ safety checks OK");
  if (bad) process.exitCode = 1;
}
