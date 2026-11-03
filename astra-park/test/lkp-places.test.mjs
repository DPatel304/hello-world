import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story, ROLLER, NARROW, WIDE, LEAP_H, LEAP_BIG, SPEED } from '../src/games/lkp-game.js';
import { PAL, RUN } from '../src/games/lkp-art.js';
import { PATH_HALF } from '../src/games/lkp-world.js';
import { COUNT, LATE, HOLD, RIDE, LAND, FALL } from '../src/games/lkp-zip.js';
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

const up = (i, on = true) => { pose.players[i].hands.right = { x: 0.5, y: on ? 0.1 : 0.5, vx: 0, vy: 0, speed: 0 }; };
/* Into the zip line's count, three of them. */
function toZip(n = 3){
  story.on = false; crew(n);
  const inst = game.create(n); quiet(inst);
  corridor(inst, 2);
  for (let k = 0; k < 4000 && !inst.zip; k++){ if (inst.levelup) inst.levelup.t = 1e9; inst.step(DT, W, H); }
  return inst;
}

test('the zip line counts them in without stopping; hands up in time, on the cable in the order they went up', () => {
  const inst = toZip(3);
  assert.equal(inst.zip.phase, 'ready');
  const z = inst.z;
  /* 2 first, then 0; 1 not yet */
  up(2); for (let k = 0; k < 10; k++) inst.step(DT, W, H);
  up(0); for (let k = 0; k < 10; k++) inst.step(DT, W, H);
  assert.ok(inst.z > z + 0.1, 'still running');
  assert.deepEqual(inst.zip.ready, [2, 0]);
  inst.draw(fake(), W, H);
  for (let k = 0; k < 4000 && inst.zip.phase === 'ready'; k++) inst.step(DT, W, H);
  assert.equal(inst.zip.phase, 'ride');
  assert.deepEqual(inst.zip.cable, [2, 0], 'the quickest at the front');
  /* 1, late: jumps for it, and catches the feet of the last one */
  up(1); for (let k = 0; k < (HOLD + 0.1) / DT; k++) inst.step(DT, W, H);
  assert.deepEqual(inst.zip.chain, [1]);
  inst.draw(fake(), W, H);
  crew(3);
});

/* A clap, with the mouse's two hands: apart, then together. */
function clap(inst, i){
  const p = pose.players[i];
  p.hands.left = { x: 0.2, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.8, y: 0.5, vx: 0, vy: 0, speed: 0 };
  for (let k = 0; k < 4; k++) inst.step(DT, W, H);
  p.hands.left = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 };
  for (let k = 0; k < 4; k++) inst.step(DT, W, H);
}

test('miss the zip line and you float along in a bubble, getting nothing - till your teammates clap it popped', () => {
  const inst = toZip(2);
  /* (the corridor going on long enough to see it through - at the fork it
     would pop by itself) */
  inst.seg.len = 1e9;
  up(0);
  for (let k = 0; k < 4000 && inst.zip.phase === 'ready'; k++) inst.step(DT, W, H);
  up(0, false);
  for (let k = 0; k < (LATE + 0.2) / DT; k++) inst.step(DT, W, H);
  assert.deepEqual(inst.zip.cable, [0]);
  assert.deepEqual(inst.zip.chain, []);
  assert.ok(inst.crew[1].bubble, 'in a bubble');
  assert.ok(!inst.over);
  /* clapping on the line does nothing; once they've landed, it pops */
  clap(inst, 0);
  assert.equal(inst.crew[1].bubble.claps, 0);
  for (let k = 0; k < 4000 && inst.zip; k++) inst.step(DT, W, H);
  assert.ok(inst.crew[1].bubble, 'still in it');
  inst.draw(fake(), W, H);
  /* nothing for a bubble: not a crystal right in their path */
  const got = inst.crystals;
  inst.things.push({ kind: 'crystal', d: inst.z + RUN + 0.02, lane: inst.crew[1].x });
  for (let k = 0; k < 10; k++) inst.step(DT, W, H);
  assert.equal(inst.crystals, got);
  /* standing by them (squeeze them together), clapping */
  inst.leanOf = (i) => i === 0 ? 1 : -1;
  for (let k = 0; k < 40; k++) inst.step(DT, W, H);
  for (let n = 0; n < 6 && inst.crew[1].bubble; n++) clap(inst, 0);
  assert.equal(inst.crew[1].bubble, null, 'popped');
  assert.ok(inst.crew[1].hp >= inst.crew[1].max * 0.5);
  crew(2);
});

