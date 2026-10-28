import test from 'node:test';
import assert from 'node:assert/strict';
import game, { COST, KINDS, BUILD, REPAIR, MAX_LVL, CASTLE_HEARTS, TOWER_HP, STATS, SMASH_R, HAMMER, POINT_HOLD, LEAN_X, LEAN_Z, upgradeTime, castleTime,
               WALK, RUN, SWORD_COOL, SWORD_DMG, SUPER_R, KNIGHT_MAX, KNIGHT_HP, KNIGHT_MEND, OGRE_CLUB, WINDUP, SLAM_R, DOWN, killsFor, swordAt, HEARTS, START_COINS, BUILD_TIME, FIRST_BUILD, HORN, HORN_HOLD, MONSTERS, waveOf, countOf, gapOf } from '../src/games/castle-defense.js';
import { PADS, PATHS, CASTLE, CASTLE_BASE, along, onCastle, castleBox } from '../src/games/castle-art.js';
import { pose, L } from '../src/tracking/pose.js';
import { standIn } from '../src/games/moon-art.js';

const W = 1920, H = 1080, DT = 1 / 60, ASPECT = 16 / 9;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };

/* Children standing in the room, as the camera sees them: leaning sideways
   (lean, -1..1 of a full lean, + is right) and toward the screen (lz, - is
   toward), knees up and down by `knee` (screen heights), hands moving up or
   down at `hvy`, the middle of the body at `cy`. The first `n` are there,
   all standing still but the first. */
function body({ lean = 0, lz = 0, knee = 0, knees = true, hvy = 0, cy = 0.6, n = 1 } = {}){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => { p.present = i < n; });
  for (let i = 0; i < n; i++){
    const lm = standIn(0.5).map(q => ({ ...q, z: 0, v: 0.9 })), p = pose.players[i];
    if (i === 0){
      const sw = Math.abs(lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x);
      for (const j of [L.L_SHOULDER, L.R_SHOULDER]){ lm[j].x += lean * sw * LEAN_X * 1.2; lm[j].z = lz * sw * LEAN_Z * 1.2; }
      lm[L.L_KNEE].y -= knee; lm[L.R_KNEE].y += knee; lm[L.L_ANKLE].y -= knee; lm[L.R_ANKLE].y += knee;
      if (!knees){ lm[L.L_KNEE].v = lm[L.R_KNEE].v = 0.1; }
    }
    p.lm = lm; p.scale = 0.3;
    p.centre = { x: 0.5, y: i === 0 ? cy : 0.6 };
    const v = i === 0 ? hvy : 0;
    p.hands.left = { x: 0.45, y: 0.65, vx: 0, vy: v, speed: Math.abs(v) };
    p.hands.right = { x: 0.55, y: 0.65, vx: 0, vy: -v, speed: Math.abs(v) };
  }
}
/* Standing still and upright: `n` children there. */
const still = (n = 1) => body({ n });
/* Nobody there at all. */
function none(){ pose.mouse.active = false; pose.players.forEach(p => { p.present = false; }); }
/* Running on the spot - knees up and down twice a second - with a lean. */
const marching = (o = {}, height = 0.03) => (t) => body({ ...o, knee: Math.sin(t * Math.PI * 4) * height });
/* Hammering: fists going hard up and down. */
const hammering = (o = {}) => (t) => body({ ...o, hvy: Math.sin(t * Math.PI * 8) > 0 ? 2.5 : -2.5 });
/* A jump: the middle of the body rising quickly over a few frames, then back down. */
function jump(inst){
  for (let k = 1; k <= 4; k++){ body({ cy: 0.6 - k * 0.03 }); inst.step(DT, W, H); }
  for (let k = 3; k >= 0; k--){ body({ cy: 0.6 - k * 0.03 }); inst.step(DT, W, H); }
  run(inst, 0.1);
}

/* A child's hands at (x, y), `gap` screen heights apart. */
function hands(x, y, gap){
  const p = pose.players[0], d = gap / 2 / ASPECT;
  p.hands.left = { x: x - d, y, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: x + d, y, vx: 0, vy: 0, speed: 0 };
}
/* A clap: hands apart, then snapped together over a few frames. */
function clapAt(inst, x = 0.5, y = 0.5){
  hands(x, y, 0.3); run(inst, 0.1);
  for (const g of [0.2, 0.1, 0.03]){ hands(x, y, g); inst.step(DT, W, H); }
  hands(x, y, 0.3); run(inst, 0.05);
}

/* One child, as the mouse: the pointer at (x, y), moving at `speed`. */
function mouse(x, y, speed = 0){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => { p.present = i === 0; });
  const p = pose.players[0];
  p.hands.right = { x, y, vx: speed, vy: 0, speed }; p.hands.left = { ...p.hands.right };
}

/* A quiet castle: no waves coming unless a test starts one, and `n`
   children standing still. */
