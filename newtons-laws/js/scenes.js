/* Newton's Playground - what happens in each kind of level.                   */
/*                                                                             */
/* A scene owns its bodies and its rules. It does not touch the DOM: it tells  */
/* the app what happened through `hooks` (say, sound, end), and draw.js reads  */
/* its state to paint the canvas. Kinds:                                       */
/*   flick    Law 1 - slingshot a puck over ice, grass and sand                */
/*   cart     Law 2 - push a loaded cart; race and match are two-lane versions */
/*   skate    Law 3 - throw balls off a skateboard and roll the other way      */
/*   balloon  Law 3 - let a balloon go and ride the air out of it              */
/*   pushoff  Law 3 - two kids push apart; the lighter one rolls further       */
"use strict";
window.NL = window.NL || {};

NL.Scenes = (function () {
  const P = NL.Physics;
  const L = P.TRACK;

  const VMAX = 8.5;          // hardest flick, m/s. Every Law 1 zone is reachable under it.
  const PUSH_TIME = 0.5;     // how long the hand stays on the cart
  const THROW_SPEED = 12;    // every ball leaves the hand at the same speed
  const SKATER_M = 10;
  const BALLOON_A = 6;       // speed-up from the air jet
  const PUFF_TIME = 0.35;    // seconds of air per puff
  const MAX_PUFFS = 4;

  function inZone(x, zone) { return zone && x >= zone[0] && x <= zone[1]; }

  function base(cfg, hooks) {
    return {
      cfg, hooks,
      kind: cfg.kind,
      zone: cfg.zone || null,
      arrows: [],      // short-lived force arrows: { x, lane, dir, size, label, t }
      bits: [],        // decoration that flies about: balls, air puffs
      moving: false,
      over: false,     // the last try has been judged; the next input starts afresh
      time: 0,
      tick(dt) {
        this.time += dt;
        this.arrows.forEach((a) => { a.t -= dt; });
        this.arrows = this.arrows.filter((a) => a.t > 0 || a.hold);
        this.bits.forEach((b) => { b.x += b.vx * dt; b.y += (b.vy || 0) * dt; if (b.g) b.vy += b.g * dt; b.t += dt; });
        this.bits = this.bits.filter((b) => b.t < (b.life || 3) && b.x > -2 && b.x < L + 2);
      },
      arrow(x, lane, dir, size, label, t, color) {
        this.arrows.push({ x, lane, dir, size, label, t: t || 1, color });
      }
    };
  }

  // ── Law 1: flick a puck ────────────────────────────────────────────────────
  function flick(cfg, hooks) {
    const s = base(cfg, hooks);
    s.surface = cfg.sandbox ? cfg.surfaces[0] : null;
    s.strips = cfg.strips || [{ from: 0, to: L, type: s.surface }];
    s.puck = { x: 1, v: 0, r: 0.45 };
    s.aim = null;          // 0..1 while the finger is pulling back
    s.lastPower = null;    // a tick on the power bar, so the next try can be finer
    s.trail = [];
    s.spaceTime = 0;

    s.setSurface = function (type) {
      this.surface = type;
      this.strips = [{ from: 0, to: L, type }];
      this.reset();
    };
    s.reset = function () {
      this.puck.x = 1; this.puck.v = 0; this.moving = false; this.over = false;
      this.trail = []; this.spaceTime = 0;
    };
    s.canAim = function () { return !this.moving; };
    s.setAim = function (p) {
      if (this.moving) return;
      if (this.over || this.puck.x !== 1) this.reset();
      this.aim = Math.max(0, Math.min(1, p));
    };
    s.release = function () {
      const p = this.aim;
      this.aim = null;
      if (p == null || this.moving) return;
      if (p < 0.04) return;                       // a tap, not a flick
      this.lastPower = p;
      this.puck.v = VMAX * p;
      this.moving = true;
      hooks.sound("flick", p);
      hooks.say(cfg.sandbox ? "Whoosh!" : "");
    };
    s.update = function (dt) {
      this.tick(dt);
      if (!this.moving) return;
      const pk = this.puck;
      const type = P.surfaceAt(this.strips, pk.x);
      P.step(pk, P.SURF[type].D, 0, dt);
      this.trail.push(pk.x);
      if (this.trail.length > 24) this.trail.shift();

      if (type === "space") {
        // No wall in space: it wraps round so the kid can watch it go "forever".
        if (pk.x > L + 1) { pk.x = -1; this.trail = []; }
        this.spaceTime += dt;
        if (this.spaceTime > 2.5 && this.spaceTime - dt <= 2.5)
          hooks.say("Nothing out here slows it down. It will keep going forever! Tap Reset to catch it.");
        return;
      }
      if (pk.x + pk.r >= L) {
        pk.x = L - pk.r; pk.v = 0; this.moving = false; this.over = true;
        hooks.sound("bonk");
        if (cfg.sandbox) hooks.say("Bonk! It hit the wall.");
        else hooks.end(false, "Bonk! That was too hard. Try a gentler flick.");
        return;
      }
      if (pk.v === 0) {
        this.moving = false; this.over = true;
        hooks.sound("stop");
        if (cfg.sandbox) {
          const nm = P.SURF[this.surface].label.toLowerCase();
          hooks.say(this.surface === "ice"
            ? "The ice is slippery. Only a little friction, so it slid a long way."
            : "The " + nm + " rubbed on the puck and slowed it down. That rubbing is friction.");
        } else if (inZone(pk.x, this.zone)) hooks.end(true, "Right on the flag!");
        else if (pk.x < this.zone[0]) hooks.end(false, "Not far enough. Pull back a bit more.");
        else hooks.end(false, "Too far! Try a gentler flick.");
      }
    };
    return s;
  }

  // ── Law 2: push a cart (and the two-lane race and match) ───────────────────
  function cart(cfg, hooks) {
    const s = base(cfg, hooks);
    const two = cfg.kind === "race" || cfg.kind === "match";
    s.lanes = two ? 2 : 1;
    s.half = 0.8;                                  // half a cart, for the wall
    s.choice = { push: cfg.push || 3, load: cfg.load || "box" };
    if (cfg.pick && cfg.pick.indexOf("push") >= 0 && !cfg.sandbox) s.choice.push = 0;
    if (cfg.pick && cfg.pick.indexOf("load") >= 0 && !cfg.sandbox) s.choice.load = null;
    s.carts = [];

    s.build = function () {
      const list = [];
      if (cfg.kind === "race") {
        cfg.loads.forEach((ld, i) => list.push({ load: ld, push: cfg.push, lane: i }));
      } else if (cfg.kind === "match") {
        list.push({ load: cfg.other.load, push: cfg.other.push, lane: 0, ghost: true });
        list.push({ load: cfg.load, push: this.choice.push, lane: 1, mine: true });
      } else {
        list.push({ load: this.choice.load || "box", push: this.choice.push, lane: 0, mine: true });
      }
      this.carts = list.map((c) => Object.assign({ x: 1.5, v: 0, pushT: 0, moved: false }, c));
    };
    s.reset = function () { this.build(); this.moving = false; this.over = false; this.guess = null; };
    s.reset();

    s.set = function (what, v) {
      if (this.moving) return;
      this.choice[what] = v;
      this.reset();
    };
    s.ready = function () {
      return this.choice.push > 0 && (this.choice.load || cfg.load || cfg.kind === "race");
    };
    s.go = function (guess) {
      if (this.moving) return;
      this.reset();
      this.guess = guess || null;
      this.carts.forEach((c) => { c.pushT = PUSH_TIME; c.moved = true; });
      this.moving = true;
      hooks.sound("push");
      hooks.say("");
    };
    s.update = function (dt) {
      this.tick(dt);
      if (!this.moving) return;
      let still = true;
      this.carts.forEach((c) => {
        const m = NL.LOADS[c.load].m;
        if (c.pushT > 0) {
          // Friction is left out while the hand is on the cart, so the speed
          // it leaves with is exactly push / weight and the levels come out
          // in whole numbers: 4 times the weight needs 4 times the push.
          P.step(c, 0, P.speedUp(c.push, m), Math.min(dt, c.pushT));
          c.pushT -= dt;
        } else {
          P.step(c, P.SURF.floor.D, 0, dt);
        }
        if (c.x + this.half >= L) {
          c.x = L - this.half; c.v = 0; c.pushT = 0;
          if (!c.bonked) { c.bonked = true; hooks.sound("bonk"); }
        }
        if (c.v !== 0 || c.pushT > 0) still = false;
      });
      if (still) this.finish();
    };
    s.finish = function () {
      this.moving = false; this.over = true;
      hooks.sound("stop");
      const mine = this.carts.find((c) => c.mine);
      const metres = (c) => Math.round(c.x - 1.5);
      if (cfg.sandbox) {
        const ld = NL.LOADS[mine.load];
        hooks.say(mine.bonked
          ? "Crash! " + mine.push + " hands was a lot of push for the " + ld.label.toLowerCase() + "."
          : mine.push + " hands on the " + ld.label.toLowerCase() + " " + ld.emoji + ": it rolled " + metres(mine) + " metres.");
        return;
      }
      if (cfg.kind === "race") {
        if (this.guess === cfg.right) hooks.end(true, "Yes! " + cfg.why);
        else hooks.end(false, "Not quite. " + cfg.why);
        return;
      }
      if (mine.bonked) { hooks.end(false, "Crash! Too much push. Try a smaller one."); return; }
      if (inZone(mine.x, this.zone)) { hooks.end(true, cfg.kind === "match" ? "Side by side! 4 times the weight needed 4 times the push." : "Right on the flag!"); return; }
      const short = mine.x < this.zone[0];
      if (cfg.pick[0] === "load") hooks.end(false, short ? "Too heavy! It didn't get far enough. Try a lighter load." : "Too far!");
      else hooks.end(false, short ? "Not far enough. Try a bigger push." : "Too far! Try a smaller push.");
    };
    return s;
  }

  // ── Law 3: throw balls off a skateboard ────────────────────────────────────
  function skate(cfg, hooks) {
    const s = base(cfg, hooks);
    s.start = 17;
    s.skater = { x: s.start, v: 0, r: 0.7 };
    s.pick = "tennis";

    s.reset = function () {
      this.skater.x = this.start; this.skater.v = 0;
      this.balls = cfg.balls ? cfg.balls.slice() : null;   // null = as many as you like
      this.moving = false; this.over = false; this.thrown = 0;
    };
    s.reset();

    s.left = function (type) { return this.balls ? this.balls.filter((b) => b === type).length : Infinity; };
    s.throwBall = function (type) {
      if (this.over) this.reset();
      if (this.balls) {
        const i = this.balls.indexOf(type);
        if (i < 0) return;
        this.balls.splice(i, 1);
      }
      const b = NL.BALLS[type];
      const kick = P.kickBack(b.m, THROW_SPEED, SKATER_M);
      const sk = this.skater;
      sk.v -= kick;
      this.moving = true;
      this.thrown++;
      this.bits.push({ kind: "ball", ball: type, x: sk.x + 0.6, y: 1.6, vx: THROW_SPEED + sk.v, vy: 3, g: -9, t: 0 });
      // The pair of pushes, drawn the same size: that is the whole of Law 3.
      const size = 0.6 + b.m * 0.5;
      this.arrow(sk.x + 0.9, 0, 1, size, "You push the ball", 1.1, "push");
      this.arrow(() => sk.x - 0.9, 0, -1, size, "Ball pushes you", 1.1, "back");
      hooks.sound("toss");
      hooks.say("");
    };
    s.update = function (dt) {
      this.tick(dt);
      if (!this.moving) return;
      const sk = this.skater;
      P.step(sk, P.SURF.path.D, 0, dt);
      if (sk.x - sk.r <= 0) {
        sk.x = sk.r; sk.v = 0; this.moving = false; this.over = true;
        hooks.sound("bonk");
        if (cfg.sandbox) hooks.say("Bonk! You rolled all the way to the wall.");
        else hooks.end(false, "Bonk! Too far. Try a smaller throw.");
        return;
      }
      if (sk.v !== 0) return;
      this.moving = false;
      hooks.sound("stop");
      if (cfg.sandbox) {
        hooks.say(this.thrown === 1
          ? "You threw the ball right, and it pushed you left!"
          : "Every throw pushes you back a bit more.");
        return;
      }
      if (inZone(sk.x, this.zone)) { this.over = true; hooks.end(true, "Right on the flag!"); return; }
      if (sk.x < this.zone[0]) { this.over = true; hooks.end(false, "Too far! You rolled past the flag."); return; }
      if (this.balls.length) hooks.say("Not there yet. Throw another ball!");
      else { this.over = true; hooks.end(false, "Out of balls, and not far enough. Try again!"); }
    };
    return s;
  }

  // ── Law 3: balloon rocket on a string ──────────────────────────────────────
  function balloon(cfg, hooks) {
    const s = base(cfg, hooks);
    s.b = { x: 1, v: 0 };
    s.reset = function () {
      this.b.x = 1; this.b.v = 0; this.puffs = 0; this.air = 0; this.size = 0;
      this.moving = false; this.over = false;
    };
    s.reset();

    s.blow = function () {
      if (this.moving) return;
      if (this.over) this.reset();
      if (this.puffs >= MAX_PUFFS) { hooks.say("It's full! Let go!"); return; }
      this.puffs++;
      this.size = this.puffs;
      hooks.sound("hiss", 0.25);
      hooks.say(this.puffs + (this.puffs === 1 ? " puff" : " puffs") + " of air.");
    };
    s.letGo = function () {
      if (this.moving || !this.puffs || this.over) return;
      this.air = this.puffs * PUFF_TIME;
      this.moving = true;
      hooks.sound("hiss", this.air);
      hooks.say("");
      const b = this.b;
      this.arrow(() => b.x + 0.9, 0, 1, 1.4, "Air pushes the balloon", this.air + 0.3, "push");
      this.arrow(() => b.x - 1.1, 0, -1, 1.4, "Balloon pushes the air", this.air + 0.3, "back");
    };
    s.update = function (dt) {
      this.tick(dt);
      if (!this.moving) return;
      const b = this.b;
      const push = this.air > 0 ? BALLOON_A : 0;
      if (this.air > 0) {
        this.air -= dt;
        this.size = Math.max(0.3, this.puffs * this.air / (this.puffs * PUFF_TIME) || 0.3);
        if (Math.random() < 0.7) this.bits.push({ kind: "puff", x: b.x - 0.7, y: 1.2 + Math.random() * 0.3, vx: -3 - Math.random() * 3, t: 0, life: 0.6 });
      }
      P.step(b, P.SURF.wire.D, push, dt);
      if (b.x + 0.5 >= L) {
        b.x = L - 0.5; b.v = 0; this.air = 0; this.moving = false; this.over = true;
        hooks.sound("bonk");
        hooks.end(false, "Bonk! Too much air. Try fewer puffs.");
        return;
      }
      if (b.v === 0 && this.air <= 0) {
        this.moving = false; this.over = true; this.size = 0.3;
        hooks.sound("stop");
        if (inZone(b.x, this.zone)) hooks.end(true, "The air shot back, and the balloon shot forward!");
        else if (b.x < this.zone[0]) hooks.end(false, "Not far enough. Blow in more air.");
        else hooks.end(false, "Too far! Try fewer puffs.");
      }
    };
    return s;
  }

  // ── Law 3: two kids push apart ─────────────────────────────────────────────
  function pushoff(cfg, hooks) {
    const s = base(cfg, hooks);
    s.reset = function () {
      this.kids = [
        { who: "big", x: 9, v: 0, m: 20, r: 0.7 },
        { who: "small", x: 10.3, v: 0, m: 10, r: 0.55 }
      ];
      this.moving = false; this.over = false; this.guess = null;
    };
    s.reset();
    s.go = function (guess) {
      if (this.moving) return;
      this.reset();
      this.guess = guess;
      // One shared push of 20: each kid's speed is that push over their own weight.
      this.kids[0].v = -20 / this.kids[0].m;
      this.kids[1].v = 20 / this.kids[1].m;
      this.moving = true;
      const [big, small] = this.kids;
      this.arrow(() => big.x - 0.8, 0, -1, 1.4, "Push", 1.2, "back");
      this.arrow(() => small.x + 0.7, 0, 1, 1.4, "Push", 1.2, "push");
      hooks.sound("push");
      hooks.say("");
    };
    s.update = function (dt) {
      this.tick(dt);
      if (!this.moving) return;
      let still = true;
      this.kids.forEach((k) => {
        P.step(k, P.SURF.path.D, 0, dt);
        if (k.v !== 0) still = false;
      });
      if (!still) return;
      this.moving = false; this.over = true;
      hooks.sound("stop");
      if (this.guess === cfg.right) hooks.end(true, "Yes! " + cfg.why);
      else hooks.end(false, "Not quite. " + cfg.why);
    };
    return s;
  }

  const KINDS = { flick, cart, race: cart, match: cart, skate, balloon, pushoff };

  return {
    create(cfg, hooks) { return KINDS[cfg.kind](cfg, hooks); },
    VMAX, MAX_PUFFS
  };
})();
