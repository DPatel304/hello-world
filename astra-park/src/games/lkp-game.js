import { clamp, scores } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';
import { JumpWatch } from '../tracking/jump.js';
import { farStir, worldTrail, turn, resetView, tree, worldLog, glow, CLEAR as CLEARINGS, ROAD, roadHalf, PATH_HALF, SKY } from './lkp-world.js';
import { Zip, worldZipStart, hangY, ZIP_SPEED, RIDE, LAND, DROP, COUNT, CABLE } from './lkp-zip.js';
import { ClapWatch, HugWatch } from '../tracking/gestures.js';
import { drawGuide, stepGuide } from './lkp-guide.js';
import { TeamJump } from './lkp-leap.js';
import { Ride } from './lkp-ride.js';
import { Roll, SNAP_AT, HOLD as SNAP_HOLD, FLY as SNAP_FLY } from './lkp-roll.js';
import { worldCrewFront } from './lkp-cast.js';
import { P, RUN, DOORS, setBend, drawCorridor, drawGloom, drawBlocker, drawBeam, drawGap, drawCrystal, drawFountain,
         drawDoors, drawCrown, sign, drawCrew, drawHealth, drawRustbot, drawBeast, drawPulse, drawZzz, setPalette, PAL } from './lkp-art.js';
import { Fight, BUDDY } from './lkp-combat.js';
import { arms, armored, take, KNIFE } from './lkp-weapons.js';
import { Lights } from './lkp-trap.js';
import { Warden } from './lkp-boss.js';
import { Scout } from './lkp-scout.js';
import { Intro } from './lkp-intro.js';
import { worldShip, worldWreck } from './lkp-places.js';
import { worldLake, worldLakeAhead, wading, healRipple, LAKE, worldMeadow, shipFire, pondBeauty, SITE } from './lkp-crashsite.js';
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
/* The choosing screens, on or off. Off (for now, while they're
   reworked): a level up is more health for everyone, straight away; and
   at the depot everyone's handed a knife. */
export const PICKING = { levelUp: false, weapon: false };

/* While we playtest the mechanics, every part of the run is PLAYTEST
   seconds long - each corridor, and at most each fight - so it's quick
   to try everything. 0 for the full lengths. */
export const PLAYTEST = 0;
const FULL = [86, 50, 36, 52, 40];                      /* seconds of each corridor, in full */
/* The first corridor starts quiet - LEAD seconds of just running, out of
   the crash site - before anything comes along. */
export const LEAD = 10;
/* Up from the crash, they set off walking - WALK_HOLD seconds of an easy
   walk (WALK_PACE of full speed), while Nova talks them through it - then
   picking up speed, to a run by WALK_IN seconds. */
export const WALK_IN = 24, WALK_HOLD = 12, WALK_PACE = 0.32;
/* The crash site at the start of the first corridor [lane, depth, size]. */
/* (the crash site's layout: lkp-crashsite.js SITE) */
export const CRASH = SITE;
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
/* A breather after each room's done, before the run goes on (seconds):
   time for "Room clear!" and a look round. */
export const AFTER = { fight: 3.5, trap: 3, treasure: 2.5, roll: 0.5 };
/* The tally at the end: each line's turn to count up, and how long. */
const TALLY_STEP = 0.9, TALLY_COUNT = 0.7;
/* A line from the level's script, for the captain: [who, text, words] -> (text, words). */
const line = (l) => [l[1], l[2] || ''];
/* A rolling boulder: how wide (lanes, either side of its middle), and how
   fast it rolls across - lanes for each bit of depth still to come. */
export const ROLLER = 0.24, ROLL = 3.2;
/* The path squeezing: how wide (lanes either side) at its narrowest and
   its widest. */
export const NARROW = 0.55, WIDE = 2.1;
/* In a rescue bubble (missed the zip line): claps from teammates close by
   to pop it, how close (lanes), and the health they're back on. */
export const BUBBLE_CLAPS = 4, BUBBLE_R = 0.6, BUBBLE_HP = 0.5;
/* The healing pond stop: its size (lanes), how much health a second it
   heals (twice that hugging), and the longest it waits. */
export const REST_POND = 1.3, REST_FILL = 0.12, REST_MAX = 25;
/* At the pond they stay at least REST_MIN seconds, healed or not: a
   pause to look round - the camera tilting up to the sky and the land,
   VIEW_EASE seconds to get there and back. */
export const REST_MIN = 9, VIEW_EASE = 2.5;
/* Something big, far off, while they rest - never seen: the woods on
   the far ridge stirring as it pushes through them, from ZUBU_FAR[0]
   seconds in, for ZUBU_FAR[1]; a deep footfall every STEP_EVERY seconds,
   rippling the water; then its call. */
export const ZUBU_FAR = [2.5, 9], STEP_EVERY = 1.3;
/* The team jump: how deep the gorge (depths; a wider one before the
   boss). (The jump itself: lkp-leap.js.) */
