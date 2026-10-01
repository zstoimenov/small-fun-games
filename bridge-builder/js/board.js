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

  let svg, live, ghost, lv, hooks, box, water, boat;

  function mk(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const P = (id) => Ph.xy(id).map((v) => v * U);

  // Each Bridge Trail world has its own look: colours from the theme class,
  // and a few emoji on the banks and in the sky.
  const LOOKS = {
    farm:   { sky: "\u{2600}\u{FE0F}", bank: ["\u{1F404}", "\u{1F33B}"] },
    desert: { sky: "\u{2600}\u{FE0F}", bank: ["\u{1F335}", "\u{1F98E}"] },
    river:  { sky: "\u{26C5}", bank: ["\u{1F333}", "\u{1F986}"] },
    snow:   { sky: "\u{2744}\u{FE0F}", bank: ["\u{1F332}", "\u{26C4}"] },
    jungle: { sky: "\u{1F324}\u{FE0F}", bank: ["\u{1F334}", "\u{1F99C}"] },
    city:   { sky: "\u{1F319}", bank: ["\u{1F3E2}", "\u{1F3EC}"] }
  };

  // on: { dot, piece, empty, dragStart, dragOver, dragEnd } - see app.js.
  function build(host, level, on, theme) {
    lv = level;
    hooks = on;
    press = null;
    fingers = 0;
    host.innerHTML = "";
    // The frame round the board shows the world's sky too, not the default one.
    host.className = host.className.replace(/\s*theme-\w+/g, "") + (LOOKS[theme] ? " theme-" + theme : "");
    const x0 = -1.8, x1 = lv.gap + 1.8, y0 = lv.rows[0] - 0.9, y1 = Math.max(lv.rows[1], 1) + 1.1;
    box = { x0: x0 * U, y0: y0 * U, w: (x1 - x0) * U, h: (y1 - y0) * U };
    water = (Math.max(lv.rows[1], 1) + 0.55) * U;
    const look = LOOKS[theme];
    svg = mk("svg", { viewBox: [box.x0, box.y0, box.w, box.h].join(" "), role: "img", "aria-label": "River and bridge",
      class: "board" + (look ? " theme-" + theme : "") + (lv.snow ? " snowy" : "") }, host);

    // Scenery: sky, water, the banks and islands, any rocks and towers. When
    // the board is height-bound it is wider than its picture, so the sky,
    // water and banks carry on past the edges (wide) instead of leaving strips.
    const wide = { x: box.x0 - 3000, w: box.w + 6000 };
    mk("rect", { x: wide.x, y: box.y0, width: wide.w, height: box.h, class: "sky" }, svg);
    // Dark mode turns a world's daytime sky into evening.
    if (look) mk("rect", { x: wide.x, y: box.y0, width: wide.w, height: box.h, class: "dusk" }, svg);
    if (look) mk("text", { x: box.x0 + 60, y: box.y0 + 80, "font-size": 56, class: "deco" }, svg).textContent = look.sky;
    mk("rect", { x: wide.x, y: water, width: wide.w, height: box.y0 + box.h - water, class: "water" }, svg);
    for (let i = 0; i < 3; i++) {
      mk("path", { d: "M" + box.x0 + " " + (water + 18 + i * 22) + " q 40 -10 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0", class: "ripple" }, svg);
    }
    const bottom = box.y0 + box.h;
    const bank = (xa, xb) => {
      mk("rect", { x: Math.min(xa, xb), y: 0, width: Math.abs(xb - xa), height: bottom, class: "bank" }, svg);
      mk("rect", { x: Math.min(xa, xb), y: -8, width: Math.abs(xb - xa), height: 16, rx: 6, class: "grass" }, svg);
      mk("rect", { x: Math.min(xa, xb), y: -12, width: Math.abs(xb - xa), height: 12, class: "tarmac" }, svg);
    };
    bank(wide.x, 0);
    bank(lv.gap * U, wide.x + wide.w);
    (lv.islands || []).forEach(([a, b]) => bank(a * U, b * U));
    if (look) {
      const deco = (x, e) => { mk("text", { x, y: -14, "font-size": 64, "text-anchor": "middle", class: "deco" }, svg).textContent = e; };
      deco(-1.25 * U, look.bank[0]);
      deco((lv.gap + 1.25) * U, look.bank[1]);
    }
    // Stone towers on the bank side of the edge, up to their anchor.
    (lv.towers || []).forEach((id) => {
      const [x, y] = P(id), left = x <= 0 || x < lv.gap / 2 * U;
      mk("rect", { x: left ? x - 46 : x - 8, y: y - 10, width: 54, height: -y - 2, rx: 6, class: "tower" }, svg);
    });
    // The boat lane: marked down to the water, with its boat.
    if (lv.lane) {
      const [a, b] = lv.lane.map((v) => v * U);
      mk("rect", { x: a, y: 14, width: b - a, height: water - 14, class: "lane" }, svg);
      boat = mk("text", { x: (a + b) / 2, y: water + 6, "font-size": Math.min(110, (b - a) * 0.7), "text-anchor": "middle", class: "deco" }, svg);
      boat.textContent = "\u{26F5}";
    } else boat = null;
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

    ghost = mk("line", { class: "ghost-piece", x1: 0, y1: 0, x2: 0, y2: 0 }, svg);
    ghost.style.display = "none";
    listen();
  }

  // ── Fingers ────────────────────────────────────────────────────────────────
  // A tap counts when the finger lifts, not when it lands, so a palm or a
  // half-tap does nothing. Pressing a dot and moving builds as you drag; a
  // second finger cancels the gesture.
  let pieces = [], press = null, fingers = 0;
  const DRAG = 0.2;       // grid steps the finger moves before a press becomes a drag

  function at(ev) {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x / U, p.y / U];
  }
  function dotAt(x, y, reach) {
    let best = null, bd = reach;
    Ph.dots(lv).forEach((id) => {
      const [dx, dy] = Ph.xy(id);
      const d = Math.hypot(dx - x, dy - y);
      if (d < bd) { bd = d; best = id; }
    });
    return best;
  }
  function pieceAt(x, y) {
    let hit = null, hd = 0.25;
    pieces.forEach((m) => {
      const [ax, ay] = Ph.xy(m.a), [bx, by] = Ph.xy(m.b);
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2));
      const d = Math.hypot(ax + t * (bx - ax) - x, ay + t * (by - ay) - y);
      if (d < hd) { hd = d; hit = m; }
    });
    return hit;
  }
  function showGhost(from, x, y) {
    if (!from) { ghost.style.display = "none"; return; }
    const [ax, ay] = P(from);
    ghost.setAttribute("x1", ax); ghost.setAttribute("y1", ay);
    ghost.setAttribute("x2", x * U); ghost.setAttribute("y2", y * U);
    ghost.style.display = "";
  }
  function endPress() {
    if (press && press.drag) hooks.dragEnd();
    press = null;
    showGhost(null);
  }

  function listen() {
    svg.addEventListener("pointerdown", (ev) => {
      // The first finger down starts the count afresh, so a lost "up" can't
      // leave the board thinking two fingers are on it.
      fingers = ev.isPrimary ? 1 : fingers + 1;
      if (fingers > 1) { endPress(); return; }
      const [x, y] = at(ev);
      press = { id: ev.pointerId, x, y, dot: dotAt(x, y, 0.42), drag: false, from: null };
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* not every browser */ }
    });
    svg.addEventListener("pointermove", (ev) => {
      if (!press || ev.pointerId !== press.id) return;
      const [x, y] = at(ev);
      if (!press.drag) {
        if (!press.dot || Math.hypot(x - press.x, y - press.y) < DRAG) return;
        press.from = hooks.dragStart(press.dot);
        if (!press.from) { press = null; return; }
        press.drag = true;
      }
      // Dots need a closer finger while dragging, so passing near one
      // on the way somewhere else doesn't build to it.
      const d = dotAt(x, y, 0.32);
      if (d && d !== press.from) press.from = hooks.dragOver(d) || press.from;
      showGhost(press.from, x, y);
    });
    const up = (ev) => {
      fingers = Math.max(0, fingers - 1);
      if (!press || ev.pointerId !== press.id) return;
      if (!press.drag && ev.type === "pointerup") {
        const [x, y] = at(ev);
        // Finger slid off what it pressed: not a tap.
        if (Math.hypot(x - press.x, y - press.y) < 0.4) {
          const piece = press.dot ? null : pieceAt(press.x, press.y);
          if (press.dot) hooks.dot(press.dot);
          else if (piece) hooks.piece(piece);
          else hooks.empty();
        }
      }
      endPress();
    };
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
  }

  function strainColour(s) {
    return s < 0.5 ? "var(--ok)" : s < 0.8 ? "var(--warn)" : "var(--bad)";
  }

  // st: { members, move, selected, near, building, testing, trucks, falling, splashes }
  function render(st) {
    svg.classList.toggle("building", !!st.building);
    // The boat bobs while the truck drives.
    if (boat) boat.setAttribute("transform", st.testing ? "translate(0 " + Math.sin(performance.now() / 300) * 5 + ")" : "");
    pieces = st.members.filter((m) => !m.gone);
    const mv = st.move || {};
    const at = (id) => {
      const [x, y] = P(id);
      const d = mv[id];
      return d ? [x + d[0] * U * EXAG, y + d[1] * U * EXAG] : [x, y];
    };
    let h = "";
    // Beams first, the road over them: that's how a real deck sits.
    const order = { rope: 0, beam: 0, old: 0, steel: 0, road: 1 };
    pieces.slice().sort((a, b) => order[a.mat] - order[b.mat]).forEach((m) => {
      const [ax, ay] = at(m.a), [bx, by] = at(m.b);
      const line = 'x1="' + ax + '" y1="' + ay + '" x2="' + bx + '" y2="' + by + '"';
      if (m.mat === "road") {
        h += "<line " + line + ' class="road"/><line ' + line + ' class="road-mid"/>';
        if (lv.snow) h += "<line " + line + ' class="road-snow"/>';
      } else if (m.mat === "rope" && m.slack) {
        // A slack rope sags.
        const sag = Math.hypot(bx - ax, by - ay) * 0.12;
        h += '<path d="M' + ax + " " + ay + " Q" + (ax + bx) / 2 + " " + ((ay + by) / 2 + sag) + " " + bx + " " + by + '" class="rope"/>';
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

    (st.trucks || []).forEach((t) => {
      const size = BB.Physics.TRUCKS[t.kind].len * 78;
      // Truck emoji face left; flip them so they drive off to the right.
      h += '<g transform="translate(' + t.x * U + " " + t.y + ") rotate(" + t.rot + ') scale(-1 1)"><text x="0" y="-4" font-size="' + size + '" text-anchor="middle" ' + EMOJI + ">" + BB.Physics.TRUCKS[t.kind].emoji + "</text></g>";
    });
    live.innerHTML = h;
  }

  // Where the road surface is at x (in grid units), bent as drawn.
  function roadY(members, move, x) {
    if (Ph.ground(lv, x)) return -12;
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
