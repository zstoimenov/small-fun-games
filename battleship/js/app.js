/* Battleship — the game itself: setup, hiding the fleets, and whose go it is.   */
/*                                                                              */
/* Everything below is orchestration. The rules live in rules.js, the drawing in */
/* ui.js, the gunner in ai.js; this file only decides what to ask of them and in */
/* what order.                                                                   */
/*                                                                              */
/* Seats are seats, not people. Each of the two is either a human or the         */
/* computer, and that is all four ways of playing this game — including two      */
/* people passing one tablet. Nothing downstream ever asks "are we in one-player */
/* mode"; it asks whether the seat whose go it is belongs to a person.           */
/*                                                                              */
/* The one rule that outranks everything: when the device changes hands, both    */
/* game screens are *hidden*, not covered. `showScreen("handover")` takes the    */
/* boards off the page altogether, so there is nothing to find by scrolling,     */
/* resizing or opening the inspector while somebody else is holding it.          */
"use strict";

(function () {
  const { Rules, Ai, Ui, Audio, Tutorial } = window.BS;
  const $ = (id) => document.getElementById(id);

  const SAVE_KEY = "battleshipSave_v1";
  const BOT_NAME = "Robo";

  /* ── State ─────────────────────────────────────────────────────────────── */

  const state = {
    playerCount: 1,
    mode: "classic",        // "classic" takes turns; "relay" is one player at a time
    difficulty: "medium",
    preset: "classic",
    extraOnHit: false,      // hit and you keep firing
    names: ["Player 1", "Player 2"],
    flip: false,            // turn the screen round for the second player
    hints: true,
    muted: false,
    seenHowTo: false,
    tally: { wins: [0, 0], games: 0 },
    best: {},               // fewest shots to win, per sea size

    game: null,
    boards: null,
    players: [],
    queue: [],              // seats still to put their ships out
    grids: { enemy: null, own: null, place: null },
    place: { seat: 0, shipId: 0, horiz: true },
    aim: null,              // the square being pointed at, before Fire
    playing: false,
    busy: false,            // a shell is in the air, or the opponent is thinking
    over: false,
    handGo: null,           // what the pass-the-tablet screen is waiting to do
    lastThink: null,
    replay: null,           // the side-by-side play-back, while it is running
    gen: 0                  // bumped on every new game, so a stale timer can't fire into it
  };

  const spec = () => Rules.specOf(state.preset);
  const curSpec = () => (state.game ? state.game.spec : spec());
  const solo = () => state.playerCount === 1;
  // Relay needs somebody to hand the tablet to, so it is a two-player thing
  // only. Everything downstream of the start asks the *game* whether it is one,
  // never the setup sheet — the sheet can be changed behind a game in progress.
  const nameOf = (seat) =>
    solo() ? (seat === 0 ? "You" : BOT_NAME)
           : ((state.names[seat] || "").trim() || "Player " + (seat + 1));
  // "You" doesn't take an apostrophe-s, and "You's sea" is exactly the sort of
  // thing that gets read out loud and laughed at.
  const whose = (seat) => (solo() && seat === 0 ? "Your" : nameOf(seat) + "'s");
  const isCpu = (seat) => !!state.players[seat] && state.players[seat].kind === "cpu";
  const myTurn = () => !!state.game && !state.busy && !state.over && !isCpu(state.game.turn);

  /* ── Saving ────────────────────────────────────────────────────────────── */
  // Wrapped in try/catch throughout: private browsing can make localStorage
  // throw on write, and a family game is not worth crashing over.

  let savedGame = null;

  // savedGame is the single record of "there is a game to come back to", and
  // save() refreshes it before writing. Deriving the stored game straight from
  // state instead would blank it every time save() ran with no game in
  // progress — and one of those runs is setMuted() at boot, so the save would
  // never survive being reopened.
  //
  // It carries the number of players with it. Otherwise, changing the setup
  // sheet and then tapping Resume would hand one player's fleet to the computer.
  function save() {
    if (state.playing && !state.over && state.game) {
      savedGame = {
        g: Rules.snapshot(state.game),
        playerCount: state.playerCount,
        mode: state.mode,
        difficulty: state.difficulty,
        names: state.names.slice(),
        flip: state.flip
      };
    } else if (state.over) savedGame = null;

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        playerCount: state.playerCount, difficulty: state.difficulty,
        preset: state.preset, extraOnHit: state.extraOnHit, names: state.names,
        flip: state.flip, hints: state.hints, muted: state.muted,
        seenHowTo: state.seenHowTo, tally: state.tally, best: state.best,
        game: savedGame
      }));
    } catch (e) { /* storage unavailable — the game still plays fine */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      for (const k of ["playerCount", "mode", "difficulty", "preset", "extraOnHit",
        "flip", "hints", "muted", "seenHowTo"]) {
        if (s[k] !== undefined) state[k] = s[k];
      }
      if (Array.isArray(s.names)) state.names = s.names;
      if (s.tally && Array.isArray(s.tally.wins)) state.tally = s.tally;
      if (s.best && typeof s.best === "object") state.best = s.best;
      if (s.game && s.game.g) savedGame = s.game;
    } catch (e) { /* corrupt or unreadable save — start fresh */ }
  }

  // Validates by replaying: Rules.restore returns null on anything it can't
  // rebuild, so a corrupt save simply makes the Resume button not appear.
  const resumable = () => !!savedGame && !!Rules.restore(savedGame.g);

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

  const setSwitch = (id, on) => $(id).setAttribute("aria-checked", on ? "true" : "false");

  const PRESET_NOTES = {
    small: "Six squares across and three little ships. A quick one — good for a " +
      "five-year-old, or for a game on the way to school.",
    medium: "Eight across, four ships. The middle-sized game.",
    classic: "Ten across and the full five ships — 5, 4, 3, 3 and 2 squares long. " +
      "The proper one. Expect it to take a while."
  };

  // The numbers are measured, not guessed: each opponent was played out over
  // hundreds of full games on the classic sea, which holds 17 ship squares in
  // 100. Anything under about 60 shots is decent play.
  const DIFF_NOTES = {
    easy: "Fires more or less anywhere, and pokes next door when it hits " +
      "something — but it never notices that two hits in a row point somewhere. " +
      "Needs about 63 shots to clear a fleet.",
    medium: "Sweeps the sea in a pattern nothing can hide in, then works along " +
      "the line once it has a hit. About 50 shots.",
    hard: "Works out every place each ship could still be hiding and fires where " +
      "most of them cross. About 44 shots. It is very hard to beat."
  };

  const MODE_NOTES = {
    classic: "You fire, they fire, and the first fleet to go down loses. The " +
      "tablet changes hands after every go.",
    relay: "One of you sinks the whole fleet while the other looks away, then " +
      "you swap and the other does the same. Nobody is told how many shots it " +
      "took until both of you have had your turn — and then you watch the two " +
      "battles play out side by side to find out who was quicker."
  };

  function renderSetup() {
    const isSolo = solo();
    const isRelay = !isSolo && state.mode === "relay";

    $("countNote").textContent = isSolo
      ? "You against " + BOT_NAME + ". It hides its fleet while you hide yours."
      : "Two of you, one device. The screen is cleared in between so nobody can " +
        "see the other fleet.";

    $("modeRow").hidden = isSolo;
    $("modeNote").hidden = isSolo;
    $("modeNote").textContent = MODE_NOTES[state.mode];
    setChooser("modeChooser", state.mode);

    // Nothing to hand another go to when nobody is waiting for one.
    $("extraRow").hidden = isRelay;
    $("extraNote").hidden = isRelay;

    $("diffRow").hidden = !isSolo;
    $("diffNote").hidden = !isSolo;
    $("diffNote").textContent = DIFF_NOTES[state.difficulty];

    $("presetNote").textContent = PRESET_NOTES[state.preset];

    $("flipRow").hidden = isSolo;
    $("flipNote").hidden = !(!isSolo && state.flip);
    setSwitch("flipToggle", state.flip);
    setSwitch("extraToggle", state.extraOnHit);
    setSwitch("hintToggle", state.hints);

    $("namesBox").hidden = isSolo;
    const names = $("namesWrap");
    names.innerHTML = "";
    for (let i = 0; i < 2; i++) {
      const row = document.createElement("label");
      row.className = "name-row";
      row.innerHTML = "<span>" + (i === 0 ? "Goes first" : "Goes second") + "</span>";
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

  const nameSummary = () => "Names: " + (state.names[0] || "Player 1") +
    " and " + (state.names[1] || "Player 2");

  function showScreen(which) {
    $("setup").hidden = which !== "setup";
    $("place").hidden = which !== "place";
    $("game").hidden = which !== "game";
    $("handover").hidden = which !== "handover";
    $("replay").hidden = which !== "replay";
    document.body.classList.toggle("in-game",
      which === "place" || which === "game" || which === "replay");
    if (which !== "place" && which !== "game") document.body.classList.remove("flipped");
    if (which === "place" || which === "game" || which === "replay") {
      fit();
      // Once more after the browser has laid the new screen out — the first call
      // measures a box that is still the old screen's size.
      requestAnimationFrame(fit);
    }
  }

  function fit() {
    const n = curSpec().size;
    if (!$("game").hidden) {
      Ui.fitBig("boardWrap", $("enemyGrid"));
      Ui.fitMini($("ownGrid"), n);
    }
    if (!$("place").hidden) Ui.fitBig("placeWrap", $("placeGrid"));
    if (!$("replay").hidden) fitReplay();
  }

  /* ── Starting ──────────────────────────────────────────────────────────── */

  function makePlayers() {
    return [
      { name: nameOf(0), kind: "human", seat: 0 },
      { name: nameOf(1), kind: solo() ? "cpu" : "human", seat: 1 }
    ];
  }

  function startGame(fresh) {
    state.gen++;
    stopReplay();
    if (fresh) state.tally = { wins: [0, 0], games: 0 };
    savedGame = null;
    state.playing = false;
    state.over = false;
    state.game = null;
    state.aim = null;
    state.lastThink = null;
    closeResult();

    const sp = spec();
    state.boards = [Rules.newBoard(sp), Rules.newBoard(sp)];
    state.players = makePlayers();

    // The computer's fleet goes out now, unseen by anybody.
    for (let seat = 0; seat < 2; seat++) {
      if (isCpu(seat)) Rules.placeRandomly(state.boards[seat]);
    }
    state.queue = [0, 1].filter((seat) => !isCpu(seat));
    nextPlacement(true);
  }

  function nextPlacement(first) {
    if (!state.queue.length) { beginBattle(); return; }
    const seat = state.queue[0];
    if (!solo() && !first) handover(seat, "place");
    else openPlace(seat);
  }

  /* ── Passing the device ────────────────────────────────────────────────── */

  // Both boards come off the page while this is up. That is the whole of the
  // two-player mode's honesty: not a cover over the screen, but nothing to see.
  function handover(seat, what, note) {
    const who = nameOf(seat);
    $("handTitle").textContent = "Pass the tablet to " + who;
    $("handNote").hidden = !note;
    if (note) $("handNote").textContent = note;

    if (what === "place") {
      $("handSub").textContent = who + " — hide your fleet. Don't let anyone watch.";
      state.handGo = () => openPlace(seat);
    } else if (what === "relay") {
      // Never says how the other run went, not even "they finished" — the
      // whole point is that the second player fires without a number to beat.
      $("handSub").textContent = who + " — sink the whole fleet. Take as many " +
        "shots as you need; nobody is counting out loud.";
      state.handGo = () => enterBattle();
    } else if (what === "start") {
      $("handSub").textContent = "Both fleets are hidden. " + who + " fires first.";
      state.handGo = () => enterBattle();
    } else {
      $("handSub").textContent = who + ", it's your go.";
      state.handGo = () => enterBattle();
    }

    showScreen("handover");
    Audio.turn();
  }

  /* ── Hiding the fleet ──────────────────────────────────────────────────── */

  const placeBoard = () => state.boards[state.place.seat];

  function openPlace(seat) {
    state.place.seat = seat;
    state.place.horiz = true;
    state.place.shipId = firstUnplaced();
    state.grids.place = Ui.grid($("placeGrid"), curSpec().size, { onCell: placeTap });
    showScreen("place");
    renderPlace();
  }

  function firstUnplaced() {
    const b = placeBoard();
    const ship = b.ships.find((s) => !Rules.isPlaced(s));
    return ship ? ship.id : b.ships[b.ships.length - 1].id;
  }

  function renderPlace() {
    const b = placeBoard();
    const left = b.ships.filter((s) => !Rules.isPlaced(s)).length;
    const ship = b.ships[state.place.shipId];

    $("placeTitle").textContent = solo()
      ? "Hide your fleet" : nameOf(state.place.seat) + ", hide your fleet";
    $("placeMeta").textContent = left
      ? left + (left === 1 ? " ship still to go" : " ships still to go")
      : "All out — tap Ready";

    Ui.paintOwn(state.grids.place, b, state.place.shipId);
    Ui.tray($("tray"), b, state.place.shipId, pickShip);
    $("readyBtn").disabled = !Rules.allPlaced(b);

    const way = state.place.horiz ? "across" : "down";
    if (!Rules.allPlaced(b)) {
      sayPlace("🚢", "<b>" + ship.emoji + " " + ship.name + "</b> — " + ship.len +
        " squares, going " + way + ". Tap the sea to drop it in, or " +
        "<b>🔄 Turn it</b> to lay it the other way.");
    } else {
      sayPlace("👍", "Every ship is out. Tap one to move it, or <b>Ready</b> when " +
        "you're happy.", "good");
    }

    document.body.classList.toggle(
      "flipped", state.flip && !solo() && state.place.seat === 1
    );
    fit();
  }

  function pickShip(id) {
    const b = placeBoard();
    state.place.shipId = id;
    state.place.horiz = b.ships[id].horiz;
    Audio.tap();
    renderPlace();
  }

  function placeTap(r, c) {
    const b = placeBoard();
    const here = b.cells[Rules.at(b, r, c)];

    // Tapping a ship picks it up again, whichever ship it is. One rule, and it
    // is the one every child tries first.
    if (here >= 0) {
      state.place.shipId = here;
      state.place.horiz = b.ships[here].horiz;
      Rules.lift(b, here);
      Audio.clear();
      renderPlace();
      return;
    }

    const ship = b.ships[state.place.shipId];
    // Slide it back on rather than refusing: tapping near the edge means "put it
    // about here", and a child should not have to count squares to the corner.
    let rr = r, cc = c;
    if (state.place.horiz) cc = Math.min(cc, b.size - ship.len);
    else rr = Math.min(rr, b.size - ship.len);

    if (!Rules.place(b, ship.id, rr, cc, state.place.horiz)) {
      Audio.nope();
      Ui.toast("No room for the " + ship.name + " there.");
      return;
    }
    Audio.place();
    state.place.shipId = firstUnplaced();
    renderPlace();
  }

  function rotateShip() {
    const b = placeBoard();
    const ship = b.ships[state.place.shipId];
    const horiz = !state.place.horiz;
    if (Rules.isPlaced(ship)) {
      let r = ship.r, c = ship.c;
      if (horiz) c = Math.min(c, b.size - ship.len);
      else r = Math.min(r, b.size - ship.len);
      if (!Rules.place(b, ship.id, r, c, horiz)) {
        Audio.nope();
        Ui.toast("It won't turn there — something's in the way.");
        return;
      }
    }
    state.place.horiz = horiz;
    Audio.rotate();
    renderPlace();
  }

  function readyToFight() {
    const b = placeBoard();
    if (!Rules.allPlaced(b)) { Audio.nope(); Ui.toast("Every ship has to be out first."); return; }
    Audio.turn();
    state.queue.shift();
    nextPlacement(false);
  }

  /* ── The battle ────────────────────────────────────────────────────────── */

  function beginBattle() {
    const sp = spec();
    const isRelay = !solo() && state.mode === "relay";
    state.game = Rules.newGame(sp, state.boards, {
      // The extra-go rule needs a turn to hold onto, and relay hasn't got one.
      extraOnHit: state.extraOnHit && !isRelay,
      relay: isRelay
    });
    state.playing = true;
    state.over = false;
    state.busy = false;
    state.aim = null;
    state.lastThink = null;
    state.replay = null;
    buildBattle();
    if (solo()) enterBattle();
    else if (isRelay) {
      handover(0, "relay", "Whoever is not firing: no looking, and no counting.");
    } else handover(0, "start", "Whoever is not firing: no looking at the screen.");
  }

  function buildBattle() {
    const n = curSpec().size;
    state.grids.enemy = Ui.grid($("enemyGrid"), n, { onCell: tapCell });
    state.grids.own = Ui.grid($("ownGrid"), n, { mini: true });
  }

  function enterBattle() {
    showScreen("game");
    Ui.clearToast();
    refresh();
    save();
    beginTurn();
  }

  function beginTurn() {
    if (state.over || !state.game) return;
    if (isCpu(state.game.turn)) { cpuTurn(); return; }
    Audio.turn();
    refresh();
    showStatus();
  }

  function refresh() {
    const g = state.game;
    if (!g) return;
    const seat = g.turn;
    const mine = myTurn();

    $("turnName").textContent = isCpu(seat)
      ? BOT_NAME + " is firing"
      : solo() ? "Your go" : nameOf(seat) + "'s go";
    $("turnName").classList.toggle("cpu", isCpu(seat));

    // Everything below the turn name is written from the seat *holding the
    // device*, not from the seat whose go it is. Otherwise the line under
    // "Robo is firing" would quietly start counting Robo's progress against
    // your fleet while the board underneath still showed Robo's sea.
    const viewer = solo() ? 0 : seat;
    const theirs = state.boards[1 - viewer];
    const left = Rules.afloat(theirs).length;
    $("turnMeta").textContent =
      left + " of " + theirs.ships.length + (left === 1 ? " ship" : " ships") + " left • " +
      Rules.shotsBy(g, viewer) + " shots fired";

    $("enemyHead").textContent = whose(1 - viewer) + " sea";
    $("ownHead").textContent = whose(viewer) + " sea";
    $("enemyFleetHead").textContent = whose(1 - viewer) + " fleet";

    // The big grid is drawn from a view, so the fleet under it is not on the page.
    Ui.paintEnemy(state.grids.enemy, Rules.publicView(state.boards[1 - viewer]),
      state.aim, mine && seat === viewer);
    Ui.paintOwn(state.grids.own, state.boards[viewer]);
    Ui.fleetList($("enemyFleet"), state.boards[1 - viewer].ships, true);
    Ui.fleetList($("ownFleet"), state.boards[viewer].ships, false);

    $("fireBtn").disabled = !mine || !state.aim;
    $("undoBtn").disabled = !solo() || state.busy || !g.log.length;
    $("undoBtn").hidden = !solo();
    $("hintBtn").hidden = !state.hints;
    $("hintBtn").disabled = !mine;

    document.body.classList.toggle(
      "flipped", state.flip && !solo() && !state.over && seat === 1
    );
    fit();
  }

  /* ── Taking a shot ─────────────────────────────────────────────────────── */

  // Two taps to fire: one to take aim, one to let go. A mis-tap in this game
  // costs a whole turn, which is far more annoying than an extra tap.
  function tapCell(r, c) {
    if (!myTurn()) { Audio.nope(); return; }
    const foe = state.boards[1 - state.game.turn];
    if (foe.shots[Rules.at(foe, r, c)] !== Rules.WATER) {
      Audio.nope();
      Ui.toast("You've already fired at " + Rules.square(r, c) + ".");
      return;
    }
    if (state.aim && state.aim.r === r && state.aim.c === c) { fireNow(); return; }
    state.aim = { r, c };
    Audio.tap();
    refresh();
    showStatus();
  }

  function fireNow() {
    if (!myTurn() || !state.aim) { Audio.nope(); return; }
    const { r, c } = state.aim;
    state.aim = null;
    takeShot(r, c);
  }

  function takeShot(r, c) {
    const g = state.game;
    const gen = state.gen;
    const shooter = g.turn;
    const res = Rules.shoot(g, r, c);
    if (!res) { Audio.nope(); return; }

    state.busy = true;
    Audio.shoot();
    refresh();

    // Which board the shell lands on, from where the device is sitting.
    const viewer = solo() ? 0 : shooter;
    const grid = shooter === viewer ? state.grids.enemy : state.grids.own;
    Ui.pop(grid, r, c, res.hit ? "boom" : "splash");

    // Whoever is holding the device is "you", whichever seat that is.
    const who = isCpu(shooter) ? nameOf(shooter) : "You";
    const where = Rules.square(r, c);

    // The shell takes a moment to land, which is what makes a miss feel like a
    // miss. Everything after this point waits for it.
    setTimeout(() => {
      if (gen !== state.gen) return;
      if (res.sank) Audio.sink();
      else if (res.hit) Audio.boom();
      else Audio.splash();
      narrate(res, who, where);
    }, 240);

    save();
    setTimeout(() => {
      if (gen !== state.gen) return;
      state.busy = false;
      if (g.over) { finish(); return; }
      afterShot(res);
    }, res.sank ? 1500 : res.hit ? 1000 : 850);
  }

  function narrate(res, who, where) {
    const mine = who === "You";
    if (res.sank) {
      say("🔥", mine
        ? "Direct hit at " + where + " — you sank " + whose(1 - res.seat) +
          " <b>" + res.sank.name + "</b>!"
        : "Hit at " + where + " — " + who + " sank your <b>" + res.sank.name + "</b>!",
        mine ? "good" : "warn");
      Ui.toast((mine ? "You sank the " : "They sank your ") + res.sank.name + "!");
    } else if (res.hit) {
      say("💥", (mine ? "Hit! Something's at " + where + ". Try next door."
        : who + " hit one of your ships at " + where + "."), mine ? "good" : "warn");
    } else {
      say("💧", (mine ? "Splash — nothing at " + where + "."
        : who + " fired at " + where + " and missed."), "calm");
    }
  }

  function afterShot(res) {
    const g = state.game;
    save();
    if (solo()) { beginTurn(); return; }

    // Relay: you keep firing until the fleet is down. Then, if the other player
    // hasn't had their run, the tablet changes hands — and if they have, the
    // game is already over and finish() has taken it.
    if (g.relay) {
      if (g.done[res.seat] === null) { refresh(); showStatus(); return; }
      Rules.relayNext(g);
      handover(g.turn, "relay");
      return;
    }

    if (g.turn === res.seat) { refresh(); showStatus(); return; }   // another go after a hit
    handover(g.turn, "turn",
      nameOf(res.seat) + " fired at " + Rules.square(res.r, res.c) + " and " +
      (res.sank ? "sank your " + res.sank.name + "." : res.hit ? "hit one of your ships." : "missed."));
  }

  function cpuTurn() {
    const gen = state.gen;
    state.busy = true;
    refresh();
    say("🤖", BOT_NAME + " is working out where to fire…");

    // Two hops on purpose. The first lets "working out…" actually paint; the
    // second holds the shot back long enough to be watched, however fast the
    // answer came.
    setTimeout(() => {
      if (gen !== state.gen) return;
      const target = state.boards[1 - state.game.turn];
      const move = Ai.choose(Rules.publicView(target), state.difficulty);
      if (!move) { state.busy = false; refresh(); return; }
      state.lastThink = move;
      state.busy = false;
      takeShot(move.r, move.c);
    }, 560);
  }

  /* ── The coach line ────────────────────────────────────────────────────── */

  // Never empty during a game, so it never resizes the board mid-turn. What it
  // says leads with whatever is most worth knowing.
  function showStatus() {
    if (!myTurn()) return;
    const g = state.game;
    const view = Rules.publicView(state.boards[1 - g.turn]);
    const f = Ai.facts(view);

    if (state.hints && f.loose) {
      const hits = Rules.liveHits(view);
      say("🎯", f.loose > 1
        ? "You've hit the same ship more than once — you know which way it's " +
          "lying now. Carry the line on."
        : "There's a hit at <b>" + Rules.square(hits[0][0], hits[0][1]) +
          "</b> that hasn't sunk anything. The rest of that ship is right next to it.",
        "warn");
      return;
    }

    if (state.aim) {
      say("🎯", "Aiming at <b>" + Rules.square(state.aim.r, state.aim.c) +
        "</b>. Tap <b>Fire</b>, or tap the square again.");
      return;
    }

    if (state.hints && f.remaining.length === 1) {
      say("🔎", "One ship left, and it's " + f.remaining[0] + " squares long. " +
        Math.round(f.live * 100) + "% of the sea could still be hiding it.", "calm");
      return;
    }

    say("🌊", "Tap a square on their sea to take aim, then <b>Fire</b>.", "calm");
  }

  const say = (face, text, kind) =>
    Ui.coach("coach", '<span class="coach-face">' + face + "</span><span>" + text + "</span>", kind);
  const sayPlace = (face, text, kind) =>
    Ui.coach("placeCoach", '<span class="coach-face">' + face + "</span><span>" + text + "</span>", kind);

  /* ── The end ───────────────────────────────────────────────────────────── */

  function finish() {
    const g = state.game;
    state.over = true;
    state.busy = false;

    // A relay game is decided but not yet watched. Nothing is announced, no
    // sound is played and the score isn't touched until the play-back has run —
    // the second player has just this moment put the tablet down and still
    // doesn't know how they did.
    if (g.relay) { save(); startReplay(); return; }

    const winner = g.winner;
    state.tally.wins[winner]++;
    state.tally.games++;

    if (solo() && winner === 0) {
      const key = curSpec().id;
      const shots = Rules.shotsBy(g, 0);
      if (!state.best[key] || shots < state.best[key]) state.best[key] = shots;
    }

    if (!solo() || winner === 0) { Audio.win(); Ui.confetti(); }
    else Audio.lose();

    refresh();
    save();
    setTimeout(showResult, 1300);
  }

  /* ── The play-back ─────────────────────────────────────────────────────── */

  /* Both runs, stepped through together: one shot each per beat against fresh
     copies of the two seas. The runs really were independent, so this is the
     first moment either player learns anything about the other's — and because
     they are stepped in lock-step, the fleet that goes down first is the one
     whose owner's opponent needed fewer shots. Nothing here can change the
     result; it is read out of the log. */

  const FRAME_MS = [520, 300, 170];   // slower, normal, faster — index into it

  function cloneBoard(src) {
    const b = Rules.newBoard(curSpec());
    for (const s of src.ships) Rules.place(b, s.id, s.r, s.c, s.horiz);
    return b;
  }

  function startReplay() {
    const g = state.game;
    state.replay = {
      logs: [0, 1].map((seat) => g.log.filter((s) => s.seat === seat)),
      // Copies, so the replay can sink ships that are already sunk on the real
      // boards without the result screen's reveal ending up half-painted.
      boards: [cloneBoard(state.boards[0]), cloneBoard(state.boards[1])],
      panels: [],
      at: 0,
      speed: 1,
      timer: null,
      running: true,
      over: false
    };
    for (const id of ["replaySlow", "replayPause", "replaySkip"]) $(id).disabled = false;

    const host = $("replaySeas");
    host.innerHTML = "";
    for (let seat = 0; seat < 2; seat++) {
      // Panel `seat` is the sea being fired AT, so its heading is that seat's
      // name and the count under it belongs to the other player.
      const panel = Ui.seaPanel(state.replay.boards[seat], whose(seat) + " sea");
      state.replay.panels.push(panel);
      host.appendChild(panel.card);
    }

    $("replayTitle").textContent = "The battle";
    $("replayPause").textContent = "⏸ Pause";
    showScreen("replay");
    sayReplay("🎬", "Both of you fired at a sea that never fired back. Here they " +
      "are together — the fleet that goes down first belongs to whoever was " +
      "beaten quicker.", "calm");
    drawReplay();
    fitReplay();
    replayTick();
  }

  // Both seas have to be on screen at once — that is the whole trick of the
  // play-back — so each panel gets half of whichever direction they are laid out
  // in. Which direction that is comes from the stylesheet, and how much of a
  // panel is *not* board — heading, count, padding — is measured rather than
  // guessed, because guessing it is what put the two boards on a scrollbar.
  function fitReplay() {
    const r = state.replay;
    if (!r || !r.panels.length || $("replay").hidden) return;
    const n = curSpec().size;
    const host = $("replaySeas");
    const box = host.getBoundingClientRect();
    if (!box.width) return;
    const side = getComputedStyle(host).flexDirection === "row";

    const apply = (px) => {
      const cell = Math.max(7, Math.min(46, Math.floor(px)));
      for (const p of r.panels) p.el.style.setProperty("--cell", cell + "px");
      return cell;
    };

    // Measure the chrome at a known size, then spend what's left on squares.
    let cell = apply(20);
    const card = r.panels[0].card.getBoundingClientRect();
    const grid = r.panels[0].el.getBoundingClientRect();
    const spareH = card.height - grid.height;
    const spareW = card.width - grid.width;
    const gap = 10;

    const w = (box.width - (side ? gap : 0)) / (side ? 2 : 1) - spareW;
    const h = (box.height - (side ? 0 : gap)) / (side ? 1 : 2) - spareH;
    cell = apply(Math.min(w, h) / n);

    // Then correct for what the arithmetic can't see — borders, shadows, the
    // rounding in every one of those divisions. fitBig settles the big board
    // the same way, and for the same reason: measuring beats predicting.
    for (let pass = 0; pass < 2 && cell > 7; pass++) {
      const overY = host.scrollHeight - host.clientHeight;
      const overX = host.scrollWidth - host.clientWidth;
      if (overY <= 0 && overX <= 0) break;
      const shrink = Math.max(
        overY > 0 ? overY / (side ? 1 : 2) : 0,
        overX > 0 ? overX / (side ? 2 : 1) : 0
      );
      cell = apply(cell - Math.max(1, shrink / n));
    }
  }

  function drawReplay() {
    const r = state.replay;
    for (let seat = 0; seat < 2; seat++) {
      const board = r.boards[seat];
      const shooter = 1 - seat;
      const fired = Math.min(r.at, r.logs[shooter].length);
      const left = Rules.afloat(board).length;
      Ui.paintReveal(r.panels[seat].g, board);
      r.panels[seat].meta.textContent = nameOf(shooter) + " — " + fired +
        (fired === 1 ? " shot" : " shots") + " · " + left +
        (left === 1 ? " ship left" : " ships left");
    }
    $("replayMeta").textContent = "Shot " + r.at;
  }

  // One beat: each player's next shot, fired at the same moment.
  function replayStep() {
    const r = state.replay;
    let best = null;   // the most worth hearing of this beat's shots
    const landed = [];
    for (let shooter = 0; shooter < 2; shooter++) {
      const shot = r.logs[shooter][r.at];
      if (!shot) continue;
      const res = Rules.fire(r.boards[1 - shooter], shot.r, shot.c);
      if (!res) continue;
      landed.push({ panel: r.panels[1 - shooter], shot, res });
      if (!best || (res.sank && !best.sank) || (res.hit && !best.hit)) best = res;
    }
    r.at++;
    drawReplay();
    // Shells land *after* the repaint. paintOwn rewrites every square's class,
    // so a pop set before it would be wiped before it could play — which is why
    // the battle screen fires in this order too.
    for (const l of landed) {
      Ui.pop(l.panel.g, l.shot.r, l.shot.c, l.res.hit ? "boom" : "splash");
    }
    if (best) {
      if (best.sank) Audio.sink();
      else if (best.hit) Audio.boom();
      else Audio.splash();
    }
    // Both logs end on the shot that finished a fleet, so a beaten board here
    // means this beat was somebody's last.
    return Rules.beaten(r.boards[0]) || Rules.beaten(r.boards[1]) ||
      r.at >= Math.max(r.logs[0].length, r.logs[1].length);
  }

  function replayTick() {
    const r = state.replay;
    const gen = state.gen;
    clearTimeout(r.timer);
    r.timer = setTimeout(() => {
      if (gen !== state.gen || !state.replay) return;
      if (replayStep()) { endReplay(); return; }
      replayTick();
    }, FRAME_MS[r.speed]);
  }

  // One button for both, because there is only ever one thing it can do.
  function toggleReplay() {
    const r = state.replay;
    if (!r || r.over) return;
    if (r.running) {
      clearTimeout(r.timer);
      r.timer = null;
      r.running = false;
      $("replayPause").textContent = "▶ Play";
    } else {
      r.running = true;
      $("replayPause").textContent = "⏸ Pause";
      replayTick();
    }
  }

  function skipReplay() {
    const r = state.replay;
    if (!r || r.over) return;
    clearTimeout(r.timer);
    let guard = 0;
    while (!replayStep() && guard++ < 10000) { /* straight to the end */ }
    endReplay();
  }

  function endReplay() {
    const r = state.replay;
    const g = state.game;
    r.over = true;
    clearTimeout(r.timer);
    r.timer = null;
    drawReplay();

    for (const id of ["replaySlow", "replayPause", "replaySkip"]) $(id).disabled = true;

    const winner = g.winner;
    if (winner === -1) {
      sayReplay("🤝", "Both fleets went down on the very same shot. There is " +
        "nothing between you.", "warn");
    } else {
      sayReplay("🏆", "<b>" + whose(1 - winner) + " fleet</b> went down first — " +
        nameOf(winner) + " needed " + g.done[winner] + " shots to " +
        g.done[1 - winner] + ".", "good");
    }

    if (winner >= 0) { state.tally.wins[winner]++; Audio.win(); Ui.confetti(); }
    else Audio.turn();
    state.tally.games++;
    save();
    setTimeout(showResult, 1600);
  }

  // Walking away mid-play-back. The timer outlives the screen otherwise, and it
  // would keep firing shells into a game that has been thrown away.
  function stopReplay() {
    if (!state.replay) return;
    clearTimeout(state.replay.timer);
    state.replay = null;
  }

  const sayReplay = (face, text, kind) =>
    Ui.coach("replayCoach", '<span class="coach-face">' + face + "</span><span>" + text + "</span>", kind);

  function showResult() {
    const g = state.game;
    const winner = g.winner;
    const shots = Rules.shotsBy(g, winner);
    const squares = Rules.fleetSquares(g.spec);
    let icon, title, text;

    if (solo()) {
      if (winner === 0) {
        icon = "🏆";
        title = "You win!";
        text = "You found all " + squares + " squares of " + BOT_NAME + "'s fleet in " +
          shots + " shots.";
        const b = state.best[g.spec.id];
        if (b && b < shots) text += " Your best on this sea is still " + b + ".";
        else if (b === shots) text += " That's your best yet on this sea.";
      } else {
        icon = "🌊";
        title = BOT_NAME + " got there first";
        text = BOT_NAME + " sank your fleet in " + shots + " shots. Yours took " +
          Rules.shotsBy(g, 0) + ". Have another go — hiding them apart is worth more " +
          "than hiding them in the corner.";
      }
    } else if (g.relay && winner === -1) {
      icon = "🤝";
      title = "A dead heat";
      text = "Both of you needed exactly " + g.done[0] + " shots. There is nothing " +
        "to choose between you at all.";
    } else if (g.relay) {
      icon = "🏆";
      title = nameOf(winner) + " wins!";
      text = nameOf(winner) + " cleared the fleet in " + g.done[winner] + " shots. " +
        nameOf(1 - winner) + " took " + g.done[1 - winner] + ". Neither of you knew " +
        "that until just now.";
    } else {
      icon = "🏆";
      title = nameOf(winner) + " wins!";
      text = nameOf(winner) + " sank the whole fleet in " + shots + " shots. " +
        nameOf(1 - winner) + " had " + Rules.shotsBy(g, 1 - winner) + ".";
    }

    $("resultIcon").textContent = icon;
    $("resultTitle").textContent = title;
    $("resultText").textContent = text;

    // Nothing is hidden any more, so both seas come out.
    const reveal = $("resultReveal");
    reveal.innerHTML = "";
    for (let seat = 0; seat < 2; seat++) {
      reveal.appendChild(Ui.boardCard(state.boards[seat], whose(seat) + " sea"));
    }

    renderTally();
    $("againBtn").textContent = "Play again ▶";
    $("resultUndo").hidden = !solo();
    openResult();
  }

  // The running score only means something once there is more than one game in
  // it.
  function renderTally() {
    const box = $("resultTally");
    if (state.tally.games < 2) { box.hidden = true; return; }

    box.innerHTML = "";
    for (let seat = 0; seat < 2; seat++) {
      const row = document.createElement("div");
      row.className = "tally-row";
      row.innerHTML =
        '<span class="tname">' + nameOf(seat) + "</span>" +
        '<span class="tnum">' + state.tally.wins[seat] + "</span>";
      box.appendChild(row);
    }
    const note = document.createElement("p");
    note.className = "howto-caption";
    note.textContent = state.tally.wins[0] === state.tally.wins[1]
      ? "All square after " + state.tally.games + " games."
      : nameOf(state.tally.wins[0] > state.tally.wins[1] ? 0 : 1) + " is ahead.";
    box.appendChild(note);
    box.hidden = false;
  }

  // Walking away from a game in progress. Written down straight away, or the
  // Resume button would offer a game the player has already left behind.
  function abandon() {
    state.gen++;
    stopReplay();
    state.playing = false;
    state.over = false;
    state.game = null;
    savedGame = null;
    save();
    closeResult();
    showScreen("setup");
    renderSetup();
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

  /* ── Undo and hints ────────────────────────────────────────────────────── */

  // Rebuilt by replaying a shortened history rather than by unwinding the
  // board: the restore path is already the one that gets tested hardest, and a
  // second way of reversing a shot would be a second thing to get wrong.
  function undo() {
    const g = state.game;
    if (!solo() || state.busy || !g || !g.log.length) { Audio.nope(); return; }

    const snap = Rules.snapshot(g);
    const log = snap.log;
    while (log.length && log[log.length - 1][0] !== 0) log.pop();   // Robo's replies
    if (!log.length) { Audio.nope(); return; }
    log.pop();                                                      // and your own shot

    const back = Rules.restore(snap);
    if (!back) { Audio.nope(); return; }

    state.gen++;                 // any pending timer belongs to the old line
    // Undoing out of a finished game un-counts it, or the running score ends up
    // ahead of the games actually played.
    if (state.over) {
      state.tally.wins[g.winner]--;
      state.tally.games--;
    }
    state.game = back;
    state.boards = back.boards;
    state.over = false;
    state.busy = false;
    state.aim = null;
    closeResult();

    Audio.undo();
    showScreen("game");
    refresh();
    save();
    showStatus();
  }

  function askHint() {
    if (!myTurn()) { Audio.nope(); return; }
    const gen = state.gen;
    state.busy = true;
    refresh();
    say("💡", "Having a look…");

    setTimeout(() => {
      if (gen !== state.gen) return;
      const view = Rules.publicView(state.boards[1 - state.game.turn]);
      const tip = Ai.hint(view);
      state.busy = false;
      if (!tip) { refresh(); showStatus(); return; }
      // Take aim as well as explaining — the point of a hint is to get a stuck
      // player moving, not to set them a second puzzle.
      state.aim = { r: tip.r, c: tip.c };
      refresh();
      Audio.hint();
      say("💡", tip.text + " Tap <b>Fire</b> when you're ready.");
    }, 60);
  }

  /* ── Menu ──────────────────────────────────────────────────────────────── */

  function openMenu() {
    $("menuSound").textContent = state.muted ? "🔇 Sound is off" : "🔊 Sound is on";
    $("menuHints").textContent = "💡 Hints: " + (state.hints ? "on" : "off");
    $("menuUndo").hidden = !solo();

    const box = $("brainOut");
    box.innerHTML = "";
    if (!solo()) {
      box.innerHTML = '<p class="muted">' + BOT_NAME +
        " isn't playing this game — the two of you are.</p>";
    } else {
      // The heat map is of *your* sea, which is the honest and the useful way
      // round: it shows a child exactly how obvious their own hiding place is.
      const view = Rules.publicView(state.boards[0]);
      const f = Ai.facts(view);
      const think = state.lastThink;
      const grid = document.createElement("div");
      grid.className = "brain-grid";
      grid.innerHTML =
        "<div><b>" + Rules.shotsBy(state.game, 1) + "</b><span>shots fired</span></div>" +
        "<div><b>" + Math.round(f.live * 100) + "%</b><span>of your sea still in play</span></div>" +
        "<div><b>" + (think ? think.ms : 0) + "ms</b><span>thinking</span></div>";
      box.appendChild(grid);

      const wrap = document.createElement("div");
      wrap.className = "heat-wrap";
      wrap.appendChild(Ui.heatCard(view, f.heat, "Where it thinks your ships are"));
      box.appendChild(wrap);
    }
    $("menu").hidden = false;
  }

  function setMuted(v) {
    state.muted = v;
    Audio.setMuted(v);
    for (const id of ["muteBtn", "placeMute", "replayMute"]) {
      $(id).textContent = v ? "🔇" : "🔊";
      $(id).setAttribute("aria-pressed", String(!v));
    }
    save();
  }

  /* ── Resuming ──────────────────────────────────────────────────────────── */

  function resumeGame() {
    if (!savedGame) return;
    const back = Rules.restore(savedGame.g);
    if (!back) return;

    state.gen++;
    state.playerCount = savedGame.playerCount || state.playerCount;
    if (savedGame.mode) state.mode = savedGame.mode;
    if (savedGame.difficulty) state.difficulty = savedGame.difficulty;
    if (Array.isArray(savedGame.names)) state.names = savedGame.names;
    if (savedGame.flip !== undefined) state.flip = savedGame.flip;
    state.preset = back.spec.id;
    state.extraOnHit = back.extraOnHit;

    state.game = back;
    state.boards = back.boards;
    state.players = makePlayers();
    state.playing = true;
    state.over = false;
    state.busy = false;
    state.aim = null;
    state.lastThink = null;
    closeResult();

    state.replay = null;
    buildBattle();
    // A saved two-player game comes back through the handover, because whoever
    // picks the device up next is not necessarily whoever put it down.
    if (solo()) enterBattle();
    else handover(back.turn, back.relay ? "relay" : "turn");
  }

  /* ── Wiring ────────────────────────────────────────────────────────────── */

  function wire() {
    chooser("countChooser", state.playerCount, (v) => {
      state.playerCount = Number(v); renderSetup(); save();
    });
    chooser("modeChooser", state.mode, (v) => { state.mode = v; renderSetup(); save(); });
    chooser("diffChooser", state.difficulty, (v) => { state.difficulty = v; renderSetup(); save(); });
    chooser("presetChooser", state.preset, (v) => { state.preset = v; renderSetup(); save(); });

    $("extraToggle").addEventListener("click", () => {
      state.extraOnHit = !state.extraOnHit; Audio.tap(); renderSetup(); save();
    });
    $("flipToggle").addEventListener("click", () => {
      state.flip = !state.flip; Audio.tap(); renderSetup(); save();
    });
    $("hintToggle").addEventListener("click", () => {
      state.hints = !state.hints; Audio.tap(); renderSetup(); save();
    });

    $("startBtn").addEventListener("click", () => startGame(true));
    $("resumeBtn").addEventListener("click", resumeGame);
    $("howtoBtn").addEventListener("click", () => Tutorial.open());

    $("placeBack").addEventListener("click", abandon);
    $("rotateBtn").addEventListener("click", rotateShip);
    $("randomBtn").addEventListener("click", () => {
      Rules.placeRandomly(placeBoard());
      state.place.shipId = firstUnplaced();
      Audio.place();
      renderPlace();
    });
    $("clearBtn").addEventListener("click", () => {
      const b = placeBoard();
      for (const s of b.ships) Rules.lift(b, s.id);
      state.place.shipId = 0;
      Audio.clear();
      renderPlace();
    });
    $("readyBtn").addEventListener("click", readyToFight);
    $("handGo").addEventListener("click", () => {
      const go = state.handGo;
      state.handGo = null;
      Audio.tap();
      if (go) go();
    });

    $("fireBtn").addEventListener("click", fireNow);
    $("undoBtn").addEventListener("click", undo);
    $("hintBtn").addEventListener("click", askHint);
    $("muteBtn").addEventListener("click", () => setMuted(!state.muted));
    $("placeMute").addEventListener("click", () => setMuted(!state.muted));

    $("menuBtn").addEventListener("click", openMenu);
    $("menuClose").addEventListener("click", () => { $("menu").hidden = true; });
    $("menuSound").addEventListener("click", () => { setMuted(!state.muted); openMenu(); });
    $("menuHints").addEventListener("click", () => {
      state.hints = !state.hints; save(); refresh(); showStatus(); openMenu();
    });
    $("menuUndo").addEventListener("click", () => { $("menu").hidden = true; undo(); });
    $("menuHowto").addEventListener("click", () => { $("menu").hidden = true; Tutorial.open(); });
    $("menuNew").addEventListener("click", () => { $("menu").hidden = true; abandon(); });

    $("againBtn").addEventListener("click", () => { closeResult(); startGame(false); });
    $("resultMenu").addEventListener("click", () => { closeResult(); abandon(); });
    $("resultUndo").addEventListener("click", undo);

    $("peekBtn").addEventListener("click", peekBoard);
    $("peekPill").addEventListener("click", openResult);

    $("replayPause").addEventListener("click", () => { Audio.tap(); toggleReplay(); });
    $("replaySkip").addEventListener("click", () => { Audio.tap(); skipReplay(); });
    $("replaySlow").addEventListener("click", () => {
      const r = state.replay;
      if (!r) return;
      // Three speeds on one button, wrapping round — a child would rather tap
      // the same button again than hunt for the other one.
      r.speed = (r.speed + 2) % 3;
      $("replaySlow").textContent = ["🐢 Slower", "🐇 Normal", "⚡ Faster"][r.speed];
      Audio.tap();
    });
    $("replayBack").addEventListener("click", abandon);
    $("replayMute").addEventListener("click", () => setMuted(!state.muted));

    Tutorial.wire();
    Ui.onResize(fit);

    addEventListener("keydown", (e) => {
      if ($("game").hidden) return;
      if (!$("menu").hidden || !$("howto").hidden || !$("result").hidden) return;
      const n = curSpec().size;
      const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (step) {
        e.preventDefault();
        const a = state.aim || { r: 0, c: 0 };
        const r = Math.max(0, Math.min(n - 1, a.r + (state.aim ? step[0] : 0)));
        const c = Math.max(0, Math.min(n - 1, a.c + (state.aim ? step[1] : 0)));
        state.aim = { r, c };
        refresh();
        showStatus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fireNow();
      } else if (e.key === "u" || e.key === "U") undo();
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

  // Debug hooks for the browser checks, the same ones lemonade-stand carries:
  // measuring beats reading, and a play-back that takes two hundred real taps to
  // reach is a play-back that never gets measured at more than one screen size.
  window.BS.debug = {
    state: () => state,
    game: () => state.game,
    // Drop straight into the play-back with both runs already fired, so the
    // layout can be checked without playing two whole games first.
    fakeRelay: (preset) => {
      state.playerCount = 2;
      state.mode = "relay";
      state.preset = preset || state.preset;
      startGame(true);
      for (const b of state.boards) Rules.placeRandomly(b);
      state.queue = [];
      beginBattle();
      const g = state.game;
      for (let seat = 0; seat < 2; seat++) {
        Rules.relayNext(g);
        const n = g.spec.size;
        for (let i = 0; i < n * n && g.done[seat] === null; i++) {
          Rules.shoot(g, Math.floor(i / n), i % n);
        }
      }
      state.over = true;
      startReplay();
      return { done: g.done.slice(), winner: g.winner };
    }
  };

  if ("serviceWorker" in navigator) {
    addEventListener("load", () => navigator.serviceWorker.register("../sw.js").catch(() => {}));
  }
})();
