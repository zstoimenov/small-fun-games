/* Bank Boss — the end-of-run chart.                                            */
/*                                                                              */
/* Two lines. The blue one is how much of other people's money you were holding; */
/* the green one is how much of it turned into yours. The blue line is always    */
/* the bigger of the two by a long way, and that is the point: a bank's own      */
/* money is a thin slice on top of a large pile that belongs to somebody else.   */
/*                                                                              */
/* Built as SVG from Bank.series() rather than drawn on a canvas, so it scales   */
/* to any width and can be counted by a test — "two polylines of days+1 points"  */
/* is checkable, "the picture looks right" is not.                              */
"use strict";
window.BB = window.BB || {};

BB.Chart = (function () {
  const W = 520, H = 210;
  const PAD = { l: 46, r: 12, t: 12, b: 24 };
  const NS = "http://www.w3.org/2000/svg";

  const el = (name, attrs) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  function ticks(max) {
    const step = max <= 15000 ? 5000 : max <= 40000 ? 10000 : 20000;
    const out = [];
    for (let v = 0; v <= max; v += step) out.push(v);
    return out;
  }

  function render(host, run) {
    const B = BB.Bank;
    const s = B.series(run);
    const goal = B.spec(run.difficulty).goal;
    const target = goal[goal.length - 1];

    host.textContent = "";
    const svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "How much money you were holding, and how much of it was yours" });

    const peak = Math.max(target, Math.max.apply(null, s.own), Math.max.apply(null, s.deposits));
    const top = Math.max(1000, peak * 1.08);
    const days = s.own.length - 1;
    const x = (i) => PAD.l + (i / Math.max(1, days)) * (W - PAD.l - PAD.r);
    const y = (v) => H - PAD.b - (Math.max(0, v) / top) * (H - PAD.t - PAD.b);

    for (const v of ticks(top)) {
      svg.appendChild(el("line", { x1: PAD.l, y1: y(v), x2: W - PAD.r, y2: y(v),
        stroke: "var(--line)", "stroke-width": 1 }));
      const t = el("text", { x: PAD.l - 6, y: y(v) + 4, "text-anchor": "end",
        fill: "var(--muted)", "font-size": 11, "font-weight": 700 });
      t.textContent = "$" + Math.round(v / 100);
      svg.appendChild(t);
    }

    if (target <= top) {
      svg.appendChild(el("line", { x1: PAD.l, y1: y(target), x2: W - PAD.r, y2: y(target),
        stroke: "var(--gold)", "stroke-width": 2, "stroke-dasharray": "6 4" }));
      const g = el("text", { x: W - PAD.r, y: y(target) - 5, "text-anchor": "end",
        fill: "var(--gold)", "font-size": 11, "font-weight": 800 });
      g.textContent = B.money(target);
      svg.appendChild(g);
    }

    for (const i of [0, Math.round(days / 2), days]) {
      const anchor = i === 0 ? "start" : i === days ? "end" : "middle";
      const t = el("text", { x: x(i), y: H - 7, "text-anchor": anchor,
        fill: "var(--muted)", "font-size": 11, "font-weight": 700 });
      t.textContent = i === 0 ? "Start" : "Day " + i;
      svg.appendChild(t);
    }

    const pts = (arr) => arr.map((v, i) => x(i) + "," + y(v)).join(" ");

    // Shade under the deposits line: the pile you were looking after.
    svg.appendChild(el("polygon", {
      points: pts(s.deposits) + " " + x(days) + "," + y(0) + " " + x(0) + "," + y(0),
      fill: "var(--owed)", opacity: 0.16
    }));
    svg.appendChild(el("polyline", { points: pts(s.deposits), fill: "none",
      stroke: "var(--owed)", "stroke-width": 2.5, "stroke-dasharray": "5 4",
      "stroke-linejoin": "round", "stroke-linecap": "round" }));
    svg.appendChild(el("polyline", { points: pts(s.own), fill: "none",
      stroke: "var(--own)", "stroke-width": 3.5,
      "stroke-linejoin": "round", "stroke-linecap": "round" }));
    svg.appendChild(el("circle", { cx: x(days), cy: y(s.own[days]), r: 5, fill: "var(--own)" }));

    host.appendChild(svg);
    return svg;
  }

  return { render };
})();
