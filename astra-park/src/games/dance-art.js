/* Dance Party, painted: a disco stage - velvet curtains, a ring of marquee
   bulbs, a mirror ball, sweeping spotlights and a light-up floor - and the
   two dancers on it, Harlyn and Auntie K, each in her own sparkly colour,
   dancing to the beat.

   The dancers are drawn from a little skeleton: each move says where the
   arms and legs go at each moment of the beat, and the outfit, hair and
   face are drawn over it. `energy` (0..1) is how much the party has built:
   it brightens the lights, spins the mirror ball and makes the dancing
   bigger. */

const hash = (i, k = 1) => ((((i + 7919) * 2654435761 * k) % 4294967296) + 4294967296) % 4294967296 / 4294967296;

export const FLOOR = 0.68;      /* where the dancers' feet are, in screen heights */

/* The two of them. h is height in screen heights; Harlyn is eight. */
export const DANCERS = [
  { id: 'harlyn', x: 0.38, h: 0.3, skin: '#f5d2b3', hair: '#f2d27a', hairLen: 'shoulder', outfit: '#9b6bff', trim: '#e2d4ff', legs: 'skin', shoes: '#ffffff', dress: 'tutu' },
  { id: 'auntieK', x: 0.62, h: 0.4, skin: '#f2cba8', hair: '#e7c467', hairLen: 'medium', outfit: '#20cfc4', trim: '#c4fff8', legs: 'outfit', shoes: '#ffd24a', dress: 'jumpsuit' }
];

/* ---------- the stage ---------- */

let cache = null;
function backdrop(W, H){
  if (cache && cache.W === W && cache.H === H) return cache.cv;
  let cv = null;
  try { cv = document.createElement('canvas'); cv.width = Math.round(W); cv.height = Math.round(H); if (!cv.getContext || !cv.getContext('2d')) cv = null; } catch { cv = null; }
  cache = { W, H, cv };
  if (cv) paintBack(cv.getContext('2d'), W, H);
  return cv;
}

function paintBack(c, W, H){
  const g = c.createLinearGradient(0, 0, 0, H * FLOOR);
  g.addColorStop(0, '#120a2e'); g.addColorStop(1, '#3a1f6e');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  /* Velvet curtains either side, in heavy folds, and a swag along the top. */
  for (const side of [-1, 1]){
    const x0 = side < 0 ? 0 : W, w = W * 0.13;
    for (let k = 0; k < 6; k++){
      const fx = x0 - side * (w * (k / 6)), fw = w / 6;
      const fg = c.createLinearGradient(fx - fw, 0, fx + fw, 0);
      fg.addColorStop(0, '#5a0f2e'); fg.addColorStop(0.5, '#a8234f'); fg.addColorStop(1, '#5a0f2e');
      c.fillStyle = fg;
      c.beginPath(); c.moveTo(fx - fw, 0); c.lineTo(fx + fw, 0); c.lineTo(fx + fw * (1 - side * 0.4 * k / 6), H * FLOOR + H * 0.05); c.lineTo(fx - fw * (1 + side * 0.4 * k / 6), H * FLOOR + H * 0.05); c.closePath(); c.fill();
    }
  }
  c.fillStyle = '#8a1a40';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, H * 0.05);
  for (let k = 8; k >= 0; k--){ const x = W * k / 8; c.quadraticCurveTo(x + W / 16, H * 0.1, x, H * 0.05); }
  c.closePath(); c.fill();
  /* The stage itself: a deep front edge under the floor. */
  c.fillStyle = '#1b1035'; c.fillRect(0, H * 0.9, W, H * 0.1);
  c.fillStyle = '#ffd24a'; c.fillRect(0, H * 0.9, W, H * 0.006);
}

/* The marquee arch, the mirror ball, the spotlights and the floor. beat is
   the beat's phase 0..1, n which beat it is. */
