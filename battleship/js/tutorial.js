/* Battleship — the how-to-play pages.                                          */
/*                                                                              */
/* Seven short cards. Not one of the pictures is drawn by hand: each page sets   */
/* up a real board with real ships on it, fires real shots at it through         */
/* Rules.fire, and renders the result with the same two functions the game uses. */
/* So the lesson cannot teach something the game then contradicts — including on */
/* page four, where a ship goes down and every one of its squares changes at     */
/* once.                                                                         */
"use strict";
window.BS = window.BS || {};

BS.Tutorial = (function () {
  const Rules = BS.Rules;
  const Ui = BS.Ui;
  const $ = (id) => document.getElementById(id);

  // A small sea, so the pictures stay legible inside a sheet.
  const SPEC = { id: "lesson", label: "Lesson", size: 6, fleet: [3, 2] };

  // Every example starts from the same two ships: a cruiser lying across C2-E2
  // and a patrol boat down B4-B5.
  function sample() {
    const b = Rules.newBoard(SPEC);
    Rules.place(b, 0, 1, 2, true);
    Rules.place(b, 1, 3, 1, false);
    return b;
  }

  function fireAll(board, shots) {
    for (const [r, c] of shots) Rules.fire(board, r, c);
    return board;
  }

  /* ── The pages ─────────────────────────────────────────────────────────── */

  const PAGES = [
    {
      icon: "🚢",
      title: "Two hidden fleets",
      html: "<p>You each get a sea and the same set of ships. Put yours anywhere you " +
            "like — across or down — and the other player never sees where.</p>" +
            "<p>Then you take it in turns to guess.</p>",
      show: () => [reveal(sample(), "Your sea — you can see yours")],
      caption: "Ships can go across or down, and they can touch."
    },
    {
      icon: "🎯",
      title: "Call out a square",
      html: "<p>Tap a square on <b>their</b> sea to take aim, then tap <b>Fire</b>. " +
            "The letters and numbers give every square a name — this one is D4.</p>" +
            "<p>A <b>dot</b> means splash: nothing there.</p>",
      show: () => [hidden(fireAll(sample(), [[3, 3], [0, 0], [5, 5]]), "Their sea")],
      caption: "Three shots, three splashes. Those squares are done with."
    },
    {
      icon: "💥",
      title: "A cross means you hit something",
      html: "<p>A <b>cross</b> means one of their ships is on that square — but it " +
            "doesn't say <i>which</i> ship, or which way it's lying.</p>" +
            "<p>So try next door. Up, down, left or right.</p>",
      show: () => [hidden(fireAll(sample(), [[1, 3], [3, 3], [0, 0]]), "Their sea")],
      caption: "A hit at D2. The rest of that ship is touching it somewhere.",
      note: "Two hits in a row tell you which way it's lying. Keep going that way."
    },
    {
      icon: "⛵",
      title: "Sinking a ship",
      html: "<p>Hit every square of a ship and it goes down — and they have to tell " +
            "you which one it was.</p>" +
            "<p>A sunk ship turns dark, and its name gets crossed off the list.</p>",
      show: () => [hidden(fireAll(sample(), [[1, 2], [1, 3], [1, 4], [4, 4]]), "Their sea")],
      caption: "\"You sank my Cruiser!\" — all three of its squares at once."
    },
    {
      icon: "🕵️",
      title: "Think about where it fits",
      html: "<p>Once a ship has gone down, the squares round the wreck are safe — " +
            "nothing else is there.</p>" +
            "<p>And a three-square ship needs three squares in a line. If there isn't " +
            "room, don't waste a shot on it.</p>",
      show: () => [hidden(fireAll(sample(), [[1, 2], [1, 3], [1, 4], [0, 1], [2, 1], [5, 0]]), "Their sea")],
      caption: "The cruiser is gone. Everything left is hunting one little boat.",
      note: "Stuck? 💡 Hint names a square and tells you why it picked it."
    },
    {
      icon: "🙈",
      title: "Hide yours properly",
      html: "<p>Don't line them all up along one edge, and don't bunch them in a " +
            "corner — that's the first place anybody looks.</p>" +
            "<p>Tap <b>🔄 Turn it</b> to lay a ship down the other way, or " +
            "<b>🎲 Do it for me</b> if you'd rather just get on with it.</p>",
      show: () => {
        const b = Rules.newBoard(SPEC);
        Rules.place(b, 0, 0, 0, true);
        Rules.place(b, 1, 0, 4, true);
        return [reveal(b, "Too easy to find")];
      },
      caption: "Both ships across the top row. Somebody will find that fast."
    },
    {
      icon: "🤝",
      title: "Two of you, one tablet",
      html: "<p>Playing a friend? You each put your ships out in turn, and the game " +
            "shows a <b>pass the tablet over</b> screen in between, so nobody sees " +
            "anybody else's sea.</p>" +
            "<p>Don't peek. That's the whole game.</p>",
      note: "On your own? The computer plays instead — Easy, Medium or Hard."
    }
  ];

  /* ── Drawing the examples ──────────────────────────────────────────────── */

  // Ships showing — your own sea, or the reveal at the end of a game.
  function reveal(board, title) {
    return Ui.boardCard(board, title, Ui.sheetCell(board.size, 1.35));
  }

  // Ships hidden — what you actually see of the other player's sea. It goes
  // through Rules.publicView, exactly like the real board does.
  function hidden(board, title) {
    const card = document.createElement("div");
    card.className = "grid-card";
    const head = document.createElement("div");
    head.className = "grid-head";
    head.textContent = title;
    card.appendChild(head);
    const el = document.createElement("div");
    el.className = "grid mini";
    card.appendChild(el);
    const g = Ui.grid(el, board.size, { mini: true });
    el.style.setProperty("--cell", Ui.sheetCell(board.size, 1.35) + "px");
    Ui.paintEnemy(g, Rules.publicView(board), null, false);
    return card;
  }

  let step = 0;

  function render() {
    const page = PAGES[step];
    $("howtoStep").textContent = (step + 1) + " / " + PAGES.length;

    const body = $("howtoBody");
    body.innerHTML =
      '<div class="howto-icon">' + page.icon + "</div>" +
      '<h2 class="howto-title">' + page.title + "</h2>" +
      page.html;

    if (page.show) {
      const wrap = document.createElement("div");
      wrap.className = "howto-example";
      for (const card of page.show()) wrap.appendChild(card);
      if (page.caption) {
        const cap = document.createElement("p");
        cap.className = "howto-caption";
        cap.textContent = page.caption;
        wrap.appendChild(cap);
      }
      body.appendChild(wrap);
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

  let onDone = null;

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
