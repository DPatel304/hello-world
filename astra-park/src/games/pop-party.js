import { Juice, clamp } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx, music } from '../audio/sound.js';
import { Scene } from './pop-party-scene.js';
import { Avatars } from '../ui/avatars.js';
import { ANIMALS, animalParts, animalCol, touches, drawAnimal } from './pop-party-animals.js';

/* Five-minute rounds; the storm is always the last ten seconds. */
export const ROUND = 300;
export const FINALE = ROUND - 10;
/* The opening: one balloon at a time, so the first thing anyone learns is
   simply to reach for it. */
export const OPENING = 30;

/* Pop Party. Balloons rise, hands pop them. The gentlest game in the set and
   the one a two-year-old can play without being told anything - so nothing
   in it punishes: no lives, nothing to avoid, only things to chase. */
export default {
  id:'pop-party', name:'Pop Party', stars:1, accent:'#ff5d9e', secs:ROUND,
  howto:['Touch a balloon to pop it', 'The tinier the balloon, the more it is worth', 'Rainbow balloons are worth five'],
  create(n){ return new PopParty(n); }
};

/* Size classes rather than a continuous range, so a child can learn that the
   little ones are worth chasing. The first is a rare teeny one, a fifth of an
   ordinary balloon. Radius is a fraction of screen height; rise is screen
   heights per second. */
export const SIZES = [
  { w:0.05, r:[0.011, 0.014], rise:[0.13, 0.18], worth:10 },
  { w:0.20, r:[0.034, 0.046], rise:[0.16, 0.23], worth:3 },
  { w:0.45, r:[0.056, 0.076], rise:[0.11, 0.17], worth:1 },
  { w:0.30, r:[0.088, 0.125], rise:[0.07, 0.11], worth:1 }
];

/* Big enough to cover a quarter of a 16:9 screen: this balloon shape has an
   area of 2.46 r², which is a quarter of the screen at r = 0.425 - about 85%
   of the screen height, top to bottom. */
export const GIANT_R = 0.425;
/* Two giants a round, one at a random moment in each window: never in the
   calm opening, and early enough to rise into view well before the storm. */
export const GIANT_WINDOWS = [[75, 140], [175, 250]];
/* Something that size would pop the instant any hand reached it, before
   anyone had seen it. Instead it takes slaps - separate ones, so a hand
   resting on it counts once - each one answered with a wobble and a boing
   a step higher. However many it gets, it cannot pop until the whole
   balloon is on screen, and once it is, it slows to hover there a while. */
export const GIANT_SLAPS = 6;

/* Teeny balloons are tiny to look at but not to catch: a hand that lands
   anywhere near one counts. */
const MIN_REACH = 0.04;

const tri = (x) => { const f = x - Math.floor(x); return f < 0.5 ? f * 4 - 1 : 3 - f * 4; };

/* How a balloon wanders on its way up, as a sideways and vertical offset at a
   given age. The rise itself is applied separately so the difficulty ramp
   speeds every pattern up alike. */
export const MOTIONS = {
  float:  { w:0.32, at:(b, a) => [Math.sin(a * b.f + b.ph) * 0.03, 0] },
  zigzag: { w:0.18, at:(b, a) => [tri(a * b.f * 0.35 + b.ph) * 0.08, 0] },
  loop:   { w:0.16, at:(b, a) => [Math.cos(a * b.f + b.ph) * 0.05, Math.sin(a * b.f + b.ph) * 0.045] },
  /* Surges and hangs: the vertical swing nearly cancels the rise at its
     slowest, which is the moment a toddler catches up with it. */
  bob:    { w:0.16, at:(b, a) => [Math.sin(a * 0.9 + b.ph) * 0.02, Math.sin(a * b.f * 1.3 + b.ph) * 0.05] },
  drift:  { w:0.18, at:(b, a) => [b.dir * a * 0.045 + Math.sin(a * b.f + b.ph) * 0.015, 0] }
};

const HUES = [0, 28, 48, 135, 175, 215, 270, 325];

/* Popping the giant slows the world to this fraction for SLOW_SECS. */
export const SLOW = 0.3, SLOW_SECS = 5;

/* The parade: a line of balloons in rainbow order marching across the sky,
   worth a bonus to whoever pops every one. */
export const PARADE_N = 12, PARADE_BONUS = 20;
const PARADE_SPEED = 0.16, PARADE_GAP = 0.075;

/* A balloon animal walks across the lower sky; one touch pops it, part by
   part, face last. */
export const ANIMAL_WORTH = 15;
const ANIMAL_SOUNDS = { dog: 'bark', giraffe: 'squeak', elephant: 'trumpet' };
const STR_N = 7;
/* The bouquet: everyone gets at least `least` balloons and at most `most`;
   they gather over `gather` seconds, and everyone lifts off at `liftAt`.
   `reach` is how far above the hand the bunch floats. */
