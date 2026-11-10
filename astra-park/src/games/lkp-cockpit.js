/* Last Known Position, the very first seconds: through your own helmet,
   strapped in on the ship's flight deck as it comes down. Red light
   flashing, the alarm going, everything shaking; out of the windscreen
   the sky rolls over and the green ground comes up and up - a little
   cube charm swinging wildly from the ceiling - Nova on the radio; then
   a white flash, a thump, and black. Disorienting, but plain what's
   happening: the ship is crashing.

   cockpit(c, W, H, t): drawn at t seconds in (0..CRASH). */
import { sfx } from '../audio/sound.js';

export const CRASH = 8.5;
/* The flash, and the cut to black after it (seconds in). */
export const FLASH = 7.4;
const ramp = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/* How bad it is, 0..1, over the dive. */
const dive = (t) => Math.pow(ramp(t, 0.3, FLASH), 1.3);
/* A shake that's the same each time it's drawn at the same moment. */
const shake = (t, k) => [Math.sin(t * 37) * 0.6 + Math.sin(t * 61 + 1) * 0.4, Math.sin(t * 43 + 2) * 0.6 + Math.sin(t * 71) * 0.4].map(v => v * k);

export function cockpit(c, W, H, t){
  const d = dive(t), flashK = ramp(t, FLASH - 0.15, FLASH), black = t > FLASH + 0.12;
  c.save();
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  if (black){ c.restore(); return; }
  const [sx, sy] = shake(t, H * (0.004 + 0.022 * d));
  c.translate(sx, sy);
  /* ---- outside: the sky, rolling over; the ground coming up ---- */
  const roll = Math.sin(t * 0.9) * 0.25 + d * 0.55, horizon = H * (0.42 - 0.5 * d);
  c.save();
  c.beginPath(); windscreen(c, W, H); c.clip();
  c.translate(W / 2, H * 0.38); c.rotate(roll); c.translate(-W / 2, -H * 0.38);
  const sky = c.createLinearGradient(0, horizon - H * 0.8, 0, horizon);
  sky.addColorStop(0, '#1a1240'); sky.addColorStop(0.6, '#7a4c9a'); sky.addColorStop(1, '#ffb38a');
  c.fillStyle = sky; c.fillRect(-W, horizon - H * 2, W * 3, H * 2);
  /* the stars, fading as you drop into the air */
  c.fillStyle = `rgba(255,255,255,${0.7 * (1 - d)})`;
  for (let k = 0; k < 40; k++){ const x = (k * 197 % 1000) / 1000 * W * 1.6 - W * 0.3, y = horizon - H * (0.25 + (k * 131 % 700) / 1000); c.fillRect(x, y, 2, 2); }
  /* the ground: green hills, nearer and bigger as it comes up */
  const gr = c.createLinearGradient(0, horizon, 0, horizon + H * 1.2);
  gr.addColorStop(0, '#5fa86a'); gr.addColorStop(0.3, '#3d7d4e'); gr.addColorStop(1, '#1f4a30');
  c.fillStyle = gr; c.fillRect(-W, horizon, W * 3, H * 3);
  const near = 1 + d * 5;
  c.fillStyle = 'rgba(30,70,45,.6)';
  for (let k = -3; k <= 3; k++){ const x = W / 2 + k * W * 0.22 * near, y = horizon + H * 0.03 * near; c.beginPath(); c.ellipse(x, y, W * 0.12 * near, H * 0.02 * near, 0, 0, 6.2832); c.fill(); }
  /* clouds rushing past, up and away - faster as it goes */
  for (let k = 0; k < 9; k++){
    const sp = 0.5 + d * 2.2, u = ((k * 0.37 + t * sp * (0.6 + (k % 3) * 0.25)) % 1);
    const x = W * ((k * 0.29) % 1) * 1.2 - W * 0.1, y = H * (1.1 - u * 1.4), r = H * (0.025 + 0.035 * u);
    c.fillStyle = `rgba(255,245,240,${0.4 * Math.sin(u * Math.PI)})`;
    c.beginPath(); c.ellipse(x, y, r * 1.6, r * (1.5 + d * 5), 0, 0, 6.2832); c.fill();
  }
  c.restore();
  /* a streak of heat across the glass */
  c.save(); c.beginPath(); windscreen(c, W, H); c.clip();
  const heat = c.createLinearGradient(0, H * 0.05, 0, H * 0.25);
  heat.addColorStop(0, `rgba(255,140,60,${0.45 * d})`); heat.addColorStop(1, 'rgba(255,140,60,0)');
  c.fillStyle = heat; c.fillRect(0, 0, W, H * 0.3);
  c.restore();
  /* ---- the flight deck around you ---- */
  frame(c, W, H, t, d);
  dashboard(c, W, H, t, d);
  charm(c, W, H, t, d);
  /* the alarm light, washing everything red */
  const pulse = Math.max(0, Math.sin(t * Math.PI * 1.6));
  c.fillStyle = `rgba(255,30,40,${0.03 + 0.2 * pulse * (0.4 + 0.6 * d)})`; c.fillRect(-W, -H, W * 3, H * 3);
  c.restore();
  /* ---- your helmet: dark at the edges, a faint reflection ---- */
  const vg = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.8)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  /* fading in at the start */
  if (t < 0.8){ c.fillStyle = `rgba(0,0,0,${1 - t / 0.8})`; c.fillRect(0, 0, W, H); }
  /* the flash */
  if (flashK > 0){ c.fillStyle = `rgba(255,250,240,${flashK})`; c.fillRect(0, 0, W, H); }
}

