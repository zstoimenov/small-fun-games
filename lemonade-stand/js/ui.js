/* Lemonade Stand — everything that draws, and nothing that decides.            */
/*                                                                              */
/* Every number this file shows has already been worked out by economy.js. The   */
/* selling animation in particular is decoration painted over a result that was  */
/* fixed the moment the stall opened — it cannot sell one more cup than the      */
/* model says, however long it runs or however early it is skipped.              */
"use strict";
window.LS = window.LS || {};

LS.Ui = (function () {
  const E = LS.Economy;
  const $ = (id) => document.getElementById(id);

  const show = (node, on) => { if (node) node.hidden = !on; };
  const text = (id, s) => { const n = $(id); if (n) n.textContent = s; };

  /* ── Topbar, purse and the goal ─────────────────────────────────────────── */

  function header(run) {
    const sp = E.spec(run.difficulty);
    text("dayLabel", "Day " + run.day);
    // Deliberately says nothing about today's event: you find that out when the
    // stall opens, not while you still have money to commit.
    text("dayMeta", "of " + sp.days);
  }

  function purse(run) {
    $("pocketChip").innerHTML = "👛 <b>" + E.money(run.pocket) + "</b>";
    $("bankChip").innerHTML = "🏦 <b>" + E.money(run.bank) + "</b>";
    const owing = !!run.loan;
    show($("debtChip"), owing);
    if (owing) $("debtChip").innerHTML = "💳 <b>" + E.money(run.loan.repay) + "</b>";
    // The bank chip lights up when there's something in it worth the bonus rate.
    $("bankChip").classList.toggle("lit", run.bank >= E.BONUS_AT && E.spec(run.difficulty).bonusRate);
  }

  function goal(run) {
    const sp = E.spec(run.difficulty);
    const target = sp.goal[sp.goal.length - 1];
    const have = E.wealth(run);
    const pct = Math.max(0, Math.min(1, have / target));
    $("goalFill").style.width = (pct * 100).toFixed(2) + "%";
    const rung = E.rungReached(have, sp.goal);
    const next = rung < sp.goal.length ? sp.goal[rung] : target;
    text("goalLabel", rung >= sp.goal.length
      ? "🏆 " + sp.rungs[sp.rungs.length - 1] + " — you've done it!"
      : sp.rungs[sp.goal.length - 1] + " " + E.money(have) + " of " + E.money(target) +
        "  ·  next: " + E.money(next));
  }

  function coach(msg, tone) {
    const box = $("coach");
    if (!msg) { show(box, false); return; }
    show(box, true);
    box.className = "coach " + (tone || "calm");
    text("coachFace", tone === "warn" ? "😟" : tone === "good" ? "🎉" : "🍋");
    text("coachText", msg);
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    show(t, true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => show(t, false), 1900);
  }

  /* ── Phases ─────────────────────────────────────────────────────────────── */

  function phase(name) {
    for (const id of ["morning", "selling", "evening"]) show($(id), id === name);
  }

  /* ── Morning ────────────────────────────────────────────────────────────── */

  // How dear today's lemons are, said the way a person would say it.
  function unitVerdict(unit) {
    if (unit <= 30) return { s: "That's cheap! A good day to fill the stall.", c: "good" };
    if (unit <= 37) return { s: "A bit cheaper than usual.", c: "good" };
    if (unit <= 45) return { s: "The usual sort of price.", c: "" };
    if (unit <= 53) return { s: "Dearer than usual. Maybe buy a bit less.", c: "" };
    return { s: "Very dear today. Every cup costs you a lot to make.", c: "bad" };
  }

  function priceNote(run) {
    const tier = E.priceTier(run.price);
    const unit = run.today.unit;
    const margin = run.price - unit;
    if (margin < 0) {
      return { s: "Careful — each cup costs you " + E.price(unit) + " to make, so at " +
        E.price(run.price) + " you lose " + E.price(-margin) + " every time somebody buys one.", c: "bad" };
    }
    if (margin === 0) return { s: "You'd make nothing at all on each cup.", c: "bad" };
    const words = tier.repDay >= 4 ? "Lots of people will buy, but there's not much in it for you."
      : tier.repDay > 0 ? "A fair price. People come back to a stall that's fair."
      : tier.repDay === -1 ? "You make more on each cup, but fewer people will buy one."
      : "Not many will pay that, and your regulars won't like it.";
    return { s: "You keep " + E.price(margin) + " on every cup. " + words, c: "" };
  }

  function morning(run, hints) {
    const info = run.today;
    header(run); purse(run); goal(run);

    // The bank's opening move, if it made one.
    const o = run.opening || {};
    const card = $("openingCard");
    if (o.repay || o.gift) {
      card.innerHTML = newsHtml(run);
      card.className = "card news" + (o.repay && o.repay.written > 0 ? " bad" : "");
      show(card, true);
    } else {
      show(card, false);
    }

    text("forecastEmoji", E.WEATHER[info.forecast].emoji);
    text("forecastName", E.WEATHER[info.forecast].name);
    text("forecastNote", info.sure ? "Always right on this setting" : "Usually right — not always");

    text("unitPrice", E.price(info.unit));
    const v = unitVerdict(info.unit);
    $("unitVerdict").textContent = v.s;
    $("unitVerdict").className = "verdict " + v.c;

    text("planPriceValue", E.price(run.price));
    text("planPriceNote", "lemons cost " + E.price(info.unit) + " a cup");

    packs(run);
    prices(run);
    basket(run);

    const due = run.loan && run.loan.due === run.day + 1;
    $("loanBtn").classList.toggle("due", !!due);
    $("loanBtn").textContent = run.loan ? "🏦 You owe " + E.money(run.loan.repay) : "🏦 The bank";

    if (hints) coach(hint(run), "calm"); else coach(null);
    $("openBtn").disabled = false;
    $("openBtn").textContent = run.cups > 0 ? "Open the stall" : "Stay shut today";
  }

  function packs(run) {
    const unit = run.today.unit;
    const small = E.packPrice(unit, E.PACKS[0]);
    const big = E.packPrice(unit, E.PACKS[1]);
    text("smallCost", E.money(small));
    text("bigCost", E.money(big));
    text("bigSave", "save " + E.money(E.packSaving(unit)));
    const have = E.affordable(run);
    $("buySmall").disabled = small > have || run.cups + 5 > E.STALL_LIMIT;
    $("buyBig").disabled = big > have || run.cups + 15 > E.STALL_LIMIT;
  }

  // Built from Economy.PRICES so the tiles and the model can never disagree.
  function prices(run) {
    const host = $("priceChooser");
    if (!host.children.length) {
      for (const p of E.PRICES) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "price-opt";
        b.dataset.value = String(p.cents);
        b.textContent = E.price(p.cents);
        host.appendChild(b);
      }
    }
    for (const b of host.children) b.classList.toggle("on", Number(b.dataset.value) === run.price);
    const n = priceNote(run);
    $("priceNote").textContent = n.s;
    $("priceNote").className = "verdict " + n.c;
  }

  // Two places say what's in the basket: the plan row on the morning screen and
  // the buying step. They are the same fact, so they are written together.
  function basket(run) {
    const carried = run.cups - run.boughtToday;
    text("basket", run.cups === 0 ? "nothing yet" : run.cups + " cups");
    text("planStockNote", run.cups === 0 ? "Tap to buy some lemons"
      : "spent " + E.money(run.spentToday) +
        (carried > 0 ? " · " + carried + " kept from yesterday" : ""));
    text("stepBasket", run.cups === 0 ? "Nothing bought yet."
      : "🥤 " + run.cups + " cups ready" +
        (run.boughtToday ? " · spent " + E.money(run.spentToday) : "") +
        (carried > 0 ? " · " + carried + " kept from yesterday" : ""));
  }

  /* ── The morning, one step at a time ────────────────────────────────────── */

  const PARTS = ["stepNews", "stepWeather", "stepBuy", "stepPrice", "stepReady"];

  function dots(hostId, total, at) {
    const host = $(hostId);
    host.textContent = "";
    for (let i = 0; i < total; i++) {
      const d = document.createElement("span");
      d.className = "dot" + (i === at ? " on" : "");
      host.appendChild(d);
    }
  }

  // How busy the crowd will be, in words rather than a footfall number.
  function crowdWords(w) {
    return ["Hardly anybody will be out in this.",
            "A few people about.",
            "A fair few people will walk past.",
            "Lots of people out — and thirsty.",
            "The street will be packed."][w];
  }

  // Draws one step. Exactly one `.step-part` is ever visible, which is the whole
  // point of the screen and is checked in the browser tests.
  function stepShow(run, id, at, total, single) {
    show($("step"), true);
    for (const p of PARTS) show($(p), false);
    text("stepCount", (at + 1) + " / " + total);
    show($("stepCount"), !single);
    show($("stepDots"), !single);
    dots("stepDots", total, at);
    show($("stepBack"), at > 0 && !single);

    const info = run.today;
    if (id === "news") {
      text("stepTitle", "Before you open");
      text("stepSay", "The bank has been.");
      $("stepNews").innerHTML = newsHtml(run);
      show($("stepNews"), true);
      text("stepNext", "OK");
    } else if (id === "weather") {
      text("stepTitle", "What's it like today?");
      text("stepSay", info.sure
        ? "Here's the weather. It decides how many people walk past your stall."
        : "Here's the forecast. It decides how many people walk past — but it isn't always right.");
      text("stepWeatherEmoji", E.WEATHER[info.forecast].emoji);
      text("stepWeatherName", E.WEATHER[info.forecast].name);
      text("stepWeatherCrowd", crowdWords(info.forecast));
      show($("stepWeather"), true);
      text("stepNext", "Next");
    } else if (id === "buy") {
      text("stepTitle", "How much will you make?");
      text("stepSay", "Buy too few and you'll run out. Buy too many and the rest goes in the bin.");
      packs(run);
      basket(run);
      // The bank, offered at the moment the money runs out rather than two
      // sheets later. This is the whole reason day one has a decision in it.
      const big = E.packPrice(info.unit, E.PACKS[1]);
      const offers = E.loanOffers(run);
      const short = E.affordable(run) < big;
      const b = $("stepBorrow");
      if (short && offers.length && !run.loan) {
        b.textContent = "🏦 Short of a full stall? The bank will lend you " +
          E.money(offers[0].borrow);
        show(b, true);
      } else if (run.loan) {
        b.textContent = "🏦 You owe the bank " + E.money(run.loan.repay) + ", due day " + run.loan.due;
        show(b, true);
      } else show(b, false);
      show($("stepBuy"), true);
      text("stepNext", run.cups > 0 ? "Next" : "Don't buy any");
    } else if (id === "price") {
      text("stepTitle", "What will you charge?");
      text("stepSay", "You keep whatever is left after the lemons are paid for.");
      prices(run);
      show($("stepPrice"), true);
      text("stepNext", "Next");
    } else {
      text("stepTitle", "Ready to open?");
      text("stepSay", "That's everything decided.");
      readyStep(run);
      show($("stepReady"), true);
      text("stepNext", run.cups > 0 ? "Open the stall" : "Stay shut today");
    }
    if (single) text("stepNext", "Done");
  }

  function readyStep(run) {
    const most = run.cups * run.price;
    $("readyPlan").innerHTML = run.cups > 0
      ? "<b>" + run.cups + " cups</b> at <b>" + E.price(run.price) + "</b> each"
      : "<b>No cups.</b> You're staying shut today.";
    text("readyNote", run.cups > 0
      ? "If you sell the lot that's " + E.money(most) + ". You spent " +
        E.money(run.spentToday) + " on the lemons."
      : "You'll earn nothing, but you'll spend nothing either.");
  }

  function newsHtml(run) {
    const o = run.opening || {};
    let html = "";
    if (o.repay) {
      const r = o.repay;
      html += r.written > 0
        ? "<b>💳 The bank came for its money.</b>It took the " + E.money(r.repaid) +
          " you had and let you off the last " + E.money(r.written) +
          ". Borrowing is a promise — that one hurt."
        : "<b>💳 You paid back your loan.</b>You borrowed " + E.money(r.borrowed) +
          " and paid back " + E.money(r.repay) + ". Borrowing cost you " + E.money(r.cost) + ".";
    }
    if (o.gift) {
      html += (html ? "<br><br>" : "") + "<b>👵 Grandma popped by.</b>She left you " +
        E.money(o.gift) + " so you can keep going. Don't waste it.";
    }
    return html;
  }

  const stepHide = () => show($("step"), false);

  // One short nudge, and only when the tips switch is on.
  function hint(run) {
    const info = run.today;
    if (run.cups === 0 && E.affordable(run) < E.packPrice(info.unit, E.PACKS[0])) {
      return "You haven't got enough for any lemons. The bank will lend you some.";
    }
    if (run.cups === 0) return "Buy some lemons first — you can't sell what you haven't got.";
    if (run.price < info.unit) return "You're selling for less than the lemons cost you.";
    if (info.forecast >= 3 && run.cups < 20) return "It's going to be busy. More cups might be worth it.";
    if (info.forecast <= 1 && run.cups > 15) return "Not many people about today. That's a lot of cups to shift.";
    if (run.bank === 0 && run.day > 2) return "Your money is all in your pocket. The bank pays you to leave it there.";
    return "Pick how many cups to make, and what to charge.";
  }

  /* ── Selling ────────────────────────────────────────────────────────────── */

  // The animation. It is handed the finished result and walks through it; the
  // `gen` token means a run that was skipped or abandoned can never keep firing
  // into the next day.
  function sellingScreen(run) {
    phase("selling");
    changeHide();
    event(run.today);
    text("stallSun", E.WEATHER[run.today.weather].emoji);
    $("stallSign").innerHTML = "🍋 LEMONADE <span>" + E.price(run.price) + "</span>";
    $("queue").textContent = "";
    text("cupsLeft", String(run.cups));
    text("tillTotal", E.money(0));
    show($("turnedLine"), false);
    text("turnedCount", "0");
    text("boughtCount", "0");
    text("thirstyCount", "0");
    show($("legend"), true);
    show($("dayDone"), false);
    show($("skipBtn"), true);
    show($("countUpBtn"), false);
  }

  // `servedSoFar` counts CUPS; the queue draws PEOPLE, so a party of three is
  // one face with a ×3 on it rather than three identical faces.
  function sellStep(run, servedSoFar, turnedSoFar, partySize) {
    const q = $("queue");
    const thirsty = turnedSoFar > 0 && servedSoFar >= run.result.sold;
    const person = document.createElement("span");
    person.className = "customer" + (thirsty ? " thirsty" : "") + (partySize > 1 ? " party" : "");
    person.textContent = thirsty ? "😕" : "🙂";
    if (partySize > 1 && !thirsty) {
      const badge = document.createElement("i");
      badge.textContent = "×" + partySize;
      person.appendChild(badge);
    }
    q.appendChild(person);
    // A day is at most forty-odd people; past three rows it stops reading as a
    // queue and starts reading as noise, so the oldest walk off.
    while (q.children.length > 24) q.removeChild(q.firstChild);

    text("cupsLeft", String(Math.max(0, run.cups - servedSoFar)));
    text("tillTotal", E.money(servedSoFar * run.price));
    text("boughtCount", String(servedSoFar));
    text("thirstyCount", String(turnedSoFar));
    if (turnedSoFar > 0) {
      show($("turnedLine"), true);
      text("turnedCount", String(turnedSoFar));
    }
  }

  // The day stops and waits to be read. Nothing here closes the day — that
  // happens when the child taps, in app.js.
  function dayDone(run) {
    const r = run.result;
    text("doneSold", String(r.sold));
    text("doneTurned", String(r.turned));
    text("doneLeft", String(r.wasted));
    show($("doneTurnedRow"), r.turned > 0);
    show($("doneLeftRow"), r.wasted > 0);
    $("dayDone").querySelector(".done-head").textContent = r.shut
      ? "🔕 You stayed shut today."
      : r.sold === 0 ? "🔔 That's the day done. Nobody bought a thing."
      : "🔔 That's the day done.";
    show($("dayDone"), true);
    show($("skipBtn"), false);
    show($("countUpBtn"), true);
  }

  /* ── The till ───────────────────────────────────────────────────────────── */

  // The coin pad is built once from Economy.COINS, so the buttons and the money
  // model can never disagree about what an Australian coin is.
  function coinPad(onCoin) {
    const pad = $("coinPad");
    if (pad.children.length) return;
    for (const c of E.COINS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "coin" + (c < 100 ? " silver" : "");
      b.dataset.value = String(c);
      b.textContent = E.price(c);
      b.addEventListener("click", () => onCoin(c));
      pad.appendChild(b);
    }
  }

  // Says the handful out loud: "a $2 coin and a 20c", "two $1 coins". Which
  // pieces are notes comes from the model, so the wording can't drift from what
  // an Australian note actually is.
  const ONE = ["", "a ", "two ", "three ", "four ", "five ", "six "];
  function describe(parts) {
    if (!parts || !parts.length) return "some money";
    const groups = [];
    for (const p of parts) {
      const last = groups[groups.length - 1];
      if (last && last.v === p) last.n++;
      else groups.push({ v: p, n: 1 });
    }
    const words = groups.map((g) => {
      const kind = E.isNote(g.v) ? " note" : g.v >= 100 ? " coin" : "";
      // Nobody says "a $1.00 coin" — the cents come off whole-dollar pieces.
      const face = g.v >= 100 && g.v % 100 === 0 ? "$" + g.v / 100 : E.price(g.v);
      const name = face + kind;
      return g.n === 1 ? "a " + name : (ONE[g.n] || g.n + " ") + name + (kind ? "s" : "");
    });
    if (words.length === 1) return words[0];
    return words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
  }

  // `showTotal` is the difficulty dial that matters most: with the running total
  // on, the child is checking their arithmetic as they go; with it off, they
  // have to hold the sum in their head and find out afterwards.
  function changeAsk(run, moment, showTotal) {
    show($("changePanel"), true);
    $("selling").classList.add("till-open");
    coach(null);
    show($("changeVerdict"), false);
    show($("changeGive"), true);
    show($("changeNext"), false);
    $("changeClear").disabled = false;
    text("changeFace", "🙂");
    const n = moment.cups || 1;
    text("changeFace", n > 1 ? "🙂🙂" : "🙂");
    text("changeSay", n === 1 ? '"One please!"'
      : n === 2 ? '"Two please!"' : '"Three please!"');
    // For a party the sum is a multiply THEN a subtract, and both halves are
    // spelled out — that is the whole reason parties are worth having.
    $("changeSum").innerHTML = (n === 1
      ? "A cup is <b>" + E.price(moment.price) + "</b>."
      : "<b>" + n + " cups</b> at <b>" + E.price(moment.price) + "</b> each is <b>" +
        E.money(moment.total) + "</b>.") +
      " They've handed you " + describe(moment.parts) + " — <b>" +
      E.money(moment.paid) + "</b>.<br>How much do you give back?";
    changeTray(run, [], showTotal);
  }

  function changeTray(run, coins, showTotal) {
    const total = coins.reduce((a, b) => a + b, 0);
    const box = $("trayTotal");
    box.classList.toggle("hidden-total", !showTotal);
    box.textContent = showTotal ? E.price(total) : coins.length ? "counting…" : "—";
    const host = $("trayCoins");
    host.textContent = "";
    for (const c of coins) {
      const s = document.createElement("span");
      s.className = "tray-coin";
      s.textContent = E.price(c);
      host.appendChild(s);
    }
    $("changeGive").disabled = coins.length === 0;
  }

  // What actually happened, said plainly. No scolding — the number is the point.
  function changeResult(run, out, moment) {
    const v = $("changeVerdict");
    show(v, true);
    show($("changeGive"), false);
    show($("changeNext"), true);
    $("changeClear").disabled = true;
    if (out.ok) {
      text("changeFace", "😃");
      v.className = "change-verdict right";
      const sum = E.money(moment.paid) + " minus " + E.price(moment.total) + " is " +
        E.price(moment.due);
      v.textContent = out.tip > 0
        ? "That's right — " + sum + ". They left you " + E.price(out.tip) + " as a thank-you!"
        : "That's right. " + sum + ".";
    } else if (out.over > 0) {
      text("changeFace", "🙂");
      v.className = "change-verdict wrong";
      v.textContent = "That was " + E.price(out.over) + " too much. The right change was " +
        E.price(moment.due) + " — and they've walked off with the extra.";
    } else {
      text("changeFace", "😠");
      v.className = "change-verdict wrong";
      v.textContent = "That was " + E.price(out.short) + " short. They counted it, and they " +
        "weren't happy. The right change was " + E.price(moment.due) + ".";
    }
  }

  function changeHide() {
    show($("changePanel"), false);
    $("selling").classList.remove("till-open");
  }

  // Today's surprise, revealed only once the stall is open.
  function event(info) {
    const card = $("eventCard");
    if (!info.event) { show(card, false); return; }
    card.className = "card news event" + (info.event.good ? "" : " bad");
    card.innerHTML = "<b>" + info.event.emoji + " " + info.event.name + "</b>" + info.event.note;
    show(card, true);
  }

  function sellDone(run) {
    const r = run.result;
    text("cupsLeft", String(Math.max(0, run.cups - r.sold)));
    text("tillTotal", E.money(r.earned));
    if (r.turned > 0) { show($("turnedLine"), true); text("turnedCount", String(r.turned)); }
  }

  /* ── Evening ────────────────────────────────────────────────────────────── */

  function evening(run) {
    const r = run.result;
    phase("evening");
    header(run); purse(run); goal(run);
    coach(null);

    const takings = r.earned + run.tipsToday - run.overpaidToday;
    const profit = takings - run.spentToday;
    text("sumSpent", E.money(run.spentToday));
    text("sumEarned", E.money(takings));
    text("sumProfit", E.money(Math.abs(profit)));
    text("sumTotalLabel", profit < 0 ? "So you lost" : "So you made");
    $("sumTotalLine").classList.toggle("loss", profit < 0);

    causes(run);

    // The till used to get its own line here. "What your choices did" already
    // names it, with the reason attached, so the second line was just noise.
    show($("tillLine"), false);

    const lostLine = $("lostLine");
    if (r.lost > 0) {
      lostLine.textContent = run.today.event.emoji + " " + r.lost +
        " cups were gone before you sold a single one. That money was already spent.";
      lostLine.className = "verdict bad";
      show(lostLine, true);
    } else show(lostLine, false);

    const waste = $("wasteLine");
    if (r.wasted > 0 && run.treats.bucket) {
      waste.textContent = "🧊 " + r.wasted + " cups left over — the ice bucket keeps them for tomorrow.";
      waste.className = "verdict good";
      show(waste, true);
    } else if (r.wasted > 0) {
      waste.textContent = "🗑️ " + r.wasted + " cups went in the bin. Lemonade doesn't keep.";
      waste.className = "verdict bad";
      show(waste, true);
    } else show(waste, false);

    const thirsty = $("thirstyLine");
    if (r.turned > 0) {
      thirsty.textContent = "😕 " + r.turned + " people wanted one and you'd run out. Make more tomorrow.";
      thirsty.className = "verdict";
      show(thirsty, true);
    } else show(thirsty, false);

    show($("nightCard"), false);
    show($("nextBtn"), false);
    for (const id of ["bankNone", "bankHalf", "bankAll"]) $(id).disabled = false;
    $("bankNote").textContent = run.pocket > 0
      ? "You've got " + E.money(run.pocket) + " in your pocket. The bank pays you " +
        E.RATE + "c a night for every dollar you leave with it."
      : "Nothing in your pocket to bank tonight.";
  }

  // Counts a money figure up to its final value in 5c steps. Steps, not a
  // tween on a raw number — a tween would print fractions of a cent on the way
  // and every amount in this game is whole 5c.
  let countTimer = null;
  function countUpTo(id, from, to, done) {
    clearInterval(countTimer);
    const reduce = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const steps = Math.round((to - from) / 5);
    if (reduce || steps <= 0 || steps > 400) { text(id, E.money(to)); if (done) done(); return; }
    let at = from;
    const every = Math.max(16, Math.min(90, Math.round(700 / steps)));
    countTimer = setInterval(() => {
      at += 5;
      if (at >= to) { at = to; clearInterval(countTimer); if (done) done(); }
      text(id, E.money(at));
    }, every);
  }

  /* ── Cause and effect ───────────────────────────────────────────────────── */

  // Every choice the child made today, each one paired with what it actually
  // caused. The evening used to report outcomes without saying which decision
  // produced them, which is the difference between a scoreboard and a lesson.
  function causes(run) {
    const r = run.result;
    const list = $("causeList");
    list.textContent = "";
    const rows = [];

    // How many you made.
    if (r.shut) {
      rows.push({ e: "🥤", did: "You didn't buy any lemons.",
                  so: "So there was nothing to sell, and you earned <b class='bad'>nothing</b>." });
    } else {
      const made = r.sold + r.wasted + (r.lost || 0);
      if (r.turned > 0) {
        rows.push({ e: "🥤", did: "You made " + made + " cups for " + E.money(run.spentToday) + ".",
          so: "You sold every one — and <b class='bad'>" + r.turned +
              " more</b> people wanted one you didn't have." });
      } else if (r.wasted > 0) {
        rows.push({ e: "🥤", did: "You made " + made + " cups for " + E.money(run.spentToday) + ".",
          so: "You only sold " + r.sold + ", so <b class='bad'>" + r.wasted +
              "</b> went in the bin." });
      } else {
        rows.push({ e: "🥤", did: "You made " + made + " cups for " + E.money(run.spentToday) + ".",
          so: "You sold <b>every one</b>, with none left over. Spot on." });
      }
    }

    // What you charged.
    if (!r.shut) {
      const margin = run.price - run.today.unit;
      rows.push({ e: "💵", did: "You charged " + E.price(run.price) + " a cup.",
        so: margin > 0
          ? "Each one cost you " + E.price(run.today.unit) + ", so you kept <b>" +
            E.price(margin) + "</b> of every cup you sold."
          : "Each one cost you " + E.price(run.today.unit) + " to make, so you <b class='bad'>lost " +
            E.price(-margin) + "</b> on every cup." });
    }

    // What the weather did to that.
    if (run.today.event) {
      const ev = run.today.event;
      rows.push({ e: ev.emoji, did: ev.name + ".",
        so: ev.good ? "That brought you <b>more customers</b> than the forecast promised."
          : ev.lose ? "That cost you <b class='bad'>" + (r.lost || 0) + " cups</b> before you sold a single one."
          : "That sent <b class='bad'>a lot of your customers away</b>." });
    }

    // The till.
    if (run.changeRight + run.changeWrong > 0) {
      rows.push({ e: "🪙",
        did: run.changeWrong > 0 ? "You got the change wrong." : "You got the change right.",
        so: run.overpaidToday > 0
          ? "You handed over <b class='bad'>" + E.price(run.overpaidToday) + " too much</b>, and they kept it."
          : run.changeWrong > 0
            ? "They noticed, and your regulars <b class='bad'>liked you a bit less</b> for it."
            : run.tipsToday > 0
              ? "They left you <b>" + E.price(run.tipsToday) + "</b> as a thank-you."
              : "No money lost at the till." });
    }

    for (const row of rows) {
      const d = document.createElement("div");
      d.className = "cause";
      d.innerHTML = '<span class="cause-emoji">' + row.e + '</span><span class="cause-body">' +
        '<span class="cause-did">' + row.did + '</span>' +
        '<span class="cause-so">' + row.so + "</span></span>";
      list.appendChild(d);
    }
  }

  // The overnight card: the bank book, the bars, and what any loan is costing.
  function night(run, res) {
    const card = $("nightCard");
    show(card, true);

    text("bankBefore", E.money(res.bankBefore));
    // price() rather than money(): "45c" is how a child says it, "$0.45" isn't.
    text("bankAdded", res.interest.paid > 0 ? "+ " + E.price(res.interest.paid) : "nothing");
    text("bankRate", res.interest.paid > 0 ? "(" + res.interest.rate + "c for every dollar)" : "");
    text("bankAfter", E.money(res.bankBefore));
    countUpTo("bankAfter", res.bankBefore, res.bankAfter);

    LS.Chart.bank($("bankChart"), run);

    const so = $("bankPaidSoFar");
    if (res.paidSoFar > 0) {
      so.textContent = "The bank has paid you " + E.price(res.paidSoFar) +
        " so far, for doing nothing at all.";
      so.className = "verdict good";
      show(so, true);
    } else if (res.bankBefore > 0) {
      so.textContent = "Not quite enough in the bank yet to earn a whole 5c overnight. Keep adding to it.";
      so.className = "verdict";
      show(so, true);
    } else {
      so.textContent = "Nothing in the bank, so the bank paid you nothing. Money in your pocket doesn't grow.";
      so.className = "verdict";
      show(so, true);
    }

    const loan = $("loanLine");
    if (res.loan) {
      loan.textContent = "💳 Your loan cost you " + E.price(res.loan.perNight) +
        " tonight — " + E.price(Math.min(res.loan.soFar, res.loan.total)) + " of " +
        E.price(res.loan.total) + " so far.";
      show(loan, true);
    } else show(loan, false);

    for (const id of ["bankNone", "bankHalf", "bankAll"]) $(id).disabled = true;
    show($("nextBtn"), true);
    $("nextBtn").textContent = run.day >= E.spec(run.difficulty).days
      ? "See how you did" : "Next morning";
    purse(run); goal(run);
  }

  /* ── The bank sheet ─────────────────────────────────────────────────────── */

  function bankSheet(run, onTake) {
    const list = $("loanList");
    list.textContent = "";
    $("bankBlurb").textContent = "The bank pays you " + E.RATE +
      "c a night for every dollar you leave with it. It charges you 6c a night for every dollar you borrow — twice as much. That gap is how a bank makes its money.";

    if (run.loan) {
      const d = document.createElement("div");
      d.className = "debt-card";
      d.innerHTML = "<b>You already owe the bank.</b>You borrowed " + E.money(run.loan.borrow) +
        ". You pay back <b style='display:inline'>" + E.money(run.loan.repay) + "</b> on day " +
        run.loan.due + ". You can't borrow again until that's settled.";
      list.appendChild(d);
      return;
    }

    const offers = E.loanOffers(run);
    if (!offers.length) {
      const p = document.createElement("p");
      p.className = "sub";
      p.textContent = "The bank isn't lending today — there aren't enough days left to pay it back.";
      list.appendChild(p);
      return;
    }

    for (const L of offers) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "offer";
      b.innerHTML = '<span class="offer-emoji">💰</span><span class="offer-body">' +
        '<span class="offer-name">Borrow ' + E.money(L.borrow) + "</span>" +
        '<span class="offer-note">Pay back <b>' + E.money(L.repay) + "</b> on day " +
        (run.day + L.nights) + ". That costs you " + E.money(L.repay - L.borrow) + "." +
        "</span></span>";
      b.addEventListener("click", () => onTake(L.id));
      list.appendChild(b);
    }
  }

  /* ── The shop sheet ─────────────────────────────────────────────────────── */

  function treatSheet(run, onBuy) {
    const list = $("treatList");
    list.textContent = "";
    for (const t of E.TREATS) {
      const owned = t.once && run.treats[t.id];
      const had = t.id === "cream" && run.treats.creamsOn.includes(run.day);
      const canAfford = t.cost <= E.affordable(run);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "offer" + (owned ? " owned" : "");
      b.disabled = !!owned || !!had || !canAfford;
      b.innerHTML = '<span class="offer-emoji">' + t.emoji + '</span><span class="offer-body">' +
        '<span class="offer-name">' + t.name + "</span>" +
        '<span class="offer-note">' + (owned ? "You've got one." : had ? "You've had one today." : t.blurb) +
        "</span></span><span class='offer-cost'>" + (owned ? "✓" : E.money(t.cost)) + "</span>";
      b.addEventListener("click", () => onBuy(t.id));
      list.appendChild(b);
    }
  }

  /* ── Result ─────────────────────────────────────────────────────────────── */

  function result(run, best) {
    const s = E.summary(run);
    const sp = E.spec(run.difficulty);

    text("resultEmoji", s.won ? "🏆" : s.rung >= 2 ? "🙂" : "🍋");
    text("resultTitle", s.won ? "You got " + s.prize.replace(/^[^ ]+ /, "") + "!"
      : s.rung > 0 ? "Not bad at all" : "A tough fortnight");
    text("resultSub", s.won
      ? "You saved up " + E.money(s.final) + " in " + sp.days + " days. That's the lot."
      : "You finished with " + E.money(s.final) + ". " + s.prize + " costs " + E.money(s.target) + ".");
    text("resultFinal", E.money(s.final));

    LS.Chart.render($("chart"), run);

    const ladder = $("ladder");
    ladder.textContent = "";
    sp.goal.forEach((amount, i) => {
      const got = s.final >= amount;
      const d = document.createElement("div");
      d.className = "rung" + (got ? " got" : "");
      d.innerHTML = '<span class="rung-tick">' + (got ? "✅" : "⬜") + "</span>" +
        "<span>" + sp.rungs[i] + '</span><span class="rung-cost">' + E.money(amount) + "</span>";
      ladder.appendChild(d);
    });

    text("takeaway", E.takeaway(run));

    const st = $("stickers");
    st.textContent = "";
    const stickers = [];
    for (let i = 0; i < s.creams; i++) stickers.push("🍦");
    if (run.treats.sign) stickers.push("🪧");
    if (run.treats.bucket) stickers.push("🧊");
    if (s.interest > 0) stickers.push("🏦");
    if (s.borrowed > 0) stickers.push("💳");
    st.textContent = stickers.join(" ");

    const bestLine = $("resultBest");
    if (best && best > 0) {
      bestLine.textContent = s.final >= best
        ? "🏅 That's your best " + sp.days + "-day run yet!"
        : "Your best " + sp.days + "-day run is " + E.money(best) + ".";
      show(bestLine, true);
    } else show(bestLine, false);
  }

  return { show, text, header, purse, goal, coach, toast, phase,
           morning, packs, prices, basket, hint, stepShow, stepHide,
           sellingScreen, sellStep, sellDone, dayDone, event,
           coinPad, changeAsk, changeTray, changeResult, changeHide,
           evening, night, bankSheet, treatSheet, result };
})();
