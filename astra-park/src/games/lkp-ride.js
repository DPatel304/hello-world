/* Last Known Position - the critter ride: a corridor's event. Fast asleep
   right across the path: Mossy, a big, soft, gentle forest giant (all
   lilac fluff, moss and little glowing flowers on its back). Running up
   to it, Nova counts them in - COUNT seconds of HANDS UP to wave hello -
   and as the hands go up it wakes, smiles, turns round and crouches, and
   up they climb onto its back. Anyone who didn't wave gets scooped up by
   its tail all the same: nobody's left behind.

   Riding, RIDE_LEN of the path: it runs when they run. Running on the
   spot - all of them together, the team's average - sets its pace, and
   running hard it BOUNDS, everyone bouncing high on its back, for the
   crystals floating up high. Leaning together steers it: it goes the way
   the team leans, side to side through the crystals weaving along the
   path. Then it slows, they hop down, and it trots off to the side of the
   path to sit and wave them goodbye.

   No falling off, no game over: the slowest team still gets there, just
   with fewer of the high crystals. */
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MarchWatch } from '../tracking/gestures.js';
import { P, RUN, INK } from './lkp-art.js';
import { glow } from './lkp-world.js';
import { handsUp, tick, banner, smooth } from './lkp-zip.js';

/* Seconds: the count in (hands up, waving hello), how long hands have to
   be up to count, climbing on, and getting off and saying goodbye. */
export const COUNT = 3, HOLD = 0.25, BOARD = 1.8, OFF = 2.6;
/* How far it carries them (depths), and its pace: from SLOWEST (nobody
   running) to FASTEST (everyone all-out), times the game's own SPEED.
   Running harder than BOUND (0..1, the team's average) and it bounds. */
export const RIDE_LEN = 3.6, SLOWEST = 0.75, FASTEST = 1.7, BOUND = 0.5;
/* Just ahead of the crew, where it is (depths); how high its back is, the
   riders' feet (screen heights at the crew's depth); its body's height. */
const AHEAD = 0.02, BACK = 0.22, SIZE = 0.3;
/* The crystals along the way: floating at the riders' middles - and the
   high ones, only reached bounding. How near (lanes) to take one. */
export const LOW = BACK + 0.1, HIGH = BACK + 0.25, REACH = 0.13;
/* The bounce, in screen heights: trotting, and bounding. */
const TROT = 0.012, LEAP = 0.11;
/* Where they sit along its back (lanes from its middle), by how many. */
const SEATS = { 1: [0], 2: [-0.15, 0.15], 3: [-0.26, 0, 0.26], 4: [-0.33, -0.11, 0.11, 0.33] };
/* How far it steers each way (lanes), for the team's lean. */
const STEER = 0.62;
/* Saying goodbye: where it sits, ahead (depths) and off to the side (lane). */
const SIT = 0.75, SIDE = 1.3;

export const MOSSY = { fur: '#b9a8e6', shade: '#8c7cc6', dark: '#5f5196', belly: '#f6eed6', pink: '#f7a8c4',
  moss: ['#7cc98f', '#4f9e6e'], glow: '#bdf7ff', leaf: '#9be27a', bulb: '#ff8cd8' };

export class Ride {
  constructor(game, th, talk = false){
    this.g = game; this.th = th; this.t = 0; this.done = false; this.talk = talk;
    this.phase = 'meet';
    this.d = th.d; this.lane = 0;
    this.held = pose.players.map(() => 0);
    this.ready = [];                  /* waved hello, in order */
    this.riders = []; this.scooped = [];
    this.march = pose.players.map(() => 0);
    this.mw = pose.players.map(() => new MarchWatch());
    this.team = 0;                    /* the team's running, 0..1 */
    this.boardT = 0; this.went = 0; this.offT = 0;
    this.ph = 0; this.bounce = 0; this.leapT = 0; this.told = false; this.slowT = 0;
    this.lastZ = game.z; this.lastLeft = this.left;
    if (talk) this._say('rideMeet');
  }

  _say(key){ const l = this.g.level.lines[key]; if (l && this.talk) this.g.captain.say(l[0][1], l[0][2] || ''); }

  /* ---------- where things are ---------- */

