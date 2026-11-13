import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, sign, randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { genuine, updater, newer, PUBKEY, AFTER_UPDATE } from '../src/update.js';

/* A signing key of our own, in the same shape as Orlis Play's (minisign). */
function keypair(){
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  const id = randomBytes(8);
  const pub = Buffer.from(`untrusted comment: test key\n${Buffer.concat([Buffer.from('Ed'), id, raw]).toString('base64')}\n`).toString('base64');
  const signFile = (file) => {
    const s = sign(null, createHash('blake2b512').update(file).digest(), privateKey);
    const trusted = 'timestamp:1\tfile:x';
    const g = sign(null, Buffer.concat([s, Buffer.from(trusted)]), privateKey);
    return Buffer.from(`untrusted comment: sig\n${Buffer.concat([Buffer.from('ED'), id, s]).toString('base64')}\ntrusted comment: ${trusted}\n${g.toString('base64')}\n`).toString('base64');
  };
  return { pub, signFile };
}

test("the server trusts Orlis Play's own update key, and nothing else", () => {
  const conf = JSON.parse(readFileSync(new URL('../../astra-park/client/src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  assert.equal(PUBKEY, conf.plugins.updater.pubkey);
  const k = keypair(), other = keypair();
  const file = randomBytes(5000), sig = k.signFile(file);
  assert.equal(genuine(file, sig, k.pub), true);
  const bent = Buffer.from(file); bent[100] ^= 1;
  assert.equal(genuine(bent, sig, k.pub), false, 'one byte changed');
  assert.equal(genuine(file, sig, other.pub), false, 'signed by someone else');
  assert.equal(genuine(file, 'nonsense', k.pub), false);
  assert.equal(genuine(file, sig), false, 'not signed with the real key');
});

test('versions compare as numbers', () => {
  assert.ok(newer('0.1.12', '0.1.9')); assert.ok(!newer('0.1.9', '0.1.9')); assert.ok(newer('0.2.0', '0.1.99'));
});

function setup({ version = '0.1.20', bytes = Buffer.from('NEW EXE'), signWith, idle = () => true } = {}){
  const dir = mkdtempSync(join(tmpdir(), 'orlis-update-'));
  const exe = join(dir, 'Orlis Server.exe'), dataDir = join(dir, 'Orlis Server data');
  writeFileSync(exe, 'OLD EXE');
  mkdirSync(dataDir); writeFileSync(join(dataDir, 'orlis.db'), 'the family');
  const k = keypair();
  const feed = { version, url: 'https://x/Orlis-Server-new.exe', sha256: createHash('sha256').update(bytes).digest('hex'), signature: (signWith || k).signFile(bytes) };
  const seen = { spawned: null, exited: null, closed: 0, logs: [] };
  const u = updater({
    version: '0.1.10', exe, dataDir, pub: k.pub, wait: 5,
    close: async () => { seen.closed++; },
    fetchImpl: async (url) => url.endsWith('.json')
      ? { ok: true, json: async () => feed }
      : { ok: true, arrayBuffer: async () => bytes },
    spawn: (cmd, args) => { seen.spawned = [cmd, args]; return { unref(){} }; },
    exit: (c) => { seen.exited = c; },
    log: (m) => seen.logs.push(m),
    idle
  });
  return { u, dir, exe, dataDir, seen };
}

test('a newer, genuine server: backed up, swapped in, started, and this one closes', async () => {
  const { u, dir, exe, dataDir, seen } = setup();
  await u.run();
  await new Promise(r => setTimeout(r, 350));
  assert.equal(readFileSync(exe, 'utf8'), 'NEW EXE');
  assert.equal(readFileSync(join(dir, 'Orlis Server.old.exe'), 'utf8'), 'OLD EXE');
  assert.equal(readFileSync(join(dataDir, 'backups', 'orlis-before-0.1.20.db'), 'utf8'), 'the family');
  assert.deepEqual(seen.spawned, [exe, [AFTER_UPDATE]]);
  assert.equal(seen.closed, 1); assert.equal(seen.exited, 0);
  u.tidy();
  assert.ok(!existsSync(join(dir, 'Orlis Server.old.exe')), 'the old one is tidied away next time');
});

test('not signed with the key, or not newer: nothing changes', async () => {
  for (const opts of [{ signWith: keypair() }, { version: '0.1.10' }]){
    const { u, dir, exe, seen } = setup(opts);
    await u.run();
    assert.equal(readFileSync(exe, 'utf8'), 'OLD EXE');
    assert.deepEqual(readdirSync(dir).sort(), ['Orlis Server data', 'Orlis Server.exe']);
    assert.equal(seen.spawned, null); assert.equal(seen.closed, 0);
  }
});

test('it waits for a quiet moment before swapping', async () => {
  let asked = 0;
  const { u, exe, seen } = setup({ idle: () => ++asked > 3 });
  await u.run();
  assert.ok(asked > 3, 'it kept checking until nobody was using it');
  assert.equal(readFileSync(exe, 'utf8'), 'NEW EXE');
  assert.equal(seen.closed, 1);
});

test('offline: it says so, and changes nothing', async () => {
  const { exe, dataDir } = setup();
  const logs = [];
  const u = updater({ version: '0.1.10', exe, dataDir, close: async () => {}, exit: () => {}, log: (m) => logs.push(m),
    fetchImpl: async () => { throw new Error('offline'); } });
  await u.run();
  assert.equal(readFileSync(exe, 'utf8'), 'OLD EXE');
  assert.match(logs.join(' '), /try again later/);
});
