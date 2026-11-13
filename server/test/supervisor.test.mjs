import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { supervise, trayScript, ICON, WORKER, RESTART } from '../src/supervisor.js';
import { UPDATED, AFTER_UPDATE } from '../src/update.js';

const wait = (ms) => new Promise(r => setTimeout(r, ms));
/* pretend processes: the icon (powershell) and the server (the exe) */
function world({ running = false } = {}){
  const w = { spawned: [], workers: [], tray: null, toTray: [], exited: null };
  w.spawn = (cmd, args, opts) => {
    const p = new EventEmitter();
    p.stdin = new PassThrough(); p.stdout = new PassThrough(); p.stderr = new PassThrough();
    p.kill = () => p.emit('exit', null); p.unref = () => {};
    w.spawned.push([cmd, args]);
    if (cmd === 'powershell.exe'){ w.tray = p; p.stdin.on('data', d => w.toTray.push(...d.toString().trim().split('\n'))); }
    else if (args && args[0] === WORKER){ w.workers.push(p); p.stdin.on('finish', () => setTimeout(() => p.emit('exit', 0), 5)); }
    return p;
  };
  w.opts = {
    exe: 'C:\\Orlis\\Orlis Server.exe', dataDir: mkdtempSync(join(tmpdir(), 'orlis-tray-')), version: '0.1.30',
    spawn: w.spawn, exit: (c) => { w.exited = c; }, crashWait: 10, finishWait: 5,
    fetchImpl: async () => { if (!running) throw new Error('nothing there'); return { json: async () => ({ app: 'orlis' }) }; }
  };
  return w;
}

test('it puts the icon by the clock and runs the server under it, logging what it says', async () => {
  const w = world(); supervise(w.opts); await wait(30);
  assert.equal(w.spawned[0][0], 'powershell.exe');
  assert.deepEqual(w.spawned[1], [w.opts.exe, [WORKER]]);
  assert.ok(w.toTray.some(l => l.startsWith('status Orlis Server 0.1.30')));
  w.workers[0].stdout.write('Orlis Server 0.1.30 is running\n'); await wait(10);
  assert.match(readFileSync(join(w.opts.dataDir, 'server.log'), 'utf8'), /is running/);
});

test('a server that stops by itself is started again; five stops in a row and it rests, and says so', async () => {
  const w = world(); supervise(w.opts); await wait(30);
  for (let k = 0; k < 5; k++){ w.workers.at(-1).emit('exit', 1); await wait(30); }
  assert.equal(w.workers.length, 5, 'started again four times, then rested');
  assert.ok(w.toTray.some(l => l.startsWith('say Orlis Server stopped')));
  assert.equal(w.exited, null, 'the icon stays, to look at the log or Restart');
  w.tray.stdout.write('restart\n'); await wait(30);
  assert.equal(w.workers.length, 6, 'Restart from the icon tries again');
});

test('after an update, it starts the new exe and closes; a restore restarts the server', async () => {
  const w = world(); supervise(w.opts); await wait(30);
  w.workers[0].emit('exit', RESTART); await wait(20);
  assert.equal(w.workers.length, 2);
  w.workers[1].emit('exit', UPDATED); await wait(30);
  assert.deepEqual(w.spawned.at(-1), [w.opts.exe, [AFTER_UPDATE]]);
  assert.ok(w.toTray.includes('exit')); assert.equal(w.exited, 0);
});

test('started as the new version, it tells the server', async () => {
  const w = world(); supervise({ ...w.opts, afterUpdate: true }); await wait(30);
  assert.deepEqual(w.spawned[1], [w.opts.exe, [WORKER, AFTER_UPDATE]]);
});

test('Quit from the icon stops the server and closes everything', async () => {
  const w = world(); supervise(w.opts); await wait(30);
  w.tray.stdout.write('quit\n'); await wait(40);
  assert.equal(w.exited, 0); assert.ok(w.toTray.includes('exit'));
  assert.equal(w.workers.length, 1, 'not started again');
});

test('double-clicked again while one is running: it says so and leaves it be', async () => {
  const w = world({ running: true });
  supervise({ ...w.opts }); await wait(30);
  assert.ok(w.toTray.some(l => l.startsWith('say Orlis Server is already running')));
  assert.equal(w.workers.length, 0);
});

test('the icon script carries the Orlis cube and the menu', () => {
  const png = Buffer.from(ICON, 'base64');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const ps = trayScript();
  for (const w of ['Manage Orlis Server', 'Show the log', 'Open the data folder', 'Restart', 'Quit Orlis Server', 'ORLIS_TRAY_TEST', 'NotifyIcon']) assert.ok(ps.includes(w), w);
  assert.ok(ps.includes(ICON));
});

test('Manage opens the management page on this laptop, with its key', async () => {
  const w = world(); const { writeFileSync } = await import('node:fs');
  writeFileSync(join(w.opts.dataDir, 'manage.key'), 'abc123');
  supervise(w.opts); await wait(30);
  w.tray.stdout.write('manage\n'); await wait(20);
  assert.deepEqual(w.spawned.at(-1), ['rundll32.exe', ['url.dll,FileProtocolHandler', 'http://127.0.0.1:47871/manage?k=abc123']]);
});

test('it starts quietly: no note as it starts, or after an update', async () => {
  const w = world(); supervise(w.opts); await wait(30);
  const u = world(); supervise({ ...u.opts, afterUpdate: true }); await wait(30);
  assert.ok(!w.toTray.some(l => l.startsWith('say ')) && !u.toTray.some(l => l.startsWith('say ')));
});
