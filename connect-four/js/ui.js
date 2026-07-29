/* Connect Four — everything that draws.                                        */
/*                                                                              */
/* app.js owns the game and hands finished decisions to the functions here; this */
/* file never works out whose turn it is or whether anyone has won. It does own  */
/* one thing outright: how big the board is. A grid of squares can't be sized by */
/* CSS alone without either overflowing a short screen or squashing the holes    */
/* into ovals, so fit() measures the space and sets the width itself.            */
"use strict";
window.C4 = window.C4 || {};

C4.Ui = (function () {
  const Board = C4.Board;
  const { COLS, ROWS } = Board;
  const $ = (id) => document.getElementById(id);

  const el = {};
  const holes = [];        // holes[col][row], row 0 at the bottom, same as the board
  let columns = [];
  let previewEl = null;

  const reduced = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const colourName = (who) => (who === Board.RED ? "red" : "yellow");

  /* ── Building the grid ─────────────────────────────────────────────────── */

  // One button per column, so a tap anywhere down the column drops a disc — a
  // far kinder target on a phone than the single square it lands on.
  function build(onColumn, onHover) {
    el.board = $("board");
    el.boardWrap = $("boardWrap");
    el.coach = $("coach");
    el.toast = $("toast");

    el.board.innerHTML = "";
    holes.length = 0;
    columns = [];

    for (let c = 0; c < COLS; c++) {
      const col = document.createElement("button");
      col.type = "button";
      col.className = "col";
      col.dataset.col = String(c);
      col.setAttribute("aria-label", "Drop in column " + (c + 1));

      const stack = [];
      // Top row first in the DOM, so reading order matches what you see.
      for (let r = ROWS - 1; r >= 0; r--) {
        const hole = document.createElement("span");
        hole.className = "hole";
        const disc = document.createElement("span");
        disc.className = "disc";
        hole.appendChild(disc);
        col.appendChild(hole);
        stack[r] = hole;
      }
      holes.push(stack);
      columns.push(col);
      el.board.appendChild(col);

      col.addEventListener("click", () => onColumn(c));
      col.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "touch") onHover(c);
      });
      col.addEventListener("pointerleave", () => onHover(-1));
      col.addEventListener("focus", () => onHover(c));
      col.addEventListener("blur", () => onHover(-1));
    }

    addEventListener("resize", fit);
    addEventListener("orientationchange", fit);
    fit();
  }

  // Square holes need a square-friendly board, so pick the largest 7x6 box that
  // fits the space left over and set the width in pixels. Called on every resize
  // and whenever the game screen appears.
  function fit() {
    if (!el.boardWrap || el.boardWrap.offsetParent === null) return;
    const box = el.boardWrap.getBoundingClientRect();
    const pad = 6;
    const availW = Math.max(60, box.width - pad * 2);
    const availH = Math.max(60, box.height - pad * 2);

    // Guess from the spare width, measure what that actually cost in height,
    // then shrink if it doesn't fit. Two passes beats restating the board's
    // padding ratio here, where it could quietly drift from the stylesheet.
    const size = Math.min(availW, 560);
    el.board.style.width = Math.floor(size) + "px";
    const tall = el.board.offsetHeight;
    if (tall > availH) {
      el.board.style.width = Math.max(60, Math.floor((size * availH) / tall)) + "px";
    }
  }

  const discAt = (c, r) => holes[c][r].firstChild;

  /* ── Drawing a position ────────────────────────────────────────────────── */

  // Repaints every hole from the board. Used after an undo or when a saved game
  // is picked back up, where there is no single disc to animate.
  function paint(b) {
    clearPreview();
    clearWin();
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const disc = discAt(c, r);
        const who = Board.at(b, c, r);
        disc.className = "disc" + (who ? " " + colourName(who) : "");
        disc.style.removeProperty("--fall");
      }
    }
  }

  // Drops one disc and resolves when it has landed, so app.js can wait for the
  // animation rather than guess at a delay.
  function drop(c, r, who) {
    const hole = holes[c][r];
    const disc = hole.firstChild;
    disc.className = "disc " + colourName(who);

    if (reduced()) {
      disc.classList.add("landed");
      return Promise.resolve();
    }

    // How far above the top of the column to start: past its own hole, plus the
    // hole's height, which puts it just clear of the board.
    const lift = hole.offsetTop + hole.offsetHeight;
    const rows = (hole.offsetHeight ? lift / hole.offsetHeight : 1);
    const dur = 0.2 + Math.min(rows, 7) * 0.035;
    disc.style.setProperty("--fall", -lift + "px");
    disc.style.setProperty("--dur", dur.toFixed(3) + "s");
    // Force a reflow so restarting the animation on a reused element takes.
    void disc.offsetWidth;
    disc.classList.add("dropping");

    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        disc.classList.remove("dropping");
        disc.classList.add("landed");
        resolve();
      };
      disc.addEventListener("animationend", finish, { once: true });
      // Belt and braces: a backgrounded tab never fires animationend, and a
      // turn that never ends is worse than one that ends early.
      setTimeout(finish, dur * 1000 + 260);
    });
  }

  /* ── Hover preview, winning line, column nudge ─────────────────────────── */

  // The translucent disc showing where your go would land. Pointer only — on a
  // touch screen your finger is already on the answer.
  function preview(b, c, who) {
    clearPreview();
    if (c < 0 || !Board.canPlay(b, c)) return;
    previewEl = discAt(c, b.heights[c]);
    previewEl.classList.add("preview", colourName(who));
  }

  // Only ever strips the classes back off the one hole it put them on — the
  // colour classes are shared with real discs, so a broader sweep would rub
  // out the discs already on the board.
  function clearPreview() {
    if (!previewEl) return;
    previewEl.classList.remove("preview", "red", "yellow");
    previewEl = null;
  }

  function markWin(cells) {
    el.board.classList.add("settled");
    for (const [c, r] of cells) discAt(c, r).classList.add("win");
  }

  function clearWin() {
    el.board.classList.remove("settled");
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) discAt(c, r).classList.remove("win", "landed");
    }
  }

  // Points at a column without playing it — the hint button's whole job.
  function nudge(c) {
    const col = columns[c];
    if (!col) return;
    col.classList.remove("nudge");
    void col.offsetWidth;
    col.classList.add("nudge");
    setTimeout(() => col.classList.remove("nudge"), 1800);
  }

  function setEnabled(b, on) {
    for (let c = 0; c < COLS; c++) {
      columns[c].disabled = !on || !Board.canPlay(b, c);
      columns[c].classList.toggle("full", !Board.canPlay(b, c));
    }
  }

  /* ── The line above the board ──────────────────────────────────────────── */

  // Refits after every change: a warning that wraps onto two lines takes height
  // away from the board, and the board's size is a number in a style attribute,
  // not something CSS will re-derive on its own.
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
    }, ms || 1800);
  }

  function confetti() {
    if (reduced()) return;
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    const colors = ["#e8483f", "#ffc93c", "#4bc8ff", "#6c4cf0", "#3ddc68"];
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

  /* ── Little boards for the how-to-play pages ───────────────────────────── */

  // Draws a small read-only grid from a picture like ["..r..", ".yr.."], so the
  // lesson uses the same shapes as the real board without going near the game.
  function miniBoard(rowsTop, highlight) {
    const wrap = document.createElement("div");
    wrap.className = "mini-board";
    wrap.style.setProperty("--mini-cols", String(rowsTop[0].length));
    const marks = new Set((highlight || []).map((p) => p.join(",")));
    rowsTop.forEach((line, y) => {
      for (let x = 0; x < line.length; x++) {
        const hole = document.createElement("span");
        hole.className = "hole";
        const disc = document.createElement("span");
        const ch = line[x];
        disc.className = "disc" + (ch === "r" ? " red" : ch === "y" ? " yellow" : "")
          + (marks.has(x + "," + y) ? " win" : "");
        hole.appendChild(disc);
        wrap.appendChild(hole);
      }
    });
    return wrap;
  }

  return {
    build, fit, paint, drop, preview, clearPreview, markWin,
    nudge, setEnabled, coach, toast, clearToast, confetti, miniBoard
  };
})();
