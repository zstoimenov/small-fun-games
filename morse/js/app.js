/* Morse Agent - the glue: agents, the lever, missions and two-player turns.    */
"use strict";
(function () {
  const R = MO.Rules;
  const A = MO.Audio;
  const UI = MO.UI;
  const $ = UI.$;
  const KEY = "morse-agent";
  const NAMES = ["Fox", "Owl", "Comet", "Falcon", "Shadow", "Echo", "Rocket", "Pixel", "Tiger", "Ninja", "Otter", "Storm"];
  const MISSION_STEPS = ["New", "Listen", "Send", "Decode", "Done"];
  const INTERCEPTS = 10;
  // The lamp flashes along with the beeps for the first few missions whatever
  // the settings. After that it only comes on if the sound is off (or 💡 is on),
  // because a kid who can SEE the rhythm stops listening for it.
  const LAMP_UNTIL = 8;

  const LEVEL_SAYS = [
    "Big gaps between letters. Dots and dashes on every button. Words up to 3 letters.",
    "Medium gaps. Dots and dashes show when you send. Words up to 4 letters.",
    "Real-speed gaps. No help unless you slip up. Words up to 5 letters."
  ];

  // ── Saved state ───────────────────────────────────────────────────────────
  let store = { agents: [], cur: null, muted: false, lampAlways: false, turns: 3, p1: "Agent 1", p2: "Agent 2" };
  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode or junk */ }
  // A damaged or older save must not crash the game: a field with the wrong
  // shape goes back to its default.
  store.agents = (Array.isArray(store.agents) ? store.agents : []).filter((a) => a && typeof a === "object" && a.id);
  store.agents.forEach((a) => {
    if (!R.LEVELS[a.level]) a.level = 0;
    if (!(a.mission >= 1)) a.mission = 1;
    if (!a.best || typeof a.best !== "object") a.best = {};
  });
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } };
  const codename = () => "Agent " + NAMES[Math.floor(Math.random() * NAMES.length)];
  function newAgent(name) {
    const a = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, mission: 1, level: 0, unit: 150, boot: false, best: {} };
    store.agents.push(a);
    store.cur = a.id;
    save();
    return a;
  }
  if (!store.agents.length) newAgent(codename());
  const agent = () => store.agents.find((a) => a.id === store.cur) || store.agents[0];
  // Letters an agent has finished learning (not the ones the next mission brings).
  const learned = (a) => (a.mission <= 1 ? [] : R.lettersFor(Math.min(a.mission - 1, R.MISSIONS)));

  // ── Run tokens ────────────────────────────────────────────────────────────
  // Every screen change bumps `run`. Anything that finishes later - a beep, a
  // timer - checks it still belongs to the current screen before touching it,
  // so leaving a mission half-way can never have its last beep land on HQ.
  let run = 0;
  let keyer = null;
  let keyHandler = null;         // (down: bool, t) - the key on screen right now
  const live = (tok) => tok === run;
  const later = (tok, ms, fn) => setTimeout(() => { if (live(tok)) fn(); }, ms);
  function leave() {
    run++;
    A.stop();
    if (keyer) keyer.cancel();
    keyer = null;
    keyHandler = null;
    A.toneOff();
    UI.lamp(false);
  }

  const lampOn = (n) => store.lampAlways || store.muted || n <= LAMP_UNTIL;

  // Play text through the speaker and the lamp. Resolves true if it finished.
  function send(text, level, n) {
    UI.lampShown(lampOn(n));
    const s = R.schedule(text, level);
    return A.play(s.segs, s.total, UI.lamp);
  }

  // ── HQ ────────────────────────────────────────────────────────────────────
  let leverCtl = null;
  function hq() {
    leave();
    UI.screen("hq");
    const a = agent();
    const done = a.mission > R.MISSIONS;
    const n = Math.min(a.mission, R.MISSIONS);
    const known = learned(a);
    $("agentName").textContent = a.name;
    $("agentInfo").textContent = known.length ? known.length + " letters learned" : "New recruit";
    $("missionKicker").textContent = needsBoot(a) ? "Start here" : done ? "All missions done!" : "Mission " + n + " of " + R.MISSIONS;
    $("missionNew").innerHTML = needsBoot(a) ? "Boot Camp <small>learn dots and dashes</small>" : done ? "Replay the last one" :
      R.newFor(n).map((c) => "<b>" + c + "</b>").join(" ") + " <small>new " + (R.newFor(n).length > 1 ? "letters" : "letter") + "</small>";
    if (!leverCtl) leverCtl = UI.lever(a.level, (v) => { agent().level = v; save(); leverText(); });
    else leverCtl.set(a.level);
    leverText();
    const host = $("learned");
    if (!known.length) {
      host.innerHTML = '<p class="muted small">None yet. Mission 1 teaches you two!</p>';
    } else {
      host.innerHTML = "";
      known.forEach((c) => host.appendChild(letterChip(c, 1)));
    }
  }
  function leverText() {
    const v = agent().level;
    $("leverNow").textContent = R.LEVELS[v].name;
    $("leverSays").textContent = LEVEL_SAYS[v];
  }
  function letterChip(c, n) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.innerHTML = "<b>" + c + "</b>" + UI.pattern(R.CODE[c]);
    b.addEventListener("click", () => {
      b.classList.add("playing");
      send(c, agent().level, n).then(() => b.classList.remove("playing"));
    });
    return b;
  }

  function book() {
    const known = learned(agent());
    const host = $("book");
    host.innerHTML = "";
    const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
    all.forEach((c) => {
      const chip = letterChip(c, 1);
      // In a two-player game every letter is fair game, so nothing is grey.
      if (!inDuo && !known.includes(c)) chip.classList.add("locked");
      host.appendChild(chip);
    });
    UI.open("bookDialog");
  }

  // ── Agents ────────────────────────────────────────────────────────────────
  function agents() {
    const host = $("agentList");
    host.innerHTML = "";
    store.agents.forEach((a) => {
      const row = document.createElement("div");
      row.className = "agent-row" + (a.id === store.cur ? " cur" : "");
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "pick";
      pick.innerHTML = "<b>" + UI.esc(a.name) + "</b><small>" +
        (a.mission > R.MISSIONS ? "All missions done" : "Mission " + a.mission) + " &middot; " + R.LEVELS[a.level].name + "</small>";
      pick.addEventListener("click", () => { store.cur = a.id; save(); UI.close("agentDialog"); hq(); });
      row.appendChild(pick);
      if (store.agents.length > 1) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "icon-btn";
        del.setAttribute("aria-label", "Remove " + a.name);
        del.innerHTML = "&#128465;";
        del.addEventListener("click", () => {
          if (!confirm("Remove " + a.name + "? Their letters will be lost.")) return;
          store.agents = store.agents.filter((x) => x !== a);
          if (store.cur === a.id) store.cur = store.agents[0].id;
          save();
          agents();
          hq();
        });
        row.appendChild(del);
      }
      host.appendChild(row);
    });
    // Four is plenty for one tablet, and keeps the list from needing a scroll.
    $("newAgent").hidden = store.agents.length >= 4;
    $("newName").value = "";
    UI.open("agentDialog");
  }
  function addAgent() {
    const name = $("newName").value.trim() || codename();
    newAgent(name.slice(0, 12));
    UI.close("agentDialog");
    hq();
  }

  // ── The story of Morse code ───────────────────────────────────────────────
  // A picture book: one page at a time, Back/Next or a swipe. The Hear buttons
  // play at Ace spacing - these are real messages, sent the way they were.
  let page = 0;
  function story() {
    leave();
    inDuo = false;
    m = null;
    UI.screen("story", "The story of Morse");
    showPage(0);
  }
  function showPage(n) {
    const cards = document.querySelectorAll("#pages .page-card");
    A.stop();
    UI.lamp(false);
    // The Hear buttons light a small lamp on their own page; stopping the sound
    // mid-beep would leave it lit for the next visit.
    document.querySelectorAll("#pages .lamp.small.on").forEach((l) => l.classList.remove("on"));
    page = Math.max(0, Math.min(cards.length - 1, n));
    cards.forEach((c, i) => { c.hidden = i !== page; });
    $("pageDots").innerHTML = Array.from(cards, (_, i) => '<i class="' + (i === page ? "on" : "") + '"></i>').join("");
    $("pgBack").disabled = page === 0;
    // visibility, not hidden: the button keeps its space so the dots stay put.
    $("pgNext").style.visibility = page === cards.length - 1 ? "hidden" : "";
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("#pages .hear").forEach((b) => b.addEventListener("click", () => {
    const text = b.dataset.say;
    const host = b.closest(".page-card");
    // A little lamp on the page itself: the radio panel lives on another screen.
    let lamp = host.querySelector(".lamp");
    if (!lamp) { lamp = document.createElement("div"); lamp.className = "lamp small"; b.parentNode.prepend(lamp); }
    const s = R.schedule(text, 2);
    A.play(s.segs, s.total, (on) => lamp.classList.toggle("on", on));
  }));
  $("pgBack").addEventListener("click", () => showPage(page - 1));
  $("pgNext").addEventListener("click", () => showPage(page + 1));
  $("storyGo").addEventListener("click", () => (needsBoot(agent()) ? bootCamp() : startMission()));
  // Swipe left/right on the page. Only a mostly-sideways move counts, so
  // scrolling a long page on a phone never turns it by accident.
  (() => {
    let x0 = null, y0 = 0;
    const el = $("pages");
    el.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { x0 = e.clientX; y0 = e.clientY; } });
    el.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) showPage(page + (dx < 0 ? 1 : -1));
    });
    el.addEventListener("pointercancel", () => { x0 = null; });
  })();

  // ── Boot Camp ─────────────────────────────────────────────────────────────
  // For somebody who has never heard Morse. Before any letters: what a dot and a
  // dash sound like, how to make each on the key, and copying a few rhythms.
  // Runs once before Mission 1, and can be replayed from HQ.
  const BOOT_STEPS = ["Hear", "Tap", "Copy", "Done"];
  const needsBoot = (a) => !a.boot && a.mission <= 1;
  const beep = (p, level) => {
    UI.lampShown(true);
    const s = R.schedule(R.DECODE[p] || "E", level || 0);
    // Rhythms that are not letters yet still need to be played: build them here.
    if (!R.DECODE[p]) {
      let t = 0; s.segs = [];
      const gap = R.gaps(level || 0).beep;
      p.split("").forEach((c, i) => { if (i) t += gap; const d = c === "." ? R.DIT : 3 * R.DIT; s.segs.push({ at: t, dur: d }); t += d; });
      s.total = t;
    }
    return A.play(s.segs, s.total, UI.lamp);
  };

  function bootCamp() {
    leave();
    inDuo = false;
    m = null;
    UI.screen("play", "Boot Camp");
    bootHear();
  }

  // Drill 1: a dot is short, a dash is long. Hear both, then tell them apart.
  function bootHear() {
    const tok = run;
    const quiz = R.shuffle([".", "-", ".", "-", "-", "."]);
    let i = -1;
    UI.steps(BOOT_STEPS, 0);
    UI.hq("<b>HQ:</b> Morse code is made of two beeps. A short one is a <b>dot</b>. A long one is a <b>dash</b>.");
    UI.signal("");
    const st = UI.stage(
      '<div class="intro">' +
      '<button class="intro-card" type="button" data-p="."><b>' + UI.pattern(".", "big") + '</b>Dot<small>&#128266; short: "dit"</small></button>' +
      '<button class="intro-card" type="button" data-p="-"><b>' + UI.pattern("-", "big") + '</b>Dash<small>&#128266; long: "dah"</small></button></div>' +
      '<p class="muted center" id="quizMsg">Tap each one to hear it. Then let\'s test your ears!</p>' +
      '<div class="actions"><button class="btn primary" type="button" id="go">Test my ears &rsaquo;</button></div>');
    st.querySelectorAll(".intro-card").forEach((b) => b.addEventListener("click", () => {
      if (i >= 0) { answer(b.dataset.p, b); return; }
      beep(b.dataset.p);
    }));
    const msg = st.querySelector("#quizMsg");
    let busy = false;
    function ask() {
      if (!live(tok)) return;
      i++;
      busy = false;
      st.querySelectorAll(".intro-card").forEach((b) => b.classList.remove("right", "wrong"));
      if (i >= quiz.length) { bootTap(); return; }
      msg.innerHTML = "Listen... was that a <b>dot</b> or a <b>dash</b>? (" + (i + 1) + " of " + quiz.length + ")";
      later(tok, 300, () => beep(quiz[i]));
    }
    function answer(p, b) {
      if (busy) return;
      busy = true;
      if (p === quiz[i]) { b.classList.add("right"); A.right(); later(tok, 700, ask); }
      else {
        b.classList.add("wrong"); A.wrong();
        msg.innerHTML = "That was a <b>" + (quiz[i] === "." ? "dot" : "dash") + "</b>. Listen again!";
        later(tok, 400, () => beep(quiz[i]).then((ok) => { if (ok) later(tok, 600, ask); }));
      }
    }
    st.querySelector("#go").addEventListener("click", () => { st.querySelector(".actions").remove(); ask(); });
  }

  // Drill 2: make them on the key. Quick tap = dot, hold = dash. The key reads
  // a single press against a fixed line here (250 ms) - the kid is learning what
  // "short" and "long" mean, and their dots become the key's first idea of
  // their speed.
  function bootTap() {
    leave();
    const tok = run;
    const want = [".", ".", "-", "-", ".", "-", "-", "."];
    const dots = [];
    let i = 0, downAt = 0;
    UI.steps(BOOT_STEPS, 1);
    UI.lampShown(true);
    UI.signal("");
    const st = UI.stage('<div class="target" id="target"></div><div class="key-wrap" id="keyWrap"></div>');
    const show = () => {
      UI.hq("<b>HQ:</b> Now you make them. <b>Tap</b> the key quickly for a dot. <b>Hold</b> it down for a dash. (" + (i + 1) + " of " + want.length + ")");
      st.querySelector("#target").innerHTML = "Make a <b>" + (want[i] === "." ? "dot" : "dash") + "</b> " + UI.pattern(want[i], "big");
    };
    keyHandler = (isDown, t) => {
      if (!live(tok) || i >= want.length) return;
      if (isDown) { A.toneOn(); UI.lamp(true); downAt = t; return; }
      A.toneOff(); UI.lamp(false);
      const dur = t - downAt;
      if (dur < 25) return;
      const got = dur < 250 ? "." : "-";
      if (got === ".") dots.push(dur);
      if (got === want[i]) {
        A.right();
        UI.signal("Yes! A " + (got === "." ? "dot" : "dash") + " " + UI.pattern(got, "big live"));
        i++;
        if (i >= want.length) {
          // Their own dot length, not our guess, is where the key starts from.
          if (dots.length) { agent().unit = Math.round(Math.max(70, Math.min(250, dots.reduce((a, b) => a + b, 0) / dots.length))); save(); }
          later(tok, 800, bootCopy);
          return;
        }
        show();
      } else {
        A.wrong();
        UI.signal("That was a " + (got === "." ? "dot" : "dash") + " " + UI.pattern(got, "big") + " &nbsp;" +
          (want[i] === "-" ? "Hold it longer!" : "Quicker - just a tap!"));
      }
    };
    UI.teleKey(st.querySelector("#keyWrap"), (t) => keyHandler && keyHandler(true, t), (t) => keyHandler && keyHandler(false, t));
    show();
  }

  // Drill 3: copy a whole rhythm - hear it, then key it. These are real letters
  // (I, M, A) but they are not named yet; Mission 1 is where letters start.
  function bootCopy() {
    leave();
    const tok = run;
    const want = ["..", "--", ".-"];
    let i = 0;
    UI.steps(BOOT_STEPS, 2);
    UI.signal("");
    const st = UI.stage('<div class="target" id="target"></div><div class="key-wrap" id="keyWrap"></div>');
    const show = () => {
      UI.hq("<b>HQ:</b> Listen to the tune, then tap it back on the key. (" + (i + 1) + " of " + want.length + ")");
      st.querySelector("#target").innerHTML = UI.pattern(want[i], "big") +
        ' <button class="small-btn" type="button" id="hear">&#128266; Hear it</button>';
      st.querySelector("#hear").addEventListener("click", () => beep(want[i]));
      later(tok, 300, () => beep(want[i]));
    };
    keyUp(st.querySelector("#keyWrap"), (ch, p) => {
      if (!live(tok) || i >= want.length) return;
      if (p === want[i]) {
        A.right();
        UI.signal("Perfect! " + UI.pattern(p, "big live"));
        i++;
        if (i >= want.length) { later(tok, 800, bootDone); return; }
        later(tok, 700, show);
      } else {
        A.wrong();
        UI.signal("You sent " + UI.pattern(p, "big") + " &nbsp;Try again!");
      }
    });
    show();
  }

  function bootDone() {
    leave();
    agent().boot = true;
    save();
    UI.steps(BOOT_STEPS, 3);
    UI.lampShown(false);
    UI.signal("");
    UI.hq("<b>HQ:</b> Boot Camp complete. You're ready for real letters, agent!");
    A.unlock();
    const st = UI.stage('<div class="handover"><span class="big-emoji">&#127942;</span>' +
      "<p>You can hear and make dots and dashes. Every letter is just a tune made of them.</p></div>" +
      '<div class="actions"><button class="btn ghost" type="button" id="toHq2">HQ</button>' +
      '<button class="btn primary" type="button" id="goOn">Mission 1 &rsaquo;</button></div>');
    st.querySelector("#toHq2").addEventListener("click", hq);
    st.querySelector("#goOn").addEventListener("click", startMission);
  }

  // ── A mission ─────────────────────────────────────────────────────────────
  let m = null;

  function startMission() {
    leave();
    const a = agent();
    const n = Math.min(a.mission, R.MISSIONS);
    m = { n, level: a.level, hints: R.LEVELS[a.level].hints, maxWord: R.LEVELS[a.level].maxWord, right: 0, total: 0 };
    inDuo = false;
    UI.screen("play", "Mission " + n);
    intro();
  }

  function intro() {
    const tok = run;
    const fresh = R.newFor(m.n);
    UI.steps(MISSION_STEPS, 0);
    UI.hq("<b>HQ:</b> " + (m.n === 1 ? "Welcome, agent! Here are your first two letters." : "New letter for you, agent. Listen to its tune."));
    UI.signal("");
    const st = UI.stage(
      '<div class="intro">' + fresh.map((c) =>
        '<button class="intro-card" type="button" data-ch="' + c + '"><b>' + c + "</b>" + UI.pattern(R.CODE[c], "big") +
        '<small>&#128266; tap to hear</small></button>').join("") + "</div>" +
      '<p class="muted center">Hear the tune, not the dots. ' +
      (fresh.length > 1 ? "K goes <i>dah-di-dah</i>. M goes <i>dah-dah</i>." : "Say it in your head: <i>" + sayIt(fresh[0]) + "</i>.") + "</p>" +
      '<div class="actions"><button class="btn primary" type="button" id="ready">I\'m ready &rsaquo;</button></div>');
    st.querySelectorAll(".intro-card").forEach((b) => b.addEventListener("click", () => send(b.dataset.ch, m.level, m.n)));
    st.querySelector("#ready").addEventListener("click", intercept);
    // Play each new letter twice to start with, the way you'd hear it on air.
    (async () => {
      for (let r = 0; r < 2; r++) {
        for (const c of fresh) {
          if (!live(tok)) return;
          UI.signal(UI.pattern(R.CODE[c], "big"));
          await send(c, m.level, m.n);
          await wait(500);
        }
      }
      if (live(tok)) UI.signal("");
    })();
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const sayIt = (c) => R.CODE[c].split("").map((s) => (s === "." ? "di" : "dah")).join("-").replace(/di$/, "dit");

  // Stage 1: hear a letter, tap which one it was.
  function intercept() {
    leave();
    const tok = run;
    const deck = R.interceptDeck(m.n, INTERCEPTS);
    const letters = R.lettersFor(m.n);
    let i = 0;
    UI.steps(MISSION_STEPS, 1);
    UI.hq("<b>HQ:</b> Enemy radio! Listen, then tap the letter you heard.");

    function ask() {
      if (!live(tok)) return;
      if (i >= deck.length) { transmit(); return; }
      const want = deck[i];
      let answered = false;
      UI.signal("");
      const st = UI.stage(
        '<div class="bar"><span class="count">' + (i + 1) + " / " + deck.length + "</span>" +
        '<button class="small-btn" type="button" id="again">&#128266; Play again</button></div>' +
        '<div class="tiles" id="tiles"></div>');
      const replay = () => send(want, m.level, m.n);
      st.querySelector("#again").addEventListener("click", replay);
      UI.tiles(st.querySelector("#tiles"), letters, m.hints >= 2, (ch, btn) => {
        if (answered) return;
        answered = true;
        m.total++;
        if (ch === want) {
          m.right++;
          btn.classList.add("right");
          A.right();
          i++;
          later(tok, 700, ask);
        } else {
          btn.classList.add("wrong");
          st.querySelector('[data-ch="' + want + '"]').classList.add("was");
          A.wrong();
          // Show it and play it again: hearing the right one straight after the
          // wrong guess is the moment the difference sinks in.
          UI.signal("<b>" + want + "</b> " + UI.pattern(R.CODE[want], "big"));
          i++;
          later(tok, 500, () => send(want, m.level, m.n).then((ok) => { if (ok) later(tok, 700, ask); }));
        }
      });
      later(tok, 350, replay);
    }
    ask();
  }

  // The live key, shared by missions and two-player turns. `onLetter(ch, p,
  // presses, unit)` gets each finished letter; ch is null for a tune that is
  // not a letter at all.
  function keyUp(host, onLetter) {
    const a = agent();
    keyer = MO.Key({
      unit: a.unit,
      onSymbol: (p) => UI.signal(UI.pattern(p, "big live")),
      onLetter: (ch, p, presses, unit) => { a.unit = Math.round(unit); save(); onLetter(ch, p, presses, unit); }
    });
    const k = keyer;
    keyHandler = (isDown, t) => {
      if (isDown) { A.toneOn(); UI.lamp(true); k.down(t); }
      else { A.toneOff(); UI.lamp(false); k.up(t); }
    };
    UI.teleKey(host, (t) => keyHandler && keyHandler(true, t), (t) => keyHandler && keyHandler(false, t));
  }

  // Tap a word out on the key, letter by letter. Used by the mission's Send
  // step and by the sender in a two-player turn. Calls done(recording, clean)
  // where clean is how many letters were right first time.
  function keyWord(word, hints, onDone, extraHtml) {
    const tok = run;
    const rec = [];
    let at = 0, misses = 0, clean = 0;
    UI.lampShown(true);
    const st = UI.stage(
      (extraHtml || "") +
      '<div class="word" id="word">' + word.split("").map((c) => '<span class="slot">' + c + "</span>").join("") + "</div>" +
      '<div class="target" id="target"></div>' +
      '<div class="key-wrap" id="keyWrap"></div>');
    const slots = st.querySelectorAll("#word .slot");
    function show(hint) {
      slots.forEach((s, i) => { s.classList.toggle("now", i === at); });
      const c = word[at];
      st.querySelector("#target").innerHTML = "Send <b>" + c + "</b>" +
        (hints >= 1 || hint ? " " + UI.pattern(R.CODE[c], "big") : ' <button class="small-btn" type="button" id="peek">Show me</button>');
      const peek = st.querySelector("#peek");
      if (peek) peek.addEventListener("click", () => show(true));
    }
    keyUp(st.querySelector("#keyWrap"), (ch, p, presses, unit) => {
      if (!live(tok) || at >= word.length) return;
      const want = word[at];
      if (ch === want) {
        rec.push({ presses, unit });
        if (!misses) clean++;
        misses = 0;
        slots[at].classList.add("sent");
        at++;
        if (at >= word.length) {
          A.right();
          UI.signal("");
          st.querySelector("#target").innerHTML = "<b>Sent!</b>";
          later(tok, 900, () => onDone(rec, clean));
          return;
        }
        later(tok, 250, () => UI.signal(""));
        show(false);
      } else {
        misses++;
        A.wrong();
        UI.signal((ch ? "That was <b>" + ch + "</b> " : "Hmm, that's not a letter ") + UI.pattern(p, "big") + " &nbsp;Try again!");
        // After a miss the answer is always shown, whatever the lever says: the
        // lever decides how much help you get before you slip, never after.
        show(true);
        // Three goes and still stuck: let it through rather than let a kid sit
        // there failing. It does not count as clean.
        if (misses >= 3) {
          st.querySelector("#target").insertAdjacentHTML("beforeend",
            ' <button class="small-btn" type="button" id="skip">Skip it</button>');
          const skip = st.querySelector("#skip");
          skip.addEventListener("click", () => {
            // One skip per button: on the last letter nothing redraws it, and
            // a second tap used to step past the end of the word.
            if (!live(tok) || at >= word.length) return;
            skip.remove();
            rec.push({ presses: R.CODE[want].split("").reduce((acc, s) => {
              const u = agent().unit, start = acc.length ? acc[acc.length - 1].u + u : 0;
              acc.push({ d: start, u: start + (s === "." ? u : 3 * u) });
              return acc;
            }, []), unit: agent().unit });
            misses = 0;
            slots[at].classList.add("sent", "skipped");
            at++;
            UI.signal("");
            if (at >= word.length) later(tok, 400, () => onDone(rec, clean)); else show(false);
          });
        }
      }
    });
    show(false);
  }

  // Stage 2: send words on the key. Not scored for the 90% - the mission is
  // about hearing, and a wobbly thumb should not hold back a good ear.
  function transmit() {
    leave();
    const tok = run;
    const words = R.words(m.n, 2, m.maxWord);
    let w = 0;
    UI.steps(MISSION_STEPS, 2);
    function next() {
      if (!live(tok)) return;
      if (w >= words.length) { decode(); return; }
      UI.hq("<b>HQ:</b> Send this back to us. Tap for a dot, hold for a dash." + (words.length > 1 ? " (" + (w + 1) + " of " + words.length + ")" : ""));
      UI.signal("");
      keyWord(words[w], m.hints, () => { w++; next(); });
    }
    next();
  }

  // A row of empty boxes and a keyboard. Fills left to right; when full, calls
  // done(typed). Used by Decode and by the listener in a two-player turn.
  function copyBox(host, length, letters, patterns, onDone, bookBtn) {
    let typed = "";
    host.insertAdjacentHTML("beforeend",
      '<div class="word" id="copy">' + "<span class=\"slot\"></span>".repeat(length) + "</div>" +
      '<div class="tiles" id="tiles"></div>' +
      '<div class="actions"><button class="small-btn" type="button" id="bksp">&#9003; Back</button>' +
      (bookBtn ? '<button class="small-btn" type="button" id="bk">&#128214; Code book</button>' : "") + "</div>");
    const slots = host.querySelectorAll("#copy .slot");
    const draw = () => slots.forEach((s, i) => { s.textContent = typed[i] || ""; s.classList.toggle("now", i === typed.length); });
    UI.tiles(host.querySelector("#tiles"), letters, patterns, (ch) => {
      if (typed.length >= length) return;
      typed += ch;
      draw();
      if (typed.length === length) onDone(typed, slots);
    });
    host.querySelector("#bksp").addEventListener("click", () => { typed = typed.slice(0, -1); draw(); });
    if (bookBtn) host.querySelector("#bk").addEventListener("click", book);
    draw();
  }

  function mark(slots, want, got) {
    slots.forEach((s, i) => {
      s.classList.add(got[i] === want[i] ? "right" : "wrong");
      if (got[i] !== want[i]) s.innerHTML = "<s>" + (got[i] || "") + "</s><b>" + want[i] + "</b>";
    });
  }

  // Stage 3: hear a whole word, spell it out.
  function decode() {
    leave();
    const tok = run;
    const words = R.words(m.n, 2, m.maxWord);
    let w = 0;
    UI.steps(MISSION_STEPS, 3);
    function next() {
      if (!live(tok)) return;
      if (w >= words.length) { debrief(); return; }
      const want = words[w];
      UI.hq("<b>HQ:</b> Secret message coming in! Spell out what you hear." + (words.length > 1 ? " (" + (w + 1) + " of " + words.length + ")" : ""));
      UI.signal("");
      const st = UI.stage('<div class="bar"><span class="count">' + want.length + ' letters</span>' +
        '<button class="small-btn" type="button" id="again">&#128266; Play again</button></div>');
      const replay = () => send(want, m.level, m.n);
      st.querySelector("#again").addEventListener("click", replay);
      copyBox(st, want.length, R.lettersFor(m.n), m.hints >= 2, (got, slots) => {
        const ok = R.score(want, got);
        m.right += ok;
        m.total += want.length;
        mark(slots, want, got);
        (ok === want.length ? A.right : A.wrong)();
        st.querySelector("#tiles").remove();
        st.querySelector(".actions").innerHTML = '<button class="btn primary" type="button" id="nx">Next &rsaquo;</button>';
        st.querySelector("#nx").addEventListener("click", () => { w++; next(); });
      });
      later(tok, 400, replay);
    }
    next();
  }

  function debrief() {
    leave();
    const a = agent();
    const pct = m.total ? m.right / m.total : 0;
    const pass = pct >= R.PASS;
    const first = pass && m.n === a.mission && a.mission <= R.MISSIONS;
    a.best[m.n] = Math.max(a.best[m.n] || 0, Math.round(pct * 100));
    if (first) a.mission++;
    save();
    UI.steps(MISSION_STEPS, 4);
    UI.lampShown(false);
    UI.signal("");
    const need = Math.ceil(m.total * R.PASS);
    UI.hq(pass ? "<b>HQ:</b> Mission complete. Great listening, agent!" : "<b>HQ:</b> Good try, agent. Let's go again.");
    const next = first && a.mission <= R.MISSIONS ? R.newFor(a.mission)[0] : null;
    const st = UI.stage(
      '<div class="debrief ' + (pass ? "pass" : "fail") + '">' +
      '<div class="score"><b>' + m.right + "</b> / " + m.total + "<small>heard right</small></div>" +
      '<div class="meter"><i style="width:' + Math.round(pct * 100) + '%"></i><span class="mark" style="left:' + R.PASS * 100 + '%"></span></div>' +
      "<p>" + (pass
        ? (next ? "You unlocked a new letter: <b>" + next + "</b>!" : first ? "That was the last mission. You know all of Morse code!" : "Mission done again. Nice!")
        : "You need " + need + " right to unlock the next letter. So close!") + "</p>" +
      "</div>" +
      '<div class="actions">' +
      '<button class="btn ghost" type="button" id="toHq2">HQ</button>' +
      '<button class="btn primary" type="button" id="goOn">' + (pass ? (a.mission > R.MISSIONS ? "Play again" : "Next mission") : "Try again") + " &rsaquo;</button></div>");
    if (first) A.unlock(); else if (pass) A.right();
    st.querySelector("#toHq2").addEventListener("click", hq);
    st.querySelector("#goOn").addEventListener("click", startMission);
  }

  // ── Two players ───────────────────────────────────────────────────────────
  let inDuo = false;
  let duo = null;

  function duoSetup() {
    leave();
    inDuo = true;
    UI.screen("duo", "Field Agents");
    $("p1").value = store.p1;
    $("p2").value = store.p2;
    $("duoLever").textContent = "Difficulty: " + R.LEVELS[agent().level].name + ". Change it with the lever on HQ.";
  }

  function duoStart() {
    store.p1 = $("p1").value.trim() || "Agent 1";
    store.p2 = $("p2").value.trim() || "Agent 2";
    save();
    const lv = agent().level;
    duo = { names: [store.p1, store.p2], turns: store.turns * 2, turn: 0, scores: [0, 0], level: lv, hints: R.LEVELS[lv].hints, maxWord: R.LEVELS[lv].maxWord };
    duoPick();
  }

  const duoSteps = () => { const s = []; for (let i = 0; i < duo.turns; i++) s.push(String(i + 1)); return s; };
  const who = (i) => UI.esc(duo.names[i]);

  function duoPick() {
    leave();
    const tok = run;
    const s = duo.turn % 2, l = 1 - s;
    UI.screen("play", "Field Agents");
    UI.steps(duoSteps(), duo.turn);
    UI.hq("<b>" + who(s) + "</b>, pick a secret word. Don't let <b>" + who(l) + "</b> see!");
    UI.signal("");
    UI.lampShown(false);
    function cards() {
      if (!live(tok)) return;
      const ws = R.duoWords(3, duo.maxWord, Math.min(3, duo.maxWord));
      const st = UI.stage('<div class="word-cards">' + ws.map((w) => '<button class="word-card" type="button">' + w + "</button>").join("") + "</div>" +
        '<div class="actions"><button class="small-btn" type="button" id="more">&#128256; Other words</button></div>');
      st.querySelectorAll(".word-card").forEach((b) => b.addEventListener("click", () => duoSend(b.textContent)));
      st.querySelector("#more").addEventListener("click", cards);
    }
    cards();
  }

  function duoSend(word) {
    leave();
    const s = duo.turn % 2;
    UI.hq("<b>" + who(s) + "</b>, tap your word on the key.");
    UI.signal("");
    keyWord(word, duo.hints, (rec, clean) => duoHandover(word, rec, clean));
  }

  function duoHandover(word, rec, clean) {
    leave();
    const l = 1 - duo.turn % 2;
    UI.hq("");
    UI.signal("");
    UI.lampShown(false);
    // The word is gone from the page before the tablet changes hands, not just
    // covered up - nothing to peek at.
    const st = UI.stage('<div class="handover"><span class="big-emoji">&#128232;</span>' +
      "<p>Message sent! Pass the tablet to <b>" + who(l) + "</b>.</p>" +
      '<button class="btn primary" type="button" id="ready">I\'m ' + who(l) + " - ready &rsaquo;</button></div>");
    st.querySelector("#ready").addEventListener("click", () => duoListen(word, rec, clean));
  }

  // The sender's own timing, played back: their dits and dahs exactly as they
  // pressed them, with a tidy gap between letters (the real gaps also hold the
  // thinking time and the mistakes, which nobody wants to sit through).
  function recording(rec) {
    const segs = [];
    const gap = R.gaps(duo.level).letter;
    let t = 0;
    rec.forEach((L, i) => {
      if (i) t += Math.max(3 * L.unit, gap);
      L.presses.forEach((p) => segs.push({ at: t + p.d, dur: p.u - p.d }));
      const last = L.presses[L.presses.length - 1];
      t += last ? last.u : 0;
    });
    return { segs, total: t };
  }

  function duoListen(word, rec, clean) {
    leave();
    const tok = run;
    const s = duo.turn % 2, l = 1 - s;
    const tape = recording(rec);
    UI.hq("<b>" + who(l) + "</b>, here comes <b>" + who(s) + "</b>'s message. What does it say?");
    UI.signal("");
    const play = () => { UI.lampShown(store.lampAlways || store.muted); return A.play(tape.segs, tape.total, UI.lamp); };
    const st = UI.stage('<div class="bar"><span class="count">' + word.length + ' letters</span>' +
      '<button class="small-btn" type="button" id="again">&#128266; Play again</button></div>');
    st.querySelector("#again").addEventListener("click", play);
    const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    copyBox(st, word.length, abc, duo.hints >= 2, (got, slots) => {
      const ok = R.score(word, got);
      duo.scores[l] += ok;
      duo.scores[s] += clean;
      mark(slots, word, got);
      (ok === word.length ? A.right : A.wrong)();
      st.querySelector("#tiles").remove();
      duo.turn++;
      const last = duo.turn >= duo.turns;
      st.querySelector(".actions").innerHTML =
        '<p class="pts"><b>' + who(l) + "</b> +" + ok + " for hearing &middot; <b>" + who(s) + "</b> +" + clean + " for clean sending</p>" +
        '<button class="btn primary" type="button" id="nx">' + (last ? "See who won" : "Next turn") + " &rsaquo;</button>";
      st.querySelector("#nx").addEventListener("click", last ? duoEnd : duoPick);
    }, duo.hints >= 1);
    later(tok, 400, play);
  }

  function duoEnd() {
    leave();
    const [a, b] = duo.scores;
    UI.steps(duoSteps(), duo.turns);
    UI.signal("");
    UI.lampShown(false);
    UI.hq(a === b ? "<b>A draw!</b> Two top agents." : "<b>" + who(a > b ? 0 : 1) + " wins!</b>");
    const st = UI.stage('<div class="duo-end">' +
      [0, 1].map((i) => '<div class="player' + (duo.scores[i] >= duo.scores[1 - i] ? " top" : "") + '"><b>' + duo.scores[i] + "</b><span>" + who(i) + "</span></div>").join("") +
      '</div><p class="muted center">A point for every letter you heard right, and every letter you sent right first time.</p>' +
      '<div class="actions"><button class="btn ghost" type="button" id="toHq2">HQ</button>' +
      '<button class="btn primary" type="button" id="again">Play again &rsaquo;</button></div>');
    A.unlock();
    st.querySelector("#toHq2").addEventListener("click", hq);
    st.querySelector("#again").addEventListener("click", duoStart);
  }

  // ── Wiring ────────────────────────────────────────────────────────────────
  function muteState() {
    A.setMuted(store.muted);
    $("mute").innerHTML = store.muted ? "&#128263;" : "&#128266;";
    $("mute").setAttribute("aria-pressed", store.muted);
    $("mute").setAttribute("aria-label", store.muted ? "Sound off" : "Sound on");
    $("lampBtn").setAttribute("aria-pressed", store.lampAlways);
    $("lampBtn").classList.toggle("on", store.lampAlways);
  }

  $("mute").addEventListener("click", () => {
    store.muted = !store.muted;
    save();
    muteState();
    // Leaving the lamp dark when the sound goes off would leave nothing at all.
    if (store.muted && m) UI.lampShown(true);
    UI.toast(store.muted ? "Sound off. The lamp will flash instead." : "Sound on.");
  });
  $("lampBtn").addEventListener("click", () => {
    store.lampAlways = !store.lampAlways;
    save();
    muteState();
    if (!$("play").hidden) UI.lampShown(store.lampAlways || store.muted || (m && m.n <= LAMP_UNTIL));
    UI.toast(store.lampAlways ? "Lamp always on." : "Lamp only when you need it.");
  });
  $("help").addEventListener("click", () => UI.open("helpDialog"));
  $("toHq").addEventListener("click", hq);
  $("agentChip").addEventListener("click", agents);
  $("dice").addEventListener("click", () => { $("newName").value = codename(); });
  $("addAgent").addEventListener("click", addAgent);
  $("newName").addEventListener("keydown", (e) => { if (e.key === "Enter") addAgent(); });
  $("missionBtn").addEventListener("click", () => (needsBoot(agent()) ? bootCamp() : startMission()));
  $("bootBtn").addEventListener("click", bootCamp);
  $("storyBtn").addEventListener("click", story);
  $("bookBtn").addEventListener("click", () => { inDuo = false; book(); });
  $("duoBtn").addEventListener("click", duoSetup);
  $("duoStart").addEventListener("click", duoStart);
  UI.seg("turnsSeg", store.turns, (v) => { store.turns = v; save(); });

  // Audio has to be switched on by a touch. Do it on the very first one, so the
  // first beep of a mission is not the one that gets lost.
  window.addEventListener("pointerdown", () => { if (!store.muted) A.ready(); }, { once: true, capture: true });

  // A keyboard works too: Space is the key, letters answer, Backspace rubs out,
  // Enter presses the big button.
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector("dialog[open]") || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.code === "Space" && keyHandler) {
      e.preventDefault();
      if (!e.repeat) { document.querySelector(".tkey") && document.querySelector(".tkey").classList.add("down"); keyHandler(true, performance.now()); }
      return;
    }
    if (e.repeat) return;
    const stage = $("stage");
    if (e.key === "Backspace") { const b = stage.querySelector("#bksp"); if (b) { e.preventDefault(); b.click(); } return; }
    if (e.key === "Enter") { const b = stage.querySelector(".btn.primary"); if (b) { e.preventDefault(); b.click(); } return; }
    if (e.key.length === 1) {
      const t = stage.querySelector('.tile[data-ch="' + e.key.toUpperCase() + '"]');
      if (t) { e.preventDefault(); t.click(); }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && keyHandler) {
      e.preventDefault();
      const k = document.querySelector(".tkey");
      if (k) k.classList.remove("down");
      keyHandler(false, performance.now());
    }
  });
  // Switching apps mid-press: the keyup never comes, so let go of everything.
  window.addEventListener("blur", () => { A.toneOff(); UI.lamp(false); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) A.stop(); });

  muteState();
  hq();

  try {
    if (!localStorage.getItem("morse-seen-help")) {
      localStorage.setItem("morse-seen-help", "1");
      UI.open("helpDialog");
    }
  } catch (e) { /* private mode: the ? button still works */ }
})();
