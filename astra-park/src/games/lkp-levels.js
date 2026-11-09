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

export const LEVELS = [
  {
    id: 'verdant', name: 'Verdant Crash Site', goal: 'Find the engine piece',
    palette: {
      bg: '#14261b', floor: '#2d4b2b', edge: 'rgba(255,255,255,.3)', trees: '#1f5a34',
      blocker: '#7a5230', beam: '#6b4423', post: '#3d2a17', gap: '#0b0e09', fountain: '#38bdf8',
      wall: '#22402a', hall: '#14261b', hallFloor: '#2d4b2b', hallRed: '#45282a',
      /* The real look (lkp-world.js): a fresh morning on an alien planet. */
      world: {
        key: 'verdant-morning',
        sky: ['#4f9be0', '#8cc4ec', '#cfe6f5', '#ffe6c8'], sun: '#fff1d6', haze: '#d6e6f2',
        cloud: '#ffffff', cloudShade: '#b4c6e2', planet: ['#c9b6d9', '#8fa2c9'], planetAlpha: 0.6, smoke: '#6e6e82', ship: '#3a3f66',
        hillLit: '#a7bfe2', hillDark: '#6d84b6', rim: '#fff0d7',
        ground: ['#5aa391', '#3f8f78', '#2f7c66'], grass: ['#78c8a0', '#328c73'], path: ['#857a98', '#6c6083'],
        rock: ['#a9a3cf', '#6d6894'], crystal: ['#c7b6ef', '#8f7cc4', '#5d4e8f'], trunk: ['#3f2f55', '#8a6aa0'], wood: '#c9a77a',
        tree: ['#58c2b0', '#1f5a6c'], bulb: '#ff8cd8', glow: '#86f2dc', water: '#5fe0f0', flowers: ['#fff4c2', '#ffc2e6', '#c9f7ff'],
        warm: '#ffbe8c', cool: '#1e3278'
      }
    },
    /* The way through: the tutorial run (and the healing pond); a first,
       easy fight, straight in, to learn fighting; a run with the team
       jump over a gorge; the engine piece (the robots wake); a run with
       a ride on Mossy, the forest giant; a fork and a room; a run with a bigger gorge; the
       boss. */
    /* (Level 1 is all running, no fighting: it ends at the engine piece -
       the robots wake, and a friendly giant carries the crew away. After
       its 'end', the rest - the tutorial fight, a fork, a room, the big
       gorge and the Sweeper - kept for level 2: not played yet.) */
    plan: ['corridor', 'corridor', 'depot', 'ride', 'end', 'tutorial', 'corridor', 'cross', 'room', 'corridor', 'boss', 'end'],
    /* What happens in each corridor (lkp-game.js _layout): one event
       apiece - the path squeezing narrow then opening wide, a big jump
       over a ravine, a zip line - and the run of obstacles round it,
       the set pieces it mixes in (pieces). big: a wider ravine. */
    corridors: [
      { event: 'squeeze' },
      { pieces: ['logs', 'slalom', 'duckrun', 'arc'] },
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
      narrow: ['The path\'s closing in! Squeeze together!', 'SQUEEZE IN!'],
      wide: ['It opens right up! Spread out and grab them all!', 'SPREAD OUT!'],
      ravine: ['A gorge! Everyone, get ready to JUMP!', 'GET READY TO JUMP!'],
      fountain: ['Spring water! Run along it to heal up.', 'HEAL']
    },
    lines: {
      /* The opening (lkp-intro.js): answering her call, inside the helmet. */
      wakeup: [['nova', 'ksssh \u2014 Crew, do you read me? ...You\'re okay!', '']],
      /* ...and once they're up, on the path. */
      rise: [['nova', 'On your feet! Follow the path, and I\'ll talk you through it.', '']],
      /* The first corridor: the story, a piece at a time, in the quiet
         between her tips (lkp-game.js: said as the run reaches them). */
      walk: [
        ['nova', 'This is Commander Nova, on the Meridian. The ship went down in the storm. You\'re on a planet we know nothing about.', ''],
        ['nova', 'Your suits took a beating in the crash. Hang in there \u2014 we\'ll find you somewhere to heal.', ''],
        ['nova', 'My scans show a signal up ahead. Maybe the engine piece we lost. That\'s where you\'re headed.', '']
      ],
      /* The healing pond, a stop along the first corridor. */
      pondIn: [['nova', 'Stop here! Your vitals are climbing \u2014 the water\'s healing you. Hug yourselves to heal even faster!', 'HUG TO HEAL']],
      pondWait: [['nova', 'Almost there \u2014 hold position.', '']],
      pondDone: [['nova', 'Vitals green across the board. Let\'s move!', '']],
      /* Mossy, the gentle giant, after the boss (lkp-ride.js). */
      rideMeet: [['nova', 'Look up ahead! A big friendly giant. Run, crew, catch up to it!', 'CATCH UP!']],
      rideOn: [['nova', 'Everyone on? Sit down and rest, crew. You\'ve earned it.', 'SIT AND RELAX']],
      rideOff: [['nova', 'What a ride! Say thank you, crew. I think we\'ll call it... Mossy!', 'BYE, MOSSY!']],
      depot: [
        ['nova', 'There it is! The engine piece! Everyone, roll your arms to power it up!', 'ROLL YOUR ARMS']
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
        ['nova', 'We\'ve got the engine piece! Brilliant work, crew.', 'LEVEL CLEAR!'],
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
