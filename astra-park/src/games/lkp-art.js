/* Last Known Position, drawn as a greybox: plain shapes, one clear colour each, so
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
     doors            two tall rectangles: red (fight), yellow (traps), purple (?)

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

/* The colours: each level has its own (lkp-levels.js), set as it starts.
   These are the greybox ones - a starship's - for anything that doesn't
   say. trees: trees along the sides of the way, in that colour. */
export const METAL = {
  bg: '#1b1f2e', floor: '#2a3043', edge: 'rgba(255,255,255,.5)', blocker: '#e5484d', beam: '#f59e0b', post: '#8a8f9e',
  gap: '#05060a', fountain: '#22c55e', wall: '#3a4057', hall: '#141826', hallFloor: '#232a3c', hallRed: '#2e1d26', trees: null
};
export const PAL = { ...METAL };
export function setPalette(p){ Object.assign(PAL, METAL, p || {}); }

/* ---------- the floor ---------- */

/* The corridor: a flat floor, its edges, lane lines, and cross lines
   sliding past so you can feel the speed. `alarm` tints it red. */
export function drawCorridor(c, W, H, z, t, alarm = 0){
  c.fillStyle = PAL.bg; c.fillRect(0, 0, W, H);
  const nl = P(-WALL, -0.08, W, H), nr = P(WALL, -0.08, W, H), fl = P(-WALL, 1, W, H), fr = P(WALL, 1, W, H);
  if (PAL.trees) trees(c, W, H, z, PAL.trees);
  c.fillStyle = PAL.floor;
  c.beginPath(); c.moveTo(nl.x, nl.y); c.lineTo(fl.x, fl.y); c.lineTo(fr.x, fr.y); c.lineTo(nr.x, nr.y); c.closePath(); c.fill();
  c.strokeStyle = PAL.edge; c.lineWidth = 3;
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

/* Trees along both sides of the way, sliding past: greybox ones, a
   triangle on a trunk, in col. */
function trees(c, W, H, z, col){
  const STEP = 0.16, N = 8;
  for (let n = N - 1; n >= 0; n--){
    const rel = ((n * STEP - z) % (STEP * N) + STEP * N) % (STEP * N) - 0.05;
    if (rel > 1.05 || rel < -0.1) continue;
    for (const side of [-1, 1]){
      const lane = side * (1.6 + ((n * 7 + (side > 0 ? 3 : 0)) % 5) * 0.25);
      const p = P(lane, rel, W, H), h = H * 0.5 * p.k, w = h * 0.45;
      c.fillStyle = '#3d2a17'; c.fillRect(p.x - w * 0.08, p.y - h * 0.3, w * 0.16, h * 0.3);
      c.fillStyle = col; c.beginPath(); c.moveTo(p.x, p.y - h); c.lineTo(p.x + w / 2, p.y - h * 0.25); c.lineTo(p.x - w / 2, p.y - h * 0.25); c.closePath(); c.fill();
    }
  }
}

/* ---------- on the floor ---------- */

/* Debris from lane a to b: a red block. Slide round it. */
export function drawBlocker(c, W, H, rel, a, b){
  const l = P(a, rel, W, H), r = P(b, rel, W, H), h = H * 0.17 * l.k;
  box(c, l.x, l.y - h, r.x - l.x, h, PAL.blocker);
}

/* A low bulkhead across the whole floor at head height: an orange bar,
   on two posts. Duck under it. */
export function drawBeam(c, W, H, rel){
  const l = P(-WALL, rel, W, H), r = P(WALL, rel, W, H), k = l.k;
  const top = l.y - H * 0.36 * k, bot = l.y - H * 0.2 * k;
  c.fillStyle = PAL.post; c.fillRect(l.x, top, 6 * k + 2, l.y - top); c.fillRect(r.x - 6 * k - 2, top, 6 * k + 2, l.y - top);
  box(c, l.x, top, r.x - l.x, bot - top, PAL.beam);
}

/* A breach in the floor from lane a to b: a black gap with a white edge.
   Hop over it. */
export function drawGap(c, W, H, rel, a, b){
  const d = 0.045;
  const l0 = P(a, rel + d, W, H), r0 = P(b, rel + d, W, H), l1 = P(a, rel - d * 0.4, W, H), r1 = P(b, rel - d * 0.4, W, H);
  c.fillStyle = PAL.gap;
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
  c.strokeStyle = PAL.fountain; c.lineWidth = Math.max(2, r * 0.22);
  c.beginPath(); c.arc(p.x, y, r, 0, 6.2832); c.stroke();
  c.fillStyle = PAL.fountain;
  c.fillRect(p.x - r * 0.15, y - r * 0.55, r * 0.3, r * 1.1); c.fillRect(p.x - r * 0.55, y - r * 0.15, r * 1.1, r * 0.3);
  c.globalAlpha = 1;
}

/* ---------- the crossroads ---------- */

export const DOORS = [-0.72, 0.72];
/* Each kind of door: its colour and its sign. */
const DOOR_LOOK = { combat: ['#e5484d', 'skull'], traps: ['#f59e0b', 'spikes'], mystery: ['#a855f7', 'mystery'] };
/* Two doors in a wall across the floor - kinds says which is which - each
   with its sign over it, the votes in front as dots in the voters'
   colours, and the chosen one opening. */
export function drawDoors(c, W, H, rel, t, kinds, votes, open = null, opening = 0){
  /* The wall fills everything behind it: nothing to see past the doors. */
  const l = P(-WALL, rel, W, H), k = l.k;
  c.fillStyle = PAL.wall; c.fillRect(-W, -H, W * 3, l.y + H);
  DOORS.forEach((lane, i) => {
    const p = P(lane, rel, W, H), w = H * 0.5 * k, h = H * 0.52 * k, x0 = p.x - w / 2, y0 = p.y - h, [col, mark] = DOOR_LOOK[kinds[i]];
    c.fillStyle = '#05060a'; c.fillRect(x0, y0, w, h);
    const half = w / 2 * (1 - (open === i ? opening : 0));
    c.fillStyle = col; c.fillRect(x0, y0, half, h); c.fillRect(x0 + w - half, y0, half, h);
    c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(x0, y0, w, h);
    sign(c, mark, p.x, y0 - H * 0.085 * k, H * 0.06 * k, col, t);
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

/* A crew member: a small capsule body in their colour under a big head -
   their own face. st: { air (screen px up), duck 0..1, lean -1..1, hit
   0..1 (a red flash), blink, lost (tracking lost: faded, with a dashed
   outline), photo (the face is their picture, which outlines itself),
   down (knocked down: lying on the floor) }.
   face(x, y, r) paints the face: a picture as it is, anything else into
   a clipped circle. */
export function drawCrew(c, x, base, h, t, col, st, face){
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, base, h * 0.2, h * 0.04, 0, 0, 6.2832); c.fill();
  c.save();
  c.translate(x, base - st.air); c.rotate(st.lean * 0.2);
  if (st.down){ c.translate(h * 0.4, -h * 0.16); c.rotate(-Math.PI / 2); c.globalAlpha = 0.55; }
  if (st.lost) c.globalAlpha = 0.35;
  else if (st.blink && Math.floor(t * 12) % 2) c.globalAlpha = 0.5;
  const tall = h * (1 - (st.duck || 0) * 0.45), w = h * 0.32, r = h * 0.3;
  /* Body. */
  c.fillStyle = col; c.beginPath(); c.roundRect(-w / 2, -tall + r * 1.7, w, tall - r * 1.7, w / 2); c.fill();
  c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  /* Head, with their face. */
  const hy = -tall + r;
  if (st.photo) face(0, hy, r);
  else {
    c.save(); c.beginPath(); c.arc(0, hy, r, 0, 6.2832); c.clip();
    c.fillStyle = '#ffffff'; c.fillRect(-r, hy - r, r * 2, r * 2);
    face(0, hy, r);
    c.restore();
    c.strokeStyle = col; c.lineWidth = r * 0.2; c.beginPath(); c.arc(0, hy, r, 0, 6.2832); c.stroke();
  }
  if (st.lost){ c.setLineDash?.([6, 6]); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.arc(0, hy, r * 1.25, 0, 6.2832); c.stroke(); c.setLineDash?.([]); }
  if (st.hit > 0){ c.globalAlpha = st.hit * 0.6; c.fillStyle = '#ff3b3b'; c.beginPath(); c.arc(0, hy, r * 1.2, 0, 6.2832); c.fill(); }
  c.restore();
}

/* A crew member hitting out: a ring bursting along the floor round them,
   rx across (screen px), in their colour - brighter when they're
   standing with a teammate. k runs 1 to 0 as it fades. */
export function drawPulse(c, x, y, rx, k, col, team){
  c.save(); c.globalAlpha = k * (team ? 0.9 : 0.6);
  c.strokeStyle = team ? '#7ff3ff' : col; c.lineWidth = rx * 0.06 * (team ? 1.5 : 1);
  const u = 0.5 + 0.5 * (1 - k);
  c.beginPath(); c.ellipse(x, y, rx * u, rx * u * 0.22, 0, 0, 6.2832); c.stroke();
  c.restore();
}

/* Asleep: Z z z drifting up from (x, y), s tall. */
export function drawZzz(c, x, y, s, t){
  c.save(); c.textAlign = 'center'; c.fillStyle = '#ffffff';
  for (let k = 0; k < 3; k++){
    const u = (t * 0.5 + k / 3) % 1;
    c.globalAlpha = Math.sin(u * Math.PI);
    c.font = `700 ${Math.round(s * (0.5 + u * 0.6))}px Fredoka, sans-serif`;
    c.fillText('z', x - u * s * 0.6, y - u * s * 1.8);
  }
  c.restore();
}

/* ---------- the robots ---------- */

/* A rustbot: a rust-orange box on stubby legs, a head with one glowing
   eye, an arm each side. s is its height. st: { swing 1..0 (its arm
   coming down on someone), flash 1..0 (just hit: white), hp 0..1 (its
   health bar) }. */
export function drawRustbot(c, x, base, s, t, st){
  const bob = Math.sin(t * 7) * s * 0.02, w = s * 0.55;
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, base, w * 0.6, s * 0.06, 0, 0, 6.2832); c.fill();
  c.save(); c.translate(x, base + bob);
  const body = st.flash > 0.5 ? '#ffffff' : '#c2410c';
  /* Legs, body, head. */
  c.fillStyle = '#4b5563'; c.fillRect(-w * 0.35, -s * 0.18, w * 0.2, s * 0.18); c.fillRect(w * 0.15, -s * 0.18, w * 0.2, s * 0.18);
  box(c, -w / 2, -s * 0.7, w, s * 0.52, body);
  box(c, -w * 0.32, -s, w * 0.64, s * 0.3, st.flash > 0.5 ? '#ffffff' : '#7c2d12');
  c.fillStyle = '#7ff3ff';
  c.beginPath(); c.arc(0, -s * 0.85, s * 0.07, 0, 6.2832); c.fill();
  /* Arms: the right one chops down as it swings. */
  const lift = st.swing > 0 ? Math.sin(st.swing * Math.PI) * 0.8 : 0;
  c.fillStyle = '#9a3412';
  c.fillRect(-w * 0.72, -s * 0.62, w * 0.2, s * 0.36);
  c.save(); c.translate(w * 0.62, -s * 0.62); c.rotate(-lift * 2.4);
  c.fillRect(-w * 0.1, 0, w * 0.2, s * 0.36); c.restore();
  c.restore();
  /* Health over its head. */
  if (st.hp < 1){
    const bw = s * 0.6, by = base - s * 1.12;
    c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x - bw / 2 - 2, by - 2, bw + 4, s * 0.07 + 4);
    c.fillStyle = '#ff8a3d'; c.fillRect(x - bw / 2, by, Math.max(1, bw * st.hp), s * 0.07);
  }
}

/* A charger-beast: the planet's own wildlife, before the robots wake -
   a stocky four-legged thing, mossy green, with two short horns. Drawn
   like a rustbot (same st), as it plays like one. */
export function drawBeast(c, x, base, s, t, st){
  const bob = Math.abs(Math.sin(t * 7)) * s * 0.03, w = s * 0.75;
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, base, w * 0.6, s * 0.06, 0, 0, 6.2832); c.fill();
  c.save(); c.translate(x, base - bob);
  const body = st.flash > 0.5 ? '#ffffff' : '#4d7c3a';
  /* Legs, body, head with horns. */
  c.fillStyle = '#2f4a22';
  for (const lx of [-0.38, -0.18, 0.12, 0.32]) c.fillRect(lx * w, -s * 0.25, w * 0.1, s * 0.25);
  c.fillStyle = body; c.strokeStyle = INK; c.lineWidth = 3;
  c.beginPath(); c.ellipse(0, -s * 0.42, w * 0.5, s * 0.22, 0, 0, 6.2832); c.fill(); c.stroke();
  const hx = st.swing > 0 ? Math.sin(st.swing * Math.PI) * w * 0.1 : 0;
  c.beginPath(); c.ellipse(hx, -s * 0.5, w * 0.22, s * 0.18, 0, 0, 6.2832); c.fill(); c.stroke();
  c.fillStyle = '#e8dcc0';
  for (const sd of [-1, 1]){ c.beginPath(); c.moveTo(hx + sd * w * 0.12, -s * 0.62); c.lineTo(hx + sd * w * 0.22, -s * 0.8); c.lineTo(hx + sd * w * 0.05, -s * 0.64); c.fill(); }
  c.fillStyle = '#ffdd55'; for (const sd of [-1, 1]){ c.beginPath(); c.arc(hx + sd * w * 0.08, -s * 0.52, s * 0.03, 0, 6.2832); c.fill(); }
  c.restore();
  if (st.hp < 1){
    const bw = s * 0.6, by = base - s * 0.95;
    c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x - bw / 2 - 2, by - 2, bw + 4, s * 0.07 + 4);
    c.fillStyle = '#ff8a3d'; c.fillRect(x - bw / 2, by, Math.max(1, bw * st.hp), s * 0.07);
  }
}