export const BOUQUET = { least: 5, most: 40, gather: 2.5, liftAt: 4.1, reach: 0.1 };

function pick(table){
  let r = Math.random() * table.reduce((s, e) => s + e.w, 0);
  for (const e of table){ r -= e.w; if (r <= 0) return e; }
  return table[table.length - 1];
}
const rand = ([a, b]) => a + Math.random() * (b - a);

class PopParty {
  constructor(players){
    this.players = players;
    this.score = [0, 0];
    this.combo = [0, 0];
    this.comboT = [0, 0];
    this.balloons = [];
    this.fx = [];
    this.j = new Juice();
    this.t = 0; this.spawn = 0; this.wind = 0; this.over = false;
    this.slowT = 0; this.scale = 1;
    this.parade = null; this.animal = null;
    this.events = planEvents(FINALE);
    this.scene = new Scene();
    this.avatars = new Avatars();
    /* Every balloon each player pops, by colour: the bouquet they take home. */
    this.popped = [[], []];
    this.out = null;
  }

  step(dt, W, H){
    this.t += dt;

    /* Slow motion stretches the world, not the round: balloons, animals, the
       spawner and the effects run on scaled time while the clock and the
       storm keep real time. Eased in and out so it reads as slowing down
       rather than a jump. */
    if (this.slowT > 0){
      this.slowT = Math.max(0, this.slowT - dt);
      if (!this.slowT) sfx.speedup();
    }
    this.scale += ((this.slowT > 0 ? SLOW : 1) - this.scale) * Math.min(1, dt * 4);
    const sdt = dt * this.scale;
    this.j.step(sdt);

    for (const e of this.events){
      if (e.done || this.t < e.at) continue;
      /* One animal at a time: a second waits for the first to leave. */
      if (ANIMALS[e.kind] && this.animal){
        e.at += 3;
        if (e.at > FINALE - 10) e.done = true;   /* too late now; skip it */
        continue;
      }
      e.done = true;
      if (e.kind === 'parade') this._parade();
      else if (e.kind === 'giant') this.balloons.unshift(this._giant());
      else if (ANIMALS[e.kind]) this._animal(e.kind);
    }

    /* The sky fills up as the round goes: a couple of balloons to start, so
       the first seconds are about learning to reach, building to a dozen,
       then a storm for the last ten seconds so the end feels like the end. */
    const storm = this.t >= FINALE;
    /* No words for anything: the balloon storm starts with confetti
       showering down from the top of the screen. */
    if (storm && this.t - dt < FINALE){
      for (let k = 0; k < 6; k++) this._confetti(W * (0.1 + k * 0.16), H * 0.02, H);
      sfx.combo(2);
    }
    /* A parade wants the sky to itself, near enough. */
    const want = this.parade && this._paradeOn() ? Math.min(this.target(), 4) : this.target();
    const ramp = 1 + Math.min(1, this.t / FINALE) * 0.3 + (storm ? 0.25 : 0);
    const alive = this.balloons.filter(b => !b.giant).length;
    this.spawn -= sdt;
    if (this.spawn <= 0 && alive < want){
      this.spawn = storm ? 0.18 : 0.5;
      if (want >= 7 && alive + 4 <= want + 1 && Math.random() < 0.1) this._bunch();
      else this.balloons.push(this._make());
    }

    this.wind = Math.sin(this.t * 0.21) * 0.012 + Math.sin(this.t * 0.07 + 1) * 0.01;
    this.scene.step(dt, {
      t: this.t, p: this.t / FINALE, storm: storm, wind: this.wind,
      joy: Math.max(0, Math.min(1, (Math.max(...this.combo) - 2) / 6)),
      look: this._look(), rainbow: this._paradeOn()
    });
    const lift = ramp;
    for (const b of this.balloons){
      b.age += sdt;
      if (b.wob) b.wob *= Math.pow(0.03, dt);
      if (b.parade){
        const { dir, idx } = b.parade, wave = b.age * 2.4 - idx * 0.55;
        b.x = b.x0 + dir * PARADE_SPEED * b.age;
        b.y = b.by + Math.sin(wave) * 0.05;
        b.tilt = Math.cos(wave) * 0.12;
        this._string(b, W, H);
        continue;
      }
      b.by -= b.rise * lift * sdt * (b.giant && this._giantUp(b) ? 0.45 : 1);
      b.wx += this.wind * sdt;
      const [ox, oy] = MOTIONS[b.motion].at(b, b.age);
      const nx = clamp(b.x0 + ox + b.wx, 0.04, 0.96);
      const vx = b.x == null ? 0 : (nx - b.x) / Math.max(sdt, 1e-3);
      b.x = nx; b.y = b.by + oy;
      /* Leans into its own sideways motion, eased so it sways rather than
         snaps. */
      b.tilt += (clamp(vx * 2.4, -0.4, 0.4) - b.tilt) * Math.min(1, dt * 5);
      this._string(b, W, H);
      if (b.kind === 'rainbow' && Math.random() < dt * 14) this._spark(b.x * W, b.y * H, b.r * H);
    }

    for (let i = 0; i < 2; i++) this.comboT[i] = Math.max(0, this.comboT[i] - dt);
    this._stepAnimal(sdt, W, H);

    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p.present) continue;
      /* The mouse drives both hands at once; counting both would make every
         touch on the giant a double slap. */
      const hands = pose.mouse.active ? [p.hands.right] : [p.hands.left, p.hands.right];
      for (const hand of hands){
        for (const b of this.balloons){
          if (b.dead) continue;
          const d = Math.hypot((hand.x - b.x) * (W / H), hand.y - b.y);
          if (b.giant){
            const key = hand === p.hands.left ? i * 2 : i * 2 + 1;
            if (d < b.r * 0.85){
              if (!b.inside.has(key)){ b.inside.add(key); this._slap(b, i, W, H); }
            } else b.inside.delete(key);
          } else if (d < Math.max(b.r * 1.15, MIN_REACH)) this._hit(b, i, W, H);
        }
        const an = this.animal;
        if (an && an.popT < 0 && touches(an, hand.x, hand.y, W, H)) this._hitAnimal(i, W, H);
      }
    }

    this.balloons = this.balloons.filter(b => {
      if (b.dead) return false;
      if (b.parade){
        const gone = b.parade.dir > 0 ? b.x > 1.15 : b.x < -0.15;
        if (gone) this.parade.escaped++;
        return !gone;
      }
      return b.y > -0.2 - b.r * 3;
    });
    this._stepFx(sdt, H);
    this.avatars.step(dt, this.players, this.combo.map((c, i) => this.comboT[i] > 0 ? (c >= 10 ? 2 : c >= 5 ? 1 : 0) : 0));
  }

  _make(x0){
    const size = pick(SIZES);
    const motion = pick(Object.entries(MOTIONS).map(([k, m]) => ({ k, w: m.w }))).k;
    const rainbow = Math.random() < 0.08;
    const dir = Math.random() < 0.5 ? -1 : 1;
    /* Drifters start on the side they drift away from, so they cross the
       screen instead of piling into a wall. */
    const x = x0 ?? (motion === 'drift'
      ? (dir > 0 ? 0.08 + Math.random() * 0.32 : 0.6 + Math.random() * 0.32)
      : 0.08 + Math.random() * 0.84);
    return {
      x0: x, x: null, wx: 0, by: 1.15 + Math.random() * 0.05, y: 1.2, tilt: 0,
      r: rand(size.r), rise: rand(size.rise), worth: rainbow ? 5 : size.worth,
      hue: HUES[(Math.random() * HUES.length) | 0],
      motion, dir, f: 1.2 + Math.random() * 1.4, ph: Math.random() * 6.28,
      kind: rainbow ? 'rainbow' : 'normal', age: 0, dead: false, str: []
    };
  }

  target(){
    /* One at a time through the opening - the next waits until the last is
       popped or gone - then a steady climb to a dozen by the storm. */
    if (this.t >= FINALE) return 18;
    if (this.t < OPENING) return 1;
    return 1 + 11 * (this.t - OPENING) / (FINALE - OPENING);
  }

  _giant(){
    const b = this._make(0.5 + (Math.random() - 0.5) * 0.2);
    Object.assign(b, { giant: true, kind: 'normal', r: GIANT_R, rise: 0.075, worth: 25,
                       motion: 'float', f: 0.5, by: 1.05 + GIANT_R,
                       slaps: 0, inside: new Set(), wob: 0 });
    return b;
  }

  /* The whole balloon on screen, bottom edge and all. */
  _giantUp(b){ return b.y != null && b.y + b.r <= 0.98; }

  _slap(b, who, W, H){
    b.slaps++; b.wob = 1;
    if (b.slaps >= GIANT_SLAPS && this._giantUp(b)) return this._hit(b, who, W, H);
    sfx.boing(Math.min(b.slaps, GIANT_SLAPS));
    this.j.kick(6);
    this.fx.push({ k:'ring', x:b.x * W, y:b.y * H, r:b.r * H * 0.5, age:0, life:0.3 });
  }

  /* Every so often a bunch comes up together, close enough to sweep in one
     go - the moment that makes a room cheer. */
  _bunch(){
    const cx = 0.2 + Math.random() * 0.6;
    for (let k = 0; k < 4; k++){
      const b = this._make(cx + (k - 1.5) * 0.05);
      b.motion = 'float'; b.by += k * 0.04; b.rise = 0.13; b.ph = k;
      this.balloons.push(b);
    }
  }

  /* A short verlet rope hanging from the knot. It costs a few multiplies per
     balloon and is most of why they read as balloons rather than circles. */
  _string(b, W, H){
    const r = b.r * H;
    const ax = b.x * W - Math.sin(b.tilt) * r * 1.12;
    const ay = b.y * H + Math.cos(b.tilt) * r * 1.12;
    const seg = r * 0.42, pts = b.str;
    if (!pts.length) for (let i = 0; i < STR_N; i++) pts.push({ x:ax, y:ay + i * seg, px:ax, py:ay + i * seg });
    pts[0].x = pts[0].px = ax; pts[0].y = pts[0].py = ay;
    const g = 600 * (H / 1080) / 3600;
    for (let i = 1; i < pts.length; i++){
      const p = pts[i], vx = (p.x - p.px) * 0.94, vy = (p.y - p.py) * 0.94;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + g;
    }
    for (let k = 0; k < 3; k++){
      for (let i = 1; i < pts.length; i++){
        const a = pts[i - 1], p = pts[i];
        const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - seg) / d;
        if (i === 1){ p.x -= dx * f; p.y -= dy * f; }
        else { a.x += dx * f * 0.5; a.y += dy * f * 0.5; p.x -= dx * f * 0.5; p.y -= dy * f * 0.5; }
      }
    }
  }
  _hit(b, who, W, H){
    b.dead = true;
    const px = b.x * W, py = b.y * H, r = b.r * H;
    const col = b.kind === 'rainbow' ? null : `hsl(${b.hue} 88% 58%)`;

    this.popped[who].push(b.kind === 'rainbow' ? -1 : b.hue);
    this.combo[who] = this.comboT[who] > 0 ? this.combo[who] + 1 : 1;
    this.comboT[who] = 1.3;
    const c = this.combo[who];
    const mult = c >= 10 ? 3 : c >= 5 ? 2 : 1;
    const pts = b.worth * mult;
    this.score[who] += pts;
    if (c === 5 || c === 10){ sfx.combo(mult - 1); this.avatars.burst(who, this.players); }

    /* Bigger balloons pop lower and heavier; the combo walks the pop up the
       scale the music is in, so a streak plays a tune. */
    const size = clamp((b.r - 0.04) / 0.058, 0, 1);
    sfx.pop(size, c - 1);
    if (b.kind === 'rainbow'){ sfx.rainbow(); this.j.kick(12); }
    else if (size > 0.7) this.j.kick(5);

    this.fx.push({ k:'ring', x:px, y:py, r, age:0, life:0.35 });
    const shards = 7 + Math.round(size * 6);
    for (let i = 0; i < shards; i++){
      const a = (i / shards) * 6.2832 + Math.random() * 0.5, s = (180 + Math.random() * 280) * (H / 1080);
      this.fx.push({ k:'shard', x:px + Math.cos(a) * r * 0.5, y:py + Math.sin(a) * r * 0.5,
        vx:Math.cos(a) * s, vy:Math.sin(a) * s - 120, rot:a, vr:(Math.random() - 0.5) * 18,
        s:r * (0.13 + Math.random() * 0.14), col: col || `hsl(${(i * 60) % 360} 90% 60%)`,
        age:0, life:0.5 + Math.random() * 0.3 });
    }
    this.scene.pop(b.x, b.kind === 'rainbow' ? (Math.random() * 360) | 0 : b.hue);
    if (b.kind === 'rainbow') this._confetti(px, py, H);
    if (b.giant){
      for (let k = 0; k < 3; k++) this._confetti(px + (k - 1) * r * 0.6, py, H);
      for (let k = 0; k < 6; k++) this.scene.pop(b.x + (k - 2.5) * 0.05, HUES[k]);
      sfx.boom(); this.j.kick(34);
      this.slowT = SLOW_SECS;
      sfx.slowmo(); music.dream(SLOW_SECS);
      /* Slow ripples spreading out from where it burst. */
      for (let k = 0; k < 3; k++) this.fx.push({ k:'ripple', x:px, y:py, r:H * 0.05, age:-k * 0.35, life:2.2 });
    }
    if (b.str.length) this.fx.push({ k:'string', pts:b.str.map(p => ({ ...p })), age:0, life:0.9 });

    const label = mult > 1 ? `+${pts}  x${mult}` : '+' + pts;
    this.j.pop(px, py, label, PLAYER_COLORS[who]);

    if (b.parade && ++this.parade.popped === this.parade.total){
      this.score[who] += PARADE_BONUS;
      this.j.pop(px, py - H * 0.08, '+' + PARADE_BONUS, PLAYER_COLORS[who]);
      sfx.combo(3);
    }
  }

  _confetti(x, y, H){
    for (let i = 0; i < 46; i++){
      const a = Math.random() * 6.2832, s = (150 + Math.random() * 520) * (H / 1080);
      this.fx.push({ k:'conf', x, y, vx:Math.cos(a) * s, vy:Math.sin(a) * s - 260,
        rot:Math.random() * 6, vr:(Math.random() - 0.5) * 14, w:H * 0.012, h:H * 0.006,
        col:`hsl(${(Math.random() * 360) | 0} 95% 62%)`, ph:Math.random() * 6, age:0, life:1.6 });
    }
  }

  _spark(x, y, r){
    const a = Math.random() * 6.2832, d = r * (0.9 + Math.random() * 0.6);
    this.fx.push({ k:'spark', x:x + Math.cos(a) * d, y:y + Math.sin(a) * d,
      s:r * (0.12 + Math.random() * 0.12), age:0, life:0.5 });
  }

  /* ---------- the bouquet ----------
     When the round ends, every balloon each player popped floats back and
     gathers into a bouquet in their hand, then everyone lifts off together
     and floats away. Nobody wins: a bigger bunch is just a bigger bunch, and
     everyone gets at least a handful so everyone flies. The shell runs this
     until it returns true, then shows the scores. */
  outro(dt, W, H){
    if (!this.out) this._startOutro();
    const o = this.out;
    o.t += dt; this.t += dt;
    this.scene.step(dt, { t: this.t, p: 1, storm: false, wind: this.wind, joy: 1,
                          look: this._look(), rainbow: true });
    this.j.step(dt); this._stepFx(dt, H); this._stepAnimal(dt, W, H);
    this.avatars.step(dt, this.players);

    /* Whatever was still in the sky drifts off out of the way. */
    for (const b of this.balloons){ b.by -= 0.5 * dt; b.y = b.by; this._string(b, W, H); }
    this.balloons = this.balloons.filter(b => b.y > -0.6);

    const lift = o.t < BOUQUET.liftAt ? 0 : Math.pow(o.t - BOUQUET.liftAt, 1.6) * 0.18;
    if (lift && !o.lifted){ o.lifted = true; sfx.liftoff(); }
    for (const g of o.groups){
      const a = this._anchor(g.who);
      g.ax += (a.x - g.ax) * Math.min(1, dt * 5); g.ay += (a.y - g.ay) * Math.min(1, dt * 5);
      g.lift = lift;
      g.items.forEach((b, k) => {
        if (o.t >= b.arrive && !b.arrived){ b.arrived = true; sfx.gather(k); }
        const u = Math.max(0, Math.min(1, (o.t - b.arrive) / 0.9)), e = 1 - Math.pow(1 - u, 3);
        const tx = g.ax + b.sx + Math.sin(o.t * 1.3 + g.who) * 0.01 * (lift ? 2 : 1);
        const ty = g.ay - BOUQUET.reach - g.R + b.sy - lift;
        b.x = b.fx + (tx - b.fx) * e; b.y = b.fy + (ty - b.fy) * e;
        b.tilt = Math.sin(o.t * 1.6 + k) * 0.08;
      });
    }
    return o.t > BOUQUET.liftAt + 4.5;
  }

  _startOutro(){
    this.out = { t: 0, lifted: false, groups: [] };
    for (let i = 0; i < this.players; i++){
      let hues = this.popped[i].map(h => h < 0 ? (Math.random() * 360) | 0 : h);
      while (hues.length < BOUQUET.least) hues.push(HUES[(Math.random() * HUES.length) | 0]);
      if (hues.length > BOUQUET.most){
        const step = hues.length / BOUQUET.most;
        hues = Array.from({ length: BOUQUET.most }, (_, k) => hues[Math.floor(k * step)]);
      }
      /* Smaller balloons for a bigger bunch, so it still fits on screen;
         laid out on a sunflower spiral, which packs a round bunch evenly. */
      const n = hues.length, r = 0.036 * Math.min(1, Math.sqrt(20 / n)), R = r * 1.2 * Math.sqrt(n);
      const a = this._anchor(i);
      const items = hues.map((hue, k) => {
        const rr = Math.sqrt((k + 0.5) / n) * R, ang = k * 2.39996;
        const b = this._make(0.1 + Math.random() * 0.8);
        Object.assign(b, { hue, kind: 'normal', r, giant: false, wob: 0, bouquet: true,
          sx: Math.cos(ang) * rr * (9 / 16), sy: Math.sin(ang) * rr * 0.9,
          fx: 0.08 + Math.random() * 0.84, fy: 1.1 + Math.random() * 0.1,
          arrive: 0.4 + (k / n) * BOUQUET.gather, arrived: false });
        b.x = b.fx; b.y = b.fy;
        return b;
      });
      this.out.groups.push({ who: i, items, R, ax: a.x, ay: a.y, lift: 0 });
    }
  }

  /* Where a player holds their bouquet: their higher hand, kept low enough
     that the bunch above it stays on screen. */
  _anchor(i){
    const p = pose.players[i], home = this.players > 1 ? (i ? 0.7 : 0.3) : 0.5;
    if (!p || !p.present) return { x: home, y: 0.62 };
    const hands = pose.mouse.active ? [p.hands.right] : [p.hands.left, p.hands.right];
    const h = hands.reduce((a, b) => (b.y < a.y ? b : a));
    return { x: Math.max(0.12, Math.min(0.88, h.x)), y: Math.max(0.45, Math.min(0.8, h.y)) };
  }

  _drawBouquets(c, W, H){
    for (const g of this.out.groups){
      const ax = g.ax * W, ay = (g.ay - g.lift) * H;
      c.strokeStyle = 'rgba(70,60,110,.5)'; c.lineWidth = Math.max(1, H * 0.0016);
      c.beginPath();
      for (const b of g.items){
        if (b.y > 1.05) continue;
        c.moveTo(b.x * W, (b.y + b.r * 1.1) * H); c.lineTo(ax, ay);
      }
      c.stroke();
      for (const b of g.items) this._balloon(c, b, W, H);
      /* The knot the strings are gathered into, in the player's colour. */
      c.fillStyle = PLAYER_COLORS[g.who];
      c.beginPath(); c.arc(ax, ay, Math.max(5, H * 0.012), 0, 6.2832); c.fill();
    }
  }

  _paradeOn(){ return this.balloons.some(b => b.parade); }

  /* Where the players stand, averaged, for the scene's parallax. */
  _look(){
    let sum = 0, n = 0;
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (p.present && p.centre){ sum += p.centre.x; n++; }
    }
    return n ? sum / n : 0.5;
  }

  _parade(){
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.parade = { total: PARADE_N, popped: 0, escaped: 0 };
    for (let i = 0; i < PARADE_N; i++){
      const b = this._make();
      /* Red at the head through to violet at the tail. */
      Object.assign(b, { parade: { dir, idx: i }, kind: 'normal', r: 0.06, worth: 2, rise: 0,
        hue: Math.round(i * 290 / (PARADE_N - 1)),
        x0: dir > 0 ? -0.06 - i * PARADE_GAP : 1.06 + i * PARADE_GAP, by: 0.38 });
      b.x = b.x0; b.y = b.by;
      this.balloons.push(b);
    }
    sfx.parade(); music.parade(PARADE_N * PARADE_GAP / PARADE_SPEED + 6);
  }

  _animal(kind){
    const def = ANIMALS[kind], dir = Math.random() < 0.5 ? 1 : -1;
    this.animal = { kind, dir, x: dir > 0 ? -0.2 : 1.2, age: 0, popT: -1, popped: 0,
                    y0: def.y0[0] + Math.random() * (def.y0[1] - def.y0[0]), y: def.y0[0],
                    hue: def.hues[(Math.random() * def.hues.length) | 0] };
    sfx[ANIMAL_SOUNDS[kind]]();
  }

  _stepAnimal(sdt, W, H){
    const an = this.animal;
    if (!an) return;
    const def = ANIMALS[an.kind];
    an.age += sdt;
    if (an.popT < 0){
      an.x += an.dir * def.speed * sdt;
      an.y = an.y0 - def.bob(an.age);
      if (an.dir > 0 ? an.x > 1.25 : an.x < -0.25) this.animal = null;
      return;
    }
    /* Popping runs through the parts one after another, face last. */
    an.popT += sdt;
    const parts = animalParts(an, W, H);
    while (an.popped < parts.length && an.popT >= an.popped * 0.08){
      const p = parts[an.popped];
      const mx = (p.a[0] + p.b[0]) / 2, my = (p.a[1] + p.b[1]) / 2;
      this.fx.push({ k:'ring', x:mx, y:my, r:p.w * 0.8, age:0, life:0.3 });
      for (let i = 0; i < 5; i++){
        const a = Math.random() * 6.2832, sp = (160 + Math.random() * 220) * (H / 1080);
        this.fx.push({ k:'shard', x:mx, y:my, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 120,
          rot:a, vr:(Math.random() - 0.5) * 18, s:p.w * 0.35, col:animalCol(an, p.far),
          age:0, life:0.6 });
      }
      sfx.pop(0.2, an.popped);
      an.popped++;
    }
    if (an.popped >= parts.length && an.popT > parts.length * 0.08 + 0.3) this.animal = null;
  }

  _hitAnimal(who, W, H){
    const an = this.animal;
    an.popT = 0;
    this.score[who] += ANIMAL_WORTH;
    this.popped[who].push(an.hue);
    this.scene.pop(an.x, an.hue);
    sfx[ANIMAL_SOUNDS[an.kind]](); this.j.kick(10);
    this.j.pop(an.x * W, an.y * H - H * 0.12, '+' + ANIMAL_WORTH, PLAYER_COLORS[who]);
  }

  _stepFx(dt, H){
    const g = 1400 * (H / 1080);
    for (const f of this.fx){
      f.age += dt;
      if (f.k === 'shard'){ f.vy += g * dt; f.vx *= 0.985; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; }
      else if (f.k === 'conf'){
        /* Confetti flutters: heavy drag, light gravity, a sideways wobble. */
        f.vx *= Math.pow(0.08, dt); f.vy = f.vy * Math.pow(0.08, dt) + g * 0.18 * dt;
        f.x += (f.vx + Math.sin(f.age * 9 + f.ph) * 40) * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      }
      else if (f.k === 'string'){ for (const p of f.pts){ p.vy = (p.vy || 0) + g * 0.6 * dt; p.y += p.vy * dt; } }
    }
    this.fx = this.fx.filter(f => f.age < f.life);
  }

  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    /* The players stand in the scene behind the balloons, feet in the grass. */
    this.avatars.drawBodies(c, W, H, this.players, this.out ? this.out.groups.map(g => g.lift) : [0, 0]);
    const shook = this.j.applyShake(c);

    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(70,60,110,.55)';
    c.lineWidth = Math.max(1.5, H * 0.0022);
    for (const b of this.balloons) rope(c, b.str);
    for (const b of this.balloons) this._balloon(c, b, W, H);
    if (this.animal) drawAnimal(c, this.animal, W, H);
    /* Grass and flowers stand in front of the balloons, so a new one rises
       from behind the meadow rather than appearing over it. */
    this.scene.drawFront(c, W, H);
    this._drawFx(c, H);
    this.j.draw(c, H);
    if (shook) c.restore();
    this._drawSlow(c, W, H);
    /* At the end the hands are holding bouquets; otherwise they go on top
       of everything, so a child never loses them. */
    if (this.out) this._drawBouquets(c, W, H);
    else this.avatars.drawMitts(c, W, H, this.players);
  }

  _balloon(c, b, W, H){
    const x = b.x * W, y = b.y * H, r = b.r * H;
    /* A slow breath in the rubber, out of step between balloons. */
    const br = 1 + Math.sin(this.t * 2.6 + b.ph) * 0.018 + (b.wob ? Math.sin(this.t * 32) * 0.07 * b.wob : 0);
    c.save(); c.translate(x, y); c.rotate(b.tilt); c.scale(br, 2 - br);

    let fill;
    if (b.kind === 'rainbow'){
      fill = c.createLinearGradient(-r, -r, r, r);
      for (let k = 0; k <= 6; k++) fill.addColorStop(k / 6, `hsl(${(k * 60 + this.t * 120) % 360} 95% 60%)`);
    } else fill = `hsl(${b.hue} 86% 56%)`;

    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(r * 0.12, r * 1.18); c.lineTo(-r * 0.12, r * 1.18); c.lineTo(0, r * 0.96);
    c.closePath(); c.fill();

    balloonPath(c, r); c.fill();
    /* One overlay gives every colour the same volume: a hot spot top-left,
       falling to a darker rim. */
    const sh = c.createRadialGradient(-r * 0.35, -r * 0.45, 0, -r * 0.1, -r * 0.1, r * 1.45);
    sh.addColorStop(0,    'rgba(255,255,255,.55)');
    sh.addColorStop(0.28, 'rgba(255,255,255,0)');
    sh.addColorStop(0.7,  'rgba(0,0,0,0)');
    sh.addColorStop(1,    'rgba(0,0,0,.38)');
    c.fillStyle = sh; balloonPath(c, r); c.fill();

    c.fillStyle = 'rgba(255,255,255,.8)';
    c.beginPath(); c.ellipse(-r * 0.38, -r * 0.42, r * 0.13, r * 0.26, 0.5, 0, 6.2832); c.fill();
    c.beginPath(); c.arc(-r * 0.2, -r * 0.7, r * 0.05, 0, 6.2832); c.fill();
    c.restore();

    if (b.r < SIZES[1].r[0] && !b.bouquet){
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 6 + b.ph);
      c.strokeStyle = `rgba(255,255,255,${0.45 + pulse * 0.4})`;
      c.lineWidth = Math.max(2, H * 0.003);
      c.beginPath(); c.arc(x, y, r * (2.2 + pulse * 0.6), 0, 6.2832); c.stroke();
    }
  }

  _drawFx(c, H){
    for (const f of this.fx){
      const k = f.age / f.life;
      if (f.k === 'ring'){
        c.globalAlpha = 1 - k;
        c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, f.r * 0.18 * (1 - k));
        c.beginPath(); c.arc(f.x, f.y, f.r * (0.9 + k * 1.1), 0, 6.2832); c.stroke();
        if (k < 0.25){ c.fillStyle = '#fff'; c.globalAlpha = (0.25 - k) * 2.4;
          c.beginPath(); c.arc(f.x, f.y, f.r * 0.8, 0, 6.2832); c.fill(); }
      } else if (f.k === 'shard'){
        c.globalAlpha = Math.min(1, (1 - k) * 2);
        c.save(); c.translate(f.x, f.y); c.rotate(f.rot);
        c.fillStyle = f.col;
        c.beginPath(); c.moveTo(-f.s, -f.s * 0.3); c.quadraticCurveTo(0, -f.s * 0.9, f.s, -f.s * 0.2);
        c.lineTo(f.s * 0.4, f.s * 0.5); c.closePath(); c.fill();
        c.restore();
      } else if (f.k === 'conf'){
        c.globalAlpha = Math.min(1, (1 - k) * 3);
        c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.scale(1, Math.cos(f.age * 11 + f.ph));
        c.fillStyle = f.col; c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
        c.restore();
      } else if (f.k === 'spark'){
        c.globalAlpha = 1 - k;
        c.fillStyle = '#fffbe0';
        star(c, f.x, f.y - k * f.s * 3, f.s * (1 - k * 0.5));
      } else if (f.k === 'string'){
        c.globalAlpha = 1 - k;
        c.strokeStyle = 'rgba(70,60,110,.55)'; c.lineWidth = Math.max(1.5, H * 0.0022);
        rope(c, f.pts);
      } else if (f.k === 'ripple' && f.age > 0){
        c.globalAlpha = 0.6 * (1 - k);
        c.strokeStyle = '#bfe8ff'; c.lineWidth = Math.max(3, H * 0.008 * (1 - k));
        c.beginPath(); c.arc(f.x, f.y, f.r + k * H * 0.9, 0, 6.2832); c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  /* A cool vignette, as strong as the slow-down is deep. */
  _drawSlow(c, W, H){
    const k = (1 - this.scale) / (1 - SLOW);
    if (k < 0.02) return;
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, `rgba(120,200,255,${0.1 * k})`);
    g.addColorStop(1, `rgba(50,100,210,${0.62 * k})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  hud(){
    return { score: this.score, showLives: false };
  }

  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++){
      rows.push({ label: `Player ${i + 1}`, value: this.score[i], color: PLAYER_COLORS[i] });
    }
    return rows;
  }
  winner(){
    if (this.players < 2) return null;
    if (this.score[0] === this.score[1]) return -1;
    return this.score[0] > this.score[1] ? 0 : 1;
  }
  value(){ return Math.max(...this.score.slice(0, this.players)); }
}

/* Surprises are planned when the round starts so they never pile up. The
   round from just after the opening to fifteen seconds before the storm is
   cut into windows of about a minute; in each, every kind has its own
   chance of turning up at a random moment, at least EVENT_GAP from any other
   surprise. Over five minutes that is the two giants, a couple of parades and
   three or so balloon animals on average, and never the same round twice. */
export const EVENTS = { parade: 0.5, dog: 0.3, giraffe: 0.25, elephant: 0.25 };
export const EVENT_GAP = 15;
export function planEvents(finale){
  const from = OPENING + 5, to = finale - 15;
  const n = Math.max(1, Math.round((to - from) / 60)), span = (to - from) / n;
  /* The giants are placed first, so the smaller surprises make room. */
  const out = GIANT_WINDOWS.map(([a, b]) => ({ kind: 'giant', at: a + Math.random() * (b - a), done: false }));
  for (let w = 0; w < n; w++){
    for (const [kind, chance] of Object.entries(EVENTS)){
      if (Math.random() >= chance) continue;
      for (let tries = 0; tries < 20; tries++){
        const at = from + (w + Math.random()) * span;
        if (out.every(e => Math.abs(e.at - at) >= EVENT_GAP)){ out.push({ kind, at, done: false }); break; }
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

function balloonPath(c, r){
  c.beginPath();
  c.moveTo(0, -r);
  c.bezierCurveTo(r * 1.1, -r, r * 1.1, r * 0.45, 0, r);
  c.bezierCurveTo(-r * 1.1, r * 0.45, -r * 1.1, -r, 0, -r);
  c.closePath();
}

function rope(c, pts){
  if (pts.length < 2) return;
  c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++){
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const l = pts[pts.length - 1];
  c.lineTo(l.x, l.y); c.stroke();
}

function star(c, x, y, s){
  c.beginPath();
  for (let i = 0; i < 8; i++){
    const a = i * Math.PI / 4, d = i % 2 ? s * 0.32 : s;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath(); c.fill();
}
