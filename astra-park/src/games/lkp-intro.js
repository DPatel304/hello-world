/* Last Known Position's opening: picked from the console, it doesn't throw
   you straight in - it shows you where you are, and lets your body do it.
   A scripted run of beats (INTRO_BEATS), each a shot, who's where, and
   what moves it on; the timed ones run themselves, the interactive ones
   wait on the players - but never forever (max).

   It's all filmed in the game's own world - the crash site's one layout
   (lkp-crashsite.js SITE), the path already there - through a camera on
   the game's own view: each shot holds still, and the camera moves only
   between them. The last move pulls back to exactly the game's view as
   the crew walk from the pond onto the path, and play carries on. The
   game holds still till it's done.

   Earnest adventure - no jokes. The commander's radio window and
   subtitles are lkp-captain.js's Radio; the crash site, the pond and its
   healing light are lkp-crashsite.js; the wiggle and the hand at the ear
   are the game's own watchers. */
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MoveWatch, HugWatch } from '../tracking/gestures.js';
import { P } from './lkp-art.js';
import { glow, SKY } from './lkp-world.js';
import { SITE, pondBeauty, healRipple, healNumber } from './lkp-crashsite.js';
import { CREW_SIZE } from './lkp-game.js';
import { Radio, script } from './lkp-captain.js';

/* The beats, in order: the shot, who's where, and what moves it on.
   time: timed, seconds; until: waits on the players, but never longer
   than max. */
export const INTRO_BEATS = [
  { id: 'wreck', time: 9, shot: 'space: holding on the stars, no title; then panning slowly down through the sky, past the ship\'s trail and its smoke, onto the crash site - the site shot', blocking: 'the crew out cold on the grass by the ship; smoke rising' },
  { id: 'wake', until: 'everyone standing', max: 20, shot: 'the site shot, held', blocking: 'each player\'s wiggle wakes theirs - a twitch, sitting up, standing' },
  { id: 'call', until: 'everyone answered', max: 15, shot: 'the site shot, held', blocking: 'a radio pulsing over each head; a hand to the ear answers it - a tick' },
  { id: 'brief', until: 'her lines said', lines: 'brief', shot: 'the site shot, held', blocking: 'the team waits; her window top left' },
  { id: 'pond', until: 'everyone at full health', max: 30, shot: 'the camera moves across to the pond shot as they set off, then holds', blocking: 'they walk over on their own, across the path; in the water they heal to full, smoothly - hugging, faster' },
  { id: 'go', until: 'they\'re on the path', lines: 'go', shot: 'the camera pulls back to the game\'s own view', blocking: 'they walk from the pond onto the path, to where play starts' }
];
const BEAT = Object.fromEntries(INTRO_BEATS.map(b => [b.id, b]));
export const WRECK = BEAT.wreck.time;
/* The shots: the game's own view, looking at (cx, cy) - in screens - s
   times closer. space: way up above the site; site: the crew out cold,
   the ship behind them; pond: the pond, the path's edge on the left;
   play: the game's own view. */
const SHOT = {
  space: { cx: 0.36, cy: -2.3, s: 1.7 },
  site: { cx: 0.3, cy: 0.57, s: 1.7 },
  pond: { cx: 0.6875, cy: 0.62, s: 1.6 },
  play: { cx: 0.5, cy: 0.5, s: 1 }
};
/* The opening: in from black over FADE_IN, holding on the stars for
   HOLD_SPACE; the camera's moves between other shots take MOVE. */
const FADE_IN = 1.2, HOLD_SPACE = 1.8, MOVE = 2.5;
/* (How long till the crew are lying there to be woken.) */
export const WAKE = WRECK;
/* Waking up: moving (body sizes a second) more than STIR counts; WIGGLE
   seconds of it and you're up, taking UP seconds to stand. */
export const STIR = 0.45, WIGGLE = 1.2, UP = 0.8;
/* The call: a hand held at the ear HOLD seconds answers it. */
export const HOLD = 0.4;
/* The pond: they walk over (STRIDE lanes a second); in it, healing FILL of
   their health a second (twice that hugging themselves). They start on
   START of their health. Then OUT seconds walking onto the path. */
