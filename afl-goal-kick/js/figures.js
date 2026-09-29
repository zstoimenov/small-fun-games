'use strict';
// Players and the goal umpire. Each figure is a tiny 3D skeleton projected with
// the same camera as the ground, so a leg swinging toward the goals really does
// shrink into the distance instead of just sliding up the screen.
//
// Pose frame: x = the body's right, y = up, z = the way the body faces (metres).
// A pose is a handful of joint angles; poses blend by lerping those numbers.

const THIGH = 0.46, SHIN = 0.44, UPPER = 0.3, FORE = 0.28;

// every pose has the same shape, so any two can be blended
function mkPose(o) {
  const leg = (x) => ({ a: 0, b: 0.08, x });
  const arm = () => ({ r: 0.15, f: 1.3, b: 0.2 });
  const p = { lean: 0.02, y: 0, legL: leg(-0.02), legR: leg(0.02), armL: arm(), armR: arm(), face: 'o' };
  for (const key in o) {
    if (o[key] && typeof o[key] === 'object') Object.assign(p[key], o[key]);
    else p[key] = o[key];
  }
  return p;
}
function lerpPose(a, b, t) {
  const out = {};
  for (const key in a) {
    const va = a[key], vb = b[key];
    if (typeof va === 'number') out[key] = va + (vb - va) * t;
    else if (va && typeof va === 'object') out[key] = lerpPose(va, vb, t);
    else out[key] = t < 0.5 ? va : vb;
  }
  return out;
}
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

// pose angles -> joint positions in the body frame
function joints(p) {
  const J = {};
  const pel = [0, 1.0, 0];
  const up = [0, Math.cos(p.lean), Math.sin(p.lean)];
  J.pelvis = pel;
  J.neck = [0, pel[1] + up[1] * 0.55, up[2] * 0.55];
  J.head = [0, J.neck[1] + up[1] * 0.2, J.neck[2] + up[2] * 0.2];
  for (const [side, key] of [[-1, 'L'], [1, 'R']]) {
    const lg = p['leg' + key], hip = [side * 0.1, pel[1] - 0.04, 0];
    const c = lg.a - lg.b;
    const knee = [hip[0] + lg.x * 0.5, hip[1] - THIGH * Math.cos(lg.a), hip[2] + THIGH * Math.sin(lg.a)];
    const ankle = [hip[0] + lg.x, knee[1] - SHIN * Math.cos(c), knee[2] + SHIN * Math.sin(c)];
    J['hip' + key] = hip; J['knee' + key] = knee; J['ankle' + key] = ankle;
    J['toe' + key] = [ankle[0], ankle[1] + 0.15 * Math.sin(c) - 0.02, ankle[2] + 0.15 * Math.cos(c)];

    const am = p['arm' + key], sh = [side * 0.2, J.neck[1] - 0.05, J.neck[2]];
    const dir = (r) => [side * Math.sin(r) * Math.sin(am.f), -Math.cos(r), Math.sin(r) * Math.cos(am.f)];
    const d1 = dir(am.r), d2 = dir(am.r + am.b);
    const el = [sh[0] + d1[0] * UPPER, sh[1] + d1[1] * UPPER, sh[2] + d1[2] * UPPER];
    J['sh' + key] = sh; J['el' + key] = el;
    J['hand' + key] = [el[0] + d2[0] * FORE, el[1] + d2[1] * FORE, el[2] + d2[2] * FORE];
  }
  // keep the lower foot on the grass, then add any jump on top
  const low = Math.min(J.ankleL[1], J.ankleR[1], J.toeL[1] + 0.02, J.toeR[1] + 0.02);
  const lift = 0.07 - low + p.y;
  for (const key in J) J[key] = [J[key][0], J[key][1] + lift, J[key][2]];
  return J;
}

// ---------- drawing ----------
const OUTLINE = 'rgba(8,14,24,0.5)';

