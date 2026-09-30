/* Bridge Builder - app state: screens, the bridge being built, what's left   */
/* in the box, the test drive, stars and the quiz.                             */
"use strict";
window.BB = window.BB || {};

(function () {
  const { $ } = BB.UI;
  const Ph = BB.Physics;
  const U = BB.Board.U;
  const KEY = "bridge-builder";
  const SPEED = 1.5;      // grid steps a second

  // ── Saved progress ─────────────────────────────────────────────────────────
  const store = { stars: {}, quiz: null, muted: false, seenHelp: false };
  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode or junk */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } };
  const starsOf = (ch, i) => store.stars[ch + "-" + i] || 0;
  const unlocked = (ch, i) => i === 0 || starsOf(ch, i - 1) > 0;
  const chapterById = (id) => BB.CHAPTERS.find((c) => c.id === id);

  // ── State ──────────────────────────────────────────────────────────────────
  let screen = "home";
  let ch = null, lvl = -1, cfg = null;
  let members = [];      // the design: { a, b, mat, locked }
  let inv = {};
  let tool = null;
  let selected = null;   // the dot picked first, waiting for its partner
  let truckKind = "car";
  let test = null;       // the drive in progress, or null while building
  let winTimer = 0;
  let quiz = null;

  function show(name) {
    screen = name;
    ["home", "chapter", "play", "quiz"].forEach((s) => { $(s).hidden = s !== name; });
    $("back").hidden = name !== "home";
    $("up").hidden = name === "home";
    $("up").innerHTML = "&lsaquo; " + (name === "play" && ch ? ch.kicker : "Home");
    $("title").textContent = name === "home" ? "Bridge Builder"
      : name === "quiz" ? "Bridge Quiz"
      : name === "chapter" ? ch.name
      : lvl < 0 ? "Free build" : "Level " + (lvl + 1);
    window.scrollTo(0, 0);
    if (name !== "play") { test = null; BB.Audio.motor(false); }
  }

  function goHome() {
    ch = null;
    BB.UI.home(starsOf, store.quiz, openChapter);
    show("home");
  }
  function openChapter(id) {
    ch = chapterById(id);
    BB.UI.chapter(ch, starsOf, unlocked, (i) => play(i));
    show("chapter");
  }

  // ── Building ───────────────────────────────────────────────────────────────
  const parse = (s) => { const [a, b, mat] = s.split(" "); return { a, b, mat, locked: true }; };
  const used = () => members.filter((m) => !m.locked).length;
  const find = (a, b) => members.find((m) => Ph.key(m.a, m.b) === Ph.key(a, b));

  function play(i) {
    lvl = i;
    cfg = i < 0 ? BB.FREE : ch.levels[i];
    members = cfg.parts.map(parse);
    inv = Object.assign({}, cfg.inv);
    tool = Object.keys(inv)[0];
    truckKind = cfg.truck;
    selected = null;
    test = null;
    clearTimeout(winTimer);
    $("goalName").textContent = i < 0 ? "\u{1F527} Free build" : "Level " + (i + 1) + ": " + cfg.name;
    $("goalText").textContent = cfg.text;
    show("play");
    BB.Board.build($("stage"), cfg, tapDot, tapPiece);
    say("");
    paint();
  }

  function say(msg) { $("say").textContent = msg; }

  function goalStars() {
    const g = $("goalStars");
    const T = Ph.TRUCKS[truckKind];
    const who = '<span class="who">' + T.emoji + " " + T.label + "</span>";
    if (lvl < 0) { g.innerHTML = who; return; }
    g.innerHTML = BB.UI.starRow(starsOf(ch.id, lvl)) + " <small>Pieces: " + used() + " \u{00B7} 3\u{2605} in " + cfg.par + "</small> " + who;
  }

  // Reachable dots from the picked one, for the glow that shows where to tap.
  function near() {
    if (!selected || tool === "remove") return [];
    return Ph.dots(cfg).filter((id) => !Ph.canJoin(cfg, selected, id, tool));
  }

  function paint() {
    BB.Board.render({ members, selected, near: near() });
    BB.UI.controls({ inv, tool, free: !!cfg.free, truck: truckKind, testing: false }, act);
    goalStars();
  }

  function tapDot(id) {
    if (test) return;
    BB.Audio.ready();
    if (tool === "remove") { BB.UI.toast("Tap the middle of a piece to take it back."); return; }
    if (!selected || selected === id) {
      selected = selected === id ? null : id;
      if (selected) BB.Audio.pick();
      paint();
      return;
    }
    const why = Ph.canJoin(cfg, selected, id, tool);
    if (why) {
      // Too far away is just "pick this one instead"; anything else is a rule.
      const [x1, y1] = Ph.xy(selected), [x2, y2] = Ph.xy(id);
      if (Math.abs(x1 - x2) > 1 || Math.abs(y1 - y2) > 1) { selected = id; BB.Audio.pick(); paint(); return; }
      BB.UI.toast(why);
      BB.Audio.nope();
      return;
    }
    const old = find(selected, id);
    if (old && old.locked) { BB.UI.toast("That piece is bolted down. Build around it!"); BB.Audio.nope(); return; }
    if (old && old.mat === tool) { takeBack(old); selected = id; paint(); return; }
    if (!(inv[tool] > 0)) {
      BB.UI.toast("No " + Ph.MAT[tool].label.toLowerCase() + " left. Take a piece back with \u{1F9FD} Remove.");
      BB.Audio.nope();
      return;
    }
    if (old) takeBack(old);
    members.push({ a: selected, b: id, mat: tool });
    inv[tool]--;
    BB.Audio.place();
    // Keep going from the dot you just reached: roads are built dot, dot, dot.
    selected = id;
    say("");
    paint();
  }

  function takeBack(m) {
    members.splice(members.indexOf(m), 1);
    inv[m.mat] = (inv[m.mat] || 0) + 1;
    BB.Audio.unplace();
  }

  function tapPiece(m) {
    if (test) return;
    BB.Audio.ready();
    if (m.locked) { BB.UI.toast("That piece is bolted down."); BB.Audio.nope(); return; }
    takeBack(m);
    selected = null;
    paint();
  }

  function act(what, v) {
    BB.Audio.ready();
    if (what === "tool") { tool = v; if (v === "remove") selected = null; BB.Audio.click(); paint(); }
    else if (what === "truck") { truckKind = v; BB.Audio.click(); paint(); }
    else if (what === "reset") { BB.Audio.click(); play(lvl); }
    else if (what === "test") startTest();
    else if (what === "stop") stopTest();
  }

  // ── The test drive ─────────────────────────────────────────────────────────
  function startTest() {
    selected = null;
    test = {
      ms: members.map((m) => ({ a: m.a, b: m.b, mat: m.mat, locked: m.locked })),
      x: -1.4, move: {}, falling: [], splashes: [], truck: null,
      state: "drive", first: "", creak: 0, done: false
    };
    test.truck = { kind: truckKind, x: test.x, y: -12, rot: 0, vy: 0 };
    say("Here comes the " + Ph.TRUCKS[truckKind].label.toLowerCase() + "!");
    BB.Audio.horn();
    BB.Audio.motor(true);
    step(0);
    BB.UI.controls({ testing: true, done: false }, act);
  }

  function stopTest() {
    test = null;
    BB.Audio.motor(false);
    say("");
    paint();
  }

  // Pieces that snapped or came loose fall into the river as real bits.
  function drop(broke) {
    broke.forEach((m) => {
      const [ax, ay] = Ph.xy(m.a).map((v) => v * U), [bx, by] = Ph.xy(m.b).map((v) => v * U);
      const len = Math.hypot(bx - ax, by - ay);
      const rot = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
      const halves = m.gone === "snap" ? [[0.25, -1], [0.75, 1]] : [[0.5, 0]];
      halves.forEach(([f, dir]) => test.falling.push({
        x: ax + (bx - ax) * f, y: ay + (by - ay) * f, len: m.gone === "snap" ? len / 2 : len,
        rot, vr: dir * 90 + (Math.random() - 0.5) * 60, vy: -40, mat: m.mat
      }));
      if (!test.first) {
        // A level can say what a snapped road means there ("the squares
        // folded"), because the road is usually just where the failure shows.
        test.first = m.gone === "fall" ? (m.mat === "road" ? "That road piece wasn't joined to anything, so it fell off."
          : "Those beams weren't held in place, so they fell off. Every beam needs a triangle holding it.")
          : m.mat === "road" ? "Crack! " + (cfg.fail || "The road bent too far and snapped. It needs holding up.")
          : (m.N < 0 ? "Snap! A beam got squashed too hard." : "Snap! A beam got stretched too hard.") + " Try more triangles, or steel.";
      }
    });
    if (broke.some((m) => m.gone === "snap")) BB.Audio.snap();
  }

  function step(dt) {
    const t = test;
    const tr = t.truck;
    if (t.state === "drive") {
      t.x += SPEED * dt;
      const L = Ph.truckLoads(t.ms, 0, [0, cfg.gap], tr.kind, t.x);
      let res = null;
      if (!L.air) {
        res = Ph.settle(t.ms, Ph.anchors(cfg), L.loads);
        t.move = res.move;
        drop(res.broke);
      }
      const L2 = L.air ? L : Ph.truckLoads(t.ms, 0, [0, cfg.gap], tr.kind, t.x);
      const y = BB.Board.roadY(t.ms, t.move, t.x);
      if (L2.air || y == null) {
        t.state = "fall";
        tr.vy = 0;
        BB.Audio.motor(false);
        if (!t.first) t.first = "There's a gap in the road! The truck needs road all the way across.";
      } else {
        tr.x = t.x;
        tr.y = y;
        const worst = Math.max(0, ...t.ms.filter((m) => !m.gone).map((m) => m.strain || 0));
        t.creak -= dt;
        if (worst > 0.85 && t.creak <= 0) { BB.Audio.creak(); t.creak = 0.6; }
      }
      if (t.x > cfg.gap + 1.4) finish(true);
    } else if (t.state === "fall") {
      tr.vy += 900 * dt;
      tr.y += tr.vy * dt;
      tr.x += 0.4 * dt;
      tr.rot += 70 * dt;
      if (tr.y > BB.Board.water + 80) t.state = "sunk";
      if (tr.y > BB.Board.water && !t.splashed) {
        t.splashed = true;
        t.splashes.push({ x: tr.x * U, t: 0 });
        BB.Audio.splash();
        finish(false);
      }
    }
    t.falling.forEach((f) => {
      f.vy += 900 * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (!f.wet && f.y > BB.Board.water) { f.wet = true; t.splashes.push({ x: f.x, t: 0 }); }
    });
    t.falling = t.falling.filter((f) => f.y < BB.Board.water + 300);
    t.splashes.forEach((s) => { s.t += dt * 1.4; });
    t.splashes = t.splashes.filter((s) => s.t < 1);
    BB.Board.render({ members: t.ms, move: t.move, testing: true, truck: tr.y < BB.Board.water + 60 ? tr : null, falling: t.falling, splashes: t.splashes });
  }

  function finish(ok) {
    const t = test;
    if (t.done) return;
    t.done = true;
    BB.Audio.motor(false);
    if (!ok) {
      say("\u{1F4A6} Splash! " + (t.first || "The bridge wasn't strong enough."));
      BB.UI.controls({ testing: true, done: true }, act);
      return;
    }
    t.state = "stopped";
    if (lvl < 0) {
      say("\u{1F389} Made it across! Try a heavier truck.");
      BB.Audio.win();
      BB.UI.controls({ testing: true, done: true }, act);
      return;
    }
    const n = used();
    const got = n <= cfg.par ? 3 : n <= cfg.par + 2 ? 2 : 1;
    const k = ch.id + "-" + lvl;
    store.stars[k] = Math.max(got, store.stars[k] || 0);
    save();
    BB.Audio.win();
    say("\u{1F389} Made it across!");
    BB.UI.controls({ testing: true, done: true }, act);
    winTimer = setTimeout(() => showWin(got, n), 700);
  }

  function showWin(got, n) {
    if (screen !== "play") return;
    $("winStars").innerHTML = BB.UI.starRow(got);
    [0, 1, 2].forEach((i) => { if (i < got) setTimeout(() => BB.Audio.star(i), 150 + i * 180); });
    $("winTitle").textContent = got === 3 ? "Brilliant!" : got === 2 ? "Well done!" : "You did it!";
    $("winText").textContent = cfg.win + (got < 3 ? " (You used " + n + " pieces. Can you do it with " + cfg.par + "?)" : "");
    const last = lvl === ch.levels.length - 1;
    $("winNext").innerHTML = last ? "What I learned &rsaquo;" : "Next level &rsaquo;";
    $("winDialog").showModal();
  }

  $("winAgain").addEventListener("click", () => { $("winDialog").close(); stopTest(); });
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
  $("freeBtn").addEventListener("click", () => { ch = null; play(-1); });
  $("up").addEventListener("click", () => {
    if (screen === "play" && ch) openChapter(ch.id);
    else goHome();
  });

  // ── The loop ───────────────────────────────────────────────────────────────
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Keep animating after the end while anything is still falling or splashing.
    if (test && screen === "play" && (!test.done || test.falling.length || test.splashes.length || test.state === "fall")) step(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) BB.Audio.motor(false); });

  // ── Quiz ───────────────────────────────────────────────────────────────────
  function startQuiz() {
    quiz = { items: BB.QUIZ.map((pool) => pool[Math.floor(Math.random() * pool.length)]), i: 0, score: 0 };
    show("quiz");
    ask();
  }
  function ask() {
    BB.UI.question(quiz.i, quiz.items.length, quiz.items[quiz.i], (ok) => {
      if (ok) { quiz.score++; BB.Audio.right(); } else BB.Audio.wrong();
    });
  }
  $("qNext").addEventListener("click", () => {
    quiz.i++;
    if (quiz.i < quiz.items.length) { ask(); return; }
    store.quiz = Math.max(store.quiz || 0, quiz.score);
    save();
    if (quiz.score === quiz.items.length) BB.Audio.win();
    BB.UI.quizDone(quiz.score, quiz.items.length, startQuiz, goHome);
  });
  $("quizBtn").addEventListener("click", startQuiz);

  // ── Header buttons and dialogs ─────────────────────────────────────────────
  function paintMute() {
    const m = BB.Audio.isMuted();
    $("mute").innerHTML = m ? "&#128263;" : "&#128266;";
    $("mute").setAttribute("aria-pressed", m ? "true" : "false");
    $("mute").setAttribute("aria-label", m ? "Sound off" : "Sound on");
  }
  BB.Audio.setMuted(store.muted);
  paintMute();
  $("mute").addEventListener("click", () => {
    BB.Audio.setMuted(!BB.Audio.isMuted());
    store.muted = BB.Audio.isMuted();
    save();
    paintMute();
    BB.Audio.click();
    if (test && !test.done) BB.Audio.motor(true);
  });
  $("help").addEventListener("click", () => $("helpDialog").showModal());
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close()));

  goHome();
  if (!store.seenHelp) {
    store.seenHelp = true;
    save();
    $("helpDialog").showModal();
  }
})();
