'use strict';
// The camera, the ground, the stadium and everything that flies. Camera coords
// put the kick spot at the origin with +z pointing at the middle of the goals.

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W = 960, H = 600, DPR = 1;                 // live canvas size (CSS px) + pixel ratio

// ox/oz move the camera across and toward the goals as it follows the ball;
// hor slides down so a high ball stays on screen
const CAM = { dist: 9, F: 800, eyeH: 2.9, hor: 170, baseHor: 170, ox: 0, oz: 0 };

function proj(camX, y, camZ) {
  const zc = camZ - CAM.oz + CAM.dist;
  if (zc < 0.4) return null;
  const s = CAM.F / zc;
  return { x: W / 2 + (camX - CAM.ox) * s, y: CAM.hor + (CAM.eyeH - y) * s, s };
}

// field coords -> camera coords
function f2c(px, pz) {
  const k = S.kick, vx = px - k.bx, vz = pz - k.bz;
  return { x: vx * k.rx + vz * k.rz, z: vx * k.fx + vz * k.fz };
}

// Tilt the view per kick so the tops of the tall posts clear the HUD. Short
// kicks look up at the posts; long ones sit back and show more sky.
function frameHor() {
  if (!S) return Math.round(H * 0.3);
  const s = CAM.F / (S.kick.dist + CAM.dist);
  return Math.round(clamp(L.sceneTop + (11.4 - CAM.eyeH) * s, H * (PORTRAIT ? 0.24 : 0.27), H * 0.46));
}
function resetCamera() {
  CAM.ox = 0; CAM.oz = 0;
  CAM.baseHor = CAM.hor = frameHor();
}

function updateCamera(dt) {
  const k = S.kick;
  if (!k.ball || (S.phase !== 'flight' && S.phase !== 'result')) return;
  const b = k.ball, c = f2c(b.x, b.z);
  // chase the ball, but stop short of the goal line so the posts stay in shot
  const oz = clamp(c.z - 7, 0, Math.max(0, k.dist - 13));
  const ox = clamp(c.x * 0.55, -8, 8);
  const s = CAM.F / Math.max(3, c.z - oz + CAM.dist);
  const hor = clamp(Math.max(CAM.baseHor, L.sceneTop + 40 + (b.y + 0.6 - CAM.eyeH) * s), CAM.baseHor, H * 0.72);
  const r = Math.min(1, dt * 2.4);
  CAM.oz += (oz - CAM.oz) * r;
  CAM.ox += (ox - CAM.ox) * r;
  CAM.hor += (hor - CAM.hor) * Math.min(1, dt * 3);
}

// ---------- celebrations ----------
const FX = { cheer: 0, confetti: [], wobble: null };

function celebrate(outcome) {
  FX.cheer = outcome === 'goal' ? 1 : (outcome === 'behind' || outcome === 'poster' || outcome === 'touched') ? 0.35 : 0;
  if (outcome !== 'goal') return;
  const t = curP().team, cols = [t.main, t.trim, '#ffffff', t.main, t.trim];
  const k = S.kick;
  for (let i = 0; i < 170; i++) {
    FX.confetti.push({
      x: (Math.random() * 2 - 1) * 9, z: Math.random() * 10 - 3, y: 4 + Math.random() * 6,
      vx: (Math.random() * 2 - 1) * 0.6 + k.wvx * 0.12, vz: (Math.random() * 2 - 1) * 0.6 + k.wvz * 0.12,
      vy: -(0.7 + Math.random() * 0.9), rot: Math.random() * 6, vr: (Math.random() * 2 - 1) * 9,
      col: cols[i % cols.length], ph: Math.random() * 6
    });
  }
}
function wobblePost(x) { FX.wobble = { x, t: 0 }; }

function updateFx(dt) {
  FX.cheer *= Math.exp(-dt * 0.55);
  if (FX.wobble) { FX.wobble.t += dt; if (FX.wobble.t > 2) FX.wobble = null; }
  for (const c of FX.confetti) {
    c.x += (c.vx + Math.sin(S.time * 3 + c.ph) * 0.5) * dt;
    c.z += c.vz * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
  }
  FX.confetti = FX.confetti.filter(c => c.y > 0);
  if (S.phase === 'aim') FX.confetti.length = 0;
}

