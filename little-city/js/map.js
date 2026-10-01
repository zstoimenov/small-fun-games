/* Little City - drawing the town and building on it.                          */
/*                                                                             */
/* svg(grid, state, opts): the map as SVG, with faces on houses and range     */
/* shading. board(root, grid, { level, onChange }): the map you build on, the */
/* toolbar, the town's numbers and what a tapped house has to say.            */
"use strict";
window.LC = window.LC || {};

(function () {
  const S = 40;                // one square, in SVG units
  const FACE = { happy: "😀", meh: "😐", sad: "😟" };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function road(g, x, y) {
    const on = (dx, dy) => { const c = g[y + dy] && g[y + dy][x + dx]; return c && c.t === "road"; };
    const cx = x * S + S / 2, cy = y * S + S / 2;
    let s = `<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#8a8f98"/>`;
    // Dashed centre lines towards each neighbouring road, so streets join up.
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => on(dx, dy));
    if (g[y][x].entry && x === 0) dirs.push([-1, 0]);
    if (!dirs.length) s += `<circle cx="${cx}" cy="${cy}" r="4" fill="#f5f5f5"/>`;
    dirs.forEach(([dx, dy]) => { s += `<line x1="${cx}" y1="${cy}" x2="${cx + dx * S / 2}" y2="${cy + dy * S / 2}" stroke="#f5f5f5" stroke-width="2.5" stroke-dasharray="5 4"/>`; });
    if (g[y][x].entry) s += `<text x="${x * S + 4}" y="${y * S + 11}" font-size="9" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">OUT</text>`;
    return s;
  }

  // opts: { shade: [[x, y]...], shadeColor, pick: {x, y}, small }
  function svg(g, st, opts) {
    const o = opts || {}, w = g[0].length, h = g.length;
    let s = `<rect width="${w * S}" height="${h * S}" fill="#9ccc65"/>`;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if ((x + y) % 2) s += `<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#94c35f"/>`;
    }
    (o.shade || []).forEach(([x, y]) => { s += `<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="${o.shadeColor || "#fff176"}" opacity=".8"/>`; });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = g[y][x];
      if (!c) continue;
      if (c.t === "water") s += `<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#4fa3e0"/><path d="M${x * S + 8} ${y * S + 20} q6 -5 12 0 t12 0" stroke="#bfe3ff" stroke-width="2" fill="none"/>`;
      else if (c.t === "trees") s += `<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#558b2f"/><text x="${x * S + S / 2}" y="${y * S + S / 2}" font-size="26" text-anchor="middle" dominant-baseline="central">🌲</text>`;
      else if (c.t === "road") s += road(g, x, y);
      else {
        s += `<rect x="${x * S + 2}" y="${y * S + 2}" width="${S - 4}" height="${S - 4}" rx="6" fill="#fffde7" stroke="${c.fixed ? "#6d6d6d" : "#bca56b"}" stroke-width="1.5"/>`;
        const L = LC.LEVELS[c.t], lvl = c.lv || 1;
        s += `<text x="${x * S + S / 2}" y="${y * S + S / 2 + 1}" font-size="25" text-anchor="middle" dominant-baseline="central">${L ? L.e[lvl - 1] : LC.TYPES[c.t].e}</text>`;
        // Upgraded buildings wear a star per extra level.
        if (lvl > 1) s += `<text x="${x * S + 4}" y="${y * S + S - 5}" font-size="10" fill="#f9a825" stroke="#5d4037" stroke-width=".6" font-weight="900">${"★".repeat(lvl - 1)}</text>`;
      }
    }
    if (st && !o.small) st.houses.forEach((hh) => {
      s += `<circle cx="${hh.x * S + S - 9}" cy="${hh.y * S + 9}" r="9" fill="#fff" stroke="#555" stroke-width="1"/><text x="${hh.x * S + S - 9}" y="${hh.y * S + 10}" font-size="13" text-anchor="middle" dominant-baseline="central">${FACE[hh.face]}</text>`;
    });
    // A see-through building where one is about to go, before paying for it.
    if (o.ghost) s += `<rect x="${o.ghost.x * S + 2}" y="${o.ghost.y * S + 2}" width="${S - 4}" height="${S - 4}" rx="6" fill="#fffde7" opacity=".7" stroke="#e91e63" stroke-width="2.5" stroke-dasharray="5 3"/><text x="${o.ghost.x * S + S / 2}" y="${o.ghost.y * S + S / 2 + 1}" font-size="25" opacity=".75" text-anchor="middle" dominant-baseline="central">${o.ghost.e}</text>`;
    if (o.extra) s += o.extra;
    if (o.pick) s += `<rect x="${o.pick.x * S + 1}" y="${o.pick.y * S + 1}" width="${S - 2}" height="${S - 2}" rx="6" fill="none" stroke="#e91e63" stroke-width="3"/>`;
    return `<svg viewBox="0 0 ${w * S} ${h * S}" xmlns="http://www.w3.org/2000/svg" ${o.attrs || ""}>${s}</svg>`;
  }

  // ── The board you build on ─────────────────────────────────────────────────
  LC.board = function (root, g, o) {
    const lv = o.level;
    let tool = null, pick = null, painting = false, last = null, ghost = null;
    root.innerHTML = `<div class="stats card"></div>
      <div class="map-wrap"><div class="map"></div></div>
      <div class="toolbar" role="group" aria-label="Build"></div>
      <div class="talk card" aria-live="polite"></div>`;
    const stats = root.querySelector(".stats"), map = root.querySelector(".map"), bar = root.querySelector(".toolbar"), talk = root.querySelector(".talk");
    // Its shape, so the stylesheet can fit the map to the space without cropping it.
    map.style.setProperty("--ar", g[0].length / g.length);
    const state = () => LC.Sim.evaluate(g, lv.needs);
    const count = (t) => g.flat().filter((c) => c && c.t === t && !c.fixed).length;
    const money = lv.money != null;

    function paint() {
      const st = state();
      let shade = [], color;
      // Show how far services reach: the one picked, or all of the kind in hand.
      const svc = (t) => LC.TYPES[t] && (LC.TYPES[t].range || LC.TYPES[t].jobs);
      if (pick && g[pick.y][pick.x] && svc(g[pick.y][pick.x].t)) shade = LC.Sim.covers(g, pick.x, pick.y);
      else if (tool && svc(tool)) g.forEach((row, y) => row.forEach((c, x) => { if (c && c.t === tool) shade.push(...LC.Sim.covers(g, x, y)); }));
      if (ghost) shade = LC.previewCovers(g, tool, ghost.x, ghost.y);
      map.innerHTML = svg(g, st, { shade, shadeColor: color, pick, ghost: ghost && { x: ghost.x, y: ghost.y, e: LC.TYPES[tool].e }, attrs: 'class="map-svg" role="img" aria-label="Your town"' });
      paintStats(st);
      paintBar();
    }
    function paintStats(st) {
      const room = st.houses.reduce((n, h) => n + h.people, 0);
      // The words (class w) can step aside on a phone; the pictures and numbers stay.
      let s = `<span title="People living here / room in all the homes">👥 <b>${st.people}/${room}</b><span class="w"> people</span></span><span title="Happy people">😀 <b>${st.happy}</b><span class="w"> happy</span></span>`;
      if (money) {
        const left = lv.money - st.cost;
        s += `<span class="${left < 0 ? "bad" : ""}" title="Coins left to spend">💰 <b>${left}</b><span class="w"> coins left</span></span>`;
        s += `<span class="${st.balance < 0 ? "bad" : ""}" title="Each year: taxes and shops in, running costs out">📅<span class="w"> each year</span> <b>${st.balance >= 0 ? "+" : ""}${st.balance}</b></span>`;
      }
      stats.innerHTML = s;
    }
    function paintBar() {
      bar.innerHTML = "";
      lv.tools.forEach((t) => {
        const T = t === "bulldoze" ? { e: "🧹", name: "Bulldoze" } : LC.TYPES[t];
        const lim = lv.limits && lv.limits[t];
        const left = lim != null ? lim - count(t) : null;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tool" + (tool === t ? " on" : "");
        b.innerHTML = `<span aria-hidden="true">${T.e}</span><b>${T.name}</b>` +
          (money && T.cost ? `<small>💰${T.cost}${T.upkeep ? " · -" + T.upkeep + "/yr" : T.income ? " · +" + T.income + "/yr" : ""}</small>` : left != null ? `<small>${left} left</small>` : T.people ? `<small>${T.people} people</small>` : "");
        b.setAttribute("aria-pressed", String(tool === t));
        b.setAttribute("aria-label", T.name);
        b.addEventListener("click", () => { tool = tool === t ? null : t; pick = null; ghost = null; talk.innerHTML = hintFor(tool); paint(); });
        bar.appendChild(b);
      });
      const look = document.createElement("button");
      look.type = "button";
      look.className = "tool" + (!tool ? " on" : "");
      look.innerHTML = '<span aria-hidden="true">👆</span><b>Look</b>';
      look.setAttribute("aria-pressed", String(!tool));
      look.setAttribute("aria-label", "Look");
      look.addEventListener("click", () => { tool = null; ghost = null; talk.innerHTML = hintFor(null); paint(); });
      bar.prepend(look);
    }
    function hintFor(t) {
      if (!t) return "<p>👆 Tap a house to hear what the family says. Tap a building to see how far it reaches.</p>";
      if (t === "bulldoze") return "<p>🧹 Tap anything you built to clear it" + (money ? " and get the coins back" : "") + ".</p>";
      if (t === "road") return "<p>🛣️ Tap or drag across the grass to build roads.</p>";
      const T = LC.TYPES[t];
      return `<p>${T.e} Tap a grass square next to a road to build a ${T.name.toLowerCase()}.${LC.hasReach(t) ? " You'll see how far it reaches first, then tap again to build." : ""}</p>`;
    }
    function say(x, y) {
      const st = state();
      const hh = st.houses.find((q) => q.x === x && q.y === y);
      const c = g[y][x];
      if (hh) {
        const lines = hh.missing.length ? hh.missing.map((m) => LC.NEEDS[m]) : [LC.HAPPY[(x * 7 + y * 3) % LC.HAPPY.length]];
        talk.innerHTML = `<p class="who">${FACE[hh.face]} The family in this ${LC.TYPES[hh.t].name.toLowerCase()} says:</p>` + lines.map((l) => `<p class="bubble">“${esc(l)}”</p>`).join("");
      } else if (c && LC.TYPES[c.t] && c.t !== "road") {
        const T = LC.TYPES[c.t];
        talk.innerHTML = `<p>${T.e} <b>${T.name}</b>${T.range ? `: reaches ${T.range} squares (shown in yellow).` : T.jobs ? `: jobs for anyone within ${LC.JOB_RANGE} squares.` : "."}${T.noisy ? " It's noisy, so keep it off people's doorsteps." : ""}</p>`;
      } else talk.innerHTML = hintFor(null);
    }

    function act(x, y, first) {
      const c = g[y][x];
      if (!tool) { pick = { x, y }; say(x, y); paint(); return; }
      if (tool === "bulldoze") {
        if (c && LC.TYPES[c.t] && !c.fixed) { g[y][x] = null; LC.Audio.boom(); changed(); }
        else if (first && c) { talk.innerHTML = "<p>🔒 That was here first: you can't bulldoze it.</p>"; LC.Audio.nope(); }
        return;
      }
      // Tapping something already built just looks at it.
      if (c) { if (first && tool !== "road") { ghost = null; pick = { x, y }; say(x, y); paint(); } return; }
      const lim = lv.limits && lv.limits[tool];
      if (lim != null && count(tool) >= lim) { talk.innerHTML = `<p>You can only build ${lim} here. Bulldoze it to move it.</p>`; LC.Audio.nope(); return; }
      if (LC.hasReach(tool) && !(ghost && ghost.x === x && ghost.y === y)) {
        ghost = { x, y };
        pick = null;
        const reach = LC.previewCovers(g, tool, x, y), homesIn = state().houses.filter((h) => reach.some(([a, b]) => a === h.x && b === h.y)).length;
        talk.innerHTML = `<p>${LC.TYPES[tool].e} Here it would reach the yellow squares: <b>${homesIn}</b> home${homesIn === 1 ? "" : "s"}.</p><p>Tap the same square again to build it, or tap somewhere else to try another spot.</p>`;
        paint();
        return;
      }
      ghost = null;
      g[y][x] = { t: tool };
      LC.Audio.build(tool === "road");
      changed();
    }
    function changed() { paint(); if (o.onChange) o.onChange(); }

    const cellAt = (e) => {
      const s = map.querySelector("svg"), pt = s.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(s.getScreenCTM().inverse());
      const x = Math.floor(p.x / S), y = Math.floor(p.y / S);
      return y >= 0 && y < g.length && x >= 0 && x < g[0].length ? { x, y } : null;
    };
    // Roads and the bulldozer paint as you drag; everything else is one tap.
    map.addEventListener("pointerdown", (e) => {
      const at = cellAt(e);
      if (!at) return;
      e.preventDefault();
      painting = tool === "road" || tool === "bulldoze";
      last = at.x + "," + at.y;
      if (painting) { try { map.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      act(at.x, at.y, true);
    });
    map.addEventListener("pointermove", (e) => {
      if (!painting) return;
      const at = cellAt(e);
      if (!at || at.x + "," + at.y === last) return;
      last = at.x + "," + at.y;
      act(at.x, at.y, false);
    });
    const end = () => { painting = false; last = null; };
    map.addEventListener("pointerup", end);
    map.addEventListener("pointercancel", end);

    talk.innerHTML = hintFor(null);
    paint();
    return { paint, state };
  };

  LC.mapSvg = svg;
  // Which squares a building would reach if it stood at (x, y): try it on
  // the grid, measure, and put the square back.
  LC.previewCovers = function (g, t, x, y) {
    const was = g[y][x];
    g[y][x] = { t };
    const out = LC.Sim.covers(g, x, y);
    g[y][x] = was;
    return out;
  };
  // Tools that reach an area get a preview first: tap once to see, tap the
  // same square again (or ✓) to build.
  LC.hasReach = (t) => !!(LC.TYPES[t] && (LC.TYPES[t].range || LC.TYPES[t].jobs));
})();
