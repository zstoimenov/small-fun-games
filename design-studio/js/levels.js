/* Design Studio - chapters, levels, jobs and quiz. Data only.                 */
/*                                                                             */
/* A level is a list of rounds:                                                */
/*   choose  pick an answer (options can be swatches, pairs or mini posters)  */
/*   mix     add drops of paint until the pot matches a target colour         */
/*   sort    put each colour in the right bin, one at a time                  */
/*   design  make a poster that fits a brief (rules, each with a tip)         */
/* A pot is { red, yellow, blue, white, black } in drops.                      */
"use strict";
window.DS = window.DS || {};

const RYB = ["red", "yellow", "blue"];
const RYBW = ["red", "yellow", "blue", "white"];
const ALL = ["red", "yellow", "blue", "white", "black"];
const SW = { red: "#e32b2b", yellow: "#ffe12e", blue: "#2a5fd0", orange: "#ff8000", green: "#00a833", purple: "#800080" };
const sw = (name, ok) => ({ sw: SW[name], t: name[0].toUpperCase() + name.slice(1), ok: !!ok });
const PRIMARY = "Red, yellow and blue are the primary colours: you can't make them by mixing other paints.";
const OPPOSITE = "Opposite colours make each other look brighter. Designers use them to make things pop!";
const READ = "Big differences between light and dark are easiest to read. Colours that are both light, or both dark, blur together.";