/* The depot, at depth rel: what = 'shed', an old metal shed across the
   end of the path, its door open; or 'piece', the ship's engine piece on
   the floor, glowing, with a ring round it filling (charge 0..1) as the
   crew power it up. */
export function drawDepot(c, W, H, rel, t, what, charge = 0){
  const p = P(0, rel, W, H), k = p.k;
  if (what === 'shed'){
    const w = H * 1.1 * k, h = H * 0.55 * k;
    box(c, p.x - w / 2, p.y - h, w, h, '#6b7280');
    c.fillStyle = '#4b5563'; c.beginPath(); c.moveTo(p.x - w * 0.55, p.y - h); c.lineTo(p.x, p.y - h * 1.35); c.lineTo(p.x + w * 0.55, p.y - h); c.fill();
    c.fillStyle = '#111318'; c.fillRect(p.x - w * 0.15, p.y - h * 0.65, w * 0.3, h * 0.65);
    return;
  }
  const s = H * 0.09 * k, cy = p.y - s * 0.6;
  const g = c.createRadialGradient(p.x, cy, 0, p.x, cy, s * 3);
  g.addColorStop(0, `rgba(127,243,255,${0.5 + 0.2 * Math.sin(t * 5)})`); g.addColorStop(1, 'rgba(127,243,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(p.x, cy, s * 3, 0, 6.2832); c.fill();
  box(c, p.x - s, cy - s * 0.6, s * 2, s * 1.2, '#cbd5e1');
  c.fillStyle = '#7ff3ff'; c.fillRect(p.x - s * 0.6, cy - s * 0.2, s * 1.2, s * 0.4);
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = s * 0.25;
  c.beginPath(); c.arc(p.x, cy, s * 2, 0, 6.2832); c.stroke();
  c.strokeStyle = '#7ff3ff'; c.beginPath(); c.arc(p.x, cy, s * 2, -Math.PI / 2, -Math.PI / 2 + charge * 6.2832); c.stroke();
}

/* A treasure chest at depth rel: a wooden box with gold bands, its lid
   lifting (open 0..1) - and once it's open, coins heaped inside and a
   glow. */
export function drawChest(c, W, H, rel, t, open, full){
  const p = P(0, rel, W, H), s = H * 0.16 * p.k, x = p.x, y = p.y;
  if (full){
    const g = c.createRadialGradient(x, y - s * 0.6, 0, x, y - s * 0.6, s * 2.2);
    g.addColorStop(0, `rgba(255,214,90,${0.5 + 0.15 * Math.sin(t * 4)})`); g.addColorStop(1, 'rgba(255,214,90,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y - s * 0.6, s * 2.2, 0, 6.2832); c.fill();
  }
  box(c, x - s, y - s * 0.7, s * 2, s * 0.7, '#8b5a2b');
  c.fillStyle = '#e8b931'; c.fillRect(x - s * 0.7, y - s * 0.7, s * 0.14, s * 0.7); c.fillRect(x + s * 0.56, y - s * 0.7, s * 0.14, s * 0.7);
  if (full) for (let k = 0; k < 9; k++){
    c.fillStyle = '#facc15'; c.strokeStyle = INK; c.lineWidth = 2;
    c.beginPath(); c.arc(x - s * 0.7 + (k % 5) * s * 0.35, y - s * 0.72 - Math.floor(k / 5) * s * 0.14, s * 0.13, 0, 6.2832); c.fill(); c.stroke();
  }
  /* The lid, swinging up and back. */
  c.save(); c.translate(x, y - s * 0.7); c.scale(1, Math.cos(open * 1.9));
  box(c, -s, -s * 0.4, s * 2, s * 0.4, '#a0692f');
  c.fillStyle = '#e8b931'; c.fillRect(-s * 0.14, -s * 0.4, s * 0.28, s * 0.4);
  c.restore();
}

/* ---------- the bosses ---------- */

/* The Scout: a lean, tan, long-legged robot with one big eye visor and
   an antenna, s tall. st: { flash (just hit), tell 0..1 (crouching to
   charge, eye red), dash (charging: leaning in), dazed (staggered or
   stuck: slumped, stars), panic (phase 3: shaking), off (powered off:
   dark, slumped) }. */
export function drawScout(c, x, base, s, t, st){
  const w = s * 0.5, crouch = st.tell * 0.15 + (st.dazed || st.off ? 0.2 : 0);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, base, w * 0.9, s * 0.05, 0, 0, 6.2832); c.fill();
  c.save();
  c.translate(x + (st.panic && !st.off ? Math.sin(t * 40) * s * 0.01 : 0), base);
  if (st.dash) c.rotate(0.15);
  if (st.dazed || st.off) c.rotate(-0.12);
  const body = st.flash > 0.5 ? '#ffffff' : st.off ? '#6b6457' : '#c9b48a';
  /* Legs. */
  c.strokeStyle = '#5b5346'; c.lineWidth = w * 0.12; c.lineCap = 'round';
  for (const sd of [-1, 1]){ c.beginPath(); c.moveTo(sd * w * 0.25, -s * (0.55 - crouch)); c.lineTo(sd * w * 0.45, -s * 0.25); c.lineTo(sd * w * 0.3, 0); c.stroke(); }
  /* Body and head. */
  c.translate(0, s * crouch);
  box(c, -w / 2, -s * 0.85, w, s * 0.35, body);
  c.fillStyle = '#2b2a33'; c.fillRect(-w * 0.4, -s * 0.78, w * 0.8, s * 0.14);
  const eye = st.off ? '#2b2a33' : st.tell > 0 || st.dash ? '#ff3b3b' : '#7ff3ff';
  c.fillStyle = eye; c.fillRect(-w * 0.32 + Math.sin(t * 2) * w * 0.1, -s * 0.76, w * 0.25, s * 0.1);
  c.strokeStyle = '#5b5346'; c.lineWidth = w * 0.05;
  c.beginPath(); c.moveTo(w * 0.3, -s * 0.85); c.lineTo(w * 0.4, -s * 1.02); c.stroke();
  c.fillStyle = st.off ? '#2b2a33' : '#ff8a3d'; c.beginPath(); c.arc(w * 0.4, -s * 1.03, w * 0.06, 0, 6.2832); c.fill();
  c.restore();
  /* Dazed: stars going round its head. */
  if (st.dazed && !st.off) for (let k = 0; k < 4; k++){
    const a = t * 5 + k * 1.57;
    c.fillStyle = k % 2 ? '#ffd24a' : '#ffffff';
    c.beginPath(); c.arc(x + Math.cos(a) * w * 0.6, base - s * 0.95 + Math.sin(a) * s * 0.06, s * 0.03, 0, 6.2832); c.fill();
  }
}

/* ---------- the Warden ---------- */

/* Each side of the ring, a phase each, has its own light. */
export const SIDES = ['#3fd0ff', '#ffb02e', '#ff3b3b'];
/* How far in (corridor depth) the pit's near edge is. */
export const PIT_NEAR = 0.26;

/* The Warden's arena: a ring of floor round a great pit, seen from on the
   ring, looking in. angle is how far round the ring the view is, in
   quarter turns: going round, the far wall's panels slide one way and the
   floor's lines the other. tint is that side's light. */
export function drawArena(c, W, H, angle, t, tint){
  const a = angle * Math.PI / 2;
  c.fillStyle = '#12131c'; c.fillRect(0, 0, W, H);
  /* The far side of the ring: its wall, a band of panels with lights. */
  const top = H * 0.16, bot = H * 0.42;
  c.fillStyle = '#1d2030'; c.fillRect(0, top, W, bot - top);
  for (let k = 0; k < 24; k++){
    const rel = k * Math.PI / 12 - a, s = Math.sin(rel), z = Math.cos(rel);
    if (z < 0.15) continue;
    const x = W / 2 + s * W * 0.62, w = W * 0.05 * z;
    c.fillStyle = '#272b3e'; c.fillRect(x - w / 2, top + H * 0.02, w, bot - top - H * 0.04);
    c.fillStyle = tint; c.globalAlpha = 0.5 * z; c.fillRect(x - w * 0.3, top + H * 0.05, w * 0.6, H * 0.012); c.globalAlpha = 1;
  }
  /* The ring's floor - the far side of it a strip under the wall - and
     the pit in the middle: a great dark hollow from the near edge
     (PIT_NEAR) back to the far one, lit from below. */
  const near = P(0, PIT_NEAR, W, H).y, far = P(0, 1, W, H).y + H * 0.01;
  c.fillStyle = '#2a2d3d'; c.fillRect(0, bot, W, H - bot);
  const cy = (near + far) / 2, ry = (near - far) / 2, rx = W * 0.4;
  const g = c.createRadialGradient(W / 2, cy, H * 0.02, W / 2, cy, rx);
  g.addColorStop(0, tint); g.addColorStop(0.18, '#0b0c14'); g.addColorStop(1, '#07080d');
  c.fillStyle = g; c.beginPath(); c.ellipse(W / 2, cy, rx, ry, 0, 0, 6.2832); c.fill();
  c.strokeStyle = tint; c.globalAlpha = 0.7; c.lineWidth = H * 0.006;
  c.beginPath(); c.ellipse(W / 2, cy, rx, ry, 0, 0, 6.2832); c.stroke(); c.globalAlpha = 1;
  /* A column up out of the pit, that the core stands on. */
  c.fillStyle = '#1f2230'; c.fillRect(W / 2 - W * 0.04, cy - H * 0.06, W * 0.08, H * 0.06 + ry * 0.3);
  /* The floor's lines: round the ring (across) and out from the middle,
     these sliding as the view goes round. */
  c.strokeStyle = LINE; c.lineWidth = 2;
  for (const rel of [0.04, 0.1, 0.17]){ const p = P(-3, rel, W, H), q = P(3, rel, W, H); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); }
  const slide = ((angle * 4) % 1 + 1) % 1;
  for (let k = -7; k <= 7; k++){
    const lane = (k + slide) * 0.4, n = P(lane, -0.08, W, H), f = P(lane, PIT_NEAR, W, H);
    if (Math.abs(f.x - W / 2) < rx * 0.98 && f.y < near + 2){
      /* Stop at the pit's edge. */
      const e = near - ry * (1 - Math.sqrt(Math.max(0, 1 - ((f.x - W / 2) / rx) ** 2)));
      c.beginPath(); c.moveTo(n.x, n.y); c.lineTo(f.x, Math.max(f.y, e)); c.stroke();
    } else { c.beginPath(); c.moveTo(n.x, n.y); c.lineTo(f.x, f.y); c.stroke(); }
  }
}

