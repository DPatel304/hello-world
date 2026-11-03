import test from 'node:test';
import assert from 'node:assert/strict';
import game, { story } from '../src/games/lkp-game.js';
import { MELEE, RANGED, STANDARD, CARDS, MAX_LEVEL, SPEED_UP, WIDE_UP, TEAM, TEAM_UP, arms, draw, take } from '../src/games/lkp-weapons.js';
import { FRONT } from '../src/games/lkp-combat.js';
import { pose } from '../src/tracking/pose.js';
story.on = false;

const W = 1920, H = 1080, DT = 1 / 60;
function fight(n = 1){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.left = { ...p.hands.right };
    p.centre = { x: 0.5, y: 0.6 }; p.scale = 0.3; p.lm = null;
  });
  const inst = game.create(n);
  inst.step(DT, W, H);
  inst.things = []; inst.rooms.push('combat'); inst.step_ = 1; inst._next();
  for (let k = 0; k < 20; k++) inst.step(DT, W, H);
  return inst;
}
const bot = (x, d = FRONT) => ({ x, d, hp: 999, max: 999, hitT: 0, target: -1, flash: 0, swing: 0, seed: 0 });
const only = (inst, bots) => { inst.fight.bots = bots; inst.fight.queue = 0; inst.fight.wave = 1; return bots; };

test('everyone starts with the standard punch, and no ranged weapon', () => {
  const inst = fight();
  const a = arms(inst.crew[0]);
  assert.equal(a.melee.id, STANDARD.id);
  assert.equal(a.ranged, null);
});

test('a melee weapon hits everything in its reach, at its own pace and strength', () => {
  const inst = fight(), rn = inst.crew[0];
  rn.melee = MELEE.hammer;
  const bots = only(inst, [bot(rn.x), bot(rn.x + MELEE.hammer.reach * 0.8)]);
  rn.swingT = MELEE.hammer.every - DT / 2;
  inst.fight.step(DT, W, H, []);
  assert.deepEqual(bots.map(b => 999 - b.hp), [MELEE.hammer.dmg, MELEE.hammer.dmg]);
  rn.swingT = 0;
  for (let k = 0; k < (MELEE.hammer.every - 0.2) / DT; k++) inst.fight.step(DT, W, H, []);
  assert.equal(999 - bots[0].hp, MELEE.hammer.dmg, 'not again yet');
});

test('ranged fires only with nothing in reach - at the nearest robots still coming', () => {
  const inst = fight(), rn = inst.crew[0];
  rn.ranged = RANGED.zapper;
  const back = bot(0.8, 0.8), nearer = bot(-0.8, 0.5);
  only(inst, [back, nearer]);
  rn.fireT = RANGED.zapper.every - DT / 2;
  inst.fight.step(DT, W, H, []);
  assert.deepEqual([back, nearer].map(b => 999 - b.hp), [0, RANGED.zapper.dmg], 'the nearer one, whatever lane');
  /* One in reach: melee instead. */
  const coming = bot(0.8, 0.8);
  only(inst, [bot(rn.x), coming]);
  rn.fireT = 99; rn.swingT = 0;
  for (let k = 0; k < 10; k++) inst.fight.step(DT, W, H, []);
  assert.equal(coming.hp, 999, 'no shots with a robot in front');
});

test('six cards; each level up draws three different ones, never one everyone\'s maxed', () => {
  assert.deepEqual(Object.keys(CARDS), ['damage', 'speed', 'armor', 'teamwork', 'wider', 'maxhp']);
  const crew = [{ up: {} }, { up: {} }];
  const seen = new Set();
  for (let k = 0; k < 200; k++){
    const d = draw(crew);
    assert.equal(new Set(d.map(c => c.key)).size, 3);
    d.forEach(c => seen.add(c.key));
  }
  assert.equal(seen.size, 6, 'all six turn up');
  crew[0].up.armor = MAX_LEVEL; crew[1].up.armor = MAX_LEVEL;
  crew[0].up.speed = MAX_LEVEL;
  for (let k = 0; k < 200; k++){
    const d = draw(crew).map(c => c.key);
    assert.ok(!d.includes('armor'), 'maxed by everyone');
    seen.add('x');
  }
  assert.ok([...Array(400)].some(() => draw(crew).some(c => c.key === 'speed')), 'maxed by one: still offered');
});

test('gold turns up now and then - about one card in eight', () => {
  let gold = 0, all = 0;
  for (let k = 0; k < 4000; k++) for (const c of draw([{}])){ all++; gold += c.gold ? 1 : 0; }
  assert.ok(gold / all > 0.09 && gold / all < 0.16, `${gold}/${all}`);
});

test('every card makes both weapons better at once', () => {
  const rn = { max: 100, hp: 100, melee: MELEE.blades, ranged: RANGED.zapper };
  take('speed', rn); take('wider', rn);
  const a = arms(rn);
  assert.ok(Math.abs(a.melee.every - MELEE.blades.every * (1 - SPEED_UP)) < 1e-9);
  assert.ok(Math.abs(a.ranged.every - RANGED.zapper.every * (1 - SPEED_UP)) < 1e-9);
  assert.ok(Math.abs(a.melee.reach - MELEE.blades.reach * (1 + WIDE_UP)) < 1e-9);
  assert.ok(a.ranged.splash > 0);
});

test('WIDER: a bolt bursts, catching robots close by for half', () => {
  const inst = fight(), rn = inst.crew[0];
  rn.ranged = RANGED.zapper;
  const aim = bot(0, 0.6), by = bot(0.03, 0.62), far = bot(0.8, 0.9);
  only(inst, [aim, by, far]);
  rn.fireT = 99; inst.fight.step(DT, W, H, []);
  assert.equal(999 - by.hp, 0, 'not without WIDER');
  for (let k = 0; k < 3; k++) take('wider', rn);
  rn.fireT = 99; inst.fight.step(DT, W, H, []);
  assert.equal(999 - by.hp, Math.round(RANGED.zapper.dmg * 0.5));
  assert.equal(far.hp, 999);
});

test('TEAMWORK: each teammate close by adds more', () => {
  const inst = fight(2), [a, b] = inst.crew;
  a.x = 0; b.x = 0.1;
  const t = bot(0);
  only(inst, [t]);
  a.swingT = 99; b.swingT = 0;
  for (let k = 0; k < 4; k++) take('teamwork', a);
  inst.fight.step(DT, W, H, []);
  assert.equal(999 - t.hp, Math.round(STANDARD.dmg * (1 + TEAM + 4 * TEAM_UP)));
});
