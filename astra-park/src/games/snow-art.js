/* Snow Sled, painted. The view looks down a wide snowy run from just
   behind the sled, so the slope rises to the horizon and everything on it -
   presents, ramps, soft snowdrifts, friends waving from the side - comes
   toward you, growing as it nears.

   Depth is `rel`: 0 is the sled, 1 the horizon. P(lane, rel) turns a place
   on the run - lane -1 is the left edge of where the sled can go, 1 the
   right - into the screen. The sky and the mountains never move, so they are
   painted once per screen size. */

export const SLED = 0.03;             /* the sled's own depth */
export const HORIZON = 0.36;          /* screen heights */
const BOTTOM = 0.9;                   /* where the sled sits */
const HALF = 0.32;                    /* half the sled's range, in screen widths */
const S = (z) => 1 / (1 + 6 * Math.max(-0.1, z));

/* Where something on the run appears: { x, y, k } in pixels, k its scale
   relative to the same thing beside the sled. */
export function P(lane, rel, W, H){
  const k = S(rel) / S(SLED);
  const y = HORIZON + (BOTTOM - HORIZON) * (S(rel) - S(1)) / (S(SLED) - S(1));
  return { x: W * (0.5 + lane * HALF * k), y: y * H, k };
}

const hash = (i, k = 1) => ((((i + 7919) * 2654435761 * k) % 4294967296) + 4294967296) % 4294967296 / 4294967296;

let cache = null;
function sky(W, H){
  if (cache && cache.W === W && cache.H === H) return cache.cv;
  let cv = null;
  try { cv = document.createElement('canvas'); cv.width = Math.round(W); cv.height = Math.round(H * (HORIZON + 0.02)); if (!cv.getContext || !cv.getContext('2d')) cv = null; } catch { cv = null; }
  cache = { W, H, cv };
  if (cv) paintSky(cv.getContext('2d'), W, H);
  return cv;
}

function paintSky(c, W, H){
  const HY = H * HORIZON;
  let g = c.createLinearGradient(0, 0, 0, HY);
  g.addColorStop(0, '#78b2ea'); g.addColorStop(0.7, '#bfe0f7'); g.addColorStop(1, '#fde6da');
  c.fillStyle = g; c.fillRect(0, 0, W, HY + H * 0.02);
  g = c.createRadialGradient(W * 0.5, HY - H * 0.06, 0, W * 0.5, HY - H * 0.06, H * 0.35);
  g.addColorStop(0, 'rgba(255,246,215,.9)'); g.addColorStop(1, 'rgba(255,246,215,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, HY);
  c.fillStyle = '#fffbe8'; c.beginPath(); c.arc(W * 0.5, HY - H * 0.065, H * 0.043, 0, 6.2832); c.fill();
  const range = (pts, col, snow) => {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, HY + 2);
    for (const [x, y] of pts) c.lineTo(W * x, HY - y * H);
    c.lineTo(W, HY + 2); c.closePath(); c.fill();
    if (snow){
      c.fillStyle = '#ffffff';
      for (const [x, y] of pts){
        if (y < 0.08) continue;
        const px = W * x, py = HY - y * H, w = H * 0.043;
        c.beginPath(); c.moveTo(px, py); c.lineTo(px - w, py + w * 0.9); c.lineTo(px - w * 0.3, py + w * 0.7); c.lineTo(px + w * 0.3, py + w); c.lineTo(px + w, py + w * 0.9); c.closePath(); c.fill();
      }
    }
  };
  range([[0, 0.11], [0.1, 0.04], [0.2, 0.16], [0.33, 0.05], [0.42, 0.13], [0.55, 0.03], [0.66, 0.17], [0.78, 0.06], [0.9, 0.14], [1, 0.07]], '#9db3da', true);
  range([[0, 0.04], [0.15, 0.075], [0.28, 0.02], [0.4, 0.055], [0.6, 0.015], [0.75, 0.065], [0.9, 0.025], [1, 0.055]], '#c4d4ec', false);
  for (const [x, y, w] of [[0.15, 0.1, 0.13], [0.8, 0.08, 0.11], [0.63, 0.19, 0.07]]) puff(c, W * x, H * y, H * w);
}

