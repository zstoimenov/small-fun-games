/* Cube Timer — everything that has to survive closing the app.                  */
/*                                                                              */
/* Times are the whole point of a timer, so they are written after every single  */
/* solve rather than at the end of a session — a tablet that gets closed         */
/* mid-average must not cost anybody their best time.                           */
/*                                                                              */
/* Every read and write is wrapped: private browsing can make localStorage throw */
/* on write, and a family timer is not worth crashing over. If the store is      */
/* unavailable the app still times solves, it just forgets them.                */
"use strict";
window.CT = window.CT || {};

CT.Store = (function () {

  const KEY = "cubeTimer_v1";
  // Plenty for a family, and small enough that saving stays instant.
  const MAX_SOLVES = 400;

  const blank = () => ({
    v: 1,
    cubers: [{ id: "c1", name: "Me" }],
    who: "c1",
    who2: "",
    puzzle: "3x3",
    mode: "solo",
    bestOf: 3,
    inspection: false,
    sound: true,
    seenHowTo: false,
    // One list per person per cube: "c1|3x3".
    solves: {}
  });

  let data = blank();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.v === 1) data = Object.assign(blank(), saved);
      }
    } catch (e) { /* unreadable or absent — the blank one will do */ }
    // A store with nobody in it would leave the timer with no one to save to.
    if (!data.cubers || !data.cubers.length) data.cubers = blank().cubers;
    if (!cuber(data.who)) data.who = data.cubers[0].id;
    if (data.who2 && !cuber(data.who2)) data.who2 = "";
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* nothing to do */ }
  }

  const all = () => data;
  const cubers = () => data.cubers;
  const cuber = (id) => data.cubers.filter((c) => c.id === id)[0] || null;
  const nameOf = (id) => (cuber(id) ? cuber(id).name : "?");

  function set(key, value) {
    data[key] = value;
    save();
  }

  /* ── People ────────────────────────────────────────────────────────────── */

  const MAX_CUBERS = 4;

  function addCuber(name) {
    if (data.cubers.length >= MAX_CUBERS) return null;
    const clean = String(name || "").trim().slice(0, 12) || "Cuber";
    const id = "c" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
    data.cubers.push({ id: id, name: clean });
    save();
    return id;
  }

  function removeCuber(id) {
    if (data.cubers.length < 2) return;            // somebody has to be cubing
    data.cubers = data.cubers.filter((c) => c.id !== id);
    // Their times go with them, or the store grows forever.
    Object.keys(data.solves).forEach((k) => { if (k.indexOf(id + "|") === 0) delete data.solves[k]; });
    if (data.who === id) data.who = data.cubers[0].id;
    if (data.who2 === id) data.who2 = "";
    save();
  }

  /* ── Times ─────────────────────────────────────────────────────────────── */

  const listKey = (who, puzzle) => who + "|" + puzzle;

  function solves(who, puzzle) {
    return data.solves[listKey(who, puzzle)] || [];
  }

  function addSolve(who, puzzle, solve) {
    const k = listKey(who, puzzle);
    const list = data.solves[k] || (data.solves[k] = []);
    list.push(solve);
    if (list.length > MAX_SOLVES) list.splice(0, list.length - MAX_SOLVES);
    save();
    return list.length - 1;
  }

  function updateSolve(who, puzzle, index, changes) {
    const list = data.solves[listKey(who, puzzle)];
    if (!list || !list[index]) return;
    Object.assign(list[index], changes);
    save();
  }

  function removeSolve(who, puzzle, index) {
    const list = data.solves[listKey(who, puzzle)];
    if (!list || !list[index]) return;
    list.splice(index, 1);
    save();
  }

  function clearSolves(who, puzzle) {
    delete data.solves[listKey(who, puzzle)];
    save();
  }

  return {
    MAX_CUBERS,
    load, save, all, set,
    cubers, cuber, nameOf, addCuber, removeCuber,
    solves, addSolve, updateSolve, removeSolve, clearSolves
  };
})();
