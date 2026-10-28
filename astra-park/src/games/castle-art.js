/* Tower Defense, painted. A sunny meadow seen from above at a slant: a
   wide castle along the bottom left, and one long sandy trail that comes
   in at the top left and goes the long way round - across the top, back
   and forth down the meadow - to reach it, with round stone pads beside it
   where towers can stand. The meadow, the trail and the trees never move,
   so they're painted once per screen size; towers, monsters and arrows are
   drawn over them.

   Positions are x in screen widths, y in screen heights; sizes are in
   screen heights. */

const hash = (i, k = 1) => ((((i + 7919) * 2654435761 * k) % 4294967296) + 4294967296) % 4294967296 / 4294967296;
const ASPECT = 16 / 9;

/* The trail, as a few hand-placed points smoothed into a curve: in over the
   top edge at the left, across the top to the right, back across the
   middle, out to the right again, and home along the bottom to the
   castle's right end. (Kept as a list of paths, of one, so the game can
   follow any of them.) */
const TRAIL = [[0.1, -0.06], [0.1, 0.08], [0.22, 0.15], [0.45, 0.12], [0.68, 0.13], [0.86, 0.2], [0.9, 0.33],
               [0.78, 0.42], [0.58, 0.38], [0.4, 0.42], [0.34, 0.54], [0.46, 0.63], [0.66, 0.6], [0.84, 0.64],
               [0.88, 0.78], [0.76, 0.91], [0.56, 0.925], [0.3, 0.935]];
const KEYS = [TRAIL];
/* The castle: its middle, the line its front stands on, and its width. */
export const CASTLE = { x: 0.17, y: 0.86, w: 0.32 };
export const CASTLE_BASE = CASTLE.y + 0.12;
export const CHEST = { x: 0.05, y: 0.93 };
/* How far towers and the castle can be built up. */
export const MAX_LVL = 10;
/* The castle starts out small and grows a little with every level, out to
   the left from where the trail meets it, until at the top level it is
   CASTLE's full size. */
export function castleBox(lvl = MAX_LVL){
  const scale = 0.55 + 0.45 * (lvl - 1) / (MAX_LVL - 1), w = CASTLE.w * scale;
  return { x: CASTLE.x + CASTLE.w / 2 - w / 2, w, scale };
}
/* Is (x, y) on the castle, as big as it is at level lvl: the place to
   stand to mend it or build it up. */
export function onCastle(x, y, lvl = MAX_LVL){
  const b = castleBox(lvl);
  return Math.abs(x - b.x) < b.w / 2 + 0.01 && y > CASTLE_BASE - Math.max(0.25, 0.33 * b.scale) && y < 1.02;
}

function catmull(p0, p1, p2, p3, t){
  const t2 = t * t, t3 = t2 * t;
  return [0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
}
function smooth(keys){
  const pts = [];
  for (let i = 0; i < keys.length - 1; i++){
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(keys.length - 1, i + 2)];
    for (let k = 0; k < 12; k++) pts.push(catmull(p0, p1, p2, p3, k / 12));
  }
  pts.push(keys[keys.length - 1]);
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) * ASPECT, pts[i][1] - pts[i - 1][1]));
  return { pts, len, total: len[len.length - 1] };
}
export const PATHS = KEYS.map(smooth);

/* Where on path `p` the distance `s` (screen heights along it) is, and
   which way it's heading. */
export function along(s, p = 0){
  const { pts, len, total } = PATHS[p];
  s = Math.max(0, Math.min(total, s));
  let i = 1;
  while (i < len.length - 1 && len[i] < s) i++;
  const a = pts[i - 1], b = pts[i], k = (s - len[i - 1]) / Math.max(1e-9, len[i] - len[i - 1]);
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dir: b[0] >= a[0] ? 1 : -1 };
}

/* The stone pads where towers can be built: in the gaps between the turns
   of the trail, where a tower reaches it on both sides, and out on the
   bends. */
export const PADS = [[0.31, 0.05], [0.19, 0.24], [0.54, 0.26], [0.77, 0.29], [0.34, 0.32], [0.27, 0.48], [0.47, 0.51],
                     [0.71, 0.5], [0.87, 0.53], [0.5, 0.79], [0.69, 0.785], [0.9, 0.87]].map(([x, y], i) => ({ i, x, y }));
export const PAD_R = 0.055;

/* ---------- the meadow, painted once ---------- */

let cache = null;
function meadow(W, H){
  if (cache && cache.W === W && cache.H === H) return cache.cv;
  let cv = null;
  try { cv = document.createElement('canvas'); cv.width = Math.round(W); cv.height = Math.round(H); if (!cv.getContext || !cv.getContext('2d')) cv = null; } catch { cv = null; }
  cache = { W, H, cv };
  if (cv) paintMeadow(cv.getContext('2d'), W, H);
  return cv;
}

function paintMeadow(c, W, H){
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#9fd585'); g.addColorStop(1, '#86c672');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  /* Soft patches of lighter and darker grass. */
  for (let i = 0; i < 60; i++){
    c.fillStyle = hash(i, 3) < 0.5 ? 'rgba(180,230,150,.3)' : 'rgba(100,160,90,.16)';
    c.beginPath(); c.ellipse(hash(i, 5) * W, hash(i, 7) * H, H * (0.05 + hash(i, 9) * 0.08), H * (0.025 + hash(i, 11) * 0.04), 0, 0, 6.2832); c.fill();
  }
  /* The path: a darker edge, then sand, then a lighter middle. */
  const stroke = (col, w) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const P of PATHS){ c.beginPath(); P.pts.forEach(([x, y], i) => i ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H)); c.stroke(); }
  };
  stroke('#cfb183', H * 0.095); stroke('#ecd8b0', H * 0.075); stroke('rgba(255,246,222,.45)', H * 0.03);
  for (let i = 0; i < 80; i++){
    const k = i % PATHS.length, p = along(hash(i, 13) * PATHS[k].total, k), off = (hash(i, 17) - 0.5) * 0.05;
    c.fillStyle = 'rgba(160,130,95,.25)'; c.beginPath(); c.ellipse(p.x * W + off * H, p.y * H + off * H * 0.5, H * 0.006, H * 0.004, 0, 0, 6.2832); c.fill();
  }
  /* Flowers dotted about. */
  for (let i = 0; i < 70; i++){
    const x = hash(i, 19) * W, y = hash(i, 23) * H;
    if (nearPath(x / W, y / H, 0.07)) continue;
    c.fillStyle = ['#f4fbef', '#f1dc8e', '#f0b8cc', '#cbbdf0'][i % 4];
    for (let k = 0; k < 5; k++){ const a = k * 1.2566; c.beginPath(); c.arc(x + Math.cos(a) * H * 0.005, y + Math.sin(a) * H * 0.005, H * 0.004, 0, 6.2832); c.fill(); }
    c.fillStyle = '#ffb02e'; c.beginPath(); c.arc(x, y, H * 0.003, 0, 6.2832); c.fill();
  }
  /* The trees' shadows on the grass (the trees themselves are drawn over
     everything, swaying). */
  for (const t of TREES){ c.fillStyle = 'rgba(40,80,40,.14)'; c.beginPath(); c.ellipse((t.x + t.r * 0.25 / ASPECT) * W, (t.y + t.r * 0.3) * H, t.r * 0.95 * H, t.r * 0.36 * H, 0, 0, 6.2832); c.fill(); }
}

function nearPath(x, y, d){
  return PATHS.some(P => P.pts.some(([px, py]) => Math.hypot((px - x) * ASPECT, py - y) < d));
}

/* The quiet left side of the meadow: the medical tent, where a hurt
   knight goes to get better - a red tent with a big red cross on a white
   sign, so there's no mistaking it. */
