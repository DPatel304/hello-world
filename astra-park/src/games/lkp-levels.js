/* Last Known Position's levels. Everything that makes one level itself
   lives here, in one entry - the rest of the game reads it:

     name, goal     shown big as the level opens
     palette        its colours (lkp-art.js PAL): sky, floor, trees ...
     plan           the way through it, in order: corridor, cross (the
                    doors), room (whichever door won), depot (the story
                    moment that wakes the robots), boss, end
     enemies        who's in its fights: `wild` before the robots wake,
                    `awake` after (the art draws each kind)
     boss           its boss (the game's BOSSES: scout, warden ...)
     things         what the corridor's things are, here - for Nova
     tips           Nova's first word on each thing in a corridor
     lines          what's said in its scenes: [who, text, words] - who
                    is 'nova' or 'robot'; words, a few under the speaker,
                    or none. 'PRAISE' in `won` is each player, by colour.

   A run is five levels, one after another (only the first is built so
   far): hard, Slay the Spire hard - losing is normal, and the fun is
   getting further next time. The doors are the run's path, chosen
   blind: there's no map of what's ahead.

   A new level is a new entry (and, if it needs one, a new boss). */

/* The friendly giant's name, as Nova calls it (still to be chosen). */
export const GIANT = 'Zubu';

