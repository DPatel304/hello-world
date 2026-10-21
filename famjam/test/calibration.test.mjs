import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDom } from './harness/browser.mjs';
import { pose, L } from '../src/tracking/pose.js';
import { calibration } from '../src/ui/screens.js';

function body(over = {}){
  const lm = Array.from({ length: 33 }, () => ({ x:0.5, y:0.5, z:0, v:0.9 }));
  for (const [name, patch] of Object.entries(over)) lm[L[name]] = { ...lm[L[name]], ...patch };
  return lm;
}
const SEEN   = body();
const UNSEEN = body({ NOSE:{ v:0.05 } });   /* present, but not a whole body */

function setup(){
  const ui = resetDom();
  pose.mouse.active = false;
  pose.reason = '';
  pose.personCount = 0;
  for (const p of pose.players){ p.present = false; p.lm = null; p.lostFor = 99; }
  return ui;
}

/* Drive the screen for `seconds`, with `goodFraction` of ticks showing a
   findable body. Returns how long it took to finish, or null. */
function run(scr, seconds, goodFraction, dt = 0.05){
  const ticks = Math.round(seconds / dt);
  let elapsed = 0;
  for (let i = 0; i < ticks; i++){
    /* Interleaved, not front-loaded: a run of good frames followed by a run
       of bad ones would clear the gate before the bad ones arrived, which
       is not what a flickering detection looks like. */
    const good = goodFraction > 0 && (i % 10) < Math.round(goodFraction * 10);
    pose.players[0].present = true;
    pose.players[0].lm = good ? SEEN : UNSEEN;
    pose.personCount = 1;
    scr.tick(dt);
    elapsed += dt;
    if (scr._done) return elapsed;
  }
  return null;
}

/* calibration() reports completion through its callback, so wrap it. */
function makeScreen(){
  const scr = { _done: false };
  const api = calibration(() => { scr._done = true; });
  scr.tick = (dt) => api.tick(dt);
  return scr;
}

test('a clearly visible person starts the game in about two seconds', () => {
  setup();
  const scr = makeScreen();
  const took = run(scr, 6, 1.0);
  assert.ok(took !== null, 'should have finished');
  assert.ok(took > 1.0 && took < 3.0, 'expected ~1.5-2s, got ' + took);
});

/* The regression this gate exists for. Detection flickers frame to frame, and
   the stopwatch it replaced wanted an unbroken run, so its countdown crept
   from 1.9s to 1.2s over twelve seconds and never landed. A ratio survives
   the flicker by construction. */
test('flickering detection still completes', () => {
  setup();
  const scr = makeScreen();
  const took = run(scr, 8, 0.6);
  assert.ok(took !== null, 'a body found 60% of frames should still start the game');
  assert.ok(took < 4.0, 'and should not crawl: took ' + took);
});

test('a half-seen person does not start the game early', () => {
  setup();
  const scr = makeScreen();
  /* 40% of frames is below the threshold, so the ratio gate must not fire. */
  const took = run(scr, 5, 0.4);
  assert.equal(took, null, 'should still be waiting after 5s');
});

/* Nobody gets trapped. If someone is plainly there but the gate never quite
   closes, go anyway rather than leave them staring at the screen. */
test('a visible person is let through after the escape hatch', () => {
  setup();
  const scr = makeScreen();
  const took = run(scr, 20, 0.4);
  assert.ok(took !== null, 'the 14s escape hatch should have fired');
  assert.ok(took > 13 && took < 16, 'expected ~14s, got ' + took);
});

/* Rewriting the gate once broke this: the new ratio logic had no bearing on
   mouse mode, which still incremented a counter the rewrite had deleted, and
   the app sat on the calibration screen forever on any machine with no
   camera. */
test('mouse mode passes straight through', () => {
  setup();
  pose.mouse.active = true;
  pose.reason = 'nocamera';
  const scr = makeScreen();

  let elapsed = 0;
  for (let i = 0; i < 200 && !scr._done; i++){ scr.tick(0.05); elapsed += 0.05; }

  assert.equal(scr._done, true, 'mouse mode must not strand the app');
  assert.ok(elapsed > 2.5 && elapsed < 4.0, 'expected ~3s, got ' + elapsed);
  pose.mouse.active = false;
});

test('mouse mode explains why there is no camera', () => {
  const ui = setup();
  pose.mouse.active = true;
  pose.reason = 'denied';
  const scr = makeScreen();
  scr.tick(0.05);

  const text = ui.querySelectorAll('p').map(p => p.textContent).join(' ');
  assert.match(text, /permission was refused/i);
  assert.match(text, /mouse will play/i);
  pose.mouse.active = false;
});

test('an empty room keeps looking rather than timing out', () => {
  setup();
  const scr = makeScreen();
  let done = false;
  for (let i = 0; i < 400 && !done; i++){
    pose.players[0].present = false;
    pose.players[0].lm = null;
    pose.personCount = 0;
    scr.tick(0.05);
    done = scr._done;
  }
  assert.equal(done, false, 'with nobody in the room there is nothing to let through');
});

test('the skip button starts the game immediately', () => {
  const ui = setup();
  const scr = makeScreen();
  scr.tick(0.05);

  const skip = ui.querySelectorAll('.btn').find(b => /skip/i.test(b.textContent) ||
                                                    /skip/i.test(b.querySelector('.lbl')?.textContent || ''));
  assert.ok(skip, 'a skip button should exist');
  skip.dispatchEvent(new CustomEvent('pick', { detail:{ player:0 }, bubbles:true }));
  assert.equal(scr._done, true);
});

test('finishing twice does not fire the callback twice', () => {
  setup();
  let calls = 0;
  const api = calibration(() => calls++);
  for (let i = 0; i < 200; i++){
    pose.players[0].present = true;
    pose.players[0].lm = SEEN;
    pose.personCount = 1;
    api.tick(0.05);
  }
  assert.equal(calls, 1);
});
