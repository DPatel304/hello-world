import { clamp } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';
import { JumpWatch } from '../tracking/jump.js';
import { P, RUN, DOORS, drawCorridor, drawGloom, drawBlocker, drawBeam, drawGap, drawCoin, drawFountain,
         drawDoors, drawCrown, sign, drawCrew, drawHealth, drawRustbot, drawPulse, drawZzz,
         drawCore, drawArm, drawShockwave, drawSweep, drawArena, SIDES } from './lkp-art.js';
import { Fight, RANGE, BUDDY, FRONT } from './lkp-combat.js';
import { Lights } from './lkp-trap.js';
import { Warden, SLAM_W } from './lkp-boss.js';
import { Captain, Scene, NAMES, drawOpening, drawWardenRising, drawEnding } from './lkp-captain.js';

/* Last Known Position. A salvage crew of up to four boards a derelict starship and
   runs its corridors for real: lean to slide across round the debris, duck
   under the low bulkheads, hop the breaches in the floor, run through the
   coins and the green repair stations. At each crossroads the crew votes
   with their feet - two doors, each a fight, traps or anything (?): lean
   left for the left door, right for the right, and whichever door has the
   most of them in front of it when the time's up is the way they go.

   It teaches by showing: the first corridor is gentle, one new thing at a
   time, with coins to show the way.

   Corridors wound but never kill: nobody's knocked below a sliver of
   health by them. (That's for the rooms, to come.)

   Captain Nova talks them through it on the radio (lkp-captain.js),
   with a little scene to open, before the Warden, and to end.

   The fight door is a combat room (lkp-combat.js); the traps door, a
   trap room - red light, green light (lkp-trap.js). Treasure is only
   its sign for now, letting the crew straight through. */

export const SPEED = 0.3;                       /* corridor depths a second */
/* The story - the captain's scenes - on or off (off in the tests of the
   play itself). */
export const story = { on: true };
/* Nova's first tip for each thing in a corridor, said as it comes. */
const TIPS = {
  coin: ['Grab those coins!', 'COINS!'],
  blocker: ['Junk ahead! Lean to slide around it.', 'LEAN!'],
  beam: ['Low pipe! Duck under it!', 'DUCK!'],
  gap: ['Hole in the floor! Hop over it!', 'HOP!'],
  fountain: ['A repair station! Run through it to fix yourselves up.', 'HEAL']
};
/* What she calls each kind of door. */
const BEHIND = { combat: 'robots', traps: 'traps', mystery: 'who knows what' };

/* While we playtest the mechanics, every part of the run is PLAYTEST
   seconds long - each corridor, and at most each fight - so it's quick
   to try everything. 0 for the full lengths. */
export const PLAYTEST = 20;
const FULL = [50, 45, 45];                      /* seconds of each corridor, in full */
export const CORRIDOR = PLAYTEST ? FULL.map(() => PLAYTEST) : FULL;
export const MAX_HP = 100;
export const HURT = { blocker: 10, beam: 10, gap: 20, ledge: 10 };   /* ledge: a breach across part of the floor */
export const SAFE = 1;                          /* seconds of safety after a hit */
export const SLOW = 0.6, SLOW_FOR = 0.6;        /* a hit slows everyone a moment */
export const HEAL = 30;                         /* a repair station */
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
const BODY = 0.1, COIN_REACH = 0.18, FOUNTAIN_REACH = 0.3;
/* What a door can be: a fight, traps, or anything (?). Each crossroads
   has two of them, different, either way round. */
export const DOOR_KINDS = ['combat', 'traps', 'mystery'];
const twoDoors = () => {
  const k = DOOR_KINDS.slice().sort(() => Math.random() - 0.5);
  return [k[0], k[1]];
};
const PLAN = ['corridor', 'cross', 'room', 'corridor', 'cross', 'room', 'corridor', 'boss', 'end'];

