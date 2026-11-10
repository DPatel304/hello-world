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
  ship: [-5.0, 0.85, 1.3],
  /* chimeblooms (tall ringing flowers), a little right of the ship; and a
     jellycrawl, just in front of you as you wake, walking off right and
     away (lkp-critters.js; the opening walks it: lkp-intro.js) */
  chimes: [-1.4, 0.45],
  crawler: [-4.6, 0.1],
  /* the patch of ground you're looking down at as you wake - the
     jellycrawl's feet wander into the top left of it (lkp-intro.js) */
  patch: [-2.52, 0.07],
  wreck: [-7.0, 0.75, 1],
  /* the woods round the site, [lane, rel] */
  trees: [[-8.2, 0.75], [-6.9, 0.9], [-5.4, 0.95], [-3.6, 0.92], [-9.5, 0.5], [-8.6, 0.4], [-10.5, 0.33], [-9.6, 0.26], [-7.9, 0.62], [-2.6, 0.98], [-11.5, 0.6], [-12, 0.42]]
};

/* The meadow round the site, part of the floor: grass and flowers over
   past the left of the path, rel0 how far along it starts. */
export function worldMeadow(c, W, H, rel0, L){
  for (let n = 0; n < 300; n++){
    const rel = rel0 - 0.05 + hash(n + 1200) * 0.8, lane = -1.35 - Math.pow(hash(n + 1201), 0.8) * 11, p = P(lane, rel, W, H);
    if (p.x > W + 40 || rel < -0.1 || rel > 1) continue;
    const h = H * (0.014 + hash(n + 1202) * 0.024) * p.k;
    c.strokeStyle = rgba(L.grass[n % 2], 0.6 + 0.35 * Math.min(1, p.k)); c.lineWidth = Math.max(1, H * 0.003 * p.k);
    c.beginPath();
    for (const dx of [-1, 0, 1]){ c.moveTo(p.x + dx * h * 0.2, p.y); c.quadraticCurveTo(p.x + dx * h * 0.25, p.y - h * 0.6, p.x + dx * h * 0.45 - h * 0.15, p.y - h); }
    c.stroke();
    if (hash(n + 1203) < 0.16){ c.fillStyle = L.flowers[n % L.flowers.length]; circ(c, p.x, p.y - h, h * 0.18); }
  }
}

/* The ship on fire: flames licking up off its hull and out of its
   engines, sparks rising, the ground lit orange round it. Where
   lkp-places.js worldShip draws it, at lane, rel, size s. */
