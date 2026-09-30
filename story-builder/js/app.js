/* Story Builder - app state: which screen, which level, stars, the quiz.      */
"use strict";
window.SB = window.SB || {};

(function () {
  const { $ } = SB.UI;
  const KEY = "story-builder";

  // ── Saved progress ─────────────────────────────────────────────────────────
  const store = { stars: {}, quiz: null, muted: false, seenHelp: false, draft: null, gallery: [] };
  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode or junk */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } report(); };
  const starsOf = (ch, i) => store.stars[ch + "-" + i] || 0;
  const unlocked = (ch, i) => i === 0 || starsOf(ch, i - 1) > 0;
  // Tell the Game Box home page how far you've got, for its stars badge and
  // "Keep playing" row. Opening the game counts as playing it.
  function report() {
    let got = 0, max = 0;
    SB.CHAPTERS.forEach((c) => c.levels.forEach((_, i) => { got += starsOf(c.id, i); max += 3; }));
    try { localStorage.setItem("gamebox:progress:story-builder", JSON.stringify({ stars: got, max, at: Date.now() })); } catch (e) { /* ignore */ }
  }
  const chapterById = (id) => SB.CHAPTERS.find((c) => c.id === id);
  SB.Studio.init(store, save, SB.UI.toast);

  let screen = "home", back = "home";
  let ch = null, lvl = 0, cfg = null;
  let quiz = null;

  const TITLES = { home: "Story Builder", studio: "Studio", stories: "My stories", quiz: "Story Quiz" };
  function show(name) {
    screen = name;
    ["home", "chapter", "play", "studio", "stories", "quiz"].forEach((s) => { $(s).hidden = s !== name; });
    $("back").hidden = name !== "home";
    $("up").hidden = name === "home";
    $("up").innerHTML = "&lsaquo; " + (name === "play" && ch ? ch.kicker : name === "stories" && back === "studio" ? "Studio" : "Home");
    $("title").textContent = TITLES[name] || (name === "chapter" ? ch.name : "Level " + (lvl + 1));
    window.scrollTo(0, 0);
    if (name !== "play") SB.Lesson.stop();
    SB.Audio.hush();
  }

  function goHome() {
    ch = null;
    SB.UI.home(starsOf, store.quiz, openChapter);
    $("storiesTile").textContent = store.gallery.length ? store.gallery.length + " saved" : "None yet";
    show("home");
  }
  function openChapter(id) {
    ch = chapterById(id);
    SB.UI.chapter(ch, starsOf, unlocked, (i) => play(i));
    show("chapter");
  }
  function openStudio() { show("studio"); SB.Studio.open(); }
  function openStories(from) { back = from; show("stories"); SB.Studio.gallery(openStudio); }

  // ── A level ────────────────────────────────────────────────────────────────
  function play(i) {
    lvl = i;
    cfg = ch.levels[i];
    $("goalName").textContent = "Level " + (i + 1) + ": " + cfg.name;
    $("goalText").textContent = cfg.text;
    show("play");
    SB.Lesson.start(cfg, finish);
  }

  function finish(mistakes) {
    const got = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    const k = ch.id + "-" + lvl;
    store.stars[k] = Math.max(got, store.stars[k] || 0);
    save();
    SB.Audio.win();
    $("winStars").innerHTML = SB.UI.starRow(got);
    [0, 1, 2].forEach((i) => { if (i < got) setTimeout(() => SB.Audio.star(i), 150 + i * 180); });
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
    else if (screen === "stories" && back === "studio") openStudio();
    else goHome();
  });
  $("jobsBtn").addEventListener("click", () => $("jobsDialog").showModal());
  document.addEventListener("visibilitychange", () => { if (document.hidden) SB.Audio.hush(); });

  // ── Studio and gallery ─────────────────────────────────────────────────────
  $("studioBtn").addEventListener("click", openStudio);
  $("storiesBtn").addEventListener("click", () => openStories("home"));
  $("sStories").addEventListener("click", () => openStories("studio"));
  $("storiesStudio").addEventListener("click", openStudio);
  $("sName").addEventListener("click", SB.Studio.rename);
  $("sNew").addEventListener("click", SB.Studio.newStory);
  $("sSave").addEventListener("click", SB.Studio.saveStory);

  // ── Quiz ───────────────────────────────────────────────────────────────────
  function startQuiz() {
    quiz = { items: SB.QUIZ.map((pool) => pool[Math.floor(Math.random() * pool.length)]), i: 0, score: 0 };
    show("quiz");
    ask();
  }
  function ask() {
    SB.UI.question(quiz.i, quiz.items.length, quiz.items[quiz.i], (ok) => {
      if (ok) { quiz.score++; SB.Audio.right(); } else SB.Audio.wrong();
    });
  }
  $("qNext").addEventListener("click", () => {
    quiz.i++;
    if (quiz.i < quiz.items.length) { ask(); return; }
    store.quiz = Math.max(store.quiz || 0, quiz.score);
    save();
    if (quiz.score === quiz.items.length) SB.Audio.win();
    SB.UI.quizDone(quiz.score, quiz.items.length, startQuiz, goHome);
  });
  $("quizBtn").addEventListener("click", startQuiz);

  // ── Header buttons and dialogs ─────────────────────────────────────────────
  function paintMute() {
    const m = SB.Audio.isMuted();
    $("mute").innerHTML = m ? "&#128263;" : "&#128266;";
    $("mute").setAttribute("aria-pressed", m ? "true" : "false");
    $("mute").setAttribute("aria-label", m ? "Sound off" : "Sound on");
  }
  SB.Audio.setMuted(store.muted);
  paintMute();
  $("mute").addEventListener("click", () => {
    SB.Audio.setMuted(!SB.Audio.isMuted());
    store.muted = SB.Audio.isMuted();
    save();
    paintMute();
    SB.Audio.click();
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
