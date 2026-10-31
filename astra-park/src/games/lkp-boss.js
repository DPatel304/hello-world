/* Last Known Position's boss: the Warden, the ship's rogue security core, at the
   end of the last corridor. A huge reactor core across the far end of the
   arena, with an arm either side reaching down to the crew.

   It's a fight like the others (a Fight, without the waves, underneath):
   the crew hit whatever's in reach on their own, harder standing
   together, an extra hit every turn of the arms; hugging heals while
   nothing's in reach; asleep, a teammate's claps wake you; everyone
   asleep ends the run. A hop's shot reaches the core from anywhere.

   Three phases:

   The arms. One at a time an arm rises over someone - a red stripe down
   their lane on the floor, TELL seconds' warning - and slams down: anyone
   still under it takes SLAM. Then it lies there DOWN seconds: dodge it,
   then lean back in to hit it while it's down. Break both arms and the
   core lurches forward, into reach of everyone in the middle.

   The robots. The core, up close now, spits out rustbots to crowd and
   nibble, while the crew go at it.

   Overload. Down to its last OVERLOAD of health it glows and lets loose,
   turn about: a shockwave rolling along the floor - jump it - and a
   laser sweeping in at head height - duck under it. Either one missed is
   a BLAST.

   The arena is a ring round a pit, the Warden rising out of the middle,
   and the view holds still behind the crew for each phase. Between
   phases it roars, the floor shakes, and the crew run a quarter of the
   way round the ring - MOVE seconds on their own, quicker the harder
   they run on the spot (up to RUN_BOOST times) - and the view settles
   again, looking at it from another side: each phase its own side.
   Nothing happens on the way round; any robots left go back to it.

   Down to nothing, it bursts in a shower of coins, and the run is won.
   (However it's going, after len seconds it gives up and bursts anyway.) */
import { RUN, P, PIT_NEAR, drawCore, drawArm, drawShockwave, drawSweep, drawArena, SIDES } from './lkp-art.js';
import { sfx } from '../audio/sound.js';
import { Fight, FRONT, FIGHT_MAX } from './lkp-combat.js';
import { pose } from '../tracking/pose.js';
import { MarchWatch } from '../tracking/gestures.js';

/* Health, for a crew of four (fewer, less: as a fight's robots). */
export const ARM_HP = 90, CORE_HP = 360;
/* An arm: warning, then the slam - anyone within SLAM_W (lanes) of where
   it lands takes SLAM - then down for DOWN seconds. A new slam every
   SLAM_EVERY seconds. */
export const TELL = 1.1, SLAM = 15, SLAM_W = 0.28, DOWN = 3, SLAM_EVERY = 2.6;
/* The core: far back to start with; up close once the arms are gone,
   where anyone within CORE_W of the middle reaches it. */
export const CORE_BACK = 0.62, CORE_NEAR = FRONT + 0.03, CORE_W = 0.35;
/* The robots it spits out, one every SPIT seconds, up to SPIT_MAX for
   each player. */
export const SPIT = 1.6, SPIT_MAX = 2;
/* Overload: from this share of the core's health. A shockwave or a sweep
   every BLAST_EVERY seconds, rolling up at ROLL (depth a second); missed,
   BLAST. */
export const OVERLOAD = 0.4, BLAST_EVERY = 2.8, ROLL = 0.55, BLAST = 12;
/* Over a shockwave: this high in a hop (as clearing a breach). Under a
   sweep: ducked this far (as under a bulkhead). */
const HOPPED = 0.15, DUCKED = 0.5;
export const BOSS_COINS = 50;
/* Round the ring between phases: the roar and the shaking first (ROAR
   seconds), then MOVE seconds of running - down to MOVE / RUN_BOOST
   if everyone's running all-out. */
export const ROAR = 0.8, MOVE = 5, RUN_BOOST = 1.7;

