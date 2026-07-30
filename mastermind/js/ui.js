/* Mastermind — everything that draws.                                          */
/*                                                                              */
/* app.js owns the game and hands finished decisions down here; this file never  */
/* works out what a guess scored or whose go it is. It does own one thing        */
/* outright: how big a peg is. The rows have to fit the screen without the page  */
/* scrolling, and the number of rows changes with the puzzle size, so fit()      */
/* measures the space and sets a single --peg that everything else is drawn from.*/
"use strict";
window.MM = window.MM || {};

MM.Ui = (function () {
  const Rules = MM.Rules;
  const $ = (id) => document.getElementById(id);

  const el = {};
  let rows = [];          // rows[i] = { line, slots[], marks[] }
  let swatches = [];
  let spec = null;
  let wired = false;

  const reduced = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Pegs ──────────────────────────────────────────────────────────────── */

  // One peg, used everywhere: in a row, in the palette, in the lesson, on the
  // result sheet. colour < 0 draws the empty socket.
  function peg(colour, cls) {
    const p = document.createElement("span");
    p.className = "peg" + (colour >= 0 ? " c" + colour : "") + (cls ? " " + cls : "");
    if (colour >= 0) {
      const glyph = document.createElement("i");
      glyph.textContent = Rules.COLOUR_SHAPES[colour];
      p.appendChild(glyph);
      p.setAttribute("aria-label", Rules.COLOUR_NAMES[colour]);
    }
    return p;
  }

  function fillPeg(node, colour) {
    node.className = "peg" + (colour >= 0 ? " c" + colour : "");
    node.innerHTML = "";
    if (colour >= 0) {
      const glyph = document.createElement("i");
      glyph.textContent = Rules.COLOUR_SHAPES[colour];
      node.appendChild(glyph);
    }
  }

  /* ── Building the board ────────────────────────────────────────────────── */

  function build(gameSpec, onSlot, onColour) {
    spec = gameSpec;
    el.board = $("board");
    el.boardWrap = $("boardWrap");
    el.palette = $("palette");
    el.coach = $("coach");
    el.toast = $("toast");

    el.board.innerHTML = "";
    el.board.style.setProperty("--pegs", String(spec.pegs));
    // Feedback pegs sit in two rows, so five of them need three columns.
    el.board.style.setProperty("--markcols", String(Math.ceil(spec.pegs / 2)));
    rows = [];

    for (let i = 0; i < spec.guesses; i++) {
      const line = document.createElement("div");
      line.className = "guess-row";

      const num = document.createElement("span");
      num.className = "rownum";
      num.textContent = String(i + 1);
      line.appendChild(num);

      const pegs = document.createElement("div");
      pegs.className = "pegs";
      const slots = [];
      for (let p = 0; p < spec.pegs; p++) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "slot";
        slot.disabled = true;
        slot.setAttribute("aria-label", "Slot " + (p + 1));
        slot.appendChild(peg(-1));
        const at = p;
        slot.addEventListener("click", () => onSlot(at));
        pegs.appendChild(slot);
        slots.push(slot);
      }
      line.appendChild(pegs);

      const markBox = document.createElement("div");
      markBox.className = "marks";
      const marks = [];
      for (let p = 0; p < spec.pegs; p++) {
        const m = document.createElement("span");
        m.className = "mark";
        markBox.appendChild(m);
        marks.push(m);
      }
      line.appendChild(markBox);

      el.board.appendChild(line);
      rows.push({ line, slots, marks });
    }

    el.palette.innerHTML = "";
    swatches = [];
    for (let c = 0; c < Rules.COLOURS; c++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.title = Rules.COLOUR_NAMES[c];
      b.setAttribute("aria-label", Rules.COLOUR_NAMES[c]);
      b.appendChild(peg(c));
      b.addEventListener("click", () => onColour(c));
      el.palette.appendChild(b);
      swatches.push(b);
    }

    // Once only: build() runs again for every new game, and a fresh pair of
    // listeners each time would have fit() firing a dozen times per resize.
    if (!wired) {
      addEventListener("resize", fit);
      addEventListener("orientationchange", fit);
      wired = true;
    }
    fit();
  }

  // The board is a fixed number of rows of fixed proportions, so rather than
  // restate those proportions here — where they could quietly drift from the
  // stylesheet — set a peg size, measure what the board actually became, and
  // scale by however far off it was. It has to grow as well as shrink: the same
  // markup holds twelve rows on a phone and ten on a tablet, and a board that
  // only ever shrank left two thirds of a tablet screen empty.
  //
  // Two corrections, because height is very nearly but not exactly linear in
  // --peg: the row borders don't scale with it.
  const MAX_PEG = 64;
  const MIN_PEG = 18;   // below this the pegs stop being tellable apart

  function fit() {
    if (!el.boardWrap || !el.boardWrap.getClientRects().length) return;
    const box = el.boardWrap.getBoundingClientRect();
    const availW = Math.max(80, box.width - 8);
    const availH = Math.max(80, box.height - 8);

    let size = 0;
    const apply = (v) => {
      size = Math.max(MIN_PEG, Math.min(MAX_PEG, Math.floor(v)));
      el.board.style.setProperty("--peg", size + "px");
    };

    apply(40);
    for (let pass = 0; pass < 2; pass++) {
      const byH = (size * availH) / el.board.offsetHeight;
      const byW = (size * availW) / el.board.offsetWidth;
      apply(Math.min(byH, byW));
    }
    // A floor, not a hard minimum: a phone on its side genuinely hasn't the
    // height for ten rows. Below MIN_PEG the wrap scrolls instead, and
    // scrollToCurrent keeps the live row in the middle of it.
  }

  /* ── Drawing a position ────────────────────────────────────────────────── */

  // Repaints every row from the game. There is no incremental path: a whole
  // repaint is a few dozen elements, and an undo or a restored save has no
  // single row to animate anyway.
  function paint(game, draft, slot, active) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const played = game.rows[i];
      const isCurrent = active && i === game.rows.length;

      row.line.classList.toggle("done", !!played);
      row.line.classList.toggle("current", isCurrent);

      for (let p = 0; p < spec.pegs; p++) {
        const colour = played ? played.code[p] : (isCurrent ? draft[p] : -1);
        fillPeg(row.slots[p].firstChild, colour === null || colour === undefined ? -1 : colour);
        row.slots[p].disabled = !isCurrent;
        row.slots[p].classList.toggle("sel", isCurrent && p === slot);
      }

      for (let p = 0; p < spec.pegs; p++) {
        const m = row.marks[p];
        m.className = "mark" +
          (played ? (p < played.black ? " black" : p < played.black + played.white ? " white" : "") : "");
      }
    }
    scrollToCurrent(game);
  }

  // Keeps the row being filled in view. The board only scrolls when the puzzle
  // has more rows than the screen can hold, which is a short phone in landscape.
  function scrollToCurrent(game) {
    const row = rows[Math.min(game.rows.length, rows.length - 1)];
    if (!row || !el.boardWrap) return;
    const wrap = el.boardWrap;
    if (wrap.scrollHeight <= wrap.clientHeight + 2) return;
    const top = row.line.offsetTop - wrap.clientHeight / 2 + row.line.offsetHeight / 2;
    wrap.scrollTo({ top: Math.max(0, top), behavior: reduced() ? "auto" : "smooth" });
  }

  // The pegs landing on a row that has just been played.
  function markRow(i) {
    const row = rows[i];
    if (!row || reduced()) return;
    row.line.classList.remove("landed");
    void row.line.offsetWidth;
    row.line.classList.add("landed");
  }

  // Points at the current row without playing it — the hint button's job, once
  // it has dropped its suggestion into the slots.
  function nudge(i) {
    const row = rows[i];
    if (!row) return;
    row.line.classList.remove("nudge");
    void row.line.offsetWidth;
    row.line.classList.add("nudge");
    setTimeout(() => row.line.classList.remove("nudge"), 1600);
  }

  function markWin(i) {
    el.board.classList.add("settled");
    if (rows[i]) rows[i].line.classList.add("win");
  }

  function clearWin() {
    el.board.classList.remove("settled");
    for (const r of rows) r.line.classList.remove("win", "landed");
  }

  /* ── The palette ───────────────────────────────────────────────────────── */

  // `blocked` is the set of colours already in the row being built, and is only
  // non-empty when the puzzle forbids repeats.
  function setPalette(on, blocked) {
    el.palette.hidden = !on;
    for (let c = 0; c < swatches.length; c++) {
      swatches[c].disabled = !on || (blocked ? blocked.has(c) : false);
    }
  }

  /* ── The line above the board ──────────────────────────────────────────── */

  // Refits afterwards: a warning that wraps onto two lines takes height away
  // from the rows, and the peg size is a number in a style attribute, not
  // something CSS will re-derive on its own.
  function coach(html, kind) {
    el.coach.innerHTML = html;
    el.coach.className = "coach" + (kind ? " " + kind : "");
    el.coach.hidden = false;
    fit();
  }

  /* ── Toast and confetti ────────────────────────────────────────────────── */

  let toastTimer = null;

  function clearToast() {
    clearTimeout(toastTimer);
    if (!el.toast) return;
    el.toast.classList.remove("show");
    el.toast.hidden = true;
  }

  function toast(msg, ms) {
    el.toast.innerHTML = msg;
    el.toast.hidden = false;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
      setTimeout(() => { el.toast.hidden = true; }, 260);
    }, ms || 1900);
  }

  function confetti() {
    if (reduced()) return;
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    const colors = ["#e8483f", "#ffc93c", "#35c46a", "#3d8bff", "#a06cf0", "#ff6fb5"];
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

  /* ── Rows outside the board ────────────────────────────────────────────── */

  // A read-only row of pegs, with feedback if it's given. Used by the lesson and
  // by the result sheet's reveal, so both show the same pegs as the real board.
  function miniRow(code, marks) {
    const line = document.createElement("div");
    line.className = "mini-row";
    const pegs = document.createElement("div");
    pegs.className = "pegs";
    for (const c of code) pegs.appendChild(peg(c));
    line.appendChild(pegs);

    if (marks) {
      const box = document.createElement("div");
      box.className = "marks";
      box.style.setProperty("--markcols", String(Math.ceil(code.length / 2)));
      for (let p = 0; p < code.length; p++) {
        const m = document.createElement("span");
        m.className = "mark" +
          (p < marks.black ? " black" : p < marks.black + marks.white ? " white" : "");
        box.appendChild(m);
      }
      line.appendChild(box);
    }
    return line;
  }

  // The setter's row of slots on the code-setting sheet — the same shapes, but
  // its own element, because it exists before there is a board to draw into.
  function pickRow(pegs, onSlot) {
    const wrap = $("pickRow");
    wrap.innerHTML = "";
    wrap.style.setProperty("--pegs", String(pegs));
    const slots = [];
    for (let p = 0; p < pegs; p++) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "slot";
      slot.setAttribute("aria-label", "Slot " + (p + 1));
      slot.appendChild(peg(-1));
      const at = p;
      slot.addEventListener("click", () => onSlot(at));
      wrap.appendChild(slot);
      slots.push(slot);
    }
    return slots;
  }

  function pickPalette(onColour) {
    const wrap = $("pickPalette");
    wrap.innerHTML = "";
    const out = [];
    for (let c = 0; c < Rules.COLOURS; c++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.title = Rules.COLOUR_NAMES[c];
      b.setAttribute("aria-label", Rules.COLOUR_NAMES[c]);
      b.appendChild(peg(c));
      b.addEventListener("click", () => onColour(c));
      wrap.appendChild(b);
      out.push(b);
    }
    return out;
  }

  return {
    build, fit, paint, peg, fillPeg, markRow, nudge, markWin, clearWin,
    setPalette, coach, toast, clearToast, confetti, miniRow, pickRow, pickPalette
  };
})();
