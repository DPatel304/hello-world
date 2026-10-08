/* The catalogue. A game is a module with metadata plus create(playerCount),
   returning an object with step/draw/hud/tally/winner/value. The shell owns
   the camera, the clock, the HUD, pausing and every screen around the round -
   adding a ninth game means adding a file and a line here. */
import popParty from './pop-party.js';
import starSnatch from './star-snatch.js';

export const GAMES = [popParty, starSnatch];
export const byId = (id) => GAMES.find(g => g.id === id);