  /* Seconds till they reach it. */
  get left(){ return Math.max(0, (this.th.d - this.g.z - RUN - AHEAD) / 0.3); }
  /* On its back (or climbing on, or hopping down). */
  on(i){ return this.riders.includes(i) && (this.phase !== 'off' || this.offT < 0.9); }
  get riding(){ return this.phase === 'ride'; }
  /* How fast down the path: theirs, running up to it and away again;
     slowing to climb on; its pace, riding. */
  speed(run){
    if (this.phase === 'board') return run * 0.25;
    if (this.phase === 'ride') return run * (SLOWEST + (FASTEST - SLOWEST) * this.team);
    if (this.phase === 'off') return run * (this.offT < 0.9 ? 0.45 : 1);
    return run;
  }
  /* The lane each rider's in, on its back. */
  seat(i){
    const k = this.riders.indexOf(i), s = SEATS[this.riders.length] || SEATS[4];
    return this.lane + (s[k] || 0) + Math.max(-1, Math.min(1, this.g.crew[i].lean || 0)) * 0.05;
  }
  /* How far up from the ground a rider is (px): climbing on, on its back
     (bouncing with it), hopping down. */
  lift(i, H){
    const k = this.riders.indexOf(i);
    if (k < 0) return 0;
    let f = 1, arc = 0;
    if (this.phase === 'board'){
      const start = 0.65 + k * 0.14 + (this.scooped.includes(i) ? 0.25 : 0);
      f = smooth((this.boardT - start) / 0.5); arc = Math.sin(f * Math.PI) * 0.09;
    } else if (this.phase === 'off'){
      f = 1 - smooth((this.offT - k * 0.1) / 0.5); arc = Math.sin(f * Math.PI) * 0.07;
    }
    return H * (f * BACK + arc) + f * this.bounce * H;
  }
  /* Up on its back yet (not mid-hop)? */
  aboard(i){ return this.riders.includes(i) && this.lift(i, 1) >= BACK * 0.97; }

  /* ---------- the loop ---------- */

  step(dt, W = 1920, H = 1080){
    const g = this.g;
    this.t += dt;
    for (const i of g.here) this.march[i] = g.marchOf ? g.marchOf(i, dt) : this.mw[i].step(pose.players[i], dt, pose.mouse.active);
    if (this.phase === 'meet'){
      for (const i of g.here){
        this.held[i] = handsUp(i) ? this.held[i] + dt : 0;
        if (this.held[i] >= HOLD && !this.ready.includes(i)){ this.ready.push(i); sfx.pick(); }
      }
      const left = this.left;
      if (Math.ceil(left) !== Math.ceil(this.lastLeft) && left > 0) sfx.beep(false);
      this.lastLeft = left;
      if (left <= 0){
        /* Everyone aboard, the ones who waved first - the rest scooped up. */
        this.phase = 'board';
        const all = [...g.here].sort((a, b) => g.crew[a].x - g.crew[b].x);
        this.riders = all;
        this.scooped = all.filter(i => !this.ready.includes(i));
        sfx.whoosh();
      }
      return;
    }
    if (this.phase === 'board'){
      this.boardT += dt; this.d = g.z + RUN + AHEAD;
      for (const i of this.riders){
        const k = this.riders.indexOf(i), start = 0.65 + k * 0.14 + (this.scooped.includes(i) ? 0.25 : 0);
        if (this.boardT - dt < start && this.boardT >= start){
          sfx.boing(this.scooped.includes(i) ? 0.8 : 1.1);
          if (this.ready.includes(i)){ const p = P(this.seat(i), RUN, W, H); g._sparkle(p.x / W, (p.y - H * BACK * 1.4) / H, 6, 300); }
        }
      }
      if (this.boardT >= BOARD){ this.phase = 'ride'; this._say('rideOn'); sfx.whoosh(); }
      return this._bob(dt);
    }
    if (this.phase === 'ride'){
      this.d = g.z + RUN + AHEAD;
      const riding = this.riders.filter(i => g.here.includes(i));
      this.team = riding.length ? riding.reduce((s, i) => s + this.march[i], 0) / riding.length : 0;
      /* steering: the way the team leans */
      const lean = riding.length ? riding.reduce((s, i) => s + Math.max(-1, Math.min(1, g.crew[i].lean || 0)), 0) / riding.length : 0;
      this.lane += (lean * STEER - this.lane) * Math.min(1, dt * 2.2);
      this.went += g.speed * dt;
      this.slowT = this.team < 0.25 ? this.slowT + dt : 0;
      if (this.team > BOUND && !this.told && this.went > 0.4){ this.told = true; this._say('rideFast'); }
      this._bob(dt);
      this._collect(W, H);
      if (this.went >= RIDE_LEN){ this.phase = 'off'; this._say('rideOff'); this.offD = this.d; }
      return;
    }
    if (this.phase === 'off'){
      this.offT += dt;
      this.team *= Math.exp(-dt * 3);
      this._bob(dt);
      if (this.offT < 0.9){ this.d = g.z + RUN + AHEAD; this.sitAt = this.d + SIT; }
      else {
        /* trotting off ahead, to the side of the path; then sitting there,
           waving, as they go by */
        this.d += (this.sitAt - this.d) * Math.min(1, dt * 2.5);
        this.lane += (SIDE - this.lane) * Math.min(1, dt * 2.5);
      }
      if (this.offT >= OFF){
        this.done = true;
        g.things.push({ kind: 'mossy', d: this.d, lane: this.lane, bye: true });
      }
    }
  }

