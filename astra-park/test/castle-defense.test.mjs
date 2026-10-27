import test from 'node:test';
import assert from 'node:assert/strict';
import game, { COST, OPEN, BUILD, UPGRADE, REPAIR, HEARTS, START_COINS, BREAK, MONSTERS, waveOf, toughness, upgradeCost } from '../src/games/castle-defense.js';
import { PADS, PATHS, CASTLE, CASTLE_BASE, along, onCastle } from '../src/games/castle-art.js';
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
/* A child's two hands, side by side at (x, y) - or with `n` children, n
   hands from different children - or just one hand there and the other
   down by their side. */
function both(x, y){ real(1); const p = pose.players[0]; p.hands.left = { x: x - 0.01, y, speed: 0 }; p.hands.right = { x: x + 0.01, y, speed: 0 }; }
function one(x, y){ real(1); const p = pose.players[0]; p.hands.left = { x, y, speed: 0 }; p.hands.right = { x: 0.97, y: 0.97, speed: 0 }; }
function pair(x, y){ real(2); for (const i of [0, 1]){ const p = pose.players[i]; p.hands.left = { x: x + (i ? 0.01 : -0.01), y, speed: 0 }; p.hands.right = { x: 0.97 - i * 0.02, y: 0.97, speed: 0 }; } }
function real(n){ pose.mouse.active = false; pose.players.forEach((p, i) => { p.present = i < n; }); }
/* A quiet castle: no waves coming unless a test starts one. */
function quiet(n = 1){ away(); const inst = game.create(n); inst.breakT = 1e9; inst.quiet = true; return inst; }
/* A monster parked `s` along a path, not moving. */
/* Build without the first tower calling the first wave. */
function build(inst, i, kind){ inst._build(i, kind, 0); if (inst.quiet) inst.breakT = 1e9; }
function monster(inst, kind, s, path = 0){ inst._spawn(kind, path); const m = inst.monsters[inst.monsters.length - 1]; m.s = s; m.speed = 0; return m; }
/* How far along the left path is nearest to a pad. */
function nearestS(pad, path = 0){
  let best = 0, bd = 9;
  for (let s = 0; s < PATHS[path].total; s += 0.01){ const p = along(s, path), d = Math.hypot((p.x - pad.x) * 16 / 9, p.y - pad.y); if (d < bd){ bd = d; best = s; } }
  return best;
}
const PATH = PATHS[0];

test('one hand on a pad brings up the bubbles; both hands held on one build it', () => {
  const inst = quiet(), pad = PADS[2];
  one(pad.x, pad.y - 0.02); run(inst, OPEN + 0.1);
  assert.ok(inst.menus.has(2), 'bubbles up');
  const ch = inst.choices(2).find(c => c.kind === 'archer');
  both(ch.x, ch.y); run(inst, BUILD * 0.6);
  assert.ok(!inst.towers.has(2), 'it takes a while');
  run(inst, BUILD * 0.5);
  assert.equal(inst.towers.get(2)?.kind, 'archer');
  assert.equal(inst.coins, START_COINS - COST.archer);
  assert.ok(!inst.menus.has(2), 'bubbles gone');
});

test('one hand alone on a bubble builds nothing, however long', () => {
  const inst = quiet(), pad = PADS[2];
  one(pad.x, pad.y - 0.02); run(inst, OPEN + 0.1);
  const ch = inst.choices(2).find(c => c.kind === 'archer');
  one(ch.x, ch.y); run(inst, BUILD * 3);
  assert.ok(!inst.towers.has(2));
  assert.ok(inst.lonely.length, 'a ghostly second hand beckons');
});

test('letting go partway lets the work drain away', () => {
  const inst = quiet(), pad = PADS[2];
  one(pad.x, pad.y - 0.02); run(inst, OPEN + 0.1);
  const ch = inst.choices(2).find(c => c.kind === 'archer');
  both(ch.x, ch.y); run(inst, BUILD * 0.7);
  one(ch.x, ch.y); run(inst, BUILD * 0.7);
  both(ch.x, ch.y); run(inst, BUILD * 0.5);
  assert.ok(!inst.towers.has(2), 'started over, near enough');
});

test('two children with a hand each build together', () => {
  const inst = quiet(2), pad = PADS[2];
  one(pad.x, pad.y - 0.02); run(inst, OPEN + 0.1);
  const ch = inst.choices(2).find(c => c.kind === 'frost');
  pair(ch.x, ch.y); run(inst, BUILD + 0.1);
  assert.equal(inst.towers.get(2)?.kind, 'frost');
});

