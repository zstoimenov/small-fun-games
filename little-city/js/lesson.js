/* Little City - runs one level: its rounds, one after another, in #stage.     */
/*                                                                             */
/* start(level, onDone(mistakes)). A mistake is a wrong answer or a Check on  */
/* a town that doesn't meet the brief yet.                                    */
"use strict";
window.LC = window.LC || {};

LC.Lesson = (function () {
  const $ = (id) => document.getElementById(id);
  const A = LC.Audio;
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
  function stop() { lv = null; }
  function round() {
    const r = lv.rounds[ri];
    $("roundCount").textContent = lv.rounds.length > 1 ? "Round " + (ri + 1) + " of " + lv.rounds.length : "";
    box.innerHTML = "";
    // The layout differs: a build round is a map with tools, a choose round a question.
    $("play").dataset.kind = r.kind;
    ({ build, choose })[r.kind](r);
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
  function choose(r) {
    const why = el("p", "why", ""), tail = el("div", "tail");
    if (r.letters) box.appendChild(el("div", "letters", r.letters.map((l) => `<p class="letter">✉️ ${esc(l)}</p>`).join("")));
    box.appendChild(el("h2", "q", esc(r.q)));
    const maps = r.options.some((o) => o.map);
    const opts = el("div", "options" + (maps ? " maps" : ""));
    shuffle(r.options.slice()).forEach((o) => {
      const face = o.map
        ? LC.mapSvg(LC.Sim.parse(o.map), LC.Sim.evaluate(LC.Sim.parse(o.map), []), { small: true, attrs: 'aria-hidden="true"' }) + `<b>${esc(o.t)}</b>`
        : `<span class="opt-e" aria-hidden="true">${o.e}</span><b>${esc(o.t)}</b>`;
      const b = button("option", face, () => {
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
      opts.appendChild(b);
    });
    box.append(opts, why, tail);
  }

  // ── Build to a brief ───────────────────────────────────────────────────────
  function ruleText(x, r) {
    if (x.linked) return "🛣️ Every building joined to a road out of town";
    if (x.people) return "👥 Homes for " + x.people + " people";
    if (x.happy) return "😀 Every family happy";
    if (x.budget) return "💰 Spend no more than " + r.money + " coins";
    if (x.balance) return "📅 The town doesn't lose money each year";
    if (x.covered === "noise") return "🔇 No house right next to the factory";
    if (x.covered === "job") return "💼 Everyone can get to work";
    if (x.covered) return LC.TYPES[x.covered].e + " Every house near a " + LC.TYPES[x.covered].name.toLowerCase();
    return "";
  }
  function build(r) {
    const g = LC.Sim.parse(r.map);
    const brief = el("div", "card brief", `<p class="kicker">The brief</p><ul>${r.rules.map((x) => `<li>${ruleText(x, r)}</li>`).join("")}</ul>`);
    const holder = el("div", "board"), why = el("p", "why", ""), tail = el("div", "tail");
    let solved = false, bd = null;
    const check = button("btn go wide", "✓ Check", () => {
      if (solved) return;
      const st = bd.state();
      const fail = r.rules.find((x) => !LC.Sim.check(x, st, r));
      if (fail) { mistakes++; A.wrong(); say(why, false, fail.tip); return; }
      solved = true;
      A.right();
      check.hidden = true;
      say(why, true, "The town loves it! 🎉 " + (st.people ? st.people + " people live here now." : ""));
      tail.appendChild(nextButton());
    });
    box.append(brief, holder, check, why, tail);
    bd = LC.board(holder, g, { level: r, onChange: () => { if (!solved) { why.className = "why"; why.textContent = ""; } } });
  }

  return { start, stop };
})();
