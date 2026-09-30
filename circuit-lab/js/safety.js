/* Circuit Lab - the Stay Safe chapter. These levels aren't circuits: they're */
/* spot-the-danger rooms, safe-or-danger cards and "what would you do?"       */
/* scenes. Each one counts wrong taps and hands the total back to app.js,     */
/* which turns it into stars the same way a circuit level's moves do.         */
/*                                                                             */
/* Every answer, right or wrong, shows WHY. The reason is the lesson; a       */
/* bare tick or cross would teach a kid to guess.                             */
"use strict";
window.CL = window.CL || {};

CL.Safety = (function () {
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

  let wrong = 0;
  let done = null;
  let sound = null;

  function progress(text) { $("safetyProgress").textContent = text; }
  function why(ok, text) {
    const w = $("safetyWhy");
    w.className = "safety-why " + (ok ? "good" : "bad");
    w.textContent = text;
  }

  // ── Spot the danger: tap every hazard in a room of 9 ───────────────────────
  function spot(cfg) {
    const box = $("safetyBox");
    const grid = el("div", "spot-grid");
    const need = cfg.tiles.filter((t) => t.d).length;
    let found = 0;
    progress("Dangers found: 0 of " + need);
    // Shuffled, so a replay isn't just "tap the first four".
    cfg.tiles.slice().sort(() => Math.random() - 0.5).forEach((t) => {
      const b = button("spot", '<span class="spot-e" aria-hidden="true">' + t.e + '</span><span class="spot-t">' + t.t + "</span>", () => {
        if (b.classList.contains("found") || b.classList.contains("fine")) { why(!!t.d, t.why); return; }
        if (t.d) {
          b.classList.add("found");
          b.insertAdjacentHTML("beforeend", '<span class="spot-badge" aria-hidden="true">\u{26A0}\u{FE0F}</span>');
          found++;
          sound("danger");
          why(true, "\u{26A0}\u{FE0F} Danger! " + t.why);
          progress("Dangers found: " + found + " of " + need);
          if (found === need) finish();
        } else {
          b.classList.add("fine");
          b.insertAdjacentHTML("beforeend", '<span class="spot-badge" aria-hidden="true">\u{2705}</span>');
          wrong++;
          sound("fine");
          why(false, "\u{2705} That one's safe. " + t.why);
        }
      });
      b.setAttribute("aria-label", t.t);
      grid.appendChild(b);
    });
    box.appendChild(grid);
  }

  // ── Safe or danger: one card at a time ─────────────────────────────────────
  function sort(cfg) {
    const box = $("safetyBox");
    const cards = cfg.cards.slice().sort(() => Math.random() - 0.5);
    let i = 0;
    const card = el("div", "card sort-card");
    box.appendChild(card);
    function show() {
      progress("Card " + (i + 1) + " of " + cards.length);
      $("safetyWhy").className = "safety-why";
      $("safetyWhy").textContent = "";
      const c = cards[i];
      card.innerHTML = "";
      card.appendChild(el("span", "sort-e", c.e)).setAttribute("aria-hidden", "true");
      card.appendChild(el("h2", "", c.t));
      const row = el("div", "sort-btns");
      const pick = (saidDanger) => {
        row.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        const ok = saidDanger === !!c.d;
        if (!ok) wrong++;
        sound(ok ? "right" : "wrong");
        why(ok, (ok ? "Yes! " : "Not quite. ") + (c.d ? "\u{26A0}\u{FE0F} Danger. " : "\u{2705} Safe. ") + c.why);
        const next = button("btn", i < cards.length - 1 ? "Next card &rsaquo;" : "Finish &rsaquo;", () => {
          i++;
          if (i < cards.length) show(); else finish();
        });
        card.appendChild(el("div", "actions")).appendChild(next);
        next.focus();
      };
      row.appendChild(button("btn sort-safe", "\u{2705} Safe", () => pick(false)));
      row.appendChild(button("btn sort-danger", "\u{26A0}\u{FE0F} Danger", () => pick(true)));
      card.appendChild(row);
    }
    show();
  }

  // ── What would you do: pick the safest action ──────────────────────────────
  function choose(cfg) {
    const box = $("safetyBox");
    let i = 0;
    const card = el("div", "card quiz-card");
    box.appendChild(card);
    function show() {
      progress("Question " + (i + 1) + " of " + cfg.qs.length);
      $("safetyWhy").className = "safety-why";
      $("safetyWhy").textContent = "";
      const q = cfg.qs[i];
      card.innerHTML = "";
      card.appendChild(el("span", "q-emoji", q.e)).setAttribute("aria-hidden", "true");
      card.appendChild(el("h2", "", q.q));
      const answers = el("div", "answers");
      const order = q.a.map((_, k) => k).sort(() => Math.random() - 0.5);
      order.forEach((k) => {
        const b = button("answer", q.a[k], () => {
          answers.querySelectorAll("button").forEach((x) => { x.disabled = true; });
          const ok = k === q.right;
          if (!ok) wrong++;
          b.classList.add(ok ? "right" : "wrong");
          if (!ok) answers.querySelectorAll("button")[order.indexOf(q.right)].classList.add("right");
          sound(ok ? "right" : "wrong");
          why(ok, (ok ? "Yes! " : "Not quite. ") + q.why);
          const next = button("btn", i < cfg.qs.length - 1 ? "Next &rsaquo;" : "Finish &rsaquo;", () => {
            i++;
            if (i < cfg.qs.length) show(); else finish();
          });
          card.appendChild(el("div", "actions")).appendChild(next);
          next.focus();
        });
        answers.appendChild(b);
      });
      card.appendChild(answers);
    }
    show();
  }

  function finish() {
    const d = done;
    done = null;
    if (d) d(wrong);
  }

  // onDone(wrongCount) fires once, when the level is complete.
  function start(cfg, onDone, onSound) {
    wrong = 0;
    done = onDone;
    sound = onSound;
    $("safetyBox").innerHTML = "";
    $("safetyWhy").className = "safety-why";
    $("safetyWhy").textContent = "";
    ({ spot, sort, choose })[cfg.kind](cfg);
  }

  return { start };
})();
