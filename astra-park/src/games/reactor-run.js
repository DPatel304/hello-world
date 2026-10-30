import { clamp } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';
import { JumpWatch } from '../tracking/jump.js';
import { P, RUN, DOORS, drawCorridor, drawGloom, drawBlocker, drawBeam, drawGap, drawCoin, drawFountain,
         drawDoors, drawCrown, sign, drawCrew, drawHealth, drawBot } from './reactor-art.js';

/* Reactor Run. A salvage crew of up to four boards a derelict starship and
   runs its corridors for real: lean to slide across round the debris, duck
   under the low bulkheads, hop the breaches in the floor, run through the
   coins and the green repair stations. At each crossroads the crew votes
   with their feet - three doors, a fight, traps or anything: lean left
   for the left door, stand straight for the middle, lean right for the
   right, and whichever door has the most of them in front of it is the
   way they go.

   It teaches by showing: the first corridor is gentle, one new thing at a
   time, with a little helper drone flying ahead doing each move first.

   Corridors wound but never kill: nobody's knocked below a sliver of
   health by them. (That's for the rooms, to come.)

   Stage 1: the corridors and the crossroads. The rooms behind the doors
   are only their signs for now - each lets the crew straight through. */

export const SPEED = 0.3;                       /* corridor depths a second */
export const CORRIDOR = [50, 45, 45];           /* seconds of each corridor */
export const MAX_HP = 100;
export const HURT = { blocker: 10, beam: 10, gap: 20, ledge: 10 };   /* ledge: a breach across part of the floor */
export const SAFE = 1;                          /* seconds of safety after a hit */
export const SLOW = 0.6, SLOW_FOR = 0.6;        /* a hit slows everyone a moment */
export const HEAL = 30;                         /* a repair station */
export const VOTE = 10, LOCK = 1.5;             /* seconds to vote; all in one doorway this long locks it */
export const ROOM_STUB = 3.5;                   /* stage 1: seconds in a room's doorway */
/* How tall the crew stand (screen heights), and how far off the doors are
   when the crew stop in front of them - far enough that the doors stand
   clear above everyone's heads. */
export const CREW_SIZE = 0.19, DOOR_STOP = 0.42;
export const GRAVITY = 12.5, HOP = 1;           /* a hop: about 0.8 seconds in the air */
export const CLEAR = 0.15;                      /* how high (of a full hop) clears a breach */
export const DUCKED = 0.5;                      /* how far down (0..1) passes under a bulkhead */
export const DUCK = 0.15;                       /* head drop, in body sizes, that counts as ducking */
export const LEAN = 0.35;                       /* shoulder-widths of lean for full reach */
export const MYSTERY = [['treasure', 0.4], ['puzzle', 0.25], ['combat', 0.2], ['traps', 0.15]];
const HOMES = { 2: [-0.45, 0.45], 3: [-0.6, 0, 0.6], 4: [-0.72, -0.24, 0.24, 0.72] };
const REACH = { 1: 1, 2: 0.55, 3: 0.5, 4: 0.45 };
const BODY = 0.1, COIN_REACH = 0.18, FOUNTAIN_REACH = 0.3;
const DOOR_KINDS = ['combat', 'traps', 'mystery'];
const PLAN = ['corridor', 'cross', 'room', 'corridor', 'cross', 'room', 'corridor', 'end'];

export default {
  id: 'reactor-run', name: 'Reactor Run', stars: 4, accent: '#3fd0ff', secs: 1200, endless: true,
  /* The moves it uses, shown as pictures on the home screen. */
  moves: ['lean', 'jump', 'duck'],
  /* Arms go up in every hop; holding them up a while is still a pause. */
  pauseHold: 2.5,
  create(n){ return new ReactorRun(n); }
};

