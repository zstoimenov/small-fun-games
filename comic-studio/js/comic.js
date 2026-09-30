/* Comic Studio - drawing a panel, checking a comic against a brief, and the  */
/* editor.                                                                     */
/*                                                                             */
/* A comic is { panels: [panel x 3] }. A panel is a 300 x 240 picture:         */
/*   { scene, chars: [{ c, face, x, y, s, flip }], props: [{ e, x, y, s }],    */
/*     bubbles: [{ kind, text, x, y, tail }] }                                 */
/* kind is say, think, caption or sound; tail is -1, 0 or 1 (left, none,      */
/* right) for say and think bubbles.                                           */
"use strict";
window.CS = window.CS || {};

CS.LINES = {
  say: ["Oh no!", "Let's go!", "Wow!", "Help!", "Hooray!", "Look!", "I did it!", "Thank you!", "Where is it?", "Yum!", "Hello!", "Uh oh..."],
  think: ["Hmm...", "I wonder...", "I hope so!", "What was that?", "I'm hungry...", "Oops!"],
  caption: ["Once upon a time...", "Later that day...", "Meanwhile...", "The next morning...", "The end!"],
  sound: ["POW!", "SPLASH!", "BOOM!", "ZOOM!", "CRASH!", "WOOF!", "BEEP!", "SPLAT!"]
};
CS.KINDS = [{ id: "say", name: "Speech", e: "💬" }, { id: "think", name: "Thought", e: "💭" }, { id: "caption", name: "Caption", e: "📜" }, { id: "sound", name: "Sound word", e: "💥" }];
CS.PROPS = ["⚽", "🎂", "🍦", "🌱", "🌻", "🌧️", "🌊", "🏰", "🚀", "🦴", "🪁", "📚", "🎁", "🔌", "🍪", "🐞", "⭐", "🌙", "🎈", "🔑"];

