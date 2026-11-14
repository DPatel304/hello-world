/* Games creators send in, and the owner's OK.

   A creator (or the owner) sends a game's .orlis file. The server checks it
   first, trusting nothing the creator's own PC said: that it's a proper
   .orlis file for the sandbox (kit 2), not too big, its picture only shapes,
   and that its code reaches for nothing a game never needs (the internet,
   the app's storage, other windows...). The sandbox would stop those
   anyway; a game that tries isn't one for the family. A game's id can't
   take over another family's game, or one of Orlis Play's own.

   Then it waits - in "submissions" in the data folder - for the owner, who
   tries it (in Orlis Play's Store, "Waiting for your OK") and approves it,
   or declines it with a note for the creator. Approved, it goes into the
   Store, made by the creator's family. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { readOrlis, writeOrlis, manifestOf, sha256 } from './orlis-file.js';
import { Fail, Raw } from './http.js';
import { now } from './db.js';
import { newId } from './secure.js';

export const KIT = 2;
export const LIMITS = { waiting: 5, code: 4 * 1024 * 1024 };
/* what a game's code never needs, inside the sandbox */
export const FORBIDDEN = [
  ['fetch(', 'the internet'], ['XMLHttpRequest', 'the internet'], ['WebSocket', 'the internet'], ['EventSource', 'the internet'],
  ['sendBeacon', 'the internet'], ['RTCPeerConnection', 'the internet'], ['importScripts', 'other code'], ['import(', 'other code'],
  ['eval(', 'code made up as it runs'], ['new Function', 'code made up as it runs'], ['document.cookie', 'the app\'s storage'],
  ['localStorage', 'the app\'s storage'], ['sessionStorage', 'the app\'s storage'], ['indexedDB', 'the app\'s storage'],
  ['window.parent', 'other windows'], ['window.top', 'other windows'], ['top.location', 'other windows'], ['window.open', 'other windows'],
  ['opener', 'other windows'], ['navigator.', 'the computer\'s details'], ['Worker(', 'other code']
];
const UNSAFE_PICTURE = /<\s*script|\bon\w+\s*=|javascript:|<\s*foreign|href|<\s*image/i;

/* The checks, on a game's file. Throws, with every problem found. */
export function checkGame(bytes){
  let parts, m;
  try { parts = readOrlis(bytes); m = manifestOf(parts); }
  catch (e){ throw new Fail(400, 'not_a_game', `That isn't a game Orlis Play can use: ${e.message}.`); }
  const problems = [];
  if (m.kit !== KIT) problems.push(`it was made for a different Orlis Play (kit ${m.kit}; this one is kit ${KIT})`);
  const code = parts['game.js'];
  if (!code || !code.length) problems.push('it has no game in it');
  else if (code.length > LIMITS.code) problems.push('its code is too big');
  else {
    const js = code.toString('utf8');
    const seen = new Set();
    for (const [what, why] of FORBIDDEN) if (js.includes(what) && !seen.has(why)){ seen.add(why); problems.push(`it reaches for ${why} (${what.replace(/\($/, '')})`); }
  }
  if (!m.blurb) problems.push('it needs a line saying what the game is');
  if (m.icon && UNSAFE_PICTURE.test(m.icon.glyph)) problems.push('its picture has more than shapes in it');
  if (problems.length) throw new Fail(400, 'checks', `It didn't pass the checks: ${problems.join('; ')}.`, );
  return { parts, manifest: m };
}