/* The windscreen: wide, a little wedge-shaped, over the dash. */
function windscreen(c, W, H){
  c.moveTo(W * 0.04, H * 0.66); c.lineTo(W * 0.12, H * 0.06); c.lineTo(W * 0.88, H * 0.06); c.lineTo(W * 0.96, H * 0.66); c.closePath();
}
function frame(c, W, H, t, d){
  c.save();
  c.fillStyle = '#1b2033';
  c.beginPath(); c.rect(-W, -H, W * 3, H * 3); windscreen(c, W, H); c.fill('evenodd');
  /* the struts down the middle and the frame's edge */
  c.strokeStyle = '#2c3350'; c.lineWidth = H * 0.025; c.beginPath(); windscreen(c, W, H); c.stroke();
  c.fillStyle = '#232a44'; c.beginPath(); c.moveTo(W * 0.49, H * 0.06); c.lineTo(W * 0.51, H * 0.06); c.lineTo(W * 0.525, H * 0.66); c.lineTo(W * 0.475, H * 0.66); c.closePath(); c.fill();
  /* a crack spreading across the glass, near the end */
  const cr = ramp(t, 4.6, 6.2);
  if (cr > 0){
    c.strokeStyle = 'rgba(230,240,255,.7)'; c.lineWidth = 1.5;
    const ox = W * 0.7, oy = H * 0.25;
    for (let k = 0; k < 7; k++){ const a = k * 0.9 + 0.3, len = H * (0.06 + (k % 3) * 0.05) * cr; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(a) * len * 0.5, oy + Math.sin(a) * len * 0.5 + 3); c.lineTo(ox + Math.cos(a) * len, oy + Math.sin(a) * len); c.stroke(); }
  }
  /* the warning lights along the top, flashing */
  for (let k = 0; k < 5; k++){
    const on = Math.floor(t * 4 + k) % 2 === 0;
    c.fillStyle = on ? '#ff3b3b' : '#4a1418'; c.beginPath(); c.arc(W * (0.3 + k * 0.1), H * 0.03, H * 0.009, 0, 6.2832); c.fill();
  }
  c.restore();
}
function dashboard(c, W, H, t, d){
  c.save();
  /* the dash itself, curving across the bottom */
  const dg = c.createLinearGradient(0, H * 0.62, 0, H);
  dg.addColorStop(0, '#2e3656'); dg.addColorStop(1, '#141828');
  c.fillStyle = dg; c.beginPath(); c.moveTo(-W * 0.1, H * 0.7); c.quadraticCurveTo(W / 2, H * 0.58, W * 1.1, H * 0.7); c.lineTo(W * 1.1, H * 1.2); c.lineTo(-W * 0.1, H * 1.2); c.closePath(); c.fill();
  /* the screens: a horizon ball rolling, the height falling, WARNING */
  const scr = (x, y, w, h) => { c.fillStyle = '#081024'; c.beginPath(); c.roundRect(x, y, w, h, h * 0.12); c.fill(); c.strokeStyle = '#3d4a78'; c.lineWidth = 2; c.stroke(); };
  /* the horizon ball */
  const bx = W * 0.3, by = H * 0.8, br = H * 0.075, roll = Math.sin(t * 0.9) * 0.25 + d * 0.55;
  scr(bx - br * 1.3, by - br * 1.3, br * 2.6, br * 2.6);
  c.save(); c.beginPath(); c.arc(bx, by, br, 0, 6.2832); c.clip();
  c.translate(bx, by); c.rotate(roll); c.fillStyle = '#3d7dd8'; c.fillRect(-br, -br, br * 2, br * 2); c.fillStyle = '#7a5530'; c.fillRect(-br, -br * d * 0.9, br * 2, br * 2);
  c.restore();
  c.strokeStyle = '#ffd24a'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx - br * 0.5, by); c.lineTo(bx + br * 0.5, by); c.stroke();
  /* the height, falling */
  const hx = W * 0.5, hy = H * 0.8, alt = Math.max(0, Math.round(9000 * (1 - d) / 10) * 10);
  scr(hx - H * 0.12, hy - H * 0.07, H * 0.24, H * 0.14);
  c.font = `700 ${Math.round(H * 0.022)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#7ff3ff'; c.fillText('HEIGHT', hx, hy - H * 0.035);
  c.font = `700 ${Math.round(H * 0.045)}px Fredoka, sans-serif`; c.fillStyle = d > 0.6 ? '#ff6b6b' : '#7ff3ff'; c.fillText(String(alt), hx, hy + H * 0.02);
  /* WARNING, flashing */
  const wx = W * 0.7, wy = H * 0.8, on = Math.floor(t * 3.2) % 2 === 0;
  scr(wx - H * 0.12, wy - H * 0.07, H * 0.24, H * 0.14);
  if (on){ c.fillStyle = '#ff3b3b'; c.font = `700 ${Math.round(H * 0.034)}px Fredoka, sans-serif`; c.fillText('WARNING', wx, wy); }
  /* rows of little buttons, blinking */
  for (let k = 0; k < 14; k++){
    const x = W * (0.12 + k * 0.055), y = H * (k % 2 ? 0.93 : 0.95), lit = ((k * 7 + Math.floor(t * 6)) % 5) < 2;
    c.fillStyle = lit ? (k % 3 ? '#ffd24a' : '#ff6b6b') : '#2a3150'; c.beginPath(); c.roundRect(x, y, H * 0.025, H * 0.016, 3); c.fill();
  }
  /* sparks, now and then, from under the dash */
  if (d > 0.35) for (let k = 0; k < 6; k++){
    const u = (t * 2.4 + k * 0.17) % 1, x = W * (0.2 + (k * 0.13) % 0.6) + u * W * 0.03 * (k % 2 ? 1 : -1), y = H * 0.7 - u * H * 0.08 + u * u * H * 0.2;
    c.fillStyle = `rgba(255,${200 - u * 120},80,${1 - u})`; c.beginPath(); c.arc(x, y, H * 0.004, 0, 6.2832); c.fill();
  }
  c.restore();
}
/* A little cube charm hanging from the ceiling on its string, swinging. */
function charm(c, W, H, t, d){
  const ax = W * 0.62, ay = -H * 0.02, len = H * 0.26, a = Math.sin(t * (2.2 + d * 2)) * (0.3 + d * 0.7) + d * 0.3;
  const x = ax + Math.sin(a) * len, y = ay + Math.cos(a) * len, s = H * 0.035;
  c.save();
  c.strokeStyle = '#c9d4e6'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, ay); c.lineTo(x, y); c.stroke();
  c.translate(x, y + s * 0.6); c.rotate(-a * 1.4);
  c.fillStyle = '#ffd24a'; c.beginPath(); c.roundRect(-s / 2, -s / 2, s, s, s * 0.22); c.fill();
  c.fillStyle = '#05060f'; for (const e of [-1, 1]){ c.beginPath(); c.arc(e * s * 0.18, -s * 0.05, s * 0.07, 0, 6.2832); c.fill(); }
  c.strokeStyle = '#05060f'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, s * 0.08, s * 0.14, 0.2, Math.PI - 0.2); c.stroke();
  c.restore();
}

/* What you hear: the ship's rumble building, the klaxon, the alarm pips
   climbing; then the thump - and quiet. */
export function cockpitSound(t, dt, state){
  const d = dive(t);
  if (!state.rumble && t > 0.1){ state.rumble = true; sfx.crashRumble?.(); }
  if (t < FLASH){
    state.klax = (state.klax ?? 0.4) - dt;
    if (state.klax <= 0){ state.klax = 1.25; sfx.klaxon?.(); }
    state.pip = (state.pip ?? 0) - dt;
    if (state.pip <= 0 && d > 0.3){ state.pip = 0.5 - d * 0.3; sfx.alarm?.(d); }
    if (Math.random() < dt * (0.6 + 2 * d)) sfx.clank?.();
  }
  if (!state.hit && t > FLASH){ state.hit = true; sfx.crashImpact?.(); }
}