/* Its core: a great round reactor, s across, glowing cyan - red and
   pulsing in overload, white when hit. st.side is the side of it in
   view: 0 its face, 1 the hatch its robots come out of, 2 cracked
   open. */
export function drawCore(c, x, base, s, t, st){
  const r = s / 2, cy = base - r * 1.1;
  c.save();
  c.fillStyle = '#2c3142'; c.fillRect(x - r * 1.5, cy - r * 0.4, r * 3, r * 1.5);
  c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(x - r * 1.5, cy - r * 0.4, r * 3, r * 1.5);
  const glow = st.flash > 0.5 ? '#ffffff' : st.glow ? `hsl(0,90%,${55 + 10 * Math.sin(t * 10)}%)` : '#3fd0ff';
  const g = c.createRadialGradient(x, cy, r * 0.1, x, cy, r * 1.4);
  g.addColorStop(0, st.glow ? 'rgba(255,80,80,.55)' : 'rgba(63,208,255,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, cy, r * 1.4, 0, 6.2832); c.fill();
  c.fillStyle = '#4b5563'; c.beginPath(); c.arc(x, cy, r, 0, 6.2832); c.fill(); c.stroke();
  c.fillStyle = glow; c.beginPath(); c.arc(x, cy, r * (0.55 + 0.04 * Math.sin(t * 6)), 0, 6.2832); c.fill();
  c.fillStyle = INK; c.beginPath(); c.arc(x, cy, r * 0.2, 0, 6.2832); c.fill();
  if (st.side === 1){
    /* The hatch, low on its housing. */
    box(c, x - r * 0.5, cy + r * 0.6, r, r * 0.45, '#1f2230');
    c.fillStyle = '#ffb02e'; c.fillRect(x - r * 0.4, cy + r * 0.66, r * 0.8, r * 0.06);
  } else if (st.side === 2){
    /* Cracks across it, glowing. */
    c.strokeStyle = glow; c.lineWidth = r * 0.06; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - r * 0.9, cy - r * 0.3); c.lineTo(x - r * 0.5, cy - r * 0.1); c.lineTo(x - r * 0.6, cy + r * 0.3); c.lineTo(x - r * 0.2, cy + r * 0.5); c.stroke();
    c.beginPath(); c.moveTo(x + r * 0.9, cy - r * 0.5); c.lineTo(x + r * 0.55, cy - r * 0.2); c.lineTo(x + r * 0.7, cy + r * 0.2); c.stroke();
  }
  c.restore();
}

