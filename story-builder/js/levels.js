/* Story Builder - chapters, levels, jobs and quiz. Data only.                 */
/*                                                                             */
/* A level is a list of rounds:                                                */
/*   build     make one sentence from tiles to fit some rules                 */
/*   choose    pick the best word or sentence                                 */
/*   sort      put each word in the right bin, one at a time                  */
/*   order     tap story parts in the right order                             */
/*   mountain  write a whole five-part story to a brief                       */
/* A rule checks the kinds of words used (see words.js), never the ideas, so  */
/* every silly sentence that follows the rules is a right answer.             */
"use strict";
window.SB = window.SB || {};

(function () {
  const t = (w, cat) => ({ w, cat });
  const JOIN = "Joining words glue two ideas together. Because tells you why, but shows something different, so tells you what happened next.";
  const SHOW = "Showing what someone does lets the reader work out the feeling, which is more fun than being told.";

  SB.CHAPTERS = [
    {
      id: 1, kicker: "Chapter 1", name: "Super Sentences", emoji: "✏️", color: "#00897b",
      says: "A sentence says who did what. Then you can add where, when, and words that make it exciting!",
      more: ["Every sentence needs a who and a did.", "Wow verbs like 'crept' and 'zoomed' paint a picture. 'Went' doesn't!", "Describing words tell us what things are like."],
      grown: "These are the building blocks taught in early primary writing: subject and verb, adverbials of place and time, adjectives, precise verbs, and the conjunctions because, but and so.",
      lesson: {
        title: "You build super sentences!",
        life: "When you tell someone about your day, try adding a where, a when and a wow verb. It makes people want to listen!",
        job: "📚 Authors write books. They choose every word carefully, and change boring ones for exciting ones when they check their work."
      },
      levels: [
        {
          name: "Who did what?", text: "Make a sentence with the tiles. Tap 🔊 to hear it!",
          rounds: [
            { kind: "build", q: "Make a sentence: who did what?", tabs: ["who", "did"], rules: [{ order: ["who", "did"], tip: "Start with a who, then add what they did." }] },
            { kind: "build", q: "Now add where it happened", tabs: ["who", "did", "where"], rules: [{ order: ["who", "did", "where"], tip: "Who, then did, then where. Try the 📍 Where tiles." }] },
            { kind: "build", q: "Add when it happened, too", tabs: ["who", "did", "where", "when"], rules: [{ order: ["who", "did"], tip: "Start with a who and what they did." }, { cat: "where", tip: "Add a 📍 where." }, { cat: "when", tip: "Add a ⏰ when." }] }
          ]
        },
        {
          name: "Wow verbs", text: "Some words are boring. Swap them for words that show exactly what happened!",
          rounds: [
            { kind: "choose", q: "The tiger ___ through the jungle.", options: [{ t: "went" }, { t: "prowled", ok: true }, { t: "got" }], why: "'Prowled' shows the tiger moving slowly and sneakily, hunting. 'Went' could mean anything!" },
            { kind: "choose", q: "\"Shh, the baby is asleep,\" Mum ___.", options: [{ t: "whispered", ok: true }, { t: "said" }, { t: "shouted" }], why: "'Whispered' tells you how she said it, very quietly. 'Shouted' would wake the baby!" },
            { kind: "choose", q: "The hungry puppy ___ its dinner.", options: [{ t: "ate" }, { t: "had" }, { t: "gobbled", ok: true }], why: "'Gobbled' shows the puppy eating fast and messily. You can picture it!" },
            { kind: "build", q: "Write a sentence with a wow verb (no boring 'went' or 'said')", tabs: ["who", "wow", "did", "where"], rules: [{ cat: "wow", tip: "Use a ⚡ wow verb." }, { not: ["went", "said", "got"], tip: "Swap 'went', 'said' or 'got' for a wow verb." }, { order: ["who", "wow"], tip: "Start with who, then the wow verb." }] }
          ]
        },
        {
          name: "Describing words", text: "Describing words (adjectives) tell us what something is like.",
          rounds: [
            { kind: "choose", q: "Which one is a describing word?", options: [{ t: "jumped" }, { t: "fluffy", ok: true }, { t: "because" }], why: "'Fluffy' tells you what something is like. 'Jumped' is a doing word." },
            { kind: "build", q: "Make it more interesting: add 2 describing words", start: [t("the", "the"), t("dragon", "thing"), t("roared", "wow")], tabs: ["adj"], rules: [{ cat: "adj", min: 2, tip: "Add 2 🎨 describing words. Tap 'dragon' first, so they go in front of it." }] },
            { kind: "build", q: "Build your own: a describing word, a thing, then what it did", tabs: ["the", "adj", "thing", "wow", "where"], rules: [{ order: ["the", "adj", "thing", "wow"], tip: "Try: The / A, then a describing word, a thing, and a wow verb." }] }
          ]
        },
        {
          name: "Because, but, so", text: "Joining words glue two ideas together into one bigger sentence.",
          rounds: [
            { kind: "choose", q: "I wore my coat ___ it was cold.", options: [{ t: "because", ok: true }, { t: "but" }, { t: "so" }], why: JOIN },
            { kind: "choose", q: "I wanted to play outside, ___ it was raining.", options: [{ t: "so" }, { t: "because" }, { t: "but", ok: true }], why: JOIN },
            { kind: "choose", q: "The cake was ready, ___ we ate it.", options: [{ t: "but" }, { t: "so", ok: true }, { t: "because" }], why: JOIN },
            { kind: "build", q: "Join two ideas with because, but or so", tabs: ["who", "wow", "where", "join", "when"], tiles: { join: ["because", "but", "so"] }, rules: [{ cat: "join", tip: "Add a 🔗 joining word in the middle." }, { cat: "who", min: 2, tip: "Two ideas need two whos: one before the joining word, one after." }, { cat: ["wow", "did"], min: 2, tip: "Each idea needs its own doing word." }] }
          ]
        }
      ]
    },
    {
      id: 2, kicker: "Chapter 2", name: "Paint with Words", emoji: "🖌️", color: "#6d4c41",
      says: "Great writers make you feel like you're really there: you can see it, hear it, smell it!",
      more: ["Use your five senses: see, hear, smell, touch and taste.", "Show feelings with actions: 'her hands shook' instead of 'she was scared'.", "A great first line makes readers want more."],
      grown: "Sensory detail, 'show, don't tell' and strong openings (a hook) are core craft lessons from primary school all the way to professional writing.",
      lesson: {
        title: "You paint with words!",
        life: "Next time you go somewhere new, stop and notice: what can you see, hear and smell? That's how writers collect ideas.",
        job: "📰 Journalists write news stories. They notice details and describe what happened so clearly that readers feel like they were there."
      },
      levels: [
        {
          name: "Five senses", text: "Which sense does each word go with?",
          rounds: [{
            kind: "sort", q: "Which sense?",
            bins: [{ id: "see", e: "👀", t: "See" }, { id: "hear", e: "👂", t: "Hear" }, { id: "smell", e: "👃", t: "Smell" }, { id: "touch", e: "✋", t: "Touch" }, { id: "taste", e: "👅", t: "Taste" }],
            items: [["sparkly", "see"], ["buzzing", "hear"], ["stinky", "smell"], ["prickly", "touch"], ["sour", "taste"], ["bright", "see"], ["whispering", "hear"], ["smoky", "smell"], ["fluffy", "touch"], ["salty", "taste"]]
          }]
        },
        {
          name: "At the beach", text: "Describe the beach so well that the reader feels they're there.",
          rounds: [
            { kind: "build", q: "What can you see and hear at the beach? 🏖️", tabs: ["frame", "see", "hear", "noun", "join"], rules: [{ senses: 2, tip: "Use words from 2 senses: try a 👀 See word and an 👂 Hear word." }, { cat: "frame", min: 2, tip: "Start each part with 'I can see' or 'I can hear'." }] },
            { kind: "build", q: "Use 3 senses this time!", tabs: ["frame", "see", "hear", "smell", "touch", "taste", "noun", "join"], rules: [{ senses: 3, tip: "Use describing words from 3 different senses." }] }
          ]
        },
        {
          name: "Show, don't tell", text: "Don't just say the feeling. Show what the person does!",
          rounds: [
            { kind: "choose", q: "Which sentence SHOWS that Sam is scared?", options: [{ t: "Sam was scared." }, { t: "Sam's knees shook and he hid behind the door.", ok: true }, { t: "Sam went to the door." }], why: SHOW },
            { kind: "choose", q: "Which sentence SHOWS that Mia is happy?", options: [{ t: "Mia jumped up and down and couldn't stop grinning.", ok: true }, { t: "Mia was happy." }, { t: "Mia sat down." }], why: SHOW },
            { kind: "choose", q: "Which sentence SHOWS that Grandpa is angry?", options: [{ t: "Grandpa was cross." }, { t: "Grandpa had a cup of tea." }, { t: "Grandpa's face went red and he stomped out.", ok: true }], why: SHOW },
            { kind: "build", q: "Show a feeling with a feeling tile", tabs: ["who", "wow", "join", "feel"], rules: [{ cat: "feel", tip: "Add a 💓 feeling tile like 'his hands shook'." }, { cat: "who", tip: "Say who it happened to." }] }
          ]
        },
        {
          name: "Great openings", text: "The first line of a story is like a hook: it catches the reader!",
          rounds: [
            { kind: "choose", q: "Which first line makes you want to read more?", options: [{ t: "This is a story about a dog." }, { t: "The day it rained frogs, everything changed.", ok: true }, { t: "There was a boy. He was nice." }], why: "A great opening line is surprising or mysterious, so you have to find out more." },
            { kind: "choose", q: "Which first line makes you want to read more?", options: [{ t: "Nobody had ever opened the door at the end of the hall. Until today.", ok: true }, { t: "I live in a house." }, { t: "It was a normal day and nothing happened." }], why: "Mystery! Why has nobody opened it? What's behind it? You just have to keep reading." },
            { kind: "build", q: "Write an exciting opening line: start with an opener", tabs: ["opener", "who", "wow", "where", "adj"], rules: [{ first: "opener", tip: "Start with a 🚪 opener, like 'Suddenly,' or 'One stormy night,'." }, { words: 6, tip: "Make it a bit longer: at least 6 words." }] }
          ]
        }
      ]
    },
    {
      id: 3, kicker: "Chapter 3", name: "Story Mountain", emoji: "⛰️", color: "#3949ab",
      says: "Stories climb like a mountain: an opening, a build-up, a problem at the top, a fix, and an ending.",
      more: ["🌅 Opening: who and where.", "🧗 Build-up: something's coming. ⚡ Problem: it goes wrong!", "🛠️ Fix: it gets sorted. 🏁 Ending: how everyone feels."],
      grown: "The story mountain (or story arc) is the planning tool used in most primary classrooms. It maps onto the five-act structure screenwriters and novelists still use.",
      lesson: {
        title: "You climbed the story mountain!",
        life: "Films, books and even your favourite cartoons climb the story mountain. Can you spot the problem next time you watch one?",
        job: "🎬 Screenwriters write the stories for films and TV shows. They plan the whole mountain first, then write every line the actors say."
      },
      levels: [
        {
          name: "Climb the mountain", text: "These story parts are mixed up. Tap them in order, from the opening to the ending.",
          rounds: [
            { kind: "order", why: "Opening, build-up, problem, fix, ending: the story climbs up to the problem, then comes back down.", parts: ["Once upon a time, a little dragon lived in a cave by the sea.", "Every day she practised breathing fire, but only sparks came out.", "One night a big storm blew out every light in the village!", "The dragon took a huge breath and lit all the lanterns with her sparks.", "The villagers cheered, and the dragon felt proud all winter."] },
            { kind: "order", why: "The problem is the top of the mountain. Everything before builds up to it; everything after sorts it out.", parts: ["Mia and her dog Biscuit went to the park.", "They played fetch with Biscuit's favourite red ball.", "Suddenly the ball rolled into the duck pond!", "Biscuit jumped in with a huge splash and swam out with the ball.", "Mia laughed all the way home with a very wet dog."] }
          ]
        },
        {
          name: "What's missing?", text: "One part of the story is missing. Which one fits?",
          rounds: [
            { kind: "choose", show: ["A pirate sailed across the sea in a tiny boat.", "He was looking for a treasure island.", null, "He used his hat to scoop the water out.", "He reached the island, soggy but happy."], q: "Which part is missing?", options: [{ t: "Suddenly, his boat sprang a leak!", ok: true }, { t: "He liked sandwiches." }, { t: "The end." }], why: "The fix is scooping water, so the problem must be water coming in: a leak!" },
            { kind: "choose", show: ["A robot lived in a busy kitchen.", "It loved baking cakes for everyone.", "One day it ran out of flour!", null, "Everyone agreed it was the best cake ever."], q: "Which part is missing?", options: [{ t: "The robot went to sleep." }, { t: "It borrowed some from the kind neighbour and baked a giant cake.", ok: true }, { t: "It was a Tuesday." }], why: "After the problem comes the fix: how did the robot get flour?" },
            { kind: "choose", show: [null, "They set up the tent as the sun went down.", "At midnight they heard a strange howl!", "It was only Grandpa, snoring!", "Everyone laughed until they fell asleep."], q: "Which part is missing?", options: [{ t: "Snoring is loud." }, { t: "The end." }, { t: "Sam and Grandpa went camping in the forest.", ok: true }], why: "Every story needs an opening: who is in it and where they are." }
          ]
        },
        {
          name: "Write a story", text: "Your first whole story! Fill in each part of the mountain.",
          rounds: [{
            kind: "mountain", q: "Brief: a story about a lost teddy 🧸",
            tabs: ["who", "wow", "where", "when", "adj", "join", "feel", "opener", "mark"],
            rules: [
              { every: 3, tip: "Every part needs at least 3 words. Tap each step on the mountain to write it." },
              { cat: "adj", min: 2, tip: "Add at least 2 🎨 describing words somewhere in your story." },
              { cat: "join", tip: "Use a 🔗 joining word (because, but, so or and) somewhere." }
            ]
          }]
        },
        {
          name: "Your big story", text: "Write any story you like! It just needs these things.",
          rounds: [{
            kind: "mountain", q: "Brief: any story you like ✨",
            tabs: ["opener", "who", "wow", "where", "when", "adj", "join", "feel", "mark"],
            rules: [
              { every: 4, tip: "Every part needs at least 4 words." },
              { part: 0, first: "opener", tip: "Start your opening with a 🚪 opener, like 'Once upon a time,'." },
              { part: 2, cat: "feel", tip: "Show a feeling in the problem part with a 💓 feeling tile." },
              { cat: "wow", min: 2, tip: "Use at least 2 ⚡ wow verbs." }
            ]
          }]
        }
      ]
    }
  ];

  SB.JOBS = [
    { emoji: "📚", name: "Author", does: "Writes books: stories, adventures, and books full of facts." },
    { emoji: "📰", name: "Journalist", does: "Finds out what's happening and writes news stories so everyone knows." },
    { emoji: "🎬", name: "Screenwriter", does: "Writes the stories and words for films, TV shows and cartoons." }
  ];

  SB.QUIZ = [
    [
      { emoji: "⚡", q: "Which is a wow verb?", a: ["Zoomed", "Went", "Got"], right: 0, why: "'Zoomed' shows exactly how something moved: fast!" },
      { emoji: "🔗", q: "Which is a joining word?", a: ["Because", "Fluffy", "Dragon"], right: 0, why: "Because, but, so and and join ideas together." }
    ],
    [
      { emoji: "👃", q: "'Smoky' goes with which sense?", a: ["Smell", "Hear", "Taste"], right: 0, why: "You smell smoke with your nose." },
      { emoji: "😨", q: "Which sentence shows someone is scared?", a: ["His hands shook", "He was scared", "He sat down"], right: 0, why: "Showing what someone does lets the reader work out the feeling." }
    ],
    [
      { emoji: "⛰️", q: "What comes at the top of the story mountain?", a: ["The problem", "The ending", "The title"], right: 0, why: "The story climbs up to the problem, then the fix brings it back down." },
      { emoji: "🎬", q: "Who writes the stories for films?", a: ["A screenwriter", "A camera operator", "A chef"], right: 0, why: "Screenwriters plan the story and write every line the actors say." }
    ]
  ];
})();
