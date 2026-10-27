/* The catalogue. A game is a module with metadata plus create(playerCount),
   returning an object with step/draw/hud/tally/winner/value. The shell owns
   the camera, the clock, the HUD, pausing and every screen around the round -
   adding a game means adding a file and a line here. */
import popParty from './pop-party.js';
import fireflyNight from './firefly-night.js';
import fireTruck from './fire-truck.js';

export const GAMES = [popParty, fireflyNight, fireTruck];
export const byId = (id) => GAMES.find(g => g.id === id);
