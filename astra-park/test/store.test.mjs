import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOrlis, PACKAGES } from '../kit/build-orlis.mjs';
import { readOrlis, manifestOf } from '../../server/src/orlis-file.js';
import { KIT, KIT_MODULES } from '../src/kit.js';
import { FROM_STORE } from '../src/games/index.js';

/* The Store's side of the app: games packaged as .orlis files, sharing the
   app's parts through the Game Kit. */
test('Pop Party packs into a .orlis file that shares the app\'s parts, not copies of them', async () => {
  const r = await buildOrlis('pop-party');
  const parts = readOrlis(readFileSync(new URL('../../server/starter/pop-party.orlis', import.meta.url)));
  const m = manifestOf(parts);
  assert.equal(m.id, 'pop-party'); assert.equal(m.name, 'Pop Party'); assert.equal(m.version, r.version);
  const code = parts['game.js'].toString();
  for (const k of ['pose', 'sound', 'avatars', 'common']) assert.ok(code.includes(`OrlisKit.modules.${k}`), `takes ${k} from the kit`);
  assert.ok(!/detectForVideo|createGain|getUserMedia/.test(code), 'carries no camera tracking or sound engine of its own');
  assert.ok(r.bytes < 100 * 1024, 'small');
});

test('the Game Kit offers every part a packaged game takes', () => {
  assert.equal(KIT, 1);
  for (const k of ['pose', 'sound', 'avatars', 'common']) assert.ok(KIT_MODULES[k], k);
  assert.ok(KIT_MODULES.pose.pose && KIT_MODULES.sound.sfx && KIT_MODULES.avatars.Avatars && KIT_MODULES.common.Juice);
});

test('in the Windows app, Store games aren\'t built in; everywhere else they are', () => {
  assert.ok(FROM_STORE.has('pop-party') && PACKAGES['pop-party'], 'Pop Party comes from the Store, and is packaged');
  const idx = readFileSync(new URL('../src/games/index.js', import.meta.url), 'utf8');
  assert.ok(idx.includes('.filter(g => !(inApp && FROM_STORE.has(g.id)))'));
});
