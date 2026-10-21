import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, L } from '../src/tracking/pose.js';

/* A full set of landmarks, all plainly visible, with named overrides. */
function body(over = {}){
  const lm = Array.from({ length: 33 }, () => ({ x:0.5, y:0.5, z:0, v:0.9 }));
  for (const [name, patch] of Object.entries(over)) lm[L[name]] = { ...lm[L[name]], ...patch };
  return lm;
}

function freshPlayer(lm = body()){
  return { id:0, present:true, lostFor:0, lm,
           hands:{ left:{x:.5,y:.5,vx:0,vy:0,speed:0}, right:{x:.5,y:.5,vx:0,vy:0,speed:0} },
           centre:{x:.5,y:.5}, scale:0.3 };
}

function resetPose(){
  pose.mouse.active = false;
  pose.ready = false;
  pose.personCount = 0;
  pose._lastT = undefined;
  pose._since = 0;
  pose._hits = 0;
  for (let i = 0; i < 2; i++){
    pose.players[i].lm = null;
    pose.players[i].present = false;
    pose.players[i].lostFor = 99;
    pose.players[i].hands.left  = { x:.5, y:.5, vx:0, vy:0, speed:0 };
    pose.players[i].hands.right = { x:.5, y:.5, vx:0, vy:0, speed:0 };
  }
}

test('fullBody accepts a whole person', () => {
  resetPose();
  assert.equal(pose.fullBody(freshPlayer()), true);
});

/* The regression that stranded people on the calibration screen with a camera
   that could plainly see them: ankle visibility on a standing figure swings
   between about 0.26 and 0.93, so a gate demanding confident ankles never
   closes. Knees carry the same information and are steadier. */
test('fullBody passes on flickering ankles when a knee is visible', () => {
  resetPose();
  const p = freshPlayer(body({
    L_ANKLE:{ v:0.26 }, R_ANKLE:{ v:0.21 },
    L_KNEE: { v:0.62 }, R_KNEE: { v:0.58 }
  }));
  assert.equal(pose.fullBody(p), true);
});

test('fullBody rejects a person with no legs in frame', () => {
  resetPose();
  const p = freshPlayer(body({
    L_ANKLE:{ v:0.1 }, R_ANKLE:{ v:0.1 }, L_KNEE:{ v:0.1 }, R_KNEE:{ v:0.1 }
  }));
  assert.equal(pose.fullBody(p), false);
});

test('fullBody rejects a head cropped out of frame', () => {
  resetPose();
  assert.equal(pose.fullBody(freshPlayer(body({ NOSE:{ y:0.995 } }))), false);
  assert.equal(pose.fullBody(freshPlayer(body({ NOSE:{ y:0.01 } }))),  false);
});

test('fullBody rejects a player who is not present', () => {
  resetPose();
  const p = freshPlayer();
  p.present = false;
  assert.equal(pose.fullBody(p), false);
  p.present = true; p.lm = null;
  assert.equal(pose.fullBody(p), false);
});

/* Hand speed is in screen-widths per second so the same swing scores the same
   on any size of television. */
test('hand speed is normalised to screen widths per second', () => {
  const h = { x:0.5, y:0.5, vx:0, vy:0, speed:0 };
  pose._hand(h, { x:0.6, y:0.5 }, 0.1);
  assert.ok(Math.abs(h.vx - 1) < 1e-9, 'vx should be 1.0 widths/sec, got ' + h.vx);
  assert.ok(Math.abs(h.speed - 1) < 1e-9);
  assert.equal(h.x, 0.6);
});

test('hand speed survives a zero dt', () => {
  const h = { x:0.5, y:0.5, vx:0, vy:0, speed:0 };
  pose._hand(h, { x:0.6, y:0.5 }, 0);
  assert.ok(Number.isFinite(h.vx), 'vx must not be Infinity on a zero dt');
});

/* Without ageing here, a frozen or unplugged camera leaves everyone marked
   present forever and the game waits on a motionless person who is not there. */