export default {
  id: 'last-known-position', name: 'Last Known Position', stars: 4, accent: '#3fd0ff', secs: 1200, endless: true,
  /* The moves it uses, shown as pictures on the home screen. */
  moves: ['lean', 'jump', 'duck', 'clap', 'hug'],
  /* Arms go up in every hop; holding them up a while is still a pause. */
  pauseHold: 2.5,
  create(n){ return new ReactorRun(n); }
};

class ReactorRun {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false; this.lost = false; this.out = null;
    this.z = 0; this.speed = SPEED; this.slow = 0; this.shake = 0;
    this.zoom = 0;                  /* how far the view has closed in, 0..1 */
    this.coins = 0; this.kills = 0;
    this.fight = null;              /* the fight, in a combat room */
    this.trap = null;               /* the trap, in a trap room */
    this.boss = null;               /* the Warden, at the end */
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
    const kind = PLAN[this.step_] || 'end';
    this.seg = { kind, t: 0 };
    this.fight = null; this.trap = null; this.boss = null;
    if (kind === 'corridor'){
      const n = PLAN.slice(0, this.step_ + 1).filter(k => k === 'corridor').length - 1;
      this.seg.n = n;
      this.seg.len = CORRIDOR[n] || 45;
      this._layout(n);
    } else if (kind === 'cross'){
      /* The doors, coming up the corridor; the crew stop in front of them. */
      this.seg.wall = this.z + 0.9;
      this.seg.votes = [[], []];
      this.seg.kinds = twoDoors();
      this.seg.choice = null; this.seg.opening = 0;
      for (const rn of this.crew) rn.door = null;
      this.seg.vote = VOTE;
      this.guide = this._nextGuide();
    } else if (kind === 'room'){
      this.seg.room = this.rooms[this.rooms.length - 1];
      this.seg.len = ROOM_STUB;
      if (this.seg.room === 'combat') this.fight = PLAYTEST ? new Fight(this, PLAYTEST) : new Fight(this);
      /* A longer hall: twice the playtest time to get up it. */
      if (this.seg.room === 'traps') this.trap = PLAYTEST ? new Lights(this, PLAYTEST * 2) : new Lights(this);
      sfx.whoosh();
    } else if (kind === 'boss'){
      if (story.on) this.scene = new Scene('warden', this);
      /* While playtesting, a Warden you can beat in a playtest's time. */
      this.boss = PLAYTEST ? new Warden(this, PLAYTEST * 2, 0.35) : new Warden(this);
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
     hop, each alone, with coins to show the way - and the later ones mix
     them up, faster and closer. */
  _layout(n){
    /* Laid out for the full length, and squeezed to fit a shorter one. */
    const squeeze = this.seg.len / (FULL[n] || 45);
    const at = (secs) => this.z + RUN + SPEED * secs * squeeze + 0.9;   /* reaching the crew `secs` in */
    const add = (secs, th) => this.things.push({ d: at(secs), ...th });
    const coinLine = (secs, lane, k = 5, high = false) => { for (let i = 0; i < k; i++) add(secs + i * 0.3 / squeeze, { kind: 'coin', lane, high }); };
    const side = () => (Math.random() < 0.5 ? -1 : 1);
    const blocker = (secs, s = side(), width = 0.9) => {
      const a = s < 0 ? -1.05 : 1.05 - width, b = a + width;
      add(secs, { kind: 'blocker', a, b, seed: Math.floor(Math.random() * 100) });
      coinLine(secs - 0.6, s < 0 ? 0.6 : -0.6, 4);
    };
    const beam = (secs) => add(secs, { kind: 'beam' });
    const gap = (secs, full = true, s = side()) => {
      if (full){ add(secs, { kind: 'gap', a: -1.05, b: 1.05 }); [-0.5, 0, 0.5].forEach(l => add(secs, { kind: 'coin', lane: l, high: true })); }
      else { const a = s < 0 ? -1.05 : 0.05, b = a + 1; add(secs, { kind: 'ledge', a, b }); coinLine(secs - 0.5, s < 0 ? 0.6 : -0.6, 3); }
    };
    const fountain = (secs, lane = 0) => add(secs, { kind: 'fountain', lane, used: new Set() });
    if (n === 0){
      coinLine(3, 0, 6); coinLine(6, -0.5, 5);
      blocker(10, 1, 0.8);
      coinLine(14, 0.4, 5);
      beam(19); coinLine(20, 0, 4);
      gap(26); coinLine(29, -0.4, 5);
      blocker(32, -1); fountain(36, 0.5);
      beam(40); gap(43, false); blocker(46);
    } else {
      const hard = n === 1 ? 0.8 : 0.65;
      coinLine(3, 0, 5); blocker(6); blocker(8.5);
      let s = 11;
      for (let k = 0; k < 6; k++){
        const r = Math.random();
        if (r < 0.4) blocker(s); else if (r < 0.65) beam(s); else if (r < 0.85) gap(s, false); else gap(s);
        s += 2.6 * hard + Math.random() * 1.2;
      }
      /* The middle: a coin rush, or a repair station. */
      if (n === 1){ for (let k = 0; k < 4; k++) coinLine(s + k * 0.9, Math.sin(k) * 0.7, 3); s += 4.5; }
      else { fountain(s, side() * 0.45); s += 2.5; }
      for (let k = 0; k < 8 && s < (FULL[n] || 45) - 3; k++){
        const r = Math.random();
        if (r < 0.35) blocker(s, side(), 1.1); else if (r < 0.6) beam(s); else if (r < 0.8) gap(s, false); else gap(s);
        s += 2.2 * hard + Math.random();
      }
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
    this._cues();
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
    if (seg.kind === 'room') want = this.fight || this.trap ? 0 : SPEED * 0.4;
    if (seg.kind === 'boss') want = 0;
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
    else if (seg.kind === 'room' && seg.t >= seg.len) this._next();
    this.things = this.things.filter(th => th.d - this.z > -0.15);
    this._stepBits(dt);
  }

  /* ---------- the captain's tips ---------- */

  /* Nova noticing what's happening, and saying something - each tip
     once a run, the rest when they matter. */
  _cues(){
    const cap = this.captain, seg = this.seg, f = this.fight, bs = this.boss, up = this.here.filter(i => !this.crew[i].down);
    if (seg.kind === 'corridor'){
      for (const th of this.things){
        const ahead = th.d - this.z - RUN;
        if (th.got || ahead < 0 || ahead > SPEED * 2.4) continue;
        const kind = th.kind === 'ledge' ? 'gap' : th.kind, tip = TIPS[kind];
        if (tip && cap.say(tip[0], tip[1], { once: kind })) break;
      }
    }
    if (seg.kind === 'cross' && seg.vote < VOTE && seg.choice == null && !seg.told){
      seg.told = true;
      const [a, b] = seg.kinds;
      if (!cap.say('Two doors! Lean to the one you want, and stay there till time\'s up.', 'PICK A DOOR', { once: 'doors' }))
        cap.say(`${BEHIND[a][0].toUpperCase() + BEHIND[a].slice(1)} on the left, ${BEHIND[b]} on the right. Your call!`, '');
    }
    if (f && !bs && !seg.told){
      seg.told = true;
      if (!cap.say('Robots! You\'ll hit them on your own. Stand close together to hit harder!', 'STAND TOGETHER', { once: 'fight' }))
        cap.say(['Here they come!', 'More robots! Stick together!', 'Stand together, crew!'][Math.floor(Math.random() * 3)], '');
    }
    if (f && !f.done && !bs){
      if (f.t > 4 && f.bots.some(b => b.d > 0.2)) cap.say('Jump to zap them while they\'re still coming!', 'JUMP!', { once: 'zap', polite: true });
      if (f.t > 8 && this.rooms.filter(r => r === 'combat').length > 1) cap.say('Roll your arms, like the wheels on the bus, to hit even harder!', 'ROLL YOUR ARMS', { once: 'crank', polite: true });
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
      const hurt = up.find(i => this.crew[i].hp < this.crew[i].max * 0.35 && !f._inReach(this.crew[i]).length);
      if (hurt != null) cap.say(`${NAMES[hurt]}, you're hurt! Hug yourself to heal, before they reach you.`, 'HUG TO HEAL', { once: 'hug' });
    }
    const tr = this.trap;
    if (tr && !seg.told){
      seg.told = true;
      if (!cap.say('Red light, green light! Run on the spot when it\'s green. Freeze when it\'s red!', 'RUN ON GREEN', { once: 'lights' })) cap.say('Red light, green light again! Careful now.', '');
    }
    if (tr && this.crew.some(rn => rn.zapped > 0.9)) cap.say('Freeze on red!', 'FREEZE!', { once: 'zapped' });
    if (tr && tr.done && !seg.cleared){ seg.cleared = true; if (this.here.some(i => this.crew[i].over)) cap.say('Made it! The coins are yours.', ''); }
    if (bs && !bs.done){
      if (bs.arms.some(a => a.state === 'tell')) cap.say('Watch the red stripe! Get out from under it!', 'MOVE!', { once: 'slam' });
      if (bs.arms.some(a => a.state === 'down')) cap.say('Its arm\'s down! Lean in and hit it!', 'HIT THE ARM', { once: 'arm', polite: true });
      if (bs.move && !bs.move.told){ bs.move.told = true; cap.say('Run! Run round the ring!', 'RUN!'); }
      if (!bs.move && bs.phase === 'robots') cap.say('It\'s opened up! Get in close and hit the core!', 'HIT THE CORE', { once: 'core' });
      if (!bs.move && bs.phase === 'overload') cap.say('It\'s overloading! Jump the waves, duck the lasers!', 'JUMP! DUCK!', { once: 'overload' });
    }
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
    const want = this.seg.kind === 'cross' && this.seg.choice != null ? DOORS[this.seg.choice] + this._home(i) * 0.12
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

  /* Everything that reaches the crew this step: coins to pick up, repairs
     to run through, things to dodge. */
  _pass(before, W, H){
    for (const th of this.things){
      const now = th.d - this.z, was = th.d - before;
      if (!(was >= RUN && now < RUN)) continue;
      for (const i of this.here){
        const rn = this.crew[i];
        if (th.kind === 'coin'){
          if (th.got || Math.abs(rn.x - th.lane) > COIN_REACH || (th.high && rn.air < CLEAR * 2)) continue;
          th.got = true; this.coins++;
          sfx.jar(1 + (this.coins % 8));
          const p = P(th.lane, RUN, W, H);
          this._sparkle(p.x / W, (p.y - H * (th.high ? 0.3 : 0.12)) / H, 6, 45);
          continue;
        }
        if (th.kind === 'fountain'){
          if (th.used.has(i) || Math.abs(rn.x - th.lane) > FOUNTAIN_REACH) continue;
          th.used.add(i);
          if (rn.hp < rn.max){ rn.hp = Math.min(rn.max, rn.hp + HEAL); sfx.twinkle(); }
          const p = P(rn.x, RUN, W, H);
          this._sparkle(p.x / W, (p.y - H * 0.2) / H, 14, 140);
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
    rn.hp = Math.max(1, rn.hp - dmg);
    rn.safe = SAFE; rn.hit = 1;
    this.slow = SLOW_FOR; this.shake = Math.min(1, this.shake + 0.5);
    sfx.thud();
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
    seg.vote -= dt;
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
    for (const b of this.bits){ b.age += dt; if (b.vx != null) b.x += b.vx * dt; if (b.vy != null) b.y += b.vy * dt; }
    this.bits = this.bits.filter(b => b.age < b.life);
  }

  /* ---------- the ending ---------- */

  /* The ending: through the last corridor, cheering - or, with the whole
     crew asleep in a fight, sleeping where they lie, robots and all. */
  outro(dt, W, H){
    if (!this.out){
      this.out = { t: 0, scene: story.on ? new Scene(this.lost ? 'lost' : 'won', this) : null };
      if (this.lost) sfx.lose(); else sfx.fanfare();
    }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.faces.step(dt);
    /* With the story: the ending scene, till it's done. */
    if (o.scene){ o.scene.step(dt); this._stepBits(dt); return o.scene.done && o.t > 2; }
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
       Warden's over its arena, darkened. */
    const sc = this.scene || (this.out && this.out.scene);
    if (sc && sc.kind !== 'warden'){
      if (sc.kind === 'opening') drawOpening(c, W, H, sc.t);
      else drawEnding(c, W, H, this.out.t, sc.kind === 'won');
      sc.draw(c, W, H);
      return;
    }
    this._drawPlay(c, W, H);
    if (sc){ drawWardenRising(c, W, H, sc.t); sc.draw(c, W, H); return; }
    this.captain.draw(c, W, H);
  }

  _drawPlay(c, W, H){
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
    if (this.boss) drawArena(c, W, H, this.boss.angle, this.t, SIDES[Math.min(2, this.boss.view)]);
    else drawCorridor(c, W, H, this.z, this.t, seg.kind === 'cross' ? 0.4 : this.fight && !this.fight.done ? 0.3 : 0);
    const items = [];
    for (const th of this.things) if (!th.got) items.push({ ...th, rel: th.d - this.z });
    if (seg.kind === 'cross') items.push({ kind: 'doors', rel: seg.wall - this.z });
    if (this.fight) for (const b of this.fight.bots) if (!b.part) items.push({ kind: 'bot', rel: b.d, lane: b.x, b });
    if (this.boss) this._bossItems(items);
    for (let i = 0; i < this.players; i++) if (this.crew[i].played) items.push({ kind: 'crew', rel: RUN, i });
    if (this.fight && !this.fight.done) items.push({ kind: 'team', rel: RUN + 0.001 });
    items.sort((a, b) => b.rel - a.rel);
    for (const it of items){ if (it.rel > 1 || it.rel < -0.12) continue; this._drawItem(c, it, W, H); }
    drawGloom(c, W, H);
    if (seg.kind === 'room') this._drawRoom(c, W, H);
    this._drawBits(c, W, H);
    c.restore();
    this._drawHud(c, W, H);
  }

  _drawItem(c, it, W, H){
    const p = P(it.lane || 0, it.rel, W, H);
    switch (it.kind){
      case 'blocker': drawBlocker(c, W, H, it.rel, it.a, it.b, this.t, it.seed); break;
      case 'beam': if (it.rel > RUN) drawBeam(c, W, H, it.rel, this.t); break;
      case 'gap': case 'ledge': drawGap(c, W, H, it.rel, it.a, it.b, this.t); break;
      case 'coin': drawCoin(c, p.x, p.y - H * (it.high ? 0.3 : 0.11) * p.k, H * 0.022 * p.k, this.t + it.d * 9); break;
      case 'fountain': drawFountain(c, W, H, it.rel, it.lane, this.t, it.used.size >= this.here.length); break;
      case 'doors': this._drawDoors(c, W, H, it.rel); break;
      case 'bot': this._drawBot(c, it.b, W, H); break;
      case 'team': this._drawTeam(c, W, H); break;
      case 'core': drawCore(c, p.x, p.y, Math.min(H * 0.34, H * 0.75 * p.k), this.t, { flash: this.boss.core.flash, glow: this.boss.phase === 'overload' && !this.boss.move ? 1 : 0, side: Math.min(2, this.boss.view), dead: this.boss.done }); break;
      case 'arm': this._drawArm(c, it.a, W, H); break;
      case 'tell': this._drawTell(c, it.a, W, H); break;
      case 'wave': drawShockwave(c, W, H, it.rel, this.t); break;
      case 'sweep': drawSweep(c, W, H, it.rel, this.t); break;
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
    drawRustbot(c, p.x, p.y, H * 0.14 * p.k, this.t + b.seed, { swing: b.swing, flash: b.flash, hp: b.hp / b.max });
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
  /* ---------- the Warden ---------- */

  _bossItems(items){
    const bs = this.boss;
    if (!bs.done) items.push({ kind: 'core', rel: bs.core.d, lane: 0 });
    for (const a of bs.arms){
      if (a.state === 'broken') continue;
      items.push({ kind: 'arm', rel: a.state === 'down' ? a.d : bs.core.d - 0.02, a });
      if (a.state === 'tell') items.push({ kind: 'tell', rel: RUN + 0.002, a });
    }
    for (const b of bs.blasts) items.push({ kind: b.kind, rel: b.d });
  }

  /* An arm: from the core's shoulder out to its fist - raised high over
     its target as it winds up, flat on the floor once it's slammed. */
  _drawArm(c, a, W, H){
    const bs = this.boss, core = P(0, bs.core.d, W, H);
    const cs = Math.min(H * 0.34, H * 0.75 * core.k), sx = core.x + a.side * cs * 0.7, sy = core.y - cs * 0.55;
    let fx, fy, s;
    if (a.state === 'down'){ const f = P(a.x, a.d, W, H); fx = f.x; fy = f.y; s = H * 0.16 * f.k; }
    else if (a.state === 'tell'){ const f = P(a.x, FRONT + 0.08, W, H), u = Math.min(1, a.t / 0.4); fx = sx + (f.x - sx) * u; fy = sy + (f.y - H * 0.36 * f.k - sy) * u; s = H * 0.16 * f.k * (0.6 + 0.4 * u); }
    else { fx = sx + a.side * cs * 0.3; fy = sy + cs * 0.4; s = cs * 0.25; }
    drawArm(c, sx, sy, fx, fy, s, { flash: a.flash, hp: a.hp / a.max, down: a.state === 'down' });
  }

  /* Where an arm's about to slam: a red stripe up that lane. */
  _drawTell(c, a, W, H){
    const near = RUN - 0.04, far = FRONT + 0.12;
    const pts = [P(a.x - SLAM_W, near, W, H), P(a.x + SLAM_W, near, W, H), P(a.x + SLAM_W, far, W, H), P(a.x - SLAM_W, far, W, H)];
    c.save(); c.globalAlpha = 0.25 + 0.25 * Math.abs(Math.sin(this.t * 12));
    c.fillStyle = '#ff3b3b';
    c.beginPath(); pts.forEach((q, k) => k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.fill();
    c.restore();
  }

  _drawCrew(c, i, W, H, at = null){
    /* Healing in a fight, they've stepped back a little. */
    const rn = this.crew[i], here = pose.players[i].present;
    const p = at || P(rn.x, RUN - (rn.back || 0) * 0.025, W, H), h = at ? at.h : H * CREW_SIZE;
    /* Walking through a door; running round the Warden's ring. */
    const round = this.boss && this.boss.move && this.boss.move.t >= 0.8;
    const walking = this.seg.kind === 'cross' && this.seg.choice != null ? Math.abs(Math.sin(this.t * 9 + i * 1.7)) * h * 0.06
      : round ? Math.abs(Math.sin(this.t * (10 + 6 * (this.boss.move.boost || 0)) + i * 1.7)) * h * 0.09 : 0;
    drawCrew(c, p.x, p.y, h, this.t + i * 0.37, PLAYER_COLORS[i],
      { air: rn.air * h * 0.55 + walking + (at ? at.bob : 0), duck: rn.duck, lean: rn.lean, hit: rn.hit, blink: rn.safe > 0, lost: !here, photo: here && this.faces.has(i), down: rn.down },
      (x, y, r) => {
        if (here && this.faces.has(i)) this.faces.draw(c, i, x, y, r, PLAYER_COLORS[i]);
        else drawKid(c, x, y + r * 0.1, r, this.t + i, KID_SKINS[i]);
      });
    /* Hitting out: a ring bursting along the floor, as far as they reach. */
    if (this.fight && rn.swing > 0){
      const l = P(rn.x - RANGE, RUN, W, H), r = P(rn.x + RANGE, RUN, W, H);
      drawPulse(c, p.x, p.y, (r.x - l.x) / 2, rn.swing, PLAYER_COLORS[i], rn.buddies > 0);
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
    const s = { combat: ['skull', '#ff5b5b'], traps: ['spikes', '#ffc531'], treasure: ['mystery', '#ffd24a'] }[kind] || ['mystery', '#c46bff'];
    c.save(); c.globalAlpha = u;
    sign(c, s[0], W / 2, H * 0.36, H * 0.1 * (0.8 + 0.2 * u), s[1], this.t);
    c.restore();
  }

  _drawHud(c, W, H){
    /* The Warden's health, big across the top: the core's, and an arm's
       either side while they last. */
    if (this.boss && !this.boss.done){
      const bs = this.boss, w = W * 0.4, y = H * 0.11, h = H * 0.03;
      c.save();
      c.fillStyle = 'rgba(5,6,15,.8)'; c.fillRect(W / 2 - w / 2 - 4, y - 4, w + 8, h + 8);
      c.fillStyle = bs.phase === 'overload' ? '#ff5b5b' : '#ff8a3d'; c.fillRect(W / 2 - w / 2, y, w * Math.max(0, bs.core.hp / bs.core.max), h);
      for (const a of bs.arms){
        if (a.hp <= 0) continue;
        const ax = W / 2 + a.side * (w / 2 + W * 0.05) - W * 0.035, aw = W * 0.07;
        c.fillStyle = 'rgba(5,6,15,.8)'; c.fillRect(ax - 3, y - 3, aw + 6, h + 6);
        c.fillStyle = '#c2410c'; c.fillRect(ax, y, aw * a.hp / a.max, h);
      }
      c.restore();
    }
    /* The team's coins, top right. */
    const x = W - H * 0.06, y = H * 0.07;
    c.save();
    c.fillStyle = 'rgba(5,6,15,.75)'; c.beginPath(); c.roundRect(x - H * 0.24, y - H * 0.04, H * 0.27, H * 0.08, H * 0.04); c.fill();
    drawCoin(c, x - H * 0.19, y, H * 0.022, this.t);
    c.fillStyle = '#ffe9a8'; c.font = `700 ${Math.round(H * 0.05)}px Fredoka, sans-serif`; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText(String(this.coins), x, y + H * 0.003);
    c.restore();
    /* The floor, as a row of pips along the top: where the crew are. */
    const n = PLAN.length - 1, w = H * 0.034;
    for (let k = 0; k < n; k++){
      const px = W / 2 + (k - (n - 1) / 2) * w * 1.6, done = k < this.step_, now = k === this.step_, kind = PLAN[k];
      c.fillStyle = done ? '#7ff3ff' : now ? '#fff6e2' : 'rgba(255,255,255,.25)';
      c.beginPath();
      if (kind === 'corridor') c.roundRect(px - w * 0.6, H * 0.055 - w * 0.2, w * 1.2, w * 0.4, w * 0.2);
      else if (kind === 'boss') c.arc(px, H * 0.055, w * (now ? 0.55 : 0.45), 0, 6.2832);
      else c.arc(px, H * 0.055, w * (now ? 0.36 : 0.28), 0, 6.2832);
      c.fill();
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

  hud(){ return { score: pose.players.map(() => this.coins), showLives: false, hideScore: true, hideClock: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) if (this.crew[i].played || pose.players[i].present) rows.push({ label: `Player ${i + 1}`, value: this.coins, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.crew.filter(r => r.played).length < 2 ? null : -1; }
  value(){ return this.coins; }
}
