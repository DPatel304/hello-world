/* The Library: the games downloaded from the Store, kept on this PC, so they
   play with no server in reach. Each is kept whole - its manifest and its
   code - in the app's own storage (IndexedDB), and started as the app
   starts: its code is loaded as a module that takes the shared parts from
   the Game Kit (kit.js), and the game joins the home screen.

   Only in the Windows app; elsewhere there's no Library and the games are
   all built in. */
import { GAMES } from '../games/index.js';
import { KIT } from '../kit.js';
import { readOrlis, sha256 } from './orlis-file.js';
import { account } from './account.js';

const DB = 'orlis-library', STORE = 'games';
const text = (u8) => new TextDecoder().decode(u8);

function db(){
  return new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}
async function tx(mode, fn){
  const d = await db();
  return new Promise((ok, no) => {
    const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
    const r = fn(s);
    t.oncomplete = () => { d.close(); ok(r && 'result' in r ? r.result : undefined); };
    t.onerror = () => { d.close(); no(t.error); };
  });
}

/* A game's code, started: a module of its own, from its text. (Through
   Function, so the app's bundler leaves this import alone.) */
const load = new Function('u', 'return import(u)');
async function start(rec){
  const url = URL.createObjectURL(new Blob([rec.code], { type: 'text/javascript' }));
  try {
    const mod = await load(url);
    const g = mod.default;
    if (!g || g.id !== rec.id || typeof g.create !== 'function') throw new Error('not a game');
    /* what the Store said about it, for the home screen */
    g.store = { version: rec.version, blurb: rec.manifest.blurb, icon: rec.manifest.icon };
    return g;
  } finally { URL.revokeObjectURL(url); }
}
function place(g){
  const at = GAMES.findIndex(x => x.id === g.id);
  if (at >= 0) GAMES[at] = g; else GAMES.unshift(g);
}

export const library = {
  /* id -> version, of what's installed */
  installed: new Map(),
  failed: [],

  /* As the app starts: every installed game, back on the home screen. */
  async load(){
    if (typeof indexedDB === 'undefined') return;
    let all = [];
    try { all = await tx('readonly', s => s.getAll()); } catch { return; }
    for (const rec of all || []){
      try { place(await start(rec)); this.installed.set(rec.id, rec.version); }
      catch (e){ this.failed.push(rec.id); }
    }
  },

  /* From the Store: download, check it's the very file the server listed,
     open it, start it, and keep it. */
  async install(entry, progress = () => {}){
    const s = account.state;
    progress(0.05);
    const r = await fetch(s.server.url.replace(/\/$/, '') + `/api/store/${encodeURIComponent(entry.id)}/file`, { headers: { Authorization: `Bearer ${s.token}` } });
    if (!r.ok) throw new Error(r.status === 401 ? 'Please sign in again.' : 'The download didn\'t work. Try again.');
    const bytes = new Uint8Array(await r.arrayBuffer());
    progress(0.6);
    if (await sha256(bytes) !== entry.sha256) throw new Error('The download came through damaged. Try again.');
    const parts = await readOrlis(bytes);
    if (!parts['manifest.json'] || !parts['game.js']) throw new Error('That game file is missing its parts.');
    const manifest = JSON.parse(text(parts['manifest.json']));
    if (manifest.id !== entry.id) throw new Error('That game file isn\'t the one asked for.');
    if ((manifest.kit || 1) > KIT) throw new Error('This game needs a newer Orlis Play. Check for updates first.');
    const rec = { id: manifest.id, version: manifest.version, sha256: entry.sha256, manifest, code: text(parts['game.js']), at: Date.now() };
    const g = await start(rec);
    progress(0.9);
    await tx('readwrite', st => st.put(rec));
    place(g);
    this.installed.set(rec.id, rec.version);
    progress(1);
    return g;
  },

  async remove(id){
    await tx('readwrite', st => st.delete(id));
    this.installed.delete(id);
    const at = GAMES.findIndex(x => x.id === id);
    if (at >= 0) GAMES.splice(at, 1);
  }
};
