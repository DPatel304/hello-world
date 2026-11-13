/* Backups of the family's things on this server, in "Orlis Server data\backups":

     orlis.db   the accounts, the kids' profiles, invites and sign-ins
     games\     the Store's games (the .orlis files), and which starter
                games were taken out on purpose

   (What each PC keeps for itself isn't here: its downloaded games, its
   scores and its settings. Those stay on that PC.)

   Made once a day (at a quiet moment), just before an update, just before a
   restore, and whenever the owner asks. The newest are kept: a week of
   daily ones, and the last few of each other kind.

   A restore can't swap the data under a running server, so it's asked for,
   and done as the server starts again: the data as it was goes into one
   more backup first, so a restore can itself be undone. */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export const KEEP = { daily: 7, update: 3, manual: 5, 'before-restore': 3 };
export const REASONS = Object.keys(KEEP);
const PENDING = 'restore.json';
const DAY = 24 * 60 * 60 * 1000;

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');   /* 20261113-184512 */
const isId = (id) => typeof id === 'string' && /^\d{8}-\d{6}-[a-z-]+$/.test(id) && REASONS.includes(id.slice(16));

function copyGames(from, to){
  mkdirSync(to, { recursive: true });
  if (!existsSync(from)) return 0;
  let n = 0;
  for (const f of readdirSync(from)){
    if (!f.endsWith('.orlis') && f !== '.starters') continue;
    copyFileSync(join(from, f), join(to, f));
    if (f.endsWith('.orlis')) n++;
  }
  return n;
}

export function backups(dataDir, { now = () => new Date(), version = '' } = {}){
  const dir = join(dataDir, 'backups');
  const dbFile = join(dataDir, 'orlis.db');

  /* Make one. With the database open, SQLite copies it whole and consistent
     (VACUUM INTO); with it closed, the file is copied as it is. */
  function make(reason, db = null){
    if (!REASONS.includes(reason)) throw new Error(`no such kind of backup: ${reason}`);
    let id = `${stamp(now())}-${reason}`;
    for (let k = 1; existsSync(join(dir, id)); k++) id = `${stamp(new Date(now().getTime() + k * 1000))}-${reason}`;
    const into = join(dir, id);
    mkdirSync(into, { recursive: true });
    if (db){
      db.exec(`VACUUM INTO '${join(into, 'orlis.db').replace(/'/g, "''")}'`);
    } else if (existsSync(dbFile)){
      copyFileSync(dbFile, join(into, 'orlis.db'));
      for (const x of ['-wal', '-shm']) if (existsSync(dbFile + x)) copyFileSync(dbFile + x, join(into, 'orlis.db' + x));
    }
    const games = copyGames(join(dataDir, 'games'), join(into, 'games'));
    let accounts = null, profiles = null;
    if (db){
      try { accounts = db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n; profiles = db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n; } catch {}
    }
    writeFileSync(join(into, 'backup.json'), JSON.stringify({ id, at: now().toISOString(), reason, version, accounts, profiles, games }, null, 2));
    prune();
    return describe(id);
  }

  function describe(id){
    try {
      const b = JSON.parse(readFileSync(join(dir, id, 'backup.json'), 'utf8'));
      let bytes = 0;
      for (const f of ['orlis.db', 'orlis.db-wal']) if (existsSync(join(dir, id, f))) bytes += statSync(join(dir, id, f)).size;
      const g = join(dir, id, 'games');
      if (existsSync(g)) for (const f of readdirSync(g)) bytes += statSync(join(g, f)).size;
      return { id, at: b.at, reason: b.reason, version: b.version || '', accounts: b.accounts, profiles: b.profiles, games: b.games, bytes };
    } catch { return null; }
  }

  /* newest first */
  function list(){
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(isId).map(describe).filter(Boolean).sort((a, b) => b.id.localeCompare(a.id));
  }

  function prune(){
    const all = list();
    for (const reason of REASONS){
      for (const b of all.filter(x => x.reason === reason).slice(KEEP[reason])) rmSync(join(dir, b.id), { recursive: true, force: true });
    }
  }

  /* A daily one, if the last is a day old (or there's none yet). */
  function daily(db){
    const last = list().find(b => b.reason === 'daily');
    if (last && now().getTime() - Date.parse(last.at) < DAY) return null;
    return make('daily', db);
  }

  /* Ask for a restore: done as the server next starts (applyPending). */
  function requestRestore(id){
    if (!isId(id) || !existsSync(join(dir, id, 'backup.json'))) throw Object.assign(new Error('No such backup.'), { code: 'no_backup' });
    writeFileSync(join(dataDir, PENDING), JSON.stringify({ id, asked: now().toISOString() }));
    return describe(id);
  }
  const pending = () => { try { return JSON.parse(readFileSync(join(dataDir, PENDING), 'utf8')).id; } catch { return null; } };

  /* As the server starts, before the database is opened: a restore that
     was asked for. The data as it is goes into a backup first. */
  function applyPending(){
    const id = pending();
    if (!id) return null;
    try { unlinkSync(join(dataDir, PENDING)); } catch {}
    if (!isId(id) || !existsSync(join(dir, id))) return null;
    make('before-restore');
    const from = join(dir, id);
    for (const x of ['', '-wal', '-shm']) if (existsSync(dbFile + x)) unlinkSync(dbFile + x);
    for (const x of ['', '-wal', '-shm']) if (existsSync(join(from, 'orlis.db' + x))) copyFileSync(join(from, 'orlis.db' + x), dbFile + x);
    const games = join(dataDir, 'games');
    if (existsSync(games)) for (const f of readdirSync(games)) if (f.endsWith('.orlis') || f === '.starters') unlinkSync(join(games, f));
    copyGames(join(from, 'games'), games);
    return describe(id);
  }

  return { dir, make, list, daily, requestRestore, pending, applyPending, prune };
}