export const LEVELS = [
  {
    id: 'verdant', name: 'Verdant Crash Site', goal: 'Find the Star Core',
    palette: {
      bg: '#14261b', floor: '#2d4b2b', edge: 'rgba(255,255,255,.3)', trees: '#1f5a34',
      blocker: '#7a5230', beam: '#6b4423', post: '#3d2a17', gap: '#0b0e09', fountain: '#38bdf8',
      wall: '#22402a', hall: '#14261b', hallFloor: '#2d4b2b', hallRed: '#45282a',
      /* The real look (lkp-world.js): a fresh morning on an alien planet. */
      world: {
        /* (an alien morning: lavender in the sky and the air) */
        key: 'verdant-morning-2',
        sky: ['#5a74d6', '#9a8ce6', '#dcc4f2', '#ffd4e2'], sun: '#fff0dc', haze: '#ddd0f0',
        cloud: '#fbf2ff', cloudShade: '#bcaee0', planet: ['#c9b6d9', '#8fa2c9'], planetAlpha: 0.6, smoke: '#6e6e82', ship: '#3a3f66',
        hillLit: '#a7bfe2', hillDark: '#6d84b6', rim: '#fff0d7',
        ground: ['#5aa391', '#3f8f78', '#2f7c66'], grass: ['#78c8a0', '#328c73'], path: ['#857a98', '#6c6083'],
        rock: ['#a9a3cf', '#6d6894'], crystal: ['#c7b6ef', '#8f7cc4', '#5d4e8f'], trunk: ['#3f2f55', '#8a6aa0'], wood: '#c9a77a',
        tree: ['#58c2b0', '#1f5a6c'], bulb: '#ff8cd8', glow: '#86f2dc', water: '#5fe0f0', flowers: ['#fff4c2', '#ffc2e6', '#c9f7ff'],
        warm: '#ffbe8c', cool: '#1e3278'
      }
    },
    /* The way through: the tutorial run (and the healing pond); a first,
       easy fight, straight in, to learn fighting; a run with the team
       jump over a gorge; the Star Core (the robots wake); a run with
       a ride on Mossy, the forest giant; a fork and a room; a run with a bigger gorge; the
       boss. */
    /* (Level 1 is all running, no fighting: it ends at the Star Core -
       the robots wake, and a friendly giant carries the crew away. After
       its 'end', the rest - the tutorial fight, a fork, a room, the big
       gorge and the Sweeper - kept for level 2: not played yet.) */
    plan: ['corridor', 'corridor', 'sneak', 'roll', 'corridor', 'depot', 'ride', 'end', 'tutorial', 'corridor', 'cross', 'room', 'corridor', 'boss', 'end'],
    /* What happens in each corridor (lkp-game.js _layout): one event
       apiece - the path squeezing narrow then opening wide, a big jump
       over a ravine, a zip line - and the run of obstacles round it,
       the set pieces it mixes in (pieces). big: a wider ravine. */
    corridors: [
      /* level 1: the crash site and the teaching run; the team jump; a
         short run on to the depot */
      { event: 'squeeze' },
      { event: 'leap', big: true, pieces: ['logs', 'slalom', 'duckrun', 'arc'] },
      { pieces: ['duckrun', 'slalom', 'logs', 'arc'] },
      /* (level 2, to come) */
      { pieces: ['duckrun', 'slalom', 'logs', 'arc'] },
      { event: 'leap', big: true, pieces: ['slalom', 'logs', 'duckrun', 'arc'] }
    ],
    enemies: { wild: 'beast', awake: 'rustbot', wildName: 'wild beasts', awakeName: 'robots' },
    boss: 'scout', bossName: 'Sweeper',
    tips: {
      crystal: ['See those glowing crystals? Collect them to level up! Lean to grab them!', 'CRYSTALS!'],
      blocker: ['Debris! Lean around it.', 'LEAN!'],
      beam: ['Low branch! Duck!', 'DUCK!'],
      gap: ['A ditch! Hop over it!', 'HOP!'],
      roller: ['A log, rolling across! Lean out of its way!', 'DODGE IT!'],
      narrow: ['A herd coming through! Move over to the left!', 'MOVE LEFT!'],
      wide: ['It opens right up! Spread out and grab them all!', 'SPREAD OUT!'],
      ravine: ['A gorge! Everyone, get ready to JUMP!', 'GET READY TO JUMP!'],
      fountain: ['Spring water! Run along it to heal up.', 'HEAL']
    },
    lines: {
      /* The opening (lkp-intro.js): answering her call, inside the helmet. */
      wakeup: [['nova', 'ksssh \u2014 Crew, do you read me? ...You\'re okay!', '']],
      /* ...and once they're up, on the path. */
      rise: [['nova', 'On your feet, crew!', '']],
      /* ...and up: can they move? - everyone wiggling, each one their own astronaut */
      canMove: [['nova', 'Can you move? Give your arms and legs a wiggle!', 'WIGGLE!']],
      ready: [['nova', 'There you all are! Now follow that path.', '']],
      /* The first corridor: the story, a piece at a time, in the quiet
         between her tips (lkp-game.js: said as the run reaches them). */
      walk: [
        ['nova', 'Your ship came down hard, on a planet nobody\'s ever explored. Trouble is, the crash knocked out your Star Core \u2014 it\'s what powers your ship. Without it, you can\'t fly home.', ''],
        ['nova', 'I\'m picking up its glow, somewhere out there. We need to find that Star Core!', 'FIND THE STAR CORE']
      ],
      /* The healing pond, a stop along the first corridor. */
      pondIn: [['nova', 'Stop here! Your vitals are climbing \u2014 the water\'s healing you. Hug yourselves to heal even faster!', 'HUG TO HEAL']],
      /* (the pond's end: the ground shaking, the far ridge - lkp-game.js _rest) */
      offTrail: [['nova', 'Whoa... something big is out there. And the signal\'s coming from that way. Follow that path!', 'FOLLOW THE PATH']],
      pondWait: [['nova', 'Almost there \u2014 hold position.', '']],
      /* Zubu rolling down the hill after them, in her sleep (lkp-roll.js). */
      rollStart: [['nova', 'Uh-oh... Zubu rolled over in her sleep \u2014 and she\'s rolling down the hill! Run, crew! Run on the spot! Lean out of the way of anything rolling!', 'RUN!']],
      rollEnd: [['nova', 'She stopped... and she\'s still snoring! She slept through the whole thing. Ha! Okay crew, tiptoe on.', '']],
      /* Mossy, the gentle giant, after the boss (lkp-ride.js). */
      rideMeet: [['nova', 'Look who it is! The giant from the glade. The robots woke it up too. Run, crew, catch up!', 'CATCH UP!']],
      rideOn: [['nova', 'Everyone on? Sit down and rest, crew. You\'ve earned it.', 'SIT AND RELAX']],
      rideOff: [['nova', `What a ride! Say thank you, crew. I think we'll call it... ${GIANT}!`, `BYE, ${GIANT.toUpperCase()}!`]],
      depot: [
        ['nova', 'There it is! The Star Core! Everyone, roll your arms to power it up!', 'ROLL YOUR ARMS']
      ],
      waking: [
        ['robot', 'Clean. The planet. Of everything.', 'CLEAN THE PLANET.'],
        ['nova', 'That surge woke every robot on the planet. And they think we\'re the mess. Stay sharp, crew!', '']
      ],
      boss: [
        ['robot', 'Contamination detected. Cleaning.', 'CLEANING.'],
        ['nova', 'An old street sweeper, gone haywire! Watch the red, dodge its charges, and hit it when it stops!', 'DODGE!']
      ],
      won: [
        ['nova', 'We\'ve got the Star Core! Brilliant work, crew.', 'LEVEL CLEAR!'],
        'PRAISE',
        ['nova', 'The ship\'s still a long way off, and more robots are waking. Rest up, crew.', '']
      ],
      lost: [
        ['nova', 'Everyone\'s down! Hang on, I\'m pulling you back.', ''],
        ['nova', 'That was brave, crew. We\'ll try again!', 'NEXT TIME!']
      ]
    }
  }
];
