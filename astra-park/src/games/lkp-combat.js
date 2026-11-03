/* Last Known Position's combat rooms - closer to tower defense than a brawl. What
   wins a fight is mostly decided before it: how much health the crew walk
   in with, and how strong they've grown. In the room itself, standing in
   the right place does the rest.

   The room is full of rustbots: the first wave fills the whole corridor
   ahead, at least WAVE[0] for each player, and a second streams in from
   the far end. They walk up and crowd round the crew, spread out among
   them so nobody's swamped while someone else has none, and every robot
   close enough keeps hitting whoever's nearest - each hit only a nibble,
   but they never stop. There's no wind-up to watch for.

   The crew hit back on their own, with their weapons (lkp-weapons.js):
   every robot within reach of their melee weapon - wider than a robot's
   reach, so the front row and the one behind - or, with nothing in reach,
   their ranged one at the robots still walking up. They hit harder standing together: each teammate close by
   (BUDDY) adds TEAM to their hits. Rolling their arms - the wheels on the
   bus - lands an extra hit on all of them with every turn. And while
   robots are still walking up, a hop fires a shot up the corridor at the
   nearest one coming.

   There's no healing in a fight: health comes back from the springs in
   the corridors, and the healing water at the end of a treasure room.

   Run out of health and you fall asleep where you stand - only ever in a
   fight; corridors and trap rooms leave you at 1 at worst. A teammate
   beside you clapping wakes you - REVIVE_CLAPS claps between everyone,
   though it should just feel like "clap a bunch" - at half health.
   Clearing the room wakes everyone at half health too. But if the whole
   crew is asleep at once, that's the end of the run.

   Each robot drops crystals; clearing the room drops more, and the run goes
   on.

   The boss fight (lkp-boss.js) runs on a Fight too, without the
   waves: it puts its own robots in, and its own parts - an arm slammed
   down, the core - as `part`s among them: they don't walk or nibble, but
   the crew hit them like anything else in reach (`wide` ones from
   further across), and a hop's shot can reach them. */
import { RUN, P } from './lkp-art.js';
import { pose } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { ClapWatch, CrankWatch } from '../tracking/gestures.js';
import { arms, armored, teamBonus, STANDARD, TEAM } from './lkp-weapons.js';

/* A rustbot: its health, its nibble, how often, and how far across (lanes)
   it reaches. */
export const BOT_HP = 30, BOT_HIT = 4, BOT_EVERY = 1.2, BOT_REACH = 0.18;
/* Each fight in a level is tougher than the last: its robots' health and
   hits, HEAT more for each fight before it. */
export const HEAT = 0.4;
/* A hit bigger than this is a big one: a jolt, and its number shown. */
const BIG = 5;
/* The crew's own hits: how often, how hard, how far across (lanes) and
   how deep (corridor depth) they reach. */
export const SWING = STANDARD.every, SWING_HIT = STANDARD.dmg, RANGE = STANDARD.reach, RANGE_D = 0.14;
/* Standing together: teammates this close (lanes) each add TEAM to your
   hits - more with the TEAMWORK card. */
export const BUDDY = 0.32;
export { TEAM };
/* The wheels on the bus: an extra hit, this hard, every turn. */
export const CRANK_HIT = 6;
/* A hop while robots are walking up: a shot at the nearest one coming
   (within SHOT_ACROSS lanes of you), this hard. */
export const SHOT_HIT = 12, SHOT_ACROSS = 0.35;
/* The front line, face to face with the crew; the rows behind it; how far
   apart robots keep side by side; how fast they walk up and across. */
export const FRONT = RUN + 0.09, ROW = 0.08, BOT_GAP = 0.16, WALK = 0.14, SIDE = 0.3;
/* Robots in each wave, per player. The first fills the corridor; the
   second comes in from the far end, one every STREAM seconds. */
export const WAVE = [4, 3, 4, 5], STREAM = 0.5;
export const KILL_CRYSTALS = 3, CLEAR_CRYSTALS = 25;
/* A knockout's crystals are worth KILL_XP between them, shared out by
   how many are playing (more players, more knockouts). */
