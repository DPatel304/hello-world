/* The front door. Everything here is sized and placed for a hand at three
   metres rather than a mouse at thirty centimetres: one enormous target,
   nothing crowding it, and the two things a parent needs to know - is the
   camera working, and where are the settings - pushed to the corners where a
   drifting hand will not catch them by accident. */
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';

const LETTER = ['#ffd24a','#ff6b9d','#4ad6d6','#ff9f45','#b06bff',
                '#53e59a','#4aa8ff','#ff6b9d','#ffd24a'];

/* Per-letter colour and a staggered bob. Spaces keep their width but skip the
   animation, or the two words drift apart. */
function wordmark(text){
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
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0,   '#0a0a2e');
      sky.addColorStop(0.45,'#1b1b52');
      sky.addColorStop(0.72,'#35306e');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);

      /* Stars. Seeded off the index so they do not crawl between frames. */
      for (let i = 0; i < 90; i++){
        const x = ((i * 2654435761) % 10000) / 10000 * W;
        const y = ((i * 40503) % 7000) / 7000 * H * 0.72;
        const tw = 0.55 + 0.45 * Math.sin(t * 1.6 + i);
        const r = (i % 7 === 0 ? 2.4 : 1.3) * (H / 900);
        c.globalAlpha = tw * 0.9;
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(x, y, Math.max(1, r), 0, 6.2832); c.fill();
      }
      c.globalAlpha = 1;

      /* A ringed planet, low and to the right, where nothing else sits. */
      const pr = H * 0.055, px = W * 0.80, py = H * 0.30;
      c.fillStyle = '#ffb45c';
      c.beginPath(); c.arc(px, py, pr, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(255,220,150,.75)';
      c.lineWidth = Math.max(2, H * 0.006);
      c.save(); c.translate(px, py); c.rotate(-0.42); c.scale(1, 0.32);
      c.beginPath(); c.arc(0, 0, pr * 1.9, 0, 6.2832); c.stroke();
      c.restore();

      /* A comet on a slow loop, so the screen is never quite still. */
      const ct = (t * 0.07) % 1;
      const cx = W * (0.05 + ct * 1.05), cy = H * (0.30 - ct * 0.16);
      const grad = c.createLinearGradient(cx, cy, cx - W * 0.16, cy + H * 0.07);
      grad.addColorStop(0, 'rgba(255,255,255,.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      c.strokeStyle = grad; c.lineWidth = Math.max(3, H * 0.009); c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - W * 0.16, cy + H * 0.07); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(cx, cy, Math.max(3, H * 0.008), 0, 6.2832); c.fill();

      /* Three bands of hills, lightest at the back. */
      const hills = [
        { y: 0.70, h: 0.10, col: '#2f6b4f', n: 3 },
        { y: 0.79, h: 0.13, col: '#3c8a5e', n: 4 },
        { y: 0.89, h: 0.16, col: '#4da56c', n: 3 }
      ];
      for (const band of hills){
        c.fillStyle = band.col;
        c.beginPath(); c.moveTo(0, H);
        c.lineTo(0, H * band.y);
        for (let i = 0; i <= band.n; i++){
          const x0 = W * (i / band.n), x1 = W * ((i + 0.5) / band.n);
          c.quadraticCurveTo(x1, H * (band.y - band.h * 0.5), W * ((i + 1) / band.n), H * band.y);
        }
        c.lineTo(W, H); c.closePath(); c.fill();
      }

      /* Trees, placed off a fixed list so they do not wander. */
      for (const [fx, fy, fs] of [[0.07,0.76,1],[0.17,0.82,1.3],[0.30,0.78,0.85],
                                  [0.70,0.80,1.1],[0.86,0.76,0.95],[0.95,0.83,1.25]]){
        const x = W * fx, y = H * fy, sc = (H / 900) * fs;
        c.fillStyle = '#2a4a38';
        c.fillRect(x - 5 * sc, y, 10 * sc, 42 * sc);
        c.fillStyle = '#3f8f5e';
        c.beginPath(); c.arc(x, y - 10 * sc, 34 * sc, 0, 6.2832); c.fill();
        c.fillStyle = '#4fa76e';
        c.beginPath(); c.arc(x - 10 * sc, y - 22 * sc, 22 * sc, 0, 6.2832); c.fill();
      }

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
