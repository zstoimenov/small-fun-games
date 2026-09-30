/* Vet Clinic - app state: which screen, which level, stars, and the quiz.     */
"use strict";
window.VC = window.VC || {};

(function () {
  const { $ } = VC.UI;
  const KEY = "vet-clinic";

  // ── Saved progress ─────────────────────────────────────────────────────────
  const store = { stars: {}, quiz: null, muted: false, seenHelp: false };
  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode or junk */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } report(); };
  const starsOf = (ch, i) => store.stars[ch + "-" + i] || 0;
  const unlocked = (ch, i) => i === 0 || starsOf(ch, i - 1) > 0;
  // Tell the Game Box home page how far you've got, for its stars badge and
  // "Keep playing" row. Opening the game counts as playing it.
  function report() {
    let got = 0, max = 0;
    VC.CHAPTERS.forEach((c) => c.levels.forEach((_, i) => { got += starsOf(c.id, i); max += 3; }));
    try { localStorage.setItem("gamebox:progress:vet-clinic", JSON.stringify({ stars: got, max, at: Date.now() })); } catch (e) { /* ignore */ }
  }
  const chapterById = (id) => VC.CHAPTERS.find((c) => c.id === id);

  let screen = "home";
  let ch = null, lvl = 0, cfg = null;
  let quiz = null;

  function show(name) {
    screen = name;
    ["home", "chapter", "play", "quiz"].forEach((s) => { $(s).hidden = s !== name; });
    $("back").hidden = name !== "home";
    $("up").hidden = name === "home";
    $("up").innerHTML = "&lsaquo; " + (name === "play" && ch ? ch.kicker : "Home");
    $("title").textContent = name === "home" ? "Vet Clinic"
      : name === "quiz" ? "Vet Quiz"
      : name === "chapter" ? ch.name : "Level " + (lvl + 1);
    window.scrollTo(0, 0);
    if (name !== "play") VC.Clinic.stop();
  }

  function goHome() {
    ch = null;
    VC.UI.home(starsOf, store.quiz, openChapter);
    show("home");
  }
  function openChapter(id) {
    ch = chapterById(id);
    VC.UI.chapter(ch, starsOf, unlocked, (i) => play(i));
    show("chapter");
  }

  // ── A level ────────────────────────────────────────────────────────────────
  function play(i) {
    lvl = i;
    cfg = ch.levels[i];
    $("goalName").textContent = "Level " + (i + 1) + ": " + cfg.name;
    $("goalText").textContent = cfg.text || "Listen to the owner, then pick your checks.";
    show("play");
    VC.Clinic.start(cfg, finish, (name) => {
      VC.Audio.ready();
      const f = VC.Audio[name];
      if (f) f();
    });
  }

  function finish(mistakes, wasted) {
    const got = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    const k = ch.id + "-" + lvl;
    store.stars[k] = Math.max(got, store.stars[k] || 0);
    save();
    VC.Audio.win();
    $("winStars").innerHTML = VC.UI.starRow(got);
    [0, 1, 2].forEach((i) => { if (i < got) setTimeout(() => VC.Audio.star(i), 150 + i * 180); });
    $("winTitle").textContent = got === 3 ? "Brilliant!" : got === 2 ? "Well done!" : "You did it!";
    $("winText").textContent = cfg.win + (wasted ? " (You did " + wasted + " check" + (wasted > 1 ? "s" : "") + " you didn't need. Good vets only do the ones that fit.)"
      : got < 3 ? " (Can you get it all right first time?)" : "");
    const last = lvl === ch.levels.length - 1;
    $("winNext").innerHTML = last ? "What I learned &rsaquo;" : "Next patient &rsaquo;";
    $("winDialog").showModal();
  }

  $("winAgain").addEventListener("click", () => { $("winDialog").close(); play(lvl); });
  $("winNext").addEventListener("click", () => {
    $("winDialog").close();
    if (lvl < ch.levels.length - 1) { play(lvl + 1); return; }
    $("lessonEmoji").textContent = ch.emoji;
    $("lessonTitle").textContent = ch.lesson.title;
    $("lessonSays").textContent = ch.says;
    $("lessonLife").textContent = ch.lesson.life;
    $("lessonJob").textContent = ch.lesson.job;
    $("lessonDialog").showModal();
  });
  $("lessonOk").addEventListener("click", () => { $("lessonDialog").close(); goHome(); });
  $("up").addEventListener("click", () => {
    if (screen === "play" && ch) openChapter(ch.id);
    else goHome();
  });
  $("chartBtn").addEventListener("click", () => { VC.UI.chart(); $("chartDialog").showModal(); });
  $("jobsBtn").addEventListener("click", () => $("jobsDialog").showModal());
  document.addEventListener("visibilitychange", () => { if (document.hidden) VC.Clinic.stop(); });

  // ── Quiz ───────────────────────────────────────────────────────────────────
  function startQuiz() {
    quiz = { items: VC.QUIZ.map((pool) => pool[Math.floor(Math.random() * pool.length)]), i: 0, score: 0 };
    show("quiz");
    ask();
  }
  function ask() {
    VC.UI.question(quiz.i, quiz.items.length, quiz.items[quiz.i], (ok) => {
      if (ok) { quiz.score++; VC.Audio.right(); } else VC.Audio.wrong();
    });
  }
  $("qNext").addEventListener("click", () => {
    quiz.i++;
    if (quiz.i < quiz.items.length) { ask(); return; }
    store.quiz = Math.max(store.quiz || 0, quiz.score);
    save();
    if (quiz.score === quiz.items.length) VC.Audio.win();
    VC.UI.quizDone(quiz.score, quiz.items.length, startQuiz, goHome);
  });
  $("quizBtn").addEventListener("click", startQuiz);

  // ── Header buttons and dialogs ─────────────────────────────────────────────
  function paintMute() {
    const m = VC.Audio.isMuted();
    $("mute").innerHTML = m ? "&#128263;" : "&#128266;";
    $("mute").setAttribute("aria-pressed", m ? "true" : "false");
    $("mute").setAttribute("aria-label", m ? "Sound off" : "Sound on");
  }
  VC.Audio.setMuted(store.muted);
  paintMute();
  $("mute").addEventListener("click", () => {
    VC.Audio.setMuted(!VC.Audio.isMuted());
    store.muted = VC.Audio.isMuted();
    save();
    paintMute();
    VC.Audio.click();
  });
  $("help").addEventListener("click", () => $("helpDialog").showModal());
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close()));

  report();
  goHome();
  if (!store.seenHelp) {
    store.seenHelp = true;
    save();
    $("helpDialog").showModal();
  }
})();
