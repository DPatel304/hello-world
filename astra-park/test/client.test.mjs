import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* The Windows app (client/) can't be built here, so these guard the ways it
   would break quietly: the wrong name or window, the music folder not
   reachable, updates that can't be checked, the camera not allowed. */
const read = (f) => readFileSync(new URL(`../client/${f}`, import.meta.url), 'utf8');
const conf = JSON.parse(read('src-tauri/tauri.conf.json'));
const main = read('src-tauri/src/main.rs');

test('the app is Orlis Play, carrying the game files built into client/dist', () => {
  assert.equal(conf.productName, 'Orlis Play');
  assert.equal(conf.build.frontendDist, '../dist');
  assert.ok(conf.bundle.targets.includes('nsis'), 'a Windows installer');
  assert.ok(main.includes('.title("Orlis Play")'));
});

test('the game window is the one the permissions are written for', () => {
  const caps = JSON.parse(read('src-tauri/capabilities/default.json'));
  assert.ok(main.includes('WebviewWindowBuilder::new(app, "main"'));
  assert.deepEqual(caps.windows, ['main']);
  assert.ok(caps.permissions.includes('core:window:allow-set-fullscreen'), 'F11 needs this');
});

test('the music folder is the only place on disk the game can read', () => {
  assert.equal(conf.app.security.assetProtocol.enable, true);
  assert.deepEqual(conf.app.security.assetProtocol.scope, ['$AUDIO/Orlis Play/**']);
  assert.ok(main.includes('join("Orlis Play")'));
  assert.ok(main.includes('window.ASTRA_MUSIC'), 'hands the songs to the game the way it reads them');
});

test('updates are signed, and checked where the release workflow publishes them', () => {
  const up = conf.plugins.updater;
  assert.ok(up.pubkey && up.pubkey.length > 100, 'the public half of the signing key');
  assert.ok(up.endpoints.some(e => e.endsWith('/releases/latest/download/latest.json')));
  const wf = readFileSync(new URL('../../.github/workflows/orlis-play-windows.yml', import.meta.url), 'utf8');
  assert.ok(wf.includes('includeUpdaterJson: true') && wf.includes('TAURI_SIGNING_PRIVATE_KEY'));
  assert.ok(wf.includes('Orlis-Play-Setup.exe'), 'the installer at an address that never changes');
});

test('the camera is allowed without a prompt, and the game uses the files it carries', () => {
  assert.ok(main.includes('COREWEBVIEW2_PERMISSION_KIND_CAMERA') && main.includes('allow_camera(&window)'));
  assert.ok(main.includes('window.ORLIS_LOCAL = true'));
  const pose = readFileSync(new URL('../src/tracking/pose.js', import.meta.url), 'utf8');
  assert.ok(pose.includes('window.ORLIS_LOCAL'), 'pose.js takes the hint');
});
