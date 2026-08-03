/* Lemonade Stand — the end-of-run chart.                                       */
/*                                                                              */
/* Two lines and the gap between them, which is the only visual claim this game  */
/* really makes: the top line is what you actually had, the bottom is what you   */
/* would have had if the bank had never paid you a cent. The space between them  */
/* IS the interest, and it fans open towards the right because that is what      */
/* compounding looks like.                                                       */
/*                                                                              */
/* Built as SVG from Economy.series() rather than drawn on a canvas, so it       */
/* scales to any width, prints, and can be counted by a test — "exactly two      */
/* polylines of days+1 points" is checkable, "the picture looks right" is not.   */
"use strict";
window.LS = window.LS || {};

LS.Chart = (function () {
  const W = 520, H = 210;                 // viewBox units; CSS scales it to fit
  const PAD = { l: 44, r: 12, t: 12, b: 24 };
  const NS = "http://www.w3.org/2000/svg";

  const el = (name, attrs) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  // Money labels a child can read: whole dollars, no cents, three of them.
  function ticks(max) {
    const step = max <= 4000 ? 1000 : max <= 10000 ? 2500 : max <= 20000 ? 5000 : 10000;
    const out = [];
    for (let v = 0; v <= max; v += step) out.push(v);
    return out;
  }

  function render(host, run) {
    const E = LS.Economy;
    const s = E.series(run);
    const goal = E.spec(run.difficulty).goal;
    const target = goal[goal.length - 1];

    host.textContent = "";
    const svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "How your money grew over the run" });

    const top = Math.max(target, Math.max.apply(null, s.wealth)) * 1.08;
    const days = s.wealth.length - 1;
    const x = (i) => PAD.l + (i / Math.max(1, days)) * (W - PAD.l - PAD.r);
    const y = (v) => H - PAD.b - (v / top) * (H - PAD.t - PAD.b);

    // Gridlines and money labels.
    for (const v of ticks(top)) {
      svg.appendChild(el("line", { x1: PAD.l, y1: y(v), x2: W - PAD.r, y2: y(v),
        stroke: "var(--line)", "stroke-width": 1 }));
      const t = el("text", { x: PAD.l - 6, y: y(v) + 4, "text-anchor": "end",
        fill: "var(--muted)", "font-size": 11, "font-weight": 700 });
      t.textContent = "$" + Math.round(v / 100);
      svg.appendChild(t);
    }

    // The thing you were saving for, as a line you can see yourself crossing.
    if (target <= top) {
      svg.appendChild(el("line", { x1: PAD.l, y1: y(target), x2: W - PAD.r, y2: y(target),
        stroke: "var(--gold)", "stroke-width": 2, "stroke-dasharray": "6 4" }));
      const g = el("text", { x: W - PAD.r, y: y(target) - 5, "text-anchor": "end",
        fill: "var(--gold)", "font-size": 11, "font-weight": 800 });
      g.textContent = LS.Economy.money(target);
      svg.appendChild(g);
    }

    // Days along the bottom — first, middle and last only, or they collide.
    // The outer two anchor inwards: centred on the axis ends they hang outside
    // the viewBox and get clipped, which turned "Day 14" into "Day 1".
    for (const i of [0, Math.round(days / 2), days]) {
      const anchor = i === 0 ? "start" : i === days ? "end" : "middle";
      const t = el("text", { x: x(i), y: H - 7, "text-anchor": anchor,
        fill: "var(--muted)", "font-size": 11, "font-weight": 700 });
      t.textContent = i === 0 ? "Start" : "Day " + i;
      svg.appendChild(t);
    }

    const pts = (arr) => arr.map((v, i) => x(i) + "," + y(v)).join(" ");

    // Shade the gap, so the interest is a thing with an area and not just two
    // lines that happen to diverge.
    const band = el("polygon", {
      points: pts(s.wealth) + " " + s.lemonade.map((v, i) => x(i) + "," + y(v)).reverse().join(" "),
      fill: "var(--accent)", opacity: 0.14
    });
    svg.appendChild(band);

    svg.appendChild(el("polyline", { points: pts(s.lemonade), fill: "none",
      stroke: "var(--muted)", "stroke-width": 2.5, "stroke-dasharray": "5 4",
      "stroke-linejoin": "round", "stroke-linecap": "round" }));
    svg.appendChild(el("polyline", { points: pts(s.wealth), fill: "none",
      stroke: "var(--accent)", "stroke-width": 3.5,
      "stroke-linejoin": "round", "stroke-linecap": "round" }));

    // A dot on the last day, where the two numbers are furthest apart.
    svg.appendChild(el("circle", { cx: x(days), cy: y(s.wealth[days]), r: 5,
      fill: "var(--accent)" }));

    host.appendChild(svg);
    return svg;
  }

  return { render };
})();
