/* Arm gestures, for the games that want them - each a little watcher kept
   per player and stepped every frame with their pose.

   A clap is the hands snapping together from apart. Small children clap
   small, soft and lopsided, and the camera is slow, so it's very little:
   the hands coming together (to within CLAP_SHUT shoulder widths) from a
   little apart (CLAP_APART, in the last moment) at all briskly
   (CLAP_SPEED shoulder widths a second). Rolling the arms never counts.

   A crank is "the wheels on the bus": the arms rolling round each other,
   so the line from one hand to the other keeps turning the same way. It
   counts whole turns of that line - each time it's gone all the way
   round, that's one - once it's turning steadily (CRANK_SPIN radians,
   built up over about CRANK_FOR seconds), hands no more than CRANK_GAP
   apart. Hands just going up and down only swing the line to and fro,
   which cancels out. (The same rolling as Tower Defense's fast sword.) */
import { L } from './pose.js';

export const CLAP_APART = 0.8, CLAP_SHUT = 0.6, CLAP_SPEED = 1.5;
export const CRANK_SPIN = 3, CRANK_FOR = 0.6, CRANK_GAP = 0.4;
const ASPECT = 16 / 9;

export class CrankWatch {
  constructor(){ this.a = null; this.spin = 0; this.turned = 0; }
  /* Whole turns made this step (usually 0, now and then 1). */
  step(p, dt){
    const l = p && p.hands.left, r = p && p.hands.right;
    if (!l || !r){ this.a = null; this.spin = 0; this.turned = 0; return 0; }
    const dx = (r.x - l.x) * ASPECT, dy = r.y - l.y, gap = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let da = 0;
    if (this.a != null && gap > 0.03 && gap < CRANK_GAP){
      da = a - this.a;
      if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
    }
    this.a = gap > 0.03 ? a : null;
    this.spin = (this.spin + da) * Math.exp(-dt / CRANK_FOR);
    /* Turning the way it's rolling counts towards a turn - from the
       start, so the first turn isn't lost getting going - but a turn only
       counts once it's rolling steadily. */
    if (Math.abs(this.spin) < 1){ this.turned = 0; return 0; }
    this.turned = Math.max(0, this.turned + Math.sign(this.spin) * da);
    if (this.rolling && this.turned >= 2 * Math.PI){ this.turned -= 2 * Math.PI; return 1; }
    return 0;
  }
  get rolling(){ return Math.abs(this.spin) >= CRANK_SPIN; }
}

export class ClapWatch {
  constructor(){ this.gap = null; this.apart = 0; }
  /* Did they clap this step? crank: their CrankWatch, so rolling never
     counts. */
  step(p, dt, crank = null){
    const l = p && p.hands.left, r = p && p.hands.right, lm = p && p.lm;
    if (!l || !r) return false;
    /* In shoulder widths, so near the camera or far off is the same. */
    const sw = lm ? Math.max(0.03, Math.hypot((lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x) * ASPECT, lm[L.L_SHOULDER].y - lm[L.R_SHOULDER].y)) : 0.1;
    const gap = Math.hypot((l.x - r.x) * ASPECT, l.y - r.y) / sw;
    const closing = ((this.gap ?? gap) - gap) / Math.max(dt, 1e-3);
    this.apart = gap > CLAP_APART ? 0.6 : Math.max(0, this.apart - dt);
    this.gap = gap;
    if (gap < CLAP_SHUT && this.apart > 0 && closing > CLAP_SPEED && !(crank && crank.rolling)){ this.apart = 0; return true; }
    return false;
  }
}
