'use strict';
// Rules, game state and ball physics. Field metres throughout: the goal line is
// z = 0, kicks come from +z, and x runs across the ground.

const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const GRAV = 9.8, MAX_KICK = 68, TOTAL_ROUNDS = 10;
const GOAL_HALF = 3.2, BEHIND_HALF = 9.6;     // metres, AFL post spacing
const SWEEP_MAX = 24 * DEG;
const RED_ZONE = 82;
const RUN_SPD = 100 / 1.15;
// per-player difficulty: meter speeds, run-up sweet zone, kick scatter, wind punishment
const DIFFS = {
  easy:   { label: 'EASY', sweep: 38 * DEG, power: 68,  lo: 62, hi: 88, scatter: 0.55, wind: 0.6  },
  medium: { label: 'MED',  sweep: 55 * DEG, power: 95,  lo: 68, hi: 82, scatter: 1.0,  wind: 1.0  },
  hard:   { label: 'HARD', sweep: 75 * DEG, power: 122, lo: 71, hi: 79, scatter: 1.45, wind: 1.25 }
};
const WIND_ACC = 0.16;                        // m/s^2 of ball drift per m/s of wind

// Made-up clubs. Real club names and colours would put someone else's brand on
// a public page, so the kickers and the man on the mark play for these instead.
const TEAMS = [
  { name: 'Seagulls', main: '#1d3f94', trim: '#ffd23c', shorts: '#12275e', socks: '#ffd23c', num: '#ffd23c', skin: '#e9b48c', hair: '#5a3a22' },
  { name: 'Rockets',  main: '#d0342c', trim: '#ffffff', shorts: '#ffffff', socks: '#d0342c', num: '#ffffff', skin: '#a8714e', hair: '#1c1410' }
];
const WOMBATS = { name: 'Wombats', main: '#6b2230', trim: '#c9c2b4', shorts: '#2a2a30', socks: '#6b2230', num: '#c9c2b4', skin: '#d99c74', hair: '#2b1d12' };
const UMPIRE = { main: '#f6f6f2', trim: '#dcdcd4', shorts: '#f6f6f2', socks: '#f6f6f2', legs: '#f6f6f2', boots: '#2a2a2a', skin: '#e3a883', hair: '#8a8a8a', coat: true, hat: true };

// ---------- game state ----------
let S = null;
const curP = () => S.players[S.turn];
const curD = () => DIFFS[curP().diff];

function newGame(cfg) {
  // schedule: 7 shots inside 50, 3 bombs from outside, shuffled;
  // both players kick each round from the same spot in the same wind
  const dists = [];
  for (let i = 0; i < 7; i++) dists.push(20 + Math.random() * 28);
  for (let i = 0; i < 3; i++) dists.push(50 + Math.random() * 6);
  for (let i = dists.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dists[i], dists[j]] = [dists[j], dists[i]];
  }
  S = {
    rounds: dists.map(d => ({
      dist: d,
      angle: (Math.random() * 2 - 1) * (d > 49 ? 15 : 28) * DEG,
      windDir: Math.random() * 2 * Math.PI,          // field bearing the wind blows TOWARD
      windSpd: 4 + Math.random() * 26                // km/h
    })),
    players: cfg.map((c, i) => ({ name: c.name, diff: c.diff, goals: 0, behinds: 0, team: TEAMS[i], num: i ? 23 : 7 })),
    round: 1, turn: 0,
    phase: 'aim', kick: null,
    resultText: '', resultSub: '', resultColor: '#fff', resultT: 0, outcome: '',
    time: 0
  };
  setupKick();
}

function nextKick() {
  if (S.players.length === 2 && S.turn === 0) {
    S.turn = 1;                                // hand over to player 2, same round/spot/wind
  } else {
    S.turn = 0; S.round++;                     // next round (solo: every kick; 2P: after both kicked)
  }
  if (S.round > TOTAL_ROUNDS) { S.phase = 'gameover'; return; }
  setupKick();
}

