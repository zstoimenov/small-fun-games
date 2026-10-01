/* Little City - the mayor's map: building with the treasury, and the town    */
/* coming alive on top of it (cars on the roads, smoke from factories, moving */
/* trucks and coins at the end of a year).                                    */
/*                                                                             */
/* mayorBoard(root, town, { onChange, locked }) -> { paint, burst(sum) }       */
"use strict";
window.LC = window.LC || {};

(function () {
  const M = LC.Mayor, T = LC.TYPES, S = 40;
  const FACE = { happy: "😀", meh: "😐", sad: "😟" };
  // Flats and towers aren't here: you get them by upgrading a house (tap it
  // with 👆 Look), the same way every other building levels up.
  const TOOLS = ["road", "house", "shop", "park", "school", "clinic", "fire", "factory", "library", "police", "station", "stadium"];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rankFor = (t) => M.RANKS.findIndex((r) => r.unlock.includes(t));
  const pct = (x, n) => ((x + 0.5) / n * 100).toFixed(2) + "%";

  LC.mayorBoard = function (root, town, o) {
    let tool = null, pick = null, painting = false, last = null, carTimer = 0, ghost = null;
    root.innerHTML = `<div class="map-wrap"><div class="map-box"><div class="map"></div><div class="anim" aria-hidden="true"></div></div></div>
      <div class="toolbar" role="group" aria-label="Build"></div>
      <div class="talk card" aria-live="polite"></div>`;
    const map = root.querySelector(".map"), anim = root.querySelector(".anim"), bar = root.querySelector(".toolbar"), talk = root.querySelector(".talk");
    const g = () => town.grid;
    const GW = () => g()[0].length, GH = () => g().length;
    // Its shape, so the stylesheet can fit the map to the space without cropping
    // it (and the cars and rings drawn over it stay on their squares).
    root.querySelector(".map-box").style.setProperty("--ar", GW() / GH());
    // The map lives on the play screen's board; the tools and talk stay here.
    const wrap = root.querySelector(".map-wrap");
    if (o.board) { o.board.innerHTML = ""; o.board.appendChild(wrap); }

    // Extra marks on the map: how full each home is, broken buildings, sleepy
    // shops, and a ring round anything a letter or an offer is about.
    function decor(st) {
      let s = "";
      st.homes.forEach((h) => {
        const w = S - 12, f = h.cap ? h.live / h.cap : 0;
        s += `<rect x="${h.x * S + 6}" y="${h.y * S + S - 8}" width="${w}" height="4" rx="2" fill="#0003"/><rect x="${h.x * S + 6}" y="${h.y * S + S - 8}" width="${(w * f).toFixed(1)}" height="4" rx="2" fill="#2e7d32"/>`;
      });
      g().forEach((row, y) => row.forEach((c, x) => {
        if (c && c.damaged) s += `<text x="${x * S + 9}" y="${y * S + 10}" font-size="14" text-anchor="middle" dominant-baseline="central">🔧</text>`;
      }));
      st.shops.forEach((sh) => { if (!sh.coins) s += `<text x="${sh.x * S + S - 9}" y="${sh.y * S + 10}" font-size="12" text-anchor="middle" dominant-baseline="central">💤</text>`; });
      const ring = (p, col) => { s += `<circle cx="${p.x * S + S / 2}" cy="${p.y * S + S / 2}" r="${S * 0.62}" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="6 4"/>`; };
      if (town.request) ring(town.request, "#e91e63");
      if (town.offer) ring(town.offer, "#ff9800");
      return s;
    }

    function paint() {
      const st = M.look(town);
      let shade = [];
      const svc = (t) => T[t] && (T[t].range || T[t].jobs);
      if (pick && g()[pick.y][pick.x] && svc(g()[pick.y][pick.x].t)) shade = LC.Sim.covers(g(), pick.x, pick.y);
      else if (tool && svc(tool)) g().forEach((row, y) => row.forEach((c, x) => { if (c && c.t === tool) shade.push(...LC.Sim.covers(g(), x, y)); }));
      if (ghost) shade = LC.previewCovers(g(), tool, ghost.x, ghost.y);
      map.innerHTML = LC.mapSvg(g(), st, { shade, pick, ghost: ghost && { x: ghost.x, y: ghost.y, e: T[tool].e }, extra: decor(st), attrs: 'class="map-svg" role="img" aria-label="Your town"' });
      paintBar();
      smoke();
      return st;
    }
    function paintBar() {
      bar.innerHTML = "";
      const un = M.unlocked(town);
      const mk = (id, e, name, sub, on, lockedTo) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tool" + (on ? " on" : "") + (lockedTo ? " locked" : "");
        b.innerHTML = `<span aria-hidden="true">${lockedTo ? "🔒" : e}</span><b>${name}</b>${sub ? `<small>${sub}</small>` : ""}`;
        b.setAttribute("aria-pressed", String(!!on));
        b.setAttribute("aria-label", name + (lockedTo ? ", locked" : ""));
        b.addEventListener("click", () => {
          if (lockedTo) { say(`🔒 The ${name.toLowerCase()} unlocks when your town is a ${lockedTo.name} (${lockedTo.at} people).`); return; }
          tool = id === "look" ? null : tool === id ? null : id;
          pick = null;
          ghost = null;
          hint();
          paint();
        });
        bar.appendChild(b);
      };
      mk("look", "👆", "Look", "", !tool);
      TOOLS.forEach((t) => {
        const lk = !un.includes(t) ? M.RANKS[rankFor(t)] : null;
        const up = M.UPKEEP[t];
        mk(t, T[t].e, T[t].name, lk ? lk.name : `💰${T[t].cost}${up ? " · -" + up + "/yr" : ""}`, tool === t, lk);
      });
      mk("bulldoze", "🧹", "Bulldoze", "½ back", tool === "bulldoze");
    }
    const say = (html) => { talk.innerHTML = `<p>${html}</p>`; };
    function hint() {
      if (!tool) return say("👆 Tap a house to hear the family. Tap a building to see how it's doing.");
      if (tool === "bulldoze") return say("🧹 Tap something to clear it. You get half the coins back. Trees cost 2 coins to clear.");
      if (tool === "road") return say("🛣️ Tap or drag across the grass to build roads. 1 coin each.");
      const t = T[tool];
      say(`${t.e} Tap a grass square next to a road to build a ${t.name.toLowerCase()} for ${t.cost} coins.${LC.hasReach(tool) ? " First you'll see how far it reaches (yellow), then tap the same square again to build." : ""}${M.UPKEEP[tool] ? ` It costs ${M.UPKEEP[tool]} coins a year to run.` : ""}`);
    }

    function lookAt(x, y) {
      const st = M.look(town), c = g()[y][x];
      const h = st.homes.find((q) => q.x === x && q.y === y);
      let html = "";
      if (h) {
        const lines = h.missing.length ? h.missing.map((m) => LC.NEEDS[m]) : [h.live ? LC.HAPPY[(x * 7 + y * 3) % LC.HAPPY.length] : "This home is ready. Families move in when everything they need is close by!"];
        const q = town.request && town.request.x === x && town.request.y === y ? `<p class="bubble">✉️ We asked for a ${T[town.request.need].name.toLowerCase()} by year ${town.request.due}!</p>` : "";
        html = `<p class="who">${FACE[h.face]} ${T[h.t].name}: 👥 <b>${h.live}/${h.cap}</b> people</p>` + lines.map((l) => `<p class="bubble">“${esc(l)}”</p>`).join("") + q;
      } else if (c && T[c.t] && c.t !== "road") {
        const t = T[c.t], L = LC.LEVELS[c.t], lvl = c.lv || 1;
        const sh = st.shops.find((q) => q.x === x && q.y === y), wk = st.works.find((q) => q.x === x && q.y === y);
        html = `<p class="who">${L ? L.e[lvl - 1] : t.e} ${LC.nameOf(c)}${L ? ` <small class="lvl">${"★".repeat(lvl)}${"☆".repeat(L.names.length - lvl)}</small>` : ""}</p>`;
        if (sh) html += `<p>${sh.customers} customers live close by, so it earns <b>${sh.coins}</b> coins a year.${sh.coins ? "" : " 💤 Build homes near it!"}</p>`;
        if (wk) html += wk.t === "factory" ? `<p>${wk.workers} workers live close enough, so it earns <b>${wk.coins}</b> coins a year. It's noisy for next-door homes.</p>` : `<p>Trains bring 4 new people a year, and it earns <b>${wk.coins}</b> coins.</p>`;
        if (t.range) html += `<p>It reaches ${LC.rangeOf(c)} squares (shown in yellow).${t.bonus ? " Families near it are extra happy and pay a little more tax." : ""}</p>`;
        if (M.UPKEEP[c.t]) html += `<p class="muted">Costs ${M.UPKEEP[c.t] + lvl - 1} coins a year to run.</p>`;
      } else return hint();
      talk.innerHTML = html;
      // Upgrading lives here, on the building itself, so the toolbar stays
      // one button per kind of building however many levels there are.
      const up = M.nextStep(town, c);
      if (up && !o.locked()) {
        const need = town.rank < up.rank ? M.RANKS[up.rank] : null;
        const box = document.createElement("div");
        box.className = "upgrade";
        box.innerHTML = `<p>⬆️ <b>${up.e} ${up.name}</b>: ${up.what}.</p>`;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn small" + (need ? " ghost" : "");
        b.textContent = need ? `🔒 Unlocks at ${need.name} (${need.at} people)` : `⬆️ Upgrade for ${up.cost} coins`;
        b.disabled = !!need;
        b.addEventListener("click", () => { const err = M.upgrade(town, x, y); if (err) { say(err); LC.Audio.nope(); } else { LC.Audio.build(); changed(); lookAt(x, y); } });
        box.appendChild(b);
        talk.appendChild(box);
      }
      if (c && c.damaged && !o.locked()) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn small";
        b.textContent = `🔧 Repair for ${M.repairCost(c)} coins`;
        b.addEventListener("click", () => { const err = M.repair(town, x, y); if (err) say(err); else { LC.Audio.build(); changed(); lookAt(x, y); } });
        talk.appendChild(b);
      }
    }

    function act(x, y, first) {
      if (!tool) { pick = { x, y }; lookAt(x, y); paint(); return; }
      if (o.locked()) { if (first) say("This town's story is finished. Start a new town from 🏙️ My towns!"); return; }
      const c = g()[y][x];
      // With a building in hand, tapping something already built looks at it.
      if (tool !== "bulldoze" && c) { if (first && tool !== "road") { ghost = null; pick = { x, y }; lookAt(x, y); paint(); } return; }
      if (tool !== "bulldoze" && LC.hasReach(tool) && !(ghost && ghost.x === x && ghost.y === y)) { preview(x, y); return; }
      ghost = null;
      const err = tool === "bulldoze" ? M.bulldoze(town, x, y) : M.build(town, tool, x, y);
      if (err === "skip") return;
      if (err) { if (first) { say(err); LC.Audio.nope(); } return; }
      if (tool === "bulldoze") LC.Audio.boom(); else LC.Audio.build(tool === "road");
      changed();
    }
    function changed() { paint(); cars(true); if (o.onChange) o.onChange(); }
    function preview(x, y) {
      ghost = { x, y };
      pick = null;
      const st = M.look(town), reach = LC.previewCovers(g(), tool, x, y);
      const n = st.homes.filter((h) => reach.some(([a, b]) => a === h.x && b === h.y)).length;
      paint();
      talk.innerHTML = `<p>${T[tool].e} A ${T[tool].name.toLowerCase()} here would reach the yellow squares: <b>${n}</b> home${n === 1 ? "" : "s"}.</p>`;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn small go";
      b.textContent = `✓ Build here for ${T[tool].cost} coins`;
      b.addEventListener("click", () => act(x, y, true));
      talk.appendChild(b);
      talk.insertAdjacentHTML("beforeend", "<p class=\"muted\">Or tap the same square again. Tap another square to try somewhere else.</p>");
    }

    const cellAt = (e) => {
      const s = map.querySelector("svg"), pt = s.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(s.getScreenCTM().inverse());
      const x = Math.floor(p.x / S), y = Math.floor(p.y / S);
      return y >= 0 && y < GH() && x >= 0 && x < GW() ? { x, y } : null;
    };
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
      // With a mouse, hovering shows where a building would reach.
      if (!painting && e.pointerType === "mouse" && tool && LC.hasReach(tool) && !o.locked()) {
        const at = cellAt(e);
        if (at && !g()[at.y][at.x] && !(ghost && ghost.x === at.x && ghost.y === at.y)) { ghost = at; paint(); }
        return;
      }
      if (!painting) return;
      const at = cellAt(e);
      if (!at || at.x + "," + at.y === last) return;
      last = at.x + "," + at.y;
      act(at.x, at.y, false);
    });
    const end = () => { painting = false; last = null; };
    map.addEventListener("pointerup", end);
    map.addEventListener("pointercancel", end);

    // ── Things that move ─────────────────────────────────────────────────────
    const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function spot(el, x, y) { el.style.left = pct(x, GW()); el.style.top = pct(y, GH()); }
    // Cars wander the roads that lead out of town: more people, more cars.
    let fleet = [];
    function cars(reset) {
      const roads = [...LC.Sim.reach(g())].map((k) => k.split(",").map(Number));
      const want = roads.length < 2 ? 0 : Math.min(7, 1 + Math.floor(M.people(town) / 12));
      if (reset) { fleet.forEach((c) => c.el.remove()); fleet = []; }
      while (fleet.length < want) {
        const [x, y] = roads[Math.floor(Math.random() * roads.length)];
        const el = document.createElement("span");
        el.className = "car";
        el.textContent = ["🚗", "🚙", "🚌", "🚕"][fleet.length % 4];
        spot(el, x, y);
        anim.appendChild(el);
        fleet.push({ el, x, y });
      }
      clearInterval(carTimer);
      if (reduced() || !fleet.length) return;
      carTimer = setInterval(() => {
        if (!document.body.contains(root) || root.closest("[hidden]")) { clearInterval(carTimer); return; }
        const set = new Set(roads.map((p) => p.join(",")));
        fleet.forEach((c) => {
          const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c.x + dx, c.y + dy]).filter((p) => set.has(p.join(",")));
          if (!next.length) return;
          const [nx, ny] = next[Math.floor(Math.random() * next.length)];
          c.el.classList.toggle("flip", nx < c.x);
          c.x = nx; c.y = ny;
          spot(c.el, nx, ny);
        });
      }, 1100);
    }
    function smoke() {
      anim.querySelectorAll(".puff").forEach((p) => p.remove());
      if (reduced()) return;
      g().forEach((row, y) => row.forEach((c, x) => {
        if (c && c.t === "factory" && !c.damaged) { const p = document.createElement("span"); p.className = "puff"; p.textContent = "💨"; spot(p, x + 0.15, y - 0.35); anim.appendChild(p); }
      }));
    }
    // End of a year: trucks where families moved in, coins over the town hall.
    function burst(sum, before) {
      if (reduced()) return;
      const after = M.look(town);
      after.homes.forEach((h) => {
        const b = before.homes.find((q) => q.x === h.x && q.y === h.y);
        const gain = h.live - (b ? b.live : 0);
        if (gain) pop(gain > 0 ? "🚚+" + gain : "🚪" + gain, h.x, h.y);
      });
      if (sum && sum.balance) pop((sum.balance > 0 ? "+" : "") + sum.balance + " 💰", 0.6, 0.4, "coin");
    }
    function pop(text, x, y, cls) {
      const p = document.createElement("span");
      p.className = "pop " + (cls || "");
      p.textContent = text;
      spot(p, x, y);
      anim.appendChild(p);
      setTimeout(() => p.remove(), 2200);
    }

    // This year's news, pinned to the map: a pulsing ring and an emoji on
    // each square the news was about, until the next year ends.
    function marks(list, flash) {
      anim.querySelectorAll(".mark").forEach((m) => m.remove());
      (list || []).forEach((m) => {
        const el = document.createElement("span");
        el.className = "mark" + (flash ? " flash" : "");
        el.innerHTML = `<i></i><b>${m.e}</b>`;
        spot(el, m.x, m.y);
        anim.appendChild(el);
      });
    }
    function show(list) {
      marks(list, true);
      wrap.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    function reset() { tool = null; ghost = null; pick = null; hint(); paint(); }

    hint();
    paint();
    cars(true);
    marks(town.marks);
    return { paint, burst, look: () => M.look(town), marks, show, reset, say: (h) => { talk.innerHTML = h; } };
  };
})();
