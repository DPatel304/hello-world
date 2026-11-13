/* Screenshots of Last Known Position at chosen moments, no camera needed:
     node test/preview/lkp-shots.mjs out-dir shots.json
   shots.json: [{ "name": "start", "js": "LKP.start(2); LKP.run(3)" }, ...]
   Each shot's js runs in the page, then the frame is drawn and saved. */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out = '/tmp/lkp', list] = process.argv.slice(2);
const shots = JSON.parse(await readFile(list, 'utf8'));
const root = new URL('../../', import.meta.url).pathname;
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = createServer(async (q, r) => {
  try { const p = join(root, decodeURIComponent(q.url.split('?')[0])); r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); r.end(await readFile(p)); }
  catch { r.writeHead(404); r.end(); }
}).listen(0);
const port = server.address().port;
await mkdir(out, { recursive: true });
const b = await chromium.launch();
for (const s of shots){
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log(s.name, 'ERROR', e.message));
  await p.goto(`http://127.0.0.1:${port}/test/preview/lkp.html`);
  await p.waitForFunction('window.READY');
  await p.evaluate(`document.fonts.ready`);
  try { await p.evaluate(s.js + '; LKP.draw()'); await p.screenshot({ path: `${out}/${s.name}.png` }); console.log(`${out}/${s.name}.png`); }
  catch (e){ console.log(s.name, 'FAILED', e.message.split('\n')[0]); }
  await p.close();
}
await b.close(); server.close();
