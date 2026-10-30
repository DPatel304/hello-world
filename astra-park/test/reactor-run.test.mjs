import test from 'node:test';
import assert from 'node:assert/strict';
import game, { HOP_RISE, LATE_HOP, UNDUCK, SPEED, MAX_HP, HURT, SAFE, HEAL, VOTE, CORRIDOR, MYSTERY } from '../src/games/reactor-run.js';
import { RUN, DOORS } from '../src/games/reactor-art.js';
import { pose, L } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };

/* The crew as the mouse stand-in: x across the screen is the lean, low on
   the screen is a duck, the body's middle rising is a hop. */
function crew(n = 1, x = 0.5, y = 0.5){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x, y, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3;
  });
}
const hand = (x, y = 0.5, i = 0) => { pose.players[i].hands.right = { x, y, vx: 0, vy: 0, speed: 0 }; };
function hop(inst, i = 0){
  const p = pose.players[i];
  for (let k = 0; k < 4; k++){ p.centre.y -= 0.03; inst.step(DT, W, H); }
  for (let k = 0; k < 4; k++){ p.centre.y += 0.03; inst.step(DT, W, H); }
}
/* A quiet corridor: nothing in it unless a test puts it there. */
function quiet(n = 1){ crew(n); const inst = game.create(n); inst.things = []; run(inst, 0.2); return inst; }
function ahead(inst, kind, secs, extra = {}){
  const th = { kind, d: inst.z + RUN + inst.speed * secs, ...extra };
  inst.things.push(th);
  return th;
}
const hp = (inst, i = 0) => inst.crew[i].hp;

test('leaning slides the crew member across the corridor', () => {
  const inst = quiet();
  hand(0.9); run(inst, 1);
  assert.ok(inst.crew[0].x > 0.8);
  hand(0.1); run(inst, 1);
  assert.ok(inst.crew[0].x < -0.8);
});

test('debris hurts whoever is in its way; sliding round it does not', () => {
  const a = quiet();
  ahead(a, 'blocker', 0.6, { a: -0.3, b: 0.3, seed: 1 });
  run(a, 1);
  assert.equal(hp(a), MAX_HP - HURT.blocker);
  const b = quiet();
  hand(0.9); run(b, 0.6);
  ahead(b, 'blocker', 0.6, { a: -0.3, b: 0.3, seed: 1 });
  run(b, 1);
  assert.equal(hp(b), MAX_HP);
});

test('duck under a bulkhead; hop over a breach', () => {
  const a = quiet();
  ahead(a, 'beam', 0.5); run(a, 1);
  assert.equal(hp(a), MAX_HP - HURT.beam, 'standing tall: bonk');
  const b = quiet();
  ahead(b, 'beam', 0.5); hand(0.5, 0.9); run(b, 1);
  assert.equal(hp(b), MAX_HP, 'ducked');
  const c = quiet();
  ahead(c, 'gap', 0.5, { a: -1.05, b: 1.05 }); run(c, 1);
  assert.equal(hp(c), MAX_HP - HURT.gap, 'fell in');
  const d = quiet();
  ahead(d, 'gap', 0.35, { a: -1.05, b: 1.05 }); run(d, 0.15); hop(d); run(d, 0.6);
  assert.equal(hp(d), MAX_HP, 'hopped it');
});

test('a little bounce on the spot is a hop', () => {
  const inst = quiet();
  const p = pose.players[0], step = HOP_RISE * 1.3 * p.scale / 4;
  for (let k = 0; k < 4; k++){ p.centre.y -= step; inst.step(DT, W, H); }
  assert.ok(inst.crew[0].air > 0, 'off the ground');
});

test('a hop a moment too late still clears a breach; much too late does not', () => {
  const a = quiet();
  ahead(a, 'gap', 0.3, { a: -1.05, b: 1.05 }); run(a, 0.3 + LATE_HOP * 0.4); hop(a); run(a, 1);
  assert.equal(hp(a), MAX_HP, 'just late: made it');
  const b = quiet();
  ahead(b, 'gap', 0.3, { a: -1.05, b: 1.05 }); run(b, 0.3 + LATE_HOP + 0.2); hop(b); run(b, 1);
  assert.equal(hp(b), MAX_HP - HURT.gap, 'fell in');
});

test('getting up from a duck is never a hop', () => {
  const inst = quiet();
  inst.crew[0].lastDuck = inst.t - UNDUCK * 0.5;
  hop(inst);
  assert.equal(inst.crew[0].air, 0);
  run(inst, UNDUCK + 0.5); hop(inst);
  assert.ok(inst.crew[0].air > 0, 'a moment later, it is');
});

test('a hit gives a moment of safety, so one thing never hits twice', () => {
  const inst = quiet();
  ahead(inst, 'blocker', 0.5, { a: -0.3, b: 0.3, seed: 1 });
  ahead(inst, 'beam', 0.5 + SAFE * 0.5);
  run(inst, 2);
  assert.equal(hp(inst), MAX_HP - HURT.blocker);
});

test('corridors wound but never down anyone', () => {
  const inst = quiet();
  inst.crew[0].hp = 5;
  ahead(inst, 'gap', 0.5, { a: -1.05, b: 1.05 }); run(inst, 1);
  assert.equal(hp(inst), 1);
});

