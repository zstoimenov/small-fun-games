/* Newton's Playground - the three chapters, their levels, and the quiz.       */
/*                                                                             */
/* Target zones are tuned against physics.js so that exactly one choice lands  */
/* in them on the "pick" levels, and a flick has a fair window on the others. */
/* x is in metres along the track (0 to 20). Carts and pucks start near x=1.  */
"use strict";
window.NL = window.NL || {};

// Things to put on the cart. Mass is in "loads" - the elephant is four teddies.
NL.LOADS = {
  teddy:    { m: 1, emoji: "\u{1F9F8}", label: "Teddy" },
  box:      { m: 2, emoji: "\u{1F4E6}", label: "Box" },
  elephant: { m: 4, emoji: "\u{1F418}", label: "Elephant" }
};

// Balls to throw off the skateboard. The skater weighs 10 of these units.
NL.BALLS = {
  tennis: { m: 1,   emoji: "\u{1F3BE}", label: "Tennis ball" },
  heavy:  { m: 2.5, emoji: "\u{1F3B1}", label: "Heavy ball" }
};

NL.CHAPTERS = [
  {
    id: 1,
    emoji: "\u{1F94C}",
    kicker: "Law 1",
    name: "Lazy Things",
    color: "#2b8fd6",
    says: "Things keep doing what they're doing until something pushes or pulls them.",
    more: [
      "A ball sitting still stays still until you kick it.",
      "A ball rolling along wants to keep rolling. It only stops because something slows it down, like grass rubbing on it.",
      "That rubbing is called <b>friction</b>."
    ],
    grown: "An object at rest stays at rest, and an object in motion stays in motion at the same speed and direction, unless a force acts on it. This is also called inertia.",
    sandbox: { kind: "flick", sandbox: true, surfaces: ["ice", "grass", "sand", "space"],
      goal: "Pull your finger away, then let go. Try every ground. What happens in space?" },
    levels: [
      { name: "Ice rink", kind: "flick", strips: [{ from: 0, to: 20, type: "ice" }], zone: [10, 19],
        goal: "Pull your finger away and let go. Make the puck stop on the green flag." },
      { name: "Bumpy grass", kind: "flick", strips: [{ from: 0, to: 20, type: "grass" }], zone: [6, 8],
        goal: "Grass rubs on the puck and slows it down fast. You'll need a bigger flick!" },
      { name: "Ice, then sand", kind: "flick", strips: [{ from: 0, to: 10, type: "ice" }, { from: 10, to: 20, type: "sand" }], zone: [12, 14],
        goal: "The puck glides on ice, then the sand grabs it. Stop it on the flag." },
      { name: "Three grounds", kind: "flick", strips: [{ from: 0, to: 6, type: "grass" }, { from: 6, to: 13, type: "ice" }, { from: 13, to: 20, type: "sand" }], zone: [14, 15.5],
        goal: "Grass, then ice, then sand. Can you land it on the little flag?" }
    ],
    lesson: {
      title: "You learned Law 1!",
      life: "That's why we wear seatbelts. When a car stops fast, your body wants to keep going forward. The seatbelt is the push that stops you."
    }
  },
  {
    id: 2,
    emoji: "\u{1F6D2}",
    kicker: "Law 2",
    name: "Push Power",
    color: "#e0752b",
    says: "A bigger push makes things speed up more. Heavier things need a bigger push.",
    more: [
      "Push a cart with a teddy on it. Easy! It zooms off.",
      "Now put an elephant on it. Same push, and it hardly moves.",
      "Twice as heavy? Then you need twice the push to get the same speed."
    ],
    grown: "Force equals mass times acceleration (F = ma). The more force on an object, the more it accelerates. The more mass it has, the less it accelerates for the same force.",
    sandbox: { kind: "cart", sandbox: true, pick: ["push", "load"],
      goal: "Pick a push and a load, then press Push! Try the teddy and the elephant." },
    levels: [
      { name: "Push the box", kind: "cart", load: "box", pick: ["push"], zone: [10.5, 13.5],
        goal: "There's a box on the cart. How big a push gets it to the flag?" },
      { name: "Pick a load", kind: "cart", push: 1, pick: ["load"], zone: [5.5, 7.5],
        goal: "You can only give a small push. Which load will make it to the flag?" },
      { name: "The big race", kind: "race", push: 1, loads: ["teddy", "elephant"],
        question: "Both carts get the same push. Which one goes further?",
        answers: [
          { id: "teddy", text: "The teddy", emoji: "\u{1F9F8}" },
          { id: "elephant", text: "The elephant", emoji: "\u{1F418}" },
          { id: "same", text: "They go the same", emoji: "\u{1F91D}" }
        ],
        right: "teddy",
        why: "The teddy is light, so the same push speeds it up much more.",
        goal: "Guess first, then watch the race!" },
      { name: "Keep up with Teddy", kind: "match", load: "elephant", pick: ["push"], zone: [5.8, 7.2],
        other: { load: "teddy", push: 1 },
        weigh: "\u{1F418} = \u{1F9F8}\u{1F9F8}\u{1F9F8}\u{1F9F8}",
        weighSays: "The elephant is as heavy as 4 teddies",
        goal: "Teddy's cart always gets 1 push. Your cart has an elephant on it. The elephant is as heavy as 4 teddies! How many pushes does it need to stop next to Teddy?" }
    ],
    lesson: {
      title: "You learned Law 2!",
      life: "Kick a football and it flies. Kick a bowling ball with the same kick and it just rolls a bit (and ouch!). Same push, more weight, less speed."
    }
  },
  {
    id: 3,
    emoji: "\u{1F680}",
    kicker: "Law 3",
    name: "Push Back",
    color: "#8a4fd6",
    says: "When you push something, it pushes you back just as hard.",
    more: [
      "Stand on a skateboard and throw a ball forward. You roll backwards!",
      "You pushed the ball. The ball pushed you back the other way.",
      "Pushes always come in pairs, the same size but pointing opposite ways."
    ],
    grown: "For every action there is an equal and opposite reaction. When one object pushes on another, the second pushes back with a force of the same size in the opposite direction.",
    sandbox: { kind: "skate", sandbox: true,
      goal: "Throw balls to the right and watch which way you roll. Try the heavy ball too!" },
    levels: [
      { name: "Skate away", kind: "skate", balls: ["tennis", "tennis", "tennis"], zone: [8, 12],
        goal: "You have 3 tennis balls. Throw them to roll back to the green flag." },
      { name: "Heavy ball", kind: "skate", balls: ["heavy", "tennis", "tennis"], zone: [1.5, 4],
        goal: "The flag is far away. A heavy ball gives you a bigger push back. Stop on the flag!" },
      { name: "Balloon rocket", kind: "balloon", zone: [9.5, 12.5],
        goal: "Blow up the balloon, then let go. Air rushes out the back, and pushes the balloon forward. Stop on the flag!" },
      { name: "Push off", kind: "pushoff",
        question: "A big kid and a small kid push hands on skateboards. Who rolls further?",
        answers: [
          { id: "big", text: "The big kid", emoji: "\u{1F9D1}" },
          { id: "small", text: "The small kid", emoji: "\u{1F9D2}" },
          { id: "same", text: "They roll the same", emoji: "\u{1F91D}" }
        ],
        right: "small",
        why: "They push each other just as hard. The small kid is lighter, so they roll further. That's Law 2 and Law 3 together!",
        goal: "Guess first, then watch them push!" }
    ],
    lesson: {
      title: "You learned Law 3!",
      life: "That's how rockets fly. A rocket pushes hot gas down, and the gas pushes the rocket up. When you swim, you push water back and the water pushes you forward."
    }
  }
];

