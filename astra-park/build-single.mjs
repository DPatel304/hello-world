/* Bundles Astra Park into one self-contained .html file that runs from a
   double-click. No Node, no npm, no dev server: the whole point is that
   someone can try it without installing a toolchain first. */
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

/* Printed small on the title screen, so "is this the new one?" is answered by
   looking rather than by comparing file sizes in a downloads folder. */
const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); }
                     catch { return 'nogit'; } })();
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' · ' + sha;

const out = await build({
  entryPoints: ['src/main.js'],
  bundle: true, format: 'iife', target: 'es2020',
  minify: true, write: false, legalComments: 'none',
  define: { __BUILD__: JSON.stringify(stamp) }
});
const js  = out.outputFiles[0].text;
/* The font goes in as a data URL, like everything else, so the one file
   needs nothing beside it. */
const font = (await readFile('src/fonts/fredoka.woff2')).toString('base64');
const css = (await readFile('src/style.css', 'utf8'))
  .replace('url(fonts/fredoka.woff2)', `url(data:font/woff2;base64,${font})`);
if (!css.includes('base64,' + font.slice(0, 20))) throw new Error('font was not inlined');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Astra Park</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230d0b1a'/%3E%3Ccircle cx='12' cy='13' r='5' fill='%233da9ff'/%3E%3Ccircle cx='21' cy='19' r='5' fill='%23ff8a3d'/%3E%3C/svg%3E">
<style>${css}</style>
</head>
<body>
<canvas id="stage"></canvas>
<div id="ui"></div>
<canvas id="over"></canvas>
<video id="cam" playsinline autoplay muted></video>
<!-- Written by the Windows launcher: the songs in the family's music
     folder. Missing when the game is opened any other way, which is fine. -->
<script src="playlist.js"></script>
<script>${js}</script>
</body>
</html>`;
await writeFile('astra-park.html', html);
console.log('astra-park.html  ' + stamp + '  ' + (html.length / 1024).toFixed(0) + ' KB');
