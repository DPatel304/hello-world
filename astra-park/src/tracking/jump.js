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
   they wriggle in the air. */

export const RISE = 0.1;    /* body sizes above standing height */
export const SPEED = 0.6;   /* body sizes per second, upward */
const FOLLOW = 1.5;         /* how fast standing height follows, per second */
const LANDED = 0.04;        /* body sizes from standing height that count as down again */

export class JumpWatch {
  constructor(){ this.base = [null, null]; this.last = [null, null]; this.up = [false, false]; }

  /* players: pose.players, n: how many are playing. Returns the list of
     players who jumped this step. */
  step(dt, players, n = 2){
    const out = [];
    for (let i = 0; i < n; i++){
      const p = players[i];
      if (!p || !p.present || !p.centre){ this.base[i] = this.last[i] = null; this.up[i] = false; continue; }
      const y = p.centre.y, s = p.scale || 0.3;
      if (this.base[i] == null){ this.base[i] = this.last[i] = y; continue; }
      const rise = (this.base[i] - y) / s, speed = (this.last[i] - y) / s / Math.max(dt, 1e-3);
      this.last[i] = y;
      if (this.up[i]){
        if (rise < LANDED) this.up[i] = false;
        continue;
      }
      if (rise > RISE && speed > SPEED){ this.up[i] = true; out.push(i); continue; }
      this.base[i] += (y - this.base[i]) * Math.min(1, dt * FOLLOW);
    }
    return out;
  }
}
