/* Enigma - everything that touches the page.                                   */
/*                                                                              */
/* ui.js draws and reports; it never decides anything. It builds the lampboard  */
/* and keyboard, and hands the app a small set of callbacks. What a key does to */
/* the cipher is rules.js's business and what to do about it is app.js's.       */
"use strict";
window.EN = window.EN || {};

EN.UI = (function () {
  const R = EN.Rules;
  const $ = (id) => document.getElementById(id);
  const lamps = {};
  const keys = {};
  const drums = [];
  let toastTimer = 0;

  function build(handlers) {
    const lampBoard = $("lamps");
    const keyBoard = $("keys");
    R.LAYOUT.forEach((row) => {
      const lr = document.createElement("div");
      const kr = document.createElement("div");
      lr.className = kr.className = "row";
      row.split("").forEach((ch) => {
        const lamp = document.createElement("div");
        lamp.className = "lamp";
        lamp.textContent = ch;
        lamps[ch] = lamp;
        lr.appendChild(lamp);

        const key = document.createElement("button");
        key.type = "button";
        key.className = "key";
        key.textContent = ch;
        key.tabIndex = -1;            // real letters work on a keyboard; Tab would only get in the way
        key.setAttribute("aria-label", "Key " + ch);
        keys[ch] = key;
        // pointerdown, not click: a click only fires on release, so the lamp would
        // light late. The key also stays down until the finger lifts, like a real one.
        key.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          try { key.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
          handlers.keyDown(ch);
        });
        const up = () => handlers.keyUp(ch);
        key.addEventListener("pointerup", up);
        key.addEventListener("pointercancel", up);
        kr.appendChild(key);
      });
      lampBoard.appendChild(lr);
      keyBoard.appendChild(kr);
    });

    document.querySelectorAll(".rotor").forEach((el, i) => {
      const drum = el.querySelector(".drum");
      // Three letters are always in the window: the one before, the one showing,
      // and the one after - that is what makes it look like a wheel and not a label.
      drum.innerHTML = "<span></span><span></span><span></span>";
      drums.push(drum);
      el.querySelector(".up").addEventListener("click", () => handlers.turn(i, 1));
      el.querySelector(".down").addEventListener("click", () => handlers.turn(i, -1));
    });

    $("reset").addEventListener("click", handlers.reset);
    $("clear").addEventListener("click", handlers.clear);
    $("help").addEventListener("click", () => open("helpDialog"));
    $("codeLine").addEventListener("click", () => open("paperDialog"));
    document.querySelectorAll("dialog").forEach((d) => {
      d.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => d.close()));
      // A tap on the dimmed backdrop closes it too: the dialog element itself
      // only receives clicks outside its content box.
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    });
    $("undo").addEventListener("click", handlers.undo);
    $("share").addEventListener("click", handlers.share);
    $("random").addEventListener("click", handlers.random);
    $("mute").addEventListener("click", handlers.mute);
  }

  // dir: 1 = wheel rolls up (next letter), -1 = rolls down, 0 = no animation.
  function showRotor(i, p, dir) {
    const s = drums[i].children;
    s[0].textContent = R.ABC[R.mod(p - 1)];
    s[1].textContent = R.ABC[p];
    s[2].textContent = R.ABC[R.mod(p + 1)];
    if (dir) {
      drums[i].classList.remove("roll-up", "roll-down");
      void drums[i].offsetWidth;    // restart the animation if it is already running
      drums[i].classList.add(dir > 0 ? "roll-up" : "roll-down");
    }
  }

  // dirs: one of -1 / 0 / 1 per rotor, or nothing for "just draw, no animation".
  function showRotors(pos, dirs) {
    pos.forEach((p, i) => showRotor(i, p, dirs ? dirs[i] : 0));
  }

  function showStart(text) {
    $("startLetters").textContent = "Start " + text.split("").join(" ");
  }

  // The pop-ups. showModal where it exists; the `open` attribute where it does
  // not, so an old tablet still shows the text rather than nothing.
  function open(id) {
    const d = $(id);
    if (d.open) return;
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
    if (id === "paperDialog") { const t = $("tape"); t.scrollTop = t.scrollHeight; }
  }

  function lamp(letter, on) {
    if (lamps[letter]) lamps[letter].classList.toggle("lit", on);
  }
  function keyDown(letter, on) {
    if (keys[letter]) keys[letter].classList.toggle("down", on);
  }
  function lampsOff() {
    Object.keys(lamps).forEach((l) => lamps[l].classList.remove("lit"));
    Object.keys(keys).forEach((k) => keys[k].classList.remove("down"));
  }

  // The paper strip. Older rounds stay on it, dimmed, so you can type a message,
  // press "Reset rotors", type the code and see the message come back next to it.
  function tape(rounds) {
    const box = $("tape");
    const used = rounds.filter((r) => r.typed);
    box.textContent = "";
    $("tapeEmpty").hidden = used.length > 0;
    used.forEach((r, n) => {
      const isNow = n === used.length - 1;
      const round = document.createElement("div");
      round.className = "round" + (isNow ? " now" : "");
      const head = document.createElement("div");
      head.className = "start-tag";
      head.textContent = "Start " + r.start.split("").join(" ");
      round.appendChild(head);
      [["You typed", r.typed], ["Comes out", r.coded]].forEach(([label, text], j) => {
        const line = document.createElement("div");
        line.className = "line" + (j ? " code" : "");
        const lab = document.createElement("span");
        lab.className = "lab";
        lab.textContent = label;
        line.appendChild(lab);
        R.groups(text).forEach((g) => {
          const span = document.createElement("span");
          span.className = "grp";
          span.textContent = g;
          line.appendChild(span);
        });
        round.appendChild(line);
      });
      box.appendChild(round);
    });
    box.scrollTop = box.scrollHeight;

    // The one-line version on the machine: the code of the current round only.
    const line = $("codeText");
    const now = rounds[rounds.length - 1];
    line.textContent = "";
    if (!now.coded) {
      const ph = document.createElement("span");
      ph.className = "placeholder";
      ph.textContent = "Your code shows up here";
      line.appendChild(ph);
    } else {
      R.groups(now.coded).forEach((g) => {
        const span = document.createElement("span");
        span.textContent = g;
        line.appendChild(span);
      });
    }
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  function muteState(muted) {
    const b = $("mute");
    b.textContent = muted ? "🔇" : "🔊";
    b.setAttribute("aria-label", muted ? "Sound off" : "Sound on");
    b.setAttribute("aria-pressed", muted ? "true" : "false");
  }

  // ── Screens and the mission panel ─────────────────────────────────────────
  // Small DOM helper: el("div", "class", "text", [children]).
  function el(tag, cls, text, kids) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    (kids || []).forEach((k) => k && e.appendChild(k));
    return e;
  }
  const starText = (n, of) => "★".repeat(n) + "☆".repeat((of || 3) - n);

  function screen(name) {
    ["story", "home", "play"].forEach((s) => { $(s).hidden = s !== name; });
    // Off the machine, the way out is to the games; on it, back to the menu.
    $("back").hidden = name === "play";
    $("toMenu").hidden = name !== "play";
  }

  function story(paras) {
    const box = $("storyText");
    box.textContent = "";
    paras.forEach((t) => box.appendChild(el("p", "", t)));
  }

  // items: [{ name, line, best, locked }]
  function home(items, total, max, next, onPick) {
    $("starTotal").textContent = "★ " + total + " / " + max;
    const list = $("missionList");
    list.textContent = "";
    items.forEach((it, i) => {
      const b = el("button", "mission-card" + (it.locked ? " locked" : "") + (it.best ? " done" : ""), null, [
        el("span", "num", String(i + 1)),
        el("span", "what", null, [el("b", "", it.name), el("small", "", it.line)]),
        el("span", "got", it.locked ? "🔒" : starText(it.best))
      ]);
      b.type = "button";
      b.disabled = it.locked;
      b.setAttribute("aria-label", "Mission " + (i + 1) + ": " + it.name + (it.locked ? ", locked" : ", " + it.best + " stars"));
      b.addEventListener("click", () => onPick(i));
      list.appendChild(b);
    });
    $("nextBtn").textContent = next.label;
    $("nextBtn").onclick = next.go;
  }

  // Which panels the play screen shows: the toolbar in free play, the
  // mission info, note and actions in a mission.
  function mode(mission, kind) {
    document.body.classList.toggle("in-mission", mission);
    document.body.dataset.kind = mission ? kind : "";
    ["mInfo", "mNote", "mActions"].forEach((id) => { $(id).hidden = !mission; });
    document.querySelector(".tools").hidden = mission;
  }

  function missionInfo(kicker, name, stars, say) {
    $("mKicker").textContent = kicker;
    $("mName").textContent = name;
    $("mStars").textContent = starText(stars);
    $("mStars").setAttribute("aria-label", stars + " stars");
    const box = $("mSay");
    box.textContent = "";
    [].concat(say).forEach((t) => box.appendChild(el("span", "", t)));
  }

  // The spy note. Each item is one row; see app.js for what goes in it.
  function note(items, onSpot) {
    const box = $("mNote");
    box.textContent = "";
    items.forEach((it) => {
      if (it.fact) { box.appendChild(el("p", "fact", null, [el("b", "", "📜 True story: "), document.createTextNode(it.fact)])); return; }
      if (it.clue) { box.appendChild(el("p", "clue", it.clue)); return; }
      if (it.crib) { box.appendChild(cribRows(it.crib, onSpot)); return; }
      const row = el("div", "n-row", null, [el("span", "lab", it.lab)]);
      if (it.big) row.appendChild(el("span", "big", it.big.split("").join(" ")));
      if (it.letters != null) {
        // The code to type: done letters dim, the next one boxed.
        const line = el("span", "letters");
        it.letters.split("").forEach((ch, i) => {
          if (i && i % 5 === 0) line.appendChild(el("span", "gap"));
          line.appendChild(el("span", i < it.at ? "done" : i === it.at ? "next" : "", ch));
        });
        row.appendChild(line);
      }
      if (it.raw != null) row.appendChild(el("span", "out", it.raw));
      if (it.text != null) row.appendChild(el("span", "out" + (it.text ? "" : " empty"), it.text ? R.groups(it.text).join(" ") : (it.empty || "…")));
      box.appendChild(row);
    });
  }

  // Turing's trick: the code on one line, WEATHER slid under it at the chosen
  // spot, and a button per spot. Same letters stacked go red when shown.
  function cribRows(c, onSpot) {
    const wrap = el("div", "crib");
    const n = c.code.length;
    const top = el("div", "cells code");
    const bot = el("div", "cells word");
    for (let i = 0; i < n; i++) {
      const bad = c.clash.indexOf(i) >= 0;
      top.appendChild(el("span", bad ? "bad" : "", c.code[i]));
      const k = c.spot == null ? -1 : i - c.spot;
      bot.appendChild(el("span", (k >= 0 && k < c.crib.length ? "on" : "") + (bad ? " bad" : ""), k >= 0 && k < c.crib.length ? c.crib[k] : ""));
    }
    wrap.appendChild(el("div", "lab", "The code"));
    wrap.appendChild(top);
    wrap.appendChild(bot);
    const spots = el("div", "spots");
    c.spots.forEach((s, i) => {
      const b = el("button", "spot" + (c.spot === s ? " on" : "") + (c.ruled.indexOf(s) >= 0 ? " ruled" : ""), "Spot " + (i + 1));
      b.type = "button";
      b.disabled = c.locked;
      b.addEventListener("click", () => onSpot(s));
      spots.appendChild(b);
    });
    wrap.appendChild(spots);
    return wrap;
  }

  // buttons: [{ label, go, main, off }]
  function actions(buttons) {
    const box = $("mActions");
    box.textContent = "";
    buttons.forEach((b) => {
      const e = el("button", "btn" + (b.main ? " go" : " plain"), b.label);
      e.type = "button";
      e.disabled = !!b.off;
      e.addEventListener("click", b.go);
      box.appendChild(e);
    });
  }

  // Rings a mission does not want touched have their arrows switched off;
  // the ones to find are marked.
  function rotorState(locked, missing) {
    document.querySelectorAll(".rotor").forEach((r, i) => {
      r.querySelectorAll("button").forEach((b) => { b.disabled = !!locked[i]; });
      r.classList.toggle("missing", !!(missing && missing[i]));
    });
  }
  function nudgeRotors() {
    const r = document.querySelector(".rotors");
    r.classList.remove("nudge");
    void r.offsetWidth;
    r.classList.add("nudge");
  }
  function glowKey(letter) {
    Object.keys(keys).forEach((k) => keys[k].classList.toggle("hint", k === letter));
  }
  function shakeKey(letter) {
    const k = keys[letter];
    if (!k) return;
    k.classList.remove("wrong");
    void k.offsetWidth;
    k.classList.add("wrong");
  }

  return {
    build, open, showRotors, showStart, lamp, keyDown, lampsOff, tape, toast, muteState,
    screen, story, home, mode, missionInfo, note, actions, rotorState, nudgeRotors, glowKey, shakeKey
  };
})();
