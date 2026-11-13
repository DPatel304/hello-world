/* The Orlis server, started: its data file, the web side for the app, and
   the answer to "is there an Orlis server on this Wi-Fi?". */
import { join } from 'node:path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { managePage } from './manage-page.js';
import { hostname, networkInterfaces } from 'node:os';
import { openDb } from './db.js';
import { makeServer, activity, Fail, Page, isLocal } from './http.js';
import { backups } from './backup.js';
import { submissions } from './submissions.js';
import { api } from './api.js';
import { listenForApps, DISCOVERY_PORT } from './discovery.js';
import { store } from './store.js';

/* The server's version: 0.1 and the build number, stamped in when the exe
   is built (build-exe.mjs); run from the code, plain 0.1.0. */
/* global __ORLIS_SERVER_VERSION__ */
export const VERSION = typeof __ORLIS_SERVER_VERSION__ === 'string' ? __ORLIS_SERVER_VERSION__ : '0.1.0';
export const PORT = 47871;
/* this laptop's addresses on the home network, for the app to be pointed at */
const lan = (port) => Object.values(networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => `http://${n.address}:${port}`);

/* How often it looks to see whether a daily backup is due, and how long
   nobody must have used it first. */
const BACKUP_LOOK = 60 * 60 * 1000, QUIET = 2 * 60 * 1000;

/* restart(): how to start this server again (to finish a restore) - given
   when something's there to do it. status.update: what the updater last
   found, for the owner's page. */
export async function start({ dataDir, port = PORT, discoveryPort = DISCOVERY_PORT, name, host = '0.0.0.0', starters = [], restart = null, status = { update: { state: 'off' } } } = {}){
  mkdirSync(dataDir, { recursive: true });
  const safe = backups(dataDir, { version: VERSION });
  /* a restore the owner asked for, done before anything is opened */
  const restored = safe.applyPending();
  const db = openDb(join(dataDir, 'orlis.db'));
  /* the management page's key: the cube opens the page with it, so only
     someone at this laptop, using the cube, can manage the server */
  const keyFile = join(dataDir, 'manage.key');
  if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(24).toString('hex'));
  const manageKey = readFileSync(keyFile, 'utf8').trim();
  const info = { name: name || `${hostname()}'s Orlis`, version: VERSION };
  const shop = store(dataDir, starters);
  const sent = submissions(db, dataDir, shop);
  const owners = (who, owner) => [
    ...sent.routes(who, owner, (h, ip) => h['x-orlis-manage'] !== undefined ? owner(h, ip) : who(h)),
    /* the management page itself: only to this laptop */
    ['GET', '/manage', ({ ip }) => {
      if (!isLocal(ip)) throw new Fail(404, 'not_found', 'Nothing here.');
      return new Page(managePage());
    }],
    ...shop.routes(who, owner),
    /* the owner's page in the app: this server, its backups */
    ['GET', '/api/server', ({ headers, ip }) => {
      owner(headers, ip);
      return { name: info.name, version: VERSION, addresses: lan(at), update: status.update, backups: safe.list(), restoring: safe.pending(), restored: restored ? restored.id : null, canRestart: !!restart };
    }],
    ['POST', '/api/backups', ({ headers, ip }) => { owner(headers, ip); return [201, safe.make('manual', db)]; }],
    ['POST', '/api/backups/:id/restore', ({ headers, params, ip }) => {
      owner(headers, ip);
      let b;
      try { b = safe.requestRestore(params.id); } catch (e){ throw new Fail(404, 'no_backup', 'No such backup.'); }
      if (restart) setTimeout(restart, 600);
      return { ok: true, backup: b, restarting: !!restart };
    }]
  ];
  const web = makeServer(api(db, info, owners, manageKey));
  await new Promise((ok, no) => { web.once('error', no); web.listen(port, host, ok); });
  const at = web.address().port;
  const udp = discoveryPort === false ? null
    : await listenForApps({ port: discoveryPort, answer: () => ({ name: info.name, port: at, version: VERSION }) });
  /* the daily backup, at a quiet moment */
  const look = () => { if (Date.now() - activity.last > QUIET) try { safe.daily(db); } catch (e){ console.error(`(backup didn't work: ${e.message})`); } };
  const first = setTimeout(look, 60 * 1000), every = setInterval(look, BACKUP_LOOK);
  first.unref?.(); every.unref?.();
  return {
    port: at, info, db, discovery: udp, store: shop, backups: safe, restored, manageKey,
    manageUrl: `http://127.0.0.1:${at}/manage?k=${manageKey}`,
    close: () => new Promise((ok) => { clearTimeout(first); clearInterval(every); udp?.close(); web.close(() => { db.close(); ok(); }); web.closeAllConnections?.(); })
  };
}
