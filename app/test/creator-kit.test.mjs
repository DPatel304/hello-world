import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, OUT } from '../kit/build-creator.mjs';
import { newGame, check, pack, idOf, FORBIDDEN } from '../src/ui/creator-kit.js';
import { FORBIDDEN as SERVER_FORBIDDEN, checkGame } from '../../server/src/submissions.js';

test('the kit in the app is built from kit/creator as it is now', async () => {
  assert.equal(readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n'), await generate(), 'run: node kit/build-creator.mjs');
});

test("the app's checks and the server's are the same list", () => {
  assert.deepEqual(FORBIDDEN, SERVER_FORBIDDEN);
  for (const h of ['check.ps1', 'guard.ps1']){
    const ps = newGame({ name: 'x y' }).files['.claude/hooks/' + h];
    for (const [w] of FORBIDDEN) assert.ok(ps.includes(`@('${w.replace(/'/g, "''")}'`), `${h} checks ${w} too`);
  }
});

test('a new game: the starter, its orlis.json, the rules and the guardrails', () => {
  const g = newGame({ name: 'Bird Hoops!', idea: 'Flap your arms to fly a bird through hoops' });
  assert.equal(g.id, 'bird-hoops');
  assert.deepEqual(Object.keys(g.files).sort(), ['.claude/hooks/check.ps1', '.claude/hooks/guard.ps1', '.claude/settings.json', '.claude/skills/orlis-game/SKILL.md', 'CLAUDE.md', 'game.js', 'orlis.json']);
  const m = JSON.parse(g.files['orlis.json']);
  assert.deepEqual([m.id, m.name, m.blurb, m.version], ['bird-hoops', 'Bird Hoops!', 'Flap your arms to fly a bird through hoops', '0.1']);
  assert.match(g.files['CLAUDE.md'], /^# Bird Hoops!: an Orlis Play game/);
  assert.match(g.files['CLAUDE.md'], /The idea: Flap your arms/);
  assert.ok(!Object.values(g.files).some(t => /\{\{\w+\}\}/.test(t)), 'nothing left to fill in');
  assert.match(g.files['.claude/skills/orlis-game/SKILL.md'], /^---\nname: orlis-game\ndescription: /);
  assert.ok(g.files['CLAUDE.md'].split('\n').length < 200, 'CLAUDE.md under 200 lines');
});

test("Claude Code's settings: no web, no commands, edits only to the game's two files, the guard and the checks", () => {
  const st = JSON.parse(newGame({ name: 'x y' }).files['.claude/settings.json']);
  for (const d of ['Bash', 'WebFetch', 'WebSearch', 'Edit(./CLAUDE.md)', 'Edit(./.claude/**)']) assert.ok(st.permissions.deny.includes(d), d);
  assert.deepEqual(st.permissions.allow.filter(a => a.startsWith('Edit')), ['Edit(./game.js)', 'Edit(./orlis.json)']);
  const pre = st.hooks.PreToolUse[0], post = st.hooks.PostToolUse[0];
  assert.equal(pre.matcher, '*', 'the guard is asked about every tool');
  assert.equal(st.permissions.disableBypassPermissionsMode, 'disable', 'no switching the permissions off');
  assert.equal(st.enableAllProjectMcpServers, false);
  assert.equal(pre.hooks[0].onFailure, 'block', 'a guard that fails says no');
  assert.ok(pre.hooks[0].args.at(-1).endsWith('/.claude/hooks/guard.ps1'));
  assert.ok(post.hooks[0].args.at(-1).endsWith('/.claude/hooks/check.ps1'));
  assert.equal(pre.hooks[0].command, 'powershell.exe', "Windows' own PowerShell: nothing to install");
});

test('the checks: the starter passes; reaching for the internet, a broken orlis.json and the like do not', () => {
  const g = newGame({ name: 'Star Catch' });
  assert.deepEqual(check({ game: g.files['game.js'], manifest: g.files['orlis.json'] }), []);
  assert.match(check({ game: 'fetch("x"); Orlis.run({})', manifest: g.files['orlis.json'] }).join(), /the internet/);
  assert.match(check({ game: 'import x from "y"; Orlis.run({})', manifest: g.files['orlis.json'] }).join(), /no import or export/);
  assert.match(check({ game: g.files['game.js'], manifest: '{ "id": "a", // no\n }' }).join(), /not valid JSON/);
  assert.match(check({ game: g.files['game.js'], manifest: { ...JSON.parse(g.files['orlis.json']), icon: { glyph: '<a href="x">' } } }).join(), /simple shapes/);
  assert.equal(idOf('  ¡Hola, Mundo!  '), 'hola-mundo');
  assert.equal(idOf('A'), 'game-a');
});

test('packed, a new game is one the family\'s server takes', async () => {
  const g = newGame({ name: 'Bird Hoops', idea: 'Flap to fly' });
  const { bytes, manifest } = await pack({ game: g.files['game.js'], manifest: g.files['orlis.json'] });
  assert.equal(manifest.kit, 2);
  const { manifest: m, parts } = checkGame(Buffer.from(bytes));
  assert.deepEqual([m.id, m.name, m.version, m.blurb], ['bird-hoops', 'Bird Hoops', '0.1', 'Flap to fly']);
  const code = parts['game.js'].toString();
  assert.match(code, /Orlis\.manifest=\{"id":"bird-hoops"/);
  assert.ok(code.indexOf('globalThis.Orlis') < code.indexOf('Star Catch') || code.includes('Orlis.run'), 'the runtime first, then the game');
  await assert.rejects(pack({ game: 'fetch(1)', manifest: g.files['orlis.json'] }), /the internet/);
});

test('a new game can start from another: its code and its look, a new id and version, and Claude told', async () => {
  const { newGame: make, unpack, guardrails } = await import('../src/ui/creator-kit.js');
  const first = make({ name: 'Bird Hoops', idea: 'Flap to fly' });
  const m0 = JSON.parse(first.files['orlis.json']);
  const game = 'const x = 1;\nOrlis.run({ create(){ return { step(){}, draw(){}, hud(){ return { score: [0] }; }, value(){ return 0; } }; } });\n';
  const { bytes } = await pack({ game, manifest: { ...m0, tags: ['Flying'], icon: { cols: ['#111111', '#222222'], glyph: '<circle cx="50" cy="50" r="20" fill="#fff"/>' }, by: 'Max', version: '0.4' } });
  /* (as the Store hands it back: the runtime in front, then the game) */
  const { parts, manifest } = checkGame(Buffer.from(bytes));
  const code = unpack(parts['game.js'].toString());
  assert.equal(code, game, 'the game\'s own code, without the runtime');
  assert.equal(unpack('just some code'), null, 'not made in Create: nothing');
  const copy = make({ name: 'Bird Hoops', idea: 'Hoops at night', from: { name: 'Bird Hoops', game: code, manifest }, taken: ['bird-hoops'] });
  const m = JSON.parse(copy.files['orlis.json']);
  assert.equal(copy.id, 'bird-hoops-2', 'a new id, not the one it came from');
  assert.deepEqual([m.id, m.version, m.blurb, m.by, m.tags], ['bird-hoops-2', '0.1', 'Hoops at night', undefined, ['Flying']]);
  assert.equal(m.icon.cols[0], '#111111', 'it keeps the look');
  assert.equal(copy.files['game.js'], game);
  assert.match(copy.files['CLAUDE.md'], /starts as a copy of Bird Hoops/);
  assert.deepEqual(check({ game: copy.files['game.js'], manifest: copy.files['orlis.json'] }), []);
  assert.deepEqual(Object.keys(guardrails()).sort(), ['.claude/hooks/check.ps1', '.claude/hooks/guard.ps1', '.claude/settings.json', '.claude/skills/orlis-game/SKILL.md']);
});