class ReactorRun {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false; this.out = null;
    this.z = 0; this.speed = SPEED; this.slow = 0; this.shake = 0;
    this.coins = 0;
    this.faces = new FaceCam();
    this.jumps = new JumpWatch();
    this.heads = pose.players.map(() => null);
    this.crew = pose.players.map((_, i) => ({ x: 0, lean: 0, air: 0, airV: 0, duck: 0, lastDuck: -9, hp: MAX_HP, max: MAX_HP, safe: 0, hit: 0, played: false }));
    this.things = [];
    this.bits = [];
    this.guide = 0;                 /* whose crown breaks a tied vote */
    this.rooms = [];                /* the rooms the crew have chosen, in order */
    this.doors = [];                /* and the doors they chose them by */
    this.bot = { rel: 0.3, lane: 0, act: 'fly', k: 0, gone: false };
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
    if (kind === 'corridor'){
      const n = PLAN.slice(0, this.step_ + 1).filter(k => k === 'corridor').length - 1;
      this.seg.n = n;
      this.seg.len = CORRIDOR[n] || 45;
      this._layout(n);
    } else if (kind === 'cross'){
      /* The doors, coming up the corridor; the crew stop in front of them. */
      this.seg.wall = this.z + 0.9;
      this.seg.votes = [[], [], []];
      this.seg.same = 0; this.seg.choice = null; this.seg.opening = 0;
      this.seg.vote = VOTE;
      this.guide = this._nextGuide();
    } else if (kind === 'room'){
      this.seg.len = ROOM_STUB;
      sfx.whoosh();
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
    const at = (secs) => this.z + RUN + SPEED * secs + 0.9;   /* reaching the crew `secs` in */
    const add = (secs, th) => this.things.push({ d: at(secs), ...th });
    const coinLine = (secs, lane, k = 5, high = false) => { for (let i = 0; i < k; i++) add(secs + i * 0.3, { kind: 'coin', lane, high }); };
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
      for (let k = 0; k < 8 && s < this.seg.len - 3; k++){
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
    this.shake = Math.max(0, this.shake - dt * 3);
    const seg = this.seg;
    seg.t += dt;
    this.slow = Math.max(0, this.slow - dt);
    /* How fast down the corridor: steady, a dip when someone's hit, and
       stopping at the doors. */
    let want = SPEED * (this.slow > 0 ? SLOW : 1);
    if (seg.kind === 'cross' && seg.choice == null && seg.wall - this.z < DOOR_STOP) want = 0;
    if (seg.kind === 'room') want = SPEED * 0.4;
    this.speed += (want - this.speed) * Math.min(1, dt * 4);
    const before = this.z;
    this.z += this.speed * dt;
    const jumped = this.jumps.step(dt, pose.players, this.players);
    for (let i = 0; i < this.players; i++) this._move(i, dt, jumped.includes(i));
    if (seg.kind === 'corridor'){ this._pass(before, W, H); if (seg.t >= seg.len) this._next(); }
    else if (seg.kind === 'cross') this._vote(dt);
    else if (seg.kind === 'room' && seg.t >= seg.len) this._next();
    this.things = this.things.filter(th => th.d - this.z > -0.15);
    this._bot(dt);
    this._stepBits(dt);
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

  _move(i, dt, jumped){
    const rn = this.crew[i];
    rn.safe = Math.max(0, rn.safe - dt);
    rn.hit = Math.max(0, rn.hit - dt * 2.5);
    /* Tracking lost: they hold where they are until they're back. */
    if (!pose.players[i].present) return;
    if (!rn.played){ rn.played = true; rn.x = this._home(i); }
    const lean = this.leanOf(i);
    rn.lean += ((lean ?? 0) - rn.lean) * Math.min(1, dt * 8);
    /* In a corridor, round their own stretch of it; at a crossroads, the
       whole width is everyone's - lean left for the left door, stand
       straight for the middle one, lean right for the right (each a little
       to one side of the others, so they don't stand on top of each other
       - never so far as another door). */
    const want = this.seg.kind === 'cross' ? clamp(rn.lean + this._home(i) * 0.2, -1, 1) : clamp(this._home(i) + rn.lean * this.reach, -1, 1);
    rn.x += (want - rn.x) * Math.min(1, dt * 6);
    if (jumped && rn.air <= 0){ rn.airV = Math.sqrt(2 * GRAVITY * HOP); sfx.boing(1.2); }
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
        if (hit) this._hurt(i, HURT[th.kind], W, H);
      }
    }
  }

