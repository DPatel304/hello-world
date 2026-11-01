/* Last Known Position's weapons. Everyone starts with the standard punch.
   At the depot, as the robots wake, each player picks a melee weapon -
   one of MELEE - and keeps it the whole run; early in level 2 they each
   get a ranged one too - one of RANGED - and keep that. Neither is ever
   swapped: they only get better, through the level-up cards.

   In a fight both fire on their own. Ranged while there's no robot in
   reach - the few seconds they're walking up, and whenever the next lot
   come in - at the nearest robots still on their way; melee once one's
   in front of you, hitting everything in reach. (A hop still adds a
   bonus shot.)

   The names and numbers here are stand-ins till the real weapons are
   decided: a heavy, slow hammer and quick, wide blades; a zapper. */

/* A melee weapon: how often it swings (seconds), how hard, how far
   across it reaches (lanes) - and its look. */
export const STANDARD = { id: 'standard', name: 'PUNCH', icon: '\u{1F44A}', every: 1.5, dmg: 6, reach: 0.32, style: 'ring' };
export const MELEE = {
  hammer: { id: 'hammer', name: 'HAMMER', icon: '\u{1F528}', every: 2.2, dmg: 15, reach: 0.3, style: 'slam' },
  blades: { id: 'blades', name: 'BLADES', icon: '\u{1F5E1}\u{FE0F}', every: 0.9, dmg: 5, reach: 0.4, style: 'spin' }
};
/* A ranged weapon: how often it fires, how hard, at how many robots at
   once. */
export const RANGED = {
  zapper: { id: 'zapper', name: 'ZAPPER', icon: '⚡', every: 1.2, dmg: 6, bolts: 1 }
};

/* The level-up cards - the same six for everyone, each one a crew
   member's own to take up to MAX_LEVEL times. Every level up, three are
   drawn at random and offered to everyone; now and then (GOLD_CHANCE) one
   comes up gold, and counts twice. What each does, a level at a time: */
export const MAX_LEVEL = 5, GOLD_CHANCE = 1 / 8;
export const CARDS = {
  damage: { name: 'DAMAGE', icon: '\u{1F4A5}' },        /* both weapons hit DAMAGE_UP harder */
  speed: { name: 'SPEED', icon: '⚡' },             /* both swing and fire SPEED_UP sooner */
  armor: { name: 'ARMOR', icon: '\u{1F6E1}\u{FE0F}' },  /* ARMOR_UP less from every hit */
  teamwork: { name: 'TEAMWORK', icon: '\u{1F91D}' },    /* TEAM_UP more from each teammate close by */
  wider: { name: 'WIDER', icon: '↔\u{FE0F}' },     /* melee reaches WIDE_UP wider; ranged bolts burst SPLASH across */
  maxhp: { name: 'MAX HP', icon: '❤\u{FE0F}' }     /* HP_UP more health - and that much back, now */
};
export const DAMAGE_UP = 0.3, SPEED_UP = 0.15, ARMOR_UP = 0.1, TEAM_UP = 0.12, WIDE_UP = 0.2, SPLASH = 0.14, HP_UP = 30;
/* Standing together, before any TEAMWORK: each teammate close by adds
   TEAM more to your hits. */
export const TEAM = 0.3;

/* How many times a crew member has taken a card. */
export const level = (rn, key) => (rn.up && rn.up[key]) || 0;

/* What a crew member's carrying, upgrades and all: their melee weapon
   (the standard punch till they pick one) and ranged (none, till they
   get one). Every card makes both better at once. */
export function arms(rn){
  const m = rn.melee || STANDARD, r = rn.ranged || null;
  const hard = 1 + DAMAGE_UP * level(rn, 'damage'), quick = Math.pow(1 - SPEED_UP, level(rn, 'speed')), wide = level(rn, 'wider');
  return {
    melee: { ...m, every: m.every * quick, dmg: m.dmg * hard, reach: m.reach * (1 + WIDE_UP * wide) },
    ranged: r && { ...r, every: r.every * quick, dmg: r.dmg * hard, splash: SPLASH * wide }
  };
}

/* What's left of a hit after armor (at least 1). */
export const armored = (rn, dmg) => Math.max(1, Math.round(dmg * (1 - ARMOR_UP * level(rn, 'armor'))));
/* What each teammate close by adds to a crew member's hits. */
export const teamBonus = (rn) => TEAM + TEAM_UP * level(rn, 'teamwork');

/* Taking a card - twice over if it's gold - as far as MAX_LEVEL. */
export function take(key, rn, gold = false){
  rn.up = rn.up || {};
  const was = level(rn, key), now = Math.min(MAX_LEVEL, was + (gold ? 2 : 1));
  rn.up[key] = now;
  if (key === 'maxhp'){ const more = HP_UP * (now - was); rn.max += more; rn.hp = Math.min(rn.max, rn.hp + more); }
}

/* Three of the cards, drawn at random - leaving out any that everyone
   here has maxed - each maybe gold. */
export function draw(crew, rand = Math.random){
  const open = Object.keys(CARDS).filter(k => !crew.length || crew.some(rn => level(rn, k) < MAX_LEVEL));
  for (let k = open.length - 1; k > 0; k--){ const j = Math.floor(rand() * (k + 1)); [open[k], open[j]] = [open[j], open[k]]; }
  return open.slice(0, 3).map(key => ({ key, gold: rand() < GOLD_CHANCE }));
}
