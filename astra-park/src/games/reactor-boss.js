/* Reactor Run's boss: the Warden, the ship's rogue security core, at the
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

   Down to nothing, it bursts in a shower of coins, and the run is won.
   (However it's going, after len seconds it gives up and bursts anyway.) */
import { RUN, P } from './reactor-art.js';
import { sfx } from '../audio/sound.js';
import { Fight, FRONT, FIGHT_MAX } from './reactor-combat.js';

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
    sfx.siren(true);
  }

  get bots(){ return this.fight.bots; }
  get lost(){ return this.fight.lost; }

  step(dt, W, H, jumped = []){
    const g = this.g, f = this.fight;
    this.t += dt; this.banner = Math.max(0, this.banner - dt);
    if (this.done){ this.clearT += dt; f.step(dt, W, H, []); return; }
    f.step(dt, W, H, jumped);
    if (f.lost) return;

    if (this.phase === 'arms') this._arms(dt, W, H);
    else this._spit(dt);
    if (this.phase === 'overload') this._overload(dt, W, H);

    /* The core lurching forward, once there's nothing left to stop it. */
    if (this.phase !== 'arms') this.core.d += (CORE_NEAR - this.core.d) * Math.min(1, dt * 2);
    if (this.phase === 'arms' && this.arms.every(a => a.hp <= 0)){
      this.phase = 'robots'; this.core.wide = CORE_W; this.banner = 1.6;
      g.shake = 1; sfx.boom(); sfx.siren(true);
    }
    if (this.phase === 'robots' && this.core.hp <= this.core.max * OVERLOAD){ this.phase = 'overload'; this.banner = 1.6; sfx.siren(true); }
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
    const b = f._bot((Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5), this.core.d + 0.1);
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
}
