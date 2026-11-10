import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story } from '../src/games/lkp-game.js';
import { Captain, Scene, script, NAMES } from '../src/games/lkp-captain.js';
import { INTRO_BEATS, DARK, LOOK, HANDS_MAX, DRONE, RING_FIRST, SAID, WIGGLE, RISE, WAKE_MAX, RING_MAX, START } from '../src/games/lkp-intro.js';
import { RUN } from '../src/games/lkp-art.js';
import { REST_MAX } from '../src/games/lkp-game.js';
import { lineTime } from '../src/audio/voice.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 30;
const run = (inst, secs) => { for (let k = 0; k < Math.round(secs / DT); k++) inst.step(DT, W, H); };
function crew(n = 1){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null;
  });
}
const fake = () => new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });

const say = (inst, kind) => script(kind, inst).reduce((s, [who, text]) => s + lineTime(text.replace(/^k+s+h+\s*[-\u2014]\s*/i, ''), who) + 0.5, 0);
const hands = (i, x, y, speed = 0) => { pose.players[i].hands.right = { x, y, vx: 0, vy: 0, speed }; };

test('the opening: waking up in the helmet - wiggle the eyes open, a look round, your hands, the drone, answer Nova, a blink, and off - each step given time', () => {
  story.on = true; crew(2);
  const inst = game.create(2), intro = inst.scene;
  assert.equal(intro.kind, 'intro');
  assert.deepEqual(INTRO_BEATS.map(b => b.id), ['dark', 'wake', 'look', 'hands', 'drone', 'call', 'answer', 'rise']);
  const z = inst.z;
  run(inst, DARK + 0.1);
  assert.equal(intro.stage, 'wake');
  assert.equal(inst.crew[0].hp, inst.crew[0].max * START, 'hurt in the crash');
  inst.draw(fake(), W, H);
  /* one wiggling gets the eyes half open - the team has to do it */
  for (let k = 0; k < (WIGGLE + 0.5) / DT; k++){ hands(0, 0.5, 0.5, 2); inst.step(DT, W, H); }
  assert.ok(intro.wiggled > 0.45 && intro.wiggled < 0.55);
  assert.equal(intro.stage, 'wake');
  /* stopping, they droop */
  hands(0, 0.5, 0.5); const was = intro.wiggled; run(inst, 0.5);
  assert.ok(intro.wiggled <= was);
  for (let k = 0; k < (WIGGLE + 1.5) / DT; k++){ hands(0, 0.5, 0.5, 2); hands(1, 0.5, 0.5, 2); inst.step(DT, W, H); }
  hands(0, 0.5, 0.5); hands(1, 0.5, 0.5);
  /* a moment just to look */
  assert.equal(intro.stage, 'look');
  run(inst, LOOK - intro.st - 0.3);
  assert.equal(intro.stage, 'look', 'nothing hurried');
  run(inst, 0.5);
  assert.equal(intro.stage, 'hands');
  inst.draw(fake(), W, H);
  /* your hands: waiting till they're moved */
  run(inst, 3);
  assert.equal(intro.stage, 'hands', 'waits for your hands');
  for (let k = 0; k < 2.5 / DT; k++){ hands(0, 0.5, 0.5, 2); hands(1, 0.5, 0.5, 2); inst.step(DT, W, H); }
  hands(0, 0.5, 0.5); hands(1, 0.5, 0.5);
  run(inst, 0.6);
  assert.equal(intro.stage, 'drone');
  inst.draw(fake(), W, H);
  run(inst, DRONE + 0.1);
  assert.equal(intro.stage, 'call');
  inst.draw(fake(), W, H);
  /* it rings a while before an answer counts */
  hands(0, 0.5, 0.1); run(inst, RING_FIRST - intro.st - 0.4);
  assert.ok(!intro.answered[0], 'a moment to hear it ring');
  run(inst, 1); hands(0, 0.5, 0.5);
  /* everyone answers - one isn't enough */
  assert.ok(intro.answered[0] && !intro.answered[1]);
  run(inst, 1.5);
  assert.equal(intro.stage, 'call');
  hands(1, 0.5, 0.1); run(inst, 0.6); hands(1, 0.5, 0.5);
  run(inst, 1);
  assert.equal(intro.stage, 'answer');
  assert.ok(intro.radio.busy && intro.radio.visible);
  inst.draw(fake(), W, H);
  run(inst, say(inst, 'wakeup') + SAID + 0.3);
  assert.equal(intro.stage, 'rise');
  for (let k = 0; k < 40 && inst.scene; k++){ inst.step(DT, W, H); assert.equal(inst.z, z, 'nothing moves till it\'s done'); if (k % 10 === 0) inst.draw(fake(), W, H); }
  run(inst, RISE);
  assert.equal(inst.scene, null);
  assert.equal(inst.introCrew, null, 'in their places');
  run(inst, 1);
  assert.ok(inst.z > z, 'and off they go');
  story.on = false;
});

test('nobody waking or answering never holds it up for ever', () => {
  story.on = true; crew(1);
  const inst = game.create(1);
  const most = DARK + WAKE_MAX + 1 + LOOK + HANDS_MAX + 1 + DRONE + RING_MAX + 1 + say(inst, 'wakeup') + SAID + 1 + RISE + 1;
  for (let k = 0; k < most / DT && inst.scene; k++) inst.step(DT, W, H);
  assert.equal(inst.scene, null);
  story.on = false;
});

