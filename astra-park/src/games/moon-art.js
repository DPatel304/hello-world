/* The moon, painted, for Moon Bounce: deep space with a soft nebula, the
   Earth hanging in the sky, lilac hills, a cratered ground with a little
   moon base and a parked rocket; the astronauts the children become; the
   wishing stars they catch; and the shapes those stars make in the sky.

   The sky and the ground never move, so they are painted once per screen
   size into an offscreen layer, like the title's park. */
import { PLAYER_COLORS, L } from '../tracking/pose.js';

const hash = (i, k = 1) => (((i + 1) * 2654435761 * k) % 4294967296) / 4294967296;
export const GROUND = 0.8;   /* where the moon's surface starts, in screen heights */

const DUST = Array.from({ length: 160 }, (_, i) => ({ x: hash(i, 3), y: hash(i, 5) * 0.72, r: i % 11 === 0 ? 2 : 1.1, ph: hash(i, 7) * 6.28 }));
const CRATERS = [[0.22, 0.86, 0.07], [0.48, 0.93, 0.1], [0.7, 0.85, 0.05], [0.86, 0.95, 0.08], [0.06, 0.95, 0.06], [0.36, 0.82, 0.035], [0.6, 0.99, 0.06]];

let cache = null;
function layer(W, H){
  if (cache && cache.W === W && cache.H === H) return cache.cv;
  let cv = null;
  try { cv = document.createElement('canvas'); cv.width = Math.round(W); cv.height = Math.round(H); if (!cv.getContext || !cv.getContext('2d')) cv = null; } catch { cv = null; }
  cache = { W, H, cv };
  if (cv) paint(cv.getContext('2d'), W, H);
  return cv;
}

export function drawMoon(c, W, H, t){
  const cv = layer(W, H);
  if (cv) c.drawImage(cv, 0, 0, W, H); else paint(c, W, H);
  c.fillStyle = '#fff';
  for (const s of DUST){
    c.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.9 + s.ph));
    c.beginPath(); c.arc(s.x * W, s.y * H, Math.max(1, s.r * H / 900), 0, 6.2832); c.fill();
  }
  c.globalAlpha = 1;
  /* The rocket's windows and the base's lights blink gently. */
  const blink = 0.5 + 0.5 * Math.sin(t * 2);
  c.fillStyle = `rgba(255,214,110,${0.4 + 0.6 * blink})`;
  c.beginPath(); c.arc(W * 0.1 - H * 0.05, H * (GROUND - 0.02), H * 0.008, 0, 6.2832); c.fill();
  c.fillStyle = `rgba(110,220,255,${0.4 + 0.6 * (1 - blink)})`;
  c.beginPath(); c.arc(W * 0.1 + H * 0.05, H * (GROUND - 0.02), H * 0.008, 0, 6.2832); c.fill();
}

