/* Footy Tactics Lab — canvas renderer: the oval, the grid, the players.
   Everything is drawn procedurally, so the game ships no images. */
"use strict";
window.FTL = window.FTL || {};

FTL.Game = (function () {

  const ANGLE = { NORTH: -Math.PI / 2, EAST: 0, SOUTH: Math.PI / 2, WEST: Math.PI };
  const OVAL_K = 1.43;   // boundary ellipse radius ÷ grid half-size

  let canvas = null, ctx = null;
  let W = 0, H = 0;                 // CSS pixels
  let level = null;
  let cols = 8, rows = 6;
  let tile = 40, ox = 0, oy = 0;    // tile size and grid origin

  let actor = { x: 0, y: 0, facing: "EAST" };  // logical position
  let draw = { x: 0, y: 0, angle: 0 };         // tweened position actually drawn
  let ball = null;                             // { x, y, tx, ty, t, kind }
  let anim = null;                             // running tween
  let flash = null;                            // { x, y, kind, until }
  let raf = null;
  let goalGlow = 0;

  /* ── Sizing ───────────────────────────────────────────────────────────── */

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The boundary ellipse is OVAL_K bigger than the grid in both directions,
    // which is just enough to swallow the grid's corners (1/K² × 2 < 1), so
    // no tile ever sits outside the playing surface.
    tile = Math.min(W / (cols * OVAL_K), H / (rows * OVAL_K)) * 0.98;
    ox = (W - tile * cols) / 2;
    oy = (H - tile * rows) / 2;
    render();
  }

  function mount(el) {
    canvas = el;
    ctx = canvas.getContext("2d");
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", () => setTimeout(resize, 120));
    resize();
  }

  /* ── State in ─────────────────────────────────────────────────────────── */

  function setLevel(lv) {
    level = lv;
    cols = lv.gridSize[0];
    rows = lv.gridSize[1];
    reset();
    resize();
  }

  function reset() {
    if (!level) return;
    stopAnim();
    actor = FTL.Engine.startState(level);
    draw = { x: actor.x, y: actor.y, angle: ANGLE[actor.facing] };
    ball = null; flash = null; goalGlow = 0;
    render();
  }

  function stopAnim() {
    anim = null;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // Turn to the nearest equivalent angle so a NORTH→WEST turn doesn't spin 270°.
  function shortestAngle(from, to) {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + d;
  }

  function animateTo(next, effect, ms) {
    ms = ms || 320;
    const from = { x: draw.x, y: draw.y, angle: draw.angle };
    const toAngle = shortestAngle(draw.angle, ANGLE[next.facing]);
    actor = next;

    if (effect === "handball") {
      ball = { x: from.x, y: from.y, tx: next.x, ty: next.y, t: 0, kind: "handball" };
    }
    const start = performance.now();
    anim = { start: start, ms: ms, from: from, toAngle: toAngle, to: next, effect: effect };
    loop();
  }

  function kickBall(from, to, ms) {
    ball = { x: from.x, y: from.y, tx: to[0], ty: to[1], t: 0, kind: "kick" };
    const start = performance.now();
    anim = { start: start, ms: ms || 520, from: { x: draw.x, y: draw.y, angle: draw.angle }, toAngle: draw.angle, to: actor, effect: "goal" };
    loop();
  }

  function loop() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function step(now) {
      let more = false;
      if (anim) {
        const t = Math.min(1, (now - anim.start) / anim.ms);
        const e = easeInOut(t);
        if (anim.effect !== "goal") {
          draw.x = anim.from.x + (anim.to.x - anim.from.x) * e;
          draw.y = anim.from.y + (anim.to.y - anim.from.y) * e;
        }
        draw.angle = anim.from.angle + (anim.toAngle - anim.from.angle) * e;
        if (ball) ball.t = e;
        if (t >= 1) { anim = null; if (ball && ball.kind === "handball") ball = null; }
        else more = true;
      }
      if (goalGlow > 0) { goalGlow = Math.max(0, goalGlow - 0.02); more = more || goalGlow > 0; }
      if (flash && performance.now() > flash.until) flash = null;
      if (flash) more = true;
      render();
      raf = more ? requestAnimationFrame(step) : null;
    });
  }

  function flashTile(x, y, kind) {
    flash = { x: x, y: y, kind: kind, until: performance.now() + 1400 };
    loop();
  }
  function celebrate() { goalGlow = 1; loop(); }

  /* ── Drawing ──────────────────────────────────────────────────────────── */

  const cx = (gx) => ox + (gx + 0.5) * tile;
  const cy = (gy) => oy + (gy + 0.5) * tile;

  function render() {
    if (!ctx || !level) return;
    ctx.clearRect(0, 0, W, H);
    drawOval();
    drawGrid();
    drawGoal();
    if (flash) drawFlash();
    level.defenders.forEach((d) => drawDefender(d[0], d[1]));
    drawPlayer();
    if (ball) drawBall();
  }

  function drawOval() {
    const rx = (tile * cols * OVAL_K) / 2;
    const ry = (tile * rows * OVAL_K) / 2;
    const mx = ox + (tile * cols) / 2, my = oy + (tile * rows) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1d7a45";
    ctx.fill();
    ctx.clip();

    // mown stripes, one per grid row so they line up with the tiles
    for (let r = -3; r < rows + 3; r++) {
      ctx.fillStyle = ((r % 2) + 2) % 2 ? "rgba(255,255,255,.055)" : "rgba(0,0,0,.05)";
      ctx.fillRect(mx - rx, oy + r * tile, rx * 2, tile);
    }
    // a faint wash over the tiles themselves, so the playable grid reads as
    // the part of the ground that matters
    ctx.fillStyle = "rgba(255,255,255,.05)";
    ctx.fillRect(ox, oy, tile * cols, tile * rows);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = Math.max(2, tile * 0.055);
    ctx.beginPath();
    ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // centre square
    ctx.strokeStyle = "rgba(255,255,255,.32)";
    ctx.lineWidth = Math.max(1, tile * 0.03);
    ctx.strokeRect(mx - tile * 0.7, my - tile * 0.7, tile * 1.4, tile * 1.4);
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,.17)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      ctx.moveTo(ox + c * tile, oy);
      ctx.lineTo(ox + c * tile, oy + rows * tile);
    }
    for (let r = 0; r <= rows; r++) {
      ctx.moveTo(ox, oy + r * tile);
      ctx.lineTo(ox + cols * tile, oy + r * tile);
    }
    ctx.stroke();
  }

  function drawGoal() {
    const gx = cx(level.goalPos[0]), gy = cy(level.goalPos[1]);
    const h = tile * 1.5, w = tile * 0.34, bh = tile * 0.95;

    if (goalGlow > 0) {
      ctx.save();
      ctx.globalAlpha = goalGlow * 0.55;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, tile * 1.6);
      g.addColorStop(0, "#ffe14d");
      g.addColorStop(1, "rgba(255,225,77,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(gx, gy, tile * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // goal square on the turf
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.lineWidth = Math.max(1, tile * 0.035);
    ctx.strokeRect(gx - tile * 0.45, gy - tile * 0.45, tile * 0.9, tile * 0.9);

    ctx.lineCap = "round";
    // behind posts, shorter and set wider
    ctx.strokeStyle = "rgba(240,248,255,.72)";
    ctx.lineWidth = Math.max(2, tile * 0.1);
    [-w * 2.15, w * 2.15].forEach((dx) => {
      ctx.beginPath();
      ctx.moveTo(gx + dx, gy + tile * 0.18);
      ctx.lineTo(gx + dx, gy + tile * 0.18 - bh);
      ctx.stroke();
    });
    // the big sticks
    ctx.strokeStyle = "#f7fbff";
    ctx.lineWidth = Math.max(3, tile * 0.14);
    [-w, w].forEach((dx) => {
      ctx.beginPath();
      ctx.moveTo(gx + dx, gy + tile * 0.28);
      ctx.lineTo(gx + dx, gy + tile * 0.28 - h);
      ctx.stroke();
    });
    ctx.lineCap = "butt";
  }

  function drawFlash() {
    const x = ox + flash.x * tile, y = oy + flash.y * tile;
    const pulse = 0.35 + 0.25 * Math.sin(performance.now() / 110);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = flash.kind === "bad" ? "#ff4d4d" : "#ffe14d";
    ctx.fillRect(x, y, tile, tile);
    ctx.restore();
    ctx.strokeStyle = flash.kind === "bad" ? "#ff6b6b" : "#ffe14d";
    ctx.lineWidth = Math.max(2, tile * 0.06);
    ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
  }

  function jumper(x, y, r, body, trim, face) {
    // shadow
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.92, r * 0.78, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // body
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.2, r * 0.62, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    // sash
    ctx.strokeStyle = trim;
    ctx.lineWidth = r * 0.24;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y + r * 0.62);
    ctx.lineTo(x + r * 0.42, y - r * 0.24);
    ctx.stroke();
    // head
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.6, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer() {
    const x = cx(draw.x), y = cy(draw.y), r = tile * 0.42;

    // facing chevron, so "which way am I pointing?" is never a guess
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(draw.angle);
    ctx.fillStyle = "#ffe14d";
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(r * 0.9, -r * 0.5);
    ctx.lineTo(r * 1.06, 0);
    ctx.lineTo(r * 0.9, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    jumper(x, y, r, "#1e5fd0", "#ffe14d", "#ffd9b0");
    if (!ball) {
      ctx.fillStyle = "#c8452a";
      ctx.beginPath();
      ctx.ellipse(x + r * 0.5, y + r * 0.42, r * 0.3, r * 0.2, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDefender(gx, gy) {
    const bob = Math.sin(performance.now() / 700 + gx * 1.7 + gy) * tile * 0.03;
    jumper(cx(gx), cy(gy) + bob, tile * 0.4, "#b3222f", "#ffffff", "#e8bb95");
  }

  function drawBall() {
    const t = ball.t;
    const bx = cx(ball.x + (ball.tx - ball.x) * t);
    const arc = Math.sin(t * Math.PI) * tile * (ball.kind === "kick" ? 0.75 : 0.4);
    const by = cy(ball.y + (ball.ty - ball.y) * t) - arc;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(t * 6);
    ctx.fillStyle = "#c8452a";
    ctx.beginPath();
    ctx.ellipse(0, 0, tile * 0.19, tile * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffe9c9";
    ctx.lineWidth = Math.max(1, tile * 0.022);
    ctx.beginPath();
    ctx.moveTo(-tile * 0.15, 0); ctx.lineTo(tile * 0.15, 0);
    ctx.stroke();
    ctx.restore();
  }

  return {
    mount: mount, setLevel: setLevel, reset: reset, resize: resize, render: render,
    animateTo: animateTo, kickBall: kickBall, flashTile: flashTile, celebrate: celebrate,
    stopAnim: stopAnim
  };
})();
