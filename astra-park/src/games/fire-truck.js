import { clamp } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Avatars } from '../ui/avatars.js';
import { FaceCam } from '../ui/faces.js';
import { friend } from '../ui/friend.js';
import { WaveWatch, handsFrom } from '../tracking/wave.js';
import { Town, SIDEWALK, ROAD } from './fire-truck-scene.js';
import { TRUCK, drawTruck, ladderTip, drawHelmet, drawPup, drawKid, drawHouse, drawFlame,
         drawBigTree, treeBranch, drawFlower, drawDuck, animal, ANIMALS, ANIMAL_KINDS } from './fire-truck-art.js';

/* Fire Truck. The children ride through town in a big red fire truck, their
   own faces in the cab windows under firefighter helmets. Every so often the
   truck pulls up somewhere it's needed, and everyone helps:

   - a house with a little fire on it: the water cannon sprays wherever your
     hand is, so point at the flames until they're out;
   - a cat (or kitten, bunny, puppy) stuck up the big tree: the ladder reaches
     wherever your hand reaches, so reach up to it, and it climbs down and
     rides along on the truck for the rest of the trip;
   - a garden of drooping flowers: water them back up;
   - a family of ducks crossing the road: wait for them, and wave hello.

   Between stops, put a hand up high and the siren sounds, the lights flash
   and the truck hurries along. Both children do everything together, there
   are no scores on screen, and at the end the truck pulls into the fire
   station with everyone it rescued. Nothing is explained in words: the water
   and the ladder follow your hands from the first moment, and if a job sits
   undone a ghostly hand shows where to reach. */

export const ROUND = 300;
export const FINALE = ROUND - 10;
/* Truck placement and the town's pace, in screen widths. */
export const TRUCK_X = 0.03, TRUCK_LEN = 0.6;
export const STOP_X = 0.8;            /* where a stop stands when the truck pulls up */
export const SPEED = 0.16, SIREN_SPEED = 0.26;
export const FIRST_STOP = 0.9;        /* driving before the first stop */
export const BETWEEN = [1.3, 2.1];    /* driving between stops */
export const LAST_START = ROUND - 25; /* no new stop this close to the end */
/* How close the water or the ladder must come, in screen heights. */
export const HIT = 0.075, REACH = 0.08;
export const HOSE_RATE = 0.8;         /* flame (or thirst) per second, per stream */
export const PATIENCE = 35;           /* a stop nobody can manage finishes itself */
export const HINT_AFTER = 5;
export const CHEER = 2;               /* seconds of celebrating before driving on */
export const KINDS = { fire: 0.4, cat: 0.3, garden: 0.18, ducks: 0.12 };
export const DUCK_TIME = 8;

const HOUSE_W = 0.3, HOUSE_H = 0.24;  /* in screen heights */
/* Where flames can be on a house, relative to its foot: [dx, dy] in screen
   heights. The first is the easy one, by an upstairs window. */
const FLAME_SPOTS = [[0.078, -0.17], [-0.078, -0.17], [-0.06, -0.285], [0.07, -0.29], [0, -0.33], [-0.078, -0.08]];
const PALETTES = [
  { wall: '#f6d7b0', roof: '#c0504d', trim: '#ffffff', door: '#5b7fb5' },
  { wall: '#cfe3f0', roof: '#5b7fb5', trim: '#ffffff', door: '#c0504d' },
  { wall: '#f3c6c6', roof: '#7a5aa8', trim: '#fff8ee', door: '#4f8f5f' },
  { wall: '#d8ecc8', roof: '#4f8f5f', trim: '#ffffff', door: '#d0703c' },
  { wall: '#fbe6a2', roof: '#d0703c', trim: '#ffffff', door: '#7a5aa8' }
];
const TREE_S = 0.6;
const FLOWER_DX = [-0.2, -0.1, 0, 0.1, 0.2];
const PLANTER = 0.06, FLOWER_S = 0.17;   /* the garden's box, and its flowers, in screen heights */

export default {
  id: 'fire-truck', name: 'Fire Truck', stars: 1, accent: '#ff5a4f', secs: ROUND,
  /* Reaching up for the ladder is part of the game, so the pause pose has to
     be held for longer before it counts. */
  pauseHold: 4,
  create(n){ return new FireTruck(n); }
};

const pick = (weights, avoid) => {
  const list = Object.entries(weights).filter(([k]) => k !== avoid);
  let r = Math.random() * list.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of list){ if ((r -= w) <= 0) return k; }
  return list[0][0];
};

