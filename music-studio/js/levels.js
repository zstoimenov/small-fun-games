/* Music Studio - the grid rows, chapters, levels, jobs and quiz. Data only.   */
/*                                                                             */
/* A song is { bpm, mood, inst, len, cells: { rowId: [0|1 x len] } }. Levels   */
/* write patterns as strings, "x" for a sound and "." for a rest, and make()   */
/* turns them into a song. A level is a list of rounds:                        */
/*   tap     tap along to a steady beat                                        */
/*   choose  listen (to a clip or a sequence), then pick an answer             */
/*   build   make it on the grid: match a target, or follow some rules         */
"use strict";
window.MS = window.MS || {};

// Top to bottom as they appear on the grid: high notes up top, drums below.
// Note colours follow the rainbow, low red to high purple, like kids' bells.
MS.ROWS = [
  { id: "hi", name: "Do", long: "High Do", emoji: "🟣", color: "#8e44ad", note: true },
  { id: "la", name: "La", emoji: "🔵", color: "#2f6fd6", note: true },
  { id: "so", name: "So", emoji: "🟢", color: "#22a05a", note: true },
  { id: "mi", name: "Mi", emoji: "🟡", color: "#e0b100", note: true },
  { id: "re", name: "Re", emoji: "🟠", color: "#ee7a1a", note: true },
  { id: "do", name: "Do", long: "Low Do", emoji: "🔴", color: "#d63b3b", note: true },
  { id: "hat", name: "Tss", emoji: "✨", color: "#7a8699" },
  { id: "clap", name: "Clap", emoji: "👏", color: "#c0399b" },
  { id: "snare", name: "Tak", emoji: "🥁", color: "#b86b2d" },
  { id: "kick", name: "Boom", emoji: "💥", color: "#3b4a63" }
];
MS.NOTE_ROWS = MS.ROWS.filter((r) => r.note).map((r) => r.id);
MS.DRUM_ROWS = MS.ROWS.filter((r) => !r.note).map((r) => r.id);
MS.INSTRUMENTS = [{ id: "keys", name: "Keys", emoji: "🎹" }, { id: "bells", name: "Bells", emoji: "🔔" }, { id: "synth", name: "Robot", emoji: "🤖" }];
MS.MOODS = [{ id: "happy", name: "Happy", emoji: "🌞" }, { id: "sad", name: "Sad", emoji: "🌧️" }];
MS.TEMPO = { min: 60, max: 170, slow: 85, fast: 135 };

MS.make = function (spec) {
  const len = spec.len || 8;
  const cells = {};
  MS.ROWS.forEach((r) => {
    const s = spec[r.id] || "";
    cells[r.id] = Array.from({ length: len }, (_, i) => (s[i] === "x" ? 1 : 0));
  });
  return { bpm: spec.bpm || 100, mood: spec.mood || "happy", inst: spec.inst || "keys", len, cells };
};

const DRUMS = ["kick", "snare", "hat", "clap"];
const BASIC = { kick: "x...x...", snare: "..x...x.", hat: "x.x.x.x." };
const SLOW_OR_FAST = [["slow", 62], ["fast", 160], ["fast", 150], ["slow", 70]];
const ABOUT_TEMPO = "Slow music has lots of time between the beats. Fast music packs them close together.";
const HIGHER_LOWER = "High notes sound small and bright, like a bird. Low notes sound big and deep, like a bear.";