export function drawStage(c, W, H, t, beat, n, energy){
  const cv = backdrop(W, H);
  if (cv) c.drawImage(cv, 0, 0, W, H); else paintBack(c, W, H);

  /* Marquee bulbs in an arch round the back, chasing faster as the party builds. */
  const bulbs = 34, chase = Math.floor(t * (3 + energy * 9));
  for (let i = 0; i < bulbs; i++){
    const a = Math.PI * (i / (bulbs - 1)), x = W * (0.5 - Math.cos(a) * 0.36), y = H * (0.6 - Math.sin(a) * 0.48);
    const on = (i + chase) % 3 === 0;
    const k = on ? 0.6 + 0.4 * energy : 0.25;
    const g = c.createRadialGradient(x, y, 0, x, y, H * 0.03);
    g.addColorStop(0, `rgba(255,220,140,${0.6 * k})`); g.addColorStop(1, 'rgba(255,220,140,0)');
    c.fillStyle = g; c.fillRect(x - H * 0.03, y - H * 0.03, H * 0.06, H * 0.06);
    c.fillStyle = on ? '#fff3c4' : '#a8925a'; c.beginPath(); c.arc(x, y, H * 0.008, 0, 6.2832); c.fill();
  }

  /* Spotlights sweeping from the top corners. */
  const beams = [['255,90,170', 0.12, 1], ['90,220,255', 0.88, -1], ['255,230,120', 0.35, 1], ['170,120,255', 0.65, -1]];
  beams.forEach(([col, x0, d], i) => {
    if (i >= 2 && energy < 0.4) return;
    const a = Math.PI / 2 + d * (0.35 + Math.sin(t * (0.6 + i * 0.13) + i) * 0.35);
    const x = W * x0, y = -H * 0.02, len = H * 1.1, wd = 0.11;
    const bg = c.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    bg.addColorStop(0, `rgba(${col},${0.18 + 0.25 * energy})`); bg.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = bg;
    c.beginPath(); c.moveTo(x, y);
    c.lineTo(x + Math.cos(a - wd) * len, y + Math.sin(a - wd) * len);
    c.lineTo(x + Math.cos(a + wd) * len, y + Math.sin(a + wd) * len);
    c.closePath(); c.fill();
  });

  /* The light-up floor: tiles in perspective, lighting up on the beat. */
  const rows = 4, cols = 10, top = H * FLOOR - H * 0.02, bot = H * 0.9;
  const X = (u, v) => W * (0.5 + (u - 0.5) * (0.72 + 0.28 * v));
  for (let r = 0; r < rows; r++){
    for (let q = 0; q < cols; q++){
      const v0 = r / rows, v1 = (r + 1) / rows, u0 = q / cols, u1 = (q + 1) / cols;
      const y0 = top + (bot - top) * v0, y1 = top + (bot - top) * v1;
      const lit = hash(q * 7 + r * 31, n % 97 + 1) < 0.25 + energy * 0.6;
      const hue = (q * 36 + r * 50 + n * 40) % 360;
      c.fillStyle = lit ? `hsla(${hue},85%,${55 + 15 * (1 - beat)}%,${0.55 + 0.4 * energy})` : 'rgba(40,24,80,.9)';
      c.beginPath(); c.moveTo(X(u0, v0), y0); c.lineTo(X(u1, v0), y0); c.lineTo(X(u1, v1), y1); c.lineTo(X(u0, v1), y1); c.closePath(); c.fill();
    }
  }
  c.strokeStyle = 'rgba(10,5,25,.6)'; c.lineWidth = Math.max(1.5, H * 0.003);
  c.beginPath();
  for (let r = 0; r <= rows; r++){ const v = r / rows, y = top + (bot - top) * v; c.moveTo(X(0, v), y); c.lineTo(X(1, v), y); }
  for (let q = 0; q <= cols; q++){ const u = q / cols; c.moveTo(X(u, 0), top); c.lineTo(X(u, 1), bot); }
  c.stroke();
}

