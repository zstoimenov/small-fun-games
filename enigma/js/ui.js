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
    $("copy").addEventListener("click", handlers.copy);
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
    $("startLetters").textContent = text.split("").join(" ");
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
    b.textContent = muted ? "🔇 Sound off" : "🔊 Sound on";
    b.setAttribute("aria-pressed", muted ? "true" : "false");
  }

  return { build, showRotors, showStart, lamp, keyDown, lampsOff, tape, toast, muteState };
})();
