import test from 'node:test';
import assert from 'node:assert/strict';
import popParty, { SIZES, MOTIONS, GIANT_R, GIANT_WINDOWS, GIANT_SLAPS,
  SLOW, SLOW_SECS, PARADE_N, PARADE_BONUS, ANIMAL_WORTH, EVENTS, EVENT_GAP, planEvents,
  ROUND, FINALE, OPENING, BOUQUET } from '../src/games/pop-party.js';
import { pose } from '../src/tracking/pose.js';
import { ANIMALS } from '../src/games/pop-party-animals.js';

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
  inst.events = [];   /* a parade would hold regular spawns back on purpose */
  const count = () => inst.balloons.filter(b => !b.giant).length;
  let most = 0, seen = 0;
  for (let i = 0; i < OPENING * 60; i++){
    inst.step(1 / 60, 1920, 1080);
    most = Math.max(most, count()); seen += count() > 0;
  }
  assert.equal(most, 1, 'the opening should show one balloon at a time');
  assert.ok(seen > OPENING * 60 * 0.8, 'and there should nearly always be one to reach for');

  for (let i = 0; i < 60 * 60; i++) inst.step(1 / 60, 1920, 1080);
  const minuteLater = count();
  for (let i = 0; i < (FINALE - OPENING - 70) * 60; i++) inst.step(1 / 60, 1920, 1080);
  const late = count();
  assert.ok(minuteLater >= 2 && minuteLater <= 5, `a minute after the opening: ${minuteLater} balloons`);
  assert.ok(late >= 9, `expected a busy sky just before the storm, got ${late}`);
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

test('every round brings two giants, each at a moment that varies', () => {
  onePlayer();
  const inst = popParty.create(1);
  const seen = [];
  for (let i = 0; i < ROUND * 60; i++){
    inst.step(1 / 60, 1920, 1080);
    for (const b of inst.balloons) if (b.giant && !seen.some(s => s.b === b)) seen.push({ b, t: inst.t });
  }
  assert.equal(seen.length, 2, 'two giants a round');
  seen.forEach(({ t }, k) => {
    const [a, b] = GIANT_WINDOWS[k];
    assert.ok(t >= a && t <= b + 0.5, `giant ${k + 1} at ${t.toFixed(1)}s, outside ${a}-${b}s`);
  });

  /* Across many rounds each lands all over its window. */
  const plans = Array.from({ length: 3000 }, () => planEvents(FINALE).filter(e => e.kind === 'giant').map(e => e.at));
  assert.ok(plans.every(p => p.length === 2));
  GIANT_WINDOWS.forEach(([a, b], k) => {
    const at = plans.map(p => p[k]);
    assert.ok(Math.min(...at) >= a && Math.max(...at) <= b);
    assert.ok(Math.min(...at) < a + 10 && Math.max(...at) > b - 10, `giant ${k + 1} should use its whole window`);
  });
});

test('slaps count while the giant rises, but it only pops once fully on screen', () => {
  onePlayer({ x:0.5, y:0.8 });
  const inst = popParty.create(1);
  inst.spawn = 99; inst.events = [];
  const g = inst._giant();
  Object.assign(g, { by:0.8, rise:0, f:0, ph:0 });   /* bottom half still below the screen */
  inst.balloons.push(g);
  const hand = pose.players[0].hands.left;
  for (let n = 0; n < GIANT_SLAPS + 4; n++){
    hand.x = -1; inst.step(1 / 60, 1920, 1080);
    hand.x = 0.5; inst.step(1 / 60, 1920, 1080);
  }
  assert.ok(!g.dead, 'should not pop while any of it is still below the screen');
  assert.equal(g.slaps, GIANT_SLAPS + 4, 'every slap should still count');

  g.by = 0.5;                                          /* now all of it is up */
  hand.x = -1; inst.step(1 / 60, 1920, 1080);
  hand.y = 0.5; hand.x = 0.5; inst.step(1 / 60, 1920, 1080);
  assert.ok(g.dead, 'the next slap once it is up should pop it');
});

