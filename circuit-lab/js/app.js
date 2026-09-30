/* Circuit Lab - app state: which screen, which level, the parts on the board, */
/* what's left in the box, stars, and the quiz.                                */
"use strict";
window.CL = window.CL || {};

(function () {
  const { $ } = CL.UI;
  const C = CL.Circuit;
  const P = C.PARTS;
  const KEY = "circuit-lab";

  // ── Saved progress ─────────────────────────────────────────────────────────
  const store = { stars: {}, quiz: null, muted: false, seenHelp: false, pledged: "" };
  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode or junk */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } };
  const starsOf = (ch, i) => store.stars[ch + "-" + i] || 0;
  const unlocked = (ch, i) => i === 0 || starsOf(ch, i - 1) > 0;
  const chapterById = (id) => CL.CHAPTERS.find((c) => c.id === id);

  // ── State ──────────────────────────────────────────────────────────────────
  let screen = "home";
  let ch = null;       // current chapter, null in the free build
  let lvl = -1;        // level index, -1 = the free build
  let cfg = null;      // the level being played
  let parts = {};      // edge key -> { type, on, broken, locked }
  let inv = {};        // part type -> how many are left in the box
  let tool = null;     // the picked part, or "remove"
  let moves = 0;
  let won = false;
  let tested = {};     // "Test it": thing -> "yes" | "little" | "no"
  let wasShort = false;
  let warned = false;  // the short-circuit talk, once per go at a level
  let winTimer = 0;
  let quiz = null;

  function show(name) {
    screen = name;
    ["home", "chapter", "play", "safety", "quiz"].forEach((s) => { $(s).hidden = s !== name; });
    $("back").hidden = name !== "home";
    $("up").hidden = name === "home";
    $("up").innerHTML = "&lsaquo; " + ((name === "play" || name === "safety") && ch ? ch.kicker : "Home");
    $("title").textContent = name === "home" ? "Circuit Lab"
      : name === "quiz" ? "Circuit Quiz"
      : name === "chapter" ? ch.name
      : lvl < 0 ? "Free build" : "Level " + (lvl + 1);
    window.scrollTo(0, 0);
    if (name !== "play") { cfg = null; CL.Audio.buzz(false); }
  }

  function goHome() {
    ch = null;
    CL.UI.home(starsOf, store.quiz, openChapter, expert());
    show("home");
  }

  // Nothing but Stay Safe opens until every Stay Safe level has a star.
  function gate() {
    if (expert()) return false;
    CL.UI.toast("\u{1F512} Finish Stay Safe first! \u{1F9BA}");
    CL.Audio.nope();
    return true;
  }

  function openChapter(id) {
    if (!chapterById(id).safety && gate()) return;
    ch = chapterById(id);
    CL.UI.chapter(ch, starsOf, unlocked, (i) => play(i));
    show("chapter");
  }

  const safetyChapter = () => CL.CHAPTERS.find((c) => c.safety);
  const expert = () => safetyChapter().levels.every((_, i) => starsOf(safetyChapter().id, i) > 0);

  // ── A Stay Safe level: no board, just the safety screen ────────────────────
  function playSafety(i) {
    lvl = i;
    show("safety");      // before cfg: show() clears it for any non-board screen
    cfg = ch.levels[i];
    won = false;
    $("safetyName").textContent = "Level " + (i + 1) + ": " + cfg.name;
    $("safetyText").textContent = cfg.text;
    CL.Safety.start(cfg, (wrong) => win(wrong === 0 ? 3 : wrong <= 2 ? 2 : 1), (name) => {
      CL.Audio.ready();
      const f = CL.Audio[name];
      if (f) f();
    });
  }

  // ── Playing a level (or the free build) ────────────────────────────────────
  function play(i) {
    if (i >= 0 && ch.levels[i].kind) { playSafety(i); return; }
    lvl = i;
    cfg = i < 0 ? CL.FREE : ch.levels[i];
    parts = {};
    Object.keys(cfg.parts).forEach((k) => { parts[k] = { type: cfg.parts[k], on: false, locked: true }; });
    Object.keys(cfg.loose || {}).forEach((k) => { parts[k] = { type: cfg.loose[k], on: false }; });
    inv = Object.assign({}, cfg.inv);
    tool = Object.keys(inv)[0] || "remove";
    moves = 0;
    won = false;
    tested = {};
    wasShort = false;
    warned = false;
    clearTimeout(winTimer);
    $("goalName").textContent = i < 0 ? "\u{1F527} Free build" : "Level " + (i + 1) + ": " + cfg.name;
    $("goalText").textContent = cfg.text;
    show("play");
    CL.Board.build($("stage"), cfg.grid, cfg.open || null, cfg.test || null, tap);
    refresh("");
  }

  const stars = () => moves <= cfg.par ? 3 : moves <= cfg.par + 3 ? 2 : 1;

  function goalStars() {
    const g = $("goalStars");
    if (lvl < 0) { g.innerHTML = ""; return; }
    g.innerHTML = CL.UI.starRow(starsOf(ch.id, lvl)) + " <small>Moves: " + moves + " \u{00B7} 3\u{2605} in " + cfg.par + "</small>";
  }

  function paintControls() {
    CL.UI.controls({ inv, tool, tested, testing: cfg.test ? cfg.goal.things : null, free: lvl < 0 }, act);
  }

  // A tap on the board. The rules, in the order a kid meets them: glued parts
  // stay put, switches flip, Remove takes back, the same part takes back, a
  // different part swaps in.
  function tap(key) {
    if (!cfg || won) return;
    CL.Audio.ready();
    const p = parts[key];
    if (cfg.open && cfg.open.indexOf(key) < 0) {
      if (p && p.type === "switch") { flip(p); return; }
      CL.UI.toast(p ? "That part is glued down." : "Use the " + (cfg.test ? "glowing gap" : "gaps in the loop") + ".");
      CL.Audio.nope();
      return;
    }
    if (p && p.type === "switch" && tool !== "remove") { flip(p); return; }
    if (p && p.locked) { CL.UI.toast("That part is glued down. Build around it!"); CL.Audio.nope(); return; }
    // A burned-out bulb tapped with a bulb gets a fresh one, not taken back.
    if (p && p.broken && tool === "bulb") { p.broken = false; moves++; CL.Audio.snap(); refresh(""); return; }
    if (tool === "remove" || (p && p.type === tool)) {
      if (!p) { CL.UI.toast("Nothing there to take back."); return; }
      inv[p.type] = (inv[p.type] || 0) + 1;
      delete parts[key];
      moves++;
      CL.Audio.unsnap();
      refresh("");
      return;
    }
    if (!(inv[tool] > 0)) {
      CL.UI.toast("No " + P[tool].label.toLowerCase() + "s left. Take one back with \u{1F9FD} Remove.");
      CL.Audio.nope();
      return;
    }
    if (p) inv[p.type] = (inv[p.type] || 0) + 1;
    inv[tool]--;
    parts[key] = { type: tool, on: false };
    moves++;
    CL.Audio.snap();
    refresh("", key);
  }

  function flip(p) {
    p.on = !p.on;
    CL.Audio.flip(p.on);
    refresh("");
  }

  function refresh(msg, placed) {
    const res = C.settle(cfg.grid, parts);
    CL.Board.render(parts, res);
    const loads = Object.keys(parts).filter((k) => P[parts[k].type].load);
    CL.Audio.buzz(Object.keys(parts).some((k) => parts[k].type === "buzzer" && C.on(res.level[k])));

    // The test spot: what did that thing do to the bulb?
    if (cfg.test && placed === cfg.test) {
      const bulb = loads.find((k) => parts[k].type === "bulb");
      const v = C.verdict(bulb ? res.level[bulb] || 0 : 0);
      tested[parts[placed].type] = v;
      tested.__any = true;
      msg = P[parts[placed].type].emoji + " " + (v === "yes" ? "It lights up! Electricity goes through."
        : v === "little" ? "A dim glow. A little electricity gets through."
        : "Nothing. It stops the electricity.");
    }

    if (res.popped.length) { CL.Audio.pop(); msg = "\u{1F4A5} Pop! Too big a push. The bulb burned out. Tap it with a new bulb to swap it."; }
    if (res.short) {
      if (!wasShort) CL.Audio.zap();
      // The first short on each go gets the real-world talk, not just a line.
      if (!warned) { warned = true; setTimeout(() => { if (screen === "play") $("shortDialog").showModal(); }, 700); }
      msg = "\u{26A0}\u{FE0F} Short circuit! The electricity found a shortcut back to the battery without going through anything. The battery is getting hot!";
    }
    wasShort = res.short;

    if (!cfg.free) {
      const g = C.goal(cfg.goal, cfg.grid, parts, res, { tested });
      if (g.ok && !won) { win(stars()); msg = msg || "\u{1F389} " + cfg.win; }
      else if (!msg && g.hint) msg = g.hint;
    }
    if (!msg && moves && loads.length && !loads.some((k) => C.on(res.level[k]))) {
      msg = "No full loop yet. Electricity needs a path out of the battery and back in.";
    }
    $("say").textContent = msg;
    paintControls();
    goalStars();
  }

  function act(what, v) {
    CL.Audio.ready();
    if (what === "tool") { tool = v; CL.Audio.click(); paintControls(); }
    else if (what === "reset") { CL.Audio.click(); play(lvl); }
  }

  function win(got) {
    won = true;
    const k = ch.id + "-" + lvl;
    store.stars[k] = Math.max(got, store.stars[k] || 0);
    save();
    CL.Audio.win();
    clearTimeout(winTimer);
    winTimer = setTimeout(() => showWin(got), cfg.kind ? 300 : 1400);
  }

  function showWin(got) {
    if (screen !== "play" && screen !== "safety") return;
    CL.Audio.buzz(false);
    $("winStars").innerHTML = CL.UI.starRow(got);
    [0, 1, 2].forEach((i) => { if (i < got) setTimeout(() => CL.Audio.star(i), 150 + i * 180); });
    $("winTitle").textContent = got === 3 ? "Brilliant!" : got === 2 ? "Well done!" : "You did it!";
    $("winText").textContent = cfg.win + (got < 3 ? (cfg.kind ? " (Can you get them all right first time?)" : " (Can you do it in " + cfg.par + " moves?)") : "");
    // Every win ends on a real-world safety rule, round and round the list.
    store.spark = ((store.spark || 0) + 1) % CL.SPARKS.length;
    save();
    $("winSpark").textContent = CL.SPARKS[store.spark];
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
  $("lessonOk").addEventListener("click", () => {
    $("lessonDialog").close();
    const opened = ch && ch.safety && !store.opened;
    goHome();
    if (opened) { store.opened = true; save(); CL.UI.toast("\u{1F513} The whole lab is open now!"); }
  });

  $("freeBtn").addEventListener("click", () => { if (gate()) return; ch = null; play(-1); });
  $("jobsBtn").addEventListener("click", () => $("jobsDialog").showModal());
  $("up").addEventListener("click", () => {
    if ((screen === "play" || screen === "safety") && ch) openChapter(ch.id);
    else goHome();
  });

  // ── The loop: only the moving dots and fans animate ────────────────────────
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (screen === "play") CL.Board.tick(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // A buzzer left ringing in a backgrounded tab is nobody's friend.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) CL.Audio.buzz(false);
    else if (screen === "play") refresh($("say").textContent);
  });

  // ── Quiz ───────────────────────────────────────────────────────────────────
  function startQuiz() {
    quiz = { items: CL.QUIZ.map((pool) => pool[Math.floor(Math.random() * pool.length)]), i: 0, score: 0 };
    show("quiz");
    ask();
  }
  function ask() {
    CL.UI.question(quiz.i, quiz.items.length, quiz.items[quiz.i], (ok) => {
      if (ok) { quiz.score++; CL.Audio.right(); } else CL.Audio.wrong();
    });
  }
  $("qNext").addEventListener("click", () => {
    quiz.i++;
    if (quiz.i < quiz.items.length) { ask(); return; }
    store.quiz = Math.max(store.quiz || 0, quiz.score);
    save();
    if (quiz.score === quiz.items.length) CL.Audio.win();
    CL.UI.quizDone(quiz.score, quiz.items.length, startQuiz, goHome);
  });
  $("quizBtn").addEventListener("click", () => { if (!gate()) startQuiz(); });

  // ── Header buttons and dialogs ─────────────────────────────────────────────
  function paintMute() {
    const m = CL.Audio.isMuted();
    $("mute").innerHTML = m ? "&#128263;" : "&#128266;";
    $("mute").setAttribute("aria-pressed", m ? "true" : "false");
    $("mute").setAttribute("aria-label", m ? "Sound off" : "Sound on");
  }
  CL.Audio.setMuted(store.muted);
  paintMute();
  $("mute").addEventListener("click", () => {
    CL.Audio.setMuted(!CL.Audio.isMuted());
    store.muted = CL.Audio.isMuted();
    save();
    paintMute();
    CL.Audio.click();
    if (screen === "play" && !won) refresh($("say").textContent);
  });
  $("help").addEventListener("click", () => $("helpDialog").showModal());
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close()));

  // ── The Lab Rules pledge, once a day ──────────────────────────────────────
  // It can't be waved away with Escape: "I promise" is the only way in.
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
  $("rules").innerHTML = CL.RULES.map((r) => '<li><span class="re" aria-hidden="true">' + r.e + "</span>" + r.t + "</li>").join("");
  function pledge(required) {
    $("pledgeDialog").dataset.required = required ? "1" : "";
    $("pledgeOk").innerHTML = required ? "\u{270B} I promise!" : "Got it!";
    $("pledgeDialog").showModal();
  }
  $("pledgeDialog").addEventListener("cancel", (e) => { if ($("pledgeDialog").dataset.required) e.preventDefault(); });
  $("pledgeOk").addEventListener("click", () => {
    const first = !!$("pledgeDialog").dataset.required;
    $("pledgeDialog").close();
    if (!first) return;
    CL.Audio.ready();
    CL.Audio.right();
    store.pledged = today();
    save();
    if (!store.seenHelp) {
      store.seenHelp = true;
      save();
      $("helpDialog").showModal();
    }
  });
  $("rulesBtn").addEventListener("click", () => pledge(false));
  $("shortOk").addEventListener("click", () => $("shortDialog").close());

  goHome();
  if (store.pledged !== today()) pledge(true);
  else if (!store.seenHelp) {
    store.seenHelp = true;
    save();
    $("helpDialog").showModal();
  }
})();
