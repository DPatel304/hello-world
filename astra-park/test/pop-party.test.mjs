import test from 'node:test';
import assert from 'node:assert/strict';
import popParty, { SIZES, MOTIONS, GIANT_R, GIANT_EVERY, GIANT_SLAPS, giantClock } from '../src/games/pop-party.js';
import { pose } from '../src/tracking/pose.js';

function onePlayer(hand = { x:-1, y:-1 }){
  pose.mouse.active = false;
  const p = pose.players[0];
  p.present = true;
  p.hands.left  = { x:hand.x, y:hand.y, vx:0, vy:0, speed:0 };
  p.hands.right = { x:-1, y:-1, vx:0, vy:0, speed:0 };
  pose.players[1].present = false;
}

/* A balloon parked at one spot: no rise, no wander. */
function parked(inst, x, y, r = 0.065){
  const b = inst._make(x);
  Object.assign(b, { by:y, rise:0, r, worth:1, kind:'normal', motion:'drift', dir:0, f:0, ph:0 });
  return b;
}

test('no black balloons: nothing spawned can cost the player', () => {
  const inst = popParty.create(1);
  const kinds = new Set();
  for (let i = 0; i < 3000; i++) kinds.add(inst._make().kind);
  assert.deepEqual([...kinds].sort(), ['normal', 'rainbow']);
  assert.equal(inst.hud().showLives, false);
});

test('balloons come in every size, and the small ones are worth more', () => {
  const inst = popParty.create(1);
  const seen = new Set();
  for (let i = 0; i < 3000; i++){
    const b = inst._make();
    const k = SIZES.findIndex(s => b.r >= s.r[0] && b.r <= s.r[1]);
    assert.ok(k >= 0, `radius ${b.r} is outside every size class`);
    seen.add(k);
    if (b.kind === 'normal') assert.equal(b.worth, SIZES[k].worth);
  }
  assert.equal(seen.size, SIZES.length, 'some size never spawned');
  assert.ok(SIZES[0].worth > SIZES[SIZES.length - 1].worth, 'the smallest should be worth the most');
});

test('balloons move in every pattern, not just straight up', () => {
  const inst = popParty.create(1);
  const seen = new Set();
  for (let i = 0; i < 3000; i++) seen.add(inst._make().motion);
  assert.deepEqual([...seen].sort(), Object.keys(MOTIONS).sort());

  /* And the patterns really differ: sample each one's sideways path. */
  const paths = Object.keys(MOTIONS).map(m => {
    const b = { f:2, ph:0, dir:1 };
    return Array.from({ length:8 }, (_, i) => MOTIONS[m].at(b, i * 0.4)[0].toFixed(3)).join();
  });
  assert.equal(new Set(paths).size, paths.length, 'two motions trace the same path');
});

test('a hand on a balloon pops it and scores', () => {
  onePlayer({ x:0.5, y:0.5 });
  const inst = popParty.create(1);
  inst.spawn = 99;
  inst.balloons.push(parked(inst, 0.5, 0.5));
  inst.step(1 / 60, 1920, 1080);
  assert.equal(inst.balloons.length, 0, 'balloon should have popped');
  assert.equal(inst.hud().score[0], 1);
});

test('a hand well away from a balloon leaves it alone', () => {
  onePlayer({ x:0.2, y:0.5 });
  const inst = popParty.create(1);
  inst.spawn = 99;
  inst.balloons.push(parked(inst, 0.5, 0.5));
  inst.step(1 / 60, 1920, 1080);
  assert.equal(inst.balloons.length, 1);
  assert.equal(inst.hud().score[0], 0);
});

test('a quick streak doubles the points from the fifth pop', () => {
  onePlayer();
  const inst = popParty.create(1);
  for (let i = 0; i < 6; i++) inst._hit(parked(inst, 0.5, 0.5), 0, 1920, 1080);
  assert.equal(inst.hud().score[0], 1 + 1 + 1 + 1 + 2 + 2);
});

test('a streak ends if you pause too long', () => {
  onePlayer();
  const inst = popParty.create(1);
  inst.spawn = 99;
  for (let i = 0; i < 4; i++) inst._hit(parked(inst, 0.5, 0.5), 0, 1920, 1080);
  for (let i = 0; i < 120; i++) inst.step(1 / 60, 1920, 1080);   /* two seconds */
  inst._hit(parked(inst, 0.5, 0.5), 0, 1920, 1080);
  assert.equal(inst.hud().score[0], 5, 'the fifth pop came after the streak ended');
});

