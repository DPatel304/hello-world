import test from 'node:test';
import assert from 'node:assert/strict';
import game, { COST, OPEN, PICK, UPGRADE, HEARTS, START_COINS, BREAK, MONSTERS, waveOf, toughness, upgradeCost } from '../src/games/castle-defense.js';
import { PADS, PATH, along } from '../src/games/castle-art.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };

/* One child, as the mouse: one hand, at (x, y), moving at `speed`. */
function hand(x, y, speed = 0){
  pose.mouse.active = true;
  const p = pose.players[0];
  p.present = true;
  for (const q of pose.players.slice(1)) q.present = false;
  p.hands.right = { x, y, vx: speed, vy: 0, speed }; p.hands.left = { ...p.hands.right };
}
const away = () => hand(0.97, 0.97);
/* A quiet castle: no waves coming unless a test starts one. */
function quiet(){ away(); const inst = game.create(1); inst.breakT = 1e9; inst.quiet = true; return inst; }
/* A monster parked `s` along the path, not moving. */
/* Build without the first tower calling the first wave. */
function build(inst, i, kind){ inst._build(i, kind, 0); if (inst.quiet) inst.breakT = 1e9; }
function monster(inst, kind, s){ inst._spawn(kind); const m = inst.monsters[inst.monsters.length - 1]; m.s = s; m.speed = 0; return m; }
/* How far along the path is nearest to a pad. */
function nearestS(pad){
  let best = 0, bd = 9;
  for (let s = 0; s < PATH.total; s += 0.01){ const p = along(s), d = Math.hypot((p.x - pad.x) * 16 / 9, p.y - pad.y); if (d < bd){ bd = d; best = s; } }
  return best;
}

test('holding over an empty pad opens the bubbles; holding on one builds it', () => {
  const inst = quiet(), pad = PADS[6];
  hand(pad.x, pad.y - 0.02); run(inst, OPEN + 0.1);
  assert.ok(inst.menus.has(6), 'bubbles up');
  const ch = inst.choices(6).find(c => c.kind === 'archer');
  hand(ch.x, ch.y); run(inst, PICK + 0.1);
  assert.equal(inst.towers.get(6)?.kind, 'archer');
  assert.equal(inst.coins, START_COINS - COST.archer);
  assert.ok(!inst.menus.has(6), 'bubbles gone');
});

test('a quick pass over a pad does nothing', () => {
  const inst = quiet(), pad = PADS[6];
  hand(pad.x, pad.y - 0.02); run(inst, OPEN * 0.5);
  away(); run(inst, 0.5);
  assert.ok(!inst.menus.has(6));
});

test('without the coins, a tower cannot be built', () => {
  const inst = quiet(); inst.coins = COST.cannon - 1;
  const pad = PADS[6];
  hand(pad.x, pad.y - 0.02); run(inst, OPEN + 0.1);
  const ch = inst.choices(6).find(c => c.kind === 'cannon');
  hand(ch.x, ch.y); run(inst, PICK * 3);
  assert.ok(!inst.towers.has(6));
  assert.equal(inst.coins, COST.cannon - 1);
});

test('bubbles that nobody touches fold away', () => {
  const inst = quiet(), pad = PADS[6];
  hand(pad.x, pad.y - 0.02); run(inst, OPEN + 0.1);
  away(); run(inst, 3);
  assert.ok(!inst.menus.has(6));
});

test('holding on a tower upgrades it, up to three, for coins', () => {
  const inst = quiet(); inst.coins = 100;
  build(inst, 6, 'archer');
  const pad = PADS[6];
  hand(pad.x, pad.y - 0.02);
  run(inst, UPGRADE + 0.1);
  assert.equal(inst.towers.get(6).lvl, 2);
  run(inst, UPGRADE + 0.8);
  assert.equal(inst.towers.get(6).lvl, 3);
  run(inst, UPGRADE * 3);
  assert.equal(inst.towers.get(6).lvl, 3, 'three is the top');
  assert.equal(inst.coins, 100 - COST.archer - upgradeCost('archer', 1) - upgradeCost('archer', 2));
});

test('a tower shoots a monster in range until it is gone, and its coins go in the chest', () => {
  const inst = quiet();
  build(inst, 6, 'archer');
  const before = inst.coins;
  monster(inst, 'slime', nearestS(PADS[6]));
  run(inst, 6);
  assert.equal(inst.monsters.length, 0);
  assert.equal(inst.coins, before + MONSTERS.slime.coins);
});

test('a tower ignores a monster out of range', () => {
  const inst = quiet();
  build(inst, 6, 'archer');
  const m = monster(inst, 'slime', 0.02);
  run(inst, 3);
  assert.equal(m.hp, m.max);
});