test('coins are picked up by running through them, for the whole team', () => {
  const inst = quiet(2);
  hand(0.5, 0.5, 0); hand(0.5, 0.5, 1); run(inst, 1);
  const lane = inst.crew[0].x;
  for (let k = 0; k < 4; k++) ahead(inst, 'coin', 0.4 + k * 0.1, { lane });
  ahead(inst, 'coin', 0.5, { lane: inst.crew[1].x });
  run(inst, 1.5);
  assert.equal(inst.coins, 5);
});

test('a repair station heals whoever runs through it', () => {
  const inst = quiet();
  inst.crew[0].hp = 50;
  ahead(inst, 'fountain', 0.5, { lane: inst.crew[0].x, used: new Set() });
  run(inst, 1);
  assert.equal(hp(inst), 50 + HEAL);
});

/* ---------- the crossroads ---------- */

const toDoor = (inst, i, d) => hand(0.5 + [-0.36, 0, 0.36][d], 0.5, i);
/* Into the crossroads, straight away, each standing in front of a door:
   doors[i] for crew member i. */
function atDoors(doors){
  const inst = quiet(doors.length);
  doors.forEach((d, i) => toDoor(inst, i, d));
  inst.seg.t = inst.seg.len;
  run(inst, 0.1);
  assert.equal(inst.phase, 'cross');
  run(inst, 3.5);
  return inst;
}

test('the crew stop at three doors and vote with their feet: most wins', () => {
  const inst = atDoors([0, 0, 2]);
  const z = inst.z; run(inst, 0.5);
  assert.ok(Math.abs(inst.z - z) < 0.01, 'stopped at the doors');
  run(inst, VOTE + 0.5);
  assert.equal(inst.doors[0], 0, 'two for the left door');
  run(inst, 3);
  assert.equal(inst.rooms[0], 'combat', 'through the fight door');
});

test('the doors stay shut for the whole vote, even when everyone has chosen', () => {
  const inst = atDoors([1, 1]);
  assert.ok(inst.seg.vote > 0 && inst.seg.vote <= VOTE);
  run(inst, inst.seg.vote - 0.3);
  assert.equal(inst.seg.choice, null, 'still deciding');
  run(inst, 1);
  assert.equal(inst.doors[0], 1);
});

test('a tie goes the way the crowned guide is standing', () => {
  const inst = atDoors([2, 0]);
  const g = inst.guide, other = g === 0 ? 1 : 0;
  toDoor(inst, g, 2); toDoor(inst, other, 0);
  run(inst, VOTE + 0.5);
  assert.equal(inst.doors[0], 2);
});

test('the guide crown passes on at each crossroads', () => {
  const inst = atDoors([0, 2]);
  const first = inst.guide;
  inst._next(); inst._next(); inst._next();
  assert.equal(inst.phase, 'cross');
  assert.notEqual(inst.guide, first);
});

test('the ? door is anything - treasure most often - and treasure is never a door of its own', () => {
  const inst = quiet();
  const n = {}; for (let k = 0; k < 2000; k++){ const r = inst.mystery(); n[r] = (n[r] || 0) + 1; }
  for (const [kind, w] of MYSTERY) assert.ok(Math.abs(n[kind] / 2000 - w) < 0.04, `${kind}: ${n[kind]}`);
  /* The two other doors are always a fight and traps. */
  const a = atDoors([0]); run(a, VOTE + 0.5); run(a, 5);
  const b = atDoors([1]); run(b, VOTE + 0.5); run(b, 5);
  assert.deepEqual([a.rooms[0], b.rooms[0]], ['combat', 'traps']);
});

test('the floor runs corridor, crossroads, room, corridor, crossroads, room, corridor - and ends', () => {
  const inst = quiet();
  const seen = [];
  for (let k = 0; k < 2000 && !inst.over; k++){
    if (seen[seen.length - 1] !== inst.phase) seen.push(inst.phase);
    if (inst.phase === 'corridor') inst.seg.t = inst.seg.len;
    run(inst, 0.5);
  }
  assert.deepEqual(seen, ['corridor', 'cross', 'room', 'corridor', 'cross', 'room', 'corridor']);
  assert.ok(inst.over);
});

test('the first corridor teaches one thing at a time: debris, then a bulkhead, then a breach', () => {
  crew(1);
  const inst = game.create(1);
  const firsts = ['blocker', 'beam', 'gap'].map(k => inst.things.find(th => th.kind === k).d);
  assert.ok(firsts[0] < firsts[1] && firsts[1] < firsts[2]);
  /* Nothing to dodge in the first few seconds. */
  const early = inst.things.filter(th => th.kind !== 'coin' && th.d < inst.z + RUN + SPEED * 6 + 0.9);
  assert.equal(early.length, 0);
});

test('someone who drops out of view holds their place till they are back', () => {
  const inst = quiet(2);
  hand(0.9, 0.5, 1); run(inst, 1);
  const x = inst.crew[1].x;
  pose.players[1].present = false; hand(0.1, 0.5, 1);
  run(inst, 1);
  assert.equal(inst.crew[1].x, x);
  inst.draw(new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }), W, H);
});