function setupKick() {
  const { dist, angle, windDir, windSpd } = S.rounds[S.round - 1];
  const bx = Math.sin(angle) * dist, bz = Math.cos(angle) * dist;
  const inv = 1 / Math.hypot(bx, bz);
  const fx = -bx * inv, fz = -bz * inv;        // camera forward (ball -> goal centre)
  const rx = -fz, rz = fx;                      // camera right
  const markDist = Math.max(4, Math.min(9, dist - 7));
  const ws = windSpd / 3.6;                       // m/s
  S.kick = {
    dist, angle, bx, bz, fx, fz, rx, rz,
    windSpd, wvx: Math.sin(windDir) * ws, wvz: Math.cos(windDir) * ws,
    markDist, dxf: bx + fx * markDist, dzf: bz + fz * markDist, // defender field pos
    aim: 0, aimDir: 1, aimLocked: false,
    power: 0, pDir: 1,
    runT: 0, timing: '',
    ball: null, trail: [], touched: false, smothered: false, crossed: false,
    flightT: 0, defJump: 0, spin: 0, kickPoseT: -1, quality: 0, kickFrom: null
  };
  S.outcome = '';
  S.phase = 'aim';
  resetCamera();
}

// ---------- kicking physics ----------
function doKick() {
  const k = S.kick, d = curD();
  const t = k.runT;
  const mid = (d.lo + d.hi) / 2, qspan = (d.hi - d.lo) / 2 / 0.3;
  const q = Math.max(0, 1 - Math.abs(t - mid) / qspan);       // run-up timing quality 0..1
  // said back to the player after the kick, so the green zone teaches something
  k.timing = t < d.lo ? 'early' : t > d.hi ? 'late' : q > 0.9 ? 'perfect' : 'good';
  const targetDist = k.power / 100 * MAX_KICK;
  const elev = (20 + 19 * q + (Math.random() * 3 - 1.5)) * DEG;
  let v = Math.sqrt(Math.max(3, targetDist) * GRAV / Math.sin(2 * 38 * DEG));
  v *= 0.85 + 0.15 * q;                                       // mistimed kicks lose distance too
  let scatter = 0.5;
  if (k.power > RED_ZONE) scatter += 6 * (k.power - RED_ZONE) / (100 - RED_ZONE); // overcooked
  scatter += (1 - q) * 5;                                     // shanked off the run-up
  scatter *= d.scatter;
  const th = k.aim + (Math.random() * 2 - 1) * scatter * DEG;
  const dirX = k.fx * Math.cos(th) + k.rx * Math.sin(th);
  const dirZ = k.fz * Math.cos(th) + k.rz * Math.sin(th);
  const vh = v * Math.cos(elev);
  k.ball = { x: k.bx, z: k.bz, y: 0.3, vx: vh * dirX, vz: vh * dirZ, vy: v * Math.sin(elev) };
  k.trail = []; k.flightT = 0; k.kickPoseT = 0; k.quality = q;
  k.kickFrom = kickerSpot(k.runT);
  S.phase = 'flight';
  sndKick();
}

// outcome drives the umpire's signal, the players' reactions and the crowd
function setResult(points, text, sub, color, outcome) {
  if (points === 6) { curP().goals++; roar(true); tone(523, 0.5, 'triangle', 0.2); }
  else if (points === 1) { curP().behinds++; roar(false); }
  else tone(180, 0.35, 'sawtooth', 0.12, 90);
  S.resultText = text; S.resultSub = sub; S.resultColor = color; S.resultT = 0;
  S.outcome = outcome;
  S.phase = 'result';
  celebrate(outcome);
}