test('a quick pass over a pad does nothing', () => {
  const inst = quiet(), pad = PADS[2];
  one(pad.x, pad.y - 0.02); run(inst, OPEN * 0.5);
  away(); run(inst, 0.5);
  assert.ok(!inst.menus.has(2));
});

test('without the coins, a tower cannot be built', () => {
  const inst = quiet(); inst.coins = COST.cannon - 1;
  const pad = PADS[2];
  one(pad.x, pad.y - 0.02); run(inst, OPEN + 0.1);
  const ch = inst.choices(2).find(c => c.kind === 'cannon');
  both(ch.x, ch.y); run(inst, BUILD * 3);
  assert.ok(!inst.towers.has(2));
  assert.equal(inst.coins, COST.cannon - 1);
});

test('bubbles that nobody touches fold away', () => {
  const inst = quiet(), pad = PADS[2];
  one(pad.x, pad.y - 0.02); run(inst, OPEN + 0.1);
  away(); run(inst, 3);
  assert.ok(!inst.menus.has(2));
});

test('both hands held on a tower upgrade it, up to three, for coins', () => {
  const inst = quiet(); inst.coins = 100;
  build(inst, 2, 'archer');
  const pad = PADS[2];
  one(pad.x, pad.y - 0.02); run(inst, UPGRADE * 2);
  assert.equal(inst.towers.get(2).lvl, 1, 'not with one hand');
  both(pad.x, pad.y - 0.02);
  run(inst, UPGRADE + 0.1);
  assert.equal(inst.towers.get(2).lvl, 2);
  run(inst, UPGRADE + 0.9);
  assert.equal(inst.towers.get(2).lvl, 3);
  run(inst, UPGRADE * 3);
  assert.equal(inst.towers.get(2).lvl, 3, 'three is the top');
  assert.equal(inst.coins, 100 - COST.archer - upgradeCost('archer', 1) - upgradeCost('archer', 2));
});

test('both hands on the castle mend it, a heart at a time, up to full', () => {
  const inst = quiet(); inst.hearts = HEARTS - 2;
  const x = CASTLE.x, y = CASTLE_BASE - 0.15;
  assert.ok(onCastle(x, y));
  one(x, y); run(inst, REPAIR * 2);
  assert.equal(inst.hearts, HEARTS - 2, 'not with one hand');
  both(x, y); run(inst, REPAIR + 0.1);
  assert.equal(inst.hearts, HEARTS - 1);
  run(inst, REPAIR * 3);
  assert.equal(inst.hearts, HEARTS, 'and no further');
  assert.ok(!(inst.work.get('castle')?.t > 0), 'nothing to mend: no ring filling');
});

test('with the mouse, the one pointer counts as both hands', () => {
  const inst = quiet(), pad = PADS[2];
  hand(pad.x, pad.y - 0.02); run(inst, OPEN + 0.1);
  const ch = inst.choices(2).find(c => c.kind === 'archer');
  hand(ch.x, ch.y); run(inst, BUILD + 0.1);
  assert.equal(inst.towers.get(2)?.kind, 'archer');
});

test('a tower shoots a monster in range until it is gone, and its coins go in the chest', () => {
  const inst = quiet();
  build(inst, 2, 'archer');
  const before = inst.coins;
  monster(inst, 'slime', nearestS(PADS[2]));
  run(inst, 6);
  assert.equal(inst.monsters.length, 0);
  assert.equal(inst.coins, before + MONSTERS.slime.coins);
});

test('a tower ignores a monster out of range', () => {
  const inst = quiet();
  build(inst, 2, 'archer');
  const m = monster(inst, 'slime', PATHS[1].total * 0.6, 1);
  run(inst, 3);
  assert.equal(m.hp, m.max);
});

test('cannons cannot hit bats; archers can', () => {
  const a = quiet(); build(a, 2, 'cannon');
  const bat = monster(a, 'bat', nearestS(PADS[2]));
  let fired = false;
  run(a, 4, () => { if (a.shots.length) fired = true; });
  assert.equal(fired, false, "the cannon doesn't waste a shot on it");
  assert.equal(bat.hp, bat.max);
  const b = quiet(); build(b, 2, 'archer');
  monster(b, 'bat', nearestS(PADS[2]));
  run(b, 6);
  assert.equal(b.monsters.length, 0);
});

