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

  // Opening the board again (a new town, a reload of the studio) used to leave
  // the last board's window listener, size watcher and car timer running on
  // top of the new ones. Each board hands back how to switch itself off.
  let disposeLast = null;

  LC.mayorBoard = function (root, town, o) {
    if (disposeLast) disposeLast();
    let tool = null, pick = null, painting = false, last = null, carTimer = 0, ghost = null;
    root.innerHTML = `<div class="map-wrap"><div class="map-box"><div class="map"></div><div class="anim" aria-hidden="true"></div></div></div>
      <div class="toolbar" role="group" aria-label="Build"></div>
      <div class="talk-slot"><div class="talk card" aria-live="polite"></div></div>`;
    const map = root.querySelector(".map"), anim = root.querySelector(".anim"), bar = root.querySelector(".toolbar"), talk = root.querySelector(".talk");
    const g = () => town.grid;
    // The talk panel never scrolls: when what it has to say doesn't fit, the
    // least important lines step aside first (hints, what a family likes,
    // bonuses), then long speech bubbles are cut to two lines. Runs whenever
    // the panel's words change, and again when the window changes size.
    const DROP = [".muted", ".likes", ".love", ".perk", ".upgrade p", ".tip", ".coach-acts .ghost"];
    let fitting = false;
    function fit() {
      if (fitting) return;
      fitting = true;
      talk.querySelectorAll(".fit-hide").forEach((el) => el.classList.remove("fit-hide"));
      talk.classList.remove("fit-clamp", "fit-tight");
      const over = () => talk.scrollHeight > talk.clientHeight + 1;
      for (const sel of DROP) {
        if (!over()) break;
        // A tip is the whole message when nothing else is showing.
        if (sel === ".tip" && !talk.querySelector(".coach, .who")) continue;
        talk.querySelectorAll(sel).forEach((el) => el.classList.add("fit-hide"));
      }
      if (over()) talk.classList.add("fit-clamp");
      if (over()) talk.classList.add("fit-tight");
      // On an upright phone the panel rises over the foot of the map when it
      // has more to say: a handle shows it can be tucked back down, and a
      // tucked panel says when something is cut.
      talk.classList.toggle("tall", talk.offsetHeight > slot.clientHeight + 4);
      talk.classList.toggle("cut", talk.classList.contains("fit-clamp") || !!talk.querySelector(".fit-hide") || (talk.classList.contains("tucked") && (!!talk.querySelector(".btn") || talk.children.length > 1)));
      fitting = false;
    }
    const slot = root.querySelector(".talk-slot");
    const rises = () => getComputedStyle(slot).position === "relative";
    // Tips and hints stay tucked to two lines (tap to read the rest), so they
    // never cover the squares they point to. What a tapped square has to say
    // and the town's news rise: that's what the child asked to read.
    let rise = false;
    new MutationObserver(() => {
      talk.classList.toggle("tucked", !rise);
      rise = false;
      if (!fitting) requestAnimationFrame(fit);
    }).observe(talk, { childList: true, subtree: true, characterData: true });
    talk.addEventListener("click", (e) => {
      if (!rises() || e.target.closest("button, a, input")) return;
      if (!talk.classList.contains("tall") && !talk.classList.contains("tucked")) return;
      talk.classList.toggle("tucked");
      fit();
    });
    const onResize = () => requestAnimationFrame(fit);
    window.addEventListener("resize", onResize);
    const GW = () => g()[0].length, GH = () => g().length;
    // Its shape, so the stylesheet can fit the map to the space without cropping
    // it (and the cars and rings drawn over it stay on their squares).
    const box = root.querySelector(".map-box");
    box.style.setProperty("--ar", GW() / GH());
    // The map lives on the play screen's board; the tools and talk stay here.
    const wrap = root.querySelector(".map-wrap");
    if (o.board) { o.board.innerHTML = ""; o.board.appendChild(wrap); }
    // A wide town on a tall screen (an upright phone) gets squares twice the
    // size turned a quarter turn, so it turns whenever that makes the squares
    // clearly bigger. The town itself never changes, only how it is drawn.
    let turn = false;
    function shape() {
      const r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const flat = Math.min(r.width / GW(), r.height / GH()), up = Math.min(r.width / GH(), r.height / GW());
      const t = turn ? up > flat : up > flat * 1.05;
      if (t === turn) return;
      turn = t;
      box.style.setProperty("--ar", turn ? GH() / GW() : GW() / GH());
      paint();
      anim.querySelectorAll("span").forEach((el) => { if (el.at) spot(el, ...el.at); });
    }
    const sizeWatch = window.ResizeObserver ? new ResizeObserver(() => requestAnimationFrame(shape)) : null;
    if (sizeWatch) sizeWatch.observe(wrap);
    disposeLast = () => {
      window.removeEventListener("resize", onResize);
      if (sizeWatch) sizeWatch.disconnect();
      clearInterval(carTimer);
    };

    // Extra marks on the map: how full each home is, broken buildings, sleepy
    // shops, and a ring round anything a letter or an offer is about.
    function decor(st) {
      let s = "";
      st.homes.forEach((h) => {
        const w = S - 12, f = h.cap ? h.live / h.cap : 0;
        s += `<rect x="${h.x * S + 6}" y="${h.y * S + S - 8}" width="${w}" height="4" rx="2" fill="#0003"/><rect x="${h.x * S + 6}" y="${h.y * S + S - 8}" width="${(w * f).toFixed(1)}" height="4" rx="2" fill="#2e7d32"/>`;
      });
      g().forEach((row, y) => row.forEach((c, x) => {
        if (c && c.damaged) s += `<text x="${x * S + S / 2}" y="${y * S + S / 2}" font-size="16" text-anchor="middle" dominant-baseline="central">🔧</text>`;
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
      map.innerHTML = LC.mapSvg(g(), st, { shade, pick, spots: town.spots, ghost: ghost && { x: ghost.x, y: ghost.y, e: T[tool].e }, extra: decor(st), turn, attrs: 'class="map-svg" role="img" aria-label="Your town"' });
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
        const fam = id === "house" && !lockedTo && town.nextFam ? M.FAMS[town.nextFam] : null;
        b.innerHTML = `<span aria-hidden="true">${lockedTo ? "🔒" : e}</span><b>${name}</b>${sub ? `<small>${sub}</small>` : ""}${fam ? `<i class="fam-badge" aria-hidden="true">${fam.e}</i>` : ""}`;
        b.setAttribute("aria-pressed", String(!!on));
        b.setAttribute("aria-label", name + (lockedTo ? ", locked" : "") + (fam ? ", next family: " + fam.name : ""));
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
    // ── The coach (first town only) and the advisor ──────────────────────────
    // town.tutor is the step the coach is on; each step ticks itself off when
    // the mayor does it. After the coach, the advisor gives one tip at a time.
    const STEPS = [
      { text: "Tap 🛣️ <b>Road</b>, then drag from the <b>OUT</b> road to make a street.", done: () => LC.Sim.reach(g()).size >= 4 },
      { text: "Tap 🏠 <b>House</b> and build 2 houses next to your street." + (town.nextFam ? " The little badge shows which family moves in next." : ""), done: () => M.look(town).homes.length >= 2 },
      { text: "Press <b>▶ End year</b>. Families move in when they're happy.", done: () => town.year >= 2 },
      { text: "Tap a house with 👆 <b>Look</b> to hear what the family needs.", done: () => !!town.tutorLooked },
      { text: "Build what they ask for, then keep ending years. Tap <b>?</b> for the mayor's guide" + (town.missions ? " and 🎯 for your missions" : "") + ". Good luck, Mayor!", done: () => false, last: true }
    ];
    function coach() {
      if (!town.tutor || o.locked()) return "";
      while (town.tutor <= STEPS.length && !STEPS[town.tutor - 1].last && STEPS[town.tutor - 1].done()) town.tutor++;
      const st = STEPS[town.tutor - 1];
      return `<div class="coach"><p><b>🎓 Step ${town.tutor} of ${STEPS.length}:</b> ${st.text}</p><div class="coach-acts">${st.last ? '<button type="button" class="btn small go" data-coach="done">👍 Got it</button>' : ""}<button type="button" class="btn small ghost" data-coach="skip">Skip tips</button></div></div>`;
    }
    talk.addEventListener("click", (e) => {
      if (e.target.closest("[data-retire]")) { LC.Audio.click(); o.onRetire(); return; }
      const b = e.target.closest("[data-coach]");
      if (!b) return;
      delete town.tutor;
      if (o.onTutorDone) o.onTutorDone();
      LC.Audio.click();
      hint();
    });
    function advisor() {
      const a = M.advice(town);
      return a ? `<div class="tip"><p><span class="tip-e" aria-hidden="true">${a.e}</span> ${esc(a.text)}</p>${(a.retire || M.canRetire(town)) && o.onRetire ? '<button type="button" class="btn small go" data-retire>🎉 Farewell party</button>' : ""}</div>` : "";
    }
    const say = (html) => { talk.innerHTML = coach() + `<p>${html}</p>`; };
    function hint() {
      if (!tool) { talk.innerHTML = (coach() || advisor()) + `<p class="muted">👆 Tap a house to hear the family. Tap a building to see how it's doing.</p>`; return; }
      if (tool === "bulldoze") return say("🧹 Tap something to clear it. You get half the coins back. Trees cost 2 coins to clear.");
      if (tool === "road") return say("🛣️ Tap or drag across the grass to build roads. 1 coin each.");
      const t = T[tool];
      const v2 = M.isV2(town);
      if (tool === "house" && town.nextFam) {
        const F = M.FAMS[town.nextFam];
        return say(`🏠 Next to move in: <b>${F.e} ${F.name}</b>. They want ${esc(F.likes)}. Tap a grass square next to a road to build their house for ${t.cost} coins.`);
      }
      if (v2 && tool === "factory" && (town.spots || []).some((p) => p.k === "rocks")) return say(`🏭 Factories give jobs but are noisy. Build one on 🪨 rocky ground and it earns double! ${t.cost} coins.`);
      if (v2 && tool === "shop") return say(`🏪 Shops sell to homes close by. Two shops side by side make a high street and earn more. ${t.cost} coins. First you'll see how far it reaches (yellow), then tap the same square again to build.`);
      say(`${t.e} Tap a grass square next to a road to build a ${t.name.toLowerCase()} for ${t.cost} coins.${LC.hasReach(tool) ? " First you'll see how far it reaches (yellow), then tap the same square again to build." : ""}${M.UPKEEP[tool] ? ` It costs ${M.UPKEEP[tool]} coins a year to run.` : ""}`);
    }

    function lookAt(x, y) {
      rise = true;
      const st = M.look(town), c = g()[y][x];
      const h = st.homes.find((q) => q.x === x && q.y === y);
      let html = "";
      if (h) {
        if (town.tutor) town.tutorLooked = true;
        const lines = h.missing.length ? h.missing.map((m) => LC.NEEDS[m]) : [h.live ? LC.HAPPY[(x * 7 + y * 3) % LC.HAPPY.length] : "This home is ready. Families move in when everything they need is close by!"];
        const q = town.request && town.request.x === x && town.request.y === y ? `<p class="perk">✉️ They asked for a ${T[town.request.need].name.toLowerCase()} by year ${town.request.due}.</p>` : "";
        const F = h.fam && M.FAMS[h.fam];
        const nice = { park: "🌳 a park next door", view: "🌊 a water view" };
        const perks = (h.extras || []).map((k) => nice[k]).filter(Boolean);
        html = `<p class="who">${FACE[h.face]} ${F ? `${F.e} ${F.name}` : T[h.t].name}: 👥 <b>${h.live}/${h.cap}</b> people</p>` + `<p class="bubble">“${lines.map(esc).join(" ")}”</p>` + q +
          (F ? `<p class="likes">They want ${esc(F.likes)}.</p>` : "") +
          (perks.length ? `<p class="perk love">💛 They love ${perks.join(" and ")}.</p>` : "");
      } else if (c && c.t === "road" && M.isV3(town)) {
        const k = x + "," + y, n = (st.traffic && st.traffic.load[k]) || 0, cap = M.capOfRoad(c), lv = +(c.wide || 0);
        const jam = st.traffic && st.traffic.on && n > cap;
        html = `<p class="who">🛣️ ${c.entry ? "Road out of town" : M.ROAD_NAMES[lv][0].toUpperCase() + M.ROAD_NAMES[lv].slice(1)}</p><p>${jam ? "🚗🚗 <b>Traffic jam!</b> " : ""}<b>${Math.ceil(n)}</b> cars a day drive here, and it fits <b>${cap}</b>.${n ? "" : " Every 4 people make a car on its way out of town."}</p>` +
          (jam ? `<p class="muted">Widen it, or build another way out so some cars go round.</p>` : !st.traffic.on && n >= cap ? `<p class="muted">Jams start to matter when ${M.TRAFFIC_AT} people live here.</p>` : "");
        const w = M.widenStep(town, c);
        if (w && !o.locked()) {
          const need = town.rank < w.rank ? M.RANKS[w.rank] : null;
          const box = document.createElement("div");
          box.className = "upgrade";
          box.innerHTML = `<p>⬆️ <b>${w.name}</b>: fits ${w.cap} cars instead of ${cap}.</p>`;
          const b = document.createElement("button");
          b.type = "button";
          b.className = "btn small" + (need ? " ghost" : "");
          b.textContent = need ? `🔒 ${w.name} at ${need.name} (${need.at} people)` : `⬆️ ${w.name} for ${w.cost} coins`;
          b.disabled = !!need;
          b.addEventListener("click", () => { const err = M.widen(town, x, y); if (err) { say(err); LC.Audio.nope(); } else { LC.Audio.build(true); changed(); lookAt(x, y); } });
          box.appendChild(b);
          talk.innerHTML = html;
          talk.appendChild(box);
          return;
        }
      } else if (c && c.t === "castle") {
        html = `<p class="who">🏰 The old castle</p><p>${st.tourists ? "A road reaches it, so tourists visit: <b>+3</b> coins a year. Shops within 3 squares earn +2 from them." : "Build a road right next to it and tourists will come: +3 coins a year, and shops nearby earn more."}</p>`;
      } else if (!c && (town.spots || []).some((p) => p.k === "rocks" && p.x === x && p.y === y)) {
        html = `<p class="who">🪨 Rocky ground</p><p>A 🏭 factory built here digs up what it needs, so it earns double.</p>`;
      } else if (c && T[c.t] && c.t !== "road") {
        const t = T[c.t], L = LC.LEVELS[c.t], lvl = c.lv || 1;
        const sh = st.shops.find((q) => q.x === x && q.y === y), wk = st.works.find((q) => q.x === x && q.y === y);
        html = `<p class="who">${L ? L.e[lvl - 1] : t.e} ${LC.nameOf(c)}${L ? ` <small class="lvl">${"★".repeat(lvl)}${"☆".repeat(L.names.length - lvl)}</small>` : ""}</p>`;
        if (sh) html += `<p>${sh.customers} customers live close by, so it earns <b>${sh.coins}</b> coins a year.${sh.coins ? "" : " 💤 Build homes near it!"}</p>`;
        ((sh || wk || {}).why || []).forEach((w) => { if ((sh || wk).coins) html += `<p class="perk">➕ ${w.coins}: ${esc(w.text)}</p>`; });
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
        b.textContent = need ? `🔒 ${up.name} at ${need.name} (${need.at} people)` : `⬆️ ${up.name} for ${up.cost} coins`;
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
    // The coach moves on as soon as a step is done, even with a tool in hand.
    function changed() {
      const step = town.tutor;
      paint(); cars(true);
      if (step && coach() && town.tutor !== step) { if (tool) hint(); else hint(); }
      if (o.onChange) o.onChange();
    }
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
      // Measured against the town's own squares, turned or not.
      const p = pt.matrixTransform((s.querySelector("g.turn") || s).getScreenCTM().inverse());
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
    // Puts something on a square; sx and sy nudge it across the screen (in
    // squares), so smoke still rises upward on a turned map.
    function spot(el, x, y, sx = 0, sy = 0) {
      el.at = [x, y, sx, sy];
      const col = turn ? GH() - 1 - y : x, row = turn ? x : y;
      el.style.left = pct(col + sx, turn ? GH() : GW());
      el.style.top = pct(row + sy, turn ? GW() : GH());
    }
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
          const ahead = turn ? c.y - ny : nx - c.x;
          if (ahead) c.el.classList.toggle("flip", ahead < 0);
          c.x = nx; c.y = ny;
          spot(c.el, nx, ny);
        });
      }, 1100);
    }
    function smoke() {
      anim.querySelectorAll(".puff").forEach((p) => p.remove());
      if (reduced()) return;
      g().forEach((row, y) => row.forEach((c, x) => {
        if (c && c.t === "factory" && !c.damaged) { const p = document.createElement("span"); p.className = "puff"; p.textContent = "💨"; spot(p, x, y, 0.15, -0.35); anim.appendChild(p); }
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
    // Turned or not from the first frame, so the first tap lands where it looks.
    shape();
    paint();
    cars(true);
    marks(town.marks);
    return { paint, burst, look: () => M.look(town), marks, show, reset, say: (h) => { rise = true; talk.innerHTML = h; } };
  };
})();
