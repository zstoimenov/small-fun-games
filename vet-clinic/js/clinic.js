/* Vet Clinic - plays one level into #clinic: the heartbeat game, the         */
/* thermometer game, or a full case (owner's story, checks, diagnosis,        */
/* treatment, home care). Each counts mistakes and hands the total back to    */
/* app.js, which turns it into stars.                                          */
/*                                                                             */
/* Every answer, right or wrong, shows WHY, and every number is shown against */
/* that animal's normal range, never on its own.                              */
"use strict";
window.VC = window.VC || {};

VC.Clinic = (function () {
  const $ = (id) => document.getElementById(id);
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function button(cls, html, onClick) {
    const b = el("button", cls, html);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
  const fmt = (v) => (Math.round(v * 10) / 10).toString();

  let mistakes = 0, done = null, sound = null, beatTimer = 0;
  const box = () => $("clinic");
  function progress(t) { $("clinicProgress").textContent = t; }
  function stopBeat() { clearInterval(beatTimer); beatTimer = 0; }

  // A number drawn on its normal range: green band = normal, pin = this one.
  function rangeBar(num) {
    const [lo, hi] = num.range;
    const span = hi - lo;
    const min = lo - span * 0.7, max = hi + span * 0.7;
    const pos = (v) => Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
    return '<div class="range" aria-hidden="true"><span class="band" style="left:' + pos(lo) + "%;width:" + (pos(hi) - pos(lo)) + '%"></span>' +
      '<span class="pin" style="left:' + pos(num.v) + '%"></span></div>' +
      '<small class="range-lbl">Normal: ' + fmt(lo) + "\u{2013}" + fmt(hi) + " " + num.unit + "</small>";
  }

  // A question card with three answers: wrong ones cost a mistake and show the right one.
  function ask(parent, item, emoji, next, nextLabel) {
    const card = el("div", "card quiz-card");
    if (emoji) card.appendChild(el("span", "q-emoji", emoji)).setAttribute("aria-hidden", "true");
    card.appendChild(el("h2", "", item.q));
    const answers = el("div", "answers");
    const order = shuffle(item.a.map((_, k) => k));
    const why = el("p", "why");
    order.forEach((k) => {
      const b = button("answer", item.a[k], () => {
        answers.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        const ok = k === item.right;
        if (!ok) mistakes++;
        b.classList.add(ok ? "right" : "wrong");
        if (!ok) answers.querySelectorAll("button")[order.indexOf(item.right)].classList.add("right");
        sound(ok ? "right" : "wrong");
        why.className = "why " + (ok ? "good" : "bad");
        why.textContent = (ok ? "Yes! " : "Not quite. ") + item.why;
        const n = button("btn", nextLabel || "Next &rsaquo;", () => { card.querySelector(".actions").remove(); next(); });
        card.appendChild(el("div", "actions")).appendChild(n);
        n.scrollIntoView({ behavior: "smooth", block: "nearest" });
        n.focus({ preventScroll: true });
      });
      answers.appendChild(b);
    });
    card.appendChild(answers);
    card.appendChild(why);
    parent.appendChild(card);
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    return card;
  }

  // ── Whose heartbeat? ───────────────────────────────────────────────────────
  // Each animal plays at the middle of its normal range, so mouse vs elephant
  // is 600 against 30: easy to hear, and easy to see on the pulsing heart.
  function heartGame(cfg) {
    const N = VC.NORMAL;
    const rate = (sp) => Math.round((N[sp].heart[0] + N[sp].heart[1]) / 2 / 10) * 10;
    let i = 0;
    const card = el("div", "card beat-card");
    box().appendChild(card);
    function show() {
      stopBeat();
      progress("Heartbeat " + (i + 1) + " of " + cfg.rounds.length);
      const sp = cfg.rounds[i];
      const bpm = rate(sp);
      card.innerHTML = "";
      const h = el("div", "big-heart", "\u{2764}\u{FE0F}");
      h.setAttribute("aria-hidden", "true");
      card.appendChild(el("p", "hint", "\u{1FA7A} Listen through the stethoscope..."));
      card.appendChild(h);
      h.style.animationDuration = Math.max(0.08, 60 / bpm) + "s";
      beatTimer = setInterval(() => sound("beat"), 60000 / bpm);
      const grid = el("div", "choice-grid");
      const why = el("p", "why");
      cfg.choices.forEach((c) => {
        const b = button("choice", '<span aria-hidden="true">' + N[c].e + "</span>" + N[c].name, () => {
          grid.querySelectorAll("button").forEach((x) => { x.disabled = true; });
          const ok = c === sp;
          if (!ok) mistakes++;
          b.classList.add(ok ? "right" : "wrong");
          if (!ok) grid.querySelectorAll("button")[cfg.choices.indexOf(sp)].classList.add("right");
          sound(ok ? "right" : "wrong");
          why.className = "why " + (ok ? "good" : "bad");
          why.textContent = (ok ? "Yes! " : "Not quite. ") + "That was a " + N[sp].name.toLowerCase() + ": about " + bpm +
            " beats a minute. Normal for a " + N[sp].name.toLowerCase() + " is " + N[sp].heart[0] + "\u{2013}" + N[sp].heart[1] + ".";
          const n = button("btn", i < cfg.rounds.length - 1 ? "Next heartbeat &rsaquo;" : "Finish &rsaquo;", () => {
            i++;
            if (i < cfg.rounds.length) show(); else { stopBeat(); finish(); }
          });
          card.appendChild(el("div", "actions")).appendChild(n);
        });
        grid.appendChild(b);
      });
      card.appendChild(grid);
      card.appendChild(why);
    }
    show();
  }

  // ── Hot or not? ────────────────────────────────────────────────────────────
  function tempGame(cfg) {
    const N = VC.NORMAL;
    let i = 0;
    const card = el("div", "card temp-card");
    box().appendChild(card);
    function show() {
      progress("Patient " + (i + 1) + " of " + cfg.rounds.length);
      const r = cfg.rounds[i];
      const [lo, hi] = N[r.sp].temp;
      const truth = r.v > hi ? "hot" : r.v < lo ? "cold" : "ok";
      card.innerHTML = "";
      card.appendChild(el("span", "q-emoji", N[r.sp].e)).setAttribute("aria-hidden", "true");
      card.appendChild(el("h2", "", r.sp === "you" ? "Your temperature" : r.name + " the " + N[r.sp].name.toLowerCase()));
      card.appendChild(el("p", "thermo", "\u{1F321}\u{FE0F} " + fmt(r.v) + " \u{00B0}C"));
      const row = el("div", "choice-grid three");
      const why = el("p", "why");
      const bar = el("div", "bar-slot");
      [["ok", "\u{2705} Normal"], ["hot", "\u{1F525} Too hot"], ["cold", "\u{1F9CA} Too cold"]].forEach(([k, label]) => {
        const b = button("choice", label, () => {
          row.querySelectorAll("button").forEach((x) => { x.disabled = true; });
          const ok = k === truth;
          if (!ok) mistakes++;
          b.classList.add(ok ? "right" : "wrong");
          if (!ok) row.querySelector('[data-k="' + truth + '"]').classList.add("right");
          sound(ok ? "right" : "wrong");
          bar.innerHTML = rangeBar({ v: r.v, unit: "\u{00B0}C", range: [lo, hi] });
          const who = r.sp === "you" ? "a person" : "a " + N[r.sp].name.toLowerCase();
          why.className = "why " + (ok ? "good" : "bad");
          why.textContent = (ok ? "Yes! " : "Not quite. ") + "Normal for " + who + " is " + fmt(lo) + "\u{2013}" + fmt(hi) + " \u{00B0}C, so " +
            fmt(r.v) + " is " + (truth === "ok" ? "normal." : truth === "hot" ? "too hot. That's a fever." : "too cold.");
          const n = button("btn", i < cfg.rounds.length - 1 ? "Next patient &rsaquo;" : "Finish &rsaquo;", () => {
            i++;
            if (i < cfg.rounds.length) show(); else finish();
          });
          card.appendChild(el("div", "actions")).appendChild(n);
        });
        b.dataset.k = k;
        row.appendChild(b);
      });
      card.appendChild(row);
      card.appendChild(bar);
      card.appendChild(why);
    }
    show();
  }

  // ── A case ─────────────────────────────────────────────────────────────────
  function caseGame(cfg) {
    const N = VC.NORMAL;
    const emoji = cfg.sp ? N[cfg.sp].e : cfg.animal;
    const title = cfg.sp ? cfg.pet + " the " + N[cfg.sp].name.toLowerCase() : cfg.pet.charAt(0).toUpperCase() + cfg.pet.slice(1);
    const B = box();
    const head = el("div", "card patient");
    head.innerHTML = '<span class="patient-e" aria-hidden="true">' + emoji + '</span><div><h2>' + title + '</h2><p class="bubble">\u{1F4AC} ' + cfg.owner + "</p></div>";
    B.appendChild(head);

    const tools = el("div", "tools");
    tools.setAttribute("role", "group");
    tools.setAttribute("aria-label", "Checks");
    const results = el("div", "results");
    let used = 0, wasted = 0;
    progress("Checks done: 0");
    VC.TOOLS.forEach((t) => {
      const b = button("tool", '<span aria-hidden="true">' + t.e + "</span>" + t.label, () => {
        if (b.disabled) return;
        b.disabled = true;
        b.classList.add("used");
        used++;
        const r = cfg.checks[t.id];
        const bad = VC.isBad(r);
        if (r.waste) { wasted++; mistakes++; }
        sound(r.waste ? "hmm" : bad ? "clue" : "check");
        const verdict = r.waste ? '<span class="chip meh">\u{1F914} Not needed</span>'
          : bad ? '<span class="chip bad">\u{26A0}\u{FE0F} Not normal</span>' : '<span class="chip ok">\u{2705} Normal</span>';
        const item = el("div", "result" + (bad ? " is-bad" : "") + (r.waste ? " is-waste" : ""),
          '<div class="result-head"><b>' + t.e + " " + t.label + "</b>" + verdict + "</div>" +
          (r.num ? '<p class="num">' + fmt(r.num.v) + " " + r.num.unit + "</p>" + rangeBar(r.num) : "") +
          (r.pic ? '<span class="pic" aria-hidden="true">' + r.pic + "</span>" : "") +
          (r.t ? "<p>" + r.t + "</p>" : ""));
        results.prepend(item);
        progress("Checks done: " + used);
        go.disabled = false;
      });
      tools.appendChild(b);
    });
    B.appendChild(el("p", "step", "<b>1.</b> Pick your checks. Only the ones that fit!"));
    B.appendChild(tools);
    B.appendChild(results);
    const go = button("btn go wide", "\u{1F50D} I know what's wrong!", () => {
      go.remove();
      tools.querySelectorAll("button").forEach((x) => { x.disabled = true; });
      B.appendChild(el("p", "step", "<b>2.</b> Diagnose, treat, and send them home."));
      ask(B, cfg.dx, "\u{1F50D}", () =>
        ask(B, cfg.tx, "\u{1F489}", () =>
          ask(B, cfg.care, "\u{1F3E0}", () => finish(wasted), "Finish &rsaquo;")));
    });
    go.disabled = true;
    B.appendChild(go);
  }

  function finish(wasted) {
    const d = done;
    done = null;
    if (d) d(mistakes, wasted || 0);
  }

  // onDone(mistakes, wastedChecks) fires once, when the level is complete.
  function start(cfg, onDone, onSound) {
    stopBeat();
    mistakes = 0;
    done = onDone;
    sound = onSound;
    box().innerHTML = "";
    ({ heart: heartGame, temp: tempGame, case: caseGame })[cfg.kind](cfg);
  }

  return { start, stop: stopBeat };
})();
