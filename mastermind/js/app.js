/* Mastermind — the game itself: setup, whose job is whose, and what happens next.*/
/*                                                                              */
/* Everything below is orchestration. The rules live in rules.js, the drawing in */
/* ui.js, the code breaker in ai.js; this file only decides what to ask of them  */
/* and in what order.                                                            */
/*                                                                              */
/* Seats are *jobs*, not people. Somebody sets the code and somebody breaks it,  */
/* and each of those two is either a human or the computer — which is all four   */
/* ways of playing this game, including two people passing one tablet. Nothing   */
/* downstream ever asks "are we in one-player mode"; it asks whether the breaker */
/* is a person.                                                                  */
"use strict";

(function () {
  const { Rules, Ai, Ui, Audio, Tutorial } = window.MM;
  const $ = (id) => document.getElementById(id);

  const SAVE_KEY = "mastermindSave_v1";
  const BOT_NAME = "Robo";

  /* ── State ─────────────────────────────────────────────────────────────── */

  const state = {
    playerCount: 1,
    role: "break",       // one-player only: which job the human takes
    difficulty: "medium",
    preset: "classic",
    names: ["Player 1", "Player 2"],
    flip: false,         // turn the board round to face whoever is guessing
    hints: true,         // count what still fits, warn, and offer the hint button
    shapes: true,        // a shape on every peg as well as a colour
    muted: false,
    seenHowTo: false,
    tally: { goes: [0, 0], rounds: [0, 0] },
    best: {},            // fewest goes so far, keyed by puzzle size and job

    game: null,
    solver: null,        // mirrors game.rows — what still fits, for hints and Robo
    setter: null,
    breaker: null,
    draft: [],           // the row being built, -1 for an empty slot
    slot: 0,
    playing: false,
    busy: false,         // pegs are landing, or the opponent is thinking
    over: false,
    lastThink: null,     // what the solver did on its last go, for the menu
    setterSeat: 0,       // two players: which of the two set this round's code
    gen: 0               // bumped on every new game, so a stale timer can't fire into it
  };

  const spec = () => Rules.specOf(state.preset);
  const solo = () => state.playerCount === 1;
  const cpuBreaks = () => !!state.breaker && state.breaker.kind === "cpu";
  const nameOf = (seat) => (state.names[seat] || "").trim() || "Player " + (seat + 1);
  const bestKey = () => state.preset + ":" + (solo() ? state.role : "duo");

  /* ── Saving ────────────────────────────────────────────────────────────── */
  // Wrapped in try/catch throughout: private browsing can make localStorage
  // throw on write, and a family game is not worth crashing over.

  let savedGame = null;

  // savedGame is the single record of "there is a game to come back to", and
  // save() refreshes it before writing. Deriving the stored game straight from
  // state instead would blank it every time save() ran with no game in
  // progress — and one of those runs is setMuted() at boot, so the save would
  // never survive being reopened.
  function save() {
    if (state.playing && !state.over) savedGame = Rules.snapshot(state.game);
    else if (state.over) savedGame = null;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        playerCount: state.playerCount, role: state.role, difficulty: state.difficulty,
        preset: state.preset, names: state.names, flip: state.flip, hints: state.hints,
        shapes: state.shapes, muted: state.muted, seenHowTo: state.seenHowTo,
        tally: state.tally, best: state.best, setterSeat: state.setterSeat,
        // The code plus the guesses is the whole game — the pegs are worked out
        // again on the way back in, so a saved game can never show feedback that
        // disagrees with its own code.
        game: savedGame
      }));
    } catch (e) { /* storage unavailable — the game still plays fine */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      for (const k of ["playerCount", "role", "difficulty", "preset", "flip",
        "hints", "shapes", "muted", "seenHowTo", "setterSeat"]) {
        if (s[k] !== undefined) state[k] = s[k];
      }
      if (Array.isArray(s.names)) state.names = s.names;
      if (s.tally && Array.isArray(s.tally.goes)) state.tally = s.tally;
      if (s.best && typeof s.best === "object") state.best = s.best;
      if (s.game) savedGame = s.game;
    } catch (e) { /* corrupt or unreadable save — start fresh */ }
  }

  // Validates by replaying: Rules.restore returns null on anything it can't
  // rebuild, so a corrupt save simply makes the Resume button not appear.
  const resumable = () => !!savedGame && !!Rules.restore(savedGame);

  /* ── The setup sheet ───────────────────────────────────────────────────── */

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

  const PRESET_NOTES = {
    easy: "3 slots, 12 goes, and no colour used twice. The gentlest one.",
    classic: "4 slots, 10 goes, 6 colours, and a colour can turn up more than once. " +
      "1,296 possible codes.",
    tricky: "5 slots, 10 goes, repeats allowed. 7,776 possible codes — you'll need " +
      "every one of those goes."
  };

  const DIFF_NOTES = {
    easy: "Only looks at the black pegs and ignores the white ones, so it wanders " +
      "about a bit. Usually gets there in about seven goes.",
    medium: "Uses every peg it's given, but doesn't think about which guess would " +
      "tell it the most. About five goes.",
    hard: "Knuth's method: whatever you hide, it never needs more than five goes. " +
      "Beating it means making it use all five."
  };

  function renderSetup() {
    const isSolo = solo();

    $("roleRow").hidden = !isSolo;
    $("roleNote").hidden = !isSolo;
    $("roleNote").textContent = state.role === "break"
      ? BOT_NAME + " hides a code and you work it out."
      : "You hide a code and " + BOT_NAME + " works it out. See how long you can hold it off.";

    // The computer only has a difficulty when it is the one guessing — hiding a
    // code takes no skill, so the row would be a lie in the other direction.
    const showDiff = isSolo && state.role === "set";
    $("diffRow").hidden = !showDiff;
    $("diffNote").hidden = !showDiff;
    $("diffNote").textContent = DIFF_NOTES[state.difficulty];

    $("presetNote").textContent = PRESET_NOTES[state.preset];

    $("flipRow").hidden = isSolo;
    $("flipNote").hidden = !(!isSolo && state.flip);
    setSwitch("flipToggle", state.flip);
    setSwitch("hintToggle", state.hints);
    setSwitch("shapeToggle", state.shapes);
    document.body.classList.toggle("no-shapes", !state.shapes);

    $("namesBox").hidden = isSolo;
    const names = $("namesWrap");
    names.innerHTML = "";
    for (let i = 0; i < 2; i++) {
      const row = document.createElement("label");
      row.className = "name-row";
      row.innerHTML = "<span>" + (i === 0 ? "This side" : "Opposite") + "</span>";
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 12;
      input.value = state.names[i] || "Player " + (i + 1);
      input.addEventListener("input", () => {
        state.names[i] = input.value;
        $("namesSummary").textContent = nameSummary();
        save();
      });
      row.appendChild(input);
      names.appendChild(row);
    }
    $("namesSummary").textContent = nameSummary();

    $("resumeBtn").hidden = !resumable();
    $("startBtn").textContent = resumable() ? "Start a new game" : "Start game ▶";
  }

  const nameSummary = () => "Names: " + nameOf(0) + " and " + nameOf(1);

  function showScreen(which) {
    $("setup").hidden = which !== "setup";
    $("game").hidden = which !== "game";
    $("setcode").hidden = which !== "setcode";
    document.body.classList.toggle("in-game", which === "game");
    if (which === "game") Ui.fit();
    else document.body.classList.remove("flipped");
  }

  /* ── Setting a code ────────────────────────────────────────────────────── */

  let pickSlots = [], pickSwatches = [], pickDraft = [], pickAt = 0;

  function openPick() {
    const sp = spec();
    pickDraft = new Array(sp.pegs).fill(-1);
    pickAt = 0;
    pickSlots = Ui.pickRow(sp.pegs, onPickSlot);
    pickSwatches = Ui.pickPalette(onPickColour);

    const forBot = state.setter.kind === "human" && cpuBreaks();
    $("pickTitle").textContent = forBot ? "Your secret code" : state.setter.name + ", set a code";
    $("pickSub").textContent = forBot
      ? "Build a row for " + BOT_NAME + " to crack. Repeats are allowed if you fancy it."
      : "Build a row for " + state.breaker.name + " to crack. Don't let them see.";

    $("pickStep").hidden = false;
    $("handStep").hidden = true;
    showScreen("setcode");
    renderPick();
  }

  function onPickSlot(p) {
    // Tapping the slot you are already on empties it — one rule, no long press.
    if (pickAt === p && pickDraft[p] >= 0) { pickDraft[p] = -1; Audio.clear(); }
    else Audio.tap();
    pickAt = p;
    renderPick();
  }

  function onPickColour(c) {
    const sp = spec();
    if (!sp.repeats && pickDraft.some((v, i) => i !== pickAt && v === c)) { Audio.nope(); return; }
    pickDraft[pickAt] = c;
    Audio.place(pickAt);
    pickAt = nextEmpty(pickDraft, pickAt, sp.pegs);
    renderPick();
  }

  // Move on to the next gap, wrapping round, so filling a row is one tap a peg.
  function nextEmpty(draft, from, pegs) {
    for (let i = 1; i <= pegs; i++) {
      const p = (from + i) % pegs;
      if (draft[p] < 0) return p;
    }
    return from;
  }

  function renderPick() {
    const sp = spec();
    for (let p = 0; p < sp.pegs; p++) {
      Ui.fillPeg(pickSlots[p].firstChild, pickDraft[p]);
      pickSlots[p].classList.toggle("sel", p === pickAt);
    }
    for (let c = 0; c < pickSwatches.length; c++) {
      pickSwatches[c].disabled =
        !sp.repeats && pickDraft.some((v, i) => i !== pickAt && v === c);
    }
    const full = !pickDraft.includes(-1);
    $("pickDone").disabled = !full;
    $("pickWarn").hidden = sp.repeats;
    $("pickWarn").textContent = sp.repeats ? "" : "This puzzle doesn't allow the same colour twice.";
  }

  function pickConfirmed() {
    if (pickDraft.includes(-1)) { Audio.nope(); return; }
    // Against the computer there is nobody to hide it from, so skip the handover.
    if (cpuBreaks()) { begin(pickDraft.slice()); return; }
    $("pickStep").hidden = true;
    $("handStep").hidden = false;
    $("handTitle").textContent = "Pass it to " + state.breaker.name;
    $("handSub").textContent = state.setter.name + "'s code is hidden. " +
      state.breaker.name + " — you've got " + spec().guesses + " goes.";
    Audio.turn();
  }

  /* ── Starting, resuming, finishing ─────────────────────────────────────── */

  function makePlayers() {
    if (solo()) {
      const you = { name: "You", kind: "human", seat: 0 };
      const bot = { name: BOT_NAME, kind: "cpu", seat: 1 };
      return state.role === "break"
        ? { setter: bot, breaker: you }
        : { setter: you, breaker: bot };
    }
    const s = state.setterSeat;
    return {
      setter: { name: nameOf(s), kind: "human", seat: s },
      breaker: { name: nameOf(1 - s), kind: "human", seat: 1 - s }
    };
  }

  function startGame(fresh) {
    state.gen++;
    if (fresh) {
      state.tally = { goes: [0, 0], rounds: [0, 0] };
      state.setterSeat = 0;
    }
    savedGame = null;
    const players = makePlayers();
    state.setter = players.setter;
    state.breaker = players.breaker;
    $("result").hidden = true;

    if (state.setter.kind === "human") openPick();
    else begin(Rules.randomCode(spec()));
  }

  function begin(secret) {
    const sp = spec();
    state.game = Rules.newGame(sp, secret);
    state.solver = Ai.solver(sp);
    state.draft = new Array(sp.pegs).fill(-1);
    state.slot = 0;
    state.playing = true;
    state.busy = false;
    state.over = false;
    state.lastThink = null;

    Ui.build(sp, pickSlot, pickColour);
    Ui.clearWin();
    Ui.clearToast();
    showScreen("game");
    refresh();
    save();
    afterTurn();
  }

  function resumeGame() {
    const g = Rules.restore(savedGame);
    if (!g) return;
    state.gen++;
    state.preset = g.spec.id;
    const players = makePlayers();
    state.setter = players.setter;
    state.breaker = players.breaker;

    state.game = g;
    state.solver = Ai.replay(g.spec, g.rows);
    state.draft = new Array(g.spec.pegs).fill(-1);
    state.slot = 0;
    state.playing = true;
    state.busy = false;
    state.over = false;
    state.lastThink = null;

    Ui.build(g.spec, pickSlot, pickColour);
    Ui.clearWin();
    showScreen("game");
    refresh();
    afterTurn();
  }

  /* ── Whose go, and what it says ────────────────────────────────────────── */

  function refresh() {
    const g = state.game;
    if (!g) return;
    const mine = !state.busy && !state.over && state.breaker.kind === "human";

    $("turnName").textContent = cpuBreaks()
      ? BOT_NAME + " is guessing"
      : solo() ? "Crack the code" : state.breaker.name + "'s go";
    $("turnName").classList.toggle("cpu", cpuBreaks());

    const left = Rules.goesLeft(g);
    let meta = left + (left === 1 ? " go left" : " goes left");
    if (state.hints && g.rows.length) meta += " • " + state.solver.aliveLen + " codes still fit";
    $("turnMeta").textContent = meta;

    Ui.paint(g, state.draft, state.slot, mine);
    Ui.setPalette(mine, blocked());
    $("checkBtn").disabled = !mine || state.draft.includes(-1);
    $("undoBtn").disabled = state.busy || !g.rows.length || cpuBreaks();
    $("hintBtn").hidden = !state.hints;
    $("hintBtn").disabled = !mine;

    document.body.classList.toggle("no-shapes", !state.shapes);
    // Two people sitting opposite each other: the board faces whoever is
    // guessing, so the device can sit between them instead of being passed.
    document.body.classList.toggle(
      "flipped", state.flip && !solo() && !state.over && state.breaker.seat === 1
    );
  }

  // Only when the puzzle forbids repeats. The colour already in the selected
  // slot stays available, because tapping it there just puts it back.
  function blocked() {
    const sp = state.game.spec;
    if (sp.repeats) return null;
    const used = new Set();
    for (let p = 0; p < sp.pegs; p++) {
      if (p !== state.slot && state.draft[p] >= 0) used.add(state.draft[p]);
    }
    return used;
  }

  // The coach line is never empty during a game, so it never resizes the board
  // mid-turn. What it says leads with whatever is most worth knowing.
  function showStatus() {
    const g = state.game;
    if (!g || state.busy || state.over || state.breaker.kind !== "human") return;
    const full = !state.draft.includes(-1);

    if (state.hints && full && Ai.ruledOut(state.solver, state.draft)) {
      say("🤔", "You've already ruled this row out — the pegs you've got say it can't be " +
        "the answer. Still worth asking, if it tells you something.", "warn");
      return;
    }

    if (state.hints && g.rows.length) {
      const f = Ai.facts(state.solver);
      if (f.left === 1) {
        say("🎉", "There's only one row left that fits. You've as good as got it.");
        return;
      }
      if (f.absent.length) {
        const words = f.absent.map((c) => Rules.COLOUR_NAMES[c].toLowerCase());
        say("🚫", "No " + joinWords(words) + " in this code — leave " +
          (words.length > 1 ? "them" : "it") + " out.");
        return;
      }
      if (f.known.length) {
        const k = f.known[0];
        say("📌", "Slot " + (k.slot + 1) + " has to be " +
          Rules.COLOUR_NAMES[k.colour].toLowerCase() + " — every row that still fits has it there.");
        return;
      }
      if (f.left <= 8) {
        say("🔎", "Only " + f.left + " rows still fit. Pick one that tells them apart.");
        return;
      }
    }

    const left = Rules.goesLeft(g);
    say("🎯", full
      ? "Row's full — tap Check to see how you did."
      : "Tap a colour to fill the row. " + left + (left === 1 ? " go left." : " goes left."), "calm");
  }

  function joinWords(list) {
    if (list.length === 1) return list[0];
    return list.slice(0, -1).join(", ") + " or " + list[list.length - 1];
  }

  function say(face, text, kind) {
    Ui.coach('<span class="coach-face">' + face + "</span><span>" + text + "</span>", kind);
  }

  /* ── Building a row ────────────────────────────────────────────────────── */

  function pickSlot(p) {
    if (state.busy || state.over || state.breaker.kind !== "human") return;
    if (state.slot === p && state.draft[p] >= 0) { state.draft[p] = -1; Audio.clear(); }
    else Audio.tap();
    state.slot = p;
    refresh();
    showStatus();
  }

  function pickColour(c) {
    if (state.busy || state.over || state.breaker.kind !== "human") return;
    const sp = state.game.spec;
    if (!sp.repeats && state.draft.some((v, i) => i !== state.slot && v === c)) {
      Audio.nope();
      Ui.toast("This puzzle won't take the same colour twice.");
      return;
    }
    state.draft[state.slot] = c;
    Audio.place(state.slot);
    state.slot = nextEmpty(state.draft, state.slot, sp.pegs);
    refresh();
    showStatus();
  }

  function checkRow() {
    if (state.busy || state.over || state.breaker.kind !== "human") { Audio.nope(); return; }
    if (state.draft.includes(-1)) {
      Audio.nope();
      Ui.toast("Fill every slot first.");
      return;
    }
    Audio.check();
    submit(state.draft.slice());
  }

  /* ── Playing a row ─────────────────────────────────────────────────────── */

  function submit(code) {
    const g = state.game;
    if (state.over) return;
    const gen = state.gen;
    const at = g.rows.length;

    const row = Rules.guess(g, code);
    Ai.observe(state.solver, code, row.black, row.white);
    state.draft = new Array(g.spec.pegs).fill(-1);
    state.slot = 0;
    state.busy = true;

    refresh();
    Ui.markRow(at);
    Audio.marks(row.black, row.white);
    save();

    // Long enough for the pegs to land and be read, and longer when there are
    // more of them to watch.
    const wait = 480 + (row.black + row.white) * 90;
    setTimeout(() => {
      if (gen !== state.gen) return;
      state.busy = false;
      if (g.over) { finish(at); return; }
      refresh();
      afterTurn();
    }, wait);
  }

  function afterTurn() {
    if (cpuBreaks()) { cpuGuess(); return; }
    Audio.turn();
    showStatus();
  }

  function cpuGuess() {
    const gen = state.gen;
    state.busy = true;
    refresh();
    say("🤖", BOT_NAME + " is thinking…");

    // Two hops on purpose. The search runs on the main thread and blocks it, so
    // the first timeout lets "thinking…" actually paint; the second holds the
    // guess back until it has been on screen long enough to read, however fast
    // the answer came back.
    setTimeout(() => {
      if (gen !== state.gen) return;
      const started = Date.now();
      const move = Ai.chooseGuess(state.solver, state.difficulty);
      if (!move) { state.busy = false; refresh(); return; }
      state.lastThink = move;

      const wait = Math.max(0, 560 - (Date.now() - started));
      setTimeout(() => {
        if (gen !== state.gen) return;
        say("🤖", move.left > 1
          ? BOT_NAME + " had " + move.left.toLocaleString() + " codes to choose from."
          : BOT_NAME + " has worked it out.");
        state.busy = false;
        submit(move.code);
      }, wait);
    }, 60);
  }

  /* ── The end of a round ────────────────────────────────────────────────── */

  // A round that runs out of goes still has to score something, or a player who
  // never cracks a code looks better than one who takes every go and gets there.
  const roundScore = (g) => (g.cracked ? g.rows.length : g.spec.guesses + 2);

  function finish(at) {
    const g = state.game;
    state.over = true;
    state.busy = false;

    if (g.cracked) { Ui.markWin(at); Audio.win(); Ui.confetti(); }
    else Audio.lose();

    if (solo()) {
      // Best is only worth keeping for the job the human is actually doing.
      const key = bestKey();
      const mine = state.role === "break" ? g.cracked : !g.cracked;
      if (mine && g.cracked && state.role === "break") {
        if (!state.best[key] || g.rows.length < state.best[key]) state.best[key] = g.rows.length;
      } else if (state.role === "set") {
        // Holding out longer is the achievement here, so bigger is better.
        const held = g.rows.length;
        if (!state.best[key] || held > state.best[key]) state.best[key] = held;
      }
    } else {
      state.tally.goes[state.breaker.seat] += roundScore(g);
      state.tally.rounds[state.breaker.seat]++;
    }

    refresh();
    save();
    setTimeout(() => showResult(), g.cracked ? 1100 : 700);
  }

  function showResult() {
    const g = state.game;
    const n = g.rows.length;
    let icon, title, text;

    if (solo() && state.role === "break") {
      if (g.cracked) {
        icon = "🏆";
        title = n <= 4 ? "Cracked it!" : "Got there!";
        text = "You broke the code in " + n + (n === 1 ? " go" : " goes") + ".";
        const b = state.best[bestKey()];
        if (b && b < n) text += " Your best is still " + b + ".";
        else if (b === n) text += " That's your best yet.";
      } else {
        icon = "😬";
        title = "Out of goes";
        text = "Ten goes gone. Here's what it was — have a look and see where it went wrong.";
      }
    } else if (solo()) {
      if (g.cracked) {
        icon = n >= 5 ? "👏" : "🤖";
        title = BOT_NAME + " got it";
        text = BOT_NAME + " cracked your code in " + n + (n === 1 ? " go" : " goes") + ".";
        if (state.difficulty === "hard" && n >= 5) {
          text += " Five is the most it can ever need — you hid that as well as anyone could.";
        }
      } else {
        icon = "🏆";
        title = "You beat it!";
        text = BOT_NAME + " ran out of goes. Your code was too good for it.";
      }
    } else {
      const who = state.breaker.name;
      if (g.cracked) {
        icon = "🏆";
        title = who + " cracked it";
        text = who + " broke " + state.setter.name + "'s code in " + n +
          (n === 1 ? " go" : " goes") + ".";
      } else {
        icon = "🤫";
        title = state.setter.name + " wins the round";
        text = who + " ran out of goes. That was a well-hidden code.";
      }
    }

    $("resultIcon").textContent = icon;
    $("resultTitle").textContent = title;
    $("resultText").textContent = text;

    const reveal = $("resultCode");
    reveal.innerHTML = "";
    reveal.appendChild(Ui.miniRow(g.secret));

    renderTally();
    $("againBtn").textContent = solo() ? "Play again ▶" : "Swap over ▶";
    $("result").hidden = false;
  }

  // The running score only means something once there is more than one round in
  // it, and only compares fairly once both people have had the same number of
  // turns at guessing.
  function renderTally() {
    const box = $("resultTally");
    const rounds = state.tally.rounds;
    if (solo() || rounds[0] + rounds[1] < 2) { box.hidden = true; return; }

    box.innerHTML = "";
    for (let seat = 0; seat < 2; seat++) {
      const row = document.createElement("div");
      row.className = "tally-row";
      row.innerHTML =
        '<span class="tname">' + nameOf(seat) + "</span>" +
        '<span class="muted">' + rounds[seat] + (rounds[seat] === 1 ? " round" : " rounds") + "</span>" +
        '<span class="tnum">' + state.tally.goes[seat] + "</span>";
      box.appendChild(row);
    }

    const note = document.createElement("p");
    note.className = "howto-caption";
    note.style.textAlign = "center";
    if (rounds[0] !== rounds[1]) {
      note.textContent = "Goes used so far. One more round and it's even.";
    } else if (state.tally.goes[0] === state.tally.goes[1]) {
      note.textContent = "Dead level on goes used. Play another round.";
    } else {
      const lead = state.tally.goes[0] < state.tally.goes[1] ? 0 : 1;
      note.textContent = nameOf(lead) + " is ahead — fewest goes wins.";
    }
    box.appendChild(note);
    box.hidden = false;
  }

  function nextRound() {
    if (!solo()) state.setterSeat = 1 - state.setterSeat;
    startGame(false);
  }

  // Walking away from a game in progress. Written down straight away, or the
  // Resume button would offer a game the player has already left behind.
  function abandon() {
    state.playing = false;
    state.over = false;
    savedGame = null;
    save();
    showScreen("setup");
    renderSetup();
  }

  /* ── Undo and hints ────────────────────────────────────────────────────── */

  function undo() {
    const g = state.game;
    if (state.busy || !g || !g.rows.length || cpuBreaks()) { Audio.nope(); return; }

    state.gen++;                 // any pending timer belongs to the old line

    // Undoing out of a finished round un-counts it as well, or the running score
    // ends up ahead of the rounds actually played.
    if (state.over && !solo()) {
      state.tally.goes[state.breaker.seat] -= roundScore(g);
      state.tally.rounds[state.breaker.seat]--;
    }
    state.over = false;
    $("result").hidden = true;

    Rules.undo(g);
    state.solver = Ai.replay(g.spec, g.rows);
    state.draft = new Array(g.spec.pegs).fill(-1);
    state.slot = 0;

    Audio.undo();
    Ui.clearWin();
    refresh();
    save();
    showStatus();
  }

  function askHint() {
    if (state.busy || state.over || state.breaker.kind !== "human") { Audio.nope(); return; }
    const gen = state.gen;
    state.busy = true;
    refresh();
    say("💡", "Having a look…");

    setTimeout(() => {
      if (gen !== state.gen) return;
      const tip = Ai.hint(state.solver);
      state.busy = false;
      if (!tip) { refresh(); showStatus(); return; }
      // Fill the row in as well as explaining it — the point of a hint is to get
      // a stuck player moving, not to set them a second puzzle.
      state.draft = tip.code.slice();
      state.slot = state.game.spec.pegs - 1;
      refresh();
      Audio.hint();
      Ui.nudge(state.game.rows.length);
      say("💡", tip.text);
    }, 60);
  }

  /* ── Menu ──────────────────────────────────────────────────────────────── */

  function openMenu() {
    $("menuSound").textContent = state.muted ? "🔇 Sound is off" : "🔊 Sound is on";
    $("menuHints").textContent = "💡 Hints: " + (state.hints ? "on" : "off");
    $("menuShapes").textContent = "🔷 Shapes on pegs: " + (state.shapes ? "on" : "off");

    const box = $("brainOut");
    const think = state.lastThink;
    if (!cpuBreaks()) {
      box.innerHTML = '<p class="muted">' + BOT_NAME +
        " isn't guessing this game — you are. Set it a code and it'll show its working.</p>";
    } else if (!think) {
      box.innerHTML = '<p class="muted">It hasn\'t had a go yet.</p>';
    } else {
      box.innerHTML =
        '<div class="brain-grid">' +
        "<div><b>" + state.solver.aliveLen.toLocaleString() + "</b><span>codes still fit</span></div>" +
        "<div><b>" + think.left.toLocaleString() + "</b><span>before that guess</span></div>" +
        "<div><b>" + think.ms + "ms</b><span>thinking</span></div>" +
        "</div>";
    }
    $("menu").hidden = false;
  }

  function setMuted(v) {
    state.muted = v;
    Audio.setMuted(v);
    $("muteBtn").textContent = v ? "🔇" : "🔊";
    $("muteBtn").setAttribute("aria-pressed", String(!v));
    save();
  }

  /* ── Wiring ────────────────────────────────────────────────────────────── */

  function wire() {
    chooser("countChooser", state.playerCount, (v) => {
      state.playerCount = Number(v); renderSetup(); save();
    });
    chooser("roleChooser", state.role, (v) => { state.role = v; renderSetup(); save(); });
    chooser("diffChooser", state.difficulty, (v) => { state.difficulty = v; renderSetup(); save(); });
    chooser("presetChooser", state.preset, (v) => { state.preset = v; renderSetup(); save(); });

    $("flipToggle").addEventListener("click", () => {
      state.flip = !state.flip; Audio.tap(); renderSetup(); save();
    });
    $("hintToggle").addEventListener("click", () => {
      state.hints = !state.hints; Audio.tap(); renderSetup(); save();
    });
    $("shapeToggle").addEventListener("click", () => {
      state.shapes = !state.shapes; Audio.tap(); renderSetup(); save();
    });

    $("startBtn").addEventListener("click", () => startGame(true));
    $("resumeBtn").addEventListener("click", resumeGame);
    $("howtoBtn").addEventListener("click", () => Tutorial.open());

    $("pickRandom").addEventListener("click", () => {
      pickDraft = Rules.randomCode(spec());
      pickAt = 0;
      Audio.place(0);
      renderPick();
    });
    $("pickDone").addEventListener("click", pickConfirmed);
    $("pickBack").addEventListener("click", () => { showScreen("setup"); renderSetup(); });
    $("handBack").addEventListener("click", () => {
      $("handStep").hidden = true;
      $("pickStep").hidden = false;
    });
    $("handGo").addEventListener("click", () => begin(pickDraft.slice()));

    $("checkBtn").addEventListener("click", checkRow);
    $("undoBtn").addEventListener("click", undo);
    $("hintBtn").addEventListener("click", askHint);
    $("muteBtn").addEventListener("click", () => setMuted(!state.muted));

    $("menuBtn").addEventListener("click", openMenu);
    $("menuClose").addEventListener("click", () => { $("menu").hidden = true; });
    $("menuSound").addEventListener("click", () => { setMuted(!state.muted); openMenu(); });
    $("menuHints").addEventListener("click", () => {
      state.hints = !state.hints; save(); refresh(); showStatus(); openMenu();
    });
    $("menuShapes").addEventListener("click", () => {
      state.shapes = !state.shapes; save(); refresh(); openMenu();
    });
    $("menuUndo").addEventListener("click", () => { $("menu").hidden = true; undo(); });
    $("menuHowto").addEventListener("click", () => { $("menu").hidden = true; Tutorial.open(); });
    $("menuNew").addEventListener("click", () => {
      $("menu").hidden = true;
      state.gen++;
      abandon();
    });

    $("againBtn").addEventListener("click", () => { $("result").hidden = true; nextRound(); });
    $("resultMenu").addEventListener("click", () => {
      $("result").hidden = true;
      abandon();
    });
    $("resultUndo").addEventListener("click", undo);

    Tutorial.wire();

    addEventListener("keydown", (e) => {
      if ($("game").hidden) return;
      if (!$("menu").hidden || !$("howto").hidden || !$("result").hidden) return;
      if (e.key >= "1" && e.key <= String(Rules.COLOURS)) pickColour(Number(e.key) - 1);
      else if (e.key === "Enter") checkRow();
      else if (e.key === "Backspace") { e.preventDefault(); pickSlot(state.slot); }
      else if (e.key === "u" || e.key === "U") undo();
      else if (e.key === "h" || e.key === "H") askHint();
    });
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */

  load();
  wire();
  setMuted(state.muted);
  renderSetup();
  showScreen("setup");

  // First time here: open the lesson rather than a board nobody has explained.
  if (!state.seenHowTo) {
    state.seenHowTo = true;
    save();
    Tutorial.open();
  }

  if ("serviceWorker" in navigator) {
    addEventListener("load", () => navigator.serviceWorker.register("../sw.js").catch(() => {}));
  }
})();
