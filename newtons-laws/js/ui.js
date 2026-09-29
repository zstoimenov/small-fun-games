/* Newton's Playground - builds the DOM bits: chapter cards, level tiles, the  */
/* controls under the play area, and the quiz. No game rules live here: every */
/* button just calls back into app.js.                                         */
"use strict";
window.NL = window.NL || {};

NL.UI = (function () {
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
  const starRow = (n, of) => "★".repeat(n) + "<span class=\"dim\">" + "★".repeat((of || 3) - n) + "</span>";

  let toastTimer = 0;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ── Home ───────────────────────────────────────────────────────────────────
  function home(starsOf, quizBest, open) {
    const box = $("chapters");
    box.innerHTML = "";
    NL.CHAPTERS.forEach((ch) => {
      const got = ch.levels.reduce((n, _, i) => n + starsOf(ch.id, i), 0);
      const max = ch.levels.length * 3;
      const b = button("chapter-card", "", () => open(ch.id));
      b.style.setProperty("--law", ch.color);
      b.innerHTML =
        '<span class="cc-emoji" aria-hidden="true">' + ch.emoji + "</span>" +
        '<span class="cc-text"><span class="kicker">' + ch.kicker + "</span>" +
        "<b>" + ch.name + "</b><small>" + ch.says + "</small></span>" +
        '<span class="cc-stars" aria-label="' + got + " of " + max + ' stars">★ ' + got + "/" + max + "</span>";
      box.appendChild(b);
    });
    $("quizInfo").textContent = quizBest == null ? "3 quick questions"
      : quizBest === 3 ? "Best: 3 of 3 \u{1F3C5} Newton Expert!" : "Best: " + quizBest + " of 3";
  }

  // ── Chapter ────────────────────────────────────────────────────────────────
  function chapter(ch, starsOf, unlocked, play) {
    $("lawEmoji").textContent = ch.emoji;
    $("lawKicker").textContent = ch.kicker;
    $("lawName").textContent = ch.name;
    $("lawSays").textContent = ch.says;
    $("lawMore").innerHTML = "<ul>" + ch.more.map((m) => "<li>" + m + "</li>").join("") + "</ul>";
    $("lawGrown").textContent = ch.grown;
    document.querySelector(".law-card").style.setProperty("--law", ch.color);
    $("sandBtn").style.setProperty("--law", ch.color);
    const box = $("levels");
    box.innerHTML = "";
    ch.levels.forEach((lv, i) => {
      const open = unlocked(ch.id, i);
      const n = starsOf(ch.id, i);
      const b = button("level-tile" + (open ? "" : " locked"), "", () => {
        if (open) play(i); else toast("Finish level " + i + " first!");
      });
      b.style.setProperty("--law", ch.color);
      b.innerHTML = '<span class="lt-num">' + (open ? i + 1 : "\u{1F512}") + "</span>" +
        '<span class="lt-name">' + lv.name + "</span>" +
        '<span class="lt-stars">' + starRow(n) + "</span>";
      b.setAttribute("aria-label", "Level " + (i + 1) + ": " + lv.name + (open ? ", " + n + " stars" : ", locked"));
      box.appendChild(b);
    });
  }

  // ── Controls under the play area ───────────────────────────────────────────
  // Rebuilt whenever the scene changes state, so counts and disabled buttons
  // are always right without each button having to track the scene itself.
  function seg(label, options, current, onPick, disabled) {
    const wrap = el("div", "row-set");
    wrap.appendChild(el("span", "row-label", label));
    const g = el("div", "seg");
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", label);
    options.forEach((o) => {
      const b = button(o.v === current ? "on" : "", o.html, () => onPick(o.v));
      b.setAttribute("aria-pressed", o.v === current ? "true" : "false");
      b.disabled = !!disabled;
      if (o.aria) b.setAttribute("aria-label", o.aria);
      g.appendChild(b);
    });
    wrap.appendChild(g);
    return wrap;
  }

  function controls(s, act) {
    const box = $("controls");
    box.innerHTML = "";
    const cfg = s.cfg;
    const busy = s.moving;
    const row = () => box.appendChild(el("div", "actions"));

    if (s.kind === "flick") {
      if (cfg.sandbox) {
        box.appendChild(seg("Ground", cfg.surfaces.map((t) => ({ v: t, html: NL.Physics.SURF[t].emoji + " " + NL.Physics.SURF[t].label })),
          s.surface, (v) => act("surface", v)));
      }
      box.appendChild(el("p", "hint", "\u{1F449} Put your finger on the play area, <b>pull it away</b> (any way you like), then let go. A longer pull is a bigger flick."));
      if (cfg.sandbox) row().appendChild(button("btn ghost", "↺ Reset", () => act("reset")));
      return;
    }

    if (s.kind === "cart" || s.kind === "match") {
      const picks = cfg.pick || [];
      if (picks.indexOf("load") >= 0) {
        box.appendChild(seg("Load", Object.keys(NL.LOADS).map((k) => ({ v: k, html: NL.LOADS[k].emoji + " " + NL.LOADS[k].label })),
          s.choice.load, (v) => act("load", v), busy));
      }
      if (cfg.weigh) {
        const w = el("p", "weigh", cfg.weigh);
        w.setAttribute("role", "img");
        w.setAttribute("aria-label", cfg.weighSays);
        box.appendChild(w);
      }
      if (picks.indexOf("push") >= 0) {
        box.appendChild(seg("Push", [1, 2, 3, 4, 5].map((n) => ({ v: n, html: "\u{270B} " + n, aria: n + (n === 1 ? " hand" : " hands") })),
          s.choice.push, (v) => act("push", v), busy));
      }
      const go = button("btn go", "Push! \u{1F4A8}", () => act("go"));
      go.disabled = busy || !s.ready();
      row().appendChild(go);
      return;
    }

    if (s.kind === "race" || s.kind === "pushoff") {
      box.appendChild(el("p", "question", cfg.question));
      const a = el("div", "answers");
      cfg.answers.forEach((ans) => {
        const b = button("answer", '<span aria-hidden="true">' + ans.emoji + "</span> " + ans.text, () => act("guess", ans.id));
        b.disabled = busy;
        if (s.guess === ans.id) b.classList.add("picked");
        a.appendChild(b);
      });
      box.appendChild(a);
      return;
    }

    if (s.kind === "skate") {
      const r = row();
      Object.keys(NL.BALLS).forEach((k) => {
        const n = s.left(k);
        if (!cfg.sandbox && n === 0 && (!cfg.balls || cfg.balls.indexOf(k) < 0)) return;
        const ball = NL.BALLS[k];
        const b = button("btn throw", "Throw " + ball.emoji + (n === Infinity ? "" : " <small>×" + n + "</small>"), () => act("throw", k));
        b.disabled = n === 0 && !s.over;
        b.setAttribute("aria-label", "Throw " + ball.label + (n === Infinity ? "" : ", " + n + " left"));
        r.appendChild(b);
      });
      r.appendChild(button("btn ghost", "↺ Start again", () => act("reset")));
      return;
    }

    if (s.kind === "balloon") {
      const r = row();
      const blow = button("btn", "\u{1F4A8} Blow <small>" + s.puffs + "/" + NL.Scenes.MAX_PUFFS + "</small>", () => act("blow"));
      blow.disabled = busy;
      const go = button("btn go", "Let go! \u{1F388}", () => act("letgo"));
      go.disabled = busy || !s.puffs || s.over;
      r.appendChild(blow);
      r.appendChild(go);
    }
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────
  function question(i, total, item, onAnswer) {
    $("qCount").textContent = "Question " + (i + 1) + " of " + total;
    $("qEmoji").textContent = item.emoji;
    $("qText").textContent = item.q;
    $("qWhy").textContent = "";
    $("qNext").hidden = true;
    const box = $("qAnswers");
    box.innerHTML = "";
    // Answers are stored right-first; shuffle so the right one isn't always on top.
    const order = item.a.map((_, k) => k).sort(() => Math.random() - 0.5);
    order.forEach((k) => {
      const b = button("answer", item.a[k], () => {
        box.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        const ok = k === item.right;
        b.classList.add(ok ? "right" : "wrong");
        if (!ok) box.querySelectorAll("button")[order.indexOf(item.right)].classList.add("right");
        $("qWhy").textContent = (ok ? "Yes! " : "Not quite. ") + item.why;
        $("qNext").hidden = false;
        onAnswer(ok);
      });
      box.appendChild(b);
    });
  }

  function quizDone(score, total, again, home) {
    $("qCount").textContent = "All done!";
    $("qEmoji").textContent = score === total ? "\u{1F3C5}" : score ? "\u{1F31F}" : "\u{1F4AA}";
    $("qText").textContent = "You got " + score + " of " + total + "!";
    $("qWhy").textContent = score === total ? "Newton Expert! Isaac would be proud." : "Have another go, or play the levels again to see the laws in action.";
    $("qNext").hidden = true;
    const box = $("qAnswers");
    box.innerHTML = "";
    const r = el("div", "actions");
    r.appendChild(button("btn ghost", "Try again", again));
    r.appendChild(button("btn", "Home", home));
    box.appendChild(r);
  }

  return { $, toast, home, chapter, controls, question, quizDone, starRow };
})();
