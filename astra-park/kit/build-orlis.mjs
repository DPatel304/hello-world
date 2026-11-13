/* Builds a game into a .orlis file - one file, for the Store.

     node kit/build-orlis.mjs pop-party

   The game is bundled into one script (game.js) with the Orlis sandbox
   runtime (kit/runtime/): it runs sealed off from the app, so where it
   would reach the camera engine or the sound engine it gets the runtime's
   stand-ins instead - the players' body points, sent in by the app, and
   sound requests, sent out. Everything else it uses (the avatars, the
   shared bits) it carries. The result goes to dist-games/, and into the
   server's starter games (server/starter/), so a new Orlis Server comes
   with it. */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeOrlis, readOrlis, manifestOf, sha256, FORMAT } from '../../server/src/orlis-file.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = 2;           /* the sandbox's messages (kit/runtime/main.js); src/kit.js says what the app speaks */

/* App files a game never gets inside the sandbox: their stand-ins. */
const STANDIN = {
  [resolve(root, 'src/tracking/pose.js')]: resolve(root, 'kit/runtime/pose.js'),
  [resolve(root, 'src/audio/sound.js')]: resolve(root, 'kit/runtime/sound.js')
};

/* The games that are packaged, and what the Store shows for them. */
const BALLOON = '<path d="M50 14c15 0 25 11 25 26 0 17-14 30-25 33-11-3-25-16-25-33 0-15 10-26 25-26z" fill="#fff"/><path d="M46 73h8l-4 6z" fill="#fff"/><path d="M50 79c-5 6 5 9 0 16" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="41" cy="31" rx="5" ry="8" transform="rotate(-25 41 31)" fill="#000" opacity=".12"/>';
export const PACKAGES = {
  'pop-party': {
    entry: 'src/games/pop-party.js',
    manifest: {
      id: 'pop-party', name: 'Pop Party', version: '1.1', by: 'Orlis Play',
      blurb: 'Reach up and pop the balloons before they float away',
      about: 'Balloons drift up from the bottom of the screen. Reach up, swat them, and pop as many as you can before they float away. Gold balloons are worth double, and everyone can play at once.',
      players: [1, 4], uses: 'hands', ages: 3, tags: ['Party', 'Together'],
      howto: [
        { move: 'reach', title: 'Reach up', line: 'Swat a balloon to pop it' },
        { move: 'jump', title: 'Jump', line: 'For the ones floating away' },
        { move: 'together', title: 'Play together', line: 'Up to four at once' }
      ],
      icon: { cols: ['#ff7eb3', '#ffa25a'], glyph: BALLOON }
    }
  }
};

const standIns = {
  name: 'orlis-stand-ins',
  setup(b){
    b.onResolve({ filter: /.*/ }, (args) => {
      if (!args.resolveDir || /^[@a-z]/i.test(args.path) && !args.path.startsWith('.')) return;
      const full = resolve(args.resolveDir, args.path);
      if (STANDIN[full]) return { path: STANDIN[full] };
    });
  }
};

export async function buildOrlis(id){
  const pkg = PACKAGES[id];
  if (!pkg) throw new Error(`no package called ${id} (have: ${Object.keys(PACKAGES).join(', ')})`);
  const out = await build({
    stdin: {
      contents: `import game from ${JSON.stringify(join(root, pkg.entry))};\nimport { run } from ${JSON.stringify(join(root, 'kit/runtime/main.js'))};\nrun(game);`,
      resolveDir: root, loader: 'js'
    },
    bundle: true, format: 'iife', target: 'es2020',
    minify: true, write: false, legalComments: 'none', plugins: [standIns], logLevel: 'warning'
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
