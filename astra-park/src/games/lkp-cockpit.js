/* Last Known Position, the very first seconds: inside your helmet as the
   ship comes down. All you really see is the visor - its display booting
   up, warnings coming up, the height falling, then BRACE, pulsing - and
   beyond the glass a blur of fire, sky and the green ground rolling up.
   Red light flashing, everything shaking, Nova on the radio; then a white
   flash, a thump, and black. Disorienting, but plain what's happening:
   the ship is crashing.

   cockpit(c, W, H, t): drawn at t seconds in (0..CRASH). */
import { sfx } from '../audio/sound.js';

export const CRASH = 8.5;
/* The flash, and the cut to black after it (seconds in). */
export const FLASH = 7.4;
/* When the visor's warning turns to BRACE. */
export const BRACE = 3.4;
const ramp = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/* How bad it is, 0..1, over the dive. */
const dive = (t) => Math.pow(ramp(t, 0.3, FLASH), 1.3);
/* A shake that's the same each time it's drawn at the same moment. */
const shake = (t, k) => [Math.sin(t * 37) * 0.6 + Math.sin(t * 61 + 1) * 0.4, Math.sin(t * 43 + 2) * 0.6 + Math.sin(t * 71) * 0.4].map(v => v * k);
const HUD = '127,243,255', WARN = '255,77,77', AMBER = '255,200,80';
const FONT = (px, w = 700) => `${w} ${Math.round(px)}px Fredoka, sans-serif`;

/* An offscreen canvas for the blurred view outside (drawn small, stretched). */
let buf = null;
function bufOf(w, h){
  if (typeof document === 'undefined') return null;
  if (!buf){ buf = document.createElement('canvas'); if (!buf.getContext || !buf.getContext('2d')) return (buf = null); }
  if (buf.width !== w || buf.height !== h){ buf.width = w; buf.height = h; }
  return buf;
}

export function cockpit(c, W, H, t){
  const d = dive(t), flashK = ramp(t, FLASH - 0.15, FLASH);
  c.save();
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  if (t > FLASH + 0.12){ c.restore(); return; }
  /* ---- beyond the glass: blurred, rolling, burning ---- */
  const [sx, sy] = shake(t, H * (0.006 + 0.03 * d));
  const small = bufOf(Math.max(1, Math.round(W / 12)), Math.max(1, Math.round(H / 12)));
  if (small){
    const b = small.getContext('2d'); b.setTransform(small.width / W, 0, 0, small.height / H, 0, 0);
    outside(b, W, H, t, d); b.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = true; c.drawImage(small, sx - W * 0.03, sy - H * 0.03, W * 1.06, H * 1.06);
  } else { c.save(); c.translate(sx, sy); outside(c, W, H, t, d); c.restore(); }
  /* the alarm light, washing it red */
  const pulse = Math.max(0, Math.sin(t * Math.PI * 1.6));
  c.fillStyle = `rgba(255,30,40,${0.06 + 0.2 * pulse * (0.4 + 0.6 * d)})`; c.fillRect(0, 0, W, H);
  /* ---- the visor display: moves a little less than the world ---- */
  c.save(); c.translate(sx * 0.35, sy * 0.35);
  visor(c, W, H, t, d);
  c.restore();
  /* ---- the helmet: the dark rim of the visor, a gleam on the glass ---- */
  helmet(c, W, H, t, d);
  /* fading in at the start; the flash at the end */
  if (t < 0.8){ c.fillStyle = `rgba(0,0,0,${1 - t / 0.8})`; c.fillRect(0, 0, W, H); }
  if (flashK > 0){ c.fillStyle = `rgba(255,250,240,${flashK})`; c.fillRect(0, 0, W, H); }
  c.restore();
}

