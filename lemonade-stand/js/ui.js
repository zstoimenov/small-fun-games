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

  const lit = (run) => run.bank >= E.BONUS_AT && E.spec(run.difficulty).bonusRate;

  function purse(run) {
    $("pocketChip").innerHTML = "👛 <b>" + E.money(run.pocket) + "</b>";
    $("bankChip").innerHTML = "🏦 <b>" + E.money(run.bank) + "</b>";
    const owing = !!run.loan;
    show($("debtChip"), owing);
    if (owing) $("debtChip").innerHTML = "💳 <b>" + E.money(run.loan.repay) + "</b>";
    // The bank chip lights up when there's something in it worth the bonus rate.
    $("bankChip").classList.toggle("lit", lit(run));
  }

  // The same three numbers, drawn into a sheet. A sheet covers the real purse,
  // and "how much have I got?" is the first thing you need to know on every
  // screen that asks you to spend some of it — so every such sheet carries one.
  // Labelled here, unlike the topbar, because there is room to say it.
  // `plain` is for the bank's own sheet, where a chip that opens the bank would
  // be a button that does nothing.
  function purseInto(node, run, plain) {
    if (!node) return;
    // Tappable here too. A sheet covers the topbar, and the morning is mostly
    // spent inside one — a bank you can only ask about between sheets is a bank
    // nobody asks about.
    const tag = plain ? "span" : "button";
    const bits = [
      '<span class="purse-part">👛 Purse<b>' + E.money(run.pocket) + "</b></span>",
      "<" + tag + (plain ? "" : ' type="button"') + ' class="purse-part' +
        (plain ? "" : " tappable") + (lit(run) ? " lit" : "") +
        '">🏦 Bank<b>' + E.money(run.bank) + "</b></" + tag + ">"
    ];
    if (run.loan) {
      bits.push('<span class="purse-part debt">💳 You owe<b>' +
        E.money(run.loan.repay) + "</b></span>");
    }
    node.innerHTML = bits.join("");
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
    // Each phase owns its own scroller, and a hidden one keeps whatever offset
    // it was left at. Without this the evening reopens every night exactly
    // where it was abandoned — at the bottom, past the sums.
    top(name);
  }

  // Put a phase's scroller back to the top. Anything that swaps what is inside
  // one has to call this, or the new content arrives already scrolled.
  function top(name) {
    const sc = $(name) && $(name).querySelector(".scroller");
    if (sc) sc.scrollTop = 0;
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
    const words = tier.pull > 1.2 ? "Lots of people will buy, but there's not much in it for you."
      : tier.back >= 2 ? "A fair price. People come back to a stall that's fair."
      : tier.back > 0 ? "You make more on each cup, but fewer people will buy one, and fewer come back."
      : "Hardly anybody will pay that, and you'd lose regulars over it.";
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
    const regsToday = E.regularsExpected(run.regulars, info.forecast, run.price);
    text("forecastNote", run.regulars > 0
      ? "😀 about " + regsToday + " of your " + run.regulars + " regulars"
      : info.sure ? "Always right on this setting" : "Usually right — not always");

    text("unitPrice", E.price(info.unit));
    const v = unitVerdict(info.unit);
    $("unitVerdict").textContent = v.s;
    $("unitVerdict").className = "verdict " + v.c;

    text("planPriceValue", E.price(run.price));
    text("planPriceNote", "lemons cost " + E.price(info.unit) + " a cup");

    packs(run);
    prices(run);
    basket(run);

    // Say what the button is FOR. "The bank" is a place; "Borrow $5.00" is an
    // offer, and an offer is the thing a child short of lemon money needs to see.
    const due = run.loan && run.loan.due === run.day + 1;
    const offers = E.loanOffers(run);
    $("loanBtn").classList.toggle("due", !!due);
    $("loanBtn").textContent = run.loan ? "🏦 You owe " + E.money(run.loan.repay)
      : offers.length ? "🏦 Borrow " + E.money(offers[0].borrow) : "🏦 The bank";
    const wants = E.TREATS.filter((t) => E.treatAvailable(run, t.id) && E.canAfford(run, t.cost));
    $("treatBtn").classList.toggle("hot", wants.length > 0);
    $("treatBtn").textContent = run.treats.bucket && run.treats.sign
      ? "🎁 Shop" : "🎁 Shop 🧊 🪧";

    if (hints) coach(hint(run), "calm"); else coach(null);
    const open = $("openBtn");
    open.disabled = false;
    open.textContent = run.cups > 0 ? "Open the stall" : "Stay shut today";
    // Shutting for the day is a real choice and sometimes the right one, but it
    // is never the way onwards, so it doesn't get to look like it.
    open.classList.toggle("btn-no", run.cups === 0);
    open.classList.toggle("btn-go", run.cups > 0);
  }

  function packs(run) {
    const unit = run.today.unit;
    const small = E.packPrice(unit, E.PACKS[0]);
    const big = E.packPrice(unit, E.PACKS[1]);
    text("smallCost", E.money(small));
    text("bigCost", E.money(big));
    text("bigSave", "save " + E.money(E.packSaving(unit)));
    $("buySmall").disabled = !E.canAfford(run, small) || run.cups + 5 > E.STALL_LIMIT;
    $("buyBig").disabled = !E.canAfford(run, big) || run.cups + 15 > E.STALL_LIMIT;
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
    const trip = run.feesToday > 0 ? " · " + E.price(run.feesToday) + " for the trip to the bank" : "";
    text("basket", run.cups === 0 ? "nothing yet" : run.cups + " cups");
    text("planStockNote", run.cups === 0 ? "Tap to buy some lemons"
      : "spent " + E.money(run.spentToday) +
        (carried > 0 ? " · " + carried + " kept from yesterday" : ""));
    text("stepBasket", run.cups === 0 ? "Nothing bought yet."
      : "🥤 " + run.cups + " cups ready" +
        (run.boughtToday ? " · spent " + E.money(run.spentToday) : "") +
        (carried > 0 ? " · " + carried + " kept from yesterday" : "") + trip);
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
  //
  // `opts` carries the two things that used to be missing from a sheet — whether
  // tips are on, and what to do when the child taps something on one of the
  // inline shelves — plus `single`, for a step reopened from a plan row.
  function stepShow(run, id, at, total, opts) {
    const o = opts || {};
    const single = !!o.single;
    show($("step"), true);
    for (const p of PARTS) show($(p), false);
    text("stepCount", (at + 1) + " / " + total);
    show($("stepCount"), !single);
    show($("stepDots"), !single);
    dots("stepDots", total, at);
    show($("stepBack"), at > 0 && !single);
    purseInto($("stepPurse"), run);

    // Green means "on you go". Anything that turns something down is re-coloured
    // below, and re-set here so it can't stay red into the next step.
    const next = $("stepNext");
    next.className = "btn btn-go";

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
      // Regulars come whatever the sky is doing. Saying so here, next to the
      // forecast, is what turns them from a number into a reason to stock up.
      // The honest number for TODAY, not the headline count. Weather keeps some
      // of them at home, and a screen that promises twelve and serves nine is a
      // screen a child stops believing.
      const reg = $("stepRegulars");
      show(reg, run.regulars > 0);
      if (run.regulars > 0) {
        const coming = E.regularsExpected(run.regulars, info.forecast, run.price);
        reg.innerHTML = coming >= run.regulars
          ? "😀 All <b>" + run.regulars + "</b> of your regulars should come today."
          : "😀 About <b>" + coming + "</b> of your <b>" + run.regulars +
            "</b> regulars will come out in this" +
            (info.forecast <= 1 ? " — the rest will stay home." : ".");
      }
      show($("stepWeather"), true);
      text("stepNext", "Next");
    } else if (id === "buy") {
      text("stepTitle", "How much will you make?");
      text("stepSay", "Buy too few and you'll run out. Buy too many and the rest goes in the bin.");
      packs(run);
      basket(run);
      buyShelves(run, o);
      show($("stepBuy"), true);
      if (run.cups > 0) text("stepNext", "Next");
      else { text("stepNext", "Don't buy any"); next.className = "btn btn-no"; }
    } else if (id === "price") {
      text("stepTitle", "What will you charge?");
      text("stepSay", "You keep whatever is left after the lemons are paid for.");
      prices(run);
      $("priceTake").innerHTML = run.cups > 0
        ? "<b>" + run.cups + "</b> cups at <b>" + E.price(run.price) + "</b> is <b>" +
          E.money(run.cups * run.price) + "</b> if you sell the lot"
        : "You haven't got any cups to sell yet.";
      show($("stepPrice"), true);
      text("stepNext", "Next");
    } else {
      text("stepTitle", "Ready to open?");
      text("stepSay", "That's everything decided.");
      readyStep(run);
      show($("stepReady"), true);
      if (run.cups > 0) text("stepNext", "Open the stall");
      else { text("stepNext", "Stay shut today"); next.className = "btn btn-no"; }
    }
    // Reopened from a plan row to change one thing. It closes, it doesn't march
    // on, so it is never the button that turns anything down.
    if (single) { text("stepNext", "Done"); next.className = "btn btn-go"; }
    hintInto(run, id, o.hints);
  }

  // The two shelves under the lemons: things to buy, and the bank. Both live on
  // the buying screen because that is where the money is, and a loan you can
  // only reach from another sheet is a loan that gets taken after the decision
  // it was needed for.
  function buyShelves(run, o) {
    const shop = $("stepShop");
    const n = shopInto($("stepShopList"), run, o.onTreat || (() => {}), true);
    show(shop, n > 0);

    const state = loansInto($("stepBankList"), run, o.onLoan || (() => {}));
    const head = $("stepBank").querySelector(".shelf-head");
    head.innerHTML = state === "offers"
      ? "🏦 The bank <span class='muted'>short? borrow it</span>"
      : "🏦 The bank";
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

  /* ── Tips, on the screen the decision is made on ────────────────────────── */

  // The coach lives on the morning screen, which a sheet covers up. So each step
  // gets its own line, about the question it is actually asking — a tip about
  // buying lemons is no use on the screen where you pick a price.
  function hintInto(run, id, hints) {
    const node = $("stepHint");
    const h = hints ? stepTip(run, id) : null;
    if (!h) { show(node, false); return; }
    node.textContent = "💡 " + h.s;
    node.className = "step-hint " + (h.c || "");
    show(node, true);
  }

  function stepTip(run, id) {
    const info = run.today;
    if (id === "weather") {
      const coming = E.regularsExpected(run.regulars, info.forecast, run.price);
      if (info.forecast <= 1 && coming >= 3) {
        return { s: "Hardly anyone will walk past, so your regulars are most of today. " +
          "Don't make many more cups than that." };
      }
      if (info.forecast >= 3) return { s: "Busy day coming. A full stall could really pay off." };
      if (info.forecast <= 1) return { s: "Hardly anyone will be about. Don't make more than you can sell.", c: "warn" };
      return { s: "An ordinary sort of day. Something in the middle is about right." };
    }
    if (id === "buy") return buyTip(run);
    if (id === "price") {
      if (run.price < info.unit) {
        return { s: "You'd lose " + E.price(info.unit - run.price) +
          " every time somebody bought one. Charge more than " + E.price(info.unit) + ".", c: "warn" };
      }
      if (run.price >= 150) return { s: "That's a lot to ask. Hardly anybody will buy one.", c: "warn" };
      return { s: "Lemons cost you " + E.price(info.unit) +
        " a cup today. Everything above that, you keep." };
    }
    if (id === "ready") {
      if (run.cups === 0) return { s: "With no cups there's nothing to sell. Go back and buy some lemons.", c: "warn" };
      if (run.bank === 0 && run.day > 2) {
        return { s: "All your money is in your purse. Tonight, put what you don't need into the bank." };
      }
      return null;
    }
    return null;
  }

  // The buying screen carries the most weight, so its tip is the most specific:
  // it names the shortfall, and it names where the money could come from.
  function buyTip(run) {
    const info = run.today;
    const small = E.packPrice(info.unit, E.PACKS[0]);
    const big = E.packPrice(info.unit, E.PACKS[1]);
    const have = E.affordable(run);
    const offers = E.loanOffers(run);
    if (run.cups === 0 && have < small) {
      return offers.length
        ? { s: "You haven't got enough for any lemons. The bank will lend you " +
             E.money(offers[0].borrow) + " — it's right below.", c: "warn" }
        : { s: "You haven't got enough for any lemons today. A shut day costs you nothing at least.", c: "warn" };
    }
    if (run.cups === 0 && have < big && offers.length && !run.loan) {
      return { s: "You're " + E.money(big - have) + " short of a full stall. The bank will lend you " +
        E.money(offers[0].borrow) + " — it's right below." };
    }
    if (E.feeFor(run, big) > 0 && run.pocket < big) {
      return { s: "Your purse won't cover this on its own, so " + E.price(E.WITHDRAW_FEE) +
        " comes off for the trip to the bank. Tonight, keep a bit more back." };
    }
    if (run.cups === 0 && info.unit <= 32) {
      return { s: "Lemons are cheap today — " + E.price(info.unit) +
        " a cup. This is the day to fill the stall." };
    }
    const coming = E.regularsExpected(run.regulars, info.forecast, run.price);
    if (coming > 0 && run.cups < coming) {
      return { s: "About " + coming + " of your regulars are coming today whatever happens. " +
        "Make at least that many cups." };
    }
    if (info.forecast >= 3 && run.cups < 20) return { s: "It's going to be busy. More cups might be worth it." };
    if (info.forecast <= 1 && run.cups > 15) return { s: "Not many people about today. That's a lot of cups to shift.", c: "warn" };
    if (run.cups === 0) return { s: "The big pack is always cheaper per cup. Buy as many as you think you can sell." };
    return { s: "You've got " + run.cups + " cups ready. Tap Next when that's enough." };
  }

  // One short nudge on the morning screen, and only when the tips switch is on.
  function hint(run) {
    const info = run.today;
    if (run.cups === 0 && E.affordable(run) < E.packPrice(info.unit, E.PACKS[0])) {
      return "You haven't got enough for any lemons. The bank will lend you some.";
    }
    if (run.cups === 0) return "Buy some lemons first — you can't sell what you haven't got.";
    if (run.price < info.unit) return "You're selling for less than the lemons cost you.";
    if (info.forecast >= 3 && run.cups < 20) return "It's going to be busy. More cups might be worth it.";
    if (info.forecast <= 1 && run.cups > 15) return "Not many people about today. That's a lot of cups to shift.";
    if (run.bank === 0 && run.day > 2) return "Your money is all in your purse. The bank pays you " +
      E.RATE + "c a night for every dollar you leave in it.";
    if (run.pocket === 0 && run.bank > 0) return "Nothing in your purse, so buying anything today means " +
      E.price(E.WITHDRAW_FEE) + " for a trip to the bank.";
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
    text("backCount", "0");
    show($("legendRegulars"), !!(run.result && run.result.regularCups > 0));
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
    // Regulars are at the front of the queue, so the first cups of the day go
    // to them. This party started at (servedSoFar - partySize).
    const back = run.result.regularCups || 0;
    const mine = !thirsty && servedSoFar - partySize < back;
    const person = document.createElement("span");
    person.className = "customer" + (thirsty ? " thirsty" : "") +
      (partySize > 1 ? " party" : "") + (mine ? " regular" : "");
    person.textContent = thirsty ? "😕" : mine ? "😀" : "🙂";
    if (mine) {
      const star = document.createElement("u");
      star.textContent = "★";
      person.appendChild(star);
    }
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
    const served = Math.min(back, servedSoFar);
    show($("legendRegulars"), served > 0);
    text("backCount", String(served));
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
    show($("legendRegulars"), (r.regularCups || 0) > 0);
    text("backCount", String(r.regularCups || 0));
    text("cupsLeft", String(Math.max(0, run.cups - r.sold)));
    text("tillTotal", E.money(r.earned));
    if (r.turned > 0) { show($("turnedLine"), true); text("turnedCount", String(r.turned)); }
  }

  /* ── Evening ────────────────────────────────────────────────────────────── */

  /* The evening is walked, not scrolled. Each beat is one screen's worth and
     one idea: what happened, who's coming back, where the money sleeps, what
     the bank did with it overnight. The beat with the bank buttons on it can
     only be reached through the beat with the sums on it, which is the whole
     point — the buttons used to be the only part anybody read. */

  let beats = [];     // ids of the beats in play tonight
  let beatAt = 0;
  let banked = false; // the night's choice is made, so the way forward is open

  const ALL_BEATS = ["beatDay", "beatWhy", "beatRegulars", "beatBank", "beatNight"];

  function beatList(run) {
    const list = ["beatDay", "beatWhy"];
    if (run.growth) list.push("beatRegulars");
    return list.concat(["beatBank", "beatNight"]);
  }

  function drawBeats() {
    for (const id of ALL_BEATS) {
      show($(id), beats[beatAt] === id);
    }
    top("evening");

    const dots = $("eveningDots");
    dots.textContent = "";
    for (let i = 0; i < beats.length; i++) {
      const d = document.createElement("span");
      d.className = "dot" + (i === beatAt ? " on" : "");
      dots.appendChild(d);
    }

    const last = beatAt === beats.length - 1;
    show($("eveBack"), beatAt > 0);
    // On the bank beat there is nothing to go forward to until the money has
    // been put somewhere. Everywhere else, forward is always available.
    show($("eveNext"), !last && (beats[beatAt] !== "beatBank" || banked));
    show($("nextBtn"), last && banked);
  }

  // Walk. Handed straight to the two buttons, so there is one way to move.
  function beatStep(by) {
    beatAt = Math.max(0, Math.min(beats.length - 1, beatAt + by));
    drawBeats();
  }

  function evening(run) {
    const r = run.result;
    phase("evening");
    header(run); purse(run); goal(run);
    coach(null);

    // Everything that left your hands today, not just the lemons. A day where
    // 25c went on a trip to the bank and $1.50 went on an ice cream has to add
    // up on screen, or the purse won't match the sum underneath it.
    const takings = r.earned + run.tipsToday - run.overpaidToday;
    const profit = takings - run.spentToday - run.treatToday - run.feesToday;
    text("sumSpent", E.money(run.spentToday));
    text("sumEarned", E.money(takings));
    text("sumProfit", E.money(Math.abs(profit)));
    text("sumTotalLabel", profit < 0 ? "So you lost" : "So you made");
    $("sumTotalLine").classList.toggle("loss", profit < 0);
    show($("sumTreatLine"), run.treatToday > 0);
    text("sumTreat", E.money(run.treatToday));
    show($("sumFeeLine"), run.feesToday > 0);
    text("sumFee", E.price(run.feesToday));

    // The verdict lines under the causes card used to say the leftovers, the
    // lost cups and the queue you turned away a second time, in shorter words.
    // "What your choices did" already says all three with the reason attached,
    // and the repeat was what pushed this screen past one screenful.
    causes(run);

    grewCard(run);
    show($("nightCard"), false);
    bankChoices(run);

    beats = beatList(run);
    beatAt = 0;
    banked = false;
    drawBeats();
  }

  // Word of mouth, laid out exactly like the bank book — because it is the same
  // idea in a different currency: a thing you build up that pays you back every
  // day whether you do anything or not.
  function grewCard(run) {
    const g = run.growth;
    const card = $("growCard");
    if (!g) { show(card, false); return; }
    show(card, true);

    text("growCount", String(g.after));
    text("growBefore", String(g.before));
    text("growGained", "+ " + g.gained);
    show($("growGainedRow"), g.gained > 0 || g.lost === 0);
    show($("growLostRow"), g.lost > 0);
    text("growLost", "- " + g.lost);
    text("growLostWhy", g.gouged ? "Walked off at that price"
      : g.shut ? "Went somewhere else today"
      : g.wrongChange > 0 ? "Didn't like being short-changed"
      : "Couldn't get one and gave up");
    text("growAfter", String(g.after));

    const note = $("growNote");
    note.className = "verdict" + (g.after > g.before ? " good" : g.after < g.before ? " bad" : "");
    note.textContent = g.capped
      ? "That's as many as your stall can serve at once. You've built a proper little business."
      : g.gouged
        ? "Nobody comes back to a stall that charges " + E.price(run.price) + " a cup."
      : g.wrongChange > 0
        ? "People remember being short-changed. Get the sums right and they come back."
      : g.after === 0
        ? "Nobody's a regular yet. Serve more people and some of them will start coming back."
      : g.after > g.before
        ? g.after + " people will be looking for your stall tomorrow. Bad weather keeps a few " +
          "of them home, but never all of them."
        : "No new regulars today, but you've still got " + g.after + ".";
  }

  // Tonight's question, with the actual money written on every button. It is a
  // real question now: the bank pays, but reaching back into it costs a trip, so
  // "bank the lot" and "keep the lot" are both wrong and the child has to find
  // the middle.
  function bankChoices(run) {
    const ids = ["bankNone", "bankHalf", "bankFloat", "bankAll"];
    for (const id of ids) $(id).disabled = false;

    const half = E.cents5(Math.floor(run.pocket / 2));
    const float = Math.max(0, run.pocket - E.FLOAT);
    // Written from FLOAT rather than typed into the markup, so the button and
    // the money it moves can never disagree.
    $("bankFloat").innerHTML = "Keep " + E.money(E.FLOAT) + ", bank the rest<i></i>";
    const amount = (id) => $(id).querySelector("i");
    amount("bankHalf").textContent = "bank " + E.money(half);
    amount("bankFloat").textContent = "bank " + E.money(float);
    amount("bankAll").textContent = "bank " + E.money(run.pocket);

    // Keeping a float back only means anything while there is a surplus to bank.
    const surplus = float >= 100;
    show($("bankFloat"), surplus);
    show($("bankHalf"), run.pocket > 0);
    show($("bankAll"), run.pocket > 0);

    // Which one the game would do, marked honestly rather than always pointing
    // at the bank. On day two, with $5.25 and lemons to buy in the morning,
    // banking the lot earns 15c of interest and costs 25c to get back — so
    // "keep it all" really is the answer, and saying otherwise would be a lie
    // the child can check.
    for (const id of ids) $(id).classList.remove("strong");
    $(surplus ? "bankFloat" : "bankNone").classList.add("strong");
    $("bankNone").innerHTML = run.pocket > 0
      ? "Keep it all<i>bank nothing</i>" : "Goodnight<i>nothing to bank</i>";

    $("bankNote").textContent = run.pocket > 0
      ? "You've got " + E.money(run.pocket) + " in your purse. The bank pays you " +
        E.RATE + "c a night for every dollar you leave with it."
      : "Nothing in your purse to bank tonight.";
    $("floatNote").textContent = run.pocket > 0
      ? "You can still spend bank money any time — but taking it out costs " +
        E.price(E.WITHDRAW_FEE) + " a trip. Keep enough in your purse for tomorrow's lemons."
      : "";
    show($("floatNote"), run.pocket > 0);

    const due = run.loan && run.loan.due === run.day + 1;
    show($("dueNote"), !!due);
    if (due) {
      $("dueNote").textContent = "💳 The bank takes its " + E.money(run.loan.repay) +
        " back in the morning — out of your bank first, then your purse. No charge for that one.";
    }
  }

  // Counts a money figure up to its final value. Whole 5c steps, never a tween
  // on a raw number — a tween would print fractions of a cent on the way, and
  // every amount in this game is 5c-clean.
  //
  // The step is sized to the distance rather than fixed at 5c: the bank book
  // climbs a few cents a night and wants every one of them, while the final
  // total can be a hundred and seventy dollars and still has to arrive in about
  // a second.
  let countTimer = null;
  function countUpTo(id, from, to, done) {
    clearInterval(countTimer);
    const reduce = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const span = to - from;
    if (reduce || span <= 0) { text(id, E.money(to)); if (done) done(); return; }
    const ticks = Math.min(45, Math.max(1, Math.round(span / 5)));
    const step = Math.ceil(span / ticks / 5) * 5;
    let at = from;
    const every = Math.max(16, Math.min(90, Math.round(800 / ticks)));
    countTimer = setInterval(() => {
      at += step;
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
              " more</b> people wanted one you didn't have. Make more tomorrow." });
      } else if (r.wasted > 0 && run.treats.bucket) {
        // The bucket is the only thing that makes leftovers not a loss, so it
        // has to be said here, on the line that would otherwise call them one.
        rows.push({ e: "🥤", did: "You made " + made + " cups for " + E.money(run.spentToday) + ".",
          so: "You only sold " + r.sold + ", but the 🧊 ice bucket <b>keeps the other " +
              r.wasted + "</b> for tomorrow." });
      } else if (r.wasted > 0) {
        rows.push({ e: "🥤", did: "You made " + made + " cups for " + E.money(run.spentToday) + ".",
          so: "You only sold " + r.sold + ", so <b class='bad'>" + r.wasted +
              "</b> went in the bin. Lemonade doesn't keep." });
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

    // What the business you've built did for you today, in cups.
    if ((r.regularCups || 0) > 0) {
      rows.push({ e: "😀", did: "Your regulars came, and bought " + r.regularCups +
          (r.regularCups === 1 ? " cup." : " cups."),
        so: "That's <b>" + r.regularCups + "</b> you'd have sold whatever the weather did." });
    }

    // The trip to the bank. Small money, but it is the only thing in the game
    // that punishes emptying your purse, so it has to be named out loud.
    if (run.feesToday > 0) {
      rows.push({ e: "🏦", did: "Your purse didn't cover today's shopping.",
        so: "So you went to the bank for the rest, and the trip cost you <b class='bad'>" +
            E.price(run.feesToday) + "</b>." });
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
      so.textContent = "Nothing in the bank, so the bank paid you nothing. Money in your purse doesn't grow.";
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

    for (const id of ["bankNone", "bankHalf", "bankFloat", "bankAll"]) $(id).disabled = true;
    $("nextBtn").textContent = run.day >= E.spec(run.difficulty).days
      ? "See how you did" : "Next morning";

    // The choice has been made, so the way out of the evening opens — and the
    // bank book is what you get taken to, rather than something appended below
    // the fold of the screen you were already on.
    banked = true;
    beatAt = beats.length - 1;
    drawBeats();
    purse(run); goal(run);
  }

  /* ── The bank and the shop ──────────────────────────────────────────────── */

  // Both of these draw into whatever node they're handed, because both appear
  // twice: inline on the buying screen, where the money is actually being spent,
  // and in their own sheet for the all-at-once morning. One renderer each means
  // the two copies can't drift apart.

  // Returns what the bank had to say, so a caller can word the heading around it.
  function loansInto(node, run, onTake) {
    node.textContent = "";

    if (run.loan) {
      const d = document.createElement("div");
      d.className = "debt-card";
      d.innerHTML = "<b>💳 You already owe the bank.</b>You borrowed " + E.money(run.loan.borrow) +
        ". It takes back <b style='display:inline'>" + E.money(run.loan.repay) +
        "</b> on the morning of day " + run.loan.due +
        " — out of your bank first, then your purse. You can't borrow again until then.";
      node.appendChild(d);
      return "owing";
    }

    const offers = E.loanOffers(run);
    if (!offers.length) {
      const p = document.createElement("p");
      p.className = "shelf-note";
      p.textContent = "The bank isn't lending now — there aren't enough days left to pay it back.";
      node.appendChild(p);
      return "shut";
    }

    for (const L of offers) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "offer";
      b.innerHTML = '<span class="offer-emoji">💰</span><span class="offer-body">' +
        '<span class="offer-name">Borrow ' + E.money(L.borrow) + "</span>" +
        '<span class="offer-note">Pay back <b>' + E.money(L.repay) + "</b> on day " +
        (run.day + L.nights) + ". Borrowing it costs you " + E.money(L.repay - L.borrow) + "." +
        "</span></span>";
      b.addEventListener("click", () => onTake(L.id));
      node.appendChild(b);
    }
    return "offers";
  }

  // `hideOwned` is what the inline shelf uses: something you already own is not
  // a decision any more, and leaving it there is clutter on the one screen that
  // can least afford it. The shop sheet keeps them, ticked, as a stocktake.
  // Returns how many rows were drawn, so an empty shelf can hide itself.
  function shopInto(node, run, onBuy, hideOwned) {
    node.textContent = "";
    let n = 0;
    for (const t of E.TREATS) {
      const owned = t.once && run.treats[t.id];
      const had = t.id === "cream" && run.treats.creamsOn.includes(run.day);
      if (hideOwned && (owned || had)) continue;
      n++;
      const afford = E.canAfford(run, t.cost);
      const fee = E.feeFor(run, t.cost);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "offer" + (owned ? " owned" : "");
      b.disabled = !!owned || !!had || !afford;
      const note = owned ? "You've got one." : had ? "You've had one today."
        : !afford ? "You haven't got enough for this yet."
        : (hideOwned ? t.short : t.blurb) +
          (fee ? " Plus " + E.price(fee) + " for the trip to the bank." : "");
      b.innerHTML = '<span class="offer-emoji">' + t.emoji + '</span><span class="offer-body">' +
        '<span class="offer-name">' + t.name + "</span>" +
        '<span class="offer-note">' + note +
        "</span></span><span class='offer-cost'>" + (owned ? "✓" : E.money(t.cost)) + "</span>";
      b.addEventListener("click", () => onBuy(t.id));
      node.appendChild(b);
    }
    return n;
  }

  function bankSheet(run, onTake) {
    purseInto($("loanPurse"), run, true);
    // The borrowing half only — the paying half is the book above, and this
    // used to repeat all of it.
    $("bankBlurb").textContent = "Borrowing works the other way: the bank charges you 6c a night for every dollar you borrow, twice what it pays you. That gap is how a bank makes its money.";
    bankBook(run);
    loansInto($("loanList"), run, onTake);
  }

  // What the bank is doing with your money, on demand rather than once a night
  // as it flies past. Everything here is read out of the model — the rate, what
  // tonight would add at that rate, and what it has added so far — so it can
  // never quietly disagree with the bank book the evening shows.
  function bankBook(run) {
    const sp = E.spec(run.difficulty);
    const int = E.interestOn(run.bank, sp);
    const paid = E.totalInterest(run);

    text("bankBookRate", int.rate + "c");
    text("bankBookTonight", int.paid > 0 ? "+ " + E.price(int.paid) : "nothing");
    text("bankBookPaid", paid > 0 ? E.price(paid) : "nothing");

    // Why it's that rate, and — the useful half — what would change it. The
    // bonus is the one lever in the game a child can plan several days ahead.
    const bonus = sp.bonusRate;
    text("bankBookRateWhy", !bonus
      ? "It pays you " + int.rate + "c a night for every dollar"
      : int.rate === E.RATE_BONUS
        ? "The big rate, because you've got " + E.money(E.BONUS_AT) + " or more in there"
        : "The everyday rate — get to " + E.money(E.BONUS_AT) + " and it becomes " +
          E.RATE_BONUS + "c");

    LS.Chart.bank($("bankBookChart"), run);

    const note = $("bankBookNote");
    if (paid > 0) {
      note.textContent = "That's " + E.price(paid) + " you didn't have to sell a single cup for.";
      note.className = "verdict good";
    } else if (run.bank > 0) {
      note.textContent = "Not quite enough in there to earn a whole 5c overnight yet. Keep adding to it.";
      note.className = "verdict";
    } else {
      note.textContent = "There's nothing in the bank, so it's paying you nothing. Money in your purse doesn't grow.";
      note.className = "verdict";
    }

    // The catch, in the same breath as the reward. Both halves or neither.
    text("bankBookFee", "Taking money back out costs " + E.price(E.WITHDRAW_FEE) +
      " a trip — once a day, however much you take.");
  }

  function treatSheet(run, onBuy) {
    purseInto($("treatPurse"), run);
    shopInto($("treatList"), run, onBuy, false);

    // Short of the thing you're looking at? The bank is a tap away rather than
    // three screens away. Same offer the buying screen makes.
    // Short of ANY of them, not just the cheapest: the ice cream being within
    // reach is no help to a child looking at the ice bucket.
    const short = E.TREATS.some((t) => E.treatAvailable(run, t.id) && !E.canAfford(run, t.cost));
    const offers = E.loanOffers(run);
    const b = $("treatBorrow");
    show(b, short && offers.length > 0 && !run.loan);
    if (short && offers.length) {
      b.textContent = "🏦 Short? The bank will lend you " + E.money(offers[0].borrow);
    }
  }

  /* ── Result ─────────────────────────────────────────────────────────────── */

  // The reveal at the top of the result sheet. The total counts up from what you
  // started the fortnight with, the prize lands, and then it says what it cost
  // and what you have left — the last sum of the run, and the one that makes the
  // saving feel like it bought something.
  function payoff(run, s, sp, won, label, cost) {
    const prize = $("prize");
    prize.className = "prize" + (won ? "" : " locked");
    // Built fresh rather than retyped. A CSS animation only plays on a node that
    // is new to the document, so setting textContent on the old one would show
    // the prize without the moment where it lands — and the moment is the point.
    const fresh = document.createElement("div");
    fresh.className = "prize-emoji";
    fresh.id = "prizeEmoji";
    // Not won: the thing itself, greyed out and still on the shelf. A padlock
    // says "locked"; the yo-yo you didn't quite reach says what you missed.
    fresh.textContent = prizeEmoji(label);
    prize.replaceChild(fresh, $("prizeEmoji"));
    text("payoffSay", won ? "You saved up" : "You finished with");

    text("resultTitle", won
      ? "You bought " + prizeName(label) + "!"
      : "Not quite " + prizeName(label));
    // A gap in dollars means little; a gap in DAYS is something a child can plan
    // against next time. $3.00 is about what a steady day at the stall clears.
    const days = Math.max(1, Math.round((cost - s.final) / 300));
    text("resultSub", won
      ? (s.won ? "The top of the shelf, in " + sp.days + " days. Nobody does that by luck."
        : "That's " + prizeName(label) + " paid for, out of lemonade money.")
      : "You were " + E.money(cost - s.final) + " short of " + prizeName(label) +
        ". That's about " + days + " more good day" + (days === 1 ? "" : "s") + " at the stall.");

    const change = $("prizeChange");
    show(change, won);
    if (won) {
      const left = s.final - cost;
      // "That cost", not the prize's name: "headphones costs $70" is wrong and
      // "a bike costs $170" is right, and the shelf has both kinds on it.
      change.textContent = "That cost " + E.money(cost) + ", so you've still got " +
        E.money(left) + " left over" +
        (left >= 300 ? " — and that's a start on the next one." : ".");
    }

    // Counts up from the money you were handed on day one, so the number the
    // child watches climb is exactly the amount they made themselves.
    text("resultFinal", E.money(E.START_CASH));
    countUpTo("resultFinal", E.START_CASH, s.final, () => { if (won) burst(); });
  }

  // A handful of confetti, thrown once. Positions are fixed rather than random:
  // this is decoration, and decoration in this game is not allowed a random
  // number generator that could ever disagree with itself on a redraw.
  const CONFETTI = ["var(--accent)", "var(--accent2)", "var(--gold)", "var(--sun)", "var(--good)"];
  function burst(id) {
    const host = $(id || "prizeBurst");
    if (!host) return;
    host.textContent = "";
    for (let i = 0; i < 18; i++) {
      const a = (Math.PI * 2 * i) / 18;
      const far = 70 + (i % 4) * 22;
      const bit = document.createElement("i");
      bit.style.setProperty("--dx", Math.round(Math.cos(a) * far) + "px");
      bit.style.setProperty("--dy", Math.round(Math.sin(a) * far) + "px");
      bit.style.setProperty("--rot", (i % 2 ? 260 : -260) + "deg");
      bit.style.background = CONFETTI[i % CONFETTI.length];
      bit.style.animationDelay = (i % 6) * 40 + "ms";
      host.appendChild(bit);
    }
  }

  /* ── The ice cream ──────────────────────────────────────────────────────── */

  // The shop's one useless thing gets the game's biggest moment. Everything
  // else you can buy is an investment with a payback you can work out; this is
  // the one where the payback is that you enjoyed it, and a toast in the corner
  // was not making that case.
  const CREAM_SAY = [
    "Worth every cent.",
    "You have earned this.",
    "Nobody else gets any.",
    "Business is hard. Ice cream is not."
  ];

  function cheer(run, treat) {
    // Fresh nodes, because prizePop is an entry animation and an entry
    // animation on a node the browser has already laid out plays to nobody.
    const host = $("cheerEmoji");
    const fresh = document.createElement("div");
    fresh.className = "prize-emoji";
    fresh.textContent = treat.emoji;
    fresh.id = "cheerEmoji";
    host.replaceWith(fresh);

    // Walks the list rather than picking at random: two ice creams in a row
    // saying the same thing reads as the game not noticing.
    const said = (run.treats.creamsOn.length - 1 + CREAM_SAY.length) % CREAM_SAY.length;
    text("cheerSay", CREAM_SAY[said]);
    text("cheerSub", "It does nothing at all for the stall. That's allowed.");
    $("cheer").hidden = false;
    burst("cheerBurst");
  }

  // "🚲 a bike" is one string in the level spec, because it reads as one thing
  // in a sentence. On the shelf it has to come apart.
  const prizeEmoji = (s) => s.split(" ")[0];
  const prizeName = (s) => s.replace(/^[^ ]+ /, "");

  function result(run, best) {
    const s = E.summary(run);
    const sp = E.spec(run.difficulty);
    // The best thing on the shelf you can actually walk out with. Not the top
    // prize — the one your money reaches.
    const gotIndex = s.rung - 1;
    const won = s.rung > 0;
    const label = won ? sp.rungs[gotIndex] : sp.rungs[0];
    const cost = won ? sp.goal[gotIndex] : sp.goal[0];

    payoff(run, s, sp, won, label, cost);
    LS.Chart.render($("chart"), run);

    const ladder = $("ladder");
    ladder.textContent = "";
    sp.goal.forEach((amount, i) => {
      const got = s.final >= amount;
      const bought = i === gotIndex;
      const d = document.createElement("div");
      d.className = "rung" + (got ? " got" : "") + (bought ? " bought" : "");
      d.innerHTML = '<span class="rung-emoji">' + prizeEmoji(sp.rungs[i]) + "</span>" +
        '<span class="rung-what">' + prizeName(sp.rungs[i]) +
        '<span class="rung-miss">' + (bought ? "you took this one home"
          : got ? "you could afford this one too"
          : E.money(amount - s.final) + " more and it was yours") +
        '</span></span><span class="rung-cost">' + E.money(amount) + "</span>" +
        '<span class="rung-tick">' + (got ? "✅" : "🔒") + "</span>";
      ladder.appendChild(d);
    });

    const grew = $("grewLine");
    show(grew, run.regulars > 0);
    if (run.regulars > 0) {
      grew.textContent = "😀 You started with nobody and finished with " + run.regulars +
        " regular" + (run.regulars === 1 ? "" : "s") +
        " — people who came to your stall every day.";
    }

    text("takeaway", E.takeaway(run));

    const st = $("stickers");
    st.textContent = "";
    const stickers = [];
    for (let i = 0; i < s.creams; i++) stickers.push("🍦");
    if (run.regulars >= 10) stickers.push("😀");
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

  return { show, text, header, purse, purseInto, goal, coach, toast, phase,
           morning, packs, prices, basket, hint, stepShow, stepHide,
           sellingScreen, sellStep, sellDone, dayDone, event,
           coinPad, changeAsk, changeTray, changeResult, changeHide,
           evening, beatStep, night, cheer,
           loansInto, shopInto, bankSheet, treatSheet, result };
})();