MS.CHAPTERS = [
  {
    id: 1, kicker: "Chapter 1", name: "Feel the Beat", emoji: "🥁", color: "#e07a1f",
    says: "Music has a heartbeat called the beat. It keeps going, steady, like a clock.",
    more: ["The big dots on the grid are the beats.", "Fast beats feel exciting. Slow beats feel calm.", "Drummers keep the whole band together."],
    grown: "Tempo is counted in beats per minute (BPM). A resting heart is about 70 BPM; most pop songs sit between 90 and 130. Each grid step is half a beat, so 8 steps is one bar of 4/4.",
    lesson: {
      title: "You found the beat!",
      life: "Your heart has a beat. So do walking, skipping, clapping games and dancing.",
      job: "🥁 Drummers keep the band in time. Some play in bands, some in orchestras, and some play on recordings in studios."
    },
    levels: [
      { name: "Tap the beat", text: "Listen to the drum, then tap the big button on every boom.", rounds: [{ kind: "tap", bpm: 84, need: 8 }] },
      {
        name: "Fast or slow?", text: "Listen to each beat. Is it slow like a snail, or fast like a rocket?",
        rounds: SLOW_OR_FAST.map(([ans, bpm]) => ({
          kind: "choose", q: "Is this beat slow or fast?", clip: Object.assign({ bpm }, BASIC), times: 2,
          options: [{ e: "🐌", t: "Slow", ok: ans === "slow" }, { e: "🚀", t: "Fast", ok: ans === "fast" }], why: ABOUT_TEMPO
        }))
      },
      {
        name: "Copy the rhythm", text: "Tap 👂 to hear a rhythm. Make it the same on your grid, then press Check.",
        rounds: [
          { kind: "build", rows: DRUMS, hear: true, target: { bpm: 96, kick: "x...x..." } },
          { kind: "build", rows: DRUMS, hear: true, target: { bpm: 96, kick: "x...x...", clap: "..x...x." } },
          { kind: "build", rows: DRUMS, hear: true, target: { bpm: 96, kick: "x..xx...", snare: "..x...x." } }
        ]
      },
      {
        name: "Sleepy or speedy", text: "Make a beat that fits. Drag the slider to change how fast it goes.",
        rounds: [
          {
            kind: "build", rows: DRUMS, tempo: true, start: { bpm: 110 },
            q: "Make a sleepy beat for a bedtime song 😴", rules: [
              { bpmMax: MS.TEMPO.slow, tip: "Slow it down! Slide towards the snail 🐌." },
              { row: "kick", min: 2, tip: "Put at least 2 Booms 💥 in." }
            ]
          },
          {
            kind: "build", rows: DRUMS, tempo: true, start: { bpm: 110 },
            q: "Now a race beat for a go-kart race 🏎️", rules: [
              { bpmMin: MS.TEMPO.fast, tip: "Speed it up! Slide towards the rocket 🚀." },
              { row: "hat", min: 4, tip: "Races are busy! Add at least 4 Tss ✨." }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 2, kicker: "Chapter 2", name: "Patterns", emoji: "🔁", color: "#1f7ae0",
    says: "Music is full of patterns that repeat. Your brain loves guessing what comes next!",
    more: ["A pattern that repeats over and over is called a loop.", "Songs repeat their chorus so everyone can sing along.", "Spotting the one thing that's different is a big music skill."],
    grown: "Most songs are built from 4- and 8-bar phrases in shapes like AABA or verse-chorus. Producers build tracks by stacking loops in layers: drums, then bass, then melody.",
    lesson: {
      title: "You're a pattern detective!",
      life: "Patterns are everywhere: in songs, in times tables, in the days of the week, even in wallpaper.",
      job: "🎛️ Music producers build songs out of loops and layers on a computer, and help singers and bands sound their best."
    },
    levels: [
      {
        name: "What comes next?", text: "Listen to the pattern. What sound comes next?",
        rounds: [
          { kind: "choose", q: "What comes next?", seq: ["kick", "clap", "kick", "clap", "kick"], answer: "clap" },
          { kind: "choose", q: "What comes next?", seq: ["kick", "kick", "clap", "kick", "kick", "clap", "kick", "kick"], answer: "clap" },
          { kind: "choose", q: "What comes next?", seq: ["hat", "hat", "kick", "hat", "hat", "kick", "hat"], answer: "hat" },
          { kind: "choose", q: "What comes next?", seq: ["do", "hi", "do", "hi", "do"], answer: "hi" }
        ].map((r) => Object.assign(r, { why: "The pattern keeps repeating, so you can guess what comes next." }))
      },
      {
        name: "Finish the loop", text: "The pattern repeats. Fill in the last two steps so it keeps going.",
        rounds: [
          { kind: "build", rows: DRUMS, lock: 6, target: { bpm: 100, kick: "x.x.x.x." } },
          { kind: "build", rows: DRUMS, lock: 6, target: { bpm: 100, kick: "x...x...", clap: "..x...x." } },
          { kind: "build", rows: DRUMS, lock: 6, target: { bpm: 100, kick: "x..x..x.", hat: ".xx.xx.x" } }
        ]
      },
      {
        name: "Spot the mistake", text: "Each loop should repeat the same way all along, but one sound is wrong. Fix it!",
        rounds: [
          { kind: "build", rows: DRUMS, target: { bpm: 100, kick: "x.x.x.x." }, start: { bpm: 100, kick: "x.x.x.xx" } },
          { kind: "build", rows: DRUMS, target: { bpm: 100, kick: "x...x...", snare: "..x...x." }, start: { bpm: 100, kick: "x...x...", snare: "..x..x.." } },
          { kind: "build", rows: ["hi", "la", "so", "mi", "re", "do"], target: { bpm: 100, do: "x...x...", so: "..x...x." }, start: { bpm: 100, do: "x...x...", so: "..x.....", la: "......x." } }
        ]
      },
      {
        name: "Layer it up", text: "Producers build a song in layers. Add one layer at a time.",
        rounds: [
          {
            kind: "build", rows: DRUMS, start: { bpm: 104 },
            q: "Layer 1: drums", rules: [
              { row: "kick", on: [0, 4], tip: "Put a Boom 💥 on beats 1 and 3 (the first big dot, and the third)." },
              { row: "snare", on: [2, 6], tip: "Put a Tak 🥁 on beats 2 and 4 (the second big dot, and the fourth)." },
              { row: "hat", min: 6, tip: "Add Tss ✨ on at least 6 steps." }
            ]
          },
          {
            kind: "build", rows: MS.ROWS.map((r) => r.id), carry: true,
            q: "Layer 2: a tune on top", rules: [
              { notes: 3, tip: "Add at least 3 notes in the coloured rows." },
              { row: "kick", min: 2, tip: "Keep your drums in!" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 3, kicker: "Chapter 3", name: "Melody & Mood", emoji: "🎬", color: "#c0399b",
    says: "A melody is a tune you can hum. It goes up and down, and it can make you feel happy or sad.",
    more: ["High notes sound small and bright. Low notes sound big and deep.", "The 🌞 happy and 🌧️ sad buttons swap the notes for a brighter or a darker set.", "Film composers write music that tells you how to feel."],
    grown: "Swapping the major pentatonic for the minor one keeps the rhythm and flips the mood; tempo and register do the rest. That's most of film scoring in one sentence.",
    lesson: {
      title: "You made music with feelings!",
      life: "Next time you watch a film or a cartoon, listen: is the music scary, sad, exciting or happy? Try it with the sound off. It's not the same!",
      job: "🎬 Film composers write the music for movies, TV and games. They watch the scene first, then write music to fit how it should feel."
    },
    levels: [
      {
        name: "High or low?", text: "Listen to two notes. Is the second one higher or lower?",
        rounds: [["do", "hi", 1], ["la", "re", 0], ["mi", "so", 1], ["hi", "mi", 0]].map(([a, b, up]) => ({
          kind: "choose", q: "Was the second note higher or lower?", seq: [a, b], bpm: 60, hide: true,
          options: [{ e: "⬆️", t: "Higher", ok: !!up }, { e: "⬇️", t: "Lower", ok: !up }], why: HIGHER_LOWER
        }))
      },
      {
        name: "Which way?", text: "Listen to the tune. Which way does it go?",
        rounds: [["do mi so hi", "up"], ["hi la so mi", "down"], ["do mi la mi do", "hill"], ["hi so re so hi", "valley"]].map(([tune, ans]) => ({
          kind: "choose", q: "Which way does the tune go?", seq: tune.split(" "), bpm: 90, hide: true,
          options: [
            { e: "↗️", t: "Up the stairs", ok: ans === "up" }, { e: "↘️", t: "Down the stairs", ok: ans === "down" },
            { e: "⛰️", t: "Up, then down", ok: ans === "hill" }, { e: "🥣", t: "Down, then up", ok: ans === "valley" }
          ], why: "A tune's shape is part of how it feels. Going up sounds like a question or getting excited; going down sounds like settling."
        }))
      },
      {
        name: "Copy the tune", text: "Tap 👂 to hear a tune. Make it the same with the coloured notes.",
        rounds: [
          { kind: "build", rows: MS.NOTE_ROWS, hear: true, target: { bpm: 100, do: "x.......", mi: "..x.....", so: "....x...", hi: "......x." } },
          { kind: "build", rows: MS.NOTE_ROWS, hear: true, target: { bpm: 100, so: "x...x...", mi: "..x...x." } },
          { kind: "build", rows: MS.NOTE_ROWS, hear: true, target: { bpm: 110, do: "xx......", so: "..xx..x.", la: "....xx.." } }
        ]
      },
      {
        name: "Movie music", text: "Be a film composer. Which music fits the scene?",
        rounds: [
          {
            kind: "choose", q: "Which scene does this music fit?", clip: { bpm: 150, mood: "happy", inst: "bells", do: "x.......", mi: "..x.....", so: "....x...", hi: "......x.", kick: "x...x...", clap: "..x...x." }, times: 2,
            options: [{ e: "🎂", t: "A birthday party", ok: true }, { e: "🌧️", t: "Lost in the rain", ok: false }], why: "Fast, bright, bouncy music feels like a party."
          },
          {
            kind: "choose", q: "Which scene does this music fit?", clip: { bpm: 66, mood: "sad", inst: "keys", hi: "x.......", la: "..x.....", mi: "....x...", do: "......x." }, times: 2,
            options: [{ e: "🎢", t: "A roller coaster", ok: false }, { e: "🐶", t: "A puppy is lost", ok: true }], why: "Slow music on the darker notes, going down, feels sad."
          },
          {
            kind: "build", rows: MS.ROWS.map((r) => r.id), tempo: true, mood: true, start: { bpm: 120, mood: "happy" },
            q: "Write music for the lost puppy 🐶", rules: [
              { mood: "sad", tip: "Tap 🌧️ Sad for the darker notes." },
              { bpmMax: 95, tip: "Sad music is slow. Slide towards the snail 🐌." },
              { notes: 4, tip: "Add at least 4 notes in the coloured rows." }
            ]
          }
        ]
      }
    ]
  }
];

MS.JOBS = [
  { emoji: "🎸", name: "Musician", does: "Plays an instrument or sings, in a band, an orchestra or on stage." },
  { emoji: "🎼", name: "Composer", does: "Writes new music: songs, symphonies, cartoon tunes and ads." },
  { emoji: "🎧", name: "Sound designer", does: "Makes the sounds in films and games: footsteps, lasers, dragons roaring." }
];

// One question from each pool, so every quiz is a little different.
MS.QUIZ = [
  [
    { emoji: "🐌", q: "What does 'tempo' mean?", a: ["How fast the music goes", "How loud it is", "How high the notes are"], right: 0, why: "Tempo is the speed of the beat. Slow tempo, calm music; fast tempo, exciting music." },
    { emoji: "😴", q: "A lullaby usually has a...", a: ["Slow beat", "Fast beat", "Very loud beat"], right: 0, why: "Slow, gentle beats help you relax, like a slow heartbeat." }
  ],
  [
    { emoji: "🔁", q: "The part of a song that repeats and everyone sings along to is the...", a: ["Chorus", "Intro", "Ending"], right: 0, why: "The chorus comes back again and again, so it's the part everyone knows." },
    { emoji: "🧩", q: "Boom, clap, boom, clap, boom... what comes next?", a: ["Clap", "Boom", "Tss"], right: 0, why: "The pattern goes boom, clap, over and over." }
  ],
  [
    { emoji: "🐦", q: "Which makes a higher sound?", a: ["A tiny bird", "A big bear", "A bass drum"], right: 0, why: "Small things usually make higher sounds; big things make lower ones." },
    { emoji: "🎬", q: "Who writes the music for movies?", a: ["A film composer", "A camera operator", "A stunt person"], right: 0, why: "Film composers watch the scene, then write music to fit how it should feel." }
  ]
];
