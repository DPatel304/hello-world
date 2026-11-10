/* Last Known Position - the little wildlife of Verdant, for the calm
   stretch at the start of level 1: nothing to do with them, just to see.

     skyJellies  looking up (lkp-game.js _vista): floating sky jellies
                 drifting over on the wind - soft glowing bells, ribbons
                 trailing, pulsing slowly; big ones near, small ones far
     driftJellies  the same, out in the world: drifting across the land
                 on their own way, over the path, and off into the haze
     herdMass    the herd as a whole: too thick to tell one from another
     trumbler    a great slow alien beast that scatters the herd
     glimmerback the herd animal: soft, glowing, six-legged, in a mass
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

/* The sky, looking up: a drift of sky jellies floating over on the wind,
   slow, bobbing - the camera following them, so they stay up in the sky
   above the crew as they go. k: how far the view's tilted up (0..1, they
   fade in with it); t: the time; u: seconds since the look began. */
export function skyJellies(c, W, H, t, k, u = 0, size = 1){
  if (k <= 0.02) return;
  /* the drift's middle, coming in from the right and slowing, the camera keeping up */
  const cx = W * (0.62 - 0.012 * u) + W * 0.35 * Math.pow(1 - Math.min(1, u / 3), 2), cy = H * 0.2;
  for (let i = 0; i < 12; i++){
    const far = hash(i + 40), s = H * (0.03 + 0.07 * (1 - far)) * size;
    const x = cx + (hash(i + 41) - 0.5) * W * 0.62 + Math.sin(t * 0.3 + i) * W * 0.01 - u * W * 0.004 * (1 - far);
    const y = cy + (hash(i + 42) - 0.5) * H * 0.24 + 0.02 * H * Math.sin(t * 0.5 + i * 1.3);
    jelly(c, x, y, s, t + i * 0.7, COLS[i % COLS.length], k * (0.55 + 0.45 * (1 - far)));
  }
}

/* A little glowing fish at (x, y), s long, swimming dir (-1 left, 1 right),
   under the water: a soft light round it, its tail flicking. */
