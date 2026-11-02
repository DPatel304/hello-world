/* Last Known Position's characters, drawn properly - for any level with a
   world look (lkp-world.js); the greybox (lkp-art.js) draws them
   otherwise. All lit from the left, like everything else.

     crew     off-white spacesuits trimmed in each player's colour, their
              own face in a glass helmet
     beasts   the planet's wildlife: round fluffy puffballs with big amber
              eyes and a glowing flower on top - grumpy, not scary
     robots   gunmetal, on one wheel, a dark visor with one red eye
     Nova     the Commander, on her comms feed */
import { glow, mix, rgba } from './lkp-world.js';

const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, 6.2832); c.fill(); };
const INK = '#1a1830';

/* ---------- the crew ---------- */

/* A crew member in their spacesuit, h tall, feet at (x, base). Same st and
   face as lkp-art.js drawCrew. pose: 'reach' (an arm up) or 'hug' (arms
   crossed), else arms at their sides. */
export function worldCrew(c, x, base, h, t, col, st, face, pose = null){
  const u = h / 300, f = 1 - (st.duck || 0) * 0.45;
  c.fillStyle = 'rgba(20,15,45,.4)'; c.beginPath(); c.ellipse(x, base, 85 * u, 18 * u, 0, 0, 6.2832); c.fill();
  c.save();
  /* Running (st.run 0..1, st.runPh the stride's phase): knees pumping
     high, the body bouncing, arms swinging against the legs. */
  const run = st.run || 0, ph = st.runPh || 0;
  const bounce = run * Math.abs(Math.sin(ph)) * 12 * u;
  /* a puff of dust kicked up behind each foot as it pushes off */
  if (run > 0.2 && !st.air) for (const d of [-1, 1]){
    const k = (((ph + (d < 0 ? Math.PI : 0)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / Math.PI;
    if (k > 1) continue;
    c.fillStyle = `rgba(225,215,235,${0.45 * (1 - k) * run})`;
    circ(c, x + d * (30 + 30 * k) * u, base - (6 + 22 * k) * u, (10 + 22 * k) * u);
  }
  c.translate(x, base - st.air - bounce); c.rotate(st.lean * 0.2 + run * Math.sin(ph) * 0.05);
  if (st.down){ c.translate(h * 0.4, -h * 0.16); c.rotate(-Math.PI / 2); c.globalAlpha = 0.6; }
  if (st.lost) c.globalAlpha = 0.35;
  else if (st.blink && Math.floor(t * 12) % 2) c.globalAlpha = 0.5;
  const trim = col, trimD = mix(col, '#101030', 0.35);
  const suit = (x0, x1) => { const g = c.createLinearGradient(x0 * u, 0, x1 * u, 0); g.addColorStop(0, '#f6ecd9'); g.addColorStop(0.5, '#ddd0b6'); g.addColorStop(1, '#8f8270'); return g; };
  /* The body, squashed down when they duck. */
  c.save(); c.scale(1, f);
  /* backpack behind */
  c.fillStyle = '#6f7598'; c.beginPath(); c.roundRect(-82 * u, -175 * u, 164 * u, 105 * u, 26 * u); c.fill();
  c.fillStyle = '#9aa0c2'; c.beginPath(); c.roundRect(-82 * u, -175 * u, 30 * u, 105 * u, 14 * u); c.fill();
  /* legs and boots: standing, a little shuffle; running, each knee
     driving up in turn - seen from behind, the leg shortens and the boot
     lifts, its sole showing. */
  for (const d of [-1, 1]){
    const lift = run * Math.max(0, Math.sin(ph + (d < 0 ? 0 : Math.PI))), shuffle = run ? 0 : Math.sin(t * 9) * 4 * u * d;
    const top = -78 * u, len = (66 - 44 * lift) * u, y0 = top + shuffle - lift * 14 * u;
    c.fillStyle = suit(d * 30 - 26, d * 30 + 26); c.beginPath(); c.roundRect((d * 30 - 26) * u, y0, 52 * u, len, 18 * u); c.fill();
    c.fillStyle = trim; c.fillRect((d * 30 - 26) * u, y0 + 20 * u, 52 * u, 12 * u);
    const by = y0 + len - 12 * u;
    c.fillStyle = lift > 0.25 ? '#2b2e45' : d < 0 ? '#5b607f' : '#3d4160';
    c.beginPath(); c.roundRect((d * 32 - 30) * u, by, 60 * u, (24 + 6 * lift) * u, 10 * u); c.fill();
  }
  /* arms at their sides (unless posed) */
  for (const d of [-1, 1]){
    if (pose === 'hug' || pose === 'stretch' || (pose === 'reach' && d < 0)) continue;
    /* swinging against the legs as they run */
    const sw = run * Math.sin(ph + (d < 0 ? Math.PI : 0)) * 18 * u;
    c.fillStyle = suit(d * 82 - 22, d * 82 + 22); c.beginPath(); c.roundRect((d * 82 - 22) * u, -168 * u - Math.max(0, sw), 44 * u, 100 * u - Math.abs(sw) * 0.6, 20 * u); c.fill();
    c.fillStyle = trim; c.fillRect((d * 82 - 22) * u, -108 * u - sw * 0.8, 44 * u, 10 * u);
    c.fillStyle = d < 0 ? '#5b607f' : '#3d4160'; circ(c, d * 82 * u, -62 * u - sw * 1.3, 20 * u);
  }
  /* torso, belt, chest panel, straps */
  c.fillStyle = suit(-64, 64); c.beginPath(); c.roundRect(-64 * u, -178 * u, 128 * u, 118 * u, 34 * u); c.fill();
  c.strokeStyle = 'rgba(90,75,55,.35)'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(-40 * u, -176 * u); c.quadraticCurveTo(-48 * u, -120 * u, -40 * u, -84 * u); c.moveTo(40 * u, -176 * u); c.quadraticCurveTo(48 * u, -120 * u, 40 * u, -84 * u); c.stroke();
  c.fillStyle = 'rgba(70,75,105,.55)'; c.beginPath(); c.roundRect(-60 * u, -172 * u, 12 * u, 92 * u, 5 * u); c.roundRect(48 * u, -172 * u, 12 * u, 92 * u, 5 * u); c.fill();
  c.fillStyle = '#4a4f72'; c.fillRect(-64 * u, -82 * u, 128 * u, 16 * u); c.fillStyle = '#c9cde3'; c.beginPath(); c.roundRect(-12 * u, -84 * u, 24 * u, 20 * u, 5 * u); c.fill();
  c.fillStyle = trimD; c.beginPath(); c.roundRect(-32 * u, -150 * u, 64 * u, 46 * u, 12 * u); c.fill();
  c.fillStyle = trim; c.beginPath(); c.roundRect(-28 * u, -146 * u, 56 * u, 38 * u, 10 * u); c.fill();
  c.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++){ c.globalAlpha *= (0.9 - k * 0.25); circ(c, (-14 + k * 14) * u, -127 * u, 5 * u); c.globalAlpha /= (0.9 - k * 0.25); }
  for (const d of [-1, 1]){ c.fillStyle = trim; c.beginPath(); c.ellipse(d * 68 * u, -168 * u, 30 * u, 14 * u, d * 0.25, 0, 6.2832); c.fill(); }
  /* posed arms, copying the player's own */
  const limb = (pts, lit) => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [w, sc] of [[50, '#5a5040'], [40, lit ? '#f3e7cf' : '#c9b99c']]){ c.strokeStyle = sc; c.lineWidth = w * u; c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a * u, b * u) : c.moveTo(a * u, b * u))); c.stroke(); }
    const [hx, hy] = pts[pts.length - 1]; c.fillStyle = '#4b5070'; circ(c, hx * u, hy * u, 22 * u);
  };
  if (pose === 'reach') limb([[-66, -160], [-120, -245], [-105, -345]], true);
  if (pose === 'hug'){ limb([[-74, -165], [-50, -112], [52, -160]], true); limb([[74, -165], [50, -120], [-52, -166]], false); }
  /* rim light from the sun */
  c.strokeStyle = 'rgba(255,215,180,.85)'; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(-64 * u, -150 * u); c.lineTo(-64 * u, -95 * u); c.stroke();
  /* collar ring */
  c.fillStyle = trimD; c.beginPath(); c.ellipse(0, -176 * u, 70 * u, 20 * u, 0, 0, 6.2832); c.fill();
  c.fillStyle = trim; c.beginPath(); c.ellipse(0, -180 * u, 64 * u, 16 * u, 0, 0, 6.2832); c.fill();
  c.restore();
  /* The helmet, on top whatever they're doing, with their face in it. */
  const r = 82 * u, hy = -163 * u * f - r;
  if (st.photo) face(0, hy, r);
  else {
    c.save(); c.beginPath(); c.arc(0, hy, r, 0, 6.2832); c.clip();
    c.fillStyle = '#cfe6f5'; c.fillRect(-r, hy - r, r * 2, r * 2);
    face(0, hy, r);
    c.restore();
  }
  /* glass: a soft inner shadow, a sky reflection, a sharp highlight; the rim */
  const ig = c.createRadialGradient(-10 * u, hy - 10 * u, r * 0.5, 0, hy, r); ig.addColorStop(0, 'rgba(0,0,0,0)'); ig.addColorStop(0.8, 'rgba(10,20,50,.05)'); ig.addColorStop(1, 'rgba(10,20,50,.35)');
  c.fillStyle = ig; circ(c, 0, hy, r);
  const rg = c.createLinearGradient(-60 * u, hy - 75 * u, 20 * u, hy + 15 * u); rg.addColorStop(0, 'rgba(200,230,255,.45)'); rg.addColorStop(1, 'rgba(200,230,255,0)');
  c.fillStyle = rg; c.beginPath(); c.ellipse(-20 * u, hy - 35 * u, 56 * u, 32 * u, -0.5, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-42 * u, hy - 51 * u, 14 * u, 6 * u, -0.7, 0, 6.2832); c.fill();
  c.strokeStyle = trim; c.lineWidth = 7 * u; circ0(c, 0, hy, r); c.stroke();
  c.strokeStyle = 'rgba(255,215,180,.8)'; c.lineWidth = 4 * u; c.beginPath(); c.arc(0, hy, r + 6 * u, Math.PI * 0.8, Math.PI * 1.35); c.stroke();
  /* antenna on the pack */
  c.strokeStyle = '#6f7598'; c.lineWidth = 4 * u; c.beginPath(); c.moveTo(70 * u, -175 * u * f); c.lineTo(92 * u, (-175 * f - 55) * u); c.stroke(); c.fillStyle = trim; circ(c, 92 * u, (-175 * f - 57) * u, 6 * u);
  if (st.lost){ c.setLineDash?.([6, 6]); c.strokeStyle = '#ffffff'; c.lineWidth = 3; circ0(c, 0, hy, r * 1.25); c.stroke(); c.setLineDash?.([]); }
  if (st.hit > 0){ c.globalAlpha = st.hit * 0.55; c.fillStyle = '#ff3b3b'; circ(c, 0, hy, r * 1.15); c.fillRect(-70 * u, -178 * u * f, 140 * u, 178 * u * f); }
  /* In healing water: blue, the way a hit is red. */
  if (st.heal > 0 && !(st.hit > 0.3)){ c.globalAlpha = st.heal * 0.45; c.fillStyle = '#38c8ff'; circ(c, 0, hy, r * 1.15); c.fillRect(-70 * u, -178 * u * f, 140 * u, 178 * u * f); }
  c.restore();
}
const circ0 = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, 6.2832); };

