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
import { P, HORIZON, RUN, BEND, FOG, groundTop } from './lkp-art.js';

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
  /* (PT: headroom over the top of the view, so the clouds aren't cut off
     when a camera looks up) */
  const PW = Math.round(W * 2.5), HY = HORIZON * H, PT = Math.round(H * 0.16), PH = Math.round(HY + H * 0.08);
  const cv = canvasOf(PW, PH + PT);
  Object.assign(PANO, { key, cv, w: PW, h: PH + PT, top: null, pt: PT });
  if (!cv) return PANO;
  const c = cv.getContext('2d');
  c.translate(0, PT);
  /* Sky. */
  const g = c.createLinearGradient(0, 0, 0, HY);
  L.sky.forEach((col, i) => g.addColorStop(i / (L.sky.length - 1), col));
  c.fillStyle = g; c.fillRect(0, -PT, PW, PH + PT);
  /* The sun, and its glow. */
  const sx = PW * 0.12, sy = HY * 0.42;
  const sg = c.createRadialGradient(sx, sy, 0, sx, sy, H * 0.75);
  sg.addColorStop(0, rgba(L.sun, 1)); sg.addColorStop(0.07, rgba(L.sun, 0.9)); sg.addColorStop(0.35, rgba(L.sun, 0.28)); sg.addColorStop(1, rgba(L.sun, 0));
  for (const dx of [0, PW]){ c.save(); c.translate(dx, 0); c.fillStyle = sg; c.fillRect(sx - H, -PT, H * 2, PH + PT); c.restore(); }
  c.fillStyle = '#fff8e8'; for (const dx of [0, PW]) circ(c, sx + dx, sy, H * 0.03);
  /* (the sky's top row, before the clouds and the blur: the sky above it,
     for a camera looking up) */
  PANO.top = canvasOf(PW, 1);  /* (row 0: the top of the headroom) */
  if (PANO.top) PANO.top.getContext('2d').drawImage(cv, 0, 0, PW, 1, 0, 0, PW, 1);
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
    /* (kept clear of the strip's two ends, so none is ever cut across where the copies meet) */
    const cx = (0.12 + 0.74 * (n + r() * 0.6) / 7) * PW, cy = HY * (0.12 + r() * 0.3), sc = H * (0.0005 + r() * 0.0004);
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
    const cp = canvasOf(PW, PH + PT);
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (cp && 'filter' in c){ cp.getContext('2d').drawImage(cv, 0, 0); c.clearRect(0, 0, PW, PH + PT); c.filter = 'blur(3px)'; for (const dx of [-PW, 0, PW]) c.drawImage(cp, dx, 0); c.filter = 'none'; }
  } catch (e){ /* no blur: fine */ }
  return PANO;
}

/* ---------- the whole corridor ---------- */

/* Everything behind the things on the path: the panorama, the ground, the
   path, the trees. z is how far along the crew are; alarm tints it red. */
/* bare: just the sky, the land and the grass - no path, no trees (a
   scene that places its own: the crash site, lkp-crashsite.js). */
/* How far above the screen's top the sky goes on - for a camera looking
   up (the opening) - and up there into space; and how far the world goes
   on past the screen's left edge (the opening's crash site, over there). */
export const SKY = { above: 0, wide: 0, far: null };
/* (SKY.far: something to draw far off in the sky, behind the land - a
   function (c, W, H, horizonY), or null) */
/* Places along the way kept clear of the trees by the path: { lane, d
   (how far along), r, and depth (along the way) if not round } - the
   crash site, the healing pond. */
export const CLEAR = [];
export function drawWorld(c, W, H, z, t, alarm, L, bare = false, above = SKY.above){
  /* Turns swing the view round, easing. */
  const dt = VIEW.lastT == null ? 0 : Math.min(0.1, Math.max(0, t - VIEW.lastT)); VIEW.lastT = t;
  VIEW.heading += (VIEW.target - VIEW.heading) * Math.min(1, dt * 2.5);
  autoQuality(dt);
  const HY = HORIZON * H;
  const pano = panorama(W, H, L);
  if (pano.cv){
    /* The curves drift the view a little too. */
    const off = ((VIEW.heading + BEND.curve * 0.04) % 1 + 1) % 1 * pano.w;
    /* (round the strip, as far as the view goes) */
    const copies = [-off]; if (pano.w - off < W) copies.push(pano.w - off); if (SKY.wide > off) copies.push(-off - pano.w);
    /* (leaving out its very edges, softened by the blur, so no seam shows
       where two copies meet) */
    for (const dx of copies) c.drawImage(pano.cv, 6, 0, pano.cv.width - 12, pano.cv.height, dx - 1, -pano.pt, pano.w + 2, pano.h);
    /* A camera looking up sees more sky: its top row, stretched on up. */
    if (above > 0){
      if (PANO.top) for (const dx of copies) c.drawImage(PANO.top, dx, -above, pano.w + 1, Math.max(1, above - pano.pt + 10));
      /* deepening to the top of the sky's colour, gently, so there's no edge */
      const top = Math.min(above, H * 0.35), sg = c.createLinearGradient(0, -top, 0, H * 0.06);
      sg.addColorStop(0, rgba(L.sky[0], 1)); sg.addColorStop(0.45, rgba(L.sky[0], 0.45)); sg.addColorStop(0.8, rgba(L.sky[0], 0.1)); sg.addColorStop(1, rgba(L.sky[0], 0));
      if (above > top){
        const sp = c.createLinearGradient(0, -top, 0, -Math.max(above, H * 2));
        sp.addColorStop(0, L.sky[0]); sp.addColorStop(0.3, '#22408a'); sp.addColorStop(0.6, '#0d1636'); sp.addColorStop(1, '#04060f');
        c.fillStyle = above > H ? sp : L.sky[0]; c.fillRect(-SKY.wide, -above, W + SKY.wide, above - top);
      }
      c.fillStyle = sg; c.fillRect(-SKY.wide, -top, W + SKY.wide, top + H * 0.06);
    }
  } else { c.fillStyle = L.sky[1]; c.fillRect(0, 0, W, HY); }
  /* The ground. */
  /* (its far edge: the horizon - higher with a rise ahead, lower with a dip) */
  const GY = Math.min(H * (HORIZON + 0.06), groundTop() * H);
  const gg = c.createLinearGradient(0, GY, 0, H);
  gg.addColorStop(0, mix(L.ground[0], L.haze, 0.45 * FOG)); gg.addColorStop(0.3, L.ground[1]); gg.addColorStop(1, L.ground[2]);
  c.fillStyle = gg; c.fillRect(-SKY.wide, GY + H * 0.005, W + SKY.wide * 2, H - GY + H * 0.1);
  /* Grass, rocks, flowers, mushrooms: placed along the way, sliding past. */
  groundBits(c, W, H, z, L);
  /* Anything far off, on the land's far edge. */
  if (SKY.far) SKY.far(c, W, H, HY);
  /* The path. */
  if (!bare){ path(c, W, H, z, L); hedges(c, W, H, z, L); for (const g of ROAD.gaps) ravine(c, W, H, g.d - z, g.len, L, t); }
  /* Trees and glowing plants along both sides. */
  if (!bare) trees(c, W, H, z, L);
  /* The far end fades into the haze. */
  const fh = c.createLinearGradient(0, GY - H * 0.07, 0, GY + H * 0.08);
  fh.addColorStop(0, rgba(L.haze, 0)); fh.addColorStop(0.45, rgba(L.haze, 0.75 * FOG)); fh.addColorStop(1, rgba(L.haze, 0));
  c.fillStyle = fh; c.fillRect(-SKY.wide, GY - H * 0.07, W + SKY.wide * 2, H * 0.15);
  if (alarm > 0){ c.fillStyle = `rgba(255,60,60,${0.06 * alarm})`; c.fillRect(0, 0, W, H); }
}

/* Where the road narrows: thick bushes crowding in from both sides,
   right up to its edges - nobody's getting through those. */
function hedges(c, W, H, z, L){
  const list = [];
  for (let n = 0; n < 90; n++){
    const rel = along(n, 1.0, 90, z); if (rel == null || rel < -0.08) continue;
    const hw = roadHalf(z + rel); if (hw > PATH_HALF - 0.12) continue;
    for (const side of [-1, 1]) for (const j of [0, 1, 2]) list.push({ rel: rel + j * 0.004, lane: side * (hw + 0.12 + j * 0.3 + hash(n * 3 + j) * 0.12), n: n * 3 + j });
  }
  list.sort((a, b) => b.rel - a.rel);
  for (const b of list){
    const p = P(b.lane, b.rel, W, H), r = H * (0.05 + hash(b.n + 700) * 0.03) * p.k, haze = Math.min(0.6 * FOG, Math.max(0, b.rel) * 0.8 * FOG);
    c.fillStyle = 'rgba(20,15,45,.3)'; c.beginPath(); c.ellipse(p.x, p.y, r * 1.2, r * 0.25, 0, 0, 6.2832); c.fill();
    c.fillStyle = mix(L.tree[1], L.haze, haze); circ(c, p.x, p.y - r * 0.8, r);
    c.fillStyle = mix(L.tree[0], L.haze, haze); circ(c, p.x - r * 0.3, p.y - r * 1.05, r * 0.72);
    c.fillStyle = mix(L.grass[0], L.haze, haze); circ(c, p.x - r * 0.45, p.y - r * 1.3, r * 0.32);
    if (hash(b.n + 701) < 0.3){ c.fillStyle = L.flowers[b.n % L.flowers.length]; circ(c, p.x + r * 0.3, p.y - r * 1.2, r * 0.12); }
  }
}

/* A ravine right across the way, its near edge rel ahead, len deep:
   the path breaks off; looking over, the far side's cliff face falls
   away - lit at the top, darker down it - into mist rising from far
   below, the tops of trees just showing through. */
