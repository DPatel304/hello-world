import test from 'node:test';
import assert from 'node:assert/strict';
import game, { SPEED0, SIT_OUT, FOX_TIME } from '../src/games/forest-run.js';
import { RUN } from '../src/games/forest-art.js';
import { pose, L } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };

/* Children as the mouse stand-in: x across the screen is the lean, low on
   the screen is a duck, and the body's middle rising is a jump. */
function kids(n = 1, x = 0.5, y = 0.5){
  pose.mouse.active = true;
  for (let i = 0; i < 2; i++){
    const p = pose.players[i];
    p.present = i < n;
    p.hands.right = { x, y, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3;
  }
}
const hand = (x, y = 0.5, i = 0) => { pose.players[i].hands.right = { x, y, vx: 0, vy: 0, speed: 0 }; };
/* A quick rise of the middle of the body over a few frames, then back down. */
function jump(inst, i = 0){
  const p = pose.players[i];
  for (let k = 0; k < 4; k++){ p.centre.y -= 0.03; inst.step(DT, W, H); }
  for (let k = 0; k < 4; k++){ p.centre.y += 0.03; inst.step(DT, W, H); }
}
/* A quiet path, with nothing coming unless a test puts it there. */
function quiet(n = 1){ kids(n); const inst = game.create(n); inst.things = []; inst.nextAt = 1e9; return inst; }
/* Something on the path, `secs` ahead of the runners at the current speed. */
function ahead(inst, kind, secs, lane = 0, extra = {}){
  const th = { kind, d: inst.z + RUN + inst.speed * secs, lane, w: kind === 'stump' || kind === 'rock' ? 0.26 : 2, ...extra };
  inst.things.push(th);
  return th;
}

test('leaning takes the runner across the path', () => {
  const inst = quiet();
  hand(0.9); run(inst, 1);
  assert.ok(inst.runners[0].x > 0.8, `right: ${inst.runners[0].x.toFixed(2)}`);
  hand(0.1); run(inst, 1);
  assert.ok(inst.runners[0].x < -0.8, `left: ${inst.runners[0].x.toFixed(2)}`);
});

test('the lean is read from shoulders over hips', () => {
  const inst = quiet();
  pose.mouse.active = false;
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));
  lm[L.L_HIP] = { x: 0.45, y: 0.6 }; lm[L.R_HIP] = { x: 0.55, y: 0.6 };
  lm[L.L_SHOULDER] = { x: 0.47, y: 0.4 }; lm[L.R_SHOULDER] = { x: 0.59, y: 0.4 };
  pose.players[0].lm = lm;
  assert.ok(inst.leanOf(0) > 0.5, 'leaning right');
  lm[L.L_SHOULDER] = { x: 0.44, y: 0.4 }; lm[L.R_SHOULDER] = { x: 0.56, y: 0.4 };
  assert.ok(Math.abs(inst.leanOf(0)) < 0.3, 'upright');
});

test('a stump in the way trips the runner and ends the run; a new one starts', () => {
  const inst = quiet();
  run(inst, 3);
  ahead(inst, 'stump', 0.5);
  run(inst, 1);
  assert.ok(inst.run.down, 'the run is over');
  assert.ok(inst.runners[0].down > 0);
  const reached = inst.run.down.reached;
  run(inst, 3);
  assert.ok(!inst.run.down, 'off again');
  assert.ok(inst.run.t < 1);
  assert.equal(inst.runners[0].down, 0);
  assert.equal(inst.best, reached, 'the best run is remembered');
});

test('leaning round a stump misses it', () => {
  const inst = quiet();
  ahead(inst, 'stump', 1.2, 0.3);
  hand(0.15); run(inst, 2);
  assert.ok(!inst.run.down);
});

test('a jump clears a log; running into it trips', () => {
  const inst = quiet();
  ahead(inst, 'log', 0.45);
  run(inst, 0.15); jump(inst); run(inst, 1);
  assert.ok(!inst.run.down, 'jumped it');
  ahead(inst, 'log', 0.5);
  run(inst, 1);
  assert.ok(inst.run.down, 'tripped');
});

test('ducking passes under a branch; standing tall trips', () => {
  const inst = quiet();
  ahead(inst, 'branch', 0.5);
  hand(0.5, 0.9); run(inst, 0.8);
  assert.ok(!inst.run.down, 'ducked under');
  hand(0.5, 0.5); run(inst, 0.3);
  ahead(inst, 'branch', 0.5);
  run(inst, 1);
  assert.ok(inst.run.down, 'bumped');
});

test('a duck is the head dropping well below where it stands', () => {
  const inst = quiet();
  pose.mouse.active = false;
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));
  lm[L.NOSE] = { x: 0.5, y: 0.3 };
  const p = pose.players[0]; p.lm = lm; p.scale = 0.5;
  for (let k = 0; k < 60; k++) inst.duckOf(0, DT);
  assert.equal(inst.duckOf(0, DT), false, 'standing');
  lm[L.NOSE] = { x: 0.5, y: 0.3 + 0.5 * 0.25 };
  assert.equal(inst.duckOf(0, DT), true, 'crouched');
  lm[L.NOSE] = { x: 0.5, y: 0.3 + 0.5 * 0.05 };
  assert.equal(inst.duckOf(0, DT), false, 'a nod is not a duck');
});

