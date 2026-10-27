import { clamp } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';
import { JumpWatch } from '../tracking/jump.js';
import { RUN, P, drawForest, drawLeaves, sideThings, drawTree, drawToadstool, drawFern, drawLog, drawBranch,
         drawStump, drawCrystal, drawFox, drawRunner, drawFireflies, drawRibbon } from './forest-art.js';

/* Forest Run. Down a mossy path through an enchanted forest, running for
   real: lean to go left or right round stumps and boulders, jump over fallen
   logs, duck under low branches, and run through the glowing crystals
   hanging over the path. The longer a run lasts the faster it goes and the
   more magical the forest gets - golden afternoon turning to violet dusk,
   toadstools glowing, fireflies coming out.

   Like the real thing, hitting something ends the run: a tumble, and back
   to the start of the forest for another go. With two children, each has
   their own runner side by side; one who trips sits out a moment and jumps
   back in, and the run only ends if both are down at once. Nothing is
   counted on screen - the best run so far is a ribbon of light across the
   path, and running past it is a celebration.

   A fox runs ahead through the first stretch and shows each move the first
   time it's needed: over the log, under the branch, round the stump. */

export const ROUND = 240;
export const SPEED0 = 0.28, SPEED_MAX = 0.56;   /* path depths a second */
export const RAMP = 100;                        /* seconds of running to reach full speed */
export const GRAVITY = 12.5, HOP = 1;           /* a jump: about 0.8 seconds in the air */
export const CLEAR = 0.15;                      /* how high (of a full hop) clears a log */
export const DUCKED = 0.5;                      /* how far down (0..1) passes under a branch */
export const DUCK = 0.15;                       /* head drop, in body sizes, that counts as ducking */
export const LEAN = 0.35;                       /* shoulder-widths of lean for full reach */
export const SIT_OUT = 2.5;                     /* seconds a tripped runner sits out, with two */
export const BLINK = 1.5;                       /* seconds of safety after jumping back in */
export const FOX_TIME = 60;                     /* seconds the fox runs with them */
/* Where each runner keeps to, and how far they can lean from it, by how
   many are running. */
const HOMES = { 2: [-0.45, 0.45], 3: [-0.6, 0, 0.6], 4: [-0.72, -0.24, 0.24, 0.72] };
const REACH = { 1: 1, 2: 0.55, 3: 0.5, 4: 0.45 };
const FOX_REL = 0.3, BODY = 0.12, CRYSTAL_REACH = 0.2;

export default {
  id: 'forest-run', name: 'Forest Run', stars: 2, accent: '#f08a3a', secs: ROUND,
  /* Arms go up in every jump; holding them up a while is still a pause. */
  pauseHold: 2.5,
  create(n){ return new ForestRun(n); }
};

