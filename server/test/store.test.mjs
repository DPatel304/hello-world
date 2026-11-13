import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';
import { writeOrlis, readOrlis, manifestOf } from '../src/orlis-file.js';

const game = (id, version, name = 'Test Game') => writeOrlis({
  'manifest.json': JSON.stringify({ format: 1, kit: 1, id, name, version, blurb: 'A test', players: [1, 4] }),
  'game.js': `export default { id: '${id}', name: '${name}', create(){ return {}; } };`
});

async function fresh(starters = [], dataDir = mkdtempSync(join(tmpdir(), 'orlis-store-'))){
  const s = await start({ dataDir, port: 0, discoveryPort: false, starters });
  const base = `http://127.0.0.1:${s.port}`;
  const call = async (method, path, body, token) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const type = r.headers.get('content-type') || '';
    return type.includes('json') ? { status: r.status, ...(await r.json()) } : { status: r.status, bytes: Buffer.from(await r.arrayBuffer()), name: r.headers.get('content-disposition') };
  };
  const me = await call('POST', '/api/signup', { email: 'p@example.com', password: 'correct horse', name: 'Sam', adult: true });
  return { s, dataDir, call, token: me.token };
}

test('.orlis files round-trip, and their manifests are checked', () => {
  const f = game('pop-party', '1.0', 'Pop Party');
  const parts = readOrlis(f);
  assert.equal(manifestOf(parts).name, 'Pop Party');
  assert.match(parts['game.js'].toString(), /export default/);
  assert.throws(() => readOrlis(Buffer.from('nope')), /not an .orlis file/);
  assert.throws(() => manifestOf(readOrlis(writeOrlis({ 'manifest.json': '{"format":1,"id":"Bad Id!","name":"x","version":"1.0"}', 'game.js': '' }))), /bad game id/);
  const broken = Buffer.from(f); broken[60] ^= 0xff;      /* (inside the first part's data) */
  assert.throws(() => readOrlis(broken));
});

test('a new server comes with its starter games, in the Store', async () => {
  const { s, call, token } = await fresh([{ name: 'pop-party.orlis', data: game('pop-party', '1.0', 'Pop Party') }]);
  try {
    const list = await call('GET', '/api/store', null, token);
    assert.deepEqual(list.games.map(g => [g.id, g.name, g.version]), [['pop-party', 'Pop Party', '1.0']]);
    assert.ok(list.games[0].sha256.length === 64 && list.games[0].bytes > 100);
    assert.equal(list.games[0].file, undefined, 'the server\'s own file names stay private');
  } finally { await s.close(); }
});

test('downloading a game: signed in only, the file as it is', async () => {
  const { s, call, token } = await fresh([{ name: 'pop-party.orlis', data: game('pop-party', '1.0') }]);
  try {
    assert.equal((await call('GET', '/api/store/pop-party/file')).status, 401);
    const got = await call('GET', '/api/store/pop-party/file', null, token);
    assert.equal(got.status, 200);
    assert.equal(manifestOf(readOrlis(got.bytes)).id, 'pop-party');
    assert.match(got.name, /pop-party-1\.0\.orlis/);
    assert.equal((await call('GET', '/api/store/nothing/file', null, token)).status, 404);
  } finally { await s.close(); }
});

test('the owner adds a game by dropping its file in the games folder; a newer version wins', async () => {
  const { s, call, token } = await fresh();
  try {
    assert.equal((await call('GET', '/api/store', null, token)).games.length, 0);
    writeFileSync(join(s.store.dir, 'castle.orlis'), game('castle', '1.0', 'Castle'));
    writeFileSync(join(s.store.dir, 'castle-new.orlis'), game('castle', '1.2', 'Castle'));
    writeFileSync(join(s.store.dir, 'junk.orlis'), 'not a game');
    const list = await call('GET', '/api/store', null, token);
    assert.deepEqual(list.games.map(g => [g.id, g.version]), [['castle', '1.2']], 'one entry, the newest; junk ignored');
    unlinkSync(join(s.store.dir, 'castle-new.orlis'));
    assert.equal((await call('GET', '/api/store', null, token)).games[0].version, '1.0');
  } finally { await s.close(); }
});

test('starter games: an update replaces an older one, but one the owner removed stays removed', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-store-'));
  let r = await fresh([{ name: 'pop-party.orlis', data: game('pop-party', '1.0') }], dataDir);
  const file = join(r.s.store.dir, 'pop-party.orlis');
  await r.s.close();
  r = { s: await start({ dataDir, port: 0, discoveryPort: false, starters: [{ name: 'pop-party.orlis', data: game('pop-party', '1.1') }] }) };
  assert.equal(r.s.store.games()[0].version, '1.1', 'brought up to date');
  await r.s.close();
  unlinkSync(file);
  r = { s: await start({ dataDir, port: 0, discoveryPort: false, starters: [{ name: 'pop-party.orlis', data: game('pop-party', '1.1') }] }) };
  assert.ok(!existsSync(file), 'not put back');
  assert.equal(r.s.store.games().length, 0);
  await r.s.close();
});
