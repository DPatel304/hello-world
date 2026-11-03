/* Last Known Position's world, drawn properly: a stylized, lit alien
   planet. The greybox (lkp-art.js) still draws anything a level doesn't
   give a `world` look to; a level with one (lkp-levels.js, palette.world)
   is drawn here instead.

   One sun, low on the left, lights everything: lit sides, shaded sides,
   warm rim light, long soft shadows. Far things fade into the haze.

     panorama   sky, sun, clouds, the ringed planet, mountains, the crashed
                ship and its smoke - painted once into a wide strip and
                slid across as the path turns (heading)
     ground     grass, rocks, flowers, glowing mushrooms, the pebbled path
                and its edge stones - all sliding past as the crew walk
     trees      faceted conifers along both sides
     finish     bloom (a blurred, brightened copy laid over), a warm/cool
                grade, a vignette and a little grain - after everything else

   The path bends (lkp-art.js BEND): gentle curves, and now and then a
   sharp turn - all automatic, nothing for the players to do. A turn swings
   the panorama round. */
import { P, HORIZON, RUN, BEND } from './lkp-art.js';

/* Little helpers. */
const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
export const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, 6.2832); c.fill(); };
/* A seeded random, so the world is the same every time. */
function rng(seed){ let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
/* A hash of a whole number: 0..1. */
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* A soft glow, from a sprite painted once per colour: cheap to draw many
   of (shadowBlur isn't). */
const GLOWS = new Map();
export function glow(c, x, y, r, col, a = 1){
  let sp = GLOWS.get(col);
  if (sp === undefined){
    sp = canvasOf(64, 64);
    if (sp){ const g = sp.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, rgba(col, 0.9)); gr.addColorStop(0.35, rgba(col, 0.45)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
    GLOWS.set(col, sp);
  }
  if (!sp) return;
  c.globalAlpha *= a; c.drawImage(sp, x - r, y - r, r * 2, r * 2); c.globalAlpha /= a;
}

/* Where the panorama is looking: 0 at the start; a sharp turn adds a
   quarter of the way round. (In panorama widths.) */
const VIEW = { heading: 0, target: 0, lastT: null };
export function turn(dir){ VIEW.target += dir * 0.28; }
export function resetView(){ VIEW.heading = VIEW.target = 0; VIEW.lastT = null; }

/* ---------- the panorama ---------- */

const PANO = { key: '', cv: null, w: 0, h: 0 };
const canvasOf = (w, h) => {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  if (!cv || !cv.getContext) return null;
  cv.width = Math.ceil(w); cv.height = Math.ceil(h);
  return cv.getContext('2d') ? cv : null;
};

/* Painted once for this size and look: 2.5 screens wide, seamless. */
function panorama(W, H, L){
  const key = `${W}x${H}:${L.key}`;
  if (PANO.key === key) return PANO;
  const PW = Math.round(W * 2.5), HY = HORIZON * H, PH = Math.round(HY + H * 0.08);
  const cv = canvasOf(PW, PH);
  Object.assign(PANO, { key, cv, w: PW, h: PH });
  if (!cv) return PANO;
  const c = cv.getContext('2d');
  /* Sky. */
  const g = c.createLinearGradient(0, 0, 0, HY);
  L.sky.forEach((col, i) => g.addColorStop(i / (L.sky.length - 1), col));
  c.fillStyle = g; c.fillRect(0, 0, PW, PH);
  /* The sun, and its glow. */
  const sx = PW * 0.12, sy = HY * 0.42;
  const sg = c.createRadialGradient(sx, sy, 0, sx, sy, H * 0.75);
  sg.addColorStop(0, rgba(L.sun, 1)); sg.addColorStop(0.07, rgba(L.sun, 0.9)); sg.addColorStop(0.35, rgba(L.sun, 0.28)); sg.addColorStop(1, rgba(L.sun, 0));
  for (const dx of [0, PW]){ c.save(); c.translate(dx, 0); c.fillStyle = sg; c.fillRect(sx - H, 0, H * 2, PH); c.restore(); }
  c.fillStyle = '#fff8e8'; for (const dx of [0, PW]) circ(c, sx + dx, sy, H * 0.03);
  /* The ringed planet, lit from the left. */
  const px = PW * 0.62, py = HY * 0.4, pr = H * 0.1;
  c.save(); c.globalAlpha = L.planetAlpha;
  const pg = c.createRadialGradient(px - pr * 0.5, py - pr * 0.3, pr * 0.1, px, py, pr * 1.05);
  pg.addColorStop(0, '#ffe7d6'); pg.addColorStop(0.6, L.planet[0]); pg.addColorStop(1, L.planet[1]);
  c.fillStyle = pg; circ(c, px, py, pr);
  c.strokeStyle = 'rgba(255,235,220,.55)'; c.lineWidth = H * 0.009; c.beginPath(); c.ellipse(px, py, pr * 1.85, pr * 0.4, -0.25, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
  c.strokeStyle = 'rgba(255,235,220,.25)'; c.lineWidth = H * 0.004; c.beginPath(); c.ellipse(px, py, pr * 2.1, pr * 0.46, -0.25, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
  c.restore();
  /* Clouds: clusters of puffs, lit on top, cool beneath. */
  const r = rng(101);
  for (let n = 0; n < 7; n++){
    const cx = (n + r() * 0.6) / 7 * PW, cy = HY * (0.12 + r() * 0.3), sc = H * (0.0005 + r() * 0.0004);
    const puffs = []; for (let k = 0; k < 9; k++) puffs.push([(r() - 0.5) * 260 * sc, (r() - 0.6) * 60 * sc, (40 + r() * 50) * sc]);
    puffs.sort((a, b) => a[1] - b[1]);
    for (const dx of [0, cx > PW * 0.85 ? -PW : cx < PW * 0.15 ? PW : 0].filter((v, i, a) => a.indexOf(v) === i)){
      c.fillStyle = rgba(L.cloudShade, 0.35); c.beginPath(); c.ellipse(cx + dx, cy + 30 * sc, 170 * sc, 26 * sc, 0, 0, 6.2832); c.fill();
      for (const [ox, oy, rad] of puffs){
        const pg2 = c.createRadialGradient(cx + dx + ox - rad * 0.3, cy + oy - rad * 0.4, rad * 0.1, cx + dx + ox, cy + oy, rad);
        pg2.addColorStop(0, rgba(L.cloud, 0.98)); pg2.addColorStop(0.6, rgba(L.cloud, 0.85)); pg2.addColorStop(1, rgba(L.cloudShade, 0));
        c.fillStyle = pg2; circ(c, cx + dx + ox, cy + oy, rad);
      }
    }
  }
  /* Mountains: three faceted ranges, the far ones hazed - seamless round
     the strip (whole waves of it). */
  const ridge = (x, seed, amp) => {
    let y = 0; for (const [f, a, ph] of [[3, 0.5, seed], [7, 0.3, seed * 2.1], [13, 0.2, seed * 3.7]]) y += a * Math.sin(x / PW * Math.PI * 2 * f + ph);
    return amp * (0.55 + 0.45 * y);
  };
  [[0.55, H * 0.2, 1.1], [0.32, H * 0.15, 2.3], [0.12, H * 0.09, 3.9]].forEach(([haze, amp, seed]) => {
    const lit = mix(L.hillLit, L.haze, haze), dark = mix(L.hillDark, L.haze, haze * 0.85);
    const step = H * (0.05 + haze * 0.05), pts = [];
    for (let x = -step; x <= PW + step; x += step) pts.push([x, HY - ridge(x, seed, amp)]);
    /* The range: lit from above, fading into the haze at its foot. */
    const top = Math.min(...pts.map(q => q[1]));
    const mg = c.createLinearGradient(0, top, 0, HY);
    mg.addColorStop(0, lit); mg.addColorStop(1, mix(L.hillLit, L.haze, Math.min(1, haze + 0.4)));
    c.fillStyle = mg; c.beginPath(); c.moveTo(pts[0][0], HY + 6); for (const [x, y] of pts) c.lineTo(x, y); c.lineTo(pts[pts.length - 1][0], HY + 6); c.closePath(); c.fill();
    /* Each peak: its far side in shade, a facet running down; its sunny
       edge caught in light. */
    for (let k = 1; k < pts.length - 1; k++){
      const [px, py] = pts[k];
      if (!(py < pts[k - 1][1] && py <= pts[k + 1][1])) continue;
      let e = k + 1; while (e < pts.length - 1 && pts[e + 1][1] >= pts[e][1]) e++;
      const [ex, ey] = pts[e];
      c.fillStyle = dark; c.globalAlpha = 0.7;
      c.beginPath(); c.moveTo(px, py); for (let j = k + 1; j <= e; j++) c.lineTo(pts[j][0], pts[j][1]); c.lineTo(ex - (ex - px) * 0.1, HY + 6); c.lineTo(px + (ex - px) * 0.25, HY + 6); c.closePath(); c.fill();
      c.globalAlpha = 0.35; c.beginPath(); c.moveTo(px, py); c.lineTo(px + (ex - px) * 0.25, HY + 6); c.lineTo(px - step * 0.6, HY + 6); c.closePath(); c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = rgba(L.rim, 0.55 * (1 - haze)); c.lineWidth = 2;
      let b0 = k - 1; while (b0 > 0 && pts[b0 - 1][1] >= pts[b0][1]) b0--;
      c.beginPath(); c.moveTo(pts[b0][0], pts[b0][1]); for (let j = b0 + 1; j <= k; j++) c.lineTo(pts[j][0], pts[j][1]); c.stroke();
    }
  });
  /* The crashed ship on a far ridge, its light still blinking, its smoke
     rising - lit on the sun side. */
  const shx = PW * 0.3, shy = HY - H * 0.03;
  for (let k = 0; k < 12; k++){
    const x = shx + H * 0.08 + k * H * 0.018 + Math.sin(k * 0.8) * H * 0.012, y = shy - H * 0.06 - k * H * 0.032, rr = H * (0.02 + k * 0.007);
    c.fillStyle = rgba(L.smoke, 0.3 - k * 0.022); circ(c, x, y, rr);
    c.fillStyle = rgba(L.sun, 0.12 - k * 0.009); circ(c, x - rr * 0.3, y - rr * 0.2, rr * 0.6);
  }
  c.fillStyle = mix(L.ship, L.haze, 0.3);
  c.beginPath(); c.moveTo(shx, shy); c.lineTo(shx + H * 0.14, shy - H * 0.035); c.lineTo(shx + H * 0.19, shy); c.lineTo(shx + H * 0.02, shy + H * 0.02); c.fill();
  c.fillStyle = '#ff8c5a'; circ(c, shx + H * 0.13, shy - H * 0.018, H * 0.004);
  /* Haze along the horizon. */
  const hg = c.createLinearGradient(0, HY - H * 0.12, 0, HY + H * 0.02);
  hg.addColorStop(0, rgba(L.haze, 0)); hg.addColorStop(1, rgba(L.haze, 0.6));
  c.fillStyle = hg; c.fillRect(0, HY - H * 0.12, PW, PH);
  /* Soft focus: the distance a little blurred. */
  try {
    const cp = canvasOf(PW, PH);
    if (cp && 'filter' in c){ cp.getContext('2d').drawImage(cv, 0, 0); c.clearRect(0, 0, PW, PH); c.filter = 'blur(3px)'; c.drawImage(cp, 0, 0); c.filter = 'none'; }
  } catch (e){ /* no blur: fine */ }
  return PANO;
}

/* ---------- the whole corridor ---------- */

/* Everything behind the things on the path: the panorama, the ground, the
   path, the trees. z is how far along the crew are; alarm tints it red. */
/* bare: just the sky, the land and the grass - no path, no trees (a
   scene that places its own: the crash site, lkp-crashsite.js). */
export function drawWorld(c, W, H, z, t, alarm, L, bare = false){
  /* Turns swing the view round, easing. */
  const dt = VIEW.lastT == null ? 0 : Math.min(0.1, Math.max(0, t - VIEW.lastT)); VIEW.lastT = t;
  VIEW.heading += (VIEW.target - VIEW.heading) * Math.min(1, dt * 2.5);
  autoQuality(dt);
  const HY = HORIZON * H;
  const pano = panorama(W, H, L);
  if (pano.cv){
    /* The curves drift the view a little too. */
    const off = ((VIEW.heading + BEND.curve * 0.04) % 1 + 1) % 1 * pano.w;
    c.drawImage(pano.cv, -off, 0, pano.w, pano.h);
    if (pano.w - off < W) c.drawImage(pano.cv, pano.w - off, 0, pano.w, pano.h);
  } else { c.fillStyle = L.sky[1]; c.fillRect(0, 0, W, HY); }
  /* The ground. */
  const gg = c.createLinearGradient(0, HY, 0, H);
  gg.addColorStop(0, mix(L.ground[0], L.haze, 0.45)); gg.addColorStop(0.3, L.ground[1]); gg.addColorStop(1, L.ground[2]);
  c.fillStyle = gg; c.fillRect(0, HY + H * 0.005, W, H - HY);
  /* Grass, rocks, flowers, mushrooms: placed along the way, sliding past. */
  groundBits(c, W, H, z, L);
  /* The path. */
  if (!bare) path(c, W, H, z, L);
  /* Trees and glowing plants along both sides. */
  if (!bare) trees(c, W, H, z, L);
  /* The far end fades into the haze. */
  const fh = c.createLinearGradient(0, HY - H * 0.07, 0, HY + H * 0.08);
  fh.addColorStop(0, rgba(L.haze, 0)); fh.addColorStop(0.45, rgba(L.haze, 0.75)); fh.addColorStop(1, rgba(L.haze, 0));
  c.fillStyle = fh; c.fillRect(0, HY - H * 0.07, W, H * 0.15);
  if (alarm > 0){ c.fillStyle = `rgba(255,60,60,${0.06 * alarm})`; c.fillRect(0, 0, W, H); }
}

/* Something placed along the way: the n-th of a repeating run `span`
   deep, at lane `lane` - where it is now (rel), or null if out of view. */
const along = (n, span, count, z) => {
  const d = (n / count) * span;
  const rel = ((d - z) % span + span) % span - 0.06;
  return rel > 1.02 ? null : rel;
};

function groundBits(c, W, H, z, L){
  const SPAN = 1.2;
  /* Grass tufts. */
  for (let n = 0; n < 220; n++){
    const rel = along(n, SPAN, 220, z); if (rel == null) continue;
    const side = hash(n) < 0.5 ? -1 : 1, lane = side * (1.25 + hash(n + 7) * 3.4), p = P(lane, rel, W, H);
    if (p.x < -40 || p.x > W + 40) continue;
    const h = H * (0.012 + hash(n + 3) * 0.022) * p.k, lit = hash(n + 9) < 0.5;
    c.strokeStyle = lit ? rgba(L.grass[0], 0.55 + 0.4 * Math.min(1, p.k)) : rgba(L.grass[1], 0.55 + 0.4 * Math.min(1, p.k));
    c.lineWidth = Math.max(1, H * 0.003 * p.k);
    c.beginPath();
    for (const dx of [-1, 0, 1]){ c.moveTo(p.x + dx * h * 0.2, p.y); c.quadraticCurveTo(p.x + dx * h * 0.25, p.y - h * 0.6, p.x + dx * h * 0.45 - h * 0.15, p.y - h); }
    c.stroke();
  }
  /* Rocks, flowers, glowing mushrooms. */
  for (let n = 0; n < 70; n++){
    const rel = along(n + 0.5, SPAN, 70, z); if (rel == null) continue;
    const side = hash(n + 50) < 0.5 ? -1 : 1, lane = side * (1.3 + hash(n + 51) * 3), p = P(lane, rel, W, H);
    if (p.x < -60 || p.x > W + 60) continue;
    const k = p.k, kind = hash(n + 52);
    if (kind < 0.4){
      const w = H * (0.008 + hash(n + 53) * 0.014) * k;
      c.fillStyle = 'rgba(25,20,50,.3)'; c.beginPath(); c.ellipse(p.x + w * 0.5, p.y + w * 0.1, w * 1.1, w * 0.3, 0, 0, 6.2832); c.fill();
      c.fillStyle = L.rock[1]; c.beginPath(); c.moveTo(p.x - w, p.y); c.lineTo(p.x - w * 0.4, p.y - w * 0.8); c.lineTo(p.x + w * 0.6, p.y - w * 0.6); c.lineTo(p.x + w, p.y); c.fill();
      c.fillStyle = L.rock[0]; c.beginPath(); c.moveTo(p.x - w, p.y); c.lineTo(p.x - w * 0.4, p.y - w * 0.8); c.lineTo(p.x - w * 0.1, p.y); c.fill();
    } else if (kind < 0.75){
      const h = H * (0.02 + hash(n + 54) * 0.02) * k, col = L.flowers[n % L.flowers.length];
      c.strokeStyle = rgba(L.grass[1], 0.9); c.lineWidth = Math.max(1, H * 0.002 * k);
      c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(p.x - h * 0.1, p.y - h * 0.6, p.x - h * 0.05, p.y - h); c.stroke();
      c.fillStyle = col; for (let j = 0; j < 5; j++){ const a = j / 5 * 6.2832; circ(c, p.x - h * 0.05 + Math.cos(a) * h * 0.14, p.y - h + Math.sin(a) * h * 0.14, h * 0.1); }
      c.fillStyle = '#ffd36b'; circ(c, p.x - h * 0.05, p.y - h, h * 0.08);
    } else {
      const h = H * (0.012 + hash(n + 55) * 0.01) * k, w = h * 1.6;
      c.fillStyle = '#e8e0f0'; c.beginPath(); c.roundRect(p.x - w * 0.12, p.y - h, w * 0.24, h, w * 0.08); c.fill();
      glow(c, p.x, p.y - h, w * 1.6, L.glow, 0.8);
      c.fillStyle = L.glow; c.beginPath(); c.ellipse(p.x, p.y - h + w * 0.05, w * 0.55, w * 0.42, 0, Math.PI, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; circ(c, p.x - w * 0.2, p.y - h - w * 0.18, w * 0.07);
    }
  }
}

/* The path: darker than the ground, worn into two tracks, pebbled, stones
   along its edges - following the bends. */
export const PATH_HALF = 1.15;
function path(c, W, H, z, L){
  const N = 26, Ls = [], Rs = [];
  for (let i = 0; i <= N; i++){ const rel = -0.1 + 1.1 * Math.pow(i / N, 1.6); Ls.push(P(-PATH_HALF, rel, W, H)); Rs.push(P(PATH_HALF, rel, W, H)); }
  const HY = HORIZON * H;
  const pg = c.createLinearGradient(0, HY, 0, H);
  pg.addColorStop(0, mix(L.path[0], L.haze, 0.4)); pg.addColorStop(1, L.path[1]);
  c.fillStyle = pg; c.beginPath();
  Ls.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); for (let i = N; i >= 0; i--) c.lineTo(Rs[i].x, Rs[i].y);
  c.closePath(); c.fill();
  /* Worn tracks. */
  for (const tx of [-0.5, 0.5]){
    c.fillStyle = 'rgba(40,30,70,.12)'; c.beginPath();
    for (let i = 0; i <= N; i++){ const rel = -0.1 + 1.1 * Math.pow(i / N, 1.6), q = P(tx - 0.18, rel, W, H); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }
    for (let i = N; i >= 0; i--){ const rel = -0.1 + 1.1 * Math.pow(i / N, 1.6), q = P(tx + 0.18, rel, W, H); c.lineTo(q.x, q.y); }
    c.fill();
  }
  /* Pebbles. */
  for (let n = 0; n < 150; n++){
    const rel = along(n + 0.3, 1.0, 150, z); if (rel == null) continue;
    const q = P((hash(n + 200) * 2 - 1) * 1.05, rel, W, H), r = H * (0.002 + hash(n + 201) * 0.005) * q.k + 0.5;
    c.fillStyle = 'rgba(30,20,60,.25)'; c.beginPath(); c.ellipse(q.x + r * 0.5, q.y + r * 0.3, r, r * 0.5, 0, 0, 6.2832); c.fill();
    c.fillStyle = hash(n + 202) < 0.5 ? mix(L.path[0], '#ffffff', 0.3) : mix(L.path[1], '#000000', 0.15);
    c.beginPath(); c.ellipse(q.x, q.y, r, r * 0.6, 0, 0, 6.2832); c.fill();
  }
  /* Stones along both edges. */
  for (let n = 0; n < 40; n++){
    const rel = along(n, 1.0, 40, z); if (rel == null) continue;
    for (const side of [-1, 1]){
      const q = P(side * (PATH_HALF + 0.02), rel, W, H), r = H * 0.012 * q.k + 0.5;
      c.fillStyle = 'rgba(30,25,60,.3)'; c.beginPath(); c.ellipse(q.x + r * 0.6, q.y + r * 0.2, r * 1.1, r * 0.4, 0, 0, 6.2832); c.fill();
      c.fillStyle = L.rock[1]; c.beginPath(); c.ellipse(q.x, q.y - r * 0.3, r * 1.1, r * 0.7, 0, 0, 6.2832); c.fill();
      c.fillStyle = L.rock[0]; c.beginPath(); c.ellipse(q.x - r * 0.35, q.y - r * 0.55, r * 0.6, r * 0.35, 0, 0, 6.2832); c.fill();
    }
  }
}

/* A long soft shadow, cast away from the sun. */
export function cast(c, x, y, w, len, alpha = 0.35){
  c.save(); c.translate(x, y); c.rotate(0.12);
  const g = c.createLinearGradient(0, 0, len, 0); g.addColorStop(0, `rgba(25,20,55,${alpha})`); g.addColorStop(1, 'rgba(25,20,55,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(len * 0.45, 0, len * 0.55, w, 0, 0, 6.2832); c.fill();
  c.restore();
}

/* Faceted conifers along both sides, far to near; a glowing bulb plant by
   some. */
function trees(c, W, H, z, L){
  const SPAN = 1.4, N = 12, list = [];
  for (let n = 0; n < N; n++){
    const rel = along(n, SPAN, N, z); if (rel == null || rel < -0.06) continue;
    for (const side of [-1, 1]) list.push({ rel, lane: side * (1.8 + hash(n * 2 + (side > 0 ? 1 : 0)) * 1.6), n, side });
  }
  list.sort((a, b) => b.rel - a.rel);
  for (const tr of list) tree(c, W, H, tr.lane, tr.rel, L, tr.n);
}

export function tree(c, W, H, lane, rel, L, n = 0){
  const p = P(lane, rel, W, H), s = H * 0.0011 * p.k * (0.85 + hash(n + 300) * 0.4), haze = Math.min(0.7, Math.max(0, rel) * 0.9);
  if (p.x < -200 * s * 3 || p.x > W + 200 * s * 3) return;
  cast(c, p.x, p.y, 26 * s, 380 * s);
  c.fillStyle = 'rgba(20,15,45,.4)'; c.beginPath(); c.ellipse(p.x, p.y, 70 * s, 16 * s, 0, 0, 6.2832); c.fill();
  c.fillStyle = mix(L.trunk[0], L.haze, haze); c.fillRect(p.x - 9 * s, p.y - 160 * s, 18 * s, 160 * s);
  c.fillStyle = mix(L.trunk[1], L.haze, haze); c.fillRect(p.x - 9 * s, p.y - 160 * s, 6 * s, 160 * s);
  for (const [w, top, bot] of [[120, -360, -150], [98, -470, -270], [70, -560, -390], [40, -620, -500]]){
    c.fillStyle = mix(L.tree[0], L.haze, haze); c.beginPath(); c.moveTo(p.x, p.y + top * s); c.lineTo(p.x - w * s, p.y + bot * s); c.lineTo(p.x + 6 * s, p.y + (bot + 18) * s); c.fill();
    c.fillStyle = mix(L.tree[1], L.haze, haze); c.beginPath(); c.moveTo(p.x, p.y + top * s); c.lineTo(p.x + w * s, p.y + bot * s); c.lineTo(p.x + 6 * s, p.y + (bot + 18) * s); c.fill();
    c.strokeStyle = rgba(L.rim, 0.55 * (1 - haze)); c.lineWidth = 2 * s + 0.5; c.beginPath(); c.moveTo(p.x, p.y + top * s); c.lineTo(p.x - w * s, p.y + bot * s); c.stroke();
  }
  if (hash(n + 301) < 0.5){
    const bx = p.x - 130 * s; c.strokeStyle = mix('#6b5b8a', L.haze, haze); c.lineWidth = 6 * s;
    c.beginPath(); c.moveTo(bx, p.y); c.quadraticCurveTo(bx - 30 * s, p.y - 110 * s, bx - 6 * s, p.y - 200 * s); c.stroke();
    glow(c, bx - 6 * s, p.y - 210 * s, 60 * s + 4, L.bulb, 0.9); c.fillStyle = mix(L.bulb, '#ffffff', 0.5); circ(c, bx - 6 * s, p.y - 210 * s, 16 * s + 1);
  }
}

/* ---------- the finish ---------- */

const FX = { small: null, blur: null, grain: null, grade: null, gradeKey: '' };
/* Over everything on the path, before the HUD: bloom, a warm/cool grade
   with a vignette, a little grain. Works on the canvas's own pixels, as
   cheaply as it can: the bloom is blurred tiny and blown back up; the
   grade and vignette are painted once and laid over. */
export function finish(c, W, H, L, parts = FINISH){
  const cv = c.canvas;
  if (!cv || !cv.width || typeof c.drawImage !== 'function') return;
  const cw = cv.width, ch = cv.height;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  if (parts.bloom){
    const sw = Math.max(16, Math.round(cw / 10)), sh = Math.max(9, Math.round(ch / 10));
    if (!FX.small || FX.small.width !== sw || FX.small.height !== sh){ FX.small = canvasOf(sw, sh); FX.blur = canvasOf(sw, sh); }
    if (FX.small && FX.blur){
      const s = FX.small.getContext('2d'), b = FX.blur.getContext('2d');
      s.globalCompositeOperation = 'copy'; s.drawImage(cv, 0, 0, sw, sh);
      b.globalCompositeOperation = 'copy'; try { b.filter = 'blur(3px) saturate(1.4)'; } catch (e){} b.drawImage(FX.small, 0, 0); try { b.filter = 'none'; } catch (e){}
      c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.2; c.imageSmoothingEnabled = true;
      c.drawImage(FX.blur, 0, 0, cw, ch);
      c.globalAlpha = 1;
    }
  }
  if (parts.grade){
    /* Warm where the sun is, cool away from it, darker at the edges:
       painted once at a small size, laid over. */
    const key = `${L.key}`;
    if (FX.gradeKey !== key){
      FX.grade = canvasOf(320, 180); FX.gradeKey = key;
      if (FX.grade){
        const g2 = FX.grade.getContext('2d');
        const g = g2.createLinearGradient(0, 0, 320, 180); g.addColorStop(0, rgba(L.warm, 0.14)); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, rgba(L.cool, 0.2));
        g2.fillStyle = g; g2.fillRect(0, 0, 320, 180);
        const v = g2.createRadialGradient(160, 100, 75, 160, 100, 200); v.addColorStop(0, 'rgba(10,8,30,0)'); v.addColorStop(1, 'rgba(10,8,30,.45)');
        g2.fillStyle = v; g2.fillRect(0, 0, 320, 180);
      }
    }
    if (FX.grade) c.drawImage(FX.grade, 0, 0, cw, ch);
  }
  if (parts.grain){
    if (!FX.grain){
      const n = canvasOf(128, 128);
      if (n){ const nc = n.getContext('2d'), id = nc.createImageData(128, 128); for (let k = 0; k < id.data.length; k += 4){ const val = Math.random() < 0.5 ? 0 : 255; id.data[k] = id.data[k + 1] = id.data[k + 2] = val; id.data[k + 3] = 6; } nc.putImageData(id, 0, 0); FX.grain = c.createPattern(n, 'repeat'); }
    }
    if (FX.grain){ c.fillStyle = FX.grain; c.fillRect(0, 0, cw, ch); }
  }
  c.restore();
}
/* Which finishing touches are on (all, unless the machine struggles). */
export const FINISH = { bloom: true, grade: true, grain: true };
/* If frames are coming slowly (under ~40 a second, for a few seconds),
   drop the costliest touch; then the next. Never back on (no flicker). */
const QUALITY = { slow: 0, steps: 0 };
function autoQuality(dt){
  if (!dt) return;
  QUALITY.slow = dt > 1 / 40 ? QUALITY.slow + dt : Math.max(0, QUALITY.slow - dt * 0.5);
  if (QUALITY.slow > 3){
    QUALITY.slow = 0; QUALITY.steps++;
    if (FINISH.bloom) FINISH.bloom = false; else if (FINISH.grain) FINISH.grain = false; else if (FINISH.grade) FINISH.grade = false;
  }
}

/* ---------- things on the path ---------- */

/* Debris from lane a to b: a fallen crystal rock, faceted and lit. Slide
   round it. */
export function worldBlocker(c, W, H, rel, a, b, L, seed = 0){
  const l = P(a, rel, W, H), r = P(b, rel, W, H), h = H * 0.17 * l.k;
  cast(c, r.x - (r.x - l.x) * 0.2, l.y, h * 0.25, h * 2.2, 0.35);
  const mid = (l.x + r.x) / 2, peak = l.x + (r.x - l.x) * (0.35 + hash(seed) * 0.3);
  c.fillStyle = L.crystal[1]; c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(l.x + (r.x - l.x) * 0.12, l.y - h * 0.7); c.lineTo(peak, l.y - h); c.lineTo(r.x - (r.x - l.x) * 0.1, l.y - h * 0.6); c.lineTo(r.x, l.y); c.closePath(); c.fill();
  c.fillStyle = L.crystal[0]; c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(l.x + (r.x - l.x) * 0.12, l.y - h * 0.7); c.lineTo(peak, l.y - h); c.lineTo(mid - (r.x - l.x) * 0.05, l.y); c.closePath(); c.fill();
  c.fillStyle = L.crystal[2]; c.beginPath(); c.moveTo(peak, l.y - h); c.lineTo(r.x - (r.x - l.x) * 0.1, l.y - h * 0.6); c.lineTo(mid + (r.x - l.x) * 0.15, l.y - h * 0.35); c.closePath(); c.fill();
  c.strokeStyle = rgba(L.rim, 0.75); c.lineWidth = Math.max(1, 3 * l.k); c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(l.x + (r.x - l.x) * 0.12, l.y - h * 0.7); c.lineTo(peak, l.y - h); c.stroke();
}

/* A fallen trunk across the whole path at head height, propped on two
   boulders. Duck under it. */
export function worldBeam(c, W, H, rel, L){
  const l = P(-PATH_HALF - 0.1, rel, W, H), r = P(PATH_HALF + 0.1, rel, W, H), k = l.k;
  const top = l.y - H * 0.36 * k, bot = l.y - H * 0.24 * k, th = bot - top;
  for (const [x, d] of [[l.x, -1], [r.x, 1]]){
    const w = H * 0.07 * k;
    c.fillStyle = L.rock[1]; c.beginPath(); c.moveTo(x - w, l.y); c.lineTo(x - w * 0.6, bot + th * 0.2); c.lineTo(x + w * 0.5, bot); c.lineTo(x + w, l.y); c.fill();
    c.fillStyle = L.rock[0]; c.beginPath(); c.moveTo(x - w, l.y); c.lineTo(x - w * 0.6, bot + th * 0.2); c.lineTo(x - w * 0.1, l.y); c.fill();
  }
  cast(c, (l.x + r.x) / 2, l.y, H * 0.012 * k, (r.x - l.x) * 0.6, 0.25);
  const g = c.createLinearGradient(0, top, 0, bot); g.addColorStop(0, L.trunk[1]); g.addColorStop(1, L.trunk[0]);
  c.fillStyle = g; c.beginPath(); c.roundRect(l.x - th * 0.3, top, r.x - l.x + th * 0.6, th, th / 2); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = Math.max(1, 2 * k);
  for (let i = 1; i < 6; i++){ const x = l.x + (r.x - l.x) * i / 6; c.beginPath(); c.moveTo(x - th * 0.2, top + th * 0.3); c.lineTo(x + th * 0.3, top + th * 0.5); c.stroke(); }
  c.fillStyle = L.wood; c.beginPath(); c.ellipse(r.x + th * 0.3, top + th / 2, th * 0.22, th * 0.48, 0, 0, 6.2832); c.fill();
  /* moss along the top, glowing a little */
  c.fillStyle = rgba(L.grass[0], 0.9); c.beginPath(); c.roundRect(l.x, top - th * 0.08, r.x - l.x, th * 0.22, th * 0.1); c.fill();
}

/* A ditch across part of the path, lane a to b: dark, its near lip lit.
   Hop over it. */
export function worldGap(c, W, H, rel, a, b, L){
  const d = 0.045;
  const l0 = P(a, rel + d, W, H), r0 = P(b, rel + d, W, H), l1 = P(a, rel - d * 0.4, W, H), r1 = P(b, rel - d * 0.4, W, H);
  const g = c.createLinearGradient(0, l0.y, 0, l1.y); g.addColorStop(0, '#0b0a18'); g.addColorStop(1, '#241d3d');
  c.fillStyle = g; c.beginPath(); c.moveTo(l0.x, l0.y); c.lineTo(r0.x, r0.y); c.lineTo(r1.x, r1.y); c.lineTo(l1.x, l1.y); c.closePath(); c.fill();
  /* the far wall, catching light */
  c.fillStyle = rgba(L.path[0], 0.7); c.beginPath(); c.moveTo(l0.x, l0.y); c.lineTo(r0.x, r0.y); c.lineTo(r0.x, r0.y + (l1.y - l0.y) * 0.25); c.lineTo(l0.x, l0.y + (l1.y - l0.y) * 0.25); c.closePath(); c.fill();
  c.strokeStyle = rgba(L.rim, 0.9); c.lineWidth = Math.max(1.5, 4 * l1.k); c.beginPath(); c.moveTo(l1.x, l1.y); c.lineTo(r1.x, r1.y); c.stroke();
}

/* An energy crystal: a glowing cyan hex gem, turning. */
export function worldCrystal(c, x, y, s, t = 0){
  const spin = 0.55 + 0.45 * Math.abs(Math.cos(t * 2.5));
  c.save(); c.translate(x, y); c.scale(spin, 1);
  glow(c, 0, 0, s * 2.4, '#5ff3ff', 0.75);
  const hx = (rad) => { c.beginPath(); for (let k = 0; k < 6; k++){ const a = k * Math.PI / 3 + Math.PI / 6; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } c.closePath(); };
  c.fillStyle = '#1fa3c2'; hx(s * 1.1); c.fill();
  c.fillStyle = '#6fe9ff'; c.beginPath(); c.moveTo(0, -s * 1.1); c.lineTo(-s * 0.95, -s * 0.55); c.lineTo(-s * 0.95, s * 0.55); c.lineTo(0, 0); c.fill();
  c.fillStyle = '#e4fcff'; c.beginPath(); c.moveTo(0, -s * 1.1); c.lineTo(s * 0.95, -s * 0.55); c.lineTo(0, 0); c.lineTo(-s * 0.95, -s * 0.55); c.fill();
  c.restore();
}

/* A spring: a long pool of glowing healing water along the path, len
   deep - rocks round its edge, ripples, bubbles rising. Run along it. */
export function worldFountain(c, W, H, rel, lane, t, len, L){
  const n = 14, half = 0.32, from = Math.max(-0.08, rel), to = rel + len;
  if (to < -0.08 || from > 1.05) return;
  const edge = (side, out = 0) => { const pts = []; for (let i = 0; i <= n; i++){ const r = from + (to - from) * i / n, e = Math.sin(Math.PI * Math.min(1, Math.max(0, (r - rel) / len))) ** 0.35; pts.push(P(lane + side * (half * e + out), r, W, H)); } return pts; };
  const shape = (out) => { const a = edge(-1, out), b = edge(1, out); c.beginPath(); a.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); for (let i = b.length - 1; i >= 0; i--) c.lineTo(b[i].x, b[i].y); c.closePath(); };
  const near = P(lane, from, W, H), farP = P(lane, to, W, H);
  c.fillStyle = L.rock[1]; shape(0.06); c.fill();
  const g = c.createLinearGradient(0, farP.y, 0, near.y); g.addColorStop(0, mix(L.water, L.haze, 0.3)); g.addColorStop(0.5, L.water); g.addColorStop(1, '#1b7f9e');
  c.fillStyle = g; shape(0); c.fill();
  /* light on the water, rippling down its length */
  c.strokeStyle = 'rgba(255,255,255,.45)';
  for (let k = 0; k < 5; k++){
    const u = ((t * 0.35 + k / 5) % 1), r = rel + len * u; if (r < from) continue;
    const q = P(lane, r, W, H), w = (P(lane + half * 0.7, r, W, H).x - q.x);
    c.lineWidth = Math.max(1, 2 * q.k); c.beginPath(); c.ellipse(q.x, q.y, Math.abs(w), Math.abs(w) * 0.12, 0, 0, 6.2832); c.stroke();
  }
  glow(c, (near.x + farP.x) / 2, (near.y + farP.y) / 2, Math.abs(near.y - farP.y) * 0.8 + H * 0.05 * near.k, L.water, 0.45);
  /* bubbles rising all along it */
  c.fillStyle = 'rgba(210,255,255,.9)';
  for (let k = 0; k < 14; k++){
    const r = rel + len * ((k * 0.37) % 1); if (r < from || r > 1) continue;
    const q = P(lane + (((k * 0.61) % 1) - 0.5) * half, r, W, H), u = (t * 0.6 + k / 14) % 1;
    circ(c, q.x, q.y - u * H * 0.12 * q.k, (H * 0.004 * (1 - u * 0.6)) * q.k + 0.5);
  }
}
