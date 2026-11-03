/* Waving hello, which is how a game of Astra Park begins.

   A wave is a raised hand swinging side to side. Each time a hand turns back
   after a swing of at least WAVE_SWING it counts a turn, and the turns fill a
   meter: WAVE_TURNS of them, close together, and that's a wave. A hand that
   stops waving lets the meter drain away slowly rather than all at once, so a
   child who pauses mid-wave hasn't lost it.

   Raised means the wrist at or above its shoulder, so arms swinging at
   someone's sides as they walk into view don't count, while a hello - hand
   up by the face - does. The mouse is always raised, so wiggling the pointer
   waves too. */
import { L } from './pose.js';

export const WAVE_SWING = 0.035;  /* screen widths a hand must travel before it turns */
export const WAVE_TURNS = 6;      /* three back-and-forths: about a second of waving */
const TURN_GAP = 0.12;            /* seconds: jitter can't turn faster than a hand */
const PATIENCE = 0.8;             /* seconds of stillness before the meter drains */
const DRAIN = 0.5;                /* meter per second, once draining */
const RAISED = 0.03;              /* how far below the shoulder still counts as up */

/* Every hand that could be waving, as { key, who, x, y, raised } - of the
   first n players, so a bystander doesn't wave for a one-player game. */
export function handsFrom(pose, n = pose.players.length){
  const out = [];
  for (let i = 0; i < n; i++){
    const p = pose.players[i];
    if (!p || !p.present) continue;
    if (pose.mouse.active){
      out.push({ key: i + 'm', who: i, x: p.hands.right.x, y: p.hands.right.y, raised: true });
      continue;
    }
    if (!p.lm) continue;
    for (const [side, wrist, shoulder] of [['left', L.L_WRIST, L.L_SHOULDER], ['right', L.R_WRIST, L.R_SHOULDER]]){
      const h = p.hands[side];
      out.push({ key: i + side, who: i, x: h.x, y: h.y, raised: p.lm[wrist].y < p.lm[shoulder].y + RAISED });
    }
  }
  return out;
}

export class WaveWatch {
  constructor(){
    this.meter = 0;          /* 0..1; a wave at 1 */
    this.done = false;
    this.last = null;        /* the hand that turned most recently: { who, x, y } */
    this.turns = 0;          /* turns counted since the meter was last empty */
    this._hands = new Map();
    this._quiet = 0;
  }

  /* Returns how many turns were counted this step, so the caller can chime. */
  step(dt, hands){
    let turned = 0;
    const seen = new Set();
    for (const h of hands){
      seen.add(h.key);
      let s = this._hands.get(h.key);
      if (!s){ s = { dir: 0, far: h.x, since: 0 }; this._hands.set(h.key, s); }
      s.since += dt;
      if (s.dir === 0){
        if (Math.abs(h.x - s.far) > WAVE_SWING){ s.dir = Math.sign(h.x - s.far); s.far = h.x; }
        continue;
      }
      /* Follow the swing out to its furthest point; a turn is coming back
         far enough from there. */
      if ((h.x - s.far) * s.dir > 0){ s.far = h.x; continue; }
      if (Math.abs(h.x - s.far) < WAVE_SWING) continue;
      const counts = h.raised && s.since >= TURN_GAP;
      s.dir = -s.dir; s.far = h.x; s.since = 0;
      if (!counts || this.done) continue;
      turned++;
      this.last = { who: h.who, x: h.x, y: h.y };
    }
    for (const k of [...this._hands.keys()]) if (!seen.has(k)) this._hands.delete(k);

    if (turned){
      this._quiet = 0;
      this.turns += turned;
      /* Six sixths can sum to a hair under one; that is still a wave. */
      this.meter = Math.min(1, this.meter + turned / WAVE_TURNS);
      if (this.meter > 1 - 1e-6){ this.meter = 1; this.done = true; }
    } else if (!this.done){
      this._quiet += dt;
      if (this._quiet > PATIENCE) this.meter = Math.max(0, this.meter - DRAIN * dt);
      if (this.meter === 0) this.turns = 0;
    }
    return turned;
  }
}