export const STRIDE = 1.1, FILL = 0.16, START = 0.5, OUT = 3;
export const CRASH_MAX = BEAT.wake.max, RING_MAX = BEAT.call.max, POND_MAX = BEAT.pond.max;
/* A moment after the last one's up. */
const AFTER = 0.8;

export class Intro {
  constructor(game){
    this.g = game; this.kind = 'intro'; this.done = false;
    this.k = 0; this.stage = INTRO_BEATS[0].id; this.st = 0; this.t = 0;
    this.moves = pose.players.map(() => new MoveWatch());
    this.hugs = pose.players.map(() => new HugWatch());
    this.woke = pose.players.map(() => 0);       /* how much wiggle, 0..WIGGLE */
    this.up = pose.players.map(() => 0);         /* standing up, 0..1 */
    this.ear = pose.players.map(() => 0);        /* how long a hand's been at the ear */
    this.answered = pose.players.map(() => false);
    this.hugging = pose.players.map(() => false);
    this.pos = null;                              /* where each stands, [lane, rel] */
    this.fx = [];                                 /* ripples and numbers off the healing */
    this.radio = new Radio(); this.radio.visible = false; this.radio.top = 0.11;
  }
  get beat(){ return INTRO_BEATS[this.k]; }
  _next(){
    this.k++; this.st = 0; this.afterT = 0;
    if (this.k >= INTRO_BEATS.length){ this.done = true; return; }
    this.stage = this.beat.id;
    const on = BEGIN[this.stage]; if (on) on.call(this);
  }

  step(dt){
    if (this.done) return;
    this.t += dt; this.st += dt;
    const g = this.g;
    /* Knocked about in the crash: half health, till the pond. */
    if (!this.hurt){ this.hurt = true; for (const rn of g.crew) rn.hp = Math.round(rn.max * START); }
    for (const f of this.fx) f.age += dt * (f.kind === 'ripple' ? 0.8 : 1.2);
    this.fx = this.fx.filter(f => f.age < 1);
    this.radio.step(dt);
    const b = this.beat;
    const over = STEP[b.id].call(this, dt);
    if (over || (b.time && this.st >= b.time) || (b.max && this.st >= b.max && (FORCE[b.id] ? (FORCE[b.id].call(this), true) : true))) this._next();
  }

  /* Hand to the ear: a wrist up beside the head, near where the ear is.
     With the mouse, up at the top of the screen. */
  _atEar(i){
    const p = pose.players[i];
    if (!p || !p.present) return false;
    if (pose.mouse.active) return p.hands.right && p.hands.right.y < 0.25;
    const lm = p.lm; if (!lm) return false;
    const sw = Math.hypot(lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x, lm[L.L_SHOULDER].y - lm[L.R_SHOULDER].y) || 0.1;
    const head = lm[L.NOSE];
    return [L.L_WRIST, L.R_WRIST].some(j => (lm[j].v ?? 1) > 0.4
      && lm[j].y < lm[L.L_SHOULDER].y + sw * 0.1 && lm[j].y > head.y - sw * 0.8
      && Math.abs(lm[j].x - head.x) < sw * 1.0 && Math.abs(lm[j].x - head.x) > sw * 0.15);
  }

  /* ---------- where they are ---------- */

  /* Where each one comes down: their own spot on the grass (SITE.lying),
     the first of them nearest. [lane, rel] */
  _place(){
    const here = this.g.here;
    this.pos = this.g.crew.map((_, i) => { const k = Math.max(0, here.indexOf(i)); return [...SITE.lying[k % SITE.lying.length]]; });
    for (const i of here){ this.g.crew[i].played = true; this.g.crew[i].x = this.g._home(i); }
  }
  /* Their place in the water, round its middle. */
  _slot(i){
    const here = this.g.here, k = Math.max(0, here.indexOf(i)), n = here.length;
    return [SITE.pond[0] + (k - (n - 1) / 2) * SITE.spread, SITE.pond[1] + [0, 0.03, -0.02, 0.04][k % 4]];
  }
  _at(i, W, H){
    if (!this.pos) this._place();
    const [lane, rel] = this.pos[i], p = P(lane, rel, W, H);
    return { x: p.x, y: p.y, h: H * CREW_SIZE * p.k, rel, lane };
  }
  _inPond(i){ const [pl, pr, r] = SITE.pond, [lane, rel] = this.pos[i]; return Math.abs(lane - pl) < r * 1.15 && Math.abs(rel - pr) < r * 0.3; }

