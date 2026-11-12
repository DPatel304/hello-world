/* The console turning on: Orlis Play's intro, about six seconds, the same
   every time. Four little lights - one in each player's colour - drift in
   from the corners on soft grey, swirl round each other and merge into the
   cube (the kalimba plays its do-mi-sol as they join), the name comes up
   under it, then "Get up. Get together." - four lights, one cube - and the cube winks. Then it breaks apart into tiles, and the
   home screen's game tiles fly out from where it was (menu.js: arrive).

   The Easter egg: a player who waves while the lights are swirling sends
   their light round a little loop-the-loop. Nobody has to; it carries on
   the same either way.

   The camera starts underneath it all. If it's slower than the show, the
   cube waits, breathing, with a quiet "starting the camera" under it until
   it's ready (camReady). A click or a key skips to the end. */
import { sfx } from '../audio/sound.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { screen, h, clearUI } from './screens.js';

/* Seconds: the lights arrive, swirl, merge; the name; the wink; where it
   waits for the camera; the break; the end. */
/* (After the wink, two seconds more of the name and the tagline before it breaks.) */
export const ARRIVE = 0.8, MERGE = 2.2, NAME = 2.6, WINK = 3.5, HOLD = 5.95, BREAK = 6.0, BOOT = 6.3;
/* The look: the room, and the cube's three faces. */
export const PAPER = '#f3f4f7';
export const FACES = { top: ['#e9fbff', '#f3e8ff'], left: ['#5eead4', '#60a5fa'], right: ['#60a5fa', '#c084fc'] };
export const SYS = '"Segoe UI Variable Display","Segoe UI","SF Pro Display",-apple-system,Inter,system-ui,sans-serif';
/* Waving at the swirl: how fast a hand has to go (screen widths a second),
   for how long, and how long a loop takes. */
const WAVE_SPEED = 1.1, WAVE_FOR = 0.18, LOOP = 0.75;

export function boot(){
  clearUI();
  const s = screen('boot');
  const wait = h('p', 'bootwait', 'Starting the camera…');
  s.appendChild(wait);

  let t = 0, idle = 0, merged = false, winked = false, broke = false, skip = false;
  const loops = PLAYER_COLORS.map(() => ({ at: -1, fast: 0, x: null }));
  const end = () => { skip = true; };
  addEventListener('keydown', end, { once: true });
  addEventListener('pointerdown', end, { once: true });

  const show = {
    camReady: false,
    get t(){ return t; },
    get done(){ return t >= BOOT; },
    tick(dt){
      idle += dt;
      /* the cube waits for the camera before it breaks */
      if (skip && t < HOLD) t = HOLD;
      if (t < HOLD || show.camReady) t += dt;
      if (t > HOLD && !show.camReady) t = HOLD;
      wait.classList.toggle('show', t >= HOLD && !show.camReady && idle > HOLD + 1);
      if (!merged && t >= MERGE){ merged = true; sfx.boot(); }
      if (!winked && t >= WINK){ winked = true; sfx.wink(); }
      if (!broke && t >= BREAK){ broke = true; sfx.whoosh?.(); }
      /* the Easter egg: waving while they swirl */
      for (let i = 0; i < loops.length; i++){
        const p = pose.players[i], lp = loops[i];
        if (!p || !p.present || t < ARRIVE * 0.5 || t > MERGE - LOOP){ lp.x = null; lp.fast = 0; continue; }
        const x = (p.hands.right || {}).x;
        if (x == null){ lp.x = null; continue; }
        const v = lp.x == null ? 0 : Math.abs(x - lp.x) / Math.max(dt, 1e-3);
        lp.x = x;
        lp.fast = v > WAVE_SPEED ? lp.fast + dt : 0;
        if (lp.fast >= WAVE_FOR && lp.at < 0){ lp.at = t; sfx.twinkle?.(); }
      }
    },
    draw(c, W, H){ drawBoot(c, W, H, t, idle, loops); }
  };
  return show;
}

/* ---------- the picture ---------- */

const cl = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => cl((t - a) / (b - a));
const eo = (k) => 1 - Math.pow(1 - k, 3), ei = (k) => k * k * k;
const eio = (k) => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const back = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
const TAU = Math.PI * 2;

