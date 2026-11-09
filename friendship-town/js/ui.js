/* Friendship Town - drawing helpers and the menu screens.                    */
/* The play screen's four parts are filled through FT.UI.P, so every kind of   */
/* lesson (a scene or a mini-game) draws into the same spots.                  */
"use strict";
window.FT = window.FT || {};

FT.UI = (function () {
  const $ = (id) => document.getElementById(id);
  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  // Text from lessons.js goes through this before it meets innerHTML.
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const starText = (n, max) => "★".repeat(n) + "☆".repeat((max || 3) - n);

  // ── The play screen's parts ────────────────────────────────────────────────
  const P = {
    board() { const b = $("board"); b.innerHTML = ""; b.className = "play-board"; return b; },
    goal(name, text) { $("goalName").textContent = name; $("goalText").textContent = text || ""; },
    // Friendship hearts: filled, then empty, so the row never changes width.
    hearts(n, max) {
      const e = $("hearts");
      if (max == null) { e.hidden = true; return; }
      e.hidden = false;
      e.innerHTML = "";
      for (let i = 0; i < max; i++) e.appendChild(h("span", i < n ? "on" : "off", i < n ? "❤️" : "🤍"));
      e.setAttribute("aria-label", "Friendship " + n + " of " + max);
    },
    // The talk panel: a verdict or a hint. kind colours it (great/ok/oops).
    talk(html, kind) { const t = $("talk"); t.innerHTML = html; t.className = "talk card" + (kind ? " " + kind : ""); },
    // Before a pick, the button spot holds a greyed-out hint, so there is
    // always something at the bottom saying what to do next, and the
    // layout doesn't jump when the real button arrives.
    wait(label) {
      const a = $("acts");
      a.innerHTML = "";
      const b = h("button", "btn wait", label);
      b.type = "button";
      b.disabled = true;
      a.appendChild(b);
    },
    acts(list) {
      const a = $("acts");
      a.innerHTML = "";
      (list || []).forEach((x) => {
        const b = h("button", "btn " + (x.kind || "go"), x.label);
        b.type = "button";
        if (x.id) b.id = x.id;
        b.addEventListener("click", () => { FT.Audio.click(); x.go(); });
        a.appendChild(b);
      });
    }
  };

  // A character on the stage: a big face, a mood badge, a speech bubble.
  function stage(where, who) {
    const s = h("div", "stage");
    s.innerHTML = '<span class="backdrop" aria-hidden="true">' + (where || "") + "</span>" +
      '<div class="person"><span class="face" aria-hidden="true">' + (who ? who.emoji : "") + '</span><span class="mood" aria-hidden="true"></span>' +
      '<b class="who">' + (who ? esc(who.name) : "") + "</b></div>" +
      '<div class="bubble"><p></p></div>';
    return {
      el: s,
      say(text, mood) {
        // "Max: “Hi!”" is Max talking; a line without a speaker is the
        // story's narrator, shown in italics so it doesn't sound like Max.
        const p = s.querySelector(".bubble p");
        const m = /^([^:“”]{1,16}):\s*/.exec(text);
        p.textContent = m ? text.slice(m[0].length) : text;
        p.classList.toggle("narrate", !!text && !m && !/^“/.test(text));
        s.querySelector(".bubble").classList.remove("pop");
        void s.offsetWidth;
        s.querySelector(".bubble").classList.add("pop");
        this.mood(mood);
      },
      mood(m) {
        const e = s.querySelector(".mood");
        e.textContent = { great: "😄", ok: "😐", oops: "😟", think: "💭" }[m] || "";
        s.dataset.mood = m || "";
      },
      who(w) { s.querySelector(".face").textContent = w.emoji; s.querySelector(".who").textContent = w.name; }
    };
  }

  // ── Menus ──────────────────────────────────────────────────────────────────
  function home(starsOf, onChapter) {
    const box = $("chapters");
    box.innerHTML = "";
    FT.CHAPTERS.forEach((c) => {
      const got = c.lessons.reduce((s, l) => s + starsOf(l.id), 0);
      const b = h("button", "chapter-card");
      b.type = "button";
      b.style.setProperty("--law", c.color);
      b.innerHTML = '<span class="cc-emoji" aria-hidden="true">' + c.emoji + "</span>" +
        '<span class="cc-text"><small class="cc-place">' + esc(c.kicker) + " · " + esc(c.place) + "</small><b>" + esc(c.name) + "</b>" +
        '<span class="cc-stars">★ ' + got + "/" + c.lessons.length * 3 + "</span></span>";
      b.addEventListener("click", () => { FT.Audio.click(); onChapter(c.id); });
      box.appendChild(b);
    });
    const n = FT.allLessons().filter((l) => starsOf(l.id) > 0).length;
    $("bookTile").textContent = n + " of 30 stickers";
  }

  function chapter(c, starsOf, unlocked, onLesson) {
    $("chapter").style.setProperty("--law", c.color);
    $("lawEmoji").textContent = c.emoji;
    $("lawKicker").textContent = c.kicker + " · " + c.place;
    $("lawName").textContent = c.name;
    $("lawSays").textContent = c.says;
    $("lawGrown").textContent = c.grown;
    const box = $("levels");
    box.innerHTML = "";
    c.lessons.forEach((l, i) => {
      const open = unlocked(c, i), st = starsOf(l.id);
      const b = h("button", "level-tile" + (open ? "" : " locked"));
      b.type = "button";
      b.disabled = !open;
      b.innerHTML = '<span class="lt-num" aria-hidden="true">' + (open ? l.emoji : "🔒") + "</span>" +
        '<span class="lt-name">' + (i + 1) + ". " + esc(l.name) + "</span>" +
        '<span class="lt-stars">' + (st ? starText(st) : open ? (l.type === "scene" ? "New" : "🎮 Game") : "") + "</span>";
      b.addEventListener("click", () => { FT.Audio.click(); onLesson(i); });
      box.appendChild(b);
    });
  }

  function book(starsOf) {
    const box = $("stickers");
    box.innerHTML = "";
    let n = 0;
    FT.CHAPTERS.forEach((c) => {
      box.appendChild(h("h3", "book-head", c.emoji + " " + esc(c.place)));
      c.lessons.forEach((l) => {
        const st = starsOf(l.id);
        if (st) n++;
        const s = h("div", "sticker" + (st ? "" : " empty"));
        s.style.setProperty("--law", c.color);
        s.innerHTML = st
          ? '<span class="st-e" aria-hidden="true">' + l.emoji + '</span><b>' + esc(l.tip) + '</b><small>' + starText(st) + "</small>"
          : '<span class="st-e" aria-hidden="true">❔</span><b>' + esc(l.name) + "</b><small>Play to win it</small>";
        box.appendChild(s);
      });
    });
    $("bookInfo").textContent = n === 30 ? "All 30 stickers! You're a friendship expert." : "You have " + n + " of 30 stickers. Each one is a friendly idea to try.";
  }

  function grown() {
    const box = $("ideas");
    if (box.childElementCount) return;
    let k = 0;
    FT.CHAPTERS.forEach((c) => {
      const card = h("div", "card idea-card");
      card.style.setProperty("--law", c.color);
      card.innerHTML = '<p class="kicker">' + esc(c.kicker) + " · " + esc(c.place) + "</p><h2>" + c.emoji + " " + esc(c.name) + "</h2><p>" + esc(c.grown) + "</p>";
      const ol = h("ol", "idea-list");
      ol.start = k + 1;
      c.lessons.forEach((l) => {
        k++;
        ol.appendChild(h("li", "", "<b>" + esc(l.grown) + "</b><br><span>" + l.emoji + " " + esc(l.tip) + "</span>"));
      });
      card.appendChild(ol);
      box.appendChild(card);
    });
  }

  function win(stars, lesson, text, hasNext) {
    $("winStars").textContent = starText(stars);
    $("winTitle").textContent = stars === 3 ? "Super friend!" : stars === 2 ? "Nice one!" : "You did it!";
    $("winSticker").innerHTML = '<span class="st-e" aria-hidden="true">' + lesson.emoji + "</span><b>" + esc(lesson.tip) + "</b>";
    $("winText").textContent = text;
    $("winNext").innerHTML = hasNext ? "Next &rsaquo;" : "Done &rsaquo;";
    $("winDialog").showModal();
    for (let i = 0; i < stars; i++) setTimeout(() => FT.Audio.star(i), 300 + i * 220);
  }

  return { $, h, esc, shuffle, starText, P, stage, home, chapter, book, grown, win };
})();