export const KILL_XP = 10;
/* Asleep: claps to wake, how close (lanes) a clapper has to be, and how
   long claps last when they stop. Waking: at this share of health. All
   asleep: the run ends, this long after the last falls asleep. */
export const REVIVE_CLAPS = 10, REVIVE_R = 0.35, CLAP_FADE = 6, WAKE_HP = 0.5, LAST_SLEEP = 1.5;
/* However it's going, a room is over after this long (unless the game
   asks for shorter): whatever robots are left pop, and it counts as
   cleared. */
export const FIGHT_MAX = 120;
/* How many robots in wave w (from 0) for n players. */
/* How hard robots and bosses hit, by how many are playing: alone there's
   nobody to clap you awake, so gentler; a full crew can wake each other,
   so harder. */
export const FURY = [0.42, 0.42, 0.8, 1.6, 2.2];
export const crewPower = (n) => Math.max(1, n) * (1 + TEAM * (Math.max(1, n) - 1));
export const waveSize = (n, w, waves = WAVE) => Math.max(1, n) * waves[w];
/* The elite - behind the skull door, always: one big one (its health
   BIG_HP times a robot's, hitting BIG_HIT times as hard, BIG_EVERY
   seconds apart, BIG_SIZE times as big) leading its escorts (ELITE_WAVE,
   per player), and a pile of ELITE_CRYSTALS for beating it. */
export const ELITE_WAVE = [2, 3], BIG_HP = 10, BIG_HIT = 2.5, BIG_EVERY = 2, BIG_SIZE = 1.8, ELITE_CRYSTALS = 35;

export class Fight {
  constructor(game, len = FIGHT_MAX, { waves = true, elite = false } = {}){
    this.g = game; this.len = len; this.waves = waves; this.elite = elite;
    this.waveList = elite ? ELITE_WAVE : WAVE;
    this.t = 0; this.wave = -1; this.bots = []; this.queue = 0; this.streamT = 0;
    this.done = false; this.lost = false; this.clearT = 0; this.allAsleep = 0; this.banner = 0;
    /* Tougher the more there are: a full crew of four meets the full BOT_HP. */
    this.toughness = Math.max(0.5, Math.max(1, game.here.length) / 4);
    /* A boss, alone against the crew, is as tough as the crew is strong
       together: n players, each hitting harder for the others close by
       (crewPower) - a full crew of four meeting its full health. */
    this.might = Math.max(0.15, crewPower(game.here.length) / crewPower(4));
    this.fury = FURY[Math.min(4, game.here.length)];
    /* Hotter with every fight before this one, this level. */
    this.heat = waves ? 1 + HEAT * Math.max(0, (game.rooms || []).filter(r => r === 'combat' || r === 'elite').length - 1) : 1;
    this.claps = pose.players.map(() => new ClapWatch());
    this.cranks = pose.players.map(() => new CrankWatch());
    for (const rn of game.crew){ rn.swingT = 0; rn.swing = 0; rn.claps = 0; rn.clapAgo = 0; rn.buddies = 0; }
    if (waves) this._wave();
  }

  _bot(x, d){
    const hp = Math.round(BOT_HP * this.toughness * this.heat);
    /* What it is - the level's wildlife or its robots - is only how it
       looks: they fight the same. */
    return { kind: this.g.enemy || 'rustbot', x, d, hp, max: hp, hitT: Math.random() * BOT_EVERY, target: -1, flash: 0, swing: 0, seed: Math.random() * 6 };
  }

  _wave(){
    this.wave++;
    const n = waveSize(this.g.here.length, this.wave, this.waveList);
    if (this.wave === 0 && this.elite){
      /* The big one, in the middle; its escorts either side. */
      const big = this._bot(0, 0.55);
      big.hp = big.max = big.hp * BIG_HP; big.big = true; big.size = BIG_SIZE; big.wide = 0.12;
      this.bots.push(big);
      for (let k = 0; k < n; k++) this.bots.push(this._bot((k % 2 ? 1 : -1) * (0.45 + 0.4 * Math.random()), 0.35 + 0.5 * Math.random()));
    } else if (this.wave === 0){
      /* The whole corridor ahead, full of them: rows across, a little
         jumbled. */
      const across = Math.min(7, Math.max(3, Math.ceil(n / 4))), rows = Math.ceil(n / across);
      for (let k = 0; k < n; k++){
        const col = k % across, row = Math.floor(k / across);
        const x = -0.9 + 1.8 * (col + 0.5) / across + (Math.random() - 0.5) * 0.1;
        this.bots.push(this._bot(x, 0.3 + 0.65 * (rows > 1 ? row / (rows - 1) : 0.5) + Math.random() * 0.04));
      }
    } else { this.queue = n; this.streamT = 1; }
    this.banner = 1.6;
    sfx.alert();
  }

