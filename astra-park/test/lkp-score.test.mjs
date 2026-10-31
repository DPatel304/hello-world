import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story, SCORE } from '../src/games/lkp-game.js';
import { scores } from '../src/games/common.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 30;
function crew(n){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null;
  });
}
const fake = () => new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });

test('the score is every coin, 10 a knockout and 500 a boss', () => {
  story.on = false; crew(2);
  const inst = game.create(2);
  inst.coins = 37; inst.kills = 12; inst.bosses = 1;
  assert.equal(inst.value(), 37 + 12 * SCORE.kill + SCORE.boss);
  assert.equal(inst.tally()[0].value, inst.value());
});

test('beating the boss counts; it giving up on its own does not', () => {
  story.on = false; crew(1);
  const a = game.create(1);
  a.step(DT, W, H); a.step_ = a.level.plan.indexOf('boss') - 1; a._next();
  a.boss.body.hp = 0; a.step(DT, W, H);
  assert.equal(a.bosses, 1);
  const b = game.create(1);
  b.step(DT, W, H); b.step_ = b.level.plan.indexOf('boss') - 1; b._next();
  b.boss.len = 0; b.step(DT, W, H);
  assert.equal(b.bosses, 0);
});

test('at the end, the tally counts up - coins, knockouts, the boss, the score - before the results', () => {
  story.on = true; crew(2);
  const inst = game.create(2);
  inst.scene = null; inst.coins = 20; inst.kills = 5; inst.bosses = 1;
  inst.over = true;
  let k = 0;
  while (!inst.outro(DT, W, H) && k++ < 3000) if (k % 20 === 0) inst.draw(fake(), W, H);
  assert.ok(k < 3000);
  assert.equal(inst.out.score, 20 + 50 + 500);
  assert.equal(inst.out.counted, inst.tallyLines().length);
  assert.equal(inst.out.best, scores.best('last-known-position', 2));
  story.on = false;
});
