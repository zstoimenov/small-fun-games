/* Yatzy Dice — the two rule sets, and every scoring decision in the game.       */
/*                                                                              */
/* This file knows nothing about the DOM. It is plain data plus pure functions,  */
/* which is what lets one scorecard renderer, one computer opponent and one      */
/* tutorial serve both rule sets without a second copy of anything.              */
/*                                                                              */
/*   "us" — Yatzy US: 13 boxes, 35-point bonus at 63, joker rules.             */
/*   "eu" — Yatzy EU: 15 boxes with pairs, 50-point bonus at 63.                */
/*                                                                              */
/* A scorecard is { scores: { catId: number|null }, jokers: n, manual: {id:true} }*/
"use strict";
window.YZ = window.YZ || {};

YZ.Rules = (function () {
  /* ── Dice helpers ──────────────────────────────────────────────────────── */

  // counts[3] is how many 3s are in the hand. Index 0 is unused so the face
  // value can be used directly as the index everywhere below.
  function counts(dice) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dice) c[d]++;
    return c;
  }

  function sum(dice) {
    let t = 0;
    for (const d of dice) t += d;
    return t;
  }

  // Longest run of consecutive faces present in the hand.
  function runLength(dice) {
    const c = counts(dice);
    let best = 0, run = 0;
    for (let f = 1; f <= 6; f++) {
      run = c[f] ? run + 1 : 0;
      if (run > best) best = run;
    }
    return best;
  }

  // Highest face appearing at least n times, or 0.
  function highestOfAKind(dice, n) {
    const c = counts(dice);
    for (let f = 6; f >= 1; f--) if (c[f] >= n) return f;
    return 0;
  }

  function hasNOfAKind(dice, n) {
    return highestOfAKind(dice, n) > 0;
  }

  // Exact set of faces, ignoring order — used for the strict Yatzy straights.
  function isExactly(dice, faces) {
    const c = counts(dice);
    return faces.every((f) => c[f] === 1);
  }

  /* ── Shared category builders ──────────────────────────────────────────── */

  // Ones through Sixes are identical in both rule sets: add up just that face.
  function upperCategories() {
    const names = ["Ones", "Twos", "Threes", "Fours", "Fives", "Sixes"];
    return names.map((label, i) => {
      const face = i + 1;
      return {
        id: ["ones", "twos", "threes", "fours", "fives", "sixes"][i],
        label: label,
        section: "upper",
        face: face,
        hint: "Add up only your " + face + "s. Nothing else counts.",
        example: [face, face, face, 2 === face ? 5 : 2, 6 === face ? 1 : 6],
        score: (dice) => counts(dice)[face] * face
      };
    });
  }

  const chance = {
    id: "chance",
    label: "Chance",
    section: "lower",
    hint: "Add up all five dice, whatever they are. A safe place for a messy roll.",
    example: [2, 3, 4, 5, 6],
    score: (dice) => sum(dice)
  };

  /* ── Yatzy US (the North American game) ────────────────────────────────── */

  const US = {
    id: "us",
    name: "Yatzy US",
    blurb: "The classic 13-box game. Bonus 35 if your top half reaches 63.",
    topName: "Yatzy",
    upperBonus: { threshold: 63, points: 35 },
    // Rolling another five-of-a-kind after the top box is already filled with 50.
    extraBonus: { points: 100, label: "Extra Yatzy" },
    joker: true,
    categories: upperCategories().concat([
      {
        id: "threeKind",
        label: "Three of a Kind",
        section: "lower",
        hint: "Three dice the same. Scores the total of all five dice.",
        example: [4, 4, 4, 2, 6],
        score: (dice) => (hasNOfAKind(dice, 3) ? sum(dice) : 0)
      },
      {
        id: "fourKind",
        label: "Four of a Kind",
        section: "lower",
        hint: "Four dice the same. Scores the total of all five dice.",
        example: [5, 5, 5, 5, 3],
        score: (dice) => (hasNOfAKind(dice, 4) ? sum(dice) : 0)
      },
      {
        id: "fullHouse",
        label: "Full House",
        section: "lower",
        points: 25,
        hint: "Three of one number and two of another. Always worth 25.",
        example: [3, 3, 3, 6, 6],
        // Strictly 3 + 2 of different numbers. Five of a kind only fills this
        // box through the joker rule, which scoreAll applies separately.
        score: (dice) => {
          const c = counts(dice);
          return c.indexOf(3) > 0 && c.indexOf(2) > 0 ? 25 : 0;
        }
      },
      {
        id: "smallStraight",
        label: "Small Straight",
        section: "lower",
        points: 30,
        hint: "Four numbers in a row, like 3-4-5-6. Always worth 30.",
        example: [2, 3, 4, 5, 5],
        score: (dice) => (runLength(dice) >= 4 ? 30 : 0)
      },
      {
        id: "largeStraight",
        label: "Large Straight",
        section: "lower",
        points: 40,
        hint: "All five in a row: 1-2-3-4-5 or 2-3-4-5-6. Always worth 40.",
        example: [1, 2, 3, 4, 5],
        score: (dice) => (runLength(dice) >= 5 ? 40 : 0)
      },
      {
        id: "yatzy",
        label: "Yatzy",
        section: "lower",
        points: 50,
        big: true,
        hint: "All five dice the same. The big one — 50 points.",
        example: [6, 6, 6, 6, 6],
        score: (dice) => (hasNOfAKind(dice, 5) ? 50 : 0)
      },
      chance
    ])
  };

  /* ── Yatzy EU (the Scandinavian game) ──────────────────────────────────── */

  const EU = {
    id: "eu",
    name: "Yatzy EU",
    blurb: "The Nordic 15-box game, with pairs. Bonus 50 if your top half reaches 63.",
    topName: "Yatzy",
    upperBonus: { threshold: 63, points: 50 },
    extraBonus: null,
    joker: false,
    categories: upperCategories().concat([
      {
        id: "onePair",
        label: "One Pair",
        section: "lower",
        hint: "Two dice the same. Scores those two added up — pick the biggest pair.",
        example: [6, 6, 3, 2, 1],
        score: (dice) => highestOfAKind(dice, 2) * 2
      },
      {
        id: "twoPairs",
        label: "Two Pairs",
        section: "lower",
        hint: "Two different pairs. Scores all four of those dice added up.",
        example: [5, 5, 2, 2, 6],
        score: (dice) => {
          const c = counts(dice);
          const pairs = [];
          for (let f = 6; f >= 1; f--) if (c[f] >= 2) pairs.push(f);
          return pairs.length >= 2 ? (pairs[0] + pairs[1]) * 2 : 0;
        }
      },
      {
        id: "threeKind",
        label: "Three of a Kind",
        section: "lower",
        hint: "Three dice the same. Scores just those three added up.",
        example: [4, 4, 4, 2, 6],
        score: (dice) => highestOfAKind(dice, 3) * 3
      },
      {
        id: "fourKind",
        label: "Four of a Kind",
        section: "lower",
        hint: "Four dice the same. Scores just those four added up.",
        example: [5, 5, 5, 5, 3],
        score: (dice) => highestOfAKind(dice, 4) * 4
      },
      {
        id: "smallStraight",
        label: "Small Straight",
        section: "lower",
        points: 15,
        hint: "Exactly 1-2-3-4-5. Always worth 15.",
        example: [1, 2, 3, 4, 5],
        score: (dice) => (isExactly(dice, [1, 2, 3, 4, 5]) ? 15 : 0)
      },
      {
        id: "largeStraight",
        label: "Large Straight",
        section: "lower",
        points: 20,
        hint: "Exactly 2-3-4-5-6. Always worth 20.",
        example: [2, 3, 4, 5, 6],
        score: (dice) => (isExactly(dice, [2, 3, 4, 5, 6]) ? 20 : 0)
      },
      {
        id: "fullHouse",
        label: "Full House",
        section: "lower",
        hint: "Three of one number and two of another. Scores all five dice added up.",
        example: [3, 3, 3, 6, 6],
        score: (dice) => {
          const c = counts(dice);
          return c.indexOf(3) > 0 && c.indexOf(2) > 0 ? sum(dice) : 0;
        }
      },
      chance,
      {
        id: "yatzy",
        label: "Yatzy",
        section: "lower",
        points: 50,
        big: true,
        hint: "All five dice the same. The big one — 50 points.",
        example: [6, 6, 6, 6, 6],
        score: (dice) => (hasNOfAKind(dice, 5) ? 50 : 0)
      }
    ])
  };

  const RULESETS = { eu: EU, us: US };

  // Both rule sets call five of a kind the same thing; the joker rules need to
  // know which box that is.
  US.topId = "yatzy";
  EU.topId = "yatzy";

  // EU is the default, so an unknown id lands there rather than nowhere.
  function get(id) {
    return RULESETS[id] || EU;
  }

  function categoryById(ruleset, id) {
    return ruleset.categories.find((c) => c.id === id) || null;
  }

  /* ── Scorecards ────────────────────────────────────────────────────────── */

  function emptyCard(ruleset) {
    const scores = {};
    for (const c of ruleset.categories) scores[c.id] = null;
    return { scores: scores, jokers: 0, manual: {} };
  }

  function isOpen(card, id) {
    return card.scores[id] === null || card.scores[id] === undefined;
  }

  function openCategories(ruleset, card) {
    return ruleset.categories.filter((c) => isOpen(card, c.id));
  }

  function isComplete(ruleset, card) {
    return openCategories(ruleset, card).length === 0;
  }

  /* ── Joker rules (Yatzy US only) ───────────────────────────────────────── */

  // A second five-of-a-kind is worth 100 on top, but only once the top box has
  // actually been filled with 50. A zeroed top box earns no bonus.
  function earnsExtraBonus(ruleset, card, dice) {
    if (!ruleset.extraBonus) return false;
    if (!hasNOfAKind(dice, 5)) return false;
    return card.scores[ruleset.topId] === 50;
  }

  // With the top box already used, a five-of-a-kind becomes a joker: it must go
  // in its own upper box if that is still open, and otherwise it may go anywhere
  // — filling Full House and the straights at their full face value.
  function isJoker(ruleset, card, dice) {
    return ruleset.joker && hasNOfAKind(dice, 5) && !isOpen(card, ruleset.topId);
  }

  // Which open boxes the player is actually allowed to use for this hand. Nearly
  // always "all of them" — the joker rule is the one exception.
  function legalCategories(ruleset, card, dice) {
    const open = openCategories(ruleset, card);
    if (!dice || dice.length !== 5 || !isJoker(ruleset, card, dice)) return open;
    const ownUpper = ruleset.categories.find(
      (c) => c.section === "upper" && c.face === dice[0]
    );
    if (ownUpper && isOpen(card, ownUpper.id)) return [ownUpper];
    return open;
  }

  /* ── Scoring a hand ────────────────────────────────────────────────────── */

  // What every category in the rule set would score for these dice, given the
  // player's card (which only matters for joker rules). The live preview, the
  // scorecard-only mode and the computer opponent all read this one function.
  function scoreAll(dice, ruleset, card) {
    const out = {};
    const joker = card ? isJoker(ruleset, card, dice) : false;
    for (const c of ruleset.categories) {
      let v = c.score(dice);
      if (joker && (c.id === "fullHouse" || c.id === "smallStraight" || c.id === "largeStraight")) {
        v = c.points || v; // jokers fill these at full value
      }
      out[c.id] = v;
    }
    return out;
  }

  function scoreFor(dice, ruleset, card, id) {
    return scoreAll(dice, ruleset, card)[id];
  }

  // Writes a chosen category onto the card and returns what happened, so the UI
  // can celebrate the 100-point extra bonus without recomputing anything.
  function commit(ruleset, card, id, points, opts) {
    // Checked before the write: filling the top box with 50 right now must not
    // count as "the top box was already 50" and pay itself a bonus.
    const bonus =
      opts && opts.dice && earnsExtraBonus(ruleset, card, opts.dice)
        ? ruleset.extraBonus.points
        : 0;
    card.scores[id] = points;
    if (opts && opts.manual) card.manual[id] = true;
    if (bonus) card.jokers++;
    return { id: id, points: points, extraBonus: bonus };
  }

  /* ── Totals ────────────────────────────────────────────────────────────── */

  function totals(ruleset, card) {
    let upper = 0, lower = 0;
    for (const c of ruleset.categories) {
      const v = card.scores[c.id];
      if (v === null || v === undefined) continue;
      if (c.section === "upper") upper += v;
      else lower += v;
    }
    const bonus = upper >= ruleset.upperBonus.threshold ? ruleset.upperBonus.points : 0;
    const extra = ruleset.extraBonus ? card.jokers * ruleset.extraBonus.points : 0;
    return {
      upper: upper,
      bonus: bonus,
      bonusNeeded: Math.max(0, ruleset.upperBonus.threshold - upper),
      lower: lower,
      extra: extra,
      total: upper + bonus + lower + extra
    };
  }

  /* ── Self-test ─────────────────────────────────────────────────────────── */

  // Known hands with hand-checked answers. Runs at boot so a typo in a scoring
  // function shows up immediately instead of halfway through a family game.
  const FIXTURES = [
    ["us", [1, 1, 1, 4, 5], { ones: 3, threeKind: 12, fourKind: 0, fullHouse: 0, chance: 12 }],
    ["us", [3, 3, 3, 6, 6], { fullHouse: 25, threeKind: 21, threes: 9, sixes: 12 }],
    ["us", [2, 3, 4, 5, 5], { smallStraight: 30, largeStraight: 0, chance: 19 }],
    ["us", [2, 3, 4, 5, 6], { smallStraight: 30, largeStraight: 40 }],
    ["us", [6, 6, 6, 6, 6], { yatzy: 50, fourKind: 30, threeKind: 30, sixes: 30, fullHouse: 0 }],
    ["us", [1, 2, 3, 5, 6], { smallStraight: 0, largeStraight: 0, threeKind: 0, chance: 17 }],
    ["eu", [6, 6, 3, 2, 1], { onePair: 12, twoPairs: 0, sixes: 12 }],
    ["eu", [5, 5, 2, 2, 6], { onePair: 10, twoPairs: 14, fullHouse: 0 }],
    ["eu", [4, 4, 4, 2, 2], { threeKind: 12, fullHouse: 16, twoPairs: 12, onePair: 8 }],
    ["eu", [1, 2, 3, 4, 5], { smallStraight: 15, largeStraight: 0 }],
    ["eu", [2, 3, 4, 5, 6], { smallStraight: 0, largeStraight: 20 }],
    ["eu", [5, 5, 5, 5, 3], { fourKind: 20, threeKind: 15, onePair: 10, yatzy: 0 }],
    ["eu", [4, 4, 4, 4, 4], { yatzy: 50, fourKind: 16, fullHouse: 0 }]
  ];

  function selfTest() {
    const problems = [];
    for (const [rsId, dice, expect] of FIXTURES) {
      const rs = get(rsId);
      const got = scoreAll(dice, rs, null);
      for (const id in expect) {
        if (got[id] !== expect[id]) {
          problems.push(rsId + " " + dice.join("") + " " + id + ": expected " + expect[id] + ", got " + got[id]);
        }
      }
    }
    // Every category must produce a number for every possible hand, or a NaN
    // would quietly poison a total much later.
    for (const rsId of ["us", "eu"]) {
      const rs = get(rsId);
      for (let a = 1; a <= 6; a++) {
        const dice = [a, ((a + 1) % 6) + 1, a, 6, 1];
        const all = scoreAll(dice, rs, null);
        for (const c of rs.categories) {
          if (typeof all[c.id] !== "number" || !isFinite(all[c.id])) {
            problems.push(rsId + " " + c.id + " returned " + all[c.id]);
          }
        }
      }
    }
    return problems;
  }

  return {
    RULESETS, get, categoryById,
    counts, sum, runLength, highestOfAKind, hasNOfAKind,
    emptyCard, isOpen, openCategories, isComplete,
    scoreAll, scoreFor, commit, totals,
    legalCategories, isJoker, earnsExtraBonus,
    selfTest
  };
})();