// ---------- crowd (pre-rendered in two rows that bounce out of step) ----------
const crowdA = document.createElement('canvas'), crowdB = document.createElement('canvas');
function buildCrowd() {
  const cols = ['#5a6a80', '#8a4a4a', '#4a6a52', '#7a7a4a', '#9a8a9a', '#3f5a76', '#6d5a7d', '#b08a5a'];
  const scarves = [TEAMS[0].main, TEAMS[0].trim, TEAMS[1].main, '#ffffff'];
  [crowdA, crowdB].forEach((cv2, n) => {
    cv2.width = Math.max(1, Math.round(W)); cv2.height = 64;
    const c = cv2.getContext('2d');
    if (n === 0) { c.fillStyle = '#232c38'; c.fillRect(0, 0, cv2.width, 64); }
    const count = Math.round(cv2.width * 2);
    for (let i = 0; i < count; i++) {
      const y = Math.random();                   // denser toward the bottom
      const scarf = Math.random() < 0.07;
      c.fillStyle = scarf ? scarves[(Math.random() * scarves.length) | 0] : cols[(Math.random() * cols.length) | 0];
      c.globalAlpha = scarf ? 0.9 : 0.35 + Math.random() * 0.5;
      c.fillRect(Math.random() * cv2.width, 8 + y * y * 54, scarf ? 3 : 2.2, scarf ? 2 : 2.2);
    }
    c.globalAlpha = 1;
  });
}

