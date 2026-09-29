/* Newton's Playground - the physics. Everything moves along one line (x, in   */
/* metres), which is all three laws need and keeps the numbers easy to tune.  */
/*                                                                             */
/* Friction is a slow-down in m/s per second, not a force: the laws are about  */
/* how things change speed, and a kid never sees the mass behind a friction   */
/* force anyway. Levels are tuned against these numbers, so changing one      */
/* means re-checking the target zones in levels.js.                           */
"use strict";
window.NL = window.NL || {};

NL.Physics = (function () {
  const TRACK = 20;          // the play area runs from x=0 to x=20
  const DT = 1 / 120;        // fixed step: the same flick always lands in the same place

  const SURF = {
    ice:   { D: 0.8, label: "Ice",   emoji: "\u{1F9CA}" },
    grass: { D: 2.5, label: "Grass", emoji: "\u{1F33F}" },
    sand:  { D: 6,   label: "Sand",  emoji: "\u{1F3D6}\u{FE0F}" },
    space: { D: 0,   label: "Space", emoji: "\u{1F680}" },
    floor: { D: 2,   label: "Floor", emoji: "" },
    path:  { D: 0.3, label: "Path",  emoji: "" },
    wire:  { D: 1.5, label: "",      emoji: "" }
  };

  // strips: [{ from, to, type }] in order along the track.
  function surfaceAt(strips, x) {
    for (const s of strips) if (x >= s.from && x < s.to) return s.type;
    return x < strips[0].from ? strips[0].type : strips[strips.length - 1].type;
  }

  // One step for one body. `push` is a speed-up (m/s per second) from a hand
  // or a jet of air. Friction only ever slows a body down; it never turns it
  // round, which is what a plain `v -= D*dt` would do at low speed.
  function step(body, D, push, dt) {
    const before = body.v;
    let v = before + (push || 0) * dt;
    if (v !== 0 && D > 0) {
      const dv = D * dt;
      v = Math.abs(v) <= dv ? 0 : v - Math.sign(v) * dv;
    }
    body.v = v;
    body.x += (before + v) / 2 * dt;
  }

  // Second law in one line: the speed-up is the push shared out over the
  // weight. The 8 just scales "hands" and "loads" into metres per second.
  function speedUp(force, mass) { return 8 * force / mass; }

  // Third law: a throw gives the ball and the thrower the same push, so the
  // thrower's kick is the ball's (mass x speed) shared over their own mass.
  function kickBack(ballMass, ballSpeed, selfMass) { return ballMass * ballSpeed / selfMass; }

  return { TRACK, DT, SURF, surfaceAt, step, speedUp, kickBack };
})();
