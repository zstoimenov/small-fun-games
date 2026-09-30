/* Career Compass - drawing: the dial, the style cards, quiz, ratings, dialogs. */
"use strict";
window.CC = window.CC || {};

CC.UI = (function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const one = (a) => a.name.replace(/s$/, "");
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── The dial ───────────────────────────────────────────────────────────────
  // Style i sits at i*60 degrees, clockwise from the top.
  const at = (deg, r) => { const t = deg * Math.PI / 180; return [+(r * Math.sin(t)).toFixed(2), +(-r * Math.cos(t)).toFixed(2)]; };
  let needleAt = 0, anim = 0, idle = false;

  function dial(sig, best) {
    const wedges = CC.AREAS.map((a, i) => {
      const [x1, y1] = at(i * 60 - 30, 100), [x2, y2] = at(i * 60 + 30, 100), [ex, ey] = at(i * 60, 74);
      const v = sig[a.id].love;
      const op = v == null ? 0.22 : 0.22 + 0.78 * v;
      return `<path d="M0 0L${x1} ${y1}A100 100 0 0 1 ${x2} ${y2}Z" fill="${a.color}" fill-opacity="${op.toFixed(2)}" class="wedge${best && best.id === a.id ? " on" : ""}"/>` +
        `<text x="${ex}" y="${ey}" class="dial-emoji">${a.emoji}</text>`;
    }).join("");
    $("dial").innerHTML = `<svg viewBox="-110 -110 220 220" role="img" aria-label="${best ? "Compass pointing to " + best.name : "Compass, not pointing anywhere yet"}">
      <circle r="106" class="rim"/>${wedges}<circle r="34" class="hub"/>
      <g id="needle" transform="rotate(${needleAt})"><path d="M0 -54L10 0L-10 0Z" class="needle-n"/><path d="M0 26L7 0L-7 0Z" class="needle-s"/><circle r="7" class="pin"/></g>
    </svg>`;
  }

  function setNeedle(a) { needleAt = a; const n = $("needle"); if (n) n.setAttribute("transform", `rotate(${a.toFixed(1)})`); }

  // Swing to a style, going round once first when `spin` is set, with a
  // little overshoot so it settles like a real compass needle.
  function point(best, spin) {
    cancelAnimationFrame(anim);
    idle = !best;
    if (idle) { wobble(); return; }
    let to = CC.AREAS.indexOf(best) * 60;
    const from = needleAt % 360;
    if (reduced()) { setNeedle(to); return; }
    if (spin) to += 360;
    else if (to - from > 180) to -= 360;
    else if (from - to > 180) to += 360;
    const t0 = performance.now(), dur = spin ? 1400 : 700;
    const ease = (x) => { const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
    const tick = (now) => {
      const x = Math.min(1, (now - t0) / dur);
      setNeedle(from + (to - from) * ease(x));
      if (x < 1) anim = requestAnimationFrame(tick); else setNeedle(to % 360);
    };
    anim = requestAnimationFrame(tick);
  }
  // With nothing to go on, the needle drifts, looking for north.
  function wobble() {
    if (reduced()) { setNeedle(0); return; }
    const t0 = performance.now();
    const tick = (now) => {
      if (!idle) return;
      const s = (now - t0) / 1000;
      setNeedle(Math.sin(s * 1.3) * 40 + Math.sin(s * 0.47) * 25);
      anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }
  function still() { cancelAnimationFrame(anim); idle = false; }

  function reading(sig, best) {
    if (!best) {
      $("readKicker").textContent = "Your compass is waiting";
      $("readName").textContent = "Where will it point?";
      $("readSays").textContent = "Answer the questions or rate your games to find out.";
      return;
    }
    const others = CC.AREAS.filter((a) => a !== best && sig[a.id].love != null).sort((x, y) => sig[y.id].love - sig[x.id].love);
    const next = others[0] && sig[others[0].id].love >= sig[best.id].love - 0.12 ? others[0] : null;
    $("readKicker").textContent = "Your compass points to";
    $("readName").textContent = best.emoji + " " + best.name;
    $("readSays").textContent = best.says + (next ? " With a bit of " + one(next) + " " + next.emoji + " too!" : "");
  }

  // ── The six style cards ────────────────────────────────────────────────────
  function areas(sig, best, open) {
    const box = $("areas");
    box.innerHTML = "";
    CC.AREAS.forEach((a) => {
      const s = sig[a.id];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "area" + (best === a ? " lead" : "");
      b.style.setProperty("--c", a.color);
      const chips = (best === a ? '<span class="chip here">🧭 Points here</span>' : "") +
        (s.stars != null && s.stars >= 0.5 ? '<span class="chip good">★ Doing well</span>' : "");
      b.innerHTML = `<span class="area-emoji" aria-hidden="true">${a.emoji}</span>
        <span class="area-text"><b>${a.name}</b><small>${esc(a.says)}</small>
        <span class="meter" aria-hidden="true"><i style="width:${Math.round((s.love || 0) * 100)}%"></i></span>${chips ? `<span class="chips">${chips}</span>` : ""}</span>
        <span class="more" aria-hidden="true">&rsaquo;</span>`;
      b.setAttribute("aria-label", a.name + (best === a ? ", your compass points here" : "") + ". See jobs.");
      b.addEventListener("click", () => open(a));
      box.appendChild(b);
    });
  }

  // ── Would you rather ───────────────────────────────────────────────────────
  function question(i, n, pair, pick) {
    $("qCount").textContent = (i + 1) + " of " + n;
    const box = $("qChoices");
    box.innerHTML = "";
    pair.forEach((c, k) => {
      if (k === 1) { const or = document.createElement("span"); or.className = "or"; or.textContent = "or"; box.appendChild(or); }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice";
      b.innerHTML = `<span class="choice-emoji" aria-hidden="true">${c.e}</span><b>${esc(c.t)}</b>`;
      b.addEventListener("click", () => {
        box.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        b.classList.add("picked");
        pick(c.a);
      });
      box.appendChild(b);
    });
  }

  // ── Ratings ────────────────────────────────────────────────────────────────
  const FACES = [[1, "👍", "Loved it"], [0, "😐", "It was OK"], [-1, "👎", "Not for me"]];
  function rate(games, likes, set) {
    const box = $("rateList");
    box.innerHTML = "";
    if (!games.length) {
      box.innerHTML = `<div class="card empty"><p class="big-emoji" aria-hidden="true">🎮</p><p><b>No games played yet.</b></p><p>Go back to Game Box, play a few, then come back and rate them!</p><a class="btn primary" href="../">Go to Game Box</a></div>`;
      return;
    }
    games.forEach((g) => {
      const row = document.createElement("div");
      row.className = "rate-row card";
      const n = CC.Score.playsOf(g.folder);
      row.innerHTML = `<span class="thumb" style="background:linear-gradient(145deg,${g.colors[0]},${g.colors[1]})" aria-hidden="true">${g.emoji}</span>
        <span class="rate-name"><b>${esc(g.title)}</b><small>Played ${n === 1 ? "once" : n + " times"}</small></span>
        <span class="faces" role="group" aria-label="Did you like ${esc(g.title)}?"></span>`;
      const faces = row.querySelector(".faces");
      FACES.forEach(([v, e, label]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "face";
        b.textContent = e;
        b.setAttribute("aria-label", label);
        b.setAttribute("aria-pressed", String(likes[g.folder] === v));
        b.addEventListener("click", () => {
          set(g.folder, likes[g.folder] === v ? undefined : v);
          faces.querySelectorAll(".face").forEach((x, k) => x.setAttribute("aria-pressed", String(likes[g.folder] === FACES[k][0])));
        });
        faces.appendChild(b);
      });
      box.appendChild(row);
    });
  }

  // ── A style's dialog ───────────────────────────────────────────────────────
  const an = (w) => (/^[aeiou]/i.test(w) ? "an " : "a ") + w.toLowerCase();
  function area(a) {
    $("aEmoji").textContent = a.emoji;
    $("aName").textContent = a.name;
    $("aSays").textContent = a.says;
    $("aShort").textContent = a.name;
    $("aJobs").innerHTML = a.jobs.map((j) => `<div class="job"><span aria-hidden="true">${j.emoji}</span><div><b>${esc(j.name)}</b><p>${esc(j.text)}</p></div></div>`).join("");
    const names = a.jobs.map((j) => an(j.name));
    $("aAsk").textContent = "Ask a grown-up: do you know " + names.slice(0, -1).join(", ") + " or " + names[names.length - 1] + "? What do they do all day?";
    const list = CC.Score.games().filter((g) => g.compass.includes(a.id));
    $("aGames").innerHTML = list.length
      ? list.map((g) => `<a class="game-link" href="../${g.folder}/"><span aria-hidden="true">${g.emoji}</span>${esc(g.title)}</a>`).join("")
      : '<p class="muted">No games for this one yet.</p>';
    // Starting a game from here counts as a play, the same as from Game Box.
    $("aGames").querySelectorAll("a").forEach((l, i) => l.addEventListener("click", () => {
      try {
        const plays = JSON.parse(localStorage.getItem("gamebox:plays")) || {};
        plays[list[i].folder] = (plays[list[i].folder] || 0) + 1;
        localStorage.setItem("gamebox:plays", JSON.stringify(plays));
      } catch (e) { /* private mode */ }
    }));
    $("areaDialog").showModal();
  }

  // ── Grown-ups ──────────────────────────────────────────────────────────────
  function table(sig, best) {
    const dash = '<span class="muted">–</span>';
    $("gTable").innerHTML = "<thead><tr><th>Style</th><th>Quiz</th><th>Likes</th><th>Plays</th><th>Stars</th></tr></thead><tbody>" +
      CC.AREAS.map((a) => {
        const s = sig[a.id];
        const likes = s.up + s.meh + s.down ? `👍${s.up} 😐${s.meh} 👎${s.down}` : dash;
        return `<tr${best === a ? ' class="lead"' : ""}><th>${a.emoji} ${a.name}</th>
          <td>${s.quiz == null ? dash : s.picks + "/4"}</td><td>${likes}</td>
          <td>${s.times || dash}</td><td>${s.stars == null ? dash : Math.round(s.stars * 100) + "%"}</td></tr>`;
      }).join("") + "</tbody>";
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  return { $, one, dial, point, still, reading, areas, question, rate, area, table, toast };
})();
