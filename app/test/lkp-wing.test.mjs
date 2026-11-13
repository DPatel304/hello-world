import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story, AFTER } from '../src/games/lkp-game.js';
story.on = false;
import { IN, LIFT, EDGE, LEAP, LOOK, START, TIP, REST, MAX } from '../src/games/lkp-wing.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 30;
const canvas = () => new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });

function atWing(n = 1){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => { p.present = i < n; });
  const inst = game.create(n);
  inst.step(DT, W, H); inst.things = [];
  inst.step_ = inst.level.plan.indexOf('wing') - 1; inst._next();
  return inst;
}
/* marchOf stands in for the legs: running (1) or standing still (0). */
function go(inst, secs, march){
  inst.marchOf = () => march;
  for (let k = 0; k < secs / DT; k++) inst.step(DT, W, H);
}

test('level 1: past Zubu, the hill lifts - it\'s her wing - and running climbs it faster', () => {
  const inst = atWing(1);
  assert.equal(inst.phase, 'wing');
  assert.ok(inst.wing);
  go(inst, IN + 0.1, 1);
  assert.equal(inst.wing.phase, 'climb');
  assert.ok(inst.wing.angle > REST, 'it has started to lift');
  inst.draw(canvas(), W, H);
  const fast = inst.wing.along;
  go(inst, 6, 1);
  const ran = inst.wing.along - fast;
  const slow = atWing(1);
  go(slow, IN + 0.1, 0); const s0 = slow.wing.along; go(slow, 6, 0);
  const walked = slow.wing.along - s0;
  assert.ok(walked > 0, 'standing still, they still walk on up');
  assert.ok(ran > walked * 1.5, `running climbs faster (${ran.toFixed(3)} vs ${walked.toFixed(3)})`);
});

test('the wing never hurts: bumped by what slides down, it\'s a BOING; at the tip they leap, land, and see it settle - then on', () => {
  const inst = atWing(2);
  const hp = inst.crew.map(rn => rn.hp);
  go(inst, IN + 0.1, 0);
  for (let k = 0; k < 60 / DT && inst.wing.phase === 'climb'; k++){ inst.marchOf = () => 0; inst.step(DT, W, H); }
  assert.equal(inst.wing.phase, 'edge', 'walking, they still reach the tip');
  assert.ok(inst.wing.bonks > 0, 'something slid into them on the way: BOING');
  assert.deepEqual(inst.crew.map(rn => rn.hp), hp, 'nobody hurt');
  go(inst, EDGE + 0.1, 0);
  assert.equal(inst.wing.phase, 'leap', 'nobody jumped: they leap anyway');
  go(inst, LEAP + 0.7, 0);
  assert.equal(inst.wing.phase, 'look');
  inst.draw(canvas(), W, H);
  go(inst, LOOK, 0);
  assert.ok(Math.abs(inst.wing.angle - REST) < 0.01, 'it settled back down: a hill again');
  go(inst, AFTER.wing + 1, 0.5);
  assert.equal(inst.phase, 'corridor');
});
