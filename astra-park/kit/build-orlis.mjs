/* Builds a game into a .orlis file - one file, for the Store.

     node kit/build-orlis.mjs pop-party

   The game's own code is bundled into one module (game.js); the parts of the
   app it shares - the camera's players, sound, avatars, the common bits -
   are left out and taken from the app's Game Kit when it runs (src/kit.js).
   The result goes to dist-games/, and into the server's starter games
   (server/starter/), so a new Orlis Server comes with it. */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeOrlis, readOrlis, manifestOf, sha256, FORMAT } from '../../server/src/orlis-file.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = 1;

/* The kit: app files a game shares rather than carries (see src/kit.js). */
const SHARED = {
  [resolve(root, 'src/games/common.js')]: 'common',
  [resolve(root, 'src/tracking/pose.js')]: 'pose',
  [resolve(root, 'src/audio/sound.js')]: 'sound',
  [resolve(root, 'src/ui/avatars.js')]: 'avatars'
};

/* The games that are packaged, and what the Store shows for them. */
const BALLOON = '<path d="M50 14c15 0 25 11 25 26 0 17-14 30-25 33-11-3-25-16-25-33 0-15 10-26 25-26z" fill="#fff"/><path d="M46 73h8l-4 6z" fill="#fff"/><path d="M50 79c-5 6 5 9 0 16" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="41" cy="31" rx="5" ry="8" transform="rotate(-25 41 31)" fill="#000" opacity=".12"/>';
export const PACKAGES = {
  'pop-party': {
    entry: 'src/games/pop-party.js',
    manifest: {
      id: 'pop-party', name: 'Pop Party', version: '1.0', by: 'Orlis Play',
      blurb: 'Reach up and pop the balloons before they float away',
      players: [1, 4], icon: { cols: ['#ff7eb3', '#ffa25a'], glyph: BALLOON }
    }
  }
};

const kitPlugin = {
  name: 'orlis-kit',
  setup(b){
    b.onResolve({ filter: /.*/ }, async (args) => {
      if (args.kind === 'entry-point' || args.namespace === 'orlis-kit') return;
      const full = resolve(args.resolveDir, args.path);
      if (SHARED[full]) return { path: SHARED[full], namespace: 'orlis-kit' };
    });
    b.onLoad({ filter: /.*/, namespace: 'orlis-kit' }, (args) => ({
      contents: `module.exports = globalThis.OrlisKit.modules[${JSON.stringify(args.path)}];`, loader: 'js'
    }));
  }
};

export async function buildOrlis(id){
  const pkg = PACKAGES[id];
  if (!pkg) throw new Error(`no package called ${id} (have: ${Object.keys(PACKAGES).join(', ')})`);
  const out = await build({
    entryPoints: [join(root, pkg.entry)], bundle: true, format: 'esm', target: 'es2020',
    minify: true, write: false, legalComments: 'none', plugins: [kitPlugin], logLevel: 'warning'
  });
  const code = out.outputFiles[0].text;
  const manifest = { format: FORMAT, kit: KIT, ...pkg.manifest };
  const file = writeOrlis({ 'manifest.json': JSON.stringify(manifest, null, 2), 'game.js': code });
  manifestOf(readOrlis(file));                       /* (it reads back, or this throws) */
  for (const dir of [join(root, 'dist-games'), join(root, '..', 'server', 'starter')]){
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${id}.orlis`), file);
  }
  return { id, bytes: file.length, sha: sha256(file), version: manifest.version };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])){
  const ids = process.argv.slice(2);
  for (const id of ids.length ? ids : Object.keys(PACKAGES)){
    const r = await buildOrlis(id);
    console.log(`${id}.orlis  ${r.version}  ${(r.bytes / 1024).toFixed(0)} KB  ${r.sha.slice(0, 12)}`);
  }
}