  /* ---------- the camera ---------- */

  /* Each shot holds still; the camera only moves between them. A shot:
     the game's own view, looking at (cx, cy) - in screens - s times
     closer. (Never past the view's own edges, except up into the sky.) */
  _cam(W, H){
    const st = this.st, f = (a, b, u) => lerp(SHOT[a], SHOT[b], smooth(u));
    let v;
    switch (this.stage){
      /* holding on the stars; then down through the sky, past the smoke,
         onto the crash site */
      case 'wreck': v = f('space', 'site', (st - HOLD_SPACE) / (WRECK - HOLD_SPACE - 0.6)); break;
      case 'pond': v = f('site', 'pond', st / MOVE); break;
      case 'go': v = f('pond', 'play', st / OUT); break;
      default: v = SHOT.site;
    }
    return { cx: v.cx * W, cy: v.cy * H, s: v.s };
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    const g = this.g, s = this.stage, cam = this._cam(W, H);
    if (!this.pos) this._place();
    /* the crew where the opening has them, lying, waking, walking */
    const keep = g.crew.map(rn => [rn.run, rn.runPh, rn.lean, rn.heal]);
    const healing = s === 'pond' || s === 'go';
    g.introCrew = g.here.map(i => {
      const rn = g.crew[i], moving = this.walking && this.walking[i];
      rn.run = moving ? 1 : 0; rn.lean = 0;
      rn.heal = healing && this._inPond(i) ? 0.6 : 0;
      const twitch = this.woke[i] > 0 && this.up[i] < 0.2 ? Math.sin(this.t * 30) * 0.01 : 0;
      return { i, lane: this.pos[i][0], rel: this.pos[i][1], dx: twitch, down: 1 - easeOut(this.up[i]), noBar: !healing, pose: this.hugging[i] ? 'hug' : null };
    });
    g.inIntro = true; SKY.above = H * 2.8;
    g.introDraw = (c2) => this._world(c2, W, H);
    c.save();
    c.translate(W / 2, H / 2); c.scale(cam.s, cam.s); c.translate(-cam.cx, -cam.cy);
    g._drawPlay(c, W, H);
    this._marks(c, W, H);
    c.restore();
    g.introDraw = null; g.introCrew = null; g.inIntro = false; SKY.above = 0;
    g.crew.forEach((rn, i) => { [rn.run, rn.runPh, rn.lean, rn.heal] = keep[i]; });
    /* letterboxed till they set off */
    this._bars(c, W, H, s === 'go' ? 1 - smooth(this.st / 0.8) : 1);
    if (s === 'wake' && g.here.some(i => this.woke[i] < WIGGLE)) banner(c, W, H, 'WIGGLE TO WAKE UP!', '#ffd24a', 1 + 0.03 * Math.sin(this.t * 6));
    if (s === 'call') banner(c, W, H, 'HAND TO YOUR EAR TO ANSWER', '#7ff3ff', 1 + 0.03 * Math.sin(this.t * 6));
    if (s === 'pond' && g.here.some(i => this._inPond(i) && g.crew[i].hp < g.crew[i].max)) banner(c, W, H, 'HUG YOURSELF TO HEAL FASTER!', '#ff9ccb', 1 + 0.03 * Math.sin(this.t * 6));
    this.radio.draw(c, W, H);
    /* in from black */
    if (s === 'wreck' && this.st < FADE_IN){ c.fillStyle = `rgba(0,0,0,${1 - this.st / FADE_IN})`; c.fillRect(0, 0, W, H); }
  }

