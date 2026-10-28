import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDom } from './harness/browser.mjs';
import { pose } from '../src/tracking/pose.js';
import { cursor, button, onPick, STICK, CLICK_TURNS, WAVE_SWING } from '../src/ui/cursor.js';

const COOLDOWN = 0.75;

/* Mouse mode makes cursorHand deterministic: it always returns the right
   hand, so a test can place "the hand" by assignment. */
function setup(){
  const ui = resetDom();
  pose.mouse.active = true;
  pose.players[0].present = true;
  pose.players[1].present = false;
  cursor.enabled = true;
  cursor.rings.length = 0;
  cursor.reset(); for (const s of cursor._state) s.cool = 0;
  return ui;
}

function place(el, left, top, width, height){
  el.rect = { left, top, width, height, right: left + width, bottom: top + height };
  return el;
}

function hand(x, y){ pose.players[0].hands.right.x = x; pose.players[0].hands.right.y = y; }

/* Centre of a rect, in the 0..1 space the cursor works in. */
function centreOf(el){
  const r = el.rect;
  return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
}

/* Point and wave with the camera: the hand held at (x, y) for `secs`, or
   waving side to side there `turns` times. */
function camera(){ pose.mouse.active = false; pose.players[0].lm = null; }
function point(ui, x, y, secs){ hand(x, y); for (let t = 0; t < secs; t += 0.1) cursor.update(0.1, ui); }
function wave(ui, x, y, turns = CLICK_TURNS + 1){
  for (let i = 0; i <= turns; i++){ hand(x + (i % 2 ? 1 : -1) * WAVE_SWING * 1.6, y); cursor.update(0.15, ui); }
}

test('pointing at a button only lights it up - however long - and never clicks it', () => {
  const ui = setup(); camera();
  const b = place(button('Play'), 500, 300, 280, 160);
  ui.appendChild(b);
  let picks = 0;
  onPick(b, () => picks++);
  const c = centreOf(b);
  point(ui, c.x, c.y, 10);
  assert.ok(b.classList.contains('hot'), 'lit');
  assert.equal(picks, 0, 'ten seconds of pointing: still nothing');
  wave(ui, c.x, c.y);
  assert.equal(picks, 1, 'a wave clicks it');
  pose.mouse.active = true;
});

/* The regression: whatever replaces a button after a pick is usually sitting
   right under the hand that just chose, so without a cool-down the end of
   the wave clicks straight through it too. */
test('a cool-down stops the next screen firing under the same hand', () => {
  const ui = setup(); camera();
  const first = place(button('Choose'), 500, 300, 280, 160);
  ui.appendChild(first);
  let firstPicks = 0, secondPicks = 0;
  onPick(first, () => firstPicks++);
  const c = centreOf(first);
  point(ui, c.x, c.y, 0.3); wave(ui, c.x, c.y);
  assert.equal(firstPicks, 1);
  first.remove();
  const second = place(button('Start'), 500, 300, 280, 160);
  ui.appendChild(second);
  onPick(second, () => secondPicks++);
  /* Still waving as the screen changes. */
  wave(ui, c.x, c.y, 4);
  assert.equal(secondPicks, 0, 'must not fire during the cool-down');
  point(ui, c.x, c.y, COOLDOWN + 0.3); wave(ui, c.x, c.y);
  assert.equal(secondPicks, 1, 'and is pickable afterwards');
  pose.mouse.active = true;
});

test('reset arms the cool-down so a fresh screen is not instantly picked', () => {
  const ui = setup(); camera();
  const b = place(button('Play'), 500, 300, 280, 160);
  ui.appendChild(b);
  let picks = 0;
  onPick(b, () => picks++);
  cursor.reset();
  const c = centreOf(b);
  wave(ui, c.x, c.y, 4);
  assert.equal(picks, 0, 'reset should hold the cursor off for the cool-down');
  point(ui, c.x, c.y, 0.5); wave(ui, c.x, c.y);
  assert.equal(picks, 1, 'and releases it afterwards');
  pose.mouse.active = true;
});

/* A hand sweeping across the screen passes over buttons without meaning to
   choose them. */
test('a hand sweeping past a button never clicks it', () => {
  const ui = setup(); camera();
  const b = place(button('Play'), 200, 200, 900, 400);
  ui.appendChild(b);
  let picks = 0;
  onPick(b, () => picks++);
  const c = centreOf(b);
  for (let i = 0; i < 30; i++){ hand(c.x - 0.25 + i * 0.02, c.y); cursor.update(0.05, ui); }
  assert.equal(picks, 0);
  pose.mouse.active = true;
});

test('the hit test forgives a hand just outside the edge', () => {
  const ui = setup(); camera();
  const b = place(button('Play'), 500, 300, 280, 80);
  ui.appendChild(b);
  /* pad is 18% of the smaller dimension: 14px here. Sit 8px past the right edge. */
  point(ui, (780 + 8) / innerWidth, 340 / innerHeight, 0.5);
  assert.ok(b.classList.contains('hot'));
  pose.mouse.active = true;
});

