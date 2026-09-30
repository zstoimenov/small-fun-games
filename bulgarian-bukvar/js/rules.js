/* Буквар - what the missions teach and how each round is dealt. Pure:          */
/* no DOM, no storage, so tools/bukvar-check.js can load it in plain node.      */
"use strict";
window.BQ = window.BQ || {};

BQ.Rules = (function () {
  const L = BQ.Letters;
  const M = BQ.MISSIONS;

  const STEPS = [
    { id: "learn", label: "Learn", who: "together" },
    { id: "blend", label: "Blend", who: "together" },
    { id: "match", label: "Match", who: "solo" },
    { id: "build", label: "Build", who: "solo" },
    { id: "read", label: "Read", who: "together" }
  ];
  const MATCH_ROUNDS = 6;
  const BUILD_ROUNDS = 4;
  const TRAP_ROUNDS = 8;

  // A seeded generator for the checker; the game passes Math.random.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rand) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pick = (list, rand) => list[Math.floor(rand() * list.length)];

  // Capital letters of a text, ignoring spaces, punctuation and the hyphen in
  // йо-йо. Cyrillic only, so a stray Latin "o" typed into the data is caught.
  const lettersOf = (text) => text.toUpperCase().split("").filter((c) => /[Ѐ-ӿ]/.test(c));

  // Every letter taught up to and including mission n (0-based).
  function known(n) {
    const out = [];
    for (let i = 0; i <= n && i < M.length; i++) out.push(...M[i].letters);
    return out;
  }
  // The letters in `text` that are not in `set`. Empty means a child can read it.
  function unreadable(text, set) {
    const have = new Set(set);
    return [...new Set(lettersOf(text).filter((c) => !have.has(c)))];
  }

  // Picture words from every mission so far. The current mission's come first
  // so its answers are the new words, and older ones fill the wrong answers.
  function pool(n) {
    const out = [];
    for (let i = n; i >= 0; i--) M[i].words.forEach(([w, e]) => out.push({ w, e, m: i }));
    return out;
  }

  // Answers for n rounds: the current mission's words first (shuffled), then
  // older ones, and round again if the mission is short on words.
  function answers(n, count, rand, keep) {
    const all = pool(n).filter(keep || (() => true));
    const fresh = shuffle(all.filter((p) => p.m === n), rand);
    const old = shuffle(all.filter((p) => p.m !== n), rand);
    const order = fresh.concat(old);
    const out = [];
    for (let i = 0; out.length < count && order.length; i++) out.push(order[i % order.length]);
    return out;
  }

  // Picture match. Half the rounds show the picture and ask for the word, half
  // the other way round. Up to four options, every one a different word AND a
  // different picture, or the question has two right answers.
  function matchRounds(n, rand, count) {
    count = count || MATCH_ROUNDS;
    const all = pool(n);
    return answers(n, count, rand).map((ans, i) => {
      const others = shuffle(all.filter((p) => p.w !== ans.w && p.e !== ans.e), rand);
      const opts = [ans];
      for (const p of others) {
        if (opts.length >= 4) break;
        if (!opts.some((o) => o.w === p.w || o.e === p.e)) opts.push(p);
      }
      return { kind: i % 2 ? "word2pic" : "pic2word", answer: ans, options: shuffle(opts, rand) };
    });
  }

  // Build the word: the letters of a pictured word, shuffled, plus one spare
  // letter from what the child knows so the last tile isn't a free answer.
  function buildRounds(n, rand, count) {
    count = count || BUILD_ROUNDS;
    const set = known(n).map((c) => L.BY[c].lo);
    const fits = (p) => /^[а-я]{2,7}$/.test(p.w);
    return answers(n, count, rand, fits).map((ans) => {
      const chars = ans.w.split("");
      const spare = shuffle(set.filter((c) => !chars.includes(c)), rand).slice(0, n === 0 ? 0 : 1);
      let tiles = shuffle(chars.concat(spare), rand);
      // A shuffle that happens to spell the word is no puzzle.
      for (let t = 0; t < 5 && tiles.join("").startsWith(ans.w); t++) tiles = shuffle(tiles, rand);
      return { answer: ans, tiles };
    });
  }

  // Look-alike drill, only on trap letters the child has met. Two kinds:
  // "sound" shows the letter and asks what it says (the right sound, the
  // English misreading, and one other real sound); "which" names the sound
  // and asks for the letter among ones shaped like it.
  function trapsKnown(n) {
    const have = new Set(known(n));
    return L.TRAPS.filter((t) => have.has(t.key));
  }
  function trapRounds(n, rand, count) {
    count = count || TRAP_ROUNDS;
    const traps = trapsKnown(n);
    if (!traps.length) return [];
    const have = known(n);
    const hints = have.map((c) => L.BY[c].hint.split(",")[0]);
    const rounds = [];
    let deck = [];
    for (let i = 0; i < count; i++) {
      if (!deck.length) deck = shuffle(traps, rand);
      const t = deck.pop();
      if (i % 2 === 0) {
        const third = shuffle(hints.filter((h) => h !== t.right && h !== t.wrong), rand)[0];
        const options = [t.right, t.wrong].concat(third ? [third] : []);
        rounds.push({ kind: "sound", trap: t, show: t.ch, answer: t.right, options: shuffle(options, rand) });
      } else {
        const small = t.ch !== t.key;
        const shape = (L.SHAPES[t.key] || [t.key]).filter((c) => have.includes(c));
        const extra = shuffle(have.filter((c) => !shape.includes(c)), rand);
        const opts = shape.concat(extra).slice(0, 4).map((c) => (small ? L.BY[c].lo : c));
        if (!opts.includes(t.ch)) opts[opts.length - 1] = t.ch;
        rounds.push({ kind: "which", trap: t, show: t.right, answer: t.ch, options: shuffle([...new Set(opts)], rand) });
      }
    }
    return rounds;
  }

  // Stars for a mission, from how many solo answers were right first time.
  function stars(right, total) {
    if (!total) return 3;
    const r = right / total;
    return r >= 0.9 ? 3 : r >= 0.7 ? 2 : 1;
  }

  return { STEPS, MATCH_ROUNDS, BUILD_ROUNDS, TRAP_ROUNDS, rng, shuffle, pick, lettersOf, known, unreadable, pool, matchRounds, buildRounds, trapsKnown, trapRounds, stars };
})();