function paint(c, W, H){
  const sky = c.createLinearGradient(0, 0, 0, H * GROUND);
  sky.addColorStop(0, '#080c2b'); sky.addColorStop(0.55, '#171a48'); sky.addColorStop(1, '#3b2c6e');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  /* A soft nebula: a few big faint clouds of colour. */
  for (const [x, y, r, col] of [[0.25, 0.3, 0.45, '255,120,190'], [0.6, 0.18, 0.4, '90,200,230'], [0.45, 0.5, 0.35, '170,120,255']]){
    const g = c.createRadialGradient(W * x, H * y, 0, W * x, H * y, H * r);
    g.addColorStop(0, `rgba(${col},.16)`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  /* The Earth, blue and green, with a soft glow and a few clouds. */
  const ex = W * 0.84, ey = H * 0.2, er = H * 0.075;
  let g = c.createRadialGradient(ex, ey, er * 0.8, ex, ey, er * 2);
  g.addColorStop(0, 'rgba(120,190,255,.35)'); g.addColorStop(1, 'rgba(120,190,255,0)');
  c.fillStyle = g; c.fillRect(ex - er * 2, ey - er * 2, er * 4, er * 4);
  c.save(); c.beginPath(); c.arc(ex, ey, er, 0, 6.2832); c.clip();
  c.fillStyle = '#3f8fe0'; c.fillRect(ex - er, ey - er, er * 2, er * 2);
  c.fillStyle = '#5fc46d';
  for (const [dx, dy, rx, ry] of [[-0.35, -0.2, 0.35, 0.25], [0.3, 0.25, 0.3, 0.35], [-0.1, 0.55, 0.25, 0.15], [0.45, -0.45, 0.2, 0.12]]){
    c.beginPath(); c.ellipse(ex + dx * er, ey + dy * er, rx * er, ry * er, 0.4, 0, 6.2832); c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,.75)';
  for (const [dx, dy, rx] of [[-0.5, 0.1, 0.3], [0.1, -0.6, 0.35], [0.4, 0.6, 0.25]]){ c.beginPath(); c.ellipse(ex + dx * er, ey + dy * er, rx * er, rx * er * 0.25, -0.2, 0, 6.2832); c.fill(); }
  g = c.createLinearGradient(ex - er, ey - er, ex + er, ey + er);
  g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(0.6, 'rgba(0,0,30,0)'); g.addColorStop(1, 'rgba(0,0,40,.45)');
  c.fillStyle = g; c.fillRect(ex - er, ey - er, er * 2, er * 2);
  c.restore();

  /* Far lilac hills, then the ground. */
  c.fillStyle = '#5b5486';
  c.beginPath(); c.moveTo(0, H * GROUND);
  for (let i = 0; i <= 24; i++){ const u = i / 24; c.lineTo(u * W, H * (0.735 - 0.035 * Math.sin(u * 9.3 + 1) - 0.02 * Math.sin(u * 23))); }
  c.lineTo(W, H * GROUND); c.closePath(); c.fill();
  const ground = c.createLinearGradient(0, H * GROUND, 0, H);
  ground.addColorStop(0, '#a49fc2'); ground.addColorStop(1, '#77729a');
  c.fillStyle = ground;
  c.beginPath(); c.moveTo(0, H);
  for (let i = 0; i <= 24; i++){ const u = i / 24; c.lineTo(u * W, H * (GROUND - 0.012 * Math.sin(u * 7 + 2))); }
  c.lineTo(W, H); c.closePath(); c.fill();
  for (const [x, y, r] of CRATERS){
    c.fillStyle = 'rgba(70,64,105,.45)';
    c.beginPath(); c.ellipse(W * x, H * y, H * r, H * r * 0.3, 0, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(220,214,240,.45)'; c.lineWidth = Math.max(2, H * 0.004);
    c.beginPath(); c.ellipse(W * x, H * y + H * r * 0.03, H * r, H * r * 0.3, 0, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke();
  }

  /* A little moon base: a glass dome with a door. */
  const bx = W * 0.1, by = H * GROUND;
  c.fillStyle = '#d6dbe8'; c.fillRect(bx - H * 0.09, by - H * 0.03, H * 0.18, H * 0.03);
  g = c.createLinearGradient(0, by - H * 0.12, 0, by);
  g.addColorStop(0, 'rgba(190,230,255,.75)'); g.addColorStop(1, 'rgba(120,170,220,.6)');
  c.fillStyle = g; c.beginPath(); c.arc(bx, by - H * 0.03, H * 0.08, Math.PI, 0); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = H * 0.004;
  c.beginPath(); c.arc(bx, by - H * 0.03, H * 0.08, Math.PI, 0); c.stroke();
  c.fillStyle = '#5b6b8c'; c.beginPath(); c.roundRect(bx - H * 0.018, by - H * 0.075, H * 0.036, H * 0.045, H * 0.012); c.fill();

  /* The rocket that brought everyone, parked on its fins. */
  const rx = W * 0.93, ry = H * (GROUND + 0.01), rh = H * 0.26, rw = rh * 0.28;
  c.fillStyle = '#e8413c';
  for (const d of [-1, 1]){ c.beginPath(); c.moveTo(rx + d * rw * 0.45, ry - rh * 0.32); c.lineTo(rx + d * rw * 0.95, ry); c.lineTo(rx + d * rw * 0.4, ry - rh * 0.05); c.closePath(); c.fill(); }
  g = c.createLinearGradient(rx - rw / 2, 0, rx + rw / 2, 0);
  g.addColorStop(0, '#cfd5e2'); g.addColorStop(0.4, '#ffffff'); g.addColorStop(1, '#aeb6c8');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(rx, ry - rh); c.quadraticCurveTo(rx + rw * 0.7, ry - rh * 0.65, rx + rw * 0.5, ry - rh * 0.08);
  c.lineTo(rx - rw * 0.5, ry - rh * 0.08); c.quadraticCurveTo(rx - rw * 0.7, ry - rh * 0.65, rx, ry - rh); c.fill();
  c.fillStyle = '#e8413c'; c.beginPath(); c.moveTo(rx, ry - rh); c.quadraticCurveTo(rx + rw * 0.35, ry - rh * 0.88, rx + rw * 0.42, ry - rh * 0.78); c.lineTo(rx - rw * 0.42, ry - rh * 0.78); c.quadraticCurveTo(rx - rw * 0.35, ry - rh * 0.88, rx, ry - rh); c.fill();
  c.fillStyle = '#7fc8ff'; c.beginPath(); c.arc(rx, ry - rh * 0.55, rw * 0.22, 0, 6.2832); c.fill();
  c.strokeStyle = '#8e97ab'; c.lineWidth = rw * 0.07; c.stroke();
}

/* ---------- the wishing stars ---------- */

export function drawStar(c, x, y, r, t, golden = false){
  const g = c.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, golden ? 'rgba(255,180,220,.55)' : 'rgba(255,230,140,.55)');
  g.addColorStop(1, 'rgba(255,230,140,0)');
  c.fillStyle = g; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.5) * 0.25);
  c.fillStyle = golden ? '#ffb3e0' : '#ffd95a';
  c.beginPath();
  for (let i = 0; i < 10; i++){
    const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * 0.45 : r;
    c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.7)';
  c.beginPath(); c.arc(-r * 0.15, -r * 0.2, r * 0.18, 0, 6.2832); c.fill();
  c.restore();
}

/* ---------- constellations: the pictures the caught stars make ---------- */

const ring = (n) => Array.from({ length: n }, (_, i) => [i, (i + 1) % n]);
export const SHAPES = [
  { name: 'rocket', col: '255,120,110', pts: [[0, -1], [0.35, -0.5], [0.35, 0.4], [0.7, 0.9], [0, 0.6], [-0.7, 0.9], [-0.35, 0.4], [-0.35, -0.5]] },
  { name: 'heart', col: '255,120,170', pts: [[0, -0.45], [0.45, -0.9], [0.95, -0.5], [0.75, 0.15], [0, 0.9], [-0.75, 0.15], [-0.95, -0.5], [-0.45, -0.9]] },
  { name: 'fish', col: '110,200,255', pts: [[-1, 0], [-0.4, -0.55], [0.3, -0.45], [0.65, 0], [1, -0.5], [1, 0.5], [0.65, 0], [0.3, 0.45], [-0.4, 0.55]] },
  { name: 'house', col: '255,200,110', pts: [[-0.8, 0.9], [0.8, 0.9], [0.8, -0.1], [0, -0.9], [-0.8, -0.1]] },
  { name: 'star', col: '255,226,120', pts: [[0, -1], [0.95, -0.3], [0.6, 0.85], [-0.6, 0.85], [-0.95, -0.3]], lines: [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]] },
  { name: 'bunny', col: '230,210,255', pts: [[-0.35, -1], [-0.15, -0.3], [0.15, -0.3], [0.35, -1], [0.45, -0.25], [0.75, 0.3], [0.4, 0.9], [-0.4, 0.9], [-0.75, 0.3], [-0.45, -0.25]] },
  { name: 'boat', col: '140,230,190', pts: [[-0.9, 0.4], [0.9, 0.4], [0.6, 0.9], [-0.6, 0.9], [-0.9, 0.4], [0, 0.35], [0, -1], [0.7, 0.2]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 5]] },
  { name: 'flower', col: '255,170,120', pts: [[0, -1], [0.38, -0.38], [1, 0], [0.38, 0.38], [0, 1], [-0.38, 0.38], [-1, 0], [-0.38, -0.38]] }
].map(s => ({ ...s, lines: s.lines || ring(s.pts.length) }));

