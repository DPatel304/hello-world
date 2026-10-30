/* Reactor Run, painted. The view runs down a corridor of a derelict
   starship from just behind the crew: dark blue bulkheads and ceiling, a
   grated floor with cyan reactor light glowing up through it, emergency
   lights strobing red down the walls, pipes, panel seams and sparks - and
   everything on the floor coming toward you, growing as it nears: debris,
   low bulkheads to duck, breaches in the floor to hop, coins, repair
   stations, and at a crossroads, three great doors.

   Depth is `rel`: 0 is the crew, 1 the far end. P(lane, rel) turns a place
   on the floor - lane -1 its left edge, 1 its right - into the screen;
   heights are screen heights at the crew, scaled by P's k with distance. */

export const RUN = 0.03;              /* the crew's own depth */
export const HORIZON = 0.4;           /* screen heights */
const BOTTOM = 0.97;                  /* where the crew's feet are */
const HALF = 0.36;                    /* half the floor's width at the crew, in screen widths */
const WALL = 1.18;                    /* the walls, in lanes */
const ROOF = 0.62;                    /* the ceiling, in screen heights at the crew */
const S = (z) => 1 / (1 + 6 * Math.max(-0.1, z));

export function P(lane, rel, W, H){
  const k = S(rel) / S(RUN);
  const y = HORIZON + (BOTTOM - HORIZON) * (S(rel) - S(1)) / (S(RUN) - S(1));
  return { x: W * (0.5 + lane * HALF * k), y: y * H, k };
}

const hash = (i, k = 1) => ((((i + 7919) * 2654435761 * k) % 4294967296) + 4294967296) % 4294967296 / 4294967296;
export const INK = '#0b0d1c';

/* ---------- the corridor ---------- */

/* The corridor at distance z along the ship: walls, ceiling and floor,
   seams and lights sliding past. `alarm` 0..1 turns the lights red. */
