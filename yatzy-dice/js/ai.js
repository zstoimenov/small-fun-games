/* Yatzy Dice — the computer opponent.                                          */
/*                                                                              */
/* Knows nothing about the DOM, and nothing about either rule set: it only ever  */
/* asks Rules what a hand would score. That is why one opponent plays Yatzy EU   */
/* and Yatzy US equally well, and why a new category would need no changes here. */
/*                                                                              */
/* How it thinks (Medium and Hard): try all 32 ways of keeping some of the five  */
/* dice, roll the rest a few hundred times in its head, and keep the set whose   */
/* average outcome is best. The simulated rolls use a fast little PRNG because   */
/* thousands of imaginary dice per decision is the point — but every die the     */
/* computer actually plays still comes from the crypto source in rng.js.         */
"use strict";
window.YZ = window.YZ || {};

YZ.Ai = (function () {
  const Rules = YZ.Rules;

  /* ── Imagination: a fast PRNG, seeded once from the real entropy source ─── */

  let s = 0;
  function reseed() {
    s = ((YZ.Rng.int(65536) << 16) | YZ.Rng.int(65536)) >>> 0;
    if (s === 0) s = 0x9e3779b9;
  }
  reseed();

  function simRnd() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  }

  function simDie() {
    return 1 + Math.floor(simRnd() * 6);
  }

  /* ── What a box is normally worth ──────────────────────────────────────── */

  // Roughly what each box scores when you play for it — its opportunity cost.
  // Spending a hand on a box for less than this is usually a waste, and that
  // single idea is what stops the opponent dumping a 6 into Chance on turn one.
  const TYPICAL = {
    ones: 2, twos: 4, threes: 6, fours: 8, fives: 10, sixes: 12,
    threeKind: 20, fourKind: 12, fullHouse: 15, smallStraight: 18,
    largeStraight: 12, chance: 22, yatzy: 8,
    onePair: 9, twoPairs: 14
  };

  function typicalFor(ruleset, cat) {
    // EU's kind/straight boxes score differently from US's, so fall back to the
    // box's own fixed value rather than a shared guess.
    if (ruleset.id === "eu") {
      const y = { threeKind: 12, fourKind: 10, smallStraight: 8, largeStraight: 9, fullHouse: 14, yatzy: 6 };
      if (y[cat.id] !== undefined) return y[cat.id];
    }
    return TYPICAL[cat.id] !== undefined ? TYPICAL[cat.id] : 10;
  }

  /* ── Judging a finished hand ───────────────────────────────────────────── */

  // Everything about the player's card that doesn't change while we're thinking,
  // worked out once so the inner loop only does arithmetic. Without this the
  // search re-derives the open boxes and the totals for every imagined hand,
  // which is the difference between a few milliseconds and a frozen tab.
  function makePlan(ruleset, card, weight) {
    const t = Rules.totals(ruleset, card);
    const cats = Rules.openCategories(ruleset, card).map((c) => ({
      cat: c,
      face: c.section === "upper" ? c.face : 0,
      cost: typicalFor(ruleset, c) * weight
    }));
    return {
      ruleset: ruleset,
      card: card,
      cats: cats,
      weight: weight,
      chasingBonus: t.bonus === 0 && t.bonusNeeded > 0,
      // A five-of-a-kind can only trigger joker rules once the top box is gone.
      jokerLive: ruleset.joker && !Rules.isOpen(card, ruleset.topId)
    };
  }

  function allSame(h) {
    return h[0] === h[1] && h[1] === h[2] && h[2] === h[3] && h[3] === h[4];
  }

  // The best a hand can be worth to this card. "Worth" is the score minus what
  // the box would normally give, so a 24 in Chance reads as a small gain while a
  // 24 in Three of a Kind reads as a good one. Late in the game the opportunity
  // cost fades, because there is no longer a better turn to save the hand for.
  function evalHand(hand, plan) {
    // Joker hands are one in 1296 and change which boxes are even legal, so they
    // take the slow, fully correct path rather than complicating the hot loop.
    if (plan.jokerLive && allSame(hand)) return jokerValue(hand, plan);
    let best = -Infinity;
    for (const e of plan.cats) {
      const sc = e.cat.score(hand);
      let v = sc - e.cost;
      // Three of a face keeps the bonus on schedule; four is money ahead.
      if (e.face && plan.chasingBonus) v += (sc - 3 * e.face) * 1.2;
      if (v > best) best = v;
    }
    return best === -Infinity ? 0 : best;
  }

  function jokerValue(hand, plan) {
    const all = Rules.scoreAll(hand, plan.ruleset, plan.card);
    const legal = Rules.legalCategories(plan.ruleset, plan.card, hand);
    let best = -Infinity;
    for (const c of legal) {
      let v = all[c.id] - typicalFor(plan.ruleset, c) * plan.weight;
      if (c.section === "upper" && plan.chasingBonus) v += (all[c.id] - 3 * c.face) * 1.2;
      if (v > best) best = v;
    }
    const extra = plan.ruleset.extraBonus && plan.card.scores[plan.ruleset.topId] === 50
      ? plan.ruleset.extraBonus.points
      : 0;
    return (best === -Infinity ? 0 : best) + extra;
  }

  /* ── Choosing which dice to keep ───────────────────────────────────────── */

  function heldFromMask(mask) {
    return [1, 2, 4, 8, 16].map((bit) => (mask & bit) !== 0);
  }

  function countBits(m) {
    let n = 0;
    while (m) { n += m & 1; m >>= 1; }
    return n;
  }

  // There are 32 subsets of five dice, but with repeated faces many of them keep
  // the same numbers — holding the first 5 or the third 5 is the same decision.
  // Collapsing those typically halves the search for no loss.
  function candidateMasks(dice) {
    const seen = Object.create(null);
    const out = [];
    for (let mask = 0; mask < 32; mask++) {
      const kept = [];
      for (let i = 0; i < 5; i++) if (mask & (1 << i)) kept.push(dice[i]);
      const key = kept.sort().join(",");
      if (seen[key]) continue;
      seen[key] = true;
      out.push(mask);
    }
    return out;
  }

  function searchHolds(ctx, samples, tries) {
    const dice = ctx.dice, ruleset = ctx.ruleset, card = ctx.card;
    const plan = makePlan(ruleset, card, openWeight(ruleset, card));
    const hand = new Array(5); // reused; every score() is pure so this is safe
    let bestMask = 31, bestVal = -Infinity;

    for (const mask of candidateMasks(dice)) {
      // Keeping all five isn't random, so one look at it is the whole story.
      const n = mask === 31 ? 1 : samples;
      let total = 0;
      for (let s2 = 0; s2 < n; s2++) {
        // With two rolls left the opponent gets a second go at the same shape,
        // so we take the better of two draws — a cheap stand-in for "try again".
        let bestTry = -Infinity;
        for (let t = 0; t < tries; t++) {
          for (let i = 0; i < 5; i++) hand[i] = mask & (1 << i) ? dice[i] : simDie();
          const v = evalHand(hand, plan);
          if (v > bestTry) bestTry = v;
        }
        total += bestTry;
      }
      const avg = total / n;
      // Ties go to keeping more dice, which looks more purposeful to watch.
      if (avg > bestVal + 0.0001 ||
          (Math.abs(avg - bestVal) <= 0.0001 && countBits(mask) > countBits(bestMask))) {
        bestVal = avg;
        bestMask = mask;
      }
    }
    return heldFromMask(bestMask);
  }

  // How much the opportunity cost should count: full weight at the start of the
  // game, nothing on the final turn when there is nothing left to save a hand for.
  function openWeight(ruleset, card) {
    const open = Rules.openCategories(ruleset, card).length;
    return Math.min(1, (open - 1) / Math.max(1, ruleset.categories.length - 1));
  }

  // Easy keeps the biggest matching group and nothing else — exactly what a
  // seven-year-old does, and beatable for the same reason.
  function greedyHolds(dice) {
    const c = Rules.counts(dice);
    let face = 1;
    for (let f = 2; f <= 6; f++) if (c[f] > c[face] || (c[f] === c[face] && f > face)) face = f;
    if (c[face] < 2) {
      // Nothing matches — hang on to the high dice only.
      return dice.map((d) => d >= 5);
    }
    return dice.map((d) => d === face);
  }

  /* ── Public decisions ──────────────────────────────────────────────────── */

  // ctx: { ruleset, card, dice, rollsLeft, difficulty }
  function chooseHolds(ctx) {
    if (ctx.rollsLeft <= 0) return [true, true, true, true, true];
    const tries = ctx.rollsLeft >= 2 ? 2 : 1;
    if (ctx.difficulty === "easy") return greedyHolds(ctx.dice);
    if (ctx.difficulty === "medium") return searchHolds(ctx, 20, tries);
    return searchHolds(ctx, 120, tries);
  }

  function chooseCategory(ctx) {
    const { ruleset, card, dice, difficulty } = ctx;
    const all = Rules.scoreAll(dice, ruleset, card);
    const legal = Rules.legalCategories(ruleset, card, dice);

    if (difficulty === "easy") {
      // Mostly takes the biggest number it can see; sometimes just picks one,
      // which is where a kid's win comes from.
      if (legal.length > 1 && YZ.Rng.int(4) === 0) {
        return legal[YZ.Rng.int(legal.length)].id;
      }
      let best = legal[0];
      for (const c of legal) if (all[c.id] > all[best.id]) best = c;
      return best.id;
    }

    // Hard leans harder on opportunity cost than the keep-search does — it is
    // the moment of no return, and holding out for the right box is worth a few
    // points a game. Medium deliberately cares less and takes the easy points.
    const weight = openWeight(ruleset, card) * (difficulty === "medium" ? 0.6 : 1.3);
    const t = Rules.totals(ruleset, card);
    const chasingBonus = t.bonus === 0 && t.bonusNeeded > 0;

    let best = legal[0], bestVal = -Infinity;
    for (const c of legal) {
      const sc = all[c.id];
      let v = sc - typicalFor(ruleset, c) * weight;
      if (c.section === "upper" && chasingBonus) v += (sc - 3 * c.face) * 1.2;
      if (v > bestVal) { bestVal = v; best = c; }
    }
    return best.id;
  }

  /* ── Headless game, for tuning and for YZ.debug.aiTest ─────────────────── */

  // Plays a whole solo game with real dice and returns the final total.
  function simulateGame(rulesetId, difficulty) {
    const ruleset = Rules.get(rulesetId);
    const card = Rules.emptyCard(ruleset);
    for (let round = 0; round < ruleset.categories.length; round++) {
      let dice = YZ.Rng.roll(5);
      for (let rollsLeft = 2; rollsLeft > 0; rollsLeft--) {
        const held = chooseHolds({ ruleset, card, dice, rollsLeft, difficulty });
        if (held.every(Boolean)) break; // happy with the hand
        dice = YZ.Rng.rollKept(dice, held);
      }
      const id = chooseCategory({ ruleset, card, dice, rollsLeft: 0, difficulty });
      const points = Rules.scoreAll(dice, ruleset, card)[id];
      Rules.commit(ruleset, card, id, points, { dice });
    }
    return Rules.totals(ruleset, card).total;
  }

  function benchmark(games, rulesetId, difficulty) {
    let total = 0, best = 0, worst = Infinity;
    for (let i = 0; i < games; i++) {
      const t = simulateGame(rulesetId || "eu", difficulty || "hard");
      total += t;
      if (t > best) best = t;
      if (t < worst) worst = t;
    }
    return { games: games, avg: total / games, best: best, worst: worst };
  }

  return { chooseHolds, chooseCategory, simulateGame, benchmark, reseed };
})();
