import { clamp } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Avatars } from '../ui/avatars.js';
import { FaceCam } from '../ui/faces.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';
import { JumpWatch } from '../tracking/jump.js';
import { PATHS, PADS, PAD_R, CASTLE, CASTLE_BASE, CHEST, MAX_LVL, castleBox, towerTall, onCastle, along, drawMeadow, drawCastle, drawPad, drawTower, drawChest, heart,
         drawMonster, drawSlamRing, drawShot, coin, star, drawKnight, drawMarker, drawHorn, drawWorkRing, drawHammer } from './castle-art.js';

/* Castle Defense. Silly monsters - bouncing slimes, quick little goblins,
   bats, and now and then a big ogre - come in at the top left and march the
   long way round the meadow, back and forth along one winding trail, to
   the castle in the bottom left. Each child has a little knight out on
   the meadow, in their colour with their face in the helmet, and the
   knights do everything just by where they stand.

   Lean to walk your knight - left or right, toward the screen to go up the
   map, back to come down - and run on the spot to hurry. Near a monster,
   the knight swings its sword by itself - and rolling your arms round each
   other, like the wheels on the bus, makes it swing twice as fast. Stand on an empty stone pad and a see-through tower appears:
   jump to change which kind (archer, cannon, frost), and stay put to build
   it. Stand at a tower and the knight mends it if an ogre has been smashing
   it, or else, slowly, makes it bigger and stronger, up to ten times. The
   castle starts out small, with only a few hearts: stand at it and the
   knight mends them, or once it's whole, slowly builds it a little bigger,
   with two more. Hammering with a fist makes any of that go twice as fast.
   Monsters drop coins into the treasure chest; new towers cost coins,
   building them up and mending is free - it only takes time.

   Between waves there's a breather, with the war horn standing where the
   monsters come in - stand your knight by it to call the next wave early.
   The waves keep coming, each bigger than the last, until the castle's
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
export const TOWER_HP = levels(l => 8 + 2 * l), OGRE_SMASH = 1.5, SMASH_R = 0.15;
/* Seconds of standing there: to build, to mend a heart; towers mend
   TOWER_FIX health a second. Hammering makes it all go HAMMER times as
   fast. Building costs coins; building up is free, but slow, and slower
   with every level: upgradeTime(lvl) to take a tower from lvl to the next,
   castleTime(lvl) the castle - several minutes' standing, all told, to take
   one all the way to the top. */
export const BUILD = 2.5, REPAIR = 2.5, TOWER_FIX = 3, HAMMER = 2;
export const upgradeTime = (lvl) => 10 + 5 * lvl, castleTime = (lvl) => 12 + 5 * lvl;
export const AT_PAD = 0.075;                          /* how near a pad counts as standing on it */
/* Knights. Leaning walks them - shoulders over to one side of the hips,
   LEAN_X shoulder-widths for full lean, or toward or away from the screen,
   LEAN_Z; a little lean is no lean (LEAN_DEAD) - at WALK, and running on
   the spot (knees at MARCH_FULL torso-lengths a second) hurries them up to
   RUN. With the mouse, the knight walks to where the pointer rests. */
export const MARCH_FULL = 1.2, LEAN_X = 0.3, LEAN_Z = 0.35, LEAN_DEAD = 0.25;
export const WALK = 0.12, RUN = 0.24, KNIGHT_SIZE = 0.085, POINT_HOLD = 0.35;
export const KNIGHT_SPEED = RUN;
/* The sword: swung by itself at a monster within reach - ROLL_FAST times as
   often while the child rolls their arms round each other, the wheels on
   the bus going round. That's the hands circling each other: the line from
   one to the other turning on round, the same way, at ROLL_SPIN or more
   (radians, built up over about ROLL_FOR seconds), hands no more than
   ROLL_GAP apart. Hands going up and down - hammering - only swing that
   line to and fro, so they never add up to a roll. */
export const ROLL_FAST = 2, ROLL_SPIN = 3, ROLL_FOR = 0.6, ROLL_GAP = 0.4;
/* Knights grow with what they beat: every monster they finish off counts
   (an ogre for five), and each level takes a few more than the last, up to
   KNIGHT_MAX. A knight starts with a tiny sword - a little longer, harder
   and quicker every level - and at the top it's a great golden one. */
