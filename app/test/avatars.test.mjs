import test from 'node:test';
import assert from 'node:assert/strict';
import { Avatars } from '../src/ui/avatars.js';
import { pose, L } from '../src/tracking/pose.js';

function player(i, hand = {}){
  const p = pose.players[i];
  p.present = true;
  p.lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));
  Object.assign(p.lm[L.L_SHOULDER], { x: 0.45, y: 0.35 }); Object.assign(p.lm[L.R_SHOULDER], { x: 0.55, y: 0.35 });
  Object.assign(p.lm[L.L_HIP], { x: 0.46, y: 0.6 });       Object.assign(p.lm[L.R_HIP], { x: 0.54, y: 0.6 });
  p.hands.left  = { x: 0.3, y: 0.5, vx: 0, vy: 0, speed: 0, ...hand };
  p.hands.right = { x: 0.7, y: 0.5, vx: 0, vy: 0, speed: 0 };
}
function fakeCtx(){
  const calls = [];
  return { calls, ctx: new Proxy({}, {
    get(t, k){
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop(){} });
      return (...a) => { calls.push(k); };
    },
    set(t, k, v){ t[k] = v; return true; }
  }) };
}

test.beforeEach(() => { pose.mouse.active = false; pose.players[1].present = false; });

test('a hand moving fast leaves a trail of sparkles; a still one does not', () => {
  player(0);
  const still = new Avatars();
  for (let i = 0; i < 60; i++) still.step(1 / 60, 1);
  assert.equal(still.sparks.length, 0);

  player(0, { speed: 2, vx: 2 });
  const swift = new Avatars();
  for (let i = 0; i < 30; i++) swift.step(1 / 60, 1);
  assert.ok(swift.sparks.length > 5, `only ${swift.sparks.length} sparkles`);
});

test('a streak bursts sparkles from that player and makes their hands glow', () => {
  player(0);
  const av = new Avatars();
  av.burst(0, 1);
  assert.ok(av.sparks.length >= 30, 'both hands should burst');
  assert.ok(av.sparks.every(s => s.who === 0));
  for (let i = 0; i < 120; i++) av.step(1 / 60, 1, [2, 0]);
  assert.ok(av.glow[0] > 0.9 && av.glow[1] < 0.05);
});

test('the mouse shows as one hand, not two', () => {
  player(0);
  pose.mouse.active = true;
  assert.equal(new Avatars()._hands(1).length, 1);
  pose.mouse.active = false;
  assert.equal(new Avatars()._hands(1).length, 2);
});

test('players can see themselves: a body is drawn for everyone present', () => {
  player(0);
  const { calls, ctx } = fakeCtx();
  new Avatars().drawBodies(ctx, 1920, 1080, 1);
  assert.ok(calls.filter(k => k === 'stroke').length >= 4, 'torso and limbs');
  assert.ok(calls.includes('arc'), 'a head');

  pose.players[0].present = false;
  const empty = fakeCtx();
  new Avatars().drawBodies(empty.ctx, 1920, 1080, 1);
  assert.equal(empty.calls.length, 0, 'nobody there, nothing drawn');
});
