/* Connect Four — the game itself: setup, whose turn it is, and what happens next.*/
/*                                                                              */
/* Everything below is orchestration. The rules live in board.js, the drawing in */
/* ui.js, the opponent in ai.js; this file only decides what to ask of them and  */
/* in what order.                                                               */
/*                                                                              */
/* Seats are colours, not people: players[0] always plays red and moves first,   */
/* players[1] always plays yellow. Which seat the human takes is a setup choice, */
/* and everything downstream — the board, the solver, the saved game — only ever */
/* deals in colours.                                                            */
"use strict";

(function () {
  const { Board, Ai, Ui, Audio, Tutorial } = window.C4;
  const $ = (id) => document.getElementById(id);

  const SAVE_KEY = "connectFourSave_v1";
  const BOT_NAME = "Robo";

  /* ── State ─────────────────────────────────────────────────────────────── */

  const state = {
    playerCount: 1,
    difficulty: "medium",
    youAre: Board.RED,   // which colour the human takes in a one-player game
    names: ["Player 1", "Player 2"],
    flip: false,         // turn the screen around between two people
    hints: true,         // warn about threats, and offer the hint button
    muted: false,
    seenHowTo: false,
    tally: { red: 0, yellow: 0, draw: 0 },

    board: null,
    players: [],
    playing: false,
    busy: false,         // a disc is falling, or the opponent is thinking
    over: false,
    winner: 0,           // colour that won, 0 for a draw or a game still going
    lastThink: null,     // what the solver did on its last move, for the menu
    gen: 0               // bumped on every new game, so a stale timer can't fire into it
  };

  const current = () => state.players[state.board.turn - 1];
  const seatOf = (who) => state.players[who - 1];
  const isCpuGame = () => state.playerCount === 1;
  const colourName = (who) => (who === Board.RED ? "red" : "yellow");
  const colourWord = (who) => (who === Board.RED ? "Red" : "Yellow");

  /* ── Saving ────────────────────────────────────────────────────────────── */
  // Wrapped in try/catch throughout: private browsing can make localStorage
  // throw on write, and a family game is not worth crashing over.

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        playerCount: state.playerCount, difficulty: state.difficulty, youAre: state.youAre,
        names: state.names, flip: state.flip, hints: state.hints,
        muted: state.muted, seenHowTo: state.seenHowTo, tally: state.tally,
        // The move list is the whole game — a saved position can never disagree
        // with the moves that made it, because it is rebuilt from them.
        game: state.playing && !state.over ? { moves: Board.snapshot(state.board) } : null
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
    return !!savedGame && !!Board.restore(savedGame.moves);
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
    $("colourNote").textContent = state.youAre === Board.RED
      ? "Red always goes first — you'll open the game."
      : "Red always goes first, so " + BOT_NAME + " opens and you reply.";

    $("flipRow").hidden = solo;
    $("flipNote").hidden = !(!solo && state.flip);
    setSwitch("flipToggle", state.flip);
    setSwitch("hintToggle", state.hints);

    $("namesBox").hidden = solo;
    const names = $("namesWrap");
    names.innerHTML = "";
    for (let i = 0; i < 2; i++) {
      const label = state.names[i] || "Player " + (i + 1);
      const row = document.createElement("label");
      row.className = "name-row";
      row.innerHTML = "<span>" + (i === 0 ? "🔴 Red" : "🟡 Yellow") + "</span>";
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 12;
      input.value = label;
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
    return state.youAre === Board.RED ? [you, bot] : [bot, you];
  }

  // `fresh` distinguishes a brand new matchup (wipe the running score) from
  // another game between the same two (keep it).
  function startGame(fresh) {
    state.gen++;
    state.players = makePlayers();
    state.board = Board.create();
    state.playing = true;
    state.over = false;
    state.winner = 0;
    state.busy = false;
    state.lastThink = null;
    if (fresh) state.tally = { red: 0, yellow: 0, draw: 0 };

    closeResult();
    Ui.clearToast();
    showScreen("game");
    Ui.paint(state.board);
    refresh();
    save();
    afterTurn();
  }

  function resumeGame() {
    const b = savedGame && Board.restore(savedGame.moves);
    if (!b) { startGame(true); return; }
    state.gen++;
    state.players = makePlayers();
    state.board = b;
    state.playing = true;
    state.over = false;
    state.winner = 0;
    state.busy = false;

    closeResult();
    Ui.clearToast();
    showScreen("game");
    Ui.paint(b);
    refresh();
    afterTurn();
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
    const player = current();
    const myTurn = !state.busy && !state.over && player.kind === "human";

    Ui.setEnabled(b, myTurn);

    // Once it's over the dot belongs to the winner, not to whoever would have
    // been next — that side never got its go.
    $("turnDot").className = "turn-dot " +
      (state.over ? (state.winner ? colourName(state.winner) : "none") : colourName(b.turn));
    // The solo human is called "You", and "You's go" is not a sentence.
    $("turnName").textContent = state.over ? "Game over"
      : player.kind === "cpu" ? player.name
      : isCpuGame() ? "Your go"
      : player.name + "'s go";
    $("turnName").classList.toggle("cpu", player.kind === "cpu");

    const played = b.moves.length;
    $("turnMeta").textContent = state.over
      ? played + (played === 1 ? " disc played" : " discs played")
      : colourWord(b.turn) + " • " + (Board.COLS * Board.ROWS - played) + " spaces left";

    $("undoBtn").disabled = state.busy || !b.moves.length;
    $("hintBtn").hidden = !state.hints;
    $("hintBtn").disabled = !myTurn;

    // Two people sitting opposite each other: the whole screen turns around so
    // they can both read it the right way up without passing the device.
    document.body.classList.toggle(
      "flipped", state.flip && !isCpuGame() && b.turn === Board.YELLOW && !state.over
    );
  }

  /* ── Taking a turn ─────────────────────────────────────────────────────── */

  function dropIn(col) {
    const b = state.board;
    if (state.busy || state.over || !Board.canPlay(b, col)) {
      Audio.nope();
      // Full columns are disabled on the board, so the only way to land here is
      // the number-key shortcut — where nothing visible would happen otherwise.
      if (!state.over && !state.busy && !Board.canPlay(b, col)) {
        Ui.toast("Column " + (col + 1) + " is full — try another.");
      }
      return;
    }

    const who = b.turn;
    state.busy = true;
    Ui.clearPreview();

    const row = Board.play(b, col);
    Audio.drop(Board.ROWS - 1 - row);
    refresh();

    Ui.drop(col, row, who).then(() => {
      Audio.land();
      const line = Board.lastLine(b);
      if (line) return finish(who, line);
      if (Board.full(b)) return finish(0, null);
      state.busy = false;
      refresh();
      save();
      afterTurn();
    });
  }

  // Hands over to whoever is next: the opponent starts thinking, or the person
  // whose go it is gets a warning if they're about to be beaten.
  function afterTurn() {
    if (current().kind === "cpu") { cpuMove(); return; }
    Audio.turn();
    showStatus();
  }

  // The line above the board is never empty during a game. Partly so a kid
  // always knows whose go it is, and partly because a line that comes and goes
  // would resize the board underneath it every single turn.
  function showStatus() {
    const b = state.board;
    if (!b || state.busy || state.over || current().kind !== "human") return;
    const me = b.turn;

    if (state.hints) {
      const mine = Board.winningCols(b, me);
      const theirs = Board.winningCols(b, 3 - me);
      if (mine.length) {
        say("🏆", "You can win this go — have a good look.");
        return;
      }
      if (theirs.length > 1) {
        say("😬", "They can win in two different places. Block the one you'd rather not lose to.", "warn");
        return;
      }
      if (theirs.length === 1) {
        say("⚠️", "Careful — they win next go unless you block column " + (theirs[0] + 1) + ".", "warn");
        return;
      }
    }

    const whose = isCpuGame() ? "Your go" : current().name + "'s go";
    say(me === Board.RED ? "🔴" : "🟡",
      whose + " — tap a column to drop a " + colourWord(me).toLowerCase() + " disc.", "calm");
  }

  function say(face, text, kind) {
    Ui.coach('<span class="coach-face">' + face + '</span><span>' + text + "</span>", kind);
  }

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
      if (!move) { state.busy = false; refresh(); return; }

      const wait = Math.max(0, 450 - (Date.now() - started));
      setTimeout(() => {
        if (gen !== state.gen) return;
        say("🤖", bot.name + " plays column " + (move.col + 1) + ".");
        state.busy = false;
        dropIn(move.col);
      }, wait);
    }, 60);
  }

  /* ── Ending a game ─────────────────────────────────────────────────────── */

  function finish(winner, line) {
    state.over = true;
    state.busy = false;
    state.winner = winner;
    if (line) Ui.markWin(line);

    if (winner) state.tally[colourName(winner)]++;
    else state.tally.draw++;

    const humanWon = winner && seatOf(winner).kind === "human";
    if (!winner) { Audio.draw(); say("🤝", "Board full — nobody got four.", "calm"); }
    else {
      say(winner === Board.RED ? "🔴" : "🟡",
        colourWord(winner) + " got four in a row!", "calm");
      if (humanWon) { Audio.win(); Ui.confetti(); } else Audio.lose();
    }

    refresh();
    save();
    setTimeout(() => showResult(winner), line ? 1100 : 600);
  }

  function showResult(winner) {
    const solo = isCpuGame();
    let icon = "🤝";
    let title = "It's a draw!";
    let text = "Every space is full and nobody got four. Happens to the best of us.";

    if (winner) {
      const win = seatOf(winner);
      const lost = seatOf(3 - winner);
      if (win.kind === "human") {
        icon = "🏆";
        title = solo ? "You win! 🎉" : win.name + " wins! 🎉";
        text = solo
          ? "That's four in a row against " + lost.name + " on " + state.difficulty + "."
          : "Four in a row for " + colourWord(winner).toLowerCase() + ".";
      } else {
        icon = "🤖";
        title = win.name + " got there first";
        text = "Four in a row on " + state.difficulty +
          ". Take that last move back and try another, or start again.";
      }
    }

    $("resultIcon").textContent = icon;
    $("resultTitle").textContent = title;
    $("resultText").innerHTML = text;

    // The running score only means something once there's more than one game in
    // it, so it stays out of the way until then.
    const t = state.tally;
    const games = t.red + t.yellow + t.draw;
    const tallyBox = $("resultTally");
    tallyBox.hidden = games < 2;
    if (games >= 2) {
      tallyBox.innerHTML = "";
      const parts = [
        { name: state.players[0].name, dot: "red", n: t.red },
        { name: state.players[1].name, dot: "yellow", n: t.yellow }
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
    if (state.busy || !b || !b.moves.length) { Audio.nope(); return; }

    state.gen++;               // any pending opponent timer belongs to the old line

    // Undoing out of a finished game un-counts it as well, or the running score
    // ends up ahead of the games actually played.
    if (state.over) {
      if (state.winner) state.tally[colourName(state.winner)]--;
      else state.tally.draw--;
    }
    state.over = false;
    state.winner = 0;
    closeResult();

    Board.undo(b);
    // Against the computer, taking one move back would just hand the turn
    // straight back to it, so step over its reply as well.
    if (isCpuGame() && b.moves.length && current().kind === "cpu") Board.undo(b);

    Audio.undo();
    Ui.paint(b);
    refresh();
    save();

    // Only reachable when you play yellow and undo right back to an empty board.
    if (current().kind === "cpu") cpuMove();
    else showStatus();
  }

  function askHint() {
    const b = state.board;
    if (state.busy || state.over || current().kind !== "human") { Audio.nope(); return; }

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
      Ui.nudge(tip.col);
      say("💡", "Column " + (tip.col + 1) + " — " + tip.text);
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
      box.innerHTML = '<p class="muted">Its last move needed no thinking at all — ' +
        "either it could win on the spot, or Easy was having one of its moments.</p>";
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

  /* ── Wiring ────────────────────────────────────────────────────────────── */

  function wire() {
    Ui.build(
      (col) => { if (!state.busy && !state.over) dropIn(col); },
      (col) => {
        // Clearing has to come first and unconditionally: the pointer can leave
        // the board at the exact moment a disc starts falling, and a preview
        // left behind then never gets rubbed out.
        if (col < 0 || state.busy || state.over || current().kind !== "human") {
          Ui.clearPreview();
          return;
        }
        Ui.preview(state.board, col, state.board.turn);
      }
    );
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
      refresh();
      showStatus();
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
    $("menuNew").addEventListener("click", () => {
      $("menu").hidden = true;
      state.gen++;
      state.playing = false;
      savedGame = null;
      save();
      showScreen("setup");
      renderSetup();
    });

    $("muteBtn").addEventListener("click", () => { setMuted(!state.muted); Audio.tap(); });
    $("undoBtn").addEventListener("click", undo);
    $("hintBtn").addEventListener("click", askHint);

    $("againBtn").addEventListener("click", () => { Audio.tap(); startGame(false); });
    $("resultMenu").addEventListener("click", () => {
      Audio.tap();
      state.playing = false;
      savedGame = null;
      save();
      closeResult();
      showScreen("setup");
      renderSetup();
    });
    $("resultUndo").addEventListener("click", () => { Audio.tap(); undo(); });

    // Keys 1-7 drop into that column, for anyone playing at a desk. Ignored
    // while a sheet is up, so Enter-ing through the lesson can't play moves.
    addEventListener("keydown", (e) => {
      if ($("game").hidden) return;
      if (!$("menu").hidden || !$("howto").hidden || !$("result").hidden) return;
      if (e.key >= "1" && e.key <= "7") { dropIn(Number(e.key) - 1); }
      else if (e.key === "u" || e.key === "U") undo();
      else if (e.key === "h" || e.key === "H") askHint();
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
