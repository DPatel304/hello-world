/* Castle Defense, painted. A sunny meadow seen from above at a slant: two
   sandy paths wind down from dark caves in the top corners to a little
   castle at the bottom, meeting at its gate, with round stone pads beside
   them where towers can stand. The
   meadow, the path and the trees never move, so they're painted once per
   screen size; towers, monsters and arrows are drawn over them.

   Positions are x in screen widths, y in screen heights; sizes are in
   screen heights. */

const hash = (i, k = 1) => ((((i + 7919) * 2654435761 * k) % 4294967296) + 4294967296) % 4294967296 / 4294967296;
const ASPECT = 16 / 9;

/* The two paths, as a few hand-placed points each smoothed into a curve:
   the left one winds down the left side, the right one is its mirror. */
const LEFT = [[0.2, 0.02], [0.2, 0.14], [0.3, 0.22], [0.37, 0.33], [0.3, 0.44], [0.16, 0.5], [0.12, 0.62],
              [0.2, 0.72], [0.33, 0.76], [0.42, 0.85], [0.48, 0.9]];
const KEYS = [LEFT, LEFT.map(([x, y]) => [1 - x, y])];
export const CASTLE = { x: 0.5, y: 0.76 };
export const CAVES = [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }];
export const CHEST = { x: 0.62, y: 0.92 };

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

/* The stone pads where towers can be built: just off the paths, each where
   a tower reaches the most of one - and one in the middle that reaches
   both. The right side mirrors the left. */
