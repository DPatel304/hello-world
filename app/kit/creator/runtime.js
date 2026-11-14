/* The Orlis runtime for a creator's game: everything a game made with
   Create uses, under one name - Orlis - with nothing to build or install.
   Orlis Play packs it in front of the creator's game.js (ui/creator-kit.js),
   with the game's orlis.json as Orlis.manifest; the game ends with
   Orlis.run({ ... }).

     Orlis.pose      the players, from the camera: body points only
     Orlis.sfx       Orlis Play's sounds: Orlis.sfx.pop(), Orlis.sfx.gold()...
     Orlis.music     its music: Orlis.music.intensity(0.8)...
     Orlis.L, Orlis.BONES, Orlis.MAX_PLAYERS, Orlis.PLAYER_COLORS
     Orlis.run(game) start it (in the sandbox, as every downloaded game is)

   It also checks the words the game shows (below). */
import { run } from '../runtime/main.js';
import { pose, L, BONES, MAX_PLAYERS, PLAYER_COLORS } from '../runtime/pose.js';
import { sfx, music, ambience } from '../runtime/sound.js';
import { clean } from './words.js';

/* Before the game's own code runs: every line of text it draws on screen
   goes through the words check first (a word that isn't for children comes
   out as stars), and the game can't put the plain drawing back. (The other
   ways to show words - pictures, web-page parts, other letters, hidden
   text - are turned away by the checks before a game is sent.) */
for (const C of [globalThis.CanvasRenderingContext2D, globalThis.OffscreenCanvasRenderingContext2D]){
  if (!C) continue;
  for (const k of ['fillText', 'strokeText']){
    const real = C.prototype[k];
    if (typeof real !== 'function') continue;
    Object.defineProperty(C.prototype, k, { value: function(text, ...rest){ return real.call(this, clean(text), ...rest); }, writable: false, configurable: false, enumerable: false });
  }
}

const Orlis = {
  manifest: {},
  pose, sfx, music, ambience, L, BONES, MAX_PLAYERS, PLAYER_COLORS,
  run(game){
    const m = Orlis.manifest || {};
    /* (its id and name are the ones in orlis.json, whatever the code says) */
    run({ ...game, id: m.id, name: m.name || game.name, accent: game.accent || (m.icon && m.icon.cols && m.icon.cols[0]) });
  }
};
globalThis.Orlis = Orlis;