function drawBoot(c, W, H, t, idle, loops){
  const u = Math.min(W / 1920, H / 1080), cx = W / 2, cy = H * 0.42, s = 185 * u;
  c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
  /* the four lights: in from the corners, then round each other into the middle */
  if (t < MERGE + 0.05){
    const corners = [[0.18, 0.2], [0.82, 0.22], [0.2, 0.78], [0.8, 0.76]].map(([fx, fy]) => [W * fx, H * fy]);
    const starts = [[-0.1, -0.15], [1.1, -0.15], [-0.1, 1.15], [1.1, 1.15]].map(([fx, fy]) => [W * fx, H * fy]);
    const polar = corners.map(([x, y]) => ({ a: Math.atan2((y - cy) / 0.75, (x - cx) / 1.3), r: Math.hypot((x - cx) / 1.3, (y - cy) / 0.75) }));
    const at = (k, uu) => { const p = polar[k], a = p.a + uu * TAU * 1.15, r = p.r * (1 - uu); return [cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 0.75]; };
    const d = eo(seg(t, 0, ARRIVE)), sw = eio(seg(t, ARRIVE, MERGE));
    PLAYER_COLORS.forEach((col, k) => {
      if (sw > 0) for (let j = 22; j >= 1; j--){ const uu = sw - j * 0.012; if (uu < 0) continue; const [x, y] = at(k, uu); glow(c, x, y, (38 - j) * u, col, 0.3 * (1 - j / 23)); }
      let [x, y] = sw > 0 ? at(k, sw) : [lerp(starts[k][0], corners[k][0], d), lerp(starts[k][1], corners[k][1], d)];
      /* a loop-the-loop, for a wave */
      const lp = loops[k];
      if (lp.at >= 0 && t - lp.at < LOOP){ const f = eio((t - lp.at) / LOOP) * TAU, r = 90 * u * (1 - sw * 0.6); x += Math.sin(f) * r; y -= (1 - Math.cos(f)) * r; }
      glow(c, x, y, 120 * u * (1 - sw * 0.4), col, 0.55);
      glow(c, x, y, 26 * u, '#ffffff', 1);
    });
  }
  /* merged: a soft flash, and the cube pops in; the name; the dots; the wink */
  if (t >= MERGE - 0.05 && t < BREAK + 0.3){
    const b = seg(t, MERGE, MERGE + 0.6); if (b > 0 && b < 1) glow(c, cx, cy, 760 * u * eo(b), '#ffffff', 1 - b);
    const breathe = t >= HOLD ? 1 + 0.015 * Math.sin(idle * 3) : 1;
    const sc = back(seg(t, MERGE - 0.05, MERGE + 0.4)) * (1 - eio(seg(t, BREAK, BREAK + 0.15))) * breathe;
    glow(c, cx, cy, 620 * u, 'rgba(147,197,253,.5)', seg(t, MERGE, MERGE + 0.4) * (1 - seg(t, BREAK, BREAK + 0.2)));
    const open = eo(seg(t, NAME + 0.6, NAME + 0.8));
    const eyes = t > NAME + 0.6 ? { open: Math.max(0.05, open), winkR: t > WINK && t < WINK + 0.3, smile: t > NAME + 0.7 } : null;
    if (sc > 0.02) cube(c, cx, cy, s * sc, eyes);
    const fade = 1 - seg(t, BREAK, BREAK + 0.2);
    PLAYER_COLORS.forEach((col, k) => { const p = back(seg(t, NAME + 0.1 + k * 0.08, NAME + 0.35 + k * 0.08)) * fade; if (p <= 0) return; c.fillStyle = col; c.beginPath(); c.arc(cx + (-72 + k * 48) * u, cy + s * 1.42, 10 * u * p, 0, TAU); c.fill(); });
    const wa = eo(seg(t, NAME, NAME + 0.5)) * fade;
    if (wa > 0){
      c.save(); c.globalAlpha = wa; c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle';
      wordmark(c, cx, cy + s * 1.9 + 20 * u * (1 - wa), 96 * u); c.restore();
      const ta = eo(seg(t, NAME + 0.35, NAME + 0.85)) * fade;
      if (ta > 0) tagline(c, cx, cy + s * 1.9 + 78 * u + 10 * u * (1 - ta), 30 * u, ta);
    }
  }
  /* the break: a flash, and pieces flying out (the home screen's tiles take over) */
  if (t >= BREAK){
    const k = seg(t, BREAK, BOOT + 0.3);
    if (k < 0.4) glow(c, cx, cy, 500 * u, '#ffffff', 1 - k / 0.4);
    const cols = ['#5eead4', '#60a5fa', '#c084fc'];
    for (let n = 0; n < 10; n++){
      const a = n * 2.4, r = 900 * u * eo(k), sz = (40 + (n % 3) * 10) * u;
      c.save(); c.globalAlpha = 0.8 * (1 - k); c.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6); c.rotate(a + k * 3);
      c.fillStyle = cols[n % 3]; c.beginPath(); c.roundRect(-sz / 2, -sz / 2, sz, sz, sz * 0.3); c.fill(); c.restore();
    }
  }
}

function glow(c, x, y, r, col, a = 1){
  if (r <= 0 || a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(243,244,247,0)');
  c.save(); c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
}
const grad = (c, x0, y0, x1, y1, cols) => { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); return g; };
const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };

/* The cube, seen corner-on, s an edge: its glow and shadow, the three faces,
   a shine on top - and its face on the right side (eyes: open 0..1, winkR,
   smile). */