test('the first corridor: Nova tells the story between her tips, and the healing pond is a stop that heals everyone', () => {
  story.on = true; crew(2);
  const inst = game.create(2);
  inst.scene = null;
  inst.leanOf = () => 0; inst.duckOf = () => false; inst.jumps = { step: () => [] };
  for (const rn of inst.crew) rn.hp = rn.max * START;
  const said = [];
  const sayFn = inst.captain.say.bind(inst.captain);
  inst.captain.say = (text, words, o) => { const ok = sayFn(text, words, o); if (ok) said.push(text); return ok; };
  const pond = inst.things.find(t => t.kind === 'pond' && t.rest);
  assert.ok(pond, 'a pond stop');
  for (let k = 0; k < 200 / DT && !inst.rest; k++){ if (inst.levelup) inst.levelup.t = 1e9; inst.step(DT, W, H); }
  assert.ok(inst.rest, 'stopped at the pond');
  const walk = inst.level.lines.walk.map(l => l[1]);
  assert.ok(walk.every(l => said.includes(l)), 'the whole story told on the way');
  for (let k = 0; k < 15; k++) inst.step(DT, W, H);
  const z = inst.z;
  for (let k = 0; k < 30; k++) inst.step(DT, W, H);
  assert.ok(inst.z - z < 0.005, 'standing in it');
  assert.ok(Math.abs(pond.d - inst.z - RUN) < 0.05, 'in the middle of it');
  assert.ok(inst.crew[0].hp > inst.crew[0].max * START, 'healing');
  for (let k = 0; k < (REST_MAX + 1) / DT && inst.rest; k++) inst.step(DT, W, H);
  assert.equal(inst.rest, null);
  assert.equal(inst.crew[0].hp, inst.crew[0].max, 'full');
  run(inst, 1);
  assert.ok(inst.z > z + 0.1, 'and on they go');
  story.on = false;
});

test('a wave skips a scene', () => {
  story.on = true; crew(1);
  const inst = game.create(1);
  inst.scene = new Scene('opening', inst);
  for (let k = 0; k < 120 && inst.scene; k++){
    pose.players[0].hands.right = { x: 0.5 + (Math.floor(k / 4) % 2 ? 0.08 : -0.08), y: 0.3, vx: 0, vy: 0, speed: 0 };
    inst.step(DT, W, H);
  }
  assert.equal(inst.scene, null);
  story.on = false;
});

test('the captain gives each tip once, as it comes', () => {
  story.on = false; crew(1);
  const inst = game.create(1);
  const said = [];
  const say = inst.captain.say.bind(inst.captain);
  inst.captain.say = (text, words, o) => { const ok = say(text, words, o); if (ok) said.push(words); return ok; };
  for (let k = 0; k < 140 / DT && inst.step_ === 0; k++){ if (inst.levelup) inst.levelup.t = 1e9; inst.step(DT, W, H); }
  for (const w of ['CRYSTALS!', 'LEAN!', 'DUCK!', 'SQUEEZE IN!', 'SPREAD OUT!']) assert.equal(said.filter(s => s === w).length, 1, `${w}: ${said}`);
  assert.ok(said.indexOf('LEAN!') < said.indexOf('DUCK!') && said.indexOf('DUCK!') < said.indexOf('SQUEEZE IN!') && said.indexOf('SQUEEZE IN!') < said.indexOf('SPREAD OUT!'));
  /* And then straight on running: no fighting in level 1. */
  assert.equal(inst.phase, 'corridor');
  assert.ok(!inst.fight);
});

test('her window comes up while she talks and goes again', () => {
  const cap = new Captain();
  cap.say('Hello there crew.', 'HI');
  for (let k = 0; k < 30; k++) cap.step(DT);
  assert.ok(cap.show > 0.9 && cap.talking);
  for (let k = 0; k < 120; k++) cap.step(DT);
  assert.ok(cap.show < 0.1 && !cap.busy);
  cap.draw(fake(), W, H);
});

test('the boss shows itself before its fight, and the ending names the crew', () => {
  story.on = true; crew(2);
  const inst = game.create(2);
  inst.scene = null; inst.things = [];
  inst.step_ = inst.level.plan.indexOf('boss') - 1; inst._next();
  assert.equal(inst.scene.kind, 'boss');
  assert.equal(inst.scene.lines[0][0], 'robot');
  inst.draw(fake(), W, H);
  const won = script('won', inst).map(l => l[1]).join(' ');
  assert.ok(won.includes(NAMES[0]) && won.includes(NAMES[1]));
  inst.boss.fight.bots.forEach(b => { if (b.part) b.hp = 0; }); inst.scene = null;
  for (let k = 0; k < 400 && !inst.over; k++){ if (inst.levelup) inst.levelup.t = 1e9; inst.step(DT, W, H); }
  assert.ok(inst.over);
  let k = 0; while (!inst.outro(DT, W, H) && k++ < 2000) if (k % 50 === 0) inst.draw(fake(), W, H);
  assert.ok(k < 2000);
  assert.equal(inst.out.scene.kind, 'won');
  story.on = false;
});
