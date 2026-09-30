/* Bridge Builder - draws the river, the banks, the bridge and the truck as  */
/* SVG, and turns a finger on it into "this dot" or "this piece".            */
/*                                                                             */
/* The scenery is built once per level. Everything that moves (the bridge    */
/* bending, the truck, pieces falling into the river) is one layer redrawn   */
/* from scratch every frame: at a few dozen pieces that is cheaper to get    */
/* right than keeping hundreds of elements in step.                          */
"use strict";
window.BB = window.BB || {};

BB.Board = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const U = 100;          // one grid step in SVG units
  const EXAG = 4;         // bends are drawn 4x bigger than they are, so you can see them
  const Ph = BB.Physics;
  const EMOJI = 'font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif"';

  let svg, live, lv, onDot, onPiece, box, water;

  function mk(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const P = (id) => Ph.xy(id).map((v) => v * U);

  function build(host, level, dot, piece) {
    lv = level;
    onDot = dot;
    onPiece = piece;
    host.innerHTML = "";
    const x0 = -1.8, x1 = lv.gap + 1.8, y0 = lv.rows[0] - 0.9, y1 = Math.max(lv.rows[1], 1) + 1.1;
    box = { x0: x0 * U, y0: y0 * U, w: (x1 - x0) * U, h: (y1 - y0) * U };
    water = (Math.max(lv.rows[1], 1) + 0.55) * U;
    svg = mk("svg", { viewBox: [box.x0, box.y0, box.w, box.h].join(" "), class: "board", role: "img", "aria-label": "River and bridge" }, host);

    // Scenery: sky, water, the two banks, any rocks.
    mk("rect", { x: box.x0, y: box.y0, width: box.w, height: box.h, class: "sky" }, svg);
    mk("rect", { x: box.x0, y: water, width: box.w, height: box.y0 + box.h - water, class: "water" }, svg);
    for (let i = 0; i < 3; i++) {
      mk("path", { d: "M" + box.x0 + " " + (water + 18 + i * 22) + " q 40 -10 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0", class: "ripple" }, svg);
    }
    const bottom = box.y0 + box.h;
    const bank = (xa, xb) => {
      mk("rect", { x: Math.min(xa, xb), y: 0, width: Math.abs(xb - xa), height: bottom, class: "bank" }, svg);
      mk("rect", { x: Math.min(xa, xb), y: -8, width: Math.abs(xb - xa), height: 16, rx: 6, class: "grass" }, svg);
      mk("rect", { x: Math.min(xa, xb), y: -12, width: Math.abs(xb - xa), height: 12, class: "tarmac" }, svg);
    };
    bank(box.x0, 0);
    bank(lv.gap * U, box.x0 + box.w);
    (lv.rocks || []).forEach(([x, y]) => {
      const cx = x * U, cy = y * U;
      mk("path", { d: "M" + (cx - 50) + " " + (water + 30) + " Q" + (cx - 44) + " " + (cy + 6) + " " + cx + " " + (cy - 4) +
        " Q" + (cx + 44) + " " + (cy + 6) + " " + (cx + 50) + " " + (water + 30) + " Z", class: "rock" }, svg);
    });

    // Dots, and the pins that hold the bridge to the ground.
    const grid = mk("g", {}, svg);
    const anchors = Ph.anchors(lv);
    Ph.dots(lv).forEach((id) => {
      const [x, y] = P(id);
      if (anchors.indexOf(id) >= 0) mk("path", { d: "M" + x + " " + y + " l-16 24 h32 z", class: "pin" }, grid);
      else mk("circle", { cx: x, cy: y, r: 7, class: "dot" }, grid);
    });
    live = mk("g", {}, svg);

    svg.addEventListener("pointerdown", (ev) => {
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      tap(p.x / U, p.y / U);
    });
  }

  // A finger lands: nearest dot if it's close, else the nearest piece.
  let pieces = [];
  function tap(x, y) {
    let best = null, bd = 0.42;
    Ph.dots(lv).forEach((id) => {
      const [dx, dy] = Ph.xy(id);
      const d = Math.hypot(dx - x, dy - y);
      if (d < bd) { bd = d; best = id; }
    });
    if (best) { onDot(best); return; }
    let hit = null, hd = 0.25;
    pieces.forEach((m) => {
      const [ax, ay] = Ph.xy(m.a), [bx, by] = Ph.xy(m.b);
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2));
      const d = Math.hypot(ax + t * (bx - ax) - x, ay + t * (by - ay) - y);
      if (d < hd) { hd = d; hit = m; }
    });
    if (hit) onPiece(hit);
  }

  function strainColour(s) {
    return s < 0.5 ? "var(--ok)" : s < 0.8 ? "var(--warn)" : "var(--bad)";
  }

  // st: { members, move, selected, near, testing, truck, falling, splashes }
  function render(st) {
    pieces = st.members.filter((m) => !m.gone);
    const mv = st.move || {};
    const at = (id) => {
      const [x, y] = P(id);
      const d = mv[id];
      return d ? [x + d[0] * U * EXAG, y + d[1] * U * EXAG] : [x, y];
    };
    let h = "";
    // Beams first, the road over them: that's how a real deck sits.
    const order = { beam: 0, steel: 0, road: 1 };
    pieces.slice().sort((a, b) => order[a.mat] - order[b.mat]).forEach((m) => {
      const [ax, ay] = at(m.a), [bx, by] = at(m.b);
      const line = 'x1="' + ax + '" y1="' + ay + '" x2="' + bx + '" y2="' + by + '"';
      if (m.mat === "road") {
        h += "<line " + line + ' class="road"/><line ' + line + ' class="road-mid"/>';
      } else {
        h += "<line " + line + ' class="' + m.mat + (m.locked ? " locked" : "") + '"/>';
      }
      if (st.testing && m.strain != null) {
        h += "<line " + line + ' class="strain" style="stroke:' + strainColour(m.strain) + '"/>';
      }
      h += '<circle cx="' + ax + '" cy="' + ay + '" r="6" class="bolt"/><circle cx="' + bx + '" cy="' + by + '" r="6" class="bolt"/>';
    });

    // The dot you picked, and the dots it can reach.
    if (st.selected) {
      (st.near || []).forEach((id) => {
        const [x, y] = P(id);
        h += '<circle cx="' + x + '" cy="' + y + '" r="18" class="near"/>';
      });
      const [x, y] = P(st.selected);
      h += '<circle cx="' + x + '" cy="' + y + '" r="22" class="picked"/>';
    }

    (st.falling || []).forEach((f) => {
      h += '<g transform="translate(' + f.x + " " + f.y + ") rotate(" + f.rot + ')"><line x1="' + -f.len / 2 + '" y1="0" x2="' + f.len / 2 + '" y2="0" class="' + f.mat + '"/></g>';
    });
    (st.splashes || []).forEach((s) => {
      h += '<ellipse cx="' + s.x + '" cy="' + water + '" rx="' + (20 + s.t * 90) + '" ry="' + (6 + s.t * 16) + '" class="splash" style="opacity:' + (1 - s.t) + '"/>';
    });

    if (st.truck) {
      const t = st.truck;
      const size = BB.Physics.TRUCKS[t.kind].len * 78;
      // Truck emoji face left; flip them so they drive off to the right.
      h += '<g transform="translate(' + t.x * U + " " + t.y + ") rotate(" + t.rot + ') scale(-1 1)"><text x="0" y="-4" font-size="' + size + '" text-anchor="middle" ' + EMOJI + ">" + BB.Physics.TRUCKS[t.kind].emoji + "</text></g>";
    }
    live.innerHTML = h;
  }

  // Where the road surface is at x (in grid units), bent as drawn.
  function roadY(members, move, x) {
    if (x <= 0 || x >= lv.gap) return -12;
    const m = members.find((r) => !r.gone && r.mat === "road" && Math.min(Ph.xy(r.a)[0], Ph.xy(r.b)[0]) <= x && Math.max(Ph.xy(r.a)[0], Ph.xy(r.b)[0]) >= x);
    if (!m) return null;
    const [xa] = Ph.xy(m.a), [xb] = Ph.xy(m.b);
    const f = (x - xa) / (xb - xa);
    const ya = move[m.a] ? move[m.a][1] * U * EXAG : 0;
    const yb = move[m.b] ? move[m.b][1] * U * EXAG : 0;
    return ya + (yb - ya) * f - 12;
  }

  return { build, render, roadY, U, get water() { return water; } };
})();
