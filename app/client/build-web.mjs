/* Builds the game files the Windows app carries inside it: client/dist,
   with the page, the code, the fonts, and the body-tracking runtime and
   model (from `npm run offline`), so the app plays with no internet.
   Run from app/: node client/build-web.mjs (npm run client:web). */
import { build } from 'vite';
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';

/* The tracking files, fetched once into public/ (git-ignored). */
if (!existsSync('public/wasm/vision_wasm_internal.js') || !existsSync('public/models/pose_landmarker_lite.task')){
  execSync('node fetch-assets.mjs', { stdio: 'inherit' });
}

/* The small stamp on the home screen: when this was built, from what. */
const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'nogit'; } })();
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' · ' + sha;

await build({
  logLevel: 'warn',
  define: { __BUILD__: JSON.stringify(stamp) },
  build: { outDir: 'client/dist', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 4000 }
});
/* the window shown while an update installs */
copyFileSync('client/updating.html', 'client/dist/updating.html');
for (const f of ['index.html', 'updating.html', 'wasm/vision_wasm_internal.js', 'models/pose_landmarker_lite.task']){
  if (!existsSync(`client/dist/${f}`)) throw new Error(`client/dist/${f} is missing`);
}
console.log('client/dist  ' + stamp);
