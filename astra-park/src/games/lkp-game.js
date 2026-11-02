import { clamp, scores } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';
import { JumpWatch } from '../tracking/jump.js';
import { turn, resetView } from './lkp-world.js';
import { P, RUN, DOORS, setBend, drawCorridor, drawGloom, drawBlocker, drawBeam, drawGap, drawCrystal, drawFountain,
         drawDoors, drawCrown, sign, drawCrew, drawHealth, drawRustbot, drawBeast, drawPulse, drawZzz, setPalette } from './lkp-art.js';
import { Fight, BUDDY } from './lkp-combat.js';
import { arms, armored } from './lkp-weapons.js';
import { Lights } from './lkp-trap.js';
import { Warden } from './lkp-boss.js';
import { Scout } from './lkp-scout.js';
import { Depot } from './lkp-depot.js';
import { Treasure } from './lkp-treasure.js';
import { levelUp, goldPick, meleePick, needFor, PICK_TIME } from './lkp-levelup.js';
import { LEVELS } from './lkp-levels.js';
import { Captain, Scene, NAMES, drawOpening, drawBossRising, drawEnding } from './lkp-captain.js';

/* The bosses, by the name a level gives (lkp-levels.js). Each is a fight
   with its own step(dt, W, H, jumped), arena(), items(), hud() and
   cues() - see the Scout. */
const BOSSES = { scout: Scout, warden: Warden };

/* Last Known Position. A salvage crew of up to four boards a derelict starship and
   runs its corridors for real: lean to slide across round the debris, duck
   under the low bulkheads, hop the breaches in the floor, run through the
   crystals and the green repair stations. At each crossroads the crew votes
   with their feet - two doors, each a fight, traps or anything (?): lean
   left for the left door, right for the right, and whichever door has the
   most of them in front of it when the time's up is the way they go.

   It teaches by showing: the first corridor is gentle, one new thing at a
   time, with crystals to show the way.

   Corridors wound but never kill: nobody's knocked below a sliver of
   health by them. (That's for the rooms, to come.)

   Captain Nova talks them through it on the radio (lkp-captain.js),
   with a little scene to open, before the Warden, and to end.

   The fight door is a combat room (lkp-combat.js); the traps door, a
   trap room - red light, green light (lkp-trap.js); and treasure, only
   ever behind the ? door, a crystal grab (lkp-treasure.js). */

export const SPEED = 0.3;                       /* corridor depths a second */
/* The story - the captain's scenes - on or off (off in the tests of the
   play itself). */
export const story = { on: true };

/* While we playtest the mechanics, every part of the run is PLAYTEST
   seconds long - each corridor, and at most each fight - so it's quick
   to try everything. 0 for the full lengths. */
export const PLAYTEST = 0;
const FULL = [45, 35, 35, 30];                      /* seconds of each corridor, in full */
export const CORRIDOR = PLAYTEST ? FULL.map(() => PLAYTEST) : FULL;
export const MAX_HP = 100;
/* However a boss fight is going, after this long the boss gives up (the
   level's won, but the boss isn't counted as beaten). */
export const BOSS_MAX = 180;
/* The score: every crystal, 10 for each knocked out, 500 for each boss beaten. */
/* Energy crystals: the XP. Each one the crew picks up is worth CRYSTAL_XP
   to the team; every GOLD_EVERY-th level up is a gold pick. (The crystals
   are counted too - they're the score.) */
export const CRYSTAL_XP = 2, GOLD_EVERY = 3;
/* A crystal picked up zooms to the XP bar: FLY seconds - slower and bigger
   for the first SHOW of a run, so it's seen - and at most FLYING in the air
   at once (any more go straight in). */
export const FLY = 0.2, FLY_FIRST = 0.7, SHOW = 3, FLYING = 6;
export const SCORE = { kill: 10, boss: 500 };
/* The tally at the end: each line's turn to count up, and how long. */
const TALLY_STEP = 0.9, TALLY_COUNT = 0.7;
export const HURT = { blocker: 10, beam: 10, gap: 20, ledge: 10 };   /* ledge: a breach across part of the floor */
export const SAFE = 1;                          /* seconds of safety after a hit */
export const SLOW = 0.6, SLOW_FOR = 0.6;        /* a hit slows everyone a moment */
/* A spring: a long pool along the path, SPRING_SECS to run through,
   healing as you go - SPRING_HEAL in all, for running the whole length. */
/* Below LOW of their health, a heartbeat. */
export const LOW = 0.3;
/* The door vote's last BEEPS seconds beep - every second, then quicker. */
export const BEEPS = 4;
/* Running: STEPS footsteps a second at full speed. */
export const STEPS = 5.5;
export const SPRING_SECS = 1.5, SPRING_HEAL = 18;
export const SPRING_LEN = SPEED * SPRING_SECS;
/* Springs in each corridor after the first (one more before the boss). */
export const SPRINGS = 2;                         /* a repair station */
export const VOTE = 10;                         /* seconds to vote - always the whole time, to think it over */
/* How far past the line between two doors (of the corridor's half-width)
   someone has to go to count as at the next door - so a wobble on the
   line doesn't flip their vote back and forth. */
export const DOOR_EDGE = 0.08;
export const ROOM_STUB = 3.5;                   /* stage 1: seconds in a room's doorway */
/* How tall the crew stand (screen heights), and how far off the doors are
   when the crew stop in front of them. */
export const CREW_SIZE = 0.19, DOOR_STOP = 0.25;
/* At the doors the run pauses and the view closes in: over ZOOM_IN
   seconds, ZOOM times closer, round a point just over the crew's heads -
   so the doors fill the screen. Once through, it eases back out over
   ZOOM_OUT. Walking through, the crew go WALK_THROUGH as fast as they
   run. */
export const ZOOM = 1.5, ZOOM_IN = 2, ZOOM_OUT = 0.8, WALK_THROUGH = 0.35;
export const GRAVITY = 7, HOP = 1;              /* a hop: about a second in the air */
/* A hop is a little one: the body rising this much (body sizes) this fast
   (body sizes a second) - a small bounce on the spot is plenty. A stray
   one does no harm here. */
export const HOP_RISE = 0.045, HOP_SPEED = 0.35;
/* A hop just too late still clears a breach: up to this long (seconds)
   after it arrives. */
export const LATE_HOP = 0.3;
/* Getting up from a duck is never a hop: not for this long (seconds)
   after the head comes back up - and the feet have to leave the floor. */
export const UNDUCK = 0.5;
export const CLEAR = 0.15;                      /* how high (of a full hop) clears a breach */
export const DUCKED = 0.5;                      /* how far down (0..1) passes under a bulkhead */
export const DUCK = 0.15;                       /* head drop, in body sizes, that counts as ducking */
export const LEAN = 0.35;                       /* shoulder-widths of lean for full reach */
export const MYSTERY = [['treasure', 0.5], ['combat', 0.25], ['traps', 0.25]];
const HOMES = { 2: [-0.45, 0.45], 3: [-0.6, 0, 0.6], 4: [-0.72, -0.24, 0.24, 0.72] };
const REACH = { 1: 1, 2: 0.55, 3: 0.5, 4: 0.45 };
/* In a fight, how far apart (of their corridor places) the crew stand
   when they're not leaning: just far enough that nobody's standing with
   a teammate till they lean in. */
export const FIGHT_APART = 0.7;
/* A sentence starting with a capital. */
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);
const BODY = 0.1, CRYSTAL_REACH = 0.18, FOUNTAIN_REACH = 0.3;
/* What a door can be: the elite (the skull - always a big fight, for a
   pile of crystals), traps, or anything (?, which can be an ordinary fight).
   Each crossroads has two of them, different, either way round - but
   never the elite at a level's first, before anyone's levelled up. */
export const DOOR_KINDS = ['elite', 'traps', 'mystery'];
const twoDoors = (first = false) => {
  const k = DOOR_KINDS.filter(d => !(first && d === 'elite')).sort(() => Math.random() - 0.5);
  return [k[0], k[1]];
};

