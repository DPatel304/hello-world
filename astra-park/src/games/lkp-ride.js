/* Last Known Position - the ride on Zubu: the level's reward, a calm
   ride home before "level clear".

   Zubu (lkp-zubu.js) is the huge, gentle sky-ray from the glade - half
   ray, half whale - gliding away up the path ahead; the crew sit in the
   moss garden on its head.

     chase   RUN TO CATCH UP: running on the spot - the team's average -
             closes the gap; it ambles on at WALK, and after WAIT seconds
             it stops and waits (nobody's left behind)
     board   caught up: it dips down, and up they climb into its garden
     relax   SIT DOWN AND RELAX: no steering, nothing to do - they sit on
             its head and it carries them along for RELAX seconds, a few
             crystals drifting into their hands
     off     it stops, they hop down, and off it wanders up the path

   Sitting down is fine while it lasts: the camera keeps players who sit
   (pose.keepSitters). */
import { drawZubu, ZUBU } from './lkp-zubu.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MarchWatch } from '../tracking/gestures.js';
import { P, RUN } from './lkp-art.js';
import { banner, smooth } from './lkp-zip.js';

/* How far ahead it is to start with (depths, and never further); its
   pace, ambling (of the game's SPEED); how fast the crew close the gap
   (depths a second, all-out - running harder, sooner: about 10 seconds
   running well); how close counts as caught; how long before it stops
   and waits for them (closing at WAITING then, running or not). */
export const START_GAP = 0.8, WALK = 0.7, CATCH_UP = 0.085, CATCH = 0.04, WAIT = 16, WAITING = 0.05;
/* Seconds: climbing on; sitting and riding along (at RIDE_PACE); getting
   off and waving it goodbye. */
export const BOARD = 2.6, RELAX = 22, RIDE_PACE = 0.75, OFF = 4;
/* Its size (screen heights, at the crew's depth), and how high its back
   is (of its size) - where the riders sit. */
export const SIZE = 0.62, BACK = 0.93;
/* Just ahead of the crew, where it stands to carry them (depths). */
const AHEAD = 0.02;
/* Where they sit along its back (lanes from its middle), by how many. */
const SEATS = { 1: [0], 2: [-0.13, 0.13], 3: [-0.2, 0, 0.2], 4: [-0.27, -0.09, 0.09, 0.27] };
/* A crystal drifting into someone's hands every so often, riding. */
const GIFT = 2.2;

/* (its name: lkp-levels.js GIANT) */

export class Ride {
  constructor(game, talk = false){
    this.g = game; this.t = 0; this.done = false; this.talk = talk;
    this.phase = 'chase'; this.pt = 0;
    this.gapV = START_GAP; this.d = game.z + RUN + AHEAD + this.gapV; this.lane = 0; this.closing = 0;
    this.riders = []; this.march = pose.players.map(() => 0);
    this.mw = pose.players.map(() => new MarchWatch());
    this.team = 0; this.walk = 1; this.step_ = 0; this.gift = 0;
    this.sitters = pose.keepSitters;
    this.met = false;
  }
  _say(key){ const l = this.g.level.lines[key]; if (l && this.talk) this.g.captain.say(l[0][1], l[0][2] || ''); }

  /* ---------- where things are ---------- */

  /* How far ahead of them it is (depths) - 0 once caught. */
  get gap(){ return Math.max(0, this.d - this.g.z - RUN - AHEAD); }
  /* On its back (or climbing on, or hopping down). */
  on(i){ return this.riders.includes(i) && (this.phase === 'board' || this.phase === 'relax' || (this.phase === 'off' && this.pt < 1.4)); }
  /* Sat on its back. */
  sitting(i){ return this.on(i) && this.lift(i, 1) > BACK * SIZE * 0.6; }
  get riding(){ return this.phase === 'relax'; }
  /* How fast down the path: theirs, chasing it; stopped to climb on;
     its pace, carrying them; slowing, to get down. */
  speed(run){
    if (this.phase === 'chase') return run * WALK * this.walk + this.closing;
    if (this.phase === 'board') return 0;
    if (this.phase === 'relax') return run * RIDE_PACE * smooth(this.pt / 2);
    return run * RIDE_PACE * Math.max(0, 1 - this.pt / 1);
  }
  /* The lane each rider's in, on its back. */
  seat(i){ const k = this.riders.indexOf(i), s = SEATS[this.riders.length] || SEATS[4]; return this.lane + (s[k] || 0); }
  /* How far up from the ground a rider is (px): climbing on, sat on its
     back (rocking with its stride), hopping down. */
  lift(i, H){
    const k = this.riders.indexOf(i);
    if (k < 0) return 0;
    let f = 1, arc = 0;
    if (this.phase === 'board'){
      const start = 0.7 + k * 0.3;
      f = smooth((this.pt - start) / 0.6); arc = Math.sin(f * Math.PI) * 0.12;
    } else if (this.phase === 'off'){
      f = 1 - smooth((this.pt - 0.6 - k * 0.12) / 0.6); arc = Math.sin(f * Math.PI) * 0.08;
    } else if (this.phase !== 'relax') return 0;
    return H * (f * BACK * SIZE * (1 - this.crouch * 0.12) + arc) - f * this.bob * H;
  }
  /* (how crouched it is, 0..1, for climbing on and off) */
  get crouch(){
    if (this.phase === 'board') return smooth(this.pt / 0.6) * (1 - smooth((this.pt - BOARD + 0.5) / 0.5));
    if (this.phase === 'off') return smooth((this.pt - 0.3) / 0.4) * (1 - smooth((this.pt - 1.6) / 0.5));
    return 0;
  }
  /* (its body rising and falling with its stride, screen heights) */
  get bob(){ return Math.abs(Math.sin(this.step_)) * 0.006 * this.walk; }