function quiet(n = 1){ if (n) still(n); else none(); const inst = game.create(Math.max(1, n)); inst.breakT = 1e9; inst.quiet = true; return inst; }
const knight = (inst, i = 0) => inst.knights[i];
const put = (k, x, y) => { k.x = k.tx = x; k.y = k.ty = y; };
/* Build without the first tower calling the first wave. */
function build(inst, i, kind){ inst._build(i, kind, 0); if (inst.quiet) inst.breakT = 1e9; }
/* A monster parked `s` along the trail, not moving. */
function monster(inst, kind, s){ inst._spawn(kind, 0); const m = inst.monsters[inst.monsters.length - 1]; m.s = s; m.speed = 0; m.side = 0; return m; }
/* How far along the trail is nearest to a spot. */
function nearestS(pt){
  let best = 0, bd = 9;
  for (let s = 0; s < PATHS[0].total; s += 0.005){ const p = along(s), d = Math.hypot((p.x - pt.x) * ASPECT, p.y - pt.y); if (d < bd){ bd = d; best = s; } }
  return best;
}
/* A monster parked right by the knight - the knight stood on the trail. */
function byKnight(inst, kind = 'slime', s = 1.5){
  const m = monster(inst, kind, s), p = along(s);
  put(knight(inst), p.x, p.y);
  return m;
}
/* The spot furthest from any pad, the castle, the horn or the trail. */
const OPEN_FIELD = (() => {
  let best = null, bd = 0;
  for (let x = 0.05; x < 0.95; x += 0.02) for (let y = 0.1; y < 0.95; y += 0.02){
    if (onCastle(x, y + 0.03)) continue;
    const t = along(nearestS({ x, y }));
    let d = Math.hypot((t.x - x) * ASPECT, t.y - y);
    for (const pad of PADS) d = Math.min(d, Math.hypot((pad.x - x) * ASPECT, pad.y - y));
    d = Math.min(d, Math.hypot((HORN.x - x) * ASPECT, HORN.y - y));
    if (d > bd){ bd = d; best = { x, y }; }
  }
  return best;
})();
const PATH = PATHS[0];

/* ---------- walking ---------- */

test('leaning walks the knight: right, left, toward the screen is up, back is down', () => {
  for (const [o, check] of [[{ lean: 1 }, (k, x, y) => k.x > x + 0.04], [{ lean: -1 }, (k, x, y) => k.x < x - 0.04],
                            [{ lz: -1 }, (k, x, y) => k.y < y - 0.08], [{ lz: 1 }, (k, x, y) => k.y > y + 0.08]]){
    const inst = quiet(), k = knight(inst);
    put(k, 0.5, 0.5);
    body(o); run(inst, 1.5);
    assert.ok(check(k, 0.5, 0.5), `${JSON.stringify(o)} -> ${k.x.toFixed(2)}, ${k.y.toFixed(2)}`);
  }
});

test('standing upright, or running on the spot upright, goes nowhere', () => {
  const a = quiet(), ka = knight(a); put(ka, 0.5, 0.5);
  run(a, 2);
  assert.ok(Math.abs(ka.x - 0.5) < 0.001 && Math.abs(ka.y - 0.5) < 0.001, 'standing');
  const b = quiet(), kb = knight(b); put(kb, 0.5, 0.5);
  run(b, 2, marching({}));
  assert.ok(Math.abs(kb.x - 0.5) < 0.001 && Math.abs(kb.y - 0.5) < 0.001, 'running on the spot');
});

test('running on the spot while leaning goes faster, up to a run', () => {
  const walk = quiet(), kw = knight(walk); put(kw, 0.3, 0.5);
  body({ lean: 1 }); run(walk, 1.5);
  const runs = quiet(), kr = knight(runs); put(kr, 0.3, 0.5);
  run(runs, 1.5, marching({ lean: 1 }, 0.04));
  const dw = (kw.x - 0.3) * ASPECT, dr = (kr.x - 0.3) * ASPECT;
  assert.ok(dw > WALK * 1.5 * 0.7, `walks: ${dw.toFixed(3)}`);
  assert.ok(dr > dw * 1.6, `${dw.toFixed(3)} walking vs ${dr.toFixed(3)} running`);
  assert.ok(dr <= RUN * 1.5 + 0.01, 'never faster than a run');
});

test('with the knees out of view, the ankles do the running', () => {
  const walk = quiet(), kw = knight(walk); put(kw, 0.3, 0.5);
  run(walk, 1.5, () => body({ lean: 1, knees: false }));
  const runs = quiet(), kr = knight(runs); put(kr, 0.3, 0.5);
  run(runs, 1.5, (t) => body({ lean: 1, knees: false, knee: Math.sin(t * Math.PI * 4) * 0.03 }));
  assert.ok(kr.x - 0.3 > (kw.x - 0.3) * 1.6);
});

test('every child has a knight of their own, waiting side by side', () => {
  const inst = quiet(2);
  assert.ok(inst.knights.length >= 4);
  const xs = inst.knights.slice(0, 4).map(k => k.x);
  assert.equal(new Set(xs).size, 4);
});

/* ---------- the sword, and the super ---------- */

test('near a monster the knight swings its sword by itself; one far off is left alone', () => {
  const inst = quiet();
  const m = monster(inst, 'ogre', 1.5), far = monster(inst, 'ogre', PATH.total - 0.3);
  put(knight(inst), along(1.5).x, along(1.5).y);
  run(inst, 0.2);
  assert.ok(m.hp < m.max, 'swung at');
  assert.ok(knight(inst).charge > 0, 'and the charge ring starts filling');
  assert.equal(far.hp, far.max);
});

