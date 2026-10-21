import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDom } from './harness/browser.mjs';
import { pose } from '../src/tracking/pose.js';
import { cursor, button, onPick } from '../src/ui/cursor.js';

const DWELL = 1.0, COOLDOWN = 0.75;

/* Mouse mode makes cursorHand deterministic: it always returns the right
   hand, so a test can place "the hand" by assignment. */
function setup(){
  const ui = resetDom();
  pose.mouse.active = true;
  pose.players[0].present = true;
  pose.players[1].present = false;
  cursor.enabled = true;
  cursor.rings.length = 0;
  for (const s of cursor._state){ s.el = null; s.t = 0; s.cool = 0; s.x = .5; s.y = .5; }
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

test('holding a hand on a button fires a pick after the dwell', () => {
  const ui = setup();
  const b = place(button('Play'), 500, 300, 280, 80);
  ui.appendChild(b);
  let picks = 0;
  onPick(b, () => picks++);

  const c = centreOf(b);
  hand(c.x, c.y);
  for (let i = 0; i < 20 && picks === 0; i++) cursor.update(0.1, ui);

  assert.equal(picks, 1, 'exactly one pick');
});

test('a pick does not fire before the dwell has elapsed', () => {
  const ui = setup();
  const b = place(button('Play'), 500, 300, 280, 80);
  ui.appendChild(b);
  let picks = 0;
  onPick(b, () => picks++);

  const c = centreOf(b);
  hand(c.x, c.y);
  /* 0.6s of dwell, comfortably short of DWELL. */
  for (let i = 0; i < 6; i++) cursor.update(0.1, ui);
  assert.equal(picks, 0);
});

/* The regression: whatever replaces a button after a pick is usually sitting
   right under the hand that just chose, so without a cool-down the cursor
   dwells straight through it and fires again. Picking a game launched the
   next screen's button too. */
test('a cool-down stops the next screen firing under the same hand', () => {
  const ui = setup();
  const first = place(button('Choose'), 500, 300, 280, 80);
  ui.appendChild(first);
  let firstPicks = 0, secondPicks = 0;
  onPick(first, () => firstPicks++);

  const c = centreOf(first);
  hand(c.x, c.y);
  for (let i = 0; i < 20 && firstPicks === 0; i++) cursor.update(0.1, ui);
  assert.equal(firstPicks, 1);

  /* The screen changes: a different button appears in the same place and the
     hand has not moved. */
  first.remove();
  const second = place(button('Start'), 500, 300, 280, 80);
  ui.appendChild(second);
  onPick(second, () => secondPicks++);

  /* 1.4s. Longer than the 1.0s dwell on its own, so reaching here with no
     pick can only be the cool-down holding it off - a shorter window would
     pass even if the cool-down were deleted entirely. */
  for (let i = 0; i < 14; i++) cursor.update(0.1, ui);
  assert.equal(secondPicks, 0, 'must not fire during the cool-down');

  /* Once it expires the button becomes pickable in the normal way. */
  for (let i = 0; i < 20 && secondPicks === 0; i++) cursor.update(0.1, ui);
  assert.equal(secondPicks, 1, 'and is pickable afterwards');
});

test('reset arms the cool-down so a fresh screen is not instantly picked', () => {
  const ui = setup();
  const b = place(button('Play'), 500, 300, 280, 80);
  ui.appendChild(b);
  let picks = 0;
  onPick(b, () => picks++);

  cursor.reset();
  const c = centreOf(b);
  hand(c.x, c.y);
  /* Again longer than the dwell alone, so only the cool-down can explain it. */
  for (let i = 0; i < 14; i++) cursor.update(0.1, ui);
  assert.equal(picks, 0, 'reset should hold the cursor off for the cool-down');

  for (let i = 0; i < 20 && picks === 0; i++) cursor.update(0.1, ui);
  assert.equal(picks, 1, 'and releases it afterwards');
});

/* A hand waving across the screen passes over buttons without meaning to
   choose them. */
test('a hand sweeping past a button never completes a dwell', () => {
  const ui = setup();
  const b = place(button('Play'), 200, 200, 900, 400);   /* wide, easy to stay inside */
  ui.appendChild(b);
  let picks = 0;
  onPick(b, () => picks++);

  const c = centreOf(b);
  let x = c.x - 0.2;
  for (let i = 0; i < 30; i++){
    x += 0.1;                                            /* far beyond the dead zone */
    if (x > c.x + 0.2) x = c.x - 0.2;
    hand(x, c.y);
    cursor.update(0.1, ui);
  }
  assert.equal(picks, 0, 'movement should decay the dwell');
});

test('the hit test forgives a hand just outside the edge', () => {
  const ui = setup();
  const b = place(button('Play'), 500, 300, 280, 80);
  ui.appendChild(b);
  let picks = 0;
  onPick(b, () => picks++);

  /* pad is 18% of the smaller dimension: 14px here. Sit 8px past the right edge. */
  hand((780 + 8) / innerWidth, 340 / innerHeight);
  for (let i = 0; i < 20 && picks === 0; i++) cursor.update(0.1, ui);
  assert.equal(picks, 1);
});

test('disabled and unlaid-out buttons are ignored', () => {
  const ui = setup();
  const off = place(button('Nope'), 500, 300, 280, 80);
  off.disabled = true;
  const unlaid = place(button('Invisible'), 500, 300, 0, 0);
  ui.append(off, unlaid);
  let picks = 0;
  onPick(off, () => picks++);
  onPick(unlaid, () => picks++);

  hand(640 / innerWidth, 340 / innerHeight);
  for (let i = 0; i < 20; i++) cursor.update(0.1, ui);
  assert.equal(picks, 0);
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

test('a disabled cursor clears any half-filled button', () => {
  const ui = setup();
  const b = place(button('Play'), 500, 300, 280, 80);
  ui.appendChild(b);
  const c = centreOf(b);
  hand(c.x, c.y);
  for (let i = 0; i < 5; i++) cursor.update(0.1, ui);
  assert.equal(b.classList.contains('hot'), true);

  cursor.enabled = false;
  cursor.update(0.1, ui);
  assert.equal(b.classList.contains('hot'), false);
  assert.equal(b.querySelector('.fill').style.transform, 'scaleX(0)');
  cursor.enabled = true;
});