export const TENT = { x: 0.08, y: 0.66 };
/* glow: 0..1, the ground round it lit up, calling a hurt knight over. */
export function drawTent(c, W, H, t, glow = 0){
  const x = TENT.x * W, y = TENT.y * H, s = H * 0.17;
  if (glow > 0){
    const g = c.createRadialGradient(x, y, s * 0.2, x, y, s * 0.9);
    g.addColorStop(0, `rgba(255,220,220,${0.6 * glow})`); g.addColorStop(1, 'rgba(255,220,220,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, s * 0.9, s * 0.45, 0, 0, 6.2832); c.fill();
  }
  c.fillStyle = 'rgba(40,80,40,.2)'; c.beginPath(); c.ellipse(x + s * 0.06, y + s * 0.02, s * 0.62, s * 0.14, 0, 0, 6.2832); c.fill();
  /* The canvas: a ridge tent seen from the front, a shaded side. */
  c.fillStyle = '#ddd5c6'; c.beginPath(); c.moveTo(x - s * 0.58, y); c.lineTo(x - s * 0.1, y - s * 0.72); c.lineTo(x + s * 0.12, y - s * 0.72); c.lineTo(x + s * 0.62, y); c.closePath(); c.fill();
  c.fillStyle = '#f6f2ea'; c.beginPath(); c.moveTo(x - s * 0.48, y); c.lineTo(x, y - s * 0.74); c.lineTo(x + s * 0.48, y); c.closePath(); c.fill();
  /* The door, flaps tied back. */
  c.fillStyle = '#5a4f66'; c.beginPath(); c.moveTo(x - s * 0.16, y); c.lineTo(x, y - s * 0.36); c.lineTo(x + s * 0.16, y); c.closePath(); c.fill();
  /* The sign over the door: a round red badge - a red rim, a thin white
     ring, a red middle - with a bold white cross. */
  const by = y - s * 0.47, b = s * 0.19;
  /* Its own fine dark red lines, not the bold ink - the white ring is thin. */
  const was = c.__noInk; c.__noInk = true;
  c.strokeStyle = '#9e0000'; c.lineWidth = Math.max(1, b * 0.025);
  c.fillStyle = '#d80000'; c.beginPath(); c.arc(x, by, b, 0, 6.2832); c.fill(); c.stroke();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, by, b * 0.88, 0, 6.2832); c.fill(); c.stroke();
  c.fillStyle = '#d80000'; c.beginPath(); c.arc(x, by, b * 0.81, 0, 6.2832); c.fill(); c.stroke();
  const arm = b * 0.5, half = b * 0.155;
  c.fillStyle = '#ffffff'; c.beginPath();
  c.moveTo(x - half, by - arm); c.lineTo(x + half, by - arm); c.lineTo(x + half, by - half); c.lineTo(x + arm, by - half); c.lineTo(x + arm, by + half);
  c.lineTo(x + half, by + half); c.lineTo(x + half, by + arm); c.lineTo(x - half, by + arm); c.lineTo(x - half, by + half); c.lineTo(x - arm, by + half);
  c.lineTo(x - arm, by - half); c.lineTo(x - half, by - half); c.closePath(); c.fill(); c.stroke();
  c.__noInk = was;
  /* A little pennant on the pole. */
  c.strokeStyle = '#8a6a4c'; c.lineWidth = Math.max(1.5, s * 0.025); c.beginPath(); c.moveTo(x, y - s * 0.74); c.lineTo(x, y - s * 0.98); c.stroke();
  c.fillStyle = '#d80000'; c.beginPath(); c.moveTo(x, y - s * 0.98); c.lineTo(x + s * 0.2, y - s * 0.92 + Math.sin(t * 4) * s * 0.02); c.lineTo(x, y - s * 0.86); c.closePath(); c.fill();
}
/* The trees and bushes: a thick jungle round the edges and in the
   corners, kept off the trail, the pads, the castle and the chest. Where
   they are never changes; they're drawn every frame so they can sway, and
   lean when something big stomps. */
export const TREES = (() => {
  const out = [];
  for (let i = 0; i < 260 && out.length < 70; i++){
    const x = hash(i, 29), y = 0.04 + hash(i, 31) * 0.96, bush = hash(i, 41) < 0.4;
    const r = bush ? 0.035 + hash(i, 37) * 0.015 : 0.055 + hash(i, 37) * 0.035;
    /* Clear of the trail, the pads (towers grow tall), the castle as big as
       it gets and the medical tent. */
    if (nearPath(x, y, bush ? 0.075 : 0.095) || PADS.some(p => Math.hypot((p.x - x) * ASPECT, p.y - y) < 0.11 || (Math.abs(p.x - x) * ASPECT < 0.09 && y < p.y && y > p.y - 0.24))) continue;
    if (Math.hypot((x - TENT.x) * ASPECT, y - TENT.y + 0.06) < 0.17 + r) continue;
    if ((Math.abs(x - CASTLE.x) < CASTLE.w / 2 + 0.03 && y > CASTLE_BASE - 0.42) || Math.hypot((x - CHEST.x) * ASPECT, y - CHEST.y) < 0.12) continue;
    if (out.some(t => Math.hypot((t.x - x) * ASPECT, t.y - y) < (t.r + r) * 0.75)) continue;
    out.push({ x, y, r, bush, seed: i });
  }
  return out;
})();

/* One tree, or a bush: lean is how far it tips over, in radians. */
export function drawTree(c, W, H, t, lean = 0){
  const x = t.x * W, y = t.y * H, r = t.r * H;
  c.save(); c.translate(x, y); c.rotate(lean); c.translate(-x, -y);
  /* Soft, muted greens close to the grass, so the jungle stays in the
     background and everything that matters stands out against it. */
  const greens = t.bush ? ['#6fb867', '#79c26f', '#86cb7a'] : ['#63aa60', '#6fb769', '#7cc274'];
  if (!t.bush){ c.fillStyle = '#9a7a5c'; c.beginPath(); c.roundRect(x - r * 0.12, y - r * 0.35, r * 0.24, r * 0.5, r * 0.06); c.fill(); }
  const n = t.bush ? 3 : 5, cy = y - (t.bush ? r * 0.25 : r * 0.7);
  for (let k = 0; k < n; k++){
    const a = k / n * 6.2832 + t.seed, d = t.bush ? r * 0.42 : r * 0.38;
    c.fillStyle = greens[k % 3]; c.beginPath(); c.arc(x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, r * (t.bush ? 0.45 : 0.5), 0, 6.2832); c.fill();
  }
  c.fillStyle = greens[2]; c.beginPath(); c.arc(x - r * 0.05, cy - r * 0.12, r * (t.bush ? 0.38 : 0.45), 0, 6.2832); c.fill();
  /* Sunlight on the top, and the odd berry or blossom. */
  c.fillStyle = 'rgba(235,255,200,.3)'; c.beginPath(); c.arc(x - r * 0.22, cy - r * 0.32, r * 0.2, 0, 6.2832); c.fill();
  if (hash(t.seed, 43) < 0.25){
    c.fillStyle = ['#e8a0a0', '#e8d090', '#e8b0d0'][t.seed % 3];
    for (let k = 0; k < 3; k++){ c.beginPath(); c.arc(x + (hash(t.seed * 3 + k, 47) - 0.5) * r * 0.9, cy + (hash(t.seed * 3 + k, 53) - 0.5) * r * 0.6, r * 0.07, 0, 6.2832); c.fill(); }
  }
  c.restore();
}

/* Ink: everything drawn inside fn gets a bold dark outline - each solid
   shape is first stroked thick in ink, then filled over, so the ink shows
   round its edges (and between its parts, like a cartoon). See-through
   shapes and gradients - shadows, glows, highlights - are left as they are. */
