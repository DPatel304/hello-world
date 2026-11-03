import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story, ROLLER, NARROW, WIDE, LEAP_H, LEAP_BIG, SPEED } from '../src/games/lkp-game.js';
import { PAL, RUN } from '../src/games/lkp-art.js';
import { PATH_HALF } from '../src/games/lkp-world.js';
import { GRAB_MAX, RIDE, LAND } from '../src/games/lkp-zip.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 30;
const fake = () => new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });
function crew(n = 1){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => { p.present = i < n; p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right }; p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null; });
}
const corridor = (inst, n) => { const idx = inst.level.plan.map((k, i) => k === 'corridor' ? i : -1).filter(i => i >= 0)[n]; inst.step_ = idx - 1; inst.things = []; inst._next(); };
/* Running a corridor with nobody doing anything, past a kind of thing. */
const upTo = (inst, kind, ahead = 0.2) => { for (let k = 0; k < 4000; k++){ const th = inst.things.find(t => t.kind === kind); if (th && th.d - inst.z - RUN < ahead) return th; if (inst.levelup) inst.levelup.t = 1e9; inst.step(DT, W, H); } };
const quiet = (inst) => { inst.leanOf = () => 0; inst.duckOf = () => false; inst.jumps = { step: () => [] }; };

test('no pausing by gesture in this game: hands up is how you play', () => {
  story.on = false; crew(1);
  assert.equal(game.create(1).pausable(), false);
});

test('all of level 1 is the one place, and the only jump is the big one', () => {
  story.on = false; crew(1);
  const inst = game.create(1);
  const key = PAL.world.key, kinds = new Set(inst.things.map(t => t.kind));
  for (const n of [1, 2, 3]){ corridor(inst, n); inst.things.forEach(t => kinds.add(t.kind)); assert.equal(PAL.world.key, key); }
  assert.ok(!kinds.has('gap') && !kinds.has('ledge'), 'no little ditches');
  for (const k of ['narrow', 'wide', 'ravine', 'zip', 'roller']) assert.ok(kinds.has(k), k);
});

test('the path squeezes everyone together, then opens out and spreads them wide', () => {
  story.on = false; crew(4);
  const inst = game.create(4); quiet(inst);
  inst.scene = null;
  const spread = () => Math.max(...inst.here.map(i => inst.crew[i].x)) - Math.min(...inst.here.map(i => inst.crew[i].x));
  for (let k = 0; k < 30; k++) inst.step(DT, W, H);
  const normal = spread();
  const nar = inst.things.find(t => t.kind === 'narrow');
  while (inst.z + RUN < nar.d + 0.5) inst.step(DT, W, H);
  for (let k = 0; k < 20; k++) inst.step(DT, W, H);
  assert.ok(spread() < normal * (NARROW / PATH_HALF) * 1.15, 'squeezed');
  assert.ok(inst.here.every(i => Math.abs(inst.crew[i].x) < NARROW), 'all inside the narrow path');
  const wide = inst.things.find(t => t.kind === 'wide');
  while (inst.z + RUN < wide.d + 0.6) inst.step(DT, W, H);
  for (let k = 0; k < 20; k++) inst.step(DT, W, H);
  assert.ok(spread() > normal * 1.4, 'spread out');
  inst.draw(fake(), W, H);
});

