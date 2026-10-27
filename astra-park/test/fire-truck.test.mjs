import test from 'node:test';
import assert from 'node:assert/strict';
import game, { STOP_X, SPEED, SIREN_SPEED, CHEER, PATIENCE, DUCK_TIME, LAST_START, HIT } from '../src/games/fire-truck.js';
import { TRUCK } from '../src/games/fire-truck-art.js';
import { faceBox } from '../src/ui/faces.js';
import { pose, L } from '../src/tracking/pose.js';

const W = 1920, H = 1080;
const run = (inst, secs) => { for (let i = 0; i < Math.round(secs * 60); i++) inst.step(1 / 60, W, H); };
/* The mouse stands in for one child's pointing hand. */
function hand(x, y){
  pose.mouse.active = true;
  pose.players[0].present = true; pose.players[1].present = false;
  pose.players[0].hands.right = { x, y, vx: 0, vy: 0, speed: 0 };
  pose.players[0].hands.left = { x, y, vx: 0, vy: 0, speed: 0 };
}
const away = () => hand(0.3, 0.97);
function arrive(inst, limit = 20){
  for (let t = 0; t < limit && inst.mode !== 'stop'; t += 0.1) run(inst, 0.1);
  assert.equal(inst.mode, 'stop', 'the truck pulled up');
}
/* A fresh truck heading for a stop of the given kind just ahead. */
function heading(kind){
  away();
  const inst = game.create(1);
  inst.stop = inst._plan(kind, 0.2);
  arrive(inst);
  return inst;
}

test('the truck drives, then pulls up for its first stop: one small fire', () => {
  away();
  const inst = game.create(1);
  assert.equal(inst.mode, 'drive');
  run(inst, 1);
  assert.ok(inst.dist > 0.1, 'moving');
  arrive(inst, 15);
  assert.equal(inst.stop.kind, 'fire');
  assert.equal(inst.stop.flames.length, 1);
  assert.ok(Math.abs(inst.stop.at - inst.dist - STOP_X) < 0.01, 'stopped with the house in reach');
});

test('water on the flames puts them out; water anywhere else does not', () => {
  away();
  const missed = game.create(1);
  arrive(missed, 15);
  hand(0.3, 0.3);
  run(missed, 5);
  assert.equal(missed.stop.flames[0].hp, 1, 'missing does nothing');

  const inst = game.create(1);
  arrive(inst, 15);
  const spot = inst._spot(inst.stop, inst.stop.flames[0], W, H);
  hand(spot.x + (HIT * 0.5) * H / W, spot.y);
  run(inst, 3);
  assert.equal(inst.stop.flames[0].hp, 0);
  assert.equal(inst.helped, 1);
  assert.equal(inst.mode, 'cheer');
});

test('after cheering, the truck drives on toward a different kind of stop', () => {
  const inst = heading('fire');
  /* Nearly done: one last flicker left. */
  inst.stop.flames.forEach((f, i) => { f.hp = i ? 0 : 0.001; });
  const spot = inst._spot(inst.stop, inst.stop.flames[0], W, H);
  hand(spot.x, spot.y);
  run(inst, 0.5);
  away();
  run(inst, CHEER + 0.1);
  assert.equal(inst.mode, 'drive');
  assert.ok(inst.stop && inst.stop.kind !== 'fire', `next is ${inst.stop && inst.stop.kind}`);
  assert.ok(inst.past && inst.past.done, 'the finished stop scrolls away behind');
});

test('the ladder reaches for a raised hand and the cat comes down to ride along', () => {
  const inst = heading('cat');
  const cat = inst._cat(inst.stop, W, H);
  hand(cat.x, cat.y);
  run(inst, 1);
  assert.notEqual(inst.stop.state, 'stuck', 'reached');
  run(inst, 2);
  assert.equal(inst.stop.state, 'riding');
  assert.equal(inst.riders.length, 1);
  assert.equal(inst.riders[0].kind, inst.stop.animal);
  assert.equal(inst.helped, 1);
});

test('a hand held low leaves the ladder resting', () => {
  const inst = heading('cat');
  hand(0.5, 0.95);
  run(inst, 2);
  assert.ok(Math.abs(inst.ladder.len - TRUCK.ladder.rest) < 5);
  assert.equal(inst.stop.state, 'stuck');
});

