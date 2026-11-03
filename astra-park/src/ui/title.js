/* The front door: the park at dusk, the name, and a little friend standing in
   the meadow, waving. Wave back to come in.

   There is no button to aim at. A wave is the most natural thing a child does
   at someone waving to them, and it reads from across a room - no reading, no
   holding still over a target. As they wave, fireflies gather around the
   friend one by one; when the ring is full it jumps for joy and in we go. With
   no camera, wiggling the mouse works too, and so do a click or Enter, for the
   grown-up at the laptop.

   The two things a parent needs - is the camera working, and where are the
   settings - stay small in the corners. */
import { pose, MAX_PLAYERS } from '../tracking/pose.js';
import { WaveWatch, handsFrom } from '../tracking/wave.js';
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { drawPark, glow, hillTop, MEADOW } from './backdrop.js';
import { Avatars } from './avatars.js';
import { friend, FRIEND_X } from './friend.js';
import { sfx } from '../audio/sound.js';

const RING = 8;          /* fireflies around the friend when the wave is done */
const JOY = 1.2;         /* seconds of celebrating before the menu */

const STAR = '<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-10Q1.3-1.3 10 0Q1.3 1.3 0 10Q-1.3 1.3-10 0Q-1.3-1.3 0-10Z"/></svg>';

/* The name, set soft and warm, with the evening star over it. */
export function logo(cls = ''){
  return h('div', 'logo ' + cls, `<span>Astra</span><span class="star">${STAR}</span><span>Park</span>`);
}

