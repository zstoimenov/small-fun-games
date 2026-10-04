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
  const GROUPS = [
    { ask: "Which one is about sport?", has: ["sport"] },
    { ask: "Which one is a tradition?", has: ["tradition"] },
    { ask: "Which one is about science or art?", has: ["science", "art"] },
    { ask: "Which one is from history?", has: ["history"] }
  ];
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
    // The match step's other direction: the word is shown, the options are
    // pictures. `word` is what the child reads, so the checker reads it.
    word2pic(n, rand) {
      const a = R.pick(R.pool(n), rand);
      const others = R.shuffle(R.pool(n).filter((p) => p.w !== a.w && p.e !== a.e), rand).slice(0, 3);
      if (!others.length) return null;
      return { kind: "word2pic", key: "E" + a.w, ask: "Which picture is this word?", word: a.w, options: R.shuffle([a].concat(others).map((p) => p.e), rand), answer: a.e, pics: true };
    },
    // One letter blanked out. A letter that would spell a different real word
    // (л in _ама makes лама) is never offered, or there'd be two right answers.
    missing(n, rand) {
      const words = R.pool(n).filter((p) => /^[а-я]{3,8}$/.test(p.w));
      if (!words.length) return null;
      const a = R.pick(words, rand);
      const i = Math.floor(rand() * a.w.length);
      const c = a.w[i];
      const with_ = (x) => a.w.slice(0, i) + x + a.w.slice(i + 1);
      const real = new Set(R.pool(n).map((p) => p.w));
      const wrong = R.shuffle(R.known(n).map((x) => L.BY[x].lo).filter((x) => x !== c && !real.has(with_(x))), rand).slice(0, 3);
      if (wrong.length < 2) return null;
      return { kind: "missing", key: "M" + a.w, ask: "Which letter is missing?", pic: a.e, word: with_("_"), options: R.shuffle([c].concat(wrong), rand), answer: c, bg: true };
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
    // Which card belongs to a group: sport, traditions, science and art, history.
    group(n, rand) {
      const cards = cardsBy(n);
      const g = R.pick(GROUPS, rand);
      const yes = cards.filter((c) => g.has.includes(c.topic));
      const no = cards.filter((c) => !g.has.includes(c.topic));
      if (!yes.length || no.length < 2) return null;
      const c = R.pick(yes, rand);
      const opts = [c].concat(R.shuffle(no, rand).slice(0, 3));
      return { kind: "group", key: "G" + g.ask + c.id, ask: g.ask, options: R.shuffle(opts.map((x) => x.name), rand), answer: c.name, bg: true };
    },
    // When did it happen? The options are the `when` of other dated cards, so
    // every wrong answer is a real date from the album, not a made-up one.
    when(n, rand) {
      const cards = datedBy(n);
      const c = R.pick(cards, rand);
      if (!c) return null;
      const others = R.shuffle(cards.filter((x) => x.when !== c.when && x.year !== c.year), rand);
      const opts = [];
      for (const x of others) if (opts.length < 3 && !opts.includes(x.when)) opts.push(x.when);
      if (opts.length < 2) return null;
      return { kind: "when", key: "Y" + c.id, ask: "When was this?", card: c, options: R.shuffle([c.when].concat(opts), rand), answer: c.when, bg: false };
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
  // all reading. Then two reading, three history: a "who is it" (by clue or by
  // group), a question from a card's story, and one about time ("which came
  // first?", a timeline, or "when was this?"). Each slot picks among its kinds
  // so a retry rarely looks like the round before.
  function recipe(n, rand) {
    const c = cardsBy(n).length;
    const any = (list) => R.pick(list, rand);
    const read = ["picture", "spelling", "word2pic"];
    if (!c) return ["letter", "missing", "picture", "spelling", "word2pic"];
    if (c < 2) return [any(["letter", "missing"]), any(read), any(read), "story", "picture"];
    const time = datedBy(n).length >= 3 ? ["timeline", "first", "when"] : ["first", "when"];
    return [any(["letter", "missing"]), any(read), any(["who", "who", "group"]), "story", any(time)];
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
