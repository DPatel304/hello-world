/* Last Known Position - Mossy, after the boss: the level's reward, a calm
   ride home before "level clear".

   Mossy is a huge, gentle, long-necked dinosaur (all lilac, moss along
   its back, little glowing flowers), ambling away up the path ahead.

     chase   RUN TO CATCH UP: running on the spot - the team's average -
             closes the gap; it ambles on at WALK, and after WAIT seconds
             it stops and waits (nobody's left behind)
     board   caught up: it crouches, and up they climb onto its back
     relax   SIT DOWN AND RELAX: no steering, nothing to do - they sit on
             its back and it carries them along for RELAX seconds, a few
             crystals drifting into their hands
     off     it stops, they hop down, and off it wanders up the path

   Sitting down is fine while it lasts: the camera keeps players who sit
   (pose.keepSitters). */
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MarchWatch } from '../tracking/gestures.js';
import { P, RUN } from './lkp-art.js';
import { glow } from './lkp-world.js';
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

export const MOSSY = { skin: '#b9a8e6', light: '#d8cdf6', shade: '#8c7cc6', dark: '#5f5196', belly: '#f6eed6',
  moss: ['#7cc98f', '#4f9e6e'], glow: '#bdf7ff', leaf: '#9be27a', bulb: '#ff8cd8', nail: '#fff4dc', spot: 'rgba(95,81,150,.25)',
  neck: 1, spine: 'moss', ears: false };
/* The looks it can have (being chosen): colours, how long its neck, and
   what grows along its back. */
