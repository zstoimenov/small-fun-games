/* Enigma - the six code-breaker missions: what each one asks, and its stars.  */
/*                                                                              */
/* Data and scoring only: no DOM. Every code here was made by rules.js itself   */
/* (see the check at the bottom), so a mission can never ask a kid to decode    */
/* something the machine would not really have sent.                            */
/*                                                                              */
/* Kinds:                                                                       */
/*   decode - start given, type the code, the message comes out                 */
/*   reply  - type a word, Reset, type your own code back                       */
/*   crack  - one or two start letters missing; spin, tap Try                   */
/*   crib   - slide a word we know along the code; Enigma never codes a letter  */
/*            as itself, so a spot where two letters match is ruled out         */
"use strict";
window.EN = window.EN || {};

EN.Missions = (function () {
  const LIST = [
    {
      name: "Incoming!", kind: "decode", start: "SPY",
      code: "RBFSYVBWRD", plain: "HELLOAGENT", say: "HELLO AGENT",
      line: "Read your first secret message",
      brief: "A secret message just came in! Spin the rings to S P Y, then type the code from the note, one letter at a time.",
      hint: "The next key to press is glowing. Make sure the rings show S P Y before the first letter.",
      cut: [0, 2],
      fact: "Real Enigma messages went out by radio. Anyone could listen in, but only someone with the right start could read them."
    },
    {
      name: "Reply", kind: "reply", start: "HUG",
      code: "IQGSW", plain: "GOTIT", say: "GOT IT",
      line: "Send a secret answer back",
      brief: "Tell HQ you got it. Spin the rings to H U G, then type GOT IT.",
      check: "Now check your code works. Tap Reset, then type your code. GOT IT should come back!",
      hint: "The next key to press is glowing.",
      cut: [0, 2],
      fact: "Enigma works both ways. The same start that hides a message also brings it back, so both spies need the same machine."
    },
    {
      name: "Long message", kind: "decode", start: "FOX",
      code: "SYKZJXKEJRCNUORFPQIYQ", plain: "THECAKEISINTHEBLUEBOX", say: "THE CAKE IS IN THE BLUE BOX",
      line: "Decode a whole sentence",
      brief: "A longer one! Spin the rings to F O X, then type the code. Watch the message grow.",
      hint: "The next key to press is glowing. Go slowly, one group of 5 at a time.",
      cut: [0, 3],
      fact: "Real messages were sent in groups of 5 letters, just like yours. That made them easy to read out loud, and gave no clue where the words began."
    },
    {
      name: "Crack it", kind: "crack", start: "KER", missing: [2],
      clue: "Clue: the ? is between P and T.",
      code: "RATBVUZFNTAMOGPBVXP", plain: "WELLDONECODEBREAKER", say: "WELL DONE CODE BREAKER",
      line: "Find a missing start letter",
      brief: "We caught a message, but one start letter is missing! Spin the ? ring, tap Try, and look for real words.",
      hint: "It's R or S.",
      cut: [4, 11],
      fact: "A real army Enigma could be set up in more ways than there are grains of sand on Earth. Trying them one by one would take forever."
    },
    {
      name: "Double crack", kind: "crack", start: "LKF", missing: [1, 2],
      choices: ["DKR", "AFM"],
      code: "LHTICWFMWVTVVSC", plain: "TOPSECRETNOMORE", say: "TOP SECRET NO MORE",
      line: "Two letters missing",
      brief: "Two letters missing this time! Use the clue, spin both ? rings, and tap Try.",
      hint: "The middle ring is K.",
      cut: [2, 5],
      fact: "Polish code-breakers cracked Enigma first, in 1932. Just before the war they shared their secrets with Britain."
    },
    {
      name: "Turing's trick", kind: "crib", start: "ABL",
      code: "WATEUHMRTGPPXJMJF", plain: "THEWEATHERISSUNNY", say: "THE WEATHER IS SUNNY",
      crib: "WEATHER", spots: [0, 3, 5], answer: 3,
      line: "Use Enigma's big mistake",
      brief: "Every morning, the weather report used the word WEATHER. But where is it hiding in this code? Slide it to each spot and look closely.",
      rule: "Enigma NEVER turns a letter into itself. So if a letter sits right under the same letter, WEATHER can't be there!",
      hint: "Same letters are now marked in red.",
      cut: [0, 1],
      fact: "Alan Turing and the code-breakers at Bletchley Park used this trick every day. Their machines, called bombes, then tested the settings much faster than people could."
    }
  ];

  // The story card: real history, said for an eight-year-old.
  const STORY = [
    "About 85 years ago, during World War II, the German army sent secret messages with a machine called Enigma.",
    "Every key mixed up the letters, and the mix changed with every press. They thought nobody could ever read it.",
    "But at a secret place in England called Bletchley Park, a team of code-breakers worked day and night. One of them, Alan Turing, helped build machines to crack the code.",
    "Breaking Enigma helped end the war sooner. Now it's your turn to be a code-breaker!"
  ];

  // Stars from what went wrong: wrong keys in the typing missions, failed
  // tries in the cracking ones (so "5 tries or fewer" is cut 4). cut = [most
  // for 3 stars, most for 2], so the stars on screen are always what you
  // would get if the next go worked. A hint costs one star,
  // but nobody who finishes ever gets fewer than one.
  function stars(m, count, hinted) {
    const base = count <= m.cut[0] ? 3 : count <= m.cut[1] ? 2 : 1;
    return Math.max(1, base - (hinted ? 1 : 0));
  }

  // Where WEATHER would clash with the code if it sat at `spot`.
  function clashes(m, spot) {
    const out = [];
    for (let i = 0; i < m.crib.length; i++) if (m.code[spot + i] === m.crib[i]) out.push(spot + i);
    return out;
  }

  // Sanity check on load: if anybody edits a message by hand, the mission that
  // no longer matches the machine says so in the console instead of silently
  // asking a kid to do the impossible.
  LIST.forEach((m, i) => {
    const got = EN.Rules.encode(EN.Rules.lettersToPos(m.start), m.code);
    if (got !== m.plain) console.error("Enigma mission " + (i + 1) + " does not decode:", got);
  });

  return { LIST, STORY, stars, clashes, MAX: LIST.length * 3 };
})();