export const KNIGHT_MAX = 10;
export const killsFor = (lvl) => 3 + 3 * lvl;
export const swordAt = (lvl) => ({ reach: 0.06 + 0.004 * lvl, dmg: 0.5 + 0.2 * lvl, cool: 0.8 - 0.03 * lvl, size: 0.4 + 0.13 * lvl });
export const SWORD_R = swordAt(0).reach, SWORD_COOL = swordAt(0).cool, SWORD_DMG = swordAt(0).dmg;
/* Ogres go for knights close by, but slowly: an ogre that sees one lifts its
   club high over its head and a warning ring spreads on the ground round
   it, and only after WINDUP seconds does the club come down - on whoever is
   still inside the ring. Then OGRE_CLUB seconds before it can try again.
   A knight takes KNIGHT_HP bonks, getting its breath back after a while (a
   bonk's worth every KNIGHT_MEND seconds, once clear). Bonked out, it loses
   every level, and after DOWN seconds is back at the castle, safe for a
   moment. Nothing else harms a knight. */
export const OGRE_REACH = 0.04, WINDUP = 1.2, OGRE_CLUB = 1.6, KNIGHT_HP = 3, KNIGHT_MEND = 3, DOWN = 2.5, SAFE = 3;
export const SLAM_R = OGRE_REACH + 0.13 * 0.3;
/* Between waves: BUILD_TIME to get ready (FIRST_BUILD before the first), or
   until a knight has stood by the war horn for HORN_HOLD. */
export const BUILD_TIME = 15, FIRST_BUILD = 20, HORN_HOLD = 1.5;
export const HORN = { x: 0.06, y: 0.34 };
const BREAK = BUILD_TIME;
/* What towers do at each level: each step a little further, faster and
   harder, and every few levels archers and frost towers shoot at one more
   monster at a time (`many`), and the cannon's blast catches more (`most`) -
   so a tower at the top is many times what it was, against a crowd too. */
const grow = (v0, k) => levels(l => v0 * (1 + k * l));
export const STATS = {
  archer: { range: grow(0.24, 0.03), rate: grow(1.1, 0.12), dmg: grow(1, 0.3), many: levels(l => 1 + Math.floor(l / 3)) },
  cannon: { range: grow(0.21, 0.03), rate: grow(0.45, 0.08), dmg: grow(2.5, 0.3), splash: grow(0.08, 0.04), most: levels(l => 3 + l) },
  frost:  { range: grow(0.2, 0.03), rate: grow(0.8, 0.08), dmg: grow(0.4, 0.3), slow: levels(l => 0.55 - 0.025 * l), many: levels(l => 1 + Math.floor(l / 3)) }
};
export const MONSTERS = {
  slime:  { hp: 3, speed: 0.06, size: 0.08, coins: 1, harm: 1 },
  goblin: { hp: 2, speed: 0.095, size: 0.085, coins: 1, harm: 1 },
  bat:    { hp: 2, speed: 0.077, size: 0.08, coins: 1, harm: 1, flies: true },
  ogre:   { hp: 18, speed: 0.04, size: 0.13, coins: 5, harm: 3 }
};
const SLOW_FOR = 1.6;
const ASPECT = 16 / 9;

/* What comes in wave w: more each time - that's the whole challenge; the
   monsters themselves never get faster or tougher. It creeps up slowly at
   first (7, 9, 11, 13, 17...) and then snowballs, so a strong team holds
   about a quarter of an hour before the horde is too much. Goblins from the
   second wave, bats from the third, an ogre (or more) every fifth. All
   along the one trail. */
export const POUR = 8;   /* seconds a wave takes to come out, once it's big */
export const countOf = (w) => Math.min(1500, Math.round(5 + w + Math.pow(1.30, w - 1)));
/* Seconds between monsters coming out in wave w. */
export const gapOf = (w) => Math.min(1.3, POUR / countOf(w));
export function waveOf(w){
  const n = countOf(w), out = [];
  const path = () => 0;
  for (let k = 0; k < n; k++){
    const r = ((k * 7 + w * 3) % 12) / 12;
    out.push({ kind: w >= 3 && r < 0.25 ? 'bat' : w >= 2 && r < 0.55 ? 'goblin' : 'slime', path: path(k) });
  }
  /* The ogres spread through the wave, not all at the end. */
  const ogres = ogresOf(w);
  for (let k = 0; k < ogres; k++) out.splice(Math.floor((k + 0.5) / ogres * out.length) + k, 0, { kind: 'ogre', path: 0 });
  return out;
}
/* Ogres: one or more every fifth wave, and from wave OGRE_FROM on, more and
   more in every wave - smashing towers and bonking knights, they're what
   finally wears down even the best-built meadow. */