  _bars(c, W, H, k){
    if (k <= 0) return;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H * 0.09 * k); c.fillRect(0, H * (1 - 0.09 * k), W, H * 0.09 * k);
  }

  /* In the world, before the light's laid over it: the stars and the
     smoke up in the sky, the pond's light, the dizzy stars. */
  _world(c, W, H){
    const s = this.stage, t = this.t;
    if (s === 'wreck'){
      /* the stars, up where the sky turns to space */
      for (let n = 0; n < 160; n++){
        const y = -H * (0.95 + hash(n + 1) * 1.9), a = Math.min(1, (-y / H - 0.95) / 0.7) * (0.55 + 0.45 * Math.sin(t * (1 + hash(n + 3) * 2) + n));
        c.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`; circ(c, hash(n + 2) * W, y, H * (0.0012 + hash(n + 4) * 0.0022));
      }
      /* the way the ship came down: a long trail out of space, drifting apart */
      for (let k = 0; k < 60; k++){
        const u = k / 59, x = W * (0.2 + 0.42 * u) + Math.sin(u * 9 + t * 0.15) * W * 0.012 * u, y = -H * (0.55 + 2.6 * u);
        glow(c, x, y, H * (0.035 + 0.07 * u), u > 0.8 ? '#e0a27a' : '#a4a8bf', 0.7 * (1 - u * 0.55));
      }
    }
    /* the smoke off the ship, on up into the sky */
    if (s === 'wreck'){
      for (const [ox, seed] of [[0.15, 0], [0.29, 5]]){
        for (let k = 0; k < 22; k++){
          const u = k / 21, x = W * (ox + 0.08 * u * u) + Math.sin(u * 5 + t * 0.25 + seed) * W * 0.02, y = H * (0.08 - 1.3 * u);
          glow(c, x, y, H * (0.07 + 0.14 * u), '#5e5f72', 0.9 * (1 - u * 0.9));
        }
      }
    }
    if (s === 'pond' || s === 'go'){ const [pl, pr, ps] = SITE.pond; pondBeauty(c, W, H, pl, pr, t, this.g.level.palette.world, ps, (s === 'go' ? 1 - smooth(this.st / OUT) : smooth(Math.min(1, this.st / 3)))); }
    if (s === 'wreck' || s === 'wake') this._dizzy(c, W, H);
    for (const f of this.fx) if (f.kind === 'ripple'){ const a = this._at(f.i, W, H); healRipple(c, a.x, a.y, a.h * 0.9, f.age); }
  }

  /* Over the world, in it: how far each has wiggled, the radios, the +5s. */
  _marks(c, W, H){
    const s = this.stage;
    if (s === 'wake') this._wiggle(c, W, H);
    if (s === 'call') this._radios(c, W, H);
    for (const f of this.fx) if (f.kind !== 'ripple'){ const a = this._at(f.i, W, H); healNumber(c, a.x + f.dx * a.h, a.y - a.h * 1.15, a.h * 0.12, f.age, f.text); }
  }

  /* Dizzy: stars round the helmet of anyone not up yet. */
  _dizzy(c, W, H, skip = null){
    for (const i of this.g.here){
      const k = this.up[i]; if (k >= 1 || i === skip) continue;
      const a = this._at(i, W, H), lie = 1 - easeOut(k);
      const hx = a.x + a.h * 0.45 * lie, hy = a.y - a.h * (1.05 - 0.6 * lie);
      for (let j = 0; j < 3; j++){
        const t = this.t * 3 + j * 2.09 + i;
        star(c, hx + Math.cos(t) * a.h * 0.22, hy + Math.sin(t) * a.h * 0.06, a.h * 0.035, '#ffe066');
      }
    }
  }

  /* Over each one still down, how far they've wiggled. */
  _wiggle(c, W, H){
    for (const i of this.g.here){
      if (this.woke[i] >= WIGGLE) continue;
      const a = this._at(i, W, H), r = Math.max(H * 0.022, a.h * 0.17), x = a.x + a.h * 0.3, y = a.y - a.h * 0.75;
      c.save();
      c.fillStyle = 'rgba(5,6,15,.6)'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.strokeStyle = PLAYER_COLORS[i]; c.lineWidth = r * 0.3; c.lineCap = 'round';
      c.beginPath(); c.arc(x, y, r * 0.8, -Math.PI / 2, -Math.PI / 2 + 6.2832 * this.woke[i] / WIGGLE); c.stroke();
      c.font = `700 ${Math.round(r * 0.9)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ffffff'; c.fillText('Zz', x, y + r * 0.05);
      c.restore();
    }
  }

  /* Over each head, a radio pulsing till they answer - then a tick. */
  _radios(c, W, H){
    for (const i of this.g.here){
      const a = this._at(i, W, H), r = Math.max(H * 0.024, a.h * 0.16), x = a.x, y = a.y - a.h * 1.35;
      c.save();
      if (this.answered[i]){
        c.fillStyle = '#22c55e'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
        c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.22; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(x - r * 0.45, y); c.lineTo(x - r * 0.1, y + r * 0.35); c.lineTo(x + r * 0.5, y - r * 0.35); c.stroke();
      } else {
        const on = 0.5 + 0.5 * Math.sin(this.t * 7 + i);
        glow(c, x, y, r * (1.8 + on * 0.6), '#5ff3ff', 0.5 + 0.4 * on);
        c.fillStyle = 'rgba(8,20,40,.9)'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
        c.strokeStyle = PLAYER_COLORS[i]; c.lineWidth = r * 0.15; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, this.ear[i] / HOLD)); c.stroke();
        c.fillStyle = '#e9ecf8'; c.beginPath(); c.roundRect(x - r * 0.2, y - r * 0.45, r * 0.4, r * 0.85, r * 0.1); c.fill();
        c.fillStyle = '#7ff3ff'; c.fillRect(x - r * 0.12, y - r * 0.32, r * 0.24, r * 0.2);
      }
      c.restore();
    }
  }
}

