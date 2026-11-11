import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
import { CLIPS } from './clips.mjs';
const { chromium } = createRequire('/home/user/hello-world/astra-park/package.json')('playwright');
const root = '/home/user/hello-world/astra-park', here = new URL('.', import.meta.url).pathname, FPS = 30, FADE = 0.25;
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = createServer(async (q, r) => { try { const p = join(root, decodeURIComponent(q.url.split('?')[0])); r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); r.end(await readFile(p)); } catch { r.writeHead(404); r.end(); } }).listen(0);
const port = server.address().port;
const only = process.argv[2];
await mkdir(`${here}/frames`, { recursive: true });
const b = await chromium.launch();
let n = 0;
const HELP = `
LKP.until = (f, max, each) => { for (let k = 0; k < max * 30 && !f(); k++) LKP.run(1/30, each); };
LKP.reach = (inst, t) => { LKP.pose.players.forEach((p, j) => { p.hands.right.y = Math.floor((inst.t || 0) * 1.6 + j) % 2 ? 0.1 : 0.6; }); };
LKP.wave = (inst) => { LKP.pose.players.forEach((p, j) => { p.hands.right.x = 0.5 + 0.2 * Math.sin((inst.t || 0) * 9 + j); p.hands.right.y = 0.4; }); };
LKP.crank = (inst) => { const a = (inst.t || 0) * 7.5; LKP.pose.players.forEach(p => { p.hands.left = { x: 0.5 - Math.cos(a) * 0.05, y: 0.5 - Math.sin(a) * 0.05 }; p.hands.right = { x: 0.5 + Math.cos(a) * 0.05, y: 0.5 + Math.sin(a) * 0.05 }; }); };
window.CAP = (text, a, small) => { const c = document.getElementById('c').getContext('2d'), W = 1920, H = 1080; if (a <= 0) return; c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = (small ? '500 ' + H * 0.03 : '600 ' + H * 0.05) + 'px Fredoka, sans-serif'; const y = small ? H * 0.46 : H * 0.86;
  c.shadowColor = 'rgba(20,15,45,.8)'; c.shadowBlur = H * 0.02; c.fillStyle = '#ffffff';
  const sp = small ? 6 : 10; c.letterSpacing = sp + 'px'; c.fillText(text, W / 2, y); c.restore(); };
window.FADE = (a, col) => { if (a <= 0) return; const c = document.getElementById('c').getContext('2d'); c.save(); c.globalAlpha = Math.min(1, a); c.fillStyle = col || '#000'; c.fillRect(0, 0, 1920, 1080); c.restore(); };
`;
for (const [name, secs, setup, each = '', cap = '', small = ''] of CLIPS){
  if (only && name !== only) { n += Math.round(secs * FPS); continue; }
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log(name, 'ERROR', e.message));
  await p.goto(`http://127.0.0.1:${port}/test/preview/lkp.html`); await p.waitForFunction('window.READY'); await p.evaluate('document.fonts.ready');
  await p.evaluate(HELP); await p.evaluate(`(function(){ ${setup} })()`);
  const N = Math.round(secs * FPS);
  for (let f = 0; f < N; f++, n++){
    const t = f / FPS, ca = cap ? Math.min(1, (t - 0.3) / 0.4, (secs - 0.3 - t) / 0.4) : 0;
    const fa = Math.max(0, 1 - t / FADE, 1 - (secs - t) / FADE) * (name === 'wake' && t < 1 ? 1 : 0.85);
    await p.evaluate(`LKP.run(1/30${each ? ', ' + each : ''}); LKP.draw(); ${cap ? `CAP(${JSON.stringify(cap)}, ${ca});` : ''} ${small ? `CAP(${JSON.stringify(small)}, ${Math.max(0, Math.min(1, (t - 4) / 0.8))}, true);` : ''} ${name === 'title' ? `LKP.inst.summit && LKP.inst.summit._title(document.getElementById('c').getContext('2d'), 1920, 1080, ${Math.max(0, Math.min(1, (t - 5.4) / 0.6))});` : ''} FADE(${name === 'wake' ? Math.max(0, 1 - t / 1.2) : name === 'title' ? Math.max(0, (t - (secs - 0.8)) / 0.8) : fa});`);
    await p.locator('#c').screenshot({ path: `${here}/frames/f${String(n).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  console.log(name, 'done', n);
  await p.close();
}
await b.close(); server.close();
