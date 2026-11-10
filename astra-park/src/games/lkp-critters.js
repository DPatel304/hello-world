/* Last Known Position - the little wildlife of Verdant, for the calm
   stretch at the start of level 1: nothing to do with them, just to see.

     skyJellies  looking up (lkp-game.js _vista): floating sky jellies
                 drifting over on the wind - soft glowing bells, ribbons
                 trailing, pulsing slowly; big ones near, small ones far
     glowfins    looking down into the healing pond: little glowing fish
                 swimming round the crew's boots, in and out of each other

   Both gentle: kid-sized wonder, never scary. */
import { P } from './lkp-art.js';
import { glow } from './lkp-world.js';

const TAU = Math.PI * 2;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const COLS = [['#ffc6e8', '#ff8fcf'], ['#c9f2ff', '#7fd8ff'], ['#e3d4ff', '#b49cff'], ['#fff1c4', '#ffd27a']];

/* One sky jelly: its bell at (x, y), s wide, pulsing; ribbons trailing
   down and behind (dir: the way it's drifting). */
function jelly(c, x, y, s, t, col, a = 1){
  const pulse = Math.sin(t * 1.6), w = s * (1 + 0.08 * pulse), h = s * (0.62 - 0.06 * pulse);
  c.save(); c.globalAlpha = a;
  glow(c, x, y, s * 1.3, col[1], 0.35);
  /* the ribbons, waving */
  c.lineCap = 'round';
  for (let k = 0; k < 5; k++){
    const ox = (k / 4 - 0.5) * w * 0.8, len = s * (1.1 + 0.5 * ((k * 7) % 3) / 2);
    c.strokeStyle = k % 2 ? col[0] : col[1]; c.globalAlpha = a * 0.75; c.lineWidth = Math.max(1, s * (k % 2 ? 0.05 : 0.08));
    c.beginPath(); c.moveTo(x + ox, y + h * 0.1);
    for (let j = 1; j <= 6; j++){ const v = j / 6; c.lineTo(x + ox + Math.sin(t * 2.2 + k + v * 4) * s * 0.12 * v, y + h * 0.1 + v * len); }
    c.stroke();
  }
  c.globalAlpha = a;
  /* the bell: a dome, see-through, lit at the top */
  const g = c.createRadialGradient(x - w * 0.15, y - h * 0.5, s * 0.05, x, y - h * 0.2, w * 0.7);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.35, col[0]); g.addColorStop(1, col[1]);
  c.fillStyle = g; c.globalAlpha = a * 0.85;
  c.beginPath(); c.moveTo(x - w * 0.5, y + h * 0.12);
  c.bezierCurveTo(x - w * 0.55, y - h * 1.1, x + w * 0.55, y - h * 1.1, x + w * 0.5, y + h * 0.12);
  for (let k = 4; k >= 0; k--){ const fx = x - w * 0.5 + w * (k + 0.5) / 5; c.quadraticCurveTo(fx + w * 0.1, y + h * 0.3, x - w * 0.5 + w * k / 5, y + h * 0.12); }
  c.fill();
  /* little lights round its rim, and a shine */
  c.globalAlpha = a;
  c.fillStyle = 'rgba(255,255,255,.8)';
  for (let k = 0; k < 5; k++){ c.beginPath(); c.arc(x - w * 0.4 + w * 0.2 * k, y + h * 0.05, s * 0.025, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x - w * 0.18, y - h * 0.62, w * 0.12, h * 0.12, -0.5, 0, TAU); c.fill();
  c.restore();
}

/* The sky, looking up: a drift of sky jellies floating across on the
   wind, slow, bobbing - k how far the view's tilted up (0..1, they fade
   in with it), t the time, u how long since the look began. */
export function skyJellies(c, W, H, t, k, u = 0){
  if (k <= 0.02) return;
  const n = 11;
  for (let i = 0; i < n; i++){
    const far = hash(i + 40), s = H * (0.035 + 0.11 * (1 - far));
    /* drifting right to left across the sky, each its own pace and height */
    const speed = 0.018 + 0.03 * (1 - far), x = W * (1.15 - ((hash(i + 41) + u * speed) % 1.3)), y = H * (0.1 + 0.42 * far + 0.05 * Math.sin(t * 0.5 + i)) ;
    jelly(c, x, y, s, t + i * 0.7, COLS[i % COLS.length], k * (0.55 + 0.45 * (1 - far)));
  }
}

/* A little glowing fish at (x, y), s long, swimming dir (-1 left, 1 right),
   under the water: a soft light round it, its tail flicking. */
function fin(c, x, y, s, t, dir, col, a){
  const wag = Math.sin(t * 9) * 0.35;
  c.save(); c.globalAlpha = a;
  glow(c, x, y, s * 1.4, col[1], 0.5);
  c.translate(x, y); c.scale(dir, 1);
  c.fillStyle = col[1];
  c.beginPath(); c.moveTo(-s * 0.35, 0); c.lineTo(-s * 0.7, -s * 0.22 + wag * s * 0.2); c.lineTo(-s * 0.7, s * 0.22 + wag * s * 0.2); c.closePath(); c.fill();
  c.fillStyle = col[0]; c.beginPath(); c.ellipse(0, 0, s * 0.42, s * 0.2, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(s * 0.05, -s * 0.06, s * 0.2, s * 0.05, 0, 0, TAU); c.fill();
  c.fillStyle = '#1a2a40'; c.beginPath(); c.arc(s * 0.24, -s * 0.03, s * 0.04, 0, TAU); c.fill();
  c.restore();
}

/* Glowing fish in the healing pond, round the crew (their depth, rel
   0.., a little in front), swimming lazy loops - a: how clear (0..1). */
export function glowfins(c, W, H, t, a = 1){
  if (a <= 0.02) return;
  for (let i = 0; i < 18; i++){
    const sp = 0.25 + 0.2 * hash(i + 60), ph = t * sp + hash(i + 61) * TAU;
    const lane = Math.sin(ph) * (0.5 + 0.7 * hash(i + 62)) + (hash(i + 63) - 0.5) * 0.4;
    const rel = -0.13 + 0.17 * (0.5 + 0.5 * Math.sin(ph * 0.7 + i));
    const dir = Math.cos(ph) >= 0 ? 1 : -1, p = P(lane, rel, W, H);
    fin(c, p.x, p.y - H * 0.01 * p.k, H * 0.05 * p.k * (0.8 + 0.4 * hash(i + 64)), t + i, dir, COLS[i % COLS.length], a * 0.85);
  }
}
