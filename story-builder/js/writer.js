/* Story Builder - the writing widgets.                                        */
/*                                                                             */
/* writer(root, toks, { tabs, tiles, onChange }): the sentence as word chips,  */
/* then tabs of tiles. Tap a tile to add it. Tap a word in the sentence to     */
/* pick it: new tiles then go in front of it, and ✕ takes it out.             */
/* mountain(root, parts, { tabs, onChange }): five parts of a story, each with */
/* its own writer.                                                             */
"use strict";
window.SB = window.SB || {};

(function () {
  const A = SB.Audio;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function button(cls, html, label, fn) {
    const b = el("button", cls, html);
    b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    b.addEventListener("click", fn);
    return b;
  }
  // A read-aloud button that turns into Stop while it talks.
  function readButton(getText, label) {
    if (!A.canSpeak()) return el("span");
    const b = button("btn ghost small read", "🔊 " + (label || "Read it"), "Read it out loud", () => {
      if (b.dataset.on) { A.hush(); return; }
      b.dataset.on = "1";
      b.textContent = "■ Stop";
      A.speak(getText(), () => { delete b.dataset.on; b.textContent = "🔊 " + (label || "Read it"); });
    });
    return b;
  }

  SB.writer = function (root, toks, o) {
    let sel = -1;
    let tab = o.tabs[0];
    root.innerHTML = "";
    root.classList.add("writer");
    const line = el("div", "line");
    line.setAttribute("aria-live", "polite");
    const bar = el("div", "line-bar");
    const tabs = el("div", "tabs");
    tabs.setAttribute("role", "tablist");
    const tiles = el("div", "tiles-bank");
    const hint = el("p", "line-hint", "");
    bar.append(readButton(() => SB.Words.text(toks)),
      button("btn ghost small", "⌫ Undo", "Take out the last word", () => { if (toks.length) { toks.pop(); sel = -1; changed(); } }),
      button("btn ghost small own", "✏️ My own words", "Type my own words", () => {
        const t = prompt("Type your own words:", "");
        if (!t || !t.trim()) return;
        const add = t.trim().slice(0, 60).split(/\s+/).map((w) => ({ w, cat: "own" }));
        insert(add);
      }));
    root.append(line, hint, bar, tabs, tiles);

    function insert(list) {
      if (sel >= 0) { toks.splice(sel, 0, ...list); sel += list.length; }
      else toks.push(...list);
      A.click();
      changed();
    }
    function changed() { paintLine(); if (o.onChange) o.onChange(); }

    function paintLine() {
      line.innerHTML = "";
      if (!toks.length) { line.innerHTML = '<span class="placeholder">Tap the tiles below to make a sentence</span>'; hint.textContent = ""; return; }
      const shown = SB.Words.text(toks);
      // Show chips with the capitals the sentence will really have.
      let start = true;
      toks.forEach((t, i) => {
        let w = t.w;
        if (t.cat === "mark") start = true;
        else { if (start) w = w[0].toUpperCase() + w.slice(1); start = false; }
        const chip = button("chip" + (t.cat === "mark" ? " mark" : "") + (t.cat === "own" ? " typed" : "") + (i === sel ? " sel" : ""),
          esc(w) + (i === sel ? ' <span class="x" aria-hidden="true">✕</span>' : ""),
          i === sel ? "Take out " + t.w : "Pick " + t.w, () => {
            if (i === sel) { toks.splice(i, 1); sel = -1; changed(); return; }
            sel = i;
            paintLine();
          });
        chip.dataset.cat = t.cat;
        line.appendChild(chip);
      });
      if (!/[.!?]$/.test(toks[toks.length - 1].w)) line.appendChild(el("span", "auto-stop", "."));
      hint.textContent = sel >= 0 ? "New words go in front of the picked word. Tap it again to take it out." : "";
      line.setAttribute("aria-label", shown);
    }
    function paintTabs() {
      tabs.innerHTML = "";
      if (o.tabs.length < 2) tabs.hidden = true;
      o.tabs.forEach((c) => {
        const t = SB.TABS[c];
        const b = button("tab" + (c === tab ? " on" : ""), `<span aria-hidden="true">${t.e}</span>${t.name}`, t.name + " words", () => { tab = c; paintTabs(); paintTiles(); });
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(c === tab));
        tabs.appendChild(b);
      });
    }
    function paintTiles() {
      tiles.innerHTML = "";
      const list = (o.tiles && o.tiles[tab]) || SB.WORDS[tab];
      list.forEach((w) => {
        const b = button("tile-w", esc(w), "Add " + w, () => insert([{ w, cat: tab }]));
        b.dataset.cat = tab;
        tiles.appendChild(b);
      });
    }
    paintLine();
    paintTabs();
    paintTiles();
    return { paint: paintLine };
  };

  SB.mountain = function (root, parts, o) {
    let cur = 0;
    root.innerHTML = "";
    root.classList.add("mountain");
    const steps = el("div", "steps");
    steps.setAttribute("role", "group");
    steps.setAttribute("aria-label", "The five parts of your story");
    const head = el("div", "part-head");
    const box = el("div");
    const story = el("div", "story-read card");
    root.append(steps, head, box, story);

    function paintSteps() {
      steps.innerHTML = "";
      SB.PARTS.forEach((p, i) => {
        const n = SB.Words.words(parts[i]);
        const b = button("step" + (i === cur ? " on" : "") + (n ? " done" : ""), `<span aria-hidden="true">${p.e}</span><b>${p.name}</b><small>${n ? "✓ " + n + " word" + (n > 1 ? "s" : "") : "empty"}</small>`,
          p.name + (n ? ", " + n + " words" : ", empty"), () => { cur = i; paint(); });
        b.style.setProperty("--i", i);
        steps.appendChild(b);
      });
    }
    function paintStory() {
      const done = parts.map((p) => SB.Words.text(p)).filter(Boolean);
      story.innerHTML = "";
      story.appendChild(el("p", "kicker", "Your story so far"));
      story.appendChild(el("p", "story-text", done.length ? esc(done.join(" ")) : '<span class="placeholder">Your story will appear here.</span>'));
      if (done.length) story.appendChild(readButton(() => done.join(" "), "Read my story"));
    }
    function paint() {
      paintSteps();
      const p = SB.PARTS[cur];
      head.innerHTML = `<h3>${p.e} ${p.name}</h3><p>${p.tip}</p>`;
      SB.writer(box, parts[cur], { tabs: o.tabs, onChange: () => { paintSteps(); paintStory(); if (o.onChange) o.onChange(); } });
      paintStory();
    }
    paint();
    return { paint };
  };
})();