  /* Hit: a red flash, a jolt, everyone slows a moment, and a second of
   safety. In a corridor, never down to nothing. */
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

  /* Everyone votes by standing in front of a door. When they're all in
     front of the same one for a moment, or the time's up, it's decided:
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
    const votes = [[], [], []], who = [[], [], []];
    for (const i of this.here){ const d = this.doorOf(this.crew[i].x); votes[d].push(PLAYER_COLORS[i]); who[d].push(i); }
    seg.votes = votes;
    const n = this.here.length, one = who.findIndex(w => w.length === n && n > 0);
    seg.same = one >= 0 && one === seg.sameDoor ? seg.same + dt : 0;
    seg.sameDoor = one;
    if (seg.same >= LOCK || seg.vote <= 0) this._decide(who);
  }
  doorOf(x){ return x < -0.33 ? 0 : x > 0.33 ? 2 : 1; }
  _decide(who){
    const seg = this.seg, most = Math.max(...who.map(w => w.length));
    const tied = [0, 1, 2].filter(d => who[d].length === most);
    const mine = this.doorOf(this.crew[this.guide].x);
    const door = tied.length === 1 ? tied[0] : tied.includes(mine) ? mine : tied[Math.floor(Math.random() * tied.length)];
    seg.choice = door; this.doors.push(door);
    seg.room = DOOR_KINDS[door] === 'mystery' ? this.mystery() : DOOR_KINDS[door];
    sfx.thud(); sfx.whoosh();
  }
  /* What's behind the ? door. Treasure is only ever found this way. */
  mystery(r = Math.random()){
    for (const [kind, w] of MYSTERY){ if (r < w) return kind; r -= w; }
    return MYSTERY[0][0];
  }

  /* ---------- the helper drone ---------- */