export function submissions(db, dataDir, shop){
  const dir = join(dataDir, 'submissions');
  mkdirSync(dir, { recursive: true });
  const q = (sql) => db.prepare(sql);
  const out = (r) => r && ({ id: r.id, gameId: r.game_id, name: r.name, version: r.version, bytes: r.bytes, state: r.status, note: r.note, createdAt: r.created_at, decidedAt: r.decided_at,
    ...(r.email ? { by: r.email, family: r.family, sha256: r.sha256 } : {}) });
  const fileOf = (id) => join(dir, `${id}.orlis`);
  const familyName = (accountId) => {
    const r = q('SELECT h.name FROM accounts a JOIN households h ON h.id = a.household_id WHERE a.id = ?').get(accountId);
    return r ? r.name : 'A family';
  };

  return {
    dir,
    routes: (who, owner, asker) => [
      /* send a game in (the body is the .orlis file itself) */
      ['POST', '/api/submissions', ({ headers, raw }) => {
        const a = who(headers);
        if (a.role !== 'creator' && a.role !== 'owner') throw new Fail(403, 'not_creator', 'Only creators can send games in. The owner can make you one.');
        if (!raw || !raw.length) throw new Fail(400, 'no_file', 'Send the game\'s .orlis file.');
        const { manifest: m } = checkGame(raw);
        /* whose game this id is */
        const inStore = shop.games().find(g => g.id === m.id);
        if (inStore && inStore.by === 'Orlis Play' && a.role !== 'owner') throw new Fail(409, 'taken', `"${m.id}" is one of Orlis Play's own games. Give your game an id of its own.`);
        const other = q("SELECT 1 FROM submissions WHERE game_id = ? AND account_id != ? AND status IN ('waiting', 'approved')").get(m.id, a.id);
        if (other) throw new Fail(409, 'taken', `Another family already has a game called "${m.id}". Give yours an id of its own.`);
        if (q("SELECT COUNT(*) AS n FROM submissions WHERE account_id = ? AND status = 'waiting'").get(a.id).n >= LIMITS.waiting) throw new Fail(400, 'too_many', `You have ${LIMITS.waiting} games waiting already. Wait for the owner to look at them first.`);
        const sha = sha256(raw);
        const same = q("SELECT * FROM submissions WHERE account_id = ? AND sha256 = ? AND status = 'waiting'").get(a.id, sha);
        if (same) return [200, out(same)];       /* (sent twice: the same one) */
        /* an older version still waiting is replaced by this one */
        for (const r of q("SELECT id FROM submissions WHERE account_id = ? AND game_id = ? AND status = 'waiting'").all(a.id, m.id)){
          q("UPDATE submissions SET status = 'withdrawn', decided_at = ? WHERE id = ?").run(now(), r.id);
          try { unlinkSync(fileOf(r.id)); } catch {}
        }
        const id = newId();
        writeFileSync(fileOf(id), raw);
        q("INSERT INTO submissions (id, game_id, name, version, account_id, bytes, sha256, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?)").run(id, m.id, m.name, m.version, a.id, raw.length, sha, now());
        return [201, out(q('SELECT * FROM submissions WHERE id = ?').get(id))];
      }],
      /* a creator's own, with how each went; the owner (or the management
         page): every one waiting, and the latest decided */
      ['GET', '/api/submissions', ({ headers, ip, query }) => {
        const a = asker(headers, ip);
        if (a.role === 'owner' && (headers['x-orlis-manage'] !== undefined || query.get('all') === '1')){
          const rows = q(`SELECT s.*, x.email, h.name AS family FROM submissions s JOIN accounts x ON x.id = s.account_id JOIN households h ON h.id = x.household_id
            WHERE s.status = 'waiting' OR (s.status IN ('approved', 'declined') AND s.decided_at > ?) ORDER BY s.created_at DESC`).all(new Date(Date.now() - 30 * 864e5).toISOString());
          return { submissions: rows.map(out) };
        }
        return { submissions: q("SELECT * FROM submissions WHERE account_id = ? AND status != 'withdrawn' ORDER BY created_at DESC LIMIT 50").all(a.id).map(out) };
      }],
      /* the file: the owner's, to try it */
      ['GET', '/api/submissions/:id/file', ({ headers, ip, params }) => {
        owner(headers, ip);
        const r = q("SELECT * FROM submissions WHERE id = ? AND status = 'waiting'").get(params.id);
        if (!r || !existsSync(fileOf(r.id))) throw new Fail(404, 'no_submission', 'That game isn\'t waiting any more.');
        return new Raw(readFileSync(fileOf(r.id)), `${r.game_id}-${r.version}.orlis`);
      }],
      ['POST', '/api/submissions/:id/approve', ({ headers, ip, params }) => {
        owner(headers, ip);
        const r = q("SELECT * FROM submissions WHERE id = ? AND status = 'waiting'").get(params.id);
        if (!r || !existsSync(fileOf(r.id))) throw new Fail(404, 'no_submission', 'That game isn\'t waiting any more.');
        /* into the Store, made by the creator's family */
        const { parts, manifest } = checkGame(readFileSync(fileOf(r.id)));
        const raw = JSON.parse(parts['manifest.json'].toString('utf8'));
        raw.by = familyName(r.account_id);
        /* a starter game - one new games can start from - only if the owner
           made it, whatever the file says */
        const maker = q('SELECT role FROM accounts WHERE id = ?').get(r.account_id);
        raw.starter = !!maker && maker.role === 'owner';
        const file = writeOrlis({ 'manifest.json': JSON.stringify(raw, null, 2), 'game.js': parts['game.js'] });
        writeFileSync(join(shop.dir, `${manifest.id}.orlis`), file);
        q("UPDATE submissions SET status = 'approved', decided_at = ? WHERE id = ?").run(now(), r.id);
        try { unlinkSync(fileOf(r.id)); } catch {}
        return { ok: true, game: { id: manifest.id, name: manifest.name, version: manifest.version, by: raw.by } };
      }],
      ['POST', '/api/submissions/:id/decline', ({ headers, ip, params, body }) => {
        owner(headers, ip);
        const note = (typeof body.note === 'string' ? body.note : '').trim().slice(0, 300);
        const r = q("UPDATE submissions SET status = 'declined', note = ?, decided_at = ? WHERE id = ? AND status = 'waiting'").run(note, now(), params.id);
        if (!r.changes) throw new Fail(404, 'no_submission', 'That game isn\'t waiting any more.');
        try { unlinkSync(fileOf(params.id)); } catch {}
        return { ok: true };
      }],
      /* the creator takes one back, while it's waiting */
      ['DELETE', '/api/submissions/:id', ({ headers, params }) => {
        const a = who(headers);
        const r = q("UPDATE submissions SET status = 'withdrawn', decided_at = ? WHERE id = ? AND account_id = ? AND status = 'waiting'").run(now(), params.id, a.id);
        if (!r.changes) throw new Fail(404, 'no_submission', 'That game isn\'t waiting any more.');
        try { unlinkSync(fileOf(params.id)); } catch {}
        return { ok: true };
      }]
    ]
  };
}
