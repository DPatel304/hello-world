/* The catalogue. A game is a module with metadata plus create(playerCount),
   returning an object with step/draw/hud/tally/winner/value. The shell owns
   the camera, the clock, the HUD, pausing and every screen around the round -
   adding a game means adding a file and a line here. */
import popParty from './pop-party.js';
import uncleBsBoat from './uncle-bs-boat.js';
import danceParty from './dance-party.js';
import lastKnownPosition from './lkp-game.js';
import castleDefense from './castle-defense.js';

/* In the Windows app, some games aren't built in: they come from the Store,
   as .orlis files, and join this list when downloaded (ui/library.js).
   Opened any other way - the browser, the tests - they're all built in. */
export const FROM_STORE = new Set(['pop-party']);
const inApp = typeof window !== 'undefined' && !!(window.__TAURI__ && window.__TAURI__.core);
export const GAMES = [popParty, uncleBsBoat, danceParty, lastKnownPosition, castleDefense]
  .filter(g => !(inApp && FROM_STORE.has(g.id)));
export const byId = (id) => GAMES.find(g => g.id === id);