class FireTruck {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false;
    this.dist = 0; this.v = SPEED; this.roll = 0;
    this.mode = 'drive';
    this.stop = this._plan('fire', FIRST_STOP, true);
    this.lastKind = 'fire';
    this.helped = 0;
    this.riders = [];
    this.siren = 0; this.sirenOn = false; this.sirenBeat = 0;
    this.ladder = { ang: 0, len: TRUCK.ladder.rest };
    this.aim = -0.3;
    this.streams = [];
    this.bits = [];       /* water drops, steam, confetti, hearts, exhaust */
    this.cheer = 0; this.sprayBeat = 0; this.puffBeat = 0;
    this.town = new Town();
    this.avatars = new Avatars();
    this.faces = new FaceCam();
    this.wave = new WaveWatch();
    /* Neighbours out on the sidewalk, who wave back when you wave. */
    this.folks = []; this.nextFolk = 0.5; this.greeted = 0;
    this.out = null;
  }

  /* ---------- planning ---------- */

  /* A stop of the given kind, centred `ahead` screen widths past where the
     truck will halt for it. */
  _plan(kind, ahead, easy = false){
    const at = this.dist + ahead + STOP_X;
    const s = { kind, at, t: 0, done: false, progress: 0 };
    if (kind === 'fire'){
      const n = easy ? 1 : 2 + Math.floor(Math.random() * 3);
      const spots = easy ? [FLAME_SPOTS[0]] : FLAME_SPOTS.slice().sort(() => Math.random() - 0.5).slice(0, n);
      s.pal = PALETTES[(Math.random() * PALETTES.length) | 0];
      s.flames = spots.map(([dx, dy], i) => ({ dx, dy, hp: 1, seed: i * 1.7 + Math.random() }));
    } else if (kind === 'cat'){
      s.animal = ANIMAL_KINDS[(Math.random() * ANIMAL_KINDS.length) | 0];
      s.state = 'stuck'; s.climb = 0;
    } else if (kind === 'garden'){
      s.flowers = FLOWER_DX.map((dx, i) => ({ dx, dy: -PLANTER - FLOWER_S * 0.85, hp: 0, hue: [340, 45, 280, 20, 200][i], bloomed: false }));
    } else {
      s.ducks = [0, 1, 2, 3].map(k => ({ k, delay: k * 0.45, flap: 0 }));
    }
    return s;
  }

  _next(){
    /* The stop just finished stays where it is, scrolling away behind. */
    this.past = this.stop;
    if (this.t >= LAST_START){ this.stop = null; return; }
    const kind = pick(KINDS, this.lastKind);
    this.lastKind = kind;
    this.stop = this._plan(kind, BETWEEN[0] + Math.random() * (BETWEEN[1] - BETWEEN[0]));
    this._clearFolks(this.stop.at, 0.3);
  }

  /* Neighbours step aside for a job - or the fire station - planned where
     they're standing. */
  _clearFolks(at, r){ this.folks = this.folks.filter(f => Math.abs(f.at - at) >= r); }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    this.t += dt;
    this.faces.step(dt);
    this.avatars.step(dt, this.players);
    const aims = this._aims();

    if (this.mode === 'drive') this._drive(dt, aims, W, H);
    else if (this.mode === 'stop') this._atStop(dt, aims, W, H);
    else if (this.mode === 'cheer'){
      this.cheer += dt;
      this._settleLadder(dt);
      if (this.cheer >= CHEER){ this.mode = 'drive'; sfx.honk(); this._next(); }
    }
    this._stepFolks(dt);
    this._stepBits(dt);
    this.town.step(dt, { t: this.t, p: this.t / ROUND, dist: this.dist, clear: this._clear() });
  }

  /* Every so often someone is out on the sidewalk - a cat, a bunny, a puppy -
     never where the truck has a job to do. Wave as you pass and they wave
     back, with a heart. */
  _stepFolks(dt){
    while (this.nextFolk < this.dist + 1.4){
      const at = this.nextFolk + STOP_X;
      const busy = [this.stop, this.past].some(st => st && Math.abs(st.at - at) < 0.3);
      if (!busy) this.folks.push({ at, kind: ANIMAL_KINDS[(Math.random() * ANIMAL_KINDS.length) | 0], wave: 0 });
      this.nextFolk += 0.6 + Math.random() * 0.6;
    }
    this.folks = this.folks.filter(f => f.at > this.dist - 0.3);
    for (const f of this.folks) f.wave = Math.max(0, f.wave - dt * 0.6);
    /* Only on the road: at a stop, hands are busy aiming water or ladders. */
    if (this.mode === 'stop') return;
    if (!this.wave.step(dt, handsFrom(pose, this.players))) return;
    this.wave.meter = 0; this.wave.turns = 0;
    const seen = this.folks.filter(f => { const x = f.at - this.dist; return x > TRUCK_X + TRUCK_LEN && x < 1; });
    if (!seen.length) return;
    /* Whoever on screen hasn't waved yet gets this one. */
    const f = seen.reduce((a, b) => (b.wave < a.wave ? b : a));
    if (f.wave < 0.4){
      (f.kind === 'puppy' ? sfx.bark : f.kind === 'bunny' ? sfx.twinkle : sfx.meow)();
      this._bit('heart', f.at - this.dist, SIDEWALK - 0.15);
      this.greeted++;
    }
    f.wave = 1;
  }

  /* Each player's pointing hand: whichever is higher. */
  _aims(){
    const out = [];
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p.present) continue;
      const h = pose.mouse.active || p.hands.right.y <= p.hands.left.y ? p.hands.right : p.hands.left;
      out.push({ who: i, x: h.x, y: h.y, high: this._handUp(p) });
    }
    return out;
  }

  /* A hand above the head - the siren. With the mouse, the top of the screen. */
  _handUp(p){
    if (pose.mouse.active) return p.hands.right.y < 0.2;
    if (!p.lm) return false;
    const head = p.lm[0].y - 0.04;
    return p.lm[15].y < head || p.lm[16].y < head;
  }

  _drive(dt, aims, W, H){
    this.streams = [];
    this.sirenOn = this.t >= FINALE || aims.some(a => a.high);
    this.siren += ((this.sirenOn ? 1 : 0) - this.siren) * Math.min(1, dt * 6);
    if (this.sirenOn && (this.sirenBeat -= dt) <= 0){ this.sirenBeat = 0.45; this._hi = !this._hi; sfx.siren(this._hi); }
    let want = this.sirenOn ? SIREN_SPEED : SPEED;
    if (this.stop){
      /* Ease to a halt with the stop at STOP_X. */
      const left = this.stop.at - STOP_X - this.dist;
      want = Math.min(want, Math.sqrt(Math.max(0, left) * 2 * 0.12) + 0.004);
      if (left <= 0.002){ this.dist = this.stop.at - STOP_X; this.v = 0; this.mode = 'stop'; this.sirenOn = false; this.lastProgress = this.t; return; }
    }
    this.v += (want - this.v) * Math.min(1, dt * 2.5);
    this._roll(dt, W);
    this._settleLadder(dt);
    if ((this.puffBeat -= dt) <= 0){ this.puffBeat = 0.22; this._puff(W, H); }
  }

  _roll(dt, W){
    this.dist += this.v * dt;
    const s = TRUCK_LEN * W / TRUCK.length;
    this.roll += (this.v * W * dt) / (TRUCK.wheelR * s);
  }

  _atStop(dt, aims, W, H){
    const st = this.stop;
    st.t += dt;
    this.siren += ((st.kind === 'fire' ? 0.6 : 0) - this.siren) * Math.min(1, dt * 3);
    this.sirenOn = false;
    const late = st.t > PATIENCE;
    const before = st.progress;

    if (st.kind === 'fire' || st.kind === 'garden'){
      this.streams = aims.map(a => ({ who: a.who, x: a.x, y: a.y }));
      const targets = st.kind === 'fire' ? st.flames.filter(f => f.hp > 0) : st.flowers.filter(f => f.hp < 1);
      for (const tg of targets){
        const tp = this._spot(st, tg, W, H);
        const hits = this.streams.filter(s => Math.hypot((s.x - tp.x) * W / H, s.y - tp.y) < HIT).length;
        const rate = hits * HOSE_RATE + (late ? 0.3 : 0);
        if (st.kind === 'fire'){
          tg.hp = Math.max(0, tg.hp - rate * dt);
          if (hits && Math.random() < dt * 20) this._bit('steam', tp.x, tp.y - 0.02);
          if (tg.hp === 0){ sfx.sizzle(); for (let k = 0; k < 10; k++) this._bit('steam', tp.x, tp.y); }
        } else {
          tg.hp = Math.min(1, tg.hp + rate * dt * 0.9);
          if (tg.hp === 1 && !tg.bloomed){ tg.bloomed = true; sfx.bloom(st.flowers.filter(f => f.bloomed).length); for (let k = 0; k < 8; k++) this._bit('spark', tp.x, tp.y); }
        }
      }
      st.progress = st.kind === 'fire'
        ? st.flames.reduce((s, f) => s + (1 - f.hp), 0) / st.flames.length
        : st.flowers.reduce((s, f) => s + f.hp, 0) / st.flowers.length;
      if (this.streams.length && (this.sprayBeat -= dt) <= 0){ this.sprayBeat = 0.18; sfx.spray(); }
      this._aimCannon(dt, W, H);
      this._settleLadder(dt);
      if (st.progress >= 1) this._finish(W, H);
    } else if (st.kind === 'cat'){
      this.streams = [];
      this._reach(dt, aims, W, H, late);
      if (st.state === 'stuck'){
        const tip = this._toScreen(ladderTip(this.ladder), W, H), cat = this._cat(st, W, H);
        if (Math.hypot((tip.x - cat.x) * W / H, tip.y - cat.y) < REACH || late){ st.state = 'climbing'; sfx.meow(); }
        st.progress = 0;
      } else if (st.state === 'climbing'){
        st.climb = Math.min(1, st.climb + dt / 1.6);
        st.progress = st.climb;
        if (st.climb >= 1){ st.state = 'riding'; this.riders.push({ kind: st.animal, hop: 1 }); this._finish(W, H); }
      }
    } else {
      this.streams = [];
      this._settleLadder(dt);
      /* Waving hello makes the ducks quack and flap back - every time, so
         the wave's meter is emptied after each turn rather than filling. */
      const said = this.wave.step(dt, handsFrom(pose, this.players));
      this.wave.meter = 0; this.wave.turns = 0;
      if (said){ sfx.quack(); for (const d of st.ducks) d.flap = 1; const m = this._duck(st, st.ducks[0], W, H); this._bit('heart', m.x, m.y - 0.08); }
      for (const d of st.ducks) d.flap = Math.max(0, d.flap - dt * 2);
      st.progress = Math.min(1, st.t / DUCK_TIME);
      if (st.t >= DUCK_TIME) this._finish(W, H, true);
    }
    if (st.progress > before + 1e-6) this.lastProgress = this.t;
  }

  _finish(W, H, quiet = false){
    const st = this.stop;
    st.done = true; st.doneAt = this.t;
    this.helped++;
    this.mode = 'cheer'; this.cheer = 0; this.streams = [];
    if (quiet) return;
    sfx.hooray();
    const x = st.at - this.dist;
    for (let k = 0; k < 40; k++) this._bit('confetti', x + (Math.random() - 0.5) * 0.15, 0.45 + Math.random() * 0.2);
  }

  /* The ladder follows the highest hand anyone has up. */
  _reach(dt, aims, W, H, late){
    const st = this.stop, piv = this._toScreen(TRUCK.ladder, W, H);
    const s = TRUCK_LEN * W / TRUCK.length;
    let target = null;
    if (st.state === 'stuck'){
      if (late) target = this._cat(st, W, H);
      else if (aims.length) target = aims.reduce((a, b) => (b.y < a.y ? b : a));
      /* A hand down low isn't reaching for anything: the ladder waits. */
      if (target && target.y > piv.y - 0.05) target = null;
    }
    if (!target){ this._settleLadder(dt); return; }
    const dx = (target.x - piv.x) * W, dy = (target.y - piv.y) * H;
    this._ladderTo(dt, clamp(Math.atan2(dy, dx), -1.4, -0.02), clamp(Math.hypot(dx, dy) / s, TRUCK.ladder.rest, TRUCK.ladder.reach));
  }

  _ladderTo(dt, ang, len){
    const k = Math.min(1, dt * 5);
    this.ladder.ang += (ang - this.ladder.ang) * k;
    this.ladder.len += (len - this.ladder.len) * k;
  }
  _settleLadder(dt){ this._ladderTo(dt * 0.6, 0, TRUCK.ladder.rest); }

  _aimCannon(dt, W, H){
    if (!this.streams.length) return;
    const n = this._toScreen(TRUCK.cannon, W, H);
    const mx = this.streams.reduce((s, a) => s + a.x, 0) / this.streams.length, my = this.streams.reduce((s, a) => s + a.y, 0) / this.streams.length;
    const want = clamp(Math.atan2((my - n.y) * H - (mx - n.x) * W * 0.4, (mx - n.x) * W), -1.3, 0.2);
    this.aim += (want - this.aim) * Math.min(1, dt * 6);
  }

  /* ---------- where things are, in screen fractions ---------- */

  _toScreen(u, W, H){
    const s = TRUCK_LEN * W / TRUCK.length;
    return { x: (TRUCK_X * W + u.x * s) / W, y: (ROAD * H + u.y * s) / H };
  }
  _stopX(st){ return st.at - this.dist; }
  _spot(st, tg, W, H){ return { x: this._stopX(st) + tg.dx * H / W, y: SIDEWALK + (tg.dy ?? -0.09) }; }
  _cat(st, W, H){
    const x = this._stopX(st) * W, b = treeBranch(x, SIDEWALK * H, TREE_S * H);
    if (st.state === 'stuck') return { x: b.x / W, y: (b.y - H * 0.005) / H };
    const tip = this._toScreen(ladderTip(this.ladder), W, H), base = this._toScreen(TRUCK.ladder, W, H);
    const u = 1 - (st.climb || 0);
    return { x: base.x + (tip.x - base.x) * u, y: base.y + (tip.y - base.y) * u - 0.015 };
  }
  _duck(st, d, W, H){
    const u = clamp((st.t - d.delay) / (DUCK_TIME - 2), 0, 1);
    return { x: this._stopX(st) - 0.06 + d.k * 0.025 - u * 0.02, y: SIDEWALK + 0.02 + u * 0.22 };
  }
  _clear(){
    const out = [];
    if (this.stop) out.push([this.stop.at - 0.15, this.stop.at + 0.15]);
    if (this.past) out.push([this.past.at - 0.15, this.past.at + 0.15]);
    if (this.out) out.push([this.out.at - 0.2, this.out.at + 0.2]);
    for (const f of this.folks) out.push([f.at - 0.05, f.at + 0.05]);
    return out;
  }

  /* ---------- little bits ---------- */

  _bit(kind, x, y){
    const b = { kind, x, y, age: 0, vx: 0, vy: 0, life: 1, hue: (Math.random() * 360) | 0, r: Math.random() };
    if (kind === 'steam'){ b.vx = (Math.random() - 0.5) * 0.03; b.vy = -0.06 - Math.random() * 0.05; b.life = 1.2; }
    else if (kind === 'spark'){ const a = Math.random() * 6.28; b.vx = Math.cos(a) * 0.06; b.vy = Math.sin(a) * 0.1 - 0.05; b.life = 0.8; }
    else if (kind === 'confetti'){ b.vx = (Math.random() - 0.5) * 0.12; b.vy = -0.25 - Math.random() * 0.25; b.life = 2.2; }
    else if (kind === 'heart'){ b.vy = -0.08; b.life = 1.4; }
    else if (kind === 'puff'){ b.vx = -0.05 - Math.random() * 0.03; b.vy = -0.06; b.life = 1.4; }
    else if (kind === 'drop'){ b.vx = (Math.random() - 0.5) * 0.08; b.vy = -0.08 - Math.random() * 0.1; b.life = 0.5; }
    this.bits.push(b);
    if (this.bits.length > 400) this.bits.shift();
  }

  _puff(W, H){ const p = this._toScreen(TRUCK.stack, W, H); this._bit('puff', p.x, p.y); }

  _stepBits(dt){
    for (const b of this.bits){
      b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.kind === 'confetti' || b.kind === 'drop') b.vy += 0.5 * dt;
      /* Smoke and hearts stay with the street, so they slide past as the truck drives. */
      if (b.kind === 'puff' || b.kind === 'heart') b.x -= this.v * dt;
    }
    this.bits = this.bits.filter(b => b.age < b.life);
    for (const s of this.streams) if (Math.random() < dt * 30) this._bit('drop', s.x, s.y);
  }

  /* ---------- the ending: back to the fire station ---------- */

  outro(dt, W, H){
    if (!this.out){
      this.out = { t: 0, at: this.dist + 1.1 + STOP_X, parked: false };
      this._clearFolks(this.out.at, 0.35);
      this.past = this.stop; this.stop = null; this.streams = [];
      this.mode = 'home';
    }
    const o = this.out;
    o.t += dt; this.t += dt;
    const left = o.at - STOP_X - 0.12 - this.dist;
    if (!o.parked){
      this.v += (Math.min(SPEED * 1.4, Math.sqrt(Math.max(0, left) * 0.3) + 0.004) - this.v) * Math.min(1, dt * 3);
      this._roll(dt, W);
      if (left <= 0.003){ o.parked = true; o.parkedAt = o.t; this.v = 0; sfx.honk(); sfx.hooray(); }
    } else {
      if (Math.random() < dt * 30) this._bit('confetti', 0.5 + (Math.random() - 0.5) * 0.9, 0.3 + Math.random() * 0.3);
    }
    this.siren += (1 - this.siren) * Math.min(1, dt * 4);
    this._settleLadder(dt);
    this.faces.step(dt); this.avatars.step(dt, this.players);
    this._stepBits(dt);
    this.town.step(dt, { t: this.t, p: Math.min(1, this.t / ROUND), dist: this.dist, clear: this._clear() });
    return o.parked && o.t - o.parkedAt > 4;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    this.town.drawBack(c, W, H);
    for (const f of this.folks) this._drawFolk(c, f, W, H);
    for (const st of [this.past, this.stop]) if (st) this._drawStop(c, st, W, H);
    if (this.out) this._drawStation(c, W, H);
    this.town.drawRoad(c, W, H);
    for (const st of [this.past, this.stop]) if (st && st.kind === 'ducks') this._drawCrossing(c, st, W, H);
    this._drawBits(c, W, H, 'puff');
    /* The water goes behind the truck: the cannon is on its far side, and
       the arc climbs over the cab rather than across the children's faces. */
    for (const sp of this.streams) this._drawStream(c, sp, W, H);

    const s = TRUCK_LEN * W / TRUCK.length;
    const bounce = this.v > 0.01 ? Math.sin(this.t * 13) * 2.2 * (this.v / SPEED) : 0;
    drawTruck(c, TRUCK_X * W, ROAD * H, s, {
      t: this.t, roll: this.roll, bounce, lights: this.siren, ladder: this.ladder, aim: this.aim,
      riders: this.riders,
      face: (i, x, y, r) => this._drawSeat(c, i, x, y, r),
      helmets: () => this._drawHelmets(c)
    });
    const st = this.stop || this.past;
    if (st && st.kind === 'cat' && st.state === 'climbing'){
      const p = this._cat(st, W, H);
      animal(c, p.x * W, p.y * H, H / 900 * 1.9, st.animal, this.t, false);
    }
    this._drawBits(c, W, H);
    if (this.mode === 'stop' && this.stop && this.t - this.lastProgress > HINT_AFTER) this._drawHint(c, W, H);
    if (!this.out) this.avatars.drawMitts(c, W, H, this.players);
  }

  /* Who sits in each window: with two players, one each; with one, the
     front seat is theirs and the dalmatian rides behind. */
  _seat(i){
    if (this.players >= 2) return pose.players[i].present ? i : -1;
    return i === 1 && pose.players[0].present ? 0 : -1;
  }

  _drawSeat(c, win, x, y, r){
    const who = this._seat(win);
    if (who < 0){ drawPup(c, x, y + r * 0.1, r * 0.95, this.t + win); return; }
    if (this.faces.has(who)) this.faces.draw(c, who, x, y, r);
    else drawKid(c, x, y + r * 0.08, r * 0.95, this.t + who, who ? '#c98f6a' : '#e9b892');
  }

  _drawHelmets(c){
    TRUCK.windows.forEach((w, win) => {
      const who = this._seat(win);
      const col = who < 0 ? '#e8413c' : PLAYER_COLORS[who];
      const roll = who >= 0 && this.faces.has(who) ? this.faces.roll(who) : 0;
      const top = who >= 0 && this.faces.has(who) ? -w.r * 0.5 : -w.r * 0.42;
      drawHelmet(c, w.x + Math.sin(roll) * w.r * 0.5, w.y + top, w.r * 1.45, roll, col);
    });
  }

  _drawStop(c, st, W, H){
    const x = this._stopX(st) * W, base = SIDEWALK * H;
    if (x < -W * 0.4 || x > W * 1.4) return;
    if (st.kind === 'fire'){
      const out = st.done;
      drawHouse(c, x, base, HOUSE_W * H, HOUSE_H * H, st.pal, out ? 1 : 0);
      for (const f of st.flames){
        const p = this._spot(st, f, W, H);
        drawFlame(c, p.x * W, p.y * H + H * 0.04, H * 0.11 * Math.sqrt(f.hp), this.t, f.seed);
      }
      /* Once it's out, the friend comes to the door to wave thank you. */
      if (out){
        const k = clamp((this.t - st.doneAt) / 0.5, 0, 1);
        friend(c, x + HOUSE_W * H * 0.18, base - H * 0.004, H * 0.55 * k, this.t, true);
      }
    } else if (st.kind === 'cat'){
      drawBigTree(c, x, base, TREE_S * H, this.t);
      if (st.state === 'stuck'){ const p = this._cat(st, W, H); animal(c, p.x * W, p.y * H, H / 900 * 1.9, st.animal, this.t, false); }
    } else if (st.kind === 'garden'){
      /* A long wooden planter; once every flower is up, the friend pops up
         behind it, delighted. */
      if (st.done){
        const k = clamp((this.t - st.doneAt) / 0.5, 0, 1);
        friend(c, x + H * 0.27, base - H * PLANTER * 0.6, H * 0.55 * k, this.t, true);
      }
      for (const f of st.flowers) drawFlower(c, x + f.dx * H, base - H * PLANTER, H * FLOWER_S, f.hp, f.hue, this.t);
      const w = H * 0.29, h = H * PLANTER;
      c.fillStyle = '#5b3a26'; c.fillRect(x - w, base - h - H * 0.008, w * 2, H * 0.016);
      const wood = c.createLinearGradient(0, base - h, 0, base);
      wood.addColorStop(0, '#b7794a'); wood.addColorStop(1, '#8a5a3c');
      c.fillStyle = wood; c.beginPath(); c.roundRect(x - w, base - h, w * 2, h, H * 0.008); c.fill();
      c.strokeStyle = 'rgba(70,40,20,.3)'; c.lineWidth = Math.max(1, H * 0.002);
      c.beginPath(); c.moveTo(x - w, base - h / 2); c.lineTo(x + w, base - h / 2);
      for (let k = 1; k < 6; k++){ const px = x - w + (w * 2) * k / 6 + (k % 2 ? 0 : 0); c.moveTo(px, k % 2 ? base - h : base - h / 2); c.lineTo(px, k % 2 ? base - h / 2 : base); }
      c.stroke();
    }
  }

  _drawFolk(c, f, W, H){
    const x = (f.at - this.dist) * W, base = SIDEWALK * H + H * 0.012, s = H / 900 * 3.3;
    if (x < -W * 0.1 || x > W * 1.1) return;
    animal(c, x, base, s, f.kind, this.t + f.at * 10, f.wave > 0, true);
    /* A paw up, waving back - and a little wave even before, to invite one. */
    const u = 10 * s, k = f.wave > 0 ? 1 : 0.35, a = -1.2 + Math.sin(this.t * (f.wave > 0 ? 12 : 3) + f.at * 7) * 0.5 * k;
    c.strokeStyle = (ANIMALS[f.kind] || ANIMALS.cat).dark;
    c.lineWidth = u * 0.55; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + u * 1.1, base - u * 1.6); c.lineTo(x + u * 1.1 + Math.cos(a) * u * 1.6 * (0.6 + 0.4 * k), base - u * 1.6 + Math.sin(a) * u * 1.6 * (0.6 + 0.4 * k)); c.stroke();
  }

  _drawCrossing(c, st, W, H){
    const x = this._stopX(st) * W;
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let k = 0; k < 4; k++){
      const y = H * (0.885 + k * 0.03), w = H * (0.2 + k * 0.03);
      c.fillRect(x - w / 2 - H * 0.05, y, w, H * 0.014);
    }
    for (const d of [...st.ducks].reverse()){
      if (st.t < d.delay) continue;
      const p = this._duck(st, d, W, H), grow = 1 + (p.y - SIDEWALK) * 1.6;
      drawDuck(c, p.x * W, p.y * H, H * (d.k ? 0.075 : 0.12) * grow, this.t + d.k, d.k === 0, d.flap);
    }
  }

  _drawStation(c, W, H){
    const x = (this.out.at - this.dist) * W, base = SIDEWALK * H, w = H * 0.62, h = H * 0.36;
    c.fillStyle = '#b5523f'; c.fillRect(x - w / 2, base - h, w, h);
    c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 2;
    c.beginPath(); for (let y = base - h + 12; y < base; y += 14){ c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); } c.stroke();
    c.fillStyle = '#8f3c2e'; c.fillRect(x - w * 0.55, base - h - H * 0.03, w * 1.1, H * 0.035);
    /* The bell tower. */
    c.fillStyle = '#b5523f'; c.fillRect(x - w * 0.1, base - h - H * 0.16, w * 0.2, H * 0.14);
    c.fillStyle = '#8f3c2e';
    c.beginPath(); c.moveTo(x - w * 0.14, base - h - H * 0.16); c.lineTo(x, base - h - H * 0.24); c.lineTo(x + w * 0.14, base - h - H * 0.16); c.closePath(); c.fill();
    const swing = Math.sin(this.t * 6) * 0.4 * (this.out.parked ? 1 : 0);
    c.save(); c.translate(x, base - h - H * 0.13); c.rotate(swing);
    c.fillStyle = '#f2c14e'; c.beginPath(); c.moveTo(-H * 0.025, H * 0.05); c.quadraticCurveTo(-H * 0.025, 0, 0, 0); c.quadraticCurveTo(H * 0.025, 0, H * 0.025, H * 0.05); c.closePath(); c.fill();
    c.restore();
    /* Two big doors, the bunting, and the friend waving everyone home. */
    for (const dx of [-0.24, 0.24]){
      c.fillStyle = '#e8413c'; c.fillRect(x + dx * w - w * 0.2, base - h * 0.72, w * 0.4, h * 0.72);
      c.fillStyle = '#bfe0f5';
      for (let k = 0; k < 4; k++) c.fillRect(x + dx * w - w * 0.17 + k * w * 0.085, base - h * 0.64, w * 0.07, h * 0.12);
    }
    for (let k = 0; k < 12; k++){
      c.fillStyle = ['#ff6b9d', '#ffd24a', '#4aa8ff', '#53e59a'][k % 4];
      const bx = x - w / 2 + (k + 0.5) * w / 12, by = base - h + H * 0.012 + Math.sin(k / 11 * Math.PI) * H * 0.03;
      c.beginPath(); c.moveTo(bx - w / 30, by); c.lineTo(bx + w / 30, by); c.lineTo(bx, by + H * 0.03); c.closePath(); c.fill();
    }
    friend(c, x, base, H * 0.6, this.t, this.out.parked);
  }

  /* The water: an arc from the cannon to where the hand is, thick and
     glassy, with drops flying off where it lands. */
  _drawStream(c, sp, W, H){
    const n = this._toScreen(TRUCK.cannon, W, H);
    const ax = n.x * W + Math.cos(this.aim) * H * 0.07, ay = n.y * H + Math.sin(this.aim) * H * 0.07 - H * 0.006;
    const bx = sp.x * W, by = sp.y * H;
    /* Highest point of the arc: over the light bar, or a little above
       wherever it's going if that is higher still. */
    const apex = Math.min(H * 0.2, Math.min(ay, by) - H * 0.06);
    const cx = (ax + bx) / 2, cy = (4 * apex - ay - by) / 2;
    const wob = Math.sin(this.t * 20 + sp.who) * H * 0.004;
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(90,180,255,.7)'; c.lineWidth = H * 0.03;
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(cx, cy + wob, bx, by); c.stroke();
    c.strokeStyle = 'rgba(230,248,255,.85)'; c.lineWidth = H * 0.009;
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(cx, cy + wob, bx, by); c.stroke();
    const g = c.createRadialGradient(bx, by, 0, bx, by, H * 0.05);
    g.addColorStop(0, 'rgba(220,245,255,.8)'); g.addColorStop(1, 'rgba(220,245,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(bx, by, H * 0.05, 0, 6.2832); c.fill();
  }

  _drawBits(c, W, H, only = null){
    for (const b of this.bits){
      if (only ? b.kind !== only : b.kind === 'puff') continue;
      const k = b.age / b.life, x = b.x * W, y = b.y * H;
      if (b.kind === 'steam' || b.kind === 'puff'){
        c.fillStyle = b.kind === 'steam' ? `rgba(240,244,250,${0.55 * (1 - k)})` : `rgba(200,200,210,${0.4 * (1 - k)})`;
        c.beginPath(); c.arc(x, y, H * (0.012 + k * 0.03), 0, 6.2832); c.fill();
      } else if (b.kind === 'drop'){
        c.fillStyle = `rgba(200,235,255,${1 - k})`;
        c.beginPath(); c.arc(x, y, H * 0.006, 0, 6.2832); c.fill();
      } else if (b.kind === 'confetti'){
        c.save(); c.translate(x, y); c.rotate(b.age * 6 + b.r * 6);
        c.fillStyle = `hsla(${b.hue},90%,62%,${1 - k * k})`; c.fillRect(-H * 0.007, -H * 0.004, H * 0.014, H * 0.008);
        c.restore();
      } else if (b.kind === 'spark'){
        c.fillStyle = `rgba(255,236,150,${1 - k})`;
        c.beginPath(); c.arc(x, y, H * 0.006 * (1 - k * 0.5), 0, 6.2832); c.fill();
      } else if (b.kind === 'heart'){
        const r = H * 0.018;
        c.fillStyle = `rgba(255,110,150,${1 - k})`;
        c.beginPath(); c.moveTo(x, y + r * 0.9);
        c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.4);
        c.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); c.fill();
      }
    }
  }

  /* A job left undone for a few seconds: a ghostly hand drifts from the
     truck to where to point - the flames, the thirsty flowers, the cat. */
  _drawHint(c, W, H){
    const st = this.stop;
    let target = null;
    if (st.kind === 'fire'){ const f = st.flames.find(f => f.hp > 0); if (f) target = this._spot(st, f, W, H); }
    else if (st.kind === 'garden'){ const f = st.flowers.find(f => f.hp < 1); if (f) target = this._spot(st, f, W, H); }
    else if (st.kind === 'cat' && st.state === 'stuck') target = this._cat(st, W, H);
    if (!target) return;
    const u = ((this.t - this.lastProgress - HINT_AFTER) % 3) / 3;
    const k = Math.min(1, u / 0.45), ease = k * k * (3 - 2 * k), show = Math.min(1, u / 0.15) * (1 - Math.max(0, (u - 0.8) / 0.2));
    const from = { x: 0.5, y: 0.62 };
    const x = (from.x + (target.x - from.x) * ease) * W, y = (from.y + (target.y - from.y) * ease) * H, r = H * 0.03;
    const halo = c.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
    halo.addColorStop(0, `rgba(255,246,226,${0.35 * show})`); halo.addColorStop(1, 'rgba(255,246,226,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(x, y, r * 2.4, 0, 6.2832); c.fill();
    c.fillStyle = `rgba(255,246,226,${0.6 * show})`; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  }

  /* Cooperative: nothing to show but the clock. */
  hud(){ return { score: [this.helped, this.helped], showLives: false, hideScore: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) rows.push({ label: `Player ${i + 1}`, value: this.helped, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.players < 2 ? null : -1; }
  value(){ return this.helped; }
}
