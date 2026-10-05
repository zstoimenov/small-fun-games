/* Career Compass - app state: which screen, the quiz, ratings, saved answers.  */
"use strict";
window.CC = window.CC || {};

(function () {
  const { $ } = CC.UI;
  const KEY = "career-compass";

  // ── Saved answers ──────────────────────────────────────────────────────────
  // quiz: the style picked for each question, or null before the first go.
  // likes: { folder: 1 | 0 | -1 }. Plays and stars come from the Game Box keys.
  const fresh = () => ({ quiz: null, likes: {}, muted: false, seenHelp: false });
  const store = fresh();
  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode or junk */ }
  // A damaged or older save must not crash the game: a field with the wrong
  // shape goes back to its default.
  if (!store.likes || typeof store.likes !== "object" || Array.isArray(store.likes)) store.likes = {};
  if (store.quiz !== null && !Array.isArray(store.quiz)) store.quiz = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } };

  let screen = "home";
  let quiz = null;

  function show(name) {
    screen = name;
    ["home", "quiz", "rate"].forEach((s) => { $(s).hidden = s !== name; });
    $("back").hidden = name !== "home";
    $("up").hidden = name === "home";
    $("title").textContent = name === "quiz" ? "Quiz" : name === "rate" ? "Rate my games" : "Career Compass";
    window.scrollTo(0, 0);
    if (name !== "home") CC.UI.still();
  }

  function goHome(spin) {
    const sig = CC.Score.signals(store);
    const best = CC.Score.top(sig);
    CC.UI.dial(sig, best);
    CC.UI.reading(sig, best);
    CC.UI.areas(sig, best, (a) => { CC.Audio.click(); CC.UI.area(a); });
    $("quizInfo").textContent = store.quiz ? "Done! Try again?" : CC.QUIZ.length + " quick questions";
    const played = CC.Score.played();
    const todo = played.filter((g) => store.likes[g.folder] === undefined).length;
    $("rateInfo").textContent = !played.length ? "Play some games first" : todo ? todo + " to rate" : "All rated!";
    show("home");
    CC.UI.point(best, spin);
    if (spin && best) CC.Audio.spin();
  }

  // ── Would you rather ───────────────────────────────────────────────────────
  // Questions and sides are shuffled each time, so the answers are about the
  // choices and not about tapping the top one.
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function startQuiz() {
    quiz = { items: shuffle(CC.QUIZ.map((p) => shuffle(p.slice()))), i: 0, picks: [] };
    show("quiz");
    ask();
  }
  function ask() {
    const q = quiz;
    CC.UI.question(q.i, q.items.length, q.items[q.i], (id) => {
      CC.Audio.pick();
      q.picks.push(id);
      setTimeout(() => {
        // Leaving and starting a new quiz in this pause makes a new quiz
        // object; the old answer must not move the new one on.
        if (screen !== "quiz" || quiz !== q) return;
        quiz.i++;
        if (quiz.i < quiz.items.length) ask(); else finishQuiz();
      }, 350);
    });
  }
  function finishQuiz() {
    store.quiz = quiz.picks;
    save();
    const sig = CC.Score.signals(store);
    const best = CC.Score.top(sig);
    $("dEmoji").textContent = best.emoji;
    $("dName").textContent = best.name + "!";
    $("dSays").textContent = best.says;
    const played = CC.Score.played().length;
    $("dNext").textContent = played
      ? "That's your answers and your games together. Rate your games to make it even better."
      : "Play some games and rate them, and your compass will learn more about you.";
    goHome(true);
    setTimeout(() => $("doneDialog").showModal(), reducedMotion() ? 0 : 1700);
  }
  const reducedMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("dOk").addEventListener("click", () => $("doneDialog").close());
  $("quizBtn").addEventListener("click", () => { CC.Audio.ready(); CC.Audio.click(); startQuiz(); });

  // ── Ratings ────────────────────────────────────────────────────────────────
  function startRate() {
    CC.UI.rate(CC.Score.played(), store.likes, (folder, v) => {
      if (v === undefined) delete store.likes[folder]; else store.likes[folder] = v;
      save();
      CC.Audio.pick();
    });
    show("rate");
  }
  $("rateBtn").addEventListener("click", () => { CC.Audio.ready(); CC.Audio.click(); startRate(); });

  // ── Grown-ups ──────────────────────────────────────────────────────────────
  $("grownBtn").addEventListener("click", () => {
    const sig = CC.Score.signals(store);
    CC.UI.table(sig, CC.Score.top(sig));
    $("grownDialog").showModal();
  });
  // Clears the quiz and ratings only. Plays and stars belong to the games.
  $("gReset").addEventListener("click", () => {
    if (!confirm("Clear the quiz answers and game ratings? Stars and plays in the games stay.")) return;
    store.quiz = null;
    store.likes = {};
    save();
    $("grownDialog").close();
    goHome();
    CC.UI.toast("Compass cleared. Ready for a fresh start!");
  });

  // ── Header and dialogs ─────────────────────────────────────────────────────
  $("up").addEventListener("click", () => goHome());
  function paintMute() {
    const m = CC.Audio.isMuted();
    $("mute").innerHTML = m ? "&#128263;" : "&#128266;";
    $("mute").setAttribute("aria-pressed", m ? "true" : "false");
    $("mute").setAttribute("aria-label", m ? "Sound off" : "Sound on");
  }
  CC.Audio.setMuted(store.muted);
  paintMute();
  $("mute").addEventListener("click", () => {
    CC.Audio.setMuted(!CC.Audio.isMuted());
    store.muted = CC.Audio.isMuted();
    save();
    paintMute();
    CC.Audio.click();
  });
  $("help").addEventListener("click", () => $("helpDialog").showModal());
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close()));
  // Coming back from a game via the back button: plays and stars may be new.
  addEventListener("pageshow", (e) => { if (e.persisted && screen === "home") goHome(); });

  goHome();
  if (!store.seenHelp) {
    store.seenHelp = true;
    save();
    $("helpDialog").showModal();
  }
})();
