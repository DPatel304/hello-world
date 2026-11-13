/* The creator kit's hooks, run for real with Windows' PowerShell, as Claude
   Code runs them: a new game's folder, then the guard and the checks with
   the JSON Claude Code sends. (Windows only - GitHub runs it:
   .github/workflows/creator-kit-windows.yml.) */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { newGame } from '../../src/ui/creator-kit.js';

if (process.platform !== 'win32'){ console.log('(Windows only)'); process.exit(0); }
const dir = mkdtempSync(join(tmpdir(), 'Bird Hoops '));
const g = newGame({ name: 'Bird Hoops', idea: 'Flap to fly' });
for (const [p, t] of Object.entries(g.files)){ mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); }

const hook = (name, input) => {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(dir, '.claude/hooks', name)],
    { input: JSON.stringify({ hook_event_name: name === 'guard.ps1' ? 'PreToolUse' : 'PostToolUse', cwd: dir, ...input }), env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  return { code: r.status, out, json: out ? JSON.parse(out) : null, err: (r.stderr || '').trim() };
};
let failed = 0;
const expect = (what, ok, got) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `\n     got: ${JSON.stringify(got)}`}`); if (!ok) failed++; };
const denied = (r) => r.code === 0 && r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecision === 'deny';
const allowed = (r) => r.code === 0 && !r.out;

/* the guard */
let r = hook('guard.ps1', { tool_name: 'Edit', tool_input: { file_path: join(dir, 'game.js') } });
expect('editing game.js: allowed', allowed(r), r);
r = hook('guard.ps1', { tool_name: 'Write', tool_input: { file_path: join(dir, 'orlis.json') } });
expect('writing orlis.json: allowed', allowed(r), r);
r = hook('guard.ps1', { tool_name: 'Edit', tool_input: { file_path: join(dir, 'CLAUDE.md') } });
expect('editing CLAUDE.md: refused', denied(r), r);
r = hook('guard.ps1', { tool_name: 'Write', tool_input: { file_path: join(dir, '.claude', 'settings.json') } });
expect("changing Claude Code's settings: refused", denied(r), r);
r = hook('guard.ps1', { tool_name: 'Write', tool_input: { file_path: join(dir, 'extra.js') } });
expect('a new file: refused', denied(r), r);
r = hook('guard.ps1', { tool_name: 'Read', tool_input: { file_path: 'C:\\Windows\\win.ini' } });
expect('reading outside the folder: refused', denied(r), r);
r = hook('guard.ps1', { tool_name: 'Write', tool_input: { file_path: join(dir, '..', 'escape.js') } });
expect('writing just outside (..): refused', denied(r), r);
r = hook('guard.ps1', { tool_name: 'Read', tool_input: { file_path: join(dir, 'CLAUDE.md') } });
expect('reading its own rules: allowed', allowed(r), r);
r = hook('guard.ps1', { tool_name: 'Grep', tool_input: { pattern: 'Orlis' } });
expect('searching the folder: allowed', allowed(r), r);
r = hook('guard.ps1', { tool_name: 'Glob', tool_input: { pattern: '**/*', path: 'C:\\Users' } });
expect('searching elsewhere: refused', denied(r), r);

r = hook('guard.ps1', { tool_name: 'Read', tool_input: { file_path: join(dir, '.claude', 'settings.json') } });
expect("reading Claude Code's settings: refused (only the game, its rules, its how-to)", denied(r), r);
r = hook('guard.ps1', { tool_name: 'Read', tool_input: { file_path: join(dir, '.claude', 'skills', 'orlis-game', 'SKILL.md') } });
expect('reading the how-to: allowed', allowed(r), r);
for (const [tool, input] of [['Bash', { command: 'dir' }], ['PowerShell', { command: 'dir' }], ['WebFetch', { url: 'https://example.com' }], ['WebSearch', { query: 'x' }],
  ['Agent', { prompt: 'x' }], ['mcp__Gmail__send_message', { to: 'x' }], ['NotebookEdit', { notebook_path: join(dir, 'x.ipynb') }], ['SomethingNew', {}]])
  { r = hook('guard.ps1', { tool_name: tool, tool_input: input }); expect(`${tool}: refused`, denied(r), r); }
r = hook('guard.ps1', { tool_name: 'Skill', tool_input: { skill: 'orlis-game' } });
expect('the orlis-game skill: allowed', allowed(r), r);
r = hook('guard.ps1', { tool_name: 'Skill', tool_input: { skill: 'something-else' } });
expect('another skill: refused', denied(r), r);
r = hook('guard.ps1', { tool_name: 'TodoWrite', tool_input: { todos: [] } });
expect('its to-do list: allowed', allowed(r), r);
r = hook('guard.ps1', { tool_name: 'Edit', tool_input: { file_path: join(dir, 'game.js'), old_string: 'a', new_string: 'const stars = [];' } });
expect('an ordinary change to game.js: allowed', allowed(r), r);
r = hook('guard.ps1', { tool_name: 'Edit', tool_input: { file_path: join(dir, 'game.js'), old_string: 'a', new_string: 'fetch("https://example.com")' } });
expect('a change reaching for the internet: refused before it is made', denied(r) && /internet/.test(r.json.hookSpecificOutput.permissionDecisionReason), r);
r = hook('guard.ps1', { tool_name: 'Write', tool_input: { file_path: join(dir, 'game.js'), content: 'localStorage.x = 1; Orlis.run({})' } });
expect('writing game.js with storage: refused', denied(r), r);

/* the checks */
r = hook('check.ps1', { tool_name: 'Edit', tool_input: { file_path: join(dir, 'game.js') } });
expect('the starter game: passes, nothing said', allowed(r), r);
writeFileSync(join(dir, 'game.js'), readFileSync(join(dir, 'game.js'), 'utf8') + '\nfetch("https://example.com");\nlocalStorage.x = 1;\n');
r = hook('check.ps1', { tool_name: 'Edit', tool_input: { file_path: join(dir, 'game.js') } });
expect('reaching for the internet and storage: sent back to Claude', r.code === 0 && r.json && r.json.decision === 'block' && /internet/.test(r.json.reason) && /storage/.test(r.json.reason), r);
writeFileSync(join(dir, 'orlis.json'), '{ "id": "Bird Hoops", // oops\n }');
r = hook('check.ps1', { tool_name: 'Edit', tool_input: { file_path: join(dir, 'orlis.json') } });
expect('a broken orlis.json: sent back', r.json && r.json.decision === 'block' && /orlis\.json/.test(r.json.reason), r);

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