export function shipFire(c, W, H, rel, lane, t, s = 1){
  const p = P(lane, rel, W, H), u = H * 0.0011 * p.k * s;
  if (p.x < -1400 * u - W * 2 || p.x > W + 1400 * u) return;
  glow(c, p.x + 100 * u, p.y - 40 * u, 900 * u, '#ff7a2e', 0.28 + 0.06 * Math.sin(t * 9));
  /* (the hull's tilted: -0.12 rad, its middle 150 up) */
  const at = (x, y) => [p.x + x * u * Math.cos(-0.12) - y * u * Math.sin(-0.12), p.y - 150 * u + x * u * Math.sin(-0.12) + y * u * Math.cos(-0.12)];
  for (const [x, y, size, seed] of [[560, -60, 1.3, 1], [430, -150, 1, 2], [-120, -150, 0.8, 3], [180, -165, 0.65, 4], [600, 60, 0.9, 5]]){
    const [fx, fy] = at(x, y), h = 230 * u * size * (0.85 + 0.15 * Math.sin(t * 11 + seed) + 0.1 * Math.sin(t * 17 + seed * 2)), w = 95 * u * size;
    glow(c, fx, fy - h * 0.4, w * 2.4, '#ff8a3b', 0.55);
    for (const [col, k] of [['#e8452c', 1], ['#ff9a2e', 0.72], ['#ffe27a', 0.45], ['#fff8e0', 0.22]]){
      const sway = Math.sin(t * 6 + seed + k * 3) * w * 0.25 * k;
      c.fillStyle = col; c.beginPath(); c.moveTo(fx - w * k, fy);
      c.quadraticCurveTo(fx - w * k * 0.9, fy - h * k * 0.55, fx + sway, fy - h * k);
      c.quadraticCurveTo(fx + w * k * 0.9, fy - h * k * 0.55, fx + w * k, fy);
      c.closePath(); c.fill();
    }
  }
  /* sparks, rising and drifting */
  for (let k = 0; k < 22; k++){
    const v = (t * (0.35 + hash(k + 1900) * 0.3) + hash(k + 1901)) % 1, [fx, fy] = at(-200 + hash(k + 1902) * 820, -150);
    c.fillStyle = `rgba(255,${180 + Math.round(60 * (1 - v))},90,${(1 - v) * 0.9})`;
    circ(c, fx + Math.sin(v * 6 + k) * 40 * u, fy - v * 700 * u, (5 + 4 * (1 - v)) * u + 0.5);
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
  /* the far shore's trees, upside down in the still water, faint */
  for (let k = 0; k < 22; k++){
    const ln = (hash(k + 1580) - 0.5) * 2 * SPAN, q = P(ln, farAt(ln), W, H), h = H * (0.07 + hash(k + 1581) * 0.06) * q.k;
    if (q.x < -60 || q.x > W + 60 || Math.abs(ln) < 1.2) continue;
    c.fillStyle = 'rgba(20,70,80,.22)'; c.beginPath(); c.moveTo(q.x - h * 0.3, q.y); c.lineTo(q.x + h * 0.3, q.y); c.lineTo(q.x, q.y + h); c.closePath(); c.fill();
  }
  /* sparkles: points of light winking on and off across it */
  for (let k = 0; k < 26; k++){
    const tw = Math.sin(t * (1.5 + hash(k + 1590) * 2) + k * 2.3); if (tw < 0.55) continue;
    const q = P((hash(k + 1591) - 0.5) * 9, n0 + len * (0.1 + 0.8 * hash(k + 1592)), W, H), r = H * 0.022 * q.k * (tw - 0.55) * 2.2;
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.moveTo(q.x, q.y - r); c.lineTo(q.x + r * 0.22, q.y); c.lineTo(q.x, q.y + r); c.lineTo(q.x - r * 0.22, q.y); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(q.x - r * 1.3, q.y); c.lineTo(q.x, q.y + r * 0.18); c.lineTo(q.x + r * 1.3, q.y); c.lineTo(q.x, q.y - r * 0.18); c.closePath(); c.fill();
  }
  /* bubbles, rising and popping: it's alive */
  for (let k = 0; k < 18; k++){
    const u = (t * (0.3 + hash(k + 1595) * 0.3) + hash(k + 1596)) % 1, q = P((hash(k + 1597) - 0.5) * 8, n0 + len * (0.15 + 0.7 * hash(k + 1598)), W, H), r = H * 0.006 * q.k * (0.6 + u);
    c.strokeStyle = `rgba(220,255,250,${0.7 * (1 - u)})`; c.lineWidth = Math.max(1, r * 0.3); c.beginPath(); c.arc(q.x, q.y - u * H * 0.012 * q.k, r, 0, 6.2832); c.stroke();
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
  for (let j = 0; j < 6; j++){ const u = (t * 0.15 + j / 6) % 1; glow(c, ctr.x + (hash(j + 1600) - 0.5) * w * 1.6, ctr.y - u * H * 0.18 * ctr.k, w * (0.25 + u * 0.3), '#e8fbff', 0.12 * k * (1 - u)); }
  c.fillStyle = `rgba(200,255,250,${0.9 * k})`;
  for (let j = 0; j < 16; j++){ const u = (t * 0.3 + hash(j + 1700)) % 1; circ(c, ctr.x + (hash(j + 1701) - 0.5) * w * 1.8 + Math.sin(u * 6 + j) * w * 0.05, ctr.y - u * H * 0.3 * ctr.k, H * 0.003 * (1 - u) + 0.6); }
  c.restore();
}

/* The healing pond along the way: a broad stretch of still water right
   across the land, wider than the view - the path running down into it
   and up out the far side - deep LAKE across (in depth), its middle at
   rel. Its shores wander; a damp bank, reeds and rushes along them, lily
   pads, the sky in the water, and a soft healing light. */
export const LAKE = 0.3;
const SPAN = 9;          /* lanes either side: always past the screen's edges */
/* (wandering, with rounded bays and points: a pond's edge, not a river's) */
const shore = (lane, side) => 0.055 * Math.sin(lane * 0.55 + side * 1.7) + 0.035 * Math.sin(lane * 1.3 + side * 2.1) + 0.02 * Math.sin(lane * 2.9 + side) + 0.01 * Math.sin(lane * 6.1 + side * 3);
export function worldLake(c, W, H, rel, t, L, len = LAKE){
  const n0 = rel - len / 2, n1 = rel + len / 2;
  if (n1 < -0.15 || n0 > 1.05) return;
  const N = 60, lanes = Array.from({ length: N + 1 }, (_, k) => -SPAN + 2 * SPAN * k / N);
  /* (the near shore's line, and the far one's: depth at each lane) */
  const nearAt = (ln, out = 0) => Math.max(-0.14, n0 + shore(ln, 0) - out), farAt = (ln, out = 0) => Math.min(1.02, n1 + shore(ln, 1) + out);
  const band = (out) => {
    c.beginPath();
    lanes.forEach((ln, k) => { const q = P(ln, nearAt(ln, out), W, H); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
    for (let k = N; k >= 0; k--){ const q = P(lanes[k], farAt(lanes[k], out), W, H); c.lineTo(q.x, q.y); }
    c.closePath();
  };
  const far = P(0, farAt(0), W, H), near = P(0, nearAt(0), W, H);
  /* the damp bank, then the water: the sky in it at the far side, deeper near */
  /* (a soft, pale margin - wet sand and moss - not a hard dark edge) */
  c.fillStyle = mix(L.ground[0], '#cfe8d0', 0.35); band(0.022); c.fill();
  c.fillStyle = mix(L.water, '#bfeee8', 0.55); band(0.008); c.fill();
  const g = c.createLinearGradient(0, far.y, 0, Math.max(far.y + 1, Math.min(near.y, H)));
  g.addColorStop(0, mix(L.sky[2], L.water, 0.4)); g.addColorStop(0.35, mix(L.water, '#1f7489', 0.45)); g.addColorStop(1, '#174f63');
  c.fillStyle = g; band(0); c.fill();
  c.save(); band(0); c.clip();
  /* the healing light under the surface, round the path */
  glow(c, far.x, (far.y + near.y) / 2, Math.min(W * 0.35, (near.y - far.y) * 1.4 + W * 0.08), '#7ff3e0', 0.16 + 0.04 * Math.sin(t * 1.5));
  /* long glints of sky, drifting */
  for (let k = 0; k < 14; k++){
    const q = P((hash(k + 1520) - 0.5) * 7, n0 + len * (0.15 + 0.7 * hash(k + 1522)), W, H), w = W * 0.05 * q.k * (0.5 + hash(k + 1521));
    c.fillStyle = `rgba(255,255,255,${0.12 + 0.08 * Math.sin(t * 0.8 + k)})`; c.beginPath(); c.ellipse(q.x + Math.sin(t * 0.3 + k) * w * 0.1, q.y, w, Math.max(1, w * 0.035), 0, 0, 6.2832); c.fill();
  }
  /* slow rings */
  c.strokeStyle = 'rgba(255,255,255,.22)';
  for (let k = 0; k < 4; k++){
    const u = (t * 0.22 + k / 4) % 1, q = P((hash(k + 1530) - 0.5) * 4, rel + (hash(k + 1531) - 0.5) * len * 0.6, W, H), w = W * 0.06 * q.k * (0.2 + u);
    c.globalAlpha = 1 - u; c.lineWidth = Math.max(1, 2 * q.k); c.beginPath(); c.ellipse(q.x, q.y, w, w * 0.18, 0, 0, 6.2832); c.stroke();
  }
  c.globalAlpha = 1; c.restore();
  /* the shallows: a pale line along each shore */
  c.strokeStyle = 'rgba(200,245,240,.4)';
  for (const [at, side] of [[nearAt, 0], [farAt, 1]]){
    c.lineWidth = Math.max(1, H * 0.004 * P(0, at(0), W, H).k); c.beginPath();
    lanes.forEach((ln, k) => { const q = P(ln, at(ln), W, H); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
    c.stroke();
  }
  /* smooth stones along both shores, clear of the path */
  for (let k = 0; k < 40; k++){
    const ln = (hash(k + 1570) - 0.5) * 2 * SPAN; if (Math.abs(ln) < 1.35) continue;
    const side = k % 2, q = P(ln, side ? farAt(ln, 0.012) : nearAt(ln, 0.014), W, H);
    if (q.x < -40 || q.x > W + 40) continue;
    const rr = H * (0.014 + hash(k + 1571) * 0.018) * q.k;
    c.fillStyle = 'rgba(20,30,40,.25)'; c.beginPath(); c.ellipse(q.x + rr * 0.2, q.y + rr * 0.3, rr * 1.3, rr * 0.4, 0, 0, 6.2832); c.fill();
    c.fillStyle = mix(L.rock[1], L.rock[0], 0.4); c.beginPath(); c.ellipse(q.x, q.y, rr * 1.3, rr * 0.75, 0, 0, 6.2832); c.fill();
    c.fillStyle = rgba(L.rock[0], 0.8); c.beginPath(); c.ellipse(q.x - rr * 0.3, q.y - rr * 0.3, rr * 0.6, rr * 0.28, -0.2, 0, 6.2832); c.fill();
  }
  /* lily pads, here and there, clear of the path */
  for (let k = 0; k < 16; k++){
    const ln = (hash(k + 1550) - 0.5) * 12; if (Math.abs(ln) < 1.4) continue;
    const q = P(ln, n0 + len * (0.2 + 0.6 * hash(k + 1551)), W, H), rr = H * 0.02 * q.k;
    c.fillStyle = '#3f9a55'; c.beginPath(); c.ellipse(q.x, q.y, rr * 1.6, rr * 0.55, 0, 0.35, 6.2832 - 0.35); c.lineTo(q.x, q.y); c.closePath(); c.fill();
    c.fillStyle = '#5cb96c'; c.beginPath(); c.ellipse(q.x - rr * 0.3, q.y - rr * 0.1, rr * 0.7, rr * 0.22, 0, 0, 6.2832); c.fill();
    if (k % 3 === 0){ glow(c, q.x, q.y - rr * 0.35, rr * 2.4, '#ffb6f0', 0.55 + 0.25 * Math.sin(t * 2 + k)); c.fillStyle = '#ffb6d9'; for (let j = 0; j < 5; j++){ const b = j / 5 * 6.2832; circ(c, q.x + Math.cos(b) * rr * 0.3, q.y - rr * 0.35 + Math.sin(b) * rr * 0.12, rr * 0.22); } c.fillStyle = '#ffe28a'; circ(c, q.x, q.y - rr * 0.35, rr * 0.14); }
  }
  /* reeds and bulrushes along both shores, leaving the path's way in and out */
  for (let k = 0; k < 70; k++){
    const ln = (hash(k + 1560) - 0.5) * 2 * SPAN; if (Math.abs(ln) < 1.3) continue;
    const side = k % 2, q = P(ln, side ? farAt(ln, 0.004) : nearAt(ln, -0.004), W, H);
    if (q.x < -50 || q.x > W + 50) continue;
    const h = H * (0.04 + hash(k + 1561) * 0.04) * q.k, sway = Math.sin(t * 1.2 + k) * h * 0.06;
    for (let j = -1; j <= 1; j++){
      c.strokeStyle = (k + j) % 3 ? '#4f8f4a' : '#6aa95a'; c.lineWidth = Math.max(1, H * 0.003 * q.k);
      c.beginPath(); c.moveTo(q.x + j * h * 0.12, q.y); c.quadraticCurveTo(q.x + j * h * 0.15 + sway * 0.5, q.y - h * 0.6, q.x + j * h * 0.25 + sway, q.y - h * (1 - Math.abs(j) * 0.2)); c.stroke();
    }
    if (k % 4 === 0){ c.fillStyle = '#6b4a2e'; c.beginPath(); c.ellipse(q.x + sway, q.y - h * 0.9, h * 0.05, h * 0.14, 0, 0, 6.2832); c.fill(); }
  }
}

/* The pond, still a way off (its near edge at depth n0, past what's
   drawn): a shimmer of light where the path meets the land, brighter as
   it comes - so you see it coming. */
export function worldLakeAhead(c, W, H, n0, t){
  const k = Math.max(0, Math.min(1, (3.2 - n0) / 2.2)); if (k <= 0) return;
  const q = P(0, 1, W, H), w = W * 0.6;
  c.save();
  glow(c, q.x, q.y, w * 0.55, '#bff8ff', 0.7 * k * (0.85 + 0.15 * Math.sin(t * 2)));
  /* a bright line of water, right along the land's edge */
  c.fillStyle = `rgba(190,250,255,${0.75 * k})`; c.beginPath(); c.ellipse(q.x, q.y + H * 0.004, w * 0.5, H * 0.006, 0, 0, 6.2832); c.fill();
  c.fillStyle = `rgba(220,255,255,${0.55 * k})`;
  for (let j = 0; j < 9; j++){ const tw = Math.sin(t * 3 + j * 1.7); if (tw < 0.3) continue; const x = q.x + (hash(j + 1620) - 0.5) * w, y = q.y + (hash(j + 1621) - 0.5) * H * 0.01, r = H * 0.004 * (tw - 0.3) * 3; c.fillRect(x - r * 2, y - 0.5, r * 4, 1.5); c.fillRect(x - 0.5, y - r, 1.5, r * 2); }
  c.restore();
}

/* Someone standing in the healing water: rings spreading round their
   feet, and little glowing motes drifting up off them. */
export function wading(c, x, y, size, t, k = 1){
  for (let j = 0; j < 2; j++) healRipple(c, x, y, size * 0.9, (t * 0.6 + j * 0.5) % 1);
  c.save();
  for (let j = 0; j < 7; j++){ const u = (t * 0.35 + j / 7) % 1; glow(c, x + Math.sin(u * 7 + j * 2) * size * 0.25, y - u * size * 1.2, size * 0.06, '#9ff6ff', 0.8 * k * (1 - u)); }
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

/* The ground you wake up looking at, round lane, rel: pebbles, moss and
   clover, a fiddlehead uncurling, tiny glowing mushrooms, star-flowers, a
   scrap of the ship's panelling (its yellow stripe), and a little dotbug
   ambling about. */
export function worldPatch(c, W, H, lane, rel, t, L){
  const p = P(lane, rel, W, H), k = p.k, sx = W / 1920 * k / 0.6, sy = H / 1080 * k / 0.6;
  const at = (dx, dy) => [p.x + dx * sx, p.y + dy * sy];
  c.save();
  /* moss: little lumpy cushions, a few bobbles each, lit on top */
  for (let n = 0; n < 8; n++){
    const [x, y] = at((hash(n + 40) - 0.5) * 560, (hash(n + 41) - 0.5) * 280), r = (5 + hash(n + 42) * 5) * sx;
    for (let j = 0; j < 6; j++){
      const bx = x + (hash(n * 9 + j) - 0.5) * r * 4, by = y + (hash(n * 9 + j + 3) - 0.5) * r * 1.6;
      c.fillStyle = mix(L.grass[0], '#0c2a22', 0.25); circ(c, bx, by, r);
      c.fillStyle = mix(L.grass[1], '#e8ffd8', 0.25); circ(c, bx - r * 0.25, by - r * 0.3, r * 0.45);
    }
  }
  /* grass tufts, a few blades each */
  for (let n = 0; n < 16; n++){
    const [x, y] = at((hash(n + 140) - 0.5) * 620, (hash(n + 141) - 0.5) * 300), h = (14 + hash(n + 142) * 14) * sy;
    c.strokeStyle = L.grass[n % 2]; c.lineWidth = 2.5 * sx; c.lineCap = 'round';
    c.beginPath();
    for (const d of [-1, -0.3, 0.4, 1]){ c.moveTo(x + d * 3 * sx, y); c.quadraticCurveTo(x + d * 4 * sx, y - h * 0.6, x + d * 9 * sx + Math.sin(t * 1.3 + n) * 2 * sx, y - h); }
    c.stroke();
  }
  /* pebbles, smooth and lavender-grey, lit from above */
  for (let n = 0; n < 7; n++){
    const [x, y] = at((hash(n + 60) - 0.5) * 600, (hash(n + 61) - 0.5) * 300), r = (7 + hash(n + 62) * 12) * sx;
    c.fillStyle = 'rgba(20,15,45,.3)'; c.beginPath(); c.ellipse(x + r * 0.2, y + r * 0.45, r * 1.2, r * 0.45, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#8f88a8'; c.beginPath(); c.ellipse(x, y, r * 1.15, r * 0.72, hash(n) - 0.5, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.2, -0.3, 0, 6.2832); c.fill();
  }
  /* clover: three round leaves */
  for (let n = 0; n < 6; n++){
    const [x, y] = at((hash(n + 80) - 0.5) * 520, (hash(n + 81) - 0.5) * 260), r = (6 + hash(n + 82) * 4) * sx;
    c.fillStyle = mix(L.grass[1], '#2a6a4a', 0.3);
    for (let j = 0; j < 3; j++){ const a = j * 2.094 + n; circ(c, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, r); }
  }
  /* a fiddlehead, uncurling */
  { const [x, y] = at(150, 40), r = 14 * sx;
    c.strokeStyle = '#4fa36e'; c.lineWidth = 4 * sx; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - r * 0.4, y - r * 2.5, x + r * 0.6, y - r * 3.2); c.stroke();
    c.beginPath(); c.arc(x + r * 0.6 - r * 0.5, y - r * 3.2, r * 0.5, 0, Math.PI * 1.6); c.stroke(); }
  /* star-flowers */
  for (let n = 0; n < 6; n++){
    const [x, y] = at((hash(n + 100) - 0.5) * 580, (hash(n + 101) - 0.5) * 290), r = (5 + hash(n + 102) * 3) * sx;
    c.fillStyle = L.flowers[n % L.flowers.length];
    for (let j = 0; j < 5; j++){ const a = j * 1.2566 + t * 0.2; circ(c, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, r * 0.6); }
    c.fillStyle = '#fff3a8'; circ(c, x, y, r * 0.45);
  }
  /* a scrap of the ship: a bent bit of white panelling, its stripe */
  { const [x, y] = at(-60, 70), w = 46 * sx, h = 20 * sy;
    c.save(); c.translate(x, y); c.rotate(-0.25);
    c.fillStyle = 'rgba(20,15,45,.3)'; c.beginPath(); c.ellipse(4 * sx, h * 0.7, w * 0.6, h * 0.4, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#e8eaf2'; c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h * 0.7); c.lineTo(w * 0.45, h / 2); c.lineTo(-w * 0.55, h * 0.4); c.closePath(); c.fill();
    c.fillStyle = '#f3c23a'; c.fillRect(-w * 0.52, -h * 0.05, w, h * 0.22);
    c.fillStyle = '#4aa8f0'; c.fillRect(-w * 0.52, h * 0.17, w, h * 0.1);
    c.restore(); }
  /* glowing mushrooms, tiny */
  for (let n = 0; n < 5; n++){
    const [x, y] = at((hash(n + 120) - 0.5) * 480, (hash(n + 121) - 0.5) * 240), r = (6 + hash(n + 122) * 4) * sx;
    glow(c, x, y - r, r * 4, '#7ff3ff', 0.25 + 0.1 * Math.sin(t * 2 + n));
    c.fillStyle = '#d8fbff'; c.fillRect(x - r * 0.18, y - r, r * 0.36, r);
    c.fillStyle = '#7ff3ff'; c.beginPath(); c.arc(x, y - r, r, Math.PI, 0); c.fill();
  }
  /* a dotbug: a little round red beetle, ambling in a lazy loop */
  { const a = t * 0.35, [x, y] = at(40 + Math.cos(a) * 90, -10 + Math.sin(a) * 40), r = 8 * sx, dir = a + Math.PI / 2;
    c.save(); c.translate(x, y); c.rotate(dir);
    c.fillStyle = '#2a1a2a'; circ(c, r * 0.95, 0, r * 0.45);
    c.fillStyle = '#ff5a5a'; c.beginPath(); c.ellipse(0, 0, r, r * 0.8, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#2a1a2a'; circ(c, -r * 0.3, -r * 0.35, r * 0.18); circ(c, -r * 0.3, r * 0.35, r * 0.18); circ(c, r * 0.3, 0, r * 0.16);
    c.restore(); }
  c.restore();
}