/* A constellation at (x, y) of radius r. lit: how many of its stars are in;
   done: 0..1 how far its lines have drawn and its picture has filled. */
export function drawConstellation(c, shape, x, y, r, lit, done, t, alpha = 1){
  const P = shape.pts.map(([px, py]) => [x + px * r * 1.1, y + py * r]);
  c.save(); c.globalAlpha = alpha;
  if (done > 0){
    /* The picture fills with a soft colour as it comes together. */
    const ringPts = shape.name === 'star' ? [0, 1, 2, 3, 4].map(i => P[[0, 2, 4, 1, 3][i]]) : shape.name === 'boat' ? P.slice(0, 4) : P;
    c.fillStyle = `rgba(${shape.col},${0.22 * done})`;
    c.beginPath(); ringPts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fill();
    if (shape.name === 'boat'){ c.beginPath(); [P[5], P[6], P[7]].forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fill(); }
    c.strokeStyle = `rgba(${shape.col},${0.85 * done})`; c.lineWidth = Math.max(2, r * 0.05); c.lineCap = 'round';
    c.shadowColor = `rgba(${shape.col},.9)`; c.shadowBlur = r * 0.18;
    const n = shape.lines.length, shown = done * n;
    c.beginPath();
    shape.lines.forEach(([a, b], k) => {
      const f = Math.max(0, Math.min(1, shown - k));
      if (f <= 0) return;
      c.moveTo(P[a][0], P[a][1]); c.lineTo(P[a][0] + (P[b][0] - P[a][0]) * f, P[a][1] + (P[b][1] - P[a][1]) * f);
    });
    c.stroke();
    c.shadowBlur = 0;
  } else {
    /* Not yet: faint dotted guides between the places stars will go. */
    c.strokeStyle = 'rgba(200,210,255,.18)'; c.lineWidth = Math.max(1.5, r * 0.02); c.setLineDash([r * 0.05, r * 0.08]);
    c.beginPath(); shape.lines.forEach(([a, b]) => { c.moveTo(P[a][0], P[a][1]); c.lineTo(P[b][0], P[b][1]); }); c.stroke();
    c.setLineDash([]);
  }
  P.forEach(([px, py], i) => {
    if (i < lit){ drawStar(c, px, py, r * 0.12 * (1 + 0.1 * Math.sin(t * 3 + i)), t + i); }
    else {
      c.strokeStyle = 'rgba(220,225,255,.45)'; c.lineWidth = Math.max(1.5, r * 0.02);
      c.beginPath(); c.arc(px, py, r * 0.07, 0, 6.2832); c.stroke();
    }
  });
  c.restore();
}

