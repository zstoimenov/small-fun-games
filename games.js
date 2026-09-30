/* Game Box catalogue - shared by the launcher (index.html) and Career Compass.
   Plain globals, loaded with a classic <script> before the page's own code. */
"use strict";

// ---- The shelves. A game's `category` has to be one of these ids. ----
// Add a category here and the filter bar picks it up automatically; it only
// shows up once at least one game uses it.
const CATEGORIES = [
  { id: "board",  label: "Board & Strategy", emoji: "♟️" },
  { id: "coding", label: "Coding",           emoji: "🧠" },
  { id: "puzzle", label: "Puzzles",          emoji: "🧩" },
  { id: "maths",  label: "Maths",            emoji: "🔢" },
  { id: "science", label: "Science",         emoji: "🔬" },
  { id: "language", label: "Languages",      emoji: "🗣️" },
  { id: "arts",   label: "Arts & Music",     emoji: "🎨" },
  { id: "sport",  label: "Sport",            emoji: "⚽" }
];
// Tags a game can carry on top of its one category. Each gets a pill and a shelf.
const TAGS = { jobs: { label: "Jobs", emoji: "👷", shelf: "Discover jobs", sub: "games about real jobs" } };

// ---- The catalogue. Add a new game = add one entry here. ----
// "added" is the date the game was published; the list is sorted by it below,
// newest first, so a new entry lands at the top wherever you paste it.
// `hook` is the one line on the card: short enough for a kid to read at a
// glance. `blurb` is the longer story, shown when the card is opened.
// `tags` (optional) puts a game on extra shelves, e.g. "jobs" for the careers
// track. `compass` names the one or two Career Compass work styles the game
// builds (ids in career-compass/js/areas.js). The chips in the details are
// generated from `category`, `players`, `age`, `tags` and `highlights`; don't
// hand-write them.
const GAMES = [
  {
    title: "Music Studio",
    folder: "music-studio",
    compass: ["creator"],
    hook: "Make beats and tunes on a grid",
    tags: ["jobs"],
    emoji: "🎹",
    added: "2026-09-30",
    category: "arts",
    players: [1, 1],
    age: 8,
    blurb: "Tap boxes on a beat grid to make drums and tunes, then press play and hear them loop. Tap along to the beat, copy rhythms by ear, spot the pattern, and find out why some music sounds happy and some sounds sad. Save your songs in your own gallery, and meet the people who make music for a job!",
    colors: ["#ff5d8f", "#5b3cc4"],
    highlights: ["🥁 Beat grid", "💾 Save songs"]
  },
  {
    title: "Career Compass",
    folder: "career-compass",
    compass: [],
    hook: "Find out what kind of work you might love",
    tags: ["jobs"],
    emoji: "🧭",
    added: "2026-09-30",
    category: "puzzle",
    players: [1, 1],
    age: 7,
    blurb: "Builder, Explorer, Creator, Helper, Leader or Organiser: which one sounds like you? Answer 12 would-you-rather questions, rate the games you've played, and watch your compass point the way. Then meet the real jobs in each area and ask a grown-up who does one!",
    colors: ["#6a4c93", "#f0a202"],
    highlights: ["🤔 Would you rather", "👨‍👩‍👧 Grown-up corner"]
  },
  {
    title: "Vet Clinic",
    folder: "vet-clinic",
    compass: ["helper", "explorer"],
    hook: "Be the vet: find what's wrong and fix it",
    tags: ["jobs"],
    emoji: "🩺",
    added: "2026-09-30",
    category: "science",
    players: [1, 1],
    age: 8,
    blurb: "You're the vet! Listen to what the owner says, pick your checks, and compare each result with what's normal for that animal. Find out what's wrong, treat it, and send them home happy. Guess whose heartbeat it is, then help a limping dog, an itchy cat, a koala with sore eyes and an orphaned joey. Meet the people who care for animals for a job!",
    colors: ["#2a9d8f", "#e76f51"],
    highlights: ["🦘 Aussie wildlife"]
  },
  {
    title: "Bridge Builder",
    folder: "bridge-builder",
    compass: ["builder", "explorer"],
    hook: "Build a bridge, then drive a truck over",
    tags: ["jobs"],
    emoji: "🌉",
    added: "2026-09-30",
    category: "science",
    players: [1, 1],
    age: 8,
    blurb: "Be a bridge engineer! Build a bridge out of road, wood and steel, then drive a truck across and watch every piece turn green, yellow or red. Find out why a long plank snaps, why squares fold and triangles don't, and where to put the steel. Meet the people who build bridges for a job!",
    colors: ["#1f6fb2", "#f29f05"],
    highlights: ["🔺 Triangles"]
  },
  {
    title: "Circuit Lab",
    folder: "circuit-lab",
    compass: ["builder", "explorer"],
    hook: "Light bulbs, ring bells, stay safe",
    tags: ["jobs"],
    emoji: "⚡",
    added: "2026-09-30",
    category: "science",
    players: [1, 1],
    age: 8,
    blurb: "Build real circuits with batteries, bulbs, switches and buzzers. Close the loop to light a bulb, make a doorbell, and find out why two bulbs in a row glow dimmer. Test a coin, a key and a pencil to see what lets electricity through, then fix a dangerous short circuit. Meet the people who work with circuits for a job!",
    colors: ["#0f7c7e", "#f5b301"],
    highlights: ["💡 Build & test"]
  },
  {
    title: "Буквар",
    folder: "bulgarian-bukvar",
    compass: ["creator"],
    hook: "Learn to read Bulgarian, letter by letter",
    emoji: "🔤",
    added: "2026-09-30",
    category: "language",
    players: [1, 2],
    age: 7,
    blurb: "Learn to read Bulgarian, one letter at a time. A grown-up says the sounds while you blend them into words. Then match pictures and build words all on your own. Collect history cards about famous Bulgarians, and win passport stamps in the quiz!",
    colors: ["#00966e", "#d62612"],
    highlights: ["👥 With a grown-up", "🛂 Stamp quiz"]
  },
  {
    title: "Newton's Playground",
    folder: "newtons-laws",
    compass: ["explorer", "builder"],
    hook: "Flick, push and throw with Newton",
    emoji: "🍎",
    added: "2026-09-29",
    category: "science",
    players: [1, 1],
    age: 8,
    blurb: "Isaac Newton found three rules that everything that moves follows. Flick a puck over ice, grass and sand. Push a cart with a teddy on it, then an elephant. Throw balls off a skateboard and roll the other way. Play with each law first, then beat the levels and take the quiz!",
    colors: ["#2b59c3", "#e0752b"],
    highlights: ["🥌 Flick, push & throw", "🎓 Quiz"]
  },
  {
    title: "Morse Agent",
    folder: "morse",
    compass: ["organiser", "explorer"],
    hook: "Tap secret messages like a spy",
    emoji: "📡",
    added: "2026-09-29",
    category: "coding",
    players: [1, 2],
    age: 8,
    blurb: "Learn Morse code by ear, like a real spy. Boot Camp teaches you dots and dashes, then every mission adds a new letter. Tap messages on a real telegraph key, or send a secret word to a friend and see if they can hear it!",
    colors: ["#16233a", "#c89b3c"],
    highlights: ["📡 Telegraph key", "🎚️ Difficulty lever"]
  },
  {
    title: "Enigma",
    folder: "enigma",
    compass: ["explorer", "organiser"],
    hook: "Scramble messages with a code machine",
    emoji: "🔐",
    added: "2026-09-29",
    category: "coding",
    players: [1, 2],
    age: 8,
    blurb: "Send secret messages with a copy of the famous Enigma code machine. Spin the three rings to pick a secret start, type your words, and watch the lamps light up your code. Give the code and the three start letters to a friend, and when they type it in, your message pops back out!",
    colors: ["#8a5a2b", "#2b2b2e"],
    highlights: ["🔑 Secret codes", "💡 Glowing lamps"]
  },
  {
    title: "Cube Timer",
    folder: "cube-timer",
    compass: ["builder", "organiser"],
    hook: "Time your Rubik's cube solves",
    emoji: "⏱️",
    added: "2026-08-18",
    category: "puzzle",
    players: [1, 2],
    age: 7,
    blurb: "Time yourself solving the cube. It gives you a mix-up to do first — with a picture of what the cube should look like when you've done it — then you hold the big button, let go, and solve. It keeps your best time, your last five, and everyone in the house has their own list. Two of you can race: same mix-up each round, take it in turns, first to two.",
    colors: ["#1f9d55", "#1878c4"],
    highlights: ["🧩 2×2, 3×3, 4×4", "🏁 Race a friend"]
  },
  {
    title: "Bank Boss",
    folder: "bank-boss",
    compass: ["organiser", "leader"],
    hook: "Run the bank: savers, loans and rates",
    tags: ["jobs"],
    emoji: "🏦",
    added: "2026-08-11",
    category: "maths",
    players: [1, 1],
    age: 8,
    blurb: "You're the bank. People leave their money with you, and other people come in wanting to borrow it. You pick what to pay savers and what to charge borrowers — and the gap between those two is everything you earn. Every rate shows what it costs or earns tonight in real money, so you can see the choice before you make it. The vault is on screen the whole time, split into whose money it is and where it's actually got to, so you can watch Nan's savings walk out of the door as somebody's new bike.",
    colors: ["#4a8fd4", "#2f9e5a"],
    highlights: ["🏦 How banks work", "📈 Interest rates"]
  },
  {
    title: "Deal or No Deal",
    folder: "deal-or-no-deal",
    compass: ["leader"],
    hook: "Keep your box or take the deal?",
    emoji: "💼",
    added: "2026-08-03",
    category: "board",
    players: [1, 3],
    age: 7,
    blurb: "Keep one sealed box back, then open the others one by one. Every few boxes the Banker rings up and offers to buy yours — take the money, or find out what's inside. 1–3 players, or beat a robot contestant.",
    colors: ["#c8a021", "#b8121f"],
    highlights: ["☎️ The Banker", "💰 Big money"]
  },
  {
    title: "Lemonade Stand",
    folder: "lemonade-stand",
    compass: ["leader", "organiser"],
    hook: "Run a lemonade stall for two weeks",
    tags: ["jobs"],
    emoji: "🍋",
    added: "2026-08-03",
    category: "maths",
    players: [1, 1],
    age: 8,
    blurb: "Run a lemonade stall for a fortnight. Each morning it asks you one thing at a time: what's the weather, how many cups, what will you charge. Count out people's change when they pay with a handful of coins. Watch your money grow in the bank every night. Some days go wrong, and the bike takes a really good fortnight.",
    colors: ["#ffd23d", "#2f9e5a"],
    highlights: ["🪙 Counting change", "🏦 Saving & borrowing"]
  },
  {
    title: "Battleship",
    folder: "battleship",
    compass: ["explorer", "leader"],
    hook: "Hunt down the hidden ships",
    emoji: "🚢",
    added: "2026-07-31",
    category: "board",
    players: [1, 2],
    age: 6,
    blurb: "Hide your ships in the sea, then call out squares until you've found all of theirs. Play a friend on one tablet — it clears the screen in between so nobody peeks — or take on a computer that works out where a ship could still be hiding. Two of you can also play a run each and watch the two battles race side by side at the end.",
    colors: ["#1f7ae0", "#12a3bd"],
    highlights: ["🙈 Hidden fleets", "🧠 Thinks ahead", "🎬 Side-by-side replay"]
  },
  {
    title: "Mastermind",
    folder: "mastermind",
    compass: ["explorer", "organiser"],
    hook: "Crack the secret colour code",
    emoji: "🎯",
    added: "2026-07-30",
    category: "puzzle",
    players: [1, 2],
    age: 6,
    blurb: "Somebody hides a row of colours. Work it out from the pegs — black for a colour in the right place, white for one in the wrong place. Crack the computer's code, or hide one and watch it think.",
    colors: ["#8b5ae8", "#c04bb0"],
    highlights: ["🕵️ Code breaking", "💡 Hints"]
  },
  {
    title: "Nine Men's Morris",
    folder: "nine-mens-morris",
    compass: ["leader", "explorer"],
    hook: "Line up three and take a piece",
    emoji: "⚫",
    added: "2026-07-30",
    category: "board",
    players: [1, 2],
    age: 7,
    blurb: "Also called Дама. Put your nine pieces out, line three of them up, and take one of theirs every time you do. Last one with three pieces loses.",
    colors: ["#d8a55f", "#8a5a1f"],
    highlights: ["🧠 Thinks ahead", "🎉 Lines of three"]
  },
  {
    title: "Connect Four",
    folder: "connect-four",
    compass: ["explorer"],
    hook: "Get four in a row before they do",
    emoji: "🔴",
    added: "2026-07-29",
    category: "board",
    players: [1, 2],
    blurb: "Drop your discs and line up four — across, up or slanting. Play a friend on one screen, or take on a computer that really does think ahead.",
    colors: ["#5b93ff", "#1f3fa8"],
    highlights: ["🧠 Thinks ahead", "💡 Hints"]
  },
  {
    title: "Yatzy Dice",
    folder: "yatzy-dice",
    compass: ["organiser"],
    hook: "Roll five dice and chase a Yatzy",
    emoji: "🎲",
    added: "2026-07-28",
    category: "board",
    players: [1, 3],
    blurb: "Roll five dice, chase full houses and straights. Play 1–3 players, take on the computer, or use it as a scorecard for your real dice.",
    colors: ["#f45b69", "#6c4cf0"],
    highlights: ["🎲 Dice", "📝 Scorecard mode"]
  },
  {
    title: "Footy Tactics Lab",
    folder: "footy-tactics-lab",
    compass: ["leader", "organiser"],
    hook: "Code your footy players' moves",
    emoji: "🥅",
    added: "2026-07-25",
    category: "coding",
    players: [1, 1],
    age: 8,
    blurb: "Learn to code with footy. Snap together move, turn and repeat blocks, then watch your play run one step at a time — and debug it when it goes wrong.",
    colors: ["#ffc23d", "#0e6b3a"],
    highlights: ["🔁 Loops", "🥅 Footy"]
  },
  {
    title: "Times Table Blaster",
    folder: "times-table-blaster",
    compass: ["organiser"],
    hook: "Blast through your times tables",
    emoji: "⭐",
    added: "2026-07-23",
    category: "maths",
    players: [1, 1],
    blurb: "Blast through your times tables! Earn ninja belts one table at a time, or take on Classic mode with timers and streaks.",
    colors: ["#ff4da6", "#ffe600"],
    highlights: ["🥷 Belts", "⏱️ Timed mode"]
  },
  {
    title: "Robo Rules",
    folder: "robo-rules",
    compass: ["builder", "organiser"],
    hook: "Teach a robot with if-then rules",
    emoji: "🤖",
    added: "2026-07-23",
    category: "coding",
    players: [1, 1],
    age: 7,
    blurb: "Teach Chip the robot pet using IF-THIS-THEN-THAT rules. A first, playful taste of coding.",
    colors: ["#4fc3f7", "#8a7bff"],
    highlights: ["🔀 If-then rules"]
  },
  {
    title: "AFL Goal Kick",
    folder: "afl-goal-kick",
    compass: ["builder"],
    hook: "Aim, run up and kick a goal",
    emoji: "🏉",
    added: "2026-07-23",
    category: "sport",
    players: [1, 2],
    blurb: "Aim the arrow, load the power bar, time your run-up and thread the big sticks. Wind, a man on the mark, and 3 difficulty levels.",
    colors: ["#3ddc68", "#2f9d4d"],
    highlights: ["💨 Wind", "🎚️ 3 levels"]
  }
];
