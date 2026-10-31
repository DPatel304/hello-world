import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story, MAX_HP } from '../src/games/lkp-game.js';
import { THRESHOLDS, XP, UPGRADES, needFor } from '../src/games/lkp-levelup.js';
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
  inst.addXp(THRESHOLDS[0] - 1);
  assert.equal(inst.lvl, 1);
  inst.addXp(1);
  assert.equal(inst.lvl, 2);
  inst.addXp(needFor(2) + needFor(3));
  assert.equal(inst.lvl, 4);
  assert.equal(inst.pending, 3);
});

test('knocking things out, clearing a fight and beating the boss all give XP', () => {
  crew(1);
  const inst = game.create(1);
  inst.step(DT, W, H);
  inst.things = []; inst.rooms.push('combat'); inst.step_ = 1; inst._next();
  const f = inst.fight; f.len = 999;
  const xp = () => inst.xp + [1, 2, 3, 4, 5, 6, 7].filter(l => l < inst.lvl).reduce((s, l) => s + needFor(l), 0);
  const before = xp();
  f._hit(f.bots[0], 9999, W, H);
  assert.equal(xp() - before, XP.kill);
  f.bots = []; f.queue = 0; f.wave = 1;
  inst.fight.step(DT, W, H, []);
  assert.equal(xp() - before, XP.kill + XP.fight);
});

test('a level up waits for a calm moment - never mid-fight', () => {
  crew(1);
  const inst = game.create(1);
  inst.step(DT, W, H);
  inst.things = []; inst.rooms.push('combat'); inst.step_ = 1; inst._next();
  inst.addXp(THRESHOLDS[0]);
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
  inst.addXp(THRESHOLDS[0]);
  inst.step(DT, W, H);
  const lu = inst.levelup;
  assert.ok(lu);
  const z = inst.z;
  pickAt(inst, 0, -0.9);
  assert.equal(lu.took[0], 0, 'left card');
  assert.equal(inst.z, z, 'everything waits');
  pickAt(inst, 1, 0.9);
  assert.equal(inst.levelup, null, 'done');
  const a = lu.cards[0][0], b = lu.cards[1][2];
  const has = (rn, k) => k === 'fists' ? rn.fists > 1 : k === 'wheels' ? rn.wheels > 1 : k === 'vitality' ? rn.max > MAX_HP : rn.swift > 1;
  assert.ok(has(inst.crew[0], a), a);
  assert.ok(has(inst.crew[1], b), b);
});

test('nobody picking, it takes what they lean to, in the end', () => {
  crew(1);
  const inst = game.create(1);
  inst.step(DT, W, H);
  inst.addXp(THRESHOLDS[0]);
  inst.step(DT, W, H);
  inst.levelup.len = 2;
  run(inst, 2.5);
  assert.equal(inst.levelup, null);
  assert.equal(inst.pending, 0);
});

test('STRONGER hits harder; HEALTH adds health; they stack', () => {
  crew(1);
  const inst = game.create(1);
  const rn = inst.crew[0];
  UPGRADES.fists.apply(rn); UPGRADES.fists.apply(rn);
  assert.equal(rn.fists, 1.5);
  UPGRADES.vitality.apply(rn);
  assert.equal(rn.max, MAX_HP + 20);
  inst.step(DT, W, H);
  inst.things = []; inst.rooms.push('combat'); inst.step_ = 1; inst._next();
  run(inst, 0.3);
  const b = { x: rn.x, d: FRONT, hp: 999, max: 999, hitT: 0, target: -1, flash: 0, swing: 0, seed: 0 };
  inst.fight.bots = [b]; inst.fight.queue = 0; inst.fight.wave = 1;
  rn.swingT = SWING;
  inst.fight.step(DT, W, H, []);
  assert.equal(999 - b.hp, Math.round(SWING_HIT * 1.5));
});

test('the level up draws', () => {
  crew(3);
  const inst = game.create(3);
  inst.step(DT, W, H);
  inst.addXp(THRESHOLDS[0]); inst.step(DT, W, H);
  inst.levelup.took[1] = 2;
  inst.draw(new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }), W, H);
});
