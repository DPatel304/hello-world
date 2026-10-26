import { sfx } from '../audio/sound.js';

/* The world Pop Party happens in. The game owns the balloons; this owns
   everything around them, and is told just enough to react:

   - the round's progress, which moves the sun from morning to sunset and
     brings the storm in at dusk;
   - the wind, which the trees and grass lean into;
   - how well someone is doing, which makes the sun grin;
   - where the players stand, which shifts the layers a little against each
     other, like looking through a window;
   - every pop, which grows a flower of that colour in the meadow.

   drawBack paints what sits behind the balloons, drawFront the grass,
   flowers and weather in front of them. Nothing here is an image file, and
   the per-frame cost is kept to a few dozen shapes plus a couple of batched
   strokes, since the pose model is sharing the same laptop. */

const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const BLACK = [0, 0, 0];

/* Time of day across the round, by progress 0..1, then the storm laid over
   the top. light/amt tint the ground; dark dims it. */
const DAY = [
  { p:0,    top:'#5ab8ff', mid:'#a8dcff', low:'#ffe9cf', light:'#ffe2c8', amt:0.10, dark:0.00, sun:'#fff1b0', cloud:'#ffffff' },
  { p:0.35, top:'#2f9bf5', mid:'#7cc9ff', low:'#d6f1ff', light:'#ffffff', amt:0.00, dark:0.00, sun:'#fff4b8', cloud:'#ffffff' },
  { p:0.72, top:'#3a74d6', mid:'#f2b07a', low:'#ffd98a', light:'#ffb35c', amt:0.22, dark:0.04, sun:'#ffd36b', cloud:'#ffeedd' },
  { p:1,    top:'#2a2f78', mid:'#e0668c', low:'#ffad66', light:'#ff7a5c', amt:0.30, dark:0.20, sun:'#ff9a55', cloud:'#ffc8b4' }
].map(k => ({ ...k, ...Object.fromEntries(['top','mid','low','light','sun','cloud'].map(f => [f, hex(k[f])])) }));
const STORM = { top:hex('#14162e'), mid:hex('#33355a'), low:hex('#5d6185'), light:hex('#3a4170'),
                amt:0.45, dark:0.38, sun:hex('#ff9a55'), cloud:hex('#5a5e80') };

export function lighting(p, storm){
  let i = 0;
  while (i < DAY.length - 2 && p > DAY[i + 1].p) i++;
  const a = DAY[i], b = DAY[i + 1], t = Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p)));
  const L = {};
  for (const f of ['top','mid','low','light','sun','cloud']) L[f] = mix(mix(a[f], b[f], t), STORM[f], storm);
  for (const f of ['amt','dark']) L[f] = a[f] + (b[f] - a[f]) * t + (STORM[f] - (a[f] + (b[f] - a[f]) * t)) * storm;
  return L;
}

const GROUND = {
  hills: ['#7fcf86', '#5fbb70', '#48a65d'].map(hex),
  trunk: hex('#7a5434'), leaf: hex('#3d9a55'), leafLit: hex('#5cbc6c'),
  grass: [hex('#3f9a52'), hex('#6cc874')],
  farPeak: hex('#9db7e0'), nearPeak: hex('#6f93b8')
};

/* Deterministic scatter, so the landscape holds still between frames. */
const hash = (i, k = 1) => (((i + 1) * 2654435761 * k) % 4294967296) / 4294967296;

const PEAKS_FAR  = Array.from({ length: 11 }, (_, i) => ({ x: -0.1 + i * 0.12 + hash(i, 3) * 0.05, y: 0.47 + hash(i, 5) * 0.12 }));
const PEAKS_NEAR = Array.from({ length: 9 },  (_, i) => ({ x: -0.12 + i * 0.16 + hash(i, 7) * 0.06, y: 0.58 + hash(i, 11) * 0.08 }));
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({
  seed: (i * 0.618) % 1, y: 0.06 + ((i * 0.37) % 1) * 0.36,
  s: i % 3 === 0 ? 1.4 : (i % 3 === 1 ? 1 : 0.65), speed: i % 3 === 0 ? 0.012 : (i % 3 === 1 ? 0.008 : 0.005)
}));
const TREES = [[0.07,0.775,0.7,0],[0.17,0.85,0.95,1],[0.30,0.785,0.6,0],[0.70,0.845,0.85,1],[0.86,0.775,0.65,0],[0.95,0.855,0.95,1]];
const TUFTS = Array.from({ length: 44 }, (_, i) => ({ x: -0.06 + hash(i, 13) * 1.12, y: 0.935 + hash(i, 17) * 0.065,
                                                       h: 0.022 + hash(i, 19) * 0.022, ph: hash(i, 23) * 6.28 }));
