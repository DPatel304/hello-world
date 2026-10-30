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
   which cancels out. (The same rolling as Tower Defense's fast sword.)

   A hug is hugging yourself: each hand at the other shoulder (within
   HUG_NEAR shoulder widths), held for HUG_SETTLE seconds.

   Marching is any marching, walking or running on the spot, however
   little the feet come up: the knees or the ankles, whichever are in view,
   going up and down - MARCH_FULL body sizes a second is all-out. Quick to
   get going, slow to stop, so the pause between steps is no stop.

   Moving is anything at all: how fast the head, hands, hips, knees and
   feet are going, in body sizes a second, smoothed a little - for
   standing still. With the mouse, both are how fast the mouse is
   moving. */
import { L } from './pose.js';

export const CLAP_APART = 0.8, CLAP_SHUT = 0.6, CLAP_SPEED = 1.5;
export const CRANK_SPIN = 3, CRANK_FOR = 0.6, CRANK_GAP = 0.4;
export const HUG_NEAR = 0.6, HUG_SETTLE = 0.3;
export const MARCH_FULL = 0.5;
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

export class HugWatch {
  constructor(){ this.t = 0; }
  /* Are they hugging themselves (and have been, a moment)? */
  step(p, dt){
    const lm = p && p.lm;
    const vis = (j) => (lm[j].v ?? 1) > 0.4;
    const near = (a, b) => Math.hypot((lm[a].x - lm[b].x) * ASPECT, lm[a].y - lm[b].y);
    const hug = !!lm && vis(L.L_WRIST) && vis(L.R_WRIST) && (() => {
      const sw = near(L.L_SHOULDER, L.R_SHOULDER) || 0.05;
      return near(L.L_WRIST, L.R_SHOULDER) < HUG_NEAR * sw && near(L.R_WRIST, L.L_SHOULDER) < HUG_NEAR * sw;
    })();
    this.t = hug ? this.t + dt : 0;
    return this.t >= HUG_SETTLE;
  }
}

export class MarchWatch {
  constructor(){ this.was = null; this.march = 0; }
  /* How hard they're marching, 0..1. */
  step(p, dt, mouse = false){
    let legs = 0;
    if (mouse) legs = (p.hands.right.speed || 0) * 0.5;
    else if (p && p.lm){
      const lm = p.lm, vis = (j) => (lm[j].v ?? 1) > 0.5;
      const pairs = [[L.L_KNEE, L.R_KNEE], [L.L_ANKLE, L.R_ANKLE]].filter(([a, b]) => vis(a) && vis(b));
      const was = this.was;
      for (const [a, b] of pairs){
        if (was && was[a] != null) legs = Math.max(legs, (Math.abs(lm[a].y - was[a]) + Math.abs(lm[b].y - was[b])) / 2 / Math.max(dt, 1e-3) / (p.scale || 0.3));
      }
      this.was = {};
      for (const [a, b] of pairs){ this.was[a] = lm[a].y; this.was[b] = lm[b].y; }
    } else this.was = null;
    const want = Math.min(1, legs / MARCH_FULL);
    this.march += (want - this.march) * Math.min(1, dt * (want > this.march ? 4 : 1.5));
    return this.march;
  }
}

const MOVERS = [L.NOSE, L.L_WRIST, L.R_WRIST, L.L_HIP, L.R_HIP, L.L_KNEE, L.R_KNEE, L.L_ANKLE, L.R_ANKLE];
export class MoveWatch {
  constructor(){ this.was = null; this.moving = 0; }
  /* How much they're moving: body sizes a second. */
  step(p, dt, mouse = false){
    let v = 0;
    if (mouse) v = p.hands.right.speed || 0;
    else if (p && p.lm){
      const lm = p.lm, was = this.was;
      if (was){
        const fast = MOVERS.filter(j => (lm[j].v ?? 1) > 0.5 && was[j]).map(j => Math.hypot(lm[j].x - was[j].x, lm[j].y - was[j].y));
        /* The second fastest: a waving hand counts, one jittery point doesn't. */
        if (fast.length) v = fast.sort((a, b) => a - b)[Math.max(0, fast.length - 2)] / Math.max(dt, 1e-3) / (p.scale || 0.3);
      }
      this.was = {};
      for (const j of MOVERS) this.was[j] = { x: lm[j].x, y: lm[j].y };
    } else this.was = null;
    this.moving += (v - this.moving) * Math.min(1, dt * 8);
    return this.moving;
  }
}
