/* Comic Studio - chapters, levels, jobs and quiz. Data only.                  */
/*                                                                             */
/* A level is a list of rounds:                                                */
/*   order   put three mixed-up panels in story order                         */
/*   choose  pick an answer: a panel, a face, a kind of bubble, or words      */
/*   build   make a comic that fits a brief (rules, each with a tip)          */
"use strict";
window.CS = window.CS || {};

(function () {
  // A panel, written short: chars are [who, face, x, flip, size], props
  // [emoji, x, y, size], bubbles [kind, text, x, y, tail].
  const P = (scene, chars, props, bubbles) => ({
    scene,
    chars: (chars || []).map(([c, face, x, flip, s]) => ({ c, face, x, y: 228, s: s || 120, flip: !!flip })),
    props: (props || []).map(([e, x, y, s]) => ({ e, x, y, s: s || 44 })),
    bubbles: (bubbles || []).map(([kind, text, x, y, tail]) => ({ kind, text, x, y, tail: tail == null ? (kind === "say" || kind === "think" ? -1 : 0) : tail }))
  });
  const face = (c, f, ok) => ({ face: { c, f }, t: CS.FACES.find((x) => x.id === f).name, ok: !!ok });
  const ORDER = "Stories go beginning, middle, end: first we meet someone, then something happens, then it gets sorted out.";

  CS.CHAPTERS = [
    {
      id: 1, kicker: "Chapter 1", name: "Story Shape", emoji: "📖", color: "#e91e63",
      says: "Every story has a beginning, a middle and an end. And the best stories have a problem to solve!",
      more: ["Beginning: meet the characters and where they are.", "Middle: something goes wrong, a problem!", "End: the problem gets fixed (or not!)."],
      grown: "Beginning, middle and end is the three-act structure behind most films and books: set-up, conflict, resolution. Comics make it visible, one panel at a time.",
      lesson: {
        title: "You know how stories work!",
        life: "Next time you read a book or watch a show, look for the problem. When does it start? How does it get fixed?",
        job: "✍️ Writers plan stories: who's in them, what goes wrong, and how it gets fixed. Comic writers plan every panel before anyone draws it."
      },
      levels: [
        {
          name: "Put it in order", text: "These panels got mixed up! Tap them in the right order: 1, 2, 3.",
          rounds: [
            { kind: "order", why: ORDER, panels: [
              P("park", [["sam", "happy", 110]], [["🌱", 190, 205, 36]], [["say", "I'll plant a seed!", 170, 50, -1]]),
              P("park", [["sam", "sleepy", 110]], [["🌧️", 200, 60, 50], ["🌱", 190, 205, 40]], [["caption", "Every day...", 70, 20]]),
              P("park", [["sam", "surprised", 100]], [["🌻", 200, 170, 110]], [["say", "Wow!", 60, 50, 1]])] },
            { kind: "order", why: ORDER, panels: [
              P("park", [["sam", "happy", 80], ["biscuit", "happy", 200, true, 90]], [["⚽", 120, 150, 30]], [["say", "Fetch, Biscuit!", 90, 45, 0]]),
              P("park", [["biscuit", "happy", 150, false, 90]], [["⚽", 210, 175, 30]], [["sound", "ZOOM!", 70, 70]]),
              P("park", [["sam", "happy", 90], ["biscuit", "happy", 190, true, 90]], [["⚽", 150, 200, 30]], [["say", "Good dog!", 90, 45, 0]])] },
            { kind: "order", why: ORDER, panels: [
              P("kitchen", [["mia", "happy", 100]], [["🍪", 190, 160, 40]], [["say", "Let's bake cookies!", 150, 40, -1]]),
              P("kitchen", [["mia", "sleepy", 100]], [["🍪", 200, 160, 40]], [["caption", "Later that day...", 80, 20], ["think", "Are they ready?", 190, 60, -1]]),
              P("kitchen", [["mia", "happy", 90], ["sam", "happy", 210, true]], [["🍪", 150, 165, 50]], [["say", "Yum!", 210, 45, 1]])] }
          ]
        },
        {
          name: "What happens next?", text: "Read the first two panels. Which one should come next?",
          rounds: [
            {
              kind: "choose", q: "What happens next?", why: "The wave knocks the castle down, so Sam is sad. The ending has to follow from the middle.",
              show: [P("beach", [["sam", "happy", 90]], [["🏰", 200, 200, 60]], [["say", "My sandcastle!", 110, 40, -1]]), P("beach", [["sam", "scared", 90]], [["🏰", 200, 200, 60], ["🌊", 250, 150, 90]], [["say", "Oh no!", 90, 40, 0]]), null],
              options: [
                { panel: P("beach", [["sam", "sad", 120]], [], [["say", "My castle is gone!", 150, 40, -1]]), ok: true },
                { panel: P("space", [["bolt", "happy", 150]], [["🚀", 240, 170, 60]]) },
                { panel: P("kitchen", [["biscuit", "sleepy", 150, false, 100]]) }
              ]
            },
            {
              kind: "choose", q: "What happens next?", why: "Mia was nervous, then read her story, so the class claps and she's happy.",
              show: [P("school", [["mia", "scared", 150]], [["📚", 220, 190, 40]], [["think", "I have to read in front of everyone!", 150, 40, 0]]), P("school", [["mia", "happy", 150]], [["📚", 205, 160, 40]], [["say", "Once upon a time...", 150, 40, 0]]), null],
              options: [
                { panel: P("beach", [["sam", "happy", 150]], [["⚽", 220, 190, 30]]) },
                { panel: P("school", [["mia", "happy", 110], ["sam", "happy", 210, true]], [], [["sound", "CLAP CLAP!", 150, 60]]), ok: true },
                { panel: P("forest", [["biscuit", "angry", 150, false, 100]]) }
              ]
            },
            {
              kind: "choose", q: "What happens next?", why: "Bolt lost the rocket, found it, so next Bolt flies home.",
              show: [P("space", [["bolt", "sad", 150]], [], [["think", "Where is my rocket?", 150, 40, 0]]), P("space", [["bolt", "surprised", 100]], [["🚀", 220, 170, 70]], [["say", "There it is!", 110, 40, 1]]), null],
              options: [
                { panel: P("space", [], [["🚀", 150, 110, 90]], [["sound", "ZOOM!", 70, 60], ["caption", "Home time!", 230, 20]]), ok: true },
                { panel: P("kitchen", [["mia", "happy", 150]], [["🎂", 220, 160, 40]]) },
                { panel: P("school", [["sam", "sleepy", 150]]) }
              ]
            }
          ]
        },
        {
          name: "The missing middle", text: "You can see the start and the end. What happened in the middle?",
          rounds: [
            {
              kind: "choose", q: "What happened in the middle?", why: "Biscuit grabbed the ice cream! The middle has to explain how we got to the end.",
              show: [P("park", [["sam", "happy", 150]], [["🍦", 190, 150, 36]], [["say", "Yum!", 100, 40, 1]]), null, P("park", [["sam", "sad", 90], ["biscuit", "happy", 210, true, 90]], [["🍦", 230, 150, 30]])],
              options: [
                { panel: P("park", [["sam", "surprised", 90], ["biscuit", "happy", 200, true, 90]], [["🍦", 150, 140, 36]], [["sound", "SLURP!", 220, 50]]), ok: true },
                { panel: P("park", [["sam", "sleepy", 150]]) },
                { panel: P("space", [["bolt", "happy", 150]]) }
              ]
            },
            {
              kind: "choose", q: "What happened in the middle?", why: "Bolt is tall enough to reach the kite. That's how Mia got it back.",
              show: [P("park", [["mia", "sad", 110]], [["🪁", 240, 70, 44]], [["say", "My kite is stuck!", 110, 40, 1]]), null, P("park", [["mia", "happy", 100], ["bolt", "happy", 200, true]], [["🪁", 60, 150, 44]], [["say", "Thanks, Bolt!", 100, 40, 1]])],
              options: [
                { panel: P("kitchen", [["mia", "happy", 150]], [["🎂", 220, 160, 40]]) },
                { panel: P("park", [["bolt", "happy", 200]], [["🪁", 240, 70, 44]], [["say", "I can reach it!", 110, 40, 1]]), ok: true },
                { panel: P("beach", [["sam", "scared", 150]], [["🌊", 240, 150, 80]]) }
              ]
            },
            {
              kind: "choose", q: "What happened in the middle?", why: "Biscuit followed his nose home. The middle is where the problem gets worked out.",
              show: [P("forest", [["sam", "scared", 150]], [["🌙", 250, 40, 40]], [["think", "I'm lost...", 150, 40, 0]]), null, P("kitchen", [["sam", "happy", 110], ["biscuit", "happy", 210, true, 90]], [], [["say", "Home at last!", 110, 40, 1]])],
              options: [
                { panel: P("school", [["sam", "happy", 150]]) },
                { panel: P("space", [["sam", "surprised", 150]], [["🚀", 240, 170, 60]]) },
                { panel: P("forest", [["sam", "surprised", 90], ["biscuit", "happy", 200, true, 90]], [], [["say", "Woof! This way!", 200, 45, 1]]), ok: true }
              ]
            }
          ]
        },
        {
          name: "Every story has a problem", text: "Read each comic. What's the problem?",
          rounds: [
            {
              kind: "choose", q: "What's the problem in this story?", why: "The problem is the bit that goes wrong in the middle. Then the ending fixes it.",
              show: [P("park", [["biscuit", "happy", 150, false, 100]], [["🦴", 210, 200, 36]]), P("park", [["biscuit", "sad", 150, false, 100]], [], [["say", "My bone fell in a hole!", 150, 40, 0]]), P("park", [["biscuit", "happy", 150, false, 100]], [["🦴", 210, 200, 36]], [["say", "Found it!", 150, 40, 0]])],
              options: [{ e: "🕳️", t: "The bone fell in a hole", ok: true }, { e: "🐶", t: "Biscuit is a dog" }, { e: "☀️", t: "It's sunny" }]
            },
            {
              kind: "choose", q: "What's the problem in this story?", why: "Bolt's battery ran out: that's what went wrong, and Sam fixes it.",
              show: [P("kitchen", [["bolt", "happy", 150]], [], [["say", "Beep! Cleaning time!", 150, 40, 0]]), P("kitchen", [["bolt", "sleepy", 150]], [], [["sound", "BZZT!", 230, 60], ["think", "Battery... empty...", 110, 40, 0]]), P("kitchen", [["bolt", "happy", 100], ["sam", "happy", 210, true]], [["🔌", 150, 200, 36]], [["say", "Thank you!", 100, 40, 1]])],
              options: [{ e: "🧹", t: "Bolt likes cleaning" }, { e: "🔋", t: "Bolt's battery ran out", ok: true }, { e: "🔌", t: "Sam has a plug" }]
            },
            {
              kind: "choose", q: "Why do stories need a problem?", why: "Without a problem nothing happens. The problem is what makes you want to turn the page!",
              options: [{ e: "🤩", t: "So something exciting happens", ok: true }, { e: "📏", t: "To make it longer" }, { e: "🤷", t: "They don't need one" }]
            }
          ]
        }
      ]
    },
    {
      id: 2, kicker: "Chapter 2", name: "Feelings & Faces", emoji: "😲", color: "#ff9800",
      says: "Comic artists show feelings with faces. Eyebrows, eyes and mouths tell you everything!",
      more: ["Eyebrows up in the middle = sad. Down in the middle = angry.", "Speech bubbles are said out loud. Thought bubbles are secret.", "Show it, don't say it: draw the feeling on the face."],
      grown: "Emotion recognition from faces is a real social skill, and comics make it explicit. 'Show, don't tell' is the classic writing rule: a scared face beats a caption saying 'Sam was scared'.",
      lesson: {
        title: "You can read faces!",
        life: "Faces tell us how people feel, even when they don't say it. If a friend's face looks sad, you could ask if they're OK.",
        job: "✏️ Illustrators draw the pictures in comics, books and games. They practise faces a lot: it's how readers know what everyone feels."
      },
      levels: [
        {
          name: "How do they feel?", text: "Read what happened. Pick the face that fits.",
          rounds: [
            { kind: "choose", q: "Sam just got a new puppy! 🐶", options: [face("sam", "happy", 1), face("sam", "angry"), face("sam", "sleepy")], why: "A new puppy! Sam's eyes smile and the mouth is wide open." },
            { kind: "choose", q: "Mia's ice cream fell on the ground. 🍦", options: [face("mia", "surprised"), face("mia", "sad", 1), face("mia", "happy")], why: "Eyebrows up in the middle, mouth down, maybe a tear: that's sad." },
            { kind: "choose", q: "A big spider landed on Sam's arm! 🕷️", options: [face("sam", "sleepy"), face("sam", "happy"), face("sam", "scared", 1)], why: "Wide eyes, wobbly mouth and a drop of sweat: scared!" },
            { kind: "choose", q: "Someone knocked Bolt's tower down on purpose! 🧱", options: [face("bolt", "angry", 1), face("bolt", "sad"), face("bolt", "surprised")], why: "Eyebrows pointing down in the middle and a tight mouth: angry." }
          ]
        },
        {
          name: "Match the words", text: "Read what they say. Which face goes with the words?",
          rounds: [
            { kind: "choose", q: "\"Is it morning already? Yawn...\"", options: [face("biscuit", "angry"), face("biscuit", "sleepy", 1), face("biscuit", "scared")], why: "Droopy closed eyes and a little 'z': sleepy." },
            { kind: "choose", q: "\"A surprise party? For ME?!\"", options: [face("mia", "surprised", 1), face("mia", "sad"), face("mia", "sleepy")], why: "Big round eyes, eyebrows high and an open 'O' mouth: surprised!" },
            { kind: "choose", q: "\"GRRR! Who took my toy?\"", options: [face("sam", "happy"), face("sam", "scared"), face("sam", "angry", 1)], why: "Grrr sounds angry, so the eyebrows go down in the middle." }
          ]
        },
        {
          name: "Say or think?", text: "Comics have different boxes for different words. Which one fits?",
          rounds: [
            { kind: "choose", q: "Sam shouts to Mia: \"Over here!\"", options: [{ bub: "say", t: "Speech bubble", ok: true }, { bub: "think", t: "Thought bubble" }, { bub: "caption", t: "Caption box" }], why: "Words said out loud go in a speech bubble, with a pointy tail to whoever says them." },
            { kind: "choose", q: "Sam doesn't want anyone to know: \"I hope nobody saw me trip...\"", options: [{ bub: "say", t: "Speech bubble" }, { bub: "think", t: "Thought bubble", ok: true }, { bub: "sound", t: "Sound word" }], why: "Secret thoughts go in a cloudy thought bubble. Only the reader knows!" },
            { kind: "choose", q: "The story needs to say when it happens: \"The next morning...\"", options: [{ bub: "caption", t: "Caption box", ok: true }, { bub: "think", t: "Thought bubble" }, { bub: "say", t: "Speech bubble" }], why: "Caption boxes are the storyteller's voice: when, where, and 'meanwhile'." },
            { kind: "choose", q: "Biscuit barks really loudly.", options: [{ bub: "think", t: "Thought bubble" }, { bub: "caption", t: "Caption box" }, { bub: "sound", t: "Sound word", ok: true }], why: "Loud noises get big sound words like WOOF!, POW! and SPLASH!" }
          ]
        },
        {
          name: "Show, don't tell", text: "Don't write the feeling: draw it! Tap a character to change their face.",
          rounds: [
            {
              kind: "build", q: "Thunder! Make Biscuit look scared of the storm. ⛈️",
              start: { panels: [P("park", [["biscuit", "happy", 150, false, 100]], [["🌧️", 230, 50, 60]], [["sound", "BOOM!", 80, 60]])] },
              rules: [{ face: ["scared"], who: "biscuit", tip: "Tap Biscuit, then tap 😱 Scared." }]
            },
            {
              kind: "build", q: "Sam just won a race! Show how Sam feels, and add something Sam says. 🏆",
              start: { panels: [P("park", [["sam", "sad", 150]])] },
              rules: [{ face: ["happy", "surprised"], who: "sam", tip: "Tap Sam and pick a face for winning: happy or surprised." }, { kind: "say", min: 1, tip: "Tap 💬 Words, then Speech, and pick what Sam says." }]
            }
          ]
        }
      ]
    },
    {
      id: 3, kicker: "Chapter 3", name: "Make a Comic", emoji: "💥", color: "#3f51b5",
      says: "Now you're the writer and the artist. Plan it, draw it, and make your readers feel something!",
      more: ["Keep your hero in every panel so readers can follow them.", "Change their face as the story changes.", "Use captions to jump in time, and sound words for big moments."],
      grown: "These briefs are how comic and storyboard artists work: a script gives the beats, and the artist picks scenes, faces and lettering to land them. Storyboards for films and cartoons use exactly this.",
      lesson: {
        title: "You made a real comic!",
        life: "You can make comics about anything: your weekend, your pet, a made-up hero. Try drawing one on paper too!",
        job: "🎬 Animators and storyboard artists plan cartoons and films as comic strips first, one drawing for each moment."
      },
      levels: [
        {
          name: "Problem and fix", text: "Make a 3-panel story: something goes wrong, then it gets fixed.",
          rounds: [{
            kind: "build", q: "Brief: something goes wrong, then gets fixed",
            start: { panels: [P("park", [["sam", "happy", 110]]), P("park", [["sam", "happy", 110]]), P("park", [["sam", "happy", 110]])] },
            rules: [
              { panel: 1, face: ["sad", "scared", "angry", "surprised"], tip: "Panel 2 is the problem! Tap panel 2, tap Sam, and pick a worried face." },
              { panel: 2, face: ["happy"], tip: "Panel 3 is the fix, so someone should look happy there." },
              { kind: "say", min: 2, tip: "Add at least 2 speech bubbles so we know what's going on." }
            ]
          }]
        },
        {
          name: "Big moments", text: "Sound words and secret thoughts make a comic exciting.",
          rounds: [{
            kind: "build", q: "Brief: a day at the beach, with a big moment",
            start: { panels: [P("beach", [["mia", "happy", 110]], [["⚽", 200, 190, 30]]), P("beach", []), P("beach", [])] },
            rules: [
              { hero: true, tip: "Keep your hero in every panel: add Mia (or someone) to panels 2 and 3." },
              { kind: "sound", min: 1, tip: "Add a sound word for the big moment, like SPLASH!" },
              { kind: "think", min: 1, tip: "Add a thought bubble: what is someone secretly thinking?" }
            ]
          }]
        },
        {
          name: "Jump in time", text: "Stories can move to a new place and a new time. Captions tell the reader.",
          rounds: [{
            kind: "build", q: "Brief: Biscuit goes on an adventure",
            start: { panels: [P("park", [["biscuit", "happy", 120, false, 100]]), P("park", [["biscuit", "happy", 120, false, 100]]), P("park", [["biscuit", "happy", 120, false, 100]])] },
            rules: [
              { moves: true, tip: "Adventures go somewhere! Change the scene in panel 3." },
              { kind: "caption", min: 1, panels: [1, 2], tip: "Add a caption in panel 2 or 3, like 'Later that day...'" },
              { changes: "biscuit", tip: "Change how Biscuit feels in at least one panel." }
            ]
          }]
        },
        {
          name: "Bolt goes to school", text: "Your biggest brief! Plan all three panels.",
          rounds: [{
            kind: "build", q: "Brief: Bolt's first day at school",
            start: { panels: [P("school", []), P("school", []), P("school", [])] },
            rules: [
              { hero: "bolt", tip: "Put Bolt in all three panels." },
              { changes: "bolt", tip: "Bolt's feelings should change: pick at least 2 different faces." },
              { kind: "any", min: 3, tip: "Add at least 3 bubbles, captions or sound words." }
            ]
          }]
        }
      ]
    }
  ];

  CS.JOBS = [
    { emoji: "✍️", name: "Writer", does: "Plans the story: who's in it, what goes wrong and how it gets fixed." },
    { emoji: "✏️", name: "Illustrator", does: "Draws the pictures in comics, picture books and games." },
    { emoji: "🎬", name: "Animator", does: "Makes drawings move for cartoons and films, starting with a comic-strip plan called a storyboard." }
  ];

  CS.QUIZ = [
    [
      { emoji: "📖", q: "What are the three parts of a story?", a: ["Beginning, middle, end", "Top, side, bottom", "Red, yellow, blue"], right: 0, why: "Beginning (meet everyone), middle (the problem), end (it gets fixed)." },
      { emoji: "🧩", q: "Where does the problem usually happen?", a: ["In the middle", "On the cover", "Nowhere"], right: 0, why: "The beginning sets things up, then the problem shakes things up in the middle." }
    ],
    [
      { emoji: "💭", q: "A thought bubble shows...", a: ["What someone thinks", "What someone shouts", "A loud noise"], right: 0, why: "Thought bubbles are cloudy and secret: only the reader knows." },
      { emoji: "😠", q: "Eyebrows pointing down in the middle usually mean...", a: ["Angry", "Happy", "Sleepy"], right: 0, why: "Down in the middle is a frown: angry. Up in the middle is sad." }
    ],
    [
      { emoji: "🎬", q: "What is a storyboard?", a: ["A comic-strip plan for a film", "A board game", "A bookshelf"], right: 0, why: "Film makers and animators draw the story as panels first, just like a comic." },
      { emoji: "💥", q: "Which is a sound word?", a: ["SPLASH!", "Once upon a time", "Hmm..."], right: 0, why: "Sound words like SPLASH!, POW! and WOOF! show big noises." }
    ]
  ];
})();
