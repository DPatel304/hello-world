/* Last Known Position, the look - the places and the boss: the fork in
   the path, the depot (a whole works yard), the engine piece, the red-light
   room, the treasure cave with its suits copying the players, and Level
   1's boss, the Sweeper. Drawn when the level's palette has a `world`
   (lkp-art.js hands over to these); L is that world palette. */
import { P, RUN, HORIZON, sign } from './lkp-art.js';
import { mix, rgba, glow, cast, tree, PATH_HALF } from './lkp-world.js';
import { L as LM } from '../tracking/pose.js';

const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, 6.2832); c.fill(); };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const metal = (c, x0, x1, lit = '#c9ced9', mid = '#737a90', dark = '#2c3042') => {
  const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, lit); g.addColorStop(0.45, mid); g.addColorStop(1, dark); return g;
};
const LOOK = { elite: ['#ff4d63', 'skull'], combat: ['#ff4d63', 'skull'], traps: ['#ffb02e', 'spikes'], mystery: ['#b98cff', 'mystery'] };

/* ---------- the fork ---------- */

/* The path splitting in two right in front of the crew: each way bending
   off into the haze, grass and trees between, and a sign floating over
   each - the votes as dots in the voters' colours above it. kinds, votes,
   open, opening as drawDoors. The signs sit over lanes -0.72 and 0.72, where
   the crew stand to vote. */
