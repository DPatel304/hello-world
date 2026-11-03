/* Jumping, for the games that want it: Moon Bounce floats you up when you
   jump, and Snow Sled flies off its ramps.

   A jump is the middle of the body rising quickly above where it has been
   standing. "Where it has been standing" follows the body slowly while it is
   on the ground, so walking about, leaning or crouching shifts it without
   counting; a jump is too quick for it to follow. Distances are measured in
   body sizes (pose's `scale`), so a small child near the camera and a tall
   one further back jump the same.

   Once a jump has counted, that player has to come back down near their
   standing height before another can, so one jump is one jump however much
   they wriggle in the air.

   A game can ask for a lighter touch - a smaller, slower rise - where a
   jump that isn't meant does no harm. It can also ask for the feet to
   leave the floor too: getting up from a crouch lifts the body as quickly
   as a jump does, but the feet stay where they are. (Where the feet can't
   be seen, the body alone decides.) */
import { L } from './pose.js';

export const RISE = 0.1;    /* body sizes above standing height */
export const SPEED = 0.6;   /* body sizes per second, upward */
const FOLLOW = 1.5;         /* how fast standing height follows, per second */
/* ...but only slowly downward, so after a crouch or a squat, standing up
   again is back to standing height, not a jump above it. */
const FOLLOW_DOWN = 0.15;
const LANDED = 0.04;        /* body sizes from standing height that count as down again */
/* With feet: how much of the body's rise the ankles must rise too. */
const FEET = 0.5;

/* Where player p's feet are: the middle of their ankles, if both are seen. */
function feetOf(p){
  const lm = p.lm, a = lm && lm[L.L_ANKLE], b = lm && lm[L.R_ANKLE];
  if (!a || !b || (a.v ?? 1) < 0.6 || (b.v ?? 1) < 0.6) return null;
  return (a.y + b.y) / 2;
}

export class JumpWatch {
  constructor({ rise = RISE, speed = SPEED, feet = false } = {}){
    this.rise = rise; this.speed = speed; this.feet = feet;
    this.base = []; this.last = []; this.up = []; this.floor = [];
  }

  /* players: pose.players, n: how many are playing. Returns the list of
     players who jumped this step. */
  step(dt, players, n = players.length){
    const out = [];
    for (let i = 0; i < n; i++){
      const p = players[i];
      if (!p || !p.present || !p.centre){ this.base[i] = this.last[i] = this.floor[i] = null; this.up[i] = false; continue; }
      const y = p.centre.y, s = p.scale || 0.3;
      if (this.base[i] == null){ this.base[i] = this.last[i] = y; continue; }
      const rise = (this.base[i] - y) / s, speed = (this.last[i] - y) / s / Math.max(dt, 1e-3);
      this.last[i] = y;
      if (this.up[i]){
        if (rise < LANDED) this.up[i] = false;
        continue;
      }
      /* The floor: where the feet are while standing. */
      const f = this.feet ? feetOf(p) : null;
      if (f == null) this.floor[i] = null;
      else if (this.floor[i] == null) this.floor[i] = f;
      const lifted = f == null || this.floor[i] == null || (this.floor[i] - f) / s > this.rise * FEET;
      if (rise > this.rise && speed > this.speed && lifted){ this.up[i] = true; out.push(i); continue; }
      this.base[i] += (y - this.base[i]) * Math.min(1, dt * (y > this.base[i] ? FOLLOW_DOWN : FOLLOW));
      if (f != null) this.floor[i] += (f - this.floor[i]) * Math.min(1, dt * FOLLOW);
    }
    return out;
  }
}