/* Each band of hills fades toward the horizon's colour by its haze: the
   way distance looks, and what lets the bright balloons sit in front. */
const HILLS = [{ y:0.74, h:0.07, n:3, depth:0.03, haze:0.40 },
               { y:0.82, h:0.10, n:4, depth:0.042, haze:0.20 },
               { y:0.90, h:0.14, n:3, depth:0.055, haze:0.04 }];
const FRONT = 0.055;

export class Scene {
  constructor(){
    this.t = 0; this.p = 0; this.storm = 0; this.wind = 0; this.joy = 0; this.look = 0;
    this.flash = 0; this.bolt = null; this.boltT = 1.5;
    this.flowers = [];
    this.flock = null; this.nextFlock = 6 + Math.random() * 10;
    this.butterflies = Array.from({ length: 3 }, (_, i) => ({
      x: 0.2 + i * 0.3, y: 0.8, vx: 0.04, vy: 0, hue: [320, 45, 190][i], ph: i * 2 }));
    this.leaves = Array.from({ length: 34 }, () => this._leaf(true));
    this.rainbow = 0;
    /* One unprompted rainbow a round, besides the parade's. */
    this.rainbowAt = 70 + Math.random() * 140;
    /* Lite mode: if the laptop can't keep up - the pose model shares it -
       the scene sheds its extras for the rest of the round rather than let
       the game stutter. It never switches back, so it can't flicker. */
    this.lite = false; this.frame = 1 / 60; this.slowFor = 0;
  }

  /* s: { t, p, storm (bool), wind, joy 0..1, look 0..1, rainbow (bool) } */
  step(dt, s){
    this.t = s.t; this.p = Math.min(1, s.p);
    this.frame += (dt - this.frame) * 0.05;
    this.slowFor = this.frame > 1 / 42 ? this.slowFor + dt : 0;
    if (this.slowFor > 3) this.lite = true;
    this.storm += ((s.storm ? 1 : 0) - this.storm) * Math.min(1, dt * 0.7);
    this.joy += (s.joy - this.joy) * Math.min(1, dt * 3);
    /* Eased hard, so a lunge for a balloon nudges the world rather than
       swinging it; plus a slow drift so it never sits dead still. */
    this.look += ((s.look - 0.5) - this.look) * Math.min(1, dt * 1.5);
    const gust = this.storm * (1.6 + Math.sin(this.t * 3.1) * 0.7 + Math.sin(this.t * 7.3) * 0.3);
    this.wind = s.wind / 0.022 + gust;

    const wantBow = s.rainbow || (this.t >= this.rainbowAt && this.t < this.rainbowAt + 25);
    this.rainbow += ((wantBow && this.storm < 0.3 ? 0.42 : 0) - this.rainbow) * Math.min(1, dt * 0.8);

    for (const f of this.flowers) f.age += dt;
    if (this.flowers.length > 60) this.flowers.splice(0, this.flowers.length - 60);

    if (this.flock){
      this.flock.x += this.flock.dir * this.flock.speed * dt;
      if (this.flock.dir > 0 ? this.flock.x > 1.2 : this.flock.x < -0.2) this.flock = null;
    } else if (this.storm < 0.2 && (this.nextFlock -= dt) <= 0){
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.flock = { dir, x: dir > 0 ? -0.15 : 1.15, y: 0.12 + Math.random() * 0.22, speed: 0.055 + Math.random() * 0.03 };
      this.nextFlock = 18 + Math.random() * 22;
    }

    for (const b of this.butterflies){
      b.vx += (Math.random() - 0.5) * dt * 0.8; b.vy += (Math.random() - 0.5) * dt * 0.8;
      b.vx = Math.max(-0.07, Math.min(0.07, b.vx)); b.vy = Math.max(-0.05, Math.min(0.05, b.vy));
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < 0.04 || b.x > 0.96) b.vx *= -1;
      if (b.y < 0.74 || b.y > 0.92) b.vy *= -1;
      b.x = Math.max(0.04, Math.min(0.96, b.x)); b.y = Math.max(0.74, Math.min(0.92, b.y));
    }