/* The mirror ball, and the specks of light it throws round the room. */
export function drawMirrorBall(c, W, H, t, energy){
  const x = W * 0.5, y = H * 0.165, r = H * 0.06, spin = t * (0.4 + energy * 2.2);
  c.strokeStyle = 'rgba(220,220,240,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, y - r); c.stroke();
  /* Specks drifting round the walls. */
  for (let i = 0; i < 40; i++){
    const a = i * 2.39996 + spin, el = hash(i, 3);
    const px = W * (0.5 + Math.cos(a) * (0.2 + el * 0.4)), py = H * (0.1 + el * 0.75 + Math.sin(a * 0.7) * 0.04);
    if (Math.cos(a) < -0.2) continue;
    c.fillStyle = `rgba(255,255,255,${(0.15 + 0.55 * energy) * (0.5 + 0.5 * Math.cos(a))})`;
    c.beginPath(); c.arc(px, py, H * (0.004 + el * 0.004), 0, 6.2832); c.fill();
  }
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.clip();
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#f4f4ff'); g.addColorStop(1, '#6a6a8a');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  /* Facets: a grid that turns with the ball, a few catching the light. */
  const rows = 8, cols = 12;
  for (let rr = 0; rr < rows; rr++){
    const lat = -Math.PI / 2 + (rr + 0.5) * Math.PI / rows, ry = y + Math.sin(lat) * r, rw = Math.cos(lat) * r, fh = r * Math.PI / rows * 0.9;
    for (let q = 0; q < cols; q++){
      const lon = (q / cols) * Math.PI * 2 + spin, cx = Math.sin(lon);
      if (Math.cos(lon) < 0) continue;
      const fx = x + cx * rw, fw = Math.max(1, (Math.PI * 2 / cols) * rw * Math.cos(lon) * 0.85);
      const glint = hash(rr * 13 + q, Math.floor(t * 4) + 1) < 0.08 + 0.15 * energy;
      c.fillStyle = glint ? 'rgba(255,255,255,.95)' : `rgba(${180 + 60 * Math.cos(lon)},${180 + 60 * Math.cos(lon)},${210 + 40 * Math.cos(lon)},.55)`;
      c.fillRect(fx - fw / 2, ry - fh / 2, fw, fh);
    }
  }
  c.restore();
}

/* ---------- the dancers ---------- */

/* Where the joints go, for a move at a moment in the beat. Local units: 100
   tall, feet at y = 0, up negative, facing us. Arms and legs are angles from
   pointing straight down, positive out to that side. */
export const MOVES = ['sway', 'pump', 'disco', 'clap', 'twist', 'wave'];

function joints(move, b, n, energy){
  const big = 0.6 + 0.4 * energy, s = Math.sin(b * Math.PI * 2), hop = Math.abs(Math.sin(b * Math.PI));
  const two = (n % 2 === 0 ? 1 : -1);
  let lift = hop * 3 * big, hip = 0, arms = [[0.35, 0.3], [0.35, 0.3]], legs = [[0.08, 0], [0.08, 0]], lean = 0;
  if (move === 'sway'){
    hip = Math.sin((n + b) * Math.PI) * 5 * big; lean = -hip * 0.012;
    arms = [[0.55 + s * 0.25, 0.6], [0.55 - s * 0.25, 0.6]];
  } else if (move === 'pump'){
    const up = (n % 2 === 0) === (b < 0.5);
    arms = [[up ? 2.8 : 1.2, up ? 0.1 : 1.6], [up ? 1.2 : 2.8, up ? 1.6 : 0.1]];
  } else if (move === 'disco'){
    arms = two > 0 ? [[2.4, 0], [0.5, 0.2]] : [[0.5, 0.2], [2.4, 0]];
    hip = two * 4 * big;
  } else if (move === 'clap'){
    const k = Math.abs(Math.cos(b * Math.PI));
    arms = [[2.6 - 0.3 * k, -0.6 * k + 0.2], [2.6 - 0.3 * k, -0.6 * k + 0.2]];
    lift = hop * 5 * big;
  } else if (move === 'twist'){
    lift = -4; hip = s * 4 * big;
    arms = [[0.9, 1.6 + s * 0.4], [0.9, 1.6 - s * 0.4]];
    legs = [[0.25, -0.5], [0.25, -0.5]];
  } else if (move === 'wave'){
    const w = Math.sin((n + b) * Math.PI) * 0.45;
    arms = [[2.7 + w, -0.2], [2.7 - w, 0.2]];
    hip = w * 6 * big;
  } else if (move === 'bow'){
    /* A curtsy: a dip at the knees, arms out holding the skirt. */
    lift = -5; arms = [[0.75, 0.25], [0.75, 0.25]]; legs = [[0.18, -0.35], [0.18, -0.35]];
  } else if (move === 'beckon'){
    const k = Math.abs(Math.sin(b * Math.PI * 2));
    arms = [[1.4, 1.2 + k * 0.6], [1.4, 1.2 + k * 0.6]];
  }
  return { lift, hip, arms, legs, lean };
}

