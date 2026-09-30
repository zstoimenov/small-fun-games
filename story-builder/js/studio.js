/* Story Builder - the open studio (a story mountain) and the bookshelf.       */
/*                                                                             */
/* The story being written lives in store.draft, so leaving never loses it.   */
/* Saving copies it onto store.gallery (12 at most, on this device), where    */
/* each story shows as a little book that can be read aloud.                  */
"use strict";
window.SB = window.SB || {};

SB.Studio = (function () {
  const $ = (id) => document.getElementById(id);
  const MAX = 12;
  const COVERS = ["🐉", "🏴‍☠️", "🚀", "🦄", "🤖", "🧸", "🏰", "🌋", "🐶", "🧙", "🌊", "👻"];
  const TABS = ["who", "wow", "did", "where", "when", "adj", "thing", "join", "feel", "opener", "mark"];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const storyText = (parts) => parts.map((p) => SB.Words.text(p)).filter(Boolean).join(" ");
  let store = null, save = null, toast = null;

  function fresh() { return { id: null, title: "My Story", cover: COVERS[Math.floor(Math.random() * COVERS.length)], parts: SB.PARTS.map(() => []), dirty: false }; }
  function init(s, onSave, onToast) {
    store = s; save = onSave; toast = onToast;
    if (!store.draft) store.draft = fresh();
    if (!Array.isArray(store.gallery)) store.gallery = [];
  }
  const d = () => store.draft;
  const touch = () => { d().dirty = true; save(); };

  function open() {
    $("sName").innerHTML = `<span aria-hidden="true">${d().cover}</span> ${esc(d().title)} <small aria-hidden="true">✏️</small>`;
    const covers = $("sCovers");
    covers.innerHTML = "";
    COVERS.forEach((e) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cover-pick";
      b.textContent = e;
      b.setAttribute("aria-label", "Cover " + e);
      b.setAttribute("aria-pressed", String(d().cover === e));
      b.addEventListener("click", () => { d().cover = e; touch(); open(); });
      covers.appendChild(b);
    });
    SB.mountain($("sEditor"), d().parts, { tabs: TABS, onChange: touch });
  }
  function rename() {
    const n = prompt("What's your story called?", d().title);
    if (n == null || !n.trim()) return;
    d().title = n.trim().slice(0, 32);
    touch();
    open();
  }
  function newStory() {
    if (d().dirty && !confirm("Start a new story? Anything you haven't saved will be gone.")) return;
    store.draft = fresh();
    save();
    open();
  }
  function saveStory() {
    const dr = d();
    if (!storyText(dr.parts)) { toast("Write something first! ✏️"); return; }
    const at = dr.id ? store.gallery.findIndex((x) => x.id === dr.id) : -1;
    const entry = { id: dr.id || Date.now(), title: dr.title, cover: dr.cover, parts: copy(dr.parts), at: Date.now() };
    if (at >= 0) store.gallery[at] = entry;
    else if (store.gallery.length >= MAX) { toast("Your bookshelf is full (" + MAX + " stories). Delete one first!"); return; }
    else store.gallery.unshift(entry);
    dr.id = entry.id;
    dr.dirty = false;
    save();
    SB.Audio.right();
    toast("Saved to My stories! 💾");
  }

  // ── The bookshelf ──────────────────────────────────────────────────────────
  function gallery(edit) {
    SB.Audio.hush();
    const box = $("storyList");
    box.innerHTML = "";
    $("storiesInfo").textContent = store.gallery.length + " of " + MAX + " saved";
    if (!store.gallery.length) {
      box.innerHTML = '<div class="card empty"><p class="big-emoji" aria-hidden="true">📚</p><p><b>No stories yet.</b></p><p>Write one in the studio and tap 💾 Save.</p></div>';
      return;
    }
    store.gallery.forEach((x) => {
      const card = document.createElement("div");
      card.className = "book card";
      card.innerHTML = `<div class="book-cover" aria-hidden="true">${x.cover}</div><div class="book-body"><b>${esc(x.title)}</b><p>${esc(storyText(x.parts))}</p></div>`;
      const acts = document.createElement("div");
      acts.className = "book-acts";
      const mk = (cls, html, label, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.innerHTML = html; b.setAttribute("aria-label", label + " " + x.title); b.addEventListener("click", fn); return b; };
      if (SB.Audio.canSpeak()) {
        const read = mk("btn small", "🔊 Read", "Read aloud", () => {
          if (read.dataset.on) { SB.Audio.hush(); return; }
          box.querySelectorAll(".book [data-on]").forEach((b) => b.click());
          read.dataset.on = "1";
          read.textContent = "■ Stop";
          SB.Audio.speak(x.title + ". " + storyText(x.parts), () => { delete read.dataset.on; read.textContent = "🔊 Read"; });
        });
        acts.appendChild(read);
      }
      acts.append(
        mk("btn ghost small", "Open", "Open", () => {
          if (d().dirty && d().id !== x.id && !confirm("Open this story? Anything you haven't saved in the studio will be gone.")) return;
          store.draft = { id: x.id, title: x.title, cover: x.cover, parts: copy(x.parts), dirty: false };
          save();
          edit();
        }),
        mk("icon-btn", "🗑️", "Delete", () => {
          if (!confirm("Delete " + x.title + "?")) return;
          store.gallery = store.gallery.filter((y) => y.id !== x.id);
          if (d().id === x.id) d().id = null;
          save();
          gallery(edit);
        }));
      card.appendChild(acts);
      box.appendChild(card);
    });
  }

  return { init, open, rename, newStory, saveStory, gallery };
})();
