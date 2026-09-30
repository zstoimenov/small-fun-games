/* Music Studio - builds the DOM bits: chapter cards, jobs, level tiles and   */
/* the quiz. No game rules live here: every button just calls back into       */
/* app.js.                                                                     */
"use strict";
window.MS = window.MS || {};

MS.UI = (function () {
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
    MS.CHAPTERS.forEach((ch) => {
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
    const n = MS.QUIZ.length;
    $("quizInfo").textContent = quizBest == null ? n + " questions"
      : quizBest === n ? "Best " + n + "/" + n + " \u{1F3C5}" : "Best " + quizBest + "/" + n;
    const jobs = $("jobs");
    jobs.innerHTML = "";
    MS.JOBS.forEach((j) => {
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
    $("qWhy").textContent = score === total ? "Music Expert! Time to write a hit. 🎶" : "Have another go, or play some more levels first.";
    $("qNext").hidden = true;
    const box = $("qAnswers");
    box.innerHTML = "";
    const r = el("div", "actions");
    r.appendChild(button("btn ghost", "Try again", again));
    r.appendChild(button("btn", "Home", home));
    box.appendChild(r);
  }

  return { $, toast, home, chapter, question, quizDone, starRow };
})();
