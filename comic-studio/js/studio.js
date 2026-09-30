/* Comic Studio - the open studio and the gallery of saved comics.             */
/*                                                                             */
/* The comic being worked on lives in store.draft, so leaving never loses it. */
/* Saving copies it into store.gallery (12 at most, on this device).          */
"use strict";
window.CS = window.CS || {};

CS.Studio = (function () {
  const $ = (id) => document.getElementById(id);
  const MAX = 12;
  const NAMES = ["The Big Day", "Super Sam", "Biscuit's Adventure", "Bolt Saves the Day", "Mia's Mystery", "The Lost Kite", "Space Trip", "Beach Party"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const copy = (x) => JSON.parse(JSON.stringify(x));
  let store = null, save = null, toast = null;

  function fresh() {
    const empty = (scene) => ({ scene, chars: [], props: [], bubbles: [] });
    const first = empty("park");
    first.chars.push({ c: "sam", face: "happy", x: 110, y: 228, s: 120, flip: false });
    first.bubbles.push({ kind: "caption", text: "Once upon a time...", x: 88, y: 20, tail: 0 });
    return { id: null, name: pick(NAMES), dirty: false, comic: { panels: [first, empty("park"), empty("park")] } };
  }
  function init(s, onSave, onToast) {
    store = s; save = onSave; toast = onToast;
    if (!store.draft) store.draft = fresh();
    if (!Array.isArray(store.gallery)) store.gallery = [];
  }
  const d = () => store.draft;

  function open() {
    $("sName").innerHTML = `${esc(d().name)} <small aria-hidden="true">✏️</small>`;
    CS.Comic.editor($("sEditor"), d().comic, { onChange: () => { d().dirty = true; save(); } });
  }
  function rename() {
    const n = prompt("Name your comic", d().name);
    if (n == null || !n.trim()) return;
    d().name = n.trim().slice(0, 28);
    d().dirty = true;
    save();
    open();
  }
  function newComic() {
    if (d().dirty && !confirm("Start a new comic? Anything you haven't saved will be gone.")) return;
    store.draft = fresh();
    save();
    open();
  }
  function saveComic() {
    const dr = d();
    const at = dr.id ? store.gallery.findIndex((x) => x.id === dr.id) : -1;
    const entry = { id: dr.id || Date.now(), name: dr.name, comic: copy(dr.comic), at: Date.now() };
    if (at >= 0) store.gallery[at] = entry;
    else if (store.gallery.length >= MAX) { toast("Your gallery is full (" + MAX + " comics). Delete one first!"); return; }
    else store.gallery.unshift(entry);
    dr.id = entry.id;
    dr.dirty = false;
    save();
    CS.Audio.right();
    toast("Saved to My comics! 💾");
  }

  // ── The gallery: each comic as a strip you can read ────────────────────────
  function gallery(edit) {
    const box = $("comicList");
    box.innerHTML = "";
    $("comicsInfo").textContent = store.gallery.length + " of " + MAX + " saved";
    if (!store.gallery.length) {
      box.innerHTML = '<div class="card empty"><p class="big-emoji" aria-hidden="true">📚</p><p><b>No comics yet.</b></p><p>Make one in the studio and tap 💾 Save.</p></div>';
      return;
    }
    store.gallery.forEach((x) => {
      const card = document.createElement("div");
      card.className = "saved card";
      card.innerHTML = `<b>${esc(x.name)}</b><div class="strip read">${x.comic.panels.map((p) => `<div class="thumb">${CS.Comic.svg(p, null, 'aria-hidden="true"')}</div>`).join("")}</div>`;
      const acts = document.createElement("div");
      acts.className = "saved-acts";
      const mk = (cls, html, label, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.innerHTML = html; b.setAttribute("aria-label", label + " " + x.name); b.addEventListener("click", fn); return b; };
      acts.append(
        mk("btn small", "Open", "Open", () => {
          if (d().dirty && d().id !== x.id && !confirm("Open this comic? Anything you haven't saved in the studio will be gone.")) return;
          store.draft = { id: x.id, name: x.name, comic: copy(x.comic), dirty: false };
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

  return { init, open, rename, newComic, saveComic, gallery };
})();
