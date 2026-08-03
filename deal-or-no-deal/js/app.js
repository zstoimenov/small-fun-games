/* Deal or No Deal — the game itself: setup, whose go it is, and what happens   */
/* next.                                                                        */
/*                                                                              */
/* Everything below is orchestration. The rules live in rules.js, the offers in  */
/* banker.js, the drawing in ui.js; this file only decides what to ask of them   */
/* and in what order.                                                            */
/*                                                                              */
/* Seats are seats, not people. Each one is a human or Robo, each one has its    */
/* own board, and nothing downstream ever asks "are we in one-player mode" — it  */
/* asks whether the seat whose go it is belongs to a person.                     */
/*                                                                              */
/* The rotation is the one thing here that isn't obvious. Deal or No Deal has a  */
/* single contestant, so with two or three players everybody gets their own      */
/* board and play goes round a **round at a time**: you open your five, answer   */
/* the Banker, and hand over. A whole game each in turn would leave two people   */
/* watching for five minutes; a round is three to five taps.                     */
"use strict";

(function () {
  const { Rng, Rules, Banker, Ui, Audio, Tutorial } = window.DND;
  const $ = (id) => document.getElementById(id);

  const SAVE_KEY = "dealOrNoDealSave_v1";
  const BOT_NAME = "Robo";

  // How long things take. The reveal is deliberately quick: a player who has
  // dealt still watches their board play out, and everybody else is waiting.
  const AIM_TO_OPEN = 520;   // the box popping open before play carries on
  const ROBO_STEP = 620;     // Robo taking its go
  const PLAYOUT_STEP = 230;  // the run of boxes at the end
  const HELD_PAUSE = 950;    // the beat before the last box

  /* ── State ─────────────────────────────────────────────────────────────── */

  const state = {
    playerCount: 1,
    board: "full",
    robo: true,
    difficulty: "medium",
    names: ["Player 1", "Player 2", "Player 3"],
    flip: false,
    hints: true,
    muted: false,
    seenHowTo: false,
    tally: { wins: [0, 0, 0], games: 0 },
    best: {},              // biggest win per board size

    players: [],           // { name, kind, game, finished, won }
    seat: 0,
    aim: null,             // the box tapped once and not yet confirmed
    busy: false,           // a box is opening, or Robo is thinking
    playing: false,
    over: false,
    lastThink: null,
    gen: 0                 // bumped on every new game, so a stale timer can't fire into it
  };

  const spec = () => Rules.specOf(state.board);
  const cur = () => state.players[state.seat];
  const curGame = () => (cur() ? cur().game : null);
  const isCpu = (seat) => !!state.players[seat] && state.players[seat].kind === "cpu";
  const humans = () => state.playerCount;
  const nameOf = (i) => (state.names[i] || "").trim() || "Player " + (i + 1);

  // Timers are all routed through here so a new game can invalidate every one of
  // them at once by bumping `gen` — otherwise a reveal from the last game keeps
  // opening boxes on this one.
  function later(fn, ms) {
    const g = state.gen;
    setTimeout(() => { if (g === state.gen) fn(); }, ms);
  }

  /* ── Saving ────────────────────────────────────────────────────────────── */
  // Wrapped in try/catch throughout: private browsing can make localStorage
  // throw on write, and a family game is not worth crashing over.

  let savedGame = null;

  // savedGame is the single record of "there is a game to come back to", and
  // save() refreshes it before writing. Deriving the stored game straight from
  // state instead would blank it every time save() ran with no game in
  // progress — and one of those runs is setMuted() at boot, so the save would
  // never survive being reopened. (Mastermind found this the hard way.)
  function save() {
    if (state.playing && !state.over && state.players.length) {
      savedGame = {
        board: state.board,
        playerCount: state.playerCount,
        robo: state.robo,
        difficulty: state.difficulty,
        names: state.names.slice(),
        flip: state.flip,
        seat: state.seat,
        players: state.players.map((p) => ({
          name: p.name, kind: p.kind, finished: p.finished, won: p.won,
          g: Rules.snapshot(p.game)
        }))
      };
    } else if (state.over) savedGame = null;

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        playerCount: state.playerCount, board: state.board, robo: state.robo,
        difficulty: state.difficulty, names: state.names, flip: state.flip,
        hints: state.hints, muted: state.muted, seenHowTo: state.seenHowTo,
        tally: state.tally, best: state.best, game: savedGame
      }));
    } catch (e) { /* storage unavailable — the game still plays fine */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      for (const k of ["playerCount", "board", "robo", "difficulty", "flip",
        "hints", "muted", "seenHowTo"]) {
        if (s[k] !== undefined) state[k] = s[k];
      }
      if (Array.isArray(s.names)) state.names = s.names;
      if (s.tally && Array.isArray(s.tally.wins)) state.tally = s.tally;
      if (s.best && typeof s.best === "object") state.best = s.best;
      if (s.game && Array.isArray(s.game.players)) savedGame = s.game;
    } catch (e) { /* corrupt or unreadable save — start fresh */ }
  }

  // Validates by replaying: Rules.restore returns null on anything it can't
  // rebuild, so a corrupt save simply makes the Resume button not appear.
  function resumable() {
    if (!savedGame || !savedGame.players || !savedGame.players.length) return false;
    return savedGame.players.every((p) => !!Rules.restore(p.g)) &&
           savedGame.players.some((p) => !p.finished);
  }

  /* ── The setup sheet ───────────────────────────────────────────────────── */

  // One generic single-choice control, used for every option on the sheet.
  function chooser(id, value, onPick) {
    const wrap = $(id);
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest(".opt");
      if (!b) return;
      for (const o of wrap.querySelectorAll(".opt")) o.classList.toggle("on", o === b);
      Audio.tap();
      onPick(b.dataset.value);
    });
    setChooser(id, value);
  }

  function setChooser(id, value) {
    for (const o of $(id).querySelectorAll(".opt")) {
      o.classList.toggle("on", o.dataset.value === String(value));
    }
  }

  function switchCtl(id, value, onPick) {
    const b = $(id);
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-checked") !== "true";
      setSwitch(id, on);
      Audio.tap();
      onPick(on);
    });
    setSwitch(id, value);
  }
  const setSwitch = (id, on) => $(id).setAttribute("aria-checked", on ? "true" : "false");

  // Only the rows that matter right now are on screen. Everything else is either
  // hidden or tucked into the Names fold, which is what keeps a growing list of
  // options from turning into a wall.
  function renderSetup() {
    const solo = state.playerCount === 1;
    const sp = spec();

    // Robo is a rival contestant, so it only makes sense when there is nobody
    // else to be one. Two people already have someone to beat.
    $("roboRow").hidden = !solo;
    $("roboNote").hidden = !(solo && state.robo);
    $("diffRow").hidden = !(solo && state.robo);
    $("diffNote").hidden = !(solo && state.robo);
    setSwitch("roboToggle", state.robo);

    $("countNote").textContent = solo
      ? (state.robo ? "You and Robo, a round each." : "Just you and the Banker.")
      : "Everyone gets their own boxes. You take it in turns, a round at a time.";

    $("boardNote").textContent =
      sp.ladder.length + " boxes, biggest prize " + Rules.money(sp.ladder[sp.ladder.length - 1]) +
      ", " + sp.schedule.length + " calls from the Banker. About " + sp.minutes + ".";

    $("diffNote").textContent = {
      easy: "Robo holds out for a huge offer, so it usually ends up gambling on the last two boxes.",
      medium: "Robo deals when the offer looks fair, and sometimes gets it wrong.",
      hard: "Robo knows the average is propped up by one big box it probably hasn't got."
    }[state.difficulty];

    // Turning the screen around only makes sense with exactly two people at it.
    $("flipRow").hidden = state.playerCount !== 2;
    $("flipNote").hidden = !(state.playerCount === 2 && state.flip);
    setSwitch("flipToggle", state.flip);
    setSwitch("hintToggle", state.hints);

    const names = $("namesWrap");
    names.innerHTML = "";
    for (let i = 0; i < state.playerCount; i++) {
      const row = document.createElement("label");
      row.className = "name-row";
      row.innerHTML = "<span>Player " + (i + 1) + "</span>";
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 12;
      input.value = state.names[i] || "Player " + (i + 1);
      input.addEventListener("input", () => {
        state.names[i] = input.value;
        $("namesSummary").textContent = summaryOf();
        save();
      });
      row.appendChild(input);
      names.appendChild(row);
    }
    $("namesSummary").textContent = summaryOf();

    $("resumeBtn").hidden = !resumable();
    $("startBtn").textContent = resumable() ? "Start a new game" : "Start game ▶";

    function summaryOf() {
      const who = [];
      for (let i = 0; i < state.playerCount; i++) who.push(nameOf(i));
      if (state.playerCount === 1 && state.robo) who.push(BOT_NAME);
      return "Names: " + who.join(", ");
    }
  }

  /* ── Starting a game ───────────────────────────────────────────────────── */

  function makePlayers() {
    const sp = spec();
    const out = [];
    for (let i = 0; i < state.playerCount; i++) {
      out.push({ name: nameOf(i), kind: "human", finished: false, won: 0,
                 game: Rules.newGame(sp, Rng.deal(sp.ladder)) });
    }
    if (state.playerCount === 1 && state.robo) {
      out.push({ name: BOT_NAME, kind: "cpu", finished: false, won: 0,
                 game: Rules.newGame(sp, Rng.deal(sp.ladder)) });
    }
    return out;
  }

  function startGame(fresh) {
    state.gen++;
    state.players = makePlayers();
    state.seat = 0;
    state.aim = null;
    state.busy = false;
    state.playing = true;
    state.over = false;
    state.lastThink = null;
    if (fresh) state.tally = { wins: [0, 0, 0], games: 0 };

    Ui.clearToast();
    Ui.buildBoxes(curGame(), onBoxTap);
    Ui.buildRails(curGame());
    showScreen("game");
    render();
    save();
    maybeRobo();
  }

  function resumeGame() {
    const s = savedGame;
    state.gen++;
    state.board = s.board;
    state.playerCount = s.playerCount;
    state.robo = s.robo;
    state.difficulty = s.difficulty;
    if (Array.isArray(s.names)) state.names = s.names.slice();
    state.flip = s.flip;
    state.players = s.players.map((p) => ({
      name: p.name, kind: p.kind, finished: !!p.finished, won: p.won || 0,
      game: Rules.restore(p.g)
    }));
    state.seat = Math.min(s.seat || 0, state.players.length - 1);
    // Whoever picks the device up is not necessarily whoever put it down, so a
    // resumed game always starts on a seat that still has something to do.
    if (state.players[state.seat].finished) state.seat = nextSeat();
    state.aim = null;
    state.busy = false;
    state.playing = true;
    state.over = false;
    state.lastThink = null;

    Ui.clearToast();
    Ui.buildBoxes(curGame(), onBoxTap);
    Ui.buildRails(curGame());
    showScreen("game");
    render();
    maybeRobo();
    // A game put down on the Banker's call comes back to it.
    if (curGame().phase === "offer") later(() => showOffer(), 400);
  }

  /* ── Screens ───────────────────────────────────────────────────────────── */

  function showScreen(which) {
    $("setup").hidden = which !== "setup";
    $("game").hidden = which !== "game";
    document.body.classList.toggle("in-game", which === "game");
    if (which !== "game") document.body.classList.remove("flipped");
    if (which === "game") {
      fit();
      // Once more after the browser has laid the new screen out — the first call
      // measures a box that is still the old screen's size.
      requestAnimationFrame(fit);
    }
  }

  const fit = () => { if (curGame()) Ui.fit(curGame()); };

  // With two people sitting opposite one device, the whole screen turns around
  // on the second player's turn.
  function shouldFlip() {
    return state.flip && state.playing && !state.over &&
      state.playerCount === 2 && state.seat === 1;
  }

  /* ── Drawing ───────────────────────────────────────────────────────────── */

  function render(justGone) {
    const g = curGame();
    if (!g) return;
    const p = cur();

    $("turnName").textContent = p.name;
    $("turnName").classList.toggle("cpu", p.kind === "cpu");
    $("turnMeta").textContent = metaLine(g);

    Ui.paintBoxes(g, state.aim, state.busy || p.kind === "cpu");
    Ui.paintRails(g, justGone);
    $("myBoxNum").textContent = g.held >= 0 ? String(g.held + 1) : "—";
    $("myBox").hidden = g.held < 0;

    renderScoreStrip();
    renderCoach();
    renderAction();
    $("hintBtn").hidden = !state.hints;
    document.body.classList.toggle("flipped", shouldFlip());
  }

  function metaLine(g) {
    if (g.phase === "pick") return "Choose the box you'll keep";
    if (Rules.isOver(g) || g.phase === "playout") return "Opening the rest";
    if (g.phase === "swap") return "Two boxes left";
    return "Round " + (g.round + 1) + " of " + g.spec.schedule.length;
  }

  function renderScoreStrip() {
    const strip = $("scoreStrip");
    if (state.players.length < 2) { strip.hidden = true; return; }
    strip.hidden = false;
    strip.innerHTML = "";
    state.players.forEach((p, i) => {
      const chip = document.createElement("div");
      chip.className = "score-chip" + (i === state.seat && !p.finished ? " now" : "") +
        (p.finished ? " done" : "");
      const amt = p.finished ? Rules.money(p.won)
        : p.game.dealt !== null ? Rules.money(p.game.dealt) + " ✓" : "…";
      chip.innerHTML = '<span class="who">' + escapeHtml(p.name) + '</span>' +
        '<span class="amt">' + amt + "</span>";
      strip.appendChild(chip);
    });
  }

  function renderCoach() {
    const g = curGame();
    const p = cur();
    const you = p.kind === "cpu" ? p.name : (state.players.length > 1 ? p.name : "You");
    const yourBoxes = p.kind === "cpu" ? "its boxes" : "your boxes";

    if (g.phase === "pick") {
      Ui.coach(p.kind === "cpu"
        ? p.name + " is choosing a box to keep."
        : "Pick a box to keep. Whatever's inside is yours — unless you sell it to the Banker.");
      return;
    }
    if (g.phase === "playout") {
      Ui.coach(g.dealt !== null
        ? "Deal done. Let's see what " + (p.kind === "cpu" ? "it" : "you") + " turned down…"
        : "Opening what's left…");
      return;
    }
    if (g.phase === "swap") {
      Ui.coach("Two boxes left. Keep, or swap?");
      return;
    }
    const left = Rules.leftThisRound(g);
    const tone = left === 1 ? "warn" : null;
    Ui.coach(left === 1
      ? "One more box, then the Banker rings " + (p.kind === "cpu" ? "it" : you) + "."
      : "Open " + left + " of " + yourBoxes + ".", tone);
  }

  function renderAction() {
    const g = curGame();
    const btn = $("actionBtn");
    const cpu = cur().kind === "cpu";
    if (g.phase === "playout" || g.phase === "offer" || g.phase === "swap" || cpu) {
      btn.disabled = true;
      btn.textContent = cpu ? cur().name + " is playing…" : "…";
      return;
    }
    if (state.aim === null) {
      btn.disabled = true;
      btn.textContent = g.phase === "pick" ? "Tap a box to keep it" : "Tap a box to open it";
      return;
    }
    btn.disabled = state.busy;
    btn.textContent = (g.phase === "pick" ? "Keep box " : "Open box ") + (state.aim + 1);
  }

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ── Taking a go ───────────────────────────────────────────────────────── */

  // Two taps to open: the first aims, the second commits. Opening a box cannot
  // be undone — that is the whole drama of the game — so this is the only
  // protection a mis-tap gets, and it has to be there.
  function onBoxTap(i) {
    const g = curGame();
    if (!g || state.busy || cur().kind === "cpu") return;
    if (g.phase === "pick" ? g.opened[i] : !Rules.canOpen(g, i)) return;

    if (state.aim === i) { commit(); return; }
    state.aim = i;
    Audio.aim();
    render();
  }

  function commit() {
    const g = curGame();
    const i = state.aim;
    if (i === null || state.busy) return;

    if (g.phase === "pick") {
      Rules.pickHeld(g, i);
      state.aim = null;
      Audio.tap();
      save();
      render();
      return;
    }
    openBox(i);
  }

  function openBox(i) {
    const g = curGame();
    const value = Rules.open(g, i);
    if (value === null) return;

    state.aim = null;
    state.busy = true;
    const big = value >= Ui.bigMoney(g);
    if (big) Audio.big(); else Audio.small();
    Ui.pop(i);
    render(value);
    if (big && cur().kind !== "cpu") {
      Ui.toast("Ouch — " + Rules.money(value) + " is gone.", 1600);
    }
    save();

    later(() => {
      state.busy = false;
      afterAction();
    }, AIM_TO_OPEN);
  }

  // The one place that decides what happens after any box, deal or swap. Every
  // path — human, Robo, resumed game — comes back through here, so there is one
  // answer to "what now" rather than one per caller.
  function afterAction() {
    const g = curGame();
    if (!g) return;

    if (g.phase === "offer") { showOffer(); return; }
    if (g.phase === "swap") { showSwap(); return; }
    if (g.phase === "playout") { runPlayout(); return; }

    render();
    maybeRobo();
  }

  /* ── The Banker's call ─────────────────────────────────────────────────── */

  function showOffer() {
    const g = curGame();
    const t = Banker.think(g);
    Rules.setOffer(g, t.cents);
    state.lastThink = t;
    save();

    if (cur().kind === "cpu") { roboAnswersOffer(); return; }

    $("offerWho").textContent = state.players.length > 1
      ? "The Banker is on the phone for " + cur().name
      : "The Banker is on the phone";
    $("offerAmount").textContent = Rules.money(t.cents);
    $("offerLine").textContent = t.round >= t.rounds
      ? "His last offer for your box."
      : "That's his offer for your box.";
    $("offerWorking").innerHTML = Ui.working(t);
    $("offerHint").hidden = true;
    $("offerHintBtn").hidden = !state.hints;
    $("offerSheet").hidden = false;
    Audio.phone();
    render();
  }

  function answerOffer(take) {
    const g = curGame();
    $("offerSheet").hidden = true;
    if (take) {
      Rules.takeDeal(g);
      Audio.deal();
      Ui.toast("Deal! " + Rules.money(g.dealt) + " banked.", 2000);
    } else {
      Rules.refuseDeal(g);
      Audio.noDeal();
    }
    save();
    // A deal sends the board straight to its playout; a refusal either starts a
    // new round or leaves the last two boxes to settle, and either way the next
    // player is up.
    if (take) { render(); runPlayout(); return; }
    if (g.phase === "swap") { showSwap(); return; }
    handOver();
  }

  /* ── Keep or swap ──────────────────────────────────────────────────────── */

  function showSwap() {
    const g = curGame();
    if (cur().kind === "cpu") {
      later(() => { Rules.swap(g, Banker.roboSwaps()); save(); render(); runPlayout(); }, ROBO_STEP);
      render();
      return;
    }
    const other = Rules.tableBoxes(g)[0];
    $("swapPair").innerHTML =
      '<div class="swap-box mine"><span>' + (g.held + 1) + "<small>yours</small></span></div>" +
      '<div class="swap-box"><span>' + (other + 1) + "<small>the last one</small></span></div>";
    $("swapLine").textContent = "Box " + (g.held + 1) + " is yours. Box " + (other + 1) +
      " is the only one left on the table.";
    $("swapSheet").hidden = false;
    render();
  }

  function answerSwap(take) {
    $("swapSheet").hidden = true;
    Rules.swap(curGame(), take);
    Audio.tap();
    save();
    render();
    runPlayout();
  }

  /* ── The reveal ────────────────────────────────────────────────────────── */

  // Once a board is settled it opens itself: the boxes left on the table go
  // quickly, then a beat, then the one that was being held. This is the same
  // code whether the player dealt in round two or saw it through to the end,
  // and it is why dealing still shows you what you walked away from.
  function runPlayout() {
    const g = curGame();
    state.busy = true;
    render();

    const step = () => {
      if (Rules.isOver(g)) { finishSeat(); return; }
      const table = Rules.tableBoxes(g);
      if (table.length) {
        const v = Rules.open(g, table[0]);
        Audio.small();
        Ui.pop(table[0]);
        render(v);
        later(step, PLAYOUT_STEP);
        return;
      }
      // The held box, last, with a pause in front of it.
      later(() => {
        const v = Rules.openHeld(g);
        if (v !== null) {
          const big = v >= Ui.bigMoney(g);
          if (big) Audio.big(); else Audio.small();
          Ui.pop(g.held);
          render(v);
        }
        later(finishSeat, HELD_PAUSE);
      }, HELD_PAUSE);
    };
    later(step, PLAYOUT_STEP);
  }

  function finishSeat() {
    const g = curGame();
    const p = cur();
    const r = Rules.result(g);
    p.finished = true;
    p.won = r.won;
    state.busy = false;

    if (p.kind !== "cpu") {
      const line = r.dealt !== null
        ? (r.beatTheBox > 0
            ? "Good deal! Your box had " + Rules.money(r.inBox) + " in it."
            : r.beatTheBox === 0
              ? "Spot on — your box had exactly " + Rules.money(r.inBox) + "."
              : "Oh no — your box had " + Rules.money(r.inBox) + " in it.")
        : "You went all the way and won " + Rules.money(r.won) + ".";
      Ui.toast(line, 2600);
    }
    save();

    const next = nextSeat();
    if (next < 0) { later(endGame, 1400); return; }
    later(() => { state.seat = next; handOverTo(next); }, 1600);
  }

  /* ── Whose go it is ────────────────────────────────────────────────────── */

  function nextSeat() {
    for (let k = 1; k <= state.players.length; k++) {
      const s = (state.seat + k) % state.players.length;
      if (!state.players[s].finished) return s;
    }
    return -1;
  }

  // Called when a round is over. With one player still in it, nothing changes
  // hands and they simply carry on.
  function handOver() {
    const next = nextSeat();
    if (next < 0) { endGame(); return; }
    if (next === state.seat) { render(); maybeRobo(); return; }
    state.seat = next;
    handOverTo(next);
  }

  function handOverTo(seat) {
    state.aim = null;
    state.busy = false;
    save();
    render();
    fit();
    if (!isCpu(seat) && state.players.length > 1) {
      Audio.turn();
      Ui.toast("Over to " + state.players[seat].name + "!", 1800);
    }
    maybeRobo();
  }

  /* ── Robo's go ─────────────────────────────────────────────────────────── */

  function maybeRobo() {
    const g = curGame();
    if (!g || !state.playing || state.over || state.busy) return;
    if (cur().kind !== "cpu") return;

    if (g.phase === "pick") {
      later(() => {
        Rules.pickHeld(g, Rng.int(g.values.length));
        Audio.tap();
        render();
        save();
        maybeRobo();
      }, ROBO_STEP);
      return;
    }
    if (g.phase === "open") {
      later(() => {
        const table = Rules.tableBoxes(g);
        if (!table.length) { afterAction(); return; }
        openBox(table[Rng.int(table.length)]);
      }, ROBO_STEP);
      return;
    }
    if (g.phase === "offer") { showOffer(); return; }
    if (g.phase === "swap") { showSwap(); return; }
    if (g.phase === "playout") { runPlayout(); return; }
  }

  function roboAnswersOffer() {
    const g = curGame();
    const take = Banker.roboDeals(g, state.difficulty);
    Ui.toast(cur().name + " is offered " + Rules.money(g.offers[g.round]) + "…", 1500);
    later(() => {
      if (take) {
        Rules.takeDeal(g);
        Audio.deal();
        Ui.toast(cur().name + " takes the deal — " + Rules.money(g.dealt) + "!", 2000);
        save();
        render();
        runPlayout();
      } else {
        Rules.refuseDeal(g);
        Audio.noDeal();
        Ui.toast(cur().name + " says NO DEAL.", 1600);
        save();
        if (g.phase === "swap") { showSwap(); return; }
        handOver();
      }
    }, ROBO_STEP * 2);
  }

  /* ── The end ───────────────────────────────────────────────────────────── */

  function endGame() {
    state.over = true;
    state.playing = false;
    savedGame = null;

    const rows = state.players
      .map((p, i) => ({ p, i, r: Rules.result(p.game) }))
      .sort((a, b) => b.r.won - a.r.won);
    const top = rows[0].r.won;
    const winners = rows.filter((x) => x.r.won === top);

    // The tally only counts seats a person is sitting in, so a run of games
    // against Robo doesn't turn into a scoreline nobody asked for.
    if (state.players.length > 1) {
      state.tally.games++;
      for (const w of winners) if (w.i < state.tally.wins.length) state.tally.wins[w.i]++;
    }
    const best = state.best[state.board] || 0;
    const mine = Math.max(...state.players.filter((p) => p.kind !== "cpu").map((p) => p.won));
    if (mine > best) state.best[state.board] = mine;

    const solo = state.players.length === 1;
    const won = winners.length === 1 ? winners[0] : null;
    const iWon = winners.some((w) => w.p.kind !== "cpu");

    $("resultIcon").textContent = solo ? (mine >= Ui.bigMoney(curGame()) ? "🏆" : "💼")
      : iWon ? "🏆" : "🤖";
    $("resultTitle").textContent = solo
      ? nameOf(0) + " won " + Rules.money(rows[0].r.won) + "!"
      : winners.length > 1
        ? "It's a tie on " + Rules.money(top) + "!"
        : won.p.name + " wins with " + Rules.money(top) + "!";

    const bestNow = state.best[state.board] || 0;
    $("resultLine").textContent = mine >= bestNow && mine > 0
      ? "That's your best on the " + spec().ladder.length + "-box board."
      : "Your best on this board is " + Rules.money(bestNow) + ".";

    $("resultTable").innerHTML = rows.map((x) => {
      const r = x.r;
      const how = r.dealt !== null
        ? "Dealt in round " + (x.p.game.dealtRound + 1) + " — box had " + Rules.money(r.inBox)
        : (r.swapped ? "Swapped, and won the box" : "Went all the way");
      return '<div class="result-row' + (r.won === top ? " win" : "") + '">' +
        '<div class="who">' + escapeHtml(x.p.name) +
        '<div class="how">' + how + "</div></div>" +
        '<div class="amt">' + Rules.money(r.won) + "</div></div>";
    }).join("");

    renderTally();
    save();
    $("result").hidden = false;
    $("peekPill").hidden = true;
    if (iWon) { Audio.win(); Ui.confetti(); } else Audio.lose();
  }

  function renderTally() {
    const box = $("tallyBox");
    if (state.tally.games < 2 || state.playerCount < 2) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = "";
    for (let i = 0; i < state.playerCount; i++) {
      const row = document.createElement("div");
      row.className = "tally-row";
      row.innerHTML = "<span>" + escapeHtml(nameOf(i)) + "</span>" +
        '<span class="tnum">' + state.tally.wins[i] + "</span>";
      box.appendChild(row);
    }
    const note = document.createElement("div");
    note.className = "tally-note";
    const best = Math.max(...state.tally.wins.slice(0, state.playerCount));
    const leaders = [];
    for (let i = 0; i < state.playerCount; i++) if (state.tally.wins[i] === best) leaders.push(nameOf(i));
    note.textContent = leaders.length === state.playerCount
      ? "All square after " + state.tally.games + " games."
      : leaders.join(" and ") + " ahead after " + state.tally.games + " games.";
    box.appendChild(note);
  }

  /* ── The hint ──────────────────────────────────────────────────────────── */

  function showHint() {
    const g = curGame();
    if (!g || cur().kind === "cpu") return;
    if (g.phase === "offer") {
      const a = Banker.advise(g);
      $("offerHint").textContent = a.text;
      $("offerHint").hidden = false;
      return;
    }
    if (g.phase === "pick") {
      Ui.toast("Any box. They're all exactly as likely to hold the " +
        Rules.money(g.spec.ladder[g.spec.ladder.length - 1]) + ".", 3000);
      return;
    }
    if (g.phase === "open") {
      const t = Banker.think(g);
      const left = Rules.leftThisRound(g);
      Ui.toast("Boxes left average <b>" + Rules.money(Math.round(t.ev)) + "</b>. " +
        (left === 1 ? "The Banker rings after this one." : left + " more, then the Banker rings."), 3000);
      return;
    }
    Ui.toast("Nothing to weigh up — it's a coin toss from here.", 2400);
  }

  /* ── The fairness panel ────────────────────────────────────────────────── */

  function runFairCheck() {
    const out = $("fairOut");
    const boxes = spec().ladder.length;
    out.innerHTML = "<p class='muted'>Dealing 40,000 boards…</p>";
    $("fairBtn").disabled = true;
    // Next frame, so the "dealing" line actually paints before the work starts.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const t = Rng.shuffleTest(boxes, 40000);
      const top = Math.max(...t.counts);
      out.innerHTML =
        "<p class='muted'>Where the " + Rules.money(spec().ladder[boxes - 1]) +
        " ended up, over 40,000 deals. Every bar should be about the same height.</p>" +
        '<div class="fair-grid">' + t.counts.map((c) =>
          '<div class="fair-cell" title="' + c + ' times"><i style="height:' +
          Math.round((c / top) * 100) + '%"></i></div>').join("") + "</div>" +
        "<p class='muted'>Each box got it about <b>" + Math.round(t.expected) +
        "</b> times. Spread score <b>" + t.chi.toFixed(1) + "</b>, and anything under <b>" +
        t.limit + "</b> is what honest shuffling looks like.</p>" +
        '<p class="verdict' + (t.fair ? "" : " bad") + '">' +
        (t.fair ? "✅ Fair — nothing to see here." : "⚠️ Odd result. Run it again.") + "</p>" +
        (t.secure ? "" : "<p class='muted'>(This browser has no cryptographic random " +
          "number generator, so the game fell back to an ordinary one.)</p>");
      $("fairBtn").disabled = false;
    }));
  }

  function renderBankerPanel() {
    const t = state.lastThink;
    $("bankerPanel").hidden = !t;
    if (t) $("bankerWorking").innerHTML = Ui.working(t);
  }

  /* ── Sound ─────────────────────────────────────────────────────────────── */

  function setMuted(v) {
    state.muted = v;
    Audio.setMuted(v);
    $("muteBtn").textContent = v ? "🔇" : "🔊";
    $("menuSound").textContent = v ? "🔇 Sound is off" : "🔊 Sound is on";
    save();
  }

  /* ── Wiring ────────────────────────────────────────────────────────────── */

  function boot() {
    load();

    chooser("countChooser", state.playerCount, (v) => {
      state.playerCount = Number(v);
      state.tally = { wins: [0, 0, 0], games: 0 };
      renderSetup(); save();
    });
    chooser("boardChooser", state.board, (v) => { state.board = v; renderSetup(); save(); });
    chooser("diffChooser", state.difficulty, (v) => { state.difficulty = v; renderSetup(); save(); });
    switchCtl("roboToggle", state.robo, (on) => {
      state.robo = on;
      state.tally = { wins: [0, 0, 0], games: 0 };
      renderSetup(); save();
    });
    switchCtl("flipToggle", state.flip, (on) => { state.flip = on; renderSetup(); save(); });
    switchCtl("hintToggle", state.hints, (on) => { state.hints = on; renderSetup(); save(); });

    $("startBtn").addEventListener("click", () => {
      if (!state.seenHowTo) {
        state.seenHowTo = true;
        save();
        Tutorial.open(() => startGame(true));
        return;
      }
      startGame(true);
    });
    $("resumeBtn").addEventListener("click", () => resumeGame());
    $("howtoBtn").addEventListener("click", () => Tutorial.open());
    $("menuHowto").addEventListener("click", () => { $("menu").hidden = true; Tutorial.open(); });

    $("actionBtn").addEventListener("click", commit);
    $("hintBtn").addEventListener("click", showHint);
    $("offerHintBtn").addEventListener("click", showHint);
    $("dealBtn").addEventListener("click", () => answerOffer(true));
    $("noDealBtn").addEventListener("click", () => answerOffer(false));
    $("keepBtn").addEventListener("click", () => answerSwap(false));
    $("swapBtn").addEventListener("click", () => answerSwap(true));

    $("menuBtn").addEventListener("click", () => {
      renderBankerPanel();
      $("fairOut").innerHTML = "";
      $("menu").hidden = false;
    });
    $("menuClose").addEventListener("click", () => { $("menu").hidden = true; });
    $("menuNew").addEventListener("click", () => {
      $("menu").hidden = true;
      state.gen++;
      state.playing = false;
      savedGame = null;
      showScreen("setup");
      renderSetup();
      save();
    });
    $("menuSound").addEventListener("click", () => setMuted(!state.muted));
    $("muteBtn").addEventListener("click", () => setMuted(!state.muted));
    $("fairBtn").addEventListener("click", runFairCheck);

    $("peekBtn").addEventListener("click", () => {
      $("result").hidden = true;
      $("peekPill").hidden = false;
    });
    $("peekPill").addEventListener("click", () => {
      $("peekPill").hidden = true;
      $("result").hidden = false;
    });
    $("againBtn").addEventListener("click", () => {
      $("result").hidden = true;
      $("peekPill").hidden = true;
      startGame(false);
    });
    $("resultMenu").addEventListener("click", () => {
      $("result").hidden = true;
      $("peekPill").hidden = true;
      state.playing = false;
      showScreen("setup");
      renderSetup();
    });

    Ui.onResize(fit);
    setMuted(state.muted);
    renderSetup();
    showScreen("setup");

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("../sw.js"));
    }
  }

  // Handy from the console, and used by the browser checks.
  window.DND.debug = { state, spec, Rules, Banker, Rng };

  boot();
})();
