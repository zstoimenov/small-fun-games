/* Nine Men's Morris — everything that draws.                                   */
/*                                                                              */
/* app.js owns the game and hands finished decisions to the functions here; this */
/* file never works out whose turn it is or whether anyone has won.              */
/*                                                                              */
/* The board is one inline SVG on a 0-100 viewBox, built once from the same      */
/* coordinate table and adjacency list the rules use, so the picture can never   */
/* disagree with which points are actually joined. Three concentric squares and  */
/* four spokes — expressing that in CSS grid is a trap, and the roadmap says so. */
/*                                                                              */
/* Every point carries an oversized transparent hit circle, so a child's finger  */
/* only has to land near a point rather than on it. It sits last in the group,   */
/* on top of the piece, and the drawn circles ignore the pointer entirely.       */
"use strict";
window.NMM = window.NMM || {};

NMM.Ui = (function () {
  const R = NMM.Rules;
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);

  // Grid 0-6 maps onto 8-92, leaving a margin for the pieces on the outer ring.
  const PAD = 8;
  const STEP = 14;
  const u = (g) => PAD + g * STEP;

  const RING_WORD = ["outer", "middle", "inner"];
  const SPOT_WORD = ["top left", "top", "top right", "right",
                     "bottom right", "bottom", "bottom left", "left"];

  // Short, sayable names for the coach line and for screen readers: "outer top
  // left", "inner right". Nobody can act on "point 14".
  const NAMES = (function () {
    const out = [];
    for (let n = 0; n < R.NODES; n++) {
      out.push(RING_WORD[Math.floor(n / 8)] + " " + SPOT_WORD[n % 8]);
    }
    return out;
  })();

  const el = {};
  const pts = [];          // the <g> per point, indexed by node
  let locked = true;
  let ghost = null;

  const reduced = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const side = (who) => (who === R.WHITE ? "w" : "b");

  /* ── Building the board ────────────────────────────────────────────────── */

  function svgEl(name, attrs) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // The frame: one rounded square per ring, plus a spoke from each edge middle
  // of the outer ring to the matching point on the inner one. Both are derived
  // from the rules' own coordinates rather than typed out again.
  function frame(scale) {
    const g = svgEl("g", { class: "frame" });
    for (let ring = 0; ring < 3; ring++) {
      const lo = u(ring), hi = u(6 - ring);
      g.appendChild(svgEl("rect", {
        x: lo, y: lo, width: hi - lo, height: hi - lo,
        rx: 1.6, class: "line-box"
      }));
    }
    for (const i of [1, 3, 5, 7]) {
      const [ax, ay] = R.XY[i];        // outer ring edge middle
      const [bx, by] = R.XY[16 + i];   // the same spot on the inner ring
      g.appendChild(svgEl("line", {
        x1: u(ax), y1: u(ay), x2: u(bx), y2: u(by), class: "line-spoke"
      }));
    }
    if (scale) g.setAttribute("stroke-width", scale);
    return g;
  }

  // Pieces are drawn with an SVG gradient, which needs a <defs> per board and an
  // id nothing else shares — the lesson puts several boards on one page. The
  // stop colours are set in CSS, not here, so both themes still reach them.
  let gradSeq = 0;

  function defs() {
    const id = "nmm-g" + (++gradSeq);
    const d = svgEl("defs");
    for (const key of ["w", "b"]) {
      const grad = svgEl("radialGradient", { id: id + "-" + key, cx: "35%", cy: "28%", r: "72%" });
      grad.appendChild(svgEl("stop", { offset: "0%", class: "stop-" + key + "-1" }));
      grad.appendChild(svgEl("stop", { offset: "100%", class: "stop-" + key + "-2" }));
      d.appendChild(grad);
    }
    return { node: d, id: id };
  }

  // Both colours are present at every point and the group's class decides which
  // one is visible. That keeps paint() a straight read of the position, with no
  // fill attributes to rewrite as pieces come and go.
  function point(n, id, opts) {
    const [gx, gy] = R.XY[n];
    const r = opts && opts.mini ? 4.2 : 5.2;
    const g = svgEl("g", {
      class: "pt", "data-n": String(n),
      transform: "translate(" + u(gx) + "," + u(gy) + ")"
    });
    g.appendChild(svgEl("circle", { r: 2.4, class: "socket" }));
    g.appendChild(svgEl("circle", { r: r, class: "piece w", fill: "url(#" + id + "-w)" }));
    g.appendChild(svgEl("circle", { r: r, class: "piece b", fill: "url(#" + id + "-b)" }));
    if (!(opts && opts.mini)) {
      const hit = svgEl("circle", { r: 7, class: "hit" });
      hit.setAttribute("tabindex", "0");
      hit.setAttribute("role", "button");
      hit.setAttribute("aria-label", NAMES[n]);
      g.appendChild(hit);
    }
    return g;
  }

  function build(onTap) {
    el.wrap = $("boardWrap");
    el.board = $("board");
    el.coach = $("coach");
    el.toast = $("toast");

    const svg = svgEl("svg", {
      viewBox: "0 0 100 100", class: "board-svg",
      role: "group", "aria-label": "Nine Men's Morris board"
    });
    const d = defs();
    el.gradId = d.id;
    svg.appendChild(d.node);
    svg.appendChild(frame());
    const layer = svgEl("g", { class: "points" });
    pts.length = 0;
    for (let n = 0; n < R.NODES; n++) {
      const g = point(n, d.id);
      pts.push(g);
      layer.appendChild(g);
    }
    svg.appendChild(layer);
    svg.appendChild(svgEl("g", { class: "fx" }));
    el.svg = svg;
    el.fx = svg.querySelector(".fx");

    el.board.innerHTML = "";
    el.board.appendChild(svg);

    // One listener for the whole board: which point was tapped comes off the
    // group, so nothing has to be rebound when the board is repainted.
    svg.addEventListener("click", (e) => {
      if (locked) return;
      const g = e.target.closest(".pt");
      if (g) onTap(Number(g.dataset.n));
    });
    svg.addEventListener("keydown", (e) => {
      if (locked || (e.key !== "Enter" && e.key !== " ")) return;
      const g = e.target.closest(".pt");
      if (!g) return;
      e.preventDefault();
      onTap(Number(g.dataset.n));
    });

    addEventListener("resize", fit);
    addEventListener("orientationchange", fit);
    fit();
  }

  // The board is square, so it takes the smaller of the space left over each
  // way. Same reason as Connect Four: CSS alone either overflows a short screen
  // or squashes the board out of square.
  function fit() {
    if (!el.wrap || el.wrap.offsetParent === null) return;
    const box = el.wrap.getBoundingClientRect();
    const size = Math.max(200, Math.min(box.width, box.height, 560));
    el.board.style.width = Math.floor(size) + "px";
    el.board.style.height = Math.floor(size) + "px";
  }

  /* ── Drawing a position ────────────────────────────────────────────────── */

  // Repaints every point from the position, clearing anything transient. Used
  // after an undo, a repaint of a saved game, and at the end of every animation.
  function paint(s) {
    for (let n = 0; n < R.NODES; n++) {
      const who = R.at(s, n);
      const g = pts[n];
      g.classList.toggle("has-w", who === R.WHITE);
      g.classList.toggle("has-b", who === R.BLACK);
      g.classList.remove("sel", "legal", "takeable", "pop", "going", "hint");
      const hit = g.querySelector(".hit");
      if (hit) {
        hit.setAttribute("aria-label",
          NAMES[n] + (who ? ", " + (who === R.WHITE ? "white" : "black") : ", empty"));
      }
    }
    clearMill();
    if (ghost) { ghost.remove(); ghost = null; }
  }

  const mark = (list, cls, on) => {
    for (const n of list || []) pts[n].classList.toggle(cls, on !== false);
  };

  function clearClass(cls) {
    for (const g of pts) g.classList.remove(cls);
  }

  const select = (n) => { clearClass("sel"); if (n >= 0) pts[n].classList.add("sel"); };
  const showLegal = (list) => { clearClass("legal"); mark(list, "legal"); };
  const showTakeable = (list) => { clearClass("takeable"); mark(list, "takeable"); };

  function markMill(cells) {
    clearMill();
    mark(cells, "mill");
  }

  function clearMill() {
    clearClass("mill");
    clearClass("last");
  }

  const markLast = (n) => { clearClass("last"); if (n >= 0) pts[n].classList.add("last"); };

  // Points at a spot without playing it — the hint button's whole job.
  function nudge(n) {
    const g = pts[n];
    if (!g) return;
    g.classList.remove("hint");
    void el.svg.getBoundingClientRect();
    g.classList.add("hint");
    setTimeout(() => g.classList.remove("hint"), 2400);
  }

  function setEnabled(on) {
    locked = !on;
    el.svg.classList.toggle("locked", locked);
    for (const g of pts) {
      const hit = g.querySelector(".hit");
      if (hit) hit.setAttribute("tabindex", on ? "0" : "-1");
    }
  }

  /* ── Moving pieces about ───────────────────────────────────────────────── */

  // A placement pops into existence; the promise is so app.js can wait for the
  // animation rather than guess at a delay.
  function place(n, who) {
    const g = pts[n];
    g.classList.add("has-" + side(who));
    if (reduced()) return Promise.resolve();
    g.classList.remove("pop");
    void el.svg.getBoundingClientRect();
    g.classList.add("pop");
    return wait(260);
  }

  // A slide flies a stand-in piece across the board rather than trying to move
  // a piece between two groups: the groups are fixed to their points, which is
  // what keeps paint() a straight read of the position.
  function slide(from, to, who) {
    const [fx, fy] = R.XY[from];
    const [tx, ty] = R.XY[to];
    pts[from].classList.remove("has-w", "has-b");

    if (reduced()) {
      pts[to].classList.add("has-" + side(who));
      return Promise.resolve();
    }

    if (ghost) ghost.remove();
    ghost = svgEl("circle", {
      r: 5.2, class: "ghost", cx: u(fx), cy: u(fy),
      fill: "url(#" + el.gradId + "-" + side(who) + ")"
    });
    el.fx.appendChild(ghost);
    void el.svg.getBoundingClientRect();
    ghost.style.transform = "translate(" + ((tx - fx) * STEP) + "px," + ((ty - fy) * STEP) + "px)";

    return wait(300).then(() => {
      if (ghost) { ghost.remove(); ghost = null; }
      pts[to].classList.add("has-" + side(who));
    });
  }

  function take(n) {
    const g = pts[n];
    if (reduced()) {
      g.classList.remove("has-w", "has-b", "takeable");
      return Promise.resolve();
    }
    g.classList.add("going");
    return wait(340).then(() => {
      g.classList.remove("has-w", "has-b", "takeable", "going");
    });
  }

  // Every animation resolves on a timer rather than on animationend: a
  // backgrounded tab never fires the event, and a turn that never ends is worse
  // than one that ends early.
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  /* ── The line above the board ──────────────────────────────────────────── */

  // Refits after every change: a warning that wraps onto two lines takes height
  // away from the board, and the board's size is a number in a style attribute,
  // not something CSS re-derives on its own.
  function coach(html, kind) {
    el.coach.innerHTML = html;
    el.coach.className = "coach" + (kind ? " " + kind : "");
    el.coach.hidden = false;
    fit();
  }

  /* ── Pieces still to place ─────────────────────────────────────────────── */

  // A row of little discs per player, so "how many have I got left?" is a look
  // rather than a sum. Only redrawn when the count changes.
  function hand(id, who, left, taken) {
    const box = $(id);
    if (!box) return;
    const key = left + "/" + taken;
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = "";
    for (let i = 0; i < left; i++) {
      const pip = document.createElement("i");
      pip.className = "pip " + side(who);
      box.appendChild(pip);
    }
    for (let i = 0; i < taken; i++) {
      const pip = document.createElement("i");
      pip.className = "pip gone";
      box.appendChild(pip);
    }
  }

  /* ── Toast and confetti ────────────────────────────────────────────────── */

  let toastTimer = null;

  function clearToast() {
    clearTimeout(toastTimer);
    if (!el.toast) return;
    el.toast.classList.remove("show");
    el.toast.hidden = true;
  }

  function toast(msg, ms) {
    el.toast.innerHTML = msg;
    el.toast.hidden = false;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
      setTimeout(() => { el.toast.hidden = true; }, 260);
    }, ms || 1800);
  }

  function confetti() {
    if (reduced()) return;
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    const colors = ["#e8483f", "#ffc93c", "#4bc8ff", "#6c4cf0", "#3ddc68"];
    for (let i = 0; i < 40; i++) {
      const bit = document.createElement("i");
      bit.style.left = Math.random() * 100 + "%";
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = Math.random() * 0.5 + "s";
      bit.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      wrap.appendChild(bit);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 2600);
  }

  /* ── Little boards for the how-to-play pages ───────────────────────────── */

  // Draws a small read-only board from a 24-character picture — "." empty, "w"
  // white, "b" black — using the same geometry as the real thing, so the lesson
  // can't drift from the game. `mill` glows, `mark` gets a dashed ring, and
  // `arrow` draws a there-to-here line for the sliding pages.
  function miniBoard(picture, opts) {
    const o = opts || {};
    const svg = svgEl("svg", { viewBox: "0 0 100 100", class: "board-svg mini" });
    const d = defs();
    svg.appendChild(d.node);
    svg.appendChild(frame(1.2));
    const layer = svgEl("g", { class: "points" });
    for (let n = 0; n < R.NODES; n++) {
      const g = point(n, d.id, { mini: true });
      const ch = picture[n];
      if (ch === "w") g.classList.add("has-w");
      else if (ch === "b") g.classList.add("has-b");
      if ((o.mill || []).indexOf(n) !== -1) g.classList.add("mill");
      if ((o.mark || []).indexOf(n) !== -1) g.classList.add("hint");
      if ((o.takeable || []).indexOf(n) !== -1) g.classList.add("takeable");
      layer.appendChild(g);
    }
    svg.appendChild(layer);
    if (o.arrow) {
      const [a, b] = o.arrow;
      svg.appendChild(svgEl("line", {
        x1: u(R.XY[a][0]), y1: u(R.XY[a][1]),
        x2: u(R.XY[b][0]), y2: u(R.XY[b][1]), class: "arrow"
      }));
    }
    return svg;
  }

  return {
    NAMES,
    build, fit, paint, setEnabled,
    select, showLegal, showTakeable, markMill, clearMill, markLast, nudge,
    place, slide, take,
    coach, hand, toast, clearToast, confetti, miniBoard
  };
})();
