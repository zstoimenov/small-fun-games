/* Deal or No Deal — the drawing.                                               */
/*                                                                              */
/* Nothing in here decides anything. It is handed a game and paints it, and the  */
/* one piece of real thinking it does is `fit`: how big a box can be, and how    */
/* many fit across, given the space actually left over after the top bar, the    */
/* rails and the buttons have had theirs.                                        */
/*                                                                              */
/* Twenty-two boxes is an awkward number and there is no good fixed layout for   */
/* it. So the column count isn't fixed: every candidate from two columns up is   */
/* tried, and the one that makes the biggest box wins. A phone in portrait lands */
/* on four or five across, a tablet on six or eight, and neither needed a media  */
/* query to say so.                                                              */
"use strict";
window.DND = window.DND || {};

DND.Ui = (function () {
  const Rules = DND.Rules;
  const $ = (id) => document.getElementById(id);

  /* ── Sizing ────────────────────────────────────────────────────────────── */

  const MIN_CELL = 34;   // below this a finger can't reliably hit one
  const MAX_CELL = 118;

  // Picks the number of columns that makes the boxes biggest in a w × h space,
  // then reports that size. The gap is a fraction of the cell (see the .box-grid
  // rule), so it has to be folded into the arithmetic rather than subtracted
  // once.
  //
  // The cap is applied *after* the choice, not during it, and that distinction
  // is the whole function. Capping first makes every roomy layout tie at
  // MAX_CELL and the first one tried then wins — which on a tall tablet was two
  // columns, drawing a chimney of boxes down the middle with the rails stranded
  // either side. So: if several layouts are big enough to be capped they are all
  // equally good for size, and the widest of them wins on looks; only when
  // nothing reaches the cap does the biggest box win outright.
  function bestLayout(n, w, h) {
    const cand = [];
    for (let cols = 2; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      // cell + gap, where gap = cell * 0.09 → total = cols * cell * 1.09 - gap
      cand.push({ cols, raw: Math.min(w / (cols * 1.09), h / (rows * 1.09)) });
    }
    const capped = cand.filter((c) => c.raw >= MAX_CELL);
    const pick = capped.length
      ? capped[capped.length - 1]
      : cand.reduce((a, b) => (b.raw > a.raw ? b : a));
    return { cols: pick.cols, cell: Math.min(pick.raw, MAX_CELL), raw: pick.raw };
  }

  function fit(game) {
    const wrap = $("boardWrap");
    const grid = $("boxGrid");
    if (!wrap || !grid || !game) return;

    // Rails first: how wide they end up decides how much is left for the board.
    fitRails(game);

    const r = wrap.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) return;   // laid out but not yet sized

    const n = game.values.length;
    const lay = bestLayout(n, r.width - 2, r.height - 2);
    grid.style.setProperty("--n", lay.cols);
    grid.style.setProperty("--cell", Math.max(MIN_CELL, Math.floor(lay.cell)) + "px");
  }

  // A phone on its side has to fit eleven amounts down each rail in about two
  // hundred pixels, which at one per row leaves nine pixels each — money nobody
  // can read. So when a rail gets that cramped it goes to two columns and the
  // amounts get their height back. The text is then sized from the row height
  // that actually resulted, not from the viewport, because it is the row height
  // the words have to fit inside.
  const RAIL_GAP = 3;
  const RAIL_MIN_ROW = 24;

  function fitRails() {
    for (const id of ["railLow", "railHigh"]) {
      const rail = $(id);
      const count = rail.children.length;
      if (!count) continue;
      const h = rail.getBoundingClientRect().height;
      if (h < 20) continue;

      const cols = h / count < RAIL_MIN_ROW ? 2 : 1;
      const rows = Math.ceil(count / cols);
      const each = (h - (rows - 1) * RAIL_GAP) / rows;
      rail.style.setProperty("--rail-cols", cols);
      rail.style.setProperty("--rail-rows", rows);
      rail.style.setProperty("--rail-fs",
        Math.max(8, Math.min(14, Math.floor(each * 0.5))) + "px");
    }
  }

  /* ── The boxes ─────────────────────────────────────────────────────────── */

  // Built once per game. Repainting only ever changes classes and text, so a box
  // keeps its identity — and its animation — across a repaint.
  function buildBoxes(game, onTap) {
    const grid = $("boxGrid");
    grid.innerHTML = "";
    for (let i = 0; i < game.values.length; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "box";
      b.dataset.i = String(i);
      b.addEventListener("click", () => onTap(i));
      grid.appendChild(b);
    }
  }

  // `aim` is the box the player has tapped once and not yet confirmed. Two taps
  // to open, so a mis-tap never costs a box — the same bargain Battleship makes
  // before it fires a shell. `locked` is on while it is Robo's go or a box is
  // mid-flourish, and it only ever takes taps away.
  //
  // `opening` is the box that has been committed to but not yet opened. It is
  // still drawn as a sealed box wearing its own number, because at that moment
  // nothing on the page knows what is inside it — app.js has not called
  // Rules.open yet.
  function paintBoxes(game, aim, locked, opening) {
    const grid = $("boxGrid");
    const kids = grid.children;
    for (let i = 0; i < kids.length; i++) {
      const b = kids[i];
      const open = game.opened[i];
      const mine = i === game.held;
      b.className = "box" +
        (open ? " open" : "") +
        (mine && !open ? " mine" : "") +
        (opening === i && !open ? " opening" : "") +
        (aim === i && !open ? " aim" : "") +
        (open && game.values[i] >= bigMoney(game) ? " big" : "");
      b.textContent = open ? Rules.moneyShort(game.values[i]) : String(i + 1);
      b.disabled = !!locked ||
        (game.phase === "pick" ? open : !Rules.canOpen(game, i));
      b.setAttribute("aria-label", open
        ? "Box " + (i + 1) + " held " + Rules.money(game.values[i])
        : "Box " + (i + 1) + (mine ? ", yours" : ""));
    }
  }

  // "Big" is the top third of the ladder — the ones worth groaning about when
  // they come out. Worked out from the board rather than written down, so the
  // 10-box game gets its own idea of a big number.
  function bigMoney(game) {
    const l = game.spec.ladder;
    return l[Math.floor(l.length * 0.66)];
  }

  function pop(i) {
    const b = $("boxGrid").children[i];
    if (!b) return;
    b.classList.remove("pop");
    void b.offsetWidth;          // restart the animation rather than skip it
    b.classList.add("pop");
  }

  /* ── The money rails ───────────────────────────────────────────────────── */

  // Small change down the left, big money down the right, as on the programme.
  // An odd-sized ladder puts the extra one on the left, where it matters least.
  function buildRails(game) {
    const l = game.spec.ladder;
    const half = Math.ceil(l.length / 2);
    for (const [id, from, to] of [["railLow", 0, half], ["railHigh", half, l.length]]) {
      const rail = $(id);
      rail.innerHTML = "";
      // The right-hand rail runs biggest at the top, which is how everyone
      // reads a prize board.
      const idx = [];
      for (let k = from; k < to; k++) idx.push(k);
      if (id === "railHigh") idx.reverse();
      for (const k of idx) {
        const item = document.createElement("div");
        item.className = "rail-item";
        item.dataset.v = String(l[k]);
        item.textContent = Rules.money(l[k]);
        rail.appendChild(item);
      }
    }
  }

  // `justGone` is the value opened a moment ago, so it can be struck out with a
  // flourish rather than silently.
  function paintRails(game, justGone) {
    const live = new Set(Rules.remainingValues(game));
    for (const rail of [$("railLow"), $("railHigh")]) {
      for (const item of rail.children) {
        const v = Number(item.dataset.v);
        const gone = !live.has(v);
        item.classList.toggle("gone", gone);
        item.classList.toggle("just-gone", gone && v === justGone);
      }
    }
  }

  /* ── The Banker's working ──────────────────────────────────────────────── */

  // Three lines and a bar. The bar is the offer against the average, because
  // "is this more or less than half" is the whole game and a number in a table
  // does not say it as fast as a picture does.
  function working(t) {
    const m = Rules.money;
    const pct = Math.round(t.ratio * 100);
    const rows = [
      ["Boxes still sealed", String(t.count)],
      ["They average", m(Math.round(t.ev))],
      ["Biggest one left", m(t.high)],
      ["The Banker offers", m(t.cents)]
    ];
    let html = rows.map(([a, b]) =>
      '<div class="work-row"><span>' + a + '</span><span>' + b + "</span></div>").join("");
    html += '<div class="work-bar"><i style="width:' + Math.min(100, pct) + '%"></i></div>';
    html += '<p class="work-cap">That\'s <b>' + pct + "%</b> of the average. " +
      (t.round >= t.rounds
        ? "Last call — the Banker pays nearly the full whack at the end."
        : "He gets more generous every round, so there's a bigger one coming — " +
          "if the big money survives.") + "</p>";
    return html;
  }

  /* ── Odds and ends ─────────────────────────────────────────────────────── */

  function coach(html, tone) {
    const el = $("coach");
    el.className = "coach " + (tone || "calm");
    el.innerHTML = '<span class="coach-face">' +
      (tone === "warn" ? "😬" : tone === "good" ? "🎉" : "💼") + "</span><span>" + html + "</span>";
    el.hidden = false;
  }

  let toastTimer = null;
  function toast(html, ms) {
    const el = $("toast");
    el.innerHTML = html;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms || 2200);
  }
  function clearToast() {
    clearTimeout(toastTimer);
    $("toast").hidden = true;
  }

  const COLOURS = ["#c8a021", "#c01523", "#e0651c", "#1f7a4d", "#f0d79a"];
  function confetti(n) {
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    for (let i = 0; i < (n || 46); i++) {
      const bit = document.createElement("i");
      bit.style.left = Math.random() * 100 + "vw";
      bit.style.background = COLOURS[i % COLOURS.length];
      bit.style.animationDuration = (1.5 + Math.random() * 1.3) + "s";
      bit.style.animationDelay = (Math.random() * 0.5) + "s";
      wrap.appendChild(bit);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 3600);
  }

  // One resize hook for the whole app, debounced onto an animation frame — a
  // rotating tablet fires resize a great many times on the way round.
  let raf = 0;
  function onResize(fn) {
    const go = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fn);
    };
    window.addEventListener("resize", go);
    window.addEventListener("orientationchange", go);
  }

  return {
    fit, bestLayout, buildBoxes, paintBoxes, bigMoney, pop,
    buildRails, paintRails, working,
    coach, toast, clearToast, confetti, onResize
  };
})();
