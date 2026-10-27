/* Uncle B's Boat, painted: a lake on a bright day, seen side on, so the
   boat floats along the top and most of the screen is the clear water
   underneath - light rays, swaying weeds, sand and stones - where the fish
   swim. And Uncle B himself, in his khaki cap with his sunglasses up on the
   brim, with the children either side of him in the boat.

   The sky, the far shore and the still parts of the water are painted once
   per screen size and time of day; the waves, rays, weeds and bubbles move. */
import { lighting } from './pop-party-scene.js';

export const WATER = 0.4;            /* the surface, in screen heights */
export const BOAT_X = 0.5, BOAT_W = 0.46;
/* Where each seat is across the boat (screen widths), and which way that
   seat's rod points: left kid fishes off the left, right kid off the right. */
export const SEATS = [{ x: 0.335, side: -1 }, { x: 0.665, side: 1 }];
export const UNCLE_X = 0.5;

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hash = (i, k = 1) => ((((i + 7919) * 2654435761 * k) % 4294967296) + 4294967296) % 4294967296 / 4294967296;

const WEEDS = Array.from({ length: 14 }, (_, i) => ({ x: hash(i, 3) * 1.02 - 0.01, h: 0.1 + hash(i, 5) * 0.16, ph: hash(i, 7) * 6.28, col: i % 3 }));
const STONES = Array.from({ length: 12 }, (_, i) => ({ x: hash(i, 11), r: 0.012 + hash(i, 13) * 0.025, tone: hash(i, 17) }));

let cache = null;
function layer(W, H, p){
  const key = `${W}x${H}:${Math.round(p * 50)}`;
  if (cache && cache.key === key) return cache.cv;
  let cv = cache && cache.cv;
  try { cv = cv || document.createElement('canvas'); if (!cv.getContext) cv = null; } catch { cv = null; }
  cache = { key, cv };
  if (cv){ cv.width = Math.round(W); cv.height = Math.round(H); paintStill(cv.getContext('2d'), W, H, p); }
  return cv;
}

/* Everything that never moves: sky, sun, far shore, the water's depth and
   the lake bed. */