test('the sky starts nearly empty and fills up as the round goes', () => {
  onePlayer();
  const inst = popParty.create(1);
  const count = () => inst.balloons.filter(b => !b.giant).length;
  for (let i = 0; i < 5 * 60; i++) inst.step(1 / 60, 1920, 1080);
  const early = count();
  for (let i = 0; i < 40 * 60; i++) inst.step(1 / 60, 1920, 1080);
  const late = count();
  assert.ok(early <= 3, `expected a sparse start, got ${early} balloons after 5s`);
  assert.ok(late >= 7, `expected a busy sky by 45s, got ${late}`);
});

test('teeny balloons are a fifth of an ordinary one, and still catchable', () => {
  const mid = (s) => (s.r[0] + s.r[1]) / 2;
  const ratio = mid(SIZES[2]) / mid(SIZES[0]);
  assert.ok(ratio > 4.5 && ratio < 5.5, `teeny should be ~5x smaller, is ${ratio.toFixed(2)}x`);

  /* A hand 0.03 away misses an ordinary-sized hitbox for something this
     small, but a teeny balloon has to forgive it. */
  onePlayer({ x:0.5 + 0.03 * 1080 / 1920, y:0.5 });
  const inst = popParty.create(1);
  inst.spawn = 99;
  inst.balloons.push(parked(inst, 0.5, 0.5, 0.012));
  inst.step(1 / 60, 1920, 1080);
  assert.equal(inst.balloons.length, 0, 'teeny balloon should have popped');
});

test('a giant balloon comes once per three minutes of play, across rounds', () => {
  onePlayer();
  giantClock.played = 0; giantClock.next = GIANT_EVERY;
  const giants = new Set();
  let firstAt = null, roundT = null;
  for (let round = 0; round < 4; round++){
    const inst = popParty.create(1);
    for (let i = 0; i < 60 * 60; i++){
      inst.step(1 / 60, 1920, 1080);
      for (const b of inst.balloons) if (b.giant && !giants.has(b)){
        giants.add(b); firstAt ??= giantClock.played; roundT ??= inst.t;
      }
    }
  }
  assert.equal(giants.size, 1, 'four one-minute rounds should bring exactly one giant');
  assert.ok(firstAt >= GIANT_EVERY, 'the giant came before three minutes of play');
  /* Three minutes lands at the very end of round three, too late for a
     balloon that size to rise into view; it should wait for round four. */
  assert.ok(roundT < 45, `giant launched ${roundT.toFixed(1)}s into a round, too late to be seen`);
});

test('the giant covers about a quarter of a 16:9 screen', () => {
  /* 2.46 r² is the area of the balloon path; the screen is 16/9 in units of
     its own height squared. */
  const share = 2.458 * GIANT_R * GIANT_R / (16 / 9);
  assert.ok(share > 0.22 && share < 0.28, `giant covers ${(share * 100).toFixed(0)}% of the screen`);
});

test('popping the giant is worth a lot', () => {
  onePlayer();
  const inst = popParty.create(1);
  const g = inst._giant();
  inst._hit(g, 0, 1920, 1080);
  assert.equal(inst.hud().score[0], 25);
});

test('the giant takes separate slaps to pop, and a resting hand counts once', () => {
  onePlayer({ x:0.5, y:0.5 });
  const inst = popParty.create(1);
  inst.spawn = 99;
  const g = inst._giant();
  Object.assign(g, { by:0.5, rise:0, f:0, ph:0 });
  inst.balloons.push(g);

  for (let i = 0; i < 120; i++) inst.step(1 / 60, 1920, 1080);
  assert.equal(g.slaps, 1, 'a hand left resting on the giant should count once');

  const hand = pose.players[0].hands.left;
  for (let n = 2; n <= GIANT_SLAPS; n++){
    hand.x = -1; inst.step(1 / 60, 1920, 1080);      /* pull away */
    hand.x = 0.5; inst.step(1 / 60, 1920, 1080);     /* slap */
  }
  assert.ok(g.dead, `giant should pop on slap ${GIANT_SLAPS}`);
  assert.equal(inst.hud().score[0], 25);
});

test('with the mouse playing, one touch on the giant is one slap', () => {
  onePlayer({ x:0.5, y:0.5 });
  pose.players[0].hands.right = { x:0.5, y:0.5, vx:0, vy:0, speed:0 };
  pose.mouse.active = true;
  try {
    const inst = popParty.create(1);
    inst.spawn = 99;
    const g = inst._giant();
    Object.assign(g, { by:0.5, rise:0, f:0, ph:0 });
    inst.balloons.push(g);
    inst.step(1 / 60, 1920, 1080);
    assert.equal(g.slaps, 1);
  } finally { pose.mouse.active = false; }
});
