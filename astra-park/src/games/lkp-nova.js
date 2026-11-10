/* Commander Nova on the radio: a painted, grown-up portrait of her, shown
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

/* Her portrait, 600 x 600: head and shoulders, the bridge behind her. */
function portrait(L = {}){
  if (!mk(1, 1)) return null;
  const cv = mk(600, 600), c = cv.getContext('2d');
  const key = L.key || 'rgba(255,236,214,0.0)', rim = L.rim || 'rgba(120,200,255,.55)';
  /* behind her: the ship's bridge, out of focus */
  c.fillStyle = lg(c, 0, 0, 0, 600, L.bg || [[0, '#1d2a44'], [1, '#0c1322']]); c.fillRect(0, 0, 600, 600);
  c.save(); c.filter = 'blur(14px)';
  for (let k = 0; k < 14; k++){ c.fillStyle = ['rgba(90,200,255,.5)', 'rgba(255,170,80,.45)', 'rgba(120,255,200,.35)'][k % 3]; c.beginPath(); c.arc(40 + (k * 97) % 560, 80 + (k * 53) % 260, 6 + (k % 4) * 5, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(40,60,90,.8)'; c.fillRect(0, 330, 600, 40); c.restore();
  /* hair behind (a low bun, a few loose strands) */
  c.fillStyle = '#2a1c18'; c.beginPath(); c.ellipse(300, 215, 128, 140, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(395, 270, 50, 46, 0, 0, 7); c.fill();
  /* neck */
  c.fillStyle = lg(c, 250, 0, 350, 0, [[0, '#9a6a52'], [0.5, '#c08a6c'], [1, '#8a5c46']]);
  c.beginPath(); c.moveTo(255, 330); c.lineTo(345, 330); c.lineTo(352, 430); c.lineTo(248, 430); c.fill();
  c.fillStyle = 'rgba(60,30,25,.45)'; c.beginPath(); c.ellipse(300, 345, 50, 22, 0, 0, 7); c.fill();
  /* uniform: shoulders, high collar, piping, insignia */
  c.fillStyle = lg(c, 0, 400, 0, 600, [[0, '#2c3c5e'], [1, '#141c30']]);
  c.beginPath(); c.moveTo(60, 600); c.bezierCurveTo(80, 470, 170, 430, 250, 415); c.lineTo(350, 415); c.bezierCurveTo(430, 430, 520, 470, 540, 600); c.fill();
  c.fillStyle = '#22304e'; c.beginPath(); c.moveTo(240, 418); c.lineTo(300, 470); c.lineTo(360, 418); c.lineTo(352, 395); c.lineTo(300, 440); c.lineTo(248, 395); c.fill();
  c.strokeStyle = '#ffd24a'; c.lineWidth = 3; c.beginPath(); c.moveTo(244, 410); c.lineTo(300, 462); c.lineTo(356, 410); c.stroke();
  c.fillStyle = '#ffd24a'; for (let k = 0; k < 3; k++) c.fillRect(400 + k * 16, 488, 10, 22);
  c.fillStyle = '#7ff3ff'; c.beginPath(); c.arc(190, 500, 10, 0, 7); c.fill();
  /* face */
  const skin = lg(c, 210, 0, 390, 0, [[0, '#b27a5e'], [0.35, '#d8a184'], [0.6, '#dfa98c'], [1, '#a46c52']]);
  c.fillStyle = skin; c.beginPath();
  c.moveTo(300, 120); c.bezierCurveTo(372, 120, 392, 180, 388, 240); c.bezierCurveTo(385, 290, 360, 335, 300, 350); c.bezierCurveTo(240, 335, 215, 290, 212, 240); c.bezierCurveTo(208, 180, 228, 120, 300, 120); c.fill();
  /* ears */
  for (const s of [-1, 1]){ c.fillStyle = '#c08a6c'; c.beginPath(); c.ellipse(300 + s * 90, 245, 13, 26, s * 0.15, 0, 7); c.fill(); }
  /* shading: cheekbones, jaw, under the brow */
  c.fillStyle = rg(c, 300, 230, 40, 140, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(70,35,25,.35)']]); c.beginPath(); c.ellipse(300, 235, 90, 116, 0, 0, 7); c.fill();
  for (const s of [-1, 1]){ c.fillStyle = rg(c, 300 + s * 48, 262, 0, 30, [[0, 'rgba(225,120,110,.28)'], [1, 'rgba(225,120,110,0)']]); c.beginPath(); c.arc(300 + s * 48, 262, 30, 0, 7); c.fill(); }
  /* brows */
  c.strokeStyle = '#2a1a16'; c.lineCap = 'round';
  for (const s of [-1, 1]){ c.lineWidth = 7; c.beginPath(); c.moveTo(300 + s * 14, 200); c.quadraticCurveTo(300 + s * 40, 188, 300 + s * 68, 198); c.stroke(); }
  /* eyes: almond, a lid crease, iris, catchlight */
  for (const s of [-1, 1]){
    const ex = 300 + s * 40, ey = 225;
    c.fillStyle = 'rgba(80,40,35,.25)'; c.beginPath(); c.ellipse(ex, ey - 6, 26, 12, 0, 0, 7); c.fill();
    c.fillStyle = '#f4ece6'; c.beginPath(); c.moveTo(ex - 22, ey); c.quadraticCurveTo(ex, ey - 13, ex + 22, ey); c.quadraticCurveTo(ex, ey + 9, ex - 22, ey); c.fill();
    c.save(); c.clip(); c.fillStyle = rg(c, ex + 1, ey - 1, 1, 9, [[0, '#6a4a2e'], [0.7, '#3a2618'], [1, '#1a100a']]); c.beginPath(); c.arc(ex + 1, ey - 1, 9, 0, 7); c.fill(); c.fillStyle = '#0b0705'; c.beginPath(); c.arc(ex + 1, ey - 1, 4, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(ex - 2, ey - 4, 2.2, 0, 7); c.fill(); c.restore();
    c.strokeStyle = '#2a1712'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(ex - 23, ey + 1); c.quadraticCurveTo(ex, ey - 14, ex + 23, ey - 1); c.stroke();
    c.strokeStyle = 'rgba(90,50,40,.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ex - 18, ey - 10); c.quadraticCurveTo(ex, ey - 19, ex + 19, ey - 9); c.stroke();
  }
  /* nose: a soft shadow down one side, the tip, nostrils */
  c.strokeStyle = 'rgba(110,60,45,.45)'; c.lineWidth = 3; c.beginPath(); c.moveTo(292, 230); c.quadraticCurveTo(286, 265, 288, 282); c.stroke();
  c.fillStyle = rg(c, 302, 280, 0, 18, [[0, 'rgba(240,190,160,.6)'], [1, 'rgba(240,190,160,0)']]); c.beginPath(); c.arc(302, 280, 18, 0, 7); c.fill();
  c.fillStyle = 'rgba(80,35,30,.55)'; for (const s of [-1, 1]){ c.beginPath(); c.ellipse(300 + s * 9, 290, 5, 2.5, s * 0.3, 0, 7); c.fill(); }
  /* mouth: upper and lower lip, a slight determined set */
  c.fillStyle = '#a65a50'; c.beginPath(); c.moveTo(276, 314); c.quadraticCurveTo(290, 306, 300, 310); c.quadraticCurveTo(310, 306, 324, 314); c.quadraticCurveTo(300, 318, 276, 314); c.fill();
  c.fillStyle = '#b8695c'; c.beginPath(); c.moveTo(279, 315); c.quadraticCurveTo(300, 330, 321, 315); c.quadraticCurveTo(300, 319, 279, 315); c.fill();
  c.strokeStyle = 'rgba(70,25,25,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(276, 314); c.quadraticCurveTo(300, 318, 324, 314); c.stroke();
  /* hair in front: swept back, parted, a loose strand */
  c.fillStyle = '#2f201b'; c.beginPath(); c.moveTo(212, 230); c.bezierCurveTo(200, 140, 260, 95, 310, 100); c.bezierCurveTo(370, 102, 400, 150, 390, 232); c.bezierCurveTo(380, 180, 350, 150, 312, 148); c.bezierCurveTo(290, 160, 250, 150, 222, 200); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(120,80,60,.45)'; c.lineWidth = 1.5; for (let k = 0; k < 18; k++){ c.beginPath(); c.moveTo(230 + k * 8, 110 + Math.abs(k - 9) * 4); c.quadraticCurveTo(250 + k * 7, 140, 225 + k * 9, 190 - Math.abs(k - 9) * 3); c.stroke(); }
  c.strokeStyle = '#2f201b'; c.lineWidth = 3; c.beginPath(); c.moveTo(240, 160); c.bezierCurveTo(220, 200, 230, 240, 222, 270); c.stroke();
  /* headset: band over the head, earpiece, boom mic */
  c.strokeStyle = '#3a4258'; c.lineWidth = 9; c.beginPath(); c.arc(300, 210, 104, Math.PI * 1.08, Math.PI * 1.95); c.stroke();
  c.fillStyle = '#4a5470'; c.beginPath(); c.roundRect(186, 220, 26, 52, 10); c.fill(); c.fillStyle = '#7ff3ff'; c.beginPath(); c.arc(199, 246, 4, 0, 7); c.fill();
  c.strokeStyle = '#4a5470'; c.lineWidth = 5; c.beginPath(); c.moveTo(200, 268); c.quadraticCurveTo(220, 320, 268, 322); c.stroke(); c.fillStyle = '#2a3044'; c.beginPath(); c.ellipse(272, 322, 10, 7, 0, 0, 7); c.fill();
  /* light: a key light from one side, a cool rim from behind */
  c.globalCompositeOperation = 'soft-light'; c.fillStyle = lg(c, 150, 0, 450, 0, [[0, L.keyCol || 'rgba(255,230,200,.7)'], [1, 'rgba(0,0,30,.6)']]); c.fillRect(0, 0, 600, 600);
  c.globalCompositeOperation = 'source-over';
  c.strokeStyle = rim; c.lineWidth = 4; c.beginPath(); c.moveTo(388, 200); c.bezierCurveTo(392, 260, 380, 310, 345, 338); c.stroke();
  return cv;
}

/* Painted once, kept. */
let PORTRAIT;
const art = () => (PORTRAIT === undefined ? (PORTRAIT = portrait()) : PORTRAIT);

/* The feed, built for a box size: three colour-split copies of her (red,
   green, blue), so the split costs three draws a frame; and a few frames
   of grain to cycle. */
const FEEDS = new Map();
function feedFor(w, h){
  const key = `${w}x${h}`;
  if (FEEDS.has(key)) return FEEDS.get(key);
  const P = art(); if (!P){ FEEDS.set(key, null); return null; }
  const s = Math.max(w / 600, h / 600) * 1.05, ox = (w - 600 * s) / 2, oy = (h - 600 * s) / 2 - h * 0.12;
  const base = mk(w, h), bc = base.getContext('2d');
  /* (brightened a little: the split and the grain darken it) */
  try { bc.filter = 'brightness(1.35) contrast(1.05)'; } catch (e){}
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
  /* talking: her mouth moving; and she blinks now and then */
  const [mx, my] = f.at(300, 316), sc = f.s;
  if (talking){ const o = Math.abs(Math.sin(t * 13)) * 0.7 + Math.abs(Math.sin(t * 7.3)) * 0.3; m.fillStyle = '#3a1618'; m.beginPath(); m.ellipse(mx, my + 2 * sc, 18 * sc, 2 * sc + o * 9 * sc, 0, 0, 6.2832); m.fill(); }
  if ((t % 4.1) < 0.13) for (const s of [-1, 1]){ const [ex, ey] = f.at(300 + s * 40, 225); m.fillStyle = '#c4886a'; m.beginPath(); m.ellipse(ex, ey, 24 * sc, 12 * sc, 0, 0, 6.2832); m.fill(); }
  /* rows of the picture jumping sideways, in bursts */
  if (burst) for (let k = 0; k < 5; k++){ const r = hash(tick * 7 + k), yy = r * h, hh = 3 + hash(tick * 3 + k) * h * 0.06, sx = (hash(tick * 11 + k) - 0.5) * w * 0.15; m.drawImage(f.mix, 0, yy, w, hh, sx, yy, w, hh); }
  /* grain, scan lines, a faint bright line rolling down */
  m.drawImage(f.grain[tick % 4], 0, 0);
  m.fillStyle = 'rgba(0,0,0,.22)'; for (let k = 0; k < h; k += 3) m.fillRect(0, k, w, 1);
  m.fillStyle = 'rgba(255,255,255,.12)'; m.fillRect(0, ((t * 0.25) % 1) * h, w, Math.max(2, h * 0.012));
  c.drawImage(f.mix, x, y);
  /* SIGNAL WEAK, blinking; one bar of four */
  const fs = Math.round(h * 0.085);
  c.save(); c.textBaseline = 'middle';
  if (Math.floor(t * 1.6) % 2 === 0){ c.font = `800 ${fs}px Fredoka, sans-serif`; c.textAlign = 'left'; c.fillStyle = '#ff6b6b'; c.fillText('SIGNAL WEAK', x + w * 0.05, y + h * 0.9); }
  for (let k = 0; k < 4; k++){ c.fillStyle = k < 1 ? '#ff6b6b' : 'rgba(255,255,255,.3)'; const bw = w * 0.018; c.fillRect(x + w * 0.83 + k * bw * 1.6, y + h * 0.93 - (k + 1) * h * 0.022, bw, (k + 1) * h * 0.022); }
  c.restore();
  return true;
}
