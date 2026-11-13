/* Orlis Server keeps itself up to date, like Orlis Play does.

   As it starts, and every few hours after, it asks GitHub whether there's a
   newer Orlis Server (server.json, beside the exe in the "server" release).
   If there is, it downloads it and checks it's genuine: signed with Orlis
   Play's own update key (the same one the app's updates are signed with -
   only its builds on GitHub have it). Then, at a quiet moment - nobody
   having asked it anything for a couple of minutes - it backs up its data,
   swaps the new exe in for itself, starts it, and closes. It's back within
   seconds, in a new window.

   Only the exe does this (run from the code, it doesn't), only on Windows,
   and never with ORLIS_NO_UPDATE set. Going online to check is the one
   thing it does on the internet; nobody on the internet can reach it. */
import { createHash, createPublicKey, verify } from 'node:crypto';
import { existsSync, renameSync, writeFileSync, unlinkSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { spawn as spawnChild } from 'node:child_process';

/* Orlis Play's update key (its public half), as in client/src-tauri/tauri.conf.json */
export const PUBKEY = 'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEUzRTVCRDAwRkE1Qjg3RjYKUldUMmgxdjZBTDNsNDBLU2pUVlBEQnc1WmU2dlBWU2F4T1JleElvb0xGVElVVjhra2czU3pYT3oK';
export const FEED = 'https://github.com/dpatel304/orlis-play/releases/download/server/server.json';
export const EVERY = 6 * 60 * 60 * 1000;     /* how often it looks */
export const QUIET = 2 * 60 * 1000;          /* how long nobody's asked anything, before it swaps */
export const AFTER_UPDATE = '--after-update';

export const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 4; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

/* Is this file signed with the key? sig is the .sig file's text, as the
   Tauri signer writes it (minisign, base64'd). */
export function genuine(file, sig, pub = PUBKEY){
  try {
    const pk = Buffer.from(Buffer.from(pub, 'base64').toString().split('\n')[1].trim(), 'base64');
    const lines = Buffer.from(sig, 'base64').toString().split('\n');
    const s = Buffer.from(lines[1].trim(), 'base64');
    if (pk.length !== 42 || s.length !== 74) return false;
    if (s.subarray(0, 2).toString() !== 'ED' || !s.subarray(2, 10).equals(pk.subarray(2, 10))) return false;
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pk.subarray(10)]), format: 'der', type: 'spki' });
    if (!verify(null, createHash('blake2b512').update(file).digest(), key, s.subarray(10, 74))) return false;
    /* (and the signed note that goes with it) */
    const trusted = (lines[2] || '').replace(/^trusted comment: /, '');
    return verify(null, Buffer.concat([s.subarray(10, 74), Buffer.from(trusted)]), key, Buffer.from((lines[3] || '').trim(), 'base64'));
  } catch { return false; }
}

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

/* updater({ version, exe, dataDir, close, idle, ... }).start() */
export function updater({ version, exe, dataDir, close, idle = () => true, log = console.log,
  fetchImpl = fetch, spawn = spawnChild, exit = (c) => process.exit(c), feed = FEED, pub = PUBKEY, every = EVERY, wait = 30 * 1000 }){
  const dir = dirname(exe), name = basename(exe, '.exe');
  const old = join(dir, `${name}.old.exe`), fresh = join(dir, `${name}.new.exe`);
  let busy = false, timer = null;

  /* the one before an update, once it has closed */
  function tidy(){ for (const f of [old, fresh]) if (existsSync(f)) try { unlinkSync(f); } catch {} }

  async function get(url, ms){
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try { const r = await fetchImpl(url, { signal: c.signal, redirect: 'follow' }); if (!r.ok) throw new Error(`${r.status}`); return r; }
    finally { clearTimeout(t); }
  }

  /* A newer one, downloaded and checked - or null. */
  async function find(){
    const info = await (await get(feed, 20000)).json();
    if (!info || !newer(info.version, version)) return null;
    const bytes = Buffer.from(await (await get(info.url, 10 * 60 * 1000)).arrayBuffer());
    if (info.sha256 && sha256(bytes) !== info.sha256) throw new Error('the download came through damaged');
    if (!genuine(bytes, info.signature, pub)) throw new Error('the download is not signed by Orlis Play - not using it');
    return { version: info.version, bytes };
  }

  /* Swap it in: back up the data, put the new exe where this one is, start
     it, and close. If anything goes wrong before it starts, nothing's
     changed. */
  async function apply(found){
    writeFileSync(fresh, found.bytes);
    try { renameSync(exe, old); } catch (e){ try { unlinkSync(fresh); } catch {} throw e; }
    try { renameSync(fresh, exe); } catch (e){ renameSync(old, exe); throw e; }
    log(`\n  Updating Orlis Server to ${found.version} - back in a moment...\n`);
    await close();
    backup(found.version);
    spawn(exe, [AFTER_UPDATE], { cwd: dir, detached: true, stdio: 'ignore' }).unref?.();
    setTimeout(() => exit(0), 300);
  }

  /* a copy of the family's data from just before, the last three kept */
  function backup(to){
    const db = join(dataDir, 'orlis.db');
    if (!existsSync(db)) return;
    const into = join(dataDir, 'backups');
    mkdirSync(into, { recursive: true });
    copyFileSync(db, join(into, `orlis-before-${to}.db`));
    const all = readdirSync(into).filter(f => /^orlis-before-.*\.db$/.test(f)).sort((a, b) => newer(a.slice(13, -3), b.slice(13, -3)) ? -1 : 1);
    for (const f of all.slice(3)) try { unlinkSync(join(into, f)); } catch {}
  }

  async function run(){
    if (busy) return;
    busy = true;
    try {
      const found = await find();
      if (!found) return;
      log(`  A newer Orlis Server (${found.version}) is ready; it'll switch over at a quiet moment.`);
      while (!idle()) await new Promise(r => setTimeout(r, wait));
      await apply(found);
    } catch (e){
      log(`  (Couldn't check for a newer Orlis Server: ${e.message}. It'll try again later.)`);
    } finally { busy = false; }
  }

  return {
    run, find, apply, tidy,
    start(){
      tidy(); setTimeout(tidy, 15000);
      setTimeout(run, 15000);
      timer = setInterval(run, every);
      timer.unref?.();
    },
    stop(){ clearInterval(timer); }
  };
}