export function ravine(c, W, H, rel, len, L, t = 0){
  if (rel > 1.05 || rel + len < -0.15) return;
  const X = 14, near = Math.max(-0.12, rel), far = Math.min(1.02, rel + len);
  const nl = P(-X, near, W, H), nr = P(X, near, W, H), fl = P(-X, far, W, H), fr = P(X, far, W, H);
  const top = fl.y, bot = nl.y, span = Math.max(1, bot - top);
  /* the far cliff face, falling into the mist */
  const g = c.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, mix(L.rock[0], L.rim, 0.3)); g.addColorStop(0.1, mix(L.rock[1], '#2a2240', 0.25));
  g.addColorStop(0.45, mix(L.hillDark, '#151230', 0.7)); g.addColorStop(0.78, mix(L.hillDark, L.haze, 0.45)); g.addColorStop(1, mix(L.haze, '#ffffff', 0.5));
  c.fillStyle = g; c.beginPath(); c.moveTo(nl.x, nl.y); c.lineTo(nr.x, nr.y); c.lineTo(fr.x, fr.y); c.lineTo(fl.x, fl.y); c.closePath(); c.fill();
  /* cracks and ledges down the rock */
  c.strokeStyle = rgba(L.hillDark, 0.5); c.lineWidth = Math.max(1, 3 * fl.k);
  for (let k = 0; k < 18; k++){
    const x = W * (hash(k + 920) * 1.2 - 0.1), y0 = top + span * 0.04, y1 = top + span * (0.25 + hash(k + 921) * 0.35);
    c.beginPath(); c.moveTo(x, y0); c.lineTo(x + (hash(k + 922) - 0.5) * span * 0.2, (y0 + y1) / 2); c.lineTo(x + (hash(k + 923) - 0.5) * span * 0.15, y1); c.stroke();
  }
  /* treetops far below, in the mist */
  for (let k = 0; k < 30; k++){
    const x = W * (hash(k + 900) * 1.2 - 0.1), y = top + span * (0.62 + hash(k + 901) * 0.25), r = span * (0.05 + hash(k + 902) * 0.05);
    c.fillStyle = rgba(mix(L.tree[1], L.haze, 0.55), 0.85); c.beginPath(); c.moveTo(x, y - r * 1.6); c.lineTo(x + r, y + r * 0.4); c.lineTo(x - r, y + r * 0.4); c.closePath(); c.fill();
  }
  /* mist drifting up from the bottom */
  for (let k = 0; k < 8; k++) glow(c, W * (hash(k + 910) * 1.2 - 0.1) + Math.sin(t * 0.2 + k) * W * 0.03, top + span * (0.8 + hash(k + 911) * 0.15), span * 0.5, '#ffffff', 0.35);
  /* the far edge: grass and the path going on, its rim catching the light */
  if (far < 1.02){
    c.strokeStyle = rgba(L.rim, 0.9); c.lineWidth = Math.max(1, 3 * fl.k); c.beginPath(); c.moveTo(fl.x, fl.y); c.lineTo(fr.x, fr.y); c.stroke();
  }
  /* the near edge: the ground breaking off, a dark lip; glowing - hop as
     you reach it */
  if (rel > -0.12){
    const lh = H * 0.012 * nl.k;
    c.fillStyle = mix(L.ground[2], '#1a1428', 0.5); c.fillRect(0, bot - lh * 0.2, W, lh * 1.6);
    const a = P(-PATH_HALF, rel, W, H), b = P(PATH_HALF, rel, W, H);
    c.fillStyle = mix(L.path[1], '#1a1428', 0.45); c.fillRect(a.x, bot - lh * 0.2, b.x - a.x, lh * 1.6);
    c.strokeStyle = `rgba(255,224,102,${0.6 + 0.35 * Math.sin(t * 8)})`; c.lineWidth = Math.max(2, 7 * a.k); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
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
  /* Now and then, a patch: a field of flowers, or a ring of glowing
     mushrooms, off to one side. */
  for (let n = 0; n < 8; n++){
    const rel = along(n + 0.25, SPAN, 8, z); if (rel == null || rel < -0.05) continue;
    const side = hash(n + 4600) < 0.5 ? -1 : 1, lane = side * (2.2 + hash(n + 4601) * 1.6), kind = hash(n + 4602) < 0.6 ? 'flowers' : 'shrooms';
    if (CLEAR.some(q => Math.abs(lane - q.lane) < q.r + 0.6 && Math.abs(rel + z - q.d) < (q.depth ?? q.r * 0.3 + 0.12))) continue;
    for (let j = 0; j < 22; j++){
      const a = j * 2.4, rr = Math.sqrt((j + 0.5) / 22), p = P(lane + Math.cos(a) * rr * 0.9, rel + Math.sin(a) * rr * 0.06, W, H), k = p.k;
      if (p.x < -40 || p.x > W + 40) continue;
      if (kind === 'flowers'){
        const h = H * 0.014 * k + 1, col = L.flowers[(n + j) % L.flowers.length];
        c.strokeStyle = rgba(L.grass[1], 0.8); c.lineWidth = Math.max(1, H * 0.0015 * k); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y - h); c.stroke();
        c.fillStyle = col; circ(c, p.x, p.y - h, h * 0.35);
      } else if (j % 2 === 0){
        const h = H * 0.01 * k + 1, w = h * 1.5;
        c.fillStyle = '#e8e0f0'; c.fillRect(p.x - w * 0.1, p.y - h, w * 0.2, h);
        glow(c, p.x, p.y - h, w * 1.4, L.glow, 0.6);
        c.fillStyle = L.glow; c.beginPath(); c.ellipse(p.x, p.y - h, w * 0.5, w * 0.38, 0, Math.PI, 6.2832); c.fill();
      }
    }
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
/* The road's own changes along the way: where it narrows or widens
   (spans: { d0, d1, half } - from d0 to d1 it's half lanes either side,
   easing in and out over EASE), and where a ravine cuts right across it
   (gaps: { d, len }). In how far along (d), like the things. */
export const ROAD = { spans: [], gaps: [], surfaces: [] };
/* (surfaces: { d0, d1, kind } - stretches where the path is something
   else: 'flag' (old flagstones, a ruin's), 'moss' (a mossy track),
   'boards' (a boardwalk over boggy ground); dirt everywhere else. Each
   blends in and out over SURF_EASE.) */
const SURF_EASE = 0.08;
export function surfaceAt(d){
  for (const sf of ROAD.surfaces){ const k = Math.min(ramp((d - sf.d0) / SURF_EASE), ramp((sf.d1 - d) / SURF_EASE)); if (k > 0) return { kind: sf.kind, k }; }
  return { kind: 'dirt', k: 1 };
}
const EASE = 0.12;
const ramp = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
export function roadHalf(d){
  let hw = PATH_HALF;
  for (const sp of ROAD.spans){
    const k = Math.min(ramp((d - sp.d0) / EASE + 1), ramp((sp.d1 - d) / EASE + 1));
    if (k > 0) hw += (sp.half - PATH_HALF) * k;
  }
  return hw;
}
export const inRavine = (d, pad = 0) => ROAD.gaps.some(g => d > g.d - pad && d < g.d + g.len + pad);
function path(c, W, H, z, L){
  const N = 40, Ls = [], Rs = [];
  for (let i = 0; i <= N; i++){ const rel = -0.1 + 1.1 * Math.pow(i / N, 1.6), hw = roadHalf(z + rel); Ls.push(P(-hw, rel, W, H)); Rs.push(P(hw, rel, W, H)); }
  const HY = HORIZON * H;
  const pg = c.createLinearGradient(0, HY, 0, H);
  pg.addColorStop(0, mix(L.path[0], L.haze, 0.4 * FOG)); pg.addColorStop(1, L.path[1]);
  c.fillStyle = pg; c.beginPath();
  Ls.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); for (let i = N; i >= 0; i--) c.lineTo(Rs[i].x, Rs[i].y);
  c.closePath(); c.fill();
  /* The stretches where it's something else: flagstones, moss, boards. */
  c.save(); c.beginPath(); Ls.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); for (let i = N; i >= 0; i--) c.lineTo(Rs[i].x, Rs[i].y); c.closePath(); c.clip();
  for (const sf of ROAD.surfaces) surface(c, W, H, z, L, sf);
  c.restore();
  /* Worn tracks (on the dirt). */
  for (const tx of [-0.5, 0.5]){
    c.fillStyle = 'rgba(40,30,70,.12)'; c.beginPath();
    for (let i = 0; i <= N; i++){ const rel = -0.1 + 1.1 * Math.pow(i / N, 1.6), q = P(tx - 0.18, rel, W, H); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }
    for (let i = N; i >= 0; i--){ const rel = -0.1 + 1.1 * Math.pow(i / N, 1.6), q = P(tx + 0.18, rel, W, H); c.lineTo(q.x, q.y); }
    c.fill();
  }
  /* Pebbles. */
  for (let n = 0; n < 150; n++){
    const rel = along(n + 0.3, 1.0, 150, z); if (rel == null) continue;
    if (surfaceAt(z + rel).kind !== 'dirt') continue;
    const q = P((hash(n + 200) * 2 - 1) * 1.05, rel, W, H), r = H * (0.002 + hash(n + 201) * 0.005) * q.k + 0.5;
    c.fillStyle = 'rgba(30,20,60,.25)'; c.beginPath(); c.ellipse(q.x + r * 0.5, q.y + r * 0.3, r, r * 0.5, 0, 0, 6.2832); c.fill();
    c.fillStyle = hash(n + 202) < 0.5 ? mix(L.path[0], '#ffffff', 0.3) : mix(L.path[1], '#000000', 0.15);
    c.beginPath(); c.ellipse(q.x, q.y, r, r * 0.6, 0, 0, 6.2832); c.fill();
  }
  /* Bits along the dirt, kept to the sides (the middle's for what's
     coming): fallen leaves, little puddles with the sky in them, cracks,
     glowing seed-pods. */
  pathBits(c, W, H, z, L);
  /* Its edges: soft - grass spilling over in clumps here, stones there. */
  for (let n = 0; n < 40; n++){
    const rel = along(n, 1.0, 40, z); if (rel == null) continue;
    for (const side of [-1, 1]){
      const q = P(side * (roadHalf(z + rel) + 0.02), rel, W, H), r = H * 0.012 * q.k + 0.5;
      if (hash(n * 2 + (side > 0 ? 1 : 0) + 4400) < 0.55){
        /* a clump of grass, leaning over the edge */
        const h = H * 0.028 * q.k + 1, haze = Math.min(0.6 * FOG, Math.max(0, rel) * 0.8 * FOG);
        c.fillStyle = mix(L.ground[1], L.haze, haze); c.beginPath(); c.ellipse(q.x - side * r * 0.6, q.y, r * 2.4, r * 0.7, 0, 0, 6.2832); c.fill();
        c.strokeStyle = mix(L.grass[0], L.haze, haze); c.lineWidth = Math.max(1, H * 0.003 * q.k);
        c.beginPath(); for (let j = -3; j <= 3; j++){ const bx = q.x - side * r * 0.4 + j * r * 0.55; c.moveTo(bx, q.y); c.quadraticCurveTo(bx - side * h * 0.2, q.y - h * 0.6, bx - side * h * (0.35 + 0.1 * (j & 1)), q.y - h * (0.7 + 0.3 * hash(n + j + 4410))); } c.stroke();
        continue;
      }
      c.fillStyle = 'rgba(30,25,60,.3)'; c.beginPath(); c.ellipse(q.x + r * 0.6, q.y + r * 0.2, r * 1.1, r * 0.4, 0, 0, 6.2832); c.fill();
      c.fillStyle = L.rock[1]; c.beginPath(); c.ellipse(q.x, q.y - r * 0.3, r * 1.1, r * 0.7, 0, 0, 6.2832); c.fill();
      c.fillStyle = L.rock[0]; c.beginPath(); c.ellipse(q.x - r * 0.35, q.y - r * 0.55, r * 0.6, r * 0.35, 0, 0, 6.2832); c.fill();
    }
  }
}

/* A stretch of the path that's something else (ROAD.surfaces), drawn
   over the dirt, inside the path's edges: old flagstones, a mossy track,
   or a boardwalk - fading in and out at its ends, hazing far off. */
function surface(c, W, H, z, L, sf){
  const r0 = Math.max(-0.12, sf.d0 - z), r1 = Math.min(1.02, sf.d1 - z); if (r1 <= r0) return;
  const quad = (a0, a1, b0, b1, col) => { const p = [P(a0, b0, W, H), P(a1, b0, W, H), P(a1, b1, W, H), P(a0, b1, W, H)]; c.fillStyle = col; c.beginPath(); p.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fill(); };
  const fade = (rel) => surfaceAt(z + rel).k * (1 - Math.min(0.7 * FOG, Math.max(0, rel) * 0.8 * FOG));
  const HW = 1.6;
  if (sf.kind === 'trampled'){
    /* off the trail, where something huge came through: the ground
       flattened bare, pressed-down grass in patches, twigs and leaves
       scattered, and now and then a great round dent in the earth */
    const R = 0.05, first = Math.floor((z + r0 - sf.d0) / R);
    for (let k = first; ; k++){
      const d = sf.d0 + k * R, rel = d - z; if (rel > r1) break; if (rel + R < r0) continue;
      const a = fade(rel + R / 2); if (a <= 0.02) continue;
      quad(-HW, HW, rel, rel + R, rgba(mix('#7d6448', L.path[1], 0.15 + 0.2 * hash(k + 5300)), 0.95 * a));
      for (let j = 0; j < 4; j++){
        const h = hash(k * 7 + j + 5310), lane = (h * 2 - 1) * HW * 0.9, q = P(lane, rel + R * hash(k + j + 5320), W, H);
        if (h < 0.3){ c.fillStyle = rgba(mix(L.grass[1], '#6a7a50', 0.4), 0.7 * a); c.beginPath(); c.ellipse(q.x, q.y, H * 0.05 * q.k, H * 0.012 * q.k, 0, 0, 6.2832); c.fill(); }
        else if (h < 0.7){ c.strokeStyle = rgba('#5a4430', 0.8 * a); c.lineWidth = Math.max(1, H * 0.004 * q.k); c.beginPath(); c.moveTo(q.x - H * 0.02 * q.k, q.y); c.lineTo(q.x + H * 0.02 * q.k, q.y - H * 0.004 * q.k); c.stroke(); }
        else if (h > 0.96){ c.fillStyle = rgba('#5e4a38', 0.45 * a); c.beginPath(); c.ellipse(q.x, q.y, H * 0.11 * q.k, H * 0.025 * q.k, 0, 0, 6.2832); c.fill(); }
      }
    }
    return;
  }
  if (sf.kind === 'flag'){
    /* rows of old stones, the joints between offset row to row, moss in some */
    const R = 0.055, first = Math.floor((z + r0 - sf.d0) / R);
    for (let k = first; ; k++){
      const d = sf.d0 + k * R, rel = d - z; if (rel > r1) break; if (rel + R < r0) continue;
      const a = fade(rel + R / 2); if (a <= 0.02) continue;
      const off = (k % 2) * 0.25;
      for (let ln = -HW - off; ln < HW; ln += 0.5){
        const shade = hash(k * 13 + Math.round(ln * 4) + 5000);
        quad(ln + 0.025, ln + 0.475, rel + 0.004, rel + R - 0.004, rgba(mix('#b8b2cc', '#8e88a8', shade), 0.95 * a));
        if (shade < 0.25) quad(ln + 0.06, ln + 0.22, rel + R * 0.55, rel + R - 0.006, rgba('#7fb07a', 0.55 * a));
      }
    }
    return;
  }
  if (sf.kind === 'boards'){
    /* planks across, on two runners, a post either side now and then */
    const R = 0.022, first = Math.floor((z + r0 - sf.d0) / R);
    for (let k = first; ; k++){
      const d = sf.d0 + k * R, rel = d - z; if (rel > r1) break; if (rel + R < r0) continue;
      const a = fade(rel + R / 2); if (a <= 0.02) continue;
      const shade = hash(k + 5100), wood = mix(mix(L.wood || '#c9a77a', L.path[0], 0.15), '#8a6a50', shade * 0.3);
      quad(-HW, HW, rel, rel + R, rgba(wood, 0.95 * a));
      quad(-HW, HW, rel + R - 0.003, rel + R, rgba('#3a2a30', 0.5 * a));
      if (k % 9 === 0) for (const sd of [-1, 1]){ const q = P(sd * (roadHalf(d) - 0.04), rel, W, H), w = H * 0.012 * q.k + 1, h = H * 0.05 * q.k; c.fillStyle = rgba('#6b4a2e', a); c.fillRect(q.x - w / 2, q.y - h, w, h); c.fillStyle = rgba('#8a6440', a); c.fillRect(q.x - w / 2, q.y - h, w, w * 0.6); }
    }
    return;
  }
  /* moss: a soft green track, darker clumps */
  for (let k = 0; k < 40; k++){
    const rel = r0 + (r1 - r0) * hash(k + 5200); const a = fade(rel); if (a <= 0.02) continue;
    const ln = (hash(k + 5201) * 2 - 1) * 1.2, q = P(ln, rel, W, H), rr = H * (0.03 + hash(k + 5202) * 0.05) * q.k;
    c.fillStyle = rgba(mix(L.grass[1], L.ground[1], 0.4), 0.5 * a); c.beginPath(); c.ellipse(q.x, q.y, rr * 2, rr * 0.5, 0, 0, 6.2832); c.fill();
  }
  quad(-HW, HW, r0, r1, rgba(L.grass[1], 0.28));
}

