/* Battleship — the rules, and nothing else.                                    */
/*                                                                              */
/* This file owns four things: what a fleet is, where a ship may legally sit,    */
/* what a shot does, and what a game in progress looks like. It knows nothing    */
/* about screens, whose go it is, or how clever the opponent should be.          */
/*                                                                              */
/* It also owns the one thing the whole two-player mode rests on: `publicView`.  */
/* A board holds both the ships and the shots fired at them, and the shooter is  */
/* only ever entitled to the shots. Everything that decides where to fire — the  */
/* computer, the hint button — is handed a view built by that function and never */
/* sees a board, so there is exactly one place to check that nobody is peeking.  */
"use strict";
window.BS = window.BS || {};

BS.Rules = (function () {

  /* ── Fleets ────────────────────────────────────────────────────────────── */

  // Names are per length, so a fleet with two three-square ships gets a Cruiser
  // and a Submarine rather than "Cruiser" twice. Saying "you sank my submarine"
  // is half the fun of the game.
  const NAMES = {
    5: ["Carrier"],
    4: ["Battleship"],
    3: ["Cruiser", "Submarine"],
    2: ["Patrol boat", "Speedboat"]
  };
  const EMOJI = { 5: "🚢", 4: "🛳️", 3: "⛵", 2: "🚤" };

  const PRESETS = [
    { id: "small",   label: "Small",   size: 6,  fleet: [3, 2, 2] },
    { id: "medium",  label: "Medium",  size: 8,  fleet: [4, 3, 3, 2] },
    { id: "classic", label: "Classic", size: 10, fleet: [5, 4, 3, 3, 2] }
  ];

  const specOf = (id) => PRESETS.find((p) => p.id === id) || PRESETS[2];

  function shipName(fleet, i) {
    const len = fleet[i];
    let nth = 0;
    for (let j = 0; j < i; j++) if (fleet[j] === len) nth++;
    const pool = NAMES[len] || ["Ship"];
    return pool[nth] || pool[pool.length - 1] + " " + (nth + 1);
  }

  // Squares a fleet takes up altogether — the number of hits it takes to win,
  // and the thing every "how are we doing" line is measured against.
  const fleetSquares = (spec) => spec.fleet.reduce((a, b) => a + b, 0);

  /* ── Naming squares ────────────────────────────────────────────────────── */

  // Columns are letters and rows are numbers, the way everybody has always
  // played it on paper. Every message that names a square goes through here, so
  // the hint, the toast and the lesson can never disagree about what B3 means.
  const LETTERS = "ABCDEFGHIJKLMNOP";
  const square = (r, c) => LETTERS[c] + (r + 1);

  /* ── A board ───────────────────────────────────────────────────────────── */

  // WATER is "nobody has fired here yet". A board holds the shots fired *at* it,
  // which is what makes one board one player's whole side of the game.
  const WATER = 0, MISS = 1, HIT = 2;

  function newBoard(spec) {
    const n = spec.size;
    return {
      size: n,
      spec,
      ships: spec.fleet.map((len, i) => ({
        id: i,
        len,
        name: shipName(spec.fleet, i),
        emoji: EMOJI[len] || "🚤",
        r: -1, c: -1,          // -1 means still in the tray, not on the board
        horiz: true,
        hits: 0
      })),
      cells: new Int8Array(n * n).fill(-1),   // ship id, or -1 for open water
      shots: new Uint8Array(n * n)            // WATER / MISS / HIT
    };
  }

  const at = (board, r, c) => r * board.size + c;
  const inside = (n, r, c) => r >= 0 && c >= 0 && r < n && c < n;

  // Every square a ship covers, given where it is. One function, used by the
  // placer, the renderer, the sinking check and the save file — so a ship can
  // never be drawn in one place and shot at in another.
  function shipCells(ship) {
    const out = [];
    for (let i = 0; i < ship.len; i++) {
      out.push(ship.horiz ? [ship.r, ship.c + i] : [ship.r + i, ship.c]);
    }
    return out;
  }

  const isPlaced = (ship) => ship.r >= 0;
  const sunk = (ship) => ship.hits >= ship.len;

  /* ── Putting ships out ─────────────────────────────────────────────────── */

  // `ignore` lets a ship be tested against the board it is already sitting on,
  // which is what rotating in place needs.
  function canPlace(board, len, r, c, horiz, ignore) {
    const n = board.size;
    if (!inside(n, r, c)) return false;
    const endR = horiz ? r : r + len - 1;
    const endC = horiz ? c + len - 1 : c;
    if (!inside(n, endR, endC)) return false;
    for (let i = 0; i < len; i++) {
      const rr = horiz ? r : r + i;
      const cc = horiz ? c + i : c;
      const owner = board.cells[at(board, rr, cc)];
      if (owner !== -1 && owner !== ignore) return false;
    }
    return true;
  }

  function place(board, id, r, c, horiz) {
    const ship = board.ships[id];
    if (!canPlace(board, ship.len, r, c, horiz, id)) return false;
    lift(board, id);
    ship.r = r; ship.c = c; ship.horiz = horiz;
    for (const [rr, cc] of shipCells(ship)) board.cells[at(board, rr, cc)] = id;
    return true;
  }

  function lift(board, id) {
    const ship = board.ships[id];
    if (!isPlaced(ship)) return;
    for (const [rr, cc] of shipCells(ship)) board.cells[at(board, rr, cc)] = -1;
    ship.r = -1; ship.c = -1;
  }

  const allPlaced = (board) => board.ships.every(isPlaced);

  // Longest ship first, because the long ones are the ones that run out of room.
  // The retry limit is generous and the whole thing restarts if it ever runs
  // out — on the sizes this game uses it has never needed a second attempt.
  function placeRandomly(board) {
    for (let attempt = 0; attempt < 60; attempt++) {
      for (const s of board.ships) lift(board, s.id);
      const order = board.ships.slice().sort((a, b) => b.len - a.len);
      let ok = true;
      for (const ship of order) {
        let done = false;
        for (let tries = 0; tries < 400 && !done; tries++) {
          const horiz = randomInt(2) === 0;
          const r = randomInt(board.size - (horiz ? 0 : ship.len - 1));
          const c = randomInt(board.size - (horiz ? ship.len - 1 : 0));
          done = place(board, ship.id, r, c, horiz);
        }
        if (!done) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  /* ── Firing ────────────────────────────────────────────────────────────── */

  // Returns null for a square that has already been fired at, so a double tap
  // can never cost somebody a turn.
  function fire(board, r, c) {
    if (!inside(board.size, r, c)) return null;
    const i = at(board, r, c);
    if (board.shots[i] !== WATER) return null;

    const id = board.cells[i];
    if (id < 0) {
      board.shots[i] = MISS;
      return { r, c, hit: false, sank: null };
    }
    board.shots[i] = HIT;
    const ship = board.ships[id];
    ship.hits++;
    return { r, c, hit: true, sank: sunk(ship) ? ship : null };
  }

  const afloat = (board) => board.ships.filter((s) => !sunk(s));
  const beaten = (board) => board.ships.every(sunk);
  const hitsTaken = (board) => board.ships.reduce((a, s) => a + s.hits, 0);

  /* ── A game ────────────────────────────────────────────────────────────── */

  // Two ways to run a game, and they differ in exactly one place: whether
  // sinking the last ship ends anything.
  //
  //   taking turns — you fire, they fire, and the first fleet to go down loses.
  //   relay        — one player fires until the whole fleet is down, and then
  //                  the other does the same against a sea that has never been
  //                  touched. Both runs are complete games against a fixed
  //                  target, so they can be played in either order, on the same
  //                  device, without either player learning anything from the
  //                  other. Fewest shots wins, which nobody finds out until the
  //                  two runs are replayed side by side.
  function newGame(spec, boards, opts) {
    return {
      spec,
      boards,                       // boards[seat] is that seat's own waters
      turn: 0,
      over: false,
      winner: -1,
      log: [],                      // every shot, in order — the whole history
      extraOnHit: !!(opts && opts.extraOnHit),
      relay: !!(opts && opts.relay),
      // Relay only: how many shots each seat needed, once they're finished.
      // null while a seat is still firing, which is also the only "whose go is
      // it" this mode has.
      done: [null, null]
    };
  }

  // The seat whose go it is fires at the other seat's waters. The turn only
  // changes hands here, so "do you go again after a hit" is one line.
  function shoot(game, r, c) {
    if (game.over) return null;
    const seat = game.turn;
    if (game.relay && game.done[seat] !== null) return null;   // that run is over
    const res = fire(game.boards[1 - seat], r, c);
    if (!res) return null;
    res.seat = seat;
    game.log.push({ seat, r, c });

    if (beaten(game.boards[1 - seat])) {
      if (!game.relay) { game.over = true; game.winner = seat; }
      else {
        game.done[seat] = shotsBy(game, seat);
        // The game is only over when both runs are in. Neither player can be
        // told who won before that, because until the second run is played
        // there is nothing to compare against.
        if (game.done[0] !== null && game.done[1] !== null) {
          game.over = true;
          game.winner = relayWinner(game);
        }
      }
    } else if (!game.relay && !(game.extraOnHit && res.hit)) game.turn = 1 - seat;
    return res;
  }

  // Fewest shots. A dead heat is a real result here — both fleets are the same
  // size and both players are shooting at one — so it gets said rather than
  // broken by a rule nobody would agree with.
  function relayWinner(game) {
    const [a, b] = game.done;
    if (a === null || b === null) return -1;
    return a === b ? -1 : (a < b ? 0 : 1);
  }

  // Hand the device on: the seat that has finished stands down, and the one
  // that hasn't starts. Returns the seat now firing, or -1 if both are done.
  function relayNext(game) {
    for (let i = 0; i < 2; i++) {
      if (game.done[i] === null) { game.turn = i; return i; }
    }
    return -1;
  }

  const shotsBy = (game, seat) => game.log.filter((s) => s.seat === seat).length;

  /* ── What the shooter is allowed to know ───────────────────────────────── */

  // The only door between one player's fleet and the other player's decisions.
  // Everything in it is something the shooter has been told out loud: where the
  // shots went, and which of those squares turned out to be a ship that has
  // since gone down. Nothing that reads a view can cheat, because there is
  // nothing in a view to cheat with.
  function publicView(board) {
    const n = board.size;
    const sunkCells = new Uint8Array(n * n);
    const sunkLens = [];
    const leftLens = [];
    for (const ship of board.ships) {
      if (sunk(ship)) {
        sunkLens.push(ship.len);
        for (const [r, c] of shipCells(ship)) sunkCells[at(board, r, c)] = 1;
      } else {
        leftLens.push(ship.len);
      }
    }
    return {
      size: n,
      shots: board.shots.slice(),
      sunkCells,                                  // hits that are accounted for
      sunkLens,
      remaining: leftLens.sort((a, b) => b - a)   // longest first: the search wants it that way
    };
  }

  // Hits that no sunk ship explains — the loose ends a hunter follows up.
  function liveHits(view) {
    const out = [];
    for (let i = 0; i < view.shots.length; i++) {
      if (view.shots[i] === HIT && !view.sunkCells[i]) {
        out.push([Math.floor(i / view.size), i % view.size]);
      }
    }
    return out;
  }

  /* ── Random numbers ────────────────────────────────────────────────────── */

  // crypto rather than Math.random: where a fleet is hiding is the whole game,
  // and a run of predictable layouts is exactly what a determined nine-year-old
  // notices. Falls back quietly if the browser hasn't got it.
  function randomInt(n) {
    if (n <= 1) return 0;
    const c = window.crypto || window.msCrypto;
    if (c && c.getRandomValues) {
      // Reject the tail of the range so every value stays equally likely.
      const limit = Math.floor(0xffffffff / n) * n;
      const buf = new Uint32Array(1);
      for (let tries = 0; tries < 32; tries++) {
        c.getRandomValues(buf);
        if (buf[0] < limit) return buf[0] % n;
      }
    }
    return Math.floor(Math.random() * n);
  }

  const pick = (list) => list[randomInt(list.length)];

  /* ── Save and restore ──────────────────────────────────────────────────── */

  // Where the ships are plus every shot fired *is* the game. Hits, sinkings and
  // whose go it is are all worked out again on the way back in, so a saved game
  // can never come back showing a hit on a square with no ship under it.
  const snapshot = (game) => ({
    preset: game.spec.id,
    extraOnHit: game.extraOnHit,
    relay: game.relay,
    ships: game.boards.map((b) => b.ships.map((s) => [s.r, s.c, s.horiz ? 1 : 0])),
    log: game.log.map((s) => [s.seat, s.r, s.c])
  });

  function restore(snap) {
    if (!snap || typeof snap.preset !== "string") return null;
    const spec = PRESETS.find((p) => p.id === snap.preset);
    if (!spec || !Array.isArray(snap.ships) || snap.ships.length !== 2) return null;

    const boards = [newBoard(spec), newBoard(spec)];
    for (let seat = 0; seat < 2; seat++) {
      const list = snap.ships[seat];
      if (!Array.isArray(list) || list.length !== spec.fleet.length) return null;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!Array.isArray(p) || !place(boards[seat], i, p[0], p[1], !!p[2])) return null;
      }
    }

    const game = newGame(spec, boards, { extraOnHit: snap.extraOnHit, relay: snap.relay });
    for (const s of (snap.log || [])) {
      if (!Array.isArray(s)) return null;
      // A relay log is two blocks, not an alternation: the turn only moves on
      // when the seat firing has finished its run. Anything else — a seat
      // firing early, or firing on after it was done — fails here, the same as
      // an out-of-order shot always has.
      if (s[0] !== game.turn) {
        if (!game.relay || game.done[game.turn] === null) return null;
        relayNext(game);
        if (s[0] !== game.turn) return null;
      }
      if (!shoot(game, s[1], s[2])) return null;                   // illegal shot
    }
    // A game comes back with the turn on somebody who can actually fire. A relay
    // log that stops exactly on the shot which finished the first run would
    // otherwise restore pointing at the seat that has just stood down.
    if (game.relay && !game.over) relayNext(game);
    return game;
  }

  return {
    PRESETS, NAMES, EMOJI, LETTERS, WATER, MISS, HIT,
    specOf, shipName, fleetSquares, square,
    newBoard, at, inside, shipCells, isPlaced, sunk,
    canPlace, place, lift, allPlaced, placeRandomly,
    fire, afloat, beaten, hitsTaken,
    newGame, shoot, shotsBy, publicView, liveHits, relayNext, relayWinner,
    randomInt, pick, snapshot, restore
  };
})();
