/* Footy Tactics Lab — level definitions & progression tracking */
"use strict";
window.FTL = window.FTL || {};

FTL.Levels = (function () {

  /* ── The oval is 8 columns × 6 rows ───────────────────────────────────────
     x runs 0..7 left→right, y runs 0..5 top→bottom, so NORTH is y-1.

     Every level is solvable — `solution` below is the reference play, and
     app.js walks all of them through the engine on boot (selfTest) so a level
     edit can never silently ship an unsolvable puzzle.

     maxBlocks — hard cap on how many blocks fit in the workspace.
     par       — solve in this many blocks or fewer for the third star.
     Blocks are counted the way a kid counts them: every block you place is 1,
     including the ones nested inside a Repeat.                              */

  const LEVELS = [
    {
      id: 1,
      title: "First Kick",
      concept: "Sequencing",
      hint: "Run forward until the posts are close, then kick. You can kick from 3 tiles away.",
      gridSize: [8, 6],
      startPos: [1, 3], startFacing: "EAST",
      goalPos: [6, 3],
      defenders: [],
      allowedBlocks: ["MOVE_FORWARD", "KICK_GOAL"],
      maxBlocks: 6, par: 3,
      solution: ["MOVE_FORWARD", "MOVE_FORWARD", "KICK_GOAL"]
    },
    {
      id: 2,
      title: "Navigating the Flank",
      concept: "Turning & spatial logic",
      hint: "A defender is standing on the straight path. Go around him — turn, run across, then turn back.",
      gridSize: [8, 6],
      startPos: [1, 5], startFacing: "NORTH",
      goalPos: [6, 1],
      defenders: [[1, 2], [3, 5]],
      allowedBlocks: ["MOVE_FORWARD", "ROTATE_LEFT", "ROTATE_RIGHT", "KICK_GOAL"],
      maxBlocks: 12, par: 10,
      solution: [
        "MOVE_FORWARD", "MOVE_FORWARD", "ROTATE_RIGHT",
        "MOVE_FORWARD", "MOVE_FORWARD", "ROTATE_LEFT",
        "MOVE_FORWARD", "MOVE_FORWARD", "ROTATE_RIGHT", "KICK_GOAL"
      ]
    },
    {
      id: 3,
      title: "Boundary Sprint",
      concept: "Loops (Repeat)",
      hint: "That is a LOT of running. Let a Repeat block do it for you.",
      gridSize: [8, 6],
      startPos: [0, 5], startFacing: "NORTH",
      goalPos: [7, 0],
      defenders: [[1, 5], [1, 4], [1, 3]],
      allowedBlocks: ["MOVE_FORWARD", "ROTATE_RIGHT", "REPEAT", "KICK_GOAL"],
      maxBlocks: 8, par: 6,
      solution: [
        { type: "REPEAT", n: 5, body: ["MOVE_FORWARD"] },
        "ROTATE_RIGHT",
        { type: "REPEAT", n: 4, body: ["MOVE_FORWARD"] },
        "KICK_GOAL"
      ]
    },
    {
      id: 4,
      title: "Around the Pocket",
      concept: "Turning both ways",
      hint: "Right turn, run down, left turn, run across. Watch which way you are facing!",
      gridSize: [8, 6],
      startPos: [0, 2], startFacing: "EAST",
      goalPos: [7, 4],
      defenders: [[3, 2], [4, 2], [3, 3]],
      allowedBlocks: ["MOVE_FORWARD", "ROTATE_LEFT", "ROTATE_RIGHT", "KICK_GOAL"],
      maxBlocks: 12, par: 9,
      solution: [
        "MOVE_FORWARD", "MOVE_FORWARD", "ROTATE_RIGHT",
        "MOVE_FORWARD", "MOVE_FORWARD", "ROTATE_LEFT",
        "MOVE_FORWARD", "MOVE_FORWARD", "KICK_GOAL"
      ]
    },
    {
      id: 5,
      title: "The Long Run",
      concept: "Counting your loop",
      hint: "Only 4 blocks fit. How many times does the Repeat need to run?",
      gridSize: [8, 6],
      startPos: [0, 3], startFacing: "EAST",
      goalPos: [7, 3],
      defenders: [[2, 2], [2, 4]],
      allowedBlocks: ["MOVE_FORWARD", "REPEAT", "KICK_GOAL"],
      maxBlocks: 4, par: 3,
      solution: [
        { type: "REPEAT", n: 4, body: ["MOVE_FORWARD"] },
        "KICK_GOAL"
      ]
    },
    {
      id: 6,
      title: "Zig-Zag Wing",
      concept: "A turn inside the loop",
      hint: "Up, right, across, left — and that whole pattern happens three times.",
      gridSize: [8, 6],
      startPos: [1, 5], startFacing: "NORTH",
      goalPos: [4, 0],
      defenders: [[1, 3], [2, 5], [3, 4], [4, 3]],
      allowedBlocks: ["MOVE_FORWARD", "ROTATE_LEFT", "ROTATE_RIGHT", "REPEAT", "KICK_GOAL"],
      maxBlocks: 8, par: 6,
      solution: [
        { type: "REPEAT", n: 3, body: ["MOVE_FORWARD", "ROTATE_RIGHT", "MOVE_FORWARD", "ROTATE_LEFT"] },
        "KICK_GOAL"
      ]
    },
    {
      id: 7,
      title: "Handball Through",
      concept: "Handball",
      hint: "A handball only works when a defender is RIGHT in front of you — it puts you two tiles past him.",
      gridSize: [8, 6],
      startPos: [1, 3], startFacing: "EAST",
      goalPos: [7, 3],
      defenders: [[3, 3]],
      allowedBlocks: ["MOVE_FORWARD", "ROTATE_LEFT", "ROTATE_RIGHT", "HANDBALL", "KICK_GOAL"],
      maxBlocks: 5, par: 3,
      solution: ["MOVE_FORWARD", "HANDBALL", "KICK_GOAL"]
    },
    {
      id: 8,
      title: "Corridor of Defenders",
      concept: "Handball in a loop",
      hint: "Three defenders, all the same gap apart. One Repeat can handle the lot.",
      gridSize: [8, 6],
      startPos: [0, 3], startFacing: "EAST",
      goalPos: [7, 3],
      defenders: [[1, 3], [3, 3], [5, 3]],
      allowedBlocks: ["MOVE_FORWARD", "HANDBALL", "REPEAT", "KICK_GOAL"],
      maxBlocks: 4, par: 3,
      solution: [
        { type: "REPEAT", n: 3, body: ["HANDBALL"] },
        "KICK_GOAL"
      ]
    },
    {
      id: 9,
      title: "The Press",
      concept: "A big loop body",
      hint: "Handball, turn, run, run, turn — then the very same thing again.",
      gridSize: [8, 6],
      startPos: [0, 5], startFacing: "NORTH",
      goalPos: [7, 1],
      defenders: [[0, 4], [1, 5], [2, 2], [3, 3]],
      allowedBlocks: ["MOVE_FORWARD", "ROTATE_LEFT", "ROTATE_RIGHT", "REPEAT", "HANDBALL", "KICK_GOAL"],
      maxBlocks: 12, par: 8,
      solution: [
        { type: "REPEAT", n: 2, body: ["HANDBALL", "ROTATE_RIGHT", "MOVE_FORWARD", "MOVE_FORWARD", "ROTATE_LEFT"] },
        "ROTATE_RIGHT",
        "KICK_GOAL"
      ]
    },
    {
      id: 10,
      title: "Grand Final",
      concept: "A loop inside a loop",
      hint: "Three runs then a turn… twice. Put a Repeat INSIDE a Repeat for the perfect score.",
      gridSize: [8, 6],
      startPos: [0, 1], startFacing: "SOUTH",
      goalPos: [3, 1],
      defenders: [[1, 1], [2, 1], [1, 3], [2, 2]],
      allowedBlocks: ["MOVE_FORWARD", "ROTATE_LEFT", "ROTATE_RIGHT", "REPEAT", "HANDBALL", "KICK_GOAL"],
      maxBlocks: 8, par: 5,
      solution: [
        { type: "REPEAT", n: 2, body: [
          { type: "REPEAT", n: 3, body: ["MOVE_FORWARD"] },
          "ROTATE_LEFT"
        ] },
        "KICK_GOAL"
      ]
    }
  ];

  const MAX_STARS = LEVELS.length * 3;

  /* ── Save file ───────────────────────────────────────────────────────── */

  const SAVE_KEY = "footyTacticsSave_v1";
  const blank = () => ({ best: {}, unlocked: 1, muted: false });

  let save = blank();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) save = Object.assign(blank(), JSON.parse(raw));
    } catch (e) { /* private mode — play without saving */ }
    return save;
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  function byId(id) { return LEVELS.find((l) => l.id === id) || null; }
  function starsFor(id) { return (save.best[id] && save.best[id].stars) || 0; }
  function bestBlocks(id) { return save.best[id] ? save.best[id].blocks : null; }
  function isUnlocked(id) { return id <= save.unlocked; }
  function totalStars() { return LEVELS.reduce((n, l) => n + starsFor(l.id), 0); }

  function starsEarned(level, blocks) {
    if (blocks <= level.par) return 3;
    if (blocks <= level.par + 3) return 2;
    return 1;
  }

  // Returns the stars for this run; keeps the best result ever, not the latest.
  function recordWin(id, blocks) {
    const level = byId(id);
    const stars = starsEarned(level, blocks);
    const prev = save.best[id];
    if (!prev || stars > prev.stars || (stars === prev.stars && blocks < prev.blocks)) {
      save.best[id] = { stars: stars, blocks: blocks };
    }
    if (id + 1 <= LEVELS.length && save.unlocked < id + 1) save.unlocked = id + 1;
    persist();
    return stars;
  }

  // The compact `solution` notation above ("MOVE_FORWARD" / {type,n,body})
  // expanded into the same node shape the workspace produces.
  function solutionTree(level) {
    let seq = 0;
    return (function walk(nodes) {
      return nodes.map((node) => {
        const id = "sol" + (++seq);
        if (typeof node === "string") return { id: id, type: node };
        return { id: id, type: "REPEAT", n: node.n, body: walk(node.body || []) };
      });
    })(level.solution || []);
  }

  function isMuted() { return !!save.muted; }
  function setMuted(m) { save.muted = !!m; persist(); }

  function resetProgress() { save = blank(); persist(); }

  return {
    LEVELS: LEVELS, MAX_STARS: MAX_STARS,
    load: load, byId: byId,
    starsFor: starsFor, bestBlocks: bestBlocks, totalStars: totalStars,
    starsEarned: starsEarned, recordWin: recordWin, solutionTree: solutionTree,
    isUnlocked: isUnlocked, resetProgress: resetProgress,
    isMuted: isMuted, setMuted: setMuted
  };
})();
