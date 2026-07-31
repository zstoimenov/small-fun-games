/* Nine Men's Morris — the game itself: setup, whose turn it is, what happens.   */
/*                                                                              */
/* Everything below is orchestration. The rules live in rules.js, the drawing in */
/* ui.js, the opponent in ai.js; this file only decides what to ask of them and  */
/* in what order.                                                               */
/*                                                                              */
/* Seats are colours, not people: players[0] always plays white and moves first, */
/* players[1] always plays black. Which seat the human takes is a setup choice,  */
/* and everything downstream only ever deals in colours.                        */
/*                                                                              */
/* The one thing here that Connect Four didn't need is a turn that takes two or  */
/* three taps: pick a piece up, put it down, and — if that closed a line of      */
/* three — choose which of theirs to take. The middle of that is a real state,   */
/* not a modal: `state.awaiting` says a capture is owed, and `state.mover` says  */
/* who owes it, because rules.js has already flipped the turn by then.           */
"use strict";

(function () {
  const { Rules, Ai, Ui, Audio, Tutorial } = window.NMM;
  const $ = (id) => document.getElementById(id);

  const SAVE_KEY = "nineMensMorrisSave_v1";
  const BOT_NAME = "Robo";

  /* ── State ─────────────────────────────────────────────────────────────── */

  const state = {
    playerCount: 1,
    difficulty: "medium",
    youAre: Rules.WHITE,   // which colour the human takes in a one-player game
    names: ["Player 1", "Player 2"],
    flip: false,           // turn the screen around between two people
    hints: true,           // warn about threats, and offer the hint button
    muted: false,
    seenHowTo: false,
    tally: { white: 0, black: 0, draw: 0 },

    board: null,
    players: [],
    playing: false,
    busy: false,           // a piece is moving, or the opponent is thinking
    over: false,
    winner: 0,
    reason: "",
    sel: -1,               // the piece picked up, or -1
    awaiting: null,         // "remove" while a capture is owed
    mover: 0,              // who owes it
    takeable: [],
    lastThink: null,       // what the solver did last, for the menu
    gen: 0                 // bumped on every new game, so a stale timer can't fire
  };

  const seatOf = (who) => state.players[who - 1];
  const current = () => seatOf(state.board.turn);
  const isCpuGame = () => state.playerCount === 1;
  const colourWord = (who) => (who === Rules.WHITE ? "White" : "Black");
  const colourName = (who) => (who === Rules.WHITE ? "white" : "black");

  // Who the game is waiting on. Not always the player to move: while a capture
  // is owed it is the player who just closed the mill.
  const actorColour = () => (state.awaiting ? state.mover : state.board.turn);
  const actor = () => seatOf(actorColour());

  const spot = (n) => Ui.NAMES[n];

  /* ── Saving ────────────────────────────────────────────────────────────── */
  // Wrapped in try/catch throughout: private browsing can make localStorage
  // throw on write, and a family game is not worth crashing over.

  function save() {
    try {
      let game = null;
      if (state.playing && !state.over) {
        const flat = Rules.snapshot(state.board);
        // A capture owed is half a move. Saving it would store a position the
        // rules would reject on the way back in, so the save stops one move
        // short and a resumed game asks for the mill again.
        if (state.awaiting) flat.length = Math.max(0, flat.length - 3);
        game = { moves: flat };
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        playerCount: state.playerCount, difficulty: state.difficulty, youAre: state.youAre,
        names: state.names, flip: state.flip, hints: state.hints,
        muted: state.muted, seenHowTo: state.seenHowTo, tally: state.tally,
        game: game
      }));
    } catch (e) { /* storage unavailable — the game still plays fine */ }
  }

  let savedGame = null;

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      for (const k of ["playerCount", "difficulty", "youAre", "flip", "hints", "muted", "seenHowTo"]) {
        if (s[k] !== undefined) state[k] = s[k];
      }
      if (Array.isArray(s.names)) state.names = s.names;
      if (s.tally) state.tally = s.tally;
      if (s.game && Array.isArray(s.game.moves) && s.game.moves.length) savedGame = s.game;
    } catch (e) { /* corrupt or unreadable save — start fresh */ }
  }

  function resumable() {
    return !!savedGame && !!Rules.restore(savedGame.moves);
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

  // Only the rows that matter right now are on screen: the difficulty and the
  // colour pick are meaningless with two people at the device, and turning the
  // screen around is meaningless without them.
  function renderSetup() {
    const solo = state.playerCount === 1;

    $("diffRow").hidden = !solo;
    $("colourRow").hidden = !solo;
    $("colourNote").hidden = !solo;
    $("colourNote").textContent = state.youAre === Rules.WHITE
      ? "White always goes first — you'll open the game."
      : "White always goes first, so " + BOT_NAME + " opens and you reply.";

    $("flipRow").hidden = solo;
    $("flipNote").hidden = !(!solo && state.flip);
    setSwitch("flipToggle", state.flip);
    setSwitch("hintToggle", state.hints);

    $("namesBox").hidden = solo;
    const names = $("namesWrap");
    names.innerHTML = "";
    for (let i = 0; i < 2; i++) {
      const row = document.createElement("label");
      row.className = "name-row";
      row.innerHTML = "<span>" + (i === 0 ? "⚪ White" : "⚫ Black") + "</span>";
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

  function nameSummary() {
    return "Names: " + [0, 1].map((i) => state.names[i] || "Player " + (i + 1)).join(" and ");
  }

  /* ── Starting a game ───────────────────────────────────────────────────── */

  function makePlayers() {
    if (!isCpuGame()) {
      return [
        { name: (state.names[0] || "").trim() || "Player 1", kind: "human", difficulty: null },
        { name: (state.names[1] || "").trim() || "Player 2", kind: "human", difficulty: null }
      ];
    }
    const you = { name: "You", kind: "human", difficulty: null };
    const bot = { name: BOT_NAME, kind: "cpu", difficulty: state.difficulty };
    return state.youAre === Rules.WHITE ? [you, bot] : [bot, you];
  }

  function reset(board) {
    state.gen++;
    state.players = makePlayers();
    state.board = board;
    state.playing = true;
    state.over = false;
    state.winner = 0;
    state.reason = "";
    state.busy = false;
    state.sel = -1;
    state.awaiting = null;
    state.mover = 0;
    state.takeable = [];

    closeResult();
    Ui.clearToast();
    showScreen("game");
    Ui.paint(board);
    refresh();
    afterTurn();
  }

  // `fresh` distinguishes a brand new matchup (wipe the running score) from
  // another game between the same two (keep it).
  function startGame(fresh) {
    if (fresh) state.tally = { white: 0, black: 0, draw: 0 };
    state.lastThink = null;
    reset(Rules.create());
    save();
  }

  function resumeGame() {
    const b = savedGame && Rules.restore(savedGame.moves);
    if (!b) { startGame(true); return; }
    state.lastThink = null;
    reset(b);
  }

  function showScreen(which) {
    $("setup").hidden = which !== "setup";
    $("game").hidden = which !== "game";
    document.body.classList.toggle("in-game", which === "game");
    if (which === "game") Ui.fit();
    else document.body.classList.remove("flipped");
  }

  /* ── Drawing the state of play ─────────────────────────────────────────── */

  function refresh() {
    const b = state.board;
    if (!b) return;
    const who = actorColour();
    const player = actor();
    const mine = !state.busy && !state.over && player.kind === "human";

    Ui.setEnabled(mine);

    // Once it's over the dot belongs to the winner, not to whoever would have
    // been next — that side never got its go.
    $("turnDot").className = "turn-dot " +
      (state.over ? (state.winner ? colourName(state.winner) : "none") : colourName(who));
    // The solo human is called "You", and "You's go" is not a sentence.
    $("turnName").textContent = state.over ? "Game over"
      : state.awaiting ? (player.kind === "cpu" ? player.name + " takes one" : "Take one of theirs")
      : player.kind === "cpu" ? player.name
      : isCpuGame() ? "Your go"
      : player.name + "'s go";
    $("turnName").classList.toggle("cpu", player.kind === "cpu");
    $("turnMeta").textContent = metaLine();

    for (const [id, colour] of [["handW", Rules.WHITE], ["handB", Rules.BLACK]]) {
      const i = colour - 1;
      Ui.hand(id, colour, b.toPlace[i], Rules.PIECES - b.toPlace[i] - b.onBoard[i]);
    }
    $("handNameW").textContent = state.players[0] ? state.players[0].name : "White";
    $("handNameB").textContent = state.players[1] ? state.players[1].name : "Black";

    $("undoBtn").disabled = state.busy || !b.hist.length;
    $("hintBtn").hidden = !state.hints;
    $("hintBtn").disabled = !mine || !!state.awaiting;

    // Two people sitting opposite each other: the whole screen turns around so
    // they can both read it the right way up without passing the device.
    document.body.classList.toggle(
      "flipped", state.flip && !isCpuGame() && who === Rules.BLACK && !state.over
    );
  }

  function metaLine() {
    const b = state.board;
    if (state.over) {
      const n = b.hist.length;
      return n + (n === 1 ? " move played" : " moves played");
    }
    const who = actorColour();
    const i = who - 1;
    const phase = Rules.phase(b, who);
    if (phase === "placing") {
      return "Placing • " + b.toPlace[i] + (b.toPlace[i] === 1 ? " left in hand" : " left in hand");
    }
    if (phase === "flying") return "Flying • " + b.onBoard[i] + " pieces left";
    return "Sliding • " + b.onBoard[i] + " pieces";
  }

  /* ── Taking a turn ─────────────────────────────────────────────────────── */

  // Everything a tap on the board can mean, in one place. The order matters:
  // an owed capture comes first, because until it is paid nothing else is legal.
  function onTap(n) {
    const b = state.board;
    if (!b || state.busy || state.over) { Audio.nope(); return; }
    if (actor().kind !== "human") { Audio.nope(); return; }

    if (state.awaiting === "remove") {
      if (state.takeable.indexOf(n) !== -1) { applyRemoval(n); return; }
      Audio.nope();
      const foe = Rules.other(state.mover);
      if (Rules.at(b, n) === foe && Rules.inMill(b, n)) {
        Ui.toast("That one's in a line of three, so it's safe. Take another.");
      } else if (Rules.at(b, n) === state.mover) {
        Ui.toast("Not yours — take one of theirs.");
      } else {
        Ui.toast("Tap one of their pieces to take it off.");
      }
      return;
    }

    const who = b.turn;
    const phase = Rules.phase(b, who);

    if (phase === "placing") {
      if (Rules.at(b, n)) {
        Audio.nope();
        Ui.toast("There's a piece there already — pick an empty spot.");
        return;
      }
      playMove({ from: -1, to: n });
      return;
    }

    // Tapping your own piece picks it up, or puts it back down.
    if (Rules.at(b, n) === who) {
      if (state.sel === n) {
        state.sel = -1;
        Ui.select(-1);
        Ui.showLegal([]);
        Audio.tap();
        showStatus();
        return;
      }
      const dests = destinations(n);
      if (!dests.length) {
        Audio.nope();
        Ui.toast("That piece is boxed in — try another one.");
        return;
      }
      state.sel = n;
      Ui.select(n);
      Ui.showLegal(dests);
      Audio.lift();
      say("👆", "Now tap where it should go — the glowing spots.", "calm");
      return;
    }

    if (state.sel < 0) {
      Audio.nope();
      Ui.toast("Tap one of your own pieces first.");
      return;
    }

    if (Rules.isLegal(b, state.sel, n)) { playMove({ from: state.sel, to: n }); return; }

    Audio.nope();
    Ui.toast(Rules.at(b, n)
      ? "That spot is taken."
      : Rules.phase(b, who) === "flying"
        ? "Pick an empty spot."
        : "Pieces slide along a line to the next spot — not across the board.");
  }

  function destinations(n) {
    const b = state.board;
    return Rules.steps(b).filter((mv) => mv.from === n).map((mv) => mv.to);
  }

  // Plays a move, animates it, and then deals with the capture it may have
  // earned. `mv.remove` is set when the computer moves — it has already chosen —
  // and left alone for a person, who chooses with a tap.
  function playMove(mv) {
    const b = state.board;
    const who = b.turn;
    const gen = state.gen;

    state.busy = true;
    state.sel = -1;
    Ui.select(-1);
    Ui.showLegal([]);
    Ui.clearMill();

    const anim = mv.from < 0 ? Ui.place(mv.to, who) : Ui.slide(mv.from, mv.to, who);
    if (mv.from < 0) Audio.place(); else Audio.slide();

    Rules.play(b, { from: mv.from, to: mv.to, remove: -1 });
    refresh();

    anim.then(() => {
      if (gen !== state.gen) return;
      Ui.markLast(mv.to);
      const mill = Rules.millCells(b, mv.to);
      const owed = mill && Rules.removable(b, Rules.other(who)).length > 0;

      if (!owed) {
        state.busy = false;
        refresh();
        save();
        afterMove();
        return;
      }

      Audio.mill();
      Ui.markMill(mill);
      state.awaiting = "remove";
      state.mover = who;
      state.takeable = Rules.removable(b, Rules.other(who));

      if (seatOf(who).kind === "cpu") {
        // It already knows which piece it wants; the pause is so a person can
        // see the line it made before a piece disappears.
        const pick = state.takeable.indexOf(mv.remove) !== -1 ? mv.remove : state.takeable[0];
        say("🤖", seatOf(who).name + " made a line of three and takes your " + spot(pick) + " piece.");
        setTimeout(() => { if (gen === state.gen) applyRemoval(pick); }, 620);
        return;
      }

      state.busy = false;
      Ui.showTakeable(state.takeable);
      refresh();
      const all = state.takeable.every((p) => Rules.inMill(b, p));
      say("🎉", "Three in a line! Tap one of their pieces to take it off." +
        (all ? " Every one of theirs is in a line, so this time you can take any of them."
             : " The ones in a line of three are safe."), "take");
    });
  }

  function applyRemoval(n) {
    const b = state.board;
    const gen = state.gen;
    state.busy = true;
    Ui.showTakeable([]);
    Rules.takePiece(b, n);
    Audio.taken();
    refresh();

    Ui.take(n).then(() => {
      if (gen !== state.gen) return;
      state.awaiting = null;
      state.mover = 0;
      state.takeable = [];
      state.busy = false;
      Ui.clearMill();
      Ui.markLast(-1);
      refresh();
      save();
      afterMove();
    });
  }

  function afterMove() {
    const res = Rules.outcome(state.board);
    if (res) { finish(res); return; }
    afterTurn();
  }

  // Hands over to whoever is next: the opponent starts thinking, or the person
  // whose go it is gets told what to do about it.
  function afterTurn() {
    if (current().kind === "cpu") { cpuMove(); return; }
    Audio.turn();
    showStatus();
  }

  /* ── The line above the board ──────────────────────────────────────────── */

  // Never empty during a game. Partly so a child always knows whose go it is,
  // and partly because a line that comes and goes would resize the board
  // underneath it every single turn.
  function showStatus() {
    const b = state.board;
    if (!b || state.busy || state.over || state.awaiting) return;
    if (current().kind !== "human") return;
    const me = b.turn;
    const phase = Rules.phase(b, me);

    if (state.hints) {
      const mine = Ai.threats(b, me).filter((n) => canReach(b, n, me));
      const theirs = Ai.threats(b, Rules.other(me));
      if (mine.length) {
        say("🏆", "You can finish a line of three at " + spot(mine[0]) + " — take a good look.");
        return;
      }
      if (theirs.length > 1) {
        say("😬", "They can finish a line in two places (" + spot(theirs[0]) + " and " +
          spot(theirs[1]) + "). Block the one you'd hate most.", "warn");
        return;
      }
      if (theirs.length === 1) {
        say("⚠️", "Careful — they finish a line of three at " + spot(theirs[0]) +
          " next go unless you block it.", "warn");
        return;
      }
    }

    const whose = isCpuGame() ? "Your go" : current().name + "'s go";
    const how = phase === "placing"
      ? "tap an empty spot to put a piece down. " + b.toPlace[me - 1] + " still in your hand."
      : phase === "flying"
        ? "you're down to three pieces, so you can jump to any empty spot."
        : "tap one of your pieces, then tap where to slide it.";
    say(me === Rules.WHITE ? "⚪" : "⚫", whose + " — " + how, "calm");
  }

  // Can this side actually play into that spot this turn? A line one piece short
  // is only worth mentioning if the piece can get there.
  function canReach(b, n, who) {
    if (Rules.phase(b, who) === "placing") return !Rules.at(b, n);
    return Rules.steps(b).some((mv) => mv.to === n);
  }

  function say(face, text, kind) {
    Ui.coach('<span class="coach-face">' + face + '</span><span>' + text + "</span>", kind);
  }

  /* ── The computer's turn ───────────────────────────────────────────────── */

  function cpuMove() {
    const gen = state.gen;
    const bot = current();
    state.busy = true;
    refresh();
    say("🤖", bot.name + " is thinking…");

    // Two hops on purpose. The search runs on the main thread and blocks it, so
    // the first timeout lets "thinking…" actually paint; the second holds the
    // move back until it has been on screen long enough to read, however fast
    // the answer came back.
    setTimeout(() => {
      if (gen !== state.gen) return;
      const started = Date.now();
      const move = Ai.chooseMove(state.board, bot.difficulty);
      state.lastThink = move;
      if (!move) { state.busy = false; refresh(); afterMove(); return; }

      const wait = Math.max(0, 420 - (Date.now() - started));
      setTimeout(() => {
        if (gen !== state.gen) return;
        say("🤖", move.from < 0
          ? bot.name + " puts a piece on " + spot(move.to) + "."
          : bot.name + " slides " + spot(move.from) + " → " + spot(move.to) + ".");
        state.busy = false;
        playMove(move);
      }, wait);
    }, 60);
  }

  /* ── Ending a game ─────────────────────────────────────────────────────── */

  function finish(res) {
    state.over = true;
    state.busy = false;
    state.awaiting = null;
    state.winner = res.winner;
    state.reason = res.reason;
    Ui.showTakeable([]);
    Ui.showLegal([]);
    Ui.select(-1);

    if (res.winner) state.tally[colourName(res.winner)]++;
    else state.tally.draw++;

    if (!res.winner) {
      Audio.draw();
      say("🤝", res.reason === "repetition"
        ? "The same position keeps coming round — that's a draw."
        : "Fifty goes each with nothing taken — that's a draw.", "calm");
    } else {
      const humanWon = seatOf(res.winner).kind === "human";
      say(res.winner === Rules.WHITE ? "⚪" : "⚫",
        colourWord(res.winner) + " wins — " + reasonWords(res) + ".", "calm");
      if (humanWon) { Audio.win(); Ui.confetti(); } else Audio.lose();
    }

    refresh();
    save();
    setTimeout(() => showResult(res), 900);
  }

  function reasonWords(res) {
    const lost = seatOf(Rules.other(res.winner));
    if (res.reason === "stuck") return lost.name + " had no move left";
    // The solo human is called "You", so the verb has to agree — same reason the
    // turn line above doesn't say "You's go".
    return lost.name + (lost.name === "You" ? " are" : " is") + " down to two pieces";
  }

  function showResult(res) {
    const solo = isCpuGame();
    let icon = "🤝";
    let title = "It's a draw!";
    let text = res.reason === "repetition"
      ? "The same position came round three times, so neither of you can force a win."
      : "Fifty goes each and nobody took a piece. Honours even.";

    if (res.winner) {
      const win = seatOf(res.winner);
      const lost = seatOf(Rules.other(res.winner));
      const how = res.reason === "stuck"
        ? lost.name + " had nowhere left to move"
        : lost.name + " went down to two pieces";
      if (win.kind === "human") {
        icon = "🏆";
        title = solo ? "You win! 🎉" : win.name + " wins! 🎉";
        text = solo
          ? how.replace(lost.name, lost.name) + " on " + state.difficulty + "."
          : how + ".";
      } else {
        icon = "🤖";
        title = win.name + " wins this one";
        text = how + " on " + state.difficulty +
          ". Take that last move back and try something else, or start again.";
      }
    }

    $("resultIcon").textContent = icon;
    $("resultTitle").textContent = title;
    $("resultText").textContent = text;

    // The running score only means something once there's more than one game in
    // it, so it stays out of the way until then.
    const t = state.tally;
    const games = t.white + t.black + t.draw;
    const tallyBox = $("resultTally");
    tallyBox.hidden = games < 2;
    if (games >= 2) {
      tallyBox.innerHTML = "";
      const parts = [
        { name: state.players[0].name, dot: "white", n: t.white },
        { name: state.players[1].name, dot: "black", n: t.black }
      ];
      if (t.draw) parts.push({ name: "Drawn", dot: "none", n: t.draw });
      for (const p of parts) {
        const row = document.createElement("div");
        row.className = "tally-row";
        row.innerHTML =
          '<span class="turn-dot ' + p.dot + '"></span><span class="tname">' + p.name +
          '</span><span class="tnum">' + p.n + "</span>";
        tallyBox.appendChild(row);
      }
    }

    openResult();
  }

  /* ── The end card ──────────────────────────────────────────────────────── */

  // It sits on top of the board, and the finished board is usually the thing
  // worth looking at — so it can be put aside, and the pill brings it back.
  function openResult() {
    $("peekPill").hidden = true;
    document.body.classList.remove("peeking");
    $("result").hidden = false;
  }

  function closeResult() {
    $("result").hidden = true;
    $("peekPill").hidden = true;
    document.body.classList.remove("peeking");
  }

  function peekBoard() {
    $("result").hidden = true;
    $("peekPill").hidden = false;
    // The game is over, so the row of board buttons has nothing left to offer —
    // standing it down is what makes room for the pill at the bottom.
    document.body.classList.add("peeking");
  }

  /* ── Undo and hint ─────────────────────────────────────────────────────── */

  function undo() {
    const b = state.board;
    if (state.busy || !b || !b.hist.length) { Audio.nope(); return; }

    state.gen++;               // any pending opponent timer belongs to the old line

    // Undoing out of a finished game un-counts it as well, or the running score
    // ends up ahead of the games actually played.
    if (state.over) {
      if (state.winner) state.tally[colourName(state.winner)]--;
      else state.tally.draw--;
    }
    state.over = false;
    state.winner = 0;
    state.reason = "";
    closeResult();

    // Mid-capture, one step back is the move that earned it — which is what a
    // person means by undo here, so nothing special is needed beyond dropping
    // the half-finished state.
    const wasAwaiting = !!state.awaiting;
    state.awaiting = null;
    state.mover = 0;
    state.takeable = [];
    state.sel = -1;

    Rules.undo(b);
    // Against the computer, taking one move back would just hand the turn
    // straight back to it, so step over its reply as well.
    if (!wasAwaiting && isCpuGame() && b.hist.length && current().kind === "cpu") Rules.undo(b);

    Audio.undo();
    state.busy = false;
    Ui.paint(b);
    refresh();
    save();

    if (current().kind === "cpu") cpuMove();
    else showStatus();
  }

  function askHint() {
    const b = state.board;
    if (state.busy || state.over || state.awaiting || current().kind !== "human") {
      Audio.nope();
      return;
    }

    state.busy = true;
    refresh();
    say("💡", "Having a look…");

    // Same two-hop trick as the opponent: let the message paint before the
    // search takes the thread.
    setTimeout(() => {
      const tip = Ai.hint(b);
      state.busy = false;
      refresh();
      if (!tip) { showStatus(); return; }
      Audio.hint();

      // Show the whole move, not just the destination: with a slide, which piece
      // to pick up is half the answer.
      if (tip.from >= 0) {
        state.sel = tip.from;
        Ui.select(tip.from);
        Ui.showLegal(destinations(tip.from));
      }
      Ui.nudge(tip.to);
      say("💡", (tip.from < 0
        ? "Put one on " + spot(tip.to)
        : "Slide your " + spot(tip.from) + " piece to " + spot(tip.to)) + " — " + tip.text);
    }, 60);
  }

  /* ── Menu ──────────────────────────────────────────────────────────────── */

  function openMenu() {
    $("menuSound").textContent = state.muted ? "🔇 Sound is off" : "🔊 Sound is on";
    $("menuHints").textContent = state.hints ? "💡 Hints and warnings: on" : "💡 Hints and warnings: off";

    const think = state.lastThink;
    const box = $("brainOut");
    if (!think) {
      box.innerHTML = '<p class="muted">Play a game against ' + BOT_NAME +
        " and its last go will show up here.</p>";
    } else if (!think.depth) {
      box.innerHTML = '<p class="muted">Its last move needed no thinking at all — either it ' +
        "was taking a line of three it could see, blocking one of yours, or Easy was having " +
        "one of its moments.</p>";
    } else {
      box.innerHTML =
        '<div class="brain-grid">' +
        '<div><b>' + think.depth + "</b><span>moves ahead</span></div>" +
        '<div><b>' + think.nodes.toLocaleString() + "</b><span>positions</span></div>" +
        '<div><b>' + think.ms + "ms</b><span>thinking</span></div>" +
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

  function backToSetup() {
    state.gen++;
    state.playing = false;
    state.busy = false;
    savedGame = null;
    save();
    closeResult();
    showScreen("setup");
    renderSetup();
  }

  /* ── Wiring ────────────────────────────────────────────────────────────── */

  function wire() {
    Ui.build(onTap);
    $("peekBtn").addEventListener("click", peekBoard);
    $("peekPill").addEventListener("click", openResult);
    Tutorial.wire();

    chooser("countChooser", state.playerCount, (v) => {
      state.playerCount = Number(v);
      renderSetup();
      save();
    });
    chooser("diffChooser", state.difficulty, (v) => { state.difficulty = v; save(); });
    chooser("colourChooser", state.youAre, (v) => {
      state.youAre = Number(v);
      renderSetup();
      save();
    });

    $("flipToggle").addEventListener("click", () => {
      state.flip = !state.flip;
      Audio.tap();
      renderSetup();
      save();
    });
    $("hintToggle").addEventListener("click", () => {
      state.hints = !state.hints;
      Audio.tap();
      renderSetup();
      save();
    });

    $("startBtn").addEventListener("click", () => { Audio.tap(); startGame(true); });
    $("resumeBtn").addEventListener("click", () => { Audio.tap(); resumeGame(); });
    $("howtoBtn").addEventListener("click", () => { Audio.tap(); Tutorial.open(); });

    $("menuBtn").addEventListener("click", () => { Audio.tap(); openMenu(); });
    $("menuClose").addEventListener("click", () => { Audio.tap(); $("menu").hidden = true; });
    $("menuSound").addEventListener("click", () => { setMuted(!state.muted); Audio.tap(); openMenu(); });
    $("menuHints").addEventListener("click", () => {
      state.hints = !state.hints;
      Audio.tap();
      refresh();
      showStatus();
      save();
      openMenu();
    });
    $("menuHowto").addEventListener("click", () => { $("menu").hidden = true; Tutorial.open(); });
    $("menuUndo").addEventListener("click", () => { $("menu").hidden = true; undo(); });
    $("menuNew").addEventListener("click", () => { $("menu").hidden = true; backToSetup(); });

    $("muteBtn").addEventListener("click", () => { setMuted(!state.muted); Audio.tap(); });
    $("undoBtn").addEventListener("click", undo);
    $("hintBtn").addEventListener("click", askHint);

    $("againBtn").addEventListener("click", () => { Audio.tap(); startGame(false); });
    $("resultMenu").addEventListener("click", () => { Audio.tap(); backToSetup(); });
    $("resultUndo").addEventListener("click", () => { Audio.tap(); undo(); });

    // Keyboard shortcuts for anyone playing at a desk. Ignored while a sheet is
    // up, so Enter-ing through the lesson can't play moves.
    addEventListener("keydown", (e) => {
      if ($("game").hidden) return;
      if (!$("menu").hidden || !$("howto").hidden || !$("result").hidden) return;
      if (e.key === "u" || e.key === "U") undo();
      else if (e.key === "h" || e.key === "H") askHint();
      else if (e.key === "Escape" && state.sel >= 0) {
        state.sel = -1;
        Ui.select(-1);
        Ui.showLegal([]);
        showStatus();
      }
    });
  }

  /* ── Go ────────────────────────────────────────────────────────────────── */

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