test('the sword swings a moment apart, not every frame', () => {
  const inst = quiet();
  const m = byKnight(inst, 'slime'); m.hp = m.max = 1e9;
  run(inst, 2);
  const swings = Math.round((m.max - m.hp) / SWORD_DMG);
  assert.ok(swings >= Math.floor(2 / SWORD_COOL) && swings <= Math.ceil(2 / SWORD_COOL) + 1, `${swings} swings in two seconds`);
});

test('a knight out in the open field swings at nothing', () => {
  const inst = quiet();
  const m = monster(inst, 'slime', 1.5);
  put(knight(inst), OPEN_FIELD.x, OPEN_FIELD.y);
  run(inst, 2);
  assert.equal(m.hp, m.max);
  assert.equal(knight(inst).charge, 0);
});

test('a sword kills a slime, and its coins go in the chest', () => {
  const inst = quiet(), before = inst.coins;
  byKnight(inst, 'slime');
  run(inst, 6);
  assert.equal(inst.monsters.length, 0);
  assert.equal(inst.coins, before + MONSTERS.slime.coins);
});

test('a clap does nothing until the knight is charged; charged, it is a big shockwave', () => {
  const inst = quiet();
  const m = monster(inst, 'ogre', 1.5), p = along(1.5), k = knight(inst);
  /* The knight a little way off: outside sword reach, inside the shockwave. */
  put(k, p.x + (SUPER_R * 0.8) / ASPECT, p.y);
  clapAt(inst);
  assert.equal(m.hp, m.max, 'not charged: nothing');
  k.charge = 1;
  const s0 = m.s;
  clapAt(inst);
  assert.ok(m.hp < m.max - 3, 'a big hit');
  assert.ok(m.s < s0, 'knocked back');
  assert.equal(k.charge, 0, 'and the charge is spent');
  assert.ok(inst.seen.supered);
});

test('a slow bringing-together of the hands is not a clap', () => {
  const inst = quiet();
  const m = monster(inst, 'ogre', 1.5), p = along(1.5), k = knight(inst);
  put(k, p.x + (SUPER_R * 0.8) / ASPECT, p.y);
  k.charge = 1;
  hands(0.5, 0.5, 0.3); run(inst, 0.2);
  for (let g = 0.3; g > 0.02; g -= 0.004){ hands(0.5, 0.5, g); inst.step(DT, W, H); }
  assert.equal(m.hp, m.max);
  assert.equal(k.charge, 1);
});

test('sword hits fill the charge until it is full; then ghostly hands clap over the knight', () => {
  const inst = quiet();
  const m = byKnight(inst, 'slime'); m.hp = m.max = 1e9;
  run(inst, 3);
  assert.ok(knight(inst).charge < 1, 'not straight away');
  run(inst, 12 * SWORD_COOL);
  assert.equal(knight(inst).charge, 1);
  assert.ok(inst.clapHint);
  inst.clap(0);
  assert.equal(inst.clapHint, null, 'until the first super');
});

/* ---------- building ---------- */

test('standing on an empty pad builds the tower it shows', () => {
  const inst = quiet(), pad = PADS[2], kind = KINDS[inst.picks.get(2)];
  put(knight(inst), pad.x, pad.y);
  run(inst, BUILD * 0.6);
  assert.ok(!inst.towers.has(2), 'it takes a while');
  run(inst, BUILD * 0.5);
  assert.equal(inst.towers.get(2)?.kind, kind);
  assert.equal(inst.coins, START_COINS - COST[kind]);
  assert.ok(inst.seen.built);
});

test('neighbouring pads start out showing different kinds', () => {
  const inst = quiet();
  assert.deepEqual(new Set([0, 1, 2].map(i => KINDS[inst.picks.get(i)])), new Set(KINDS));
});

test('a jump on an empty pad changes which tower it will be, and starts the building over', () => {
  const inst = quiet(), pad = PADS[2];
  inst.picks.set(2, 0);
  put(knight(inst), pad.x, pad.y);
  run(inst, BUILD * 0.7);
  jump(inst);
  assert.equal(KINDS[inst.picks.get(2)], 'cannon');
  run(inst, BUILD * 0.5);
  assert.ok(!inst.towers.has(2), 'started over');
  jump(inst);
  assert.equal(KINDS[inst.picks.get(2)], 'frost');
  jump(inst);
  assert.equal(KINDS[inst.picks.get(2)], 'archer', 'and round again');
  jump(inst); jump(inst);
  assert.ok(inst.seen.jumped);
  run(inst, BUILD + 0.2);
  assert.equal(inst.towers.get(2)?.kind, 'frost');
});

test('a jump out in the field changes nothing', () => {
  const inst = quiet(), before = [...inst.picks];
  put(knight(inst), OPEN_FIELD.x, OPEN_FIELD.y);
  run(inst, 0.5); jump(inst); run(inst, 0.5);
  assert.deepEqual([...inst.picks], before);
});