function puff(c, x, y, w){
  c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath();
  for (const [dx, dy, r] of [[0, 0, 0.42], [-0.45, 0.12, 0.3], [0.45, 0.12, 0.32], [-0.2, -0.15, 0.32], [0.22, -0.1, 0.3]]){ c.moveTo(x + dx * w + r * w, y + dy * w); c.arc(x + dx * w, y + dy * w, r * w, 0, 6.2832); }
  c.moveTo(x + w * 0.72, y + w * 0.2); c.ellipse(x, y + w * 0.2, w * 0.72, w * 0.2, 0, 0, 6.2832); c.fill();
}

/* The sky and the run itself, with soft shadows streaming toward you. `z`
   is how far down the hill the sled has come. */
export function drawSlope(c, W, H, z){
  const cv = sky(W, H);
  if (cv) c.drawImage(cv, 0, 0, W, cv.height); else paintSky(c, W, H);
  const HY = H * HORIZON;
  const g = c.createLinearGradient(0, HY, 0, H);
  g.addColorStop(0, '#e6eff9'); g.addColorStop(1, '#ffffff');
  c.fillStyle = g; c.fillRect(0, HY, W, H - HY);
  /* The deeper snow beyond the edges of the run. */
  c.fillStyle = 'rgba(205,220,242,.6)';
  for (const side of [-1, 1]){
    const a = P(side * 1.3, 1, W, H), b = P(side * 1.3, -0.05, W, H);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(side < 0 ? 0 : W, H); c.lineTo(side < 0 ? 0 : W, HY); c.closePath(); c.fill();
  }
  /* Soft blue hollows in the snow, rushing past. */
  for (let i = Math.floor(z / 0.07); i < z / 0.07 + 16; i++){
    const rel = i * 0.07 - z;
    if (rel < -0.05 || rel > 1) continue;
    const lane = (hash(i, 3) - 0.5) * 2.2, p = P(lane, rel, W, H);
    c.fillStyle = `rgba(170,195,235,${0.28 * Math.min(1, (1 - rel) * 3)})`;
    c.beginPath(); c.ellipse(p.x, p.y, H * 0.12 * p.k, H * 0.018 * p.k, 0, 0, 6.2832); c.fill();
  }
  /* Two faint grooves where other sleds have been. */
  c.strokeStyle = 'rgba(160,185,225,.3)'; c.lineWidth = Math.max(2, H * 0.004); c.lineCap = 'round';
  for (const lane of [-0.5, 0.5]){
    c.beginPath();
    for (let k = 0; k <= 20; k++){ const rel = 1 - k / 20, p = P(lane + Math.sin((rel + z) * 9) * 0.08, rel, W, H); k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }
    c.stroke();
  }
}

/* The pines along both sides of the run, as things to sort among the rest. */
export function edgeTrees(z){
  const out = [];
  for (let i = Math.floor(z / 0.05); i < z / 0.05 + 22; i++){
    const rel = i * 0.05 - z;
    if (rel < -0.06 || rel > 1) continue;
    for (const side of [-1, 1]) out.push({ kind: 'pine', lane: side * (1.4 + hash(i * 2 + (side > 0), 5) * 0.6), rel, size: 0.8 + hash(i, 7) * 0.5 });
  }
  return out;
}

export function pine(c, x, base, h){
  c.fillStyle = 'rgba(120,150,200,.25)'; c.beginPath(); c.ellipse(x, base, h * 0.32, h * 0.06, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#5b4030'; c.fillRect(x - h * 0.04, base - h * 0.12, h * 0.08, h * 0.12);
  for (let k = 0; k < 3; k++){
    const y0 = base - h * 0.1 - k * h * 0.26, w = h * (0.36 - k * 0.08);
    c.fillStyle = '#3a775f'; c.beginPath(); c.moveTo(x - w, y0); c.lineTo(x, y0 - h * 0.42); c.lineTo(x + w, y0); c.closePath(); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - w * 0.45, y0 - h * 0.22); c.lineTo(x, y0 - h * 0.42); c.lineTo(x + w * 0.45, y0 - h * 0.22); c.quadraticCurveTo(x, y0 - h * 0.27, x - w * 0.45, y0 - h * 0.22); c.fill();
  }
}

function shadow(c, x, y, w){ c.fillStyle = 'rgba(120,150,200,.28)'; c.beginPath(); c.ellipse(x, y, w, w * 0.2, 0, 0, 6.2832); c.fill(); }