/* ---------- the beasts ---------- */

/* A wild beast, s tall, feet at (x, base): a round fluffy puffball on
   stubby legs, floppy ears, big shiny amber eyes, one tooth, a glowing
   flower sprouting from its head. st as lkp-art.js drawBeast: swing (a
   lunge), flash (just hit), hp. */
export function worldBeast(c, x, base, s, t, st){
  const u = s / 210, bob = Math.abs(Math.sin(t * 6)) * 6 * u, lunge = st.swing > 0 ? Math.sin(st.swing * Math.PI) : 0;
  c.fillStyle = 'rgba(20,15,45,.35)'; c.beginPath(); c.ellipse(x + 20 * u, base, 80 * u, 18 * u, 0, 0, 6.2832); c.fill();
  c.save(); c.translate(x, base - bob + lunge * 14 * u); c.scale(1 + lunge * 0.12, 1 - lunge * 0.1);
  for (const d of [-1, 1]){ c.fillStyle = d < 0 ? '#9b7cc9' : '#6a50a0'; c.beginPath(); c.roundRect((d * 34 - 13) * u, -34 * u, 26 * u, 34 * u, 12 * u); c.fill(); }
  const by = -92 * u, R = 72 * u;
  for (let k = 0; k < 14; k++){ const a = k / 14 * 6.2832; c.fillStyle = Math.cos(a) < -0.2 ? '#c9a8f0' : Math.cos(a) > 0.3 ? '#7a5cb5' : '#a487d8'; circ(c, Math.cos(a) * R * 0.85, by + Math.sin(a) * R * 0.8, 24 * u); }
  const bg = c.createRadialGradient(-25 * u, by - 25 * u, 5 * u, 0, by, R); bg.addColorStop(0, '#e6d4ff'); bg.addColorStop(0.6, '#a98bdc'); bg.addColorStop(1, '#6f53a6');
  c.fillStyle = bg; circ(c, 0, by, R * 0.9);
  c.fillStyle = '#f3e6ff'; c.beginPath(); c.ellipse(0, by + 26 * u, 36 * u, 26 * u, 0, 0, 6.2832); c.fill();
  for (const d of [-1, 1]){
    c.fillStyle = d < 0 ? '#b596e6' : '#7e60b8'; c.beginPath(); c.ellipse(d * 62 * u, by - 30 * u, 16 * u, 30 * u, d * 0.9, 0, 6.2832); c.fill();
    c.fillStyle = '#ffb3d6'; c.beginPath(); c.ellipse(d * 62 * u, by - 30 * u, 7 * u, 18 * u, d * 0.9, 0, 6.2832); c.fill();
  }
  c.strokeStyle = '#4f9f7f'; c.lineWidth = 4 * u; c.beginPath(); c.moveTo(4 * u, by - 62 * u); c.quadraticCurveTo(14 * u, by - 90 * u, 4 * u, by - 104 * u); c.stroke();
  glow(c, 4 * u, by - 108 * u, 34 * u, '#8ff7d6', 0.9);
  c.fillStyle = '#c9fff0'; for (let k = 0; k < 5; k++){ const a = k / 5 * 6.2832; circ(c, 4 * u + Math.cos(a) * 8 * u, by - 108 * u + Math.sin(a) * 8 * u, 6 * u); }
  c.fillStyle = '#ffe58a'; circ(c, 4 * u, by - 108 * u, 5 * u);
  const blink = (t % 3.7) < 0.12;
  for (const d of [-1, 1]){
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(d * 24 * u, by - 8 * u, 19 * u, blink ? 3 * u : 22 * u, 0, 0, 6.2832); c.fill();
    if (!blink){
      c.fillStyle = '#ffb63d'; circ(c, d * 22 * u, by - 4 * u, 13 * u);
      c.fillStyle = '#2a1a10'; circ(c, d * 21 * u, by - 3 * u, 8 * u);
      c.fillStyle = '#ffffff'; circ(c, d * 21 * u - 4 * u, by - 8 * u, 4 * u); circ(c, d * 21 * u + 3 * u, by + u, 2 * u);
    }
    c.strokeStyle = '#4a3577'; c.lineWidth = 4 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(d * 10 * u, by - 32 * u); c.lineTo(d * 34 * u, by - 36 * u); c.stroke();
  }
  c.fillStyle = 'rgba(255,140,190,.55)'; for (const d of [-1, 1]){ c.beginPath(); c.ellipse(d * 44 * u, by + 14 * u, 10 * u, 6 * u, 0, 0, 6.2832); c.fill(); }
  c.strokeStyle = '#4a3577'; c.lineWidth = 3.5 * u; c.beginPath(); c.arc(0, by + 26 * u, 9 * u, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-5 * u, by + 18 * u); c.lineTo(u, by + 28 * u); c.lineTo(5 * u, by + 18 * u); c.fill();
  if (st.flash > 0.3){ c.globalAlpha = Math.min(1, st.flash) * 0.6; c.fillStyle = '#ffffff'; circ(c, 0, by, R); }
  c.restore();
  if (st.hp < 1) hpBar(c, x, base - s * 1.08, s * 0.55, st.hp);
}