test('a jump at a built tower changes nothing, and does not hold up the work', () => {
  const inst = quiet(); inst.coins = 100;
  build(inst, 2, 'archer');
  const pick = inst.picks.get(2);
  put(knight(inst), PADS[2].x, PADS[2].y);
  run(inst, upgradeTime(1) - 0.3); jump(inst);
  assert.equal(inst.picks.get(2), pick);
  run(inst, 0.3);
  assert.equal(inst.towers.get(2).lvl, 2);
});

test('a little wriggle is not a jump', () => {
  const inst = quiet(), pad = PADS[2], pick = inst.picks.get(2);
  put(knight(inst), pad.x, pad.y);
  for (let k = 0; k < 60; k++){ body({ cy: 0.6 + Math.sin(k / 3) * 0.006 }); inst.step(DT, W, H); }
  assert.equal(inst.picks.get(2), pick);
});

test('without the coins, a tower cannot be built', () => {
  const inst = quiet(), pad = PADS[2];
  inst.picks.set(2, KINDS.indexOf('cannon')); inst.coins = COST.cannon - 1;
  put(knight(inst), pad.x, pad.y);
  run(inst, BUILD * 3);
  assert.ok(!inst.towers.has(2));
  assert.equal(inst.coins, COST.cannon - 1);
});

test('walking off partway lets the work drain away', () => {
  const inst = quiet(), pad = PADS[2], k = knight(inst);
  put(k, pad.x, pad.y); run(inst, BUILD * 0.7);
  put(k, OPEN_FIELD.x, OPEN_FIELD.y); run(inst, BUILD);
  put(k, pad.x, pad.y); run(inst, BUILD * 0.5);
  assert.ok(!inst.towers.has(2));
});

test('a tower can be built in the middle of a wave', () => {
  const inst = quiet(), pad = PADS[2];
  inst._startWave(); inst.spawnT = 1e9;
  put(knight(inst), pad.x, pad.y); run(inst, BUILD + 0.2);
  assert.ok(inst.towers.has(2));
});

test('standing at a tower builds it up, slowly and for free, all the way to ten - not straight after building it', () => {
  const inst = quiet(); inst.coins = 100;
  const pad = PADS[2];
  inst.picks.set(2, 0);
  put(knight(inst), pad.x, pad.y);
  run(inst, BUILD + 0.05);
  assert.equal(inst.towers.get(2).lvl, 1);
  run(inst, upgradeTime(1) + 0.2);
  assert.equal(inst.towers.get(2).lvl, 1, 'it takes a while, after a moment to admire it');
  run(inst, 0.5);
  assert.equal(inst.towers.get(2).lvl, 2);
  assert.equal(inst.coins, 100 - COST.archer, 'free');
  run(inst, upgradeTime(2) + 0.7);
  assert.equal(inst.towers.get(2).lvl, 3);
  assert.ok(upgradeTime(9) > upgradeTime(2) * 2, 'and slower every level');
  let all = 0; for (let l = 3; l < MAX_LVL; l++) all += upgradeTime(l) + 0.7;
  run(inst, all + 5);
  assert.equal(inst.towers.get(2).lvl, MAX_LVL);
  assert.equal(MAX_LVL, 10);
  run(inst, upgradeTime(9) * 2);
  assert.equal(inst.towers.get(2).lvl, MAX_LVL, 'ten is the top');
  assert.equal(inst.coins, 100 - COST.archer);
  assert.equal(inst.towers.get(2).max, TOWER_HP[MAX_LVL - 1], 'and sturdier');
});

test('a tower at the top is many times a new one, against a crowd too', () => {
  const kills = (kind, lvl) => { const S = STATS[kind], L = lvl - 1; return S.rate[L] * (S.many ? S.many[L] : S.most[L]); };
  for (const kind of KINDS) assert.ok(kills(kind, MAX_LVL) > kills(kind, 1) * 5, kind);
  for (const kind of KINDS) for (let l = 1; l < MAX_LVL; l++) assert.ok(STATS[kind].range[l] > STATS[kind].range[l - 1] && STATS[kind].dmg[l] > STATS[kind].dmg[l - 1]);
});

test('a high archer tower shoots several monsters at once', () => {
  const inst = quiet(0); build(inst, 6, 'archer');
  inst.towers.get(6).lvl = MAX_LVL;
  const near = [];
  for (let s = 0; s < PATH.total; s += 0.05){ const p = along(s); if (Math.hypot((p.x - PADS[6].x) * ASPECT, p.y - PADS[6].y) < 0.2) near.push(s); }
  const ms = near.slice(0, 4).map(s => { const m = monster(inst, 'ogre', s); m.hp = m.max = 1e9; return m; });
  run(inst, 1);
  assert.equal(ms.filter(m => m.hp < m.max).length, 4);
});

test('two knights on one spot work twice as fast', () => {
  const inst = quiet(2), pad = PADS[2];
  put(knight(inst, 0), pad.x, pad.y); put(knight(inst, 1), pad.x + 0.01, pad.y);
  run(inst, BUILD * 0.55);
  assert.ok(inst.towers.has(2));
});

