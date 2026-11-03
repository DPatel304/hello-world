/* Last Known Position - the crash site, where Level 1 begins. One layout,
   SITE, in the game's own ground coordinates ([lane, depth (rel)]): the
   opening (lkp-intro.js) films it from the game's own view, framed by a
   camera, and play starts in exactly the same place - so nothing moves
   between shots.

   From above, looking north up the path (lane 0 runs away from us; rel is
   how far ahead, 0 at our feet, 1 at the haze). The site runs on past the
   left of the game's own view (lkp-world.js SKY.wide): the crew come
   down over there, walk right to the pond, then right again onto the
   path, where play starts.

      SHIP ........ (behind)
      wreck   crew out cold  ->  POND  ->  | path |
                                           | start|
      lane  -7 ...... -4 ......... -2.3   -1.15  0

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
  ship: [-5.0, 0.45, 1.3],
  wreck: [-6.7, 0.38, 1],
  pond: [-2.35, 0.18, 0.68],
  lying: [[-3.65, 0.16], [-5.1, 0.27], [-3.5, 0.21], [-5.3, 0.2]],
  spread: 0.19,
  /* the woods round the site, [lane, rel] */
  trees: [[-8.2, 0.62], [-6.9, 0.7], [-5.6, 0.66], [-4.2, 0.6], [-9.5, 0.5], [-8.6, 0.4], [-10.5, 0.33], [-9.6, 0.26], [-7.6, 0.55], [-3.6, 0.52], [-11.5, 0.6], [-12, 0.42]]
};

/* The meadow round the site, part of the floor: grass and flowers over
   past the left of the path, rel0 how far along it starts. */
export function worldMeadow(c, W, H, rel0, L){
  for (let n = 0; n < 300; n++){
    const rel = rel0 - 0.05 + hash(n + 1200) * 0.8, lane = -1.35 - Math.pow(hash(n + 1201), 0.8) * 11, p = P(lane, rel, W, H);
    if (p.x > W + 40 || rel < -0.1 || rel > 1) continue;
    const [pl, pr, ps] = SITE.pond;
    if (Math.abs(lane - pl) < ps * 1.1 && Math.abs(rel - rel0 - pr) < ps * 0.3) continue;
    const h = H * (0.014 + hash(n + 1202) * 0.024) * p.k;
    c.strokeStyle = rgba(L.grass[n % 2], 0.6 + 0.35 * Math.min(1, p.k)); c.lineWidth = Math.max(1, H * 0.003 * p.k);
    c.beginPath();
    for (const dx of [-1, 0, 1]){ c.moveTo(p.x + dx * h * 0.2, p.y); c.quadraticCurveTo(p.x + dx * h * 0.25, p.y - h * 0.6, p.x + dx * h * 0.45 - h * 0.15, p.y - h); }
    c.stroke();
    if (hash(n + 1203) < 0.16){ c.fillStyle = L.flowers[n % L.flowers.length]; circ(c, p.x, p.y - h, h * 0.18); }
  }
}

/* The healing pond: a natural pond - an uneven outline, a damp bank,
   deep in the middle and lit at its far edge by the sky, reeds and lily
   pads, a few rocks - with a soft healing light in it. At lane, rel; r
   its size in lanes. */