test('disabled and unlaid-out buttons are ignored', () => {
  const ui = setup(); camera();
  const off = place(button('Nope'), 500, 300, 280, 80);
  off.disabled = true;
  const unlaid = place(button('Invisible'), 500, 300, 0, 0);
  ui.append(off, unlaid);
  let picks = 0;
  onPick(off, () => picks++);
  onPick(unlaid, () => picks++);
  point(ui, 640 / innerWidth, 340 / innerHeight, 0.5); wave(ui, 640 / innerWidth, 340 / innerHeight);
  assert.equal(picks, 0);
  pose.mouse.active = true;
});

test('a ring is drawn for every present player and none for absent ones', () => {
  const ui = setup();
  hand(0.3, 0.6);
  cursor.update(0.1, ui);
  assert.equal(cursor.rings.length, 1);
  assert.equal(cursor.rings[0].x, 0.3);
  pose.players[0].present = false;
  cursor.update(0.1, ui);
  assert.equal(cursor.rings.length, 0);
});

test('a disabled cursor clears any lit button', () => {
  const ui = setup();
  const b = place(button('Play'), 500, 300, 280, 80);
  ui.appendChild(b);
  const c = centreOf(b);
  point(ui, c.x, c.y, 0.5);
  assert.equal(b.classList.contains('hot'), true);
  cursor.enabled = false;
  cursor.update(0.1, ui);
  assert.equal(b.classList.contains('hot'), false);
  assert.equal(b.querySelector('.fill').style.transform, 'scaleX(0)');
  cursor.enabled = true;
});

/* Arriving at the menu from the title's wave, the waving hand is often
   right over a tile: the menu must not take that as a choice. */
test('hold ignores a hand waving on a button until it runs out', () => {
  const ui = setup(); camera();
  const b = place(button('Pop Party'), 500, 300, 280, 160);
  ui.appendChild(b);
  let picks = 0;
  onPick(b, () => picks++);
  const c = centreOf(b);
  cursor.hold(2);
  for (let k = 0; k < 2; k++) wave(ui, c.x, c.y, 4);
  assert.equal(picks, 0, 'nothing picked during the hold');
  point(ui, c.x, c.y, 0.5); wave(ui, c.x, c.y);
  assert.equal(picks, 1, 'an ordinary wave after it');
  pose.mouse.active = true;
});

/* ---------- point and wave ---------- */


test('point at a button and wave: it clicks, long before a dwell would', () => {
  const ui = setup(); camera();
  const b = place(button('Play'), 500, 300, 280, 160);
  ui.appendChild(b);
  let picks = 0;
  onPick(b, () => picks++);
  const c = centreOf(b);
  hand(c.x, c.y);
  for (let i = 0; i < 3; i++) cursor.update(0.1, ui);
  assert.ok(b.classList.contains('hot'), 'lit');
  /* Waving: side to side, a turn every 0.15s. */
  let t = 0;
  for (let i = 0; i < 12 && !picks; i++){ hand(c.x + (i % 2 ? 1 : -1) * WAVE_SWING * 1.6, c.y); cursor.update(0.15, ui); t += 0.15; }
  assert.equal(picks, 1, 'clicked');
  assert.ok(t < 1.5, `in ${t.toFixed(2)}s`);
  pose.mouse.active = true;
});

test('waving wide off the edge of the button still clicks the one pointed at', () => {
  const ui = setup(); camera();
  const b = place(button('Play'), 500, 300, 120, 120), next = place(button('Next'), 640, 300, 120, 120);
  ui.append(b, next);
  let picks = 0, wrong = 0;
  onPick(b, () => picks++); onPick(next, () => wrong++);
  const c = centreOf(b);
  hand(c.x, c.y);
  for (let i = 0; i < 3; i++) cursor.update(0.1, ui);
  /* The swing reaches right over the next button. */
  for (let i = 0; i < 12 && !picks; i++){ hand(c.x + (i % 2 ? 1 : -1) * 0.06, c.y); cursor.update(0.15, ui); }
  assert.equal(picks, 1); assert.equal(wrong, 0);
  pose.mouse.active = true;
});

test('a hand wobbling on the edge between two buttons does not flick between them', () => {
  const ui = setup(); camera();
  const a = place(button('A'), 500, 300, 200, 200), b = place(button('B'), 700, 300, 200, 200);
  ui.append(a, b);
  hand(centreOf(a).x, centreOf(a).y);
  for (let i = 0; i < 3; i++) cursor.update(0.1, ui);
  assert.ok(a.classList.contains('hot'));
  /* Jitter right on the line between them - small, not a wave. */
  const edge = 700 / innerWidth;
  let flicks = 0, was = 'a';
  for (let i = 0; i < 40; i++){
    hand(edge + (i % 2 ? 0.004 : -0.004), centreOf(a).y); cursor.update(1 / 30, ui);
    const now = a.classList.contains('hot') ? 'a' : b.classList.contains('hot') ? 'b' : '-';
    if (now !== was) flicks++; was = now;
  }
  assert.equal(flicks, 0, 'stays on the lit one');
  /* Moving clearly onto the other: it follows, after a moment. */
  hand(centreOf(b).x, centreOf(b).y);
  for (let i = 0; i < Math.ceil(STICK / 0.05) + 2; i++) cursor.update(0.05, ui);
  assert.ok(b.classList.contains('hot'));
  pose.mouse.active = true;
});
