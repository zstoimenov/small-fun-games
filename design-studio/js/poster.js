/* Design Studio - posters: drawing one, checking one against a brief, and    */
/* the editor where kids build them.                                           */
/*                                                                             */
/* A poster is { bg, title: { text, color, x, y, size }, items: [...] } on a  */
/* 300 x 400 page. An item is a sticker { k: "sticker", e, x, y, s } or a      */
/* shape { k: "shape", shape, color, x, y, s }.                                */
"use strict";
window.DS = window.DS || {};

DS.Poster = (function () {
  const C = DS.Colour;
  const W = 300, H = 400;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function star(s) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.22 : s / 2, a = Math.PI / 5 * i - Math.PI / 2;
      pts.push((r * Math.cos(a)).toFixed(1) + "," + (r * Math.sin(a)).toFixed(1));
    }
    return pts.join(" ");
  }
  function shape(it) {
    const s = it.s, f = `fill="${it.color}"`;
    const at = `transform="translate(${it.x} ${it.y})"`;
    switch (it.shape) {
      case "square": return `<rect ${at} x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${s * 0.08}" ${f}/>`;
      case "triangle": return `<polygon ${at} points="0,${-s / 2} ${s / 2},${s / 2} ${-s / 2},${s / 2}" ${f}/>`;
      case "star": return `<polygon ${at} points="${star(s)}" ${f}/>`;
      case "heart": return `<path transform="translate(${it.x} ${it.y}) scale(${s / 100})" d="M0 38C-62 0-48-50 0-22C48-50 62 0 0 38Z" ${f}/>`;
      default: return `<circle ${at} r="${s / 2}" ${f}/>`;
    }
  }
  // Rough boxes for the selection outline; exact text metrics aren't worth it.
  function box(p, sel) {
    if (sel === "title") { const t = p.title, w = Math.max(40, t.text.length * t.size * 0.62); return [t.x - w / 2, t.y - t.size * 0.6, w, t.size * 1.2]; }
    const it = p.items[sel];
    return it ? [it.x - it.s / 2, it.y - it.s / 2, it.s, it.s] : null;
  }

  // The poster as SVG markup. `sel` draws a dashed box round the selected bit.
  function svg(p, sel, attrs) {
    const items = p.items.map((it, i) => it.k === "sticker"
      ? `<text data-i="${i}" x="${it.x}" y="${it.y}" font-size="${it.s}" text-anchor="middle" dominant-baseline="central">${it.e}</text>`
      : shape(it).replace(/^<(\w+)/, `<$1 data-i="${i}"`)).join("");
    const t = p.title;
    const title = t.text ? `<text data-i="title" x="${t.x}" y="${t.y}" font-size="${t.size}" fill="${t.color}" text-anchor="middle" dominant-baseline="central" font-weight="900" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(t.text)}</text>` : "";
    let outline = "";
    const b = sel != null && sel !== "bg" ? box(p, sel) : null;
    if (b) outline = `<rect x="${b[0] - 6}" y="${b[1] - 6}" width="${b[2] + 12}" height="${b[3] + 12}" rx="8" fill="none" stroke="#5b3cc4" stroke-width="3" stroke-dasharray="8 6" pointer-events="none"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${attrs || ""}><rect data-i="bg" width="${W}" height="${H}" fill="${p.bg}"/>${items}${title}${outline}</svg>`;
  }

  // ── Checking a poster against a brief ──────────────────────────────────────
  const colours = (p) => new Set([p.bg, p.title.text ? p.title.color : null].concat(p.items.filter((i) => i.k === "shape").map((i) => i.color)).filter(Boolean).map((c) => c.toLowerCase()));
  function passes(rule, p) {
    if (rule.bg) return C.temp(p.bg) === rule.bg;
    if (rule.contrast) return !!p.title.text && C.contrast(p.title.color, p.bg) >= rule.contrast;
    if (rule.stickers) return p.items.filter((i) => i.k === "sticker").length >= rule.stickers;
    if (rule.colours) return colours(p).size <= rule.colours;
    return true;
  }

  // ── The editor ─────────────────────────────────────────────────────────────
  // editor(box, poster, { palette: () => [hex], onChange }) -> { paint, select }
  function editor(root, p, o) {
    let sel = null, drag = null;
    root.innerHTML = `<div class="poster-wrap"><div class="poster"></div></div>
      <div class="add-bar">
        <button type="button" class="tool" data-add="bg"><span aria-hidden="true">🖼️</span>Background</button>
        <button type="button" class="tool" data-add="title"><span aria-hidden="true">🔤</span>Words</button>
        <button type="button" class="tool" data-add="sticker"><span aria-hidden="true">⭐</span>Sticker</button>
        <button type="button" class="tool" data-add="shape"><span aria-hidden="true">🔷</span>Shape</button>
      </div>
      <div class="panel card"></div>`;
    const stage = root.querySelector(".poster"), panel = root.querySelector(".panel");

    function paint() {
      stage.innerHTML = svg(p, sel, 'class="poster-svg" role="img" aria-label="Your poster"');
      panelFor();
    }
    function changed() { paint(); if (o.onChange) o.onChange(); }
    function select(s) { sel = s; paint(); }

    function swatches(get, set) {
      const w = document.createElement("div");
      w.className = "swatches";
      o.palette().forEach((hex) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "swatch";
        b.style.background = hex;
        b.setAttribute("aria-label", "Colour " + hex);
        b.setAttribute("aria-pressed", String(get().toLowerCase() === hex.toLowerCase()));
        b.addEventListener("click", () => { set(hex); changed(); });
        w.appendChild(b);
      });
      return w;
    }
    function btn(html, label, fn, cls) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls || "btn ghost small";
      b.innerHTML = html;
      b.setAttribute("aria-label", label);
      b.addEventListener("click", fn);
      return b;
    }
    function panelFor() {
      panel.innerHTML = "";
      const head = document.createElement("p");
      head.className = "panel-head";
      const row = document.createElement("div");
      row.className = "panel-row";
      if (sel === "adding-sticker" || sel === "adding-shape") {
        const sticker = sel === "adding-sticker";
        head.textContent = sticker ? "Tap a sticker to add it" : "Tap a shape to add it";
        const grid = document.createElement("div");
        grid.className = "picker";
        (sticker ? DS.STICKERS : DS.SHAPES).forEach((x) => {
          grid.appendChild(btn(sticker ? x : x.e, sticker ? "Add " + x : "Add " + x.id, () => {
            const n = p.items.length;
            p.items.push(sticker ? { k: "sticker", e: x, x: 80 + (n * 47) % 150, y: 200 + (n * 31) % 120, s: 60 }
              : { k: "shape", shape: x.id, color: o.palette()[0], x: 90 + (n * 41) % 130, y: 210 + (n * 37) % 110, s: 80 });
            sel = p.items.length - 1;
            changed();
          }, "pick"));
        });
        panel.append(head, grid);
        return;
      }
      if (sel == null) { head.textContent = "Tap anything on your poster to change it. Drag to move it."; panel.appendChild(head); return; }
      if (sel === "bg") {
        head.textContent = "🖼️ Background colour";
        panel.append(head, swatches(() => p.bg, (c) => { p.bg = c; }));
        return;
      }
      if (sel === "title") {
        head.textContent = "🔤 Your words";
        row.append(
          btn("✏️ Change words", "Change the words", () => {
            const t = prompt("What should it say?", p.title.text);
            if (t != null) { p.title.text = t.trim().slice(0, 18); changed(); }
          }),
          btn("➖", "Smaller", () => { p.title.size = Math.max(18, p.title.size - 6); changed(); }),
          btn("➕", "Bigger", () => { p.title.size = Math.min(72, p.title.size + 6); changed(); }));
        panel.append(head, swatches(() => p.title.color, (c) => { p.title.color = c; }), row);
        return;
      }
      const it = p.items[sel];
      if (!it) { sel = null; return panelFor(); }
      head.textContent = it.k === "sticker" ? it.e + " Sticker" : "🔷 Shape";
      row.append(
        btn("➖", "Smaller", () => { it.s = Math.max(24, it.s - 14); changed(); }),
        btn("➕", "Bigger", () => { it.s = Math.min(260, it.s + 14); changed(); }),
        btn("⬆️ To front", "Bring to front", () => { p.items.push(p.items.splice(sel, 1)[0]); sel = p.items.length - 1; changed(); }),
        btn("🗑️", "Delete", () => { p.items.splice(sel, 1); sel = null; changed(); }));
      panel.appendChild(head);
      if (it.k === "shape") panel.appendChild(swatches(() => it.color, (c) => { it.color = c; }));
      panel.appendChild(row);
    }

    root.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.add;
      select(a === "bg" ? "bg" : a === "title" ? "title" : "adding-" + a);
      if (a === "title" && !p.title.text) {
        const t = prompt("What should it say?", "");
        if (t) { p.title.text = t.trim().slice(0, 18); changed(); }
      }
    }));

    // Tap to select, drag to move. The page is 300 x 400 however big it's
    // drawn, so pointer positions go through the SVG's own coordinates.
    const toPage = (e) => {
      const s = stage.querySelector("svg"), pt = s.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(s.getScreenCTM().inverse());
    };
    stage.addEventListener("pointerdown", (e) => {
      const hit = e.target.closest("[data-i]");
      if (!hit) return;
      const i = hit.dataset.i;
      const s = i === "bg" ? "bg" : i === "title" ? "title" : +i;
      if (s !== "bg") {
        const obj = s === "title" ? p.title : p.items[s];
        const at = toPage(e);
        drag = { obj, dx: obj.x - at.x, dy: obj.y - at.y, moved: false };
        // Capture can fail (e.g. a pen lifted mid-event); selecting still works.
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        e.preventDefault();
      }
      select(s);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const at = toPage(e);
      drag.obj.x = Math.round(Math.max(0, Math.min(W, at.x + drag.dx)));
      drag.obj.y = Math.round(Math.max(0, Math.min(H, at.y + drag.dy)));
      drag.moved = true;
      stage.innerHTML = svg(p, sel, 'class="poster-svg" role="img" aria-label="Your poster"');
    });
    const end = () => { if (drag && drag.moved && o.onChange) o.onChange(); drag = null; };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);

    paint();
    return { paint, select };
  }

  return { svg, passes, colours, editor, W, H };
})();
