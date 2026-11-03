/* Packs the Windows download: dist/AstraPark-Windows.zip, holding one
   "Astra Park" folder with the game, the icon, setup and a read-me. Run
   after build-single.mjs (npm run windows does both). */
import { mkdirSync, rmSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const win  = join(root, 'windows');
const dist = join(root, 'dist');
const box  = join(dist, 'Astra Park');
const zip  = join(dist, 'AstraPark-Windows.zip');

if (!existsSync(join(root, 'astra-park.html'))) throw new Error('build astra-park.html first');

rmSync(box, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(box, { recursive: true });
copyFileSync(join(root, 'astra-park.html'), join(box, 'astra-park.html'));
for (const f of ['astra-park.ico', 'setup.ps1', 'Set up Astra Park.bat', 'Read me.txt']){
  copyFileSync(join(win, f), join(box, f));
}

/* The launcher updates itself from the branch this zip was built from, so a
   push to that branch reaches the laptop on its next launch. */
const git = (...a) => execFileSync('git', a, { cwd: root }).toString().trim();
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const repo = git('remote', 'get-url', 'origin').replace(/\.git$/, '').split('/').slice(-2).join('/');
if (branch === 'HEAD' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`can't tell the branch or repo (${branch}, ${repo})`);
writeFileSync(join(box, 'launch.ps1'),
  readFileSync(join(win, 'launch.ps1'), 'utf8').replace('__REPO__', repo).replace('__BRANCH__', branch));
execFileSync('zip', ['-r', '-q', '-X', zip, 'Astra Park'], { cwd: dist });
console.log(`dist/AstraPark-Windows.zip  (updates from ${repo} @ ${branch})`);
