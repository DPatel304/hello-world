/* Last Known Position's opening: picked from the console, it doesn't throw
   you straight in - it shows you where you are, and lets your body do it.
   A scripted run of beats (INTRO_BEATS), each a shot, who's where, and
   what moves it on; the timed ones run themselves, the interactive ones
   wait on the players - but never forever (max). At the end the camera
   cuts to the game's own view and the crew walk from the pond onto the
   path - into exactly where play starts - and play carries on. The game
   holds still till it's done.

   Earnest adventure - no jokes. The commander's radio window and
   subtitles are lkp-captain.js's Radio; the crash site, the pond and its
   healing light are lkp-crashsite.js; the wiggle and the hand at the ear
   are the game's own watchers. */
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MoveWatch, HugWatch } from '../tracking/gestures.js';
import { P, drawCorridor, drawGloom } from './lkp-art.js';
import { glow } from './lkp-world.js';
import { drawAbove, drawGround, ABOVE, GROUND, pondBeauty, healRipple, healNumber } from './lkp-crashsite.js';
import { CRASH } from './lkp-game.js';
import { Radio, script } from './lkp-captain.js';

/* The beats, in order: the shot, who's where, and what moves it on.
   time: timed, seconds; until: waits on the players, but never longer
   than max. */
export const INTRO_BEATS = [
  { id: 'title', time: 4, shot: 'the game\'s name over the planet' },
  { id: 'wreck', time: 4, shot: 'high over the forest: the crash site - slow push in, descending on the crew', blocking: 'the crew out cold, scattered in front of the wreck; smoke drifting' },
  { id: 'wake', until: 'everyone standing', max: 20, shot: 'cut to the ground: medium wide, a slow dolly across them', blocking: 'each player\'s wiggle wakes theirs - a twitch, sitting up, standing; up, they sway and look round' },
  { id: 'call', until: 'everyone answered', max: 15, shot: 'push in a little: medium on the team', blocking: 'a radio pulsing over each head; a hand to the ear answers it - a tick' },
  { id: 'brief', until: 'her lines said', lines: 'brief', shot: 'hold, drifting slowly round them', blocking: 'the team waits; her window top left, her words at the bottom' },
  { id: 'pond', until: 'everyone at full health', max: 30, shot: 'following them as they walk over to the pond, east', blocking: 'they walk over on their own; in the water they heal to full, smoothly - hugging, faster' },
  { id: 'go', until: 'they\'re on the path', lines: 'go', shot: 'cut to the game\'s own view: the pond off to the right, the ship to the left', blocking: 'they walk from the pond onto the path, to where play starts' }
];
const BEAT = Object.fromEntries(INTRO_BEATS.map(b => [b.id, b]));
export const TITLE = BEAT.title.time, WRECK = BEAT.wreck.time;
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

  /* Where each one starts: across the front, in front of the wreck, a
     little scattered - spread wider for more of them. [lane, rel] */
  _start(k, n){
    const gap = n <= 2 ? 1.0 : 0.82;
    return [-0.75 + (k - (n - 1) / 2) * gap, 0.1 + [0, 0.035, -0.015, 0.025][k % 4]];
  }
  _place(){
    const here = this.g.here;
    this.pos = this.g.crew.map((_, i) => { const k = Math.max(0, here.indexOf(i)); return this._start(k, Math.max(1, here.length)); });
    for (const i of here){ this.g.crew[i].played = true; this.g.crew[i].x = this.g._home(i); }
  }
  _at(i, W, H){
    if (!this.pos) this._place();
    const [lane, rel] = this.pos[i], p = P(lane, rel, W, H);
    return { x: p.x, y: p.y, h: H * 0.19 * p.k * 1.15, rel, lane };
  }
  _inPond(i){ const [pl, pr, r] = GROUND.pond, [lane, rel] = this.pos[i]; return Math.abs(lane - pl) < r * 1.15 && Math.abs(rel - pr) < r * 0.3; }
  /* The middle of the team, on screen (x), and its spread. */
  _team(W, H){
    const xs = this.g.here.map(i => this._at(i, W, H).x);
    if (!xs.length) return { x: P(-0.75, 0.1, W, H).x, w: W * 0.3 };
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, w: Math.max(...xs) - Math.min(...xs) };
  }

  /* ---------- the camera ---------- */

  /* Where the camera is, on the ground: looking at (cx, cy), s times
     closer, tilted r. All its moves eased. */
  _cam(W, H){
    const team = this._team(W, H), fit = Math.min(1.3, Math.max(1.0, W * 0.62 / Math.max(team.w + W * 0.2, 1)));
    const pond = P(GROUND.pond[0], GROUND.pond[1], W, H);
    const st = this.st, base = { cx: team.x, cy: H * 0.6, s: fit, r: 0 };
    switch (this.stage){
      case 'wake': {
        /* a slow dolly across them */
        const u = smooth(Math.min(1, st / 9));
        return { ...base, cx: team.x - W * 0.06 + W * 0.12 * u };
      }
      case 'call': return { ...base, cx: team.x + W * 0.06 * (1 - smooth(st / 1.5)), s: fit * (1 + 0.12 * smooth(st / 1.5)) };
      case 'brief': return { cx: team.x + Math.sin(this.t * 0.3) * W * 0.02, cy: H * 0.6, s: fit * 1.12 + Math.sin(this.t * 0.2) * 0.015, r: Math.sin(this.t * 0.25) * 0.008 };
      case 'pond': {
        /* following them over, east, the pond coming into view */
        const xs = this.g.here.map(i => this._at(i, W, H).x);
        const mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : team.x, arrive = smooth(Math.min(1, st / 4));
        return { cx: mid + (pond.x - mid) * 0.35 * arrive, cy: H * 0.6, s: fit * 1.05, r: 0 };
      }
      default: return base;
    }
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    const g = this.g, s = this.stage;
    if (s === 'title'){ this._title(c, W, H); return; }
    if (s === 'wreck'){ this._wreck(c, W, H); return; }
    g.inIntro = true;
    if (s === 'go'){
      /* The game's own view: they walk from the pond onto the path. */
      g._drawPlay(c, W, H);
      g.inIntro = false;
      this._bars(c, W, H, 1 - smooth(this.st / 0.8));
      this.radio.draw(c, W, H);
      return;
    }
    this._ground(c, W, H);
    g.inIntro = false;
    this._bars(c, W, H, 1);
    if (s === 'wake' && g.here.some(i => this.woke[i] < WIGGLE)) banner(c, W, H, 'WIGGLE TO WAKE UP!', '#ffd24a', 1 + 0.03 * Math.sin(this.t * 6));
    if (s === 'call') banner(c, W, H, 'HAND TO YOUR EAR TO ANSWER', '#7ff3ff', 1 + 0.03 * Math.sin(this.t * 6));
    if (s === 'pond' && g.here.some(i => this._inPond(i) && g.crew[i].hp < g.crew[i].max)) banner(c, W, H, 'HUG YOURSELF TO HEAL FASTER!', '#ff9ccb', 1 + 0.03 * Math.sin(this.t * 6));
    this.radio.draw(c, W, H);
  }

  _bars(c, W, H, k){
    if (k <= 0) return;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H * 0.09 * k); c.fillRect(0, H * (1 - 0.09 * k), W, H * 0.09 * k);
  }

  /* The clearing at their level, through the camera, with the crew in it. */
  _ground(c, W, H){
    const g = this.g, cam = this._cam(W, H), s = this.stage, L = g.level.palette.world;
    const healing = s === 'pond' || s === 'go';
    c.save();
    c.translate(W / 2, H / 2); c.rotate(cam.r); c.scale(cam.s, cam.s); c.translate(-cam.cx, -cam.cy);
    const crew = g.here.map(i => {
      const a = this._at(i, W, H), rn = g.crew[i];
      return { rel: a.rel, draw: () => {
        const keep = [rn.run, rn.runPh, rn.lean, rn.heal];
        const moving = this.walking && this.walking[i];
        rn.run = moving ? 1 : 0; rn.runPh = (keep[1] || 0) + (moving ? 0.22 : 0);
        /* up and waiting: a sway, a look round */
        rn.lean = this.up[i] >= 1 && !moving ? Math.sin(this.t * 0.9 + i * 1.7) * 0.25 : 0;
        rn.heal = healing && this._inPond(i) ? 0.6 : 0;
        const twitch = this.woke[i] > 0 && this.up[i] < 0.2 ? Math.sin(this.t * 30) * a.h * 0.01 : 0;
        g._drawCrew(c, i, W, H, { x: a.x + twitch, y: a.y, h: a.h, bob: 0, down: 1 - easeOut(this.up[i]), noBar: !healing, pose: this.hugging[i] ? 'hug' : null });
        rn.runPh = rn.run ? rn.runPh : keep[1]; [rn.run, , rn.lean, rn.heal] = keep;
      } };
    });
    drawGround(c, W, H, this.t, L, crew);
    const [pl, pr, ps] = GROUND.pond;
    if (s === 'pond') pondBeauty(c, W, H, pl, pr, this.t, L, ps, 0.5 + 0.5 * smooth(Math.min(1, this.st / 3)));
    if (s === 'wake') this._dizzy(c, W, H);
    if (s === 'wake') this._wiggle(c, W, H);
    if (s === 'call') this._radios(c, W, H);
    for (const f of this.fx){
      const a = this._at(f.i, W, H);
      if (f.kind === 'ripple') healRipple(c, a.x, a.y, a.h * 0.9, f.age);
      else healNumber(c, a.x + f.dx * a.h, a.y - a.h * 1.15, a.h * 0.12, f.age, f.text);
    }
    c.restore();
    drawGloom(c, W, H);
  }

  /* The title: the game's name over the planet. */
  _title(c, W, H){
    drawCorridor(c, W, H, 0, this.t);
    drawGloom(c, W, H);
    const a = Math.min(1, this.st / 0.8) * Math.min(1, (TITLE - this.st) / 0.7);
    c.save();
    c.fillStyle = 'rgba(5,6,20,.45)'; c.fillRect(0, 0, W, H);
    c.globalAlpha = Math.max(0, a); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${Math.round(H * 0.12)}px Fredoka, sans-serif`;
    c.lineWidth = H * 0.016; c.strokeStyle = '#05060f';
    const y = H * 0.4 - (1 - Math.min(1, this.st / 0.8)) * H * 0.03;
    c.strokeText('LAST KNOWN POSITION', W / 2, y); c.fillStyle = '#ffffff'; c.fillText('LAST KNOWN POSITION', W / 2, y);
    c.font = `600 ${Math.round(H * 0.045)}px Fredoka, sans-serif`; c.lineWidth = H * 0.01;
    const sub = `LEVEL 1 · ${this.g.level.name}`.toUpperCase();
    c.strokeText(sub, W / 2, y + H * 0.11); c.fillStyle = '#7ff3ff'; c.fillText(sub, W / 2, y + H * 0.11);
    c.restore();
    if (this.st > TITLE - 0.7){ c.fillStyle = `rgba(0,0,0,${(this.st - (TITLE - 0.7)) / 0.7})`; c.fillRect(0, 0, W, H); }
  }

  /* The wreck, from high above: pushing in and coming down on the crew,
     out cold in front of it - drifting all the while. */
  _wreck(c, W, H){
    const u = smooth(this.st / WRECK), [cx, cy] = ABOVE.crew, z = 1 + 0.45 * u;
    c.fillStyle = '#2f5b46'; c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2, H / 2); c.rotate(Math.sin(this.t * 0.2) * 0.01); c.scale(z, z);
    /* (towards the crew, but never so far the edge of the view shows) */
    const ox = Math.max(-(W / 2) * (1 - 1 / z), Math.min((W / 2) * (1 - 1 / z), (cx * W - W / 2) * u)), oy = Math.max(-(H / 2) * (1 - 1 / z), Math.min((H / 2) * (1 - 1 / z), (cy * H - H / 2) * u));
    c.translate(-(W / 2 + ox) - Math.sin(this.t * 0.3) * W * 0.004, -(H / 2 + oy));
    drawAbove(c, W, H, this.t, this.g.level.palette.world, this.g.here.length ? this.g.here.map(() => 1) : []);
    c.restore();
    if (this.st < 0.6){ c.fillStyle = `rgba(0,0,0,${1 - this.st / 0.6})`; c.fillRect(0, 0, W, H); }
  }

  /* Dizzy: stars round the helmet of anyone not up yet. */
  _dizzy(c, W, H){
    for (const i of this.g.here){
      const k = this.up[i]; if (k >= 1) continue;
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
    /* from round the pond (in the game's view) to their places on the path */
    this.out = g.here.map((i, k) => ({ i, from: [CRASH.pond[0] + (k - (g.here.length - 1) / 2) * 0.35, CRASH.pond[1] + (k % 2) * 0.04], to: [g._home(i), RUN_AT] }));
  }
};
/* Each step: true once it's done. */
const STEP = {
  title(){ return false; },
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
      const rn = g.crew[i], k = Math.max(0, here.indexOf(i)), n = here.length;
      /* walking over on their own, to a place of their own round the water */
      const tx = GROUND.pond[0] + (k - (n - 1) / 2) * 0.42;
      const dx = tx - this.pos[i][0];
      this.walking[i] = Math.abs(dx) > 0.02;
      this.pos[i][0] += Math.sign(dx) * Math.min(Math.abs(dx), STRIDE * dt);
      this.pos[i][1] += (GROUND.pond[1] + (k % 2 ? 0.03 : -0.01) - this.pos[i][1]) * Math.min(1, dt * 1.5);
      if (this.walking[i] && Math.random() < dt * 3) sfx.step(i, 0.25);
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
    g.introCrew = u < 1 ? this.out.map(o => ({ i: o.i, lane: o.from[0] + (o.to[0] - o.from[0]) * e, rel: o.from[1] + (o.to[1] - o.from[1]) * e })) : null;
    for (const o of this.out){ const rn = g.crew[o.i]; rn.run = u < 1 ? 1 : 0; rn.runPh = (rn.runPh || 0) + dt * Math.PI * 4; }
    if (u > 0.75) this.radio.visible = false;
    return u >= 1;
  }
};
/* When a beat's waited as long as it will: as if everyone had done it. */
const FORCE = {
  wake(){ for (const i of this.g.here){ this.woke[i] = WIGGLE; this.up[i] = 1; } },
  call(){ for (const i of this.g.here) this.answered[i] = true; },
  pond(){ for (const i of this.g.here){ this.g.crew[i].hp = this.g.crew[i].max; this.pos[i][0] = GROUND.pond[0]; } }
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
const mix = (a, b, k) => ({ cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, s: a.s + (b.s - a.s) * k, r: a.r + (b.r - a.r) * k });

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