// One question from each law is picked each time, so a replay feels new.
NL.QUIZ = [
  [
    { emoji: "\u{26F8}\u{FE0F}", q: "A puck slides on super smooth ice. Nobody touches it. What happens?",
      a: ["It slides a long, long way", "It stops straight away", "It slides backwards"], right: 0,
      why: "Nothing is slowing it down much, so it keeps going. That's Law 1!" },
    { emoji: "\u{1F68C}", q: "The bus stops suddenly. Why do you tip forward?",
      a: ["Your body wants to keep going", "The bus pushes you forward", "You're sleepy"], right: 0,
      why: "You were moving, so your body keeps moving until something stops it. That's Law 1!" }
  ],
  [
    { emoji: "\u{26BD}", q: "You kick a beach ball and a bowling ball just as hard. Which goes further?",
      a: ["The beach ball", "The bowling ball", "They go the same"], right: 0,
      why: "The beach ball is lighter, so the same kick speeds it up more. That's Law 2!" },
    { emoji: "\u{1F4E6}", q: "You want to slide a very heavy box. What do you need?",
      a: ["A bigger push", "A smaller push", "No push at all"], right: 0,
      why: "Heavier things need a bigger push to get moving. That's Law 2!" }
  ],
  [
    { emoji: "\u{1F6F6}", q: "You jump out of a little boat onto the dock. What does the boat do?",
      a: ["It moves away from the dock", "It moves toward the dock", "It stays still"], right: 0,
      why: "You pushed the boat back as you jumped, so it moves the other way. That's Law 3!" },
    { emoji: "\u{1F680}", q: "How does a rocket go up?",
      a: ["It pushes gas down, and the gas pushes it up", "It floats like a cloud", "The wind pulls it up"], right: 0,
      why: "The rocket pushes gas down. The gas pushes the rocket up. That's Law 3!" }
  ]
];