const def = {
  id: 'last-known-position', name: 'Last Known Position', stars: 4, accent: '#3fd0ff', secs: 1200, endless: true,
  /* The moves it uses, shown as pictures on the home screen. */
  moves: ['lean', 'jump', 'duck', 'clap', 'hug'],
  /* Arms go up in every hop; holding them up a while is still a pause. */
  pauseHold: 2.5,
  /* Its own music, tense and driving (audio/action.js). */
  music: 'action',
  create(n){ return new LastKnownPosition(n); }
};
export default def;

class LastKnownPosition {
  constructor(players){
    this.players = players;
    /* The level being played (only the first, for now), in its colours;
       its robots asleep till its depot wakes them. */
    this.level = LEVELS[0];
    setPalette(this.level.palette); resetView();
    this.awake = !this.level.plan.includes('depot');
    this.depot = null;
    this.t = 0; this.over = false; this.lost = false; this.out = null;
    this.z = 0; this.speed = SPEED; this.slow = 0; this.shake = 0;
    this.zoom = 0;                  /* how far the view has closed in, 0..1 */
    this.crystals = 0; this.kills = 0; this.bosses = 0; this.flyers = []; this.flown = 0; this.xpPulse = 0;
    /* The team's XP and level (lkp-levelup.js); level-ups still to pick,
       and the picking, while it's on. */
    this.xp = 0; this.lvl = 1; this.pending = 0; this.golds = 0; this.levelup = null;
    this.fight = null;              /* the fight, in a combat room */
    this.trap = null;               /* the trap, in a trap room */
    this.boss = null;               /* the level's boss, at the end */
    this.faces = new FaceCam();
    this.captain = new Captain();
    this.scene = story.on ? new Scene('opening', this) : null;
    this.jumps = new JumpWatch({ rise: HOP_RISE, speed: HOP_SPEED, feet: true });
    this.heads = pose.players.map(() => null);
    this.crew = pose.players.map((_, i) => ({ x: 0, lean: 0, air: 0, airV: 0, duck: 0, lastDuck: -9, hp: MAX_HP, max: MAX_HP, down: false, safe: 0, hit: 0, played: false, falling: 0, fall: null }));
    this.things = [];
    this.bits = [];
    this.guide = 0;                 /* whose crown breaks a tied vote */
    this.rooms = [];                /* the rooms the crew have chosen, in order */
    this.doors = [];                /* and the doors they chose them by */
    this.step_ = -1;
    this._next();
  }

  /* The children here, in order: they share the corridor side by side,
     each with their own stretch of it; one alone has all of it. */
  get here(){ return pose.players.slice(0, this.players).map((_, i) => i).filter(i => pose.players[i].present); }
  _home(i){ const here = this.here, n = here.length, k = here.indexOf(i); return n < 2 || k < 0 ? 0 : HOMES[n][k]; }
  get reach(){ return REACH[Math.max(1, this.here.length)]; }
  get phase(){ return this.seg.kind; }

  /* ---------- the floor plan: corridor, crossroads, room, ... ---------- */

  _next(){
    this.step_++;
    const plan = this.level.plan, kind = plan[this.step_] || 'end';
    this.seg = { kind, t: 0 };
    this.fight = null; this.trap = null; this.boss = null; this.depot = null; this.treasure = null;
    if (kind === 'corridor'){
      const n = plan.slice(0, this.step_ + 1).filter(k => k === 'corridor').length - 1;
      this.seg.n = n;
      this.seg.len = CORRIDOR[n] || 45;
      this._layout(n);
    } else if (kind === 'cross'){
      /* The doors, coming up the corridor; the crew stop in front of them. */
      this.seg.wall = this.z + 0.9;
      this.seg.votes = [[], []];
      this.seg.kinds = twoDoors(!this.level.plan.slice(0, this.step_).includes('cross'));
      this.seg.choice = null; this.seg.opening = 0;
      for (const rn of this.crew) rn.door = null;
      this.seg.vote = VOTE;
      this.guide = this._nextGuide();
    } else if (kind === 'room'){
      this.seg.room = this.rooms[this.rooms.length - 1];
      this.seg.len = ROOM_STUB;
      if (this.seg.room === 'combat' || this.seg.room === 'elite'){
        const elite = this.seg.room === 'elite';
        this.fight = new Fight(this, PLAYTEST || undefined, { elite });
      }
      /* A longer hall: twice the playtest time to get up it. */
      if (this.seg.room === 'traps') this.trap = PLAYTEST ? new Lights(this, PLAYTEST * 2) : new Lights(this);
      if (this.seg.room === 'treasure') this.treasure = new Treasure(this);
      sfx.whoosh();
    } else if (kind === 'depot'){
      this.depot = new Depot(this);
      this.things = [];
      if (story.on){ const [, text, words] = this.level.lines.depot[0]; this.captain.say(text, words); }
    } else if (kind === 'boss'){
      if (story.on) this.scene = new Scene('boss', this);
      /* While playtesting, a boss you can beat in a playtest's time. */
      const Boss = BOSSES[this.level.boss];
      this.boss = PLAYTEST ? new Boss(this, PLAYTEST * 2, 0.35) : new Boss(this, BOSS_MAX);
      this.fight = this.boss.fight;
      this.things = [];
    } else if (kind === 'end'){
      this.over = true;
    }
  }
  _nextGuide(){
    const here = this.here;
    if (!here.length) return 0;
    const k = here.indexOf(this.guide);
    return this.step_ <= 1 ? here[0] : here[(k + 1) % here.length];
  }

