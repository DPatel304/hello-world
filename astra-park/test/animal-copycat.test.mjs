import test from 'node:test';
import assert from 'node:assert/strict';
import game, { HOLD, PATIENCE } from '../src/games/animal-copycat.js';
import { MATCH, ANIMALS, distance, bodyIn } from '../src/games/copycat-poses.js';
import { pose, L } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs) => { for (let i = 0; i < Math.round(secs / DT); i++) inst.step(DT, W, H); };
/* Put children in poses: one name per child, null for nobody. */
function kids(...names){
  pose.mouse.active = false;
  for (let i = 0; i < 2; i++){
    const p = pose.players[i], n = names[i];
    p.present = !!n;
    p.lm = n ? bodyIn(n, 0.35 + i * 0.3, 0.62, 0.17) : null;
    p.centre = { x: 0.35 + i * 0.3, y: 0.5 }; p.scale = 0.3;
  }
}
function posing(inst){ run(inst, 1); assert.equal(inst.cur.phase, 'pose'); }

/* ---- the poses ---- */

test('every animal pose matches itself and standing still matches none', () => {
  for (const a of ANIMALS){
    assert.ok(distance(bodyIn(a, 0.5, 0.6, 0.2), a, W, H) < 0.01, `${a} matches itself`);
    const d = distance(bodyIn('stand', 0.5, 0.6, 0.2), a, W, H);
    assert.ok(d > MATCH + 0.2, `standing is clearly not ${a} (${d.toFixed(2)})`);
  }
});

test('size and place in the room do not matter', () => {
  const small = bodyIn('bird', 0.2, 0.7, 0.1), big = bodyIn('bird', 0.7, 0.5, 0.3);
  assert.ok(distance(small, 'bird', W, H) < 0.01);
  assert.ok(distance(big, 'bird', W, H) < 0.01);
});

test('the flamingo works on either leg, but not with both feet down', () => {
  assert.ok(distance(bodyIn('flamingo', 0.5, 0.6, 0.2, W, H, true), 'flamingo', W, H) < 0.01);
  const wingsOnly = bodyIn('bird', 0.5, 0.6, 0.2);
  assert.ok(distance(wingsOnly, 'flamingo', W, H) > MATCH);
});

test('a child cut off at the knees can still copy the arms', () => {
  const lm = bodyIn('giraffe', 0.5, 0.6, 0.2);
  for (const i of [L.L_KNEE, L.R_KNEE, L.L_ANKLE, L.R_ANKLE]) lm[i].v = 0.05;
  assert.ok(distance(lm, 'giraffe', W, H) < MATCH);
  for (const i of [L.L_WRIST, L.R_WRIST, L.L_ELBOW]) lm[i].v = 0.05;
  assert.equal(distance(lm, 'giraffe', W, H), null, 'too little in view to say');
});

/* ---- the game ---- */

test('copying the animal and holding it a moment sends it to the parade', () => {
  kids('stand');
  const inst = game.create(1);
  posing(inst);
  assert.equal(inst.cur.name, 'giraffe', 'the easy one first');
  run(inst, 2);
  assert.equal(inst.cur.matched[0], false, 'standing is not copying');
  kids('giraffe');
  run(inst, HOLD * 0.5);
  assert.equal(inst.cur.matched[0], false, 'not held long enough yet');
  run(inst, HOLD);
  assert.equal(inst.cur.phase, 'cheer');
  assert.equal(inst.copied, 1);
  run(inst, 4);
  assert.deepEqual(inst.parade.map(p => p.name), ['giraffe']);
  assert.equal(inst.cur.name, 'bird');
});

test('with two children, the animal waits until both have copied it', () => {
  kids('stand', 'stand');
  const inst = game.create(2);
  posing(inst);
  kids('giraffe', 'stand');
  run(inst, 2);
  assert.equal(inst.cur.phase, 'pose', 'one is not enough');
  kids('stand', 'giraffe');
  run(inst, 1);
  assert.equal(inst.cur.phase, 'cheer', 'they took turns, and that counts');
});

test('a child who has walked off does not hold the other up', () => {
  kids('stand', 'stand');
  const inst = game.create(2);
  posing(inst);
  kids('giraffe', null);
  run(inst, 1);
  assert.equal(inst.cur.phase, 'cheer');
});

test('an animal nobody copies joins the parade anyway, uncounted', () => {
  kids('stand');
  const inst = game.create(1);
  run(inst, PATIENCE + 5);
  assert.equal(inst.parade.length, 1);
  assert.equal(inst.copied, 0);
});

test('hands up to copy a giraffe is not hands up to pause', () => {
  kids('stand');
  const inst = game.create(1);
  posing(inst);
  assert.equal(inst.pausable(), false);
  kids('giraffe'); run(inst, 4);
  assert.equal(inst.cur.name, 'bird');
  run(inst, 1);
  assert.equal(inst.pausable(), true, 'arms out for a bird: pausing works again');
});

test('the round ends with the whole parade out front', () => {
  kids('stand');
  const inst = game.create(1);
  let done = false;
  for (let i = 0; i < 60 * 10 && !done; i++) done = inst.outro(DT, W, H);
  assert.ok(done);
});