export class Warden {
  constructor(game, len = FIGHT_MAX, toughness = 1){
    this.g = game; this.len = len;
    /* The fight underneath never ends by itself: the Warden says when. */
    this.fight = new Fight(game, Infinity, { waves: false });
    const s = this.fight.toughness * toughness;
    this.t = 0; this.phase = 'arms'; this.done = false; this.clearT = 0;
    this.arms = [-1, 1].map(side => ({ side, part: 'arm', x: side * 0.55, d: FRONT, hp: Math.round(ARM_HP * s), max: Math.round(ARM_HP * s),
      state: 'up', t: 0, flash: 0, swing: 0, hitT: 0 }));
    this.core = { part: 'core', x: 0, d: CORE_BACK, wide: 1.2, hp: Math.round(CORE_HP * s), max: Math.round(CORE_HP * s), flash: 0, swing: 0, hitT: 0 };
    this.fight.bots.push(this.core);
    this.next = 1.5; this.which = 0; this.spit = 0;
    this.blasts = []; this.blastT = 1.5; this.blastKind = 0;
    this.banner = 2;
    this.view = 0;                  /* which side of it they're looking at: one a phase */
    this.move = null;               /* running round the ring: { t, along 0..1 } */
    this.marches = pose.players.map(() => new MarchWatch());
    sfx.siren(true);
  }

  /* Where the view is round the ring, in quarter turns. */
  get angle(){ const m = this.move; return this.view + (m ? m.along * m.along * (3 - 2 * m.along) : 0); }

  /* The next phase: first, round the ring to see it from another side. */
  _phase(name){
    const g = this.g, f = this.fight;
    this.phase = name; this.move = { t: 0, along: 0 };
    g.shake = 1; sfx.boom(); sfx.siren(true);
    f.bots = f.bots.filter(b => b.part && b.hp > 0);
    this.blasts = [];
  }

  /* Round the ring, by themselves - quicker for running on the spot. */
  _run(dt){
    const g = this.g, m = this.move;
    m.t += dt;
    const here = g.here, go = here.length ? here.reduce((s, i) => s + this.marches[i].step(pose.players[i], dt, pose.mouse.active), 0) / here.length : 0;
    m.boost = go;
    if (m.t < ROAR) return;
    m.along = Math.min(1, m.along + dt / MOVE * (1 + (RUN_BOOST - 1) * go));
    if (m.along >= 1){ this.move = null; this.view++; this.banner = 1.6; }
  }

  get bots(){ return this.fight.bots; }
  get lost(){ return this.fight.lost; }

  step(dt, W, H, jumped = []){
    const g = this.g, f = this.fight;
    this.t += dt; this.banner = Math.max(0, this.banner - dt);
    if (this.done){ this.clearT += dt; f.step(dt, W, H, []); return; }
    if (this.move){ this._run(dt); return; }
    f.step(dt, W, H, jumped);
    if (f.lost) return;

    if (this.phase === 'arms') this._arms(dt, W, H);
    else this._spit(dt);
    if (this.phase === 'overload') this._overload(dt, W, H);

    /* The core lurching forward, once there's nothing left to stop it. */
    if (this.phase !== 'arms') this.core.d += (CORE_NEAR - this.core.d) * Math.min(1, dt * 2);
    if (this.phase === 'arms' && this.arms.every(a => a.hp <= 0)){
      this._phase('robots'); this.core.wide = CORE_W;
    }
    else if (this.phase === 'robots' && this.core.hp <= this.core.max * OVERLOAD) this._phase('overload');
    if (this.core.hp <= 0 || this.t > this.len) this._win(W, H);
  }

  /* The arms take turns: rise over someone, slam, lie there, rise again. */
  _arms(dt, W, H){
    const g = this.g, f = this.fight;
    for (const a of this.arms){
      a.flash = Math.max(0, a.flash - dt * 4);
      if (a.hp <= 0){
        if (a.state !== 'broken'){ a.state = 'broken'; f.bots = f.bots.filter(b => b !== a); this._burst(a, W, H); }
        continue;
      }
      a.t += dt;
      if (a.state === 'tell' && a.t >= TELL){
        a.state = 'down'; a.t = 0; a.d = FRONT; f.bots.push(a);
        g.shake = Math.min(1, g.shake + 0.6); sfx.thud(); sfx.boom();
        for (const i of f.up) if (Math.abs(g.crew[i].x - a.x) < SLAM_W) f.hurt(i, SLAM, W, H);
      } else if (a.state === 'down' && a.t >= DOWN){
        a.state = 'up'; a.t = 0; f.bots = f.bots.filter(b => b !== a);
      }
    }
    this.next -= dt;
    if (this.next > 0) return;
    this.next = SLAM_EVERY;
    /* The next arm still up rises over someone on its side - or its own
       side, with nobody there. */
    for (let k = 0; k < 2; k++){
      const a = this.arms[(this.which + k) % 2];
      if (a.hp <= 0 || a.state !== 'up') continue;
      this.which = (this.which + k + 1) % 2;
      const on = f.up.filter(i => Math.sign(g.crew[i].x || 0.01) === a.side || Math.abs(g.crew[i].x) < 0.15);
      const who = on[Math.floor(Math.random() * on.length)];
      a.x = who != null ? Math.max(-0.95, Math.min(0.95, g.crew[who].x)) : a.side * 0.55;
      a.state = 'tell'; a.t = 0;
      sfx.windup();
      break;
    }
  }