/* Little things lying on the dirt path, to the sides: fallen leaves
   (pink and amber - the trees here are odd), small puddles with the sky
   in them, cracks, a glowing seed-pod now and then. Flat on the ground,
   low-key: never mistaken for something to dodge or catch. */
function pathBits(c, W, H, z, L){
  for (let n = 0; n < 60; n++){
    const rel = along(n + 0.6, 1.0, 60, z); if (rel == null || surfaceAt(z + rel).kind !== 'dirt') continue;
    const side = hash(n + 5300) < 0.5 ? -1 : 1, lane = side * (0.6 + hash(n + 5301) * 0.45), q = P(lane, rel, W, H), k = q.k;
    const haze = Math.min(0.7 * FOG, Math.max(0, rel) * 0.9 * FOG), kind = hash(n + 5302);
    if (kind < 0.4){
      /* a leaf */
      const l = H * 0.0075 * k + 1, a = hash(n + 5303) * 6.28;
      c.fillStyle = rgba(mix(['#d9a25e', '#c98a6a', '#b8a05a'][n % 3], L.haze, haze), 0.85);
      c.save(); c.translate(q.x, q.y); c.scale(1, 0.45); c.rotate(a); c.beginPath(); c.moveTo(-l, 0); c.quadraticCurveTo(0, -l * 0.55, l, 0); c.quadraticCurveTo(0, l * 0.55, -l, 0); c.fill(); c.restore();
    } else if (kind < 0.6){
      /* a puddle, the sky in it */
      const w = H * (0.03 + hash(n + 5304) * 0.03) * k + 2;
      c.fillStyle = rgba(mix(L.path[1], '#3a3050', 0.25), 0.6); c.beginPath(); c.ellipse(q.x, q.y, w * 1.08, w * 0.3, 0, 0, 6.2832); c.fill();
      c.fillStyle = rgba(mix(mix(L.sky[1], L.path[1], 0.55), L.haze, haze), 0.55); c.beginPath(); c.ellipse(q.x, q.y, w, w * 0.25, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.ellipse(q.x - w * 0.3, q.y - w * 0.06, w * 0.3, w * 0.035, 0, 0, 6.2832); c.fill();
    } else if (kind < 0.85){
      /* a crack */
      const w = H * 0.03 * k + 2;
      c.strokeStyle = rgba(mix(L.path[1], '#2a2040', 0.4), 0.55 * (1 - haze)); c.lineWidth = Math.max(1, H * 0.002 * k);
      c.beginPath(); c.moveTo(q.x - w, q.y); c.lineTo(q.x - w * 0.3, q.y + w * 0.08); c.lineTo(q.x + w * 0.2, q.y - w * 0.05); c.lineTo(q.x + w, q.y + w * 0.06); c.moveTo(q.x - w * 0.3, q.y + w * 0.08); c.lineTo(q.x - w * 0.2, q.y + w * 0.2); c.stroke();
    } else {
      /* a glowing seed-pod */
      const r = H * 0.005 * k + 1;
      glow(c, q.x, q.y - r, r * 4, L.glow, 0.5 * (1 - haze)); c.fillStyle = mix(L.glow, '#ffffff', 0.4); c.beginPath(); c.ellipse(q.x, q.y - r, r * 1.2, r, 0, 0, 6.2832); c.fill();
    }
  }
}

/* Far off, on the ridge across the land: a long line of woods, and
   something huge pushing through it, unseen - the treetops near it
   shaking, some leaning and falling as it passes, birds bursting up, a
   haze of dust. u: how far along it's got (0..1, left to right); t: time.
   (Drawn behind the land: the trees' feet in the ground's edge.) */
export function farStir(c, W, H, hy, t, u, L, path = false){
  const px = W * (0.42 + 0.62 * u), y0 = hy + H * 0.03;
  c.save();
  /* (path: the swathe it's cut behind it, a strip of bare earth through
     the trees, fallen trunks along it - the way it's gone) */
  if (path && px > W * 0.3){
    c.fillStyle = mix('#a8906c', L.haze, 0.35);
    c.beginPath(); c.moveTo(W * 0.28, y0 + H * 0.002);
    for (let x = W * 0.28; x <= px; x += W * 0.01) c.lineTo(x, y0 - H * (0.004 + 0.002 * Math.sin(x * 0.05)));
    c.lineTo(px, y0 + H * 0.004); c.lineTo(W * 0.28, y0 + H * 0.005); c.closePath(); c.fill();
  }
  /* dust, rising off where it's been */
  for (let k = 0; k < 7; k++){ const a = (t * 0.25 + k / 7) % 1, x = px - W * (0.01 + a * 0.06) + Math.sin(k * 3) * W * 0.01; glow(c, x, y0 - H * (0.02 + a * 0.06), H * (0.04 + a * 0.05), '#d4ccb8', 0.45 * (1 - a)); }
  for (let i = 0; i < 46; i++){
    const tx = W * (0.28 + i * 0.019 + (hash(i + 7700) - 0.5) * 0.01), h = H * (0.06 + hash(i + 7701) * 0.04), d = (tx - px) / W;
    /* near it: shaking; passed it: some leaning over, fallen */
    let rot = 0;
    if (Math.abs(d) < 0.05) rot = Math.sin(t * 15 + i) * 0.28 * (1 - Math.abs(d) / 0.05);
    if (d < -0.01 && hash(i + 7702) < 0.35) rot = Math.min(1.35, (-d - 0.01) * 40) * (hash(i + 7703) < 0.5 ? 1 : -1);
    c.save(); c.translate(tx, y0); c.rotate(rot);
    c.fillStyle = mix(L.tree[0], L.haze, 0.4); c.beginPath(); c.moveTo(0, -h); c.lineTo(-h * 0.28, 0); c.lineTo(h * 0.28, 0); c.closePath(); c.fill();
    c.fillStyle = mix(L.tree[1], L.haze, 0.45); c.beginPath(); c.moveTo(0, -h); c.lineTo(h * 0.28, 0); c.lineTo(0, 0); c.closePath(); c.fill();
    c.restore();
  }
  /* birds, bursting up out of the trees ahead of it, and flapping away */
  c.strokeStyle = mix('#3a3450', L.haze, 0.3); c.lineWidth = Math.max(1.5, H * 0.003); c.lineCap = 'round';
  for (let k = 0; k < 9; k++){
    const a = (t * 0.35 + k / 9) % 1, bx = px + W * (0.01 + (hash(k + 7710) - 0.3) * 0.05) + a * W * (0.03 + hash(k + 7711) * 0.04), by = y0 - H * (0.07 + a * 0.16 * (0.6 + hash(k + 7712))), w = H * 0.011 * (1 - a * 0.3), f = Math.sin(t * 12 + k) * 0.6;
    c.globalAlpha = Math.min(1, (1 - a) * 2); c.beginPath(); c.moveTo(bx - w, by - w * f); c.quadraticCurveTo(bx - w * 0.4, by - w * 0.2, bx, by); c.quadraticCurveTo(bx + w * 0.4, by - w * 0.2, bx + w, by - w * f); c.stroke();
  }
  c.restore();
}

/* The far ridge, close up - the camera at the pond, looking away off
   across the valley, as through a long lens: the sky, the mountains
   behind, the forest along the ridge, and something huge pushing through
   it, unseen - trees shaking, falling one after another, birds bursting
   up, dust, the bare path it's cutting through the woods (farStir, big).
   u: how far along it's got (0..1). */
export function worldFarRidge(c, W, H, t, u, L){
  c.save();
  const sky = c.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, L.sky[1]); sky.addColorStop(0.7, L.sky[2]); sky.addColorStop(1, L.sky[3]);
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  /* the sun, low on the left, through the haze */
  glow(c, W * 0.12, H * 0.22, H * 0.35, L.sun || '#fff0dc', 0.5);
  /* mountains behind: faceted, lit on their left faces, the far range paler */
  for (const [base, amp, haze, n, seed] of [[0.4, 0.16, 0.55, 6, 3], [0.5, 0.12, 0.3, 8, 7]]){
    const pts = []; for (let k = 0; k <= n; k++) pts.push([W * (k / n) + (hash(k + seed * 31) - 0.5) * W * 0.05, H * (base - amp * (0.4 + 0.6 * hash(k + seed * 17)) * (k % 2 ? 1 : 0.55))]);
    c.fillStyle = mix(L.hillDark, L.haze, haze); c.beginPath(); c.moveTo(0, H); pts.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(W, H); c.closePath(); c.fill();
    c.fillStyle = mix(L.hillLit, L.haze, haze);
    for (let k = 0; k < n; k += 2){ const [x0, y0] = pts[k], [x1, y1] = pts[k + 1]; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x1 - W * 0.02, H * base + H * 0.04); c.lineTo(x0, H * base + H * 0.04); c.closePath(); c.fill(); }
  }
  /* the ridge: the slope's ground, and the woods on it, three rows deep */
  const ry = H * 0.62;
  c.fillStyle = mix(L.ground[0], L.haze, 0.35); c.fillRect(0, ry - H * 0.02, W, H);
  c.fillStyle = mix(L.ground[1], L.haze, 0.25); c.fillRect(0, H * 0.78, W, H);
  /* where it is: moving left to right along the ridge, behind the front row */
  const px = W * (0.18 + 0.7 * u), bob = Math.abs(Math.sin(t * 2.2)) * H * 0.006;
  /* the bare earth it's leaving, a swathe through the woods behind it */
  if (u > 0.02){ c.fillStyle = mix('#a8906c', L.haze, 0.3); c.beginPath(); c.moveTo(W * 0.12, ry + H * 0.01); c.lineTo(px, ry); c.lineTo(px, ry + H * 0.03); c.lineTo(W * 0.12, ry + H * 0.035); c.closePath(); c.fill(); }
  const row = (y, s, haze, n, seed, near) => {
    for (let k = 0; k < n; k++){
      const x = W * ((k + 0.5) / n) + (hash(k + seed) - 0.5) * W / n * 0.8, d = (x - px) / W;
      /* near it: shaking; passed by it: pushed over, lying flat; well behind it on the swathe: gone */
      let rot = 0;
      if (Math.abs(d) < 0.06) rot = Math.sin(t * 16 + k) * 0.22 * (1 - Math.abs(d) / 0.06);
      if (d < -0.02 && !near){ const f = Math.min(1, (-d - 0.02) * 18); rot = f * 1.45 * (hash(k + seed + 1) < 0.5 ? 1 : -1); }
      if (d < -0.02 && near && hash(k + seed + 2) < 0.4) rot = Math.min(1.4, (-d - 0.02) * 18) * (hash(k + seed + 1) < 0.5 ? 1 : -1);
      c.save(); c.translate(x, y); c.rotate(rot);
      treeKind(c, 0, 0, s * (0.8 + 0.4 * hash(k + seed + 3)), kindOf(k + seed), L, haze, k + seed);
      c.restore();
    }
  };
  row(ry - H * 0.03, H * 0.00016, 0.55, 26, 9100, false);
  row(ry - H * 0.012, H * 0.0002, 0.48, 22, 9200, false);
  /* it: a huge back, glimpsed between the trunks - dark in the haze, never all of it */
  if (u > 0 && u < 1.05){
    c.fillStyle = mix('#3a3456', L.haze, 0.45);
    c.beginPath(); c.ellipse(px, ry - H * 0.06 - bob, H * 0.16, H * 0.085, 0, Math.PI, 0); c.fill();
    c.fillStyle = mix('#55507a', L.haze, 0.45);
    c.beginPath(); c.ellipse(px - H * 0.04, ry - H * 0.1 - bob, H * 0.09, H * 0.035, -0.15, Math.PI, 0); c.fill();
  }
  row(ry + H * 0.012, H * 0.00026, 0.38, 18, 9300, true);
  /* dust, rolling up off where it's going - soft flat puffs */
  for (let k = 0; k < 9; k++){
    const a = (t * 0.22 + k / 9) % 1, x = px - W * (0.02 + a * 0.08) + Math.sin(k * 3) * W * 0.015, y = ry - H * (0.02 + a * 0.1), r = H * (0.03 + a * 0.05);
    c.fillStyle = rgba('#d8cfc0', 0.5 * (1 - a)); circ(c, x, y, r); c.fillStyle = rgba('#efe8dc', 0.35 * (1 - a)); circ(c, x - r * 0.3, y - r * 0.3, r * 0.6);
  }
  /* birds bursting up out of the trees ahead of it */
  c.strokeStyle = mix('#3a3450', L.haze, 0.3); c.lineWidth = Math.max(1.5, H * 0.003); c.lineCap = 'round';
  for (let k = 0; k < 12; k++){
    const a = (t * 0.35 + k / 12) % 1, bx = px + W * (0.02 + (hash(k + 7710) - 0.3) * 0.06) + a * W * (0.04 + hash(k + 7711) * 0.05), by = ry - H * (0.12 + a * 0.22 * (0.6 + hash(k + 7712))), w = H * 0.012 * (1 - a * 0.3), f = Math.sin(t * 12 + k) * 0.6;
    c.globalAlpha = Math.min(1, (1 - a) * 2); c.beginPath(); c.moveTo(bx - w, by - w * f); c.quadraticCurveTo(bx - w * 0.4, by - w * 0.2, bx, by); c.quadraticCurveTo(bx + w * 0.4, by - w * 0.2, bx + w, by - w * f); c.stroke();
  }
  c.globalAlpha = 1;
  /* nearer, lower down: treetops out of focus, framing it */
  for (let k = 0; k < 14; k++){ const x = W * (k / 13) + (hash(k + 8900) - 0.5) * W * 0.04, r = H * (0.08 + 0.05 * hash(k + 8901)); c.fillStyle = mix(L.tree[k % 2], L.haze, 0.15); circ(c, x, H * 1.0, r); c.fillStyle = mix(L.tree[(k + 1) % 2], L.haze, 0.1); circ(c, x - r * 0.25, H * 0.99 - r * 0.25, r * 0.6); }
  /* the edges darkened a little: a lens */
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.65); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,20,30,.35)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
  c.restore();
}

