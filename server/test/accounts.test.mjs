import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSocket } from 'node:dgram';
import { start } from '../src/app.js';
import { HELLO } from '../src/discovery.js';
import { LIMITS } from '../src/api.js';

/* A fresh server on a spare port, with its own empty data folder. */
async function fresh(){
  const dataDir = mkdtempSync(join(tmpdir(), 'orlis-'));
  const s = await start({ dataDir, port: 0, discoveryPort: 0, name: 'Test Orlis' });
  const call = async (method, path, body, token) => {
    const r = await fetch(`http://127.0.0.1:${s.port}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: r.status, ...(await r.json()) };
  };
  return { s, dataDir, call };
}
const grownUp = (email, extra = {}) => ({ email, password: 'correct horse', name: 'Sam', adult: true, device: 'Laptop', ...extra });

test('a new server asks to be set up; the first account is the owner and needs no invite', async () => {
  const { s, call } = await fresh();
  try {
    assert.deepEqual(await call('GET', '/api/hello'), { status: 200, app: 'orlis', name: 'Test Orlis', version: '0.1.0', setup: true });
    const me = await call('POST', '/api/signup', grownUp('Parent@Example.com'));
    assert.equal(me.status, 201);
    assert.equal(me.account.role, 'owner');
    assert.equal(me.account.email, 'parent@example.com', 'emails are kept in lower case');
    assert.deepEqual(me.profiles.map(p => p.name), ['Sam'], 'their own profile comes with it');
    assert.ok(me.token.length >= 40);
    assert.equal((await call('GET', '/api/hello')).setup, false);
  } finally { await s.close(); }
});

test('after that, joining needs an invite from the owner - used once, with its role', async () => {
  const { s, call } = await fresh();
  try {
    const owner = await call('POST', '/api/signup', grownUp('owner@example.com'));
    assert.equal((await call('POST', '/api/signup', grownUp('friend@example.com'))).error, 'bad_invite');
    const inv = await call('POST', '/api/invites', { role: 'creator', household: 'new' }, owner.token);
    assert.match(inv.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const friend = await call('POST', '/api/signup', grownUp('friend@example.com', { invite: inv.code.toLowerCase().replace('-', ' ') }));
    assert.equal(friend.status, 201, 'typed any old way, the code still works');
    assert.equal(friend.account.role, 'creator');
    assert.equal((await call('POST', '/api/signup', grownUp('third@example.com', { invite: inv.code }))).error, 'bad_invite', 'once only');
    const list = await call('GET', '/api/invites', null, owner.token);
    assert.equal(list.invites[0].usedBy, 'friend@example.com');
    assert.equal((await call('POST', '/api/invites', { household: 'new' }, friend.token)).status, 403, 'only the owner invites a new family');
    assert.equal((await call('POST', '/api/invites', { role: 'creator' }, friend.token)).status, 403, 'only the owner makes a creator');
    assert.equal((await call('POST', '/api/invites', {}, friend.token)).status, 201, 'a parent can invite another grown-up into their own family');
  } finally { await s.close(); }
});

test('accounts are for grown-ups; profiles carry no contact details', async () => {
  const { s, call } = await fresh();
  try {
    assert.equal((await call('POST', '/api/signup', grownUp('a@example.com', { adult: false }))).error, 'adult');
    assert.equal((await call('POST', '/api/signup', grownUp('not-an-email'))).error, 'bad_email');
    assert.equal((await call('POST', '/api/signup', grownUp('a@example.com', { password: 'short' }))).error, 'short_password');
    const me = await call('POST', '/api/signup', grownUp('a@example.com'));
    for (const bad of ['kid@example.com', '07700 900123', 'https://x.y', '', 'x'.repeat(21)]){
      assert.equal((await call('POST', '/api/profiles', { name: bad }, me.token)).error, 'bad_name', `rejects ${JSON.stringify(bad)}`);
    }
    assert.equal((await call('POST', '/api/profiles', { name: 'Ollie', avatar: 'nope' }, me.token)).error, 'bad_avatar');
  } finally { await s.close(); }
});

test('a family manages its kids\' profiles - only its own', async () => {
  const { s, call } = await fresh();
  try {
    const me = await call('POST', '/api/signup', grownUp('a@example.com'));
    const kid = await call('POST', '/api/profiles', { name: 'Ollie', avatar: 'rocket' }, me.token);
    assert.equal(kid.status, 201);
    assert.equal((await call('PATCH', `/api/profiles/${kid.id}`, { avatar: 'dino' }, me.token)).avatar, 'dino');
    const other = await call('POST', '/api/signup', grownUp('b@example.com', { invite: (await call('POST', '/api/invites', { household: 'new' }, me.token)).code }));
    assert.equal((await call('DELETE', `/api/profiles/${kid.id}`, null, other.token)).status, 404, 'not another family\'s');
    assert.equal((await call('GET', '/api/me', null, me.token)).profiles.length, 2);
    for (let i = 2; i < LIMITS.profiles; i++) await call('POST', '/api/profiles', { name: `Kid ${String.fromCharCode(65 + i)}` }, me.token);
    assert.equal((await call('POST', '/api/profiles', { name: 'One more' }, me.token)).error, 'full');
    const solo = await call('GET', '/api/me', null, other.token);
    assert.equal((await call('DELETE', `/api/profiles/${solo.profiles[0].id}`, null, other.token)).error, 'last', 'keeps at least one');
  } finally { await s.close(); }
});

test('signing in and out; wrong passwords pause after a few tries', async () => {
  const { s, call } = await fresh();
  try {
    await call('POST', '/api/signup', grownUp('a@example.com'));
    const ok = await call('POST', '/api/signin', { email: 'A@example.com', password: 'correct horse', device: 'TV' });
    assert.equal(ok.status, 200);
    assert.equal((await call('GET', '/api/me', null, ok.token)).account.email, 'a@example.com');
    assert.equal((await call('POST', '/api/signin', { email: 'nobody@example.com', password: 'x' })).error, 'wrong', 'the same answer for no such account');
    for (let i = 0; i < LIMITS.tries; i++) assert.equal((await call('POST', '/api/signin', { email: 'a@example.com', password: 'wrong one' })).error, 'wrong');
    assert.equal((await call('POST', '/api/signin', { email: 'a@example.com', password: 'correct horse' })).error, 'paused');
    assert.equal((await call('POST', '/api/signout', null, ok.token)).ok, true);
    assert.equal((await call('GET', '/api/me', null, ok.token)).status, 401, 'signed out means signed out');
    assert.equal((await call('GET', '/api/me', null, 'made-up')).status, 401);
  } finally { await s.close(); }
});

test('passwords and session tokens are never stored as themselves', async () => {
  const { s, call } = await fresh();
  try {
    const me = await call('POST', '/api/signup', grownUp('a@example.com'));
    const row = s.db.prepare('SELECT password_hash FROM accounts').get();
    assert.match(row.password_hash, /^scrypt\$/);
    assert.ok(!row.password_hash.includes('correct horse'));
    const ses = s.db.prepare('SELECT token_hash FROM sessions').all();
    assert.ok(ses.every(x => x.token_hash !== me.token));
  } finally { await s.close(); }
});

test('the owner sets roles, but stays the owner', async () => {
  const { s, call } = await fresh();
  try {
    const owner = await call('POST', '/api/signup', grownUp('o@example.com'));
    const p = await call('POST', '/api/signup', grownUp('p@example.com', { invite: (await call('POST', '/api/invites', {}, owner.token)).code }));
    assert.equal(p.account.role, 'player');
    assert.equal((await call('POST', `/api/accounts/${p.account.id}/role`, { role: 'creator' }, owner.token)).role, 'creator');
    assert.equal((await call('POST', `/api/accounts/${owner.account.id}/role`, { role: 'player' }, owner.token)).error, 'self');
    assert.equal((await call('POST', `/api/accounts/${p.account.id}/role`, { role: 'owner' }, owner.token)).error, 'bad_role');
    assert.equal((await call('GET', '/api/accounts', null, p.token)).status, 403);
    assert.equal((await call('GET', '/api/accounts', null, owner.token)).accounts.length, 2);
  } finally { await s.close(); }
});

test('the data survives a restart', async () => {
  const { s, dataDir, call } = await fresh();
  await call('POST', '/api/signup', grownUp('a@example.com'));
  await s.close();
  const again = await start({ dataDir, port: 0, discoveryPort: false });
  try {
    const r = await fetch(`http://127.0.0.1:${again.port}/api/signin`, { method: 'POST', body: JSON.stringify({ email: 'a@example.com', password: 'correct horse' }) });
    assert.equal(r.status, 200);
  } finally { await again.close(); }
});