export const INK = '#2b2440';
const solid = (st) => typeof st === 'string' && !/rgba\([^)]*,\s*(0?\.\d+|0)\s*\)/.test(st);
export function inked(c, w, fn){
  const fill = c.fill, stroke = c.stroke, fillRect = c.fillRect;
  const ink = (draw) => {
    const ss = c.strokeStyle, lw = c.lineWidth, lj = c.lineJoin, lc = c.lineCap;
    c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round';
    draw();
    c.strokeStyle = ss; c.lineWidth = lw; c.lineJoin = lj; c.lineCap = lc;
  };
  const on = (st) => !c.__noInk && solid(st) && st !== INK && c.globalAlpha > 0.95;
  c.fill = function(...a){
    if (on(this.fillStyle)) ink(() => { this.lineWidth = w * 2; stroke.call(this); });
    return fill.apply(this, a);
  };
  c.fillRect = function(x, y, rw, rh){
    if (on(this.fillStyle)) ink(() => { this.lineWidth = w * 2; this.strokeRect(x, y, rw, rh); });
    return fillRect.call(this, x, y, rw, rh);
  };
  c.stroke = function(...a){
    if (on(this.strokeStyle)){ const lw = this.lineWidth; ink(() => { this.lineWidth = lw + w * 2; stroke.apply(this, a); }); }
    return stroke.apply(this, a);
  };
  try { fn(); }
  finally { c.fill = fill; c.stroke = stroke; c.fillRect = fillRect; }
}

export function drawMeadow(c, W, H){
  const cv = meadow(W, H);
  if (cv) c.drawImage(cv, 0, 0, W, H); else paintMeadow(c, W, H);
}

/* Sunlight over everything: warm from the top left, the edges of the
   picture a little shaded - painted once per screen size. */