/* An arm: a thick beam from its shoulder (sx, sy) to a big square fist at
   (fx, fy), s across. White when hit; a health bar over the fist while
   it's down. */
export function drawArm(c, sx, sy, fx, fy, s, st){
  c.save();
  c.strokeStyle = INK; c.lineCap = 'round'; c.lineWidth = s * 0.55;
  c.beginPath(); c.moveTo(sx, sy); c.lineTo(fx, fy - s * 0.5); c.stroke();
  c.strokeStyle = st.flash > 0.5 ? '#ffffff' : '#6b7280'; c.lineWidth = s * 0.4;
  c.beginPath(); c.moveTo(sx, sy); c.lineTo(fx, fy - s * 0.5); c.stroke();
  box(c, fx - s * 0.6, fy - s, s * 1.2, s, st.flash > 0.5 ? '#ffffff' : '#c2410c');
  if (st.down && st.hp < 1){
    c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(fx - s * 0.6 - 2, fy - s * 1.3 - 2, s * 1.2 + 4, s * 0.14 + 4);
    c.fillStyle = '#ff8a3d'; c.fillRect(fx - s * 0.6, fy - s * 1.3, s * 1.2 * st.hp, s * 0.14);
  }
  c.restore();
}

/* A shockwave rolling along the floor at depth rel: a bright ridge right
   across. Jump it. */