  get up(){ return this.g.here.filter(i => !this.g.crew[i].down); }

  /* jumped: who hopped this step. */
  step(dt, W, H, jumped = []){
    const g = this.g;
    this.t += dt;
    this.banner = Math.max(0, this.banner - dt);
    for (const b of this.bots){ b.flash = Math.max(0, b.flash - dt * 4); b.swing = Math.max(0, b.swing - dt * 3); }
    for (const rn of g.crew) rn.swing = Math.max(0, (rn.swing || 0) - dt * 2);
    if (this.done || this.lost){ this.clearT += dt; return; }

    if (this.queue > 0 && (this.streamT -= dt) <= 0){
      this.streamT = STREAM; this.queue--;
      this.bots.push(this._bot(Math.random() * 1.8 - 0.9, 0.95 + Math.random() * 0.08));
    }

    const up = this.up, front = up;
    this._aim(up);
    /* Front first, so those behind queue up behind them. */
    this.bots.sort((a, b) => a.d - b.d);
    for (const b of this.bots) this._walk(b, up, dt, W, H);
    for (const i of front) this._fight(i, dt, W, H, jumped.includes(i));
    this._wake(dt, W, H);
    this.bots = this.bots.filter(b => b.hp > 0);

    if (!this.waves){ if (this.t > this.len) this._clear(W, H); }
    else if (!this.queue && !this.bots.length){ if (this.wave + 1 < this.waveList.length) this._wave(); else this._clear(W, H); }
    else if (this.t > this.len){
      for (const b of this.bots) this._scrap(b, W, H);
      this.bots = []; this.queue = 0; this._clear(W, H);
    }
  }

  /* Who each robot goes for: whoever's nearest - but nobody takes more
     than their share, so they spread out among the crew. */
  _aim(up){
    const count = new Map(up.map(i => [i, 0])), share = Math.ceil(this.bots.length / Math.max(1, up.length));
    const order = this.bots.filter(b => !b.part).sort((a, b) => a.d - b.d);
    for (const b of order){
      const byNear = up.slice().sort((i, j) => Math.abs(this.g.crew[i].x - b.x) - Math.abs(this.g.crew[j].x - b.x));
      b.target = byNear.find(i => count.get(i) < share) ?? byNear[0] ?? -1;
      if (b.target >= 0) count.set(b.target, count.get(b.target) + 1);
    }
  }

  /* A robot walks up towards its one, keeping its distance from the rest,
     and once close enough nibbles at whoever's nearest. */
  _walk(b, up, dt, W, H){
    if (b.part) return;
    const g = this.g, rn = g.crew[b.target];
    /* Stopped by the front line, or by a robot just in front. */
    let stop = FRONT;
    for (const o of this.bots){
      if (o === b || o.hp <= 0 || o.d >= b.d) continue;
      if (Math.abs(o.x - b.x) < BOT_GAP) stop = Math.max(stop, o.d + ROW);
    }
    b.d = Math.max(stop, b.d - WALK * dt);
    if (rn) b.x += Math.max(-SIDE * dt, Math.min(SIDE * dt, rn.x - b.x));
    for (const o of this.bots){
      if (o === b || Math.abs(o.d - b.d) > ROW * 0.9) continue;
      const gap = b.x - o.x;
      if (Math.abs(gap) < BOT_GAP) b.x += (gap >= 0 ? 1 : -1) * (BOT_GAP - Math.abs(gap)) * Math.min(1, dt * 5);
    }
    b.x = Math.max(-1.05, Math.min(1.05, b.x));
    /* Its nibble: whoever's in reach, if it's at the front. */
    b.hitT += dt;
    if (b.d > FRONT + 0.01 || b.hitT < (b.big ? BIG_EVERY : BOT_EVERY)) return;
    let near = -1;
    for (const i of up) if (g.crew[i].safe <= 0 && Math.abs(g.crew[i].x - b.x) < BOT_REACH && (near < 0 || Math.abs(g.crew[i].x - b.x) < Math.abs(g.crew[near].x - b.x))) near = i;
    if (near < 0) return;
    b.hitT = 0; b.swing = 1;
    this._nibble(near, W, H, b);
  }

