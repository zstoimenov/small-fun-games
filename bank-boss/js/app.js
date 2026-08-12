/* Bank Boss — orchestration.                                                   */
/*                                                                              */
/* Owns the phase machine, the save file, and the wiring between the buttons and */
/* bank.js. It decides WHEN things happen; bank.js decides WHAT they come to,    */
/* and ui.js decides how they look.                                             */
/*                                                                              */
/* The counter is ONE beat per customer now. The first pass split it into two —  */
/* who walked in, then what happened — with a 900ms pause between them, on the   */
/* theory that suspense needs somewhere to live. What it actually bought was     */
/* three taps for a customer the child had no decision about, and it put the     */
/* stars on the second beat, so the question arrived before the facts. A game    */
/* an adult could not follow was made out of that pause.                         */
"use strict";
(function () {
  const { Bank: K, Ui, Audio, Tutorial, Rng } = window.BB;
  const $ = (id) => document.getElementById(id);

  /* ── State ─────────────────────────────────────────────────────────────── */

  const state = {
    difficulty: "normal",
    seenHowTo: false,
    best: { short: 0, normal: 0 },
    run: null,
    playing: false
  };

  // The saved run is a RECORD that save() refreshes, never something derived
  // from `state` at the moment of writing — Mastermind's shape, for Mastermind's
  // reason: boot calls setMuted() before any run exists, and a derived save
  // would write `run: null` straight over the file.
  let savedRun = null;
  const SAVE_KEY = "bankBossSave_v2";

  function save() {
    if (state.playing && state.run) {
      const snap = K.snapshot(state.run);
      if (snap) savedRun = snap;
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        difficulty: state.difficulty, muted: Audio.isMuted(),
        seenHowTo: state.seenHowTo, best: state.best, run: savedRun
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
    if (K.LEVELS[d.difficulty]) state.difficulty = d.difficulty;
    if (typeof d.seenHowTo === "boolean") state.seenHowTo = d.seenHowTo;
    Audio.setMuted(!!d.muted);
    if (d.best && typeof d.best === "object") {
      for (const k of Object.keys(state.best)) {
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
    $("levelNote").textContent = sp.days + " days to grow " + K.money(K.START_OWN) +
      " of your own money. Get it to " + K.money(top) + " and your bank becomes " +
      sp.rungs[sp.rungs.length - 1].replace(/^\S+\s/, "") + ".";

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
    const run = K.newRun(state.difficulty, Rng.newSeed());
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

  function openMorning() {
    state.run.phase = "rates";
    Ui.phase("rates");
    drawMorning();
  }

  function drawMorning() {
    const run = state.run;
    Ui.rates(run, { tip: morningTip(run) });
  }

  // A tip about THIS morning, from what the books actually say. Never a
  // general-purpose hint: the two dials are the only decision on this screen, so
  // a tip that isn't about them is decoration. Ordered by what it is costing.
  //
  // Two of these used to say what the screen already says. The vault turns red
  // by itself when you have lent out promised money, and the gap card prints
  // "-$1.20 is what tonight COSTS you" in red — so a coach box repeating either
  // of them in longer words was the same warning twice, 100px apart, which
  // teaches a child to stop reading the box. What is left is only ever
  // something the screen does NOT already show.
  function morningTip(run) {
    const bank = run.bank;
    const idle = K.spare(run, bank);
    if (idle > 10000) {
      return K.money(idle) + " is sitting in the vault doing nothing — and you still pay " +
        bank.saveRate + "c a night on every dollar of it. Lend it out, or pay savers less.";
    }
    if (bank.deposits <= 0) {
      return "Nobody has money with you yet. Pay savers more and they'll bring you coins to lend.";
    }
    if (bank.fires > 0) {
      return "You've had to call loans in early " + bank.fires +
        (bank.fires === 1 ? " time" : " times") + ". It's the dearest thing in the game.";
    }
    return null;
  }

  function morningDone() {
    const run = state.run;
    Audio.tap();
    K.openCounter(run);
    Ui.phase("counter");
    Audio.vault();
    save();
    nextCustomer();
  }

  /* ── The counter ───────────────────────────────────────────────────────── */

  // One beat. serve() with no choice either resolves the customer outright or
  // comes back `asking`, which is the loan card with its buttons — and either
  // way everything the child needs is on screen in the same frame.
  function nextCustomer() {
    const run = state.run;
    if (!K.current(run)) { doNight(); return; }
    const out = K.serve(run);
    if (!out) { doNight(); return; }
    render(out);
    if (!out.asking) Audio.step();
  }

  function answer(choice) {
    const out = K.serve(state.run, choice);
    if (!out) { doNight(); return; }
    render(out);
    save();
  }

  function render(out) {
    const run = state.run;
    Ui.person(run, out);
    Ui.queueStrip(run);
    if (out.fire) Audio.fire();
    else if (out.short) Audio.bad();
    else if (out.took) Audio.take();
    else if (out.lent) Audio.lend();
    else if (out.refused) Audio.no();
    if (run.phase === "night") save();
  }

  /* ── The end of the day ────────────────────────────────────────────────── */

  let report = null;

  function doNight() {
    const run = state.run;
    if (run.phase !== "evening") {
      run.phase = "night";
      report = K.night(run);
      Audio.vault();
      if (report.interestIn > 0) setTimeout(() => Audio.back(), 300);
      if (report.bad.length) setTimeout(() => Audio.bad(), 620);
    } else if (!report) {
      // Resumed straight into the evening: the night has already been worked
      // out, so read the report back off the ledger rather than running it
      // again, which would pay every loan twice.
      report = run.ledger[run.ledger.length - 1] || null;
      if (!report) { openMorning(); return; }
    }
    Ui.night(run, report);
    $("nextDayBtn").textContent = run.day >= run.days ? "Close up the bank" : "Next morning";
    save();
  }

  function afterNight() {
    const run = state.run;
    Audio.tap();
    const before = K.rungReached(run.bank.own, K.spec(run.difficulty).goal);
    report = null;
    if (K.nextDay(run)) {
      openMorning();
      Audio.morning();
      const after = K.rungReached(run.bank.own, K.spec(run.difficulty).goal);
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
      K.setRates(state.run, Number(b.dataset.value), state.run.bank.loanRate);
      Audio.pick();
      drawMorning();
      save();
    });
    $("loanChooser").addEventListener("click", (ev) => {
      const b = ev.target.closest(".opt");
      if (!b) return;
      K.setRates(state.run, state.run.bank.saveRate, Number(b.dataset.value));
      Audio.pick();
      drawMorning();
      save();
    });

    $("openBtn").addEventListener("click", morningDone);
    $("sayYes").addEventListener("click", () => answer("lend"));
    $("sayNo").addEventListener("click", () => answer("no"));
    $("cardNext").addEventListener("click", () => { Audio.tap(); nextCustomer(); });
    $("nextDayBtn").addEventListener("click", afterNight);

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
      Ui.books(state.run);
      Ui.bookTab("now");
      $("book").hidden = false;
    });
    $("bookTabs").addEventListener("click", (ev) => {
      const b = ev.target.closest(".opt");
      if (!b) return;
      Audio.tap();
      Ui.bookTab(b.dataset.value);
    });
    $("bookClose").addEventListener("click", () => { Audio.tap(); $("book").hidden = true; });
    $("menuQuit").addEventListener("click", () => {
      Audio.tap();
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
  }

  /* ── Boot-time sanity check ────────────────────────────────────────────── */

  // Cheap, and it checks the one thing that must never be wrong: it plays three
  // days through the real model and insists the books balance after every one.
  // If this trips the page still works — it just says so in the console rather
  // than drawing a vault that does not add up.
  function sanity() {
    try {
      const run = K.newRun("normal", 12345);
      K.startDay(run);
      for (let d = 0; d < 3; d++) {
        K.setRates(run, 2, 8);
        K.openCounter(run);
        let guard = 0;
        for (;;) {
          if (!K.current(run) || ++guard > 200) break;
          let out = K.serve(run);
          while (out && out.asking) out = K.serve(run, out.canPay ? "lend" : "no");
          const bad = K.check(run.bank);
          if (bad) { console.warn("Bank Boss: the books don't balance — " + bad); return; }
        }
        K.night(run);
        K.nextDay(run);
      }
      const missing = ["vault", "barFrom", "barWhere", "purse", "board", "rates", "counter",
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
    state: () => state,
    run: () => state.run,
    summary: () => (state.run ? K.summary(state.run) : null),
    check: () => (state.run ? K.check(state.run.bank) : null),
    answer: (c) => answer(c),
    next: () => nextCustomer()
  };

  addEventListener("load", () => navigator.serviceWorker.register("../sw.js").catch(() => {}));
})();
