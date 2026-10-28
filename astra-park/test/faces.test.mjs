import test from 'node:test';
import assert from 'node:assert/strict';
import { FaceCam, forgetFaces, STEADY, FORGET } from '../src/ui/faces.js';
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

test('a face turned away is not snapped', () => {
  forgetFaces(); camera();
  pose.players.forEach(p => { p.present = false; });
  const cam = new FaceCam();
  face(0, 0.5, 0.6);
  run(cam, STEADY * 4);
  assert.equal(cam.has(0), false);
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
