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
    steel: { EA: 40000, EI: 0,  N: 6, M: 0,   w: 0.07, label: "Steel beam", emoji: "\u{1F529}" },
    // Old wood: the same beam, rotten enough to break at well under half the load.
    old:   { EA: 20000, EI: 0,  N: 1.4, M: 0, w: 0.04, label: "Old wood", emoji: "\u{1FAB5}" },
    // Rope only pulls. Pushed, it goes slack and does nothing, so it can hang
    // a road from a tower but never prop one up. It may reach up to ROPE dots.
    rope:  { EA: 20000, EI: 0,  N: 6, M: 0,   w: 0.01, label: "Rope", emoji: "\u{1FAA2}", pull: true }
  };
  const ROPE = 4;
  // Coins, for levels with a budget instead of a parts box.
  const COST = { road: 2, beam: 1, steel: 3, old: 0, rope: 1 };
  const TRUCKS = {
    car:   { w: 1,   len: 1.0, emoji: "\u{1F697}", label: "Car" },
    bus:   { w: 3,   len: 1.4, emoji: "\u{1F68C}", label: "Bus" },
    truck: { w: 2,   len: 1.2, emoji: "\u{1F69A}", label: "Truck" },
    fire:  { w: 2,   len: 1.2, emoji: "\u{1F692}", label: "Fire truck" },
    big:   { w: 4,   len: 1.4, emoji: "\u{1F69B}", label: "Big truck" }
  };
  const LOOSE = 0.6;   // a joint that moves further than this has come apart

  // A member is { a, b, mat } where a and b are "c,r" joint ids.
  const xy = (id) => id.split(",").map(Number);

  // LU factorisation with partial pivoting, then solving with it. The
  // stiffness only changes when a piece breaks or a rope goes slack, so one
  // factorisation serves every frame of the truck rolling along.
  function lu(A) {
    const n = A.length, piv = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      let m = i;
      for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k;
      piv[i] = m;
      if (m !== i) { const t = A[i]; A[i] = A[m]; A[m] = t; }
      const Ai = A[i], d = Ai[i];
      for (let k = i + 1; k < n; k++) {
        const Ak = A[k], f = Ak[i] / d;
        Ak[i] = f;
        if (!f) continue;
        for (let j = i + 1; j < n; j++) Ak[j] -= f * Ai[j];
      }
    }
    return { A, piv };
  }
  function luSolve(F, b) {
    const { A, piv } = F, n = b.length, x = b.slice();
    for (let i = 0; i < n; i++) {
      if (piv[i] !== i) { const t = x[i]; x[i] = x[piv[i]]; x[piv[i]] = t; }
      let s = x[i];
      const Ai = A[i];
      for (let j = 0; j < i; j++) s -= Ai[j] * x[j];
      x[i] = s;
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = x[i];
      const Ai = A[i];
      for (let j = i + 1; j < n; j++) s -= Ai[j] * x[j];
      x[i] = s / Ai[i];
    }
    return x;
  }
  let cache = { key: "", F: null };

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
    const key = ids.join(";") + "|" + members.map((m) => m.a + m.b + m.mat).join(";") + "|" + anchors.join(";");
    const fresh = cache.key !== key;
    const K = fresh ? Array.from({ length: n }, () => new Float64Array(n)) : null;
    const F = new Array(n).fill(0);
    // A hair of stiffness everywhere so a floppy bit shows up as a huge
    // movement (and falls off) instead of a division by zero. Not 1e-6: next
    // to the anchors' 1e7 that is too many orders of magnitude for doubles,
    // and the rounding error made a whole good truss look loose.
    if (fresh) for (let i = 0; i < n; i++) K[i][i] = 1e-3;

    members.forEach((m) => {
      const P = MAT[m.mat];
      const g = geom(m);
      m._g = g;
      const dofs = [index[m.a] * 3, index[m.a] * 3 + 1, index[m.a] * 3 + 2, index[m.b] * 3, index[m.b] * 3 + 1, index[m.b] * 3 + 2];
      // Its own weight, half on each end.
      const w = P.w * g.L / 2;
      F[dofs[1]] += w;
      F[dofs[4]] += w;
      if (!fresh) return;
      const k = local(P.EA, P.EI, g.L);
      const { c, s } = g;
      // K_global = T' k T, written out per 3x3 block.
      const T = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
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
    });
    Object.keys(loads).forEach((id) => { F[index[id] * 3 + 1] += loads[id]; });
    if (fresh) anchors.forEach((id) => {
      if (!(id in index)) return;
      const i = index[id] * 3;
      K[i][i] += 1e7;
      K[i + 1][i + 1] += 1e7;
    });

    if (fresh) cache = { key, F: lu(K) };
    const D = luSolve(cache.F, F);
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
  // Ropes first find out which of them are pulling: solve, let any rope
  // being pushed go slack, take back any slack rope that would be stretched,
  // and solve again until that stops changing.
  function solveRopes(live, anchors, loads) {
    for (let k = 0; ; k++) {
      const on = live.filter((m) => !m.slack);
      const res = solve(on, anchors, loads);
      const strain = new Map(on.map((m, i) => [m, res.strain[i]]));
      let changed = false;
      if (k < 12) {
        live.forEach((m) => {
          if (!MAT[m.mat].pull) return;
          if (!m.slack && strain.get(m).N < -1e-9) { m.slack = true; changed = true; }
          else if (m.slack && res.move[m.a] && res.move[m.b]) {
            const [x1, y1] = xy(m.a), [x2, y2] = xy(m.b), L = Math.hypot(x2 - x1, y2 - y1);
            const da = res.move[m.a], db = res.move[m.b];
            const grow = ((db[0] - da[0]) * (x2 - x1) + (db[1] - da[1]) * (y2 - y1)) / L;
            if (grow > 1e-9) { m.slack = false; changed = true; }
          }
        });
      }
      if (!changed) {
        res.strain = live.map((m) => strain.get(m) || { N: 0, M: 0, x: 0 });
        return res;
      }
    }
  }

  // One moment of a test: solve, then let the worst over-strained member snap
  // and anything left dangling fall, and solve again, until nothing changes.
  // Members that snap or fall get `gone` set and are listed in `broke`.
  function settle(members, anchors, loads) {
    const broke = [];
    for (let guard = 0; guard < 200; guard++) {
      const live = members.filter((m) => !m.gone);
      const res = solveRopes(live, anchors, loads);
      let worst = -1, wx = 1;
      res.strain.forEach((s, i) => { if (s.x > wx) { wx = s.x; worst = i; } });
      // A slack rope just hangs there; it can't come loose.
      const far = (id) => !res.move[id] || Math.hypot(...res.move[id]) > LOOSE;
      const loose = live.filter((m) => !m.slack && (far(m.a) || far(m.b)));
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
  // Dots run from the left bank edge (x=0) to the right (x=gap), rows lo..hi,
  // y down. Ground is the two banks plus any islands ([from, to] in x). A
  // bank or island edge has its road dot and the one just below it; deeper
  // wall dots exist only where the level puts a pin. The rest is solid.
  //
  // Optional level fields (the Bridge Trail uses them):
  //   islands [[x0,x1]]   more ground in the middle of the river
  //   pins    ["x,y"]     the only anchors besides the road ends and rocks,
  //                       replacing the usual pin under each road end
  //   towers  ["x,y"]     stone towers on the banks: anchors high up, for ropes
  //   holes   ["x,y"]     dots that aren't there
  //   lane    [x0,x1]     the boat lane: nothing below the road between them
  //   snow    n           extra weight on every bit of road, per step
  //   convoy  [kinds]     trucks that follow the first one across
  //   budget  n           coins to spend instead of a parts box (COST)
  const islands = (lv) => lv.islands || [];
  function ground(lv, x) {
    return x <= 0 || x >= lv.gap || islands(lv).some(([a, b]) => x >= a && x <= b);
  }
  const edges = (lv) => [0, lv.gap].concat(...islands(lv));
  const inside = (lv, x) => islands(lv).some(([a, b]) => x > a && x < b);
  function dots(lv) {
    const out = [];
    const extra = (lv.pins || []).concat(lv.towers || []);
    const isEdge = (x) => edges(lv).indexOf(x) >= 0;
    for (let y = lv.rows[0]; y <= lv.rows[1]; y++) {
      for (let x = 0; x <= lv.gap; x++) {
        const id = x + "," + y;
        if (isEdge(x) && y > 1 && extra.indexOf(id) < 0) continue;
        if (inside(lv, x) && y >= 0) continue;
        if ((lv.holes || []).indexOf(id) >= 0) continue;
        out.push(id);
      }
    }
    extra.forEach((id) => { if (out.indexOf(id) < 0) out.push(id); });
    return out;
  }
  function anchors(lv) {
    const a = [];
    edges(lv).forEach((x) => {
      a.push(x + ",0");
      if (!lv.pins && lv.rows[1] >= 1) a.push(x + ",1");
    });
    (lv.pins || []).concat(lv.towers || []).forEach((id) => a.push(id));
    (lv.rocks || []).forEach((r) => a.push(r.join(",")));
    return a;
  }
  // Would a piece from a to b cross the boat lane?
  function inLane(lv, a, b) {
    if (!lv.lane) return false;
    const [x1, y1] = xy(a), [x2, y2] = xy(b);
    for (let t = 0; t <= 1.0001; t += 0.125) {
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      if (x > lv.lane[0] + 1e-6 && x < lv.lane[1] - 1e-6 && y > 1e-6) return true;
    }
    return false;
  }
  // Can a piece of `mat` go between dots a and b? Returns null if so, or the
  // reason it can't, in words a kid can act on.
  function canJoin(lv, a, b, mat) {
    const all = dots(lv);
    if (all.indexOf(a) < 0 || all.indexOf(b) < 0) return "That's not a dot.";
    const [x1, y1] = xy(a), [x2, y2] = xy(b);
    const reach = mat === "rope" ? ROPE : 1;
    if (Math.abs(x1 - x2) > reach || Math.abs(y1 - y2) > reach || a === b) {
      return mat === "rope" ? "A rope reaches up to " + ROPE + " dots away." : "Pieces only join dots that are next to each other.";
    }
    if (x1 === x2 && y1 >= 0 && y2 >= 0 && edges(lv).indexOf(x1) >= 0) return "That's solid riverbank already.";
    if (mat === "road" && !(y1 === 0 && y2 === 0)) return "Road only goes flat, along the road line.";
    if (mat === "road" && ground(lv, (x1 + x2) / 2)) return "That's solid ground already.";
    if (inLane(lv, a, b)) return "Keep the boat lane clear! Nothing can go under the road there.";
    return null;
  }
  // The cost of a design in coins.
  const cost = (ms) => ms.reduce((n, m) => n + (m.locked ? 0 : COST[m.mat] || 0), 0);

  // Every truck on the road at once: the first one at x, any convoy behind.
  const GAP = 1.8;
  function trucksAt(lv, kind, x) {
    return [kind].concat(lv.convoy || []).map((k, i) => ({ kind: k, x: x - i * GAP }));
  }
  // The weight on the bridge: every truck's axles, plus any snow on the road.
  // air is true when an axle is over thin air.
  function loadsAt(lv, members, kind, x) {
    const loads = {};
    let air = false;
    trucksAt(lv, kind, x).forEach((tr) => {
      const t = TRUCKS[tr.kind];
      [tr.x - t.len / 2, tr.x + t.len / 2].forEach((ax) => {
        if (ground(lv, ax)) return;
        const road = members.find((m) => m.mat === "road" && !m.gone && xy(m.a)[1] === 0 && xy(m.b)[1] === 0 &&
          Math.min(xy(m.a)[0], xy(m.b)[0]) <= ax && Math.max(xy(m.a)[0], xy(m.b)[0]) >= ax);
        if (!road) { air = true; return; }
        const [xa] = xy(road.a), [xb] = xy(road.b);
        const f = (ax - xa) / (xb - xa);
        loads[road.a] = (loads[road.a] || 0) + (t.w / 2) * (1 - f);
        loads[road.b] = (loads[road.b] || 0) + (t.w / 2) * f;
      });
    });
    if (lv.snow) {
      members.forEach((m) => {
        if (m.gone || m.mat !== "road") return;
        loads[m.a] = (loads[m.a] || 0) + lv.snow / 2;
        loads[m.b] = (loads[m.b] || 0) + lv.snow / 2;
      });
    }
    return { loads, air };
  }
  // How far the first truck drives before everyone is across.
  const finishX = (lv) => lv.gap + 1.4 + (lv.convoy || []).length * GAP;

  const key = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

  return { MAT, TRUCKS, COST, ROPE, GAP, LOOSE, solve, settle, truckLoads, loadsAt, trucksAt, finishX, ground, edges, xy, dots, anchors, canJoin, inLane, cost, key };
})();
