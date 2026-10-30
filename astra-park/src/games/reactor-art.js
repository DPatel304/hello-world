/* Reactor Run, drawn as a greybox: plain shapes, one clear colour each, so
   the play can be got right before the look is decided. Everything the
   game draws goes through here - swap this file for the real art later
   and nothing else changes.

     floor            flat dark grey, lane lines, the walls as two edges
     debris           a red block across part of the floor   - slide round
     low bulkhead     an orange bar at head height            - duck
     floor breach     a black gap with a white edge           - hop
     coin             a yellow circle
     repair station   a green ring with a plus
     crew             a capsule in their colour, face on top
     doors            tall rectangles: red (fight), yellow (traps), purple (?)

   Depth is `rel`: 0 is the crew, 1 the far end. P(lane, rel) turns a place
   on the floor - lane -1 its left edge, 1 its right - into the screen;
   heights are screen heights at the crew, scaled by P's k with distance. */

export const RUN = 0.03;              /* the crew's own depth */
export const HORIZON = 0.38;          /* screen heights */
const BOTTOM = 0.97;                  /* where the crew's feet are */
const HALF = 0.36;                    /* half the floor's width at the crew, in screen widths */
const WALL = 1.15;                    /* the walls, in lanes */
const S = (z) => 1 / (1 + 6 * Math.max(-0.1, z));

export function P(lane, rel, W, H){
  const k = S(rel) / S(RUN);
  const y = HORIZON + (BOTTOM - HORIZON) * (S(rel) - S(1)) / (S(RUN) - S(1));
  return { x: W * (0.5 + lane * HALF * k), y: y * H, k };
}

export const INK = '#0b0d1c';
const LINE = 'rgba(255,255,255,.18)';

/* ---------- the floor ---------- */

/* The corridor: a flat floor, its edges, lane lines, and cross lines
   sliding past so you can feel the speed. `alarm` tints it red. */
export function drawCorridor(c, W, H, z, t, alarm = 0){
  c.fillStyle = '#1b1f2e'; c.fillRect(0, 0, W, H);
  const nl = P(-WALL, -0.08, W, H), nr = P(WALL, -0.08, W, H), fl = P(-WALL, 1, W, H), fr = P(WALL, 1, W, H);
  c.fillStyle = '#2a3043';
  c.beginPath(); c.moveTo(nl.x, nl.y); c.lineTo(fl.x, fl.y); c.lineTo(fr.x, fr.y); c.lineTo(nr.x, nr.y); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(nl.x, nl.y); c.lineTo(fl.x, fl.y); c.moveTo(nr.x, nr.y); c.lineTo(fr.x, fr.y); c.stroke();
  /* Lane lines: thirds of the floor. */
  c.strokeStyle = LINE; c.lineWidth = 2;
  for (const lane of [-1 / 3, 1 / 3]){ const a = P(lane, -0.05, W, H), b = P(lane, 1, W, H); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
  /* Cross lines, sliding past. */
  const STEP = 0.1;
  for (let n = 0; n < 12; n++){
    const rel = ((n * STEP - z) % (STEP * 11) + STEP * 11) % (STEP * 11) - 0.05;
    if (rel > 1 || rel < -0.08) continue;
    const l = P(-WALL, rel, W, H), r = P(WALL, rel, W, H);
    c.strokeStyle = `rgba(255,255,255,${0.12 * Math.min(1, (1 - rel) * 3)})`; c.lineWidth = Math.max(1, 3 * l.k);
    c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(r.x, r.y); c.stroke();
  }
  if (alarm > 0){ c.fillStyle = `rgba(255,60,60,${0.08 * alarm})`; c.fillRect(0, 0, W, H); }
}

/* No gloom in the greybox. */
export function drawGloom(){}

/* ---------- on the floor ---------- */

/* Debris from lane a to b: a red block. Slide round it. */
export function drawBlocker(c, W, H, rel, a, b){
  const l = P(a, rel, W, H), r = P(b, rel, W, H), h = H * 0.17 * l.k;
  box(c, l.x, l.y - h, r.x - l.x, h, '#e5484d');
}

/* A low bulkhead across the whole floor at head height: an orange bar,
   on two posts. Duck under it. */
export function drawBeam(c, W, H, rel){
  const l = P(-WALL, rel, W, H), r = P(WALL, rel, W, H), k = l.k;
  const top = l.y - H * 0.36 * k, bot = l.y - H * 0.2 * k;
  c.fillStyle = '#8a8f9e'; c.fillRect(l.x, top, 6 * k + 2, l.y - top); c.fillRect(r.x - 6 * k - 2, top, 6 * k + 2, l.y - top);
  box(c, l.x, top, r.x - l.x, bot - top, '#f59e0b');
}

/* A breach in the floor from lane a to b: a black gap with a white edge.
   Hop over it. */
export function drawGap(c, W, H, rel, a, b){
  const d = 0.045;
  const l0 = P(a, rel + d, W, H), r0 = P(b, rel + d, W, H), l1 = P(a, rel - d * 0.4, W, H), r1 = P(b, rel - d * 0.4, W, H);
  c.fillStyle = '#05060a';
  c.beginPath(); c.moveTo(l0.x, l0.y); c.lineTo(r0.x, r0.y); c.lineTo(r1.x, r1.y); c.lineTo(l1.x, l1.y); c.closePath(); c.fill();
  c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1.5, 4 * l1.k); c.stroke();
}

