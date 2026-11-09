import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story, GOLD_EVERY, FLYING } from '../src/games/lkp-game.js';
import { needFor } from '../src/games/lkp-levelup.js';
import { TREASURE_TIME as LEN, CALM, CRYSTALS, RAIN, POOL, POOL_HEAL } from '../src/games/lkp-treasure.js';
/* The whole crystal grab: the calm start, then the crystals coming down. */
const TREASURE_TIME = CALM + LEN;
import { pose, L } from '../src/tracking/pose.js';
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
  inst.things = []; inst.rooms.push('treasure'); inst.step_ = inst.level.plan.indexOf('room') - 1; inst._next();
  assert.ok(inst.treasure);
  return inst;
}

test('a treasure room starts empty, then crystals come down from the ceiling to the floor - and no healing while they\'re grabbed', () => {
  const inst = treasure();
  inst.crew[0].hp = 30;
  run(inst, CALM - 0.2);
  assert.equal(inst.treasure.crystals.length, 0, 'a moment to find your feet');
  run(inst, 2);
  const tr = inst.treasure, n = tr.crystals.length;
  assert.ok(n >= RAIN && n <= CRYSTALS);
  assert.ok(tr.crystals.every(cn => cn.y < 0.3 && cn.vy > 0), 'from the top, coming down');
  run(inst, 15);
  assert.ok(tr.crystals.every(cn => cn.y < 1), 'gone at the floor');
  assert.equal(inst.crew[0].hp, 30);
  assert.ok(inst.speed < 0.02);
});

/* Player i hugging themselves (or not). */
function hugging(i, on = true){
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));
  lm[L.L_SHOULDER] = { x: 0.55, y: 0.4, v: 0.9 }; lm[L.R_SHOULDER] = { x: 0.45, y: 0.4, v: 0.9 };
  lm[L.L_WRIST] = on ? { x: 0.455, y: 0.41, v: 0.9 } : { x: 0.6, y: 0.7, v: 0.9 };
  lm[L.R_WRIST] = on ? { x: 0.545, y: 0.41, v: 0.9 } : { x: 0.4, y: 0.7, v: 0.9 };
  pose.players[i].lm = lm;
}

test('the crystals done, POOL seconds of healing water for the whole team - hugging heals faster - then on', () => {
  const inst = treasure(2);
  inst.crew[0].hp = 20; inst.crew[1].hp = 20;
  hugging(1);
  run(inst, TREASURE_TIME + 0.05);
  assert.ok(inst.treasure.pool > 0, 'the water');
  assert.equal(inst.phase, 'room');
  run(inst, POOL);
  const [a, b] = inst.crew.map(rn => rn.hp - 20);
  assert.ok(Math.abs(a - POOL_HEAL * POOL) < 2, `standing: +${a}`);
  assert.ok(b > a * 2.5, `hugging: +${b}`);
  pose.players[1].lm = null;
  run(inst, 1.5);
  assert.notEqual(inst.phase, 'room');
});

test('a hand touching a crystal grabs it, for the team', () => {
  const inst = treasure();
  run(inst, CALM + 1);
  const cn = inst.treasure.crystals[0], crystals = inst.crystals;
  cn.vx = cn.vy = 0;
  pose.players[1].hands.right = { x: cn.x, y: cn.y, vx: 0, vy: 0, speed: 0 };
  inst.step(DT, W, H);
  assert.ok(inst.crystals - crystals >= cn.worth);
  assert.equal(inst.treasure.got[1] >= cn.worth, true);
});

test('after its time, the room is over and the run goes on', () => {
  const inst = treasure();
  run(inst, TREASURE_TIME - 1);
  assert.equal(inst.phase, 'room');
  run(inst, POOL + 2.5);
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
  inst.pending = 0; inst.addXp(Array.from({ length: GOLD_EVERY }, (_, k) => needFor(inst.lvl + k)).reduce((a, b) => a + b, 0)); inst.pending = 0;
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

test('every GOLD_EVERY-th level up is a gold pick; the crystals stay the score, and never too many fly at once', () => {
  crew(1);
  const inst = game.create(1);
  inst.step(DT, W, H);
  for (let k = 0; k < GOLD_EVERY * 2; k++) inst.addXp(needFor(inst.lvl));
  assert.equal(inst.golds, 2);
  assert.equal(inst.pending, GOLD_EVERY * 2 - 2);
  for (let k = 0; k < 20; k++) inst.gain(1, 0.5, 0.5);
  assert.equal(inst.crystals, 20);
  assert.ok(inst.flyers.length <= FLYING);
});
