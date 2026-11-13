/* The Orlis runtime for a creator's game: everything a game made with
   Create uses, under one name - Orlis - with nothing to build or install.
   Orlis Play packs it in front of the creator's game.js (ui/creator-kit.js),
   with the game's orlis.json as Orlis.manifest; the game ends with
   Orlis.run({ ... }).

     Orlis.pose      the players, from the camera: body points only
     Orlis.sfx       Orlis Play's sounds: Orlis.sfx.pop(), Orlis.sfx.gold()...
     Orlis.music     its music: Orlis.music.intensity(0.8)...
     Orlis.L, Orlis.BONES, Orlis.MAX_PLAYERS, Orlis.PLAYER_COLORS
     Orlis.run(game) start it (in the sandbox, as every downloaded game is) */
import { run } from '../runtime/main.js';
import { pose, L, BONES, MAX_PLAYERS, PLAYER_COLORS } from '../runtime/pose.js';
import { sfx, music, ambience } from '../runtime/sound.js';

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
