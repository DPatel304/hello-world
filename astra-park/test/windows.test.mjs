import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* The Windows launcher can't be run here, so these guard the ways it breaks
   on arrival rather than in logic: Windows PowerShell 5.1 reads a script
   without a BOM in the local code page, so one curly quote garbles it, and
   cmd.exe misreads a batch file with bare LF line endings. */
const read = (f) => readFileSync(new URL(`../windows/${f}`, import.meta.url));

test('the PowerShell scripts are plain ASCII', () => {
  for (const f of ['setup.ps1', 'launch.ps1']){
    const bad = [...read(f)].findIndex(b => b > 0x7f);
    assert.equal(bad, -1, `${f}: non-ASCII byte at offset ${bad}`);
  }
});

test('the batch file and read-me use CRLF line endings', () => {
  for (const f of ['Set up Astra Park.bat', 'Read me.txt', 'setup.ps1', 'launch.ps1']){
    const s = read(f).toString('latin1');
    assert.ok(!/[^\r]\n/.test(s), `${f} has a bare LF`);
  }
});

test('the launcher opens the game the way it is meant to', () => {
  const s = read('launch.ps1').toString();
  for (const flag of ['--user-data-dir=', '--app=', '--start-fullscreen',
                      '--autoplay-policy=no-user-gesture-required',
                      '--use-fake-ui-for-media-stream', '--no-first-run']){
    assert.ok(s.includes(flag), `missing ${flag}`);
  }
  /* $PROFILE is a PowerShell automatic variable, and names are not case
     sensitive: a variable called $profile would shadow it. */
  for (const f of ['setup.ps1', 'launch.ps1']){
    assert.ok(!/\$profile\b/i.test(read(f).toString()), `${f} uses $profile, which collides with $PROFILE`);
  }
});

test('the launcher only installs a download that is plainly the game', () => {
  const s = read('launch.ps1').toString();
  const title = readFileSync(new URL('../build-single.mjs', import.meta.url), 'utf8').match(/<title>[^<]+<\/title>/)[0];
  assert.ok(s.includes(`'${title}'`), `launcher should check for ${title}, the title the build writes`);
  assert.ok(s.includes("'__REPO__'") && s.includes("'__BRANCH__'"),
    'the repo copy keeps its placeholders; package.mjs fills them per build');
});

test('the launcher lists the music folder into playlist.js for the game', () => {
  const s = read('launch.ps1').toString();
  assert.ok(s.includes("GetFolderPath('MyMusic')") && s.includes("'Astra Park'"), 'reads Music\\Astra Park');
  assert.ok(s.includes('window.ASTRA_MUSIC') && s.includes("'playlist.js'"), 'writes the playlist the game reads');
  for (const ext of ['mp3', 'm4a', 'wav', 'flac', 'ogg']) assert.ok(s.includes(ext), `accepts .${ext}`);
  const build = readFileSync(new URL('../build-single.mjs', import.meta.url), 'utf8');
  assert.ok(build.includes('src="playlist.js"'), 'the built game loads the playlist');
});