function fin(c, x, y, s, t, dir, col, a){
  /* (under the water: its colours softened into the water's, flat - dark
     back, lighter belly - no glow; a soft ripple over it now and then) */
  const wag = Math.sin(t * 7) * 0.3, water = '#5fc8d8';
  const back = mixHex(col[1], water, 0.55), belly = mixHex(col[0], water, 0.45);
  c.save(); c.globalAlpha = a * 0.75;
  c.translate(x, y); c.scale(dir, 1);
  c.fillStyle = back;
  c.beginPath(); c.moveTo(-s * 0.32, 0); c.lineTo(-s * 0.62, -s * 0.18 + wag * s * 0.16); c.lineTo(-s * 0.62, s * 0.18 + wag * s * 0.16); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(0, 0, s * 0.4, s * 0.17, 0, 0, TAU); c.fill();
  c.fillStyle = belly; c.beginPath(); c.ellipse(s * 0.04, s * 0.05, s * 0.28, s * 0.08, 0, 0, TAU); c.fill();
  c.fillStyle = mixHex('#1a2a40', water, 0.3); c.beginPath(); c.arc(s * 0.24, -s * 0.03, s * 0.03, 0, TAU); c.fill();
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

/* A puffhen: Verdant's little herd animal - half sheep, half chicken: a
   round woolly body, a chicken's head on top (a red comb, an orange beak),
   stubby wings flapping, quick orange legs. Seen from behind, running up
   the path (as the crew do), its feet at (x, y), s tall; t the time; side
   -1..1, turning (veering off, side on). */
export function puffhen(c, x, y, s, t, side = 0){
  const run = t * 16, bob = Math.abs(Math.sin(run)) * s * 0.06, by = y - s * 0.45 - bob;
  c.save();
  c.fillStyle = 'rgba(20,15,45,.3)'; c.beginPath(); c.ellipse(x, y, s * 0.4, s * 0.08, 0, 0, TAU); c.fill();
  /* legs, quick */
  c.strokeStyle = '#f0a040'; c.lineWidth = Math.max(1, s * 0.06); c.lineCap = 'round';
  for (const d of [-1, 1]){ const k = Math.sin(run + (d < 0 ? 0 : Math.PI)); c.beginPath(); c.moveTo(x + d * s * 0.12, by + s * 0.25); c.lineTo(x + d * s * 0.14 + k * s * 0.04 * side, y - s * 0.02 - Math.max(0, k) * s * 0.1); c.stroke(); }
  /* the wool: a cloud of puffs, shaded */
  for (let k = 0; k < 9; k++){
    const a = k / 9 * TAU, px = x + Math.cos(a) * s * 0.28, py = by + Math.sin(a) * s * 0.22;
    c.fillStyle = Math.sin(a) > 0.3 ? '#d8d2e6' : Math.cos(a) < -0.3 ? '#ffffff' : '#f2eef8'; c.beginPath(); c.arc(px, py, s * 0.17, 0, TAU); c.fill();
  }
  const g = c.createRadialGradient(x - s * 0.1, by - s * 0.1, s * 0.05, x, by, s * 0.35); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e4def0');
  c.fillStyle = g; c.beginPath(); c.ellipse(x, by, s * 0.3, s * 0.25, 0, 0, TAU); c.fill();
  /* little wings, flapping */
  const flap = Math.sin(t * 22) * 0.5;
  c.fillStyle = '#ece6f4';
  for (const d of [-1, 1]){ c.save(); c.translate(x + d * s * 0.3, by - s * 0.02); c.rotate(d * (0.4 + flap)); c.beginPath(); c.ellipse(d * s * 0.08, 0, s * 0.13, s * 0.06, 0, 0, TAU); c.fill(); c.restore(); }
  /* a tuft of tail feathers */
  c.fillStyle = '#ffd27a'; for (const d of [-1, 0, 1]){ c.beginPath(); c.ellipse(x + d * s * 0.05, by + s * 0.05, s * 0.03, s * 0.08, d * 0.4, 0, TAU); c.fill(); }
  /* the head on top, a little to the side it's turning */
  const hx = x + side * s * 0.18, hy = by - s * 0.3;
  c.fillStyle = '#fff8f0'; c.beginPath(); c.arc(hx, hy, s * 0.13, 0, TAU); c.fill();
  c.fillStyle = '#e8434e'; for (let k = 0; k < 3; k++){ c.beginPath(); c.arc(hx + (k - 1) * s * 0.05, hy - s * 0.13 - (k === 1 ? s * 0.02 : 0), s * 0.045, 0, TAU); c.fill(); }
  if (Math.abs(side) > 0.2){
    const d = Math.sign(side);
    c.fillStyle = '#f5a623'; c.beginPath(); c.moveTo(hx + d * s * 0.11, hy - s * 0.02); c.lineTo(hx + d * s * 0.2, hy + s * 0.01); c.lineTo(hx + d * s * 0.11, hy + s * 0.04); c.fill();
    c.fillStyle = '#2b2440'; c.beginPath(); c.arc(hx + d * s * 0.05, hy - s * 0.03, s * 0.025, 0, TAU); c.fill();
  }
  c.restore();
}

/* A hopshell: half bunny, half turtle - a domed green shell on its back,
   long soft ears, a bobtail, hopping about in the grass. Feet at (x, y),
   s tall, hop 0..1 (how high in its hop), dir which way it's facing. */
function hopshell(c, x, y, s, hop, dir, t){
  const up = Math.sin(Math.min(1, Math.max(0, hop)) * Math.PI) * s * 0.45, by = y - s * 0.32 - up;
  c.save();
  c.fillStyle = 'rgba(20,15,45,.25)'; c.beginPath(); c.ellipse(x, y, s * 0.42 * (1 - up / s * 0.6), s * 0.07, 0, 0, TAU); c.fill();
  c.translate(x, by); c.scale(dir, 1);
  /* feet, tucked in mid-hop */
  c.fillStyle = '#e9dccb'; for (const d of [-0.18, 0.16]){ c.beginPath(); c.ellipse(d * s, s * 0.26 - up * 0.2, s * 0.1, s * 0.05, 0, 0, TAU); c.fill(); }
  /* the bobtail */
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-s * 0.34, s * 0.02, s * 0.08, 0, TAU); c.fill();
  /* its shell: a dome, plates on it, a rim */
  c.fillStyle = '#4f9a6e'; c.beginPath(); c.ellipse(0, 0, s * 0.33, s * 0.26, 0, Math.PI, 0); c.lineTo(s * 0.33, s * 0.08); c.quadraticCurveTo(0, s * 0.14, -s * 0.33, s * 0.08); c.fill();
  c.fillStyle = '#7cc58f'; for (const [px, py] of [[-0.14, -0.1], [0.06, -0.14], [0.2, -0.04], [-0.02, -0.02]]){ c.beginPath(); c.ellipse(px * s, py * s, s * 0.07, s * 0.05, 0, 0, TAU); c.fill(); }
  c.strokeStyle = '#d9c79a'; c.lineWidth = Math.max(1, s * 0.035); c.beginPath(); c.moveTo(-s * 0.34, s * 0.07); c.quadraticCurveTo(0, s * 0.15, s * 0.34, s * 0.07); c.stroke();
  /* its head, a bunny's: round, two long ears */
  const hx = s * 0.36, hy = -s * 0.04;
  c.fillStyle = '#f2e6d6';
  for (const [ex, a] of [[-0.02, -0.25], [0.06, 0.05]]){ c.save(); c.translate(hx + ex * s, hy - s * 0.1); c.rotate(a + Math.sin(t * 3) * 0.06); c.beginPath(); c.ellipse(0, -s * 0.16, s * 0.05, s * 0.17, 0, 0, TAU); c.fill(); c.fillStyle = '#ffb3c6'; c.beginPath(); c.ellipse(0, -s * 0.16, s * 0.022, s * 0.12, 0, 0, TAU); c.fill(); c.fillStyle = '#f2e6d6'; c.restore(); }
  c.beginPath(); c.arc(hx, hy, s * 0.13, 0, TAU); c.fill();
  c.fillStyle = '#2b2440'; c.beginPath(); c.arc(hx + s * 0.05, hy - s * 0.02, s * 0.025, 0, TAU); c.fill();
  c.fillStyle = '#ff9fb4'; c.beginPath(); c.arc(hx + s * 0.12, hy + s * 0.02, s * 0.02, 0, TAU); c.fill();
  c.restore();
}
/* A few hopshells out on the meadow (round lane, rel): hopping about,
   each its own little way, drifting back and forth. */
