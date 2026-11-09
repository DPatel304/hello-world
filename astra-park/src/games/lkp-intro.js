/* Last Known Position's opening: waking up inside the helmet, after the
   crash. A scripted run of beats (INTRO_BEATS): the timed ones run
   themselves, the interactive ones wait on the players - never forever
   (max).

     dark    black; ringing in the ears, a heartbeat, a radio crackling;
             the eyes flutter open on a blurred, tilted, burning crash
             site - and close again
     wake    WIGGLE TO WAKE UP: everyone's wiggling together opens the
             eyes - the more they wiggle, the wider, the less blurred and
             doubled the view (stop, and they droop again)
     call    eyes open: the suit's display rings - INCOMING CALL, NOVA -
             a hand to the ear answers it
     answer  her first words, in her window
     rise    a blink - and outside, behind the crew getting up on the
             path by the burning ship; then they're off

   The view through the helmet is the game's own world (the burning ship
   off the left of the path, lkp-crashsite.js), lying on your side: low,
   tilted, drawn small and stretched to blur it, doubled, behind eyelids,
   a cracked visor and the suit's display. One "you": the whole team
   wakes it. The crew start hurt (START of their health) - the healing
   pond's a stop later on, along the first corridor (lkp-game.js). */
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MoveWatch } from '../tracking/gestures.js';
import { SKY } from './lkp-world.js';
import { Radio, script } from './lkp-captain.js';

export const INTRO_BEATS = [
  { id: 'dark', time: 3, shot: 'black, then a flutter of the eyes: the burning crash site, blurred, tilted, doubled', blocking: 'ringing, a heartbeat, a radio crackling' },
  { id: 'wake', until: 'eyes open', max: 20, shot: 'through the helmet, lying on your side, the ship burning', blocking: 'everyone wiggling opens the eyes, clears the blur' },
  { id: 'call', until: 'everyone answered', max: 15, shot: 'through the helmet, clear', blocking: 'the suit display rings: INCOMING CALL - NOVA; a hand to the ear answers' },
  { id: 'answer', until: 'her line said', lines: 'wakeup', shot: 'through the helmet; her window top left', blocking: 'Nova: you\'re alive, on your feet' },
  { id: 'rise', time: 2.4, shot: 'a blink: the game\'s own view, behind the crew', blocking: 'they get up on the path, by the burning ship' }
];
const BEAT = Object.fromEntries(INTRO_BEATS.map(b => [b.id, b]));
export const DARK = BEAT.dark.time, RISE = BEAT.rise.time;
export const WAKE_MAX = BEAT.wake.max, RING_MAX = BEAT.call.max;
/* Waking: moving (body sizes a second) more than STIR counts; WIGGLE
   seconds of it each and your share of the eyes is open - it slips back
   DROOP a second when you stop. */
export const STIR = 0.45, WIGGLE = 1.6, DROOP = 0.35;
/* The call: a hand held at the ear HOLD seconds answers it. */
export const HOLD = 0.4;
/* They start on START of their health: hurt in the crash. */
export const START = 0.5;
/* Through the helmet: looking at (cx, cy) - screens - s times closer,
   tilted (lying on your side). */
const POV = { cx: -0.06, cy: 0.5, s: 1.75, tilt: -0.24 };
/* A moment after it's done. */
const AFTER = 0.5;

export class Intro {
  constructor(game){
    this.g = game; this.kind = 'intro'; this.done = false;
    this.k = 0; this.stage = INTRO_BEATS[0].id; this.st = 0; this.t = 0;
    this.moves = pose.players.map(() => new MoveWatch());
    this.woke = pose.players.map(() => 0);       /* each one's wiggle, 0..WIGGLE */
    this.ear = pose.players.map(() => 0);
    this.answered = pose.players.map(() => false);
    this.up = pose.players.map(() => 0);         /* standing up, at the end */
    this.open = 0;                                /* how open the eyes are, 0..1, shown */
    this.beatT = 0;
    this.radio = new Radio(); this.radio.visible = false; this.radio.top = 0.11;
  }
  get beat(){ return INTRO_BEATS[this.k]; }
  _next(){
    this.k++; this.st = 0; this.afterT = 0;
    if (this.k >= INTRO_BEATS.length){ this.done = true; this.radio.visible = false; return; }
    this.stage = this.beat.id;
    const on = BEGIN[this.stage]; if (on) on.call(this);
  }
  /* How far the team's wiggled the eyes open, 0..1. */
  get wiggled(){
    const here = this.g.here;
    return here.length ? here.reduce((s, i) => s + Math.min(1, this.woke[i] / WIGGLE), 0) / here.length : 0;
  }