export const RAVINE = 0.42, RAVINE_BIG = 0.56;
const rollerLane = (th, rel) => th.end - th.dir * Math.max(0, rel - RUN) * ROLL;
export const HURT = { blocker: 10, beam: 10, gap: 20, ledge: 10, roller: 12 };   /* ledge: a breach across part of the floor */
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
    /* The opening: down from space onto the crash site, waking up, Nova's call, the pond (lkp-intro.js). */
    this.scene = story.on ? new Intro(this) : null;
    this.jumps = new JumpWatch({ rise: HOP_RISE, speed: HOP_SPEED, feet: true });
    this.heads = pose.players.map(() => null);
    this.crew = pose.players.map((_, i) => ({ x: 0, lean: 0, air: 0, airV: 0, duck: 0, lastDuck: -9, hp: MAX_HP, max: MAX_HP, down: false, safe: 0, hit: 0, played: false, falling: 0, fall: null, bubble: null }));
    this.clapWatch = pose.players.map(() => new ClapWatch());
    this.hugWatch = pose.players.map(() => new HugWatch());
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
    const plan = this.level.plan, step = plan[this.step_] || 'end';
    /* (the tutorial fight: a combat room, straight in - no fork) */
    const kind = step === 'tutorial' ? 'room' : step;
    if (step === 'tutorial') this.rooms.push('tutorial');
    this.seg = { kind, t: 0 };
    /* (any rescue bubbles still up pop at the fork) */
    if (kind !== 'corridor') for (const i of this.here) if (this.crew[i].bubble) this._pop(i);
    this.fight = null; this.trap = null; this.boss = null; this.depot = null; this.treasure = null; this.ride = null; this.roll = null;
    if (kind === 'corridor'){
      const n = plan.slice(0, this.step_ + 1).filter(k => k === 'corridor').length - 1;
      this.seg.n = n;
      this.seg.len = CORRIDOR[n] || 45;
      this._layout(n);
    } else if (kind === 'cross'){
      /* The doors, coming up the corridor; the crew stop in front of them. */
      this.seg.wall = this.z + 0.9;
      this.seg.votes = [[], []];
      /* (no big fight at a first fork - unless a fight's been taught by then) */
      this.seg.kinds = twoDoors(!this.level.plan.slice(0, this.step_).some(k => k === 'cross' || k === 'tutorial'));
      this.seg.choice = null; this.seg.opening = 0;
      for (const rn of this.crew) rn.door = null;
      this.seg.vote = VOTE;
      this.guide = this._nextGuide();
    } else if (kind === 'room'){
      this.seg.room = this.rooms[this.rooms.length - 1];
      this.seg.len = ROOM_STUB;
      if (this.seg.room === 'tutorial') this.fight = new Fight(this, PLAYTEST || undefined, { tutorial: true });
      if (this.seg.room === 'combat' || this.seg.room === 'elite'){
        const elite = this.seg.room === 'elite';
        this.fight = new Fight(this, PLAYTEST || undefined, { elite });
      }
      /* A longer hall: twice the playtest time to get up it. */
      if (this.seg.room === 'traps') this.trap = PLAYTEST ? new Lights(this, PLAYTEST * 2) : new Lights(this);
      if (this.seg.room === 'treasure') this.treasure = new Treasure(this);
      sfx.whoosh();
    } else if (kind === 'sneak'){
      /* Sneaking past the giant, fast asleep across the glade: red light,
         green light (lkp-trap.js, outdoors) */
      this.trap = PLAYTEST ? new Lights(this, PLAYTEST * 2, { giant: true }) : new Lights(this, undefined, { giant: true });
      sfx.whoosh();
    } else if (kind === 'roll'){
      /* Zubu rolling down the hill after them in her sleep (lkp-roll.js) */
      this.things = [];
      this.roll = PLAYTEST ? new Roll(this, story.on, PLAYTEST) : new Roll(this, story.on);
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
    } else if (kind === 'ride'){
      /* Mossy, after the boss: catch up, climb on, sit and relax (lkp-ride.js) */
      this.things = [];
      this.ride = new Ride(this, story.on);
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
    const lead = n === 0 ? LEAD : 0;
    const at = (secs) => this.z + RUN + SPEED * (secs + lead) * squeeze + 0.9;   /* reaching the crew `secs` in */
    /* (a distance along, in this corridor's seconds) */
    const secsOf = (dist) => dist / (SPEED * squeeze);
    /* After the first, each corridor turns sharply once, halfway (for the
       look: it's automatic) - unless its event's there. */
    const plan = (this.level.corridors && this.level.corridors[n]) || {};
    const add = (secs, th) => this.things.push({ d: at(secs), ...th });
    const crystalLine = (secs, lane, k = 5) => { for (let i = 0; i < k; i++) add(secs + i * 0.3 / squeeze, { kind: 'crystal', lane }); };
    const side = () => (Math.random() < 0.5 ? -1 : 1);
    const blocker = (secs, s = side(), width = 0.9) => {
      const a = s < 0 ? -1.05 : 1.05 - width, b = a + width;
      add(secs, { kind: 'blocker', a, b, seed: Math.floor(Math.random() * 100) });
      crystalLine(secs - 0.6, s < 0 ? 0.6 : -0.6, 4);
    };
    const beam = (secs) => add(secs, { kind: 'beam' });
    const fountain = (secs, lane = 0) => add(secs, { kind: 'fountain', lane, used: new Set(), len: SPRING_LEN * squeeze });
    /* A log rolling across the path, from one side, as it comes: where it
       crosses the crew's line (end) is where not to be. */
    const roller = (secs) => { add(secs, { kind: 'roller', end: (Math.random() * 2 - 1) * 0.6, dir: side() }); crystalLine(secs + 0.8, 0, 3); };
    /* Set pieces: a few of one thing in a row, each its own little test.
       Each returns how long it takes. (No hopping: the only jump is the
       big one.) */
    const PIECES = {
      /* weaving: debris left, right, left, right */
      slalom: (s) => { const f = side(); for (let k = 0; k < 4; k++) blocker(s + k * 1.5, k % 2 ? f : -f, 0.7); return 6; },
      /* a run of low branches: duck, duck, duck */
      duckrun: (s) => { for (let k = 0; k < 3; k++) beam(s + k * 1.4); return 4.4; },
      /* logs rolling down the slope, one then another */
      logs: (s) => { roller(s); roller(s + 2.2); return 4.2; },
      /* an arc of crystals, across and back */
      arc: (s) => { for (let k = 0; k < 7; k++) add(s + k * 0.35, { kind: 'crystal', lane: Math.sin(k / 6 * Math.PI) * 0.8 * side() }); return 3; }
    };

    /* ---- the events ---- */
    const EVENTS = {
      /* The healing pond, right across the path: the run stops in it
         till everyone's healed (lkp-game.js _rest). */
      rest: (s) => {
        add(s, { kind: 'pond', lane: 0, r: REST_POND, rest: true, len: LAKE / 2 });
        CLEARINGS.push({ lane: 0, d: at(s), r: 99, depth: LAKE / 2 + 0.1 });
        return secsOf(LAKE) + 1;
      },
      /* The path squeezing narrow - everyone pushed together into the
         middle - then bursting open wide, crystals all over. */
      squeeze: (s) => {
        add(s - 1, { kind: 'narrow' });
        ROAD.spans.push({ d0: at(s), d1: at(s + 7), half: NARROW });
        crystalLine(s + 1, 0, 14);
        add(s + 7.5, { kind: 'wide' });
        ROAD.spans.push({ d0: at(s + 8.5), d1: at(s + 16), half: WIDE });
        for (let k = 0; k < 22; k++) add(s + 9 + k * 0.32, { kind: 'crystal', lane: (Math.random() * 2 - 1) * (WIDE - 0.3) });
        return 17;
      },
      /* A gorge right across the way: the team jump (lkp-leap.js) - slow
         motion, JUMP!, and if anyone does, they all fly across. */
      leap: (s) => {
        const len = plan.big ? RAVINE_BIG : RAVINE, d = at(s);
        add(s, { kind: 'ravine', len });
        ROAD.gaps.push({ d, len });
        return secsOf(len) + 2;
      },
      /* The zip line: counted in on the way (clear ground), everyone
         grabbing the one cable; then away over the valley, crystals
         hanging along it to swing for - and lower ones out wide, for
         anyone dangling. */
      zip: (s) => {
        const d = at(s + COUNT), ride = ZIP_SPEED * RIDE;
        add(s + COUNT, { kind: 'zip' });
        for (let k = 0; k * 0.1 < ride - 0.5; k++){
          const x = k * 0.1;
          /* (to one side then the other: lean into them) */
          this.things.push({ d: d + 0.5 + x, kind: 'crystal', lane: CABLE + (Math.sin(x * 2.5) < 0 ? -0.1 : 0.1), hang: true });
          if (k % 3 === 0) this.things.push({ d: d + 0.55 + x, kind: 'crystal', lane: CABLE + (Math.sin(x * 1.7 + 1) < 0 ? -0.18 : 0.18), hang: true, low: true });
        }
        return COUNT + secsOf(ride + (ZIP_SPEED + SPEED) / 2 * LAND) + 2;
      }
    };

    if (n === 0){
      /* Where they start: the crash site, off to the left of the path - the
         ship, a piece of it, the meadow and the woods round it, the
         healing pond by the path. They slide by as the crew set off.
         (CRASH; lkp-intro.js walks them from the pond onto the path.) */
      ROAD.spans.length = 0; ROAD.gaps.length = 0; ROAD.surfaces.length = 0;
      this.things.push({ d: this.z + CRASH.ship[1], kind: 'ship', lane: CRASH.ship[0], s: CRASH.ship[2] });
      this.things.push({ d: this.z + CRASH.wreck[1], kind: 'wreck', lane: CRASH.wreck[0], s: CRASH.wreck[2], n: 1 });
      this.things.push({ d: this.z, kind: 'meadow', len: 0.7 });
      CRASH.trees.forEach(([lane, rel], n) => this.things.push({ d: this.z + rel, kind: 'tree', lane, n: n + 70 }));
      CLEARINGS.length = 0;
      /* (the meadow round the ship kept clear of the path's trees: it came
         down in a clearing, not into the woods) */
      CLEARINGS.push({ lane: CRASH.ship[0], d: this.z + CRASH.ship[1], r: 2.4 });
      /* Nova's story, a piece at a time, in the quiet between her tips -
         the first two in the quiet start (LEAD), before anything comes */
      /* Each a good while after the tip before it, so she's never
         talking over herself - her story in the quiet between the
         lessons, each lesson in a quiet of its own. */
      /* (walking at first - WALK_IN - so these are placed by distance:
         at a walk they come slowly, as she talks; then faster and faster) */
      const atD = (dist) => this.z + RUN + dist;
      if (story.on) [0.05, 0.55, 1.05, 3.4].forEach((dist, k) => this.things.push({ d: atD(dist), kind: 'say', line: k }));
      /* nothing to dodge yet: just picking up speed, and crystals to catch */
      const lineD = (dist, lane, k = 5) => { for (let i = 0; i < k; i++) this.things.push({ d: atD(dist + i * 0.09), kind: 'crystal', lane }); };
      const arcD = (dist, dir) => { for (let k = 0; k < 7; k++) this.things.push({ d: atD(dist + k * 0.1), kind: 'crystal', lane: dir * Math.sin(k / 6 * Math.PI) * 0.7 }); };
      lineD(1.5, 0, 5); lineD(2.2, -0.5, 5); lineD(2.9, 0.5, 5); arcD(3.7, 1);
      for (let k = 0; k < 9; k++){ const d = 4.7 + k * 1.15; if (k % 3 === 2) arcD(d, k % 2 ? -1 : 1); else lineD(d, [0, -0.5, 0.5, 0.3, -0.3][k % 5], 6); }
      /* the path's own stretches (lkp-world.js ROAD.surfaces): old
         flagstones - a ruin's - through the squeeze; a boardwalk over the
         marshy ground into the pond; a mossy track out of it */
      ROAD.surfaces.push({ d0: at(37), d1: at(52), kind: 'flag' });
      let s = 41 + EVENTS[plan.event || 'squeeze'](41);
      ROAD.surfaces.push({ d0: Math.max(at(53.5), at(s + 1) - LAKE / 2 - 0.6), d1: at(s + 1) - LAKE / 2 + 0.02, kind: 'boards' });
      /* the healing pond: a stop, to heal up after the crash */
      s += EVENTS.rest(s + 1) + 1;
      ROAD.surfaces.push({ d0: at(s - 0.5), d1: at(s + 9), kind: 'moss' });
      beam(s + 1); blocker(s + 4.5, side(), 0.8); crystalLine(s + 6.5, 0, 5);
    } else {
      const hard = n === 1 ? 0.8 : 0.65;
      /* a stretch of mossy track, and one of old flagstones, along the way */
      const len = FULL[n] || 45;
      ROAD.surfaces.push({ d0: at(len * 0.12), d1: at(len * 0.3), kind: n % 2 ? 'moss' : 'flag' }, { d0: at(len * 0.62), d1: at(len * 0.8), kind: n % 2 ? 'flag' : 'moss' });
      crystalLine(3, 0, 5); blocker(6);
      /* the corridor before the glade: near its end, beside the path, a
         swathe of woods flattened - trees snapped - something huge came
         through here (a sign of the giant, unseen) */
      if (n === 1 && this.level.plan[this.step_ + 1] === 'sneak'){
        const tl = side() * 1.75, td = at(len - 12);
        this.things.push({ d: td, kind: 'trail', lane: tl });
        CLEARINGS.push({ lane: tl + Math.sign(tl) * 1.2, d: td + 0.05, r: 1.8 });
        if (story.on) this.things.push({ d: td - 0.25, kind: 'say', key: 'trail' });
      }
      let s = 9;
      const end = (FULL[n] || 45) - 3;
      /* The event: a little before halfway. */
      const ev = plan.event && EVENTS[plan.event], evAt = Math.round(end * 0.4);
      let evDone = !ev;
      if (!ev) this.seg.corner = { d: at((FULL[n] || 45) * 0.5), dir: side(), at: null };
      /* Springs to run into on the way: SPRINGS in the corridor, more in
         the last one before the boss - off to one side, so it's a lean. */
      const last = n === FULL.length - 1;
      const springs = Array.from({ length: last ? SPRINGS + 1 : SPRINGS }, (_, k) => s + 2 + (end - s - 2) * (k + 0.5) / (last ? SPRINGS + 1 : SPRINGS));
      /* The corridor's own set pieces, in turn, with single things between. */
      const pool = plan.pieces || ['slalom', 'duckrun', 'logs', 'arc'];
      for (let k = 0; s < end - 2; k++){
        if (!evDone && s >= evAt - 3){ evDone = true; s += ev(s) + 1; continue; }
        if (springs.length && s >= springs[0]){ fountain(s, side() * (0.4 + Math.random() * 0.3)); springs.shift(); s += 2; continue; }
        if (k % 2 === 0){ s += PIECES[pool[(k / 2) % pool.length]](s) + 2.6 * hard; continue; }
        const r = Math.random();
        if (r < 0.45) blocker(s, side(), 0.9); else if (r < 0.8) beam(s); else roller(s);
        s += 3.4 * hard + Math.random() * 1.5;
      }
      for (const at of springs) if (at < end) fountain(at, side() * 0.5);
    }
  }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    /* the pond's view: the camera easing up while they rest, back after */
    this.quake = Math.max(0, (this.quake || 0) - dt * 1.6);
    this.restCam = Math.max(0, Math.min(1, (this.restCam || 0) + (this.rest && this.rest.t > 0.8 ? 1 : -1) * dt / VIEW_EASE));
    this.t += dt;
    stepGuide(this, dt);
    this.faces.step(dt);
    this.captain.step(dt);
    /* A scene: nothing else moves till it's done. */
    if (this.scene){
      this.scene.step(dt);
      if (this.scene.done){ if (this.scene.kind === 'intro') this.walkIn = 0; this.scene = null; }
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
    /* (no choosing: each level up straight to more health, all round) */
    if (!PICKING.levelUp && (this.golds > 0 || this.pending > 0)){ this._moreHealth(); return; }
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
    if (seg.kind === 'sneak') want = 0;
    /* A corridor's event: the zip line holds still, then flies; the big
       jump slows everything while they're in the air. (The corridor waits
       for it.) */
    if (seg.kind === 'corridor'){
      this._events(dt, W, H);
      /* off from the crash site: walking at first, building up to a run */
      if (this.walkIn != null && this.walkIn < WALK_IN){ this.walkIn += dt; const u = Math.max(0, Math.min(1, (this.walkIn - WALK_HOLD) / (WALK_IN - WALK_HOLD))); want *= WALK_PACE + (1 - WALK_PACE) * u * u * (3 - 2 * u); }
      this._bubbles(dt, W, H);
      if (this.zip) want = this.zip.speed(SPEED);
      else if (this.leap) want = this.leap.speed(SPEED);
      else if (this.rest) want = 0;
      /* (the corridor waits for slow going: the walk at the start, too) */
      if (this.zip || this.leap || this.rest || (this.walkIn != null && this.walkIn < WALK_IN)) seg.len += dt * (1 - this.speed / SPEED);
    }
    if (seg.kind === 'boss') want = 0;
    if (seg.kind === 'ride') want = this.ride ? this.ride.speed(SPEED) : SPEED;
    if (seg.kind === 'roll') want = this.roll ? this.roll.speed(SPEED) : 0;
    /* (running on up to the depot, slowing to a stop at it) */
    if (seg.kind === 'depot') want = this.depot ? this.depot.speed(SPEED) : 0;
    this.speed += (want - this.speed) * Math.min(1, dt * (this.rest || this.leap ? 10 : 4));
    const before = this.z;
    this.z += this.speed * dt;
    const jumped = this.jumps.step(dt, pose.players, this.players);
    /* The team jump: who's jumped; once they've flown, over the gorge. */
    if (seg.kind === 'corridor' && this.leap){
      this.leap.step(dt, jumped);
      if (this.leap.across){ this.leap.across = false; this.z = this.leap.th.d + this.leap.th.len + 0.02 - RUN; }
    }
    for (let i = 0; i < this.players; i++) this._move(i, dt, jumped.includes(i), W, H);
    if (seg.kind === 'corridor'){ this._pass(before, W, H); if (seg.t >= seg.len && !this.zip && !this.leap && !this.rest) this._next(); }
    else if (seg.kind === 'cross') this._vote(dt);
    else if (this.ride){ this.ride.step(dt, W, H); if (this.ride.done) this._next(); }
    else if (this.roll){ this.roll.step(dt, W, H); if (this.roll.done && this.roll.clearT > AFTER.roll) this._next(); }
    else if (this.boss){ this.boss.step(dt, W, H, jumped); if (this.boss.done && this.boss.clearT > 2.5) this._next(); }
    else if (this.fight){ this.fight.step(dt, W, H, jumped); if (this.fight.done && this.fight.clearT > AFTER.fight) this._next(); }
    else if (this.trap){ this.trap.step(dt, W, H); if (this.trap.done && this.trap.clearT > AFTER.trap) this._next(); }
    else if (this.treasure){ this.treasure.step(dt, W, H); if (this.treasure.done && this.treasure.clearT > AFTER.treasure) this._next(); }
    else if (this.depot){
      this.depot.step(dt, W, H);
      /* Woken: the robots speak - and then, everyone picks their weapon. */
      if (this.depot.done){
        this._next();
        if (story.on) this.scene = new Scene('waking', this);
        if (PICKING.weapon){ this.levelup = meleePick(this, PLAYTEST || PICK_TIME); this.levelup.weapon = true; }
        else for (const rn of this.crew) rn.melee = KNIFE;
      }
    }
    else if (seg.kind === 'room' && seg.t >= seg.len) this._next();
    this.things = this.things.filter(th => th.d + (th.len || 0) - this.z > -0.15);
    this._stepBits(dt);
  }

  /* ---------- the corridors' events ---------- */

  _events(dt, W, H){
    /* The zip line: counted in on the way up to it; when they've landed,
       on they run. */
    if (!this.zip){
      const th = this.things.find(t => t.kind === 'zip' && !t.taken && t.d - this.z - RUN <= SPEED * COUNT);
      if (th){ th.taken = true; this.zip = new Zip(this, th); }
    }
    if (this.zip){
      this.zip.step(dt, W, H);
      if (this.zip.done) this.zip = null;
    }
    /* The team jump: coming up to the gorge's edge, slow motion, JUMP!
       (lkp-leap.js); landed, on they run. */
    if (!this.leap){
      const th = this.things.find(t => t.kind === 'ravine' && !t.taken && t.d - this.z - RUN <= SPEED * 0.8);
      if (th){ th.taken = true; this.leap = new TeamJump(this, th); }
    } else if (this.leap.done) this.leap = null;
    /* The healing pond: stopping in it, healing, till everyone's full. */
    if (!this.rest){
      /* (a little before its middle: braking, they stop in it) */
      const th = this.things.find(t => t.kind === 'pond' && t.rest && !t.taken && t.d - this.z - RUN <= this.speed * 0.15);
      if (th){ th.taken = true; this.rest = { th, t: 0, ok: 0, waited: false }; if (story.on) this.captain.say(...line(this.level.lines.pondIn[0])); sfx.splash?.(); }
    } else this._rest(dt, W, H);
    /* (the road's narrows and ravines, once they're behind) */
    ROAD.spans = ROAD.spans.filter(sp => sp.d1 > this.z - 0.3);
    ROAD.gaps = ROAD.gaps.filter(g => g.d + g.len > this.z - 0.3);
  }
  /* Rescue bubbles: teammates close by clapping pop them - once they're
     on their feet again, not hanging off the zip line. */
  _bubbles(dt, W, H){
    const riding = !!(this.zip && this.zip.riding);
    for (const i of this.here){
      const clap = this.clapWatch[i].step(pose.players[i], dt);
      const rn = this.crew[i];
      if (rn.bubble) rn.bubble.t += dt;
      if (!clap || riding || rn.bubble || rn.down) continue;
      for (const j of this.here){
        const b = this.crew[j].bubble;
        if (!b || Math.abs(this.crew[j].x - rn.x) > BUBBLE_R) continue;
        b.claps++; sfx.pop(1 + b.claps * 0.1);
        const p = P(this.crew[j].x, RUN, W, H); this._sparkle(p.x / W, (p.y - H * 0.3) / H, 4, 190);
        if (b.claps >= BUBBLE_CLAPS) this._pop(j, W, H);
      }
    }
  }
  _pop(i, W = 1920, H = 1080){
    const rn = this.crew[i];
    rn.bubble = null; rn.hp = Math.max(rn.hp, Math.round(rn.max * BUBBLE_HP)); rn.safe = 1;
    const p = P(rn.x, RUN, W, H); this._sparkle(p.x / W, (p.y - H * 0.25) / H, 16, 190);
    sfx.pop(1.4); sfx.twinkle();
  }
  /* In the healing pond: everyone heals - hugging, twice as fast - till
     they're all full (or it's waited long enough), then on they go. */
  _rest(dt, W, H){
    const r = this.rest;
    r.t += dt;
    for (const i of this.here){
      const rn = this.crew[i], hug = this.hugWatch[i].step(pose.players[i], dt);
      rn.pose = hug ? 'hug' : null; rn.heal = 0.6;
      /* looking round, taking it in - each at their own pace */
      const stir = (r.t - ZUBU_FAR[0]) / ZUBU_FAR[1];
      rn.look = hug ? 0 : stir > 0.05 && stir < 1.15 ? 0.85 + 0.1 * Math.sin(r.t * 2 + i) : Math.sin(r.t * (0.5 + 0.12 * i) + i * 1.7) * Math.min(1, r.t / 2);
      if (rn.hp >= rn.max) continue;
      const was = rn.hp;
      rn.hp = Math.min(rn.max, rn.hp + rn.max * REST_FILL * (hug ? 2 : 1) * dt);
      if (Math.floor(rn.hp / 5) !== Math.floor(was / 5)){ const p = P(rn.x, RUN, W, H); this.bits.push({ kind: 'num', x: p.x / W, y: (p.y - H * 0.25) / H, vy: -0.06, age: 0, life: 0.8, text: '+5', col: '#7ff3ff' }); }
      if (rn.hp >= rn.max) sfx.twinkle();
    }
    /* something huge, far off: its footfalls, felt - the water rippling, the view trembling - and its call */
    const u = (r.t - ZUBU_FAR[0]) / ZUBU_FAR[1];
    if (u > 0 && u < 1){ r.stepT = (r.stepT ?? 0) - dt; if (r.stepT <= 0){ r.stepT = STEP_EVERY; sfx.farStep?.(0.9); this.quake = 1; } }
    if (!r.called && u > 0.55){ r.called = true; sfx.giantCall?.(0.55); }
    if (story.on && !r.viewed && r.t > 3.5 && !this.captain.busy && this.level.lines.pondView){ r.viewed = true; this.captain.say(...line(this.level.lines.pondView[0]), { polite: true }); }
    if (story.on && !r.waited && r.t > 14 && !this.captain.busy){ r.waited = true; this.captain.say(...line(this.level.lines.pondWait[0])); }
    const full = this.here.every(i => this.crew[i].hp >= this.crew[i].max);
    r.ok = full ? r.ok + dt : 0;
    if ((r.ok > 0.8 && r.t >= REST_MIN) || r.t >= REST_MAX){
      for (const i of this.here){ const rn = this.crew[i]; rn.hp = rn.max; rn.pose = null; rn.look = 0; }
      if (story.on) this.captain.say(...line(this.level.lines.pondDone[0]), { polite: true });
      this.rest = null;
    }
  }
  /* How high off the ground a crystal floats (px at depth scale k): low,
     or high for a hop. */
  _crystalUp(th, H, k){
    if (th.alt) return H * CREW_SIZE * (th.alt * 0.55 + 0.55) * k;
    return H * (th.high ? 0.3 : 0.11) * k;
  }
  /* Where someone's lane puts them on the road as it is here: squeezed
     together where it narrows, spread out where it widens. */
  _lane(x){
    if (this.seg.kind !== 'corridor') return clamp(x, -1, 1);
    const f = roadHalf(this.z + RUN) / PATH_HALF;
    return clamp(x * f, -f, f);
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
    if (this.flown === 1) this.captain?.say('Grab the crystals, crew! Fill up the bar to level up.', 'CRYSTALS LEVEL YOU UP', { once: 'crystal', polite: true });
    this.flyers.push({ x, y, t: 0, dur: first ? FLY_FIRST : FLY, xp, n: Math.min(n, 4), big: first, bend: Math.random() < 0.5 ? -1 : 1 });
  }
  /* Calm enough to stop for level ups - between rooms: a corridor just
     starting, or the doors before they're chosen. */
  /* The boss down, a moment after: time for what it gave them. */
  get bossBeaten(){ return !this.over && !!this.boss && this.boss.done && this.boss.clearT > 1.2; }
  /* How big the music is: hushed while sneaking, the corridor's walk,
     fights louder, the boss loudest. (The shell reads it.) */
  get mood(){
    /* The opening: no music at all - it has its own sound (lkp-intro.js). */
    if (this.scene && this.scene.kind === 'intro') return -2;
    if (this.scene || this.levelup) return 0.2;
    const seg = this.seg;
    if (this.boss) return this.boss.done ? 0.5 : 1;
    if (this.fight) return this.fight.done ? 0.4 : 0.8;
    if (this.trap) return this.trap.done ? 0.35 : this.trap.light === 'green' ? 0.3 : 0;
    if (this.treasure) return 0.65;
    if (this.roll) return this.roll.phase === 'run' ? 0.75 : 0.4;
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

  /* Level ups without choosing: each one more health for everyone (MAX
     HP, and that much back) - a gold one counts twice. */
  _moreHealth(){
    const n = this.pending + this.golds * 2;
    this.pending = 0; this.golds = 0;
    for (const i of this.here) for (let k = 0; k < n; k++) take('maxhp', this.crew[i]);
    this.bits.push({ kind: 'num', x: 0.5, y: 0.27, vy: -0.03, age: 0, life: 1.8, text: 'MORE HEALTH!', col: '#ff8fa3' });
    sfx.learnt();
  }

  /* ---------- the ship's computer's tips ---------- */

  /* Nova noticing what's happening, and saying something - each tip
     once a run, the rest when they matter. */
  _cues(){
    const cap = this.captain, seg = this.seg, f = this.fight, bs = this.boss, up = this.here.filter(i => !this.crew[i].down);
    if (seg.kind === 'corridor'){
      /* her story, as the run reaches each piece of it - never over a tip */
      for (const th of this.things) if (th.kind === 'say' && !th.said && th.d - this.z - RUN <= 0){ th.said = true; const l = th.key ? this.level.lines[th.key] && this.level.lines[th.key][0] : this.level.lines.walk[th.line]; if (l) cap.say(...line(l), { polite: true, story: true }); }
      for (const th of this.things){
        const ahead = th.d - this.z - RUN;
        if (th.got || ahead < 0 || ahead > SPEED * 2.4) continue;
        /* (never over her story: the tip waits for her to finish) */
        if (cap.storyTalking) break;
        const kind = th.kind === 'ledge' ? 'gap' : th.kind, tip = this.level.tips[kind];
        if (tip && cap.say(tip[0], tip[1], { once: kind })) break;
      }
    }
    if (seg.kind === 'cross' && seg.vote < VOTE && seg.choice == null && !seg.told){
      seg.told = true;
      const [a, b] = seg.kinds;
      if (!cap.say('The path splits! Lean towards the way you want, and stay there till time\'s up.', 'PICK A PATH', { once: 'doors' }))
        cap.say(`${cap1(this.behind(a))} on the left, ${this.behind(b)} on the right. Your call!`, '');
    }
    /* The tutorial fight: one lesson a wave. (Said once: the usual tips
       for them don't come again.) */
    if (f && f.tutorial && !f.done && seg.taught !== f.wave){
      seg.taught = f.wave; seg.told = true;
      const lesson = [
        ['Wild beasts! Don\'t worry \u2014 you hit them all by yourself when they get close. Stand together to hit harder!', 'STAND TOGETHER', 'fight'],
        ['Here come more! Jump to zap the ones that are still coming!', 'JUMP!', 'zap'],
        ['Last ones! Roll your arms, like the wheels on the bus, to hit even harder!', 'ROLL YOUR ARMS', 'crank']
      ][Math.min(2, f.wave)];
      cap.said.add(lesson[2]); cap.say(lesson[0], lesson[1], { polite: f.wave > 0 });
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
    for (const i of this.here){
      const rn = this.crew[i];
      if (rn.bubble && !rn.bubble.told && !(this.zip && this.zip.riding)){
        rn.bubble.told = true;
        if (!cap.say(`${NAMES[i]} missed it! Stand next to their bubble and clap to pop it!`, 'CLAP TO POP!', { once: 'bubble' })) cap.say(`Pop ${NAMES[i]}'s bubble!`, 'CLAP!');
      }
    }
    if (this.treasure && !seg.told){ seg.told = true; cap.say('Treasure! Grab all the crystals you can, with your hands!', 'GRAB THE CRYSTALS!'); }
    if (this.treasure && this.treasure.pool > 0 && !seg.toldPool){ seg.toldPool = true; cap.say('Healing water! Hug yourselves to heal faster!', 'HUG TO HEAL!'); }
    const tr = this.trap;
    if (tr && !seg.told){
      seg.told = true;
      const first = tr.giant ? 'Shh! Something huge, fast asleep. Creep past while it snores. When its eyes open, freeze!'
        : this.awake ? 'A sentry robot, recharging! Run on the spot while it\'s green. When its eye opens, freeze!'
        : 'Shh! A sleeping robot. Run on the spot while it sleeps. When its eye opens, freeze!';
      if (!cap.say(first, tr.giant ? 'SHH! CREEP, THEN FREEZE' : this.awake ? 'RUN, THEN FREEZE' : 'SHH! RUN, THEN FREEZE', { once: 'lights' })) cap.say(this.awake ? 'Another sentry. Careful now.' : 'Another sleeper. Quietly now!', '');
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
      : this.ride && this.ride.on(i) ? 0
      : this.fight || rn.bubble || (this.zip && this.zip.holding(i)) || (this.boss && !(this.boss.move && this.boss.move.t >= 0.8)) ? 0 : Math.min(1, this.speed / SPEED);
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
      : this.zip && this.zip.holding(i) ? rn.x
      : this.ride && this.ride.on(i) ? this.ride.seat(i)
      : this._lane(this._home(i) + rn.lean * this.reach);
    rn.x += (want - rn.x) * Math.min(1, dt * 6);
    const holding = !!(this.zip && this.zip.holding(i)) || !!(this.ride && this.ride.on(i));
    if (this.t - rn.lastDuck < UNDUCK) jumped = false;
    if (this.leap && this.leap.phase !== 'ready'){
      /* over the gorge: coming down on the far side */
      rn.air = this.leap.air(); rn.airV = 0;
    } else if (holding){ rn.air = 0; rn.airV = 0; }
    else {
      if (jumped && rn.air < CLEAR){ rn.airV = Math.sqrt(2 * GRAVITY * HOP); sfx.boing(1.2); }
      if (rn.air > 0 || rn.airV > 0){
        rn.air += rn.airV * dt; rn.airV -= GRAVITY * dt;
        if (rn.air <= 0){ rn.air = 0; rn.airV = 0; }
      }
    }
    if (rn.bubble){ rn.air = 0; rn.airV = 0; }
    const ducking = !holding && !rn.bubble && this.duckOf(i, dt);
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
          if (rn.bubble || Math.abs(rn.x - th.lane) > FOUNTAIN_REACH) continue;
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
          if (th.hang || th.ride || rn.bubble) continue;     /* (along the zip line: lkp-zip.js; and none for a bubble) */
          if (th.got || Math.abs(rn.x - th.lane) > CRYSTAL_REACH || (th.high && rn.air < CLEAR * 2) || (th.alt && rn.air < th.alt * 0.8)) continue;
          th.got = true;
          const p = P(th.lane, RUN, W, H), y = (p.y - this._crystalUp(th, H, 1)) / H;
          this.gain(th.worth || 1, p.x / W, y);
          if (th.worth > 1) sfx.gold();
          sfx.jar(1 + (this.crystals % 8));
          this._sparkle(p.x / W, y, 6, 185);
          continue;
        }
        if (rn.safe > 0 || rn.bubble || (this.ride && this.ride.on(i))) continue;
        let hit = false;
        if (th.kind === 'beam') hit = rn.duck < DUCKED && this.t - rn.lastDuck > 0.25;
        else if (th.kind === 'gap' || th.kind === 'ledge') hit = rn.x > th.a - BODY * 0.5 && rn.x < th.b + BODY * 0.5 && rn.air < CLEAR;
        else if (th.kind === 'blocker') hit = rn.x > th.a - BODY && rn.x < th.b + BODY && rn.air < CLEAR * 4;
        else if (th.kind === 'roller') hit = Math.abs(rn.x - th.end) < ROLLER + BODY && rn.air < CLEAR * 4;
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
    if (sc && sc.kind === 'intro'){ sc.draw(c, W, H); drawGuide(c, W, H, this); return; }
    if (sc && (sc.kind === 'opening' || sc.kind === 'won' || sc.kind === 'lost')){
      if (sc.kind === 'opening') drawOpening(c, W, H, sc.t);
      else drawEnding(c, W, H, this.out.t, sc.kind === 'won');
      sc.draw(c, W, H);
      if (this.out) this._drawTally(c, W, H);
      return;
    }
    /* the team jump's hero shot, from in front, in place of the run */
    if (this.leap && this.leap.phase === 'hero') this.leap.view(c, W, H, PAL.world);
    else if ((this.restCam || 0) > 0.001){
      /* at the pond: the camera tilting up and easing back - more sky,
         the land laid out, the crew small in it (the HUD stays put) */
      const k = this.restCam * this.restCam * (3 - 2 * this.restCam), s = 1 - 0.3 * k;
      /* (pulling back round their feet: they stay put, small, the sky opens above) */
      c.save(); c.translate(W / 2, H * 0.97); c.scale(s, s); c.translate(-W / 2, -H * 0.97);
      SKY.above = H * 0.5 * k; SKY.wide = W * 0.3 * k; this.noHud = true;
      /* far off: the woods on the ridge stirring - something huge, unseen */
      const zt = this.rest ? this.rest.t : null, zu = zt == null ? -1 : (zt - ZUBU_FAR[0]) / ZUBU_FAR[1];
      if (zu > -0.05) SKY.far = (cc, w, h, hy) => farStir(cc, w, h, hy, this.t, Math.max(0, Math.min(1.1, zu)), PAL.world);
      /* each footfall: a little tremble */
      if (this.quake > 0) c.translate(Math.sin(this.t * 60) * H * 0.003 * this.quake, Math.cos(this.t * 47) * H * 0.003 * this.quake);
      this._drawPlay(c, W, H);
      SKY.above = 0; SKY.wide = 0; SKY.far = null; this.noHud = false; c.restore();
      this._drawHud(c, W, H);
    }
    else this._drawPlay(c, W, H);
    if (sc){ drawBossRising(c, W, H, sc.t); sc.draw(c, W, H); return; }
    /* (playing itself in the home screen's banner, demo: just the play) */
    if (this.demo) return;
    if (this.levelup) this.levelup.draw(c, W, H);
    /* the little man showing the move to make */
    drawGuide(c, W, H, this);
    this.captain.draw(c, W, H);
  }

  _drawPlay(c, W, H){
    /* The treasure room is its own picture: the players in it. */
    if (this.treasure){
      c.save(); this.treasure.view(c, W, H); this._drawBits(c, W, H); c.restore();
      this._drawHud(c, W, H);
      return;
    }
    /* The sleepy roll: its own view, looking back up the hill at them. */
    if (this.roll){
      c.save();
      this.roll.draw(c, W, H, (i, x, y, h) => this._drawCrew(c, i, W, H, { x, y, h, bob: 0, front: true, shout: this.roll.shout, moment: this.roll.snapped && !(this.roll.phase === 'in' && this.roll.pt < SNAP_AT + SNAP_HOLD + SNAP_FLY) }));
      this._drawBits(c, W, H);
      c.restore();
      this.roll.marks(c, W, H);
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
    /* On the zip line: the ground dropping away below (everything on it
       drawn lower; the crew, and the crystals hanging in the air, not). */
    const dropY = this.zip ? this.zip.drop * DROP * H : 0;
    if (dropY){ c.save(); c.translate(0, dropY); SKY.above = H; }
    if (this.boss) this.boss.arena(c, W, H, this.t);
    else drawCorridor(c, W, H, this.z, this.t, seg.kind === 'cross' ? 0.4 : this.fight && !this.fight.done ? 0.3 : 0);
    /* Springs are part of the floor: under everything, there all the way
       along until the last of them has gone by. */
    for (const th of this.things) if (th.kind === 'fountain'){
      const rel = th.d - this.z, len = th.len || SPRING_LEN;
      if (rel < 1 && rel + len > -0.12) drawFountain(c, W, H, rel, th.lane, this.t, len);
    }
    /* the crash site's pond: part of the floor too */
    for (const th of this.things) if (th.kind === 'meadow'){ const rel = th.d - this.z; if (rel > -0.8) worldMeadow(c, W, H, rel, PAL.world); }
    for (const th of this.things) if (th.kind === 'pond'){ const rel = th.d - this.z; if (rel - LAKE / 2 < 1 && rel + LAKE / 2 > -0.15) worldLake(c, W, H, rel, this.t, PAL.world); else if (rel - LAKE / 2 >= 1) worldLakeAhead(c, W, H, rel - LAKE / 2, this.t); }
    if (dropY){ c.restore(); SKY.above = 0; }
    if (this.zip) this.zip.drawCable(c, W, H);
    const items = [];
    for (const th of this.things) if (!th.got && th.kind !== 'fountain' && th.kind !== 'pond' && th.kind !== 'meadow') items.push({ ...th, rel: th.d - this.z });
    if (seg.kind === 'cross') items.push({ kind: 'doors', rel: seg.wall - this.z });
    if (this.fight) for (const b of this.fight.bots) if (!b.part) items.push({ kind: 'bot', rel: b.d, lane: b.x, b });
    if (this.boss) this.boss.items(items);
    if (this.depot) this.depot.items(items);
    if (this.ride) this.ride.items(items);
    /* (the opening can stand them somewhere else, walking: introCrew) */
    if (this.introCrew) for (const ic of this.introCrew){
      const p = P(ic.lane, ic.rel, W, H), h = H * CREW_SIZE * p.k;
      items.push({ kind: 'crew', rel: ic.rel, i: ic.i, at: { x: p.x + (ic.dx || 0) * h, y: p.y, h, bob: 0, down: ic.down, pose: ic.pose, noBar: ic.noBar } });
    }
    else for (let i = 0; i < this.players; i++) if (this.crew[i].played && !(this.zip && this.zip.holding(i))) items.push({ kind: 'crew', rel: RUN, i });
    if (this.fight && !this.fight.done) items.push({ kind: 'team', rel: RUN + 0.001 });
    items.sort((a, b) => b.rel - a.rel);
    for (const it of items){
      if (it.rel > 1 || it.rel < -0.12) continue;
      const low = dropY && it.kind !== 'crew' && !it.hang;
      if (low){ c.save(); c.translate(0, dropY); }
      this._drawItem(c, it, W, H);
      if (low) c.restore();
    }
    /* on the zip line: each hanging from the cable, or the feet above */
    if (this.zip) this.zip.drawRiders(c, W, H, (i, x, y, h, a) => {
      c.save(); c.translate(x, y); c.rotate(a);
      this._drawCrew(c, i, W, H, { x: 0, y: h * 1.02, h, bob: 0, pose: 'hang', noBar: true });
      c.restore();
    });
    if (this.ride) this.ride.drawTop(c, W, H);
    if (this.zip) this.zip.marks(c, W, H);
    if (this.ride) this.ride.marks(c, W, H);
    if (this.leap) this.leap.marks(c, W, H);
    if (this.rest){
      const th = this.rest.th, k = Math.min(1, this.rest.t / 1.5);
      pondBeauty(c, W, H, th.lane, th.d - this.z, this.t, PAL.world, th.r * 0.6, k);
      /* each of them wading: rings round their feet, motes rising off them */
      for (const i of this.here){ const p = P(this.crew[i].x, RUN, W, H); wading(c, p.x, p.y, H * CREW_SIZE, this.t + i * 0.4, k); if (this.quake > 0.05) healRipple(c, p.x, p.y, H * CREW_SIZE * 1.6, 1 - this.quake, '#e0faff'); }
    }
    /* At the fork, still choosing: over each one's head an arrow, in their
       colour, pointing the way they're going. */
    if (seg.kind === 'cross' && seg.choice == null && seg.wall - this.z <= DOOR_STOP + 0.02) for (const i of this.here){
      const rn = this.crew[i]; if (rn.door == null) continue;
      const p = P(rn.x, RUN, W, H), s = H * 0.035, x = p.x, y = p.y - H * CREW_SIZE * 1.25 - Math.abs(Math.sin(this.t * 5)) * s * 0.3, d = rn.door ? 1 : -1;
      c.save(); c.fillStyle = PLAYER_COLORS[i]; c.strokeStyle = '#ffffff'; c.lineWidth = s * 0.18; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(x + d * s, y); c.lineTo(x - d * s * 0.3, y - s * 0.75); c.lineTo(x - d * s * 0.3, y - s * 0.3); c.lineTo(x - d * s, y - s * 0.3); c.lineTo(x - d * s, y + s * 0.3); c.lineTo(x - d * s * 0.3, y + s * 0.3); c.lineTo(x - d * s * 0.3, y + s * 0.75); c.closePath();
      c.stroke(); c.fill(); c.restore();
    }
    /* (the opening's own things in the world: smoke, stars, the pond's light) */
    if (this.introDraw) this.introDraw(c, W, H);
    drawGloom(c, W, H);
    if (seg.kind === 'room') this._drawRoom(c, W, H);
    this._drawBits(c, W, H);
    if (this.depot) this.depot.draw(c, W, H);
    c.restore();
    if (!this.inIntro && !this.noHud) this._drawHud(c, W, H);
  }

  /* The path's bends, for the look: gentle curves along a corridor, a
     sharp turn swinging round once in a while; straight for the rooms. */
  _bend(){
    const seg = this.seg;
    let curve = 0, corner = null, dir = 1;
    if (!this.boss){
      const want = seg.kind === 'corridor' || seg.kind === 'ride' ? 0.6 * Math.sin(this.z * 0.35) + 0.35 * Math.sin(this.z * 0.9 + 1) : 0;
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
      case 'crystal': {
        const y = it.hang ? hangY(it, it.rel, W, H) : p.y - this._crystalUp(it, H, p.k), s = H * 0.022 * p.k * (it.worth > 1 ? 1.7 : 1);
        if (it.worth > 1){ glow(c, p.x, y, s * 4, '#ffd24a', 0.8 + 0.2 * Math.sin(this.t * 6)); }
        drawCrystal(c, p.x, y, s, this.t + it.d * 9);
        if (it.worth > 1){ c.strokeStyle = '#ffe28a'; c.lineWidth = s * 0.18; c.beginPath(); c.arc(p.x, y, s * 1.5, 0, 6.2832); c.stroke(); }
        break;
      }
      case 'zip': worldZipStart(c, W, H, it.rel, PAL.world); break;
      case 'ride': this.ride && this.ride.draw(c, W, H); break;
      case 'doors': this._drawDoors(c, W, H, it.rel); break;
      case 'bot': this._drawBot(c, it.b, W, H); break;
      case 'team': this._drawTeam(c, W, H); break;
      /* The boss's own things draw themselves. */
      case 'boss': it.draw(c, W, H, this.t); break;
      case 'crew': this._drawCrew(c, it.i, W, H, it.at || null); break;
      case 'ship': worldShip(c, W, H, it.rel, it.lane, this.t, it.s); shipFire(c, W, H, it.rel, it.lane, this.t, it.s); break;
      case 'wreck': worldWreck(c, W, H, it.rel, it.lane, this.t, it.s, it.n); break;
      case 'roller': worldLog(c, W, H, rollerLane(it, it.rel), it.rel, PAL.world, (it.rel - RUN) * 30 * it.dir); break;
      case 'tree': tree(c, W, H, it.lane, it.rel, PAL.world, it.n); break;
      case 'trail': worldTrail(c, W, H, it.lane, it.rel, PAL.world); break;
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
    let p = at || P(rn.x, RUN, W, H); const h = at ? at.h : H * CREW_SIZE;
    if (!at && this.zip) p = { ...p, y: p.y + this.zip.fallY(H, i) };
    if (!at && this.leap) p = { ...p, y: p.y + this.leap.fallY(H) };
    if (!at && this.ride && this.ride.riders.includes(i)) p = { ...p, y: p.y - this.ride.lift(i, H) };
    /* in a bubble: floating along - up with the riders while they're on the line */
    const bub = !at && rn.bubble && (!this.zip || this.zip.bubbled(i));
    if (bub) p = { ...p, y: p.y - H * (0.1 + 0.015 * Math.sin(this.t * 2 + i)) - (this.zip ? this.zip.drop * H * 0.38 : 0) };
    (at && at.front ? worldCrewFront : drawCrew)(c, p.x, p.y, h, this.t + i * 0.37, PLAYER_COLORS[i],
      { air: rn.air * h * 0.55 + (at ? at.bob : 0), flying: rn.air > 0.6 || !!rn.bubble || (!at && !!this.ride && this.ride.on(i)) || !!(this.zip && (this.zip.holding(i) || this.zip.phase === 'fall')), duck: rn.duck, lean: rn.lean, hit: rn.hit, heal: rn.heal || 0, run: rn.run || 0, runPh: rn.runPh || 0, pose: (at && at.pose) || (!at && this.ride && this.ride.sitting(i) ? 'sit' : rn.pose), look: (at && at.look) || rn.look || 0, blink: rn.safe > 0, lost: !here, photo: here && this.faces.has(i), down: at && at.down != null ? at.down : this.lying ? this.lying[i] : rn.down },
      (x, y, r) => {
        /* (the sleepy roll: the picture of them screaming, once it's taken) */
        if (here && this.faces.has(i)) (at && at.moment ? this.faces.drawMoment(c, i, x, y, r, PLAYER_COLORS[i]) : this.faces.draw(c, i, x, y, r, PLAYER_COLORS[i]));
        else drawKid(c, x, y + r * 0.1, r, this.t + i, KID_SKINS[i], !!(at && at.shout));
      });
    /* The rescue bubble round them, and how many claps it's had. */
    if (bub){
      const cx = p.x, cy = p.y - h * 0.5, r = h * 0.66;
      glow(c, cx, cy, r * 1.3, '#bff4ff', 0.25);
      c.save();
      c.fillStyle = 'rgba(190,240,255,.16)'; c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(225,250,255,.85)'; c.lineWidth = Math.max(2, h * 0.02); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(2, h * 0.03); c.lineCap = 'round';
      c.beginPath(); c.arc(cx, cy, r * 0.78, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
      for (let k = 0; k < BUBBLE_CLAPS; k++){
        const a = Math.PI * 0.5 + (k - (BUBBLE_CLAPS - 1) / 2) * 0.28, x = cx + Math.cos(a) * r * 1.12, y = cy + Math.sin(a) * r * 1.12;
        c.fillStyle = k < rn.bubble.claps ? '#ffd24a' : 'rgba(5,6,15,.5)'; c.beginPath(); c.arc(x, y, h * 0.03, 0, 6.2832); c.fill();
      }
      c.restore();
    }
    /* Hitting out: a ring bursting along the floor, as far as they reach. */
    if (this.fight && rn.swing > 0){
      const m = arms(rn).melee, l = P(rn.x - m.reach, RUN, W, H), r = P(rn.x + m.reach, RUN, W, H);
      drawPulse(c, p.x, p.y, (r.x - l.x) / 2, rn.swing, PLAYER_COLORS[i], rn.buddies > 0, m.style, this.t);
    }
    if (rn.down){ drawZzz(c, p.x - h * 0.2, p.y - h * 0.35, h * 0.3, this.t + i); return; }
    /* Their health over their head; the guide's crown at a crossroads. */
    const top = p.y - rn.air * h * 0.55 - h * (1 - rn.duck * 0.45);
    /* Hurt (in the crash, or since), and nothing else going on: the bar
       pulsing orange, and now and then a spark fizzing off the suit - so
       it's seen, not read. Healed, it stops. */
    const frac = rn.hp / rn.max, sore = frac < 0.6 && !this.fight && !this.inIntro && !this.over;
    if (sore && ((this.t + i * 0.45) % 1.4) < 0.16){
      const sx = p.x + h * (i % 2 ? 0.16 : -0.16), sy = top + h * 0.3, u = h * 0.12;
      glow(c, sx, sy, u * 1.6, '#ffd27a', 0.7);
      c.save(); c.strokeStyle = '#fff3a6'; c.lineWidth = Math.max(2, u * 0.2); c.lineJoin = 'round';
      c.beginPath(); c.moveTo(sx - u * 0.3, sy + u * 0.6); c.lineTo(sx + u * 0.2, sy); c.lineTo(sx - u * 0.1, sy - u * 0.1); c.lineTo(sx + u * 0.35, sy - u * 0.7); c.stroke(); c.restore();
    }
    if (at && at.noBar != null ? !at.noBar : !this.inIntro) drawHealth(c, p.x, top - H * 0.03, h * 0.53, frac, sore && Math.sin(this.t * 6) > 0 ? '#ff9c3b' : PLAYER_COLORS[i], frac < 0.3);
    if (this.seg.kind === 'cross' && i === this.guide) drawCrown(c, p.x, top - H * 0.065, H * 0.022, this.t);
  }

  /* Stage 1: a room is its sign, big in the doorway, as the crew pass
     through. */
  _drawRoom(c, W, H){
    const kind = this.seg.room;
    /* A fight shows its sign as each wave starts. */
    const u = this.fight ? clamp(this.fight.banner / 0.4, 0, 1) * clamp((1.6 - this.fight.banner) / 0.3, 0, 1)
      : clamp(this.seg.t / 0.4, 0, 1) * clamp((this.seg.len - this.seg.t) / 0.4, 0, 1);
    const s = { combat: ['skull', '#ff5b5b'], tutorial: ['skull', '#ff5b5b'], elite: ['skull', '#ff5b5b'], traps: ['spikes', '#ffc531'], treasure: ['mystery', '#ffd24a'] }[kind] || ['mystery', '#c46bff'];
    c.save(); c.globalAlpha = u;
    sign(c, s[0], W / 2, H * 0.36, H * 0.1 * (0.8 + 0.2 * u), s[1], this.t);
    c.restore();
  }

  /* Where the XP bar's crystal sits, top right: where picked-up crystals
     fly to. */
  _xpAt(W, H){ return { x: W - H * 0.42, y: H * 0.07 }; }

  _drawHud(c, W, H){
    if (this.demo) return;
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
    /* (this level's part of the plan: up to its end) */
    const plan = this.level.plan.slice(0, this.level.plan.indexOf('end') + 1), n = plan.length - 1, w = H * 0.034;
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

  /* No pausing by gesture: hands up is how you grab the zip line, and
     reach for the treasure. */
  pausable(){ return false; }
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