test('cannons cannot hit bats; archers can', () => {
  const a = quiet(); build(a, 6, 'cannon');
  const bat = monster(a, 'bat', nearestS(PADS[6]));
  let fired = false;
  run(a, 4, () => { if (a.shots.length) fired = true; });
  assert.equal(fired, false, "the cannon doesn't waste a shot on it");
  assert.equal(bat.hp, bat.max);
  const b = quiet(); build(b, 6, 'archer');
  monster(b, 'bat', nearestS(PADS[6]));
  run(b, 6);
  assert.equal(b.monsters.length, 0);
});

test('a frost tower slows monsters down', () => {
  const inst = quiet(); build(inst, 6, 'frost');
  const m = monster(inst, 'ogre', nearestS(PADS[6]));
  run(inst, 1.5);
  assert.ok(m.slowK < 1 && m.slowT > 0);
});

test('a swat knocks a monster back and hurts it; a slow hand does not', () => {
  const inst = quiet();
  const m = monster(inst, 'slime', 1.2), p = along(1.2), y = p.y - MONSTERS.slime.size * 0.4;
  hand(p.x, y, 0.2); run(inst, 0.2);
  assert.equal(m.hp, m.max, 'a gentle touch');
  hand(p.x, y, 2); inst.step(DT, W, H);
  assert.ok(m.hp < m.max);
  assert.ok(m.s < 1.2, 'knocked back');
  const s1 = m.s, hp1 = m.hp;
  run(inst, 0.1);
  assert.equal(m.hp, hp1, 'one swat is one hit, not one a frame');
  assert.equal(m.s, s1);
});

test('a monster reaching the castle takes hearts; an ogre takes more; no hearts is the end', () => {
  const inst = quiet();
  monster(inst, 'slime', PATH.total - 0.001).speed = 1;
  run(inst, 0.1);
  assert.equal(inst.hearts, HEARTS - 1);
  monster(inst, 'ogre', PATH.total - 0.001).speed = 1;
  run(inst, 0.1);
  assert.equal(inst.hearts, HEARTS - 1 - MONSTERS.ogre.harm);
  assert.ok(!inst.over);
  inst.hearts = 1;
  monster(inst, 'slime', PATH.total - 0.001).speed = 1;
  run(inst, 0.1);
  assert.ok(inst.over && inst.lost);
});

test('waves grow and toughen; an ogre every fifth', () => {
  assert.ok(waveOf(6).length > waveOf(1).length);
  assert.deepEqual([...new Set(waveOf(1))], ['slime']);
  assert.ok(waveOf(2).includes('goblin') && !waveOf(2).includes('bat'));
  assert.ok(waveOf(3).includes('bat'));
  assert.ok(waveOf(5).includes('ogre') && !waveOf(4).includes('ogre'));
  assert.ok(toughness(10) > toughness(5) * 2);
});

test('a wave held off flies a pennant, then a break, then the next', () => {
  const inst = quiet();
  build(inst, 6, 'archer');
  inst._startWave();
  inst.queue = []; inst.monsters = [];
  run(inst, 0.1);
  assert.equal(inst.held, 1);
  assert.equal(inst.state, 'build');
  run(inst, BREAK + 0.2);
  assert.equal(inst.wave, 2);
});

test('the first tower brings the first wave on; without one it comes anyway', () => {
  away();
  const a = game.create(1);
  run(a, 3);
  build(a, 6, 'archer');
  run(a, 3);
  assert.equal(a.wave, 1);
  const b = game.create(1);
  run(b, 10); assert.equal(b.wave, 0);
  run(b, 8); assert.equal(b.wave, 1);
});

test('the ghostly hand shows building until a tower is up, and swatting until a swat', () => {
  const inst = quiet();
  run(inst, 2);
  assert.ok(inst.buildHint >= 0);
  build(inst, 6, 'archer');
  assert.equal(inst.buildHint, -1);
  monster(inst, 'slime', PATH.total * 0.85);
  assert.ok(inst.swatHint);
  inst.swatted = true;
  assert.equal(inst.swatHint, null);
});

test('no clock and no score on screen; the round ends with an ending', () => {
  const inst = quiet();
  const h = inst.hud();
  assert.equal(h.hideClock, true);
  assert.equal(h.hideScore, true);
  inst.lost = true; inst.over = true;
  let done = false, s = 0;
  for (; s < 8 && !done; s += DT) done = inst.outro(DT, W, H);
  assert.ok(done && s > 3);
});

test('a well-defended castle holds many waves; an empty one falls fast', () => {
  away();
  const idle = game.create(1);
  run(idle, 200);
  assert.ok(idle.over, 'no towers: overrun');
  const keep = game.create(1); keep.coins = 999;
  for (const i of [6, 4, 1, 7, 3, 5]) keep._build(i, i % 2 ? 'archer' : 'cannon', 0);
  for (const [i] of keep.towers){ keep._upgrade(i, 0); keep._upgrade(i, 0); }
  run(keep, 200);
  assert.ok(!keep.over, 'held');
  assert.ok(keep.held >= 5, `held ${keep.held} waves`);
});
