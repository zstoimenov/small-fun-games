/* Lemonade Stand — the how-to lesson.                                          */
/*                                                                              */
/* A dozen short pages. Every figure on them is computed by calling the real     */
/* economy rather than typed in, so the lesson cannot drift away from the game   */
/* when a number is tuned. The interest page in particular runs the actual       */
/* fourteen nights through interestOn() — if the rate ever changes, the page     */
/* changes with it.                                                              */
"use strict";
window.LS = window.LS || {};

LS.Tutorial = (function () {
  const E = LS.Economy;
  const $ = (id) => document.getElementById(id);

  // What $10 becomes if you leave it alone for a whole run. Computed, not typed.
  // Illustrated with a round $10 rather than the starting purse: the purse is
  // deliberately small now, and "$3 becomes $4.50" doesn't show a child what
  // compounding looks like.
  const EXAMPLE = 1000;
  function growth(difficulty) {
    const sp = E.spec(difficulty);
    let bal = EXAMPLE;
    const each = [];
    for (let n = 0; n < sp.days; n++) {
      const paid = E.interestOn(bal, sp).paid;
      bal += paid;
      each.push(paid);
    }
    return { start: EXAMPLE, end: bal, nights: sp.days, first: each[0], last: each[each.length - 1] };
  }

  function pages(difficulty) {
    const sp = E.spec(difficulty);
    const g = growth(difficulty);
    const unit = 40;
    const small = E.packPrice(unit, E.PACKS[0]);
    const big = E.packPrice(unit, E.PACKS[1]);
    const loan = E.LOANS[0];
    const target = sp.goal[sp.goal.length - 1];

    return [
      { title: "You've got a stall",
        html: "<p>For " + sp.days + " days you're running a lemonade stall.</p>" +
          "<p>You start with <b>" + E.money(E.START_CASH) + "</b>. That's not much — not even enough " +
          "for a full stall's worth of lemons. Every day you buy what you can, decide what to charge, " +
          "and sell as much as you can.</p>" +
          "<div class='demo'>You're saving up for <b>" + sp.rungs[sp.rungs.length - 1] +
          "</b>. It costs <span class='big-num'>" + E.money(target) + "</span></div>" },

      { title: "Buy your lemons",
        html: "<p>Lemons cost a different amount every day. Some days they're cheap — those are the days to buy plenty.</p>" +
          "<div class='demo'>If lemons are " + E.price(unit) + " a cup:<br>" +
          "5 cups cost <b>" + E.money(small) + "</b><br>" +
          "📦 15 cups cost <b>" + E.money(big) + "</b> — not " + E.money(small * 3) + "<br>" +
          "The big pack saves you <b>" + E.money(E.packSaving(unit)) + "</b>.</div>" +
          "<p>Buying the bigger pack is nearly always the better deal.</p>" },

      { title: "Pick your price",
        html: "<p>You choose what a cup costs. This is the biggest decision you make.</p>" +
          "<div class='demo'>Lemons cost you " + E.price(unit) + " a cup.<br>" +
          "Sell at <b>" + E.price(75) + "</b> and you keep <b>" + E.price(75 - unit) + "</b> each time.<br>" +
          "Sell at <b>" + E.price(25) + "</b> and you <i>lose</i> " + E.price(unit - 25) + " each time!</div>" +
          "<p>Charge too much and hardly anyone buys. Charge too little and you lose money on every cup.</p>" },

      { title: "Counting out the change",
        html: "<p>Once a day somebody pays with a handful of money instead of the exact coins. You work out what to give back, and count it out.</p>" +
          "<div class='demo'>They want <b>2 cups</b> at <b>" + E.price(75) + "</b> each.<br>" +
          "That's <b>" + E.money(150) + "</b>.<br>" +
          "They hand you a $2 coin — so the change is <span class='big-num'>" + E.price(50) + "</span></div>" +
          "<p>Get it right and people often leave you a little extra. Give too much and they keep it — that money is gone. Give too little and they notice.</p>" },

      { title: "People come back",
        html: "<p>Serve somebody a fair cup and some of them come back tomorrow. Those are your <b>regulars</b>.</p>" +
          "<div class='demo'>Regulars turn up when other people don't.<br>" +
          "On a rainy day they might be your whole queue.<br>" +
          "The more people you serve, the more you win.</div>" +
          "<p>Bad weather keeps some of them at home, but never all of them. You lose them for good by " +
          "charging silly prices or getting their change wrong.</p>" +
          "<p>Look after them and your little stall turns into a proper business — up to <b>" +
          E.MAX_REGULARS + "</b> of them, which is as many as one stall can serve.</p>" },

      { title: "Some days go wrong",
        html: "<p>You buy your lemons before you know how the day will go. Sometimes it goes badly.</p>" +
          "<div class='demo'>🐝 Wasps get into the lemonade.<br>" +
          "🏪 Somebody sets up a stall up the road.<br>" +
          "🌦️ It buckets down and everyone goes home.</div>" +
          "<p>That isn't your fault, and it will still cost you money. It's why one good day is never enough — you need a lot of steady ones.</p>" },

      { title: "Money in, money out",
        html: "<p>At the end of each day you'll see the sums.</p>" +
          "<div class='demo'>You spent on lemons <b>" + E.money(big) + "</b><br>" +
          "You took at the stall <b>" + E.money(15 * 75) + "</b><br>" +
          "So you made <span class='big-num'>" + E.money(15 * 75 - big) + "</span></div>" +
          "<p>That's <b>profit</b>: what came in, minus what went out.</p>" },

      { title: "Don't make too much",
        html: "<p>Lemonade doesn't keep. Any cups you don't sell go in the bin, and the money you spent on them is gone.</p>" +
          "<p>Watch the weather. On a hot day lots of people walk past. When it's raining, hardly anybody does — so don't fill the stall.</p>" +
          "<p>You can buy an ice bucket at the shop. Then your leftovers keep until tomorrow.</p>" },

      { title: "The bank pays you",
        html: "<p>At the end of each day you choose: keep your money in your purse, or put it in the bank.</p>" +
          "<div class='demo'>The bank pays you <b>" + E.RATE + "c every night</b> for every dollar you leave with it.<br>" +
          "Your purse pays you nothing at all.</div>" +
          "<p>Leave " + E.money(g.start) + " in the bank and don't touch it, and after " +
          g.nights + " nights it's worth</p><p style='text-align:center'><span class='big-num'>" +
          E.money(g.end) + "</span></p>" },

      { title: "Keep a bit in your purse",
        html: "<p>You can spend bank money any time you like. But going to the bank to fetch it costs <b>" +
          E.price(E.WITHDRAW_FEE) + "</b> — once a day, however much you take out.</p>" +
          "<div class='demo'>Bank <i>everything</i> and tomorrow's lemons cost you " +
          E.price(E.WITHDRAW_FEE) + " extra.<br>" +
          "Keep <i>everything</i> in your purse and the bank pays you nothing at all.</div>" +
          "<p>So do what grown-ups do: keep about <b>" + E.money(E.FLOAT) +
          "</b> in your purse for tomorrow, and put the rest in the bank.</p>" },

      { title: "It grows faster the longer it sits",
        html: "<p>The first night, the bank paid you " + E.money(g.first) + ".</p>" +
          "<p>The last night, it paid you " + E.money(g.last) + " — for doing exactly the same nothing.</p>" +
          "<div class='demo'>That's because it pays you on what's <i>there</i>. The more that's there, the more it pays. So money you bank <b>early</b> earns for longer.</div>" +
          "<p>Real banks work exactly like this one. They're just a lot slower.</p>" },

      { title: "Borrowing costs you",
        html: "<p>The bank will lend you money if you need it. But you always pay back <b>more</b> than you borrowed.</p>" +
          "<div class='demo'>Borrow <b>" + E.money(loan.borrow) + "</b><br>" +
          "Pay back <b>" + E.money(loan.repay) + "</b> " + loan.nights + " days later<br>" +
          "Borrowing cost you <span class='big-num'>" + E.money(loan.repay - loan.borrow) + "</span></div>" +
          "<p>The bank pays you " + E.RATE + "c a night for saving, and charges you 6c a night for borrowing — <b>twice as much</b>. That gap is how a bank makes money.</p>" +
          "<p>Borrowing is worth it if it earns you more than it costs. It isn't worth it for an ice cream.</p>" },

      { title: "Ready?",
        html: "<p>Every morning: check the weather, buy your lemons, pick your price.</p>" +
          "<p>Every evening: look at what you made, and bank what you won't need.</p>" +
          "<div class='demo'>Get to <b>" + E.money(target) + "</b> in " + sp.days + " days and " +
          sp.rungs[sp.rungs.length - 1].replace(/^[^ ]+ /, "") + " is yours.</div>" +
          "<p><b>Most fortnights won't get there</b>, and that's meant to be true. " +
          "That's a lot of lemonade. There are three smaller things to save for on the way.</p>" +
          "<p>Take your time. Steady beats lucky.</p>" }
    ];
  }

  /* ── The carousel ──────────────────────────────────────────────────────── */

  let list = [];
  let at = 0;
  let onClose = null;

  function draw() {
    const p = list[at];
    $("howtoTitle").textContent = p.title;
    $("howtoStep").textContent = (at + 1) + " / " + list.length;
    $("howtoBody").innerHTML = p.html;

    const dots = $("howtoDots");
    dots.textContent = "";
    for (let i = 0; i < list.length; i++) {
      const d = document.createElement("span");
      d.className = "dot" + (i === at ? " on" : "");
      dots.appendChild(d);
    }
    $("howtoBack").disabled = at === 0;
    $("howtoNext").textContent = at === list.length - 1 ? "Let's go" : "Next";
  }

  function open(difficulty, done) {
    list = pages(difficulty);
    at = 0;
    onClose = done || null;
    draw();
    $("howto").hidden = false;
  }

  function close() {
    $("howto").hidden = true;
    const cb = onClose;
    onClose = null;
    if (cb) cb();
  }

  function next() {
    if (at < list.length - 1) { at++; draw(); LS.Audio.tap(); }
    else close();
  }

  function back() {
    if (at > 0) { at--; draw(); LS.Audio.tap(); }
  }

  return { open, close, next, back, pages, growth };
})();
