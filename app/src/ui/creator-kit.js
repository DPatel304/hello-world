/* The creator kit, as Orlis Play uses it (built from kit/creator/ by
   kit/build-creator.mjs):

   newGame({ name, idea })   the files a new game's folder starts with: the
                             starter game, its orlis.json, the rules for
                             Claude (CLAUDE.md, the orlis-game skill) and
                             Claude Code's settings and hooks (the guard and
                             the checks)
   check({ game, manifest }) the same rules the hook and the server check -
                             a list of what's wrong (empty: fine)
   pack({ game, manifest })  the game as a .orlis file: orlis.json as the
                             manifest, and the Orlis runtime in front of the
                             game's own code */
import { RUNTIME, FORBIDDEN, TEMPLATE } from './creator-kit.gen.js';
import { writeOrlis } from './orlis-file.js';
import { KIT } from '../kit.js';

export { FORBIDDEN };
const ID = /^[a-z0-9][a-z0-9-]{1,40}$/, VER = /^\d+\.\d+(\.\d+)?$/;
const UNSAFE_PICTURE = /<\s*script|\bon\w+\s*=|javascript:|<\s*foreign|href|<\s*image/i;
export const EDITABLE = ['game.js', 'orlis.json'];

/* a game's id, from its name: "Bird Hoops!" -> "bird-hoops" */
export function idOf(name){
  const s = String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s.length >= 2 ? s : `game-${s || 'new'}`;
}

/* What a copy keeps of the game it starts from: how it looks and plays in
   the Store - not who made it, its id or its version (it's a new game). */
const KEPT = ['about', 'players', 'uses', 'ages', 'tags', 'howto', 'icon'];

/* A new game's folder. from: { name, game, manifest } - a game to start
   from instead of the starter (its own code, and its orlis.json). taken:
   ids already used by this creator's games (the new one gets another). */
export function newGame({ name, idea = '', from = null, taken = [] }){
  name = String(name).trim().slice(0, 40) || 'My game';
  idea = String(idea).trim().slice(0, 300) || (from ? `A new version of ${from.name}` : 'A movement game for the family');
  let id = idOf(name);
  for (let n = 2; taken.includes(id); n++) id = `${idOf(name).slice(0, 37)}-${n}`;
  const files = {};
  for (const [path, text] of Object.entries(TEMPLATE)){
    let t = text;
    if (path === 'orlis.json'){
      let m = JSON.parse(t);
      if (from){
        const was = typeof from.manifest === 'string' ? JSON.parse(from.manifest) : (from.manifest || {});
        for (const k of KEPT) if (was[k] !== undefined) m[k] = was[k];
      }
      Object.assign(m, { id, name, version: '0.1', blurb: idea.length <= 140 ? idea : `${idea.slice(0, 137)}...` });
      t = JSON.stringify(m, null, 2) + '\n';
    } else if (path === 'game.js' && from) t = from.game.endsWith('\n') ? from.game : from.game + '\n';
    else {
      const said = from ? `${idea} (It starts as a copy of ${from.name}: game.js is that game now - change it into this.)` : idea;
      t = t.split('{{name}}').join(name).split('{{idea}}').join(said);
    }
    files[path] = t;
  }
  return { id, name, idea, files };
}

/* Orlis Play's own part of a game's folder (Claude Code's settings, the
   guard and the checks, the skill), as this version has it - put back into
   a game's folder each time it's opened, so loosening or tightening the
   rules reaches every game. */
export function guardrails(){
  return Object.fromEntries(Object.entries(TEMPLATE).filter(([p]) => p.startsWith('.claude/')));
}

/* A packed game's own code, without the Orlis runtime in front of it - for
   starting a new game from one made in Create. (null: not made in Create.) */
export function unpack(code){
  const at = String(code).indexOf('\nOrlis.manifest=');
  if (at < 0) return null;
  const end = code.indexOf('\n', at + 1);
  return end < 0 ? null : code.slice(end + 1).replace(/\n+$/, '') + '\n';
}

export function check({ game, manifest }){
  const problems = [];
  if (typeof game !== 'string' || !game.trim()) problems.push('game.js is missing.');
  else {
    if (game.length > 1000000) problems.push('game.js is very big - keep it under a megabyte.');
    const seen = new Set();
    for (const [w, why] of FORBIDDEN) if (game.includes(w) && !seen.has(why)){ seen.add(why); problems.push(`game.js uses ${w.replace(/\($/, '')}, which reaches for ${why}. Games can't - take it out.`); }
    if (!/Orlis\.run\(/.test(game)) problems.push('game.js must end with Orlis.run({ ... }).');
    if (/^\s*(import|export)\s/m.test(game)) problems.push('game.js is one plain script: no import or export - everything comes from Orlis.');
  }
  let m = manifest;
  if (typeof m === 'string'){ try { m = JSON.parse(m); } catch { problems.push('orlis.json is not valid JSON (no comments or trailing commas).'); m = null; } }
  if (m){
    if (!ID.test(m.id || '')) problems.push('orlis.json: "id" must be lowercase letters, numbers and dashes.');
    if (!m.name || String(m.name).length > 40) problems.push('orlis.json: "name" is needed, up to 40 letters.');
    if (!VER.test(m.version || '')) problems.push('orlis.json: "version" must look like 0.1 or 1.2.');
    if (!m.blurb) problems.push('orlis.json: "blurb" is needed - one line saying what the game is.');
    if (m.uses && !['hands', 'body'].includes(m.uses)) problems.push('orlis.json: "uses" is "hands" or "body".');
    if (m.icon && UNSAFE_PICTURE.test(m.icon.glyph || '')) problems.push('orlis.json: the icon picture must be simple shapes only.');
  } else if (manifest == null) problems.push('orlis.json is missing.');
  return problems;
}

export async function pack({ game, manifest }){
  const problems = check({ game, manifest });
  if (problems.length) throw Object.assign(new Error(problems.join(' ')), { problems });
  const m = typeof manifest === 'string' ? JSON.parse(manifest) : manifest;
  const full = { ...m, format: 1, kit: KIT };
  const code = `${RUNTIME}\nOrlis.manifest=${JSON.stringify({ id: full.id, name: full.name, icon: full.icon || null })};\n${game}\n`;
  return { bytes: await writeOrlis({ 'manifest.json': JSON.stringify(full, null, 2), 'game.js': code }), manifest: full };
}