const RIBBON = { '#ff6b9d': '#ffd24a', '#4aa8ff': '#ffffff', '#53e59a': '#ff6b6b', '#b06bff': '#ffd24a', '#ff9f45': '#4aa8ff' };
export const GIFT_COLOURS = Object.keys(RIBBON);

export function present(c, x, y, s, col, t, glow = true){
  if (glow){
    const g = c.createRadialGradient(x, y - s * 0.5, 0, x, y - s * 0.5, s * 1.4);
    g.addColorStop(0, 'rgba(255,240,180,.45)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = g; c.fillRect(x - s * 1.4, y - s * 1.9, s * 2.8, s * 2.8);
  }
  const rib = RIBBON[col] || '#ffffff', top = y - s;
  c.fillStyle = col; c.beginPath(); c.roundRect(x - s / 2, top, s, s, s * 0.08); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x - s / 2, top, s, s * 0.18);
  c.fillStyle = rib; c.fillRect(x - s * 0.08, top, s * 0.16, s); c.fillRect(x - s / 2, top + s * 0.42, s, s * 0.16);
  c.beginPath(); c.ellipse(x - s * 0.18, top - s * 0.08, s * 0.2, s * 0.1, -0.5, 0, 6.2832); c.ellipse(x + s * 0.18, top - s * 0.08, s * 0.2, s * 0.1, 0.5, 0, 6.2832); c.fill();
  if (glow) for (let k = 0; k < 3; k++){ const a = t * 2 + k * 2.1; c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(x + Math.cos(a) * s * 0.85, top + s * 0.4 + Math.sin(a) * s * 0.5, s * 0.06, 0, 6.2832); c.fill(); }
}