test('hammering makes the work go twice as fast', () => {
  const inst = quiet(), pad = PADS[2];
  put(knight(inst), pad.x, pad.y);
  run(inst, BUILD / HAMMER + 0.3, hammering());
  assert.ok(inst.towers.has(2));
  assert.ok(inst.seen.hammered);
  const slow = quiet();
  put(knight(slow), pad.x, pad.y);
  run(slow, BUILD / HAMMER + 0.3);
  assert.ok(!slow.towers.has(2), 'just standing there takes longer');
});

/* ---------- ogres, and mending ---------- */

test('ogres smash at the towers they pass; little monsters do not', () => {
  for (const pad of PADS){
    const p = along(nearestS(pad));
    assert.ok(Math.hypot((p.x - pad.x) * ASPECT, p.y - pad.y) < SMASH_R, `pad ${pad.i} is near enough the trail to be smashed`);
  }
  const inst = quiet(0); build(inst, 2, 'archer');
  const tw = inst.towers.get(2);
  const slime = monster(inst, 'slime', nearestS(PADS[2])); slime.hp = 1e9;
  run(inst, 1);
  assert.equal(tw.hp, tw.max, 'a slime does no harm');
  inst.monsters = [];
  monster(inst, 'ogre', nearestS(PADS[2])).hp = 1e9;
  run(inst, 1);
  assert.ok(tw.hp < tw.max, 'an ogre does');
});

test('a smashed tower crumbles back to an empty pad', () => {
  const inst = quiet(0); build(inst, 2, 'cannon');
  monster(inst, 'ogre', nearestS(PADS[2])).hp = 1e9;
  run(inst, TOWER_HP[0] / 1.5 + 0.5);
  assert.ok(!inst.towers.has(2));
});

test('standing at a hurt tower mends it, for free, before building it up', () => {
  const inst = quiet(); inst.coins = 100;
  build(inst, 2, 'archer');
  const tw = inst.towers.get(2); tw.hp = 1;
  put(knight(inst), PADS[2].x, PADS[2].y);
  run(inst, 1);
  assert.ok(tw.hp > 1, 'mending');
  assert.equal(tw.lvl, 1, 'not building up yet');
  assert.equal(inst.coins, 100 - COST.archer, 'mending is free');
  run(inst, 3);
  assert.equal(tw.hp, tw.max);
});

/* Somewhere to stand on the castle, as big as it is now. */
const atCastle = (inst) => ({ x: castleBox(inst.castleLvl).x, y: CASTLE_BASE - 0.12 });

test('the castle starts small, with only a few hearts', () => {
  const inst = quiet();
  assert.equal(inst.castleLvl, 1);
  assert.ok(HEARTS <= 5 && inst.hearts === HEARTS);
  assert.ok(castleBox(1).w < CASTLE.w * 0.6);
  const { x, y } = atCastle(inst);
  assert.ok(onCastle(x, y + 0.03, 1));
  assert.ok(!onCastle(CASTLE.x - CASTLE.w * 0.4, y + 0.03, 1), 'the far end is grass, for now');
  assert.ok(onCastle(CASTLE.x - CASTLE.w * 0.4, y + 0.03, MAX_LVL));
});

test('standing at the castle mends its hearts, one at a time', () => {
  const inst = quiet(); inst.hearts = HEARTS - 2;
  const { x, y } = atCastle(inst);
  put(knight(inst), x, y);
  run(inst, REPAIR + 0.1);
  assert.equal(inst.hearts, HEARTS - 1);
  run(inst, REPAIR);
  assert.equal(inst.hearts, HEARTS);
  assert.ok(inst.seen.repaired);
  run(inst, REPAIR * 2);
  assert.equal(inst.hearts, HEARTS, 'and no further');
});

test('a whole castle is slowly built up, for free, a little bigger with more hearts, ten times', () => {
  const inst = quiet(); inst.coins = 0;
  const k = knight(inst);
  const stand = () => { const p = atCastle(inst); put(k, p.x, p.y); };
  stand();
  run(inst, castleTime(1) * 0.8);
  assert.equal(inst.castleLvl, 1, 'it takes a while');
  run(inst, castleTime(1) * 0.2 + 0.1);
  assert.equal(inst.castleLvl, 2);
  assert.equal(inst.maxHearts, CASTLE_HEARTS[1]);
  assert.equal(inst.hearts, CASTLE_HEARTS[1], 'all full');
  assert.ok(castleBox(2).w > castleBox(1).w, 'a little bigger');
  for (let l = 2; l < MAX_LVL; l++){ stand(); run(inst, castleTime(l) + 0.7); }
  assert.equal(inst.castleLvl, MAX_LVL);
  stand(); run(inst, castleTime(9) * 2);
  assert.equal(inst.castleLvl, MAX_LVL, 'ten is the top');
  assert.ok(castleBox(MAX_LVL).w > castleBox(1).w * 1.6 && Math.abs(castleBox(MAX_LVL).w - CASTLE.w) < 1e-9, 'the full castle at the top');
  for (let l = 1; l < MAX_LVL; l++) assert.equal(CASTLE_HEARTS[l], CASTLE_HEARTS[l - 1] + 2, 'two more hearts each time');
});

test('a hurt castle is mended before it is built up', () => {
  const inst = quiet(); inst.hearts = HEARTS - 1;
  const { x, y } = atCastle(inst);
  put(knight(inst), x, y);
  run(inst, castleTime(1) + 0.1);
  assert.equal(inst.hearts, HEARTS);
  assert.equal(inst.castleLvl, 1);
});

