/* Reactor Run's combat rooms. The run stops and the room's robots come at
   the crew - rustbots, for now: clanking boxes that shamble up to whoever
   is nearest, stop face to face, and swing.

   The crew fight by standing in front of them: anyone with a robot right
   in front swings at it on their own, every SWING seconds - so a child who
   just stands there still helps. Where to stand is the game: slide over to
   the robot you want, spread out to take one each, or all crowd one to
   finish it fast.

   A robot always warns before it swings: it stops, flashes red and winds
   up for WIND seconds, with a line on the floor to the one it's after, in
   their colour. Slide out of its reach before it lands and it misses.

   Two waves, the second bigger, sized for how many are playing - and the
   robots tougher the more there are. Rooms can down someone, unlike
   corridors: down, they lie where they are until the room's cleared, then
   get up at half health. If everyone's down at once, they all get up
   again at half health and carry on - a fight here is never lost.

   Each robot drops coins; clearing the room drops more, and the run goes
   on. */
import { RUN, P } from './reactor-art.js';
import { sfx } from '../audio/sound.js';

export const BOT_HP = 30, BOT_HIT = 10;
/* A robot's wind-up before it swings, its rest after, and how far across
   (lanes) its swing reaches. */
export const WIND = 0.9, BOT_REST = 1.6, BOT_REACH = 0.3;
/* The crew's own swings: how often, how hard, how far across. */
export const SWING = 2, SWING_HIT = 10, ARM = 0.28;
/* Where the robots stop, face to face with the crew; where they come in;
   how fast they walk up (depth a second) and across (lanes a second). */
export const FACE = RUN + 0.09, SPAWN_AT = 0.9, WALK = 0.16, SIDE = 0.45;
export const WAVES = 2;
export const KILL_COINS = 3, CLEAR_COINS = 10;
/* Getting up: at this share of their health; after everyone's been down
   this long. */
export const RISE_HP = 0.5, RALLY = 1.5;
/* However it's going, a room is over after this long. */
export const FIGHT_MAX = 90;
/* How many robots in wave w (from 0) for n players. */
export const waveSize = (n, w) => Math.max(1, n) + 1 + w;

export class Fight {
  constructor(game){
    this.g = game;
    this.t = 0; this.wave = -1; this.bots = []; this.queue = 0; this.spawnT = 0;
    this.done = false; this.clearT = 0; this.rally = 0; this.banner = 0;
    /* Tougher the more there are: a full crew of four meets the full 30. */
    this.toughness = Math.max(0.5, Math.max(1, game.here.length) / 4);
    for (const i of game.here){ const rn = game.crew[i]; rn.swingT = SWING; rn.swing = 0; }
    this._wave();
  }

  _wave(){
    this.wave++;
    this.queue = waveSize(this.g.here.length, this.wave);
    this.spawnT = this.wave ? 1.2 : 0.6;
    this.banner = 1.6;
    sfx.siren(this.wave > 0);
  }

  step(dt, W, H){
    const g = this.g;
    this.t += dt;
    this.banner = Math.max(0, this.banner - dt);
    for (const b of this.bots){ b.flash = Math.max(0, b.flash - dt * 4); b.swing = Math.max(0, b.swing - dt * 3); }
    for (const i of g.here){ const rn = g.crew[i]; rn.swing = Math.max(0, (rn.swing || 0) - dt * 3); }
    if (this.done){ this.clearT += dt; return; }

    /* In they come, one at a time, across the far end. */
    if (this.queue > 0 && (this.spawnT -= dt) <= 0){
      this.spawnT = 1;
      this.queue--;
      const hp = Math.round(BOT_HP * this.toughness);
      this.bots.push({ x: Math.random() * 1.6 - 0.8, d: SPAWN_AT + Math.random() * 0.1, hp, max: hp,
        wind: 0, rest: 0.4 + Math.random() * 0.6, target: -1, flash: 0, swing: 0, seed: Math.random() * 6 });
    }

    const up = g.here.filter(i => !g.crew[i].down);
    for (const b of this.bots) this._bot(b, up, dt, W, H);
    for (const i of up) this._swing(i, dt, W, H);
    this.bots = this.bots.filter(b => b.hp > 0);

    /* Everyone down: a moment, then all up again. */
    if (g.here.length && !up.length){
      this.rally += dt;
      if (this.rally >= RALLY){ this.rally = 0; for (const i of g.here) this._rise(i, W, H); }
    } else this.rally = 0;

    if (!this.queue && !this.bots.length){ if (this.wave + 1 < WAVES) this._wave(); else this._clear(W, H); }
    else if (this.t > FIGHT_MAX){
      for (const b of this.bots) this._scrap(b, W, H);
      this.bots = []; this.queue = 0; this._clear(W, H);
    }
  }

