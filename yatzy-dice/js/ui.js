/* Yatzy Dice — everything that draws.                                          */
/*                                                                              */
/* app.js owns the game state and hands a finished picture of it to the render   */
/* functions here; this file never decides anything about the rules. Dice are    */
/* drawn as pips in a 3x3 grid rather than emoji so they stay crisp and can be   */
/* animated, and the same die element is reused by the tutorial so the pictures  */
/* in the lesson are literally the pictures in the game.                         */
"use strict";
window.YZ = window.YZ || {};

YZ.Ui = (function () {
  const Rules = YZ.Rules;
  const $ = (id) => document.getElementById(id);

  const on = {};   // callbacks supplied by app.js
  const el = {};   // cached elements

  /* ── Dice ──────────────────────────────────────────────────────────────── */

  // Which cells of a 3x3 grid carry a pip, for each face.
  const PIPS = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  };

  function setDie(node, value) {
    if (node.dataset.v === String(value)) return;
    node.dataset.v = value;
    node.innerHTML = "";
    for (const cell of PIPS[value] || []) {
      const pip = document.createElement("i");
      pip.className = "pip";
      pip.style.gridRow = Math.ceil(cell / 3);
      pip.style.gridColumn = ((cell - 1) % 3) + 1;
      node.appendChild(pip);
    }
    node.setAttribute("aria-label", value + "");
  }

  // Used by the game, the tutorial and the help popovers.
  function dieEl(value, cls) {
    const d = document.createElement("div");
    d.className = "die" + (cls ? " " + cls : "");
    setDie(d, value);
    return d;
  }

  function diceStrip(values, cls) {
    const wrap = document.createElement("div");
    wrap.className = "dice-strip";
    for (const v of values) wrap.appendChild(dieEl(v, cls));
    return wrap;
  }

  /* ── The five dice in play ─────────────────────────────────────────────── */

  function renderDice(dice, held, opts) {
    opts = opts || {};
    const row = el.diceRow;
    while (row.children.length < 5) {
      const d = document.createElement("button");
      d.className = "die die-btn";
      d.type = "button";
      d.dataset.i = row.children.length;
      row.appendChild(d);
    }
    for (let i = 0; i < 5; i++) {
      const node = row.children[i];
      const v = dice && dice.length === 5 ? dice[i] : 0;
      if (v) setDie(node, v);
      node.classList.toggle("empty", !v);
      node.classList.toggle("held", !!(held && held[i]));
      node.disabled = !opts.canHold;
      if (v) node.title = held && held[i] ? "Keeping this one — tap to let it go" : "Tap to keep this one";
    }
  }

  // The tumble is decoration: the real faces were decided by rng.js before this
  // was ever called, and nothing here can change them.
  function animateRoll(held, finalDice, done) {
    const row = el.diceRow;
    const nodes = Array.prototype.slice.call(row.children);
    const DUR = 620;
    const start = performance.now();
    for (let i = 0; i < 5; i++) if (!held[i]) nodes[i].classList.add("rolling");

    function frame(now) {
      if (now - start >= DUR) {
        for (const n of nodes) n.classList.remove("rolling");
        renderDice(finalDice, held, { canHold: true });
        if (done) done();
        return;
      }
      for (let i = 0; i < 5; i++) {
        // Math.random is fine here — these faces are thrown away, they are just
        // the blur of a die in the air.
        if (!held[i]) setDie(nodes[i], 1 + Math.floor(Math.random() * 6));
      }
      setTimeout(() => requestAnimationFrame(frame), 55);
    }
    requestAnimationFrame(frame);
  }

  /* ── Scorecard ─────────────────────────────────────────────────────────── */

  function cellText(v) {
    return v === null || v === undefined ? "" : String(v);
  }

  // One table: a row per box, a column per player, plus the running totals.
  // state.preview (set by app.js) is what the dice on the table would score for
  // the player whose turn it is — that is what makes the card tappable.
  function renderScorecard(state) {
    const ruleset = Rules.get(state.rulesetId);
    const table = el.scorecard;
    table.innerHTML = "";
    const preview = state.preview;

    const head = document.createElement("thead");
    const hr = document.createElement("tr");
    hr.appendChild(th(""));
    state.players.forEach((p, i) => {
      const c = th(p.name);
      c.className = "player-col" + (i === state.turn ? " active" : "");
      if (p.kind === "cpu") c.classList.add("cpu");
      hr.appendChild(c);
    });
    head.appendChild(hr);
    table.appendChild(head);

    const body = document.createElement("tbody");
    const upper = ruleset.categories.filter((c) => c.section === "upper");
    const lower = ruleset.categories.filter((c) => c.section === "lower");

    body.appendChild(sectionRow("Top half", state.players.length));
    for (const cat of upper) body.appendChild(categoryRow(cat, state, ruleset, preview));

    body.appendChild(totalRow("Top total", state, (t) => t.upper, "sub"));
    body.appendChild(bonusRow(state, ruleset));

    body.appendChild(sectionRow("Bottom half", state.players.length));
    for (const cat of lower) body.appendChild(categoryRow(cat, state, ruleset, preview));

    if (ruleset.extraBonus) body.appendChild(extraRow(state, ruleset));

    body.appendChild(totalRow("TOTAL", state, (t) => t.total, "grand"));
    table.appendChild(body);
  }

  function th(text) {
    const c = document.createElement("th");
    c.textContent = text;
    return c;
  }

  function sectionRow(label, cols) {
    const tr = document.createElement("tr");
    tr.className = "section-row";
    const c = document.createElement("td");
    c.textContent = label;
    c.colSpan = cols + 1;
    tr.appendChild(c);
    return tr;
  }

  function categoryRow(cat, state, ruleset, preview) {
    const tr = document.createElement("tr");
    tr.className = "cat-row";

    // The name is its own tap target: that's the in-game rules reference.
    const name = document.createElement("th");
    name.className = "cat-name";
    name.scope = "row";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-help";
    btn.innerHTML = cat.label + " <span class='qmark'>?</span>";
    btn.addEventListener("click", () => on.catHelp && on.catHelp(cat.id));
    name.appendChild(btn);
    tr.appendChild(name);

    state.players.forEach((p, pi) => {
      const td = document.createElement("td");
      td.className = "cell";
      const scored = p.card.scores[cat.id];
      const isTurn = pi === state.turn;

      if (scored !== null && scored !== undefined) {
        td.textContent = cellText(scored);
        td.classList.add("filled");
        if (scored === 0) td.classList.add("zeroed");
        if (p.card.manual[cat.id]) {
          td.classList.add("manual");
          td.title = "Typed in by hand";
        }
      } else if (isTurn && preview && preview.scores) {
        const v = preview.scores[cat.id];
        const legal = preview.legal.indexOf(cat.id) >= 0;
        if (!legal) {
          td.classList.add("locked");
          td.textContent = "–";
          td.title = "The joker rule says this hand has to go somewhere else";
        } else if (state.canPick) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "pick" + (v === 0 ? " zero" : "") + (preview.best === cat.id ? " best" : "");
          b.textContent = v;
          b.title = preview.best === cat.id
            ? "Our pick — " + v + " in " + cat.label
            : v + " in " + cat.label;
          b.addEventListener("click", () => on.pick && on.pick(cat.id));
          td.appendChild(b);
          td.classList.add("pickable");
        } else {
          td.textContent = "";
        }
      } else if (isTurn && state.entryMode === "type" && state.mode === "card" && state.canPick) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pick type";
        b.textContent = "✏️";
        b.addEventListener("click", () => on.typeScore && on.typeScore(cat.id));
        td.appendChild(b);
        td.classList.add("pickable");
      }
      tr.appendChild(td);
    });
    return tr;
  }

  function totalRow(label, state, pick, cls) {
    const ruleset = Rules.get(state.rulesetId);
    const tr = document.createElement("tr");
    tr.className = "total-row " + cls;
    const name = document.createElement("th");
    name.textContent = label;
    name.scope = "row";
    tr.appendChild(name);
    for (const p of state.players) {
      const td = document.createElement("td");
      td.textContent = pick(Rules.totals(ruleset, p.card));
      tr.appendChild(td);
    }
    return tr;
  }

  function bonusRow(state, ruleset) {
    const tr = document.createElement("tr");
    tr.className = "total-row sub bonus-row";
    const name = document.createElement("th");
    name.scope = "row";
    name.innerHTML = "Bonus <span class='muted'>" + ruleset.upperBonus.threshold +
      " → +" + ruleset.upperBonus.points + "</span>";
    tr.appendChild(name);
    for (const p of state.players) {
      const t = Rules.totals(ruleset, p.card);
      const td = document.createElement("td");
      if (t.bonus) {
        td.textContent = "+" + t.bonus;
        td.className = "got-bonus";
      } else {
        td.innerHTML = "<span class='muted'>" + t.bonusNeeded + " to go</span>";
      }
      tr.appendChild(td);
    }
    return tr;
  }

  function extraRow(state, ruleset) {
    const tr = document.createElement("tr");
    tr.className = "total-row sub";
    const name = document.createElement("th");
    name.scope = "row";
    name.innerHTML = "Extra " + ruleset.topName + " <span class='muted'>+" +
      ruleset.extraBonus.points + " each</span>";
    tr.appendChild(name);
    for (const p of state.players) {
      const td = document.createElement("td");
      const t = Rules.totals(ruleset, p.card);
      td.textContent = t.extra ? "+" + t.extra : "";
      if (t.extra) td.className = "got-bonus";
      tr.appendChild(td);
    }
    return tr;
  }

  /* ── Turn header, buttons, hints ───────────────────────────────────────── */

  function renderTurn(state) {
    const ruleset = Rules.get(state.rulesetId);
    const p = state.players[state.turn];
    const done = ruleset.categories.length - Rules.openCategories(ruleset, p.card).length;

    el.turnName.textContent = state.guided ? "Practice turn" : p.name;
    el.turnName.classList.toggle("cpu", p.kind === "cpu");
    el.turnMeta.textContent = state.guided
      ? "Nothing is being scored"
      : "Round " + Math.min(done + 1, ruleset.categories.length) +
        " of " + ruleset.categories.length + " · " + ruleset.name;

    const playMode = state.mode === "play";
    el.diceArea.hidden = !playMode;
    el.entryArea.hidden = playMode;

    if (playMode) {
      renderDice(state.dice, state.held, { canHold: state.canHold });
      el.rollBtn.hidden = state.rollsLeft <= 0 || p.kind === "cpu";
      el.rollBtn.disabled = !!state.busy;
      el.rollLabel.textContent = state.rollsLeft === 3 ? "ROLL THE DICE" : "ROLL AGAIN";
      el.rollsLeft.textContent = state.rollsLeft + " left";
      el.diceHint.textContent = diceHint(state, p);
    } else {
      renderEntry(state);
    }
  }

  function diceHint(state, p) {
    if (p.kind === "cpu") return state.busy ? "🤖 " + p.name + " is thinking…" : "🤖 " + p.name + "'s turn";
    if (state.rollsLeft === 3) return "Three rolls a turn. Off you go!";
    if (state.rollsLeft === 0) return "Last roll — pick a box to score in.";
    return "Tap the dice you want to keep, then roll again.";
  }

  /* ── Scorecard-only entry ──────────────────────────────────────────────── */

  function renderEntry(state) {
    el.entryDice.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const v = state.dice[i];
      const d = document.createElement("button");
      d.type = "button";
      d.className = "die die-btn" + (v ? "" : " empty");
      if (v) setDie(d, v);
      d.addEventListener("click", () => on.unsetEntry && on.unsetEntry(i));
      el.entryDice.appendChild(d);
    }
    el.entryTitle.textContent = state.entryMode === "type"
      ? "Tap a box below and type the score"
      : "Tap in the five dice you rolled";
    el.keypad.hidden = state.entryMode === "type";
    el.entryClear.hidden = state.entryMode === "type" || state.dice.length === 0;
    el.entryToggle.textContent = state.entryMode === "type" ? "🎲 Use dice instead" : "✏️ Type scores instead";
  }

  function buildKeypad() {
    el.keypad.innerHTML = "";
    for (let v = 1; v <= 6; v++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "key";
      b.appendChild(dieEl(v, "mini"));
      b.addEventListener("click", () => on.addEntry && on.addEntry(v));
      el.keypad.appendChild(b);
    }
  }

  /* ── Overlays, toasts, celebration ─────────────────────────────────────── */

  function showScreen(name) {
    el.setup.hidden = name !== "setup";
    el.game.hidden = name !== "game";
    document.body.classList.toggle("in-game", name === "game");
  }

  let toastTimer = null;
  function toast(msg, ms) {
    el.toast.innerHTML = msg;
    el.toast.hidden = false;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
      setTimeout(() => { el.toast.hidden = true; }, 260);
    }, ms || 1800);
  }

  function coach(msg) {
    if (!msg) {
      el.coach.hidden = true;
      return;
    }
    el.coach.innerHTML = "<span class='coach-face'>🎓</span><span>" + msg + "</span>";
    el.coach.hidden = false;
  }

  function confetti() {
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    const colors = ["#f45b69", "#ffc23d", "#4bc8ff", "#6c4cf0", "#3ddc68"];
    for (let i = 0; i < 40; i++) {
      const bit = document.createElement("i");
      bit.style.left = Math.random() * 100 + "%";
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = Math.random() * 0.5 + "s";
      bit.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      wrap.appendChild(bit);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 2600);
  }

  /* ── Result screen ─────────────────────────────────────────────────────── */

  function showResult(state) {
    const ruleset = Rules.get(state.rulesetId);
    const rows = state.players
      .map((p) => ({ p: p, t: Rules.totals(ruleset, p.card) }))
      .sort((a, b) => b.t.total - a.t.total);

    const top = rows[0].t.total;
    const winners = rows.filter((r) => r.t.total === top);

    el.resultTitle.textContent = winners.length > 1
      ? "It's a tie!"
      : (winners[0].p.kind === "cpu" ? winners[0].p.name + " wins" : winners[0].p.name + " wins! 🎉");
    el.resultIcon.textContent = winners.length > 1 ? "🤝" : "🏆";

    el.resultTable.innerHTML = "";
    for (const r of rows) {
      const row = document.createElement("div");
      row.className = "result-row" + (r.t.total === top ? " winner" : "");
      row.innerHTML =
        "<span class='rname'>" + (r.p.kind === "cpu" ? "🤖 " : "") + r.p.name + "</span>" +
        "<span class='rbits'>top " + r.t.upper + (r.t.bonus ? " +" + r.t.bonus : "") +
        " · bottom " + r.t.lower + (r.t.extra ? " +" + r.t.extra : "") + "</span>" +
        "<span class='rtotal'>" + r.t.total + "</span>";
      el.resultTable.appendChild(row);
    }
    el.result.hidden = false;
    if (winners.some((w) => w.p.kind !== "cpu")) confetti();
  }

  /* ── Category help popover ─────────────────────────────────────────────── */

  function showHelp(catId, rulesetId) {
    const ruleset = Rules.get(rulesetId);
    const cat = Rules.categoryById(ruleset, catId);
    if (!cat) return;
    el.helpTitle.textContent = cat.label;
    el.helpText.textContent = cat.hint;
    el.helpDice.innerHTML = "";
    el.helpDice.appendChild(diceStrip(cat.example, "mini"));
    const worth = cat.score(cat.example);
    el.helpScore.textContent = "That hand scores " + worth + ".";
    el.help.hidden = false;
  }

  /* ── Wiring ────────────────────────────────────────────────────────────── */

  function cache() {
    const ids = [
      "setup", "game", "result", "help", "toast", "coach",
      "diceArea", "diceRow", "diceHint", "rollBtn", "rollLabel", "rollsLeft",
      "entryArea", "entryDice", "entryTitle", "entryClear", "entryToggle", "keypad",
      "scorecard", "turnName", "turnMeta",
      "resultTitle", "resultIcon", "resultTable",
      "helpTitle", "helpText", "helpDice", "helpScore"
    ];
    for (const id of ids) el[id] = $(id);
  }

  function wire() {
    el.diceRow.addEventListener("click", (e) => {
      const b = e.target.closest(".die-btn");
      if (b && !b.disabled && on.hold) on.hold(+b.dataset.i);
    });
    el.rollBtn.addEventListener("click", () => on.roll && on.roll());
    el.entryClear.addEventListener("click", () => on.clearEntry && on.clearEntry());
    el.entryToggle.addEventListener("click", () => on.toggleEntry && on.toggleEntry());
    buildKeypad();
  }

  function init(handlers) {
    Object.assign(on, handlers);
    cache();
    wire();
  }

  return {
    init, el, dieEl, diceStrip, setDie,
    renderDice, animateRoll, renderScorecard, renderTurn, renderEntry,
    showScreen, toast, coach, confetti, showResult, showHelp
  };
})();
