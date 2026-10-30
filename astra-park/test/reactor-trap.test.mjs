import test from 'node:test';
import assert from 'node:assert/strict';
import game, { MAX_HP, PLAYTEST } from '../src/games/reactor-run.js';
import { GRACE, STRIDE, ZAP, READY, YELLOW, TRAP_MAX, CLEAR_COINS } from '../src/games/reactor-trap.js';
import { pose, L } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 30;

/* Player i standing, still - or marching on the spot (knees going up and
   down), or wriggling (hands waving). */
function body(i, t = 0, how = 'still'){
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));
  const put = (j, x, y) => { lm[j] = { x, y, v: 0.9 }; };
  put(L.NOSE, 0.5, 0.3); put(L.L_SHOULDER, 0.55, 0.4); put(L.R_SHOULDER, 0.45, 0.4);
  put(L.L_HIP, 0.53, 0.6); put(L.R_HIP, 0.47, 0.6);
  const step = how === 'march' ? Math.sin(t * 2 * Math.PI * 1.5) * 0.04 : 0;
  put(L.L_KNEE, 0.53, 0.75 - Math.max(0, step)); put(L.R_KNEE, 0.47, 0.75 - Math.max(0, -step));
  put(L.L_ANKLE, 0.53, 0.9 - Math.max(0, step)); put(L.R_ANKLE, 0.47, 0.9 - Math.max(0, -step));
  const wave = how === 'wriggle' ? Math.sin(t * 12) * 0.08 : 0;
  put(L.L_WRIST, 0.6 + wave, 0.6); put(L.R_WRIST, 0.4 - wave, 0.6);
  Object.assign(pose.players[i], { present: true, lm, scale: 0.3, centre: { x: 0.5, y: 0.6 } });
}
/* Straight into red light, green light. */
function room(n = 1){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => { p.present = i < n; p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right }; });
  for (let i = 0; i < n; i++) body(i);
  const inst = game.create(n);
  inst.step(DT, W, H);
  inst.things = [];
  inst.step_ = 1; inst.rooms.push('traps'); inst._next();
  assert.ok(inst.trap);
  inst.trap.len = TRAP_MAX;
  return inst;
}
/* Run on, each player doing what how(i, light) says. */
function run(inst, secs, how = () => 'still'){
  for (let k = 0; k < secs / DT; k++){
    for (const i of inst.here) body(i, inst.t, how(i, inst.trap ? inst.trap.light : null));
    inst.step(DT, W, H);
  }
}
const lightIs = (inst, want) => {
  if (inst.trap.light === want) for (let k = 0; k < 600 && inst.trap.light === want; k++) run(inst, DT);
  for (let k = 0; k < 600 && inst.trap.light !== want; k++) run(inst, DT);
};

test('a trap room is red light, green light: it holds still, and its lights go round', () => {
  const inst = room();
  assert.equal(inst.trap.light, 'red', 'a moment to get ready');
  const seen = new Set();
  run(inst, 15, () => 'still');
  for (let k = 0; k < 20 / DT; k++){ seen.add(inst.trap.light); run(inst, DT); }
  assert.deepEqual([...seen].sort(), ['green', 'red', 'yellow']);
  assert.ok(inst.speed < 0.01, 'not running');
});

test('marching on green walks you up the hall; standing still, you stay put', () => {
  const inst = room();
  lightIs(inst, 'green');
  run(inst, 1, () => 'still');
  assert.ok(inst.crew[0].along < 0.01, 'still: nowhere');
  const a = inst.crew[0].along, left = inst.trap.left;
  run(inst, Math.min(1.5, left - 0.1), () => 'march');
  assert.ok(inst.crew[0].along - a > STRIDE * 0.5, `marched: ${inst.crew[0].along - a}`);
});

test('moving on red gets you zapped - after a moment to stop - but never below 1', () => {
  const inst = room();
  lightIs(inst, 'red');
  run(inst, GRACE * 0.7, () => 'wriggle');
  assert.equal(inst.crew[0].hp, MAX_HP, 'a moment to stop');
  run(inst, 0.5, () => 'wriggle');
  assert.equal(inst.crew[0].hp, MAX_HP - ZAP, 'zapped');
  inst.crew[0].hp = 3;
  for (let k = 0; k < 3; k++){ lightIs(inst, "red"); run(inst, 1, () => "wriggle"); }
  assert.equal(inst.crew[0].hp, 1);
  assert.equal(inst.crew[0].down, false);
});

test('the red light at the start is only to get ready', () => {
  const inst = room();
  run(inst, READY - 0.1, () => 'wriggle');
  assert.equal(inst.crew[0].hp, MAX_HP);
});

test('standing still on red is safe', () => {
  const inst = room();
  lightIs(inst, 'red');
  run(inst, 1.4, () => 'still');
  assert.equal(inst.crew[0].hp, MAX_HP);
});

test('the first one over the line opens the door for everyone, and the run goes on', () => {
  const inst = room(2);
  const coins = inst.coins;
  inst.crew[0].along = 0.95;
  lightIs(inst, 'green');
  for (let k = 0; k < 10 / DT && inst.trap && !inst.trap.done; k++){
    body(0, inst.t, inst.trap.light === 'green' ? 'march' : 'still'); body(1, inst.t, 'still');
    inst.step(DT, W, H);
  }
  assert.ok(inst.trap.done);
  assert.ok(inst.crew[1].along < 0.1, 'the other never moved');
  run(inst, 2);
  assert.equal(inst.phase, 'corridor');
  assert.equal(inst.coins - coins, CLEAR_COINS);
});

test('a little sway on red is fine', () => {
  const inst = room();
  lightIs(inst, 'red');
  for (let k = 0; k < 1.4 / DT; k++){
    body(0, inst.t, 'still');
    pose.players[0].lm.forEach(q => { q.x += Math.sin(inst.t * 3) * 0.01; });
    inst.step(DT, W, H);
  }
  assert.equal(inst.crew[0].hp, MAX_HP);
});

test('while playtesting, a trap room is over in PLAYTEST seconds', () => {
  const inst = room();
  if (PLAYTEST) inst.trap.len = PLAYTEST;
  let t = 0;
  while (inst.trap && t < 200){ run(inst, DT); t += DT; }
  assert.ok(t <= (PLAYTEST || TRAP_MAX) + 3, `${t}s`);
  assert.equal(inst.phase, 'corridor');
});

test('a trap room draws', () => {
  const inst = room(2);
  lightIs(inst, 'red');
  inst.draw(new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }), W, H);
  pose.mouse.active = true;
});
