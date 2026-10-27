import test from 'node:test';
import assert from 'node:assert/strict';
import game, { OPENING, FINALE, REACH, HINT_AFTER } from '../src/games/snow-sled.js';
import { standIn } from '../src/games/moon-art.js';
import { pose, L } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs) => { for (let i = 0; i < Math.round(secs / DT); i++) inst.step(DT, W, H); };

/* Children standing, each leaning by `lean` shoulder-widths (negative is left). */
function riders(...leans){
  pose.mouse.active = false;
  for (let i = 0; i < 2; i++){
    const p = pose.players[i], l = leans[i];
    p.present = l != null;
    if (l == null){ p.lm = null; continue; }
    const lm = standIn(0.35 + i * 0.3);
    const sw = Math.abs(lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x);
    for (const k of [0, 2, 5, 7, 8, L.L_SHOULDER, L.R_SHOULDER, L.L_ELBOW, L.R_ELBOW, L.L_WRIST, L.R_WRIST]) lm[k].x += l * sw;
    p.lm = lm; p.centre = { x: 0.35 + i * 0.3, y: 0.55 }; p.scale = 0.3;
  }
}
function quiet(){ const inst = game.create(2); inst.things = []; inst.nextRow = inst.nextFriend = 1e9; return inst; }
/* Something placed just ahead of the sled, in a lane. */
const ahead = (inst, kind, lane, rel = 0.1, extra) => inst._add(kind, rel, lane, extra);

test('leaning steers: both lean left and the sled goes left', () => {
  riders(-0.5, -0.5);
  const inst = quiet();
  run(inst, 2);
  assert.ok(inst.lane < -0.8, `lane ${inst.lane.toFixed(2)}`);
  riders(0.5, 0.5);
  run(inst, 2);
  assert.ok(inst.lane > 0.8);
});

test('one leaning alone moves the sled halfway; standing straight keeps it in the middle', () => {
  riders(-0.5, 0);
  const inst = quiet();
  run(inst, 2);
  assert.ok(inst.lane < -0.3 && inst.lane > -0.7, `lane ${inst.lane.toFixed(2)}`);
  riders(0, 0);
  run(inst, 2);
  assert.ok(Math.abs(inst.lane) < 0.05);
});

test('presents in the sled\'s path are scooped up; ones off to the side go by', () => {
  riders(0, 0);
  const inst = quiet();
  ahead(inst, 'present', 0);
  ahead(inst, 'present', 0.65, 0.15);
  run(inst, 2);
  assert.equal(inst.presents, 1);
});

test('a present on a balloon needs a hop; jumping gets it', () => {
  riders(0, 0);
  const inst = quiet();
  ahead(inst, 'balloon', 0, 0.1);
  run(inst, 1.5);
  assert.equal(inst.presents, 0, 'slid underneath');
  ahead(inst, 'balloon', 0, 0.1);
  run(inst, 0.3);
  const p = pose.players[0], y0 = p.centre.y;
  for (let i = 0; i < 10; i++){ p.centre.y = y0 - 0.006 * i; inst.step(DT, W, H); }
  p.centre.y = y0;
  assert.ok(inst.air > 0, 'hopped');
  run(inst, 1);
  assert.equal(inst.presents, 1);
});

test('a ramp sends the sled flying, higher than a hop, and it lands again', () => {
  riders(0, 0);
  const inst = quiet();
  ahead(inst, 'ramp', 0, 0.06);
  let peak = 0;
  for (let i = 0; i < 90; i++){ inst.step(DT, W, H); peak = Math.max(peak, inst.air); }
  assert.ok(peak > 0.2, `flew ${peak.toFixed(2)}`);
  run(inst, 2);
  assert.equal(inst.air, 0);
});

test('flying high over a present on the snow sails right over it', () => {
  riders(0, 0);
  const inst = quiet();
  ahead(inst, 'ramp', 0, 0.06);
  ahead(inst, 'present', 0, 0.12);
  run(inst, 2.5);
  assert.equal(inst.presents, 0);
});

test('a snowdrift only slows the sled for a moment', () => {
  riders(0, 0);
  const inst = quiet();
  run(inst, 1);
  const v = inst.v;
  ahead(inst, 'drift', 0, 0.05);
  run(inst, 0.5);
  assert.ok(inst.v < v * 0.9, 'slowed');
  assert.equal(inst.presents, 0);
  run(inst, 3);
  assert.ok(inst.v > v * 0.95, 'back up to speed');
});

test('waving makes a friend beside the run wave back', () => {
  riders(0, 0);
  const inst = quiet();
  const f = ahead(inst, 'friend', 1.25, 0.4, { who: 'penguin' });
  const hand = pose.players[0].lm[L.R_WRIST];
  hand.y = 0.2;
  for (let k = 0; k < 8; k++){ hand.x = 0.5 + (k % 2 ? 0.06 : -0.06); pose.players[0].hands.right = { x: hand.x, y: hand.y }; run(inst, 0.2); }
  assert.ok(f.waved, 'the penguin waved back');
});

test('the run starts with presents only, and ends in a shower of them', () => {
  riders(0, 0);
  const inst = game.create(1);
  run(inst, OPENING - 5);
  assert.ok(inst.things.filter(t => t.kind !== 'friend').every(t => t.kind === 'present'));
  inst.t = FINALE + 1;
  run(inst, 3);
  const ahead3 = inst.things.filter(t => t.kind === 'present' && t.z - inst.z > 0.6);
  assert.ok(ahead3.length >= 6);
});

test('a glowing trail shows the way after presents keep going by', () => {
  riders(0, 0);
  const inst = quiet();
  run(inst, HINT_AFTER - 1);
  assert.equal(inst.trail, false);
  run(inst, 2);
  assert.equal(inst.trail, true);
  ahead(inst, 'present', 0);
  run(inst, 1);
  assert.equal(inst.trail, false);
});

test('with nobody on the sled nothing is gathered', () => {
  riders(null, null);
  const inst = quiet();
  ahead(inst, 'present', 0);
  run(inst, 2);
  assert.equal(inst.presents, 0);
});

test('the run ends at the cabin, sled stopped', () => {
  riders(0, 0);
  const inst = quiet();
  let done = false;
  for (let i = 0; i < 60 * 10 && !done; i++) done = inst.outro(DT, W, H);
  assert.ok(done);
  assert.ok(inst.v < 0.01);
});
