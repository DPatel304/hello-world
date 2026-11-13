/* The outbox: a creator's games waiting to be sent to the family's Orlis
   server. A creator makes their game at home; it waits here, on their PC,
   until it can reach the server - on the home Wi-Fi where the server is -
   and then it's sent, by itself, to wait for the owner's OK. (The server
   checks it all again; these checks are only to say sooner.)

   outbox.add(bytes) - a game's .orlis file, checked and kept
   outbox.sync()     - send whatever's waiting, if the server's in reach
   outbox.list()     - what's waiting to send
   outbox.sent()     - what's been sent, and how each went (from the server) */
import { account } from './account.js';
import { readOrlis } from './orlis-file.js';
import { KIT } from '../kit.js';

const DB = 'orlis-outbox', STORE = 'games';
const text = (u8) => new TextDecoder().decode(u8);
function db(){
  return new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key', autoIncrement: true });
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
}
async function tx(mode, fn){
  const d = await db();
  return new Promise((ok, no) => {
    const t = d.transaction(STORE, mode), r = fn(t.objectStore(STORE));
    t.oncomplete = () => { d.close(); ok(r && 'result' in r ? r.result : undefined); };
    t.onerror = () => { d.close(); no(t.error); };
  });
}
const canCreate = () => account.signedIn && (account.role === 'creator' || account.role === 'owner');

let busy = null;
export const outbox = {
  /* a game, checked enough to say now if it won't do */
  async add(bytes){
    let m;
    try {
      const parts = await readOrlis(bytes);
      if (!parts['manifest.json'] || !parts['game.js']) throw new Error();
      m = JSON.parse(text(parts['manifest.json']));
    } catch { throw new Error('That isn’t an Orlis game (.orlis) file.'); }
    if ((m.kit || 1) !== KIT) throw new Error('That game was made for a different Orlis Play.');
    if (!m.id || !m.name || !m.version) throw new Error('That game file is missing its name or version.');
    const all = await this.list();
    for (const x of all) if (x.gameId === m.id) await tx('readwrite', st => st.delete(x.key));   /* (a newer one replaces it) */
    await tx('readwrite', st => st.add({ gameId: m.id, name: String(m.name).slice(0, 40), version: String(m.version), bytes, addedAt: Date.now(), problem: '' }));
    return { id: m.id, name: m.name, version: m.version };
  },
  async list(){
    if (typeof indexedDB === 'undefined') return [];
    try { return (await tx('readonly', st => st.getAll())) || []; } catch { return []; }
  },
  async remove(key){ await tx('readwrite', st => st.delete(key)); },
  /* Send what's waiting. Each one the server takes leaves the outbox; one it
     turns away stays, with what it said. Out of reach: nothing changes. */
  sync(){
    if (busy) return busy;
    busy = (async () => {
      const done = { sent: 0, turnedAway: 0, reached: true };
      if (!canCreate()) return done;
      const s = account.state;
      for (const x of await this.list()){
        let r;
        try {
          r = await fetch(s.server.url.replace(/\/$/, '') + '/api/submissions', { method: 'POST', signal: AbortSignal.timeout(20000),
            headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${s.token}` }, body: x.bytes });
        } catch { done.reached = false; break; }
        if (r.ok){ await this.remove(x.key); done.sent++; continue; }
        let why = 'The server didn’t take it.';
        try { why = (await r.json()).message || why; } catch {}
        await tx('readwrite', st => st.put({ ...x, problem: why }));
        done.turnedAway++;
      }
      return done;
    })().finally(() => { busy = null; });
    return busy;
  },
  async sent(){
    if (!canCreate()) return [];
    try { return (await account.call('GET', '/api/submissions')).submissions || []; } catch { return null; }
  }
};
