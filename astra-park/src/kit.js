/* The Orlis Game Kit: what the app gives a downloaded game (a .orlis file).

   A downloaded game is built without its own copy of these - the camera's
   players, the sounds and music, the players' pictures, the shared bits - so
   it uses the very same ones as everything else here (one camera, one sound
   engine). It finds them on globalThis.OrlisKit, which this sets up as the
   app starts. See astra-park/kit/build-orlis.mjs for the other side.

   KIT goes up by one whenever something a game can rely on is taken away or
   changes shape; a game says which it was built for, and the app won't run
   one made for a newer kit than its own. */
import * as common from './games/common.js';
import * as pose from './tracking/pose.js';
import * as sound from './audio/sound.js';
import * as avatars from './ui/avatars.js';

export const KIT = 1;
export const KIT_MODULES = { common, pose, sound, avatars };

export function installKit(){
  globalThis.OrlisKit = { version: KIT, modules: KIT_MODULES };
}
