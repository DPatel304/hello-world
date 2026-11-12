/* Orlis Server.exe: double-click, and leave the window open.

   Its data (orlis.db) lives in an "Orlis Server data" folder beside the exe,
   so backing it up is copying that folder. */
import './quiet.js';
import { dirname, join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { start, VERSION } from './app.js';

const exeDir = dirname(process.execPath);
const runningAsExe = !/[\\/]node(\.exe)?$/i.test(process.execPath);
const dataDir = process.env.ORLIS_DATA || (runningAsExe ? join(exeDir, 'Orlis Server data') : join(process.cwd(), 'data'));

const lan = Object.values(networkInterfaces()).flat()
  .filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);

async function main(){
  try {
    const s = await start({ dataDir, name: process.env.ORLIS_NAME });
    const line = '-'.repeat(60);
    console.log(`${line}
  Orlis Server ${VERSION} is running: "${s.info.name}"

  Leave this window open while anyone is playing or syncing.
  Orlis Play on this Wi-Fi finds it by itself.
  (If it ever asks, the address is ${lan.map(a => `http://${a}:${s.port}`).join(' or ') || `http://localhost:${s.port}`})

  Only devices on this home network can reach it - it is not on
  the internet. If Windows asks, allow it on PRIVATE networks only.

  Data: ${dataDir}
  To stop it, close this window.
${line}`);
  } catch (e){
    console.error(e.code === 'EADDRINUSE'
      ? 'Orlis Server is already running (or something else is using its port). Close the other one first.'
      : `Orlis Server could not start: ${e.message}`);
    /* (as an exe its window would vanish before the message could be read) */
    if (runningAsExe) await new Promise(r => setTimeout(r, 15000));
    process.exit(1);
  }
}
main();