  _nibble(i, W, H, b){ this.hurt(i, Math.round(BOT_HIT * this.heat * this.fury * (b && b.big ? BIG_HIT : 1)), W, H); }

  /* Damage to a crew member: a nibble's a little flash; a big hit (over
     BIG) a jolt and a number. Out of health, asleep. */
  hurt(i, dmg, W, H){
    const g = this.g, rn = g.crew[i];
    dmg = armored(rn, dmg);
    rn.hp = Math.max(0, rn.hp - dmg); rn.hit = Math.max(rn.hit, dmg > BIG ? 1 : 0.5);
    if (dmg > BIG){
      g.shake = Math.min(1, g.shake + 0.5); sfx.thud(); g.ouch?.();
      const p = P(rn.x, RUN, W, H);
      g.bits.push({ kind: 'num', x: p.x / W, y: (p.y - H * 0.25) / H, vy: -0.08, age: 0, life: 0.9, text: `-${dmg}` });
    } else if (Math.random() < 0.35) sfx.tick();
    if (rn.hp <= 0) this._sleep(i);
  }

  _sleep(i){
    const rn = this.g.crew[i];
    rn.down = true; rn.duck = 0; rn.air = 0; rn.airV = 0; rn.claps = 0; rn.clapAgo = 0;
    sfx.yawn();
  }

  /* A crew member's own hits: every robot in range, every SWING seconds;
     a turn of the arms, an extra hit; a hop, a shot. */
  _fight(i, dt, W, H, hopped){
    const g = this.g, rn = g.crew[i], p = pose.players[i];
    rn.buddies = this.up.filter(j => j !== i && Math.abs(g.crew[j].x - rn.x) < BUDDY).length;
    /* Standing together; their weapons, upgrades and all (lkp-weapons.js). */
    const power = 1 + teamBonus(rn) * rn.buddies, w = arms(rn);
    const near = this._inReach(rn);
    rn.swingT = (rn.swingT || 0) + dt;
    rn.fireT = (rn.fireT || 0) + dt;
    if (near.length){
      /* Melee: everything in reach. */
      if (rn.swingT >= w.melee.every){
        rn.swingT = 0; rn.swing = 1;
        for (const b of near) this._hit(b, w.melee.dmg * power, W, H);
      }
    } else if (w.ranged && rn.fireT >= w.ranged.every){
      /* Ranged, with nothing in reach: the nearest robots still coming. */
      const coming = this.bots.filter(b => b.hp > 0 && b.d > FRONT + 0.03).sort((a, b) => a.d - b.d).slice(0, w.ranged.bolts);
      if (coming.length){
        rn.fireT = 0;
        for (const b of coming){
          this._bolt(rn, b, W, H); this._hit(b, w.ranged.dmg * power, W, H);
          /* WIDER: the bolt bursts, catching robots close by for half. */
          if (w.ranged.splash) for (const o of this.bots) if (o !== b && o.hp > 0 && Math.hypot(o.x - b.x, o.d - b.d) < w.ranged.splash) this._hit(o, w.ranged.dmg * power * 0.5, W, H);
        }
      }
    }
    if (this.cranks[i].step(p, dt) && near.length){
      rn.swing = 1;
      for (const b of near) this._hit(b, CRANK_HIT * power, W, H);
    }
    if (hopped){
      let shot = null;
      for (const b of this.bots){
        if (b.hp <= 0 || b.d <= FRONT + 0.03 || Math.abs(b.x - rn.x) > SHOT_ACROSS + (b.wide || 0)) continue;
        if (!shot || b.d < shot.d) shot = b;
      }
      if (shot){ this._bolt(rn, shot, W, H); this._hit(shot, SHOT_HIT * power, W, H); }
    }
  }

