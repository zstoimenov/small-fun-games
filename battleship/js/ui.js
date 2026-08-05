/* Battleship — everything that draws.                                          */
/*                                                                              */
/* app.js owns the game and hands finished decisions down here; this file never  */
/* works out whether a shot hit or whose go it is.                               */
/*                                                                              */
/* There are two ways to paint a grid and the difference matters more than       */
/* anything else in this file. `paintOwn` takes a board and draws the ships on   */
/* it. `paintEnemy` takes a *view* — shots and wrecks, no ships — and there is   */
/* no code path by which the sea you are shooting at can be drawn from anything  */
/* else. That is what stops a curious nine-year-old finding the other fleet in   */
/* the page inspector.                                                           */
"use strict";
window.BS = window.BS || {};

BS.Ui = (function () {
  const Rules = BS.Rules;
  const $ = (id) => document.getElementById(id);

  const MAX_CELL = 62;
  const MIN_CELL = 11;
  let wired = false;
  let refit = null;   // set by onResize — how the board is put back to size

  const reduced = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const landscape = () =>
    window.matchMedia && window.matchMedia("(orientation: landscape)").matches;

  /* ── Building a grid ───────────────────────────────────────────────────── */

  // One builder for every grid in the game. `labels` puts the letters across the
  // top and the numbers down the side; `onCell` makes the squares tappable.
  // Returns the squares in row order, which is the order everything else uses.
  function grid(el, n, opts) {
    const o = opts || {};
    el.innerHTML = "";
    el.style.setProperty("--n", String(n));
    el.classList.toggle("mini", !!o.mini);
    el.classList.toggle("flat", !o.onCell);

    if (!o.mini) {
      el.appendChild(label(""));
      for (let c = 0; c < n; c++) el.appendChild(label(Rules.LETTERS[c]));
    }

    const cells = [];
    for (let r = 0; r < n; r++) {
      if (!o.mini) el.appendChild(label(String(r + 1)));
      for (let c = 0; c < n; c++) {
        const sq = document.createElement("button");
        sq.type = "button";
        sq.className = "sq";
        sq.setAttribute("aria-label", Rules.square(r, c));
        if (o.onCell) {
          const rr = r, cc = c;
          sq.addEventListener("click", () => o.onCell(rr, cc));
        } else {
          sq.disabled = true;
        }
        el.appendChild(sq);
        cells.push(sq);
      }
    }
    return { el, n, cells };
  }

  function label(text) {
    const s = document.createElement("span");
    s.className = "lbl";
    s.textContent = text;
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  /* ── Painting ──────────────────────────────────────────────────────────── */

  // The sea you are shooting at. `view` is Rules.publicView — splashes, hits and
  // wrecks. There are no ships in it to draw, which is the point.
  function paintEnemy(g, view, aim, active) {
    for (let i = 0; i < g.cells.length; i++) {
      const shot = view.shots[i];
      let cls = "sq";
      if (shot === Rules.MISS) cls += " miss";
      else if (shot === Rules.HIT) cls += view.sunkCells[i] ? " sunk" : " hit";
      if (aim && aim.r * g.n + aim.c === i) cls += " aim";
      g.cells[i].className = cls;
      g.cells[i].disabled = !active || shot !== Rules.WATER;
    }
  }

  // Your own sea: your ships, plus whatever has been fired at you. Used for the
  // little grid during the battle and for the big one while placing.
  // `sel` highlights one ship, which is what the placement screen needs.
  function paintOwn(g, board, sel) {
    const shape = new Array(g.cells.length).fill("");
    for (const ship of board.ships) {
      if (!Rules.isPlaced(ship)) continue;
      const cells = Rules.shipCells(ship);
      const down = ship.horiz ? "h" : "v";
      cells.forEach(([r, c], k) => {
        const i = r * g.n + c;
        shape[i] = " ship " + (k === 0 ? down + "-start"
          : k === cells.length - 1 ? down + "-end" : "mid") +
          (Rules.sunk(ship) ? " sunk" : "") +
          (sel === ship.id ? " sel" : "");
      });
    }

    for (let i = 0; i < g.cells.length; i++) {
      let cls = "sq" + shape[i];
      const shot = board.shots[i];
      if (shot === Rules.MISS) cls += " miss";
      else if (shot === Rules.HIT) cls += " hit";
      g.cells[i].className = cls;
    }
  }

  // Every square, ships and all — only ever used once the game is over.
  function paintReveal(g, board) {
    paintOwn(g, board, -1);
  }

  /* ── Marks landing ─────────────────────────────────────────────────────── */

  function pop(g, r, c, kind) {
    const sq = g.cells[r * g.n + c];
    if (!sq || reduced()) return;
    sq.classList.remove("splash", "boom");
    void sq.offsetWidth;
    sq.classList.add(kind);
  }

  /* ── Sizing ────────────────────────────────────────────────────────────── */

  // The board is a fixed number of squares of fixed proportions, so rather than
  // restate those proportions here — where they could quietly drift from the
  // stylesheet — set a square size, measure what the card actually became, and
  // scale by however far off it was. It has to grow as well as shrink: the same
  // markup holds a 6×6 sea and a 10×10 one, and a board that only ever shrank
  // left two thirds of a tablet screen empty.
  function fitBig(wrapId, gridEl) {
    const wrap = $(wrapId);
    if (!wrap || !gridEl || !wrap.getClientRects().length) return 0;
    const card = gridEl.parentElement;
    const box = wrap.getBoundingClientRect();
    const availW = Math.max(60, box.width - 4);
    const availH = Math.max(60, box.height - 4);

    let size = 0;
    const apply = (v) => {
      size = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(v)));
      gridEl.style.setProperty("--cell", size + "px");
    };

    apply(30);
    for (let pass = 0; pass < 2; pass++) {
      const byH = (size * availH) / card.offsetHeight;
      const byW = (size * availW) / card.offsetWidth;
      apply(Math.min(byH, byW));
    }
    return size;
  }

  // The little grid gets a share of the width of the row it sits in, and a
  // share of the window's height. Deliberately *not* measured from its own
  // parent: the parent grows to fit it, so measuring that would be a loop, and
  // the loop settles somewhere different depending on how it got there.
  function fitMini(gridEl, n) {
    const side = document.querySelector(".side");
    if (!gridEl || !side || !side.getClientRects().length) return;
    // How much of the row's width to take depends on whether the fleet lists
    // are beside the grid or under it — which is a media query, so ask the
    // stylesheet what it decided rather than writing the breakpoints out again.
    const beside = getComputedStyle(side).flexDirection === "row";
    const w = side.getBoundingClientRect().width * (beside ? 0.42 : 1) - 26;
    const h = window.innerHeight * (landscape() ? 0.34 : 0.2) - 30;
    const cell = Math.max(6, Math.min(24, Math.floor(Math.min(w, h) / n)));
    gridEl.style.setProperty("--cell", cell + "px");
  }

  // A size for the grids that live inside a sheet — the reveal and the heat map.
  // The reveal puts two seas side by side, and they have to *stay* side by side:
  // 1px per square too generous and the second one wraps under the first, which
  // is the difference between comparing two boards and scrolling between them.
  // Hence the gaps and the card's own padding in the sum rather than a guess.
  function sheetCell(n, perRow) {
    const per = perRow || 1;
    const avail = Math.min(window.innerWidth, 440) - 40 - 12 * (per - 1);
    const card = avail / per - 18;
    return Math.max(8, Math.min(20, Math.floor(card / (n * 1.06))));
  }

  /* ── Fleet lists ───────────────────────────────────────────────────────── */

  // Which ships are still out there. For your own fleet the pips show the damage
  // as it happens; for theirs they only fill in once a ship has gone down, since
  // until then nobody knows which ship those hits belong to.
  function fleetList(el, ships, secret) {
    el.innerHTML = "";
    for (const ship of ships) {
      const gone = Rules.sunk(ship);
      const row = document.createElement("div");
      row.className = "fleet-item" + (gone ? " gone" : "");

      const name = document.createElement("span");
      name.className = "fname";
      name.textContent = ship.emoji + " " + ship.name;
      row.appendChild(name);

      const pips = document.createElement("span");
      pips.className = "pips";
      const shown = secret ? (gone ? ship.len : 0) : ship.hits;
      for (let i = 0; i < ship.len; i++) {
        const pip = document.createElement("i");
        if (i < shown) pip.className = "on";
        pips.appendChild(pip);
      }
      row.appendChild(pips);
      el.appendChild(row);
    }
  }

  /* ── The ship tray ─────────────────────────────────────────────────────── */

  function tray(el, board, selId, onPick) {
    el.innerHTML = "";
    for (const ship of board.ships) {
      const b = document.createElement("button");
      b.type = "button";
      const placed = Rules.isPlaced(ship);
      b.className = "ship-chip" + (ship.id === selId ? " on" : "") + (placed ? " done" : "");
      b.setAttribute("aria-pressed", ship.id === selId ? "true" : "false");

      const name = document.createElement("span");
      name.className = "cname";
      name.textContent = ship.emoji + " " + ship.name;
      b.appendChild(name);

      const pips = document.createElement("span");
      pips.className = "pips";
      for (let i = 0; i < ship.len; i++) pips.appendChild(document.createElement("i"));
      b.appendChild(pips);

      b.addEventListener("click", () => onPick(ship.id));
      el.appendChild(b);
    }
  }

  /* ── Grids inside a sheet ──────────────────────────────────────────────── */

  // A finished sea, ships and all, in a titled card. Used for the reveal at the
  // end and for the lesson, so both draw exactly what the game draws.
  function boardCard(board, title, cell) {
    const card = document.createElement("div");
    card.className = "grid-card";
    const head = document.createElement("div");
    head.className = "grid-head";
    head.textContent = title;
    card.appendChild(head);

    const el = document.createElement("div");
    el.className = "grid mini";
    card.appendChild(el);
    const g = grid(el, board.size, { mini: true });
    el.style.setProperty("--cell", (cell || sheetCell(board.size, 2)) + "px");
    paintReveal(g, board);
    return card;
  }

  // A sea for the play-back. Same card as the reveal, but the caller keeps the
  // handles: it repaints this thing once a beat and rebuilding the grid every
  // time would throw away the shell animation mid-flight.
  function seaPanel(board, title) {
    const card = document.createElement("div");
    card.className = "grid-card sea-panel";

    const head = document.createElement("div");
    head.className = "grid-head";
    head.textContent = title;

    const el = document.createElement("div");
    el.className = "grid mini";

    const meta = document.createElement("div");
    meta.className = "sea-meta";

    card.append(head, el, meta);
    return { card, el, meta, g: grid(el, board.size, { mini: true }) };
  }

  // The heat map: the same numbers the computer shoots by, as brightness. Squares
  // already fired at are left as they are, so the picture still reads as a board.
  function heatCard(view, heat, title) {
    const card = document.createElement("div");
    card.className = "grid-card";
    const head = document.createElement("div");
    head.className = "grid-head";
    head.textContent = title;
    card.appendChild(head);

    const el = document.createElement("div");
    el.className = "grid mini";
    card.appendChild(el);
    const g = grid(el, view.size, { mini: true });
    el.style.setProperty("--cell", sheetCell(view.size, 1) + "px");

    let top = 0;
    for (let i = 0; i < heat.length; i++) if (heat[i] > top) top = heat[i];
    for (let i = 0; i < g.cells.length; i++) {
      const shot = view.shots[i];
      if (shot === Rules.MISS) { g.cells[i].className = "sq miss"; continue; }
      if (shot === Rules.HIT) {
        g.cells[i].className = "sq " + (view.sunkCells[i] ? "sunk" : "hit");
        continue;
      }
      const share = top > 0 ? heat[i] / top : 0;
      g.cells[i].className = "sq";
      g.cells[i].style.background =
        "rgba(255," + Math.round(190 - 150 * share) + "," + Math.round(60 - 40 * share) +
        "," + (0.1 + 0.85 * share).toFixed(2) + ")";
    }
    return card;
  }

  /* ── The line above the board ──────────────────────────────────────────── */

  // Refits afterwards: a message that wraps onto two lines takes height away
  // from the board, and the square size is a number in a style attribute, not
  // something CSS will re-derive on its own.
  function coach(id, html, kind) {
    const el = $(id);
    el.innerHTML = html;
    el.className = "coach" + (kind ? " " + kind : "");
    el.hidden = false;
    if (refit) refit();
  }

  /* ── Toast and confetti ────────────────────────────────────────────────── */

  let toastTimer = null;

  function clearToast() {
    clearTimeout(toastTimer);
    const el = $("toast");
    if (!el) return;
    el.classList.remove("show");
    el.hidden = true;
  }

  function toast(msg, ms) {
    const el = $("toast");
    el.innerHTML = msg;
    el.hidden = false;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => { el.hidden = true; }, 260);
    }, ms || 1900);
  }

  function confetti() {
    if (reduced()) return;
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    const colors = ["#1f7ae0", "#12a3bd", "#ffc93c", "#e0483f", "#4ad48a", "#ffffff"];
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

  /* ── Resize ────────────────────────────────────────────────────────────── */

  // Once only: the screens are rebuilt for every new game, and a fresh pair of
  // listeners each time would have the boards refitting a dozen times a resize.
  // Also remembered, so anything in here that changes how much room the board
  // has — the coach line growing a second line — can put it right again.
  function onResize(fn) {
    refit = fn;
    if (wired) return;
    addEventListener("resize", fn);
    addEventListener("orientationchange", fn);
    wired = true;
  }

  return {
    grid, paintEnemy, paintOwn, paintReveal, pop,
    fitBig, fitMini, sheetCell, fleetList, tray,
    boardCard, seaPanel, heatCard, coach, toast, clearToast, confetti, onResize
  };
})();