test('watering the garden brings every flower back up', () => {
  const inst = heading('garden');
  for (const f of inst.stop.flowers){
    const p = inst._spot(inst.stop, f, W, H);
    hand(p.x, p.y);
    run(inst, 1.6);
  }
  assert.ok(inst.stop.flowers.every(f => f.hp === 1));
  assert.equal(inst.helped, 1);
});

test('the ducks cross by themselves, and the truck waits for them', () => {
  const inst = heading('ducks');
  run(inst, DUCK_TIME - 1);
  assert.equal(inst.mode, 'stop', 'still waiting');
  run(inst, 1.2);
  assert.notEqual(inst.mode, 'stop');
});

test('a hand up high sounds the siren and hurries the truck; not at a stop', () => {
  away();
  const inst = game.create(1);
  inst.stop = null;
  hand(0.5, 0.1);
  run(inst, 2);
  assert.equal(inst.sirenOn, true);
  assert.ok(inst.v > SPEED * 1.3, `speed ${inst.v}`);
  away();
  run(inst, 2);
  assert.equal(inst.sirenOn, false);
  assert.ok(Math.abs(inst.v - SPEED) < 0.01);
  const at = heading('fire');
  hand(0.5, 0.1);
  run(at, 1);
  assert.equal(at.sirenOn, false);
});

test('nobody gets stuck: a stop finishes itself in the end', () => {
  for (const kind of ['fire', 'cat', 'garden']){
    const inst = heading(kind);
    run(inst, PATIENCE + 6);
    assert.ok(inst.helped >= 1, `${kind} finished`);
  }
});

test('no new stop starts close to the end', () => {
  const inst = heading('ducks');
  inst.t = LAST_START + 1;
  run(inst, DUCK_TIME + CHEER + 1);
  assert.equal(inst.stop, null);
});

test('the round ends with the truck parked at the fire station', () => {
  const inst = heading('fire');
  let done = false;
  for (let i = 0; i < 60 * 20 && !done; i++) done = inst.outro(1 / 60, W, H);
  assert.ok(done);
  assert.equal(inst.out.parked, true);
  assert.equal(inst.v, 0);
});

test('one child rides up front with the dalmatian behind; two get a window each', () => {
  hand(0.5, 0.5);
  const one = game.create(1);
  assert.deepEqual([one._seat(0), one._seat(1)], [-1, 0]);
  pose.mouse.active = false;
  pose.players[0].present = true; pose.players[1].present = true;
  const two = game.create(2);
  assert.deepEqual([two._seat(0), two._seat(1)], [0, 1]);
  pose.players[1].present = false;
  assert.equal(two._seat(1), -1, 'an empty seat gets the dalmatian');
});

/* ---- faces ---- */

function face(over = {}){
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));
  const set = (i, x, y) => { lm[i] = { x, y, v: 0.9 }; };
  /* Mirrored landmarks: the person's left eye is on the right of the screen. */
  set(L.NOSE, 0.5, 0.3); set(L.L_EYE, 0.52, 0.27); set(L.R_EYE, 0.48, 0.27); set(7, 0.55, 0.28); set(8, 0.45, 0.28);
  for (const [i, v] of Object.entries(over)) lm[i] = { ...lm[i], ...v };
  return lm;
}

test('a face is cut out around the nose, sized by the ears', () => {
  const b = faceBox(face(), 1280, 720);
  assert.ok(Math.abs(b.x - 640) < 1, 'nose is mid-frame, mirrored back');
  assert.ok(b.y < 0.3 * 720, 'a little above the nose');
  assert.ok(Math.abs(b.size - 0.1 * 1280 * 2.3) < 1);
  assert.ok(Math.abs(b.roll) < 1e-9, 'level head, level helmet');
});

test('the crop follows a face to the side, mirrored back into the video', () => {
  const lm = face();
  for (const i of [L.NOSE, L.L_EYE, L.R_EYE, 7, 8]) lm[i].x -= 0.3;
  const b = faceBox(lm, 1280, 720);
  assert.ok(Math.abs(b.x - 0.8 * 1280) < 1, 'screen left is video right');
});

test('a tilted head tilts the helmet the same way on screen', () => {
  const b = faceBox(face({ [L.L_EYE]: { y: 0.29 } }), 1280, 720);
  assert.ok(b.roll > 0);
});

test('no eyes, no face', () => {
  assert.equal(faceBox(face({ [L.L_EYE]: { v: 0.1 } }), 1280, 720), null);
  assert.equal(faceBox(null, 1280, 720), null);
  assert.equal(faceBox(face(), 0, 0), null);
});
