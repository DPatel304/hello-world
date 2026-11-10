/* Last Known Position's opening: waking up inside the helmet, after the
   crash. A scripted run of beats (INTRO_BEATS): the timed ones run
   themselves, the interactive ones wait on the players - never forever
   (max).

     crash   inside your helmet as the ship comes down (lkp-cockpit.js)
     title   the title card (lkp-title.js)
     dark    black; a heartbeat, the fire; the eyes flutter open on a
             blurred, tilted, burning crash site - and close again
     wake    everyone's wiggling together opens the eyes - the more they
             wiggle, the wider, the less blurred and doubled the view
     look    a slow look round, lying there; the noise settling
     stand   getting up - the view righting itself and rising - a look
             round, standing; then down at your own boots
     pull    slowly pulling back out through your visor to a close shot
             of the crew by the ship, the others getting up
     gather  the close shot: looking round, a bit lost, dusting
             themselves off, checking their arms
     call    their suits ring - INCOMING CALL, NOVA - a hand to the ear
             answers it
     answer  her first words, in her window
     go      the camera easing back and up into the game's own view;
             then they're off

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
import { Radio, script, novaBox } from './lkp-captain.js';
import { novaFeed } from './lkp-nova.js';
import { commanderFace } from './lkp-cast.js';
import { cockpit, cockpitSound, CRASH } from './lkp-cockpit.js';
import { P } from './lkp-art.js';
import { CREW_SIZE } from './lkp-game.js';
import { skyJellies } from './lkp-critters.js';
import { titleCard, titleSound, loadTitleFonts, CARD } from './lkp-title.js';

export const INTRO_BEATS = [
  { id: 'crash', time: CRASH, shot: 'inside the helmet: the visor display - WARNING, the height falling, BRACE - over a blurred, burning, rolling view; a white flash, black', blocking: 'the alarm, the rumble, a thump' },
  { id: 'title', time: CARD, shot: 'black; the title fading in, a streak of light through it; the level underneath; fade to black', blocking: 'nothing asked - the film starting' },
  { id: 'dark', time: 5, shot: 'black, then a flutter of the eyes: the burning crash site, blurred, tilted, doubled', blocking: 'ringing, a heartbeat, a radio crackling' },
  { id: 'wake', until: 'eyes open', max: 20, shot: 'through the helmet, lying on your side, the ship burning', blocking: 'everyone wiggling opens the eyes, clears the blur' },
  { id: 'look', time: 21, shot: 'through the helmet, clear, still lying there - taking it in: the head lifting; turning left, to hopshells (bunny-turtles) hopping on the meadow, holding; a little right, to a spring bubbling, holding; up to the sky, jellies drifting high up; back down to the ship', blocking: 'nothing asked - the fire fading, wind, birds, the spring burbling' },
  { id: 'stand', time: 6, shot: 'through the helmet: getting up - the view righting itself and rising - then turning right, past the ship, to the path running away into the woods', blocking: 'nothing asked - a shuffle of feet' },
  { id: 'pull', time: 4.5, shot: 'still looking down the path, the camera pulls straight back out of your eyes and up over your shoulder - your own astronaut, then the crew, rising into view - into the game\'s own view behind them', blocking: 'the others getting up' },
  { id: 'gather', time: 6, shot: 'the game\'s view, behind them on the path: the crew looking round, a bit lost; a quick dust-off; checking their arms', blocking: 'nothing asked' },
  { id: 'call', until: 'everyone answered', max: 15, shot: 'close on the crew', blocking: 'their suits ring: INCOMING CALL - NOVA; a hand to the ear answers' },
  { id: 'answer', until: 'her line said', lines: 'wakeup', shot: 'close on the crew; her window top left', blocking: 'Nova: you\'re okay' },
  { id: 'go', time: 1.2, shot: 'behind them on the path, ready to set off', blocking: 'Nova: follow the path' }
];
const BEAT = Object.fromEntries(INTRO_BEATS.map(b => [b.id, b]));
export const DARK = BEAT.dark.time, STAND = BEAT.stand.time, PULL_TIME = BEAT.pull.time, GATHER = BEAT.gather.time, GO = BEAT.go.time;
export const WAKE_MAX = BEAT.wake.max, RING_MAX = BEAT.call.max;
export const LOOK = BEAT.look.time;
export const TITLE_CARD = BEAT.title.time, CRASH_SHOT = BEAT.crash.time;
/* The call rings at least RING_FIRST before an answer counts.
   After she's spoken, a pause of SAID before you're up. */
