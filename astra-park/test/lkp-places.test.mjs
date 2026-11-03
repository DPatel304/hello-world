import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story, ROLLER } from '../src/games/lkp-game.js';
import { PAL, RUN } from '../src/games/lkp-art.js';
import { Treasure } from '../src/games/lkp-treasure.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 30;
function crew(n = 1){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => { p.present = i < n; p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right }; p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null; });
}
const corridor = (inst, n) => { const idx = inst.level.plan.map((k, i) => k === 'corridor' ? i : -1).filter(i => i >= 0)[n]; inst.step_ = idx - 1; inst.things = []; inst._next(); };

test('reaching up for crystals never pauses the game', () => {
  story.on = false; crew(1);
  const inst = game.create(1);
  assert.ok(inst.pausable());
  inst.treasure = new Treasure(inst);
  assert.equal(inst.pausable(), false);
});

test('each corridor after the first is its own place, with its own look and name', () => {
  story.on = false; crew(1);
  const inst = game.create(1);
  const keys = new Set([PAL.world.key]);
  for (const n of [1, 2, 3]){
    corridor(inst, n);
    assert.equal(inst.seg.kind, 'corridor');
    assert.ok(inst.placeCard && inst.placeCard.name, 'its name shows');
    keys.add(PAL.world.key);
  }
  assert.equal(keys.size, 4, 'four different places');
  game.create(1);
  assert.equal(PAL.world.key, 'verdant-morning', 'a new run starts back at the crash site');
});

test('a rolling boulder hits whoever is where it crosses, and nobody else', () => {
  story.on = false; crew(2);
  const inst = game.create(2);
  corridor(inst, 1);
  assert.ok(inst.things.some(t => t.kind === 'roller'), 'the canyon has boulders');
  /* (standing still, each where they belong: 0 on the left, 1 on the right) */
  inst.leanOf = () => 0;
  for (const i of [0, 1]){ inst.crew[i].x = inst._home(i); inst.crew[i].safe = 0; }
  assert.ok(inst._home(1) - inst._home(0) > ROLLER * 2 + 0.2);
  inst.things = [{ kind: 'roller', d: inst.z + RUN + 0.05, end: inst._home(0), dir: 1 }];
  const hp = inst.crew.map(rn => rn.hp);
  for (let k = 0; k < 30; k++) inst.step(DT, W, H);
  assert.ok(inst.crew[0].hp < hp[0], 'hit');
  assert.equal(inst.crew[1].hp, hp[1], 'missed');
});
