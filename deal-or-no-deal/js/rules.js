/* Deal or No Deal — the rules, and nothing else.                               */
/*                                                                              */
/* This file owns four things: what a board is, which box may legally be opened  */
/* next, when the Banker is due to call, and what a game in progress looks like. */
/* It knows nothing about screens, whose go it is, or how mean the Banker should */
/* be — that lives in banker.js.                                                 */
/*                                                                              */
/* Money is in **cents**, everywhere, as whole numbers. A game whose whole point */
/* is averages must not have a rounding error in it, and 0.1 + 0.2 is exactly    */
/* the sort of thing that would put one there. Cents go in, cents come out, and  */
/* `money()` is the only place a dollar sign is ever printed.                    */
"use strict";
window.DND = window.DND || {};

DND.Rules = (function () {

  /* ── The boards ────────────────────────────────────────────────────────── */

  // Full is the real board, to the cent. The other two are shortened versions
  // of the same shape — a long tail of small change, one huge number at the top
  // — because that spread is the whole reason an offer is interesting. Flatten
  // the ladder and the Banker just offers you the average every time.
  const PRESETS = [
    {
      id: "quick", label: "Quick", minutes: "5 min",
      ladder: [1, 10, 50, 100, 500, 2000, 5000, 10000, 50000, 100000],
      schedule: [3, 2, 2, 1]
    },
    {
      id: "classic", label: "Classic", minutes: "10 min",
      ladder: [1, 10, 50, 100, 500, 2000, 5000, 10000, 25000, 50000,
               100000, 250000, 500000, 1000000, 2500000, 5000000],
      schedule: [4, 3, 3, 2, 2]
    },
    {
      id: "full", label: "Full", minutes: "15 min",
      ladder: [1, 10, 50, 100, 500, 1000, 5000, 10000, 25000, 50000, 75000,
               100000, 300000, 500000, 1000000, 1500000, 2000000, 3500000,
               5000000, 7500000, 10000000, 25000000],
      schedule: [5, 3, 3, 3, 3, 3]
    }
  ];

  const specOf = (id) => PRESETS.find((p) => p.id === id) || PRESETS[2];
  const boxCount = (spec) => spec.ladder.length;

  // Every schedule opens all but two boxes: yours, and the one left facing you
  // at the end. That is what makes the last offer a real decision rather than
  // arithmetic, so it is asserted here rather than trusted to the tables above.
  function scheduleOk(spec) {
    const opened = spec.schedule.reduce((a, b) => a + b, 0);
    return opened === spec.ladder.length - 2;
  }
  for (const p of PRESETS) {
    if (!scheduleOk(p)) throw new Error("bad schedule for board " + p.id);
  }

  /* ── Printing money ────────────────────────────────────────────────────── */

  // One function, so the ladder rail, the offer card, the toast and the result
  // screen can never disagree about what 25000000 means. Sub-dollar amounts are
  // the joke of the game and print as cents; everything else takes commas and
  // drops the cents it hasn't got.
  function money(cents) {
    if (cents < 100) return cents + "c";
    const dollars = Math.round(cents / 100);
    return "$" + String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // A shorter form for the box that has just been opened, where "$250,000" is
  // wider than the box it has to fit inside.
  function moneyShort(cents) {
    if (cents < 100) return cents + "c";
    const dollars = cents / 100;
    if (dollars >= 1000) {
      const k = dollars / 1000;
      return "$" + (k >= 100 || k === Math.round(k) ? Math.round(k) : k.toFixed(1)) + "k";
    }
    return "$" + Math.round(dollars);
  }

  /* ── A game ────────────────────────────────────────────────────────────── */

  // `values[i]` is what is inside box number i+1, and it is decided once, at the
  // deal, before anybody has touched anything. `opened[i]` is the only thing
  // that changes as the game runs.
  //
  // `held` is the box the player kept back. It is opened last, whatever else
  // happens — including after a deal, because seeing what you walked away from
  // is the best thirty seconds of the programme.
  function newGame(spec, values) {
    if (!values || values.length !== spec.ladder.length) return null;
    return {
      spec,
      values: values.slice(),
      opened: new Array(values.length).fill(false),
      held: -1,
      held0: -1,         // the box first kept back, before any swap
      round: 0,          // index into spec.schedule
      openedThisRound: 0,
      phase: "pick",     // pick → open → offer → (open …) → swap → playout → done
      offers: [],        // one per round the Banker has called on, in order
      answered: 0,       // offers the player has said something to
      dealt: null,       // cents accepted, or null if they saw it through
      dealtRound: -1,
      swapAsked: false,  // the keep-or-swap question has been settled
      swapped: false,
      opens: []          // box indices in the order they were opened
    };
  }

  const quota = (game) => game.spec.schedule[game.round] || 0;
  const leftThisRound = (game) => Math.max(0, quota(game) - game.openedThisRound);

  // Boxes still sealed, the held one included. This is the list every average in
  // the game is taken over, and the reason it includes the held box is that the
  // player might still end up with it.
  function remainingValues(game) {
    const out = [];
    for (let i = 0; i < game.values.length; i++) if (!game.opened[i]) out.push(game.values[i]);
    return out;
  }

  const remainingCount = (game) => game.values.length - game.opens.length;

  // Boxes still on the table: sealed, and not the one being held back. These are
  // the only ones anybody is allowed to open.
  function tableBoxes(game) {
    const out = [];
    for (let i = 0; i < game.values.length; i++) {
      if (!game.opened[i] && i !== game.held) out.push(i);
    }
    return out;
  }

  const canOpen = (game, i) =>
    (game.phase === "open" || game.phase === "playout") &&
    i >= 0 && i < game.values.length && !game.opened[i] && i !== game.held;

  /* ── Playing ───────────────────────────────────────────────────────────── */

  function pickHeld(game, i) {
    if (game.phase !== "pick") return false;
    if (i < 0 || i >= game.values.length) return false;
    game.held = i;
    game.held0 = i;
    game.phase = "open";
    return true;
  }

  // Returns what was inside, or null if that box could not be opened. The phase
  // moves on here and only here, so there is one place where "the Banker is due"
  // is decided and nowhere for a second answer to come from.
  function open(game, i) {
    if (!canOpen(game, i)) return null;
    game.opened[i] = true;
    game.opens.push(i);

    if (game.phase === "playout") {
      // No quotas and no offers any more — just opening the rest of the board.
      if (tableBoxes(game).length === 0) finish(game);
      return game.values[i];
    }

    game.openedThisRound++;
    if (leftThisRound(game) === 0) game.phase = "offer";
    return game.values[i];
  }

  const offerDue = (game) => game.phase === "offer";

  // The Banker's number for this round, recorded so a resumed game comes back
  // with the same offer on the table rather than a freshly computed one.
  function setOffer(game, cents) {
    if (game.phase !== "offer") return false;
    game.offers[game.round] = cents;
    return true;
  }

  const currentOffer = (game) => (game.phase === "offer" ? game.offers[game.round] : null);

  // DEAL. The money is banked, and the board plays itself out from here so the
  // player finds out what they turned down.
  function takeDeal(game) {
    if (game.phase !== "offer") return false;
    const cents = game.offers[game.round];
    if (typeof cents !== "number") return false;
    game.dealt = cents;
    game.dealtRound = game.round;
    game.answered = game.round + 1;
    game.phase = "playout";
    if (tableBoxes(game).length === 0) finish(game);
    return true;
  }

  // NO DEAL. Either there is another round to play, or there are two boxes left
  // and the only thing still to decide is whether to swap.
  function refuseDeal(game) {
    if (game.phase !== "offer") return false;
    game.answered = game.round + 1;
    game.round++;
    game.openedThisRound = 0;
    game.phase = quota(game) > 0 ? "open" : "swap";
    return true;
  }

  // The swap. Two boxes are left — the one being held and the last one on the
  // table — and taking the other one is exactly as good as keeping this one.
  // Saying so out loud is the point: the game is a coin toss here and it feels
  // like a decision, which is the most useful thing in it.
  function swap(game, take) {
    if (game.phase !== "swap") return false;
    if (take) {
      const other = tableBoxes(game)[0];
      if (other === undefined) return false;
      game.held = other;
      game.swapped = true;
    }
    game.swapAsked = true;
    game.phase = "playout";
    if (tableBoxes(game).length === 0) finish(game);
    return true;
  }

  // The held box goes last. Once it is open there is nothing sealed left and the
  // game is over.
  function openHeld(game) {
    if (game.phase !== "playout" || game.held < 0 || game.opened[game.held]) return null;
    if (tableBoxes(game).length > 0) return null; // not last yet
    game.opened[game.held] = true;
    game.opens.push(game.held);
    finish(game);
    return game.values[game.held];
  }

  function finish(game) {
    if (game.phase === "done") return;
    game.phase = tableBoxes(game).length === 0 && game.opened[game.held] ? "done" : "playout";
  }

  const isOver = (game) => game.phase === "done";

  // What the player walks away with, and what was in their box — which are the
  // same number only when they never dealt.
  function result(game) {
    const inBox = game.held >= 0 ? game.values[game.held] : 0;
    return {
      won: game.dealt !== null ? game.dealt : inBox,
      dealt: game.dealt,
      inBox,
      swapped: game.swapped,
      // Positive means dealing was the right call, by this much.
      beatTheBox: game.dealt !== null ? game.dealt - inBox : 0
    };
  }

  /* ── Save and restore ──────────────────────────────────────────────────── */

  // The board, the box kept back, and the order the rest were opened in *is* the
  // game. Everything else is worked out again on the way back in: restore
  // replays through the same open/deal/swap functions the game itself uses, so
  // there is no second way of rebuilding a position to get wrong, and anything
  // illegal comes back null and simply makes the Resume button not appear.
  //
  // Two things have to be written down because the log alone can't say them. A
  // save taken the moment a round ends looks identical whether the Banker has
  // been answered or not, so `answered` counts the calls that have been replied
  // to; and `held0` is the box originally kept, since a swap moves `held` and
  // the replay has to start where the player did.
  const snapshot = (game) => ({
    preset: game.spec.id,
    values: game.values.slice(),
    held0: game.held0,
    opens: game.opens.slice(),
    offers: game.offers.slice(),
    answered: game.answered,
    dealtRound: game.dealtRound,
    swapAsked: game.swapAsked,
    swapped: game.swapped
  });

  function restore(snap) {
    if (!snap || typeof snap.preset !== "string") return null;
    const spec = PRESETS.find((p) => p.id === snap.preset);
    if (!spec || !Array.isArray(snap.values) || !Array.isArray(snap.opens)) return null;
    if (typeof snap.held0 !== "number") return null;

    const game = newGame(spec, snap.values);
    if (!game) return null;
    if (snap.held0 >= 0 && !pickHeld(game, snap.held0)) return null;

    const offers = snap.offers || [];

    // Works through every question that has already been answered, so the replay
    // is always sitting on an opening when it comes back.
    function settle() {
      for (let guard = 0; guard < spec.schedule.length + 2; guard++) {
        if (game.phase === "offer") {
          if (game.round >= (snap.answered | 0)) return true;   // still on the table
          if (typeof offers[game.round] !== "number") return false;
          if (!setOffer(game, offers[game.round])) return false;
          if (game.round === snap.dealtRound) { if (!takeDeal(game)) return false; }
          else if (!refuseDeal(game)) return false;
        } else if (game.phase === "swap") {
          if (!snap.swapAsked) return true;                      // still to answer
          if (!swap(game, !!snap.swapped)) return false;
        } else return true;
      }
      return false;
    }

    for (const i of snap.opens) {
      if (!settle()) return null;
      // The held box is the last thing opened in any game, and openHeld is the
      // only way to open it — so a log claiming otherwise is rejected here
      // rather than quietly rebuilt into a game nobody could have played.
      if (i === game.held) { if (openHeld(game) === null) return null; }
      else if (open(game, i) === null) return null;
    }
    if (!settle()) return null;

    // A game put down mid-round comes back with the Banker's number still on
    // the table, rather than a fresh one worked out from a different wobble.
    if (game.phase === "offer" && typeof offers[game.round] === "number") {
      setOffer(game, offers[game.round]);
    }
    return game;
  }

  return {
    PRESETS, specOf, boxCount, money, moneyShort,
    newGame, quota, leftThisRound, remainingValues, remainingCount,
    tableBoxes, canOpen, pickHeld, open, offerDue, setOffer, currentOffer,
    takeDeal, refuseDeal, swap, openHeld, isOver, result,
    snapshot, restore
  };
})();