/* Signs of something huge having come through the woods, beside the path
   (lane, rel): the ground flattened in a broad swathe, trees snapped -
   stumps with splintered tops, trunks lying where they fell. */
export function worldTrail(c, W, H, lane, rel, L){
  const p = P(lane, rel, W, H); if (p.x < -W * 0.6 || p.x > W * 1.6) return;
  const haze = Math.min(0.6 * FOG, Math.max(0, rel) * 0.8 * FOG);
  /* the flattened swathe, running away from the path */
  const q0 = P(lane - Math.sign(lane) * 0.4, rel - 0.06, W, H), q1 = P(lane + Math.sign(lane) * 2.4, rel + 0.12, W, H);
  c.save();
  c.fillStyle = mix(mix(L.ground[2], '#6a7a48', 0.35), L.haze, haze); c.globalAlpha = 0.7;
  c.beginPath(); c.moveTo(q0.x, q0.y + H * 0.02 * q0.k); c.quadraticCurveTo((q0.x + q1.x) / 2, (q0.y + q1.y) / 2 + H * 0.03 * p.k, q1.x, q1.y); c.lineTo(q1.x, q1.y - H * 0.01 * q1.k); c.quadraticCurveTo((q0.x + q1.x) / 2, (q0.y + q1.y) / 2 - H * 0.02 * p.k, q0.x, q0.y - H * 0.02 * q0.k); c.closePath(); c.fill();
  /* flattened grass, all lying the same way */
  c.globalAlpha = 0.6; c.strokeStyle = mix(L.grass[0], L.haze, haze); c.lineWidth = Math.max(1, H * 0.002 * p.k);
  for (let k = 0; k < 18; k++){ const u = k / 17, x = q0.x + (q1.x - q0.x) * u + Math.sin(k * 7) * W * 0.01 * p.k, y = q0.y + (q1.y - q0.y) * u + Math.cos(k * 5) * H * 0.008 * p.k; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sign(lane) * W * 0.02 * p.k, y - H * 0.003 * p.k); c.stroke(); }
  c.restore();
  /* stumps, splintered */
  for (const [dl, dr] of [[0.5, 0.0], [1.6, 0.06], [-0.2, 0.08]]){
    const q = P(lane + Math.sign(lane) * dl, rel + dr, W, H), w = H * 0.03 * q.k + 1, h = H * 0.06 * q.k;
    c.fillStyle = mix(L.trunk[0], L.haze, haze); c.beginPath(); c.moveTo(q.x - w, q.y); c.lineTo(q.x - w, q.y - h * 0.7); c.lineTo(q.x - w * 0.5, q.y - h); c.lineTo(q.x - w * 0.1, q.y - h * 0.65); c.lineTo(q.x + w * 0.3, q.y - h * 1.1); c.lineTo(q.x + w, q.y - h * 0.6); c.lineTo(q.x + w, q.y); c.closePath(); c.fill();
    c.fillStyle = mix('#e8d0a8', L.haze, haze); c.beginPath(); c.moveTo(q.x - w * 0.5, q.y - h); c.lineTo(q.x - w * 0.1, q.y - h * 0.65); c.lineTo(q.x + w * 0.3, q.y - h * 1.1); c.lineTo(q.x + w * 0.2, q.y - h * 0.75); c.closePath(); c.fill();
  }
  /* trunks, lying where they fell - pushed over, away from the path */
  for (const [dl, dr, len, a] of [[0.9, 0.02, 0.9, 0.15], [1.9, 0.09, 1.1, -0.1], [0.2, 0.1, 0.8, 0.3]]){
    const qa = P(lane + Math.sign(lane) * dl, rel + dr, W, H), qb = P(lane + Math.sign(lane) * (dl + len), rel + dr + a * 0.1, W, H), r = H * 0.02 * qa.k + 1;
    const bark = mix(mix(L.wood || '#c9a77a', '#5a3a2a', 0.45), L.haze, haze), barkD = mix('#4a3020', L.haze, haze);
    /* its crown, crushed, leaves scattered, at the far end */
    const dir = Math.sign(qb.x - qa.x) || 1;
    for (const [dx, dy, rr, col] of [[0.5, -1.4, 2.4, L.tree[1]], [2.2, -0.8, 2.6, L.tree[1]], [1.2, -2.2, 2.2, L.tree[0]], [3.4, -1.6, 2, L.tree[0]], [1.8, -0.4, 1.8, L.grass[0]]]){
      c.fillStyle = mix(col, L.haze, haze); c.beginPath(); c.ellipse(qb.x + dir * dx * r, qb.y + dy * r, rr * r, rr * r * 0.7, 0, 0, 6.2832); c.fill();
    }
    /* the trunk, a few snapped branches */
    c.strokeStyle = barkD; c.lineWidth = r * 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(qa.x, qa.y - r); c.lineTo(qb.x, qb.y - r * 0.7); c.stroke();
    c.strokeStyle = bark; c.lineWidth = r * 1.6; c.stroke();
    c.strokeStyle = barkD; c.lineWidth = Math.max(1, r * 0.5);
    for (const f of [0.35, 0.6, 0.8]){ const bx = qa.x + (qb.x - qa.x) * f, by = qa.y + (qb.y - qa.y) * f - r; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + dir * r * 0.8, by - r * 1.8); c.stroke(); }
    /* the splintered end, pale */
    c.fillStyle = mix('#e8d0a8', L.haze, haze); c.beginPath(); c.ellipse(qa.x, qa.y - r, r * 0.55, r * 0.85, 0, 0, 6.2832); c.fill();
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
    for (const side of [-1, 1]){
      const lane = side * (1.8 + hash(n * 2 + (side > 0 ? 1 : 0)) * 1.6);
      if (CLEAR.some(q => Math.abs(lane - q.lane) < q.r + 0.9 && Math.abs(rel + z - q.d) < (q.depth ?? q.r * 0.3 + 0.12))) continue;
      if (Math.abs(lane) < roadHalf(rel + z) + 0.45 || inRavine(rel + z, 0.05)) continue;
      list.push({ rel, lane, n, side });
    }
  }
  list.sort((a, b) => b.rel - a.rel);
  for (const tr of list) tree(c, W, H, tr.lane, tr.rel, L, tr.n);
}

/* A stretch of the view kept clear of trees (screen x0..x1): the line of
   sight to something far off (lkp-game.js: the pond, looking to the far
   woods). */
export const SIGHT = { on: false, x0: 0, x1: 0 };
export function tree(c, W, H, lane, rel, L, n = 0){
  const p = P(lane, rel, W, H), s = H * 0.0011 * p.k * (0.85 + hash(n + 300) * 0.4), haze = Math.min(0.7 * FOG, Math.max(0, rel) * 0.9 * FOG);
  if (SIGHT.on && rel > 0.25 && p.x > SIGHT.x0 && p.x < SIGHT.x1) return;
  if (p.x < -200 * s * 3 - SKY.wide || p.x > W + 200 * s * 3) return;
  cast(c, p.x, p.y, 26 * s, 380 * s);
  treeKind(c, p.x, p.y, s, kindOf(n), L, haze, n);
  if (hash(n + 301) < 0.4){
    const bx = p.x - 130 * s; c.strokeStyle = mix('#6b5b8a', L.haze, haze); c.lineWidth = 6 * s;
    c.beginPath(); c.moveTo(bx, p.y); c.quadraticCurveTo(bx - 30 * s, p.y - 110 * s, bx - 6 * s, p.y - 200 * s); c.stroke();
    glow(c, bx - 6 * s, p.y - 210 * s, 60 * s + 4, L.bulb, 0.9); c.fillStyle = mix(L.bulb, '#ffffff', 0.5); circ(c, bx - 6 * s, p.y - 210 * s, 16 * s + 1);
  }
}

/* The kinds of tree, so the woods aren't all one - and it's another
   planet, so some aren't like ours: faceted pines, tall firs, round
   broadleaf trees, pale birches, pink blossom trees, low bushes; and
   mushroom-capped trees with glowing spots, curling spiral trees,
   stalks of floating balloon-pods, branching coral fronds, and umbrella
   trees trailing glowing strands - which, for tree number n. */
