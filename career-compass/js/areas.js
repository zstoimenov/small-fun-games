/* Career Compass - the six work styles, their jobs, and the quiz.              */
/*                                                                             */
/* The six are Holland's interest types (RIASEC), the model careers advisers   */
/* use, reworded for an 8-year-old: Realistic = Builders, Investigative =      */
/* Explorers, Artistic = Creators, Social = Helpers, Enterprising = Leaders,   */
/* Conventional = Organisers. The order is Holland's hexagon, so neighbours on */
/* the compass are the styles that most often go together.                    */
"use strict";
window.CC = window.CC || {};

CC.AREAS = [
  {
    id: "builder", name: "Builders", emoji: "🔧", color: "#e07a1f",
    says: "You like making, fixing and using your hands.",
    jobs: [
      { emoji: "🪚", name: "Carpenter", text: "Builds houses, decks and furniture out of wood." },
      { emoji: "💡", name: "Electrician", text: "Puts in the wires that bring power to lights and plugs, safely." },
      { emoji: "🛠️", name: "Mechanic", text: "Finds out why a car won't go, and fixes it." }
    ]
  },
  {
    id: "explorer", name: "Explorers", emoji: "🔬", color: "#1f7ae0",
    says: "You like asking why and finding out how things work.",
    jobs: [
      { emoji: "🧪", name: "Scientist", text: "Does experiments to discover things nobody knew before." },
      { emoji: "🩺", name: "Doctor", text: "Works out what's making someone sick, and how to make them better." },
      { emoji: "🐠", name: "Marine biologist", text: "Studies the animals and plants that live in the sea." }
    ]
  },
  {
    id: "creator", name: "Creators", emoji: "🎨", color: "#c0399b",
    says: "You like making up new things: pictures, stories, songs.",
    jobs: [
      { emoji: "✏️", name: "Illustrator", text: "Draws the pictures in books, comics and games." },
      { emoji: "🎸", name: "Musician", text: "Writes and plays music for people to enjoy." },
      { emoji: "🎮", name: "Game designer", text: "Dreams up new games and the rules that make them fun." }
    ]
  },
  {
    id: "helper", name: "Helpers", emoji: "🤝", color: "#2a9d8f",
    says: "You like looking after people and animals.",
    jobs: [
      { emoji: "🍎", name: "Teacher", text: "Helps kids learn new things every day." },
      { emoji: "💉", name: "Nurse", text: "Looks after sick people and helps them get well." },
      { emoji: "🐨", name: "Vet", text: "Keeps pets, farm animals and wildlife healthy." }
    ]
  },
  {
    id: "leader", name: "Leaders", emoji: "💼", color: "#d63b3b",
    says: "You like having ideas, making plans and getting people going.",
    jobs: [
      { emoji: "🏪", name: "Shop owner", text: "Runs their own business and decides what to sell." },
      { emoji: "📣", name: "Coach", text: "Plans the game and helps a team play its best." },
      { emoji: "🏛️", name: "Mayor", text: "Leads a town and makes plans to make it better." }
    ]
  },
  {
    id: "organiser", name: "Organisers", emoji: "🗂️", color: "#6a4c93",
    says: "You like numbers, lists, patterns and getting things just right.",
    jobs: [
      { emoji: "🧮", name: "Accountant", text: "Keeps track of money so a business knows where it stands." },
      { emoji: "📚", name: "Librarian", text: "Sorts thousands of books so anyone can find the one they need." },
      { emoji: "🛫", name: "Air traffic controller", text: "Keeps every plane in the sky in the right place." }
    ]
  }
];

// Would you rather...? Each question pits two styles against each other, and
// every style turns up exactly four times, so no style gets a head start.
CC.QUIZ = [
  [{ a: "builder", e: "🚲", t: "Fix a wobbly bike" }, { a: "creator", e: "🖍️", t: "Draw a comic" }],
  [{ a: "explorer", e: "🐞", t: "Look at bugs with a magnifying glass" }, { a: "helper", e: "🩹", t: "Help a friend who fell over" }],
  [{ a: "leader", e: "🧢", t: "Be captain of the team" }, { a: "organiser", e: "📋", t: "Keep the score" }],
  [{ a: "builder", e: "🏠", t: "Build a cubby house" }, { a: "helper", e: "🐶", t: "Look after a new puppy" }],
  [{ a: "explorer", e: "🌈", t: "Find out why the sky is blue" }, { a: "leader", e: "🍋", t: "Run a lemonade stand" }],
  [{ a: "creator", e: "🎵", t: "Make up a song" }, { a: "organiser", e: "🧱", t: "Sort your Lego by colour" }],
  [{ a: "builder", e: "📻", t: "Take apart an old radio" }, { a: "leader", e: "🗺️", t: "Lead your friends on a treasure hunt" }],
  [{ a: "explorer", e: "⚗️", t: "Do a science experiment" }, { a: "organiser", e: "✅", t: "Make a list and tick it all off" }],
  [{ a: "creator", e: "🎭", t: "Put on a play" }, { a: "helper", e: "📖", t: "Teach a little kid to read" }],
  [{ a: "builder", e: "🥕", t: "Plant a vegie garden" }, { a: "organiser", e: "🐷", t: "Count the money in your piggy bank" }],
  [{ a: "explorer", e: "🚀", t: "Visit a space museum" }, { a: "creator", e: "🖼️", t: "Visit an art gallery" }],
  [{ a: "helper", e: "🤗", t: "Cheer up a sad friend" }, { a: "leader", e: "🎤", t: "Give a talk to the class" }]
];
