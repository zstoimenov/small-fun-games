/* Yatzy Dice — the game itself: setup, whose turn it is, and what happens next. */
/*                                                                              */
/* Everything below is orchestration. The rules live in rules.js, the drawing in */
/* ui.js, the opponent in ai.js and the dice in rng.js; this file only decides   */
/* what to ask of them and in what order.                                        */
"use strict";

(function () {
  const { Rules, Rng, Ai, Ui, Audio, Tutorial } = window.YZ;
  const $ = (id) => document.getElementById(id);

  const SAVE_KEY = "yatzyDiceSave_v2";

  /* ── State ─────────────────────────────────────────────────────────────── */

  const state = {
    rulesetId: "eu",     // Yatzy EU is the default; "us" is the 13-box game
    mode: "play",        // "play" = app dice, "card" = scorecard only
    entryMode: "dice",   // scorecard-only: tap in dice, or type the score
    difficulty: "medium",
    playerCount: 1,
    cpuCount: 1,
    names: ["Player 1", "Player 2", "Player 3"],
    players: [],
    turn: 0,
    dice: [],
    held: [false, false, false, false, false],
    rollsLeft: 3,
    rolled: false,
    busy: false,
    guided: false,
    canHold: false,
    canPick: false,
    preview: null,
    muted: false,
    seenHowTo: false,
    playing: false,
    flip: false,         // turn the screen around between two human players
    hideFilled: false    // drop boxes everyone has already scored
  };

  function ruleset() { return Rules.get(state.rulesetId); }
  function current() { return state.players[state.turn]; }

  /* ── Saving ────────────────────────────────────────────────────────────── */
  // Wrapped up in try/catch throughout: private browsing can make localStorage
  // throw on write, and a family game is not worth crashing over.

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        rulesetId: state.rulesetId, mode: state.mode, entryMode: state.entryMode,
        difficulty: state.difficulty, playerCount: state.playerCount, cpuCount: state.cpuCount,
        names: state.names, muted: state.muted, seenHowTo: state.seenHowTo,
        flip: state.flip, hideFilled: state.hideFilled,
        game: state.playing && !state.guided ? {
          players: state.players.map((p) => ({
            name: p.name, kind: p.kind, difficulty: p.difficulty, card: p.card
          })),
          turn: state.turn, dice: state.dice, held: state.held,
          rollsLeft: state.rollsLeft, rolled: state.rolled
        } : null
      }));
    } catch (e) { /* storage unavailable — the game still plays fine */ }
  }

  let saved = null;
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      saved = s.game || null;
      for (const k of ["rulesetId", "mode", "entryMode", "difficulty", "playerCount",
                       "cpuCount", "muted", "seenHowTo", "flip", "hideFilled"]) {
        if (s[k] !== undefined) state[k] = s[k];
      }
      if (Array.isArray(s.names)) state.names = s.names;
    } catch (e) { /* corrupt or unreadable save — start fresh */ }
  }

  function resumable() {
    if (!saved || !saved.players || !saved.players.length) return false;
    const rs = ruleset();
    return saved.players.some((p) => !Rules.isComplete(rs, p.card));
  }

  /* ── Setup screen ──────────────────────────────────────────────────────── */

  // One generic single-choice control, used for every option on the setup sheet.
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

  function setSwitch(id, on) {
    $(id).setAttribute("aria-checked", on ? "true" : "false");
  }

  // Only the rows that matter right now are on screen. Everything else is either
  // hidden or tucked into the Names fold, which is what keeps a growing list of
  // options from turning into a wall.
  function renderSetup() {
    const solo = state.playerCount === 1;
    const play = state.mode === "play";
    const rs = ruleset();

    // A computer can't pick up your real dice, so solo scorecard mode is just
    // score-keeping. Say so instead of quietly hiding the option.
    $("cpuRow").hidden = !(solo && play);
    $("diffRow").hidden = !(solo && play);
    $("soloNote").hidden = !(solo && !play);

    // Turning the screen around only makes sense with exactly two people at it.
    $("flipRow").hidden = state.playerCount !== 2;
    $("flipNote").hidden = !(state.playerCount === 2 && state.flip);
    setSwitch("flipToggle", state.flip);

    $("rulesNote").textContent = rs.blurb;

    const names = $("namesWrap");
    names.innerHTML = "";
    const shown = [];
    for (let i = 0; i < state.playerCount; i++) {
      const label = state.names[i] || "Player " + (i + 1);
      shown.push(label);
      const row = document.createElement("label");
      row.className = "name-row";
      row.innerHTML = "<span>Player " + (i + 1) + "</span>";
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 12;
      input.value = label;
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
      return "Names: " + shown.map((n, i) => state.names[i] || n).join(", ");
    }
  }

  /* ── Starting a game ───────────────────────────────────────────────────── */

  function makePlayers() {
    const rs = ruleset();
    const players = [];
    for (let i = 0; i < state.playerCount; i++) {
      players.push({
        name: (state.names[i] || "").trim() || "Player " + (i + 1),
        kind: "human",
        difficulty: null,
        card: Rules.emptyCard(rs)
      });
    }
    if (state.playerCount === 1 && state.mode === "play") {
      const bots = ["Robo", "Bolt"];
      for (let i = 0; i < state.cpuCount; i++) {
        players.push({
          name: bots[i],
          kind: "cpu",
          difficulty: state.difficulty,
          card: Rules.emptyCard(rs)
        });
      }
    }
    return players;
  }

  function startGame() {
    state.players = makePlayers();
    state.turn = 0;
    state.guided = false;
    state.playing = true;
    Ui.clearToast();
    newTurn();
    showScreen("game");
    render();
    save();
    maybeCpu();
  }

  function resumeGame() {
    state.players = saved.players.map((p) => ({
      name: p.name, kind: p.kind, difficulty: p.difficulty,
      card: { scores: p.card.scores, jokers: p.card.jokers || 0, manual: p.card.manual || {} }
    }));
    state.turn = Math.min(saved.turn || 0, state.players.length - 1);
    state.dice = saved.dice || [];
    state.held = saved.held || [false, false, false, false, false];
    state.rollsLeft = saved.rollsLeft === undefined ? 3 : saved.rollsLeft;
    state.rolled = !!saved.rolled;
    state.guided = false;
    state.playing = true;
    updateDerived();
    showScreen("game");
    render();
    maybeCpu();
  }

  function newTurn() {
    state.dice = [];
    state.held = [false, false, false, false, false];
    state.rollsLeft = 3;
    state.rolled = false;
    state.busy = false;
    Ui.resetCardScroll();
    updateDerived();
  }

  /* ── Derived state: what can be tapped, and what it would score ────────── */

  function updateDerived() {
    const rs = ruleset();
    const p = current();
    if (!p) return;
    const complete = state.dice.length === 5 && state.dice.every((v) => v >= 1 && v <= 6);
    const human = p.kind === "human";

    state.canHold = state.mode === "play" && complete && state.rollsLeft > 0 && human && !state.busy;
    state.canPick = human && !state.busy &&
      (complete || (state.mode === "card" && state.entryMode === "type"));

    if (complete) {
      const scores = Rules.scoreAll(state.dice, rs, p.card);
      const legalCats = Rules.legalCategories(rs, p.card, state.dice);
      // The ringed suggestion is the box a strong player would take, not simply
      // the biggest number — otherwise the hint would point at Chance all game
      // and teach exactly the wrong habit. Same judgement the Hard opponent uses.
      const best = legalCats.length
        ? Ai.chooseCategory({ ruleset: rs, card: p.card, dice: state.dice, rollsLeft: 0, difficulty: "hard" })
        : null;
      state.preview = { scores: scores, legal: legalCats.map((c) => c.id), best: best };
    } else {
      state.preview = null;
    }
  }

  // Two people sitting opposite each other share one device: on the second
  // player's turn the whole screen turns around so it faces them.
  function flipWanted() {
    return state.flip && state.playing && !state.guided &&
      state.players.length === 2 &&
      state.players.every((p) => p.kind === "human") &&
      state.turn === 1;
  }

  function applyFlip() {
    document.body.classList.toggle("flipped", flipWanted());
  }

  function showScreen(name) {
    Ui.showScreen(name);
    if (name !== "game") document.body.classList.remove("flipped");
  }

  function render() {
    updateDerived();
    Ui.renderTurn(state);
    Ui.renderScorecard(state);
    Ui.coach(state.guided ? coachLine() : null);
    applyFlip();
  }

  /* ── Rolling ───────────────────────────────────────────────────────────── */

  function roll() {
    if (state.busy || state.rollsLeft <= 0 || state.mode !== "play") return;
    const p = current();
    if (p.kind !== "human") return;
    doRoll(() => {
      render();
    });
  }

  // The faces are drawn here, once, before a single frame of animation runs.
  function doRoll(after) {
    const next = state.rolled ? Rng.rollKept(state.dice, state.held) : Rng.roll(5);
    state.rollsLeft--;
    state.rolled = true;
    state.busy = true;
    state.canHold = false;
    state.canPick = false;
    Audio.roll();
    Ui.renderDice(state.dice, state.held, { canHold: false });
    Ui.animateRoll(state.held, next, () => {
      state.dice = next;
      state.busy = false;
      Audio.land();
      after();
    });
  }

  function hold(i) {
    if (!state.canHold) return;
    state.held[i] = !state.held[i];
    if (state.held[i]) Audio.hold(); else Audio.release();
    Ui.renderDice(state.dice, state.held, { canHold: true });
    if (state.guided) Ui.coach(coachLine());
  }

  /* ── Scoring a box ─────────────────────────────────────────────────────── */

  function pick(catId) {
    if (!state.canPick || !state.preview) return;
    if (state.preview.legal.indexOf(catId) < 0) return;
    finishTurn(catId, state.preview.scores[catId], false);
  }

  function finishTurn(catId, points, manual) {
    const rs = ruleset();
    const p = current();
    const cat = Rules.categoryById(rs, catId);
    const res = Rules.commit(rs, p.card, catId, points, {
      dice: state.dice.length === 5 ? state.dice : null,
      manual: manual
    });

    if (points === 0) Audio.zero();
    else if (cat && cat.big) { Audio.fanfare(); Ui.confetti(); }
    else Audio.score();

    let msg = (p.kind === "cpu" ? "🤖 " : "") + p.name + ": " + cat.label + " — <b>" + points + "</b>";
    if (res.extraBonus) {
      msg += " and another " + rs.topName + "! <b>+" + res.extraBonus + "</b>";
      Audio.bonus();
      Ui.confetti();
    }
    Ui.toast(msg);

    if (state.guided) {
      Ui.coach("That's a turn! You put those dice in <b>" + cat.label + "</b> for " + points + ".");
      setTimeout(endPractice, 2200);
      return;
    }

    save();

    if (state.players.every((pl) => Rules.isComplete(rs, pl.card))) {
      state.playing = false;
      save();
      render();
      setTimeout(() => {
        Audio.win();
        Ui.showResult(state);
      }, 700);
      return;
    }

    state.turn = (state.turn + 1) % state.players.length;
    newTurn();
    render();
    save();
    if (current().kind === "human" && state.players.length > 1) Audio.turn();
    maybeCpu();
  }

  /* ── The computer's turn ───────────────────────────────────────────────── */

  function maybeCpu() {
    const p = current();
    if (!p || p.kind !== "cpu" || !state.playing) return;
    state.busy = true;
    render();
    setTimeout(cpuRoll, 750);
  }

  function cpuRoll() {
    if (!state.playing) return;
    doRoll(() => {
      state.busy = true; // still the computer's turn
      updateDerived();
      Ui.renderTurn(state);
      Ui.renderScorecard(state);
      setTimeout(cpuThink, 600);
    });
  }

  function cpuThink() {
    const p = current();
    const rs = ruleset();
    if (state.rollsLeft > 0) {
      const held = Ai.chooseHolds({
        ruleset: rs, card: p.card, dice: state.dice,
        rollsLeft: state.rollsLeft, difficulty: p.difficulty
      });
      state.held = held;
      Ui.renderDice(state.dice, state.held, { canHold: false });
      if (held.every(Boolean)) {
        setTimeout(cpuPick, 700); // happy with the hand, no need to roll again
        return;
      }
      setTimeout(cpuRoll, 750);
      return;
    }
    cpuPick();
  }

  function cpuPick() {
    const p = current();
    const rs = ruleset();
    const id = Ai.chooseCategory({
      ruleset: rs, card: p.card, dice: state.dice, rollsLeft: 0, difficulty: p.difficulty
    });
    const points = Rules.scoreAll(state.dice, rs, p.card)[id];
    state.busy = false;
    finishTurn(id, points, false);
  }

  /* ── Scorecard-only entry ──────────────────────────────────────────────── */

  function addEntry(v) {
    if (state.dice.length >= 5) return;
    state.dice = state.dice.concat([v]);
    Audio.tap();
    if (state.dice.length === 5) Audio.land();
    render();
  }

  function unsetEntry(i) {
    if (i >= state.dice.length) return;
    state.dice = state.dice.slice(0, i).concat(state.dice.slice(i + 1));
    Audio.release();
    render();
  }

  function clearEntry() {
    state.dice = [];
    Audio.release();
    render();
  }

  function toggleEntry() {
    state.entryMode = state.entryMode === "type" ? "dice" : "type";
    if (state.entryMode === "type") state.dice = [];
    Audio.tap();
    save();
    render();
  }

  /* ── Typing a score by hand ────────────────────────────────────────────── */

  let typingCat = null;

  function typeScore(catId) {
    const rs = ruleset();
    const cat = Rules.categoryById(rs, catId);
    typingCat = catId;
    $("typeTitle").textContent = cat.label;
    $("typeHint").textContent = cat.hint;
    $("typeInput").value = "";
    $("typeSheet").hidden = false;
    setTimeout(() => $("typeInput").focus(), 50);
  }

  function confirmType() {
    const raw = $("typeInput").value.trim();
    const n = parseInt(raw, 10);
    if (raw === "" || isNaN(n) || n < 0 || n > 999) {
      Ui.toast("Type a number from 0 upwards");
      return;
    }
    $("typeSheet").hidden = true;
    const id = typingCat;
    typingCat = null;
    finishTurn(id, n, true);
  }

  /* ── The guided practice turn ──────────────────────────────────────────── */

  // Runs the ordinary turn code with state.guided set, so the practice can never
  // drift out of step with the real game — it *is* the real game, not scored.
  function startPractice() {
    state.players = [{ name: "You", kind: "human", difficulty: null, card: Rules.emptyCard(ruleset()) }];
    state.turn = 0;
    state.guided = true;
    state.playing = true;
    state.mode = "play";
    newTurn();
    showScreen("game");
    render();
  }

  function endPractice() {
    state.guided = false;
    state.playing = false;
    Ui.coach(null);
    showScreen("setup");
    renderSetup();
    Ui.toast("Ready when you are — pick your players and start a game.");
  }

  function coachLine() {
    if (state.mode !== "play") return "Tap in the dice you rolled on the table.";
    if (!state.rolled) return "Tap <b>ROLL THE DICE</b> to throw all five.";
    if (state.rollsLeft > 0) {
      const c = Rules.counts(state.dice);
      let face = 1;
      for (let f = 2; f <= 6; f++) if (c[f] > c[face]) face = f;
      if (c[face] >= 2) {
        return "You've got " + c[face] + " × " + face + ". Tap those dice to keep them, then roll again.";
      }
      return "Nothing matches yet. Keep the dice you like and roll the rest again.";
    }
    return "Out of rolls. Tap a score in the card below — the <span class='howto-ring'>ringed</span> box is the one we'd go for.";
  }

  /* ── Menu, sound, dice check ───────────────────────────────────────────── */

  function renderHideFilled() {
    const b = $("hideFilledBtn");
    b.setAttribute("aria-pressed", state.hideFilled ? "true" : "false");
    b.textContent = state.hideFilled ? "👀 Show every box" : "🙈 Hide filled boxes";
  }

  function toggleHideFilled() {
    state.hideFilled = !state.hideFilled;
    Audio.tap();
    renderHideFilled();
    save();
    render();
  }

  function setMuted(v) {
    state.muted = v;
    Audio.setMuted(v);
    $("muteBtn").textContent = v ? "🔇" : "🔊";
    $("menuSound").textContent = v ? "🔇 Sound is off" : "🔊 Sound is on";
    save();
  }

  function runDiceCheck() {
    const out = $("diceCheckOut");
    out.innerHTML = "<p class='muted'>Rolling 60,000 dice…</p>";
    // Let the browser paint the message before the loop takes the thread.
    setTimeout(() => {
      const r = Rng.test(60000);
      const max = Math.max.apply(null, r.counts);
      const bars = document.createElement("div");
      bars.className = "hist";
      r.counts.forEach((c, i) => {
        const col = document.createElement("div");
        col.className = "hist-col";
        const bar = document.createElement("div");
        bar.className = "hist-bar";
        bar.style.height = Math.round((c / max) * 100) + "%";
        col.appendChild(bar);
        const lab = document.createElement("span");
        lab.className = "hist-label";
        lab.textContent = i + 1;
        col.appendChild(lab);
        const num = document.createElement("span");
        num.className = "hist-num";
        num.textContent = c;
        col.appendChild(num);
        bars.appendChild(col);
      });
      out.innerHTML = "";
      out.appendChild(bars);
      const verdict = document.createElement("p");
      verdict.className = r.fair ? "verdict good" : "verdict bad";
      verdict.innerHTML = (r.fair
        ? "✅ <b>Even spread.</b> These dice are fair."
        : "⚠️ <b>Unusual spread.</b> Worth running again — this happens by chance about 1 time in 20.") +
        "<br><span class='muted'>Chi-squared " + r.chi.toFixed(2) + " (fair is under 11.07). " +
        (r.secure
          ? "Dice come from your device's cryptographic random generator."
          : "This browser has no crypto random source, so a weaker fallback is in use.") +
        "</span>";
      out.appendChild(verdict);
    }, 30);
  }

  function openHowTo() {
    Tutorial.open(state.rulesetId, {
      practice: state.playing && !state.guided ? null : startPractice,
      onClose: () => { if (state.playing && !state.guided) maybeCpu(); }
    });
  }

  /* ── Wiring ────────────────────────────────────────────────────────────── */

  function wire() {
    chooser("rulesetChooser", state.rulesetId, (v) => { state.rulesetId = v; save(); renderSetup(); });
    chooser("modeChooser", state.mode, (v) => { state.mode = v; save(); renderSetup(); });
    chooser("countChooser", state.playerCount, (v) => { state.playerCount = +v; save(); renderSetup(); });
    chooser("cpuChooser", state.cpuCount, (v) => { state.cpuCount = +v; save(); });
    chooser("diffChooser", state.difficulty, (v) => { state.difficulty = v; save(); });

    $("startBtn").addEventListener("click", startGame);
    $("resumeBtn").addEventListener("click", resumeGame);
    $("howtoBtn").addEventListener("click", openHowTo);

    $("menuBtn").addEventListener("click", () => { $("menu").hidden = false; });
    $("menuClose").addEventListener("click", () => { $("menu").hidden = true; });
    $("menuSound").addEventListener("click", () => setMuted(!state.muted));
    $("menuHowto").addEventListener("click", () => { $("menu").hidden = true; openHowTo(); });
    $("diceCheckBtn").addEventListener("click", runDiceCheck);
    $("menuNew").addEventListener("click", () => {
      $("menu").hidden = true;
      state.playing = false;
      save();
      showScreen("setup");
      renderSetup();
    });

    $("muteBtn").addEventListener("click", () => setMuted(!state.muted));
    $("helpBtn").addEventListener("click", openHowTo);
    $("hideFilledBtn").addEventListener("click", toggleHideFilled);
    $("flipToggle").addEventListener("click", () => {
      state.flip = !state.flip;
      Audio.tap();
      save();
      renderSetup();
    });

    $("helpClose").addEventListener("click", () => { $("help").hidden = true; });
    $("typeCancel").addEventListener("click", () => { $("typeSheet").hidden = true; typingCat = null; });
    $("typeOk").addEventListener("click", confirmType);
    $("typeInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmType(); });

    $("againBtn").addEventListener("click", () => { $("result").hidden = true; startGame(); });
    $("resultMenu").addEventListener("click", () => {
      $("result").hidden = true;
      showScreen("setup");
      renderSetup();
    });

    // Tapping the dim backdrop closes any sheet that can be dismissed.
    for (const id of ["help", "menu", "typeSheet"]) {
      $(id).addEventListener("click", (e) => { if (e.target === $(id)) $(id).hidden = true; });
    }

    Ui.init({
      hold: hold,
      roll: roll,
      pick: pick,
      catHelp: (id) => Ui.showHelp(id, state.rulesetId),
      typeScore: typeScore,
      addEntry: addEntry,
      unsetEntry: unsetEntry,
      clearEntry: clearEntry,
      toggleEntry: toggleEntry
    });
    Tutorial.init();
  }

  /* ── Boot-time sanity check ────────────────────────────────────────────── */

  // Runs on every load. If a scoring function ever gets edited into something
  // wrong, this says so in the console immediately rather than three rounds in.
  function selfTest() {
    const problems = Rules.selfTest();
    for (const rsId of ["us", "eu"]) {
      const rs = Rules.get(rsId);
      const card = Rules.emptyCard(rs);
      const dice = Rng.roll(5);
      for (const d of dice) if (d < 1 || d > 6) problems.push("rng produced " + d);
      const id = Ai.chooseCategory({ ruleset: rs, card: card, dice: dice, rollsLeft: 0, difficulty: "hard" });
      if (!Rules.categoryById(rs, id)) problems.push("ai chose unknown category " + id + " in " + rsId);
    }
    if (problems.length) console.error("Yatzy Dice self-test failed:\n" + problems.join("\n"));
    return problems;
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */

  load();
  wire();
  setMuted(state.muted);
  setChooser("rulesetChooser", state.rulesetId);
  setChooser("modeChooser", state.mode);
  setChooser("countChooser", state.playerCount);
  setChooser("cpuChooser", state.cpuCount);
  setChooser("diffChooser", state.difficulty);
  renderHideFilled();
  renderSetup();
  showScreen("setup");
  selfTest();

  if (!state.seenHowTo) {
    state.seenHowTo = true;
    save();
    Tutorial.open(state.rulesetId, { practice: startPractice });
  }

  // Console hooks, in the spirit of the other games in the box.
  window.YZ.debug = {
    state: state,
    rulesSelfTest: () => {
      const p = Rules.selfTest();
      console.log(p.length ? p.join("\n") : "rules OK");
      return p;
    },
    diceTest: (n) => {
      const r = Rng.test(n || 60000);
      console.log("chi-squared", r.chi.toFixed(2), r.fair ? "(fair)" : "(unusual)", r.counts.join(" / "));
      return r;
    },
    aiTest: (games, rs, diff) => {
      const r = Ai.benchmark(games || 20, rs || "eu", diff || "hard");
      console.log(r.games + " games, average " + r.avg.toFixed(1) + ", best " + r.best + ", worst " + r.worst);
      return r;
    },
    startPractice: startPractice
  };

  if ("serviceWorker" in navigator) {
    addEventListener("load", () => navigator.serviceWorker.register("../sw.js").catch(() => {}));
  }
})();
