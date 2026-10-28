import { clamp } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Avatars } from '../ui/avatars.js';
import { FaceCam } from '../ui/faces.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';
import { JumpWatch } from '../tracking/jump.js';
import { PATHS, PADS, PAD_R, CASTLE, CASTLE_BASE, CHEST, MAX_LVL, castleBox, towerTall, onCastle, along, drawMeadow, drawCastle, drawPad, drawTower, drawChest, heart,
         drawMonster, drawSlamRing, drawIceBlock, drawBlizzard, drawLight, drawPoof, drawButterfly, drawTree, TREES, drawTent, TENT, inked, drawShot, coin, star, drawKnight, drawMarker, drawWorkRing, drawHammer } from './castle-art.js';

/* Tower Defense. Silly monsters - bouncing slimes, quick little goblins,
   bats, and now and then a big ogre - come in at the top left and march the
   long way round the meadow, back and forth along one winding trail, to
   the castle in the bottom left. Each child has a little knight out on
   the meadow, in their colour with their face in the helmet, and the
   knights do everything just by where they stand.

   Reach a hand out to walk your knight - out to the side, up high to go up
   the map, down low to come down - and run on the spot to hurry. Near a
   monster, the knight swings its sword by itself - and rolling your arms
   round each other, like the wheels on the bus, makes it swing twice as
   fast. Stand on an empty stone pad and a see-through tower appears:
   jump to change which kind (archer, cannon, frost), and stay put to build
   it. Stand at a tower and the knight mends it if an ogre has been smashing
   it, or else, slowly, makes it bigger and stronger, up to ten times. The
   castle starts out small, with only a few hearts: stand at it and the
   knight mends them, or once it's whole, slowly builds it a little bigger,
   with two more. Squatting makes any of that go twice as fast, and the
   knight bangs away with its hammer. Hurt? Walk to the medical tent and
   give yourself a hug.
   Monsters drop coins, which fly into the castle; new towers cost coins,
   building them up and mending is free - it only takes time.

   Between waves there's a breather, to build and mend. The waves keep coming, each bigger than the last, until the castle's
   hearts run out. Nothing is counted in numbers: the castle flies a pennant
   for every wave held off. */

export const ROUND = 900;
export const START_COINS = 7;
export const COST = { archer: 3, cannon: 5, frost: 4 };
export const KINDS = ['archer', 'cannon', 'frost'];
export { MAX_LVL };
const levels = (f) => Array.from({ length: MAX_LVL }, (_, l) => f(l));
/* The castle starts small, with only a few hearts; each level builds it a
   little bigger, with two more. */
export const CASTLE_HEARTS = levels(l => 5 + 2 * l);
export const HEARTS = CASTLE_HEARTS[0];
/* Towers' health, by level; ogres passing close smash at it. */
export const TOWER_HP = levels(l => 8 + 6 * l), OGRE_SMASH = 1.5, SMASH_R = 0.15;
/* Seconds of standing there: to build, to mend a heart; towers mend
   TOWER_FIX health a second. Squatting makes it all go SQUAT_FAST times as
   fast. Building costs coins; building up is free, but slow, and slower
   with every level: upgradeTime(lvl) to take a tower from lvl to the next,
   castleTime(lvl) the castle - several minutes' standing, all told, to take
   one all the way to the top. */
export const BUILD = 2.5, REPAIR = 4, TOWER_FIX = 3, SQUAT_FAST = 2;
/* A squat: the hips dropping SQUAT_DROP body sizes below standing height.
   Bobbing up and down keeps it going - it counts for SQUAT_HOLD seconds
   after each time down - so nobody has to hold one. */
export const SQUAT_DROP = 0.15, SQUAT_HOLD = 0.8;
/* Getting better: a hurt knight walks to the medical tent (within TENT_R of
   it) and the child gives themselves a hug - arms crossed over the chest,
   each hand within HUG_NEAR shoulder widths of the other shoulder, for
   HUG_SETTLE seconds; while it lasts the knight gets a bonk's worth back
   every HUG_MEND seconds. Nowhere else, and not on its own. */
export const HUG_NEAR = 0.6, HUG_SETTLE = 0.3, HUG_MEND = 1, TENT_R = 0.11;
export const upgradeTime = (lvl) => 5 + 2 * lvl, castleTime = (lvl) => 7 + 2 * lvl;
export const AT_PAD = 0.075;                          /* how near a pad counts as standing on it */
/* Knights walk when you march on the spot, the way a hand points. The
   legs are the go: no marching, no walking, however you point - marching a
   little (knees at MARCH_MIN of MARCH_FULL torso-lengths a second) is a
   WALK, marching hard is a RUN. The hands are the steering: reach a hand
   out from your chest (HAND_CENTRE torso-lengths below the shoulders) and
   that's the way - out to the side is sideways, up above your shoulders is
   up the map, down to your tummy is down. Whichever hand is reaching
   further steers - and if both reach the same way, both do: steadier, and
   TWO_HANDS times as fast. It takes HAND_START torso-lengths of reach,
   held for HAND_HOLD seconds (so a wave or a scratch is nothing), to pick a
   way, but only HAND_KEEP to keep it. Hands resting at your sides or on
   your hips (lower than HAND_REST torso-lengths above the hips) are no
   reach; nor is a hug, or rolling your arms.

   Aim assist: let go near a pad, the tent or the castle (within SNAP_R)
   and the knight walks the last bit onto it; reach roughly toward one
   nearby (within MAGNET_R) and the knight's path bends onto it.

   With the mouse, the knight walks to where the pointer rests. */
export const HAND_CENTRE = 0.15, HAND_REST = 0.1, HAND_START = 0.5, HAND_KEEP = 0.35, HAND_HOLD = 0.25, TWO_HANDS = 1.2, MARCH_FULL = 1.2, MARCH_MIN = 0.15;
export const SNAP_R = 0.1, MAGNET_R = 0.3;
export const WALK = 0.12, RUN = 0.24, KNIGHT_SIZE = 0.085, POINT_HOLD = 0.35;
export const KNIGHT_SPEED = RUN * TWO_HANDS;
/* The sword: swung by itself at a monster within reach - ROLL_FAST times as
   often while the child rolls their arms round each other, the wheels on
   the bus going round. That's the hands circling each other: the line from
   one to the other turning on round, the same way, at ROLL_SPIN or more
   (radians, built up over about ROLL_FOR seconds), hands no more than
   ROLL_GAP apart. Hands going up and down only swing that line to and
   fro, so they never add up to a roll. */
export const ROLL_FAST = 2, ROLL_SPIN = 3, ROLL_FOR = 0.6, ROLL_GAP = 0.4;
/* Knights grow with what they beat: every monster they finish off counts
   (an ogre for five), and every ten levels take one more each, up to
   KNIGHT_MAX - a child who fights on a team that falls by wave 18 or so
   gets to about 10-20, one who fights all the way to wave 35, about 80. A
   knight starts with a tiny sword - a little longer, harder and quicker
   every level - and at the top it's a great golden one. */
export const KNIGHT_MAX = 99;
export const killsFor = (lvl) => 4 + Math.floor(lvl / 10);
export const swordAt = (lvl) => { const f = lvl / KNIGHT_MAX; return { reach: 0.06 + 0.04 * f, dmg: 0.5 + 2 * f, cool: 0.8 - 0.3 * f, size: 0.4 + 1.3 * f }; };
export const SWORD_R = swordAt(0).reach, SWORD_COOL = swordAt(0).cool, SWORD_DMG = swordAt(0).dmg;
/* Ogres go for knights close by, but slowly: an ogre that sees one lifts its
   club high over its head and a warning ring spreads on the ground round
   it, and only after WINDUP seconds does the club come down - on whoever is
   still inside the ring - and not in the air: a child who jumps, for real,
   up to DODGE seconds before it lands, hops clean over it. Then OGRE_CLUB
   seconds before it can try again.
   A knight takes KNIGHT_HP bonks, and only gets better at the medical tent.
   Nothing else harms a knight.

   Bonked out, a knight lies there seeing stars - for as long as it takes a
   friend to come and get it up: their knight walks over to it (within
   REVIVE_R, a good way), and the two children high-five, for real, in the
   room. It's meant to be easy - children's hands are quick and the camera
   is not - so it's two of their hands coming anywhere near each other
   (within HIGH_FIVE screen heights), anywhere above their tummies. Up it gets, right there, every level kept. Only when every
   knight is down does nobody need to: after ALL_DOWN seconds they're all
   back at the castle - but back to the very start, every level lost. Just
   up, a knight is safe for SAFE seconds. */
export const OGRE_REACH = 0.04, WINDUP = 1.2, OGRE_CLUB = 1.6, KNIGHT_HP = 3, SAFE = 3, DODGE = 0.6;
export const REVIVE_R = 0.18, HIGH_FIVE = 0.2, ALL_DOWN = 10;
export const SLAM_R = OGRE_REACH + 0.13 * 0.3;
/* Between waves: BUILD_TIME to get ready (FIRST_BUILD before the first). */
export const BUILD_TIME = 15, FIRST_BUILD = 20;
const BREAK = BUILD_TIME;
/* What towers do at each level: each step a little further, faster and
   harder, and every few levels archers and frost towers shoot at one more
   monster at a time (`many`), and the cannon's blast catches more (`most`) -
   so a tower at the top is many times what it was, against a crowd too. */
const grow = (v0, k) => levels(l => v0 * (1 + k * l));
export const STATS = {
  archer: { range: grow(0.24, 0.03), rate: grow(1.1, 0.16), dmg: grow(1, 0.3), many: levels(l => 1 + Math.floor(l / 3)) },
  cannon: { range: grow(0.21, 0.03), rate: grow(0.45, 0.11), dmg: grow(2.5, 0.3), splash: grow(0.08, 0.04), most: levels(l => 3 + l) },
  frost:  { range: grow(0.2, 0.03), rate: grow(0.8, 0.11), dmg: grow(0.4, 0.3), slow: levels(l => 0.55 - 0.025 * l), many: levels(l => 1 + Math.floor(l / 3)) }
};
export const MONSTERS = {
  slime:  { hp: 3, speed: 0.06, size: 0.08, coins: 1, harm: 1 },
  goblin: { hp: 2, speed: 0.095, size: 0.085, coins: 1, harm: 1 },
  bat:    { hp: 2, speed: 0.077, size: 0.08, coins: 1, harm: 1, flies: true },
  ogre:   { hp: 18, speed: 0.04, size: 0.13, coins: 5, harm: 3 },
  troll:  { hp: 70, speed: 0.032, size: 0.15, coins: 15, harm: 5 }
};
/* The Frost Troll: a great blue boss, every TROLL_EVERY waves. FROST_FIRST
   seconds after it comes out, and then every FROST_EVERY, it raises its arms
   and a blizzard gathers for FROST_WARN seconds - and then every knight
   still standing is frozen solid in a block of ice: no walking, no sword,
   no building. Wiggling breaks it: the whole body shaking, the ice cracking
   as it goes - ICE_BREAK seconds of good wiggling (WIGGLE body sizes a
   second of movement) shatters it, and stopping doesn't undo what's done.
   Ice is hard: no ogre can bonk a knight inside it. */
