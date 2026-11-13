/* The Store: the games this server hands out, as .orlis files in its
   "games" folder (in its data folder). Drop a .orlis file in and it's in
   the Store; take it out and it's gone. A newer version of a game replaces
   the older one by being newer.

   The server comes with some games of its own (its "starter" games, built
   into it); the first time it runs, it puts them in the folder. They're
   only put back if they're missing or older, so a game removed on purpose
   is noticed by its file being gone - see STARTERS_DONE. */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readOrlis, manifestOf, sha256 } from './orlis-file.js';
import { Fail, Raw } from './http.js';

const newer = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++){ if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
};

export function store(dataDir, starters = []){
  const dir = join(dataDir, 'games');
  mkdirSync(dir, { recursive: true });

  /* the starter games, put in (or brought up to date) on start */
  const done = join(dir, '.starters');
  const had = existsSync(done) ? new Set(readFileSync(done, 'utf8').split('\n').filter(Boolean)) : new Set();
  for (const { name, data } of starters){
    try {
      const m = manifestOf(readOrlis(data));
      const target = join(dir, name);
      const there = existsSync(target) ? (() => { try { return manifestOf(readOrlis(readFileSync(target))); } catch { return null; } })() : null;
      const key = `${m.id}@${m.version}`;
      /* new to this server, or an update to one it has - but not one the
         owner took out after it was put in */
      if ((!there && !had.has(m.id)) || (there && newer(m.version, there.version))) writeFileSync(target, data);
      had.add(m.id); had.add(key);
    } catch (e){ console.error(`starter game ${name} skipped: ${e.message}`); }
  }
  writeFileSync(done, [...had].join('\n'));

  /* what's in the folder now: read again whenever a file there changes */
  let cache = new Map();          /* file -> { mtime, size, entry } */
  function games(){
    const seen = new Map();
    for (const f of readdirSync(dir)){
      if (!f.toLowerCase().endsWith('.orlis')) continue;
      const path = join(dir, f);
      let st; try { st = statSync(path); } catch { continue; }
      let c = cache.get(f);
      if (!c || c.mtime !== st.mtimeMs || c.size !== st.size){
        try {
          const data = readFileSync(path), m = manifestOf(readOrlis(data));
          c = { mtime: st.mtimeMs, size: st.size, entry: { ...m, bytes: data.length, sha256: sha256(data), file: f } };
        } catch (e){ c = { mtime: st.mtimeMs, size: st.size, entry: null, error: e.message }; }
        cache.set(f, c);
      }
      if (!c.entry) continue;
      const prev = seen.get(c.entry.id);
      if (!prev || newer(c.entry.version, prev.version)) seen.set(c.entry.id, c.entry);
    }
    for (const f of cache.keys()) if (!existsSync(join(dir, f))) cache.delete(f);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  const pub = ({ file, ...g }) => g;

  return {
    dir, games,
    routes: (who) => [
      ['GET', '/api/store', ({ headers }) => { who(headers); return { games: games().map(pub) }; }],
      ['GET', '/api/store/:id/file', ({ headers, params }) => {
        who(headers);
        const g = games().find(x => x.id === params.id);
        if (!g) throw new Fail(404, 'no_game', 'That game isn\'t in the Store.');
        return new Raw(readFileSync(join(dir, g.file)), `${g.id}-${g.version}.orlis`);
      }]
    ]
  };
}
