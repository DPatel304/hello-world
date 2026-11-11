/* The moment the story turns: the old depot, where the crew find the
   ship's Star Core - and powering it up wakes every robot on the
   planet.

   The depot comes up out of the haze ahead - the crew run on up to it
   (APPROACH) and stop: a shed at the end of the path and, on the floor in
   front of it, the Star Core, glowing. "STAR CORE FOUND."
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
export const POWER = 5, AUTO = 10, SURGE = 3;
/* A quiet moment on arriving, before anything's asked (ARRIVE); and once
   it's powered up, STIR seconds of something stirring - far off, lights
   blinking on one by one across the land, a rumble building - before the
   surge. */
export const ARRIVE = 3, STIR = 3.6;
/* Where the piece sits on the floor ahead. */
export const PIECE = 0.22;
/* Where the shed stands once they're there; and how much further off it
   first shows, far up the path in the haze, as they run on up to it. */
export const SHED = 0.75, APPROACH = 1.5;
/* (fading in out of the haze, its first FADE of the way) */
const FADE = 0.25;

export class Depot {
  constructor(game){
    this.g = game; this.t = 0; this.state = 'approach'; this.st = 0; this.charge = 0; this.done = false;
    this.cranks = pose.players.map(() => new CrankWatch());
    this.banner = '';
    /* where the shed is along the way: up ahead, still to run to */
    this.d = game.z + SHED + APPROACH;
  }
  /* How far off the shed is, as things go (SHED once they're there). */
  get rel(){ return this.d - this.g.z; }
  /* How fast to run, coming up to it: full speed, slowing to a stop. */
  speed(full){
    if (this.state !== 'approach') return 0;
    return full * Math.max(0.12, Math.min(1, (this.rel - SHED) / 0.25));
  }

  step(dt, W, H){
    const g = this.g;
    this.t += dt; this.st += dt;
    if (this.state === 'approach'){
      if (this.rel <= SHED + 0.002){ this.state = 'arrive'; this.st = 0; }
    } else if (this.state === 'arrive'){
      if (!this.found && this.st > 1.2){ this.found = true; this.banner = 'STAR CORE FOUND'; sfx.learnt(); }
      if (this.st >= ARRIVE){ this.state = 'power'; this.st = 0; }
    } else if (this.state === 'power'){
      const here = g.here, rolling = here.filter(i => { this.cranks[i].step(pose.players[i], dt); return this.cranks[i].rolling; }).length;
      this.charge = Math.min(1, this.charge + dt / POWER * (here.length ? rolling / here.length : 0));
      if (this.st >= AUTO) this.charge = Math.min(1, this.charge + dt * 0.5);
      /* (a rising note at each tenth of the way: building) */
      const notch = Math.floor(this.charge * 10);
      if (notch > (this.notch || 0)){ this.notch = notch; sfx.bloom?.(notch); }
      if (this.charge >= 1){ this.state = 'stir'; this.st = 0; this.banner = ''; sfx.crashRumble?.(); }
    } else if (this.state === 'stir'){
      /* far off, lights blinking on, one after another; the rumble building */
      const lit = Math.floor(this.st / STIR * 12);
      if (lit > (this.lit || 0)){ this.lit = lit; sfx.beep?.(); }
      g.shake = Math.max(g.shake, 0.15 * this.st / STIR);
      if (this.st >= STIR){ this.state = 'surge'; this.st = 0; this.banner = '⚠ THE PLANET IS WAKING'; g.shake = 1; sfx.boom(); sfx.siren(true); }
    } else if (this.state === 'surge'){
      g.shake = Math.max(g.shake, 0.5 * (1 - this.st / SURGE));
      if (this.st >= SURGE){ this.done = true; g.awake = true; }
    }
  }

  /* The shed and the piece (among the game's things, at their depths). */
  items(list){
    const off = Math.max(0, this.rel - SHED), a = Math.min(1, (APPROACH - off) / (APPROACH * FADE));
    const fade = (f) => (c, W, H, t) => { c.save(); c.globalAlpha = Math.max(0, a); f(c, W, H, t); c.restore(); };
    list.push({ kind: 'boss', rel: SHED + off, draw: fade((c, W, H, t) => drawDepot(c, W, H, SHED + off, t, 'shed')) });
    if (this.state === 'power' || this.state === 'approach' || this.state === 'arrive' || this.state === 'stir') list.push({ kind: 'boss', rel: PIECE + off, draw: fade((c, W, H, t) => drawDepot(c, W, H, PIECE + off, t, 'piece', this.charge)) });
  }

  /* Over everything: the banner, and the surge rolling out. */
  draw(c, W, H){
    /* powering up: a column of light climbing out of the core */
    if (this.state === 'power' || this.state === 'stir'){
      const p = P(0, PIECE, W, H), hgt = H * (0.1 + 0.9 * this.charge), w = H * (0.02 + 0.05 * this.charge) * (this.state === 'stir' ? 1 - 0.6 * this.st / STIR : 1);
      const g = c.createLinearGradient(0, p.y - hgt, 0, p.y); g.addColorStop(0, 'rgba(160,248,255,0)'); g.addColorStop(1, `rgba(200,255,255,${0.35 + 0.4 * this.charge})`);
      c.save(); c.fillStyle = g; c.fillRect(p.x - w, p.y - hgt, w * 2, hgt); c.restore();
    }
    /* stirring: the light dimming; far off on the land's edge, red lights blinking on one by one */
    if (this.state === 'stir' || this.state === 'surge'){
      const k = this.state === 'stir' ? this.st / STIR : 1;
      c.save(); c.fillStyle = `rgba(20,10,40,${0.3 * k})`; c.fillRect(0, 0, W, H);
      const n = this.state === 'stir' ? Math.floor(this.st / STIR * 12) : 12, y = P(0, 1, W, H).y;
      for (let j = 0; j < n; j++){
        const x = W * (0.06 + 0.88 * ((j * 7) % 12) / 11), r = H * 0.006, on = Math.sin(this.t * 6 + j) > -0.6;
        if (!on) continue;
        c.fillStyle = 'rgba(255,60,60,.35)'; c.beginPath(); c.arc(x, y - H * 0.01, r * 3, 0, 6.2832); c.fill();
        c.fillStyle = '#ff5b5b'; c.beginPath(); c.arc(x, y - H * 0.01, r, 0, 6.2832); c.fill();
      }
      c.restore();
    }
    if (!this.banner) return;
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
