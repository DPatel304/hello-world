import test from 'node:test';
import assert from 'node:assert/strict';
import game, { OPENING, GRAVITY, CATCH, GOLD_WORTH, HINT_AFTER } from '../src/games/moon-bounce.js';
import { standIn } from '../src/games/moon-art.js';
import { JumpWatch, RISE } from '../src/tracking/jump.js';
import { pose, L } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;

/* One child standing at x, middle of the body at `cy`. */
function child(x = 0.5, cy = 0.6){
  pose.mouse.active = false;
  const p = pose.players[0];
  p.present = true; p.lm = standIn(x); p.centre = { x, y: cy }; p.scale = 0.3;
  pose.players[1].present = false;
  return p;
}
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };
function quiet(){ child(); const inst = game.create(1); inst.stars = []; inst.spawn = 1e9; inst.nextGold = 1e9; return inst; }
/* Move the body's middle from where it is by dy over secs. */
function rise(p, step, dy, secs){ const y0 = p.centre.y; return (t) => { p.centre.y = y0 - dy * Math.min(1, t / secs); }; }

/* ---- spotting a jump ---- */

test('a quick rise of the body is a jump, once', () => {
  const p = child(), j = new JumpWatch();
  let jumps = 0;
  for (let i = 0; i < 60; i++) jumps += j.step(DT, pose.players, 1).length;
  assert.equal(jumps, 0, 'standing still');
  for (let i = 0; i < 12; i++){ p.centre.y -= 0.3 * RISE * 2.5 / 12; jumps += j.step(DT, pose.players, 1).length; }
  assert.equal(jumps, 1);
  for (let i = 0; i < 30; i++) jumps += j.step(DT, pose.players, 1).length;
  assert.equal(jumps, 1, 'still up: no second jump');
  p.centre.y = 0.6;
  for (let i = 0; i < 30; i++) jumps += j.step(DT, pose.players, 1).length;
  for (let i = 0; i < 12; i++){ p.centre.y -= 0.3 * RISE * 2.5 / 12; jumps += j.step(DT, pose.players, 1).length; }
  assert.equal(jumps, 2, 'down, then up again');
});

test('slowly standing up, swaying or leaning is not a jump', () => {
  const p = child(), j = new JumpWatch();
  let jumps = 0;
  for (let i = 0; i < 240; i++){ p.centre.y = 0.6 - 0.3 * RISE * 2 * (i / 240); jumps += j.step(DT, pose.players, 1).length; }
  for (let i = 0; i < 240; i++){ p.centre.y = 0.56 + Math.sin(i / 10) * 0.3 * RISE * 0.4; jumps += j.step(DT, pose.players, 1).length; }
  assert.equal(jumps, 0);
});

test('rising steadily but not sharply - getting up off the floor - is not a jump', () => {
  const p = child(), j = new JumpWatch();
  let jumps = 0;
  for (let i = 0; i < 60; i++) j.step(DT, pose.players, 1);
  /* Two jump-heights over half a second: far enough, not fast enough. */
  for (let i = 0; i < 30; i++){ p.centre.y -= 0.3 * RISE * 2 / 30; jumps += j.step(DT, pose.players, 1).length; }
  assert.equal(jumps, 0);
});

/* ---- floating ---- */

function jump(inst){
  const p = pose.players[0], y0 = p.centre.y;
  run(inst, 0.25, (t) => { p.centre.y = y0 - 0.06 * Math.min(1, t / 0.15); });
  p.centre.y = y0;
}

test('a jump floats the astronaut up in moon gravity and gently back down', () => {
  const inst = quiet();
  run(inst, 1);
  jump(inst);
  assert.equal(inst.bodies[0].air, true);
  let peak = 0;
  run(inst, 1.2, () => { peak = Math.max(peak, inst.bodies[0].lift); });
  assert.ok(peak > 0.2, `floated up ${peak.toFixed(2)}`);
  assert.ok(inst.bodies[0].air, 'still floating after more than a second');
  run(inst, 2.5);
  assert.equal(inst.bodies[0].air, false);
  assert.equal(inst.bodies[0].lift, 0);
});

