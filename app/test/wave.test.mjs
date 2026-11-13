import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveWatch, handsFrom, WAVE_SWING, WAVE_TURNS } from '../src/tracking/wave.js';
import { pose, L } from '../src/tracking/pose.js';

const DT = 1 / 30;

/* One hand swinging side to side about x = 0.5: `swings` half-swings of
   `amp` either side, each taking `secs`. Returns the turns counted. */
function swing(w, { swings, amp = 0.06, secs = 0.25, raised = true, key = '0right' }){
  let turns = 0;
  const steps = Math.round(secs / DT);
  for (let s = 0; s < swings; s++){
    for (let k = 1; k <= steps; k++){
      const from = s % 2 ? amp : -amp, to = -from;
      const x = 0.5 + from + (to - from) * (k / steps);
      turns += w.step(DT, [{ key, who: 0, x, y: 0.3, raised }]);
    }
  }
  return turns;
}

/* Holding still where an even number of swings ends. */
function rest(w, secs){
  for (let t = 0; t < secs; t += DT) w.step(DT, [{ key: '0right', who: 0, x: 0.44, y: 0.3, raised: true }]);
}

test('a raised hand waving back and forth makes a wave', () => {
  const w = new WaveWatch();
  swing(w, { swings: WAVE_TURNS + 1 });
  assert.equal(w.done, true);
  assert.equal(w.meter, 1);
  assert.equal(w.last.who, 0);
});

test('the meter fills a step with each turn, not before', () => {
  const w = new WaveWatch();
  swing(w, { swings: 2 });
  /* The first swing only sets a direction; the second ends in one turn. */
  assert.ok(Math.abs(w.meter - 1 / WAVE_TURNS) < 1e-9, `meter ${w.meter}`);
  assert.equal(w.done, false);
});

test('jitter smaller than a swing never counts', () => {
  const w = new WaveWatch();
  swing(w, { swings: 40, amp: WAVE_SWING * 0.4, secs: 0.2 });
  assert.equal(w.meter, 0);
});

test('arms swinging down by the sides do not count', () => {
  const w = new WaveWatch();
  swing(w, { swings: 20, raised: false });
  assert.equal(w.meter, 0);
  assert.equal(w.done, false);
});

test('flicker faster than a hand can turn does not count', () => {
  const w = new WaveWatch();
  let turns = 0;
  /* A landmark jumping back and forth every frame. */
  for (let k = 0; k < 60; k++) turns += w.step(DT, [{ key: 'a', who: 0, x: 0.5 + (k % 2 ? 0.05 : -0.05), y: 0.3, raised: true }]);
  assert.equal(turns, 0);
});

test('a short pause keeps the wave going; a long one lets it go', () => {
  const w = new WaveWatch();
  swing(w, { swings: 4 });
  const part = w.meter;
  assert.ok(part > 0 && part < 1);
  rest(w, 0.5);
  assert.equal(w.meter, part, 'a breath mid-wave costs nothing');
  rest(w, 1.2);
  assert.ok(w.meter < part, 'stopping drains it');
  rest(w, 5);
  assert.equal(w.meter, 0);
  assert.equal(w.turns, 0);
});

test('two hands waving together both count', () => {
  const w = new WaveWatch();
  const steps = Math.round(0.25 / DT);
  for (let s = 0; s < 4; s++){
    for (let k = 1; k <= steps; k++){
      const from = s % 2 ? 0.06 : -0.06, x = from + (-2 * from) * (k / steps);
      w.step(DT, [{ key: '0left', who: 0, x: 0.3 + x, y: 0.3, raised: true },
                  { key: '1right', who: 1, x: 0.7 - x, y: 0.3, raised: true }]);
    }
  }
  assert.equal(w.turns, 6);
});

/* ---- reading hands off the pose ---- */

function lm(over){
  const out = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 }));
  for (const [k, v] of Object.entries(over)) out[L[k]] = { ...out[L[k]], ...v };
  return out;
}

test('a hand counts as raised at or above its shoulder', () => {
  pose.mouse.active = false;
  const p = pose.players[0];
  p.present = true;
  p.lm = lm({ L_SHOULDER: { y: 0.4 }, R_SHOULDER: { y: 0.4 }, L_WRIST: { y: 0.3 }, R_WRIST: { y: 0.6 } });
  pose.players[1].present = false;
  const hands = handsFrom(pose);
  assert.deepEqual(hands.map(h => [h.key, h.raised]), [['0left', true], ['0right', false]]);
});

test('with the mouse, the pointer is one raised hand', () => {
  pose.mouse.active = true;
  pose.players[0].present = true;
  pose.players[0].hands.right = { x: 0.2, y: 0.8, vx: 0, vy: 0, speed: 0 };
  pose.players[1].present = false;
  const hands = handsFrom(pose);
  assert.equal(hands.length, 1);
  assert.equal(hands[0].raised, true);
  assert.equal(hands[0].x, 0.2);
  pose.mouse.active = false;
});