test('an app on the Wi-Fi asking "orlis?" is told where the server is', async () => {
  const { s } = await fresh();
  const sock = createSocket('udp4');
  try {
    const reply = await new Promise((ok, no) => {
      const t = setTimeout(() => no(new Error('no answer')), 2000);
      sock.on('message', (m) => { clearTimeout(t); ok(JSON.parse(m.toString())); });
      sock.bind(0, () => {
        const d = s.discovery.address().port;
        sock.send(Buffer.from(HELLO), d, '127.0.0.1');
      });
    });
    assert.equal(reply.app, 'orlis');
    assert.equal(reply.name, 'Test Orlis');
    assert.equal(reply.port, s.port, 'and the port its web side is on');
  } finally { sock.close(); await s.close(); }
});

test('nonsense is turned away politely', async () => {
  const { s, call } = await fresh();
  try {
    assert.equal((await call('GET', '/api/nothing')).status, 404);
    const r = await fetch(`http://127.0.0.1:${s.port}/api/signin`, { method: 'POST', body: '{not json' });
    assert.equal(r.status, 400);
    const big = await fetch(`http://127.0.0.1:${s.port}/api/signin`, { method: 'POST', body: 'x'.repeat(70 * 1024) }).catch(() => ({ status: 413 }));
    assert.equal(big.status, 413);
    const pre = await fetch(`http://127.0.0.1:${s.port}/api/me`, { method: 'OPTIONS' });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  } finally { await s.close(); }
});

