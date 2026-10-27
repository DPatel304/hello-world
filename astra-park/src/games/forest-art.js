/* Forest Run, painted. The view runs down a mossy path through an enchanted
   forest from just behind the runners: the path narrows to a glade of light
   on the horizon, big old trees and toadstools line it, and everything on
   it - fallen logs, low branches, stumps, glowing crystals - comes toward
   you, growing as it nears. The further a run goes, the more magical the
   forest gets: the light turns from golden afternoon to violet dusk, the
   toadstools glow and fireflies come out.

   Depth is `rel`: 0 is the runners, 1 the horizon. P(lane, rel) turns a
   place on the path - lane -1 its left edge, 1 its right - into the screen.
   The far forest and the leaves overhead never move, so they're painted
   once per screen size. */

export const RUN = 0.03;              /* the runners' own depth */
export const HORIZON = 0.44;          /* screen heights */
const BOTTOM = 0.97;                  /* where the runners' feet are */
const HALF = 0.3;                     /* half the path's width at the runners, in screen widths */
const S = (z) => 1 / (1 + 6 * Math.max(-0.1, z));

export function P(lane, rel, W, H){
  const k = S(rel) / S(RUN);
  const y = HORIZON + (BOTTOM - HORIZON) * (S(rel) - S(1)) / (S(RUN) - S(1));
  return { x: W * (0.5 + lane * HALF * k), y: y * H, k };
}

const hash = (i, k = 1) => ((((i + 7919) * 2654435761 * k) % 4294967296) + 4294967296) % 4294967296 / 4294967296;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/* ---------- the far forest and the leaves overhead ---------- */

let cache = null;
function layers(W, H){
  if (cache && cache.W === W && cache.H === H) return cache;
  cache = { W, H, far: null, leaves: null };
  try {
    const mk = (h) => { const cv = document.createElement('canvas'); cv.width = Math.round(W); cv.height = Math.round(h); return cv.getContext && cv.getContext('2d') ? cv : null; };
    cache.far = mk(H * (HORIZON + 0.02));
    cache.leaves = mk(H * 0.3);
  } catch { cache.far = cache.leaves = null; }
  if (cache.far) paintFar(cache.far.getContext('2d'), W, H);
  if (cache.leaves) paintLeaves(cache.leaves.getContext('2d'), W, H);
  return cache;
}

/* Rows of rounded treetops, darker and bluer with distance, open in the
   middle where the path disappears into a sunny glade. */
function paintFar(c, W, H){
  const HY = H * HORIZON;
  const rows = [[0.2, '#6f9a8c', 0.06], [0.13, '#4f8270', 0.08], [0.06, '#386b55', 0.1]];
  rows.forEach(([top, col, r], n) => {
    c.fillStyle = col;
    c.beginPath(); c.moveTo(0, HY + 2);
    for (let i = 0; i <= 40; i++){
      const x = i / 40, gap = Math.max(0, 1 - Math.abs(x - 0.5) / (0.09 + n * 0.03));
      const y = HY - H * (top + hash(i + n * 50, 3) * 0.05) * (1 - gap * 0.8);
      c.lineTo(W * x, y);
    }
    c.lineTo(W, HY + 2); c.closePath(); c.fill();
    for (let i = 0; i < 26; i++){
      const x = hash(i + n * 31, 7), gap = Math.abs(x - 0.5) < 0.1 + n * 0.03;
      if (gap) continue;
      const y = HY - H * (top + hash(i + n * 9, 11) * 0.06), rr = H * r * (0.7 + hash(i, 13) * 0.6);
      c.beginPath(); c.arc(W * x, y, rr, 0, 6.2832); c.fill();
    }
  });
  /* Trunks in the far wood. */
  c.fillStyle = 'rgba(40,70,58,.5)';
  for (let i = 0; i < 30; i++){
    const x = hash(i, 17); if (Math.abs(x - 0.5) < 0.12) continue;
    c.fillRect(W * x, HY - H * 0.07, H * 0.008, H * 0.07);
  }
}