export function cube(c, x, y, s, eyes = null){
  const k = Math.cos(Math.PI / 6) * s;
  const T = [x, y - s], R = [x + k, y - s / 2], L = [x - k, y - s / 2], C = [x, y], B = [x, y + s], BR = [x + k, y + s / 2], BL = [x - k, y + s / 2];
  c.save(); c.fillStyle = 'rgba(30,30,60,.12)'; c.filter = `blur(${Math.max(2, s * 0.1)}px)`;
  c.beginPath(); c.ellipse(x, y + s * 1.12, s * 0.95, s * 0.2, 0, 0, TAU); c.fill(); c.restore();
  glow(c, x, y, s * 2.6, 'rgba(192,132,252,.5)', 0.7);
  poly(c, [L, C, B, BL]); c.fillStyle = grad(c, x - s, y - s / 2, x, y + s, FACES.left); c.fill();
  poly(c, [C, R, BR, B]); c.fillStyle = grad(c, x, y - s / 2, x + s, y + s, FACES.right); c.fill();
  poly(c, [L, T, R, C]); c.fillStyle = grad(c, x - s, y - s, x + s, y, FACES.top); c.fill();
  c.save(); poly(c, [L, T, R, C]); c.clip(); c.fillStyle = 'rgba(255,255,255,.35)';
  c.beginPath(); c.ellipse(x - s * 0.2, y - s * 0.62, s * 0.5, s * 0.16, -0.5, 0, TAU); c.fill(); c.restore();
  if (!eyes) return;
  c.save(); c.transform(R[0] - C[0], R[1] - C[1], B[0] - C[0], B[1] - C[1], C[0], C[1]);
  const ink = '#1e1b4b';
  for (const [ex, shut] of [[0.32, false], [0.68, eyes.winkR]]){
    c.fillStyle = ink;
    if (shut){ c.fillRect(ex - 0.08, 0.4, 0.16, 0.035); continue; }
    c.beginPath(); c.ellipse(ex, 0.4, 0.06, 0.09 * eyes.open, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(ex - 0.018, 0.37, 0.018, 0.024 * eyes.open, 0, 0, TAU); c.fill();
  }
  if (eyes.smile){ c.strokeStyle = ink; c.lineWidth = 0.035; c.lineCap = 'round'; c.beginPath(); c.arc(0.5, 0.52, 0.14, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
  c.restore();
}

/* The name: "Orlis" in bold ink, "Play" lighter in the cube's own colours,
   centred on x with its baseline on y. */
export const NAME_A = 'Orlis', NAME_B = 'Play', TAGLINE = 'Get up. Get together.';
export function wordmark(c, x, y, size){
  c.save(); c.textAlign = 'left'; c.textBaseline = 'middle';
  c.font = `700 ${Math.round(size)}px ${SYS}`; const wa = c.measureText(NAME_A + ' ').width;
  c.font = `400 ${Math.round(size)}px ${SYS}`; const wb = c.measureText(NAME_B).width;
  const x0 = x - (wa + wb) / 2;
  c.font = `700 ${Math.round(size)}px ${SYS}`; c.fillStyle = '#111'; c.fillText(NAME_A, x0, y);
  c.font = `400 ${Math.round(size)}px ${SYS}`;
  c.fillStyle = grad(c, x0 + wa, 0, x0 + wa + wb, 0, ['#2bb6c9', '#5b8cf5', '#a66bf5']);
  c.fillText(NAME_B, x0 + wa, y); c.restore();
}
/* "GET UP. GET TOGETHER.", small and spaced out, under the name. */
export function tagline(c, x, y, size, a = 1){
  c.save(); c.globalAlpha = a; c.fillStyle = '#5b5f6e'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `500 ${Math.round(size)}px ${SYS}`;
  if ('letterSpacing' in c) c.letterSpacing = `${(size * 0.18).toFixed(1)}px`;
  c.fillText(TAGLINE.toUpperCase(), x, y); c.restore();
}

/* The cube as a little picture, for the home screen's corner: an SVG. */
export const MARK = `<svg viewBox="-1 -1.1 2 2.2" aria-hidden="true"><defs>
<linearGradient id="mcT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${FACES.top[0]}"/><stop offset="1" stop-color="${FACES.top[1]}"/></linearGradient>
<linearGradient id="mcL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${FACES.left[0]}"/><stop offset="1" stop-color="${FACES.left[1]}"/></linearGradient>
<linearGradient id="mcR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${FACES.right[0]}"/><stop offset="1" stop-color="${FACES.right[1]}"/></linearGradient></defs>
<path d="M-.866 -.5 L0 0 L0 1 L-.866 .5Z" fill="url(#mcL)"/><path d="M0 0 L.866 -.5 L.866 .5 L0 1Z" fill="url(#mcR)"/><path d="M-.866 -.5 L0 -1 L.866 -.5 L0 0Z" fill="url(#mcT)"/></svg>`;
