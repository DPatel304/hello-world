import test from 'node:test';
import assert from 'node:assert/strict';
import game, { ADMIRE, CUP_GAP, CUP_GRACE, CURIOUS } from '../src/games/uncle-bs-boat.js';
import { byId } from '../src/games/fishing-fish.js';
import { WATER } from '../src/games/fishing-art.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };
/* One child's two hands, centred at (x, y) and gap screen heights apart. */
function hands(x, y, gap = 0.05){
  pose.mouse.active = false;
  const p = pose.players[0];
  p.present = true; pose.players[1].present = false;
  const dx = gap / 2 * H / W;
  p.hands.left = { x: x - dx, y, vx: 0, vy: 0, speed: 0 };
  p.hands.right = { x: x + dx, y, vx: 0, vy: 0, speed: 0 };
}
/* A round with the lake emptied, Uncle B done showing and the ghost away. */
function calm(){ hands(0.9, 0.2, 0.4); const inst = game.create(1); inst.fish = []; inst.spawn = 1e9; inst.uncle.shows = 1; inst.quiet = -1e9; inst.lastCatch = 1e9; return inst; }
function fishAt(inst, x, y, sp = byId.perch){ const f = inst._fish(false, sp); f.x = x; f.y = y; f.speed = 0; return f; }
/* Lift the hands from y0 to y1 over secs, staying cupped. */
const lift = (x, y0, y1, secs, gap = 0.05) => (t) => hands(x, y0 + (y1 - y0) * Math.min(1, t / secs), gap);

test('ghostly hands show how first thing, then Uncle B fishes and holds one up', () => {
  hands(0.9, 0.2, 0.4);
  const inst = game.create(1);
  inst.fish = []; inst.spawn = 1e9;
  run(inst, 2.5);
  assert.ok(inst.hinting, 'the ghost is showing');
  let shown = null;
  run(inst, 25, () => { if (inst.showing && !shown) shown = inst.showing; });
  assert.ok(shown, 'he held a fish up');
  assert.equal(shown.who, -1);
  assert.equal(inst.book.size, 0, "his catch doesn't fill the children's book");
});

test('hands cupped round a fish scoop it up; lifting it out catches it', () => {
  const inst = calm();
  const f = fishAt(inst, 0.5, 0.65, byId.koi);
  hands(0.5, 0.65); run(inst, 0.3);
  assert.equal(f.state, 'held');
  assert.equal(inst.caught, 0, 'not until it is out of the water');
  run(inst, 1, lift(0.5, 0.65, WATER - 0.1, 0.8));
  assert.equal(inst.caught, 1);
  assert.ok(inst.showing, 'held up for everyone');
  assert.equal(inst.showing.sp.id, 'koi');
  assert.equal(inst.showing.who, 0);
  assert.equal(inst.showing.isNew, true);
  assert.ok(inst.book.has('koi'));
  run(inst, ADMIRE + 0.5);
  assert.equal(inst.showing, null, 'and let go again');
  assert.ok(inst.fish.some(g => g.sp.id === 'koi' && g.state === 'away'), 'swimming off');
});

test('hands held wide apart do not scoop', () => {
  const inst = calm();
  const f = fishAt(inst, 0.5, 0.65);
  hands(0.5, 0.65, CUP_GAP * 2.5); run(inst, 2);
  assert.equal(f.state, 'swim');
  assert.equal(inst.cups[0].fish, null);
});

test('cupped hands above the water catch nothing', () => {
  const inst = calm();
  /* Just under the surface, near enough to reach - but from above. */
  const f = fishAt(inst, 0.5, WATER + 0.03);
  hands(0.5, WATER - 0.04); run(inst, 2);
  assert.equal(f.state, 'swim');
  assert.equal(inst.caught, 0);
});

test('opening the hands lets the fish swim off; a brief wobble does not', () => {
  const inst = calm();
  const f = fishAt(inst, 0.5, 0.65);
  hands(0.5, 0.65); run(inst, 0.3);
  assert.equal(f.state, 'held');
  hands(0.5, 0.6, CUP_GAP * 2); run(inst, CUP_GRACE * 0.5);
  hands(0.5, 0.6); run(inst, 0.3);
  assert.equal(f.state, 'held', 'a wobble keeps it');
  hands(0.5, 0.6, CUP_GAP * 2); run(inst, CUP_GRACE + 0.2);
  assert.equal(f.state, 'away');
  assert.equal(inst.caught, 0);
  assert.equal(inst.cups[0].fish, null);
});

test('fish swim over to look at cupped hands in the water', () => {
  const inst = calm();
  const f = fishAt(inst, 0.5 + 0.12 * H / W + 0.05, 0.7);
  hands(0.5, 0.6); run(inst, 4);
  assert.equal(f.state, 'held', 'it came close enough to scoop');
  const far = calm(), g = fishAt(far, 0.1, 0.85);
  hands(0.5 + (CURIOUS + 0.3) * H / W, 0.5); run(far, 3);
  assert.equal(g.state, 'swim');
  assert.ok(Math.abs(g.x - 0.1) < 0.01, 'too far away to notice');
});

test('with the mouse, the pointer is a cup', () => {
  const inst = calm();
  const f = fishAt(inst, 0.5, 0.65);
  pose.mouse.active = true;
  const p = pose.players[0];
  p.hands.right = { x: 0.5, y: 0.65, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
  run(inst, 0.3);
  assert.equal(f.state, 'held');
  pose.mouse.active = false;
});

test('the ghost steps aside while a child holds a fish', () => {
  hands(0.9, 0.2, 0.4);
  const inst = game.create(1);
  inst.fish = []; inst.spawn = 1e9;
  run(inst, 2.5);
  assert.ok(inst.hinting);
  fishAt(inst, 0.5, 0.65);
  hands(0.5, 0.65); run(inst, 0.3);
  assert.ok(!inst.hinting);
});

test('the round ends with the fish book', () => {
  const inst = calm();
  inst.book.add('perch'); inst.book.add('golden');
  let done = false;
  for (let i = 0; i < 60 * 12 && !done; i++) done = inst.outro(DT, W, H);
  assert.ok(done);
  assert.equal(inst.out.shown, 2, 'every fish found got its page');
});

test('the second of a kind is admired too, but it is not a new page', () => {
  const inst = calm();
  for (let n = 0; n < 2; n++){
    fishAt(inst, 0.5, 0.65, byId.perch);
    hands(0.5, 0.65); run(inst, 0.3);
    run(inst, 1, lift(0.5, 0.65, WATER - 0.1, 0.8));
    assert.ok(inst.showing);
    assert.equal(inst.showing.isNew, n === 0);
    run(inst, ADMIRE + 1.5);
  }
  assert.equal(inst.caught, 2);
  assert.equal(inst.book.size, 1);
});
