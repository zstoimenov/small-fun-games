/* Music Studio - the beat grid: rows of sounds, 8 steps across.               */
/*                                                                             */
/* grid(box, { rows, song, locked(step), onChange }) draws it and returns      */
/* { paint, head(step), flash(cells) }. Tapping a cell flips it and plays the */
/* sound, so kids hear what they're placing.                                   */
"use strict";
window.MS = window.MS || {};

MS.grid = function (box, o) {
  const rowOf = (id) => MS.ROWS.find((r) => r.id === id);
  const len = o.song.len || 8;
  box.innerHTML = "";
  box.className = "grid";
  box.style.setProperty("--steps", len);
  const cells = {};

  // Beat numbers along the top: the big dots are the beats, the small ones
  // the "and" in between.
  box.appendChild(document.createElement("span"));
  for (let s = 0; s < len; s++) {
    const n = document.createElement("span");
    n.className = "count" + (s % 2 ? "" : " beat");
    n.textContent = s % 2 ? "·" : s / 2 + 1;
    n.setAttribute("aria-hidden", "true");
    box.appendChild(n);
  }

  o.rows.forEach((id) => {
    const r = rowOf(id);
    const label = document.createElement("span");
    label.className = "label" + (r.note ? " note" : "");
    label.style.setProperty("--rc", r.color);
    label.innerHTML = `<i aria-hidden="true">${r.emoji}</i><b>${r.name}</b>`;
    box.appendChild(label);
    cells[id] = [];
    for (let s = 0; s < len; s++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cell" + (s % 2 ? "" : " beat");
      b.style.setProperty("--rc", r.color);
      b.setAttribute("aria-label", (r.long || r.name) + ", step " + (s + 1));
      if (o.locked && o.locked(s)) { b.disabled = true; b.classList.add("locked"); }
      b.addEventListener("click", () => {
        const song = o.song;
        song.cells[id][s] = song.cells[id][s] ? 0 : 1;
        if (song.cells[id][s]) MS.Audio.hit(id, 0, song.mood, song.inst);
        paintCell(id, s);
        if (o.onChange) o.onChange();
      });
      cells[id].push(b);
      box.appendChild(b);
    }
  });

  function paintCell(id, s) {
    const on = !!o.song.cells[id][s];
    cells[id][s].classList.toggle("on", on);
    cells[id][s].setAttribute("aria-pressed", String(on));
  }
  function paint() { o.rows.forEach((id) => { for (let s = 0; s < len; s++) paintCell(id, s); }); }
  let lit = -1;
  function head(step) {
    if (lit >= 0) o.rows.forEach((id) => cells[id][lit] && cells[id][lit].classList.remove("head"));
    lit = step;
    if (step >= 0) o.rows.forEach((id) => {
      const c = cells[id][step];
      c.classList.add("head");
      if (o.song.cells[id][step]) { c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); }
    });
  }
  // Wiggle the cells that don't match, as a hint.
  function flash(list) {
    list.forEach(([id, s]) => {
      const c = cells[id] && cells[id][s];
      if (!c) return;
      c.classList.remove("hint"); void c.offsetWidth; c.classList.add("hint");
    });
  }
  paint();
  return { paint, head, flash };
};

// Every cell where two songs differ, over the given rows.
MS.diff = function (a, b, rows) {
  const out = [];
  rows.forEach((id) => { for (let s = 0; s < (a.len || 8); s++) if (!!a.cells[id][s] !== !!b.cells[id][s]) out.push([id, s]); });
  return out;
};
MS.count = (song, ids) => ids.reduce((n, id) => n + song.cells[id].filter(Boolean).length, 0);
MS.copy = (song) => JSON.parse(JSON.stringify(song));

// ── Small controls shared by the levels and the studio ──────────────────────
// Tempo slider, snail to rocket. The number is BPM, shown for grown-ups.
MS.tempo = function (song, onChange) {
  const w = document.createElement("label");
  w.className = "tempo";
  w.innerHTML = `<span aria-hidden="true">🐌</span><input type="range" min="${MS.TEMPO.min}" max="${MS.TEMPO.max}" step="5" aria-label="How fast"><span aria-hidden="true">🚀</span><small></small>`;
  const input = w.querySelector("input"), out = w.querySelector("small");
  const show = () => { input.value = song.bpm; out.textContent = song.bpm + " beats a minute"; };
  input.addEventListener("input", () => { song.bpm = +input.value; show(); if (onChange) onChange(); });
  show();
  return w;
};
// A row of toggle buttons: pick one of a list of { id, name, emoji }.
MS.seg = function (list, get, set, label) {
  const w = document.createElement("div");
  w.className = "seg";
  w.setAttribute("role", "group");
  w.setAttribute("aria-label", label);
  const paint = () => w.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-pressed", String(list[i].id === get())));
  list.forEach((it) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span aria-hidden="true">${it.emoji}</span> <span class="lab">${it.name}</span>`;
    b.setAttribute("aria-label", it.name);
    b.addEventListener("click", () => { set(it.id); paint(); });
    w.appendChild(b);
  });
  paint();
  return w;
};
