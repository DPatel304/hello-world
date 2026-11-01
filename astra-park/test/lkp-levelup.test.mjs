import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story, MAX_HP } from '../src/games/lkp-game.js';
import { XP, needFor } from '../src/games/lkp-levelup.js';
import { take, MAX_LEVEL, HP_UP, DAMAGE_UP, ARMOR_UP } from '../src/games/lkp-weapons.js';
import { SWING, SWING_HIT, FRONT } from '../src/games/lkp-combat.js';
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
/* Player i leaning to lane x and waving (the mouse waving is a wiggle). */
function pickAt(inst, i, x, secs = 2){
  for (let k = 0; k < secs / DT; k++){
    pose.players[i].hands.right = { x: 0.5 + x / 2.5 + (Math.floor(k / 9) % 2 ? 0.04 : -0.04), y: 0.3, vx: 0, vy: 0, speed: 0 };
    inst.step(DT, W, H);
  }
  pose.players[i].hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 };
}

test('the team levels up at each threshold of shared XP', () => {
  crew(1);
  const inst = game.create(1);
  inst.addXp(needFor(1) - 1);
  assert.equal(inst.lvl, 1);
  inst.addXp(1);
  assert.equal(inst.lvl, 2);
  inst.addXp(needFor(2) + needFor(3));
  assert.equal(inst.lvl, 4);
  assert.equal(inst.pending, 3);
  /* Often at first, then steadily less often. */
  assert.ok(needFor(1) < needFor(5) && needFor(5) < needFor(10));
});

test('knocking things out, clearing a fight and beating the boss all give XP', () => {
  crew(1);
  const inst = game.create(1);
  inst.step(DT, W, H);
  inst.things = []; inst.rooms.push('combat'); inst.step_ = 1; inst._next();
  const f = inst.fight; f.len = 999;
  const xp = () => inst.xp + Array.from({ length: inst.lvl - 1 }, (_, k) => needFor(k + 1)).reduce((s, n) => s + n, 0);
  const before = xp();
  f._hit(f.bots[0], 9999, W, H);
  assert.equal(xp() - before, XP.kill);
  f.bots = []; f.queue = 0; f.wave = 1;
  inst.fight.step(DT, W, H, []);
  assert.equal(xp() - before, XP.kill + XP.fight);
});

test('levelling up mid-fight is fine - but the picking waits till the room is over', () => {
  crew(1);
  const inst = game.create(1);
  inst.step(DT, W, H);
  inst.things = []; inst.rooms.push('combat'); inst.step_ = 1; inst._next();
  inst.addXp(needFor(1));
  run(inst, 1);
  assert.equal(inst.levelup, null, 'not in a fight');
  inst.fight.bots = []; inst.fight.queue = 0; inst.fight.wave = 1;
  for (let k = 0; k < 600 && !inst.levelup; k++) inst.step(DT, W, H);
  assert.ok(inst.levelup, 'after it');
  assert.ok(inst.calm);
});

test('everyone leans to a card and waves to take it - and has it', () => {
  crew(2);
  const inst = game.create(2);
  inst.step(DT, W, H);
  inst.addXp(needFor(1));
  inst.step(DT, W, H);
  const lu = inst.levelup;
  assert.ok(lu);
  const z = inst.z;
  pickAt(inst, 0, -0.9);
  assert.equal(lu.took[0], 0, 'left card');
  assert.equal(inst.z, z, 'everything waits');
  pickAt(inst, 1, 0.9);
  assert.equal(inst.levelup, null, 'done');
  /* Something changed for each: a card taken. */
  const changed = (rn) => Object.values(rn.up || {}).some(v => v > 0);
  assert.ok(changed(inst.crew[0]) && changed(inst.crew[1]));
});

test('nobody picking, it takes what they lean to, in the end', () => {
  crew(1);
  const inst = game.create(1);
  inst.step(DT, W, H);
  inst.addXp(needFor(1));
  inst.step(DT, W, H);
  inst.levelup.len = 2;
  run(inst, 2.5);
  assert.equal(inst.levelup, null);
  assert.equal(inst.pending, 0);
});

