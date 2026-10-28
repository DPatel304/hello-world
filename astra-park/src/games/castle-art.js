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
               [0.88, 0.78], [0.76, 0.9], [0.56, 0.9], [0.3, 0.9]];
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
                     [0.71, 0.5], [0.87, 0.53], [0.5, 0.78], [0.69, 0.77], [0.9, 0.87]].map(([x, y], i) => ({ i, x, y }));
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
  g.addColorStop(0, '#8fcf6e'); g.addColorStop(1, '#6db657');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  /* Soft patches of lighter and darker grass. */
  for (let i = 0; i < 60; i++){
    c.fillStyle = hash(i, 3) < 0.5 ? 'rgba(160,220,120,.35)' : 'rgba(80,150,70,.25)';
    c.beginPath(); c.ellipse(hash(i, 5) * W, hash(i, 7) * H, H * (0.05 + hash(i, 9) * 0.08), H * (0.025 + hash(i, 11) * 0.04), 0, 0, 6.2832); c.fill();
  }
  /* The path: a darker edge, then sand, then a lighter middle. */
  const stroke = (col, w) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const P of PATHS){ c.beginPath(); P.pts.forEach(([x, y], i) => i ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H)); c.stroke(); }
  };
  stroke('#b88a55', H * 0.095); stroke('#e3c48e', H * 0.075); stroke('rgba(255,240,200,.45)', H * 0.03);
  for (let i = 0; i < 80; i++){
    const k = i % PATHS.length, p = along(hash(i, 13) * PATHS[k].total, k), off = (hash(i, 17) - 0.5) * 0.05;
    c.fillStyle = 'rgba(150,115,70,.4)'; c.beginPath(); c.ellipse(p.x * W + off * H, p.y * H + off * H * 0.5, H * 0.006, H * 0.004, 0, 0, 6.2832); c.fill();
  }
  /* Flowers dotted about. */
  for (let i = 0; i < 70; i++){
    const x = hash(i, 19) * W, y = hash(i, 23) * H;
    if (nearPath(x / W, y / H, 0.07)) continue;
    c.fillStyle = ['#ffffff', '#ffd84a', '#ff8fb8', '#b9a2ff'][i % 4];
    for (let k = 0; k < 5; k++){ const a = k * 1.2566; c.beginPath(); c.arc(x + Math.cos(a) * H * 0.005, y + Math.sin(a) * H * 0.005, H * 0.004, 0, 6.2832); c.fill(); }
    c.fillStyle = '#ffb02e'; c.beginPath(); c.arc(x, y, H * 0.003, 0, 6.2832); c.fill();
  }
  /* Trees round the edges, kept off the path and the pads. */
  for (let i = 0; i < 46; i++){
    const x = hash(i, 29), y = 0.05 + hash(i, 31) * 0.95;
    if (nearPath(x, y, 0.1) || PADS.some(p => Math.hypot((p.x - x) * ASPECT, p.y - y) < 0.1) || onCastle(x, y + 0.08) || Math.hypot((x - CHEST.x) * ASPECT, y - CHEST.y) < 0.1) continue;
    tree(c, x * W, y * H, H * (0.06 + hash(i, 37) * 0.03), i);
  }
}

function nearPath(x, y, d){
  return PATHS.some(P => P.pts.some(([px, py]) => Math.hypot((px - x) * ASPECT, py - y) < d));
}

function tree(c, x, y, r, seed){
  c.fillStyle = 'rgba(40,80,40,.25)'; c.beginPath(); c.ellipse(x + r * 0.2, y + r * 0.35, r * 0.9, r * 0.35, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#6b4a34'; c.fillRect(x - r * 0.12, y - r * 0.1, r * 0.24, r * 0.45);
  const greens = ['#3f8f4f', '#4fa65a', '#5cb866'];
  for (let k = 0; k < 4; k++){ const a = k * 1.57 + seed; c.fillStyle = greens[k % 3]; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.35, y - r * 0.45 + Math.sin(a) * r * 0.25, r * 0.55, 0, 6.2832); c.fill(); }
  c.fillStyle = 'rgba(220,255,190,.35)'; c.beginPath(); c.arc(x - r * 0.2, y - r * 0.75, r * 0.25, 0, 6.2832); c.fill();
}

