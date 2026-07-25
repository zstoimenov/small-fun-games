/* Footy Tactics Lab — the step-by-step interpreter.
   Knows nothing about the DOM or the canvas: it turns a block tree into a
   list of steps, walks them one at a time, and reports what happened. */
"use strict";
window.FTL = window.FTL || {};

FTL.Engine = (function () {

  const ORDER = ["NORTH", "EAST", "SOUTH", "WEST"];
  const DELTA = { NORTH: [0, -1], EAST: [1, 0], SOUTH: [0, 1], WEST: [-1, 0] };

  const MAX_STEPS = 300;   // a runaway Repeat can't lock up the tablet
  const STEP_DELAY = 500;  // ms between blocks — slow enough to follow along

  /* ── Reading the world ────────────────────────────────────────────────── */

  function inBounds(level, x, y) {
    return x >= 0 && y >= 0 && x < level.gridSize[0] && y < level.gridSize[1];
  }
  function isDefender(level, x, y) {
    return level.defenders.some((d) => d[0] === x && d[1] === y);
  }
  function startState(level) {
    return { x: level.startPos[0], y: level.startPos[1], facing: level.startFacing };
  }

  /* ── Flattening the block tree ────────────────────────────────────────── */

  // Every emitted step keeps its blockId, so a block inside a Repeat lights up
  // again on each pass — which is what makes the loop visible.
  function compile(tree, level) {
    const steps = [];
    let overflow = false;

    (function walk(nodes) {
      for (const node of nodes) {
        if (overflow) return;
        if (steps.length >= MAX_STEPS) { overflow = true; return; }
        if (node.type === "REPEAT") {
          const n = Math.max(1, Math.min(10, node.n || 2));
          for (let i = 0; i < n; i++) {
            if (overflow) return;
            walk(node.body || []);
          }
        } else {
          steps.push({ blockId: node.id, type: node.type });
        }
      }
    })(tree);

    return { steps: steps, overflow: overflow };
  }

  function countBlocks(tree) {
    let n = 0;
    (function walk(nodes) {
      for (const node of nodes) {
        n++;
        if (node.type === "REPEAT") walk(node.body || []);
      }
    })(tree);
    return n;
  }

  /* ── One block's worth of football ────────────────────────────────────── */

  // Returns { ok:true, next, effect } or { ok:false, reason, at }.
  function applyStep(level, state, type) {
    const [dx, dy] = DELTA[state.facing];

    if (type === "MOVE_FORWARD") {
      const nx = state.x + dx, ny = state.y + dy;
      if (!inBounds(level, nx, ny)) return { ok: false, reason: "OUT_OF_BOUNDS", at: [nx, ny] };
      if (isDefender(level, nx, ny)) return { ok: false, reason: "TACKLED", at: [nx, ny] };
      return { ok: true, next: { x: nx, y: ny, facing: state.facing }, effect: "move" };
    }

    if (type === "ROTATE_LEFT" || type === "ROTATE_RIGHT") {
      const turn = type === "ROTATE_RIGHT" ? 1 : -1;
      const facing = ORDER[(ORDER.indexOf(state.facing) + turn + 4) % 4];
      return { ok: true, next: { x: state.x, y: state.y, facing: facing }, effect: "turn" };
    }

    if (type === "HANDBALL") {
      // A handball is only on when a defender is right in front of you: it
      // sends the ball over him and you run onto it two tiles ahead.
      const ox = state.x + dx, oy = state.y + dy;          // over
      const lx = state.x + dx * 2, ly = state.y + dy * 2;  // land
      if (!isDefender(level, ox, oy)) return { ok: false, reason: "NO_DEFENDER_TO_HANDBALL", at: [ox, oy] };
      if (!inBounds(level, lx, ly)) return { ok: false, reason: "HANDBALL_OUT", at: [lx, ly] };
      if (isDefender(level, lx, ly)) return { ok: false, reason: "NO_ROOM_TO_LAND", at: [lx, ly] };
      return { ok: true, next: { x: lx, y: ly, facing: state.facing }, effect: "handball" };
    }

    if (type === "KICK_GOAL") {
      const gx = level.goalPos[0], gy = level.goalPos[1];
      const sameLine = (dx !== 0 && gy === state.y && Math.sign(gx - state.x) === dx) ||
                       (dy !== 0 && gx === state.x && Math.sign(gy - state.y) === dy);
      if (!sameLine) return { ok: false, reason: "BAD_ANGLE", at: [gx, gy] };
      const dist = Math.abs(gx - state.x) + Math.abs(gy - state.y);
      if (dist > 3) return { ok: false, reason: "TOO_FAR", at: [gx, gy] };
      for (let i = 1; i < dist; i++) {
        const bx = state.x + dx * i, by = state.y + dy * i;
        if (isDefender(level, bx, by)) return { ok: false, reason: "BLOCKED_KICK", at: [bx, by] };
      }
      return { ok: true, next: state, effect: "goal", won: true };
    }

    return { ok: false, reason: "UNKNOWN_BLOCK" };
  }

  /* ── Kid-readable failure messages ────────────────────────────────────── */

  const MESSAGES = {
    OUT_OF_BOUNDS: "Out of bounds! You ran off the oval.",
    TACKLED: "Tackled! You ran straight into a defender.",
    NO_DEFENDER_TO_HANDBALL: "No one to handball over — a handball only works with a defender right in front of you.",
    HANDBALL_OUT: "That handball sailed out of bounds.",
    NO_ROOM_TO_LAND: "No room to land — there's another defender on the other side.",
    BAD_ANGLE: "You kicked the wrong way! Turn to face the big sticks first.",
    TOO_FAR: "Too far out! Get within 3 tiles of the posts.",
    BLOCKED_KICK: "Smothered! A defender is standing in front of your kick.",
    UNKNOWN_BLOCK: "That block doesn't do anything here.",
    NO_KICK: "Nice running — but you never kicked for goal!",
    TOO_LONG: "That play goes on forever. Try smaller Repeat numbers."
  };
  function message(reason) { return MESSAGES[reason] || "That didn't work — have another go."; }

  /* ── Running it all at once (used by the boot-time self test) ─────────── */

  function simulate(tree, level) {
    const compiled = compile(tree, level);
    if (compiled.overflow) return { won: false, reason: "TOO_LONG", stepIndex: -1 };
    let state = startState(level);
    for (let i = 0; i < compiled.steps.length; i++) {
      const res = applyStep(level, state, compiled.steps[i].type);
      if (!res.ok) return { won: false, reason: res.reason, stepIndex: i, state: state };
      state = res.next;
      if (res.won) return { won: true, stepIndex: i, state: state };
    }
    return { won: false, reason: "NO_KICK", stepIndex: compiled.steps.length - 1, state: state };
  }

  /* ── Running it one block at a time ───────────────────────────────────── */

  let token = 0;        // bumped by stop(); stale callbacks check it and bail
  let timer = null;
  let running = false;

  function stop() {
    token++;
    running = false;
    if (timer) { clearTimeout(timer); timer = null; }
  }

  /* cb: { onStep(blockId, type, state), onApply(from, to, effect),
           onFail(blockId, reason, at), onWin(state), onDone() }          */
  function run(tree, level, cb) {
    stop();
    const mine = ++token;
    const compiled = compile(tree, level);

    if (compiled.overflow) { cb.onFail(null, "TOO_LONG", null); return; }
    if (!compiled.steps.length) { cb.onFail(null, "NO_KICK", null); return; }

    running = true;
    let state = startState(level);
    let i = 0;

    function tick() {
      if (mine !== token) return;
      if (i >= compiled.steps.length) {
        running = false;
        cb.onFail(compiled.steps[compiled.steps.length - 1].blockId, "NO_KICK", null);
        return;
      }
      const step = compiled.steps[i];
      cb.onStep(step.blockId, step.type, state);

      const res = applyStep(level, state, step.type);
      if (!res.ok) {
        running = false;
        cb.onFail(step.blockId, res.reason, res.at);
        return;
      }
      cb.onApply(state, res.next, res.effect);
      state = res.next;

      if (res.won) {
        running = false;
        cb.onWin(state);
        return;
      }
      i++;
      timer = setTimeout(tick, STEP_DELAY);
    }

    tick();
  }

  return {
    ORDER: ORDER, DELTA: DELTA, STEP_DELAY: STEP_DELAY,
    startState: startState, isDefender: isDefender, inBounds: inBounds,
    compile: compile, countBlocks: countBlocks, applyStep: applyStep,
    simulate: simulate, message: message,
    run: run, stop: stop,
    isRunning: function () { return running; }
  };
})();
