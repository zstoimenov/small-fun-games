'use strict';
// Everything drawn over the scene: scoreboard, wind, minimap, power and run-up
// meters, the result banner and full time.

let US = 1, PORTRAIT = false, MARGIN = 10;     // UI scale, orientation, edge margin
let L = { sceneTop: 0 };                       // responsive HUD layout rectangles

// ---------- responsive sizing + HUD layout ----------
// The middle of the top edge is kept clear for the goal posts, and nothing may
// sit under the DOM "Games" link, so its box is measured rather than guessed.
function layout() {
  PORTRAIT = H > W;
  US = clamp(Math.min(W, H) / 600, 0.72, 1.3);
  MARGIN = Math.round(8 * US) + 2;
  // focal length fills the height in landscape; in portrait it's capped by width
  // so the goals still fit across a narrow screen (no distortion, no black bars)
  CAM.F = Math.min(H * 1.34, W * (PORTRAIT ? 1.4 : 2.6));

  const back = document.getElementById('back').getBoundingClientRect();
  const windW = Math.round(118 * US), windH = Math.round(44 * US);
  const mmW = Math.round(150 * US), mmH = Math.round(138 * US);
  const powerW = Math.round(26 * US);
  const barH = Math.round(26 * US);
  const gap = Math.round(8 * US);
  const two = S && S.players.length === 2;
  L = { windW, windH, mmW, mmH, powerW, barH, gap };

  if (PORTRAIT) {
    // row 1: scoreboard beside the Games link; row 2: shot info + wind;
    // minimap above the bottom control zone; power bar hugs the right edge
    const bx = Math.max(MARGIN, back.right + gap);
    L.board = { x: bx, y: MARGIN, w: W - bx - MARGIN, h: Math.max(Math.round((two ? 52 : 40) * US), back.bottom - MARGIN) };
    const row2 = L.board.y + L.board.h + gap;
    L.wind = { x: W - windW - MARGIN, y: row2, w: windW, h: windH };
    const shotH = Math.round(24 * US);
    L.shot = { x: MARGIN, y: row2 + (windH - shotH) / 2, w: W - windW - 3 * MARGIN, h: shotH };
    L.sceneTop = row2 + windH + gap;
    const barZone = Math.round(70 * US);
    L.minimap = { x: MARGIN, y: H - mmH - MARGIN - barZone, w: mmW, h: mmH };
    L.power = { x: W - powerW - MARGIN - Math.round(6 * US), y: L.wind.y + windH + Math.round(34 * US), w: powerW, h: 0 };
    L.power.h = (H - MARGIN - barZone) - L.power.y;
    const barW = Math.min(Math.round(460 * US), W - 2 * (powerW + 2 * MARGIN));
    L.bar = { cx: W / 2, w: barW, h: barH, y: H - barH - MARGIN - Math.round(4 * US) };
    L.result = { cx: W / 2, cy: Math.round(H * 0.4) };
  } else {
    // left column under the Games link: scoreboard then shot info;
    // wind top-right, power bar right, minimap bottom-left
    const colW = Math.round(190 * US);
    const boardH = Math.round((two ? 58 : 44) * US);
    L.board = { x: MARGIN, y: back.bottom + gap, w: colW, h: boardH };
    L.shot = { x: MARGIN, y: L.board.y + boardH + Math.round(6 * US), w: colW, h: Math.round(24 * US) };
    L.wind = { x: W - windW - MARGIN, y: MARGIN, w: windW, h: windH };
    L.sceneTop = MARGIN + 4;
    L.minimap = { x: MARGIN, y: H - mmH - MARGIN, w: mmW, h: mmH };
    L.power = { x: W - powerW - MARGIN - Math.round(6 * US), y: Math.round(H * 0.24), w: powerW, h: Math.round(H * 0.58) };
    const barW = Math.min(Math.round(520 * US), W - 2 * (mmW + 3 * MARGIN));
    L.bar = { cx: W / 2, w: barW, h: barH, y: H - barH - MARGIN - Math.round(18 * US) };
    L.result = { cx: W / 2, cy: Math.round(H * 0.68) };     // low, so the umpire's signal stays in view
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// fit a font so `text` at weight `wt` never exceeds `maxw`; returns the px size used
function fitFont(text, wt, px, maxw) {
  px = Math.round(px);
  ctx.font = `${wt} ${px}px system-ui`;
  const tw = ctx.measureText(text).width;
  if (tw > maxw) { px = Math.max(8, Math.floor(px * maxw / tw)); ctx.font = `${wt} ${px}px system-ui`; }
  return px;
}

function drawHUD() {
  const k = S.kick, d = curD(), s = US;
  const single = S.players.length === 1;

  // meters the player isn't using fade back while the ball is in the air
  const busy = S.phase === 'flight' || S.phase === 'result';
  ctx.globalAlpha = busy ? 0.4 : 1;
  drawMinimap();
  ctx.globalAlpha = 1;
  drawWind();

  // ---- scoreboard: one row per player, with a strip in their club colours ----
  const b = L.board;
  ctx.fillStyle = 'rgba(10,16,26,0.82)';
  roundRect(b.x, b.y, b.w, b.h, 10 * s); ctx.fill();
  ctx.textBaseline = 'middle';
  const rowH = b.h / S.players.length, pad = 8 * s;
  S.players.forEach((p, i) => {
    const active = (single || i === S.turn) && S.phase !== 'gameover';
    const cy = b.y + rowH * (i + 0.5), t = p.team;
    ctx.fillStyle = t.main; roundRect(b.x + pad, cy - rowH * 0.3, 7 * s, rowH * 0.6, 2 * s); ctx.fill();
    ctx.fillStyle = t.trim; ctx.fillRect(b.x + pad, cy - 1.5 * s, 7 * s, 3 * s);
    const score = `${p.goals}.${p.behinds} (${p.goals * 6 + p.behinds})`;
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
    const scFs = Math.round(Math.min(16 * s, rowH * 0.5));
    ctx.font = `800 ${scFs}px system-ui`;
    const scW = ctx.measureText(score).width;
    ctx.fillText(score, b.x + b.w - pad, cy);
    ctx.textAlign = 'left'; ctx.fillStyle = active ? '#ffdd33' : '#9fb4cc';
    const name = `${p.name.toUpperCase()} · ${DIFFS[p.diff].label}`;
    fitFont(name, active ? 800 : 600, Math.min(13 * s, rowH * 0.42), b.w - scW - 7 * s - pad * 3.5);
    ctx.fillText(name, b.x + pad + 7 * s + pad * 0.8, cy);
  });
  ctx.textAlign = 'center';

  // ---- shot info (includes the round count) ----
  const sh = L.shot, outside = k.dist > 50;
  ctx.fillStyle = 'rgba(10,16,26,0.7)';
  roundRect(sh.x, sh.y, sh.w, sh.h, 8 * s); ctx.fill();
  const side = k.angle < -1.5 * DEG ? `${Math.round(Math.abs(k.angle) / DEG)}° left` :
               k.angle > 1.5 * DEG ? `${Math.round(k.angle / DEG)}° right` : 'straight';
  const shotMsg = `R${Math.min(S.round, TOTAL_ROUNDS)}/${TOTAL_ROUNDS} • ${Math.round(k.dist)}m • ${side}${outside ? ' • OUT 50!' : ''}`;
  ctx.fillStyle = outside ? '#ffb347' : '#cfe3f7';
  fitFont(shotMsg, 600, 12.5 * s, sh.w - 12 * s);
  ctx.fillText(shotMsg, sh.x + sh.w / 2, sh.y + sh.h / 2);

  // ---- power bar (right edge) ----
  ctx.globalAlpha = busy ? 0.4 : 1;
  const pw = L.power, bx = pw.x, by = pw.y, bw = pw.w, bh = pw.h;
  ctx.fillStyle = 'rgba(10,16,26,0.7)'; roundRect(bx - 6 * s, by - 26 * s, bw + 12 * s, bh + 38 * s, 8 * s); ctx.fill();
  ctx.fillStyle = '#9fb4cc'; ctx.font = `600 ${Math.round(11 * s)}px system-ui`;
  ctx.fillText('POWER', bx + bw / 2, by - 14 * s);
  ctx.fillStyle = '#1a2433'; ctx.fillRect(bx, by, bw, bh);
  const ph = k.power / 100 * bh;
  const pg = ctx.createLinearGradient(0, by + bh, 0, by);
  pg.addColorStop(0, '#3ddc68'); pg.addColorStop(0.6, '#ffd23c'); pg.addColorStop(0.85, '#ff8a3c'); pg.addColorStop(1, '#ff4433');
  ctx.fillStyle = pg; ctx.fillRect(bx, by + bh - ph, bw, ph);
  const rz = by + bh - RED_ZONE / 100 * bh;
  ctx.strokeStyle = '#ff5544'; ctx.lineWidth = 2; ctx.strokeRect(bx - 1, by, bw + 2, rz - by);
  ctx.fillStyle = '#ff8a7a'; ctx.font = `600 ${Math.round(9 * s)}px system-ui`;
  ctx.fillText('WILD', bx + bw / 2, rz - 6 * s);
  const needP = Math.min(100, (k.dist + 3) / MAX_KICK * 100);
  const ny = by + bh - needP / 100 * bh;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(bx - 5 * s, ny); ctx.lineTo(bx + bw + 5 * s, ny); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.round(10 * s)}px system-ui`;
  ctx.fillText(`${Math.round(k.dist)}m`, bx + bw / 2, ny - 8 * s);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh);
  ctx.globalAlpha = 1;

  // ---- bottom control zone: run-up bar OR the phase prompt ----
  const bar = L.bar;
  if (S.phase === 'runup') {
    const msg = PORTRAIT ? 'RUN-UP — SPACE in the green!' : 'RUN-UP — press SPACE in the green zone to strike it clean!';
    drawRunBar(msg, '#ffdd33', 1);
  } else if (k.timing && (S.phase === 'flight' || (S.phase === 'result' && S.resultT < 1.2))) {
    // say where the kick was struck, so the green zone teaches something
    const T = { early: ['Too early! Wait for the green', '#ff9a6b'], late: ['Too late! Kick sooner', '#ff9a6b'],
                good: ['Good timing!', '#9ff0b4'], perfect: ['PERFECT timing!', '#3ddc68'] }[k.timing];
    drawRunBar(T[0], T[1], S.phase === 'result' ? 1 - clamp((S.resultT - 0.8) / 0.4, 0, 1) : 1);
  } else if (S.phase === 'aim' || S.phase === 'power') {
    const msg = S.phase === 'aim' ? 'SPACE — lock the arrow on the goal' :
      'SPACE — set power (into the red = long but WILD)';
    ctx.textAlign = 'center';
    const fs = fitFont(msg, 700, 15 * s, W - 2 * MARGIN - 24 * s);
    const tw = ctx.measureText(msg).width;
    const pw2 = tw + 24 * s, ph2 = fs + 18, cy = bar.y + bar.h / 2;
    ctx.fillStyle = 'rgba(10,16,26,0.82)';
    roundRect(bar.cx - pw2 / 2, cy - ph2 / 2, pw2, ph2, 10 * s); ctx.fill();
    ctx.fillStyle = '#ffdd33'; ctx.textBaseline = 'middle';
    ctx.fillText(msg, bar.cx, cy);
  }

  // ---- result banner ----
  if (S.phase === 'result') {
    const R = L.result;
    const pop = Math.min(1, S.resultT * 5);
    const sc = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3));
    const maxw = W - 4 * MARGIN;
    ctx.save();
    ctx.translate(R.cx, R.cy); ctx.scale(sc, sc);
    ctx.globalAlpha = pop; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const nameFs = fitFont(curP().name.toUpperCase(), 800, 22 * s, maxw);
    ctx.lineWidth = 5 * s; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(curP().name.toUpperCase(), 0, -46 * s);
    ctx.fillStyle = '#cfe3f7'; ctx.fillText(curP().name.toUpperCase(), 0, -46 * s);
    const bigFs = fitFont(S.resultText, 900, 60 * s, maxw);
    ctx.lineWidth = 8 * s; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(S.resultText, 0, 0);
    ctx.fillStyle = S.resultColor; ctx.fillText(S.resultText, 0, 0);
    if (S.resultSub) {
      fitFont(S.resultSub, 600, 19 * s, maxw);
      ctx.lineWidth = 5 * s; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(S.resultSub, 0, 40 * s);
      ctx.fillStyle = '#fff'; ctx.fillText(S.resultSub, 0, 40 * s);
    }
    ctx.restore();
  }

  if (S.phase === 'gameover') drawGameOver();
}

// the run-up meter: red, green, and a brighter "perfect" stripe in the middle
function drawRunBar(msg, msgCol, alpha) {
  const k = S.kick, d = curD(), s = US, bar = L.bar;
  const rw = bar.w, rh = bar.h, rx_ = bar.cx - rw / 2, ry = bar.y;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,16,26,0.82)'; roundRect(rx_ - 10 * s, ry - 26 * s, rw + 20 * s, rh + 36 * s, 10 * s); ctx.fill();
  ctx.fillStyle = msgCol; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitFont(msg, 700, 13 * s, rw + 16 * s);
  ctx.fillText(msg, bar.cx, ry - 13 * s);
  ctx.fillStyle = '#1a2433'; ctx.fillRect(rx_, ry, rw, rh);
  ctx.fillStyle = 'rgba(255,80,60,0.45)'; ctx.fillRect(rx_, ry, d.lo / 100 * rw, rh);
  ctx.fillStyle = 'rgba(61,220,104,0.7)'; ctx.fillRect(rx_ + d.lo / 100 * rw, ry, (d.hi - d.lo) / 100 * rw, rh);
  const mid = (d.lo + d.hi) / 2, half = (d.hi - d.lo) / 6;
  ctx.fillStyle = '#7dffa0'; ctx.fillRect(rx_ + (mid - half) / 100 * rw, ry, 2 * half / 100 * rw, rh);
  ctx.fillStyle = 'rgba(255,80,60,0.45)'; ctx.fillRect(rx_ + d.hi / 100 * rw, ry, (100 - d.hi) / 100 * rw, rh);
  const cxr = rx_ + k.runT / 100 * rw;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(cxr, ry - 2); ctx.lineTo(cxr - 7, ry - 12); ctx.lineTo(cxr + 7, ry - 12); ctx.fill();
  ctx.fillRect(cxr - 1.5, ry, 3, rh);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(rx_, ry, rw, rh);
  ctx.restore();
}

function drawWind() {
  const k = S.kick, r = L.wind, s = US;
  // wind in camera coords: +x = blowing right across screen, +z = tailwind (toward goal)
  const wxc = k.wvx * k.rx + k.wvz * k.rz;
  const wzc = k.wvx * k.fx + k.wvz * k.fz;
  ctx.fillStyle = 'rgba(10,16,26,0.82)';
  roundRect(r.x, r.y, r.w, r.h, 10 * s); ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const tx = r.x + r.w * 0.4;
  ctx.fillStyle = '#9fb4cc'; ctx.font = `600 ${Math.round(10 * s)}px system-ui`;
  ctx.fillText('WIND', tx, r.y + r.h * 0.3);
  ctx.fillStyle = k.windSpd > 20 ? '#ff9a6b' : '#fff'; ctx.font = `700 ${Math.round(15 * s)}px system-ui`;
  ctx.fillText(`${Math.round(k.windSpd)} km/h`, tx, r.y + r.h * 0.68);
  // compass arrow (up = toward the goal)
  const cx_ = r.x + r.w * 0.2, cy_ = r.y + r.h / 2, ang = Math.atan2(-wzc, wxc);
  const len = (8 + Math.min(1, k.windSpd / 30) * 6) * s;
  ctx.save();
  ctx.translate(cx_, cy_); ctx.rotate(ang);
  ctx.strokeStyle = '#ffdd33'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len - 4 * s, 0); ctx.stroke();
  ctx.fillStyle = '#ffdd33';
  ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len - 8 * s, -5.5 * s); ctx.lineTo(len - 8 * s, 5.5 * s); ctx.fill();
  ctx.restore();
  ctx.lineCap = 'butt'; ctx.textAlign = 'center';
}

function drawMinimap() {
  const k = S.kick, r = L.minimap, s = US;
  ctx.fillStyle = 'rgba(10,26,16,0.85)';
  roundRect(r.x, r.y, r.w, r.h, 10 * s); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; roundRect(r.x, r.y, r.w, r.h, 10 * s); ctx.stroke();
  const ox = r.x + r.w / 2, oy = r.y + 18 * s, sc = 1.9 * (r.w / 152);
  const P = (fx, fz) => ({ x: ox + fx * sc, y: oy + fz * sc });
  // 50m arc
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(ox, oy, 50 * sc, 0.12, Math.PI - 0.12); ctx.stroke();
  // goal line + posts
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(P(-BEHIND_HALF, 0).x, oy); ctx.lineTo(P(BEHIND_HALF, 0).x, oy); ctx.stroke();
  ctx.fillStyle = '#ffdd33';
  for (const px of [-GOAL_HALF, GOAL_HALF]) ctx.fillRect(P(px, 0).x - 1.5, oy - 4, 3, 4);
  ctx.fillStyle = '#bbb';
  for (const px of [-BEHIND_HALF, BEHIND_HALF]) ctx.fillRect(P(px, 0).x - 1, oy - 3, 2, 3);
  // defender
  const d = P(k.dxf, k.dzf);
  ctx.fillStyle = '#ff6a5a'; ctx.beginPath(); ctx.arc(d.x, d.y, 2.5, 0, 7); ctx.fill();
  // ball / player
  let bp = P(k.bx, k.bz);
  if (k.ball) bp = P(k.ball.x, k.ball.z);
  ctx.fillStyle = '#ffdd33'; ctx.beginPath(); ctx.arc(bp.x, bp.y, 3.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#9fd4a8'; ctx.font = `600 ${Math.round(10 * s)}px system-ui`; ctx.textAlign = 'center';
  ctx.fillText('FIELD POSITION', ox, r.y + r.h - 8 * s);
}

// one player's name / score / detail block, centred on (cx, cy)
function drawScoreBlock(p, cx, cy, highlight, s) {
  const tot = p.goals * 6 + p.behinds, maxw = (PORTRAIT ? W : W * 0.46) - 4 * MARGIN;
  ctx.fillStyle = highlight ? '#ffdd33' : '#9fb4cc';
  fitFont(`${p.name.toUpperCase()} · ${DIFFS[p.diff].label}`, 800, 24 * s, maxw);
  ctx.fillText(`${p.name.toUpperCase()} · ${DIFFS[p.diff].label}`, cx, cy);
  ctx.fillStyle = '#fff'; fitFont(`${p.goals}.${p.behinds} (${tot})`, 800, 50 * s, maxw);
  ctx.fillText(`${p.goals}.${p.behinds} (${tot})`, cx, cy + 40 * s);
  ctx.fillStyle = '#7a8ba0'; fitFont('x', 600, 15 * s, maxw);
  ctx.fillText(`${p.goals} goal${p.goals === 1 ? '' : 's'}, ${p.behinds} behind${p.behinds === 1 ? '' : 's'}`, cx, cy + 74 * s);
}

function drawGameOver() {
  const s = US, cx = W / 2;
  ctx.fillStyle = 'rgba(6,10,18,0.9)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffdd33'; fitFont('FULL TIME', 900, 46 * s, W - 4 * MARGIN);
  ctx.fillText('FULL TIME', cx, H * 0.14);

  let verdict;
  if (S.players.length === 1) {
    const p = S.players[0];
    drawScoreBlock(p, cx, H * 0.36, true, s);
    ctx.fillStyle = '#7a8ba0'; fitFont('x', 600, 14 * s, W - 4 * MARGIN);
    ctx.fillText(`from ${TOTAL_ROUNDS} set shots`, cx, H * 0.36 + 98 * s);
    if (p.goals >= 8) verdict = 'Elite! A dead-eye set-shot sniper.';
    else if (p.goals >= 6) verdict = 'Great kicking — a reliable spearhead.';
    else if (p.goals >= 4) verdict = 'Solid effort. Keep drilling those set shots.';
    else if (p.goals >= 2) verdict = 'Getting there — back to the training track!';
    else verdict = 'Tough day at the office. Have another crack!';
  } else {
    const [a, b] = S.players;
    const ta = a.goals * 6 + a.behinds, tb = b.goals * 6 + b.behinds;
    const win = (p, t) => t === Math.max(ta, tb) && ta !== tb;
    if (PORTRAIT) {
      drawScoreBlock(a, cx, H * 0.30, win(a, ta), s);
      drawScoreBlock(b, cx, H * 0.52, win(b, tb), s);
    } else {
      const off = Math.min(W * 0.26, 200 * s);
      drawScoreBlock(a, cx - off, H * 0.38, win(a, ta), s);
      drawScoreBlock(b, cx + off, H * 0.38, win(b, tb), s);
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(30 * s)}px system-ui`;
      ctx.fillText('—', cx, H * 0.38 + 32 * s);
    }
    if (ta === tb) verdict = 'A DRAW! Extra practice for both.';
    else {
      const w = ta > tb ? a : b, margin = Math.abs(ta - tb);
      verdict = margin >= 24 ? `${w.name} wins by ${margin} — a demolition!` :
                margin >= 12 ? `${w.name} wins by ${margin} — comfortable.` :
                `${w.name} wins by ${margin} — what a nail-biter!`;
    }
  }
  ctx.fillStyle = '#3ddc68'; fitFont(verdict, 700, 25 * s, W - 3 * MARGIN);
  ctx.fillText(verdict, cx, H * (PORTRAIT ? 0.72 : 0.66));

  ctx.fillStyle = '#ffdd33'; fitFont('Press SPACE or tap for a new match', 700, 18 * s, W - 3 * MARGIN);
  if (Math.sin(S.time * 4) > -0.3) ctx.fillText('Press SPACE or tap for a new match', cx, H * 0.86);
}