function paintStill(c, W, H, p){
  const L = lighting(0.12 + p * 0.7);
  const sky = c.createLinearGradient(0, 0, 0, H * WATER);
  sky.addColorStop(0, rgb(L.top)); sky.addColorStop(0.7, rgb(L.mid)); sky.addColorStop(1, rgb(L.low));
  c.fillStyle = sky; c.fillRect(0, 0, W, H * WATER + 2);
  const sx = W * (0.18 + p * 0.6), sy = H * (0.1 + p * 0.12), sr = H * 0.05;
  const glow = c.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 4);
  glow.addColorStop(0, rgb(mix(L.sun, [255, 255, 255], 0.4), 0.7)); glow.addColorStop(1, rgb(L.sun, 0));
  c.fillStyle = glow; c.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
  c.fillStyle = rgb(L.sun); c.beginPath(); c.arc(sx, sy, sr, 0, 6.2832); c.fill();

  /* The far shore: blue hills, a line of pines, and a little cabin and dock. */
  const tint = (hex, haze) => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return rgb(mix(mix(v, L.light, L.amt), L.low, haze)); };
  c.fillStyle = tint('#8fa9d6', 0.4);
  c.beginPath(); c.moveTo(0, H * WATER);
  for (let i = 0; i <= 30; i++){ const u = i / 30; c.lineTo(u * W, H * (WATER - 0.07 - 0.05 * Math.sin(u * 7.1 + 1) - 0.02 * Math.sin(u * 19))); }
  c.lineTo(W, H * WATER); c.closePath(); c.fill();
  c.fillStyle = tint('#3f7a5c', 0.25);
  for (let i = 0; i < 46; i++){
    const x = (i / 45) * W + (hash(i, 23) - 0.5) * W * 0.02, h = H * (0.035 + hash(i, 29) * 0.03), y = H * WATER;
    c.beginPath(); c.moveTo(x - h * 0.32, y); c.lineTo(x, y - h); c.lineTo(x + h * 0.32, y); c.closePath(); c.fill();
  }
  const cx = W * 0.86, cy = H * (WATER - 0.005), cw = H * 0.07;
  c.fillStyle = tint('#b5523f', 0.15); c.fillRect(cx - cw / 2, cy - cw * 0.55, cw, cw * 0.55);
  c.fillStyle = tint('#6b4a30', 0.15); c.beginPath(); c.moveTo(cx - cw * 0.6, cy - cw * 0.55); c.lineTo(cx, cy - cw * 0.95); c.lineTo(cx + cw * 0.6, cy - cw * 0.55); c.closePath(); c.fill();
  c.fillStyle = tint('#ffe2a0', 0.1); c.fillRect(cx - cw * 0.12, cy - cw * 0.38, cw * 0.24, cw * 0.18);
  c.fillStyle = tint('#8a6a4a', 0.15); c.fillRect(cx - cw * 1.6, cy - cw * 0.08, cw * 1.2, cw * 0.06);

  /* Under the surface: clear and green-blue, deepening, down to the sand. */
  const deep = c.createLinearGradient(0, H * WATER, 0, H);
  deep.addColorStop(0, '#68c9d6'); deep.addColorStop(0.35, '#3a9db8'); deep.addColorStop(0.75, '#1f6f93'); deep.addColorStop(1, '#174f72');
  c.fillStyle = deep; c.fillRect(0, H * WATER, W, H * (1 - WATER));
  const sand = c.createLinearGradient(0, H * 0.92, 0, H);
  sand.addColorStop(0, '#c9b98a'); sand.addColorStop(1, '#a8966a');
  c.fillStyle = sand;
  c.beginPath(); c.moveTo(0, H);
  for (let i = 0; i <= 24; i++){ const u = i / 24; c.lineTo(u * W, H * (0.935 + 0.015 * Math.sin(u * 9 + 2))); }
  c.lineTo(W, H); c.closePath(); c.fill();
  for (const s of STONES){
    c.fillStyle = s.tone < 0.5 ? '#7d8a8f' : '#93887a';
    c.beginPath(); c.ellipse(s.x * W, H * 0.95, H * s.r * 1.4, H * s.r, 0, Math.PI, 0); c.fill();
  }
}

export function drawLake(c, W, H, t, p){
  const cv = layer(W, H, p);
  if (cv) c.drawImage(cv, 0, 0, W, H); else paintStill(c, W, H, p);
  /* Clouds drifting. */
  for (let i = 0; i < 5; i++){
    const x = (((hash(i, 31) + t * 0.004 * (1 + i * 0.2)) % 1.3) - 0.15) * W, y = H * (0.05 + hash(i, 37) * 0.17), w = H * (0.06 + hash(i, 41) * 0.05);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath();
    for (const [dx, dy, r] of [[0, 0, 0.42], [-0.45, 0.12, 0.3], [0.45, 0.12, 0.32], [-0.2, -0.15, 0.32], [0.22, -0.1, 0.3]]){ c.moveTo(x + dx * w + r * w, y + dy * w); c.arc(x + dx * w, y + dy * w, r * w, 0, 6.2832); }
    c.moveTo(x + w * 0.72, y + w * 0.2); c.ellipse(x, y + w * 0.2, w * 0.72, w * 0.2, 0, 0, 6.2832); c.fill();
  }
  /* Sunlight in the water: soft beams that sway. */
  for (let i = 0; i < 6; i++){
    const x = W * (0.08 + i * 0.17 + Math.sin(t * 0.2 + i) * 0.02), w = W * 0.05;
    const g = c.createLinearGradient(0, H * WATER, 0, H * 0.9);
    g.addColorStop(0, 'rgba(255,255,230,.16)'); g.addColorStop(1, 'rgba(255,255,230,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x, H * WATER); c.lineTo(x + w, H * WATER); c.lineTo(x + w * 2.6, H * 0.9); c.lineTo(x + w * 1.4, H * 0.9); c.closePath(); c.fill();
  }
}

/* Weeds swaying on the lake bed, in front of the fish that swim deepest. */
export function drawWeeds(c, W, H, t){
  const cols = ['#2f8a5a', '#3fa36a', '#5bb874'];
  c.lineCap = 'round';
  for (const wd of WEEDS){
    c.strokeStyle = cols[wd.col]; c.lineWidth = Math.max(3, H * 0.012);
    const x = wd.x * W, base = H * 0.95, h = wd.h * H;
    c.beginPath(); c.moveTo(x, base);
    for (let k = 1; k <= 6; k++){ const u = k / 6; c.lineTo(x + Math.sin(t * 1.1 + wd.ph + u * 2.5) * u * h * 0.18, base - u * h); }
    c.stroke();
  }
}

/* The surface: a soft band of light, with small waves along the top. */
export function drawSurface(c, W, H, t){
  const y = H * WATER;
  const g = c.createLinearGradient(0, y - H * 0.01, 0, y + H * 0.04);
  g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, y - H * 0.01, W, H * 0.05);
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(2, H * 0.004);
  c.beginPath();
  for (let i = 0; i <= 60; i++){ const u = i / 60; const yy = y + Math.sin(u * 40 + t * 2) * H * 0.003; i ? c.lineTo(u * W, yy) : c.moveTo(0, yy); }
  c.stroke();
}

