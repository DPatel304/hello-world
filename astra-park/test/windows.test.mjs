import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* The Windows launcher can't be run here, so these guard the ways it breaks
   on arrival rather than in logic: Windows PowerShell 5.1 reads a script
   without a BOM in the local code page, so one curly quote garbles it, and
   cmd.exe misreads a batch file with bare LF line endings. */
const read = (f) => readFileSync(new URL(`../windows/${f}`, import.meta.url));

test('setup.ps1 is plain ASCII', () => {
  const bad = [...read('setup.ps1')].findIndex(b => b > 0x7f);
  assert.equal(bad, -1, `non-ASCII byte at offset ${bad}`);
});

test('the batch file and read-me use CRLF line endings', () => {
  for (const f of ['Set up Astra Park.bat', 'Read me.txt', 'setup.ps1']){
    const s = read(f).toString('latin1');
    assert.ok(!/[^\r]\n/.test(s), `${f} has a bare LF`);
  }
});

test('the shortcut opens the game the way it is meant to', () => {
  const s = read('setup.ps1').toString();
  for (const flag of ['--user-data-dir=', '--app=', '--start-fullscreen',
                      '--autoplay-policy=no-user-gesture-required',
                      '--use-fake-ui-for-media-stream', '--no-first-run']){
    assert.ok(s.includes(flag), `missing ${flag}`);
  }
  /* $PROFILE is a PowerShell automatic variable, and names are not case
     sensitive: a variable called $profile would shadow it. */
  assert.ok(!/\$profile\b/i.test(s), 'uses $profile, which collides with $PROFILE');
});
