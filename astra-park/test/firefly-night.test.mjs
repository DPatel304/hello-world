import test from 'node:test';
import assert from 'node:assert/strict';
import game, { OPENING, FINALE, HINT_FIRST, HINT_AGAIN, HINT_LOOP, CUP_GAP, CUP_GRACE, CUP_HOLDS, JAR_FULL, JAR_X, GOLDEN_WORTH, planRibbons } from '../src/games/firefly-night.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080;
const run = (inst, secs) => { for (let i = 0; i < Math.round(secs * 60); i++) inst.step(1 / 60, W, H); };

/* One player whose hands are `gap` screen-heights apart around (x, y). */
function hands(x, y, gap = 0.04, i = 0){
  pose.mouse.active = false;
  const p = pose.players[i];
  p.present = true;
  const dx = (gap / 2) * (H / W);
  p.hands.left  = { x: x - dx, y, vx: 0, vy: 0, speed: 0 };
  p.hands.right = { x: x + dx, y, vx: 0, vy: 0, speed: 0 };
  for (let k = i + 1; k < 2; k++) pose.players[k].present = false;
}
function quiet(){
  const inst = game.create(1);
  inst.ribbons = []; inst.spawn = 1e9; inst.flies = [];
  return inst;
}
/* A firefly parked at (x, y) that stays put unless something moves it. */
function parked(inst, x, y, golden = false){
  const f = inst._fly(x, y);
  Object.assign(f, { sp: 0, golden, top: 0, bottom: 1 });
  inst.flies.push(f);
  return f;
}

test('hands together make a cup; a brief wobble apart does not spill it', () => {
  const inst = quiet();
  hands(0.5, 0.4, 0.05);
  run(inst, 0.1);
  assert.equal(inst.cups[0].cupped, true);
  hands(0.5, 0.4, CUP_GAP * 2);
  run(inst, CUP_GRACE * 0.5);
  assert.equal(inst.cups[0].cupped, true, 'still a cup during the grace');
  run(inst, CUP_GRACE);
  assert.equal(inst.cups[0].cupped, false, 'apart for longer opens it');
});

test('only a cup catches fireflies', () => {
  const inst = quiet();
  const f = parked(inst, 0.5, 0.4);
  hands(0.5, 0.4, CUP_GAP * 3);          /* hands wide apart, one either side */
  run(inst, 1);
  assert.equal(f.state, 'free', 'open hands should not catch');
  hands(0.5, 0.4, 0.04);
  run(inst, 0.05);
  assert.equal(f.state, 'held');
  assert.equal(inst.cups[0].held.length, 1);
});

test('a cup holds a handful, no more', () => {
  const inst = quiet();
  for (let k = 0; k < CUP_HOLDS + 3; k++) parked(inst, 0.5, 0.4);
  hands(0.5, 0.4, 0.04);
  run(inst, 0.1);
  assert.equal(inst.cups[0].held.length, CUP_HOLDS);
});

test('carrying fireflies down to a jar pours them in', () => {
  const inst = quiet();
  for (let k = 0; k < 3; k++) parked(inst, 0.5, 0.4);
  hands(0.5, 0.4, 0.04);
  run(inst, 0.1);
  hands(JAR_X[1], 0.74, 0.04);
  run(inst, 1);
  assert.equal(inst.cups[0].held.length, 0, 'the cup should be empty');
  assert.equal(inst.jars[1].count, 3);
  assert.equal(inst.caught[0], 3);
  assert.equal(inst.flies.length, 0, 'poured fireflies live in the jar now');
});

test('opening your hands lets fireflies go free again - nothing is lost', () => {
  const inst = quiet();
  for (let k = 0; k < 2; k++) parked(inst, 0.5, 0.4);
  hands(0.5, 0.4, 0.04);
  run(inst, 0.1);
  hands(0.5, 0.4, CUP_GAP * 3);
  run(inst, CUP_GRACE + 0.2);
  assert.equal(inst.cups[0].held.length, 0);
  assert.equal(inst.flies.filter(f => f.state === 'free').length, 2);
});

test('a full jar floats up as a lantern and a fresh jar takes its place', () => {
  const inst = quiet();
  inst.jars[0].count = JAR_FULL - 1;
  parked(inst, 0.5, 0.4);
  hands(0.5, 0.4, 0.04); run(inst, 0.1);
  hands(JAR_X[0], 0.74, 0.04); run(inst, 0.6);
  assert.equal(inst.scene.lanterns.length, 1, 'a lantern should rise');
  assert.ok(inst.jars[0].lifting > 0);
  hands(0.5, 0.2, 0.3); run(inst, 2);
  assert.equal(inst.jars[0].count, 0, 'an empty jar should replace it');
  assert.equal(inst.jars[0].lifting, 0);
});

test('a golden firefly counts as several', () => {
  const inst = quiet();
  parked(inst, 0.5, 0.4, true);
  hands(0.5, 0.4, 0.04); run(inst, 0.1);
  hands(JAR_X[2], 0.74, 0.04); run(inst, 1);
  assert.equal(inst.jars[2].count, GOLDEN_WORTH);
});

