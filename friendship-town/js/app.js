/* Friendship Town - app state: which screen, which lesson, stars, stickers.  */
"use strict";
window.FT = window.FT || {};

FT.allLessons = () => FT.CHAPTERS.flatMap((c) => c.lessons);

(function () {
  const { $ } = FT.UI;
  const KEY = "friendship-town";

  // ── Saved progress ─────────────────────────────────────────────────────────
  const store = { stars: {}, muted: false, seenHelp: false };
  try { Object.assign(store, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode or junk */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } report(); };
  const starsOf = (id) => store.stars[id] || 0;
  // Lessons open one at a time inside a place; the places are all open, so a
  // kid who wants the football club first can go straight there.
  const unlocked = (c, i) => i === 0 || starsOf(c.lessons[i - 1].id) > 0;
  // Tell the Game Box home page how far you've got (its stars badge).
  function report() {
    const all = FT.allLessons();
    const got = all.reduce((s, l) => s + starsOf(l.id), 0);
    try { localStorage.setItem("gamebox:progress:friendship-town", JSON.stringify({ stars: got, max: all.length * 3, at: Date.now() })); } catch (e) { /* ignore */ }
  }

  let ch = null, idx = 0, stop = null, screen = "home";
  const TITLES = { home: "Friendship Town", book: "Friend Book", grown: "For grown-ups" };
  // Every screen below home gets a history entry, so a phone's back swipe
  // (or the browser's back button) steps out one screen at a time instead of
  // leaving the game. The ‹ Back button goes the same way, through history,
  // so the two never disagree.
  const DEPTH = { home: 0, chapter: 1, book: 1, grown: 1, play: 2 };
  const depthNow = () => (history.state && history.state.ftDepth) || 0;

  function show(name) {
    if (stop) { stop(); stop = null; }
    if (DEPTH[name] > depthNow()) history.pushState({ ftDepth: DEPTH[name] }, "");
    screen = name;
    ["home", "chapter", "play", "book", "grown"].forEach((s) => { $(s).hidden = s !== name; });
    $("back").hidden = name !== "home";
    $("up").hidden = name === "home";
    $("up").innerHTML = "&lsaquo; " + (name === "play" && ch ? ch.place.split(" ").pop() : "Home");
    $("title").textContent = TITLES[name] || (name === "chapter" ? ch.place : ch.lessons[idx].name);
    window.scrollTo(0, 0);
  }
  $("up").addEventListener("click", () => { FT.Audio.click(); history.back(); });

  // Back from anywhere: close what's open, then show the screen one level up.
  window.addEventListener("popstate", () => {
    closeDialogs();
    if (depthNow() === 1 && ch && screen === "play") openChapter(ch.id);
    else if (depthNow() < DEPTH[screen]) goHome();
  });
  let chosen = true;
  function closeDialogs() {
    document.querySelectorAll("dialog[open]").forEach((d) => { chosen = true; d.close(); });
  }

  function goHome() {
    ch = null;
    FT.UI.home(starsOf, openChapter);
    show("home");
  }
  function openChapter(id) {
    ch = FT.CHAPTERS.find((c) => c.id === id);
    FT.UI.chapter(ch, starsOf, unlocked, play);
    show("chapter");
  }

  function play(i) {
    idx = i;
    const l = ch.lessons[i];
    show("play");
    $("play").style.setProperty("--law", ch.color);
    FT.UI.P.goal(l.emoji + " " + l.name, l.type === "ladder" ? l.goal : l.intro);
    stop = FT.Games[l.type](l, (stars, text) => finish(l, stars, text));
  }

  function finish(l, stars, text) {
    const first = !starsOf(l.id);
    store.stars[l.id] = Math.max(stars, starsOf(l.id));
    save();
    FT.Audio.win();
    const next = idx + 1 < ch.lessons.length;
    chosen = false;
    FT.UI.win(stars, l, text + (first ? " A new sticker for your Friend Book!" : ""), next);
  }

  $("winAgain").addEventListener("click", () => { FT.Audio.click(); chosen = true; $("winDialog").close(); play(idx); });
  $("winNext").addEventListener("click", () => {
    FT.Audio.click();
    chosen = true;
    $("winDialog").close();
    if (idx + 1 < ch.lessons.length) play(idx + 1); else history.back();
  });
  // Closed some other way (Escape, Android's back gesture): the lesson is
  // saved, so step back to the place's lesson list rather than leaving a
  // finished lesson on screen.
  $("winDialog").addEventListener("close", () => { if (!chosen) { chosen = true; history.back(); } });
  $("bookBtn").addEventListener("click", () => { FT.Audio.click(); FT.UI.book(starsOf); show("book"); });
  $("grownBtn").addEventListener("click", () => { FT.Audio.click(); FT.UI.grown(); show("grown"); });

  // ── Sound and help ─────────────────────────────────────────────────────────
  function setMute(v) {
    store.muted = v;
    FT.Audio.setMuted(v);
    $("mute").innerHTML = v ? "&#128263;" : "&#128266;";
    $("mute").setAttribute("aria-pressed", String(v));
    $("mute").setAttribute("aria-label", v ? "Sound off" : "Sound on");
  }
  $("mute").addEventListener("click", () => { setMute(!store.muted); save(); FT.Audio.click(); });
  $("help").addEventListener("click", () => { FT.Audio.click(); $("helpDialog").showModal(); });
  $("helpClose").addEventListener("click", () => { FT.Audio.click(); $("helpDialog").close(); });
  // Mobile browsers only allow sound after a touch.
  document.addEventListener("pointerdown", () => FT.Audio.ready(), { once: true });

  setMute(!!store.muted);
  report();
  // A reload mid-game starts again at home.
  if (depthNow()) history.replaceState({ ftDepth: 0 }, "");
  goHome();
  if (!store.seenHelp) { store.seenHelp = true; save(); $("helpDialog").showModal(); }
})();
