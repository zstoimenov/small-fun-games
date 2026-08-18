/* Cube Timer — everything that draws.                                           */
/*                                                                              */
/* app.js decides what is true; this file is the only place that says what that  */
/* looks like. Nothing here keeps state of its own — every function is handed    */
/* what it needs and redraws from scratch, which is fast enough for a page with  */
/* one grid and a list on it, and means the picture can never drift out of step  */
/* with the times behind it.                                                    */
"use strict";
window.CT = window.CT || {};

CT.Ui = (function () {
  const { Stats, Scramble } = window.CT;
  const $ = (id) => document.getElementById(id);
  const SVGNS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* ── Segmented controls ────────────────────────────────────────────────── */
  // One row of buttons where exactly one is on. The value lives in the DOM
  // (data-value plus .on) so there is nothing to keep in sync by hand.

  function chooser(id, onPick) {
    const box = $(id);
    if (!box) return;
    box.addEventListener("click", (e) => {
      const btn = e.target.closest(".opt");
      if (!btn || btn.classList.contains("on")) return;
      setChooser(id, btn.dataset.value);
      onPick(btn.dataset.value);
    });
  }

  function setChooser(id, value) {
    const box = $(id);
    if (!box) return;
    box.querySelectorAll(".opt").forEach((b) => {
      const on = b.dataset.value === String(value);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function setSwitch(id, on) {
    const b = $(id);
    if (!b) return;
    b.classList.toggle("on", !!on);
    b.setAttribute("aria-checked", on ? "true" : "false");
  }

  /* ── Who's cubing ──────────────────────────────────────────────────────── */
  // Chips rather than a dropdown: on a tablet a name you can hit with a thumb
  // beats a menu, and four names fit on one line.

  function renderChips(box, cubers, selected, opts) {
    box.textContent = "";
    cubers.forEach((c) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (c.id === selected ? " on" : "") + (c.id === opts.taken ? " taken" : "");
      chip.dataset.id = c.id;
      chip.disabled = c.id === opts.taken;
      chip.textContent = c.name;
      if (opts.onRemove && cubers.length > 1) {
        const x = document.createElement("span");
        x.className = "chip-x";
        x.dataset.remove = c.id;
        x.textContent = "✕";
        x.title = "Remove " + c.name;
        chip.appendChild(x);
      }
      box.appendChild(chip);
    });
    if (opts.onAdd && cubers.length < opts.max) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "chip add";
      add.dataset.add = "1";
      add.textContent = "+ Add";
      box.appendChild(add);
    }
  }

  /* ── The scramble ──────────────────────────────────────────────────────── */
  // Grouped in fives, because a kid reads a scramble in bursts and loses their
  // place in a wall of twenty. The groups are a wider GAP rather than a fixed
  // row, so forty moves can reflow onto a phone lying on its side instead of
  // pushing the clock off the bottom of the screen.

  function renderScramble(box, moves) {
    box.textContent = "";
    moves.forEach((m, i) => {
      const span = document.createElement("span");
      span.className = "move" + ((i % 5 === 4 && i < moves.length - 1) ? " spaced" : "");
      span.textContent = m;
      box.appendChild(span);
    });
  }

  /* ── The picture of the cube ───────────────────────────────────────────── */
  /* An unfolded net: the top face above, the four sides in a strip, the bottom
   * below. This is the bit that makes the app usable by someone who cannot yet
   * read notation at speed — you scramble, then check your cube against the
   * picture, and you know you got it right before you start the clock. */

  const NET_SPOT = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
  const FACE_SIZE = 30;

  function renderNet(svg, grids, size) {
    svg.textContent = "";
    const cell = (FACE_SIZE - 2) / size;
    Scramble.FACES.forEach((f) => {
      const spot = NET_SPOT[f];
      const ox = spot[0] * FACE_SIZE + 1, oy = spot[1] * FACE_SIZE + 1;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          svg.appendChild(svgEl("rect", {
            x: (ox + c * cell).toFixed(2), y: (oy + r * cell).toFixed(2),
            width: (cell - 0.4).toFixed(2), height: (cell - 0.4).toFixed(2),
            rx: (cell * 0.16).toFixed(2),
            fill: "var(--face-" + grids[f][r][c].toLowerCase() + ")",
            stroke: "var(--net-line)", "stroke-width": "0.35"
          }));
        }
      }
    });
  }

  /* ── The numbers under the pad ─────────────────────────────────────────── */

  function renderStats(solves) {
    const best = Stats.best(solves);
    const ao5 = Stats.ao5(solves);
    $("statBest").textContent = best === null ? "–" : Stats.format(best);
    $("statAo5").textContent = ao5 === undefined ? "–" : Stats.format(ao5);
    $("statCount").textContent = String(solves.length);
  }

  // Twenty bars, tall for slow and short for quick. No axis, no numbers — it is
  // there to answer "am I getting faster?" at a glance, nothing more.
  function renderSpark(svg, solves) {
    svg.textContent = "";
    const bars = Stats.bars(solves, 20);
    if (bars.length < 2) { svg.classList.add("empty"); return; }
    svg.classList.remove("empty");
    const w = 100 / bars.length;
    bars.forEach((b, i) => {
      const h = Math.max(1.5, b.h * 22);
      svg.appendChild(svgEl("rect", {
        x: (i * w + w * 0.15).toFixed(2), y: (24 - h).toFixed(2),
        width: (w * 0.7).toFixed(2), height: h.toFixed(2),
        rx: (Math.min(w * 0.35, 1.2)).toFixed(2),
        class: b.dnf ? "bar dnf" : "bar"
      }));
    });
  }

  /* ── The list of times ─────────────────────────────────────────────────── */
  // Newest at the top, because the solve you want to fix is the one you just
  // did. The number beside it is its place in the session, counted from the
  // start, so "my 40th solve" means the same thing tomorrow.

  function renderTimes(box, solves) {
    box.textContent = "";
    if (!solves.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = "No times yet. Solve one!";
      box.appendChild(p);
      return;
    }
    const best = Stats.best(solves);
    for (let i = solves.length - 1; i >= 0; i--) {
      const s = solves[i];
      const t = Stats.effective(s);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "time-row" + (t !== null && t === best ? " best" : "");
      row.dataset.index = i;

      const n = document.createElement("span");
      n.className = "time-n";
      n.textContent = "#" + (i + 1);

      const v = document.createElement("span");
      v.className = "time-v";
      v.textContent = Stats.format(t);

      const tag = document.createElement("span");
      tag.className = "time-tag";
      tag.textContent = s.penalty === "+2" ? "+2" : (t !== null && t === best ? "🏅 best" : "");

      row.appendChild(n); row.appendChild(v); row.appendChild(tag);
      box.appendChild(row);
    }
  }

  // "Today, 4:12pm" beats a date stamp for something you did ten minutes ago.
  function when(at) {
    const d = new Date(at);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay ? "Today, " + time : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }) + ", " + time;
  }

  return {
    $, svgEl, chooser, setChooser, setSwitch,
    renderChips, renderScramble, renderNet, renderStats, renderSpark, renderTimes, when
  };
})();
