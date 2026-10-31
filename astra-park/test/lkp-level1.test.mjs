import test from 'node:test';
import assert from 'node:assert/strict';
import game, { MAX_HP, story } from '../src/games/lkp-game.js';
import { LEVELS } from '../src/games/lkp-levels.js';
import { PAL } from '../src/games/lkp-art.js';
import { AUTO, POWER, SURGE } from '../src/games/lkp-depot.js';
import { TELL, CHARGE, CHARGE_W, REST, STAGGER, BURN, PHASES, SWEPT, OVERSHOOT, DASH } from '../src/games/lkp-scout.js';
import { FRONT, SWING, SWING_HIT } from '../src/games/lkp-combat.js';
import { pose } from '../src/tracking/pose.js';
/* The play itself, without the ship's computer's scenes. */
story.on = false;

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs) => { for (let k = 0; k < Math.round(secs / DT); k++) inst.step(DT, W, H); };
function crew(n = 1){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null;
  });
}
const lean = (x, i = 0) => { pose.players[i].hands.right = { x: 0.5 + x / 2.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; };
/* Straight to step `kind` of level 1 (the one before it, then on). */
function at(kind, n = 1){
  crew(n);
  const inst = game.create(n);
  run(inst, 0.1);
  inst.things = [];
  inst.step_ = inst.level.plan.indexOf(kind) - 1; inst._next();
  assert.equal(inst.phase, kind);
  return inst;
}

test('level 1 is the Verdant Crash Site, in its forest colours', () => {
  crew(1);
  const inst = game.create(1);
  assert.equal(inst.level, LEVELS[0]);
  assert.equal(inst.level.name, 'Verdant Crash Site');
  assert.equal(PAL.floor, LEVELS[0].palette.floor);
  assert.ok(PAL.trees, 'trees along the way');
});

test('before the depot the fights are wild beasts; after it, robots', () => {
  crew(1);
  const inst = game.create(1);
  inst.rooms.push('combat'); inst.step_ = 1; inst._next();
  assert.ok(inst.fight.bots.every(b => b.kind === 'beast'));
  const later = at('depot');
  for (let k = 0; k < (AUTO + SURGE + 3) / DT && later.phase === 'depot'; k++) later.step(DT, W, H);
  assert.equal(later.awake, true);
  later.rooms.push('combat'); later.step_ = later.level.plan.lastIndexOf('room') - 1; later._next();
  assert.ok(later.fight.bots.every(b => b.kind === 'rustbot'));
});

test('the depot: the run stops at the engine piece, and it powers up by itself after a while', () => {
  const inst = at('depot');
  run(inst, 1);
  assert.ok(inst.speed < 0.05, 'stopped');
  assert.equal(inst.awake, false);
  run(inst, AUTO - 1 + 1.5);
  assert.equal(inst.depot.state, 'surge');
  run(inst, SURGE + 0.1);
  assert.equal(inst.awake, true, 'the planet is waking');
  assert.equal(inst.phase, 'corridor', 'and on');
});

test('the depot powers up quicker with everyone rolling their arms', () => {
  const inst = at('depot');
  pose.mouse.active = false;
  const p = pose.players[0];
  let t = 0;
  while (inst.depot && inst.depot.state === 'power' && t < 10){
    const a = t * 2 * Math.PI * 1.2;
    p.hands.left = { x: 0.5 - Math.cos(a) * 0.05, y: 0.5 - Math.sin(a) * 0.05 }; p.hands.right = { x: 0.5 + Math.cos(a) * 0.05, y: 0.5 + Math.sin(a) * 0.05 };
    inst.step(DT, W, H); t += DT;
  }
  pose.mouse.active = true;
  assert.ok(t < AUTO, `${t.toFixed(1)}s`);
  assert.ok(t > POWER * 0.8);
});

/* ---------- the Scout ---------- */

const scout = (n = 1) => { const inst = at('boss', n); inst.boss.len = Infinity; return inst; };
function until(inst, state, max = 15){ for (let k = 0; k < max / DT && inst.boss.state !== state; k++) inst.step(DT, W, H); return inst.boss.state === state; }

test('the Scout: crouches over someone first - a long warning - then charges down their lane', () => {
  const a = scout();
  assert.ok(until(a, 'tell'));
  assert.ok(Math.abs(a.boss.lane - a.crew[0].x) < 0.05, 'at them');
  run(a, TELL * 0.8);
  assert.equal(a.crew[0].hp, MAX_HP, 'a warning first');
  run(a, TELL * 0.2 + DASH[0] + 0.1);
  assert.equal(a.crew[0].hp, MAX_HP - CHARGE, 'stayed: hit');
  const b = scout();
  until(b, 'tell');
  lean(b.boss.lane > 0 ? -0.9 : 0.9); run(b, TELL + DASH[0] + 0.2);
  assert.equal(b.crew[0].hp, MAX_HP, 'dodged');
});

test('after a charge it stands there - lean in and hit it - then trots back', () => {
  const inst = scout();
  until(inst, 'tell');
  lean(inst.boss.lane > 0 ? -0.9 : 0.9);
  until(inst, 'rest');
  const hp = inst.boss.body.hp;
  lean(inst.boss.lane); run(inst, REST[0] - 0.2);
  assert.ok(inst.boss.body.hp < hp, 'hit it');
  run(inst, 1);
  assert.notEqual(inst.boss.state, 'rest');
});

test('at two-thirds and a third of its health it staggers - in everyone\'s reach, hit for double', () => {
  const inst = scout(2);
  const b = inst.boss.body;
  b.hp = Math.floor(b.max * PHASES[0]);
  run(inst, 0.05);
  assert.equal(inst.boss.phase, 1);
  assert.ok(inst.boss.staggered > 0);
  assert.equal(b.d, FRONT);
  const hp = b.hp;
  inst.crew[0].swingT = SWING; inst.crew[1].swingT = -99;
  run(inst, 0.05);
  assert.equal(hp - b.hp, SWING_HIT * BURN, 'burned');
  inst.crew[0].swingT = inst.crew[1].swingT = -1e9;   /* no more hitting, for now */
  run(inst, STAGGER + 0.1);
  assert.equal(inst.boss.staggered <= 0, true);
  b.hp = Math.floor(b.max * PHASES[1]);
  run(inst, 0.05);
  assert.equal(inst.boss.phase, 2);
  assert.ok(inst.boss.staggered > 0, 'and again');
});

test('phase 2 on: a sweep at head height - duck it', () => {
  const inst = scout();
  inst.boss.phase = 1;
  const rn = inst.crew[0];
  inst.boss.blasts = [{ d: 0.04 }];
  inst.boss.state = 'wait'; inst.boss.st = -99;
  run(inst, 0.1);
  assert.equal(rn.hp, MAX_HP - SWEPT, 'stood: hit');
  rn.safe = 0; rn.duck = 1; inst.boss.blasts = [{ d: 0.035 }];
  inst.boss.step(DT, W, H, []);
  assert.equal(rn.hp, MAX_HP - SWEPT, 'ducked');
});

test('phase 3: sometimes it overshoots, and is stuck longer', () => {
  const inst = scout();
  inst.boss.phase = 2;
  let over = 0, n = 0;
  for (let k = 0; k < 400; k++){ inst.boss.state = 'wait'; inst.boss.st = 99; inst.boss._move(DT, W, H); if (inst.boss.state === 'tell'){ n++; if (inst.boss.over) over++; } }
  assert.ok(Math.abs(over / n - OVERSHOOT) < 0.08, `${over}/${n}`);
});

test('the Scout beaten: the level is won', () => {
  const inst = scout(2);
  inst.boss.body.hp = 0;
  run(inst, 4);
  assert.ok(inst.over);
  assert.equal(inst.lost, false);
});

test('a playtest Scout is beaten in time by a crew that dodges and hits it when it stops', () => {
  crew(2);
  const inst = game.create(2);
  run(inst, 0.1);
  inst.step_ = inst.level.plan.indexOf('boss') - 1; inst._next();
  const bs = inst.boss;
  let t = 0;
  while (!inst.over && t < 60){
    for (const i of [0, 1]){
      const x = inst.crew[i].x;
      if (bs.state === 'tell') lean(Math.abs(x - bs.lane) < CHARGE_W + 0.15 ? (bs.lane > 0 ? -0.9 : 0.9) : x, i);
      else if (bs.state === 'rest') lean(bs.lane + (i ? 0.1 : -0.1), i);
    }
    inst.step(DT, W, H); t += DT;
  }
  assert.ok(inst.over && !inst.lost, `at ${t.toFixed(0)}s`);
  assert.ok(t < 40, `won in ${t.toFixed(0)}s, not by time`);
});

test('the Scout draws', () => {
  const inst = scout(2);
  until(inst, 'tell');
  inst.boss.blasts = [{ d: 0.3 }];
  inst.draw(new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }), W, H);
});
