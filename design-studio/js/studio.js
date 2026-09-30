/* Design Studio - the open poster studio, my paints, and the gallery.         */
/*                                                                             */
/* The poster being worked on lives in store.draft, so leaving never loses    */
/* it. Paints mixed in the studio join the palette (8 at most), and saved     */
/* posters go to store.gallery (12 at most). All on this device.              */
"use strict";
window.DS = window.DS || {};

DS.Studio = (function () {
  const $ = (id) => document.getElementById(id);
  const MAX = 12, MAX_PAINTS = 8;
  const NAMES = ["Sunny", "Super", "Rainbow", "Rocket", "Ocean", "Jungle", "Party", "Cosmic", "Happy", "Mighty"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let store = null, save = null, toast = null, ed = null, mixed = null;

  function fresh() {
    return { id: null, name: pick(NAMES) + " Poster", dirty: false,
      poster: { bg: "#fff3d6", title: { text: "HELLO!", color: "#e53935", x: 150, y: 80, size: 48 }, items: [{ k: "sticker", e: "🌈", x: 150, y: 230, s: 110 }] } };
  }
  function init(s, onSave, onToast) {
    store = s; save = onSave; toast = onToast;
    if (!store.draft) store.draft = fresh();
    if (!Array.isArray(store.gallery)) store.gallery = [];
    if (!Array.isArray(store.paints)) store.paints = [];
  }
  const d = () => store.draft;
  const palette = () => DS.PALETTE.concat(store.paints);

  function open() {
    $("sName").innerHTML = `${esc(d().name)} <small aria-hidden="true">✏️</small>`;
    ed = DS.Poster.editor($("sEditor"), d().poster, { palette, onChange: () => { d().dirty = true; save(); } });
  }
  function rename() {
    const n = prompt("Name your poster", d().name);
    if (n == null || !n.trim()) return;
    d().name = n.trim().slice(0, 28);
    d().dirty = true;
    save();
    open();
  }
  function newPoster() {
    if (d().dirty && !confirm("Start a new poster? Anything you haven't saved will be gone.")) return;
    store.draft = fresh();
    save();
    open();
  }
  function savePoster() {
    const dr = d();
    const at = dr.id ? store.gallery.findIndex((x) => x.id === dr.id) : -1;
    const entry = { id: dr.id || Date.now(), name: dr.name, poster: JSON.parse(JSON.stringify(dr.poster)), at: Date.now() };
    if (at >= 0) store.gallery[at] = entry;
    else if (store.gallery.length >= MAX) { toast("Your gallery is full (" + MAX + " posters). Delete one first!"); return; }
    else store.gallery.unshift(entry);
    dr.id = entry.id;
    dr.dirty = false;
    save();
    DS.Audio.right();
    toast("Saved to My posters! 💾");
  }

  // ── Mixing your own paint ──────────────────────────────────────────────────
  function mixer() {
    mixed = null;
    $("mixKeep").disabled = true;
    DS.mixer($("mixBox"), { paints: DS.Colour.PAINTS.map((p) => p.id), onChange: (hex) => { mixed = hex; $("mixKeep").disabled = !hex; } });
    $("mixDialog").showModal();
  }
  function keep() {
    if (!mixed) return;
    if (!store.paints.includes(mixed)) {
      store.paints.push(mixed);
      // Oldest paint makes way, so the palette never gets too long to use.
      if (store.paints.length > MAX_PAINTS) store.paints.shift();
    }
    save();
    $("mixDialog").close();
    DS.Audio.right();
    toast("Your paint is in the palette! 🎨");
    if (ed) ed.paint();
  }

  // ── The gallery ────────────────────────────────────────────────────────────
  function gallery(edit) {
    const box = $("posterList");
    box.innerHTML = "";
    $("postersInfo").textContent = store.gallery.length + " of " + MAX + " saved";
    if (!store.gallery.length) {
      box.innerHTML = '<div class="card empty"><p class="big-emoji" aria-hidden="true">🖼️</p><p><b>No posters yet.</b></p><p>Make one in the studio and tap 💾 Save.</p></div>';
      return;
    }
    store.gallery.forEach((x) => {
      const card = document.createElement("div");
      card.className = "art card";
      card.innerHTML = `<div class="thumb">${DS.Poster.svg(x.poster, null, 'aria-hidden="true"')}</div><b>${esc(x.name)}</b>`;
      const acts = document.createElement("div");
      acts.className = "art-acts";
      const mk = (cls, html, label, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.innerHTML = html; b.setAttribute("aria-label", label + " " + x.name); b.addEventListener("click", fn); return b; };
      acts.append(
        mk("btn small", "Open", "Open", () => {
          if (d().dirty && d().id !== x.id && !confirm("Open this poster? Anything you haven't saved in the studio will be gone.")) return;
          store.draft = { id: x.id, name: x.name, poster: JSON.parse(JSON.stringify(x.poster)), dirty: false };
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

  return { init, open, rename, newPoster, savePoster, mixer, keep, gallery };
})();