test('jumping again in mid-air does nothing until they land', () => {
  const inst = quiet();
  run(inst, 1);
  jump(inst);
  run(inst, 0.3);
  const vy = inst.bodies[0].vy;
  run(inst, 0.5);
  jump(inst);
  assert.ok(inst.bodies[0].vy < vy, 'still falling the same arc, not boosted');
});

test('the helmet never floats out of the sky', () => {
  const inst = quiet();
  const p = pose.players[0];
  p.lm = standIn(0.5).map(k => ({ ...k, y: k.y - 0.25 }));   /* a tall child near the top */
  run(inst, 1);
  jump(inst);
  let peak = 0;
  run(inst, 3, () => { peak = Math.max(peak, inst.bodies[0].lift); });
  assert.ok(p.lm[L.NOSE].y - peak > 0.05, `helmet top at ${(p.lm[L.NOSE].y - peak).toFixed(2)}`);
});

/* ---- catching stars ---- */

test('touching a star with a glove sends it to its place in the picture', () => {
  const inst = quiet();
  const hand = pose.players[0].lm[L.R_WRIST];
  inst.stars.push({ x: hand.x + 0.01, y: hand.y, vx: 0, ph: 0, gold: false, age: 0 });
  run(inst, DT);
  assert.equal(inst.stars.length, 0);
  assert.equal(inst.caught, 1);
  assert.equal(inst.cur.lit, 0, 'still on its way');
  run(inst, 1);
  assert.equal(inst.cur.lit, 1);
});

test('a star out of reach stays where it is', () => {
  const inst = quiet();
  inst.stars.push({ x: 0.9, y: 0.15, vx: 0, ph: 0, gold: false, age: 0 });
  run(inst, 2);
  assert.equal(inst.caught, 0);
  assert.equal(inst.stars.length, 1);
});

test('a floating astronaut catches stars high above', () => {
  const inst = quiet();
  const hand = pose.players[0].lm[L.R_WRIST];
  inst.stars.push({ x: hand.x, y: hand.y - 0.25, vx: 0, ph: 0, gold: false, age: 0 });
  run(inst, 1);
  assert.equal(inst.caught, 0);
  jump(inst);
  run(inst, 1.5);
  assert.equal(inst.caught, 1);
});

test('a full picture lights up, then moves up to the gallery and a new one begins', () => {
  const inst = quiet();
  const first = inst.cur.shape, need = first.pts.length;
  const hand = pose.players[0].lm[L.R_WRIST];
  for (let k = 0; k < need + 2; k++){ inst.stars.push({ x: hand.x, y: hand.y, vx: 0, ph: 0, gold: false, age: 0 }); run(inst, 0.1); }
  run(inst, 1);
  assert.equal(inst.cur.lit, need);
  assert.ok(inst.cur.done > 0);
  run(inst, 3);
  assert.equal(inst.made.length, 1);
  assert.equal(inst.made[0].shape, first);
  assert.notEqual(inst.cur.shape, first);
  assert.equal(inst.cur.lit, 0, 'the extra stars burst into sparkles rather than spilling over');
});

test('a shooting star counts for several', () => {
  const inst = quiet();
  const hand = pose.players[0].lm[L.R_WRIST];
  inst.stars.push({ x: hand.x, y: hand.y, vx: 0, ph: 0, gold: true, age: 0 });
  run(inst, 1.5);
  assert.equal(inst.caught, GOLD_WORTH);
  assert.equal(inst.cur.lit, GOLD_WORTH);
});

test('the first stars drift low enough to touch without jumping', () => {
  child();
  const inst = game.create(1);
  run(inst, OPENING - 2);
  for (const s of inst.stars) assert.ok(s.y >= 0.38, `star at ${s.y.toFixed(2)}`);
});

test('the friend bounces up to show how, only after a while with no catches', () => {
  const inst = quiet();
  run(inst, HINT_AFTER - 1);
  assert.equal(inst.helping, false);
  run(inst, 2);
  assert.equal(inst.helping, true);
});

test('the round ends with everyone floating up under the pictures', () => {
  const inst = quiet();
  let done = false, peak = 0;
  for (let i = 0; i < 600 && !done; i++){ done = inst.outro(DT, W, H); peak = Math.max(peak, inst.bodies[0].lift); }
  assert.ok(done);
  assert.ok(peak > 0.1);
});