export const RING_FIRST = 2, SAID = 1.4;
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
const POV = { cx: 0.067, cy: 0.44, s: 1.75, tilt: -0.24 };
/* Where to look, lying there (POV pans: + left): the hopshells off on
   the meadow to the left; the spring, a little right of the ship. */
const AT_HOPPERS = 1.02, AT_SPRING = -0.39;
/* Standing on the grass, this far (lanes) to the left of their places on
   the path. */
const GRASS = 0;   /* (on the path itself: the camera comes out over their shoulders, looking down it) */
/* The wake hint shows once nobody's moved for HINT seconds. */
const HINT = 4;
/* Pulling back out of the visor: from, to (seconds into the pull), and
   how close it starts. */
/* Out of your eyes and back over your shoulder: how long (seconds into
   the pull), and how far round your head turns to look down the path
   (POV pan: the path's middle, from looking at the ship). */
const OUT = 3.4, TO_PATH = -(0.5 - POV.cx) * POV.s * 0.82;
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
    this.radio = new Radio(); this.radio.visible = false;
    this.titleSnd = {}; this.crashSnd = {}; loadTitleFonts();
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
    if (['pull', 'gather', 'call', 'answer', 'go'].includes(this.stage)) this.cineT = (this.cineT || 0) + dt;
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
      /* (the fire first; your heartbeat coming in after it) */
      if (this.stage === 'wake' || this.st > 1.6){
        this.beatT -= dt;
        if (this.beatT <= 0){ sfx.heartbeat?.(1.5); this.beatT = 1.05; this.beatAt = this.t; }
      }
    }
    if (this.stage === 'crash') cockpitSound(this.st, dt, this.crashSnd);
    else if (this.stage === 'title') titleSound(this.st, dt, this.titleSnd);
    else this._sounds(dt);
    const b = this.beat;
    const over = STEP[b.id].call(this, dt);
    /* the eyes: how open, eased */
    const want = EYES[this.stage].call(this);
    this.open += (want - this.open) * Math.min(1, dt * 5);
    if (over || (b.time && this.st >= b.time) || (b.max && this.st >= b.max && (FORCE[b.id] ? (FORCE[b.id].call(this), true) : true))) this._next();
  }




  /* What you hear, coming round: the ears ringing (loud at first, then
     less, again each time you wake a little more); the fire burning,
     muffled in the dark and clearer as your eyes open; and voices, far
     off, crackling over a radio somewhere in the wreck. Quieter once the
     call comes, and gone once you're up. */
  _sounds(dt){
    const s = this.stage, clear = s === 'dark' ? 0 : s === 'wake' ? (this.notch || 0) / 4 : 1;
    if (s === 'go' || this.done){ if (!this.fireOut){ this.fireOut = true; sfx.fireOut?.(); } return; }
    /* once the eyes are open it settles: the fire further off, quieter;
       wind and birds; a soft calm hum coming in */
    const calm = s === 'dark' || s === 'wake' ? 0 : s === 'look' ? Math.min(1, this.st / 3) : 1;
    /* (and the fire fading right back as you start to look round, the ship further off) */
    const away = s === 'look' ? Math.min(1, Math.max(0, (this.st - 1.5) / 4)) : s === 'dark' || s === 'wake' ? 0 : 1;
    const near = (1 - 0.65 * calm) * (1 - 0.82 * away);
    /* the spring burbling: louder the more you're looking its way */
    if (s === 'look' || s === 'stand'){
      const f = Math.max(0.15, 1 - Math.abs(this._looking().pan - AT_SPRING) / 0.45);
      if (Math.random() < dt * 9 * f) sfx.brook?.(f);
    }
    if (calm > 0 && !this.pad){ this.pad = true; sfx.calmPad?.(); }
    /* (the ringing: just once, faintly, in the dark) */
    if (s === 'dark' && this.ringT == null){ this.ringT = this.t; sfx.earRing?.(1); }
    /* the fire: burning steadily, crackling all the time */
    sfx.fireBed?.(near * (0.7 + 0.3 * clear), clear);
    if (Math.random() < dt * (5 - 3.5 * calm)) sfx.fireCrackle?.(near * (0.3 + 0.2 * clear), clear);
    this.talkT = (this.talkT ?? 2.2) - dt;
    if (this.talkT <= 0 && (s === 'dark' || s === 'wake')){ this.talkT = 2.5 + Math.random() * 2.5; sfx.chatter?.(0.5 + 0.5 * clear, clear); }
    /* outside, as the eyes open: wind in the trees, birds singing - it's
       lovely out there */
    if (clear > 0.2){
      this.windT = (this.windT ?? 0) - dt;
      if (this.windT <= 0){ this.windT = 5 + Math.random() * 3; sfx.wind?.(clear * 0.4); }
      if (Math.random() < dt * (0.6 + 0.5 * calm) * clear) sfx.bird?.(clear);
    }
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
    if (s === 'crash'){ cockpit(c, W, H, this.st); return; }
    if (s === 'title'){ const lv = this.g.level, n = (this.g.levelNo ?? 0) + 1; titleCard(c, W, H, this.st, `LEVEL ${n}  |  ${(lv && lv.name || '').toUpperCase()}`); return; }
    if (s === 'pull') this._pullBack(c, W, H);
    else if (['gather', 'call', 'answer', 'go'].includes(s)) this._cine(c, W, H);
    else this._helmet(c, W, H);
    this._lids(c, W, H);
    if (s === 'wake'){ this._sparkles(c, W, H); this._wakeHint(c, W, H); }
    if (s === 'call') this._ringing(c, W, H);
    this.radio.draw(c, W, H);
  }

  /* Through the helmet: the crash site, lying on your side - blurred and
     doubled till you're properly awake - the visor cracked, the suit's
     display, the edges dark (red with each heartbeat). */
  _helmet(c, W, H){
    const g = this.g, clear = this._clear(), sway = Math.sin(this.t * 0.6) * 0.02 * (1 - clear * 0.6), look = this._looking();
    const view = (cx) => {
      cx.save();
      /* (sky: tipped right back, the sky filling the view) */
      cx.translate(W / 2 + look.pan * W, H / 2 + look.rise * H * 0.06 + look.up * H * 0.14 - look.down * H * 0.42 + (look.sky || 0) * H * 0.75); cx.rotate((POV.tilt * (1 - look.rise * 0.45) * (1 - look.up) + sway * (1 - look.up * 0.6)) * (1 - 0.6 * (look.sky || 0))); cx.scale(POV.s * (1 - 0.18 * look.up), POV.s * (1 - 0.18 * look.up)); cx.translate(-POV.cx * W, -POV.cy * H);
      g.inIntro = true; g.introCrew = []; SKY.above = H * (1 + (look.sky || 0)); SKY.wide = W * 1.3;
      g._drawPlay(cx, W, H);
      g.inIntro = false; g.introCrew = null; SKY.above = 0; SKY.wide = 0;
      /* up there, high above the ship: little sky jellies, drifting - out in the sky, where they are, whichever way you look */
      if (look.sky > 0.01){ cx.save(); cx.translate(-W * 0.42, -H * 0.32); skyJellies(cx, W, H, this.t, 1, 12 + this.st * 0.3, 0.55); cx.restore(); }
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
  /* The slow look round, once the eyes are open: the view turning one
     way, then the other, then back - and the head lifting a little off
     the ground, and staying up. */
  _looking(){
    const e = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
    /* lying there: the head lifting and turning a little to the left,
       holding; then up to the sky a while; then back down to the ship */
    if (this.stage === 'look'){
      /* slowly, holding at each: left to the hopshells (2.6-5, holding to
         8); a little right, to the spring (8-10.5, to 13.5); up to the sky
         (13.5-15.5, to 18); back down to the ship (18-20.5) */
      const t = this.st, toS = e((t - 8) / 2.5), up = e((t - 13.5) / 2) * (1 - e((t - 18) / 2.5));
      const pan = AT_HOPPERS * e((t - 2.6) / 2.4) * (1 - toS) + AT_SPRING * toS * (1 - e((t - 13.5) / 2.2));
      return { pan, rise: e(t / 2.6), up: 0, down: 0, sky: up };
    }
    /* standing up (the view righting itself, rising); then turning right,
       past the ship, to look down the path */
    if (this.stage === 'stand' || this.stage === 'pull'){
      const t = this.stage === 'pull' ? STAND : this.st;
      return { pan: TO_PATH * e((t - 2.2) / 2.8), rise: 1, up: e(t / 2), down: 0, sky: 0 };
    }
    return { pan: 0, rise: ['dark', 'wake'].includes(this.stage) ? 0 : 1, up: 0, down: 0, sky: 0 };
  }
  /* How clear the view is, 0..1: blurred coming round, clear once awake. */
  _clear(){
    const s = this.stage;
    if (s === 'dark') return 0;
    if (s === 'wake') return Math.pow((this.notch || 0) / 4, 1.3) * 0.9;
    return 1;
  }

  /* The visor: the suit's display - damaged, half its power. */
  _visor(c, W, H){
    c.save();
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
    /* it rings in bursts: two buzzes, a pause - her window (where she
       always is, novaBox) shaking with each */
    const ph = this.t % 1.6, buzz = ph < 0.25 || (ph > 0.35 && ph < 0.6);
    const b = novaBox(W, H), x = b.x + (buzz ? Math.sin(this.t * 70) * H * 0.005 : 0), y = b.y;
    c.save();
    c.fillStyle = '#0b1220'; c.beginPath(); c.roundRect(x, y, b.w, b.h, b.h * 0.08); c.fill();
    c.save(); c.clip();
    if (!novaFeed(c, x, y, b.w, b.h, this.t, false)) commanderFace(c, x + b.w / 2, y + b.h * 0.5, b.h * 0.3, this.t, false);
    /* INCOMING CALL, across it */
    c.fillStyle = 'rgba(5,12,30,.72)'; c.fillRect(x, y + b.h * 0.36, b.w, b.h * 0.28);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.globalAlpha = buzz ? 1 : 0.6 + 0.3 * ring;
    c.font = `700 ${Math.round(b.h * 0.13)}px Fredoka, sans-serif`; c.fillStyle = '#7ff3ff'; c.fillText('INCOMING CALL', x + b.w / 2, y + b.h * 0.5);
    c.restore();
    c.strokeStyle = `rgba(127,243,255,${buzz ? 0.95 : 0.5 + 0.2 * ring})`; c.lineWidth = H * (buzz ? 0.006 : 0.003);
    c.beginPath(); c.roundRect(x, y, b.w, b.h, b.h * 0.08); c.stroke();
    if (buzz) for (const k of [1.04, 1.09]){ c.globalAlpha = 0.4 / k; c.beginPath(); c.roundRect(x - b.w * (k - 1), y - b.h * (k - 1), b.w * (2 * k - 1), b.h * (2 * k - 1), b.h * 0.1); c.stroke(); }
    c.globalAlpha = 1;
    /* each of them: a dot under it, filling as they hold a hand to their ear */
    const here = g.here, r = H * 0.014;
    here.forEach((i, k) => {
      const dx = x + r + k * r * 3, dy = y + b.h + H * 0.025;
      c.fillStyle = 'rgba(5,12,30,.6)'; c.beginPath(); c.arc(dx, dy, r * 1.15, 0, 6.2832); c.fill();
      c.fillStyle = PLAYER_COLORS[i];
      if (this.answered[i]){ c.beginPath(); c.arc(dx, dy, r, 0, 6.2832); c.fill(); }
      else { c.beginPath(); c.moveTo(dx, dy); c.arc(dx, dy, r, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, this.ear[i] / HOLD)); c.closePath(); c.fill(); }
    });
    c.restore();
    /* (what to do: the helper icon in the corner shows it - lkp-guide.js) */
  }

  /* Outside, after the blink: the game's own view, the crew getting up
     on the path, by the burning ship. */
  /* Waking: nothing on screen - unless nobody's moved for a while, when
     the visor shows, faint and flickering, what it needs. */
  _wakeHint(c, W, H){
    const a = Math.min(1, Math.max(0, (this.still || 0) - HINT) / 1.2);
    if (a <= 0) return;
    const flick = Math.sin(this.t * 31) > -0.7 ? 1 : 0.35;
    c.save(); c.globalAlpha = a * flick * (0.8 + 0.2 * Math.sin(this.t * 2));
    c.font = `600 ${Math.round(H * 0.03)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(127,243,255,.95)'; c.shadowColor = 'rgba(127,243,255,.6)'; c.shadowBlur = H * 0.01;
    const txt = 'MOVEMENT NEEDED TO WAKE', bars = Math.floor(this.t * 2) % 4;
    c.fillText(txt + ' ' + '.'.repeat(bars), W / 2, H * 0.86);
    c.restore();
  }

  /* Up and out: the camera pulling back out through your own visor - your
     view still in it, shrinking - up and back to the game's view, the crew
     getting up by the ship. Where the lead one's helmet is: */
  _headAt(W, H){
    const g = this.g, i = g.here[0] ?? 0, p = P(this._lane(i), RUN_AT, W, H), h = H * CREW_SIZE * p.k;
    /* (as lkp-cast.js lays them down: shifted, turned a quarter) */
    const dn = 1 - easeOut(this.up[i] || 0), th = -Math.PI / 2 * dn, hy = h * 0.8;
    return { x: p.x + h * 0.42 * dn + hy * Math.sin(th), y: p.y - h * 0.14 * dn - hy * Math.cos(th), h, tilt: th };
  }
  /* Where each of them is, across: on the grass beside the path (GRASS
     lanes to its left, between it and the ship) until they walk over to
     it, at the end. */
  _lane(i){
    const g = this.g, home = g._home(i);
    if (this.stage !== 'go') return home - GRASS;
    const u = Math.min(1, this.st / (GO * 0.85)), e = u * u * (3 - 2 * u);
    return home - GRASS * (1 - e);
  }
  /* One picture over another, fading (a: how much of the top one). */
  _over(c, W, H, a, draw){
    if (a <= 0) return;
    const buf = bufOf(W, H);
    if (!buf){ if (a > 0.5) draw(c); return; }
    const bc = buf.getContext('2d'); bc.setTransform(1, 0, 0, 1, 0, 0); bc.clearRect(0, 0, W, H); draw(bc);
    c.save(); c.globalAlpha = Math.min(1, a); c.drawImage(buf, 0, 0, W, H); c.restore();
  }
  /* Out of your eyes: you're looking down the path - the way the game
     looks - so the camera just pulls straight back and up over your
     shoulder, one move, from your view (zoomed in, as through the visor)
     to the game's own view behind the crew: your astronaut, then the
     others, rising into the bottom of the picture as it goes; the
     helmet's dark edges and display fading away. */
  _pullBack(c, W, H){
    const u0 = Math.max(0, Math.min(1, this.st / OUT)), u = u0 * u0 * (3 - 2 * u0);
    const look = this._looking(), s0 = POV.s * (1 - 0.18 * look.up);
    const A = [W / 2 + look.pan * W, H / 2 + look.rise * H * 0.06 + look.up * H * 0.14], C = [POV.cx * W, POV.cy * H];
    const lerp = (a, b) => a + (b - a) * u, s = Math.exp(lerp(Math.log(s0), 0));
    c.save();
    c.translate(lerp(A[0], W / 2), lerp(A[1], H / 2)); c.scale(s, s); c.translate(-lerp(C[0], W / 2), -lerp(C[1], H / 2));
    SKY.above = H * (1 - u); SKY.wide = W * 1.3 * (1 - u);
    this._outside(c, W, H);
    SKY.above = 0; SKY.wide = 0;
    c.restore();
    /* the helmet round you, going */
    const a = Math.pow(1 - u, 1.5);
    if (a > 0.01){
      c.save(); c.globalAlpha = a;
      const vg = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
      this._visor(c, W, H);
      c.restore();
    }
  }
  /* Behind them, in the game's own view. */
  _cine(c, W, H){ this._outside(c, W, H); }
  /* What each of them is doing in the close shot: looking round, dusting
     themselves off, checking an arm - each on their own time. */
  _act(i, k){
    const s = this.stage;
    /* answered: a hand up at the helmet, listening */
    if ((s === 'call' || s === 'answer') && this.answered[i]) return { pose: 'ear', look: Math.sin(this.t * 0.6 + k) * 0.2 };
    if (s === 'go' || s === 'answer') return { pose: null, look: s === 'answer' ? Math.sin(this.t * 0.6 + k) * 0.3 : 0 };
    /* (a quick dust-off - a second or so - not a long one) */
    const T = (this.cineT || 0) + k * 1.9, ph = T % 8;
    if (ph < 2.4) return { pose: null, look: Math.sin(T * 1.4) };
    if (ph < 3.5) return { pose: 'dust', look: 0 };
    if (ph < 5.2) return { pose: 'check', look: -0.5 };
    return { pose: null, look: Math.sin(T * 1.1) * 0.7 };
  }
  _outside(c, W, H){
    const g = this.g;
    const cine = ['pull', 'gather', 'call', 'answer'].includes(this.stage);
    g.introCrew = g.here.map((i, k) => { const a = this.up[i] > 0.99 && cine ? this._act(i, k) : { pose: null, look: 0 }; return { i, lane: this._lane(i), rel: RUN_AT, down: 1 - easeOut(this.up[i]), noBar: this.stage !== 'go', pose: a.pose, look: a.look }; });
    g.inIntro = true;
    g._drawPlay(c, W, H);
    g.inIntro = false; g.introCrew = null;
  }
}

/* ---------- what each beat does ---------- */

const BEGIN = {
  answer(){ this.radio.visible = true; this.radio.say(...script('wakeup', this.g)); },
  stand(){ const i = this.g.here[0]; if (i != null) this.up[i] = 1; },
  pull(){ sfx.pullBack?.(); },
  go(){ this.radio.visible = false; const l = this.g.level.lines.rise; if (l) this.g.captain.say(l[0][1], l[0][2] || ''); }
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
    /* nobody moving: how long (for the hint) */
    this.still = here.some(i => this.stirring && this.stirring[i]) ? 0 : (this.still || 0) + dt;
    /* the eyes open in big blinks - a quarter at a time - each one heard;
       all the way, the suit's display booting up */
    const notch = Math.floor(this.wiggled * 4 + 1e-6);
    if (notch > (this.notch || 0)){ this.notch = notch; this.blinkAt = this.t; if (notch >= 4) sfx.visorOn?.(); }
    if (notch < (this.notch || 0)) this.notch = notch;
    return this._settled(dt, (here.length > 0 && this.wiggled >= 1) || (!here.length && this.st > 3));
  },
  look(){ return false; },
  crash(){ return false; },
  title(){ return false; },
  call(dt){
    this._getUp(dt, 0);
    const here = this.g.here;
    if (Math.random() < dt * 1.5) sfx.trill?.();
    for (const i of here){
      if (this.answered[i] || this.st < RING_FIRST) continue;
      this.ear[i] = this._atEar(i) ? this.ear[i] + dt : Math.max(0, this.ear[i] - dt * 2);
      if (this.ear[i] >= HOLD){ this.answered[i] = true; sfx.pick(); }
    }
    return this._settled(dt, here.every(i => this.answered[i]));
  },
  /* her words; then a quiet moment */
  answer(dt){ this.quiet = this.radio.busy ? 0 : (this.quiet || 0) + dt; return this.quiet >= SAID; },
  stand(dt){
    /* a shuffle of feet, getting up and looking down */
    if (!this.stoodSnd && this.st > 1.4){ this.stoodSnd = true; sfx.step(0, 0.4); }
    return false;
  },
  /* the others getting up as the camera pulls back */
  pull(dt){ this._getUp(dt, 2.2); return false; },
  gather(dt){ this._getUp(dt, 0); return false; },
  go(){ return false; }
};
/* How open the eyes want to be, in each beat. */
const EYES = {
  /* closed - a flutter open - closed again */
  dark(){ const u = (this.st - 2.6) / 1.4; return u > 0 && u < 1 ? 0.35 * Math.sin(u * Math.PI) * (0.8 + 0.2 * Math.sin(this.t * 20)) : 0; },
  /* opening as they wiggle, a little heavy flicker while they're still low */
  wake(){
    /* a notch at a time, with a quick flutter as each one opens */
    const n = this.notch || 0, since = this.blinkAt != null ? this.t - this.blinkAt : 9;
    const flutter = since < 0.35 ? 0.25 * Math.sin(since / 0.35 * Math.PI) : 0;
    return Math.min(1, 0.1 + n / 4 * 0.9 - flutter + (n < 2 ? 0.03 * Math.sin(this.t * 3) : 0));
  },
  look(){ return 1; },
  crash(){ return 0; },
  title(){ return 0; },
  call(){ return 1; },
  answer(){ return 1; },
  /* the blink: shut, then open outside */
  stand(){ return 1; },
  pull(){ return 1; },
  gather(){ return 1; },
  go(){ return 1; }
};
/* When a beat's waited as long as it will: as if everyone had done it. */
const FORCE = {
  wake(){ for (const i of this.g.here) this.woke[i] = WIGGLE; },
  call(){ for (const i of this.g.here) this.answered[i] = true; }
};
/* Up off the ground, one after another (after a while, from). */
Intro.prototype._getUp = function (dt, from){
  this.g.here.forEach((i, k) => { if (this.st > from + k * 0.7) this.up[i] = Math.min(1, this.up[i] + dt / 1.6); });
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