  /* A robot: up to the nearest of the crew, face to face, and swing. */
  _bot(b, up, dt, W, H){
    const g = this.g;
    if (b.wind > 0){
      b.wind -= dt;
      if (b.wind <= 0){
        b.wind = 0; b.rest = BOT_REST; b.swing = 1;
        const rn = g.crew[b.target];
        if (rn && !rn.down && Math.abs(rn.x - b.x) < BOT_REACH) g._hurt(b.target, BOT_HIT, W, H, true);
        else sfx.whoosh();
      }
      return;
    }
    if (!up.length) return;
    let near = up[0];
    for (const i of up) if (Math.abs(g.crew[i].x - b.x) < Math.abs(g.crew[near].x - b.x)) near = i;
    b.target = near;
    const rn = g.crew[near];
    b.d = Math.max(FACE, b.d - WALK * dt);
    b.x += Math.max(-SIDE * dt, Math.min(SIDE * dt, rn.x - b.x));
    /* Not on top of each other. */
    for (const o of this.bots){
      if (o === b || Math.abs(o.d - b.d) > 0.12) continue;
      const gap = b.x - o.x;
      if (Math.abs(gap) < 0.22) b.x += (gap >= 0 ? 1 : -1) * (0.22 - Math.abs(gap)) * Math.min(1, dt * 4);
    }
    b.x = Math.max(-1, Math.min(1, b.x));
    b.rest -= dt;
    if (b.d <= FACE + 0.001 && b.rest <= 0 && Math.abs(rn.x - b.x) < BOT_REACH * 0.7){ b.wind = WIND; sfx.windup(); }
  }

  /* A crew member swings at the robot in front of them, if there is one. */
  _swing(i, dt, W, H){
    const rn = this.g.crew[i];
    rn.swingT = Math.min(SWING, (rn.swingT ?? SWING) + dt);
    let foe = null;
    for (const b of this.bots){
      if (b.hp <= 0 || b.d > FACE + 0.06 || Math.abs(b.x - rn.x) > ARM) continue;
      if (!foe || Math.abs(b.x - rn.x) < Math.abs(foe.x - rn.x)) foe = b;
    }
    if (!foe || rn.swingT < SWING) return;
    rn.swingT = 0; rn.swing = 1; rn.swingAt = foe.x;
    this._hit(foe, SWING_HIT, W, H);
  }

  _hit(b, dmg, W, H){
    const g = this.g, p = P(b.x, b.d, W, H);
    b.hp -= dmg; b.flash = 1;
    sfx.clank();
    g.bits.push({ kind: 'num', x: p.x / W, y: (p.y - H * 0.2 * p.k) / H, vy: -0.08, age: 0, life: 0.8, text: `${dmg}`, col: '#ffffff' });
    if (b.hp <= 0){ g.coins += KILL_COINS; g.kills++; this._scrap(b, W, H); }
  }

  /* A robot popping into scrap and sparks. */
  _scrap(b, W, H){
    const p = P(b.x, b.d, W, H);
    b.hp = 0;
    this.g._sparkle(p.x / W, (p.y - H * 0.1 * p.k) / H, 18, 25);
    sfx.scrap();
  }

  _rise(i, W, H){
    const rn = this.g.crew[i];
    if (!rn.down) return;
    rn.down = false; rn.hp = Math.max(rn.hp, Math.round(rn.max * RISE_HP)); rn.safe = 1.5;
    const p = P(rn.x, RUN, W, H);
    this.g._sparkle(p.x / W, (p.y - H * 0.12) / H, 10, 140);
  }

  _clear(W, H){
    const g = this.g;
    this.done = true;
    for (const i of g.here) this._rise(i, W, H);
    g.coins += CLEAR_COINS;
    sfx.gold();
    for (let k = 0; k < 6; k++) g._sparkle(0.2 + k * 0.12, 0.4, 8, 50);
  }
}