export function title({ onPlay, onSettings, t0 = 0 }){
  clearUI();
  const s = screen('title');
  s.appendChild(logo());

  /* Corner furniture. Small, far from the middle, and deliberately awkward to
     hit - which is the point, because a four-year-old waving hello should
     never land in Settings. */
  const gear = onPick(button('⚙', 'corner'), () => onSettings());
  gear.setAttribute('aria-label', 'Settings');
  s.appendChild(gear);

  /* A dot, not a sentence. "Is it working" is a yes/no question and deserves a
     yes/no answer that reads from the sofa. */
  const status = h('div', 'camstatus');
  const dot = h('span', 'dot');
  status.append(dot, h('span', 'txt', ''));
  s.appendChild(status);

  /* Defined by build-single.mjs; absent when running from the dev server. */
  s.appendChild(h('div', 'buildstamp', typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'));

  const wave = new WaveWatch();
  const avatars = new Avatars();
  const glints = [];
  /* The clock carries on from the boot show, so the park doesn't jump. */
  let t = t0, joy = 0;

  const finish = () => {
    if (joy) return;
    wave.done = true; wave.meter = 1; joy = 0.0001;
    sfx.lantern();
  };
  /* For the grown-up: a click anywhere but the gear, or Enter or Space. */
  s.addEventListener('click', (e) => { if (!e.target.closest || !e.target.closest('.btn')) finish(); });
  const key = (e) => {
    if (!s.isConnected){ removeEventListener('keydown', key); return; }
    if (e.key === 'Enter' || e.key === ' ') finish();
  };
  addEventListener('keydown', key);

  return {
    wave,
    tick(dt){
      t += dt;
      const ok = pose.usingCamera && pose.ready;
      const seen = pose.personCount;
      dot.style.background = ok ? (seen ? 'var(--good)' : 'var(--gold)') : 'var(--bad)';
      status.querySelector('.txt').textContent =
        !ok ? 'No camera — mouse plays'
            : seen === 2 ? 'Two players' : seen === 1 ? 'One player' : 'Step into view';

      avatars.step(dt, 2);
      if (joy){
        joy += dt;
        if (joy >= JOY){ removeEventListener('keydown', key); onPlay(); }
      } else {
        const turned = wave.step(dt, handsFrom(pose));
        if (turned){
          sfx.firefly(wave.turns);
          const at = wave.last;
          for (let k = 0; k < 7; k++){
            const a = Math.random() * 6.28, sp = 0.05 + Math.random() * 0.08;
            glints.push({ x: at.x, y: at.y, vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp - 0.04, age: 0 });
          }
        }
        if (wave.done) finish();
      }
      for (const g of glints){ g.age += dt; g.x += g.vx * dt; g.y += g.vy * dt; }
      while (glints.length && glints[0].age > 0.9) glints.shift();
    },

    draw(c, W, H){
      drawPark(c, W, H, t);
      /* The children, faintly, standing in the meadow: proof the park can
         see them before they've done anything. */
      avatars.drawBodies(c, W, H, MAX_PLAYERS, [], 0.16);

      const mx = W * FRIEND_X, ground = H * (hillTop(FRIEND_X, MEADOW.y, MEADOW.h, MEADOW.n) + 0.035);
      const hop = joy ? Math.abs(Math.sin(joy * 7.5)) * H * 0.05 * (1 - joy / JOY) : 0;
      friend(c, mx, ground - hop, H, t, joy > 0);

      /* The ring of fireflies, one for each part of the wave so far. When the
         wave is done they spiral up and away. */
      const cx = mx, cy = ground - H * 0.08, R = H * 0.15;
      for (let k = 0; k < RING; k++){
        const lit = Math.max(0, Math.min(1, wave.meter * RING - k));
        if (lit <= 0) continue;
        const a = -Math.PI / 2 + (k / RING) * 6.2832 + t * 0.4 + joy * 4;
        const r = R * (1 + joy * 2), lift = joy * joy * H * 0.5;
        /* Golden and bigger than the meadow's fireflies, so they read as
           the wave being answered rather than more of the scenery. */
        glow(c, cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 0.8 - lift, H * 0.015,
             lit * (0.85 + 0.15 * Math.sin(t * 5 + k)), '255,214,110');
      }
      for (const g of glints) glow(c, g.x * W, g.y * H, H * 0.006, 1 - g.age / 0.9, '255,214,110');

      /* A hand, waving: the only instruction on the screen. It steps back
         once someone has started. */
      if (!joy) hand(c, W * 0.565, H * 0.66, H, t, 1 - wave.meter * 0.6);
    }
  };
}

/* An open hand rocking side to side, with a little swish either side. */
function hand(c, x, y, H, t, alpha){
  const u = H / 900, a = Math.sin(t * 6) * 0.4;
  c.save(); c.globalAlpha = alpha;
  glow(c, x, y - 10 * u, H * 0.02, 0.35, '255,230,180');
  c.translate(x, y + 30 * u); c.rotate(a);
  c.fillStyle = '#fff1d8';
  c.strokeStyle = '#fff1d8'; c.lineCap = 'round';
  c.beginPath(); c.roundRect(-20 * u, -46 * u, 40 * u, 42 * u, 14 * u); c.fill();
  c.lineWidth = 11 * u;
  [[-14, 30], [-4.5, 36], [5, 34], [14, 27]].forEach(([fx, len]) => {
    c.beginPath(); c.moveTo(fx * u, -40 * u); c.lineTo(fx * u, (-40 - len) * u); c.stroke();
  });
  c.beginPath(); c.moveTo(-16 * u, -20 * u); c.lineTo(-34 * u, -40 * u); c.stroke();
  c.restore();
  /* The swish marks stay put while the hand rocks between them. */
  c.save(); c.globalAlpha = alpha * 0.7;
  c.strokeStyle = '#fff1d8'; c.lineWidth = 4 * u; c.lineCap = 'round';
  for (const side of [-1, 1]){
    c.beginPath(); c.arc(x, y + 30 * u, 100 * u, -Math.PI / 2 + side * 0.62 - 0.14, -Math.PI / 2 + side * 0.62 + 0.14); c.stroke();
    c.beginPath(); c.arc(x, y + 30 * u, 116 * u, -Math.PI / 2 + side * 0.62 - 0.1, -Math.PI / 2 + side * 0.62 + 0.1); c.stroke();
  }
  c.restore();
}