/* Leafy boughs reaching in from the top corners, framing the path. */
function paintLeaves(c, W, H){
  const blob = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };
  for (const side of [0, 1]){
    const sx = side ? W : 0, dir = side ? -1 : 1;
    c.strokeStyle = '#4a3326'; c.lineWidth = H * 0.025; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx, H * 0.02); c.quadraticCurveTo(sx + dir * W * 0.15, H * 0.1, sx + dir * W * 0.3, H * 0.04); c.stroke();
    for (let i = 0; i < 34; i++){
      const u = hash(i + side * 99, 3), x = sx + dir * W * u * 0.34, y = H * (0.02 + Math.sin(u * 3) * 0.08 * (1 - u) + hash(i, 5) * 0.06);
      const r = H * (0.03 + hash(i + side * 7, 9) * 0.035) * (1.2 - u * 0.6);
      blob(x, y, r, ['#2f6b47', '#3d8a57', '#4fa565'][i % 3]);
    }
    for (let i = 0; i < 14; i++){
      const u = hash(i + side * 41, 21), x = sx + dir * W * u * 0.3, y = H * (0.01 + hash(i, 23) * 0.07);
      blob(x - H * 0.008, y - H * 0.008, H * 0.012, 'rgba(190,240,170,.45)');
    }
  }
}

/* How the light looks: 0 golden afternoon, 1 violet dusk. */
function skyCols(magic){
  return {
    top: mix([126, 196, 222], [62, 52, 120], magic),
    low: mix([255, 236, 186], [244, 160, 190], magic),
    grass: mix([92, 160, 88], [56, 104, 96], magic),
    grassFar: mix([140, 190, 110], [96, 120, 140], magic),
    path: mix([205, 170, 120], [150, 126, 140], magic),
    pathFar: mix([226, 205, 160], [190, 160, 180], magic)
  };
}

/* The sky, the far wood, the grass and the path, with pebbles and fallen
   leaves rushing past. `z` is how far the run has come. */
