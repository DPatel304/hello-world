/* The console turning on. Two or three seconds, the same every time, so it
   becomes the feeling of Astra Park starting: a dark sky, four little
   figures in the players' colours running in from both sides, a jump, and
   as they land in a row with their arms up, the name blooms in over them
   with its star - to the boot chime. Then on to the front door.

   The camera starts underneath it all; if it's slower than the show, the
   last frame waits with a quiet "starting the camera" under it. A click or
   a key skips it. */
import { PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { glow } from './backdrop.js';

export const BOOT = 2.8;           /* seconds, start to finish */
const CHIME = 0.35, LAND = 1.25, NAME = 1.15;

export function boot(){
  let t = 0, chimed = false, skip = false;
  const stars = Array.from({ length: 60 }, (_, i) => ({ x: ((i * 0.6180339) % 1), y: ((i * 0.3819660 + 0.13) % 1) * 0.7, ph: i * 1.7 }));
  const end = () => { skip = true; };
  addEventListener('keydown', end, { once: true });
  addEventListener('pointerdown', end, { once: true });
  return {
    waiting: false,
    get done(){ return skip || t >= BOOT; },
    tick(dt){
      t += dt;
      if (!chimed && t >= CHIME){ chimed = true; sfx.boot(); }
    },
    draw(c, W, H){
      const u = H / 900;
      /* Night sky, a soft glow rising where the name will be. */
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0b0a1f'); sky.addColorStop(1, '#2a1f4a');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const rise = clamp((t - 0.2) / 1.2);
      const g = c.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, H * 0.7);
      g.addColorStop(0, `rgba(255,170,120,${0.35 * rise})`); g.addColorStop(1, 'rgba(255,170,120,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (const s of stars){
        const a = clamp(t * 1.5 - s.y) * (0.5 + 0.5 * Math.sin(t * 3 + s.ph));
        c.fillStyle = `rgba(255,246,226,${a * 0.8})`; c.beginPath(); c.arc(s.x * W, s.y * H, 1.3 * u, 0, 6.2832); c.fill();
      }
      /* The four, running in from both sides, jumping, landing in a row. */
      const ground = H * 0.7;
      PLAYER_COLORS.forEach((col, i) => {
        const from = i < 2 ? -0.15 : 1.15, to = 0.5 + (i - 1.5) * 0.09;
        const k = clamp(t / LAND), e = 1 - Math.pow(1 - k, 2);
        const x = (from + (to - from) * e) * W;
        const hop = k < 1 ? Math.sin(clamp((t - 0.6) / (LAND - 0.6)) * Math.PI) * H * 0.18 : Math.abs(Math.sin((t - LAND) * 6)) * H * 0.012 * Math.max(0, 1 - (t - LAND));
        figure(c, x, ground - hop, H * 0.085, col, k >= 1 ? 1 : 0, t * 14 + i, i < 2 ? 1 : -1);
      });
      /* The name blooms in. */
      const n = clamp((t - NAME) / 0.6), pop = n < 1 ? 0.7 + 0.3 * Math.sin(n * Math.PI / 2) + Math.sin(n * Math.PI) * 0.08 : 1;
      if (n > 0){
        c.save();
        c.globalAlpha = n;
        c.translate(W / 2, H * 0.4); c.scale(pop, pop);
        c.font = `600 ${Math.round(H * 0.15)}px Fredoka, ui-rounded, "Segoe UI", sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.shadowColor = 'rgba(255,196,140,.7)'; c.shadowBlur = H * 0.04;
        c.fillStyle = '#fff6e2';
        c.fillText('Astra Park', 0, 0);
        c.restore();
        /* The evening star, over the middle. */
        glow(c, W / 2, H * 0.4 - H * 0.1, H * 0.03 * n, n * (0.8 + 0.2 * Math.sin(t * 6)), '255,233,168');
      }
      if (this.waiting && t > BOOT){
        c.save(); c.globalAlpha = 0.6 + 0.3 * Math.sin(t * 3);
        c.font = `500 ${Math.round(H * 0.028)}px Fredoka, ui-rounded, sans-serif`; c.textAlign = 'center';
        c.fillStyle = '#fff6e2'; c.fillText('Starting the camera…', W / 2, H * 0.86);
        c.restore();
      }
      /* The last moment: a fade, into the front door. */
      const out = clamp((t - (BOOT - 0.35)) / 0.35);
      if (out > 0 && !this.waiting){ c.fillStyle = `rgba(13,11,26,${out})`; c.fillRect(0, 0, W, H); }
    }
  };
}

/* A little running figure: a round head and a body in their colour, legs
   going, arms up once they've landed. */
function figure(c, x, y, s, col, cheer, ph, dir){
  const leg = Math.sin(ph) * s * 0.25 * (1 - cheer);
  c.save();
  c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = s * 0.16;
  c.beginPath(); c.moveTo(x, y - s * 0.45); c.lineTo(x - leg * dir, y); c.moveTo(x, y - s * 0.45); c.lineTo(x + leg * dir, y); c.stroke();
  c.beginPath(); c.moveTo(x, y - s * 0.45); c.lineTo(x, y - s * 0.95); c.stroke();
  const arm = cheer ? -1 : Math.sin(ph + 1.5) * 0.5;
  c.beginPath(); c.moveTo(x, y - s * 0.85); c.lineTo(x - s * 0.32, y - s * (0.85 - 0.35 * arm)); c.moveTo(x, y - s * 0.85); c.lineTo(x + s * 0.32, y - s * (0.85 - 0.35 * (cheer ? -1 : -arm))); c.stroke();
  c.fillStyle = '#fff6e2'; c.beginPath(); c.arc(x, y - s * 1.15, s * 0.2, 0, 6.2832); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(x, y - s * 1.15, s * 0.2, Math.PI, 0); c.fill();
  c.restore();
}

const clamp = (v) => Math.max(0, Math.min(1, v));