/* Outside: the sky rolling over, the ground coming up, fire streaming past. */
function outside(c, W, H, t, d){
  const roll = Math.sin(t * 0.9) * 0.3 + d * 0.6, horizon = H * (0.45 - 0.55 * d);
  c.save();
  c.translate(W / 2, H / 2); c.rotate(roll); c.translate(-W / 2, -H / 2);
  const sky = c.createLinearGradient(0, horizon - H, 0, horizon);
  sky.addColorStop(0, '#1a1240'); sky.addColorStop(0.6, '#7a4c9a'); sky.addColorStop(1, '#ffb38a');
  c.fillStyle = sky; c.fillRect(-W, horizon - H * 2, W * 3, H * 2);
  const gr = c.createLinearGradient(0, horizon, 0, horizon + H);
  gr.addColorStop(0, '#6fb878'); gr.addColorStop(1, '#1f4a30');
  c.fillStyle = gr; c.fillRect(-W, horizon, W * 3, H * 3);
  const near = 1 + d * 4;
  c.fillStyle = 'rgba(30,70,45,.55)';
  for (let k = -4; k <= 4; k++){ c.beginPath(); c.ellipse(W / 2 + k * W * 0.25 * near, horizon + H * 0.06 * near, W * 0.14 * near, H * 0.03 * near, 0, 0, 6.2832); c.fill(); }
  c.restore();
  /* fire: the heat of coming in, strongest early on, streaming up */
  const fire = 0.25 + 0.75 * (1 - ramp(t, 1, 5));
  const fg = c.createLinearGradient(0, H, 0, 0);
  fg.addColorStop(0, `rgba(255,130,40,${0.65 * fire})`); fg.addColorStop(0.5, `rgba(255,200,110,${0.25 * fire})`); fg.addColorStop(1, 'rgba(255,200,110,0)');
  c.fillStyle = fg; c.fillRect(0, 0, W, H);
  for (let k = 0; k < 16; k++){
    const sp = 0.6 + d * 2, u = (k * 0.37 + t * sp * (0.7 + (k % 3) * 0.25)) % 1;
    const x = W * ((k * 0.29) % 1) * 1.2 - W * 0.1, y = H * (1.15 - u * 1.4);
    c.fillStyle = `rgba(255,${200 + (k % 3) * 20},150,${0.5 * Math.sin(u * Math.PI)})`;
    c.beginPath(); c.ellipse(x, y, W * 0.008, H * (0.06 + 0.08 * d), 0.2 * Math.sin(t + k), 0, 6.2832); c.fill();
  }
}

/* The visor's display: booting up, then warnings, the height falling,
   then BRACE. */
function visor(c, W, H, t, d){
  const boot = ramp(t, 0.6, 1.4), cx = W / 2, cy = H * 0.5, R = H * 0.28;
  if (boot <= 0) return;
  const flick = boot < 1 ? (Math.sin(t * 60) > 0 ? 1 : 0.4) : 1;
  c.save(); c.globalAlpha = boot * flick;
  c.textBaseline = 'middle';
  /* the two brackets round the middle, and the pointers either side */
  const brace = t > BRACE, beat = brace ? 0.5 + 0.5 * Math.sin((t - BRACE) * Math.PI * 3.2) : 0;
  const col = brace ? WARN : HUD;
  c.strokeStyle = `rgba(${col},.85)`; c.lineWidth = Math.max(2, H * 0.005); c.lineCap = 'round';
  const rr = R * (1 + 0.04 * beat);
  c.beginPath(); c.arc(cx, cy, rr, -0.6, 0.6); c.stroke();
  c.beginPath(); c.arc(cx, cy, rr, Math.PI - 0.6, Math.PI + 0.6); c.stroke();
  c.fillStyle = `rgba(${col},.85)`;
  for (const s of [-1, 1]){
    const px = cx + s * (rr + H * 0.12 + beat * H * 0.02);
    c.beginPath(); c.moveTo(px, cy); c.lineTo(px - s * H * 0.055, cy - H * 0.035); c.lineTo(px - s * H * 0.055, cy + H * 0.035); c.closePath(); c.fill();
  }
  /* a horizon line in the middle, tilting with the ship */
  if (!brace){
  c.save(); c.translate(cx, cy); c.rotate(Math.sin(t * 0.9) * 0.3 + d * 0.6);
  c.strokeStyle = `rgba(${HUD},.45)`; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-R * 0.75, 0); c.lineTo(-R * 0.2, 0); c.moveTo(R * 0.2, 0); c.lineTo(R * 0.75, 0); c.stroke();
  c.restore();
  }
  /* the readouts down each side */
  const L = W * 0.2, Rt = W * 0.8, top = H * 0.28, gap = H * 0.055;
  c.font = FONT(H * 0.03); c.textAlign = 'left';
  c.fillStyle = `rgba(${HUD},.9)`; c.fillText('SUIT  OK', L, top);
  c.fillText(`AIR  ${98 - Math.floor(d * 2)}%`, L, top + gap);
  c.fillStyle = `rgba(${AMBER},.9)`; c.fillText('ENGINE  ' + (t > 1.6 ? 'OFF' : 'OK'), L, top + gap * 2);
  c.textAlign = 'right';
  const alt = Math.max(0, Math.round(9000 * (1 - d) / 10) * 10);
  c.fillStyle = `rgba(${d > 0.55 ? WARN : HUD},.95)`; c.fillText(`HEIGHT  ${alt}`, Rt, top);
  c.fillStyle = `rgba(${WARN},.9)`; c.fillText('SPEED  FAST', Rt, top + gap);
  /* the height bar, emptying */
  c.strokeStyle = `rgba(${HUD},.6)`; c.lineWidth = 2; c.strokeRect(Rt - W * 0.012, top + gap * 1.7, W * 0.012, H * 0.25);
  c.fillStyle = `rgba(${d > 0.55 ? WARN : HUD},.8)`; const bh = H * 0.25 * (1 - d); c.fillRect(Rt - W * 0.012, top + gap * 1.7 + H * 0.25 - bh, W * 0.012, bh);
  /* the middle: WARNING, then BRACE, big and pulsing */
  c.textAlign = 'center';
  if (!brace){
    if (t > 1.4 && Math.floor(t * 3) % 2 === 0){ c.font = FONT(H * 0.075); c.fillStyle = `rgba(${AMBER},.95)`; c.fillText('WARNING', cx, cy); }
    if (t > 1.8){ c.font = FONT(H * 0.03, 600); c.fillStyle = `rgba(${HUD},.9)`; c.fillText('LOSING HEIGHT', cx, cy + H * 0.075); }
  } else {
    c.save(); c.translate(cx, cy); c.scale(1 + 0.06 * beat, 1 + 0.06 * beat);
    c.font = FONT(H * 0.13); c.fillStyle = `rgba(${WARN},${0.75 + 0.25 * beat})`; c.fillText('BRACE', 0, 0);
    c.restore();
    c.font = FONT(H * 0.04, 600); c.fillStyle = `rgba(${HUD},.95)`; c.fillText('HOLD ON TIGHT', cx, cy + H * 0.1);
  }
  c.restore();
}

