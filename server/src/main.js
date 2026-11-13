/* Orlis Server.exe: double-click it, and it runs quietly - the Orlis cube by
   the clock (supervisor.js), the server itself underneath (--worker).

   Its data (orlis.db, the Store's games, backups and the log) lives in an
   "Orlis Server data" folder beside the exe. */
import './quiet.js';
import { dirname, join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as sea from 'node:sea';
import { start, VERSION } from './app.js';
import { activity } from './http.js';
import { updater, QUIET, AFTER_UPDATE } from './update.js';
import { supervise, WORKER, RESTART } from './supervisor.js';

const exeDir = dirname(process.execPath);
const runningAsExe = !/[\\/]node(\.exe)?$/i.test(process.execPath);
const windowsExe = runningAsExe && sea.isSea() && process.platform === 'win32';
/* The exe on Windows runs by the clock (not with ORLIS_NO_TRAY): this copy
   is either that (the icon, looking after the server) or the server under
   it. */
const supervised = process.argv.includes(WORKER) && !!process.env.ORLIS_SUPERVISED;
const asTray = windowsExe && !supervised && !process.env.ORLIS_NO_TRAY;
/* Only the exe on Windows updates itself (and not with ORLIS_NO_UPDATE). */
const selfUpdates = windowsExe && !process.env.ORLIS_NO_UPDATE;
const dataDir = process.env.ORLIS_DATA || (runningAsExe ? join(exeDir, 'Orlis Server data') : join(process.cwd(), 'data'));

const lan = Object.values(networkInterfaces()).flat()
  .filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);

/* The games this server comes with: inside the exe (see build-exe.mjs), or,
   run from the code, the ones built into server/starter/. */
function starters(){
  try {
    if (sea.isSea()){
      const names = JSON.parse(Buffer.from(sea.getAsset('starters.json')).toString('utf8'));
      return names.map(name => ({ name, data: Buffer.from(sea.getAsset(`starter/${name}`)) }));
    }
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'starter');
    return readdirSync(dir).filter(f => f.endsWith('.orlis')).map(name => ({ name, data: readFileSync(join(dir, name)) }));
  } catch { return []; }
}

/* what the updater last found, for the owner's page */
const status = { update: { state: selfUpdates ? 'waiting' : 'off' } };

async function main(){
  /* under the icon: when it goes, this goes too */
  if (supervised){ process.stdin.on('end', () => process.exit(0)); process.stdin.on('close', () => process.exit(0)); process.stdin.resume(); }
  try {
    /* (just updated: the old one may take a moment to let go of the port) */
    const after = process.argv.includes(AFTER_UPDATE);
    let s;
    for (let tries = 0; ; tries++){
      try {
        s = await start({ dataDir, name: process.env.ORLIS_NAME, starters: starters(), status,
          /* (to finish a restore: under the icon, it starts this again) */
          restart: supervised ? () => s.close().then(() => process.exit(RESTART)) : null });
        break;
      }
      catch (e){ if (!after || e.code !== 'EADDRINUSE' || tries >= 20) throw e; await new Promise(r => setTimeout(r, 500)); }
    }
    const line = '-'.repeat(60);
    console.log(`${line}
  Orlis Server ${VERSION} is running: "${s.info.name}"

  ${supervised ? 'It runs quietly: look for the Orlis cube by the clock, and right-click\n  it to quit.' : 'Leave this window open while anyone is playing or syncing.'}
  Orlis Play on this Wi-Fi finds it by itself.
  (If it ever asks, the address is ${lan.map(a => `http://${a}:${s.port}`).join(' or ') || `http://localhost:${s.port}`})

  Only devices on this home network can reach it - it is not on
  the internet. If Windows asks, allow it on PRIVATE networks only.

  Games in the Store: ${s.store.games().map(g => g.name).join(', ') || 'none yet'}
  (add a game by putting its .orlis file in ${s.store.dir})

  Data: ${dataDir}
  ${supervised ? '' : 'To stop it, close this window.'}${selfUpdates ? `
  It keeps itself up to date: a newer version installs itself
  at a quiet moment, and it's back in a few seconds.` : ''}
${line}`);
    if (after) console.log(`  Updated to ${VERSION}.`);
    if (selfUpdates) updater({ version: VERSION, exe: process.execPath, dataDir, close: s.close, supervised, status,
      backup: () => s.backups.make('update'),
      idle: () => Date.now() - activity.last > QUIET }).start();
    if (s.restored) console.log(`  Restored the backup from ${s.restored.at}.`);
  } catch (e){
    console.error(e.code === 'EADDRINUSE'
      ? 'Orlis Server is already running (or something else is using its port). Close the other one first.'
      : `Orlis Server could not start: ${e.message}`);
    /* (as an exe its window would vanish before the message could be read) */
    if (runningAsExe) await new Promise(r => setTimeout(r, 15000));
    process.exit(1);
  }
}
if (asTray) supervise({ exe: process.execPath, dataDir, version: VERSION, afterUpdate: process.argv.includes(AFTER_UPDATE) });
else main();