test('little monsters never hurt a knight', () => {
  const inst = quiet();
  for (const kind of ['slime', 'goblin', 'bat']){ const m = monster(inst, kind, 1.5); m.hp = m.max = 1e9; }
  put(knight(inst), along(1.5).x, along(1.5).y);
  run(inst, 10);
  assert.equal(knight(inst).hp, KNIGHT_HP);
  assert.equal(knight(inst).down, 0);
});

test('an ogre winds up, then bonks a knight still close by with its club, a moment apart', () => {
  const inst = quiet();
  const m = monster(inst, 'ogre', 1.5); m.hp = m.max = 1e9;
  const k = knight(inst);
  put(k, along(1.5).x, along(1.5).y);
  run(inst, 0.2);
  assert.ok(m.wind > 0, 'club up');
  assert.equal(k.hp, KNIGHT_HP, 'not yet');
  run(inst, WINDUP);
  assert.equal(k.hp, KNIGHT_HP - 1, 'down it comes');
  run(inst, OGRE_CLUB * 0.8);
  assert.equal(k.hp, KNIGHT_HP - 1, 'not every frame');
  run(inst, OGRE_CLUB * 0.3 + WINDUP);
  assert.equal(k.hp, KNIGHT_HP - 2);
  put(k, OPEN_FIELD.x, OPEN_FIELD.y);
  run(inst, KNIGHT_MEND * 2 + 0.5);
  assert.equal(k.hp, KNIGHT_HP, 'away from it, it gets its breath back');
});

test('stepping out of the ring while the club is up gets away', () => {
  const inst = quiet();
  const m = monster(inst, 'ogre', 1.5); m.hp = m.max = 1e9;
  const k = knight(inst), p = along(1.5);
  put(k, p.x, p.y);
  run(inst, 0.2);
  assert.ok(m.wind > 0);
  put(k, p.x, p.y - SLAM_R * 1.5);
  run(inst, WINDUP + 0.2);
  assert.equal(k.hp, KNIGHT_HP, 'missed');
  assert.ok(m.club > 0, 'and it has to wait to try again');
  assert.ok(WINDUP >= 1, 'time enough to walk out');
  assert.ok(WALK * WINDUP > SLAM_R, 'even just leaning');
});

test('a knight bonked out loses every level and comes back at the castle, safe for a moment', () => {
  const inst = quiet();
  const k = knight(inst);
  k.lvl = 7; k.xp = 4; k.charge = 0.7;
  const m = monster(inst, 'ogre', 1.5); m.hp = m.max = 1e9;
  put(k, along(1.5).x, along(1.5).y);
  run(inst, (OGRE_CLUB + WINDUP) * (KNIGHT_HP - 1) + WINDUP + 0.3);
  assert.ok(k.down > 0, 'down');
  assert.equal(k.lvl, 0); assert.equal(k.xp, 0); assert.equal(k.charge, 0);
  body({ lean: 1 }); run(inst, 1);
  assert.ok(Math.abs(k.fell.x - k.x) < 1e-9, 'it goes nowhere while it sees stars');
  still(); run(inst, DOWN - 1 + 0.05);
  assert.equal(k.down, 0);
  assert.ok(Math.hypot(k.x - inst.home(0).x, k.y - inst.home(0).y) < 0.05, 'back by the castle');
  assert.equal(k.hp, KNIGHT_HP);
  assert.ok(k.safe > 0);
  still();
  put(k, along(1.5).x, along(1.5).y);
  run(inst, 1);
  assert.equal(k.hp, KNIGHT_HP, 'safe while it blinks');
});

test('knights level up from what they beat, a little more each level, up to ten', () => {
  const inst = quiet(), k = knight(inst);
  assert.equal(k.lvl, 0);
  assert.equal(KNIGHT_MAX, 10);
  for (let q = 0; q < killsFor(0) - 1; q++){ const m = monster(inst, 'slime', 1); inst._damage(m, 99, 0); }
  assert.equal(k.lvl, 0, 'not quite');
  inst._damage(monster(inst, 'slime', 1), 99, 0);
  assert.equal(k.lvl, 1);
  inst._damage(monster(inst, 'ogre', 1), 99, 0);
  assert.equal(k.xp, MONSTERS.ogre.coins, 'an ogre counts for five');
  inst._damage(monster(inst, 'slime', 1), 99);
  assert.equal(k.xp, MONSTERS.ogre.coins, 'a tower kill is nobody\'s');
  assert.ok(killsFor(10) > killsFor(1));
  for (let q = 0; q < 2000; q++) inst._damage(monster(inst, 'slime', 1), 99, 0);
  assert.equal(k.lvl, KNIGHT_MAX, 'ten is the top');
});

