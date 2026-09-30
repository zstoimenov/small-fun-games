/* Bridge Builder - builds the DOM bits: chapter cards, jobs, level tiles,    */
/* the parts box and Test button under the river, and the quiz. No game rules */
/* live here: every button just calls back into app.js.                       */
"use strict";
window.BB = window.BB || {};

BB.UI = (function () {
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
    BB.CHAPTERS.forEach((ch) => {
      const got = ch.levels.reduce((n, _, i) => n + starsOf(ch.id, i), 0);
      const max = ch.levels.length * 3;
      const b = button("chapter-card", "", () => open(ch.id));
      b.style.setProperty("--law", ch.color);
      b.innerHTML =
        '<span class="cc-emoji" aria-hidden="true">' + ch.emoji + "</span>" +
        '<span class="cc-text"><span class="kicker">' + ch.kicker + "</span>" +
        "<b>" + ch.name + "</b></span>" +
        '<span class="cc-stars" aria-label="' + got + " of " + max + ' stars">★ ' + got + "/" + max + "</span>";
      box.appendChild(b);
    });
    const n = BB.QUIZ.length;
    $("quizInfo").textContent = quizBest == null ? n + " questions"
      : quizBest === n ? "Best " + n + "/" + n + " \u{1F3C5}" : "Best " + quizBest + "/" + n;
    const jobs = $("jobs");
    jobs.innerHTML = "";
    BB.JOBS.forEach((j) => {
      jobs.appendChild(el("div", "job", '<span class="job-emoji" aria-hidden="true">' + j.emoji + "</span>" +
        "<span><b>" + j.name + "</b><small>" + j.does + "</small></span>"));
    });
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

  // ── Under the river: parts box, Test, and (free build) the truck ─────────
  // st: { inv, tool, used, par, testing, done, free, truck }
  function controls(st, act) {
    const box = $("controls");
    box.innerHTML = "";
    const M = BB.Physics.MAT;
    if (st.testing) {
      box.appendChild(el("p", "legend", '<span class="sw ok"></span> easy <span class="sw warn"></span> working hard <span class="sw bad"></span> about to break'));
      const row = el("div", "actions");
      row.appendChild(button("btn ghost", st.done ? "\u{1F527} Fix my bridge" : "\u{23F9}\u{FE0F} Stop", () => act("stop")));
      box.appendChild(row);
      return;
    }
    const grid = el("div", "parts");
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Parts box");
    Object.keys(st.inv).forEach((t) => {
      const n = st.inv[t];
      const b = button("part" + (st.tool === t ? " on" : "") + (n === 0 ? " out" : ""),
        '<span class="pe ' + t + '" aria-hidden="true"></span>' + M[t].label +
        (n === Infinity ? "" : '<span class="n">' + n + "</span>"), () => act("tool", t));
      b.setAttribute("aria-pressed", st.tool === t ? "true" : "false");
      b.setAttribute("aria-label", M[t].label + (n === Infinity ? "" : ", " + n + " left"));
      grid.appendChild(b);
    });
    const rm = button("part" + (st.tool === "remove" ? " on" : ""),
      '<span class="pe-e" aria-hidden="true">\u{1F9FD}</span>Remove', () => act("tool", "remove"));
    rm.setAttribute("aria-pressed", st.tool === "remove" ? "true" : "false");
    rm.setAttribute("aria-label", "Remove");
    grid.appendChild(rm);
    box.appendChild(grid);

    if (st.free) {
      const T = BB.Physics.TRUCKS;
      const g = el("div", "row-set");
      g.appendChild(el("span", "row-label", "Drive:"));
      const seg = el("div", "seg");
      Object.keys(T).forEach((k) => {
        const b = button(st.truck === k ? "on" : "", T[k].emoji + " " + T[k].label, () => act("truck", k));
        b.setAttribute("aria-pressed", st.truck === k ? "true" : "false");
        seg.appendChild(b);
      });
      g.appendChild(seg);
      box.appendChild(g);
    }

    const row = el("div", "actions");
    row.appendChild(button("btn ghost", st.free ? "\u{1F5D1}\u{FE0F} Clear" : "\u{21BA} Start again", () => act("reset")));
    row.appendChild(button("btn go", "\u{25B6}\u{FE0F} Test it!", () => act("test")));
    box.appendChild(row);
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
    $("qWhy").textContent = score === total ? "Bridge Expert! You think like a real engineer." : "Have another go, or build some more bridges and watch what bends.";
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
