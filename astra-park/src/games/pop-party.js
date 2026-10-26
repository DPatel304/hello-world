import { Juice, clamp } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx, music } from '../audio/sound.js';
import { drawHills } from '../ui/backdrop.js';

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
export const GIANT_EVERY = 180;
/* Something that size would pop the instant any hand reached it, before
   anyone had seen it. Instead it takes slaps - separate ones, so a hand
   resting on it counts once - and counts them down on its face. */
export const GIANT_SLAPS = 6;

/* The giant comes round on play time, counted across every round since the
   page was opened, so it stays an event rather than a feature of each round.
   An object so tests can wind it. */
export const giantClock = { played: 0, next: GIANT_EVERY };

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

/* The balloon dog trots across the lower sky; one touch pops it, part by
   part, nose last. */
export const DOG_WORTH = 15;
const DOG_SPEED = 0.1, DOG_REACH = 0.14, DOG_SIZE = 0.17;
const STR_N = 7;

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
    this.banner = null;
    this.j = new Juice();
    this.t = 0; this.spawn = 0; this.wind = 0; this.over = false;
    this.slowT = 0; this.scale = 1;
    this.parade = null; this.dog = null;
    this.events = planEvents(FINALE);
  }

  step(dt, W, H){
    this.t += dt;

    /* Slow motion stretches the world, not the round: balloons, the dog, the
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
      e.done = true;
      if (e.kind === 'parade') this._parade();
      else if (e.kind === 'dog') this._dog();
    }

    /* The sky fills up as the round goes: a couple of balloons to start, so
       the first seconds are about learning to reach, building to a dozen,
       then a storm for the last ten seconds so the end feels like the end. */
    const storm = this.t >= FINALE;
    if (storm && this.t - dt < FINALE) this._announce('BALLOON STORM!', '#fff', 2);
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

    giantClock.played += dt;
    /* Not so late in the round that it would still be rising at the whistle;
       if the moment comes then, it waits for the start of the next one. */
    if (giantClock.played >= giantClock.next && this.t < FINALE - 5){
      giantClock.next = giantClock.played + GIANT_EVERY;
      this.balloons.unshift(this._giant());
      this._announce('GIANT BALLOON!', '#ffe066', 1);
    }

    this.wind = Math.sin(this.t * 0.21) * 0.012 + Math.sin(this.t * 0.07 + 1) * 0.01;
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
      b.by -= b.rise * lift * sdt;
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
    this._stepDog(sdt, W, H);

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
        const dog = this.dog;
        if (dog && dog.popT < 0 && Math.hypot((hand.x - dog.x) * (W / H), hand.y - dog.y) < DOG_REACH){
          this._hitDog(i, W, H);
        }
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
    if (this.banner){ this.banner.age += dt; if (this.banner.age > 1.6) this.banner = null; }
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

  _slap(b, who, W, H){
    b.slaps++; b.wob = 1;
    if (b.slaps >= GIANT_SLAPS) return this._hit(b, who, W, H);
    sfx.boing(b.slaps);
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

    this.combo[who] = this.comboT[who] > 0 ? this.combo[who] + 1 : 1;
    this.comboT[who] = 1.3;
    const c = this.combo[who];
    const mult = c >= 10 ? 3 : c >= 5 ? 2 : 1;
    const pts = b.worth * mult;
    this.score[who] += pts;
    if (c === 5 || c === 10) this._announce(`COMBO x${mult}!`, PLAYER_COLORS[who], mult - 1);

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
    if (b.kind === 'rainbow') this._confetti(px, py, H);
    if (b.giant){
      for (let k = 0; k < 3; k++) this._confetti(px + (k - 1) * r * 0.6, py, H);
      sfx.boom(); this.j.kick(34);
      this.slowT = SLOW_SECS;
      sfx.slowmo(); music.muffle(SLOW_SECS);
      this._announce('SLOW MOTION!', '#9fe3ff', null);
    }
    if (b.str.length) this.fx.push({ k:'string', pts:b.str.map(p => ({ ...p })), age:0, life:0.9 });

    const label = mult > 1 ? `+${pts}  x${mult}` : '+' + pts;
    this.j.pop(px, py, label, PLAYER_COLORS[who]);

    if (b.parade && ++this.parade.popped === this.parade.total){
      this.score[who] += PARADE_BONUS;
      this._announce(`PERFECT PARADE! +${PARADE_BONUS}`, PLAYER_COLORS[who], 3);
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

  /* level is the size of the fanfare; null when the event brings its own
     sound. */
  _announce(text, color, level){
    this.banner = { text, color, age:0 };
    if (level != null) sfx.combo(level);
  }

  _paradeOn(){ return this.balloons.some(b => b.parade); }

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
    this._announce('BALLOON PARADE!', '#fff', null);
    sfx.parade();
  }

  _dog(){
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.dog = { dir, x: dir > 0 ? -0.15 : 1.15, y0: 0.58 + Math.random() * 0.08, y: 0.6,
                 age: 0, hue: HUES[(Math.random() * HUES.length) | 0], popT: -1, popped: 0 };
    this._announce('BALLOON DOG!', '#fff', null);
    sfx.bark();
  }

  _stepDog(sdt, W, H){
    const d = this.dog;
    if (!d) return;
    d.age += sdt;
    if (d.popT < 0){
      d.x += d.dir * DOG_SPEED * sdt;
      d.y = d.y0 - Math.abs(Math.sin(d.age * 4.2)) * 0.06;
      if (d.dir > 0 ? d.x > 1.2 : d.x < -0.2) this.dog = null;
      return;
    }
    /* Popping runs through the parts one after another, tail to nose. */
    d.popT += sdt;
    const parts = dogParts(d, W, H);
    while (d.popped < parts.length && d.popT >= d.popped * 0.08){
      const p = parts[d.popped];
      const mx = (p.a[0] + p.b[0]) / 2, my = (p.a[1] + p.b[1]) / 2;
      this.fx.push({ k:'ring', x:mx, y:my, r:p.w * 0.8, age:0, life:0.3 });
      for (let i = 0; i < 5; i++){
        const a = Math.random() * 6.2832, sp = (160 + Math.random() * 220) * (H / 1080);
        this.fx.push({ k:'shard', x:mx, y:my, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 120,
          rot:a, vr:(Math.random() - 0.5) * 18, s:p.w * 0.35, col:p.far ? dogFar(d) : dogCol(d),
          age:0, life:0.6 });
      }
      sfx.pop(0.2, d.popped);
      d.popped++;
    }
    if (d.popped >= parts.length && d.popT > parts.length * 0.08 + 0.3) this.dog = null;
  }

  _hitDog(who, W, H){
    const d = this.dog;
    d.popT = 0;
    this.score[who] += DOG_WORTH;
    sfx.bark(); this.j.kick(10);
    this.j.pop(d.x * W, d.y * H - H * 0.12, `WOOF! +${DOG_WORTH}`, PLAYER_COLORS[who]);
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
    drawSky(c, W, H, this.t);
    const shook = this.j.applyShake(c);

    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(70,60,110,.55)';
    c.lineWidth = Math.max(1.5, H * 0.0022);
    for (const b of this.balloons) rope(c, b.str);
    for (const b of this.balloons) this._balloon(c, b, W, H);
    if (this.dog) drawDog(c, this.dog, W, H);
    this._drawFx(c, H);
    this.j.draw(c, H);
    if (shook) c.restore();
    this._drawSlow(c, W, H);
    this._drawBanner(c, W, H);
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

    if (b.giant){
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `900 ${Math.round(r * 0.75)}px ui-rounded, system-ui, sans-serif`;
      c.lineWidth = Math.max(6, r * 0.06); c.strokeStyle = 'rgba(30,15,60,.6)';
      const left = String(GIANT_SLAPS - b.slaps);
      c.strokeText(left, x, y - r * 0.1); c.fillStyle = '#fff'; c.fillText(left, x, y - r * 0.1);
      c.textAlign = 'start'; c.textBaseline = 'alphabetic';
    }

    if (b.r < SIZES[1].r[0]){
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

  _drawBanner(c, W, H){
    const b = this.banner;
    if (!b) return;
    /* Overshoots on the way in, then fades: read in a glance, gone before it
       hides a balloon for long. */
    const a = b.age;
    const s = a < 0.25 ? 0.4 + 0.8 * Math.sin((a / 0.25) * 1.9) : 1;
    c.save();
    c.globalAlpha = a > 1.2 ? Math.max(0, 1 - (a - 1.2) / 0.4) : 1;
    c.translate(W / 2, H * 0.36); c.scale(s, s); c.rotate(-0.04);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 ${Math.round(H * 0.11)}px ui-rounded, system-ui, sans-serif`;
    c.lineWidth = Math.max(6, H * 0.016); c.strokeStyle = 'rgba(40,20,80,.85)';
    c.strokeText(b.text, 0, 0);
    c.fillStyle = b.color; c.fillText(b.text, 0, 0);
    c.restore();
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
   cut into windows of
   about a minute; in each, every kind has its own chance of turning up at a
   random moment, at least EVENT_GAP from any other surprise. Over five
   minutes that is a couple of parades and a couple of dogs on average, and
   never the same round twice. */
export const EVENTS = { parade: 0.5, dog: 0.45 };
export const EVENT_GAP = 15;
export function planEvents(finale){
  const from = OPENING + 5, to = finale - 15;
  const n = Math.max(1, Math.round((to - from) / 60)), span = (to - from) / n;
  const out = [];
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

const dogCol = (d) => `hsl(${d.hue} 85% 60%)`;
const dogFar = (d) => `hsl(${d.hue} 72% 46%)`;

/* A twisted-balloon dog as a list of sausages in screen pixels, in drawing
   order: the far legs and ear first, the snout last. That is also the order
   they pop in. Units are fractions of the dog's size, facing right. */
function dogParts(d, W, H){
  const s = DOG_SIZE * H, cx = d.x * W, cy = d.y * H;
  const sw = Math.sin(d.age * 9) * 0.13;
  const tail = -2.2 + Math.sin(d.age * 14) * 0.35;
  const P = (x, y) => [cx + d.dir * x * s, cy + y * s];
  return [
    { a:P(-0.42, -0.02), b:P(-0.42 + Math.cos(tail) * 0.45, -0.02 + Math.sin(tail) * 0.45), w:0.19 * s },
    { a:P(-0.38, 0.04), b:P(-0.38 + sw, 0.5), w:0.21 * s, far:true },
    { a:P(0.34, 0.04),  b:P(0.34 - sw, 0.5),  w:0.21 * s, far:true },
    { a:P(0.5, -0.44),  b:P(0.62, -0.86),     w:0.21 * s, far:true },
    { a:P(-0.42, 0),    b:P(0.38, 0),         w:0.30 * s },
    { a:P(-0.38, 0.04), b:P(-0.38 - sw, 0.5), w:0.21 * s },
    { a:P(0.34, 0.04),  b:P(0.34 + sw, 0.5),  w:0.21 * s },
    { a:P(0.38, 0),     b:P(0.5, -0.44),      w:0.26 * s },
    { a:P(0.5, -0.44),  b:P(0.42, -0.86),     w:0.21 * s },
    { a:P(0.5, -0.44),  b:P(0.92, -0.38),     w:0.26 * s, snout:true, eye:P(0.62, -0.5), nose:P(0.95, -0.38) }
  ];
}

function drawDog(c, d, W, H){
  const parts = dogParts(d, W, H);
  c.lineCap = 'round';
  for (let i = d.popped; i < parts.length; i++){
    const p = parts[i], col = p.far ? dogFar(d) : dogCol(d);
    const [x1, y1] = p.a, [x2, y2] = p.b;
    c.strokeStyle = `hsl(${d.hue} 70% 30%)`; c.lineWidth = p.w + Math.max(3, H * 0.004);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = col; c.lineWidth = p.w;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    /* A streak of shine along the top of each twist. */
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = p.w * 0.2;
    c.beginPath();
    c.moveTo(x1 + (x2 - x1) * 0.2, y1 + (y2 - y1) * 0.2 - p.w * 0.2);
    c.lineTo(x1 + (x2 - x1) * 0.65, y1 + (y2 - y1) * 0.65 - p.w * 0.2);
    c.stroke();
    if (p.snout){
      const s = DOG_SIZE * H;
      c.fillStyle = '#1d1430';
      c.beginPath(); c.arc(p.nose[0], p.nose[1], s * 0.055, 0, 6.2832); c.fill();
      c.beginPath(); c.arc(p.eye[0], p.eye[1], s * 0.045, 0, 6.2832); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(p.eye[0] + s * 0.015, p.eye[1] - s * 0.015, s * 0.015, 0, 6.2832); c.fill();
    }
  }
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

/* ---------- the sky ----------
   The same park as the menu, in daylight: going from the menu into a round
   is going outside to play. Bright and blue so every balloon colour but one
   stands off it, and that one gets its darker rim from the shading. */
const DAY = { hills:['#7fcf86', '#5fbb70', '#48a65d'],
              trunk:'#7a5434', leaf:'#3d9a55', leafLit:'#5cbc6c' };

const CLOUDS = Array.from({ length: 9 }, (_, i) => ({
  seed: (i * 0.618) % 1, y: 0.08 + ((i * 0.37) % 1) * 0.42,
  s: i % 3 === 0 ? 1.4 : (i % 3 === 1 ? 1 : 0.65), speed: i % 3 === 0 ? 0.012 : (i % 3 === 1 ? 0.008 : 0.005)
}));

export function drawSky(c, W, H, t){
  const sky = c.createLinearGradient(0, 0, 0, H * 0.8);
  sky.addColorStop(0,    '#2f9bf5');
  sky.addColorStop(0.55, '#7cc9ff');
  sky.addColorStop(1,    '#d6f1ff');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);

  const sx = W * 0.86, sy = H * 0.16, sr = H * 0.065;
  const glow = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
  glow.addColorStop(0, 'rgba(255,246,190,.75)');
  glow.addColorStop(1, 'rgba(255,246,190,0)');
  c.fillStyle = glow; c.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
  c.save(); c.translate(sx, sy); c.rotate(t * 0.08);
  c.fillStyle = 'rgba(255,248,200,.22)';
  for (let i = 0; i < 12; i++){
    c.rotate(Math.PI / 6);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(sr * 4.2, -sr * 0.35); c.lineTo(sr * 4.2, sr * 0.35); c.closePath(); c.fill();
  }
  c.restore();
  c.fillStyle = '#fff4b8';
  c.beginPath(); c.arc(sx, sy, sr, 0, 6.2832); c.fill();

  /* Back to front, so the near clouds pass over the far ones. */
  for (const cl of [...CLOUDS].sort((a, b) => a.s - b.s)){
    const w = H * 0.22 * cl.s;
    const x = ((cl.seed + t * cl.speed) % 1) * (W + w * 2) - w;
    cloud(c, x, H * cl.y, w, 0.55 + cl.s * 0.3);
  }

  drawHills(c, W, H, DAY);

  /* Flowers on the near hill, seeded so they hold still. */
  for (let i = 0; i < 26; i++){
    const fx = ((i * 2654435761) % 10000) / 10000 * W;
    const fy = H * (0.9 + ((i * 40503) % 1000) / 1000 * 0.08);
    const fr = H * 0.006;
    c.fillStyle = ['#fff', '#ffe066', '#ff8fc7'][i % 3];
    c.beginPath(); c.arc(fx, fy, fr, 0, 6.2832); c.fill();
  }
}

function cloud(c, x, y, w, alpha){
  c.globalAlpha = alpha;
  c.fillStyle = '#fff';
  c.beginPath();
  c.ellipse(x, y, w * 0.5, w * 0.16, 0, 0, 6.2832);
  c.arc(x - w * 0.2, y - w * 0.06, w * 0.17, 0, 6.2832);
  c.arc(x + w * 0.02, y - w * 0.13, w * 0.22, 0, 6.2832);
  c.arc(x + w * 0.24, y - w * 0.04, w * 0.15, 0, 6.2832);
  c.fill();
  c.globalAlpha = 1;
}
