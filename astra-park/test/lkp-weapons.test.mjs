import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story } from '../src/games/lkp-game.js';
import { MELEE, RANGED, STANDARD, arms, cardsFor, take } from '../src/games/lkp-weapons.js';
import { FRONT } from '../src/games/lkp-combat.js';
import { pose } from '../src/tracking/pose.js';
story.on = false;

const W = 1920, H = 1080, DT = 1 / 60;
function fight(n = 1){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null;
  });
  const inst = game.create(n);
  inst.step(DT, W, H);
  inst.things = []; inst.rooms.push('combat'); inst.step_ = 1; inst._next();
  for (let k = 0; k < 20; k++) inst.step(DT, W, H);
  return inst;
}
const bot = (x, d = FRONT) => ({ x, d, hp: 999, max: 999, hitT: 0, target: -1, flash: 0, swing: 0, seed: 0 });
const only = (inst, bots) => { inst.fight.bots = bots; inst.fight.queue = 0; inst.fight.wave = 1; return bots; };

test('everyone starts with the standard punch, and no ranged weapon', () => {
  const inst = fight();
  const a = arms(inst.crew[0]);
  assert.equal(a.melee.id, STANDARD.id);
  assert.equal(a.ranged, null);
});

test('a melee weapon hits everything in its reach, at its own pace and strength', () => {
  const inst = fight(), rn = inst.crew[0];
  rn.melee = MELEE.hammer;
  const bots = only(inst, [bot(rn.x), bot(rn.x + MELEE.hammer.reach * 0.8)]);
  rn.swingT = MELEE.hammer.every - DT / 2;
  inst.fight.step(DT, W, H, []);
  assert.deepEqual(bots.map(b => 999 - b.hp), [MELEE.hammer.dmg, MELEE.hammer.dmg]);
  rn.swingT = 0;
  for (let k = 0; k < (MELEE.hammer.every - 0.2) / DT; k++) inst.fight.step(DT, W, H, []);
  assert.equal(999 - bots[0].hp, MELEE.hammer.dmg, 'not again yet');
});

test('ranged fires only with nothing in reach - at the nearest robots still coming', () => {
  const inst = fight(), rn = inst.crew[0];
  rn.ranged = RANGED.zapper;
  const back = bot(0.8, 0.8), nearer = bot(-0.8, 0.5);
  only(inst, [back, nearer]);
  rn.fireT = RANGED.zapper.every - DT / 2;
  inst.fight.step(DT, W, H, []);
  assert.deepEqual([back, nearer].map(b => 999 - b.hp), [0, RANGED.zapper.dmg], 'the nearer one, whatever lane');
  /* One in reach: melee instead. */
  const coming = bot(0.8, 0.8);
  only(inst, [bot(rn.x), coming]);
  rn.fireT = 99; rn.swingT = 0;
  for (let k = 0; k < 10; k++) inst.fight.step(DT, W, H, []);
  assert.equal(coming.hp, 999, 'no shots with a robot in front');
});

test('the level-up cards are for their own weapons, and anyone\'s', () => {
  const rn = { max: 100, hp: 100 };
  assert.ok(!cardsFor(rn).includes('wider') && cardsFor(rn).includes('heavier'));
  rn.melee = MELEE.blades;
  assert.ok(cardsFor(rn).includes('wider') && !cardsFor(rn).includes('bolts'));
  rn.ranged = RANGED.zapper;
  assert.ok(cardsFor(rn).includes('bolts'));
  take('wider', rn); take('bolts', rn); take('quicker', rn);
  const a = arms(rn);
  assert.ok(a.melee.reach > MELEE.blades.reach && a.melee.every < MELEE.blades.every);
  assert.equal(a.ranged.bolts, 2);
});
