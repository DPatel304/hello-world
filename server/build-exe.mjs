/* Builds Orlis Server as one program file, with Node inside it - nothing to
   install on the laptop. On Windows it makes "Orlis Server.exe"; anywhere
   else, "orlis-server" (so the same steps can be checked off Windows).

     node build-exe.mjs

   Steps: bundle the code into one file; turn that into a blob Node can
   carry; copy this Node program and stamp the blob into the copy. */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const win = process.platform === 'win32';
const out = 'dist';
const exe = join(out, win ? 'Orlis Server.exe' : 'orlis-server');
mkdirSync(out, { recursive: true });

await build({
  entryPoints: ['src/main.js'], bundle: true, platform: 'node', target: 'node22',
  format: 'cjs', outfile: join(out, 'orlis-server.cjs'), logLevel: 'warning'
});
writeFileSync(join(out, 'sea-config.json'), JSON.stringify({
  main: join(out, 'orlis-server.cjs'), output: join(out, 'sea.blob'),
  disableExperimentalSEAWarning: true, useCodeCache: false
}));
execFileSync(process.execPath, ['--experimental-sea-config', join(out, 'sea-config.json')], { stdio: 'inherit' });
copyFileSync(process.execPath, exe);
if (win){
  /* The copy still carries Node's signature, which stamping would break. */
  try { execFileSync('signtool', ['remove', '/s', exe], { stdio: 'inherit' }); } catch { console.warn('(signtool not found: the exe stays as-is)'); }
}
const postject = join('node_modules', '.bin', win ? 'postject.cmd' : 'postject');
execFileSync(postject, [exe, 'NODE_SEA_BLOB', join(out, 'sea.blob'), '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'], { stdio: 'inherit', shell: win });
if (!win) chmodSync(exe, 0o755);
console.log(`built ${exe}`);