  /* Up close, it spits out robots. */
  _spit(dt){
    const f = this.fight, n = Math.max(1, this.g.here.length);
    this.spit -= dt;
    if (this.spit > 0 || f.bots.filter(b => !b.part).length >= n * SPIT_MAX) return;
    this.spit = SPIT;
    /* Climbing up out of the pit. */
    const b = f._bot((Math.random() * 2 - 1) * 0.9, PIT_NEAR);
    f.bots.push(b);
  }

  /* Overload: shockwaves to jump, sweeps to duck, turn about. */
  _overload(dt, W, H){
    const g = this.g, f = this.fight;
    this.blastT -= dt;
    if (this.blastT <= 0){
      this.blastT = BLAST_EVERY;
      this.blasts.push({ kind: this.blastKind++ % 2 ? 'sweep' : 'wave', d: this.core.d + 0.05 });
      sfx.windup();
    }
    for (const b of this.blasts){
      const was = b.d;
      b.d -= ROLL * dt;
      if (was >= RUN && b.d < RUN){
        for (const i of f.up){
          const rn = g.crew[i];
          const safe = b.kind === 'wave' ? rn.air >= HOPPED : rn.duck >= DUCKED;
          if (!safe && rn.safe <= 0) f.hurt(i, BLAST, W, H);
        }
      }
    }
    this.blasts = this.blasts.filter(b => b.d > -0.1);
  }

  _burst(part, W, H){
    const p = P(part.x, part.d, W, H);
    for (let k = 0; k < 3; k++) this.g._sparkle(p.x / W, (p.y - H * 0.1 * k) / H, 16, 25);
    this.g.shake = 1; sfx.scrap(); sfx.boom();
  }

  _win(W, H){
    const g = this.g, f = this.fight;
    this.done = true; this.blasts = [];
    for (const b of f.bots) if (!b.part) f._scrap(b, W, H);
    f.bots = [];
    this._burst(this.core, W, H);
    f._clear(W, H);
    g.coins += BOSS_COINS;
    for (let k = 0; k < 12; k++) g._sparkle(Math.random(), 0.2 + Math.random() * 0.4, 6, 50);
    sfx.fanfare();
  }

  /* ---------- what a boss shows (the same for every boss) ---------- */

  /* Its arena, behind everything. */
  arena(c, W, H, t){ drawArena(c, W, H, this.angle, t, SIDES[Math.min(2, this.view)]); }

  /* Its things, among the rest, each { kind: 'boss', rel, draw }. */
  items(list){
    const add = (rel, draw) => list.push({ kind: 'boss', rel, draw });
    if (!this.done) add(this.core.d, (c, W, H, t) => {
      const p = P(0, this.core.d, W, H);
      drawCore(c, p.x, p.y, Math.min(H * 0.34, H * 0.75 * p.k), t, { flash: this.core.flash, glow: this.phase === 'overload' && !this.move ? 1 : 0, side: Math.min(2, this.view), dead: this.done });
    });
    for (const a of this.arms){
      if (a.state === 'broken') continue;
      add(a.state === 'down' ? a.d : this.core.d - 0.02, (c, W, H) => this._drawArm(c, a, W, H));
      if (a.state === 'tell') add(RUN + 0.002, (c, W, H, t) => stripe(c, W, H, t, a.x, SLAM_W));
    }
    for (const b of this.blasts) add(b.d, (c, W, H, t) => (b.kind === 'wave' ? drawShockwave : drawSweep)(c, W, H, b.d, t));
  }

