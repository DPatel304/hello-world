/* Last Known Position - the crash site, where Level 1 begins (the opening,
   lkp-intro.js). Two ways of seeing it:

     from above   the title: high over the forest, looking down at a
                  clearing - a long furrow ploughed through it, the ship at
                  the end of it, toppled but in one piece, smoke drifting
                  off, mist over the trees, a spring glowing, and the crew,
                  tiny, lying in the grass
     on the ground the clearing at their level: grass and flowers, trees all
                  round, the ship off to one side with a piece of it
                  thrown clear, and the healing pond close by

   L is the level's world palette. */
import { P } from './lkp-art.js';
import { drawWorld, glow, tree, mix, rgba } from './lkp-world.js';
import { worldShip, worldWreck } from './lkp-places.js';
import { PLAYER_COLORS } from '../tracking/pose.js';

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, 6.2832); c.fill(); };

/* ---------- from above ---------- */

/* Where things are, from above (screens). */
export const ABOVE = {
  clearing: [0.5, 0.56, 0.36, 0.34],
  furrow: [[0.27, 0.7], [0.52, 0.5]],
  ship: { x: 0.6, y: 0.4, a: -0.62, len: 0.36 },
  pond: [0.3, 0.8],
  crew: [0.47, 0.82]
};

let CACHE = { key: '', cv: null };
const canvasOf = (w, h) => {
  try {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document !== 'undefined' && document.createElement){ const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  } catch (e){}
  return null;
};

/* The still parts - forest, clearing, furrow, logs, the pond's banks -
   drawn once and kept. */
function stillAbove(W, H, L){
  const key = `${W}x${H}:${L.key}`;
  if (CACHE.key === key) return CACHE.cv;
  const cv = canvasOf(W, H); CACHE = { key, cv };
  if (!cv || typeof cv.getContext !== 'function') return (CACHE.cv = null);
  const c = cv.getContext('2d');
  if (!c || !c.fillRect) return null;
  /* the forest floor, all over */
  c.fillStyle = '#2f5b46'; c.fillRect(0, 0, W, H);
  /* the clearing: grass, sunlit */
  const [cx, cy, rx, ry] = ABOVE.clearing;
  const cg = c.createRadialGradient(cx * W - W * 0.1, cy * H - H * 0.12, H * 0.05, cx * W, cy * H, W * rx);
  cg.addColorStop(0, '#8fcf86'); cg.addColorStop(0.7, '#5fae73'); cg.addColorStop(1, 'rgba(70,140,95,0)');
  c.fillStyle = cg; c.beginPath(); c.ellipse(cx * W, cy * H, W * rx, H * ry, -0.15, 0, 6.2832); c.fill();
  /* grass texture */
  for (let n = 0; n < 1600; n++){
    const x = hash(n) * W, y = hash(n + 9000) * H, d = Math.hypot((x / W - cx) / rx, (y / H - cy) / ry);
    if (d > 1.05) continue;
    c.strokeStyle = hash(n + 5) < 0.5 ? 'rgba(160,220,140,.45)' : 'rgba(40,110,70,.35)';
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (hash(n + 3) - 0.5) * 6, y - 4 - hash(n + 4) * 6); c.stroke();
  }
  /* the furrow the ship ploughed: churned earth, darker inside */
  const [[fx0, fy0], [fx1, fy1]] = ABOVE.furrow, fa = Math.atan2((fy1 - fy0) * H, (fx1 - fx0) * W), fl = Math.hypot((fx1 - fx0) * W, (fy1 - fy0) * H);
  c.save(); c.translate(fx0 * W, fy0 * H); c.rotate(fa);
  c.fillStyle = '#8a6a48'; c.beginPath(); c.ellipse(fl / 2, 0, fl / 2 + H * 0.04, H * 0.055, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#5e4632'; c.beginPath(); c.ellipse(fl / 2 + H * 0.02, 0, fl / 2, H * 0.03, 0, 0, 6.2832); c.fill();
  for (let n = 0; n < 60; n++){ c.fillStyle = hash(n + 70) < 0.5 ? '#a7835b' : '#4b382a'; circ(c, hash(n + 71) * fl, (hash(n + 72) - 0.5) * H * 0.12, 2 + hash(n + 73) * 5); }
  c.restore();
  /* broken trees and logs about the furrow */
  for (let n = 0; n < 14; n++){
    const k = hash(n + 400), x = (fx0 + (fx1 - fx0) * k) * W + (hash(n + 401) - 0.5) * W * 0.16, y = (fy0 + (fy1 - fy0) * k) * H + (hash(n + 402) - 0.5) * H * 0.18;
    c.save(); c.translate(x, y); c.rotate(hash(n + 403) * 3);
    c.fillStyle = 'rgba(20,30,20,.35)'; c.fillRect(-26, -2, 56, 8);
    c.fillStyle = '#7a5a3c'; c.fillRect(-28, -5, 56, 7); c.fillStyle = '#a07a52'; c.fillRect(-28, -5, 56, 2);
    c.restore();
  }
  /* the pond's banks */
  const [px, py] = ABOVE.pond;
  c.fillStyle = '#6d6894'; c.beginPath(); c.ellipse(px * W, py * H, H * 0.075, H * 0.045, 0.2, 0, 6.2832); c.fill();
  /* trees: thick all round the clearing, thinning into it at the edge */
  const trees = [];
  for (let n = 0; n < 420; n++){
    const x = hash(n + 100) * 1.1 - 0.05, y = hash(n + 200) * 1.1 - 0.05;
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
    if (d < 0.92 + hash(n + 300) * 0.25) continue;
    trees.push({ x: x * W, y: y * H, r: H * (0.03 + hash(n + 301) * 0.03), kind: hash(n + 302) < 0.55 ? 'pine' : 'round', n });
  }
  trees.sort((a, b) => a.y - b.y);
  for (const tr of trees){
    c.fillStyle = 'rgba(10,25,20,.45)'; c.beginPath(); c.ellipse(tr.x + tr.r * 0.5, tr.y + tr.r * 0.45, tr.r * 1.05, tr.r * 0.8, 0, 0, 6.2832); c.fill();
    if (tr.kind === 'round'){
      for (const [dx, dy, s, col] of [[0, 0, 1, '#2f6b4a'], [-0.25, -0.2, 0.7, '#3f8a5c'], [-0.4, -0.35, 0.38, '#6fb57a']]){ c.fillStyle = col; circ(c, tr.x + dx * tr.r, tr.y + dy * tr.r, tr.r * s); }
    } else {
      /* a pine seen from above: layered stars, lit on the top left */
      for (const [s, col] of [[1, '#1f5a52'], [0.72, '#2c7468'], [0.42, '#4e9e8a']]){
        c.fillStyle = col; c.beginPath();
        for (let k = 0; k < 16; k++){ const a = k / 16 * 6.2832 + tr.n, rr = tr.r * s * (k % 2 ? 0.55 : 1); c.lineTo(tr.x - (1 - s) * tr.r * 0.3 + Math.cos(a) * rr, tr.y - (1 - s) * tr.r * 0.3 + Math.sin(a) * rr); }
        c.closePath(); c.fill();
      }
    }
  }
  return cv;
}

