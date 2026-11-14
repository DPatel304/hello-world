/* The Library: the games downloaded from the Store, kept on this PC, so they
   play with no server in reach. Each is kept whole - its manifest and its
   code - in the app's own storage (IndexedDB), and started as the app
   starts, in the sandbox (sandbox.js): sealed off from the app, the account
   and the internet. Then the game joins the home screen.

   Only in the Windows app; elsewhere there's no Library and the games are
   all built in. */
import { GAMES } from '../games/index.js';
import { KIT } from '../kit.js';
import { readOrlis, sha256 } from './orlis-file.js';
import { sandboxed } from './sandbox.js';
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

/* A game's code, started in the sandbox - only if it was built for this
   app's kit (an older one needs downloading again). */
async function start(rec){
  if ((rec.manifest.kit || 1) !== KIT) throw Object.assign(new Error('built for another kit'), { stale: true });
  const g = await sandboxed(rec);
  /* what the Store said about it, for the home screen */
  g.store = { version: rec.version, blurb: rec.manifest.blurb, icon: rec.manifest.icon };
  return g;
}
function place(g){
  const at = GAMES.findIndex(x => x.id === g.id);
  if (at >= 0) GAMES[at] = g; else GAMES.unshift(g);
}

/* A game's file from the Store: downloaded, checked against what the
   server listed, and opened. */
async function fetchRec(entry, progress = () => {}){
  const s = account.state;
  progress(0.05);
  /* (a game waiting for the owner's OK comes from the waiting ones) */
  const path = entry.submission ? `/api/submissions/${encodeURIComponent(entry.submission)}/file` : `/api/store/${encodeURIComponent(entry.id)}/file`;
  const r = await fetch(s.server.url.replace(/\/$/, '') + path, { headers: { Authorization: `Bearer ${s.token}` } });
  if (!r.ok) throw new Error(r.status === 401 ? 'Please sign in again.' : 'The download didn\'t work. Try again.');
  const bytes = new Uint8Array(await r.arrayBuffer());
  progress(0.6);
  if (await sha256(bytes) !== entry.sha256) throw new Error('The download came through damaged. Try again.');
  const parts = await readOrlis(bytes);
  if (!parts['manifest.json'] || !parts['game.js']) throw new Error('That game file is missing its parts.');
  const manifest = JSON.parse(text(parts['manifest.json']));
  if (manifest.id !== entry.id) throw new Error('That game file isn\'t the one asked for.');
  if ((manifest.kit || 1) > KIT) throw new Error('This game needs a newer Orlis Play. Check for updates first.');
  if ((manifest.kit || 1) < KIT) throw new Error('This game was made for an older Orlis Play, and needs updating by its maker.');
  return { id: manifest.id, version: manifest.version, sha256: entry.sha256, manifest, code: text(parts['game.js']), at: Date.now() };
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
      catch (e){
        this.failed.push(rec.id);
        /* (made for an older kit: gone, so the Store offers it fresh) */
        if (e.stale) try { await tx('readwrite', st => st.delete(rec.id)); } catch {}
      }
    }
  },

  /* From the Store: download, check it's the very file the server listed,
     open it, start it, and keep it. */
  async install(entry, progress = () => {}){
    const rec = await fetchRec(entry, progress);
    const g = await start(rec);
    progress(0.9);
    await tx('readwrite', st => st.put(rec));
    place(g);
    this.installed.set(rec.id, rec.version);
    progress(1);
    return g;
  },

  /* For the Store's banner and game pages: a game not downloaded yet,
     playing itself - fetched and checked just the same, started in the
     sandbox, and not kept. (A game already here is used as it is.) */
  async preview(entry){
    if (!entry.submission && this.installed.get(entry.id) === entry.version){
      const here = GAMES.find(x => x.id === entry.id);
      if (here) return here;
    }
    return start(await fetchRec(entry));
  },

  /* A Store game's files, fetched and checked, not started or kept: for
     starting a new game from it in Create. */
  async source(entry){
    const rec = await fetchRec(entry);
    return { manifest: rec.manifest, code: rec.code };
  },

  async remove(id){
    await tx('readwrite', st => st.delete(id));
    this.installed.delete(id);
    const at = GAMES.findIndex(x => x.id === id);
    if (at >= 0) GAMES.splice(at, 1);
  }
};
