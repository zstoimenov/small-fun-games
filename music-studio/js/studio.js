/* Music Studio - the open studio and the gallery of saved songs.              */
/*                                                                             */
/* The song being worked on lives in store.draft, so leaving the studio never  */
/* loses it. Saving copies it into store.gallery (12 at most, on this device). */
"use strict";
window.MS = window.MS || {};

MS.Studio = (function () {
  const $ = (id) => document.getElementById(id);
  const P = MS.Player;
  const MAX = 12;
  const NAMES = [["🐸", "Frog"], ["🦄", "Unicorn"], ["🚀", "Rocket"], ["🐙", "Octopus"], ["🦖", "Dino"], ["🐝", "Bumblebee"],
    ["🐧", "Penguin"], ["🌋", "Volcano"], ["🐬", "Dolphin"], ["🦊", "Fox"], ["🐨", "Koala"], ["🍕", "Pizza"]];
  const WORDS = ["Groove", "Boogie", "Jam", "Stomp", "Bop", "Wiggle", "Shuffle", "Tune"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  let store = null, save = null, toast = null, g = null, playing = false;

  function fresh() {
    const [emoji, word] = pick(NAMES);
    const song = MS.make({ bpm: 100, kick: "x...x...", snare: "..x...x.", hat: "x.x.x.x." });
    return { id: null, emoji, name: word + " " + pick(WORDS), dirty: false, song: resize(song, store.steps || 8) };
  }
  // 8 to 16 repeats the bar, so the song sounds exactly the same with room to
  // change the second half. 16 to 8 keeps the first half.
  function resize(song, len) {
    const from = song.len || 8;
    Object.keys(song.cells).forEach((id) => {
      const c = song.cells[id];
      song.cells[id] = Array.from({ length: len }, (_, i) => c[i % from] || 0);
    });
    song.len = len;
    return song;
  }
  function init(s, onSave, onToast) {
    store = s; save = onSave; toast = onToast;
    if (!store.draft) store.draft = fresh();
    if (!Array.isArray(store.gallery)) store.gallery = [];
  }
  const d = () => store.draft;
  const changed = () => { d().dirty = true; save(); if (playing) P.swap(d().song); };

  // ── The studio screen ──────────────────────────────────────────────────────
  function open() {
    stop();
    $("sName").innerHTML = `<span aria-hidden="true">${d().emoji}</span> ${esc(d().name)} <small aria-hidden="true">✏️</small>`;
    $("sTempo").innerHTML = "";
    $("sTempo").appendChild(MS.tempo(d().song, changed));
    $("sSound").innerHTML = "";
    $("sSound").append(
      MS.seg(MS.INSTRUMENTS, () => d().song.inst, (v) => { d().song.inst = v; changed(); }, "Instrument"),
      MS.seg(MS.MOODS, () => d().song.mood, (v) => { d().song.mood = v; changed(); }, "Mood"));
    g = MS.grid($("sGrid"), { rows: MS.ROWS.map((r) => r.id), song: d().song, onChange: changed });
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  function settings() { paintSettings(); $("settingsDialog").showModal(); }
  function paintSettings() {
    const box = $("setSteps");
    box.innerHTML = "";
    box.appendChild(MS.seg([{ id: 8, name: "8 steps", emoji: "▫️" }, { id: 16, name: "16 steps", emoji: "▪️" }],
      () => d().song.len || 8, setSteps, "Grid length"));
  }
  function setSteps(len) {
    const song = d().song;
    if ((song.len || 8) === len) return;
    const lost = len < (song.len || 8) && MS.ROWS.some((r) => song.cells[r.id].slice(len).some(Boolean));
    if (lost && !confirm("Going back to 8 steps keeps the first half. The second half will be gone. OK?")) { paintSettings(); return; }
    stop();
    resize(song, len);
    store.steps = len;
    changed();
    open();
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function paintPlay() { $("sPlay").innerHTML = playing ? "■ Stop" : "▶ Play"; $("sPlay").setAttribute("aria-pressed", String(playing)); }
  function toggle() {
    if (playing) { P.stop(); return; }
    playing = true;
    paintPlay();
    P.play(d().song, { loop: true, onStep: (s) => { if (g) g.head(s); if (s < 0) { playing = false; paintPlay(); } } });
  }
  function stop() { P.stop(); playing = false; paintPlay(); }

  function rename() {
    const n = prompt("Name your song", d().name);
    if (n == null || !n.trim()) return;
    d().name = n.trim().slice(0, 28);
    changed();
    open();
  }
  function clear() {
    if (!confirm("Clear every box on the grid?")) return;
    MS.ROWS.forEach((r) => d().song.cells[r.id].fill(0));
    changed();
    g.paint();
  }
  function newSong() {
    if (d().dirty && !confirm("Start a new song? Anything you haven't saved will be gone.")) return;
    store.draft = fresh();
    save();
    open();
  }
  function saveSong() {
    const dr = d();
    const at = dr.id ? store.gallery.findIndex((x) => x.id === dr.id) : -1;
    const entry = { id: dr.id || Date.now(), emoji: dr.emoji, name: dr.name, song: MS.copy(dr.song), at: Date.now() };
    if (at >= 0) store.gallery[at] = entry;
    else if (store.gallery.length >= MAX) { toast("Your gallery is full (" + MAX + " songs). Delete one first!"); return; }
    else store.gallery.unshift(entry);
    dr.id = entry.id;
    dr.dirty = false;
    save();
    MS.Audio.right();
    toast("Saved to My songs! 💾");
  }

  // ── The gallery ────────────────────────────────────────────────────────────
  function gallery(edit) {
    stop();
    const box = $("songList");
    box.innerHTML = "";
    $("songsInfo").textContent = store.gallery.length + " of " + MAX + " saved";
    if (!store.gallery.length) {
      box.innerHTML = '<div class="card empty"><p class="big-emoji" aria-hidden="true">🎼</p><p><b>No songs yet.</b></p><p>Make one in the studio and tap 💾 Save.</p></div>';
      return;
    }
    store.gallery.forEach((x) => {
      const row = document.createElement("div");
      row.className = "song-row card";
      row.innerHTML = `<span class="song-emoji" aria-hidden="true">${x.emoji}</span>
        <span class="song-text"><b>${esc(x.name)}</b><small>${x.song.bpm} beats a minute · ${MS.MOODS.find((m) => m.id === x.song.mood).emoji}</small></span>`;
      const mk = (cls, html, label, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.innerHTML = html; b.setAttribute("aria-label", label + " " + x.name); b.addEventListener("click", fn); return b; };
      let on = false;
      const play = mk("icon-btn", "▶", "Play", () => {
        if (on) { P.stop(); return; }
        on = true; play.textContent = "■"; play.classList.add("playing");
        P.play(x.song, { loop: 2, onStep: (s) => { if (s < 0) { on = false; play.textContent = "▶"; play.classList.remove("playing"); } } });
      });
      const openB = mk("btn", "Open", "Open", () => {
        if (d().dirty && d().id !== x.id && !confirm("Open this song? Anything you haven't saved in the studio will be gone.")) return;
        store.draft = { id: x.id, emoji: x.emoji, name: x.name, song: MS.copy(x.song), dirty: false };
        store.steps = x.song.len || 8;
        save();
        edit();
      });
      const del = mk("icon-btn", "🗑️", "Delete", () => {
        if (!confirm("Delete " + x.name + "?")) return;
        store.gallery = store.gallery.filter((y) => y.id !== x.id);
        if (d().id === x.id) d().id = null;
        save();
        gallery(edit);
      });
      const acts = document.createElement("span");
      acts.className = "song-acts";
      acts.append(play, openB, del);
      row.appendChild(acts);
      box.appendChild(row);
    });
  }

  return { init, open, gallery, stop, toggle, rename, clear, newSong, saveSong, settings };
})();
