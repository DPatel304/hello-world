/* The console turning on - and turning, without a seam, into the front
   door. It's the same park, the same name in the same place, on the same
   clock: the park comes up out of the night and the name blooms in over
   it, to the boot chime; then the little friend pops up to wave - and
   that's the wave-to-start screen, already there. A couple of seconds, the same
   every time.

   The camera starts underneath it all; if it's slower than the show, the
   last frame waits with a quiet "starting the camera" under it. A click or
   a key skips it. */
import { sfx } from '../audio/sound.js';
import { drawPark, hillTop, MEADOW } from './backdrop.js';
import { friend, FRIEND_X } from './friend.js';
import { screen, h, clearUI } from './screens.js';
import { logo } from './title.js';

export const BOOT = 3;             /* seconds, start to finish */
const CHIME = 0.35, POP = 2.1;

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

const clamp = (v) => Math.max(0, Math.min(1, v));
/* Up from nothing with a little overshoot. */
const pop = (p) => p >= 1 ? 1 : 0.2 + 0.8 * p + Math.sin(p * Math.PI) * 0.18;
