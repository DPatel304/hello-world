/* The treasure room - only ever behind the ? door. A rest: a quiet room
   with a chest at the back. It bursts open as the crew come in - a heap
   of coins for the team - and everyone's patched up, back to full health,
   over a moment. Then each player waves when they're ready to go on - a
   tick over them when they have - and once everyone has, on they go.
   (However long they take, after len seconds they go on anyway.) */
import { pose } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { WaveWatch, handsFrom } from '../tracking/wave.js';
import { P, RUN, PAL, drawChest } from './lkp-art.js';

export const TREASURE_COINS = 30;
/* Opening the chest; then healing everyone to full over HEAL seconds. */
export const OPEN = 1.2, HEAL = 2;
export const TREASURE_MAX = 30;
/* Where the chest is, and the room's back wall. */
const CHEST = 0.3, BACK = 0.62;

export class Treasure {
  constructor(game, len = TREASURE_MAX){
    this.g = game; this.len = len; this.t = 0; this.done = false; this.clearT = 0; this.opened = false;
    this.waves = pose.players.map(() => new WaveWatch());
    this.ready = pose.players.map(() => false);
    this.from = game.crew.map(rn => rn.hp);
  }

  step(dt, W, H){
    const g = this.g;
    this.t += dt;
    if (this.done){ this.clearT += dt; return; }
    if (!this.opened && this.t >= OPEN){
      this.opened = true; g.coins += TREASURE_COINS; sfx.gold();
      const p = P(0, CHEST, W, H);
      for (let k = 0; k < 4; k++) g._sparkle(p.x / W, (p.y - H * 0.1) / H, 12, 50);
      this.from = g.crew.map(rn => rn.hp);
    }
    /* Patched up, a little at a time. */
    if (this.opened){
      const u = Math.min(1, (this.t - OPEN) / HEAL);
      g.crew.forEach((rn, i) => { if (rn.hp < rn.max) rn.hp = Math.min(rn.max, Math.max(rn.hp, this.from[i] + (rn.max - this.from[i]) * u)); });
      if (u < 1 && Math.random() < dt * 8) for (const i of g.here){
        const q = P(g.crew[i].x, RUN, W, H);
        g.bits.push({ kind: 'heart', x: (q.x + (Math.random() - 0.5) * H * 0.06) / W, y: (q.y - H * 0.2) / H, vy: -0.08, age: 0, life: 0.9 });
      }
    }
    /* Ready? A wave each. */
    for (const i of g.here){
      if (this.ready[i] || !this.opened) continue;
      this.waves[i].step(dt, handsFrom(pose, g.players).filter(h => h.who === i));
      if (this.waves[i].done){ this.ready[i] = true; sfx.pick(); }
    }
    const all = g.here.length > 0 && g.here.every(i => this.ready[i]);
    if (all || this.t > this.len){ this.done = true; sfx.select(); }
  }

  /* The room's back wall and the chest, among the game's things. */
  items(list){
    list.push({ kind: 'boss', rel: BACK, draw: (c, W, H) => {
      const l = P(-1.2, BACK, W, H);
      c.fillStyle = PAL.wall; c.fillRect(-W, -H, W * 3, l.y + H);
    } });
    list.push({ kind: 'boss', rel: CHEST, draw: (c, W, H, t) => drawChest(c, W, H, CHEST, t, Math.min(1, this.t / OPEN), this.opened) });
  }

  /* Over everyone: a tick when they're ready, a hand to wave till then. */
  draw(c, W, H){
    if (!this.opened) return;
    const g = this.g;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const i of g.here){
      const q = P(g.crew[i].x, RUN, W, H), y = q.y - H * 0.29;
      if (this.ready[i]){
        c.fillStyle = '#22c55e'; c.beginPath(); c.arc(q.x, y, H * 0.03, 0, 6.2832); c.fill();
        c.strokeStyle = '#ffffff'; c.lineWidth = H * 0.008; c.lineCap = 'round';
        c.beginPath(); c.moveTo(q.x - H * 0.013, y); c.lineTo(q.x - H * 0.003, y + H * 0.011); c.lineTo(q.x + H * 0.015, y - H * 0.011); c.stroke();
      } else {
        c.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 6);
        c.font = `${Math.round(H * 0.045)}px sans-serif`; c.fillText('\u{1F44B}', q.x, y);
        c.globalAlpha = 1;
      }
    }
    c.restore();
  }
}
