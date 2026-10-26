import test from 'node:test';
import assert from 'node:assert/strict';
import popParty, { SIZES, MOTIONS } from '../src/games/pop-party.js';
import { pose } from '../src/tracking/pose.js';

function onePlayer(hand = { x:-1, y:-1 }){
  pose.mouse.active = false;
  const p = pose.players[0];
  p.present = true;
  p.hands.left  = { x:hand.x, y:hand.y, vx:0, vy:0, speed:0 };
  p.hands.right = { x:-1, y:-1, vx:0, vy:0, speed:0 };
  pose.players[1].present = false;
}

/* A balloon parked at one spot: no rise, no wander. */
function parked(inst, x, y, r = 0.065){
  const b = inst._make(x);
  Object.assign(b, { by:y, rise:0, r, worth:1, kind:'normal', motion:'drift', dir:0 });
  return b;
}

test('no black balloons: nothing spawned can cost the player', () => {
  const inst = popParty.create(1);
  const kinds = new Set();
  for (let i = 0; i < 3000; i++) kinds.add(inst._make().kind);
  assert.deepEqual([...kinds].sort(), ['normal', 'rainbow']);
  assert.equal(inst.hud().showLives, false);
});

test('balloons come in every size, and the small ones are worth more', () => {
  const inst = popParty.create(1);
  const seen = new Set();
  for (let i = 0; i < 3000; i++){
    const b = inst._make();
    const k = SIZES.findIndex(s => b.r >= s.r[0] && b.r <= s.r[1]);
    assert.ok(k >= 0, `radius ${b.r} is outside every size class`);
    seen.add(k);
    if (b.kind === 'normal') assert.equal(b.worth, SIZES[k].worth);
  }
  assert.equal(seen.size, SIZES.length, 'some size never spawned');
  assert.ok(SIZES[0].worth > SIZES[2].worth, 'the smallest should be worth the most');
});

test('balloons move in every pattern, not just straight up', () => {
  const inst = popParty.create(1);
  const seen = new Set();
  for (let i = 0; i < 3000; i++) seen.add(inst._make().motion);
  assert.deepEqual([...seen].sort(), Object.keys(MOTIONS).sort());

  /* And the patterns really differ: sample each one's sideways path. */
  const paths = Object.keys(MOTIONS).map(m => {
    const b = { f:2, ph:0, dir:1 };
    return Array.from({ length:8 }, (_, i) => MOTIONS[m].at(b, i * 0.4)[0].toFixed(3)).join();
  });
  assert.equal(new Set(paths).size, paths.length, 'two motions trace the same path');
});

test('a hand on a balloon pops it and scores', () => {
  onePlayer({ x:0.5, y:0.5 });
  const inst = popParty.create(1);
  inst.spawn = 99;
  inst.balloons.push(parked(inst, 0.5, 0.5));
  inst.step(1 / 60, 1920, 1080);
  assert.equal(inst.balloons.length, 0, 'balloon should have popped');
  assert.equal(inst.hud().score[0], 1);
});

test('a hand well away from a balloon leaves it alone', () => {
  onePlayer({ x:0.2, y:0.5 });
  const inst = popParty.create(1);
  inst.spawn = 99;
  inst.balloons.push(parked(inst, 0.5, 0.5));
  inst.step(1 / 60, 1920, 1080);
  assert.equal(inst.balloons.length, 1);
  assert.equal(inst.hud().score[0], 0);
});

test('a quick streak doubles the points from the fifth pop', () => {
  onePlayer();
  const inst = popParty.create(1);
  for (let i = 0; i < 6; i++) inst._hit(parked(inst, 0.5, 0.5), 0, 1920, 1080);
  assert.equal(inst.hud().score[0], 1 + 1 + 1 + 1 + 2 + 2);
});

test('a streak ends if you pause too long', () => {
  onePlayer();
  const inst = popParty.create(1);
  inst.spawn = 99;
  for (let i = 0; i < 4; i++) inst._hit(parked(inst, 0.5, 0.5), 0, 1920, 1080);
  for (let i = 0; i < 120; i++) inst.step(1 / 60, 1920, 1080);   /* two seconds */
  inst._hit(parked(inst, 0.5, 0.5), 0, 1920, 1080);
  assert.equal(inst.hud().score[0], 5, 'the fifth pop came after the streak ended');
});
