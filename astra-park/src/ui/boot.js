/* The console turning on - and turning, without a seam, into the front
   door. It's the same park, the same name in the same place, on the same
   clock: the park comes up out of the night, four little figures in the
   players' colours run in across the meadow from both sides, jump and land
   with their arms up as the name blooms in over them, to the boot chime;
   then they scamper off as the little friend pops up to wave - and that's
   the wave-to-start screen, already there. A couple of seconds, the same
   every time.

   The camera starts underneath it all; if it's slower than the show, the
   last frame waits with a quiet "starting the camera" under it. A click or
   a key skips it. */
import { PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { drawPark, hillTop, MEADOW } from './backdrop.js';
import { friend, FRIEND_X } from './friend.js';
import { screen, h, clearUI } from './screens.js';
import { logo } from './title.js';

export const BOOT = 3;             /* seconds, start to finish */
const CHIME = 0.35, LAND = 1.25, OFF = 2.1, POP = 2.3;

export function boot(){
  clearUI();
  /* The name: the title screen's own, where it will be, blooming in. */
  const s = screen('title boot');
  s.appendChild(logo('bloom'));
  const wait = h('p', 'lede bootwait', 'Starting the camera…');
  s.appendChild(wait);

  let t = 0, chimed = false, skip = false;
  const end = () => { skip = true; };
  addEventListener('keydown', end, { once: true });
  addEventListener('pointerdown', end, { once: true });
  return {
    waiting: false,
    get t(){ return t; },
    get done(){ return skip || t >= BOOT; },
    tick(dt){
      t += dt;
      if (!chimed && t >= CHIME){ chimed = true; sfx.boot(); }
      wait.classList.toggle('show', this.waiting);
    },
    draw(c, W, H){
      drawPark(c, W, H, t);
      /* Out of the night: a dark veil lifting off the park. */
      const veil = 1 - clamp((t - 0.1) / 1.7);
      if (veil > 0){ c.fillStyle = `rgba(9,8,24,${0.92 * veil})`; c.fillRect(0, 0, W, H); }
      /* The four, across the meadow: in from both sides, a jump, a row
         with their arms up - then off again either way. */
      PLAYER_COLORS.forEach((col, i) => {
        const side = i < 2 ? -1 : 1, from = side < 0 ? -0.08 : 1.08, to = 0.44 + (i - 1.5) * 0.075;
        const k = clamp(t / LAND), e = 1 - Math.pow(1 - k, 2), away = clamp((t - OFF) / 0.6);
        const x = (from + (to - from) * e + side * away * away * 0.75) * W;
        const ground = H * (hillTop(x / W, MEADOW.y, MEADOW.h, MEADOW.n) + 0.035);
        const hop = k < 1 ? Math.sin(clamp((t - 0.6) / (LAND - 0.6)) * Math.PI) * H * 0.16
                  : away > 0 ? Math.abs(Math.sin(t * 12)) * H * 0.015 : Math.abs(Math.sin((t - LAND) * 6)) * H * 0.012;
        figure(c, x, ground - hop, H * 0.075, col, k >= 1 && away <= 0 ? 1 : 0, t * 14 + i, away > 0 ? side : -side);
      });
      /* The friend pops up where it waits on the front door. */
      const p = clamp((t - POP) / 0.35);
      if (p > 0){
        const ground = H * (hillTop(FRIEND_X, MEADOW.y, MEADOW.h, MEADOW.n) + 0.035);
        c.save();
        c.translate(W * FRIEND_X, ground); c.scale(pop(p), pop(p)); c.translate(-W * FRIEND_X, -ground);
        friend(c, W * FRIEND_X, ground, H, t, false);
        c.restore();
      }
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
/* Up from nothing with a little overshoot. */
const pop = (p) => p >= 1 ? 1 : 0.2 + 0.8 * p + Math.sin(p * Math.PI) * 0.18;
