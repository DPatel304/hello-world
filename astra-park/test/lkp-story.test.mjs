import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story } from '../src/games/lkp-game.js';
import { Captain, script, NAMES } from '../src/games/lkp-captain.js';
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

test('the run opens with the captain\'s scene - nothing moves till it is done', () => {
  story.on = true; crew(2);
  const inst = game.create(2);
  assert.equal(inst.scene.kind, 'opening');
  const z = inst.z;
  run(inst, 3);
  assert.equal(inst.z, z, 'still');
  inst.draw(fake(), W, H);
  const len = script('opening').reduce((s, [who, text]) => s + lineTime(text, who) + 0.5, 0);
  run(inst, len);
  assert.equal(inst.scene, null);
  run(inst, 1);
  assert.ok(inst.z > z, 'and off they go');
  story.on = false;
});

test('a wave skips a scene', () => {
  story.on = true; crew(1);
  const inst = game.create(1);
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
  for (let k = 0; k < 50 / DT && inst.phase === 'corridor'; k++) inst.step(DT, W, H);
  for (const w of ['COINS!', 'LEAN!', 'DUCK!', 'HOP!']) assert.equal(said.filter(s => s === w).length, 1, `${w}: ${said}`);
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

test('the Warden shows itself before the boss fight, and the ending names the crew', () => {
  story.on = true; crew(2);
  const inst = game.create(2);
  inst.scene = null; inst.things = [];
  inst.step_ = 6; inst._next();
  assert.equal(inst.scene.kind, 'warden');
  assert.equal(inst.scene.lines[0][0], 'warden');
  inst.draw(fake(), W, H);
  const won = script('won', inst).map(l => l[1]).join(' ');
  assert.ok(won.includes(NAMES[0]) && won.includes(NAMES[1]));
  inst.boss.core.hp = 0; inst.scene = null;
  for (let k = 0; k < 200 && !inst.over; k++) inst.step(DT, W, H);
  assert.ok(inst.over);
  let k = 0; while (!inst.outro(DT, W, H) && k++ < 2000) if (k % 50 === 0) inst.draw(fake(), W, H);
  assert.ok(k < 2000);
  assert.equal(inst.out.scene.kind, 'won');
  story.on = false;
});