/* A coin: a yellow circle. */
export function drawCoin(c, x, y, s){
  c.fillStyle = '#facc15'; c.beginPath(); c.arc(x, y, s, 0, 6.2832); c.fill();
  c.strokeStyle = INK; c.lineWidth = Math.max(1, s * 0.15); c.stroke();
}

/* A repair station: a green ring with a plus, standing on the floor. */
export function drawFountain(c, W, H, rel, lane, t, used){
  const p = P(lane, rel, W, H), r = H * 0.09 * p.k, y = p.y - r * 1.15;
  c.globalAlpha = used ? 0.35 : 1;
  c.strokeStyle = '#22c55e'; c.lineWidth = Math.max(2, r * 0.22);
  c.beginPath(); c.arc(p.x, y, r, 0, 6.2832); c.stroke();
  c.fillStyle = '#22c55e';
  c.fillRect(p.x - r * 0.15, y - r * 0.55, r * 0.3, r * 1.1); c.fillRect(p.x - r * 0.55, y - r * 0.15, r * 1.1, r * 0.3);
  c.globalAlpha = 1;
}

/* ---------- the crossroads ---------- */

export const DOORS = [-0.68, 0, 0.68];
const DOOR_COLS = ['#e5484d', '#f59e0b', '#a855f7'];
/* Three doors in a wall across the floor: each with its sign over it, the
   votes in front as dots in the voters' colours, and the chosen one
   opening. */
export function drawDoors(c, W, H, rel, t, votes, open = null, opening = 0){
  const l = P(-WALL, rel, W, H), r = P(WALL, rel, W, H), k = l.k, top = l.y - H * 0.62 * k;
  c.fillStyle = '#3a4057'; c.fillRect(l.x, top, r.x - l.x, l.y - top);
  DOORS.forEach((lane, i) => {
    const p = P(lane, rel, W, H), w = H * 0.22 * k, h = H * 0.42 * k, x0 = p.x - w / 2, y0 = p.y - h, col = DOOR_COLS[i];
    c.fillStyle = '#05060a'; c.fillRect(x0, y0, w, h);
    const half = w / 2 * (1 - (open === i ? opening : 0));
    c.fillStyle = col; c.fillRect(x0, y0, half, h); c.fillRect(x0 + w - half, y0, half, h);
    c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(x0, y0, w, h);
    sign(c, ['skull', 'spikes', 'mystery'][i], p.x, y0 - H * 0.07 * k, H * 0.05 * k, col, t);
    const vs = votes[i] || [];
    vs.forEach((vc, n) => {
      const vx = p.x + (n - (vs.length - 1) / 2) * H * 0.045 * k, vy = y0 + h * 0.5;
      c.fillStyle = vc; c.beginPath(); c.arc(vx, vy, H * 0.018 * k, 0, 6.2832); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
    });
  });
}

