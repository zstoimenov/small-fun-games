/* Circuit Lab - draws the board as SVG and turns taps into edge keys.         */
/*                                                                             */
/* SVG rather than canvas: every edge is a real element, so tap targets are   */
/* exact, keyboard focus works, and colours come straight from the CSS theme. */
/* Each part is drawn along x from -50 to 50 and rotated for vertical edges.  */
/* Three layers, so the moving dots of current run over the wires but under   */
/* the bodies of bulbs and batteries.                                          */
"use strict";
window.CL = window.CL || {};

CL.Board = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const SP = 100, M = 50;
  const P = CL.Circuit.PARTS;

  let svg, base, flow, bodies, hits, grid, onTap;
  let dots = [];     // { el, speed } for every part carrying current
  let fans = [];     // { el, speed } for every spinning motor
  let spin = 0;

  function mk(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function geom(key) {
    const [d, c, r] = key.split(":");
    const x1 = M + (+c) * SP, y1 = M + (+r) * SP;
    const x2 = d === "h" ? x1 + SP : x1, y2 = d === "h" ? y1 : y1 + SP;
    return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, rot: d === "h" ? 0 : 90 };
  }
  const place = (g, parent) => mk("g", { transform: "translate(" + g.cx + " " + g.cy + ") rotate(" + g.rot + ")" }, parent);
  // Text stays upright on a vertical part.
  const upright = (g, x, y) => "rotate(" + -g.rot + " " + x + " " + y + ")";

  function describe(key) {
    const [d, c, r] = key.split(":");
    return d === "h" ? "Across, row " + (+r + 1) + ", spot " + (+c + 1) : "Down, column " + (+c + 1) + ", spot " + (+r + 1);
  }

  // host: the element to fill. open: the only edges that take parts, or null.
  function build(host, g, open, test, tap) {
    grid = g;
    onTap = tap;
    host.innerHTML = "";
    const w = (g.cols - 1) * SP + 2 * M, h = (g.rows - 1) * SP + 2 * M;
    svg = mk("svg", { viewBox: "0 0 " + w + " " + h, class: "board", role: "group", "aria-label": "Circuit board" }, host);
    const defs = mk("defs", {}, svg);
    const grad = mk("radialGradient", { id: "glow" }, defs);
    mk("stop", { offset: "0", "stop-color": "#fff6b0", "stop-opacity": "1" }, grad);
    mk("stop", { offset: ".45", "stop-color": "#ffd23f", "stop-opacity": ".75" }, grad);
    mk("stop", { offset: "1", "stop-color": "#ffb300", "stop-opacity": "0" }, grad);

    const slots = mk("g", {}, svg);
    base = mk("g", {}, svg);
    flow = mk("g", {}, svg);
    bodies = mk("g", {}, svg);
    const nodes = mk("g", {}, svg);
    hits = mk("g", {}, svg);

    CL.Circuit.edges(g).forEach((key) => {
      const e = geom(key);
      const usable = !open || open.indexOf(key) >= 0;
      if (usable) mk("line", { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, class: "slot" + (key === test ? " test" : "") }, slots);
      const t = place(e, hits);
      const r = mk("rect", { x: -40, y: -30, width: 80, height: 60, rx: 14, class: "hit", tabindex: usable ? 0 : -1, role: "button" }, t);
      r.dataset.key = key;
      r.setAttribute("aria-label", describe(key) + ": empty");
    });
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) mk("circle", { cx: M + c * SP, cy: M + r * SP, r: 7, class: "node" }, nodes);
    }

    hits.addEventListener("click", (ev) => {
      const k = ev.target.dataset && ev.target.dataset.key;
      if (k) onTap(k);
    });
    hits.addEventListener("keydown", (ev) => {
      const k = ev.target.dataset && ev.target.dataset.key;
      if (k && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); onTap(k); }
    });
  }

  // ── Parts ──────────────────────────────────────────────────────────────────
  function leads(g, gap) {
    mk("line", { x1: -50, y1: 0, x2: -gap, y2: 0, class: "wire" }, g);
    mk("line", { x1: gap, y1: 0, x2: 50, y2: 0, class: "wire" }, g);
  }

  function draw(key, p, res) {
    const e = geom(key);
    const lo = place(e, base);
    const hi = place(e, bodies);
    const level = res.level[key] || 0;
    if (p.locked) lo.classList.add("locked");

    if (p.type === "wire") { mk("line", { x1: -50, y1: 0, x2: 50, y2: 0, class: "wire" }, lo); return; }

    if (p.type === "battery") {
      leads(lo, 26);
      if (res.short) hi.classList.add("hot");
      mk("rect", { x: -28, y: -17, width: 48, height: 34, rx: 7, class: "batt" }, hi);
      mk("rect", { x: 20, y: -9, width: 8, height: 18, rx: 2, class: "batt-cap" }, hi);
      mk("rect", { x: -28, y: -17, width: 14, height: 34, rx: 7, class: "batt-end" }, hi);
      const plus = mk("text", { x: 8, y: 1, class: "batt-sign", transform: upright(e, 8, 1) }, hi);
      plus.textContent = "+";
      if (res.short) {
        const f = mk("text", { x: 0, y: -30, class: "emoji", "font-size": 26, transform: upright(e, 0, -30) }, hi);
        f.textContent = "\u{1F525}";
      }
      return;
    }

    if (p.type === "bulb") {
      leads(lo, 18);
      // Brightness has to read at a glance: two bulbs in a row (0.25) must
      // look clearly weaker than one (0.9), or chapter 2 teaches nothing.
      const lit = !p.broken && CL.Circuit.on(level);
      if (lit) {
        const r = 20 + 22 * Math.min(Math.sqrt(level), 2);
        mk("circle", { r: r, fill: "url(#glow)", opacity: Math.min(1, level * 1.1), class: "glow" }, hi);
      }
      const g = mk("circle", { r: 18, class: "glass" + (lit ? (level >= CL.Circuit.BRIGHT ? " lit" : " dim") : "") + (p.broken ? " broken" : "") }, hi);
      mk("path", { d: "M-10 5 L-6 -5 L-2 5 L2 -5 L6 5 L10 -5", class: "filament" + (lit ? " lit" : "") }, hi);
      if (p.broken) mk("path", { d: "M-12 -12 L-2 -2 L-8 4 L4 12", class: "crack" }, hi);
      return;
    }

    if (p.type === "switch") {
      leads(lo, 22);
      mk("rect", { x: -30, y: -20, width: 60, height: 40, rx: 10, class: "plate" + (p.on ? " on" : "") }, hi);
      mk("circle", { cx: -18, cy: 0, r: 5, class: "term" }, hi);
      mk("circle", { cx: 18, cy: 0, r: 5, class: "term" }, hi);
      const lever = mk("g", { transform: p.on ? "" : "rotate(-35 -18 0)" }, hi);
      mk("line", { x1: -18, y1: 0, x2: 20, y2: 0, class: "lever" }, lever);
      mk("circle", { cx: 20, cy: 0, r: 5, class: "knob" }, lever);
      return;
    }

    if (p.type === "buzzer" || p.type === "motor") {
      leads(lo, 20);
      const active = CL.Circuit.on(level);
      mk("circle", { r: 20, class: "can" + (active ? " on" : "") }, hi);
      if (p.type === "buzzer") {
        const t = mk("text", { x: 0, y: 1, class: "emoji", "font-size": 22, transform: upright(e, 0, 1) }, hi);
        t.textContent = "\u{1F514}";
        if (active) {
          const w = mk("g", { class: "waves", transform: upright(e, 0, 0) }, hi);
          mk("path", { d: "M26 -12 Q34 0 26 12", class: "wave" }, w);
          mk("path", { d: "M-26 -12 Q-34 0 -26 12", class: "wave" }, w);
        }
      } else {
        const fan = mk("g", {}, hi);
        [0, 120, 240].forEach((a) => mk("ellipse", { cx: 0, cy: -8, rx: 5, ry: 9, class: "blade", transform: "rotate(" + a + ")" }, fan));
        mk("circle", { r: 3.5, class: "hub" }, fan);
        const sp = res.cur[key] || 0;
        if (sp) fans.push({ el: fan, speed: 360 * Math.min(Math.abs(sp), 2) * Math.sign(sp) });
      }
      return;
    }

    // A thing being tested: the object sitting on a little tray.
    leads(lo, 22);
    mk("rect", { x: -24, y: -22, width: 48, height: 44, rx: 12, class: "tray" }, hi);
    const t = mk("text", { x: 0, y: 2, class: "emoji", "font-size": 28, transform: upright(e, 0, 2) }, hi);
    t.textContent = P[p.type].emoji;
  }

  function render(parts, res) {
    [base, flow, bodies].forEach((l) => { l.innerHTML = ""; });
    dots = [];
    fans = [];
    Object.keys(parts).forEach((k) => draw(k, parts[k], res));
    // Moving dots show the current: which way it goes, and faster for more.
    Object.keys(parts).forEach((k) => {
      const i = res.cur[k] || 0;
      if (Math.abs(i) < 0.03) return;
      const e = geom(k);
      const el = mk("line", { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, class: "dots" + (res.short ? " short" : "") }, flow);
      dots.push({ el, speed: Math.sign(i) * (30 + 45 * Math.min(Math.abs(i), 3)), off: 0 });
    });
    hits.querySelectorAll(".hit").forEach((h) => {
      const p = parts[h.dataset.key];
      h.setAttribute("aria-label", describe(h.dataset.key) + ": " + (p ? P[p.type].label + (p.type === "switch" ? (p.on ? ", on" : ", off") : "") : "empty"));
    });
  }

  function tick(dt) {
    dots.forEach((d) => {
      d.off = (d.off - d.speed * dt) % 1000;
      d.el.style.strokeDashoffset = d.off;
    });
    spin += dt;
    fans.forEach((f) => f.el.setAttribute("transform", "rotate(" + ((f.speed * spin) % 360) + ")"));
  }

  return { build, render, tick };
})();