function stepFlight(dt) {
  const k = S.kick, b = k.ball;
  k.flightT += dt;
  // a clean drop punt spins slowly backwards; a shank tumbles fast
  k.spin += dt * (5 + (1 - k.quality) * 14);
  const steps = 3, sdt = dt / steps;
  const wk = WIND_ACC * curD().wind;
  for (let i = 0; i < steps; i++) {
    const pz = b.z;
    b.vy -= GRAV * sdt;
    if (b.y > 0.3) {                       // wind only drifts the airborne ball
      b.vx += k.wvx * wk * sdt;
      b.vz += k.wvz * wk * sdt;
    }
    b.x += b.vx * sdt; b.z += b.vz * sdt; b.y += b.vy * sdt;

    // man on the mark
    if (!k.touched && !k.crossed) {
      const hd = Math.hypot(b.x - k.dxf, b.z - k.dzf);
      if (hd < 1.0 && b.y > 0.4 && b.y < 3.35) {
        k.touched = true;
        if (b.y < 2.2) {           // smothered: ball killed dead
          k.smothered = true;
          b.vx *= 0.12; b.vz *= 0.12; b.vy = Math.min(b.vy, 0.5);
          tone(200, 0.15, 'square', 0.25, 80);
        } else {
          tone(300, 0.1, 'square', 0.15); // fingertips
        }
      }
    }

    // crossing the goal line (field z = 0), from in front
    if (!k.crossed && pz > 0 && b.z <= 0) {
      k.crossed = true;
      const frac = pz / (pz - b.z);
      const ix = (b.x - b.vx * sdt) + b.vx * sdt * frac;
      const ax = Math.abs(ix);
      if (ax < GOAL_HALF - 0.15) {
        if (k.touched) setResult(1, 'TOUCHED — BEHIND', k.smothered ? 'Smothered on the mark!' : 'Fingertips off the mark', '#ffd35c', 'touched');
        else setResult(6, 'GOAL!', k.quality > 0.9 ? 'Straight through the big sticks!' : 'It\'s a major!', '#ffd700', 'goal');
      } else if (ax < GOAL_HALF + 0.15) {
        wobblePost(Math.sign(ix) * GOAL_HALF);
        setResult(1, 'POSTER!', 'Clunks off the goal post — one point', '#ffd35c', 'poster');
      } else if (ax < BEHIND_HALF) {
        setResult(1, 'BEHIND', 'Just misses — one point', '#ffd35c', 'behind');
      } else {
        setResult(0, 'OUT ON THE FULL', 'Way off target — no score', '#ff7b6b', 'miss');
      }
      return;
    }

    // ground contact
    if (b.y <= 0 && b.vy < 0) {
      b.y = 0;
      const spd = Math.hypot(b.vx, b.vz);
      if (Math.abs(b.vy) < 1.2 || spd < 1) {   // rolling / dead
        b.vy = 0;
        b.vx *= Math.exp(-2.2 * sdt * steps); b.vz *= Math.exp(-2.2 * sdt * steps);
        if (spd < 0.8) {
          if (k.smothered) setResult(0, 'SMOTHERED!', 'The man on the mark kills it dead', '#ff7b6b', 'smother');
          else setResult(0, 'SHORT', 'Doesn\'t make the distance', '#ff7b6b', 'short');
          return;
        }
      } else {
        b.vy = -b.vy * 0.42;
        b.vx *= 0.62; b.vz *= 0.62;
        // odd-shaped ball: random deviation off the bounce
        const a = (Math.random() * 2 - 1) * 6 * DEG, c = Math.cos(a), s2 = Math.sin(a);
        const nvx = b.vx * c - b.vz * s2, nvz = b.vx * s2 + b.vz * c;
        b.vx = nvx; b.vz = nvz;
        tone(90, 0.06, 'sine', 0.15);
      }
    }
  }
  // defender jump anim
  const hd = Math.hypot(b.x - k.dxf, b.z - k.dzf);
  k.defJump += (((hd < 8 && !k.crossed) ? 0.55 : 0) - k.defJump) * Math.min(1, dt * 8);

  k.trail.push({ x: b.x, z: b.z, y: b.y });
  if (k.trail.length > 40) k.trail.shift();
  if (k.flightT > 9) setResult(0, 'NO SCORE', '', '#ff7b6b', 'short');
}

// ---------- update ----------
function update(dt) {
  S.time += dt;
  const k = S.kick;
  if (k.kickPoseT >= 0) k.kickPoseT += dt;
  if (S.phase === 'aim') {
    k.aim += k.aimDir * curD().sweep * dt;
    if (k.aim > SWEEP_MAX) { k.aim = SWEEP_MAX; k.aimDir = -1; }
    if (k.aim < -SWEEP_MAX) { k.aim = -SWEEP_MAX; k.aimDir = 1; }
  } else if (S.phase === 'power') {
    k.power += k.pDir * curD().power * dt;
    if (k.power > 100) { k.power = 100; k.pDir = -1; }
    if (k.power < 0) { k.power = 0; k.pDir = 1; }
  } else if (S.phase === 'runup') {
    k.runT += RUN_SPD * dt;
    if (k.runT >= 100) { k.runT = 100; doKick(); }  // ran past the ball — auto shank
  } else if (S.phase === 'flight') {
    stepFlight(Math.min(dt, 0.04));
  } else if (S.phase === 'result') {
    S.resultT += dt;
    // a goal gets longer on screen so the umpire's flags and the confetti can finish
    if (S.resultT > (S.outcome === 'goal' ? 3.4 : 2.6)) nextKick();
  }
}