export function drawForest(c, W, H, z, magic, t){
  const L = layers(W, H), col = skyCols(magic), HY = H * HORIZON;
  let g = c.createLinearGradient(0, 0, 0, HY);
  g.addColorStop(0, rgb(col.top)); g.addColorStop(1, rgb(col.low));
  c.fillStyle = g; c.fillRect(0, 0, W, HY + 2);
  /* The glade's glow at the end of the path. */
  g = c.createRadialGradient(W * 0.5, HY, 0, W * 0.5, HY, H * 0.4);
  g.addColorStop(0, `rgba(255,248,215,${0.9 - magic * 0.3})`); g.addColorStop(1, 'rgba(255,248,215,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, HY + 2);
  if (L.far) c.drawImage(L.far, 0, 0, W, L.far.height); else paintFar(c, W, H);
  if (magic > 0.02){ c.fillStyle = `rgba(60,40,110,${magic * 0.35})`; c.fillRect(0, 0, W, HY + 2); }

  g = c.createLinearGradient(0, HY, 0, H);
  g.addColorStop(0, rgb(col.grassFar)); g.addColorStop(1, rgb(col.grass));
  c.fillStyle = g; c.fillRect(0, HY, W, H - HY);
  /* The path: a band of packed earth with mossy edges. */
  const a = P(-1.25, 1, W, H), b = P(1.25, 1, W, H), cc = P(1.25, -0.06, W, H), d = P(-1.25, -0.06, W, H);
  g = c.createLinearGradient(0, HY, 0, H);
  g.addColorStop(0, rgb(col.pathFar)); g.addColorStop(1, rgb(col.path));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(cc.x, cc.y); c.lineTo(d.x, d.y); c.closePath(); c.fill();
  c.strokeStyle = rgb(mix(col.grass, [70, 130, 70], 0.4), 0.9); c.lineWidth = H * 0.012;
  for (const side of [-1, 1]){
    c.beginPath();
    for (let k = 0; k <= 24; k++){ const rel = 1.0 - k * 1.06 / 24, p = P(side * (1.25 + Math.sin((rel + z) * 14) * 0.04), rel, W, H); k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }
    c.stroke();
  }
  /* Pebbles, leaves and sunny patches, all moving with the path. */
  for (let i = Math.floor(z / 0.035); i < z / 0.035 + 32; i++){
    const rel = i * 0.035 - z;
    if (rel < -0.06 || rel > 1) continue;
    const lane = (hash(i, 3) - 0.5) * 2.3, p = P(lane, rel, W, H), fade = Math.min(1, (1 - rel) * 3), kind = i % 3;
    if (kind === 0){ c.fillStyle = `rgba(150,120,90,${0.5 * fade})`; c.beginPath(); c.ellipse(p.x, p.y, H * 0.012 * p.k, H * 0.006 * p.k, 0, 0, 6.2832); c.fill(); }
    else if (kind === 1){ c.fillStyle = `hsla(${20 + hash(i, 5) * 30},70%,${50 + magic * 5}%,${0.6 * fade})`; c.beginPath(); c.ellipse(p.x, p.y, H * 0.013 * p.k, H * 0.005 * p.k, hash(i, 7) * 3, 0, 6.2832); c.fill(); }
    else { c.fillStyle = `rgba(255,240,190,${0.18 * fade * (1 - magic)})`; c.beginPath(); c.ellipse(p.x, p.y, H * 0.08 * p.k, H * 0.012 * p.k, 0, 0, 6.2832); c.fill(); }
  }
  /* Sunbeams slanting through the trees, fading as dusk comes. */
  if (magic < 0.9){
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++){
      const x = W * (0.12 + i * 0.26 + Math.sin(t * 0.1 + i) * 0.01), w = W * 0.05;
      g = c.createLinearGradient(x, 0, x + W * 0.1, H * 0.8);
      g.addColorStop(0, `rgba(255,240,190,${0.1 * (1 - magic)})`); g.addColorStop(1, 'rgba(255,240,190,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + w, 0); c.lineTo(x + w + W * 0.12, H * 0.8); c.lineTo(x + W * 0.12, H * 0.8); c.closePath(); c.fill();
    }
    c.restore();
  }
}

export function drawLeaves(c, W, H){
  const L = layers(W, H);
  if (L.leaves) c.drawImage(L.leaves, 0, 0, W, L.leaves.height); else paintLeaves(c, W, H);
}

/* ---------- things along the path ---------- */

/* The trees, toadstools and ferns down both sides, as things to sort among
   the rest. */
export function sideThings(z){
  const out = [];
  for (let i = Math.floor(z / 0.06); i < z / 0.06 + 20; i++){
    const rel = i * 0.06 - z;
    if (rel < -0.08 || rel > 1) continue;
    for (const side of [-1, 1]){
      const h = hash(i * 2 + (side > 0), 5);
      out.push({ kind: 'tree', lane: side * (1.7 + h * 0.9), rel, size: 0.85 + hash(i, 7) * 0.4, seed: i * 2 + (side > 0) });
      if (hash(i, 11 + (side > 0)) < 0.55) out.push({ kind: hash(i, 13) < 0.5 ? 'toadstool' : 'fern', lane: side * (1.35 + hash(i, 17) * 0.25), rel: rel + 0.02, size: 0.6 + hash(i, 19) * 0.5, seed: i * 3 + (side > 0) });
    }
  }
  return out;
}

export function drawTree(c, x, base, h, seed, magic){
  const w = h * 0.12;
  c.fillStyle = 'rgba(30,60,40,.25)'; c.beginPath(); c.ellipse(x, base, w * 2.2, h * 0.05, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#5d4030';
  c.beginPath(); c.moveTo(x - w, base); c.quadraticCurveTo(x - w * 0.6, base - h * 0.4, x - w * 0.55, base - h * 0.75);
  c.lineTo(x + w * 0.55, base - h * 0.75); c.quadraticCurveTo(x + w * 0.6, base - h * 0.4, x + w, base); c.closePath(); c.fill();
  c.fillStyle = '#7a5640'; c.fillRect(x - w * 0.15, base - h * 0.6, w * 0.3, h * 0.5);
  const greens = magic > 0.5 ? ['#2d5d58', '#3b7465', '#4a8a6e'] : ['#2f6b47', '#3d8a57', '#56a865'];
  for (let k = 0; k < 6; k++){
    const a = k / 6 * 6.28 + seed, r = h * (0.2 + hash(seed + k, 3) * 0.08);
    c.fillStyle = greens[k % 3];
    c.beginPath(); c.arc(x + Math.cos(a) * h * 0.16, base - h * 0.9 + Math.sin(a) * h * 0.1, r, 0, 6.2832); c.fill();
  }
  c.fillStyle = greens[2]; c.beginPath(); c.arc(x, base - h * 1.0, h * 0.22, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(220,255,190,.25)'; c.beginPath(); c.arc(x - h * 0.08, base - h * 1.08, h * 0.1, 0, 6.2832); c.fill();
}

export function drawToadstool(c, x, base, h, magic, t, seed){
  const glow = magic * (0.6 + 0.4 * Math.sin(t * 2 + seed));
  if (glow > 0.05){
    const g = c.createRadialGradient(x, base - h * 0.6, 0, x, base - h * 0.6, h * 1.4);
    g.addColorStop(0, `rgba(255,140,220,${0.45 * glow})`); g.addColorStop(1, 'rgba(255,140,220,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, base - h * 0.6, h * 1.4, 0, 6.2832); c.fill();
  }
  c.fillStyle = '#f6ecd8'; c.fillRect(x - h * 0.1, base - h * 0.55, h * 0.2, h * 0.55);
  c.fillStyle = magic > 0.5 ? '#e05aa8' : '#e2483d';
  c.beginPath(); c.ellipse(x, base - h * 0.55, h * 0.42, h * 0.3, 0, Math.PI, 0); c.closePath(); c.fill();
  c.fillStyle = '#ffffff';
  for (const [dx, dy, r] of [[-0.2, -0.7, 0.07], [0.12, -0.75, 0.06], [0.28, -0.62, 0.05], [-0.02, -0.64, 0.04]]){ c.beginPath(); c.arc(x + dx * h, base + dy * h, r * h, 0, 6.2832); c.fill(); }
}

export function drawFern(c, x, base, h){
  c.strokeStyle = '#3f8f52'; c.lineWidth = Math.max(1.5, h * 0.06); c.lineCap = 'round';
  for (let k = -2; k <= 2; k++){
    c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + k * h * 0.2, base - h * 0.7, x + k * h * 0.45, base - h * (0.6 - Math.abs(k) * 0.1)); c.stroke();
  }
}

/* ---------- obstacles ---------- */

/* A fallen log across the whole path, mossy, with a toadstool on top. */
export function drawLog(c, W, H, rel, magic){
  const l = P(-1.3, rel, W, H), r = P(1.3, rel, W, H), th = H * 0.05 * l.k, y = l.y - th * 0.5;
  c.fillStyle = 'rgba(40,30,20,.25)'; c.beginPath(); c.ellipse((l.x + r.x) / 2, l.y + th * 0.15, (r.x - l.x) * 0.52, th * 0.35, 0, 0, 6.2832); c.fill();
  const g = c.createLinearGradient(0, y - th / 2, 0, y + th / 2);
  g.addColorStop(0, '#9a6a48'); g.addColorStop(1, '#5b3a26');
  c.fillStyle = g; c.beginPath(); c.roundRect(l.x, y - th / 2, r.x - l.x, th, th / 2); c.fill();
  c.strokeStyle = 'rgba(60,35,20,.5)'; c.lineWidth = Math.max(1, th * 0.06);
  for (let k = 1; k < 6; k++){ const x = l.x + (r.x - l.x) * (k / 6 + Math.sin(k) * 0.03); c.beginPath(); c.moveTo(x, y - th * 0.3); c.lineTo(x + th * 0.6, y - th * 0.1); c.stroke(); }
  c.fillStyle = '#d9b48a'; c.beginPath(); c.ellipse(r.x, y, th * 0.32, th / 2, 0, 0, 6.2832); c.fill();
  c.strokeStyle = '#a77e58'; c.beginPath(); c.ellipse(r.x, y, th * 0.18, th * 0.28, 0, 0, 6.2832); c.stroke();
  c.fillStyle = '#5fae5a';
  for (let k = 0; k < 9; k++){ const x = l.x + (r.x - l.x) * (0.05 + k * 0.11); c.beginPath(); c.ellipse(x, y - th * 0.45, th * 0.3, th * 0.14, 0, 0, 6.2832); c.fill(); }
  drawToadstool(c, l.x + (r.x - l.x) * 0.72, y - th * 0.4, th * 0.8, magic, 0, 3);
}

/* A low branch across the path at head height, from one tree to the other,
   hung thick with leaves - and, at dusk, little lights. */
export function drawBranch(c, W, H, rel, t, magic){
  const l = P(-1.4, rel, W, H), r = P(1.4, rel, W, H), k = l.k, y = l.y - H * 0.29 * k, th = H * 0.045 * k;
  for (const p of [l, r]){
    c.fillStyle = '#5d4030';
    c.beginPath(); c.moveTo(p.x - th, p.y); c.lineTo(p.x - th * 0.7, y - th * 2); c.lineTo(p.x + th * 0.7, y - th * 2); c.lineTo(p.x + th, p.y); c.closePath(); c.fill();
  }
  c.strokeStyle = '#6b4a34'; c.lineWidth = th; c.lineCap = 'round';
  c.beginPath(); c.moveTo(l.x, y - th); c.quadraticCurveTo((l.x + r.x) / 2, y + th * 0.8, r.x, y - th); c.stroke();
  c.strokeStyle = '#8a6448'; c.lineWidth = th * 0.25;
  c.beginPath(); c.moveTo(l.x + th, y - th * 1.2); c.quadraticCurveTo((l.x + r.x) / 2, y + th * 0.4, r.x - th, y - th * 1.2); c.stroke();
  const greens = ['#3d8a57', '#56a865', '#2f6b47', '#4a9a5e'];
  for (let n = 0; n < 26; n++){
    const u = (n + 0.5) / 26, x = l.x + (r.x - l.x) * u, yy = y - th + Math.sin(u * Math.PI) * th * 0.8 * 0.9;
    c.fillStyle = greens[n % 4];
    c.beginPath(); c.ellipse(x, yy + th * (0.5 + (n % 3) * 0.25), th * 0.45, th * 0.8, Math.sin(n * 1.7) * 0.6, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(x + th * 0.3, yy - th * 0.5, th * 0.5, th * 0.4, 0, 0, 6.2832); c.fill();
    if (magic > 0.3 && n % 3 === 1){
      c.fillStyle = `rgba(255,240,170,${magic * (0.6 + 0.4 * Math.sin(t * 4 + n))})`;
      c.beginPath(); c.arc(x, yy + th * 1.5, th * 0.22, 0, 6.2832); c.fill();
    }
  }
}

/* A stump or a mossy boulder, standing on part of the path. */
export function drawStump(c, x, base, s, kind){
  c.fillStyle = 'rgba(40,30,20,.25)'; c.beginPath(); c.ellipse(x, base, s * 0.6, s * 0.12, 0, 0, 6.2832); c.fill();
  if (kind === 'rock'){
    c.fillStyle = '#8a8f99';
    c.beginPath(); c.moveTo(x - s * 0.55, base); c.quadraticCurveTo(x - s * 0.6, base - s * 0.55, x - s * 0.1, base - s * 0.7);
    c.quadraticCurveTo(x + s * 0.5, base - s * 0.75, x + s * 0.58, base); c.closePath(); c.fill();
    c.fillStyle = '#a7acb5'; c.beginPath(); c.ellipse(x - s * 0.15, base - s * 0.5, s * 0.22, s * 0.1, -0.3, 0, 6.2832); c.fill();
    c.fillStyle = '#5fae5a'; c.beginPath(); c.ellipse(x + s * 0.05, base - s * 0.66, s * 0.32, s * 0.1, 0.1, 0, 6.2832); c.fill();
    return;
  }
  c.fillStyle = '#7a5640';
  c.beginPath(); c.moveTo(x - s * 0.45, base); c.lineTo(x - s * 0.38, base - s * 0.6); c.lineTo(x + s * 0.38, base - s * 0.6); c.lineTo(x + s * 0.45, base); c.closePath(); c.fill();
  c.fillStyle = '#d9b48a'; c.beginPath(); c.ellipse(x, base - s * 0.6, s * 0.38, s * 0.12, 0, 0, 6.2832); c.fill();
  c.strokeStyle = '#a77e58'; c.lineWidth = Math.max(1, s * 0.02);
  for (const r of [0.25, 0.14]){ c.beginPath(); c.ellipse(x, base - s * 0.6, s * r, s * r * 0.32, 0, 0, 6.2832); c.stroke(); }
  c.fillStyle = '#5fae5a'; c.beginPath(); c.ellipse(x - s * 0.3, base - s * 0.08, s * 0.2, s * 0.08, 0, 0, 6.2832); c.fill();
}

/* A glowing crystal, spinning slowly, hovering over the path. */
export function drawCrystal(c, x, y, s, t, hue){
  const g = c.createRadialGradient(x, y, 0, x, y, s * 1.6);
  g.addColorStop(0, `hsla(${hue},100%,80%,.6)`); g.addColorStop(1, `hsla(${hue},100%,80%,0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, s * 1.6, 0, 6.2832); c.fill();
  const w = s * 0.55 * Math.abs(Math.cos(t * 2)) + s * 0.12;
  c.fillStyle = `hsl(${hue},85%,62%)`;
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + w, y - s * 0.2); c.lineTo(x, y + s * 0.8); c.lineTo(x - w, y - s * 0.2); c.closePath(); c.fill();
  c.fillStyle = `hsla(${hue},100%,88%,.9)`;
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + w * 0.4, y - s * 0.2); c.lineTo(x, y + s * 0.2); c.closePath(); c.fill();
}

/* ---------- the fox who shows the way ---------- */

/* Running away from us down the path: `act` is 'run', 'jump' (with `k` its
   height 0..1), 'duck' or 'step' (with `k` -1..1 its sidestep). */
export function drawFox(c, x, base, s, t, act = 'run', k = 0){
  const bob = Math.abs(Math.sin(t * 12)) * s * 0.06, lift = act === 'jump' ? k * s * 0.9 : 0, flat = act === 'duck' ? 0.55 : 1;
  c.fillStyle = 'rgba(40,30,20,.22)'; c.beginPath(); c.ellipse(x, base, s * 0.35 * (1 - lift / s * 0.4), s * 0.07, 0, 0, 6.2832); c.fill();
  const y = base - bob - lift;
  c.save(); c.translate(x, y); c.scale(1, flat);
  /* Tail, swishing. */
  c.fillStyle = '#ef7d2e';
  c.beginPath(); c.ellipse(Math.sin(t * 6) * s * 0.12, -s * 0.3, s * 0.16, s * 0.34, Math.sin(t * 6) * 0.4, 0, 6.2832); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(Math.sin(t * 6) * s * 0.16, -s * 0.05, s * 0.09, s * 0.12, 0, 0, 6.2832); c.fill();
  /* Back legs scampering. */
  c.fillStyle = '#3a2a22';
  for (const side of [-1, 1]){ const step = Math.sin(t * 12 + (side > 0 ? Math.PI : 0)) * s * 0.06; c.beginPath(); c.ellipse(side * s * 0.16, -s * 0.05 + step, s * 0.06, s * 0.09, 0, 0, 6.2832); c.fill(); }
  /* Body and head. */
  c.fillStyle = '#f08a3a';
  c.beginPath(); c.ellipse(0, -s * 0.45, s * 0.25, s * 0.3, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.ellipse(0, -s * 0.85, s * 0.2, s * 0.17, 0, 0, 6.2832); c.fill();
  for (const side of [-1, 1]){
    c.fillStyle = '#f08a3a'; c.beginPath(); c.moveTo(side * s * 0.08, -s * 0.95); c.lineTo(side * s * 0.2, -s * 1.15); c.lineTo(side * s * 0.2, -s * 0.88); c.closePath(); c.fill();
    c.fillStyle = '#3a2a22'; c.beginPath(); c.moveTo(side * s * 0.13, -s * 1.0); c.lineTo(side * s * 0.19, -s * 1.1); c.lineTo(side * s * 0.19, -s * 0.97); c.closePath(); c.fill();
  }
  c.restore();
}

/* ---------- the runners ---------- */

/* A child running away from us down the path, in their colour, looking back
   over their shoulder so we see their face. st: { air (screen px up), duck
   0..1, lean -1..1, down 0..1 (tumbling), blink }. face(x, y, r) paints the
   face into the clipped head circle. */
export function drawRunner(c, x, base, h, t, col, st, face){
  const run = st.down > 0 ? 0 : t * 11, duck = st.duck || 0;
  c.fillStyle = `rgba(40,30,20,${0.25 * (1 - Math.min(1, st.air / (h * 0.6)) * 0.6)})`;
  c.beginPath(); c.ellipse(x, base, h * 0.2, h * 0.04, 0, 0, 6.2832); c.fill();
  c.save();
  c.translate(x, base - st.air);
  const tumble = st.down > 0 ? Math.sin(Math.min(1, st.down * 1.6) * Math.PI / 2) * 1.35 * (st.lean >= 0 ? 1 : -1) : st.lean * 0.25;
  c.rotate(tumble);
  if (st.blink && Math.floor(t * 10) % 2) c.globalAlpha = 0.45;
  const sq = 1 - duck * 0.5, u = h / 100;
  c.save();
  c.scale(1, sq);
  /* Legs: thighs and shins, swinging. */
  c.lineCap = 'round';
  for (const side of [-1, 1]){
    const ph = Math.sin(run + (side > 0 ? Math.PI : 0)), air = st.air > 1;
    const kx = side * 8 * u, ky = -26 * u + (air ? -6 * u : ph * 4 * u), fy = air ? -12 * u : -2 * u + Math.max(0, ph) * -10 * u;
    c.strokeStyle = '#3a4466'; c.lineWidth = 11 * u;
    c.beginPath(); c.moveTo(side * 7 * u, -46 * u); c.lineTo(kx, ky); c.stroke();
    c.strokeStyle = '#f2c9a5'; c.lineWidth = 8 * u;
    c.beginPath(); c.moveTo(kx, ky); c.lineTo(side * 8 * u, fy); c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(side * 8 * u, fy + 1 * u, 7 * u, 5 * u, 0, 0, 6.2832); c.fill();
  }
  /* Shorts and shirt. */
  c.fillStyle = '#3a4466'; c.beginPath(); c.roundRect(-15 * u, -54 * u, 30 * u, 14 * u, 4 * u); c.fill();
  c.fillStyle = col; c.beginPath(); c.roundRect(-17 * u, -84 * u, 34 * u, 34 * u, 9 * u); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-17 * u, -70 * u, 34 * u, 5 * u);
  /* Arms pumping - or up and out in a jump. */
  for (const side of [-1, 1]){
    const ph = Math.sin(run + (side > 0 ? 0 : Math.PI));
    const hx = side * (st.air > 1 ? 30 : 22) * u, hy = st.air > 1 ? -104 * u : (-62 + ph * 10) * u;
    c.strokeStyle = col; c.lineWidth = 9 * u;
    c.beginPath(); c.moveTo(side * 14 * u, -80 * u); c.lineTo(hx, hy); c.stroke();
    c.fillStyle = '#f2c9a5'; c.beginPath(); c.arc(hx, hy, 5 * u, 0, 6.2832); c.fill();
  }
  c.restore();
  /* The head, round whatever the body does: lower when ducking, not
     squashed. */
  const hy = -(84 * sq + 22) * u, r = 22 * u;
  c.save();
  c.beginPath(); c.arc(0, hy, r, 0, 6.2832); c.clip();
  c.fillStyle = col; c.fillRect(-r, hy - r, r * 2, r * 2);
  face(0, hy, r);
  c.restore();
  c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.14; c.beginPath(); c.arc(0, hy, r, 0, 6.2832); c.stroke();
  /* Seeing stars after a tumble. */
  if (st.down > 0.3){
    for (let n = 0; n < 5; n++){
      const a = t * 5 + n * 1.2566, sx = Math.cos(a) * r * 1.6, sy = hy - r * 1.1 + Math.sin(a) * r * 0.4;
      c.fillStyle = '#ffd95a'; c.beginPath();
      for (let j = 0; j < 10; j++){ const aa = -Math.PI / 2 + j * Math.PI / 5, d = (j % 2 ? 0.45 : 1) * r * 0.35; c.lineTo(sx + Math.cos(aa) * d, sy + Math.sin(aa) * d); }
      c.fill();
    }
  }
  c.restore();
}

/* Fireflies drifting through the dusk. */
export function drawFireflies(c, W, H, t, magic){
  if (magic < 0.25) return;
  for (let i = 0; i < 26; i++){
    const x = W * (hash(i, 3) + Math.sin(t * 0.3 + i) * 0.03), y = H * (0.2 + hash(i, 5) * 0.55 + Math.sin(t * 0.5 + i * 2) * 0.03);
    const a = (magic - 0.25) * 1.3 * (0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + i * 1.7)));
    const g = c.createRadialGradient(x, y, 0, x, y, H * 0.015);
    g.addColorStop(0, `rgba(230,255,150,${Math.min(1, a)})`); g.addColorStop(1, 'rgba(230,255,150,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, H * 0.015, 0, 6.2832); c.fill();
  }
}

/* The ribbon of light across the path where the best run so far reached:
   two glowing posts and a rainbow of bunting between them. */
export function drawRibbon(c, W, H, rel, t){
  const l = P(-1.35, rel, W, H), r = P(1.35, rel, W, H), k = l.k, y = l.y - H * 0.34 * k;
  for (const p of [l, r]){
    const g = c.createRadialGradient(p.x, y, 0, p.x, y, H * 0.08 * k);
    g.addColorStop(0, 'rgba(255,240,190,.8)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, y, H * 0.08 * k, 0, 6.2832); c.fill();
    c.fillStyle = '#fff6e2'; c.fillRect(p.x - H * 0.006 * k, y, H * 0.012 * k, p.y - y);
    c.beginPath(); c.arc(p.x, y, H * 0.016 * k, 0, 6.2832); c.fill();
  }
  c.strokeStyle = 'rgba(255,246,226,.9)'; c.lineWidth = Math.max(1.5, H * 0.004 * k);
  c.beginPath(); c.moveTo(l.x, y); c.quadraticCurveTo((l.x + r.x) / 2, y + H * 0.08 * k, r.x, y); c.stroke();
  for (let n = 0; n < 11; n++){
    const u = (n + 0.5) / 11, x = l.x + (r.x - l.x) * u, yy = y + 2 * u * (1 - u) * H * 0.08 * k, sw = Math.sin(t * 3 + n) * 0.15;
    c.fillStyle = `hsl(${n * 33 + t * 40},90%,62%)`;
    c.save(); c.translate(x, yy); c.rotate(sw);
    c.beginPath(); c.moveTo(-H * 0.02 * k, 0); c.lineTo(H * 0.02 * k, 0); c.lineTo(0, H * 0.05 * k); c.closePath(); c.fill();
    c.restore();
  }
}