/* ---------- the boat, Uncle B and the crew ---------- */

/* How the boat sits on the water right now: a slow bob and roll. */
export function boatBob(t){ return { dy: Math.sin(t * 1.1) * 0.006, roll: Math.sin(t * 0.8) * 0.02 }; }

export function drawBoatBack(c, W, H, t){
  /* The far rim of the boat, behind the people in it. */
  const { dy, roll } = boatBob(t), x = W * BOAT_X, y = H * (WATER + dy), w = W * BOAT_W;
  c.save(); c.translate(x, y); c.rotate(roll);
  c.fillStyle = '#8a5a3c';
  c.beginPath(); c.moveTo(-w * 0.47, -H * 0.05); c.lineTo(w * 0.47, -H * 0.05); c.lineTo(w * 0.45, -H * 0.035); c.lineTo(-w * 0.45, -H * 0.035); c.closePath(); c.fill();
  c.restore();
}

export function drawBoatFront(c, W, H, t){
  const { dy, roll } = boatBob(t), x = W * BOAT_X, y = H * (WATER + dy), w = W * BOAT_W, h = H * 0.11;
  c.save(); c.translate(x, y); c.rotate(roll);
  /* Hull: a rowboat in side view, painted white with a red stripe and his name. */
  const hull = () => { c.beginPath(); c.moveTo(-w * 0.52, -h * 0.5); c.lineTo(w * 0.54, -h * 0.55); c.quadraticCurveTo(w * 0.44, h * 0.55, w * 0.2, h * 0.6); c.lineTo(-w * 0.28, h * 0.6); c.quadraticCurveTo(-w * 0.46, h * 0.5, -w * 0.52, -h * 0.5); c.closePath(); };
  const paint = c.createLinearGradient(0, -h * 0.5, 0, h * 0.6);
  paint.addColorStop(0, '#fbf7ee'); paint.addColorStop(1, '#dcd3c2');
  c.fillStyle = paint; hull(); c.fill();
  c.save(); hull(); c.clip();
  c.strokeStyle = 'rgba(90,70,50,.12)'; c.lineWidth = Math.max(1, H * 0.002);
  c.beginPath(); for (let k = 1; k < 5; k++){ const yy = -h * 0.5 + h * 1.1 * k / 5; c.moveTo(-w * 0.6, yy); c.lineTo(w * 0.6, yy - h * 0.02); } c.stroke();
  c.fillStyle = '#d94a3a'; c.fillRect(-w * 0.6, h * 0.22, w * 1.2, h * 0.12);
  c.fillStyle = '#4b8fb8'; c.fillRect(-w * 0.6, h * 0.48, w * 1.2, h * 0.2);
  c.restore();
  c.fillStyle = '#8a5a3c'; c.beginPath(); c.roundRect(-w * 0.53, -h * 0.62, w * 1.08, h * 0.14, h * 0.06); c.fill();
  /* His name, painted on the bow. */
  c.fillStyle = '#2b4a6b'; c.font = `600 ${Math.round(h * 0.3)}px Fredoka, ui-rounded, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('UNCLE B', w * 0.3, -h * 0.08);
  c.textAlign = 'start'; c.textBaseline = 'alphabetic';
  /* An oar resting over the side. */
  c.strokeStyle = '#b07a48'; c.lineWidth = Math.max(3, H * 0.008); c.lineCap = 'round';
  c.beginPath(); c.moveTo(-w * 0.18, -h * 0.65); c.lineTo(-w * 0.34, h * 0.9); c.stroke();
  c.fillStyle = '#b07a48'; c.beginPath(); c.ellipse(-w * 0.35, h * 1.0, H * 0.012, H * 0.035, 0.18, 0, 6.2832); c.fill();
  c.restore();
}

/* Uncle B: light skin, clean-shaven, a big smile, a khaki cap with his
   sunglasses pushed up on the brim, and a teal t-shirt. pose: idle, cast
   (k 0..1 through the swing), reel (k turning), cheer. Returns where his
   hands are, for his rod. */
export function drawUncle(c, W, H, t, pose = 'idle', k = 0){
  const { dy, roll } = boatBob(t), u = H / 900;
  const x = W * UNCLE_X, y = H * (WATER + dy) - 70 * u;
  c.save(); c.translate(x, y); c.rotate(roll);
  /* Body: shoulders and a t-shirt, sitting low in the boat. */
  c.fillStyle = '#2f9a92';
  c.beginPath(); c.moveTo(-58 * u, 40 * u); c.quadraticCurveTo(-62 * u, -40 * u, 0, -48 * u); c.quadraticCurveTo(62 * u, -40 * u, 58 * u, 40 * u); c.closePath(); c.fill();
  c.fillStyle = '#2a8a83'; c.beginPath(); c.moveTo(-14 * u, -46 * u); c.lineTo(0, -30 * u); c.lineTo(14 * u, -46 * u); c.closePath(); c.fill();
  /* Arms, by pose. */
  const skin = '#f2cba8', sleeve = '#2f9a92';
  let hands;
  if (pose === 'cheer'){
    const w = Math.sin(t * 8) * 0.15;
    hands = [[-70 * u, -120 * u + w * 20 * u], [70 * u, -120 * u - w * 20 * u]];
  } else if (pose === 'cast'){
    /* Up over the shoulder, then forward and out. */
    const a = -2.3 + k * 2.4;
    hands = [[Math.cos(a) * 60 * u + 20 * u, Math.sin(a) * 60 * u - 20 * u], [Math.cos(a) * 60 * u + 30 * u, Math.sin(a) * 60 * u - 10 * u]];
  } else if (pose === 'reel'){
    hands = [[20 * u + Math.cos(k) * 14 * u, -5 * u + Math.sin(k) * 14 * u], [44 * u, 0]];
  } else {
    hands = [[24 * u, 4 * u + Math.sin(t * 1.3) * 2 * u], [42 * u, 8 * u]];
  }
  for (const [i, sx] of [[0, -40], [1, 40]]){
    const [hx, hy] = hands[i];
    c.strokeStyle = sleeve; c.lineWidth = 26 * u; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx * u, -30 * u); c.lineTo((sx * u + hx) / 2, (-30 * u + hy) / 2); c.stroke();
    c.strokeStyle = skin; c.lineWidth = 20 * u;
    c.beginPath(); c.moveTo((sx * u + hx) / 2, (-30 * u + hy) / 2); c.lineTo(hx, hy); c.stroke();
    c.fillStyle = skin; c.beginPath(); c.arc(hx, hy, 12 * u, 0, 6.2832); c.fill();
  }
  /* Head: ears, face, a big smile. */
  const hx = 0, hy = -100 * u, r = 44 * u;
  c.fillStyle = skin;
  c.beginPath(); c.ellipse(hx - r * 0.95, hy + 4 * u, 9 * u, 13 * u, 0, 0, 6.2832); c.ellipse(hx + r * 0.95, hy + 4 * u, 9 * u, 13 * u, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.ellipse(hx, hy, r, r * 1.08, 0, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(230,120,110,.3)'; c.beginPath(); c.ellipse(hx - 24 * u, hy + 14 * u, 9 * u, 6 * u, 0, 0, 6.2832); c.ellipse(hx + 24 * u, hy + 14 * u, 9 * u, 6 * u, 0, 0, 6.2832); c.fill();
  const blink = (t % 4.1) < 0.12 ? 0.2 : 1, happy = pose === 'cheer';
  c.fillStyle = '#2b2440'; c.strokeStyle = '#2b2440'; c.lineWidth = 4 * u; c.lineCap = 'round';
  for (const d of [-1, 1]){
    if (happy){ c.beginPath(); c.arc(hx + d * 16 * u, hy + 2 * u, 7 * u, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    else { c.beginPath(); c.ellipse(hx + d * 16 * u, hy, 5 * u, 6.5 * u * blink, 0, 0, 6.2832); c.fill(); }
  }
  c.strokeStyle = 'rgba(140,90,60,.6)'; c.lineWidth = 3 * u;
  c.beginPath(); c.moveTo(hx - 24 * u, hy - 14 * u); c.lineTo(hx - 9 * u, hy - 16 * u); c.moveTo(hx + 9 * u, hy - 16 * u); c.lineTo(hx + 24 * u, hy - 14 * u); c.stroke();
  c.fillStyle = '#e8b292'; c.beginPath(); c.ellipse(hx, hy + 9 * u, 5 * u, 7 * u, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#7a3a3a';
  c.beginPath(); c.moveTo(hx - 17 * u, hy + 20 * u); c.quadraticCurveTo(hx, hy + (happy ? 40 : 34) * u, hx + 17 * u, hy + 20 * u); c.closePath(); c.fill();
  c.fillStyle = '#ffffff'; c.fillRect(hx - 11 * u, hy + 20 * u, 22 * u, 4 * u);
  /* The khaki cap, brim forward, sunglasses up on it. */
  const cap = c.createLinearGradient(0, hy - r * 1.2, 0, hy - r * 0.3);
  cap.addColorStop(0, '#d8c48f'); cap.addColorStop(1, '#bba46c');
  c.fillStyle = cap; c.beginPath(); c.ellipse(hx, hy - r * 0.42, r * 1.02, r * 0.78, 0, Math.PI, 0); c.fill();
  c.fillStyle = '#a89058'; c.beginPath(); c.ellipse(hx, hy - r * 0.4, r * 1.18, r * 0.22, 0, 0, Math.PI); c.fill();
  c.fillStyle = '#c9b37a'; c.beginPath(); c.arc(hx, hy - r * 1.18, 4 * u, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(120,100,60,.35)'; c.lineWidth = 2 * u;
  c.beginPath(); c.moveTo(hx, hy - r * 1.18); c.lineTo(hx, hy - r * 0.45); c.stroke();
  c.fillStyle = '#20232f';
  for (const d of [-1, 1]){ c.beginPath(); c.roundRect(hx + d * 17 * u - 13 * u, hy - r * 0.78, 26 * u, 15 * u, 6 * u); c.fill(); }
  c.fillStyle = 'rgba(140,200,255,.35)'; for (const d of [-1, 1]){ c.beginPath(); c.roundRect(hx + d * 17 * u - 9 * u, hy - r * 0.76, 8 * u, 5 * u, 2 * u); c.fill(); }
  c.strokeStyle = '#20232f'; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(hx - 4 * u, hy - r * 0.72); c.lineTo(hx + 4 * u, hy - r * 0.72); c.stroke();
  c.restore();
  /* Hands in screen space, for the rod. */
  const cos = Math.cos(roll), sin = Math.sin(roll);
  return hands.map(([px, py]) => ({ x: x + px * cos - py * sin, y: y + px * sin + py * cos }));
}

/* A child in the boat: a life jacket in their colour, a bucket hat, and
   their face - face(x, y, r) fills the circle. Returns their hand. */
export function drawCrew(c, W, H, t, seat, col, face, pose = 'idle', k = 0){
  const { dy, roll } = boatBob(t), u = H / 900 * 1.2, S = SEATS[seat];
  const x = W * S.x, y = H * (WATER + dy) - 54 * u;
  c.save(); c.translate(x, y); c.rotate(roll);
  c.fillStyle = col;
  c.beginPath(); c.moveTo(-42 * u, 30 * u); c.quadraticCurveTo(-46 * u, -34 * u, 0, -40 * u); c.quadraticCurveTo(46 * u, -34 * u, 42 * u, 30 * u); c.closePath(); c.fill();
  c.fillStyle = '#ffb02e'; c.fillRect(-30 * u, -24 * u, 14 * u, 50 * u); c.fillRect(16 * u, -24 * u, 14 * u, 50 * u);
  c.fillStyle = '#ffffff'; c.fillRect(-30 * u, 0, 60 * u, 6 * u);
  const r = 52 * u, hx = 0, hy = -90 * u;
  c.save(); c.beginPath(); c.arc(hx, hy, r, 0, 6.2832); c.clip();
  c.fillStyle = '#cfe6fb'; c.fillRect(hx - r, hy - r, r * 2, r * 2);
  if (face) face(hx, hy, r);
  c.restore();
  c.strokeStyle = '#ffffff'; c.lineWidth = 6 * u; c.beginPath(); c.arc(hx, hy, r + 2 * u, 0, 6.2832); c.stroke();
  /* Bucket hat. */
  c.fillStyle = col; c.beginPath(); c.ellipse(hx, hy - r * 0.62, r * 0.82, r * 0.5, 0, Math.PI, 0); c.fill();
  c.beginPath(); c.ellipse(hx, hy - r * 0.6, r * 1.15, r * 0.2, 0, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(hx - r * 0.8, hy - r * 0.78, r * 1.6, r * 0.1);
  /* The rod arm, out toward their side. */
  const side = S.side;
  let hand = [side * 34 * u, -6 * u];
  if (pose === 'cast'){ const a = -1.9 + k * 1.9; hand = [side * (20 + Math.cos(a) * 30) * u, (Math.sin(a) * 40 - 10) * u]; }
  else if (pose === 'reel'){ hand = [side * 30 * u + Math.cos(k) * 10 * u, -4 * u + Math.sin(k) * 10 * u]; }
  else if (pose === 'cheer'){ hand = [side * 40 * u, -70 * u]; }
  c.strokeStyle = col; c.lineWidth = 18 * u; c.lineCap = 'round';
  c.beginPath(); c.moveTo(side * 30 * u, -26 * u); c.lineTo(hand[0], hand[1]); c.stroke();
  c.fillStyle = '#f2cba8'; c.beginPath(); c.arc(hand[0], hand[1], 9 * u, 0, 6.2832); c.fill();
  c.restore();
  const cos = Math.cos(roll), sin = Math.sin(roll);
  return { x: x + hand[0] * cos - hand[1] * sin, y: y + hand[0] * sin + hand[1] * cos };
}

/* A rod from the hand at `ang` (radians, 0 pointing right), `len` pixels;
   returns its tip. */
export function drawRod(c, hand, ang, len, H){
  const tip = { x: hand.x + Math.cos(ang) * len, y: hand.y + Math.sin(ang) * len };
  c.strokeStyle = '#3b3f4f'; c.lineWidth = Math.max(3, H * 0.006); c.lineCap = 'round';
  c.beginPath(); c.moveTo(hand.x - Math.cos(ang) * H * 0.03, hand.y - Math.sin(ang) * H * 0.03); c.lineTo(tip.x, tip.y); c.stroke();
  c.fillStyle = '#c9ccd6'; c.beginPath(); c.arc(hand.x + Math.cos(ang) * H * 0.02, hand.y + Math.sin(ang) * H * 0.02 + H * 0.012, H * 0.012, 0, 6.2832); c.fill();
  return tip;
}

/* The line from the rod tip to the bobber on the surface, and on down to
   the hook with its wiggly worm. bob is how far the bobber is dipping. */
export function drawLine(c, tip, bob, hook, H, t, bobbing = 0){
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(1, H * 0.0018);
  c.beginPath(); c.moveTo(tip.x, tip.y);
  c.quadraticCurveTo((tip.x + bob.x) / 2, Math.max(tip.y, bob.y) + H * 0.02, bob.x, bob.y);
  if (hook){ c.lineTo(hook.x, hook.y); }
  c.stroke();
  /* Bobber: red over white, dipping when something nibbles. */
  const by = bob.y + bobbing * H * 0.02, r = H * 0.014;
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(bob.x, by, r, 0, Math.PI); c.fill();
  c.fillStyle = '#e8413c'; c.beginPath(); c.arc(bob.x, by, r, Math.PI, 0); c.fill();
  c.fillStyle = '#3b3f4f'; c.fillRect(bob.x - r * 0.12, by - r * 1.6, r * 0.24, r * 0.7);
  if (hook){
    c.strokeStyle = '#c9ccd6'; c.lineWidth = Math.max(1.5, H * 0.003);
    c.beginPath(); c.arc(hook.x, hook.y + H * 0.008, H * 0.008, 0, Math.PI); c.stroke();
    c.strokeStyle = '#e88a8a'; c.lineWidth = Math.max(2, H * 0.005); c.lineCap = 'round';
    c.beginPath(); c.moveTo(hook.x, hook.y + H * 0.012);
    for (let k = 1; k <= 4; k++) c.lineTo(hook.x + Math.sin(t * 6 + k) * H * 0.006, hook.y + H * 0.012 + k * H * 0.006);
    c.stroke();
  }
}

/* Ripples spreading on the surface where something splashed. */
export function drawRipple(c, x, y, age, H){
  for (let k = 0; k < 3; k++){
    const a = age - k * 0.2;
    if (a < 0 || a > 1.2) continue;
    c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - a / 1.2)})`; c.lineWidth = Math.max(1.5, H * 0.003);
    c.beginPath(); c.ellipse(x, y, H * (0.02 + a * 0.08), H * (0.005 + a * 0.012), 0, 0, 6.2832); c.stroke();
  }
}

/* An open hand seen from the front: a curved palm, ( or ), hollow toward
   `facing` (the angle toward the other hand), so two apart read as open
   hands and two together close round a fish like a cup. */
export function drawPalm(c, x, y, r, facing, col, alpha = 1){
  const halo = c.createRadialGradient(x, y, r * 0.3, x, y, r * 2.2);
  halo.addColorStop(0, col + Math.round(0x55 * alpha).toString(16).padStart(2, '0'));
  halo.addColorStop(1, col + '00');
  c.fillStyle = halo; c.beginPath(); c.arc(x, y, r * 2.2, 0, 6.2832); c.fill();
  c.save(); c.globalAlpha = alpha;
  c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.75; c.lineCap = 'round';
  const cx = x + Math.cos(facing) * r, cy = y + Math.sin(facing) * r, back = facing + Math.PI;
  c.beginPath(); c.arc(cx, cy, r, back - 1.1, back + 1.1); c.stroke();
  c.strokeStyle = col; c.lineWidth = r * 0.42;
  c.beginPath(); c.arc(cx, cy, r, back - 1.1, back + 1.1); c.stroke();
  c.restore();
}
