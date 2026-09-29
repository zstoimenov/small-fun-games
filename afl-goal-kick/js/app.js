'use strict';
// Setup panel, input, sizing and the frame loop.

// ---------- input / phase machine ----------
function advance() {
  ac();
  const k = S.kick;
  if (S.phase === 'aim') {
    k.aimLocked = true; sndLock();
    S.phase = 'power';
  } else if (S.phase === 'power') {
    sndLock();
    S.phase = 'runup'; k.runT = 0;
  } else if (S.phase === 'runup') {
    doKick();
  } else if (S.phase === 'result') {
    if (S.resultT > 0.6) nextKick();
  } else if (S.phase === 'gameover') {
    showSetup();
  }
}
const setupEl = document.getElementById('setup');
const modeStep = document.getElementById('modeStep');
const nameStep = document.getElementById('nameStep');
const nameSub = document.getElementById('nameSub');
const pcard1 = document.getElementById('pcard1');
const startBtn = document.getElementById('start');
const setupVisible = () => setupEl.style.display !== 'none';
let chosenMode = 2;                             // 1 or 2 players

function showSetup() {                          // back to step 1 (mode select)
  setupEl.style.display = 'flex';
  modeStep.style.display = '';
  nameStep.style.display = 'none';
}
function showNameStep(mode) {                   // step 2 (names + difficulty)
  chosenMode = mode;
  modeStep.style.display = 'none';
  nameStep.style.display = '';
  pcard1.style.display = mode === 2 ? '' : 'none';
  nameSub.innerHTML = mode === 2
    ? 'Head-to-head &bull; 10 kicks each &bull; same spots, same wind, alternating kicks'
    : 'Solo &bull; 10 set shots &bull; aim, load the power, then time your run-up';
  startBtn.textContent = mode === 2 ? 'START MATCH' : 'START';
  document.getElementById('name0').focus();
}

for (const b of document.querySelectorAll('.modeBtn')) {
  b.addEventListener('click', () => { ac(); showNameStep(+b.dataset.mode); });
}
document.getElementById('backToMode').addEventListener('click', showSetup);

const diffSel = ['medium', 'medium'];
for (const i of [0, 1]) {
  document.getElementById('diffs' + i).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    diffSel[i] = b.dataset.d;
    for (const x of e.currentTarget.querySelectorAll('button')) x.classList.toggle('sel', x === b);
  });
}
startBtn.addEventListener('click', () => {
  ac();
  const cfg = [{ name: (document.getElementById('name0').value.trim() || 'Player 1'), diff: diffSel[0] }];
  if (chosenMode === 2) {
    cfg.push({ name: (document.getElementById('name1').value.trim() || 'Player 2'), diff: diffSel[1] });
  }
  newGame(cfg);
  resize();                                     // one or two scoreboard rows
  setupEl.style.display = 'none';
});
addEventListener('keydown', e => {
  if (setupVisible()) {
    if (e.key === 'Enter' && nameStep.style.display !== 'none') startBtn.click();
    return;                                   // let space type into the name fields
  }
  if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar' || e.keyCode === 32) {
    e.preventDefault(); advance();
  }
});
cv.addEventListener('pointerdown', () => { if (!setupVisible()) advance(); });

function resize() {
  W = Math.max(1, Math.floor(window.innerWidth));
  H = Math.max(1, Math.floor(window.innerHeight));
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);        // draw in CSS pixels
  layout();
  buildCrowd();
  if (S && (S.phase === 'aim' || S.phase === 'power' || S.phase === 'runup')) resetCamera();
  else CAM.baseHor = frameHor();
}

let last = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  if (S.phase !== 'gameover') { update(dt); updateCamera(dt); updateFx(dt); } else S.time += dt;
  render();
  requestAnimationFrame(frame);
}

// keep the canvas matched to the viewport in any size / orientation
resize();
addEventListener('resize', resize);
addEventListener('orientationchange', resize);
if (window.visualViewport) visualViewport.addEventListener('resize', resize);

newGame([{ name: 'Player 1', diff: 'medium' }, { name: 'Player 2', diff: 'medium' }]);
resize();                                       // the scoreboard's height depends on the player count
requestAnimationFrame(frame);

// Game Box uses a single service worker at the site root (../sw.js).
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
}
