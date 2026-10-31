import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story } from '../src/games/lkp-game.js';
import { TREASURE_COINS, OPEN, HEAL, TREASURE_MAX } from '../src/games/lkp-treasure.js';
import { pose } from '../src/tracking/pose.js';
/* The play itself, without the ship's computer's scenes. */
story.on = false;

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs) => { for (let k = 0; k < Math.round(secs / DT); k++) inst.step(DT, W, H); };
function crew(n){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null;
  });
}
function treasure(n = 2){
  crew(n);
  const inst = game.create(n);
  run(inst, 0.1);
  inst.things = []; inst.rooms.push('treasure'); inst.step_ = 1; inst._next();
  assert.ok(inst.treasure);
  inst.treasure.len = TREASURE_MAX;
  return inst;
}
/* Player i waving, for a moment. */
function wave(inst, i, secs = 2){
  for (let k = 0; k < secs / DT; k++){
    pose.players[i].hands.right = { x: 0.5 + (Math.floor(k / 9) % 2 ? 0.08 : -0.08), y: 0.3, vx: 0, vy: 0, speed: 0 };
    inst.step(DT, W, H);
  }
  pose.players[i].hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 };
}

test('a treasure room: the run stops, the chest opens, the coins are the team\'s, and everyone\'s healed', () => {
  const inst = treasure();
  inst.crew[0].hp = 30; inst.crew[1].hp = 70;
  const coins = inst.coins;
  run(inst, OPEN + HEAL + 0.2);
  assert.ok(inst.speed < 0.02, 'stopped');
  assert.equal(inst.coins - coins, TREASURE_COINS);
  assert.deepEqual([inst.crew[0].hp, inst.crew[1].hp], [inst.crew[0].max, inst.crew[1].max]);
});

test('everyone waves when they\'re ready - and only then does the run go on', () => {
  const inst = treasure();
  run(inst, OPEN + 0.2);
  wave(inst, 0);
  assert.ok(inst.treasure.ready[0] && !inst.treasure.ready[1]);
  run(inst, 3);
  assert.equal(inst.phase, 'room', 'waiting for the other');
  wave(inst, 1);
  run(inst, 1);
  assert.notEqual(inst.phase, 'room', 'and on');
});

test('nobody waving, it goes on by itself in the end', () => {
  const inst = treasure();
  inst.treasure.len = 5;
  run(inst, 7);
  assert.notEqual(inst.phase, 'room');
});

test('a treasure room draws', () => {
  const inst = treasure();
  run(inst, OPEN + 0.5);
  wave(inst, 0);
  inst.draw(new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }), W, H);
});
