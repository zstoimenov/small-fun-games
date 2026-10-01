/* Bridge Builder - the chapters, their levels, the jobs and the quiz.         */
/*                                                                             */
/* Every gap runs from the left bank edge at x=0 to the right one at x=gap,   */
/* with the road at row 0. `rows` is how high (negative) and low the kid may  */
/* build. Members are written "x,y x,y material". `par` is the fewest pieces  */
/* that hold; tools/bridge-check.js drives the truck over a real solution to  */
/* every level and fails if it doesn't hold, if the empty level already does, */
/* or if the solution isn't exactly `par` pieces.                             */
/*                                                                             */
/* The pars that aren't obvious were found by brute force: nothing with 6 or  */
/* fewer beams above the road carries the truck over a 4-gap, and 2 props off */
/* the bank faces do it from below.                                            */
"use strict";
window.BB = window.BB || {};

(function () {
  const road = (gap) => Array.from({ length: gap }, (_, x) => x + ",0 " + (x + 1) + ",0 road");
  const SQUARES = road(4)
    .concat([0, 1, 2, 3, 4].map((x) => x + ",0 " + x + ",-1 beam"))
    .concat([0, 1, 2, 3].map((x) => x + ",-1 " + (x + 1) + ",-1 beam"));

  BB.CHAPTERS = [
    {
      id: 1,
      emoji: "\u{1FAB5}",
      kicker: "Chapter 1",
      name: "Plank and Pillar",
      color: "#c9771a",
      says: "A long plank bends and snaps. Holding it up in the middle makes it strong.",
      more: [
        "A <b>heavier</b> truck bends a plank more.",
        "A <b>longer</b> plank bends a LOT more.",
        "A <b>pillar</b> underneath gives the weight a path down to the ground."
      ],
      grown: "A beam's bending grows with the load and very fast with its span. A support in the middle turns one long span into two short ones.",
      levels: [
        { name: "First bridge", gap: 2, rows: [-1, 1], truck: "car", parts: [],
          inv: { road: 2 }, par: 2,
          text: "Drag from the dot on the riverbank to the next dot along to lay road. Reach the other side, then press Test!",
          win: "The car made it! A short gap only needs a plank." },
        { name: "Too long!", gap: 4, rows: [-1, 2], rocks: [[2, 2]], truck: "car", parts: [],
          inv: { road: 4, beam: 2 }, par: 6, fail: "A plank this long bends too far and snaps. Use the rock to hold up the middle!",
          text: "This gap is twice as long. Try just a road first and see what happens. Then use the rock to hold it up.",
          win: "The pillar holds up the middle, so the road only has to reach half as far." },
        { name: "Two pillars", gap: 6, rows: [-1, 1], rocks: [[2, 1], [4, 1]], truck: "truck", parts: [],
          inv: { road: 6, beam: 4 }, par: 8,
          text: "A long gap and a heavy truck. Build the road, and a pillar on each rock.",
          win: "Long bridges have lots of pillars, so no bit of road has to reach too far." }
      ],
      lesson: {
        title: "You finished Plank and Pillar!",
        life: "Look under a motorway bridge. You'll see big pillars holding it up every few metres.",
        job: "\u{1F9BA} Builders pour the concrete pillars and lay the road on top."
      }
    },
    {
      id: 2,
      emoji: "\u{1F53A}",
      kicker: "Chapter 2",
      name: "Triangle Power",
      color: "#2b8fd6",
      says: "Squares fold flat. Triangles keep their shape. That's why bridges are full of triangles.",
      more: [
        "Push the corner of a square and it squashes into a diamond.",
        "A triangle can't change shape unless one of its sides breaks.",
        "Even the riverbank can be one side of a triangle!"
      ],
      grown: "A frame of squares with pinned corners is a mechanism: it can move without any beam stretching. Triangles are rigid, so a truss carries the load by pure pulling and squashing in its beams.",
      levels: [
        { name: "Squash test", gap: 4, rows: [-1, 0], truck: "car", parts: SQUARES,
          inv: { beam: 4 }, par: 2, fail: "The squares folded flat, so the road had to hold the car all by itself, and snapped.",
          text: "This bridge is made of squares. Test it first. Then add beams across the squares to make triangles.",
          win: "Just two triangles lock the whole frame, so the squares can't fold any more." },
        { name: "Build a truss", gap: 4, rows: [-1, 0], truck: "truck", parts: road(4),
          inv: { beam: 10 }, par: 7,
          text: "Build a frame of triangles above the road, strong enough for the truck. Can you do it with 7 beams?",
          win: "That frame of triangles is called a truss. It's the strongest shape for its weight." },
        { name: "Low bridge", gap: 4, rows: [0, 1], truck: "truck", parts: road(4),
          inv: { beam: 6 }, par: 2,
          text: "No building above the road on this one! Build underneath. Tip: the riverbank can help.",
          win: "Each prop, the road and the bank make a triangle. The riverbank did half the work!" }
      ],
      lesson: {
        title: "You finished Triangle Power!",
        life: "Next time you see a crane, a bridge or a power tower, count the triangles!",
        job: "\u{1F477} Civil engineers work out the shapes that keep bridges, roads and towers standing."
      }
    },
    {
      id: 3,
      emoji: "\u{1F529}",
      kicker: "Chapter 3",
      name: "Smart Engineer",
      color: "#7a4fd6",
      says: "Heavier trucks and longer gaps need stronger stuff. Smart engineers use steel only where it's needed.",
      more: [
        "<b>Steel</b> is twice as strong as wood, but it costs a lot more.",
        "In a truss, the <b>top</b> gets squashed the hardest.",
        "Every piece you save makes the bridge cheaper."
      ],
      grown: "In a truss on two supports the top chord is in compression and the forces grow with the span. Engineers size each member for its own force rather than making everything the strongest.",
      levels: [
        { name: "Heavy load", gap: 4, rows: [-1, 0], truck: "big", parts: road(4),
          inv: { beam: 6, steel: 4 }, par: 9,
          text: "The big truck is really heavy. Hold up every bit of road, and use your 4 steel beams where the squashing is worst.",
          win: "Steel along the top took the big squash, and wood did the rest. Strong where it matters!" },
        { name: "Rescue run", gap: 6, rows: [-1, 2], rocks: [[3, 2]], truck: "fire", parts: road(6),
          inv: { beam: 6 }, par: 4,
          text: "The fire truck needs to get across, fast! Use the rock and the riverbanks.",
          win: "A pillar in the middle and a prop on each bank. Everything you've learned in one bridge!" },
        { name: "Long gap", gap: 6, rows: [-1, 0], truck: "truck", parts: road(6),
          inv: { beam: 10, steel: 6 }, par: 15,
          text: "The longest gap yet, and no rocks. Build a truss over the top. Longer trusses get squashed harder!",
          win: "A long truss with a steel top. That's how real bridges cross wide rivers." }
      ],
      lesson: {
        title: "You finished Smart Engineer!",
        life: "The Sydney Harbour Bridge is a giant steel arch full of triangles. It carries trains, cars, bikes and people every day.",
        job: "\u{1F4D0} Architects design how bridges and buildings look, and work with engineers to make them safe."
      }
    }
  ];

  // The free build: the long gap with a rock, every material, any truck.
  BB.FREE = {
    free: true, name: "Free build", gap: 6, rows: [-2, 2], rocks: [[3, 2]], truck: "car", parts: [],
    inv: { road: Infinity, beam: Infinity, steel: Infinity },
    text: "Build any bridge you like, pick a truck, and test it!"
  };

  BB.JOBS = [
    { emoji: "\u{1F477}", name: "Civil engineer", does: "Works out the shapes and materials that keep bridges, roads and dams standing." },
    { emoji: "\u{1F9BA}", name: "Builder", does: "Puts it all together on site: pillars, beams, bolts and the road on top." },
    { emoji: "\u{1F4D0}", name: "Architect", does: "Designs how bridges and buildings look, and makes sure they work for the people using them." }
  ];

  // One question from each chapter is picked each time, so a replay feels new.
  BB.QUIZ = [
    [
      { emoji: "\u{1FAB5}", q: "The same truck drives over two planks. Which one bends more?",
        a: ["The long plank", "The short plank", "They bend the same"], right: 0,
        why: "A longer plank bends a lot more. That's why long bridges need help." },
      { emoji: "\u{1F3DB}\u{FE0F}", q: "What does a pillar do for a bridge?",
        a: ["Holds it up from underneath", "Makes it longer", "Makes the truck lighter"], right: 0,
        why: "It gives the weight a path down to the ground, so the road doesn't have to reach so far." }
    ],
    [
      { emoji: "\u{1F53A}", q: "Which shape keeps its shape when you push on it?",
        a: ["A triangle", "A square", "A rectangle"], right: 0,
        why: "A triangle can't squash unless a side breaks. A square folds into a diamond." },
      { emoji: "\u{1F309}", q: "Why are bridges full of triangles?",
        a: ["Triangles don't squash", "Triangles look pretty", "Triangles are easy to paint"], right: 0,
        why: "Triangles keep their shape, so the bridge stays strong." }
    ],
    [
      { emoji: "\u{1F529}", q: "Why not build the whole bridge out of steel?",
        a: ["Steel costs a lot more", "Steel is weaker than wood", "Steel can't be bent into shape"], right: 0,
        why: "Smart engineers use the strong, expensive stuff only where it's needed." },
      { emoji: "\u{1F69B}", q: "In a truss bridge, which part gets squashed the hardest?",
        a: ["The beams along the top", "The ground", "The truck's tyres"], right: 0,
        why: "The top of a truss gets squashed and the bottom gets stretched." }
    ]
  ];
})();
