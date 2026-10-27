import test from 'node:test';
import assert from 'node:assert/strict';
import game, { COST, OPEN, BUILD, UPGRADE, REPAIR, POINT_HOLD, CLAP_R, CLAP_COOL, KNIGHT_SPEED, HEARTS, START_COINS, BREAK, MONSTERS, waveOf, countOf, gapOf, upgradeCost } from '../src/games/castle-defense.js';
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
  /* Pad 2 is up near the top; the far end of the trail is down by the castle. */
  const m = monster(inst, 'slime', PATHS[0].total * 0.97);
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

/* A child's hands at (x, y), `gap` screen heights apart. */
function hands(x, y, gap){ real(1); const p = pose.players[0], d = gap / 2 / (16 / 9); p.hands.left = { x: x - d, y, speed: 0 }; p.hands.right = { x: x + d, y, speed: 0 }; }
/* A clap at (x, y): hands apart, then snapped together over a few frames. */
function clapAt(inst, x = 0.5, y = 0.5){
  hands(x, y, 0.3); run(inst, 0.1);
  for (const g of [0.2, 0.1, 0.03]){ hands(x, y, g); inst.step(DT, W, H); }
  hands(x, y, 0.3); run(inst, 0.05);
}
const knight = (inst) => inst.knights[0];
/* A monster parked right by the knight. */
function byKnight(inst, kind = 'slime'){
  const k = knight(inst);
  let best = 0, bd = 9;
  for (let s = 0; s < PATHS[0].total; s += 0.01){ const p = along(s), d = Math.hypot((p.x - k.x) * 16 / 9, p.y - k.y); if (d < bd){ bd = d; best = s; } }
  const m = monster(inst, kind, best); m.side = 0;
  const p = along(best); k.x = k.tx = p.x; k.y = k.ty = p.y;
  return m;
}

test('hands together held on a spot send the knight there; it walks, it does not jump', () => {
  const inst = quiet(), k = knight(inst);
  const from = { x: k.x, y: k.y }, to = { x: 0.6, y: 0.45 };
  hands(to.x, to.y, 0.03); run(inst, POINT_HOLD + 0.05);
  assert.ok(Math.abs(k.tx - to.x) < 0.01 && Math.abs(k.ty - to.y) < 0.01, 'a flag goes up there');
  const d0 = Math.hypot((to.x - from.x) * 16 / 9, to.y - from.y);
  assert.ok(Math.hypot((k.x - from.x) * 16 / 9, k.y - from.y) < KNIGHT_SPEED * 0.5, 'walking, not teleporting');
  hands(0.5, 0.95, 0.5); run(inst, d0 / KNIGHT_SPEED + 0.5);
  assert.ok(Math.hypot((k.x - to.x) * 16 / 9, k.y - to.y) < 0.01, 'and it gets there, hands down or not');
});

test('hands apart, one hand, or a quick touch together do not move the knight', () => {
  const inst = quiet(), k = knight(inst), tx = k.tx;
  hands(0.6, 0.45, 0.4); run(inst, 2);
  one(0.6, 0.45); run(inst, 2);
  hands(0.6, 0.45, 0.03); run(inst, POINT_HOLD * 0.5); hands(0.6, 0.45, 0.4); run(inst, 0.5);
  assert.equal(k.tx, tx);
});

test('a clap hurts and knocks back the monsters round the knight - not one far off', () => {
  const inst = quiet();
  const m = byKnight(inst), s0 = m.s;
  const far = monster(inst, 'slime', s0 > 2 ? 0.3 : PATHS[0].total - 0.3);
  clapAt(inst, 0.8, 0.2);
  assert.ok(m.hp < m.max, 'wherever the hands are, it is the knight that claps');
  assert.ok(m.s < s0, 'knocked back');
  assert.equal(far.hp, far.max);
  assert.ok(inst.clapped);
});

test('claps come one at a time, a moment apart; a slow bringing-together is not a clap', () => {
  const inst = quiet();
  const m = byKnight(inst, 'ogre'); m.speed = 0;
  /* The hands stay over the knight, so holding them together there just
     keeps it where it is. */
  const k = knight(inst), x = k.x, y = k.y;
  hands(x, y, 0.3); run(inst, 0.2);
  for (let g = 0.3; g > 0.02; g -= 0.005){ hands(x, y, g); inst.step(DT, W, H); }
  assert.equal(m.hp, m.max, 'slow hands');
  clapAt(inst, x, y);
  const after = m.hp;
  assert.ok(after < m.max);
  clapAt(inst, x, y);
  assert.equal(m.hp, after, 'a second clap straight after does nothing yet');
  run(inst, CLAP_COOL + 0.1); clapAt(inst, x, y);
  assert.ok(m.hp < after, 'a second clap a moment later');
});

test('a clap is not a point: the knight stays where it was going', () => {
  const inst = quiet(), k = knight(inst), tx = k.tx, ty = k.ty;
  clapAt(inst, 0.7, 0.3); run(inst, 0.2);
  assert.equal(k.tx, tx); assert.equal(k.ty, ty);
});

test('hands no longer swat: a fast hand through a monster does nothing', () => {
  const inst = quiet();
  const m = monster(inst, 'slime', 0.6), p = along(0.6);
  hand(p.x, p.y - 0.03, 3); run(inst, 0.2);
  assert.equal(m.hp, m.max);
});

test('with the mouse, a resting pointer sends the knight, and it claps by itself near monsters', () => {
  const inst = quiet(), k = knight(inst);
  hand(0.6, 0.45); run(inst, POINT_HOLD + 0.05);
  assert.ok(Math.abs(k.tx - 0.6) < 0.01);
  const m = byKnight(inst);
  hand(k.x, k.y); run(inst, 0.2);
  assert.ok(m.hp < m.max);
});

