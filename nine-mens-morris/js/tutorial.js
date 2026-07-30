/* Nine Men's Morris — the how-to-play pages.                                    */
/*                                                                              */
/* Seven short cards, each with a little board drawn by the same code that draws  */
/* the real one, so the picture in the lesson can't drift from the game. The      */
/* order is the order the game happens in: put pieces down, make a line, take     */
/* one of theirs, learn which of theirs you can't take, then slide, then fly.     */
/*                                                                              */
/* Boards are written as 24 characters, one per point, in the same order rules.js */
/* numbers them: the outer ring's eight points, then the middle ring, then the    */
/* inner one, each starting at the top-left corner and going clockwise.           */
"use strict";
window.NMM = window.NMM || {};

NMM.Tutorial = (function () {
  const Ui = NMM.Ui;
  const $ = (id) => document.getElementById(id);

  const PAGES = [
    {
      icon: "🎯",
      title: "The spots and the lines",
      html: "<p>Pieces don't go in squares — they go on the <b>24 spots</b> where the lines " +
            "meet. Corners, and the middles of the lines.</p>",
      board: "........................",
      mark: [0, 9, 19],
      caption: "Three of the twenty-four spots."
    },
    {
      icon: "⚪",
      title: "Put your nine down",
      html: "<p>You get <b>nine pieces each</b>. Take turns putting one on any empty spot " +
            "until they're all out. White goes first.</p>",
      board: "w...b....w..b...........",
      mark: [1],
      caption: "Your go — anywhere empty will do."
    },
    {
      icon: "🎉",
      title: "Three in a line",
      html: "<p>Get <b>three of yours along one line</b> and you've made a <i>mill</i>. " +
            "It has to be a real line on the board — three in a row that only look " +
            "lined up don't count.</p>",
      board: "www.....b...b......b....",
      mill: [0, 1, 2],
      caption: "White has three along the top."
    },
    {
      icon: "✋",
      title: "Take one of theirs",
      html: "<p>Every time you make a line of three, you <b>take one of their pieces</b> " +
            "off the board. It's gone for good.</p>",
      board: "www.....b...b......b....",
      mill: [0, 1, 2],
      takeable: [8, 12, 19],
      caption: "White made a line, so one black piece comes off — white picks which."
    },
    {
      icon: "🛡️",
      title: "A line of three is safe",
      html: "<p>You <b>can't take a piece that's part of a line of three</b>. So the loose " +
            "ones go first.</p>" +
            "<p class='howto-note'>Unless <i>every single one</i> of their pieces is in a " +
            "line — then you can take any of them.</p>",
      board: "w...w...bbb.....w..b....",
      mill: [8, 9, 10],
      takeable: [19],
      caption: "Only the loose black piece can be taken."
    },
    {
      icon: "↔️",
      title: "Then start sliding",
      html: "<p>Once all nine are down, a go means <b>sliding one piece</b> along a line to " +
            "the <b>next empty spot</b>. One step — no jumping over anything.</p>",
      board: "wb......b.......w..b.w..",
      legal: [7],
      arrow: [0, 7],
      caption: "That piece can only go one way: the other side is blocked."
    },
    {
      icon: "🦋",
      title: "Down to three? Fly!",
      html: "<p>When you're down to <b>three pieces</b>, they get their wings: you can jump " +
            "to <b>any empty spot</b> on the board.</p>" +
            "<p>Lose one more and you're down to two — <b>that's the game</b>. You also lose " +
            "if it's your go and you've nowhere left to move.</p>" +
            "<p class='howto-note'>Stuck? <b>💡 Hint</b> tells you where to go and why, and " +
            "<b>↶ Undo</b> takes a go back.</p>",
      board: "w...b...b.b.w...b..w.b..",
      legal: [1, 23],
      caption: "Three white pieces left, so they can land anywhere empty."
    }
  ];

  let step = 0;

  function render() {
    const page = PAGES[step];
    $("howtoStep").textContent = (step + 1) + " / " + PAGES.length;

    const body = $("howtoBody");
    body.innerHTML =
      '<div class="howto-icon">' + page.icon + "</div>" +
      '<h2 class="howto-title">' + page.title + "</h2>" +
      page.html;

    if (page.board) {
      const example = document.createElement("div");
      example.className = "howto-example";
      example.appendChild(Ui.miniBoard(page.board, page));
      if (page.caption) {
        const cap = document.createElement("p");
        cap.className = "howto-caption";
        cap.textContent = page.caption;
        example.appendChild(cap);
      }
      body.appendChild(example);
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

  function open() {
    step = 0;
    render();
    $("howto").hidden = false;
  }

  function close() {
    $("howto").hidden = true;
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
