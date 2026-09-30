/* Буквар Quest - the glue: progress, the five mission steps, tricky letters.   */
"use strict";
(function () {
  const L = BQ.Letters;
  const M = BQ.MISSIONS;
  const R = BQ.Rules;
  const UI = BQ.UI;
  const $ = UI.$;
  const KEY = "bukvar-quest";

  // ── Saved state ───────────────────────────────────────────────────────────
  // done[i] is the best stars for mission i, 0 if it has never been finished.
  const fresh = () => ({ done: M.map(() => 0), trapBest: 0 });
  let store = fresh();
  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode or junk */ }
  store.done = M.map((_, i) => +store.done[i] || 0);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } };

  const finished = () => store.done.filter((s) => s > 0).length;
  const nextMission = () => { const i = store.done.findIndex((s) => !s); return i < 0 ? M.length - 1 : i; };
  // Letters from finished missions only: a letter half-way through its first
  // mission isn't "yours" yet.
  const knownLetters = () => (finished() ? R.known(finished() - 1) : []);

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
    const traps = finished() ? R.trapsKnown(finished() - 1) : [];
    $("trapBtn").disabled = !traps.length;
    $("trapSays").textContent = traps.length
      ? "Letters that look English, but aren't" + (store.trapBest ? " · best " + store.trapBest + "/" + R.TRAP_ROUNDS : "")
      : "Opens after Mission 2";
  }

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
    const el = UI.stage(
      '<div class="result">' +
      "<h2>Mission " + (n + 1) + " done!</h2>" +
      '<div class="stars" aria-label="' + stars + ' stars">' + UI.starsHtml(stars) + "</div>" +
      "<p>" + ctx.right + " of " + ctx.total + " right first time on your own.</p>" +
      "<p>" + (firstTime ? "New letters:" : "Your letters:") + "</p>" +
      '<div class="got" lang="bg">' + M[n].letters.join(" ") + "</div>" +
      (last ? "<p><b>You know all 30 letters of the Bulgarian alphabet!</b></p>" : "") +
      (stars < 3 ? '<p class="muted">Play it again for 3 stars.</p>' : "") +
      '<div class="actions">' +
      '<button class="btn ghost" type="button" data-act="home">Home</button>' +
      (last ? "" : '<button class="btn" type="button" data-act="next">Mission ' + (n + 2) + " ›</button>") +
      "</div></div>");
    el.onclick = (e) => {
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

  // ── Wiring ────────────────────────────────────────────────────────────────
  $("missionBtn").addEventListener("click", () => mission(nextMission()));
  $("trapBtn").addEventListener("click", drill);
  $("toHome").addEventListener("click", home);
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

  home();
})();