    if (this.storm > 0.3) for (const l of this.leaves){
      l.x -= l.vx * dt * (0.6 + this.storm); l.y += (l.vy + Math.sin(this.t * 3 + l.ph) * 0.08) * dt;
      l.rot += l.vr * dt;
      if (l.x < -0.05 || l.y > 1.05) Object.assign(l, this._leaf(false));
    }

    /* Lightning, once the storm has properly arrived. */
    this.flash *= Math.pow(0.002, dt);
    if (this.storm > 0.6 && (this.boltT -= dt) <= 0){
      this.boltT = 1.8 + Math.random() * 2.6;
      this.flash = 1;
      const x0 = 0.15 + Math.random() * 0.7, pts = [[x0, 0.05]];
      for (let y = 0.05; y < 0.66; y += 0.07) pts.push([pts[pts.length - 1][0] + (Math.random() - 0.5) * 0.06, y + 0.07]);
      this.bolt = pts;
      sfx.thunder(0.15 + Math.random() * 0.4);
    }
  }

  _leaf(scatter){
    return { x: scatter ? Math.random() * 1.1 : 1.05 + Math.random() * 0.1, y: Math.random() * 0.8,
             vx: 0.35 + Math.random() * 0.35, vy: 0.04 + Math.random() * 0.08,
             rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9, ph: Math.random() * 6,
             col: ['#d98b2b', '#e7b13a', '#7cb342', '#c0562c'][(Math.random() * 4) | 0] };
  }

  /* A flower comes up in the meadow under every pop, in the balloon's
     colour. Over five minutes the meadow becomes a record of the round. */
  pop(x, hue){
    this.flowers.push({ x: Math.max(0.02, Math.min(0.98, x + (Math.random() - 0.5) * 0.04)),
                        y: 0.905 + Math.random() * 0.075, hue, age: 0, s: 0.8 + Math.random() * 0.5 });
  }

  _shift(depth, W){ return -(this.look + Math.sin(this.t * 0.04) * 0.08) * depth * W; }

  drawBack(c, W, H){
    const L = lighting(this.p, this.storm);
    const ground = (base) => mix(mix(base, L.light, L.amt), BLACK, L.dark);

    const sky = c.createLinearGradient(0, 0, 0, H * 0.8);
    sky.addColorStop(0, rgb(L.top)); sky.addColorStop(0.55, rgb(L.mid)); sky.addColorStop(1, rgb(L.low));
    c.fillStyle = sky; c.fillRect(0, 0, W, H);

    this._sun(c, W, H, L);
    this._clouds(c, W, H, L, 0, 0.8);
    if (this.storm > 0.02) this._stormClouds(c, W, H);
    if (this.rainbow > 0.01) this._rainbow(c, W, H);
    this._mountains(c, W, H, L, ground);
    this._mist(c, W, H, L, 0.5, 0.76, 0.6);
    if (this.flock) this._birds(c, W, H);
    if (this.bolt && this.flash > 0.25) this._bolt(c, W, H);
    this._clouds(c, W, H, L, 0.8, 9);
    this._hills(c, W, H, ground, L);
  }

  drawFront(c, W, H){
    const L = lighting(this.p, this.storm);
    const ground = (base) => mix(mix(base, L.light, L.amt), BLACK, L.dark);
    if (!this.lite) this._grass(c, W, H, ground);
    this._flowers(c, W, H);
    if (!this.lite && this.storm < 0.95) this._butterflies(c, W, H);
    if (this.storm > 0.3) this._leaves(c, W, H);
    if (this.flash > 0.02){
      c.fillStyle = `rgba(235,240,255,${this.flash * 0.45})`;
      c.fillRect(0, 0, W, H);
    }
  }

  /* ---------- layers ---------- */

  _sun(c, W, H, L){
    const vis = 1 - this.storm;
    if (vis < 0.02) return;
    /* Rises on the left, high at midday, low on the right by sunset. */
    const sx = W * (0.12 + this.p * 0.76) + this._shift(0.01, W);
    const sy = H * (0.62 - Math.sin(Math.PI * (0.1 + 0.8 * this.p)) * 0.48);
    const sr = H * 0.065 * (1 + this.joy * 0.12);
    c.globalAlpha = vis;
    /* The glow is a gradient worked out for every pixel it covers, so it
       covers only where it can be seen, and lite mode goes without. */
    if (!this.lite){
      const glow = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4);
      glow.addColorStop(0, rgb(mix(L.sun, [255, 255, 255], 0.4), 0.75));
      glow.addColorStop(1, rgb(L.sun, 0));
      c.fillStyle = glow; c.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    }

    c.save(); c.translate(sx, sy); c.rotate(this.t * (0.08 + this.joy * 0.5));
    c.fillStyle = rgb(mix(L.sun, [255, 255, 255], 0.3), 0.22 + this.joy * 0.15);
    const len = sr * (4.2 + this.joy * 1.8);
    c.beginPath();
    for (let i = 0; i < 12; i++){
      const a = i * Math.PI / 6, ca = Math.cos(a), sa = Math.sin(a);
      c.moveTo(0, 0);
      c.lineTo(len * ca + sr * 0.35 * sa, len * sa - sr * 0.35 * ca);
      c.lineTo(len * ca - sr * 0.35 * sa, len * sa + sr * 0.35 * ca);
      c.closePath();
    }
    c.fill();
    c.restore();

    c.fillStyle = rgb(L.sun);
    c.beginPath(); c.arc(sx, sy, sr, 0, 6.2832); c.fill();
    /* A face, which grins wider as the room does better. */
    const ink = 'rgba(120,70,20,.75)';
    c.fillStyle = ink;
    const blink = (this.t % 4.3) < 0.12 ? 0.15 : 1;
    for (const ex of [-0.32, 0.32]){
      c.beginPath(); c.ellipse(sx + ex * sr, sy - sr * 0.15, sr * 0.09, sr * 0.13 * blink, 0, 0, 6.2832); c.fill();
    }
    c.strokeStyle = ink; c.lineWidth = Math.max(2, sr * 0.08); c.lineCap = 'round';
    const grin = 0.35 + this.joy * 0.25;
    c.beginPath(); c.arc(sx, sy + sr * 0.05, sr * grin, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    if (this.joy > 0.05){
      c.fillStyle = `rgba(255,120,120,${0.45 * this.joy})`;
      for (const ex of [-0.55, 0.55]){ c.beginPath(); c.arc(sx + ex * sr, sy + sr * 0.2, sr * 0.14, 0, 6.2832); c.fill(); }
    }
    c.globalAlpha = 1;
  }

  _clouds(c, W, H, L, from, to){
    const col = rgb(L.cloud);
    for (const cl of [...CLOUDS].sort((a, b) => a.s - b.s)){
      if (cl.s < from || cl.s >= to) continue;
      const w = H * 0.22 * cl.s;
      const x = ((cl.seed + this.t * cl.speed * (1 + Math.max(0, this.wind) * 0.4)) % 1) * (W + w * 2) - w
                + this._shift(0.012 * cl.s, W);
      cloud(c, x, H * cl.y, w, col, 0.55 + cl.s * 0.3);
    }
  }

  _stormClouds(c, W, H){
    const col = `rgba(40,42,70,${0.9 * this.storm})`;
    for (let i = 0; i < 7; i++){
      const w = H * (0.42 + hash(i, 29) * 0.25);
      const x = ((hash(i, 31) + this.t * 0.03) % 1) * (W + w * 2) - w;
      const y = H * (0.02 + hash(i, 37) * 0.18) - (1 - this.storm) * H * 0.3;
      cloud(c, x, y, w, col, 1);
    }
  }

  _rainbow(c, W, H){
    const cx = W * 0.5 + this._shift(0.012, W), cy = H * 0.86, r0 = H * 0.62, band = H * 0.018;
    const cols = ['#ff4d4d', '#ff9a3c', '#ffe14d', '#5fd36b', '#4dabff', '#5b6cff', '#b05bff'];
    c.lineWidth = band;
    c.globalAlpha = this.rainbow;
    cols.forEach((col, i) => {
      c.strokeStyle = col;
      c.beginPath(); c.arc(cx, cy, r0 - i * band, Math.PI, 2 * Math.PI); c.stroke();
    });
    c.globalAlpha = 1;
  }

  _mountains(c, W, H, L, ground){
    for (const [peaks, base, haze, depth, snow] of [[PEAKS_FAR, GROUND.farPeak, 0.7, 0.012, true],
                                                    [PEAKS_NEAR, GROUND.nearPeak, 0.5, 0.02, false]]){
      const dx = this._shift(depth, W);
      const col = ground(mix(base, L.low, haze));
      c.fillStyle = rgb(col);
      c.beginPath(); c.moveTo(-W * 0.2, H * 0.8);
      for (let i = 0; i < peaks.length; i++){
        const p = peaks[i], q = peaks[i + 1];
        c.lineTo(p.x * W + dx, p.y * H);
        if (q) c.lineTo(((p.x + q.x) / 2) * W + dx, Math.max(p.y, q.y) * H + H * 0.06);
      }
      c.lineTo(W * 1.2, H * 0.8); c.closePath(); c.fill();
      if (snow){
        c.fillStyle = rgb(mix([255, 255, 255], col, 0.5));
        for (const p of peaks){
          if (p.y > 0.52) continue;
          const x = p.x * W + dx, y = p.y * H, w = H * 0.025;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x - w, y + w * 0.9); c.lineTo(x + w, y + w * 0.9); c.closePath(); c.fill();
        }
      }
    }
  }

  /* A band of haze in the horizon's colour, thickest near its bottom edge. */
  _mist(c, W, H, L, from, to, strength){
    const g = c.createLinearGradient(0, H * from, 0, H * to);
    g.addColorStop(0, rgb(L.low, 0));
    g.addColorStop(0.75, rgb(L.low, strength));
    g.addColorStop(1, rgb(L.low, 0));
    c.fillStyle = g; c.fillRect(0, H * from, W, H * (to - from));
  }

  _birds(c, W, H){
    const f = this.flock, w = H * 0.013;
    const pos = [[0, 0], [-1, -1], [-1, 1], [-2, -2], [-2, 2]];
    c.strokeStyle = 'rgba(40,40,70,.45)'; c.lineWidth = Math.max(1.5, H * 0.0024); c.lineCap = 'round';
    c.beginPath();
    pos.forEach(([bx, by], i) => {
      const x = f.x * W + f.dir * bx * W * 0.03 + this._shift(0.01, W), y = f.y * H + by * H * 0.025;
      const flap = Math.sin(this.t * 9 + i * 0.8) * w * 0.6;
      c.moveTo(x - w, y - flap); c.quadraticCurveTo(x - w * 0.5, y - w * 0.4, x, y);
      c.quadraticCurveTo(x + w * 0.5, y - w * 0.4, x + w, y - flap);
    });
    c.stroke();
  }

  _bolt(c, W, H){
    c.strokeStyle = `rgba(255,255,230,${Math.min(1, this.flash * 1.3)})`;
    c.lineWidth = Math.max(3, H * 0.006); c.lineJoin = 'round';
    c.beginPath();
    this.bolt.forEach(([x, y], i) => i ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H));
    c.stroke();
  }

  _hills(c, W, H, ground, L){
    HILLS.forEach((band, b) => {
      const dx = this._shift(band.depth, W), m = W * 0.08;
      const far = (col) => rgb(mix(ground(col), L.low, band.haze));
      c.fillStyle = far(GROUND.hills[b]);
      c.beginPath(); c.moveTo(-m + dx, H); c.lineTo(-m + dx, H * band.y);
      const span = (W + m * 2) / band.n;
      for (let i = 0; i < band.n; i++){
        const x0 = -m + dx + i * span;
        c.quadraticCurveTo(x0 + span * 0.5, H * (band.y - band.h * 0.5), x0 + span, H * band.y);
      }
      c.lineTo(W + m + dx, H); c.closePath(); c.fill();

      /* The trees standing on this band, swaying with the wind. */
      for (const [fx, fy, fs, onBand] of TREES){
        if (onBand !== b) continue;
        const x = W * fx + dx, y = H * fy, sc = (H / 900) * fs;
        const sway = (Math.sin(this.t * 1.3 + fx * 20) * 0.25 + this.wind * 0.5) * 6 * sc;
        c.fillStyle = far(GROUND.trunk); c.fillRect(x - 5 * sc, y, 10 * sc, 42 * sc);
        c.fillStyle = far(GROUND.leaf);
        c.beginPath(); c.arc(x + sway, y - 10 * sc, 34 * sc, 0, 6.2832); c.fill();
        c.fillStyle = far(GROUND.leafLit);
        c.beginPath(); c.arc(x + sway * 1.3 - 10 * sc, y - 22 * sc, 22 * sc, 0, 6.2832); c.fill();
      }
      /* A thinner veil of mist between the far hills and the nearer ones. */
      if (b === 0) this._mist(c, W, H, L, 0.7, 0.84, 0.3);
    });
  }

  _grass(c, W, H, ground){
    const dx = this._shift(FRONT, W);
    c.lineCap = 'round'; c.lineWidth = Math.max(2, H * 0.004);
    GROUND.grass.forEach((col, k) => {
      c.strokeStyle = rgb(ground(col));
      c.beginPath();
      TUFTS.forEach((tf, i) => {
        if (i % 2 !== k) return;
        const x = tf.x * W + dx, y = tf.y * H, h = tf.h * H;
        const bend = (this.wind * 0.35 + Math.sin(this.t * 2.2 + tf.ph) * 0.18) * h;
        for (const off of [-0.35, 0, 0.35]){
          c.moveTo(x + off * h * 0.4, y);
          c.quadraticCurveTo(x + off * h * 0.5 + bend * 0.3, y - h * 0.6, x + off * h * 0.7 + bend, y - h * (0.9 + Math.abs(off) * -0.2));
        }
      });
      c.stroke();
    });
  }

  /* Batched: one stroke for every stem, one fill per flower for its petals,
     one fill for every centre. Sixty flowers is otherwise four hundred
     separate shapes a frame. */
  _flowers(c, W, H){
    const dx = this._shift(FRONT, W), heads = [];
    c.strokeStyle = '#3c8f4c'; c.lineWidth = Math.max(1.5, H * 0.0025);
    c.beginPath();
    for (const f of this.lite ? this.flowers.slice(-25) : this.flowers){
      const grow = Math.min(1, f.age / 0.5), x = f.x * W + dx, y = f.y * H;
      const stem = H * 0.03 * f.s * grow, r = H * 0.008 * f.s * Math.min(1, Math.max(0, (f.age - 0.25) / 0.35));
      const lean = (this.wind * 0.15 + Math.sin(this.t * 2 + f.x * 30) * 0.08) * stem;
      c.moveTo(x, y); c.quadraticCurveTo(x, y - stem * 0.6, x + lean, y - stem);
      if (r > 0) heads.push([x + lean, y - stem, r, f]);
    }
    c.stroke();
    for (const [hx, hy, r, f] of heads){
      c.fillStyle = `hsl(${f.hue} 85% 65%)`;
      c.beginPath();
      for (let i = 0; i < 5; i++){
        const a = i * 1.2566 + f.x * 7, px = hx + Math.cos(a) * r, py = hy + Math.sin(a) * r;
        c.moveTo(px + r * 0.75, py); c.arc(px, py, r * 0.75, 0, 6.2832);
      }
      c.fill();
    }
    c.fillStyle = '#ffe066';
    c.beginPath();
    for (const [hx, hy, r] of heads){ c.moveTo(hx + r * 0.55, hy); c.arc(hx, hy, r * 0.55, 0, 6.2832); }
    c.fill();
  }

  _butterflies(c, W, H){
    const dx = this._shift(FRONT, W), s = H * 0.016;
    c.globalAlpha = 1 - this.storm;
    for (const b of this.butterflies){
      const x = b.x * W + dx, y = b.y * H, flap = Math.abs(Math.sin(this.t * 16 + b.ph));
      c.fillStyle = `hsl(${b.hue} 85% 68%)`;
      for (const side of [-1, 1]){
        c.beginPath(); c.ellipse(x + side * s * 0.6 * flap, y - s * 0.3, s * 0.65 * flap + 0.5, s * 0.8, side * 0.4, 0, 6.2832); c.fill();
        c.beginPath(); c.ellipse(x + side * s * 0.45 * flap, y + s * 0.45, s * 0.45 * flap + 0.5, s * 0.5, -side * 0.4, 0, 6.2832); c.fill();
      }
      c.fillStyle = '#3b2a4a';
      c.fillRect(x - s * 0.08, y - s * 0.7, s * 0.16, s * 1.4);
    }
    c.globalAlpha = 1;
  }

  _leaves(c, W, H){
    c.globalAlpha = Math.min(1, (this.storm - 0.3) * 2);
    const s = H * 0.012;
    for (const l of this.leaves){
      c.save(); c.translate(l.x * W, l.y * H); c.rotate(l.rot);
      c.fillStyle = l.col;
      c.beginPath(); c.ellipse(0, 0, s, s * 0.5, 0, 0, 6.2832); c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
  }
}

function cloud(c, x, y, w, col, alpha){
  c.globalAlpha = alpha;
  c.fillStyle = col;
  c.beginPath();
  c.ellipse(x, y, w * 0.5, w * 0.16, 0, 0, 6.2832);
  c.arc(x - w * 0.2, y - w * 0.06, w * 0.17, 0, 6.2832);
  c.arc(x + w * 0.02, y - w * 0.13, w * 0.22, 0, 6.2832);
  c.arc(x + w * 0.24, y - w * 0.04, w * 0.15, 0, 6.2832);
  c.fill();
  c.globalAlpha = 1;
}
