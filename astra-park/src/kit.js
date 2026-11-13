/* The Orlis Game Kit, as the app speaks it: the messages between the app
   and a downloaded game running in its sandbox (kit/runtime/main.js is the
   game's side; ui/sandbox.js is this side).

   KIT goes up by one whenever those messages change in a way an older game
   or app wouldn't understand. A game says which it was built for; the app
   runs only games built for its own. (1 was games sharing the app's own
   parts directly - before the sandbox; no longer run.) */
export const KIT = 2;
