/* Circuit Lab - the electricity. Pure: no DOM, so tools/circuit-check.js can  */
/* load it in plain node and prove every level can be won.                     */
/*                                                                             */
/* The board is a grid of dots. Every part sits on an edge between two dots,  */
/* like a snap-together kit. An edge key is "h:c:r" (dot c,r to dot c+1,r) or */
/* "v:c:r" (dot c,r to dot c,r+1). Current is positive from the first dot to  */
/* the second, and a battery's + end is always its second dot.                 */
/*                                                                             */
/* Solving is real nodal analysis rather than "is there a loop?", because the */
/* whole point of chapter 2 is that two bulbs in a row glow dimmer than two   */
/* side by side. A loop search can't tell those apart.                         */
"use strict";
window.CL = window.CL || {};

CL.Circuit = (function () {
  const VOLTS = 3;        // one battery
  const R_BATT = 0.05;    // its insides; keeps a short circuit finite, not infinite
  const R_LOAD = 3;       // a bulb, buzzer or motor
  const P0 = VOLTS * VOLTS / R_LOAD;  // a bulb's power on one battery = brightness 1

  const LIT = 0.1;        // below this a bulb looks dark
  const BRIGHT = 0.6;     // two bulbs in a row land at 0.25, side by side at 0.94
  const SUPER = 2;        // two batteries in a row give 3.8
  const BLOW = 5;         // three give 8, and the bulb pops
  const SHORT = 8;        // amps out of a battery; a real short gives ~30+

  // r: resistance. null means it doesn't let electricity through at all.
  const PARTS = {
    wire:    { r: 0.01, emoji: "\u{3030}\u{FE0F}", label: "Wire" },
    battery: { r: null, emoji: "\u{1F50B}", label: "Battery", source: true },
    bulb:    { r: R_LOAD, emoji: "\u{1F4A1}", label: "Bulb", load: true },
    switch:  { r: 0.01, emoji: "\u{1F39A}\u{FE0F}", label: "Switch" },
    buzzer:  { r: R_LOAD, emoji: "\u{1F514}", label: "Buzzer", load: true },
    motor:   { r: R_LOAD, emoji: "\u{1F300}", label: "Fan", load: true },
    // Things to test. Pencil "lead" is graphite: it conducts, but grudgingly,
    // so it gives exactly the dim glow two bulbs in a row do.
    coin:    { r: 0.02, emoji: "\u{1FA99}", label: "Coin", thing: true },
    clip:    { r: 0.02, emoji: "\u{1F4CE}", label: "Paper clip", thing: true },
    key:     { r: 0.02, emoji: "\u{1F511}", label: "Key", thing: true },
    pencil:  { r: 3,    emoji: "\u{270F}\u{FE0F}", label: "Pencil lead", thing: true },
    wood:    { r: null, emoji: "\u{1FAB5}", label: "Wood", thing: true },
    paper:   { r: null, emoji: "\u{1F4C4}", label: "Paper", thing: true },
    balloon: { r: null, emoji: "\u{1F388}", label: "Rubber balloon", thing: true }
  };

  function ends(key, cols) {
    const [d, c, r] = key.split(":");
    const x = +c, y = +r;
    const a = y * cols + x;
    return d === "h" ? [a, a + 1] : [a, a + cols];
  }

  // Every edge on a cols x rows grid of dots.
  function edges(grid) {
    const out = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (c < grid.cols - 1) out.push("h:" + c + ":" + r);
        if (r < grid.rows - 1) out.push("v:" + c + ":" + r);
      }
    }
    return out;
  }

  // Resistance of a placed part right now, or null if it's a gap.
  function resistance(p, k, sw) {
    if (p.type === "switch") return (sw ? sw[k] : p.on) ? PARTS.switch.r : null;
    if (p.type === "bulb" && p.broken) return null;
    return PARTS[p.type].r;
  }

  // Gaussian elimination with partial pivoting. n is at most 35, so this is
  // nothing.
  function linsolve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let m = i;
      for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k;
      [A[i], A[m]] = [A[m], A[i]];
      [b[i], b[m]] = [b[m], b[i]];
      const piv = A[i][i];
      for (let k = i + 1; k < n; k++) {
        const f = A[k][i] / piv;
        if (!f) continue;
        for (let j = i; j < n; j++) A[k][j] -= f * A[i][j];
        b[k] -= f * b[i];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  // parts: { key: { type, on, broken } }. sw, if given, is { key: on } for
  // every switch (used to try all the switch positions when checking a goal).
  function solve(grid, parts, sw) {
    const n = grid.cols * grid.rows;
    const G = Array.from({ length: n }, () => new Array(n).fill(0));
    const I = new Array(n).fill(0);
    // A whisper of a path from every dot to "ground", so a dot with nothing
    // on it still has a voltage and the maths never divides by zero.
    for (let i = 0; i < n; i++) G[i][i] = 1e-6;
    const link = (a, b, g) => { G[a][a] += g; G[b][b] += g; G[a][b] -= g; G[b][a] -= g; };

    const keys = Object.keys(parts);
    keys.forEach((k) => {
      const p = parts[k];
      const [a, b] = ends(k, grid.cols);
      if (p.type === "battery") {
        // A battery with a little resistance inside is the same as a current
        // source beside that resistance (Norton), which slots straight in.
        link(a, b, 1 / R_BATT);
        I[b] += VOLTS / R_BATT;
        I[a] -= VOLTS / R_BATT;
        return;
      }
      const r = resistance(p, k, sw);
      if (r != null) link(a, b, 1 / r);
    });

    const V = linsolve(G, I);
    const cur = {}, level = {};
    let short = false;
    keys.forEach((k) => {
      const p = parts[k];
      const [a, b] = ends(k, grid.cols);
      if (p.type === "battery") {
        cur[k] = (VOLTS - (V[b] - V[a])) / R_BATT;
        if (Math.abs(cur[k]) > SHORT) short = true;
        return;
      }
      const r = resistance(p, k, sw);
      cur[k] = r == null ? 0 : (V[a] - V[b]) / r;
      if (PARTS[p.type].load) level[k] = cur[k] * cur[k] * r / P0;
    });
    // Tidy the numerical dust, so "no current" is exactly 0 for the drawing.
    keys.forEach((k) => { if (Math.abs(cur[k]) < 1e-4) cur[k] = 0; });
    return { cur, level, short };
  }

  // Solve, pop any bulb given far too much push, and solve again, until
  // nothing else pops. Marks the popped bulbs on `parts` and lists them.
  function settle(grid, parts) {
    const popped = [];
    for (;;) {
      const res = solve(grid, parts);
      const over = Object.keys(res.level).filter((k) => parts[k].type === "bulb" && res.level[k] > BLOW);
      if (!over.length) { res.popped = popped; return res; }
      over.forEach((k) => { parts[k].broken = true; popped.push(k); });
    }
  }

  const on = (level) => (level || 0) >= LIT;
  const of = (parts, type) => Object.keys(parts).filter((k) => parts[k].type === type && !parts[k].broken);

  // Every load of `type` must follow exactly one switch of its own, through
  // every combination of switch positions. Brute force: at most 2^6 solves.
  function controls(grid, parts, type, n) {
    const sws = of(parts, "switch");
    const loads = of(parts, type);
    if (sws.length < n || loads.length < n || sws.length > 6) return false;
    const seen = loads.map(() => []);
    for (let m = 0; m < (1 << sws.length); m++) {
      const pos = {};
      sws.forEach((k, j) => { pos[k] = !!(m & (1 << j)); });
      const res = solve(grid, parts, pos);
      if (res.short) return false;
      loads.forEach((k, i) => seen[i].push(on(res.level[k]) ? 1 : 0));
    }
    const used = new Set();
    return loads.every((_, i) => {
      const j = sws.findIndex((_, s) => !used.has(s) &&
        seen[i].every((bit, m) => bit === ((m >> s) & 1)));
      if (j < 0) return false;
      used.add(j);
      return true;
    });
  }

  // Has the level been won? Returns { ok } plus, when it hasn't, a nudge
  // worth showing a kid who is close.
  function goal(g, grid, parts, res, extra) {
    const bulbs = of(parts, "bulb");
    const lvl = (k) => res.level[k] || 0;
    if (g.type === "tested") {
      const done = g.things.filter((t) => extra.tested[t]).length;
      return done === g.things.length ? { ok: true } : { ok: false, hint: extra.tested.__any ? "Tested " + done + " of " + g.things.length + "." : "" };
    }
    if (res.short) return { ok: false };
    if (g.type === "lit" || g.type === "bright") {
      const n = g.n || 1;
      const lit = bulbs.filter((k) => on(lvl(k)));
      if (bulbs.length < n || lit.length < bulbs.length) {
        return { ok: false, hint: lit.length && n > 1 ? "One is lit. Can you light them all?" : "" };
      }
      if (g.type === "lit") return { ok: true };
      if (bulbs.every((k) => lvl(k) >= BRIGHT)) return { ok: true };
      return { ok: false, hint: "They're lit, but dim. Can you give each bulb its own path?" };
    }
    if (g.type === "dim") {
      const lit = bulbs.filter((k) => on(lvl(k)));
      if (!lit.length) return { ok: false };
      if (lit.every((k) => lvl(k) < BRIGHT)) return { ok: true };
      return { ok: false, hint: "Too bright! Find something that lets only a little electricity through." };
    }
    if (g.type === "super") {
      if (bulbs.some((k) => lvl(k) >= SUPER)) return { ok: true };
      return { ok: false, hint: bulbs.some((k) => on(lvl(k))) ? "It's lit. Now make it extra bright!" : "" };
    }
    if (g.type === "controls") {
      if (!controls(grid, parts, g.load, g.n || 1)) {
        const loads = of(parts, g.load);
        const some = loads.some((k) => on(lvl(k)));
        return { ok: false, hint: some ? "It works, but not with its own switch yet. Put the switch in the loop." : "" };
      }
      const offs = of(parts, "switch").filter((k) => !parts[k].on);
      if (offs.length) return { ok: false, hint: "\u{1F449} Tap the switch" + (offs.length > 1 ? "es" : "") + " to turn " + (offs.length > 1 ? "them" : "it") + " on!" };
      return { ok: true };
    }
    return { ok: false };
  }

  // What a thing in the test spot did to the bulb: yes, a little, or no.
  function verdict(level) {
    return level >= BRIGHT ? "yes" : on(level) ? "little" : "no";
  }

  return { PARTS, LIT, BRIGHT, SUPER, BLOW, edges, ends, solve, settle, goal, verdict, on };
})();
