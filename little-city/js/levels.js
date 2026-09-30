/* Little City - chapters, levels, jobs and quiz. Data only.                   */
/*                                                                             */
/* A level is a list of rounds:                                                */
/*   build   a map to finish (see sim.js for the letters), the tools allowed, */
/*           which needs count, an optional budget, and rules with tips       */
/*   choose  pick an answer; options can be little maps                       */
"use strict";
window.LC = window.LC || {};

(function () {
  const ROADS = ["road", "bulldoze"];
  const NOISE = "Factories give people jobs, but they're noisy. Put them close enough to walk to work, not right next door.";

  LC.CHAPTERS = [
    {
      id: 1, kicker: "Chapter 1", name: "Homes & Roads", emoji: "🛣️", color: "#43a047",
      says: "Every house needs a road, and every road has to link up to the way out of town.",
      more: ["A road that doesn't join up is no use to anyone.", "More houses means more people in your town.", "Builders plan roads first, then houses."],
      grown: "Street networks come before buildings in real planning: services, water and power follow the roads. Connectivity is the first thing any town plan is checked for.",
      lesson: {
        title: "You built a town that works!",
        life: "Next time you're in the car, look at how every street joins another one. Somebody planned all of that!",
        job: "👷 Builders and construction workers build the roads, houses and bridges in every town."
      },
      levels: [
        {
          name: "Road to home", text: "Tap 🛣️ Road, then tap the grass (or drag your finger) to build a road to the house.",
          rounds: [
            { kind: "choose", q: "Why does every house need a road?", options: [{ e: "🚗", t: "So people can get to it and get out", ok: true }, { e: "🎨", t: "Roads look nice" }, { e: "🌧️", t: "To stop the rain" }], why: "Roads let people drive home, get to work and school, and let the rubbish truck and fire engine reach every house." },
            { kind: "build", map: ["......", "......", "E....H", "......", "......"], tools: ROADS, needs: ["road"], rules: [{ linked: true, tip: "Join the house to the road that leads out of town (the one on the left edge)." }] }
          ]
        },
        {
          name: "Room for 12", text: "Build houses so 12 people can live here. Each house fits 4 people.",
          rounds: [{ kind: "build", map: ["......", "......", "Errrr.", "......", "......", "......"], tools: ["house", "road", "bulldoze"], needs: ["road"], rules: [{ people: 12, tip: "You need homes for 12 people: that's 3 houses, each touching a road." }, { linked: true, tip: "Every house has to touch a road that leads out of town." }] }]
        },
        {
          name: "Around the lake", text: "Four families live around the lake. Build roads so they can all get home.",
          rounds: [{ kind: "build", map: [".......", ".H.~~..", "E..~~.H", "...~~..", ".H...H.", "......."], tools: ROADS, needs: ["road"], rules: [{ linked: true, tip: "Roads can't go on water. Find a way round the lake to every house." }] }]
        },
        {
          name: "Fix the town", text: "Someone built a factory in the middle of the road! Fix the town so every house can get out.",
          rounds: [{ kind: "build", map: ["..H.H..", "Errxrr.", ".......", ".H.rr..", "...r.H.", "......."], tools: ROADS, needs: ["road"], rules: [{ linked: true, tip: "Use 🧹 Bulldoze to clear the factory, then join up all the roads." }] }]
        }
      ]
    },
    {
      id: 2, kicker: "Chapter 2", name: "What People Need", emoji: "🏫", color: "#1e88e5",
      says: "People need more than a house: a school, a doctor, a job, and some peace and quiet!",
      more: ["Each building reaches the houses around it. Tap a building to see how far.", "Tap a house to hear what the family needs.", "Happy face = everything they need is close by."],
      grown: "Planners call these service catchments: how far people should have to travel to a school, a GP or a job. It's the same trade-off on a real council map.",
      lesson: {
        title: "You listened to the people!",
        life: "What's near your home? A school, a park, shops? Which one would you miss most?",
        job: "🗺️ Town planners decide where schools, parks, shops and homes go, so everyone has what they need nearby."
      },
      levels: [
        {
          name: "School's in", text: "Build one school close enough to every house. Tap a house to hear what they think!",
          rounds: [{ kind: "build", map: ["........", "..H..H..", "ERRRRRRR", "..H..H..", "........"], tools: ["school", "bulldoze"], limits: { school: 1 }, needs: ["road", "school"], rules: [{ covered: "school", tip: "Some families are too far from the school. Try it somewhere in the middle, next to the road." }, { happy: "all", tip: "Every house should have a happy face." }] }]
        },
        {
          name: "Doctor, doctor", text: "There's a school. Now everyone needs a clinic near them too.",
          rounds: [{ kind: "build", map: [".........", "..H.K.H..", "ERRRRRRRR", "..H...H..", "........."], tools: ["clinic", "bulldoze"], limits: { clinic: 1 }, needs: ["road", "school", "clinic"], rules: [{ covered: "clinic", tip: "Tap the clinic to see how far it reaches. Where would it reach all four houses?" }, { happy: "all", tip: "Every house should have a happy face." }] }]
        },
        {
          name: "Too noisy!", text: "These families need jobs. A factory gives jobs, but it's noisy.",
          rounds: [{ kind: "build", map: [".........", ".HH......", "ERRRRRRRR", ".HH......", "........."], tools: ["factory", "bulldoze"], limits: { factory: 1 }, needs: ["road", "noise", "job"], rules: [{ covered: "noise", tip: "The factory is right next to a house! Move it one square further away." }, { covered: "job", tip: "The factory is too far for people to get to work. Bring it closer." }] }]
        },
        {
          name: "Where should it go?", text: "Planners look at the map before they build. Which plan is best?",
          rounds: [
            {
              kind: "choose", q: "Which fire station can reach every house? 🚒 (It reaches 5 squares)", why: "The fire station in the middle is close to everyone. In a fire, every minute counts!",
              options: [
                { map: ["H.....H", "ERRRRRR", "F.....H"], t: "Plan A" },
                { map: ["H.....H", "ERRRRRR", "...F..H"], t: "Plan B", ok: true },
                { map: ["H.....H", "ERRRRRR", "......F"], t: "Plan C" }
              ]
            },
            {
              kind: "choose", q: "Which town will be quieter for the families? 🏭", why: NOISE,
              options: [
                { map: ["HXH....", "ERRRRRR", "HHH...."], t: "Plan A" },
                { map: ["HHH.X..", "ERRRRRR", "HHH...."], t: "Plan B", ok: true },
                { map: ["HHH....", "ERRRRRR", "HXH...."], t: "Plan C" }
              ]
            },
            { kind: "choose", q: "Why should a school be near the houses?", options: [{ e: "🚶", t: "So kids can walk or get there quickly", ok: true }, { e: "🔊", t: "So everyone can hear the bell" }, { e: "🤷", t: "It doesn't matter where it goes" }], why: "If a school is close, kids can walk or ride, and families don't spend hours in traffic." }
          ]
        }
      ]
    },
    {
      id: 3, kicker: "Chapter 3", name: "Running the Town", emoji: "💰", color: "#8e24aa",
      says: "A town costs money! Buildings cost coins to build, and schools and clinics cost money every year. Homes pay a little tax to help.",
      more: ["Budget: how many coins you can spend building.", "Each year: taxes come in, and running costs go out.", "A good mayor listens to everyone, then decides."],
      grown: "Councils balance capital spending (building things) with recurring costs (running them), funded by rates and taxes. Voting shows how a community decides together.",
      lesson: {
        title: "You're a great mayor!",
        life: "Your local council runs the parks, libraries and roads near you. Ask a grown-up who your mayor is!",
        job: "🏛️ Mayors and councillors listen to people in the town, plan how to spend the money, and decide what gets built."
      },
      levels: [
        {
          name: "The budget", text: "You have 60 coins. Build homes for 16 people, a school and a park, without running out!",
          rounds: [{ kind: "build", money: 60, map: [".........", ".........", "ERRRRRRRR", ".........", "........."], tools: ["house", "school", "park", "bulldoze"], needs: ["road", "school", "park"], rules: [{ budget: true, tip: "You spent more than 60 coins! Bulldoze something (you get the coins back) and plan again." }, { people: 16, tip: "You need homes for 16 people (4 houses)." }, { happy: "all", tip: "Tap the sad houses to hear what they need." }] }]
        },
        {
          name: "Pay for it", text: "Schools and clinics cost money every year. Make sure the town's taxes pay for them!",
          rounds: [{ kind: "build", money: 100, map: [".........", ".........", "ERRRRRRRR", ".........", "........."], tools: ["house", "flats", "school", "clinic", "bulldoze"], needs: ["road", "school", "clinic"], rules: [{ happy: "all", tip: "Every family needs a school and a clinic nearby. Add some homes!" }, { balance: true, tip: "The town spends more each year than it gets. More homes means more taxes!" }, { budget: true, tip: "You spent more than 100 coins." }] }]
        },
        {
          name: "Town vote", text: "The mayor has some big decisions. Read the letters, then decide.",
          rounds: [
            { kind: "choose", letters: ["🧒 Please build a playground!", "👵 A playground would be lovely.", "👨 My kids want a playground!", "🚗 We need a car park.", "👩 A playground, please!"], q: "What do most people want?", options: [{ e: "🛝", t: "A playground", ok: true }, { e: "🅿️", t: "A car park" }], why: "Four letters asked for a playground and one for a car park. In a vote, the most votes wins." },
            { kind: "choose", q: "The playground costs 30 coins, but the town only has 20. What's the best plan?", options: [{ e: "🐷", t: "Save up next year's taxes, then build it", ok: true }, { e: "🏫", t: "Close the school to pay for it" }, { e: "🙈", t: "Build it anyway and hope" }], why: "Good mayors don't spend money they haven't got. They plan ahead and save up." },
            { kind: "choose", q: "The car park family is sad they lost the vote. What should a good mayor do?", options: [{ e: "👂", t: "Listen, and look for another way to help them", ok: true }, { e: "🙉", t: "Ignore them" }, { e: "🔁", t: "Change the vote" }], why: "Everyone matters, even when they're outvoted. A good mayor listens and looks for a fair fix, like a few parking spaces on the street." }
          ]
        },
        {
          name: "Grow to 30", text: "Your biggest job! Build a town where 30 people live happily, and don't go broke.",
          rounds: [{ kind: "build", money: 150, map: ["..........", "..........", "..........", "E.........", "..........", "..........", ".........."], tools: ["road", "house", "flats", "school", "clinic", "fire", "shop", "bulldoze"], needs: ["road", "school", "clinic", "fire", "shop"], rules: [{ linked: true, tip: "Some buildings aren't joined to a road." }, { people: 30, tip: "Homes for 30 people! Flats fit 10, houses fit 4." }, { happy: "all", tip: "Tap the sad houses to hear what they need." }, { budget: true, tip: "You spent more than 150 coins. Bulldoze to get coins back." }, { balance: true, tip: "The town spends more each year than it gets in taxes and shop money." }] }]
        }
      ]
    }
  ];

  LC.JOBS = [
    { emoji: "🗺️", name: "Town planner", does: "Decides where homes, schools, parks and roads go, so the town works for everyone." },
    { emoji: "🏛️", name: "Mayor", does: "Leads the town: listens to people, plans the money and decides what gets built." },
    { emoji: "📐", name: "Architect", does: "Designs buildings: houses, schools, hospitals and skyscrapers." }
  ];

  LC.QUIZ = [
    [
      { emoji: "🛣️", q: "What does every house need first?", a: ["A road to it", "A swimming pool", "A tall fence"], right: 0, why: "Without a road, nobody can get there: not the family, the ambulance or the rubbish truck." },
      { emoji: "🏠", q: "A house fits 4 people. How many houses for 12 people?", a: ["3", "4", "12"], right: 0, why: "4 + 4 + 4 = 12, so 3 houses." }
    ],
    [
      { emoji: "🏭", q: "Where should a factory go?", a: ["Near homes, but not right next door", "Right next to every house", "Very far away from everyone"], right: 0, why: "Close enough to walk to work, far enough that the noise doesn't bother anyone." },
      { emoji: "🗺️", q: "What does a town planner do?", a: ["Decides where buildings go", "Drives the bus", "Bakes bread"], right: 0, why: "Town planners plan where homes, schools, parks and roads go." }
    ],
    [
      { emoji: "💰", q: "Where does a town get money to run its schools?", a: ["Taxes from the people who live there", "A money tree", "Nowhere, they're free"], right: 0, why: "Everyone pays a little tax, and together it pays for schools, clinics and parks." },
      { emoji: "🗳️", q: "In a vote, what usually wins?", a: ["The choice with the most votes", "The loudest person", "The mayor's favourite"], right: 0, why: "Each person gets one vote, and the choice with the most votes wins." }
    ]
  ];
})();
