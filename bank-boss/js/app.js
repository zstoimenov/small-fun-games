/* Bank Boss — orchestration.                                                   */
/*                                                                              */
/* Owns the phase machine, the save file, and the wiring between the buttons and */
/* bank.js. It decides WHEN things happen; bank.js decides WHAT they come to,    */
/* and ui.js decides how they look.                                             */
/*                                                                              */
/* The one thing worth reading twice is the counter. Every customer is TWO       */
/* beats — who walked in and what they want, then which counter they chose and   */
/* what happened there — and the model is not asked to resolve anything until    */
/* the second beat. Deal or No Deal had to learn this the expensive way: if the  */
/* answer is already in the state when the question appears on screen, there is  */
/* no moment for the suspense to live in and no amount of delay creates one.     */
"use strict";
(function () {
  const { Bank: K, Ui, Audio, Tutorial, Rng, Rival } = window.BB;
  const $ = (id) => document.getElementById(id);

  /* ── State ─────────────────────────────────────────────────────────────── */

  const state = {
    mode: "solo",
    robot: "medium",
    difficulty: "normal",
    seenHowTo: false,
    best: { easy: 0, normal: 0, tricky: 0 },
    run: null,
    playing: false
  };

  // The saved run is a RECORD that save() refreshes, never something derived
  // from `state` at the moment of writing — Mastermind's shape, for Mastermind's
  // reason: boot calls setMuted() before any run exists, and a derived save
  // would write `run: null` straight over the file.
  let savedRun = null;
  const SAVE_KEY = "bankBossSave_v1";

  function save() {
    if (state.playing && state.run) {
      const snap = K.snapshot(state.run);
      if (snap) savedRun = snap;
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        mode: state.mode, robot: state.robot, difficulty: state.difficulty,
        muted: Audio.isMuted(), seenHowTo: state.seenHowTo, best: state.best, run: savedRun
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
    if (d.mode === "solo" || d.mode === "duo") state.mode = d.mode;
    if (["easy", "medium", "hard"].indexOf(d.robot) >= 0) state.robot = d.robot;
    if (K.LEVELS[d.difficulty]) state.difficulty = d.difficulty;
    if (typeof d.seenHowTo === "boolean") state.seenHowTo = d.seenHowTo;
    Audio.setMuted(!!d.muted);
    if (d.best && typeof d.best === "object") {
      for (const k of ["easy", "normal", "tricky"]) {
        if (Number.isInteger(d.best[k]) && d.best[k] >= 0) state.best[k] = d.best[k];
      }
    }
    savedRun = d.run && K.restore(d.run) ? d.run : null;
  }

  const resumable = () => !!savedRun && !!K.restore(savedRun);

  /* ── Generic controls (Connect Four's, via Lemonade Stand) ─────────────── */

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

  /* ── Setup ─────────────────────────────────────────────────────────────── */

  function setupNotes() {
    const sp = K.spec(state.difficulty);
    const top = sp.goal[sp.goal.length - 1];
    $("modeNote").textContent = state.mode === "duo"
      ? "Two banks on one street, sharing one town. You each pick your rates in secret, " +
        "then find out who the customers walk up to."
      : "You against Robo Bank, across the street. Every customer picks one of you.";
    $("robotNote").textContent = {
      easy: "Pays savers as little as it can, charges borrowers as much as it can, and lends " +
        "to anybody who asks. It does not end well for them.",
      medium: "Fair rates, and it knows better than to lend to a one-star borrower.",
      hard: "Fair rates, refuses the risky, always keeps its quarter back — and turns away " +
        "money it has nothing to do with."
    }[state.robot];
    $("robotRow").hidden = state.mode === "duo";
    $("robotNote").hidden = state.mode === "duo";
    $("levelNote").textContent = sp.days + " days · grow " + K.money(K.START_OWN) + " into " +
      K.money(top) + " for " + sp.rungs[sp.rungs.length - 1].replace(/^\S+\s/, "") +
      (sp.showStars ? " · everyone's stars are on show"
        : " · you only see somebody's stars once you've dealt with them");

    const best = state.best[state.difficulty];
    const line = $("setupBest");
    if (best > 0) {
      line.textContent = "🏅 Your best " + sp.days + "-day bank: " + K.money(best);
      line.hidden = false;
    } else line.hidden = true;
  }

  function showSetup() {
    state.playing = false;
    document.body.classList.remove("in-game");
    $("game").hidden = true;
    $("setup").hidden = false;
    $("result").hidden = true;
    $("handover").hidden = true;
    setChooser("modeChooser", state.mode);
    setChooser("robotChooser", state.robot);
    setChooser("levelChooser", state.difficulty);
    setupNotes();
    $("resumeBtn").hidden = !resumable();
  }

  /* ── Starting ──────────────────────────────────────────────────────────── */

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
    const run = K.newRun(state.difficulty, Rng.newSeed(), state.mode);
    run.robotLevel = state.robot;
    K.startDay(run);
    startRun(run);
    Audio.morning();
  }

  function resume() {
    const run = K.restore(savedRun);
    if (!run) { showSetup(); return; }
    startRun(run);
  }

  // Draw whichever phase the run is actually in, so a resumed run and a live one
  // take exactly the same path.
  function enterPhase() {
    const run = state.run;
    if (run.phase === "counter") { Ui.phase("counter"); nextCustomer(); }
    else if (run.phase === "night" || run.phase === "evening") { doNight(); }
    else { openMorning(); }
  }

  /* ── The morning ───────────────────────────────────────────────────────── */

  // Which human seat is setting its rates. Always 0 in solo; in two-player it
  // walks 0 then 1, with the pass-the-tablet screen in between, because the
  // rates are the only secret this game has.
  let rateSeat = 0;

  function openMorning() {
    const run = state.run;
    run.phase = "rates";
    rateSeat = 0;
    Ui.phase("rates");
    drawMorning();
  }

  function drawMorning() {
    const run = state.run;
    Ui.rates(run, rateSeat, { hints: true, tip: morningTip(run, rateSeat) });
    $("openBtn").textContent = run.mode === "duo" && rateSeat === 0
      ? "Done — pass it on" : "Open the doors";
  }

  // A tip about THIS morning, from what the books actually say. Never a
  // general-purpose hint: the two dials are the only decision on this screen, so
  // a tip that isn't about them is decoration.
  function morningTip(run, seat) {
    const bank = run.banks[seat];
    const spare = K.spare(bank);
    if (bank.deposits <= 0) {
      return "Nobody much has money with you yet. Paying savers a bit more is how you get " +
        "some coins to lend.";
    }
    if (spare > 8000) {
      return K.money(spare) + " is sitting in your vault doing nothing, and you're paying " +
        bank.saveRate + "c a night for it. Either lend more of it out today, or stop buying " +
        "money you can't use.";
    }
    if (spare < 0) {
      return "You're below the keep-back line. Go easy on the lending today — if somebody " +
        "wants their money back you'll have to call your loans in.";
    }
    if (bank.fires > 0) {
      return "You've had to call loans in " + bank.fires + (bank.fires === 1 ? " time" : " times") +
        " so far. That's the dearest thing in the game — keep a quarter back.";
    }
    return null;
  }

  function morningDone() {
    const run = state.run;
    Audio.tap();
    if (run.mode === "duo" && rateSeat === 0) {
      handover(run.banks[1].name, () => { rateSeat = 1; drawMorning(); });
      return;
    }
    Rival.takeMorning(run);
    K.openCounter(run);
    Ui.phase("counter");
    Audio.vault();
    save();
    nextCustomer();
  }

  function handover(who, then) {
    $("handTitle").textContent = "Pass it to " + who;
    $("handSub").textContent = "Don't peek at what the other bank chose.";
    $("handGo").textContent = "I'm " + who;
    $("handover").hidden = false;
    handover.then = then;
  }

  /* ── The counter ───────────────────────────────────────────────────────── */

  let askTimer = null;
  let seenCustomer = null;

  const reduceMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const seatFor = (run) => (run.mode === "duo" ? -1 : 0);

  function nextCustomer() {
    clearTimeout(askTimer);
    const run = state.run;
    const c = K.current(run);
    if (!c) { doNight(); return; }

    // Somebody who has just been turned down and is walking across the street
    // does not get introduced again — they get resolved at the other counter.
    if (c === seenCustomer && c.stage === 1) { resolveCustomer(); return; }

    seenCustomer = c;
    Ui.vault(run, 0);
    Ui.topbar(run);
    Ui.personAsk(run, c);
    Audio.step();
    if (reduceMotion() || window.BB.debug.instant) resolveCustomer();
    else askTimer = setTimeout(resolveCustomer, 900);
  }

  function resolveCustomer() {
    clearTimeout(askTimer);
    const run = state.run;
    if (run.phase !== "counter") return;
    const out = K.serve(run);
    if (!out) { doNight(); return; }
    render(out);
  }

  function answer(choice) {
    const run = state.run;
    const out = K.serve(run, choice);
    if (!out) { doNight(); return; }
    if (choice === "lend") Audio.lend();
    else if (choice === "take") Audio.take();
    else Audio.no();
    render(out);
    save();
  }

  function render(out) {
    const run = state.run;
    Ui.personResolve(run, out, { seat: seatFor(run) });
    Ui.queueStrip(run);
    Ui.goal(run);
    if (out.fire) Audio.fire();
    else if (out.took) Audio.take();
    else if (out.lent) Audio.lend();
    if (run.phase === "night") save();
  }

  /* ── Night ─────────────────────────────────────────────────────────────── */

  // Which bank's night is on screen. Solo shows yours and nobody else's; two
  // players each get their own, with a handover in between.
  let nightSeat = 0;
  let report = null;

  function doNight() {
    const run = state.run;
    if (run.phase !== "evening") {
      run.phase = "night";
      report = K.night(run);
      Audio.vault();
      const paid = report.banks[0].interestIn > 0;
      if (paid) setTimeout(() => Audio.back(), 300);
      if (report.banks[0].bad.length) setTimeout(() => Audio.bad(), 620);
    } else if (!report) {
      // Resumed straight into the evening: the night has already been worked
      // out, so rebuild the report's shape rather than running it again, which
      // would pay every loan twice.
      report = { day: run.day, banks: run.banks.map(emptyReport) };
    }
    nightSeat = 0;
    showNight();
    save();
  }

  // A night that has already happened, seen from the books. Only ever used by a
  // resume, and it says so on screen rather than pretending it saw it happen.
  function emptyReport(bank) {
    return { name: bank.name, interestOut: bank.today ? bank.today.interestOut : 0,
      interestIn: bank.today ? bank.today.interestIn : 0, back: [], bad: [], matured: [],
      fire: null, trustBefore: bank.trust, trustAfter: bank.trust, missed: 0 };
  }

  function showNight() {
    const run = state.run;
    Ui.night(run, report, nightSeat);
    const more = run.mode === "duo" && nightSeat === 0;
    $("nextDayBtn").textContent = more ? "Pass to " + run.banks[1].name : "Next morning";
  }

  function afterNight() {
    const run = state.run;
    Audio.tap();
    if (run.mode === "duo" && nightSeat === 0) {
      handover(run.banks[1].name, () => { nightSeat = 1; showNight(); });
      return;
    }
    const before = K.rungReached(run.banks[0].own, K.spec(run.difficulty).goal);
    report = null;
    if (K.nextDay(run)) {
      openMorning();
      Audio.morning();
      const after = K.rungReached(run.banks[0].own, K.spec(run.difficulty).goal);
      if (after > before) {
        const sp = K.spec(run.difficulty);
        Ui.toast("🎉 " + sp.rungs[after - 1] + " — your bank grew!");
        setTimeout(() => Audio.goal(), 400);
      }
      save();
    } else {
      finish();
    }
  }

  function finish() {
    const run = state.run;
    const s = K.summary(run);
    if (s.own > state.best[run.difficulty]) state.best[run.difficulty] = s.own;
    savedRun = null;               // a finished run is not something to carry on
    state.playing = false;
    save();
    // On screen first, then drawn: the trophy landing is a CSS animation, and an
    // animation on a display:none element plays to nobody.
    $("result").hidden = false;
    Ui.result(run, state.best[run.difficulty]);
    setTimeout(() => (s.rung > 0 ? Audio.win() : Audio.bad()), 800);
  }

  /* ── Wiring ────────────────────────────────────────────────────────────── */

  function wire() {
    chooser("modeChooser", state.mode, (v) => { state.mode = v; setupNotes(); save(); });
    chooser("robotChooser", state.robot, (v) => { state.robot = v; setupNotes(); save(); });
    chooser("levelChooser", state.difficulty, (v) => { state.difficulty = v; setupNotes(); save(); });

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

    // The two dials. Delegated, because the tiles are rebuilt on every redraw.
    $("saveChooser").addEventListener("click", (ev) => {
      const b = ev.target.closest(".opt");
      if (!b) return;
      K.setRates(state.run, rateSeat, Number(b.dataset.value), state.run.banks[rateSeat].loanRate);
      Audio.pick();
      drawMorning();
      save();
    });
    $("loanChooser").addEventListener("click", (ev) => {
      const b = ev.target.closest(".opt");
      if (!b) return;
      K.setRates(state.run, rateSeat, state.run.banks[rateSeat].saveRate, Number(b.dataset.value));
      Audio.pick();
      drawMorning();
      save();
    });

    $("openBtn").addEventListener("click", morningDone);
    $("sayYes").addEventListener("click", () => {
      answer(K.current(state.run).kind === "save" ? "take" : "lend");
    });
    $("sayNo").addEventListener("click", () => answer("no"));
    $("cardNext").addEventListener("click", () => { Audio.tap(); nextCustomer(); });

    $("nightNext").addEventListener("click", () => { Audio.tap(); Ui.beatStep(1); });
    $("nightBack").addEventListener("click", () => { Audio.tap(); Ui.beatStep(-1); });
    $("nextDayBtn").addEventListener("click", afterNight);

    $("handGo").addEventListener("click", () => {
      Audio.tap();
      $("handover").hidden = true;
      const then = handover.then;
      handover.then = null;
      if (then) then();
    });

    $("menuBtn").addEventListener("click", () => { Audio.tap(); $("menu").hidden = false; });
    $("menuResume").addEventListener("click", () => { Audio.tap(); $("menu").hidden = true; });
    $("menuHowto").addEventListener("click", () => {
      Audio.tap();
      $("menu").hidden = true;
      Tutorial.open(state.difficulty, null);
    });
    $("menuBook").addEventListener("click", () => {
      Audio.tap();
      $("menu").hidden = true;
      Ui.books(state.run, state.run.mode === "duo" ? Math.max(0, rateSeat) : 0);
      $("book").hidden = false;
    });
    $("bookClose").addEventListener("click", () => { Audio.tap(); $("book").hidden = true; });
    $("menuQuit").addEventListener("click", () => {
      Audio.tap();
      clearTimeout(askTimer);
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

    // A tablet going to sleep mid-beat must not leave a timer running that fires
    // into a run the child has walked away from.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearTimeout(askTimer);
    });
  }

  /* ── Boot-time sanity check ────────────────────────────────────────────── */

  // Cheap, and it checks the one thing that must never be wrong: it plays three
  // days through the real model and insists the books balance after every one.
  // If this trips the page still works — it just says so in the console rather
  // than drawing a vault that does not add up.
  function sanity() {
    try {
      const run = K.newRun("normal", 12345, "solo");
      run.robotLevel = "medium";
      K.startDay(run);
      for (let d = 0; d < 3; d++) {
        K.setRates(run, 0, 2, 8);
        Rival.takeMorning(run);
        K.openCounter(run);
        let guard = 0;
        for (;;) {
          const c = K.current(run);
          if (!c || ++guard > 200) break;
          let out = K.serve(run);
          while (out && out.asking) {
            out = K.serve(run, out.kind === "save" ? "take" : (out.canPay ? "lend" : "no"));
          }
          for (const bank of run.banks) {
            const bad = K.check(bank);
            if (bad) { console.warn("Bank Boss: the books don't balance — " + bad); return; }
          }
        }
        K.night(run);
        K.nextDay(run);
      }
      const missing = ["vault", "barFrom", "barWhere", "keepLine", "rates", "counter",
        "night", "saveChooser", "loanChooser", "personCard", "ladder", "chart"]
        .filter((id) => !document.getElementById(id));
      if (missing.length) console.warn("Bank Boss: markup is missing " + missing.join(", "));
    } catch (e) {
      console.warn("Bank Boss: sanity check threw", e);
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
  window.BB.debug = {
    instant: false,
    state: () => state,
    run: () => state.run,
    summary: () => (state.run ? K.summary(state.run) : null),
    check: () => (state.run ? state.run.banks.map((b) => K.check(b)) : null),
    // Skip the reveal delay so a driver can walk a whole run in a few seconds.
    fast: () => { window.BB.debug.instant = true; },
    resolve: () => resolveCustomer(),
    answer: (c) => answer(c)
  };

  addEventListener("load", () => navigator.serviceWorker.register("../sw.js").catch(() => {}));
})();