  /* What's in corridor n, by the second: the first is gentle, one new thing
     at a time - a bit of debris, then a bulkhead to duck, then a breach to
     hop, each alone, with crystals to show the way - and the later ones mix
     them up, faster and closer. */
  _layout(n){
    /* Laid out for the full length, and squeezed to fit a shorter one. */
    const squeeze = this.seg.len / (FULL[n] || 45);
    const at = (secs) => this.z + RUN + SPEED * secs * squeeze + 0.9;   /* reaching the crew `secs` in */
    /* After the first, each corridor turns sharply once, halfway (for the
       look: it's automatic). */
    if (n > 0) this.seg.corner = { d: at((FULL[n] || 45) * 0.5), dir: Math.random() < 0.5 ? -1 : 1, at: null };
    const add = (secs, th) => this.things.push({ d: at(secs), ...th });
    const crystalLine = (secs, lane, k = 5, high = false) => { for (let i = 0; i < k; i++) add(secs + i * 0.3 / squeeze, { kind: 'crystal', lane, high }); };
    const side = () => (Math.random() < 0.5 ? -1 : 1);
    const blocker = (secs, s = side(), width = 0.9) => {
      const a = s < 0 ? -1.05 : 1.05 - width, b = a + width;
      add(secs, { kind: 'blocker', a, b, seed: Math.floor(Math.random() * 100) });
      crystalLine(secs - 0.6, s < 0 ? 0.6 : -0.6, 4);
    };
    const beam = (secs) => add(secs, { kind: 'beam' });
    const gap = (secs, full = true, s = side()) => {
      if (full){ add(secs, { kind: 'gap', a: -1.05, b: 1.05 }); [-0.5, 0, 0.5].forEach(l => add(secs, { kind: 'crystal', lane: l, high: true })); }
      else { const a = s < 0 ? -1.05 : 0.05, b = a + 1; add(secs, { kind: 'ledge', a, b }); crystalLine(secs - 0.5, s < 0 ? 0.6 : -0.6, 3); }
    };
    const fountain = (secs, lane = 0) => add(secs, { kind: 'fountain', lane, used: new Set(), len: SPRING_LEN * squeeze });
    if (n === 0){
      crystalLine(3, 0, 6); crystalLine(6, -0.5, 5);
      blocker(10, 1, 0.8);
      crystalLine(14, 0.4, 5);
      beam(19); crystalLine(20, 0, 4);
      gap(26); crystalLine(29, -0.4, 5);
      blocker(32, -1); fountain(36, 0.5);
      beam(40); gap(43, false); blocker(46);
    } else {
      const hard = n === 1 ? 0.8 : 0.65;
      crystalLine(3, 0, 5); blocker(6); blocker(8.5);
      let s = 11;
      for (let k = 0; k < 6; k++){
        const r = Math.random();
        if (r < 0.4) blocker(s); else if (r < 0.65) beam(s); else if (r < 0.85) gap(s, false); else gap(s);
        s += 2.6 * hard + Math.random() * 1.2;
      }
      /* The middle: a crystal rush, or a spring. */
      if (n === 1){ for (let k = 0; k < 4; k++) crystalLine(s + k * 0.9, Math.sin(k) * 0.7, 3); s += 4.5; }
      else { fountain(s, side() * 0.45); s += 2.5; }
      /* Springs to run into on the way: SPRINGS in the corridor, more in
         the last one before the boss - off to one side, so it's a lean. */
      const last = n === FULL.length - 1, end = (FULL[n] || 45) - 3;
      const springs = Array.from({ length: last ? SPRINGS + 1 : SPRINGS }, (_, k) => s + 2 + (end - s - 2) * (k + 0.5) / (last ? SPRINGS + 1 : SPRINGS));
      for (let k = 0; k < 8 && s < end; k++){
        if (springs.length && s >= springs[0]){ fountain(s, side() * (0.4 + Math.random() * 0.3)); springs.shift(); s += 2; continue; }
        const r = Math.random();
        if (r < 0.35) blocker(s, side(), 1.1); else if (r < 0.6) beam(s); else if (r < 0.8) gap(s, false); else gap(s);
        s += 2.2 * hard + Math.random();
      }
      for (const at of springs) if (at < end) fountain(at, side() * 0.5);
    }
  }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    this.t += dt;
    this.faces.step(dt);
    this.captain.step(dt);
    /* A scene: nothing else moves till it's done. */
    if (this.scene){
      this.scene.step(dt);
      if (this.scene.done) this.scene = null;
      this._stepBits(dt);
      return;
    }
    /* Levelled up: picking upgrades, nothing else moving, till they're
       picked. Only once things are calm - never mid-fight. */
    if (this.levelup){
      if (this.levelup.weapon && !this.levelup.told){
        this.levelup.told = true;
        this.captain.say('The ship\'s armoury is open! Pick a weapon. Lean to choose, then wave to take it.', 'PICK A WEAPON');
      }
      this.levelup.step(dt);
      if (this.levelup.done){
        if (this.levelup.goldPick) this.golds--;
        else if (!this.levelup.weapon) this.pending--;
        this.levelup = null;
      }
      this._stepBits(dt);
      return;
    }
    /* A gold pick earned (every GOLD_EVERY-th level up): before any other
       level up. */
    if (this.golds > 0 && (this.calm || this.bossBeaten)){
      this.levelup = goldPick(this, PLAYTEST || PICK_TIME);
      this.captain.say('A gold pick! Every card counts twice.', 'GOLD PICK', { once: 'goldpick' });
      return;
    }
    if (this.pending > 0 && (this.calm || this.bossBeaten)){
      this.levelup = levelUp(this, PLAYTEST || PICK_TIME);
      /* The pick's own title says it now. */
      this.bits = this.bits.filter(b => b.text !== 'LEVEL UP!');
      this.captain.say('Level up! Lean to pick a card, then wave to take it!', 'LEAN, THEN WAVE', { once: 'levelup' });
      return;
    }
    this._cues();
    this._urgency(dt);
    this.shake = Math.max(0, this.shake - dt * 3);
    const seg = this.seg;
    seg.t += dt;
    this.slow = Math.max(0, this.slow - dt);
    /* How fast down the corridor: steady, a dip when someone's hit, and
       stopping at the doors. */
    let want = SPEED * (this.slow > 0 ? SLOW : 1);
    if (seg.kind === 'cross' && seg.choice == null && seg.wall - this.z < DOOR_STOP) want = 0;
    /* A door chosen: it opens, then everyone walks through. */
    if (seg.kind === 'cross' && seg.choice != null) want = seg.opening < 0.6 ? 0 : SPEED * WALK_THROUGH;
    /* At the doors, the view closes in; once through, back out. */
    const close = seg.kind === 'cross' && seg.wall - this.z <= DOOR_STOP + 0.02;
    this.zoom = close ? Math.min(1, this.zoom + dt / ZOOM_IN) : Math.max(0, this.zoom - dt / ZOOM_OUT);
    if (seg.kind === 'room') want = this.fight || this.trap || this.treasure ? 0 : SPEED * 0.4;
    if (seg.kind === 'boss' || seg.kind === 'depot') want = 0;
    this.speed += (want - this.speed) * Math.min(1, dt * 4);
    const before = this.z;
    this.z += this.speed * dt;
    const jumped = this.jumps.step(dt, pose.players, this.players);
    for (let i = 0; i < this.players; i++) this._move(i, dt, jumped.includes(i), W, H);
    if (seg.kind === 'corridor'){ this._pass(before, W, H); if (seg.t >= seg.len) this._next(); }
    else if (seg.kind === 'cross') this._vote(dt);
    else if (this.boss){ this.boss.step(dt, W, H, jumped); if (this.boss.done && this.boss.clearT > 2.5) this._next(); }
    else if (this.fight){ this.fight.step(dt, W, H, jumped); if (this.fight.done && this.fight.clearT > 1.5) this._next(); }
    else if (this.trap){ this.trap.step(dt, W, H); if (this.trap.done && this.trap.clearT > 1.5) this._next(); }
    else if (this.treasure){ this.treasure.step(dt, W, H); if (this.treasure.done && this.treasure.clearT > 1) this._next(); }
    else if (this.depot){
      this.depot.step(dt, W, H);
      /* Woken: the robots speak - and then, everyone picks their weapon. */
      if (this.depot.done){
        this._next();
        if (story.on) this.scene = new Scene('waking', this);
        this.levelup = meleePick(this, PLAYTEST || PICK_TIME); this.levelup.weapon = true;
      }
    }
    else if (seg.kind === 'room' && seg.t >= seg.len) this._next();
    this.things = this.things.filter(th => th.d + (th.len || 0) - this.z > -0.15);
    this._stepBits(dt);
  }

  /* A hit taken: the screen's edges flash red, and a crunch. */
  ouch(k = 1){ this.redFlash = Math.max(this.redFlash || 0, k); sfx.crunch(); }

  /* The urgency: a heartbeat while anyone's nearly out (quicker the
     lower), and the edges glowing red with it. */
  _urgency(dt){
    this.redFlash = Math.max(0, (this.redFlash || 0) - dt * 3);
    const low = this.here.map(i => this.crew[i]).filter(rn => !rn.down && rn.played).reduce((m, rn) => Math.min(m, rn.hp / rn.max), 1);
    this.low = low < LOW ? 1 - low / LOW : 0;
    if (this.low > 0 && !this.scene && !this.levelup && !this.over){
      this.beatT = (this.beatT ?? 0) - dt;
      if (this.beatT <= 0){ sfx.heartbeat(); this.beatT = 1.1 - 0.5 * this.low; this.beatAt = this.t; }
    } else this.beatT = 0;
  }

  /* XP for the team: past the next level's mark, a level up (picked
     when things are calm). */
  addXp(n){
    this.xp += n;
    while (this.xp >= needFor(this.lvl)){
      this.xp -= needFor(this.lvl); this.lvl++;
      const gold = (this.lvl - 1) % GOLD_EVERY === 0;
      if (gold) this.golds++; else this.pending++;
      sfx.learnt(); if (gold) sfx.gold();
      this.bits.push({ kind: 'num', x: 0.5, y: 0.2, vy: -0.04, age: 0, life: 1.6, text: gold ? 'GOLD PICK!' : 'LEVEL UP!', col: '#ffd24a' });
    }
  }
  /* n energy crystals for the team, picked up at (x, y) on the screen
     (0..1): counted, and each worth `each` XP - zooming up to the XP bar
     first, the XP going in as it lands. */
  gain(n, x = 0.5, y = 0.5, each = CRYSTAL_XP){
    if (!(n > 0)) return;
    this.crystals += n;
    const xp = n * each;
    if (this.flyers.length >= FLYING){ this.addXp(xp); this.xpPulse = 1; return; }
    const first = this.flown < SHOW; this.flown++;
    if (this.flown === 1) this.captain?.say('Grab the energy crystals, crew! Your suits run on them.', 'CRYSTALS POWER YOU UP', { once: 'crystals', polite: true });
    this.flyers.push({ x, y, t: 0, dur: first ? FLY_FIRST : FLY, xp, n: Math.min(n, 4), big: first, bend: Math.random() < 0.5 ? -1 : 1 });
  }
  /* Calm enough to stop for level ups - between rooms: a corridor just
     starting, or the doors before they're chosen. */
  /* The boss down, a moment after: time for what it gave them. */
  get bossBeaten(){ return !this.over && !!this.boss && this.boss.done && this.boss.clearT > 1.2; }
  /* How big the music is: hushed while sneaking, the corridor's walk,
     fights louder, the boss loudest. (The shell reads it.) */
  get mood(){
    if (this.scene || this.levelup) return 0.2;
    const seg = this.seg;
    if (this.boss) return this.boss.done ? 0.5 : 1;
    if (this.fight) return this.fight.done ? 0.4 : 0.8;
    if (this.trap) return this.trap.done ? 0.35 : this.trap.light === 'green' ? 0.3 : 0;
    if (this.treasure) return 0.65;
    if (this.depot) return 0.5;
    if (seg.kind === 'cross') return 0.25;
    return 0.35;
  }
  get calm(){ return !this.over && ((this.seg.kind === 'corridor' && this.seg.t < 1.5) || (this.seg.kind === 'cross' && this.seg.choice == null)); }

  /* What Nova calls what's behind a door - and the fights, here and now. */
  behind(kind){ return kind === 'elite' ? `the biggest of the ${this.foes}` : kind === 'combat' ? this.foes : kind === 'traps' ? 'traps' : 'who knows what'; }
  get foes(){ const e = this.level.enemies; return this.awake ? e.awakeName : e.wildName; }
  /* Who's in a fight here and now: the level's wildlife, or its robots. */
  get enemy(){ const e = this.level.enemies; return this.awake ? e.awake : e.wild; }

  /* ---------- the ship's computer's tips ---------- */

  /* Nova noticing what's happening, and saying something - each tip
     once a run, the rest when they matter. */
  _cues(){
    const cap = this.captain, seg = this.seg, f = this.fight, bs = this.boss, up = this.here.filter(i => !this.crew[i].down);
    if (seg.kind === 'corridor'){
      for (const th of this.things){
        const ahead = th.d - this.z - RUN;
        if (th.got || ahead < 0 || ahead > SPEED * 2.4) continue;
        const kind = th.kind === 'ledge' ? 'gap' : th.kind, tip = this.level.tips[kind];
        if (tip && cap.say(tip[0], tip[1], { once: kind })) break;
      }
    }
    if (seg.kind === 'cross' && seg.vote < VOTE && seg.choice == null && !seg.told){
      seg.told = true;
      const [a, b] = seg.kinds;
      if (!cap.say('Two doors! Lean to the one you want, and stay there till time\'s up.', 'PICK A DOOR', { once: 'doors' }))
        cap.say(`${cap1(this.behind(a))} on the left, ${this.behind(b)} on the right. Your call!`, '');
    }
    if (f && !bs && !seg.told && f.elite){
      seg.told = true;
      cap.say('That\'s a big one! Stick together and keep hitting it. Beat it for a pile of crystals!', 'A BIG ONE!');
    }
    if (f && !bs && !seg.told){
      seg.told = true;
      if (!cap.say(`${cap1(this.foes)}! You'll hit them on your own. Stand close together to hit harder!`, 'STAND TOGETHER', { once: 'fight' }))
        cap.say(['Here they come!', `More ${this.foes}! Stick together!`, 'Stand together, crew!'][Math.floor(Math.random() * 3)], '');
    }
    if (f && !f.done && !bs){
      if (f.t > 4 && f.bots.some(b => b.d > 0.2)) cap.say('Jump to zap them while they\'re still coming!', 'JUMP!', { once: 'zap', polite: true });
      if (f.t > 8 && this.rooms.filter(r => r === 'combat' || r === 'elite').length > 1) cap.say('Roll your arms, like the wheels on the bus, to hit even harder!', 'ROLL YOUR ARMS', { once: 'crank', polite: true });
    }
    if (f && f.done && !seg.cleared && !bs){ seg.cleared = true; cap.say(['Room clear! Nice work, crew.', 'That\'s all of them. Great job!'][Math.floor(Math.random() * 2)], ''); }
    if (f && !f.done){
      for (const i of this.here){
        const rn = this.crew[i];
        if (rn.down && !rn.told){
          rn.told = true;
          if (!cap.say(`${NAMES[i]}'s asleep! Stand next to them and clap to wake them up!`, 'CLAP!', { once: 'clap' })) cap.say(`Clap for ${NAMES[i]}!`, 'CLAP!');
        }
        if (!rn.down) rn.told = false;
      }
    }
    if (this.treasure && !seg.told){ seg.told = true; cap.say('Treasure! Grab all the crystals you can, with your hands!', 'GRAB THE CRYSTALS!'); }
    if (this.treasure && this.treasure.pool > 0 && !seg.toldPool){ seg.toldPool = true; cap.say('Healing water! Hug yourselves to heal faster!', 'HUG TO HEAL!'); }
    const tr = this.trap;
    if (tr && !seg.told){
      seg.told = true;
      const first = this.awake ? 'A sentry robot, recharging! Run on the spot while it\'s green. When its eye opens, freeze!'
        : 'Shh! A sleeping robot. Run on the spot while it sleeps. When its eye opens, freeze!';
      if (!cap.say(first, this.awake ? 'RUN, THEN FREEZE' : 'SHH! RUN, THEN FREEZE', { once: 'lights' })) cap.say(this.awake ? 'Another sentry. Careful now.' : 'Another sleeper. Quietly now!', '');
    }
    if (tr && this.crew.some(rn => rn.zapped > 0.9)) cap.say('Freeze on red!', 'FREEZE!', { once: 'zapped' });
    if (tr && tr.done && !seg.cleared){ seg.cleared = true; if (this.here.some(i => this.crew[i].over)) cap.say('Made it! The crystals are yours.', ''); }
    if (bs && !bs.done) bs.cues(cap);
  }

  /* How far a child leans, -1 left to 1 right: shoulders over hips, in
     shoulder-widths. With the mouse, where it is across the screen. */
  leanOf(i){
    const p = pose.players[i];
    if (!p.present) return null;
    if (pose.mouse.active) return clamp((p.hands.right.x - 0.5) * 2.5, -1, 1);
    const lm = p.lm;
    if (!lm) return null;
    const sx = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2, hx = (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2;
    const sw = Math.abs(lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x) || 0.05;
    return clamp((sx - hx) / sw / LEAN, -1, 1);
  }

  /* Ducking: the head well below where it is when standing. With the
     mouse, low on the screen. */
  duckOf(i, dt){
    const p = pose.players[i];
    if (!p.present){ this.heads[i] = null; return false; }
    if (pose.mouse.active) return p.hands.right.y > 0.78;
    const lm = p.lm;
    if (!lm) return false;
    const y = lm[L.NOSE].y, s = p.scale || 0.3;
    if (this.heads[i] == null){ this.heads[i] = y; return false; }
    const down = (y - this.heads[i]) / s > DUCK;
    if (!down && this.crew[i].air <= 0) this.heads[i] += (y - this.heads[i]) * Math.min(1, dt * 1.5);
    return down;
  }

  _move(i, dt, jumped, W, H){
    const rn = this.crew[i];
    rn.safe = Math.max(0, rn.safe - dt);
    rn.hit = Math.max(0, rn.hit - dt * 2.5);
    rn.heal = Math.max(0, (rn.heal || 0) - dt * 2.5);
    /* The running stride: how hard (0..1) and where in it - a footstep at
       each half. Walking in a trap room goes by how much they move. */
    const run = this.trap ? (this.trap.light !== 'red' && !this.trap.done ? rn.marching || 0 : 0)
      : this.fight || (this.boss && !(this.boss.move && this.boss.move.t >= 0.8)) ? 0 : Math.min(1, this.speed / SPEED);
    rn.run = (rn.run || 0) + (run - (rn.run || 0)) * Math.min(1, dt * 6);
    if (rn.run > 0.05 && rn.air <= 0){
      const was = rn.runPh || 0;
      rn.runPh = was + dt * Math.PI * STEPS * (0.55 + 0.45 * rn.run);
      if (Math.floor(rn.runPh / Math.PI) !== Math.floor(was / Math.PI) && this.t - (this.stepT || 0) > 0.06){
        this.stepT = this.t; sfx.step(i + (Math.floor(rn.runPh / Math.PI) % 2) * 0.5, this.trap ? 0.2 : 0.35);
      }
    }
    /* Over a breach on the ground: a hop now still makes it; too late and
       they've fallen in. */
    if (rn.falling > 0){
      rn.falling -= dt;
      if (jumped) rn.falling = 0;
      else if (rn.falling <= 0){ rn.falling = 0; this._hurt(i, HURT[rn.fall], W, H); }
    }
    /* Tracking lost: they hold where they are until they're back. Down:
       they lie where they fell. */
    if (!pose.players[i].present || rn.down) return;
    if (!rn.played){ rn.played = true; rn.x = this._home(i); }
    const lean = this.leanOf(i);
    rn.lean += ((lean ?? 0) - rn.lean) * Math.min(1, dt * 8);
    /* In a corridor, round their own stretch of it; at a crossroads, the
       whole width is everyone's - lean left for the left door, stand
       straight for the middle one, lean right for the right (each a little
       to one side of the others, so they don't stand on top of each other
       - never so far as another door). */
    /* In a fight, the whole width too, but standing apart unless they
       lean in to stand together. */
    /* A door chosen: all together, over to it and through. */
    /* Red light, green light: straight up their own lane - leaning only tilts them. */
    const want = this.trap ? this._home(i)
      : this.seg.kind === 'cross' && this.seg.choice != null ? DOORS[this.seg.choice] + this._home(i) * 0.12
      : this.seg.kind === 'cross' ? clamp(rn.lean + this._home(i) * 0.2, -1, 1)
      : this.fight ? clamp(rn.lean + this._home(i) * FIGHT_APART, -1, 1)
      : clamp(this._home(i) + rn.lean * this.reach, -1, 1);
    rn.x += (want - rn.x) * Math.min(1, dt * 6);
    if (this.t - rn.lastDuck < UNDUCK) jumped = false;
    if (jumped && rn.air < CLEAR){ rn.airV = Math.sqrt(2 * GRAVITY * HOP); sfx.boing(1.2); }
    if (rn.air > 0 || rn.airV > 0){
      rn.air += rn.airV * dt; rn.airV -= GRAVITY * dt;
      if (rn.air <= 0){ rn.air = 0; rn.airV = 0; }
    }
    const ducking = this.duckOf(i, dt);
    if (ducking) rn.lastDuck = this.t;
    rn.duck += ((ducking ? 1 : 0) - rn.duck) * Math.min(1, dt * 12);
  }

  /* Everything that reaches the crew this step: crystals to pick up, repairs
     to run through, things to dodge. */
  _pass(before, W, H){
    for (const th of this.things){
      /* A spring heals all the way along it: for the stretch run through
         this step. */
      if (th.kind === 'fountain'){
        const len = th.len || SPRING_LEN, a = Math.max(before + RUN, th.d), b = Math.min(this.z + RUN, th.d + len);
        if (b <= a) continue;
        for (const i of this.here){
          const rn = this.crew[i];
          if (Math.abs(rn.x - th.lane) > FOUNTAIN_REACH) continue;
          if (!th.used.has(i)){ th.used.add(i); sfx.twinkle(); }
          rn.heal = 1;
          if (rn.hp < rn.max){
            rn.hp = Math.min(rn.max, rn.hp + SPRING_HEAL * (b - a) / len);
            if (Math.random() < 0.3){ const p = P(rn.x, RUN, W, H); this._sparkle(p.x / W, (p.y - H * 0.15) / H, 3, 140); }
          }
        }
        continue;
      }
      const now = th.d - this.z, was = th.d - before;
      if (!(was >= RUN && now < RUN)) continue;
      for (const i of this.here){
        const rn = this.crew[i];
        if (th.kind === 'crystal'){
          if (th.got || Math.abs(rn.x - th.lane) > CRYSTAL_REACH || (th.high && rn.air < CLEAR * 2)) continue;
          th.got = true;
          const p = P(th.lane, RUN, W, H), y = (p.y - H * (th.high ? 0.3 : 0.12)) / H;
          this.gain(1, p.x / W, y);
          sfx.jar(1 + (this.crystals % 8));
          this._sparkle(p.x / W, y, 6, 185);
          continue;
        }
        if (rn.safe > 0) continue;
        let hit = false;
        if (th.kind === 'beam') hit = rn.duck < DUCKED && this.t - rn.lastDuck > 0.25;
        else if (th.kind === 'gap' || th.kind === 'ledge') hit = rn.x > th.a - BODY * 0.5 && rn.x < th.b + BODY * 0.5 && rn.air < CLEAR;
        else if (th.kind === 'blocker') hit = rn.x > th.a - BODY && rn.x < th.b + BODY && rn.air < CLEAR * 4;
        if (hit && (th.kind === 'gap' || th.kind === 'ledge')){ if (!rn.falling){ rn.falling = LATE_HOP; rn.fall = th.kind; } }
        else if (hit) this._hurt(i, HURT[th.kind], W, H);
      }
    }
  }

  /* Hit: a red flash, a jolt, everyone slows a moment, and a second of
     safety. In a corridor, never down to nothing. (Fights hurt their own
     way: see lkp-combat.js.) */
  _hurt(i, dmg, W, H){
    const rn = this.crew[i];
    rn.hp = Math.max(1, rn.hp - armored(rn, dmg));
    rn.safe = SAFE; rn.hit = 1;
    this.slow = SLOW_FOR; this.shake = Math.min(1, this.shake + 0.5);
    this.ouch(); sfx.thud();
    const p = P(rn.x, RUN, W, H);
    this.bits.push({ kind: 'num', x: p.x / W, y: (p.y - H * 0.42) / H, vy: -0.08, age: 0, life: 0.9, text: `-${dmg}` });
    this._sparkle(p.x / W, (p.y - H * 0.2) / H, 10, 10);
  }

  /* ---------- the crossroads ---------- */

  /* Everyone votes by standing in front of a door, and can change their
     mind till the time's up - always the whole time. Then it's decided:
     most voters, and a tie goes the way the crowned guide is standing. */
  _vote(dt){
    const seg = this.seg;
    if (seg.choice != null){
      seg.opening = Math.min(1, seg.opening + dt * 1.2);
      /* Through the door: into the room. */
      if (this.z > seg.wall - RUN * 0.5){ this.rooms.push(seg.room); this._next(); }
      return;
    }
    if (seg.wall - this.z > DOOR_STOP + 0.02) return;     /* still coming up to the doors */
    const was = seg.vote;
    seg.vote -= dt;
    /* The last seconds beep: each second, then four a second for the last one. */
    if (seg.vote > 0 && seg.vote < BEEPS){
      const every = seg.vote < 1 ? 0.25 : 1;
      if (Math.floor(was / every) !== Math.floor(seg.vote / every)) sfx.beep(seg.vote < 1);
    }
    const votes = [[], []], who = [[], []];
    for (const i of this.here){
      const rn = this.crew[i];
      rn.door = this.doorOf(rn.x, rn.door);
      votes[rn.door].push(PLAYER_COLORS[i]); who[rn.door].push(i);
    }
    seg.votes = votes;
    if (seg.vote <= 0) this._decide(who);
  }
  doorOf(x, was = null){
    /* Moving on from a door: only once clearly past the line. */
    if (was != null && Math.abs(x) < DOOR_EDGE) return was;
    return x < 0 ? 0 : 1;
  }
  _decide(who){
    const seg = this.seg, most = Math.max(...who.map(w => w.length));
    const tied = [0, 1].filter(d => who[d].length === most);
    const mine = this.doorOf(this.crew[this.guide].x);
    const door = tied.length === 1 ? tied[0] : tied.includes(mine) ? mine : tied[Math.floor(Math.random() * tied.length)];
    seg.choice = door; this.doors.push(door);
    seg.room = seg.kinds[door] === 'mystery' ? this.mystery() : seg.kinds[door];
    sfx.thud(); sfx.whoosh();
    if (seg.kinds[door] === 'elite'){ sfx.stinger(); this.shake = Math.max(this.shake, 0.6); }
  }
  /* What's behind the ? door. Treasure is only ever found this way. */
  mystery(r = Math.random()){
    for (const [kind, w] of MYSTERY){ if (r < w) return kind; r -= w; }
    return MYSTERY[0][0];
  }

  /* ---------- little things ---------- */

  _sparkle(x, y, n, hue){
    for (let k = 0; k < n; k++){
      const a = Math.random() * 6.28, s = 0.1 + Math.random() * 0.15;
      this.bits.push({ kind: 'spark', x, y, vx: Math.cos(a) * s * 0.56, vy: Math.sin(a) * s - 0.05, age: 0, life: 0.7, hue });
    }
    if (this.bits.length > 300) this.bits.splice(0, this.bits.length - 300);
  }
  _stepBits(dt){
    this.xpPulse = Math.max(0, this.xpPulse - dt * 4);
    for (const f of this.flyers){
      f.t += dt;
      if (f.t >= f.dur && !f.in){ f.in = true; this.addXp(f.xp); this.xpPulse = 1; sfx.nibble(); }
    }
    this.flyers = this.flyers.filter(f => !f.in);
    for (const b of this.bits){ b.age += dt; if (b.vx != null) b.x += b.vx * dt; if (b.vy != null) b.y += b.vy * dt; }
    this.bits = this.bits.filter(b => b.age < b.life);
  }

  /* ---------- the ending ---------- */

  /* The ending: through the last corridor, cheering - or, with the whole
     crew asleep in a fight, sleeping where they lie, robots and all. */
  outro(dt, W, H){
    if (!this.out){
      /* The score, and whether it beats the best for this many players
         (the console keeps it once the round's over). */
      const n = Math.max(1, this.crew.filter(r => r.played).length), score = this.value();
      this.out = { t: 0, scene: story.on ? new Scene(this.lost ? 'lost' : 'won', this) : null,
        score, best: scores.best(def.id, n), counted: 0 };
      if (this.lost) sfx.lose(); else sfx.fanfare();
    }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.faces.step(dt);
    /* With the story: the ending scene, till it's done. */
    /* The tally ticking up, line by line. */
    const lines = this.tallyLines().length, at = Math.min(lines, Math.floor(o.t / TALLY_STEP));
    if (at > o.counted){ o.counted = at; if (at === lines) sfx.gold(); else sfx.tick(); }
    const tallied = o.t > lines * TALLY_STEP + TALLY_COUNT + 1.5;
    if (o.scene){ o.scene.step(dt); this._stepBits(dt); return o.scene.done && tallied; }
    if (this.lost){ this._stepBits(dt); return o.t > 4; }
    this.speed = Math.max(0, this.speed - dt * 0.3);
    this.z += this.speed * dt;
    for (const rn of this.crew){ rn.duck = 0; rn.air = Math.abs(Math.sin(o.t * 5)) * 0.25; }
    if (Math.random() < dt * 25) this._sparkle(Math.random(), 0.2 + Math.random() * 0.5, 1, (Math.random() * 360) | 0);
    this._stepBits(dt);
    return o.t > 5;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    /* The scenes: the opening, the ending, each its own picture; the
       others over the play, darkened. */
    const sc = this.scene || (this.out && this.out.scene);
    if (sc && (sc.kind === 'opening' || sc.kind === 'won' || sc.kind === 'lost')){
      if (sc.kind === 'opening') drawOpening(c, W, H, sc.t);
      else drawEnding(c, W, H, this.out.t, sc.kind === 'won');
      sc.draw(c, W, H);
      if (this.out) this._drawTally(c, W, H);
      return;
    }
    this._drawPlay(c, W, H);
    if (sc){ drawBossRising(c, W, H, sc.t); sc.draw(c, W, H); return; }
    if (this.levelup) this.levelup.draw(c, W, H);
    this.captain.draw(c, W, H);
  }

  _drawPlay(c, W, H){
    /* The treasure room is its own picture: the players in it. */
    if (this.treasure){
      c.save(); this.treasure.view(c, W, H); this._drawBits(c, W, H); c.restore();
      this._drawHud(c, W, H);
      return;
    }
    /* A trap room has its own view, from up high. */
    if (this.trap){
      c.save();
      if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake * H * 0.02, 0);
      this.trap.draw(c, W, H, (i, x, y, h, bob) => this._drawCrew(c, i, W, H, { x, y, h, bob }));
      this._drawBits(c, W, H);
      c.restore();
      this._drawHud(c, W, H);
      return;
    }
    c.save();
    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake * H * 0.02, (Math.random() - 0.5) * this.shake * H * 0.02);
    /* Closing in on the doors. */
    if (this.zoom > 0){
      const e = this.zoom * this.zoom * (3 - 2 * this.zoom), z = 1 + (ZOOM - 1) * e, py = H * 0.66;
      c.translate(W / 2, py); c.scale(z, z); c.translate(-W / 2, -py);
    }
    const seg = this.seg;
    this._bend();
    if (this.boss) this.boss.arena(c, W, H, this.t);
    else drawCorridor(c, W, H, this.z, this.t, seg.kind === 'cross' ? 0.4 : this.fight && !this.fight.done ? 0.3 : 0);
    /* Springs are part of the floor: under everything, there all the way
       along until the last of them has gone by. */
    for (const th of this.things) if (th.kind === 'fountain'){
      const rel = th.d - this.z, len = th.len || SPRING_LEN;
      if (rel < 1 && rel + len > -0.12) drawFountain(c, W, H, rel, th.lane, this.t, len);
    }
    const items = [];
    for (const th of this.things) if (!th.got && th.kind !== 'fountain') items.push({ ...th, rel: th.d - this.z });
    if (seg.kind === 'cross') items.push({ kind: 'doors', rel: seg.wall - this.z });
    if (this.fight) for (const b of this.fight.bots) if (!b.part) items.push({ kind: 'bot', rel: b.d, lane: b.x, b });
    if (this.boss) this.boss.items(items);
    if (this.depot) this.depot.items(items);
    for (let i = 0; i < this.players; i++) if (this.crew[i].played) items.push({ kind: 'crew', rel: RUN, i });
    if (this.fight && !this.fight.done) items.push({ kind: 'team', rel: RUN + 0.001 });
    items.sort((a, b) => b.rel - a.rel);
    for (const it of items){ if (it.rel > 1 || it.rel < -0.12) continue; this._drawItem(c, it, W, H); }
    drawGloom(c, W, H);
    if (seg.kind === 'room') this._drawRoom(c, W, H);
    this._drawBits(c, W, H);
    if (this.depot) this.depot.draw(c, W, H);
    c.restore();
    this._drawHud(c, W, H);
  }

  /* The path's bends, for the look: gentle curves along a corridor, a
     sharp turn swinging round once in a while; straight for the rooms. */
  _bend(){
    const seg = this.seg;
    let curve = 0, corner = null, dir = 1;
    if (!this.boss){
      const want = seg.kind === 'corridor' ? 0.6 * Math.sin(this.z * 0.35) + 0.35 * Math.sin(this.z * 0.9 + 1) : 0;
      this.curveNow = (this.curveNow || 0) + (want - (this.curveNow || 0)) * 0.05;
      curve = this.curveNow;
      const cn = seg.corner;
      if (cn){
        const rel = cn.d - this.z;
        if (rel > RUN){ corner = rel; dir = cn.dir; }
        else {
          if (cn.at == null){ cn.at = this.t; turn(cn.dir); }
          const f = 1 - (this.t - cn.at);
          if (f > 0){ corner = RUN; dir = cn.dir * f * f; }
        }
      }
    }
    setBend(curve, corner, dir);
  }

  _drawItem(c, it, W, H){
    const p = P(it.lane || 0, it.rel, W, H);
    switch (it.kind){
      case 'blocker': drawBlocker(c, W, H, it.rel, it.a, it.b, this.t, it.seed); break;
      case 'beam': if (it.rel > RUN) drawBeam(c, W, H, it.rel, this.t); break;
      case 'gap': case 'ledge': drawGap(c, W, H, it.rel, it.a, it.b, this.t); break;
      case 'crystal': drawCrystal(c, p.x, p.y - H * (it.high ? 0.3 : 0.11) * p.k, H * 0.022 * p.k, this.t + it.d * 9); break;
      case 'doors': this._drawDoors(c, W, H, it.rel); break;
      case 'bot': this._drawBot(c, it.b, W, H); break;
      case 'team': this._drawTeam(c, W, H); break;
      /* The boss's own things draw themselves. */
      case 'boss': it.draw(c, W, H, this.t); break;
      case 'crew': this._drawCrew(c, it.i, W, H); break;
    }
  }

  _drawDoors(c, W, H, rel){
    const seg = this.seg;
    drawDoors(c, W, H, rel, this.t, seg.kinds, seg.votes, seg.choice, seg.opening);
    /* The time left: a bar draining along the foot of the doorway wall. */
    if (seg.choice == null && seg.wall - this.z <= DOOR_STOP + 0.02){
      const l = P(-1, rel, W, H), r = P(1, rel, W, H), y = l.y - H * 0.03 * l.k, u = clamp(seg.vote / VOTE, 0, 1);
      c.fillStyle = 'rgba(5,6,15,.8)'; c.fillRect(l.x, y, r.x - l.x, H * 0.018);
      c.fillStyle = u < 0.3 ? '#ff5b5b' : '#7ff3ff'; c.fillRect(l.x, y, (r.x - l.x) * u, H * 0.018);
    }
  }

  _drawBot(c, b, W, H){
    const p = P(b.x, b.d, W, H);
    (b.kind === 'beast' ? drawBeast : drawRustbot)(c, p.x, p.y, H * 0.14 * p.k * (b.size || 1), this.t + b.seed, { swing: b.swing, flash: b.flash, hp: b.hp / b.max });
  }

  /* In a fight, teammates standing together are joined along the floor:
     they're hitting harder for it. */
  _drawTeam(c, W, H){
    const up = this.here.filter(i => !this.crew[i].down);
    c.save(); c.lineCap = 'round';
    for (const i of up) for (const j of up){
      if (j <= i || Math.abs(this.crew[i].x - this.crew[j].x) > BUDDY) continue;
      const a = P(this.crew[i].x, RUN, W, H), b = P(this.crew[j].x, RUN, W, H);
      c.globalAlpha = 0.45 + 0.2 * Math.sin(this.t * 6);
      c.strokeStyle = '#7ff3ff'; c.lineWidth = H * 0.016;
      c.beginPath(); c.moveTo(a.x, a.y - H * 0.01); c.lineTo(b.x, b.y - H * 0.01); c.stroke();
    }
    c.restore();
  }

  /* at: { x, y, h, bob } to draw them somewhere else - a trap room's own
     view - instead of at their place in the corridor. */
  _drawCrew(c, i, W, H, at = null){
    const rn = this.crew[i], here = pose.players[i].present;
    const p = at || P(rn.x, RUN, W, H), h = at ? at.h : H * CREW_SIZE;
    drawCrew(c, p.x, p.y, h, this.t + i * 0.37, PLAYER_COLORS[i],
      { air: rn.air * h * 0.55 + (at ? at.bob : 0), duck: rn.duck, lean: rn.lean, hit: rn.hit, heal: rn.heal || 0, run: rn.run || 0, runPh: rn.runPh || 0, blink: rn.safe > 0, lost: !here, photo: here && this.faces.has(i), down: rn.down },
      (x, y, r) => {
        if (here && this.faces.has(i)) this.faces.draw(c, i, x, y, r, PLAYER_COLORS[i]);
        else drawKid(c, x, y + r * 0.1, r, this.t + i, KID_SKINS[i]);
      });
    /* Hitting out: a ring bursting along the floor, as far as they reach. */
    if (this.fight && rn.swing > 0){
      const m = arms(rn).melee, l = P(rn.x - m.reach, RUN, W, H), r = P(rn.x + m.reach, RUN, W, H);
      drawPulse(c, p.x, p.y, (r.x - l.x) / 2, rn.swing, PLAYER_COLORS[i], rn.buddies > 0, m.style, this.t);
    }
    if (rn.down){ drawZzz(c, p.x - h * 0.2, p.y - h * 0.35, h * 0.3, this.t + i); return; }
    /* Their health over their head; the guide's crown at a crossroads. */
    const top = p.y - rn.air * h * 0.55 - h * (1 - rn.duck * 0.45);
    drawHealth(c, p.x, top - H * 0.03, h * 0.53, rn.hp / rn.max, PLAYER_COLORS[i], rn.hp / rn.max < 0.3);
    if (this.seg.kind === 'cross' && i === this.guide) drawCrown(c, p.x, top - H * 0.065, H * 0.022, this.t);
  }

  /* Stage 1: a room is its sign, big in the doorway, as the crew pass
     through. */
  _drawRoom(c, W, H){
    const kind = this.seg.room;
    /* A fight shows its sign as each wave starts. */
    const u = this.fight ? clamp(this.fight.banner / 0.4, 0, 1) * clamp((1.6 - this.fight.banner) / 0.3, 0, 1)
      : clamp(this.seg.t / 0.4, 0, 1) * clamp((this.seg.len - this.seg.t) / 0.4, 0, 1);
    const s = { combat: ['skull', '#ff5b5b'], elite: ['skull', '#ff5b5b'], traps: ['spikes', '#ffc531'], treasure: ['mystery', '#ffd24a'] }[kind] || ['mystery', '#c46bff'];
    c.save(); c.globalAlpha = u;
    sign(c, s[0], W / 2, H * 0.36, H * 0.1 * (0.8 + 0.2 * u), s[1], this.t);
    c.restore();
  }

  /* Where the XP bar's crystal sits, top right: where picked-up crystals
     fly to. */
  _xpAt(W, H){ return { x: W - H * 0.42, y: H * 0.07 }; }

  _drawHud(c, W, H){
    /* Danger at the edges: a red flash on a hit, a red glow pulsing with
       the heartbeat while anyone's nearly out. */
    {
      const beat = this.low > 0 ? Math.exp(-(this.t - (this.beatAt ?? -9)) * 5) : 0;
      const a = Math.max(this.redFlash || 0, this.low * (0.25 + 0.35 * beat));
      if (a > 0.01){
        const g = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
        g.addColorStop(0, 'rgba(255,40,40,0)'); g.addColorStop(1, `rgba(255,30,30,${Math.min(0.6, a * 0.6)})`);
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
    }
    /* The boss's health, big across the top. */
    if (this.boss && !this.boss.done) this.boss.hud(c, W, H);
    /* The team's level and XP, top right: a crystal, the level, the bar
       filling - flashing as crystals land in it. */
    {
      const at = this._xpAt(W, H), x0 = at.x - H * 0.045, x1 = W - H * 0.04, y = at.y, pulse = this.xpPulse;
      const bx = at.x + H * 0.13, bw = x1 - H * 0.025 - bx, bh = H * 0.02;
      c.save();
      c.fillStyle = 'rgba(5,6,15,.75)'; c.beginPath(); c.roundRect(x0, y - H * 0.04, x1 - x0, H * 0.08, H * 0.04); c.fill();
      drawCrystal(c, at.x, y, H * 0.022 * (1 + 0.35 * pulse), this.t);
      c.font = `700 ${Math.round(H * 0.038)}px Fredoka, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = '#e9e3ff'; c.fillText(`LV ${this.lvl}`, at.x + H * 0.035, y + H * 0.003);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.roundRect(bx, y - bh / 2, bw, bh, bh / 2); c.fill();
      c.fillStyle = pulse > 0 ? `rgb(${Math.round(127 + 128 * pulse)},${Math.round(243 + 12 * pulse)},255)` : '#7ff3ff';
      c.beginPath(); c.roundRect(bx, y - bh / 2, Math.max(bh, bw * Math.min(1, this.xp / needFor(this.lvl))), bh, bh / 2); c.fill();
      /* Under it, a star for each level up waiting to be picked - gold for a gold pick. */
      const stars = '\u2605'.repeat(Math.min(5, this.golds));
      c.textAlign = 'right'; c.font = `700 ${Math.round(H * 0.03)}px Fredoka, sans-serif`;
      if (this.pending > 0){ c.fillStyle = '#e9e3ff'; c.fillText('\u2605'.repeat(Math.min(5, this.pending)), x1 - H * 0.02, y + H * 0.065); }
      if (this.golds > 0){ c.fillStyle = '#ffd24a'; c.fillText(stars, x1 - H * 0.02 - (this.pending > 0 ? H * 0.03 * Math.min(5, this.pending) : 0), y + H * 0.065); }
      c.restore();
    }
    /* The floor, as a row of pips along the top: where the crew are. */
    const plan = this.level.plan, n = plan.length - 1, w = H * 0.034;
    for (let k = 0; k < n; k++){
      const px = W / 2 + (k - (n - 1) / 2) * w * 1.6, done = k < this.step_, now = k === this.step_, kind = plan[k];
      c.fillStyle = done ? '#7ff3ff' : now ? '#fff6e2' : 'rgba(255,255,255,.25)';
      c.beginPath();
      if (kind === 'corridor') c.roundRect(px - w * 0.6, H * 0.055 - w * 0.2, w * 1.2, w * 0.4, w * 0.2);
      else if (kind === 'boss') c.arc(px, H * 0.055, w * (now ? 0.55 : 0.45), 0, 6.2832);
      else c.arc(px, H * 0.055, w * (now ? 0.36 : 0.28), 0, 6.2832);
      c.fill();
    }
    this._drawFlyers(c, W, H);
  }

  /* Crystals zooming to the XP bar: a curve up and across, quickening,
     shrinking, a faint trail behind. */
  _drawFlyers(c, W, H){
    if (!this.flyers.length) return;
    const to = this._xpAt(W, H);
    const at = (f, u) => {
      const x0 = f.x * W, y0 = f.y * H, cx = (x0 + to.x) / 2 + f.bend * H * 0.12, cy = Math.min(y0, to.y) - H * 0.08;
      const v = u * u * (3 - 2 * u), a = (1 - v) * (1 - v), b = 2 * (1 - v) * v, d = v * v;
      return [a * x0 + b * cx + d * to.x, a * y0 + b * cy + d * to.y];
    };
    for (const f of this.flyers){
      const u = Math.min(1, f.t / f.dur), s = H * (f.big ? 0.03 : 0.009) * (1 - 0.45 * u);
      /* Only the first few leave a trail; the rest are just a quick glint. */
      if (f.big) for (let k = 3; k >= 1; k--){
        const [tx, ty] = at(f, Math.max(0, u - k * 0.06));
        c.fillStyle = `rgba(127,243,255,${0.18 * (4 - k) / 3})`; c.beginPath(); c.arc(tx, ty, s * (1 - k * 0.2), 0, 6.2832); c.fill();
      }
      for (let j = 0; j < f.n; j++){
        const [x, y] = at(f, Math.max(0, u - j * 0.04));
        if (j && !f.big) break;
        drawCrystal(c, x + (j % 2 ? 1 : -1) * j * s * 0.5, y, s * (j ? 0.7 : 1), this.t + j);
      }
    }
  }

  _drawBits(c, W, H){
    for (const b of this.bits){
      const k = b.age / b.life;
      if (b.kind === 'spark'){
        c.fillStyle = `hsla(${b.hue},100%,70%,${1 - k})`;
        c.beginPath(); c.arc(b.x * W, b.y * H, H * 0.007 * (1 - k * 0.5), 0, 6.2832); c.fill();
      } else if (b.kind === 'heart'){
        const x = b.x * W, y = b.y * H, s = H * 0.014;
        c.save(); c.globalAlpha = 1 - k; c.fillStyle = '#ff7eb6';
        c.beginPath(); c.moveTo(x, y + s); c.bezierCurveTo(x - s * 2, y - s * 0.5, x - s * 0.8, y - s * 1.8, x, y - s * 0.6);
        c.bezierCurveTo(x + s * 0.8, y - s * 1.8, x + s * 2, y - s * 0.5, x, y + s); c.fill();
        c.restore();
      } else if (b.kind === 'shot'){
        c.save(); c.globalAlpha = 1 - k; c.strokeStyle = '#7ff3ff'; c.lineWidth = H * 0.012 * (1 - k * 0.5); c.lineCap = 'round';
        c.beginPath(); c.moveTo(b.x * W, b.y * H); c.lineTo(b.x2 * W, b.y2 * H); c.stroke();
        c.restore();
      } else if (b.kind === 'num'){
        c.save(); c.globalAlpha = 1 - k;
        c.font = `700 ${Math.round(H * (b.small ? 0.028 : 0.045))}px Fredoka, sans-serif`; c.textAlign = 'center';
        c.lineWidth = H * 0.008; c.strokeStyle = '#05060f'; c.strokeText(b.text, b.x * W, b.y * H);
        c.fillStyle = b.col || '#ff6b6b'; c.fillText(b.text, b.x * W, b.y * H);
        c.restore();
      }
    }
  }

  hud(){ return { score: pose.players.map(() => this.crystals), showLives: false, hideScore: true, hideClock: true }; }
  /* The tally: what the score's made of - each [picture, count, worth]. */
  tallyLines(){
    return [['\u{1F48E}', this.crystals, this.crystals], ['\u{1F916}', this.kills, this.kills * SCORE.kill], ['\u{1F451}', this.bosses, this.bosses * SCORE.boss]];
  }

  /* At the end, over the scene: the crystals, the knockouts and the boss,
     each counting up in turn, then the score. (Bests are kept, not
     announced - like the rest of the console.) */
  _drawTally(c, W, H){
    const o = this.out, lines = this.tallyLines(), x = W * 0.62, w = W * 0.32, lh = H * 0.085, y0 = H * 0.36;
    const up = (k) => clamp((o.t - k * TALLY_STEP) / TALLY_COUNT, 0, 1);
    c.save();
    c.fillStyle = 'rgba(5,6,15,.72)'; c.beginPath(); c.roundRect(x - w * 0.08, y0 - lh * 0.8, w * 1.16, lh * (lines.length + 2.4), H * 0.03); c.fill();
    c.textBaseline = 'middle';
    lines.forEach(([icon, count, worth], k) => {
      if (o.t < k * TALLY_STEP) return;
      const u = up(k), y = y0 + k * lh;
      c.font = `${Math.round(lh * 0.55)}px sans-serif`; c.textAlign = 'left'; c.fillStyle = '#ffffff'; c.fillText(icon, x, y);
      c.font = `700 ${Math.round(lh * 0.48)}px Fredoka, sans-serif`;
      c.fillStyle = '#cfd6f5'; c.fillText(`\u00D7 ${Math.round(count * u)}`, x + lh * 0.9, y);
      c.textAlign = 'right'; c.fillStyle = '#ffffff'; c.fillText(String(Math.round(worth * u)), x + w, y);
    });
    if (o.t >= lines.length * TALLY_STEP){
      const u = up(lines.length), y = y0 + lines.length * lh + lh * 0.3;
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x, y - lh * 0.55, w, 3);
      c.font = `700 ${Math.round(lh * 0.7)}px Fredoka, sans-serif`; c.textAlign = 'right'; c.fillStyle = '#ffd24a';
      c.fillText(String(Math.round(o.score * u)), x + w, y + lh * 0.1);
      if (u >= 1 && o.score > o.best){
        c.textAlign = 'left'; c.font = `700 ${Math.round(lh * 0.45)}px Fredoka, sans-serif`;
        c.fillStyle = `hsl(${(o.t * 200) % 360},90%,65%)`; c.fillText('NEW BEST!', x, y + lh * 0.1);
      }
    }
    c.restore();
  }

  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) if (this.crew[i].played || pose.players[i].present) rows.push({ label: `Player ${i + 1}`, value: this.value(), color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.crew.filter(r => r.played).length < 2 ? null : -1; }
  /* The score: crystals, plus knockouts and bosses (SCORE). */
  value(){ return this.crystals + this.kills * SCORE.kill + this.bosses * SCORE.boss; }
}
