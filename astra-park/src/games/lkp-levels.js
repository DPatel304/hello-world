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

   A new level is a new entry (and, if it needs one, a new boss). */

export const LEVELS = [
  {
    id: 'verdant', name: 'Verdant Crash Site', goal: 'Find the engine piece',
    palette: {
      bg: '#14261b', floor: '#2d4b2b', edge: 'rgba(255,255,255,.3)', trees: '#1f5a34',
      blocker: '#7a5230', beam: '#6b4423', post: '#3d2a17', gap: '#0b0e09', fountain: '#38bdf8',
      wall: '#22402a', hall: '#14261b', hallFloor: '#2d4b2b', hallRed: '#45282a'
    },
    plan: ['corridor', 'cross', 'room', 'depot', 'corridor', 'cross', 'room', 'corridor', 'boss', 'end'],
    enemies: { wild: 'beast', awake: 'rustbot', wildName: 'wild beasts', awakeName: 'robots' },
    boss: 'scout', bossName: 'Scout',
    tips: {
      coin: ['Grab those coins!', 'COINS!'],
      blocker: ['Fallen tree! Lean to go around it.', 'LEAN!'],
      beam: ['Low branch! Duck under it!', 'DUCK!'],
      gap: ['A ditch! Hop over it!', 'HOP!'],
      fountain: ['Spring water! Run through it to heal up.', 'HEAL']
    },
    lines: {
      opening: [
        ['nova', 'Crew, wake up. This is Nova, your ship\'s computer.', ''],
        ['nova', 'We crash-landed. You were thrown clear, a long way from the ship.', ''],
        ['nova', 'The engine\'s missing a piece. My scans say there\'s one in an old depot, through this forest.', 'FIND THE ENGINE PIECE'],
        ['nova', 'Head that way. I\'ll guide you. Let\'s go!', 'GO!']
      ],
      depot: [
        ['nova', 'There it is! The engine piece! Everyone, roll your arms to power it up!', 'ROLL YOUR ARMS']
      ],
      waking: [
        ['robot', 'Clean. The planet. Of everything.', 'CLEAN THE PLANET.'],
        ['nova', 'That surge woke every robot on the planet. And they think we\'re the mess. Stay sharp, crew!', '']
      ],
      boss: [
        ['robot', 'Contamination detected. Cleaning.', 'CLEANING.'],
        ['nova', 'A scout robot! Watch the red, dodge its charges, and hit it when it stops!', 'DODGE!']
      ],
      won: [
        ['nova', 'The Scout\'s down! We\'ve got the engine piece.', 'LEVEL CLEAR!'],
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
