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
  assert.ok(main.includes('app.config().product_name') && main.includes('.title(&title)'), 'the window is titled with the app\'s name');
});

test('the game window is the one the permissions are written for', () => {
  const caps = JSON.parse(read('src-tauri/capabilities/default.json'));
  assert.ok(main.includes('WebviewWindowBuilder::new(app, "main"'));
  assert.deepEqual(caps.windows, ['main']);
  assert.ok(caps.permissions.includes('core:window:allow-close'), 'the menu\'s Exit needs this');
});

test('display modes: a window or Big Picture, kept, with a default for new installs', () => {
  assert.match(main, /const DEFAULT_MODE: &str = "(window|bigpicture)";/);
  assert.ok(main.includes('const MODES: &[&str] = &["window", "bigpicture"]'));
  assert.ok(main.includes('generate_handler![set_display_mode') && main.includes('display.json'));
  assert.ok(main.includes(".fullscreen(mode == \"bigpicture\")"), 'opens in the mode chosen');
  const menu = readFileSync(new URL('../src/ui/menu.js', import.meta.url), 'utf8');
  assert.ok(menu.includes("window.orlisDisplay") && menu.includes("'Big Picture'"), 'Settings offers both');
});

test('Settings can check for an update and install it now', () => {
  assert.ok(main.includes('generate_handler![set_display_mode, check_update, install_update]'));
  assert.ok(main.includes('window.ORLIS_VERSION') && main.includes('window.orlisApp'));
  const menu = readFileSync(new URL('../src/ui/menu.js', import.meta.url), 'utf8');
  assert.ok(menu.includes("'Check for updates'") && menu.includes('installUpdate()') && menu.includes('checkUpdate()'));
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
  assert.ok(wf.includes('Orlis-Play-Setup.exe') && wf.includes('Orlis-Play-Beta-Setup.exe'), 'each channel\'s installer at an address that never changes');
  assert.ok(wf.includes('"identifier":"com.orlisplay.client.beta"') && wf.includes('releases/download/beta/latest.json'), 'the beta is its own app, updating from its own channel');
  assert.ok(/options: \[beta, release\]/.test(wf) && wf.includes("inputs.channel || 'beta'"), 'pushes make betas; a release is only ever by hand');
});

test('the camera is allowed without a prompt, and the game uses the files it carries', () => {
  assert.ok(main.includes('COREWEBVIEW2_PERMISSION_KIND_CAMERA') && main.includes('allow_camera(&window)'));
  assert.ok(main.includes('window.ORLIS_LOCAL = true'));
  const pose = readFileSync(new URL('../src/tracking/pose.js', import.meta.url), 'utf8');
  assert.ok(pose.includes('window.ORLIS_LOCAL'), 'pose.js takes the hint');
});