const LEFT_PADS = [[0.31, 0.13], [0.24, 0.27], [0.36, 0.48], [0.25, 0.57], [0.34, 0.65], [0.11, 0.73], [0.31, 0.85]];
export const PADS = [...LEFT_PADS, ...LEFT_PADS.map(([x, y]) => [+(1 - x).toFixed(2), y]), [0.5, 0.36]].map(([x, y], i) => ({ i, x, y }));
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
    const k = i % 2, p = along(hash(i, 13) * PATHS[k].total, k), off = (hash(i, 17) - 0.5) * 0.05;
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
  /* The caves the monsters come from. */
  for (const CAVE of CAVES){
  const cx = CAVE.x * W, cy = CAVE.y * H;
  c.fillStyle = '#7d7f8c'; c.beginPath(); c.ellipse(cx, cy - H * 0.02, H * 0.13, H * 0.13, 0, Math.PI, 0); c.lineTo(cx + H * 0.13, cy + H * 0.06); c.lineTo(cx - H * 0.13, cy + H * 0.06); c.closePath(); c.fill();
  c.fillStyle = '#9a9cab';
  for (const [dx, dy, r] of [[-0.09, -0.08, 0.04], [0.06, -0.11, 0.035], [0.1, -0.03, 0.03]]){ c.beginPath(); c.arc(cx + dx * H, cy + dy * H, r * H, 0, 6.2832); c.fill(); }
  c.fillStyle = '#2b2236'; c.beginPath(); c.ellipse(cx + H * 0.01, cy + H * 0.01, H * 0.07, H * 0.07, 0, Math.PI, 0); c.lineTo(cx + H * 0.08, cy + H * 0.05); c.lineTo(cx - H * 0.06, cy + H * 0.05); c.closePath(); c.fill();
  }
  /* Trees round the edges, kept off the path and the pads. */
  for (let i = 0; i < 46; i++){
    const x = hash(i, 29), y = 0.05 + hash(i, 31) * 0.95;
    if (nearPath(x, y, 0.1) || PADS.some(p => Math.hypot((p.x - x) * ASPECT, p.y - y) < 0.1) || Math.hypot((x - CASTLE.x) * ASPECT, y - CASTLE.y) < 0.24 || CAVES.some(cv => Math.hypot((x - cv.x) * ASPECT, y - cv.y) < 0.15)
        || Math.hypot((x - CHEST.x) * ASPECT, y - CHEST.y) < 0.1) continue;
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

/* hearts: how many it has left, of `max`. waves: pennants flying, one for
   each wave held off. hit: 0..1, a shudder when a monster gets in. */
export function drawCastle(c, W, H, t, hearts, max, waves, hit = 0){
  const x = CASTLE.x * W + Math.sin(t * 60) * hit * H * 0.006, base = (CASTLE.y + 0.12) * H, s = H * 0.24;
  c.fillStyle = 'rgba(40,60,40,.3)'; c.beginPath(); c.ellipse(x, base, s * 0.75, s * 0.12, 0, 0, 6.2832); c.fill();
  const wall = '#d9d2c3', dark = '#b8ae9c', roof = '#5a7bd8';
  /* Back towers, wall, front towers. */
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
  tower(x - s * 0.42, s * 0.24, s * 0.72, true);
  tower(x + s * 0.42, s * 0.24, s * 0.72, true);
  c.fillStyle = wall; c.fillRect(x - s * 0.42, base - s * 0.45, s * 0.84, s * 0.45);
  for (let k = 0; k < 6; k++){ c.fillRect(x - s * 0.42 + k * s * 0.16, base - s * 0.5, s * 0.08, s * 0.06); }
  tower(x, s * 0.3, s * 0.95, true);
  /* The gate. */
  c.fillStyle = '#6b4a34'; c.beginPath(); c.moveTo(x - s * 0.1, base); c.lineTo(x - s * 0.1, base - s * 0.18); c.arc(x, base - s * 0.18, s * 0.1, Math.PI, 0); c.lineTo(x + s * 0.1, base); c.closePath(); c.fill();
  c.strokeStyle = '#4a3324'; c.lineWidth = s * 0.012;
  for (let k = -1; k <= 1; k++){ c.beginPath(); c.moveTo(x + k * s * 0.05, base); c.lineTo(x + k * s * 0.05, base - s * 0.22); c.stroke(); }
  /* Pennants on the middle tower, one for each wave held off (up to a dozen
     shown, then they turn gold). */
  const flagTop = base - s * 0.95 - s * 0.33;
  c.strokeStyle = '#5b4636'; c.lineWidth = s * 0.012; c.beginPath(); c.moveTo(x, flagTop + s * 0.02); c.lineTo(x, flagTop - s * 0.18); c.stroke();
  c.fillStyle = '#ff5d5d'; c.beginPath(); c.moveTo(x, flagTop - s * 0.18); c.quadraticCurveTo(x + s * 0.1, flagTop - s * 0.16 + Math.sin(t * 4) * s * 0.02, x + s * 0.18, flagTop - s * 0.13); c.lineTo(x, flagTop - s * 0.09); c.closePath(); c.fill();
  const shown = Math.min(waves, 12);
  for (let k = 0; k < shown; k++){
    const u = (k + 0.5) / 12, px = x - s * 0.42 + u * s * 0.84, py = base - s * 0.52 + Math.sin(u * Math.PI) * s * 0.06;
    c.fillStyle = waves > 12 ? '#ffd24a' : `hsl(${k * 30},80%,60%)`;
    c.beginPath(); c.moveTo(px - s * 0.025, py); c.lineTo(px + s * 0.025, py); c.lineTo(px, py + s * 0.06 + Math.sin(t * 3 + k) * s * 0.005); c.closePath(); c.fill();
  }
  /* Hearts in an arc over the castle, clear of the paths coming in below. */
  for (let k = 0; k < max; k++){
    const u = (k - (max - 1) / 2) / max, hx = x + u * s * 1.3, hy = base - s * 1.62 + u * u * s * 0.5, r = s * 0.05, full = k < hearts;
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

/* A tower on its pad. kind: archer / cannon / frost; lvl 1..3; aim: the
   angle it's facing; col: the builder's colour, on its little banner;
   kick: 0..1, the recoil of a shot just fired. */
export function drawTower(c, W, H, pad, kind, lvl, aim, col, t, kick = 0){
  const x = pad.x * W, base = pad.y * H, s = H * (0.075 + lvl * 0.012);
  const top = base - s * (1.1 + lvl * 0.12);
  if (kind === 'archer'){
    c.fillStyle = '#8a5a34';
    c.beginPath(); c.moveTo(x - s * 0.45, base); c.lineTo(x - s * 0.32, top); c.lineTo(x + s * 0.32, top); c.lineTo(x + s * 0.45, base); c.closePath(); c.fill();
    c.strokeStyle = '#6b4426'; c.lineWidth = s * 0.06;
    for (let k = 1; k < 4; k++){ const y = base - (base - top) * k / 4; c.beginPath(); c.moveTo(x - s * 0.42 + k * s * 0.03, y); c.lineTo(x + s * 0.42 - k * s * 0.03, y); c.stroke(); }
    c.fillStyle = '#b5764a'; c.fillRect(x - s * 0.42, top - s * 0.12, s * 0.84, s * 0.14);
    c.fillStyle = lvl >= 3 ? '#e2483d' : lvl === 2 ? '#3f7ad9' : '#4f8f52';
    c.beginPath(); c.moveTo(x - s * 0.5, top - s * 0.1); c.lineTo(x, top - s * 0.6); c.lineTo(x + s * 0.5, top - s * 0.1); c.closePath(); c.fill();
    /* The crossbow, turning to aim. */
    c.save(); c.translate(x, top - s * 0.02); c.rotate(aim);
    c.strokeStyle = '#4a3324'; c.lineWidth = s * 0.06; c.beginPath(); c.moveTo(-s * 0.05 - kick * s * 0.08, 0); c.lineTo(s * 0.32, 0); c.stroke();
    c.beginPath(); c.arc(s * 0.22, 0, s * 0.18, -1.2, 1.2); c.stroke();
    c.restore();
  } else if (kind === 'cannon'){
    c.fillStyle = '#8d8fa3';
    c.beginPath(); c.moveTo(x - s * 0.5, base); c.lineTo(x - s * 0.44, top); c.lineTo(x + s * 0.44, top); c.lineTo(x + s * 0.5, base); c.closePath(); c.fill();
    c.fillStyle = '#a7a9bc'; for (let k = 0; k < 4; k++) c.fillRect(x - s * 0.44 + k * s * 0.26, top - s * 0.12, s * 0.14, s * 0.14);
    c.strokeStyle = 'rgba(80,80,100,.4)'; c.lineWidth = s * 0.03;
    for (let k = 1; k < 3; k++){ const y = base - (base - top) * k / 3; c.beginPath(); c.moveTo(x - s * 0.47, y); c.lineTo(x + s * 0.47, y); c.stroke(); }
    c.save(); c.translate(x, top - s * 0.02); c.rotate(aim);
    c.fillStyle = '#3b3d4a'; c.beginPath(); c.roundRect(-s * 0.1 - kick * s * 0.12, -s * (0.1 + lvl * 0.02), s * (0.5 + lvl * 0.05), s * (0.2 + lvl * 0.04), s * 0.08); c.fill();
    c.restore();
    c.fillStyle = '#3b3d4a'; c.beginPath(); c.arc(x, top - s * 0.02, s * 0.15, 0, 6.2832); c.fill();
  } else {
    c.fillStyle = '#b9d9ec';
    c.beginPath(); c.moveTo(x - s * 0.42, base); c.lineTo(x - s * 0.3, top); c.lineTo(x + s * 0.3, top); c.lineTo(x + s * 0.42, base); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(x - s * 0.3, top, s * 0.12, base - top);
    /* The crystal on top, glowing brighter with each level. */
    const cy = top - s * 0.35, cs = s * (0.3 + lvl * 0.06);
    const g = c.createRadialGradient(x, cy, 0, x, cy, cs * 2);
    g.addColorStop(0, `rgba(170,235,255,${0.3 + lvl * 0.15 + kick * 0.3})`); g.addColorStop(1, 'rgba(170,235,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, cy, cs * 2, 0, 6.2832); c.fill();
    c.fillStyle = '#7fd6ff';
    c.beginPath(); c.moveTo(x, cy - cs); c.lineTo(x + cs * 0.5, cy); c.lineTo(x, cy + cs * 0.8); c.lineTo(x - cs * 0.5, cy); c.closePath(); c.fill();
    c.fillStyle = '#e6f8ff'; c.beginPath(); c.moveTo(x, cy - cs); c.lineTo(x + cs * 0.2, cy); c.lineTo(x, cy + cs * 0.3); c.closePath(); c.fill();
  }
  /* The builder's banner, and a star for each upgrade. */
  c.strokeStyle = '#5b4636'; c.lineWidth = Math.max(1, s * 0.03);
  c.beginPath(); c.moveTo(x + s * 0.38, base - s * 0.15); c.lineTo(x + s * 0.38, base - s * 0.62); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(x + s * 0.38, base - s * 0.62); c.lineTo(x + s * 0.62, base - s * 0.55 + Math.sin(t * 4 + pad.i) * s * 0.03); c.lineTo(x + s * 0.38, base - s * 0.46); c.closePath(); c.fill();
  for (let k = 1; k < lvl; k++) star(c, x - s * 0.3 + (k - 1) * s * 0.2, base - s * 0.18, s * 0.08, '#ffd24a');
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
export function drawMonster(c, x, y, s, kind, t, dir, hurt, frozen, hp){
  c.save();
  const shadow = kind === 'bat' ? 0.5 : 1;
  c.fillStyle = `rgba(40,50,40,${0.25 * shadow})`; c.beginPath(); c.ellipse(x, y + s * 0.05, s * 0.45, s * 0.12, 0, 0, 6.2832); c.fill();
  if (hurt > 0) c.filter = `brightness(${1 + hurt * 1.2})`;
  if (kind === 'slime'){
    const sq = 1 + Math.sin(t * 9) * 0.12;
    c.fillStyle = frozen ? '#8fd8ff' : '#6fdc6a';
    c.beginPath(); c.moveTo(x - s * 0.45 * sq, y); c.quadraticCurveTo(x - s * 0.5 * sq, y - s * 0.7 / sq, x, y - s * 0.72 / sq); c.quadraticCurveTo(x + s * 0.5 * sq, y - s * 0.7 / sq, x + s * 0.45 * sq, y); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(x - s * 0.15, y - s * 0.5 / sq, s * 0.1, s * 0.06, -0.5, 0, 6.2832); c.fill();
    face(c, x + dir * s * 0.08, y - s * 0.32 / sq, s * 0.5);
  } else if (kind === 'goblin'){
    const step = Math.sin(t * 14);
    c.fillStyle = '#3b3d4a';
    for (const k of [-1, 1]){ c.beginPath(); c.ellipse(x + k * s * 0.12, y - s * 0.05 + (k * step > 0 ? -s * 0.06 : 0), s * 0.08, s * 0.06, 0, 0, 6.2832); c.fill(); }
    c.fillStyle = frozen ? '#8fd8ff' : '#7a5ad6'; c.beginPath(); c.roundRect(x - s * 0.22, y - s * 0.45, s * 0.44, s * 0.38, s * 0.12); c.fill();
    c.fillStyle = frozen ? '#b5e6ff' : '#8fd06a';
    c.beginPath(); c.arc(x, y - s * 0.62, s * 0.24, 0, 6.2832); c.fill();
    for (const k of [-1, 1]){ c.beginPath(); c.moveTo(x + k * s * 0.18, y - s * 0.66); c.lineTo(x + k * s * 0.45, y - s * 0.78); c.lineTo(x + k * s * 0.2, y - s * 0.55); c.closePath(); c.fill(); }
    face(c, x + dir * s * 0.06, y - s * 0.62, s * 0.36);
  } else if (kind === 'bat'){
    const flap = Math.sin(t * 16), fy = y - s * (0.75 + Math.sin(t * 3) * 0.06);
    c.fillStyle = frozen ? '#8fd8ff' : '#6a4f9a';
    for (const k of [-1, 1]){
      c.beginPath(); c.moveTo(x, fy); c.quadraticCurveTo(x + k * s * 0.4, fy - s * 0.3 * flap, x + k * s * 0.7, fy - s * 0.1 * flap);
      c.quadraticCurveTo(x + k * s * 0.45, fy + s * 0.05, x + k * s * 0.3, fy + s * 0.15); c.quadraticCurveTo(x + k * s * 0.15, fy + s * 0.05, x, fy + s * 0.1); c.closePath(); c.fill();
    }
    c.fillStyle = frozen ? '#b5e6ff' : '#8a6cc0'; c.beginPath(); c.arc(x, fy, s * 0.2, 0, 6.2832); c.fill();
    for (const k of [-1, 1]){ c.beginPath(); c.moveTo(x + k * s * 0.08, fy - s * 0.14); c.lineTo(x + k * s * 0.16, fy - s * 0.3); c.lineTo(x + k * s * 0.18, fy - s * 0.1); c.closePath(); c.fill(); }
    face(c, x, fy + s * 0.02, s * 0.3);
  } else {
    const step = Math.sin(t * 6);
    c.fillStyle = '#5b4636';
    for (const k of [-1, 1]){ c.beginPath(); c.roundRect(x + k * s * 0.2 - s * 0.1, y - s * 0.25 + (k * step > 0 ? -s * 0.05 : 0), s * 0.2, s * 0.25, s * 0.06); c.fill(); }
    c.fillStyle = frozen ? '#8fd8ff' : '#d27a5a'; c.beginPath(); c.ellipse(x, y - s * 0.55, s * 0.42, s * 0.38, 0, 0, 6.2832); c.fill();
    c.fillStyle = frozen ? '#b5e6ff' : '#e8a07e'; c.beginPath(); c.arc(x, y - s * 0.95, s * 0.24, 0, 6.2832); c.fill();
    c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(x - s * 0.2, y - s * 1.12); for (let k = 0; k < 5; k++){ c.lineTo(x - s * 0.2 + (k + 0.5) * s * 0.08, y - s * (k % 2 ? 1.22 : 1.32)); } c.lineTo(x + s * 0.2, y - s * 1.12); c.closePath(); c.fill();
    face(c, x + dir * s * 0.04, y - s * 0.93, s * 0.36);
    c.fillStyle = '#8a5a34'; c.save(); c.translate(x + dir * s * 0.45, y - s * 0.55); c.rotate(dir * 0.5 + Math.sin(t * 6) * 0.15); c.fillRect(-s * 0.05, -s * 0.4, s * 0.1, s * 0.45); c.beginPath(); c.arc(0, -s * 0.42, s * 0.12, 0, 6.2832); c.fill(); c.restore();
  }
  c.restore();
  if (frozen){ c.fillStyle = 'rgba(220,245,255,.8)'; for (let k = 0; k < 3; k++) star(c, x + (k - 1) * s * 0.25, y - s * (kind === 'bat' ? 1.05 : 0.95), s * 0.06, 'rgba(220,245,255,.9)'); }
  if (hp < 1){
    const bw = s * 0.6, by = y - s * (kind === 'ogre' ? 1.45 : kind === 'bat' ? 1.15 : 1.0);
    c.fillStyle = 'rgba(40,30,50,.55)'; c.fillRect(x - bw / 2, by, bw, s * 0.07);
    c.fillStyle = hp > 0.5 ? '#6fdc6a' : hp > 0.25 ? '#ffd24a' : '#ff5d5d'; c.fillRect(x - bw / 2, by, bw * Math.max(0, hp), s * 0.07);
  }
}

function face(c, x, y, s){
  for (const k of [-1, 1]){
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x + k * s * 0.22, y, s * 0.16, 0, 6.2832); c.fill();
    c.fillStyle = '#2b2440'; c.beginPath(); c.arc(x + k * s * 0.22, y + s * 0.03, s * 0.09, 0, 6.2832); c.fill();
  }
  c.strokeStyle = '#2b2440'; c.lineWidth = Math.max(1, s * 0.06); c.lineCap = 'round';
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