test('a stalled camera eventually drops the player', () => {
  resetPose();
  const p = pose.players[0];
  p.present = true; p.lostFor = 0;
  for (let i = 0; i < 20; i++) pose._decay(0.05);      /* 1.0s */
  assert.equal(p.present, true, 'should survive a brief stall');
  for (let i = 0; i < 60; i++) pose._decay(0.05);      /* 4.0s total */
  assert.equal(p.present, false, 'should be gone after a long stall');
});

test('cursorHand falls back to the hand the camera can actually see', () => {
  resetPose();
  const p = freshPlayer(body({ R_WRIST:{ v:0.15 }, L_WRIST:{ v:0.92 } }));
  assert.equal(pose.cursorHand(p), p.hands.left);

  const q = freshPlayer(body({ R_WRIST:{ v:0.92 }, L_WRIST:{ v:0.15 } }));
  assert.equal(pose.cursorHand(q), q.hands.right);
});

test('cursorHand uses the mouse hand in mouse mode', () => {
  resetPose();
  pose.mouse.active = true;
  const p = freshPlayer(body({ R_WRIST:{ v:0.01 }, L_WRIST:{ v:0.99 } }));
  assert.equal(pose.cursorHand(p), p.hands.right);
  pose.mouse.active = false;
});

/* Left-to-right on screen decides who is P1, and landmarks are mirrored so
   screen left is the player's own left as they face the television. */
test('players are assigned left to right after mirroring', () => {
  resetPose();
  pose.ready = true;
  pose.video = { readyState: 2, currentTime: 1 };

  /* Raw camera x: A on the right of frame, B on the left. Mirroring puts A on
     screen-left, so A must become player 0. */
  const A = body({ L_HIP:{ x:0.80 }, R_HIP:{ x:0.80 } });
  const B = body({ L_HIP:{ x:0.20 }, R_HIP:{ x:0.20 } });
  for (const lm of [A, B]) lm.forEach(k => { k.visibility = k.v; });

  pose.lm = { detectForVideo: () => ({ landmarks: [B, A] }) };   /* order from the model is arbitrary */
  pose.update(0, 0.016);

  assert.equal(pose.personCount, 2);
  assert.ok(pose.players[0].lm[L.L_HIP].x < 0.5, 'player 0 should be on screen-left');
  assert.ok(pose.players[1].lm[L.L_HIP].x > 0.5, 'player 1 should be on screen-right');
  assert.ok(Math.abs(pose.players[0].lm[L.L_HIP].x - 0.2) < 1e-9, 'x should be mirrored');
});

test('a player who leaves frame is aged out, not forgotten instantly', () => {
  resetPose();
  pose.ready = true;
  pose.video = { readyState: 2, currentTime: 1 };
  const one = body();
  one.forEach(k => { k.visibility = k.v; });
  pose.lm = { detectForVideo: () => ({ landmarks: [one] }) };

  pose.video.currentTime = 1; pose.update(0, 0.016);
  assert.equal(pose.players[0].present, true);

  /* Second player was never there and must stay absent. */
  assert.equal(pose.players[1].present, false);

  pose.lm = { detectForVideo: () => ({ landmarks: [] }) };
  pose.video.currentTime = 2; pose.update(16, 0.3);
  assert.equal(pose.players[0].present, true, 'one dropped frame is not a departure');
  pose.video.currentTime = 3; pose.update(32, 0.5);
  assert.equal(pose.players[0].present, false, 'sustained absence is');
});

test('mouse mode drives player one and leaves player two absent', () => {
  resetPose();
  pose.mouse.active = true;
  pose.mouse.x = 0.25; pose.mouse.y = 0.4;
  pose.update(0, 0.016);
  assert.equal(pose.players[0].present, true);
  assert.equal(pose.players[1].present, false);
  assert.equal(pose.personCount, 1);
  assert.equal(pose.players[0].hands.right.x, 0.25);
  pose.mouse.active = false;
});

test('preferred camera round-trips through storage', () => {
  localStorage.clear();
  assert.equal(pose.preferred(), '');
  localStorage.setItem('famjam_camera', 'cam-abc');
  assert.equal(pose.preferred(), 'cam-abc');
});
