import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, lighting } from '../src/games/pop-party-scene.js';

const calm = (over = {}) => ({ t: 0, p: 0, storm: false, wind: 0, joy: 0, look: 0.5, rainbow: false, ...over });
const sum = (c) => c[0] + c[1] + c[2];

test('the sky runs from morning through sunset', () => {
  const morning = lighting(0), noon = lighting(0.35), sunset = lighting(1);
  assert.ok(noon.top[2] > noon.top[0], 'midday sky should be blue');
  assert.ok(sunset.low[0] > sunset.low[2] + 60, 'the sunset horizon should be warm');
  assert.ok(sum(sunset.top) < sum(morning.top), 'the sky should darken towards sunset');
});
test('every pop grows a flower of that colour where it happened', () => {
  const sc = new Scene();
  sc.pop(0.3, 120);
  assert.equal(sc.flowers.length, 1);
  assert.equal(sc.flowers[0].hue, 120);
  assert.ok(Math.abs(sc.flowers[0].x - 0.3) <= 0.02, 'the flower should come up under the pop');

  for (let i = 0; i < 200; i++) sc.pop(Math.random(), 0);
  sc.step(1 / 60, calm());
  assert.ok(sc.flowers.length <= 60, 'the meadow keeps its newest flowers only');
});

test('the balloon storm brings no weather: same sky, no lightning, no dark clouds', () => {
  const stops = (storm) => {
    const sc = new Scene(), seen = [];
    for (let i = 0; i < 60 * 8; i++) sc.step(1 / 60, calm({ t: 290 + i / 60, p: 1, storm }));
    const c = new Proxy({}, {
      get(t, k){
        if (k in t) return t[k];
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: (o, col) => seen.push(col) });
        return () => {};
      },
      set(t, k, v){ if (k === 'fillStyle' && typeof v === 'string') seen.push(v); t[k] = v; return true; }
    });
    sc.drawBack(c, 1920, 1080); sc.drawFront(c, 1920, 1080);
    return { seen, sc };
  };
  const fair = stops(false), finale = stops(true);
  assert.deepEqual(finale.seen.slice(0, 3), fair.seen.slice(0, 3), 'the sky colours should not change for the finale');
  assert.ok(!finale.seen.some(col => /rgba\(235,240,255/.test(col)), 'no lightning flash');
  assert.ok(!finale.seen.some(col => /rgba\(40,42,70/.test(col)), 'no storm clouds');
  assert.equal('flash' in finale.sc || 'bolt' in finale.sc, false);
});
test('the world shifts against where the players stand', () => {
  const left = new Scene(), right = new Scene();
  for (let i = 0; i < 300; i++){
    left.step(1 / 60, calm({ look: 0.2 }));
    right.step(1 / 60, calm({ look: 0.8 }));
  }
  const W = 1920;
  assert.ok(left._shift(0.05, W) > 0 && right._shift(0.05, W) < 0, 'layers should move opposite the players');
  assert.ok(Math.abs(left._shift(0.05, W)) > Math.abs(left._shift(0.015, W)), 'nearer layers should move more');
});

test('a rainbow shows during the parade and fades after', () => {
  const sc = new Scene();
  sc.rainbowAt = 1e9;
  for (let i = 0; i < 300; i++) sc.step(1 / 60, calm({ t: i / 60, rainbow: true }));
  assert.ok(sc.rainbow > 0.3);
  for (let i = 0; i < 600; i++) sc.step(1 / 60, calm({ t: 5 + i / 60 }));
  assert.ok(sc.rainbow < 0.05);
});

test('birds fly by now and then', () => {
  const sc = new Scene();
  let birds = 0;
  for (let i = 0; i < 60 * 60; i++){ sc.step(1 / 60, calm({ t: i / 60 })); birds += !!sc.flock; }
  assert.ok(birds > 0, 'a minute should bring birds');
});
test('the sun grins when someone is on a streak', () => {
  const sc = new Scene();
  for (let i = 0; i < 120; i++) sc.step(1 / 60, calm({ joy: 1 }));
  assert.ok(sc.joy > 0.9);
  for (let i = 0; i < 120; i++) sc.step(1 / 60, calm({ joy: 0 }));
  assert.ok(sc.joy < 0.1);
});

test('a laptop that cannot keep up gets a lighter scene, and keeps it', () => {
  const sc = new Scene();
  for (let i = 0; i < 60 * 10; i++) sc.step(1 / 60, calm({ t: i / 60 }));
  assert.equal(sc.lite, false, 'a steady 60fps should keep the full scene');

  for (let i = 0; i < 30 * 2; i++) sc.step(1 / 30, calm({ t: 10 + i / 30 }));
  assert.equal(sc.lite, false, 'a two-second dip is not enough to give up the extras');

  for (let i = 0; i < 30 * 5; i++) sc.step(1 / 30, calm({ t: 12 + i / 30 }));
  assert.equal(sc.lite, true, 'five seconds at 30fps should drop to the lighter scene');

  for (let i = 0; i < 60 * 10; i++) sc.step(1 / 60, calm({ t: 17 + i / 60 }));
  assert.equal(sc.lite, true, 'and stay there, rather than flicker back and forth');
});
