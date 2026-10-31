import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story } from '../src/games/lkp-game.js';
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
