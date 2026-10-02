/* Little City - Be the Mayor: a town that changes every year. No DOM here,    */
/* so tools/city-check.js can play hundreds of towns to tune the numbers.      */
/*                                                                             */
/* A turn is a year. The mayor builds with the coins in the treasury, then     */
/* ends the year: families move in or out depending on what's near them,      */
/* shops and factories earn from the people around them, running costs and    */
/* loan interest go out, and one thing happens (a storm, a festival, a letter */
/* asking for something, an offer to say yes or no to). Everything random is  */
/* drawn from the town's own seed, so the same town always plays the same.    */
"use strict";
window.LC = window.LC || {};

LC.Mayor = (function () {
  const Sim = LC.Sim, T = LC.TYPES;
  // Towns started before the map grew are 11 x 8; everything reads the size
  // from the grid itself, so both kinds keep working.
  const W = 14, H = 10;
  const START_COINS = 80, INTEREST = 0.1, CHALLENGE_YEARS = 20, TAX = 1;
  // Running costs in Be the Mayor. Lower than the lessons' numbers, because
  // here they come out of real taxes every single year.
  const UPKEEP = { park: 1, school: 3, clinic: 3, fire: 2, library: 2, police: 2, station: 2, stadium: 4 };
  const RANKS = [
    { name: "Hamlet", e: "🏡", at: 0, unlock: ["road", "house", "shop", "park", "school"] },
    { name: "Village", e: "🏘️", at: 20, unlock: ["clinic", "fire", "factory"] },
    { name: "Town", e: "🏙️", at: 50, unlock: ["library"] },
    { name: "City", e: "🌆", at: 100, unlock: ["police", "station"] },
    { name: "Big City", e: "🌃", at: 250, unlock: ["stadium"] }
  ];
  // As the town grows, families expect more. Below these sizes a missing
  // service doesn't make anyone unhappy, so a new town can start small.
  const WANTS = [["shop", 8], ["school", 16], ["park", 24], ["clinic", 36], ["job", 50], ["fire", 60], ["police", 110]];
  const MEDALS = [
    { id: "first", e: "🏠", name: "First family", text: "The first family moved in." },
    { id: "village", e: "🏘️", name: "Village", text: "20 people live in your town." },
    { id: "town", e: "🏙️", name: "Town", text: "50 people live in your town." },
    { id: "city", e: "🌆", name: "City", text: "100 people live in your town." },
    { id: "big", e: "🌃", name: "Big City", text: "250 people live in your town." },
    { id: "allhappy", e: "😀", name: "Everyone happy", text: "Every family was happy at the end of a year (12 people or more)." },
    { id: "saver", e: "🐷", name: "Piggy bank", text: "200 coins in the treasury." },
    { id: "debtfree", e: "🏦", name: "Paid it back", text: "Paid back a whole loan." },
    { id: "storms", e: "🌩️", name: "Storm survivor", text: "Got through 3 storms." },
    { id: "firesafe", e: "🚒", name: "Fire safe", text: "A fire started, but the fire fighters put it out." },
    { id: "helper", e: "✉️", name: "Good neighbour", text: "Did 3 things residents asked for." },
    { id: "ten", e: "🎖️", name: "10 years as mayor", text: "Ran one town for 10 years." },
    { id: "elected", e: "🗳️", name: "Re-elected", text: "Won an election." },
    { id: "landslide", e: "🏆", name: "Landslide", text: "Won an election with 3 out of every 4 votes." },
    { id: "retired", e: "🎖️", name: "Farewell party", text: "Retired as mayor with a farewell party." },
    { id: "legend", e: "🌟", name: "Legendary mayor", text: "Retired with the title Legendary mayor." },
    { id: "mission", e: "🎯", name: "Mission done", text: "Finished one of a town's missions." },
    { id: "missions3", e: "🏅", name: "All three missions", text: "Finished all 3 missions in one town." }
  ];
  // Every 4 years the town votes. Two rivals stand against the mayor, each
  // promising what the most families are missing, so the campaign year is a
  // year to fix it.
  const TERM = 4;
  const RIVALS = [{ e: "🦊", name: "Fiona Fox" }, { e: "🐻", name: "Barry Bear" }, { e: "🦉", name: "Olive Owl" }, { e: "🐸", name: "Frank Frog" }, { e: "🐧", name: "Penny Penguin" }, { e: "🦘", name: "Kip Kangaroo" }];
  const PROMISE = {
    road: "Roads to every house!", shop: "Shops for everyone!", school: "A school near every home!", park: "More parks for the kids!",
    clinic: "A clinic close to every street!", fire: "Fire stations to keep us safe!", police: "More police!", job: "Jobs for everybody!",
    noise: "Move the noisy factories away from homes!", repair: "Fix everything the storm broke!", loan: "Pay back the bank loan!", slide: "A giant water slide!", traffic: "No more traffic jams!",
    quiet: "Peace and quiet for grandparents!", green: "More nature next to homes!"
  };
  // Towns started from version 2 on play with families, special land, a road
  // out on any side, shuffled wishes and rivals with real platforms. Older
  // saved towns keep the rules they were started with.
  // Version 3 adds traffic jams and missions on top.
  const V = 3;
  const v2 = (town) => (town.v || 1) >= 2;
  const v3 = (town) => (town.v || 1) >= 3;
  // Every house gets a family, shown before it's built so the mayor can pick
  // a spot that suits them. `extra` needs count from the start (once that
  // building exists in the town); `skip` needs never bother them.
  const FAMS = {
    grand: { e: "👵", name: "Grandparents", likes: "a clinic nearby, and peace and quiet: no shops or factories next door. No school needed", extra: ["clinic", "quiet"], skip: ["school"] },
    kids: { e: "👨‍👩‍👧", name: "Young family", likes: "a school and a park nearby", extra: ["school", "park"], skip: [] },
    workers: { e: "👷", name: "Workers", likes: "jobs nearby (a shop, factory or station). Factory noise doesn't bother them", extra: ["job"], skip: ["noise"] },
    nature: { e: "🌿", name: "Nature lovers", likes: "trees, water or a park right next door", extra: ["green"], skip: [] }
  };
  const FAM_IDS = Object.keys(FAMS);
  const LOUD = ["shop", "factory", "station", "stadium"];
  const homes = Sim.homes;
  const capOf = (t) => (T[t] && T[t].people) || 0;
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  // A small seeded random number generator (mulberry32).
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pickOf = (r, list) => list[Math.floor(r() * list.length)];

  // ── A new map ──────────────────────────────────────────────────────────────
  // Four kinds of land, so no two towns start the same.
  const LANDS = [{ id: "river", name: "River town", e: "🏞️" }, { id: "lake", name: "Lake town", e: "🏝️" }, { id: "sea", name: "Seaside town", e: "🏖️" }, { id: "forest", name: "Forest town", e: "🌲" }];
  const SIDES = ["west", "north", "east", "south"];
  // The square on a side's edge, `k` along it.
  const edgeAt = (side, k) => side === "west" ? { x: 0, y: k } : side === "east" ? { x: W - 1, y: k } : side === "north" ? { x: k, y: 0 } : { x: k, y: H - 1 };
  function makeMap(seed, v) {
    if ((v || V) < 2) return makeMap1(seed);
    const r = rng(seed * 7 + 1);
    const g = Array.from({ length: H }, () => Array(W).fill(null));
    const land = pickOf(r, LANDS);
    const side = pickOf(r, land.id === "sea" ? SIDES.slice(0, 3) : SIDES);
    const along = side === "west" || side === "east" ? H : W;
    const k = Math.floor(along / 2) - 1 + Math.floor(r() * 2);
    const ent = edgeAt(side, k);
    // The first few squares in from the road out stay clear for a road.
    const inward = (n) => side === "west" ? { x: n, y: ent.y } : side === "east" ? { x: W - 1 - n, y: ent.y } : side === "north" ? { x: ent.x, y: n } : { x: ent.x, y: H - 1 - n };
    const lane = new Set([0, 1, 2].map((n) => { const p = inward(n); return p.x + "," + p.y; }));
    const free = (x, y) => g[y] && x >= 0 && x < W && !g[y][x] && !lane.has(x + "," + y);
    if (land.id === "river") {
      // A river crosses the map with one old bridge over it.
      const across = side === "north" || side === "south";
      const by = across ? 2 + Math.floor(r() * (H - 4)) : ent.y;
      let x = 6 + Math.floor(r() * 3);
      for (let y = 0; y < H; y++) {
        if (free(x, y) || y === by) g[y][x] = y === by ? { t: "road", fixed: true } : { t: "water" };
        if (y !== by && y !== by - 1 && r() < 0.3) x = Math.max(4, Math.min(W - 4, x + (r() < 0.5 ? -1 : 1)));
      }
    } else if (land.id === "lake") {
      const cx = 3 + Math.floor(r() * (W - 6)), cy = ent.y < H / 2 && side !== "south" ? H - 3 : 2;
      [[0, 0], [1, 0], [-1, 0], [0, 1], [1, 1], [0, -1], [2, 0], [-1, 1], [2, 1]].forEach(([dx, dy]) => { if (free(cx + dx, cy + dy)) g[cy + dy][cx + dx] = { t: "water" }; });
    } else if (land.id === "sea") {
      for (let x = 0; x < W; x++) { if (free(x, H - 1)) g[H - 1][x] = { t: "water" }; if (x > 3 + Math.floor(r() * 3) && r() < 0.7 && free(x, H - 2)) g[H - 2][x] = { t: "water" }; }
    } else {
      for (let n = 0; n < 5; n++) {
        const cx = 1 + Math.floor(r() * (W - 2)), cy = Math.floor(r() * H);
        [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0]].forEach(([dx, dy]) => { if (free(cx + dx, cy + dy) && r() < 0.8) g[cy + dy][cx + dx] = { t: "trees" }; });
      }
    }
    for (let n = 0; n < 7; n++) { const x = Math.floor(r() * W), y = Math.floor(r() * H); if (free(x, y)) g[y][x] = { t: "trees" }; }
    // Special land: an old castle that brings tourists once a road reaches
    // it, and two rocky spots where a factory earns double.
    const spots = [];
    const open = () => { const out = []; g.forEach((row, y) => row.forEach((c, x) => { if (free(x, y) && x > 0 && y > 0 && x < W - 1 && y < H - 1 && !spots.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 3)) out.push({ x, y }); })); return out; };
    const far = open().filter((p) => Math.abs(p.x - ent.x) + Math.abs(p.y - ent.y) >= 6);
    const cs = far.length ? pickOf(r, far) : pickOf(r, open());
    g[cs.y][cs.x] = { t: "castle", fixed: true };
    spots.push({ x: cs.x, y: cs.y, k: "castle" });
    for (let n = 0; n < 2; n++) { const o = open(); if (o.length) { const p = pickOf(r, o); spots.push({ x: p.x, y: p.y, k: "rocks" }); } }
    g[ent.y][ent.x] = { t: "road", fixed: true, entry: true, side };
    return { grid: g, land, side, spots: spots.filter((p) => p.k === "rocks") };
  }
  // The first kind of map: the road out is always on the left.
  function makeMap1(seed) {
    const r = rng(seed * 7 + 1);
    const g = Array.from({ length: H }, () => Array(W).fill(null));
    const ey = 4 + Math.floor(r() * 2);
    const land = pickOf(r, LANDS);
    const free = (x, y) => g[y] && x >= 0 && x < W && !g[y][x] && !(y === ey && x < 3);
    if (land.id === "river") {
      let x = 7 + Math.floor(r() * 4);
      for (let y = 0; y < H; y++) {
        g[y][x] = y === ey ? { t: "road", fixed: true } : { t: "water" };
        if (y !== ey && y !== ey - 1 && r() < 0.3) x = Math.max(6, Math.min(W - 2, x + (r() < 0.5 ? -1 : 1)));
      }
    } else if (land.id === "lake") {
      const cx = 6 + Math.floor(r() * 5), cy = ey < 5 ? 7 : 1;
      [[0, 0], [1, 0], [-1, 0], [0, 1], [1, 1], [0, -1], [2, 0], [-1, 1]].forEach(([dx, dy]) => { if (free(cx + dx, cy + dy)) g[cy + dy][cx + dx] = { t: "water" }; });
    } else if (land.id === "sea") {
      for (let x = 0; x < W; x++) { g[H - 1][x] = { t: "water" }; if (x > 3 + Math.floor(r() * 3) && r() < 0.7) g[H - 2][x] = { t: "water" }; }
    } else {
      for (let k = 0; k < 5; k++) {
        const cx = 2 + Math.floor(r() * (W - 3)), cy = Math.floor(r() * H);
        [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0]].forEach(([dx, dy]) => { if (free(cx + dx, cy + dy) && r() < 0.8) g[cy + dy][cx + dx] = { t: "trees" }; });
      }
    }
    for (let k = 0; k < 7; k++) { const x = 1 + Math.floor(r() * (W - 1)), y = Math.floor(r() * H); if (free(x, y) && y !== ey) g[y][x] = { t: "trees" }; }
    g[ey][0] = { t: "road", fixed: true, entry: true };
    return { grid: g, land };
  }

  // Shuffle needs within groups that unlock together, so a hamlet can only
  // ever ask for hamlet buildings and the police still wait for a city.
  function wantOrder(seed) {
    const r = rng(seed * 13 + 5);
    const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const at = WANTS.map(([, n]) => n);
    const needs = shuffle(["shop", "school", "park"]).concat(shuffle(["clinic", "job", "fire"]), ["police"]);
    return needs.map((w, i) => [w, at[i]]);
  }
  const wantsList = (town) => (town && town.wants2) || WANTS;
  // The family for the next house, drawn from the town's seed and how many
  // families have come so far, so the same town always plays the same.
  function drawFam(town) { const r = rng(town.seed * 31 + (town.fams || 0) * 7 + 3); town.fams = (town.fams || 0) + 1; return pickOf(r, FAM_IDS); }

  function create(name, mode, seed, v) {
    const ver = v || V;
    const m = makeMap(seed, ver);
    const town = {
      v: ver, id: Date.now(), name, mode, seed, land: m.land.id, grid: m.grid,
      year: 1, coins: START_COINS, loan: 0, request: null, offer: null, over: false,
      streak: {}, stats: { storms: 0, helped: 0, fireSaved: 0, repaid: 0, best: 0 },
      wants: 0, rank: 0, medals: [], history: [], last: null,
      term: 1, campaign: null, snap: null, elections: []
    };
    if (ver >= 2) { town.spots = m.spots; town.wants2 = wantOrder(seed); town.nextFam = drawFam(town); }
    if (ver >= 3) town.missions = drawMissions(seed, m.grid);
    return town;
  }

  // ── What the town looks like right now ─────────────────────────────────────
  const people = (town) => town.grid.flat().reduce((n, c) => n + (c && homes(c.t) ? c.live || 0 : 0), 0);
  const rankOf = (n) => RANKS.reduce((k, rk, i) => (n >= rk.at ? i : k), 0);
  const unlocked = (town) => RANKS.slice(0, town.rank + 1).flatMap((rk) => rk.unlock);
  function wantsFor(n, town) { return ["road", "noise"].concat(wantsList(town).filter(([, at]) => n >= at).map(([w]) => w)); }
  function covered(g, x, y, t) {
    return g.some((row, yy) => row.some((c, xx) => c && c.t === t && !c.damaged && Math.abs(xx - x) + Math.abs(yy - y) <= LC.rangeOf(c)));
  }

  // ── Traffic (version 3) ────────────────────────────────────────────────────
  // Every 4 people make a car that drives to the nearest road out of town.
  // Homes are routed one by one and later cars avoid roads that are already
  // full, so a second route really does take cars away. A road fits CAP cars
  // (WIDE once widened); more than that is a jam, and once the town has
  // TRAFFIC_AT people, families stuck in one aren't happy.
  // A road can be widened twice: a wide road, then (in a City) a big road.
  const CAP = 16, WIDE = 36, BIG = 64, WIDEN = 6, WIDEN2 = 14, TRAFFIC_AT = 40;
  const capOfRoad = (c) => (!c.wide ? CAP : c.wide >= 2 ? BIG : WIDE);
  const ROAD_NAMES = ["road", "wide road", "big road"];
  function traffic(g, roads) {
    const load = {}, routes = {};
    const exits = [];
    roads.forEach((k) => { const [x, y] = k.split(",").map(Number); if (g[y][x].entry) exits.push(k); });
    if (!exits.length) return { load, routes, jammed: new Set() };
    const stations = [];
    g.forEach((row, y) => row.forEach((c, x) => { if (c && c.t === "station" && !c.damaged) stations.push({ x, y }); }));
    const hs = [];
    g.forEach((row, y) => row.forEach((c, x) => { if (c && homes(c.t) && c.live) hs.push({ x, y, c }); }));
    const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    hs.forEach((h) => {
      let cars = Math.ceil(h.c.live / 4);
      // Families near a train station take the train half the time.
      if (stations.some((s) => dist(s, h) <= 5)) cars = Math.ceil(cars / 2);
      const starts = N.map(([dx, dy]) => (h.x + dx) + "," + (h.y + dy)).filter((k) => roads.has(k));
      if (!starts.length) return;
      // Dijkstra over the town's roads: a road that would overflow costs more.
      const cost = (k) => { const [x, y] = k.split(",").map(Number); return 1 + ((load[k] || 0) + cars > capOfRoad(g[y][x]) ? 8 : 0); };
      const best = {}, from = {}, open = [];
      starts.forEach((k) => { best[k] = cost(k); from[k] = null; open.push(k); });
      let end = null;
      while (open.length) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) if (best[open[i]] < best[open[bi]]) bi = i;
        const k = open.splice(bi, 1)[0];
        const [x, y] = k.split(",").map(Number);
        if (g[y][x].entry) { end = k; break; }
        N.forEach(([dx, dy]) => {
          const nk = (x + dx) + "," + (y + dy);
          if (!roads.has(nk)) return;
          const d = best[k] + cost(nk);
          if (best[nk] == null || d < best[nk]) { if (best[nk] == null) open.push(nk); best[nk] = d; from[nk] = k; }
        });
      }
      if (!end) return;
      const path = [];
      for (let k = end; k; k = from[k]) { path.push(k); load[k] = (load[k] || 0) + cars; }
      routes[h.x + "," + h.y] = path;
    });
    const jammed = new Set(Object.keys(load).filter((k) => { const [x, y] = k.split(",").map(Number); return load[k] > capOfRoad(g[y][x]); }));
    return { load, routes, jammed };
  }

  // ── Missions (version 3) ───────────────────────────────────────────────────
  // Three per town, one from each group, drawn from the seed. `got` returns
  // how far along the town is: [have, need].
  const MISSIONS = {
    view: { group: "land", e: "🌊", name: "By the water", text: "4 homes with a water view, with people living in them", water: true,
      got: (t, st) => [st.homes.filter((h) => h.live && h.extras.includes("view")).length, 4] },
    street: { group: "land", e: "🏪", name: "High street", text: "3 shops in a row, touching each other",
      got: (t, st) => [Math.min(3, biggestRow(t.grid, "shop")), 3] },
    castle: { group: "land", e: "🏰", name: "Castle tours", text: "a road to the castle, and 2 shops near it",
      got: (t, st) => [(st.tourists ? 1 : 0) + Math.min(2, st.shops.filter((s) => s.why.some((w) => w.k === "castle")).length), 3] },
    rocks: { group: "land", e: "🪨", name: "Rock factory", text: "a factory on rocky ground that's earning coins",
      got: (t, st) => [st.works.some((w) => w.t === "factory" && w.coins && w.why.some((q) => q.k === "rocks")) ? 1 : 0, 1] },
    nature: { group: "family", e: "🌿", name: "Nature town", text: "5 happy homes of nature lovers",
      got: (t, st) => [Math.min(5, st.homes.filter((h) => h.fam === "nature" && h.live && h.face === "happy").length), 5] },
    grand: { group: "family", e: "👵", name: "Quiet streets", text: "4 happy homes of grandparents",
      got: (t, st) => [Math.min(4, st.homes.filter((h) => h.fam === "grand" && h.live && h.face === "happy").length), 4] },
    kids: { group: "family", e: "👨‍👩‍👧", name: "Family town", text: "6 happy homes of young families",
      got: (t, st) => [Math.min(6, st.homes.filter((h) => h.fam === "kids" && h.live && h.face === "happy").length), 6] },
    parks: { group: "family", e: "🌳", name: "Green streets", text: "8 homes with a park right next door",
      got: (t, st) => [Math.min(8, st.homes.filter((h) => h.live && h.extras.includes("park")).length), 8] },
    flow: { group: "big", e: "🚗", name: "Smooth roads", text: "100 people and not a single traffic jam",
      got: (t, st) => [st.jams ? Math.min(99, st.people) : Math.min(100, st.people), 100] },
    debt: { group: "big", e: "🏦", name: "No loans", text: "120 people and no money owed to the bank",
      got: (t, st) => [t.loan ? Math.min(119, st.people) : Math.min(120, st.people), 120] },
    early: { group: "big", e: "😀", name: "Happy start", text: "40 happy people by the end of year 10", by: 10,
      got: (t, st) => [Math.min(40, st.happy), 40] }
  };
  const MISSION_COINS = 30, MISSION_PTS = 40;
  function biggestRow(g, t) {
    const seen = new Set();
    let best = 0;
    g.forEach((row, y) => row.forEach((c, x) => {
      if (!c || c.t !== t || c.damaged || seen.has(x + "," + y)) return;
      let n = 0;
      const q = [[x, y]];
      seen.add(x + "," + y);
      while (q.length) {
        const [a, b] = q.pop();
        n++;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const o = g[b + dy] && g[b + dy][a + dx], k = (a + dx) + "," + (b + dy); if (o && o.t === t && !o.damaged && !seen.has(k)) { seen.add(k); q.push([a + dx, b + dy]); } });
      }
      best = Math.max(best, n);
    }));
    return best;
  }
  function drawMissions(seed, grid) {
    const r = rng(seed * 17 + 9);
    const water = grid.some((row) => row.some((c) => c && c.t === "water"));
    return ["land", "family", "big"].map((gr) => {
      const ids = Object.keys(MISSIONS).filter((id) => MISSIONS[id].group === gr && (!MISSIONS[id].water || water));
      return { id: pickOf(r, ids), done: false, failed: false };
    });
  }
  function missionState(town, st) {
    st = st || look(town);
    return (town.missions || []).map((m) => {
      const M = MISSIONS[m.id], [have, need] = M.got(town, st);
      return Object.assign({ e: M.e, name: M.name, text: M.text, by: M.by, have: m.done ? need : have, need }, m);
    });
  }
  function checkMissions(town, sum) {
    if (!town.missions) return;
    const st = look(town);
    missionState(town, st).forEach((m, i) => {
      const keep = town.missions[i];
      if (keep.done || keep.failed) return;
      if (m.have >= m.need) {
        keep.done = true;
        town.coins += MISSION_COINS;
        award(town, "mission");
        sum.news.push(`🎯 Mission done: ${m.e} ${m.name}! +${MISSION_COINS} coins.`);
        if (town.missions.every((q) => q.done)) award(town, "missions3");
      } else if (m.by && town.year >= m.by) {
        keep.failed = true;
        sum.news.push(`🎯 The ${m.e} ${m.name} mission ran out of time. The other missions are still on!`);
      }
    });
  }
  // What widening this road next would be, or null when it can't go further.
  function widenStep(town, c) {
    const lv = c.wide ? +c.wide : 0;
    if (lv >= 2) return null;
    return lv === 0 ? { name: "Wide road", cost: WIDEN, cap: WIDE, rank: 0 } : { name: "Big road", cost: WIDEN2, cap: BIG, rank: 3 };
  }
  function widen(town, x, y) {
    const c = town.grid[y][x];
    if (!v3(town) || !c || c.t !== "road") return "skip";
    const n = widenStep(town, c);
    if (!n) return "This road is already as big as it gets.";
    if (town.rank < n.rank) return `🔒 Big roads unlock when your town is a ${RANKS[n.rank].name} (${RANKS[n.rank].at} people).`;
    if (town.coins < n.cost) return `A ${n.name.toLowerCase()} costs ${n.cost} coins.`;
    town.coins -= n.cost;
    c.wide = (c.wide ? +c.wide : 0) + 1;
    c.paid = (c.paid || 0) + n.cost;
    return null;
  }

  // Everything the mayor's screen shows: each home's face and what it's
  // missing, what each shop and factory would earn, and the year's sums.
  function look(town) {
    const g = town.grid, pop = people(town);
    // Damaged buildings don't work: hand the checker a copy without them.
    const working = g.map((row) => row.map((c) => (c && c.damaged && !homes(c.t) ? { t: "trees" } : c)));
    const roads = Sim.reach(g);
    const on = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => roads.has(x + dx + "," + (y + dy)));
    const isNew = v2(town), un = unlocked(town);
    const town2 = wantsFor(pop, town);
    // Version 2 asks the checker about every need any family might have,
    // then keeps the ones this family cares about.
    const ask = isNew ? Array.from(new Set(town2.concat(["school", "park", "clinic", "job"].filter((w) => w === "job" || un.includes(w))))) : town2;
    const ev = Sim.evaluate(working, ask);
    const around = (x, y, f) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const c = g[y + dy] && g[y + dy][x + dx]; if (c && f(c)) return true; } return false; };
    const tr = v3(town) ? traffic(g, roads) : null;
    const jamOn = !!tr && pop >= TRAFFIC_AT;
    const stuck = (h) => jamOn && (tr.routes[h.x + "," + h.y] || []).some((k) => tr.jammed.has(k));
    const hs = ev.houses.map((h) => {
      const c = g[h.y][h.x];
      let missing = h.missing.slice(), face = h.face, extras = [];
      if (isNew && c.fam) {
        const F = FAMS[c.fam];
        const wants = new Set(town2.concat(F.extra.filter((w) => w === "job" || w === "quiet" || w === "green" || un.includes(w))).filter((w) => !F.skip.includes(w)));
        missing = missing.filter((m) => wants.has(m));
        if (wants.has("quiet") && around(h.x, h.y, (o) => LOUD.includes(o.t) && !o.damaged)) missing.push("quiet");
        if (wants.has("green") && !around(h.x, h.y, (o) => o.t === "trees" || o.t === "water" || (o.t === "park" && !o.damaged))) missing.push("green");
        if (stuck(h)) missing.push("traffic");
        const linkedHome = !missing.includes("road");
        face = !missing.length ? "happy" : missing.length === 1 && linkedHome && !["noise", "quiet"].includes(missing[0]) ? "meh" : "sad";
      }
      if (c.damaged) { missing.push("repair"); face = "sad"; }
      let bonus = ["library", "stadium"].filter((t) => covered(working, h.x, h.y, t)).length;
      // Good neighbours: a park next door, or a view of the water.
      if (isNew && around(h.x, h.y, (o) => o.t === "park" && !o.damaged)) { bonus++; extras.push("park"); }
      if (isNew && around(h.x, h.y, (o) => o.t === "water")) { bonus++; extras.push("view"); }
      return { x: h.x, y: h.y, t: c.t, fam: c.fam || null, cap: capOf(c.t), live: c.live || 0, face, missing, bonus, extras };
    });
    const out = { people: pop, capacity: hs.reduce((n, h) => n + h.cap, 0), homes: hs, houses: hs, happy: 0, shops: [], works: [], tax: 0, earn: 0, upkeep: 0, tourists: 0 };
    // The castle: once a road reaches it, tourists visit and spend.
    let castle = null;
    if (isNew) g.forEach((row, y) => row.forEach((c, x) => { if (c && c.t === "castle" && on(x, y)) castle = { x, y }; }));
    if (castle) { out.tourists = 3; out.earn += 3; }
    hs.forEach((h) => { if (h.face === "happy") out.happy += h.live; });
    g.forEach((row, y) => row.forEach((c, x) => {
      if (!c || !T[c.t] || c.damaged || !on(x, y)) return;
      const Ty = T[c.t];
      out.upkeep += UPKEEP[c.t] ? UPKEEP[c.t] + (c.lv || 1) - 1 : 0;
      if (c.t === "shop") {
        const customers = hs.reduce((n, h) => n + (dist(h, { x, y }) <= LC.rangeOf(c) ? h.live : 0), 0);
        let coins = Math.min(LC.LEVELS.shop.earn[(c.lv || 1) - 1], Math.floor(customers / 5));
        const why = isNew ? perks(g, x, y, "shop", castle) : [];
        if (coins) why.forEach((w) => { coins += w.coins; });
        out.shops.push({ x, y, customers, coins, why });
        out.earn += coins;
      }
      if (c.t === "factory" || c.t === "station") {
        const workers = hs.reduce((n, h) => n + (dist(h, { x, y }) <= LC.JOB_RANGE ? h.live : 0), 0);
        let coins = c.t === "factory" ? Math.min(LC.LEVELS.factory.earn[(c.lv || 1) - 1], Math.floor(workers / 4)) : Ty.income;
        const why = isNew && c.t === "factory" ? perks(g, x, y, "factory", castle, town.spots, coins) : [];
        if (coins) why.forEach((w) => { coins += w.coins; });
        out.works.push({ x, y, t: c.t, workers, coins, why });
        out.earn += coins;
      }
    }));
    // Everyone pays TAX coins. Happy families and ones near a library or
    // stadium pay a little more, because they're doing well.
    out.tax = TAX * pop + Math.floor(out.happy / 3) + hs.reduce((n, h) => n + (h.live ? h.bonus : 0), 0);
    out.interest = Math.ceil(town.loan * INTEREST);
    out.balance = out.tax + out.earn - out.upkeep - out.interest;
    out.allHappy = hs.length > 0 && hs.every((h) => h.face === "happy");
    if (tr) {
      out.traffic = { load: tr.load, jammed: [...tr.jammed], on: jamOn };
      out.jams = tr.jammed.size;
    }
    return out;
  }

  // ── Building ───────────────────────────────────────────────────────────────
  // Returns null if it worked, or a kid-readable reason why not.
  function build(town, t, x, y) {
    const g = town.grid, c = g[y][x];
    if (!unlocked(town).includes(t)) return "🔒 That unlocks when your town is bigger.";
    if (c) return t === "road" ? "skip" : "That square is taken. Pick an empty grass square.";
    if (town.coins < T[t].cost) return "Not enough coins! Borrow from the 🏦 bank, or wait for next year's taxes.";
    town.coins -= T[t].cost;
    g[y][x] = homes(t) ? { t, live: 0 } : { t };
    if (homes(t) && v2(town)) { g[y][x].fam = town.nextFam; town.nextFam = drawFam(town); }
    return null;
  }
  // You get half back: a building has already been paid for and used.
  function bulldoze(town, x, y) {
    const c = town.grid[y][x];
    if (!c) return "skip";
    if (c.t === "trees") { if (town.coins < 2) return "Clearing trees costs 2 coins."; town.coins -= 2; town.grid[y][x] = null; return null; }
    if (c.t === "castle") return "🏰 The old castle is history: it stays! Build a road to it and tourists will come.";
    if (!T[c.t] || c.fixed) return c.fixed ? "🔒 That was here first: you can't bulldoze it." : "You can't bulldoze water!";
    town.coins += Math.floor((T[c.t].cost + (c.paid || 0)) / 2);
    town.grid[y][x] = null;
    return null;
  }

  // ── Upgrading ──────────────────────────────────────────────────────────────
  // Homes step up a type (house, flats, tower); everything else goes up a
  // level and reaches further. Bigger steps unlock as the town grows, so
  // there's always something to save up for.
  const HOME_UP = { house: { to: "flats", cost: 12, rank: 2 }, flats: { to: "tower", cost: 26, rank: 3 } };
  function nextStep(town, c) {
    if (!c || c.damaged) return null;
    if (HOME_UP[c.t]) {
      const u = HOME_UP[c.t], to = T[u.to];
      return { name: to.name, e: to.e, cost: u.cost, rank: u.rank, what: `room for ${to.people} people instead of ${T[c.t].people}` };
    }
    const L = LC.LEVELS[c.t];
    const lv = c.lv || 1;
    if (!L || lv >= L.names.length) return null;
    const cost = Math.ceil(T[c.t].cost * (lv === 1 ? 1 : 1.5));
    const what = L.ranges ? `reaches ${L.ranges[lv]} squares instead of ${L.ranges[lv - 1]}` : `can earn up to ${L.earn[lv]} coins a year instead of ${L.earn[lv - 1]}`;
    return { name: L.names[lv], e: L.e[lv], cost, rank: c.t === "library" ? 3 : lv, what: what + (UPKEEP[c.t] ? ", and costs 1 more coin a year to run" : "") };
  }
  function upgrade(town, x, y) {
    const c = town.grid[y][x], n = nextStep(town, c);
    if (!n) return "That can't be upgraded any more.";
    if (town.rank < n.rank) return `🔒 Upgrading to ${n.name} unlocks when your town is a ${RANKS[n.rank].name} (${RANKS[n.rank].at} people).`;
    if (town.coins < n.cost) return `Not enough coins: ${n.name} costs ${n.cost}.`;
    town.coins -= n.cost;
    c.paid = (c.paid || 0) + n.cost;
    if (HOME_UP[c.t]) c.t = HOME_UP[c.t].to; else c.lv = (c.lv || 1) + 1;
    return null;
  }
  const repairCost = (c) => Math.ceil(T[c.t].cost / 2);
  function repair(town, x, y) {
    const c = town.grid[y][x];
    if (!c || !c.damaged) return "skip";
    if (town.coins < repairCost(c)) return "Not enough coins to repair it yet.";
    town.coins -= repairCost(c);
    delete c.damaged;
    return null;
  }

  // ── The bank ───────────────────────────────────────────────────────────────
  const loanLimit = (town) => 60 + 2 * people(town);
  function borrow(town, n) {
    const can = loanLimit(town) - town.loan;
    if (can <= 0) return "The bank says: pay some back first!";
    const amt = Math.min(n, can);
    town.loan += amt;
    town.coins += amt;
    return null;
  }
  function repay(town, n) {
    const amt = Math.min(n, town.loan, town.coins);
    if (amt <= 0) return town.loan ? "You need coins to pay the loan back." : "You don't owe the bank anything!";
    town.loan -= amt;
    town.coins -= amt;
    // The medal is for a real loan, carried through at least one year.
    if (!town.loan && town.stats.owed) { town.stats.repaid++; town.stats.owed = false; award(town, "debtfree"); }
    return null;
  }

  // ── Medals ─────────────────────────────────────────────────────────────────
  function award(town, id) {
    if (town.medals.includes(id)) return false;
    town.medals.push(id);
    (town.newMedals = town.newMedals || []).push(id);
    return true;
  }

  // ── The year's one event ───────────────────────────────────────────────────
  const FAMILIES = ["Nguyen", "Smith", "Patel", "Kowalski", "Okafor", "Rossi", "Chen", "Murphy", "Ivanova", "Garcia"];
  const WISH = {
    park: "We'd love a park near our house for the kids to play in!",
    school: "Could we have a school closer to our house?",
    shop: "Please build a shop near us: it's a long walk for milk!",
    clinic: "We'd feel better with a clinic nearby.",
    library: "Our kids love books. Could you build a library near us?"
  };
  function event(town, r, st) {
    const g = town.grid, pop = st.people;
    const buildings = [];
    g.forEach((row, y) => row.forEach((c, x) => { if (c && T[c.t] && c.t !== "road" && !c.fixed) buildings.push({ x, y, c }); }));
    const pool = [["quiet", 3]];
    if (town.year > 1 && buildings.length >= 4) pool.push(["storm", 1.5]);
    if (town.year > 5 && buildings.length >= 6) pool.push(["fire", 1]);
    if (pop >= 8) pool.push(["festival", 2], ["heat", 1], ["boom", 2]);
    if (pop >= 4 && !town.request) pool.push(["request", 4]);
    if (pop >= 12 && !town.offer) pool.push(["offer", 3]);
    const wet = v2(town) ? buildings.filter((b) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[b.y + dy] && g[b.y + dy][b.x + dx] && g[b.y + dy][b.x + dx].t === "water")) : [];
    if (town.year > 2 && wet.length) pool.push(["flood", 1.2]);
    let roll = r() * pool.reduce((n, p) => n + p[1], 0), kind = "quiet";
    for (const [k, w] of pool) { roll -= w; if (roll < 0) { kind = k; break; } }

    if (kind === "storm") {
      const hit = pickOf(r, buildings);
      hit.c.damaged = true;
      town.stats.storms++;
      if (town.stats.storms >= 3) award(town, "storms");
      return { e: "🌩️", title: "A big storm!", text: `The wind damaged the ${LC.nameOf(hit.c).toLowerCase()} (marked on the map). Nobody was hurt, but it won't work until you tap it and pay to repair it.`, at: hit };
    }
    if (kind === "fire") {
      const unsafe = buildings.filter((b) => !covered(g, b.x, b.y, "fire"));
      if (!unsafe.length) {
        town.stats.fireSaved++;
        award(town, "firesafe");
        return { e: "🚒", title: "Fire! And the fire fighters saved the day", text: "A fire started, but your fire station was close enough to put it out straight away. Great planning!" };
      }
      const hit = pickOf(r, unsafe);
      const was = LC.nameOf(hit.c).toLowerCase();
      g[hit.y][hit.x] = null;
      return { e: "🔥", title: "A fire!", text: `The ${was} burned down. Everyone got out safely, but there was no fire station close enough to save it. A 🚒 fire station protects everything nearby.`, at: hit };
    }
    if (kind === "flood") {
      const hit = wet.slice().sort(() => r() - 0.5).slice(0, 2);
      hit.forEach((b) => { b.c.damaged = true; });
      const names = hit.map((b) => LC.nameOf(b.c).toLowerCase());
      return { e: "🌊", title: "A flood!", text: `Heavy rain made the water rise. The ${names.join(" and the ")} right next to the water got soaked and need repairs. Homes by the water have lovely views, but floods can reach them.`, at: hit[0] };
    }
    if (kind === "festival") { const n = Math.max(5, Math.floor(pop / 3)); town.coins += n; return { e: "🎉", title: "Town festival!", text: `Everyone came to the festival and it made ${n} coins for the town!`, coins: n }; }
    if (kind === "heat") return { e: "☀️", title: "Heatwave!", text: "It was SO hot. Families without a park nearby went to stay somewhere cooler, so their houses didn't grow this year.", heat: true };
    if (kind === "boom") return { e: "👶", title: "Baby boom!", text: "Lots of babies were born this year! Every happy home with room got one more person.", boom: true };
    if (kind === "request") {
      const wants = ["park", "school", "shop", "clinic"].concat(unlocked(town).includes("library") ? ["library"] : []);
      const asks = st.homes.filter((h) => h.live).flatMap((h) => wants.filter((w) => !covered(g, h.x, h.y, w)).map((w) => ({ h, w })));
      if (!asks.length) return { e: "💌", title: "A thank-you letter", text: "A family wrote to say they love living here. Everything they need is close by!" };
      const a = pickOf(r, asks), fam = pickOf(r, FAMILIES);
      town.request = { x: a.h.x, y: a.h.y, need: a.w, fam, due: town.year + 3, reward: 15 + 5 * Math.floor(pop / 20) };
      return { e: "✉️", title: `A letter from the ${fam} family`, text: `“${WISH[a.w]}” Build a ${T[a.w].name.toLowerCase()} close to their house (it's circled on the map) within 3 years for a thank-you of ${town.request.reward} coins.`, at: a.h };
    }
    if (kind === "offer") {
      const empty = [];
      g.forEach((row, y) => row.forEach((c, x) => { if (!c && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] && g[y + dy][x + dx].t === "road")) empty.push({ x, y }); }));
      if (!empty.length) return { e: "🌤️", title: "A quiet year", text: "Nothing special happened. A lovely, peaceful year!" };
      // A noisy offer next to homes is the interesting one: money now, or
      // happy neighbours?
      const nearHomes = empty.filter((p) => st.homes.some((h) => Math.abs(h.x - p.x) <= 1 && Math.abs(h.y - p.y) <= 1));
      const offers = [];
      if (nearHomes.length && unlocked(town).includes("factory")) { const p = pickOf(r, nearHomes); offers.push({ kind: "factory", x: p.x, y: p.y, coins: 30 + Math.floor(pop / 4), text: "A juice company wants to build a factory right next to some homes. They'll pay the town {c} coins. But factories are noisy! Say yes?" }); }
      { const p = pickOf(r, empty), fam = v2(town) ? pickOf(r, FAM_IDS) : null; offers.push({ kind: "house", x: p.x, y: p.y, coins: 0, fam, text: `A builder offers to build a house for free on the circled square${fam ? `, for a family of ${FAMS[fam].e} ${FAMS[fam].name.toLowerCase()}` : ""}. A new home, free! Say yes?` }); }
      const park = buildingsOf(g, "park");
      if (park.length) { const p = pickOf(r, park); offers.push({ kind: "sellpark", x: p.x, y: p.y, coins: 25 + Math.floor(pop / 5), text: "Someone wants to buy the circled park to build a car park, for {c} coins. Families near it would lose their park. Sell it?" }); }
      const o = pickOf(r, offers);
      o.text = o.text.replace("{c}", o.coins);
      town.offer = o;
      return { e: "🤝", title: "An offer for the town", text: o.text, choice: true, at: o };
    }
    return { e: "🌤️", title: "A quiet year", text: "Nothing special happened. A lovely, peaceful year!" };
  }
  // Why a shop or factory earns extra in a version 2 town: shops side by side
  // make a high street, tourists shop near the castle, traffic from a road
  // out of town stops by, and a factory on rocks digs up what it needs.
  function perks(g, x, y, t, castle, spots, base) {
    const out = [];
    const nb = (f) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = g[y + dy] && g[y + dy][x + dx]; return c && f(c); });
    if (t === "shop" && nb((c) => c.t === "shop" && !c.damaged)) out.push({ k: "street", coins: 2, text: "high street: another shop next door" });
    if (t === "shop" && castle && dist(castle, { x, y }) <= 3) out.push({ k: "castle", coins: 2, text: "tourists from the castle" });
    if (g.some((row, yy) => row.some((c, xx) => c && c.entry && Math.abs(xx - x) + Math.abs(yy - y) <= 2))) out.push({ k: "exit", coins: 2, text: "drivers stop on the way into town" });
    if (t === "factory" && spots && spots.some((p) => p.k === "rocks" && p.x === x && p.y === y)) out.push({ k: "rocks", coins: base || 0, text: "built on rocks: it earns double" });
    return out;
  }
  function buildingsOf(g, t) { const out = []; g.forEach((row, y) => row.forEach((c, x) => { if (c && c.t === t) out.push({ x, y }); })); return out; }
  function answer(town, yes) {
    const o = town.offer;
    town.offer = null;
    if (!o || !yes) return null;
    const g = town.grid;
    if (o.kind === "factory" && !g[o.y][o.x]) g[o.y][o.x] = { t: "factory" };
    if (o.kind === "house" && !g[o.y][o.x]) g[o.y][o.x] = o.fam ? { t: "house", live: 0, fam: o.fam } : { t: "house", live: 0 };
    if (o.kind === "sellpark" && g[o.y][o.x] && g[o.y][o.x].t === "park") g[o.y][o.x] = null;
    town.coins += o.coins;
    return o;
  }

  // ── Elections ──────────────────────────────────────────────────────────────
  // What families are missing, most common first (weighted by how many live
  // there), plus the loan if there is one.
  function complaints(town, st) {
    const n = {};
    st.homes.forEach((h) => { if (h.face !== "happy") h.missing.forEach((m) => { n[m] = (n[m] || 0) + Math.max(1, h.live); }); });
    if (town.loan > 0) n.loan = Math.max(1, Math.floor(st.people / 4));
    return Object.keys(n).sort((a, b) => n[b] - n[a]);
  }
  // Version 2 rivals stand for something the town really has: a need families
  // are missing, a kind of family that feels forgotten, coins piling up in
  // the treasury, factories next to homes, or the loan.
  const hoard = (town, pop) => town.coins - (50 + pop);
  function platforms(town, st) {
    const out = [];
    complaints(town, st).filter((n) => n !== "loan").slice(0, 2).forEach((n) => out.push({ kind: "need", need: n, promise: PROMISE[n], weight: 3 }));
    const byFam = {};
    st.homes.forEach((h) => { if (h.fam && h.live) { const b = byFam[h.fam] = byFam[h.fam] || { sad: 0, all: 0 }; b.all += h.live; if (h.face !== "happy") b.sad += h.live; } });
    const fam = Object.keys(byFam).sort((a, b) => byFam[b].sad - byFam[a].sad || byFam[b].all - byFam[a].all)[0];
    if (fam) out.push({ kind: "fam", fam, promise: `I'll listen to the ${FAMS[fam].name.toLowerCase()}! They want ${FAMS[fam].likes.split(":")[0].split(".")[0]}.`, weight: 1 + byFam[fam].sad / 4 });
    if (hoard(town, st.people) > 0) out.push({ kind: "coins", promise: `The mayor is sitting on ${town.coins} coins! I'll spend them on the town.`, weight: 1 + hoard(town, st.people) / 40 });
    if (town.loan > 0) out.push({ kind: "loan", need: "loan", promise: PROMISE.loan, weight: 1 + town.loan / 40 });
    if (st.homes.some((h) => h.live && h.fam !== "workers" && nearFactory(town.grid, h))) out.push({ kind: "quiet", promise: "Keep the factories away from homes!", weight: 1.5 });
    out.push({ kind: "need", need: "slide", promise: PROMISE.slide, weight: 0.1 });
    return out;
  }
  const nearFactory = (g, h) => g.some((row, y) => row.some((c, x) => c && c.t === "factory" && !c.damaged && Math.abs(x - h.x) <= 2 && Math.abs(y - h.y) <= 2));
  function startCampaign(town, r) {
    if (v2(town)) {
      const st = look(town), ps = platforms(town, st).sort((a, b) => b.weight - a.weight + (r() - 0.5) * 0.4);
      const first = ps[0], second = ps.find((p) => p !== first && (p.kind !== first.kind || p.need !== first.need)) || ps[ps.length - 1];
      const pool = RIVALS.slice();
      const rivals = [first, second].map((p) => { const who = pool.splice(Math.floor(r() * pool.length), 1)[0]; return { e: who.e, name: who.name, kind: p.kind, need: p.need || p.kind, fam: p.fam, promise: p.promise }; });
      town.campaign = { rivals, year: town.year, helped: town.stats.helped };
      town.snap = JSON.stringify(Object.assign({}, town, { snap: null, last: null }));
      return;
    }
    const st = look(town), wish = complaints(town, st).concat(["slide", "slide"]);
    const pool = RIVALS.slice();
    const rivals = [0, 1].map((k) => { const who = pool.splice(Math.floor(r() * pool.length), 1)[0]; return { e: who.e, name: who.name, need: wish[k], promise: PROMISE[wish[k]] }; });
    if (rivals[1].need === rivals[0].need) rivals[1].need = "slide", rivals[1].promise = PROMISE.slide;
    town.campaign = { rivals, year: town.year, helped: town.stats.helped };
    // A copy to go back to if the mayor loses: the start of the election
    // year, rivals and all.
    town.snap = JSON.stringify(Object.assign({}, town, { snap: null, last: null }));
  }
  // Every family with someone living there votes, one vote per person.
  // Happy homes vote for the mayor. OK homes split their votes if a rival
  // promises the thing they're missing (families don't all agree). Unhappy
  // homes vote for a rival: the one promising what they need, or the one
  // promising to pay back the loan, or anyone who isn't the mayor. Families
  // the mayor helped this term bring their friends.
  // Version 2: every home splits its votes by how much each side speaks to
  // it. Happy homes lean to the mayor, but a rival who stands up for their
  // kind of family, or points at coins nobody is spending, still wins some.
  const LOYAL = { happy: 4, meh: 2, sad: 0.3 };
  function appeal(town, st, rv, h) {
    let a = 0.6;
    if (rv.kind === "need" && h.missing.includes(rv.need)) a += h.face === "sad" ? 3 : 2;
    if (rv.kind === "fam" && h.fam === rv.fam) a += 1.2 + (h.face === "happy" ? 0 : 1.5);
    if (rv.kind === "coins" && hoard(town, st.people) > 0) a += Math.min(2.5, 0.5 + hoard(town, st.people) / 50);
    if (rv.kind === "loan" && town.loan > 0) a += Math.min(1.5, town.loan / 60);
    if (rv.kind === "quiet" && h.fam !== "workers" && nearFactory(town.grid, h)) a += 2;
    return a;
  }
  function tally2(town) {
    const c = town.campaign, st = look(town);
    const v = { mayor: 0, r0: 0, r1: 0 };
    st.homes.forEach((h) => {
      if (!h.live) return;
      const w = [LOYAL[h.face] + 0.75 * Math.min(2, h.bonus), appeal(town, st, c.rivals[0], h), appeal(town, st, c.rivals[1], h)];
      const sum = w[0] + w[1] + w[2];
      v.mayor += h.live * w[0] / sum; v.r0 += h.live * w[1] / sum; v.r1 += h.live * w[2] / sum;
    });
    const votes = { mayor: Math.round(v.mayor), r0: Math.round(v.r0), r1: Math.round(v.r1) };
    const thanks = 3 * Math.max(0, town.stats.helped - c.helped);
    votes.mayor += thanks;
    const total = votes.mayor + votes.r0 + votes.r1;
    const won = votes.mayor >= votes.r0 && votes.mayor >= votes.r1;
    return { votes, total, won, thanks, rivals: c.rivals };
  }
  function tally(town) {
    if (v2(town)) return tally2(town);
    const c = town.campaign, st = look(town);
    const votes = { mayor: 0, r0: 0, r1: 0 };
    st.homes.forEach((h) => {
      if (!h.live) return;
      if (h.face === "happy") { votes.mayor += h.live; return; }
      const k = c.rivals.findIndex((rv) => h.missing.includes(rv.need));
      if (h.face === "meh") {
        if (k < 0) { votes.mayor += h.live; return; }
        const half = Math.floor(h.live / 2);
        votes["r" + k] += h.live - half;
        votes.mayor += half;
        return;
      }
      const debt = c.rivals.findIndex((rv) => rv.need === "loan" && town.loan > 0);
      votes["r" + (k >= 0 ? k : debt >= 0 ? debt : 0)] += h.live;
    });
    const thanks = 3 * Math.max(0, town.stats.helped - c.helped);
    votes.mayor += thanks;
    const total = votes.mayor + votes.r0 + votes.r1;
    // Most votes wins; a tie keeps the mayor who's already there.
    const won = votes.mayor >= votes.r0 && votes.mayor >= votes.r1;
    return { votes, total, won, thanks, rivals: c.rivals };
  }
  function election(town, sum, poll) {
    const res = poll || tally(town);
    res.year = town.year;
    town.elections.push({ year: town.year, won: res.won, share: res.total ? Math.round(100 * res.votes.mayor / res.total) : 100 });
    if (res.won) {
      town.term++;
      award(town, "elected");
      if (res.total && res.votes.mayor * 4 >= res.total * 3) award(town, "landslide");
    } else {
      town.over = true;
      town.lost = true;
      const k = res.votes.r0 >= res.votes.r1 ? 0 : 1;
      res.winner = res.rivals[k];
    }
    town.campaign = null;
    sum.election = res;
  }
  // Lost? Go back to the start of the election year and try again. Medals
  // already won are kept.
  function retry(town) {
    if (!town.snap) return null;
    const back = JSON.parse(town.snap);
    back.medals = Array.from(new Set(back.medals.concat(town.medals)));
    back.snap = town.snap;
    return back;
  }

  // ── End the year ───────────────────────────────────────────────────────────
  function endYear(town) {
    if (town.over || town.farewell) return null;
    const r = rng(town.seed * 1000 + town.year);
    const before = look(town);
    const sum = { year: town.year, inn: 0, out: 0, why: {}, news: [], upgrades: 0, marks: [] };
    // Version 3 counts the votes on the town as the mayor left it, which is
    // exactly what the live poll showed, not after this year's newcomers.
    const poll = v3(town) && town.campaign && town.year % TERM === 0 ? tally(town) : null;
    const helpedBefore = town.stats.helped;
    town.newMedals = [];
    // An offer waits on the main screen for one year. Not answered by the
    // time the year ends means no.
    if (town.offer) { sum.news.push("🤝 Nobody answered the offer, so they took it to another town."); town.offer = null; }
    const ev = event(town, r, before);
    sum.event = ev;
    if (ev.at) sum.marks.push({ x: ev.at.x, y: ev.at.y, e: ev.e });

    // Families move in and out, a few at a time.
    const st = look(town);
    st.homes.forEach((h) => {
      const c = town.grid[h.y][h.x];
      if (!c || !homes(c.t)) return;
      let d = 0;
      const parked = covered(town.grid, h.x, h.y, "park");
      if (h.missing.includes("road")) d = -h.live;
      // Version 2 homes get bonuses from neighbours too, so it takes two to grow faster.
      else if (h.face === "happy") d = ev.heat && !parked ? 0 : 2 + (h.bonus >= (v2(town) ? 2 : 1) ? 1 : 0) + (ev.boom ? 1 : 0);
      else if (h.face === "meh") d = h.live < h.cap / 2 ? 1 : 0;
      else d = -1;
      const nv = Math.max(0, Math.min(h.cap, h.live + d));
      if (nv > h.live) sum.inn += nv - h.live;
      if (nv < h.live) { sum.out += h.live - nv; h.missing.forEach((m) => { sum.why[m] = (sum.why[m] || 0) + 1; }); sum.marks.push({ x: h.x, y: h.y, e: "🚪" }); }
      c.live = nv;
      // A house that stays full and happy grows into flats once flats exist.
      const k = h.x + "," + h.y;
      town.streak[k] = h.face === "happy" && nv === h.cap ? (town.streak[k] || 0) + 1 : 0;
      if (c.t === "house" && town.streak[k] >= 3 && town.rank >= HOME_UP.house.rank) { c.t = "flats"; town.streak[k] = 0; sum.upgrades++; sum.marks.push({ x: h.x, y: h.y, e: "🏢" }); }
    });
    // A train station brings new families to homes with room.
    if (buildingsOf(town.grid, "station").some((p) => !town.grid[p.y][p.x].damaged)) {
      let extra = 4;
      st.homes.forEach((h) => { const c = town.grid[h.y][h.x]; if (extra && c && homes(c.t) && h.face !== "sad" && c.live < capOf(c.t)) { const n = Math.min(extra, capOf(c.t) - c.live); c.live += n; extra -= n; sum.inn += n; } });
    }
    if (sum.upgrades) sum.news.push(`🏢 ${sum.upgrades} happy full house${sum.upgrades > 1 ? "s" : ""} grew into flats!`);

    // Money, worked out on the town as it is now.
    const now = look(town);
    Object.assign(sum, { tax: now.tax, earn: now.earn, upkeep: now.upkeep, interest: now.interest, balance: now.balance });
    town.coins += now.balance;
    if (town.coins < 0) {
      const need = -town.coins;
      town.loan += need;
      town.coins = 0;
      sum.news.push(`🏦 The town ran out of coins, so the bank lent it ${need}. Loans cost interest every year!`);
    }

    if (town.loan > 0) town.stats.owed = true;

    // Did we do what a family asked?
    const q = town.request;
    if (q) {
      const c = town.grid[q.y][q.x];
      if (!c || !homes(c.t)) town.request = null;
      else if (covered(town.grid, q.x, q.y, q.need)) {
        town.coins += q.reward;
        town.stats.helped++;
        if (town.stats.helped >= 3) award(town, "helper");
        sum.marks.push({ x: q.x, y: q.y, e: "💌" });
        sum.news.push(`✉️ The ${q.fam} family says THANK YOU for the ${T[q.need].name.toLowerCase()}! +${q.reward} coins.`);
        town.request = null;
      } else if (town.year >= q.due) {
        c.live = Math.max(0, (c.live || 0) - 2);
        sum.marks.push({ x: q.x, y: q.y, e: "😞" });
        sum.news.push(`😞 The ${q.fam} family waited 3 years for a ${T[q.need].name.toLowerCase()}. Two of them moved away.`);
        town.request = null;
      }
    }

    if (v3(town)) checkMissions(town, sum);
    if (poll) {
      // Families helped this year still bring their friends.
      const extra = 3 * (town.stats.helped - helpedBefore);
      poll.votes.mayor += extra; poll.thanks += extra; poll.total += extra;
      poll.won = poll.votes.mayor >= poll.votes.r0 && poll.votes.mayor >= poll.votes.r1;
    }
    if (town.campaign && town.year % TERM === 0) election(town, sum, poll);
    if (v2(town) && town.year === 6) highway(town, r, sum);
    // Version 3: a City gets one more road out, because a big town has a lot of cars.
    if (v3(town) && town.rank >= 3 && !town.highway3) { town.highway3 = true; highway(town, r, sum); }

    // Growing up: needs, ranks, unlocks, medals.
    town.year++;
    const pop = people(town);
    const later = look(town);
    const wl = wantsList(town);
    const nw = wl.filter(([, at]) => pop >= at).length;
    for (let k = town.wants; k < nw; k++) {
      const w = wl[k][0];
      sum.news.push(w === "job" ? "💼 The town is growing! Families now want jobs nearby: a shop, factory or station." : `📣 The town is growing! Families now want a ${T[w].e} ${T[w].name.toLowerCase()} nearby.`);
    }
    town.wants = Math.max(town.wants, nw);
    const rk = rankOf(pop);
    if (rk > town.rank) {
      for (let k = town.rank + 1; k <= rk; k++) sum.news.push(`${RANKS[k].e} You're a ${RANKS[k].name} now! New buildings: ${RANKS[k].unlock.map((t) => T[t].e + " " + T[t].name).join(", ")}.`);
      town.rank = rk;
    }
    if (pop > 0) award(town, "first");
    [["village", 20], ["town", 50], ["city", 100], ["big", 250]].forEach(([id, at]) => { if (pop >= at) award(town, id); });
    if (later.allHappy && pop >= 12) award(town, "allhappy");
    if (v3(town) && pop >= TRAFFIC_AT && !town.trafficOn) { town.trafficOn = true; sum.news.push("🚗 The town is busy now! Too many cars on one road make a traffic jam, and families stuck in it aren't happy. Widen a red road (tap it with 👆 Look), or give cars another way out."); }
    if (town.coins >= 200) award(town, "saver");
    if (town.year > 10) award(town, "ten");
    town.stats.best = Math.max(town.stats.best, pop);
    town.history.push(pop);
    if (town.history.length > 40) town.history.shift();
    sum.people = pop;
    sum.coins = town.coins;
    sum.medals = town.newMedals.slice();
    if (town.mode === "challenge" && town.year > CHALLENGE_YEARS) town.over = true;
    // A town that never ends: 10 terms is the most a mayor serves. The year
    // before the last gets a warning; after the last comes the farewell party
    // (towns already past it get theirs at the next end of year).
    if (town.mode !== "challenge" && !town.over) {
      if (town.year > TERM_LIMIT) { town.farewell = true; sum.farewell = true; sum.news.push(`🎖️ ${town.year - 1} years as mayor! It's time to hand over to someone new, with a farewell party.`); }
      else if (town.year === TERM_LIMIT) sum.news.push("📣 Next year is your last as mayor: 10 terms is the most a mayor can serve. Make it a great one!");
    }
    if (town.over) sum.final = score(town);
    else if (town.farewell) { /* no more elections: the party comes next */ }
    // No election in a mayor's very last year.
    else if (town.year % TERM === 0 && !(town.mode !== "challenge" && town.year >= TERM_LIMIT)) {
      startCampaign(town, r);
      sum.news.push("🗳️ Election next year! Two rivals want to be mayor. See what they promise, and keep the families happy to win their votes.");
    }
    town.marks = sum.marks;
    town.last = sum;
    return sum;
  }

  // Year 6 in a version 2 town: a new road out arrives on another side.
  function highway(town, r, sum) {
    const g = town.grid, have = [];
    g.forEach((row, y) => row.forEach((c, x) => { if (c && c.entry) have.push(c.side || (x === 0 ? "west" : "")); }));
    const sides = SIDES.filter((sd) => !have.includes(sd)).sort(() => r() - 0.5);
    for (const side of sides) {
      const along = side === "west" || side === "east" ? H : W, mid = (along - 1) / 2;
      const spots = Array.from({ length: along }, (_, k) => k).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid)).map((k) => edgeAt(side, k)).filter((p) => { const c = g[p.y][p.x]; return !c || c.t === "trees"; });
      if (!spots.length) continue;
      const p = spots[0];
      g[p.y][p.x] = { t: "road", fixed: true, entry: true, side, late: true };
      const word = { west: "west", east: "east", north: "north", south: "south" }[side];
      sum.news.push(`🛣️ A new highway reached town from the ${word}! Shops and factories near a road out of town earn extra.`);
      sum.marks.push({ x: p.x, y: p.y, e: "🛣️" });
      return;
    }
  }

  // ── The advisor ────────────────────────────────────────────────────────────
  // One tip for right now, the most useful first: what's broken, what's
  // urgent this year, what the most families are missing, then money,
  // the next family and the missions. Shown when the mayor isn't building.
  const NEED_TIP = {
    shop: (n) => `${n} famil${n === 1 ? "y wants" : "ies want"} a 🏪 shop nearby. Shops reach 3 squares and earn coins too.`,
    school: (n) => `${n} famil${n === 1 ? "y wants" : "ies want"} a 🏫 school. Pick the spot where the yellow reaches the most homes.`,
    park: (n) => `${n} famil${n === 1 ? "y wants" : "ies want"} a 🌳 park nearby. Parks are cheap!`,
    clinic: (n) => `${n} famil${n === 1 ? "y wants" : "ies want"} a 🏥 clinic within reach.`,
    fire: (n) => `${n} famil${n === 1 ? "y wants" : "ies want"} a 🚒 fire station. It also stops fires burning buildings down.`,
    police: (n) => `${n} famil${n === 1 ? "y wants" : "ies want"} a 🚓 police station nearby.`,
    job: (n) => `${n} famil${n === 1 ? "y needs" : "ies need"} jobs: a 🏪 shop, 🏭 factory or 🚉 station within 5 squares.`,
    noise: (n) => `${n} famil${n === 1 ? "y lives" : "ies live"} right next to a noisy 🏭 factory. Keep factories away from homes (workers don't mind).`,
    quiet: (n) => `👵 Grandparents want peace and quiet: no shop or factory in the 8 squares around them.`,
    green: (n) => `🌿 Nature lovers want trees, water or a 🌳 park right next door.`,
    traffic: (n) => `${n} famil${n === 1 ? "y is" : "ies are"} stuck in traffic.`,
    repair: () => "Something is broken: tap the 🔧 with 👆 Look to repair it."
  };
  function advice(town, st) {
    st = st || look(town);
    if (town.retired) return { e: "🎖️", text: `You retired after ${town.retired.year} years as a ${town.retired.legacy.title.toLowerCase()}. Start a new town from 🏙️ My towns whenever you like!` };
    if (town.over) return null;
    const live = st.homes.filter((h) => h.live);
    if (town.farewell) return { e: "🎖️", text: "Your last year is over. Time for your farewell party!", retire: true };
    if (!st.homes.length) return { e: "🏠", text: "Start with a road from the OUT road, then a 🏠 house next to it." + (v2(town) ? " The badge on House shows who moves in next." : "") };
    if (st.homes.some((h) => h.missing.includes("road"))) return { e: "🛣️", text: "A home has no road! Every building must touch a road that leads OUT of town." };
    if (town.grid.some((row) => row.some((c) => c && c.damaged))) return { e: "🔧", text: NEED_TIP.repair() };
    if (town.offer) return { e: "🤝", text: "An offer is waiting. Look at the circled square, then answer 👍 or 👎 before you end the year." };
    if (town.campaign) {
      const poll = tally(town), tot = poll.total || 1, rv = town.campaign.rivals;
      const share = Math.round(100 * poll.votes.mayor / tot);
      return { e: "🗳️", text: `Election this year, and you have ${share}% in the poll. ${rv[0].name} says “${rv[0].promise}” and ${rv[1].name} says “${rv[1].promise}” Fix what they promise to win votes back.` };
    }
    if (st.traffic && st.traffic.on && st.jams) return { e: "🚗", text: `${st.jams} road${st.jams === 1 ? " is" : "s are"} jammed (red). Tap one with 👆 Look to widen it, or build another way out so cars can go round.` };
    const count = {};
    st.homes.forEach((h) => h.missing.forEach((m) => { count[m] = (count[m] || 0) + 1; }));
    const top = Object.keys(count).filter((m) => NEED_TIP[m]).sort((a, b) => count[b] - count[a])[0];
    if (top) return { e: "💡", text: NEED_TIP[top](count[top]) };
    const q = town.request;
    if (q) return { e: "✉️", text: `The ${q.fam} family asked for a ${T[q.need].name.toLowerCase()} near them by year ${q.due}. Do it for ${q.reward} coins!` };
    if (canRetire(town) && (town.coins > 1000 || town.year > TERM_LIMIT - 4)) return { e: "🎖️", text: `${town.year - 1} years as mayor! Your town is all grown up. Whenever you're ready, retire with a farewell party: spend the treasury on gifts for the town and see your legacy.${town.year <= TERM_LIMIT ? ` (After year ${TERM_LIMIT} you have to.)` : ""}`, retire: true };
    if (town.loan && town.coins > 40) return { e: "🏦", text: "You have coins to spare: pay back some of the loan at the 🏦 bank. Loans cost interest every year." };
    if (v2(town) && town.coins > 60 + st.people) return { e: "💰", text: "That's a lot of coins sitting still! Spend them: upgrade busy buildings (tap one with 👆 Look). Rivals notice a mayor who doesn't spend." };
    if (town.missions) {
      const m = missionState(town, st).filter((x) => !x.done && !x.failed).sort((a, b) => b.have / b.need - a.have / a.need)[0];
      if (m && m.have) return { e: "🎯", text: `Mission ${m.e} ${m.name}: ${m.have} of ${m.need}. ${m.text[0].toUpperCase() + m.text.slice(1)}.` };
    }
    if (town.nextFam) { const F = FAMS[town.nextFam]; return { e: F.e, text: `Next to move in: ${F.name}. They want ${F.likes}. Find them a good spot!` }; }
    if (!live.length) return { e: "▶", text: "Press ▶ End year. Families move in when everything they need is close by." };
    return { e: "😀", text: "Everything looks good! Build more homes to grow, and keep an eye on the families." };
  }

  // ── Retiring ───────────────────────────────────────────────────────────────
  // From year 20 a mayor may retire; after 10 terms they must. The farewell
  // party spends the treasury on gifts for the town, then the legacy card
  // sums up the whole time as mayor.
  const TERM_LIMIT = 40, RETIRE_FROM = 20;
  const GIFTS = [
    { id: "flowers", e: "🌷", name: "Flowers on every street", cost: 100, pts: 10 },
    { id: "fountain", e: "⛲", name: "A grand fountain", cost: 500, pts: 30 },
    { id: "carousel", e: "🎠", name: "A merry-go-round", cost: 1000, pts: 50 },
    { id: "statue", e: "🗽", name: "A statue of you", cost: 2500, pts: 80 },
    { id: "fair", e: "🎡", name: "A fun fair", cost: 5000, pts: 120 },
    { id: "fireworks", e: "🎆", name: "Fireworks every New Year", cost: 8000, pts: 160 },
    { id: "space", e: "🚀", name: "A space museum", cost: 15000, pts: 220 }
  ];
  const TITLES = [{ at: 0, name: "Good mayor", stars: 1 }, { at: 600, name: "Great mayor", stars: 2 }, { at: 1100, name: "Legendary mayor", stars: 3 }];
  const canRetire = (town) => !town.over && town.mode !== "challenge" && (town.farewell || town.year > RETIRE_FROM);
  function legacy(town, gifts, left) {
    const st = look(town);
    const won = (town.elections || []).filter((e) => e.won).length;
    const missions = (town.missions || []).filter((m) => m.done).length;
    const giftPts = (gifts || []).reduce((n, id) => n + (GIFTS.find((g) => g.id === id) || { pts: 0 }).pts, 0);
    const parts = [
      { e: "👥", name: "Most people", n: town.stats.best, pts: town.stats.best },
      { e: "😀", name: "Happy people now", n: st.happy, pts: st.happy },
      { e: "🗳️", name: "Elections won", n: won, pts: 15 * won },
      { e: "🎯", name: "Missions done", n: missions, pts: 40 * missions },
      { e: "🏅", name: "Medals", n: town.medals.length, pts: 10 * town.medals.length },
      { e: "🎁", name: "Farewell gifts", n: (gifts || []).length, pts: giftPts },
      { e: "💰", name: "Coins left for the next mayor", n: left, pts: Math.floor(left / 200) }
    ].filter((p) => p.name !== "Missions done" || town.missions);
    const pts = parts.reduce((n, p) => n + p.pts, 0);
    const title = TITLES.reduce((t, x) => (pts >= x.at ? x : t), TITLES[0]);
    return { pts, parts, title: title.name, stars: title.stars, years: town.year - 1, people: st.people, happy: st.happy };
  }
  function retire(town, gifts) {
    if (!canRetire(town)) return "Not yet: a mayor can retire after 20 years.";
    const list = (gifts || []).filter((id, i, a) => a.indexOf(id) === i && GIFTS.some((g) => g.id === id));
    const cost = list.reduce((n, id) => n + GIFTS.find((g) => g.id === id).cost, 0);
    if (cost > town.coins) return "Those gifts cost more coins than the town has.";
    town.coins -= cost;
    award(town, "retired");
    const lg = legacy(town, list, town.coins);
    if (lg.stars >= 3) award(town, "legend");
    town.retired = { year: town.year - 1, gifts: list, legacy: legacy(town, list, town.coins) };
    town.over = true;
    town.farewell = false;
    town.campaign = null;
    town.offer = null;
    return null;
  }

  // The 20-year challenge: people count most, happy people and savings help,
  // and a loan still owed counts against you.
  function score(town) {
    const st = look(town);
    const done = (town.missions || []).filter((m) => m.done).length;
    const pts = st.people + st.happy + Math.floor(town.coins / 10) - town.loan + MISSION_PTS * done;
    // Version 2 towns can grow bigger with families planned for, so the
    // stars ask for more.
    // Version 3 adds traffic (harder) and missions (+40 each).
    const at = v3(town) ? [150, 360, 600] : v2(town) ? [150, 380, 680] : [100, 260, 450];
    return { pts, stars: pts >= at[2] ? 3 : pts >= at[1] ? 2 : pts >= at[0] ? 1 : 0, at, people: st.people, happy: st.happy, missions: done };
  }

  return {
    W, H, V, START_COINS, CHALLENGE_YEARS, UPKEEP, TERM, PROMISE, RANKS, MEDALS, LANDS, WANTS, FAMS, LOUD, wantsList, isV2: v2, isV3: v3, advice, GIFTS, TERM_LIMIT, RETIRE_FROM, canRetire, legacy, retire, MISSIONS, CAP, WIDE, BIG, WIDEN, TRAFFIC_AT, ROAD_NAMES, capOfRoad, widen, widenStep, missionState,
    create, makeMap, look, build, bulldoze, repair, upgrade, nextStep, repairCost, borrow, repay, loanLimit, answer, endYear, score,
    people, unlocked, rankOf, covered, wantsFor, rng, tally, retry, complaints
  };
})();