  /* ---------- the loop ---------- */

  step(dt, W = 1920, H = 1080){
    const g = this.g;
    /* (her word on it once the scene before - the robots waking - is over) */
    if (!this.met){ this.met = true; this._say('rideMeet'); }
    this.t += dt; this.pt += dt;
    for (const i of g.here) this.march[i] = g.marchOf ? g.marchOf(i, dt) : this.mw[i].step(pose.players[i], dt, pose.mouse.active);
    const was = this.step_;
    if (this.phase === 'chase'){
      const here = g.here;
      this.team = here.length ? here.reduce((s, i) => s + this.march[i], 0) / here.length : 0;
      /* ambling on - till it's waited long enough, then it stops for them */
      const want = this.pt < WAIT ? 1 : 0;
      this.walk += (want - this.walk) * Math.min(1, dt * 1.2);
      /* the crew gaining on it as they run - however they run, once it's waiting */
      this.closing = Math.max(CATCH_UP * this.team, this.pt > WAIT ? WAITING : 0);
      this.gapV = Math.max(0, this.gapV - this.closing * dt);
      this.d = g.z + RUN + AHEAD + this.gapV;
      this.step_ += dt * 3.2 * this.walk;
      if (this.gapV <= CATCH){
        this.phase = 'board'; this.pt = 0; this.walk = 0;
        this.riders = [...here].sort((a, b) => g.crew[a].x - g.crew[b].x);
        sfx.whoosh();
      }
    } else if (this.phase === 'board'){
      this.d = g.z + RUN + AHEAD;
      for (const i of this.riders){
        const start = 0.7 + this.riders.indexOf(i) * 0.3;
        if (this.pt - dt < start && this.pt >= start) sfx.boing(1);
      }
      if (this.pt >= BOARD){
        this.phase = 'relax'; this.pt = 0;
        pose.keepSitters = true;
        this._say('rideOn');
        /* (and out there, as they ride: old friends - sky jellies drifting
           by at their height, the glimmerbacks grazing off in a field, and
           far away on the land's edge the great legs, striding along) */
        const d0 = g.z + RUN + AHEAD;
        for (let k = 0; k < 6; k++) g.things.push({ d: d0 + 0.9 + k * 0.35, kind: 'skyjelly', lane: (k % 2 ? 1 : -1) * (1.15 + 0.4 * (k % 3)), alt: 0.24 + 0.08 * (k % 2), vl: 0.03, vd: 0.006, size: 0.9, n: 40 + k });
        for (let k = 0; k < 14; k++) g.things.push({ d: d0 + 1.6 + (k % 5) * 0.12, kind: 'grazer', lane: -1.7 - (k % 7) * 0.26 - Math.floor(k / 7) * 0.15, n: k });
        g.things.push({ d: d0 + 3.0, kind: 'farGiant', lane: 3.0 });
      }
    } else if (this.phase === 'relax'){
      this.d = g.z + RUN + AHEAD;
      this.walk += (1 - this.walk) * Math.min(1, dt);
      this.step_ += dt * 2.4 * this.walk;
      /* a crystal now and then, drifting into someone's hands */
      this.gift += dt;
      if (this.gift >= GIFT && this.riders.length){
        this.gift = 0;
        const i = this.riders[Math.floor(this.t * 7) % this.riders.length], p = P(this.seat(i), RUN, W, H), y = (p.y - this.lift(i, H) - H * 0.12) / H;
        g.gain(1, p.x / W, y); sfx.jar(1 + (g.crystals % 8)); g._sparkle(p.x / W, y, 5, 185);
      }
      if (this.pt >= RELAX){ this.phase = 'off'; this.pt = 0; this._say('rideOff'); }
    } else if (this.phase === 'off'){
      this.walk *= Math.exp(-dt * 3);
      if (this.pt < 1.6) this.d = g.z + RUN + AHEAD;
      else {
        /* off it wanders, up the path */
        this.walk = Math.min(1, this.walk + dt * 3);
        this.d += 0.3 * WALK * 1.2 * dt; this.step_ += dt * 3.2;
      }
      if (this.pt >= OFF){ this.done = true; pose.keepSitters = this.sitters; }
    }
    /* each footfall, a soft heavy thump */
    if (Math.floor(this.step_ / Math.PI) !== Math.floor(was / Math.PI)) sfx.step(1, 0.35);
  }

