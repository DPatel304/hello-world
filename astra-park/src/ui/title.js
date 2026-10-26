/* The front door. Everything here is sized and placed for a hand at three
   metres rather than a mouse at thirty centimetres: one enormous target,
   nothing crowding it, and the two things a parent needs to know - is the
   camera working, and where are the settings - pushed to the corners where a
   drifting hand will not catch them by accident. */
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { drawPark } from './backdrop.js';

const LETTER = ['#ffd24a','#ff6b9d','#4ad6d6','#ff9f45','#b06bff',
                '#53e59a','#4aa8ff','#ff6b9d','#ffd24a'];

/* Per-letter colour and a staggered bob. Spaces keep their width but skip the
   animation, or the two words drift apart. */
export function wordmark(text){
  const w = h('div', 'wordmark');
  [...text].forEach((ch, i) => {
    if (ch === ' '){ w.appendChild(h('span', 'sp', '&nbsp;')); return; }
    const s = h('span', 'ch', ch);
    s.style.color = LETTER[i % LETTER.length];
    s.style.animationDelay = (i * 0.07).toFixed(2) + 's';
    w.appendChild(s);
  });
  return w;
}

export function title({ onPlay, onSettings }){
  clearUI();
  const s = screen('title');

  const brand = h('div', 'brandblock');
  brand.append(wordmark('ASTRA'), wordmark('PARK'));
  s.appendChild(brand);

  /* One target, as wide as the screen allows. Precision is the enemy: a hand
     wobbles, two children lean on each other, and nobody should have to aim. */
  const play = onPick(button('PLAY', 'huge'), () => onPlay());
  s.appendChild(play);

  const hint = h('p', 'hint', pose.mouse.active
    ? 'Move the pointer over Play and hold'
    : 'Hold a hand over Play');
  s.appendChild(hint);

  /* Corner furniture. Small, far from the middle, and deliberately awkward to
     hit - which is the point, because a four-year-old reaching for Play should
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

  let t = 0;
  return {
    tick(dt){
      t += dt;
      const ok = pose.usingCamera && pose.ready;
      const seen = pose.personCount;
      dot.style.background = ok ? (seen ? 'var(--good)' : 'var(--gold)') : 'var(--bad)';
      status.querySelector('.txt').textContent =
        !ok ? 'No camera — mouse plays'
            : seen === 2 ? 'Two players' : seen === 1 ? 'One player' : 'Step into view';
    },

    /* Painted rather than drawn as assets: a night park with the sky doing the
       work the name promises. No files to ship, and it scales to any TV. */
    draw(c, W, H){
      drawPark(c, W, H, t);

      /* Balloons, drifting on their own phase so they never move in lockstep. */
      for (const [bx, by0, col, ph] of [[0.25,0.63,'#ff6b9d',0],[0.32,0.69,'#4aa8ff',1.9],
                                        [0.74,0.66,'#ffd24a',3.4]]){
        const x = W * bx + Math.sin(t * 0.8 + ph) * W * 0.006;
        const y = H * by0 + Math.sin(t * 1.1 + ph) * H * 0.012;
        const r = H * 0.032;
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = Math.max(1, H * 0.0018);
        c.beginPath(); c.moveTo(x, y + r);
        c.quadraticCurveTo(x + r * 0.5, y + r * 2.2, x, y + r * 3.4); c.stroke();
        c.fillStyle = col;
        c.beginPath(); c.ellipse(x, y, r * 0.82, r, 0, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(255,255,255,.4)';
        c.beginPath(); c.ellipse(x - r * 0.28, y - r * 0.34, r * 0.18, r * 0.24, -0.4, 0, 6.2832); c.fill();
      }

      /* The mascot. A body with legs rather than a floating head: the first
         draft was all face and read as an insect, antennae and all. */
      const bob = Math.sin(t * 2.1) * H * 0.012;
      const ms = H / 900;
      const mx = W * 0.14, my = H * 0.775 + bob;
      const bw = 46 * ms, bh = 52 * ms;

      c.fillStyle = 'rgba(0,0,0,.22)';
      c.beginPath(); c.ellipse(mx, my + bh + 26 * ms, bw * 0.9, 9 * ms, 0, 0, 6.2832); c.fill();

      /* Legs first, so the body overlaps them cleanly. */
      c.fillStyle = '#e8b93c';
      for (const side of [-1, 1]){
        c.beginPath();
        c.ellipse(mx + side * 20 * ms, my + bh + 10 * ms, 13 * ms, 17 * ms, 0, 0, 6.2832);
        c.fill();
      }

      /* Arms up and waving, with rounded caps standing in for hands. */
      c.strokeStyle = '#ffd24a'; c.lineWidth = 17 * ms; c.lineCap = 'round';
      const wave = Math.sin(t * 3.4) * 0.18;
      for (const side of [-1, 1]){
        c.save();
        c.translate(mx + side * bw * 0.82, my - bh * 0.25);
        c.rotate(side * (0.55 + wave));
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -46 * ms); c.stroke();
        c.restore();
      }

      c.fillStyle = '#ffd24a';
      c.beginPath(); c.ellipse(mx, my, bw, bh, 0, 0, 6.2832); c.fill();

      /* A spark on the crown, the one flourish it gets. */
      c.strokeStyle = '#fff'; c.lineWidth = 5 * ms;
      for (let k = 0; k < 3; k++){
        const a = -Math.PI / 2 + (k - 1) * 0.42;
        c.beginPath();
        c.moveTo(mx + Math.cos(a) * bh * 0.95, my + Math.sin(a) * bh * 0.95);
        c.lineTo(mx + Math.cos(a) * bh * 1.28, my + Math.sin(a) * bh * 1.28);
        c.stroke();
      }

      c.fillStyle = '#fff';
      for (const side of [-1, 1]){
        c.beginPath(); c.arc(mx + side * 17 * ms, my - 8 * ms, 14 * ms, 0, 6.2832); c.fill();
      }
      c.fillStyle = '#1a1333';
      for (const side of [-1, 1]){
        c.beginPath(); c.arc(mx + side * 17 * ms + 2 * ms, my - 6 * ms, 7 * ms, 0, 6.2832); c.fill();
      }
      c.fillStyle = '#fff';
      for (const side of [-1, 1]){
        c.beginPath(); c.arc(mx + side * 17 * ms + 5 * ms, my - 10 * ms, 2.6 * ms, 0, 6.2832); c.fill();
      }
      c.fillStyle = '#1a1333';
      c.beginPath(); c.ellipse(mx, my + 20 * ms, 13 * ms, 10 * ms, 0, 0, Math.PI); c.fill();

      /* Two small markers showing which colour is which player, so a second
         child can see at a glance that there is room for them. */
      const dotY = H * 0.95, dotR = H * 0.018;
      for (let i = 0; i < 2; i++){
        c.globalAlpha = pose.players[i].present ? 1 : 0.3;
        c.fillStyle = PLAYER_COLORS[i];
        c.beginPath();
        c.arc(W * 0.5 + (i ? 1 : -1) * dotR * 2.2, dotY, dotR, 0, 6.2832);
        c.fill();
      }
      c.globalAlpha = 1;
    }
  };
}
