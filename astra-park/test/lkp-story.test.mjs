import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story } from '../src/games/lkp-game.js';
import { Captain, Scene, script, NAMES } from '../src/games/lkp-captain.js';
import { TITLE, DARK, WAKE, WIGGLE, UP, CRASH_MAX, RING_MAX } from '../src/games/lkp-intro.js';
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

test('the run opens on its title, the crash - wiggle to wake up, a hand to your ear to answer Nova - then off they go', () => {
  story.on = true; crew(2);
  const inst = game.create(2);
  const intro = inst.scene;
  assert.equal(intro.kind, 'intro');
  const z = inst.z;
  run(inst, TITLE + DARK + WAKE + 0.2);
  assert.equal(intro.stage, 'crash');
  inst.draw(fake(), W, H);
  /* Lying there till they wiggle - player 0 wiggles and gets up; player 1 doesn't. */
  run(inst, 2);
  assert.equal(intro.stage, 'crash');
  for (let k = 0; k < (WIGGLE + UP + 0.3) / DT; k++){ pose.players[0].hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 2 }; inst.step(DT, W, H); }
  assert.equal(intro.up[0], 1, 'up');
  assert.equal(intro.up[1], 0, 'still down');
  for (let k = 0; k < (WIGGLE + UP + 1.5) / DT; k++){ pose.players[1].hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 2 }; inst.step(DT, W, H); }
  pose.players[1].hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 };
  assert.equal(intro.stage, 'ring');
  inst.draw(fake(), W, H);
  /* Nova calling: one of them answers. */
  run(inst, 1);
  assert.equal(intro.stage, 'ring');
  pose.players[1].hands.right = { x: 0.5, y: 0.1, vx: 0, vy: 0, speed: 0 };
  run(inst, 0.6);
  assert.equal(intro.answered, 1);
  pose.players[1].hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 };
  run(inst, 1.2);
  assert.equal(intro.stage, 'talk');
  inst.draw(fake(), W, H);
  assert.equal(inst.z, z, 'nothing moves');
  const len = script('opening', inst).reduce((s, [who, text]) => s + lineTime(text, who) + 0.5, 0);
  run(inst, len + 0.5);
  assert.equal(inst.scene, null);
  run(inst, 1);
  assert.ok(inst.z > z, 'and off they go');
  story.on = false;
});

test('nobody waking or answering never holds it up for ever', () => {
  story.on = true; crew(1);
  const inst = game.create(1);
  run(inst, TITLE + DARK + WAKE + CRASH_MAX + UP + 2 + RING_MAX + 2);
  assert.equal(inst.scene.stage, 'talk');
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
  for (let k = 0; k < 70 / DT && inst.phase === 'corridor'; k++) inst.step(DT, W, H);
  for (const w of ['CRYSTALS!', 'LEAN!', 'DUCK!', 'HOP!']) assert.equal(said.filter(s => s === w).length, 1, `${w}: ${said}`);
  assert.ok(said.indexOf('LEAN!') < said.indexOf('DUCK!') && said.indexOf('DUCK!') < said.indexOf('HOP!'));
  /* And at the doors. */
  for (let k = 0; k < 8 / DT && inst.phase === 'cross'; k++) inst.step(DT, W, H);
  assert.ok(said.includes('PICK A DOOR'));
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
