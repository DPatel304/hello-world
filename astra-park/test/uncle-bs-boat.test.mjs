import test from 'node:test';
import assert from 'node:assert/strict';
import game, { CAST_SPEED, ESCAPE, ADMIRE } from '../src/games/uncle-bs-boat.js';
import { byId } from '../src/games/fishing-fish.js';
import { WATER, SEATS } from '../src/games/fishing-art.js';
import { pose } from '../src/tracking/pose.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };
/* The fishing hand, as the mouse: where it is and how it's moving. */
function hand(x, y, vx = 0, vy = 0){
  pose.mouse.active = true;
  const p = pose.players[0];
  p.present = true; pose.players[1].present = false;
  p.hands.right = { x, y, vx, vy, speed: Math.hypot(vx, vy) };
  p.hands.left = { ...p.hands.right };
}
const still = (y = 0.5) => hand(0.3, y);
function calm(){ still(); const inst = game.create(1); inst.fish = []; inst.spawn = 1e9; inst.uncle.shows = 1; inst.uncle.state = 'wait'; return inst; }
function cast(inst, speed = CAST_SPEED + 1){ hand(0.3, 0.5, -speed, 0); run(inst, DT); still(); run(inst, 0.8); }
/* Roll the hand round in circles for secs. */
function rollFor(inst, secs, turns = 1.5){
  run(inst, secs, (t) => { const a = t * turns * 6.28; hand(0.3 + Math.cos(a) * 0.05, 0.5 + Math.sin(a) * 0.05, -Math.sin(a) * 0.5, Math.cos(a) * 0.5); });
  still();
}
/* A fish parked right where the hook is, ready to bite. */
function fishAtHook(inst, sp = byId.perch){
  const r = inst.rods[0], f = inst._fish(false, sp);
  f.x = r.x + 0.03; f.y = r.hookY; f.speed = 0;
  return f;
}

test('Uncle B shows how first: casts, gets a bite, reels it in and holds it up', () => {
  still();
  const inst = game.create(1);
  inst.fish = []; inst.spawn = 1e9;
  let shown = null;
  run(inst, 14, () => { if (inst.showing && !shown) shown = inst.showing; });
  assert.ok(shown, 'he held a fish up');
  assert.equal(shown.who, -1);
  assert.equal(inst.book.size, 0, "his catch doesn't fill the children's book");
});

test('a quick swing casts, outward on the child\'s side; a gentle move does not', () => {
  const inst = calm();
  hand(0.3, 0.5, -CAST_SPEED * 0.6, 0); run(inst, 1);
  assert.equal(inst.rods[0].state, 'ready');
  cast(inst);
  const r = inst.rods[0];
  assert.equal(r.state, 'waiting');
  assert.ok(r.x < SEATS[0].x - 0.05, 'out over the water on the left');
});

test('a harder swing casts further', () => {
  const soft = calm(); cast(soft, CAST_SPEED + 0.2);
  const hard = calm(); cast(hard, CAST_SPEED + 2);
  assert.ok(hard.rods[0].x < soft.rods[0].x - 0.1);
});

test('lowering the hand lets the hook down deeper; raising it brings it up', () => {
  const inst = calm();
  cast(inst);
  still(0.85); run(inst, 5);
  const deep = inst.rods[0].hookY;
  assert.ok(deep > 0.8, `deep at ${deep.toFixed(2)}`);
  still(0.25); run(inst, 5);
  assert.ok(inst.rods[0].hookY < WATER + 0.1);
});

test('a fish comes to the hook, nibbles, then bites', () => {
  const inst = calm();
  cast(inst);
  const f = fishAtHook(inst);
  let nibbled = false;
  run(inst, 6, () => { if (inst.rods[0].dip > 0.3 && inst.rods[0].state === 'waiting') nibbled = true; });
  assert.ok(nibbled, 'the bobber dipped first');
  assert.equal(inst.rods[0].state, 'hooked');
  assert.equal(f.state, 'hooked');
});

test('rolling the hands round reels it in; it\'s held up, let go, and goes in the book', () => {
  const inst = calm();
  cast(inst);
  fishAtHook(inst, byId.koi);
  run(inst, 6);
  assert.equal(inst.rods[0].state, 'hooked');
  rollFor(inst, 4);
  assert.ok(inst.showing, 'held up for everyone');
  assert.equal(inst.showing.sp.id, 'koi');
  assert.equal(inst.showing.isNew, true);
  assert.ok(inst.book.has('koi'));
  run(inst, ADMIRE + 0.5);
  assert.equal(inst.showing, null, 'and let go again');
  assert.ok(inst.fish.some(f => f.sp.id === 'koi' && f.state === 'away'), 'swimming off');
});

test('pushing one way is not reeling', () => {
  const inst = calm();
  cast(inst);
  fishAtHook(inst);
  run(inst, 6);
  hand(0.3, 0.5, 0.6, 0); run(inst, 3);
  assert.equal(inst.caught, 0, 'not landed');
  assert.equal(inst.rods[0].state, 'hooked');
  assert.ok(inst.rods[0].reel < 0.5, `reel ${inst.rods[0].reel.toFixed(2)}`);
});

test('a fish nobody reels just swims away; the line stays in for the next', () => {
  const inst = calm();
  cast(inst);
  const f = fishAtHook(inst);
  run(inst, 6);
  run(inst, ESCAPE + 1);
  assert.equal(f.state, 'away');
  assert.equal(inst.rods[0].state, 'waiting');
  assert.equal(inst.caught, 0);
});

test('the round ends with the fish book', () => {
  const inst = calm();
  inst.book.add('perch'); inst.book.add('golden');
  let done = false;
  for (let i = 0; i < 60 * 12 && !done; i++) done = inst.outro(DT, W, H);
  assert.ok(done);
  assert.equal(inst.out.shown, 2, 'every fish found got its page');
});

test('the second of a kind is admired too, but it is not a new page', () => {
  const inst = calm();
  for (let n = 0; n < 2; n++){
    cast(inst);
    fishAtHook(inst, byId.perch);
    run(inst, 6);
    rollFor(inst, 4);
    assert.ok(inst.showing);
    assert.equal(inst.showing.isNew, n === 0);
    run(inst, ADMIRE + 1.5);
  }
  assert.equal(inst.caught, 2);
  assert.equal(inst.book.size, 1);
});
