/* Lemonade Stand — orchestration.                                              */
/*                                                                              */
/* Owns the phase machine, the save file, and the wiring between the buttons and */
/* economy.js. It decides WHEN things happen; economy.js decides WHAT they come  */
/* to, and ui.js decides how they look.                                          */
/*                                                                              */
/* The one thing worth reading twice is the selling timer. The day's result is   */
/* worked out in full the moment the stall opens, and the animation only walks   */
/* through it — so skipping, closing the tab, or a tablet locking mid-day cannot */
/* change a single cent. A generation counter makes a stale timer from an        */
/* abandoned day inert rather than letting it tick money into tomorrow.          */
"use strict";
(function () {
  const { Economy: E, Ui, Audio, Tutorial, Rng } = window.LS;
  const $ = (id) => document.getElementById(id);

  /* ── State ─────────────────────────────────────────────────────────────── */

  const state = {
    difficulty: "normal",
    hints: true,
    stepBy: true,        // walk the morning one decision at a time
    seenHowTo: false,
    best: { easy: 0, normal: 0, tricky: 0 },
    run: null,
    playing: false
  };

  // The saved run is a RECORD that save() refreshes, never something derived
  // from `state` at the moment of writing. Yatzy derives it, and the result is
  // that setMuted() at boot — which runs before any game exists — writes a save
  // with `game: null` and wipes the file. Mastermind's shape avoids that, so
  // this is Mastermind's shape.
  let savedRun = null;

  const SAVE_KEY = "lemonadeStandSave_v1";

  function save() {
    // Only a live run refreshes the record, and only from a phase that can
    // actually be brought back — snapshot() says which by refusing the rest.
    // A refusal keeps the record already on disk rather than blanking it: a
    // settings tap on the setup screen, or putting the tablet down between
    // banking the takings and tapping Next morning, must never throw away the
    // run sitting there waiting to be carried on.
    if (state.playing && state.run) {
      const snap = E.snapshot(state.run);
      if (snap) savedRun = snap;
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        difficulty: state.difficulty,
        muted: Audio.isMuted(),
        hints: state.hints,
        stepBy: state.stepBy,
        seenHowTo: state.seenHowTo,
        best: state.best,
        run: savedRun
      }));
    } catch (e) { /* private browsing can make localStorage throw */ }
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return; }
    if (!raw) return;
    let d = null;
    try { d = JSON.parse(raw); } catch (e) { return; }
    if (!d || typeof d !== "object") return;

    if (E.LEVELS[d.difficulty]) state.difficulty = d.difficulty;
    if (typeof d.hints === "boolean") state.hints = d.hints;
    if (typeof d.stepBy === "boolean") state.stepBy = d.stepBy;
    if (typeof d.seenHowTo === "boolean") state.seenHowTo = d.seenHowTo;
    Audio.setMuted(!!d.muted);
    if (d.best && typeof d.best === "object") {
      for (const k of ["easy", "normal", "tricky"]) {
        if (Number.isInteger(d.best[k]) && d.best[k] >= 0) state.best[k] = d.best[k];
      }
    }
    savedRun = d.run && E.restore(d.run) ? d.run : null;
  }

  const resumable = () => !!savedRun && !!E.restore(savedRun);

  /* ── Generic controls (copied from yatzy-dice/js/app.js) ───────────────── */

  function chooser(id, value, onPick) {
    const host = $(id);
    if (!host) return;
    setChooser(id, value);
    host.addEventListener("click", (ev) => {
      const b = ev.target.closest(".opt");
      if (!b || !host.contains(b)) return;
      setChooser(id, b.dataset.value);
      Audio.tap();
      onPick(b.dataset.value);
    });
  }

  function setChooser(id, value) {
    const host = $(id);
    if (!host) return;
    for (const b of host.querySelectorAll(".opt")) {
      b.classList.toggle("on", b.dataset.value === String(value));
    }
  }

  function setSwitch(id, on) {
    const b = $(id);
    if (b) b.setAttribute("aria-checked", on ? "true" : "false");
  }

  /* ── Setup screen ──────────────────────────────────────────────────────── */

  function levelNote() {
    const sp = E.spec(state.difficulty);
    const target = sp.goal[sp.goal.length - 1];
    const bits = [sp.days + " days", "save up " + E.money(target) + " for " +
      sp.rungs[sp.rungs.length - 1]];
    if (sp.forecast === 1) bits.push("the forecast is always right");
    else if (sp.forecast < 0.7) bits.push("prices jump about and the forecast often lies");
    else bits.push("the forecast is usually right");
    $("levelNote").textContent = bits.join(" · ") + ".";

    const best = state.best[state.difficulty];
    const line = $("setupBest");
    if (best > 0) {
      line.textContent = "🏅 Your best " + sp.days + "-day run: " + E.money(best);
      line.hidden = false;
    } else line.hidden = true;
  }

  function showSetup() {
    state.playing = false;
    document.body.classList.remove("in-game");
    $("game").hidden = true;
    $("setup").hidden = false;
    $("result").hidden = true;
    setChooser("levelChooser", state.difficulty);
    setSwitch("hintToggle", state.hints);
    setSwitch("stepToggle", state.stepBy);
    levelNote();
    $("resumeBtn").hidden = !resumable();
  }

  /* ── Starting and resuming ─────────────────────────────────────────────── */

  function startRun(run) {
    state.run = run;
    state.playing = true;
    $("setup").hidden = true;
    $("result").hidden = true;
    $("game").hidden = false;
    document.body.classList.add("in-game");
    enterPhase();
    save();
  }

  function newRun() {
    const run = E.newRun(state.difficulty, Rng.newSeed());
    E.startDay(run);
    startRun(run);
    Audio.morning();
  }

  function resume() {
    const run = E.restore(savedRun);
    if (!run) { showSetup(); return; }
    startRun(run);
  }

  // Draw whichever phase the run is actually in. One function, so a resumed run
  // and a live one take exactly the same path.
  function enterPhase() {
    const run = state.run;
    if (run.phase === "selling") {
      Ui.sellingScreen(run);
      runSelling();
    } else if (run.phase === "evening") {
      Ui.evening(run);
    } else {
      Ui.phase("morning");
      Ui.morning(run, state.hints);
      if (state.stepBy) openSteps(0); else closeSteps();
    }
  }

  /* ── Morning ───────────────────────────────────────────────────────────── */

  function redrawMorning() {
    Ui.morning(state.run, state.hints);
    if (stepOpen) drawStep();
    save();
  }

  function buy(index) {
    const got = E.buyPack(state.run, state.run.today, index);
    if (!got) { Ui.toast("You can't afford that."); return; }
    Audio.buy();
    // A trip to the bank is money leaving that the child did not ask to spend,
    // so it gets said out loud the moment it happens rather than only in the
    // evening sums.
    if (got.fee > 0) {
      Ui.toast("🏦 " + E.money(got.cost) + " for the lemons, and " + E.price(got.fee) +
        " for the trip to the bank.");
    }
    redrawMorning();
  }

  /* ── The morning, one decision at a time ───────────────────────────────── */

  // Everything on the morning screen used to be on screen at once: four
  // decisions and six facts competing for an eight-year-old's attention. Now
  // each one gets its own sheet, in the order you'd actually think about them —
  // what's the weather, how much shall I make, what shall I charge, ready? —
  // and the plan card behind keeps the answers visible once they're given.
  //
  // The weather deliberately gets its own step rather than sitting above the
  // buy buttons: reading it BEFORE committing money is the lesson, and folded
  // into the buying step it would just be decoration above a button.
  let stepList = [];
  let stepAt = 0;
  let stepOpen = false;
  // Opened from a plan row to change one thing, rather than walked through from
  // the top. Same sheet, same controls — it just closes again when you're done
  // instead of marching on to the next question.
  let stepSingle = false;

  function stepsFor(run) {
    const o = run.opening || {};
    const list = [];
    if (o.repay || o.gift) list.push("news");
    return list.concat(["weather", "buy", "price", "ready"]);
  }

  // One place that draws the open step, so every redraw carries the same things:
  // the purse, the tip for this question, and live handlers for the shelves the
  // buying step puts on screen.
  function drawStep() {
    Ui.stepShow(state.run, stepList[stepAt], stepAt, stepList.length, {
      single: stepSingle,
      hints: state.hints,
      onLoan: takeLoan,
      onTreat: buyTreat
    });
  }

  function openSteps(at, single) {
    const run = state.run;
    if (!run || run.phase !== "morning") return;
    stepList = stepsFor(run);
    stepAt = Math.max(0, Math.min(stepList.length - 1, at || 0));
    stepOpen = true;
    stepSingle = !!single;
    drawStep();
  }

  // Reopen one step to change your mind about it — what the plan rows do.
  function openStepNamed(name) {
    const list = stepsFor(state.run);
    const at = list.indexOf(name);
    if (at >= 0) { Audio.tap(); openSteps(at, true); }
  }

  function closeSteps() {
    stepOpen = false;
    stepSingle = false;
    Ui.stepHide();
  }

  function stepNext() {
    Audio.tap();
    if (stepSingle) { closeSteps(); redrawMorning(); return; }
    if (stepAt >= stepList.length - 1) {
      closeSteps();
      openStall();
      return;
    }
    stepAt++;
    drawStep();
  }

  function stepBack() {
    if (stepAt === 0 || stepSingle) return;
    Audio.tap();
    stepAt--;
    drawStep();
  }

  function openStall() {
    const run = state.run;
    closeSteps();
    if (run.cups === 0) {
      // A shut day is a legal day. It still has to reach the evening, or a child
      // who couldn't afford lemons would be stuck on the morning screen forever.
      E.openStall(run);
      Ui.sellingScreen(run);
      Ui.dayDone(run);
      Audio.bin();
      save();
      return;
    }
    E.openStall(run);
    Audio.pour();
    Ui.sellingScreen(run);
    save();
    runSelling();
  }

  /* ── The selling animation ─────────────────────────────────────────────── */

  // Bumped whenever a day is left behind. A timer whose generation no longer
  // matches quietly stops instead of paying out into the next day.
  let gen = 0;
  let sellTimer = null;
  let sellAt = { party: 0, served: 0, turned: 0 };
  let tray = [];

  const reduceMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The next customer still waiting to be paid their change, if any.
  function pendingMoment() {
    const r = state.run.result;
    if (!r || !r.moments) return null;
    return r.moments[state.run.changeAt] || null;
  }

  // One tick = one CUSTOMER, not one cup: a party of three is served in a
  // single step. `served` counts cups because that is what the money is made
  // of; `party` counts people because that is what the queue draws.
  function tickOnce() {
    const run = state.run;
    const r = run.result;
    const parties = r.parties || [];
    if (sellAt.party < parties.length) {
      const n = parties[sellAt.party];
      sellAt.party++;
      sellAt.served += n;
      Audio.coin();
      Ui.sellStep(run, sellAt.served, sellAt.turned, n);
    } else {
      sellAt.turned++;
      Ui.sellStep(run, sellAt.served, sellAt.turned, 1);
    }
  }

  const stepsLeft = () => {
    const r = state.run.result;
    return (r.parties || []).length + r.turned - (sellAt.party + sellAt.turned);
  };

  const stepMs = () => {
    const r = state.run.result;
    const total = Math.max(1, (r.parties || []).length + r.turned);
    // Six seconds for a busy day rather than four, and a floor high enough that
    // a quiet day isn't over before it has been seen. The faces were going past
    // faster than they could be read.
    return Math.max(110, Math.min(320, Math.round(6000 / total)));
  };

  function runSelling() {
    const run = state.run;
    const r = run.result;
    const mine = ++gen;
    clearInterval(sellTimer);
    Ui.changeHide();

    // The queue always replays from the start, including after a resume. The
    // model's changeAt is what remembers which sums were already answered, so
    // replaying the customers can't ask the same one twice.
    sellAt = { party: 0, served: 0, turned: 0 };
    tray = [];

    if (r.want <= 0) { endOfDay(mine); return; }
    if (reduceMotion()) { fastForward(mine); return; }
    startTicking(mine);
  }

  function startTicking(mine) {
    clearInterval(sellTimer);
    sellTimer = setInterval(() => {
      if (mine !== gen) { clearInterval(sellTimer); return; }
      tickOnce();
      // Somebody has just paid with a handful and is waiting. Stop the day.
      const m = pendingMoment();
      if (m && sellAt.party === m.at + 1) { clearInterval(sellTimer); askForChange(mine); return; }
      if (stepsLeft() <= 0) { clearInterval(sellTimer); endOfDay(mine); }
    }, stepMs());
  }

  // Jump straight to whatever needs a decision next: the next customer owed
  // change, or the end of the day. Skipping the animation is fine; skipping the
  // arithmetic is not, so this never steps past a change moment.
  function fastForward(mine) {
    const run = state.run;
    const r = run.result;
    const m = pendingMoment();
    const parties = r.parties || [];
    if (m) {
      sellAt.party = 0; sellAt.served = 0; sellAt.turned = 0;
      for (let i = 0; i <= m.at && i < parties.length; i++) {
        sellAt.party++; sellAt.served += parties[i];
      }
      Ui.sellStep(run, sellAt.served, sellAt.turned, parties[m.at] || 1);
      askForChange(mine);
      return;
    }
    sellAt.party = parties.length;
    sellAt.served = r.sold;
    sellAt.turned = r.turned;
    Ui.sellStep(run, sellAt.served, sellAt.turned, 1);
    endOfDay(mine);
  }

  function askForChange(mine) {
    if (mine !== gen) return;
    const run = state.run;
    tray = [];
    Ui.coinPad(addCoin);
    Ui.changeAsk(run, pendingMoment(), E.spec(run.difficulty).showTotal);
    Audio.pick();
    save();
  }

  function addCoin(cents) {
    if (!pendingMoment()) return;
    tray.push(cents);
    Audio.coin();
    Ui.changeTray(state.run, tray, E.spec(state.run.difficulty).showTotal);
  }

  function clearTray() {
    tray = [];
    Audio.tap();
    Ui.changeTray(state.run, tray, E.spec(state.run.difficulty).showTotal);
  }

  function giveChange() {
    const run = state.run;
    const moment = pendingMoment();
    if (!moment) return;
    const given = tray.reduce((a, b) => a + b, 0);
    const out = E.giveChange(run, given);
    if (!out) return;
    Ui.changeResult(run, out, moment);
    if (out.ok) Audio.ding(); else Audio.owe();
    save();
  }

  function afterChange() {
    const mine = gen;
    tray = [];
    Ui.changeHide();
    Audio.tap();
    if (stepsLeft() <= 0) { endOfDay(mine); return; }
    if (reduceMotion()) { fastForward(mine); return; }
    startTicking(mine);
  }

  function endOfDay(mine) {
    if (mine !== undefined && mine !== gen) return;
    clearInterval(sellTimer);
    const run = state.run;
    if (run.phase !== "selling") return;
    Ui.changeHide();
    Ui.sellDone(run);
    Ui.dayDone(run);
    Audio.till();
    save();
  }

  function countUp() {
    const run = state.run;
    if (!run || run.phase !== "selling") return;
    Audio.tap();
    E.closeDay(run);
    Ui.evening(run);
    save();
  }

  function skipSelling() {
    clearInterval(sellTimer);
    fastForward(gen);
  }

  /* ── Evening and night ─────────────────────────────────────────────────── */

  function bankIt(choice) {
    const run = state.run;
    if (run.phase !== "evening") return;
    const moved = E.bankChoice(run, choice);
    const before = E.rungReached(E.wealth(run), E.spec(run.difficulty).goal);
    const res = E.night(run);

    if (moved > 0) Audio.till();
    if (res.interest.paid > 0) setTimeout(() => Audio.ding(), 260);
    if (res.loan) setTimeout(() => Audio.owe(), 620);

    Ui.night(run, res);
    const after = E.rungReached(E.wealth(run), E.spec(run.difficulty).goal);
    if (after > before) {
      const sp = E.spec(run.difficulty);
      Ui.toast("🎉 " + sp.rungs[after - 1] + " — you could buy that now!");
      setTimeout(() => Audio.goal(), 400);
    }
    save();
  }

  function nextMorning() {
    const run = state.run;
    gen++; // nothing from yesterday may fire into today
    if (E.nextDay(run)) {
      Ui.phase("morning");
      Ui.morning(run, state.hints);
      if (state.stepBy) openSteps(0); else closeSteps();
      Audio.morning();
      save();
    } else {
      finishRun();
    }
  }

  function finishRun() {
    const run = state.run;
    const s = E.summary(run);
    if (s.final > state.best[run.difficulty]) state.best[run.difficulty] = s.final;
    savedRun = null;               // a finished run is not something to carry on
    state.playing = false;
    save();
    // On screen first, then drawn: the prize landing on the counter is a CSS
    // animation, and an animation on a display:none element plays to nobody.
    $("result").hidden = false;
    Ui.result(run, state.best[run.difficulty]);
    // Timed to land with the total finishing its count-up, not with the sheet
    // appearing. Anything you can walk out with is worth the fanfare, not only
    // the top of the shelf.
    setTimeout(() => (s.rung > 0 ? Audio.win() : Audio.till()), 850);
  }

  /* ── Sheets ────────────────────────────────────────────────────────────── */

  // Borrowing and buying happen in two places now — inline on the buying screen,
  // where the money is actually short, and in the sheets the morning screen
  // opens. One function each, handed to whichever is drawing, so the two places
  // can never end up behaving differently.

  function takeLoan(id) {
    const took = E.takeLoan(state.run, id);
    if (!took) return;
    Audio.owe();
    Ui.toast("You borrowed " + E.money(took.borrow) + ". Pay back " +
      E.money(took.repay) + " on day " + took.due + ".");
    $("loanSheet").hidden = true;
    redrawMorning();   // redraws the open step too, so the packs light up
  }

  function buyTreat(id) {
    const bought = E.buyTreat(state.run, id);
    if (!bought) { Ui.toast("You can't afford that."); return; }

    // The ice cream is the one purchase with no argument behind it, so it gets
    // the moment instead of the receipt. Everything else keeps its quiet toast:
    // a sign and a bucket are decisions, and decisions get told what they cost.
    if (id === "cream") {
      Audio.yum();
      Ui.cheer(state.run, bought);
    } else {
      Audio.treat();
      Ui.toast(bought.emoji + " " + bought.name + " — " + E.money(bought.cost) +
        (bought.fee > 0 ? ", plus " + E.price(bought.fee) + " for the trip to the bank" : ""));
    }

    if (!$("treatSheet").hidden) openShop();  // the sheet, if that's where we are
    redrawMorning();                          // ...and the morning behind it
  }

  function openBank() {
    Ui.bankSheet(state.run, takeLoan);
    $("loanSheet").hidden = false;
  }

  function openShop() {
    Ui.treatSheet(state.run, buyTreat);
    $("treatSheet").hidden = false;
  }

  /* ── Wiring ────────────────────────────────────────────────────────────── */

  function wire() {
    chooser("levelChooser", state.difficulty, (v) => {
      state.difficulty = v;
      levelNote();
      save();
    });

    $("hintToggle").addEventListener("click", () => {
      state.hints = !state.hints;
      setSwitch("hintToggle", state.hints);
      Audio.tap();
      if (state.playing && state.run.phase === "morning") Ui.morning(state.run, state.hints);
      save();
    });

    $("startBtn").addEventListener("click", () => {
      Audio.tap();
      if (!state.seenHowTo) {
        state.seenHowTo = true;
        save();
        Tutorial.open(state.difficulty, newRun);
      } else newRun();
    });

    $("resumeBtn").addEventListener("click", () => { Audio.tap(); resume(); });
    $("howtoBtn").addEventListener("click", () => {
      Audio.tap();
      state.seenHowTo = true;
      save();
      Tutorial.open(state.difficulty, null);
    });

    $("buySmall").addEventListener("click", () => buy(0));
    $("buyBig").addEventListener("click", () => buy(1));

    $("priceChooser").addEventListener("click", (ev) => {
      const b = ev.target.closest(".price-opt");
      if (!b) return;
      E.setPrice(state.run, Number(b.dataset.value));
      Audio.pick();
      redrawMorning();
    });

    $("loanBtn").addEventListener("click", () => { Audio.tap(); openBank(); });
    $("treatBtn").addEventListener("click", () => { Audio.tap(); openShop(); });
    $("loanClose").addEventListener("click", () => { Audio.tap(); $("loanSheet").hidden = true; });
    $("treatClose").addEventListener("click", () => { Audio.tap(); $("treatSheet").hidden = true; });
    // Straight from "I can't afford this" to the money. One tap, one sheet.
    $("treatBorrow").addEventListener("click", () => {
      Audio.tap();
      $("treatSheet").hidden = true;
      openBank();
    });

    $("stepNext").addEventListener("click", stepNext);
    $("stepBack").addEventListener("click", stepBack);
    $("planWeather").addEventListener("click", () => openStepNamed("weather"));
    $("planStock").addEventListener("click", () => openStepNamed("buy"));
    $("planPrice").addEventListener("click", () => openStepNamed("price"));

    $("stepToggle").addEventListener("click", () => {
      state.stepBy = !state.stepBy;
      setSwitch("stepToggle", state.stepBy);
      Audio.tap();
      save();
    });

    $("openBtn").addEventListener("click", () => { Audio.tap(); openStall(); });
    $("skipBtn").addEventListener("click", () => { Audio.tap(); skipSelling(); });
    $("countUpBtn").addEventListener("click", countUp);

    $("changeClear").addEventListener("click", clearTray);
    $("changeGive").addEventListener("click", giveChange);
    $("changeNext").addEventListener("click", afterChange);

    $("bankNone").addEventListener("click", () => bankIt("none"));
    $("bankHalf").addEventListener("click", () => bankIt("half"));
    $("bankFloat").addEventListener("click", () => bankIt("float"));
    $("bankAll").addEventListener("click", () => bankIt("all"));
    $("eveNext").addEventListener("click", () => { Audio.tap(); Ui.beatStep(1); });
    $("eveBack").addEventListener("click", () => { Audio.tap(); Ui.beatStep(-1); });
    $("nextBtn").addEventListener("click", () => { Audio.tap(); nextMorning(); });

    // Every bank chip opens the bank — the one in the topbar and the copies the
    // sheets draw for themselves. Delegated, because those copies are rewritten
    // on every redraw and a listener bound to one of them wouldn't survive it.
    // The money is on the chip; the story behind the money is one tap further in.
    document.addEventListener("click", (ev) => {
      const chip = ev.target.closest && ev.target.closest(".purse-part.tappable");
      if (!chip || !state.playing || !state.run) return;
      if (!$("loanSheet").hidden) return;   // already looking at it
      Audio.tap();
      // The shop gets out of the way first, the same as its Borrow button does.
      $("treatSheet").hidden = true;
      openBank();
    });

    $("cheerClose").addEventListener("click", () => { Audio.tap(); $("cheer").hidden = true; });
    $("cheer").addEventListener("click", (ev) => {
      // Tap anywhere. A child holding a tablet does not aim for the button.
      if (ev.target.id === "cheerClose") return;
      $("cheer").hidden = true;
    });

    $("menuBtn").addEventListener("click", () => { Audio.tap(); $("menu").hidden = false; });
    $("menuResume").addEventListener("click", () => { Audio.tap(); $("menu").hidden = true; });
    $("menuHowto").addEventListener("click", () => {
      Audio.tap();
      $("menu").hidden = true;
      Tutorial.open(state.difficulty, null);
    });
    $("menuQuit").addEventListener("click", () => {
      Audio.tap();
      gen++;
      clearInterval(sellTimer);
      $("menu").hidden = true;
      showSetup();
    });

    $("muteBtn").addEventListener("click", () => {
      Audio.setMuted(!Audio.isMuted());
      const m = Audio.isMuted();
      $("muteBtn").textContent = m ? "🔇" : "🔊";
      $("muteBtn").setAttribute("aria-pressed", m ? "true" : "false");
      if (!m) Audio.tap();
      save();
    });

    $("howtoNext").addEventListener("click", () => Tutorial.next());
    $("howtoBack").addEventListener("click", () => Tutorial.back());
    $("howtoSkip").addEventListener("click", () => { Audio.tap(); Tutorial.close(); });

    $("againBtn").addEventListener("click", () => { Audio.tap(); newRun(); });
    $("resultMenu").addEventListener("click", () => { Audio.tap(); showSetup(); });

    // A tablet going to sleep mid-day must not leave a timer running. If somebody
    // is standing there waiting for their change, though, leave them waiting —
    // fast-forwarding past a sum the child hasn't answered would hand them the
    // money for free.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden || !state.playing || !state.run) return;
      if (state.run.phase !== "selling") return;
      if ($("changePanel").getClientRects().length) { clearInterval(sellTimer); return; }
      skipSelling();
    });
  }

  /* ── Boot-time sanity check ────────────────────────────────────────────── */

  // Cheap, and it has caught real things: it plays three days through the real
  // economy and insists the money comes out whole. If this ever trips, the page
  // still works — it just says so in the console rather than paying a child in
  // fractions of a cent.
  function sanity() {
    try {
      const run = E.newRun("normal", 12345);
      E.startDay(run);
      for (let i = 0; i < 3; i++) {
        E.buyPack(run, run.today, 1);
        E.setPrice(run, 75);
        E.openStall(run);
        E.closeDay(run);
        E.bankChoice(run, "all");
        E.night(run);
        E.nextDay(run);
      }
      const bad = run.ledger.some((r) =>
        !Number.isInteger(r.pocket) || !Number.isInteger(r.bank) ||
        r.pocket % 5 !== 0 || r.bank % 5 !== 0 || r.pocket < 0 || r.bank < 0);
      if (bad) console.warn("Lemonade Stand: the money model produced a value that isn't whole cents.");

      // The trip to the bank, which is the newest way for money to move and so
      // the likeliest to be wrong: empty the purse, buy something out of the
      // bank, and insist the fee came off exactly once.
      const t = E.newRun("normal", 999);
      E.startDay(t);
      t.bank = t.pocket; t.pocket = 0;
      const before = t.bank;
      const first = E.buyPack(t, t.today, 0);
      const second = E.affordable(t) >= E.packPrice(t.today.unit, E.PACKS[0])
        ? E.buyPack(t, t.today, 0) : null;
      if (first && first.fee !== E.WITHDRAW_FEE) {
        console.warn("Lemonade Stand: the first trip to the bank didn't charge for itself.");
      }
      if (second && second.fee !== 0) {
        console.warn("Lemonade Stand: the bank charged twice for one day's trip.");
      }
      const spent = first ? first.cost + (second ? second.cost : 0) + E.WITHDRAW_FEE : 0;
      if (first && t.pocket + t.bank !== before - spent) {
        console.warn("Lemonade Stand: money went missing on the way to the bank.");
      }
      const missing = ["morning", "selling", "evening", "goalFill", "priceChooser", "chart",
        "beatDay", "beatWhy", "beatRegulars", "beatBank", "beatNight", "cheer", "bankBook"]
        .filter((id) => !document.getElementById(id));
      if (missing.length) console.warn("Lemonade Stand: markup is missing " + missing.join(", "));
    } catch (e) {
      console.warn("Lemonade Stand: sanity check threw", e);
    }
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */

  load();
  wire();
  $("muteBtn").textContent = Audio.isMuted() ? "🔇" : "🔊";
  $("muteBtn").setAttribute("aria-pressed", Audio.isMuted() ? "true" : "false");
  showSetup();
  sanity();

  // Debug hooks for the browser checks — measuring beats reading.
  window.LS.debug = {
    state: () => state,
    run: () => state.run,
    summary: () => (state.run ? E.summary(state.run) : null)
  };

  addEventListener("load", () => navigator.serviceWorker.register("../sw.js").catch(() => {}));
})();
