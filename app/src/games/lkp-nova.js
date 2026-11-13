/* Commander Nova on the radio: her drawn portrait, shown
   as a far-off video call with a weak signal - the colours split a
   little apart, rows of the picture jumping sideways now and then, grain
   and scan lines, SIGNAL WEAK blinking, one bar of signal.

   novaFeed(c, x, y, w, h, t, talking): her feed in that box. Returns
   false where there's no canvas to paint her on (node tests), so the
   caller can draw something else. */

const mk = (w, h) => {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); if (!cv.getContext) return null;
  cv.width = Math.max(1, w); cv.height = Math.max(1, h); return cv.getContext('2d') ? cv : null;
};
function rg(c, x, y, r0, r1, stops){ const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function lg(c, x0, y0, x1, y1, stops){ const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }

/* Her portrait, 600 x 600, drawn in a graphic-novel style (flat colour,
   a hard shadow down one side, ink, halftone), after the reference
   portrait: older, grey hair swept back, green eyes under heavy lids,
   stern brows and mouth, a long scar from her brow down her cheek, a
   tactical headset with olive earcups, a camouflage jacket with
   sergeant's chevrons and a tag on a chain. (She'll be fighting alongside
   the crew, later on: the same look, drawn.) */
const NOVA_LOOK = { skin: '#c89478', hair: '#9a968e', style: 'slick', gear: 'camo', gearCol: '#55603a', face: 'square', brows: 'stern', browCol: '#7a7068', lips: 'stern', lipCol: '#8a4a48', iris: '#6a7a3a', eyes: { shape: 'hooded', size: 1.22, gap: 46 }, nose: 'straight', scar: 'long', older: true, cups: true, neck: 14, bg0: '#1a2620', bg1: '#0a100c' };
/* (drawn a touch wider than it's built) */
function portrait(){
  if (!mk(1, 1)) return null;
  const P = drawNova(NOVA_LOOK), wide = mk(600, 600), w = wide.getContext('2d');
  w.translate(300, 0); w.scale(1.1, 1); w.translate(-300, 0); w.drawImage(P, 0, 0);
  return wide;
}
/* Nova, graphic-novel style: flat colour, hard shadows, ink, halftone. */
const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
function shape(c, pts){ c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++){ const p = pts[i]; if (p.length === 2) c.lineTo(p[0], p[1]); else if (p.length === 4) c.quadraticCurveTo(p[0], p[1], p[2], p[3]); else c.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]); } }
function halftone(c, clip, col, step = 7, r = 1.8){ c.save(); clip(); c.clip(); c.fillStyle = col; for (let y = 0; y < 600; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < 600; x += step){ c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } c.restore(); }
function ink(c, w, col = '#1a0f0c'){ c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }

function drawNova(o){
  const cv = mk(600, 600), c = cv.getContext('2d');
  const SK = o.skin, SH = mix(SK, o.shadeTint || '#5a2a3a', 0.42), SD = mix(SK, '#2a0e14', 0.62), HI = mix(SK, '#fff4e0', 0.28);
  const INK = '#1c100e';
  /* background: comms room, dark, a warning light */
  let g = c.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, o.bg0 || '#1e2a36'); g.addColorStop(1, o.bg1 || '#0a0f15'); c.fillStyle = g; c.fillRect(0, 0, 600, 600);
  c.save(); c.globalAlpha = 0.5; for (let k = 0; k < 7; k++){ c.fillStyle = k % 3 ? '#2c3a48' : '#3a4a5a'; c.fillRect(30 + k * 80, 40, 50, 300); } c.restore();
  g = c.createRadialGradient(520, 90, 0, 520, 90, 220); g.addColorStop(0, 'rgba(255,120,60,.45)'); g.addColorStop(1, 'rgba(255,120,60,0)'); c.fillStyle = g; c.fillRect(0, 0, 600, 600);
  /* ---- hair behind ---- */
  const HR = o.hair, HRD = mix(HR, '#000000', 0.45), HRL = mix(HR, '#d8c8b8', 0.35);
  if (o.style === 'braid' || o.style === 'tied' || o.style === 'crop' || o.style === 'slick'){
    shape(c, [[196, 270], [176, 140, 238, 66, 300, 66], [364, 66, 426, 140, 404, 270], [400, 330, 390, 360, 380, 390], [220, 390], [210, 360, 200, 330, 196, 270]]);
    c.fillStyle = HRD; c.fill(); ink(c, 4, INK);
  }
  if (o.style === 'braid'){ for (let k = 0; k < 6; k++){ c.beginPath(); c.ellipse(392 + k * 5, 360 + k * 34, 22 - k * 1.5, 19, 0.35, 0, 7); c.fillStyle = k % 2 ? HR : HRD; c.fill(); ink(c, 3, INK); } }
  /* ---- neck ---- */
  const NK = o.neck || 0;
  shape(c, [[252 - NK, 330], [250 - NK, 380, 244 - NK, 410, 236 - NK, 452], [364 + NK, 452], [356 + NK, 410, 350 + NK, 380, 348 + NK, 330]]); c.fillStyle = SK; c.fill();
  /* shadow under the jaw, and the right side of the neck */
  shape(c, [[250, 340], [300, 392, 340, 380, 350, 340], [354, 400, 358, 430, 364, 452], [300, 452], [320, 420, 326, 390, 300, 395], [270, 392, 255, 370, 250, 340]]); c.fillStyle = SH; c.fill();
  c.beginPath(); c.moveTo(252 - NK, 330); c.bezierCurveTo(250 - NK, 380, 244 - NK, 410, 236 - NK, 452); ink(c, 4, INK); c.beginPath(); c.moveTo(348 + NK, 330); c.bezierCurveTo(356 + NK, 410, 358 + NK, 430, 364 + NK, 452); ink(c, 5, INK);
  c.beginPath(); c.moveTo(276, 400); c.lineTo(290, 440); ink(c, 2, mix(SH, INK, 0.5));
  /* ---- gear ---- */
  gear(c, o, INK);
  /* ---- ears ---- */
  for (const s of [-1, 1]){ shape(c, [[300 + s * 96, 232], [300 + s * 118, 222, 300 + s * 122, 262, 300 + s * 112, 286], [300 + s * 104, 296, 300 + s * 96, 290, 300 + s * 94, 282]]); c.fillStyle = s > 0 ? SH : SK; c.fill(); ink(c, 3.5, INK); c.beginPath(); c.moveTo(300 + s * 102, 240); c.quadraticCurveTo(300 + s * 112, 258, 300 + s * 104, 276); ink(c, 2, SD); }
  /* ---- face ---- */
  /* the face's shape: jaw (how wide at the angle), chin (how wide), cheeks (how full) */
  const F = { oval: [0, 0, 0], heart: [-14, -8, 4], square: [12, 10, -4], round: [8, 4, 10], long: [-6, -2, -6] }[o.face || 'oval'];
  const jw = F[0], cw = F[1], ch = F[2], cy = o.face === 'long' ? 380 : 372;
  const face = () => shape(c, [[300, 112], [358, 112, 398 + ch * 0.3, 150, 400 + ch * 0.4, 214], [402 + ch, 256, 392 + jw, 290, 376 + jw, 318], [362 + jw, 340 + jw * 0.5, 336 + cw, cy - 10, 318 + cw, cy - 2], [306, cy + 2, 294, cy + 2, 282 - cw, cy - 2], [264 - cw, cy - 10, 238 - jw, 340 + jw * 0.5, 224 - jw, 318], [208 - jw, 290, 198 - ch, 256, 200 - ch * 0.4, 214], [202 - ch * 0.3, 150, 242, 112, 300, 112]]);
  face(); c.fillStyle = SK; c.fill();
  /* key light from the left: the right side in shadow - a hard edge that
     follows the form (temple, under the cheekbone, down the jaw) */
  c.save(); face(); c.clip();
  shape(c, [[338, 100], [352, 150, 350, 190, 340, 210], [334, 222, 346, 236, 352, 252], [360, 272, 330, 284, 322, 300], [316, 318, 336, 330, 330, 348], [326, 362, 316, 372, 310, 380], [420, 380], [420, 100]]); c.fillStyle = SH; c.fill();
  /* eye sockets, under the brow */
  for (const s of [-1, 1]){ c.beginPath(); c.ellipse(300 + s * 44, 226, 34, 15, s * -0.08, 0, 7); c.fillStyle = s > 0 ? SD : mix(SK, SH, 0.6); c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1; }
  /* under the cheekbone, left side (softer) */
  shape(c, [[226, 268], [240, 292, 252, 300, 262, 312], [250, 318, 236, 312, 226, 300]]); c.fillStyle = mix(SK, SH, 0.6); c.fill();
  /* nose: the right side of the bridge and the tip in shadow, under it */
  shape(c, [[306, 222], [312, 250, 318, 272, 324, 292], [318, 302, 306, 306, 300, 304], [308, 290, 306, 260, 306, 222]]); c.fillStyle = SH; c.fill();
  shape(c, [[282, 304], [292, 314, 312, 314, 322, 304], [314, 320, 288, 322, 282, 304]]); c.fillStyle = SD; c.fill();
  /* under the lower lip, chin */
  shape(c, [[284, 346], [300, 352, 316, 346, 318, 344], [314, 356, 290, 356, 284, 346]]); c.fillStyle = SH; c.fill();
  /* highlights: forehead, nose ridge, cheekbone (lit side) */
  c.fillStyle = HI; c.globalAlpha = 0.85;
  shape(c, [[262, 140], [282, 128, 312, 128, 322, 140], [300, 150, 276, 152, 262, 140]]); c.fill();
  shape(c, [[296, 236], [299, 262, 299, 280, 296, 292], [293, 280, 293, 262, 296, 236]]); c.fill();
  shape(c, [[232, 254], [246, 248, 262, 252, 270, 262], [256, 262, 242, 262, 232, 254]]); c.fill();
  c.globalAlpha = 1;
  /* halftone dots in the shadow */
  halftone(c, () => shape(c, [[338, 100], [352, 150, 350, 190, 340, 210], [334, 222, 346, 236, 352, 252], [360, 272, 330, 284, 322, 300], [316, 318, 336, 330, 330, 348], [326, 362, 316, 372, 310, 380], [420, 380], [420, 100]]), rgba(SD, 0.45), 8, 1.3);
  /* age, grit */
  if (o.age){ c.strokeStyle = mix(SH, INK, 0.3); c.lineWidth = 2; for (const s of [-1, 1]){ c.beginPath(); c.moveTo(300 + s * 26, 246); c.quadraticCurveTo(300 + s * 42, 254, 300 + s * 60, 246); c.stroke(); c.beginPath(); c.moveTo(300 + s * 30, 300); c.quadraticCurveTo(300 + s * 38, 318, 300 + s * 36, 334); c.stroke(); } c.beginPath(); c.moveTo(286, 196); c.lineTo(290, 182); c.moveTo(314, 196); c.lineTo(310, 182); c.stroke(); }
  if (o.smudge){ c.fillStyle = 'rgba(50,35,30,.35)'; c.beginPath(); c.ellipse(244, 300, 18, 9, -0.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(262, 140, 12, 5, 0.2, 0, 7); c.fill(); }
  c.restore();
  face(); ink(c, 4, INK);
  /* the shadow side's outline heavier */
  c.beginPath(); c.moveTo(400 + ch * 0.4, 214); c.bezierCurveTo(402 + ch, 256, 392 + jw, 290, 376 + jw, 318); c.bezierCurveTo(362 + jw, 340 + jw * 0.5, 336 + cw, cy - 10, 318 + cw, cy - 2); ink(c, 5, INK);
  /* ---- brows: heavy, low, straight-ish ---- */
  const BR = { stern: [4, -2, 1.1], straight: [0, 0, 1], arched: [-8, 4, 0.85], soft: [-3, 2, 0.7], high: [-6, 3, 0.8] }[o.brows || 'straight'];
  for (const s of [-1, 1]){
    const a = BR[0], t = BR[2];
    shape(c, [[300 + s * 16, 214], [300 + s * 30, 204 + a * 0.5, 300 + s * 50, 196 + a, 300 + s * 72, 206 + BR[1]], [300 + s * 70, 206 + BR[1] + 5 * t], [300 + s * 50, 196 + a + 8 * t, 300 + s * 30, 206 + a * 0.5 + 6 * t, 300 + s * 18, 214 + 7 * t]]); c.fillStyle = o.browCol || mix(HR, INK, 0.3); c.fill(); ink(c, 1.2, INK);
  }
  /* ---- eyes: narrow, steady, lids heavy ---- */
  /* eyes: their shape, size, set */
  const E = Object.assign({ shape: 'almond', size: 1, gap: 44 }, o.eyes || {});
  for (const s of [-1, 1]){
    const ex = 300 + s * E.gap, ey = 232, w = 21 * E.size, h = { almond: 8, round: 11, hooded: 7, upturned: 8, monolid: 5.5 }[E.shape] * E.size;
    const tilt = E.shape === 'upturned' ? 4 : E.shape === 'monolid' ? 2 : 0;
    /* (the outer corner lifted for upturned eyes) */
    const inner = [ex - s * w, ey + 1], outer = [ex + s * w, ey - tilt];
    const top = () => { c.moveTo(inner[0], inner[1]); c.bezierCurveTo(ex - s * w * 0.4, ey - h * 1.15, ex + s * w * 0.4, ey - h * 1.15 - tilt * 0.5, outer[0], outer[1]); };
    c.beginPath(); top(); c.bezierCurveTo(ex + s * w * 0.4, ey + h * 0.9, ex - s * w * 0.4, ey + h * 0.9, inner[0], inner[1]); c.fillStyle = s > 0 ? '#d4c8bc' : '#efe6dc'; c.fill();
    c.save(); c.clip();
    const ir = 7.5 * E.size * (E.shape === 'round' ? 1.08 : 1);
    c.fillStyle = o.iris || '#4a5a3a'; c.beginPath(); c.arc(ex + s * 1, ey + 1, ir, 0, 7); c.fill();
    c.fillStyle = mix(o.iris || '#4a5a3a', '#ffffff', 0.25); c.beginPath(); c.arc(ex + s * 1, ey + 3, ir * 0.55, 0, Math.PI); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(ex + s * 1, ey + 1, ir * 0.45, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - 2, ey - 2, 2 * E.size, 0, 7); c.fill();
    /* the lid's shadow on the eye; heavier for hooded */
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(ex - 25, ey - 20, 50, (E.shape === 'hooded' ? 12 : 9) + (ey - 20 - (ey - 20)));
    c.restore();
    c.beginPath(); top(); ink(c, E.shape === 'monolid' ? 4 : 3.2, INK);
    /* lashes, a flick at the outer corner */
    c.beginPath(); c.moveTo(outer[0] - s * 2, outer[1] + 1); c.lineTo(outer[0] + s * 5, outer[1] - 4); ink(c, 2.5, INK);
    /* the crease above (none for monolid; low and heavy for hooded) */
    if (E.shape !== 'monolid'){ c.beginPath(); const cr = E.shape === 'hooded' ? 6 : 11; c.moveTo(ex - s * w * 0.75, ey - h - cr * 0.5); c.quadraticCurveTo(ex, ey - h - cr - 2, ex + s * w * 0.85, ey - h * 0.5 - cr * 0.6 - tilt); ink(c, 1.4, mix(SH, INK, 0.4)); }
    c.beginPath(); c.moveTo(ex - s * w * 0.6, ey + h * 0.85); c.quadraticCurveTo(ex, ey + h * 1.05, ex + s * w * 0.7, ey + h * 0.6 - tilt * 0.5); ink(c, 1, mix(SH, INK, 0.25));
  }
  /* ---- nose lines ---- */
  const N = { straight: [1, 1, 0], broad: [1.3, 0.95, 0], button: [0.85, 0.85, -6], aquiline: [0.95, 1.05, 4], small: [0.8, 0.9, -3], tiny: [0.68, 0.84, -4] }[o.nose || 'straight'];
  const nw = N[0], nl = N[1], hook = N[2];
  const ny = 300 + (nl - 1) * 30;
  c.beginPath(); c.moveTo(309, 238); c.quadraticCurveTo(314 + hook, 262, 300 + 18 * nw + hook * 0.4, ny - 6); ink(c, 2, mix(SD, INK, 0.5));
  c.beginPath(); c.moveTo(300 - 18 * nw, ny); c.quadraticCurveTo(300 - 22 * nw, ny + 6, 300 - 14 * nw, ny + 8); c.moveTo(300 + 18 * nw, ny); c.quadraticCurveTo(300 + 24 * nw, ny + 6, 300 + 16 * nw, ny + 9); ink(c, 2.4, INK);
  c.beginPath(); c.moveTo(300 - 8 * nw, ny + 9); c.quadraticCurveTo(300, ny + 12, 300 + 8 * nw, ny + 9); ink(c, 1.8, INK);
  /* ---- mouth: set, a slight half-smirk ---- */
  const M = { neutral: [1, 1, 1, 0], full: [1, 1.6, 1.5, 0], thin: [1, 0.6, 0.6, 0], wide: [1.2, 1, 1, 0], smile: [1.05, 1, 1.1, 1], stern: [1.05, 0.8, 1.1, -0.9] }[o.lips || 'neutral'];
  const mw = 30 * M[0], ut = 5 * M[1], lt = 10 * M[2], up = M[3] * 4, my = 333;
  shape(c, [[300 - mw, my], [300 - mw * 0.5, my - ut, 300 - 4, my - ut * 0.9, 300, my - ut * 0.5], [300 + 4, my - ut * 0.9, 300 + mw * 0.5, my - ut, 300 + mw, my], [300, my + 2, 300 - mw, my]]); c.fillStyle = mix(SK, o.lipCol || '#8a3a3a', 0.45); c.fill();
  shape(c, [[300 - mw * 0.85, my + 1], [300 - mw * 0.4, my + lt * 1.2, 300 + mw * 0.4, my + lt * 1.2, 300 + mw * 0.85, my + 1], [300, my + 3, 300 - mw * 0.85, my + 1]]); c.fillStyle = mix(SK, o.lipCol || '#a04a44', 0.32); c.fill();
  c.beginPath(); c.moveTo(300 - mw - 2, my - up); c.bezierCurveTo(300 - mw * 0.5, my + 2, 300 + mw * 0.5, my + 2, 300 + mw + 2, my - up - 1); ink(c, 2.6, INK);
  c.fillStyle = HI; c.globalAlpha = 0.55; c.fillRect(300 - mw * 0.3, my + lt * 0.55, mw * 0.5, 2); c.globalAlpha = 1;
  /* ---- scars ---- */
  const scar = (pts, w = 3.5) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.strokeStyle = mix(SK, '#f4dcd0', 0.55); c.lineWidth = w + 2; c.lineCap = 'round'; c.stroke(); c.strokeStyle = mix(SH, '#7a3a3a', 0.4); c.lineWidth = 1.2; c.stroke(); };
  if (o.scar === 'brow') scar([[330, 186], [338, 214]]), scar([[340, 240], [348, 266]]);
  if (o.scar === 'cheek') scar([[238, 262], [266, 298]]);
  if (o.scar === 'long'){ scar([[236, 186], [244, 206], [250, 218]], 4); scar([[226, 262], [236, 290], [252, 316], [270, 340]], 3.5); c.strokeStyle = mix(SK, '#8a3a3a', 0.4); c.lineWidth = 1.5; c.beginPath(); c.moveTo(372, 300); c.lineTo(384, 296); c.stroke(); }
  if (o.scar === 'lip') scar([[312, 318], [316, 344]], 3);
  /* ---- older: forehead lines, crow's feet, smile lines, softer jaw ---- */
  if (o.older){
    const L1 = mix(SH, INK, 0.25), L2 = mix(SK, SH, 0.75);
    c.lineCap = 'round';
    /* across the forehead */
    for (const [y, w, a] of [[160, 46, 1], [172, 54, 0.9], [184, 40, 0.7]]){ c.beginPath(); c.moveTo(300 - w, y + 3); c.quadraticCurveTo(300, y - 4, 300 + w, y + 2); c.strokeStyle = L2; c.lineWidth = 2; c.globalAlpha = a; c.stroke(); }
    c.globalAlpha = 1;
    /* between the brows */
    c.beginPath(); c.moveTo(292, 206); c.lineTo(294, 190); c.moveTo(308, 206); c.lineTo(306, 192); c.strokeStyle = L1; c.lineWidth = 1.6; c.stroke();
    /* crow's feet, at both eyes' outer corners (the patch's too) */
    for (const s of [-1, 1]){ const x = 300 + s * 76; for (const [dy, l] of [[-6, 12], [0, 14], [7, 11]]){ c.beginPath(); c.moveTo(x, 232 + dy * 0.5); c.lineTo(x + s * l, 232 + dy); c.strokeStyle = L1; c.lineWidth = 1.5; c.stroke(); } }
    /* bags under the eyes */
    for (const s of [-1, 1]){ c.beginPath(); c.moveTo(300 + s * 28, 252); c.quadraticCurveTo(300 + s * 46, 262, 300 + s * 64, 250); c.strokeStyle = L2; c.lineWidth = 1.8; c.stroke(); }
    /* smile lines, nose to mouth; and down from the mouth's corners */
    for (const s of [-1, 1]){ c.beginPath(); c.moveTo(300 + s * 24, 300); c.bezierCurveTo(300 + s * 40, 314, 300 + s * 42, 328, 300 + s * 38, 346); c.strokeStyle = L1; c.lineWidth = 2.2; c.stroke(); c.beginPath(); c.moveTo(300 + s * 32, 340); c.quadraticCurveTo(300 + s * 36, 352, 300 + s * 34, 362); c.strokeStyle = L2; c.lineWidth = 1.6; c.stroke(); }
    /* the neck: a couple of lines */
    c.beginPath(); c.moveTo(266, 404); c.quadraticCurveTo(300, 412, 334, 404); c.strokeStyle = L2; c.lineWidth = 1.6; c.stroke();
  }
  /* ---- hair in front ---- */
  hairFront(c, o, HR, HRD, HRL, INK);
  /* ---- an eyepatch, over one eye, its strap round the head ---- */
  if (o.patch){
    const s = o.patch === 'right' ? 1 : -1, E2 = Object.assign({ gap: 44, size: 1 }, o.eyes || {}), ex = 300 + s * E2.gap, ey = 230;
    /* the strap: up across the forehead from the patch, and back round the side */
    c.beginPath(); c.moveTo(ex - s * 18, ey - 12); c.quadraticCurveTo(300 - s * 10, 170, 300 - s * 96, 150); ink(c, 9, INK); c.beginPath(); c.moveTo(ex - s * 18, ey - 12); c.quadraticCurveTo(300 - s * 10, 170, 300 - s * 96, 150); ink(c, 5, '#2e2a2a');
    c.beginPath(); c.moveTo(ex + s * 22, ey + 2); c.quadraticCurveTo(300 + s * 82, 236, 300 + s * 96, 238); ink(c, 9, INK); c.beginPath(); c.moveTo(ex + s * 22, ey + 2); c.quadraticCurveTo(300 + s * 82, 236, 300 + s * 96, 238); ink(c, 5, '#2e2a2a');
    /* the patch */
    const w = 27 * E2.size, h = 20 * E2.size;
    shape(c, [[ex - w, ey - h * 0.55], [ex - w * 0.4, ey - h * 1.05, ex + w * 0.5, ey - h * 1.05, ex + w, ey - h * 0.4], [ex + w * 1.05, ey + h * 0.5, ex + w * 0.4, ey + h * 1.05, ex - w * 0.2, ey + h], [ex - w * 0.8, ey + h * 0.8, ex - w * 1.08, ey + h * 0.2, ex - w, ey - h * 0.55]]);
    c.fillStyle = '#26232a'; c.fill(); ink(c, 3.5, INK);
    /* stitching and a sheen */
    c.save(); c.setLineDash([3, 4]); shape(c, [[ex - w * 0.8, ey - h * 0.42], [ex - w * 0.3, ey - h * 0.85, ex + w * 0.4, ey - h * 0.85, ex + w * 0.82, ey - h * 0.3], [ex + w * 0.85, ey + h * 0.4, ex + w * 0.3, ey + h * 0.85, ex - w * 0.15, ey + h * 0.8], [ex - w * 0.65, ey + h * 0.65, ex - w * 0.88, ey + h * 0.15, ex - w * 0.8, ey - h * 0.42]]); c.strokeStyle = '#5a5458'; c.lineWidth = 1.4; c.stroke(); c.restore();
    c.beginPath(); c.ellipse(ex - w * 0.3, ey - h * 0.45, w * 0.35, h * 0.14, -0.3, 0, 7); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill();
  }
  /* ---- headset ---- */
  if (o.cups){
    /* a tactical headset: a band over the top, big olive earcups both sides, the mic on her left */
    c.beginPath(); c.arc(300, 214, 134, Math.PI * 1.08, Math.PI * 1.92); c.strokeStyle = INK; c.lineWidth = 14; c.stroke(); c.strokeStyle = '#2a2c2a'; c.lineWidth = 9; c.stroke();
    for (const s of [-1, 1]){
      c.beginPath(); c.moveTo(300 + s * 116, 150); c.lineTo(300 + s * 116, 208); ink(c, 6, '#9a9a9a');
      const cx = 300 + s * 116, cy = 262;
      /* the padded cushion against her head, then the olive shell */
      c.beginPath(); c.ellipse(cx - s * 10, cy, 30, 58, 0, 0, 7); c.fillStyle = '#1a1c1a'; c.fill(); ink(c, 3.5, INK);
      c.beginPath(); c.ellipse(cx + s * 6, cy, 34, 56, 0, 0, 7); c.fillStyle = s > 0 ? '#3a4228' : '#5a6440'; c.fill(); ink(c, 4, INK);
      c.beginPath(); c.ellipse(cx + s * 2, cy - 18, 16, 22, 0, Math.PI * 1.1, Math.PI * 1.7); ink(c, 2.5, s > 0 ? '#4a5434' : '#7a8456');
      c.beginPath(); c.arc(cx + s * 10, cy + 30, 10, 0, 7); c.fillStyle = '#1e201c'; c.fill(); ink(c, 2.5, INK);
      c.beginPath(); c.roundRect(cx - 8 + s * 6, cy - 30, 16, 24, 4); c.fillStyle = '#2a2c28'; c.fill(); ink(c, 2, INK);
    }
    c.beginPath(); c.moveTo(428, 292); c.bezierCurveTo(414, 334, 372, 354, 334, 356); c.strokeStyle = INK; c.lineWidth = 10; c.stroke(); c.strokeStyle = '#2e302c'; c.lineWidth = 6; c.stroke();
    c.beginPath(); c.ellipse(322, 358, 22, 15, 0, 0, 7); c.fillStyle = '#141414'; c.fill(); ink(c, 2.5, INK);
    c.beginPath(); c.moveTo(430, 300); c.quadraticCurveTo(440, 420, 460, 600); ink(c, 3, '#1a1a1a');
    return cv;
  }
  c.beginPath(); c.arc(300, 214, 112, Math.PI * 1.08, Math.PI * 1.92); c.strokeStyle = INK; c.lineWidth = 14; c.stroke(); c.strokeStyle = '#4a4e58'; c.lineWidth = 9; c.stroke();
  c.beginPath(); c.roundRect(176, 216, 32, 66, 9); c.fillStyle = '#3a3e48'; c.fill(); ink(c, 3.5, INK); c.fillStyle = '#ff8a2a'; c.fillRect(184, 230, 16, 5);
  c.beginPath(); c.moveTo(194, 278); c.bezierCurveTo(206, 330, 236, 340, 262, 336); c.strokeStyle = INK; c.lineWidth = 9; c.stroke(); c.strokeStyle = '#4a4e58'; c.lineWidth = 5; c.stroke();
  c.beginPath(); c.ellipse(266, 336, 11, 8, 0, 0, 7); c.fillStyle = '#2a2d34'; c.fill(); ink(c, 2.5, INK);
  /* rim light from the warning lamp, on the shadow side */
  c.beginPath(); c.moveTo(399, 200); c.bezierCurveTo(401, 250, 392, 288, 376, 316); c.strokeStyle = 'rgba(255,150,80,.8)'; c.lineWidth = 3; c.stroke();
  return cv;
}