  /* Its trot: bounding while they're running hard. */
  _bob(dt){
    const hard = this.phase === 'ride' && this.team > BOUND;
    this.leapT += ((hard ? 1 : 0) - this.leapT) * Math.min(1, dt * 3);
    const was = this.ph;
    this.ph += dt * (this.phase === 'board' ? 2 : 6 + 5 * this.team + (hard ? -2 : 0));
    const amp = TROT + (LEAP - TROT) * this.leapT;
    this.bounce = Math.abs(Math.sin(this.ph)) * amp;
    /* each landing: a soft thump */
    if (this.phase === 'ride' && Math.floor(this.ph / Math.PI) !== Math.floor(was / Math.PI)) sfx.step(this.leapT > 0.5 ? 0 : 2, 0.25 + this.leapT * 0.3);
  }

  /* Crystals reaching the riders, near where they sit - the high ones
     only up in a bound. */
  _collect(W, H){
    const g = this.g, z0 = this.lastZ; this.lastZ = g.z;
    for (const th of g.things){
      if (!th.ride || th.got) continue;
      const now = th.d - g.z, was = th.d - z0;
      if (!(was >= RUN && now < RUN)) continue;
      if (th.up && this.bounce < LEAP * 0.45) continue;
      for (const i of this.riders){
        if (!this.aboard(i) || Math.abs(this.seat(i) - th.lane) > REACH) continue;
        th.got = true;
        const p = P(th.lane, RUN, W, H), y = (p.y - H * (th.up ? HIGH : LOW)) / H;
        g.gain(th.worth || 1, p.x / W, y); sfx.jar(1 + (g.crystals % 8));
        if (th.worth > 1) sfx.gold();
        g._sparkle(p.x / W, y, 6, 185);
        break;
      }
    }
  }

  /* ---------- drawing ---------- */

  /* Into the world's list of things to draw: Mossy, just ahead of them. */
  items(items){ items.push({ kind: 'ride', rel: this.d - this.g.z }); }