/* A present tied to a balloon, floating at sled-hop height. */
export function balloonPresent(c, x, y, s, col, t, lift){
  const py = y - lift, bob = Math.sin(t * 2) * s * 0.08;
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = Math.max(1, s * 0.03);
  c.beginPath(); c.moveTo(x, py - s + bob); c.lineTo(x, py - s * 2 + bob); c.stroke();
  c.fillStyle = '#ff6b6b'; c.beginPath(); c.ellipse(x, py - s * 2.45 + bob, s * 0.38, s * 0.46, 0, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(x - s * 0.12, py - s * 2.6 + bob, s * 0.08, s * 0.13, -0.4, 0, 6.2832); c.fill();
  shadow(c, x, y, s * 0.5);
  present(c, x, py + bob, s, col, t);
}

export function ramp(c, x, y, k, W, H){
  const w = W * 0.075 * k, h = H * 0.07 * k;
  shadow(c, x, y, w * 1.1);
  const g = c.createLinearGradient(0, y - h, 0, y);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d6e4f6');
  c.fillStyle = g; c.strokeStyle = 'rgba(150,175,215,.8)'; c.lineWidth = Math.max(1.5, 3 * k);
  c.beginPath(); c.moveTo(x - w, y); c.lineTo(x - w * 0.8, y - h); c.lineTo(x + w * 0.8, y - h); c.lineTo(x + w, y); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ff6b9d';
  for (const d of [-1, 1]){ c.fillRect(x + d * w * 0.85 - 1.5 * k, y - h * 1.9, 3 * k, h * 1.1); c.beginPath(); c.moveTo(x + d * w * 0.85, y - h * 1.9); c.lineTo(x + d * w * 0.85 + d * 14 * k, y - h * 1.75); c.lineTo(x + d * w * 0.85, y - h * 1.6); c.fill(); }
}

export function drift(c, x, y, k, H, poof = 0){
  const w = H * 0.11 * k;
  c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(160,185,225,.6)'; c.lineWidth = Math.max(1.5, 2 * k);
  c.beginPath(); c.ellipse(x, y, w * (1 + poof), w * 0.38 * (1 - poof * 0.6), 0, Math.PI, 0); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(x - w * 0.4, y - w * 0.15, w * 0.45, w * 0.3, 0, Math.PI, 0); c.fill();
}

/* The friends who wave from beside the run. `wave` 0..1 is their arm up. */
export function friendBySlope(c, kind, x, y, k, H, t, wave){
  const s = H * 0.22 * k;
  shadow(c, x, y, s * 0.4);
  if (kind === 'penguin'){
    c.fillStyle = '#2b2d42'; c.beginPath(); c.ellipse(x, y - s * 0.5, s * 0.36, s * 0.5, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - s * 0.42, s * 0.25, s * 0.38, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#2b2d42'; c.save(); c.translate(x + s * 0.32, y - s * 0.62); c.rotate(-0.4 - wave * 1.6 + Math.sin(t * 10) * 0.3 * wave); c.beginPath(); c.ellipse(0, s * 0.2, s * 0.08, s * 0.24, 0, 0, 6.2832); c.fill(); c.restore();
    c.fillStyle = '#ff9f45'; c.beginPath(); c.moveTo(x - s * 0.06, y - s * 0.78); c.lineTo(x + s * 0.06, y - s * 0.78); c.lineTo(x, y - s * 0.7); c.closePath(); c.fill();
    c.fillStyle = '#2b2d42'; for (const d of [-1, 1]){ c.beginPath(); c.arc(x + d * s * 0.1, y - s * 0.86, s * 0.035, 0, 6.2832); c.fill(); }
    c.fillStyle = '#e8413c'; c.fillRect(x - s * 0.3, y - s * 0.67, s * 0.6, s * 0.08);
  } else if (kind === 'snowman'){
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(150,175,215,.6)'; c.lineWidth = 2;
    for (const [dy, r] of [[-0.32, 0.34], [-0.82, 0.24], [-1.18, 0.17]]){ c.beginPath(); c.arc(x, y + dy * s, r * s, 0, 6.2832); c.fill(); c.stroke(); }
    c.fillStyle = '#2b2440'; c.fillRect(x - s * 0.16, y - s * 1.5, s * 0.32, s * 0.2); c.fillRect(x - s * 0.24, y - s * 1.32, s * 0.48, s * 0.04);
    for (const d of [-1, 1]){ c.beginPath(); c.arc(x + d * s * 0.06, y - s * 1.22, s * 0.025, 0, 6.2832); c.fill(); }
    c.fillStyle = '#ff9f45'; c.beginPath(); c.moveTo(x, y - s * 1.17); c.lineTo(x + s * 0.16, y - s * 1.15); c.lineTo(x, y - s * 1.13); c.fill();
    c.fillStyle = '#4aa8ff'; c.fillRect(x - s * 0.2, y - s * 1.02, s * 0.4, s * 0.07);
    c.strokeStyle = '#6b4a30'; c.lineWidth = Math.max(2, s * 0.03);
    const a = -0.6 - wave * 0.9 + Math.sin(t * 10) * 0.25 * wave;
    c.beginPath(); c.moveTo(x + s * 0.2, y - s * 0.85); c.lineTo(x + s * 0.2 + Math.cos(a) * s * 0.35, y - s * 0.85 + Math.sin(a) * s * 0.35); c.stroke();
  } else {
    /* A fox in a scarf. */
    c.fillStyle = '#ff9447'; c.beginPath(); c.ellipse(x, y - s * 0.32, s * 0.26, s * 0.32, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.arc(x, y - s * 0.78, s * 0.22, 0, 6.2832); c.fill();
    for (const d of [-1, 1]){ c.beginPath(); c.moveTo(x + d * s * 0.2, y - s * 0.86); c.lineTo(x + d * s * 0.2, y - s * 1.1); c.lineTo(x + d * s * 0.04, y - s * 0.95); c.closePath(); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - s * 0.7, s * 0.14, s * 0.1, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(x + s * 0.3, y - s * 0.1, s * 0.12, s * 0.08, 0.5, 0, 6.2832); c.fill();
    c.fillStyle = '#2b2440'; for (const d of [-1, 1]){ c.beginPath(); c.arc(x + d * s * 0.08, y - s * 0.82, s * 0.03, 0, 6.2832); c.fill(); }
    c.fillStyle = '#53a8ff'; c.fillRect(x - s * 0.22, y - s * 0.6, s * 0.44, s * 0.08);
    c.strokeStyle = '#ff9447'; c.lineWidth = s * 0.09; c.lineCap = 'round';
    const a = -0.3 - wave * 1.3 + Math.sin(t * 10) * 0.3 * wave;
    c.beginPath(); c.moveTo(x + s * 0.2, y - s * 0.45); c.lineTo(x + s * 0.2 + Math.cos(a) * s * 0.3, y - s * 0.45 + Math.sin(a) * s * 0.3); c.stroke();
  }
}

/* The sled with the children on it, side by side and turned round to grin
   back at us. lean tilts it into a turn; air lifts it off the snow. face(i,
   x, y, r) fills each child's face circle, clipped already. */
export function drawSled(c, x, y, W, H, st){
  const u = H / 900, lift = (st.air || 0) * H;
  c.fillStyle = `rgba(110,140,190,${0.3 * (1 - Math.min(0.7, st.air * 3))})`;
  c.beginPath(); c.ellipse(x, y + 18 * u, 260 * u * (1 - st.air), 26 * u * (1 - st.air), 0, 0, 6.2832); c.fill();
  c.save(); c.translate(x, y - lift); c.rotate((st.lean || 0) * 0.12);
  /* The sack of presents gathered so far, behind the riders. */
  const bag = Math.min(1, (st.presents || 0) / 25);
  if (st.presents){
    c.fillStyle = '#a8703c'; c.beginPath(); c.ellipse(0, -60 * u - bag * 40 * u, (60 + bag * 50) * u, (40 + bag * 45) * u, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#c98a4c'; c.beginPath(); c.ellipse(-12 * u, -70 * u - bag * 50 * u, (34 + bag * 26) * u, (20 + bag * 22) * u, -0.3, 0, 6.2832); c.fill();
    const n = Math.min(6, st.presents);
    for (let k = 0; k < n; k++) present(c, (-50 + k * 20) * u, (-90 - bag * 70 - (k % 2) * 12) * u, (26 + bag * 6) * u, GIFT_COLOURS[k % GIFT_COLOURS.length], 0, false);
  }
  const wood = c.createLinearGradient(0, -40 * u, 0, 40 * u);
  wood.addColorStop(0, '#dca063'); wood.addColorStop(1, '#a8703c');
  c.strokeStyle = '#c0392b'; c.lineWidth = 14 * u; c.lineCap = 'round';
  for (const d of [-1, 1]){ c.beginPath(); c.moveTo(d * 250 * u, 44 * u); c.lineTo(d * 215 * u, -70 * u); c.quadraticCurveTo(d * 200 * u, -150 * u, d * 175 * u, -120 * u); c.stroke(); }
  (st.riders || []).forEach((r, i) => rider(c, (i ? 120 : -120) * u, -200 * u, 88 * u, r, i, st, u));
  c.fillStyle = wood; c.beginPath(); c.moveTo(-270 * u, 30 * u); c.lineTo(-230 * u, -60 * u); c.lineTo(230 * u, -60 * u); c.lineTo(270 * u, 30 * u); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(90,50,20,.3)'; c.lineWidth = 3 * u; for (let k = -200; k <= 200; k += 80){ c.beginPath(); c.moveTo(k * 1.1 * u, 30 * u); c.lineTo(k * u, -60 * u); c.stroke(); }
  c.restore();
}

function rider(c, x, y, r, who, i, st, u){
  const t = st.t || 0;
  c.save(); c.translate(x, y); c.rotate(-0.08 + (st.lean || 0) * 0.15);
  const coat = who.coat, trim = who.trim;
  c.fillStyle = coat; c.beginPath(); c.ellipse(0, r * 1.25, r, r * 0.9, 0, 0, 6.2832); c.fill();
  c.strokeStyle = coat; c.lineWidth = r * 0.38; c.lineCap = 'round';
  const up = st.cheer ? 1 : 0.55 + 0.1 * Math.sin(t * 3 + i);
  for (const d of [-1, 1]){
    const hx = d * r * (1.1 + 0.2 * up), hy = r * (1.3 - 1.4 * up);
    c.beginPath(); c.moveTo(d * r * 0.75, r * 1.0); c.lineTo(hx, hy); c.stroke();
    c.fillStyle = trim; c.beginPath(); c.arc(hx, hy - r * 0.05, r * 0.25, 0, 6.2832); c.fill();
  }
  /* Scarf, flying out behind in the wind. */
  c.fillStyle = trim; c.beginPath(); c.roundRect(-r * 0.62, r * 0.52, r * 1.24, r * 0.3, r * 0.15); c.fill();
  const fl = Math.sin(t * 9 + i) * r * 0.08;
  c.beginPath(); c.moveTo(r * 0.3, r * 0.7); c.quadraticCurveTo(r * 0.95, r * 1.2 + fl, r * 0.75, r * 1.9); c.lineTo(r * 0.5, r * 1.85); c.quadraticCurveTo(r * 0.62, r * 1.2, r * 0.1, r * 0.8); c.fill();
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.clip();
  c.fillStyle = '#cfe6fb'; c.fillRect(-r, -r, r * 2, r * 2);
  if (st.face) st.face(i, 0, 0, r);
  c.restore();
  c.strokeStyle = '#fff'; c.lineWidth = r * 0.1; c.beginPath(); c.arc(0, 0, r * 1.02, 0, 6.2832); c.stroke();
  /* Knit hat with a pompom. */
  c.fillStyle = coat; c.beginPath(); c.ellipse(0, -r * 0.55, r * 0.92, r * 0.62, 0, Math.PI, 0); c.fill();
  c.fillStyle = trim; c.beginPath(); c.roundRect(-r * 0.98, -r * 0.66, r * 1.96, r * 0.28, r * 0.12); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.1)'; c.lineWidth = 3 * u; for (let k = -3; k <= 3; k++){ c.beginPath(); c.moveTo(k * r * 0.22, -r * 0.66); c.lineTo(k * r * 0.22, -r * 0.38); c.stroke(); }
  c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -r * 1.22, r * 0.24, 0, 6.2832); c.fill();
  c.restore();
}

/* The cabin at the bottom of the hill, where the presents go under the tree. */
export function cabin(c, x, y, s, t, presents){
  const w = s * 1.3, h = s * 0.6;
  c.fillStyle = 'rgba(120,150,200,.25)'; c.beginPath(); c.ellipse(x, y, w * 0.8, w * 0.1, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#8a5a3c'; c.fillRect(x - w / 2, y - h, w, h);
  c.strokeStyle = 'rgba(60,35,20,.35)'; c.lineWidth = Math.max(1, s * 0.01);
  c.beginPath(); for (let k = 1; k < 7; k++){ const yy = y - h * k / 7; c.moveTo(x - w / 2, yy); c.lineTo(x + w / 2, yy); } c.stroke();
  c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - w * 0.62, y - h + 4); c.lineTo(x, y - h - s * 0.5); c.lineTo(x + w * 0.62, y - h + 4); c.closePath(); c.fill();
  c.fillStyle = '#6b4a30'; c.beginPath(); c.moveTo(x - w * 0.56, y - h + 4); c.lineTo(x, y - h - s * 0.44); c.lineTo(x + w * 0.56, y - h + 4); c.lineTo(x + w * 0.5, y - h + 14); c.lineTo(x, y - h - s * 0.36); c.lineTo(x - w * 0.5, y - h + 14); c.closePath(); c.fill();
  const glow = 0.85 + 0.15 * Math.sin(t * 5);
  for (const dx of [-0.3, 0.3]){
    const g = c.createRadialGradient(x + dx * w, y - h * 0.55, 0, x + dx * w, y - h * 0.55, s * 0.3);
    g.addColorStop(0, `rgba(255,200,110,${0.5 * glow})`); g.addColorStop(1, 'rgba(255,200,110,0)');
    c.fillStyle = g; c.fillRect(x + dx * w - s * 0.3, y - h * 0.55 - s * 0.3, s * 0.6, s * 0.6);
    c.fillStyle = `rgba(255,214,130,${glow})`; c.fillRect(x + dx * w - s * 0.09, y - h * 0.7, s * 0.18, s * 0.16);
  }
  c.fillStyle = '#5a3a26'; c.beginPath(); c.roundRect(x - s * 0.1, y - h * 0.6, s * 0.2, h * 0.6, s * 0.04); c.fill();
  c.fillStyle = 'rgba(255,255,255,.85)';
  for (let k = 0; k < 3; k++){ const u2 = (t * 0.4 + k / 3) % 1; c.beginPath(); c.arc(x + w * 0.32 + Math.sin(u2 * 5) * s * 0.03, y - h - s * 0.4 - u2 * s * 0.4, s * (0.04 + u2 * 0.05), 0, 6.2832); c.fill(); }
  c.fillStyle = '#7a5434'; c.fillRect(x + w * 0.26, y - h - s * 0.32, s * 0.1, s * 0.2);
  pine(c, x + w * 0.85, y, s * 0.9);
  for (let k = 0; k < Math.min(12, presents); k++){
    present(c, x + w * 0.72 + (k % 4) * s * 0.09, y - Math.floor(k / 4) * s * 0.075, s * 0.08, GIFT_COLOURS[k % GIFT_COLOURS.length], t, false);
  }
}
