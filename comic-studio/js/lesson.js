/* Comic Studio - runs one level: its rounds, one after another, in #stage.    */
/*                                                                             */
/* start(level, onDone(mistakes)). A mistake is a wrong answer, a wrong story */
/* order, or a Check on a comic that doesn't fit the brief yet.               */
"use strict";
window.CS = window.CS || {};

CS.Lesson = (function () {
  const $ = (id) => document.getElementById(id);
  const A = CS.Audio;
  let lv = null, ri = 0, mistakes = 0, done = null, box = null;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function button(cls, html, fn) { const b = el("button", cls, html); b.type = "button"; b.addEventListener("click", fn); return b; }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mini = (p) => CS.Comic.svg(p, null, 'aria-hidden="true"');

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
    ({ order, choose, build })[r.kind](r);
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

  // ── Put it in order ────────────────────────────────────────────────────────
  function order(r) {
    const mixed = shuffle(r.panels.map((p, i) => ({ p, i })));
    // Never hand out the right order by chance.
    if (mixed.every((x, k) => x.i === k)) mixed.push(mixed.shift());
    let picked = [];
    const strip = el("div", "strip read order");
    const why = el("p", "why", ""), tail = el("div", "tail");
    const reset = button("btn ghost", "↺ Start again", () => { picked = []; paint(); });
    function paint() {
      strip.querySelectorAll(".thumb").forEach((b, k) => {
        const n = picked.indexOf(k);
        b.querySelector(".num").textContent = n >= 0 ? n + 1 : "";
        b.classList.toggle("on", n >= 0);
        b.setAttribute("aria-label", "Panel" + (n >= 0 ? ", number " + (n + 1) : ", not numbered yet"));
      });
    }
    mixed.forEach((x, k) => {
      const b = button("thumb", `<span class="num"></span>${mini(x.p)}`, () => {
        if (picked.includes(k) || picked.length === 3) return;
        picked.push(k);
        A.click();
        paint();
        if (picked.length < 3) return;
        if (picked.every((kk, n) => mixed[kk].i === n)) {
          A.right();
          strip.querySelectorAll("button").forEach((x2) => { x2.disabled = true; });
          reset.hidden = true;
          say(why, true, "Yes! " + r.why);
          tail.appendChild(nextButton());
        } else {
          mistakes++;
          A.wrong();
          say(why, false, "Not quite. Which panel starts the story? Which one is the ending?");
          setTimeout(() => { picked = []; paint(); }, 900);
        }
      });
      strip.appendChild(b);
    });
    box.append(el("h2", "q", "Tap the panels in story order"), strip, reset, why, tail);
    paint();
  }

  // ── Choose ─────────────────────────────────────────────────────────────────
  function bubbleIcon(kind) {
    if (kind === "say") return `<svg viewBox="-4 0 68 52" class="bub-ico" aria-hidden="true"><path d="M6 6h44a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H26l-10 10v-10H6a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z" fill="#fff" stroke="#1b1b1b" stroke-width="3"/></svg>`;
    if (kind === "think") return `<svg viewBox="-4 0 68 56" class="bub-ico" aria-hidden="true"><ellipse cx="30" cy="22" rx="30" ry="18" fill="#fff" stroke="#1b1b1b" stroke-width="3"/><circle cx="16" cy="44" r="5" fill="#fff" stroke="#1b1b1b" stroke-width="2.5"/><circle cx="8" cy="52" r="3" fill="#fff" stroke="#1b1b1b" stroke-width="2"/></svg>`;
    if (kind === "caption") return `<svg viewBox="-4 0 68 52" class="bub-ico" aria-hidden="true"><rect x="0" y="10" width="60" height="30" fill="#fff3b0" stroke="#1b1b1b" stroke-width="3"/></svg>`;
    const pts = Array.from({ length: 16 }, (_, k) => { const a = Math.PI * 2 * k / 16, r = k % 2 ? 0.62 : 1; return `${(30 + Math.cos(a) * 30 * r).toFixed(1)},${(26 + Math.sin(a) * 24 * r).toFixed(1)}`; }).join(" ");
    return `<svg viewBox="-4 0 68 52" class="bub-ico" aria-hidden="true"><polygon points="${pts}" fill="#ffd23d" stroke="#1b1b1b" stroke-width="3"/></svg>`;
  }
  function optionFace(o) {
    if (o.panel) return mini(o.panel);
    // No label under a face: reading the face is the whole point.
    if (o.face) return `<svg viewBox="-34 -100 68 70" class="face-ico big" aria-hidden="true">${CS.Art.char(o.face.c, o.face.f)}</svg>`;
    if (o.bub) return bubbleIcon(o.bub) + `<b>${o.t}</b>`;
    return `<span class="opt-e" aria-hidden="true">${o.e}</span><b>${o.t}</b>`;
  }
  function choose(r) {
    const why = el("p", "why", ""), tail = el("div", "tail");
    box.appendChild(el("h2", "q", r.q));
    let slot = null;
    if (r.show) {
      const strip = el("div", "strip read");
      r.show.forEach((p, k) => {
        const t = el("div", "thumb" + (p ? "" : " ask"), `<span class="num">${k + 1}</span>` + (p ? mini(p) : '<span class="qmark">?</span>'));
        if (!p) slot = t;
        strip.appendChild(t);
      });
      box.appendChild(strip);
    }
    const panels = r.options.some((o) => o.panel);
    const opts = el("div", "options" + (panels ? " panels" : ""));
    shuffle(r.options.slice()).forEach((o, k) => {
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
        if (slot && o.panel) { slot.classList.remove("ask"); slot.innerHTML = slot.querySelector(".num").outerHTML + mini(o.panel); }
        say(why, true, "Yes! " + r.why);
        tail.appendChild(nextButton());
      });
      if (o.panel) b.setAttribute("aria-label", "Choice " + (k + 1));
      if (o.face) b.setAttribute("aria-label", o.t);
      opts.appendChild(b);
    });
    box.append(opts, why, tail);
  }

  // ── Build to a brief ───────────────────────────────────────────────────────
  function ruleText(x) {
    if (x.face && x.panel != null) return "Panel " + (x.panel + 1) + ": " + (x.face.includes("happy") && x.face.length === 1 ? "a happy face (the fix)" : "a worried face (the problem)");
    if (x.face) return "😀 The right face for " + CS.Art.charOf(x.who).name;
    if (x.kind === "any") return "💬 At least " + x.min + " bubbles, captions or sound words";
    if (x.kind) { const k = CS.KINDS.find((kk) => kk.id === x.kind); return k.e + " At least " + x.min + " " + k.name.toLowerCase() + (x.min > 1 ? "s" : "") + (x.kind === "say" ? " bubble" + (x.min > 1 ? "s" : "") : "") + (x.panels ? " (in panel " + x.panels.map((i) => i + 1).join(" or ") + ")" : ""); }
    if (x.hero) return "🧒 " + (x.hero === true ? "The same hero" : CS.Art.charOf(x.hero).name) + " in every panel";
    if (x.changes) return "🎭 " + CS.Art.charOf(x.changes).name + "'s feelings change";
    if (x.moves) return "🏞️ A new scene by the end";
    return "";
  }
  function build(r) {
    const comic = JSON.parse(JSON.stringify(r.start));
    const brief = el("div", "card brief", `<p class="kicker">The brief</p><h2>${r.q.replace(/^Brief: (.)/, (m, c) => c.toUpperCase())}</h2><ul>${r.rules.map((x) => `<li>${ruleText(x)}</li>`).join("")}</ul>`);
    const holder = el("div", "editor" + (comic.panels.length === 1 ? " single" : "")), why = el("p", "why", ""), tail = el("div", "tail");
    let solved = false;
    const check = button("btn go wide", "✓ Check", () => {
      if (solved) return;
      const fail = r.rules.find((x) => !CS.Comic.passes(x, comic));
      if (fail) { mistakes++; A.wrong(); say(why, false, fail.tip); return; }
      solved = true;
      A.right();
      check.hidden = true;
      say(why, true, "That's a real comic! 🎉 The editor loves it.");
      tail.appendChild(nextButton());
    });
    box.append(brief, holder, check, why, tail);
    CS.Comic.editor(holder, comic, { onChange: () => { if (!solved) { why.className = "why"; why.textContent = ""; } } });
  }

  return { start, stop };
})();
