import test from 'node:test';
import assert from 'node:assert/strict';
import { FaceCam, forgetFaces, enhance, STEADY, FORGET, LATE } from '../src/ui/faces.js';
import { pose, L } from '../src/tracking/pose.js';

/* A stand-in for a canvas to take the picture into. */
globalThis.OffscreenCanvas ??= class { constructor(w, h){ this.width = w; this.height = h; } getContext(){ return { drawImage(){} }; } };

const DT = 1 / 30;
/* The camera, live, and player i's face at x, looking `turn` eye-widths
   off straight on. */
function camera(){
  pose.usingCamera = true;
  pose.video = { readyState: 2, videoWidth: 640, videoHeight: 480 };
}
function face(i, x = 0.5, turn = 0){
  const lm = Array.from({ length: 33 }, () => ({ x, y: 0.5, v: 0.9 }));
  const at = (j, dx, dy) => { lm[j] = { x: x + dx, y: 0.3 + dy, v: 0.9 }; };
  at(L.NOSE, turn * 0.04, 0); at(L.L_EYE, 0.02, -0.02); at(L.R_EYE, -0.02, -0.02); at(7, 0.045, -0.01); at(8, -0.045, -0.01);
  const p = pose.players[i];
  p.present = true; p.lm = lm;
}
const run = (cam, secs) => { for (let t = 0; t < secs; t += DT) cam.step(DT); };

test('a face held steady and straight on is snapped, once, and kept', () => {
  forgetFaces(); camera();
  pose.players.forEach(p => { p.present = false; });
  const cam = new FaceCam();
  face(0);
  run(cam, STEADY * 0.5);
  assert.equal(cam.has(0), false, 'not straight away');
  run(cam, STEADY);
  assert.equal(cam.has(0), true, 'snapped');
  pose.video = null; pose.usingCamera = false;
  assert.equal(cam.has(0), true, 'the picture stays, camera or no camera');
});

test('a face turned right away is never snapped', () => {
  forgetFaces(); camera();
  pose.players.forEach(p => { p.present = false; });
  const cam = new FaceCam();
  face(0, 0.5, 1.5);
  run(cam, LATE * 2);
  assert.equal(cam.has(0), false);
});

test('a face that is never quite still - marching, bouncing - is still snapped, soon enough', () => {
  forgetFaces(); camera();
  pose.players.forEach(p => { p.present = false; });
  const cam = new FaceCam();
  /* Bobbing up and down a lot, and a bit turned. */
  for (let t = 0; t < LATE + 0.5; t += DT){
    face(0, 0.5 + Math.sin(t * 13) * 0.03, 0.45);
    pose.players[0].lm.forEach(q => { q.y += Math.sin(t * 13) * 0.03; });
    cam.step(DT);
  }
  assert.equal(cam.has(0), true);
});

test('a little bob while marching does not stop a good picture', () => {
  forgetFaces(); camera();
  pose.players.forEach(p => { p.present = false; });
  const cam = new FaceCam();
  for (let t = 0; t < 1; t += DT){ face(0); pose.players[0].lm.forEach(q => { q.y += Math.sin(t * 12) * 0.003; }); cam.step(DT); }
  assert.equal(cam.has(0), true);
});

test('the picture is for the whole session, in every game', () => {
  forgetFaces(); camera();
  pose.players.forEach(p => { p.present = false; });
  const a = new FaceCam();
  face(1);
  run(a, STEADY * 2);
  assert.equal(new FaceCam().has(1), true, 'the next game has it too');
});

test('someone who joins later is snapped when they come in', () => {
  forgetFaces(); camera();
  pose.players.forEach(p => { p.present = false; });
  const cam = new FaceCam();
  face(0); run(cam, STEADY * 2);
  assert.equal(cam.has(1), false);
  face(1, 0.3); run(cam, STEADY * 2);
  assert.equal(cam.has(1), true);
});

test('a child gone a while is forgotten, so the next one gets their own picture', () => {
  forgetFaces(); camera();
  pose.players.forEach(p => { p.present = false; });
  const cam = new FaceCam();
  face(0); run(cam, STEADY * 2);
  pose.players[0].present = false;
  run(cam, FORGET * 0.5);
  assert.equal(cam.has(0), true, 'a moment out of view is fine');
  run(cam, FORGET);
  assert.equal(cam.has(0), false, 'forgotten');
  face(0); run(cam, STEADY * 2);
  assert.equal(cam.has(0), true, 'and snapped afresh');
});

/* A made-up face photo, grainy: a face in the middle on a background,
   an eye in the face, and webcam noise over everything. */
function photo(n = 48){
  const d = new Uint8ClampedArray(n * n * 4);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){
    const dx = x / n - 0.5, dy = y / n - 0.5;
    let c = [90, 110, 140];
    if (dx * dx + dy * dy < 0.12) c = [210, 165, 135];
    if (Math.abs(dx - 0.1) < 0.05 && Math.abs(dy + 0.05) < 0.04) c = [40, 30, 30];
    const g = (rnd() - 0.5) * 40;
    d.set([c[0] + g, c[1] + g, c[2] + g, 255], (y * n + x) * 4);
  }
  return d;
}
/* How grainy a patch of skin is: how much it varies. */
function grain(d, n){
  const v = [];
  for (let y = 22; y < 30; y++) for (let x = 14; x < 22; x++) v.push(d[(y * n + x) * 4]);
  const m = v.reduce((a, b) => a + b) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length);
}

test('a face picture is cleaned up: the grain smoothed away, the eye still sharp', () => {
  const n = 48, before = photo(n), after = enhance(photo(n), n, n);
  assert.ok(grain(after, n) < grain(before, n) * 0.5, `grain ${grain(before, n)} -> ${grain(after, n)}`);
  /* The eye stays dark against the skin around it. */
  const at = (d, x, y) => d[(y * n + x) * 4];
  assert.ok(at(after, 28, 21) < 90 && at(after, 21, 30) > 160 && at(after, 21, 30) < 250, `eye ${at(after, 28, 21)}, cheek ${at(after, 21, 30)}`);
});