/* One dancer, feet at (x, base), h pixels tall. spin 0..1 turns them right
   round, for the big moments. */
export function drawDancer(c, d, x, base, h, t, move, b, n, energy, spin = 0){
  const u = h / 100, J = joints(move, b, n, energy);
  c.save();
  c.translate(x, base - J.lift * u);
  if (spin) c.scale(Math.cos(spin * Math.PI * 2) || 0.001, 1);
  const hipX = J.hip * u, hipY = -48 * u, shY = -78 * u, headY = -91 * u, hr = 11 * u;
  const SKIN = d.skin;

  /* Shadow on the floor. */
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, J.lift * u, 18 * u, 3.5 * u, 0, 0, 6.2832); c.fill();
  const sway = J.hip * 0.6 * u;

  /* Legs. */
  const legCol = d.legs === 'skin' ? SKIN : d.outfit;
  [-1, 1].forEach((side, i) => {
    const [a, k] = J.legs[i], hx = hipX + side * 6 * u;
    const kx = hx + side * Math.sin(a) * 24 * u, ky = hipY + Math.cos(a) * 24 * u;
    const fx = kx + side * Math.sin(a + k) * 24 * u, fy = Math.min(0, ky + Math.cos(a + k) * 24 * u);
    c.strokeStyle = legCol; c.lineWidth = 8 * u; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx, hipY); c.lineTo(kx, ky); c.lineTo(fx, fy - 2 * u); c.stroke();
    c.fillStyle = d.shoes; c.beginPath(); c.ellipse(fx + side * 2 * u, fy - 1.5 * u, 6 * u, 3.5 * u, 0, 0, 6.2832); c.fill();
  });

  /* Everything above the hips sways from the hips. */
  c.save(); c.translate(hipX, hipY); c.rotate(J.lean); c.translate(-hipX, -hipY);

  /* Hair behind the head: a bob for Auntie K, to the shoulders for Harlyn. */
  c.fillStyle = d.hair;
  if (d.hairLen === 'medium'){ c.beginPath(); c.moveTo(-hr * 1.08, headY); c.quadraticCurveTo(-hr * 1.4 + sway, headY + 12 * u, -hr * 1.2 + sway, headY + 20 * u); c.lineTo(hr * 1.2 + sway, headY + 20 * u); c.quadraticCurveTo(hr * 1.4 + sway, headY + 12 * u, hr * 1.08, headY); c.closePath(); c.fill(); }
  else { c.beginPath(); c.moveTo(-hr * 1.05, headY); c.quadraticCurveTo(-hr * 1.35 + sway, headY + 9 * u, -hr * 1.15 + sway, headY + 15 * u); c.lineTo(hr * 1.15 + sway, headY + 15 * u); c.quadraticCurveTo(hr * 1.35 + sway, headY + 9 * u, hr * 1.05, headY); c.closePath(); c.fill(); }

  /* The outfit: a tutu or a jumpsuit, all sequins. */
  const shX = hipX * 0.4, out = d.outfit;
  c.fillStyle = out;
  c.beginPath();
  if (d.dress === 'tutu'){ c.moveTo(shX - 10 * u, shY); c.lineTo(shX + 10 * u, shY); c.lineTo(hipX + 9 * u, hipY - 2 * u); c.lineTo(hipX - 9 * u, hipY - 2 * u); }
  else { c.moveTo(shX - 11 * u, shY); c.lineTo(shX + 11 * u, shY); c.lineTo(hipX + 9 * u, hipY + 3 * u); c.lineTo(hipX - 9 * u, hipY + 3 * u); }
  c.closePath(); c.fill();
  if (d.dress === 'tutu'){
    c.fillStyle = d.trim;
    c.beginPath(); for (let k = 0; k <= 8; k++){ const a = Math.PI * (k / 8), rx = 20 * u, px = hipX + Math.cos(a) * rx, py = hipY - 2 * u + Math.sin(a) * 8 * u + (k % 2) * 3 * u; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.fill();
    c.fillStyle = out; c.beginPath(); c.ellipse(hipX, hipY - 1 * u, 17 * u, 5 * u, 0, 0, 6.2832); c.fill();
  }
  /* Sequins twinkling. */
  for (let k = 0; k < 9; k++){
    const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 5 + k * 1.7 + d.x * 20));
    c.fillStyle = `rgba(255,255,255,${a * 0.8})`;
    c.beginPath(); c.arc(hipX * 0.5 + (hash(k, 3) - 0.5) * 16 * u, shY + 4 * u + hash(k, 5) * 34 * u, 1.3 * u, 0, 6.2832); c.fill();
  }

  /* Arms. */
  [-1, 1].forEach((side, i) => {
    const [a, k] = J.arms[i], sx = shX + side * 10 * u, sy = shY + 2 * u;
    const ex = sx + side * Math.sin(a) * 15 * u, ey = sy + Math.cos(a) * 15 * u;
    const hx = ex + side * Math.sin(a + k) * 14 * u, hy = ey + Math.cos(a + k) * 14 * u;
    c.strokeStyle = SKIN; c.lineWidth = 6 * u; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
    c.strokeStyle = out; c.lineWidth = 7 * u; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + (ex - sx) * 0.35, sy + (ey - sy) * 0.35); c.stroke();
    c.fillStyle = SKIN; c.beginPath(); c.arc(hx, hy, 3.6 * u, 0, 6.2832); c.fill();
  });

  /* Neck, head and face. */
  c.fillStyle = SKIN; c.fillRect(shX - 3 * u, headY + hr * 0.6, 6 * u, 6 * u);
  c.beginPath(); c.ellipse(shX * 0.5, headY, hr, hr * 1.08, 0, 0, 6.2832); c.fill();
  const fx = shX * 0.5;
  c.fillStyle = '#2b2440';
  for (const s of [-1, 1]){ c.beginPath(); c.ellipse(fx + s * 4 * u, headY - 1 * u, 1.4 * u, 1.9 * u, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = 'rgba(255,120,130,.4)'; for (const s of [-1, 1]){ c.beginPath(); c.ellipse(fx + s * 6.5 * u, headY + 3 * u, 2.2 * u, 1.4 * u, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = '#b5434f'; c.beginPath(); c.moveTo(fx - 4 * u, headY + 4 * u); c.quadraticCurveTo(fx, headY + 9.5 * u, fx + 4 * u, headY + 4 * u); c.closePath(); c.fill();
  /* Hair over the top: soft bangs. */
  c.fillStyle = d.hair;
  c.beginPath();
  c.moveTo(fx - hr * 1.08, headY + 1 * u); c.quadraticCurveTo(fx - hr * 1.1, headY - hr * 1.25, fx, headY - hr * 1.12); c.quadraticCurveTo(fx + hr * 1.1, headY - hr * 1.25, fx + hr * 1.08, headY + 1 * u); c.quadraticCurveTo(fx + hr * 0.5, headY - hr * 0.45, fx, headY - hr * 0.5); c.quadraticCurveTo(fx - hr * 0.5, headY - hr * 0.45, fx - hr * 1.08, headY + 1 * u);
  c.fill();
  if (d.id === 'harlyn'){ c.fillStyle = '#ff7ac0'; c.beginPath(); c.arc(fx + hr * 0.75, headY - hr * 0.75, 2.6 * u, 0, 6.2832); c.fill(); }
  c.restore();
  c.restore();
}