export const TREE_KINDS = ['pine', 'fir', 'round', 'blossom', 'puff', 'spiral', 'pine', 'balloon', 'coral', 'umbrella', 'round', 'birch', 'puff', 'bush', 'pine', 'coral'];
export const kindOf = (n) => TREE_KINDS[Math.floor(hash(n + 302) * TREE_KINDS.length) % TREE_KINDS.length];
/* A tree of a kind, its foot at (x, y), s its scale (about 620 s tall). */
export function treeKind(c, x, y, s, kind, L, haze = 0, n = 0){
  const col = (k) => mix(k, L.haze, haze), sway = 0;
  c.fillStyle = 'rgba(20,15,45,.4)'; c.beginPath(); c.ellipse(x, y, (kind === 'bush' ? 90 : 70) * s, 16 * s, 0, 0, 6.2832); c.fill();
  const trunk = (h, w = 18, a = L.trunk[0], b = L.trunk[1]) => { c.fillStyle = col(a); c.fillRect(x - w / 2 * s, y - h * s, w * s, h * s); c.fillStyle = col(b); c.fillRect(x - w / 2 * s, y - h * s, w / 3 * s, h * s); };
  /* a soft round clump of leaves: dark under, light on top */
  const clump = (cx, cy, r, dark, light) => {
    c.fillStyle = col(dark); c.beginPath(); c.arc(x + cx * s, y + cy * s, r * s, 0, 6.2832); c.fill();
    c.fillStyle = col(light); c.beginPath(); c.arc(x + (cx - r * 0.18) * s, y + (cy - r * 0.2) * s, r * 0.78 * s, 0, 6.2832); c.fill();
  };
  if (kind === 'pine' || kind === 'fir'){
    const tiers = kind === 'fir' ? [[80, -380, -150], [66, -500, -300], [52, -610, -430], [36, -700, -550], [20, -760, -660]] : [[120, -360, -150], [98, -470, -270], [70, -560, -390], [40, -620, -500]];
    trunk(160);
    const dark = kind === 'fir' ? mix(L.tree[0], '#1c3a30', 0.35) : L.tree[0], light = kind === 'fir' ? mix(L.tree[1], '#2a5a48', 0.3) : L.tree[1];
    for (const [w, top, bot] of tiers){
      c.fillStyle = col(dark); c.beginPath(); c.moveTo(x, y + top * s); c.lineTo(x - w * s, y + bot * s); c.lineTo(x + 6 * s, y + (bot + 18) * s); c.fill();
      c.fillStyle = col(light); c.beginPath(); c.moveTo(x, y + top * s); c.lineTo(x + w * s, y + bot * s); c.lineTo(x + 6 * s, y + (bot + 18) * s); c.fill();
      c.strokeStyle = rgba(L.rim, 0.55 * (1 - haze)); c.lineWidth = 2 * s + 0.5; c.beginPath(); c.moveTo(x, y + top * s); c.lineTo(x - w * s, y + bot * s); c.stroke();
    }
    return;
  }
  if (kind === 'round'){
    trunk(230, 22);
    clump(-70, -300, 95, '#3f7a4e', '#5f9e5c'); clump(70, -310, 90, '#3f7a4e', '#5f9e5c'); clump(0, -400, 115, '#4a8a55', '#74b46a');
    return;
  }
  if (kind === 'birch'){
    trunk(330, 16, '#e8e4dc', '#c9c2b6');
    c.fillStyle = col('#3a3530'); for (let k = 0; k < 6; k++) c.fillRect(x - 8 * s + (k % 2) * 6 * s, y - (60 + k * 45) * s, 9 * s, 4 * s);
    for (const [cx, cy, r] of [[-40, -360, 70], [40, -390, 72], [0, -460, 80]]) clump(cx, cy, r, '#7aa84e', '#a8d070');
    return;
  }
  if (kind === 'blossom'){
    trunk(200, 20);
    for (const [cx, cy, r] of [[-70, -270, 80], [70, -280, 78], [0, -360, 100]]) clump(cx, cy, r, '#d47a9a', '#f2a6bf');
    c.fillStyle = col('#ffe0ea'); for (let k = 0; k < 9; k++) circ(c, x + (hash(n * 9 + k) - 0.5) * 220 * s, y - (240 + hash(n * 7 + k) * 180) * s, 7 * s + 0.5);
    return;
  }
  if (kind === 'puff'){
    /* a mushroom tree: a pale fat stalk, a great domed cap, glowing spots */
    c.fillStyle = col('#efe2cf'); c.beginPath(); c.moveTo(x - 26 * s, y); c.quadraticCurveTo(x - 14 * s, y - 200 * s, x - 30 * s, y - 330 * s); c.lineTo(x + 30 * s, y - 330 * s); c.quadraticCurveTo(x + 14 * s, y - 200 * s, x + 26 * s, y); c.fill();
    c.fillStyle = col('#a24a8a'); c.beginPath(); c.ellipse(x, y - 330 * s, 170 * s, 120 * s, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = col('#c868a8'); c.beginPath(); c.ellipse(x - 20 * s, y - 360 * s, 120 * s, 80 * s, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = col('#7a3068'); c.fillRect(x - 170 * s, y - 334 * s, 340 * s, 10 * s);
    for (const [dx, dy] of [[-90, -360], [-30, -410], [50, -380], [110, -350], [0, -350]]){ glow(c, x + dx * s, y + dy * s, 26 * s + 2, L.bulb, 0.8 * (1 - haze)); c.fillStyle = col('#fff6c0'); circ(c, x + dx * s, y + dy * s, 9 * s + 0.5); }
    return;
  }
  if (kind === 'spiral'){
    /* a curling tree: a twisting trunk ending in a spiral of leaves */
    c.strokeStyle = col(L.trunk[0]); c.lineWidth = 20 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x - 60 * s, y - 150 * s, x + 70 * s, y - 260 * s, x, y - 380 * s); c.stroke();
    c.strokeStyle = col('#3fa08a'); c.lineWidth = 34 * s;
    c.beginPath(); for (let k = 0; k <= 40; k++){ const a = k / 40 * Math.PI * 3.4, r = (120 - k * 2.6) * s; const px = x + Math.cos(a) * r, py = y - 470 * s + Math.sin(a) * r * 0.8; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
    c.strokeStyle = col('#7fe0b8'); c.lineWidth = 12 * s; c.stroke();
    return;
  }
  if (kind === 'balloon'){
    /* thin stalks, each with a round floating pod at the top, glowing */
    for (const [dx, h, r, colr] of [[-50, 420, 60, '#ffb35c'], [30, 520, 72, '#ff8a6a'], [80, 360, 48, '#ffd27a']]){
      c.strokeStyle = col('#6b8a5a'); c.lineWidth = 7 * s; c.beginPath(); c.moveTo(x + dx * 0.3 * s, y); c.quadraticCurveTo(x + dx * 0.8 * s, y - h * 0.5 * s, x + dx * s, y - h * s); c.stroke();
      glow(c, x + dx * s, y - (h + r * 0.6) * s, r * 1.8 * s, colr, 0.5 * (1 - haze));
      c.fillStyle = col(colr); c.beginPath(); c.ellipse(x + dx * s, y - (h + r * 0.6) * s, r * 0.8 * s, r * s, 0, 0, 6.2832); c.fill();
      c.fillStyle = col('#fff2d0'); c.beginPath(); c.ellipse(x + (dx - r * 0.25) * s, y - (h + r * 0.95) * s, r * 0.22 * s, r * 0.3 * s, -0.4, 0, 6.2832); c.fill();
    }
    return;
  }
  if (kind === 'coral'){
    /* branching fronds, like coral on land: teal and violet */
    c.lineCap = 'round';
    const branch = (bx, by, a, len, w, d) => {
      const ex = bx + Math.sin(a) * len, ey = by - Math.cos(a) * len;
      c.strokeStyle = col(d % 2 ? '#8a6ad8' : '#3fb8b0'); c.lineWidth = w; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
      if (d < 3){ branch(ex, ey, a - 0.45, len * 0.72, w * 0.7, d + 1); branch(ex, ey, a + 0.4, len * 0.7, w * 0.7, d + 1); }
      else { c.fillStyle = col('#c8b8ff'); circ(c, ex, ey, w * 0.9); }
    };
    branch(x, y, -0.15, 200 * s, 26 * s, 0); branch(x, y, 0.35, 150 * s, 20 * s, 1);
    return;
  }
  if (kind === 'umbrella'){
    /* a tall thin trunk, a flat wide canopy, glowing strands hanging down */
    trunk(420, 14, '#5a4a7a', '#7a6aa0');
    c.fillStyle = col('#2f8a7a'); c.beginPath(); c.ellipse(x, y - 430 * s, 210 * s, 55 * s, 0, 0, 6.2832); c.fill();
    c.fillStyle = col('#4fb8a0'); c.beginPath(); c.ellipse(x - 10 * s, y - 450 * s, 180 * s, 36 * s, 0, 0, 6.2832); c.fill();
    c.strokeStyle = col('#9ff0e0'); c.lineWidth = 3 * s + 0.5;
    for (let k = 0; k < 9; k++){ const sx = x + (k - 4) * 44 * s, len = (80 + hash(n * 11 + k) * 120) * s; c.beginPath(); c.moveTo(sx, y - 405 * s); c.quadraticCurveTo(sx + 10 * s, y - 405 * s + len * 0.5, sx, y - 405 * s + len); c.stroke(); glow(c, sx, y - 405 * s + len, 14 * s + 1, '#9ff0e0', 0.8 * (1 - haze)); }
    return;
  }
  /* a bush: low, round, a few berries */
  clump(-50, -70, 60, '#3f7a4e', '#5f9e5c'); clump(45, -65, 58, '#3f7a4e', '#5f9e5c'); clump(0, -110, 70, '#4a8a55', '#74b46a');
  c.fillStyle = col('#e05a6a'); for (let k = 0; k < 5; k++) circ(c, x + (hash(n * 5 + k) - 0.5) * 140 * s, y - (60 + hash(n * 3 + k) * 80) * s, 7 * s + 0.5);
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

/* A tree fallen across part of the path, a to b (lanes): its trunk lying
   along the ground, roots torn up at one end, its leafy crown sprawled at
   the other, a few broken branches sticking up. Lean round it. */
export function worldFallen(c, W, H, rel, a, b, L, seed = 0){
  const l = P(a, rel, W, H), r = P(b, rel, W, H), k = l.k, th = H * 0.13 * k, flip = hash(seed + 900) < 0.5;
  const [rx, cx] = flip ? [l.x, r.x] : [r.x, l.x];   /* roots, crown */
  const y = l.y;
  c.fillStyle = 'rgba(20,15,45,.3)'; c.beginPath(); c.ellipse((l.x + r.x) / 2, y, Math.abs(r.x - l.x) * 0.6, th * 0.3, 0, 0, 6.2832); c.fill();
  /* the crown: a sprawl of leaves where the top came down */
  for (let j = 0; j < 6; j++){ const ox = (cx - rx) * (0.05 + j * 0.03) * (j % 2 ? 1 : 0.6), oy = -th * (0.4 + (j % 3) * 0.35); c.fillStyle = mix(L.tree[j % 2], '#2a4a40', 0.2); c.beginPath(); c.arc(cx - ox * 0.3 + Math.sin(j * 2.1) * th * 0.6, y + oy, th * (0.9 + 0.2 * (j % 3)), 0, 6.2832); c.fill(); }
  /* the trunk */
  c.strokeStyle = L.trunk[0]; c.lineCap = 'round'; c.lineWidth = th * 0.9;
  c.beginPath(); c.moveTo(rx, y - th * 0.5); c.lineTo(cx, y - th * 0.55); c.stroke();
  c.strokeStyle = L.trunk[1]; c.lineWidth = th * 0.25; c.beginPath(); c.moveTo(rx, y - th * 0.75); c.lineTo(cx, y - th * 0.78); c.stroke();
  /* broken branches, sticking up */
  c.strokeStyle = L.trunk[0]; c.lineWidth = th * 0.22;
  for (let j = 1; j <= 3; j++){ const x = rx + (cx - rx) * (0.2 + j * 0.18); c.beginPath(); c.moveTo(x, y - th * 0.8); c.lineTo(x + (cx - rx) * 0.05, y - th * (1.6 + 0.3 * (j % 2))); c.stroke(); }
  /* the root plate, torn up: a disc of earth and roots, on end */
  c.fillStyle = '#6b5440'; c.beginPath(); c.ellipse(rx, y - th * 0.7, th * 0.35, th * 1.05, 0, 0, 6.2832); c.fill();
  c.strokeStyle = '#4a3a2c'; c.lineWidth = Math.max(1, th * 0.08);
  for (let j = 0; j < 6; j++){ const a2 = j / 6 * 6.2832; c.beginPath(); c.moveTo(rx, y - th * 0.7); c.lineTo(rx + Math.cos(a2) * th * 0.55, y - th * 0.7 + Math.sin(a2) * th * 1.3); c.stroke(); }
  c.strokeStyle = rgba(L.rim, 0.5); c.lineWidth = Math.max(1, th * 0.08); c.beginPath(); c.moveTo(rx, y - th * 0.95); c.lineTo(cx, y - th * 1.0); c.stroke();
}

/* A fallen trunk across the whole path at head height, propped on two
   boulders. Duck under it. */
export function worldBeam(c, W, H, rel, L){
  /* A fallen tree across the path at head height, resting on a mossy
     boulder at each side: duck under it. */
  const l = P(-PATH_HALF - 0.15, rel, W, H), r = P(PATH_HALF + 0.15, rel, W, H), k = l.k;
  const top = l.y - H * 0.36 * k, bot = l.y - H * 0.25 * k, th = bot - top, mid = (top + bot) / 2;
  /* its shadow, a soft band across the path under it */
  c.fillStyle = 'rgba(25,20,55,.22)'; c.beginPath(); c.ellipse((l.x + r.x) / 2, l.y + th * 0.1, (r.x - l.x) * 0.52, th * 0.45, 0, 0, 6.2832); c.fill();
  /* the rocks it rests on: a big boulder and a smaller one on it, at
     each side, from the ground up to its middle */
  const lump = (x, y, w, h, seed) => {
    const g = c.createLinearGradient(x - w, y - h, x + w * 0.6, y);
    g.addColorStop(0, mix(L.rock[0], '#ffffff', 0.1)); g.addColorStop(1, mix(L.rock[1], '#000000', 0.2));
    c.fillStyle = g; c.beginPath();
    for (let k = 0; k <= 16; k++){
      const a = Math.PI + k / 16 * Math.PI, f = 1 + 0.12 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5 + seed * 2);
      c.lineTo(x + Math.cos(a) * w * f, y + Math.sin(a) * h * f);
    }
    c.closePath(); c.fill();
    c.fillStyle = rgba(L.grass[0], 0.85); c.beginPath(); c.ellipse(x - w * 0.15, y - h * 0.92, w * 0.5, h * 0.18, -0.1, Math.PI, 0); c.fill();
  };
  for (const [x, sd] of [[l.x, 1], [r.x, 4]]){
    const h = l.y - mid, w = th * 1.35;
    c.fillStyle = 'rgba(25,20,55,.3)'; c.beginPath(); c.ellipse(x, l.y, w * 1.15, w * 0.25, 0, 0, 6.2832); c.fill();
    lump(x, l.y, w, h * 0.62, sd);
    lump(x + w * 0.1 * (sd > 2 ? -1 : 1), l.y - h * 0.55, w * 0.68, h * 0.47, sd + 2);
  }
  /* the trunk: round, lit from above, bark running along it */
  const x0 = l.x - th * 0.9, x1 = r.x + th * 0.9;
  const g = c.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, mix(L.trunk[1], '#ffffff', 0.25)); g.addColorStop(0.45, L.trunk[1]); g.addColorStop(1, mix(L.trunk[0], '#000000', 0.25));
  c.fillStyle = g; c.beginPath(); c.roundRect(x0, top, x1 - x0, th, th / 2); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = Math.max(1, th * 0.06); c.lineCap = 'round';
  for (let i = 0; i < 14; i++){
    const x = x0 + (x1 - x0) * (i + 0.5) / 14, y = top + th * (0.3 + 0.4 * hash(i + 610)), len = (x1 - x0) * (0.03 + 0.04 * hash(i + 611));
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y + th * 0.04); c.stroke();
  }
  /* a couple of leafy twigs still growing off it, and the cut end */
  for (const f of [0.27, 0.7]){
    const x = x0 + (x1 - x0) * f;
    c.strokeStyle = L.trunk[1]; c.lineWidth = Math.max(1, th * 0.12); c.beginPath(); c.moveTo(x, top + th * 0.2); c.quadraticCurveTo(x + th * 0.2, top - th * 0.3, x + th * 0.55, top - th * 0.5); c.stroke();
    for (let k = 0; k < 4; k++){ c.fillStyle = L.grass[k % 2]; c.beginPath(); c.ellipse(x + th * (0.35 + 0.15 * k), top - th * (0.35 + 0.1 * (k % 2)), th * 0.2, th * 0.1, -0.5 + k * 0.4, 0, 6.2832); c.fill(); }
  }
  c.fillStyle = L.wood; c.beginPath(); c.ellipse(x1 - th * 0.12, mid, th * 0.2, th * 0.47, 0, 0, 6.2832); c.fill();
  c.strokeStyle = mix(L.wood, L.trunk[0], 0.45); c.lineWidth = Math.max(1, th * 0.04);
  c.beginPath(); c.ellipse(x1 - th * 0.12, mid, th * 0.1, th * 0.26, 0, 0, 6.2832); c.stroke();
  /* moss along the top, and a few leafy strands hanging down */
  c.fillStyle = rgba(L.grass[0], 0.95);
  for (let i = 0; i < 9; i++){ const x = x0 + (x1 - x0) * (0.08 + 0.84 * hash(i + 620)); c.beginPath(); c.ellipse(x, top + th * 0.08, (x1 - x0) * 0.04, th * 0.16, 0, Math.PI, 0); c.fill(); }
  c.strokeStyle = rgba(L.grass[1], 0.9); c.lineWidth = Math.max(1, th * 0.07);
  for (let i = 0; i < 7; i++){
    const x = x0 + (x1 - x0) * (0.12 + 0.76 * hash(i + 630)), len = th * (0.5 + 0.7 * hash(i + 631));
    c.beginPath(); c.moveTo(x, bot - th * 0.1); c.quadraticCurveTo(x + th * 0.15, bot + len * 0.5, x - th * 0.05, bot + len); c.stroke();
    c.fillStyle = L.grass[0]; c.beginPath(); c.ellipse(x - th * 0.05, bot + len, th * 0.1, th * 0.06, 0.5, 0, 6.2832); c.fill();
  }
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

/* A log rolling across the path at lane, rel, turned `spin` radians:
   seen end on - its cut end towards us, rings in it, the bark running
   back - and dust kicked up beside it. */
export function worldLog(c, W, H, lane, rel, L, spin = 0){
  /* A round log, lying along the path and rolling across it: its cut end
     towards us, the bark running back to its far end. */
  const LEN = 0.13, R = 0.075;
  const p = P(lane, rel, W, H), r = H * R * p.k, b = P(lane, rel + LEN, W, H), rb = H * R * b.k;
  const n0 = { x: p.x, y: p.y - r }, n1 = { x: b.x, y: b.y - rb };
  /* the shadow under it, along its length */
  c.fillStyle = 'rgba(20,15,40,.35)'; c.beginPath(); c.moveTo(p.x - r * 1.1, p.y); c.lineTo(b.x - rb, b.y); c.lineTo(b.x + rb, b.y); c.lineTo(p.x + r * 1.1, p.y); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(p.x, p.y, r * 1.1, r * 0.22, 0, 0, 6.2832); c.fill();
  /* the body: the two ends, and the sides between (their outline as one) */
  const dx = n1.x - n0.x, dy = n1.y - n0.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  const g = c.createLinearGradient(n0.x - r, 0, n0.x + r, 0); g.addColorStop(0, mix(L.trunk[1], '#ffffff', 0.15)); g.addColorStop(0.6, L.trunk[1]); g.addColorStop(1, L.trunk[0]);
  c.fillStyle = g;
  circ(c, n1.x, n1.y, rb);
  c.beginPath(); c.moveTo(n0.x + nx * r, n0.y + ny * r); c.lineTo(n1.x + nx * rb, n1.y + ny * rb); c.lineTo(n1.x - nx * rb, n1.y - ny * rb); c.lineTo(n0.x - nx * r, n0.y - ny * r); c.closePath(); c.fill();
  /* the bark: lines running along it, turning with it */
  c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = Math.max(1, r * 0.06);
  for (let k = 0; k < 6; k++){
    const a = spin + k * 1.047, cs = Math.cos(a); if (Math.sin(a) > 0.2) continue;
    c.beginPath(); c.moveTo(n0.x + cs * r * 0.95, n0.y + Math.sin(a) * r * 0.95); c.lineTo(n1.x + cs * rb * 0.95, n1.y + Math.sin(a) * rb * 0.95); c.stroke();
  }
  /* the cut end: rings, turning */
  c.fillStyle = L.wood; circ(c, n0.x, n0.y, r);
  c.strokeStyle = mix(L.wood, L.trunk[0], 0.45); c.lineWidth = Math.max(1, r * 0.07);
  for (const k of [0.75, 0.5, 0.27]){ c.beginPath(); c.arc(n0.x, n0.y, r * k, spin, spin + 5.2); c.stroke(); }
  c.strokeStyle = L.trunk[0]; c.lineWidth = Math.max(1.5, r * 0.14); c.beginPath(); c.arc(n0.x, n0.y, r * 0.95, 0, 6.2832); c.stroke();
  /* a knot, going round with it */
  c.fillStyle = mix(L.trunk[0], L.wood, 0.3); circ(c, n0.x + Math.cos(spin) * r * 0.55, n0.y + Math.sin(spin) * r * 0.55, r * 0.09);
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

/* Where the path turns off: the way it was going, carrying straight on -
   the main path, on ahead past the turning - from the corner (rel) on,
   while the way they're taking bends away (lkp-art.js BEND: the corner's
   bend undone, so this stays straight). */
export function worldStraightOn(c, W, H, L){
  if (BEND.corner == null || BEND.corner > 1) return;
  const c0 = BEND.corner, N = 24, Ls = [], Rs = [];
  for (let i = 0; i <= N; i++){
    const rel = c0 + (0.98 - c0) * (i / N), off = -BEND.dir * (rel - c0) * (rel - c0) * 70 * BEND.sharp;
    Ls.push(P(-PATH_HALF + off, rel, W, H)); Rs.push(P(PATH_HALF + off, rel, W, H));
  }
  const HY = HORIZON * H, pg = c.createLinearGradient(0, HY, 0, H);
  pg.addColorStop(0, mix(L.path[0], L.haze, 0.4)); pg.addColorStop(1, L.path[1]);
  c.fillStyle = pg; c.beginPath();
  Ls.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); for (let i = N; i >= 0; i--) c.lineTo(Rs[i].x, Rs[i].y);
  c.closePath(); c.fill();
  /* its edge stones */
  for (let i = 1; i <= N; i++) for (const q of [Ls[i], Rs[i]]){ c.fillStyle = mix('#8f88a8', L.haze, Math.min(0.7, i / N)); circ(c, q.x, q.y, H * 0.006 * q.k + 0.5); }
}

/* Far off at the land's edge (at x, y on the screen - the horizon), what's
   going on there: deep, thick woods - and something in them so big it's
   hardly a shape at all: a vast hazy hump above the canopy, going away
   from us, one slow heavy step at a time (FAR_STEP seconds). What you see
   is what it does: at each step great trees leaning, slowly, slowly, and
   going down along its way, flocks of birds bursting up, dust rolling up
   out of the woods. T: seconds since it started. Tiny from the pond; the
   camera goes all the way in to it. */
export const FAR_STEP = 3.4;
export function worldFarWoods(c, W, H, x, y, t, T, L){
  c.save();
  const w = W * 0.3, x0 = x - w * 0.5, ROWS = 6;
  /* where it is: barely moving - each step a lurch, a little further off */
  const step = T / FAR_STEP, n = Math.floor(step), ph = step - n, lurch = n + Math.min(1, ph / 0.45) * (1 - Math.pow(1 - Math.min(1, ph / 0.45), 2));
  const depth = 0.8 + lurch * 0.55, zx = x - w * 0.05 + lurch * w * 0.012;
  /* the rows, back to front: each further one a little higher up, smaller, hazier */
  const rowY = (r) => y - H * 0.0045 * r, rowS = (r) => H * (0.000085 - r * 0.000009), rowHaze = (r) => 0.3 + r * 0.07;
  const trees = (r) => {
    const N = 44, out = [];
    for (let k = 0; k < N; k++){
      const tx = x0 + w * ((k + 0.5) / N) + (hash(k + r * 97 + 9800) - 0.5) * w / N * 0.9;
      /* along its way, and once it's got as far as this row: going over - slowly, gathering speed */
      let rot = 0;
      const near = Math.abs(tx - zx) < w * (0.06 + 0.012 * r);
      if (near && r >= 1 && r < depth + 0.6){
        const at = Math.max(0, (r - 0.8) / 0.55) * FAR_STEP + hash(k + r * 31) * 0.8, f = Math.max(0, Math.min(1, (T - at) / 3.2));
        rot = f * f * 1.5 * (hash(k + r * 7) < 0.5 ? 1 : -1);
        if (f <= 0 && Math.abs(r - depth) < 1) rot = Math.sin(t * 2 + k) * 0.04;
      }
      out.push([tx, rot, k]);
    }
    return out;
  };
  for (let r = ROWS - 1; r >= 0; r--){
    /* it: behind the row it's got to - a colossal dome, more haze than shape */
    if (r === Math.min(ROWS - 1, Math.floor(depth))){
      /* (five times what she was: a hazy mountain more than a shape) */
      const sw = W * 0.075 * 5 * (1 - lurch * 0.025), sh = H * 0.05 * 4.5 * (1 - lurch * 0.025), by = rowY(depth) - H * 0.006 - Math.sin(ph * Math.PI) * H * 0.006;
      c.fillStyle = mix(L.hillDark, L.haze, 0.62); c.globalAlpha = 0.55;
      c.beginPath(); c.ellipse(zx, by, sw, sh, 0, Math.PI, 0); c.fill(); c.globalAlpha = 1;
      c.fillStyle = rgba(L.haze, 0.35); c.beginPath(); c.ellipse(zx, by + sh * 0.1, sw * 1.1, sh * 0.45, 0, Math.PI, 0); c.fill();
    }
    for (const [tx, rot, k] of trees(r)){
      c.save(); c.translate(tx, rowY(r)); c.rotate(rot);
      treeKind(c, 0, 0, rowS(r) * (0.85 + 0.35 * hash(k + r * 13)), hash(k + r * 5) < 0.7 ? 'pine' : 'round', L, rowHaze(r), k + r * 50);
      c.restore();
    }
  }
  /* dust, rolling up slowly out of the woods after each step */
  for (let k = 0; k < 10; k++){
    const a = Math.min(1, (ph * FAR_STEP + k * 0.3) / (FAR_STEP * 1.6)), px = zx + (hash(k + 9850) - 0.5) * w * 0.12, py = rowY(depth) - H * (0.004 + a * 0.03), r = H * (0.006 + a * 0.016);
    c.fillStyle = rgba('#d8cfc0', 0.4 * (1 - a)); circ(c, px, py, r);
  }
  /* birds: a flock bursting up off the canopy at each step, wheeling slowly away */
  c.strokeStyle = mix('#3a3450', L.haze, 0.35); c.lineWidth = Math.max(0.6, H * 0.0008); c.lineCap = 'round';
  for (let k = 0; k < 22; k++){
    const a = Math.min(1, ph * FAR_STEP / 5 + hash(k + 9860) * 0.08), side = hash(k + 9861) < 0.5 ? -1 : 1;
    const bx = zx + side * w * (0.02 + a * (0.1 + 0.15 * hash(k + 9862))), by = rowY(depth) - H * (0.01 + a * (0.04 + 0.05 * hash(k + 9863))), bw = H * 0.0028, f = Math.sin(t * 10 + k) * 0.6;
    c.globalAlpha = Math.max(0, 1 - a * 1.1); c.beginPath(); c.moveTo(bx - bw, by - bw * f); c.quadraticCurveTo(bx - bw * 0.4, by - bw * 0.2, bx, by); c.quadraticCurveTo(bx + bw * 0.4, by - bw * 0.2, bx + bw, by - bw * f); c.stroke();
  }
  c.restore();
}

/* A footprint of the giant's, pressed deep into the ground at lane, rel:
   a great rounded hollow, three toe-dents at its front, the earth pushed up
   round its rim - some with water lying in them, the sky in it. */
export function footprint(c, W, H, lane, rel, t, L, wet = false, n = 0){
  if (!L) return;
  const p = P(lane, rel, W, H), w = (P(lane + 0.7, rel, W, H).x - p.x), h = w * 0.32, haze = Math.min(0.6 * FOG, Math.max(0, rel) * 0.8 * FOG);
  if (p.x < -w * 2 || p.x > W + w * 2) return;
  c.save();
  /* the pushed-up rim, then the hollow */
  c.fillStyle = mix(mix(L.ground[0], '#c2b08a', 0.3), L.haze, haze); c.beginPath(); c.ellipse(p.x, p.y, w * 1.08, h * 1.12, 0, 0, 6.2832); c.fill();
  c.fillStyle = mix(mix(L.ground[2], '#4a3f5a', 0.35), L.haze, haze); c.beginPath(); c.ellipse(p.x, p.y + h * 0.05, w, h, 0, 0, 6.2832); c.fill();
  for (const d of [-1, 0, 1]){ c.beginPath(); c.ellipse(p.x + d * w * 0.6, p.y - h * 0.95, w * 0.26, h * 0.34, 0, 0, 6.2832); c.fill(); }
  if (wet){
    /* water lying in it, the sky in the water, rings */
    c.fillStyle = mix(mix(L.water, L.sky[2], 0.45), L.haze, haze); c.beginPath(); c.ellipse(p.x, p.y + h * 0.1, w * 0.86, h * 0.8, 0, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = Math.max(1, H * 0.003 * p.k);
    const u = (t * 0.3 + n * 0.37) % 1; c.globalAlpha = 1 - u; c.beginPath(); c.ellipse(p.x + w * 0.2, p.y + h * 0.1, w * 0.3 * (0.3 + u), h * 0.25 * (0.3 + u), 0, 0, 6.2832); c.stroke();
    c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(p.x - w * 0.3, p.y, w * 0.25, h * 0.08, 0, 0, 6.2832); c.fill();
  }
  c.restore();
}

/* A creek right across the way at rel: a band of quick shallow water, the
   sky in it, pebbles under it, damp banks either side - and every so often
   a fish leaping over it in an arc, from one bank to the other. */
export function creek(c, W, H, rel, t, L){
  if (!L) return;
  const r0 = rel - 0.025, r1 = rel + 0.025, N = 30, lanes = Array.from({ length: N + 1 }, (_, k) => -8 + 16 * k / N);
  const wob = (ln, side) => 0.006 * Math.sin(ln * 1.3 + side * 2);
  const band = (out) => { c.beginPath(); lanes.forEach((ln, k) => { const q = P(ln, Math.max(-0.14, r0 + wob(ln, 0) - out), W, H); k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }); for (let k = N; k >= 0; k--){ const q = P(lanes[k], r1 + wob(lanes[k], 1) + out, W, H); c.lineTo(q.x, q.y); } c.closePath(); };
  c.save();
  c.fillStyle = mix(L.ground[0], '#cfe8d0', 0.35); band(0.008); c.fill();
  const near = P(0, r0, W, H), far = P(0, r1, W, H), g = c.createLinearGradient(0, far.y, 0, near.y + 1);
  g.addColorStop(0, mix(L.sky[2], L.water, 0.45)); g.addColorStop(1, mix(L.water, '#1f7489', 0.4));
  c.fillStyle = g; band(0); c.fill();
  c.save(); band(0); c.clip();
  /* glints, running along it */
  c.fillStyle = 'rgba(255,255,255,.35)';
  for (let k = 0; k < 16; k++){ const ln = ((hash(k + 1990) * 16 + t * 0.8) % 16) - 8, q = P(ln, rel + (hash(k + 1991) - 0.5) * 0.04, W, H), w = W * 0.03 * q.k; c.beginPath(); c.ellipse(q.x, q.y, w, Math.max(1, w * 0.06), 0, 0, 6.2832); c.fill(); }
  c.restore();
  /* fish leaping across, one after another */
  for (let k = 0; k < 3; k++){
    const u = (t * 0.45 + k / 3) % 1, from = (k % 2 ? 1 : -1) * 2.2, ln = from * (1 - 2 * u), q = P(ln, rel, W, H), hgt = Math.sin(u * Math.PI) * H * 0.12 * q.k, s = H * 0.035 * q.k;
    c.save(); c.translate(q.x, q.y - hgt); c.rotate((k % 2 ? 1 : -1) * Math.cos(u * Math.PI) * 0.7); c.scale(k % 2 ? -1 : 1, 1);
    c.fillStyle = mix('#7fd8e8', L.water, 0.3); c.beginPath(); c.ellipse(0, 0, s, s * 0.4, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.moveTo(-s * 0.8, 0); c.lineTo(-s * 1.4, -s * 0.4); c.lineTo(-s * 1.4, s * 0.4); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(s * 0.1, -s * 0.12, s * 0.5, s * 0.1, 0, 0, 6.2832); c.fill();
    c.restore();
    if (u < 0.08 || u > 0.92){ c.strokeStyle = 'rgba(230,255,255,.6)'; c.lineWidth = Math.max(1, H * 0.003 * q.k); c.beginPath(); c.ellipse(q.x, q.y, s * 1.2, s * 0.3, 0, 0, 6.2832); c.stroke(); }
  }
  c.restore();
}

/* ---------- the lookout ---------- */

/* Up high, at the start: the whole of the planet laid out below. Far
   blue mountain ranges, snow on the nearest; a river coming out of the
   distance, winding wide across the valley and pouring over a cliff in
   a waterfall into a lake, and on out of it; rolling hills of every
   kind - deep teal woods, yellow-green meadows, pink blossom groves -
   red layered mesas, purple crystal outcrops glowing, giant mushroom
   trees, mist in the hollows, tiny herds grazing, birds; and away on
   the horizon the faint glow of the Star Core. Everything above the
   edge (px down the screen); a: how much; t: time, for the slow drift
   of it all; dx: sliding it aside. */
const hx2 = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * Math.max(0, Math.min(1, k))).toString(16).padStart(2, '0')).join(''); };
export function worldOverlook(c, W, H, edge, t, L, a = 1, dx = 0){
  if (a <= 0.001) return;
  c.save(); c.globalAlpha = a; c.beginPath(); c.rect(0, 0, W, edge); c.clip(); c.translate(dx, 0);
  const hz = H * 0.36, X0 = -W * 0.2, WW = W * 1.4, vb = Math.max(hz + H * 0.1, Math.min(edge, H));
  /* where something is in the valley: u across, v from the horizon (0) to the bottom (1) */
  const Y = (v) => hz + (H - hz) * Math.pow(v, 1.5), Hz = (v) => 0.62 * (1 - v);
  /* the sky, the low sun, long clouds */
  const sg = c.createLinearGradient(0, 0, 0, hz); sg.addColorStop(0, L.sky[0]); sg.addColorStop(0.55, L.sky[1]); sg.addColorStop(0.85, L.sky[2]); sg.addColorStop(1, L.sky[3]);
  c.fillStyle = sg; c.fillRect(X0, 0, WW, hz + 2);
  const sun = c.createRadialGradient(W * 0.2, hz * 0.75, 0, W * 0.2, hz * 0.75, H * 0.5); sun.addColorStop(0, 'rgba(255,244,224,.9)'); sun.addColorStop(1, 'rgba(255,244,224,0)'); c.fillStyle = sun; c.fillRect(X0, 0, WW, hz + 2);
  for (let k = 0; k < 5; k++){ const x = X0 + ((k * 0.27 + t * 0.003) % 1) * WW, y = H * (0.08 + 0.05 * k), w = W * (0.12 + 0.05 * (k % 3)); c.fillStyle = `rgba(255,240,250,${0.35 - 0.04 * k})`; c.beginPath(); c.ellipse(x, y, w, H * 0.012, 0, 0, 6.2832); c.fill(); }
  /* far mountain ranges, one behind another - snow on the nearest */
  [[0.62, 0.17, 3.1, 0], [0.45, 0.12, 5.3, 0], [0.28, 0.09, 7.7, 1]].forEach(([hzk, amp, seed, snow]) => {
    const pts = []; for (let k = 0; k <= 48; k++){ const x = X0 + WW * k / 48, v = Math.abs(Math.sin(k * 0.62 + seed)) * 0.65 + Math.abs(Math.sin(k * 0.21 + seed * 2)) * 0.35; pts.push([x, hz - H * amp * v]); }
    c.fillStyle = hx2(L.hillDark, L.haze, hzk); c.beginPath(); c.moveTo(X0, hz + 2); pts.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(X0 + WW, hz + 2); c.closePath(); c.fill();
    /* their sunlit faces */
    c.fillStyle = hx2(L.hillLit, L.haze, hzk);
    for (let k = 1; k < pts.length; k++){ const [x0, y0] = pts[k - 1], [x1, y1] = pts[k]; if (y1 < y0){ c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x1 + (x1 - x0) * 0.2, hz); c.lineTo(x0, hz); c.closePath(); c.fill(); } }
    if (snow) for (let k = 1; k < pts.length - 1; k++){ const [x, y] = pts[k]; if (y < pts[k - 1][1] && y < pts[k + 1][1] && hz - y > H * amp * 0.6){ const w = (pts[k + 1][0] - pts[k - 1][0]) * 0.22; c.fillStyle = hx2('#ffffff', L.haze, 0.25); c.beginPath(); c.moveTo(x, y); c.lineTo(x - w, y + w * 0.9); c.lineTo(x - w * 0.3, y + w * 0.7); c.lineTo(x + w * 0.2, y + w); c.lineTo(x + w, y + w * 0.85); c.closePath(); c.fill(); } }
  });
  /* the Star Core's glow, far off on the horizon - where they're going */
  const cx = W * 0.74, cg = c.createRadialGradient(cx, hz, 0, cx, hz, H * 0.14); cg.addColorStop(0, 'rgba(190,250,255,.8)'); cg.addColorStop(1, 'rgba(190,250,255,0)');
  c.fillStyle = cg; c.fillRect(cx - H * 0.14, hz - H * 0.14, H * 0.28, H * 0.28);
  c.fillStyle = 'rgba(200,250,255,.4)'; c.fillRect(cx - H * 0.003, hz - H * 0.26, H * 0.006, H * 0.26);
  /* the far plain, hazy */
  const pg = c.createLinearGradient(0, hz, 0, H); pg.addColorStop(0, hx2('#86c79a', L.haze, 0.6)); pg.addColorStop(1, hx2(L.ground[1], L.haze, 0.1)); c.fillStyle = pg; c.fillRect(X0, hz, WW, H - hz);
  /* hills, far to near, each its own kind - woods, meadow, blossom - and in among them, mesas, crystals, giant mushrooms */
  const HILLS = [
    [0.08, 0.05, 0.16, 'wood'], [0.3, 0.06, 0.12, 'meadow'], [0.52, 0.045, 0.1, 'blossom'], [0.86, 0.06, 0.15, 'wood'],
    [0.16, 0.14, 0.2, 'meadow'], [0.4, 0.17, 0.14, 'wood'], [0.95, 0.16, 0.2, 'blossom'],
    [0.02, 0.3, 0.17, 'wood'], [0.85, 0.3, 0.15, 'meadow'], [0.12, 0.48, 0.15, 'blossom'], [1.0, 0.47, 0.18, 'wood'],
    [-0.02, 0.68, 0.17, 'meadow'], [0.9, 0.72, 0.16, 'blossom']
  ];
  const KIND = { wood: ['#3d8f7a', '#58b39a', '#1f5a6c', '#58c2b0'], meadow: ['#9ccc6e', '#c4e08a', '#6a9a48', '#e8e27a'], blossom: ['#e8a6c8', '#f6c8de', '#b8608e', '#ffe0ee'] };
  /* the river's line: out of the distance, winding wider as it comes, over the falls (at v FALL) into the lake, on out of it */
  const FALL = 0.36, up = (v) => 0.6 + 0.05 * Math.sin(v * 22) - 0.25 * v, LAKE = [up(FALL), 0.41];
  const rx = (v) => v < FALL ? up(v) : v < LAKE[1] + 0.06 ? LAKE[0] : LAKE[0] - (v - LAKE[1] - 0.06) * 0.55 + 0.07 * Math.sin((v - 0.47) * 14);
  const rw = (v) => W * (0.003 + 0.05 * Math.pow(v, 1.4));
  const river = (v0, v1) => {
    const n = 40, Ls = [], Rs = [];
    for (let k = 0; k <= n; k++){ const v = v0 + (v1 - v0) * k / n, x = X0 + WW * ((rx(v) + 0.2) / 1.4) , y = Y(v), w = rw(v); Ls.push([x - w, y]); Rs.push([x + w, y]); }
    /* sandy banks, then the water: lighter far off (the sky in it), deeper near */
    c.fillStyle = hx2('#e6d6a8', L.haze, Hz(v0) * 0.8); c.beginPath(); Ls.forEach(([x, y], k) => k ? c.lineTo(x - rw(v0 + (v1 - v0) * k / n) * 0.35, y) : c.moveTo(x, y)); for (let k = n; k >= 0; k--) c.lineTo(Rs[k][0] + rw(v0 + (v1 - v0) * k / n) * 0.35, Rs[k][1]); c.closePath(); c.fill();
    const wg = c.createLinearGradient(0, Y(v0), 0, Y(v1)); wg.addColorStop(0, hx2('#bfefff', L.haze, 0.3)); wg.addColorStop(1, '#2a9fc0');
    c.fillStyle = wg; c.beginPath(); Ls.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); for (let k = n; k >= 0; k--) c.lineTo(Rs[k][0], Rs[k][1]); c.closePath(); c.fill();
    /* the light on it, glinting, flowing */
    c.fillStyle = 'rgba(255,255,255,.55)';
    for (let k = 0; k < 24; k++){ const v = v0 + (v1 - v0) * ((k / 24 + t * 0.01) % 1), x = X0 + WW * ((rx(v) + 0.2) / 1.4) + rw(v) * 0.4 * Math.sin(k * 3.1), y = Y(v); c.beginPath(); c.ellipse(x, y, rw(v) * 0.35, Math.max(0.6, rw(v) * 0.05), 0, 0, 6.2832); c.fill(); }
  };
  const hill = ([u, v, w, kind], n) => {
    const x = X0 + WW * ((u + 0.2) / 1.4), y = Y(v + 0.05), ww = W * w * (0.7 + 0.5 * v), hh = ww * 0.28, hzk = Hz(v), [base, lit, tree, treeL] = KIND[kind];
    c.fillStyle = hx2(base, L.haze, hzk); c.beginPath(); c.moveTo(x - ww * 1.3, y + hh * 2.5); c.bezierCurveTo(x - ww * 0.9, y - hh * 0.4, x - ww * 0.5, y - hh * 1.05, x, y - hh); c.bezierCurveTo(x + ww * 0.5, y - hh * 1.05, x + ww * 0.9, y - hh * 0.4, x + ww * 1.3, y + hh * 2.5); c.closePath(); c.fill();
    c.fillStyle = hx2(lit, L.haze, hzk); c.beginPath(); c.moveTo(x - ww * 0.85, y); c.bezierCurveTo(x - ww * 0.55, y - hh * 0.85, x - ww * 0.05, y - hh * 0.95, x + ww * 0.15, y - hh * 0.6); c.quadraticCurveTo(x - ww * 0.3, y - hh * 0.2, x - ww * 0.85, y); c.fill();
    /* what grows on it */
    const r0 = ww * (kind === 'meadow' ? 0.03 : 0.055);
    for (let k = 0; k < (kind === 'meadow' ? 10 : 16); k++){
      const fx = (hash(n * 31 + k) - 0.5) * 1.5, tx = x + fx * ww * 0.8, ty = y - hh * (0.75 - 0.6 * fx * fx) + hh * 0.2 * hash(n + k), r = r0 * (0.7 + 0.6 * hash(n * 7 + k));
      if (kind === 'meadow'){ c.fillStyle = hx2(['#fff4c2', '#ffc2e6', '#c9f7ff', '#ffe39a'][k % 4], L.haze, hzk); c.beginPath(); c.arc(tx, ty, r * 0.5, 0, 6.2832); c.fill(); continue; }
      c.fillStyle = hx2(tree, L.haze, hzk); c.beginPath(); c.arc(tx, ty, r, 0, 6.2832); c.fill();
      c.fillStyle = hx2(treeL, L.haze, hzk); c.beginPath(); c.arc(tx - r * 0.3, ty - r * 0.3, r * 0.6, 0, 6.2832); c.fill();
    }
  };
  /* a red mesa, its cliffs in layers */
  const mesa = (u, v, w, h) => {
    /* (flat-topped, its cliffs in red layers, the rubble sloping out at its foot) */
    const x = X0 + WW * ((u + 0.2) / 1.4), y = Y(v), ww = W * w, hh = H * h, hzk = Hz(v);
    const bands = ['#e8b07a', '#c9725a', '#e09a6a', '#b45c50'];
    c.fillStyle = hx2('#b47a60', L.haze, hzk); c.beginPath(); c.moveTo(x - ww * 0.75, y + hh * 0.05); c.quadraticCurveTo(x - ww * 0.5, y - hh * 0.35, x - ww * 0.4, y - hh * 0.4); c.lineTo(x + ww * 0.42, y - hh * 0.4); c.quadraticCurveTo(x + ww * 0.55, y - hh * 0.3, x + ww * 0.8, y + hh * 0.05); c.closePath(); c.fill();
    for (let k = 0; k < 4; k++){ const y0 = y - hh + hh * 0.6 * k / 4, y1 = y0 + hh * 0.15 + 1, jag = (n) => hh * 0.03 * Math.sin(n * 3 + k); c.fillStyle = hx2(bands[k], L.haze, hzk); c.beginPath(); c.moveTo(x - ww * 0.42, y1); for (let q = 0; q <= 8; q++) c.lineTo(x - ww * 0.42 + ww * 0.84 * q / 8, y0 + jag(q)); c.lineTo(x + ww * 0.42, y1); c.closePath(); c.fill(); }
    c.fillStyle = hx2('#9a4e48', L.haze, hzk); c.beginPath(); c.moveTo(x + ww * 0.15, y - hh); c.lineTo(x + ww * 0.42, y - hh); c.lineTo(x + ww * 0.42, y - hh * 0.4); c.lineTo(x + ww * 0.2, y - hh * 0.4); c.closePath(); c.globalAlpha = a * 0.45; c.fill(); c.globalAlpha = a;
    c.fillStyle = hx2('#8fd08a', L.haze, hzk); c.beginPath(); c.ellipse(x, y - hh, ww * 0.44, hh * 0.05, 0, 0, 6.2832); c.fill();
  };
  /* purple crystals sticking up out of the ground, glowing */
  const crystals = (u, v, s) => {
    const x = X0 + WW * ((u + 0.2) / 1.4), y = Y(v), z = H * s, hzk = Hz(v);
    const gl = c.createRadialGradient(x, y - z, 0, x, y - z, z * 3); gl.addColorStop(0, `rgba(220,170,255,${0.5 * (1 - hzk)})`); gl.addColorStop(1, 'rgba(220,170,255,0)'); c.fillStyle = gl; c.fillRect(x - z * 3, y - z * 4, z * 6, z * 6);
    for (const [ox, hh, lean] of [[0, 2.2, 0], [-0.5, 1.4, -0.3], [0.55, 1.6, 0.25], [0.25, 1, 0.1]]){ c.fillStyle = hx2('#9b6ae0', L.haze, hzk); c.beginPath(); c.moveTo(x + ox * z - z * 0.25, y); c.lineTo(x + ox * z + lean * z, y - hh * z); c.lineTo(x + ox * z + z * 0.25, y); c.closePath(); c.fill(); c.fillStyle = hx2('#e0c8ff', L.haze, hzk); c.beginPath(); c.moveTo(x + ox * z - z * 0.1, y); c.lineTo(x + ox * z + lean * z, y - hh * z); c.lineTo(x + ox * z, y); c.closePath(); c.fill(); }
  };
  /* a giant mushroom tree */
  const shroom = (u, v, s) => {
    const x = X0 + WW * ((u + 0.2) / 1.4), y = Y(v), z = H * s, hzk = Hz(v);
    c.fillStyle = hx2('#f3e6d0', L.haze, hzk); c.fillRect(x - z * 0.12, y - z * 2, z * 0.24, z * 2);
    c.fillStyle = hx2('#c8508e', L.haze, hzk); c.beginPath(); c.ellipse(x, y - z * 2, z * 1.1, z * 0.5, 0, Math.PI, 6.2832); c.fill();
    c.fillStyle = hx2('#ffe0ee', L.haze, hzk); for (let k = 0; k < 5; k++){ c.beginPath(); c.arc(x + (k - 2) * z * 0.38, y - z * 2.2 - (k % 2) * z * 0.15, z * 0.09, 0, 6.2832); c.fill(); }
  };
  /* far to near: the far hills, the river's upper reach, more hills, the falls and the lake, the near hills, the lower river */
  HILLS.slice(0, 4).forEach((h, n) => hill(h, n));
  shroom(0.24, 0.07, 0.03); shroom(0.27, 0.075, 0.022); mesa(0.92, 0.09, 0.08, 0.06); crystals(0.46, 0.1, 0.012);
  river(0.005, FALL);
  HILLS.slice(4, 7).forEach((h, n) => hill(h, n + 4));
  mesa(0.08, 0.2, 0.12, 0.09); crystals(0.72, 0.22, 0.02); shroom(0.86, 0.24, 0.045);
  /* the cliff the river falls over, and the falls, misty */
  { const v = FALL, y = Y(v), x = X0 + WW * ((rx(v) + 0.2) / 1.4), w = rw(v) * 1.4, drop = Y(LAKE[1]) - y;
    const cw = W * 0.08, rock = hx2('#7a6a90', L.haze, Hz(v)), rockL = hx2('#a294c0', L.haze, Hz(v));
    c.fillStyle = rock; c.beginPath(); c.moveTo(x - cw, y + drop); c.lineTo(x - cw * 0.95, y + drop * 0.3);
    for (let q = 0; q <= 10; q++) c.lineTo(x - cw * 0.8 + cw * 1.6 * q / 10, y - drop * 0.08 * Math.abs(Math.sin(q * 1.9)));
    c.lineTo(x + cw * 0.95, y + drop * 0.3); c.lineTo(x + cw, y + drop); c.closePath(); c.fill();
    c.fillStyle = rockL; c.beginPath(); c.moveTo(x - cw * 0.95, y + drop * 0.3); c.lineTo(x - cw * 0.8, y); c.lineTo(x - cw * 0.3, y); c.lineTo(x - cw * 0.5, y + drop * 0.9); c.closePath(); c.fill();
    c.fillStyle = hx2('#8fd08a', L.haze, Hz(v)); c.beginPath(); c.ellipse(x - cw * 0.5, y, cw * 0.4, drop * 0.06, 0, 0, 6.2832); c.ellipse(x + cw * 0.55, y, cw * 0.35, drop * 0.05, 0, 0, 6.2832); c.fill();
    const fg = c.createLinearGradient(0, y, 0, y + drop); fg.addColorStop(0, '#e8faff'); fg.addColorStop(1, '#bfefff');
    c.fillStyle = fg; c.fillRect(x - w, y, w * 2, drop);
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = Math.max(1, w * 0.12);
    for (let k = 0; k < 4; k++){ const fx = x - w + w * 2 * (k + 0.5) / 4, o = ((t * 0.6 + k * 0.3) % 1) * drop; c.beginPath(); c.moveTo(fx, y + o); c.lineTo(fx, Math.min(y + drop, y + o + drop * 0.25)); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 6; k++){ c.beginPath(); c.arc(x + (k - 2.5) * w * 0.8, y + drop + Math.sin(t + k) * w * 0.2, w * (0.9 + 0.3 * (k % 2)), 0, 6.2832); c.fill(); } }
  /* the lake under the falls, the sky in it */
  { const y = Y(LAKE[1]), x = X0 + WW * ((LAKE[0] + 0.2) / 1.4), rw2 = W * 0.13, rh = H * 0.035;
    c.fillStyle = hx2('#e6d6a8', L.haze, 0.2); c.beginPath(); c.ellipse(x, y + rh * 0.6, rw2 * 1.06, rh * 1.2, 0, 0, 6.2832); c.fill();
    const lg = c.createLinearGradient(0, y - rh, 0, y + rh * 2); lg.addColorStop(0, '#9fe6f5'); lg.addColorStop(1, '#2a9fc0'); c.fillStyle = lg; c.beginPath(); c.ellipse(x, y + rh * 0.6, rw2, rh, 0, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(x - rw2 * 0.3, y + rh * 0.4, rw2 * 0.3, rh * 0.12, 0, 0, 6.2832); c.fill(); }
  river(LAKE[1] + 0.06, 1.02);
  HILLS.slice(7).forEach((h, n) => hill(h, n + 7));
  crystals(0.16, 0.5, 0.035); shroom(0.92, 0.55, 0.07);
  /* tiny herds grazing on the meadows, drifting */
  for (const [u, v, n] of [[0.66, 0.3, 14], [0.2, 0.18, 9]]){ const hzk = Hz(v); c.fillStyle = hx2('#6a5fc8', L.haze, hzk); for (let k = 0; k < n; k++){ const x = X0 + WW * ((u + 0.2) / 1.4) + (hash(k + n) - 0.5) * W * 0.05 + Math.sin(t * 0.2 + k) * 2, y = Y(v) + (hash(k * 3 + n) - 0.5) * H * 0.012; c.beginPath(); c.ellipse(x, y, H * 0.0035 * (1 + v), H * 0.0025 * (1 + v), 0, 0, 6.2832); c.fill(); } }
  /* mist lying in the hollows */
  for (const [u, v, w] of [[0.3, 0.12, 0.3], [0.75, 0.2, 0.25], [0.5, 0.33, 0.2]]){ const x = X0 + WW * ((u + 0.2) / 1.4), y = Y(v), mg = c.createRadialGradient(x, y, 0, x, y, W * w); mg.addColorStop(0, rgba(L.haze, 0.45)); mg.addColorStop(1, rgba(L.haze, 0)); c.fillStyle = mg; c.beginPath(); c.ellipse(x, y, W * w, H * 0.03, 0, 0, 6.2832); c.fill(); }
  /* birds, far off, drifting along */
  c.strokeStyle = 'rgba(60,50,90,.55)'; c.lineWidth = Math.max(1, H * 0.0018);
  for (let k = 0; k < 9; k++){ const x = X0 + ((k * 0.13 + t * 0.008) % 1) * WW, y = H * (0.2 + 0.04 * Math.sin(k * 2 + t * 0.2)), w = H * 0.007, f = Math.sin(t * 6 + k) * w * 0.6; c.beginPath(); c.moveTo(x - w, y - f); c.lineTo(x, y); c.lineTo(x + w, y - f); c.stroke(); }
  c.restore();
  /* the ridge's edge they're stood at: grass, rocks, the land falling away */
  if (a > 0.05 && edge < H){
    c.save(); c.globalAlpha = a;
    c.fillStyle = hx2(L.ground[1], '#3a3456', 0.25); c.beginPath(); c.moveTo(0, edge + H * 0.01);
    for (let k = 0; k <= 30; k++) c.lineTo(W * k / 30, edge - H * 0.006 * Math.abs(Math.sin(k * 1.7)) - H * 0.004);
    c.lineTo(W, edge + H * 0.02); c.lineTo(0, edge + H * 0.02); c.closePath(); c.fill();
    for (let k = 0; k < 9; k++){ const x = W * hash(k + 600), r = H * (0.008 + 0.01 * hash(k + 601)); c.fillStyle = hx2('#8f88a8', L.haze, 0.1); c.beginPath(); c.ellipse(x, edge, r * 1.4, r, 0, Math.PI, 6.2832); c.fill(); }
    c.restore();
  }
}