const BANK = (a) => 1 + 0.16 * Math.sin(2 * a + 0.7) + 0.09 * Math.sin(3 * a + 2.1) + 0.05 * Math.sin(5 * a + 0.4);
export function worldPond(c, W, H, lane, rel, t, L, r = 0.6){
  /* (flat on the ground, seen from where we stand: round, foreshortened) */
  const ctr = P(lane, rel, W, H), rx = Math.abs(P(lane + r, rel, W, H).x - ctr.x), ry = rx * 0.3, per = rx / r;
  const far = { y: ctr.y - ry * 1.2 }, near = { y: ctr.y + ry * 1.2 };
  const n = 48, edge = (a, out = 0, f = 1) => { const k = BANK(a) * f; return { x: ctr.x + Math.cos(a) * (rx * k + out * per), y: ctr.y + Math.sin(a) * (ry * k + out * per * 0.3), k: ctr.k }; };
  const shape = (out, f = 1) => { c.beginPath(); for (let k = 0; k <= n; k++){ const q = edge(k / n * 6.2832, out, f); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } c.closePath(); };
  const at = (dl, dr) => ({ x: ctr.x + dl * per, y: ctr.y + dr / (r * 0.26) * ry, k: ctr.k });
  /* the damp bank */
  c.fillStyle = mix(L.ground[2], '#3b3326', 0.45); shape(0.14); c.fill();
  c.fillStyle = mix(L.ground[2], '#2f2a20', 0.6); shape(0.06); c.fill();
  /* the water: lit by the sky at the far edge, deep in the middle */
  const g = c.createLinearGradient(0, far.y, 0, near.y);
  g.addColorStop(0, mix(L.sky[2], L.water, 0.45)); g.addColorStop(0.35, mix(L.water, '#1f7489', 0.35)); g.addColorStop(1, '#17566a');
  c.fillStyle = g; shape(0); c.fill();
  c.save(); shape(0); c.clip();
  /* deeper in the middle; the healing light under the surface */
  c.fillStyle = 'rgba(10,50,70,.28)'; shape(0, 0.55); c.fill();
  glow(c, ctr.x, ctr.y, (near.y - far.y) * 1.6, '#7ff3e0', 0.32 + 0.06 * Math.sin(t * 1.5));
  /* the sky on the water, a few long glints */
  for (let k = 0; k < 4; k++){
    const q = at((hash(k + 1520) - 0.5) * r * 1.2, (0.35 - k * 0.18) * r * 0.26), w = rx * 0.35 * (0.5 + hash(k + 1521) * 0.6);
    c.fillStyle = `rgba(255,255,255,${0.14 + 0.08 * Math.sin(t * 0.8 + k)})`; c.beginPath(); c.ellipse(q.x + Math.sin(t * 0.3 + k) * w * 0.1, q.y, w, Math.max(1, w * 0.035), 0, 0, 6.2832); c.fill();
  }
  /* slow rings */
  c.strokeStyle = 'rgba(255,255,255,.22)';
  for (let k = 0; k < 2; k++){
    const u = (t * 0.25 + k / 2) % 1, q = at(r * 0.25, r * 0.02), w = rx * (0.1 + u * 0.4);
    c.globalAlpha = 1 - u; c.lineWidth = Math.max(1, 2 * ctr.k); c.beginPath(); c.ellipse(q.x, q.y, Math.abs(w), Math.abs(w) * 0.2, 0, 0, 6.2832); c.stroke();
  }
  c.globalAlpha = 1;
  c.restore();
  /* the shallows: a pale line round the edge */
  c.strokeStyle = 'rgba(200,245,240,.35)'; c.lineWidth = Math.max(1, H * 0.004 * ctr.k); shape(-0.02); c.stroke();
  /* lily pads */
  for (const [a, f, flower] of [[0.6, 0.62, 1], [2.3, 0.7, 0], [3.9, 0.5, 0], [5.3, 0.66, 1], [1.4, 0.3, 0]]){
    const q = edge(a, 0, f), rr = H * 0.016 * q.k;
    c.fillStyle = '#3f9a55'; c.beginPath(); c.ellipse(q.x, q.y, rr * 1.6, rr * 0.55, 0, 0.35, 6.2832 - 0.35); c.lineTo(q.x, q.y); c.closePath(); c.fill();
    c.fillStyle = '#5cb96c'; c.beginPath(); c.ellipse(q.x - rr * 0.3, q.y - rr * 0.1, rr * 0.7, rr * 0.22, 0, 0, 6.2832); c.fill();
    if (flower){ c.fillStyle = '#ffb6d9'; for (let j = 0; j < 5; j++){ const b = j / 5 * 6.2832; circ(c, q.x + Math.cos(b) * rr * 0.3, q.y - rr * 0.35 + Math.sin(b) * rr * 0.12, rr * 0.22); } c.fillStyle = '#ffe28a'; circ(c, q.x, q.y - rr * 0.35, rr * 0.14); }
  }
  /* a few rocks on the bank, near side */
  for (const [a, sz] of [[1.25, 1.2], [1.5, 0.8], [1.05, 0.6], [4.6, 0.7]]){
    const q = edge(a, 0.1), w = H * 0.016 * q.k * sz;
    c.fillStyle = 'rgba(25,20,50,.3)'; c.beginPath(); c.ellipse(q.x + w * 0.4, q.y + w * 0.1, w * 1.2, w * 0.3, 0, 0, 6.2832); c.fill();
    c.fillStyle = L.rock[1]; c.beginPath(); c.moveTo(q.x - w, q.y); c.lineTo(q.x - w * 0.5, q.y - w * 0.85); c.lineTo(q.x + w * 0.5, q.y - w * 0.7); c.lineTo(q.x + w, q.y); c.fill();
    c.fillStyle = L.rock[0]; c.beginPath(); c.moveTo(q.x - w, q.y); c.lineTo(q.x - w * 0.5, q.y - w * 0.85); c.lineTo(q.x - w * 0.1, q.y); c.fill();
  }
  /* reeds and bulrushes at the far side and the ends */
  for (let k = 0; k < 26; k++){
    const a = 3.3 + hash(k + 1540) * 2.9, q = edge(a, 0.04), h = H * (0.035 + hash(k + 1541) * 0.035) * q.k, sway = Math.sin(t * 1.2 + k) * h * 0.06;
    c.strokeStyle = k % 3 ? '#4f8f4a' : '#6aa95a'; c.lineWidth = Math.max(1, H * 0.0028 * q.k);
    c.beginPath(); c.moveTo(q.x, q.y); c.quadraticCurveTo(q.x + sway * 0.5, q.y - h * 0.6, q.x + sway, q.y - h); c.stroke();
    if (k % 4 === 0){ c.fillStyle = '#6b4a2e'; c.beginPath(); c.ellipse(q.x + sway, q.y - h * 0.9, h * 0.05, h * 0.14, 0, 0, 6.2832); c.fill(); }
  }
  /* the healing: little lights rising */
  c.fillStyle = 'rgba(210,255,245,.85)';
  for (let k = 0; k < 8; k++){
    const q = at((hash(k + 1500) - 0.5) * r * 1.2, (hash(k + 1501) - 0.5) * r * 0.25), u = (t * 0.5 + k / 8) % 1;
    circ(c, q.x, q.y - u * H * 0.1 * q.k, (H * 0.0035 * (1 - u * 0.6)) * q.k + 0.5);
  }
}

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
