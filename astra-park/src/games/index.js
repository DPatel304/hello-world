/* The catalogue. A game is a module with metadata plus create(playerCount),
   returning an object with step/draw/hud/tally/winner/value. The shell owns
   the camera, the clock, the HUD, pausing and every screen around the round -
   adding a game means adding a file and a line here. */
import popParty from './pop-party.js';
import moonBounce from './moon-bounce.js';
import animalCopycat from './animal-copycat.js';
import uncleBsBoat from './uncle-bs-boat.js';
import danceParty from './dance-party.js';
import forestRun from './forest-run.js';

export const GAMES = [popParty, moonBounce, animalCopycat, uncleBsBoat, danceParty, forestRun];
export const byId = (id) => GAMES.find(g => g.id === id);