// pos: camera coords of the feet; facing +1 = back to the camera, -1 = facing it
function drawFigure(pos, facing, pose, st, extra = {}) {
  const J = joints(pose);
  const P = {}, Z = {};
  for (const key in J) {
    const j = J[key], cz = pos.z + j[2] * facing;
    const p = proj(pos.x + j[0] * facing, j[1], cz);
    if (!p || p.s > 900) return;            // right on top of the camera: skip, don't smear
    P[key] = p; Z[key] = cz;
  }
  const sp = proj(pos.x, 0, pos.z);
  if (sp) {                                  // shadow grows softer as the figure jumps
    const lift = Math.max(0, Math.min(J.ankleL[1], J.ankleR[1]) - 0.07);
    ctx.fillStyle = `rgba(0,0,0,${0.24 / (1 + lift * 2)})`;
    ctx.beginPath(); ctx.ellipse(sp.x, sp.y, sp.s * 0.45, sp.s * 0.12, 0, 0, 7); ctx.fill();
  }
  const back = facing > 0, legCol = st.legs || st.skin, boots = st.boots || '#15171c';

  const groups = [];
  const limb = (segs, depth, after) => groups.push({ depth, segs, after });
  for (const key of ['L', 'R']) {
    const hip = P['hip' + key], knee = P['knee' + key], ank = P['ankle' + key], toe = P['toe' + key];
    const mid = lerpP(hip, knee, 0.45), sockTop = lerpP(knee, ank, 0.45);
    limb([
      [hip, knee, 0.16, legCol], [knee, ank, 0.12, legCol],
      [sockTop, ank, 0.125, st.socks], [ank, toe, 0.1, boots],
      [hip, mid, st.coat ? 0.19 : 0.2, st.shorts]
    ], (Z['knee' + key] + Z['ankle' + key]) / 2);
    const sh = P['sh' + key], el = P['el' + key], hand = P['hand' + key];
    const flag = extra.flags && extra.flags.includes(key);
    limb([[sh, el, 0.1, st.coat ? st.main : st.skin], [el, hand, 0.085, st.skin]],
      (Z['el' + key] + Z['hand' + key]) / 2,
      flag ? () => drawFlag(pos, facing, J['el' + key], J['hand' + key]) : null);
  }
  const torsoZ = Z.pelvis;
  groups.push({ depth: torsoZ, draw: () => drawTorso(P, st, back, extra.num) });
  groups.push({ depth: torsoZ - 0.02, draw: () => drawHead(P, st, back, pose.face) });
  if (extra.ball) {
    const b = extra.ball(J), cz = pos.z + b[2] * facing;
    const bp = proj(pos.x + b[0] * facing, b[1], cz);
    if (bp) groups.push({ depth: cz, draw: () => drawBallSprite(bp.x, bp.y, bp.s * 0.15, bp.s * 0.095, -0.5, 0) });
  }
  groups.sort((a, b) => b.depth - a.depth);

  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const g of groups) {
    if (g.draw) { g.draw(); continue; }
    // outlines first, then fills, so joints read as one limb rather than beads
    for (const [a, b, w] of g.segs) segLine(a, b, w, OUTLINE, true);
    for (const [a, b, w, col] of g.segs) segLine(a, b, w, col, false);
    if (g.after) g.after();
  }
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
}

const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: a.s + (b.s - a.s) * t });