test('every child has a knight of their own', () => {
  const inst = quiet(2);
  pair(0.6, 0.45);
  assert.ok(inst.knights.length >= 4);
  const xs = inst.knights.slice(0, 4).map(k => k.x);
  assert.equal(new Set(xs).size, 4, 'waiting side by side');
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

test('waves grow in number; an ogre every fifth', () => {
  const kinds = (w) => waveOf(w).map(m => m.kind);
  assert.ok(waveOf(6).length > waveOf(1).length);
  assert.deepEqual([...new Set(kinds(1))], ['slime']);
  assert.ok(kinds(2).includes('goblin') && !kinds(2).includes('bat'));
  assert.ok(kinds(3).includes('bat'));
  assert.ok(kinds(5).includes('ogre') && !kinds(4).includes('ogre'));
  for (let w = 2; w < 30; w++) assert.ok(countOf(w) > countOf(w - 1), 'a few more every wave, without end');
});

test('one trail, in at the top left and the long way round to the castle', () => {
  assert.equal(PATHS.length, 1);
  const P = PATHS[0], start = P.pts[0], end = P.pts[P.pts.length - 1];
  assert.ok(start[1] < 0 && start[0] < 0.2, 'from over the top edge, at the left');
  assert.ok(onCastle(end[0], end[1] + 0.02), 'to the castle');
  assert.ok(P.total > 4, `the long way round: ${P.total.toFixed(2)} screen heights`);
  assert.ok(Math.max(...P.pts.map(p => p[0])) > 0.85, 'all the way over to the right');
  assert.ok(CASTLE.x < 0.25 && CASTLE.w >= 0.3 && CASTLE_BASE > 0.95, 'the castle wide along the bottom left');
});

test('a tower between two turns of the trail reaches it on both sides', () => {
  /* Pad 6 sits between the second and third rows of the trail. */
  const pad = PADS[6], ys = [];
  for (let s = 0; s < PATHS[0].total; s += 0.02){ const p = along(s); if (Math.hypot((p.x - pad.x) * 16 / 9, p.y - pad.y) < 0.24) ys.push(p.y); }
  assert.ok(ys.some(y => y < pad.y - 0.06), 'the row above');
  assert.ok(ys.some(y => y > pad.y + 0.06), 'and the row below');
});

test('a tower fires at whichever monster in reach is nearest the castle', () => {
  const inst = quiet(); inst.coins = 99;
  build(inst, 6, 'archer'); inst._upgrade(6, 0); inst._upgrade(6, 0);
  const near = [];
  for (let s = 0; s < PATHS[0].total; s += 0.02){ const p = along(s); if (Math.hypot((p.x - PADS[6].x) * 16 / 9, p.y - PADS[6].y) < 0.2) near.push(s); }
  const behind = monster(inst, 'ogre', near[0]), ahead = monster(inst, 'ogre', near[near.length - 1]);
  run(inst, 0.8);
  assert.ok(ahead.hp < ahead.max, 'the one further along');
  assert.equal(behind.hp, behind.max);
});

test('the next wave sets off before the last is cleared; each is held off when all of it is gone', () => {
  const inst = quiet();
  inst._startWave();
  run(inst, 60, () => { inst.monsters.forEach(m => { m.speed = 0; }); });
  assert.ok(inst.wave >= 2, 'the next one came anyway');
  assert.equal(inst.held, 0, 'nothing held off while its monsters are still about');
  for (const m of [...inst.monsters]) if (m.wave === 1) inst._damage(m, 999);
  run(inst, 0.1);
  assert.equal(inst.held, 1);
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

test('ghostly hands show building until a tower is up, then pointing and clapping until a clap', () => {
  const inst = quiet();
  run(inst, 2);
  assert.ok(inst.buildHint >= 0);
  build(inst, 2, 'archer');
  assert.equal(inst.buildHint, -1);
  monster(inst, 'slime', 0.5);
  assert.ok(inst.clapHint);
  inst.clap(0);
  assert.equal(inst.clapHint, null);
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

test('there is no clock: it lasts as long as the castle does', () => {
  assert.equal(game.endless, true);
  assert.equal(quiet().hud().hideClock, true);
});

test('waves creep up slowly, then pour out ever faster', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(countOf), [6, 7, 8, 9, 10]);
  assert.ok(countOf(30) > countOf(10) * 10);
  assert.ok(gapOf(30) < gapOf(10) / 10, 'a big wave comes out several at a time');
  const inst = quiet();
  inst.wave = 29; inst._startWave();
  inst.step(0.1, W, H);
  assert.ok(inst.monsters.length > 1, `${inst.monsters.length} out in a tenth of a second`);
});

test('monsters never get faster or tougher, wave after wave', () => {
  const inst = quiet();
  inst.wave = 1; inst._spawn('slime'); const first = inst.monsters.pop();
  inst.wave = 20; inst._spawn('slime'); const later = inst.monsters.pop();
  assert.equal(later.speed, first.speed);
  assert.equal(later.max, first.max);
});

test('a well-defended castle holds many waves; an empty one falls fast', () => {
  away();
  const idle = game.create(1);
  run(idle, 200);
  assert.ok(idle.over, 'no towers: overrun');
  const keep = game.create(1); keep.coins = 999;
  for (const i of [6, 4, 7, 2, 9, 5, 3]) keep._build(i, i % 2 ? 'archer' : 'cannon', 0);
  for (const [i] of keep.towers){ keep._upgrade(i, 0); keep._upgrade(i, 0); }
  run(keep, 200);
  assert.ok(!keep.over, 'held');
  assert.ok(keep.held >= 5, `held ${keep.held} waves`);
});