export const TROLL_EVERY = 10, FROST_FIRST = 6, FROST_EVERY = 30, FROST_WARN = 3, ICE_BREAK = 5, WIGGLE = 1.5;
const SLOW_FOR = 1.6;
/* Monsters drawn in ink outlines while there are no more than this many. */
const INK_MOST = 150;
const ASPECT = 16 / 9;

/* What comes in wave w: more each time - that's the whole challenge; the
   monsters themselves never get faster or tougher. It creeps up slowly at
   first (7, 9, 11, 13, 17...) and then snowballs, so a strong team holds
   about half an hour before the horde is too much. Goblins from the
   second wave, bats from the third, an ogre (or more) every fifth, and red
   ones creeping in. All along the one trail. */
export const POUR = 8;   /* seconds a wave takes to come out, once it's big */
/* The more children playing, the bigger every wave: CROWD[n - 1] times as
   many for n of them - one child alone has it easiest, four hardest. */
export const CROWD = [1, 1.45, 1.85, 2.6];
const crowd = (n) => CROWD[clamp(Math.round(n), 1, CROWD.length) - 1];
/* At most CAP in a wave - past that, the ogres keep coming (a crowd much
   bigger is too much to draw smoothly). */
export const CAP = 800;
export const countOf = (w, n = 1) => Math.min(CAP, Math.round((5 + w + Math.pow(1.40, w - 1)) * crowd(n)));
/* Seconds between monsters coming out in wave w. */
export const gapOf = (w, n = 1) => Math.min(1.3, POUR / countOf(w, n));
/* Red ones: every kind has a meaner, red, level-two sort, with more life,
   that hits harder (RED). None at first, then more and more of each wave,
   up to RED_MOST of it - a little sooner with more children playing. */
export const RED = { hp: 2, harm: 2, coins: 2, smash: 1.6, bonk: 2 }, RED_FROM = 4, RED_RAMP = 30, RED_MOST = 0.6;
export const redShare = (w, n = 1) => clamp((w - RED_FROM) / RED_RAMP + (crowd(n) - 1) * 0.05, 0, RED_MOST) * (w > RED_FROM ? 1 : 0);
export function waveOf(w, n = 1){
  const count = countOf(w, n), out = [], red = redShare(w, n);
  for (let k = 0; k < count; k++){
    const r = ((k * 7 + w * 3) % 12) / 12, r2 = ((k * 13 + w * 5) % 20 + 0.5) / 20;
    out.push({ kind: w >= 3 && r < 0.25 ? 'bat' : w >= 2 && r < 0.55 ? 'goblin' : 'slime', path: 0, red: r2 < red });
  }
  /* The ogres spread through the wave, not all at the end. */
  const ogres = Math.round(ogresOf(w) * crowd(n));
  for (let k = 0; k < ogres; k++) out.splice(Math.floor((k + 0.5) / ogres * out.length) + k, 0, { kind: 'ogre', path: 0, red: ((k * 7 + w) % 10 + 0.5) / 10 < red });
  /* The Frost Troll, a third of the way in - more of them, later on. */
  const trolls = w % TROLL_EVERY === 0 ? w / TROLL_EVERY : 0;
  for (let k = 0; k < trolls; k++) out.splice(Math.floor(out.length * (0.3 + 0.4 * k / Math.max(1, trolls))), 0, { kind: 'troll', path: 0, red: w >= TROLL_EVERY * 3 && k % 2 === 1 });
  return out;
}
/* Ogres: one or more every fifth wave, and from wave OGRE_FROM on, more and
   more in every wave - smashing towers and bonking knights, they're what
   finally wears down even the best-built meadow. */
export const OGRE_FROM = 14, OGRE_K = 12;
export const ogresOf = (w) => (w % 5 === 0 ? w / 5 : 0) + Math.floor(Math.max(0, w - OGRE_FROM) ** 2 / OGRE_K);

export default {
  /* Endless: it lasts as long as the castle holds. secs is only how long
     the music takes to build. */
  id: 'castle-defense', name: 'Tower Defense', stars: 2, accent: '#e5534b', secs: ROUND, endless: true,
  /* Arms go up now and then; a pause is a longer hold. */
  pauseHold: 3,
  /* Squatting is a move here: a player who crouches stays in. */
  keepSitters: true,
  create(n){ return new CastleDefense(n); }
};