test('at the ravine everyone leaps it - higher for a hop at the edge, high enough for the gold', () => {
  story.on = false; crew(2);
  const inst = game.create(2); quiet(inst);
  corridor(inst, 1);
  const rv = upTo(inst, 'ravine', SPEED * 0.5);
  /* player 0 hops at the edge */
  let hopped = false;
  inst.jumps = { step: () => (!hopped ? (hopped = true, [0]) : []) };
  inst.step(DT, W, H); inst.jumps = { step: () => [] };
  assert.ok(rv.bonus.has(0) && !rv.bonus.has(1));
  let peak = [0, 0], crystals = inst.crystals;
  for (let k = 0; k < 300 && (!inst.leap || inst.leapU < 1) ; k++){
    inst.step(DT, W, H);
    peak = peak.map((m, i) => Math.max(m, inst.crew[i].air));
    if (k % 15 === 0) inst.draw(fake(), W, H);
  }
  assert.ok(peak[1] > LEAP_H * 0.9 && peak[1] < LEAP_BIG * 0.7, 'over it');
  assert.ok(peak[0] > LEAP_BIG * 0.9, 'higher');
  for (let k = 0; k < 30; k++) inst.step(DT, W, H);
  assert.equal(inst.leap, null, 'landed');
  assert.ok(inst.crew.slice(0, 2).every(rn => rn.air === 0));
});

test('the zip line: hands up to grab on, away over the valley swinging for crystals, and down', () => {
  story.on = false; crew(2);
  const inst = game.create(2); quiet(inst);
  corridor(inst, 2);
  upTo(inst, 'zip', 0.14);
  for (let k = 0; k < 20; k++) inst.step(DT, W, H);
  assert.ok(inst.zip && inst.zip.phase === 'grab');
  const z = inst.z;
  for (let k = 0; k < 30; k++) inst.step(DT, W, H);
  assert.ok(Math.abs(inst.z - z) < 0.01, 'waiting at the platform');
  inst.draw(fake(), W, H);
  /* one grabs on; then the other */
  pose.players[0].hands.right = { x: 0.5, y: 0.1, vx: 0, vy: 0, speed: 0 };
  for (let k = 0; k < 20; k++) inst.step(DT, W, H);
  assert.ok(inst.zip.on[0] && !inst.zip.on[1] && inst.zip.phase === 'grab');
  pose.players[1].hands.right = { x: 0.5, y: 0.1, vx: 0, vy: 0, speed: 0 };
  for (let k = 0; k < 60; k++) inst.step(DT, W, H);
  assert.equal(inst.zip.phase, 'ride');
  /* leaning hard, swinging all the way over */
  inst.leanOf = (i) => i === 0 ? -1 : 1;
  const got = inst.crystals;
  for (let k = 0; k < 60; k++) inst.step(DT, W, H);
  assert.ok(inst.crew[0].x < -0.6 && inst.crew[1].x > 0.6, 'swung across');
  inst.draw(fake(), W, H);
  for (let k = 0; k < (RIDE + LAND + 1) * 30 && inst.zip; k++) inst.step(DT, W, H);
  assert.equal(inst.zip, null, 'landed and running');
  assert.ok(inst.crystals > got, 'picked some up');
  crew(2);
});

test('nobody grabbing on never holds the zip line up for ever', () => {
  story.on = false; crew(1);
  const inst = game.create(1); quiet(inst);
  corridor(inst, 2);
  upTo(inst, 'zip', 0.14);
  for (let k = 0; k < (GRAB_MAX + 2) * 30; k++) inst.step(DT, W, H);
  assert.ok(!inst.zip || inst.zip.phase !== 'grab');
});

test('a rolling log hits whoever is where it crosses, and nobody else', () => {
  story.on = false; crew(2);
  const inst = game.create(2);
  corridor(inst, 1);
  inst.leanOf = () => 0;
  for (const i of [0, 1]){ inst.crew[i].x = inst._home(i); inst.crew[i].safe = 0; }
  assert.ok(inst._home(1) - inst._home(0) > ROLLER * 2 + 0.2);
  inst.things = [{ kind: 'roller', d: inst.z + RUN + 0.05, end: inst._home(0), dir: 1 }];
  const hp = inst.crew.map(rn => rn.hp);
  for (let k = 0; k < 30; k++) inst.step(DT, W, H);
  assert.ok(inst.crew[0].hp < hp[0], 'hit');
  assert.equal(inst.crew[1].hp, hp[1], 'missed');
});
