/* Builds the creator kit into the app: the Orlis runtime as one script
   (kit/creator/runtime.js, bundled), and the files every new game's folder
   starts with (kit/creator/template/), with the checks' list
   (kit/creator/forbidden.json) put into the check hook. Orlis Play writes
   them out when Create makes a new game, and packs the runtime in front of
   the game's own code (src/ui/creator-kit.js).

     node kit/build-creator.mjs        -> src/ui/creator-kit.gen.js */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = join(root, 'kit/creator');
export const OUT = join(root, 'src/ui/creator-kit.gen.js');

export async function generate(){
  const out = await build({ entryPoints: [join(kit, 'runtime.js')], bundle: true, format: 'iife', target: 'es2020', minify: true, write: false, legalComments: 'none', logLevel: 'warning' });
  const runtime = out.outputFiles[0].text.trim();
  const forbidden = JSON.parse(readFileSync(join(kit, 'forbidden.json'), 'utf8'));
  const files = {};
  const walk = (d) => {
    for (const f of readdirSync(d).sort()){
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      /* (line endings as one: Git on Windows checks files out with CRLF) */
      else files[relative(join(kit, 'template'), p).split('\\').join('/')] = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    }
  };
  walk(join(kit, 'template'));
  const ps = forbidden.map(([w, why]) => `  @('${w.replace(/'/g, "''")}', '${why.replace(/'/g, "''")}')`).join(",\n");
  for (const h of ['check.ps1', 'guard.ps1']) files['.claude/hooks/' + h] = files['.claude/hooks/' + h].replace('{{FORBIDDEN}}', () => ps);
  return `/* Made by kit/build-creator.mjs - don't edit; change kit/creator/ and run it again. */
export const RUNTIME = ${JSON.stringify(runtime)};
export const FORBIDDEN = ${JSON.stringify(forbidden)};
export const TEMPLATE = ${JSON.stringify(files, null, 1)};
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]){
  writeFileSync(OUT, await generate());
  console.log(`wrote ${relative(root, OUT)}`);
}