  _bot(dt){
    const b = this.bot;
    if (this.seg.kind !== 'corridor' || this.seg.n > 0){ b.gone = true; b.rel += dt * 0.3; return; }
    b.gone = false;
    const near = this.things.filter(th => th.kind !== 'coin' && th.kind !== 'fountain' && Math.abs(th.d - this.z - b.rel) < 0.07)[0];
    b.act = 'fly'; b.k = 0;
    let lane = 0;
    if (near){
      const u = 1 - Math.abs(near.d - this.z - b.rel) / 0.07;
      if (near.kind === 'beam') b.act = 'duck';
      else if (near.kind === 'gap'){ b.act = 'hop'; b.k = Math.sin(u * Math.PI / 2); }
      else lane = near.kind === 'ledge' || near.kind === 'blocker' ? ((near.a + near.b) / 2 > 0 ? -0.6 : 0.6) : 0;
    }
    b.lane += (lane - b.lane) * Math.min(1, dt * 5);
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

  /* ---------- the ending (stage 1: through the last corridor) ---------- */

  outro(dt, W, H){
    if (!this.out){ this.out = { t: 0 }; sfx.fanfare(); }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.faces.step(dt);
    this.speed = Math.max(0, this.speed - dt * 0.3);
    this.z += this.speed * dt;
    for (const rn of this.crew){ rn.duck = 0; rn.air = Math.abs(Math.sin(o.t * 5)) * 0.25; }
    if (Math.random() < dt * 25) this._sparkle(Math.random(), 0.2 + Math.random() * 0.5, 1, (Math.random() * 360) | 0);
    this._stepBits(dt);
    return o.t > 5;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    c.save();
    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake * H * 0.02, (Math.random() - 0.5) * this.shake * H * 0.02);
    const seg = this.seg;
    drawCorridor(c, W, H, this.z, this.t, seg.kind === 'cross' ? 0.4 : 0);
    const items = [];
    for (const th of this.things) if (!th.got) items.push({ ...th, rel: th.d - this.z });
    if (seg.kind === 'cross') items.push({ kind: 'doors', rel: seg.wall - this.z });
    if (!this.bot.gone || this.bot.rel < 1) items.push({ kind: 'bot', rel: this.bot.rel, lane: this.bot.lane });
    for (let i = 0; i < this.players; i++) if (this.crew[i].played) items.push({ kind: 'crew', rel: RUN, i });
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
      case 'bot': drawBot(c, p.x, p.y, H * 0.08 * p.k, this.t, this.bot.act, this.bot.k); break;
      case 'crew': this._drawCrew(c, it.i, W, H); break;
    }
  }

  _drawDoors(c, W, H, rel){
    const seg = this.seg;
    drawDoors(c, W, H, rel, this.t, seg.votes, seg.choice, seg.opening);
    /* The time left: a bar draining across the top of the doorway wall. */
    if (seg.choice == null && seg.wall - this.z <= DOOR_STOP + 0.02){
      const l = P(-1, rel, W, H), r = P(1, rel, W, H), y = l.y - H * 0.6 * l.k, u = clamp(seg.vote / VOTE, 0, 1);
      c.fillStyle = 'rgba(5,6,15,.8)'; c.fillRect(l.x, y, r.x - l.x, H * 0.018);
      c.fillStyle = u < 0.3 ? '#ff5b5b' : '#7ff3ff'; c.fillRect(l.x, y, (r.x - l.x) * u, H * 0.018);
    }
  }

  _drawCrew(c, i, W, H){
    const rn = this.crew[i], here = pose.players[i].present, p = P(rn.x, RUN, W, H), h = H * CREW_SIZE;
    drawCrew(c, p.x, p.y, h, this.t + i * 0.37, PLAYER_COLORS[i],
      { air: rn.air * h * 0.55, duck: rn.duck, lean: rn.lean, hit: rn.hit, blink: rn.safe > 0, lost: !here, photo: here && this.faces.has(i) },
      (x, y, r) => {
        if (here && this.faces.has(i)) this.faces.draw(c, i, x, y, r, PLAYER_COLORS[i]);
        else drawKid(c, x, y + r * 0.1, r, this.t + i, KID_SKINS[i]);
      });
    /* Their health over their head; the guide's crown at a crossroads. */
    const top = p.y - rn.air * h * 0.55 - h * (1 - rn.duck * 0.45);
    drawHealth(c, p.x, top - H * 0.03, H * 0.1, rn.hp / rn.max, PLAYER_COLORS[i], rn.hp / rn.max < 0.3);
    if (this.seg.kind === 'cross' && i === this.guide) drawCrown(c, p.x, top - H * 0.065, H * 0.022, this.t);
  }

  /* Stage 1: a room is its sign, big in the doorway, as the crew pass
     through. */
  _drawRoom(c, W, H){
    const kind = this.seg.kind === 'room' ? this.rooms[this.rooms.length - 1] : null;
    const u = clamp(this.seg.t / 0.4, 0, 1) * clamp((this.seg.len - this.seg.t) / 0.4, 0, 1);
    const s = { combat: ['skull', '#ff5b5b'], traps: ['spikes', '#ffc531'], treasure: ['mystery', '#ffd24a'], puzzle: ['mystery', '#7ff3ff'] }[kind] || ['mystery', '#c46bff'];
    c.save(); c.globalAlpha = u;
    sign(c, s[0], W / 2, H * 0.36, H * 0.1 * (0.8 + 0.2 * u), s[1], this.t);
    c.restore();
  }

  _drawHud(c, W, H){
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
      } else if (b.kind === 'num'){
        c.save(); c.globalAlpha = 1 - k;
        c.font = `700 ${Math.round(H * 0.045)}px Fredoka, sans-serif`; c.textAlign = 'center';
        c.lineWidth = H * 0.008; c.strokeStyle = '#05060f'; c.strokeText(b.text, b.x * W, b.y * H);
        c.fillStyle = '#ff6b6b'; c.fillText(b.text, b.x * W, b.y * H);
        c.restore();
      }
    }
  }

  hud(){ return { score: pose.players.map(() => this.coins), showLives: false, hideScore: true, hideClock: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) if (this.crew[i].played) rows.push({ label: `Player ${i + 1}`, value: this.coins, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.crew.filter(r => r.played).length < 2 ? null : -1; }
  value(){ return this.coins; }
}