  /* The robots within a crew member's reach - their melee weapon's. */
  _inReach(rn){
    const reach = arms(rn).melee.reach;
    return this.bots.filter(b => b.hp > 0 && b.d <= FRONT + RANGE_D && Math.abs(b.x - rn.x) < reach + (b.wide || 0));
  }

  /* A shot, from a crew member to a robot: a zap across. */
  _bolt(rn, b, W, H){
    const a = P(rn.x, RUN, W, H), z = P(b.x, b.d, W, H);
    this.g.bits.push({ kind: 'shot', x: a.x / W, y: (a.y - H * 0.12) / H, x2: z.x / W, y2: (z.y - H * 0.08 * z.k) / H, age: 0, life: 0.3 });
    sfx.zap();
  }

  _hit(b, dmg, W, H){
    const g = this.g, p = P(b.x, b.d, W, H);
    /* A staggered boss burns: hit harder. */
    dmg = Math.round(dmg * (b.burn || 1));
    b.hp -= dmg; b.flash = 1;
    sfx.clank();
    g.bits.push({ kind: 'num', x: (p.x + (Math.random() - 0.5) * H * 0.03) / W, y: (p.y - H * 0.2 * p.k) / H, vy: -0.08, age: 0, life: 0.6, text: `${dmg}`, col: '#ffffff', small: true });
    if (b.hp <= 0 && !b.part){ g.kills++; g.gain(KILL_CRYSTALS, p.x / W, (p.y - H * 0.12 * p.k) / H, KILL_XP / KILL_CRYSTALS / Math.max(1, g.here.length)); this._scrap(b, W, H); }
  }

  /* A robot popping into scrap and sparks. */
  _scrap(b, W, H){
    const p = P(b.x, b.d, W, H);
    b.hp = 0;
    this.g._sparkle(p.x / W, (p.y - H * 0.1 * p.k) / H, 12, 25);
    sfx.scrap();
  }

  /* Waking the sleepers: claps from anyone awake close by, all counting
     together; they wear off if the clapping stops a while. */
  _wake(dt, W, H){
    const g = this.g, here = g.here, up = this.up;
    const clapped = new Set(up.filter(i => this.claps[i].step(pose.players[i], dt, this.cranks[i])));
    for (const j of here){
      const f = g.crew[j];
      if (!f.down) continue;
      f.clapAgo += dt;
      if (f.clapAgo > CLAP_FADE) f.claps = Math.max(0, f.claps - dt * 0.5);
      for (const i of clapped){
        if (Math.abs(g.crew[i].x - f.x) > REVIVE_R) continue;
        f.claps = Math.floor(f.claps) + 1; f.clapAgo = 0;
        sfx.pop(1 + f.claps * 0.1);
        const p = P(f.x, RUN, W, H);
        g._sparkle(p.x / W, (p.y - H * 0.08) / H, 3, 50);
      }
      if (f.claps >= REVIVE_CLAPS) this._rise(j, W, H);
    }
    /* Everyone asleep: a moment for it to sink in, and the run is over. */
    if (here.length && !up.length){
      this.allAsleep += dt;
      if (this.allAsleep >= LAST_SLEEP && !this.lost){ this.lost = true; g.lost = true; g.over = true; }
    } else this.allAsleep = 0;
  }

  _rise(i, W, H){
    const rn = this.g.crew[i];
    if (!rn.down) return;
    rn.down = false; rn.claps = 0; rn.hp = Math.max(rn.hp, Math.round(rn.max * WAKE_HP)); rn.safe = 1.5;
    const p = P(rn.x, RUN, W, H);
    this.g._sparkle(p.x / W, (p.y - H * 0.12) / H, 14, 140);
    sfx.twinkle();
  }

  _clear(W, H){
    const g = this.g;
    this.done = true;
    for (const i of g.here) this._rise(i, W, H);
    g.gain(CLEAR_CRYSTALS + (this.elite ? ELITE_CRYSTALS : 0), 0.5, 0.45);
    sfx.gold();
    for (let k = 0; k < 6; k++) g._sparkle(0.2 + k * 0.12, 0.4, 8, 50);
  }
}
