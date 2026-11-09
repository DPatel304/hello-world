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
import { SKY, mix } from './lkp-world.js';
import { Radio, script } from './lkp-captain.js';
import { commanderFace } from './lkp-cast.js';
import { figure } from './lkp-guide.js';

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
    this._stepDrone(dt);
    /* the gloves: in view once the eyes are opening, until they get up */
    const handsOn = (this.stage === 'wake' && (this.notch || 0) >= 1) || this.stage === 'call' || this.stage === 'answer';
    this.gloves = Math.max(0, Math.min(1, (this.gloves || 0) + (handsOn ? dt * 1.2 : -dt * 3)));
    /* the heartbeat, while you're coming round */
    if (this.stage === 'dark' || this.stage === 'wake'){
      this.beatT -= dt;
      if (this.beatT <= 0){ sfx.heartbeat?.(); this.beatT = 1.15; this.beatAt = this.t; }
    }
    this._sounds(dt);
    const b = this.beat;
    const over = STEP[b.id].call(this, dt);
    /* the eyes: how open, eased */
    const want = EYES[this.stage].call(this);
    this.open += (want - this.open) * Math.min(1, dt * (this.stage === 'rise' ? 30 : 5));
    if (over || (b.time && this.st >= b.time) || (b.max && this.st >= b.max && (FORCE[b.id] ? (FORCE[b.id].call(this), true) : true))) this._next();
  }

  /* The helper drone - a little round robot from the ship, a friendly
     screen for a face. Once your eyes are mostly open it floats in close,
     peering at you, shines its little light in your eyes and chirps; then
     it hovers by the call it's put through, and off it goes once she's
     talking. */
  _stepDrone(dt){
    const s = this.stage, d = this.drone || (this.drone = { x: 1.25, y: 0.3, on: false, t: 0, light: 0 });
    d.t += dt;
    const want = s === 'wake' && (this.notch || 0) >= 3 ? [0.66, 0.42] : s === 'call' ? [0.2, 0.36] : s === 'answer' ? [1.3, -0.2] : null;
    if (want){
      if (!d.on && s === 'wake'){ d.on = true; d.arrive = d.t; }
      d.x += (want[0] - d.x) * Math.min(1, dt * 1.6); d.y += (want[1] - d.y) * Math.min(1, dt * 1.6);
    }
    /* arriving: a peer, a flash of its light, a chirp */
    if (d.on && !d.chirped && d.t - d.arrive > 1.1){ d.chirped = true; d.light = 1; sfx.chirp?.(); }
    if (s === 'call' && !d.patched){ d.patched = true; sfx.chirp?.(); }
    d.light = Math.max(0, d.light - dt * 0.9);
  }
  _drone(c, W, H, clear){
    const d = this.drone; if (!d || !d.on || d.x > 1.25) return;
    const x = d.x * W, y = d.y * H + Math.sin(this.t * 2.2) * H * 0.012, r = H * (this.stage === 'wake' ? 0.11 : 0.07);
    c.save();
    if (clear < 0.95){ try { c.filter = `blur(${Math.round((1 - clear) * 10)}px)`; } catch (e){} }
    /* its hover glow underneath */
    const hg = c.createRadialGradient(x, y + r * 1.1, 0, x, y + r * 1.1, r * 1.2); hg.addColorStop(0, 'rgba(127,243,255,.55)'); hg.addColorStop(1, 'rgba(127,243,255,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(x, y + r * 1.1, r * 1.2, 0, 6.2832); c.fill();
    /* little side fans */
    for (const s of [-1, 1]){ c.fillStyle = '#c9d4e6'; c.beginPath(); c.ellipse(x + s * r * 1.05, y + r * 0.1, r * 0.32, r * 0.14, s * 0.3, 0, 6.2832); c.fill(); c.fillStyle = 'rgba(127,243,255,.6)'; c.beginPath(); c.ellipse(x + s * r * 1.05, y + r * 0.2, r * 0.22, r * 0.06, 0, 0, 6.2832); c.fill(); }
    /* its round shell */
    const sg = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.1); sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.6, '#e4ecf6'); sg.addColorStop(1, '#9fb0c8');
    c.fillStyle = sg; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    c.strokeStyle = '#6f80a0'; c.lineWidth = Math.max(2, r * 0.04); c.stroke();
    /* the antenna, its light blinking */
    c.strokeStyle = '#6f80a0'; c.beginPath(); c.moveTo(x + r * 0.2, y - r * 0.95); c.lineTo(x + r * 0.32, y - r * 1.35); c.stroke();
    c.fillStyle = Math.floor(this.t * 3) % 2 ? '#7ff3ff' : '#ffd24a'; c.beginPath(); c.arc(x + r * 0.32, y - r * 1.4, r * 0.09, 0, 6.2832); c.fill();
    /* its screen face: two happy eyes, blinking */
    c.fillStyle = '#16264a'; c.beginPath(); c.roundRect(x - r * 0.62, y - r * 0.42, r * 1.24, r * 0.78, r * 0.3); c.fill();
    c.fillStyle = '#7ff3ff'; const blink = (this.t % 3.2) < 0.12;
    for (const s of [-1, 1]){
      if (blink || this.stage === 'call'){ c.strokeStyle = '#7ff3ff'; c.lineWidth = r * 0.08; c.lineCap = 'round'; c.beginPath(); c.arc(x + s * r * 0.26, y + r * 0.02, r * 0.13, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke(); }
      else { c.beginPath(); c.ellipse(x + s * r * 0.26, y - r * 0.04, r * 0.1, r * 0.15, 0, 0, 6.2832); c.fill(); }
    }
    c.restore();
    /* its little light, shone in your eyes */
    if (d.light > 0){
      const lg = c.createRadialGradient(x, y, 0, x, y, W * 0.5); lg.addColorStop(0, `rgba(255,250,225,${0.9 * d.light})`); lg.addColorStop(0.3, `rgba(255,250,225,${0.35 * d.light})`); lg.addColorStop(1, 'rgba(255,250,225,0)');
      c.fillStyle = lg; c.fillRect(0, 0, W, H);
    }
    /* putting the call through: a faint beam to the call box */
    if (this.stage === 'call'){ c.save(); c.strokeStyle = `rgba(127,243,255,${0.25 + 0.15 * Math.sin(this.t * 8)})`; c.lineWidth = H * 0.006; c.setLineDash?.([H * 0.015, H * 0.012]); c.beginPath(); c.moveTo(x + r, y); c.lineTo(W * 0.5 - H * 0.39, H * 0.4); c.stroke(); c.restore(); }
  }

  /* Your hands, in the suit's gloves, coming up into view - and moving as
     your real hands move (the first of you the camera sees): wiggle your
     fingers, and there you are, in the suit. */
  _gloves(c, W, H){
    const a = this.gloves || 0; if (a <= 0.01) return;
    const i = this.g.here[0]; if (i == null) return;
    const p = pose.players[i], col = PLAYER_COLORS[i];
    const cen = p.centre || { x: 0.5, y: 0.6 }, sc = p.scale || 0.3;
    c.save(); c.globalAlpha = a;
    for (const side of ['left', 'right']){
      const h = p.hands[side], d = side === 'left' ? -1 : 1;
      /* where it is, in front of you: as far out from your middle as the real hand is from the body's */
      const hx = W * Math.max(0.05, Math.min(0.95, 0.5 + (h.x - cen.x) / sc * 0.85)), hy = H * Math.max(0.3, Math.min(1.05, 0.78 + (h.y - cen.y) / sc * 0.85)) + (1 - a) * H * 0.3;
      const wig = Math.min(1, (h.speed || 0) * 0.6), sz = H * 0.13, ax = W * (0.5 + d * 0.32), ay = H * 1.25;
      /* the arm, up from the bottom corner */
      c.lineCap = 'round';
      c.strokeStyle = mix(col, '#0a0f2a', 0.45); c.lineWidth = sz * 0.95; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + hx) / 2 + d * W * 0.05, (ay + hy) / 2 + H * 0.05, hx, hy + sz * 0.45); c.stroke();
      c.strokeStyle = col; c.lineWidth = sz * 0.8; c.stroke();
      /* the cuff, glowing */
      c.strokeStyle = mix(col, '#ffffff', 0.6); c.lineWidth = sz * 0.12; c.beginPath(); c.ellipse(hx, hy + sz * 0.42, sz * 0.42, sz * 0.12, 0, 0, 6.2832); c.stroke();
      /* the glove: the back of the hand, four fingers, a thumb - spreading as you wiggle */
      const gc = mix(col, '#ffffff', 0.25), gd = mix(col, '#0a0f2a', 0.35);
      for (let f = 0; f < 4; f++){
        const ang = -Math.PI / 2 + (f - 1.5) * (0.22 + wig * 0.18) + Math.sin(this.t * 14 + f) * wig * 0.15, len = sz * (0.55 - Math.abs(f - 1.5) * 0.06);
        c.strokeStyle = gd; c.lineWidth = sz * 0.2; c.beginPath(); c.moveTo(hx + (f - 1.5) * sz * 0.14, hy - sz * 0.1); c.lineTo(hx + (f - 1.5) * sz * 0.14 + Math.cos(ang) * len, hy - sz * 0.1 + Math.sin(ang) * len); c.stroke();
        c.strokeStyle = gc; c.lineWidth = sz * 0.15; c.stroke();
      }
      c.strokeStyle = gd; c.lineWidth = sz * 0.2; c.beginPath(); c.moveTo(hx - d * sz * 0.28, hy + sz * 0.05); c.lineTo(hx - d * sz * 0.55, hy - sz * 0.2 - wig * sz * 0.1); c.stroke();
      c.strokeStyle = gc; c.lineWidth = sz * 0.15; c.stroke();
      c.fillStyle = gc; c.beginPath(); c.ellipse(hx, hy + sz * 0.05, sz * 0.36, sz * 0.32, 0, 0, 6.2832); c.fill();
      c.strokeStyle = gd; c.lineWidth = Math.max(2, sz * 0.03); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(hx - sz * 0.1, hy - sz * 0.05, sz * 0.15, sz * 0.08, -0.4, 0, 6.2832); c.fill();
    }
    c.restore();
  }

  /* What you hear, coming round: the ears ringing (loud at first, then
     less, again each time you wake a little more); the fire burning,
     muffled in the dark and clearer as your eyes open; and voices, far
     off, crackling over a radio somewhere in the wreck. Quieter once the
     call comes, and gone once you're up. */
  _sounds(dt){
    const s = this.stage, clear = s === 'dark' ? 0 : s === 'wake' ? (this.notch || 0) / 4 : 1;
    if (s === 'rise' || this.done) return;
    const near = s === 'dark' || s === 'wake' ? 1 : 0.5;
    /* (the ringing: just once, faintly, in the dark) */
    if (s === 'dark' && this.ringT == null){ this.ringT = this.t; sfx.earRing?.(1); }
    this.roarT = (this.roarT ?? 0) - dt;
    if (this.roarT <= 0){ this.roarT = 1; sfx.fireRoar?.(near * (0.6 + 0.4 * clear), 1.3, clear); }
    if (Math.random() < dt * (4 + 4 * clear)) sfx.fireCrackle?.(near * (0.6 + 0.4 * clear), clear);
    this.talkT = (this.talkT ?? 2.2) - dt;
    if (this.talkT <= 0 && (s === 'dark' || s === 'wake')){ this.talkT = 2.5 + Math.random() * 2.5; sfx.chatter?.(0.5 + 0.5 * clear, clear); }
    /* breathing inside the helmet: slow and heavy in the dark, quicker as
       you wake, softer once you're up and listening */
    this.breathT = (this.breathT ?? 0.8) - dt;
    if (this.breathT <= 0){ this.breathT = s === 'dark' ? 4 : s === 'wake' ? 3.2 : 4.2; sfx.breath?.(s === 'call' || s === 'answer' ? 0.5 : 1, s === 'wake' ? clear : 0); }
    /* outside, as the eyes open: wind in the trees, birds singing - it's
       lovely out there */
    if (clear > 0.2){
      this.windT = (this.windT ?? 0) - dt;
      if (this.windT <= 0){ this.windT = 3.5 + Math.random() * 2; sfx.wind?.(clear); }
      if (Math.random() < dt * 0.6 * clear) sfx.bird?.(clear);
    }
    /* and once, far off, something big calling across the hills */
    if (!this.called && s === 'wake' && (this.notch || 0) >= 2){ this.called = true; sfx.giantCall?.(0.8); }
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
    if (s === 'wake'){ this._sparkles(c, W, H); banner(c, W, H, 'WIGGLE TO WAKE UP!', '#ffd24a', 1 + 0.03 * Math.sin(this.t * 6), this.wiggled); }
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
    /* the helper drone, out there in front of you (as blurred as the rest) */
    this._drone(c, W, H, clear);
    /* your own hands, in the suit's gloves, in front of you */
    this._gloves(c, W, H);
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
    if (s === 'wake') return Math.pow((this.notch || 0) / 4, 1.3) * 0.9;
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
    /* the display, bottom left - a picture, no words: the suit's battery,
       half gone, flashing, a spark jumping off it */
    const on = this.stage !== 'dark' && (Math.sin(this.t * 23) > -0.85 || this.stage !== 'wake');
    if (on){
      const x = W * 0.05, y = H * 0.8, w = H * 0.16, h = H * 0.075, flash = Math.sin(this.t * 6) > 0;
      c.globalAlpha = 0.9;
      c.fillStyle = 'rgba(5,6,15,.6)'; c.beginPath(); c.roundRect(x, y, w, h, h * 0.18); c.fill();
      c.strokeStyle = flash ? '#ff6b5b' : '#ffb35b'; c.lineWidth = H * 0.007; c.stroke();
      c.fillStyle = c.strokeStyle; c.fillRect(x + w, y + h * 0.3, h * 0.14, h * 0.4);
      c.fillStyle = flash ? '#ff9c5b' : '#ff7a4a'; c.beginPath(); c.roundRect(x + h * 0.12, y + h * 0.12, (w - h * 0.24) * START, h * 0.76, h * 0.1); c.fill();
      if ((this.t % 1.3) < 0.18){
        const sx = x + w * 0.75, sy = y - h * 0.15;
        c.strokeStyle = '#fff3a6'; c.lineWidth = H * 0.005; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(sx, sy + h * 0.4); c.lineTo(sx + h * 0.15, sy); c.lineTo(sx - h * 0.05, sy - h * 0.05); c.lineTo(sx + h * 0.12, sy - h * 0.45); c.stroke();
      }
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

  /* Wiggling: sparkles in each one's own colour, rising up the edges of
     the screen - their side of it - while they move: you see it's you. */
  _sparkles(c, W, H){
    const here = this.g.here;
    c.save();
    here.forEach((i, k) => {
      const on = this.stirring && this.stirring[i], side = here.length < 2 ? (k ? 1 : -1) : (k / (here.length - 1)) * 2 - 1;
      for (let j = 0; j < 14; j++){
        const u = (this.t * 0.6 + j / 14 + i * 0.13) % 1, a = on ? (1 - u) : (1 - u) * 0.15;
        const edge = side < 0 ? W * 0.04 : side > 0 ? W * 0.96 : W * (0.3 + 0.4 * ((j * 7) % 14) / 14);
        const x = edge + Math.sin(u * 9 + j) * W * 0.02 + (side === 0 ? 0 : -side * ((j * 5) % 14) / 14 * W * 0.06), y = H * (1 - u) + (side === 0 ? H * 0.15 : 0);
        c.globalAlpha = a; c.fillStyle = PLAYER_COLORS[i];
        c.beginPath(); c.arc(x, y, H * (0.006 + 0.008 * (1 - u)), 0, 6.2832); c.fill();
      }
    });
    c.restore();
  }

  /* The suit's display ringing: INCOMING CALL - NOVA, and who's answered. */
  _ringing(c, W, H){
    const g = this.g, ring = 0.5 + 0.5 * Math.sin(this.t * 9);
    /* it rings in bursts: two buzzes, a pause - the box shaking with each */
    const ph = this.t % 1.6, buzz = ph < 0.25 || (ph > 0.35 && ph < 0.6);
    const x = W / 2 + (buzz ? Math.sin(this.t * 70) * H * 0.008 : 0), y = H * 0.4;
    const bw = H * 0.78, bh = H * 0.26;
    c.save();
    c.fillStyle = 'rgba(5,12,30,.82)'; c.beginPath(); c.roundRect(x - bw / 2, y - bh / 2, bw, bh, H * 0.03); c.fill();
    c.strokeStyle = `rgba(127,243,255,${buzz ? 0.95 : 0.5 + 0.2 * ring})`; c.lineWidth = H * (buzz ? 0.007 : 0.004); c.stroke();
    /* her face, calling */
    const fx = x - bw / 2 + bh * 0.52, fr = bh * 0.36;
    c.save(); c.beginPath(); c.arc(fx, y, fr, 0, 6.2832); c.fillStyle = '#16264a'; c.fill(); c.clip();
    commanderFace(c, fx, y - fr * 0.1, fr * 0.62, this.t, false);
    c.restore();
    c.strokeStyle = '#7ff3ff'; c.lineWidth = H * 0.005; c.beginPath(); c.arc(fx, y, fr, 0, 6.2832); c.stroke();
    if (buzz) for (const k of [1, 1.3]){ c.globalAlpha = 0.5 / k; c.beginPath(); c.arc(fx, y, fr * k * (1 + 0.1 * Math.sin(this.t * 20)), 0, 6.2832); c.stroke(); }
    c.globalAlpha = 1;
    c.textAlign = 'left'; c.textBaseline = 'middle';
    const tx = fx + fr + H * 0.04;
    c.font = `700 ${Math.round(H * 0.032)}px Fredoka, sans-serif`; c.fillStyle = '#7ff3ff'; c.fillText('INCOMING CALL', tx, y - H * 0.05);
    c.font = `700 ${Math.round(H * 0.05)}px Fredoka, sans-serif`; c.fillStyle = '#ffffff'; c.fillText('NOVA', tx, y + H * 0.005);
    /* each of them: a dot filling as they hold a hand to their ear, full when they have */
    const here = g.here, r = H * 0.018;
    here.forEach((i, k) => {
      const dx = tx + r + k * r * 3.2, dy = y + H * 0.07;
      c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(dx, dy, r, 0, 6.2832); c.fill();
      c.fillStyle = PLAYER_COLORS[i];
      if (this.answered[i]){ c.beginPath(); c.arc(dx, dy, r, 0, 6.2832); c.fill(); }
      else { c.beginPath(); c.moveTo(dx, dy); c.arc(dx, dy, r, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, this.ear[i] / HOLD)); c.closePath(); c.fill(); }
    });
    c.restore();
    banner(c, W, H, 'HAND TO YOUR EAR TO ANSWER', '#7ff3ff', 1 + 0.03 * Math.sin(this.t * 6));
    /* the move, big, in the middle underneath: a hand going up to the ear */
    c.save();
    c.fillStyle = 'rgba(5,12,30,.6)'; c.beginPath(); c.arc(W / 2, H * 0.72, H * 0.15, 0, 6.2832); c.fill();
    c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff'; c.lineWidth = H * 0.012; c.lineCap = 'round'; c.lineJoin = 'round';
    figure(c, W / 2, H * 0.74, H * 0.26, 'ear', this.t);
    c.restore();
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
  dark(){ return false; },
  wake(dt){
    const here = this.g.here;
    for (const i of here){
      const moving = this.moves[i].step(pose.players[i], dt, pose.mouse.active);
      this.stirring = this.stirring || [];
      this.stirring[i] = moving > STIR;
      if (moving > STIR){ this.woke[i] = Math.min(WIGGLE, this.woke[i] + dt); if (Math.random() < dt * 4) sfx.step(i, 0.25); }
      else if (this.woke[i] < WIGGLE) this.woke[i] = Math.max(0, this.woke[i] - dt * DROOP);
    }
    /* the eyes open in big blinks - a quarter at a time - each one heard;
       all the way, the suit's display booting up */
    const notch = Math.floor(this.wiggled * 4 + 1e-6);
    if (notch > (this.notch || 0)){ this.notch = notch; this.blinkAt = this.t; if (notch >= 4) sfx.boot?.(); else sfx.pick(); }
    if (notch < (this.notch || 0)) this.notch = notch;
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
    /* up off the ground, one after another - and, as they get up, the
       rest of what she has to say */
    this.g.here.forEach((i, k) => { if (this.st > 0.6 + k * 0.15) this.up[i] = Math.min(1, this.up[i] + dt / 0.8); });
    if (!this.toldRise && this.st > 0.7){ this.toldRise = true; const l = this.g.level.lines.rise; if (l) this.g.captain.say(l[0][1], l[0][2] || ''); }
    return false;
  }
};
/* How open the eyes want to be, in each beat. */
const EYES = {
  /* closed - a flutter open - closed again */
  dark(){ const u = (this.st - 1.1) / 1.3; return u > 0 && u < 1 ? 0.35 * Math.sin(u * Math.PI) * (0.8 + 0.2 * Math.sin(this.t * 20)) : 0; },
  /* opening as they wiggle, a little heavy flicker while they're still low */
  wake(){
    /* a notch at a time, with a quick flutter as each one opens */
    const n = this.notch || 0, since = this.blinkAt != null ? this.t - this.blinkAt : 9;
    const flutter = since < 0.35 ? 0.25 * Math.sin(since / 0.35 * Math.PI) : 0;
    return Math.min(1, 0.1 + n / 4 * 0.9 - flutter + (n < 2 ? 0.03 * Math.sin(this.t * 3) : 0));
  },
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
