import test from 'node:test';
import assert from 'node:assert/strict';
import game, { MAX_HP, story } from '../src/games/lkp-game.js';
/* The play itself, without the captain's scenes. */
story.on = false;
import { TELL, SLAM, SLAM_W, DOWN, OVERLOAD, ROLL, BLAST, BOSS_COINS, CORE_NEAR, ROAR, MOVE, RUN_BOOST } from '../src/games/lkp-boss.js';
import { FRONT } from '../src/games/lkp-combat.js';
import { RUN } from '../src/games/lkp-art.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(); inst.step(DT, W, H); } };
function crew(n = 1){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null;
  });
}
/* Lean to lane x. */
const lean = (x, i = 0) => { pose.players[i].hands.right = { x: 0.5 + x / 2.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; };
/* Straight to the Warden: the last corridor done. */
function boss(n = 1){
  crew(n);
  const inst = game.create(n);
  run(inst, 0.2);
  inst.things = [];
  /* The Warden, whichever level's boss it is. */
  inst.level = { ...inst.level, boss: 'warden', bossName: 'Warden' };
  inst.step_ = inst.level.plan.indexOf('boss') - 1; inst._next();
  assert.equal(inst.phase, 'boss');
  inst.boss.len = Infinity;
  return inst;
}
const tell = (inst) => inst.boss.arms.find(a => a.state === 'tell');
function untilTell(inst){ for (let k = 0; k < 600 && !tell(inst); k++) run(inst, DT); return tell(inst); }

test('the last corridor leads to the Warden: the run stops for it', () => {
  const inst = boss();
  run(inst, 1);
  assert.ok(inst.speed < 0.01);
  assert.equal(inst.boss.phase, 'arms');
});

test('an arm rises over someone first - then slams, and anyone still under it is hit', () => {
  const a = boss();
  const arm = untilTell(a);
  assert.ok(Math.abs(arm.x - a.crew[0].x) < 0.05, 'over them');
  run(a, TELL * 0.8);
  assert.equal(a.crew[0].hp, MAX_HP, 'a warning first');
  run(a, TELL * 0.4);
  assert.equal(a.crew[0].hp, MAX_HP - SLAM, 'stayed: hit');
  const b = boss();
  untilTell(b);
  lean(tell(b).x > 0 ? -0.9 : 0.9); run(b, TELL + 0.1);
  assert.equal(b.crew[0].hp, MAX_HP, 'dodged');
});

test('a slammed arm lies there a while - lean back in and hit it', () => {
  const inst = boss();
  const arm = untilTell(inst);
  const x = arm.x;
  lean(x > 0 ? -0.9 : 0.9); run(inst, TELL + 0.1);
  assert.equal(arm.state, 'down');
  const hp = arm.hp;
  lean(x); run(inst, DOWN - 0.3);
  assert.ok(arm.hp < hp, 'hit it while it was down');
  run(inst, 0.6);
  assert.notEqual(arm.state, 'down', 'and up it goes');
});

test('both arms broken, the core lurches up close; low on health, it overloads', () => {
  const inst = boss(2);
  for (const a of inst.boss.arms) a.hp = 0;
  run(inst, ROAR + MOVE + 3);
  assert.equal(inst.boss.phase, 'robots');
  assert.ok(Math.abs(inst.boss.core.d - CORE_NEAR) < 0.01, 'up close');
  assert.ok(inst.boss.bots.some(b => !b.part), 'robots');
  inst.boss.core.hp = Math.floor(inst.boss.core.max * OVERLOAD) - 1;
  run(inst, 0.1);
  assert.equal(inst.boss.phase, 'overload');
  assert.equal(inst.boss.bots.filter(b => !b.part).length, 0, 'the robots gone back');
});

test('overload: a shockwave to jump and a sweep to duck - missed, they hurt', () => {
  const inst = boss();
  for (const a of inst.boss.arms) a.hp = 0;
  run(inst, ROAR + MOVE + 0.5);
  inst.boss.core.hp = 1e6; inst.boss.core.max = 1e6; inst.boss.phase = 'overload';
  inst.fight.bots = inst.fight.bots.filter(b => b.part);
  inst.boss._spit = () => {};
  inst.boss.blastT = 99;
  const rn = inst.crew[0];
  /* A shockwave, stood still: hit. */
  inst.boss.blasts = [{ kind: 'wave', d: RUN + 0.02 }];
  run(inst, 0.1);
  assert.equal(rn.hp, MAX_HP - BLAST);
  /* A shockwave, mid-hop: over it. */
  rn.safe = 0; rn.air = 0.5; rn.airV = 0;
  inst.boss.blasts = [{ kind: 'wave', d: RUN + 0.005 }];
  inst.boss.step(DT, W, H, []);
  assert.equal(rn.hp, MAX_HP - BLAST);
  /* A sweep, ducked: under it; standing: hit. */
  rn.air = 0; rn.duck = 1;
  inst.boss.blasts = [{ kind: 'sweep', d: RUN + 0.005 }];
  inst.boss.step(DT, W, H, []);
  assert.equal(rn.hp, MAX_HP - BLAST, 'ducked');
  rn.duck = 0; rn.safe = 0;
  inst.boss.blasts = [{ kind: 'sweep', d: RUN + 0.005 }];
  inst.boss.step(DT, W, H, []);
  assert.equal(rn.hp, MAX_HP - 2 * BLAST, 'stood up');
});

test('between phases the crew run round the ring by themselves - quicker running on the spot - and see it from another side', () => {
  const a = boss(), b = boss();
  for (const inst of [a, b]) for (const arm of inst.boss.arms) arm.hp = 0;
  run(a, 0.1); run(b, 0.1);
  assert.ok(a.boss.move, 'off round the ring');
  const hp = a.crew[0].hp;
  let ta = 0, tb = 0;
  while (a.boss.move && ta < 20){ run(a, DT); ta += DT; }
  /* b's crew run on the spot all the way. */
  pose.players[0].hands.right.speed = 4;
  while (b.boss.move && tb < 20){ run(b, DT); tb += DT; }
  pose.players[0].hands.right.speed = 0;
  assert.ok(Math.abs(ta - (ROAR + MOVE)) < 0.3, `by themselves: ${ta.toFixed(1)}s`);
  assert.ok(tb < ROAR + MOVE / RUN_BOOST + 0.5, `running: ${tb.toFixed(1)}s`);
  assert.equal(a.boss.view, 1, 'another side');
  assert.equal(a.crew[0].hp, hp, 'nothing happens on the way');
});

test('the Warden beaten: a shower of coins, and the run is won', () => {
  const inst = boss(2);
  const coins = inst.coins;
  inst.boss.core.hp = 0;
  run(inst, 3);
  assert.ok(inst.over);
  assert.equal(inst.lost, false);
  assert.ok(inst.coins - coins >= BOSS_COINS);
});

test('a playtest Warden can be beaten in time by a crew that just stands there and dodges a little', () => {
  crew(2);
  const inst = game.create(2);
  run(inst, 0.2);
  inst.level = { ...inst.level, boss: 'warden', bossName: 'Warden' };
  inst.step_ = inst.level.plan.indexOf('boss') - 1; inst._next();
  let t = 0;
  while (!inst.over && t < 120){
    const a = tell(inst);
    for (const i of [0, 1]) lean(a && Math.abs(inst.crew[i].x - a.x) < 0.35 ? (a.x > 0 ? -0.8 : 0.8) : (i ? 0.1 : -0.1), i);
    inst.step(DT, W, H); t += DT;
  }
  assert.ok(inst.over && !inst.lost, `over ${inst.over}, lost ${inst.lost} at ${t.toFixed(0)}s`);
});

test('the Warden draws', () => {
  const inst = boss(2);
  run(inst, 2);
  untilTell(inst);
  inst.boss.blasts = [{ kind: 'wave', d: 0.3 }, { kind: 'sweep', d: 0.2 }];
  inst.draw(new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }), W, H);
});
