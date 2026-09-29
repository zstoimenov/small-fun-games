/* Morse Agent - the code, the lesson order and the timing. Nothing else.        */
/*                                                                              */
/* Pure logic: no DOM, no audio, no clock. That is what lets a plain node       */
/* script (tools/morse-check.js) check the timing sums and the word picker      */
/* without a browser.                                                           */
/*                                                                              */
/* Teaching method is Koch's: every letter is sent at full speed from day one,  */
/* you start with two, and a new one is added only once you get 90% right. The  */
/* speed never changes - what the difficulty lever changes is the SPACE between */
/* letters (Farnsworth spacing) and how much help is on the screen.             */
"use strict";
window.MO = window.MO || {};

MO.Rules = (function () {
  const CODE = {
    A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
    I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
    Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
    Y: "-.--", Z: "--..",
    0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-",
    5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----."
  };
  const DECODE = {};
  Object.keys(CODE).forEach((ch) => { DECODE[CODE[ch]] = ch; });

  // Koch's order with the punctuation taken out. Letters first so that real
  // words turn up early; the digits are a bonus stage once the alphabet is done.
  // It deliberately does NOT start with E and T: the short, easy letters are the
  // ones kids start counting instead of hearing.
  const ORDER = "KMRSUAPTLOWINJEFYVGQZHBCDX" + "0593842716";
  const MISSIONS = ORDER.length - 1;    // mission 1 brings in K and M together
  const PASS = 0.9;

  // Character speed is fixed at 12 words a minute: one dit is 100 ms. Slower
  // than that and kids learn to count dits instead of hearing the rhythm.
  const WPM = 12;
  const DIT = 1200 / WPM;

  // The difficulty lever. It changes three things and never the letter speed:
  //   spacing - the Farnsworth "overall" speed: letters stay at 12 wpm and the
  //             gaps between them stretch to make the message this slow
  //   hints   - 2: dots and dashes on every button; 1: only while sending;
  //             0: only after a mistake
  //   maxWord - the longest word you are asked to send or copy
  const LEVELS = [
    { id: "rookie", name: "Rookie", spacing: 5,  hints: 2, maxWord: 3 },
    { id: "agent",  name: "Agent",  spacing: 8,  hints: 1, maxWord: 4 },
    { id: "ace",    name: "Ace",    spacing: 12, hints: 0, maxWord: 5 }
  ];

  // How long the key waits after the last beep, in the player's own dits, before
  // it decides a letter is finished. Generous on purpose (the textbook is 3): a
  // kid thinking about what comes next is not the same as a kid who is done.
  const END_GAP = 4;

  // ARRL's Farnsworth sum. Returns the gap between letters and between words,
  // in ms. At full speed it comes back to the textbook 3 and 7 dits.
  function gaps(level) {
    const s = LEVELS[level].spacing;
    if (s >= WPM) return { letter: 3 * DIT, word: 7 * DIT };
    const ta = ((60 * WPM - 37.2 * s) / (s * WPM)) * 1000;
    return { letter: (3 * ta) / 19, word: (7 * ta) / 19 };
  }

  // Tone segments for a message: [{ at, dur }] in ms from the start, plus the
  // total length. Spaces in the text are word gaps.
  function schedule(text, level) {
    const g = gaps(level);
    const out = [];
    let t = 0;
    let first = true;
    text.split(" ").filter(Boolean).forEach((word, wi) => {
      if (wi) t += g.word; else if (!first) t += g.letter;
      word.split("").forEach((ch, ci) => {
        if (ci) t += g.letter;
        (CODE[ch] || "").split("").forEach((sym, si) => {
          if (si) t += DIT;
          const dur = sym === "." ? DIT : 3 * DIT;
          out.push({ at: t, dur });
          t += dur;
        });
        first = false;
      });
    });
    return { segs: out, total: t };
  }

  // Letters a player has been taught by the time they play mission n (1-based).
  const lettersFor = (n) => ORDER.slice(0, Math.min(n, MISSIONS) + 1).split("");
  // The letter(s) mission n brings in.
  const newFor = (n) => (n <= 1 ? ["K", "M"] : [ORDER[Math.min(n, MISSIONS)]]);

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Ten letters to listen to. Half are the new letter(s), because that is the one
  // being learned; the rest keep the old ones fresh. Never three the same in a
  // row, or a kid can get them right without listening.
  function interceptDeck(n, size) {
    const all = lettersFor(n);
    const fresh = newFor(n);
    const old = all.filter((c) => !fresh.includes(c));
    const deck = [];
    for (let i = 0; i < size; i++) {
      deck.push(i % 2 === 0 || !old.length ? fresh[(i / 2) % fresh.length | 0] : pick(old));
    }
    shuffle(deck);
    for (let i = 2; i < deck.length; i++) {
      if (deck[i] === deck[i - 1] && deck[i] === deck[i - 2]) {
        const j = deck.findIndex((c, k) => c !== deck[i] && Math.abs(k - i) > 1);
        if (j >= 0) [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    return deck;
  }

  // Short, friendly words. Filtered by what has been learned, so the list is
  // empty for the first few missions and fills up as letters are added.
  const WORDS = (
    "AM AS AT IS IT ME MY NO SO UP US WE GO OK OR TO ON IN HI " +
    "ARM ART ASK ATE EAR EAT MAP MAT MOP MUM MUG OAR OAT OUR OUT PAT PET POT PUT " +
    "RAM RAT RUG RUN SAT SEA SIT SPY SUM SUN TAP TOP TOY TUG WET WIN WOW JAM JET " +
    "FUN FOX DOG CAT BUS BOX HAT KEY KIT ZIP ZOO YES VAN ICE EGG OWL PIG COW BAT " +
    "BED CUP MIX HUT LOG MUD NUT EMU SKY " +
    "MASK MARK SUMO STAR SPOT STOP POST PART TRAP TRIP MUST RUST SOAP ROOM MOON " +
    "SOUP LOOP POOL TOOL WOLF FROG FISH JUMP SWIM KITE LAMP CODE SAFE SPIN SNOW " +
    "RAIN TREE FIRE WAVE BOOK CAKE DUCK HERO KING QUIZ ZERO JAZZ LION BEAR MILK " +
    "AGENT RADIO SMART STORM MAGIC ROBOT PIZZA TIGER QUEEN SUPER SMILE LEMON PLANT " +
    "OCEAN TRAIN SPACE CLOUD HOUSE GHOST SHARK ZEBRA WATER APPLE CHAIR MOUSE KOALA"
  ).split(" ");

  function wordsFrom(letters, maxLen) {
    return WORDS.filter((w) => w.length <= maxLen && w.split("").every((c) => letters.includes(c)));
  }

  // `count` things to send or copy. Real words when there are enough of them;
  // before that, little made-up groups (the way Koch practice is always done),
  // each with the new letter in it.
  function words(n, count, maxLen) {
    const letters = lettersFor(n);
    const fresh = newFor(n);
    const withNew = wordsFrom(letters, maxLen).filter((w) => fresh.some((c) => w.includes(c)));
    const pool = withNew.length >= count * 2 ? withNew : [];
    const out = [];
    shuffle(pool.slice()).slice(0, count).forEach((w) => out.push(w));
    while (out.length < count) {
      const len = Math.max(2, Math.min(maxLen, 2 + out.length % 2));
      const g = [pick(fresh)];
      while (g.length < len) g.push(pick(letters));
      out.push(shuffle(g).join(""));
    }
    return out;
  }

  // Words for two players: they may not have learned anything yet, so any word
  // goes, and the listener gets the code book.
  function duoWords(count, maxLen, minLen) {
    return shuffle(WORDS.filter((w) => w.length <= maxLen && w.length >= minLen)).slice(0, count);
  }

  // How many letters of `got` match `want`, position by position.
  function score(want, got) {
    let n = 0;
    for (let i = 0; i < want.length; i++) if (got[i] === want[i]) n++;
    return n;
  }

  return {
    CODE, DECODE, ORDER, MISSIONS, PASS, WPM, DIT, LEVELS, END_GAP,
    gaps, schedule, lettersFor, newFor, interceptDeck, words, duoWords, wordsFrom, score, shuffle
  };
})();
