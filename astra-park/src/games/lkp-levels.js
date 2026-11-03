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
    plan: ['corridor', 'cross', 'room', 'depot', 'corridor', 'cross', 'room', 'corridor', 'cross', 'room', 'corridor', 'boss', 'end'],
    /* Each corridor its own place along the way (the first is the crash
       site's forest): its look - changes to the world palette, and what
       stands by the path (sides) - its name, what Nova says arriving, and
       its own run of obstacles (lkp-game.js _layout: the pieces it mixes
       in most). */
    places: [
      null,
      { name: 'Redrock Canyon', say: ['A canyon. Watch those walls \u2014 rocks are coming loose up there!', 'LOOK OUT ABOVE'], pieces: ['boulder', 'boulder', 'slalom', 'combo'],
        world: { key: 'verdant-canyon', sides: 'cliffs',
          sky: ['#5d9edc', '#9fcbea', '#f1dcc6', '#ffd6aa'], haze: '#efd8c6', hillLit: '#dcae94', hillDark: '#a0716a', rim: '#fff0d7',
          ground: ['#b8937c', '#9d7a66', '#81604f'], grass: ['#b5b77e', '#7c8a50'], path: ['#caa98a', '#a7836a'],
          rock: ['#e3b99c', '#a5705e'], crystal: ['#f2c6a6', '#c98d70', '#8c5a49'], flowers: ['#ffe3a8', '#ffb39a', '#ffffff'], warm: '#ffb07a', cool: '#3a2a6a' } },
      { name: 'Glowcap Woods', say: ['It\'s getting dark out there. Those mushrooms are glowing\u2026 stay close, crew.', 'STAY CLOSE'], pieces: ['duckrun', 'slalom', 'arc', 'duckrun'],
        world: { key: 'verdant-dusk', sides: 'shrooms', caps: ['#ff7ad9', '#6ff7e6', '#b79cff', '#ffd36b'],
          sky: ['#1b1f52', '#46387a', '#9a5b8f', '#f2977f'], sun: '#ffcfa6', haze: '#76679c', cloud: '#e6c3d8', cloudShade: '#5e4f86', planetAlpha: 0.85,
          hillLit: '#6c5f9e', hillDark: '#3b336c', rim: '#ffc6b0',
          ground: ['#3b5c71', '#2c4b63', '#213b54'], grass: ['#4f938c', '#28606a'], path: ['#5b5383', '#463f70'],
          rock: ['#7b71a8', '#4c4480'], glow: '#9ff6ff', bulb: '#ff8cd8', flowers: ['#9ff6ff', '#ff9ce0', '#fff4c2'], warm: '#ff8f7a', cool: '#14185a' } },
      { name: 'The Sweeper\'s Trail', say: ['Scorch marks\u2026 the Sweeper came through here. We\'re close now. Stay sharp!', 'STAY SHARP'], pieces: ['slalom', 'combo', 'boulder', 'duckrun'],
        world: { key: 'verdant-scorched', sides: 'burnt',
          sky: ['#6a7aa3', '#a596a6', '#ddb19a', '#ffb487'], haze: '#d6b6a6', cloud: '#e6dad6', cloudShade: '#978892', smoke: '#5a5560',
          hillLit: '#b69a99', hillDark: '#785f6f', rim: '#ffd7b8',
          ground: ['#7c7a69', '#605f54', '#4b4a44'], grass: ['#8c9a6a', '#5b6a46'], path: ['#716673', '#5a5263'],
          rock: ['#9b91a2', '#5f5869'], crystal: ['#b9b3c0', '#7d7686', '#4d4855'], trunk: ['#231c22', '#4a3838'], flowers: ['#ffb36b', '#ffd28a', '#e2e2e2'], warm: '#ffa36b', cool: '#2a2240' } }
    ],
    enemies: { wild: 'beast', awake: 'rustbot', wildName: 'wild beasts', awakeName: 'robots' },
    boss: 'scout', bossName: 'Sweeper',
    tips: {
      crystal: ['Grab those crystals!', 'CRYSTALS!'],
      blocker: ['Fallen tree! Lean to go around it.', 'LEAN!'],
      beam: ['Low branch! Duck under it!', 'DUCK!'],
      gap: ['A ditch! Hop over it!', 'HOP!'],
      roller: ['A boulder, rolling across! Lean out of its way!', 'DODGE IT!'],
      fountain: ['Spring water! Run along it to heal up.', 'HEAL']
    },
    lines: {
      /* The opening (lkp-intro.js): her briefing once they've answered,
         at the pond, and sending them off. */
      brief: [
        ['nova', 'ksssh \u2014 Mayday, mayday. This is Commander Nova, survey vessel Meridian. If anyone\'s alive down there, pick up.', ''],
        ['nova', 'There you are. Okay, listen \u2014 the Meridian went down in the storm. You\'re on an uncharted planet. No survey data, no maps. We know nothing about what\'s down there with you.', ''],
        ['nova', 'The ship\'s a wreck \u2014 engine\'s dead, hull\'s breached. I can\'t get you out until that engine\'s running again.', ''],
        ['nova', 'Wait \u2014 my short-range scan\'s picking up something. A pool, about fifty meters east of you. The water\'s throwing off an energy signature I\'ve never seen. Might be nothing. Might save your lives. Get over there and check it out \u2014 carefully.', '']
      ],
      pondIn: [['nova', 'Your vitals are climbing \u2014 it\'s working! The water\'s healing you. Everyone in \u2014 don\'t move until you\'re at full strength.', '']],
      pondWait: [['nova', 'Almost there \u2014 hold position.', '']],
      go: [['nova', 'Vitals green across the board. Alright \u2014 the engine piece tore loose in the crash. It\'s out there in the forest somewhere, and without it, nobody\'s leaving this planet. Start moving. Nova out.', '']],
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
        ['nova', 'The Sweeper\'s down! We\'ve got the engine piece.', 'LEVEL CLEAR!'],
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
