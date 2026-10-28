import test from 'node:test';
import assert from 'node:assert/strict';
import game, { COST, KINDS, BUILD, REPAIR, MAX_LVL, CASTLE_HEARTS, TOWER_HP, STATS, SMASH_R, SQUAT_FAST, HUG_SETTLE, HUG_MEND, POINT_HOLD, LEAN_X, LEAN_Z, upgradeTime, castleTime,
               WALK, RUN, CALIB, SWORD_COOL, SWORD_DMG, ROLL_FAST, KNIGHT_MAX, KNIGHT_HP, TENT_R, OGRE_CLUB, WINDUP, SLAM_R, ALL_DOWN, REVIVE_R, killsFor, swordAt, HEARTS, START_COINS, BUILD_TIME, FIRST_BUILD, MONSTERS, waveOf, countOf, gapOf, CROWD, CAP, RED, redShare,
               TROLL_EVERY, FROST_FIRST, FROST_EVERY, FROST_WARN, ICE_BREAK } from '../src/games/castle-defense.js';
import { PADS, PATHS, CASTLE, CASTLE_BASE, along, onCastle, castleBox, TENT } from '../src/games/castle-art.js';
import { pose, L } from '../src/tracking/pose.js';
import { standIn } from '../src/games/moon-art.js';

const W = 1920, H = 1080, DT = 1 / 60, ASPECT = 16 / 9;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };

/* Children standing in the room, as the camera sees them: leaning sideways
   (lean, -1..1 of a full lean, + is right) and toward the screen (lz, - is
   toward), knees up and down by `knee` (screen heights), hands moving up or
   down at `hvy`, the middle of the body at `cy`, the body above the knees
   dropped by `drop` (a squat), arms crossed in a `hug`. The first `n` are
   there, all standing still but the first. */
