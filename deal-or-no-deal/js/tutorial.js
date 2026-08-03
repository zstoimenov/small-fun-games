/* Deal or No Deal — the how-to-play pages.                                     */
/*                                                                              */
/* Seven short cards. Not one of the pictures is drawn by hand: every page sets  */
/* up a real board, opens real boxes through Rules.open, and asks banker.js for  */
/* a real offer. So the lesson cannot teach something the game then contradicts  */
/* — including on page five, where the whole point is a number the Banker works  */
/* out rather than one somebody typed in.                                        */
"use strict";
window.DND = window.DND || {};

DND.Tutorial = (function () {
  const Rules = DND.Rules;
  const Banker = DND.Banker;
  const $ = (id) => document.getElementById(id);

  // The ten-box board, so the pictures stay legible inside a sheet.
  const SPEC = Rules.specOf("quick");

  // One fixed deal, so the lesson tells the same story every time. Box 4 (index
  // 3) holds $50 and is the one kept back; box 2 holds the top prize.
  //          box:   1     2      3    4     5    6      7     8      9     10
  const DEAL = [500, 100000, 10, 5000, 1, 50000, 100, 2000, 10000, 50];
  const HELD = 3;

  function sample(opens) {
    const g = Rules.newGame(SPEC, DEAL);
    Rules.pickHeld(g, HELD);
    for (const i of (opens || [])) Rules.open(g, i);
    return g;
  }

  /* ── Drawing a figure ──────────────────────────────────────────────────── */

  // The same classes the real board uses, so a box in the lesson and a box in
  // the game cannot drift apart.
  function boardFig(game, cell) {
    const wrap = document.createElement("div");
    wrap.className = "box-grid";
    wrap.style.setProperty("--n", 5);
    wrap.style.setProperty("--cell", (cell || 46) + "px");
    for (let i = 0; i < game.values.length; i++) {
      const b = document.createElement("div");
      const open = game.opened[i];
      b.className = "box" + (open ? " open" : "") + (i === game.held && !open ? " mine" : "");
      b.textContent = open ? Rules.moneyShort(game.values[i]) : String(i + 1);
      wrap.appendChild(b);
    }
    return wrap;
  }

  function fig(nodes, caption) {
    const box = document.createElement("div");
    box.className = "howto-fig";
    for (const n of [].concat(nodes)) box.appendChild(n);
    if (caption) {
      const c = document.createElement("p");
      c.className = "howto-cap";
      c.innerHTML = caption;
      box.appendChild(c);
    }
    return box;
  }

  function note(html) {
    const p = document.createElement("div");
    p.className = "working";
    p.innerHTML = html;
    return p;
  }

  const row = (a, b) =>
    '<div class="work-row"><span>' + a + "</span><span>" + b + "</span></div>";

  /* ── Two boards that differ by one box ─────────────────────────────────── */

  // Page five's whole argument. Both boards have seven boxes left; one lost a
  // penny and the other lost the top prize. The averages come from banker.js,
  // not from anything written down here.
  const KIND = sample([0, 2, 4]);      // $5, 10c and 1c gone
  const CRUEL = sample([0, 2, 1]);     // $5, 10c and the $1,000 gone

  // Refusing every offer, to see what the Banker does as the rounds go by. The
  // opening order is fixed so the curve is the same every time it is shown.
  function curve() {
    const g = sample();
    const order = [0, 1, 2, 4, 5, 6, 7, 8];
    const out = [];
    for (const i of order) {
      Rules.open(g, i);
      if (g.phase === "offer") {
        const t = Banker.think(g);
        Rules.setOffer(g, t.cents);
        out.push(t);
        Rules.refuseDeal(g);
      }
    }
    return out;
  }

  function curveFig() {
    const calls = curve();
    const top = Math.max(...calls.map((t) => t.ratio));
    let html = "";
    for (const t of calls) {
      html += '<div class="work-row"><span>Call ' + t.round + " — " +
        t.count + " boxes left</span><span>" + Math.round(t.ratio * 100) + "% of the average</span></div>" +
        '<div class="work-bar"><i style="width:' +
        Math.round((t.ratio / top) * 100) + '%"></i></div>';
    }
    return note(html);
  }

  /* ── The pages ─────────────────────────────────────────────────────────── */

  const PAGES = [
    {
      title: "Ten boxes. One is yours.",
      html: "<p>Every box has money in it — anything from <b>1c</b> up to the top prize. " +
            "Nobody knows which is which, not even the Banker.</p>" +
            "<p>First you choose one box and keep it back. That's the gold one.</p>",
      show: () => [fig(boardFig(sample()),
        "Box 4 is being kept. The other nine stay on the table.")]
    },
    {
      title: "Open the rest, a few at a time",
      html: "<p>Now start opening the others. Whatever's inside is <b>gone</b> — " +
            "so you're hoping for the small ones.</p>" +
            "<p>Open a penny and you've done well. Open the big one and it hurts.</p>",
      show: () => [fig(boardFig(KIND),
        "Three opened, and they were all tiny. The big money is still out there.")]
    },
    {
      title: "Then the phone rings",
      html: "<p>Every few boxes the <b>Banker</b> calls. He doesn't know what's in your " +
            "box either — he just looks at what's left and makes you an offer for it.</p>",
      show: () => {
        const t = Banker.think(KIND);
        return [fig([], ""), note(
          row("Boxes still sealed", String(t.count)) +
          row("They average", Rules.money(Math.round(t.ev))) +
          row("Biggest one left", Rules.money(t.high)) +
          row("<b>The Banker offers</b>", "<b>" + Rules.money(t.cents) + "</b>") +
          '<p class="work-cap">He never offers the full average. He\'s buying your box ' +
          "and he wants a bargain.</p>")];
      }
    },
    {
      title: "Deal, or no deal?",
      html: "<p><b>DEAL</b> — you take his money and stop. You'll still open the rest, " +
            "just to see what you turned down.</p>" +
            "<p><b>NO DEAL</b> — you open more boxes and he rings again with a new offer.</p>",
      show: () => {
        const t = Banker.think(KIND);
        return [note(
          row("His offer now", Rules.money(t.cents)) +
          row("What the boxes average", Rules.money(Math.round(t.ev))) +
          '<div class="work-bar"><i style="width:' + Math.round(t.ratio * 100) + '%"></i></div>' +
          '<p class="work-cap">That bar is the offer against the average. Under halfway ' +
          "means he's being stingy — and early on, he always is.</p>")];
      }
    },
    {
      title: "Some boxes hurt more",
      html: "<p>Both of these boards have <b>seven</b> boxes left. The only difference is " +
            "which three came out.</p>",
      show: () => {
        const kind = Banker.value(Rules.remainingValues(KIND));
        const cruel = Banker.value(Rules.remainingValues(CRUEL));
        return [
          fig(boardFig(KIND, 38),
            "Three tiny ones gone — the boxes still average <b>" +
            Rules.money(Math.round(kind.ev)) + "</b>."),
          fig(boardFig(CRUEL, 38),
            "The top prize gone — now they only average <b>" +
            Rules.money(Math.round(cruel.ev)) + "</b>.")
        ];
      }
    },
    {
      title: "He gets kinder near the end",
      html: "<p>The first offer is always mean. Each call is worth a bigger slice of what " +
            "the boxes average, so hanging on is worth something — as long as the big " +
            "money survives.</p>",
      show: () => [curveFig()]
    },
    {
      title: "The last two boxes",
      html: "<p>Say no deal all the way and you end up with two boxes: yours, and the last " +
            "one on the table. You can swap if you fancy it.</p>" +
            "<p>It genuinely makes no difference — the money went in before you picked. " +
            "Then your box is opened, and that's what you've won.</p>",
      show: () => [fig(boardFig(sample([0, 1, 2, 4, 5, 6, 7, 8])),
        "Box 4 is yours, box 10 is the last one left. Swap, or don't.")]
    }
  ];

  /* ── The shell ─────────────────────────────────────────────────────────── */

  let at = 0;
  let onDone = null;

  function draw() {
    const p = PAGES[at];
    const body = $("howtoBody");
    body.innerHTML = "<h3>" + p.title + "</h3>" + p.html;
    if (p.show) for (const n of p.show()) body.appendChild(n);

    $("howtoStep").textContent = (at + 1) + " / " + PAGES.length;
    $("howtoPrev").disabled = at === 0;
    $("howtoNext").textContent = at === PAGES.length - 1 ? "Let's play ▶" : "Next ›";
    $("howtoDots").innerHTML = PAGES.map((_, i) =>
      '<i class="' + (i === at ? "on" : "") + '"></i>').join("");
    body.scrollTop = 0;
  }

  function open(done) {
    at = 0;
    onDone = done || null;
    draw();
    $("howto").hidden = false;
  }

  function close() {
    $("howto").hidden = true;
    const fn = onDone;
    onDone = null;
    if (fn) fn();
  }

  function wire() {
    $("howtoNext").addEventListener("click", () => {
      DND.Audio.tap();
      if (at === PAGES.length - 1) { close(); return; }
      at++;
      draw();
    });
    $("howtoPrev").addEventListener("click", () => {
      DND.Audio.tap();
      if (at > 0) { at--; draw(); }
    });
    $("howtoSkip").addEventListener("click", close);
  }
  wire();

  return { open, close, PAGES };
})();
