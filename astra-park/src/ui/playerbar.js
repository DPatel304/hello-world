/* Who's here, across the top of the home screen - the way a console shows
   who's signed in. Everyone the camera has as a player gets a bubble in
   their colour with their face in it (or a cartoon until their picture's
   taken), popping in with a sound and a little wave as they walk up, and
   fading away when they step off. Taking part needs no signing in: being
   there is it.

   It keeps the faces coming, too: the pictures are snapped here, on the
   home screen, so they're ready before the first game. */
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { FaceCam } from './faces.js';
import { drawKid, KID_SKINS } from './kids.js';
import { sfx } from '../audio/sound.js';

export class PlayerBar {
  constructor(){
    this.faces = new FaceCam();
    this.t = 0;
    /* Per player: how far in (0..1), and how long since they arrived. */
    this.in = Array(MAX_PLAYERS).fill(0);
    this.since = Array(MAX_PLAYERS).fill(9);
    this.was = Array(MAX_PLAYERS).fill(false);
  }

  step(dt){
    this.t += dt;
    this.faces.step(dt);
    for (let i = 0; i < MAX_PLAYERS; i++){
      const here = !!pose.players[i].present;
      if (here && !this.was[i]){ this.since[i] = 0; sfx.pop(1.1 + i * 0.15); }
      this.was[i] = here;
      this.since[i] += dt;
      this.in[i] += ((here ? 1 : 0) - this.in[i]) * Math.min(1, dt * (here ? 7 : 3));
    }
  }

  get count(){ return pose.players.filter(p => p.present).length; }

  /* The bubbles, centred at (cx, cy), each r across. Empty places are
     faint rings, so it's clear there's room for more. */
  draw(c, cx, cy, r){
    const gap = r * 2.7;
    for (let i = 0; i < MAX_PLAYERS; i++){
      const x = cx + (i - (MAX_PLAYERS - 1) / 2) * gap, k = this.in[i];
      /* An empty place: a faint dashed ring. */
      c.save();
      c.globalAlpha = 0.35 * (1 - k);
      c.strokeStyle = '#fff6e2'; c.lineWidth = Math.max(1.5, r * 0.07); c.setLineDash?.([r * 0.25, r * 0.2]);
      c.beginPath(); c.arc(x, cy, r * 0.85, 0, 6.2832); c.stroke();
      c.restore();
      if (k < 0.02) continue;
      /* Popping in: a little overshoot. */
      const s = this.since[i], pop = s < 0.4 ? 1 + Math.sin(s / 0.4 * Math.PI) * 0.25 : 1, rr = r * k * pop;
      const col = PLAYER_COLORS[i];
      c.save();
      c.globalAlpha = Math.min(1, k * 1.3);
      /* A soft glow in their colour, then the ring, then the face. */
      const g = c.createRadialGradient(x, cy, rr * 0.6, x, cy, rr * 1.6);
      g.addColorStop(0, hexA(col, 0.45)); g.addColorStop(1, hexA(col, 0));
      c.fillStyle = g; c.beginPath(); c.arc(x, cy, rr * 1.6, 0, 6.2832); c.fill();
      if (!this.faces.draw(c, i, x, cy, rr * 1.12, col)){
        c.fillStyle = col; c.beginPath(); c.arc(x, cy, rr * 1.08, 0, 6.2832); c.fill();
        c.save();
        c.beginPath(); c.arc(x, cy, rr * 0.9, 0, 6.2832); c.clip();
        c.fillStyle = '#fff6e2'; c.fillRect(x - rr, cy - rr, rr * 2, rr * 2);
        drawKid(c, x, cy + rr * 0.15, rr * 0.85, this.t + i, KID_SKINS[i]);
        c.restore();
      }
      /* Just arrived: a hand waving hello beside them. */
      if (s < 2.2) wave(c, x + rr * 1.05, cy - rr * 0.55, rr * 0.45, this.t, Math.min(1, (2.2 - s) * 2));
      c.restore();
    }
  }
}

/* A little waving hand. */
function wave(c, x, y, r, t, a){
  c.save(); c.globalAlpha *= a;
  c.translate(x, y); c.rotate(Math.sin(t * 10) * 0.45);
  c.fillStyle = '#ffd9a8'; c.strokeStyle = '#2b2440'; c.lineWidth = Math.max(1, r * 0.1);
  c.beginPath(); c.roundRect(-r * 0.45, -r * 0.3, r * 0.9, r * 0.85, r * 0.3); c.fill(); c.stroke();
  for (let f = 0; f < 4; f++){
    const fx = -r * 0.32 + f * r * 0.21;
    c.beginPath(); c.roundRect(fx - r * 0.08, -r * 0.95, r * 0.17, r * 0.7, r * 0.08); c.fill(); c.stroke();
  }
  c.restore();
}

function hexA(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