  /* Mossy: asleep facing us, waking as they wave; turning round to take
     them on; from behind as they ride; turned to wave them off. */
  draw(c, W, H){
    const g = this.g, rel = this.d - g.z, p = P(this.lane, rel, W, H), s = H * SIZE * p.k;
    if (this.phase === 'meet'){
      const wake = Math.min(1, this.ready.length / Math.max(1, g.here.length) + (this.left < 0.8 ? 1 : 0));
      drawMossy(c, p.x, p.y, s, this.t, { sleep: 1 - wake, run: 0 });
      return;
    }
    if (this.phase === 'board'){
      /* a hop round, to face away; then crouched, for them to climb on */
      const f = Math.min(1, this.boardT / 0.6), hop = Math.sin(f * Math.PI) * s * 0.25, flip = Math.abs(Math.cos(f * Math.PI));
      const crouch = this.boardT > 0.6 ? 1 - smooth((this.boardT - BOARD + 0.4) / 0.4) : 0;
      drawMossy(c, p.x, p.y, s, this.t, { back: f > 0.5, flip: Math.max(0.08, flip), hop, crouch, run: 0, tail: this.scooped.length && this.boardT > 0.6 && this.boardT < 1.4 ? 1 : 0 });
      return;
    }
    if (this.phase === 'off' && this.offT > 1.3){
      const f = Math.min(1, (this.offT - 1.3) / 0.5), flip = Math.abs(Math.cos(f * Math.PI));
      drawMossy(c, p.x, p.y, s, this.t, { back: f < 0.5, flip: Math.max(0.08, flip), hop: Math.sin(f * Math.PI) * s * 0.2, wave: f >= 1 ? 1 : 0, run: 0 });
      return;
    }
    drawMossy(c, p.x, p.y, s, this.t, { back: true, hop: this.bounce * H * p.k, run: this.phase === 'ride' ? 0.4 + this.team * 0.6 : 0.3, step: this.ph * 2, stretch: this.leapT });
  }

