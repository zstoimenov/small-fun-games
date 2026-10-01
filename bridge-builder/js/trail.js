/* Bridge Builder - the Bridge Trail: six worlds of harder puzzles, each with  */
/* a new rule, starting where Chapter 3 ends. Same level format as levels.js  */
/* plus the Trail fields documented in physics.js (pins, towers, lane, snow, */
/* convoy, budget...). Every level's par comes from a real design that       */
/* tools/bridge-check.js drives across; most were found by its search.       */
/* Generated from the level lab, then hand-tuned: edit freely, then run      */
/*   node tools/bridge-check.js                                               */
"use strict";
window.BB = window.BB || {};

BB.TRAIL = [
  {
    id: "t1", trail: true, kicker: "World 1", name: "Farm Creek", emoji: "\u{1F404}", color: "#4f9a2e", theme: "farm",
    rule: "Every piece costs coins",
    says: "Every piece costs coins. Smart engineers build bridges that are strong enough without wasting money.",
    more: [
      "Road costs 2 \u{1FA99}, wood 1 \u{1FA99}, steel 3 \u{1FA99}.",
      "Steel is strong but pricey. Use it only where it's needed.",
      "Spend fewer coins for more stars."
    ],
    grown: "Engineers balance strength against cost: the best design carries the load with the least material, and money saved on one bridge pays for the next.",
    levels: [
      { name: "Market day", gap: 4, rows: [-1, 1], truck: "bus", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 20, par: 16,
        text: "The bus is off to market. Every piece costs coins: spend as few as you can!",
        win: "A strong bridge that didn't cost the farm too much. That's good engineering!" },
      { name: "Heavy tractor", gap: 4, rows: [-1, 1], truck: "big", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 23, par: 18,
        text: "The big tractor is really heavy. Steel costs 3 coins, wood just 1. Where is steel worth it?",
        win: "Steel only where the force is biggest, cheap wood everywhere else." },
      { name: "Rock in the creek", gap: 6, rows: [-1, 2], rocks: [[3, 2]], truck: "truck", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 23, par: 18,
        text: "There's a rock in the creek. A pillar on it might save you lots of coins!",
        win: "The rock did the heavy lifting for free." },
      { name: "Wide creek", gap: 6, rows: [-1, 1], truck: "bus", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 31, par: 25,
        text: "A wide creek and a full bus. Test cheap ideas first, then add strength where it breaks.",
        win: "A long bridge for a heavy bus, on a farmer's budget!" },
      { name: "Harvest home", gap: 7, rows: [-2, 1], truck: "big", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 53, par: 42,
        text: "The harvest is in! Get the big truck home over the widest creek yet, without going broke.",
        win: "The harvest got home, and you still have coins left over. Brilliant engineering!" }
    ],
    lesson: {
      title: "You finished Farm Creek!",
      life: "Real bridges have a budget too. They're paid for with everyone's taxes, so engineers try not to waste any.",
      job: "\u{1F4B0} Quantity surveyors work out how much a bridge will cost, piece by piece."
    }
  },
  {
    id: "t2", trail: true, kicker: "World 2", name: "Desert Canyon", emoji: "\u{1F335}", color: "#c96f1e", theme: "desert",
    rule: "Pins only where the rock is solid",
    says: "Canyon rock is crumbly. You can only fix your bridge to the cliff at the pins \u{25B2}, where the rock is solid.",
    more: [
      "The pins \u{25B2} show where the rock is strong.",
      "Some dots are missing. Build around the gaps.",
      "A long prop from a deep pin can hold up the middle."
    ],
    grown: "Engineers test the ground before they build. Supports go where the rock can take the force, and the structure is shaped to bring its loads to those points.",
    levels: [
      { name: "Canyon walls", gap: 4, rows: [-1, 3], pins: ["0,2", "4,2"], truck: "truck", parts: [],
        inv: { road: 4, beam: 5, steel: 2 }, par: 7,
        text: "The canyon rock crumbles. You can only fix beams to the cliff at the pins \u{25B2}.",
        win: "Long props from the deep pins hold up the road." },
      { name: "One good wall", gap: 5, rows: [-1, 2], pins: ["0,2"], truck: "truck", parts: [],
        inv: { road: 5, beam: 11, steel: 2 }, par: 14,
        text: "Only the left cliff has a deep pin. Can one side do most of the work?",
        win: "Everything leaned on the one good wall, and it held!" },
      { name: "Missing dots", gap: 6, rows: [-2, 1], holes: ["2,-1", "4,-1", "3,1"], truck: "truck", parts: [],
        inv: { road: 6, beam: 13, steel: 2 }, par: 18,
        text: "Some dots have fallen away. Build around the gaps!",
        win: "You found a shape that works with the dots you've got." },
      { name: "Cactus gap", gap: 6, rows: [-1, 3], pins: ["0,3", "6,3"], truck: "bus", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 44, par: 35,
        text: "A deep canyon and a heavy bus. The pins are right at the bottom. Mind your coins!",
        win: "Tall props all the way from the canyon floor. That's a lot of bridge for the price!" },
      { name: "Deep canyon", gap: 7, rows: [-2, 3], pins: ["0,3", "7,2"], holes: ["3,-1", "4,1"], truck: "big", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 58, par: 46,
        text: "The deepest canyon of all, the big truck, missing dots and a budget. Good luck, engineer!",
        win: "You beat the Deep Canyon! Only a real engineer could build that." }
    ],
    lesson: {
      title: "You finished Desert Canyon!",
      life: "At the Grand Canyon there's a glass walkway bolted into solid rock, high above the river.",
      job: "\u{1FAA8} Geologists study rocks to find where the ground is strong enough to build on."
    }
  },
  {
    id: "t3", trail: true, kicker: "World 3", name: "Big River", emoji: "\u{26F5}", color: "#2275c4", theme: "river",
    rule: "Keep the boat lane clear",
    says: "Boats sail under your bridge. In the striped boat lane, nothing can go below the road.",
    more: [
      "The striped lane must stay empty under the road.",
      "Build above the road there, or reach across from the sides.",
      "Rocks outside the lane still make great pillars."
    ],
    grown: "River bridges must leave clearance for shipping. With no supports allowed in the channel, the span gets longer, so the truss above the deck has to work harder.",
    levels: [
      { name: "Boat lane", gap: 6, rows: [-1, 2], lane: [2, 4], truck: "truck", parts: [],
        inv: { road: 6, beam: 7, steel: 4 }, par: 14,
        text: "Boats sail through the striped lane. Nothing can go below the road there!",
        win: "The boats sail under, and the truck drives over." },
      { name: "Tall ship", gap: 6, rows: [-2, 1], lane: [1, 5], truck: "truck", parts: [],
        inv: { road: 6, beam: 11, steel: 2 }, par: 16,
        text: "A tall ship needs a wide lane. You'll have to build up, not down.",
        win: "A truss above the road holds it up, so the ship has all the room it needs." },
      { name: "Rocks and boats", gap: 8, rows: [-1, 2], rocks: [[2, 2], [6, 2]], lane: [3, 5], truck: "bus", parts: [],
        inv: { road: 8, beam: 14, steel: 3 }, par: 22,
        text: "Two rocks, one boat lane and a bus. Use the rocks, but keep the lane clear.",
        win: "Pillars on the rocks, and a clear lane in the middle. Just like a real river bridge!" },
      { name: "Ferry port", gap: 7, rows: [-2, 1], lane: [2, 5], truck: "truck", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 36, par: 29,
        text: "The ferry needs a wide lane. Build above the road, and watch your coins.",
        win: "The ferry fits, and the bridge didn't cost a fortune." },
      { name: "The big river", gap: 8, rows: [-2, 1], lane: [2, 6], truck: "big", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 63, par: 50,
        text: "The widest river and the heaviest truck, with a huge boat lane. Can you span it on a budget?",
        win: "You crossed the Big River! Ships under, trucks over." }
    ],
    lesson: {
      title: "You finished Big River!",
      life: "Tower Bridge in London lifts its road up in the middle so tall ships can sail through.",
      job: "\u{2693} Harbour masters decide how much room the boats need."
    }
  },
  {
    id: "t4", trail: true, kicker: "World 4", name: "Snowy Peaks", emoji: "\u{1F3D4}\u{FE0F}", color: "#4a82b8", theme: "snow",
    rule: "Snow is heavy, old wood is weak",
    says: "Snow piles up on the road and makes it heavier. And old wood breaks much more easily than new wood.",
    more: [
      "Snow adds weight to every piece of road.",
      "Old wood is free, but it snaps at less than half the load.",
      "Give old wood the easy jobs and new wood the hard ones."
    ],
    grown: "Bridges are designed for dead load (their own weight, plus snow) and live load (the traffic). Old, weakened timber has to be checked and given lighter work.",
    levels: [
      { name: "First snow", gap: 5, rows: [-1, 1], snow: 0.6, truck: "truck", parts: [],
        inv: { road: 5, beam: 15 }, par: 18, fail: "The snow made the road too heavy. Hold it up in more places.",
        text: "Snow is piling up on the road. It's heavier than it looks!",
        win: "Strong enough for the truck AND the snow." },
      { name: "Old wood", gap: 4, rows: [-1, 1], truck: "bus", parts: [],
        inv: { road: 4, old: 13, beam: 3 }, par: 17,
        text: "Most of your wood is old and weak, and the bus is heavy. Save the new wood for the hardest jobs.",
        win: "Old wood for the easy jobs, new wood for the hard ones. Clever!" },
      { name: "Snowy cliffs", gap: 5, rows: [-1, 2], pins: ["0,2", "5,2"], snow: 0.4, truck: "truck", parts: [],
        inv: { road: 5, old: 10, beam: 8 }, par: 17,
        text: "Snowy cliffs with only two pins, and the old wood is weak. Where does each piece go?",
        win: "Every piece doing the job it's strong enough for." },
      { name: "Blizzard", gap: 6, rows: [-2, 1], snow: 1.2, truck: "bus", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 54, par: 43, fail: "All that snow is heavy. Hold up every bit of road.",
        text: "A blizzard! Deep snow on the road and a full bus. Strong but cheap, please.",
        win: "Your bridge laughs at blizzards!" },
      { name: "Mountain pass", gap: 7, rows: [-2, 2], rocks: [[4, 2]], snow: 0.8, truck: "big", parts: [],
        inv: { road: 7, old: 10, beam: 9, steel: 7 }, par: 28,
        text: "The mountain pass: snow, old wood, a rock and the big truck. Use everything you know.",
        win: "You conquered the Mountain Pass!" }
    ],
    lesson: {
      title: "You finished Snowy Peaks!",
      life: "In snowy countries, roofs and bridges are built to carry metres of snow all winter.",
      job: "\u{1F50D} Bridge inspectors check old bridges for rot and rust, and say which parts need fixing."
    }
  },
  {
    id: "t5", trail: true, kicker: "World 5", name: "Jungle Gorge", emoji: "\u{1F334}", color: "#23894a", theme: "jungle",
    rule: "Ropes can only pull",
    says: "A rope is strong when you pull it, but floppy when you push it. Hang your road from the stone towers!",
    more: [
      "A rope can reach up to 4 dots away.",
      "Ropes hold the road up from above, like a swing.",
      "Push on a rope and it just goes slack. Beams do the pushing."
    ],
    grown: "Cables only carry tension. Suspension and cable-stayed bridges hang the deck from towers, and the towers carry the load down into the ground.",
    levels: [
      { name: "Hang it up", gap: 4, rows: [-2, 0], towers: ["0,-2", "4,-2"], truck: "bus", parts: [],
        inv: { road: 4, rope: 4 }, par: 6,
        text: "Hang the road from the stone towers with ropes. Drag a rope from a tower to the road.",
        win: "The ropes pull the road up from above, like a swing." },
      { name: "Ropes pull", gap: 5, rows: [-2, 0], towers: ["0,-2"], truck: "truck", parts: [],
        inv: { road: 5, rope: 4, beam: 4 }, par: 7,
        text: "Only one tower this time, and just 4 beams. Can ropes from one side hold up the whole road?",
        win: "One tower, a few ropes, and the whole road hangs safely." },
      { name: "Wide gorge", gap: 6, rows: [-2, 0], towers: ["0,-2", "6,-2"], truck: "bus", parts: [],
        inv: { road: 6, rope: 6, beam: 4 }, par: 10,
        text: "A wide gorge and a heavy bus. Beams are scarce, so let the towers and ropes do the work.",
        win: "That's a cable-stayed bridge, like the ones over big rivers." }
    ],
    lesson: {
      title: "You finished Jungle Gorge!",
      life: "The Golden Gate Bridge hangs its road from two giant cables. Each one is made of 27,000 thin wires.",
      job: "\u{1F9D7} Rope access technicians climb bridges on ropes to check the cables."
    }
  },
  {
    id: "t6", trail: true, kicker: "World 6", name: "City Harbour", emoji: "\u{1F3D9}\u{FE0F}", color: "#6a45c4", theme: "city",
    rule: "Islands, boats and traffic jams",
    says: "The city needs bridges for everyone: islands to hop across, boats to let through, and lots of traffic at once.",
    more: [
      "Islands are solid ground. Build from them!",
      "In a convoy, more than one truck is on your bridge at a time.",
      "Use everything you've learned."
    ],
    grown: "Real bridges combine many ideas: supports where the ground allows, clear spans over shipping channels, cables where spans are long, and strength for full traffic.",
    levels: [
      { name: "Island hop", gap: 8, rows: [-1, 1], islands: [[3, 5]], truck: "truck", parts: [],
        inv: { road: 6, beam: 4, steel: 2 }, par: 8,
        text: "There's an island in the harbour. It's solid ground, so build from it!",
        win: "Two short bridges are much easier than one long one." },
      { name: "Rush hour", gap: 5, rows: [-1, 1], convoy: ["car"], truck: "truck", parts: [],
        inv: { road: 5, beam: 6, steel: 2 }, par: 10,
        text: "Rush hour! A truck and a car cross together, so the bridge carries both at once.",
        win: "Strong enough for a traffic jam!" },
      { name: "Harbour lane", gap: 8, rows: [-3, 1], islands: [[2, 3]], towers: ["8,-3"], lane: [4, 7], truck: "bus", parts: [],
        inv: { road: 7, beam: 4, steel: 2, rope: 3 }, par: 11,
        text: "An island, a boat lane and a tower. Hang the long side, prop the short side.",
        win: "Every trick in one bridge: an island, a clear lane and ropes." },
      { name: "Night buses", gap: 6, rows: [-2, 1], convoy: ["bus"], truck: "bus", parts: [],
        inv: { road: Infinity, beam: Infinity, steel: Infinity }, budget: 54, par: 43,
        text: "Two full buses, one behind the other. Strong enough for both, cheap enough for the city.",
        win: "The night buses rolled home safely." }
    ],
    lesson: {
      title: "You finished the Bridge Trail!",
      life: "Sydney Harbour Bridge carries 8 lanes of cars, 2 train lines, a bike path and a footpath, all at once.",
      job: "\u{1F3D7}\u{FE0F} Project managers bring the engineers, builders and plans together to get a bridge built."
    }
  }
];
