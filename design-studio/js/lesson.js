/* Design Studio - runs one level: its rounds, one after another, in #stage.   */
/*                                                                             */
/* start(level, onDone(mistakes)). A mistake is a wrong answer, emptying the  */
/* pot to start again, or a Check on a poster that doesn't fit the brief yet. */
"use strict";
window.DS = window.DS || {};

DS.Lesson = (function () {
  const $ = (id) => document.getElementById(id);
  const A = DS.Audio;
  let lv = null, ri = 0, mistakes = 0, done = null, box = null;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function button(cls, html, fn) { const b = el("button", cls, html); b.type = "button"; b.addEventListener("click", fn); return b; }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function start(level, onDone) {
    lv = level; ri = 0; mistakes = 0; done = onDone;
    box = $("stage");
    round();
  }
  function stop() { lv = null; }
  function round() {
    const r = lv.rounds[ri];
    $("roundCount").textContent = lv.rounds.length > 1 ? "Round " + (ri + 1) + " of " + lv.rounds.length : "";
    box.innerHTML = "";
    ({ choose, mix, sort, design })[r.kind](r);
  }
  function nextButton() {
    const last = ri === lv.rounds.length - 1;
    return button("btn go wide", last ? "Finish ✓" : "Next ›", () => {
      if (!lv) return;
      if (++ri < lv.rounds.length) round();
      else { const m = mistakes, d = done; stop(); d(m); }
    });
  }
  function say(p, ok, text) { p.className = "why " + (ok ? "good" : "bad"); p.textContent = text; }

  // ── Choose ─────────────────────────────────────────────────────────────────
  // The painter's colour wheel: red, orange, yellow, green, blue, purple.
  function wheel() {
    const cols = ["#e32b2b", "#ff8000", "#ffe12e", "#00a833", "#2a5fd0", "#800080"];
    const seg = cols.map((c, i) => {
      const a0 = (i * 60 - 120) * Math.PI / 180, a1 = ((i + 1) * 60 - 120) * Math.PI / 180;
      const p = (a, r) => (r * Math.cos(a)).toFixed(1) + " " + (r * Math.sin(a)).toFixed(1);
      return `<path d="M${p(a0, 30)}L${p(a0, 90)}A90 90 0 0 1 ${p(a1, 90)}L${p(a1, 30)}A30 30 0 0 0 ${p(a0, 30)}Z" fill="${c}" stroke="var(--card)" stroke-width="3"/>`;
    }).join("");
    return el("div", "wheel", `<svg viewBox="-100 -100 200 200" role="img" aria-label="Colour wheel: red, orange, yellow, green, blue, purple">${seg}</svg>`);
  }
  function optionFace(o) {
    if (o.poster) return `<span class="mini" style="background:${o.poster.bg};color:${o.poster.fg}">${o.poster.text}</span>`;
    if (o.sw) return `<span class="chip-sw" style="background:${o.sw}"></span><b>${o.t}</b>`;
    return `<span class="opt-e" aria-hidden="true">${o.e}</span><b>${o.t}</b>`;
  }
  function choose(r) {
    const why = el("p", "why", ""), tail = el("div", "tail");
    const opts = el("div", "options" + (r.options.some((o) => o.poster) ? " posters" : ""));
    shuffle(r.options.slice()).forEach((o) => {
      const b = button("option", optionFace(o), () => {
        if (!o.ok) {
          mistakes++;
          A.wrong();
          b.classList.add("wrong");
          b.disabled = true;
          say(why, false, "Not that one. Have another look!");
          return;
        }
        A.right();
        b.classList.add("right");
        opts.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        say(why, true, "Yes! " + r.why);
        tail.appendChild(nextButton());
      });
      if (o.poster) b.setAttribute("aria-label", "Poster " + (r.options.indexOf(o) + 1));
      opts.appendChild(b);
    });
    box.append(el("h2", "q", r.q));
    if (r.wheel) box.appendChild(wheel());
    box.append(opts, why, tail);
  }

  // ── Mix ────────────────────────────────────────────────────────────────────
  function mix(r) {
    const why = el("p", "why", ""), tail = el("div", "tail"), holder = el("div", "mixer");
    box.append(el("h2", "q", r.q), holder, why, tail);
    DS.mixer(holder, {
      paints: r.paints, target: r.target,
      onEmpty: () => { mistakes++; say(why, false, "Fresh start! Think about which colours you need, and how much of each."); },
      onMatch: () => {
        A.right();
        const recipe = Object.keys(r.target).map((k) => r.target[k] + " " + k).join(" + ");
        say(why, true, "Perfect match! The recipe: " + recipe + ".");
        tail.appendChild(nextButton());
      }
    });
  }

  // ── Sort ───────────────────────────────────────────────────────────────────
  function sort(r) {
    const items = shuffle(r.items.slice());
    let i = 0;
    const count = el("p", "goal-count center", "");
    const swatch = el("div", "big-swatch", "");
    const bins = el("div", "bins");
    const why = el("p", "why", ""), tail = el("div", "tail");
    const show = () => { count.textContent = (i + 1) + " of " + items.length; swatch.style.background = items[i][0]; };
    r.bins.forEach((bin) => {
      const b = button("bin", `<span aria-hidden="true">${bin.e}</span><b>${bin.t}</b><span class="bin-got"></span>`, () => {
        if (i >= items.length) return;
        if (items[i][1] !== bin.id) {
          mistakes++;
          A.wrong();
          say(why, false, "Hmm, look again. Does it remind you of fire and sunshine, or water and leaves?");
          return;
        }
        A.right();
        why.className = "why";
        why.textContent = "";
        const dot = el("span", "dot");
        dot.style.background = items[i][0];
        b.querySelector(".bin-got").appendChild(dot);
        if (++i < items.length) show();
        else { count.textContent = "All sorted!"; swatch.hidden = true; say(why, true, "Yes! Warm colours jump out at you; cool colours feel calm and far away."); tail.appendChild(nextButton()); }
      });
      bins.appendChild(b);
    });
    box.append(el("h2", "q", r.q), count, swatch, bins, why, tail);
    show();
  }

  // ── Design ─────────────────────────────────────────────────────────────────
  function design(r) {
    const poster = JSON.parse(JSON.stringify(r.start));
    const brief = el("div", "card brief", `<p class="kicker">The brief</p><h2>${r.q.replace(/^Brief: (.)/, (m, c) => c.toUpperCase())}</h2><ul>${r.rules.map((x) => `<li>${ruleText(x)}</li>`).join("")}</ul>`);
    const holder = el("div", "editor"), why = el("p", "why", ""), tail = el("div", "tail");
    let solved = false;
    const check = button("btn go wide", "✓ Check", () => {
      if (solved) return;
      const fail = r.rules.find((x) => !DS.Poster.passes(x, poster));
      if (fail) { mistakes++; A.wrong(); say(why, false, fail.tip); return; }
      solved = true;
      A.right();
      check.hidden = true;
      say(why, true, "The customer loves it! 🎉 That's a real designer's poster.");
      tail.appendChild(nextButton());
    });
    box.append(brief, holder, check, why, tail);
    DS.Poster.editor(holder, poster, { palette: () => DS.PALETTE, onChange: () => { if (!solved) { why.className = "why"; why.textContent = ""; } } });
  }
  function ruleText(x) {
    if (x.bg) return (x.bg === "warm" ? "🔥 A warm" : "❄️ A cool") + " background";
    if (x.contrast) return "👀 Words you can read from far away";
    if (x.stickers) return "⭐ At least " + x.stickers + " sticker" + (x.stickers > 1 ? "s" : "");
    if (x.colours) return "🎨 " + x.colours + " colours or fewer (stickers don't count)";
    return "";
  }

  return { start, stop };
})();