function gear(c, o, INK){
  const G = o.gearCol || '#4a5260', GD = mix(G, '#000000', 0.45), GL = mix(G, '#ffffff', 0.25);
  /* body: shoulders */
  shape(c, [[20, 600], [40, 500, 120, 456, 236, 440], [364, 440], [480, 456, 560, 500, 580, 600]]); c.fillStyle = G; c.fill(); ink(c, 4, INK);
  /* shadow side of the body */
  shape(c, [[330, 440], [364, 440], [480, 456, 560, 500, 580, 600], [380, 600], [400, 520, 370, 470, 330, 440]]); c.fillStyle = GD; c.fill();
  if (o.gear === 'camo'){
    /* camo blotches over the jacket */
    c.save(); shape(c, [[20, 600], [40, 500, 120, 456, 236, 440], [364, 440], [480, 456, 560, 500, 580, 600]]); c.clip();
    const blots = [['#6a7448', 0.7], ['#3e4628', 0.6], ['#8a8a5a', 0.45]];
    for (let k = 0; k < 26; k++){ const [col, a] = blots[k % 3]; c.fillStyle = col; c.globalAlpha = a; c.beginPath(); c.ellipse(40 + (k * 97) % 540, 450 + (k * 53) % 150, 30 + (k % 4) * 10, 14 + (k % 3) * 6, (k % 5) * 0.6, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    shape(c, [[330, 440], [364, 440], [480, 456, 560, 500, 580, 600], [380, 600], [400, 520, 370, 470, 330, 440]]); c.fillStyle = 'rgba(20,24,10,.45)'; c.fill();
    c.restore();
    /* the collar, open, folded down both sides */
    for (const s of [-1, 1]){ shape(c, [[300 + s * 52, 412], [300 + s * 118, 436], [300 + s * 98, 486], [300 + s * 18, 472]]); c.fillStyle = s > 0 ? '#3e4628' : '#5a6440'; c.fill(); ink(c, 3.5, INK); }
    shape(c, [[262, 440], [300, 482], [338, 440], [330, 470, 300, 500, 270, 470]]); c.fillStyle = '#4a5232'; c.fill(); ink(c, 2.5, INK);
    /* chevrons on the chest */
    for (let k = 0; k < 3; k++){ c.beginPath(); c.moveTo(178, 520 + k * 12); c.lineTo(204, 536 + k * 12); c.lineTo(230, 520 + k * 12); c.strokeStyle = INK; c.lineWidth = 8; c.stroke(); c.strokeStyle = '#c8b888'; c.lineWidth = 5; c.stroke(); }
    /* a tag on its chain */
    c.beginPath(); c.moveTo(324, 456); c.quadraticCurveTo(340, 520, 352, 560); c.strokeStyle = '#9a9a9a'; c.lineWidth = 2; c.setLineDash([3, 2]); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.roundRect(340, 556, 26, 38, 4); c.fillStyle = '#b8b8b0'; c.fill(); ink(c, 2.5, INK);
    return;
  }
  if (o.gear === 'armor'){
    for (const s of [-1, 1]){
      shape(c, [[300 + s * 90, 452], [300 + s * 170, 430, 300 + s * 250, 470, 300 + s * 262, 540], [300 + s * 200, 540, 300 + s * 140, 520, 300 + s * 96, 500]]); c.fillStyle = s > 0 ? GD : G; c.fill(); ink(c, 4, INK);
      c.beginPath(); c.moveTo(300 + s * 110, 470); c.bezierCurveTo(300 + s * 170, 456, 300 + s * 220, 480, 300 + s * 240, 520); ink(c, 2.5, s > 0 ? GD : GL);
      c.fillStyle = INK; for (const k of [0, 1]) { c.beginPath(); c.arc(300 + s * (150 + k * 50), 490 + k * 12, 4, 0, 7); c.fill(); }
    }
    shape(c, [[236, 420], [300, 410, 364, 420], [370, 456], [300, 466, 230, 456]]); c.fillStyle = mix(G, '#000', 0.25); c.fill(); ink(c, 3.5, INK);
    c.fillStyle = o.accent || '#ff8a2a'; c.fillRect(250, 438, 100, 5);
    c.fillStyle = o.accent || '#ff8a2a'; c.fillRect(140, 500, 30, 7); c.fillRect(140, 512, 30, 7);
  } else if (o.gear === 'flight'){
    shape(c, [[226, 432], [300, 470, 374, 432], [392, 462], [300, 510, 208, 462]]); c.fillStyle = '#8a6a48'; c.fill(); ink(c, 3.5, INK);
    for (let k = 0; k < 9; k++){ c.beginPath(); c.moveTo(220 + k * 20, 450 + Math.abs(k - 4) * -3); c.lineTo(224 + k * 20, 470); ink(c, 2, '#5a4430'); }
    c.beginPath(); c.moveTo(200, 470); c.lineTo(330, 600); c.strokeStyle = INK; c.lineWidth = 18; c.stroke(); c.strokeStyle = '#2e2e2e'; c.lineWidth = 12; c.stroke();
    c.beginPath(); c.roundRect(400, 500, 66, 38, 5); c.fillStyle = '#b03030'; c.fill(); ink(c, 3, INK); c.fillStyle = '#fff'; c.font = '800 22px sans-serif'; c.fillText('NV', 414, 527);
  } else if (o.gear === 'coat'){
    for (const s of [-1, 1]){ shape(c, [[300 + s * 60, 436], [300 + s * 170, 470], [300 + s * 90, 600], [300 + s * 40, 600]]); c.fillStyle = s > 0 ? GD : GL; c.fill(); ink(c, 3.5, INK); }
    shape(c, [[262, 436], [300, 500], [338, 436]]); c.fillStyle = '#d8c8a8'; c.fill(); ink(c, 3, INK);
  } else {
    for (const k of [0, 1]){ c.beginPath(); c.roundRect(150 + k * 220, 486, 82, 70, 8); c.fillStyle = k ? GD : GL; c.fill(); ink(c, 3.5, INK); c.beginPath(); c.moveTo(158 + k * 220, 500); c.lineTo(224 + k * 220, 500); ink(c, 2.5, INK); }
    c.beginPath(); c.moveTo(250, 440); c.lineTo(300, 484); c.lineTo(350, 440); ink(c, 5, INK);
  }
}

function hairFront(c, o, HR, HRD, HRL, INK){
  const st = o.style;
  if (st === 'buzz'){
    shape(c, [[202, 214], [196, 140, 246, 104, 300, 104], [354, 104, 404, 140, 398, 214], [390, 170, 360, 140, 300, 138], [240, 140, 210, 170, 202, 214]]); c.fillStyle = HRD; c.globalAlpha = 0.9; c.fill(); c.globalAlpha = 1; ink(c, 3, INK);
    c.fillStyle = HRL; c.globalAlpha = 0.35; for (let k = 0; k < 40; k++){ c.fillRect(220 + (k * 37) % 160, 112 + (k * 13) % 28, 2, 2); } c.globalAlpha = 1;
    return;
  }
  if (st === 'slick'){
    /* swept straight back from the forehead, a wave at the temple, loose strands */
    const top = () => shape(c, [[202, 220], [180, 110, 244, 56, 304, 56], [368, 56, 424, 110, 400, 220], [392, 168, 364, 132, 334, 128], [308, 122, 284, 122, 260, 132], [232, 146, 212, 176, 202, 220]]);
    top(); c.fillStyle = HR; c.fill();
    c.save(); top(); c.clip();
    shape(c, [[334, 128], [364, 132, 392, 168, 400, 220], [420, 140, 380, 80, 330, 76]]); c.fillStyle = HRD; c.fill();
    /* combed lines, swept back over the head */
    for (let k = 0; k < 16; k++){ const x = 214 + k * 12; c.beginPath(); c.moveTo(x, 140 - Math.abs(k - 7.5) * 1.5); c.bezierCurveTo(x + (k - 7.5) * 1.5, 110, x + (k - 7.5) * 3, 90, x + (k - 7.5) * 5, 66); ink(c, k % 2 ? 2.4 : 1.4, k % 3 ? HRL : mix(HR, '#000', 0.25)); }
    c.restore();
    top(); ink(c, 4, INK);
    /* the wave over her left temple */
    shape(c, [[212, 196], [210, 160, 228, 136, 252, 128], [236, 150, 226, 172, 228, 206]]); c.fillStyle = HRL; c.fill(); ink(c, 2.5, INK);
    /* loose strands by the ears */
    for (const [x, y, d] of [[208, 230, -1], [392, 232, 1]]){ c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + d * 8, y + 30, x - d * 4, y + 60, x + d * 6, y + 92); ink(c, 1.8, HRL); }
    return;
  }
  if (st === 'undercut'){
    /* shaved side (left), the rest swept over to the right */
    shape(c, [[202, 230], [198, 170, 220, 130, 252, 116], [258, 170], [240, 200, 212, 220, 202, 230]]); c.fillStyle = mix(HRD, '#888', 0.25); c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; ink(c, 2.5, INK);
    shape(c, [[240, 160], [236, 96, 330, 70, 392, 108], [420, 140, 412, 200, 400, 236], [390, 180, 360, 156, 330, 156], [310, 176, 300, 200, 304, 214], [282, 190, 264, 170, 240, 160]]); c.fillStyle = HR; c.fill(); ink(c, 4, INK);
    shape(c, [[330, 156], [360, 156, 390, 180, 400, 236], [410, 180, 400, 130, 370, 110], [360, 130, 344, 140, 330, 156]]); c.fillStyle = HRD; c.fill();
    c.beginPath(); c.moveTo(270, 120); c.bezierCurveTo(310, 100, 350, 104, 380, 120); ink(c, 3, HRL); c.beginPath(); c.moveTo(262, 140); c.bezierCurveTo(300, 124, 330, 126, 352, 140); ink(c, 2, HRL);
  } else {
    /* swept back / cropped / tied: a hairline, parted, strands */
    shape(c, [[202, 226], [190, 140, 246, 92, 304, 94], [368, 96, 412, 144, 398, 230], [388, 176, 362, 146, 322, 140], [300, 150, 262, 148, 236, 170], [218, 186, 208, 206, 202, 226]]); c.fillStyle = HR; c.fill(); ink(c, 4, INK);
    shape(c, [[322, 140], [362, 146, 388, 176, 398, 230], [408, 170, 390, 120, 350, 104], [340, 118, 330, 128, 322, 140]]); c.fillStyle = HRD; c.fill();
    for (const [a, b, w] of [[[236, 120], [300, 104], 3], [[250, 132], [320, 116], 2], [[318, 104], [372, 130], 2.5]]){ c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 10, b[0], b[1]); ink(c, w, HRL); }
    if (st === 'crop'){ shape(c, [[256, 146], [246, 176, 250, 196, 240, 214], [258, 186, 266, 164, 270, 148]]); c.fillStyle = HR; c.fill(); ink(c, 2, INK); }
    if (st === 'tied'){ c.beginPath(); c.ellipse(300, 96, 30, 16, 0, 0, 7); c.fillStyle = HRD; c.fill(); ink(c, 3, INK); }
  }
  if (o.grey){ c.beginPath(); c.moveTo(320, 98); c.bezierCurveTo(350, 108, 380, 140, 394, 200); c.strokeStyle = INK; c.lineWidth = 11; c.stroke(); c.strokeStyle = '#d8d8d8'; c.lineWidth = 7; c.stroke(); }
}