export function drawShockwave(c, W, H, rel, t){
  const l = P(-WALL, rel, W, H), r = P(WALL, rel, W, H), k = l.k;
  c.save();
  c.strokeStyle = '#7ff3ff'; c.lineWidth = H * 0.02 * k; c.lineCap = 'round';
  c.shadowColor = '#7ff3ff'; c.shadowBlur = 20 * k;
  c.beginPath(); c.moveTo(l.x, l.y);
  for (let u = 0; u <= 1.001; u += 0.05) c.lineTo(l.x + (r.x - l.x) * u, l.y - Math.abs(Math.sin(u * 18 + t * 12)) * H * 0.03 * k);
  c.stroke();
  c.restore();
}

/* A laser sweeping in at head height at depth rel: a red bar right
   across. Duck under it. */
export function drawSweep(c, W, H, rel, t){
  const l = P(-WALL, rel, W, H), r = P(WALL, rel, W, H), k = l.k;
  const y = l.y - H * 0.28 * k;
  c.save();
  c.shadowColor = '#ff3b3b'; c.shadowBlur = 24 * k;
  c.fillStyle = `rgba(255,60,60,${0.75 + 0.2 * Math.sin(t * 20)})`;
  c.fillRect(l.x, y - H * 0.012 * k, r.x - l.x, H * 0.024 * k);
  c.restore();
}

/* Health: a plain bar, in their colour, red when low. */
export function drawHealth(c, x, y, w, frac, col, low){
  const h = w * 0.16;
  c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x - w / 2 - 2, y - 2, w + 4, h + 4);
  c.fillStyle = low ? '#ef4444' : col; c.fillRect(x - w / 2, y, Math.max(2, w * frac), h);
}

function box(c, x, y, w, h, col){
  c.fillStyle = col; c.fillRect(x, y, w, h);
  c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(x, y, w, h);
}
