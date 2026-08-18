/* Cube Timer — what happens, and when.                                          */
/*                                                                              */
/* The scrambles live in scramble.js, the averages in stats.js, the drawing in   */
/* ui.js. This file owns one thing: the state the pad is in, and what a finger   */
/* landing on it means right now.                                               */
/*                                                                              */
/* The pad's states, in order:                                                  */
/*                                                                              */
/*   idle ──press──▶ hold ──400ms──▶ ready ──release──▶ run ──press──▶ done      */
/*     ▲               │                                                        */
/*     └───release─────┘   let go too early and nothing happens                 */
/*                                                                              */
/* Two details are worth the words. The clock starts on RELEASE and stops on     */
/* PRESS, which is what every cubing timer does and what hands expect — you are  */
/* already moving when the clock starts. And the press that stops the clock      */
/* cannot begin the next hold, because a hold only ever begins on a press that   */
/* arrives while the pad is idle; the stop leaves it in `done` until the finger  */
/* comes up. Without that, one enthusiastic tap ends a solve and starts another. */
"use strict";

(function () {
  const { Scramble, Stats, Store, Audio, Ui } = window.CT;
  const $ = Ui.$;

  // How long the hold has to last before the pad goes green. Long enough that a
  // brush of the screen can't start a solve, short enough not to feel like a
  // wait — this is the number to nudge if it ever feels wrong on a real tablet.
  const HOLD_MS = 400;

  const INSPECT_MS = 15000;      // the competition's fifteen seconds
  const INSPECT_PLUS_TWO = 15000;
  const INSPECT_DNF = 17000;

  const state = {
    phase: "idle",     // idle | inspect | hold | ready | run | done
    preHold: "idle",   // what to fall back to if the hold is abandoned
    scramble: [],
    startAt: 0,
    shown: -1,         // last tenth painted, so the digits aren't rewritten 60x a second
    raf: 0,
    holdTimer: 0,
    inspectFrom: 0,
    inspectRaf: 0,
    inspectPips: 0,    // which inspection calls have already sounded
    inspectPenalty: "",
    last: null,        // { who, puzzle, index } — what the +2 / DNF buttons act on
    race: null,        // { round, scores, turn, times, log, target }
    wakeLock: null
  };

  const data = Store.load();

  /* ── Odds and ends ─────────────────────────────────────────────────────── */

  const soloWho = () => data.who;
  const puzzle = () => data.puzzle;
  const isRace = () => data.mode === "race" && !!state.race;
  // In a race the person at the pad changes every solve; on your own it's you.
  const cubing = () => (isRace() ? (state.race.turn === 0 ? data.who : data.who2) : soloWho());
  const solves = () => Store.solves(cubing(), puzzle());

  function show(id, on) { $(id).hidden = !on; }

  let toastTimer = 0;
  function toast(text) {
    const t = $("toast");
    t.textContent = text;
    t.hidden = false;
    t.classList.add("up");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove("up");
      setTimeout(() => { t.hidden = true; }, 300);
    }, 1900);
  }

  // A tablet that dims halfway through a solve is a ruined solve. Best effort:
  // where the browser has no wake lock, nothing here breaks.
  function keepAwake(on) {
    try {
      if (on && navigator.wakeLock && !state.wakeLock) {
        navigator.wakeLock.request("screen").then((l) => { state.wakeLock = l; }).catch(() => {});
      } else if (!on && state.wakeLock) {
        state.wakeLock.release().catch(() => {});
        state.wakeLock = null;
      }
    } catch (e) { /* not available — carry on */ }
  }

  /* ── Drawing ───────────────────────────────────────────────────────────── */

  function newScramble() {
    state.scramble = Scramble.generate(puzzle());
    drawScramble();
  }

  function drawScramble() {
    const p = Scramble.PUZZLES[puzzle()];
    Ui.renderScramble($("scramble"), state.scramble);
    Ui.renderNet($("net"), Scramble.grids(Scramble.scrambled(puzzle(), state.scramble)), p.size);
  }

  function drawStats() {
    const list = solves();
    Ui.renderStats(list);
    Ui.renderSpark($("spark"), list);
  }

  function drawHeader() {
    $("whoName").textContent = Store.nameOf(cubing());
    $("puzzleName").textContent = Scramble.PUZZLES[puzzle()].label;
    if (isRace()) {
      const r = state.race;
      $("raceSideA").querySelector(".race-name").textContent = Store.nameOf(data.who);
      $("raceSideB").querySelector(".race-name").textContent = Store.nameOf(data.who2);
      $("raceSideA").querySelector(".race-score").textContent = r.scores[0];
      $("raceSideB").querySelector(".race-score").textContent = r.scores[1];
      $("raceSideA").classList.toggle("turn", r.turn === 0);
      $("raceSideB").classList.toggle("turn", r.turn === 1);
      $("raceRound").textContent = "Round " + r.round + " of " + data.bestOf;
    }
    show("raceBar", isRace());
    show("newScrambleBtn", !isRace());
  }

  function setPhase(p) {
    state.phase = p;
    const pad = $("pad");
    ["idle", "inspect", "hold", "ready", "run", "done"].forEach((c) => pad.classList.toggle(c, c === p));
    // Everything but the clock gets out of the way while a solve is on.
    document.body.classList.toggle("solving", p === "run" || p === "inspect" || p === "ready");
    $("padHint").textContent =
      p === "hold" ? "Keep holding…" :
      p === "ready" ? "Let go!" :
      p === "run" ? "Tap to stop" :
      p === "inspect" ? "Hold when you're ready" :
      p === "done" ? (isRace() ? "" : "Hold for your next go") :
      data.inspection ? "Tap to look first" : "Hold to start";
  }

  /* ── The clock ─────────────────────────────────────────────────────────── */

  function paintRunning() {
    const ms = performance.now() - state.startAt;
    const tenth = Math.floor(ms / 100);
    if (tenth !== state.shown) {
      state.shown = tenth;
      $("time").textContent = Stats.formatRunning(ms);
    }
    state.raf = requestAnimationFrame(paintRunning);
  }

  function startSolve() {
    stopInspection();
    state.startAt = performance.now();
    state.shown = -1;
    setPhase("run");
    keepAwake(true);
    $("time").textContent = "0.0";
    state.raf = requestAnimationFrame(paintRunning);
  }

  function stopSolve() {
    cancelAnimationFrame(state.raf);
    const ms = performance.now() - state.startAt;
    setPhase("done");
    keepAwake(false);
    Audio.stop();
    record(ms, state.inspectPenalty);
    state.inspectPenalty = "";
  }

  /* ── Inspection ────────────────────────────────────────────────────────── */

  function startInspection() {
    state.inspectFrom = performance.now();
    state.inspectPips = 0;
    state.inspectPenalty = "";
    setPhase("inspect");
    tickInspection();
  }

  function tickInspection() {
    const gone = performance.now() - state.inspectFrom;
    const left = Math.ceil((INSPECT_MS - gone) / 1000);
    // Eight seconds gone, then twelve — the two calls a judge makes.
    if (gone >= 8000 && state.inspectPips < 1) { state.inspectPips = 1; Audio.pip(2); }
    if (gone >= 12000 && state.inspectPips < 2) { state.inspectPips = 2; Audio.pip(3); }
    if (gone >= INSPECT_DNF) {
      state.inspectPenalty = "dnf";
      $("time").textContent = "DNF";
      if (state.inspectPips < 4) { state.inspectPips = 4; Audio.buzz(); }
    } else if (gone >= INSPECT_PLUS_TWO) {
      state.inspectPenalty = "+2";
      $("time").textContent = "+2";
      if (state.inspectPips < 3) { state.inspectPips = 3; Audio.buzz(); }
    } else {
      $("time").textContent = String(Math.max(0, left));
    }
    state.inspectRaf = requestAnimationFrame(tickInspection);
  }

  function stopInspection() {
    cancelAnimationFrame(state.inspectRaf);
    state.inspectRaf = 0;
  }

  /* ── Recording a solve ─────────────────────────────────────────────────── */

  function record(ms, penalty) {
    const who = cubing();
    const solve = {
      ms: Math.round(ms),
      penalty: penalty || "",
      scramble: state.scramble.slice(),
      at: Date.now()
    };
    const index = Store.addSolve(who, puzzle(), solve);
    state.last = { who: who, puzzle: puzzle(), index: index };

    $("time").textContent = Stats.format(Stats.effective(solve));
    drawStats();
    showAfterRow(true);

    if (isRace()) {
      state.race.times[state.race.turn] = solve;
      $("nextBtn").hidden = false;
    } else {
      $("nextBtn").hidden = true;
      celebrate(who, index);
      newScramble();
    }
  }

  // Only a real best gets the tune: a first solve is a best by default, and
  // saying so every time would make the word meaningless.
  function celebrate(who, index) {
    const list = Store.solves(who, puzzle());
    if (list.length > 1 && Stats.isPersonalBest(list, index)) {
      Audio.best();
      toast("🏅 New best time!");
    }
  }

  function showAfterRow(on) {
    // Out of sight, not out of the layout — see the note in index.html.
    $("afterRow").classList.toggle("gone", !on);
    if (!on) return;
    const s = lastSolve();
    $("plusTwoBtn").classList.toggle("on", !!s && s.penalty === "+2");
    $("dnfBtn").classList.toggle("on", !!s && s.penalty === "dnf");
  }

  function lastSolve() {
    if (!state.last) return null;
    const list = Store.solves(state.last.who, state.last.puzzle);
    return list[state.last.index] || null;
  }

  // The penalty buttons toggle: tap +2 again and it comes off, because the
  // commonest use of them is fixing a tap you didn't mean.
  function penalise(kind) {
    if (!state.last) return;
    const s = lastSolve();
    if (!s) return;
    const next = s.penalty === kind ? "" : kind;
    Store.updateSolve(state.last.who, state.last.puzzle, state.last.index, { penalty: next });
    Audio.tap();
    $("time").textContent = Stats.format(Stats.effective(lastSolve()));
    if (isRace()) state.race.times[state.race.turn] = lastSolve();
    drawStats();
    showAfterRow(true);
  }

  function binLast() {
    if (!state.last) return;
    Store.removeSolve(state.last.who, state.last.puzzle, state.last.index);
    Audio.tap();
    if (isRace()) state.race.times[state.race.turn] = null;
    state.last = null;
    $("time").textContent = "0.00";
    showAfterRow(false);
    drawStats();
    // In a race the go still has to happen, so the round waits for a real time.
    if (isRace()) $("nextBtn").hidden = true;
  }

  /* ── The pad ───────────────────────────────────────────────────────────── */

  function padDown(e) {
    if (e.cancelable) e.preventDefault();
    if (state.phase === "run") { stopSolve(); return; }
    if (state.phase !== "idle" && state.phase !== "inspect" && state.phase !== "done") return;
    // A press while the last time is still on screen is the start of the next
    // solve, so the after-row goes away and the digits reset.
    if (state.phase === "done") {
      if (isRace()) return;                  // in a race, Next → moves things on
      showAfterRow(false);
      $("time").textContent = "0.00";
      setPhase("idle");
    }
    state.preHold = state.phase;
    setPhase("hold");
    Audio.hold();
    clearTimeout(state.holdTimer);
    state.holdTimer = setTimeout(() => {
      if (state.phase === "hold") { setPhase("ready"); Audio.ready(); }
    }, HOLD_MS);
  }

  function padUp() {
    clearTimeout(state.holdTimer);
    if (state.phase === "ready") { startSolve(); return; }
    if (state.phase !== "hold") return;
    // Let go too soon. With inspection on, that quick tap is how you ask for
    // your fifteen seconds; without it, nothing happens at all.
    if (state.preHold === "idle" && data.inspection) startInspection();
    else setPhase(state.preHold);
  }

  /* ── Racing ────────────────────────────────────────────────────────────── */
  /* Both cubers get the SAME scramble each round, which is the only way a race
   * is fair, and it is also why the cube is passed over rather than re-mixed:
   * the handover screen shows the same moves again for whoever is next. */

  function startRace() {
    state.race = {
      round: 1,
      scores: [0, 0],
      turn: 0,
      times: [null, null],
      log: [],
      // First to more than half the rounds — 2 of 3, 3 of 5 — and it can end early.
      target: Math.floor(data.bestOf / 2) + 1
    };
    newScramble();
    beginTurn(0, true);
  }

  function beginTurn(turn, quiet) {
    state.race.turn = turn;
    state.last = null;
    state.inspectPenalty = "";
    showAfterRow(false);
    $("nextBtn").hidden = true;
    $("time").textContent = "0.00";
    setPhase("idle");
    drawHeader();
    drawStats();
    if (!quiet) {
      // Whoever goes first in a round gets new moves; whoever goes second gets
      // the same ones again, and saying so is the whole reason this screen is
      // here — the race is only fair if both cubes start the same way.
      $("handoverName").textContent = Store.nameOf(cubing()) + "'s go";
      $("handoverNote").textContent = turn === 0
        ? "New moves this round. Mix the cube up, then hand it over."
        : "Mix the cube up the same way — " + Store.nameOf(cubing()) + " gets the very same one.";
      Ui.renderScramble($("handoverScramble"), state.scramble);
      show("handover", true);
    }
  }

  function afterRaceSolve() {
    const r = state.race;
    if (r.turn === 0) { beginTurn(1, false); return; }

    // Both have been, so the round has a result.
    const a = r.times[0], b = r.times[1];
    const ta = Stats.effective(a), tb = Stats.effective(b);
    let winner = -1;                                  // -1 is a tie
    if (ta === null && tb === null) winner = -1;
    else if (ta === null) winner = 1;
    else if (tb === null) winner = 0;
    else if (ta < tb) winner = 0;
    else if (tb < ta) winner = 1;
    if (winner >= 0) r.scores[winner]++;
    r.log.push({ times: [a, b], winner: winner });

    Audio.point();
    $("roundTitle").textContent = "Round " + r.round;
    $("roundTimes").textContent = "";
    [[data.who, ta], [data.who2, tb]].forEach((pair, i) => {
      const row = document.createElement("div");
      row.className = "round-row" + (winner === i ? " won" : "");
      row.innerHTML = '<span class="round-who"></span><span class="round-time"></span>';
      row.querySelector(".round-who").textContent = Store.nameOf(pair[0]);
      row.querySelector(".round-time").textContent = Stats.format(pair[1]);
      $("roundTimes").appendChild(row);
    });
    $("roundNote").textContent =
      winner < 0 ? "Dead heat — nobody takes this one." :
      Store.nameOf(winner === 0 ? data.who : data.who2) + " takes the round.";

    const done = r.scores[0] >= r.target || r.scores[1] >= r.target || r.round >= data.bestOf;
    $("roundGo").textContent = done ? "See who won" : "Next round";
    drawHeader();
    show("round", true);
  }

  function nextRound() {
    const r = state.race;
    const done = r.scores[0] >= r.target || r.scores[1] >= r.target || r.round >= data.bestOf;
    if (done) { endRace(); return; }
    r.round++;
    r.times = [null, null];
    newScramble();
    beginTurn(0, false);
  }

  function endRace() {
    const r = state.race;
    const lead = r.scores[0] === r.scores[1] ? -1 : (r.scores[0] > r.scores[1] ? 0 : 1);
    $("overEmoji").textContent = lead < 0 ? "🤝" : "🏆";
    $("overTitle").textContent = lead < 0
      ? "It's a draw!"
      : Store.nameOf(lead === 0 ? data.who : data.who2) + " wins!";
    $("overTimes").textContent = "";
    [0, 1].forEach((i) => {
      const who = i === 0 ? data.who : data.who2;
      const mine = r.log.map((l) => l.times[i]).filter(Boolean);
      const b = Stats.best(mine);
      const row = document.createElement("div");
      row.className = "round-row" + (lead === i ? " won" : "");
      row.innerHTML = '<span class="round-who"></span><span class="round-time"></span>';
      row.querySelector(".round-who").textContent = Store.nameOf(who) + " — " + r.scores[i];
      row.querySelector(".round-time").textContent = b === null ? "–" : "best " + Stats.format(b);
      $("overTimes").appendChild(row);
    });
    $("overNote").textContent = "Every one of those times is saved under your own name.";
    Audio.win();
    show("round", false);
    show("over", true);
  }

  /* ── Screens ───────────────────────────────────────────────────────────── */

  function openSetup() {
    // Whatever was going on, stop it — the menu is also the panic button.
    cancelAnimationFrame(state.raf);
    stopInspection();
    keepAwake(false);
    state.race = null;
    state.last = null;
    setPhase("idle");
    show("app", false);
    show("setup", true);
    drawSetup();
  }

  function drawSetup() {
    Ui.setChooser("puzzleChooser", data.puzzle);
    Ui.setChooser("modeChooser", data.mode);
    Ui.setChooser("bestOfChooser", data.bestOf);
    Ui.setSwitch("inspectToggle", data.inspection);
    Ui.setSwitch("soundToggle", data.sound);

    const race = data.mode === "race";
    $("whoLabel").textContent = race ? "First cuber" : "Who's cubing?";
    show("who2Row", race);
    show("who2Note", race);
    show("bestOfRow", race);

    Ui.renderChips($("whoChips"), Store.cubers(), data.who, {
      max: Store.MAX_CUBERS, onAdd: true, onRemove: true, taken: race ? data.who2 : ""
    });
    if (race) {
      Ui.renderChips($("who2Chips"), Store.cubers(), data.who2, {
        max: Store.MAX_CUBERS, onAdd: true, onRemove: false, taken: data.who
      });
    }
    // You can't race yourself, and you can't race nobody.
    $("startBtn").disabled = race && (!data.who2 || data.who2 === data.who);
    $("startBtn").textContent = race ? "Start the race" : "Start timing";
  }

  function startTiming() {
    show("setup", false);
    show("app", true);
    showAfterRow(false);
    $("time").textContent = "0.00";
    state.last = null;
    if (data.mode === "race") {
      startRace();
    } else {
      state.race = null;
      newScramble();
      drawHeader();
      drawStats();
      setPhase("idle");
    }
  }

  function openTimes() {
    const who = cubing();
    $("timesTitle").textContent = Store.nameOf(who) + "'s " + Scramble.PUZZLES[puzzle()].label + " times";
    Ui.renderTimes($("timesList"), Store.solves(who, puzzle()));
    show("times", true);
  }

  let detailIndex = -1;
  function openDetail(index) {
    const list = solves();
    const s = list[index];
    if (!s) return;
    detailIndex = index;
    $("detailTime").textContent = Stats.format(Stats.effective(s));
    $("detailWhen").textContent = "Solve #" + (index + 1) + " · " + Ui.when(s.at);
    Ui.renderScramble($("detailScramble"), s.scramble || []);
    show("detail", true);
  }

  function detailAct(change) {
    const who = cubing();
    if (detailIndex < 0) return;
    if (change === "bin") Store.removeSolve(who, puzzle(), detailIndex);
    else Store.updateSolve(who, puzzle(), detailIndex, { penalty: change });
    // Editing an old solve can move the one the after-row points at, so the
    // safest thing is to let go of it entirely.
    if (state.last && state.last.who === who && state.last.puzzle === puzzle()) {
      if (change === "bin" && detailIndex <= state.last.index) state.last = null;
    }
    Audio.tap();
    show("detail", false);
    if (!state.last) showAfterRow(false);
    drawStats();
    Ui.renderTimes($("timesList"), Store.solves(who, puzzle()));
  }

  /* ── Wiring ────────────────────────────────────────────────────────────── */

  function wire() {
    // Setup sheet
    Ui.chooser("puzzleChooser", (v) => { Store.set("puzzle", v); drawSetup(); });
    Ui.chooser("modeChooser", (v) => { Store.set("mode", v); drawSetup(); });
    Ui.chooser("bestOfChooser", (v) => { Store.set("bestOf", Number(v)); });
    $("inspectToggle").addEventListener("click", () => {
      Store.set("inspection", !data.inspection);
      Ui.setSwitch("inspectToggle", data.inspection);
    });
    $("soundToggle").addEventListener("click", () => {
      Store.set("sound", !data.sound);
      Ui.setSwitch("soundToggle", data.sound);
      Audio.setMuted(!data.sound);
      if (data.sound) Audio.ready();
    });
    $("startBtn").addEventListener("click", startTiming);
    $("howBtn").addEventListener("click", () => show("howto", true));
    $("howClose").addEventListener("click", () => show("howto", false));

    // Picking people. One handler per row, because the chips are redrawn often.
    $("whoChips").addEventListener("click", (e) => chipClick(e, "who"));
    $("who2Chips").addEventListener("click", (e) => chipClick(e, "who2"));

    // The timer screen
    $("menuBtn").addEventListener("click", openSetup);
    $("listBtn").addEventListener("click", openTimes);
    $("newScrambleBtn").addEventListener("click", () => { newScramble(); Audio.tap(); });
    $("plusTwoBtn").addEventListener("click", () => penalise("+2"));
    $("dnfBtn").addEventListener("click", () => penalise("dnf"));
    $("binBtn").addEventListener("click", binLast);
    $("nextBtn").addEventListener("click", afterRaceSolve);

    // The pad. Pointer events cover mouse, touch and pen in one path; the
    // window-level release matters because a finger often slides off the pad.
    const pad = $("pad");
    pad.addEventListener("pointerdown", padDown);
    window.addEventListener("pointerup", padUp);
    window.addEventListener("pointercancel", padUp);
    pad.addEventListener("contextmenu", (e) => e.preventDefault());

    // A keyboard, for whoever is timing on a laptop. Space is the cubing world's
    // timer key, so it does exactly what the pad does.
    window.addEventListener("keydown", (e) => {
      if (e.code !== "Space" || e.repeat) return;
      if ($("app").hidden || openOverlay()) return;
      e.preventDefault();
      padDown(e);
    });
    window.addEventListener("keyup", (e) => {
      if (e.code !== "Space" || $("app").hidden) return;
      e.preventDefault();
      padUp();
    });

    // Times and one-solve sheets
    $("timesClose").addEventListener("click", () => show("times", false));
    $("timesList").addEventListener("click", (e) => {
      const row = e.target.closest(".time-row");
      if (row) openDetail(Number(row.dataset.index));
    });
    $("clearBtn").addEventListener("click", () => {
      Store.clearSolves(cubing(), puzzle());
      state.last = null;
      showAfterRow(false);
      drawStats();
      Ui.renderTimes($("timesList"), []);
    });
    $("detailClose").addEventListener("click", () => show("detail", false));
    $("detailPlusTwo").addEventListener("click", () => detailAct("+2"));
    $("detailDnf").addEventListener("click", () => detailAct("dnf"));
    $("detailClean").addEventListener("click", () => detailAct(""));
    $("detailBin").addEventListener("click", () => detailAct("bin"));

    // Race sheets
    $("handoverGo").addEventListener("click", () => show("handover", false));
    $("roundGo").addEventListener("click", () => { show("round", false); nextRound(); });
    $("overAgain").addEventListener("click", () => { show("over", false); startRace(); });
    $("overMenu").addEventListener("click", () => { show("over", false); openSetup(); });

    // Adding a name
    $("namerOk").addEventListener("click", addName);
    $("namerCancel").addEventListener("click", () => show("namer", false));
    $("namerInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addName(); });
  }

  const openOverlay = () =>
    ["setup", "howto", "times", "detail", "handover", "round", "over", "namer"].some((id) => !$(id).hidden);

  let namingFor = "who";
  function chipClick(e, field) {
    const add = e.target.closest("[data-add]");
    if (add) {
      namingFor = field;
      $("namerInput").value = "";
      show("namer", true);
      setTimeout(() => $("namerInput").focus(), 50);
      return;
    }
    const x = e.target.closest("[data-remove]");
    if (x) { Store.removeCuber(x.dataset.remove); drawSetup(); return; }
    const chip = e.target.closest(".chip");
    if (!chip || chip.disabled) return;
    Store.set(field, chip.dataset.id);
    drawSetup();
  }

  function addName() {
    const id = Store.addCuber($("namerInput").value);
    if (id) Store.set(namingFor, id);
    show("namer", false);
    drawSetup();
  }

  /* ── Go ────────────────────────────────────────────────────────────────── */

  Audio.setMuted(!data.sound);
  wire();
  drawSetup();
  // A first-timer gets the four steps without having to go looking for them.
  if (!data.seenHowTo) { show("howto", true); Store.set("seenHowTo", true); }
})();
