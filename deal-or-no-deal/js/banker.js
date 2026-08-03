/* Deal or No Deal — the Banker.                                                */
/*                                                                              */
/* Every other game in this collection has an ai.js that searches. This one has  */
/* no tree to search: the board is pure chance and there is nothing to work out  */
/* about it. What there is instead is a *price*, and the whole game is whether   */
/* you take it.                                                                  */
/*                                                                              */
/* So the offer is built out of three numbers, and all three are shown to the    */
/* player in the menu panel, because a child who can see why the offer is small  */
/* early on has understood the game:                                             */
/*                                                                              */
/*   1. The average of what is left. Add up the sealed boxes, divide by how many */
/*      there are. That is what the board is worth if you play it a thousand     */
/*      times.                                                                    */
/*   2. The Banker's cut. A slice of that average, small at the start and nearly */
/*      all of it at the end. An early lowball is the only reason to carry on.   */
/*   3. Big money still in play. When most of the average comes from one box,    */
/*      the Banker is buying a lottery ticket off you and pays less for it.      */
/*                                                                              */
/* Nothing here is random except a wobble of a few percent, so the same board in */
/* the same state always gets about the same call.                               */
"use strict";
window.DND = window.DND || {};

DND.Banker = (function () {
  const Rules = DND.Rules;

  /* ── One Banker, for everybody ─────────────────────────────────────────── */

  // The difficulty picker does **not** touch the offers. Every other game here
  // keeps difficulty to the opponent's skill — Hard doesn't shrink the Connect
  // Four board or reshuffle Battleship's sea — and the same rule is what stops
  // this one tying itself in a knot. A stingier Banker on Hard makes the human's
  // game harder and Robo's takings smaller at the same time, so "Hard" would end
  // up the level with the *lowest* score to beat. Measured, that is exactly what
  // happened. The board size picker is where "how hard is this game" lives.
  //
  // START and END are the Banker's cut at the first and last call.
  const START = 0.38;
  const END = 0.98;

  // The cut climbs faster than the rounds do — an offer that grew in a straight
  // line would make the middle of the game a formality. 1.6 keeps the first
  // three calls cheap and puts the money in the last two.
  const CURVE = 1.6;

  // How hard the big-money discount bites, and how much a call wobbles.
  const RISK = 0.55;
  const WOBBLE = 0.05;

  // Robo's nerve: the share of the average it wants to see before it deals.
  // These are measurements, not opinions — see the note by roboDeals.
  const LEVELS = {
    easy:   { nerve: 0.78 },
    medium: { nerve: 0.65 },
    hard:   { nerve: 0.55 }
  };
  const levelOf = (id) => LEVELS[id] || LEVELS.medium;

  /* ── What the board is worth ───────────────────────────────────────────── */

  // Sum, count, average, biggest, smallest, and how much of the average rides on
  // that one biggest box. `lead` is 0 when every sealed box holds the same and 1
  // when a single box is the whole board — which is what the last round of every
  // game turns into.
  function value(values) {
    let sum = 0, high = -1, low = Infinity;
    for (const v of values) {
      sum += v;
      if (v > high) high = v;
      if (v < low) low = v;
    }
    const n = values.length;
    const share = sum > 0 ? high / sum : 0;
    const fair = 1 / n;
    return {
      n, sum, high, low,
      ev: n ? sum / n : 0,
      share,
      lead: n > 1 ? Math.max(0, (share - fair) / (1 - fair)) : 0
    };
  }

  /* ── The call ──────────────────────────────────────────────────────────── */

  // Offers land on numbers people can repeat. Nobody on television has ever been
  // offered $9,377.
  function roundOffer(cents) {
    const step =
      cents >= 1000000 ? 10000 :   // $10,000+  → nearest $100
      cents >= 100000  ? 1000  :   // $1,000+   → nearest $10
      cents >= 10000   ? 100   :   // $100+     → nearest $1
      cents >= 1000    ? 10    :   // $10+      → nearest 10c
      1;
    return Math.max(step, Math.round(cents / step) * step);
  }

  // Returns the offer *and* its working, because the working is shown in the
  // menu and quoted by the hint. Nothing downstream recomputes any of it.
  function think(game) {
    const v = value(Rules.remainingValues(game));
    const rounds = game.spec.schedule.length;
    const progress = Math.min(1, (game.round + 1) / rounds);

    const cut = START + (END - START) * Math.pow(progress, CURVE);

    // The big-money discount fades as the game goes on but never disappears:
    // the last offer of a game with the top prize still live is exactly when the
    // Banker most wants to buy it cheaply.
    const risk = 1 - RISK * v.lead * (1 - 0.6 * progress);

    // A few percent either way, so two identical boards don't get word-for-word
    // identical calls. Small enough that it can never turn a good offer bad.
    const wobble = 1 + (Math.random() - 0.5) * 2 * WOBBLE;

    let cents = roundOffer(v.ev * cut * risk * wobble);

    // The Banker will not offer more than the best box left, nor less than the
    // worst — either would be free money or an insult, and both are the kind of
    // thing a rounding step does when nobody is looking.
    cents = Math.max(v.low, Math.min(v.high, cents));

    return {
      cents,
      ev: v.ev, sum: v.sum, count: v.n, high: v.high, low: v.low,
      lead: v.lead, cut, risk, progress,
      round: game.round + 1, rounds,
      // The share of the average being offered — the one number worth reading.
      ratio: v.ev > 0 ? cents / v.ev : 0
    };
  }

  const offer = (game) => think(game).cents;

  /* ── Robo ──────────────────────────────────────────────────────────────── */

  // Robo deals once the offer is a big enough share of the average for its
  // nerve, and the three nerves are measurements rather than opinions.
  //
  // The thing that has to be measured is *which* number to measure. Refusing
  // every offer wins the board average by construction, so a greedier Robo
  // always has the higher mean take and the mean cannot rank these at all. What
  // separates good play from bad here is the **typical** result. Over 20,000
  // full boards:
  //
  //     level   deals   median take   walks away with small change
  //     easy     53%        $2,550                  46%
  //     medium  100%       $10,100                  23%
  //     hard    100%       $12,000                   7%
  //
  // Hard is within a few hundred dollars of the best median any fixed threshold
  // manages against this Banker, and it busts a seventh as often as Easy.
  //
  // Easy is the same shape as Easy in Mastermind and Battleship: it never does
  // anything daft, it just misses one idea — that the average is being propped
  // up by one big box it probably hasn't got. So it holds out for an offer near
  // the whole average, and usually ends up gambling on the last two boxes.
  function roboDeals(game, difficulty) {
    const t = think(game);
    return t.ratio >= levelOf(difficulty).nerve;
  }

  // Robo takes the swap as often as not. There is nothing to know, and a robot
  // that always kept its box would look like it knew something.
  const roboSwaps = () => Math.random() < 0.5;

  /* ── The hint ──────────────────────────────────────────────────────────── */

  // Names an action and the reason, like the hint in every other game here. The
  // reason is the honest one: an offer above the average is free money, and an
  // offer below it is the price of a go on the board.
  function advise(game) {
    const t = think(game);
    const m = Rules.money;
    const pct = Math.round(t.ratio * 100);

    if (t.ratio >= 1) {
      return {
        deal: true,
        text: "Deal. " + m(t.cents) + " is more than the boxes are worth on average (" +
              m(Math.round(t.ev)) + "). That's above the odds — take it."
      };
    }
    if (t.ratio >= 0.88) {
      return {
        deal: true,
        text: "Deal. " + m(t.cents) + " is " + pct + "% of the " + m(Math.round(t.ev)) +
              " average, and " + t.count + " boxes is not many to gamble on."
      };
    }
    if (t.lead > 0.5 && t.ratio >= 0.7) {
      return {
        deal: true,
        text: "Close one. It's only " + pct + "% of the average — but nearly all of " +
              "that average is the " + m(t.high) + " box, and there's one of those " +
              "and " + (t.count - 1) + " others."
      };
    }
    return {
      deal: false,
      text: "No deal. " + m(t.cents) + " is only " + pct + "% of the " +
            m(Math.round(t.ev)) + " the boxes average, and " + m(t.high) +
            " is still out there."
    };
  }

  return { LEVELS, levelOf, value, roundOffer, think, offer, roboDeals, roboSwaps, advise };
})();