test('once fully on screen, the giant slows down to hover', () => {
  const inst = popParty.create(1);
  inst.spawn = 99; inst.events = [];
  onePlayer();
  const g = inst._giant();
  Object.assign(g, { rise: 0.1, f: 0, ph: 0 });
  inst.balloons.push(g);
  g.by = 0.9; inst.step(1 / 60, 1920, 1080);
  let y0 = g.by; for (let i = 0; i < 60; i++) inst.step(1 / 60, 1920, 1080);
  const rising = y0 - g.by;
  g.by = 0.5; inst.step(1 / 60, 1920, 1080);
  y0 = g.by; for (let i = 0; i < 60; i++) inst.step(1 / 60, 1920, 1080);
  const hovering = y0 - g.by;
  assert.ok(hovering < rising * 0.6, `rose ${rising.toFixed(3)}/s below, ${hovering.toFixed(3)}/s once up`);
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

/* ---------- events ---------- */

function quiet(){
  onePlayer();
  const inst = popParty.create(1);
  inst.events = []; inst.spawn = 99;
  return inst;
}
const run = (inst, secs) => { for (let i = 0; i < Math.round(secs * 60); i++) inst.step(1 / 60, 1920, 1080); };

test('popping the giant slows the world, but not the round clock', () => {
  const inst = quiet();
  inst._hit(inst._giant(), 0, 1920, 1080);
  run(inst, 0.5);   /* let it ease in */

  const b = parked(inst, 0.5, 0.8); b.rise = 0.2; inst.balloons.push(b);
  const y0 = b.by, t0 = inst.t;
  run(inst, 1);
  const slowRise = y0 - b.by;
  assert.ok(Math.abs(inst.t - t0 - 1) < 1e-6, 'the round clock should keep real time');
  assert.ok(slowRise < 0.2 * SLOW * 1.4, `rose ${slowRise.toFixed(3)} in a slowed second`);

  run(inst, SLOW_SECS);
  const y1 = b.by;
  run(inst, 1);
  assert.ok(y1 - b.by > 0.2 * 0.95, 'speed should be back to normal afterwards');
});

test('the parade is a rainbow line that marches across, not up', () => {
  const inst = quiet();
  inst._parade();
  const line = inst.balloons.filter(b => b.parade);
  assert.equal(line.length, PARADE_N);
  const hues = line.map(b => b.hue);
  assert.deepEqual(hues, [...hues].sort((a, b) => a - b), 'hues should run in rainbow order');

  run(inst, 4);
  const ys = line.map(b => b.y), xs = line.map(b => b.x);
  assert.ok(Math.max(...ys) - Math.min(...ys) < 0.12, 'the line should stay level, give or take its wave');
  assert.ok(xs.some(x => x > 0.2 && x < 0.8), 'the head of the parade should be on screen by now');

  run(inst, 20);
  assert.equal(inst.balloons.filter(b => b.parade).length, 0, 'the parade should have marched off');
  assert.equal(inst.parade.escaped, PARADE_N);
  assert.equal(inst.hud().score[0], 0);
});

test('popping the whole parade earns the bonus', () => {
  const inst = quiet();
  inst._parade();
  for (const b of inst.balloons.filter(b => b.parade)) inst._hit(b, 0, 1920, 1080);
  /* 12 pops at 2, the 5th to 9th doubled and the 10th onwards tripled by
     the streak, plus the bonus. */
  const expected = 2 * (4 + 5 * 2 + 3 * 3) + PARADE_BONUS;
  assert.equal(inst.hud().score[0], expected);
});

for (const kind of Object.keys(ANIMALS)){
  test(`the balloon ${kind} walks across, unannounced, and leaves if nobody catches it`, () => {
    const inst = quiet();
    inst._animal(kind);
    const x0 = inst.animal.x;
    run(inst, 3);
    assert.ok(inst.animal && Math.abs(inst.animal.x - x0) > 0.15, 'it should be on its way');
    run(inst, 25);
    assert.equal(inst.animal, null, 'it should have walked off');
    assert.equal(inst.hud().score[0], 0);
  });

  test(`touching the balloon ${kind} pops it, part by part`, () => {
    const inst = quiet();
    inst._animal(kind);
    inst.animal.x = 0.5; inst.animal.dir = 1;
    run(inst, 1 / 60);
    Object.assign(pose.players[0].hands.left, { x: inst.animal.x, y: inst.animal.y });
    run(inst, 1 / 60);
    assert.equal(inst.hud().score[0], ANIMAL_WORTH);
    run(inst, 1 / 60);
    assert.ok(inst.animal && inst.animal.popped >= 1 && inst.animal.popped <= 2,
      `the parts should pop in sequence, not all at once (popped ${inst.animal?.popped})`);
    run(inst, 2);
    assert.equal(inst.animal, null);
    assert.equal(inst.hud().score[0], ANIMAL_WORTH, 'it should only score once');
  });
}

test('a hand nowhere near a balloon animal leaves it alone', () => {
  const inst = quiet();
  inst._animal('giraffe');
  inst.animal.x = 0.5;
  Object.assign(pose.players[0].hands.left, { x: 0.1, y: 0.2 });
  run(inst, 0.5);
  assert.equal(inst.hud().score[0], 0);
});

test('the only words on screen are scores: nothing is announced in text', () => {
  onePlayer({ x: 0.5, y: 0.5 });
  const inst = popParty.create(1);
  inst.events = [{ kind:'parade', at:40, done:false }, { kind:'giant', at:80, done:false },
                 { kind:'dog', at:120, done:false }, { kind:'giraffe', at:150, done:false },
                 { kind:'elephant', at:190, done:false }];
  const texts = new Set();
  const realPop = inst.j.pop.bind(inst.j);
  inst.j.pop = (x, y, text, col) => { texts.add(text); realPop(x, y, text, col); };
  /* A hand sweeping the middle of the screen, so it pops plenty: streaks,
     the parade, the animals, the giant and its slow motion, then the storm. */
  const hand = pose.players[0].hands.left;
  for (let i = 0; i < ROUND * 60; i++){
    hand.x = 0.5 + Math.sin(i / 20) * 0.4; hand.y = 0.5 + Math.cos(i / 31) * 0.3;
    inst.step(1 / 60, 1920, 1080);
  }
  assert.ok(texts.size > 3, 'the round should have scored plenty');
  for (const t of texts) assert.match(t, /^\+\d+( {2}x\d)?$/, `"${t}" is words, not a score`);
  assert.equal('banner' in inst, false, 'there is no banner to show');
});

test('a second animal waits for the first to leave', () => {
  const inst = quiet();
  inst.events = [{ kind:'dog', at:1, done:false }, { kind:'elephant', at:2, done:false }];
  run(inst, 2.5);
  assert.equal(inst.animal.kind, 'dog', 'the elephant should not replace the dog mid-walk');
  run(inst, 30);
  assert.ok(inst.events.every(e => e.done), 'the elephant should have had its turn once the dog left');
});

test('surprises are spread through the round, never crowded, and vary', () => {
  const N = 3000, total = {}, none = {};
  for (let i = 0; i < N; i++){
    const plan = planEvents(FINALE);
    for (const e of plan){
      total[e.kind] = (total[e.kind] || 0) + 1;
      assert.ok(e.at > OPENING && e.at <= FINALE - 15, `${e.kind} at ${e.at.toFixed(1)}s, in the opening or too near the storm`);
    }
    for (let k = 1; k < plan.length; k++){
      assert.ok(plan[k].at - plan[k - 1].at >= EVENT_GAP, 'two surprises too close together');
    }
    for (const kind of Object.keys(EVENTS)) if (!plan.some(e => e.kind === kind)) none[kind] = (none[kind] || 0) + 1;
  }
  /* Four windows of about a minute, each with its own chance per kind;
     crowding near the giants trims a little off. */
  for (const [kind, chance] of Object.entries(EVENTS)){
    const mean = (total[kind] || 0) / N, expected = 4 * chance;
    assert.ok(mean >= expected * 0.7 && mean <= expected * 1.05, `${kind}: ${mean.toFixed(2)} a round, expected about ${expected}`);
    const rare = (none[kind] || 0) / N;
    assert.ok(rare > 0.01 && rare < 0.5, `${kind}: missing from ${(rare * 100).toFixed(0)}% of rounds`);
  }
});

test('a planned surprise actually happens on time', () => {
  const inst = quiet();
  inst.events = [{ kind:'parade', at:1, done:false }, { kind:'dog', at:2, done:false }];
  run(inst, 0.9);
  assert.equal(inst.balloons.filter(b => b.parade).length, 0);
  run(inst, 0.2);
  assert.equal(inst.balloons.filter(b => b.parade).length, PARADE_N);
  assert.equal(inst.animal, null);
  run(inst, 1);
  assert.ok(inst.animal && inst.animal.kind === 'dog', 'the dog should have arrived');
});

test('the opening never sends a bunch, even when the dice say so', () => {
  onePlayer();
  const real = Math.random;
  /* Low enough that every chance roll - including the bunch - comes up yes. */
  Math.random = () => 0.05;
  try {
    const inst = popParty.create(1);
    inst.events = [];
    let most = 0;
    for (let i = 0; i < OPENING * 60; i++){
      inst.step(1 / 60, 1920, 1080);
      most = Math.max(most, inst.balloons.filter(b => !b.giant).length);
    }
    assert.equal(most, 1);
  } finally { Math.random = real; }
});

/* ---------- the bouquet ---------- */

function twoPlayers(){
  pose.mouse.active = false;
  for (let i = 0; i < 2; i++){
    const p = pose.players[i];
    p.present = true; p.lm = null;
    p.hands.left  = { x: i ? 0.65 : 0.25, y: 0.6, vx: 0, vy: 0, speed: 0 };
    p.hands.right = { x: i ? 0.75 : 0.35, y: 0.5, vx: 0, vy: 0, speed: 0 };
  }
}
const finish = (inst) => {
  let n = 0;
  while (!inst.outro(1 / 60, 1920, 1080)){ if (++n > 60 * 20) throw new Error('the ending never finished'); }
  return n / 60;
};

test('the round ends with everyone gathering a bouquet and floating away together', () => {
  twoPlayers();
  const inst = popParty.create(2);
  inst.events = [];
  for (let i = 0; i < 12; i++) inst._hit(parked(inst, 0.5, 0.5), 0, 1920, 1080);
  for (let i = 0; i < 3; i++) inst._hit(parked(inst, 0.5, 0.5), 1, 1920, 1080);
  const secs = finish(inst);
  assert.ok(secs > BOUQUET.liftAt && secs < 12, `the ending took ${secs.toFixed(1)}s`);
  const [a, b] = inst.out.groups;
  assert.equal(a.items.length, 12, "player one's bouquet is what they popped");
  assert.equal(b.items.length, BOUQUET.least, 'a light round still gets a handful, so everyone flies');
  assert.ok(a.lift > 1 && b.lift > 1, 'both should have floated off the top');
  assert.equal(a.lift, b.lift, 'and together - nobody wins');
});

test('bouquet balloons keep the colours that were popped', () => {
  twoPlayers();
  const inst = popParty.create(1);
  inst.events = [];
  const hues = [0, 48, 135, 215, 270, 325];
  for (const hue of hues){ const b = parked(inst, 0.5, 0.5); b.hue = hue; inst._hit(b, 0, 1920, 1080); }
  inst.outro(1 / 60, 1920, 1080);
  assert.deepEqual(inst.out.groups[0].items.map(b => b.hue), hues);
});

test('a huge round makes a big bouquet that still fits on screen', () => {
  twoPlayers();
  const inst = popParty.create(1);
  inst.events = [];
  for (let i = 0; i < 300; i++) inst._hit(parked(inst, 0.5, 0.5), 0, 1920, 1080);
  for (let i = 0; i < 60 * 3.5; i++) inst.outro(1 / 60, 1920, 1080);   /* gathered, not yet lifting */
  const g = inst.out.groups[0];
  assert.equal(g.items.length, BOUQUET.most);
  const top = Math.min(...g.items.map(b => b.y - b.r));
  assert.ok(top > -0.08, `the top of the bunch is at ${top.toFixed(2)}, off the screen`);
});

test('bouquet balloons are never mistaken for teeny ones', () => {
  twoPlayers();
  const inst = popParty.create(1);
  inst.events = [];
  for (let i = 0; i < 300; i++) inst._hit(parked(inst, 0.5, 0.5), 0, 1920, 1080);
  inst.outro(1 / 60, 1920, 1080);
  /* The teeny halo is a ring at least twice a balloon's radius; nothing that
     big should be drawn around a bouquet balloon, however small they get. */
  const rings = [];
  const c = new Proxy({}, {
    get(t, k){
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop(){} });
      if (k === 'arc') return (x, y, r) => rings.push(r);
      return () => {};
    },
    set(t, k, v){ t[k] = v; return true; }
  });
  const g = inst.out.groups[0];
  for (const b of g.items) inst._balloon(c, b, 1920, 1080);
  const biggest = Math.max(...rings) / 1080;
  assert.ok(biggest < g.items[0].r * 2, `a ring ${(biggest / g.items[0].r).toFixed(1)}x the balloon was drawn`);
});

test('the giant carries no number', () => {
  const inst = popParty.create(1);
  const g = inst._giant(); g.x = 0.5; g.y = 0.5; g.slaps = 3;
  const texts = [];
  const c = new Proxy({}, {
    get(t, k){
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop(){} });
      if (k === 'fillText' || k === 'strokeText') return (txt) => texts.push(txt);
      return () => {};
    },
    set(t, k, v){ t[k] = v; return true; }
  });
  inst._balloon(c, g, 1920, 1080);
  assert.deepEqual(texts, []);
});
