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

/* What a crew member's carrying, upgrades and all: their melee weapon
   (the standard punch till they pick one) and ranged (none, till they
   get one), each with how much better it's got. */
export function arms(rn){
  const m = rn.melee || STANDARD, r = rn.ranged || null, up = rn.up || {};
  return {
    melee: { ...m, every: m.every * Math.pow(0.88, up.quicker || 0), dmg: m.dmg * (1 + 0.25 * (up.heavier || 0)), reach: m.reach * (1 + 0.15 * (up.wider || 0)) },
    ranged: r && { ...r, every: r.every * Math.pow(0.85, up.faster || 0), dmg: r.dmg * (1 + 0.25 * (up.charged || 0)), bolts: r.bolts + (up.bolts || 0) }
  };
}

/* The level-up cards: what each one's for (melee, ranged, or anyone),
   its name, and what it does. A weapon card shows that weapon's
   picture. */
export const CARDS = {
  heavier: { for: 'melee', name: 'HEAVIER' },
  wider: { for: 'melee', name: 'WIDER' },
  quicker: { for: 'melee', name: 'QUICKER' },
  faster: { for: 'ranged', name: 'FASTER' },
  bolts: { for: 'ranged', name: 'MORE BOLTS' },
  charged: { for: 'ranged', name: 'STRONGER' },
  wheels: { for: 'any', name: 'ARM ROLL', icon: '\u{1F504}' },
  vitality: { for: 'any', name: 'HEALTH', icon: '\u{2764}\u{FE0F}' },
  swift: { for: 'any', name: 'SPEED', icon: '\u{1F45F}' }
};

/* The cards a crew member could be offered: their melee weapon's (the
   punch's, just HEAVIER, before they've picked one), their ranged
   weapon's once they have one, and the ones for anyone. */
export function cardsFor(rn){
  const out = rn.melee ? ['heavier', 'wider', 'quicker'] : ['heavier'];
  if (rn.ranged) out.push('faster', 'bolts', 'charged');
  return out.concat('wheels', 'vitality', 'swift');
}

/* A card's picture, for this crew member. */
export function cardIcon(key, rn){
  const c = CARDS[key];
  if (c.for === 'melee') return (rn.melee || STANDARD).icon;
  if (c.for === 'ranged') return rn.ranged ? rn.ranged.icon : '⚡';
  return c.icon;
}

/* Taking a card. */
export function take(key, rn){
  if (key === 'vitality'){ rn.max += 20; rn.hp = Math.min(rn.max, rn.hp + 20); return; }
  if (key === 'wheels'){ rn.wheels = (rn.wheels || 1) + 0.3; return; }
  if (key === 'swift'){ rn.swift = (rn.swift || 1) + 0.2; return; }
  rn.up = rn.up || {};
  rn.up[key] = (rn.up[key] || 0) + 1;
}
