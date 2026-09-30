/* Story Builder - the word tiles, turning tiles into a sentence, and the      */
/* rules briefs are checked against. No DOM here, so tools/ can run it.        */
/*                                                                             */
/* A piece of writing is a list of tokens { w, cat }. cat says what kind of    */
/* word the tile was ("own" for typed words), which is what rules count: they  */
/* check the kind of words used, never how good the story is.                  */
"use strict";
window.SB = window.SB || {};

// Every verb is past tense and every "who" brings its own "the" or "a", so any
// tiles in the right order make a real sentence.
SB.WORDS = {
  who: ["the dog", "a pirate", "my sister", "the robot", "a dragon", "the teacher", "a tiny mouse", "Grandpa"],
  did: ["went", "ran", "ate", "said", "looked", "got", "sat", "slept"],
  wow: ["raced", "crept", "gobbled", "whispered", "stomped", "zoomed", "tiptoed", "roared", "giggled", "tumbled"],
  where: ["at the beach", "in the kitchen", "on the moon", "under the bed", "through the forest", "up the hill", "into the cave"],
  when: ["at night", "after lunch", "on Monday", "yesterday", "at sunrise", "in the rain"],
  the: ["the", "a"],
  thing: ["dog", "cat", "house", "castle", "tree", "cake", "monster", "boat"],
  adj: ["scruffy", "huge", "tiny", "muddy", "sparkly", "grumpy", "spooky", "fluffy", "shiny", "wobbly", "ancient", "cheeky"],
  join: ["because", "but", "so", "and"],
  opener: ["Suddenly,", "One stormy night,", "Without warning,", "Long ago,", "Once upon a time,", "The next morning,"],
  feel: ["my heart pounded", "she grinned", "his hands shook", "they cheered", "he stomped his feet", "tears rolled down"],
  frame: ["I can see", "I can hear", "I can smell", "I can feel", "I can taste"],
  see: ["sparkly", "bright", "golden", "enormous"],
  hear: ["crashing", "buzzing", "squawking", "whispering"],
  smell: ["salty", "smoky", "stinky", "flowery"],
  touch: ["warm", "prickly", "soft", "sticky"],
  taste: ["sour", "juicy", "spicy", "crunchy"],
  noun: ["waves", "seagulls", "sand", "shells", "ice cream", "wind", "sunshine", "rocks"],
  mark: [".", "!", "?"]
};
SB.SENSES = ["see", "hear", "smell", "touch", "taste"];
SB.TABS = {
  who: { e: "🧑", name: "Who" }, did: { e: "🏃", name: "Did" }, wow: { e: "⚡", name: "Wow verbs" }, where: { e: "📍", name: "Where" },
  when: { e: "⏰", name: "When" }, the: { e: "👉", name: "The / A" }, thing: { e: "🏠", name: "Things" }, adj: { e: "🎨", name: "Describe" },
  join: { e: "🔗", name: "Join" }, opener: { e: "🚪", name: "Openers" }, feel: { e: "💓", name: "Feelings" }, frame: { e: "🖐️", name: "I can..." },
  see: { e: "👀", name: "See" }, hear: { e: "👂", name: "Hear" }, smell: { e: "👃", name: "Smell" }, touch: { e: "✋", name: "Touch" },
  taste: { e: "👅", name: "Taste" }, noun: { e: "🐚", name: "Things" }, mark: { e: "❗", name: ". ! ?" }
};
SB.PARTS = [
  { id: "opening", name: "Opening", e: "🌅", tip: "Who is in the story, and where are they?" },
  { id: "buildup", name: "Build-up", e: "🧗", tip: "What are they doing? Something is about to happen..." },
  { id: "problem", name: "Problem", e: "⚡", tip: "Uh oh! What goes wrong?" },
  { id: "fix", name: "Fix", e: "🛠️", tip: "How does it get sorted out?" },
  { id: "ending", name: "Ending", e: "🏁", tip: "How does everyone feel at the end?" }
];

SB.Words = (function () {
  const isMark = (t) => t.cat === "mark";
  const words = (toks) => toks.filter((t) => !isMark(t)).reduce((n, t) => n + t.w.split(/\s+/).length, 0);

  // Tiles to text: capital letters where sentences start, spaces between
  // words but not before . ! ?, and a full stop at the end if it's missing.
  function text(toks) {
    let out = "", start = true;
    toks.forEach((t) => {
      let w = t.w;
      if (isMark(t)) { out += w; start = true; return; }
      if (start) w = w[0].toUpperCase() + w.slice(1);
      out += (out ? " " : "") + w;
      start = false;
    });
    if (out && !/[.!?]$/.test(out)) out += ".";
    return out;
  }

  // ── Rules ──────────────────────────────────────────────────────────────────
  const count = (toks, cat) => toks.filter((t) => (Array.isArray(cat) ? cat : [cat]).includes(t.cat)).length;
  function check(rule, toks) {
    if (rule.cat) return count(toks, rule.cat) >= (rule.min || 1);
    if (rule.words) return words(toks) >= rule.words;
    if (rule.not) return !toks.some((t) => rule.not.includes(t.w.toLowerCase()));
    if (rule.first) { const f = toks.find((t) => !isMark(t)); return !!f && f.cat === rule.first; }
    if (rule.senses) return new Set(toks.filter((t) => SB.SENSES.includes(t.cat)).map((t) => t.cat)).size >= rule.senses;
    if (rule.order) {
      const at = rule.order.map((c) => toks.findIndex((t) => t.cat === c));
      return at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]);
    }
    return true;
  }
  // For a whole story mountain: parts is [toks x 5]. { every: n } needs n words
  // in every part; { part: i, ... } checks one part; anything else checks the
  // story as a whole.
  function checkStory(rule, parts) {
    if (rule.every) return parts.every((p) => words(p) >= rule.every);
    if (rule.part != null) return check(rule, parts[rule.part]);
    return check(rule, [].concat(...parts));
  }

  return { text, words, check, checkStory, count };
})();
