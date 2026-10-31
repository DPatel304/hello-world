import test from 'node:test';
import assert from 'node:assert/strict';
import game, { MAX_HP, FIGHT_APART, PLAYTEST, story } from '../src/games/lkp-game.js';
/* The play itself, without the captain's scenes. */
story.on = false;
import { BOT_HIT, BOT_EVERY, BOT_HP, FRONT, RANGE, BOT_REACH, SWING, SWING_HIT, TEAM, BUDDY, SHOT_HIT, CRANK_HIT,
         REVIVE_CLAPS, WAKE_HP, HUG_HEAL, LAST_SLEEP, FIGHT_MAX, KILL_COINS, CLEAR_COINS, waveSize } from '../src/games/lkp-combat.js';
import { pose, L } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };

function crew(n = 1, x = 0.5){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null;
  });
}
/* Lean to lane x (-1..1). */
const lean = (x, i = 0) => { pose.players[i].hands.right = { x: 0.5 + x / 2.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; };
/* Straight into a fight: past the first corridor and crossroads, through
   the fight door. */
function fight(n = 1){
  crew(n);
  const inst = game.create(n);
  run(inst, 0.2);
  inst.things = [];
  inst.step_ = 1; inst.rooms.push('combat'); inst._next();
  assert.equal(inst.phase, 'room');
  assert.ok(inst.fight);
  inst.fight.len = FIGHT_MAX;   /* the full length, whatever we're playtesting */
  return inst;
}
/* Till the room's done and the run goes on (or the time's up). */
function through(inst, each){
  for (let k = 0; k < (FIGHT_MAX + 10) / DT && inst.fight; k++){ if (each) each(); inst.step(DT, W, H); }
}
const bot = (x, d = FRONT, hp = 999) => ({ x, d, hp, max: hp, hitT: 0, target: -1, flash: 0, swing: 0, seed: 0 });
/* Just these robots, nothing more to come. */
function only(inst, bots){ inst.fight.bots = bots; inst.fight.queue = 0; inst.fight.wave = 1; return bots; }

test('the room starts full of robots - five for each player - filling the corridor ahead', () => {
  for (const n of [1, 2, 4]){
    const inst = fight(n);
    const bots = inst.fight.bots;
    assert.equal(bots.length, waveSize(n, 0));
    assert.ok(bots.length >= n * 5);
    const xs = bots.map(b => b.x), ds = bots.map(b => b.d);
    assert.ok(Math.min(...xs) < -0.5 && Math.max(...xs) > 0.5, 'across the width');
    assert.ok(Math.min(...ds) < 0.45 && Math.max(...ds) > 0.8, 'down the length');
  }
});

test('standing still, the crew clear both waves on their own, and the run goes on', () => {
  const inst = fight(2);
  const coins = inst.coins;
  through(inst);
  assert.equal(inst.phase, 'corridor');
  const killed = waveSize(2, 0) + waveSize(2, 1);
  assert.equal(inst.kills, killed);
  assert.equal(inst.coins - coins, killed * KILL_COINS + CLEAR_COINS);
});

test('while playtesting, a fight is over in PLAYTEST seconds, whatever is left', () => {
  crew(2);
  const inst = game.create(2);
  run(inst, 0.2);
  inst.step_ = 1; inst.rooms.push('combat'); inst._next();
  let t = 0;
  while (inst.fight && t < 60){ inst.step(DT, W, H); t += DT; }
  if (PLAYTEST) assert.ok(t <= PLAYTEST + 2, `${t.toFixed(1)}s`);
  assert.equal(inst.phase, 'corridor');
});

test('robots nibble constantly, a little at a time - and only those close by', () => {
  const inst = fight();
  run(inst, 0.5);
  const x = inst.crew[0].x;
  only(inst, [bot(x), bot(x, 0.95)]);
  run(inst, BOT_EVERY * 3 + 0.05);
  assert.equal(inst.crew[0].hp, MAX_HP - 3 * BOT_HIT, 'one robot, three nibbles');
});

test('the crew hit every robot in range at once - wider than a robot reaches', () => {
  const inst = fight();
  run(inst, 0.5);
  const x = inst.crew[0].x;
  const bots = only(inst, [bot(x), bot(x + RANGE * 0.8), bot(x - RANGE * 0.8), bot(x + RANGE * 1.5)]);
  inst.crew[0].swingT = SWING;
  inst.fight.step(DT, W, H, []);
  assert.deepEqual(bots.map(b => 999 - b.hp), [SWING_HIT, SWING_HIT, SWING_HIT, 0]);
  assert.ok(RANGE > BOT_REACH);
});

test('standing together hits harder - and nobody is together till they lean in', () => {
  const alone = fight(2), together = fight(2);
  const home = together._home(1) * FIGHT_APART;
  lean(0, 0); lean(0, 1); run(alone, 1);
  lean(home - BUDDY * 0.25, 0); lean(BUDDY * 0.25 - home, 1); run(together, 1);
  for (const inst of [alone, together]){
    only(inst, [bot(inst.crew[0].x)]);
    inst.crew[0].swingT = SWING; inst.crew[1].swingT = -99;
    inst.fight.step(DT, W, H, []);
  }
  assert.equal(999 - alone.fight.bots[0].hp, SWING_HIT);
  assert.equal(999 - together.fight.bots[0].hp, Math.round(SWING_HIT * (1 + TEAM)));
});

test('a hop shoots the nearest robot walking up - and only while they are', () => {
  const inst = fight();
  run(inst, 0.5);
  const x = inst.crew[0].x;
  const bots = only(inst, [bot(x, 0.8), bot(x, 0.5), bot(x + 0.8, 0.3)]);
  inst.crew[0].swingT = -99;
  inst.fight.step(DT, W, H, [0]);
  assert.deepEqual(bots.map(b => 999 - b.hp), [0, SHOT_HIT, 0]);
  const front = only(inst, [bot(x)]);
  inst.fight.step(DT, W, H, [0]);
  assert.equal(front[0].hp, 999, 'face to face: no shot');
});

test('rolling the arms - the wheels on the bus - adds a hit every turn', () => {
  const inst = fight();
  run(inst, 0.5);
  pose.mouse.active = false;
  const x = inst.crew[0].x, bots = only(inst, [bot(x)]);
  inst.crew[0].swingT = -99;
  const p = pose.players[0];
  /* Two turns, a turn a second. */
  for (let t = 0; t < 2.6; t += DT){
    const a = t * 2 * Math.PI;
    p.hands.left = { x: 0.5 - Math.cos(a) * 0.05, y: 0.5 - Math.sin(a) * 0.05 }; p.hands.right = { x: 0.5 + Math.cos(a) * 0.05, y: 0.5 + Math.sin(a) * 0.05 };
    inst.fight.step(DT, W, H, []);
  }
  pose.mouse.active = true;
  const turns = (999 - bots[0].hp) / CRANK_HIT;
  assert.ok(turns >= 2 && turns <= 3, `${turns} turns`);
});

test('out of health, you fall asleep - and a teammate clapping beside you wakes you', () => {
  const inst = fight(2);
  lean(-0.1, 0); lean(0.1, 1); run(inst, 1);
  only(inst, []);
  inst.fight.wave = 0;
  inst.crew[1].hp = 1; inst.fight._nibble(1, W, H);
  assert.equal(inst.crew[1].down, true, 'asleep');
  const x = inst.crew[1].x;
  lean(-0.9, 1); run(inst, 0.5);
  assert.equal(inst.crew[1].x, x, 'lies where they fell');
  inst.fight.bots = [bot(0.9, 0.9)];   /* keep the room going */
  pose.mouse.active = false;
  /* Over beside them, the one awake claps. */
  inst.crew[1].x = inst._home(0) * FIGHT_APART;
  const p = pose.players[0];
  let n = 0;
  for (let t = 0; t < 12 && inst.crew[1].down; t += DT){
    const shut = Math.floor(t * 2.5) % 2;   /* a clap every 0.4 s */
    p.hands.left = { x: 0.5 - (shut ? 0.01 : 0.08), y: 0.5 }; p.hands.right = { x: 0.5 + (shut ? 0.01 : 0.08), y: 0.5 };
    inst.fight.step(DT, W, H, []);
    n = t;
  }
  pose.mouse.active = true;
  assert.equal(inst.crew[1].down, false, 'awake');
  assert.equal(inst.crew[1].hp, MAX_HP * WAKE_HP);
  assert.ok(n > (REVIVE_CLAPS - 1) * 0.4 - 0.5, 'after a bunch of claps, not one');
});

/* Player i hugging themselves (or not): their pose, each hand at the
   other shoulder. */
function hugging(i, on = true){
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));
  lm[L.L_SHOULDER] = { x: 0.55, y: 0.4, v: 0.9 }; lm[L.R_SHOULDER] = { x: 0.45, y: 0.4, v: 0.9 };
  lm[L.L_WRIST] = on ? { x: 0.455, y: 0.41, v: 0.9 } : { x: 0.6, y: 0.7, v: 0.9 };
  lm[L.R_WRIST] = on ? { x: 0.545, y: 0.41, v: 0.9 } : { x: 0.4, y: 0.7, v: 0.9 };
  pose.players[i].lm = lm;
}

