/* Newton's Playground - paints a scene onto the canvas.                       */
/*                                                                             */
/* World units are metres: the track is 20 m wide with a metre of margin each */
/* side, and one metre is the same number of pixels across and up. Colours    */
/* come from the CSS variables so the canvas follows the light/dark theme.    */
"use strict";
window.NL = window.NL || {};

NL.Draw = (function () {
  const P = NL.Physics;
  const L = P.TRACK;
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  let cv, ctx, W = 0, H = 0, S = 1, col = {};

  function attach(canvas) { cv = canvas; ctx = cv.getContext("2d"); resize(); }

  // Size the backing store to the element and the screen's pixel density, so
  // lines stay crisp on a retina tablet.
  function resize() {
    if (!cv) return;
    const w = cv.parentElement.clientWidth;
    const h = Math.round(Math.max(190, Math.min(380, w * 0.46)));
    // A scaled-up page (shared/screen.css) stretches the canvas too, so it
    // needs that many more pixels to stay sharp.
    const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
    const dpr = Math.min((window.devicePixelRatio || 1) * zoom, 4);
    cv.style.height = h + "px";
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = w; H = h; S = w / (L + 2);
  }

  function readColours() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    col = {
      sky: v("--stage"), sky2: v("--stage2"), ink: v("--ink"), muted: v("--muted"),
      floor: v("--floor"), ice: v("--ice"), grass: v("--grass"), sand: v("--sand"),
      path: v("--path"), wall: v("--wall"), zone: v("--zone"), flag: v("--flag"),
      push: v("--push"), back: v("--back"), friction: v("--friction"), puck: v("--puck")
    };
  }

  const X = (x) => (x + 1) * S;
  // Where the ground is for each lane. Two lanes stack; one lane sits low.
  function groundY(lane, lanes) {
    if (lanes === 2) return lane === 0 ? H * 0.44 : H * 0.9;
    return H * 0.8;
  }

  function emoji(ch, x, y, size, flip) {
    ctx.save();
    ctx.font = Math.round(size) + "px " + EMOJI;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }

  function text(str, x, y, size, colour, align) {
    ctx.font = "700 " + Math.round(size) + "px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    ctx.fillStyle = colour;
    ctx.textAlign = align || "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(str, x, y);
  }

  function rounded(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // A fat arrow from x (metres) pointing `dir`, `size` metres long, with a label.
  // Backward arrows put their label underneath, so a pair of arrows pointing
  // apart (Law 3) never write over each other.
  function arrow(x, y, dir, size, label, colour, alpha, below) {
    // Keep the whole arrow on screen, even when its owner is right at the edge.
    if (dir < 0 && x - size < -0.8) x = size - 0.8;
    if (dir > 0 && x + size > L + 0.8) x = L + 0.8 - size;
    const x0 = X(x), x1 = X(x + dir * size);
    const t = Math.max(4, S * 0.2);
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.strokeStyle = colour; ctx.fillStyle = colour;
    ctx.lineWidth = t; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1 - dir * t * 1.2, y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x1 - dir * t * 2.4, y - t * 1.5);
    ctx.lineTo(x1 - dir * t * 2.4, y + t * 1.5);
    ctx.closePath(); ctx.fill();
    if (label) {
      const size = Math.max(11, S * 0.42);
      ctx.font = "700 " + Math.round(size) + "px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
      const half = ctx.measureText(label).width / 2;
      const lx = Math.max(half + 4, Math.min(W - half - 4, (x0 + x1) / 2));
      text(label, lx, below ? y + t * 1.7 + size : y - t * 1.7, size, colour);
    }
    ctx.restore();
  }

  function sky(space) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (space) { g.addColorStop(0, "#050816"); g.addColorStop(1, "#141a3a"); }
    else { g.addColorStop(0, col.sky); g.addColorStop(1, col.sky2); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (space) {
      // Fixed stars: seeded by index so they don't twinkle about every frame.
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 70; i++) {
        const sx = (i * 97.3) % W, sy = (i * 53.7) % (H * 0.95);
        ctx.globalAlpha = 0.3 + ((i * 7) % 10) / 14;
        ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // The ground strip under a lane, coloured by surface, with a label for each.
  function ground(strips, lane, lanes, labels) {
    const y = groundY(lane, lanes);
    const th = Math.max(10, S * 0.7);
    strips.forEach((s) => {
      if (s.type === "space") return;
      ctx.fillStyle = col[s.type] || col.floor;
      ctx.fillRect(X(s.from) - (s.from === 0 ? S : 0), y, (s.to - s.from) * S + (s.to === L ? S : 0) + (s.from === 0 ? S : 0), th);
      if (labels) {
        const info = P.SURF[s.type];
        text(info.label, X(s.from) + 4, y + th - 1, Math.max(10, th * 0.62), "rgba(0,0,0,.55)", "left");
      }
    });
    // Metre ticks, so "further" can be seen as well as felt.
    ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1;
    for (let m = 0; m <= L; m++) {
      ctx.beginPath(); ctx.moveTo(X(m), y); ctx.lineTo(X(m), y + (m % 5 ? th * 0.3 : th * 0.6)); ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(0, y, W, 1.5);
  }

  function wall(x, lane, lanes) {
    const y = groundY(lane, lanes);
    const h = S * 2.4;
    ctx.fillStyle = col.wall;
    const w = S * 0.5;
    rounded(x >= L ? X(L) : X(0) - w, y - h, w, h + 2, 3);
    ctx.fill();
  }

  function zone(z, lane, lanes) {
    if (!z) return;
    const y = groundY(lane, lanes);
    const x0 = X(z[0]), x1 = X(z[1]);
    ctx.fillStyle = col.zone;
    ctx.fillRect(x0, y - S * 2.2, x1 - x0, S * 2.2);
    ctx.fillRect(x0, y, x1 - x0, Math.max(6, S * 0.25));
    // A green flag, drawn so it matches "stop on the green flag" everywhere.
    const fx = (x0 + x1) / 2, top = y - S * 2.6;
    ctx.strokeStyle = col.ink; ctx.lineWidth = Math.max(2, S * 0.07);
    ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(fx, top); ctx.stroke();
    ctx.fillStyle = col.flag;
    ctx.beginPath(); ctx.moveTo(fx, top); ctx.lineTo(fx + S * 0.9, top + S * 0.35); ctx.lineTo(fx, top + S * 0.7); ctx.closePath(); ctx.fill();
  }

  function arrows(scene, lanes) {
    const y0 = groundY(0, lanes) - S * 2.9;
    scene.arrows.forEach((a) => {
      const x = typeof a.x === "function" ? a.x() : a.x;
      const alpha = Math.min(1, a.t / 0.3);
      arrow(x, y0, a.dir, a.size, a.label, a.color === "back" ? col.back : col.push, alpha, a.color === "back");
    });
  }

  // ── Kinds ──────────────────────────────────────────────────────────────────
  function drawFlick(s) {
    const space = s.strips[0].type === "space";
    sky(space);
    const y = groundY(0, 1);
    if (space) {
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
    }
    ground(s.strips, 0, 1, true);
    if (!space) wall(L, 0, 1);
    zone(s.zone, 0, 1);

    const pk = s.puck, r = pk.r * S;
    s.trail.forEach((tx, i) => {
      ctx.globalAlpha = (i / s.trail.length) * 0.25;
      ctx.fillStyle = space ? "#fff" : col.puck;
      ctx.beginPath(); ctx.ellipse(X(tx), y - r * 0.55, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // A curling-style puck: a flat disc seen from the side.
    ctx.fillStyle = col.puck;
    ctx.beginPath(); ctx.ellipse(X(pk.x), y - r * 0.55, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath(); ctx.ellipse(X(pk.x), y - r * 0.8, r * 0.7, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();

    const D = P.SURF[P.surfaceAt(s.strips, pk.x)].D;
    if (s.moving && D > 0) {
      arrow(pk.x - 0.6, y - S * 1.6, -1, 0.5 + D * 0.3, "Friction", col.friction, 0.9);
    }
    if (s.aim != null) {
      // Pull-back band behind the puck, and the push it will get in front.
      ctx.strokeStyle = col.muted; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(X(pk.x), y - r * 0.55); ctx.lineTo(X(pk.x) - s.aim * S * 1.2, y - r * 0.55); ctx.stroke();
      ctx.setLineDash([]);
      arrow(pk.x + 0.6, y - S * 1.6, 1, 0.6 + s.aim * 4, "Flick", col.push, 1);
    }
    powerBar(s);
  }

  function powerBar(s) {
    const x = 12, y = 12, w = Math.min(220, W * 0.4), h = 14;
    ctx.fillStyle = "rgba(0,0,0,.18)";
    rounded(x, y, w, h, 7); ctx.fill();
    const p = s.aim != null ? s.aim : 0;
    if (p > 0) { ctx.fillStyle = col.push; rounded(x, y, Math.max(h, w * p), h, 7); ctx.fill(); }
    if (s.lastPower != null) {
      ctx.fillStyle = col.ink;
      ctx.fillRect(x + w * s.lastPower - 1.5, y - 4, 3, h + 8);
    }
    text("Power", x + w + 8, y + h + 1, 13, col.ink, "left");
  }

  function drawCart(s) {
    sky(false);
    for (let lane = 0; lane < s.lanes; lane++) {
      ground([{ from: 0, to: L, type: "floor" }], lane, s.lanes, false);
      wall(L, lane, s.lanes);
    }
    const zl = s.kind === "match" ? 1 : 0;
    if (s.kind !== "race") zone(s.zone, zl, s.lanes);
    s.carts.forEach((c) => {
      const y = groundY(c.lane, s.lanes);
      const ld = NL.LOADS[c.load];
      const cx = X(c.x), w = S * 1.6, h = S * 0.55, wr = S * 0.22;
      ctx.fillStyle = col.wall;
      rounded(cx - w / 2, y - wr * 2 - h, w, h, 4); ctx.fill();
      ctx.fillStyle = col.ink;
      [-0.5, 0.5].forEach((k) => { ctx.beginPath(); ctx.arc(cx + k * w * 0.7, y - wr, wr, 0, Math.PI * 2); ctx.fill(); });
      const big = c.load === "elephant" ? 1.9 : c.load === "box" ? 1.4 : 1.2;
      emoji(ld.emoji, cx, y - wr * 2 - h + S * 0.15, S * big);
      if (c.pushT > 0) {
        emoji("\u{270B}", cx - w / 2 - S * 0.45, y - wr * 2, S * 0.9, true);
        arrow(c.x - 0.8, y - S * 2.9, 1, 0.5 + c.push * 0.6, "Push " + c.push, col.push, 1);
      }
      if (s.lanes === 2) {
        const pushes = c.push ? c.push + (c.push === 1 ? " push" : " pushes") : "? pushes";
        text((c.name || ld.label) + " · " + pushes, 8, y - S * 2.6, Math.max(12, S * 0.45), col.ink, "left");
      }
    });
    // Once Teddy has rolled, a dashed line joins his stop to the flag below,
    // so "stop next to Teddy" is something you can see, not just read.
    if (s.teddyMark != null) {
      ctx.save();
      ctx.strokeStyle = col.flag; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(X(s.teddyMark), groundY(0, 2) - S * 1.6); ctx.lineTo(X(s.teddyMark), groundY(1, 2)); ctx.stroke();
      ctx.restore();
    }
  }

  function drawSkate(s) {
    sky(false);
    ground([{ from: 0, to: L, type: "path" }], 0, 1, false);
    wall(0, 0, 1);
    zone(s.zone, 0, 1);
    const y = groundY(0, 1);
    skater(s.skater.x, y, "\u{1F9D2}", 1.7);
    s.bits.forEach((b) => {
      if (b.kind !== "ball") return;
      const by = y - Math.max(0, b.y) * S;
      if (b.ball === "heavy") heavyBall(X(b.x), by, S * 0.32);
      else emoji(NL.BALLS.tennis.emoji, X(b.x), by + S * 0.3, S * 0.6);
    });
    arrows(s, 1);
  }

  function heavyBall(x, y, r) {
    ctx.fillStyle = "#23262e";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2); ctx.fill();
  }

  function skater(x, y, who, size) {
    const cx = X(x), w = S * 1.3, wr = S * 0.14;
    ctx.fillStyle = col.wall;
    rounded(cx - w / 2, y - wr * 2 - S * 0.14, w, S * 0.14, 3); ctx.fill();
    ctx.fillStyle = col.ink;
    [-0.35, 0.35].forEach((k) => { ctx.beginPath(); ctx.arc(cx + k * w, y - wr, wr, 0, Math.PI * 2); ctx.fill(); });
    emoji(who, cx, y - wr * 2 - S * 0.05, S * size);
  }

  function drawBalloon(s) {
    sky(false);
    ground([{ from: 0, to: L, type: "floor" }], 0, 1, false);
    wall(L, 0, 1);
    zone(s.zone, 0, 1);
    const y = groundY(0, 1), sy = y - S * 1.3;
    // The string it rides on, pinned to a post at each end.
    ctx.strokeStyle = col.muted; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(0), sy); ctx.lineTo(X(L), sy); ctx.stroke();
    ctx.fillStyle = col.wall; ctx.fillRect(X(0) - 3, sy - 4, 6, y - sy + 4);
    s.bits.forEach((b) => {
      if (b.kind !== "puff") return;
      ctx.globalAlpha = Math.max(0, 1 - b.t / (b.life || 1)) * 0.7;
      ctx.fillStyle = col.muted;
      ctx.beginPath(); ctx.arc(X(b.x), y - b.y * S, S * 0.12, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    const bx = X(s.b.x), rr = S * (0.3 + 0.2 * s.size);
    ctx.fillStyle = "#e0443a";
    ctx.beginPath(); ctx.ellipse(bx + rr * 0.2, sy, rr * 1.25, rr, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.beginPath(); ctx.ellipse(bx + rr * 0.5, sy - rr * 0.45, rr * 0.35, rr * 0.18, -0.3, 0, Math.PI * 2); ctx.fill();
    // The neck points backwards: that's where the air comes out.
    ctx.fillStyle = "#b8322a";
    ctx.beginPath(); ctx.moveTo(bx - rr * 1.0, sy); ctx.lineTo(bx - rr * 1.35, sy - S * 0.12); ctx.lineTo(bx - rr * 1.35, sy + S * 0.12); ctx.closePath(); ctx.fill();
    // Arrows sit above the string, clear of the balloon.
    const ay = sy - S * 1.6;
    s.arrows.forEach((a) => {
      const x = typeof a.x === "function" ? a.x() : a.x;
      arrow(x, ay, a.dir, a.size, a.label, a.color === "back" ? col.back : col.push, Math.min(1, a.t / 0.3), a.color === "back");
    });
  }

  function drawPushoff(s) {
    sky(false);
    ground([{ from: 0, to: L, type: "path" }], 0, 1, false);
    const y = groundY(0, 1);
    skater(s.kids[0].x, y, "\u{1F9D1}", 2.1);
    skater(s.kids[1].x, y, "\u{1F9D2}", 1.4);
    // Mark where each one started, so "further" is easy to see.
    ctx.fillStyle = col.muted;
    [9, 10.3].forEach((x) => ctx.fillRect(X(x) - 1, y + 2, 2, S * 0.5));
    arrows(s, 1);
  }

  function frame(scene) {
    if (!ctx || !scene) return;
    ctx.clearRect(0, 0, W, H);
    if (scene.kind === "flick") drawFlick(scene);
    else if (scene.kind === "skate") drawSkate(scene);
    else if (scene.kind === "balloon") drawBalloon(scene);
    else if (scene.kind === "pushoff") drawPushoff(scene);
    else drawCart(scene);
  }

  return { attach, resize, readColours, frame, width: () => W, scale: () => S };
})();