export const OGRE_FROM = 8, OGRE_K = 10;
export const ogresOf = (w) => (w % 5 === 0 ? w / 5 : 0) + Math.floor(Math.max(0, w - OGRE_FROM) ** 2 / OGRE_K);

export default {
  /* Endless: it lasts as long as the castle holds. secs is only how long
     the music takes to build. */
  id: 'castle-defense', name: 'Castle Defense', stars: 2, accent: '#e5534b', secs: ROUND, endless: true,
  /* Arms go up when hammering; a pause is a longer hold. */
  pauseHold: 3,
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
    this.monsters = [];
    this.shots = [];
    this.bits = [];
    this.castleHit = 0;
    this.faces = new FaceCam();
    this.jumps = new JumpWatch();
    /* What's been done yet, for the hints. */
    this.seen = { built: false, jumped: false, hammered: false, rolled: false, repaired: false, called: false };
    /* The knights wait by the castle, side by side. */
    this.knights = pose.players.map((_, i) => {
      const { x, y } = this.home(i);
      return { x, y, tx: x, ty: y, vx: 0, vy: 0, dir: 1, walk: 0, march: 0, lean: null, swing: 0, sword: 0,
               spin: 0, ra: null, ham: 0, hop: 0, at: null,
               lvl: 0, xp: 0, hp: KNIGHT_HP, calm: 0, bonk: 0, down: 0, safe: 0, glow: 0 };
    });
    this.avatars = new Avatars();
    this.out = null;
    this.nextId = 1;
  }

  get maxHearts(){ return CASTLE_HEARTS[this.castleLvl - 1]; }
  get built(){ return this.seen.built; }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    this.t += dt;
    this.castleHit = Math.max(0, this.castleHit - dt * 2);
    this._waves(dt);
    this.faces.step(dt);
    this._knights(dt);
    this._work(dt);
    this._march(dt);
    this._smash(dt);
    this._clubs(dt);
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
      this._spawn(next.kind, next.path);
      this.spawnT += gapOf(this.wave);
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
    this.queue = waveOf(this.wave); this.spawnT = 0;
    sfx.trumpet(1);
  }

  _spawn(kind, path = 0){
    const M = MONSTERS[kind], hp = M.hp;
    /* Each walks a little to one side or the other of the middle of the
       trail, so a crowd looks like a crowd, not a queue. */
    this.monsters.push({ id: this.nextId++, wave: this.wave, kind, path, s: 0, side: (Math.random() - 0.5) * 0.05, hp, max: hp, speed: M.speed,
                         slowT: 0, slowK: 1, hurt: 0, wob: Math.random() * 6 });
  }

  _march(dt){
    for (const m of this.monsters){
      m.hurt = Math.max(0, m.hurt - dt * 4);
      if (m.slowT > 0){ m.slowT -= dt; if (m.slowT <= 0) m.slowK = 1; }
      m.s += m.speed * m.slowK * dt;
      if (m.s >= PATHS[m.path].total){
        m.gone = true;
        this.hearts = Math.max(0, this.hearts - MONSTERS[m.kind].harm);
        this.castleHit = 1;
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
      k.bonk = Math.max(0, k.bonk - dt * 3);
      k.glow = Math.max(0, k.glow - dt);
      k.safe = Math.max(0, k.safe - dt);
      const on = i < this.players && p && p.present && !this.out;
      if (!on){ k.vx = k.vy = 0; k.march = 0; k.lean = null; k.at = null; continue; }
      /* Bonked out: seeing stars a moment, then back at the castle. */
      if (k.down > 0){
        k.down -= dt; k.vx = k.vy = 0; k.at = null;
        if (k.down <= 0) this._respawn(i, k);
        continue;
      }
      /* Getting its breath back, away from ogres. */
      k.calm += dt;
      if (k.hp < KNIGHT_HP && k.calm > KNIGHT_MEND){ k.hp++; k.calm = 0; }
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
        this._rollWatch(k, p, dt);
        this._hammerWatch(k, p, dt);
      }
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

  /* Marching and leaning: how hard the knees are going up and down sets the
     pace; which way the body leans sets the way. */
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
    /* Leaning: shoulders over the hips, sideways, and nearer or further. */
    const sx = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2, hx = (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2;
    const sz = ((lm[L.L_SHOULDER].z ?? 0) + (lm[L.R_SHOULDER].z ?? 0)) / 2, hz = ((lm[L.L_HIP].z ?? 0) + (lm[L.R_HIP].z ?? 0)) / 2;
    const sw = Math.abs(lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x) || 0.05;
    const lx = clamp((sx - hx) / sw / LEAN_X, -1, 1), ly = clamp((sz - hz) / sw / LEAN_Z, -1, 1);
    const mag = Math.hypot(lx, ly);
    if (mag < LEAN_DEAD){ k.lean = null; k.vx = k.vy = 0; return; }
    const pull = Math.min(1, (mag - LEAN_DEAD) / (1 - LEAN_DEAD)), ux = lx / mag, uy = ly / mag;
    k.lean = { x: ux, y: uy, k: pull };
    /* Leaning alone walks; running on the spot hurries it along. */
    const sp = (WALK + (RUN - WALK) * k.march) * pull;
    k.vx = ux * sp; k.vy = uy * sp;
  }

  /* Hammering: a fist going up and down, hard. */
  _hammerWatch(k, p, dt){
    const v = Math.max(Math.abs(p.hands.left.vy || 0), Math.abs(p.hands.right.vy || 0));
    k.ham += (clamp(v / 1.5, 0, 1) - k.ham) * Math.min(1, dt * 5);
  }
  hammering(k){ return pose.mouse.active ? false : k.ham > 0.4 && !this.rolling(k); }

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
    k.xp += MONSTERS[m.kind].coins;
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
      .filter(({ k, i }) => pose.players[i].present && !(k.down > 0) && !(k.safe > 0) && Math.hypot((p.x - k.x) * ASPECT, p.y - k.y) <= SLAM_R);
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
        sfx.thud();
        for (let q = 0; q < 10; q++) this._spark(p.x + (Math.random() - 0.5) * SLAM_R / ASPECT * 2, p.y + (Math.random() - 0.5) * 0.02, '#c9a66b');
        for (const { k, i } of inRing(p)){
          k.hp--; k.calm = 0; k.bonk = 1;
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

  /* Bonked out: every level lost, and a moment seeing stars. */
  _knockOut(i, k){
    this.knockouts = (this.knockouts || 0) + 1;
    k.down = DOWN; k.lvl = 0; k.xp = 0; k.fell = { x: k.x, y: k.y };
    k.vx = k.vy = 0; k.at = null;
    sfx.boing(0.5);
    for (let q = 0; q < 20; q++) this._spark(k.x, k.y - KNIGHT_SIZE * 0.5, '#ffffff');
  }

  /* Back at the castle, whole, and safe for a moment. */
  _respawn(i, k){
    const h = this.home(i);
    k.x = k.tx = h.x; k.y = k.ty = h.y;
    k.hp = KNIGHT_HP; k.safe = SAFE; k.down = 0; k.calm = 0; k.fell = null;
    sfx.pop(1);
    for (let q = 0; q < 14; q++) this._spark(k.x, k.y - KNIGHT_SIZE * 0.5, PLAYER_COLORS[i]);
  }

  /* Where knight i waits at the start, and comes back to: by the castle. */
  home(i){ return { x: CASTLE.x + CASTLE.w / 2 + 0.04 + i * 0.035, y: CASTLE_BASE - 0.3 - i * 0.02 }; }

  /* A jump on an empty pad changes which tower it will be. */
  _jump(i, k){
    k.hop = 1;
    const at = k.at;
    if (!at || at.kind !== 'pad' || this.towers.has(at.i)) return;
    this.picks.set(at.i, (this.picks.get(at.i) + 1) % KINDS.length);
    this.work.delete(`p${at.i}`);
    this.seen.jumped = true;
    sfx.boing(2);
    const pad = PADS[at.i];
    for (let q = 0; q < 10; q++) this._spark(pad.x, pad.y - 0.06, PLAYER_COLORS[i]);
  }

  /* Where a knight is standing: on a pad, at the castle, by the horn, or
     out in the meadow. */
  _spot(k){
    let best = null, bd = AT_PAD;
    for (const pad of PADS){ const d = Math.hypot((pad.x - k.x) * ASPECT, pad.y - k.y); if (d < bd){ bd = d; best = { kind: 'pad', i: pad.i, id: `p${pad.i}` }; } }
    if (best) return best;
    if (onCastle(k.x, k.y + 0.03, this.castleLvl)) return { kind: 'castle', id: 'castle' };
    if (this.state === 'build' && Math.hypot((HORN.x - k.x) * ASPECT, HORN.y - k.y) < 0.09) return { kind: 'horn', id: 'horn' };
    return null;
  }

  /* ---------- building, mending and building up ---------- */

  /* What standing at a spot does now, and whether it can. */
  _job(at){
    if (at.kind === 'horn') return { need: HORN_HOLD, can: this.state === 'build', act: () => { this.breakT = 0; this.seen.called = true; } };
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
    /* Who is standing where, and how hard they're hammering. */
    const at = new Map();
    for (let i = 0; i < this.players; i++){
      const k = this.knights[i];
      if (!k.at || !pose.players[i].present) continue;
      const e = at.get(k.at.id) || { at: k.at, rate: 0, who: i };
      const ham = this.hammering(k);
      if (ham) this.seen.hammered = true;
      e.rate += ham ? HAMMER : 1; e.one = Math.max(e.one || 0, ham ? HAMMER : 1);
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
    this.towers.set(i, { kind, lvl: 1, cool: 0.3, aim: -Math.PI / 2, who, kick: 0, hp: TOWER_HP[0], max: TOWER_HP[0], hit: 0 });
    this.seen.built = true;
    sfx.land();
    const pad = PADS[i];
    for (let k = 0; k < 14; k++) this._spark(pad.x, pad.y - 0.04, '#ffd24a');
  }

  _upgrade(i, who){
    const tw = this.towers.get(i);
    tw.lvl++;
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
        tw.hp -= OGRE_SMASH * dt; tw.hit = 1;
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
    const M = MONSTERS[m.kind];
    this.coins += M.coins;
    const p = this.pos(m);
    sfx.pop(M.coins > 1 ? 1 : 0.4);
    /* Its coins fly to the chest; a puff where it was. */
    for (let k = 0; k < M.coins; k++) this.bits.push({ kind: 'coin', x: p.x, y: p.y - 0.04, from: { x: p.x, y: p.y - 0.04 }, age: -k * 0.08, life: 0.7 });
    for (let k = 0; k < 8; k++) this._spark(p.x, p.y - 0.03, '#ffffff');
    this.monsters = this.monsters.filter(q => q !== m);
  }

  /* ---------- little things ---------- */

  _spark(x, y, col){
    const a = Math.random() * 6.28, sp = 0.08 + Math.random() * 0.12;
    this.bits.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp / ASPECT, vy: Math.sin(a) * sp - 0.05, age: 0, life: 0.6, col });
    if (this.bits.length > 400) this.bits.splice(0, this.bits.length - 400);
  }
  _stepBits(dt){
    const chest = { x: CHEST.x, y: CHEST.y - 0.02 };
    for (const b of this.bits){
      b.age += dt;
      if (b.kind === 'spark'){ b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 0.15 * dt; }
      else if (b.kind === 'coin' && b.age > 0){
        const k = Math.min(1, b.age / b.life), e = k * k;
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
    drawMeadow(c, W, H);
    const things = [];
    for (const pad of PADS){
      const tw = this.towers.get(pad.i), here = this.knights.some((k, i) => i < this.players && k.at && k.at.id === `p${pad.i}`);
      drawPad(c, W, H, pad, tw || this.out ? 0 : here ? 1 : 0.2 + 0.1 * Math.sin(this.t * 3 + pad.i));
      if (tw) things.push({ y: pad.y, draw: () => {
        c.save(); if (tw.hit > 0) c.translate(Math.sin(this.t * 60) * tw.hit * H * 0.004, 0);
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
      const lunge = Math.sin((m.bonk || 0) * Math.PI) * 0.02, lift = m.wind > 0 ? 1 - m.wind / WINDUP : 0;
      if (lift > 0 && !this.out) drawSlamRing(c, p.x * W, p.y * H, SLAM_R * H, lift, this.t);
      things.push({ y: p.y, draw: () => drawMonster(c, p.x * W, (p.y - dance - lunge) * H, M.size * H, m.kind, this.t + m.wob, p.dir, m.hurt, m.slowT > 0, m.hp / m.max, lift) });
    }
    /* The knights, among everything else. */
    for (let i = 0; i < this.players; i++){
      const k = this.knights[i];
      if (!pose.players[i].present) continue;
      /* Bonked out: stars going round where it fell. */
      if (k.down > 0){
        const f = k.fell;
        things.push({ y: f.y, draw: () => {
          for (let q = 0; q < 5; q++){ const a = this.t * 5 + q * 1.2566; star(c, (f.x + Math.cos(a) * 0.03 / ASPECT) * W, (f.y - KNIGHT_SIZE * 0.5 + Math.sin(a) * 0.012) * H, H * 0.012, q % 2 ? '#ffd24a' : '#ffffff'); }
        } });
        continue;
      }
      if (!this.out && pose.mouse.active && Math.hypot((k.tx - k.x) * ASPECT, k.ty - k.y) > 0.02) drawMarker(c, k.tx * W, k.ty * H, KNIGHT_SIZE * H, PLAYER_COLORS[i], this.t);
      if (!this.out){
        /* The lean arrow under it. */
        if (k.lean) this._drawLean(c, k, W, H, PLAYER_COLORS[i]);
      }
      const hop = Math.sin(k.hop * Math.PI) * KNIGHT_SIZE * 0.6;
      things.push({ y: k.y, draw: () => {
        /* A level just gained: a golden glow. */
        if (k.glow > 0){
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
        /* Hurt: little hearts over its head, for the bonks it has left. */
        if (k.hp < KNIGHT_HP && !this.out){
          for (let q = 0; q < KNIGHT_HP; q++) heart(c, (k.x + (q - (KNIGHT_HP - 1) / 2) * 0.014) * W, (k.y - KNIGHT_SIZE * 1.25 - hop) * H, H * 0.008, q < k.hp ? '#ff4f6a' : 'rgba(80,60,80,.4)');
        }
      } });
    }
    things.push({ y: CASTLE.y + 0.12, draw: () => drawCastle(c, W, H, this.t, this.hearts, this.maxHearts, this.held, this.castleHit, this.mend, this.castleLvl) });
    things.sort((a, b) => a.y - b.y);
    for (const th of things) th.draw();
    drawChest(c, W, H, this.coins, this.t);
    /* The war horn, between waves: its ring is the time left. */
    if (this.state === 'build' && !this.out){
      const w = this.work.get('horn');
      drawHorn(c, HORN.x * W, HORN.y * H, H * 0.095, this.t, clamp(this.breakT / (this.wave ? BUILD_TIME : FIRST_BUILD), 0, 1), w ? clamp(w.t / HORN_HOLD, 0, 1) : 0);
    }
    for (const s of this.shots) drawShot(c, W, H, s);
    if (!this.out){
      this._drawTowerBars(c, W, H);
      this._drawWork(c, W, H);
      this._drawHints(c, W, H);
    }
    this._drawBits(c, W, H);
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
      if (!k.at || !pose.players[i].present || k.at.kind === 'horn') continue;
      const w = this.work.get(k.at.id), job = w && w.job;
      if (!job) continue;
      let x, y;
      if (k.at.kind === 'castle'){ const b = castleBox(this.castleLvl); x = b.x * W; y = (CASTLE_BASE - 0.24 * b.scale - 0.06) * H; }
      else { const pad = PADS[k.at.i]; x = pad.x * W; y = (pad.y - 0.07) * H; }
      const r = H * 0.06, frac = job.need ? clamp(w.t / job.need, 0, 1) : 1;
      if (!job.fix) drawWorkRing(c, x, y, r, job.can ? frac : 0, job.what === 'mend' ? '#ff4f6a' : '#ffd24a');
      if (job.what === 'mend') heart(c, x, y, r * 0.45, '#ff4f6a');
      if (job.what === 'up') star(c, x, y, r * 0.4, '#ffd24a');
      if (this.hammering(k)) drawHammer(c, x + r * 1.1, y - r * 0.6, r * 0.6, -0.6 + Math.sin(this.t * 18) * 0.6);
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
      if (!pose.players[i].present) continue;
      const x = k.x * W, y = k.y * H, s = KNIGHT_SIZE * H;
      /* Leaning and running: footprints stepping, arrows all round, under a
         knight that hasn't gone anywhere yet. */
      if (!k.driven){
        const step = Math.floor(this.t * 3) % 2;
        c.save(); c.globalAlpha = 0.7;
        for (const side of [-1, 1]){
          const up = (side < 0) === !!step;
          c.fillStyle = '#fff6e2'; c.beginPath(); c.ellipse(x + side * s * 0.16, y + s * 0.12 - (up ? s * 0.08 : 0), s * 0.07, s * 0.11, 0, 0, 6.2832); c.fill();
        }
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
        for (const [ax, ay, oy] of [[1, 0, -0.35], [-1, 0, -0.35], [0, 1, 0.3], [0, -1, -1.25]]) arrow(c, x + ax * s * 0.55, y + oy * s, ax, ay, s * (0.18 + pulse * 0.05), '#fff6e2');
        c.restore();
        continue;
      }
      /* Jumping: standing on an empty pad, until someone has jumped to change
         a tower - a little bouncing arrow over the knight. */
      if (!this.seen.jumped && k.at && k.at.kind === 'pad' && !this.towers.has(k.at.i)){
        const b = Math.abs(Math.sin(this.t * 4)) * s * 0.3;
        c.save(); c.globalAlpha = 0.8; arrow(c, x, y - s * 1.2 - b, 0, -1, s * 0.3, '#fff6e2'); c.restore();
      }
      /* Hammering: while working on something, until someone has hammered -
         a ghostly fist bobbing up and down beside the knight. */
      if (!this.seen.hammered && !pose.mouse.active && k.at && k.at.kind !== 'horn' && this.work.get(k.at.id)?.job?.can){
        ghost(x + s * 0.8, y - s * (0.9 + 0.35 * Math.abs(Math.sin(this.t * 6))), 0.8);
      }
    }
    /* Building: until the first tower, the nearest empty pad to the first
       knight pulses, with a trail of dots leading to it. */
    if (!this.seen.built && this.knights[0] && pose.players[0].present){
      const k = this.knights[0];
      let best = null, bd = 9;
      for (const pad of PADS){ if (this.towers.has(pad.i)) continue; const d = Math.hypot((pad.x - k.x) * ASPECT, pad.y - k.y); if (d < bd){ bd = d; best = pad; } }
      if (best && bd > AT_PAD){
        c.save(); c.fillStyle = '#fff6e2';
        for (let q = 1; q < 8; q++){ const u = q / 8, a = 0.25 + 0.6 * Math.max(0, Math.sin(this.t * 4 - q * 0.6)); c.globalAlpha = a; c.beginPath(); c.arc((k.x + (best.x - k.x) * u) * W, (k.y + (best.y - k.y) * u) * H, H * 0.007, 0, 6.2832); c.fill(); }
        c.restore();
      }
    }
    /* The horn: once there's a tower up, before the first wave, it glows. */
    if (this.seen.built && this.wave === 0 && this.state === 'build' && !this.seen.called){
      c.save(); c.globalAlpha = 0.35 + 0.3 * Math.sin(this.t * 5);
      const g = c.createRadialGradient(HORN.x * W, HORN.y * H, 0, HORN.x * W, HORN.y * H, H * 0.12);
      g.addColorStop(0, 'rgba(255,240,180,.9)'); g.addColorStop(1, 'rgba(255,240,180,0)');
      c.fillStyle = g; c.beginPath(); c.arc(HORN.x * W, HORN.y * H, H * 0.12, 0, 6.2832); c.fill();
      c.restore();
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
    c.save(); c.globalAlpha = 0.55 + 0.4 * k.march;
    arrow(c, x + k.lean.x * s * 0.3, y + k.lean.y * s * 0.18 + s * 0.05, k.lean.x, k.lean.y * 0.6, len, col);
    c.restore();
  }

  _drawBits(c, W, H){
    for (const b of this.bits){
      if (b.age < 0) continue;
      const k = b.age / b.life;
      if (b.kind === 'spark'){ c.globalAlpha = 1 - k; c.fillStyle = b.col; c.beginPath(); c.arc(b.x * W, b.y * H, H * 0.006, 0, 6.2832); c.fill(); c.globalAlpha = 1; }
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