export function hopshells(c, W, H, lane, rel, t, one = false){
  /* (one: just the one, at (lane, rel), facing right, hopping slowly along - the opening moves it) */
  if (one){ const ph = t * 0.8, f = ph - Math.floor(ph), p = P(lane, rel, W, H); hopshell(c, p.x, p.y, H * 0.2 * p.k, f < 0.5 ? f / 0.5 : 0, 1, t); return; }
  for (let i = 0; i < 6; i++){
    const ph = t * (0.9 + 0.25 * hash(i + 80)) + hash(i + 81) * 5, n = Math.floor(ph), f = ph - n;
    const wander = Math.sin(t * 0.12 + i * 2) * 0.6, dir = Math.cos(t * 0.12 + i * 2) > 0 ? 1 : -1;
    const p = P(lane + (hash(i + 82) - 0.5) * 3 + wander, rel + (hash(i + 83) - 0.5) * 0.08, W, H);
    hopshell(c, p.x, p.y, H * 0.2 * p.k, f < 0.45 ? f / 0.45 : 0, dir, t + i);
  }
}

/* Chimeblooms at (lane, rel): a clump of tall alien flowers, each stem
   arching over with a glowing bell at its tip, swaying in the breeze -
   and as they sway they ring, soft notes (lkp-intro.js: sfx.chime), a
   little shimmer of light off each bell as it rings. */
export function chimeblooms(c, W, H, lane, rel, t){
  const p = P(lane, rel, W, H), s = H * 0.9 * p.k, x = p.x, y = p.y;
  const BELLS = ['#ffd0f0', '#cfe0ff', '#e6d0ff', '#fff0c8', '#c8fff0'];
  c.save();
  /* leaves at the foot */
  c.fillStyle = '#4f9a7e';
  for (let k = 0; k < 7; k++){ const a = -Math.PI / 2 + (k - 3) * 0.32; c.beginPath(); c.ellipse(x + Math.cos(a) * s * 0.06, y - s * 0.03, s * 0.025, s * 0.09, a + Math.PI / 2, 0, TAU); c.fill(); }
  for (let k = 0; k < 7; k++){
    const off = (k - 3) / 3, h = s * (0.42 + 0.22 * hash(k + 90)), sway = Math.sin(t * (0.9 + 0.2 * hash(k + 91)) + k * 1.3) * s * 0.04;
    const bx = x + off * s * 0.16 + sway + off * s * 0.08, by = y - h;
    /* the stem, arching over */
    c.strokeStyle = '#5fae8c'; c.lineWidth = Math.max(1, s * 0.012); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + off * s * 0.05, y); c.quadraticCurveTo(x + off * s * 0.12, y - h * 0.7, bx, by); c.stroke();
    /* the bell, hanging, glowing - brighter as it rings */
    const ring = Math.max(0, Math.sin(t * 1.7 + k * 2.1)), col = BELLS[k % BELLS.length];
    glow(c, bx, by + s * 0.04, s * (0.09 + 0.05 * ring), col, 0.35 + 0.35 * ring);
    c.fillStyle = col;
    c.beginPath(); c.moveTo(bx - s * 0.035, by + s * 0.005); c.quadraticCurveTo(bx - s * 0.04, by + s * 0.07, bx - s * 0.055, by + s * 0.085);
    c.lineTo(bx + s * 0.055, by + s * 0.085); c.quadraticCurveTo(bx + s * 0.04, by + s * 0.07, bx + s * 0.035, by + s * 0.005); c.quadraticCurveTo(bx, by - s * 0.02, bx - s * 0.035, by + s * 0.005); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(bx - s * 0.015, by + s * 0.03, s * 0.008, s * 0.025, 0, 0, TAU); c.fill();
    /* (ringing: a little shimmer of light falling from it) */
    if (ring > 0.85){ c.fillStyle = 'rgba(255,255,255,.8)'; for (let j = 0; j < 3; j++){ const u = (t * 2 + j / 3) % 1; c.globalAlpha = 1 - u; c.beginPath(); c.arc(bx + (j - 1) * s * 0.02, by + s * (0.1 + u * 0.12), s * 0.006, 0, TAU); c.fill(); } c.globalAlpha = 1; }
  }
  c.restore();
}

