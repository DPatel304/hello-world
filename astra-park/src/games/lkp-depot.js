/* The moment the story turns: the old depot, where the crew find the
   ship's engine piece - and powering it up wakes every robot on the
   planet.

   The run stops at the depot: a shed at the end of the path and, on the
   floor in front of it, the engine piece, glowing. "ENGINE PIECE FOUND."
   Nova asks everyone to roll their arms to power it up: the ring round it
   fills as they do - all of them for POWER seconds - or, whoever's
   rolling, by itself after AUTO. Then the SURGE: a shockwave rolling out
   across everything, the ground shaking, "THE PLANET IS WAKING" - and the
   robots speak with one voice (a scene: the level's `waking` lines). From
   here on the fights are robots. */
import { pose } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { CrankWatch } from '../tracking/gestures.js';
import { P, drawDepot } from './lkp-art.js';

/* Powering up: everyone rolling their arms this long fills it; it fills
   by itself AUTO seconds in. Then the surge, SURGE seconds. */
export const POWER = 3, AUTO = 5, SURGE = 2.5;
/* Where the piece sits on the floor ahead. */
export const PIECE = 0.22;

export class Depot {
  constructor(game){
    this.g = game; this.t = 0; this.state = 'power'; this.st = 0; this.charge = 0; this.done = false;
    this.cranks = pose.players.map(() => new CrankWatch());
    this.banner = 'ENGINE PIECE FOUND';
    sfx.learnt();
  }

  step(dt, W, H){
    const g = this.g;
    this.t += dt; this.st += dt;
    if (this.state === 'power'){
      const here = g.here, rolling = here.filter(i => { this.cranks[i].step(pose.players[i], dt); return this.cranks[i].rolling; }).length;
      this.charge = Math.min(1, this.charge + dt / POWER * (here.length ? rolling / here.length : 0));
      if (this.st >= AUTO) this.charge = Math.min(1, this.charge + dt * 1.5);
      if (this.charge >= 1){ this.state = 'surge'; this.st = 0; this.banner = '⚠ THE PLANET IS WAKING'; g.shake = 1; sfx.boom(); sfx.siren(true); }
    } else if (this.state === 'surge'){
      g.shake = Math.max(g.shake, 0.5 * (1 - this.st / SURGE));
      if (this.st >= SURGE){ this.done = true; g.awake = true; }
    }
  }

  /* The shed and the piece (among the game's things, at their depths). */
  items(list){
    list.push({ kind: 'boss', rel: 0.75, draw: (c, W, H, t) => drawDepot(c, W, H, 0.75, t, 'shed') });
    if (this.state === 'power') list.push({ kind: 'boss', rel: PIECE, draw: (c, W, H, t) => drawDepot(c, W, H, PIECE, t, 'piece', this.charge) });
  }

  /* Over everything: the banner, and the surge rolling out. */
  draw(c, W, H){
    if (this.state === 'surge'){
      const p = P(0, PIECE, W, H), r = (this.st / SURGE) * W * 1.2;
      c.save();
      c.globalAlpha = Math.max(0, 1 - this.st / SURGE);
      c.strokeStyle = '#7ff3ff'; c.lineWidth = H * 0.03; c.shadowColor = '#7ff3ff'; c.shadowBlur = 30;
      c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.35, 0, 0, 6.2832); c.stroke();
      c.fillStyle = `rgba(127,243,255,${0.3 * Math.max(0, 1 - this.st)})`; c.fillRect(0, 0, W, H);
      c.restore();
    }
    c.save();
    c.font = `700 ${Math.round(H * 0.075)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = H * 0.012; c.strokeStyle = '#05060f'; c.strokeText(this.banner, W / 2, H * 0.22);
    c.fillStyle = this.state === 'surge' ? '#ff5b5b' : '#7ff3ff'; c.fillText(this.banner, W / 2, H * 0.22);
    c.restore();
  }
}
