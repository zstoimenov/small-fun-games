/* Newton's Playground - app state: which screen, which level, stars, the     */
/* game loop, and the finger on the canvas.                                    */
"use strict";
window.NL = window.NL || {};

(function () {
  const { $ } = NL.UI;
  const KEY = "newton-playground";

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
    NL.CHAPTERS.forEach((c) => c.levels.forEach((_, i) => { got += starsOf(c.id, i); max += 3; }));
    try { localStorage.setItem("gamebox:progress:newtons-laws", JSON.stringify({ stars: got, max, at: Date.now() })); } catch (e) { /* ignore */ }
  }
  const chapterById = (id) => NL.CHAPTERS.find((c) => c.id === id);

  // ── State ──────────────────────────────────────────────────────────────────
  let screen = "home";
  let ch = null;          // current chapter
  let lvl = -1;           // current level index, -1 = the sandbox
  let scene = null;
  let fails = 0;
  let wasMoving = false;
  let winTimer = 0;
  let quiz = null;

  function show(name) {
    screen = name;
    ["home", "chapter", "play", "quiz"].forEach((s) => { $(s).hidden = s !== name; });
    $("back").hidden = name !== "home";
    $("up").hidden = name === "home";
    $("up").innerHTML = "&lsaquo; " + (name === "play" ? ch.kicker : "Home");
    $("title").textContent = name === "home" ? "Newton's Playground"
      : name === "quiz" ? "Newton Quiz"
      : name === "chapter" ? ch.kicker + ": " + ch.name
      : lvl < 0 ? "Try it" : "Level " + (lvl + 1);
    window.scrollTo(0, 0);
    if (name !== "play") scene = null;
  }

  function goHome() {
    NL.UI.home(starsOf, store.quiz, openChapter);
    show("home");
  }

  function openChapter(id) {
    ch = chapterById(id);
    NL.UI.chapter(ch, starsOf, unlocked, (i) => play(i));
    show("chapter");
  }

  // ── Playing a level (or the sandbox) ───────────────────────────────────────
  const hooks = {
    say(msg) { $("say").textContent = msg; },
    sound(name, arg) { const f = NL.Audio[name]; if (f) f(arg); },
    end(win, msg) {
      $("say").textContent = msg;
      if (win) {
        NL.Audio.win();
        const got = fails === 0 ? 3 : fails <= 2 ? 2 : 1;
        const k = ch.id + "-" + lvl;
        const best = Math.max(got, store.stars[k] || 0);
        store.stars[k] = best;
        save();
        clearTimeout(winTimer);
        winTimer = setTimeout(() => showWin(got, msg), 900);
      } else {
        fails++;
        NL.Audio.miss();
        goalStars();
      }
      NL.UI.controls(scene, act);
    }
  };

  function play(i) {
    lvl = i;
    fails = 0;
    const cfg = i < 0 ? ch.sandbox : ch.levels[i];
    scene = NL.Scenes.create(cfg, hooks);
    $("goalName").textContent = i < 0 ? "\u{1F590}\u{FE0F} Try it" : "Level " + (i + 1) + ": " + cfg.name;
    $("goalText").textContent = cfg.goal;
    $("say").textContent = "";
    goalStars();
    show("play");
    NL.Draw.resize();
    NL.Draw.readColours();
    NL.UI.controls(scene, act);
  }

  function goalStars() {
    const g = $("goalStars");
    if (lvl < 0) { g.innerHTML = ""; return; }
    g.innerHTML = NL.UI.starRow(starsOf(ch.id, lvl)) + (fails ? ' <small>Tries: ' + (fails + 1) + "</small>" : "");
  }

  function act(what, v) {
    if (!scene) return;
    NL.Audio.ready();
    const s = scene;
    if (what === "surface") { NL.Audio.click(); s.setSurface(v); hooks.say(""); }
    else if (what === "reset") { NL.Audio.click(); s.reset(); hooks.say(""); }
    else if (what === "push" || what === "load") { NL.Audio.click(); s.set(what, v); hooks.say(""); }
    else if (what === "go") s.go();
    else if (what === "guess") s.go(v);
    else if (what === "throw") s.throwBall(v);
    else if (what === "blow") s.blow();
    else if (what === "letgo") s.letGo();
    NL.UI.controls(s, act);
  }

  function showWin(got, msg) {
    $("winStars").innerHTML = NL.UI.starRow(got);
    [0, 1, 2].forEach((i) => { if (i < got) setTimeout(() => NL.Audio.star(i), 150 + i * 180); });
    $("winTitle").textContent = got === 3 ? "Brilliant!" : got === 2 ? "Well done!" : "You did it!";
    $("winText").textContent = msg;
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
    $("lessonDialog").showModal();
  });
  $("lessonOk").addEventListener("click", () => { $("lessonDialog").close(); goHome(); });

  $("sandBtn").addEventListener("click", () => play(-1));
  $("up").addEventListener("click", () => {
    if (screen === "play") openChapter(ch.id);
    else goHome();
  });

  // ── The finger on the canvas (Law 1's slingshot) ───────────────────────────
  // Pull from wherever the finger lands, in any direction; how far is the
  // power. Anywhere on the canvas, any way, because a finger that lands near
  // the left edge has no room left to pull back into.
  const cv = $("world");
  NL.Draw.attach(cv);
  let pull = null;
  const fullPull = () => Math.min(240, NL.Draw.width() * 0.55);
  cv.addEventListener("pointerdown", (e) => {
    if (!scene || scene.kind !== "flick" || !scene.canAim()) return;
    NL.Audio.ready();
    pull = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* old Safari */ }
    scene.setAim(0);
    hooks.say("");
    e.preventDefault();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!pull || e.pointerId !== pull.id || !scene) return;
    scene.setAim(Math.hypot(e.clientX - pull.x, e.clientY - pull.y) / fullPull());
  });
  const letGo = (e) => {
    if (!pull || e.pointerId !== pull.id) return;
    pull = null;
    if (scene && scene.kind === "flick") {
      const p = scene.aim;
      scene.release();
      if (p != null && p < 0.04 && !scene.moving) hooks.say("Pull your finger further away, then let go.");
      NL.UI.controls(scene, act);
    }
  };
  cv.addEventListener("pointerup", letGo);
  cv.addEventListener("pointercancel", letGo);

  // ── The loop ───────────────────────────────────────────────────────────────
  // Fixed physics steps, so a flick lands in the same place on a slow tablet
  // and a fast laptop. Capped, so a tab coming back from the background
  // doesn't try to catch up on minutes of simulation.
  let last = performance.now(), acc = 0;
  function loop(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    if (scene) {
      while (acc >= NL.Physics.DT) { scene.update(NL.Physics.DT); acc -= NL.Physics.DT; }
      NL.Draw.frame(scene);
      if (scene && scene.moving !== wasMoving) { wasMoving = scene.moving; NL.UI.controls(scene, act); }
    } else acc = 0;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener("resize", () => { if (scene) NL.Draw.resize(); });
  const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  if (dark && dark.addEventListener) dark.addEventListener("change", () => NL.Draw.readColours());

  // ── Quiz ───────────────────────────────────────────────────────────────────
  function startQuiz() {
    quiz = { items: NL.QUIZ.map((pool) => pool[Math.floor(Math.random() * pool.length)]), i: 0, score: 0 };
    show("quiz");
    ask();
  }
  function ask() {
    NL.UI.question(quiz.i, quiz.items.length, quiz.items[quiz.i], (ok) => {
      if (ok) { quiz.score++; NL.Audio.right(); } else NL.Audio.wrong();
    });
  }
  $("qNext").addEventListener("click", () => {
    quiz.i++;
    if (quiz.i < quiz.items.length) { ask(); return; }
    store.quiz = Math.max(store.quiz || 0, quiz.score);
    save();
    if (quiz.score === quiz.items.length) NL.Audio.win();
    NL.UI.quizDone(quiz.score, quiz.items.length, startQuiz, goHome);
  });
  $("quizBtn").addEventListener("click", startQuiz);

  // ── Header buttons and dialogs ─────────────────────────────────────────────
  function paintMute() {
    const m = NL.Audio.isMuted();
    $("mute").innerHTML = m ? "&#128263;" : "&#128266;";
    $("mute").setAttribute("aria-pressed", m ? "true" : "false");
    $("mute").setAttribute("aria-label", m ? "Sound off" : "Sound on");
  }
  NL.Audio.setMuted(store.muted);
  paintMute();
  $("mute").addEventListener("click", () => {
    NL.Audio.setMuted(!NL.Audio.isMuted());
    store.muted = NL.Audio.isMuted();
    save();
    paintMute();
    NL.Audio.click();
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
