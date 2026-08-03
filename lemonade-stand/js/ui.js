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
    text("dayMeta", "of " + sp.days + (run.today && run.today.parade ? " · a parade is on!" : ""));
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
      let html = "";
      if (o.repay) {
        const r = o.repay;
        if (r.written > 0) {
          html += "<b>💳 The bank came for its money.</b>It took the " + E.money(r.repaid) +
            " you had and let you off the last " + E.money(r.written) +
            ". Borrowing is a promise — that one hurt.";
        } else {
          html += "<b>💳 You paid back your loan.</b>You borrowed " + E.money(r.borrowed) +
            " and paid back " + E.money(r.repay) + ". Borrowing cost you " + E.money(r.cost) + ".";
        }
      }
      if (o.gift) {
        html += (html ? "<br><br>" : "") + "<b>👵 Grandma popped by.</b>She left you " +
          E.money(o.gift) + " so you can keep going. Don't waste it.";
      }
      card.innerHTML = html;
      card.className = "card news" + (o.repay && o.repay.written > 0 ? " bad" : "");
      show(card, true);
    } else {
      show(card, false);
    }

    text("forecastEmoji", E.WEATHER[info.forecast].emoji);
    text("forecastName", E.WEATHER[info.forecast].name);
    text("forecastNote", info.sure
      ? "Today's weather, and it's always right on this setting."
      : "That's the forecast. It's usually right — but not always.");

    text("unitPrice", E.price(info.unit));
    const v = unitVerdict(info.unit);
    $("unitVerdict").textContent = v.s;
    $("unitVerdict").className = "verdict " + v.c;

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

  function basket(run) {
    const b = $("basket");
    if (run.cups === 0) {
      b.textContent = "Nothing bought yet.";
      return;
    }
    const carried = run.cups - run.boughtToday;
    b.textContent = "🥤 " + run.cups + " cups ready" +
      (run.boughtToday ? " · spent " + E.money(run.spentToday) : "") +
      (carried > 0 ? " · " + carried + " kept from yesterday" : "");
  }

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
    text("stallSun", E.WEATHER[run.today.weather].emoji);
    $("stallSign").innerHTML = "🍋 LEMONADE <span>" + E.price(run.price) + "</span>";
    $("queue").textContent = "";
    text("cupsLeft", String(run.cups));
    text("tillTotal", E.money(0));
    show($("turnedLine"), false);
    text("turnedCount", "0");
  }

  function sellStep(run, servedSoFar, turnedSoFar) {
    const q = $("queue");
    const person = document.createElement("span");
    person.className = "customer" + (turnedSoFar > 0 && servedSoFar >= run.result.sold ? " thirsty" : "");
    person.textContent = turnedSoFar > 0 && servedSoFar >= run.result.sold ? "😕" : "🙂";
    q.appendChild(person);
    // A day is at most forty-odd people; past three rows it stops reading as a
    // queue and starts reading as noise, so the oldest walk off.
    while (q.children.length > 24) q.removeChild(q.firstChild);

    text("cupsLeft", String(Math.max(0, run.cups - servedSoFar)));
    text("tillTotal", E.money(servedSoFar * run.price));
    if (turnedSoFar > 0) {
      show($("turnedLine"), true);
      text("turnedCount", String(turnedSoFar));
    }
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

    const profit = r.earned - run.spentToday;
    text("sumSpent", E.money(run.spentToday));
    text("sumEarned", E.money(r.earned));
    text("sumProfit", E.money(Math.abs(profit)));
    text("sumTotalLabel", profit < 0 ? "So you lost" : "So you made");
    $("sumTotalLine").classList.toggle("loss", profit < 0);

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

  // The overnight card: what the bank paid you, and what any loan is costing.
  function night(run, res) {
    const card = $("nightCard");
    show(card, true);
    const line = $("interestLine");
    if (res.interest.paid > 0) {
      // price() rather than money(): "45c" is how a child says it, "$0.45" isn't.
      line.textContent = "🏦 The bank paid you " + E.price(res.interest.paid) +
        " while you slept — " + res.interest.rate + "c for every dollar you left with it.";
    } else if (run.bank > 0) {
      line.textContent = "🏦 Not quite enough in the bank to earn a whole 5c tonight.";
    } else {
      line.textContent = "🏦 Nothing in the bank, so the bank paid you nothing.";
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
           morning, packs, prices, basket, hint,
           sellingScreen, sellStep, sellDone,
           evening, night, bankSheet, treatSheet, result };
})();