/* ---------- the robots ---------- */

/* A robot, s tall, wheel at (x, base): a gunmetal egg on one wheel,
   jointed arms, a dark visor with one red eye. st as drawRustbot: swing
   (its arm coming down), flash, hp. */
export function worldRobot(c, x, base, s, t, st){
  const u = s / 220, wob = Math.sin(t * 5) * 3 * u, swing = st.swing > 0 ? Math.sin(st.swing * Math.PI) : 0;
  c.fillStyle = 'rgba(20,15,45,.4)'; c.beginPath(); c.ellipse(x + 20 * u, base, 80 * u, 16 * u, 0, 0, 6.2832); c.fill();
  c.save(); c.translate(x, base);
  /* the wheel, spinning */
  c.fillStyle = '#23263f'; c.beginPath(); c.ellipse(0, -22 * u, 30 * u, 24 * u, 0, 0, 6.2832); c.fill();
  c.strokeStyle = '#4a4f75'; c.lineWidth = 3 * u; for (let k = 0; k < 3; k++){ const a = t * 8 + k * 2.09; c.beginPath(); c.moveTo(0, -22 * u); c.lineTo(Math.cos(a) * 22 * u, -22 * u + Math.sin(a) * 18 * u); c.stroke(); }
  c.translate(wob, 0);
  /* neck */
  c.fillStyle = '#6c7299'; c.fillRect(-10 * u, -70 * u, 20 * u, 40 * u); c.fillStyle = '#9ea4c8'; c.fillRect(-10 * u, -70 * u, 6 * u, 40 * u);
  /* the shell, gunmetal, lit from the left */
  const fl = st.flash > 0.4;
  const bg = c.createRadialGradient(-45 * u, -175 * u, 5 * u, 10 * u, -130 * u, 110 * u);
  bg.addColorStop(0, fl ? '#ffffff' : '#c9cdd8'); bg.addColorStop(0.45, fl ? '#ffe0e0' : '#7c8295'); bg.addColorStop(1, fl ? '#d9b0b0' : '#2c3042');
  c.fillStyle = bg; c.beginPath(); c.ellipse(0, -135 * u, 72 * u, 78 * u, 0, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(20,20,40,.35)'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(-70 * u, -120 * u); c.quadraticCurveTo(0, -100 * u, 70 * u, -120 * u); c.stroke();
  c.strokeStyle = 'rgba(255,190,140,.85)'; c.lineWidth = 4 * u; c.beginPath(); c.ellipse(0, -135 * u, 71 * u, 77 * u, 0, Math.PI * 0.75, Math.PI * 1.35); c.stroke();
  /* visor and eye */
  c.fillStyle = '#10132a'; c.beginPath(); c.ellipse(6 * u, -158 * u, 54 * u, 24 * u, 0, 0, 6.2832); c.fill();
  glow(c, 16 * u, -158 * u, 46 * u, '#ff3b55', 0.9);
  c.fillStyle = '#ff4d63'; c.beginPath(); c.ellipse(16 * u, -158 * u, 16 * u, 10 * u, 0, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-16 * u, -168 * u, 24 * u, 6 * u, -0.15, 0, 6.2832); c.fill();
  /* arms: the right one chops down as it swings */
  c.lineCap = 'round';
  c.strokeStyle = '#c2c7e2'; c.lineWidth = 9 * u; c.beginPath(); c.moveTo(-66 * u, -120 * u); c.lineTo(-92 * u, -85 * u); c.lineTo(-84 * u, -50 * u); c.stroke();
  c.fillStyle = '#e9ecf8'; circ(c, -84 * u, -46 * u, 9 * u);
  const ra = -swing * 2.2;
  c.save(); c.translate(66 * u, -120 * u); c.rotate(ra);
  c.strokeStyle = '#6c7299'; c.beginPath(); c.moveTo(0, 0); c.lineTo(26 * u, 35 * u); c.lineTo(18 * u, 70 * u); c.stroke();
  c.fillStyle = '#7b81aa'; circ(c, 18 * u, 74 * u, 9 * u);
  c.restore();
  c.restore();
  if (st.hp < 1) hpBar(c, x, base - s * 1.08, s * 0.55, st.hp);
}

function hpBar(c, x, y, w, frac){
  const h = Math.max(3, w * 0.09);
  c.fillStyle = 'rgba(10,8,30,.6)'; c.beginPath(); c.roundRect(x - w / 2 - 2, y - 2, w + 4, h + 4, h); c.fill();
  c.fillStyle = '#ff6b8a'; c.beginPath(); c.roundRect(x - w / 2, y, Math.max(h, w * frac), h, h / 2); c.fill();
}

/* ---------- Commander Nova ---------- */

/* Nova, the ship's Commander, on her comms feed: confident and kind -
   swept hair tied back, a scar through one brow, a half-smile, a dark
   uniform with rank bars, a headset with a boom mic. Her mouth moves as
   she talks; she blinks. r is her head's size. */
export function commanderFace(c, x, y, r, t, talking){
  const k = r / 50;
  c.save();
  /* uniform: a high collar, an epaulette, rank bars */
  const ug = c.createLinearGradient(x - 90 * k, 0, x + 90 * k, 0); ug.addColorStop(0, '#2f4a7a'); ug.addColorStop(1, '#18284a');
  c.fillStyle = '#d9a989'; c.fillRect(x - 15 * k, y + 28 * k, 30 * k, 30 * k);
  c.fillStyle = ug; c.beginPath(); c.ellipse(x, y + 106 * k, 92 * k, 54 * k, 0, Math.PI, 6.2832); c.fill();
  c.fillStyle = '#22355e'; c.beginPath(); c.moveTo(x - 30 * k, y + 50 * k); c.lineTo(x - 22 * k, y + 74 * k); c.lineTo(x, y + 64 * k); c.lineTo(x + 22 * k, y + 74 * k); c.lineTo(x + 30 * k, y + 50 * k); c.fill();
  c.fillStyle = '#e8b830'; c.beginPath(); c.roundRect(x - 86 * k, y + 60 * k, 40 * k, 12 * k, 3 * k); c.fill();
  for (let i = 0; i < 3; i++) c.fillRect(x + 38 * k + i * 10 * k, y + 74 * k, 6 * k, 14 * k);
  /* face, lit from the left */
  const fg = c.createRadialGradient(x - 18 * k, y - 12 * k, 4 * k, x, y, 54 * k); fg.addColorStop(0, '#fbe1cd'); fg.addColorStop(1, '#d9a78a');
  c.fillStyle = fg; c.beginPath(); c.moveTo(x - 40 * k, y - 20 * k); c.quadraticCurveTo(x - 42 * k, y + 30 * k, x - 10 * k, y + 46 * k); c.lineTo(x + 10 * k, y + 46 * k); c.quadraticCurveTo(x + 42 * k, y + 30 * k, x + 40 * k, y - 20 * k); c.quadraticCurveTo(x, y - 62 * k, x - 40 * k, y - 20 * k); c.fill();
  /* hair: a shaved side, a swept top, tied back */
  c.fillStyle = '#1f1530'; c.beginPath(); c.moveTo(x - 44 * k, y - 4 * k); c.quadraticCurveTo(x - 50 * k, y - 60 * k, x + 4 * k, y - 66 * k); c.quadraticCurveTo(x + 52 * k, y - 62 * k, x + 46 * k, y - 10 * k); c.quadraticCurveTo(x + 30 * k, y - 46 * k, x - 6 * k, y - 40 * k); c.quadraticCurveTo(x - 30 * k, y - 36 * k, x - 44 * k, y - 4 * k); c.fill();
  c.fillStyle = 'rgba(31,21,48,.45)'; c.beginPath(); c.ellipse(x + 41 * k, y - 4 * k, 6 * k, 22 * k, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#1f1530'; c.beginPath(); c.ellipse(x + 52 * k, y - 40 * k, 12 * k, 20 * k, 0.6, 0, 6.2832); c.fill();
  /* eyes, one brow raised; the scar */
  const blink = (t % 4.1) < 0.12;
  for (const d of [-1, 1]){
    if (!blink){ c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x + d * 15 * k, y + 2 * k, 8 * k, 5 * k, 0, 0, 6.2832); c.fill(); c.fillStyle = '#2a1810'; circ(c, x + d * 15 * k, y + 2.5 * k, 4.2 * k); c.fillStyle = '#fff'; circ(c, x + d * 15 * k - 1.5 * k, y + k, 1.3 * k); }
    else { c.strokeStyle = '#2a1810'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(x + d * 15 * k - 7 * k, y + 2 * k); c.lineTo(x + d * 15 * k + 7 * k, y + 2 * k); c.stroke(); }
    c.strokeStyle = '#1f1530'; c.lineWidth = 3.5 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + d * 6 * k, y - 8 * k); c.lineTo(x + d * 25 * k, y + (d < 0 ? -14 : -9) * k); c.stroke();
  }
  c.strokeStyle = 'rgba(190,120,110,.8)'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(x + 20 * k, y - 16 * k); c.lineTo(x + 14 * k, y - 4 * k); c.stroke();
  /* the mouth: a half-smile, opening as she talks */
  const open = talking ? Math.abs(Math.sin(t * 14)) : 0;
  if (open > 0.15){ c.fillStyle = '#7a3530'; c.beginPath(); c.ellipse(x + 2 * k, y + 24 * k, 10 * k, 3 * k + open * 5 * k, 0, 0, 6.2832); c.fill(); }
  else { c.strokeStyle = '#a0504a'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x - 10 * k, y + 24 * k); c.quadraticCurveTo(x + 4 * k, y + 28 * k, x + 13 * k, y + 20 * k); c.stroke(); }
  /* headset and boom mic */
  c.strokeStyle = '#d6e4f0'; c.lineWidth = 6 * k; c.beginPath(); c.arc(x, y - 8 * k, 54 * k, Math.PI * 1.06, Math.PI * 1.55); c.stroke();
  c.fillStyle = '#d6e4f0'; c.beginPath(); c.roundRect(x - 58 * k, y - 14 * k, 14 * k, 28 * k, 5 * k); c.fill();
  c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x - 50 * k, y + 12 * k); c.lineTo(x - 18 * k, y + 32 * k); c.stroke();
  c.fillStyle = '#ff5b6b'; circ(c, x - 16 * k, y + 32 * k, 3 * k);
  c.restore();
}