/* Painted once, kept. */
let PORTRAIT;
const art = () => (PORTRAIT === undefined ? (PORTRAIT = portrait()) : PORTRAIT);
/* (the portrait itself, for previews) */
export const novaPortrait = art;

/* The feed, built for a box size: three colour-split copies of her (red,
   green, blue), so the split costs three draws a frame; and a few frames
   of grain to cycle. */
const FEEDS = new Map();
function feedFor(w, h){
  const key = `${w}x${h}`;
  if (FEEDS.has(key)) return FEEDS.get(key);
  const P = art(); if (!P){ FEEDS.set(key, null); return null; }
  const s = Math.max(w / 600, h / 600) * 1.02, ox = (w - 600 * s) / 2, oy = (h - 600 * s) / 2 + h * 0.03;
  const base = mk(w, h), bc = base.getContext('2d');
  /* (brightened a little: the split and the grain darken it) */
  try { bc.filter = 'brightness(1.25) contrast(1.05)'; } catch (e){}
  bc.drawImage(P, ox, oy, 600 * s, 600 * s); bc.filter = 'none';
  const chans = ['#ff0000', '#00ff00', '#0000ff'].map(col => { const cv = mk(w, h), cc = cv.getContext('2d'); cc.drawImage(base, 0, 0); cc.globalCompositeOperation = 'multiply'; cc.fillStyle = col; cc.fillRect(0, 0, w, h); return cv; });
  const grain = [0, 1, 2, 3].map(() => { const cv = mk(w, h), gc = cv.getContext('2d'), d = gc.createImageData(w, h), p = d.data; for (let i = 0; i < p.length; i += 4){ const n = Math.random() * 255; p[i] = p[i + 1] = p[i + 2] = n; p[i + 3] = 34; } gc.putImageData(d, 0, 0); return cv; });
  const mix = mk(w, h);
  /* where her mouth and eyes land in the box, for talking and blinking */
  const at = (u, v) => [ox + u * s, oy + v * s];
  const f = { base, chans, grain, mix, s, at };
  FEEDS.set(key, f); return f;
}

