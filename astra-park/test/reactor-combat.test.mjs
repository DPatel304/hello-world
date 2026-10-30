import test from 'node:test';
import assert from 'node:assert/strict';
import game, { MAX_HP } from '../src/games/reactor-run.js';
import { WIND, BOT_HIT, BOT_HP, FACE, WAVES, FIGHT_MAX, RISE_HP, RALLY, KILL_COINS, CLEAR_COINS, waveSize } from '../src/games/reactor-combat.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(); inst.step(DT, W, H); } };

function crew(n = 1, x = 0.5){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3;
  });
}
/* Till the room's done and the run goes on (or the time's up). */
function through(inst, each){
  for (let k = 0; k < (FIGHT_MAX + 10) / DT && inst.fight; k++){ if (each) each(); inst.step(DT, W, H); }
}
const hand = (x, i = 0) => { pose.players[i].hands.right = { x, y: 0.5, vx: 0, vy: 0, speed: 0 }; };
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
  return inst;
}

test('a fight door stops the run, and the robots come', () => {
  const inst = fight();
  run(inst, 2);
  assert.ok(inst.speed < 0.01, 'stopped');
  assert.ok(inst.fight.bots.length > 0);
  run(inst, 6);
  assert.ok(inst.fight.bots.some(b => b.d <= FACE + 0.001), 'face to face');
});

test('just standing there, the crew swing on their own and clear the room - two waves - and the run goes on', () => {
  const inst = fight(2);
  const coins = inst.coins;
  let waves = 0, last = -1;
  through(inst, () => { if (inst.fight.wave !== last){ last = inst.fight.wave; waves++; } });
  assert.ok(inst.seg.t < 1 && inst.kills > 0, 'cleared, well before time');
  assert.equal(waves, WAVES);
  assert.equal(inst.phase, 'corridor', 'through and on');
  const killed = waveSize(2, 0) + waveSize(2, 1);
  assert.equal(inst.kills, killed);
  assert.equal(inst.coins - coins, killed * KILL_COINS + CLEAR_COINS);
});

test('a robot always winds up before it swings - slide out of reach and it misses', () => {
  const a = fight();
  /* One robot, right in front. */
  a.fight.queue = 0; a.fight.bots = [{ x: a.crew[0].x, d: FACE, hp: 999, max: 999, wind: 0, rest: 0, target: -1, flash: 0, swing: 0, seed: 0 }];
  run(a, WIND * 0.8);
  assert.equal(a.crew[0].hp, MAX_HP, 'nothing yet: winding up');
  run(a, WIND);
  assert.equal(a.crew[0].hp, MAX_HP - BOT_HIT, 'stood still: hit');
  const b = fight();
  b.fight.queue = 0; b.fight.bots = [{ x: b.crew[0].x, d: FACE, hp: 999, max: 999, wind: 0, rest: 0, target: -1, flash: 0, swing: 0, seed: 0 }];
  run(b, 0.1);
  assert.ok(b.fight.bots[0].wind > 0);
  hand(0.95); run(b, WIND);
  assert.equal(b.crew[0].hp, MAX_HP, 'slid away: missed');
});

test('robots are tougher the more are playing', () => {
  const one = fight(1), four = fight(4);
  run(one, 2); run(four, 2);
  assert.equal(one.fight.bots[0].max, BOT_HP / 2);
  assert.equal(four.fight.bots[0].max, BOT_HP);
});

test('rooms can down someone; clearing the room gets them up at half health', () => {
  const inst = fight(2);
  inst._hurt(1, MAX_HP, W, H, true);
  assert.equal(inst.crew[1].down, true);
  const x = inst.crew[1].x;
  hand(0.1, 1); run(inst, 0.5);
  assert.equal(inst.crew[1].x, x, 'lies where they fell');
  through(inst);
  assert.equal(inst.crew[1].down, false);
  assert.ok(inst.crew[1].hp >= MAX_HP * RISE_HP);
});

test('everyone down at once: a moment, and they all get up again', () => {
  const inst = fight(2);
  run(inst, 1);
  inst._hurt(0, MAX_HP, W, H, true); inst._hurt(1, MAX_HP, W, H, true);
  run(inst, RALLY + 0.2);
  assert.ok(inst.crew.slice(0, 2).every(rn => !rn.down && rn.hp === MAX_HP * RISE_HP));
});

test('a fight draws', () => {
  const inst = fight(2);
  run(inst, 8);
  inst.fight.bots[0].wind = 0.4; inst.fight.bots[0].target = 0;
  inst._hurt(1, MAX_HP, W, H, true);
  inst.crew[0].swing = 0.5;
  inst.draw(new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }), W, H);
});
