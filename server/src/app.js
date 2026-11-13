/* The Orlis server, started: its data file, the web side for the app, and
   the answer to "is there an Orlis server on this Wi-Fi?". */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { hostname } from 'node:os';
import { openDb } from './db.js';
import { makeServer } from './http.js';
import { api } from './api.js';
import { listenForApps, DISCOVERY_PORT } from './discovery.js';
import { store } from './store.js';

export const VERSION = '0.1.0';
export const PORT = 47871;

export async function start({ dataDir, port = PORT, discoveryPort = DISCOVERY_PORT, name, host = '0.0.0.0', starters = [] } = {}){
  mkdirSync(dataDir, { recursive: true });
  const db = openDb(join(dataDir, 'orlis.db'));
  const info = { name: name || `${hostname()}'s Orlis`, version: VERSION };
  const shop = store(dataDir, starters);
  const web = makeServer(api(db, info, shop.routes));
  await new Promise((ok, no) => { web.once('error', no); web.listen(port, host, ok); });
  const at = web.address().port;
  const udp = discoveryPort === false ? null
    : await listenForApps({ port: discoveryPort, answer: () => ({ name: info.name, port: at, version: VERSION }) });
  return {
    port: at, info, db, discovery: udp, store: shop,
    close: () => new Promise((ok) => { udp?.close(); web.close(() => { db.close(); ok(); }); web.closeAllConnections?.(); })
  };
}