test('the mouse is one hand, and always a cup', () => {
  const inst = quiet();
  const f = parked(inst, 0.5, 0.4);
  pose.mouse.active = true;
  const p = pose.players[0];
  p.present = true;
  p.hands.right = { x: 0.5, y: 0.4, vx: 0, vy: 0, speed: 0 };
  p.hands.left  = { x: 0.1, y: 0.9, vx: 0, vy: 0, speed: 0 };   /* stale; ignored */
  try { run(inst, 0.05); assert.equal(f.state, 'held'); }
  finally { pose.mouse.active = false; }
});

test('the opening is calm: a few fireflies, low and easy to reach', () => {
  hands(0.5, 0.2, 0.5);
  const inst = game.create(1);
  inst.ribbons = [];
  let most = 0;
  for (let i = 0; i < OPENING * 60; i++){
    inst.step(1 / 60, W, H);
    most = Math.max(most, inst.flies.filter(f => f.state === 'free').length);
  }
  assert.ok(most <= 3, `${most} fireflies in the opening`);
  assert.ok(inst.flies.every(f => f.y > 0.3), 'opening fireflies should stay low');
  run(inst, FINALE - OPENING - 5);
  assert.ok(inst.flies.filter(f => f.state === 'free').length >= 8, 'busier later on');
});

test('ribbons come a few times a round, spread out, never in the opening or the finale', () => {
  for (let n = 0; n < 500; n++){
    const r = planRibbons();
    assert.ok(r.length >= 2 && r.length <= 4);
    for (const x of r) assert.ok(x.at > OPENING && x.at < FINALE - 15);
    for (let k = 1; k < r.length; k++) assert.ok(r[k].at - r[k - 1].at >= 30);
  }
});

test('the ending turns the collected fireflies into stars', () => {
  const inst = quiet();
  inst.collected = 40;
  let n = 0;
  while (!inst.outro(1 / 60, W, H)){ if (++n > 60 * 15) throw new Error('never finished'); }
  assert.equal(inst.scene.stars.length, 40);
  assert.ok(n / 60 < 10, `the ending took ${(n / 60).toFixed(1)}s`);
});

test('no words and no scores on screen: it is cooperative', () => {
  const inst = quiet();
  assert.equal(inst.hud().hideScore, true);
  assert.equal(inst.winner && game.create(2).winner(), -1, 'two players never have a winner');
  const texts = [];
  const c = new Proxy({}, {
    get(t, k){
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop(){} });
      if (k === 'fillText' || k === 'strokeText') return (s) => texts.push(s);
      return () => {};
    },
    set(t, k, v){ t[k] = v; return true; }
  });
  hands(0.5, 0.4, 0.04);
  for (let k = 0; k < 4; k++) parked(inst, 0.5, 0.4);
  for (let i = 0; i < 120; i++){ inst.step(1 / 60, W, H); inst.draw(c, W, H); }
  assert.deepEqual(texts, []);
});

test('a cup has to reach a firefly to catch it', () => {
  const inst = quiet();
  const f = parked(inst, 0.8, 0.3);
  hands(0.3, 0.5, 0.04);
  run(inst, 1);
  assert.equal(f.state, 'free', 'a cup across the screen should not catch it');
});

/* ---- showing how, without words ---- */

function nobody(){ pose.mouse.active = false; for (const p of pose.players) p.present = false; }

test('the ghost hands show how a few seconds in, if nobody has caught one', () => {
  nobody();
  const inst = quiet();
  run(inst, HINT_FIRST - 0.5);
  assert.equal(inst.hinting, false, 'not straight away');
  run(inst, 1);
  assert.equal(inst.hinting, true);
  run(inst, HINT_LOOP * 2);
  assert.equal(inst.hinting, true, 'and keeps showing while nobody has');
});

test('the demonstration gets out of the way of someone holding a firefly', () => {
  nobody();
  const inst = quiet();
  run(inst, HINT_FIRST + 1);
  assert.equal(inst.hinting, true);
  parked(inst, 0.4, 0.4);
  hands(0.4, 0.4);
  run(inst, 0.2);
  assert.ok(inst.cups[0].held.length > 0);
  assert.equal(inst.hinting, false);
});

test('after a jar gets a firefly, the demonstration waits a long while', () => {
  nobody();
  const inst = quiet();
  parked(inst, 0.5, 0.5);
  hands(0.5, 0.5);
  run(inst, 0.2);
  hands(JAR_X[0], 0.7);
  run(inst, 1);
  assert.ok(inst.collected > 0, 'poured');
  nobody();
  run(inst, HINT_LOOP + 1);
  assert.equal(inst.hinting, false, 'not due again yet');
  run(inst, HINT_AGAIN - HINT_LOOP - 3);
  assert.equal(inst.hinting, false);
  run(inst, 3);
  assert.equal(inst.hinting, true, 'shown again for anyone who wandered off');
});

test('no demonstration in the finale', () => {
  nobody();
  const inst = quiet();
  inst.t = FINALE + 0.5;
  run(inst, HINT_LOOP + 1);
  assert.equal(inst.hinting, false);
});
