/* Bank Boss — everything that draws.                                           */
/*                                                                              */
/* No rules live here. bank.js decides what things come to; this file decides    */
/* how they look, and app.js decides when. The one thing worth reading twice is  */
/* vault(): every number it draws comes out of Bank.heaps(), so the picture and  */
/* the model cannot disagree about whose money is where — which matters more     */
/* here than anywhere else, because that picture IS the explanation.             */
/*                                                                              */
/* The rule this file was rewritten under: NOTHING ON SCREEN IS A RATE ALONE.    */
/* Every rate is shown next to what it comes to tonight, in dollars, against the */
/* books as they actually stand. "2c a night for every dollar" is a fact an      */
/* 8-year-old can read and cannot act on; "$3.38 tonight, and $1.69 if you drop  */
/* to 1c" is a decision. The first pass had the first kind everywhere.           */
"use strict";
window.BB = window.BB || {};

BB.Ui = (function () {
  const B = () => BB.Bank;
  const $ = (id) => document.getElementById(id);
  const money = (c) => BB.Bank.money(c);
  const rate = (c) => c + "c";

  const set = (id, text) => { const n = $(id); if (n) n.textContent = text; };
  const show = (id, on) => { const n = $(id); if (n) n.hidden = !on; };
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

  /* ── Phases ────────────────────────────────────────────────────────────── */

  const PHASES = ["rates", "counter", "night"];
  function phase(name) {
    for (const p of PHASES) show(p, p === name);
  }

  function toast(msg, ms) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }

  /* ── The vault ─────────────────────────────────────────────────────────── */

  // Two bars of the same length. The top one says whose the money is, the
  // bottom one says where it is. Everything comes from Bank.heaps().
  //
  // A segment worth nothing is removed rather than squeezed to a sliver, and a
  // segment too narrow for its label drops the label and keeps the number — a
  // stripe with nothing readable in it looks like a rendering bug, which is the
  // last thing the most important picture in the game should look like.
  function vault(run) {
    const Bk = B();
    const bank = run.bank;
    const h = Bk.heaps(bank);
    const posOwn = Math.max(0, h.own);
    const missing = Math.max(0, -h.own);
    const total = Math.max(1, h.owed + posOwn);

    set("vaultOwn", money(h.own));
    $("vaultOwn").style.color = h.own < 0 ? "var(--bad)" : "";

    // Last night's change, so the one number the child is scored on always says
    // which way it is going. A score with no direction on it is a number to
    // glance at; a score with an arrow is a thing to play towards.
    const last = run.ledger.length ? run.ledger[run.ledger.length - 1].kept : null;
    const move = $("vaultMove");
    if (last === null) { move.textContent = ""; move.className = ""; }
    else {
      move.textContent = (last >= 0 ? "▲ " : "▼ ") + money(Math.abs(last)) + " last night";
      move.className = last >= 0 ? "up" : "down";
    }

    seg("segOwed", "valOwed", h.owed, total);
    seg("segOwn", "valOwn", posOwn, total);
    seg("segCash", "valCash", h.cash, total);
    seg("segOut", "valOut", h.out, total);
    seg("segShort", "valShort", missing, total);

    // The purse: promised money on the left, lendable money on the right. This
    // replaced a dashed line drawn across the bar, which was a rule the child
    // could see and still not read a number off.
    const keep = Bk.reserveNeeded(run, bank);
    const free = Math.max(0, bank.cash - keep);
    set("purseKeep", money(keep));
    set("purseFree", money(free));
    const short = bank.cash < keep;
    $("purse").classList.toggle("short", short);

    // Only ever a warning. The line used to read "$153.25 of the money in this
    // bank belongs to other people" the rest of the time, which is the blue bar
    // spelled out in words directly underneath the blue bar — and a line that is
    // usually furniture is a line nobody reads on the day it turns red.
    const note = $("vaultNote");
    show("vaultNote", short || missing > 0);
    note.classList.add("warn");
    if (missing > 0) {
      note.textContent = "⚠️ Your bank owes " + money(missing) + " more than it has got.";
    } else if (short) {
      note.textContent = "⚠️ You've lent out money you promised somebody. Don't lend any more today.";
    }
  }

  function seg(id, valId, value, total) {
    const n = $(id);
    const pct = (value / total) * 100;
    n.classList.toggle("gone", value <= 0);
    n.classList.toggle("tiny", pct < 22);
    n.classList.toggle("min", pct < 20);
    n.classList.toggle("nano", pct < 10);
    n.style.width = Math.max(0, pct) + "%";
    // A narrow segment drops the cents rather than the number. "$12" in 30px of
    // orange still says how much is out on loan; "$12.5" clipped in half says
    // the page is broken. The exact figure is in the purse under the bars.
    set(valId, pct < 20 ? "$" + Math.round(value / 100) : money(value));
  }

  // Coins actually leaving the vault and going out of the door. Without this the
  // bars just resize, and a bar resizing is not a thing happening to money.
  function coins(dir) {
    const host = $("coinFly");
    if (!host) return;
    host.textContent = "";
    const out = dir === "out";
    for (let i = 0; i < 5; i++) {
      const c = document.createElement("i");
      c.textContent = "🪙";
      c.style.left = (out ? 18 : 74) + i * 3 + "%";
      c.style.top = "50%";
      c.style.setProperty("--dx", (out ? 1 : -1) * (90 + i * 14) + "px");
      c.style.setProperty("--dy", (i % 2 ? -8 : 6) + "px");
      c.style.animationDelay = i * 0.05 + "s";
      host.appendChild(c);
    }
    setTimeout(() => { host.textContent = ""; }, 1000);
  }

  function topbar(run) {
    set("dayLabel", "Day " + run.day);
    set("dayMeta", run.day >= run.days ? "the last day" : "of " + run.days);
  }

  /* ── The morning ───────────────────────────────────────────────────────── */

  // What today holds, printed before a single decision is made. Two halves: what
  // already happened this morning, and who is on their way in.
  function board(run) {
    const Bk = B();
    const bank = run.bank;
    const f = Bk.forecast(run);
    const t = bank.today || { back: [], bad: [] };
    const rows = [];

    // One row per KIND of news, not one per person. Three loans coming home on
    // the same morning used to be three rows all ending "that money is in your
    // vault again", which on a phone pushed the two dials — the only decision on
    // the screen — clean below the fold.
    if (t.back.length === 1) {
      rows.push(["💸", Bk.person(t.back[0].id).name + " brought back " + money(t.back[0].amount),
        "that money is in your vault again", false]);
    } else if (t.back.length > 1) {
      const total = t.back.reduce((a, l) => a + l.amount, 0);
      rows.push(["💸", t.back.length + " loans came back",
        money(total) + " is in your vault again", false]);
    }

    if (t.bad.length === 1) {
      const l = t.bad[0];
      rows.push(["💔", Bk.person(l.id).name + (l.back > 0
        ? " could only pay back " + money(l.back) + " of " + money(l.amount)
        : " never paid back " + money(l.amount)),
        "you lost " + money(l.lost), true]);
    } else if (t.bad.length > 1) {
      const lost = t.bad.reduce((a, l) => a + l.lost, 0);
      rows.push(["💔", t.bad.length + " loans weren't paid back",
        "you lost " + money(lost), true]);
    }
    if (f.leaving > 0) {
      rows.push(["🔙", plural(f.leaving, "person wants", "people want") + " their savings back",
        money(f.leavingAmount) + " has to be in the vault for them", true]);
    }
    // One row for the queue, not two. The counts are the news; "you say yes or
    // no to each one" and "you pay for it every night" are rules the child meets
    // at the counter and on the night screen, where they bite.
    const coming = f.borrowers + f.savers;
    if (f.borrowers && f.savers) {
      rows.push(["🚶", plural(coming, "person is", "people are") + " coming in",
        f.borrowers + " to borrow · " + f.savers + " to leave money with you", false]);
    } else if (f.borrowers) {
      // Only one kind today, so the split would just say the count again — the
      // line underneath is free to say what the day actually asks of you.
      rows.push(["🤝", plural(coming, "person is", "people are") + " coming to borrow",
        "you say yes or no to each one", false]);
    } else if (f.savers) {
      rows.push(["💰", plural(coming, "person has", "people have") + " money to leave with you",
        "you pay for it every night, lent out or not", false]);
    }
    if (!rows.length) rows.push(["🌤️", "A quiet day", "nobody much is coming in", false]);

    set("boardTitle", run.day >= run.days
      ? "📋 The last day — no more borrowing" : "📋 Today at the bank");
    const host = $("boardList");
    host.textContent = "";
    for (const [emoji, what, why, bad] of rows) {
      const n = document.createElement("div");
      n.className = "cause";
      n.innerHTML = '<span class="cause-emoji">' + emoji + "</span>" +
        '<span class="cause-body"><span class="cause-did">' + what + "</span>" +
        '<span class="cause-so"><b' + (bad ? ' class="bad"' : "") + ">" + why + "</b></span></span>";
      host.appendChild(n);
    }
  }

  // A rate tile carries the rate AND what that rate costs or earns tonight, on
  // the money actually in the books. Three tiles, three real numbers, and the
  // decision makes itself visible.
  //
  // Except on day one, when nothing is out on loan and all three loan tiles
  // price at $0.00. Three identical zeros at the very moment the child picks a
  // loan rate for the first time say the choice does not matter, which is the
  // opposite of true — so when there is nothing to price the money line is left
  // off and the tile is the rate and who it brings through the door.
  function rateTiles(id, values, current, priceOf, hintOf) {
    const host = $(id);
    const priced = values.some((v) => priceOf(v) > 0);
    host.textContent = "";
    for (const v of values) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt" + (v === current ? " on" : "");
      b.dataset.value = v;
      b.innerHTML = rate(v) + (priced ? "<em>" + money(priceOf(v)) + "</em>" : "") +
        "<small>" + hintOf(v) + "</small>";
      host.appendChild(b);
    }
  }

  // How the town reads each rung of the dial. Generated from the model's own
  // tables, so a tuning change cannot leave the words behind.
  function saveHint(v) {
    const p = B().DEPOSIT_CHANCE[v];
    return p >= 0.9 ? "most bring it" : p >= 0.6 ? "some bring it" : "few bring it";
  }
  function loanHint(v) {
    const a = B().ACCEPT[3][v];
    return a >= 0.85 ? "everyone asks" : a >= 0.6 ? "careful folk ask" : "only risky folk";
  }

  function rates(run, opts) {
    const Bk = B();
    const bank = run.bank;
    const o = opts || {};
    topbar(run);
    vault(run);
    board(run);

    set("saveNow", rate(bank.saveRate));
    set("loanNow", rate(bank.loanRate));
    rateTiles("saveChooser", Bk.SAVE_RATES, bank.saveRate,
      (v) => Bk.nightlyOn(bank.deposits, v), saveHint);
    rateTiles("loanChooser", Bk.LOAN_RATES, bank.loanRate,
      (v) => Bk.nightlyOn(bank.loansOut, v), loanHint);

    // The two totals and the gap between them, and nowhere else. Each dial used
    // to carry a two-line paragraph saying what its own tiles already said, and
    // then this said it a third time.
    const t = Bk.tonightAt(run);
    set("gapIn", money(t.in));
    set("gapOut", money(t.out));
    set("gapSize", money(t.kept));
    // No "because you pay out more than you take in" tail: the line underneath
    // is the two amounts side by side, which says it better and in fewer words.
    set("gapSay", t.kept >= 0
      ? "is what your bank keeps tonight"
      : "is what tonight COSTS you");
    $("gapMid").parentNode.classList.toggle("thin", t.kept < 0);

    show("coach", !!o.tip);
    if (o.tip) set("coachText", o.tip);
  }

  /* ── The counter ───────────────────────────────────────────────────────── */

  function queueStrip(run) {
    const host = $("queueStrip");
    host.textContent = "";
    run.queue.forEach((c, i) => {
      const d = document.createElement("i");
      d.className = c.done ? "done" : i === run.at ? "now" : "";
      host.appendChild(d);
    });
  }

  const row = (label, value, cls, sub) =>
    '<div class="deal-line ' + (cls || "") + '"><span>' + label +
    (sub ? "<i>" + sub + "</i>" : "") + "</span><strong>" + value + "</strong></div>";

  // What you know about this person, in one short line. Stars never change, so
  // this is knowledge worth having rather than a dice roll wearing a badge — and
  // the tally next to them is the child's own evidence for it.
  //
  // Only what bears on saying yes. The full tally — what a let-down cost, how
  // much they have saved with you — is a sentence long enough to be skipped, and
  // it is all in 📒 the books for anyone who wants it.
  function history(bank, p) {
    const r = bank.record[p.id];
    if (!r || !r.lent) return "You've never lent to " + p.name + " before.";
    const done = [];
    if (r.repaid) done.push("paid you back " + r.repaid + "×");
    if (r.broke) done.push("let you down " + r.broke + "×");
    const out = r.lent - r.repaid - r.broke;
    if (out > 0) done.push(out + " still out with them");
    return "You've lent to " + p.name + " " + plural(r.lent, "time", "times") +
      (done.length ? ": " + done.join(", ") : "") + ".";
  }

  // One card, one person, everything the decision needs on it at once. The first
  // pass split this over two or three beats and put the stars on the second one,
  // so the question arrived before the facts did.
  function person(run, out, opts) {
    const Bk = B();
    const o = opts || {};
    const c = out.customer;
    const p = out.person;
    const bank = run.bank;

    queueStrip(run);
    vault(run);
    $("personCard").classList.toggle("mine", !!out.asking);
    set("personFace", p.emoji);
    set("personName", p.name);
    show("fireBox", false);

    // Stars only matter for lending, so they only appear when lending is on the
    // table. On a saver's card three stars would be answering a question nobody
    // asked.
    if (c.kind === "borrow") {
      const words = { 3: "nearly always pays you back", 2: "usually pays you back",
        1: "often doesn't pay you back" };
      $("personStars").innerHTML = "★".repeat(p.star) + "☆".repeat(3 - p.star) +
        "<small>" + words[p.star] + "</small>";
      show("personStars", true);
      set("personHistory", history(bank, p));
      show("personHistory", true);
    } else {
      show("personStars", false);
      show("personHistory", false);
    }

    if (out.asking) return ask(run, out);

    show("dealBox", false);
    show("sayYes", false);
    show("sayNo", false);
    show("cardNext", true);
    if (out.fire) fireNote(out.fire);

    const res = $("personResult");
    res.hidden = false;
    res.className = "person-result";

    if (c.kind === "withdraw") {
      if (out.short) {
        res.classList.add("bad");
        res.textContent = "You couldn't find " + p.name + "'s money. That's the worst thing a " +
          "bank can do, and the whole town hears about it.";
        set("personSay", p.name + " came for their savings — " + money(c.amount) + ".");
      } else {
        res.classList.add("took");
        res.textContent = "You handed over " + money(out.paidOut) + "." +
          (out.interest > 0
            ? " " + money(out.interest) + " of that was interest for letting you look after it."
            : "");
        set("personSay", p.name + " came for their savings back.");
        coins("out");
      }
    } else if (out.walked) {
      res.classList.add("meh");
      set("personSay", c.kind === "save"
        ? p.name + " has " + money(c.amount) + " and is looking for a bank."
        : p.name + " wanted to borrow " + money(c.amount) + " for " + c.why + ".");
      res.textContent = p.name + " " + out.why + " and went home.";
    } else if (out.took) {
      res.classList.add("took");
      set("personSay", p.name + " is leaving " + money(out.took) + " with you for " +
        plural(out.nights, "night", "nights") + ".");
      res.textContent = "You owe " + p.name + " that " + money(out.took) + " back — but you can " +
        "lend it out first. It costs you " + money(out.costsNightly) + " a night either way.";
      coins("in");
    } else if (out.lent) {
      res.classList.add("lent");
      set("personSay", p.name + " is borrowing " + money(out.lent) + " for " + c.why + ".");
      res.textContent = money(out.lent) + " walks out of the vault. " + p.name + " pays you " +
        money(out.nightly) + " a night, and brings the " + money(out.lent) + " back on day " +
        out.due + ".";
      coins("out");
    } else if (out.refused) {
      res.classList.add("meh");
      set("personSay", p.name + " wanted to borrow " + money(c.amount) + " for " + c.why + ".");
      res.textContent = "You said no. " + p.name + " went away without it.";
    } else {
      res.classList.add("meh");
      res.textContent = "Nothing came of it.";
    }
  }

  // The decision, in two lines: what saying yes earns, and when the money comes
  // home. That is the whole of it.
  //
  // This was a seven-row table. "They want $62.50" repeated the sentence right
  // above it; "They'd pay you $5.00 every night" and "For 5 nights" were the
  // working for "So you'd earn $25.00" and now sit under it as the working;
  // "Left in the vault after this" and "…and you've promised savers" were two
  // numbers a child had to subtract to reach a conclusion the line underneath
  // already states in words. Seven rows for a yes-or-no question is an
  // accountant's screen, and none of the four that went taught anything the
  // remaining three don't.
  function ask(run, out) {
    const c = out.customer;
    const p = out.person;
    const box = $("dealBox");
    const clear = out.leaves - out.keep;

    set("personSay", p.name + " wants to borrow " + money(c.amount) + " for " + c.why + ".");
    box.innerHTML =
      row("You'd earn", money(out.interest), "earn",
        money(out.nightly) + " a night for " + plural(c.nights, "night", "nights")) +
      row("You get the " + money(c.amount) + " back on", "day " + out.due);

    show("dealBox", true);
    show("personResult", true);
    const res = $("personResult");
    res.className = "person-result " + (out.belowLine || !out.canPay ? "bad" : "meh");
    if (!out.canPay) {
      res.textContent = "You've only got " + money(run.bank.cash) + " in the vault. You can't " +
        "lend coins you haven't got.";
    } else if (out.belowLine) {
      res.textContent = "⚠️ You've promised savers " + money(out.keep) + ". Lend this and you're " +
        money(-clear) + " short of it.";
    } else if (out.keep > 0) {
      res.textContent = "You'd still have " + money(clear) + " spare after everything you've " +
        "promised savers.";
    } else {
      // Nothing promised in the next couple of days, so naming savers here would
      // be answering a question the board has not asked yet.
      res.textContent = "You'd still have " + money(clear) + " left in the vault.";
    }

    $("sayYes").textContent = out.belowLine ? "Lend it anyway" : "Lend " + money(c.amount);
    $("sayYes").classList.toggle("btn-risky", out.belowLine);
    $("sayNo").textContent = "No thanks";
    $("sayYes").disabled = !out.canPay;
    show("sayYes", true);
    show("sayNo", true);
    show("cardNext", false);
  }

  function fireNote(fire) {
    const box = $("fireBox");
    box.hidden = false;
    box.innerHTML = "<b>🔥 You had to call your loans in early</b>" +
      "The coins weren't there, so you asked borrowers for " + money(fire.raised) +
      " back before it was due. People only give you 75c in the dollar for that — " +
      "it cost you <b style='display:inline'>" + money(fire.lost) + "</b>.";
  }

  /* ── The end of the day ────────────────────────────────────────────────── */

  // One screen and one sum, the same shape every single day: what came in, what
  // went out, what is left. The first pass walked five cards with a dot strip,
  // and four of them were narration around this one.
  function night(run, rep) {
    const Bk = B();
    const bank = run.bank;
    phase("night");
    topbar(run);
    vault(run);

    const settled = rep.back.length + rep.bad.length;
    show("settledCard", settled > 0);
    if (settled) {
      const host = $("settledList");
      host.textContent = "";
      for (const l of rep.back) {
        host.appendChild(settle(Bk.person(l.id), "paid", "brought your money back",
          "you kept every night's interest they paid", "+ " + money(l.amount)));
      }
      for (const l of rep.bad) {
        host.appendChild(settle(Bk.person(l.id), "bad",
          l.back > 0 ? "could only pay back " + money(l.back) : "never paid you back",
          "you lost " + money(l.lost), "- " + money(l.lost)));
      }
    }

    set("sumsHead", "🌙 What your bank made on day " + rep.day);
    set("sumInWhy", rep.lentOut > 0
      ? rate(rep.loan) + " a night on " + money(rep.lentOut) + " out on loan" : "nothing was out on loan");
    set("sumOutWhy", rep.held > 0
      ? rate(rep.save) + " a night on " + money(rep.held) + " they've left with you" : "nobody had money with you");
    set("sumIn", "+ " + money(rep.interestIn));
    set("sumOut", "- " + money(rep.interestOut));
    show("sumBadRow", rep.badDebt > 0);
    set("sumBad", "- " + money(rep.badDebt));
    show("sumFireRow", rep.fire > 0);
    set("sumFire", "- " + money(rep.fire));
    set("sumTotal", (rep.kept < 0 ? "- " : "+ ") + money(Math.abs(rep.kept)));
    $("sumTotalRow").classList.toggle("loss", rep.kept < 0);

    set("trustCount", rep.trustAfter + " of " + Bk.TOWNSFOLK);
    townFolk(rep.trustAfter);
    const moved = rep.trustAfter - rep.trustBefore;
    set("trustNote", moved > 0
      ? "You looked after people today, so one more of the town joined your bank."
      : moved < 0
      ? "You let somebody down, so " + Math.abs(moved) + " of the town left. Word gets round fast."
      : "Nobody changed their mind about you today.");

    causes(run, bank, rep);
  }

  function settle(p, cls, what, why, amt) {
    const n = document.createElement("div");
    n.className = "settle " + cls;
    n.innerHTML = '<span class="settle-face">' + p.emoji + '</span>' +
      '<span class="settle-what">' + p.name + " " + what + "<small>" + why + "</small></span>" +
      '<span class="settle-amt">' + amt + "</span>";
    return n;
  }

  function townFolk(n) {
    const host = $("townFolk");
    host.textContent = "";
    B().TOWN.forEach((p, i) => {
      const s = document.createElement("span");
      s.textContent = p.emoji;
      if (i < n) s.className = "in";
      host.appendChild(s);
    });
  }

  // Every decision next to what it actually caused. A night that reports
  // outcomes without naming the choice that produced them is a scoreboard, not
  // a lesson.
  function causes(run, bank, rep) {
    const Bk = B();
    const list = [];
    const t = bank.today;
    const idle = Bk.spare(run, bank);
    if (t.lent > 0) {
      list.push(["🤝", "You lent out " + money(t.lent) + " at " + rate(bank.loanRate) + " a night",
        "that money is working instead of sitting there", false]);
    }
    if (idle > 8000) {
      list.push(["😴", money(idle) + " sat in the vault doing nothing",
        "you still paid " + rate(bank.saveRate) + " a night on every dollar of it", true]);
    }
    if (t.refused > 0) {
      list.push(["🙅", "You said no to " + plural(t.refused, "borrower", "borrowers"),
        "no loan is better than one that never comes back", false]);
    }
    if (rep.bad.length) {
      list.push(["💔", plural(rep.bad.length, "loan", "loans") + " went wrong",
        "that cost you " + money(rep.badDebt) + " — check the stars first", true]);
    }
    if (t.fire > 0) {
      list.push(["🔥", "You ran out of coins and called loans in",
        "it cost " + money(t.fire) + " — never lend money you've promised somebody", true]);
    }
    if (t.missed > 0) {
      list.push(["🚨", "Somebody asked for their money and you hadn't got it",
        "five of the town closed their accounts", true]);
    }
    show("causes", list.length > 0);
    const host = $("causeList");
    host.textContent = "";
    for (const [emoji, did, so, bad] of list) {
      const n = document.createElement("div");
      n.className = "cause";
      n.innerHTML = '<span class="cause-emoji">' + emoji + "</span>" +
        '<span class="cause-body"><span class="cause-did">' + did + "</span>" +
        '<span class="cause-so">→ <b' + (bad ? ' class="bad"' : "") + ">" + so + "</b></span></span>";
      host.appendChild(n);
    }
  }

  /* ── The books ─────────────────────────────────────────────────────────── */

  function books(run) {
    const Bk = B();
    const bank = run.bank;

    const loans = $("bookLoans");
    loans.textContent = "";
    if (!bank.loans.length) {
      loans.innerHTML = '<p class="empty-note">Nothing out on loan. Every coin is in the vault ' +
        '— and every coin in the vault is costing you.</p>';
    }
    for (const l of bank.loans.slice().sort((a, b2) => a.due - b2.due)) {
      loans.appendChild(entry("loan", Bk.person(l.id), money(l.amount) + " for " + l.why,
        "pays you " + money(Bk.nightlyOn(l.amount, bank.loanRate)) +
        " a night · back on day " + l.due, money(l.amount), l.due <= run.day + 1));
    }

    const savers = $("bookSavers");
    savers.textContent = "";
    if (!bank.savers.length) {
      savers.innerHTML = '<p class="empty-note">Nobody has money with you right now.</p>';
    }
    for (const s of bank.savers.slice().sort((a, b2) => a.due - b2.due)) {
      savers.appendChild(entry("saver", Bk.person(s.id), money(s.amount) + " saved",
        (s.due > run.days ? "staying till you close" : "wants it on day " + s.due) +
        " · you've paid them " + money(s.paid),
        money(s.amount + s.paid), s.due <= run.day + 1));
    }

    // Everybody you have dealt with. The stars are the fact; the tally beside
    // them is the child's own evidence for it, which is the bit that turns a
    // badge into knowledge.
    const people = $("bookPeopleList");
    people.textContent = "";
    const known = Bk.TOWN.filter((p) => bank.record[p.id]);
    if (!known.length) {
      people.innerHTML = '<p class="empty-note">You haven\'t dealt with anybody yet.</p>';
    }
    for (const p of known.sort((a, b2) => b2.star - a.star)) {
      const r = bank.record[p.id];
      const bits = [];
      if (r.lent) {
        const out = r.lent - r.repaid - r.broke;
        bits.push("lent " + r.lent + "× · paid back " + r.repaid + " · let you down " + r.broke +
          (out > 0 ? " · " + out + " still out" : ""));
      }
      if (r.saved) bits.push("brought you " + money(r.saved));
      people.appendChild(entry("who", p, "★".repeat(p.star) + "☆".repeat(3 - p.star),
        bits.join(" · "), r.cost > 0 ? "-" + money(r.cost) : "", false));
    }

    // What each pair of rates actually came to. This is the screen that makes
    // the morning dials a decision with a memory behind it.
    const rateList = $("bookRatesList");
    rateList.textContent = "";
    const hist = Bk.rateHistory(run);
    if (!hist.length) {
      rateList.innerHTML = '<p class="empty-note">Play a night and your rates will show up here.</p>';
    }
    for (const h of hist) {
      const n = document.createElement("div");
      n.className = "entry rate" + (h.kept < 0 ? " bad" : "");
      n.innerHTML = '<span class="entry-face">' + (h.kept >= 0 ? "📈" : "📉") + "</span>" +
        '<span class="entry-what">pay ' + rate(h.save) + " · charge " + rate(h.loan) +
        "<small>" + plural(h.nights, "night", "nights") + " at these rates</small></span>" +
        '<span class="entry-amt">' + (h.kept < 0 ? "-" : "+") + money(Math.abs(h.kept)) + "</span>";
      rateList.appendChild(n);
    }
  }

  function entry(cls, p, what, why, amt, due) {
    const n = document.createElement("div");
    n.className = "entry " + cls + (due ? " due" : "");
    n.innerHTML = '<span class="entry-face">' + p.emoji + "</span>" +
      '<span class="entry-what">' + p.name + " · " + what + "<small>" + why + "</small></span>" +
      '<span class="entry-amt">' + amt + "</span>";
    return n;
  }

  function bookTab(which) {
    show("bookNow", which === "now");
    show("bookPeople", which === "people");
    show("bookRates", which === "rates");
    for (const b of $("bookTabs").querySelectorAll(".opt")) {
      b.classList.toggle("on", b.dataset.value === which);
    }
  }

  /* ── Result ────────────────────────────────────────────────────────────── */

  function result(run, best) {
    const Bk = B();
    const s = Bk.summary(run);
    const sp = Bk.spec(run.difficulty);

    set("payoffSay", "Your bank is worth");
    set("resultFinal", money(s.own));
    $("resultFinal").classList.toggle("loss", s.own < Bk.START_OWN);

    const rung = s.rung;
    const emoji = rung > 0 ? sp.rungs[rung - 1].split(" ")[0] : "🪙";
    const pe = $("prizeEmoji");
    // Rebuilt rather than retyped, because a CSS animation only plays on a node
    // that is new to the document.
    const fresh = pe.cloneNode(false);
    fresh.textContent = rung > 0 ? emoji : "🫙";
    pe.parentNode.replaceChild(fresh, pe);
    fresh.id = "prizeEmoji";
    $("prize").classList.toggle("locked", rung === 0);
    if (rung > 0) confetti();

    set("resultTitle", rung >= sp.goal.length ? "A real bank!"
      : rung > 0 ? "You grew it into " + sp.rungs[rung - 1].replace(/^\S+\s/, "")
      : s.grew >= 0 ? "You kept the doors open" : "Your bank lost money");
    set("resultSub", s.grew >= 0
      ? "You started with " + money(Bk.START_OWN) + " and finished with " + money(s.own) +
        ". Every cent of the difference came out of the gap between what you paid savers " +
        "and what borrowers paid you."
      : "You started with " + money(Bk.START_OWN) + " and finished with " + money(s.own) +
        ". A bank that lends money can lose money — that's exactly why it charges more " +
        "than it pays.");

    ladder(sp, s.own);
    BB.Chart.render($("chart"), run);

    set("grewLine", "You started with " + Bk.START_TRUST + " people banking with you and " +
      "finished with " + s.trust + " of the " + Bk.TOWNSFOLK + " in town. At your busiest you " +
      "looked after " + money(peakDeposits(run)) + " of their money, and borrowers paid you " +
      money(s.earned) + " to use it.");
    set("takeaway", Bk.takeaway(run));

    const st = [];
    if (s.fires === 0) st.push("🧊");
    if (s.badDebts === 0) st.push("🎯");
    if (s.trust >= Bk.TOWNSFOLK - 3) st.push("🤝");
    if (rung >= sp.goal.length) st.push("🏛️");
    $("stickers").textContent = st.join(" ");

    const bl = $("resultBest");
    if (best > 0) {
      bl.textContent = "🏅 Your best " + sp.days + "-day bank: " + money(best);
      bl.hidden = false;
    } else bl.hidden = true;
  }

  const peakDeposits = (run) =>
    run.ledger.reduce((m, r) => Math.max(m, r.deposits), 0);

  function ladder(sp, own) {
    const host = $("ladder");
    host.textContent = "";
    sp.goal.forEach((cost, i) => {
      const got = own >= cost;
      const n = document.createElement("div");
      n.className = "rung" + (got ? " got" : "");
      const name = sp.rungs[i];
      n.innerHTML = '<span class="rung-emoji">' + name.split(" ")[0] + "</span>" +
        '<span class="rung-what">' + name.replace(/^\S+\s/, "") +
        (got ? "" : '<span class="rung-miss">' + money(cost - own) + " more and it was yours</span>") +
        "</span>" +
        '<span class="rung-cost">' + money(cost) + "</span>" +
        '<span class="rung-tick">' + (got ? "✅" : "🔒") + "</span>";
      host.appendChild(n);
    });
  }

  function confetti() {
    const host = $("prizeBurst");
    host.textContent = "";
    const colours = ["var(--accent)", "var(--own)", "var(--gold)", "var(--owed)"];
    for (let i = 0; i < 18; i++) {
      const b = document.createElement("i");
      const a = (i / 18) * Math.PI * 2;
      b.style.background = colours[i % colours.length];
      b.style.setProperty("--dx", Math.cos(a) * 105 + "px");
      b.style.setProperty("--dy", Math.sin(a) * 105 + "px");
      b.style.setProperty("--rot", i * 47 + "deg");
      b.style.animationDelay = i * 0.012 + "s";
      host.appendChild(b);
    }
  }

  return { phase, toast, vault, coins, topbar, board, rates, rateTiles,
           person, queueStrip, night, books, bookTab, result };
})();
