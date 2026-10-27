import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, L, seated, onePerPerson, faceSeen, WATCH_AFTER, JOIN_AFTER } from '../src/tracking/pose.js';

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
  pose._cands = [];
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
  const A = person(0.8), B = person(0.2);

  arrive([B, A]);   /* order from the model is arbitrary */

  assert.equal(pose.personCount, 2);
  assert.ok(screenX(pose.players[0]) < 0.5, 'player 0 should be on screen-left');
  assert.ok(screenX(pose.players[1]) > 0.5, 'player 1 should be on screen-right');
  assert.ok(Math.abs(screenX(pose.players[0]) - 0.2) < 1e-9, 'x should be mirrored');
});

test('a player who leaves frame is aged out, not forgotten instantly', () => {
  resetPose();
  pose.ready = true;
  pose.video = { readyState: 2, currentTime: 1 };
  arrive([person(0.5)]);
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
  localStorage.setItem('astrapark_camera', 'cam-abc');
  assert.equal(pose.preferred(), 'cam-abc');
});

/* ---------- players and watchers ---------- */

/* A person as the camera reports them (raw, unmirrored): hips at camera x,
   torso `size` tall, standing or sitting, knees visible or not. */
function person(x, { size = 0.2, sit = false, knees = true, y = 0.5 } = {}){
  const lm = body();
  const set = (k, px, py, v = 0.9) => { lm[L[k]] = { x: px, y: py, z: 0, v, visibility: v }; };
  const sh = y - size, kneeY = sit ? y + size * 0.1 : y + size * 0.9;
  set('NOSE', x, sh - size * 0.35);
  set('L_SHOULDER', x - size * 0.2, sh); set('R_SHOULDER', x + size * 0.2, sh);
  set('L_HIP', x - size * 0.12, y); set('R_HIP', x + size * 0.12, y);
  set('L_KNEE', x - size * 0.12, kneeY, knees ? 0.9 : 0.1); set('R_KNEE', x + size * 0.12, kneeY, knees ? 0.9 : 0.1);
  set('L_WRIST', x - size * 0.3, y); set('R_WRIST', x + size * 0.3, y);
  lm.forEach(k => { k.visibility = k.v; });
  return lm;
}
let frame = 10;
function see(people, dt = 0.05){
  pose.ready = true; pose.mouse.active = false;
  pose.video = { readyState: 2, currentTime: ++frame };
  pose.lm = { detectForVideo: () => ({ landmarks: people }) };
  pose.update(frame * 50, dt);
}
const screenX = (p) => (p.lm[L.L_HIP].x + p.lm[L.R_HIP].x) / 2;
/* People walk in and stay a moment, long enough to join. */
function arrive(people){ for (let t = 0; t < JOIN_AFTER + 0.1; t += 0.05) see(people); }

test('sitting is told from standing by how far the knees drop below the hips', () => {
  const m = (lm) => lm.map(k => ({ ...k, v: k.visibility }));
  assert.equal(seated(m(person(0.5))), false);
  assert.equal(seated(m(person(0.5, { sit: true }))), true);
  assert.equal(seated(m(person(0.5, { knees: false }))), false, 'no knees in sight: assume standing');
});

test('someone sitting on the sofa is a watcher, not a player', () => {
  resetPose();
  arrive([person(0.3), person(0.75, { sit: true })]);
  assert.equal(pose.personCount, 1);
  assert.equal(pose.seenCount, 2);
  assert.ok(Math.abs(screenX(pose.players[0]) - 0.7) < 0.02, 'the standing child is player one');
  assert.equal(pose.players[1].present, false);
});

test('someone standing far behind is a watcher; on their own, they play', () => {
  resetPose();
  arrive([person(0.6, { size: 0.22 }), person(0.2, { size: 0.08 })]);
  assert.equal(pose.personCount, 1);
  assert.ok(Math.abs(screenX(pose.players[0]) - 0.4) < 0.02);
  resetPose();
  arrive([person(0.2, { size: 0.08 })]);
  assert.equal(pose.personCount, 1, 'nobody closer, so they are the player');
});

test('a watcher on the left does not take player one from a child', () => {
  resetPose();
  /* Raw x 0.8 is screen-left after mirroring. */
  arrive([person(0.8, { sit: true }), person(0.3)]);
  assert.equal(pose.personCount, 1);
  assert.ok(Math.abs(screenX(pose.players[0]) - 0.7) < 0.02);
});

