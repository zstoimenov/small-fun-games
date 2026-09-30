/* Story Builder - runs one level: its rounds, one after another, in #stage.   */
/*                                                                             */
/* start(level, onDone(mistakes)). A mistake is a wrong answer, a wrong story */
/* order, or a Check on writing that doesn't follow the rules yet.            */
"use strict";
window.SB = window.SB || {};

SB.Lesson = (function () {
  const $ = (id) => document.getElementById(id);
  const A = SB.Audio, W = SB.Words;
  let lv = null, ri = 0, mistakes = 0, done = null, box = null;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function button(cls, html, fn) { const b = el("button", cls, html); b.type = "button"; b.addEventListener("click", fn); return b; }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function start(level, onDone) {
    lv = level; ri = 0; mistakes = 0; done = onDone;
    box = $("stage");
    round();
  }
  function stop() { lv = null; A.hush(); }
  function round() {
    A.hush();
    const r = lv.rounds[ri];
    $("roundCount").textContent = lv.rounds.length > 1 ? "Round " + (ri + 1) + " of " + lv.rounds.length : "";
    box.innerHTML = "";
    ({ build, choose, sort, order, mountain })[r.kind](r);
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

  // ── Build a sentence ───────────────────────────────────────────────────────
  function checkButton(rules, test, win) {
    const why = el("p", "why", ""), tail = el("div", "tail");
    let solved = false;
    const check = button("btn go wide", "✓ Check", () => {
      if (solved) return;
      const fail = rules.find((x) => !test(x));
      if (fail) { mistakes++; A.wrong(); say(why, false, fail.tip); return; }
      solved = true;
      A.right();
      check.hidden = true;
      say(why, true, win());
      tail.appendChild(nextButton());
    });
    return { check, why, tail, clear: () => { if (!solved) { why.className = "why"; why.textContent = ""; } } };
  }
  function build(r) {
    const toks = (r.start || []).map((x) => Object.assign({}, x));
    const holder = el("div");
    const c = checkButton(r.rules, (x) => W.check(x, toks), () => "Brilliant sentence! 🎉 \"" + W.text(toks) + "\"");
    box.append(el("h2", "q", r.q), holder, c.check, c.why, c.tail);
    SB.writer(holder, toks, { tabs: r.tabs, tiles: r.tiles, onChange: c.clear });
  }

  // ── Choose ─────────────────────────────────────────────────────────────────
  function choose(r) {
    const why = el("p", "why", ""), tail = el("div", "tail");
    box.appendChild(el("h2", "q", esc(r.q).replace("___", '<span class="gap">___</span>')));
    let slot = null;
    if (r.show) {
      const list = el("ol", "story-parts");
      r.show.forEach((s, k) => {
        const li = el("li", s ? "" : "missing", `<span class="pe" aria-hidden="true">${SB.PARTS[k].e}</span><span>${s ? esc(s) : "???"}</span>`);
        if (!s) slot = li.lastChild;
        list.appendChild(li);
      });
      box.appendChild(list);
    }
    const opts = el("div", "options" + (r.options.some((o) => o.t.length > 20) ? " long" : ""));
    shuffle(r.options.slice()).forEach((o) => {
      const b = button("option", `<b>${esc(o.t)}</b>`, () => {
        if (!o.ok) {
          mistakes++;
          A.wrong();
          b.classList.add("wrong");
          b.disabled = true;
          say(why, false, "Not that one. Read it again and have another go!");
          return;
        }
        A.right();
        b.classList.add("right");
        opts.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        const gap = box.querySelector(".gap");
        if (gap) { gap.textContent = o.t; gap.classList.add("filled"); }
        if (slot) { slot.textContent = o.t; slot.parentNode.classList.remove("missing"); }
        say(why, true, "Yes! " + r.why);
        tail.appendChild(nextButton());
      });
      opts.appendChild(b);
    });
    box.append(opts, why, tail);
  }

  // ── Sort ───────────────────────────────────────────────────────────────────
  function sort(r) {
    const items = shuffle(r.items.slice());
    let i = 0;
    const count = el("p", "goal-count center", "");
    const word = el("div", "big-word", "");
    const bins = el("div", "bins" + (r.bins.length > 3 ? " many" : ""));
    const why = el("p", "why", ""), tail = el("div", "tail");
    const show = () => { count.textContent = (i + 1) + " of " + items.length; word.textContent = items[i][0]; };
    r.bins.forEach((bin) => {
      const b = button("bin", `<span aria-hidden="true">${bin.e}</span><b>${bin.t}</b><span class="bin-got"></span>`, () => {
        if (i >= items.length) return;
        if (items[i][1] !== bin.id) { mistakes++; A.wrong(); say(why, false, "Hmm. Which part of your body would notice that?"); return; }
        A.right();
        why.className = "why";
        why.textContent = "";
        b.querySelector(".bin-got").appendChild(el("span", "got", esc(items[i][0])));
        if (++i < items.length) show();
        else { count.textContent = "All sorted!"; word.hidden = true; say(why, true, "Yes! Writers use all five senses to put you right inside the story."); tail.appendChild(nextButton()); }
      });
      bins.appendChild(b);
    });
    box.append(el("h2", "q", r.q), count, word, bins, why, tail);
    show();
  }

  // ── Put the story in order ─────────────────────────────────────────────────
  function order(r) {
    const mixed = shuffle(r.parts.map((s, i) => ({ s, i })));
    if (mixed.every((x, k) => x.i === k)) mixed.push(mixed.shift());
    let picked = [];
    const list = el("div", "order-list");
    const why = el("p", "why", ""), tail = el("div", "tail");
    const reset = button("btn ghost", "↺ Start again", () => { picked = []; paint(); });
    function paint() {
      list.querySelectorAll(".card-s").forEach((b, k) => {
        const n = picked.indexOf(k);
        b.querySelector(".num").textContent = n >= 0 ? SB.PARTS[n].e : "";
        b.classList.toggle("on", n >= 0);
      });
    }
    mixed.forEach((x, k) => {
      const b = button("card-s", `<span class="num" aria-hidden="true"></span><span>${esc(x.s)}</span>`, () => {
        if (picked.includes(k) || picked.length === r.parts.length) return;
        picked.push(k);
        A.click();
        paint();
        if (picked.length < r.parts.length) return;
        if (picked.every((kk, n) => mixed[kk].i === n)) {
          A.right();
          list.querySelectorAll("button").forEach((x2) => { x2.disabled = true; });
          reset.hidden = true;
          say(why, true, "Yes! " + r.why);
          tail.appendChild(nextButton());
        } else {
          mistakes++;
          A.wrong();
          say(why, false, "Not quite. Which one introduces everyone? Where is the problem?");
          setTimeout(() => { picked = []; paint(); }, 1100);
        }
      });
      list.appendChild(b);
    });
    const guide = el("div", "mini-mountain", SB.PARTS.map((p) => `<span>${p.e} ${p.name}</span>`).join('<span aria-hidden="true">›</span>'));
    box.append(el("h2", "q", "Tap the parts in story order"), guide, list, reset, why, tail);
  }

  // ── Write a whole story ────────────────────────────────────────────────────
  function mountain(r) {
    const parts = SB.PARTS.map(() => []);
    const brief = el("div", "card brief", `<p class="kicker">The brief</p><h2>${esc(r.q.replace(/^Brief: (.)/, (m, c) => c.toUpperCase()))}</h2><ul>${r.rules.map((x) => `<li>${esc(x.tip)}</li>`).join("")}</ul>`);
    const holder = el("div");
    const c = checkButton(r.rules, (x) => W.checkStory(x, parts), () => "What a story! 🎉 Tap 🔊 Read my story to hear it.");
    box.append(brief, holder, c.check, c.why, c.tail);
    SB.mountain(holder, parts, { tabs: r.tabs, onChange: c.clear });
  }

  return { start, stop };
})();
