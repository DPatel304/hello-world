/* The town the fire truck drives through, scrolling past in layers: far
   mountains barely moving, rolling hills, a row of houses and trees beyond
   the street, then the sidewalk with its lamp posts, fences and bushes, and
   the road under the wheels. The sky follows the same day as Pop Party's,
   morning light warming to golden afternoon over the round.

   Everything is placed by hashing its position along the street, so the
   town is endless, never the same twice in a round, and costs nothing to
   remember. The game says how far the truck has come (`dist`, in screen
   widths) and which stretches of sidewalk to keep clear for its stops. */
import { lighting } from './pop-party-scene.js';

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hash = (i, k = 1) => ((((i + 7919) * 2654435761 * k) % 4294967296) + 4294967296) % 4294967296 / 4294967296;

/* Where things stand, in screen heights. */
export const SIDEWALK = 0.84;   /* the back edge of the sidewalk: stops stand here */
export const CURB = 0.865;
export const ROAD = 0.95;       /* where the truck's wheels meet the road */

const CLOUDS = Array.from({ length: 7 }, (_, i) => ({ x: hash(i, 3) * 1.4, y: 0.06 + hash(i, 5) * 0.28, s: 0.6 + hash(i, 7) * 0.8 }));
const HOUSE_COLS = ['#f6d7b0', '#cfe3f0', '#f3c6c6', '#d8ecc8', '#fbe6a2', '#e3d4f2'].map(hex);
const ROOF_COLS = ['#c0504d', '#5b7fb5', '#7a5aa8', '#4f8f5f', '#d0703c'].map(hex);

export class Town {
  constructor(){
    this.t = 0; this.p = 0; this.dist = 0; this.clear = [];
    this.lite = false; this.frame = 1 / 60; this.slowFor = 0;
  }

  /* s: { t, p (round progress), dist, clear: [[from, to], ...] in world screen widths } */
  step(dt, s){
    this.t = s.t; this.p = s.p; this.dist = s.dist; this.clear = s.clear || [];
    this.frame += (dt - this.frame) * 0.05;
    this.slowFor = this.frame > 1 / 42 ? this.slowFor + dt : 0;
    if (this.slowFor > 3) this.lite = true;
  }

  _L(){ return lighting(0.1 + this.p * 0.75); }

  drawBack(c, W, H){
    const L = this._L();
    const tint = (col, haze = 0) => mix(mix(col, L.light, L.amt), L.low, haze);

    const sky = c.createLinearGradient(0, 0, 0, H * 0.75);
    sky.addColorStop(0, rgb(L.top)); sky.addColorStop(0.6, rgb(L.mid)); sky.addColorStop(1, rgb(L.low));
    c.fillStyle = sky; c.fillRect(0, 0, W, H);

    /* The sun, sinking slowly to the right over the round. */
    const sx = W * (0.3 + this.p * 0.5), sy = H * (0.16 + this.p * 0.22), sr = H * 0.06;
    if (!this.lite){
      const glow = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4);
      glow.addColorStop(0, rgb(mix(L.sun, [255, 255, 255], 0.4), 0.7)); glow.addColorStop(1, rgb(L.sun, 0));
      c.fillStyle = glow; c.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    }
    c.fillStyle = rgb(L.sun); c.beginPath(); c.arc(sx, sy, sr, 0, 6.2832); c.fill();

    for (const cl of CLOUDS){
      const span = 1.6, x = ((((cl.x - this.dist * 0.03 - this.t * 0.004) % span) + span) % span - 0.3) * W;
      puff(c, x, cl.y * H, H * 0.09 * cl.s, rgb(L.cloud, 0.92));
    }

    /* Far mountains, then the hills: endless ridges from a few sines. */
    this._ridge(c, W, H, 0.04, 0.6, 0.09, [0.9, 2.3, 5.1], rgb(tint(hex('#8fa9d6'), 0.45)));
    this._ridge(c, W, H, 0.1, 0.7, 0.06, [1.7, 3.9, 7.3], rgb(tint(hex('#7fc58a'), 0.35)));
    this._ridge(c, W, H, 0.18, 0.75, 0.05, [2.6, 5.4, 9.1], rgb(tint(hex('#68b577'), 0.2)));

    this._row(c, W, H, L, tint);