/* The signs, plain: a skull for a fight, spikes for traps, a ? for anything. */
export function sign(c, kind, x, y, s, col){
  c.save();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, s, 0, 6.2832); c.fill();
  c.strokeStyle = col; c.lineWidth = s * 0.16; c.stroke();
  c.fillStyle = col;
  if (kind === 'skull'){
    c.beginPath(); c.arc(x, y - s * 0.1, s * 0.5, Math.PI * 0.85, Math.PI * 2.15); c.lineTo(x + s * 0.3, y + s * 0.42); c.lineTo(x - s * 0.3, y + s * 0.42); c.closePath(); c.fill();
    c.fillStyle = '#ffffff';
    for (const side of [-1, 1]){ c.beginPath(); c.arc(x + side * s * 0.2, y - s * 0.1, s * 0.13, 0, 6.2832); c.fill(); }
  } else if (kind === 'spikes'){
    c.beginPath(); c.moveTo(x - s * 0.6, y + s * 0.4);
    for (let i = 0; i < 3; i++){ const x0 = x - s * 0.6 + i * s * 0.4; c.lineTo(x0 + s * 0.2, y - s * 0.45); c.lineTo(x0 + s * 0.4, y + s * 0.4); }
    c.closePath(); c.fill();
  } else {
    c.font = `700 ${Math.round(s * 1.4)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('?', x, y + s * 0.08);
  }
  c.restore();
}

/* The guide's crown: a plain yellow crown. */
export function drawCrown(c, x, y, s){
  c.fillStyle = '#facc15'; c.strokeStyle = INK; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x - s, y + s * 0.5); c.lineTo(x - s, y - s * 0.3); c.lineTo(x - s * 0.5, y + s * 0.1); c.lineTo(x, y - s * 0.6); c.lineTo(x + s * 0.5, y + s * 0.1); c.lineTo(x + s, y - s * 0.3); c.lineTo(x + s, y + s * 0.5); c.closePath();
  c.fill(); c.stroke();
}

/* ---------- the crew ---------- */

/* A crew member: a capsule body in their colour with their face in a
   circle on top. st: { air (screen px up), duck 0..1, lean -1..1, hit 0..1
   (a red flash), blink, lost (tracking lost: faded, with a dashed
   outline) }. face(x, y, r) paints the face into the clipped circle. */
export function drawCrew(c, x, base, h, t, col, st, face){
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, base, h * 0.2, h * 0.04, 0, 0, 6.2832); c.fill();
  c.save();
  c.translate(x, base - st.air); c.rotate(st.lean * 0.2);
  if (st.lost) c.globalAlpha = 0.35;
  else if (st.blink && Math.floor(t * 12) % 2) c.globalAlpha = 0.5;
  const tall = h * (1 - (st.duck || 0) * 0.45), w = h * 0.36, r = h * 0.2;
  /* Body. */
  c.fillStyle = col; c.beginPath(); c.roundRect(-w / 2, -tall + r * 1.6, w, tall - r * 1.6, w / 2); c.fill();
  c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  /* Head, with their face. */
  const hy = -tall + r;
  c.save(); c.beginPath(); c.arc(0, hy, r, 0, 6.2832); c.clip();
  c.fillStyle = '#ffffff'; c.fillRect(-r, hy - r, r * 2, r * 2);
  face(0, hy, r);
  c.restore();
  c.strokeStyle = col; c.lineWidth = r * 0.2; c.beginPath(); c.arc(0, hy, r, 0, 6.2832); c.stroke();
  if (st.lost){ c.setLineDash?.([6, 6]); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.arc(0, hy, r * 1.25, 0, 6.2832); c.stroke(); c.setLineDash?.([]); }
  if (st.hit > 0){ c.globalAlpha = st.hit * 0.6; c.fillStyle = '#ff3b3b'; c.beginPath(); c.arc(0, hy, r * 1.2, 0, 6.2832); c.fill(); }
  c.restore();
}

/* Health: a plain bar, in their colour, red when low. */
export function drawHealth(c, x, y, w, frac, col, low){
  const h = w * 0.16;
  c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x - w / 2 - 2, y - 2, w + 4, h + 4);
  c.fillStyle = low ? '#ef4444' : col; c.fillRect(x - w / 2, y, Math.max(2, w * frac), h);
}

/* The helper drone: a white circle with two eyes, bobbing - lower when it
   ducks, higher when it hops. */
export function drawBot(c, x, base, s, t, act = 'fly', k = 0){
  const y = base - s * 1.1 - (act === 'hop' ? k * s * 1.2 : 0) + (act === 'duck' ? s * 0.55 : 0);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, base, s * 0.4, s * 0.08, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, s * 0.4, 0, 6.2832); c.fill();
  c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  c.fillStyle = INK;
  for (const side of [-1, 1]){ c.beginPath(); c.arc(x + side * s * 0.14, y - s * 0.04, s * 0.07, 0, 6.2832); c.fill(); }
}

function box(c, x, y, w, h, col){
  c.fillStyle = col; c.fillRect(x, y, w, h);
  c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(x, y, w, h);
}
