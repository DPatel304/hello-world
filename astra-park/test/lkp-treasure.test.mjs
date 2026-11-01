import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story, GOLD_COINS } from '../src/games/lkp-game.js';
import { TREASURE_TIME, COINS, HEAL } from '../src/games/lkp-treasure.js';
import { pose } from '../src/tracking/pose.js';
/* The play itself, without the ship's computer's scenes. */
story.on = false;

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs) => { for (let k = 0; k < Math.round(secs / DT); k++) inst.step(DT, W, H); };
function crew(n){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x: 0.5, y: 0.05, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null;
  });
}
function treasure(n = 2){
  crew(n);
  const inst = game.create(n);
  inst.step(DT, W, H);
  inst.things = []; inst.rooms.push('treasure'); inst.step_ = 1; inst._next();
  assert.ok(inst.treasure);
  return inst;
}

test('a treasure room is full of floating coins, and everyone\'s healed as they come in', () => {
  const inst = treasure();
  inst.crew[0].hp = 30;
  inst.treasure.from[0] = 30;
  run(inst, HEAL + 0.1);
  assert.equal(inst.treasure.coins.length, COINS);
  assert.equal(inst.crew[0].hp, inst.crew[0].max);
  assert.ok(inst.speed < 0.02);
});

test('a hand touching a coin grabs it, for the team - and another soon takes its place', () => {
  const inst = treasure();
  run(inst, 0.5);
  const cn = inst.treasure.coins[0], coins = inst.coins;
  cn.vx = cn.vy = 0;
  pose.players[1].hands.right = { x: cn.x, y: cn.y, vx: 0, vy: 0, speed: 0 };
  inst.step(DT, W, H);
  assert.ok(inst.coins - coins >= cn.worth);
  assert.equal(inst.treasure.got[1] >= cn.worth, true);
  pose.players[1].hands.right = { x: 0.5, y: 0.05, vx: 0, vy: 0, speed: 0 };
  run(inst, 1);
  assert.equal(inst.treasure.coins.length, COINS, 'replaced');
});

test('after its time, the room is over and the run goes on', () => {
  const inst = treasure();
  run(inst, TREASURE_TIME - 1);
  assert.equal(inst.phase, 'room');
  run(inst, 2.5);
  assert.notEqual(inst.phase, 'room');
});

test('a treasure room draws', () => {
  const inst = treasure();
  run(inst, 1);
  inst.draw(new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }), W, H);
});

test('the gold pick: three cards, every one gold - taken as the next corridor starts', () => {
  crew(2);
  const inst = game.create(2);
  inst.step(DT, W, H);
  /* The second room: a corridor after it. */
  inst.things = []; inst.rooms.push('treasure'); inst.step_ = inst.level.plan.lastIndexOf('room') - 1; inst._next();
  run(inst, TREASURE_TIME + 0.5);
  assert.equal(inst.golds, 0, 'the treasure room gives none of its own');
  inst.coins = GOLD_COINS;
  for (let k = 0; k < 600 && !inst.levelup; k++) inst.step(DT, W, H);
  assert.equal(inst.phase, 'corridor');
  assert.equal(inst.levelup.title, 'GOLD PICK!');
  assert.ok(inst.levelup.cards[0].every(c => c.gold));
  inst.levelup.t = 1e9; inst.step(DT, W, H); inst.step(DT, W, H);
  assert.equal(inst.golds, 0);
  /* Every card twice over: two levels of something. */
  assert.ok(Object.values(inst.crew[0].up).some(v => v === 2));
});

test('the music follows the run: hushed under a red light, loud for a fight', () => {
  const inst = treasure();
  assert.ok(inst.mood > 0.5);
  inst.treasure = null; inst.trap = { light: 'red', done: false };
  assert.equal(inst.mood, 0);
  inst.trap = null; inst.fight = { done: false };
  assert.ok(inst.mood >= 0.8);
});

test('every GOLD_COINS coins fills the gold bar: a gold pick - and the coins stay the score', () => {
  crew(1);
  const inst = game.create(1);
  inst.step(DT, W, H);
  inst.coins = GOLD_COINS - 1; inst.step(DT, W, H);
  assert.equal(inst.golds, 0);
  inst.coins = GOLD_COINS * 2 + 5; inst.step(DT, W, H);
  assert.equal(inst.golds, 2);
  assert.equal(inst.coins, GOLD_COINS * 2 + 5);
  inst.step(DT, W, H);
  assert.equal(inst.golds, 2, 'once each');
});
