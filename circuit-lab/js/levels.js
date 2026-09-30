/* Circuit Lab - the three chapters, their levels, the jobs and the quiz.      */
/*                                                                             */
/* A level lists the parts already on the board (`parts`, glued down), any   */
/* the kid may take away (`loose`), and what they get to build with (`inv`). */
/* `par` is the fewest moves that win; tools/circuit-check.js plays a real    */
/* solution to every level and fails if par is wrong or the level is stuck.  */
"use strict";
window.CL = window.CL || {};

(function () {
  // Most levels are the same 4 x 3 ring: battery on the left going up, bulb
  // top middle. Gaps are the edges left empty for the kid to fill.
  const RING = ["h:0:0", "h:1:0", "h:2:0", "v:3:0", "v:3:1", "h:2:2", "h:1:2", "h:0:2", "v:0:1", "v:0:0"];
  function ring(over, gaps) {
    const out = {};
    RING.forEach((k) => { if (gaps.indexOf(k) < 0) out[k] = over[k] || "wire"; });
    return out;
  }
  const BATT_BULB = { "v:0:1": "battery", "h:1:0": "bulb" };
  const G43 = { cols: 4, rows: 3 };

  CL.THINGS = ["coin", "clip", "key", "pencil", "wood", "paper", "balloon"];

  // Stay Safe comes first and everything else stays locked until it's done.
  // Ids are unchanged from before the move so saved stars still line up.
  CL.CHAPTERS = [
    {
      id: 4,
      emoji: "\u{1F9BA}",
      kicker: "Chapter 1",
      name: "Stay Safe",
      color: "#1f9d55",
      safety: true,
      says: "Toy batteries are safe to learn with. The power in the walls is strong enough to badly hurt you, or even kill you.",
      more: [
        "Never poke anything into a <b>power point</b>.",
        "Keep <b>water</b> away from anything that plugs in.",
        "Stay far away from <b>power lines</b>, even ones on the ground.",
        "If someone gets a shock, <b>don't touch them</b>. Get a grown-up and call <b>000</b>."
      ],
      grown: "Mains power in Australia is 230 volts, about 150 times a toy battery. Wet skin lets far more current through. Safety switches (RCDs) cut the power in a fraction of a second, but they don't make wall power safe to touch.",
      levels: [
        { name: "Danger at home", kind: "spot",
          text: "Tap every danger in the house. There are 4 of them. Careful: the rest are safe!",
          win: "You found all 4 dangers at home. Now you can help keep your family safe too.",
          tiles: [
            { e: "\u{1F374}\u{1F35E}", t: "Getting stuck toast out with a fork", d: true,
              why: "Metal carries electricity from the toaster into you. A grown-up must switch it off and unplug it first." },
            { e: "\u{1F4F1}\u{1F6C1}", t: "Using a phone on its charger in the bath", d: true,
              why: "Water and wall power together can give a deadly shock. Never use anything plugged in near water." },
            { e: "\u{1F50C}\u{26A1}", t: "A cord with the wires poking out", d: true,
              why: "Bare wires can shock you. Don't touch it. Tell a grown-up so they can switch it off." },
            { e: "\u{1F50C}\u{1F50C}\u{1F50C}", t: "Plugs piled on plugs in one power board", d: true,
              why: "Too many plugs overload it. It gets hot and can start a fire." },
            { e: "\u{1F4A1}", t: "A lamp switched on", why: "Lamps are made to be used. That one's fine." },
            { e: "\u{1F4F1}\u{1F5A5}\u{FE0F}", t: "A phone charging on a dry desk", why: "A charger on a dry desk is fine." },
            { e: "\u{1F64C}\u{1F4A1}", t: "Flicking the light switch with dry hands", why: "Switches are made for fingers. Dry hands are the safe way." },
            { e: "\u{1F4FA}", t: "Watching TV", why: "Totally safe. Enjoy the show!" },
            { e: "\u{1F50B}\u{1F9F8}", t: "Changing a toy's batteries", why: "Toy batteries are small and safe to handle." }
          ] },
        { name: "Danger outside", kind: "spot",
          text: "Now look outside. Tap every danger. There are 4 of them.",
          win: "You found all 4 dangers outside. Power lines are never a place to play.",
          tiles: [
            { e: "\u{1FA81}\u{26A1}", t: "Flying a kite near power lines", d: true,
              why: "If the string or kite touches a line, electricity can travel down to you. Fly kites in open parks." },
            { e: "\u{3030}\u{FE0F}\u{1F327}\u{FE0F}", t: "A power line lying on the ground after a storm", d: true,
              why: "It might still be live. Stay at least 8 metres away and tell a grown-up to call 000." },
            { e: "\u{1F333}\u{26A1}", t: "Climbing a tree that touches power lines", d: true,
              why: "Electricity can jump from the line into the tree and into you." },
            { e: "\u{1F6A7}\u{26A1}", t: "Climbing a fence that says DANGER: HIGH VOLTAGE", d: true,
              why: "Behind that fence is enough power for a whole suburb. Never go in, even to get a ball back." },
            { e: "\u{26BD}\u{1F333}", t: "Kicking a footy in the park, far from power lines", why: "Open space, no lines. Perfect!" },
            { e: "\u{1F526}\u{26FA}", t: "Using a torch when camping", why: "Torches run on small batteries. Safe." },
            { e: "\u{1F6B2}", t: "Riding a bike on the footpath", why: "No electricity danger here. Wear your helmet!" },
            { e: "\u{1F331}\u{1F4A7}", t: "Watering the garden", why: "Water on plants is fine, as long as it's away from power points." },
            { e: "\u{2600}\u{FE0F}\u{1F3E0}", t: "Solar panels on the roof", why: "Solar panels are fine to look at. Only electricians go up to fix them." }
          ] },
        { name: "Safe or danger?", kind: "sort",
          text: "One at a time: is it safe, or is it a danger?",
          win: "Great sorting! You know the difference between safe and dangerous.",
          cards: [
            { e: "\u{1F590}\u{FE0F}\u{1F4A7}\u{1F50C}", t: "Pulling out a plug with wet hands", d: true,
              why: "Water helps electricity get into you. Always dry your hands first." },
            { e: "\u{1F50C}\u{1F44C}", t: "Pulling out a plug by holding the plug, not the cord", why: "Right! Yanking the cord can break the wires inside." },
            { e: "\u{1F4CD}\u{1F50C}", t: "Poking a hair clip into a power point", d: true,
              why: "Never put anything in a power point except a plug. It can kill." },
            { e: "\u{1F4A8}\u{1F6C1}", t: "Using a hair dryer next to a full bath", d: true,
              why: "If it falls in the water, the water becomes electric. Keep them far apart." },
            { e: "\u{1F50B}\u{1F4A1}", t: "Building circuits with toy batteries", why: "Toy batteries are safe to learn with. That's what this lab is for!" },
            { e: "\u{1F329}\u{FE0F}\u{1F3CA}", t: "Swimming outside in a thunderstorm", d: true,
              why: "Lightning is giant electricity. Get out of the water and go inside." },
            { e: "\u{1F9D1}\u{200D}\u{1F527}\u{1F50C}", t: "A licensed electrician fixing a broken power point", why: "That's their job, and they're trained to switch the power off first." },
            { e: "\u{1F4AD}\u{1F35E}", t: "Smoke from the toaster: telling a grown-up straight away", why: "Exactly right. Tell a grown-up fast and stay back." }
          ] },
        { name: "What would you do?", kind: "choose",
          text: "Something has gone wrong. Pick the safest thing to do.",
          win: "You know exactly what to do in an emergency. That could save someone's life.",
          qs: [
            { e: "\u{1F9CD}\u{26A1}", q: "Someone is stuck touching a sparking cord. What do you do?",
              a: ["Don't touch them. Yell for a grown-up to switch off the power and call 000", "Pull them away with your hands", "Throw water on them"], right: 0,
              why: "If you touch them, the electricity can go through you too. Power off first, then help." },
            { e: "\u{1F327}\u{FE0F}\u{3030}\u{FE0F}", q: "After a storm you see a power line on the ground. What do you do?",
              a: ["Stay far away and tell a grown-up to call 000", "Poke it with a stick to see if it's on", "Step over it carefully"], right: 0,
              why: "A fallen line can still be live. Stay at least 8 metres away." },
            { e: "\u{1F50C}\u{2728}", q: "A power point sparks and smells like burning. What do you do?",
              a: ["Stay away and tell a grown-up straight away", "Plug something else in to test it", "Blow on it to cool it down"], right: 0,
              why: "Sparks and burning smells mean danger. A grown-up switches it off and calls an electrician." },
            { e: "\u{1F35E}", q: "Your toast is stuck in the toaster. What do you do?",
              a: ["Ask a grown-up to switch it off and unplug it", "Get it out with a fork", "Shake the toaster while it's on"], right: 0,
              why: "Never put metal in a toaster. Off and unplugged first." },
            { e: "\u{1F198}", q: "What number do you call in an emergency in Australia?",
              a: ["000", "123", "911"], right: 0,
              why: "000 (triple zero) gets you police, fire or an ambulance." }
          ] }
      ],
      lesson: {
        title: "You're a Safety Expert!",
        life: "Teach one of these rules to someone in your family tonight. Safety works best when everyone knows it.",
        job: "\u{1F477} Electricians spend years learning to work safely. They always switch the power off before they touch anything."
      }
    },
    {
      id: 1,
      emoji: "\u{1F504}",
      kicker: "Chapter 2",
      name: "Full Circle",
      color: "#c98a00",
      says: "Electricity only flows if it can go all the way round and back to the battery.",
      more: [
        "That round trip is called a <b>circuit</b>. It comes from the word <i>circle</i>.",
        "If there's a gap anywhere, nothing works.",
        "A <b>switch</b> is a gap you can open and close."
      ],
      grown: "Current flows only around a closed circuit, out of one terminal of the battery and back into the other. An open switch breaks the circuit.",
      levels: [
        { name: "Close the loop", grid: G43, parts: ring(BATT_BULB, ["v:3:0", "h:1:2"]),
          inv: { wire: 2 }, par: 2, goal: { type: "lit" },
          text: "There are two gaps in the loop. Pick the wire, then tap each gap to fill it.",
          win: "The loop is closed, so electricity can flow all the way round!" },
        { name: "Round the corner", grid: G43, parts: { "v:0:0": "battery", "h:2:2": "bulb" },
          inv: { wire: 10 }, par: 8, goal: { type: "lit" },
          text: "The bulb is far away. Build a path from the battery to the bulb, and another path back.",
          win: "Out of the battery, through the bulb, and back again. That's a circuit!" },
        { name: "Light switch", grid: G43, parts: ring(BATT_BULB, ["h:1:2", "v:3:1"]),
          inv: { switch: 1, wire: 1 }, par: 2, goal: { type: "controls", load: "bulb" },
          text: "Fill the gaps with a switch and a wire. Then flip the switch to turn the light on and off.",
          win: "A switch opens a gap in the loop, and closes it again. That's how every light switch works." },
        { name: "Doorbell", grid: { cols: 5, rows: 3 },
          parts: { "v:0:0": "battery", "v:4:0": "buzzer", "h:0:1": "wire", "h:1:1": "wire", "h:2:1": "wire", "h:3:1": "wire" },
          inv: { wire: 4, switch: 1 }, par: 4, goal: { type: "controls", load: "buzzer" },
          text: "Build a doorbell! Join the top with wires and a switch. Then press the switch to ring it.",
          win: "Ding dong! A doorbell button is just a switch that closes the loop while you press it." }
      ],
      lesson: {
        title: "You finished Full Circle!",
        life: "Every light switch in your house opens and closes a gap. Switch it off and the loop is broken, so the light goes out.",
        job: "\u{1F477} Electricians wire up the loops inside houses, so every switch works the right light."
      }
    },
    {
      id: 2,
      emoji: "\u{1F500}",
      kicker: "Chapter 3",
      name: "One Path or Two",
      color: "#2b8fd6",
      says: "Things on one path share the push. Things on their own paths each get the full push.",
      more: [
        "Two bulbs on <b>one path</b> glow dimmer. This is called <b>series</b>.",
        "Two bulbs on <b>their own paths</b> both glow bright. This is called <b>parallel</b>.",
        "Two batteries in a row give a <b>bigger push</b>."
      ],
      grown: "In series, components share the battery's voltage, so each bulb gets less. In parallel, each branch gets the full voltage. Batteries in series add their voltages.",
      levels: [
        { name: "Two in a row", grid: G43, parts: ring({ "v:0:1": "battery" }, ["h:1:0", "h:1:2"]),
          inv: { bulb: 2 }, par: 2, goal: { type: "lit", n: 2 },
          text: "Put both bulbs into the loop. How bright do they glow?",
          win: "Both are lit, but dim. They're on one path, so they share the push. That's called series." },
        { name: "Bright twins", grid: G43, parts: { "v:0:0": "battery" },
          inv: { bulb: 2, wire: 6 }, par: 6, goal: { type: "bright", n: 2 },
          text: "Make two bulbs glow really bright. Tip: give each bulb its own path back to the battery.",
          win: "Each bulb has its own path, so each gets the full push. That's called parallel." },
        { name: "Two switches", grid: { cols: 5, rows: 3 },
          parts: { "v:0:0": "battery", "v:0:1": "wire",
            "h:0:0": "wire", "h:1:0": "wire", "h:2:0": "wire", "h:3:0": "wire",
            "h:0:2": "wire", "h:1:2": "wire", "h:2:2": "wire", "h:3:2": "wire" },
          inv: { bulb: 2, switch: 2 }, par: 4, goal: { type: "controls", load: "bulb", n: 2 },
          text: "Build two lights between the long wires. Give each light its own switch, so each switch works just its own light.",
          win: "Each light has its own path and its own switch. That's how the rooms in your house work." },
        { name: "Super bright", grid: G43, parts: ring(BATT_BULB, ["v:0:0"]),
          inv: { battery: 1, wire: 1 }, par: 1, goal: { type: "super" },
          text: "Here's a spare battery. Can you make the bulb extra bright?",
          win: "Two batteries in a row give a bigger push. But careful: too many and the bulb burns out!" }
      ],
      lesson: {
        title: "You finished One Path or Two!",
        life: "The lights in your house are in parallel. That's why one bulb can blow and all the others stay on.",
        job: "\u{1F4A1} Lighting designers plan which lights share a path and which get their own switch, for houses, stages and concerts."
      }
    },
    {
      id: 3,
      emoji: "\u{1F9EA}",
      kicker: "Chapter 4",
      name: "Safe Paths",
      color: "#d0503b",
      says: "Metal lets electricity through. Wood, paper and rubber stop it.",
      more: [
        "Things that let electricity through are <b>conductors</b>.",
        "Things that stop it are <b>insulators</b>.",
        "A path back to the battery with nothing on it is a <b>short circuit</b>. It makes the battery hot, and that's dangerous."
      ],
      grown: "Metals conduct because their electrons move freely. Insulators hold on to theirs. A short circuit is a very low-resistance path, so a very large current flows and heats the wires and battery.",
      levels: [
        { name: "Test it", grid: G43, parts: ring(BATT_BULB, ["h:1:2"]), open: ["h:1:2"], test: "h:1:2",
          inv: { coin: Infinity, clip: Infinity, key: Infinity, pencil: Infinity, wood: Infinity, paper: Infinity, balloon: Infinity },
          par: 7, goal: { type: "tested", things: CL.THINGS },
          text: "Put each thing in the glowing gap. Does the bulb light up? Test all 7.",
          win: "Metal things let electricity through. Wood, paper and rubber stop it. Pencil lead lets a little bit through!" },
        { name: "Fix it", grid: G43, parts: ring(BATT_BULB, ["h:1:2", "v:3:0"]), open: ["h:1:2", "v:3:0"],
          inv: { wood: 1, paper: 1, balloon: 1, key: 1, clip: 1 }, par: 2, goal: { type: "lit" },
          text: "The wires ran out! Fill the two gaps with things from the box to light the bulb.",
          win: "The key and the paper clip are metal, so they carry electricity just like a wire." },
        { name: "Pencil power", grid: G43, parts: ring(BATT_BULB, ["h:2:0"]), open: ["h:2:0"],
          inv: { coin: 1, pencil: 1, balloon: 1 }, par: 1, goal: { type: "dim" },
          text: "Make the bulb glow, but only a little bit.",
          win: "Pencil lead is made of graphite. It lets some electricity through, but not much, so the bulb glows dim." },
        { name: "Short circuit!", grid: G43,
          parts: ring(BATT_BULB, ["h:2:2"]),
          loose: { "h:2:2": "wire", "v:1:0": "wire", "v:1:1": "wire" },
          inv: {}, par: 1, goal: { type: "lit" },
          text: "Uh-oh! The battery is hot and the bulb is dark. Find the shortcut and take it out with \u{1F9FD} Remove.",
          win: "Now the only way back to the battery is through the bulb. No more shortcut, no more hot battery." }
      ],
      lesson: {
        title: "You finished Safe Paths!",
        life: "Wires are metal inside and plastic outside. The metal carries the electricity, and the plastic keeps it away from your fingers.",
        job: "\u{1F527} Electronics engineers pick the right materials so gadgets like phones and robots work and stay safe."
      }
    }
  ];

  // The free build: a big empty board, everything unlimited.
  CL.FREE = {
    free: true, name: "Free build", grid: { cols: 7, rows: 5 }, parts: {}, loose: { "v:0:1": "battery" },
    inv: ["wire", "battery", "bulb", "switch", "buzzer", "motor"].concat(CL.THINGS)
      .reduce((o, t) => { o[t] = Infinity; return o; }, {}),
    text: "Build anything you like. Try 3 batteries on one bulb, or a fan with a switch!"
  };

  // One of these ends every win, so the safety rules come round again and again.
  CL.SPARKS = [
    "Never poke anything into a power point. Only plugs go in there.",
    "Keep water away from anything that plugs in.",
    "Stay far away from power lines, even when they're on the ground.",
    "If someone gets a shock, don't touch them. Get a grown-up and call 000.",
    "Fly kites in open parks, far from power lines.",
    "Pull out a plug by the plug, never by the cord.",
    "Dry your hands before you touch a switch or a plug.",
    "Too many plugs in one power board can start a fire.",
    "If a cord has wires showing, don't touch it. Tell a grown-up.",
    "Wall power is about 150 times stronger than a toy battery.",
    "Never climb a fence that says DANGER: HIGH VOLTAGE.",
    "In a thunderstorm, get out of the water and go inside."
  ];

  CL.RULES = [
    { e: "\u{1F50C}", t: "Never poke anything into a power point." },
    { e: "\u{1F4A7}", t: "Keep water away from anything that plugs in." },
    { e: "\u{26A1}", t: "Stay far away from power lines, even ones on the ground." },
    { e: "\u{1F198}", t: "If someone gets a shock, don't touch them. Get a grown-up and call 000." }
  ];

  CL.JOBS = [
    { emoji: "\u{1F477}", name: "Electrician", does: "Puts the wires, switches and power points into houses, and makes sure nobody gets a shock." },
    { emoji: "\u{1F527}", name: "Electronics engineer", does: "Designs the tiny circuits inside phones, game consoles, cars and robots." },
    { emoji: "\u{1F4A1}", name: "Lighting designer", does: "Plans the lights for stages, concerts, shops and buildings so they look amazing." }
  ];

  // One question from each chapter is picked each time, so a replay feels new.
  CL.QUIZ = [
    [
      { emoji: "\u{1F504}", q: "What does electricity need so it can flow?",
        a: ["A full loop back to the battery", "Just one wire", "A really big bulb"], right: 0,
        why: "It has to go all the way round and back, or nothing works." },
      { emoji: "\u{1F39A}\u{FE0F}", q: "You switch a light off. What does the switch do?",
        a: ["It opens a gap in the loop", "It adds more wires", "It empties the battery"], right: 0,
        why: "With a gap in the loop, the electricity can't get round, so the light goes out." }
    ],
    [
      { emoji: "\u{1F4A1}", q: "Two bulbs are on one path. How do they glow?",
        a: ["Dimmer than one bulb", "Brighter than one bulb", "They don't glow at all"], right: 0,
        why: "They share the push, so each gets less. That's series." },
      { emoji: "\u{1F3E0}", q: "Why can one bulb at home blow and the others stay on?",
        a: ["Each light has its own path", "The bulbs are magic", "Houses have no wires"], right: 0,
        why: "The lights are in parallel, so a gap in one path doesn't stop the others." }
    ],
    [
      { emoji: "\u{1F511}", q: "Which one lets electricity through?",
        a: ["A metal key", "A wooden stick", "A rubber balloon"], right: 0,
        why: "Metal is a conductor. Wood and rubber are insulators." },
      { emoji: "\u{1F50C}", q: "Why are wires covered in plastic?",
        a: ["Plastic stops electricity reaching your hands", "To make them heavier", "So they can glow"], right: 0,
        why: "Plastic is an insulator. It keeps the electricity inside the wire." }
    ],
    // Every quiz has one safety question, whatever else it asks.
    [
      { emoji: "\u{26A0}\u{FE0F}", q: "Where should you never poke anything?",
        a: ["Into a power point in the wall", "Into a pillow", "Into a book"], right: 0,
        why: "Wall power is much stronger than a toy battery. Only grown-up electricians work with it." },
      { emoji: "\u{1F6C1}", q: "Why must you keep phones and hair dryers away from the bath?",
        a: ["Water and wall power together can give a deadly shock", "They might get a bit wet", "They are too noisy"], right: 0,
        why: "Water lets electricity into your body. Keep anything that plugs in far from water." },
      { emoji: "\u{1F198}", q: "Someone is getting a shock. What do you do?",
        a: ["Don't touch them. Get a grown-up and call 000", "Grab their arm and pull", "Pour water on them"], right: 0,
        why: "Touching them can shock you too. The power has to be switched off first." },
      { emoji: "\u{1FA81}", q: "Where is the safe place to fly a kite?",
        a: ["An open park, far from power lines", "Next to the power lines on your street", "On the roof"], right: 0,
        why: "If a kite touches a power line, the electricity can run down the string to you." }
    ]
  ];
})();