/* The helmet round the visor: dark at the edges, a gleam across the
   glass, and late on a little crack. */
function helmet(c, W, H, t, d){
  const g = c.createRadialGradient(W / 2, H * 0.55, H * 0.42, W / 2, H * 0.55, W * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.82, 'rgba(0,0,0,.88)'); g.addColorStop(1, '#000');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = H * 0.025; c.lineCap = 'round';
  c.beginPath(); c.ellipse(W / 2, H * 0.55, W * 0.5, H * 0.62, 0, Math.PI * 1.1, Math.PI * 1.42); c.stroke();
  const cr = ramp(t, 5, 6.2);
  if (cr > 0){
    c.strokeStyle = 'rgba(235,245,255,.75)'; c.lineWidth = 1.5;
    const ox = W * 0.78, oy = H * 0.2;
    for (let k = 0; k < 7; k++){ const a = k * 0.9 + 0.3, len = H * (0.05 + (k % 3) * 0.04) * cr; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(a) * len * 0.5, oy + Math.sin(a) * len * 0.5 + 3); c.lineTo(ox + Math.cos(a) * len, oy + Math.sin(a) * len); c.stroke(); }
  }
}

/* What you hear: the ship's rumble building, the klaxon, the alarm pips
   climbing, a ping as the visor boots and each warning comes up; then
   the thump - and quiet. */
export function cockpitSound(t, dt, state){
  const d = dive(t);
  if (!state.rumble && t > 0.1){ state.rumble = true; sfx.crashRumble?.(); }
  if (!state.boot && t > 0.6){ state.boot = true; sfx.visorOn?.(); }
  if (!state.brace && t > BRACE){ state.brace = true; sfx.alert?.(); }
  if (t < FLASH){
    state.klax = (state.klax ?? 0.4) - dt;
    if (state.klax <= 0){ state.klax = 1.25; sfx.klaxon?.(); }
    state.pip = (state.pip ?? 0) - dt;
    if (state.pip <= 0 && d > 0.3){ state.pip = 0.5 - d * 0.3; sfx.alarm?.(d); }
    if (Math.random() < dt * (0.6 + 2 * d)) sfx.clank?.();
  }
  if (!state.hit && t > FLASH){ state.hit = true; sfx.crashImpact?.(); }
}