DS.CHAPTERS = [
  {
    id: 1, kicker: "Chapter 1", name: "Mixing", emoji: "🎨", color: "#e0521f",
    says: "Red, yellow and blue are the primary colours. Mix any two and you get a brand new colour!",
    more: ["Red + yellow = orange. Yellow + blue = green. Blue + red = purple.", "More of one colour pulls the mix towards it.", "Mix all three and you get brown, so painters mix carefully."],
    grown: "This is the painter's RYB model taught in schools. Printers use cyan, magenta and yellow, which mix more cleanly, and screens mix light (red, green and blue), which works the other way round.",
    lesson: {
      title: "You're a colour mixer!",
      life: "Most colours around you are mixes. Which paints would make your favourite colour?",
      job: "🖌️ Painters and artists mix their own colours. House painters mix paint to match exactly the colour a customer picked."
    },
    levels: [
      {
        name: "Primary colours", text: "Three colours are special: you can't make them by mixing. Can you spot them?",
        rounds: [
          { kind: "choose", q: "Which one is a primary colour?", options: [sw("red", 1), sw("orange"), sw("green")], why: PRIMARY },
          { kind: "choose", q: "Which one is a primary colour?", options: [sw("purple"), sw("green"), sw("yellow", 1)], why: PRIMARY },
          { kind: "choose", q: "Which one is a primary colour?", options: [sw("orange"), sw("blue", 1), sw("purple")], why: PRIMARY }
        ]
      },
      {
        name: "Make new colours", text: "Tap the paint pots to add drops. Can you make the colour in the box?",
        rounds: [
          { kind: "mix", q: "Make orange", target: { red: 1, yellow: 1 }, paints: RYB },
          { kind: "mix", q: "Make green", target: { yellow: 1, blue: 1 }, paints: RYB },
          { kind: "mix", q: "Make purple", target: { red: 1, blue: 1 }, paints: RYB }
        ]
      },
      {
        name: "Match it", text: "More of one paint pulls the mix towards it. Match each colour exactly.",
        rounds: [
          { kind: "mix", q: "Match this reddy orange", target: { red: 2, yellow: 1 }, paints: RYB },
          { kind: "mix", q: "Match this lime green", target: { yellow: 2, blue: 1 }, paints: RYB },
          { kind: "mix", q: "Match this deep purple", target: { blue: 2, red: 1 }, paints: RYB }
        ]
      },
      {
        name: "Mud!", text: "What happens if you mix all three primary colours?",
        rounds: [
          { kind: "mix", q: "Mix red, yellow and blue, the same amount of each", target: { red: 1, yellow: 1, blue: 1 }, paints: RYB },
          {
            kind: "choose", q: "Why did it go brown?", options: [
              { e: "🌀", t: "All three colours muddle together", ok: true }, { e: "⏳", t: "The paint got old", ok: false }, { e: "🟤", t: "Brown is a primary colour", ok: false }
            ], why: "Each primary soaks up some light. Mix all three and they soak up nearly everything, so you get a muddy brown. Artists clean their brushes between colours!"
          }
        ]
      }
    ]
  },
  {
    id: 2, kicker: "Chapter 2", name: "Light, Dark, Warm, Cool", emoji: "🌗", color: "#1e88e5",
    says: "Add white to make a colour lighter, black to make it darker. And colours can feel warm like fire, or cool like water.",
    more: ["A colour with white added is a tint: red becomes pink.", "A colour with black added is a shade: blue becomes navy.", "Warm: red, orange, yellow. Cool: green, blue, purple."],
    grown: "Tints, shades and colour temperature are the basic tools of colour schemes. Complementary colours sit opposite each other on the colour wheel and make each other look more vivid.",
    lesson: {
      title: "You know your tints and shades!",
      life: "Look at your clothes. Are they warm colours or cool colours? Which do you pick most?",
      job: "👗 Fashion designers choose colours that go together for every outfit, and plan which colours will be popular next season."
    },
    levels: [
      {
        name: "Make it lighter", text: "White makes a colour lighter. The more white, the paler it gets.",
        rounds: [
          { kind: "mix", q: "Make pink", target: { red: 1, white: 1 }, paints: RYBW },
          { kind: "mix", q: "Make sky blue", target: { blue: 1, white: 2 }, paints: RYBW },
          { kind: "mix", q: "Make lilac (a pale purple)", target: { red: 1, blue: 1, white: 2 }, paints: RYBW }
        ]
      },
      {
        name: "Make it darker", text: "Black makes a colour darker. Careful: black is strong! Add it one drop at a time.",
        rounds: [
          { kind: "mix", q: "Make dark red", target: { red: 3, black: 1 }, paints: ALL },
          { kind: "mix", q: "Make navy blue", target: { blue: 3, black: 1 }, paints: ALL },
          { kind: "mix", q: "Make forest green", target: { yellow: 2, blue: 2, black: 1 }, paints: ALL }
        ]
      },
      {
        name: "Warm or cool?", text: "Warm colours feel like fire and sunshine. Cool colours feel like water and leaves.",
        rounds: [{
          kind: "sort", q: "Warm or cool?",
          bins: [{ id: "warm", e: "🔥", t: "Warm" }, { id: "cool", e: "❄️", t: "Cool" }],
          items: [["#e53935", "warm"], ["#29b6f6", "cool"], ["#fb8c00", "warm"], ["#43a047", "cool"], ["#fdd835", "warm"], ["#1e5bd8", "cool"], ["#ec407a", "warm"], ["#8e24aa", "cool"]]
        }]
      },
      {
        name: "Opposites", text: "The colour wheel puts every colour in a circle. Opposite colours are best friends.",
        rounds: [
          { kind: "choose", wheel: true, q: "What's opposite red on the colour wheel?", options: [sw("orange"), sw("green", 1), sw("purple")], why: OPPOSITE },
          { kind: "choose", wheel: true, q: "What's opposite blue?", options: [sw("orange", 1), sw("green"), sw("purple")], why: OPPOSITE },
          { kind: "choose", wheel: true, q: "What's opposite yellow?", options: [sw("green"), sw("orange"), sw("purple", 1)], why: OPPOSITE }
        ]
      }
    ]
  },
  {
    id: 3, kicker: "Chapter 3", name: "Design", emoji: "📐", color: "#8e24aa",
    says: "Designers use colour to make people feel something, and to make words easy to read.",
    more: ["Dark words on a light background (or light on dark) are easy to read.", "Colours send messages: red means stop, green means go.", "Good designs use just a few colours."],
    grown: "Contrast ratio is the measure behind accessible design: 4.5 to 1 for normal text, 3 to 1 for big titles. Limiting a palette to two or three colours plus a neutral is a classic designer's rule.",
    lesson: {
      title: "You're a designer!",
      life: "Look at signs, cereal boxes and posters. Why did the designer pick those colours? Can you read them from far away?",
      job: "🖥️ Graphic designers make posters, logos, websites, book covers and packaging. They choose colours, pictures and words that work together."
    },
    levels: [
      {
        name: "Can you read it?", text: "A poster has to be read from across the room. Which one works?",
        rounds: [
          [["#ffffff", "#fdd835"], ["#fdd835", "#212121", 1], ["#29b6f6", "#43a047"]],
          [["#1a237e", "#ffffff", 1], ["#1a237e", "#8e24aa"], ["#e53935", "#ec407a"]],
          [["#fff3d6", "#fdd835"], ["#43a047", "#e53935"], ["#fff3d6", "#795548", 1]]
        ].map((set) => ({
          kind: "choose", q: "Which one is easiest to read from far away?", why: READ,
          options: set.map(([bg, fg, ok]) => ({ poster: { bg, fg, text: "SALE" }, t: "", ok: !!ok }))
        }))
      },
      {
        name: "Colours send messages", text: "People feel things when they see colours. Pick the colour that sends the right message.",
        rounds: [
          { kind: "choose", q: "Which colour for a STOP sign? 🛑", options: [{ sw: "#e53935", t: "Red", ok: true }, { sw: "#43a047", t: "Green", ok: false }, { sw: "#29b6f6", t: "Light blue", ok: false }], why: "Red grabs your attention fast. It means stop, danger or hot, all over the world." },
          { kind: "choose", q: "Which colour for a nature park? 🌳", options: [{ sw: "#212121", t: "Black", ok: false }, { sw: "#43a047", t: "Green", ok: true }, { sw: "#ec407a", t: "Pink", ok: false }], why: "Green reminds us of leaves and grass, so it says nature, fresh and safe." },
          { kind: "choose", q: "Which colour for a calm, sleepy bedroom? 😴", options: [{ sw: "#e53935", t: "Bright red", ok: false }, { sw: "#fb8c00", t: "Orange", ok: false }, { sw: "#9cc3e6", t: "Soft blue", ok: true }], why: "Soft, cool colours feel calm. Bright, warm colours feel busy and exciting." }
        ]
      },
      {
        name: "Pool party poster", text: "Your first job for a customer! Make a poster that fits the brief, then press Check.",
        rounds: [{
          kind: "design", q: "Brief: a poster for a pool party 🏊",
          start: { bg: "#ffffff", title: { text: "POOL PARTY", color: "#fdd835", x: 150, y: 90, size: 40 }, items: [] },
          rules: [
            { bg: "cool", tip: "Pools are cool! Tap 🖼️ Background and pick a blue or a green." },
            { contrast: 3, tip: "Can you read the title? Tap the words and pick a colour that stands out from the background." },
            { stickers: 2, tip: "Add at least 2 stickers, like 🏊 or 🌊." }
          ]
        }]
      },
      {
        name: "Design a logo", text: "A logo has to work on a shop sign and on a tiny cup. Keep it simple!",
        rounds: [{
          kind: "design", q: "Brief: a logo for a lemonade stand 🍋",
          start: { bg: "#ffffff", title: { text: "Lemonade", color: "#fff3d6", x: 150, y: 330, size: 46 }, items: [{ k: "shape", shape: "circle", color: "#29b6f6", x: 150, y: 170, s: 150 }, { k: "shape", shape: "star", color: "#8e24aa", x: 70, y: 70, s: 60 }] },
          rules: [
            { bg: "warm", tip: "Lemonade is sunny: pick a warm background." },
            { contrast: 3, tip: "Can you read the name? Tap it and pick a colour that stands out." },
            { stickers: 1, tip: "Add a sticker that shows what you sell, like 🍋." },
            { colours: 3, tip: "Good logos use 3 colours or fewer. Change or delete a shape to use fewer." }
          ]
        }]
      }
    ]
  }
];

