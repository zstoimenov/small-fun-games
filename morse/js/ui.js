/* Morse Agent - everything that touches the page.                              */
/*                                                                              */
/* ui.js draws and reports; it never decides anything. The app says what to     */
/* show and hands over callbacks. What counts as right is rules.js's business.  */
"use strict";
window.MO = window.MO || {};

MO.UI = (function () {
  const R = MO.Rules;
  const $ = (id) => document.getElementById(id);
  let toastTimer = 0;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Dots and dashes drawn as shapes, not "." and "-": a full stop is too small
  // to see from arm's length and a hyphen looks like a minus sign.
  function pattern(p, cls) {
    return '<span class="pat ' + (cls || "") + '">' +
      p.split("").map((s) => (s === "." ? '<i class="dot"></i>' : '<i class="dash"></i>')).join("") +
      "</span>";
  }

  function screen(id, title) {
    ["hq", "play", "duo", "story"].forEach((s) => { $(s).hidden = s !== id; });
    // The stylesheet sizes play, story and duo to the window; HQ is a menu.
    document.body.dataset.screen = id;
    $("back").hidden = id !== "hq";
    $("toHq").hidden = id === "hq";
    $("title").textContent = title || "Morse Agent";
    window.scrollTo(0, 0);
  }

  function lamp(on) { $("lamp").classList.toggle("on", !!on); }
  function lampShown(v) { $("lamp").hidden = !v; }

  function signal(html) { $("signal").innerHTML = html || ""; }
  function hq(text) { $("hqMsg").innerHTML = text || ""; }

  // The row of little lights along the top of a mission: where you are.
  function steps(list, cur) {
    $("steps").innerHTML = list.map((s, i) =>
      '<span class="step' + (i < cur ? " done" : i === cur ? " now" : "") + '">' + esc(s) + "</span>").join("");
  }

  function stage(html) {
    const el = $("stage");
    el.innerHTML = html;
    return el;
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function open(id) {
    const d = $(id);
    if (d.open) return;
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  }
  function close(id) {
    const d = $(id);
    if (d.close) d.close(); else d.removeAttribute("open");
  }

  // Letter tiles. `patterns` puts the dots and dashes under each letter.
  function tiles(host, letters, patterns, onPick) {
    host.innerHTML = "";
    host.classList.toggle("with-pat", !!patterns);
    letters.forEach((ch) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tile";
      b.dataset.ch = ch;
      b.innerHTML = "<b>" + ch + "</b>" + (patterns ? pattern(R.CODE[ch]) : "");
      b.addEventListener("click", () => onPick(ch, b));
      host.appendChild(b);
    });
  }

  // The telegraph key. pointerdown/up, not click: the length of the press IS the
  // message. Pointer capture keeps a wandering finger from ending the press early.
  function teleKey(host, onDown, onUp) {
    const k = document.createElement("button");
    k.type = "button";
    k.className = "tkey";
    k.setAttribute("aria-label", "Telegraph key. Tap for a dot, hold for a dash. Space bar works too.");
    k.innerHTML = '<span class="arm"></span><span class="knob"></span><span class="base">TAP &middot; HOLD</span>';
    const down = (e) => {
      e.preventDefault();
      try { k.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      k.classList.add("down");
      onDown(performance.now());
    };
    const up = () => {
      if (!k.classList.contains("down")) return;
      k.classList.remove("down");
      onUp(performance.now());
    };
    k.addEventListener("pointerdown", down);
    k.addEventListener("pointerup", up);
    k.addEventListener("pointercancel", up);
    k.addEventListener("contextmenu", (e) => e.preventDefault());
    host.appendChild(k);
    return k;
  }

  // The difficulty lever. Three notches; drag the handle or tap a label. It
  // snaps to the nearest notch on release - a lever that can rest between
  // "Rookie" and "Agent" would be a setting nobody can name.
  function lever(value, onChange) {
    const el = $("lever");
    const handle = el.querySelector(".handle");
    let v = value, dragging = false;

    function place(frac, animate) {
      handle.style.transition = animate ? "" : "none";
      handle.style.left = "calc(22px + " + frac + " * (100% - 44px))";
      handle.style.setProperty("--tilt", ((frac - 0.5) * 40) + "deg");
    }
    function set(n, tell) {
      v = Math.max(0, Math.min(2, n));
      place(v / 2, true);
      el.setAttribute("aria-valuenow", v);
      el.setAttribute("aria-valuetext", R.LEVELS[v].name);
      el.querySelectorAll(".stops span").forEach((s) => s.classList.toggle("on", +s.dataset.v === v));
      if (tell) onChange(v);
    }
    const fracAt = (x) => {
      const r = el.querySelector(".slot").getBoundingClientRect();
      return Math.max(0, Math.min(1, (x - r.left) / r.width));
    };
    el.addEventListener("pointerdown", (e) => {
      if (el.classList.contains("locked")) return;
      e.preventDefault();
      dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      place(fracAt(e.clientX), false);
    });
    el.addEventListener("pointermove", (e) => { if (dragging) place(fracAt(e.clientX), false); });
    const drop = (e) => {
      if (!dragging) return;
      dragging = false;
      const n = Math.round(fracAt(e.clientX) * 2);
      set(n, n !== v);
      if (n === v) place(v / 2, true);
    };
    el.addEventListener("pointerup", drop);
    el.addEventListener("pointercancel", () => { dragging = false; place(v / 2, true); });
    el.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); if (v > 0) set(v - 1, true); }
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); if (v < 2) set(v + 1, true); }
    });
    set(value, false);
    return { set: (n) => set(n, false) };
  }

  function seg(id, value, onChange) {
    const host = $(id);
    const mark = (v) => host.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === String(v)));
    host.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { mark(b.dataset.v); onChange(+b.dataset.v); }));
    mark(value);
  }

  // Close buttons and a tap on the dim backdrop close any pop-up.
  document.querySelectorAll("dialog").forEach((d) => {
    d.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => close(d.id)));
    d.addEventListener("click", (e) => { if (e.target === d) close(d.id); });
  });

  return { $, esc, pattern, screen, lamp, lampShown, signal, hq, steps, stage, toast, open, close, tiles, teleKey, lever, seg };
})();
