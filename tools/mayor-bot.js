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
// The comb: a main road in from the road out, and a side street every third
// line across it. Version 2 towns can have the road out on any side.
function layRoads(town) {
  const g = town.grid, W = g[0].length, H = g.length;
  let ex = 0, ey = 0, side = "west";
  g.forEach((row, y) => row.forEach((c, x) => { if (c && c.entry && !c.late) { ex = x; ey = y; side = c.side || "west"; } }));
  const path = [];
  if (side === "west" || side === "east") {
    for (let x = 0; x < W; x++) path.push([x, ey]);
    [2, 5, 8, 11].forEach((x) => { for (let y = 0; y < H; y++) if (y !== ey) path.push([x, y]); });
  } else {
    for (let y = 0; y < H; y++) path.push([ex, y]);
    [2, 5, 8].forEach((y) => { for (let x = 0; x < W; x++) if (x !== ex) path.push([x, y]); });
  }
  path.forEach(([x, y]) => { const c = g[y][x]; if (c && c.t === "trees") M.bulldoze(town, x, y); if (!g[y][x]) M.build(town, "road", x, y); });
  joinUp(town);
}
// Water can cut the comb in two: join any stranded road to the network by
// the shortest way round, like a player would.
function joinUp(town) {
  const g = town.grid, W = g[0].length, H = g.length;
  for (let round = 0; round < 12; round++) {
    const linked = LC.Sim.reach(g);
    const stranded = new Set();
    g.forEach((row, y) => row.forEach((c, x) => { if (c && c.t === "road" && !linked.has(x + "," + y)) stranded.add(x + "," + y); }));
    if (!stranded.size) return;
    const from = new Map(), queue = [];
    linked.forEach((k) => { from.set(k, null); queue.push(k); });
    let hit = null;
    while (queue.length && !hit) {
      const k = queue.shift(), [x, y] = k.split(",").map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = nx + "," + ny;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || from.has(nk)) continue;
        const c = g[ny][nx];
        if (stranded.has(nk)) { from.set(nk, k); hit = nk; break; }
        if (c && c.t !== "trees") continue;
        from.set(nk, k);
        queue.push(nk);
      }
    }
    if (!hit) return;
    for (let k = from.get(hit); k && !linked.has(k); k = from.get(k)) {
      const [x, y] = k.split(",").map(Number);
      if (g[y][x] && g[y][x].t === "trees") M.bulldoze(town, x, y);
      if (M.build(town, "road", x, y)) return;
    }
  }
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
// Family-aware choices for the smart bot: put the next family where it will
// be happy, give nature lovers a park next door, build factories on rocks
// and shops in pairs, and reach the castle with a road.
const around = (g, x, y, f) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const c = g[y + dy] && g[y + dy][x + dx]; if (c && f(c)) return true; } return false; };
function smartHouse(town, spots, st) {
  const g = town.grid, fam = town.nextFam;
  const cov = (p, t) => M.covered(g, p.x, p.y, t);
  let best = null, bs = -1e9;
  spots.forEach((p) => {
    let sc = 0;
    const loud = around(g, p.x, p.y, (c) => M.LOUD.includes(c.t)), noisy = around(g, p.x, p.y, (c) => c.t === "factory");
    const green = around(g, p.x, p.y, (c) => c.t === "trees" || c.t === "water" || c.t === "park");
    if (noisy && fam !== "workers") sc -= 10;
    if (fam === "grand") { if (loud) sc -= 10; if (cov(p, "clinic")) sc += 3; }
    if (fam === "nature") sc += green ? 6 : -6;
    if (fam === "kids") sc += (cov(p, "school") ? 3 : 0) + (cov(p, "park") ? 3 : 0);
    if (fam === "workers") sc += g.some((row, y) => row.some((c, x) => c && (c.t === "factory" || c.t === "shop") && Math.abs(x - p.x) + Math.abs(y - p.y) <= LC.JOB_RANGE)) ? 3 : 0;
    if (around(g, p.x, p.y, (c) => c.t === "water")) sc += 1;
    if (around(g, p.x, p.y, (c) => c.t === "park")) sc += 1;
    ["shop", "school", "park", "clinic"].forEach((t) => { if (cov(p, t)) sc += 0.5; });
    if (sc > bs) { bs = sc; best = p; }
  });
  // A town with hardly any homes builds anyway: an unhappy family beats none.
  const few = st.homes.length < 3;
  return !!best && (bs > -5 || few) && !M.build(town, "house", best.x, best.y);
}
function smartExtras(town, spots, st) {
  const g = town.grid;
  // A nature lover missing green: a park right next door.
  const sad = st.homes.find((h) => h.missing.includes("green"));
  if (sad && town.coins >= T.park.cost) {
    const p = spots.find((q) => Math.abs(q.x - sad.x) <= 1 && Math.abs(q.y - sad.y) <= 1);
    if (p && !M.build(town, "park", p.x, p.y)) return true;
  }
  // The castle: a road to it if the comb passed it by.
  const cs = []; g.forEach((row, y) => row.forEach((c, x) => { if (c && c.t === "castle") cs.push({ x, y }); }));
  for (const c of cs) {
    const roads = LC.Sim.reach(g);
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => roads.has(c.x + dx + "," + (c.y + dy)))) continue;
    if (town.coins < 8) break;
    // Walk from the nearest linked road straight towards it.
    let near = null, nd = 99;
    roads.forEach((k) => { const [x, y] = k.split(",").map(Number), d = Math.abs(x - c.x) + Math.abs(y - c.y); if (d < nd) { nd = d; near = { x, y }; } });
    if (!near || nd > 6) continue;
    let { x, y } = near, ok = true;
    while (Math.abs(x - c.x) + Math.abs(y - c.y) > 1) {
      if (x !== c.x) x += Math.sign(c.x - x); else y += Math.sign(c.y - y);
      const q = g[y][x];
      if (q && q.t === "trees") M.bulldoze(town, x, y);
      if (g[y][x] && g[y][x].t !== "road") { ok = false; break; }
      if (!g[y][x]) M.build(town, "road", x, y);
    }
    if (ok) return true;
  }
  // A factory on rocks, once factories exist, away from homes.
  if (M.unlocked(town).includes("factory") && town.coins >= T.factory.cost + 10 && st.people >= 30) {
    const rk = (town.spots || []).find((p) => p.k === "rocks" && !g[p.y][p.x] && spots.some((q) => q.x === p.x && q.y === p.y) && !st.homes.some((h) => h.fam !== "workers" && Math.abs(h.x - p.x) <= 1 && Math.abs(h.y - p.y) <= 1));
    if (rk && !M.build(town, "factory", rk.x, rk.y)) return true;
  }
  // Coins piling up are a rival's best argument: a second shop next to a busy one.
  if (town.coins > 80 + st.people) {
    const busy = st.shops.filter((s) => !s.why.some((w) => w.k === "street")).sort((a, b) => b.customers - a.customers)[0];
    const p = busy && spots.find((q) => Math.abs(q.x - busy.x) + Math.abs(q.y - busy.y) === 1 && !st.homes.some((h) => h.fam === "grand" && Math.abs(h.x - q.x) <= 1 && Math.abs(h.y - q.y) <= 1));
    if (p && !M.build(town, "shop", p.x, p.y)) return true;
  }
  return false;
}
function sensible(town, opts) {
  opts = opts || {};
  const g = town.grid;
  for (let loop = 0; loop < 30; loop++) {
    const st = M.look(town), un = M.unlocked(town);
    g.forEach((row, y) => row.forEach((c, x) => { if (c && c.damaged) M.repair(town, x, y); }));
    const spots = roadSide(g).filter((p) => !st.homes.some(() => false));
    const quiet = spots.filter((p) => !g.some((row, y) => row.some((c, x) => c && c.t === "factory" && Math.abs(x - p.x) <= 1 && Math.abs(y - p.y) <= 1)));
    const SKIP = ["road", "noise", "quiet", "green", "repair"];
    const wants = Array.from(new Set(M.wantsFor(st.people, town).concat(st.homes.flatMap((h) => h.missing)))).filter((w) => !SKIP.includes(w));
    let did = false;
    for (const w of wants) {
      const t = w === "job" ? (un.includes("factory") ? "factory" : "shop") : w;
      const missing = st.homes.filter((h) => h.missing.includes(w));
      if (!missing.length) continue;
      if (town.coins < T[t].cost && town.loan < M.loanLimit(town) / 2) M.borrow(town, T[t].cost);
      const loud = t === "factory" || (opts.smart && M.LOUD.includes(t));
      const where = loud ? spots.filter((p) => !st.homes.some((h) => (t === "factory" ? h.fam !== "workers" || !opts.smart : h.fam === "grand") && Math.abs(h.x - p.x) <= 1 && Math.abs(h.y - p.y) <= 1)) : spots;
      if (place(town, t, where, missing)) { did = true; break; }
      // No room near them: knock down one of their houses for the service.
      if (t !== "factory" && town.coins >= T[t].cost + 3) {
        const h = missing.find((q) => q.t === "house");
        if (h) { M.bulldoze(town, h.x, h.y); if (!M.build(town, t, h.x, h.y)) { did = true; break; } }
      }
    }
    if (did) continue;
    if (town.coins >= T.house.cost + 4 && (opts.smart ? smartHouse(town, quiet, st) : place(town, "house", quiet, []))) continue;
    if (opts.smart && smartExtras(town, spots, st)) continue;
    // Out of land: upgrade full, happy homes (house -> flats -> tower).
    // A smart mayor spends a pile of coins instead of handing rivals an argument.
    if (opts.smart && town.loan && town.coins > 40) M.repay(town, town.coins - 30);
    if (!quiet.length || (opts.smart && town.coins > 60 + st.people)) {
      const h = st.homes.find((q) => q.face === "happy" && M.nextStep(town, town.grid[q.y][q.x]) && town.rank >= M.nextStep(town, town.grid[q.y][q.x]).rank && town.coins >= M.nextStep(town, town.grid[q.y][q.x]).cost + 5);
      if (h && !M.upgrade(town, h.x, h.y)) continue;
      if (opts.smart) {
        // Then services: a bigger school or clinic reaches more homes.
        let up = null;
        town.grid.forEach((row, y) => row.forEach((c, x) => { const n = c && M.nextStep(town, c); if (!up && n && !LC.Sim.homes(c.t) && town.rank >= n.rank && town.coins >= n.cost + 5) up = { x, y }; }));
        if (up && !M.upgrade(town, up.x, up.y)) continue;
      }
    }
    break;
  }
  if (town.loan && town.coins > 40) M.repay(town, town.coins - 30);
}
const smart = (town) => sensible(town, { smart: true });
const lazy = (town) => { if (town.year === 1) { for (let i = 0; i < 4; i++) { const s = roadSide(town.grid); if (s.length) M.build(town, "house", s[0].x, s[0].y); } } };
const housesOnly = (town) => { for (let k = 0; k < 10; k++) { const s = roadSide(town.grid); if (!s.length || M.build(town, "house", s[0].x, s[0].y)) break; } };

function play(bot, seed, years, v) {
  const town = M.create("Test", "challenge", seed, v);
  if (bot !== lazy) layRoads(town);
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
// "old rules" is the first version of the game, kept for saved towns; the
// rest play version 2 towns. The comb bot ignores families and land, the
// smart one plans for them.
for (const [name, bot, v] of [["old rules", sensible, 1], ["comb", sensible, 2], ["smart", smart, 2], ["houses only", housesOnly, 2], ["lazy", lazy, 2]]) {
  const runs = Array.from({ length: N }, (_, i) => play(bot, i + 1, M.CHALLENGE_YEARS, v));
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
  if (name === "smart") console.log("             events: " + Object.entries(ev).map(([k, v]) => k + " " + (v / N).toFixed(1)).join("  "));
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