test('a higher knight has a bigger, harder, quicker sword - and kills faster', () => {
  const a = swordAt(0), b = swordAt(KNIGHT_MAX);
  assert.ok(b.size > a.size * 2 && b.reach > a.reach && b.dmg > a.dmg * 3 && b.cool < a.cool);
  for (let l = 1; l <= KNIGHT_MAX; l++) assert.ok(swordAt(l).size > swordAt(l - 1).size, 'a little bigger every level');
  const time = (lvl) => {
    const inst = quiet();
    knight(inst).lvl = lvl;
    const m = byKnight(inst, 'slime'); m.hp = m.max = 20;
    let t = 0; while (m.hp > 0 && t < 30){ inst.step(DT, W, H); t += DT; }
    return t;
  };
  assert.ok(time(KNIGHT_MAX) < time(0) / 4);
});

/* ---------- the waves, and the horn ---------- */

test('a knight by the war horn calls the wave in early', () => {
  still();
  const inst = game.create(1);
  put(knight(inst), HORN.x, HORN.y);
  run(inst, HORN_HOLD * 0.5);
  assert.equal(inst.wave, 0, 'not straight away');
  run(inst, HORN_HOLD * 0.6);
  assert.equal(inst.wave, 1);
  assert.ok(inst.t < FIRST_BUILD);
  assert.ok(inst.seen.called);
});

test('in a wave the horn is gone: standing there does nothing', () => {
  const inst = quiet();
  inst._startWave(); inst.spawnT = 1e9;
  put(knight(inst), HORN.x, HORN.y);
  run(inst, HORN_HOLD * 2);
  assert.equal(knight(inst).at, null);
});

test('the next wave waits until this one is cleared, then a break', () => {
  const inst = quiet(0);
  inst._startWave();
  run(inst, 40, () => { inst.monsters.forEach(m => { m.speed = 0; }); });
  assert.equal(inst.wave, 1, 'still on the first while its monsters are about');
  assert.equal(inst.state, 'wave');
  for (const m of [...inst.monsters]) inst._damage(m, 999);
  run(inst, 0.1);
  assert.equal(inst.held, 1);
  assert.equal(inst.state, 'build');
  run(inst, BUILD_TIME + 0.2);
  assert.equal(inst.wave, 2);
});

test('the first wave comes when the first break is up', () => {
  none();
  const inst = game.create(1);
  run(inst, FIRST_BUILD - 1); assert.equal(inst.wave, 0);
  run(inst, 2); assert.equal(inst.wave, 1);
});

/* ---------- the mouse ---------- */

test('with the mouse, a resting pointer sends the knight, and it fights and builds by itself', () => {
  const inst = quiet(), k = knight(inst);
  mouse(0.6, 0.45, 2); run(inst, POINT_HOLD);
  assert.notEqual(k.tx, 0.6, 'a moving pointer sends nobody');
  mouse(0.6, 0.45); run(inst, POINT_HOLD + 0.05);
  assert.ok(Math.abs(k.tx - 0.6) < 0.01);
  const m = monster(inst, 'ogre', 1.5), p = along(1.5);
  m.hp = m.max = 1e9;
  mouse(p.x, p.y); run(inst, 6);
  assert.ok(m.hp < m.max, 'sword');
  k.charge = 1; run(inst, 0.1);
  assert.ok(k.charge < 1, 'the super goes by itself');
  inst.monsters = [];
  mouse(PADS[2].x, PADS[2].y); run(inst, 6 + BUILD);
  assert.ok(inst.towers.has(2), 'built');
});

/* ---------- towers ---------- */

test('a tower shoots a monster in range until it is gone, and its coins go in the chest', () => {
  const inst = quiet(0);
  build(inst, 2, 'archer');
  const before = inst.coins;
  monster(inst, 'slime', nearestS(PADS[2]));
  run(inst, 6);
  assert.equal(inst.monsters.length, 0);
  assert.equal(inst.coins, before + MONSTERS.slime.coins);
});

test('a tower ignores a monster out of range', () => {
  const inst = quiet(0);
  build(inst, 2, 'archer');
  const m = monster(inst, 'slime', PATH.total * 0.97);
  run(inst, 3);
  assert.equal(m.hp, m.max);
});

test('cannons cannot hit bats; archers can', () => {
  const a = quiet(0); build(a, 2, 'cannon');
  const bat = monster(a, 'bat', nearestS(PADS[2]));
  let fired = false;
  run(a, 4, () => { if (a.shots.length) fired = true; });
  assert.equal(fired, false, "the cannon doesn't waste a shot on it");
  assert.equal(bat.hp, bat.max);
  const b = quiet(0); build(b, 2, 'archer');
  monster(b, 'bat', nearestS(PADS[2]));
  run(b, 6);
  assert.equal(b.monsters.length, 0);
});

test('a frost tower slows monsters down', () => {
  const inst = quiet(0); build(inst, 2, 'frost');
  const m = monster(inst, 'ogre', nearestS(PADS[2]));
  run(inst, 1.5);
  assert.ok(m.slowK < 1 && m.slowT > 0);
});