function body({ lean = 0, lz = 0, knee = 0, knees = true, hvy = 0, cy = 0.6, drop = 0, hug = false, dx = 0, n = 1 } = {}){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => { p.present = i < n; });
  for (let i = 0; i < n; i++){
    const lm = standIn(0.5).map(q => ({ ...q, z: 0, v: 0.9 })), p = pose.players[i];
    if (i === 0){
      const sw = Math.abs(lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x);
      for (const j of [L.L_SHOULDER, L.R_SHOULDER]){ lm[j].x += lean * sw * LEAN_X * 1.2; lm[j].z = lz * sw * LEAN_Z * 1.2; }
      lm[L.L_KNEE].y -= knee; lm[L.R_KNEE].y += knee; lm[L.L_ANKLE].y -= knee; lm[L.R_ANKLE].y += knee;
      if (!knees){ lm[L.L_KNEE].v = lm[L.R_KNEE].v = 0.1; }
      if (dx) lm.forEach(q => { q.x += dx; });
      if (drop) lm.forEach((q, j) => { if (![L.L_KNEE, L.R_KNEE, L.L_ANKLE, L.R_ANKLE].includes(j)) q.y += drop; });
      if (hug){ lm[L.L_WRIST] = { ...lm[L.R_SHOULDER], y: lm[L.R_SHOULDER].y + 0.01 }; lm[L.R_WRIST] = { ...lm[L.L_SHOULDER], y: lm[L.L_SHOULDER].y + 0.01 }; }
    }
    p.lm = lm; p.scale = 0.3;
    p.centre = { x: 0.5, y: i === 0 ? cy + drop : 0.6 };
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
/* Squats, up and down once a second, `depth` screen heights down. */
const squats = (o = {}, depth = 0.06) => (t) => body({ ...o, drop: Math.sin(t * Math.PI * 2) > 0 ? depth : 0 });
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
/* Rolling the arms, the wheels on the bus: the hands going round each
   other `rev` times a second, `r` screen heights from the middle. */
const rolling = (o = {}, rev = 1.5, r = 0.06) => (t) => {
  body(o);
  const p = pose.players[0], w = rev * 2 * Math.PI, a = t * w, cx = 0.5, cy = 0.55;
  const dx = Math.cos(a) * r / ASPECT, dy = Math.sin(a) * r, vx = -Math.sin(a) * r * w / ASPECT, vy = Math.cos(a) * r * w;
  p.hands.left = { x: cx - dx, y: cy - dy, vx: -vx, vy: -vy, speed: Math.hypot(vx, vy) };
  p.hands.right = { x: cx + dx, y: cy + dy, vx, vy, speed: Math.hypot(vx, vy) };
};

/* One child, as the mouse: the pointer at (x, y), moving at `speed`. */
function mouse(x, y, speed = 0){
  pose.mouse.active = true;
  pose.players.forEach((p, i) => { p.present = i === 0; });
  const p = pose.players[0];
  p.hands.right = { x, y, vx: speed, vy: 0, speed }; p.hands.left = { ...p.hands.right };
}

/* A quiet castle: no waves coming unless a test starts one, and `n`
   children standing still. */
function quiet(n = 1){
  if (n) still(n); else none();
  const inst = game.create(Math.max(1, n)); inst.breakT = 1e9; inst.quiet = true;
  /* The knights learn how the children stand before anything else. */
  if (n) for (let f = 0; f < Math.round((CALIB + 0.05) / DT); f++) inst.step(DT, W, H);
  return inst;
}
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
/* The spot furthest from any pad, the castle, the tent or the trail. */
const OPEN_FIELD = (() => {
  let best = null, bd = 0;
  for (let x = 0.05; x < 0.95; x += 0.02) for (let y = 0.1; y < 0.95; y += 0.02){
    if (onCastle(x, y + 0.03)) continue;
    const t = along(nearestS({ x, y }));
    let d = Math.hypot((t.x - x) * ASPECT, t.y - y);
    for (const pad of PADS) d = Math.min(d, Math.hypot((pad.x - x) * ASPECT, pad.y - y));
    d = Math.min(d, Math.hypot((TENT.x - x) * ASPECT, TENT.y - y));
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

test('the knight learns how each child stands: a crooked stance, or shoulders the camera sees nearer, is no lean', () => {
  for (const o of [{ lz: -0.9 }, { lean: 0.6 }, { lz: 0.7, lean: -0.5 }]){
    body(o);
    const inst = game.create(1); inst.breakT = 1e9;
    const k = knight(inst); put(k, 0.5, 0.5);
    run(inst, CALIB + 4, () => body(o));
    assert.ok(Math.hypot(k.x - 0.5, k.y - 0.5) < 0.01, `${JSON.stringify(o)}: stays put (${k.x.toFixed(2)}, ${k.y.toFixed(2)})`);
    run(inst, 1.5, () => body({ lean: o.lean ? o.lean + 1 : 1, lz: o.lz || 0 }));
    assert.ok(k.x > 0.53, 'and a real lean, from there, still walks');
  }
});

test('while a child is new in, the knight waits a moment', () => {
  body({ lean: 1 });
  const inst = game.create(1); inst.breakT = 1e9;
  const k = knight(inst); put(k, 0.5, 0.5);
  run(inst, CALIB * 0.8, () => body({ lean: 1 }));
  assert.ok(Math.abs(k.x - 0.5) < 1e-9);
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

/* ---------- the sword ---------- */

test('near a monster the knight swings its sword by itself; one far off is left alone', () => {
  const inst = quiet();
  const m = monster(inst, 'ogre', 1.5), far = monster(inst, 'ogre', PATH.total - 0.3);
  put(knight(inst), along(1.5).x, along(1.5).y);
  run(inst, 0.2);
  assert.ok(m.hp < m.max, 'swung at');
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
});

test('a sword kills a slime, and its coins go in the chest', () => {
  const inst = quiet(), before = inst.coins;
  byKnight(inst, 'slime');
  run(inst, 6);
  assert.equal(inst.monsters.length, 0);
  assert.equal(inst.coins, before + MONSTERS.slime.coins);
});

test('rolling the arms makes the sword swing twice as fast', () => {
  const swings = (each) => {
    const inst = quiet();
    const m = byKnight(inst, 'slime'); m.hp = m.max = 1e9;
    run(inst, 4, each);
    return Math.round((m.max - m.hp) / SWORD_DMG);
  };
  const plain = swings(() => still()), rolled = swings(rolling());
  assert.equal(ROLL_FAST, 2);
  assert.ok(rolled >= plain * 1.7, `${plain} swings standing, ${rolled} rolling`);
});

test('rolling either way round counts; slow circles, hands far apart or still hands do not', () => {
  const spun = (each) => { const inst = quiet(); run(inst, 2, each); return inst.rolling(knight(inst)); };
  assert.equal(spun(rolling()), true, 'forwards');
  assert.equal(spun(rolling({}, -1.5)), true, 'backwards');
  assert.equal(spun(rolling({}, 0.25)), false, 'slowly');
  assert.equal(spun(rolling({}, 1.5, 0.3)), false, 'arms flung wide');
  assert.equal(spun(() => still()), false, 'still');
});

test('hands bobbing up and down are not a roll', () => {
  const inst = quiet();
  run(inst, 2, (t) => { still(); const p = pose.players[0], u = Math.sin(t * Math.PI * 8) * 0.05; p.hands.left.y = 0.6 + u; p.hands.right.y = 0.6 - u; });
  assert.equal(inst.rolling(knight(inst)), false);
});

test('there is no clap any more: clapping does nothing', () => {
  const inst = quiet();
  const m = monster(inst, 'slime', 1.5), p = along(1.5);
  put(knight(inst), p.x + 0.2 / ASPECT, p.y);
  hands(0.5, 0.5, 0.3); run(inst, 0.1);
  for (const g of [0.2, 0.1, 0.03]){ hands(0.5, 0.5, g); inst.step(DT, W, H); }
  run(inst, 0.3);
  assert.equal(m.hp, m.max);
  assert.equal(inst.clap, undefined);
});

test('ghostly hands roll over a knight in a fight, until someone rolls', () => {
  const inst = quiet();
  const m = byKnight(inst, 'slime'); m.hp = m.max = 1e9;
  assert.equal(inst.rollHint, null, 'not before a fight');
  run(inst, 0.3);
  assert.equal(inst.rollHint, knight(inst));
  run(inst, 2, rolling());
  assert.ok(inst.seen.rolled);
  assert.equal(inst.rollHint, null);
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

test('squatting makes the work go twice as fast - bobbing squats, no need to hold one', () => {
  const inst = quiet(), pad = PADS[2];
  put(knight(inst), pad.x, pad.y);
  run(inst, 0.5);
  run(inst, BUILD / SQUAT_FAST + 0.3, squats());
  assert.ok(inst.towers.has(2));
  assert.ok(inst.seen.squatted);
  const slow = quiet();
  put(knight(slow), pad.x, pad.y);
  run(slow, 0.5 + BUILD / SQUAT_FAST + 0.3);
  assert.ok(!slow.towers.has(2), 'just standing there takes longer');
});

test('a little dip, running on the spot or leaning is not a squat', () => {
  for (const each of [squats({}, 0.01), marching(), () => body({ lean: 1 }), () => body({ lz: -1 })]){
    const inst = quiet();
    run(inst, 2, each);
    assert.equal(inst.squatting(knight(inst)), false);
  }
});

test('standing up out of a squat on an empty pad is not a jump', () => {
  const inst = quiet(), pad = PADS[2], pick = inst.picks.get(2);
  put(knight(inst), pad.x, pad.y);
  run(inst, 0.5);
  body({ drop: 0.07 }); run(inst, 2);
  for (let k = 0; k < 4; k++){ body({ drop: 0.07 * (1 - (k + 1) / 4) }); inst.step(DT, W, H); }
  run(inst, 1);
  assert.equal(inst.picks.get(2), pick);
});

/* Stand knight i at the medical tent. */
const atTent = (inst, i = 0) => put(knight(inst, i), TENT.x, TENT.y + 0.02);

test('at the medical tent, a hug heals a hurt knight, a bonk at a time; arms down does not', () => {
  const inst = quiet(), k = knight(inst);
  k.hp = 1; atTent(inst);
  run(inst, 3);
  assert.equal(k.hp, 1, 'just standing there: no');
  body({ hug: true }); run(inst, HUG_SETTLE + HUG_MEND + 0.1);
  assert.equal(k.hp, 2);
  assert.ok(inst.seen.hugged);
  run(inst, HUG_MEND);
  assert.equal(k.hp, KNIGHT_HP);
  run(inst, HUG_MEND * 2);
  assert.equal(k.hp, KNIGHT_HP, 'and no more');
});

test('a hug anywhere but the medical tent heals nothing, and nothing heals on its own', () => {
  const inst = quiet(), k = knight(inst);
  k.hp = 1; put(k, OPEN_FIELD.x, OPEN_FIELD.y);
  run(inst, 20);
  assert.equal(k.hp, 1, 'not on its own');
  body({ hug: true }); run(inst, 5);
  assert.equal(k.hp, 1, 'not away from the tent');
  put(k, TENT.x + TENT_R * 1.5 / (16 / 9), TENT.y + 0.02); run(inst, 5);
  assert.equal(k.hp, 1, 'not just beside it');
  atTent(inst); run(inst, HUG_SETTLE + HUG_MEND + 0.1);
  assert.equal(k.hp, 2, 'there');
});

test('with the mouse, standing at the tent is enough', () => {
  const inst = quiet(), k = knight(inst);
  k.hp = 1;
  mouse(TENT.x, TENT.y + 0.02); run(inst, 8);
  assert.equal(k.hp, KNIGHT_HP);
});

test('one hand on a shoulder is not a hug', () => {
  const inst = quiet(), k = knight(inst);
  k.hp = 1; atTent(inst);
  run(inst, 3, () => { body(); const lm = pose.players[0].lm; lm[L.L_WRIST] = { ...lm[L.R_SHOULDER] }; });
  assert.equal(inst.hugging(k), false);
  assert.equal(k.hp, 1);
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

test('a crowd of knights mends the castle no faster than one', () => {
  const inst = quiet(2); inst.hearts = HEARTS - 3;
  const { x, y } = atCastle(inst);
  put(knight(inst, 0), x, y); put(knight(inst, 1), x + 0.01, y);
  run(inst, REPAIR * 1.6);
  assert.equal(inst.hearts, HEARTS - 2);
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
  run(inst, 10);
  assert.equal(k.hp, KNIGHT_HP - 2, 'and stays hurt till it gets to the tent');
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

/* Knock knight i out, there and then. */
const knockOut = (inst, i = 0) => { const k = knight(inst, i); k.hp = 1; inst._knockOut(i, k); return k; };
/* Children a and b high-five: a hand each, meeting up high. */
function highFive(inst, a = 0, b = 1, x = 0.5, y = 0.3){
  for (let f = 0; f < 3; f++){
    for (const i of [a, b]) pose.players[i].hands.right = { x: x + (i === a ? -0.005 : 0.005), y, vx: 0, vy: 0, speed: 0 };
    inst.step(DT, W, H);
  }
}

/* Wiggling: the whole body shaking from side to side. */
const wiggling = (o = {}) => (t) => body({ ...o, dx: Math.sin(t * 25) * 0.04 });
/* A Frost Troll parked on the trail, about to let its blizzard go. */
function troll(inst, cast = FROST_WARN + 0.5){
  inst._spawn('troll', 0); const m = inst.monsters[inst.monsters.length - 1];
  m.s = 0.3; m.speed = 0; m.side = 0; m.hp = m.max = 1e9; m.cast = cast;
  return m;
}

test('a Frost Troll comes every tenth wave, and only then', () => {
  const trolls = (w) => waveOf(w).filter(m => m.kind === 'troll').length;
  for (let w = 1; w < TROLL_EVERY; w++) assert.equal(trolls(w), 0, `wave ${w}`);
  assert.equal(trolls(TROLL_EVERY), 1);
  assert.equal(trolls(TROLL_EVERY + 1), 0);
  assert.ok(trolls(TROLL_EVERY * 3) > 1, 'more later on');
  assert.ok(MONSTERS.troll.hp > MONSTERS.ogre.hp * 3, 'a big one');
  assert.ok(MONSTERS.troll.speed <= MONSTERS.ogre.speed);
});

test('its blizzard gathers, then freezes every knight still standing - only the troll does that', () => {
  const inst = quiet(2);
  put(knight(inst, 0), 0.5, 0.5); put(knight(inst, 1), 0.6, 0.5);
  knockOut(inst, 1);
  const m = troll(inst);
  run(inst, 1, () => still(2));
  assert.ok(inst.blizzard > 0, 'snow gathering');
  assert.equal(knight(inst).ice, 0, 'not yet');
  run(inst, FROST_WARN, () => still(2));
  assert.ok(knight(inst).ice > 0, 'frozen');
  assert.equal(knight(inst, 1).ice, 0, 'a knight already down is left as it is');
  assert.ok(m.cast > FROST_EVERY - FROST_WARN - 1, 'and again a while later');
  const ogreOnly = quiet(); monster(ogreOnly, 'ogre', 0.3).hp = 1e9;
  run(ogreOnly, FROST_FIRST + FROST_WARN + 1);
  assert.equal(knight(ogreOnly).ice, 0, 'nobody else freezes anyone');
});

test('a frozen knight cannot walk, fight or build', () => {
  const inst = quiet(), k = knight(inst), pad = PADS[2];
  put(k, pad.x, pad.y);
  troll(inst, 0.01); run(inst, 0.1);
  assert.ok(k.ice > 0);
  const slime = monster(inst, 'slime', nearestS(pad)); slime.hp = slime.max = 1e9;
  put(k, along(nearestS(pad)).x, along(nearestS(pad)).y);
  body({ lean: 1 }); run(inst, 2);
  assert.equal(slime.hp, slime.max, 'no sword');
  assert.ok(Math.abs(k.x - along(nearestS(pad)).x) < 1e-9, 'no walking');
  put(k, pad.x, pad.y); still(); run(inst, BUILD * 2);
  assert.ok(!inst.towers.has(2), 'no building');
});

test('wiggling breaks the ice - five seconds of it; standing still never does; stopping keeps what is done', () => {
  const inst = quiet(), k = knight(inst);
  troll(inst, 0.01); run(inst, 0.1);
  inst.monsters = [];
  run(inst, 10);
  assert.ok(k.ice > 0, 'standing still');
  run(inst, ICE_BREAK * 0.6, wiggling());
  assert.ok(k.ice > 0, 'not yet');
  run(inst, 3);
  assert.ok(k.ice > 0, 'a rest');
  run(inst, ICE_BREAK * 0.5, wiggling());
  assert.equal(k.ice, 0, 'free');
  assert.ok(inst.seen.wiggled);
  assert.equal(ICE_BREAK, 5);
});

test('ice is armour: an ogre cannot bonk a frozen knight', () => {
  const inst = quiet(), k = knight(inst);
  put(k, along(1.5).x, along(1.5).y);
  troll(inst, 0.01); run(inst, 0.1);
  const m = monster(inst, 'ogre', 1.5); m.hp = m.max = 1e9;
  run(inst, 6);
  assert.equal(k.hp, KNIGHT_HP);
});

test('an ogre that bonks a knight out leaves it lying there, levels and all', () => {
  const inst = quiet(2);
  const k = knight(inst);
  k.lvl = 7;
  const m = monster(inst, 'ogre', 1.5); m.hp = m.max = 1e9;
  put(k, along(1.5).x, along(1.5).y);
  put(knight(inst, 1), OPEN_FIELD.x, OPEN_FIELD.y);
  run(inst, (OGRE_CLUB + WINDUP) * (KNIGHT_HP - 1) + WINDUP + 0.3, () => still(2));
  assert.ok(k.down > 0, 'down');
  assert.equal(k.lvl, 7, 'its levels wait for it');
  run(inst, 1, () => { still(2); body({ lean: 1, n: 2 }); });
  assert.ok(Math.abs(k.fell.x - k.x) < 1e-9, 'it goes nowhere while it lies there');
});

test('while a friend is up, a fallen knight waits for them - however long', () => {
  const inst = quiet(2);
  const k = knockOut(inst);
  put(knight(inst, 1), OPEN_FIELD.x, OPEN_FIELD.y);
  run(inst, ALL_DOWN * 3, () => still(2));
  assert.ok(k.down > 0);
});

test('a friend beside it and a real high five gets a knight up, right there, levels kept', () => {
  const inst = quiet(2);
  const k = knight(inst);
  k.lvl = 6; put(k, 0.5, 0.5);
  knockOut(inst);
  const helper = knight(inst, 1);
  put(helper, 0.5 + REVIVE_R * 0.5 / ASPECT, 0.5);
  run(inst, 0.2, () => still(2));
  assert.equal(k.helper, 1, 'help is here');
  highFive(inst);
  assert.equal(k.down, 0, 'up');
  assert.equal(k.lvl, 6, 'levels kept');
  assert.ok(Math.abs(k.x - 0.5) < 1e-9 && Math.abs(k.y - 0.5) < 1e-9, 'right where it fell');
  assert.equal(k.hp, KNIGHT_HP);
  assert.ok(k.safe > 0 && inst.seen.revived);
});

test('a sloppy high five still counts: hands only near each other, at chest height, the knights not quite touching', () => {
  const inst = quiet(2);
  put(knight(inst), 0.5, 0.5); knockOut(inst);
  put(knight(inst, 1), 0.5 + 0.15 / ASPECT, 0.5);
  still(2);
  for (let f = 0; f < 2; f++){
    pose.players[0].hands.right = { x: 0.5 - 0.06 / ASPECT, y: 0.53, vx: 0, vy: 0, speed: 0 };
    pose.players[1].hands.left = { x: 0.5 + 0.06 / ASPECT, y: 0.52, vx: 0, vy: 0, speed: 0 };
    inst.step(DT, W, H);
  }
  assert.equal(knight(inst).down, 0);
});

test('a high five from far off, a friend beside it without one, or hands meeting low, does nothing', () => {
  const far = quiet(2); put(knight(far), 0.5, 0.5); knockOut(far);
  put(knight(far, 1), OPEN_FIELD.x, OPEN_FIELD.y);
  still(2); highFive(far);
  assert.ok(knight(far).down > 0, 'the friend\'s knight is far off');
  const near = quiet(2); put(knight(near), 0.5, 0.5); knockOut(near);
  put(knight(near, 1), 0.51, 0.5);
  run(near, 3, () => still(2));
  assert.ok(knight(near).down > 0, 'no high five');
  still(2); highFive(near, 0, 1, 0.5, 0.75);
  assert.ok(knight(near).down > 0, 'hands down low');
});

test('when every knight is down, after a while they are all back at the castle - from the start', () => {
  const inst = quiet(2);
  for (const i of [0, 1]){ const k = knight(inst, i); k.lvl = 5; put(k, 0.4 + i * 0.1, 0.5); knockOut(inst, i); }
  run(inst, ALL_DOWN * 0.9, () => still(2));
  assert.ok(knight(inst, 0).down > 0 && knight(inst, 1).down > 0);
  run(inst, ALL_DOWN * 0.15, () => still(2));
  for (const i of [0, 1]){
    const k = knight(inst, i);
    assert.equal(k.down, 0);
    assert.equal(k.lvl, 0, 'every level gone');
    assert.ok(Math.hypot(k.x - inst.home(i).x, k.y - inst.home(i).y) < 0.05, 'back by the castle');
    assert.ok(k.safe > 0);
  }
});

test('playing alone, a fallen knight is back at the castle after the wait', () => {
  const inst = quiet();
  const k = knight(inst); k.lvl = 4; put(k, 0.5, 0.5);
  knockOut(inst);
  run(inst, ALL_DOWN + 0.1);
  assert.equal(k.down, 0);
  assert.equal(k.lvl, 0);
  still();
  put(k, along(1.5).x, along(1.5).y);
  const m = monster(inst, 'ogre', 1.5); m.hp = m.max = 1e9;
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

/* ---------- the waves ---------- */

test('the waves come on their own: no horn to call them early', () => {
  still();
  const inst = game.create(1);
  run(inst, FIRST_BUILD - 1);
  assert.equal(inst.wave, 0);
  assert.equal(inst.horn, undefined);
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
  const m = monster(inst, 'slime', 1.5), p = along(1.5);
  m.hp = m.max = 1e9;
  mouse(p.x, p.y); run(inst, 6);
  assert.ok(m.hp < m.max, 'sword');
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
  for (let w = 2; w < 30; w++) assert.ok(countOf(w) > countOf(w - 1) || countOf(w) === CAP, 'more every wave, up to as many as can be drawn');
});

test('the more children playing, the bigger every wave', () => {
  for (const w of [1, 5, 12]) assert.ok(countOf(w, 4) > countOf(w, 3) && countOf(w, 3) > countOf(w, 2) && countOf(w, 2) > countOf(w, 1), `wave ${w}`);
  const ogres = (w, n) => waveOf(w, n).filter(m => m.kind === 'ogre').length;
  assert.ok(ogres(20, 4) > ogres(20, 1));
  for (const n of [1, 2, 4]){
    body({ n });
    const inst = game.create(4); inst.breakT = 0;
    inst.step(DT, W, H);
    assert.equal(inst.queue.length + inst.monsters.length, waveOf(1, n).length, `sized for ${n}`);
  }
  assert.equal(CROWD[0], 1);
});

test('red monsters: none at first, then more and more of each wave', () => {
  const reds = (w, n = 1) => waveOf(w, n).filter(m => m.red).length / waveOf(w, n).length;
  for (let w = 1; w <= 4; w++) assert.equal(reds(w), 0, `wave ${w}`);
  assert.ok(reds(8) > 0 && reds(8) < 0.25, `a few by wave 8: ${reds(8).toFixed(2)}`);
  assert.ok(reds(20) > reds(12) && reds(12) > reds(8));
  assert.ok(reds(40) <= 0.65, 'never all of them');
  for (const kind of ['slime', 'goblin', 'bat', 'ogre']) assert.ok(waveOf(30).some(m => m.kind === kind && m.red), `red ${kind}s`);
  assert.ok(redShare(10, 4) > redShare(10, 1), 'a little sooner with more children');
});

test('a red monster has more life, hurts the castle more and drops more coins - but is no faster', () => {
  const inst = quiet(0);
  inst._spawn('slime', 0, false); inst._spawn('slime', 0, true);
  const [plain, red] = inst.monsters;
  assert.equal(red.max, plain.max * RED.hp);
  assert.equal(red.speed, plain.speed);
  const coins = inst.coins;
  inst._damage(red, 99);
  assert.equal(inst.coins, coins + MONSTERS.slime.coins * RED.coins);
  inst.monsters = [];
  monster(inst, 'slime', PATH.total - 0.001).speed = 1;
  run(inst, 0.1);
  const after1 = inst.hearts;
  inst._spawn('slime', 0, true); const m = inst.monsters[0]; m.s = PATH.total - 0.001; m.speed = 1;
  run(inst, 0.1);
  assert.equal(after1 - inst.hearts, MONSTERS.slime.harm * RED.harm);
});

test('a red ogre bonks a knight harder', () => {
  const inst = quiet();
  inst._spawn('ogre', 0, true); const m = inst.monsters[0]; m.s = 1.5; m.speed = 0; m.side = 0; m.hp = m.max = 1e9;
  const k = knight(inst);
  put(k, along(1.5).x, along(1.5).y);
  run(inst, 0.2 + WINDUP);
  assert.equal(k.hp, KNIGHT_HP - RED.bonk);
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
  run(inst, 1, squats({ n: 2 }));
  knight(inst).hp = 1;
  inst.draw(ctx, W, H);
  build(inst, 4, 'cannon'); inst.towers.get(4).hp = 2;
  monster(inst, 'ogre', 1.5).wind = 0.5; knight(inst).spin = 9; knight(inst).sword = 0.3;
  troll(inst, 1); knight(inst, 1).ice = 1; knight(inst, 1).iceWork = 2;
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