  /* An arm: from the core's shoulder out to its fist - raised high over
     its target as it winds up, flat on the floor once it's slammed. */
  _drawArm(c, a, W, H){
    const core = P(0, this.core.d, W, H);
    const cs = Math.min(H * 0.34, H * 0.75 * core.k), sx = core.x + a.side * cs * 0.7, sy = core.y - cs * 0.55;
    let fx, fy, s;
    if (a.state === 'down'){ const f = P(a.x, a.d, W, H); fx = f.x; fy = f.y; s = H * 0.16 * f.k; }
    else if (a.state === 'tell'){ const f = P(a.x, FRONT + 0.08, W, H), u = Math.min(1, a.t / 0.4); fx = sx + (f.x - sx) * u; fy = sy + (f.y - H * 0.36 * f.k - sy) * u; s = H * 0.16 * f.k * (0.6 + 0.4 * u); }
    else { fx = sx + a.side * cs * 0.3; fy = sy + cs * 0.4; s = cs * 0.25; }
    drawArm(c, sx, sy, fx, fy, s, { flash: a.flash, hp: a.hp / a.max, down: a.state === 'down' });
  }

  /* Its health, big across the top: the core's, and an arm's either side
     while they last. */
  hud(c, W, H){
    healthBar(c, W, H, this.core.hp / this.core.max, this.phase === 'overload');
    const w = W * 0.4, y = H * 0.11, h = H * 0.03;
    for (const a of this.arms){
      if (a.hp <= 0) continue;
      const ax = W / 2 + a.side * (w / 2 + W * 0.05) - W * 0.035, aw = W * 0.07;
      c.fillStyle = 'rgba(5,6,15,.8)'; c.fillRect(ax - 3, y - 3, aw + 6, h + 6);
      c.fillStyle = '#c2410c'; c.fillRect(ax, y, aw * a.hp / a.max, h);
    }
  }

  /* What the ship's computer says about it, as it happens. */
  cues(cap){
    if (this.arms.some(a => a.state === 'tell')) cap.say('Watch the red stripe! Get out from under it!', 'MOVE!', { once: 'slam' });
    if (this.arms.some(a => a.state === 'down')) cap.say('Its arm\'s down! Lean in and hit it!', 'HIT THE ARM', { once: 'arm', polite: true });
    if (this.move && !this.move.told){ this.move.told = true; cap.say('Run! Run round the ring!', 'RUN!'); }
    if (!this.move && this.phase === 'robots') cap.say('It\'s opened up! Get in close and hit the core!', 'HIT THE CORE', { once: 'core' });
    if (!this.move && this.phase === 'overload') cap.say('It\'s overloading! Jump the waves, duck the lasers!', 'JUMP! DUCK!', { once: 'overload' });
  }
}

/* ---------- shared by every boss ---------- */

/* A boss's health bar, big across the top; red when it's at its worst.
   pips: where its phases change (fractions of its health), marked. */
export function healthBar(c, W, H, frac, worst, pips = []){
  const w = W * 0.4, y = H * 0.11, h = H * 0.03;
  c.save();
  c.fillStyle = 'rgba(5,6,15,.8)'; c.fillRect(W / 2 - w / 2 - 4, y - 4, w + 8, h + 8);
  c.fillStyle = worst ? '#ff5b5b' : '#ff8a3d'; c.fillRect(W / 2 - w / 2, y, w * Math.max(0, frac), h);
  c.fillStyle = '#05060f';
  for (const p of pips) c.fillRect(W / 2 - w / 2 + w * p - 2, y - 4, 4, h + 8);
  c.restore();
}

/* Where something's about to land: a red stripe up a lane, half-width w,
   flashing. */
export function stripe(c, W, H, t, x, w){
  const near = RUN - 0.04, far = FRONT + 0.12;
  const pts = [P(x - w, near, W, H), P(x + w, near, W, H), P(x + w, far, W, H), P(x - w, far, W, H)];
  c.save(); c.globalAlpha = 0.25 + 0.25 * Math.abs(Math.sin(t * 12));
  c.fillStyle = '#ff3b3b';
  c.beginPath(); pts.forEach((q, k) => k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.fill();
  c.restore();
}
