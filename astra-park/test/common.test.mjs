import test from 'node:test';
import assert from 'node:assert/strict';
import { scores, Juice, clamp, lerp } from '../src/games/common.js';

test('an unplayed game has no best score', () => {
  localStorage.clear();
  assert.equal(scores.best('pop-party', 1), 0);
});

test('a best score is only replaced by a better one', () => {
  localStorage.clear();
  assert.equal(scores.record('pop-party', 1, 120), true);
  assert.equal(scores.best('pop-party', 1), 120);
  assert.equal(scores.record('pop-party', 1, 90), false, 'a worse round is not a record');
  assert.equal(scores.best('pop-party', 1), 120);
  /* Matching the best is not beating it, and saying otherwise would pop the
     "new record!" banner every time somebody tied their own score. */
  assert.equal(scores.record('pop-party', 1, 120), false, 'equalling is not a record');
  assert.equal(scores.best('pop-party', 1), 120);
  assert.equal(scores.record('pop-party', 1, 121), true);
  assert.equal(scores.best('pop-party', 1), 121);
});

/* One and two player rounds are not comparable, so they keep separate bests. */
test('player counts keep separate bests', () => {
  localStorage.clear();
  scores.record('pop-party', 1, 50);
  scores.record('pop-party', 2, 300);
  assert.equal(scores.best('pop-party', 1), 50);
  assert.equal(scores.best('pop-party', 2), 300);
});

test('games keep separate bests', () => {
  localStorage.clear();
  scores.record('pop-party', 1, 10);
  scores.record('another-game', 1, 99);
  assert.equal(scores.best('pop-party', 1), 10);
  assert.equal(scores.best('another-game', 1), 99);
});

test('reset clears scores and nothing else', () => {
  localStorage.clear();
  scores.record('pop-party', 1, 10);
  scores.record('pop-party', 2, 20);
  localStorage.setItem('astrapark_camera', 'cam-abc');
  localStorage.setItem('astrapark_audio', '{"vol":0.4}');

  scores.reset();

  assert.equal(scores.best('pop-party', 1), 0);
  assert.equal(scores.best('pop-party', 2), 0);
  assert.equal(localStorage.getItem('astrapark_camera'), 'cam-abc', 'camera choice must survive');
  assert.equal(localStorage.getItem('astrapark_audio'), '{"vol":0.4}', 'volume must survive');
});

test('a wiped storage does not throw', () => {
  localStorage.clear();
  assert.doesNotThrow(() => scores.reset());
  assert.equal(scores.best('anything', 1), 0);
});

test('particles are born, fall and die', () => {
  const j = new Juice();
  j.burst(100, 100, '#fff', 20);
  assert.equal(j.bits.length, 20);

  j.step(0.1);
  assert.equal(j.bits.length, 20, 'nothing dies in the first frame');
  assert.ok(j.bits.every(b => b.vy > -1e9), 'gravity applied');

  for (let i = 0; i < 40; i++) j.step(0.05);   /* 2s, past the longest life */
  assert.equal(j.bits.length, 0, 'everything expires eventually');
});

test('score pops rise and expire', () => {
  const j = new Juice();
  j.pop(50, 200, '+10', '#fff');
  const y0 = j.pops[0].y;
  j.step(0.1);
  assert.ok(j.pops[0].y < y0, 'pops drift upward');
  for (let i = 0; i < 30; i++) j.step(0.05);
  assert.equal(j.pops.length, 0);
});

test('screen shake decays to nothing', () => {
  const j = new Juice();
  j.kick(12);
  assert.equal(j.shake, 12);
  j.step(0.5);
  assert.ok(j.shake < 12, 'shake decays');
  for (let i = 0; i < 20; i++) j.step(0.1);
  assert.ok(j.shake < 0.2, 'and settles');
});

test('a settled shake does not translate the canvas', () => {
  const j = new Juice();
  const c = { saved:0, save(){ this.saved++; }, translate(){} };
  assert.equal(j.applyShake(c), false);
  assert.equal(c.saved, 0, 'no save means the caller owes no restore');

  j.kick(10);
  assert.equal(j.applyShake(c), true);
  assert.equal(c.saved, 1);
});

test('a bigger kick does not shrink an existing one', () => {
  const j = new Juice();
  j.kick(10);
  j.kick(3);
  assert.equal(j.shake, 10);
  j.kick(14);
  assert.equal(j.shake, 14);
});

test('clamp and lerp behave', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
  assert.equal(lerp(0, 10, 0), 0);
  assert.equal(lerp(0, 10, 1), 10);
  assert.equal(lerp(0, 10, 0.25), 2.5);
});