  /* The fluff along its back, in front of the riders' feet. */
  drawTop(c, W, H){
    if (!(this.phase === 'ride' || this.phase === 'board' && this.boardT > 0.9 || this.phase === 'off' && this.offT < 0.6)) return;
    const g = this.g, rel = this.d - g.z, p = P(this.lane, rel, W, H), s = H * SIZE * p.k;
    const y = p.y - H * BACK * p.k - this.bounce * H * p.k, w = s * 0.78;
    c.save();
    c.fillStyle = MOSSY.fur;
    c.beginPath(); c.ellipse(p.x, y + s * 0.04, w, s * 0.07, 0, 0, Math.PI * 2); c.fill();
    for (let k = -7; k <= 7; k++){
      const x = p.x + (k / 7) * w * 0.95, r = s * (0.05 + 0.015 * ((k * 7) % 3));
      c.fillStyle = k % 2 ? MOSSY.fur : '#c8b9ef';
      c.beginPath(); c.arc(x, y + s * 0.015 - Math.cos((k / 7) * 1.4) * s * 0.02, r, 0, Math.PI * 2); c.fill();
    }
    /* moss and tiny flowers, tucked in the fluff */
    for (let k = -3; k <= 3; k++){
      const x = p.x + k * w * 0.27 + s * 0.03, yy = y + s * 0.05;
      c.fillStyle = MOSSY.moss[k & 1]; c.beginPath(); c.ellipse(x, yy, s * 0.05, s * 0.022, 0, 0, Math.PI * 2); c.fill();
      if (k % 2 === 0){ glow(c, x, yy - s * 0.02, s * 0.04, MOSSY.bulb, 0.5); c.fillStyle = MOSSY.bulb; c.beginPath(); c.arc(x, yy - s * 0.02, s * 0.012, 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
  }

  /* The count in; then RUN!, and how fast it's going. */
  marks(c, W, H){
    const g = this.g;
    if (this.phase === 'meet'){
      for (const i of g.here){
        const p = P(g.crew[i].x, RUN, W, H);
        tick(c, p.x, p.y - H * 0.19 * 1.45, H * 0.03, this.ready.includes(i), Math.min(1, this.held[i] / HOLD), PLAYER_COLORS[i], this.t + i);
      }
      banner(c, W, H, 'HANDS UP — WAVE HELLO!', '#ffd24a', 1 + 0.03 * Math.sin(this.t * 6));
      const n = Math.ceil(this.left);
      if (n >= 1 && n <= COUNT){
        const f = this.left - Math.floor(this.left);
        c.save(); c.translate(W / 2, H * 0.56); c.scale(1 + f * 0.4, 1 + f * 0.4); c.globalAlpha = 0.5 + 0.5 * f;
        c.font = `700 ${Math.round(H * 0.16)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = H * 0.02; c.strokeStyle = '#05060f'; c.strokeText(String(n), 0, 0); c.fillStyle = '#ffffff'; c.fillText(String(n), 0, 0);
        c.restore();
      }
      return;
    }
    if (this.phase === 'board' && this.boardT > 0.6) banner(c, W, H, 'CLIMB ON!', '#7ff3ff', 1.1);
    if (this.phase !== 'ride') return;
    if (this.went < 0.25) banner(c, W, H, 'RUN ON THE SPOT!', '#7ff3ff', 1.2 - this.went);
    else if (this.slowT > 2) banner(c, W, H, 'RUN, AND MOSSY RUNS!', '#ffd24a', 1 + 0.04 * Math.sin(this.t * 8));
    else if (this.leapT > 0.6) banner(c, W, H, 'BOUNCE!', '#ff9cd8', 1 + 0.06 * Math.sin(this.ph * 2));
    /* its pace, a bar along the bottom - glowing, bounding */
    const w = W * 0.3, x = (W - w) / 2, y = H * 0.9, h = H * 0.024, u = this.team;
    c.save();
    c.fillStyle = 'rgba(5,6,15,.7)'; c.beginPath(); c.roundRect(x - 4, y - 4, w + 8, h + 8, h); c.fill();
    if (this.leapT > 0.3) glow(c, x + w * u, y + h / 2, h * 3, '#ff9cd8', 0.6 * this.leapT);
    c.fillStyle = u > BOUND ? '#ff9cd8' : '#7ff3ff'; c.beginPath(); c.roundRect(x, y, Math.max(h, w * u), h, h / 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x + w * BOUND - 1, y - 3, 2, h + 6);
    c.restore();
  }
}

/* Mossy, standing on the ground at (x, y), s tall. o: back (from behind,
   else facing us), flip (0..1: squashed sideways, turning round), hop
   (px up), crouch (0..1), sleep (0..1: eyes shut, snoring), wave (a paw
   up), run and step (its legs going), stretch (0..1: bounding, longer),
   tail (0..1: the tail curled up, scooping). */
export function drawMossy(c, x, y, s, t, o = {}){
  const w = s * 0.86, hop = o.hop || 0, crouch = o.crouch || 0, flip = o.flip ?? 1;
  const squash = 1 - crouch * 0.12 + (o.stretch || 0) * Math.min(0.08, hop / s * 0.4);
  const h = s * squash, by = y - hop, top = by - h, cy = by - h * 0.5;
  c.save();
  /* its shadow, on the ground under it */
  c.fillStyle = 'rgba(10,20,25,.28)';
  c.beginPath(); c.ellipse(x, y, w * (1.05 - Math.min(0.4, hop / s)), s * 0.1, 0, 0, Math.PI * 2); c.fill();
  c.translate(x, 0); c.scale(flip, 1); c.translate(-x, 0);
  const legs = (pairs) => {
    for (const [dx, sz, ph] of pairs){
      const up = Math.max(0, Math.sin((o.step || 0) + ph)) * s * 0.07 * (o.run || 0);
      const lx = x + dx * w, lw = s * 0.11 * sz, lh = s * 0.17 * sz;
      c.fillStyle = MOSSY.dark; c.beginPath(); c.roundRect(lx - lw, by - lh * 0.6 - up, lw * 2, lh, lw * 0.9); c.fill();
      c.fillStyle = MOSSY.belly; c.beginPath(); c.ellipse(lx, by + lh * 0.32 - up, lw * 0.75, lw * 0.35, 0, 0, Math.PI * 2); c.fill();
    }
  };
  const fluff = (col, rx, ry, n, r) => {
    c.fillStyle = col;
    for (let k = 0; k < n; k++){
      const a = (k / n) * Math.PI * 2;
      c.beginPath(); c.arc(x + Math.cos(a) * rx, cy + Math.sin(a) * ry, r * (0.85 + 0.3 * ((k * 5) % 3) / 2), 0, Math.PI * 2); c.fill();
    }
  };
  const sprout = (sx, sy) => {
    const sway = Math.sin(t * 2.2) * 0.25;
    c.strokeStyle = MOSSY.moss[1]; c.lineWidth = Math.max(1.5, s * 0.016); c.lineCap = 'round';
    const tx = sx + Math.sin(sway) * s * 0.16, ty = sy - s * 0.16;
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx, sy - s * 0.09, tx, ty); c.stroke();
    for (const d of [-1, 1]){
      c.fillStyle = MOSSY.leaf; c.beginPath(); c.ellipse(sx + d * s * 0.045, sy - s * 0.06, s * 0.05, s * 0.022, d * 0.5, 0, Math.PI * 2); c.fill();
    }
    glow(c, tx, ty, s * 0.11, MOSSY.bulb, 0.55 + 0.2 * Math.sin(t * 3));
    c.fillStyle = MOSSY.bulb; c.beginPath(); c.arc(tx, ty, s * 0.035, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffe1f4'; c.beginPath(); c.arc(tx - s * 0.01, ty - s * 0.012, s * 0.012, 0, Math.PI * 2); c.fill();
  };
  if (o.back){
    /* From behind: the back of its head, ears and sprout, peeking over;
       its legs; the big round fluffy back; moss; a pompom tail. */
    const hx = x, hy = top + h * 0.02;
    sprout(hx, hy - s * 0.17);
    for (const d of [-1, 1]){ c.fillStyle = MOSSY.shade; c.beginPath(); c.arc(hx + d * w * 0.33, hy - s * 0.13, s * 0.09, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = MOSSY.shade; c.beginPath(); c.ellipse(hx, hy - s * 0.04, w * 0.42, s * 0.15, 0, 0, Math.PI * 2); c.fill();
    legs([[-0.78, 0.8, 1], [0.78, 0.8, 1 + Math.PI], [-0.5, 1, Math.PI], [0.5, 1, 0]]);
    fluff(MOSSY.shade, w * 0.98, h * 0.48, 26, s * 0.07);
    const gr = c.createRadialGradient(x - w * 0.3, cy - h * 0.25, s * 0.05, x, cy, w * 1.05);
    gr.addColorStop(0, '#d6cbf4'); gr.addColorStop(0.55, MOSSY.fur); gr.addColorStop(1, MOSSY.shade);
    c.fillStyle = gr; c.beginPath(); c.ellipse(x, cy, w * 0.97, h * 0.5, 0, 0, Math.PI * 2); c.fill();
    /* moss patches and glowing freckles down its sides */
    c.fillStyle = MOSSY.moss[0];
    for (const [mx, my, mr] of [[-0.55, -0.15, 0.1], [0.6, -0.05, 0.08], [-0.25, 0.2, 0.07], [0.35, 0.25, 0.09]]){
      c.beginPath(); c.ellipse(x + mx * w, cy + my * h, mr * s, mr * s * 0.6, 0.3, 0, Math.PI * 2); c.fill();
    }
    for (let k = 0; k < 5; k++) for (const d of [-1, 1]){
      const fx = x + d * w * (0.82 - k * 0.05), fy = cy - h * 0.2 + k * h * 0.1;
      c.fillStyle = MOSSY.glow; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2 + k); c.beginPath(); c.arc(fx, fy, s * 0.012, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    /* the tail: a cream pompom - curled up and round, scooping */
    const curl = o.tail || 0, tx = x + curl * w * 0.7, ty = by - h * (0.28 + curl * 0.55), tr = s * 0.13;
    for (let k = 0; k < 9; k++){
      const a = k / 9 * Math.PI * 2 + t;
      c.fillStyle = k % 2 ? MOSSY.belly : '#fffaf0'; c.beginPath(); c.arc(tx + Math.cos(a) * tr * 0.6, ty + Math.sin(a) * tr * 0.6, tr * 0.55, 0, Math.PI * 2); c.fill();
    }
  } else {
    /* Facing us: round ears, the sprout, its tummy, its sleepy face. */
    for (const d of [-1, 1]){
      c.fillStyle = MOSSY.shade; c.beginPath(); c.arc(x + d * w * 0.5, top + s * 0.06, s * 0.13, 0, Math.PI * 2); c.fill();
      c.fillStyle = MOSSY.pink; c.beginPath(); c.arc(x + d * w * 0.5, top + s * 0.07, s * 0.07, 0, Math.PI * 2); c.fill();
    }
    legs([[-0.42, 1.1, 0], [0.42, 1.1, Math.PI]]);
    fluff(MOSSY.shade, w * 0.98, h * 0.48, 26, s * 0.07);
    const gr = c.createRadialGradient(x - w * 0.3, cy - h * 0.3, s * 0.05, x, cy, w * 1.05);
    gr.addColorStop(0, '#d6cbf4'); gr.addColorStop(0.55, MOSSY.fur); gr.addColorStop(1, MOSSY.shade);
    c.fillStyle = gr; c.beginPath(); c.ellipse(x, cy, w * 0.97, h * 0.5, 0, 0, Math.PI * 2); c.fill();
    sprout(x, top + s * 0.02);
    c.fillStyle = MOSSY.belly; c.beginPath(); c.ellipse(x, cy + h * 0.16, w * 0.58, h * 0.3, 0, 0, Math.PI * 2); c.fill();
    /* little paws: one up and waving, saying goodbye */
    for (const d of [-1, 1]){
      const waving = o.wave && d > 0, a = waving ? -2.5 + Math.sin(t * 9) * 0.4 : 0.35;
      c.save(); c.translate(x + d * w * 0.86, cy - h * (waving ? 0.08 : -0.02)); c.rotate(d * a);
      c.fillStyle = MOSSY.fur; c.strokeStyle = MOSSY.dark; c.lineWidth = Math.max(1.5, s * 0.012);
      c.beginPath(); c.ellipse(0, s * 0.1, s * 0.085, s * 0.15, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = MOSSY.belly; c.beginPath(); c.ellipse(0, s * 0.2, s * 0.06, s * 0.045, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    const sleep = o.sleep || 0, open = 1 - sleep, ey = top + h * 0.33;
    for (const d of [-1, 1]){
      const ex = x + d * w * 0.28, er = s * 0.085;
      if (open < 0.25){
        c.strokeStyle = INK; c.lineWidth = Math.max(2, s * 0.018); c.lineCap = 'round';
        c.beginPath(); c.arc(ex, ey - er * 0.3, er * 0.75, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke();
      } else {
        c.save(); c.translate(ex, ey); c.scale(1, open);
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, er, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2b2350'; c.beginPath(); c.arc(d * er * 0.08, er * 0.1, er * 0.66, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-er * 0.25, -er * 0.25, er * 0.24, 0, Math.PI * 2); c.fill();
        c.restore();
      }
      /* rosy cheeks, and glowing freckles */
      c.fillStyle = 'rgba(247,140,180,.55)'; c.beginPath(); c.ellipse(x + d * w * 0.5, ey + s * 0.1, s * 0.06, s * 0.035, 0, 0, Math.PI * 2); c.fill();
      for (let k = 0; k < 3; k++){ c.fillStyle = MOSSY.glow; c.beginPath(); c.arc(x + d * w * (0.44 + k * 0.06), ey + s * 0.03 - k * s * 0.012, s * 0.009, 0, Math.PI * 2); c.fill(); }
    }
    /* nose and a big smile */
    c.fillStyle = '#4a3a78'; c.beginPath(); c.ellipse(x, ey + s * 0.07, s * 0.03, s * 0.02, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#4a3a78'; c.lineWidth = Math.max(2, s * 0.016); c.lineCap = 'round';
    c.beginPath(); c.arc(x, ey + s * 0.07, s * 0.1 * (1 + open * 0.3), 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    /* zzz */
    if (sleep > 0.5){
      c.fillStyle = 'rgba(255,255,255,.9)'; c.textAlign = 'center';
      for (let k = 0; k < 3; k++){
        const f = (t * 0.5 + k / 3) % 1;
        c.globalAlpha = Math.sin(f * Math.PI) * (sleep - 0.5) * 2;
        c.font = `700 ${Math.round(s * (0.08 + f * 0.08))}px Fredoka, sans-serif`;
        c.fillText('z', x + w * (0.55 + f * 0.3), top - f * s * 0.35);
      }
      c.globalAlpha = 1;
    }
  }
  c.restore();
}

/* Mossy out in the world, rel ahead in lane: asleep across the path (before
   they reach it), or sat at the side waving goodbye (bye). */
export function worldMossy(c, W, H, rel, lane, t, bye = false){
  const p = P(lane, rel, W, H);
  drawMossy(c, p.x, p.y, H * SIZE * p.k, t, bye ? { wave: 1, crouch: 0.4 } : { sleep: 1 });
}