/* The ship from above: the long hull lying along a, its nose buried at
   the end of the furrow - fins sticking out, the stripe, the cockpit. */
function shipAbove(c, W, H, t){
  const S = ABOVE.ship, len = S.len * W, wid = len * 0.16;
  c.save(); c.translate(S.x * W, S.y * H); c.rotate(S.a);
  c.fillStyle = 'rgba(10,20,15,.45)'; c.beginPath(); c.ellipse(wid * 0.4, wid * 0.7, len * 0.55, wid * 0.75, 0, 0, 6.2832); c.fill();
  /* fins */
  c.fillStyle = '#7a8198';
  c.beginPath(); c.moveTo(len * 0.25, -wid * 0.4); c.lineTo(len * 0.42, -wid * 1.35); c.lineTo(len * 0.5, -wid * 1.2); c.lineTo(len * 0.44, -wid * 0.4); c.fill();
  c.beginPath(); c.moveTo(len * 0.25, wid * 0.4); c.lineTo(len * 0.38, wid * 1.1); c.lineTo(len * 0.47, wid * 1.0); c.lineTo(len * 0.44, wid * 0.4); c.fill();
  /* hull */
  const g = c.createLinearGradient(0, -wid / 2, 0, wid / 2); g.addColorStop(0, '#f2f4f8'); g.addColorStop(0.5, '#b4bacb'); g.addColorStop(1, '#5a6078');
  c.fillStyle = g; c.beginPath(); c.moveTo(-len * 0.5, 0); c.quadraticCurveTo(-len * 0.45, -wid / 2, -len * 0.32, -wid / 2); c.lineTo(len * 0.48, -wid / 2); c.quadraticCurveTo(len * 0.52, 0, len * 0.48, wid / 2); c.lineTo(-len * 0.32, wid / 2); c.quadraticCurveTo(-len * 0.45, wid / 2, -len * 0.5, 0); c.fill();
  c.strokeStyle = 'rgba(30,30,50,.35)'; c.lineWidth = 2; c.beginPath();
  for (const k of [-0.2, 0, 0.2, 0.36]){ c.moveTo(len * k, -wid / 2); c.lineTo(len * k, wid / 2); }
  c.stroke();
  c.fillStyle = '#e8b830'; c.fillRect(-len * 0.32, wid * 0.08, len * 0.8, wid * 0.12);
  c.fillStyle = '#3fa6ff'; c.fillRect(-len * 0.32, wid * 0.22, len * 0.8, wid * 0.05);
  /* cockpit, cracked */
  c.fillStyle = '#1b2440'; c.beginPath(); c.ellipse(-len * 0.4, -wid * 0.05, len * 0.06, wid * 0.32, 0, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(230,245,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-len * 0.42, -wid * 0.2); c.lineTo(-len * 0.4, 0); c.lineTo(-len * 0.37, wid * 0.1); c.stroke();
  /* scorch and dents */
  c.fillStyle = 'rgba(30,25,40,.4)';
  for (const [x, y, r] of [[0.05, -0.15, 0.06], [-0.15, 0.2, 0.04], [0.3, 0.05, 0.05]]){ c.beginPath(); c.ellipse(len * x, wid * y, len * r, len * r * 0.5, 0.3, 0, 6.2832); c.fill(); }
  /* engines glowing */
  for (const y of [-0.22, 0.22]){ glow(c, len * 0.5, wid * y, wid * 0.7, '#ff9a3d', 0.4 + 0.3 * Math.abs(Math.sin(t * 9 + y * 10))); c.fillStyle = '#2c3042'; circ(c, len * 0.49, wid * y, wid * 0.16); }
  /* a piece of it thrown clear, just beside */
  c.save(); c.translate(len * 0.15, wid * 1.6); c.rotate(0.6);
  c.fillStyle = '#9aa1b8'; c.beginPath(); c.moveTo(-wid * 0.6, 0); c.lineTo(-wid * 0.3, -wid * 0.45); c.lineTo(wid * 0.5, -wid * 0.35); c.lineTo(wid * 0.6, wid * 0.1); c.closePath(); c.fill();
  c.fillStyle = '#e8b830'; c.fillRect(-wid * 0.3, -wid * 0.2, wid * 0.7, wid * 0.08);
  c.restore();
  c.restore();
}

/* The whole view from above, at time t; crew: how they lie (an array of
   down-ness for each, or null for nobody yet). */
export function drawAbove(c, W, H, t, L, crew = [1, 1, 1, 1]){
  const still = stillAbove(W, H, L);
  if (still) c.drawImage(still, 0, 0, W, H);
  else { c.fillStyle = '#2f5b46'; c.fillRect(0, 0, W, H); }
  /* the pond, shimmering */
  const [px, py] = ABOVE.pond;
  const pg = c.createRadialGradient(px * W - H * 0.02, py * H - H * 0.01, 2, px * W, py * H, H * 0.07);
  pg.addColorStop(0, '#d9ffff'); pg.addColorStop(0.5, L.water || '#5fe0f0'); pg.addColorStop(1, '#1b7f9e');
  c.fillStyle = pg; c.beginPath(); c.ellipse(px * W, py * H, H * 0.064, H * 0.036, 0.2, 0, 6.2832); c.fill();
  glow(c, px * W, py * H, H * 0.1, L.water || '#5fe0f0', 0.45 + 0.1 * Math.sin(t * 2));
  shipAbove(c, W, H, t);
  /* the crew, tiny, lying in the grass */
  const [cx, cy] = ABOVE.crew;
  crew.forEach((d, i) => {
    const x = cx * W + (i - 1.5) * H * 0.028 + (hash(i + 900) - 0.5) * H * 0.02, y = cy * H + (hash(i + 901) - 0.5) * H * 0.02;
    c.save(); c.translate(x, y); c.rotate(d * 1.3 * (i % 2 ? 1 : -1));
    c.fillStyle = 'rgba(10,25,20,.4)'; c.beginPath(); c.ellipse(3, 4, H * 0.01, H * 0.006, 0, 0, 6.2832); c.fill();
    c.fillStyle = PLAYER_COLORS[i]; c.beginPath(); c.roundRect(-H * 0.006, -H * 0.004, H * 0.012, H * 0.016, H * 0.004); c.fill();
    c.fillStyle = '#eef4fb'; circ(c, 0, -H * 0.007, H * 0.006);
    c.restore();
  });
  /* smoke off the engines, blown across the trees */
  const S = ABOVE.ship, ex = S.x * W + Math.cos(S.a) * S.len * W * 0.5, ey = S.y * H + Math.sin(S.a) * S.len * W * 0.5;
  for (let k = 0; k < 14; k++){
    const a = (t * 0.08 + k / 14) % 1;
    glow(c, ex - a * W * 0.25 + Math.sin(a * 7 + k) * H * 0.03, ey - a * H * 0.3, H * (0.04 + a * 0.12), '#7a7a8c', 0.85 * (1 - a));
  }
  /* mist drifting over the forest */
  for (let k = 0; k < 16; k++){
    const x = ((hash(k + 700) + t * 0.006 * (1 + hash(k + 701))) % 1.3 - 0.15) * W, y = hash(k + 702) * H;
    const d = Math.hypot((x / W - ABOVE.clearing[0]) / ABOVE.clearing[2], (y / H - ABOVE.clearing[1]) / ABOVE.clearing[3]);
    glow(c, x, y, H * (0.12 + hash(k + 703) * 0.12), '#eef3f7', d > 0.9 ? 0.7 : 0.3);
  }
}

/* ---------- on the ground ---------- */

/* Where things are, on the ground [lane, depth (rel), size]. The ship
   down behind the crew; a piece of it thrown clear beside it; the pond off
   to the east - the right - out of the first shots, found by a whip pan. */
export const GROUND = {
  ship: [-0.6, 0.45, 1.25],
  wreck: [1.4, 0.4, 1.1],
  pond: [2.7, 0.12, 0.6]
};

/* The land at their level - sky, grass and flowers all over, no path -
   and the things in it, far to near: trees all round, the ship, the
   wreck. extra: more things to stand in it ({ rel, draw }). */
export function drawGround(c, W, H, t, L, extra = []){
  /* the land runs on past the screen's edges, for the camera to swing across */
  c.fillStyle = L.ground[1]; c.fillRect(-W, P(0, 1, W, H).y, W * 3, H * 2);
  c.fillStyle = L.sky[1]; c.fillRect(-W, -H, W * 3, P(0, 1, W, H).y + H);
  drawWorld(c, W, H, 0, t, 0, L, true);
  /* (drawWorld's own ground stops at the screen's edges: carry it on) */
  const HY = P(0, 1, W, H).y, gg = c.createLinearGradient(0, HY, 0, H);
  gg.addColorStop(0, mix(L.ground[0], L.haze, 0.45)); gg.addColorStop(0.3, L.ground[1]); gg.addColorStop(1, L.ground[2]);
  c.fillStyle = gg; c.fillRect(W, HY + H * 0.005, W, H * 1.5); c.fillRect(-W, HY + H * 0.005, W, H * 1.5);
  /* grass and flowers everywhere, not just at the sides */
  for (let n = 0; n < 340; n++){
    const rel = -0.05 + Math.pow(hash(n + 1200), 1.4) * 0.9, lane = (hash(n + 1201) * 2 - 1) * 4.5, p = P(lane, rel, W, H);
    if (p.x < -W * 0.5 || p.x > W * 1.8) continue;
    const h = H * (0.014 + hash(n + 1202) * 0.024) * p.k;
    c.strokeStyle = rgba(L.grass[n % 2], 0.6 + 0.35 * Math.min(1, p.k)); c.lineWidth = Math.max(1, H * 0.003 * p.k);
    c.beginPath();
    for (const dx of [-1, 0, 1]){ c.moveTo(p.x + dx * h * 0.2, p.y); c.quadraticCurveTo(p.x + dx * h * 0.25, p.y - h * 0.6, p.x + dx * h * 0.45 - h * 0.15, p.y - h); }
    c.stroke();
    if (hash(n + 1203) < 0.18){ c.fillStyle = L.flowers[n % L.flowers.length]; circ(c, p.x, p.y - h, h * 0.18); }
  }
  /* the pond: part of the floor, under everything */
  const [pl, pr, ps] = GROUND.pond;
  worldPond(c, W, H, pl, pr, t, L, ps);
  const items = [...extra];
  const [sl, sr, ss] = GROUND.ship, [wl, wr, ws] = GROUND.wreck;
  items.push({ rel: sr, draw: () => worldShip(c, W, H, sr, sl, t, ss) });
  items.push({ rel: wr, draw: () => worldWreck(c, W, H, wr, wl, t, ws, 1) });
  /* trees: a wall of forest beyond, and thick down both sides */
  for (let n = 0; n < 46; n++){
    const rel = 0.58 + hash(n + 1300) * 0.45, lane = (hash(n + 1301) * 2 - 1) * 7;
    items.push({ rel, draw: () => tree(c, W, H, lane, rel, L, n) });
  }
  for (let n = 0; n < 30; n++){
    const side = n % 2 ? 1 : -1, rel = 0.02 + hash(n + 1400) * 0.55, lane = side * (2.5 + hash(n + 1401) * 3.5);
    /* (none in the pond, or where the crew walk over to it) */
    if (side > 0 && rel < 0.3 && lane < 4.2) continue;
    items.push({ rel, draw: () => tree(c, W, H, lane, rel, L, n + 50) });
  }
  items.sort((a, b) => b.rel - a.rel).forEach(it => it.draw());
}

/* The healing pond: a round pool of glowing water in a ring of stones, at
   lane, rel; r its radius in lanes. */
export function worldPond(c, W, H, lane, rel, t, L, r = 0.6){
  const n = 28, edge = (k, out) => { const a = k / n * 6.2832; return P(lane + Math.cos(a) * (r + out), rel + Math.sin(a) * r * 0.22, W, H); };
  const shape = (out) => { c.beginPath(); for (let k = 0; k <= n; k++){ const q = edge(k, out); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } c.closePath(); };
  const ctr = P(lane, rel, W, H), far = P(lane, rel + r * 0.22, W, H), near = P(lane, rel - r * 0.22, W, H);
  c.fillStyle = L.rock[1]; shape(0.12); c.fill();
  const g = c.createLinearGradient(0, far.y, 0, near.y); g.addColorStop(0, mix(L.water, '#ffffff', 0.35)); g.addColorStop(0.5, L.water); g.addColorStop(1, '#1b7f9e');
  c.fillStyle = g; shape(0); c.fill();
  /* ripples, light */
  c.strokeStyle = 'rgba(255,255,255,.5)';
  for (let k = 0; k < 3; k++){
    const u = (t * 0.35 + k / 3) % 1, w = (P(lane + r * u * 0.9, rel, W, H).x - ctr.x);
    c.lineWidth = Math.max(1, 2 * ctr.k); c.beginPath(); c.ellipse(ctr.x, ctr.y, Math.abs(w), Math.abs(w) * 0.16, 0, 0, 6.2832); c.stroke();
  }
  glow(c, ctr.x, ctr.y - H * 0.02 * ctr.k, (near.y - far.y) * 2 + H * 0.06 * ctr.k, L.water, 0.5);
  /* stones round the edge */
  for (let k = 0; k < 16; k++){
    const q = edge(k * 28 / 16, 0.08), rr = H * 0.012 * q.k + 0.5;
    c.fillStyle = L.rock[1]; c.beginPath(); c.ellipse(q.x, q.y - rr * 0.3, rr * 1.2, rr * 0.75, 0, 0, 6.2832); c.fill();
    c.fillStyle = L.rock[0]; c.beginPath(); c.ellipse(q.x - rr * 0.35, q.y - rr * 0.55, rr * 0.6, rr * 0.35, 0, 0, 6.2832); c.fill();
  }
  /* bubbles rising */
  c.fillStyle = 'rgba(210,255,255,.9)';
  for (let k = 0; k < 8; k++){
    const q = P(lane + (hash(k + 1500) - 0.5) * r * 1.4, rel + (hash(k + 1501) - 0.5) * r * 0.3, W, H), u = (t * 0.6 + k / 8) % 1;
    circ(c, q.x, q.y - u * H * 0.1 * q.k, (H * 0.004 * (1 - u * 0.6)) * q.k + 0.5);
  }
}

/* The pond at its most magical - for the moment it's found: light shafts
   coming down through the mist onto it, mist rising off the water, motes
   drifting up (k 0..1, how strongly). */
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
  for (let j = 0; j < 6; j++){ const u = (t * 0.15 + j / 6) % 1; glow(c, ctr.x + (hash(j + 1600) - 0.5) * w * 1.6, ctr.y - u * H * 0.18 * ctr.k, w * (0.5 + u * 0.6), '#e8fbff', 0.35 * k * (1 - u)); }
  c.fillStyle = `rgba(200,255,250,${0.9 * k})`;
  for (let j = 0; j < 16; j++){ const u = (t * 0.3 + hash(j + 1700)) % 1; circ(c, ctr.x + (hash(j + 1701) - 0.5) * w * 1.8 + Math.sin(u * 6 + j) * w * 0.05, ctr.y - u * H * 0.3 * ctr.k, H * 0.003 * (1 - u) + 0.6); }
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