CS.Comic = (function () {
  const W = 300, H = 240, FONT = "font-family=\"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif\"";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Break words into lines of about 14 letters, so bubbles grow to fit.
  function wrap(text, n) {
    const lines = [];
    String(text).split(/\s+/).forEach((w) => {
      const last = lines[lines.length - 1];
      if (last != null && (last + " " + w).length <= n) lines[lines.length - 1] = last + " " + w;
      else lines.push(w);
    });
    return lines.length ? lines : [""];
  }
  function bubble(b, i) {
    const size = b.kind === "sound" ? 20 : 12.5, lh = size * 1.2;
    const lines = wrap(b.text, b.kind === "caption" ? 22 : b.kind === "sound" ? 10 : 14);
    const w = Math.max(...lines.map((l) => l.length)) * size * 0.6 + 20, h = lines.length * lh + 14;
    const text = lines.map((l, k) => `<text x="0" y="${(k - (lines.length - 1) / 2) * lh}" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="${b.kind === "sound" ? 900 : 700}" ${FONT} fill="${b.kind === "sound" ? "#fff" : "#1b1b1b"}" ${b.kind === "sound" ? 'stroke="#1b1b1b" stroke-width="3" paint-order="stroke"' : ""}>${esc(l)}</text>`).join("");
    let shape;
    if (b.kind === "caption") shape = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#fff3b0" stroke="#1b1b1b" stroke-width="2"/>`;
    else if (b.kind === "sound") {
      const pts = [];
      for (let k = 0; k < 16; k++) { const a = Math.PI * 2 * k / 16, r = k % 2 ? 0.72 : 1; pts.push(`${(Math.cos(a) * (w / 2 + 10) * r).toFixed(1)},${(Math.sin(a) * (h / 2 + 12) * r).toFixed(1)}`); }
      shape = `<polygon points="${pts.join(" ")}" fill="#ffd23d" stroke="#1b1b1b" stroke-width="2"/>`;
    } else if (b.kind === "think") {
      const t = b.tail || 0;
      shape = `<ellipse rx="${w / 2 + 6}" ry="${h / 2 + 4}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/>` +
        (t ? `<circle cx="${t * w * 0.3}" cy="${h / 2 + 12}" r="5" fill="#fff" stroke="#1b1b1b" stroke-width="2"/><circle cx="${t * w * 0.38}" cy="${h / 2 + 22}" r="3" fill="#fff" stroke="#1b1b1b" stroke-width="2"/>` : "");
    } else {
      const t = b.tail == null ? -1 : b.tail;
      const tail = t ? `<path d="M${t * 6} ${h / 2 - 2} L${t * w * 0.35} ${h / 2 + 20} L${t * 20} ${h / 2 - 2}" fill="#fff" stroke="#1b1b1b" stroke-width="2" stroke-linejoin="round"/>` : "";
      shape = `${tail}<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${Math.min(16, h / 2)}" fill="#fff" stroke="#1b1b1b" stroke-width="2"/>` +
        (t ? `<path d="M${t * 7} ${h / 2 - 1.5} L${t * 19} ${h / 2 - 1.5}" stroke="#fff" stroke-width="3"/>` : "");
    }
    return { svg: `<g data-k="bub" data-i="${i}" transform="translate(${b.x} ${b.y})">${shape}${text}</g>`, w: w + 12, h: h + 12 };
  }

  // The panel as SVG. `sel` = { t: "char" | "prop" | "bub", i } gets a dashed box.
  function svg(p, sel, attrs) {
    let out = CS.Art.scene(p.scene);
    p.props.forEach((it, i) => { out += `<text data-k="prop" data-i="${i}" x="${it.x}" y="${it.y}" font-size="${it.s}" text-anchor="middle" dominant-baseline="central">${it.e}</text>`; });
    p.chars.forEach((ch, i) => { out += `<g data-k="char" data-i="${i}" transform="translate(${ch.x} ${ch.y}) scale(${(ch.flip ? -1 : 1) * ch.s / 100} ${ch.s / 100})">${CS.Art.char(ch.c, ch.face)}</g>`; });
    const bubs = p.bubbles.map(bubble);
    bubs.forEach((b) => { out += b.svg; });
    if (sel && sel.t) {
      let bx;
      if (sel.t === "char" && p.chars[sel.i]) { const c = p.chars[sel.i]; bx = [c.x - c.s * 0.35, c.y - c.s * 1.08, c.s * 0.7, c.s * 1.1]; }
      if (sel.t === "prop" && p.props[sel.i]) { const c = p.props[sel.i]; bx = [c.x - c.s / 2, c.y - c.s / 2, c.s, c.s]; }
      if (sel.t === "bub" && p.bubbles[sel.i]) { const c = p.bubbles[sel.i], b = bubs[sel.i]; bx = [c.x - b.w / 2, c.y - b.h / 2, b.w, b.h]; }
      if (bx) out += `<rect x="${bx[0] - 4}" y="${bx[1] - 4}" width="${bx[2] + 8}" height="${bx[3] + 8}" rx="6" fill="none" stroke="#e91e63" stroke-width="2.5" stroke-dasharray="7 5" pointer-events="none"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${attrs || ""}><rect data-k="bg" width="${W}" height="${H}" fill="none"/>${out}<rect width="${W}" height="${H}" fill="none" stroke="#1b1b1b" stroke-width="4" pointer-events="none"/></svg>`;
  }

  // ── Checking a comic against a brief ───────────────────────────────────────
  const panelsOf = (comic, r) => (r.panel != null ? [comic.panels[r.panel]] : r.panels ? r.panels.map((i) => comic.panels[i]) : comic.panels);
  function passes(r, comic) {
    const ps = panelsOf(comic, r).filter(Boolean);
    if (r.face) return ps.some((p) => p.chars.some((c) => (!r.who || c.c === r.who) && r.face.includes(c.face)));
    if (r.kind) return ps.reduce((n, p) => n + p.bubbles.filter((b) => (r.kind === "any" || b.kind === r.kind) && b.text.trim()).length, 0) >= r.min;
    if (r.hero) {
      const ids = CS.CHARS.map((c) => c.id).filter((id) => r.hero === true || r.hero === id);
      return ids.some((id) => comic.panels.every((p) => p.chars.some((c) => c.c === id)));
    }
    if (r.scene) return ps.every((p) => p.scene === r.scene);
    if (r.changes) return new Set(comic.panels.flatMap((p) => p.chars.filter((c) => c.c === r.changes).map((c) => c.face))).size >= 2;
    if (r.moves) return comic.panels[comic.panels.length - 1].scene !== comic.panels[0].scene;
    return true;
  }

  // ── The editor ─────────────────────────────────────────────────────────────
  // editor(root, comic, { onChange }): the strip of panels on top (tap one to
  // work on it), the chosen panel big underneath, and its tools.
  function editor(root, comic, o) {
    let cur = 0, sel = null, drag = null;
    root.innerHTML = `<div class="strip" role="group" aria-label="Your comic's panels"></div>
      <div class="work">
        <div class="big-panel"></div>
        <div class="side">
          <div class="add-bar">
            <button type="button" class="tool" data-add="scene"><span aria-hidden="true">🏞️</span>Scene</button>
            <button type="button" class="tool" data-add="char"><span aria-hidden="true">🧒</span>Character</button>
            <button type="button" class="tool" data-add="words"><span aria-hidden="true">💬</span>Words</button>
            <button type="button" class="tool" data-add="prop"><span aria-hidden="true">⭐</span>Prop</button>
          </div>
          <div class="panel-tools card"></div>
        </div>
      </div>`;
    const strip = root.querySelector(".strip"), big = root.querySelector(".big-panel"), tools = root.querySelector(".panel-tools");
    const P = () => comic.panels[cur];

    function paintStrip() {
      strip.innerHTML = "";
      comic.panels.forEach((p, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "thumb" + (i === cur ? " on" : "");
        b.setAttribute("aria-label", "Panel " + (i + 1) + (i === cur ? ", editing" : ""));
        b.setAttribute("aria-pressed", String(i === cur));
        b.innerHTML = `<span class="num">${i + 1}</span>${svg(p, null, 'aria-hidden="true"')}`;
        b.addEventListener("click", () => { cur = i; sel = null; paint(); });
        strip.appendChild(b);
      });
    }
    function paintBig() { big.innerHTML = svg(P(), sel, `class="panel-svg" role="img" aria-label="Panel ${cur + 1}"`); }
    function paint() { paintStrip(); paintBig(); paintTools(); }
    function changed() { paint(); if (o.onChange) o.onChange(); }

    function btn(html, label, fn, cls) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls || "btn ghost small";
      b.innerHTML = html;
      b.setAttribute("aria-label", label);
      b.addEventListener("click", fn);
      return b;
    }
    function grid(cls, items) { const g = document.createElement("div"); g.className = cls; items.forEach((x) => g.appendChild(x)); return g; }
    function head(text) { const h = document.createElement("p"); h.className = "panel-head"; h.textContent = text; return h; }
    function lines(kind, pick) {
      return grid("lines", CS.LINES[kind].map((t) => btn(t, "Use: " + t, () => pick(t), "line")).concat(btn("✏️ My own words", "Type my own words", () => {
        const t = prompt("What should it say?", "");
        if (t && t.trim()) pick(t.trim().slice(0, 40));
      }, "line own")));
    }

    function paintTools() {
      tools.innerHTML = "";
      const p = P();
      if (sel === "scene") {
        tools.append(head("🏞️ Pick a scene"), grid("picks", CS.SCENES.map((s) => btn(`<span aria-hidden="true">${s.e}</span>${s.name}`, s.name, () => { p.scene = s.id; changed(); }, "pick-lab" + (p.scene === s.id ? " on" : "")))));
        return;
      }
      if (sel === "adding-char") {
        tools.append(head("🧒 Tap someone to add them"), grid("picks", CS.CHARS.map((c) => btn(`<svg viewBox="-45 -112 90 116" aria-hidden="true">${CS.Art.char(c.id, "happy")}</svg>${c.name}`, "Add " + c.name, () => {
          const n = p.chars.length;
          p.chars.push({ c: c.id, face: "happy", x: [90, 210, 150, 60][n % 4], y: 228, s: 120, flip: n % 2 === 1 });
          sel = { t: "char", i: p.chars.length - 1 };
          changed();
        }, "pick-char"))));
        return;
      }
      if (sel === "adding-prop") {
        tools.append(head("⭐ Tap a prop to add it"), grid("picker", CS.PROPS.map((e) => btn(e, "Add " + e, () => {
          const n = p.props.length;
          p.props.push({ e, x: 150 + ((n * 53) % 110) - 50, y: 190, s: 44 });
          sel = { t: "prop", i: p.props.length - 1 };
          changed();
        }, "pick"))));
        return;
      }
      if (sel && sel.t === "adding-words") {
        tools.append(head("💬 What kind of words?"), grid("picks", CS.KINDS.map((k) => btn(`<span aria-hidden="true">${k.e}</span>${k.name}`, k.name, () => { sel = { t: "adding-words", kind: k.id }; paintTools(); }, "pick-lab" + (sel.kind === k.id ? " on" : "")))));
        if (sel.kind) {
          tools.append(head("Tap the words, or write your own"), lines(sel.kind, (t) => {
            const k = sel.kind, near = p.chars[p.chars.length - 1];
            const pos = k === "caption" ? { x: 78, y: 20 } : k === "sound" ? { x: 150, y: 110 } : { x: near ? Math.min(230, Math.max(70, near.x + 20)) : 150, y: 42 };
            p.bubbles.push({ kind: k, text: t, x: pos.x, y: pos.y, tail: k === "say" || k === "think" ? -1 : 0 });
            sel = { t: "bub", i: p.bubbles.length - 1 };
            changed();
          }));
        }
        return;
      }
      if (!sel) { tools.append(head("Tap anything in the panel to change it. Drag to move it.")); return; }
      const row = document.createElement("div");
      row.className = "panel-row";
      const del = (list) => btn("🗑️", "Delete", () => { list.splice(sel.i, 1); sel = null; changed(); });
      const size = (it, step, lo, hi) => [btn("➖", "Smaller", () => { it.s = Math.max(lo, it.s - step); changed(); }), btn("➕", "Bigger", () => { it.s = Math.min(hi, it.s + step); changed(); })];
      if (sel.t === "char") {
        const ch = p.chars[sel.i];
        if (!ch) { sel = null; return paintTools(); }
        tools.append(head("How does " + CS.Art.charOf(ch.c).name + " feel?"), grid("faces", CS.FACES.map((f) => btn(`<span aria-hidden="true">${f.e}</span>${f.name}`, f.name, () => { ch.face = f.id; changed(); }, "face" + (ch.face === f.id ? " on" : "")))));
        row.append(btn("↔️ Flip", "Turn around", () => { ch.flip = !ch.flip; changed(); }), ...size(ch, 15, 60, 190), del(p.chars));
      } else if (sel.t === "prop") {
        const it = p.props[sel.i];
        if (!it) { sel = null; return paintTools(); }
        tools.append(head(it.e + " Prop"));
        row.append(...size(it, 10, 20, 120), del(p.props));
      } else if (sel.t === "bub") {
        const b = p.bubbles[sel.i];
        if (!b) { sel = null; return paintTools(); }
        const kind = CS.KINDS.find((k) => k.id === b.kind);
        tools.append(head(kind.e + " " + kind.name + ": change the words"), lines(b.kind, (t) => { b.text = t; changed(); }));
        if (b.kind === "say" || b.kind === "think") row.append(btn("↔️ Tail", "Point the tail the other way", () => { b.tail = b.tail === -1 ? 1 : b.tail === 1 ? 0 : -1; changed(); }));
        row.append(del(p.bubbles));
      }
      tools.appendChild(row);
    }

    root.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.add;
      sel = a === "scene" ? "scene" : a === "char" ? "adding-char" : a === "prop" ? "adding-prop" : { t: "adding-words" };
      paintBig();
      paintTools();
    }));

    // Tap to select, drag to move, in the panel's own 300 x 240 coordinates.
    const toPanel = (e) => {
      const s = big.querySelector("svg"), pt = s.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(s.getScreenCTM().inverse());
    };
    big.addEventListener("pointerdown", (e) => {
      const hit = e.target.closest("[data-k]");
      if (!hit) return;
      const k = hit.dataset.k;
      if (k === "bg") { sel = null; paintBig(); paintTools(); return; }
      const list = k === "char" ? P().chars : k === "prop" ? P().props : P().bubbles;
      const i = +hit.dataset.i, obj = list[i], at = toPanel(e);
      sel = { t: k, i };
      drag = { obj, dx: obj.x - at.x, dy: obj.y - at.y, moved: false };
      // Capture can fail (e.g. a pen lifted mid-event); selecting still works.
      try { big.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
      paintBig();
      paintTools();
    });
    big.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const at = toPanel(e);
      drag.obj.x = Math.round(Math.max(0, Math.min(W, at.x + drag.dx)));
      drag.obj.y = Math.round(Math.max(0, Math.min(H + 20, at.y + drag.dy)));
      drag.moved = true;
      paintBig();
    });
    const end = () => { if (drag && drag.moved) { paintStrip(); if (o.onChange) o.onChange(); } drag = null; };
    big.addEventListener("pointerup", end);
    big.addEventListener("pointercancel", end);

    paint();
    return { paint };
  }

  return { svg, passes, editor, W, H };
})();
