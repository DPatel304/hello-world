'use strict';
/* End-to-end test of the actual app, not of the HTML in a browser. Playwright
   launches the real Electron binary with a .y4m file standing in for the
   webcam, so what is exercised is the shell, the permission handler and the
   vision pipeline together. */
const { _electron: electron } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const CLIP = path.join(__dirname, '.clips', 'demo.y4m');

let pass = 0, fail = 0;
const R = [];
const ok = (name, cond, note) => {
  cond ? pass++ : fail++;
  R.push((cond ? '  PASS  ' : '* FAIL  ') + name + (note ? '   (' + note + ')' : ''));
};

function clip(){
  if (fs.existsSync(CLIP)) return;
  console.log('generating camera footage (once, ~30s)...');
  execFileSync('python3', [path.join(__dirname, 'mkclip.py'), CLIP, '15', '9.4'], { stdio: 'inherit' });
}

async function main(){
  clip();
  const app = await electron.launch({
    /* Deliberately NOT --use-fake-ui-for-media-stream: that auto-accepts the
       permission prompt, which would hide whether the app's own permission
       handler works. The handler is the thing under test. */
    args: ['.', '--use-fake-device-for-media-stream',
           '--use-file-for-fake-video-capture=' + CLIP],
    cwd: ROOT
  });

  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', e => errs.push(e.message));

  await win.waitForLoadState('domcontentloaded');

  ok('the app opens a window', !!win);
  ok('it loads the game, not a blank page',
     (await win.title()) === 'ViveCube', await win.title());
  ok('the shell bridge reaches the game',
     await win.evaluate(() => !!(window.viveShell && window.viveShell.isApp)));
  ok('the game has no access to node',
     await win.evaluate(() => typeof require === 'undefined' && typeof process === 'undefined'));
  ok('it starts fullscreen',
     await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()));
  ok('the menu bar is gone',
     await app.evaluate(({ Menu }) => Menu.getApplicationMenu() === null));
  ok('the display is held awake',
     await app.evaluate(({ powerSaveBlocker }) =>
       powerSaveBlocker.isStarted(0) || powerSaveBlocker.isStarted(1)));

  /* The real question: does the camera open without anyone clicking Allow?
     Entry is through the title screen's play button, which is the only way in
     for a real player. */
  ok('the title screen is up before play', await win.isVisible('#title'));
  ok('the wordmark spells the name',
     (await win.textContent('#wordmark')) === 'ViveCube', await win.textContent('#wordmark'));
  await win.click('#btn-play');
  ok('pressing play clears the title screen', !(await win.isVisible('#title')));
  await win.waitForTimeout(4200);
  const cap = await win.textContent('#d-cap');
  ok('the camera opens with no permission prompt', /\d+×\d+/.test(cap || ''), cap);

  const samples = [];
  for (let i = 0; i < 40; i++){
    samples.push(await win.evaluate(() => {
      const v = window.ViveCube.vision();
      return { c: v.coverage, ms: v.visMs, grab: v.grabMs, pixel: v.pixelMs,
               e2e: v.e2eMs, fps: v.fps, painted: window.ViveCube.state().painted };
    }));
    await win.waitForTimeout(100);
  }
  const avg = k => samples.reduce((a, s) => a + s[k], 0) / samples.length;
  const last = samples[samples.length - 1];

  ok('it sees the players move', avg('c') > 0.02, (avg('c') * 100).toFixed(1) + '% mean coverage');
  ok('moving paints', last.painted > 0.05, (last.painted * 100).toFixed(1) + '% of canvas');
  /* Split, because only one half is the pipeline's own cost. The frame grab
     ends in a GPU-to-CPU readback and is whatever the machine's graphics stack
     charges - under Xvfb's software rendering that is most of the frame. The
     pixel work is a flat loop over 19,200 bytes and must hold anywhere. */
  console.log('   frame grab ' + avg('grab').toFixed(2) + 'ms + pixel work ' +
              avg('pixel').toFixed(2) + 'ms = ' + avg('ms').toFixed(2) + 'ms');
  ok('the pixel work stays cheap', avg('pixel') < 3, avg('pixel').toFixed(2) + 'ms');
  ok('the whole of vision leaves room in the frame', avg('ms') < 10, avg('ms').toFixed(2) + 'ms');
  ok('the whole frame fits one 60fps slot', avg('e2e') < 16.7, avg('e2e').toFixed(2) + 'ms');
  ok('it holds frame rate in the app shell', avg('fps') > 50, avg('fps').toFixed(0) + ' fps');

  /* Toddler-proofing: the keys that would end the game are swallowed. */
  const before = await win.evaluate(() => window.ViveCube.state().painted);
  for (const k of ['F5', 'Control+r', 'Control+w', 'Control+Shift+I']){
    await win.keyboard.press(k);
  }
  await win.waitForTimeout(600);
  const stillUp = app.windows().length === 1;
  const after = await win.evaluate(() => window.ViveCube.state().painted).catch(() => -1);
  ok('reload and close keys do not end the game', stillUp && after >= 0,
     stillUp ? 'window survived, painting at ' + (after * 100).toFixed(1) + '%' : 'window gone');
  ok('the painting survived the key mashing', after >= before - 0.02,
     (before * 100).toFixed(1) + '% -> ' + (after * 100).toFixed(1) + '%');

  /* A tapped Escape must not quit; only a held one. */
  await win.keyboard.press('Escape');
  await win.waitForTimeout(500);
  ok('a tapped Escape does not quit', app.windows().length === 1);

  ok('no JS errors', errs.length === 0, errs.join('; ') || 'clean');

  await app.close();

  console.log('\n' + R.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