test('while robots are still walking up, hugging yourself heals - not hitting, stepped back', () => {
  const inst = fight();
  run(inst, 0.5);
  const x = inst.crew[0].x, bots = only(inst, [bot(x, 0.95)]);
  inst.crew[0].hp = 50;
  hugging(0);
  run(inst, 2);
  assert.ok(inst.crew[0].healing);
  assert.ok(Math.abs(inst.crew[0].hp - (50 + HUG_HEAL * (2 - 0.3))) < 2, `hp ${inst.crew[0].hp}`);
  pose.players[0].lm = null;
});

test('once a robot is in reach, no more hugging: you fight', () => {
  const inst = fight();
  run(inst, 0.5);
  const x = inst.crew[0].x, bots = only(inst, [bot(x)]);
  inst.crew[0].hp = 50;
  hugging(0);
  run(inst, SWING + 0.5);
  assert.equal(inst.crew[0].healing, false);
  assert.ok(inst.crew[0].hp <= 50, 'no healing');
  assert.ok(bots[0].hp < 999, 'hitting');
  pose.players[0].lm = null;
});

test('everyone asleep at once ends the run', () => {
  const inst = fight(2);
  run(inst, 1);
  for (const i of [0, 1]){ inst.crew[i].hp = 0; inst.fight._sleep(i); }
  run(inst, LAST_SLEEP * 0.5);
  assert.equal(inst.over, false, 'a moment first');
  run(inst, LAST_SLEEP);
  assert.equal(inst.over, true);
  assert.equal(inst.lost, true);
  let k = 0; while (!inst.outro(DT, W, H) && k++ < 1000);
  assert.ok(inst.crew[0].down && inst.crew[1].down, 'still asleep at the end');
});