export const LOOKS = {
  lilac: { ...MOSSY },
  leafy: { skin: '#7fc48a', light: '#b5e6b0', shade: '#5a9e6c', dark: '#3c6e52', belly: '#f3ecc8', moss: ['#ffb24d', '#f07a3a'], glow: '#fff3a6',
    leaf: '#c6f07a', bulb: '#ffd24a', nail: '#fff4dc', spot: 'rgba(240,160,70,.35)', neck: 0.55, spine: 'leaves', ears: false },
  fluffy: { skin: '#f3d9e6', light: '#fff4fa', shade: '#d9aac4', dark: '#a7708f', belly: '#fffaf0', moss: ['#ffffff', '#f6e3ee'], glow: '#ffe1f4',
    leaf: '#9be27a', bulb: '#ff8cd8', nail: '#ffffff', spot: 'rgba(255,255,255,.4)', neck: 0.35, spine: 'fluff', ears: true },
  starry: { skin: '#4a68c9', light: '#7f9cf0', shade: '#34489a', dark: '#232f6b', belly: '#dfe8ff', moss: ['#6ff6ff', '#b28cff'], glow: '#ffffff',
    leaf: '#7ff3e0', bulb: '#6ff6ff', nail: '#dfe8ff', spot: 'rgba(255,255,255,.18)', neck: 1.2, spine: 'crystals', ears: false }
};
export function setLook(name){ Object.assign(MOSSY, LOOKS[name] || LOOKS.lilac); }

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
    drawMossy(c, p.x, p.y, H * SIZE * p.k, this.t, { step: this.step_, walk: this.walk, crouch: this.crouch, bob: this.bob * H * p.k, look: this.phase === 'off' && this.pt > 0.8 && this.pt < 2.4 ? 1 : 0 });
    c.restore();
  }

  /* Over the riders' legs: the moss along its back they're sat in. */
  drawTop(c, W, H){
    if (!(this.phase === 'relax' || this.phase === 'board' && this.pt > 1.2 || this.phase === 'off' && this.pt < 0.8)) return;
    const rel = this.d - this.g.z, p = P(this.lane, rel, W, H), s = H * SIZE * p.k, y = p.y - s * BACK * (1 - this.crouch * 0.12) + this.bob * H * p.k;
    c.save();
    for (let k = -6; k <= 6; k++){
      const x = p.x + k / 6 * s * 0.42, r = s * (0.018 + 0.006 * ((k * 7 + 21) % 3));
      c.fillStyle = MOSSY.moss[(k + 6) % 2]; c.beginPath(); c.ellipse(x, y + s * 0.03 + Math.abs(k) * s * 0.004, r * 1.6, r * 0.6, 0, 0, Math.PI * 2); c.fill();
      if (k % 3 === 0){ glow(c, x, y - r * 0.2, r * 1.5, MOSSY.bulb, 0.45); c.fillStyle = MOSSY.bulb; c.beginPath(); c.arc(x, y - r * 0.2, r * 0.35, 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
  }

  /* The words: catch up (and how close), climb on, sit and relax. */
  marks(c, W, H){
    if (this.phase === 'chase'){
      banner(c, W, H, this.pt > WAIT && this.walk < 0.3 ? 'MOSSY\'S WAITING - RUN!' : 'RUN TO CATCH UP!', '#ffd24a', 1 + 0.03 * Math.sin(this.t * 6));
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

/* Mossy from behind, standing on the ground at (x, y), s tall (to the top
   of its back; its neck and head rise well above). o: step (its stride),
   walk (0..1: walking), crouch (0..1), bob (px), look (0..1: its head
   turned back to look at them). */
export function drawMossy(c, x, y, s, t, o = {}){
  const walk = o.walk ?? 0, step = o.step || 0, crouch = o.crouch || 0, bob = o.bob || 0;
  const leg = s * (0.42 - crouch * 0.12);                 /* legs: ground to belly */
  const by = y - leg + bob, rx = s * 0.6, ry = s * 0.36;   /* the body */
  const cy = by - ry * 0.45, top = cy - ry;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  /* its shadow */
  c.fillStyle = 'rgba(10,20,25,.3)'; c.beginPath(); c.ellipse(x, y, rx * 1.15, s * 0.09, 0, 0, Math.PI * 2); c.fill();
  /* the neck, rising away from us, swaying; its small head at the top */
  const sway = Math.sin(t * 0.7) * s * 0.06 + (o.look || 0) * s * 0.28;
  const nx = x + sway, ny = top - s * 0.75 * MOSSY.neck;
  const neck = (w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, cy - ry * 0.4); c.bezierCurveTo(x, top - s * 0.3, nx - sway * 0.3, ny + s * 0.25, nx, ny); c.stroke(); };
  neck(s * 0.24, MOSSY.dark); neck(s * 0.2, MOSSY.shade); neck(s * 0.11, MOSSY.skin);
  /* little glowing freckles down the neck */
  for (let k = 0; k < 4; k++){ const u = 0.25 + k * 0.17; c.fillStyle = MOSSY.glow; c.globalAlpha *= 0.8; c.beginPath(); c.arc(x + (nx - x) * u * u + s * 0.05, cy - ry * 0.4 + (ny - cy + ry * 0.4) * u, s * 0.012, 0, Math.PI * 2); c.fill(); c.globalAlpha /= 0.8; }
  /* the head: from behind, a rounded dome; turned back, a smiling face */
  if (MOSSY.ears) for (const d of [-1, 1]){ c.fillStyle = MOSSY.shade; c.beginPath(); c.arc(nx + d * s * 0.12, ny - s * 0.1, s * 0.06, 0, Math.PI * 2); c.fill(); c.fillStyle = MOSSY.bulb; c.beginPath(); c.arc(nx + d * s * 0.12, ny - s * 0.1, s * 0.03, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = MOSSY.shade; c.beginPath(); c.ellipse(nx, ny - s * 0.03, s * 0.13, s * 0.1, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = MOSSY.skin; c.beginPath(); c.ellipse(nx - s * 0.02, ny - s * 0.05, s * 0.1, s * 0.075, 0, 0, Math.PI * 2); c.fill();
  if (o.look){
    const d = sway > 0 ? 1 : -1;
    c.fillStyle = '#2b2350'; c.beginPath(); c.arc(nx + d * s * 0.06, ny - s * 0.06, s * 0.018, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#4a3a78'; c.lineWidth = Math.max(1.5, s * 0.01); c.beginPath(); c.arc(nx + d * s * 0.08, ny - s * 0.02, s * 0.03, 0.1 * Math.PI, 0.8 * Math.PI); c.stroke();
    c.fillStyle = 'rgba(247,140,180,.6)'; c.beginPath(); c.ellipse(nx + d * s * 0.09, ny - s * 0.01, s * 0.02, s * 0.012, 0, 0, Math.PI * 2); c.fill();
  }
  /* a sprout on its head, a glowing bulb at the tip */
  const tip = { x: nx + Math.sin(t * 2) * s * 0.03, y: ny - s * 0.2 };
  c.strokeStyle = MOSSY.moss[1]; c.lineWidth = Math.max(1.5, s * 0.012);
  c.beginPath(); c.moveTo(nx, ny - s * 0.1); c.quadraticCurveTo(nx, ny - s * 0.15, tip.x, tip.y); c.stroke();
  for (const d of [-1, 1]){ c.fillStyle = MOSSY.leaf; c.beginPath(); c.ellipse(nx + d * s * 0.03, ny - s * 0.14, s * 0.035, s * 0.014, d * 0.5, 0, Math.PI * 2); c.fill(); }
  glow(c, tip.x, tip.y, s * 0.08, MOSSY.bulb, 0.6 + 0.2 * Math.sin(t * 3));
  c.fillStyle = MOSSY.bulb; c.beginPath(); c.arc(tip.x, tip.y, s * 0.025, 0, Math.PI * 2); c.fill();
  /* the far legs (the front ones), between the near ones and a little up */
  const legAt = (lx, ph, w, far) => {
    const lift = walk * Math.max(0, Math.sin(step + ph)) * s * 0.05, foot = y - (far ? s * 0.035 : 0) - lift, h = foot - (by - ry * 0.2);
    c.fillStyle = far ? MOSSY.dark : MOSSY.shade; c.beginPath(); c.roundRect(lx - w, by - ry * 0.2, w * 2, h, [w * 0.6, w * 0.6, w * 0.45, w * 0.45]); c.fill();
    if (!far){ c.fillStyle = MOSSY.skin; c.beginPath(); c.roundRect(lx - w * 0.85, by - ry * 0.2, w * 0.7, h * 0.95, w * 0.4); c.fill(); }
    c.fillStyle = MOSSY.nail; for (const k of [-1, 0, 1]){ c.beginPath(); c.ellipse(lx + k * w * 0.55, foot - w * 0.08, w * 0.22, w * 0.14, 0, 0, Math.PI * 2); c.fill(); }
  };
  legAt(x - rx * 0.38, Math.PI, s * 0.075, true); legAt(x + rx * 0.38, 0, s * 0.075, true);
  /* the body: a great round back, lit from the top left */
  const gr = c.createRadialGradient(x - rx * 0.35, cy - ry * 0.55, s * 0.05, x, cy, rx * 1.1);
  gr.addColorStop(0, MOSSY.light); gr.addColorStop(0.5, MOSSY.skin); gr.addColorStop(1, MOSSY.shade);
  c.fillStyle = MOSSY.dark; c.beginPath(); c.ellipse(x, cy, rx * 1.02, ry * 1.03, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = gr; c.beginPath(); c.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2); c.fill();
  /* soft patterned spots, and moss and flowers along its spine */
  c.fillStyle = MOSSY.spot;
  for (const [mx, my, mr] of [[-0.6, 0.1, 0.1], [0.55, 0.2, 0.09], [-0.3, 0.45, 0.07], [0.3, -0.25, 0.08], [0.75, -0.1, 0.06]]){ c.beginPath(); c.ellipse(x + mx * rx, cy + my * ry, mr * s, mr * s * 0.65, 0.3, 0, Math.PI * 2); c.fill(); }
  /* fluffy: soft tufts all round its outline */
  if (MOSSY.spine === 'fluff') for (let k = 0; k < 30; k++){
    const a = Math.PI + k / 29 * Math.PI, r = s * (0.05 + 0.015 * (k % 3));
    c.fillStyle = MOSSY.moss[k % 2]; c.beginPath(); c.arc(x + Math.cos(a) * rx * 0.98, cy + Math.sin(a) * ry * 0.98, r, 0, Math.PI * 2); c.fill();
  }
  for (let k = -5; k <= 5; k++){
    const u = k / 5, mx = x + u * rx * 0.75, my = top + ry * (1 - Math.sqrt(1 - u * u * 0.56)) + s * 0.01, r = s * (0.035 + 0.01 * ((k + 5) % 3));
    if (MOSSY.spine === 'leaves' && k % 2 === 0){
      /* big leaves standing up along its back */
      c.fillStyle = MOSSY.moss[(k / 2 + 3) % 2]; c.beginPath(); c.moveTo(mx - r * 1.4, my + r * 0.4); c.quadraticCurveTo(mx - r * 1.3, my - r * 2.5, mx, my - r * 3.4); c.quadraticCurveTo(mx + r * 1.3, my - r * 2.5, mx + r * 1.4, my + r * 0.4); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = Math.max(1, r * 0.12); c.beginPath(); c.moveTo(mx, my + r * 0.3); c.lineTo(mx, my - r * 3); c.stroke();
      continue;
    }
    if (MOSSY.spine === 'crystals' && k % 2 === 0){
      /* glowing crystals growing out of its back */
      glow(c, mx, my - r * 1.5, r * 3, MOSSY.moss[0], 0.5);
      c.fillStyle = MOSSY.moss[(k / 2 + 3) % 2]; c.beginPath(); c.moveTo(mx - r * 0.8, my + r * 0.3); c.lineTo(mx - r * 0.4, my - r * 2.6); c.lineTo(mx, my - r * 3.2); c.lineTo(mx + r * 0.4, my - r * 2.6); c.lineTo(mx + r * 0.8, my + r * 0.3); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(mx - r * 0.2, my); c.lineTo(mx - r * 0.3, my - r * 2.4); c.lineTo(mx, my - r * 3); c.fill();
      continue;
    }
    if (MOSSY.spine === 'fluff') continue;
    c.fillStyle = MOSSY.moss[(k + 5) % 2]; c.beginPath(); c.ellipse(mx, my, r * 1.5, r * 0.75, 0, 0, Math.PI * 2); c.fill();
    if ((k + 5) % 3 === 0){ glow(c, mx, my - r * 0.3, r * 1.4, MOSSY.bulb, 0.45); c.fillStyle = MOSSY.bulb; c.beginPath(); c.arc(mx, my - r * 0.3, r * 0.3, 0, Math.PI * 2); c.fill(); }
  }
  for (let k = 0; k < 6; k++) for (const d of [-1, 1]){
    c.fillStyle = MOSSY.glow; c.globalAlpha *= 0.6 + 0.4 * Math.sin(t * 2 + k); c.beginPath(); c.arc(x + d * rx * (0.88 - k * 0.06), cy - ry * 0.1 + k * ry * 0.13, s * 0.011, 0, Math.PI * 2); c.fill(); c.globalAlpha /= 0.6 + 0.4 * Math.sin(t * 2 + k);
  }
  /* the near legs (the back ones), thick, either side */
  legAt(x - rx * 0.62, 0, s * 0.11, false); legAt(x + rx * 0.62, Math.PI, s * 0.11, false);
  /* the tail: thick at its root, curving down towards us and off to one
     side along the ground, swaying */
  const ts = Math.sin(t * 1.1) * s * 0.12;
  const tail = (w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, cy + ry * 0.55); c.bezierCurveTo(x, y + s * 0.02, x + s * 0.25 + ts, y + s * 0.12, x + s * 0.5 + ts * 1.6, y + s * 0.17); c.stroke(); };
  tail(s * 0.2, MOSSY.dark); tail(s * 0.16, MOSSY.shade); tail(s * 0.08, MOSSY.skin);
  c.restore();
}

/* Mossy out in the world, rel ahead in lane, standing still (for a
   picture: the home screen's trailer). */
export function worldMossy(c, W, H, rel, lane, t){
  const p = P(lane, rel, W, H);
  drawMossy(c, p.x, p.y, H * SIZE * p.k, t, {});
}