function line3(x1, y1, z1, x2, y2, z2, style, width) {
  const a = proj(x1, y1, z1), b = proj(x2, y2, z2);
  if (!a || !b) return;
  ctx.strokeStyle = style; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function drawField() {
  // sky
  let g = ctx.createLinearGradient(0, 0, 0, CAM.hor);
  g.addColorStop(0, '#5aaee9'); g.addColorStop(1, '#d3ecfa');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, CAM.hor);
  // stand roof + crowd; a goal sets the crowd jumping
  ctx.fillStyle = '#2e3946'; ctx.fillRect(0, CAM.hor - 80, W, 16);
  ctx.fillStyle = '#44515f'; ctx.fillRect(0, CAM.hor - 66, W, 2);
  const amp = 0.4 + FX.cheer * 4.5, t = S.time * 11;
  ctx.drawImage(crowdA, 0, CAM.hor - 64 - Math.max(0, Math.sin(t)) * amp);
  ctx.drawImage(crowdB, 0, CAM.hor - 64 - Math.max(0, Math.sin(t + Math.PI)) * amp);
  ctx.fillStyle = '#1b222c'; ctx.fillRect(0, CAM.hor - 3, W, 3);  // fence line
  // grass
  g = ctx.createLinearGradient(0, CAM.hor, 0, H);
  g.addColorStop(0, '#4d9e57'); g.addColorStop(1, '#2f7d3c');
  ctx.fillStyle = g; ctx.fillRect(0, CAM.hor, W, H - CAM.hor);
  // mow stripes (lines of constant camera depth are horizontal)
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  for (let i = 0; i < 26; i += 2) {
    const z0 = i * 6 - 6, z1 = z0 + 6;
    const p0 = proj(0, 0, z0), p1 = proj(0, 0, z1);
    if (p1) ctx.fillRect(0, p1.y, W, (p0 ? p0.y : H) - p1.y);
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(0, CAM.hor, W, H - CAM.hor); ctx.clip();
  // 50m arc
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  let started = false;
  for (let a = -85; a <= 85; a += 2.5) {
    const c = f2c(Math.sin(a * DEG) * 50, Math.cos(a * DEG) * 50);
    const p = proj(c.x, 0, c.z);
    if (!p) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  // goal line + goal square
  const gl = (x1, z1, x2, z2, w) => {
    const a = f2c(x1, z1), b = f2c(x2, z2);
    line3(a.x, 0, a.z, b.x, 0, b.z, 'rgba(255,255,255,0.85)', w);
  };
  gl(-BEHIND_HALF, 0, BEHIND_HALF, 0, 3);
  gl(-GOAL_HALF, 0, -GOAL_HALF, 9, 2); gl(GOAL_HALF, 0, GOAL_HALF, 9, 2);
  gl(-GOAL_HALF, 9, GOAL_HALF, 9, 2);
  ctx.restore();
  // soft edges pull the eye to the middle
  g = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function drawPosts() {
  const posts = [
    { x: -BEHIND_HALF, h: 6.5 }, { x: BEHIND_HALF, h: 6.5 },
    { x: -GOAL_HALF, h: 11 }, { x: GOAL_HALF, h: 11 }
  ];
  const k = S.kick;
  for (const p of posts) {
    const c = f2c(p.x, 0);
    // a poster leaves the post shuddering
    let wob = 0;
    if (FX.wobble && FX.wobble.x === p.x) wob = 0.4 * Math.exp(-FX.wobble.t * 2.6) * Math.sin(FX.wobble.t * 30);
    const ct = f2c(p.x + wob, 0);
    const base = proj(c.x, 0, c.z), top = proj(ct.x, p.h, ct.z);
    if (!base || !top) continue;
    const w = Math.max(2.5, base.s * 0.1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = w + 2;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.strokeStyle = '#f7f5ef'; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = w * 0.35;
    ctx.beginPath(); ctx.moveTo(base.x + w * 0.28, base.y); ctx.lineTo(top.x + w * 0.28, top.y); ctx.stroke();
    // pad, in the home side's colours
    const padTop = proj(c.x, Math.min(2.2, p.h), c.z);
    ctx.strokeStyle = TEAMS[0].main; ctx.lineWidth = w * 1.8;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(padTop.x, padTop.y); ctx.stroke();
    const band = proj(c.x, 1.3, c.z);
    ctx.strokeStyle = TEAMS[0].trim; ctx.lineWidth = w * 1.85;
    ctx.beginPath(); ctx.moveTo(band.x, band.y); ctx.lineTo(band.x, band.y - base.s * 0.25); ctx.stroke();
    ctx.lineCap = 'butt';
    // wind flag on the tall goal posts
    if (p.h > 8) {
      const wm = Math.hypot(k.wvx, k.wvz) || 0.001;
      const flut = 1 + 0.12 * Math.sin(S.time * 7 + p.x);
      const fl = (0.6 + wm * 0.28) * flut;               // flag length in metres
      const ec = f2c(p.x + wob + k.wvx / wm * fl, k.wvz / wm * fl);
      const tip = proj(ec.x, p.h - 0.25 - 0.1 * Math.sin(S.time * 9 + p.x), ec.z);
      const low = proj(ct.x, p.h - 0.75, ct.z);
      if (tip && low) {
        ctx.fillStyle = '#ffdd33'; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y); ctx.lineTo(tip.x, tip.y); ctx.lineTo(low.x, low.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  }
}

function drawConfetti() {
  for (const c of FX.confetti) {
    const cc = f2c(c.x, c.z), p = proj(cc.x, c.y, cc.z);
    if (!p) continue;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(c.rot);
    ctx.fillStyle = c.col;
    const w = Math.max(1.5, p.s * 0.16), h = Math.max(1, p.s * 0.09 * Math.abs(Math.cos(c.rot * 1.3)));
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function drawArrow() {
  const k = S.kick;
  if (S.phase !== 'aim' && S.phase !== 'power' && S.phase !== 'runup') return;
  const locked = S.phase !== 'aim';
  const len = 8, th = k.aim;
  const pts = [];
  for (let u = 0.06; u <= 1; u += 0.94 / 10) {
    const p = proj(Math.sin(th) * u * len, 0.02, Math.cos(th) * u * len);
    if (p) pts.push(p);
  }
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = locked ? 0.55 : 1;
  const pulse = locked ? 0 : Math.sin(S.time * 8) * 1.5;
  ctx.strokeStyle = locked ? '#ffe97a' : '#ffdd33';
  ctx.lineCap = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.lineWidth = 11 - i * 0.8 + pulse * 0.3;
    ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y); ctx.stroke();
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(b.x + Math.cos(ang) * 14, b.y + Math.sin(ang) * 14);
  ctx.lineTo(b.x + Math.cos(ang + 2.5) * 11, b.y + Math.sin(ang + 2.5) * 11);
  ctx.lineTo(b.x + Math.cos(ang - 2.5) * 11, b.y + Math.sin(ang - 2.5) * 11);
  ctx.fill();
  ctx.restore();
  ctx.lineCap = 'butt';
}

// Footy seen side-on: leather, a seam and a row of stitches. `tumble` squashes
// its length as it turns end over end in flight.
function drawBallSprite(x, y, rx, ry, rot, tumble) {
  rx = Math.max(3, rx); ry = Math.max(2, ry);
  const len = rx * (0.5 + 0.5 * Math.abs(Math.cos(tumble)));
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  const g = ctx.createRadialGradient(-len * 0.3, -ry * 0.4, 1, 0, 0, Math.max(len, ry) * 1.2);
  g.addColorStop(0, '#d45a44'); g.addColorStop(1, '#7c2219');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, Math.max(len, ry * 1.05), ry, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(40,10,6,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  if (rx > 5) {
    ctx.strokeStyle = '#f3ecd9'; ctx.lineWidth = Math.max(0.8, ry * 0.12);
    ctx.beginPath(); ctx.moveTo(-len * 0.45, -ry * 0.12); ctx.lineTo(len * 0.45, -ry * 0.12); ctx.stroke();
    ctx.lineWidth = Math.max(0.6, ry * 0.08);
    for (let i = -2; i <= 2; i++) {
      const sx = i * len * 0.14;
      ctx.beginPath(); ctx.moveTo(sx, -ry * 0.32); ctx.lineTo(sx, ry * 0.08); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFlightBall() {
  const k = S.kick;
  if (!k.ball) return;
  for (let i = 0; i < k.trail.length; i++) {
    const t = k.trail[i], c = f2c(t.x, t.z), p = proj(c.x, t.y, c.z);
    if (!p) continue;
    ctx.fillStyle = `rgba(255,255,255,${0.06 + 0.3 * i / k.trail.length})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.s * 0.035), 0, 7); ctx.fill();
  }
  const b = k.ball, c = f2c(b.x, b.z);
  const sh = proj(c.x, 0, c.z);
  if (sh) {
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.06, 0.3 - b.y * 0.012)})`;
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y, sh.s * 0.15, sh.s * 0.05, 0, 0, 7); ctx.fill();
  }
  const p = proj(c.x, b.y + 0.12, c.z);
  if (!p) return;
  const wobble = (1 - k.quality) * Math.sin(k.spin * 0.7) * 0.8;   // a shank wobbles off line
  drawBallSprite(p.x, p.y, p.s * 0.15, p.s * 0.095, wobble, k.spin);
}

// ---------- the frame ----------
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);   // keep drawing in CSS pixels at any DPR
  drawField();
  drawArrow();
  // everything standing on the ground, painted far to near
  const k = S.kick, zOf = (fx, fz) => f2c(fx, fz).z;
  const kz = S.phase === 'flight' || S.phase === 'result' ? 0 : kickerSpot(k.runT).z;
  const items = [
    { z: zOf(0, -1.2), draw: drawUmpire },
    { z: zOf(0, 0), draw: () => { drawPosts(); drawConfetti(); } },
    { z: zOf(k.dxf, k.dzf), draw: drawDefender },
    { z: kz, draw: drawKicker }
  ];
  if (k.ball) items.push({ z: f2c(k.ball.x, k.ball.z).z, draw: drawFlightBall });
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.draw();
  drawHUD();
}
