import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { start } from '../src/app.js';
import { backups, KEEP } from '../src/backup.js';
import { writeOrlis } from '../src/orlis-file.js';

const game = (id) => writeOrlis({ 'manifest.json': JSON.stringify({ format: 1, kit: 2, id, name: id, version: '1.0' }), 'game.js': '' });
const fresh = () => mkdtempSync(join(tmpdir(), 'orlis-backup-'));
async function server(dataDir, opts = {}){
  const s = await start({ dataDir, port: 0, discoveryPort: false, starters: [{ name: 'pop-party.orlis', data: game('pop-party') }], ...opts });
  const base = `http://127.0.0.1:${s.port}`;
  const call = async (method, path, body, token) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...(await r.json()) };
  };
  return { s, call };
}

test('a backup has the accounts and profiles, and the Store\'s games', async () => {
  const dir = fresh(), { s, call } = await server(dir);
  try {
    const me = await call('POST', '/api/signup', { email: 'p@example.com', password: 'correct horse', name: 'Sam', adult: true });
    await call('POST', '/api/profiles', { name: 'Ellie', avatar: 'star' }, me.token);
    const b = s.backups.make('manual', s.db);
    assert.equal(b.reason, 'manual'); assert.equal(b.accounts, 1); assert.equal(b.profiles, 2); assert.equal(b.games, 1);
    const copy = new DatabaseSync(join(dir, 'backups', b.id, 'orlis.db'));
    assert.deepEqual(copy.prepare('SELECT name FROM profiles ORDER BY name').all().map(r => r.name), ['Ellie', 'Sam']);
    copy.close();
    assert.deepEqual(readdirSync(join(dir, 'backups', b.id, 'games')).sort(), ['.starters', 'pop-party.orlis']);
  } finally { await s.close(); }
});

test('a daily backup is made once a day; only the newest are kept', () => {
  const dir = fresh();
  let t = Date.parse('2026-11-01T10:00:00Z');
  const b = backups(dir, { now: () => new Date(t) });
  assert.ok(b.daily());
  t += 60 * 60 * 1000;
  assert.equal(b.daily(), null, 'not again the same day');
  for (let d = 0; d < 10; d++){ t += 25 * 60 * 60 * 1000; b.daily(); }
  assert.equal(b.list().filter(x => x.reason === 'daily').length, KEEP.daily);
  for (let k = 0; k < 8; k++){ t += 1000; b.make('manual'); }
  assert.equal(b.list().filter(x => x.reason === 'manual').length, KEEP.manual);
});

test('a restore: asked for, done as the server starts again, and itself undoable', async () => {
  const dir = fresh();
  let { s, call } = await server(dir);
  const me = await call('POST', '/api/signup', { email: 'p@example.com', password: 'correct horse', name: 'Sam', adult: true });
  const saved = (await call('POST', '/api/backups', null, me.token));
  assert.equal(saved.status, 201);
  await call('POST', '/api/profiles', { name: 'Late', avatar: 'cat' }, me.token);
  const r = await call('POST', `/api/backups/${saved.id}/restore`, null, me.token);
  assert.equal(r.ok, true); assert.equal(r.restarting, false, 'no way to restart here: on the next start');
  assert.equal((await call('GET', '/api/server', null, me.token)).restoring, saved.id);
  await s.close();
  ({ s, call } = await server(dir));
  try {
    assert.equal(s.restored.id, saved.id);
    const again = await call('POST', '/api/signin', { email: 'p@example.com', password: 'correct horse' });
    assert.deepEqual(again.profiles.map(p => p.name), ['Sam'], 'back to how it was');
    const info = await call('GET', '/api/server', null, again.token);
    assert.equal(info.restored, saved.id); assert.equal(info.restoring, null);
    assert.ok(info.backups.some(b => b.reason === 'before-restore' && b.profiles === null || b.reason === 'before-restore'), 'the data as it was is kept too');
  } finally { await s.close(); }
});

test("the owner's routes are the owner's; a game can be taken out of the Store", async () => {
  const dir = fresh(), { s, call } = await server(dir);
  try {
    const me = await call('POST', '/api/signup', { email: 'p@example.com', password: 'correct horse', name: 'Sam', adult: true });
    const inv = await call('POST', '/api/invites', { role: 'player' }, me.token);
    const friend = await call('POST', '/api/signup', { email: 'f@example.com', password: 'correct horse', name: 'Max', adult: true, invite: inv.code });
    for (const [m, p] of [['GET', '/api/server'], ['POST', '/api/backups'], ['DELETE', '/api/store/pop-party']]) assert.equal((await call(m, p, null, friend.token)).status, 403, p);
    assert.equal((await call('POST', '/api/backups/nope/restore', null, me.token)).status, 404);
    const info = await call('GET', '/api/server', null, me.token);
    assert.equal(info.version, '0.1.0'); assert.equal(info.update.state, 'off');
    assert.equal((await call('DELETE', '/api/store/pop-party', null, me.token)).ok, true);
    assert.equal((await call('GET', '/api/store', null, me.token)).games.length, 0);
    assert.equal((await call('DELETE', '/api/store/pop-party', null, me.token)).status, 404);
    assert.ok(!existsSync(join(dir, 'games', 'pop-party.orlis')));
  } finally { await s.close(); }
});
