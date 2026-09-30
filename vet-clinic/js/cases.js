/* Vet Clinic - the chapters, the patients, the vet's chart, jobs and quiz.   */
/*                                                                             */
/* A case lists what each check finds. `bad` means "not normal", `key` marks */
/* the check that gives the answer away, and `waste` marks a check a good vet */
/* wouldn't have done (it costs a star, and says why). Numbers come with the  */
/* normal range for that animal, because the lesson of chapter 1 is that      */
/* normal depends on who you are: 38.8 °C is healthy for a dog and a fever    */
/* for you. tools/vet-check.js makes sure every case can be solved from its   */
/* checks and every answer explains itself.                                   */
"use strict";
window.VC = window.VC || {};

(function () {
  // Normal ranges, shared by the cases, the heartbeat game and the chart.
  // Heart: beats a minute at rest. Temperature: °C.
  const N = {
    mouse:    { e: "\u{1F401}", name: "Mouse",    heart: [500, 700], temp: null },
    cat:      { e: "\u{1F408}", name: "Cat",      heart: [140, 220], temp: [38.1, 39.2] },
    dog:      { e: "\u{1F415}", name: "Dog",      heart: [60, 140],  temp: [38.3, 39.2] },
    puppy:    { e: "\u{1F436}", name: "Puppy",    heart: [100, 220], temp: [38.3, 39.2] },
    rabbit:   { e: "\u{1F407}", name: "Rabbit",   heart: [130, 325], temp: [38.5, 40.0] },
    horse:    { e: "\u{1F40E}", name: "Horse",    heart: [28, 44],   temp: [37.5, 38.5] },
    elephant: { e: "\u{1F418}", name: "Elephant", heart: [25, 35],   temp: null },
    you:      { e: "\u{1F9D2}", name: "You",      heart: [70, 110],  temp: [36.5, 37.5] }
  };
  VC.NORMAL = N;
  const heart = (sp, v, extra) => Object.assign({ num: { v, unit: "beats a minute", range: N[sp].heart } }, extra || {});
  const temp = (sp, v, extra) => Object.assign({ num: { v, unit: "\u{00B0}C", range: N[sp].temp } }, extra || {});
  // A number is "bad" when it's outside the range; cases can still say so explicitly.
  VC.isBad = (r) => r.bad != null ? r.bad : r.num ? (r.num.v < r.num.range[0] || r.num.v > r.num.range[1]) : false;

  VC.TOOLS = [
    { id: "heart", e: "\u{1FA7A}", label: "Heartbeat" },
    { id: "temp",  e: "\u{1F321}\u{FE0F}", label: "Temperature" },
    { id: "eyes",  e: "\u{1F441}\u{FE0F}", label: "Eyes & ears" },
    { id: "mouth", e: "\u{1F9B7}", label: "Mouth & teeth" },
    { id: "skin",  e: "\u{1F43E}", label: "Skin & fur" },
    { id: "weigh", e: "\u{2696}\u{FE0F}", label: "Weigh" },
    { id: "xray",  e: "\u{1FA7B}", label: "X-ray" }
  ];

  VC.CHAPTERS = [
    {
      id: 1,
      emoji: "\u{1FA7A}",
      kicker: "Chapter 1",
      name: "Check-up",
      color: "#2a9d8f",
      says: "Every animal has its own normal. A vet checks each one against what's normal for that animal.",
      more: [
        "<b>Small animals have fast hearts.</b> A mouse's heart beats about 600 times a minute. An elephant's beats about 30.",
        "<b>Dogs and cats are warmer than you.</b> 38.8 \u{00B0}C is healthy for a dog, but a fever for a person.",
        "A check-up looks at everything, from nose to tail."
      ],
      grown: "Resting heart rate falls as body size rises, roughly with mass to the power of -1/4. Normal body temperature also differs by species, so vital signs only mean something against that species' reference range.",
      levels: [
        { name: "Whose heartbeat?", kind: "heart",
          text: "Listen to the heartbeat and watch the heart. Whose is it?",
          win: "Small animals have fast hearts, and big animals have slow ones.",
          rounds: ["cat", "elephant", "mouse", "dog", "mouse", "elephant"],
          choices: ["mouse", "cat", "dog", "elephant"] },
        { name: "Hot or not?", kind: "temp",
          text: "Read the thermometer. Is it normal, too hot, or too cold for that animal?",
          win: "The same number can be healthy for one animal and a fever for another. Always check the chart!",
          rounds: [
            { sp: "dog", name: "Rex", v: 38.8 },
            { sp: "you", name: "You", v: 38.8 },
            { sp: "cat", name: "Mittens", v: 40.3 },
            { sp: "horse", name: "Star", v: 38.0 },
            { sp: "rabbit", name: "Thumper", v: 39.5 },
            { sp: "dog", name: "Bella", v: 37.0 }
          ] },
        { name: "Pepper's first visit", kind: "case", sp: "puppy", pet: "Pepper",
          owner: "Pepper is 8 weeks old. She's here for her first check-up and her vaccination!",
          checks: {
            heart: heart("puppy", 150, { t: "Puppies' hearts beat faster than grown-up dogs'." }),
            temp: temp("puppy", 38.9),
            eyes: { t: "Bright and clear. Clean ears." },
            mouth: { t: "Pink gums and sharp little baby teeth." },
            skin: { t: "Shiny coat. No fleas." },
            weigh: { t: "3 kg. She's growing well." },
            xray: { t: "X-rays are for when a bone might be hurt. Pepper didn't need one.", waste: true }
          },
          dx: { q: "What did the check-up find?",
            a: ["Pepper is healthy", "Pepper has a broken leg", "Pepper has fleas"], right: 0,
            why: "Every check was normal for a puppy. Healthy!" },
          tx: { q: "What does Pepper need today?",
            a: ["Her vaccination, so she can't catch serious diseases", "A plaster cast", "Tummy medicine"], right: 0,
            why: "A vaccine teaches the body to fight a germ before it can make you sick." },
          care: { q: "What should Pepper's family do at home?",
            a: ["Puppy food, fresh water, lots of play, and her next vaccine in a month", "Give her chocolate as a treat", "Keep her in a box all day"], right: 0,
            why: "Good food, exercise and all her vaccines keep a puppy healthy. And never chocolate!" },
          win: "A check-up with nothing wrong is a great check-up. Stopping illness before it starts is a big part of a vet's job." }
      ],
      lesson: {
        title: "You finished Check-up!",
        life: "Next time you go to the doctor, ask what your heartbeat and temperature are. Now you know what's normal for you!",
        job: "\u{1FA7A} Vets check animals from nose to tail, and give vaccines to stop them getting sick."
      }
    },
    {
      id: 2,
      emoji: "\u{1F50D}",
      kicker: "Chapter 2",
      name: "What's Wrong?",
      color: "#e76f51",
      says: "Listen to the owner, do the right checks, and let the clues tell you what's wrong.",
      more: [
        "Start with what the owner tells you. It's your first clue.",
        "Pick the checks that fit. A good vet doesn't do every test.",
        "Find the <b>cause</b>, then fix it. Then help the family stop it happening again."
      ],
      grown: "Diagnosis is reasoning from history and examination to the most likely cause, then confirming it with a targeted test. Unneeded tests cost money and stress the animal.",
      levels: [
        { name: "Biscuit's leg", kind: "case", sp: "dog", pet: "Biscuit",
          owner: "Biscuit jumped off the trampoline, and now he won't stand on his back leg. He yelps if I touch it.",
          checks: {
            heart: heart("dog", 110),
            temp: temp("dog", 38.7),
            eyes: { t: "Bright and alert." },
            mouth: { t: "Pink gums. Healthy teeth." },
            skin: { t: "His back leg is swollen. He pulls it away when you touch it.", bad: true },
            weigh: { t: "18 kg. Just right for his size." },
            xray: { t: "The picture shows a crack right through one of his leg bones!", bad: true, key: true, pic: "\u{1F9B4}" }
          },
          dx: { q: "What's wrong with Biscuit?",
            a: ["A broken leg bone", "Fleas", "A tummy bug"], right: 0,
            why: "The X-ray shows the crack. That's why it hurts to stand on." },
          tx: { q: "How do you treat it?",
            a: ["Line up the bone, put on a cast, and give pain medicine", "A flea bath", "Nothing, he'll walk it off"], right: 0,
            why: "The cast holds the bone still so it can knit back together. That takes about 6 to 8 weeks." },
          care: { q: "What should Biscuit do at home?",
            a: ["Short walks on a lead only, and keep the cast dry", "Lots of trampoline jumping", "Take the cast off tomorrow"], right: 0,
            why: "Resting lets the bone heal. Running or jumping could break it again." },
          win: "The owner's story pointed at the leg, and the X-ray proved it. Great detective work!" },
        { name: "Itchy Mittens", kind: "case", sp: "cat", pet: "Mittens",
          owner: "Mittens keeps scratching and biting her fur. She's got little bald patches.",
          checks: {
            heart: heart("cat", 180),
            temp: temp("cat", 38.6),
            eyes: { t: "Clear eyes. Clean ears." },
            mouth: { t: "Pink gums. Healthy teeth." },
            skin: { t: "Tiny black specks in her fur, and a little jumping bug. Fleas!", bad: true, key: true, pic: "\u{1F41C}" },
            weigh: { t: "4 kg. Normal for a cat." },
            xray: { t: "X-rays show bones. Itchy skin isn't a bone problem.", waste: true }
          },
          dx: { q: "What's making Mittens itchy?",
            a: ["Fleas", "A broken bone", "Overgrown teeth"], right: 0,
            why: "Fleas bite, and the bites itch. Scratching made the bald patches." },
          tx: { q: "How do you treat it?",
            a: ["Flea treatment made for cats, for every pet in the house", "Dog flea drops", "Shave off all her fur"], right: 0,
            why: "Never use dog flea treatment on a cat. Some kinds are poisonous to cats. And every pet needs treating, or the fleas just jump back." },
          care: { q: "What should the family do at home?",
            a: ["Wash her bedding and vacuum, because flea eggs hide there", "Nothing, fleas go away by themselves", "Bath her every day"], right: 0,
            why: "Most fleas live in the house as eggs and babies, not on the pet. Cleaning gets rid of them." },
          win: "The skin check found the fleas straight away, and you didn't waste a test." },
        { name: "Thumper won't eat", kind: "case", sp: "rabbit", pet: "Thumper",
          owner: "Thumper hasn't eaten his dinner for two days, and he's dribbling.",
          checks: {
            heart: heart("rabbit", 220),
            temp: temp("rabbit", 39.2),
            eyes: { t: "Bright eyes. Clean ears." },
            mouth: { t: "His front teeth are way too long and crooked. He can't chew!", bad: true, key: true, pic: "\u{1F9B7}" },
            skin: { t: "Wet fur on his chin from dribbling.", bad: true },
            weigh: { t: "1.8 kg. Lighter than last time. He's lost weight from not eating.", bad: true },
            xray: { t: "The X-ray shows long tooth roots too. The mouth check already told you." }
          },
          dx: { q: "What's wrong with Thumper?",
            a: ["His teeth have grown too long", "Fleas", "A broken leg"], right: 0,
            why: "A rabbit's teeth never stop growing. If they get too long, eating hurts." },
          tx: { q: "How do you treat it?",
            a: ["Trim his teeth so he can eat again", "Give him chocolate", "Put a cast on his mouth"], right: 0,
            why: "Once his teeth are the right length, he can chew and eat again." },
          care: { q: "How do you stop it happening again?",
            a: ["Lots of hay every day, because chewing hay wears teeth down", "Only soft food and no hay", "Brush his teeth with toothpaste"], right: 0,
            why: "Hay is a rabbit's toothbrush. All that chewing keeps their teeth short." },
          win: "Not eating plus dribbling pointed straight at the mouth. Spot on!" },
        { name: "Coco and the chocolate", kind: "case", sp: "dog", pet: "Coco",
          owner: "Coco ate half a block of chocolate off the kitchen bench! Now she's shaking and running around like crazy.",
          checks: {
            heart: heart("dog", 190, { t: "Way too fast!", key: true }),
            temp: temp("dog", 39.6, { t: "A bit too hot." }),
            eyes: { t: "Big, wide pupils.", bad: true },
            mouth: { t: "Her breath smells of chocolate!", bad: true },
            skin: { t: "Normal skin and fur." },
            weigh: { t: "8 kg. A small dog, so a little chocolate is a lot for her." },
            xray: { t: "Chocolate doesn't show on an X-ray. There's no time to waste!", waste: true }
          },
          dx: { q: "What's wrong with Coco?",
            a: ["Chocolate poisoning", "Overgrown teeth", "Fleas"], right: 0,
            why: "Chocolate has a chemical in it that's poisonous to dogs. It makes their heart race. Dark chocolate is the worst." },
          tx: { q: "What do you do?",
            a: ["Treat her fast: medicine to empty her tummy, and help for her heart", "Wait a week and see", "Give her more chocolate to calm her down"], right: 0,
            why: "The sooner the chocolate is out, the less of the poison gets into her body." },
          care: { q: "How does the family stop this happening again?",
            a: ["Keep chocolate, grapes and onions where dogs can't reach", "Share lollies with her as a treat", "Only give her milk chocolate"], right: 0,
            why: "Chocolate, grapes, raisins and onions can all make dogs very sick." },
          win: "A racing heart and chocolate breath. You worked it out fast, and fast is what Coco needed." }
      ],
      lesson: {
        title: "You finished What's Wrong?",
        life: "Doctors work the same way: they listen to you, pick the right checks, and use the clues to find the cause.",
        job: "\u{1F469}\u{200D}\u{2695}\u{FE0F} Vet nurses help vets with checks and operations, look after animals in hospital, and give their medicines."
      }
    },
    {
      id: 3,
      emoji: "\u{1F998}",
      kicker: "Chapter 3",
      name: "Wildlife Rescue",
      color: "#b5651d",
      says: "Australia's wild animals need special care. Wildlife carers nurse them back to health and set them free.",
      more: [
        "<b>Never pick up a wild animal yourself.</b> It can bite or scratch, and it's scared of you.",
        "<b>Never touch a bat.</b> Some Australian bats carry a dangerous virus.",
        "Tell a grown-up to call a <b>wildlife rescue</b> group. They'll know what to do."
      ],
      grown: "Injured and orphaned native animals in Australia are cared for by licensed wildlife rehabilitators. Chlamydia is a major threat to wild koalas, and a leading cause of blindness and infertility. Any bat bite or scratch needs urgent medical advice because of Australian bat lyssavirus.",
      levels: [
        { name: "A joey without mum", kind: "case", sp: null, animal: "\u{1F998}", pet: "the joey",
          owner: "A family found this joey in its mum's pouch beside the road. Mum didn't make it. The joey is shaking.",
          checks: {
            heart: { t: "Fast and fluttery. It's frightened." },
            temp: { t: "Cold! A joey can't keep itself warm without mum's pouch.", bad: true, key: true },
            eyes: { t: "Open and alert." },
            mouth: { t: "Pink and healthy." },
            skin: { t: "Hardly any fur yet, just pink skin. It's very young.", bad: true },
            weigh: { t: "900 g. Small enough to still live in a pouch." },
            xray: { t: "No broken bones. Lucky joey!" }
          },
          dx: { q: "What does this joey need most?",
            a: ["It's cold and scared, and needs a pouch like mum's", "It has fleas", "It has chocolate poisoning"], right: 0,
            why: "A young joey can't make enough of its own heat. Mum's pouch kept it warm." },
          tx: { q: "What do you do first?",
            a: ["Tuck it into a warm cloth pouch, somewhere dark and quiet", "Put it on the grass in the sun", "Give it a bath"], right: 0,
            why: "Warm, dark and quiet is like being back in mum's pouch. It helps the joey calm down." },
          care: { q: "What does the joey eat?",
            a: ["Special joey milk from a bottle, fed by a wildlife carer", "Cow's milk from the fridge", "Bread and water"], right: 0,
            why: "Cow's milk makes joeys very sick. Wildlife carers use special milk made for joeys, for many months, until they can hop free." },
          win: "Warm, quiet and the right milk. A wildlife carer will raise this joey until it's ready for the bush." },
        { name: "Koala with sore eyes", kind: "case", sp: null, animal: "\u{1F428}", pet: "the koala",
          owner: "A ranger brought in this koala. It was sitting on the ground, and its eyes look sore.",
          checks: {
            heart: { t: "Normal." },
            temp: { t: "Normal." },
            eyes: { t: "Red, swollen and crusty. It can hardly see.", bad: true, key: true, pic: "\u{1F441}\u{FE0F}" },
            mouth: { t: "Good teeth for chewing gum leaves." },
            skin: { t: "Dirty, scruffy fur." , bad: true },
            weigh: { t: "Thin. Lighter than a healthy koala.", bad: true },
            xray: { t: "No broken bones." }
          },
          dx: { q: "What's wrong with the koala?",
            a: ["An eye infection called chlamydia", "A broken leg", "Overgrown teeth"], right: 0,
            why: "Chlamydia is a germ that makes lots of wild koalas sick. It can make them blind, so they can't find food." },
          tx: { q: "How do you treat it?",
            a: ["Medicine to kill the germs, and eye drops, at a koala hospital", "Put it straight back up a tree", "Wash its eyes with soap"], right: 0,
            why: "The medicine fights the germ. It takes a few weeks." },
          care: { q: "What happens while it gets better?",
            a: ["Fresh gum leaves every day, then back to the bush where it was found", "Keep it as a pet", "Feed it lettuce"], right: 0,
            why: "Koalas only eat certain gum leaves. When it's well, it goes home to its own trees." },
          win: "Sore eyes were the big clue. Koala hospitals in Australia treat hundreds of koalas like this every year." },
        { name: "Tangled turtle", kind: "case", sp: null, animal: "\u{1F422}", pet: "the turtle",
          owner: "Some kids found this sea turtle on the beach, tangled in fishing line. It's very tired.",
          checks: {
            heart: { t: "Slow. Turtles' hearts are slow anyway, but this one is worn out." },
            temp: { t: "Turtles are cold-blooded. They're only as warm as the water around them." },
            eyes: { t: "Tired eyes." },
            mouth: { t: "Fishing line is coming out of its mouth!", bad: true },
            skin: { t: "Line wrapped tight around one flipper.", bad: true },
            weigh: { t: "Lighter than it should be. It hasn't been able to eat.", bad: true },
            xray: { t: "There's a fishing hook stuck in its throat!", bad: true, key: true, pic: "\u{1FA9D}" }
          },
          dx: { q: "What's wrong with the turtle?",
            a: ["It swallowed a fishing hook and got tangled in line", "It has fleas", "It has a cold"], right: 0,
            why: "The line and the X-ray tell the story: a hook inside, and line outside." },
          tx: { q: "How do you treat it?",
            a: ["Cut off the line carefully and take out the hook in an operation", "Pull hard on the line", "Put it straight back in the sea"], right: 0,
            why: "Pulling could hurt it inside. Vets take the hook out gently, while the turtle is asleep." },
          care: { q: "What happens next, and how can you help turtles?",
            a: ["Rest in a hospital pool, then back to the sea. And always pick up fishing line and rubbish at the beach", "Keep it in the bath at home", "Feed it chips"], right: 0,
            why: "Rubbish in the sea hurts turtles, birds and dolphins. Picking it up saves lives." },
          win: "The X-ray found the hook. And now you know how to help: pick up fishing line and rubbish at the beach." }
      ],
      lesson: {
        title: "You finished Wildlife Rescue!",
        life: "If you find a hurt wild animal, don't touch it. Keep pets away, and tell a grown-up to call a wildlife rescue group.",
        job: "\u{1F998} Wildlife carers raise orphaned joeys and nurse hurt animals until they can go back to the wild."
      }
    }
  ];

  VC.JOBS = [
    { emoji: "\u{1FA7A}", name: "Vet", does: "Checks, treats and operates on sick and hurt animals, and helps keep healthy ones healthy." },
    { emoji: "\u{1F469}\u{200D}\u{2695}\u{FE0F}", name: "Vet nurse", does: "Helps the vet, looks after animals in hospital, and teaches families how to care for their pets." },
    { emoji: "\u{1F998}", name: "Wildlife carer", does: "Raises orphaned joeys and looks after hurt wild animals until they can go back to the bush." }
  ];

  // One question from each chapter is picked each time, so a replay feels new.
  VC.QUIZ = [
    [
      { emoji: "\u{1F493}", q: "Which animal has the fastest heartbeat?",
        a: ["A mouse", "An elephant", "A horse"], right: 0,
        why: "Small animals have fast hearts. A mouse's beats about 600 times a minute!" },
      { emoji: "\u{1F321}\u{FE0F}", q: "A dog's temperature is 38.8 \u{00B0}C. Is that a fever?",
        a: ["No, that's normal for a dog", "Yes, it's a fever", "No, it's too cold"], right: 0,
        why: "Dogs are warmer than people. 38.8 \u{00B0}C is normal for a dog, but a fever for you." }
    ],
    [
      { emoji: "\u{1F36B}", q: "Which food is poisonous to dogs?",
        a: ["Chocolate", "Carrots", "Plain rice"], right: 0,
        why: "Chocolate has a chemical that's poisonous to dogs. Keep it well out of reach." },
      { emoji: "\u{1F407}", q: "Why do rabbits need lots of hay?",
        a: ["Chewing hay wears their teeth down", "Hay makes them fluffy", "Only to sleep on"], right: 0,
        why: "A rabbit's teeth never stop growing. Chewing hay keeps them short." }
    ],
    [
      { emoji: "\u{1F987}", q: "You find a bat on the ground. What do you do?",
        a: ["Don't touch it. Tell a grown-up to call wildlife rescue", "Pick it up and take it home", "Poke it with a stick"], right: 0,
        why: "Some Australian bats carry a dangerous virus. Never touch a bat." },
      { emoji: "\u{1F998}", q: "What should an orphaned joey drink?",
        a: ["Special joey milk", "Cow's milk", "Lemonade"], right: 0,
        why: "Cow's milk makes joeys very sick. Wildlife carers use special milk made for joeys." }
    ]
  ];
})();
