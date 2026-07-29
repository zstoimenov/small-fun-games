/* Connect Four — the how-to-play pages.                                        */
/*                                                                              */
/* Six short cards, each with a little board drawn by the same code that draws   */
/* the real one, so the picture in the lesson can't drift from the game. The     */
/* last two are the bits that actually make someone better at it: cover the      */
/* threat, and build a trap with two ways to win.                                */
"use strict";
window.C4 = window.C4 || {};

C4.Tutorial = (function () {
  const Ui = C4.Ui;
  const $ = (id) => document.getElementById(id);

  // Boards are written top row first: "." empty, "r" red, "y" yellow.
  const PAGES = [
    {
      icon: "🔴",
      title: "Drop a disc",
      html: "<p>Tap any column and your disc falls to the <b>lowest empty space</b> in it. " +
            "You can't choose the row — gravity does that bit.</p>",
      board: ["....", "....", "..r.", ".yry"],
      caption: "Red just tapped the third column."
    },
    {
      icon: "4️⃣",
      title: "Get four in a row",
      html: "<p>Win by lining up <b>four of your colour</b> in a row. Sideways counts, " +
            "stacked up counts, and slanting counts.</p>",
      board: [".....", ".....", ".yyy.", "rrrr."],
      caption: "Four across — red wins.",
      win: [[0, 3], [1, 3], [2, 3], [3, 3]]
    },
    {
      icon: "↗️",
      title: "Slanting lines count too",
      html: "<p>The one everybody misses. Keep an eye on the diagonals — yours " +
            "<i>and</i> theirs.</p>",
      board: ["...y", "..yr", ".yrr", "yryr"],
      caption: "Four on the slant — yellow wins.",
      win: [[3, 0], [2, 1], [1, 2], [0, 3]]
    },
    {
      icon: "🛡️",
      title: "Block them",
      html: "<p>If they get <b>three in a row with a gap</b>, fill the gap before they do. " +
            "It's your go — don't spend it somewhere else.</p>",
      board: [".....", "....r", "....r", "yyy.r"],
      caption: "Yellow makes four next go. Red has to fill that gap now.",
      win: [[3, 3]]
    },
    {
      icon: "🪤",
      title: "Set a trap",
      html: "<p>The winning move is to make <b>two threats at once</b>. They only get one " +
            "go, so they can only block one of them.</p>",
      board: [".....", ".....", "..yy.", ".rrr."],
      caption: "Red can finish at either end, and yellow only gets one go.",
      win: [[0, 3], [4, 3]]
    },
    {
      icon: "💡",
      title: "Stuck? Ask",
      html: "<p>Tap <b>💡 Hint</b> and you'll get a column and the reason for it. " +
            "<b>↶ Undo</b> takes a move back if you tapped the wrong one.</p>" +
            "<p class='howto-note'>The middle column is on more winning lines than any " +
            "other, so it's usually the best place to start.</p>",
      board: ["....", "....", "..r.", "..y."],
      caption: "Play towards the middle."
    }
  ];

  let step = 0;
  let onDone = null;

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
      example.appendChild(Ui.miniBoard(page.board, page.win));
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
