import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start } from '../src/app.js';
import { writeOrlis, readOrlis, manifestOf } from '../src/orlis-file.js';

const ICON = { cols: ['#6366f1', '#c084fc'], glyph: '<circle cx="50" cy="50" r="30" fill="#fff"/>' };
const game = (id, { version = '1.0', code = 'postMessage({ t: "ready" });', kit = 2, blurb = 'Flap to fly', icon = ICON, name = 'Bird Hoops' } = {}) =>
  writeOrlis({ 'manifest.json': JSON.stringify({ format: 1, kit, id, name, version, blurb, players: [1, 4], icon, by: 'Me, honest' }), 'game.js': code });

async function server(){
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-sub-'));
  const s = await start({ dataDir, port: 0, discoveryPort: false, starters: [{ name: 'pop-party.orlis', data: writeOrlis({ 'manifest.json': JSON.stringify({ format: 1, kit: 2, id: 'pop-party', name: 'Pop Party', version: '1.1', by: 'Orlis Play', blurb: 'x' }), 'game.js': 'x' }) }] });
  const base = `http://127.0.0.1:${s.port}`;
  const call = async (method, path, body, token, extra = {}) => {
    const file = Buffer.isBuffer(body);
    const r = await fetch(base + path, { method, headers: { 'Content-Type': file ? 'application/octet-stream' : 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: file ? body : body ? JSON.stringify(body) : undefined });
    const type = r.headers.get('content-type') || '';
    return type.includes('json') ? { status: r.status, ...(await r.json()) } : { status: r.status, bytes: Buffer.from(await r.arrayBuffer()) };
  };
  const owner = await call('POST', '/api/signup', { email: 'deep@example.com', password: 'correct horse', name: 'Deep', adult: true, family: 'The Patels' });
  const inv = await call('POST', '/api/invites', { household: 'new', role: 'creator' }, owner.token);
  const friend = await call('POST', '/api/signup', { email: 'max@example.com', password: 'correct horse', name: 'Max', adult: true, invite: inv.code });
  const inv2 = await call('POST', '/api/invites', { household: 'new' }, owner.token);
  const player = await call('POST', '/api/signup', { email: 'pat@example.com', password: 'correct horse', name: 'Pat', adult: true, invite: inv2.code });
  return { s, dataDir, call, owner: owner.token, friend: friend.token, player: player.token };
}

test('a creator sends a game in; the owner tries it and approves it; it is in the Store, made by their family', async () => {
  const { s, dataDir, call, owner, friend } = await server();
  try {
    const sent = await call('POST', '/api/submissions', game('bird-hoops'), friend);
    assert.equal(sent.status, 201); assert.equal(sent.gameId, 'bird-hoops');
    assert.equal((await call('POST', '/api/submissions', game('bird-hoops'), friend)).id, sent.id, 'the same file twice is the same one');
    assert.equal((await call('GET', '/api/store', null, friend)).games.some(g => g.id === 'bird-hoops'), false, 'not in the Store yet');
    const mine = await call('GET', '/api/submissions', null, friend);
    assert.deepEqual(mine.submissions.map(x => [x.name, x.state]), [['Bird Hoops', 'waiting']]);
    const all = await call('GET', '/api/submissions?all=1', null, owner);
    assert.equal(all.submissions[0].family, "Max's family");
    const file = await call('GET', `/api/submissions/${sent.id}/file`, null, owner);
    assert.equal(manifestOf(readOrlis(file.bytes)).id, 'bird-hoops');
    assert.equal((await call('GET', `/api/submissions/${sent.id}/file`, null, friend)).status, 403, 'only the owner tries them');
    const ok = await call('POST', `/api/submissions/${sent.id}/approve`, null, owner);
    assert.equal(ok.game.by, "Max's family", "the creator's family, whatever the file said");
    const g = (await call('GET', '/api/store', null, friend)).games.find(x => x.id === 'bird-hoops');
    assert.equal(g.by, "Max's family");
    assert.ok(existsSync(join(dataDir, 'games', 'bird-hoops.orlis')));
    assert.equal((await call('GET', '/api/submissions', null, friend)).submissions[0].state, 'approved');
    /* a newer version, sent later */
    assert.equal((await call('POST', '/api/submissions', game('bird-hoops', { version: '1.1' }), friend)).status, 201);
  } finally { await s.close(); }
});

test('declined, with a note for the creator; a creator can take one back', async () => {
  const { s, call, owner, friend } = await server();
  try {
    const a = await call('POST', '/api/submissions', game('star-hop'), friend);
    assert.equal((await call('POST', `/api/submissions/${a.id}/decline`, { note: 'Make the stars bigger, please' }, owner)).ok, true);
    const mine = (await call('GET', '/api/submissions', null, friend)).submissions;
    assert.deepEqual([mine[0].state, mine[0].note], ['declined', 'Make the stars bigger, please']);
    const b = await call('POST', '/api/submissions', game('star-hop', { version: '1.1' }), friend);
    assert.equal((await call('DELETE', `/api/submissions/${b.id}`, null, friend)).ok, true);
    assert.equal((await call('POST', `/api/submissions/${b.id}/approve`, null, owner)).status, 404, 'taken back');
  } finally { await s.close(); }
});

test("the checks: a proper game for the sandbox, reaching for nothing it shouldn't", async () => {
  const { s, call, friend } = await server();
  try {
    const no = async (bytes) => (await call('POST', '/api/submissions', bytes, friend));
    assert.equal((await no(Buffer.from('not a game'))).error, 'not_a_game');
    assert.match((await no(game('a1', { kit: 1 }))).message, /different Orlis Play/);
    assert.match((await no(game('a2', { code: 'fetch("https://x.y")' }))).message, /the internet/);
    assert.match((await no(game('a3', { code: 'localStorage.x = 1' }))).message, /storage/);
    assert.match((await no(game('a4', { code: 'window.parent.postMessage(1)' }))).message, /other windows/);
    assert.match((await no(game('a5', { code: 'eval("1")' }))).message, /made up as it runs/);
    assert.match((await no(game('a6', { blurb: '' }))).message, /what the game is/);
    assert.match((await no(game('a7', { icon: { cols: ['#000'], glyph: '<circle onload="x()"/>' } }))).message, /more than shapes/);
    assert.equal((await call('GET', '/api/submissions', null, friend)).submissions.length, 0, 'nothing kept');
  } finally { await s.close(); }
});

test("who may send what: creators only; not Orlis Play's own games, not another family's", async () => {
  const { s, call, owner, friend, player } = await server();
  try {
    assert.equal((await call('POST', '/api/submissions', game('mine'), player)).error, 'not_creator');
    assert.equal((await call('POST', '/api/submissions', game('pop-party'), friend)).error, 'taken');
    assert.equal((await call('POST', '/api/submissions', game('dino-dash'), owner)).status, 201, 'the owner can send games too');
    assert.equal((await call('POST', '/api/submissions', game('dino-dash'), friend)).error, 'taken', "another family's");
    for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/submissions', game(`g${i}`), friend)).status, 201);
    assert.equal((await call('POST', '/api/submissions', game('g9'), friend)).error, 'too_many');
    const r = await fetch(`http://127.0.0.1:${s.port}/api/submissions`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${friend}` }, body: Buffer.alloc(9 * 1024 * 1024) });
    assert.equal(r.status, 413, 'too big to send');
  } finally { await s.close(); }
});

test('the management page sees what is waiting, and can approve', async () => {
  const { s, call, friend } = await server();
  try {
    const a = await call('POST', '/api/submissions', game('bird-hoops'), friend);
    const key = { 'X-Orlis-Manage': s.manageKey };
    const list = await call('GET', '/api/submissions', null, null, key);
    assert.deepEqual(list.submissions.map(x => x.id), [a.id]);
    assert.equal((await call('POST', `/api/submissions/${a.id}/approve`, null, null, key)).ok, true);
  } finally { await s.close(); }
});
