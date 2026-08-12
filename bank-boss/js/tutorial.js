/* Bank Boss — the how-to lesson.                                               */
/*                                                                              */
/* FIVE short pages, down from nine. Every figure on them is computed by calling */
/* the real model rather than typed in, so the lesson cannot drift away from the */
/* game when a number is tuned.                                                  */
/*                                                                              */
/* What the nine pages got wrong is worth writing down, because it is a trap any */
/* teaching game walks into: the lesson had grown a page for every mechanic, and */
/* an 8-year-old met nine screens of reading before touching a single button.    */
/* Four of those pages are now things the game itself says at the moment they    */
/* matter — the vault chip names the keep-back number, the loan card carries the */
/* stars and the history, the morning board prices both dials in real dollars.   */
/* A rule explained where it bites does not need a page up front.                */
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

    // A worked example, from the real arithmetic. $40 lent for 4 nights at the
    // middle rate, against $200 of savings at the middle rate.
    const loan = 4000, nights = 4, r = 8, s = 2, book = 20000;
    const perNight = Bk.nightlyOn(loan, r);
    const total = Bk.interestOver(loan, r, nights);

    return [
      { title: "You're the bank",
        html: "<p>This isn't your piggy bank. It's <b>the bank</b>, and you're in charge of it.</p>" +
          "<p>All day people come to the counter. Some want to leave their money with you. " +
          "Some want to borrow money for a scooter or a puppy or fixing their van.</p>" +
          "<div class='demo'>You start with <b>" + M(Bk.START_OWN) + "</b> of your own money, " +
          "and " + sp.days + " days to make it grow.</div>" },

      { title: "Whose money is in the vault?",
        html: "<p>Here's the bit grown-ups forget to tell you. When Nan leaves " + M(2500) +
          " in your bank, those coins go in your vault — <b>but they're still hers</b>. " +
          "You owe her every one of them back.</p>" +
          minibar([["owed", 6000, "savers"], ["own", 6000, "yours"]]) +
          "<p>And here's the surprising part: <b>you lend other people's money to somebody " +
          "else</b>. That's the whole job.</p>" +
          minibar([["silver", 3500, "in the vault"], ["out", 8500, "out on loan"]]) +
          "<p>Both bars are the same length, because it's the same money. The top one says " +
          "<i>whose</i> it is. The bottom one says <i>where</i> it is right now.</p>" },

      { title: "The gap is the whole game",
        html: "<p>Every night, two things happen. <b>Borrowers pay you</b> a little for every " +
          "dollar they've got of yours. And <b>you pay savers</b> a little for every dollar " +
          "they've left with you.</p>" +
          "<div class='demo'>Lend " + M(loan) + " at <b>" + r + "c</b> a night → they pay you " +
          "<b>" + M(perNight) + "</b> every night, and give the " + M(loan) + " back after " +
          nights + " nights. You keep <b>" + M(total) + "</b>.<br><br>" +
          "But " + M(book) + " of savings at <b>" + s + "c</b> a night costs you <b>" +
          M(Bk.nightlyOn(book, s)) + "</b> every night — on <i>all</i> of it, even the coins " +
          "still sitting in your vault doing nothing.</div>" +
          "<p>The space between those two numbers is <b>everything your bank earns</b>. " +
          "That's what an interest rate is for.</p>" },

      { title: "Two things will catch you out",
        html: "<p><b>1. Not everybody pays you back.</b> Look at the stars before you say yes.</p>" +
          "<div class='demo'>★★★ nearly always pays you back<br>" +
          "★★ usually pays you back<br>★ often doesn't</div>" +
          "<p>And here's the trap: <b>charge the most you can and the careful people stop " +
          "coming</b>. Only " + Math.round(Bk.ACCEPT[3][10] * 100) + " out of 100 ★★★ people " +
          "will borrow at 10c — but " + Math.round(Bk.ACCEPT[1][10] * 100) + " out of 100 of " +
          "the risky ones still will. No rate is high enough to make that a good deal.</p>" +
          "<p><b>2. You can't lend money you've promised.</b> Savers say which day they want " +
          "theirs back, and the vault shows you that number as <b>🔒 promised to savers</b>. " +
          "Lend past it and you'll have to ask a borrower to pay early — they'll only give you " +
          "<b>75c in the dollar</b>, and the town hears about it.</p>" },

      { title: "Ready?",
        html: "<p>Every morning the board tells you who's coming in today. Then you pick your " +
          "two rates — <b>each tile shows what it costs or earns tonight</b>, in real money — " +
          "and open the doors.</p>" +
          "<p>The only question at the counter is <b>lend it, or don't</b>.</p>" +
          "<div class='demo'>Get your bank up to <b>" + M(target) + "</b> in " + sp.days +
          " days and it becomes " + sp.rungs[sp.rungs.length - 1].replace(/^\S+\s/, "") +
          ". There are three smaller things to grow into on the way.</div>" +
          "<p>Stuck? The <b>📒 books</b> in the menu remember everything — who owes you what, " +
          "who let you down before, and what each pair of rates has actually earned you.</p>" }
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
