/* The catalogue. A game is a module with metadata plus create(playerCount),
   returning an object with step/draw/hud/tally/winner/value. The shell owns
   the camera, the clock, the HUD, pausing and every screen around the round -
   adding a ninth game means adding a file and a line here. */
import popParty from './pop-party.js';
import starSnatch from './star-snatch.js';
import moleMash from './mole-mash.js';
import bubbleKeeper from './bubble-keeper.js';
import fruitFury from './fruit-fury.js';
import dodgeStorm from './dodge-storm.js';
import goalGuard from './goal-guard.js';
import copycatGroove from './copycat-groove.js';

/* Ordered gentlest first. The two one-star games sit at the top because the
   youngest player in the room picks before anyone can advise them. */
export const GAMES = [
  moleMash, bubbleKeeper, popParty, starSnatch,
  goalGuard, dodgeStorm, fruitFury, copycatGroove
];
export const byId = (id) => GAMES.find(g => g.id === id);
