/* Packs the Windows download: dist/AstraPark-Windows.zip, holding one
   "Astra Park" folder with the game, the icon, setup and a read-me. Run
   after build-single.mjs (npm run windows does both). */
import { mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
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
execFileSync('zip', ['-r', '-q', '-X', zip, 'Astra Park'], { cwd: dist });
console.log('dist/AstraPark-Windows.zip');