DS.JOBS = [
  { emoji: "🖥️", name: "Graphic designer", does: "Designs posters, logos, websites, book covers and packaging." },
  { emoji: "🖌️", name: "Artist", does: "Paints pictures, murals and portraits, mixing every colour by hand." },
  { emoji: "👗", name: "Fashion designer", does: "Designs clothes, and picks the colours and fabrics that go together." }
];

DS.QUIZ = [
  [
    { emoji: "🟢", q: "Which two paints make green?", a: ["Yellow and blue", "Red and blue", "Red and yellow"], right: 0, why: "Yellow + blue = green. Red + blue = purple, and red + yellow = orange." },
    { emoji: "🟠", q: "Red + yellow makes...", a: ["Orange", "Purple", "Green"], right: 0, why: "Red and yellow make orange: think of a sunset." }
  ],
  [
    { emoji: "🌸", q: "Adding white to a colour makes it...", a: ["Lighter", "Darker", "Warmer"], right: 0, why: "White makes a tint: red plus white is pink." },
    { emoji: "❄️", q: "Which is a cool colour?", a: ["Blue", "Orange", "Red"], right: 0, why: "Blues, greens and purples feel cool, like water and leaves." }
  ],
  [
    { emoji: "👀", q: "Which is easiest to read?", a: ["Black on white", "Yellow on white", "Dark blue on black"], right: 0, why: "Very dark on very light is easiest to read." },
    { emoji: "🖥️", q: "What does a graphic designer make?", a: ["Posters and logos", "Bridges", "Medicine"], right: 0, why: "Graphic designers choose colours, pictures and words for posters, logos, websites and more." }
  ]
];

// Stickers for posters, and the shapes.
DS.STICKERS = ["🌞", "🌊", "🏊", "🍋", "🎈", "⭐", "❤️", "🐬", "🌴", "🍦", "🎉", "🐱", "🐶", "🚀", "🌈", "⚽", "🎸", "🌸", "🍕", "🦄", "🐢", "🌙", "🔥", "❄️"];
DS.SHAPES = [{ id: "circle", e: "⚫" }, { id: "square", e: "⬛" }, { id: "triangle", e: "🔺" }, { id: "star", e: "⭐" }, { id: "heart", e: "❤️" }];