/* A jellycrawl: a see-through dome of a jelly on wobbly tentacle legs, a
   glowing core inside, big eyes - walking along the ground. Feet at (x,
   y), s tall; t the time; walk 0..1 (how hard it's going); fly 0..1 -
   lifting off (its legs trailing, rising, gone). */
export function jellycrawl(c, x, y, s, t, walk = 1, fly = 0){
  const u = s / 260, lift = fly * fly * s * 2.2, bob = Math.abs(Math.sin(t * 5)) * 6 * u * walk * (1 - fly);
  const by = y - lift - bob;
  c.save();
  /* its shadow, left on the ground as it rises */
  c.globalAlpha = 1 - fly; c.fillStyle = 'rgba(20,15,45,.3)'; c.beginPath(); c.ellipse(x, y, 80 * u * (1 - fly * 0.5), 14 * u, 0, 0, TAU); c.fill();
  c.globalAlpha = Math.max(0, 1 - Math.max(0, fly - 0.7) / 0.3);
  /* the legs: walking - each stepping in turn; flying - trailing down */
  c.strokeStyle = 'rgba(255,140,200,.92)'; c.lineWidth = Math.max(1.5, 8 * u); c.lineCap = 'round';
  for (let k = 0; k < 6; k++){
    const ox = (k / 5 - 0.5) * 120 * u, step = Math.sin(t * 6 * walk + k * 1.9) * walk * (1 - fly);
    const fx = x + ox * 1.15 + step * 14 * u, fy = by + 80 * u - Math.max(0, step) * 16 * u + fly * 40 * u;
    c.beginPath(); c.moveTo(x + ox * 0.7, by - 70 * u);
    c.quadraticCurveTo(x + ox + Math.sin(t * 3 + k) * 14 * u, by - 30 * u + fly * 20 * u, fx - fly * ox * 0.6, fy + (fly > 0 ? 30 * u * fly : 0));
    c.stroke();
  }
  /* the dome, see-through, glowing */
  glow(c, x, by - 110 * u, 110 * u, '#ff9ad2', 0.4);
  c.fillStyle = 'rgba(255,190,225,.72)';
  c.beginPath(); c.moveTo(x - 90 * u, by - 70 * u); c.bezierCurveTo(x - 100 * u, by - 190 * u, x + 100 * u, by - 190 * u, x + 90 * u, by - 70 * u); c.quadraticCurveTo(x, by - 50 * u, x - 90 * u, by - 70 * u); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1, 3 * u); c.stroke();
  /* its core, glowing, pulsing */
  const pulse = 1 + 0.15 * Math.sin(t * 3);
  glow(c, x, by - 110 * u, 42 * u * pulse, '#fff6b8', 1);
  c.fillStyle = '#fff6c0'; c.beginPath(); c.arc(x, by - 110 * u, 14 * u * pulse, 0, TAU); c.fill();
  /* eyes, big, looking where it's going (right) */
  for (const d of [-1, 1]){
    const ex = x + d * 30 * u + 6 * u, ey = by - 140 * u, r = 12 * u;
    const blink = (t % 4) < 0.12 ? 0.2 : 1;
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(ex, ey, r, r * blink, 0, 0, TAU); c.fill();
    if (blink > 0.5){ c.fillStyle = '#231a30'; c.beginPath(); c.arc(ex + r * 0.3, ey + r * 0.1, r * 0.62, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + r * 0.1, ey - r * 0.2, r * 0.22, 0, TAU); c.fill(); }
  }
  /* a shine on the dome */
  c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(x - 40 * u, by - 160 * u, 22 * u, 9 * u, -0.4, 0, TAU); c.fill();
  c.restore();
}

