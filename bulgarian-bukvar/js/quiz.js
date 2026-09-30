/* Буквар - the passport quiz. Pure, like rules.js.                             */
/*                                                                              */
/* A quiz belongs to a stamp, and a stamp to a mission: it asks only about      */
/* letters, words and cards the child has by then. Five questions, all tap-only.*/
/* Five right earns the stamp; five right with no hints earns it in gold.       */
"use strict";
window.BQ = window.BQ || {};

BQ.Quiz = (function () {
  const L = BQ.Letters;
  const R = BQ.Rules;
  const QUESTIONS = 5;

  const cardsBy = (n) => BQ.CARDS.filter((c) => c.m <= n);
  // Traditions have no year, so they can't be put in order against anything.
  const datedBy = (n) => cardsBy(n).filter((c) => c.year !== null);
  const hintOf = (c) => L.BY[c].hint.split(",")[0].split(":")[0];

  // Wrong spellings a child could believably make: two letters swapped, or one
  // letter traded for a learned one that looks like it. Never the real word.
  function misspell(w, n, rand) {
    const known = R.known(n).map((c) => L.BY[c].lo);
    const out = new Set();
    for (let t = 0; t < 40 && out.size < 3; t++) {
      const a = w.split("");
      const i = Math.floor(rand() * a.length);
      if (rand() < 0.5 && i < a.length - 1) [a[i], a[i + 1]] = [a[i + 1], a[i]];
      else {
        const like = (L.SHAPES[a[i].toUpperCase()] || []).map((c) => L.BY[c].lo).filter((c) => known.includes(c));
        const from = like.length > 1 ? like : known;
        a[i] = R.pick(from, rand);
      }
      const x = a.join("");
      if (x !== w && !R.pool(n).some((p) => p.w === x)) out.add(x);
    }
    return [...out];
  }

  // Each maker returns one question or null when the child hasn't met enough
  // yet. `key` is what makes two questions "the same" for the pool check.
  const MAKERS = {
    letter(n, rand) {
      const known = R.known(n);
      const c = R.pick(known, rand);
      const opts = [c].concat(R.shuffle(known.filter((x) => x !== c && hintOf(x) !== hintOf(c)), rand).slice(0, 3));
      return { kind: "letter", key: "L" + c, ask: "Which letter says “" + hintOf(c) + "”?", options: R.shuffle(opts, rand), answer: c, bg: true };
    },
    picture(n, rand) {
      const a = R.pick(R.pool(n), rand);
      const others = R.shuffle(R.pool(n).filter((p) => p.w !== a.w && p.e !== a.e), rand).slice(0, 3);
      if (!others.length) return null;
      return { kind: "picture", key: "P" + a.w, ask: "Which word is this?", pic: a.e, options: R.shuffle([a].concat(others).map((p) => p.w), rand), answer: a.w, bg: true };
    },
    spelling(n, rand) {
      const words = R.pool(n).filter((p) => /^[а-я]{3,8}$/.test(p.w));
      if (!words.length) return null;
      const a = R.pick(words, rand);
      const wrong = misspell(a.w, n, rand);
      if (wrong.length < 2) return null;
      return { kind: "spelling", key: "S" + a.w, ask: "Which one is spelled right?", pic: a.e, options: R.shuffle([a.w].concat(wrong), rand), answer: a.w, bg: true };
    },
    who(n, rand) {
      const cards = cardsBy(n);
      if (cards.length < 2) return null;
      const c = R.pick(cards, rand);
      const opts = [c].concat(R.shuffle(cards.filter((x) => x !== c), rand).slice(0, 3));
      return { kind: "who", key: "W" + c.id, ask: "Who am I? " + c.clue, options: R.shuffle(opts.map((x) => x.name), rand), answer: c.name, bg: true };
    },
    // The card's own "Remember it?" question, in English. Recall of the story,
    // not reading: its options are English, so the readability check skips it.
    story(n, rand) {
      const cards = cardsBy(n);
      if (!cards.length) return null;
      const c = R.pick(cards, rand);
      return { kind: "story", key: "Q" + c.id, ask: c.ask[0], card: c, options: R.shuffle(c.ask.slice(1), rand), answer: c.ask[1], bg: false };
    },
    first(n, rand) {
      const cards = datedBy(n);
      if (cards.length < 2) return null;
      const [a, b] = R.shuffle(cards, rand);
      if (a.year === b.year) return null;
      const older = a.year < b.year ? a : b;
      return { kind: "first", key: "F" + [a.id, b.id].sort().join(), ask: "Which came first?", options: [a.name, b.name], cards: [a, b], answer: older.name, bg: true };
    },
    timeline(n, rand) {
      const cards = datedBy(n);
      if (cards.length < 3) return null;
      const three = R.shuffle(cards, rand).slice(0, 3);
      if (new Set(three.map((c) => c.year)).size < 3) return null;
      const order = three.slice().sort((x, y) => x.year - y.year).map((c) => c.id);
      return { kind: "timeline", key: "T" + order.join(), ask: "Put them in order. Tap the oldest first.", cards: three, answer: order };
    }
  };

  // What a round is made of, by how much history the child has. No cards yet:
  // all reading. Then two reading, three history: "Who am I?", a question from
  // a card's story, and "which came first?" or (with three dated cards or
  // more) a timeline. Reading questions alternate picture and spelling.
  function recipe(n, rand) {
    const c = cardsBy(n).length;
    if (!c) return ["letter", "picture", "spelling", "letter", "picture"];
    if (c < 2) return ["letter", "picture", "spelling", "story", "picture"];
    const order = datedBy(n).length >= 3 && rand() < 0.5 ? "timeline" : "first";
    return ["letter", rand() < 0.5 ? "picture" : "spelling", "who", "story", order];
  }

  function round(n, rand) {
    const kinds = recipe(n, rand);
    const out = [];
    const seen = new Set();
    for (const k of kinds) {
      for (let t = 0; t < 30; t++) {
        const q = MAKERS[k](n, rand) || MAKERS.letter(n, rand);
        if (!seen.has(q.key)) { seen.add(q.key); out.push(q); break; }
      }
    }
    return R.shuffle(out, rand);
  }

  const isRight = (q, pick) => (q.kind === "timeline" ? pick.join() === q.answer.join() : pick === q.answer);

  // The stamp for a finished round: "gold", "ink" or null.
  function stamp(right, hints) {
    if (right < QUESTIONS) return null;
    return hints ? "ink" : "gold";
  }

  return { QUESTIONS, MAKERS, cardsBy, misspell, round, isRight, stamp };
})();
