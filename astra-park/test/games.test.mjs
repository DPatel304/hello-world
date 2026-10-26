import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, byId } from '../src/games/index.js';
import { pose, L } from '../src/tracking/pose.js';

/* Canvas is the one thing in a game module with no behaviour worth asserting
   on, so it is stubbed wholesale. What matters is that draw() survives a
   whole round without throwing, which is exactly what this catches. */
function fakeCtx(){
  const grad = { addColorStop(){} };
  return new Proxy({}, {
    get(t, k){
      if (k in t) return t[k];
      if (k === 'canvas') return { width:1920, height:1080 };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return () => ({ width:10 });
      return () => {};
    },
    set(t, k, v){ t[k] = v; return true; }
  });
}

function body(over = {}){
  const lm = Array.from({ length:33 }, () => ({ x:0.5, y:0.5, z:0, v:0.9 }));
  for (const [name, patch] of Object.entries(over)) lm[L[name]] = { ...lm[L[name]], ...patch };
  return lm;
}

/* A standing figure: shoulders apart and above the hips, hands at the sides. */
function standing(){
  return body({
    L_SHOULDER:{ x:0.42, y:0.35 }, R_SHOULDER:{ x:0.58, y:0.35 },
    L_WRIST:{ x:0.40, y:0.60 },    R_WRIST:{ x:0.60, y:0.60 },
    L_HIP:{ x:0.45, y:0.60 },      R_HIP:{ x:0.55, y:0.60 }
  });
}

function setPlayers(n, lm = standing()){
  pose.mouse.active = false;
  for (let i = 0; i < 2; i++){
    const p = pose.players[i];
    p.present = i < n;
    p.lm = i < n ? lm.map(k => ({ ...k })) : null;
    p.centre = { x: i ? 0.65 : 0.35, y:0.5 };
    p.scale = 0.3;
    p.hands.left  = { x:0.3, y:0.5, vx:0, vy:0, speed:0 };
    p.hands.right = { x:0.7, y:0.5, vx:0, vy:0, speed:0 };
  }
  pose.personCount = n;
}

/* ---------- the catalogue ---------- */

test('every game declares the metadata the shell reads', () => {
  assert.ok(GAMES.length >= 1, 'the catalogue is empty');
  for (const g of GAMES){
    assert.match(g.id, /^[a-z0-9-]+$/, `${g.id}: id should be a slug`);
    assert.ok(g.name && g.name.length < 24, `${g.id}: name missing or too long for a tile`);
    assert.ok(Number.isInteger(g.stars) && g.stars >= 1 && g.stars <= 5, `${g.id}: stars out of range`);
    assert.match(g.accent, /^#[0-9a-f]{6}$/i, `${g.id}: accent should be a hex colour`);
    assert.ok(g.secs > 0 && g.secs <= 180, `${g.id}: round length looks wrong`);
    assert.ok(Array.isArray(g.howto) && g.howto.length >= 2, `${g.id}: needs at least two how-to lines`);
    assert.equal(typeof g.create, 'function', `${g.id}: create missing`);
  }
});

test('game ids are unique and findable', () => {
  const ids = GAMES.map(g => g.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
  for (const id of ids) assert.equal(byId(id).id, id);
  assert.equal(byId('nope'), undefined);
});

/* ---------- the runtime contract, per game ---------- */

for (const g of GAMES){
  test(`${g.id} survives a full round with two players`, () => {
    setPlayers(2);
    const inst = g.create(2);
    const c = fakeCtx();
    for (const m of ['step','draw','hud','tally','winner','value'])
      assert.equal(typeof inst[m], 'function', `${g.id}: ${m} missing`);

    /* A whole round at 60fps, which is also long enough for every difficulty
       ramp in the set to reach its ceiling. */
    for (let i = 0; i < g.secs * 60; i++){
      inst.step(1 / 60, 1920, 1080);
      if (i % 7 === 0) inst.draw(c, 1920, 1080);
    }

    const hud = inst.hud();
    assert.ok(Array.isArray(hud.score) && hud.score.length >= 2, `${g.id}: hud.score`);
    assert.ok(hud.score.every(Number.isFinite), `${g.id}: non-finite score`);
    /* lives is conditional on showLives, which is the actual contract: Star
       Snatch has no lives and says so, and the shell only reads the array
       when the flag is set. Asserting it unconditionally was wrong about the
       app rather than finding a bug in it. */
    assert.equal(typeof hud.showLives, 'boolean', `${g.id}: hud.showLives`);
    if (hud.showLives){
      assert.ok(Array.isArray(hud.lives), `${g.id}: showLives is set but lives is missing`);
      assert.ok(hud.lives.every(l => l >= 0), `${g.id}: negative lives`);
    }

    const rows = inst.tally();
    assert.equal(rows.length, 2, `${g.id}: a two-player tally needs two rows`);
    for (const r of rows){
      assert.ok(r.label && Number.isFinite(r.value) && r.color, `${g.id}: bad tally row`);
    }

    assert.ok([-1, 0, 1].includes(inst.winner()), `${g.id}: winner should be -1, 0 or 1`);
    assert.ok(Number.isFinite(inst.value()), `${g.id}: value should be a number`);
  });

  test(`${g.id} runs solo and reports no winner`, () => {
    setPlayers(1);
    const inst = g.create(1);
    const c = fakeCtx();
    for (let i = 0; i < 600; i++){
      inst.step(1 / 60, 1920, 1080);
      if (i % 11 === 0) inst.draw(c, 1920, 1080);
    }
    assert.equal(inst.winner(), null, `${g.id}: one player has nobody to beat`);
    assert.equal(inst.tally().length, 1, `${g.id}: solo tally should have one row`);
  });

  /* An empty room happens constantly - someone walks off mid-round - and must
     not throw, score, or end the game by itself. */
  test(`${g.id} tolerates an empty room`, () => {
    setPlayers(0);
    const inst = g.create(2);
    const c = fakeCtx();
    assert.doesNotThrow(() => {
      for (let i = 0; i < 900; i++){
        inst.step(1 / 60, 1920, 1080);
        if (i % 13 === 0) inst.draw(c, 1920, 1080);
      }
    }, `${g.id}: threw with nobody present`);
    /* Exactly zero, not merely finite. The first version of this assertion
       accepted any number, which made it pass against a game that
       awarded survival points to an empty room. */
    assert.deepEqual(inst.hud().score.slice(0, 2).map(Math.floor), [0, 0],
      `${g.id}: scored with nobody playing`);
  });
}