class CastleDefense {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false; this.lost = false;
    this.coins = START_COINS;
    this.castleLvl = 1;
    this.hearts = HEARTS;
    this.wave = 0;              /* waves started */
    this.held = 0;              /* waves held off */
    this.state = 'build';       /* 'build' between waves, 'wave' while one is on */
    this.breakT = FIRST_BUILD;  /* time left before the next wave */
    this.queue = []; this.spawnT = 0;
    this.towers = new Map();    /* pad index -> tower */
    /* Which tower each empty pad will become; a jump changes it. */
    this.picks = new Map(PADS.map(p => [p.i, p.i % KINDS.length]));
    this.work = new Map();      /* what's being built, upgraded or mended -> how far along */
    this.mend = 0;
    this.allDown = 0;            /* how long every knight has been down */
    this.monsters = [];
    this.shots = [];
    this.bits = [];
    this.castleHit = 0;
    this.faces = new FaceCam();
    this.jumps = new JumpWatch();
    /* What's been done yet, for the hints. */
    this.seen = { built: false, jumped: false, dodged: false, squatted: false, hugged: false, rolled: false, wiggled: false, repaired: false };
    /* The knights wait by the castle, side by side. */
    this.knights = pose.players.map((_, i) => {
      const { x, y } = this.home(i);
      return { x, y, tx: x, ty: y, vx: 0, vy: 0, dir: 1, walk: 0, march: 0, lean: null, swing: 0, sword: 0,
               spin: 0, ra: null, hipBase: null, lowAgo: 9, hugT: 0, hugHeal: 0, hop: 0, at: null,
               lvl: 0, xp: 0, hp: KNIGHT_HP, calm: 0, bonk: 0, down: 0, downT: 0, helper: -1, safe: 0, glow: 0, ice: 0, iceWork: 0 };
    });
    this.avatars = new Avatars();
    this.out = null;
    this.nextId = 1;
  }

  get maxHearts(){ return CASTLE_HEARTS[this.castleLvl - 1]; }
  get built(){ return this.seen.built; }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    /* A big hit lands with the tiniest pause. */
    if (this.stop > 0){ this.stop -= dt; dt *= 0.2; }
    this.shake = Math.max(0, (this.shake || 0) - dt * 3);
    if (this.stomp) this.stomp.age += dt;
    this.t += dt;
    this.castleHit = Math.max(0, this.castleHit - dt * 2);
    this._waves(dt);
    this.faces.step(dt);
    this._knights(dt);
    this._rescues(dt);
    this._work(dt);
    this._march(dt);
    this._smash(dt);
    this._clubs(dt);
    this._frost(dt);
    this._towers(dt, W, H);
    this._shots(dt, W, H);
    this._stepBits(dt);
    this.avatars.step(dt, this.players);
  }

  _waves(dt){
    if (this.state === 'build'){
      this.breakT -= dt;
      if (this.breakT <= 0) this._startWave();
      return;
    }
    /* Each wave comes out over about the same time, so a bigger wave pours
       out faster - several at once, late on. */
    this.spawnT -= dt;
    while (this.queue.length && this.spawnT <= 0){
      const next = this.queue.shift();
      this._spawn(next.kind, next.path, next.red);
      this.spawnT += this.gap;
    }
    /* The wave is held off once every monster in it is gone - beaten, or
       got in: a pennant, a few coins, and time to build. */
    if (!this.queue.length && !this.monsters.length){
      this.held++;
      this.coins += 2 + Math.floor(this.wave / 3);
      this.state = 'build'; this.breakT = BREAK;
      sfx.fanfare();
    }
  }

  _startWave(){
    this.wave++; this.state = 'wave';
    /* Sized for however many children are playing now. */
    const n = Math.max(1, pose.players.slice(0, this.players).filter(p => p.present).length);
    this.queue = waveOf(this.wave, n); this.spawnT = 0;
    this.gap = Math.min(1.3, POUR / Math.max(1, this.queue.length));
    sfx.trumpet(1);
  }

  _spawn(kind, path = 0, red = false){
    const M = MONSTERS[kind], hp = M.hp * (red ? RED.hp : 1);
    /* Each walks a little to one side or the other of the middle of the
       trail, so a crowd looks like a crowd, not a queue. */
    this.monsters.push({ id: this.nextId++, wave: this.wave, kind, path, s: 0, side: (Math.random() - 0.5) * 0.05, hp, max: hp, speed: M.speed,
                         slowT: 0, slowK: 1, hurt: 0, wob: Math.random() * 6, red });
  }

  _march(dt){
    for (const m of this.monsters){
      m.hurt = Math.max(0, m.hurt - dt * 4);
      if (m.slowT > 0){ m.slowT -= dt; if (m.slowT <= 0) m.slowK = 1; }
      m.s += m.speed * m.slowK * dt;
      if (m.s >= PATHS[m.path].total){
        m.gone = true;
        this.hearts = Math.max(0, this.hearts - MONSTERS[m.kind].harm * (m.red ? RED.harm : 1));
        this.castleHit = 1;
        this.jolt(0.25 + 0.1 * MONSTERS[m.kind].harm);
        if (m.kind === 'ogre' || m.kind === 'troll') this.stompAt(CASTLE.x, CASTLE_BASE, 0.7);
        sfx.thud();
        if (this.hearts <= 0 && !this.lost){ this.lost = true; this.over = true; }
      }
    }
    this.monsters = this.monsters.filter(m => !m.gone);
  }

  pos(m){
    const p = along(m.s, m.path), k = m.side || 0;
    return { x: p.x + k / ASPECT * 0.7, y: p.y + k * 0.7, dir: p.dir };
  }

  /* ---------- the knights ---------- */

  _knights(dt){
    const jumped = pose.mouse.active ? [] : this.jumps.step(dt, pose.players, this.players);
    for (let i = 0; i < this.knights.length; i++){
      const k = this.knights[i], p = pose.players[i];
      k.sword = Math.max(0, k.sword - dt);
      k.swing = Math.max(0, k.swing - dt * 3);
      k.hop = Math.max(0, k.hop - dt * 3);
      k.air = Math.max(0, (k.air || 0) - dt);
      k.bonk = Math.max(0, k.bonk - dt * 3);
      k.glow = Math.max(0, k.glow - dt);
      k.safe = Math.max(0, k.safe - dt);
      const on = i < this.players && p && p.present && !this.out;
      if (!on){ k.vx = k.vy = 0; k.march = 0; k.lean = null; k.at = null; k.steering = k.marching = false; continue; }
      /* Bonked out: lying there till a friend comes. */
      if (k.down > 0){ k.downT += dt; k.vx = k.vy = 0; k.at = null; continue; }
      /* Frozen: nothing to do but wiggle free. */
      if (k.ice > 0){ k.vx = k.vy = 0; k.at = null; k.walk = 0; this._wiggle(i, k, p, dt); continue; }
      if (pose.mouse.active){
        /* The mouse: walk to where the pointer rests. */
        const h = p.hands.right;
        k.rest = (h.speed || 0) < 0.15 ? (k.rest || 0) + dt : 0;
        if (k.rest >= POINT_HOLD && this._onMap(h.x, h.y)){ k.tx = h.x; k.ty = h.y; }
        const dx = (k.tx - k.x) * ASPECT, dy = k.ty - k.y, d = Math.hypot(dx, dy);
        k.vx = d > 0.004 ? dx / d * RUN : 0; k.vy = d > 0.004 ? dy / d * RUN : 0;
        if (d < RUN * dt){ k.vx = dx / dt; k.vy = dy / dt; }
      } else {
        this._drive(k, p, dt);
        this._assist(k, dt);
        this._rollWatch(k, p, dt);
        this._squatWatch(k, p, dt);
      }
      this._hugWatch(i, k, p, dt);
      /* Walk: vx and vy are screen heights a second. */
      k.x = clamp(k.x + k.vx / ASPECT * dt, 0.02, 0.98); k.y = clamp(k.y + k.vy * dt, 0.06, 0.97);
      const sp = Math.hypot(k.vx, k.vy);
      if (Math.abs(k.vx) > 0.01) k.dir = k.vx > 0 ? 1 : -1;
      k.walk += (Math.min(1, sp / WALK) - k.walk) * Math.min(1, dt * 8);
      if (sp > 0.02){ k.driven = true; if (Math.random() < dt * 8 * sp / RUN) this._spark(k.x + (Math.random() - 0.5) * 0.01, k.y, 'rgba(200,170,120,.8)'); }
      k.at = this._spot(k);
      if (jumped.includes(i)) this._jump(i, k);
      this._sword(i, k);
    }
  }

  /* Marching and pointing: how hard the knees are going up and down sets
     the pace; which way the hands reach sets the way. */
  _drive(k, p, dt){
    const lm = p.lm;
    if (!lm){ k.vx = k.vy = 0; return; }
    const vis = (j) => (lm[j].v ?? 1) > 0.5;
    /* The knees if they're in view, else the ankles. */
    const [a, b] = vis(L.L_KNEE) && vis(L.R_KNEE) ? [L.L_KNEE, L.R_KNEE] : vis(L.L_ANKLE) && vis(L.R_ANKLE) ? [L.L_ANKLE, L.R_ANKLE] : [null, null];
    let legs = 0;
    if (a != null && k.legs && k.legs.a === a){
      legs = (Math.abs(lm[a].y - k.legs.ya) + Math.abs(lm[b].y - k.legs.yb)) / 2 / Math.max(dt, 1e-3) / (p.scale || 0.3) * 2.4;
    }
    k.legs = a != null ? { a, ya: lm[a].y, yb: lm[b].y } : null;
    k.march = (k.march || 0) + (clamp(legs / MARCH_FULL, 0, 1) - (k.march || 0)) * Math.min(1, dt * 4);
    /* The hand joystick: from the chest to whichever hand is reaching
       further, in torso-lengths. */
    const sy = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y) / 2, hy = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2;
    const T = Math.max(0.02, hy - sy), cx = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2, cy = sy + HAND_CENTRE * T;
    const reach = [];
    if (Math.abs(k.spin || 0) < ROLL_SPIN * 0.5 && !(k.hugT > 0.1)){
      for (const h of [p.hands.left, p.hands.right]){
        if (!h || h.y > hy - HAND_REST * T) continue;
        const vx = (h.x - cx) * ASPECT / T, vy = (h.y - cy) / T, d = Math.hypot(vx, vy);
        if (d >= HAND_KEEP) reach.push({ vx, vy, d });
      }
    }
    let best = reach.sort((a, b) => b.d - a.d)[0] || null, both = false;
    /* Both hands reaching the same way: steer with both. */
    if (reach.length === 2 && (reach[0].vx * reach[1].vx + reach[0].vy * reach[1].vy) / (reach[0].d * reach[1].d) > 0.7){
      const vx = (reach[0].vx + reach[1].vx) / 2, vy = (reach[0].vy + reach[1].vy) / 2;
      best = { vx, vy, d: Math.hypot(vx, vy) }; both = true;
    }
    /* Setting off takes a clear reach, held a moment; keeping going, less. */
    k.reachT = best && best.d >= HAND_START ? (k.reachT || 0) + dt : 0;
    if (!best || (!k.steering && k.reachT < HAND_HOLD)){ k.steering = false; k.lean = null; k.vx = k.vy = 0; return; }
    k.steering = true;
    let ux = best.vx / best.d, uy = best.vy / best.d;
    /* Aim assist: heading roughly for a place to stand nearby? Bend onto it. */
    const aim = this._spotsNear(k, MAGNET_R).find(q => q.d > 0.02 && (q.dx * ux + q.dy * uy) / q.d > 0.8);
    if (aim){ ux += aim.dx / aim.d * 0.6; uy += aim.dy / aim.d * 0.6; const m = Math.hypot(ux, uy); ux /= m; uy /= m; }
    /* No marching, no walking; marching harder, faster; both hands, faster still. */
    const go = k.march >= MARCH_MIN * (k.marching ? 0.6 : 1);
    k.marching = go;
    k.lean = { x: ux, y: uy, k: go ? clamp((k.march - MARCH_MIN) / (1 - MARCH_MIN), 0, 1) : 0, still: !go };
    const sp = go ? (WALK + (RUN - WALK) * k.lean.k) * (both ? TWO_HANDS : 1) : 0;
    k.vx = ux * sp; k.vy = uy * sp;
  }

  /* Places to stand near knight k, within r, nearest first: { x, y, dx, dy, d }
     (dx, dy, d in screen heights). */
  _spotsNear(k, r){
    const spots = PADS.map(p => ({ x: p.x, y: p.y }));
    spots.push({ x: TENT.x, y: TENT.y + 0.02 });
    spots.push({ x: castleBox(this.castleLvl).x, y: CASTLE_BASE - 0.12 });
    return spots.map(q => { const dx = (q.x - k.x) * ASPECT, dy = q.y - k.y; return { ...q, dx, dy, d: Math.hypot(dx, dy) }; })
      .filter(q => q.d < r).sort((a, b) => a.d - b.d);
  }

  /* Aim assist: a knight let go near a place to stand walks the last bit
     onto it. */
  _assist(k, dt){
    if (k.steering) return;
    const q = this._spotsNear(k, SNAP_R)[0];
    if (!q || q.d < 0.006) return;
    const sp = Math.min(WALK, q.d / Math.max(dt, 1e-3));
    k.vx = q.dx / q.d * sp; k.vy = q.dy / q.d * sp;
  }

  /* Squatting: the hips well below where they stand. Standing height follows
     the hips up quickly but down only slowly, so a squat stays a squat. */
  _squatWatch(k, p, dt){
    const lm = p.lm;
    k.lowAgo += dt;
    if (!lm) return;
    const hy = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2, s = p.scale || 0.3;
    if (k.hipBase == null) k.hipBase = hy;
    if ((hy - k.hipBase) / s > SQUAT_DROP) k.lowAgo = 0;
    k.hipBase += (hy - k.hipBase) * Math.min(1, dt * (hy > k.hipBase ? 0.15 : 1));
  }
  squatting(k){ return !pose.mouse.active && k.lowAgo < SQUAT_HOLD; }

  /* A hug: each hand at the other shoulder. Held a moment, it heals. */
  _hugWatch(i, k, p, dt){
    const lm = p.lm;
    const near = (a, b) => Math.hypot((lm[a].x - lm[b].x) * ASPECT, lm[a].y - lm[b].y);
    const vis = (j) => (lm[j].v ?? 1) > 0.4;
    const hug = !!lm && vis(L.L_WRIST) && vis(L.R_WRIST) && (() => {
      const sw = near(L.L_SHOULDER, L.R_SHOULDER) || 0.05;
      return near(L.L_WRIST, L.R_SHOULDER) < HUG_NEAR * sw && near(L.R_WRIST, L.L_SHOULDER) < HUG_NEAR * sw;
    })();
    k.hugT = hug ? k.hugT + dt : 0;
    /* Only at the medical tent. (With the mouse, standing there is enough.) */
    const healing = this.atTent(k) && (this.hugging(k) || pose.mouse.active);
    if (!healing || k.hp >= KNIGHT_HP){ k.hugHeal = 0; return; }
    this.seen.hugged = true;
    k.hugHeal += dt;
    if (Math.random() < dt * 6) this.bits.push({ kind: 'heart', x: k.x + (Math.random() - 0.5) * 0.02, y: k.y - KNIGHT_SIZE * 0.9, vx: 0, vy: -0.06, age: 0, life: 0.9 });
    if (k.hugHeal >= HUG_MEND){ k.hugHeal = 0; k.hp++; k.calm = 0; sfx.jar(k.hp); }
  }
  hugging(k){ return k.hugT >= HUG_SETTLE; }
  atTent(k){ return Math.hypot((TENT.x - k.x) * ASPECT, TENT.y + 0.02 - k.y) < TENT_R; }

  /* Rolling the arms: how far the line from one hand to the other has turned
     round lately, one way. */
  _rollWatch(k, p, dt){
    const l = p.hands.left, r = p.hands.right;
    const dx = (r.x - l.x) * ASPECT, dy = r.y - l.y, gap = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    let da = 0;
    if (k.ra != null && gap > 0.03 && gap < ROLL_GAP){
      da = a - k.ra;
      if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
    }
    k.ra = gap > 0.03 ? a : null;
    k.spin = (k.spin + da) * Math.exp(-dt / ROLL_FOR);
  }
  rolling(k){ return pose.mouse.active ? false : Math.abs(k.spin) >= ROLL_SPIN; }

  _onMap(x, y){ return x > 0.01 && x < 0.99 && y > 0.04 && y < 0.98; }
  _near(k, m, r){ const p = this.pos(m); return Math.hypot((p.x - k.x) * ASPECT, p.y - k.y) < r + MONSTERS[m.kind].size * 0.3; }

  /* The sword: the knight swings at the nearest monster in reach, by itself. */
  _sword(i, k){
    if (k.sword > 0) return;
    const sw = swordAt(k.lvl);
    let best = null, bd = 9;
    for (const m of this.monsters){
      if (!this._near(k, m, sw.reach)) continue;
      const p = this.pos(m), d = Math.hypot((p.x - k.x) * ASPECT, p.y - k.y);
      if (d < bd){ bd = d; best = m; }
    }
    if (!best) return;
    const fast = this.rolling(k);
    if (fast) this.seen.rolled = true;
    k.sword = sw.cool / (fast ? ROLL_FAST : 1); k.swing = 1;
    const p = this.pos(best);
    k.dir = p.x >= k.x ? 1 : -1;
    best.s = Math.max(0, best.s - (best.kind === 'ogre' ? 0.002 : 0.006));
    sfx.tick();
    for (let q = 0; q < 3; q++) this._spark(p.x, p.y - 0.04, '#ffffff');
    this._damage(best, sw.dmg, i);
  }

  /* A knight finishing off a monster grows a little; enough, and it goes up
     a level, with a sparkle in its colour. */
  _beat(i, m){
    const k = this.knights[i];
    if (!k || k.lvl >= KNIGHT_MAX) return;
    k.xp += MONSTERS[m.kind].coins * (m.red ? RED.coins : 1);
    while (k.lvl < KNIGHT_MAX && k.xp >= killsFor(k.lvl)){
      k.xp -= killsFor(k.lvl); k.lvl++; k.glow = 1;
      sfx.twinkle();
      for (let q = 0; q < 16; q++) this._spark(k.x, k.y - KNIGHT_SIZE * 0.6, q % 2 ? '#ffd24a' : PLAYER_COLORS[i]);
    }
    if (k.lvl >= KNIGHT_MAX) k.xp = 0;
  }

  /* Ogres swing their clubs at any knight within reach. */
  _clubs(dt){
    /* The knights an ogre at p could hit. */
    const inRing = (p) => this.knights.slice(0, this.players).map((k, i) => ({ k, i }))
      .filter(({ k, i }) => pose.players[i].present && !(k.down > 0) && !(k.ice > 0) && !(k.safe > 0) && Math.hypot((p.x - k.x) * ASPECT, p.y - k.y) <= SLAM_R);
    for (const m of this.monsters){
      if (m.kind !== 'ogre') continue;
      m.club = Math.max(0, (m.club || 0) - dt);
      m.bonk = Math.max(0, (m.bonk || 0) - dt * 3);
      const p = this.pos(m);
      /* Winding up: when it's done, down comes the club. */
      if (m.wind > 0){
        m.wind -= dt;
        if (m.wind > 0) continue;
        m.wind = 0; m.club = OGRE_CLUB; m.bonk = 1;
        this.jolt(0.35); this.stompAt(p.x, p.y, 0.6);
        sfx.thud();
        for (let q = 0; q < 10; q++) this._spark(p.x + (Math.random() - 0.5) * SLAM_R / ASPECT * 2, p.y + (Math.random() - 0.5) * 0.02, '#c9a66b');
        for (const { k, i } of inRing(p)){
          /* Jumped just in time: over it! */
          if (k.air > 0){
            this.seen.dodged = true; sfx.twinkle();
            for (let q = 0; q < 10; q++) this._spark(k.x + (Math.random() - 0.5) * 0.03, k.y - KNIGHT_SIZE * 0.3, PLAYER_COLORS[i]);
            continue;
          }
          k.hp -= m.red ? RED.bonk : 1; k.calm = 0; k.bonk = 1;
          for (let q = 0; q < 6; q++) this._spark(k.x, k.y - KNIGHT_SIZE * 0.8, '#ffe27a');
          if (k.hp <= 0) this._knockOut(i, k);
        }
        continue;
      }
      if (m.club > 0 || !inRing(p).length) continue;
      m.wind = WINDUP;
      sfx.boing(0.3);
    }
  }

  /* Bonked out: down where it stands, seeing stars. */
  _knockOut(i, k){
    this.knockouts = (this.knockouts || 0) + 1;
    k.down = 1; k.downT = 0; k.fell = { x: k.x, y: k.y }; k.helper = -1;
    k.vx = k.vy = 0; k.at = null;
    sfx.boing(0.5);
    for (let q = 0; q < 20; q++) this._spark(k.x, k.y - KNIGHT_SIZE * 0.5, '#ffffff');
  }

  /* Wiggling in the ice: how much the whole body is moving, in body sizes a
     second. With the mouse, how fast the pointer goes. */
  wiggleOf(i, k, p, dt){
    if (pose.mouse.active) return (p.hands.right.speed || 0) * 2;
    const lm = p.lm;
    if (!lm) return 0;
    const joints = [L.NOSE, L.L_SHOULDER, L.R_SHOULDER, L.L_ELBOW, L.R_ELBOW, L.L_WRIST, L.R_WRIST, L.L_HIP, L.R_HIP, L.L_KNEE, L.R_KNEE];
    const now = joints.map(j => ({ x: lm[j].x * ASPECT, y: lm[j].y }));
    const was = k.wigWas; k.wigWas = now;
    if (!was) return 0;
    let d = 0;
    for (let q = 0; q < joints.length; q++) d += Math.hypot(now[q].x - was[q].x, now[q].y - was[q].y);
    return d / joints.length / (p.scale || 0.3) / Math.max(dt, 1e-3);
  }
  _wiggle(i, k, p, dt){
    k.wig = (k.wig || 0) + (this.wiggleOf(i, k, p, dt) - (k.wig || 0)) * Math.min(1, dt * 6);
    const before = Math.floor(k.iceWork / ICE_BREAK * 3);
    k.iceWork += dt * clamp(k.wig / WIGGLE, 0, 1);
    if (Math.floor(k.iceWork / ICE_BREAK * 3) > before && k.iceWork < ICE_BREAK){ sfx.pop(0.6); for (let q = 0; q < 5; q++) this._spark(k.x, k.y - KNIGHT_SIZE * 0.5, '#e6f8ff'); }
    if (k.iceWork >= ICE_BREAK){
      k.ice = 0; k.iceWork = 0; k.wigWas = null;
      this.seen.wiggled = true;
      sfx.splash();
      for (let q = 0; q < 26; q++) this._spark(k.x + (Math.random() - 0.5) * 0.03, k.y - KNIGHT_SIZE * Math.random(), q % 2 ? '#bfefff' : '#ffffff');
    }
  }

  /* The Frost Troll's blizzard: gathering, then every knight still up is
     frozen. */
  _frost(dt){
    this.blizzard = 0;
    this.frostFlash = Math.max(0, (this.frostFlash || 0) - dt * 2);
    for (const m of this.monsters){
      if (m.kind !== 'troll') continue;
      if (m.cast == null) m.cast = FROST_FIRST;
      m.cast -= dt;
      if (m.cast < FROST_WARN) this.blizzard = Math.max(this.blizzard, 1 - Math.max(0, m.cast) / FROST_WARN);
      if (m.cast > 0) continue;
      m.cast = FROST_EVERY;
      this.frostFlash = 1;
      this.jolt(0.6); { const tp = this.pos(m); this.stompAt(tp.x, tp.y, 1); }
      sfx.twinkle(); sfx.whoosh();
      for (let i = 0; i < this.players; i++){
        const k = this.knights[i];
        if (!pose.players[i].present || k.down > 0 || k.ice > 0) continue;
        k.ice = 1; k.iceWork = 0; k.wig = 0; k.wigWas = null; k.vx = k.vy = 0; k.at = null;
      }
    }
  }

  /* Getting knights up again. While anyone is still standing, only a friend
     can - a knight beside the fallen one, and a real high five. With every
     knight down, after a while they're all back at the castle, from the
     start. */
  _rescues(dt){
    const playing = [];
    for (let i = 0; i < this.players; i++) if (pose.players[i].present) playing.push(i);
    const down = playing.filter(i => this.knights[i].down > 0), up = playing.filter(i => !(this.knights[i].down > 0));
    if (down.length && !up.length && !this.out){
      this.allDown += dt;
      if (this.allDown >= ALL_DOWN){ this.allDown = 0; for (const j of down) this._respawn(j, this.knights[j]); }
      return;
    }
    this.allDown = 0;
    for (const j of down){
      const f = this.knights[j];
      f.helper = -1;
      for (const i of up){
        const k = this.knights[i];
        if (Math.hypot((k.x - f.fell.x) * ASPECT, k.y - f.fell.y) > REVIVE_R) continue;
        f.helper = i;
        if (this.highFive(i, j)){ this._revive(j, i); break; }
      }
    }
  }

  /* Are children i and j high-fiving: a hand of each near the other's, up
     above their tummies (halfway from hips to shoulders)? */
  highFive(i, j){
    const raised = (p) => {
      if (!p.lm) return [];
      const sy = (p.lm[L.L_SHOULDER].y + p.lm[L.R_SHOULDER].y) / 2, hy = (p.lm[L.L_HIP].y + p.lm[L.R_HIP].y) / 2;
      return [p.hands.left, p.hands.right].filter(h => h && h.y < (sy + hy) / 2);
    };
    const a = raised(pose.players[i]), b = raised(pose.players[j]);
    return a.some(h => b.some(g => Math.hypot((h.x - g.x) * ASPECT, h.y - g.y) < HIGH_FIVE));
  }

  /* Up again, right where it fell, every level kept. */
  _revive(j, by){
    const k = this.knights[j];
    k.down = 0; k.downT = 0; k.hp = KNIGHT_HP; k.safe = SAFE; k.calm = 0; k.fell = null; k.helper = -1;
    this.seen.revived = true;
    sfx.gold();
    for (let q = 0; q < 24; q++) this._spark(k.x, k.y - KNIGHT_SIZE * 0.6, q % 2 ? PLAYER_COLORS[j] : PLAYER_COLORS[by]);
  }

  /* Back at the castle, whole, and safe for a moment - but from the very
     start, every level gone. */
  _respawn(i, k){
    const h = this.home(i);
    k.x = k.tx = h.x; k.y = k.ty = h.y;
    k.lvl = 0; k.xp = 0;
    k.hp = KNIGHT_HP; k.safe = SAFE; k.down = 0; k.downT = 0; k.calm = 0; k.fell = null; k.helper = -1;
    sfx.pop(1);
    for (let q = 0; q < 14; q++) this._spark(k.x, k.y - KNIGHT_SIZE * 0.5, PLAYER_COLORS[i]);
  }

  /* Where knight i waits at the start, and comes back to: by the castle. */
  home(i){ return { x: CASTLE.x + CASTLE.w / 2 + 0.04 + i * 0.035, y: CASTLE_BASE - 0.3 - i * 0.02 }; }

  /* A jump: over an ogre's club, if one's coming down on you; else, on an
     empty pad, it changes which tower that will be. */
  _jump(i, k){
    k.hop = 1; k.air = DODGE;
    if (this.underClub(k)) return;
    const at = k.at;
    if (!at || at.kind !== 'pad' || this.towers.has(at.i)) return;
    this.picks.set(at.i, (this.picks.get(at.i) + 1) % KINDS.length);
    this.work.delete(`p${at.i}`);
    this.seen.jumped = true;
    sfx.boing(2);
    const pad = PADS[at.i];
    for (let q = 0; q < 10; q++) this._spark(pad.x, pad.y - 0.06, PLAYER_COLORS[i]);
  }

  /* Is an ogre winding up to bring its club down on knight k? */
  underClub(k){
    return this.monsters.some(m => m.wind > 0 && (() => { const p = this.pos(m); return Math.hypot((p.x - k.x) * ASPECT, p.y - k.y) <= SLAM_R; })());
  }

  /* Where a knight is standing: on a pad, at the castle, or out in the
     meadow. */
  _spot(k){
    let best = null, bd = AT_PAD;
    for (const pad of PADS){ const d = Math.hypot((pad.x - k.x) * ASPECT, pad.y - k.y); if (d < bd){ bd = d; best = { kind: 'pad', i: pad.i, id: `p${pad.i}` }; } }
    if (best) return best;
    if (onCastle(k.x, k.y + 0.03, this.castleLvl)) return { kind: 'castle', id: 'castle' };
    return null;
  }

  /* ---------- building, mending and building up ---------- */

  /* What standing at a spot does now, and whether it can. */
  _job(at){
    if (at.kind === 'castle'){
      if (this.hearts < this.maxHearts) return { what: 'mend', need: REPAIR, can: true, act: () => this._repair(), again: true };
      if (this.castleLvl < MAX_LVL) return { what: 'up', need: castleTime(this.castleLvl), can: true, act: () => this._castleUp() };
      return null;
    }
    const tw = this.towers.get(at.i);
    if (!tw){ const kind = KINDS[this.picks.get(at.i)]; return { what: 'build', need: BUILD, can: this.coins >= COST[kind], act: (who) => this._build(at.i, kind, who) }; }
    if (tw.hp < tw.max) return { what: 'fix', fix: true, can: true };
    if (tw.lvl < MAX_LVL) return { what: 'up', need: upgradeTime(tw.lvl), can: true, act: (who) => this._upgrade(at.i, who) };
    return null;
  }

  _work(dt){
    /* Who is standing where, and whether they're squatting. */
    const at = new Map();
    for (let i = 0; i < this.players; i++){
      const k = this.knights[i];
      if (!k.at || !pose.players[i].present) continue;
      const e = at.get(k.at.id) || { at: k.at, rate: 0, who: i };
      const sq = this.squatting(k);
      if (sq) this.seen.squatted = true;
      e.rate += sq ? SQUAT_FAST : 1; e.one = Math.max(e.one || 0, sq ? SQUAT_FAST : 1);
      at.set(k.at.id, e);
    }
    for (const [id, e] of at){
      const job = this._job(e.at);
      const w = this.work.get(id) || { t: 0 };
      w.seen = true; w.job = job;
      this.work.set(id, w);
      if (!job || !job.can){ w.t = Math.max(0, w.t - dt); continue; }
      if (job.fix){
        const tw = this.towers.get(e.at.i);
        tw.hp = Math.min(tw.max, tw.hp + TOWER_FIX * e.rate * dt);
        if (Math.random() < dt * 8) this._spark(PADS[e.at.i].x, PADS[e.at.i].y - 0.08, '#ffe27a');
        continue;
      }
      /* The castle's hearts mend at one knight's pace however many crowd
         round: more knights only help build it up. */
      w.t += dt * (job.what === 'mend' ? e.one : e.rate);
      if (w.t >= job.need){ job.act(e.who); w.t = job.again ? 0 : -0.6; }
    }
    /* Nobody there: the work drains away. */
    for (const [id, w] of this.work){
      if (!w.seen){ w.t = Math.max(0, w.t - dt); if (w.t <= 0) this.work.delete(id); }
      w.seen = false;
    }
    const rep = this.work.get('castle');
    this.mend = rep && rep.t > 0 && rep.job && rep.job.what === 'mend' ? 1 : Math.max(0, this.mend - dt * 2);
  }

  _repair(){
    this.hearts = Math.min(this.maxHearts, this.hearts + 1);
    this.seen.repaired = true;
    sfx.jar(this.hearts);
    const b = castleBox(this.castleLvl);
    for (let k = 0; k < 16; k++) this._spark(b.x + (Math.random() - 0.5) * b.w * 0.8, CASTLE_BASE - (0.1 + Math.random() * 0.15) * b.scale, '#ffe27a');
  }

  /* The castle built up a level: a little bigger, and more hearts, all full. */
  _castleUp(){
    this.castleLvl++;
    this.hearts = this.maxHearts;
    sfx.fanfare();
    const b = castleBox(this.castleLvl);
    for (let k = 0; k < 30; k++) this._spark(b.x + (Math.random() - 0.5) * b.w, CASTLE_BASE - Math.random() * 0.3 * b.scale, '#ffd24a');
  }

  _build(i, kind, who){
    this.coins -= COST[kind];
    this.towers.set(i, { kind, lvl: 1, cool: 0.3, aim: -Math.PI / 2, who, kick: 0, hp: TOWER_HP[0], max: TOWER_HP[0], hit: 0, born: 0 });
    this.seen.built = true;
    sfx.land();
    const pad = PADS[i];
    for (let k = 0; k < 14; k++) this._spark(pad.x, pad.y - 0.04, '#ffd24a');
  }

  _upgrade(i, who){
    const tw = this.towers.get(i);
    tw.lvl++;
    tw.born = 0.5;
    tw.max = TOWER_HP[tw.lvl - 1]; tw.hp = tw.max;
    sfx.gold();
    const pad = PADS[i];
    for (let k = 0; k < 20; k++) this._spark(pad.x, pad.y - 0.08, PLAYER_COLORS[who]);
  }

  /* Ogres smash at the towers they pass; a tower with no health left
     crumbles back to an empty pad. */
  _smash(dt){
    for (const m of this.monsters){
      if (m.kind !== 'ogre') continue;
      const p = this.pos(m);
      for (const [i, tw] of this.towers){
        const pad = PADS[i];
        if (Math.hypot((pad.x - p.x) * ASPECT, pad.y - p.y) > SMASH_R) continue;
        tw.hp -= OGRE_SMASH * (m.red ? RED.smash : 1) * dt; tw.hit = 1;
        if (Math.random() < dt * 4) this._spark(pad.x, pad.y - 0.06, '#c9a66b');
        if (tw.hp <= 0){
          this.towers.delete(i);
          sfx.thud();
          for (let q = 0; q < 24; q++) this._spark(pad.x, pad.y - 0.05, '#9a8f86');
        }
      }
    }
    for (const tw of this.towers.values()) tw.hit = Math.max(0, tw.hit - dt * 3);
  }

  /* ---------- towers ---------- */

  _towers(dt, W, H){
    for (const [i, tw] of this.towers){
      tw.cool -= dt; tw.kick = Math.max(0, tw.kick - dt * 4);
      tw.born = Math.min(1, (tw.born ?? 1) + dt * 2.5);
      const pad = PADS[i], S = STATS[tw.kind], L = tw.lvl - 1, range = S.range[L];
      const top = { x: pad.x, y: pad.y - towerTall(tw.lvl) * 0.9 };
      /* The ones in reach nearest the castle first. */
      const inReach = this.monsters.filter(m => {
        if (tw.kind === 'cannon' && MONSTERS[m.kind].flies) return false;
        const p = this.pos(m);
        return Math.hypot((p.x - pad.x) * ASPECT, p.y - pad.y) <= range;
      });
      if (!inReach.length) continue;
      const left = (m) => PATHS[m.path].total - m.s;
      const many = S.many ? S.many[L] : 1;
      const targets = many > 1 ? inReach.sort((a, b) => left(a) - left(b)).slice(0, many) : [inReach.reduce((a, b) => left(b) < left(a) ? b : a)];
      const best = targets[0];
      const bp = this.pos(best);
      tw.aim = Math.atan2(bp.y - top.y, (bp.x - top.x) * ASPECT);
      if (tw.cool > 0) continue;
      tw.cool = 1 / S.rate[L]; tw.kick = 1;
      if (tw.kind === 'archer'){ for (const m of targets) this.shots.push({ kind: 'arrow', x: top.x, y: top.y, vx: 0, vy: 0, target: m.id, dmg: S.dmg[L] }); sfx.whoosh(); }
      else if (tw.kind === 'cannon'){
        /* Lobbed where the monster will be when it lands. */
        const lead = this.pos({ s: best.s + best.speed * best.slowK * 0.55, path: best.path });
        this.shots.push({ kind: 'ball', x: top.x, y: top.y, from: { ...top }, to: lead, k: 0, dmg: S.dmg[L], splash: S.splash[L], most: S.most[L] });
        sfx.thud();
      } else { for (const m of targets) this.shots.push({ kind: 'frost', x: top.x, y: top.y - 0.03, vx: 0, vy: 0, target: m.id, dmg: S.dmg[L], slow: S.slow[L] }); sfx.twinkle(); }
    }
  }

  _shots(dt, W, H){
    for (const s of this.shots){
      if (s.kind === 'ball'){
        s.k += dt / 0.55;
        s.x = s.from.x + (s.to.x - s.from.x) * Math.min(1, s.k); s.y = s.from.y + (s.to.y - s.from.y) * Math.min(1, s.k);
        if (s.k >= 1){
          s.done = true;
          sfx.pop(0.8);
          for (let k = 0; k < 10; k++) this._spark(s.x, s.y, '#ffb02e');
          /* The blast catches the nearest few, not a whole crowd. */
          const caught = this.monsters.filter(m => !MONSTERS[m.kind].flies)
            .map(m => { const p = this.pos(m); return { m, d: Math.hypot((p.x - s.x) * ASPECT, p.y - s.y) }; })
            .filter(q => q.d < s.splash).sort((a, b) => a.d - b.d).slice(0, s.most);
          for (const q of caught) this._damage(q.m, s.dmg);
        }
        continue;
      }
      const m = this.monsters.find(q => q.id === s.target);
      if (!m){ s.done = true; continue; }
      const p = this.pos(m), M = MONSTERS[m.kind], ty = p.y - M.size * (M.flies ? 0.75 : 0.4);
      const dx = (p.x - s.x) * ASPECT, dy = ty - s.y, d = Math.hypot(dx, dy), v = s.kind === 'arrow' ? 1.4 : 1.0;
      s.vx = dx / d * v / ASPECT; s.vy = dy / d * v;
      if (d < v * dt + 0.01){
        s.done = true;
        this._damage(m, s.dmg);
        if (s.kind === 'frost'){ m.slowK = Math.min(m.slowK, s.slow); m.slowT = SLOW_FOR; for (let k = 0; k < 5; k++) this._spark(p.x, ty, '#bfefff'); }
      } else { s.x += s.vx * dt; s.y += s.vy * dt; }
    }
    this.shots = this.shots.filter(s => !s.done);
  }

  /* by: the knight that struck it, if it was one. */
  _damage(m, dmg, by = -1){
    if (m.dead) return;
    m.hp -= dmg; m.hurt = 1;
    if (m.hp > 0) return;
    m.dead = true; m.gone = true;
    if (by >= 0) this._beat(by, m);
    const M = MONSTERS[m.kind], coins = M.coins * (m.red ? RED.coins : 1);
    this.coins += coins;
    const p = this.pos(m);
    sfx.pop(coins > 1 ? 1 : 0.4);
    /* Its coins fly to the chest; a puff where it was. */
    for (let k = 0; k < coins; k++) this.bits.push({ kind: 'coin', x: p.x, y: p.y - 0.04, from: { x: p.x, y: p.y - 0.04 }, age: -k * 0.08, life: 0.7 });
    for (let k = 0; k < 8; k++) this._spark(p.x, p.y - 0.03, '#ffffff');
    this.bits.push({ kind: 'poof', x: p.x, y: p.y - M.size * 0.4, r: M.size * (m.red ? 0.6 : 0.45), age: 0, life: 0.45 });
    /* A big one going down: the screen jolts, the moment holds. */
    if (m.kind === 'ogre' || m.kind === 'troll'){ this.jolt(m.kind === 'troll' ? 0.8 : 0.3); this.stop = m.kind === 'troll' ? 0.12 : 0.05; this.stompAt(p.x, p.y, m.kind === 'troll' ? 1 : 0.5); }
    this.monsters = this.monsters.filter(q => q !== m);
  }

  /* Shake the screen a little, `k` 0..1. */
  jolt(k){ this.shake = Math.min(1, Math.max(this.shake || 0, k)); }
  /* Something big thumps down at (x, y): the trees round about lean away
     and wobble back, `k` 0..1. */
  stompAt(x, y, k){ this.stomp = { x, y, k, age: 0 }; }
  /* How far tree t leans now: a gentle sway, and a stomp's push. */
  leanOf(t){
    let a = Math.sin(this.t * 1.2 + t.seed) * (t.bush ? 0.015 : 0.025);
    const st = this.stomp;
    if (st && st.age < 2.5){
      const d = Math.hypot((t.x - st.x) * ASPECT, t.y - st.y), f = Math.max(0, 1 - d / 0.7);
      a += (t.x >= st.x ? 1 : -1) * 0.3 * st.k * f * Math.exp(-st.age * 2.2) * Math.cos(st.age * 9);
    }
    return a;
  }

  /* ---------- little things ---------- */

  _spark(x, y, col){
    const a = Math.random() * 6.28, sp = 0.08 + Math.random() * 0.12;
    this.bits.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp / ASPECT, vy: Math.sin(a) * sp - 0.05, age: 0, life: 0.6, col });
    if (this.bits.length > 400) this.bits.splice(0, this.bits.length - 400);
  }
  _stepBits(dt){
    /* Coins fly into the castle, to its keep. */
    const b0 = castleBox(this.castleLvl), chest = { x: b0.x, y: CASTLE_BASE - 0.2 * b0.scale };
    for (const b of this.bits){
      b.age += dt;
      if (b.kind === 'spark'){ b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 0.15 * dt; }
      else if (b.kind === 'heart'){ b.y += b.vy * dt; b.x += Math.sin(b.age * 8) * 0.01 * dt; }
      else if (b.kind === 'coin' && b.age > 0){
        const k = Math.min(1, b.age / b.life), e = k * k;
        if (b.age + dt >= b.life && Math.random() < 0.5) this.bits.push({ kind: 'spark', x: chest.x, y: chest.y, vx: (Math.random() - 0.5) * 0.08, vy: -0.08, age: 0, life: 0.5, col: '#ffd24a' });
        b.x = b.from.x + (chest.x - b.from.x) * e; b.y = b.from.y + (chest.y - b.from.y) * e - Math.sin(k * Math.PI) * 0.12;
      }
    }
    this.bits = this.bits.filter(b => b.age < b.life);
  }

  /* ---------- showing how ---------- */

  /* Rolling the arms: a knight swinging its sword, until someone has rolled. */
  get rollHint(){
    if (this.seen.rolled || this.out || pose.mouse.active) return null;
    return this.knights.slice(0, this.players).find((k, i) => pose.players[i].present && !(k.down > 0) && k.sword > 0) || null;
  }

  /* ---------- the ending ---------- */

  outro(dt, W, H){
    if (!this.out){
      this.out = { t: 0 };
      if (this.lost) sfx.lose(); else sfx.fanfare();
      this.shots = [];
    }
    const o = this.out;
    o.t += dt; this.t += dt;
    /* The monsters dance about at the gate; or, if the castle held, they
       scurry home. */
    for (const m of this.monsters){ m.hurt = 0; if (!this.lost) m.s = Math.max(0, m.s - dt * 0.3); }
    if (!this.lost && Math.random() < dt * 25) this._spark(Math.random(), Math.random() * 0.6, `hsl(${(Math.random() * 360) | 0},90%,65%)`);
    this._stepBits(dt);
    return o.t > 4.5;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    /* A jolt shakes the whole picture. */
    c.save();
    if (this.shake > 0){ const a = this.shake * this.shake * H * 0.012; c.translate((Math.random() - 0.5) * a * 2, (Math.random() - 0.5) * a * 2); }
    drawMeadow(c, W, H);
    /* The jungle, soft and in the background, swaying. */
    for (const tr of TREES) drawTree(c, W, H, tr, this.leanOf(tr));
    /* The medical tent, glowing while a knight is hurt. */
    const hurt = !this.out && this.knights.slice(0, this.players).some((k, i) => pose.players[i].present && !(k.down > 0) && k.hp < KNIGHT_HP);
    inked(c, H * 0.0024, () => drawTent(c, W, H, this.t, hurt ? 0.6 + 0.4 * Math.sin(this.t * 4) : 0));
    /* Butterflies flitting over the meadow. */
    for (let q = 0; q < 5; q++){
      const u = this.t * 0.03 + q * 0.21, bx = (0.15 + 0.7 * ((Math.sin(u * 2.1 + q) + 1) / 2)), by = 0.12 + 0.7 * ((Math.sin(u * 1.3 + q * 2.4) + 1) / 2);
      drawButterfly(c, bx * W, (by + Math.sin(this.t * 3 + q) * 0.01) * H, H * 0.02, this.t + q, ['#ffd24a', '#ff9ad5', '#ffffff', '#9ad8ff', '#ffb36b'][q]);
    }
    const things = [];
    for (const pad of PADS){
      const tw = this.towers.get(pad.i), here = this.knights.some((k, i) => i < this.players && k.at && k.at.id === `p${pad.i}`);
      inked(c, H * 0.0024, () => drawPad(c, W, H, pad, tw || this.out ? 0 : here ? 1 : 0.2 + 0.1 * Math.sin(this.t * 3 + pad.i)));
      if (tw) things.push({ y: pad.y, draw: () => {
        c.save(); if (tw.hit > 0) c.translate(Math.sin(this.t * 60) * tw.hit * H * 0.004, 0);
        /* Just built or built up: it springs up out of the pad. */
        if (tw.born < 1){ const u = tw.born, e = 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2); c.translate(pad.x * W, pad.y * H); c.scale(0.9 + 0.1 * e, e); c.translate(-pad.x * W, -pad.y * H); }
        drawTower(c, W, H, pad, tw.kind, tw.lvl, tw.aim, PLAYER_COLORS[tw.who] || '#ffffff', this.t, tw.kick);
        c.restore();
      } });
      /* An empty pad shows the tower it will become, see-through, with its
         price in coins under it. */
      else if (!this.out) things.push({ y: pad.y, draw: () => {
        const kind = KINDS[this.picks.get(pad.i)], can = this.coins >= COST[kind];
        c.save(); c.globalAlpha = here ? 0.6 : 0.28;
        drawTower(c, W, H, pad, kind, 1, -Math.PI / 2, 'rgba(0,0,0,0)', this.t, 0);
        c.globalAlpha = (here ? 1 : 0.5) * (can ? 1 : 0.45);
        const n = COST[kind];
        for (let q = 0; q < n; q++) coin(c, (pad.x * W) + (q - (n - 1) / 2) * H * 0.02, (pad.y + 0.045) * H, H * 0.008);
        c.restore();
      } });
    }
    for (const m of this.monsters){
      const p = this.pos(m), M = MONSTERS[m.kind], dance = this.out && this.lost ? Math.abs(Math.sin(this.t * 6 + m.wob)) * 0.03 : 0;
      /* An ogre winding up lifts its club, and a warning ring spreads on
         the ground round it; bringing the club down, it lunges. */
      const lunge = Math.sin((m.bonk || 0) * Math.PI) * 0.02;
      const lift = m.kind === 'troll' ? (m.cast != null && m.cast < FROST_WARN ? 1 - Math.max(0, m.cast) / FROST_WARN : 0) : m.wind > 0 ? 1 - m.wind / WINDUP : 0;
      if (lift > 0 && !this.out && m.kind === 'ogre') drawSlamRing(c, p.x * W, p.y * H, SLAM_R * H, lift, this.t);
      things.push({ y: p.y, monster: true, draw: () => {
        /* Hit: squashed flat a moment. */
        const sq = m.hurt * 0.14, fx = p.x * W, fy = (p.y - dance - lunge) * H;
        if (sq > 0){ c.save(); c.translate(fx, fy); c.scale(1 + sq, 1 - sq); c.translate(-fx, -fy); }
        drawMonster(c, fx, fy, M.size * H, m.kind, this.t + m.wob, p.dir, m.hurt, m.slowT > 0, m.hp / m.max, lift, m.red);
        if (sq > 0) c.restore();
      } });
    }
    /* The knights, among everything else. */
    for (let i = 0; i < this.players; i++){
      const k = this.knights[i];
      if (!pose.players[i].present) continue;
      /* Bonked out: lying flat where it fell, stars going round its head. */
      if (k.down > 0){
        const f = k.fell, s = KNIGHT_SIZE * H, fx = f.x * W, fy = f.y * H;
        things.push({ y: f.y, draw: () => {
          c.save(); c.translate(fx, fy - s * 0.12); c.rotate(-Math.PI / 2 * k.dir); c.translate(-fx, -(fy - s * 0.12));
          drawKnight(c, fx, fy, s, 0, PLAYER_COLORS[i], k.dir, 0, 0, (x, y, r) => {
            if (this.faces.has(i)) this.faces.draw(c, i, x, y, r);
            else drawKid(c, x, y + r * 0.1, r, this.t + i, KID_SKINS[i]);
          }, 0, swordAt(k.lvl).size, k.lvl >= KNIGHT_MAX ? '#ffd24a' : '#dfe3ee');
          c.restore();
          const hx = fx - k.dir * s * 0.75, hy = fy - s * 0.2;
          for (let q = 0; q < 5; q++){ const a = this.t * 5 + q * 1.2566; star(c, hx + Math.cos(a) * s * 0.3, hy - s * 0.15 + Math.sin(a) * s * 0.12, H * 0.011, q % 2 ? '#ffd24a' : '#ffffff'); }
        } });
        continue;
      }
      if (!this.out && pose.mouse.active && Math.hypot((k.tx - k.x) * ASPECT, k.ty - k.y) > 0.02) drawMarker(c, k.tx * W, k.ty * H, KNIGHT_SIZE * H, PLAYER_COLORS[i], this.t);
      if (!this.out){
        /* The arrow under it, the way the hand is steering. */
        if (k.lean) this._drawLean(c, k, W, H, PLAYER_COLORS[i]);
      }
      const hop = Math.sin(k.hop * Math.PI) * KNIGHT_SIZE * 0.6;
      things.push({ y: k.y, draw: () => {
        /* A level just gained: a golden glow, and a ring bursting out. */
        if (k.glow > 0){
          c.save(); c.globalAlpha = k.glow; c.strokeStyle = '#ffd24a'; c.lineWidth = H * 0.005;
          c.beginPath(); c.ellipse(k.x * W, k.y * H, KNIGHT_SIZE * H * (0.4 + 1.2 * (1 - k.glow)), KNIGHT_SIZE * H * (0.15 + 0.45 * (1 - k.glow)), 0, 0, 6.2832); c.stroke();
          c.restore();
          const g = c.createRadialGradient(k.x * W, (k.y - KNIGHT_SIZE * 0.5) * H, 0, k.x * W, (k.y - KNIGHT_SIZE * 0.5) * H, KNIGHT_SIZE * H);
          g.addColorStop(0, `rgba(255,220,110,${0.6 * k.glow})`); g.addColorStop(1, 'rgba(255,220,110,0)');
          c.fillStyle = g; c.beginPath(); c.arc(k.x * W, (k.y - KNIGHT_SIZE * 0.5) * H, KNIGHT_SIZE * H, 0, 6.2832); c.fill();
        }
        /* Just back, it blinks while it's safe; just bonked, it shakes. */
        c.save();
        if (k.safe > 0) c.globalAlpha = 0.45 + 0.4 * Math.abs(Math.sin(this.t * 12));
        if (k.bonk > 0) c.translate(Math.sin(this.t * 70) * k.bonk * H * 0.006, 0);
        const sw = swordAt(k.lvl);
        drawKnight(c, k.x * W, (k.y - hop) * H, KNIGHT_SIZE * H, this.t + i, PLAYER_COLORS[i], k.dir, k.walk, 0, (x, y, r) => {
          if (this.faces.has(i)) this.faces.draw(c, i, x, y, r);
          else drawKid(c, x, y + r * 0.1, r, this.t + i, KID_SKINS[i]);
        }, k.swing, sw.size, k.lvl >= KNIGHT_MAX ? '#ffd24a' : '#dfe3ee');
        c.restore();
        /* Rolling its arms: the sword whirls - streaks round it. */
        if (this.rolling(k) && k.sword > 0){
          c.save(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = H * 0.004; c.lineCap = 'round';
          const cx = (k.x + k.dir * 0.012) * W, cy = (k.y - hop - KNIGHT_SIZE * 0.55) * H, rr = KNIGHT_SIZE * H * (0.35 + 0.15 * sw.size);
          for (let q = 0; q < 2; q++){ const a0 = this.t * 14 + q * Math.PI; c.beginPath(); c.arc(cx, cy, rr, a0, a0 + 1.4); c.stroke(); }
          c.restore();
        }
        /* Frozen: in its block of ice, cracking as the child wiggles, with
           arrows wobbling side to side - wiggle! */
        if (k.ice > 0){
          drawIceBlock(c, k.x * W, (k.y - hop) * H, KNIGHT_SIZE * H, k.iceWork / ICE_BREAK, this.t);
          const s = KNIGHT_SIZE * H, w = Math.sin(this.t * 14) * s * 0.08;
          c.save(); c.globalAlpha = 0.85;
          arrow(c, k.x * W - s * 0.7 + w, (k.y - KNIGHT_SIZE * 0.55) * H, -1, 0, s * 0.34, '#e6f8ff');
          arrow(c, k.x * W + s * 0.7 + w, (k.y - KNIGHT_SIZE * 0.55) * H, 1, 0, s * 0.34, '#e6f8ff');
          c.restore();
        }
        /* Hurt: little hearts over its head, for the bonks it has left. */
        if (k.hp < KNIGHT_HP && !this.out){
          for (let q = 0; q < KNIGHT_HP; q++) heart(c, (k.x + (q - (KNIGHT_HP - 1) / 2) * 0.014) * W, (k.y - KNIGHT_SIZE * 1.25 - hop) * H, H * 0.008, q < k.hp ? '#ff4f6a' : 'rgba(80,60,80,.4)');
        }
      } });
    }
    things.push({ y: CASTLE.y + 0.12, draw: () => drawCastle(c, W, H, this.t, this.hearts, this.maxHearts, this.held, this.castleHit, this.mend, this.castleLvl) });
    things.sort((a, b) => a.y - b.y);
    /* All of it in bold ink outlines - but a great crowd of monsters plain,
       or there's too much to draw. */
    const crowd = this.monsters.length > INK_MOST;
    for (const th of things){ if (crowd && th.monster) th.draw(); else inked(c, H * 0.0024, th.draw); }
    for (const s of this.shots) drawShot(c, W, H, s);
    /* The Frost Troll's blizzard gathering, and the white flash of the freeze. */
    if (!this.out){
      drawBlizzard(c, W, H, this.blizzard || 0, this.t);
      if (this.frostFlash > 0){ c.fillStyle = `rgba(235,248,255,${0.7 * this.frostFlash})`; c.fillRect(0, 0, W, H); }
    }
    this._drawBits(c, W, H);
    drawLight(c, W, H);
    c.restore();
    if (!this.out){
      this._drawTowerBars(c, W, H);
      this._drawWork(c, W, H);
      this._drawHints(c, W, H);
    }
  }

  /* Health bars over towers an ogre has hurt. */
  _drawTowerBars(c, W, H){
    for (const [i, tw] of this.towers){
      if (tw.hp >= tw.max) continue;
      const pad = PADS[i], bw = H * 0.07, x = pad.x * W - bw / 2, y = (pad.y - towerTall(tw.lvl) - 0.05) * H;
      c.fillStyle = 'rgba(40,30,50,.55)'; c.fillRect(x, y, bw, H * 0.01);
      c.fillStyle = tw.hp / tw.max > 0.5 ? '#6fdc6a' : tw.hp / tw.max > 0.25 ? '#ffd24a' : '#ff5d5d'; c.fillRect(x, y, bw * Math.max(0, tw.hp / tw.max), H * 0.01);
    }
  }

  /* Rings filling over whatever a knight is working on, with the price of an
     upgrade in coins under it; a hammer bangs while they hammer. */
  _drawWork(c, W, H){
    for (let i = 0; i < this.players; i++){
      const k = this.knights[i];
      if (!k.at || !pose.players[i].present) continue;
      const w = this.work.get(k.at.id), job = w && w.job;
      if (!job) continue;
      let x, y;
      if (k.at.kind === 'castle'){ const b = castleBox(this.castleLvl); x = b.x * W; y = (CASTLE_BASE - 0.24 * b.scale - 0.06) * H; }
      else { const pad = PADS[k.at.i]; x = pad.x * W; y = (pad.y - 0.07) * H; }
      const r = H * 0.06, frac = job.need ? clamp(w.t / job.need, 0, 1) : 1;
      if (!job.fix) drawWorkRing(c, x, y, r, job.can ? frac : 0, job.what === 'mend' ? '#ff4f6a' : '#ffd24a');
      if (job.what === 'mend') heart(c, x, y, r * 0.45, '#ff4f6a');
      if (job.what === 'up') star(c, x, y, r * 0.4, '#ffd24a');
      if (this.squatting(k)) drawHammer(c, x + r * 1.1, y - r * 0.6, r * 0.6, -0.6 + Math.sin(this.t * 18) * 0.6);
    }
  }

  _drawHints(c, W, H){
    const ghost = (x, y, a) => {
      const r = H * 0.03;
      c.save(); c.globalAlpha = a;
      const g = c.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
      g.addColorStop(0, 'rgba(255,246,226,.6)'); g.addColorStop(1, 'rgba(255,246,226,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.4, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.restore();
    };
    for (let i = 0; i < this.players; i++){
      const k = this.knights[i];
      if (!pose.players[i].present || k.down > 0 || k.ice > 0) continue;
      const x = k.x * W, y = k.y * H, s = KNIGHT_SIZE * H;
      /* Walking: a knight that hasn't gone anywhere yet has a ghostly hand
         reaching out from it, round and round - right, up, left, down -
         with the way it would walk, and ghostly feet marching under it. */
      if (!k.driven){
        const ph = (this.t * 0.7) % 4, dirs = [[1, 0], [0, -1], [-1, 0], [0, 1]], [ax, ay] = dirs[Math.floor(ph)], u = ph % 1, reach = Math.sin(Math.min(1, u * 1.6) * Math.PI / 2);
        const hx = x + ax * s * (0.2 + 0.7 * reach), hy0 = y - s * 0.55 + ay * s * (0.2 + 0.6 * reach);
        ghost(hx, hy0, 0.85 * (1 - Math.max(0, u - 0.8) * 5));
        const f = Math.sin(this.t * 9);
        ghost(x - s * 0.25, y + s * 0.15 - Math.max(0, f) * s * 0.3, 0.6); ghost(x + s * 0.25, y + s * 0.15 - Math.max(0, -f) * s * 0.3, 0.6);
        c.save(); c.globalAlpha = 0.6 * reach; arrow(c, x + ax * s * 0.5, y + (ay > 0 ? 0.3 : ay < 0 ? -1.25 : -0.35) * s, ax, ay, s * 0.22, '#fff6e2'); c.restore();
        continue;
      }
      /* Marching: pointing the way but not marching - two ghostly feet
         going up and down under the knight. */
      if (k.lean && k.lean.still && !pose.mouse.active){
        const u = Math.sin(this.t * 9);
        ghost(x - s * 0.25, y + s * 0.15 - Math.max(0, u) * s * 0.3, 0.8); ghost(x + s * 0.25, y + s * 0.15 - Math.max(0, -u) * s * 0.3, 0.8);
      }
      /* Dodging: under an ogre's club, until someone has jumped over one -
         a big arrow bouncing up over the knight. */
      if (!this.seen.dodged && !pose.mouse.active && this.underClub(k)){
        const b = Math.abs(Math.sin(this.t * 8)) * s * 0.4;
        c.save(); c.globalAlpha = 0.9; arrow(c, x, y - s * 1.4 - b, 0, -1, s * 0.4, '#fff6e2'); c.restore();
        continue;
      }
      /* Jumping: standing on an empty pad, until someone has jumped to change
         a tower - a little bouncing arrow over the knight. */
      if (!this.seen.jumped && k.at && k.at.kind === 'pad' && !this.towers.has(k.at.i)){
        const b = Math.abs(Math.sin(this.t * 4)) * s * 0.3;
        c.save(); c.globalAlpha = 0.8; arrow(c, x, y - s * 1.2 - b, 0, -1, s * 0.3, '#fff6e2'); c.restore();
      }
      /* Squatting: while working on something, until someone has squatted -
         a ghostly arrow bobbing down and up beside the knight. */
      if (!this.seen.squatted && !pose.mouse.active && k.at && this.work.get(k.at.id)?.job?.can){
        const b = Math.abs(Math.sin(this.t * 4)) * s * 0.3;
        c.save(); c.globalAlpha = 0.8; arrow(c, x + s * 0.8, y - s * 1.1 + b, 0, 1, s * 0.3, '#fff6e2'); c.restore();
      }
      /* Hurt: a trail of dots to the medical tent; there, two ghostly hands
         crossing over its chest - a hug. */
      if (k.hp < KNIGHT_HP && !(k.down > 0)){
        if (!this.atTent(k)){
          c.save(); c.fillStyle = '#ffe6e6';
          const tx = TENT.x, ty = TENT.y + 0.02;
          for (let q = 1; q < 9; q++){ const u = q / 9; c.globalAlpha = 0.2 + 0.55 * Math.max(0, Math.sin(this.t * 4 - q * 0.6)); c.beginPath(); c.arc((k.x + (tx - k.x) * u) * W, (k.y + (ty - k.y) * u) * H, H * 0.006, 0, 6.2832); c.fill(); }
          c.restore();
        } else if (!pose.mouse.active && !this.hugging(k)){
          const u = Math.abs(Math.sin(this.t * 2.5)), cx = x, cy = y - s * 0.55;
          ghost(cx - s * (0.55 - 0.85 * u), cy - s * 0.1 * u, 0.8); ghost(cx + s * (0.55 - 0.85 * u), cy - s * 0.1 * u, 0.8);
        }
      }
    }
    /* Building: until the first tower, the nearest empty pad to the first
       knight pulses, with a trail of dots leading to it. */
    if (!this.seen.built && this.knights[0] && pose.players[0].present && !(this.knights[0].down > 0) && !(this.knights[0].ice > 0)){
      const k = this.knights[0];
      let best = null, bd = 9;
      for (const pad of PADS){ if (this.towers.has(pad.i)) continue; const d = Math.hypot((pad.x - k.x) * ASPECT, pad.y - k.y); if (d < bd){ bd = d; best = pad; } }
      if (best && bd > AT_PAD){
        c.save(); c.fillStyle = '#fff6e2';
        for (let q = 1; q < 8; q++){ const u = q / 8, a = 0.25 + 0.6 * Math.max(0, Math.sin(this.t * 4 - q * 0.6)); c.globalAlpha = a; c.beginPath(); c.arc((k.x + (best.x - k.x) * u) * W, (k.y + (best.y - k.y) * u) * H, H * 0.007, 0, 6.2832); c.fill(); }
        c.restore();
      }
    }
    /* A knight down: a ghostly hand waving over it, calling for a friend;
       once one is beside it, two big ghostly hands meeting over the pair -
       high five! With everyone down, a ring round each filling up to when
       they're all back at the castle. */
    for (let j = 0; j < this.players; j++){
      const f = this.knights[j];
      if (!pose.players[j].present || !(f.down > 0)) continue;
      const fx = f.fell.x, fy = f.fell.y - KNIGHT_SIZE * 0.9;
      if (this.allDown > 0){ drawWorkRing(c, f.fell.x * W, (f.fell.y - KNIGHT_SIZE * 0.3) * H, KNIGHT_SIZE * H * 0.7, this.allDown / ALL_DOWN, PLAYER_COLORS[j]); continue; }
      if (f.helper >= 0){
        const h = this.knights[f.helper], mx = (fx + h.x) / 2, my = Math.min(fy, h.y - KNIGHT_SIZE * 0.9) - 0.03;
        const u = Math.abs(Math.sin(this.t * 4)), off = (0.006 + 0.03 * u) / ASPECT;
        ghost((mx - off) * W, my * H, 0.95); ghost((mx + off) * W, my * H, 0.95);
      } else {
        ghost((fx + Math.sin(this.t * 6) * 0.01 / ASPECT) * W, (fy - 0.02) * H, 0.5 + 0.3 * Math.abs(Math.sin(this.t * 3)));
      }
    }
    /* Rolling the arms: over a knight swinging its sword, until someone
       has rolled, two ghostly hands go round and round each other. */
    const k = this.rollHint;
    if (k){
      const a = this.t * 7, rr = 0.022, x = k.x, y = k.y - KNIGHT_SIZE * 1.6;
      for (const q of [0, Math.PI]) ghost((x + Math.cos(a + q) * rr / ASPECT * 1.3) * W, (y + Math.sin(a + q) * rr * 0.8) * H, 0.85);
    }
  }

  _drawLean(c, k, W, H, col){
    const x = k.x * W, y = k.y * H, s = KNIGHT_SIZE * H, len = s * (0.35 + 0.5 * k.lean.k);
    c.save(); c.globalAlpha = k.lean.still ? 0.4 : 0.6 + 0.35 * k.lean.k;
    arrow(c, x + k.lean.x * s * 0.3, y + k.lean.y * s * 0.18 + s * 0.05, k.lean.x, k.lean.y * 0.6, len, col);
    c.restore();
  }

  _drawBits(c, W, H){
    for (const b of this.bits){
      if (b.age < 0) continue;
      const k = b.age / b.life;
      if (b.kind === 'spark'){ c.globalAlpha = 1 - k; c.fillStyle = b.col; c.beginPath(); c.arc(b.x * W, b.y * H, H * 0.006, 0, 6.2832); c.fill(); c.globalAlpha = 1; }
      else if (b.kind === 'heart'){ c.globalAlpha = 1 - k; heart(c, b.x * W, b.y * H, H * 0.01, '#ff4f6a'); c.globalAlpha = 1; }
      else if (b.kind === 'poof') drawPoof(c, b.x * W, b.y * H, b.r * H, k);
      else coin(c, b.x * W, b.y * H, H * 0.013);
    }
  }

  /* No numbers: the castle's hearts and pennants say how it's going. */
  hud(){ return { score: pose.players.map(() => this.held), showLives: false, hideScore: true, hideClock: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) if (pose.players[i].present) rows.push({ label: `Player ${i + 1}`, value: this.held, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return pose.players.slice(0, this.players).filter(p => p.present).length < 2 ? null : -1; }
  value(){ return this.held; }
}

/* A flat arrow on the ground, from (x, y) toward (dx, dy), `len` long. */
function arrow(c, x, y, dx, dy, len, col){
  const m = Math.hypot(dx, dy) || 1, ux = dx / m, uy = dy / m, ex = x + ux * len, ey = y + uy * len;
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = len * 0.22; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(ex - ux * len * 0.3, ey - uy * len * 0.3); c.stroke();
  c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - ux * len * 0.45 - uy * len * 0.32, ey - uy * len * 0.45 + ux * len * 0.32);
  c.lineTo(ex - ux * len * 0.45 + uy * len * 0.32, ey - uy * len * 0.45 - ux * len * 0.32); c.closePath(); c.fill();
}
