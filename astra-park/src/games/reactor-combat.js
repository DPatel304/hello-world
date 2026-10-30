/* Reactor Run's combat rooms - closer to tower defense than a brawl. What
   wins a fight is mostly decided before it: how much health the crew walk
   in with, and how strong they've grown. In the room itself, standing in
   the right place does the rest.

   The room is full of rustbots: the first wave fills the whole corridor
   ahead, at least WAVE[0] for each player, and a second streams in from
   the far end. They walk up and crowd round the crew, spread out among
   them so nobody's swamped while someone else has none, and every robot
   close enough keeps hitting whoever's nearest - each hit only a nibble,
   but they never stop. There's no wind-up to watch for.

   The crew hit back on their own, every SWING seconds, every robot within
   RANGE of them - wider than a robot's reach, so the front row and the one
   behind. They hit harder standing together: each teammate close by
   (BUDDY) adds TEAM to their hits. Rolling their arms - the wheels on the
   bus - lands an extra hit on all of them with every turn. And while
   robots are still walking up, a hop fires a shot up the corridor at the
   nearest one coming.

   Hug yourself to heal: you step back out of the robots' reach and get
   HUG_HEAL health a second back - but while you're hugging you're not
   hitting anything, and your teammates are holding the line without you.

   Run out of health and you fall asleep where you stand - only ever in a
   fight; corridors and trap rooms leave you at 1 at worst. A teammate
   beside you clapping wakes you - REVIVE_CLAPS claps between everyone,
   though it should just feel like "clap a bunch" - at half health.
   Clearing the room wakes everyone at half health too. But if the whole
   crew is asleep at once, that's the end of the run.

   Each robot drops coins; clearing the room drops more, and the run goes
   on. */
import { RUN, P } from './reactor-art.js';
import { pose } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { ClapWatch, CrankWatch, HugWatch } from '../tracking/gestures.js';

/* A rustbot: its health, its nibble, how often, and how far across (lanes)
   it reaches. */
export const BOT_HP = 20, BOT_HIT = 2, BOT_EVERY = 1.2, BOT_REACH = 0.18;
/* The crew's own hits: how often, how hard, how far across (lanes) and
   how deep (corridor depth) they reach. */
export const SWING = 1.5, SWING_HIT = 6, RANGE = 0.32, RANGE_D = 0.14;
/* Standing together: teammates this close (lanes) each add TEAM to your
   hits (0.5 is half as much again). */
export const BUDDY = 0.32, TEAM = 0.5;
/* The wheels on the bus: an extra hit, this hard, every turn. */
export const CRANK_HIT = 6;
/* Hugging yourself: health back a second, out of reach, not hitting. */
export const HUG_HEAL = 6;
/* A hop while robots are walking up: a shot at the nearest one coming
   (within SHOT_ACROSS lanes of you), this hard. */
export const SHOT_HIT = 12, SHOT_ACROSS = 0.35;
/* The front line, face to face with the crew; the rows behind it; how far
   apart robots keep side by side; how fast they walk up and across. */
export const FRONT = RUN + 0.09, ROW = 0.08, BOT_GAP = 0.16, WALK = 0.14, SIDE = 0.3;
/* Robots in each wave, per player. The first fills the corridor; the
   second comes in from the far end, one every STREAM seconds. */
export const WAVE = [5, 3], STREAM = 0.5;
export const KILL_COINS = 1, CLEAR_COINS = 10;
/* Asleep: claps to wake, how close (lanes) a clapper has to be, and how
   long claps last when they stop. Waking: at this share of health. All
   asleep: the run ends, this long after the last falls asleep. */
export const REVIVE_CLAPS = 10, REVIVE_R = 0.35, CLAP_FADE = 6, WAKE_HP = 0.5, LAST_SLEEP = 1.5;
/* However it's going, a room is over after this long (unless the game
   asks for shorter): whatever robots are left pop, and it counts as
   cleared. */
export const FIGHT_MAX = 120;
/* How many robots in wave w (from 0) for n players. */
export const waveSize = (n, w) => Math.max(1, n) * WAVE[w];

export class Fight {
  constructor(game, len = FIGHT_MAX){
    this.g = game; this.len = len;
    this.t = 0; this.wave = -1; this.bots = []; this.queue = 0; this.streamT = 0;
    this.done = false; this.lost = false; this.clearT = 0; this.allAsleep = 0; this.banner = 0;
    /* Tougher the more there are: a full crew of four meets the full BOT_HP. */
    this.toughness = Math.max(0.5, Math.max(1, game.here.length) / 4);
    this.claps = pose.players.map(() => new ClapWatch());
    this.cranks = pose.players.map(() => new CrankWatch());
    this.hugs = pose.players.map(() => new HugWatch());
    for (const rn of game.crew){ rn.swingT = 0; rn.swing = 0; rn.claps = 0; rn.clapAgo = 0; rn.buddies = 0; rn.healing = false; rn.back = 0; }
    this._wave();
  }

  _bot(x, d){
    const hp = Math.round(BOT_HP * this.toughness);
    return { x, d, hp, max: hp, hitT: Math.random() * BOT_EVERY, target: -1, flash: 0, swing: 0, seed: Math.random() * 6 };
  }