/* ---------- astronauts ---------- */

/* A child as an astronaut, built on their pose: a puffy white suit in their
   colour, gloves, boots, a backpack, and a glass helmet with their face in
   it. lift raises them off the ground, in screen heights. face(x, y, r) fills
   the helmet, already clipped to it. */
export function drawAstronaut(c, lm, W, H, lift, col, face){
  const seen = (i) => (lm[i].v ?? 1) > 0.3;
  const P = (i) => [lm[i].x * W, (lm[i].y - lift) * H];
  const [lsx, lsy] = P(L.L_SHOULDER), [rsx, rsy] = P(L.R_SHOULDER);
  const sw = Math.hypot(lsx - rsx, lsy - rsy);
  if (sw < 6) return null;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';

  /* Backpack, behind everything. */
  const [lhx, lhy] = P(L.L_HIP), [rhx, rhy] = P(L.R_HIP);
  const cx = (lsx + rsx) / 2, cy = (lsy + rsy) / 2, hx = (lhx + rhx) / 2, hy = (lhy + rhy) / 2;
  c.fillStyle = '#b9c0d0';
  c.beginPath(); c.roundRect(cx - sw * 0.62, cy - sw * 0.05, sw * 1.24, (hy - cy) * 0.85, sw * 0.18); c.fill();

  const limb = (a, b, d, w, colour) => {
    if (!seen(a) || !seen(b)) return;
    const pts = [P(a), P(b)]; if (seen(d)) pts.push(P(d));
    for (const [lw, s] of [[w + Math.max(4, sw * 0.06), '#aab2c4'], [w, colour]]){
      c.strokeStyle = s; c.lineWidth = lw;
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    }
  };
  limb(L.L_HIP, L.L_KNEE, L.L_ANKLE, sw * 0.42, '#f4f6fb');
  limb(L.R_HIP, L.R_KNEE, L.R_ANKLE, sw * 0.42, '#f4f6fb');
  for (const a of [L.L_ANKLE, L.R_ANKLE]) if (seen(a)){ const [x, y] = P(a); c.fillStyle = '#7d8598'; c.beginPath(); c.ellipse(x, y + sw * 0.05, sw * 0.24, sw * 0.14, 0, 0, 6.2832); c.fill(); }

  /* Torso: the shoulders-to-hips shape, rounded off by stroking its edge. */
  const torso = [P(L.L_SHOULDER), P(L.R_SHOULDER), P(L.R_HIP), P(L.L_HIP)];
  c.fillStyle = '#f4f6fb'; c.strokeStyle = '#f4f6fb'; c.lineWidth = sw * 0.35;
  c.beginPath(); torso.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.stroke();
  /* Chest panel with two buttons, and a belt in the player's colour. */
  c.fillStyle = '#dfe4ee'; c.beginPath(); c.roundRect(cx - sw * 0.22, cy + (hy - cy) * 0.22, sw * 0.44, sw * 0.3, sw * 0.06); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(cx - sw * 0.09, cy + (hy - cy) * 0.22 + sw * 0.15, sw * 0.06, 0, 6.2832); c.fill();
  c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(cx + sw * 0.09, cy + (hy - cy) * 0.22 + sw * 0.15, sw * 0.06, 0, 6.2832); c.fill();
  c.strokeStyle = col; c.lineWidth = sw * 0.14;
  c.beginPath(); c.moveTo(lhx, lhy); c.lineTo(rhx, rhy); c.stroke();

  limb(L.L_SHOULDER, L.L_ELBOW, L.L_WRIST, sw * 0.32, '#f4f6fb');
  limb(L.R_SHOULDER, L.R_ELBOW, L.R_WRIST, sw * 0.32, '#f4f6fb');
  for (const w of [L.L_WRIST, L.R_WRIST]) if (seen(w)){
    const [x, y] = P(w);
    c.fillStyle = col; c.beginPath(); c.arc(x, y, sw * 0.2, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(x - sw * 0.06, y - sw * 0.06, sw * 0.07, 0, 6.2832); c.fill();
  }

  /* The helmet: a collar, then the glass with the face in it. */
  const [nx, ny] = P(L.NOSE), head = { x: nx, y: ny - sw * 0.08, r: sw * 0.62 };
  c.fillStyle = '#9aa3b8'; c.beginPath(); c.ellipse(cx, cy - sw * 0.04, sw * 0.42, sw * 0.16, 0, 0, 6.2832); c.fill();
  c.save(); c.beginPath(); c.arc(head.x, head.y, head.r, 0, 6.2832); c.clip();
  c.fillStyle = '#20264d'; c.fillRect(head.x - head.r, head.y - head.r, head.r * 2, head.r * 2);
  if (face) face(head.x, head.y, head.r * 0.92);
  const glass = c.createLinearGradient(head.x - head.r, head.y - head.r, head.x + head.r, head.y + head.r);
  glass.addColorStop(0, 'rgba(200,235,255,.28)'); glass.addColorStop(0.5, 'rgba(200,235,255,.05)'); glass.addColorStop(1, 'rgba(120,160,255,.15)');
  c.fillStyle = glass; c.fillRect(head.x - head.r, head.y - head.r, head.r * 2, head.r * 2);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = head.r * 0.08;
  c.beginPath(); c.arc(head.x, head.y, head.r * 0.8, -2.6, -1.9); c.stroke();
  c.strokeStyle = '#e9edf5'; c.lineWidth = head.r * 0.12;
  c.beginPath(); c.arc(head.x, head.y, head.r, 0, 6.2832); c.stroke();
  c.strokeStyle = col; c.lineWidth = head.r * 0.05;
  c.beginPath(); c.arc(head.x, head.y, head.r * 1.06, Math.PI * 0.75, Math.PI * 1.25); c.stroke();
  c.restore();
  return head;
}

/* A standing pose made up from a single point - the mouse, or a picture on
   the menu - with one hand reaching to (hx, hy). Mirrored like the real ones. */
export function standIn(x, hx = null, hy = null, s = 0.3){
  const lm = Array.from({ length: 33 }, () => ({ x, y: 0.6, v: 0.9 }));
  const at = (i, dx, dy) => { lm[i] = { x: x + dx * s * 0.6, y: 0.55 + dy * s, v: 0.9 }; };
  at(L.NOSE, 0, -0.45); at(L.L_EYE, 0.04, -0.48); at(L.R_EYE, -0.04, -0.48); at(7, 0.08, -0.46); at(8, -0.08, -0.46);
  at(L.L_SHOULDER, 0.2, -0.25); at(L.R_SHOULDER, -0.2, -0.25);
  at(L.L_ELBOW, 0.32, -0.02); at(L.R_ELBOW, -0.32, -0.02);
  at(L.L_WRIST, 0.34, 0.2); at(L.R_WRIST, -0.34, 0.2);
  at(L.L_HIP, 0.13, 0.25); at(L.R_HIP, -0.13, 0.25);
  at(L.L_KNEE, 0.15, 0.55); at(L.R_KNEE, -0.15, 0.55);
  at(L.L_ANKLE, 0.15, 0.85); at(L.R_ANKLE, -0.15, 0.85);
  if (hx != null){
    /* The hand reaches toward the point, but no further than an arm can:
       the made-up body has proportions, unlike a mouse pointer. */
    const sh = lm[L.R_SHOULDER], reach = s * 0.5;
    const dx = (hx - sh.x) * 16 / 9, dy = hy - sh.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, reach / d);
    const wx = sh.x + (hx - sh.x) * k, wy = sh.y + dy * k;
    lm[L.R_WRIST] = { x: wx, y: wy, v: 0.9 };
    lm[L.R_ELBOW] = { x: (sh.x + wx) / 2 - s * 0.04, y: (sh.y + wy) / 2 + s * 0.04, v: 0.9 };
  }
  return lm;
}

export { PLAYER_COLORS };
