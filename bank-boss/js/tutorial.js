/* Bank Boss — the how-to lesson.                                               */
/*                                                                              */
/* Nine short pages. Every figure on them is computed by calling the real model  */
/* rather than typed in, so the lesson cannot drift away from the game when a    */
/* number is tuned. The vault on page two is drawn from the same heaps() the     */
/* real vault uses — if the picture in the lesson and the picture in the game    */
/* ever disagreed, the lesson would be the thing teaching the wrong lesson.      */
"use strict";
window.BB = window.BB || {};

BB.Tutorial = (function () {
  const B = () => BB.Bank;
  const $ = (id) => document.getElementById(id);

  // A little copy of the vault bar, from real numbers.
  function minibar(parts) {
    const total = parts.reduce((a, p) => a + p[1], 0) || 1;
    return '<div class="minibar">' + parts.map(([cls, v, label]) =>
      v <= 0 ? "" : '<div style="width:' + (v / total) * 100 + '%;background:var(--' + cls +
        ')">' + label + "</div>").join("") + "</div>";
  }

  function pages(difficulty) {
    const Bk = B();
    const sp = Bk.spec(difficulty);
    const M = Bk.money;
    const target = sp.goal[sp.goal.length - 1];

    // A worked loan, from the real arithmetic.
    const amount = 4000, nights = 5, r = 8, s = 2;
    const repay = Bk.repayFor(amount, r, nights);

    // What a night costs on a book of $200 at each rate.
    const book = 20000;
    const nightly = (v) => M(Bk.interestOn(book, v));

    return [
      { title: "You're the bank",
        html: "<p>This isn't your piggy bank. It's <b>the bank</b>, and you're in charge of it.</p>" +
          "<p>All day people come to the counter. Some want to leave their money with you. Some " +
          "want to borrow money for a scooter or a puppy or fixing their van.</p>" +
          "<div class='demo'>You start with <b>" + M(Bk.START_OWN) + "</b> of your own money, and " +
          sp.days + " days to make it grow.</div>" },

      { title: "Whose money is in the vault?",
        html: "<p>Here's the bit grown-ups forget to tell you. When Nan leaves " + M(2500) +
          " in your bank, those coins go in your vault — <b>but they're still hers</b>. " +
          "You owe her every one of them back.</p>" +
          minibar([["owed", 6000, "savers"], ["own", 6000, "yours"]]) +
          "<p>So the vault has two sorts of coins in it, and the picture at the top of the " +
          "screen shows you which is which, all game long.</p>" },

      { title: "And then you lend it out",
        html: "<p>Here's the surprising part: <b>you lend other people's money to somebody " +
          "else</b>. That's the whole job.</p>" +
          minibar([["silver", 3500, "in the vault"], ["out", 8500, "out on loan"]]) +
          "<p>Both bars are the same length, because it's the same money. The top bar says " +
          "<i>whose</i> it is. The bottom bar says <i>where</i> it is right now.</p>" +
          "<div class='demo'>Nan's " + M(2500) + " isn't sitting in a little box with her name " +
          "on it. It's out there being somebody's new bike.</div>" },

      { title: "Why does a bank pay you?",
        html: "<p>Because it wants your coins. If it didn't pay you, you'd keep them under " +
          "your mattress — and then it would have nothing to lend.</p>" +
          "<div class='demo'>You choose what to pay. Every night you pay that much for " +
          "<i>every dollar</i> anyone has left with you:<br>" +
          "<b>1c</b> a night → on " + M(book) + " that's " + nightly(1) + " a night<br>" +
          "<b>2c</b> a night → " + nightly(2) + "<br>" +
          "<b>3c</b> a night → " + nightly(3) + "</div>" +
          "<p>That's an <b>interest rate</b>. Pay too little and people go to the bank across " +
          "the street. Pay too much and it eats you alive.</p>" },

      { title: "The gap is the whole game",
        html: "<p>You also choose what to <i>charge</i> people who borrow. It's always more " +
          "than you pay savers, and the space in between is everything your bank earns.</p>" +
          "<div class='demo'>Charge borrowers <b>" + r + "c</b> a night<br>" +
          "Pay savers <b>" + s + "c</b> a night<br>" +
          "The gap is <span class='big-num'>" + (r - s) + "c</span>a night for every dollar " +
          "you've lent out.</div>" +
          "<p>Borrow " + M(amount) + " for " + nights + " nights at " + r + "c and you pay back " +
          "<b>" + M(repay) + "</b>. The bank keeps " + M(repay - amount) + " of that.</p>" },

      { title: "Money asleep costs you",
        html: "<p>You pay savers every night on <b>every dollar they've left with you</b> — " +
          "even the dollars still sitting in your vault doing nothing.</p>" +
          "<div class='demo'>So a vault full of coins isn't a good thing. It's a bill.</div>" +
          "<p>That's why a bank sometimes says <b>“no thank you”</b> to somebody's " +
          "money. If you can't lend it out, you don't want it.</p>" },

      { title: "Not everybody pays you back",
        html: "<p>Every borrower has stars. Look at them before you say yes.</p>" +
          "<div class='demo'>★★★ nearly always pays you back<br>" +
          "★★ usually pays you back<br>" +
          "★ often doesn't</div>" +
          "<p>Here's the trap. <b>Charge the most you can, and the careful people stop " +
          "coming.</b> Only " + Math.round(Bk.ACCEPT[3][10] * 100) + " out of 100 star-star-star " +
          "people will borrow at 10c — but " + Math.round(Bk.ACCEPT[1][10] * 100) +
          " out of 100 of the risky ones still will.</p>" +
          "<p>So your queue fills up with exactly the people who won't pay you back. No rate " +
          "is high enough to make that a good deal.</p>" },

      { title: "Keep some coins back",
        html: "<p>Savers turn up wanting their money, and it has to be there.</p>" +
          "<div class='demo'>Keep <b>a quarter</b> of the savers' money in the vault. There's " +
          "a red line on the picture showing you where that is.</div>" +
          "<p>If you lend past it and somebody wants their money, you have to ask a borrower " +
          "to pay you back early — and they'll only give you <b>75c in the dollar</b> for that. " +
          "The rest comes straight out of your own pile, and the town hears about it.</p>" },

      { title: "Ready?",
        html: "<p>Every morning: pick your two rates. Then open the doors and deal with " +
          "whoever walks in.</p>" +
          "<div class='demo'>Get your bank up to <b>" + M(target) + "</b> in " + sp.days +
          " days and it becomes " + sp.rungs[sp.rungs.length - 1].replace(/^\S+\s/, "") +
          ".</div>" +
          "<p>Look after people and more of the town will bank with you — and the more of " +
          "their money you're holding, the more you can lend.</p>" +
          "<p><b>Most banks won't get to the top</b>, and that's meant to be true. There are " +
          "three smaller things to grow into on the way.</p>" }
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
    if (at < list.length - 1) { at++; draw(); BB.Audio.tap(); } else close();
  }
  function back() { if (at > 0) { at--; draw(); BB.Audio.tap(); } }

  return { open, close, next, back, pages };
})();
