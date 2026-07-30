/* Mastermind — the how-to-play pages.                                          */
/*                                                                              */
/* Seven short cards. The pegs in the examples are not written down anywhere:    */
/* each page gives a secret and a guess, and the black and white pegs are worked */
/* out by the same scoring function the game uses. So the lesson cannot teach    */
/* something the game then contradicts — including on page four, which is the    */
/* repeated-colour case everybody gets wrong.                                    */
"use strict";
window.MM = window.MM || {};

MM.Tutorial = (function () {
  const Rules = MM.Rules;
  const Ui = MM.Ui;
  const $ = (id) => document.getElementById(id);

  // 0 red ● · 1 yellow ★ · 2 green ■ · 3 blue ◆ · 4 purple ✚ · 5 pink ▲
  const PAGES = [
    {
      icon: "🎯",
      title: "There's a secret code",
      html: "<p>Somebody hides a row of colours — the computer, or the person sitting " +
            "next to you. Your job is to work out <b>which colours</b>, and <b>what " +
            "order</b> they go in.</p><p>You get ten goes.</p>",
      secret: [0, 1, 2, 3],
      caption: "A code is just a row of colours. This one is hidden from you."
    },
    {
      icon: "⚫",
      title: "A black peg means spot on",
      html: "<p>Type in a row and you get little pegs back. A <b>black peg</b> means one " +
            "of your colours is <b>right, and in the right place</b>.</p>" +
            "<p>It doesn't tell you <i>which</i> one. That's the puzzle.</p>",
      secret: [0, 1, 2, 3],
      guess: [0, 1, 4, 5],
      caption: "Red and yellow are in the right places, so two black pegs."
    },
    {
      icon: "⚪",
      title: "A white peg means wrong place",
      html: "<p>A <b>white peg</b> means the colour <b>is</b> in the code, but you've put " +
            "it in the wrong slot. Move it and try again.</p>",
      secret: [0, 1, 2, 3],
      guess: [1, 0, 4, 5],
      caption: "Red and yellow are both in the code, but swapped over — two white pegs."
    },
    {
      icon: "🤯",
      title: "The bit that catches everyone",
      html: "<p>Pegs are handed out <b>one for one</b>. If the code has two reds in it, " +
            "you can never get more than two pegs for red — however many you put down.</p>",
      secret: [0, 0, 1, 1],
      guess: [0, 0, 0, 0],
      caption: "Four reds, but the code only holds two — so only two pegs come back.",
      note: "A code can use the same colour more than once. Watch out for that."
    },
    {
      icon: "🕵️",
      title: "No pegs is good news too",
      html: "<p>If a row comes back with <b>nothing at all</b>, you've just learnt " +
            "something big: <b>none</b> of those colours is in the code. Cross them off " +
            "and don't use them again.</p>",
      secret: [0, 1, 2, 3],
      guess: [4, 4, 5, 5],
      caption: "No pegs — so there's no purple and no pink anywhere in the code."
    },
    {
      icon: "🔄",
      title: "Two ways to play",
      html: "<p><b>Crack it:</b> the computer hides a code and you break it.</p>" +
            "<p><b>Set it:</b> you hide a code and the computer breaks it. On Hard it " +
            "never needs more than five goes — see if you can find one that takes it " +
            "all five.</p><p>With two of you, take it in turns. Fewest goes wins.</p>",
      secret: [2, 4, 0, 4],
      caption: "Repeats and all — this one is perfectly legal."
    },
    {
      icon: "💡",
      title: "Stuck? Ask",
      html: "<p>Tap <b>💡 Hint</b> for a row worth trying, and the reason for it. " +
            "<b>↶ Undo</b> takes a guess back if you tapped the wrong colour.</p>" +
            "<p class='howto-note'>Start with a row like this one — two of one colour and " +
            "two of another. It's the best opening there is, and it's the one the " +
            "computer uses.</p>",
      secret: [0, 0, 1, 1],
      caption: "The best first guess in the game."
    }
  ];

  let step = 0;
  let onDone = null;

  function labelled(text, code, marks) {
    const wrap = document.createElement("div");
    wrap.className = "howto-example";
    const cap = document.createElement("p");
    cap.className = "howto-caption";
    cap.textContent = text;
    cap.style.margin = "0 0 5px";
    wrap.appendChild(cap);
    wrap.appendChild(Ui.miniRow(code, marks));
    return wrap;
  }

  function render() {
    const page = PAGES[step];
    $("howtoStep").textContent = (step + 1) + " / " + PAGES.length;

    const body = $("howtoBody");
    body.innerHTML =
      '<div class="howto-icon">' + page.icon + "</div>" +
      '<h2 class="howto-title">' + page.title + "</h2>" +
      page.html;

    if (page.secret) {
      body.appendChild(labelled(page.guess ? "The secret code" : "A code", page.secret));
    }
    if (page.guess) {
      // The pegs come from the game's own scoring, not from anything typed here.
      const marks = Rules.score(page.guess, page.secret);
      body.appendChild(labelled("Your guess", page.guess, marks));
    }
    if (page.caption) {
      const cap = document.createElement("p");
      cap.className = "howto-caption";
      cap.style.textAlign = "center";
      cap.textContent = page.caption;
      body.appendChild(cap);
    }
    if (page.note) {
      const note = document.createElement("p");
      note.className = "howto-note";
      note.style.marginTop = "12px";
      note.textContent = page.note;
      body.appendChild(note);
    }

    const dots = $("howtoDots");
    dots.innerHTML = "";
    PAGES.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "dot" + (i === step ? " on" : "");
      dot.addEventListener("click", () => { step = i; render(); });
      dots.appendChild(dot);
    });

    $("howtoPrev").disabled = step === 0;
    $("howtoNext").textContent = step === PAGES.length - 1 ? "Let's play ▶" : "Next ›";
    body.scrollTop = 0;
  }

  function open(done) {
    onDone = done || null;
    step = 0;
    render();
    $("howto").hidden = false;
  }

  function close() {
    $("howto").hidden = true;
    const done = onDone;
    onDone = null;
    if (done) done();
  }

  function wire() {
    $("howtoPrev").addEventListener("click", () => {
      if (step > 0) { step--; render(); }
    });
    $("howtoNext").addEventListener("click", () => {
      if (step < PAGES.length - 1) { step++; render(); } else close();
    });
    $("howtoSkip").addEventListener("click", close);
  }

  return { wire, open, close };
})();
