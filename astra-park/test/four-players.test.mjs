import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, L, MAX_PLAYERS, PLAYER_COLORS } from '../src/tracking/pose.js';
import { GAMES } from '../src/games/index.js';
import lastKnownPosition, { story } from '../src/games/lkp-game.js';
/* The play itself, without the captain's scenes. */
story.on = false;
import boat from '../src/games/uncle-bs-boat.js';
import danceParty from '../src/games/dance-party.js';
import popParty from '../src/games/pop-party.js';
import { RUN } from '../src/games/lkp-art.js';
import { WATER, seatsFor } from '../src/games/fishing-art.js';
import { standIn } from '../src/games/moon-art.js';

const W = 1920, H = 1080, DT = 1 / 60;
const run = (inst, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++){ if (each) each(i * DT); inst.step(DT, W, H); } };
const XS = [0.2, 0.4, 0.6, 0.8];

/* n children standing in a row across the room, hands at their sides. */
function row(n){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    p.present = i < n;
    const x = XS[i];
    p.lm = i < n ? standIn(x) : null;
    p.centre = { x, y: 0.6 }; p.scale = 0.25;
    p.hands.left = { x: x - 0.03, y: 0.6, vx: 0, vy: 0, speed: 0 };
    p.hands.right = { x: x + 0.03, y: 0.6, vx: 0, vy: 0, speed: 0 };
  });
}
test.afterEach(() => row(0));

test('there are four players, each in their own colour', () => {
  assert.equal(MAX_PLAYERS, 4);
  assert.equal(pose.players.length, 4);
  assert.equal(new Set(PLAYER_COLORS).size, 4);
});

test('every game runs a while with four children and draws them', () => {
  row(4);
  const c = new Proxy({}, { get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true });
  for (const g of GAMES){
    const inst = g.create(4);
    run(inst, 5);
    inst.draw(c, W, H);
    assert.ok(!inst.over, `${g.id} still going`);
  }
});

test('Last Known Position: four crew share the corridor, and each can lean round debris', () => {
  row(4);
  const inst = lastKnownPosition.create(4);
  inst.things = [];
  run(inst, 1);
  const xs = inst.crew.map(r => r.x);
  for (let k = 1; k < 4; k++) assert.ok(xs[k] > xs[k - 1] + 0.3, `spread out: ${xs.map(x => x.toFixed(2))}`);
  /* Debris right in front of the third; they lean away from it. */
  const home = inst._home(2);
  inst.things.push({ kind: 'blocker', d: inst.z + RUN + inst.speed * 0.8, a: home - 0.08, b: home + 0.08, seed: 1 });
  const lm = standIn(XS[2]);
  lm[L.L_SHOULDER] = { ...lm[L.L_SHOULDER], x: lm[L.L_SHOULDER].x + 0.03 }; lm[L.R_SHOULDER] = { ...lm[L.R_SHOULDER], x: lm[L.R_SHOULDER].x + 0.03 };
  pose.players[2].lm = lm;
  run(inst, 1.5);
  assert.equal(inst.crew[2].hp, inst.crew[2].max, 'missed it');
});

test("Uncle B's Boat: four seats, and every child can scoop a fish", () => {
  assert.equal(seatsFor(4).length, 4);
  assert.equal(new Set(seatsFor(4).map(s => s.x)).size, 4);
  row(4);
  const inst = boat.create(4);
  inst.fish = []; inst.spawn = 1e9; inst.lastCatch = 1e9;
  for (let i = 0; i < 4; i++){
    const f = inst._fish(false); f.x = XS[i]; f.y = 0.65; f.speed = 0;
    const p = pose.players[i];
    p.hands.left = { x: XS[i] - 0.01, y: 0.65 }; p.hands.right = { x: XS[i] + 0.01, y: 0.65 };
  }
  run(inst, 0.3);
  assert.deepEqual(inst.cups.map(c => !!c.fish), [true, true, true, true]);
});

test('Dance Party: the fourth child dancing counts too', () => {
  row(4);
  const inst = danceParty.create(4);
  const rest = pose.players.map(p => p.lm);
  run(inst, 3, (t) => { const p = pose.players[3]; p.lm = rest[3].map(k => ({ ...k, x: k.x + Math.sin(t * 12.6) * 0.06 })); });
  assert.ok(inst.moving[3] > 0.5);
});

test('Pop Party: a bouquet for each of four, each small enough to fit', () => {
  row(4);
  const inst = popParty.create(4);
  inst.events = [];
  for (let i = 0; i < 4; i++) for (let k = 0; k < 40; k++){ const b = inst._make(0.5); Object.assign(b, { by: 0.5, rise: 0, r: 0.06, worth: 1, kind: 'normal' }); inst._hit(b, i, W, H); }
  inst.outro(DT, W, H);
  assert.equal(inst.out.groups.length, 4);
  assert.deepEqual(inst.out.groups.map(g => g.who), [0, 1, 2, 3]);
  assert.ok(inst.out.groups.every(g => g.items.length < 40), 'trimmed to fit four');
});
