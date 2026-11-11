import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story } from '../src/games/lkp-game.js';
import { SHIP, DWELL, WALK, CLIMB, CREST, LOOK, SLIDE, PULL } from '../src/games/lkp-summit.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 30;
const fake = () => new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });
function crew(n){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => { p.present = i < n; p.hands.right = { x: 0.5, y: 0.6, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right }; p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null; });
}
const run = (inst, secs, each) => { for (let k = 0; k < secs / DT; k++){ each && each(k); if (inst.levelup) inst.levelup.t = 1e9; inst.step(DT, W, H); } };

test('the summit: up the hill, CLIMB hand over hand, over the top - the world, the title, Nova - then down onto the trail', () => {
  story.on = true; crew(2);
  const inst = game.create(2); inst.scene = null;
  const said = []; const say = inst.captain.say.bind(inst.captain); inst.captain.say = (t, w, o) => { said.push(t); return say(t, w, o); };
  inst._toSummit();
  assert.ok(inst.summit, 'up on the mountain');
  assert.equal(inst.summit.phase, 'ship', 'over to the ship first');
  const z = inst.z;
  inst.draw(fake(), W, H);
  run(inst, SHIP + 0.1);
  assert.equal(inst.summit.phase, 'scan');
  /* the scanner where they lean: the middle (the hull) - held there, scanned */
  inst.leanOf = () => 0;
  run(inst, DWELL + 0.8);
  assert.ok(inst.summit.scanned[1], 'the hull scanned');
  inst.draw(fake(), W, H);
  /* the bay's locked till the rest are done; then: empty */
  inst.leanOf = () => 1; run(inst, DWELL + 2.5);
  assert.ok(inst.summit.scanned[2], 'the engines scanned');
  inst.leanOf = () => -1; run(inst, DWELL + 2.5);
  assert.ok(inst.summit.scanned[0], 'the bay: the Star Core missing');
  assert.ok(said.includes(inst.level.lines.shipCore[0][1]), 'Nova: it\'s gone');
  inst.leanOf = () => 0;
  for (let k = 0; k < 40 / DT && inst.summit.phase !== 'walk'; k++) inst.step(DT, W, H);
  assert.equal(inst.summit.phase, 'walk', 'then off toward the hilltop');
  run(inst, WALK + 0.1);
  assert.equal(inst.summit.phase, 'climb');
  assert.ok(Math.abs(inst.z - z) < 0.001, 'the run waiting below');
  /* reaching up, a hand at a time: each one a pull up */
  const before = inst.summit.climb[0];
  run(inst, 0.3, () => { pose.players[0].hands.right.y = 0.1; }); run(inst, 0.3, () => { pose.players[0].hands.right.y = 0.6; });
  assert.ok(inst.summit.climb[0] >= before + PULL * 0.9, 'pulled up');
  inst.draw(fake(), W, H);
  run(inst, CLIMB + 0.2);
  assert.ok(['crest', 'look'].includes(inst.summit.phase), 'everyone up, and over the top');
  run(inst, CREST + LOOK + 8);
  assert.ok(said.includes(inst.level.lines.summit[0][1]), 'Nova: follow the river');
  inst.draw(fake(), W, H);
  run(inst, SLIDE + 1);
  assert.equal(inst.summit, null, 'down onto the trail');
  assert.ok(!inst.things.some(t => t.kind === 'ship'), 'the crash site far behind');
  run(inst, 2);
  assert.ok(inst.z > z, 'and off they go');
});