    /* Grass verge, sidewalk, curb. */
    c.fillStyle = rgb(tint(hex('#6cbf6f'))); c.fillRect(0, H * 0.79, W, H * (SIDEWALK - 0.79) + 1);
    c.fillStyle = rgb(tint(hex('#e6dfd0'))); c.fillRect(0, H * SIDEWALK, W, H * (CURB - SIDEWALK));
    c.strokeStyle = rgb(tint(hex('#cbc2b0'))); c.lineWidth = Math.max(1, H * 0.002);
    c.beginPath();
    const slab = 0.09, off = ((this.dist / slab) % 1) * slab;
    for (let x = -off; x < 1.05; x += slab){ c.moveTo(x * W, H * SIDEWALK); c.lineTo(x * W - H * 0.012, H * CURB); }
    c.stroke();
    c.fillStyle = rgb(tint(hex('#c9c1b2'))); c.fillRect(0, H * CURB, W, H * 0.014);

    this._props(c, W, H, tint);
  }

  drawRoad(c, W, H){
    const L = this._L();
    const road = c.createLinearGradient(0, H * (CURB + 0.014), 0, H);
    road.addColorStop(0, rgb(mix(hex('#6a6e7c'), L.light, L.amt * 0.5))); road.addColorStop(1, '#4d5160');
    c.fillStyle = road; c.fillRect(0, H * (CURB + 0.014), W, H);
    c.fillStyle = 'rgba(255,240,190,.85)';
    const dash = 0.16, off = ((this.dist / dash) % 1) * dash;
    for (let x = -off; x < 1.05; x += dash) c.fillRect(x * W, H * 0.972, W * dash * 0.5, H * 0.009);
  }

  /* The row of houses and trees across the street, a little hazy. */
  _row(c, W, H, L, tint){
    const k = 0.4, step = 0.22, from = Math.floor((this.dist * k - 0.3) / step), base = H * 0.79;
    for (let i = from; i < from + 8; i++){
      const x = (i * step - this.dist * k) * W, kind = hash(i, 11);
      if (kind < 0.55){
        const w = H * (0.13 + hash(i, 13) * 0.06), h = H * (0.09 + hash(i, 17) * 0.05);
        const wall = tint(HOUSE_COLS[(hash(i, 19) * HOUSE_COLS.length) | 0], 0.3);
        const roof = tint(ROOF_COLS[(hash(i, 23) * ROOF_COLS.length) | 0], 0.3);
        c.fillStyle = rgb(wall); c.fillRect(x - w / 2, base - h, w, h);
        c.fillStyle = rgb(roof);
        c.beginPath(); c.moveTo(x - w * 0.58, base - h); c.lineTo(x, base - h - w * 0.38); c.lineTo(x + w * 0.58, base - h); c.closePath(); c.fill();
        c.fillStyle = rgb(tint(hex('#fff3c8'), 0.25));
        for (const fx of [-0.25, 0.25]) c.fillRect(x + fx * w - w * 0.07, base - h * 0.7, w * 0.14, h * 0.25);
      } else {
        const s = H * (0.08 + hash(i, 29) * 0.05), sway = Math.sin(this.t * 1.2 + i) * s * 0.02;
        c.fillStyle = rgb(tint(hex('#7a5434'), 0.3)); c.fillRect(x - s * 0.06, base - s * 0.6, s * 0.12, s * 0.6);
        c.fillStyle = rgb(tint(hex('#4fa863'), 0.3));
        c.beginPath(); c.arc(x + sway, base - s * 0.85, s * 0.42, 0, 6.2832); c.arc(x - s * 0.25 + sway, base - s * 0.65, s * 0.3, 0, 6.2832); c.arc(x + s * 0.27 + sway, base - s * 0.66, s * 0.3, 0, 6.2832); c.fill();
      }
    }
  }

  /* Things along the sidewalk, scrolling at the truck's own speed: lamp posts,
     picket fences, bushes and the odd mailbox. Kept out of the stops' way. */
  _props(c, W, H, tint){
    const step = 0.17, from = Math.floor((this.dist - 0.2) / step), base = H * SIDEWALK;
    for (let i = from; i < from + 9; i++){
      const wx = i * step + hash(i, 31) * 0.05;
      if (this.clear.some(([a, b]) => wx > a && wx < b)) continue;
      const x = (wx - this.dist) * W, kind = hash(i, 37);
      if (kind < 0.25){
        /* Lamp post. */
        c.fillStyle = rgb(tint(hex('#3e4a5c')));
        c.fillRect(x - H * 0.005, base - H * 0.3, H * 0.01, H * 0.3);
        c.beginPath(); c.roundRect(x - H * 0.022, base - H * 0.335, H * 0.044, H * 0.04, H * 0.01); c.fill();
        c.fillStyle = 'rgba(255,240,190,.9)'; c.beginPath(); c.arc(x, base - H * 0.31, H * 0.012, 0, 6.2832); c.fill();
      } else if (kind < 0.55){
        /* A run of white picket fence. */
        c.fillStyle = rgb(tint(hex('#fbfaf5')));
        const n = 7, gap = H * 0.028;
        c.fillRect(x - gap * n / 2, base - H * 0.045, gap * n, H * 0.008);
        for (let k = 0; k < n; k++){
          const px = x - gap * n / 2 + k * gap + gap * 0.2;
          c.beginPath(); c.moveTo(px, base); c.lineTo(px, base - H * 0.06); c.lineTo(px + gap * 0.3, base - H * 0.072); c.lineTo(px + gap * 0.6, base - H * 0.06); c.lineTo(px + gap * 0.6, base); c.closePath(); c.fill();
        }
      } else if (kind < 0.85){
        /* A round bush, sometimes in flower. */
        const r = H * (0.03 + hash(i, 41) * 0.02);
        c.fillStyle = rgb(tint(hex('#3d8a50')));
        c.beginPath(); c.arc(x, base - r * 0.6, r, 0, 6.2832); c.arc(x - r * 0.8, base - r * 0.4, r * 0.75, 0, 6.2832); c.arc(x + r * 0.8, base - r * 0.4, r * 0.75, 0, 6.2832); c.fill();
        if (hash(i, 43) < 0.5){
          c.fillStyle = ['#ff7aa8', '#ffd24a', '#ffffff'][(hash(i, 47) * 3) | 0];
          for (let k = 0; k < 5; k++){ c.beginPath(); c.arc(x + (hash(i * 5 + k, 53) - 0.5) * r * 2, base - r * (0.3 + hash(i * 5 + k, 59)), r * 0.13, 0, 6.2832); c.fill(); }
        }
      } else {
        /* A mailbox. */
        c.fillStyle = rgb(tint(hex('#7a5434'))); c.fillRect(x - H * 0.004, base - H * 0.06, H * 0.008, H * 0.06);
        c.fillStyle = rgb(tint(hex('#4a7bd1')));
        c.beginPath(); c.roundRect(x - H * 0.022, base - H * 0.085, H * 0.044, H * 0.028, H * 0.012); c.fill();
        c.fillStyle = '#ff5d5d'; c.fillRect(x + H * 0.016, base - H * 0.1, H * 0.004, H * 0.02);
      }
    }
  }

  _ridge(c, W, H, k, y, amp, freqs, col){
    const off = this.dist * k;
    c.fillStyle = col;
    c.beginPath(); c.moveTo(0, H);
    for (let i = 0; i <= 48; i++){
      const u = i / 48, wx = u + off;
      const h = freqs.reduce((sum, f, j) => sum + Math.sin(wx * f * 3.1 + j * 1.7) / (j + 1), 0);
      c.lineTo(u * W, H * (y - amp * (0.6 + 0.4 * h)));
    }
    c.lineTo(W, H); c.closePath(); c.fill();
  }
}

function puff(c, x, y, w, col){
  c.fillStyle = col;
  c.beginPath();
  for (const [dx, dy, r] of [[0, 0, 0.42], [-0.45, 0.12, 0.3], [0.45, 0.12, 0.32], [-0.2, -0.15, 0.32], [0.22, -0.1, 0.3]]){
    c.moveTo(x + dx * w + r * w, y + dy * w); c.arc(x + dx * w, y + dy * w, r * w, 0, 6.2832);
  }
  c.moveTo(x + w * 0.72, y + w * 0.2); c.ellipse(x, y + w * 0.2, w * 0.72, w * 0.2, 0, 0, 6.2832);
  c.fill();
}
