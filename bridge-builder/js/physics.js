/* Bridge Builder - the engineering. Pure: no DOM, so tools/bridge-check.js   */
/* can load it in plain node and prove every level holds and fails as meant.  */
/*                                                                             */
/* Static, not a spring simulation. Every frame the truck moves a little and  */
/* the bridge is solved for where it settles under that load (the direct      */
/* stiffness method). There is no time step to blow up, so a bridge never     */
/* jiggles itself apart: it holds, bends, or snaps, and always the same way.  */
/*                                                                             */
/* Joints sit on a grid, spacing 1, y pointing DOWN (screen way up). Roads    */
/* are welded to each other, so a road is one long plank that bends. Beams    */
/* are pinned at both ends, so a beam only pushes or pulls, and a frame of    */
/* squares folds up. That difference IS chapter 2.                             */
"use strict";
window.BB = window.BB || {};

BB.Physics = (function () {
  const MAT = {
    // Beams are ten times stiffer along their length than a road is across
    // it. Any closer and the road soaks up bending from the truss sagging
    // under it, and no truss could carry a big truck.
    road:  { EA: 20000, EI: 20, N: 6, M: 0.7, w: 0.06, label: "Road", emoji: "\u{1F6E3}\u{FE0F}" },
    beam:  { EA: 20000, EI: 0,  N: 3, M: 0,   w: 0.04, label: "Wood beam", emoji: "\u{1FAB5}" },
    steel: { EA: 40000, EI: 0,  N: 6, M: 0,   w: 0.07, label: "Steel beam", emoji: "\u{1F529}" }
  };
  const TRUCKS = {
    car:   { w: 1,   len: 1.0, emoji: "\u{1F697}", label: "Car" },
    truck: { w: 2,   len: 1.2, emoji: "\u{1F69A}", label: "Truck" },
    fire:  { w: 2,   len: 1.2, emoji: "\u{1F692}", label: "Fire truck" },
    big:   { w: 4,   len: 1.4, emoji: "\u{1F69B}", label: "Big truck" }
  };
  const LOOSE = 0.6;   // a joint that moves further than this has come apart

  // A member is { a, b, mat } where a and b are "c,r" joint ids.
  const xy = (id) => id.split(",").map(Number);

  // Gaussian elimination with partial pivoting.
  function linsolve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let m = i;
      for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k;
      if (m !== i) { const t = A[i]; A[i] = A[m]; A[m] = t; const u = b[i]; b[i] = b[m]; b[m] = u; }
      const piv = A[i][i];
      for (let k = i + 1; k < n; k++) {
        const f = A[k][i] / piv;
        if (!f) continue;
        const Ak = A[k], Ai = A[i];
        for (let j = i; j < n; j++) Ak[j] -= f * Ai[j];
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

  // Local 6x6 stiffness (u1 v1 t1 u2 v2 t2) for a beam-column element.
  function local(EA, EI, L) {
    const a = EA / L, b = 12 * EI / (L * L * L), c = 6 * EI / (L * L), d = 4 * EI / L, e = 2 * EI / L;
    return [
      [a, 0, 0, -a, 0, 0],
      [0, b, c, 0, -b, c],
      [0, c, d, 0, -c, e],
      [-a, 0, 0, a, 0, 0],
      [0, -b, -c, 0, b, -c],
      [0, c, e, 0, -c, d]
    ];
  }

  function geom(m) {
    const [x1, y1] = xy(m.a), [x2, y2] = xy(m.b);
    const L = Math.hypot(x2 - x1, y2 - y1);
    return { L, c: (x2 - x1) / L, s: (y2 - y1) / L };
  }
  // local = R * global, per joint: [c s 0; -s c 0; 0 0 1]
  function toLocal(g, d) {
    const { c, s } = g;
    return [c * d[0] + s * d[1], -s * d[0] + c * d[1], d[2], c * d[3] + s * d[4], -s * d[3] + c * d[4], d[5]];
  }

  // anchors: joint ids pinned to the ground. loads: { id: downward force }.
  // Returns every joint's movement and every member's strain, where strain 1
  // means "exactly at breaking point".
  function solve(members, anchors, loads) {
    const ids = [];
    const index = {};
    const add = (id) => { if (!(id in index)) { index[id] = ids.length; ids.push(id); } };
    members.forEach((m) => { add(m.a); add(m.b); });
    Object.keys(loads).forEach(add);
    const n = ids.length * 3;
    const K = Array.from({ length: n }, () => new Float64Array(n));
    const F = new Array(n).fill(0);
    // A hair of stiffness everywhere so a floppy bit shows up as a huge
    // movement (and falls off) instead of a division by zero. Not 1e-6: next
    // to the anchors' 1e7 that is too many orders of magnitude for doubles,
    // and the rounding error made a whole good truss look loose.
    for (let i = 0; i < n; i++) K[i][i] = 1e-3;

    members.forEach((m) => {
      const P = MAT[m.mat];
      const g = geom(m);
      m._g = g;
      const k = local(P.EA, P.EI, g.L);
      const { c, s } = g;
      // K_global = T' k T, written out per 3x3 block.
      const T = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
      const dofs = [index[m.a] * 3, index[m.a] * 3 + 1, index[m.a] * 3 + 2, index[m.b] * 3, index[m.b] * 3 + 1, index[m.b] * 3 + 2];
      const full = (i, j) => T[i % 3][j % 3] * (Math.floor(i / 3) === Math.floor(j / 3) ? 1 : 0);
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          let v = 0;
          for (let p = 0; p < 6; p++) {
            const tpi = full(p, i);
            if (!tpi) continue;
            for (let q = 0; q < 6; q++) {
              const tqj = full(q, j);
              if (tqj) v += tpi * k[p][q] * tqj;
            }
          }
          K[dofs[i]][dofs[j]] += v;
        }
      }
      // Its own weight, half on each end.
      const w = P.w * g.L / 2;
      F[dofs[1]] += w;
      F[dofs[4]] += w;
    });
    Object.keys(loads).forEach((id) => { F[index[id] * 3 + 1] += loads[id]; });
    anchors.forEach((id) => {
      if (!(id in index)) return;
      const i = index[id] * 3;
      K[i][i] += 1e7;
      K[i + 1][i + 1] += 1e7;
    });

    const D = linsolve(K.map((r) => Array.from(r)), F);
    const move = {};
    ids.forEach((id, i) => { move[id] = [D[i * 3], D[i * 3 + 1]]; });
    const strain = members.map((m) => {
      const P = MAT[m.mat];
      const g = m._g;
      const ia = index[m.a] * 3, ib = index[m.b] * 3;
      const d = toLocal(g, [D[ia], D[ia + 1], D[ia + 2], D[ib], D[ib + 1], D[ib + 2]]);
      const k = local(P.EA, P.EI, g.L);
      const f = k.map((row) => row.reduce((s, v, j) => s + v * d[j], 0));
      const N = f[3];                      // + pulling, - squashing
      const M = Math.max(Math.abs(f[2]), Math.abs(f[5]));
      return { N, M, x: Math.abs(N) / P.N + (P.M ? M / P.M : 0) };
    });
    return { move, strain };
  }

  // Where the truck's weight goes. Each axle's share is split between the two
  // ends of the road piece under it, by how close it is to each. On the banks
  // the ground takes it. Returns null for an axle over thin air.
  function truckLoads(members, deckRow, banks, truck, x) {
    const t = TRUCKS[truck];
    const loads = {};
    let air = false;
    [x - t.len / 2, x + t.len / 2].forEach((ax) => {
      if (ax <= banks[0] || ax >= banks[1]) return;
      const road = members.find((m) => m.mat === "road" && !m.gone && xy(m.a)[1] === deckRow && xy(m.b)[1] === deckRow &&
        Math.min(xy(m.a)[0], xy(m.b)[0]) <= ax && Math.max(xy(m.a)[0], xy(m.b)[0]) >= ax);
      if (!road) { air = true; return; }
      const [xa] = xy(road.a), [xb] = xy(road.b);
      const f = (ax - xa) / (xb - xa);
      loads[road.a] = (loads[road.a] || 0) + (t.w / 2) * (1 - f);
      loads[road.b] = (loads[road.b] || 0) + (t.w / 2) * f;
    });
    return { loads, air };
  }

  // One moment of a test: solve, then let the worst over-strained member snap
  // and anything left dangling fall, and solve again, until nothing changes.
  // Members that snap or fall get `gone` set and are listed in `broke`.
  function settle(members, anchors, loads) {
    const broke = [];
    for (let guard = 0; guard < 200; guard++) {
      const live = members.filter((m) => !m.gone);
      const res = solve(live, anchors, loads);
      let worst = -1, wx = 1;
      res.strain.forEach((s, i) => { if (s.x > wx) { wx = s.x; worst = i; } });
      const loose = live.filter((m) => Math.hypot(...res.move[m.a]) > LOOSE || Math.hypot(...res.move[m.b]) > LOOSE);
      if (worst < 0 && !loose.length) {
        live.forEach((m, i) => { m.strain = res.strain[i].x; m.N = res.strain[i].N; });
        res.broke = broke;
        return res;
      }
      if (worst >= 0) {
        // Keep the force it broke under: + stretched, - squashed. The game
        // says which, because "squashed" and "stretched" need different fixes.
        live[worst].gone = "snap";
        live[worst].N = res.strain[worst].N;
        broke.push(live[worst]);
      }
      else loose.forEach((m) => { m.gone = "fall"; broke.push(m); });
    }
    throw new Error("settle did not settle");
  }

  // ── A level's board ────────────────────────────────────────────────────────
  // Dots run from the left bank edge (x=0) to the right (x=gap), rows lo..hi.
  // On the bank edges only the road dot and the one just below it exist; the
  // rest of the bank is solid ground.
  function dots(lv) {
    const out = [];
    for (let y = lv.rows[0]; y <= lv.rows[1]; y++) {
      for (let x = 0; x <= lv.gap; x++) {
        if ((x === 0 || x === lv.gap) && y > 1) continue;
        out.push(x + "," + y);
      }
    }
    return out;
  }
  function anchors(lv) {
    const a = ["0,0", lv.gap + ",0"];
    if (lv.rows[1] >= 1) a.push("0,1", lv.gap + ",1");
    (lv.rocks || []).forEach((r) => a.push(r.join(",")));
    return a;
  }
  // Can a piece of `mat` go between dots a and b? Returns null if so, or the
  // reason it can't, in words a kid can act on.
  function canJoin(lv, a, b, mat) {
    const all = dots(lv);
    if (all.indexOf(a) < 0 || all.indexOf(b) < 0) return "That's not a dot.";
    const [x1, y1] = xy(a), [x2, y2] = xy(b);
    if (Math.abs(x1 - x2) > 1 || Math.abs(y1 - y2) > 1 || a === b) return "Pieces only join dots that are next to each other.";
    if (x1 === x2 && (x1 === 0 || x1 === lv.gap)) return "That's solid riverbank already.";
    if (mat === "road" && !(y1 === 0 && y2 === 0)) return "Road only goes flat, along the road line.";
    return null;
  }
  const key = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

  return { MAT, TRUCKS, LOOSE, solve, settle, truckLoads, xy, dots, anchors, canJoin, key };
})();