/* Sky jellies, out in the world (lkp-game.js _vista): a drift of them
   floating slowly across the land on their own way, diagonally - far off
   ahead and to the right at first, coming over the path above the crew
   as they run on towards them, then away on the wind, off to the left
   and up into the haze. Never stopping. vt: seconds since they were
   first seen; a: how clear. */
export const DRIFT = { n: 11, for: 15 };
export function driftJellies(c, W, H, t, vt, a = 1){
  const out = [];
  for (let i = 0; i < DRIFT.n; i++){
    /* each its own way: nearest at tmin, rmin away; drifting left all the while */
    const tmin = 5 + 3 * hash(i + 200), rmin = 0.005 + 0.1 * hash(i + 201), q = (1.2 - rmin) / (tmin * tmin);
    const rel = rmin + q * (vt - tmin) * (vt - tmin);
    if (rel > 1.3) continue;
    const lane = 1.6 + 2.4 * hash(i + 202) - (0.42 + 0.12 * hash(i + 203)) * vt + 0.15 * Math.sin(t * 0.4 + i);
    out.push({ i, rel, lane });
  }
  out.sort((x, y) => y.rel - x.rel);
  for (const { i, rel, lane } of out){
    const p = P(lane, rel, W, H), high = 0.62 + 0.3 * hash(i + 204) + 0.05 * Math.sin(t * 0.5 + i * 1.3);
    const haze = Math.max(0, Math.min(1, (1.3 - rel) / 0.5));
    jelly(c, p.x, p.y - H * high * p.k, H * 0.14 * p.k * (0.75 + 0.5 * hash(i + 205)), t + i * 0.7, COLS[i % COLS.length], a * haze);
  }
}

/* A glimmerback: the herd animal of Verdant - nothing like home: a soft
   rounded body, indigo going teal, glowing spots down it and a ridge of
   glowing fronds along its back; two long feelers out in front, a light
   at each tip; six thin legs scuttling. From behind (the way they run,
   up the path), turning off to the right (side 0..1). deep 0..1: how far
   into the herd - the deeper, the darker and simpler, so together they
   run into one mass, only those along its near edge clear. */
