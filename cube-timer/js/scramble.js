/* Cube Timer — scrambles, and a model of the cube they make.                    */
/*                                                                              */
/* Two jobs. First, hand out a fresh scramble: a random list of moves with the   */
/* redundant ones filtered out, so nobody is asked to turn the same face twice   */
/* in a row. Second, work out what the cube LOOKS like afterwards, so the timer  */
/* can draw the picture — an 8-year-old checks their scramble against a picture, */
/* not against the notation.                                                     */
/*                                                                              */
/* The cube is stickers in space, not six flat grids. Every sticker knows the    */
/* cubie it sits on (x,y,z) and which way it faces (its normal), and a turn is   */
/* one rotation applied to both. That is why the same twenty lines handle 2x2,   */
/* 3x3 and the wide moves of a 4x4: the only thing a bigger cube changes is how  */
/* many cubies a turn sweeps up.                                                 */
"use strict";
window.CT = window.CT || {};

CT.Scramble = (function () {

  /* ── Randomness ────────────────────────────────────────────────────────── */
  // crypto where there is one (the browser, and node's harness), Math.random
  // as a last resort so nothing can throw on an old tablet.
  const crypt = (typeof crypto !== "undefined" && crypto.getRandomValues) ? crypto : null;

  function randInt(n) {
    if (!crypt) return Math.floor(Math.random() * n);
    // Reject the tail of the range so every value is equally likely.
    const limit = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    let v;
    do { crypt.getRandomValues(buf); v = buf[0]; } while (v >= limit);
    return v % n;
  }

  /* ── The puzzles on offer ──────────────────────────────────────────────── */
  // `moves` are the faces that may be turned. A 2x2 only ever needs three of
  // them: turning the other three is the same cube seen from somewhere else.
  const PUZZLES = {
    "2x2": { id: "2x2", label: "2×2", size: 2, length: 11, moves: ["R", "U", "F"] },
    "3x3": { id: "3x3", label: "3×3", size: 3, length: 20, moves: ["U", "D", "L", "R", "F", "B"] },
    "4x4": {
      id: "4x4", label: "4×4", size: 4, length: 40,
      moves: ["U", "D", "L", "R", "F", "B", "Uw", "Dw", "Lw", "Rw", "Fw", "Bw"]
    }
  };
  const ORDER = ["2x2", "3x3", "4x4"];

  const SUFFIX = ["", "'", "2"];

  // Outward normals, in the coordinate system x-right, y-up, z-towards-you.
  const NORMALS = {
    U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0],
    L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1]
  };
  // Opposite faces share an axis, and three moves along one axis can always be
  // written as two — so the generator refuses the third.
  const AXIS = { U: "y", D: "y", R: "x", L: "x", F: "z", B: "z" };

  /* ── Generating a scramble ─────────────────────────────────────────────── */

  // A move is a face letter, an optional w for "two layers", and a suffix.
  const faceOf = (move) => move[0];

  function generate(puzzleId) {
    const p = PUZZLES[puzzleId] || PUZZLES["3x3"];
    const out = [];
    let lastFace = "", prevFace = "", lastAxis = "", prevAxis = "";

    while (out.length < p.length) {
      const move = p.moves[randInt(p.moves.length)];
      const face = faceOf(move);
      const axis = AXIS[face];
      // Never the same face twice running — R then R' is just one turn, and it
      // looks to a kid like the app is stuck.
      if (face === lastFace) continue;
      // And never three on one axis (R L R), which is two turns dressed up as
      // three. Two in a row is fine and genuinely happens.
      if (axis === lastAxis && axis === prevAxis && face === prevFace) continue;
      out.push(move + SUFFIX[randInt(SUFFIX.length)]);
      prevFace = lastFace; prevAxis = lastAxis;
      lastFace = face; lastAxis = axis;
    }
    return out;
  }

  /* ── The cube itself ───────────────────────────────────────────────────── */
  /* Cubie coordinates are centred and odd-spaced: on a 3x3 they are -2, 0, 2,
   * on a 4x4 -3, -1, 1, 3. Centring means a turn is a rotation about the
   * origin, and the spacing keeps them whole numbers so a sticker's key is
   * exact — no floating point anywhere near the cube. */

  const key = (p, n) => p[0] + "," + p[1] + "," + p[2] + "|" + n[0] + "," + n[1] + "," + n[2];
  const coord = (i, size) => 2 * i - (size - 1);

  // Where each face's grid sits in space. `origin` is the sticker at row 0,
  // column 0; `row` and `col` step one square down and one square right, as the
  // face is drawn on the net. Everything else about drawing follows from these.
  const LAYOUT = {
    U: { n: [0, 1, 0], corner: [0, 1, 0], row: [0, 0, 1], col: [1, 0, 0] },
    D: { n: [0, -1, 0], corner: [0, 0, 1], row: [0, 0, -1], col: [1, 0, 0] },
    F: { n: [0, 0, 1], corner: [0, 1, 1], row: [0, -1, 0], col: [1, 0, 0] },
    B: { n: [0, 0, -1], corner: [1, 1, 0], row: [0, -1, 0], col: [-1, 0, 0] },
    R: { n: [1, 0, 0], corner: [1, 1, 1], row: [0, -1, 0], col: [0, 0, -1] },
    L: { n: [-1, 0, 0], corner: [0, 1, 0], row: [0, -1, 0], col: [0, 0, 1] }
  };
  const FACES = ["U", "R", "F", "D", "L", "B"];

  // Where a face's (row, column) square lives in space. `corner` is given in
  // 0/1 form — which end of each axis the first square sits at — so the same
  // table works whatever the cube's size.
  function stickerAt(face, r, c, size) {
    const L = LAYOUT[face], last = size - 1;
    const p = [0, 1, 2].map((k) => {
      const start = L.corner[k] ? last : 0;
      return coord(start + L.row[k] * r + L.col[k] * c, size);
    });
    return { p, n: L.n };
  }

  function solved(size) {
    const cube = { size: size, st: new Map() };
    for (const f of FACES) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const s = stickerAt(f, r, c, size);
          cube.st.set(key(s.p, s.n), f);
        }
      }
    }
    return cube;
  }

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];

  // A quarter turn clockwise as seen from outside the face — Rodrigues with the
  // angle at -90°, where the cosine drops out and only two terms survive.
  function spin(v, n) {
    const c = cross(n, v), d = dot(n, v);
    return [n[0] * d - c[0], n[1] * d - c[1], n[2] * d - c[2]];
  }

  function turn(cube, face, depth, quarters) {
    const n = NORMALS[face], size = cube.size;
    // Stickers this deep into the cube and no deeper. Layer k out from the face
    // sits at size-1-2k along the normal.
    const cut = size - 1 - 2 * (depth - 1);
    let st = cube.st;
    for (let q = 0; q < quarters; q++) {
      const next = new Map();
      st.forEach((colour, k) => {
        const bits = k.split("|");
        const p = bits[0].split(",").map(Number);
        const nm = bits[1].split(",").map(Number);
        if (dot(p, n) >= cut) next.set(key(spin(p, n), spin(nm, n)), colour);
        else next.set(k, colour);
      });
      st = next;
    }
    cube.st = st;
    return cube;
  }

  // "Rw2" → the R face, two layers deep, two quarter turns.
  function apply(cube, moves) {
    for (const m of moves) {
      const face = m[0];
      if (!NORMALS[face]) continue;
      const wide = m.indexOf("w") > 0;
      const suffix = m[m.length - 1];
      const quarters = suffix === "2" ? 2 : suffix === "'" ? 3 : 1;
      turn(cube, face, wide ? 2 : 1, quarters);
    }
    return cube;
  }

  function scrambled(puzzleId, moves) {
    const p = PUZZLES[puzzleId] || PUZZLES["3x3"];
    return apply(solved(p.size), moves);
  }

  // Six grids of colour letters, ready for the net to be drawn from.
  function grids(cube) {
    const out = {};
    for (const f of FACES) {
      const rows = [];
      for (let r = 0; r < cube.size; r++) {
        const row = [];
        for (let c = 0; c < cube.size; c++) {
          const s = stickerAt(f, r, c, cube.size);
          row.push(cube.st.get(key(s.p, s.n)));
        }
        rows.push(row);
      }
      out[f] = rows;
    }
    return out;
  }

  // Reading a scramble aloud is easier in short bursts than as one long line.
  function inGroups(moves, per) {
    const out = [];
    for (let i = 0; i < moves.length; i += (per || 5)) out.push(moves.slice(i, i + (per || 5)));
    return out;
  }

  return {
    PUZZLES, ORDER, FACES,
    generate, solved, apply, scrambled, grids, inGroups,
    // exported for the checker in tools/
    _turn: turn
  };
})();
