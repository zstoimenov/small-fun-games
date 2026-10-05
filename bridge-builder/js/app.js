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
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } report(); };
  const starsOf = (ch, i) => store.stars[ch + "-" + i] || 0;
  const unlocked = (ch, i) => i === 0 || starsOf(ch, i - 1) > 0;
  // Tell the Game Box home page how far you've got, for its stars badge and
  // "Keep playing" row. Opening the game counts as playing it.
  function report() {
    let got = 0, max = 0;
    BB.CHAPTERS.concat(BB.TRAIL).forEach((c) => c.levels.forEach((_, i) => { got += starsOf(c.id, i); max += 3; }));
    try { localStorage.setItem("gamebox:progress:bridge-builder", JSON.stringify({ stars: got, max, at: Date.now() })); } catch (e) { /* ignore */ }
  }
  const chapterById = (id) => BB.CHAPTERS.concat(BB.TRAIL).find((c) => c.id === id);
  // A Bridge Trail world opens once 3 levels of the one before have a star,
  // so one hard level never blocks the trail.
  function worldOpen(k) {
    if (k === 0) return true;
    const prev = BB.TRAIL[k - 1];
    return prev.levels.filter((_, i) => starsOf(prev.id, i) > 0).length >= 3;
  }

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
    ["home", "trail", "chapter", "play", "quiz"].forEach((s) => { $(s).hidden = s !== name; });
    $("back").hidden = name !== "home";
    $("up").hidden = name === "home";
    $("up").innerHTML = "&lsaquo; " + (name === "play" && ch ? ch.kicker : name === "chapter" && ch.trail ? "Trail" : "Home");
    $("title").textContent = name === "home" ? "Bridge Builder"
      : name === "quiz" ? "Bridge Quiz"
      : name === "trail" ? "Bridge Trail"
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
  function openTrail() {
    ch = null;
    BB.UI.trail(starsOf, worldOpen, openChapter);
    show("trail");
  }
  function openChapter(id) {
    ch = chapterById(id);
    BB.UI.chapter(ch, starsOf, unlocked, (i) => play(i));
    show("chapter");
  }

  // ── Building ───────────────────────────────────────────────────────────────
  const parse = (s) => { const [a, b, mat] = s.split(" "); return { a, b, mat, locked: true }; };
  const used = () => members.filter((m) => !m.locked).length;
  const spent = () => Ph.cost(members);
  const coins = () => cfg.budget != null;
  // Stars: 3 at par or better. Budget levels count coins, the rest pieces.
  function starsFor() {
    const n = coins() ? spent() : used();
    return n <= cfg.par ? 3 : n <= cfg.par + (coins() ? Math.max(2, Math.round(cfg.par * 0.15)) : 2) ? 2 : 1;
  }
  const find = (a, b) => members.find((m) => Ph.key(m.a, m.b) === Ph.key(a, b));

  function play(i, again) {
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
    history = [];
    BB.Board.build($("stage"), cfg, { dot: tapDot, piece: tapPiece, empty: tapEmpty, dragStart, dragOver, dragEnd }, ch && ch.theme);
    say("");
    paint();
    // On a phone the brief opens as a card over the river at the start, and
    // the river is fitted round the floating buttons once they are drawn.
    BB.Board.fit();
    brief(!again);
  }

  let sayTimer = 0;
  function say(msg) {
    $("say").textContent = msg;
    // On a phone the message is a bubble over the top line that steps aside
    // after a few seconds; elsewhere it simply stays in the panel.
    $("say").classList.toggle("fresh", !!msg);
    clearTimeout(sayTimer);
    if (msg) sayTimer = setTimeout(() => $("say").classList.remove("fresh"), 4000);
  }
  const floating = () => getComputedStyle($("stage")).getPropertyValue("--float").trim() === "1";
  function brief(open) {
    $("play").classList.toggle("brief-open", open);
    $("goalMore").setAttribute("aria-expanded", String(open));
  }
  $("goalMore").addEventListener("click", () => { BB.Audio.click(); brief(!$("play").classList.contains("brief-open")); });
  // The first touch on the river just closes the brief, so it can't build by accident.
  $("stage").addEventListener("pointerdown", (e) => {
    if (!$("play").classList.contains("brief-open")) return;
    brief(false);
    if (floating()) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  window.addEventListener("resize", () => { if (screen === "play") requestAnimationFrame(BB.Board.fit); });

  function goalStars() {
    const g = $("goalStars");
    const T = Ph.TRUCKS[truckKind];
    const who = '<span class="who">' + T.emoji + " " + T.label + "</span>";
    // Held upright on a phone the pill has room for the stars only; the brief
    // card shows the count and the truck instead.
    $("goalText").dataset.count = (lvl < 0 ? "" : (coins() ? "\u{1FA99} " + spent() + " of " + cfg.budget + " \u{00B7} 3\u{2605} for " + cfg.par : "Pieces: " + used() + " \u{00B7} 3\u{2605} in " + cfg.par) + " \u{00B7} ") + T.emoji + " " + T.label;
    if (lvl < 0) { g.innerHTML = who; return; }
    const count = coins() ? "\u{1FA99} " + spent() + " of " + cfg.budget + " \u{00B7} 3\u{2605} for " + cfg.par
      : "Pieces: " + used() + " \u{00B7} 3\u{2605} in " + cfg.par;
    g.innerHTML = BB.UI.starRow(starsOf(ch.id, lvl)) + " <small>" + count + "</small> " + who;
  }

  // Reachable dots from the picked one, for the glow that shows where to tap.
  function near() {
    if (!selected || tool === "remove") return [];
    return Ph.dots(cfg).filter((id) => !Ph.canJoin(cfg, selected, id, tool));
  }

  function paint() {
    BB.Board.render({ members, selected, near: near(), building: tool !== "remove" });
    BB.UI.controls({ inv, tool, free: !!cfg.free, truck: truckKind, testing: false, undo: history.length > 0, coins: coins() }, act);
    goalStars();
  }

  // Ropes reach further than a dot away; everything else joins neighbours.
  const nextTo = (a, b) => {
    const [x1, y1] = Ph.xy(a), [x2, y2] = Ph.xy(b), r = tool === "rope" ? Ph.ROPE : 1;
    return a !== b && Math.abs(x1 - x2) <= r && Math.abs(y1 - y2) <= r;
  };

  // Every change goes through here so Undo can play it backwards. One step
  // is a list of { add } / { del } changes: a drag is one step however many
  // pieces it built.
  let history = [], change = null;
  function add(m) { members.push(m); inv[m.mat]--; change.push({ add: m }); }
  function del(m) { members.splice(members.indexOf(m), 1); inv[m.mat] = (inv[m.mat] || 0) + 1; change.push({ del: m }); }
  function begin() { change = []; }
  function commit() { if (change && change.length) history.push(change); change = null; }
  function undo() {
    const last = history.pop();
    if (!last) return;
    last.slice().reverse().forEach((c) => {
      if (c.add) { members.splice(members.indexOf(c.add), 1); inv[c.add.mat]++; }
      else { members.push(c.del); inv[c.del.mat]--; }
    });
    selected = null;
    BB.Audio.unplace();
    paint();
  }

  // Build a piece between two neighbouring dots with the picked tool.
  // Building never takes a piece away: the same piece is already there, and
  // a piece in another material swaps (its old one goes back in the box).
  // Returns null when the piece is there now, else what stopped it.
  function join(a, b) {
    const why = Ph.canJoin(cfg, a, b, tool);
    if (why) return why;
    const old = find(a, b);
    if (old && old.mat === tool) return null;
    if (old && old.locked) return "That piece is bolted down. Build around it!";
    if (!(inv[tool] > 0)) return "No " + Ph.MAT[tool].label.toLowerCase() + " left. Take a piece back with \u{1F9FD} Remove.";
    if (coins() && spent() - (old ? Ph.COST[old.mat] : 0) + Ph.COST[tool] > cfg.budget) return "Not enough coins! Use cheaper pieces, or take some back.";
    if (old) del(old);
    add({ a, b, mat: tool });
    BB.Audio.place();
    say("");
    return null;
  }
  function nope(why) { BB.UI.toast(why); BB.Audio.nope(); }

  // Tap one dot, then a neighbour. The second dot stays picked so roads go
  // dot, dot, dot; tap it again or tap the sky to let go.
  function tapDot(id) {
    if (test) return;
    BB.Audio.ready();
    if (tool === "remove") { BB.UI.toast("Tap a piece to take it back."); return; }
    if (!selected || selected === id || !nextTo(selected, id)) {
      selected = selected === id ? null : id;
      if (selected) BB.Audio.pick();
      paint();
      return;
    }
    begin();
    const why = join(selected, id);
    commit();
    if (why) { nope(why); return; }
    // A rope is one long piece, so there's nothing to carry on from.
    selected = tool === "rope" ? null : id;
    paint();
  }

  // Taking a piece back is only ever the Remove tool's job, so a stray tap
  // on a finished bridge never breaks it.
  function tapPiece(m) {
    if (test) return;
    BB.Audio.ready();
    if (tool !== "remove") {
      selected = null;
      paint();
      BB.UI.toast("To take a piece back, pick \u{1F9FD} Remove first.");
      return;
    }
    if (m.locked) { nope("That piece is bolted down."); return; }
    begin();
    del(m);
    commit();
    BB.Audio.unplace();
    paint();
  }

  function tapEmpty() {
    if (test || !selected) return;
    selected = null;
    paint();
  }

  // Drag from a dot: every neighbouring dot the finger reaches gets a piece
  // from the last one. Returns the dot the next piece will start from.
  let dragLast = null, dragSaid = "", ropeTo = null;
  function dragStart(id) {
    if (test || tool === "remove") return null;
    BB.Audio.ready();
    begin();
    dragLast = selected = id;
    dragSaid = "";
    ropeTo = null;
    BB.Audio.pick();
    paint();
    return id;
  }
  function dragOver(id) {
    // A rope stays fixed at its first dot and goes wherever the finger lets go.
    if (tool === "rope") {
      ropeTo = nextTo(dragLast, id) ? id : ropeTo;
      return dragLast;
    }
    const [x1, y1] = Ph.xy(dragLast), [x2, y2] = Ph.xy(id);
    const dx = x2 - x1, dy = y2 - y1;
    // A quick finger can skip a dot on a straight line: fill it in. Anything
    // else waits for the finger to come closer.
    if (!nextTo(dragLast, id) && !(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return dragLast;
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 1; i <= n; i++) {
      const to = Ph.xy(dragLast)[0] + Math.sign(dx) + "," + (Ph.xy(dragLast)[1] + Math.sign(dy));
      const why = join(dragLast, to);
      if (why) {
        // Say each problem once, not on every wiggle of the finger.
        if (why !== dragSaid) { nope(why); dragSaid = why; }
        break;
      }
      dragLast = selected = to;
    }
    paint();
    return dragLast;
  }
  function dragEnd() {
    if (tool === "rope" && ropeTo && !test) {
      const why = join(dragLast, ropeTo);
      if (why) nope(why);
      ropeTo = null;
    }
    const built = change && change.length;
    commit();
    // A drag that built nothing leaves its dot picked, like a tap.
    selected = built ? null : dragLast;
    dragLast = null;
    if (!test) paint();
  }

  function act(what, v) {
    BB.Audio.ready();
    if (what === "tool") {
      tool = v; if (v === "remove") selected = null; BB.Audio.click(); paint();
      // On a phone the parts are just pictures, so picking one names it.
      if (floating()) say(v === "remove" ? "\u{1F9FD} Remove: tap a piece to take it away." : Ph.MAT[v].label + (coins() ? " \u{00B7} \u{1FA99} " + Ph.COST[v] : ""));
    }
    else if (what === "truck") { truckKind = v; BB.Audio.click(); paint(); if (floating()) say(Ph.TRUCKS[v].emoji + " " + Ph.TRUCKS[v].label); }
    else if (what === "undo") undo();
    else if (what === "reset") { BB.Audio.click(); play(lvl, true); }
    else if (what === "test") startTest();
    else if (what === "stop") stopTest();
  }

  // ── The test drive ─────────────────────────────────────────────────────────
  function startTest() {
    selected = null;
    test = {
      ms: members.map((m) => ({ a: m.a, b: m.b, mat: m.mat, locked: m.locked })),
      x: -1.4, move: {}, falling: [], splashes: [], trucks: [],
      state: "drive", first: "", creak: 0, done: false
    };
    test.trucks = Ph.trucksAt(cfg, truckKind, test.x).map((t) => ({ kind: t.kind, x: t.x, y: -12, rot: 0, vy: 0 }));
    const T = Ph.TRUCKS[truckKind];
    say("Here comes the " + T.label.toLowerCase() + (cfg.convoy ? " and friends" : "") + "!");
    BB.Audio.horn();
    BB.Audio.motor(true);
    step(0);
    BB.UI.controls({ testing: true, done: false }, act);
  }

  function stopTest() {
    clearTimeout(winTimer);
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
    if (t.state === "drive") {
      t.x += SPEED * dt;
      const L = Ph.loadsAt(cfg, t.ms, truckKind, t.x);
      if (!L.air) {
        const res = Ph.settle(t.ms, Ph.anchors(cfg), L.loads);
        t.move = res.move;
        drop(res.broke);
      }
      // A truck falls when either axle is over thin air; the rest stop.
      const pos = Ph.trucksAt(cfg, truckKind, t.x);
      const over = (x) => BB.Board.roadY(t.ms, t.move, x) == null;
      let fell = false;
      pos.forEach((p, i) => {
        const tr = t.trucks[i], half = Ph.TRUCKS[p.kind].len / 2;
        if (over(p.x - half) || over(p.x + half) || over(p.x)) { tr.falling = true; tr.vy = 0; fell = true; return; }
        tr.x = p.x;
        tr.y = BB.Board.roadY(t.ms, t.move, p.x);
      });
      if (!fell && Ph.loadsAt(cfg, t.ms, truckKind, t.x).air) { t.trucks[0].falling = true; fell = true; }
      if (fell) {
        t.state = "fall";
        BB.Audio.motor(false);
        if (!t.first) t.first = "There's a gap in the road! The truck needs road all the way across.";
      } else {
        const worst = Math.max(0, ...t.ms.filter((m) => !m.gone).map((m) => m.strain || 0));
        t.creak -= dt;
        if (worst > 0.85 && t.creak <= 0) { BB.Audio.creak(); t.creak = 0.6; }
      }
      // A truck that falls in the frame it reaches the far side has still fallen.
      if (!fell && t.x > Ph.finishX(cfg)) finish(true);
    } else if (t.state === "fall") {
      t.trucks.forEach((tr) => {
        if (!tr.falling) return;
        tr.vy += 900 * dt;
        tr.y += tr.vy * dt;
        tr.x += 0.4 * dt;
        tr.rot += 70 * dt;
        if (tr.y > BB.Board.water && !tr.splashed) {
          tr.splashed = true;
          t.splashes.push({ x: tr.x * U, t: 0 });
          BB.Audio.splash();
          finish(false);
        }
      });
      if (t.trucks.every((tr) => !tr.falling || tr.y > BB.Board.water + 80)) t.state = "sunk";
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
    BB.Board.render({ members: t.ms, move: t.move, testing: true, trucks: t.trucks.filter((tr) => tr.y < BB.Board.water + 60), falling: t.falling, splashes: t.splashes });
  }

  function finish(ok) {
    const t = test;
    if (t.done) return;
    t.done = true;
    BB.Audio.motor(false);
    if (!ok) {
      say((ch && ch.theme === "desert" ? "\u{1F4A5} Crash! " : "\u{1F4A6} Splash! ") + (t.first || "The bridge wasn't strong enough."));
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
    const n = coins() ? spent() : used();
    const got = starsFor();
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
    $("winText").textContent = cfg.win + (got < 3 ? coins() ? " (You spent " + n + " coins. Can you do it for " + cfg.par + "?)"
      : " (You used " + n + " pieces. Can you do it with " + cfg.par + "?)" : "");
    const last = lvl === ch.levels.length - 1;
    $("winNext").innerHTML = last ? "What I learned &rsaquo;" : "Next level &rsaquo;";
    $("winDialog").showModal();
  }

  // Esc would close the card without moving on, leaving a finished level with
  // no Next button; the card waits for one of its own buttons instead. Browsers
  // don't always let a page refuse Esc, so a card that Esc does close opens again.
  {
    const win = $("winDialog");
    let escAt = 0;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && win.open) escAt = Date.now(); }, true);
    win.addEventListener("cancel", (e) => e.preventDefault());
    win.addEventListener("close", () => { if (Date.now() - escAt < 1000) { escAt = 0; win.showModal(); } });
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
  $("lessonOk").addEventListener("click", () => {
    $("lessonDialog").close();
    if (ch && ch.trail) openTrail(); else goHome();
  });
  $("trailBtn").addEventListener("click", openTrail);
  $("freeBtn").addEventListener("click", () => { ch = null; play(-1); });
  $("jobsBtn").addEventListener("click", () => $("jobsDialog").showModal());
  $("up").addEventListener("click", () => {
    if (screen === "play" && ch) openChapter(ch.id);
    else if (screen === "chapter" && ch.trail) openTrail();
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

  // ── Keyboard ───────────────────────────────────────────────────────────────
  // 1-9 pick a part, R Remove, Ctrl+Z undo, Space test, Esc let go of a dot
  // (or stop a test). Enter on a focused button still presses that button.
  document.addEventListener("keydown", (e) => {
    if (screen !== "play" || document.querySelector("dialog[open]")) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") { e.preventDefault(); if (!test) act("undo"); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (test) {
      if (k === "Escape" || (test.done && k === " ")) { e.preventDefault(); act("stop"); }
      return;
    }
    if (/^[1-9]$/.test(k)) { const t = Object.keys(inv)[+k - 1]; if (t) act("tool", t); return; }
    if (k === "r" || k === "R") { act("tool", "remove"); return; }
    if (k === "Escape") { tapEmpty(); return; }
    if (k === " " || (k === "Enter" && !(e.target.closest && e.target.closest("button")))) { e.preventDefault(); act("test"); }
  });
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