export function glimmerback(c, x, y, s, t, side = 0, deep = 0, hop = 0){
  /* (hop: bouncing along happily - bigger, springier bounces) */
  const run = t * (14 - 5 * hop), bob = Math.abs(Math.sin(run)) * s * (0.05 + 0.14 * hop), by = y - s * 0.3 - bob;
  /* (deeper in: softer and paler, into the herd's own haze - one mass) */
  const body = mixHex('#5b4fc0', '#8d86c8', deep * 0.75), belly = mixHex('#3fd0c4', '#9fb0d8', deep * 0.8), top = mixHex('#a99bff', '#b7b0e0', deep * 0.7);
  c.save();
  if (deep < 0.5){ c.fillStyle = 'rgba(20,15,45,.25)'; c.beginPath(); c.ellipse(x, y, s * 0.42, s * 0.08, 0, 0, TAU); c.fill(); }
  /* little stubby feet, pattering (only the near ones' showing) */
  if (deep < 0.55){
    c.fillStyle = mixHex('#3a3088', '#6a62a8', deep);
    for (let k = 0; k < 6; k++){
      const d = k < 3 ? -1 : 1, j = k % 3, ph = Math.sin(run + j * 2.1 + (d < 0 ? 0 : Math.PI));
      c.beginPath(); c.ellipse(x + d * s * (0.1 + 0.1 * j), y - Math.max(0, ph) * s * 0.07 - s * 0.03, s * 0.055, s * 0.04, 0, 0, TAU); c.fill();
    }
  }
  /* the body: a soft round hump, turned a little as it veers off */
  c.translate(x, by); c.rotate(side * 0.35);
  const g = c.createRadialGradient(-s * 0.12, -s * 0.2, s * 0.04, 0, 0, s * 0.44);
  g.addColorStop(0, top); g.addColorStop(0.6, body); g.addColorStop(1, belly);
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, s * 0.38, s * 0.3, 0, 0, TAU); c.fill();
  if (deep < 0.75){
    /* a ridge of glowing fronds along its back, swaying */
    for (let k = 0; k < 4; k++){
      const fx = (k - 1.5) * s * 0.1, sw = Math.sin(t * 5 + k) * s * 0.03;
      c.strokeStyle = mixHex('#7ff3ff', '#b8d8f0', deep); c.lineWidth = s * 0.05; c.lineCap = 'round';
      c.beginPath(); c.moveTo(fx, -s * 0.25); c.quadraticCurveTo(fx + sw, -s * 0.37, fx + sw * 2 - s * 0.02, -s * 0.43); c.stroke();
    }
    /* glowing spots */
    c.fillStyle = `rgba(160,255,235,${0.85 * (1 - deep)})`;
    for (let k = 0; k < 5; k++) circ0(c, (hash(k + 300) - 0.5) * s * 0.5, (hash(k + 301) - 0.3) * s * 0.32, s * 0.03);
    /* two feelers, out in front (up the screen: the way it's going), a light on each tip */
    for (const d of [-1, 1]){
      const wv = Math.sin(t * 4 + d) * s * 0.05, tx = d * s * 0.2 + wv, ty = -s * 0.62;
      c.strokeStyle = body; c.lineWidth = s * 0.035;
      c.beginPath(); c.moveTo(d * s * 0.08, -s * 0.22); c.quadraticCurveTo(d * s * 0.12, -s * 0.45, tx, ty); c.stroke();
      if (deep < 0.4) glow(c, tx, ty, s * 0.1, '#ffe27a', 0.6 * (1 - deep));
      c.fillStyle = '#ffe27a'; circ0(c, tx, ty, s * 0.045);
    }
  }
  c.restore();
}
const circ0 = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); c.fill(); };
function mixHex(a, b, k){
  k = Math.max(0, Math.min(1, k));
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

/* The herd as one mass: so many, so thick, you can't tell one from
   another - row after row of soft round backs, the far ones paler in the
   haze, a glint of a frond or a feeler-light here and there. Its left
   edge at lane edge (and dx, lanes, the whole lot's offset - coming in,
   or scattering, when each streams off at its own speed); from depth
   near to far. a: how much there. Drawn far rows first. */
export function herdMass(c, W, H, t, edge, dx, a = 1, scatter = 0){
  if (a <= 0.01) return;
  c.save(); c.globalAlpha = a;
  for (let r = 18; r >= 0; r--){
    const far = r / 18;
    for (let n = 0; n < 46; n++){
      const id = r * 53 + n, rel = -0.04 + r * 0.036 + (hash(id + 9) - 0.5) * 0.03;
      const lane0 = edge + n * 0.11 + (hash(id) - 0.5) * 0.12 + (r % 2) * 0.055;
      const lane = lane0 + dx * (1 + scatter * (0.6 * hash(id + 7) - 0.2));
      const p = P(lane, rel, W, H);
      if (p.x < -60 || p.x > W + 80) continue;
      const s = H * 0.11 * p.k * (0.95 + 0.55 * hash(id + 1)), bob = Math.abs(Math.sin(t * 14 + id)) * s * 0.05;
      const x = p.x, y = p.y - s * 0.3 - bob;
      c.fillStyle = mixHex('#4d42a8', '#b9b2e2', far * 0.85); circ0(c, x, y, s * 0.38);
      c.fillStyle = mixHex('#8f80f0', '#d6d0f2', far * 0.85); circ0(c, x - s * 0.1, y - s * 0.12, s * 0.2);
      /* (now and then, a frond's glow or a feeler's light) */
      if (hash(id + 3) < 0.18){ c.fillStyle = far < 0.5 ? '#ffe27a' : '#f4ecc8'; circ0(c, x + (hash(id + 4) - 0.5) * s * 0.4, y - s * 0.55, s * 0.05); }
      if (hash(id + 5) < 0.25){ c.fillStyle = `rgba(160,255,235,${0.7 * (1 - far)})`; circ0(c, x + s * 0.05, y - s * 0.02, s * 0.04); }
    }
  }
  c.restore();
}

/* A trumbler: a great alien beast, nothing like an elephant - a huge
   domed shell of big plates, teal-green, on six thick legs, and up front
   a broad warm-coloured head with a great fan of a crest and two curling
   horns. Drawn as the world is: flat tones, lit on top, a rim of sun on
   the left, its shadow under it. At (x, y) its feet, s tall, facing right
   (and up the screen, charging away: turn 0..1). run: galloping, 0..1.
   call 0..1: bellowing - the crest flared and glowing, the mouth open,
   rings of sound. haze: how far into the haze. */
export function trumbler(c, x, y, s, t, call = 0, run = 1, haze = 0, L = null){
  const u = s / 300, ph = t * 9, bob = Math.abs(Math.sin(ph)) * 10 * u * run, cl = Math.sin(Math.min(1, call) * Math.PI);
  const H_ = (a) => L ? mixHex(a, L.haze, haze) : a;
  const shellD = H_('#2f6b62'), shellL = H_('#4f9a7e'), plate = H_('#79c49a'), skin = H_('#d9734a'), skinL = H_('#f0a060'), dark = H_('#7a3a2a'), crest = H_('#ffb04a');
  c.save();
  c.fillStyle = 'rgba(20,15,45,.35)'; c.beginPath(); c.ellipse(x - 20 * u, y, 190 * u, 30 * u, 0, 0, TAU); c.fill();
  c.translate(x, y - bob);
  /* six legs, galloping: far ones darker */
  for (const [lx, far, k] of [[-120, 1, 0], [-20, 1, 2], [80, 1, 4], [-100, 0, 1], [0, 0, 3], [100, 0, 5]]){
    const sw = Math.sin(ph + k * 1.05) * run, lift = Math.max(0, sw) * 26 * u;
    c.fillStyle = far ? dark : skin;
    c.beginPath(); c.roundRect((lx - 20 + sw * 16) * u, (-120) * u, 40 * u, (120 - lift / u) * u, 14 * u); c.fill();
    c.fillStyle = far ? H_('#4a2418') : dark; c.beginPath(); c.ellipse((lx + sw * 16) * u, -lift - 4 * u, 24 * u, 10 * u, 0, 0, TAU); c.fill();
  }
  /* the shell: a great dome, dark under, lit on top, big plates over it */
  c.fillStyle = shellD; c.beginPath(); c.ellipse(-10 * u, -190 * u, 175 * u, 110 * u, 0, 0, TAU); c.fill();
  c.fillStyle = shellL; c.beginPath(); c.ellipse(-25 * u, -215 * u, 150 * u, 82 * u, 0, Math.PI, TAU); c.fill();
  c.fillStyle = plate;
  for (const [px, py, r] of [[-110, -230, 34], [-50, -270, 38], [20, -262, 36], [80, -225, 30], [-75, -185, 30], [0, -205, 32], [-140, -180, 24]]){
    c.beginPath(); for (let k = 0; k < 6; k++){ const a = k / 6 * TAU + 0.5; c.lineTo((px + Math.cos(a) * r) * u, (py + Math.sin(a) * r * 0.7) * u); } c.closePath(); c.fill();
  }
  if (L){ c.strokeStyle = rgbaHex(L.rim, 0.6 * (1 - haze)); c.lineWidth = 5 * u; c.beginPath(); c.ellipse(-10 * u, -190 * u, 175 * u, 110 * u, 0, Math.PI * 1.02, Math.PI * 1.5); c.stroke(); }
  /* the head, up front: broad, warm, lowered as it charges */
  const hx = 175 * u, hy = -150 * u;
  /* the crest: a great fan behind the head - flaring and glowing as it bellows */
  c.save(); c.translate(hx - 30 * u, hy - 30 * u); c.rotate(-0.5 - 0.35 * cl);
  if (cl > 0.05) glow(c, 0, -40 * u, 150 * u, '#ffd27a', 0.5 * cl);
  for (let k = 0; k < 7; k++){
    const a = -Math.PI * 0.85 + k * 0.28, r = (95 + 25 * cl) * u;
    c.fillStyle = k % 2 ? crest : H_('#ff8a3a');
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - 0.13) * r, Math.sin(a - 0.13) * r); c.lineTo(Math.cos(a + 0.13) * r, Math.sin(a + 0.13) * r); c.closePath(); c.fill();
  }
  c.restore();
  c.fillStyle = skin; c.beginPath(); c.ellipse(hx, hy, 72 * u, 58 * u, 0.2, 0, TAU); c.fill();
  c.fillStyle = skinL; c.beginPath(); c.ellipse(hx - 12 * u, hy - 18 * u, 50 * u, 32 * u, 0.2, 0, TAU); c.fill();
  /* two horns, curling forward */
  c.strokeStyle = H_('#fff1d6'); c.lineWidth = 14 * u; c.lineCap = 'round';
  for (const d of [-1, 1]){ c.beginPath(); c.moveTo(hx + 20 * u, hy - 30 * u + d * 8 * u); c.quadraticCurveTo(hx + 80 * u, hy - 60 * u + d * 12 * u, hx + 95 * u, hy - 20 * u + d * 10 * u); c.stroke(); }
  /* the mouth: a line - wide open when it bellows */
  c.fillStyle = H_('#5a2418');
  c.beginPath(); c.ellipse(hx + 48 * u, hy + 22 * u, 22 * u, (4 + 18 * cl) * u, 0.15, 0, TAU); c.fill();
  /* its eye: small and fierce-ish - kind, really */
  c.fillStyle = '#1a1020'; circ0(c, hx + 22 * u, hy - 8 * u, 7 * u); c.fillStyle = '#ffffff'; circ0(c, hx + 20 * u, hy - 10 * u, 2.5 * u);
  /* rings of sound */
  if (call > 0 && call < 1.6) for (let k = 0; k < 4; k++){
    const r = call * 1.3 - k * 0.2; if (r <= 0) continue;
    c.strokeStyle = `rgba(255,240,220,${Math.max(0, 0.75 - r * 0.45)})`; c.lineWidth = 8 * u;
    c.beginPath(); c.arc(hx + 70 * u, hy + 20 * u, r * 320 * u, -1.1, 1.1); c.stroke();
  }
  c.restore();
}