class ForestRun {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false;
    this.z = 0;
    this.jumps = new JumpWatch();
    this.faces = new FaceCam();
    this.heads = pose.players.map(() => null);   /* standing head height, for spotting a duck */
    this.best = 0;                   /* how far the best run so far got */
    this.crystals = 0;
    this.bits = [];
    this.out = null;
    this.seen = new Set();           /* obstacle kinds met so far: the fox shows each once */
    this.fox = { rel: FOX_REL, lane: 0, act: 'run', k: 0, gone: false };
    this._newRun();
  }

  _newRun(){
    this.run = { t: 0, z0: this.z, speed: SPEED0, down: null, passedBest: this.best <= 0 };
    this.things = [];
    this.nextAt = this.z + 1.4;
    this.runners = pose.players.map((_, i) => this._runner(i, this.runners && this.runners[i]));
  }

  _runner(i, was){
    return { x: was ? was.x : this._home(i), lean: 0, air: 0, airV: 0, duck: 0, down: 0, back: 0, blink: 0, lastDuck: -9 };
  }

  /* The children here, in order: they share the path side by side, each
     with their own stretch of it; one alone has all of it. */
  get here(){ return pose.players.slice(0, this.players).map((_, i) => i).filter(i => pose.players[i].present); }
  get pair(){ return this.here.length > 1; }
  _home(i){
    const here = this.here, n = here.length, k = here.indexOf(i);
    return n < 2 || k < 0 ? 0 : HOMES[n][k];
  }
  get reach(){ return REACH[Math.max(1, this.here.length)]; }

  get speed(){ return this.run.speed; }
  get magic(){ return clamp(this.run.t / 110, 0, 1); }
  /* How far into the current run, in path depths. */
  get distance(){ return this.z - this.run.z0; }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    this.t += dt;
    this.faces.step(dt);
    const r = this.run;
    if (r.down){
      /* The run is over: everything slows to a stop, then back to the start. */
      r.down.t += dt;
      r.speed = Math.max(0, r.speed - dt * SPEED0 * 1.5);
      if (r.down.t > 2.6){ this.best = Math.max(this.best, r.down.reached); this._newRun(); return; }
    } else {
      r.t += dt;
      r.speed = SPEED0 + (SPEED_MAX - SPEED0) * Math.min(1, r.t / RAMP);
    }
    const before = this.z;
    this.z += r.speed * dt;
    this._spawn();
    const jumped = this.jumps.step(dt, pose.players, this.players);
    for (let i = 0; i < this.players; i++) this._move(i, dt, jumped.includes(i));
    this._pass(before, W, H);
    this._fox(dt);
    this._stepBits(dt);
    if (!r.down && !r.passedBest && this.distance > this.best){ r.passedBest = true; this._cheer(); }
  }

  /* How far a child leans, -1 left to 1 right: shoulders over hips, in
     shoulder-widths. With the mouse, where it is across the screen. */
  leanOf(i){
    const p = pose.players[i];
    if (!p.present) return null;
    if (pose.mouse.active) return clamp((p.hands.right.x - 0.5) * 2.5, -1, 1);
    const lm = p.lm;
    if (!lm) return null;
    const sx = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2, hx = (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2;
    const sw = Math.abs(lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x) || 0.05;
    return clamp((sx - hx) / sw / LEAN, -1, 1);
  }

  /* Ducking: the head well below where it is when standing. The standing
     height follows slowly, and only while not ducking. With the mouse, low
     on the screen. */
  duckOf(i, dt){
    const p = pose.players[i];
    if (!p.present){ this.heads[i] = null; return false; }
    if (pose.mouse.active) return p.hands.right.y > 0.78;
    const lm = p.lm;
    if (!lm) return false;
    const y = lm[L.NOSE].y, s = p.scale || 0.3;
    if (this.heads[i] == null){ this.heads[i] = y; return false; }
    const down = (y - this.heads[i]) / s > DUCK;
    if (!down && this.runners[i].air <= 0) this.heads[i] += (y - this.heads[i]) * Math.min(1, dt * 1.5);
    return down;
  }

  _move(i, dt, jumped){
    const rn = this.runners[i], p = pose.players[i];
    rn.blink = Math.max(0, rn.blink - dt);
    if (rn.down > 0){
      rn.down = Math.min(1, rn.down + dt / 0.9);
      if (!this.run.down){
        rn.back -= dt;
        if (rn.back <= 0){ rn.down = 0; rn.blink = BLINK; rn.air = 0; rn.airV = 0; sfx.boing(1); }
      }
      return;
    }
    const lean = this.leanOf(i);
    rn.lean += ((lean ?? 0) - rn.lean) * Math.min(1, dt * 8);
    const want = clamp(this._home(i) + rn.lean * this.reach, -1, 1);
    rn.x += (want - rn.x) * Math.min(1, dt * 6);
    if (jumped && rn.air <= 0 && !this.run.down){ rn.airV = Math.sqrt(2 * GRAVITY * HOP); sfx.boing(1); }
    if (rn.air > 0 || rn.airV > 0){
      rn.air += rn.airV * dt; rn.airV -= GRAVITY * dt;
      if (rn.air <= 0){ rn.air = 0; rn.airV = 0; }
    }
    const ducking = this.duckOf(i, dt);
    if (ducking) rn.lastDuck = this.t;
    rn.duck += ((ducking ? 1 : 0) - rn.duck) * Math.min(1, dt * 12);
  }

  /* Is this runner in the game: someone there and on their feet? */
  _up(i){ return pose.players[i].present && this.runners[i].down === 0; }

  /* ---------- the path ahead ---------- */

  /* What comes next, a little way past the horizon. The first stretch of
     every run is gentle; logs and branches come in once it's going. */
  _spawn(){
    const r = this.run;
    while (this.nextAt < this.z + 1.05){
      const d = this.nextAt, ramp = Math.min(1, r.t / RAMP);
      const kinds = r.t < 6 ? ['stump'] : r.t < 14 ? ['stump', 'stump', 'log'] : ['stump', 'rock', 'log', 'log', 'branch', 'branch'];
      let kind = kinds[Math.floor(Math.random() * kinds.length)];
      if (kind === 'branch' && r.t < 22 && !this.seen.has('log')) kind = 'log';
      if (kind === 'stump' || kind === 'rock'){
        const lane = (Math.random() - 0.5) * 1.5;
        this.things.push({ kind, d, lane, w: this.here.length > 2 ? 0.2 : 0.26 });
        /* Crystals on the free side, to lean for. */
        const side = lane > 0 ? -1 : 1;
        for (let k = 0; k < 4; k++) this.things.push({ kind: 'crystal', d: d - 0.04 - k * 0.05, lane: side * 0.6, high: false, hue: 190 + k * 25 });
      } else {
        this.things.push({ kind, d, lane: 0, w: 2 });
        /* An arc of crystals over every log, for jumping through. */
        if (kind === 'log'){
          const lanes = this.here.length > 1 ? this.here.map(i => this._home(i)) : [-0.45, 0, 0.45];
          lanes.forEach((lane, k) => this.things.push({ kind: 'crystal', d, lane, high: true, hue: 270 + k * 30 }));
        }
      }
      const gap = (2.7 - 1.2 * ramp) * (0.8 + Math.random() * 0.4);
      this.nextAt += gap * Math.max(r.speed, SPEED0);
    }
  }

  /* Everything that reaches the runners this step: crystals to pick up,
     obstacles to clear. */
  _pass(before, W, H){
    for (const th of this.things){
      const relNow = th.d - this.z, relWas = th.d - before;
      if (!(relWas >= RUN && relNow < RUN)) continue;
      if (!this.seen.has(th.kind) && th.kind !== 'crystal') this.seen.add(th.kind);
      for (let i = 0; i < this.players; i++){
        const rn = this.runners[i];
        if (!this._up(i) || this.run.down) continue;
        if (th.kind === 'crystal'){
          if (th.got || Math.abs(rn.x - th.lane) > CRYSTAL_REACH || (th.high && rn.air < CLEAR * 2)) continue;
          th.got = true; this.crystals++;
          sfx.jar(1 + (this.crystals % 8));
          const p = P(th.lane, RUN, W, H);
          this._sparkle(p.x / W, (p.y - H * (th.high ? 0.3 : 0.12)) / H, 8, th.hue);
          continue;
        }
        if (rn.blink > 0) continue;
        let hit = false;
        if (th.kind === 'log') hit = rn.air < CLEAR;
        else if (th.kind === 'branch') hit = rn.duck < DUCKED && this.t - rn.lastDuck > 0.25;
        else hit = Math.abs(rn.x - th.lane) < th.w + BODY && rn.air < CLEAR * 4;
        if (hit) this._trip(i, W, H);
      }
    }
    this.things = this.things.filter(th => th.d - this.z > -0.1);
  }

  _trip(i, W, H){
    const rn = this.runners[i];
    rn.down = 0.001; rn.back = SIT_OUT; rn.air = 0; rn.airV = 0;
    sfx.thud();
    /* The run ends when nobody is left on their feet. */
    const anyone = this.runners.slice(0, this.players).some((_, j) => this._up(j));
    if (!anyone){ this.run.down = { t: 0, reached: this.distance }; sfx.lose(); }
  }

  _cheer(){
    sfx.rainbow();
    for (let k = 0; k < 30; k++) this._sparkle(0.5 + (Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 0.2, 1, (Math.random() * 360) | 0);
  }

  /* ---------- the fox ---------- */

  _fox(dt){
    const f = this.fox;
    if (this.t > FOX_TIME || this.out){ f.gone = true; f.rel += dt * 0.25; return; }
    /* Whatever's coming up to the fox, it shows how. */
    const near = this.things.filter(th => th.kind !== 'crystal' && Math.abs(th.d - this.z - f.rel) < 0.06)[0];
    f.act = 'run'; f.k = 0;
    let lane = 0;
    if (near){
      const u = 1 - Math.abs(near.d - this.z - f.rel) / 0.06;
      if (near.kind === 'log'){ f.act = 'jump'; f.k = Math.sin(u * Math.PI / 2); }
      else if (near.kind === 'branch') f.act = 'duck';
      else lane = near.lane > 0 ? -0.75 : 0.75;
    } else {
      const next = this.things.find(th => (th.kind === 'stump' || th.kind === 'rock') && th.d - this.z > f.rel && th.d - this.z < f.rel + 0.15);
      if (next) lane = next.lane > 0 ? -0.75 : 0.75;
    }
    f.lane += (lane - f.lane) * Math.min(1, dt * 5);
  }

  /* ---------- little things ---------- */

  _sparkle(x, y, n, hue){
    for (let k = 0; k < n; k++){
      const a = Math.random() * 6.28, s = 0.1 + Math.random() * 0.15;
      this.bits.push({ kind: 'spark', x, y, vx: Math.cos(a) * s * 0.56, vy: Math.sin(a) * s - 0.05, age: 0, life: 0.7, hue });
    }
    if (this.bits.length > 300) this.bits.splice(0, this.bits.length - 300);
  }
  _stepBits(dt){
    for (const b of this.bits){ b.age += dt; if (b.vx != null){ b.x += b.vx * dt; b.y += b.vy * dt; } }
    this.bits = this.bits.filter(b => b.age < b.life);
  }

  /* ---------- the ending: slowing to a stop in a glade ---------- */

  outro(dt, W, H){
    if (!this.out){ this.out = { t: 0 }; sfx.fanfare(); this.best = Math.max(this.best, this.distance); }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.faces.step(dt);
    this.run.speed = Math.max(0, this.run.speed - dt * 0.3);
    this.z += this.run.speed * dt;
    this.things = this.things.filter(th => th.kind === 'crystal');
    for (const rn of this.runners){ rn.down = 0; rn.duck = 0; rn.air = Math.abs(Math.sin(o.t * 5)) * 0.25; }
    if (Math.random() < dt * 20) this._sparkle(Math.random(), 0.3 + Math.random() * 0.4, 1, (Math.random() * 360) | 0);
    this._stepBits(dt);
    return o.t > 5;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    const magic = this.out ? 0.6 : this.magic;
    drawForest(c, W, H, this.z, magic, this.t);
    const items = sideThings(this.z);
    for (const th of this.things) if (!th.got) items.push({ ...th, rel: th.d - this.z });
    if (!this.run.down && !this.run.passedBest && this.best > 0) items.push({ kind: 'ribbon', rel: this.run.z0 + this.best - this.z });
    if (!this.fox.gone || this.fox.rel < 1) items.push({ kind: 'fox', rel: this.fox.rel, lane: this.fox.lane });
    for (let i = 0; i < this.players; i++) if (pose.players[i].present || this.runners[i].down > 0) items.push({ kind: 'runner', rel: RUN, i });
    items.sort((a, b) => b.rel - a.rel);
    for (const it of items){
      if (it.rel > 1 || it.rel < -0.1) continue;
      this._drawItem(c, it, W, H, magic);
    }
    drawFireflies(c, W, H, this.t, magic);
    drawLeaves(c, W, H);
    this._drawBits(c, W, H);
  }

  _drawItem(c, it, W, H, magic){
    const p = P(it.lane || 0, it.rel, W, H);
    switch (it.kind){
      case 'tree': drawTree(c, p.x, p.y, H * 0.42 * p.k * it.size, it.seed, magic); break;
      case 'toadstool': drawToadstool(c, p.x, p.y, H * 0.06 * p.k * it.size, magic, this.t, it.seed); break;
      case 'fern': drawFern(c, p.x, p.y, H * 0.07 * p.k * it.size); break;
      case 'log': drawLog(c, W, H, it.rel, magic); break;
      /* Once past, a branch is overhead and out of sight. */
      case 'branch': if (it.rel > RUN) drawBranch(c, W, H, it.rel, this.t, magic); break;
      case 'stump': case 'rock': drawStump(c, p.x, p.y, H * 0.2 * p.k, it.kind); break;
      case 'crystal': drawCrystal(c, p.x, p.y - H * (it.high ? 0.3 : 0.11) * p.k, H * 0.025 * p.k, this.t + it.d * 9, it.hue); break;
      case 'ribbon': drawRibbon(c, W, H, it.rel, this.t); break;
      case 'fox': drawFox(c, p.x, p.y, H * 0.16 * p.k, this.t, this.fox.act, this.fox.k); break;
      case 'runner': this._drawRunner(c, it.i, W, H); break;
    }
  }

  _drawRunner(c, i, W, H){
    const rn = this.runners[i], present = pose.players[i].present, p = P(rn.x, RUN, W, H), h = H * 0.26;
    c.save();
    drawRunner(c, p.x, p.y, h, this.t + i * 0.37, PLAYER_COLORS[i],
      { air: rn.air * h * 0.55, duck: rn.duck, lean: rn.lean, down: rn.down, blink: rn.blink > 0 },
      (x, y, r) => {
        if (present && this.faces.has(i)) this.faces.draw(c, i, x, y, r);
        else drawKid(c, x, y + r * 0.1, r, this.t + i, KID_SKINS[i]);
      });
    c.restore();
  }

  _drawBits(c, W, H){
    for (const b of this.bits){
      const k = b.age / b.life;
      if (b.kind === 'spark'){
        c.fillStyle = `hsla(${b.hue},100%,75%,${1 - k})`;
        c.beginPath(); c.arc(b.x * W, b.y * H, H * 0.007 * (1 - k * 0.5), 0, 6.2832); c.fill();
      }
    }
  }

  /* Nothing on screen but the clock. */
  hud(){ return { score: [this.crystals, this.crystals], showLives: false, hideScore: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) rows.push({ label: `Player ${i + 1}`, value: this.crystals, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.players < 2 ? null : -1; }
  value(){ return this.crystals; }
}
