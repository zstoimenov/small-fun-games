/* Little City - the town: what's on each square, who can get home, what each */
/* house needs, and the money. No DOM here, so tools/ can run it.              */
/*                                                                             */
/* A grid is rows of cells: null (grass), { t: "water" | "trees" }, or a      */
/* building { t, fixed, entry }. `fixed` came with the level and can't be     */
/* bulldozed; `entry` roads lead out of town, and every road must link back   */
/* to one.                                                                     */
"use strict";
window.LC = window.LC || {};

// range: how far a service reaches, counted in squares across plus squares
// down (so a school with range 4 reaches 4 steps along the streets' grid).
// Money only matters in levels with a budget and in the sandbox.
LC.TYPES = {
  road: { e: "🛣️", name: "Road", cost: 1 },
  house: { e: "🏠", name: "House", people: 4, cost: 6 },
  flats: { e: "🏢", name: "Flats", people: 10, cost: 14 },
  tower: { e: "🏙️", name: "Tower", people: 20, cost: 30 },
  park: { e: "🌳", name: "Park", need: "park", range: 3, cost: 6, upkeep: 1 },
  shop: { e: "🏪", name: "Shop", need: "shop", range: 3, cost: 10, income: 3, jobs: true },
  school: { e: "🏫", name: "School", need: "school", range: 4, cost: 20, upkeep: 5 },
  clinic: { e: "🏥", name: "Clinic", need: "clinic", range: 4, cost: 20, upkeep: 5 },
  fire: { e: "🚒", name: "Fire station", need: "fire", range: 5, cost: 16, upkeep: 4 },
  factory: { e: "🏭", name: "Factory", cost: 18, income: 6, jobs: true, noisy: true },
  // Only in Be the Mayor, unlocked as the town grows.
  library: { e: "📚", name: "Library", bonus: true, range: 4, cost: 24, upkeep: 3 },
  police: { e: "🚓", name: "Police", need: "police", range: 5, cost: 20, upkeep: 3 },
  station: { e: "🚉", name: "Train station", station: true, jobs: true, cost: 40, upkeep: 2, income: 4 },
  stadium: { e: "🏟️", name: "Stadium", bonus: true, range: 6, cost: 60, upkeep: 5 }
};
LC.JOB_RANGE = 5;
LC.NEEDS = {
  road: "I can't get home: there's no road to my house!",
  school: "The school is too far away for my kids.",
  clinic: "The clinic is too far away if I get sick.",
  fire: "What if there's a fire? The fire station is too far.",
  shop: "There's nowhere near to buy food!",
  park: "There's nowhere for the kids to play.",
  noise: "The factory next door is SO noisy!",
  job: "I can't find a job near here.",
  police: "I'd feel safer with a police station nearby.",
  repair: "The storm broke our roof! Please fix it.",
  quiet: "It's so busy and loud next door. We like peace and quiet!",
  green: "We'd love trees, water or a park right next to our house."
};
LC.HAPPY = ["I love living here!", "Everything I need is close by!", "Best town ever!", "What a lovely street!"];
// Buildings in Be the Mayor can be upgraded. A level is stored on the cell
// (lv: 1, 2 or 3) and mostly means "reaches further"; the lessons never set
// it, so level 1 must match the plain numbers above.
LC.LEVELS = {
  shop: { names: ["Shop", "Mall", "Megamall"], e: ["🏪", "🏬", "🛍️"], ranges: [3, 5, 7], earn: [5, 10, 16] },
  park: { names: ["Park", "Big park", "Botanic garden"], e: ["🌳", "⛲", "🌺"], ranges: [3, 4, 6] },
  school: { names: ["School", "Big school", "College"], e: ["🏫", "🏫", "🎓"], ranges: [4, 6, 8] },
  clinic: { names: ["Clinic", "Hospital", "Big hospital"], e: ["🏥", "🏥", "🏥"], ranges: [4, 6, 8] },
  fire: { names: ["Fire station", "Big fire station", "Fire headquarters"], e: ["🚒", "🚒", "🚒"], ranges: [5, 7, 9] },
  police: { names: ["Police", "Big police station", "Police headquarters"], e: ["🚓", "🚓", "🚓"], ranges: [5, 7, 9] },
  factory: { names: ["Factory", "Big factory", "Mega factory"], e: ["🏭", "🏭", "🏭"], earn: [8, 14, 20] },
  library: { names: ["Library", "Big library"], e: ["📚", "📚"], ranges: [4, 6] }
};
LC.rangeOf = function (c) {
  const T = LC.TYPES[c.t], L = LC.LEVELS[c.t];
  if (L && L.ranges) return L.ranges[(c.lv || 1) - 1];
  return T.range || (T.jobs ? LC.JOB_RANGE : 0);
};
LC.nameOf = (c) => (LC.LEVELS[c.t] ? LC.LEVELS[c.t].names[(c.lv || 1) - 1] : LC.TYPES[c.t].name);

const CODES = { r: "road", h: "house", b: "flats", p: "park", s: "shop", k: "school", c: "clinic", f: "fire", x: "factory" };

