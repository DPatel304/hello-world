/* Bundles FamJam into one self-contained .html file that runs from a
   double-click. No Node, no npm, no dev server: the whole point is that
   someone can try it without installing a toolchain first. */
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const out = await build({
  entryPoints: ['src/main.js'],
  bundle: true, format: 'iife', target: 'es2020',
  minify: true, write: false, legalComments: 'none'
});
const js  = out.outputFiles[0].text;
const css = await readFile('src/style.css', 'utf8');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>FamJam</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230d0b1a'/%3E%3Ccircle cx='12' cy='13' r='5' fill='%233da9ff'/%3E%3Ccircle cx='21' cy='19' r='5' fill='%23ff8a3d'/%3E%3C/svg%3E">
<style>${css}</style>
</head>
<body>
<canvas id="stage"></canvas>
<div id="ui"></div>
<video id="cam" playsinline autoplay muted></video>
<script>${js}</script>
</body>
</html>`;
await writeFile('famjam.html', html);
console.log('famjam.html  ' + (html.length / 1024).toFixed(0) + ' KB');