  /* ---------- drawing ---------- */

  items(items){ items.push({ kind: 'ride', rel: this.d - this.g.z }); }

  draw(c, W, H){
    const rel = this.d - this.g.z, p = P(this.lane, rel, W, H);
    /* fading away into the haze, at the end */
    const fade = this.phase === 'off' ? 1 - smooth((this.pt - OFF + 1.2) / 1.2) : 1;
    if (fade <= 0) return;
    c.save(); c.globalAlpha = fade;
    drawZubu(c, p.x, p.y, H * SIZE * p.k, this.t, { step: this.step_, walk: this.walk, crouch: this.crouch, bob: this.bob * H * p.k });
    c.restore();
  }

  /* Over the riders' legs: the moss along its back they're sat in. */
  drawTop(c, W, H){
    if (!(this.phase === 'relax' || this.phase === 'board' && this.pt > 1.2 || this.phase === 'off' && this.pt < 0.8)) return;
    const rel = this.d - this.g.z, p = P(this.lane, rel, W, H), s = H * SIZE * p.k, y = p.y - s * BACK * (1 - this.crouch * 0.12) + this.bob * H * p.k;
    /* the front edge of its garden, over their legs: tufts and flowers */
    c.save(); c.lineCap = 'round';
    for (let k = -8; k <= 8; k++){
      const x = p.x + k / 8 * s * 0.4, yy = y + s * 0.035 + Math.abs(k) * s * 0.003, l = s * (0.03 + 0.01 * ((k * 7 + 24) % 3));
      c.strokeStyle = ZUBU.moss[(k + 8) % 3]; c.lineWidth = Math.max(1, s * 0.01); c.beginPath(); c.moveTo(x, yy + l * 0.3); c.quadraticCurveTo(x + l * 0.2, yy - l * 0.4, x + Math.sin(this.t * 1.5 + k) * l * 0.2, yy - l * 0.7); c.stroke();
      if ((k + 8) % 4 === 0){ c.fillStyle = ['#ffc4d8', '#fff3d6', '#ffe39a', '#d8c8ff'][((k + 8) / 4) % 4]; c.beginPath(); c.arc(x, yy - l * 0.5, s * 0.012, 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
  }

  /* The words: catch up (and how close), climb on, sit and relax. */
  marks(c, W, H){
    if (this.phase === 'chase'){
      banner(c, W, H, this.pt > WAIT && this.walk < 0.3 ? 'ZUBU\'S WAITING - RUN!' : 'RUN TO CATCH UP!', '#ffd24a', 1 + 0.03 * Math.sin(this.t * 6));
      /* how close: a bar filling as they gain on it */
      const w = W * 0.3, x = (W - w) / 2, y = H * 0.28, h = H * 0.024, u = Math.max(0, Math.min(1, 1 - this.gap / START_GAP));
      c.save();
      c.fillStyle = 'rgba(5,6,15,.7)'; c.beginPath(); c.roundRect(x - 4, y - 4, w + 8, h + 8, h); c.fill();
      c.fillStyle = '#7ff3ff'; c.beginPath(); c.roundRect(x, y, Math.max(h, w * u), h, h / 2); c.fill();
      c.restore();
      return;
    }
    if (this.phase === 'board' && this.pt > 0.5) banner(c, W, H, 'CLIMB ON!', '#7ff3ff', 1.1);
    if (this.phase === 'relax' && this.pt < 6) banner(c, W, H, 'SIT DOWN AND RELAX', '#bdf7ff', 1 + 0.02 * Math.sin(this.t * 2));
    if (this.phase === 'relax') for (const i of this.riders){
      /* (a little heart over each, now and then: comfy) */
      const f = ((this.t * 0.35 + i * 0.27) % 1);
      if (f > 0.4) continue;
      const p = P(this.seat(i), RUN, W, H), x = p.x + H * 0.03, y = p.y - this.lift(i, H) - H * (0.22 + f * 0.15);
      c.save(); c.globalAlpha = Math.sin(f / 0.4 * Math.PI) * 0.8; c.fillStyle = PLAYER_COLORS[i];
      c.font = `${Math.round(H * 0.035)}px sans-serif`; c.textAlign = 'center'; c.fillText('♥', x, y); c.restore();
    }
  }
}

/* Zubu out in the world, rel ahead in lane, standing still (for a
   picture: the home screen's trailer). */
export function worldMossy(c, W, H, rel, lane, t){
  const p = P(lane, rel, W, H);
  drawZubu(c, p.x, p.y, H * SIZE * p.k, t, {});
}