LC.Sim = (function () {
  const homes = (t) => t === "house" || t === "flats" || t === "tower";
  const cells = (g) => { const out = []; g.forEach((row, y) => row.forEach((c, x) => out.push({ c, x, y }))); return out; };
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const near = (g, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((p) => g[p.y] && p.x >= 0 && p.x < g[0].length);

  // A level map is rows of letters: . grass, ~ water, ^ trees, E the road out
  // of town, and r h b p s k c f x for road, house, flats, park, shop, school,
  // clinic, fire station and factory. Capitals can't be bulldozed.
  function parse(rows) {
    return rows.map((row) => [...row].map((ch) => {
      if (ch === ".") return null;
      if (ch === "~") return { t: "water" };
      if (ch === "^") return { t: "trees" };
      if (ch === "E") return { t: "road", fixed: true, entry: true };
      const t = CODES[ch.toLowerCase()];
      return t ? { t, fixed: ch !== ch.toLowerCase() } : null;
    }));
  }

  // Roads that link to a road out of town, then buildings touching one.
  function reach(g) {
    const ok = new Set(), queue = [];
    cells(g).forEach(({ c, x, y }) => { if (c && c.entry) { ok.add(x + "," + y); queue.push({ x, y }); } });
    while (queue.length) {
      const p = queue.shift();
      near(g, p.x, p.y).forEach((q) => { const c = g[q.y][q.x], k = q.x + "," + q.y; if (c && c.t === "road" && !ok.has(k)) { ok.add(k); queue.push(q); } });
    }
    return ok;
  }
  function linked(g, roads, x, y) { return near(g, x, y).some((q) => roads.has(q.x + "," + q.y)); }

  // The whole town: every house's needs and face, people, and money.
  // needs: which needs count in this level, e.g. ["road", "school"].
  function evaluate(g, needs) {
    const roads = reach(g);
    const all = cells(g).filter(({ c }) => c && LC.TYPES[c.t] && c.t !== "road");
    const working = all.filter(({ c, x, y }) => linked(g, roads, x, y));
    const out = { houses: [], people: 0, happy: 0, unlinked: 0, cost: 0, upkeep: 0, income: 0, tax: 0 };
    out.unlinked = all.length - working.length;
    cells(g).forEach(({ c }) => { if (c && LC.TYPES[c.t] && !c.fixed) out.cost += LC.TYPES[c.t].cost; });
    working.forEach(({ c }) => { const T = LC.TYPES[c.t]; out.upkeep += T.upkeep || 0; out.income += T.income || 0; });

    all.filter(({ c }) => homes(c.t)).forEach((h) => {
      const T = LC.TYPES[h.c.t], missing = [];
      const on = linked(g, roads, h.x, h.y);
      if (!on) missing.push("road");
      needs.forEach((n) => {
        if (n === "road") return;
        if (n === "noise") { if (all.some((o) => LC.TYPES[o.c.t].noisy && Math.abs(o.x - h.x) <= 1 && Math.abs(o.y - h.y) <= 1)) missing.push("noise"); return; }
        if (n === "job") { if (!working.some((o) => LC.TYPES[o.c.t].jobs && dist(o, h) <= LC.JOB_RANGE)) missing.push("job"); return; }
        if (!working.some((o) => LC.TYPES[o.c.t].need === n && dist(o, h) <= LC.rangeOf(o.c))) missing.push(n);
      });
      const face = !missing.length ? "happy" : missing.length === 1 && on && missing[0] !== "noise" ? "meh" : "sad";
      const people = on ? T.people : 0;
      out.people += people;
      if (face === "happy") out.happy += people;
      out.houses.push({ x: h.x, y: h.y, t: h.c.t, people: T.people, face, missing });
    });
    // Everyone who has a home pays a little tax; happy towns pay a bit more.
    out.tax = out.people + Math.floor(out.happy / 4);
    out.income += out.tax;
    out.balance = out.income - out.upkeep;
    out.allHappy = out.houses.length > 0 && out.houses.every((h) => h.face === "happy");
    return out;
  }

  // Which squares a service reaches, for the coloured range shading.
  function covers(g, x, y) {
    const r = LC.rangeOf(g[y][x]);
    const out = [];
    g.forEach((row, yy) => row.forEach((_, xx) => { if (Math.abs(xx - x) + Math.abs(yy - y) <= r) out.push([xx, yy]); }));
    return out;
  }

  // ── Rules for a brief ──────────────────────────────────────────────────────
  function check(rule, s, level) {
    if (rule.linked) return s.unlinked === 0;
    if (rule.people) return s.people >= rule.people;
    if (rule.happy === "all") return s.allHappy;
    if (rule.happy) return s.happy >= rule.happy;
    if (rule.budget) return s.cost <= level.money;
    if (rule.balance) return s.balance >= 0;
    if (rule.covered) return s.houses.every((h) => !h.missing.includes(rule.covered));
    return true;
  }

  return { parse, reach, evaluate, covers, check, homes };
})();
