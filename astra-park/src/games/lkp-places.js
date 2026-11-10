/* Last Known Position, the look - the places and the boss: the fork in
   the path, the depot (a whole works yard), the Star Core, the red-light
   room, the treasure cave with its suits copying the players, and Level
   1's boss, the Sweeper. Drawn when the level's palette has a `world`
   (lkp-art.js hands over to these); L is that world palette. */
import { P, RUN, HORIZON, sign } from './lkp-art.js';
import { mix, rgba, glow, cast, tree, PATH_HALF, treeKind, kindOf } from './lkp-world.js';
import { drawZubuWall, zubuWallSnore, WALL_EYES } from './lkp-zubu.js';

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
  /* The signs, floating over each way - the one with more votes now
     bigger and brighter, the other dimmed, so it's plain which way the
     crew are going. */
  const n0 = (votes && votes[0] || []).length, n1 = (votes && votes[1] || []).length;
  const lead = open != null ? open : n0 > n1 ? 0 : n1 > n0 ? 1 : null;
  [-0.72, 0.72].forEach((lane, i) => {
    const [col, mark] = LOOK[kinds[i]] || LOOK.mystery, on = lead === i, pulse = on ? 1 + 0.04 * Math.sin(t * 6) : 1;
    const p = P(lane, rel, W, H), R = H * 0.11 * p.k * (open === i ? 1 + 0.35 * opening : on ? 1.18 * pulse : lead != null ? 0.9 : 1);
    const y = p.y - H * 0.34 * p.k - R + Math.sin(t * 2 + i * 2) * R * 0.08;
    c.save();
    if (open != null && open !== i) c.globalAlpha = Math.max(0, 1 - opening * 1.5);
    else if (lead != null && !on) c.globalAlpha = 0.55;
    /* a beam of light down to the path, and its glow on the ground */
    const bg = c.createLinearGradient(0, y, 0, p.y); bg.addColorStop(0, rgba(col, 0.4)); bg.addColorStop(1, rgba(col, 0));
    c.fillStyle = bg; c.beginPath(); c.moveTo(p.x - R * 0.3, y); c.lineTo(p.x + R * 0.3, y); c.lineTo(p.x + R * 0.95, p.y); c.lineTo(p.x - R * 0.95, p.y); c.closePath(); c.fill();
    c.fillStyle = rgba(col, 0.3); c.beginPath(); c.ellipse(p.x, p.y, R * 1.1, R * 0.25, 0, 0, 6.2832); c.fill();
    glow(c, p.x, y, R * (on ? 3 : 2.4), col, on ? 1 : 0.9);
    c.fillStyle = 'rgba(20,15,45,.6)'; circ(c, p.x, y, R);
    c.strokeStyle = on ? '#ffffff' : col; c.lineWidth = Math.max(2, R * (on ? 0.11 : 0.07)); c.beginPath(); c.arc(p.x, y, R, 0, 6.2832); c.stroke();
    if (mark === 'skull') skull(c, p.x, y, R);
    else if (mark === 'mystery'){
      c.font = `700 ${Math.round(R * 1.55)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#efe3ff'; c.fillText('?', p.x, y + R * 0.08);
    } else sign(c, mark, p.x, y, R * 0.7, col);
    /* the votes: a dot in each voter's colour, just under the sign */
    const vs = (votes && votes[i]) || [];
    vs.forEach((vc, n) => {
      const vr = Math.max(R * 0.22, H * 0.012), vx = p.x + (n - (vs.length - 1) / 2) * vr * 2.6, vy = y + R + vr * 1.8;
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

/* The Star Core - the ship's power, knocked out in the crash - on the ground at depth rel: a glowing hex crystal in a
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

/* A forest glade, from up high (the sneak past the sleeping giant, lkp-
   trap.js): the sky and the hills at the top, woods down both sides, a
   soft grass floor with a trodden path up the middle. Q: the glade's own
   view, as worldHall. When it's looking (red), a red tint. */
/* (clearLeft: no trees on the near left - where Zubu lies asleep) */
export function worldGlade(c, W, H, Q, red, t, L, { clearLeft = false } = {}){
  const pt = (lane, along) => { const q = Q(lane, along, W, H); return [q.x, q.y]; };
  const far = Q(0, 1.15, W, H).y;
  const sky = c.createLinearGradient(0, 0, 0, far);
  sky.addColorStop(0, L.sky[0]); sky.addColorStop(0.7, L.sky[2]); sky.addColorStop(1, L.haze);
  c.fillStyle = sky; c.fillRect(0, 0, W, far + 2);
  /* hills, far off */
  c.fillStyle = mix(L.hillDark, L.haze, 0.4);
  c.beginPath(); c.moveTo(0, far); for (let k = 0; k <= 12; k++) c.lineTo(W * k / 12, far - H * (0.05 + 0.04 * Math.sin(k * 1.7) + 0.02 * Math.sin(k * 3.1))); c.lineTo(W, far); c.closePath(); c.fill();
  /* the ground */
  const fg = c.createLinearGradient(0, far, 0, H);
  fg.addColorStop(0, mix(L.ground[0], L.haze, 0.3)); fg.addColorStop(1, L.ground[2]);
  c.fillStyle = fg; c.fillRect(0, far, W, H - far);
  /* the trodden path up the middle */
  c.fillStyle = rgba(L.path[0], 0.55); c.beginPath(); c.moveTo(...pt(-0.75, -0.1)); c.lineTo(...pt(0.75, -0.1)); c.lineTo(...pt(0.55, 1.15)); c.lineTo(...pt(-0.55, 1.15)); c.closePath(); c.fill();
  /* grass tufts, scattered */
  c.strokeStyle = rgba(L.grass[1], 0.7);
  for (let k = 0; k < 90; k++){
    const lane = Math.sin(k * 12.9898) * 1.3, along = ((k * 0.6180339) % 1) * 1.1 - 0.05, q = Q(lane, along, W, H), h = H * 0.02 * q.k;
    c.lineWidth = Math.max(1, H * 0.002 * q.k); c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - h * 0.3, q.y - h); c.moveTo(q.x, q.y); c.lineTo(q.x + h * 0.3, q.y - h); c.stroke();
  }
  /* the woods down both sides, far ones first */
  for (let k = 9; k >= 0; k--) for (const d of [-1, 1]){
    const along = k / 9 * 1.15 - 0.05, q = Q(d * (1.25 + 0.2 * Math.sin(k * 2.3 + d)), along, W, H), s = H * 0.5 * q.k;
    if (clearLeft && d < 0 && along < 1) continue;
    c.fillStyle = 'rgba(20,15,45,.3)'; c.beginPath(); c.ellipse(q.x, q.y, s * 0.25, s * 0.05, 0, 0, 6.2832); c.fill();
    c.fillStyle = L.trunk[0]; c.fillRect(q.x - s * 0.03, q.y - s * 0.35, s * 0.06, s * 0.35);
    for (const [w, top, bot] of [[0.32, -1, -0.3], [0.25, -1.2, -0.6], [0.17, -1.35, -0.9]]){
      c.fillStyle = mix(L.tree[0], L.haze, along * 0.4); c.beginPath(); c.moveTo(q.x, q.y + top * s); c.lineTo(q.x - w * s, q.y + bot * s); c.lineTo(q.x + w * s, q.y + bot * s); c.fill();
      c.fillStyle = mix(L.tree[1], L.haze, along * 0.4); c.beginPath(); c.moveTo(q.x, q.y + top * s); c.lineTo(q.x + w * s, q.y + bot * s); c.lineTo(q.x, q.y + bot * s); c.fill();
    }
  }
  if (red){ c.fillStyle = 'rgba(255,60,60,.08)'; c.fillRect(0, 0, W, H); }
}

/* The glade, side on (lkp-trap.js QS): the sky, hills far off, Zubu
   asleep - a great wall of her behind (lkp-zubu.js) - a row of trees of
   all kinds in front of her, the meadow, and the trodden path running
   across the bottom, left to right. Nothing in front of her face. */
export function worldGladeSide(c, W, H, red, t, L, light = 'green'){
  const back = H * 0.42;
  const sky = c.createLinearGradient(0, 0, 0, back);
  sky.addColorStop(0, L.sky[0]); sky.addColorStop(0.7, L.sky[2]); sky.addColorStop(1, L.haze);
  c.fillStyle = sky; c.fillRect(0, 0, W, back + 2);
  c.fillStyle = mix(L.hillDark, L.haze, 0.45);
  c.beginPath(); c.moveTo(0, back); for (let k = 0; k <= 14; k++) c.lineTo(W * k / 14, back - H * (0.08 + 0.05 * Math.sin(k * 1.3) + 0.03 * Math.sin(k * 2.9))); c.lineTo(W, back); c.closePath(); c.fill();
  /* her */
  drawZubuWall(c, W, H, light, t);
  /* the meadow, from her middle down */
  const top = H * 0.72, fg = c.createLinearGradient(0, top, 0, H);
  fg.addColorStop(0, mix(L.ground[0], L.haze, 0.15)); fg.addColorStop(1, L.ground[2]);
  c.fillStyle = fg; c.beginPath(); c.moveTo(0, top); for (let k = 0; k <= 12; k++) c.lineTo(W * k / 12, top + H * 0.01 * Math.sin(k * 2.1)); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
  /* in front of her, tall and thick - she shows only in the gaps and over
     the tops (you can tell how big she is, but not see her all) - except
     round her eyes, always clear. Kept calm: just a few kinds - tall
     umbrella trees and pines at the back, a great mossy mound with
     boulders, round trees, low bushes in front. */
  const W0 = WALL_EYES.x0 * W, W1 = WALL_EYES.x1 * W, clear = (x) => x > W0 - W * 0.05 && x < W1 + W * 0.05;
  const plant = (u, y, sz, kind, hz, n) => { const x = W * (u + (hash(n + 7) - 0.5) * 0.012); if (!clear(x)) treeKind(c, x, y, H * sz * (0.85 + 0.3 * hash(n)), kind, L, hz, n); };
  [0.01, 0.07, 0.41, 0.48, 0.56, 0.63, 0.71, 0.79, 0.87, 0.95].forEach((u, k) => plant(u, top - H * 0.005, 0.00102, k % 3 === 1 ? 'pine' : 'umbrella', 0.3, 40 + k));
  /* the mound: a long grassy hump, mossy boulders on it */
  const mx0 = W * 0.5, mx1 = W * 1.05, my = top + H * 0.06, mh = H * 0.24;
  const mg = c.createLinearGradient(0, my - mh, 0, my); mg.addColorStop(0, mix(L.ground[0], '#cfe8b0', 0.25)); mg.addColorStop(1, L.ground[1]);
  c.fillStyle = mg; c.beginPath(); c.moveTo(mx0, my); c.bezierCurveTo(mx0 + W * 0.08, my - mh * 1.05, mx1 - W * 0.22, my - mh * 1.1, mx1, my - mh * 0.75); c.lineTo(mx1, my); c.closePath(); c.fill();
  c.strokeStyle = rgba(L.grass[1], 0.5); c.lineWidth = Math.max(1, H * 0.003); c.stroke();
  for (const [u, v, r] of [[0.66, 0.2, 0.075], [0.6, 0.12, 0.05], [0.84, 0.21, 0.065]]){
    const bx = W * u, by = my - H * v, br = H * r;
    c.fillStyle = 'rgba(20,30,30,.25)'; c.beginPath(); c.ellipse(bx, by + br * 0.7, br * 1.1, br * 0.25, 0, 0, 6.2832); c.fill();
    const bg = c.createRadialGradient(bx - br * 0.3, by - br * 0.4, br * 0.1, bx, by, br * 1.1); bg.addColorStop(0, '#b8b4c8'); bg.addColorStop(1, '#6e6a88');
    c.fillStyle = bg; c.beginPath(); c.ellipse(bx, by, br * 1.15, br * 0.85, 0, 0, 6.2832); c.fill();
    c.fillStyle = mix(L.grass[0], '#7ec06e', 0.4); c.beginPath(); c.ellipse(bx - br * 0.1, by - br * 0.6, br * 0.8, br * 0.3, -0.1, 0, 6.2832); c.fill();
  }
  [0.04, 0.38, 0.45].forEach((u, k) => plant(u, top + H * 0.03, 0.00085, 'round', 0.15, 60 + k));
  [0.0, 0.1, 0.18, 0.26, 0.33, 0.42, 0.52, 0.62, 0.74, 0.86, 0.96].forEach((u, k) => { const x = W * u; treeKind(c, x, top + H * 0.065, H * 0.0007 * (0.85 + 0.3 * hash(80 + k)), 'bush', L, 0.05, 80 + k); });
  zubuWallSnore(c, W, H, light, t);
  /* the trodden path, across the bottom */
  c.fillStyle = rgba(L.path[0], 0.6);
  c.beginPath(); c.moveTo(0, H * 0.82); for (let k = 0; k <= 10; k++) c.lineTo(W * k / 10, H * (0.82 + 0.006 * Math.sin(k * 1.9))); c.lineTo(W, H * 0.96); for (let k = 10; k >= 0; k--) c.lineTo(W * k / 10, H * (0.96 + 0.006 * Math.sin(k * 2.3))); c.closePath(); c.fill();
  /* grass tufts, not on the path */
  c.strokeStyle = rgba(L.grass[1], 0.7);
  for (let k = 0; k < 90; k++){
    const x = W * ((k * 0.6180339) % 1), y = top + (H - top) * ((k * 0.381966 * 3.1) % 1), h = H * 0.014;
    if (y > H * 0.8 && y < H * 0.97) continue;
    c.lineWidth = Math.max(1, H * 0.002); c.beginPath(); c.moveTo(x, y); c.lineTo(x - h * 0.3, y - h); c.moveTo(x, y); c.lineTo(x + h * 0.3, y - h); c.stroke();
  }
  if (red){ c.fillStyle = 'rgba(255,60,60,.08)'; c.fillRect(0, 0, W, H); }
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

/* The treasure room: plain and calm - deep violet, a soft light in the
   middle, a floor - so the crystals and the crew stand out. */
export function worldVault(c, W, H, t){
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1d1838'); g.addColorStop(0.75, '#3a2f63'); g.addColorStop(1, '#2a2348');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  glow(c, W / 2, H * 0.5, H * 0.75, '#8f7cff', 0.25 + 0.03 * Math.sin(t * 0.8));
  c.fillStyle = '#16122b'; c.fillRect(0, H * 0.93, W, H * 0.07);
  c.fillStyle = 'rgba(160,140,255,.25)'; c.fillRect(0, H * 0.93, W, H * 0.004);
}

/* A comically long stretchy spacesuit arm, from the shoulder (sx, sy) all
   the way to the hand (hx, hy): a padded tube sagging a little, rings of
   their colour along it, a glove on the end. u: the suit's scale. */
export function stretchArm(c, sx, sy, hx, hy, u, col, side){
  const dx = hx - sx, dy = hy - sy, len = Math.hypot(dx, dy) || 1;
  const mx = (sx + hx) / 2 - dy / len * len * 0.1 * side, my = (sy + hy) / 2 + dx / len * len * 0.1 * side;
  const at = (k) => [(1 - k) * (1 - k) * sx + 2 * (1 - k) * k * mx + k * k * hx, (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * my + k * k * hy];
  c.save(); c.lineCap = 'round';
  for (const [w, sc] of [[52, '#5a5040'], [40, '#ede1c8']]){
    c.strokeStyle = sc; c.lineWidth = w * u;
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, hx, hy); c.stroke();
  }
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 8 * u;
  c.beginPath(); c.moveTo(sx - 10 * u, sy); c.quadraticCurveTo(mx - 10 * u, my, hx - 10 * u, hy); c.stroke();
  const rings = Math.max(2, Math.floor(len / (70 * u)));
  c.strokeStyle = col; c.lineWidth = 9 * u;
  for (let k = 1; k < rings; k++){
    const [x0, y0] = at(k / rings - 0.01), [x1, y1] = at(k / rings + 0.01), a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
    const [x, y] = at(k / rings);
    c.beginPath(); c.moveTo(x - Math.cos(a) * 21 * u, y - Math.sin(a) * 21 * u); c.lineTo(x + Math.cos(a) * 21 * u, y + Math.sin(a) * 21 * u); c.stroke();
  }
  c.fillStyle = '#4b5070'; circ(c, hx, hy, 30 * u);
  c.fillStyle = col; circ(c, hx, hy, 14 * u);
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

/* ---------- the crash site ---------- */

/* The ship, down: in one piece but toppled on its side, at depth rel off
   to one side of the path - a long rounded hull, its nose cone, a cracked
   cockpit window, one fin bent, a hull panel hanging, scorch marks, and
   smoke pouring from its engines. s scales it. */
export function worldShip(c, W, H, rel, lane, t, s = 1){
  const p = P(lane, rel, W, H), u = H * 0.0011 * p.k * s;
  if (p.x < -1400 * u || p.x > W + 1400 * u) return;
  cast(c, p.x - 200 * u, p.y, 120 * u, 1500 * u, 0.4);
  c.fillStyle = 'rgba(20,15,45,.4)'; c.beginPath(); c.ellipse(p.x, p.y, 760 * u, 70 * u, 0, 0, 6.2832); c.fill();
  /* a furrow ploughed behind it */
  c.fillStyle = 'rgba(60,45,70,.45)'; c.beginPath(); c.ellipse(p.x + 620 * u, p.y + 10 * u, 340 * u, 34 * u, 0.05, 0, 6.2832); c.fill();
  c.save(); c.translate(p.x, p.y - 150 * u); c.rotate(-0.12);
  /* the far fin, sticking up, bent */
  c.fillStyle = '#5c6378'; c.beginPath(); c.moveTo(380 * u, -90 * u); c.lineTo(520 * u, -330 * u); c.lineTo(600 * u, -300 * u); c.lineTo(560 * u, -80 * u); c.closePath(); c.fill();
  /* the hull */
  const hg = c.createLinearGradient(0, -170 * u, 0, 170 * u);
  hg.addColorStop(0, '#e9ecf4'); hg.addColorStop(0.45, '#aab0c2'); hg.addColorStop(1, '#4a5068');
  c.fillStyle = hg; c.beginPath();
  c.moveTo(-560 * u, -150 * u); c.lineTo(520 * u, -165 * u); c.quadraticCurveTo(640 * u, -150 * u, 650 * u, 0); c.quadraticCurveTo(640 * u, 150 * u, 520 * u, 165 * u);
  c.lineTo(-560 * u, 150 * u); c.quadraticCurveTo(-820 * u, 120 * u, -880 * u, 0); c.quadraticCurveTo(-820 * u, -120 * u, -560 * u, -150 * u); c.closePath(); c.fill();
  /* panel lines and the stripe */
  c.strokeStyle = 'rgba(30,30,50,.3)'; c.lineWidth = 4 * u; c.beginPath();
  for (const x of [-420, -180, 60, 300]){ c.moveTo(x * u, -158 * u); c.lineTo(x * u, 158 * u); }
  c.stroke();
  c.fillStyle = '#e8b830'; c.fillRect(-560 * u, 40 * u, 1080 * u, 26 * u);
  c.fillStyle = '#3fa6ff'; c.fillRect(-560 * u, 70 * u, 1080 * u, 10 * u);
  /* the cockpit window, cracked */
  c.fillStyle = '#1b2440'; c.beginPath(); c.ellipse(-700 * u, -40 * u, 120 * u, 70 * u, -0.15, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(140,220,255,.35)'; c.beginPath(); c.ellipse(-730 * u, -62 * u, 60 * u, 22 * u, -0.3, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(230,245,255,.85)'; c.lineWidth = 3 * u; c.beginPath();
  c.moveTo(-660 * u, -70 * u); c.lineTo(-690 * u, -30 * u); c.lineTo(-650 * u, 0); c.moveTo(-690 * u, -30 * u); c.lineTo(-740 * u, -20 * u); c.lineTo(-770 * u, 10 * u); c.moveTo(-690 * u, -30 * u); c.lineTo(-720 * u, -80 * u);
  c.stroke();
  /* the hatch, jammed - a glow round its edge */
  c.strokeStyle = '#2c3042'; c.lineWidth = 6 * u; c.beginPath(); c.roundRect(-380 * u, -110 * u, 150 * u, 200 * u, 30 * u); c.stroke();
  glow(c, -305 * u, -10 * u, 70 * u, '#ff6b5b', 0.4 + 0.3 * Math.sin(t * 4));
  c.fillStyle = '#ff6b5b'; c.beginPath(); c.arc(-250 * u, -80 * u, 8 * u, 0, 6.2832); c.fill();
  /* dents and scorch */
  c.fillStyle = 'rgba(30,25,40,.45)';
  for (const [x, y, r] of [[120, -60, 90], [-80, 90, 60], [420, 60, 70]]){ c.beginPath(); c.ellipse(x * u, y * u, r * u, r * 0.55 * u, 0.3, 0, 6.2832); c.fill(); }
  c.strokeStyle = 'rgba(30,30,50,.5)'; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(80 * u, -110 * u); c.quadraticCurveTo(140 * u, -60 * u, 110 * u, -10 * u); c.stroke();
  /* a hull panel hanging loose */
  c.save(); c.translate(200 * u, 150 * u); c.rotate(0.5 + Math.sin(t * 1.5) * 0.04);
  c.fillStyle = '#8a90a6'; c.fillRect(0, 0, 120 * u, 60 * u); c.restore();
  /* the near fin, crumpled under it */
  c.fillStyle = '#7a8198'; c.beginPath(); c.moveTo(400 * u, 150 * u); c.lineTo(560 * u, 260 * u); c.lineTo(620 * u, 220 * u); c.lineTo(560 * u, 140 * u); c.closePath(); c.fill();
  /* the engines at the back, scorched, flickering */
  for (const y of [-70, 70]){
    c.fillStyle = '#2c3042'; c.beginPath(); c.ellipse(650 * u, y * u, 40 * u, 55 * u, 0, 0, 6.2832); c.fill();
    glow(c, 670 * u, y * u, 90 * u, '#ff9a3d', 0.4 + 0.35 * Math.abs(Math.sin(t * 9 + y)));
  }
  c.strokeStyle = 'rgba(255,240,215,.75)'; c.lineWidth = 5 * u; c.beginPath(); c.moveTo(-560 * u, -150 * u); c.lineTo(520 * u, -165 * u); c.stroke();
  c.restore();
  /* smoke pouring out of the engines and a crack in the hull, sparks */
  for (const [sx, sy, n] of [[700, -170, 0], [690, -330, 1], [130, -300, 2]]){
    for (let k = 0; k < 7; k++){
      const a = (t * 0.22 + k / 7 + n * 0.17) % 1;
      glow(c, p.x + (sx + a * 260 + Math.sin(a * 6 + n) * 40) * u, p.y + (sy - a * 900) * u, (70 + a * 260) * u, '#5d5d72', 0.75 * (1 - a));
    }
  }
  for (let k = 0; k < 4; k++){
    const a = (t * 1.6 + k / 4) % 1;
    c.fillStyle = `rgba(255,210,110,${1 - a})`; circ(c, p.x + (120 + k * 20 + a * 40) * u, p.y - (300 + a * 200) * u, 5 * u + 1);
  }
}

/* A piece of wreckage thrown off in the crash: a twisted hull shard on
   the ground at depth rel, embers glowing, smoke rising. */
export function worldWreck(c, W, H, rel, lane, t, s = 1, n = 0){
  const p = P(lane, rel, W, H), u = H * 0.0011 * p.k * s;
  if (p.x < -300 * u || p.x > W + 300 * u) return;
  c.fillStyle = 'rgba(20,15,45,.35)'; c.beginPath(); c.ellipse(p.x, p.y, 160 * u, 30 * u, 0, 0, 6.2832); c.fill();
  c.save(); c.translate(p.x, p.y); c.rotate((n % 2 ? 1 : -1) * 0.25);
  const mg = c.createLinearGradient(-120 * u, 0, 120 * u, 0); mg.addColorStop(0, '#c9ced9'); mg.addColorStop(0.5, '#737a90'); mg.addColorStop(1, '#2c3042');
  c.fillStyle = mg; c.beginPath(); c.moveTo(-130 * u, 0); c.lineTo(-90 * u, -110 * u); c.lineTo(40 * u, -140 * u); c.lineTo(120 * u, -60 * u); c.lineTo(100 * u, 0); c.closePath(); c.fill();
  c.fillStyle = '#e8b830'; c.beginPath(); c.moveTo(-100 * u, -80 * u); c.lineTo(60 * u, -110 * u); c.lineTo(66 * u, -94 * u); c.lineTo(-94 * u, -64 * u); c.closePath(); c.fill();
  c.fillStyle = '#1d2030'; c.beginPath(); c.ellipse(10 * u, -60 * u, 30 * u, 18 * u, 0.3, 0, 6.2832); c.fill();
  c.restore();
  glow(c, p.x + 10 * u, p.y - 70 * u, 70 * u, '#ff9a3d', 0.5 + 0.3 * Math.sin(t * 7 + n));
  for (let k = 0; k < 5; k++){
    const a = (t * 0.25 + k / 5 + n * 0.13) % 1;
    glow(c, p.x + 10 * u + Math.sin(a * 5 + n) * 30 * u + a * 80 * u, p.y - (90 + a * 520) * u, (45 + a * 140) * u, '#5d5d72', 0.6 * (1 - a));
  }
}