test('DAMAGE hits harder, both weapons; MAX HP adds health; they stack', () => {
  crew(1);
  const inst = game.create(1);
  const rn = inst.crew[0];
  take('damage', rn); take('damage', rn);
  assert.equal(rn.up.damage, 2);
  take('maxhp', rn);
  assert.equal(rn.max, MAX_HP + HP_UP);
  inst.step(DT, W, H);
  inst.things = []; inst.rooms.push('combat'); inst.step_ = 1; inst._next();
  run(inst, 0.3);
  const b = { x: rn.x, d: FRONT, hp: 999, max: 999, hitT: 0, target: -1, flash: 0, swing: 0, seed: 0 };
  inst.fight.bots = [b]; inst.fight.queue = 0; inst.fight.wave = 1;
  rn.swingT = SWING;
  inst.fight.step(DT, W, H, []);
  assert.equal(999 - b.hp, Math.round(SWING_HIT * (1 + 2 * DAMAGE_UP)));
});

test('max HP is a card now: levelling up alone adds none', () => {
  crew(1);
  const inst = game.create(1);
  inst.step(DT, W, H);
  inst.addXp(needFor(1) + needFor(2));
  assert.equal(inst.crew[0].max, MAX_HP);
});

test('ARMOR takes some off every hit - never all of it', () => {
  crew(1);
  const inst = game.create(1);
  const rn = inst.crew[0];
  inst.step(DT, W, H);
  inst._hurt(0, 20, W, H);
  const plain = MAX_HP - rn.hp;
  rn.hp = MAX_HP; for (let k = 0; k < MAX_LEVEL; k++) take('armor', rn);
  inst._hurt(0, 20, W, H);
  assert.equal(MAX_HP - rn.hp, Math.round(plain * (1 - MAX_LEVEL * ARMOR_UP)));
  rn.hp = MAX_HP; inst._hurt(0, 1, W, H);
  assert.equal(MAX_HP - rn.hp, 1);
});

test('a gold card counts twice; no card goes past MAX_LEVEL', () => {
  const rn = { max: 100, hp: 100 };
  take('speed', rn, true);
  assert.equal(rn.up.speed, 2);
  for (let k = 0; k < 20; k++) take('speed', rn, true);
  assert.equal(rn.up.speed, MAX_LEVEL);
  for (let k = 0; k < 9; k++) take('maxhp', rn);
  take('maxhp', rn, true);
  assert.equal(rn.max, 100 + HP_UP * MAX_LEVEL, 'gold at 9: just the one more');
});

test('everyone gets the same three cards - and a card you\'ve maxed can\'t be taken', () => {
  crew(2);
  const inst = game.create(2);
  inst.step(DT, W, H);
  inst.addXp(needFor(1)); inst.step(DT, W, H);
  const lu = inst.levelup;
  assert.ok(lu.shared);
  assert.equal(lu.cards[0].length, 3);
  assert.equal(lu.cards[0], lu.cards[1]);
  assert.equal(new Set(lu.cards[0].map(c => c.key)).size, 3);
  /* Player 1's maxed the left card: leaning to it, they still end up with
     another; player 2 gets it. */
  const left = lu.cards[0][0].key, r0 = inst.crew[0], r1 = inst.crew[1];
  r0.up = { [left]: MAX_LEVEL };
  const was = { ...r0.up };
  pose.players[0].centre.x = 0.5;
  lu.at = [0, 0, 0, 0]; lu.took = [null, null, null, null];
  lu._finish();
  assert.equal(r0.up[left], MAX_LEVEL);
  assert.ok(Object.keys(r0.up).some(k => (r0.up[k] || 0) > (was[k] || 0)), 'took another');
  assert.ok((r1.up[left] || 0) > 0);
});

test('the level up draws', () => {
  crew(3);
  const inst = game.create(3);
  inst.step(DT, W, H);
  inst.addXp(needFor(1)); inst.step(DT, W, H);
  inst.levelup.took[1] = 2;
  inst.draw(new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }), W, H);
});
