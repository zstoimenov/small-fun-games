/* Little City - app state: which screen, which level, stars, the quiz.        */
"use strict";
window.LC = window.LC || {};

(function () {
  const { $ } = LC.UI;
  const KEY = "little-city";

  // ── Saved progress ─────────────────────────────────────────────────────────
  const store = { stars: {}, quiz: null, muted: false, seenHelp: false, towns: [], current: null, medalsEver: [] };
  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode or junk */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } report(); };
  const starsOf = (ch, i) => store.stars[ch + "-" + i] || 0;
  const unlocked = (ch, i) => i === 0 || starsOf(ch, i - 1) > 0;
  // Tell the Game Box home page how far you've got, for its stars badge and
  // "Keep playing" row. Opening the game counts as playing it.
  function report() {
    let got = 0, max = 0;
    LC.CHAPTERS.forEach((c) => c.levels.forEach((_, i) => { got += starsOf(c.id, i); max += 3; }));
    try { localStorage.setItem("gamebox:progress:little-city", JSON.stringify({ stars: got, max, at: Date.now() })); } catch (e) { /* ignore */ }
  }
  const chapterById = (id) => LC.CHAPTERS.find((c) => c.id === id);
  LC.Studio.init(store, save, LC.UI.toast, { go: () => openStudio() });

  let screen = "home", back = "home";
  let ch = null, lvl = 0, cfg = null;
  let quiz = null;

  const TITLES = { home: "Little City", studio: "Be the Mayor", towns: "My towns", quiz: "Town Quiz" };
  function show(name) {
    screen = name;
    ["home", "chapter", "play", "studio", "towns", "quiz"].forEach((s) => { $(s).hidden = s !== name; });
    // Every screen fills the window exactly; only the towns list scrolls,
    // inside itself (see "The frame" in the CSS).
    document.body.classList.add("fit");
    $("back").hidden = name !== "home";
    $("up").hidden = name === "home";
    $("up").innerHTML = "&lsaquo; " + (name === "play" && ch ? ch.kicker : name === "towns" && back === "studio" ? "Mayor" : "Home");
    $("title").textContent = TITLES[name] || (name === "chapter" ? ch.name : "Level " + (lvl + 1));
    window.scrollTo(0, 0);
    if (name !== "play") LC.Lesson.stop();
  }

  function goHome() {
    ch = null;
    LC.UI.home(starsOf, store.quiz, openChapter);
    $("townsTile").textContent = store.towns && store.towns.length ? store.towns.length + " town" + (store.towns.length > 1 ? "s" : "") : "None yet";
    $("mayorTile").textContent = LC.Studio.tile();
    show("home");
  }
  function openChapter(id) {
    ch = chapterById(id);
    LC.UI.chapter(ch, starsOf, unlocked, (i) => play(i));
    show("chapter");
  }
  // With no town yet, Be the Mayor opens the new-town dialog instead.
  function openStudio() { if (!LC.Studio.current()) { LC.Studio.newTown(); return; } show("studio"); LC.Studio.open(); }
  function openTowns(from) { back = from; show("towns"); LC.Studio.gallery(); }

  // ── A level ────────────────────────────────────────────────────────────────
  function play(i) {
    lvl = i;
    cfg = ch.levels[i];
    $("goalName").textContent = "Level " + (i + 1) + ": " + cfg.name;
    $("goalText").textContent = cfg.text;
    show("play");
    LC.Lesson.start(cfg, finish);
  }

  function finish(mistakes) {
    const got = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    const k = ch.id + "-" + lvl;
    store.stars[k] = Math.max(got, store.stars[k] || 0);
    save();
    LC.Audio.win();
    $("winStars").innerHTML = LC.UI.starRow(got);
    [0, 1, 2].forEach((i) => { if (i < got) setTimeout(() => LC.Audio.star(i), 150 + i * 180); });
    $("winTitle").textContent = got === 3 ? "Brilliant!" : got === 2 ? "Well done!" : "You did it!";
    $("winText").textContent = got === 3 ? "Right first time, every time!" : "Can you get it all right first time?";
    const last = lvl === ch.levels.length - 1;
    $("winNext").innerHTML = last ? "What I learned &rsaquo;" : "Next level &rsaquo;";
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
    else if (screen === "towns" && back === "studio") openStudio();
    else goHome();
  });
  $("jobsBtn").addEventListener("click", () => $("jobsDialog").showModal());

  // ── Be the Mayor ───────────────────────────────────────────────────────────
  LC.Studio.wire();
  $("studioBtn").addEventListener("click", openStudio);
  $("townsBtn").addEventListener("click", () => openTowns("home"));
  $("townsStudio").addEventListener("click", () => LC.Studio.newTown());
  $("sName").addEventListener("click", LC.Studio.rename);
  $("mayorTown").addEventListener("click", () => openTowns("studio"));

  // ── Quiz ───────────────────────────────────────────────────────────────────
  function startQuiz() {
    quiz = { items: LC.QUIZ.map((pool) => pool[Math.floor(Math.random() * pool.length)]), i: 0, score: 0 };
    show("quiz");
    ask();
  }
  function ask() {
    LC.UI.question(quiz.i, quiz.items.length, quiz.items[quiz.i], (ok) => {
      if (ok) { quiz.score++; LC.Audio.right(); } else LC.Audio.wrong();
    });
  }
  $("qNext").addEventListener("click", () => {
    quiz.i++;
    if (quiz.i < quiz.items.length) { ask(); return; }
    store.quiz = Math.max(store.quiz || 0, quiz.score);
    save();
    if (quiz.score === quiz.items.length) LC.Audio.win();
    LC.UI.quizDone(quiz.score, quiz.items.length, startQuiz, goHome);
  });
  $("quizBtn").addEventListener("click", startQuiz);

  // ── Header buttons and dialogs ─────────────────────────────────────────────
  function paintMute() {
    const m = LC.Audio.isMuted();
    $("mute").innerHTML = m ? "&#128263;" : "&#128266;";
    $("mute").setAttribute("aria-pressed", m ? "true" : "false");
    $("mute").setAttribute("aria-label", m ? "Sound off" : "Sound on");
  }
  LC.Audio.setMuted(store.muted);
  paintMute();
  $("mute").addEventListener("click", () => {
    LC.Audio.setMuted(!LC.Audio.isMuted());
    store.muted = LC.Audio.isMuted();
    save();
    paintMute();
    LC.Audio.click();
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