test('families: a new family is its own; a second parent shares the kids', async () => {
  const { s, call } = await fresh();
  try {
    const me = await call('POST', '/api/signup', grownUp('me@example.com', { name: 'Deep', family: 'The Patels' }));
    assert.equal(me.household.name, 'The Patels');
    await call('POST', '/api/profiles', { name: 'Ellie', avatar: 'star' }, me.token);
    /* a second parent, into this family */
    const join = await call('POST', '/api/invites', {}, me.token);
    const partner = await call('POST', '/api/signup', grownUp('partner@example.com', { name: 'Sam', invite: join.code }));
    assert.equal(partner.household.id, me.household.id);
    assert.deepEqual(partner.profiles.map(p => p.name), ['Deep', 'Ellie', 'Sam'], 'the same kids, from either parent');
    const ellie = partner.profiles.find(p => p.name === 'Ellie');
    assert.equal((await call('PATCH', `/api/profiles/${ellie.id}`, { avatar: 'owl' }, partner.token)).avatar, 'owl');
    const deep = partner.profiles.find(p => p.name === 'Deep');
    assert.equal((await call('DELETE', `/api/profiles/${deep.id}`, null, partner.token)).error, 'last', "each grown-up keeps their own profile");
    /* a friend's family: separate */
    const fresh2 = await call('POST', '/api/invites', { household: 'new' }, me.token);
    const friend = await call('POST', '/api/signup', grownUp('friend@example.com', { name: 'Max', invite: fresh2.code }));
    assert.notEqual(friend.household.id, me.household.id);
    assert.equal(friend.household.name, "Max's family");
    assert.deepEqual(friend.profiles.map(p => p.name), ['Max'], "none of the Patels' kids");
    assert.equal((await call('PATCH', `/api/profiles/${ellie.id}`, { avatar: 'cat' }, friend.token)).status, 404);
    assert.equal((await call('PATCH', '/api/household', { name: 'The Maxes' }, friend.token)).name, 'The Maxes');
    assert.equal((await call('GET', '/api/me', null, me.token)).household.name, 'The Patels', 'each names only their own');
    assert.deepEqual((await call('GET', '/api/household', null, partner.token)).accounts.map(x => x.email), ['me@example.com', 'partner@example.com']);
    assert.deepEqual((await call('GET', '/api/household', null, friend.token)).accounts.map(x => x.email), ['friend@example.com']);
    /* the owner sees every family, but not other families' kids by name */
    const all = await call('GET', '/api/households', null, me.token);
    assert.deepEqual(all.households.map(h => [h.name, h.accounts.length, h.profiles]), [['The Patels', 2, 3], ['The Maxes', 1, 1]]);
    assert.ok(!JSON.stringify(all).includes('Ellie'));
    assert.equal((await call('GET', '/api/households', null, friend.token)).status, 403);
    /* invites: a parent sees their own; the owner sees all */
    const mine = await call('POST', '/api/invites', {}, friend.token);
    assert.deepEqual((await call('GET', '/api/invites', null, friend.token)).invites.map(i => i.code), [mine.code]);
    assert.ok((await call('GET', '/api/invites', null, me.token)).invites.length >= 3);
  } finally { await s.close(); }
});

test("an older server's data moves into families: each account its own, named after its grown-up", async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { openDb, STEPS } = await import('../src/db.js');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const file = join(mkdtempSync(join(tmpdir(), 'orlis-old-')), 'orlis.db');
  const old = new DatabaseSync(file);
  old.exec(STEPS[0]);
  old.exec('CREATE TABLE schema_version (version INTEGER NOT NULL); INSERT INTO schema_version VALUES (1);');
  old.exec(`INSERT INTO accounts VALUES ('a1', 'deep@example.com', 'x', 'owner', '2026-01-01'), ('a2', 'max@example.com', 'x', 'player', '2026-01-02');
    INSERT INTO profiles VALUES ('p1', 'a1', 'Deep', 'cube', '2026-01-01'), ('p2', 'a1', 'Ellie', 'star', '2026-01-03'), ('p3', 'a2', 'Max', 'dog', '2026-01-02');`);
  old.close();
  const db = openDb(file);
  const rows = db.prepare('SELECT a.email, h.name FROM accounts a JOIN households h ON h.id = a.household_id ORDER BY a.email').all().map(r => [r.email, r.name]);
  assert.deepEqual(rows, [['deep@example.com', "Deep's family"], ['max@example.com', "Max's family"]]);
  assert.equal(db.prepare('SELECT version FROM schema_version').get().version, STEPS.length);
  db.close();
});