  step(dt){
    if (this.done) return;
    this.t += dt; this.st += dt;
    const g = this.g;
    /* Hurt in the crash; on the path, where play starts. */
    if (!this.hurt){
      this.hurt = true;
      for (const rn of g.crew) rn.hp = Math.round(rn.max * START);
      for (const i of g.here){ g.crew[i].played = true; g.crew[i].x = g._home(i); }
    }
    this.radio.step(dt);
    /* the heartbeat, while you're coming round */
    if (this.stage === 'dark' || this.stage === 'wake'){
      this.beatT -= dt;
      if (this.beatT <= 0){ sfx.heartbeat?.(); this.beatT = 1.15; this.beatAt = this.t; }
    }
    const b = this.beat;
    const over = STEP[b.id].call(this, dt);
    /* the eyes: how open, eased */
    const want = EYES[this.stage].call(this);
    this.open += (want - this.open) * Math.min(1, dt * (this.stage === 'rise' ? 30 : 5));
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

  /* ---------- drawing ---------- */

  draw(c, W, H){
    const s = this.stage;
    if (s === 'rise' && this.st > 0.35) this._outside(c, W, H);
    else this._helmet(c, W, H);
    this._lids(c, W, H);
    if (s === 'wake') banner(c, W, H, 'WIGGLE TO WAKE UP!', '#ffd24a', 1 + 0.03 * Math.sin(this.t * 6), this.wiggled);
    if (s === 'call') this._ringing(c, W, H);
    this.radio.draw(c, W, H);
  }

  /* Through the helmet: the crash site, lying on your side - blurred and
     doubled till you're properly awake - the visor cracked, the suit's
     display, the edges dark (red with each heartbeat). */
  _helmet(c, W, H){
    const g = this.g, clear = this._clear(), sway = Math.sin(this.t * 0.6) * 0.02 * (1 - clear * 0.6);
    const view = (cx) => {
      cx.save();
      cx.translate(W / 2, H / 2); cx.rotate(POV.tilt + sway); cx.scale(POV.s, POV.s); cx.translate(-POV.cx * W, -POV.cy * H);
      g.inIntro = true; g.introCrew = []; SKY.above = H; SKY.wide = W * 1.3;
      g._drawPlay(cx, W, H);
      g.inIntro = false; g.introCrew = null; SKY.above = 0; SKY.wide = 0;
      cx.restore();
    };
    /* blurred: drawn small, stretched back up - the smaller, the blurrier */
    const r = clear > 0.97 ? 1 : [0.08, 0.12, 0.18, 0.28, 0.45, 0.7][Math.min(5, Math.floor(clear * 6))];
    const buf = r < 1 ? bufOf(Math.round(W * r), Math.round(H * r)) : null;
    if (buf){
      const bc = buf.getContext('2d');
      bc.setTransform(r, 0, 0, r, 0, 0); view(bc); bc.setTransform(1, 0, 0, 1, 0, 0);
      c.save(); c.imageSmoothingEnabled = true; c.drawImage(buf, 0, 0, W, H);
      /* seeing double */
      c.globalAlpha = 0.45 * (1 - clear); c.drawImage(buf, W * 0.035 * (1 - clear), H * 0.01 * (1 - clear), W, H);
      c.restore();
    } else view(c);
    /* the edges: dark, pulsing red with the heartbeat */
    const beat = Math.exp(-(this.t - (this.beatAt ?? -9)) * 4) * (1 - clear * 0.7);
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(${Math.round(60 + 120 * beat)},0,0,${0.55 + 0.25 * beat})`);
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    this._visor(c, W, H);
  }
  /* How clear the view is, 0..1: blurred coming round, clear once awake. */
  _clear(){
    const s = this.stage;
    if (s === 'dark') return 0;
    if (s === 'wake') return Math.pow(this.wiggled, 1.3) * 0.9;
    return 1;
  }

  /* The visor: a crack across it, and the suit's display - damaged,
     half its power. */
  _visor(c, W, H){
    c.save();
    c.strokeStyle = 'rgba(235,245,255,.55)'; c.lineWidth = Math.max(1.5, H * 0.0025); c.lineCap = 'round';
    const cr = [[0.97, 0.05], [0.86, 0.17], [0.8, 0.16], [0.71, 0.3], [0.66, 0.31], [0.6, 0.42]];
    c.beginPath(); cr.forEach(([x, y], k) => (k ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H))); c.stroke();
    c.beginPath(); c.moveTo(0.86 * W, 0.17 * H); c.lineTo(0.9 * W, 0.27 * H); c.moveTo(0.71 * W, 0.3 * H); c.lineTo(0.68 * W, 0.21 * H); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = Math.max(1, H * 0.0015); c.beginPath(); cr.forEach(([x, y], k) => (k ? c.lineTo(x * W + 2, y * H + 2) : c.moveTo(x * W + 2, y * H + 2))); c.stroke();
    /* the display, bottom left: flickering */
    const on = this.stage !== 'dark' && (Math.sin(this.t * 23) > -0.85 || this.stage !== 'wake');
    if (on){
      const x = W * 0.05, y = H * 0.84, w = H * 0.34;
      c.globalAlpha = 0.85;
      c.font = `700 ${Math.round(H * 0.026)}px Fredoka, sans-serif`; c.textBaseline = 'middle'; c.textAlign = 'left';
      c.fillStyle = Math.sin(this.t * 5) > 0 ? '#ff6b5b' : '#ffb35b'; c.fillText('⚠ SUIT DAMAGED', x, y);
      c.fillStyle = 'rgba(5,6,15,.6)'; c.fillRect(x, y + H * 0.03, w, H * 0.018);
      c.fillStyle = '#ff9c5b'; c.fillRect(x, y + H * 0.03, w * START, H * 0.018);
      c.font = `600 ${Math.round(H * 0.018)}px Fredoka, sans-serif`; c.fillStyle = '#ffd7b8'; c.fillText(`POWER ${Math.round(START * 100)}%`, x + w + H * 0.015, y + H * 0.039);
    }
    c.restore();
  }

  /* The eyelids: black from above and below, curved, softened at the
     edge; closed at 0, gone at 1. */
  _lids(c, W, H){
    const o = Math.max(0, Math.min(1, this.open));
    if (o >= 0.999) return;
    const gap = H * 0.62 * o, top = H / 2 - gap, bot = H / 2 + gap, bow = H * 0.12 * (1 - o * 0.5);
    c.save(); c.fillStyle = '#000';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, top + bow * 0.6); c.quadraticCurveTo(W / 2, top - bow, 0, top + bow * 0.6); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, H); c.lineTo(W, H); c.lineTo(W, bot - bow * 0.6); c.quadraticCurveTo(W / 2, bot + bow, 0, bot - bow * 0.6); c.closePath(); c.fill();
    /* soft lid edges */
    for (const [y, d] of [[top, 1], [bot, -1]]){
      const g = c.createLinearGradient(0, y, 0, y + d * H * 0.08);
      g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, Math.min(y, y + d * H * 0.08) - (d > 0 ? bow * 0.4 : 0), W, H * 0.08 + bow * 0.4);
    }
    c.restore();
  }

  /* The suit's display ringing: INCOMING CALL - NOVA, and who's answered. */
  _ringing(c, W, H){
    const g = this.g, x = W / 2, y = H * 0.32, ring = 0.5 + 0.5 * Math.sin(this.t * 9);
    c.save();
    c.fillStyle = 'rgba(5,12,30,.78)'; c.beginPath(); c.roundRect(x - H * 0.3, y - H * 0.07, H * 0.6, H * 0.18, H * 0.03); c.fill();
    c.strokeStyle = `rgba(127,243,255,${0.5 + 0.4 * ring})`; c.lineWidth = H * 0.004; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${Math.round(H * 0.03)}px Fredoka, sans-serif`; c.fillStyle = '#7ff3ff'; c.fillText('INCOMING CALL', x, y - H * 0.025);
    c.font = `700 ${Math.round(H * 0.045)}px Fredoka, sans-serif`; c.fillStyle = '#ffffff'; c.fillText('COMMANDER NOVA', x, y + H * 0.025);
    /* each of them: a dot filling as they hold a hand to their ear, full when they have */
    const here = g.here, r = H * 0.016;
    here.forEach((i, k) => {
      const dx = x + (k - (here.length - 1) / 2) * r * 3.2, dy = y + H * 0.075;
      c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(dx, dy, r, 0, 6.2832); c.fill();
      c.fillStyle = PLAYER_COLORS[i];
      if (this.answered[i]){ c.beginPath(); c.arc(dx, dy, r, 0, 6.2832); c.fill(); }
      else { c.beginPath(); c.moveTo(dx, dy); c.arc(dx, dy, r, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, this.ear[i] / HOLD)); c.closePath(); c.fill(); }
    });
    c.restore();
    banner(c, W, H, 'HAND TO YOUR EAR TO ANSWER', '#7ff3ff', 1 + 0.03 * Math.sin(this.t * 6));
  }