export function worldFork(c, W, H, rel, t, kinds, votes, open, opening, L){
  const s0 = Math.max(RUN + 0.005, rel - 0.2), far = 1.05;
  /* Each way by its two edges, d past the split: the outer edge carries
     straight on from the path's own edge and bends gently away; the inner
     edges start together at a point in the middle and open out - so the
     road you're on runs smoothly into both. (Both ways are centred on lane
     0.72 by the time they reach the signs, d = 0.2.) */
  const D = (r) => Math.max(0, r - s0);
  const outer = (r) => PATH_HALF + 4.25 * D(r) * D(r);
  const inner = (r) => 4.9 * Math.pow(D(r), 2.3);
  const steps = (a, b, n = 32) => { const out = []; for (let i = 0; i <= n; i++) out.push(a + (b - a) * Math.pow(i / n, 1.5)); return out; };
  const strip = (a, b, rs) => {
    c.beginPath();
    rs.forEach((r, i) => { const q = P(a(r), r, W, H); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
    for (let i = rs.length - 1; i >= 0; i--){ const q = P(b(rs[i]), rs[i], W, H); c.lineTo(q.x, q.y); }
    c.closePath(); c.fill();
  };
  const HY = HORIZON * H, rs = steps(s0, far);
  /* The two ways, the path's own colours, over the straight way on. */
  const pg = c.createLinearGradient(0, HY, 0, H); pg.addColorStop(0, mix(L.path[0], L.haze, 0.4)); pg.addColorStop(1, L.path[1]);
  c.fillStyle = pg;
  strip((r) => -outer(r), (r) => -inner(r), rs);
  strip((r) => inner(r), (r) => outer(r), rs);
  /* Each way's worn track, carrying on from the path's. */
  c.fillStyle = 'rgba(40,30,70,.12)';
  for (const sd of [-1, 1]){
    const at = (r, e) => sd * (inner(r) + (outer(r) - inner(r)) * 0.435) + e;
    strip((r) => at(r, -0.18), (r) => at(r, 0.18), rs);
  }
  /* Grass between them, from the point where they part. */
  const gg = c.createLinearGradient(0, HY, 0, H);
  gg.addColorStop(0, mix(L.ground[0], L.haze, 0.45)); gg.addColorStop(0.3, L.ground[1]); gg.addColorStop(1, L.ground[2]);
  c.fillStyle = gg; strip((r) => -inner(r), (r) => inner(r), rs);
  for (let n = 0; n < 160; n++){
    const r = s0 + 0.02 + Math.pow(hash(n + 900), 1.6) * (far - s0), a = -inner(r) + 0.06, b = inner(r) - 0.06;
    if (b <= a) continue;
    const q = P(a + (b - a) * hash(n + 901), r, W, H), h = H * (0.012 + hash(n + 902) * 0.02) * q.k;
    c.strokeStyle = rgba(L.grass[n % 2], 0.5 + 0.4 * Math.min(1, q.k)); c.lineWidth = Math.max(1, H * 0.003 * q.k);
    c.beginPath(); c.moveTo(q.x, q.y); c.quadraticCurveTo(q.x, q.y - h * 0.6, q.x - h * 0.2, q.y - h); c.stroke();
  }
  /* Stones along every edge, like the path's. */
  for (let n = 0; n < 34; n++){
    const r = s0 + 0.015 + n * 0.03; if (r > far) break;
    for (const lane of [-outer(r) - 0.02, outer(r) + 0.02, ...(inner(r) > 0.08 ? [-inner(r) + 0.02, inner(r) - 0.02] : [])]){
      const q = P(lane, r, W, H), rr = H * 0.012 * q.k + 0.5;
      if (q.x < -40 || q.x > W + 40) continue;
      c.fillStyle = 'rgba(30,25,60,.3)'; c.beginPath(); c.ellipse(q.x + rr * 0.6, q.y + rr * 0.2, rr * 1.1, rr * 0.4, 0, 0, 6.2832); c.fill();
      c.fillStyle = L.rock[1]; c.beginPath(); c.ellipse(q.x, q.y - rr * 0.3, rr * 1.1, rr * 0.7, 0, 0, 6.2832); c.fill();
      c.fillStyle = L.rock[0]; c.beginPath(); c.ellipse(q.x - rr * 0.35, q.y - rr * 0.55, rr * 0.6, rr * 0.35, 0, 0, 6.2832); c.fill();
    }
  }
  /* Trees in the split, further back. */
  for (const [lane, d, n] of [[0, 0.55, 7], [-0.25, 0.75, 8], [0.3, 0.95, 9]]) if (s0 + d < far) tree(c, W, H, lane, s0 + d, L, n);
  /* The haze: neither way can be seen far. */
  const fy = P(0, Math.min(0.95, s0 + 0.35), W, H).y;
  if (fy > HY){
    const fg = c.createLinearGradient(0, HY - H * 0.06, 0, fy);
    const hz = mix(L.haze, '#ffffff', 0.35);
    fg.addColorStop(0, rgba(L.haze, 0)); fg.addColorStop(0.2, rgba(L.haze, 0.9)); fg.addColorStop(0.6, `rgba(${hz.slice(4, -1)},.75)`); fg.addColorStop(1, rgba(L.haze, 0));
    c.fillStyle = fg; c.fillRect(0, HY - H * 0.06, W, fy - HY + H * 0.06);
    for (let n = 0; n < 12; n++){
      const x = hash(n + 950) * W, y = HY + hash(n + 951) * (fy - HY), rw = W * (0.08 + hash(n + 952) * 0.14) + Math.sin(t * 0.3 + n) * W * 0.01;
      c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.ellipse(x, y, rw, rw * 0.16, 0, 0, 6.2832); c.fill();
    }
  }
  /* The signs, floating over each way. */
  [-0.72, 0.72].forEach((lane, i) => {
    const [col, mark] = LOOK[kinds[i]] || LOOK.mystery;
    const p = P(lane, rel, W, H), R = H * 0.13 * p.k * (open === i ? 1 + 0.35 * opening : 1);
    const y = p.y - H * 0.5 * p.k - R + Math.sin(t * 2 + i * 2) * R * 0.08;
    c.save();
    if (open != null && open !== i) c.globalAlpha = Math.max(0, 1 - opening * 1.5);
    /* a beam of light down to the path, and its glow on the ground */
    const bg = c.createLinearGradient(0, y, 0, p.y); bg.addColorStop(0, rgba(col, 0.4)); bg.addColorStop(1, rgba(col, 0));
    c.fillStyle = bg; c.beginPath(); c.moveTo(p.x - R * 0.3, y); c.lineTo(p.x + R * 0.3, y); c.lineTo(p.x + R * 0.95, p.y); c.lineTo(p.x - R * 0.95, p.y); c.closePath(); c.fill();
    c.fillStyle = rgba(col, 0.3); c.beginPath(); c.ellipse(p.x, p.y, R * 1.1, R * 0.25, 0, 0, 6.2832); c.fill();
    glow(c, p.x, y, R * 2.4, col, 0.9);
    c.fillStyle = 'rgba(20,15,45,.6)'; circ(c, p.x, y, R);
    c.strokeStyle = col; c.lineWidth = Math.max(2, R * 0.07); c.beginPath(); c.arc(p.x, y, R, 0, 6.2832); c.stroke();
    if (mark === 'skull') skull(c, p.x, y, R);
    else if (mark === 'mystery'){
      c.font = `700 ${Math.round(R * 1.55)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#efe3ff'; c.fillText('?', p.x, y + R * 0.08);
    } else sign(c, mark, p.x, y, R * 0.7, col);
    /* the votes */
    const vs = (votes && votes[i]) || [];
    vs.forEach((vc, n) => {
      const vx = p.x + (n - (vs.length - 1) / 2) * R * 0.55, vy = y - R * 1.35, vr = R * 0.2;
      c.fillStyle = vc; circ(c, vx, vy, vr); c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1.5, vr * 0.25); c.beginPath(); c.arc(vx, vy, vr, 0, 6.2832); c.stroke();
    });
    c.restore();
  });
}

function skull(c, x, y, R){
  const k = R / 95;
  c.fillStyle = '#ffe3e7'; c.beginPath(); c.ellipse(x, y - 12 * k, 52 * k, 48 * k, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.roundRect(x - 32 * k, y + 14 * k, 64 * k, 40 * k, 10 * k); c.fill();
  c.fillStyle = '#2b2a45'; for (const d of [-1, 1]){ c.beginPath(); c.ellipse(x + d * 20 * k, y - 8 * k, 15 * k, 17 * k, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = '#ff4d63'; for (const d of [-1, 1]) circ(c, x + d * 20 * k, y - 6 * k, 6 * k);
  c.fillStyle = '#2b2a45'; for (const d of [-16, 0, 16]) c.fillRect(x + (d - 3) * k, y + 28 * k, 6 * k, 26 * k);
}

/* ---------- the depot ---------- */

/* The depot, a whole robot works yard across the end of the path at depth
   rel: towers either side, a long hangar with an arched roof, its bay door
   rolled up and the empty pedestal glowing inside, old robots slumped in
   front, crates, a crane, a fence running off both ways. */
export function worldDepot(c, W, H, rel, t, L){
  const p = P(0, rel, W, H), m = (H / 1080) * (p.k / 0.215), X = p.x, base = p.y;
  const at = (dx) => X + dx * m, top = base - 300 * m, Lx = -800, Rx = 800;
  cast(c, at(-200), base, 60 * m, 900 * m, 0.35);
  /* a fence either side, running off */
  c.strokeStyle = 'rgba(40,36,70,.8)'; c.lineWidth = Math.max(1, 4 * m);
  for (const [x0, x1] of [[-W, at(Lx - 40)], [at(Rx + 40), W * 2]]){
    for (let x = x0; x < x1; x += 40 * m){ c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - 70 * m); c.stroke(); }
    for (const y of [60, 30]){ c.beginPath(); c.moveTo(x0, base - y * m); c.lineTo(x1, base - y * m); c.stroke(); }
  }
  /* side towers, hazard-banded, a warning light on each */
  for (const [x, w, h] of [[Lx - 40, 130, 420], [Rx - 90, 130, 380]]){
    const g = c.createLinearGradient(at(x), 0, at(x + w), 0); g.addColorStop(0, '#9c97be'); g.addColorStop(1, '#3a3756');
    c.fillStyle = g; c.fillRect(at(x), base - h * m, w * m, h * m);
    for (let k = 0; k < 6; k++){ c.fillStyle = k % 2 ? '#2b2a45' : '#e8b830'; c.fillRect(at(x), base - (h - 30 - k * 12) * m, w * m, 6 * m); }
    for (let k = 0; k < 4; k++){ c.fillStyle = '#1d1b30'; c.fillRect(at(x + 25), base - (h - 110 - k * 70) * m, (w - 50) * m, 30 * m); c.fillStyle = 'rgba(126,246,255,.25)'; c.fillRect(at(x + 25), base - (h - 110 - k * 70) * m, (w - 50) * 0.4 * m, 30 * m); }
    const blink = 0.5 + 0.5 * Math.sin(t * 3 + x);
    glow(c, at(x + w / 2), base - (h + 14) * m, 40 * m, '#ff6b5b', 0.5 + 0.5 * blink); c.fillStyle = '#ff8a7a'; circ(c, at(x + w / 2), base - (h + 14) * m, 10 * m);
  }
  /* the hangar */
  const hg = c.createLinearGradient(at(Lx), 0, at(Rx), 0); hg.addColorStop(0, '#8e89b2'); hg.addColorStop(0.5, '#5c5884'); hg.addColorStop(1, '#2f2c4a');
  c.fillStyle = hg; c.fillRect(at(Lx + 80), top, (Rx - Lx - 160) * m, base - top);
  c.fillStyle = 'rgba(0,0,0,.12)'; for (let x = Lx + 80; x < Rx - 80; x += 28) c.fillRect(at(x), top, 12 * m, base - top);
  const rg = c.createLinearGradient(at(Lx), 0, at(Rx), 0); rg.addColorStop(0, '#c3bedc'); rg.addColorStop(1, '#4a4670');
  c.fillStyle = rg; c.beginPath(); c.moveTo(at(Lx + 50), top + 10 * m); c.quadraticCurveTo(X, top - 170 * m, at(Rx - 50), top + 10 * m); c.lineTo(at(Rx - 50), top + 30 * m); c.quadraticCurveTo(X, top - 140 * m, at(Lx + 50), top + 30 * m); c.fill();
  c.strokeStyle = rgba(L.rim, 0.7); c.lineWidth = Math.max(1, 4 * m); c.beginPath(); c.moveTo(at(Lx + 50), top + 10 * m); c.quadraticCurveTo(at(-300), top - 120 * m, X, top - 80 * m); c.stroke();
  c.fillStyle = 'rgba(170,90,60,.3)'; for (const [x, y, r] of [[Lx + 260, 120, 70], [Rx - 360, 60, 90], [330, 220, 60]]){ c.beginPath(); c.ellipse(at(x), top + y * m, r * m, r * 0.6 * m, 0, 0, 6.2832); c.fill(); }
  /* its sign */
  c.fillStyle = '#2b2a45'; c.beginPath(); c.roundRect(at(-190), top - 75 * m, 380 * m, 64 * m, 12 * m); c.fill();
  c.font = `700 ${Math.max(6, Math.round(44 * m))}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e8b830'; c.fillText('DEPOT 7', X, top - 42 * m);
  /* the bay, door rolled up: dark inside, the empty pedestal glowing */
  const bw = 560, bh = 250, bx = -bw / 2, by = base - bh * m;
  c.fillStyle = '#121022'; c.fillRect(at(bx), by, bw * m, bh * m);
  const ig = c.createRadialGradient(X, base - 110 * m, 10 * m, X, base - 110 * m, 300 * m); ig.addColorStop(0, `rgba(95,243,255,${0.35 + 0.1 * Math.sin(t * 2)})`); ig.addColorStop(1, 'rgba(95,243,255,0)');
  c.fillStyle = ig; c.fillRect(at(bx), by, bw * m, bh * m);
  c.save(); c.beginPath(); c.rect(at(bx - 10), by - 34 * m, (bw + 20) * m, 34 * m); c.clip();
  c.fillStyle = '#e8b830'; c.fillRect(at(bx - 10), by - 34 * m, (bw + 20) * m, 34 * m);
  c.fillStyle = '#1d1f2b'; for (let k = -2; k < 24; k++){ c.beginPath(); c.moveTo(at(bx + k * 30), by); c.lineTo(at(bx + k * 30 + 15), by); c.lineTo(at(bx + k * 30 + 49), by - 34 * m); c.lineTo(at(bx + k * 30 + 34), by - 34 * m); c.fill(); }
  c.restore();
  c.fillStyle = '#3a3756'; c.beginPath(); c.roundRect(at(-50), base - 80 * m, 100 * m, 80 * m, 8 * m); c.fill();
  /* old robots slumped along the front */
  for (const x of [bx - 120, -bx + 120, Lx + 150, Rx - 150]){
    const u = 0.75 * m;
    c.save(); c.translate(at(x), base); c.rotate((x < 0 ? 1 : -1) * 0.3);
    const g = c.createRadialGradient(-20 * u, -70 * u, 2, 0, -50 * u, 70 * u); g.addColorStop(0, '#8a90a2'); g.addColorStop(1, '#2c3042');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, -50 * u, 50 * u, 56 * u, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#10132a'; c.beginPath(); c.ellipse(4 * u, -66 * u, 36 * u, 16 * u, 0, 0, 6.2832); c.fill();
    c.restore();
  }
  /* crates */
  for (const [x, n] of [[Lx + 290, 3], [Rx - 380, 2]]) for (let k = 0; k < n; k++){
    const cx = at(x + (k % 2) * 70), cy = base - (60 + Math.floor(k / 2) * 60) * m;
    c.fillStyle = '#7b5a3c'; c.fillRect(cx, cy, 64 * m, 60 * m); c.fillStyle = '#a07a52'; c.fillRect(cx, cy, 22 * m, 60 * m);
    c.strokeStyle = '#4a3422'; c.lineWidth = Math.max(1, 3 * m); c.strokeRect(cx, cy, 64 * m, 60 * m);
  }
  /* a crane over the roof */
  c.strokeStyle = '#e8b830'; c.lineWidth = Math.max(1, 14 * m); c.lineCap = 'butt';
  c.beginPath(); c.moveTo(at(Rx - 200), top - 40 * m); c.lineTo(at(Rx - 200), top - 260 * m); c.lineTo(at(80), top - 300 * m); c.stroke();
  c.strokeStyle = '#3a3756'; c.lineWidth = Math.max(1, 3 * m); c.beginPath(); c.moveTo(at(120), top - 296 * m); c.lineTo(at(120), top - 160 * m); c.stroke();
  c.fillStyle = '#3a3756'; c.fillRect(at(100), top - 165 * m, 40 * m, 26 * m);
}

/* The engine piece on the ground at depth rel: a glowing hex crystal in a
   metal cradle, a ring round it filling (charge 0..1) as the crew power
   it up. */
export function worldPiece(c, W, H, rel, t, charge){
  const p = P(0, rel, W, H), s = H * 0.09 * p.k, cy = p.y - s * 1.1, pulse = 0.5 + 0.5 * Math.sin(t * 5);
  c.fillStyle = 'rgba(20,15,45,.4)'; c.beginPath(); c.ellipse(p.x, p.y, s * 1.6, s * 0.35, 0, 0, 6.2832); c.fill();
  c.fillStyle = metal(c, p.x - s, p.x + s, '#9aa1b8', '#5a6078', '#2c3042'); c.beginPath(); c.roundRect(p.x - s * 0.9, p.y - s * 0.6, s * 1.8, s * 0.6, s * 0.12); c.fill();
  c.fillStyle = '#e8b830'; c.fillRect(p.x - s * 0.9, p.y - s * 0.6, s * 1.8, s * 0.1);
  glow(c, p.x, cy, s * (3 + charge * 2), '#5ff3ff', 0.6 + 0.3 * pulse);
  const hex = (r) => { c.beginPath(); for (let k = 0; k < 6; k++){ const a = k * Math.PI / 3 + t * 0.6; c.lineTo(p.x + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); };
  c.fillStyle = '#7ef6ff'; hex(s * 0.8); c.fill();
  c.fillStyle = '#e8fdff'; hex(s * 0.42); c.fill();
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = s * 0.18; c.beginPath(); c.arc(p.x, cy, s * 1.6, 0, 6.2832); c.stroke();
  if (charge > 0){ c.strokeStyle = '#7ef6ff'; c.beginPath(); c.arc(p.x, cy, s * 1.6, -Math.PI / 2, -Math.PI / 2 + charge * 6.2832); c.stroke(); }
}

/* ---------- the Sweeper ---------- */

/* Level 1's boss: a big clumsy street-sweeper robot, s tall, wheels at
   (x, base) - a chunky gunmetal bin, one big round cartoon eye, a beacon
   on top, brushes spinning underneath, a broom arm raised. st as
   drawScout: flash, tell 0..1 (crouching, eye blazing, beacon red), dash
   (leaning in, dust flying), dazed (lid popped, stars), panic (shaking,
   beacon going mad), off (dark, slumped). */
export function worldSweeper(c, x, base, s, t, st){
  const u = s / 300, crouch = (st.tell || 0) * 14 * u + (st.dazed || st.off ? 18 * u : 0);
  const P2 = (dx, dy) => [dx * u, dy * u];
  cast(c, x, base, 90 * u, 380 * u, 0.45);
  c.fillStyle = 'rgba(20,15,45,.4)'; c.beginPath(); c.ellipse(x, base, 170 * u, 30 * u, 0, 0, 6.2832); c.fill();
  c.save(); c.translate(x, base);
  if (st.panic && !st.off) c.translate(Math.sin(t * 40) * 3 * u, 0);
  if (st.dash) c.rotate(0.1);
  if (st.dazed || st.off) c.rotate(-0.08);
  const spin = t * (st.dash ? 16 : st.off ? 0 : 6);
  /* brushes spinning underneath, either side */
  for (const d of [-1, 1]){
    const [bx, by] = P2(d * 80, -22);
    c.fillStyle = st.off ? '#2c3a44' : '#3d5a6a'; c.beginPath(); c.ellipse(bx, by, 58 * u, 18 * u, 0, 0, 6.2832); c.fill();
    c.strokeStyle = '#7fb3c4'; c.lineWidth = 2.5 * u;
    c.beginPath();
    for (let k = 0; k < 16; k++){ const a = k / 16 * 6.2832 + spin * d; c.moveTo(bx + Math.cos(a) * 20 * u, by + Math.sin(a) * 6 * u); c.lineTo(bx + Math.cos(a) * 62 * u, by + Math.sin(a) * 20 * u); }
    c.stroke();
  }
  /* wheels */
  for (const d of [-1, 1]){ c.fillStyle = '#1d2030'; c.beginPath(); c.ellipse(d * 112 * u, -40 * u, 26 * u, 40 * u, 0, 0, 6.2832); c.fill(); c.fillStyle = '#4a4f6a'; c.beginPath(); c.ellipse((d * 112 - 4) * u, -42 * u, 10 * u, 16 * u, 0, 0, 6.2832); c.fill(); }
  c.translate(0, crouch);
  const fl = st.flash > 0.5;
  /* the body: a chunky rounded bin */
  c.fillStyle = fl ? '#ffffff' : st.off ? metal(c, -120 * u, 120 * u, '#6b7080', '#3d4152', '#1b1d28') : metal(c, -120 * u, 120 * u);
  c.beginPath(); c.roundRect(-110 * u, -250 * u, 220 * u, 215 * u, 46 * u); c.fill();
  c.fillStyle = 'rgba(232,184,48,.85)'; c.fillRect(-110 * u, -120 * u, 220 * u, 22 * u);
  c.strokeStyle = 'rgba(20,20,35,.4)'; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(-110 * u, -205 * u); c.lineTo(110 * u, -205 * u); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(60 * u, -70 * u, 20 * u, 10 * u, 0.3, 0, 6.2832); c.fill();
  /* the lid: a little crooked - popped right up when it's dazed */
  c.save(); c.translate(0, -252 * u);
  if (st.dazed || st.off){ c.translate(-60 * u, -30 * u); c.rotate(-0.45); } else c.rotate(-0.07 + (st.panic ? Math.sin(t * 25) * 0.05 : 0));
  c.fillStyle = '#5a6078'; c.beginPath(); c.roundRect(-120 * u, -16 * u, 240 * u, 24 * u, 10 * u); c.fill();
  c.fillStyle = '#9aa1b8'; c.beginPath(); c.roundRect(-120 * u, -16 * u, 120 * u, 8 * u, 4 * u); c.fill();
  c.restore();
  /* the beacon: orange, turning red as it's about to charge; still when off */
  c.fillStyle = '#3a3f58'; c.beginPath(); c.roundRect(-20 * u, -285 * u, 40 * u, 18 * u, 4 * u); c.fill();
  if (!st.off){
    const flashOn = st.panic ? Math.floor(t * 10) % 2 : 0.6 + 0.4 * Math.sin(t * 6);
    const bc = st.tell > 0 ? '#ff4d4d' : '#ffb34d';
    glow(c, 0, -292 * u, 70 * u, bc, 0.4 + 0.6 * flashOn);
    c.fillStyle = bc;
  } else c.fillStyle = '#5a4a3a';
  c.beginPath(); c.ellipse(0, -292 * u, 18 * u, 20 * u, 0, Math.PI, 6.2832); c.fill();
  /* the eye: a red screen with a wobbly pupil - bigger and blazing on a tell */
  const ex = -8 * u, ey = -165 * u;
  c.fillStyle = '#e9ecf4'; circ(c, ex, ey, 48 * u);
  c.fillStyle = '#10132a'; circ(c, ex, ey, 40 * u);
  if (st.off){ c.strokeStyle = '#3a3f58'; c.lineWidth = 5 * u; c.beginPath(); c.moveTo(ex - 22 * u, ey); c.lineTo(ex + 22 * u, ey); c.stroke(); }
  else if (st.dazed){
    c.strokeStyle = '#ff6b80'; c.lineWidth = 4 * u; c.beginPath();
    for (let a = 0; a < 12; a += 0.3){ const r = a * 2.6 * u; c.lineTo(ex + Math.cos(a + t * 6) * r, ey + Math.sin(a + t * 6) * r); }
    c.stroke();
  } else {
    const big = 20 + (st.tell || 0) * 8, wob = Math.sin(t * 3) * 3;
    glow(c, ex + 6 * u, ey + 5 * u, (60 + (st.tell || 0) * 50) * u, '#ff3b55', 0.7 + (st.tell || 0) * 0.3);
    c.fillStyle = '#ff4d63'; circ(c, ex + (6 + wob) * u, ey + 5 * u, big * u);
    c.fillStyle = '#ffffff'; circ(c, ex - 1 * u + wob * u, ey - 3 * u, 7 * u); circ(c, ex + 13 * u, ey + 11 * u, 3 * u);
  }
  /* a little digital eyebrow - grumpy rather than mean; down hard on a tell */
  if (!st.off){
    const tilt = (st.tell || 0) * 14;
    c.strokeStyle = '#ff6b80'; c.lineWidth = 6 * u; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-44 * u, (-222 - tilt * 0.3) * u); c.lineTo(24 * u, (-214 + tilt) * u); c.stroke();
  }
  /* the front: a scoop mouth and a hazard band */
  c.fillStyle = '#23263a'; c.beginPath(); c.moveTo(-95 * u, -78 * u); c.lineTo(95 * u, -78 * u); c.lineTo(110 * u, -38 * u); c.lineTo(-110 * u, -38 * u); c.closePath(); c.fill();
  c.fillStyle = '#e8b830'; c.fillRect(-96 * u, -78 * u, 192 * u, 8 * u);
  c.fillStyle = '#1d1f2b'; for (let k = 0; k < 12; k++) c.fillRect((-92 + k * 16) * u, -78 * u, 7 * u, 8 * u);
  /* the broom arm, raised high */
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#5a6078'; c.lineWidth = 16 * u; c.beginPath(); c.moveTo(105 * u, -190 * u); c.lineTo(185 * u, -260 * u); c.lineTo(250 * u, -210 * u); c.stroke();
  c.strokeStyle = '#a3aac0'; c.lineWidth = 5 * u; c.beginPath(); c.moveTo(105 * u, -196 * u); c.lineTo(183 * u, -266 * u); c.stroke();
  c.fillStyle = '#3a3f58'; circ(c, 185 * u, -260 * u, 13 * u);
  c.strokeStyle = '#8a6a3c'; c.lineWidth = 8 * u; c.beginPath(); c.moveTo(250 * u, -210 * u); c.lineTo(270 * u, -150 * u); c.stroke();
  c.fillStyle = '#e8b830'; c.beginPath(); c.moveTo(240 * u, -150 * u); c.lineTo(300 * u, -150 * u); c.lineTo(310 * u, -100 * u); c.lineTo(230 * u, -100 * u); c.closePath(); c.fill();
  c.strokeStyle = '#b8862a'; c.lineWidth = 2.5 * u; c.beginPath(); for (let k = 0; k < 7; k++){ c.moveTo((238 + k * 11) * u, -140 * u); c.lineTo((234 + k * 12.5) * u, -100 * u); } c.stroke();
  /* rim light from the sun */
  c.strokeStyle = 'rgba(255,225,195,.85)'; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(-110 * u, -60 * u); c.lineTo(-110 * u, -210 * u); c.quadraticCurveTo(-110 * u, -250 * u, -70 * u, -250 * u); c.stroke();
  c.restore();
  /* dust flying as it charges */
  if (st.dash || st.panic){
    const n = st.dash ? 8 : 3;
    for (let k = 0; k < n; k++){
      const a = (t * 1.5 + k / n) % 1, d = k % 2 ? 1 : -1;
      c.fillStyle = `rgba(230,220,240,${0.55 * (1 - a)})`; circ(c, x + d * (150 + a * 90) * u, base - (20 + a * 50) * u, (14 + a * 20) * u);
    }
  }
  /* stars, round its head, when it's dazed */
  if (st.dazed && !st.off) for (let k = 0; k < 4; k++){
    const a = t * 3 + k * 1.57, sx = x + Math.cos(a) * 90 * u, sy = base - 330 * u + Math.sin(a) * 18 * u;
    c.fillStyle = '#ffe066'; c.beginPath();
    for (let j = 0; j < 10; j++){ const r = (j % 2 ? 6 : 15) * u, b = j * Math.PI / 5 - Math.PI / 2; c.lineTo(sx + Math.cos(b) * r, sy + Math.sin(b) * r); }
    c.closePath(); c.fill();
  }
}

/* The Sweeper's broom swinging round at head height at depth rel: a long
   bristled bar right across, dust behind it. Duck under it. */
export function worldSweepBar(c, W, H, rel, t){
  const l = P(-PATH_HALF - 0.2, rel, W, H), r = P(PATH_HALF + 0.2, rel, W, H), k = l.k;
  const y = l.y - H * 0.28 * k, th = H * 0.03 * k;
  glow(c, (l.x + r.x) / 2, y, (r.x - l.x) * 0.35, '#ff5b3b', 0.5 + 0.2 * Math.sin(t * 20));
  for (let i = 0; i < 6; i++){ const a = (t * 2 + i / 6) % 1; c.fillStyle = `rgba(230,215,200,${0.35 * (1 - a)})`; circ(c, l.x + (r.x - l.x) * (i + 0.5) / 6, y + th * (1 + a * 2), th * (0.8 + a * 1.5)); }
  c.fillStyle = '#5a6078'; c.beginPath(); c.roundRect(l.x, y - th * 0.8, r.x - l.x, th * 0.5, th * 0.25); c.fill();
  c.fillStyle = '#e8b830'; c.fillRect(l.x, y - th * 0.35, r.x - l.x, th);
  c.strokeStyle = '#b8862a'; c.lineWidth = Math.max(1, th * 0.12); c.beginPath();
  for (let x = l.x; x < r.x; x += th * 0.5){ c.moveTo(x, y - th * 0.3); c.lineTo(x - th * 0.1, y + th * 0.65); }
  c.stroke();
  c.strokeStyle = 'rgba(255,80,60,.9)'; c.lineWidth = Math.max(1.5, th * 0.15); c.beginPath(); c.moveTo(l.x, y + th * 0.7); c.lineTo(r.x, y + th * 0.7); c.stroke();
}

/* ---------- the red-light room ---------- */

/* The red-light room's hall: a long gunmetal works hall seen from up high,
   light strips down the walls, panelled floor. Q as lkp-trap's. */
export function worldHall(c, W, H, Q, red, t){
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1d1b33'); g.addColorStop(0.4, red ? '#3a1e2e' : '#2b2a48'); g.addColorStop(1, '#14122a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const pt = (lane, along) => { const q = Q(lane, along, W, H); return [q.x, q.y]; };
  /* the side walls, rising off the floor's edges */
  for (const d of [-1, 1]){
    const a = pt(d * 1.1, -0.1), b = pt(d * 1.1, 1.15);
    const wg = c.createLinearGradient(a[0], 0, d < 0 ? 0 : W, 0); wg.addColorStop(0, '#3a3858'); wg.addColorStop(1, '#1a1830');
    c.fillStyle = wg; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0] + d * W * 0.05, 0); c.lineTo(d < 0 ? 0 : W, 0); c.lineTo(d < 0 ? 0 : W, a[1]); c.closePath(); c.fill();
    /* light strips down the wall */
    for (let k = 0; k < 7; k++){
      const u = k / 7, p0 = pt(d * 1.1, u), p1 = pt(d * 1.1, u + 0.06), hgt = (p0[1] - p1[1]) * 0 + H * 0.25 * Q(0, u, W, H).k;
      c.fillStyle = red ? 'rgba(255,90,90,.55)' : 'rgba(126,246,255,.45)';
      c.beginPath(); c.moveTo(p0[0] + d * 6, p0[1] - hgt); c.lineTo(p1[0] + d * 6, p1[1] - hgt * 0.95); c.lineTo(p1[0] + d * 6, p1[1] - hgt * 0.9); c.lineTo(p0[0] + d * 6, p0[1] - hgt * 0.94); c.closePath(); c.fill();
    }
  }
  /* the floor: panels, each lit a little from the far end */
  const fg = c.createLinearGradient(0, Q(0, 1.15, W, H).y, 0, H);
  fg.addColorStop(0, red ? '#4a2a38' : '#45446a'); fg.addColorStop(1, red ? '#2a1620' : '#24233e');
  c.fillStyle = fg; c.beginPath(); c.moveTo(...pt(-1.1, -0.1)); c.lineTo(...pt(1.1, -0.1)); c.lineTo(...pt(1.1, 1.15)); c.lineTo(...pt(-1.1, 1.15)); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 2;
  for (let k = 1; k < 16; k++){ c.beginPath(); c.moveTo(...pt(-1.1, k / 16)); c.lineTo(...pt(1.1, k / 16)); c.stroke(); }
  for (const lane of [-0.55, 0, 0.55]){ c.beginPath(); c.moveTo(...pt(lane, -0.1)); c.lineTo(...pt(lane, 1.15)); c.stroke(); }
  c.strokeStyle = 'rgba(232,184,48,.7)'; c.lineWidth = H * 0.008;
  for (const d of [-1, 1]){ c.beginPath(); c.moveTo(...pt(d * 1.08, -0.1)); c.lineTo(...pt(d * 1.08, 1.15)); c.stroke(); }
}

/* The sleeping robot at the end of the hall: a great gunmetal dome, one
   eye - shut and snoring on green, flickering on yellow, wide open and red
   on red, its gaze washing down the hall. Its lamp on top in the light's
   colour. */
export function worldSleeper(c, X, Y, s, light, awake, t, lamp){
  const u = s / 170;
  c.fillStyle = 'rgba(10,8,25,.5)'; c.beginPath(); c.ellipse(X, Y, 260 * u, 40 * u, 0, 0, 6.2832); c.fill();
  const twitch = light === 'yellow' ? Math.sin(t * 30) * 4 * u : 0;
  const g = c.createRadialGradient(X - 70 * u, Y - 240 * u, 10 * u, X, Y - 160 * u, 260 * u); g.addColorStop(0, '#c4c9d6'); g.addColorStop(0.5, '#6a7186'); g.addColorStop(1, '#23273a');
  c.fillStyle = g; c.beginPath(); c.ellipse(X, Y - 10 * u, 240 * u, 200 * u, 0, Math.PI, 6.2832); c.lineTo(X + 240 * u, Y); c.lineTo(X - 240 * u, Y); c.fill();
  c.strokeStyle = 'rgba(255,225,195,.6)'; c.lineWidth = 3 * u; c.beginPath(); c.ellipse(X, Y - 10 * u, 239 * u, 199 * u, 0, Math.PI * 1.05, Math.PI * 1.45); c.stroke();
  c.fillStyle = '#e8b830'; c.fillRect(X - 240 * u, Y - 40 * u, 480 * u, 14 * u);
  /* brushes either side */
  for (const d of [-1, 1]){ c.fillStyle = '#3d5a6a'; c.beginPath(); c.ellipse(X + d * 250 * u, Y - 10 * u, 60 * u, 18 * u, 0, 0, 6.2832); c.fill(); }
  /* the eye */
  const ex = X + twitch, ey = Y - 120 * u;
  c.fillStyle = '#0d0f1c'; c.beginPath(); c.ellipse(ex, ey, 90 * u, 50 * u, 0, 0, 6.2832); c.fill();
  if (light === 'red'){
    glow(c, ex, ey, 200 * u, '#ff3b55', 0.9);
    c.fillStyle = '#ff3b55'; c.beginPath(); c.ellipse(ex, ey + 4 * u, 50 * u, 30 * u, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#ffffff'; circ(c, ex - 14 * u, ey - 6 * u, 9 * u);
  } else if (light === 'yellow'){
    if (Math.floor(t * 12) % 2){ glow(c, ex, ey, 110 * u, '#ffc531', 0.6); c.fillStyle = '#ffc531'; c.beginPath(); c.ellipse(ex, ey + 4 * u, 50 * u, 10 * u, 0, 0, 6.2832); c.fill(); }
  } else {
    c.strokeStyle = awake ? '#3b5c7a' : '#7a8396'; c.lineWidth = 7 * u; c.lineCap = 'round';
    c.beginPath(); c.moveTo(ex - 50 * u, ey); c.quadraticCurveTo(ex, ey + 22 * u, ex + 50 * u, ey); c.stroke();
  }
  c.strokeStyle = '#2c3042'; c.lineWidth = 10 * u; c.beginPath(); c.ellipse(ex, ey, 90 * u, 50 * u, 0, 0, 6.2832); c.stroke();
  /* its lamp */
  c.fillStyle = '#3a3f58'; c.beginPath(); c.roundRect(X - 30 * u, Y - 228 * u, 60 * u, 22 * u, 5 * u); c.fill();
  glow(c, X, Y - 250 * u, 120 * u, lamp, 0.9);
  c.fillStyle = lamp; c.beginPath(); c.ellipse(X, Y - 228 * u, 34 * u, 40 * u, 0, Math.PI, 6.2832); c.fill();
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(X - 12 * u, Y - 248 * u, 8 * u, 12 * u, -0.4, 0, 6.2832); c.fill();
}

/* ---------- the treasure cave ---------- */

/* The treasure room: a crystal cave, purple and teal crystals glowing in
   the dark. */
export function worldVault(c, W, H, t){
  const g = c.createRadialGradient(W / 2, H * 0.45, H * 0.05, W / 2, H * 0.5, W * 0.75);
  g.addColorStop(0, '#6b5a8a'); g.addColorStop(0.6, '#2e2850'); g.addColorStop(1, '#14122a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let k = 0; k < 26; k++){
    const x = hash(k + 700) * W, y = hash(k + 701) * H * 0.8, h = H * (0.04 + hash(k + 702) * 0.11), col = hash(k + 703) < 0.5 ? '#78f0e6' : '#c896ff';
    const tw = 0.4 + 0.2 * Math.sin(t * 1.5 + k);
    glow(c, x, y + h * 0.6, h * 0.9, col, tw);
    c.fillStyle = rgba(col, 0.55); c.beginPath(); c.moveTo(x, y); c.lineTo(x + h * 0.25, y + h); c.lineTo(x - h * 0.25, y + h); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x - h * 0.25, y + h); c.lineTo(x - h * 0.05, y + h); c.closePath(); c.fill();
  }
  c.fillStyle = '#1b1830'; c.fillRect(0, H * 0.9, W, H * 0.1);
}

/* Their suits, standing where the players stand and copying them: an
   off-white spacesuit drawn over each body's landmarks (lm, 0..1), trim in
   their colour, a glass helmet with their face in it (face(x, y, r)). */
export function worldSuit(c, lm, W, H, col, face){
  const at = (i) => [lm[i].x * W, lm[i].y * H];
  const seen = (i) => (lm[i].v ?? 1) > 0.3;
  const [lsx, lsy] = at(LM.L_SHOULDER), [rsx, rsy] = at(LM.R_SHOULDER);
  const sw = Math.hypot(lsx - rsx, lsy - rsy);
  if (sw < 4) return;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const suit = '#ece4d4', shade = '#b9ae99', trim = col;
  const limb = (a, b, d, w, end) => {
    if (!seen(a) || !seen(b)) return;
    const pts = [at(a), at(b)]; if (seen(d)) pts.push(at(d));
    c.strokeStyle = shade; c.lineWidth = w * 1.12; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(...q) : c.moveTo(...q))); c.stroke();
    c.strokeStyle = suit; c.lineWidth = w; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0] - w * 0.08, q[1]) : c.moveTo(q[0] - w * 0.08, q[1]))); c.stroke();
    /* a trim band at the elbow or knee */
    c.fillStyle = trim; circ(c, pts[1][0], pts[1][1], w * 0.42);
    if (pts[2]){ c.fillStyle = end; circ(c, pts[2][0], pts[2][1], w * 0.62); }
  };
  /* legs, then the body, then arms in front */
  limb(LM.L_HIP, LM.L_KNEE, LM.L_ANKLE, sw * 0.4, '#5a6078');
  limb(LM.R_HIP, LM.R_KNEE, LM.R_ANKLE, sw * 0.4, '#5a6078');
  const torso = [LM.L_SHOULDER, LM.R_SHOULDER, LM.R_HIP, LM.L_HIP].map(at);
  const tg = c.createLinearGradient(Math.min(lsx, rsx), 0, Math.max(lsx, rsx), 0); tg.addColorStop(0, '#f6ecd9'); tg.addColorStop(1, shade);
  c.fillStyle = tg; c.strokeStyle = tg; c.lineWidth = sw * 0.22;
  c.beginPath(); torso.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.stroke();
  /* chest stripe and badge in their colour */
  const mx = (lsx + rsx) / 2, my = (lsy + rsy) / 2, hy = (torso[2][1] + torso[3][1]) / 2;
  c.strokeStyle = trim; c.lineWidth = sw * 0.12; c.beginPath(); c.moveTo(lsx, lsy + (hy - my) * 0.3); c.lineTo(rsx, rsy + (hy - my) * 0.3); c.stroke();
  c.fillStyle = '#3a3f58'; c.beginPath(); c.roundRect(mx - sw * 0.16, my + (hy - my) * 0.45, sw * 0.32, sw * 0.22, sw * 0.05); c.fill();
  c.fillStyle = trim; circ(c, mx - sw * 0.06, my + (hy - my) * 0.45 + sw * 0.11, sw * 0.04);
  limb(LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST, sw * 0.32, '#f6ecd9');
  limb(LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST, sw * 0.32, '#f6ecd9');
  /* the helmet: a glass bubble, their face inside */
  if (seen(LM.NOSE)){
    const [nx, ny] = at(LM.NOSE), r = sw * 0.5, hx = nx, hy2 = ny - sw * 0.05;
    c.fillStyle = '#d8cfbd'; c.beginPath(); c.ellipse(mx, my - sw * 0.02, sw * 0.38, sw * 0.13, 0, 0, 6.2832); c.fill();
    c.fillStyle = trim; c.fillRect(mx - sw * 0.3, my - sw * 0.06, sw * 0.6, sw * 0.06);
    c.fillStyle = 'rgba(20,30,60,.55)'; circ(c, hx, hy2, r);
    if (face){ c.save(); c.beginPath(); c.arc(hx, hy2, r * 0.94, 0, 6.2832); c.clip(); face(hx, hy2 + r * 0.05, r * 0.72); c.restore(); }
    const gl = c.createRadialGradient(hx - r * 0.4, hy2 - r * 0.45, r * 0.05, hx, hy2, r);
    gl.addColorStop(0, 'rgba(255,255,255,.5)'); gl.addColorStop(0.35, 'rgba(255,255,255,.06)'); gl.addColorStop(1, 'rgba(140,220,255,.28)');
    c.fillStyle = gl; circ(c, hx, hy2, r);
    c.strokeStyle = '#ece4d4'; c.lineWidth = sw * 0.07; c.beginPath(); c.arc(hx, hy2, r, 0, 6.2832); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = sw * 0.035; c.beginPath(); c.arc(hx, hy2, r * 0.78, Math.PI * 1.1, Math.PI * 1.4); c.stroke();
  }
  c.restore();
}

/* The healing water rising round them (wet 0..1), glowing, bubbles going up. */
export function worldPool(c, W, H, wet, t){
  const top = H * (0.95 - 0.22 * wet);
  const wave = (x) => top + Math.sin(x / W * 12 + t * 3) * H * 0.01;
  const wg = c.createLinearGradient(0, top, 0, H); wg.addColorStop(0, 'rgba(110,235,255,.55)'); wg.addColorStop(1, 'rgba(20,120,160,.8)');
  c.fillStyle = wg; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += W / 32) c.lineTo(x, wave(x));
  c.lineTo(W, H); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(220,255,255,.8)'; c.lineWidth = Math.max(2, H * 0.004); c.beginPath();
  for (let x = 0; x <= W; x += W / 32) (x ? c.lineTo(x, wave(x)) : c.moveTo(x, wave(x))); c.stroke();
  c.fillStyle = 'rgba(220,255,255,.8)';
  for (let k = 0; k < 30; k++){ const a = (t * 0.4 + hash(k + 800)) % 1; circ(c, hash(k + 801) * W, top + (H - top) * 0.6 - a * H * 0.4, H * (0.002 + hash(k + 802) * 0.004) * wet); }
}