  _wave(){
    this.wave++;
    const n = waveSize(this.g.here.length, this.wave);
    if (this.wave === 0){
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
    sfx.siren(this.wave > 0);
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

    /* Who's hugging - stepped back to heal, out of it for now. */
    for (const i of g.here){
      const rn = g.crew[i];
      rn.healing = !rn.down && this.hugs[i].step(pose.players[i], dt);
      rn.back += ((rn.healing ? 1 : 0) - rn.back) * Math.min(1, dt * 6);
      if (rn.healing && rn.hp < rn.max){
        rn.hp = Math.min(rn.max, rn.hp + HUG_HEAL * dt);
        if (Math.random() < dt * 5){ const p = P(rn.x, RUN, W, H); g.bits.push({ kind: 'heart', x: (p.x + (Math.random() - 0.5) * H * 0.06) / W, y: (p.y - H * 0.2) / H, vy: -0.08, age: 0, life: 0.9 }); }
      }
    }
    const up = this.up, front = up.filter(i => !g.crew[i].healing);
    this._aim(front);
    /* Front first, so those behind queue up behind them. */
    this.bots.sort((a, b) => a.d - b.d);
    for (const b of this.bots) this._walk(b, front, dt, W, H);
    for (const i of front) this._fight(i, dt, W, H, jumped.includes(i));
    this._wake(dt, W, H);
    this.bots = this.bots.filter(b => b.hp > 0);

    if (!this.queue && !this.bots.length){ if (this.wave + 1 < WAVE.length) this._wave(); else this._clear(W, H); }
    else if (this.t > this.len){
      for (const b of this.bots) this._scrap(b, W, H);
      this.bots = []; this.queue = 0; this._clear(W, H);
    }
  }

  /* Who each robot goes for: whoever's nearest - but nobody takes more
     than their share, so they spread out among the crew. */
  _aim(up){
    const count = new Map(up.map(i => [i, 0])), share = Math.ceil(this.bots.length / Math.max(1, up.length));
    const order = this.bots.slice().sort((a, b) => a.d - b.d);
    for (const b of order){
      const byNear = up.slice().sort((i, j) => Math.abs(this.g.crew[i].x - b.x) - Math.abs(this.g.crew[j].x - b.x));
      b.target = byNear.find(i => count.get(i) < share) ?? byNear[0] ?? -1;
      if (b.target >= 0) count.set(b.target, count.get(b.target) + 1);
    }
  }

  /* A robot walks up towards its one, keeping its distance from the rest,
     and once close enough nibbles at whoever's nearest. */
  _walk(b, up, dt, W, H){
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
    if (b.d > FRONT + 0.01 || b.hitT < BOT_EVERY) return;
    let near = -1;
    for (const i of up) if (g.crew[i].safe <= 0 && Math.abs(g.crew[i].x - b.x) < BOT_REACH && (near < 0 || Math.abs(g.crew[i].x - b.x) < Math.abs(g.crew[near].x - b.x))) near = i;
    if (near < 0) return;
    b.hitT = 0; b.swing = 1;
    this._nibble(near, W, H);
  }

  _nibble(i, W, H){
    const rn = this.g.crew[i];
    rn.hp = Math.max(0, rn.hp - BOT_HIT); rn.hit = Math.max(rn.hit, 0.5);
    if (Math.random() < 0.35) sfx.tick();
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
    rn.buddies = this.up.filter(j => j !== i && !g.crew[j].healing && Math.abs(g.crew[j].x - rn.x) < BUDDY).length;
    const power = (rn.power || 1) * (1 + TEAM * rn.buddies);
    const near = this.bots.filter(b => b.hp > 0 && b.d <= FRONT + RANGE_D && Math.abs(b.x - rn.x) < RANGE);
    rn.swingT = (rn.swingT || 0) + dt;
    if (rn.swingT >= SWING && near.length){
      rn.swingT = 0; rn.swing = 1;
      for (const b of near) this._hit(b, SWING_HIT * power, W, H);
    }
    if (this.cranks[i].step(p, dt) && near.length){
      rn.swing = 1;
      for (const b of near) this._hit(b, CRANK_HIT * power, W, H);
    }
    if (hopped){
      let shot = null;
      for (const b of this.bots){
        if (b.hp <= 0 || b.d <= FRONT + 0.03 || Math.abs(b.x - rn.x) > SHOT_ACROSS) continue;
        if (!shot || b.d < shot.d) shot = b;
      }
      if (shot){
        const a = P(rn.x, RUN, W, H), z = P(shot.x, shot.d, W, H);
        g.bits.push({ kind: 'shot', x: a.x / W, y: (a.y - H * 0.12) / H, x2: z.x / W, y2: (z.y - H * 0.08 * z.k) / H, age: 0, life: 0.3 });
        sfx.zap();
        this._hit(shot, SHOT_HIT * power, W, H);
      }
    }
  }

  _hit(b, dmg, W, H){
    const g = this.g, p = P(b.x, b.d, W, H);
    dmg = Math.round(dmg);
    b.hp -= dmg; b.flash = 1;
    sfx.clank();
    g.bits.push({ kind: 'num', x: (p.x + (Math.random() - 0.5) * H * 0.03) / W, y: (p.y - H * 0.2 * p.k) / H, vy: -0.08, age: 0, life: 0.6, text: `${dmg}`, col: '#ffffff', small: true });
    if (b.hp <= 0){ g.coins += KILL_COINS; g.kills++; this._scrap(b, W, H); }
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
    g.coins += CLEAR_COINS;
    sfx.gold();
    for (let k = 0; k < 6; k++) g._sparkle(0.2 + k * 0.12, 0.4, 8, 50);
  }
}