/* A sky jelly out in the world (lkp-game.js: a thing, kind 'skyjelly',
   drifting its own way): drawn the way the world is - flat colours, dark
   under and lit on top, a rim of the low sun on its left, see-through,
   fading into the haze with distance like the trees. th: lane, rel, alt
   (how high: of the screen, at its depth), size, n. L: the palette. */
export function skyJelly(c, W, H, th, t, L){
  if (!L || th.rel > 1.2) return;
  const p = P(th.lane, th.rel, W, H), s = H * 0.1 * p.k * (th.size || 1);
  const haze = Math.min(0.75, Math.max(0, th.rel) * 0.85), a = Math.max(0, Math.min(1, (1.2 - th.rel) / 0.35));
  if (a <= 0.01) return;
  const bob = Math.sin(t * 0.5 + th.n * 1.7) * s * 0.12, x = p.x, y = p.y - H * th.alt * p.k + bob;
  const base = ['#d7a6d8', '#a9c4e8', '#c4b4ea'][th.n % 3], col = (k, m = 0) => mixHex(mixHex(base, k > 0 ? '#ffffff' : '#3a3466', Math.abs(k)), L.haze, Math.min(1, haze + m));
  const pulse = Math.sin(t * 1.1 + th.n), w = s * (1 + 0.05 * pulse), h = s * (0.6 - 0.04 * pulse);
  c.save(); c.globalAlpha = a * 0.85;
  /* ribbons: thin, trailing, swaying slowly */
  c.lineCap = 'round';
  for (let k = 0; k < 4; k++){
    const ox = (k / 3 - 0.5) * w * 0.7, len = s * (1.0 + 0.35 * (k % 2));
    c.strokeStyle = col(-0.15, 0.1); c.lineWidth = Math.max(1, s * 0.045);
    c.beginPath(); c.moveTo(x + ox, y + h * 0.1);
    for (let j = 1; j <= 6; j++){ const v = j / 6; c.lineTo(x + ox + Math.sin(t * 1.2 + k + v * 3) * s * 0.08 * v, y + h * 0.1 + v * len); }
    c.stroke();
  }
  /* the bell: shaded underneath, lit on top - two flat tones */
  c.fillStyle = col(-0.25);
  c.beginPath(); c.moveTo(x - w * 0.5, y + h * 0.12); c.bezierCurveTo(x - w * 0.55, y - h * 1.1, x + w * 0.55, y - h * 1.1, x + w * 0.5, y + h * 0.12); c.quadraticCurveTo(x, y + h * 0.32, x - w * 0.5, y + h * 0.12); c.fill();
  c.fillStyle = col(0.18);
  c.beginPath(); c.moveTo(x - w * 0.46, y - h * 0.05); c.bezierCurveTo(x - w * 0.5, y - h * 1.05, x + w * 0.25, y - h * 1.08, x + w * 0.3, y - h * 0.55); c.quadraticCurveTo(x - w * 0.1, y - h * 0.3, x - w * 0.46, y - h * 0.05); c.fill();
  /* the sun's rim, on its left */
  c.strokeStyle = rgbaHex(L.rim, 0.55 * (1 - haze)); c.lineWidth = Math.max(1, s * 0.03);
  c.beginPath(); c.ellipse(x, y - h * 0.35, w * 0.5, h * 0.78, 0, Math.PI * 0.95, Math.PI * 1.45); c.stroke();
  c.restore();
}
const rgbaHex = (h, a) => `rgba(${[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',')},${a})`;
