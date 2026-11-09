/* Friendship Town - the 30 lessons: one per idea from the book, in kid words. */
/* Content only; ui.js and app.js do the drawing and the scoring.              */
"use strict";
window.FT = window.FT || {};

FT.CHAPTERS = [
  {
    id: "street", emoji: "🏠", color: "#e07a1f", kicker: "Part 1",
    place: "Maple Street", name: "The Friendly Basics",
    says: "Be kind about mistakes, say thanks, and think about what other people want.",
    grown: "The first part covers the starting habits of getting along: avoiding blame and complaining, giving honest appreciation, and noticing what the other person wants.",
    lessons: [
      {
        id: "p1-1", emoji: "🤐", name: "No moaning, no blaming",
        tip: "Fix it kindly. Don't blame.",
        grown: "Don't criticise, condemn or complain.",
        type: "scene",
        intro: "Your little brother Max has made a mess. How do you react?",
        who: { name: "Max", emoji: "👦" }, where: "🏠",
        rounds: [
          { say: "Max: “Oops! My juice tipped over. Your drawing is all wet.”",
            choices: [
              { text: "“It's okay. Let's dry it and fix it together.”", good: 2,
                reply: "Max: “Thanks! I'll get the towel!”",
                why: "Fixing the problem is better than blaming. Blaming only makes people feel bad." },
              { text: "Say “Be more careful next time,” then fix it yourself.", good: 1,
                reply: "Max: “Okay...” He looks a bit sad.",
                why: "You fixed it, but the lecture still stings. He already knows he made a mess." },
              { text: "“You always wreck my stuff! You're so clumsy!”", good: 0,
                reply: "Max: “I'm not clumsy! I hate you!”",
                why: "Name-calling makes people cross, not careful. It fixes nothing." }
            ] },
          { say: "You trip over Max's shoes in the hall. Max is watching TV.",
            choices: [
              { text: "“Max, can you move your shoes? I nearly fell.”", good: 2,
                reply: "Max: “Sorry! Moving them now.”",
                why: "Say what you need in a calm way. No blaming words." },
              { text: "Move the shoes yourself and grumble about it.", good: 1,
                reply: "Max: “Why are you grumpy?”",
                why: "Moving them solves it, but grumbling spoils the mood." },
              { text: "“Max! You're so messy! I'm telling Mum!”", good: 0,
                reply: "Max: “Not fair! I'll tell on you too!”",
                why: "Moaning and telling tales starts a fight. Calm asking works better." }
            ] }
        ]
      },
      {
        id: "p1-2", emoji: "💐", name: "Say thanks and mean it",
        tip: "Notice real good things. Say them.",
        grown: "Give honest and sincere appreciation.",
        type: "scene",
        intro: "Mrs Rossi next door grows the best roses on Maple Street.",
        who: { name: "Mrs Rossi", emoji: "👵" }, where: "🌹",
        rounds: [
          { say: "Mrs Rossi is watering her roses. She gives you a small wave.",
            choices: [
              { text: "“Your roses smell amazing! The red ones are my favourite.”", good: 2,
                reply: "Mrs Rossi: “Oh, you noticed! I grew those from seed.”",
                why: "Say something true and specific. Real thanks feels warm." },
              { text: "“Nice garden.”", good: 1,
                reply: "Mrs Rossi: “Thank you, dear.” She smiles a little.",
                why: "It's kind, but it's quick. Saying exactly what you like feels better." },
              { text: "“Roses are boring. My mum likes tulips.”", good: 0,
                reply: "Mrs Rossi: “Oh. Well. Tulips are nice too.”",
                why: "Putting down something she loves hurts her feelings." }
            ] },
          { say: "Mrs Rossi gives you a cookie. It is a bit burnt on the bottom.",
            choices: [
              { text: "“Thank you! The top is so crunchy. Thanks for thinking of me.”", good: 2,
                reply: "Mrs Rossi: “You're a sweetheart. I'll bake more!”",
                why: "You found something true to praise, and you thanked her for the kindness." },
              { text: "Eat it quickly and say “Thanks.”", good: 1,
                reply: "Mrs Rossi: “You're welcome, dear.”",
                why: "Polite, but she may not know you liked it. Say a little more." },
              { text: "“It's burnt. I'll pass.”", good: 0,
                reply: "Mrs Rossi: “Oh dear. I'm sorry.” Her smile drops.",
                why: "Honest isn't the same as unkind. She baked it for you." }
            ] }
        ]
      },
      {
        id: "p1-3", emoji: "🧠", name: "Think about what they want",
        tip: "Ask: what do they want? Then find a deal.",
        grown: "Think about what the other person wants, and help them get it while you get what you need.",
        type: "scene",
        intro: "You and Max both want something. Can you both get it?",
        who: { name: "Max", emoji: "👦" }, where: "🏠",
        rounds: [
          { say: "You want Max to tidy the toy room. Max wants to play his racing game.",
            choices: [
              { text: "“Let's tidy fast. Then we can play your racing game.”", good: 2,
                reply: "Max: “Deal! Race you to the toy box!”",
                why: "You thought about what he wants. Now tidying gets him closer to it." },
              { text: "“Please tidy up. Mum said so.”", good: 1,
                reply: "Max: “Fine...” He drags his feet.",
                why: "It's fair, but there is nothing in it for him. So he tidies slowly." },
              { text: "“Tidy up now! I want this room clean!”", good: 0,
                reply: "Max: “No! You're not the boss!”",
                why: "He only hears what you want. People help more when they can win too." }
            ] },
          { say: "Max wants to ride your scooter. You want quiet time to read.",
            choices: [
              { text: "“Ride it for ten minutes. Then I get quiet reading time. Deal?”", good: 2,
                reply: "Max: “Deal! I'll even set the timer!”",
                why: "You each get something you want. That's a fair swap." },
              { text: "“Fine, but be quick and don't scratch it.”", good: 1,
                reply: "Max: “Okay, okay.” He rides off a bit worried.",
                why: "He gets his turn, but your quiet time isn't sorted yet." },
              { text: "“No. Go away. I'm busy.”", good: 0,
                reply: "Max: “You're mean!” He stomps off and slams the door.",
                why: "Ignoring what he wants leaves both of you unhappy." }
            ] }
        ]
      }
    ]
  },

  {
    id: "school", emoji: "🏫", color: "#1e88e5", kicker: "Part 2",
    place: "Sunny Hill School", name: "Making Friends",
    says: "Be curious, smile, learn names and really listen. That is how friends are made.",
    grown: "This part covers six ways to be liked: genuine interest in others, smiling, remembering names, listening well, talking about what interests the other person, and making people feel valued.",
    lessons: [
      {
        id: "p2-1", emoji: "🔍", name: "Be curious about people",
        tip: "Ask real questions. Care about the answer.",
        grown: "Become genuinely interested in other people.",
        type: "scene",
        intro: "It's lunchtime at your new school. Someone is sitting alone.",
        who: { name: "Leo", emoji: "🧒" }, where: "🏫",
        rounds: [
          { say: "Leo is sitting alone at lunch. He is drawing a big dinosaur.",
            choices: [
              { text: "“Cool dino! What kind is it? Why do you like them?”", good: 2,
                reply: "Leo: “It's a Stegosaurus! Do you want to see more?”",
                why: "Real questions show you care about him. People love that." },
              { text: "“Nice.” Then eat your sandwich.", good: 1,
                reply: "Leo: “Thanks.” He goes back to his drawing.",
                why: "Friendly, but a question would have started a chat." },
              { text: "“Dinosaurs are for little kids. Want to play tag?”", good: 0,
                reply: "Leo: “No thanks.” He covers his drawing.",
                why: "Putting down what someone loves shuts the door." }
            ] },
          { say: "Leo: “It's a Stegosaurus. The spikes on its tail were as long as a bike!”",
            choices: [
              { text: "“Whoa! Were the spikes for fighting? How do you know?”", good: 2,
                reply: "Leo grins. “I read it in a book. Want to borrow it?”",
                why: "Asking more shows you were really listening." },
              { text: "“Cool. Once my cat did a funny thing...”", good: 1,
                reply: "Leo: “Oh. Okay.” He seems a bit let down.",
                why: "Swapping to your story too fast leaves him with nothing to share." },
              { text: "“I saw a better dinosaur in a movie once.”", good: 0,
                reply: "Leo: “That's not real, though.” He goes quiet.",
                why: "Topping his story makes it about you, not him." }
            ] }
        ]
      },
      {
        id: "p2-2", emoji: "😊", name: "Smile!",
        tip: "A real smile says hello.",
        grown: "Smile.",
        type: "smile",
        intro: "Neighbours pop up on Maple Street. Smile and wave at each one!",
        where: "🏘️"
      },
      {
        id: "p2-3", emoji: "🏷️", name: "Remember names",
        tip: "A name is a gift. Use it.",
        grown: "Remember that a person's name is the sweetest sound to them, and use it.",
        type: "names",
        intro: "Meet five new classmates. Try to remember each name.",
        where: "🏫",
        kids: [
          { name: "Mia", emoji: "👧", fact: "loves painting" },
          { name: "Leo", emoji: "🧒", fact: "loves dinosaurs" },
          { name: "Sam", emoji: "🧑‍🦱", fact: "plays chess" },
          { name: "Priya", emoji: "👱‍♀️", fact: "scores lots of goals" },
          { name: "Zara", emoji: "👩‍🦱", fact: "has a pet rabbit" }
        ]
      },
      {
        id: "p2-4", emoji: "👂", name: "Listen well",
        tip: "Listen first. Let friends talk about them.",
        grown: "Be a good listener and encourage others to talk about themselves.",
        type: "listen",
        intro: "Priya has big news. Listen closely to her stories.",
        who: { name: "Priya", emoji: "👧🏽" }, where: "🛝",
        stories: [
          { lines: [
              "Yesterday I had my first football match.",
              "My boots were brand new and bright orange.",
              "I scored a goal in the very last minute!",
              "Have you ever scored a goal?" ],
            question: "What colour were her boots?",
            answers: ["Orange", "Blue", "Green"] },
          { lines: [
              "My grandma gave me a puppy for my birthday.",
              "He is tiny and brown with one white ear.",
              "I named him Pickle because he stole a pickle.",
              "Do you have a pet?" ],
            question: "What is the puppy called?",
            answers: ["Pickle", "Biscuit", "Peanut"] },
          { lines: [
              "On Saturday we went to the beach.",
              "I built a huge sandcastle with a moat.",
              "Then a big wave washed it all away!",
              "What would you have done?" ],
            question: "What washed the sandcastle away?",
            answers: ["A wave", "A dog", "The wind"] }
        ]
      },
      {
        id: "p2-5", emoji: "🎯", name: "Talk about their world",
        tip: "Talk about what they love.",
        grown: "Talk in terms of the other person's interests.",
        type: "scene",
        intro: "On the school bus, shy Sam sits alone with a small chess set.",
        who: { name: "Sam", emoji: "🧑" }, where: "🚌",
        rounds: [
          { say: "Sam is quiet. He holds a little chess set on his lap.",
            choices: [
              { text: "“Is that a travel chess set? What's your best move?”", good: 2,
                reply: "Sam: “It's called a fork! Want me to show you?”",
                why: "He lit up because you asked about his favourite thing." },
              { text: "“Want to play tag at lunch?”", good: 1,
                reply: "Sam: “Um. Maybe.” He holds his chess set tighter.",
                why: "It's friendly, but it's not about what he loves." },
              { text: "Tell him all about your favourite video game.", good: 0,
                reply: "Sam: “Oh. Um. Okay.” He looks out of the window.",
                why: "Talking about what you like can leave a shy friend out." }
            ] },
          { say: "Sam: “I'm learning a trick. It's called a fork. It wins pieces.”",
            choices: [
              { text: "“Cool! Could you show me one trick at lunch?”", good: 2,
                reply: "Sam smiles for the first time. “Sure! Sit with me.”",
                why: "You showed you care about his world. Now he wants you in it." },
              { text: "“Nice. Chess looks hard and slow, though.”", good: 1,
                reply: "Sam: “It's not slow... sometimes.”",
                why: "You were friendly, but the last bit made it feel like a put-down." },
              { text: "“Let's play something with more running.”", good: 0,
                reply: "Sam: “Oh. I'd rather stay here.”",
                why: "Switching to your fun first shows you didn't care about his." }
            ] }
        ]
      },
      {
        id: "p2-6", emoji: "🌟", name: "Make others feel special",
        tip: "Say what's great about them. Mean it.",
        grown: "Make the other person feel important, and do it sincerely.",
        type: "scene",
        intro: "Mia is good at art. Class is about to start.",
        who: { name: "Mia", emoji: "👧" }, where: "🎨",
        rounds: [
          { say: "Mia pins her rainforest painting on the wall. The frogs look so real.",
            choices: [
              { text: "“The frogs look so real! How did you paint the shiny skin?”", good: 2,
                reply: "Mia: “I used a tiny dot of white paint! I'll show you.”",
                why: "Being specific shows you truly looked. It makes people feel proud." },
              { text: "“Good job, Mia.”", good: 1,
                reply: "Mia: “Thanks.” She smiles a bit.",
                why: "Kind, but short. Say exactly what you like." },
              { text: "“Mine is better, but yours is okay.”", good: 0,
                reply: "Mia: “Oh.” She stops smiling.",
                why: "Showing off takes the shine off someone else's work." }
            ] },
          { say: "The class needs someone to choose colours for a banner. Mia is shy to put up her hand.",
            choices: [
              { text: "“Mia, you're great with colours. Would you pick them?”", good: 2,
                reply: "Mia: “Really? Okay! I'll do blue and gold!”",
                why: "You pointed to a real skill. Feeling needed helps shy people step up." },
              { text: "Pick the colours yourself to save time.", good: 1,
                reply: "Mia: “Oh... okay.” She slumps a little.",
                why: "Quick, but Mia missed a chance to shine." },
              { text: "“You'd never pick. I'll do it.”", good: 0,
                reply: "Mia: “That's not nice.” She looks down.",
                why: "Deciding for someone makes them feel small." }
            ] }
        ]
      }
    ]
  },

  {
    id: "club", emoji: "⚽", color: "#8e44ad", kicker: "Part 3",
    place: "Saturday Football Club", name: "Getting Along",
    says: "Don't fight to win. Listen, say sorry fast, and let others share their ideas.",
    grown: "This is the longest part. It covers avoiding arguments, respecting opinions, owning mistakes, starting friendly, agreement, listening, shared ideas, empathy, trusting people's good side, demonstrating, and friendly challenge.",
    lessons: [
      {
        id: "p3-1", emoji: "🕊️", name: "Skip the argument",
        tip: "You can't win a quarrel. Skip it.",
        grown: "The only way to get the best of an argument is to avoid it.",
        type: "scene",
        intro: "Noah loves to say who's right at football club.",
        who: { name: "Noah", emoji: "👦🏻" }, where: "⚽",
        rounds: [
          { say: "Noah: “Pizza is the best food ever. Anyone who says different is wrong!”",
            choices: [
              { text: "“I like pizza too. Pasta is my other favourite.”", good: 2,
                reply: "Noah: “Ha! Pasta is good too. Pizza first, though!”",
                why: "You found something you both like. No fight, and you both feel good." },
              { text: "Shrug and talk about the match instead.", good: 1,
                reply: "Noah: “Yeah, the match! We'll win!”",
                why: "You dodged the fight, which is good. Finding common ground is better." },
              { text: "“No way! Pasta is way better. Prove me wrong!”", good: 0,
                reply: "Noah: “Pizza! Pizza! Pizza!” You both get grumpy.",
                why: "An argument has no winner. You both leave cross." }
            ] },
          { say: "Noah: “That ball was in! We scored!” You saw it go wide.",
            choices: [
              { text: "“Hard to tell. Let's ask Coach Jo and play on.”", good: 2,
                reply: "Noah: “Good idea. Let's go!”",
                why: "You let someone fair decide, and the game keeps moving." },
              { text: "“Maybe. But I think it was out.”", good: 1,
                reply: "Noah: “It was in!” He frowns.",
                why: "You kept calm, but you still pushed your side." },
              { text: "“Wrong! I've got better eyes. It was wide!”", good: 0,
                reply: "Noah: “No, you don't!” The shouting starts.",
                why: "Needing to be right made it a fight, and nobody wins that." }
            ] }
        ]
      },
      {
        id: "p3-2", emoji: "🤝", name: "Respect other ideas",
        tip: "You can disagree without saying “wrong”.",
        grown: "Show respect for the other person's opinions. Never say “you're wrong.”",
        type: "scene",
        intro: "Priya has strong opinions about football. You see it differently.",
        who: { name: "Priya", emoji: "👧🏽" }, where: "⚽",
        rounds: [
          { say: "Priya: “Striker is the best position. Defenders are boring.” You're a defender.",
            choices: [
              { text: "“I see why. Scoring is fun! I like stopping goals, though.”", good: 2,
                reply: "Priya: “Ha! I guess we need defenders too.”",
                why: "You respected her view and shared yours. She listened to you back." },
              { text: "“Hmm, I disagree, but okay.”", good: 1,
                reply: "Priya: “Oh. Okay.” It goes a bit awkward.",
                why: "You were honest, but a little flat. Showing you get her view is better." },
              { text: "“That's wrong! Defenders matter more!”", good: 0,
                reply: "Priya: “They do not!” She folds her arms.",
                why: "Telling someone they're wrong makes them defend their view harder." }
            ] },
          { say: "Priya: “Wearing red socks makes us win. Everyone must wear them!”",
            choices: [
              { text: "“Fun! What happened the last time you wore them?”", good: 2,
                reply: "Priya: “We won 3-0! ... Okay, we also played well.”",
                why: "A friendly question lets her think it through herself." },
              { text: "“Sure,” but roll your eyes.", good: 1,
                reply: "Priya: “Did you just roll your eyes?”",
                why: "You said okay, but your face said “wrong”. People notice." },
              { text: "“Luck isn't real. That's silly.”", good: 0,
                reply: "Priya: “It's not silly!” She stomps off.",
                why: "Even a true thing hurts when it's said as a put-down." }
            ] }
        ]
      },
      {
        id: "p3-3", emoji: "🙋", name: "Say sorry, fast",
        tip: "Own it quickly. Say sorry.",
        grown: "If you are wrong, admit it quickly and clearly.",
        type: "scene",
        intro: "You made a mistake. What do you do next?",
        who: { name: "Zara", emoji: "👧🏾" }, where: "⚽",
        rounds: [
          { say: "Zara: “You said you'd bring my spare gloves. Where are they?” You forgot.",
            choices: [
              { text: "“I forgot. Sorry! You can use my gloves today.”", good: 2,
                reply: "Zara: “Thanks! That's kind. Everyone forgets sometimes.”",
                why: "Owning it fast and fixing it takes the sting out." },
              { text: "“Maybe Dad packed the wrong bag?”", good: 1,
                reply: "Zara: “Oh. So you don't have them?” She sighs.",
                why: "Blaming someone else is a half-sorry. Say it was you." },
              { text: "“I never said that. You must've dreamed it.”", good: 0,
                reply: "Zara: “You did! I remember!” She glares.",
                why: "Saying it wasn't you makes things much worse. She knows." }
            ] },
          { say: "Later, you kick the ball into your own goal. Zara raises her eyebrows.",
            choices: [
              { text: "“Oops, my bad! Sorry, Zara. I'll watch out.”", good: 2,
                reply: "Zara laughs. “Happens! Next one, I'll save.”",
                why: "Quick and honest. A smile helps too." },
              { text: "Say nothing and hope she forgets.", good: 1,
                reply: "Zara: “That was weird.” The game goes on.",
                why: "Staying quiet leaves a gap. A quick sorry fills it." },
              { text: "“The wind did that! Not my fault!”", good: 0,
                reply: "Zara: “There's no wind.” She shakes her head.",
                why: "Excuses sound silly. Saying “my bad” is easier." }
            ] }
        ]
      },
      {
        id: "p3-4", emoji: "🌤️", name: "Start in a friendly way",
        tip: "Begin kind. Then ask.",
        grown: "Begin in a friendly way.",
        type: "scene",
        intro: "You want something from Noah. How you start matters.",
        who: { name: "Noah", emoji: "👦🏻" }, where: "⚽",
        rounds: [
          { say: "Noah keeps dribbling and never passes. You're free in front of the goal.",
            choices: [
              { text: "“Great dribbling, Noah! Pass to me next time. We'll score.”", good: 2,
                reply: "Noah: “Ha! Okay! Get open!”",
                why: "A kind start makes him want to listen, not defend himself." },
              { text: "Wave your arms and shout “Pass it!”", good: 1,
                reply: "Noah: “I'm trying!” He passes late, grumpy.",
                why: "He passed, but shouting made it a cross moment." },
              { text: "“You're such a ball hog! Nobody likes it!”", good: 0,
                reply: "Noah: “Well, I'm not passing now!”",
                why: "Starting with an attack makes people dig in." }
            ] },
          { say: "At half time, you want to try the wing instead. Noah is playing there.",
            choices: [
              { text: "“You've been great there. Want to swap so I can try the wing?”", good: 2,
                reply: "Noah: “Sure! My turn in the middle.”",
                why: "Warm words first, then a clear ask. Easy to say yes." },
              { text: "“Swap with me. It's my turn.”", good: 1,
                reply: "Noah: “Hmm, okay...” He isn't happy.",
                why: "It's clear, but it sounds bossy. A kind start would help." },
              { text: "“Swap now, or I'll stop passing to you.”", good: 0,
                reply: "Noah: “Then I won't pass to you either!”",
                why: "Threats start a battle. Neither of you gets what you want." }
            ] }
        ]
      },
      {
        id: "p3-5", emoji: "👍", name: "Start with yes",
        tip: "Start with things you agree on.",
        grown: "Get the other person saying “yes, yes” immediately.",
        type: "ladder",
        intro: "Climb the ladder. Start with easy yes questions about things you both like.",
        who: { name: "Sam", emoji: "🧑" }, where: "🎭",
        goal: "You want Sam to try the school play with you.",
        rungs: [
          { yes: "“You like stories, right, Sam?”",
            yesReply: "Sam: “Yes! I read every night.”",
            no: "“Why are you so quiet? Join the play!”",
            noReply: "Sam: “No. Leave me alone.”" },
          { yes: "“Do you think plays are fun to watch?”",
            yesReply: "Sam: “Yes, plays are cool.”",
            no: "“Don't you think hiding away is boring?”",
            noReply: "Sam: “No. I like it.” He looks away." },
          { yes: "“Would you like a job where you help, like the lights?”",
            yesReply: "Sam: “Oh yes! That sounds good.”",
            no: "“You have to try acting. There's no other choice.”",
            noReply: "Sam: “No. I'm not doing that.”" },
          { yes: "“Want to sign up with me for lights? We'd be a team.”",
            yesReply: "Sam: “Yes! Okay, let's do it!”",
            no: "“Sign up now, or I'll ask someone else.”",
            noReply: "Sam: “No. Ask them then.”" }
        ]
      },
      {
        id: "p3-6", emoji: "💬", name: "Let them talk",
        tip: "Ask. Listen. Don't talk over.",
        grown: "Let the other person do a great deal of the talking.",
        type: "scene",
        intro: "Zara is in a chatty mood. You have plenty to say too.",
        who: { name: "Zara", emoji: "👧🏾" }, where: "⚽",
        rounds: [
          { say: "Zara needs a name for the team. You already have a really good one.",
            choices: [
              { text: "“What names do you like? I'd love to hear your ideas.”", good: 2,
                reply: "Zara: “Ooh! I like Lightning Frogs... or Rocket Ducks!”",
                why: "Asking first gets her thinking. Your idea can come later." },
              { text: "Share your idea, then ask what she thinks.", good: 1,
                reply: "Zara: “That's good... I guess.” She seems unsure.",
                why: "Okay, but your idea took the air out of hers." },
              { text: "Tell her your name idea, then three more, non-stop.", good: 0,
                reply: "Zara: “Um, okay.” She stops talking.",
                why: "Too many words from you leave no room for her." }
            ] },
          { say: "Zara starts explaining why she loves being the goalie. It takes a while.",
            choices: [
              { text: "Nod, and ask “What's the hardest save you've made?”", good: 2,
                reply: "Zara: “A shot at the top corner! I flew!”",
                why: "Keep her talking. People feel great when someone wants to hear." },
              { text: "Wait, then jump in with your own goalie story.", good: 1,
                reply: "Zara: “Oh, yeah.” She goes quiet.",
                why: "She stopped half way. Let her finish her story first." },
              { text: "Cut in with “Yeah, yeah, listen to what happened to me!”", good: 0,
                reply: "Zara: “I was talking!” She frowns.",
                why: "Interrupting says “my story matters more”." }
            ] }
        ]
      },
      {
        id: "p3-7", emoji: "💡", name: "Make it their idea",
        tip: "Let them find the idea themselves.",
        grown: "Let the other person feel the idea is theirs.",
        type: "scene",
        intro: "You think the team needs a pre-match cheer. Priya is organiser.",
        who: { name: "Priya", emoji: "👧🏽" }, where: "⚽",
        rounds: [
          { say: "You think the team should do a cheer before matches. Priya is in charge.",
            choices: [
              { text: "“How could we get everyone pumped before a game?”", good: 2,
                reply: "Priya: “Ooh, what about a team cheer?”",
                why: "Ideas people find themselves are the ones they love most." },
              { text: "“We should do a cheer. I made one up!”", good: 1,
                reply: "Priya: “Maybe...” She isn't sure.",
                why: "It's an okay idea, but she didn't get to think of it herself." },
              { text: "“We're doing my cheer. I've decided.”", good: 0,
                reply: "Priya: “You can't just decide!”",
                why: "Bossing makes people push back, even when your idea is good." }
            ] },
          { say: "Priya: “A cheer could be fun!” You had one in your head already.",
            choices: [
              { text: "“Great idea! What words should it have?” Use hers.", good: 2,
                reply: "Priya: “Let's shout WE ARE FIRE!” Everyone loves it.",
                why: "You let it be hers. She'll try hard to make it work." },
              { text: "“I thought of that too! Use my words.”", good: 1,
                reply: "Priya: “Oh... okay.” She sounds a bit flat.",
                why: "You took the idea back. It was hers to enjoy." },
              { text: "“That was MY idea. I had it first.”", good: 0,
                reply: "Priya: “Fine, you do it, then.” She walks away.",
                why: "Who gets the credit matters less than getting the cheer." }
            ] }
        ]
      },
      {
        id: "p3-8", emoji: "👟", name: "Stand in their shoes",
        tip: "Ask: how would I feel?",
        grown: "Honestly try to see things from the other person's point of view.",
        type: "scene",
        intro: "Everyone else has gone home. You're waiting at the gate.",
        who: { name: "Dad", emoji: "👨" }, where: "🚗",
        rounds: [
          { say: "Dad is late to pick you up. You are the last kid at the club.",
            choices: [
              { text: "“Hi Dad! Was it a busy day?”", good: 2,
                reply: "Dad: “So busy! Thanks for waiting, mate.”",
                why: "You thought about his day. He felt understood, not told off." },
              { text: "Say “Hi,” and sit quietly.", good: 1,
                reply: "Dad: “Sorry I'm late.” It's a quiet ride.",
                why: "No fight, but no kind word either." },
              { text: "“You're late! Everyone went home ages ago!”", good: 0,
                reply: "Dad: “I came as fast as I could!” He sighs.",
                why: "You only saw your side. He's tired and trying." }
            ] },
          { say: "Dad looks tired. He forgot to buy dinner food. You were hoping for chips.",
            choices: [
              { text: "“Rough day. Let's make toast at home. I'll help.”", good: 2,
                reply: "Dad: “You're the best. Chips next week, deal.”",
                why: "You saw his tired face and helped. He'll remember that." },
              { text: "“Can we still get chips?”", good: 1,
                reply: "Dad: “Not tonight, mate.” He sounds worn out.",
                why: "It's honest, but it ignores how tired he is." },
              { text: "“But you promised us chips!”", good: 0,
                reply: "Dad: “Enough! Not tonight!” The car goes quiet.",
                why: "Only thinking about your wish makes a tired day worse." }
            ] }
        ]
      },
      {
        id: "p3-9", emoji: "🫶", name: "Be kind about feelings",
        tip: "Say: that sounds hard. Stay close.",
        grown: "Be sympathetic to the other person's ideas and desires.",
        type: "scene",
        intro: "Zara is having a really bad day. A kind friend sits close.",
        who: { name: "Zara", emoji: "👧🏾" }, where: "⚽",
        rounds: [
          { say: "Zara let in the winning goal. She is sitting on the bench with red eyes.",
            choices: [
              { text: "Sit beside her. “That's rough. I'd feel awful too.”", good: 2,
                reply: "Zara: “Thanks.” She wipes her eyes and leans a bit closer.",
                why: "Saying you get it helps more than fixing it." },
              { text: "“Don't cry. It's only a game.”", good: 1,
                reply: "Zara: “It's not only a game to me.” She sniffs.",
                why: "You meant well, but it shrinks her feelings." },
              { text: "“If you'd dived the other way, you'd have saved it.”", good: 0,
                reply: "Zara: “Thanks a lot.” She turns away.",
                why: "Pointing out what went wrong adds hurt." }
            ] },
          { say: "Zara: “I keep thinking about that goal. I let everyone down.”",
            choices: [
              { text: "“It stinks. Want to kick a ball, or just chat?”", good: 2,
                reply: "Zara: “Maybe kick a ball.” She slowly smiles.",
                why: "You named the feeling and let her choose what helps." },
              { text: "“Cheer up! Think about something else!”", good: 1,
                reply: "Zara: “I'm trying...” She still looks sad.",
                why: "Kind, but “cheer up” asks her to hide how she feels." },
              { text: "“Stop moping. Other goalies lose too.”", good: 0,
                reply: "Zara: “Go away.” She puts her head down.",
                why: "Telling someone to stop feeling something never works." }
            ] }
        ]
      },
      {
        id: "p3-10", emoji: "🌈", name: "See the good in people",
        tip: "Trust their good side.",
        grown: "Appeal to the nobler motives people have.",
        type: "scene",
        intro: "Noah can do the right thing. Help him find his good side.",
        who: { name: "Noah", emoji: "👦🏻" }, where: "⚽",
        rounds: [
          { say: "Noah doesn't want to help carry the cones. “Someone else can do it.”",
            choices: [
              { text: "“You're a real team player, Noah. We need you.”", good: 2,
                reply: "Noah: “Well... okay. I'll take the big bag!”",
                why: "Noticing his good side helps him live up to it." },
              { text: "“Everyone has to. Coach said.”", good: 1,
                reply: "Noah: “Fine.” He carries one cone, slowly.",
                why: "A rule works, but it doesn't make him want to help." },
              { text: "“Fine, you're lazy. We'll do it without you.”", good: 0,
                reply: "Noah: “Good! I don't care.” He turns away.",
                why: "Calling someone lazy makes them act that way." }
            ] },
          { say: "Noah finds a lost glove. It's a nice one. He wonders if he should keep it.",
            choices: [
              { text: "“You're a kind kid. Let's find who it belongs to.”", good: 2,
                reply: "Noah: “Yeah! Let's ask Coach.” He feels proud.",
                why: "Trusting him to do the right thing makes him want to." },
              { text: "“You'll get in trouble if you keep it.”", good: 1,
                reply: "Noah: “True.” He hands it in, but just to stay safe.",
                why: "Fear works, but doing it because it's kind works better." },
              { text: "“Go on, keep it. Nobody will know.”", good: 0,
                reply: "Noah puts it in his bag. Later, a kid asks about it.",
                why: "Easy choices that ignore doing right can cause trouble later." }
            ] }
        ]
      },
      {
        id: "p3-11", emoji: "🎬", name: "Show, don't just tell",
        tip: "Show it. A picture beats a speech.",
        grown: "Dramatise your ideas.",
        type: "scene",
        intro: "Coach Jo is busy. How do you make your idea clear?",
        who: { name: "Coach Jo", emoji: "🧑‍🦰" }, where: "⚽",
        rounds: [
          { say: "The goal net has a big hole. You want Coach Jo to fix it.",
            choices: [
              { text: "Take her to the net and roll a ball through the hole.", good: 2,
                reply: "Coach Jo: “Ha! That's a hole alright. I'll mend it today.”",
                why: "Seeing is believing. It's more real than words." },
              { text: "“The net is broken and needs fixing.”", good: 1,
                reply: "Coach Jo: “Hmm, I'll look at it sometime.”",
                why: "It's fine, but easy to forget. A show sticks." },
              { text: "“This club is so cheap. Nobody ever fixes anything.”", good: 0,
                reply: "Coach Jo: “Excuse me? We do our best.” She frowns.",
                why: "Complaining makes her defend herself instead of helping." }
            ] },
          { say: "Coach Jo: “Show me that passing triangle idea.” Words are tricky.",
            choices: [
              { text: "Set up cones and walk it through slowly with her.", good: 2,
                reply: "Coach Jo: “Oh, now I see! Let's try it.”",
                why: "Showing it with cones makes it clear and fun." },
              { text: "Explain it with words, twice, louder.", good: 1,
                reply: "Coach Jo: “I think I get it.” She looks puzzled.",
                why: "Louder isn't clearer. A drawing or demo helps more." },
              { text: "“It's easy. Just do it. I'm not explaining again.”", good: 0,
                reply: "Coach Jo: “That's not helpful.” She turns away.",
                why: "If people don't get it, show them. Don't get cross." }
            ] }
        ]
      },
      {
        id: "p3-12", emoji: "🏁", name: "Make it a fun challenge",
        tip: "Turn a chore into a game.",
        grown: "Throw down a challenge.",
        type: "scene",
        intro: "Boring jobs get done faster when they are a game.",
        who: { name: "Noah", emoji: "👦🏻" }, where: "⚽",
        rounds: [
          { say: "Practice is slow. Noah and the others are bored of passing drills.",
            choices: [
              { text: "“Race you! First team to 10 passes wins a cheer.”", good: 2,
                reply: "Noah: “You're on! We'll win!” Everyone speeds up.",
                why: "A game makes everyone want to try, with no nagging." },
              { text: "“Come on, try harder. It'll help us.”", good: 1,
                reply: "Noah: “Okay...” They try a bit harder.",
                why: "Okay, but it's like homework. A game is better." },
              { text: "“Concentrate, or we'll lose on Saturday!”", good: 0,
                reply: "Noah: “Stop being bossy!” The mood sinks.",
                why: "Scary warnings make drills feel like a chore." }
            ] },
          { say: "Noah is slow to pack the cones. You want the field cleared fast.",
            choices: [
              { text: "“Bet I can stack more cones than you in one minute!”", good: 2,
                reply: "Noah: “Ha! Bet you can't!” He flies.",
                why: "A fair challenge makes the job fun for both of you." },
              { text: "“Hurry up, we're all waiting.”", good: 1,
                reply: "Noah: “Okay, okay.” He speeds up a little.",
                why: "It works a bit, but nagging isn't fun." },
              { text: "“Hurry up, slowpoke!”", good: 0,
                reply: "Noah: “I'm not slow!” He stomps off.",
                why: "Put-downs make people slower, not faster." }
            ] }
        ]
      }
    ]
  },

  {
    id: "fair", emoji: "🎪", color: "#2a9d8f", kicker: "Part 4",
    place: "Fair Day", name: "Being a Good Leader",
    says: "A good captain is kind, fair and helps people do their best.",
    grown: "The final part is about leading without upsetting people: starting with praise, correcting gently, admitting your own errors, asking rather than ordering, protecting dignity, encouraging, and making helping feel good.",
    lessons: [
      {
        id: "p4-1", emoji: "🍋", name: "Start with praise",
        tip: "Say something true and good first.",
        grown: "Begin with praise and honest appreciation.",
        type: "scene",
        intro: "You're the captain of the class stall at the school fair.",
        who: { name: "Ollie", emoji: "🧒🏼" }, where: "🎪",
        rounds: [
          { say: "Ollie made the lemonade, but it's too sour. You have to tell him.",
            choices: [
              { text: "“You squeezed loads of lemons! Let's add more sugar.”", good: 2,
                reply: "Ollie: “Ooh, good idea. I'll fetch the sugar!”",
                why: "A true good thing first makes him happy to fix the rest." },
              { text: "“This is too sour. Add sugar.”", good: 1,
                reply: "Ollie: “Okay.” He looks a bit let down.",
                why: "Clear, but it's only a correction. No good news to go with it." },
              { text: "“Yuck. Did you even taste it? Do it again.”", good: 0,
                reply: "Ollie: “I did my best!” He crosses his arms.",
                why: "Starting with an attack makes him cross." }
            ] },
          { say: "Ollie put out the cups, but they're in a messy heap.",
            choices: [
              { text: "“You were quick with the cups! Let's line them up neatly.”", good: 2,
                reply: "Ollie: “Sure! I'll make it look cool!”",
                why: "Praise first, then a gentle fix. He'll try harder." },
              { text: "“The cups look messy.”", good: 1,
                reply: "Ollie: “Okay, I'll tidy them.” His shoulders drop.",
                why: "He'll fix it, but he feels small. A kind start helps." },
              { text: "“What a heap! I'd never do it like that.”", good: 0,
                reply: "Ollie: “Then do it yourself.” He walks off.",
                why: "Comparing yourself to him makes him want to quit." }
            ] }
        ]
      },
      {
        id: "p4-2", emoji: "🪄", name: "Fix mistakes gently",
        tip: "Hint kindly. Don't point and shout.",
        grown: "Call attention to people's mistakes indirectly.",
        type: "scene",
        intro: "A sign has a mistake. Be gentle.",
        who: { name: "Ruby", emoji: "👱‍♀️" }, where: "🎪",
        rounds: [
          { say: "Ruby wrote 50 dollars for a cupcake on the sign. Whoops.",
            choices: [
              { text: "“Your letters are great! Can you check the price once more?”", good: 2,
                reply: "Ruby: “Oh no! It should be 5! Thanks for telling me.”",
                why: "A gentle hint lets her spot the mistake herself." },
              { text: "“Ruby, the price is wrong. Fix it.”", good: 1,
                reply: "Ruby: “Okay, okay.” She grabs a pen.",
                why: "It's true and clear, but it feels like being told off." },
              { text: "Point and laugh: “50 dollars? Who'd pay that?!”", good: 0,
                reply: "Ruby: “Stop it!” Her cheeks go red.",
                why: "Laughing at a mistake hurts more than the mistake." }
            ] },
          { say: "Ruby rubbed the price out. Now the sign has a big smudge.",
            choices: [
              { text: "“Nice fix! Want a fresh bit of card so it shines?”", good: 2,
                reply: "Ruby: “Yes please! I'll make it extra neat.”",
                why: "You praised the fix and offered an easy next step." },
              { text: "“There's a smudge. Do it again.”", good: 1,
                reply: "Ruby: “Ugh, fine.” She sounds tired.",
                why: "She'll redo it, but the rush stings." },
              { text: "“Now it's worse. Give me the pen.”", good: 0,
                reply: "Ruby: “Take it, then!” She walks off.",
                why: "Taking over tells her you don't trust her." }
            ] }
        ]
      },
      {
        id: "p4-3", emoji: "🙊", name: "Own your mistakes first",
        tip: "Share your slip-ups, then help.",
        grown: "Talk about your own mistakes before criticising the other person.",
        type: "scene",
        intro: "Kai keeps making small mistakes. You've made some too.",
        who: { name: "Kai", emoji: "👦🏽" }, where: "🎪",
        rounds: [
          { say: "Kai keeps giving wrong change to customers.",
            choices: [
              { text: "“I got the change wrong on my first try too. Want a trick?”", good: 2,
                reply: "Kai: “Yes! I thought I was the only one.”",
                why: "Sharing your own slip-up helps him feel safe to learn." },
              { text: "“Kai, count the change carefully, okay?”", good: 1,
                reply: "Kai: “Okay.” He looks worried.",
                why: "It's fair, but he feels like the only one who gets it wrong." },
              { text: "“Kai! You messed up again. Can't you count?”", good: 0,
                reply: "Kai: “I can so!” His voice shakes.",
                why: "Blaming makes him nervous, and nervous means more mistakes." }
            ] },
          { say: "Kai turns up late to the stall. You were late yesterday too.",
            choices: [
              { text: "“I was late yesterday! Let's set a timer for tomorrow.”", good: 2,
                reply: "Kai: “Good plan! Sorry I'm late.”",
                why: "You went first about being late, so he can be honest too." },
              { text: "“Try to be on time tomorrow.”", good: 1,
                reply: "Kai: “Okay, I will.” He is quiet for a while.",
                why: "Fair, but it only points at his mistake, not yours." },
              { text: "“Late again! The captain can't wait for you.”", good: 0,
                reply: "Kai: “I said sorry!” He turns away.",
                why: "Acting like you never slip makes people want to hide." }
            ] }
        ]
      },
      {
        id: "p4-4", emoji: "❓", name: "Ask, don't order",
        tip: "Ask: what do you think?",
        grown: "Ask questions instead of giving direct orders.",
        type: "scene",
        intro: "Captains who ask get great ideas back.",
        who: { name: "Ruby", emoji: "👱‍♀️" }, where: "🎪",
        rounds: [
          { say: "The cake line is long. You want it to move faster.",
            choices: [
              { text: "“Ruby, what could we do to make the line move quicker?”", good: 2,
                reply: "Ruby: “I could pre-wrap them! Then it's grab and go.”",
                why: "A question lets her think. She owns the new idea, too." },
              { text: "“Ruby, you serve. Kai, you take the money. Go!”", good: 1,
                reply: "Ruby: “Okay.” The line moves, but she's flat.",
                why: "It works, but she's just following, not thinking." },
              { text: "Shout, “Stop chatting! Everyone work faster!”", good: 0,
                reply: "Ruby: “We ARE working!” She slams the tray down.",
                why: "Shouting orders makes people cross and slow." }
            ] },
          { say: "You'd like Ruby to restock the napkins, because they're almost gone.",
            choices: [
              { text: "“Ruby, will we have enough napkins for the next hour?”", good: 2,
                reply: "Ruby: “Hmm, no. I'll fetch more now!”",
                why: "A question made her think and offer. No order needed." },
              { text: "“Ruby, please get more napkins.”", good: 1,
                reply: "Ruby: “Sure.” She goes, but she doesn't smile.",
                why: "Polite, but still an order." },
              { text: "“Napkins are low! Do what I say next time!”", good: 0,
                reply: "Ruby: “You're not my boss!” She folds her arms.",
                why: "Bossing makes people want to say no." }
            ] }
        ]
      },
      {
        id: "p4-5", emoji: "🛡️", name: "Let them save face",
        tip: "Help quietly. Don't shame them.",
        grown: "Let the other person save face.",
        type: "scene",
        intro: "When someone slips up in public, help them feel okay.",
        who: { name: "Kai", emoji: "👦🏽" }, where: "🎪",
        rounds: [
          { say: "Kai drops a tray of cupcakes in front of the crowd. His face is bright red.",
            choices: [
              { text: "Quietly say “Whoops, it happens! Let's pick them up together.”", good: 2,
                reply: "Kai: “Thanks. I thought everyone was laughing.”",
                why: "Helping quietly lets him keep his pride." },
              { text: "“Careful, Kai!” Then help pick them up.", good: 1,
                reply: "Kai: “I know...” He looks at the ground.",
                why: "You helped, but “careful” in front of a crowd adds shame." },
              { text: "Say loudly, “Kai dropped the cakes! Ha ha!”", good: 0,
                reply: "Kai: “Stop it!” He runs behind the stall.",
                why: "Making a joke at his cost shames him in front of everyone." }
            ] },
          { say: "A customer says Kai gave the wrong change. Kai did, but everyone is watching.",
            choices: [
              { text: "“Easy to mix up when it's busy. Let's sort it out together.”", good: 2,
                reply: "Kai: “Sorry, sir. Here's the right change.” He relaxes.",
                why: "You fixed it kindly and let him keep his pride." },
              { text: "“Yes, Kai got it wrong. I'll fix it.”", good: 1,
                reply: "Kai: “Sorry...” He looks away.",
                why: "You fixed it, but you said his mistake out loud." },
              { text: "Tell the crowd, “Kai can't do maths. Ask me next time.”", good: 0,
                reply: "Kai: “I hate this!” He rips off his apron.",
                why: "Shaming someone in front of others makes it hard to come back." }
            ] }
        ]
      },
      {
        id: "p4-6", emoji: "👏", name: "Cheer every step",
        tip: "Notice small wins and say so.",
        grown: "Praise every improvement, however small.",
        type: "scene",
        intro: "Max is only six. Every little step counts for him.",
        who: { name: "Max", emoji: "👦" }, where: "🎪",
        rounds: [
          { say: "Max is learning to carry cups. This time he dropped only one.",
            choices: [
              { text: "“Only one dropped! That's better than before!”", good: 2,
                reply: "Max: “Yes! I'll try for zero!” He beams.",
                why: "Noticing small progress makes him want to keep going." },
              { text: "“You still dropped one. Try again.”", good: 1,
                reply: "Max: “Okay...” He looks at the cup.",
                why: "It's true, but it skips the good news. He feels stuck." },
              { text: "“You always drop things. Give me the tray.”", good: 0,
                reply: "Max: “I was getting better!” His eyes fill up.",
                why: "Taking over tells him he can't do it." }
            ] },
          { say: "Max wiped the table. It's a bit streaky, but cleaner than before.",
            choices: [
              { text: "“That's way cleaner! Want me to show you one tiny trick?”", good: 2,
                reply: "Max: “Yes please!” He listens carefully.",
                why: "Praise first, then a small tip. Learning feels good." },
              { text: "“Okay.” Then wipe it again yourself.", good: 1,
                reply: "Max: “Did I do it wrong?” He looks sad.",
                why: "Redoing it quietly tells him it wasn't good enough." },
              { text: "“It's streaky. I'll just do it.”", good: 0,
                reply: "Max: “I don't want to help any more.”",
                why: "Only seeing the streaks makes him stop trying." }
            ] }
        ]
      },
      {
        id: "p4-7", emoji: "🏅", name: "A name to live up to",
        tip: "Say the good things you see.",
        grown: "Give the other person a fine reputation to live up to.",
        type: "scene",
        intro: "People often become what you tell them they are.",
        who: { name: "Ollie", emoji: "🧒🏼" }, where: "🎪",
        rounds: [
          { say: "Ollie: “I'm useless at counting.” But he measures lemon juice so carefully.",
            choices: [
              { text: "“You measure so carefully. You'll be great with the till.”", good: 2,
                reply: "Ollie: “Maybe I can be careful with money too!”",
                why: "A good name gives him something real to live up to." },
              { text: "“Everyone is bad at something. Just try.”", good: 1,
                reply: "Ollie: “Okay...” He doesn't sound sure.",
                why: "Kind, but it agrees he's “bad”. Say what he's good at." },
              { text: "“Yeah, you're the worst at counting. Stay on drinks.”", good: 0,
                reply: "Ollie: “Fine.” He never touches the till again.",
                why: "Bad labels stick, and he'll act them out." }
            ] },
          { say: "Ollie says he's always late. But today he was early.",
            choices: [
              { text: "“You were early today! You're a reliable helper now.”", good: 2,
                reply: "Ollie: “Hey, I am! I'll be early again!”",
                why: "You noticed the change, and now he wants to keep it." },
              { text: "“Early today. Do it again tomorrow.”", good: 1,
                reply: "Ollie: “Okay.” He shrugs.",
                why: "It's fine, but it sounds like a test, not praise." },
              { text: "“Finally! A miracle!”", good: 0,
                reply: "Ollie: “Ha. Very funny.” He stops smiling.",
                why: "A joke about the old him doesn't help the new him." }
            ] }
        ]
      },
      {
        id: "p4-8", emoji: "🧩", name: "Make mistakes easy to fix",
        tip: "Say: it's an easy fix. Show how.",
        grown: "Encourage, and make faults seem easy to correct.",
        type: "scene",
        intro: "Kai is stuck on something small and feels hopeless.",
        who: { name: "Kai", emoji: "👦🏽" }, where: "🎪",
        rounds: [
          { say: "The cash box lid jams. Kai says, “I'm hopeless!”",
            choices: [
              { text: "“Tricky lid! Press here and slide. See? Easy once you know.”", good: 2,
                reply: "Kai: “Oh! I'll remember that.” He opens it with a click.",
                why: "Saying it's easy to fix, and showing how, builds hope." },
              { text: "“You'll learn.” Open it for him.", good: 1,
                reply: "Kai: “Okay.” He watches but doesn't learn.",
                why: "Kind, but he didn't get to try. Show him, don't do it for him." },
              { text: "“Hopeless! Give it here.”", good: 0,
                reply: "Kai: “See, I am hopeless.” He sits down.",
                why: "Agreeing with him makes him feel worse." }
            ] },
          { say: "Kai tries again. The lid opens, but coins spill on the ground.",
            choices: [
              { text: "“Ha, coins everywhere! Easy fix. I'll hold, you pick up.”", good: 2,
                reply: "Kai laughs. “We make a good team.”",
                why: "You made the spill feel small and fixable, so he stayed calm." },
              { text: "“Careful. We can't lose any money.”", good: 1,
                reply: "Kai: “I'm trying!” He hurries and drops more.",
                why: "True, but it adds pressure. Pressure leads to more drops." },
              { text: "“You're so clumsy! It was a simple thing.”", good: 0,
                reply: "Kai: “I quit the cash box.” He backs away.",
                why: "Calling it simple makes his mistake feel huge." }
            ] }
        ]
      },
      {
        id: "p4-9", emoji: "🎁", name: "Make helping happy",
        tip: "Show what's in it for everyone.",
        grown: "Make the other person happy about doing the thing you suggest.",
        type: "scene",
        intro: "The fair is over. Some jobs are left. Make helping feel good.",
        who: { name: "Ruby", emoji: "👱‍♀️" }, where: "🎪",
        rounds: [
          { say: "Tables need stacking. Nobody wants to do it.",
            choices: [
              { text: "“If we each take one end, we're done in five. Cake then. Who's in?”", good: 2,
                reply: "Ruby: “I'm in! Last one to the cake is a rotten egg!”",
                why: "It's quicker as a team, and there's a nice end." },
              { text: "“Everyone has to help stack the tables. It's the rules.”", good: 1,
                reply: "Ruby: “Fine.” They stack slowly, grumbling.",
                why: "A rule gets it done, but nobody's glad to help." },
              { text: "“Ruby, you're stacking tables. I'm captain.”", good: 0,
                reply: "Ruby: “Why me?” She drags her feet.",
                why: "Using your title makes people feel pushed around." }
            ] },
          { say: "Ruby wants to see the face painting. You still need help counting the money.",
            choices: [
              { text: "“Count with me, then we'll go to face painting together.”", good: 2,
                reply: "Ruby: “Deal! Let's count fast!”",
                why: "Helping gets her what she wants too. Everyone wins." },
              { text: "“Face painting later. Money first.”", good: 1,
                reply: "Ruby: “Okay...” She sighs.",
                why: "It's fair, but there's nothing in it for her." },
              { text: "“No face painting. Stay here.”", good: 0,
                reply: "Ruby: “That's not fair!” She stomps away.",
                why: "Saying no to what she wants makes her not want to help." }
            ] }
        ]
      }
    ]
  }
];
