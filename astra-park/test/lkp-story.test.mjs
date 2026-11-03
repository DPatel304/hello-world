import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story } from '../src/games/lkp-game.js';
import { Captain, Scene, script, NAMES } from '../src/games/lkp-captain.js';
import { INTRO_BEATS, TITLE, WAKE, WIGGLE, UP, WHIP, BEAUTY, BACK, FILL, CRANE, POND_MAX, CRASH_MAX, RING_MAX, START } from '../src/games/lkp-intro.js';
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

test('the opening: title, the wreck, wiggle to wake, everyone answers, the briefing, the pond heals them, then into play', () => {
  story.on = true; crew(2);
  const inst = game.create(2), intro = inst.scene;
  assert.equal(intro.kind, 'intro');
  assert.deepEqual(INTRO_BEATS.map(b => b.id), ['title', 'wreck', 'wake', 'call', 'brief', 'pond', 'go']);
  const z = inst.z;
  run(inst, TITLE + 0.1);
  assert.equal(intro.stage, 'wreck');
  inst.draw(fake(), W, H);
  run(inst, WAKE + 0.1);
  assert.equal(intro.stage, 'wake');
  assert.equal(inst.crew[0].hp, inst.crew[0].max * START, 'hurt in the crash');
  inst.draw(fake(), W, H);
  /* lying there till they wiggle - player 0 does, player 1 doesn't yet */
  run(inst, 2);
  for (let k = 0; k < (WIGGLE + UP + 0.3) / DT; k++){ hands(0, 0.5, 0.5, 2); inst.step(DT, W, H); }
  hands(0, 0.5, 0.5);
  assert.equal(intro.up[0], 1); assert.equal(intro.up[1], 0);
  assert.equal(intro.stage, 'wake');
  for (let k = 0; k < (WIGGLE + UP + 1.2) / DT; k++){ hands(1, 0.5, 0.5, 2); inst.step(DT, W, H); }
  hands(1, 0.5, 0.5);
  assert.equal(intro.stage, 'call');
  inst.draw(fake(), W, H);
  /* everyone answers - one isn't enough */
  hands(0, 0.5, 0.1); run(inst, 0.6); hands(0, 0.5, 0.5);
  assert.ok(intro.answered[0] && !intro.answered[1]);
  run(inst, 1.5);
  assert.equal(intro.stage, 'call');
  hands(1, 0.5, 0.1); run(inst, 0.6); hands(1, 0.5, 0.5);
  run(inst, 1);
  assert.equal(intro.stage, 'brief');
  assert.ok(intro.radio.busy && intro.radio.visible);
  inst.draw(fake(), W, H);
  run(inst, say(inst, 'brief') + 0.3);
  assert.equal(intro.stage, 'pond');
  /* the whip pan, the hold, the pull back - then they lean to walk over, and heal */
  run(inst, WHIP + BEAUTY + BACK);
  inst.draw(fake(), W, H);
  const x0 = intro.pos[0][0];
  hands(0, 0.9, 0.5); hands(1, 0.9, 0.5);
  run(inst, 1);
  assert.ok(intro.pos[0][0] > x0, 'walking over');
  run(inst, 3);
  assert.ok(intro._inPond(0) && intro._inPond(1), 'in the water');
  assert.ok(inst.crew[0].hp > inst.crew[0].max * START, 'healing');
  for (let k = 0; k < 30 / DT && intro.stage === 'pond'; k++) inst.step(DT, W, H);
  assert.equal(inst.crew[0].hp, inst.crew[0].max, 'full');
  assert.equal(intro.stage, 'go');
  inst.draw(fake(), W, H);
  let k = 0;
  for (; k < 30 / DT && inst.scene; k++){ inst.step(DT, W, H); assert.equal(inst.z, z, 'nothing moves till it\'s done'); if (k % 20 === 0) inst.draw(fake(), W, H); }
  assert.equal(inst.scene, null);
  assert.ok(k * DT >= CRANE, 'her last line, then the crane');
  run(inst, 1);
  assert.ok(inst.z > z, 'and off they go');
  story.on = false;
});

test('nobody waking, answering or walking never holds it up for ever', () => {
  story.on = true; crew(1);
  const inst = game.create(1);
  run(inst, TITLE + WAKE + CRASH_MAX + 1 + RING_MAX + 1 + say(inst, 'brief') + 1 + POND_MAX + say(inst, 'pondIn') + say(inst, 'pondWait') + 2 + say(inst, 'go') + CRANE + 2);
  assert.equal(inst.scene, null);
  assert.equal(inst.crew[0].hp, inst.crew[0].max);
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
