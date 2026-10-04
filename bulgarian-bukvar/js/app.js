/* Буквар - the glue: progress, the five mission steps, tricky letters,        */
/* the history cards and the passport quiz.                                    */
"use strict";
(function () {
  const L = BQ.Letters;
  const M = BQ.MISSIONS;
  const R = BQ.Rules;
  const UI = BQ.UI;
  const Q = BQ.Quiz;
  const C = BQ.CARDS;
  const S = BQ.STAMPS;
  const $ = UI.$;
  const KEY = "bukvar-quest";

  // ── Saved state ───────────────────────────────────────────────────────────
  // done[i] is the best stars for mission i, 0 if it has never been finished.
  // stamps[place] is "ink" or "gold". seen lists cards already opened, so a
  // new one can wear a red border until it is looked at.
  // remembered lists cards whose "Remember it?" question was answered right.
  const fresh = () => ({ done: M.map(() => 0), trapBest: 0, stamps: {}, seen: [], remembered: [] });
  let store = fresh();
  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode or junk */ }
  store.done = M.map((_, i) => +store.done[i] || 0);
  if (!store.stamps || typeof store.stamps !== "object") store.stamps = {};
  if (!Array.isArray(store.seen)) store.seen = [];
  if (!Array.isArray(store.remembered)) store.remembered = [];
  // The home page reads gamebox:progress:<folder> for the ★ on this game's
  // card and its place in "Keep playing"; it is written with every save.
  const report = () => {
    const stars = store.done.reduce((a, b) => a + b, 0);
    try { localStorage.setItem("gamebox:progress:bulgarian-bukvar", JSON.stringify({ stars, max: M.length * 3, at: Date.now() })); } catch (e) { /* ignore */ }
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } report(); };

  const finished = () => store.done.filter((s) => s > 0).length;
  const nextMission = () => { const i = store.done.findIndex((s) => !s); return i < 0 ? M.length - 1 : i; };
  // Letters from finished missions only: a letter half-way through its first
  // mission isn't "yours" yet.
  const knownLetters = () => (finished() ? R.known(finished() - 1) : []);
  // Cards and stamps open when their mission is finished, whatever order the
  // missions were replayed in.
  const cardOpen = (c) => store.done[c.m] > 0;
  const stampState = (st) => store.stamps[st.place] || (store.done[st.m] > 0 ? "open" : "empty");

  // ── Run tokens ────────────────────────────────────────────────────────────
  // Every screen change bumps `run`, so a "next round" timer that fires after
  // the child has gone Home can't drag them back into the mission.
  let run = 0;
  const later = (ms, fn) => { const tok = run; setTimeout(() => { if (tok === run) fn(); }, ms); };

  // ── Home ──────────────────────────────────────────────────────────────────
  function home() {
    run++;
    UI.screen("home");
    UI.who("");
    const n = nextMission();
    const all = finished() === M.length;
    $("missionKicker").textContent = all ? "All 10 missions done!" : "Mission " + (n + 1) + " of " + M.length;
    $("missionNew").textContent = M[n].letters.join(" ");
    $("missionGo").textContent = all ? "Play it again ›" : finished() || n ? "Start ›" : "Start here ›";
    const stars = store.done.reduce((a, b) => a + b, 0);
    $("starCount").textContent = stars ? "★ " + stars + " of " + M.length * 3 : "";
    UI.map(store.done, all ? -1 : n, mission);
    const known = knownLetters();
    $("letterCount").textContent = known.length + " of 30";
    UI.abc(known, (c) => UI.showLetter(c, exampleFor(c)));
    const won = S.filter((st) => store.stamps[st.place]).length;
    $("stampCount").textContent = won + " of " + S.length;
    UI.passport(S.map((st) => ({ st, state: stampState(st) })), (i) => quizSetup(S[i]));
    const opened = C.filter(cardOpen).length;
    const unseen = C.filter((c) => cardOpen(c) && !store.seen.includes(c.id)).length;
    $("cardCount").textContent = opened
      ? opened + " of " + C.length + " open · " + store.remembered.length + " remembered ✓" + (unseen ? " · " + unseen + " new!" : "")
      : "Famous Bulgarians, big moments and traditions. The first opens after Mission 4.";
    const traps = finished() ? R.trapsKnown(finished() - 1) : [];
    $("trapBtn").disabled = !traps.length;
    $("trapSays").textContent = traps.length
      ? "Letters that look English, but aren't" + (store.trapBest ? " · best " + store.trapBest + "/" + R.TRAP_ROUNDS : "")
      : "Opens after Mission 2";
  }

  // ── History cards ─────────────────────────────────────────────────────────
  const GROUPS = [
    { title: "History", has: (c) => c.topic === "history" },
    { title: "Science and art", has: (c) => c.topic === "science" || c.topic === "art" },
    { title: "Sport", has: (c) => c.topic === "sport" },
    { title: "Traditions", has: (c) => c.topic === "tradition" }
  ];
  function albumView() {
    run++;
    UI.screen("albumScreen", "History cards");
    UI.who("");
    $("albumSays").textContent = "Tap a card to read its story. Answer \"Remember it?\" at the end to earn a ✓. " +
      store.remembered.length + " of " + C.length + " remembered.";
    // Oldest first inside each group, so History reads as a timeline.
    UI.album(GROUPS.map((g) => ({
      title: g.title,
      items: C.filter(g.has).sort((a, b) => (a.year ?? 1e9) - (b.year ?? 1e9)).map((c) => ({
        c, open: cardOpen(c), fresh: cardOpen(c) && !store.seen.includes(c.id), done: store.remembered.includes(c.id)
      }))
    })), (id) => openCard(C.find((c) => c.id === id)));
  }

  let card = null, page = 0, pick;
  function openCard(c) {
    if (!store.seen.includes(c.id)) { store.seen.push(c.id); save(); }
    card = c; page = 0; pick = undefined;
    UI.cardPage(card, page, store.remembered.includes(card.id), pick);
    if (!$("cardDialog").open) $("cardDialog").showModal();
  }
  const turnCard = (to) => {
    page = Math.max(0, Math.min(UI.cardPages(card) - 1, to));
    UI.cardPage(card, page, store.remembered.includes(card.id), pick);
  };
  $("cardBack").addEventListener("click", () => turnCard(page - 1));
  $("cardNext").addEventListener("click", () => {
    if (page === UI.cardPages(card) - 1) return $("cardDialog").close();
    turnCard(page + 1);
  });
  $("cardBody").addEventListener("click", (e) => {
    if (e.target.closest("[data-act=reread]")) { pick = undefined; return turnCard(0); }
    const b = e.target.closest("[data-ans]");
    if (!b || pick !== undefined) return;
    pick = b.dataset.ans;
    if (pick === card.ask[1] && !store.remembered.includes(card.id)) { store.remembered.push(card.id); save(); }
    turnCard(page);
  });
  // Closing a card refreshes whichever list it was opened from, so a new ✓ or
  // a card that is no longer "new" shows straight away.
  $("cardDialog").addEventListener("close", () => {
    if (!$("albumScreen").hidden) albumView();
    else if (!$("home").hidden) home();
  });

  function exampleFor(c) {
    for (const m of M) if (m.examples[c]) return m.examples[c];
    return "";
  }

  // ── A mission ─────────────────────────────────────────────────────────────
  let ctx = null;
  const STEP_RUN = { learn: learnStep, blend: blendStep, match: matchStep, build: buildStep, read: readStep };

  function mission(n) {
    run++;
    ctx = { n, step: 0, right: 0, total: 0 };
    UI.screen("play", "Mission " + (n + 1));
    step();
  }
  function step() {
    run++;
    const s = R.STEPS[ctx.step];
    if (!s) return finish();
    UI.steps(R.STEPS.map((x) => x.label), ctx.step);
    UI.who(s.who);
    window.scrollTo(0, 0);
    STEP_RUN[s.id]();
  }
  const nextStep = () => { ctx.step++; step(); };

  function learnStep() {
    const m = M[ctx.n];
    let i = 0;
    const show = () => {
      const el = UI.learn(m.letters[i], m.examples[m.letters[i]], i, m.letters.length, i === m.letters.length - 1);
      el.onclick = (e) => {
        if (!e.target.closest("[data-act=next]")) return;
        if (++i < m.letters.length) show(); else nextStep();
      };
    };
    show();
  }

  // Tap the row to light the next letter; once they are all lit the whole
  // word glows and the grown-up says whether it was read.
  function blendStep() {
    const items = M[ctx.n].blend;
    const pics = R.pool(ctx.n);
    let i = 0;
    const show = () => {
      const item = items[i];
      const pic = (pics.find((p) => p.w === item) || {}).e;
      let k = 0;
      const el = UI.blend(item, i, items.length);
      el.onclick = (e) => {
        if (e.target.closest("#blendRow")) {
          if (k < item.length) UI.lightBlend(++k, item.length, pic);
          return;
        }
        const act = e.target.closest("[data-act]");
        if (!act) return;
        if (act.dataset.act === "again") return show();
        if (++i < items.length) show(); else nextStep();
      };
    };
    show();
  }

  // Solo steps score: a round counts as right only if the first tap was.
  function score(first) { ctx.total++; if (first) ctx.right++; }

  function matchStep() {
    const rounds = R.matchRounds(ctx.n, Math.random);
    let i = 0;
    const show = () => {
      const r = rounds[i];
      let first = true;
      const el = UI.match(r, i, rounds.length);
      el.onclick = (e) => {
        const t = e.target.closest(".tile");
        if (!t || t.disabled) return;
        const o = r.options[+t.dataset.k];
        if (o.w === r.answer.w) {
          t.classList.add("right");
          el.querySelectorAll(".tile").forEach((b) => { b.disabled = true; });
          score(first);
          later(700, () => { if (++i < rounds.length) show(); else nextStep(); });
        } else {
          first = false;
          t.classList.remove("wrong"); void t.offsetWidth; t.classList.add("wrong");
        }
      };
    };
    show();
  }

  function buildStep() {
    const rounds = R.buildRounds(ctx.n, Math.random);
    let i = 0;
    const show = () => {
      const b = rounds[i];
      const word = b.answer.w;
      let pos = 0, first = true;
      const el = UI.build(b, i, rounds.length);
      const tiles = () => [...$("loose").querySelectorAll(".tile")];
      el.onclick = (e) => {
        if (e.target.closest("[data-act=hint]")) {
          first = false;
          const t = tiles().find((x) => !x.classList.contains("used") && b.tiles[+x.dataset.k] === word[pos]);
          if (t) t.classList.add("glow");
          return;
        }
        const t = e.target.closest(".tile");
        if (!t || t.classList.contains("used") || !el.contains(t) || !$("loose").contains(t)) return;
        if (b.tiles[+t.dataset.k] === word[pos]) {
          t.classList.add("used");
          tiles().forEach((x) => x.classList.remove("glow"));
          UI.fillSlot(pos, word[pos]);
          if (++pos === word.length) {
            score(first);
            UI.toast(first ? "Brilliant! " + word : "You did it! " + word);
            later(900, () => { if (++i < rounds.length) show(); else nextStep(); });
          }
        } else {
          first = false;
          t.classList.remove("wrong"); void t.offsetWidth; t.classList.add("wrong");
        }
      };
    };
    show();
  }

  function readStep() {
    const lines = M[ctx.n].read;
    let i = 0;
    const show = () => {
      const el = UI.read(lines[i], i, lines.length);
      el.onclick = (e) => {
        const w = e.target.closest(".sentence button");
        if (w) { el.querySelectorAll(".sentence button").forEach((b) => b.classList.toggle("on", b === w)); return; }
        const act = e.target.closest("[data-act]");
        if (!act) return;
        if (act.dataset.act === "again") return show();
        if (++i < lines.length) show(); else nextStep();
      };
    };
    show();
  }

  function finish() {
    run++;
    const n = ctx.n;
    const stars = R.stars(ctx.right, ctx.total);
    const firstTime = !store.done[n];
    store.done[n] = Math.max(store.done[n], stars);
    save();
    UI.steps(R.STEPS.map((x) => x.label), R.STEPS.length);
    UI.who("");
    const last = n === M.length - 1;
    const newCards = firstTime ? C.filter((c) => c.m === n) : [];
    const newStamp = firstTime ? S.find((st) => st.m === n) : null;
    const el = UI.stage(
      '<div class="result">' +
      "<h2>Mission " + (n + 1) + " done!</h2>" +
      '<div class="stars" aria-label="' + stars + ' stars">' + UI.starsHtml(stars) + "</div>" +
      "<p>" + ctx.right + " of " + ctx.total + " right first time on your own.</p>" +
      "<p>" + (firstTime ? "New letters:" : "Your letters:") + "</p>" +
      '<div class="got" lang="bg">' + M[n].letters.join(" ") + "</div>" +
      (last ? "<p><b>You know all 30 letters of the Bulgarian alphabet!</b></p>" : "") +
      (newCards.length || newStamp ? "<p><b>You unlocked:</b></p>" : "") +
      '<div class="new-things">' +
      newCards.map((c) => '<button class="small-btn" type="button" data-card="' + c.id + '"><span class="emoji">' + c.e + '</span> <span lang="bg">' + UI.esc(c.name) + "</span></button>").join("") +
      (newStamp ? '<button class="small-btn" type="button" data-stamp="' + S.indexOf(newStamp) + '">🛂 Quiz: <span lang="bg">' + UI.esc(newStamp.place) + "</span></button>" : "") +
      "</div>" +
      (stars < 3 ? '<p class="muted">Play it again for 3 stars.</p>' : "") +
      '<div class="actions">' +
      '<button class="btn ghost" type="button" data-act="home">Home</button>' +
      (last ? "" : '<button class="btn" type="button" data-act="next">Mission ' + (n + 2) + " ›</button>") +
      "</div></div>");
    el.onclick = (e) => {
      const card = e.target.closest("[data-card]");
      if (card) return openCard(C.find((c) => c.id === card.dataset.card));
      const st = e.target.closest("[data-stamp]");
      if (st) return quizSetup(S[+st.dataset.stamp]);
      const a = e.target.closest("[data-act]");
      if (!a) return;
      if (a.dataset.act === "next") mission(n + 1); else home();
    };
  }

  // ── Tricky letters ────────────────────────────────────────────────────────
  function drill() {
    run++;
    const upTo = finished() - 1;
    if (upTo < 0 || !R.trapsKnown(upTo).length) return;
    UI.screen("play", "Tricky letters");
    $("steps").innerHTML = "";
    UI.who("solo");
    const rounds = R.trapRounds(upTo, Math.random);
    let i = 0, right = 0;
    const show = () => {
      const r = rounds[i];
      let first = true;
      const el = UI.trap(r, i, rounds.length);
      el.onclick = (e) => {
        const t = e.target.closest(".tile");
        if (!t || t.disabled) return;
        if (r.options[+t.dataset.k] === r.answer) {
          t.classList.add("right");
          el.querySelectorAll(".tile").forEach((b) => { b.disabled = true; });
          if (first) right++;
          else UI.toast(r.trap.ch + " says " + r.trap.right);
          later(first ? 700 : 1600, () => { if (++i < rounds.length) show(); else done(); });
        } else {
          first = false;
          t.classList.remove("wrong"); void t.offsetWidth; t.classList.add("wrong");
        }
      };
    };
    const done = () => {
      store.trapBest = Math.max(store.trapBest, right);
      save();
      UI.who("");
      const el = UI.stage(
        '<div class="result"><h2>' + (right === rounds.length ? "Not fooled once!" : right + " out of " + rounds.length) + "</h2>" +
        "<p>These letters look English, but they say something else:</p>" +
        '<div class="got" lang="bg">' + R.trapsKnown(upTo).map((t) => t.ch).join(" ") + "</div>" +
        '<div class="actions"><button class="btn ghost" type="button" data-act="home">Home</button>' +
        '<button class="btn" type="button" data-act="again">Play again</button></div></div>');
      el.onclick = (e) => {
        const a = e.target.closest("[data-act]");
        if (!a) return;
        if (a.dataset.act === "again") drill(); else home();
      };
    };
    show();
  }


  // ── Passport quiz ─────────────────────────────────────────────────────────
  let quizFor = null;
  function quizSetup(st) {
    quizFor = st;
    const state = stampState(st);
    $("quizTitle").textContent = "Quiz: " + st.place;
    $("quizStamp").innerHTML = UI.stampHtml(st, state === "open" ? "open" : state);
    $("quizFact").textContent = st.fact + (state === "gold" ? " You have the gold stamp!" : state === "ink" ? " Win it with no help for gold." : "");
    $("quizDialog").showModal();
    UI.fitStamps($("quizStamp"));
  }

  // One or two players answer the same five questions. With two, both have
  // to get all five for the stamp, because the passport belongs to the tablet.
  function quiz(st, players) {
    run++;
    UI.screen("play", st.place);
    $("steps").innerHTML = "";
    UI.who(players > 1 ? "" : "solo");
    const qs = Q.round(st.m, Math.random);
    const results = [];
    const names = players > 1 ? ["Player 1", "Player 2"] : [""];

    const turn = (p) => {
      let i = 0, right = 0, hints = 0;
      const show = () => {
        run++;
        const q = qs[i];
        const el = UI.quizQ(q, i, qs.length, names[p]);
        const tiles = [...el.querySelectorAll(".tile")];
        let used = false, picks = [];
        const next = () => { if (++i < qs.length) show(); else { results.push({ right, hints }); p + 1 < players ? handover(p + 1) : end(); } };
        const settle = (good) => {
          used = true;
          if (good) right++;
          tiles.forEach((t) => { t.disabled = true; });
          if (good) later(900, next); else $("qNext").hidden = false;
        };
        el.onclick = (e) => {
          if (e.target.closest("[data-act=next]")) return next();
          if (e.target.closest("[data-act=hint]")) {
            if (used) return;
            const b = e.target.closest("[data-act=hint]");
            b.disabled = true;
            hints++;
            if (q.kind === "timeline") {
              const oldest = q.cards.findIndex((c) => c.id === q.answer[0]);
              tiles[oldest].classList.add("glow");
            } else if (q.kind === "first") {
              el.querySelectorAll(".yr").forEach((y) => { y.hidden = false; });
            } else {
              const wrong = tiles.filter((t) => q.options[+t.dataset.k] !== q.answer && !t.classList.contains("dim"));
              if (wrong.length) { const t = R.pick(wrong, Math.random); t.classList.add("dim"); t.disabled = true; }
            }
            return;
          }
          const t = e.target.closest(".tile");
          if (!t || t.disabled || used) return;
          const k = +t.dataset.k;
          if (q.kind === "timeline") {
            picks.push(q.cards[k].id);
            UI.numberTile(t, picks.length);
            if (picks.length < 3) return;
            const good = Q.isRight(q, picks);
            // Show the real order and the years either way: that is the lesson.
            tiles.forEach((x, j) => {
              x.classList.add(q.answer[picks.indexOf(q.cards[j].id)] === q.cards[j].id ? "right" : "wrong");
              x.querySelector(".yr").hidden = false;
            });
            if (!good) UI.toast("Oldest first: " + q.answer.map((id) => C.find((c) => c.id === id).name).join(", "));
            return settle(good);
          }
          const pick = q.kind === "first" ? q.cards[k].name : q.options[k];
          const good = Q.isRight(q, pick);
          t.classList.add(good ? "right" : "wrong");
          if (!good) tiles.forEach((x) => {
            const val = q.kind === "first" ? q.cards[+x.dataset.k].name : q.options[+x.dataset.k];
            if (val === q.answer) x.classList.add("right");
          });
          if (q.kind === "first") el.querySelectorAll(".yr").forEach((y) => { y.hidden = false; });
          settle(good);
        };
      };
      show();
    };

    const handover = (p) => {
      run++;
      const el = UI.stage('<div class="result"><div class="emoji big-emoji">🔄</div>' +
        "<h2>" + names[p - 1] + " got " + results[p - 1].right + " of " + qs.length + "</h2>" +
        "<p>Now pass the tablet to <b>" + names[p] + "</b>.</p>" +
        '<div class="actions"><button class="btn" type="button" data-act="go">I\'m ' + names[p] + ", go! ›</button></div></div>");
      el.onclick = (e) => { if (e.target.closest("[data-act=go]")) turn(p); };
    };

    const end = () => {
      run++;
      const right = Math.min(...results.map((r) => r.right));
      const hints = results.reduce((a, r) => a + r.hints, 0);
      const got = Q.stamp(right, hints);
      const had = store.stamps[st.place];
      const better = got && (!had || (had === "ink" && got === "gold"));
      if (better) { store.stamps[st.place] = got; save(); }
      UI.who("");
      const scores = players > 1
        ? '<div class="scores">' + results.map((r, k) => "<div><span>" + names[k] + "</span><b>" + r.right + "</b><small>of " + qs.length + "</small></div>").join("") + "</div>"
        : "<p><b>" + results[0].right + " out of " + qs.length + "</b></p>";
      const msg = got === "gold" ? (better ? "Gold stamp! No help at all." : "Perfect again!")
        : got === "ink" ? (better ? "You won the stamp! Try with no help for gold." : "All right again! No help next time for gold.")
        : players > 1 ? "You both need 5 for the stamp. Try again!"
        : right === qs.length - 1 ? "So close! Try again for the stamp." : "Keep going! Try again for the stamp.";
      const el = UI.stage('<div class="result"><h2>' + UI.esc(st.place) + "</h2>" +
        '<div class="quiz-stamp">' + UI.stampHtml(st, got || stampState(st), better ? "thunk" : "") + "</div>" +
        scores + "<p>" + msg + "</p>" +
        '<div class="actions"><button class="btn ghost" type="button" data-act="home">Home</button>' +
        '<button class="btn" type="button" data-act="again">' + (got === "gold" ? "Play again" : "Try again") + "</button></div></div>");
      UI.fitStamps(el);
      el.onclick = (e) => {
        const a = e.target.closest("[data-act]");
        if (!a) return;
        if (a.dataset.act === "again") quiz(st, players); else home();
      };
    };

    turn(0);
  }

  // ── Wiring ────────────────────────────────────────────────────────────────
  $("missionBtn").addEventListener("click", () => mission(nextMission()));
  $("trapBtn").addEventListener("click", drill);
  $("albumBtn").addEventListener("click", albumView);
  $("toHome").addEventListener("click", home);
  $("quizDialog").addEventListener("click", (e) => {
    const b = e.target.closest("[data-players]");
    if (!b || !quizFor) return;
    $("quizDialog").close();
    quiz(quizFor, +b.dataset.players);
  });
  $("help").addEventListener("click", () => { $("resetYes").hidden = true; $("helpDialog").showModal(); });
  $("resetBtn").addEventListener("click", () => { $("resetYes").hidden = false; });
  $("resetYes").addEventListener("click", () => {
    store = fresh();
    save();
    $("helpDialog").close();
    home();
    UI.toast("Back to Mission 1");
  });
  document.querySelectorAll("dialog").forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  });

  report();
  home();
})();