  /* Outside, after the blink: the game's own view, the crew getting up
     on the path, by the burning ship. */
  _outside(c, W, H){
    const g = this.g;
    g.introCrew = g.here.map(i => ({ i, lane: g._home(i), rel: RUN_AT, down: 1 - easeOut(this.up[i]), noBar: false }));
    g.inIntro = true;
    g._drawPlay(c, W, H);
    g.inIntro = false; g.introCrew = null;
  }
}

/* ---------- what each beat does ---------- */

const BEGIN = {
  answer(){ this.radio.visible = true; this.radio.say(...script('wakeup', this.g)); },
  rise(){ sfx.whoosh?.(); }
};
/* Each step: true once it's done. */
const STEP = {
  dark(){ if (this.st < 0.05) sfx.ringing?.(); return false; },
  wake(dt){
    const here = this.g.here;
    for (const i of here){
      const moving = this.moves[i].step(pose.players[i], dt, pose.mouse.active);
      if (moving > STIR){ this.woke[i] = Math.min(WIGGLE, this.woke[i] + dt); if (Math.random() < dt * 4) sfx.step(i, 0.25); }
      else if (this.woke[i] < WIGGLE) this.woke[i] = Math.max(0, this.woke[i] - dt * DROOP);
    }
    return this._settled(dt, (here.length > 0 && this.wiggled >= 1) || (!here.length && this.st > 3));
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
  answer(){ return !this.radio.busy; },
  rise(dt){
    /* up off the ground, one after another */
    this.g.here.forEach((i, k) => { if (this.st > 0.6 + k * 0.15) this.up[i] = Math.min(1, this.up[i] + dt / 0.8); });
    return false;
  }
};
/* How open the eyes want to be, in each beat. */
const EYES = {
  /* closed - a flutter open - closed again */
  dark(){ const u = (this.st - 1.1) / 1.3; return u > 0 && u < 1 ? 0.35 * Math.sin(u * Math.PI) * (0.8 + 0.2 * Math.sin(this.t * 20)) : 0; },
  /* opening as they wiggle, a little heavy flicker while they're still low */
  wake(){ const w = this.wiggled; return Math.min(1, 0.08 + w * 0.95 + (w < 0.6 ? 0.04 * Math.sin(this.t * 3) : 0)); },
  call(){ return 1; },
  answer(){ return 1; },
  /* the blink: shut, then open outside */
  rise(){ return this.st < 0.45 ? 0 : 1; }
};
/* When a beat's waited as long as it will: as if everyone had done it. */
const FORCE = {
  wake(){ for (const i of this.g.here) this.woke[i] = WIGGLE; },
  call(){ for (const i of this.g.here) this.answered[i] = true; }
};
Intro.prototype._settled = function (dt, ok){
  if (!ok){ this.afterT = 0; return false; }
  this.afterT = (this.afterT || 0) + dt;
  return this.afterT >= AFTER;
};

/* (the crew's own depth, in play: lkp-art.js RUN) */
const RUN_AT = 0.03;
const easeOut = (k) => 1 - (1 - k) * (1 - k);

/* An offscreen canvas of a size, kept (one per size). */
const BUFS = new Map();
function bufOf(w, h){
  const key = `${w}x${h}`;
  if (BUFS.has(key)) return BUFS.get(key);
  let cv = null;
  if (typeof document !== 'undefined'){
    cv = document.createElement('canvas');
    if (cv && cv.getContext){ cv.width = Math.max(1, w); cv.height = Math.max(1, h); if (!cv.getContext('2d')) cv = null; } else cv = null;
  }
  BUFS.set(key, cv);
  return cv;
}

function banner(c, W, H, text, col, scale = 1, fill = 0){
  c.save(); c.translate(W / 2, H * 0.2); c.scale(scale, scale);
  c.font = `700 ${Math.round(H * 0.075)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = H * 0.014; c.strokeStyle = '#05060f'; c.strokeText(text, 0, 0);
  c.fillStyle = col; c.fillText(text, 0, 0);
  if (fill > 0){ const w = H * 0.5; c.fillStyle = 'rgba(5,6,15,.7)'; c.fillRect(-w / 2, H * 0.06, w, H * 0.015); c.fillStyle = col; c.fillRect(-w / 2, H * 0.06, w * Math.min(1, fill), H * 0.015); }
  c.restore();
}