test('crystals are picked up running through them; the high ones need a jump', () => {
  const inst = quiet();
  ahead(inst, 'crystal', 0.3, 0, { high: false, hue: 200 });
  ahead(inst, 'crystal', 0.3, 0.9, { high: false, hue: 200 });
  run(inst, 0.6);
  assert.equal(inst.crystals, 1, 'only the one in reach');
  ahead(inst, 'crystal', 0.4, 0, { high: true, hue: 300 });
  run(inst, 0.8);
  assert.equal(inst.crystals, 1, 'out of reach on the ground');
  ahead(inst, 'crystal', 0.4, 0, { high: true, hue: 300 });
  run(inst, 0.15); jump(inst); run(inst, 0.6);
  assert.equal(inst.crystals, 2);
});

test('with two, a runner who trips sits out and comes back; the run goes on', () => {
  const inst = quiet(2);
  ahead(inst, 'stump', 0.5, -0.45);
  run(inst, 1);
  assert.ok(inst.runners[0].down > 0, 'left runner tripped');
  assert.ok(!inst.run.down, 'the other is still running');
  run(inst, SIT_OUT + 0.2);
  assert.equal(inst.runners[0].down, 0, 'back in');
  assert.ok(inst.runners[0].blink > 0, 'and safe for a moment');
});

test('with two, the run ends when both are down', () => {
  const inst = quiet(2);
  ahead(inst, 'log', 0.5);
  run(inst, 1);
  assert.ok(inst.run.down);
});

test('the run speeds up and the forest grows magical; a new run starts slow again', () => {
  const inst = quiet();
  run(inst, 60);
  assert.ok(inst.speed > SPEED0 * 1.3);
  assert.ok(inst.magic > 0.4);
  ahead(inst, 'log', 0.3); run(inst, 4);
  assert.ok(Math.abs(inst.speed - SPEED0) < 0.01);
  assert.ok(inst.magic < 0.05);
});

test('running past the best run so far is cheered', () => {
  const inst = quiet();
  inst.best = 0.6; inst.run.passedBest = false;
  run(inst, 0.6 / SPEED0 - 0.3);
  assert.equal(inst.run.passedBest, false);
  run(inst, 0.6);
  assert.equal(inst.run.passedBest, true);
});

test('an empty room trips nobody', () => {
  /* The shell always starts at least one player, even with nobody there. */
  kids(0);
  const inst = game.create(1); inst.things = []; inst.nextAt = 1e9;
  ahead(inst, 'log', 0.5); ahead(inst, 'stump', 1, 0);
  run(inst, 2);
  assert.ok(!inst.run.down);
});

test('the path gets logs, branches and stumps once the run is going', () => {
  kids();
  const inst = game.create(1);
  inst.runners[0].blink = 1e9;           /* safe throughout, to see what comes */
  /* Long enough that a run of bad luck can't leave out a kind: branches
     only start after twenty seconds, and then come one time in three. */
  run(inst, 120, () => { inst.runners[0].blink = 1e9; });
  const kinds = new Set([...inst.seen]);
  for (const k of ['stump', 'log', 'branch']) assert.ok(kinds.has(k), `met a ${k}`);
});

test('the fox shows how: over a log, under a branch, and then it goes', () => {
  const inst = quiet();
  const log = ahead(inst, 'log', 0, 0);
  log.d = inst.z + inst.fox.rel;
  run(inst, DT);
  assert.equal(inst.fox.act, 'jump');
  inst.things = [];
  const br = ahead(inst, 'branch', 0); br.d = inst.z + inst.fox.rel;
  run(inst, DT);
  assert.equal(inst.fox.act, 'duck');
  inst.t = FOX_TIME + 1; run(inst, 0.1);
  assert.ok(inst.fox.gone);
});

test('the round ends with the runners slowing to a stop', () => {
  const inst = quiet(2);
  let done = false, s = 0;
  for (; s < 10 && !done; s += DT) done = inst.outro(DT, W, H);
  assert.ok(done && s > 3);
  assert.ok(inst.speed < 0.05);
  assert.equal(game.secs, 240);
  assert.equal(inst.hud().hideScore, true);
});

test('in a game for two, a child on their own has the whole path; a second hops in beside', () => {
  kids(1);
  const inst = game.create(2); inst.things = []; inst.nextAt = 1e9;
  hand(0.9); run(inst, 1);
  assert.ok(inst.runners[0].x > 0.8, 'all the way right on their own');
  pose.players[1].present = true; hand(0.5, 0.5, 0); hand(0.5, 0.5, 1); run(inst, 1);
  assert.ok(inst.runners[0].x < -0.3 && inst.runners[1].x > 0.3, 'side by side');
});

test('with only one child there, a trip still ends the run', () => {
  kids(1);
  const inst = game.create(2); inst.things = []; inst.nextAt = 1e9;
  ahead(inst, 'stump', 0.5);
  run(inst, 1);
  assert.ok(inst.run.down);
});