/* A little random that holds still for a moment: glitches come in bursts. */
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

export function novaFeed(c, x, y, w, h, t, talking){
  w = Math.round(w); h = Math.round(h);
  const f = feedFor(w, h); if (!f) return false;
  const m = f.mix.getContext('2d');
  /* the colours split, wavering */
  const tick = Math.floor(t * 10), burst = hash(Math.floor(t * 1.3)) > 0.6;
  const dx = Math.max(1, w * 0.008) * (1 + (burst ? 1.5 : 0) + Math.sin(t * 3));
  m.globalCompositeOperation = 'source-over'; m.fillStyle = '#000'; m.fillRect(0, 0, w, h);
  m.globalCompositeOperation = 'lighter';
  m.drawImage(f.chans[0], -dx, 0); m.drawImage(f.chans[1], 0, 0); m.drawImage(f.chans[2], dx, 0);
  m.globalCompositeOperation = 'source-over';
  /* rows of the picture jumping sideways, in bursts */
  if (burst) for (let k = 0; k < 5; k++){ const r = hash(tick * 7 + k), yy = r * h, hh = 3 + hash(tick * 3 + k) * h * 0.06, sx = (hash(tick * 11 + k) - 0.5) * w * 0.15; m.drawImage(f.mix, 0, yy, w, hh, sx, yy, w, hh); }
  /* grain, scan lines, a faint bright line rolling down */
  m.drawImage(f.grain[tick % 4], 0, 0);
  m.fillStyle = 'rgba(0,0,0,.22)'; for (let k = 0; k < h; k += 3) m.fillRect(0, k, w, 1);
  m.fillStyle = 'rgba(255,255,255,.12)'; m.fillRect(0, ((t * 0.25) % 1) * h, w, Math.max(2, h * 0.012));
  c.drawImage(f.mix, x, y);
  /* talking: a little voice meter, bottom right, jumping with her words */
  if (talking){ c.save(); for (let k = 0; k < 7; k++){ const v = 0.25 + 0.75 * Math.abs(Math.sin(t * (9 + k * 1.7) + k)); c.fillStyle = 'rgba(127,243,255,.9)'; const bw = w * 0.012, bh = h * 0.1 * v; c.fillRect(x + w * 0.62 + k * bw * 1.8, y + h * 0.93 - bh, bw, bh); } c.restore(); }
  /* SIGNAL WEAK, blinking; one bar of four */
  const fs = Math.round(h * 0.085);
  c.save(); c.textBaseline = 'middle';
  if (Math.floor(t * 1.6) % 2 === 0){ c.font = `800 ${fs}px Fredoka, sans-serif`; c.textAlign = 'left'; c.fillStyle = '#ff6b6b'; c.fillText('SIGNAL WEAK', x + w * 0.05, y + h * 0.9); }
  for (let k = 0; k < 4; k++){ c.fillStyle = k < 1 ? '#ff6b6b' : 'rgba(255,255,255,.3)'; const bw = w * 0.018; c.fillRect(x + w * 0.83 + k * bw * 1.6, y + h * 0.93 - (k + 1) * h * 0.022, bw, (k + 1) * h * 0.022); }
  c.restore();
  return true;
}