let lightCache = null;
function paintLight(c, W, H){
  let g = c.createRadialGradient(W * 0.18, -H * 0.1, 0, W * 0.18, -H * 0.1, H * 1.4);
  g.addColorStop(0, 'rgba(255,236,190,.22)'); g.addColorStop(0.6, 'rgba(255,236,190,.06)'); g.addColorStop(1, 'rgba(255,236,190,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  g = c.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, H * 1.15);
  g.addColorStop(0, 'rgba(20,40,30,0)'); g.addColorStop(1, 'rgba(20,40,30,.28)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
export function drawLight(c, W, H){
  if (!lightCache || lightCache.W !== W || lightCache.H !== H){
    let cv = null;
    try { cv = document.createElement('canvas'); cv.width = Math.round(W); cv.height = Math.round(H); if (!cv.getContext || !cv.getContext('2d')) cv = null; } catch { cv = null; }
    lightCache = { W, H, cv };
    if (cv) paintLight(cv.getContext('2d'), W, H);
  }
  if (lightCache.cv) c.drawImage(lightCache.cv, 0, 0, W, H); else paintLight(c, W, H);
}

/* A puff of smoke where a monster was: k 0..1 through its life. */
export function drawPoof(c, x, y, r, k){
  c.save();
  c.globalAlpha = (1 - k) * 0.85;
  c.fillStyle = '#ffffff';
  for (let q = 0; q < 6; q++){
    const a = q * 1.047 + 0.3, d = r * (0.3 + 0.7 * k);
    c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * (0.45 - 0.25 * k), 0, 6.2832); c.fill();
  }
  c.restore();
}

/* A butterfly flitting about: wings beating at t. */
export function drawButterfly(c, x, y, s, t, col){
  const f = Math.abs(Math.sin(t * 14));
  c.save(); c.translate(x, y);
  c.fillStyle = col;
  for (const k of [-1, 1]){
    c.beginPath(); c.ellipse(k * s * 0.5 * f, -s * 0.1, s * 0.5 * f + s * 0.05, s * 0.4, k * 0.4, 0, 6.2832); c.fill();
  }
  c.fillStyle = '#4a3f5c'; c.fillRect(-s * 0.06, -s * 0.4, s * 0.12, s * 0.7);
  c.restore();
}

/* ---------- the castle ---------- */

/* The castle, wide along the bottom left. hearts: how many it has left,
   of `max`. waves: pennants flying, one for each wave held off. hit: 0..1,
   a shudder when a monster gets in. mend: 0..1, the scaffold and sparkle
   of a repair under way. */
const PENNANT = '#ff5d5d';
export function drawCastle(c, W, H, t, hearts, max, waves, hit = 0, mend = 0, lvl = 1){
  /* Each upgrade builds it a little bigger, and a little grander. */
  const b = castleBox(lvl);
  const x = b.x * W + Math.sin(t * 60) * hit * H * 0.006, base = CASTLE_BASE * H, s = H * 0.24 * b.scale, hw = b.w * W / 2;
  c.fillStyle = 'rgba(40,60,40,.3)'; c.beginPath(); c.ellipse(x, base, hw * 1.05, s * 0.12, 0, 0, 6.2832); c.fill();
  const wall = '#d9d2c3', dark = '#b8ae9c', roof = '#5a7bd8';
  const tower = (tx, w, h, cone) => {
    c.fillStyle = wall; c.fillRect(tx - w / 2, base - h, w, h);
    c.fillStyle = dark; c.fillRect(tx - w / 2, base - h, w * 0.18, h);
    for (let k = 0; k < 3; k++){ c.fillStyle = wall; c.fillRect(tx - w / 2 + k * w * 0.4, base - h - w * 0.15, w * 0.2, w * 0.15); }
    if (cone){
      c.fillStyle = roof; c.beginPath(); c.moveTo(tx - w * 0.62, base - h); c.lineTo(tx, base - h - w * 1.1); c.lineTo(tx + w * 0.62, base - h); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.moveTo(tx - w * 0.62, base - h); c.lineTo(tx, base - h - w * 1.1); c.lineTo(tx - w * 0.2, base - h); c.closePath(); c.fill();
    }
    c.fillStyle = '#4a3f5c'; c.beginPath(); c.roundRect(tx - w * 0.12, base - h * 0.62, w * 0.24, w * 0.32, w * 0.12); c.fill();
  };
  /* Towers at both ends and along the wall, the keep tallest in the middle. */
  const ends = [x - hw + s * 0.12, x + hw - s * 0.12];
  /* The gatehouse at the right end, where the trail runs in: always big
     enough to hide the end of the trail, however small the castle is. */
  const R = (CASTLE.x + CASTLE.w / 2) * W, gw = Math.max(H * 0.12, s * 0.5), gh = Math.max(H * 0.16, s * 0.7), gx = R - gw * 0.85;
  for (const tx of [x - hw * 0.5, x + hw * 0.5]) tower(tx, s * 0.22, s * 0.62, true);
  c.fillStyle = wall; c.fillRect(ends[0], base - s * 0.42, ends[1] - ends[0], s * 0.42);
  c.fillStyle = dark; c.fillRect(ends[0], base - s * 0.08, ends[1] - ends[0], s * 0.08);
  const n = Math.floor((ends[1] - ends[0]) / (s * 0.12));
  c.fillStyle = wall;
  for (let k = 0; k < n; k++) c.fillRect(ends[0] + k * s * 0.12, base - s * 0.48, s * 0.07, s * 0.07);
  for (const tx of ends) tower(tx, s * 0.26, s * 0.78, true);
  tower(x, s * 0.32, s * 0.98, true);
  /* The gatehouse: a squat stone block with battlements, a dark archway in
     it where the trail goes in, and a portcullis half up. */
  c.fillStyle = wall; c.fillRect(gx, base - gh, gw, gh);
  c.fillStyle = dark; c.fillRect(gx, base - gh, gw * 0.14, gh);
  for (let k = 0; k < 4; k++){ c.fillStyle = wall; c.fillRect(gx + k * gw * 0.28, base - gh - gw * 0.12, gw * 0.16, gw * 0.12); }
  const aw = gw * 0.56, ax = gx + gw * 0.62, abot = base - H * 0.012, atop = base - gh * 0.72;
  c.fillStyle = '#3a3048'; c.beginPath(); c.moveTo(ax - aw / 2, abot); c.lineTo(ax - aw / 2, atop + aw / 2); c.arc(ax, atop + aw / 2, aw / 2, Math.PI, 0); c.lineTo(ax + aw / 2, abot); c.closePath(); c.fill();
  c.strokeStyle = '#6b5a44'; c.lineWidth = Math.max(1.5, aw * 0.05);
  for (let k = 1; k < 4; k++){ const px = ax - aw / 2 + aw * k / 4; c.beginPath(); c.moveTo(px, atop + aw * 0.2); c.lineTo(px, atop + aw * 0.75); c.stroke(); }
  c.beginPath(); c.moveTo(ax - aw / 2, atop + aw * 0.75); c.lineTo(ax + aw / 2, atop + aw * 0.75); c.stroke();
  /* The gate. */
  c.fillStyle = '#6b4a34'; c.beginPath(); c.moveTo(x - s * 0.1, base); c.lineTo(x - s * 0.1, base - s * 0.18); c.arc(x, base - s * 0.18, s * 0.1, Math.PI, 0); c.lineTo(x + s * 0.1, base); c.closePath(); c.fill();
  c.strokeStyle = '#4a3324'; c.lineWidth = s * 0.012;
  for (let k = -1; k <= 1; k++){ c.beginPath(); c.moveTo(x + k * s * 0.05, base); c.lineTo(x + k * s * 0.05, base - s * 0.22); c.stroke(); }
  /* Cracks in the wall for every heart lost. */
  c.strokeStyle = 'rgba(90,70,60,.6)'; c.lineWidth = Math.max(1.5, s * 0.012);
  for (let k = 0; k < max - hearts; k++){
    const cx = ends[0] + (ends[1] - ends[0]) * hash(k, 41), cy = base - s * (0.12 + hash(k, 43) * 0.22), r = s * 0.06;
    c.beginPath(); c.moveTo(cx - r, cy - r * 0.6); c.lineTo(cx - r * 0.2, cy); c.lineTo(cx - r * 0.5, cy + r * 0.5); c.moveTo(cx - r * 0.2, cy); c.lineTo(cx + r * 0.6, cy - r * 0.2); c.stroke();
  }
  /* Golden trim, banners and knobs as it's built up. */
  if (lvl >= 3){ c.fillStyle = '#e8b730'; c.fillRect(ends[0], base - s * 0.42, ends[1] - ends[0], s * 0.03); }
  if (lvl >= 5){
    for (const tx of ends){ c.fillStyle = PENNANT; c.beginPath(); c.moveTo(tx, base - s * 0.7); c.lineTo(tx + s * 0.06, base - s * 0.62); c.lineTo(tx, base - s * 0.54); c.closePath(); c.fill(); }
  }
  if (lvl >= 7){
    for (const tx of [x - hw * 0.5, x + hw * 0.5]){ c.fillStyle = '#e8b730'; c.beginPath(); c.arc(tx, base - s * 0.85, s * 0.05, 0, 6.2832); c.fill(); }
  }
  if (lvl >= MAX_LVL){
    for (const [tx, w, h] of [[x, s * 0.32, s * 0.98], ...ends.map(e => [e, s * 0.26, s * 0.78])]){
      c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(tx, base - h - w * 1.1, s * 0.035, 0, 6.2832); c.fill();
    }
  }
  /* The flag on the keep. */
  const flagTop = base - s * 0.98 - s * 0.35;
  c.strokeStyle = '#5b4636'; c.lineWidth = s * 0.012; c.beginPath(); c.moveTo(x, flagTop + s * 0.02); c.lineTo(x, flagTop - s * 0.18); c.stroke();
  c.fillStyle = lvl >= MAX_LVL ? '#ffd24a' : '#ff5d5d'; c.beginPath(); c.moveTo(x, flagTop - s * 0.18); c.quadraticCurveTo(x + s * 0.1, flagTop - s * 0.16 + Math.sin(t * 4) * s * 0.02, x + s * 0.18, flagTop - s * 0.13); c.lineTo(x, flagTop - s * 0.09); c.closePath(); c.fill();
  /* Pennants along the wall, one for each wave held off (up to a dozen
     shown, then they turn gold). */
  const shown = Math.min(waves, 12);
  for (let k = 0; k < shown; k++){
    const u = (k + 0.5) / 12, px = ends[0] + u * (ends[1] - ends[0]), py = base - s * 0.42 + Math.sin(u * Math.PI) * s * 0.05;
    c.fillStyle = waves > 12 ? '#ffd24a' : `hsl(${k * 30},80%,60%)`;
    c.beginPath(); c.moveTo(px - s * 0.03, py); c.lineTo(px + s * 0.03, py); c.lineTo(px, py + s * 0.07 + Math.sin(t * 3 + k) * s * 0.005); c.closePath(); c.fill();
  }
  /* A repair under way: wooden scaffold and sparkles over the wall. */
  if (mend > 0){
    c.save(); c.globalAlpha = Math.min(1, mend * 2);
    c.strokeStyle = '#b5864f'; c.lineWidth = s * 0.03;
    for (let k = 0; k < 4; k++){ const sx = ends[0] + (ends[1] - ends[0]) * (0.15 + k * 0.23); c.beginPath(); c.moveTo(sx, base); c.lineTo(sx, base - s * 0.55); c.stroke(); }
    c.beginPath(); c.moveTo(ends[0], base - s * 0.3); c.lineTo(ends[1], base - s * 0.3); c.stroke();
    for (let k = 0; k < 6; k++){ const a = t * 3 + k; star(c, x + Math.cos(a) * hw * 0.7, base - s * 0.3 + Math.sin(a * 1.3) * s * 0.15, s * 0.04, '#ffe27a'); }
    c.restore();
  }
  /* Hearts along the wall, above the gate, the same size however big the
     castle: in rows, as many as fit across, stacked up the wall. */
  const r = H * 0.012, gap = r * 2.7, fit = Math.max(1, Math.floor((ends[1] - ends[0]) / gap));
  const rows = Math.ceil(max / fit), perRow = Math.ceil(max / rows);
  for (let k = 0; k < max; k++){
    const row = Math.floor(k / perRow), inRow = Math.min(perRow, max - row * perRow), full = k < hearts;
    const hx = x + (k % perRow - (inRow - 1) / 2) * gap, hy = base - s * 0.28 - row * r * 2.6;
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(hx, hy, r * 1.25, 0, 6.2832); c.fill();
    heart(c, hx, hy, r, full ? '#ff4f6a' : 'rgba(80,60,80,.35)');
  }
}

export function heart(c, x, y, r, col){
  c.fillStyle = col; c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.4);
  c.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  c.fill();
}

/* ---------- pads and towers ---------- */

export function drawPad(c, W, H, pad, glow = 0){
  const x = pad.x * W, y = pad.y * H, r = PAD_R * H;
  if (glow > 0){
    const g = c.createRadialGradient(x, y, r * 0.5, x, y, r * 1.8);
    g.addColorStop(0, `rgba(255,240,170,${0.5 * glow})`); g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.8, 0, 6.2832); c.fill();
  }
  c.fillStyle = 'rgba(40,60,40,.25)'; c.beginPath(); c.ellipse(x, y + r * 0.2, r * 1.05, r * 0.55, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#9b93ad'; c.beginPath(); c.ellipse(x, y, r, r * 0.5, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#d2cde0'; c.beginPath(); c.ellipse(x, y - r * 0.06, r * 0.82, r * 0.38, 0, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(120,110,140,.6)'; c.lineWidth = Math.max(1, r * 0.05);
  for (let k = 0; k < 6; k++){ const a = k * 1.047; c.beginPath(); c.moveTo(x, y - r * 0.06); c.lineTo(x + Math.cos(a) * r * 0.82, y - r * 0.06 + Math.sin(a) * r * 0.38); c.stroke(); }
}

export const TOWER_COLS = { archer: '#c98a4b', cannon: '#6d6f82', frost: '#7fd6ff' };

/* How big a tower is at each level, and how tall, in screen heights: a
   little bigger every time. */
export const towerSize = (lvl) => 0.084 + (lvl - 1) * 0.004;
export const towerTall = (lvl) => towerSize(lvl) * (1.22 + (lvl - 1) * 0.04);
/* Colours for its roof as it goes up: green, blue, red, then gold at the top. */
const TIER = (lvl) => lvl >= MAX_LVL ? '#e8b730' : lvl >= 7 ? '#e2483d' : lvl >= 4 ? '#3f7ad9' : '#4f8f52';

/* A tower on its pad. kind: archer / cannon / frost; lvl 1..MAX_LVL; aim:
   the angle it's facing; col: the builder's colour, on its little banner;
   kick: 0..1, the recoil of a shot just fired. */
export function drawTower(c, W, H, pad, kind, lvl, aim, col, t, kick = 0){
  const x = pad.x * W, base = pad.y * H, s = H * towerSize(lvl), u = (lvl - 1) / (MAX_LVL - 1);
  const top = base - H * towerTall(lvl);
  if (kind === 'archer'){
    c.fillStyle = '#8a5a34';
    c.beginPath(); c.moveTo(x - s * 0.45, base); c.lineTo(x - s * 0.32, top); c.lineTo(x + s * 0.32, top); c.lineTo(x + s * 0.45, base); c.closePath(); c.fill();
    c.strokeStyle = '#6b4426'; c.lineWidth = s * 0.06;
    for (let k = 1; k < 4; k++){ const y = base - (base - top) * k / 4; c.beginPath(); c.moveTo(x - s * 0.42 + k * s * 0.03, y); c.lineTo(x + s * 0.42 - k * s * 0.03, y); c.stroke(); }
    c.fillStyle = '#b5764a'; c.fillRect(x - s * 0.42, top - s * 0.12, s * 0.84, s * 0.14);
    c.fillStyle = TIER(lvl);
    c.beginPath(); c.moveTo(x - s * 0.5, top - s * 0.1); c.lineTo(x, top - s * 0.6); c.lineTo(x + s * 0.5, top - s * 0.1); c.closePath(); c.fill();
    /* The crossbow, turning to aim. */
    c.save(); c.translate(x, top - s * 0.02); c.rotate(aim);
    c.strokeStyle = '#4a3324'; c.lineWidth = s * 0.06; c.beginPath(); c.moveTo(-s * 0.05 - kick * s * 0.08, 0); c.lineTo(s * 0.32, 0); c.stroke();
    c.beginPath(); c.arc(s * 0.22, 0, s * 0.18, -1.2, 1.2); c.stroke();
    c.restore();
  } else if (kind === 'cannon'){
    c.fillStyle = '#8d8fa3';
    c.beginPath(); c.moveTo(x - s * 0.5, base); c.lineTo(x - s * 0.44, top); c.lineTo(x + s * 0.44, top); c.lineTo(x + s * 0.5, base); c.closePath(); c.fill();
    c.fillStyle = lvl >= 4 ? TIER(lvl) : '#a7a9bc'; for (let k = 0; k < 4; k++) c.fillRect(x - s * 0.44 + k * s * 0.26, top - s * 0.12, s * 0.14, s * 0.14);
    c.strokeStyle = 'rgba(80,80,100,.4)'; c.lineWidth = s * 0.03;
    for (let k = 1; k < 3; k++){ const y = base - (base - top) * k / 3; c.beginPath(); c.moveTo(x - s * 0.47, y); c.lineTo(x + s * 0.47, y); c.stroke(); }
    c.save(); c.translate(x, top - s * 0.02); c.rotate(aim);
    c.fillStyle = '#3b3d4a'; c.beginPath(); c.roundRect(-s * 0.1 - kick * s * 0.12, -s * (0.12 + u * 0.06), s * (0.55 + u * 0.2), s * (0.24 + u * 0.12), s * 0.08); c.fill();
    c.restore();
    c.fillStyle = '#3b3d4a'; c.beginPath(); c.arc(x, top - s * 0.02, s * 0.15, 0, 6.2832); c.fill();
  } else {
    c.fillStyle = '#b9d9ec';
    c.beginPath(); c.moveTo(x - s * 0.42, base); c.lineTo(x - s * 0.3, top); c.lineTo(x + s * 0.3, top); c.lineTo(x + s * 0.42, base); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(x - s * 0.3, top, s * 0.12, base - top);
    /* The crystal on top, glowing brighter with each level. */
    const cy = top - s * 0.35, cs = s * (0.36 + u * 0.24);
    const g = c.createRadialGradient(x, cy, 0, x, cy, cs * 2);
    g.addColorStop(0, `rgba(170,235,255,${Math.min(1, 0.45 + u * 0.45 + kick * 0.3)})`); g.addColorStop(1, 'rgba(170,235,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, cy, cs * 2, 0, 6.2832); c.fill();
    c.fillStyle = lvl >= MAX_LVL ? '#ffe27a' : '#7fd6ff';
    c.beginPath(); c.moveTo(x, cy - cs); c.lineTo(x + cs * 0.5, cy); c.lineTo(x, cy + cs * 0.8); c.lineTo(x - cs * 0.5, cy); c.closePath(); c.fill();
    c.fillStyle = '#e6f8ff'; c.beginPath(); c.moveTo(x, cy - cs); c.lineTo(x + cs * 0.2, cy); c.lineTo(x, cy + cs * 0.3); c.closePath(); c.fill();
  }
  /* The builder's banner, and a star for each upgrade. */
  c.strokeStyle = '#5b4636'; c.lineWidth = Math.max(1, s * 0.03);
  c.beginPath(); c.moveTo(x + s * 0.38, base - s * 0.15); c.lineTo(x + s * 0.38, base - s * 0.62); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(x + s * 0.38, base - s * 0.62); c.lineTo(x + s * 0.62, base - s * 0.55 + Math.sin(t * 4 + pad.i) * s * 0.03); c.lineTo(x + s * 0.38, base - s * 0.46); c.closePath(); c.fill();
  /* Stars for its upgrades, in two little rows up its front. */
  for (let k = 1; k < lvl; k++){
    const row = Math.floor((k - 1) / 5), col5 = (k - 1) % 5;
    star(c, x - s * 0.28 + col5 * s * 0.14, base - s * (0.16 + row * 0.16), s * 0.065, '#ffd24a');
  }
}

export function star(c, x, y, r, col){
  c.fillStyle = col; c.beginPath();
  for (let j = 0; j < 10; j++){ const a = -Math.PI / 2 + j * Math.PI / 5, d = (j % 2 ? 0.45 : 1) * r; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  c.closePath(); c.fill();
}

/* A tower as a picture in a bubble, for picking which to build. `cost`
   coins shown as dots under it; dim if there aren't enough. */
export function drawChoice(c, x, y, r, kind, cost, can, fill, col){
  c.save();
  c.globalAlpha = can ? 1 : 0.45;
  c.fillStyle = 'rgba(255,250,235,.95)'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  c.strokeStyle = TOWER_COLS[kind]; c.lineWidth = r * 0.12; c.stroke();
  if (fill > 0){ c.strokeStyle = col; c.lineWidth = r * 0.16; c.beginPath(); c.arc(x, y, r * 1.12, -Math.PI / 2, -Math.PI / 2 + fill * 6.2832); c.stroke(); }
  /* A small tower in the bubble: the same drawing, on a pretend screen
     sized so the tower fits. */
  const S = r * 7;
  drawTower(c, S, S, { x: x / S, y: (y + r * 0.6) / S, i: 0 }, kind, 1, -0.4, 'rgba(0,0,0,0)', 0);
  for (let k = 0; k < cost; k++){
    const cx = x + (k - (cost - 1) / 2) * r * 0.32, cy = y + r * 1.35;
    coin(c, cx, cy, r * 0.13);
  }
  c.restore();
}

export function coin(c, x, y, r){
  c.fillStyle = '#e8a91c'; c.beginPath(); c.ellipse(x, y + r * 0.15, r, r * 0.9, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, 6.2832); c.fill();
}

/* The treasure chest by the castle, with the coins piled in and over it. */
export function drawChest(c, W, H, coins, t){
  const x = CHEST.x * W, y = CHEST.y * H, s = H * 0.07;
  c.fillStyle = 'rgba(40,60,40,.3)'; c.beginPath(); c.ellipse(x, y + s * 0.5, s * 0.8, s * 0.18, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#8a5a34'; c.beginPath(); c.roundRect(x - s * 0.7, y - s * 0.1, s * 1.4, s * 0.6, s * 0.08); c.fill();
  c.fillStyle = '#e8a91c'; c.fillRect(x - s * 0.7, y + s * 0.05, s * 1.4, s * 0.08);
  /* Coins heaped in the chest, a heap that grows. */
  const n = Math.min(coins, 30);
  for (let k = 0; k < n; k++){
    const row = Math.floor(Math.sqrt(k * 2)), u = hash(k, 3) - 0.5;
    coin(c, x + u * s * (1.2 - row * 0.15), y - s * 0.1 - row * s * 0.12 - hash(k, 5) * s * 0.05, s * 0.13);
  }
  /* The lid, propped open. */
  c.fillStyle = '#a06a3e'; c.beginPath(); c.moveTo(x - s * 0.7, y - s * 0.1); c.lineTo(x - s * 0.62, y - s * 0.65); c.lineTo(x + s * 0.62, y - s * 0.65); c.lineTo(x + s * 0.7, y - s * 0.1); c.closePath(); c.fill();
  c.fillStyle = '#e8a91c'; c.fillRect(x - s * 0.05, y - s * 0.65, s * 0.1, s * 0.55);
}

/* ---------- monsters ---------- */

/* A monster at (x, y): kind slime / goblin / bat / ogre; dir which way it's
   walking; hurt: 0..1, a flash when hit; frozen: chilled blue; hp: share of
   health left, for the little bar. */
/* Each kind's colours: every ordinary one green, in its own shade, and its
   meaner level-two sort red. */
const HUES = {
  slime:  [{ body: '#6fdc6a' }, { body: '#e5484d' }],
  goblin: [{ body: '#2f7d4a', skin: '#a6e27a' }, { body: '#7d1f2c', skin: '#e0605a' }],
  bat:    [{ body: '#4fae5c', wing: '#2f7d4a' }, { body: '#c53b46', wing: '#8e1f2e' }],
  ogre:   [{ body: '#5c9e4a', skin: '#8fcf6a', club: '#8a5a34' }, { body: '#b02e2a', skin: '#d9534a', club: '#4a2a1c' }],
  troll:  [{ body: '#3f9d7a', skin: '#7fd0b0', fur: '#eef9ff', horn: '#bfefff' }, { body: '#b8322e', skin: '#e0605a', fur: '#ffe3dc', horn: '#ffd9a0' }]
};
/* How much bigger the red ones are. */
export const RED_SIZE = 1.35;

/* club: an ogre's club lifted, 0..1, winding up to bring it down. red: the
   meaner sort - red, bigger, scowling. */
export function drawMonster(c, x, y, s, kind, t, dir, hurt, frozen, hp, club = 0, red = false){
  const C = HUES[kind][red ? 1 : 0];
  if (red) s *= RED_SIZE;
  c.save();
  const shadow = kind === 'bat' ? 0.5 : 1;
  c.fillStyle = `rgba(40,50,40,${0.25 * shadow})`; c.beginPath(); c.ellipse(x, y + s * 0.05, s * 0.45, s * 0.12, 0, 0, 6.2832); c.fill();
  if (kind === 'slime'){
    const sq = 1 + Math.sin(t * 9) * 0.12;
    c.fillStyle = frozen ? '#8fd8ff' : C.body;
    c.beginPath(); c.moveTo(x - s * 0.45 * sq, y); c.quadraticCurveTo(x - s * 0.5 * sq, y - s * 0.7 / sq, x, y - s * 0.72 / sq); c.quadraticCurveTo(x + s * 0.5 * sq, y - s * 0.7 / sq, x + s * 0.45 * sq, y); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(x - s * 0.15, y - s * 0.5 / sq, s * 0.1, s * 0.06, -0.5, 0, 6.2832); c.fill();
    face(c, x + dir * s * 0.08, y - s * 0.32 / sq, s * 0.5, red);
  } else if (kind === 'goblin'){
    const step = Math.sin(t * 14);
    c.fillStyle = '#3b3d4a';
    for (const k of [-1, 1]){ c.beginPath(); c.ellipse(x + k * s * 0.12, y - s * 0.05 + (k * step > 0 ? -s * 0.06 : 0), s * 0.08, s * 0.06, 0, 0, 6.2832); c.fill(); }
    c.fillStyle = frozen ? '#8fd8ff' : C.body; c.beginPath(); c.roundRect(x - s * 0.22, y - s * 0.45, s * 0.44, s * 0.38, s * 0.12); c.fill();
    c.fillStyle = frozen ? '#b5e6ff' : C.skin;
    c.beginPath(); c.arc(x, y - s * 0.62, s * 0.24, 0, 6.2832); c.fill();
    for (const k of [-1, 1]){ c.beginPath(); c.moveTo(x + k * s * 0.18, y - s * 0.66); c.lineTo(x + k * s * 0.45, y - s * 0.78); c.lineTo(x + k * s * 0.2, y - s * 0.55); c.closePath(); c.fill(); }
    face(c, x + dir * s * 0.06, y - s * 0.62, s * 0.36, red);
  } else if (kind === 'bat'){
    const flap = Math.sin(t * 16), fy = y - s * (0.75 + Math.sin(t * 3) * 0.06);
    c.fillStyle = frozen ? '#8fd8ff' : C.wing;
    for (const k of [-1, 1]){
      c.beginPath(); c.moveTo(x, fy); c.quadraticCurveTo(x + k * s * 0.4, fy - s * 0.3 * flap, x + k * s * 0.7, fy - s * 0.1 * flap);
      c.quadraticCurveTo(x + k * s * 0.45, fy + s * 0.05, x + k * s * 0.3, fy + s * 0.15); c.quadraticCurveTo(x + k * s * 0.15, fy + s * 0.05, x, fy + s * 0.1); c.closePath(); c.fill();
    }
    c.fillStyle = frozen ? '#b5e6ff' : C.body; c.beginPath(); c.arc(x, fy, s * 0.2, 0, 6.2832); c.fill();
    for (const k of [-1, 1]){ c.beginPath(); c.moveTo(x + k * s * 0.08, fy - s * 0.14); c.lineTo(x + k * s * 0.16, fy - s * 0.3); c.lineTo(x + k * s * 0.18, fy - s * 0.1); c.closePath(); c.fill(); }
    face(c, x, fy + s * 0.02, s * 0.3, red);
  } else if (kind === 'troll'){
    /* The Frost Troll: big and shaggy, white frosty fur along its back,
       horns of ice; club here is its arms going up for a blizzard. */
    const step = Math.sin(t * 4);
    c.fillStyle = '#4a5560';
    for (const k of [-1, 1]){ c.beginPath(); c.roundRect(x + k * s * 0.22 - s * 0.11, y - s * 0.22 + (k * step > 0 ? -s * 0.04 : 0), s * 0.22, s * 0.22, s * 0.07); c.fill(); }
    c.fillStyle = frozen ? '#8fd8ff' : C.body; c.beginPath(); c.ellipse(x, y - s * 0.55, s * 0.46, s * 0.42, 0, 0, 6.2832); c.fill();
    c.fillStyle = C.skin; c.beginPath(); c.ellipse(x, y - s * 0.36, s * 0.24, s * 0.2, 0, 0, 6.2832); c.fill();
    /* Arms: down by its sides, or flung up high. */
    c.strokeStyle = C.body; c.lineWidth = s * 0.14; c.lineCap = 'round';
    for (const k of [-1, 1]){
      const ex = x + k * s * 0.42, ey = y - s * 0.7, shake = club > 0 ? Math.sin(t * 30 + k) * s * 0.02 : 0;
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + k * s * (0.08 + 0.1 * club) + shake, ey + s * (0.3 - 0.8 * club)); c.stroke();
    }
    /* Frosty fur in a shaggy fringe over the top of its head. */
    c.fillStyle = C.fur; c.beginPath(); c.moveTo(x - s * 0.36, y - s * 0.84);
    for (let k = 0; k <= 8; k++) c.lineTo(x - s * 0.36 + k * s * 0.09, y - s * (k % 2 ? 0.9 : 1.04) - Math.sin(k / 8 * Math.PI) * s * 0.06);
    c.lineTo(x + s * 0.36, y - s * 0.84); c.quadraticCurveTo(x, y - s * 0.9, x - s * 0.36, y - s * 0.84); c.closePath(); c.fill();
    c.fillStyle = C.horn;
    for (const k of [-1, 1]){ c.beginPath(); c.moveTo(x + k * s * 0.18, y - s * 0.96); c.lineTo(x + k * s * 0.34, y - s * 1.3); c.lineTo(x + k * s * 0.3, y - s * 0.9); c.closePath(); c.fill(); }
    face(c, x + dir * s * 0.03, y - s * 0.66, s * 0.4, true);
  } else {
    const step = Math.sin(t * 6);
    c.fillStyle = '#5b4636';
    for (const k of [-1, 1]){ c.beginPath(); c.roundRect(x + k * s * 0.2 - s * 0.1, y - s * 0.25 + (k * step > 0 ? -s * 0.05 : 0), s * 0.2, s * 0.25, s * 0.06); c.fill(); }
    c.fillStyle = frozen ? '#8fd8ff' : C.body; c.beginPath(); c.ellipse(x, y - s * 0.55, s * 0.42, s * 0.38, 0, 0, 6.2832); c.fill();
    c.fillStyle = frozen ? '#b5e6ff' : C.skin; c.beginPath(); c.arc(x, y - s * 0.95, s * 0.24, 0, 6.2832); c.fill();
    c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(x - s * 0.2, y - s * 1.12); for (let k = 0; k < 5; k++){ c.lineTo(x - s * 0.2 + (k + 0.5) * s * 0.08, y - s * (k % 2 ? 1.22 : 1.32)); } c.lineTo(x + s * 0.2, y - s * 1.12); c.closePath(); c.fill();
    face(c, x + dir * s * 0.04, y - s * 0.93, s * 0.36, red);
    c.fillStyle = C.club; c.save(); c.translate(x + dir * s * 0.45, y - s * 0.55); c.rotate(dir * (0.5 - club * 2.1) + Math.sin(t * 6) * 0.15 * (1 - club) + (club > 0 ? Math.sin(t * 40) * 0.05 : 0)); c.fillRect(-s * 0.05, -s * 0.4, s * 0.1, s * 0.45); c.beginPath(); c.arc(0, -s * 0.42, s * 0.12 * (1 + club * 0.3), 0, 6.2832); c.fill(); c.restore();
  }
  c.restore();
  /* A flash when it's hit: a quick white glow over it. (Not a canvas
     filter - those are far too slow with a crowd of monsters.) */
  const big = kind === 'ogre' || kind === 'troll';
  if (hurt > 0){
    c.fillStyle = `rgba(255,255,255,${0.55 * hurt})`;
    c.beginPath(); c.ellipse(x, y - s * (kind === 'bat' ? 0.75 : big ? 0.6 : 0.38), s * 0.45, s * (big ? 0.6 : 0.4), 0, 0, 6.2832); c.fill();
  }
  if (frozen){ c.fillStyle = 'rgba(220,245,255,.8)'; for (let k = 0; k < 3; k++) star(c, x + (k - 1) * s * 0.25, y - s * (kind === 'bat' ? 1.05 : 0.95), s * 0.06, 'rgba(220,245,255,.9)'); }
  if (hp < 1){
    const bw = s * 0.6, by = y - s * (big ? 1.45 : kind === 'bat' ? 1.15 : 1.0);
    c.fillStyle = 'rgba(40,30,50,.55)'; c.fillRect(x - bw / 2, by, bw, s * 0.07);
    c.fillStyle = hp > 0.5 ? '#6fdc6a' : hp > 0.25 ? '#ffd24a' : '#ff5d5d'; c.fillRect(x - bw / 2, by, bw * Math.max(0, hp), s * 0.07);
  }
}

/* A monster's face: a silly smile - or, mean, a scowl, with cross brows. */
function face(c, x, y, s, mean = false){
  /* A face draws its own fine lines, not the bold ink - small eyes drown in
     a thick outline. */
  const was = c.__noInk; c.__noInk = true;
  for (const k of [-1, 1]){
    const ex = x + k * s * 0.22;
    c.fillStyle = mean ? '#ffe27a' : '#ffffff'; c.strokeStyle = INK; c.lineWidth = Math.max(1, s * 0.035);
    c.beginPath(); c.arc(ex, y, s * 0.17, 0, 6.2832); c.fill(); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(ex + s * 0.02, y + s * 0.03, s * 0.075, 0, 6.2832); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ex + s * 0.045, y - s * 0.005, s * 0.025, 0, 6.2832); c.fill();
  }
  c.strokeStyle = INK; c.lineWidth = Math.max(1, s * 0.05); c.lineCap = 'round';
  if (mean){
    for (const k of [-1, 1]){ c.beginPath(); c.moveTo(x + k * s * 0.4, y - s * 0.25); c.lineTo(x + k * s * 0.08, y - s * 0.13); c.stroke(); }
    c.beginPath(); c.arc(x, y + s * 0.32, s * 0.14, 1.2 * Math.PI, 1.8 * Math.PI); c.stroke();
  } else {
    c.beginPath(); c.arc(x, y + s * 0.18, s * 0.14, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
  }
  c.__noInk = was;
}

/* ---------- shots ---------- */

export function drawShot(c, W, H, s){
  const x = s.x * W, y = s.y * H;
  if (s.kind === 'arrow'){
    const a = Math.atan2(s.vy, s.vx * W / H);
    c.save(); c.translate(x, y); c.rotate(a);
    /* A faint streak behind it. */
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = Math.max(1, H * 0.002); c.beginPath(); c.moveTo(-H * 0.06, 0); c.lineTo(-H * 0.02, 0); c.stroke();
    c.strokeStyle = '#6b4426'; c.lineWidth = Math.max(1.5, H * 0.003); c.beginPath(); c.moveTo(-H * 0.02, 0); c.lineTo(H * 0.015, 0); c.stroke();
    c.fillStyle = '#c4bfd0'; c.beginPath(); c.moveTo(H * 0.022, 0); c.lineTo(H * 0.012, -H * 0.005); c.lineTo(H * 0.012, H * 0.005); c.closePath(); c.fill();
    c.restore();
  } else if (s.kind === 'ball'){
    const lift = Math.sin(Math.min(1, s.k) * Math.PI) * H * 0.12;
    c.fillStyle = 'rgba(40,50,40,.25)'; c.beginPath(); c.ellipse(x, y, H * 0.012, H * 0.005, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#2b2d38'; c.beginPath(); c.arc(x, y - lift, H * 0.012, 0, 6.2832); c.fill();
  } else {
    const g = c.createRadialGradient(x, y, 0, x, y, H * 0.02);
    g.addColorStop(0, 'rgba(230,250,255,1)'); g.addColorStop(1, 'rgba(130,210,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, H * 0.02, 0, 6.2832); c.fill();
  }
}

/* ---------- the children's knights ---------- */

/* A little knight, goblin-sized, at (x, y) - its feet - in the child's
   colour: a tunic, a round helmet with a window for their face, a shield
   and a little sword. walk: 0..1, how hard it's walking (legs and bob);
   clap: 0..1 just after a clap, arms flung out. face(x, y, r) paints the
   face into the clipped helmet window. */
/* blade: the sword's size (1 is ordinary); bladeCol, its colour. */
export function drawKnight(c, x, y, s, t, col, dir, walk, clap, face, swing = 0, blade = 1, bladeCol = '#dfe3ee'){
  const bob = Math.abs(Math.sin(t * 10)) * s * 0.05 * walk;
  c.fillStyle = 'rgba(40,50,40,.28)'; c.beginPath(); c.ellipse(x, y + s * 0.03, s * 0.32, s * 0.09, 0, 0, 6.2832); c.fill();
  c.save(); c.translate(x, y - bob);
  /* Legs. */
  c.strokeStyle = '#4a4f63'; c.lineWidth = s * 0.1; c.lineCap = 'round';
  for (const k of [-1, 1]){ const st = Math.sin(t * 10 + (k > 0 ? Math.PI : 0)) * s * 0.06 * walk; c.beginPath(); c.moveTo(k * s * 0.08, -s * 0.28); c.lineTo(k * s * 0.09 + st, -s * 0.02); c.stroke(); }
  /* Tunic over grey mail. */
  c.fillStyle = '#9aa0b4'; c.beginPath(); c.roundRect(-s * 0.2, -s * 0.58, s * 0.4, s * 0.34, s * 0.08); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(-s * 0.17, -s * 0.56); c.lineTo(s * 0.17, -s * 0.56); c.lineTo(s * 0.21, -s * 0.24); c.lineTo(-s * 0.21, -s * 0.24); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-s * 0.03, -s * 0.54, s * 0.06, s * 0.28);
  /* Arms: by the sides, or flung wide in a clap. */
  const spread = clap > 0 ? 1 : 0;
  c.strokeStyle = '#9aa0b4'; c.lineWidth = s * 0.09;
  for (const k of [-1, 1]){
    /* The sword arm swings up and over when it strikes. */
    const sw = k === dir ? Math.sin(swing * Math.PI) : 0;
    const hx = k * s * (0.24 + spread * 0.14 + sw * 0.1), hy = -s * (0.36 + spread * 0.18 + sw * 0.2);
    c.beginPath(); c.moveTo(k * s * 0.17, -s * 0.52); c.lineTo(hx, hy); c.stroke();
    if (k === dir){
      /* The sword. */
      c.strokeStyle = bladeCol; c.lineWidth = s * 0.05 * (0.6 + 0.4 * blade);
      const ta = -1.3 + swing * 2.2, len = s * 0.32 * blade;
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + k * Math.cos(ta) * len, hy + Math.sin(ta) * len); c.stroke();
      c.strokeStyle = '#8a5a34'; c.lineWidth = s * 0.05; c.beginPath(); c.moveTo(hx - s * 0.06, hy - s * 0.02); c.lineTo(hx + s * 0.06, hy - s * 0.02); c.stroke();
      c.strokeStyle = '#9aa0b4'; c.lineWidth = s * 0.09;
    } else {
      /* The shield, in their colour. */
      c.fillStyle = col; c.strokeStyle = '#ffffff'; c.lineWidth = s * 0.025;
      c.beginPath(); c.moveTo(hx - s * 0.09, hy - s * 0.1); c.lineTo(hx + s * 0.09, hy - s * 0.1); c.lineTo(hx + s * 0.08, hy + s * 0.04); c.lineTo(hx, hy + s * 0.12); c.lineTo(hx - s * 0.08, hy + s * 0.04); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#9aa0b4'; c.lineWidth = s * 0.09;
    }
  }
  /* Helmet with a round window for the face, and a plume in their colour. */
  const hy = -s * 0.76, r = s * 0.2;
  c.fillStyle = '#c4c9d8'; c.beginPath(); c.arc(0, hy, r * 1.18, 0, 6.2832); c.fill();
  c.save(); c.beginPath(); c.arc(0, hy + r * 0.05, r * 0.86, 0, 6.2832); c.clip();
  c.fillStyle = col; c.fillRect(-r, hy - r, r * 2, r * 2);
  face(0, hy + r * 0.05, r * 0.86);
  c.restore();
  c.fillStyle = col;
  c.beginPath(); c.ellipse(0, hy - r * 1.3, r * 0.3, r * 0.42, Math.sin(t * 3) * 0.2, 0, 6.2832); c.fill();
  c.restore();
}

/* A knight frozen in a block of ice: crack 0..1 as it's wiggled free. */
export function drawIceBlock(c, x, y, s, crack, t){
  const w = s * 0.95, h = s * 1.3, top = y - s * 1.18, wob = Math.sin(t * 30) * s * 0.01 * crack;
  c.save(); c.translate(wob, 0);
  c.fillStyle = 'rgba(190,235,255,.6)'; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = Math.max(1.5, s * 0.03);
  c.beginPath(); c.roundRect(x - w / 2, top, w, h, s * 0.12); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.45)';
  c.beginPath(); c.moveTo(x - w * 0.38, top + h * 0.1); c.lineTo(x - w * 0.2, top + h * 0.1); c.lineTo(x - w * 0.36, top + h * 0.55); c.lineTo(x - w * 0.42, top + h * 0.45); c.closePath(); c.fill();
  /* Cracks, more of them the nearer it is to breaking. */
  c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = Math.max(1.5, s * 0.025);
  const n = Math.floor(crack * 3);
  for (let k = 0; k < n; k++){
    const sx = x + (hash(k, 5) - 0.5) * w * 0.7, sy = top + h * (0.2 + hash(k, 7) * 0.6);
    c.beginPath(); c.moveTo(sx, sy);
    for (let q = 1; q <= 3; q++) c.lineTo(sx + (hash(k * 3 + q, 11) - 0.5) * w * 0.5, sy + (hash(k * 3 + q, 13) - 0.5) * h * 0.4);
    c.stroke();
  }
  c.restore();
}

/* The blizzard gathering: snow swirling down over everything, the meadow
   turning blue, k 0..1. */
export function drawBlizzard(c, W, H, k, t){
  if (k <= 0) return;
  c.save();
  c.fillStyle = `rgba(160,210,255,${0.22 * k})`; c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffffff';
  const n = Math.round(160 * k);
  for (let q = 0; q < n; q++){
    const sp = 0.15 + hash(q, 3) * 0.25;
    const fx = ((hash(q, 1) + t * 0.05 * (hash(q, 9) - 0.3) + Math.sin(t * 2 + q) * 0.01) % 1 + 1) % 1, fy = ((hash(q, 2) + t * sp) % 1 + 1) % 1;
    c.globalAlpha = (0.5 + 0.5 * hash(q, 4)) * k;
    c.beginPath(); c.arc(fx * W, fy * H, H * (0.003 + 0.004 * hash(q, 6)), 0, 6.2832); c.fill();
  }
  c.restore();
}

/* The warning on the ground round an ogre about to bring its club down:
   k 0..1 as it winds up, the ring filling in from the middle out. */
export function drawSlamRing(c, x, y, r, k, t){
  c.save();
  /* Round, as the reach is: whoever is inside it when the club comes down is hit. */
  const rx = r, ry = r;
  c.globalAlpha = 0.5 + 0.3 * Math.abs(Math.sin(t * 10));
  c.strokeStyle = '#ff5d3d'; c.lineWidth = Math.max(2, r * 0.07);
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.2832); c.stroke();
  c.globalAlpha = 0.35;
  c.fillStyle = '#ff5d3d'; c.beginPath(); c.ellipse(x, y, rx * k, ry * k, 0, 0, 6.2832); c.fill();
  c.restore();
}

/* Where a knight is heading: a little flag in the child's colour. */
export function drawMarker(c, x, y, s, col, t){
  c.fillStyle = 'rgba(40,50,40,.25)'; c.beginPath(); c.ellipse(x, y, s * 0.18, s * 0.06, 0, 0, 6.2832); c.fill();
  c.strokeStyle = '#5b4636'; c.lineWidth = Math.max(1.5, s * 0.04); c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s * 0.55); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(x, y - s * 0.55); c.lineTo(x + s * 0.3, y - s * 0.46 + Math.sin(t * 6) * s * 0.03); c.lineTo(x, y - s * 0.36); c.closePath(); c.fill();
}

/* A ring filling over something being worked on, with an icon inside. */
export function drawWorkRing(c, x, y, r, k, col){
  c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = r * 0.16; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
  if (k > 0){ c.strokeStyle = col; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, k) * 6.2832); c.stroke(); }
}

/* A little hammer, for the work being done. */
export function drawHammer(c, x, y, s, a){
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = '#8a5a34'; c.fillRect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.7);
  c.fillStyle = '#9aa0b4'; c.beginPath(); c.roundRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.24, s * 0.05); c.fill();
  c.restore();
}