/* ---------- what each beat does ---------- */

/* As it starts. */
const BEGIN = {
  wreck(){ sfx.ringing?.(); },
  wake(){ this._place(); },
  brief(){ this.radio.visible = true; this.radio.say(...script('brief', this.g)); },
  pond(){ this.walking = this.g.crew.map(() => false); this.entered = false; this.waited = false; },
  go(){
    this.radio.say(...script('go', this.g));
    const g = this.g;
    for (const i of g.here){ g.crew[i].hp = g.crew[i].max; g.crew[i].played = true; g.crew[i].x = g._home(i); }
    /* from the pond to their places on the path */
    this.walking = g.crew.map(() => false);
    this.out = g.here.map(i => ({ i, from: [...this.pos[i]], to: [g._home(i), RUN_AT] }));
  }
};
/* Each step: true once it's done. */
const STEP = {
  wreck(){ return false; },
  wake(dt){
    const g = this.g, here = g.here;
    for (const i of here){
      const moving = this.moves[i].step(pose.players[i], dt, pose.mouse.active);
      if (this.woke[i] < WIGGLE){
        if (moving > STIR){ this.woke[i] += dt; if (Math.random() < dt * 6) sfx.step(i, 0.3); }
        if (this.woke[i] >= WIGGLE) sfx.select();
      }
      if (this.woke[i] >= WIGGLE) this.up[i] = Math.min(1, this.up[i] + dt / UP);
    }
    return this._settled(dt, (here.length > 0 && here.every(i => this.up[i] >= 1)) || (!here.length && this.st > 3));
  },
  call(dt){
    const here = this.g.here;
    if (Math.random() < dt * 1.5) sfx.trill?.();
    for (const i of here){
      if (this.answered[i]) continue;
      this.ear[i] = this._atEar(i) ? this.ear[i] + dt : Math.max(0, this.ear[i] - dt * 2);
      if (this.ear[i] >= HOLD){ this.answered[i] = true; sfx.pick(); }
    }
    return this._settled(dt, here.every(i => this.answered[i]));
  },
  brief(){ return !this.radio.busy; },
  pond(dt){
    const g = this.g, here = g.here;
    for (const i of here){
      const rn = g.crew[i];
      /* walking over on their own, across the path, to a place of their own in the water */
      const [tx, tr] = this._slot(i), dx = tx - this.pos[i][0];
      this.walking[i] = Math.abs(dx) > 0.02;
      this.pos[i][0] += Math.sign(dx) * Math.min(Math.abs(dx), STRIDE * dt);
      this.pos[i][1] += (tr - this.pos[i][1]) * Math.min(1, dt * 1.5);
      if (this.walking[i]){ rn.runPh = (rn.runPh || 0) + dt * Math.PI * 4; if (Math.random() < dt * 3) sfx.step(i, 0.25); }
      /* in the water: healing, smoothly, up to full */
      if (this._inPond(i)){
        if (!this.entered){ this.entered = true; this.radio.say(...script('pondIn', g)); }
        const hug = this.hugging[i] = this.hugs[i].step(pose.players[i], dt);
        if (rn.hp < rn.max){
          const was = rn.hp;
          rn.hp = Math.min(rn.max, rn.hp + rn.max * FILL * (hug ? 2 : 1) * dt);
          if (Math.floor(rn.hp / 5) !== Math.floor(was / 5)) this.fx.push({ kind: 'num', i, age: 0, dx: (Math.random() - 0.5) * 0.4, text: '+5' });
          if (Math.random() < dt * 1.5) this.fx.push({ kind: 'ripple', i, age: 0 });
          if (rn.hp >= rn.max){ sfx.twinkle(); this.fx.push({ kind: 'ripple', i, age: 0 }); }
        }
      }
    }
    if (this.entered && !this.waited && this.st > 12 && here.some(i => g.crew[i].hp < g.crew[i].max) && !this.radio.busy){ this.waited = true; this.radio.say(...script('pondWait', g)); }
    return this._settled(dt, here.every(i => g.crew[i].hp >= g.crew[i].max) && !this.radio.busy);
  },
  go(dt){
    /* walking from the pond onto the path, into their places */
    const g = this.g, u = Math.min(1, this.st / OUT), e = smooth(u);
    for (const o of this.out){
      this.pos[o.i] = [o.from[0] + (o.to[0] - o.from[0]) * e, o.from[1] + (o.to[1] - o.from[1]) * e];
      this.walking[o.i] = u < 1;
      g.crew[o.i].runPh = (g.crew[o.i].runPh || 0) + dt * Math.PI * 4;
    }
    if (u > 0.75) this.radio.visible = false;
    return u >= 1;
  }
};
/* When a beat's waited as long as it will: as if everyone had done it. */
const FORCE = {
  wake(){ for (const i of this.g.here){ this.woke[i] = WIGGLE; this.up[i] = 1; } },
  call(){ for (const i of this.g.here) this.answered[i] = true; },
  pond(){ for (const i of this.g.here){ this.g.crew[i].hp = this.g.crew[i].max; this.pos[i] = this._slot(i); } }
};
Intro.prototype._settled = function (dt, ok){
  if (!ok){ this.afterT = 0; return false; }
  this.afterT = (this.afterT || 0) + dt;
  return this.afterT >= AFTER;
};

/* (the crew's own depth, in play: lkp-art.js RUN) */
const RUN_AT = 0.03;
const smooth = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const lerp = (a, b, k) => ({ cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, s: a.s + (b.s - a.s) * k });
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, 6.2832); c.fill(); };

function banner(c, W, H, text, col, scale = 1, fill = 0){
  c.save(); c.translate(W / 2, H * 0.2); c.scale(scale, scale);
  c.font = `700 ${Math.round(H * 0.075)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = H * 0.014; c.strokeStyle = '#05060f'; c.strokeText(text, 0, 0);
  c.fillStyle = col; c.fillText(text, 0, 0);
  if (fill > 0){ const w = H * 0.5; c.fillStyle = 'rgba(5,6,15,.7)'; c.fillRect(-w / 2, H * 0.06, w, H * 0.015); c.fillStyle = col; c.fillRect(-w / 2, H * 0.06, w * Math.min(1, fill), H * 0.015); }
  c.restore();
}

function star(c, x, y, r, col){
  c.fillStyle = col; c.beginPath();
  for (let j = 0; j < 10; j++){ const rr = j % 2 ? r * 0.45 : r, a = j * Math.PI / 5 - Math.PI / 2; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}

