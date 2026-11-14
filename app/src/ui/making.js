/* The games a creator is making, on this PC: each a folder in
   Documents\Orlis Play\Games, kept by the Windows app (creating.rs). Only in
   Orlis Play for Windows - in a browser, there's nothing here.

   making.available         in the Windows app?
   making.list()            [{ folder, manifest, changed }] - newest first
   making.make(opts)        a new game's folder (creator-kit newGame's opts);
                            gives back { folder, id, name }
   making.read(folder)      { game, manifest } as they are now
   making.openClaude(folder, { first })
                            Orlis Play's guardrails put back as this version
                            has them, then Claude Code opened in the folder
                            (first: a new game - Claude starts on the idea).
                            { opened } or { missing: true }
   making.show(folder)      the folder in File Explorer
   making.note(folder, t)   what Try it saw, in .orlis/preview.txt for Claude
   making.setVersion(folder, v)  orlis.json's version, raised before sending */
import { newGame, guardrails } from './creator-kit.js';

const invoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args);
const asError = (e) => new Error(typeof e === 'string' ? e : (e && e.message) || 'That didn’t work.');
const call = async (cmd, args) => { try { return await invoke(cmd, args); } catch (e){ throw asError(e); } };

/* What Claude's asked to do first. */
export const FIRST = (idea) => `Read CLAUDE.md, then turn the game in game.js into this idea: ${idea} Keep it simple and fun for young children. Fill in orlis.json for it too (a name, blurb, about, the moves, and an icon). When it's ready, tell me to press Try it in Orlis Play.`;
export const AGAIN = 'Read CLAUDE.md and game.js, then ask me what I’d like to change in this game.';

export const making = {
  get available(){ return typeof window !== 'undefined' && !!(window.__TAURI__ && window.__TAURI__.core); },

  async list(){
    const all = await call('games_list');
    return all.map(g => { let m = null; try { m = JSON.parse(g.manifest); } catch {} return { folder: g.folder, manifest: m, changed: g.changed }; })
      .filter(g => g.manifest);
  },

  async make({ name, idea, from = null }){
    const taken = (await this.list()).map(g => g.manifest.id);
    const g = newGame({ name, idea, from, taken });
    const folder = await call('game_make', { name: g.name, files: g.files });
    return { folder, id: g.id, name: g.name, idea: g.idea };
  },

  read(folder){ return call('game_read', { folder }); },

  async openClaude(folder, { first = null } = {}){
    await call('game_write', { folder, files: guardrails() });
    return call('claude_open', { folder, prompt: first ? FIRST(first) : AGAIN });
  },

  show(folder){ return call('game_show', { folder }); },

  /* what Try it saw, for Claude to read (.orlis/preview.txt) */
  note(folder, text){ return call('game_write', { folder, files: { '.orlis/preview.txt': text } }); },

  /* a new version number in orlis.json - the one thing Orlis Play changes
     in the game itself, so each version sent replaces the last */
  setVersion(folder, version){ return call('game_version', { folder, version }); }
};
