import test from 'node:test';
import assert from 'node:assert/strict';
import game, { AFTER_BURST, ROUND } from '../src/games/dance-party.js';
import { standIn } from '../src/games/moon-art.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };

/* One child standing in the middle of the room. */
function child(){
  pose.mouse.active = false;
  const p = pose.players[0];
  p.present = true; p.lm = standIn(0.5); p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3;
  pose.players[1].present = false;
  return p;
}
function empty(){ pose.mouse.active = false; pose.players[0].present = false; pose.players[1].present = false; }
/* Move every joint back and forth by amp (in screen widths) twice a second. */
function dance(p, amp){
  const rest = standIn(0.5);
  return (t) => { const dx = Math.sin(t * 12.6) * amp; p.lm = rest.map(k => ({ ...k, x: k.x + dx, y: k.y + dx * 0.5 })); };
}

test('dancing builds the party up to a big moment, then it settles and builds again', () => {
  const p = child(), inst = game.create(1);
  run(inst, 10, dance(p, 0.06));
  assert.ok(inst.energy > 0.5, `party building: ${inst.energy.toFixed(2)}`);
  assert.equal(inst.bursts, 0, 'not straight away');
  let first = -1;
  run(inst, 50, (t) => { dance(p, 0.06)(t); if (inst.bursts && first < 0) first = t; });
  assert.ok(first > 0, 'a big moment');
  assert.ok(inst.bursts >= 2, `and again: ${inst.bursts}`);
  assert.ok(inst.bits.some(b => b.kind === 'streamer') || inst.bursts >= 2);
});

test('a big moment sets off streamers and confetti, and the party settles back', () => {
  const p = child(), inst = game.create(1);
  inst.energy = 0.999;
  run(inst, 0.5, dance(p, 0.06));
  assert.equal(inst.bursts, 1);
  assert.ok(inst.energy < AFTER_BURST + 0.1, 'settled');
  assert.ok(inst.bits.filter(b => b.kind === 'streamer').length >= 10);
  assert.ok(inst.bits.filter(b => b.kind === 'confetti').length >= 100);
});

test('standing still lets the party fade, and the dancers beckon', () => {
  const p = child(), inst = game.create(1);
  inst.t = 20; inst.energy = 0.8;
  run(inst, 10);
  assert.ok(inst.energy < 0.6, `faded: ${inst.energy.toFixed(2)}`);
  assert.ok(!inst.dancing, 'they beckon');
  run(inst, 1, dance(p, 0.06));
  assert.ok(inst.dancing, 'and stop once the child dances');
});

test('a gentle sway is not the same as dancing hard', () => {
  const soft = child(), a = game.create(1);
  run(a, 20, dance(soft, 0.004));
  const hard = child(), b = game.create(1);
  run(b, 20, dance(hard, 0.06));
  assert.ok(b.energy > a.energy + 0.3, `${a.energy.toFixed(2)} vs ${b.energy.toFixed(2)}`);
});

test('an empty room has no party and no big moments', () => {
  empty();
  const inst = game.create(1);
  run(inst, 40);
  assert.equal(inst.energy, 0);
  assert.equal(inst.bursts, 0);
  assert.equal(inst.value(), 0);
});

test('it plays loud, lasts three minutes, shows no score, and the curtsy ends', () => {
  assert.equal(game.loud, true);
  assert.equal(game.secs, ROUND);
  assert.equal(ROUND, 180);
  child();
  const inst = game.create(2);
  assert.equal(inst.hud().hideScore, true);
  let done = false, s = 0;
  for (; s < 10 && !done; s += DT) done = inst.outro(DT, W, H);
  assert.ok(done && s > 4, `ended after ${s.toFixed(1)}s`);
});