export function drawMeadow(c, W, H){
  const cv = meadow(W, H);
  if (cv) c.drawImage(cv, 0, 0, W, H); else paintMeadow(c, W, H);
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
  for (const tx of [x - hw * 0.5, x + hw * 0.5]) tower(tx, s * 0.22, s * 0.62, true);
  c.fillStyle = wall; c.fillRect(ends[0], base - s * 0.42, ends[1] - ends[0], s * 0.42);
  c.fillStyle = dark; c.fillRect(ends[0], base - s * 0.08, ends[1] - ends[0], s * 0.08);
  const n = Math.floor((ends[1] - ends[0]) / (s * 0.12));
  c.fillStyle = wall;
  for (let k = 0; k < n; k++) c.fillRect(ends[0] + k * s * 0.12, base - s * 0.48, s * 0.07, s * 0.07);
  for (const tx of ends) tower(tx, s * 0.26, s * 0.78, true);
  tower(x, s * 0.32, s * 0.98, true);
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
  c.fillStyle = '#a8a2b4'; c.beginPath(); c.ellipse(x, y, r, r * 0.5, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#c4bfd0'; c.beginPath(); c.ellipse(x, y - r * 0.06, r * 0.82, r * 0.38, 0, 0, 6.2832); c.fill();
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
  ogre:   [{ body: '#5c9e4a', skin: '#8fcf6a', club: '#8a5a34' }, { body: '#b02e2a', skin: '#d9534a', club: '#4a2a1c' }]
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
  if (hurt > 0){
    c.fillStyle = `rgba(255,255,255,${0.55 * hurt})`;
    c.beginPath(); c.ellipse(x, y - s * (kind === 'bat' ? 0.75 : kind === 'ogre' ? 0.6 : 0.38), s * 0.45, s * (kind === 'ogre' ? 0.6 : 0.4), 0, 0, 6.2832); c.fill();
  }
  if (frozen){ c.fillStyle = 'rgba(220,245,255,.8)'; for (let k = 0; k < 3; k++) star(c, x + (k - 1) * s * 0.25, y - s * (kind === 'bat' ? 1.05 : 0.95), s * 0.06, 'rgba(220,245,255,.9)'); }
  if (hp < 1){
    const bw = s * 0.6, by = y - s * (kind === 'ogre' ? 1.45 : kind === 'bat' ? 1.15 : 1.0);
    c.fillStyle = 'rgba(40,30,50,.55)'; c.fillRect(x - bw / 2, by, bw, s * 0.07);
    c.fillStyle = hp > 0.5 ? '#6fdc6a' : hp > 0.25 ? '#ffd24a' : '#ff5d5d'; c.fillRect(x - bw / 2, by, bw * Math.max(0, hp), s * 0.07);
  }
}

/* A monster's face: a silly smile - or, mean, a scowl, with cross brows. */
function face(c, x, y, s, mean = false){
  for (const k of [-1, 1]){
    c.fillStyle = mean ? '#ffe27a' : '#ffffff'; c.beginPath(); c.arc(x + k * s * 0.22, y, s * 0.16, 0, 6.2832); c.fill();
    c.fillStyle = '#2b2440'; c.beginPath(); c.arc(x + k * s * 0.22, y + s * 0.03, s * 0.09, 0, 6.2832); c.fill();
  }
  c.strokeStyle = '#2b2440'; c.lineWidth = Math.max(1, s * 0.06); c.lineCap = 'round';
  if (mean){
    for (const k of [-1, 1]){ c.beginPath(); c.moveTo(x + k * s * 0.4, y - s * 0.24); c.lineTo(x + k * s * 0.08, y - s * 0.12); c.stroke(); }
    c.beginPath(); c.arc(x, y + s * 0.32, s * 0.14, 1.2 * Math.PI, 1.8 * Math.PI); c.stroke();
    return;
  }
  c.beginPath(); c.arc(x, y + s * 0.18, s * 0.14, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
}

/* ---------- shots ---------- */

export function drawShot(c, W, H, s){
  const x = s.x * W, y = s.y * H;
  if (s.kind === 'arrow'){
    const a = Math.atan2(s.vy, s.vx * W / H);
    c.save(); c.translate(x, y); c.rotate(a);
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

/* The war horn on its post, where the monsters come in. left: 0..1 of the
   build phase still to go, as a ring round it; hold: 0..1 of the two-hand
   hold that blows it to call the wave early. */
export function drawHorn(c, x, y, s, t, left, hold){
  c.fillStyle = 'rgba(40,50,40,.25)'; c.beginPath(); c.ellipse(x, y + s * 0.62, s * 0.3, s * 0.08, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#6b4a34'; c.fillRect(x - s * 0.05, y, s * 0.1, s * 0.62);
  /* The ring: the time left, draining; and the hold, filling over it. */
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = s * 0.07;
  c.beginPath(); c.arc(x, y - s * 0.05, s * 0.62, 0, 6.2832); c.stroke();
  c.strokeStyle = '#ffd24a'; c.beginPath(); c.arc(x, y - s * 0.05, s * 0.62, -Math.PI / 2, -Math.PI / 2 + left * 6.2832); c.stroke();
  if (hold > 0){ c.strokeStyle = '#ff5d5d'; c.lineWidth = s * 0.1; c.beginPath(); c.arc(x, y - s * 0.05, s * 0.74, -Math.PI / 2, -Math.PI / 2 + hold * 6.2832); c.stroke(); }
  /* The horn: a curl of ivory with a gold rim, wobbling when it's held. */
  c.save(); c.translate(x, y - s * 0.05); c.rotate(-0.3 + (hold > 0 ? Math.sin(t * 30) * 0.05 : 0));
  c.fillStyle = '#f3e6c4';
  c.beginPath(); c.moveTo(-s * 0.42, s * 0.04); c.quadraticCurveTo(-s * 0.05, s * 0.3, s * 0.3, -s * 0.05);
  c.lineTo(s * 0.36, -s * 0.28); c.quadraticCurveTo(-s * 0.05, s * 0.08, -s * 0.42, -s * 0.02); c.closePath(); c.fill();
  c.fillStyle = '#e8a91c'; c.beginPath(); c.ellipse(s * 0.33, -s * 0.17, s * 0.06, s * 0.14, 0.3, 0, 6.2832); c.fill();
  c.fillStyle = '#c9a66b'; for (const u of [-0.2, 0.05]){ c.fillRect(s * u - s * 0.02, -s * 0.06 + u * s * 0.3, s * 0.04, s * 0.16); }
  c.restore();
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