function segLine(a, b, wm, col, outline) {
  const s = (a.s + b.s) / 2;
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.5, wm * s) + (outline ? Math.max(1.4, s * 0.03) : 0);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function drawTorso(P, st, back, num) {
  const o = (p, q, t) => ({ x: p.x + (p.x - q.x) * t, y: p.y + (p.y - q.y) * t });
  const shL = o(P.shL, P.shR, 0.12), shR = o(P.shR, P.shL, 0.12);
  let hipL = o(P.hipL, P.hipR, 0.35), hipR = o(P.hipR, P.hipL, 0.35);
  if (st.coat) {                            // the goal umpire's long white coat
    hipL = { x: hipL.x, y: hipL.y + (P.kneeL.y - P.hipL.y) * 0.55 };
    hipR = { x: hipR.x, y: hipR.y + (P.kneeR.y - P.hipR.y) * 0.55 };
  } else {                                  // waistband of the shorts
    segLine(P.hipL, P.hipR, 0.24, OUTLINE, true);
    segLine(P.hipL, P.hipR, 0.24, st.shorts, false);
  }
  const s = P.neck.s;
  ctx.beginPath();
  ctx.moveTo(shL.x, shL.y); ctx.lineTo(shR.x, shR.y); ctx.lineTo(hipR.x, hipR.y); ctx.lineTo(hipL.x, hipL.y);
  ctx.closePath();
  ctx.fillStyle = st.main; ctx.fill();
  ctx.save(); ctx.clip();
  const L = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  if (back) {
    // a hoop across the shoulders, then the number underneath it
    const a = L(shL, hipL, 0.14), b = L(shR, hipR, 0.14), c = L(shR, hipR, 0.3), d = L(shL, hipL, 0.3);
    ctx.fillStyle = st.trim;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill();
    if (num && s > 6) {
      const m1 = L(shL, hipL, 0.6), m2 = L(shR, hipR, 0.6);
      ctx.fillStyle = st.num; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.max(6, s * 0.26)}px system-ui`;
      ctx.fillText(num, (m1.x + m2.x) / 2, (m1.y + m2.y) / 2);
    }
  } else if (!st.coat) {
    // a chevron on the front
    const mid = L(P.neck, P.pelvis, 0.5);
    ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.beginPath(); ctx.moveTo(shL.x, shL.y); ctx.lineTo(mid.x, mid.y); ctx.lineTo(shR.x, shR.y); ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';     // coat buttons
    for (const t of [0.3, 0.5, 0.7]) {
      const m = L(P.neck, P.pelvis, t);
      ctx.beginPath(); ctx.arc(m.x, m.y, Math.max(0.8, s * 0.016), 0, 7); ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.moveTo(shL.x, shL.y); ctx.lineTo(shR.x, shR.y); ctx.lineTo(hipR.x, hipR.y); ctx.lineTo(hipL.x, hipL.y);
  ctx.closePath(); ctx.stroke();
}

function drawHead(P, st, back, face) {
  segLine(P.neck, P.head, 0.09, st.skin, false);
  const h = P.head, r = Math.max(2, h.s * 0.115);
  ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(h.x, h.y, r + Math.max(0.8, h.s * 0.015), 0, 7); ctx.fill();
  ctx.fillStyle = st.skin; ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, 7); ctx.fill();
  if (st.hat) {                              // wide-brim goal umpire hat
    ctx.fillStyle = '#fbfbf8';
    ctx.beginPath(); ctx.ellipse(h.x, h.y - r * 0.55, r * 1.5, r * 0.35, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(h.x, h.y - r * 0.6, r * 0.85, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#20314f'; ctx.fillRect(h.x - r * 0.85, h.y - r * 0.75, r * 1.7, r * 0.18);
  } else if (back) {
    ctx.fillStyle = st.hair;
    ctx.beginPath(); ctx.arc(h.x, h.y - r * 0.08, r * 0.98, 0, 7); ctx.fill();
    ctx.fillStyle = st.skin;                 // ears
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(h.x + sx * r * 0.95, h.y + r * 0.1, r * 0.22, 0, 7); ctx.fill(); }
  } else {
    ctx.fillStyle = st.hair;
    ctx.beginPath(); ctx.arc(h.x, h.y, r, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  }
  if (back || r < 4) return;
  ctx.fillStyle = '#1a1a1a';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(h.x + sx * r * 0.36, h.y + r * 0.05, r * 0.11, 0, 7); ctx.fill(); }
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  if (face === 'happy') ctx.arc(h.x, h.y + r * 0.25, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (face === 'sad') ctx.arc(h.x, h.y + r * 0.7, r * 0.3, 1.2 * Math.PI, 1.8 * Math.PI);
  else { ctx.fillStyle = '#5a1f1f'; ctx.arc(h.x, h.y + r * 0.45, r * 0.16, 0, 7); ctx.fill(); return; }
  ctx.stroke();
}

// a goal umpire's flag: a stick carried on past the hand, cloth rippling on top
function drawFlag(pos, facing, el, hand) {
  const d = [hand[0] - el[0], hand[1] - el[1], hand[2] - el[2]];
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  const tip = [hand[0] + d[0] / len * 0.5, hand[1] + d[1] / len * 0.5 + 0.1, hand[2] + d[2] / len * 0.5];
  const pp = (j) => proj(pos.x + j[0] * facing, j[1], pos.z + j[2] * facing);
  const a = pp(hand), b = pp(tip);
  if (!a || !b) return;
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(1, b.s * 0.025);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  const w = b.s * 0.42, h = b.s * 0.3, ripple = Math.sin(S.time * 16) * h * 0.18;
  const dir = b.x >= a.x ? 1 : -1;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.quadraticCurveTo(b.x + dir * w * 0.5, b.y + ripple, b.x + dir * w, b.y);
  ctx.lineTo(b.x + dir * w, b.y + h);
  ctx.quadraticCurveTo(b.x + dir * w * 0.5, b.y + h + ripple, b.x, b.y + h);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

// ---------- the kicker ----------
const KICK_START = { x: -0.62, z: -3.7 }, KICK_SPOT = { x: -0.2, z: -0.45 };

// the run-up reaches the ball at the middle of the medium sweet zone
function kickerSpot(runT) {
  const t = runT / 75;
  return { x: KICK_START.x + (KICK_SPOT.x - KICK_START.x) * t, z: KICK_START.z + (KICK_SPOT.z - KICK_START.z) * t };
}

// arms cradling the ball out on the right hip, where it can be seen past the body
const HOLD = { armL: { r: 0.75, f: -0.35, b: 1.05 }, armR: { r: 0.65, f: 0.55, b: 0.95 } };
const holdBall = (J) => [(J.handL[0] + J.handR[0]) / 2 + 0.12, (J.handL[1] + J.handR[1]) / 2 + 0.02, (J.handL[2] + J.handR[2]) / 2 + 0.05];

function drawKicker() {
  const k = S.kick, p = curP(), st = p.team;
  let pos, pose, ball = null;
  if (S.phase === 'aim' || S.phase === 'power') {
    pos = kickerSpot(0);
    pose = mkPose({ ...HOLD, lean: 0.06 + Math.sin(S.time * 2.2) * 0.02 });
    ball = holdBall;
  } else if (S.phase === 'runup') {
    const ph = k.runT * 0.17, sn = Math.sin(ph);
    pos = kickerSpot(k.runT);
    const run = mkPose({
      ...HOLD, lean: 0.16, y: Math.abs(sn) * 0.05,
      legR: { a: 0.6 * sn, b: 0.25 + 1.1 * Math.max(0, -sn), x: 0.02 },
      legL: { a: -0.6 * sn, b: 0.25 + 1.1 * Math.max(0, sn), x: -0.02 }
    });
    // the last strides push the ball down toward the boot, ready for the drop
    const drop = ease((k.runT - curD().lo + 18) / 20);
    pose = lerpPose(run, mkPose({ ...run, armL: { r: 0.95, f: -0.3, b: 0.3 }, armR: { r: 0.9, f: 0.45, b: 0.3 } }), drop);
    ball = holdBall;
  } else {
    const u = Math.max(0, k.kickPoseT), q = k.quality, sw = ease(u / 0.28);
    const from = k.kickFrom || KICK_SPOT, lunge = ease(u / 0.1), carry = 0.9 * ease(u / 0.8);
    pos = { x: from.x + (KICK_SPOT.x - from.x) * lunge, z: from.z + (KICK_SPOT.z - from.z) * lunge + carry };
    const kick = mkPose({
      lean: -0.22 * sw,
      legR: { a: -0.6 + (2.1 + 0.6 * q) * sw, b: 1.3 - 1.25 * sw, x: 0.02 - (1 - q) * 0.4 * sw },
      legL: { a: -0.1, b: 0.15, x: -0.04 },
      armL: { r: 1.5, f: 1.5, b: 0.2 }, armR: { r: 0.9, f: 2.5, b: 0.3 }
    });
    pose = lerpPose(kick, mkPose({ lean: 0.04 }), clamp((u - 0.75) / 0.5, 0, 1));
    if (S.phase === 'result') pose = lerpPose(pose, reaction(S.outcome, S.resultT, false), ease(S.resultT / 0.35));
  }
  drawFigure(pos, 1, pose, st, { num: String(p.num), ball });
}

// how a player reacts to a result; `defending` flips who is happy
function reaction(outcome, t, defending) {
  const scored = outcome === 'goal' || outcome === 'behind' || outcome === 'poster' || outcome === 'touched';
  const happy = defending ? !scored || outcome === 'touched' : outcome === 'goal';
  if (happy) {
    const w = Math.sin(t * 9);
    return mkPose({
      y: Math.abs(Math.sin(t * 6.5)) * 0.28, face: 'happy', lean: -0.05,
      armL: { r: 2.85 + w * 0.15, f: 1.35, b: 0.1 }, armR: { r: 2.85 - w * 0.15, f: 1.35, b: 0.1 },
      legL: { b: 0.3 }, legR: { b: 0.3 }
    });
  }
  if (!defending && (outcome === 'behind' || outcome === 'poster' || outcome === 'touched')) {
    return mkPose({ armL: { r: 0.7, f: 1.5, b: 1.5 }, armR: { r: 0.7, f: 1.5, b: 1.5 }, face: 'o' }); // so close — shrug
  }
  if (defending && outcome === 'goal') {
    return mkPose({ lean: 0.4, face: 'sad', armL: { r: 0.1, f: 1.2, b: 0.1 }, armR: { r: 0.1, f: 1.2, b: 0.1 }, legL: { b: 0.2 }, legR: { b: 0.2 } });
  }
  return mkPose({ lean: 0.12, face: 'sad', armL: { r: 2.5, f: 1.0, b: 2.25 }, armR: { r: 2.5, f: 1.0, b: 2.25 } }); // hands on head
}

// ---------- the man on the mark ----------
function drawDefender() {
  const k = S.kick, pos = f2c(k.dxf, k.dzf), t = S.time;
  const wave = Math.sin(t * 3.2) * 0.1;
  let pose = mkPose({
    y: k.defJump * 1.3, face: 'o',
    armL: { r: 2.7 + wave, f: 1.2 - k.defJump * 1.3, b: 0.05 }, armR: { r: 2.7 - wave, f: 1.2 - k.defJump * 1.3, b: 0.05 },
    legL: { b: 0.25 + k.defJump * 0.8, x: -0.08 }, legR: { b: 0.25 + k.defJump * 0.8, x: 0.08 }
  });
  if (S.phase === 'result') pose = lerpPose(pose, reaction(S.outcome, S.resultT, true), ease(S.resultT / 0.4));
  drawFigure(pos, -1, pose, WOMBATS, {});
  if (S.phase !== 'flight' && S.phase !== 'result') {
    const lab = proj(pos.x, 2.75, pos.z);
    if (lab) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `700 ${Math.max(9, lab.s * 0.16)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('ON THE MARK', lab.x, lab.y);
    }
  }
}