test('one asleep is not the end while a teammate is awake', () => {
  const inst = fight(2);
  run(inst, 1);
  inst.crew[0].hp = 0; inst.fight._sleep(0);
  run(inst, LAST_SLEEP * 3);
  assert.equal(inst.over, false);
});

test('only a fight puts anyone to sleep: corridors leave them at 1', () => {
  crew(1);
  const inst = game.create(1);
  inst.crew[0].hp = 3;
  inst._hurt(0, 50, W, H);
  assert.equal(inst.crew[0].hp, 1);
  assert.equal(inst.crew[0].down, false);
});

test('robots spread out among the crew rather than piling on one', () => {
  const inst = fight(2);
  lean(-0.8, 0); lean(0.8, 1); run(inst, 1);
  only(inst, Array.from({ length: 8 }, (_, k) => bot(-0.6 + k * 0.02, 0.6 + k * 0.01)));
  run(inst, 0.1);
  const on = [0, 1].map(i => inst.fight.bots.filter(b => b.target === i).length);
  assert.deepEqual(on, [4, 4]);
});

test('robots are tougher the more are playing', () => {
  assert.equal(fight(1).fight.bots[0].max, BOT_HP / 2);
  assert.equal(fight(4).fight.bots[0].max, BOT_HP);
});

test('a fight draws', () => {
  const inst = fight(2);
  run(inst, 8);
  inst.fight._sleep(1); inst.crew[0].swing = 0.5; inst.crew[0].buddies = 1;
  inst.bits.push({ kind: 'shot', x: 0.5, y: 0.8, x2: 0.5, y2: 0.5, age: 0, life: 0.3 });
  inst.draw(new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }), W, H);
});