export function drawCorridor(c, W, H, z, t, alarm = 0){
  const far = P(0, 1, W, H), fl = P(-WALL, 1, W, H), fr = P(WALL, 1, W, H);
  const nl = P(-WALL, -0.08, W, H), nr = P(WALL, -0.08, W, H);
  const roof = (p) => p.y - H * ROOF * p.k;
  /* The far end: the reactor's glow down the corridor. */
  c.fillStyle = '#05060f'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(far.x, far.y - H * 0.08, 0, far.x, far.y - H * 0.08, H * 0.5);
  g.addColorStop(0, 'rgba(90,230,255,.55)'); g.addColorStop(0.35, 'rgba(40,120,200,.2)'); g.addColorStop(1, 'rgba(10,20,50,0)');
  /* Ceiling. */
  quad(c, [nl.x, roof(nl)], [nr.x, roof(nr)], [fr.x, roof(fr)], [fl.x, roof(fl)], '#0e1530');
  /* Walls. */
  quad(c, [nl.x, roof(nl)], [fl.x, roof(fl)], [fl.x, fl.y], [nl.x, nl.y], '#141d3e');
  quad(c, [nr.x, roof(nr)], [fr.x, roof(fr)], [fr.x, fr.y], [nr.x, nr.y], '#121a38');
  /* Floor: dark grating. */
  quad(c, [nl.x, nl.y], [fl.x, fl.y], [fr.x, fr.y], [nr.x, nr.y], '#0c1124');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  /* Cyan light up through the grating, two glowing lines down the floor. */
  for (const lane of [-0.55, 0.55]){
    const a = P(lane, -0.05, W, H), b = P(lane, 1, W, H);
    const lg = c.createLinearGradient(a.x, a.y, b.x, b.y);
    lg.addColorStop(0, 'rgba(80,230,255,.55)'); lg.addColorStop(1, 'rgba(80,230,255,.05)');
    c.strokeStyle = lg; c.lineWidth = H * 0.008;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
  /* Seams and ribs sliding past: every SEAM along the ship, a rib round the
     corridor, with a light on each wall - red when the alarm's on. */
  const SEAM = 0.16;
  for (let n = 0; n < 9; n++){
    const rel = ((n * SEAM - z) % (SEAM * 8) + SEAM * 8) % (SEAM * 8) - 0.05;
    if (rel > 1 || rel < -0.08) continue;
    const l = P(-WALL, rel, W, H), r = P(WALL, rel, W, H), k = l.k, fade = Math.min(1, (1 - rel) * 3);
    c.strokeStyle = `rgba(70,90,150,${0.55 * fade})`; c.lineWidth = Math.max(1, H * 0.006 * k);
    c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(l.x, roof(l)); c.lineTo(r.x, roof(r)); c.lineTo(r.x, r.y); c.stroke();
    c.strokeStyle = `rgba(30,40,80,${0.8 * fade})`; c.lineWidth = Math.max(1, H * 0.003 * k);
    c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(r.x, r.y); c.stroke();
    /* The lights. */
    const id = Math.round((z + rel) / SEAM), red = alarm > 0 && (Math.floor(t * 3 + id) % 2 === 0);
    const col = red ? `255,60,60` : hash(id, 3) < 0.15 && Math.sin(t * 17 + id) > 0.6 ? '0,0,0' : '255,190,110';
    for (const p of [l, r]){
      const ly = p.y - H * ROOF * 0.55 * k;
      const lg = c.createRadialGradient(p.x, ly, 0, p.x, ly, H * 0.09 * k);
      lg.addColorStop(0, `rgba(${col},${(red ? 0.7 : 0.45) * fade})`); lg.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = lg; c.beginPath(); c.arc(p.x, ly, H * 0.09 * k, 0, 6.2832); c.fill();
      c.fillStyle = `rgba(${col},${fade})`; c.fillRect(p.x - H * 0.004 * k, ly - H * 0.02 * k, H * 0.008 * k, H * 0.04 * k);
    }
    /* Pipes along the walls. */
    if (n % 2 === 0){
      c.strokeStyle = `rgba(60,75,120,${0.7 * fade})`; c.lineWidth = Math.max(1, H * 0.012 * k);
      const r2 = P(-WALL, Math.min(1, rel + SEAM), W, H);
      c.beginPath(); c.moveTo(l.x, l.y - H * 0.12 * k); c.lineTo(r2.x, r2.y - H * 0.12 * r2.k); c.stroke();
    }
  }
  /* The ceiling's strip light, flickering. */
  const a = P(0, -0.05, W, H), b = P(0, 1, W, H), flick = 0.7 + 0.3 * Math.sin(t * 23) * Math.sin(t * 7);
  c.strokeStyle = `rgba(200,230,255,${0.25 * flick})`; c.lineWidth = H * 0.012;
  c.beginPath(); c.moveTo(a.x, roof(a)); c.lineTo(b.x, roof(b)); c.stroke();
  if (alarm > 0){ c.fillStyle = `rgba(255,30,40,${0.12 * alarm * (0.5 + 0.5 * Math.sin(t * 6))})`; c.fillRect(0, 0, W, H); }
}
function quad(c, a, b, d, e, col){
  c.fillStyle = col; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.lineTo(...e); c.closePath(); c.fill();
}

/* A vignette darkening the edges - it's dark in here. */
export function drawGloom(c, W, H){
  const g = c.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,8,.65)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

/* ---------- on the floor ---------- */

/* Debris across part of the floor, from lane a to b: crates and a fallen
   girder, hazard-striped. */
export function drawBlocker(c, W, H, rel, a, b, t, seed){
  const l = P(a, rel, W, H), r = P(b, rel, W, H), k = l.k, h = H * 0.2 * k;
  c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse((l.x + r.x) / 2, l.y, (r.x - l.x) / 2 * 1.05, H * 0.02 * k, 0, 0, 6.2832); c.fill();
  /* Crates. */
  const n = Math.max(1, Math.round((b - a) / 0.35));
  for (let i = 0; i < n; i++){
    const x0 = l.x + (r.x - l.x) * i / n, w = (r.x - l.x) / n, hh = h * (0.75 + hash(seed + i, 5) * 0.4);
    c.fillStyle = '#4a556f'; c.fillRect(x0 + w * 0.04, l.y - hh, w * 0.92, hh);
    c.fillStyle = '#5d6a88'; c.fillRect(x0 + w * 0.04, l.y - hh, w * 0.92, hh * 0.16);
    c.strokeStyle = INK; c.lineWidth = Math.max(1, H * 0.004 * k); c.strokeRect(x0 + w * 0.04, l.y - hh, w * 0.92, hh);
    /* Hazard stripes. */
    c.save(); c.beginPath(); c.rect(x0 + w * 0.04, l.y - hh * 0.55, w * 0.92, hh * 0.22); c.clip();
    c.fillStyle = '#ffc531'; c.fillRect(x0, l.y - hh, w, hh);
    c.fillStyle = INK;
    for (let s = -2; s < 8; s++){ const sx = x0 + s * w * 0.18 + (t * 0) ; c.beginPath(); c.moveTo(sx, l.y - hh * 0.33); c.lineTo(sx + w * 0.09, l.y - hh * 0.33); c.lineTo(sx + w * 0.18, l.y - hh * 0.55); c.lineTo(sx + w * 0.09, l.y - hh * 0.55); c.closePath(); c.fill(); }
    c.restore();
  }
  /* A spark now and then. */
  if (Math.sin(t * 9 + seed) > 0.85){
    const sx = l.x + (r.x - l.x) * hash(seed, 9), sy = l.y - h;
    c.fillStyle = '#fff4b0'; c.beginPath(); c.arc(sx, sy, H * 0.008 * k, 0, 6.2832); c.fill();
  }
}

/* A low bulkhead across the whole corridor, to duck under: a heavy beam
   with red warning lights, at head height. */
export function drawBeam(c, W, H, rel, t){
  const l = P(-WALL, rel, W, H), r = P(WALL, rel, W, H), k = l.k;
  const top = l.y - H * 0.42 * k, bot = l.y - H * 0.2 * k;
  c.fillStyle = '#39435e'; c.fillRect(l.x, top, r.x - l.x, bot - top);
  c.fillStyle = '#4c5878'; c.fillRect(l.x, top, r.x - l.x, (bot - top) * 0.2);
  c.save(); c.beginPath(); c.rect(l.x, bot - (bot - top) * 0.35, r.x - l.x, (bot - top) * 0.3); c.clip();
  c.fillStyle = '#ffc531'; c.fillRect(l.x, top, r.x - l.x, bot - top);
  c.fillStyle = INK;
  const step = H * 0.05 * k;
  for (let x = l.x - step; x < r.x; x += step){ c.beginPath(); c.moveTo(x, bot); c.lineTo(x + step * 0.5, bot); c.lineTo(x + step, bot - (bot - top) * 0.4); c.lineTo(x + step * 0.5, bot - (bot - top) * 0.4); c.closePath(); c.fill(); }
  c.restore();
  c.strokeStyle = INK; c.lineWidth = Math.max(1, H * 0.005 * k); c.strokeRect(l.x, top, r.x - l.x, bot - top);
  /* Warning lights blinking along it. */
  for (let i = 1; i < 6; i++){
    const x = l.x + (r.x - l.x) * i / 6, on = Math.floor(t * 4 + i) % 2 === 0;
    const g = c.createRadialGradient(x, top + (bot - top) * 0.3, 0, x, top + (bot - top) * 0.3, H * 0.04 * k);
    g.addColorStop(0, `rgba(255,60,60,${on ? 0.9 : 0.25})`); g.addColorStop(1, 'rgba(255,60,60,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, top + (bot - top) * 0.3, H * 0.04 * k, 0, 6.2832); c.fill();
  }
  /* Its supports, down the walls. */
  c.fillStyle = '#2b3350'; c.fillRect(l.x, top, H * 0.03 * k, l.y - top); c.fillRect(r.x - H * 0.03 * k, top, H * 0.03 * k, l.y - top);
}

/* A breach in the floor, from lane a to b: a jagged hole with the reactor
   glowing orange far below, to hop over. */
export function drawGap(c, W, H, rel, a, b, t, depth = 0.05){
  const l0 = P(a, rel + depth, W, H), r0 = P(b, rel + depth, W, H), l1 = P(a, rel - depth * 0.4, W, H), r1 = P(b, rel - depth * 0.4, W, H);
  const k = l1.k;
  c.save();
  c.beginPath(); c.moveTo(l0.x, l0.y);
  const N = 10;
  for (let i = 1; i <= N; i++){ const u = i / N; c.lineTo(l0.x + (r0.x - l0.x) * u, l0.y + (hash(i, 3) - 0.5) * H * 0.008 * k); }
  c.lineTo(r1.x, r1.y);
  for (let i = N - 1; i >= 0; i--){ const u = i / N; c.lineTo(l1.x + (r1.x - l1.x) * u, l1.y + (hash(i, 7) - 0.5) * H * 0.012 * k); }
  c.closePath();
  const g = c.createLinearGradient(0, l0.y, 0, l1.y);
  g.addColorStop(0, '#1a0a08'); g.addColorStop(1, '#ff7a2a');
  c.fillStyle = g; c.fill();
  c.strokeStyle = '#ffb04a'; c.lineWidth = Math.max(1, H * 0.005 * k); c.stroke();
  c.restore();
  /* Heat shimmer: embers rising. */
  for (let i = 0; i < 4; i++){
    const u = (t * 0.7 + i / 4) % 1, x = l1.x + (r1.x - l1.x) * hash(i + Math.floor(t * 0.7 + i / 4) * 7, 5);
    c.fillStyle = `rgba(255,180,90,${1 - u})`; c.beginPath(); c.arc(x, l1.y - H * 0.08 * k * u, H * 0.005 * k, 0, 6.2832); c.fill();
  }
}

/* A salvage coin, spinning: a gold hex with a glow. */
export function drawCoin(c, x, y, s, t){
  const g = c.createRadialGradient(x, y, 0, x, y, s * 2.2);
  g.addColorStop(0, 'rgba(255,210,90,.45)'); g.addColorStop(1, 'rgba(255,210,90,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, s * 2.2, 0, 6.2832); c.fill();
  const sq = Math.abs(Math.cos(t * 4));
  c.save(); c.translate(x, y); c.scale(0.25 + 0.75 * sq, 1);
  c.beginPath(); for (let i = 0; i < 6; i++){ const a = i * Math.PI / 3 + Math.PI / 6; c.lineTo(Math.cos(a) * s, Math.sin(a) * s); } c.closePath();
  c.fillStyle = '#ffcf3e'; c.fill(); c.strokeStyle = '#b8801c'; c.lineWidth = s * 0.18; c.stroke();
  c.fillStyle = '#fff1a6'; c.beginPath(); c.arc(-s * 0.25, -s * 0.25, s * 0.22, 0, 6.2832); c.fill();
  c.restore();
}

/* A repair station: a glowing green arch over the floor with a cross, to
   run through. */
export function drawFountain(c, W, H, rel, lane, t, used){
  const p = P(lane, rel, W, H), k = p.k, w = H * 0.16 * k, h = H * 0.36 * k;
  const glow = used ? 0.25 : 0.8 + 0.2 * Math.sin(t * 5);
  const g = c.createRadialGradient(p.x, p.y - h * 0.5, 0, p.x, p.y - h * 0.5, w * 1.6);
  g.addColorStop(0, `rgba(90,255,170,${0.45 * glow})`); g.addColorStop(1, 'rgba(90,255,170,0)');
  c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y - h * 0.5, w * 1.6, 0, 6.2832); c.fill();
  c.strokeStyle = '#2a3350'; c.lineWidth = H * 0.03 * k; c.lineCap = 'round';
  c.beginPath(); c.moveTo(p.x - w, p.y); c.lineTo(p.x - w, p.y - h * 0.7); c.quadraticCurveTo(p.x, p.y - h * 1.15, p.x + w, p.y - h * 0.7); c.lineTo(p.x + w, p.y); c.stroke();
  c.strokeStyle = `rgba(110,255,180,${glow})`; c.lineWidth = H * 0.012 * k;
  c.beginPath(); c.moveTo(p.x - w, p.y); c.lineTo(p.x - w, p.y - h * 0.7); c.quadraticCurveTo(p.x, p.y - h * 1.15, p.x + w, p.y - h * 0.7); c.lineTo(p.x + w, p.y); c.stroke();
  /* The cross, floating in the middle. */
  const cy = p.y - h * 0.62, cs = H * 0.035 * k * (1 + 0.08 * Math.sin(t * 4));
  c.fillStyle = `rgba(150,255,200,${glow})`;
  c.fillRect(p.x - cs * 0.35, cy - cs, cs * 0.7, cs * 2); c.fillRect(p.x - cs, cy - cs * 0.35, cs * 2, cs * 0.7);
  /* The pad on the floor. */
  c.fillStyle = `rgba(90,255,170,${0.3 * glow})`; c.beginPath(); c.ellipse(p.x, p.y, w * 1.1, H * 0.02 * k, 0, 0, 6.2832); c.fill();
}

/* ---------- the crossroads ---------- */

export const DOORS = [-0.68, 0, 0.68];
/* Three great doors across the far end: each with its sign, the votes in
   front of it as glowing dots in the voters' colours, and the one chosen
   sliding open. kinds: ['fight', 'traps', 'mystery']. */
export function drawDoors(c, W, H, rel, t, votes, open = null, opening = 0){
  const base = P(0, rel, W, H), k = base.k;
  /* The wall the doors are in. */
  const l = P(-WALL, rel, W, H), r = P(WALL, rel, W, H), top = l.y - H * ROOF * k;
  c.fillStyle = '#1a2348'; c.fillRect(l.x, top, r.x - l.x, l.y - top);
  c.strokeStyle = INK; c.lineWidth = Math.max(1, H * 0.006 * k); c.strokeRect(l.x, top, r.x - l.x, l.y - top);
  DOORS.forEach((lane, i) => {
    const p = P(lane, rel, W, H), w = H * 0.2 * k, h = H * 0.42 * k, x0 = p.x - w / 2, y0 = p.y - h;
    const col = ['#ff5b5b', '#ffc531', '#c46bff'][i];
    /* The light behind the door, coming through as it opens. */
    const g = c.createRadialGradient(p.x, p.y - h * 0.5, 0, p.x, p.y - h * 0.5, w * 1.4);
    g.addColorStop(0, hexA(col, 0.45)); g.addColorStop(1, hexA(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y - h * 0.5, w * 1.4, 0, 6.2832); c.fill();
    c.fillStyle = '#05060f'; c.fillRect(x0, y0, w, h);
    const o = open === i ? opening : 0, half = w / 2 * (1 - o);
    c.fillStyle = '#3a4565';
    c.fillRect(x0, y0, half, h); c.fillRect(x0 + w - half, y0, half, h);
    c.strokeStyle = col; c.lineWidth = Math.max(2, H * 0.008 * k); c.strokeRect(x0, y0, w, h);
    /* The sign over it. */
    sign(c, ['skull', 'spikes', 'mystery'][i], p.x, y0 - H * 0.07 * k, H * 0.055 * k, col, t);
    /* The votes: a dot per voter, in their colour. */
    const vs = votes[i] || [];
    vs.forEach((col2, n) => {
      const vx = p.x + (n - (vs.length - 1) / 2) * H * 0.04 * k, vy = p.y + H * 0.04 * k;
      c.fillStyle = col2; c.beginPath(); c.arc(vx, vy, H * 0.015 * k, 0, 6.2832); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, H * 0.003 * k); c.stroke();
    });
  });
}

/* The signs: a skull for a fight, spikes for traps, a ? for anything. */
export function sign(c, kind, x, y, s, col, t){
  c.save();
  c.fillStyle = 'rgba(5,6,15,.85)'; c.beginPath(); c.arc(x, y, s * 1.15, 0, 6.2832); c.fill();
  c.strokeStyle = col; c.lineWidth = s * 0.12; c.stroke();
  c.fillStyle = col;
  if (kind === 'skull'){
    c.beginPath(); c.arc(x, y - s * 0.12, s * 0.55, Math.PI * 0.85, Math.PI * 2.15); c.lineTo(x + s * 0.32, y + s * 0.45); c.lineTo(x - s * 0.32, y + s * 0.45); c.closePath(); c.fill();
    c.fillStyle = '#05060f';
    for (const side of [-1, 1]){ c.beginPath(); c.arc(x + side * s * 0.22, y - s * 0.12, s * 0.15, 0, 6.2832); c.fill(); }
    c.fillRect(x - s * 0.04, y + s * 0.1, s * 0.08, s * 0.12);
  } else if (kind === 'spikes'){
    c.beginPath(); c.moveTo(x - s * 0.7, y + s * 0.45);
    for (let i = 0; i < 4; i++){ const x0 = x - s * 0.7 + i * s * 0.35; c.lineTo(x0 + s * 0.175, y - s * 0.5 + (i % 2) * s * 0.2); c.lineTo(x0 + s * 0.35, y + s * 0.45); }
    c.closePath(); c.fill();
  } else {
    c.font = `700 ${Math.round(s * 1.5)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('?', x, y + s * 0.08 + Math.sin(t * 3) * s * 0.05);
  }
  c.restore();
}

/* The guide's crown, over whoever breaks a tie this time. */
export function drawCrown(c, x, y, s, t){
  c.save(); c.translate(x, y + Math.sin(t * 3) * s * 0.1);
  c.fillStyle = '#ffd24a'; c.strokeStyle = INK; c.lineWidth = s * 0.1;
  c.beginPath(); c.moveTo(-s, s * 0.5); c.lineTo(-s, -s * 0.3); c.lineTo(-s * 0.5, s * 0.1); c.lineTo(0, -s * 0.6); c.lineTo(s * 0.5, s * 0.1); c.lineTo(s, -s * 0.3); c.lineTo(s, s * 0.5); c.closePath();
  c.fill(); c.stroke();
  c.restore();
}

/* ---------- the crew ---------- */

/* A crew member running away from us down the corridor in a spacesuit in
   their colour, looking back so we see their face in the helmet. st: {
   air (screen px up), duck 0..1, lean -1..1, hit 0..1 (just hit: a red
   flash), blink, lost (tracking lost: a faded ghost) }. face(x, y, r)
   paints the face into the clipped visor. */
export function drawCrew(c, x, base, h, t, col, st, face){
  const run = t * 11, duck = st.duck || 0, u = h / 100;
  c.fillStyle = `rgba(0,0,0,${0.35 * (1 - Math.min(1, st.air / (h * 0.6)) * 0.6)})`;
  c.beginPath(); c.ellipse(x, base, h * 0.2, h * 0.04, 0, 0, 6.2832); c.fill();
  c.save();
  c.translate(x, base - st.air);
  c.rotate(st.lean * 0.22);
  if (st.lost) c.globalAlpha = 0.35;
  else if (st.blink && Math.floor(t * 12) % 2) c.globalAlpha = 0.5;
  const sq = 1 - duck * 0.5;
  c.save(); c.scale(1, sq);
  c.lineCap = 'round';
  for (const side of [-1, 1]){
    const ph = Math.sin(run + (side > 0 ? Math.PI : 0)) * (st.lost ? 0 : 1), air = st.air > 1;
    const kx = side * 9 * u, ky = -26 * u + (air ? -6 * u : ph * 4 * u), fy = air ? -12 * u : -2 * u + Math.max(0, ph) * -10 * u;
    c.strokeStyle = '#cfd6e6'; c.lineWidth = 13 * u;
    c.beginPath(); c.moveTo(side * 8 * u, -46 * u); c.lineTo(kx, ky); c.lineTo(side * 9 * u, fy); c.stroke();
    c.fillStyle = '#2b3350'; c.beginPath(); c.ellipse(side * 9 * u, fy + 1 * u, 8 * u, 5.5 * u, 0, 0, 6.2832); c.fill();
  }
  /* The suit: white with their colour across the chest, a pack on the back
     glowing cyan. */
  c.fillStyle = '#e8ecf5'; c.beginPath(); c.roundRect(-19 * u, -88 * u, 38 * u, 46 * u, 12 * u); c.fill();
  c.fillStyle = col; c.beginPath(); c.roundRect(-19 * u, -78 * u, 38 * u, 14 * u, 4 * u); c.fill();
  c.fillStyle = '#5b6a8c'; c.beginPath(); c.roundRect(-13 * u, -86 * u, 26 * u, 30 * u, 6 * u); c.fill();
  c.fillStyle = `rgba(90,230,255,${0.6 + 0.3 * Math.sin(t * 6)})`; c.fillRect(-8 * u, -80 * u, 16 * u, 5 * u);
  for (const side of [-1, 1]){
    const ph = Math.sin(run + (side > 0 ? 0 : Math.PI)) * (st.lost ? 0 : 1);
    const hx = side * (st.air > 1 ? 32 : 24) * u, hy = st.air > 1 ? -108 * u : (-62 + ph * 10) * u;
    c.strokeStyle = '#e8ecf5'; c.lineWidth = 11 * u;
    c.beginPath(); c.moveTo(side * 15 * u, -82 * u); c.lineTo(hx, hy); c.stroke();
    c.fillStyle = col; c.beginPath(); c.arc(hx, hy, 6 * u, 0, 6.2832); c.fill();
  }
  c.restore();
  /* The helmet: a white ring round their face, in its visor. */
  const hy = -(88 * sq + 22) * u, r = 22 * u;
  c.fillStyle = '#e8ecf5'; c.beginPath(); c.arc(0, hy, r * 1.28, 0, 6.2832); c.fill();
  c.save();
  c.beginPath(); c.arc(0, hy, r, 0, 6.2832); c.clip();
  c.fillStyle = col; c.fillRect(-r, hy - r, r * 2, r * 2);
  face(0, hy, r);
  /* The visor's shine. */
  c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(-r * 0.4, hy - r * 0.45, r * 0.5, r * 0.25, -0.5, 0, 6.2832); c.fill();
  c.restore();
  c.strokeStyle = col; c.lineWidth = r * 0.16; c.beginPath(); c.arc(0, hy, r * 1.08, 0, 6.2832); c.stroke();
  /* The helmet's light on top. */
  c.fillStyle = col; c.beginPath(); c.arc(0, hy - r * 1.3, r * 0.2, 0, 6.2832); c.fill();
  if (st.hit > 0){
    c.globalAlpha = st.hit * 0.6; c.fillStyle = '#ff3b3b';
    c.beginPath(); c.arc(0, hy, r * 1.3, 0, 6.2832); c.fill();
  }
  c.restore();
}

/* A crew member's health: a chunky bar over their head, in their colour. */
export function drawHealth(c, x, y, w, frac, col, low){
  const h = w * 0.16;
  c.fillStyle = 'rgba(5,6,15,.8)'; c.beginPath(); c.roundRect(x - w / 2 - h * 0.25, y - h * 0.25, w + h * 0.5, h * 1.5, h * 0.75); c.fill();
  c.fillStyle = low ? '#ff4b4b' : col; c.beginPath(); c.roundRect(x - w / 2, y, Math.max(h * 0.5, w * frac), h, h * 0.5); c.fill();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x - w / 2 + h * 0.3, y + h * 0.15, Math.max(0, w * frac - h * 0.6), h * 0.22);
}

/* The little helper drone that flies ahead at the start and shows how:
   it ducks under, hops over, slides round. act: 'fly', 'duck', 'hop' (k
   0..1 its height). */
export function drawBot(c, x, base, s, t, act = 'fly', k = 0){
  const lift = act === 'hop' ? k * s * 1.2 : 0, low = act === 'duck' ? s * 0.55 : 0;
  const y = base - s * 1.1 - lift + low + Math.sin(t * 5) * s * 0.06;
  c.fillStyle = 'rgba(90,230,255,.18)'; c.beginPath(); c.ellipse(x, base, s * 0.45, s * 0.1, 0, 0, 6.2832); c.fill();
  /* Its jet glow. */
  const g = c.createRadialGradient(x, y + s * 0.45, 0, x, y + s * 0.45, s * 0.6);
  g.addColorStop(0, 'rgba(90,230,255,.7)'); g.addColorStop(1, 'rgba(90,230,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y + s * 0.45, s * 0.6, 0, 6.2832); c.fill();
  c.fillStyle = '#e8ecf5'; c.beginPath(); c.arc(x, y, s * 0.42, 0, 6.2832); c.fill();
  c.strokeStyle = INK; c.lineWidth = s * 0.05; c.stroke();
  c.fillStyle = '#1b2240'; c.beginPath(); c.ellipse(x, y - s * 0.02, s * 0.3, s * 0.2, 0, 0, 6.2832); c.fill();
  /* Two glowing eyes. */
  c.fillStyle = '#7ff3ff';
  for (const side of [-1, 1]){ c.beginPath(); c.ellipse(x + side * s * 0.12, y - s * 0.03, s * 0.06, s * 0.08 * (Math.sin(t * 2.3) > 0.97 ? 0.2 : 1), 0, 0, 6.2832); c.fill(); }
  /* Antenna. */
  c.strokeStyle = '#cfd6e6'; c.lineWidth = s * 0.05;
  c.beginPath(); c.moveTo(x, y - s * 0.42); c.lineTo(x + Math.sin(t * 3) * s * 0.06, y - s * 0.62); c.stroke();
  c.fillStyle = '#ff6b6b'; c.beginPath(); c.arc(x + Math.sin(t * 3) * s * 0.06, y - s * 0.64, s * 0.06, 0, 6.2832); c.fill();
}

function hexA(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
