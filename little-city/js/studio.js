/* Little City - the sandbox and the saved towns.                              */
/*                                                                             */
/* The town being built lives in store.draft, so leaving never loses it.      */
/* Saving copies it into store.gallery (6 at most: towns are bigger than a    */
/* poster). Money can be switched on for a real mayor's challenge.            */
"use strict";
window.LC = window.LC || {};

LC.Studio = (function () {
  const $ = (id) => document.getElementById(id);
  const MAX = 6, W = 10, H = 8, BUDGET = 300;
  const NAMES = ["Sunnyville", "Koala Creek", "Maple Town", "Rocket City", "Wattle Park", "Seaside", "Hilltop", "Bluegum Bay"];
  const TOOLS = ["road", "house", "flats", "park", "shop", "school", "clinic", "fire", "factory", "bulldoze"];
  const NEEDS = ["road", "school", "clinic", "fire", "shop", "park", "noise", "job"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const copy = (x) => JSON.parse(JSON.stringify(x));
  let store = null, save = null, toast = null;

  function blank() {
    const rows = Array.from({ length: H }, (_, y) => (y === 4 ? "E" : ".") + ".".repeat(W - 1));
    rows[1] = "..^^......"; rows[6] = "......~~~."; rows[7] = ".....~~~~.";
    return LC.Sim.parse(rows);
  }
  function fresh() { return { id: null, name: pick(NAMES), grid: blank(), money: false, dirty: false }; }
  function init(s, onSave, onToast) {
    store = s; save = onSave; toast = onToast;
    if (!store.draft) store.draft = fresh();
    if (!Array.isArray(store.gallery)) store.gallery = [];
  }
  const d = () => store.draft;

  function open() {
    $("sName").innerHTML = `${esc(d().name)} <small aria-hidden="true">✏️</small>`;
    $("sMoney").setAttribute("aria-pressed", String(!!d().money));
    $("sMoney").innerHTML = d().money ? "💰 Money: on" : "💰 Money: off";
    const level = { tools: TOOLS, needs: NEEDS, money: d().money ? BUDGET : null };
    LC.board($("sEditor"), d().grid, { level, onChange: () => { d().dirty = true; save(); } });
  }
  function toggleMoney() { d().money = !d().money; save(); open(); toast(d().money ? "You have " + BUDGET + " coins. Keep the town out of the red!" : "Money off: build anything!"); }
  function rename() {
    const n = prompt("What's your town called?", d().name);
    if (n == null || !n.trim()) return;
    d().name = n.trim().slice(0, 24);
    d().dirty = true;
    save();
    open();
  }
  function newTown() {
    if (d().dirty && !confirm("Start a new town? Anything you haven't saved will be gone.")) return;
    store.draft = fresh();
    save();
    open();
  }
  function saveTown() {
    const dr = d();
    const at = dr.id ? store.gallery.findIndex((x) => x.id === dr.id) : -1;
    const entry = { id: dr.id || Date.now(), name: dr.name, grid: copy(dr.grid), money: dr.money, at: Date.now() };
    if (at >= 0) store.gallery[at] = entry;
    else if (store.gallery.length >= MAX) { toast("You have " + MAX + " towns saved. Delete one first!"); return; }
    else store.gallery.unshift(entry);
    dr.id = entry.id;
    dr.dirty = false;
    save();
    LC.Audio.right();
    toast("Saved to My towns! 💾");
  }

  function gallery(edit) {
    const box = $("townList");
    box.innerHTML = "";
    $("townsInfo").textContent = store.gallery.length + " of " + MAX + " saved";
    if (!store.gallery.length) {
      box.innerHTML = '<div class="card empty"><p class="big-emoji" aria-hidden="true">🏙️</p><p><b>No towns yet.</b></p><p>Build one in the sandbox and tap 💾 Save.</p></div>';
      return;
    }
    store.gallery.forEach((x) => {
      const st = LC.Sim.evaluate(x.grid, NEEDS);
      const card = document.createElement("div");
      card.className = "town card";
      card.innerHTML = `<div class="thumb">${LC.mapSvg(x.grid, st, { attrs: 'aria-hidden="true"' })}</div><div class="town-body"><b>${esc(x.name)}</b><small>👥 ${st.people} people · 😀 ${st.happy} happy</small></div>`;
      const acts = document.createElement("div");
      acts.className = "town-acts";
      const mk = (cls, html, label, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.innerHTML = html; b.setAttribute("aria-label", label + " " + x.name); b.addEventListener("click", fn); return b; };
      acts.append(
        mk("btn small", "Open", "Open", () => {
          if (d().dirty && d().id !== x.id && !confirm("Open this town? Anything you haven't saved in the sandbox will be gone.")) return;
          store.draft = { id: x.id, name: x.name, grid: copy(x.grid), money: x.money, dirty: false };
          save();
          edit();
        }),
        mk("icon-btn", "🗑️", "Delete", () => {
          if (!confirm("Delete " + x.name + "?")) return;
          store.gallery = store.gallery.filter((y) => y.id !== x.id);
          if (d().id === x.id) d().id = null;
          save();
          gallery(edit);
        }));
      card.appendChild(acts);
      box.appendChild(card);
    });
  }

  return { init, open, rename, newTown, saveTown, toggleMoney, gallery };
})();
