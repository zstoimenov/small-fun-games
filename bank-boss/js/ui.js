/* Bank Boss — everything that draws.                                           */
/*                                                                              */
/* No rules live here. bank.js decides what things come to; this file decides    */
/* how they look, and app.js decides when. The one thing worth reading twice is  */
/* vault(): every number it draws comes out of Bank.heaps(), so the picture and  */
/* the model cannot disagree about whose money is where — which matters more     */
/* here than anywhere else, because that picture IS the explanation.             */
"use strict";
window.BB = window.BB || {};

BB.Ui = (function () {
  const B = () => BB.Bank;
  const $ = (id) => document.getElementById(id);
  const money = (c) => BB.Bank.money(c);
  const rate = (c) => c + "c";

  const set = (id, text) => { const n = $(id); if (n) n.textContent = text; };
  const show = (id, on) => { const n = $(id); if (n) n.hidden = !on; };

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
  function vault(run, which) {
    const Bk = B();
    const bank = run.banks[which === undefined ? 0 : which];
    const h = Bk.heaps(bank);
    const posOwn = Math.max(0, h.own);
    const missing = Math.max(0, -h.own);
    const total = Math.max(1, h.owed + posOwn);

    set("vaultWho", run.mode === "duo" || which ? bank.name : "Your bank");
    set("vaultOwn", money(h.own));
    $("vaultOwn").style.color = h.own < 0 ? "var(--bad)" : "";

    seg("segOwed", "valOwed", h.owed, total);
    seg("segOwn", "valOwn", posOwn, total);
    seg("segCash", "valCash", h.cash, total);
    seg("segOut", "valOut", h.out, total);
    seg("segShort", "valShort", missing, total);

    // The keep-back line sits at a quarter of the savers' money, measured from
    // the left of the where-it-is bar — which is where the vault segment starts.
    const reserve = Bk.reserveNeeded(bank);
    const at = Math.min(100, (reserve / total) * 100);
    $("keepLine").style.left = at + "%";
    $("keepLine").hidden = h.owed <= 0;
    set("keepSay", h.owed > 0 ? "· keep back " + money(reserve) : "");

    const below = h.cash < reserve;
    $("vault").classList.toggle("below", below);
    const note = $("vaultNote");
    note.classList.toggle("warn", below || missing > 0);
    if (missing > 0) {
      note.textContent = "⚠️ Your bank owes " + money(missing) + " more than it has got.";
    } else if (below) {
      note.textContent = "⚠️ Below the line. If somebody wants their money you'll have to " +
        "call your loans in early.";
    } else {
      note.textContent = money(h.owed) + " of the money in this bank belongs to other people.";
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
    // the page is broken. The exact figure is in the line under the bars.
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
      c.style.top = "62%";
      c.style.setProperty("--dx", (out ? 1 : -1) * (90 + i * 14) + "px");
      c.style.setProperty("--dy", (i % 2 ? -8 : 6) + "px");
      c.style.animationDelay = i * 0.05 + "s";
      host.appendChild(c);
    }
    setTimeout(() => { host.textContent = ""; }, 1000);
  }

  /* ── Topbar and goal ───────────────────────────────────────────────────── */

  function topbar(run) {
    set("dayLabel", "Day " + run.day);
    set("dayMeta", "of " + run.days);
  }

  function goal(run) {
    const Bk = B();
    const sp = Bk.spec(run.difficulty);
    const own = run.banks[0].own;
    const top = sp.goal[sp.goal.length - 1];
    const rung = Bk.rungReached(own, sp.goal);
    // Measured from where you STARTED, not from zero. From zero the bar is
    // three quarters full before the doors open on day one, which makes the
    // first rung look like a formality — it is not, it is the run's whole first
    // week of work.
    const from = Bk.START_OWN;
    const pct = ((own - from) / Math.max(1, top - from)) * 100;
    $("goalFill").style.width = Math.max(0, Math.min(100, pct)) + "%";
    if (rung >= sp.goal.length) {
      set("goalLabel", "🏛️ " + sp.rungs[sp.rungs.length - 1] + " — you got there!");
    } else {
      const next = sp.goal[rung];
      set("goalLabel", sp.rungs[rung] + " at " + money(next) +
        " — " + money(Math.max(0, next - own)) + " to go");
    }
  }

  /* ── The morning: two dials ────────────────────────────────────────────── */

  function rateTiles(id, values, current, hint) {
    const host = $(id);
    host.textContent = "";
    for (const v of values) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt" + (v === current ? " on" : "");
      b.dataset.value = v;
      b.innerHTML = rate(v) + "<small>" + hint(v) + "</small>";
      host.appendChild(b);
    }
  }

  // How the town reads each rung of the dial. Both lines are generated from the
  // model's own tables, so a tuning change cannot leave the words behind.
  function saveHint(v) {
    const p = B().DEPOSIT_CHANCE[v];
    return p >= 0.9 ? "most will" : p >= 0.6 ? "some will" : "few will";
  }
  function loanHint(v) {
    const a = B().ACCEPT[3][v];
    return a >= 0.85 ? "everyone" : a >= 0.6 ? "most" : "risky ones";
  }

  function rates(run, which, opts) {
    const Bk = B();
    const bank = run.banks[which];
    const o = opts || {};
    topbar(run);
    vault(run, which);
    goal(run);

    const two = run.mode === "duo";
    show("ratesWho", two);
    if (two) $("ratesWho").innerHTML = "<b>" + bank.name + "</b>Set your two rates. " +
      "The other bank can't see them until somebody walks up to a counter.";

    set("saveNow", rate(bank.saveRate));
    set("loanNow", rate(bank.loanRate));
    rateTiles("saveChooser", Bk.SAVE_RATES, bank.saveRate, saveHint);
    rateTiles("loanChooser", Bk.LOAN_RATES, bank.loanRate, loanHint);

    const dc = Math.round(Bk.DEPOSIT_CHANCE[bank.saveRate] * 100);
    set("saveNote", "Every night you pay " + rate(bank.saveRate) +
      " for every dollar anybody has left with you — whether you managed to lend it " +
      "out or not. About " + dc + " out of every 100 savers like this rate.");

    const ac = Math.round(Bk.ACCEPT[3][bank.loanRate] * 100);
    const risky = Math.round(Bk.ACCEPT[1][bank.loanRate] * 100);
    set("loanNote", "Charge " + rate(bank.loanRate) + " a night and about " + ac +
      " out of 100 careful people will still borrow from you — but " + risky +
      " out of 100 of the risky ones will.");

    const gap = bank.loanRate - bank.saveRate;
    set("gapIn", rate(bank.loanRate));
    set("gapOut", rate(bank.saveRate));
    set("gapSize", rate(gap));
    $("gapMid").parentNode.classList.toggle("thin", gap <= 3);

    show("coach", !!o.hints && !!o.tip);
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

  // What a person's stars say, in words. On Tricky you are not told until you
  // have dealt with them — the number never changes, only whether you can see it.
  function starLine(run, which, p) {
    const Bk = B();
    const sp = Bk.spec(run.difficulty);
    const known = !!run.banks[which].known[p.id];
    if (!sp.showStars && !known) {
      return { text: "? ? ?", note: "you've never dealt with them" };
    }
    const words = { 3: "nearly always pays you back", 2: "usually pays you back",
      1: "often doesn't pay you back" };
    return { text: "★".repeat(p.star) + "☆".repeat(3 - p.star), note: words[p.star] };
  }

  // Beat one: who has walked in and what they want. Deliberately says nothing
  // about which counter they will choose — that is the next beat, and it is the
  // only suspense the counter has.
  function personAsk(run, c) {
    const Bk = B();
    const p = Bk.person(c.id);
    queueStrip(run);
    $("personCard").classList.remove("mine");
    set("personFace", p.emoji);
    set("personName", p.name);
    show("personStars", false);
    show("counterTag", false);
    show("personResult", false);
    show("fireBox", false);
    show("dealBox", true);

    const box = $("dealBox");
    if (c.kind === "withdraw") {
      set("personSay", p.name + " wants some of their savings back today.");
      box.innerHTML = row("They want", money(c.amount), "big");
    } else if (c.kind === "save") {
      set("personSay", p.name + " has some money and is looking for a bank.");
      box.innerHTML = row("To leave with you", money(c.amount), "big") +
        row("For", c.nights + (c.nights === 1 ? " night" : " nights"));
    } else {
      set("personSay", p.name + " wants to borrow some money for " + c.why + ".");
      box.innerHTML = row("They want to borrow", money(c.amount), "big") +
        row("Paying it back in", c.nights + (c.nights === 1 ? " night" : " nights"));
    }
    show("sayYes", false);
    show("sayNo", false);
    show("cardNext", false);
  }

  const row = (label, value, cls) =>
    '<div class="deal-line ' + (cls || "") + '"><span>' + label +
    "</span><strong>" + value + "</strong></div>";

  // Beat two: which counter, and what happened there. Everything the child needs
  // to decide is on screen at the moment the buttons appear.
  function personResolve(run, out, opts) {
    const Bk = B();
    const o = opts || {};
    const c = out.customer;
    const mine = out.bank === o.seat;
    const bank = run.banks[out.bank];
    const p = out.person;

    vault(run, out.bank);
    $("personCard").classList.toggle("mine", mine && !!out.asking);

    const tag = $("counterTag");
    tag.hidden = false;
    tag.classList.toggle("mine", mine);
    tag.textContent = out.walked && out.crossed === undefined && c.kind === "save"
      ? "went home" : (mine ? "your counter" : bank.name);

    // Stars only matter for lending, so they only appear when lending is on the
    // table. On a saver's card three stars would be answering a question nobody
    // asked.
    if (c.kind === "borrow") {
      const s = starLine(run, out.bank, p);
      $("personStars").innerHTML = s.text + "<small>" + s.note + "</small>";
      show("personStars", true);
    }

    const res = $("personResult");
    res.hidden = false;
    res.className = "person-result";
    show("fireBox", false);

    if (out.fire) fireNote(out.fire);

    if (c.kind === "withdraw") {
      res.classList.add(out.leaves ? "meh" : "took");
      res.textContent = mine
        ? "You handed over " + money(out.paidOut) + "." +
          (out.leaves ? " That's their account closed." : " The rest stays with you.")
        : bank.name + " handed over " + money(out.paidOut) + ".";
      coins("out");
    } else if (out.walked) {
      res.classList.add("meh");
      res.textContent = c.kind === "save"
        ? p.name + " didn't like either bank's rate and took the money home."
        : p.name + " thought that was too dear and went without.";
    } else if (out.asking) {
      res.hidden = true;
      askFor(run, out);
      return;
    } else if (out.turnedAway) {
      res.classList.add("meh");
      res.textContent = (mine ? "You" : bank.name) + " said no thanks. " + p.name +
        " keeps the money.";
    } else if (out.took) {
      res.classList.add("took");
      res.textContent = (mine ? "You now owe " : bank.name + " now owes ") + p.name + " " +
        money(out.took) + " — and " + (mine ? "you" : "they") + " can lend it to somebody else.";
      if (mine) coins("in");
    } else if (out.lent) {
      res.classList.add("lent");
      res.textContent = money(out.lent) + " walks out of the vault. " + p.name +
        " brings back " + money(out.repay) + " on day " + out.due + ".";
      if (mine) coins("out");
    } else if (out.refused) {
      res.classList.add("meh");
      res.textContent = (mine ? "You" : bank.name) + " said no." +
        (out.sentOn ? " " + p.name + " is crossing the street to try " + out.sentOn + "." : "");
    } else {
      res.classList.add("meh");
      res.textContent = "Nothing came of it.";
    }

    show("sayYes", false);
    show("sayNo", false);
    show("cardNext", true);
    $("cardNext").textContent = out.sentOn ? "Watch them cross the street" : "Next";
  }

  // The decision. A loan card carries the whole deal — what comes back, when,
  // and what they are like — because those three things are the decision.
  function askFor(run, out) {
    const c = out.customer;
    const p = out.person;
    const bank = run.banks[out.bank];
    const box = $("dealBox");

    if (c.kind === "save") {
      const nightly = B().interestOn(c.amount, bank.saveRate);
      box.innerHTML = row("They'd leave you", money(c.amount), "big") +
        row("For", c.nights + (c.nights === 1 ? " night" : " nights")) +
        row("Costs you every night", money(nightly));
      set("personSay", p.name + " wants to leave " + money(c.amount) +
        " with you. You can lend it out — but you pay for it every night either way.");
      $("sayYes").textContent = "Take it";
      $("sayNo").textContent = "No thanks";
    } else {
      box.innerHTML = row("They want", money(c.amount), "big") +
        row("They'd bring back", money(out.repay), "good") +
        row("On day", String(out.due)) +
        row("You'd make", money(out.repay - c.amount), "good");
      set("personSay", out.canPay
        ? p.name + " wants " + money(c.amount) + " for " + c.why + "."
        : "You've only got " + money(bank.cash) + " in the vault — not enough to lend " +
          money(c.amount) + ".");
      $("sayYes").textContent = "Lend it";
      $("sayNo").textContent = "No";
    }

    $("sayYes").disabled = c.kind === "borrow" && !out.canPay;
    show("sayYes", true);
    show("sayNo", true);
    show("cardNext", false);
  }

  function fireNote(fire) {
    const box = $("fireBox");
    box.hidden = false;
    box.innerHTML = "<b>🔥 You had to call your loans in early</b>" +
      "The coins weren't there, so you asked for " + money(fire.raised) +
      " back before it was due. People only give you 75c in the dollar for that — " +
      "it cost you <b style='display:inline'>" + money(fire.lost) + "</b>.";
  }

  /* ── Night ─────────────────────────────────────────────────────────────── */

  let beats = [];
  let beatAt = 0;

  function night(run, rep, seat) {
    const Bk = B();
    const bank = run.banks[seat || 0];
    const b = rep.banks[seat || 0];
    phase("night");
    topbar(run);
    vault(run, seat || 0);
    goal(run);

    // 1. What the night cost.
    const before = bank.deposits - b.interestOut;
    set("paidBefore", money(before));
    set("paidRate", rate(bank.saveRate) + " a night for every dollar");
    set("paidAdd", "- " + money(b.interestOut));
    set("paidAfter", money(bank.deposits));
    set("paidNote", b.interestOut > 0
      ? "That money came out of your own pile and joined theirs. It happens every " +
        "night, on every dollar, whether you lent it out or not."
      : "Nobody had any money with you tonight, so there was nothing to pay.");

    // 2. Loans settling.
    const any = b.back.length + b.bad.length;
    show("beatBack", any > 0);
    if (any) {
      const host = $("backList");
      host.textContent = "";
      for (const l of b.back) {
        host.appendChild(settle(Bk.person(l.id), "paid",
          "paid you back", "you made " + money(l.profit), "+ " + money(l.repay)));
      }
      for (const l of b.bad) {
        host.appendChild(settle(Bk.person(l.id), "bad",
          l.back > 0 ? "could only pay back " + money(l.back) : "didn't pay you back",
          "you lost " + money(l.lost), "- " + money(l.lost)));
      }
      set("backTotal", money(b.interestIn));
      set("backNote", b.bad.length
        ? "Money that doesn't come back is what the gap between your two rates has to cover."
        : "Every one of them paid. That's what your stars are for.");
    }

    // 3. Savers cashing out.
    show("beatSavers", b.matured.length > 0);
    if (b.matured.length) {
      const host = $("saverList");
      host.textContent = "";
      for (const s of b.matured) {
        host.appendChild(settle(Bk.person(s.id), "out", "took their money back",
          "including " + money(s.interest) + " you paid them", "- " + money(s.owed)));
      }
    }

    // 4. The town.
    set("trustBefore", String(b.trustBefore));
    set("trustAfter", String(b.trustAfter));
    set("trustCount", String(b.trustAfter));
    const up = b.trustAfter - b.trustBefore;
    show("trustUpRow", up > 0);
    show("trustDownRow", up < 0);
    if (up > 0) { set("trustUp", "+ " + up); set("trustUpWhy", "You looked after people today"); }
    if (up < 0) {
      set("trustDown", "- " + Math.abs(up));
      set("trustDownWhy", b.missed ? "You couldn't pay somebody"
        : b.fire ? "Word got round that you ran short"
        : "You turned somebody away");
    }
    townFolk(b.trustAfter);
    set("trustNote", "The more of the town that banks with you, the more money you have " +
      "to lend — and the bigger the amounts people trust you with.");

    // 5. The day's sums.
    const fire = bank.today.fire;
    set("sumIn", money(b.interestIn));
    set("sumOut", money(b.interestOut));
    show("sumBadRow", bank.today.badDebt > 0);
    set("sumBad", money(bank.today.badDebt));
    show("sumFireRow", fire > 0);
    set("sumFire", money(fire));
    const made = b.interestIn - b.interestOut - bank.today.badDebt - fire;
    set("sumTotal", money(made));
    $("sumTotalRow").classList.toggle("loss", made < 0);
    causes(run, bank, b, made);

    beats = ["beatPaid", "beatBack", "beatSavers", "beatTrust", "beatSum"]
      .filter((id) => id === "beatPaid" || id === "beatTrust" || id === "beatSum" ||
        !$(id).hidden);
    beatAt = 0;
    drawBeats();
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

  // Every decision next to what it actually caused. The night used to report
  // outcomes without naming the choice that produced them, which is the
  // difference between a scoreboard and a lesson.
  function causes(run, bank, b, made) {
    const list = [];
    const t = bank.today;
    if (t.lent > 0) {
      list.push(["🤝", "You lent out " + money(t.lent) + " at " + rate(bank.loanRate) + " a night",
        "that money is working for you instead of sitting there", false]);
    }
    if (B().spare(bank) > 6000) {
      list.push(["😴", money(B().spare(bank)) + " sat in the vault doing nothing",
        "and you paid " + rate(bank.saveRate) + " a night for every dollar of it", true]);
    }
    if (t.refused > 0) {
      list.push(["🙅", "You said no to " + t.refused + (t.refused === 1 ? " borrower" : " borrowers"),
        "no loan is better than one that never comes back", false]);
    }
    if (t.turnedAway > 0) {
      list.push(["🚪", "You turned away " + t.turnedAway +
        (t.turnedAway === 1 ? " saver" : " savers"),
        "one person in town liked you a little less for it", true]);
    }
    if (b.bad.length) {
      list.push(["💔", b.bad.length + (b.bad.length === 1 ? " loan" : " loans") + " went wrong",
        "that cost you " + money(t.badDebt), true]);
    }
    if (t.fire > 0) {
      list.push(["🔥", "You ran out of coins and called loans in",
        "it cost " + money(t.fire) + " — keeping a quarter back is cheaper", true]);
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

  function drawBeats() {
    beats.forEach((id, i) => { $(id).hidden = i !== beatAt; });
    const dots = $("nightDots");
    dots.textContent = "";
    beats.forEach((_, i) => {
      const d = document.createElement("span");
      d.className = "dot" + (i === beatAt ? " on" : "");
      dots.appendChild(d);
    });
    const last = beatAt >= beats.length - 1;
    show("nightBack", beatAt > 0);
    show("nightNext", !last);
    show("nextDayBtn", last);
  }

  function beatStep(d) {
    beatAt = Math.max(0, Math.min(beats.length - 1, beatAt + d));
    drawBeats();
    const host = $("night").querySelector(".scroller");
    if (host) host.scrollTop = 0;
  }

  /* ── The books ─────────────────────────────────────────────────────────── */

  function books(run, seat) {
    const Bk = B();
    const bank = run.banks[seat || 0];
    const loans = $("bookLoans");
    loans.textContent = "";
    if (!bank.loans.length) {
      loans.innerHTML = '<p class="empty-note">Nothing out on loan. Every coin is in the vault.</p>';
    }
    for (const l of bank.loans.slice().sort((a, b2) => a.due - b2.due)) {
      loans.appendChild(entry("loan", Bk.person(l.id), money(l.amount) + " for " + l.why,
        "back on day " + l.due + " as " + money(l.repay), money(l.repay), l.due <= run.day));
    }
    const savers = $("bookSavers");
    savers.textContent = "";
    if (!bank.savers.length) {
      savers.innerHTML = '<p class="empty-note">Nobody has money with you right now.</p>';
    }
    for (const s of bank.savers.slice().sort((a, b2) => a.due - b2.due)) {
      savers.appendChild(entry("saver", Bk.person(s.id), money(s.amount) + " saved",
        "wants it on day " + s.due + " · you've paid " + money(s.paid),
        money(s.amount + s.paid), s.due <= run.day + 1));
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

  /* ── Result ────────────────────────────────────────────────────────────── */

  function result(run, best) {
    const Bk = B();
    const s = Bk.summary(run);
    const sp = Bk.spec(run.difficulty);
    const grew = s.own - Bk.START_OWN;

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
      : grew >= 0 ? "You kept the doors open" : "Your bank lost money");
    set("resultSub", grew >= 0
      ? "You started with " + money(Bk.START_OWN) + " of your own money and finished with " +
        money(s.own) + ". Every cent of the difference came out of the gap between what " +
        "you paid savers and what borrowers paid you."
      : "You started with " + money(Bk.START_OWN) + " and finished with " + money(s.own) +
        ". A bank that lends money can lose money — that is exactly why it charges more " +
        "than it pays.");

    const rival = run.banks[1];
    set("versus", (s.won ? "🏆 You beat " : "🥈 ") + rival.name +
      (s.won ? " — " : " came out on top — ") + money(s.own) + " against " + money(rival.own) + ".");

    ladder(sp, s.own);
    BB.Chart.render($("chart"), run);

    set("grewLine", "You started with " + Bk.START_TRUST + " people banking with you and " +
      "finished with " + s.trust + " of the " + Bk.TOWNSFOLK + " in town. At the busiest " +
      "you were looking after " + money(peakDeposits(run)) + " of other people's money.");
    set("takeaway", Bk.takeaway(run));

    const st = [];
    if (s.fires === 0) st.push("🧊");
    if (s.badDebts === 0) st.push("🎯");
    if (s.trust >= Bk.TOWNSFOLK - 3) st.push("🤝");
    if (s.won) st.push("🏆");
    if (rung >= sp.goal.length) st.push("🏛️");
    $("stickers").textContent = st.join(" ");

    const bl = $("resultBest");
    if (best > 0) {
      bl.textContent = "🏅 Your best " + sp.days + "-day bank: " + money(best);
      bl.hidden = false;
    } else bl.hidden = true;
  }

  const peakDeposits = (run) =>
    run.ledger.reduce((m, r) => Math.max(m, r.deposits[0]), 0);

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

  return { phase, toast, vault, coins, topbar, goal, rates, rateTiles,
           personAsk, personResolve, queueStrip, night, beatStep, books, result };
})();
