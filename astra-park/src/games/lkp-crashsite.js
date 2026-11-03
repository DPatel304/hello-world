/* Last Known Position - the crash site, where Level 1 begins. One layout,
   SITE, in the game's own ground coordinates ([lane, depth (rel)]): the
   opening (lkp-intro.js) films it from the game's own view, framed by a
   camera, and play starts in exactly the same place - so nothing moves
   between shots.

   From above, looking north up the path (lane 0 runs away from us; rel is
   how far ahead, 0 at our feet, 1 at the haze):

         rel
         0.5   SHIP (toppled, smoking)        | path |
         0.42      wreck piece                |      |
         0.3     crew out cold                |      |
         0.2     crew out cold                |      |     POND
         0.03                          crew start places on the path
              lane -3.7 ......... -1.15       0      1.15 ...... 2.0

   L is the level's world palette. */
import { P } from './lkp-art.js';
import { glow, mix, rgba } from './lkp-world.js';

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, 6.2832); c.fill(); };

/* Where everything is: [lane, rel, size]. lying: where each of the crew
   comes down, out cold, on the grass between the ship and the path (in
   order: the first of them nearest). pond: their places in the water
   are spread round its middle, `spread` lanes apart. */
export const SITE = {
  ship: [-3.7, 0.5, 1.3],
  wreck: [-2.95, 0.42, 1],
  pond: [2.0, 0.2, 0.5],
  lying: [[-1.75, 0.15], [-2.6, 0.25], [-1.5, 0.27], [-2.05, 0.35]],
  spread: 0.3
};

/* The healing pond: a round pool of glowing water in a ring of stones, at
   lane, rel; r its radius in lanes. */
export function worldPond(c, W, H, lane, rel, t, L, r = 0.6){
  const n = 28, edge = (k, out) => { const a = k / n * 6.2832; return P(lane + Math.cos(a) * (r + out), rel + Math.sin(a) * r * 0.22, W, H); };
  const shape = (out) => { c.beginPath(); for (let k = 0; k <= n; k++){ const q = edge(k, out); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } c.closePath(); };
  const ctr = P(lane, rel, W, H), far = P(lane, rel + r * 0.22, W, H), near = P(lane, rel - r * 0.22, W, H);
  c.fillStyle = L.rock[1]; shape(0.12); c.fill();
  const g = c.createLinearGradient(0, far.y, 0, near.y); g.addColorStop(0, mix(L.water, '#ffffff', 0.35)); g.addColorStop(0.5, L.water); g.addColorStop(1, '#1b7f9e');
  c.fillStyle = g; shape(0); c.fill();
  /* ripples, light */
  c.strokeStyle = 'rgba(255,255,255,.5)';
  for (let k = 0; k < 3; k++){
    const u = (t * 0.35 + k / 3) % 1, w = (P(lane + r * u * 0.9, rel, W, H).x - ctr.x);
    c.lineWidth = Math.max(1, 2 * ctr.k); c.beginPath(); c.ellipse(ctr.x, ctr.y, Math.abs(w), Math.abs(w) * 0.16, 0, 0, 6.2832); c.stroke();
  }
  glow(c, ctr.x, ctr.y - H * 0.02 * ctr.k, (near.y - far.y) * 2 + H * 0.06 * ctr.k, L.water, 0.5);
  /* stones round the edge */
  for (let k = 0; k < 16; k++){
    const q = edge(k * 28 / 16, 0.08), rr = H * 0.012 * q.k + 0.5;
    c.fillStyle = L.rock[1]; c.beginPath(); c.ellipse(q.x, q.y - rr * 0.3, rr * 1.2, rr * 0.75, 0, 0, 6.2832); c.fill();
    c.fillStyle = L.rock[0]; c.beginPath(); c.ellipse(q.x - rr * 0.35, q.y - rr * 0.55, rr * 0.6, rr * 0.35, 0, 0, 6.2832); c.fill();
  }
  /* bubbles rising */
  c.fillStyle = 'rgba(210,255,255,.9)';
  for (let k = 0; k < 8; k++){
    const q = P(lane + (hash(k + 1500) - 0.5) * r * 1.4, rel + (hash(k + 1501) - 0.5) * r * 0.3, W, H), u = (t * 0.6 + k / 8) % 1;
    circ(c, q.x, q.y - u * H * 0.1 * q.k, (H * 0.004 * (1 - u * 0.6)) * q.k + 0.5);
  }
}

/* The pond at its most magical - for the moment it's found: light shafts
   coming down through the mist onto it, mist rising off the water, motes
   drifting up (k 0..1, how strongly). */
export function pondBeauty(c, W, H, lane, rel, t, L, r = 0.6, k = 1){
  if (k <= 0) return;
  const ctr = P(lane, rel, W, H), w = (P(lane + r, rel, W, H).x - ctr.x);
  c.save();
  for (let j = 0; j < 4; j++){
    const x = ctr.x + (j - 1.5) * w * 0.55 + Math.sin(t * 0.4 + j) * w * 0.08;
    const g = c.createLinearGradient(0, ctr.y - H * 0.6, 0, ctr.y);
    g.addColorStop(0, 'rgba(255,250,220,0)'); g.addColorStop(0.6, `rgba(220,255,250,${0.12 * k})`); g.addColorStop(1, 'rgba(220,255,250,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - w * 0.12, ctr.y - H * 0.6); c.lineTo(x + w * 0.12, ctr.y - H * 0.6); c.lineTo(x + w * 0.3, ctr.y); c.lineTo(x - w * 0.3, ctr.y); c.closePath(); c.fill();
  }
  for (let j = 0; j < 6; j++){ const u = (t * 0.15 + j / 6) % 1; glow(c, ctr.x + (hash(j + 1600) - 0.5) * w * 1.6, ctr.y - u * H * 0.18 * ctr.k, w * (0.5 + u * 0.6), '#e8fbff', 0.35 * k * (1 - u)); }
  c.fillStyle = `rgba(200,255,250,${0.9 * k})`;
  for (let j = 0; j < 16; j++){ const u = (t * 0.3 + hash(j + 1700)) % 1; circ(c, ctr.x + (hash(j + 1701) - 0.5) * w * 1.8 + Math.sin(u * 6 + j) * w * 0.05, ctr.y - u * H * 0.3 * ctr.k, H * 0.003 * (1 - u) + 0.6); }
  c.restore();
}

/* Healing, shown: a ripple ring spreading from where someone stands in the
   water (age 0..1), and a "+n" floating up off them. Reusable for the
   springs. */
export function healRipple(c, x, y, size, age, col = '#9ff6ff'){
  c.save(); c.globalAlpha = Math.max(0, 1 - age); c.strokeStyle = col; c.lineWidth = Math.max(1.5, size * 0.03);
  c.beginPath(); c.ellipse(x, y, size * (0.3 + age), size * (0.08 + age * 0.25), 0, 0, 6.2832); c.stroke(); c.restore();
}
export function healNumber(c, x, y, size, age, text){
  c.save(); c.globalAlpha = Math.max(0, 1 - age); c.font = `700 ${Math.round(size)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = size * 0.18; c.strokeStyle = '#05303a'; c.strokeText(text, x, y - age * size * 2); c.fillStyle = '#7dffb0'; c.fillText(text, x, y - age * size * 2);
  c.restore();
}