test('a bubble nobody pops pops by itself at the fork', () => {
  story.on = false; crew(2);
  const inst = game.create(2); quiet(inst);
  corridor(inst, 1);
  inst.crew[1].bubble = { t: 0, claps: 0 };
  for (let k = 0; k < 6000 && inst.seg.kind === 'corridor'; k++){ if (inst.levelup) inst.levelup.t = 1e9; inst.step(DT, W, H); }
  assert.equal(inst.seg.kind, 'cross');
  assert.equal(inst.crew[1].bubble, null);
});

test('nobody up in time, but one jumps late: they catch the cable, and everyone else hangs on below', () => {
  const inst = toZip(2);
  for (let k = 0; k < 4000 && inst.zip.phase === 'ready'; k++) inst.step(DT, W, H);
  assert.equal(inst.zip.phase, 'late');
  up(1); for (let k = 0; k < (HOLD + 0.1) / DT; k++) inst.step(DT, W, H);
  assert.deepEqual(inst.zip.cable, [1]);
  assert.equal(inst.zip.phase, 'ride');
  crew(2);
});

test('if nobody grabs the line at all, they run off the edge - and the run is over', () => {
  const inst = toZip(2);
  for (let k = 0; k < 4000 && inst.zip.phase === 'ready'; k++) inst.step(DT, W, H);
  for (let k = 0; k < (LATE + 0.2) / DT; k++) inst.step(DT, W, H);
  assert.equal(inst.zip.phase, 'fall');
  inst.draw(fake(), W, H);
  for (let k = 0; k < (FALL + 0.3) / DT && !inst.over; k++) inst.step(DT, W, H);
  assert.ok(inst.over && inst.lost);
});

test('riding, leaning swings you for the crystals along the line; then down, running again', () => {
  const inst = toZip(2);
  up(0); up(1);
  for (let k = 0; k < 4000 && inst.zip.phase === 'ready'; k++) inst.step(DT, W, H);
  up(0, false); up(1, false);
  const got = inst.crystals;
  inst.leanOf = (i) => Math.sin(inst.t * 2 + i) * 0.9;
  let swung = 0;
  for (let k = 0; k < (RIDE + LAND + 1) / DT && inst.zip; k++){
    inst.step(DT, W, H);
    if (inst.zip) swung = Math.max(swung, Math.abs(inst.zip.swing[0].a));
    if (k % 40 === 0) inst.draw(fake(), W, H);
  }
  assert.ok(swung > 0.3, 'swinging');
  assert.equal(inst.zip, null, 'landed');
  assert.ok(inst.crystals > got, 'picked some up');
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

test('the move guide shows the move to make, as it comes up', async () => {
  const { guideMove, drawGuide } = await import('../src/games/lkp-guide.js');
  story.on = false; crew(2);
  const inst = game.create(2); quiet(inst);
  inst.scene = null;
  inst.things = [{ kind: 'beam', d: inst.z + RUN + 0.2 }];
  assert.equal(guideMove(inst), 'duck');
  inst.things = [];
  assert.equal(guideMove(inst), null);
  inst.crew[1].bubble = { t: 0, claps: 0 };
  assert.equal(guideMove(inst), 'clap');
  inst.crew[1].bubble = null;
  const z = toZip(2);
  assert.equal(guideMove(z), 'handsup');
  for (let k = 0; k < 20; k++) z.step(DT, W, H);
  assert.ok(z._guide.a > 0.9);
  drawGuide(fake(), W, H, z);
});