test('a player who squats stays in; one who sits down a while becomes a watcher', () => {
  resetPose();
  arrive([person(0.5)]);
  assert.equal(pose.players[0].present, true);
  for (let t = 0; t < WATCH_AFTER * 0.6; t += 0.05) see([person(0.5, { sit: true })]);
  assert.equal(pose.players[0].present, true, 'a squat is not leaving');
  see([person(0.5)]);
  for (let t = 0; t < WATCH_AFTER + 0.5; t += 0.05) see([person(0.5, { sit: true })]);
  assert.equal(pose.players[0].present, false, 'sat down for good');
  assert.equal(pose.personCount, 0);
});

test('players keep their place when they cross over', () => {
  resetPose();
  arrive([person(0.7), person(0.3)]);
  const leftFirst = screenX(pose.players[0]);
  assert.ok(leftFirst < 0.5, 'player one starts on the left');
  /* They walk past each other in strides, so at the crossing each lands
     right where the other just was. */
  for (let k = 1; k <= 9; k++){ const u = k / 9; see([person(0.7 - 0.4 * u), person(0.3 + 0.4 * u)]); }
  assert.ok(screenX(pose.players[0]) > 0.5, 'player one is now on the right, still player one');
});

test('a newcomer standing up front joins an empty place', () => {
  resetPose();
  arrive([person(0.5)]);
  assert.equal(pose.personCount, 1);
  arrive([person(0.5), person(0.15)]);
  assert.equal(pose.personCount, 2);
  assert.equal(pose.players[1].present, true);
});

test('one person reported twice is one player', () => {
  resetPose();
  /* Two skeletons a whisker apart: the model seeing the same child twice. */
  const a = person(0.5), b = person(0.51, { size: 0.21 });
  arrive([a, b]);
  assert.equal(pose.seenCount, 1);
  assert.equal(pose.personCount, 1);
  assert.equal(pose.players[1].present, false);
  /* Two children side by side are still two. */
  resetPose();
  arrive([person(0.35), person(0.62)]);
  assert.equal(pose.personCount, 2);
});

test('the clearer of two twin skeletons is the one kept', () => {
  const m = (lm) => lm.map(k => ({ ...k, v: k.visibility }));
  const clear = m(person(0.5)), faint = m(person(0.505)).map(k => ({ ...k, v: 0.3 }));
  const kept = onePerPerson([faint, clear]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0], clear);
});

/* ---------- phantoms ---------- */

test('something with no clear face never joins', () => {
  resetPose();
  /* A coat on a chair: body-shaped, but no face to speak of. */
  const coat = person(0.5);
  for (const k of ['NOSE', 'L_EYE', 'R_EYE']) coat[L[k]] = { ...coat[L[k]], v: 0.2, visibility: 0.2 };
  for (let t = 0; t < 3; t += 0.05) see([coat]);
  assert.equal(pose.personCount, 0);
  assert.equal(pose.seenCount, 1, 'seen, just not playing');
});

test('a glitch that flickers for a few frames never joins', () => {
  resetPose();
  for (let k = 0; k < 6; k++){ see([person(0.5)]); see([person(0.5)]); see([]); see([]); see([]); see([]); see([]); see([]); }
  assert.equal(pose.personCount, 0);
});

test('a child joins after half a second in view, not before', () => {
  resetPose();
  for (let t = 0; t < JOIN_AFTER - 0.15; t += 0.05) see([person(0.5)]);
  assert.equal(pose.personCount, 0, 'not yet');
  for (let t = 0; t < 0.3; t += 0.05) see([person(0.5)]);
  assert.equal(pose.personCount, 1);
});

test('a player who turns away stays a player', () => {
  resetPose();
  arrive([person(0.5)]);
  const back = person(0.5);
  for (const k of ['NOSE', 'L_EYE', 'R_EYE']) back[L[k]] = { ...back[L[k]], v: 0.1, visibility: 0.1 };
  for (let t = 0; t < 3; t += 0.05) see([back]);
  assert.equal(pose.players[0].present, true);
});

test('a face needs the nose, an eye, and the head above the shoulders', () => {
  const m = (lm) => lm.map(k => ({ ...k, v: k.visibility }));
  assert.equal(faceSeen(m(person(0.5))), true);
  const oneEye = m(person(0.5)); oneEye[L.L_EYE] = { ...oneEye[L.L_EYE], v: 0.1 };
  assert.equal(faceSeen(oneEye), true, 'side on is fine');
  const noEyes = m(person(0.5)); noEyes[L.L_EYE].v = 0.1; noEyes[L.R_EYE].v = 0.1;
  assert.equal(faceSeen(noEyes), false);
  const upside = m(person(0.5)); upside[L.NOSE] = { ...upside[L.NOSE], y: 0.9 };
  assert.equal(faceSeen(upside), false, 'a "head" below the shoulders is not a head');
});
