import test from 'node:test';
import assert from 'node:assert/strict';
import { JumpWatch } from '../src/tracking/jump.js';
import { L } from '../src/tracking/pose.js';

const DT = 1 / 30;
/* A player standing with their middle at y and their feet at feet (or
   their feet out of view). */
function player(y = 0.5, feet = 0.9){
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));
  const p = { present: true, scale: 0.4, centre: { x: 0.5, y }, lm };
  p.feet = (f) => { lm[L.L_ANKLE] = { x: 0.45, y: f, v: f == null ? 0 : 0.9 }; lm[L.R_ANKLE] = { x: 0.55, y: f, v: f == null ? 0 : 0.9 }; };
  p.feet(feet);
  return p;
}
/* Move the middle (and the feet) from where they are by dy over secs. */
function move(w, p, dy, secs, feetDy = 0){
  let n = 0;
  const k = Math.round(secs / DT);
  for (let s = 0; s < k; s++){
    p.centre.y += dy / k;
    if (feetDy) p.feet(p.lm[L.L_ANKLE].y + feetDy / k);
    n += w.step(DT, [p], 1).length;
  }
  return n;
}
const settle = (w, p, secs = 1) => move(w, p, 0, secs);

test('a jump: the body and the feet leave the floor', () => {
  const w = new JumpWatch({ rise: 0.045, speed: 0.35, feet: true }), p = player();
  settle(w, p);
  assert.equal(move(w, p, -0.06, 0.15, -0.04), 1);
});

test('getting up from a crouch is no jump: the feet stay on the floor', () => {
  const w = new JumpWatch({ rise: 0.045, speed: 0.35, feet: true }), p = player();
  settle(w, p);
  move(w, p, 0.15, 0.3); settle(w, p, 2);
  /* Up again, quickly - and a little past standing, onto tiptoe. */
  assert.equal(move(w, p, -0.17, 0.25), 0);
  /* Watching the body alone, it would have been. */
  const b = new JumpWatch({ rise: 0.045, speed: 0.35 }), q = player();
  settle(b, q); move(b, q, 0.15, 0.3); settle(b, q, 2);
  assert.equal(move(b, q, -0.17, 0.25), 1);
});

test('feet out of view: the body alone decides', () => {
  const w = new JumpWatch({ rise: 0.045, speed: 0.35, feet: true }), p = player(0.5, null);
  settle(w, p);
  assert.equal(move(w, p, -0.06, 0.15), 1);
});