test('a frost tower slows monsters down', () => {
  const inst = quiet(); build(inst, 2, 'frost');
  const m = monster(inst, 'ogre', nearestS(PADS[2]));
  run(inst, 1.5);
  assert.ok(m.slowK < 1 && m.slowT > 0);
});

test('a swat knocks a monster back and hurts it; a slow hand does not', () => {
  const inst = quiet();
  const m = monster(inst, 'slime', 0.6), p = along(0.6), y = p.y - MONSTERS.slime.size * 0.4;
  hand(p.x, y, 0.2); run(inst, 0.2);
  assert.equal(m.hp, m.max, 'a gentle touch');
  hand(p.x, y, 2); inst.step(DT, W, H);
  assert.ok(m.hp < m.max);
  assert.ok(m.s < 0.6, 'knocked back');
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
  const kinds = (w) => waveOf(w).map(m => m.kind);
  assert.ok(waveOf(6).length > waveOf(1).length);
  assert.deepEqual([...new Set(kinds(1))], ['slime']);
  assert.ok(kinds(2).includes('goblin') && !kinds(2).includes('bat'));
  assert.ok(kinds(3).includes('bat'));
  assert.ok(kinds(5).includes('ogre') && !kinds(4).includes('ogre'));
  assert.ok(toughness(10) > toughness(5) * 2);
});

test('the first wave comes down the short path, the second the long one, then both', () => {
  const paths = (w) => [...new Set(waveOf(w).map(m => m.path))].sort();
  assert.deepEqual(paths(1), [0]);
  assert.deepEqual(paths(2), [1]);
  assert.deepEqual(paths(3), [0, 1]);
  const inst = quiet();
  inst._startWave(); run(inst, 4);
  assert.ok(inst.monsters.length && inst.monsters.every(m => m.path === 0));
});

test('both paths come in over the top and end at the castle; one is much longer', () => {
  for (const P of PATHS){
    assert.ok(P.pts[0][1] < 0, 'from over the top edge');
    const end = P.pts[P.pts.length - 1];
    assert.ok(onCastle(end[0], end[1] + 0.02), 'to the castle');
  }
  assert.ok(PATHS[1].total > PATHS[0].total * 2, `${PATHS[0].total.toFixed(2)} and ${PATHS[1].total.toFixed(2)}`);
  assert.ok(CASTLE.x < 0.25 && CASTLE.w >= 0.3 && CASTLE_BASE > 0.95, 'wide, along the bottom left');
});

test('a tower between the paths reaches monsters on either', () => {
  for (const path of [0, 1]){
    const inst = quiet(); inst.coins = 99;
    build(inst, 4, 'archer'); inst._upgrade(4, 0);
    const m = monster(inst, 'slime', nearestS(PADS[4], path), path);
    run(inst, 2);
    assert.ok(m.hp < m.max || m.dead, `path ${path}`);
  }
});

test('a tower fires at whichever monster is nearest the castle, on either path', () => {
  const inst = quiet(); inst.coins = 99;
  build(inst, 4, 'archer'); inst._upgrade(4, 0); inst._upgrade(4, 0);
  /* On the long path but further from the castle, and on the short one
     nearer: the short-path one is shot first. */
  const far = monster(inst, 'ogre', nearestS(PADS[4], 1), 1);
  const near = monster(inst, 'ogre', nearestS(PADS[4], 0), 0);
  run(inst, 0.8);
  assert.ok(near.hp < near.max);
  assert.equal(far.hp, far.max);
});

test('a wave held off flies a pennant, then a break, then the next', () => {
  const inst = quiet();
  build(inst, 2, 'archer');
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
  build(a, 2, 'archer');
  run(a, 3);
  assert.equal(a.wave, 1);
  const b = game.create(1);
  run(b, 18); assert.equal(b.wave, 0);
  run(b, 6); assert.equal(b.wave, 1);
});

test('the ghostly hand shows building until a tower is up, and swatting until a swat', () => {
  const inst = quiet();
  run(inst, 2);
  assert.ok(inst.buildHint >= 0);
  build(inst, 2, 'archer');
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
  for (const i of [2, 9, 4, 11, 14, 3, 10]) keep._build(i, i % 2 ? 'archer' : 'cannon', 0);
  for (const [i] of keep.towers){ keep._upgrade(i, 0); keep._upgrade(i, 0); }
  run(keep, 200);
  assert.ok(!keep.over, 'held');
  assert.ok(keep.held >= 5, `held ${keep.held} waves`);
});
