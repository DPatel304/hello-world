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
  for (const f of ['Set up MoveCube.bat', 'Read me.txt', 'setup.ps1', 'launch.ps1']){
    const s = read(f).toString('latin1');
    assert.ok(!/[^\r]\n/.test(s), `${f} has a bare LF`);
  }
});

test('the launcher opens the game the way it is meant to', () => {
  const s = read('launch.ps1').toString();
  for (const flag of ['--user-data-dir=', '--app=', '--start-fullscreen',
                      '--autoplay-policy=no-user-gesture-required',
                      '--use-fake-ui-for-media-stream', '--no-first-run', '--test-type']){
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
  assert.ok(s.includes("GetFolderPath('MyMusic')") && s.includes("'MoveCube'"), 'reads Music\\MoveCube');
  assert.ok(s.includes("'Astra Park'"), 'or the old Astra Park folder, if setup has not moved it yet');
  assert.ok(s.includes('window.ASTRA_MUSIC') && s.includes("'playlist.js'"), 'writes the playlist the game reads');
  for (const ext of ['mp3', 'm4a', 'wav', 'flac', 'ogg']) assert.ok(s.includes(ext), `accepts .${ext}`);
  const build = readFileSync(new URL('../build-single.mjs', import.meta.url), 'utf8');
  assert.ok(build.includes('src="playlist.js"'), 'the built game loads the playlist');
});

test('setup renames Astra Park to MoveCube: new shortcuts, old ones gone, the music folder moved', () => {
  const s = read('setup.ps1').toString();
  assert.ok(s.includes("'MoveCube.lnk'") && s.includes("'MoveCube Music.lnk'"), 'MoveCube shortcuts');
  assert.ok(s.includes("'Astra Park.lnk'") && s.includes("'Astra Park Music.lnk'") && s.includes('Remove-Item'), 'the old shortcuts removed');
  assert.ok(s.includes('Move-Item -LiteralPath $oldMusic'), 'the old music folder moved over');
  assert.ok(s.includes("'movecube.ico'"), 'the cube icon');
  assert.ok(s.includes("$env:LOCALAPPDATA 'AstraPark'"), 'the same install folder, so scores and settings carry over');
});

test('the launcher keeps itself up to date, filling in only its own two placeholders', () => {
  const s = read('launch.ps1').toString();
  assert.ok(s.includes('function Update-Launcher') && s.includes('windows/launch.ps1'), 'fetches the newest launcher');
  assert.equal((s.match(/'__REPO__'/g) || []).length, 1, 'the repo placeholder appears once, where it is filled in');
  assert.equal((s.match(/'__BRANCH__'/g) || []).length, 1, 'and the branch one');
});