test('a tower fires at whichever monster in reach is nearest the castle', () => {
  const inst = quiet(0); inst.coins = 99;
  build(inst, 6, 'archer'); inst._upgrade(6, 0); inst._upgrade(6, 0);
  assert.equal(STATS.archer.many[2], 1, 'one at a time, still');
  const near = [];
  for (let s = 0; s < PATH.total; s += 0.02){ const p = along(s); if (Math.hypot((p.x - PADS[6].x) * ASPECT, p.y - PADS[6].y) < 0.2) near.push(s); }
  const behind = monster(inst, 'slime', near[0]), ahead = monster(inst, 'slime', near[near.length - 1]);
  behind.hp = behind.max = ahead.hp = ahead.max = 100;
  run(inst, 0.8);
  assert.ok(ahead.hp < ahead.max, 'the one further along');
  assert.equal(behind.hp, behind.max);
});

test('a tower between two turns of the trail reaches it on both sides', () => {
  const pad = PADS[6], ys = [];
  for (let s = 0; s < PATH.total; s += 0.02){ const p = along(s); if (Math.hypot((p.x - pad.x) * ASPECT, p.y - pad.y) < 0.24) ys.push(p.y); }
  assert.ok(ys.some(y => y < pad.y - 0.06), 'the row above');
  assert.ok(ys.some(y => y > pad.y + 0.06), 'and the row below');
});

/* ---------- the castle and the waves ---------- */

test('a monster reaching the castle takes hearts; an ogre takes more; no hearts is the end', () => {
  const inst = quiet(0);
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
  for (let w = 2; w < 30; w++) assert.ok(countOf(w) > countOf(w - 1) || countOf(w) === 1500, 'more every wave, till far past where anyone gets');
});

test('later waves bring more and more ogres, spread through the wave', () => {
  const ogres = (w) => waveOf(w).filter(m => m.kind === 'ogre').length;
  assert.equal(ogres(4), 0);
  assert.equal(ogres(5), 1);
  assert.ok(ogres(30) > ogres(20) && ogres(20) > ogres(15) && ogres(29) > 0);
  const where = waveOf(30).map((m, k) => m.kind === 'ogre' ? k : -1).filter(k => k >= 0), n = waveOf(30).length;
  assert.ok(where[0] < n / 4 && where[where.length - 1] > n * 3 / 4, 'from the start of the wave to its end');
});

test('waves creep up slowly, then pour out ever faster', () => {
  assert.equal(countOf(1), 7);
  for (let w = 2; w <= 5; w++) assert.ok(countOf(w) - countOf(w - 1) <= 3, `a few more each time at first: ${countOf(w)}`);
  assert.ok(countOf(30) > countOf(10) * 10);
  assert.ok(gapOf(30) < gapOf(10) / 10, 'a big wave comes out several at a time');
  const inst = quiet(0);
  inst.wave = 29; inst._startWave();
  inst.step(0.1, W, H);
  assert.ok(inst.monsters.length > 1, `${inst.monsters.length} out in a tenth of a second`);
});

test('monsters never get faster or tougher, wave after wave', () => {
  const inst = quiet(0);
  inst.wave = 1; inst._spawn('slime'); const first = inst.monsters.pop();
  inst.wave = 20; inst._spawn('slime'); const later = inst.monsters.pop();
  assert.equal(later.speed, first.speed);
  assert.equal(later.max, first.max);
});

test('one trail, in at the top left and the long way round to the castle', () => {
  assert.equal(PATHS.length, 1);
  const start = PATH.pts[0], end = PATH.pts[PATH.pts.length - 1];
  assert.ok(start[1] < 0 && start[0] < 0.2, 'from over the top edge, at the left');
  assert.ok(onCastle(end[0], end[1] + 0.02), 'to the castle');
  assert.ok(PATH.total > 4, `the long way round: ${PATH.total.toFixed(2)} screen heights`);
  assert.ok(Math.max(...PATH.pts.map(p => p[0])) > 0.85, 'all the way over to the right');
  assert.ok(CASTLE.x < 0.25 && CASTLE.w >= 0.3 && CASTLE_BASE > 0.95, 'the castle wide along the bottom left');
});

test('a well-defended castle holds many waves; an empty one falls fast', () => {
  none();
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

/* ---------- drawing, and the ending ---------- */

test('drawing works at every stage, with hints, ghosts and work rings', () => {
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (t[k] = () => ({ addColorStop(){} })), set: (t, k, v) => { t[k] = v; return true; } });
  const inst = quiet(2);
  inst.hearts = 5;
  put(knight(inst, 0), PADS[2].x, PADS[2].y); put(knight(inst, 1), atCastle(inst).x, atCastle(inst).y);
  run(inst, 1, hammering({ n: 2 }));
  inst.draw(ctx, W, H);
  build(inst, 4, 'cannon'); inst.towers.get(4).hp = 2;
  monster(inst, 'ogre', 1.5); knight(inst).charge = 1;
  inst._startWave(); run(inst, 0.5);
  inst.draw(ctx, W, H);
  inst.over = true; inst.lost = true;
  inst.outro(DT, W, H); inst.draw(ctx, W, H);
});

test('no clock and no score on screen; the round ends with an ending', () => {
  const inst = quiet();
  const h = inst.hud();
  assert.equal(h.hideClock, true);
  assert.equal(h.hideScore, true);
  assert.equal(game.endless, true);
  inst.lost = true; inst.over = true;
  let done = false, s = 0;
  for (; s < 8 && !done; s += DT) done = inst.outro(DT, W, H);
  assert.ok(done && s > 3);
});
