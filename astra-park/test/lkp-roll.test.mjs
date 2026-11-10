import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story, AFTER } from '../src/games/lkp-game.js';
story.on = false;
import { START, NEAR, IN, ROLL, STOP } from '../src/games/lkp-roll.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 30;
const canvas = () => new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });

function atRoll(n = 1){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => { p.present = i < n; });
  const inst = game.create(n);
  inst.step(DT, W, H); inst.things = [];
  inst.step_ = inst.level.plan.indexOf('roll') - 1; inst._next();
  return inst;
}
/* marchOf stands in for the legs: running (1) or standing still (0). */
function go(inst, secs, march){
  inst.marchOf = () => march;
  for (let k = 0; k < secs / DT; k++) inst.step(DT, W, H);
}

test('level 1: after the sneak, Zubu rolls down the hill after them in her sleep - running keeps ahead of her', () => {
  const inst = atRoll(1);
  assert.equal(inst.phase, 'roll');
  assert.ok(inst.roll);
  go(inst, IN + 0.1, 1);
  assert.equal(inst.roll.phase, 'run');
  go(inst, 8, 1);
  const running = inst.roll.gap;
  assert.ok(running >= START - 0.01, `running, she doesn't gain (${running.toFixed(2)})`);
  const still = atRoll(1);
  go(still, IN + 0.1, 0); go(still, 4, 0);
  assert.ok(still.roll.gap < START - 0.4, `standing still, she gains (${still.roll.gap.toFixed(2)})`);
  inst.draw(canvas(), W, H);
});

test('the sleepy roll never hurts: caught up, or bumped by what rolls down, it\'s only a BOING - and on to the next run', () => {
  const inst = atRoll(2);
  const hp = inst.crew.map(rn => rn.hp);
  go(inst, IN + 0.1, 0);
  go(inst, 12, 0);
  assert.ok(inst.roll.bonks > 0, 'caught up with them: BOING');
  assert.ok(inst.roll.gap > NEAR, 'and bounced back up the hill');
  assert.deepEqual(inst.crew.map(rn => rn.hp), hp, 'nobody hurt');
  inst.draw(canvas(), W, H);
  go(inst, ROLL + STOP + AFTER.roll + 2, 0.5);
  assert.equal(inst.phase, 'corridor');
});