// ---------- the goal umpire ----------
// Two fingers then two flags for a goal, one finger and one flag for a behind.
function drawUmpire() {
  const pos = f2c(0, -1.2), t = S.phase === 'result' ? S.resultT : 0, o = S.outcome;
  let pose = mkPose({ armL: { r: 0.2, f: 1.4, b: 0.15 }, armR: { r: 0.2, f: 1.4, b: 0.15 }, legL: { x: -0.06 }, legR: { x: 0.06 } });
  let flags = [];
  const point = { r: 1.5, f: 0.12, b: 0 };
  if (S.phase === 'result' && o === 'goal') {
    const w = Math.sin(t * 9);
    const sig = t < 1.0
      ? mkPose({ armL: point, armR: point, legL: { x: -0.06 }, legR: { x: 0.06 } })
      : mkPose({ armL: { r: 2.6 + w * 0.3, f: 0.6, b: 0.1 }, armR: { r: 2.6 - w * 0.3, f: 0.6, b: 0.1 }, legL: { x: -0.06 }, legR: { x: 0.06 } });
    pose = lerpPose(pose, sig, ease(t / 0.3));
    if (t >= 1.0) flags = ['L', 'R'];
  } else if (S.phase === 'result' && (o === 'behind' || o === 'poster' || o === 'touched')) {
    const sig = t < 1.0
      ? mkPose({ armR: point, legL: { x: -0.06 }, legR: { x: 0.06 } })
      : mkPose({ armR: { r: 2.1 + Math.sin(t * 9) * 0.35, f: 1.3, b: 0.1 }, legL: { x: -0.06 }, legR: { x: 0.06 } });
    pose = lerpPose(pose, sig, ease(t / 0.3));
    if (t >= 1.0) flags = ['R'];
  }
  drawFigure(pos, -1, pose, UMPIRE, { flags });
}
