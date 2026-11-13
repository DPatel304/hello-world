import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDom, FakeEl } from './harness/browser.mjs';
import { remote } from '../src/ui/remote.js';
import { boot, HOLD, BOOT, MERGE } from '../src/ui/boot.js';
import { sfx } from '../src/audio/sound.js';

/* A button laid out at (x, y), w x h. */
function btn(parent, name, x, y, w = 200, h = 120, cls = 'btn'){
  const b = new FakeEl('button'); b.className = cls; b.name = name;
  b.rect = { left: x, top: y, width: w, height: h };
  b.clicks = 0; b.click = () => { b.clicks++; };
  parent.appendChild(b); return b;
}
function screen(ui, cls){ const s = new FakeEl('div'); s.className = 'screen ' + cls; ui.appendChild(s); return s; }
const press = (key) => remote.key({ key, preventDefault(){} });

/* The home screen's rows: three tiles, then one, then a row of five. */
function home(){
  const ui = resetDom(), s = screen(ui, 'tvhome');
  const r1 = [0, 1, 2].map(k => btn(s, 'a' + k, 80 + k * 340, 600));
  const r2 = [btn(s, 'b0', 80, 900)];
  const r3 = [0, 1, 2, 3, 4].map(k => btn(s, 'c' + k, 80 + k * 250, 1200));
  remote.cur = null;
  return { ui, s, r1, r2, r3 };
}

test('the remote moves to the next row down - never skipping one - then the nearest tile in it', () => {
  const { r1, r2, r3 } = home();
  remote.mark(r1[1]);
  press('ArrowDown');
  assert.equal(remote.cur, r2[0], 'the next row, even though a tile further down is straighter below');
  press('ArrowDown');
  assert.equal(remote.cur, r3[0]);
  press('ArrowRight'); press('ArrowRight');
  assert.equal(remote.cur, r3[2]);
  press('ArrowUp');
  assert.equal(remote.cur, r2[0]);
  press('ArrowUp');
  assert.equal(remote.cur, r1[0], 'the nearest tile in the row above');
});

test('left and right stay on the row, stopping at its end', () => {
  const { r1 } = home();
  remote.mark(r1[2]);
  press('ArrowRight');
  assert.equal(remote.cur, r1[2], 'nowhere further right on this row');
  press('ArrowLeft');
  assert.equal(remote.cur, r1[1]);
});

test('a screen hears which tile the remote moved to', () => {
  const { r1 } = home();
  let heard = null;
  r1[1].addEventListener('remotefocus', () => { heard = 'a1'; });
  remote.mark(r1[0]);
  press('ArrowRight');
  assert.equal(heard, 'a1');
});

test('OK presses the highlighted button; an open window comes first', () => {
  const { ui, r1 } = home();
  remote.mark(r1[0]);
  press('Enter');
  assert.equal(r1[0].clicks, 1);
  const win = screen(ui, 'dim');
  const a = btn(win, 'quieter', 600, 400), b = btn(win, 'louder', 900, 400);
  press('ArrowRight');
  assert.ok(remote.cur === a || remote.cur === b, 'moving inside the window, not the screen behind');
  press('Enter');
  assert.equal(r1[0].clicks, 1, 'the screen behind is left alone');
});

test('Back closes an open window; with none, it goes back (pauses a game, leaves the scores)', () => {
  const { ui } = home();
  const win = screen(ui, 'dim');
  const close = btn(win, 'close', 700, 800, 200, 100, 'btn close');
  let backs = 0; remote.back = () => backs++;
  press('Escape');
  assert.equal(close.clicks, 1);
  assert.equal(backs, 0);
  win.remove();
  press('BrowserBack');
  assert.equal(backs, 1);
});

test('the boot plays the kalimba as the lights merge, and hands over without waiting for the camera', () => {
  resetDom();
  let chimed = 0; sfx.boot = () => { chimed++; };
  const show = boot();
  for (let k = 0; k < (MERGE + 0.1) * 60; k++) show.tick(1 / 60);
  assert.equal(chimed, 1, 'the chime, once, as they join');
  for (let k = 0; k < (HOLD - MERGE) * 60; k++) show.tick(1 / 60);
  show.camReady = false;
  for (let k = 0; k < 10 * 60; k++) show.tick(1 / 60);
  assert.ok(!show.done && Math.abs(show.t - HOLD) < 1e-6, 'it can still hold on the cube, if asked to');
  show.camReady = true;
  for (let k = 0; k < (BOOT - HOLD + 0.1) * 60; k++) show.tick(1 / 60);
  assert.ok(show.done);
  delete sfx.boot;
  assert.equal(boot().camReady, true, 'nothing to wait for now: the camera starts with a game');
});
