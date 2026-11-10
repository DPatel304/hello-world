/* Last Known Position's opening: waking up inside the helmet, after the
   crash. A scripted run of beats (INTRO_BEATS): the timed ones run
   themselves, the interactive ones wait on the players - never forever
   (max).

     crash   inside your helmet as the ship comes down (lkp-cockpit.js)
     title   the title card (lkp-title.js)
     dark    black; a heartbeat; the eyes flutter open on a blurred,
             tilted view - and close again
     wake    the eyes coming open by themselves, the blur clearing - on
             a hopshell (a bunny-turtle), just in front, in the grass
     watch   minding its own business, it hops slowly away to the right,
             and the view follows it...
     notice  ...far enough that, beyond it, there's the ship: crashed,
             smoking. The view settles on it, and stays.
     call    their suits ring - INCOMING CALL, NOVA - a hand to the ear
             answers it
     answer  her words: you're okay; you came down on a planet nobody
             knows; the crash knocked out your Star Core - find it
     out     still sitting there, the head turns to the path, and the
             camera pulls back out over your shoulder into the game's view
             - the crew sat in the grass
     rise    "On your feet, crew!" - they get up, one after another
     move    "Can you move?" - everyone wiggling, each astronaut bouncing
             with their own player: that one's you
     go      and off they go - a walk, then a run (lkp-game.js walkIn)

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
  /* (the crash, inside the helmet - lkp-cockpit.js - is left out for now, being reworked; the opening starts at the title:
  { id: 'crash', time: CRASH, shot: 'inside the helmet: the visor display - WARNING, the height falling, BRACE - over a blurred, burning, rolling view; a white flash, black', blocking: 'the alarm, the rumble, a thump' }, ) */
  { id: 'title', time: CARD, shot: 'black; the title fading in, a streak of light through it; the level underneath; fade to black', blocking: 'nothing asked - the film starting' },
  { id: 'dark', time: 5, shot: 'black, then a flutter of the eyes: blurred, tilted, doubled', blocking: 'ringing, a heartbeat, a radio crackling' },
  { id: 'wake', time: 4, shot: 'through the helmet, sitting in the grass: the eyes coming open on a hopshell, just in front', blocking: 'nothing asked' },
  { id: 'watch', time: 9, shot: 'through the helmet: the hopshell hopping slowly away to the right, minding its own business - the view following it', blocking: 'nothing asked - wind, birds' },
  { id: 'notice', time: 6, shot: 'beyond it, in the distance: the ship, crashed, smoking - the view settling on it, staring', blocking: 'nothing asked' },
  { id: 'call', until: 'everyone answered', max: 15, shot: 'through the helmet, looking at the ship', blocking: 'their suits ring: INCOMING CALL - NOVA; a hand to the ear answers' },
  { id: 'answer', until: 'her lines said', lines: 'wakeup, walk', shot: 'through the helmet; her window top left', blocking: 'Nova: you\'re okay; an unknown planet; the Star Core' },
  { id: 'out', time: 6, shot: 'the head turning to the path; the camera pulling straight back out over your shoulder into the game\'s view - the crew sat in the grass', blocking: 'nothing asked' },
  { id: 'rise', until: 'everyone up', max: 8, shot: 'the game\'s view: the crew getting up, one after another', blocking: 'Nova: on your feet!' },
  { id: 'move', until: 'everyone wiggled', max: 20, shot: 'the game\'s view: each astronaut bouncing as their player wiggles', blocking: 'Nova: can you move? - everyone wiggling' },
  { id: 'go', time: 1, shot: 'behind them on the path, setting off', blocking: 'Nova: follow that path' }
];
const BEAT = Object.fromEntries(INTRO_BEATS.map(b => [b.id, b]));
export const DARK = BEAT.dark.time, WAKE = BEAT.wake.time, WATCH = BEAT.watch.time, NOTICE = BEAT.notice.time, OUT_TIME = BEAT.out.time, GO = BEAT.go.time;
export const MOVE_MAX = BEAT.move.max, RING_MAX = BEAT.call.max, RISE_MAX = BEAT.rise.max;
export const TITLE_CARD = BEAT.title.time, CRASH_SHOT = BEAT.crash ? BEAT.crash.time : 0;
/* The call rings at least RING_FIRST before an answer counts.
   After she's spoken, a pause of SAID before you're up. */
export const RING_FIRST = 2, SAID = 1.4;
/* Getting up: moving (body sizes a second) more than STIR counts; WIGGLE
   seconds of it each and you've done your share - it slips back DROOP a
   second when you stop. */
export const STIR = 0.45, WIGGLE = 1.6, DROOP = 0.35;
/* The call: a hand held at the ear HOLD seconds answers it. */
export const HOLD = 0.4;
/* They start on START of their health: hurt in the crash. */
export const START = 0.5;
/* Through the helmet: looking at (cx, cy) - screens - s times closer,
   tilted (lying on your side). */
const POV = { cx: 0.152, cy: 0.41, s: 1.75, tilt: -0.12 };
/* Where to look, sitting there (POV pans: + left; down: lower): the
   hopshells, close, just in front; the chimeblooms, a little right of
   the ship (heard, not looked at). */
const AT_CHIMES = -0.33;
/* The hopshell, hopping along (lanes, across: from, to; and how far off,
   rel), and where you're looking to follow it. */
const HOP = { from: -5.6, to: -2.6, rel: 0.27 };
/* Standing on the grass, this far (lanes) to the left of their places on
   the path. */
const GRASS = 0;   /* (on the path itself: the camera comes out over their shoulders, looking down it) */
/* Pulling back out of the visor: from, to (seconds into the pull), and
   how close it starts. */
/* Out of your eyes and back over your shoulder: how long (seconds into
   the pull), and how far round your head turns to look down the path
   (POV pan: the path's middle, from looking at the ship). */
const TURN = 2.2, OUT = 3.4, TO_PATH = -(0.5 - POV.cx) * POV.s * 0.82;
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
    if (['out', 'rise', 'move', 'go'].includes(this.stage)) this.cineT = (this.cineT || 0) + dt;
    /* the hopshell, hopping along (it's out in the world: lkp-crashsite.js) */
    if (!['title', 'dark'].includes(this.stage)) this.hopT = (this.hopT || 0) + dt * (this.stage === 'wake' ? 0.25 : 1);
    const hs = this.g.things.find(t => t.kind === 'hoppers');
    if (hs){ hs.one = true; hs.lane = this._hopLane(); hs.d = this.g.z + HOP.rel; }
    const g = this.g;
    /* Hurt in the crash; on the path, where play starts. */
    if (!this.hurt){
      this.hurt = true;
      for (const rn of g.crew) rn.hp = Math.round(rn.max * START);
      for (const i of g.here){ g.crew[i].played = true; g.crew[i].x = g._home(i); }
    }
    this.radio.step(dt);
    /* the heartbeat, while you're coming round */
    if (this.stage === 'dark' || (this.stage === 'wake' && this.st < WAKE * 0.6)){
      /* (your heartbeat, coming in in the dark) */
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
    const s = this.stage, clear = s === 'dark' ? 0 : s === 'wake' ? this._clear() : 1;
    if (s === 'go' || this.done) return;
    /* once the eyes are open it settles: the fire further off, quieter;
       wind and birds; a soft calm hum coming in */
    const calm = s === 'dark' ? 0 : s === 'wake' ? Math.min(1, this.st / 3) : 1;
    /* the chimeblooms ringing, softly, now and then: louder the more you're looking their way */
    if (!['dark', 'wake'].includes(s)){
      const f = Math.max(0.12, 1 - Math.abs(this._looking().pan - AT_CHIMES) / 0.45);
      if (Math.random() < dt * 1.6 * (0.4 + f)) sfx.chime?.(f);
    }
    /* (no soft calm hum for now - left out while the sound's worked out) */
    /* (the ringing: just once, faintly, in the dark) */
    if (s === 'dark' && this.ringT == null){ this.ringT = this.t; sfx.earRing?.(1); }
    /* the fire: burning steadily, crackling all the time */
    /* (no fire now: the ship's just smoking) */
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
    if (s === 'out' && this.st >= TURN) this._pullBack(c, W, H, (this.st - TURN) / OUT);
    else if (s === 'rise' || s === 'move' || s === 'go') this._cine(c, W, H);
    else this._helmet(c, W, H);
    this._lids(c, W, H);
    if (s === 'move') this._sparkles(c, W, H);
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
  /* The hopshell's lane, now (it's hopping along, slowly, to the right). */
  _hopLane(){
    /* (it never stops: on past the ship and away, while you stare at the ship) */
    if (this.hopT == null) this.hopT = 0;
    return HOP.from + (HOP.to - HOP.from) * this.hopT / (WATCH + 1);
  }
  /* Where you're looking, sitting there: following the hopshell (waking,
     watching); then on to the ship beyond it, settling there (noticing,
     the call, her words); then turning to the path (out). */
  _looking(){
    const e = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
    const s = this.stage, t = this.st, W = 1920, H = 1080;
    const q = P(this._hopLane(), HOP.rel, W, H);
    const hop = { pan: (POV.cx * W - q.x) / W * POV.s, down: (q.y - H * 0.04 - POV.cy * H) * POV.s / (H * 0.42) };
    const at = { rise: 1, up: 0, sky: 0 };
    if (s === 'dark' || s === 'wake' || s === 'watch') return { ...at, ...hop, rise: s === 'dark' ? 0 : s === 'wake' ? e(t / WAKE) : 1 };
    if (s === 'notice'){ const u = e((t - 1) / 3.2); return { ...at, pan: hop.pan * (1 - u), down: hop.down * (1 - u) }; }
    if (s === 'out'){ const u = e(t / TURN); return { ...at, pan: TO_PATH * u, down: 0 }; }
    return { ...at, pan: 0, down: 0 };
  }
  /* How clear the view is, 0..1: blurred coming round, clear once awake. */
  _clear(){
    const s = this.stage;
    if (s === 'dark') return 0;
    if (s === 'wake') return Math.min(1, Math.pow(this.st / (WAKE * 0.85), 1.2));
    return 1;
  }

  /* The visor: you're inside a helmet - its rim round the edge of the
     view, the glass's faint curve and gleam, thin HUD brackets in the
     corners and a heading strip at the top - minimal, but clearly a
     helmet; and the suit's display - damaged, half its power. */
  _visor(c, W, H){
    c.save();
    const hud = this.stage === 'dark' ? 0 : this.stage === 'wake' ? Math.min(1, Math.max(0, (this.st - WAKE * 0.7) / (WAKE * 0.3))) : 1;
    /* the helmet's rim: dark, rounded, round the whole view */
    const rim = c.createRadialGradient(W / 2, H / 2, H * 0.62, W / 2, H / 2, W * 0.6);
    rim.addColorStop(0, 'rgba(8,10,22,0)'); rim.addColorStop(0.7, 'rgba(8,10,22,.55)'); rim.addColorStop(1, 'rgba(8,10,22,.95)');
    c.fillStyle = rim; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(230,240,255,.18)'; c.lineWidth = H * 0.008;
    c.beginPath(); c.ellipse(W / 2, H / 2, W * 0.52, H * 0.6, 0, 0, Math.PI * 2); c.stroke();
    /* a gleam across the glass */
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = H * 0.05; c.lineCap = 'round';
    c.beginPath(); c.ellipse(W / 2, H * 0.55, W * 0.46, H * 0.52, 0, Math.PI * 1.12, Math.PI * 1.36); c.stroke();
    if (hud > 0){
      c.globalAlpha = hud * (0.75 + 0.05 * Math.sin(this.t * 3));
      c.strokeStyle = '#7ff3ff'; c.lineWidth = Math.max(2, H * 0.003); c.lineCap = 'square';
      /* corner brackets */
      const m = H * 0.09, L = H * 0.05;
      for (const [x, y, dx, dy] of [[W * 0.12, m, 1, 1], [W * 0.88, m, -1, 1], [W * 0.12, H - m, 1, -1], [W * 0.88, H - m, -1, -1]]){
        c.beginPath(); c.moveTo(x, y + dy * L); c.lineTo(x, y); c.lineTo(x + dx * L, y); c.stroke();
      }
      /* a heading strip at the top, ticks sliding as you look round */
      const look = this._looking(), y0 = H * 0.075, off = (look.pan || 0) * W * 0.25;
      c.lineWidth = Math.max(1.5, H * 0.002);
      c.beginPath(); c.moveTo(W * 0.4, y0); c.lineTo(W * 0.6, y0); c.stroke();
      for (let k = -12; k <= 12; k++){ const x = W / 2 + k * W * 0.015 + (off % (W * 0.015)); if (x < W * 0.4 || x > W * 0.6) continue; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 - H * (k % 4 === 0 ? 0.014 : 0.007)); c.stroke(); }
      c.fillStyle = '#7ff3ff'; c.beginPath(); c.moveTo(W / 2, y0 + H * 0.006); c.lineTo(W / 2 - H * 0.008, y0 + H * 0.018); c.lineTo(W / 2 + H * 0.008, y0 + H * 0.018); c.fill();
      c.globalAlpha = 1;
    }
    /* the display, bottom left - a picture, no words: the suit's battery,
       half gone */
    const on = this.stage !== 'dark' && (Math.sin(this.t * 23) > -0.85 || this.stage !== 'wake') && !(this.stage === 'wake' && this.st < WAKE * 0.8);
    if (on){
      const x = W * 0.05, y = H * 0.8, w = H * 0.16, h = H * 0.075, flash = Math.sin(this.t * 6) > 0;
      c.globalAlpha = 0.9;
      c.fillStyle = 'rgba(5,6,15,.6)'; c.beginPath(); c.roundRect(x, y, w, h, h * 0.18); c.fill();
      c.strokeStyle = flash ? '#ff6b5b' : '#ffb35b'; c.lineWidth = H * 0.007; c.stroke();
      c.fillStyle = c.strokeStyle; c.fillRect(x + w, y + h * 0.3, h * 0.14, h * 0.4);
      c.fillStyle = flash ? '#ff9c5b' : '#ff7a4a'; c.beginPath(); c.roundRect(x + h * 0.12, y + h * 0.12, (w - h * 0.24) * START, h * 0.76, h * 0.1); c.fill();
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
    /* (round each one's own astronaut, rising off them, while they wiggle) */
    here.forEach((i, k) => {
      const on = this.stirring && this.stirring[i], p = P(this._lane(i), RUN_AT, W, H), h = H * CREW_SIZE * p.k;
      for (let j = 0; j < 14; j++){
        const u = (this.t * 0.8 + j / 14 + i * 0.13) % 1, a = on ? (1 - u) : 0;
        if (a <= 0) continue;
        const x = p.x + Math.sin(u * 9 + j) * h * 0.45, y = p.y - h * (0.2 + u * 1.1);
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
  _pullBack(c, W, H, p){
    const u0 = Math.max(0, Math.min(1, p)), u = u0 * u0 * (3 - 2 * u0);
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
  /* What each of them is doing: sat in the grass, looking round; up; and
     wiggling - bouncing, arms up - when their own player is. */
  _act(i, k){
    const s = this.stage, T = (this.cineT || 0) + k * 1.9;
    if (s === 'move' && this.stirring && this.stirring[i]) return { pose: 'hang', look: 0, bob: Math.abs(Math.sin(this.t * 13 + k)) * 0.12 };
    if (s === 'out' || s === 'rise') return { pose: null, look: this.up[i] > 0.99 ? 0 : Math.sin(T * 0.8) * 0.5 };
    return { pose: null, look: s === 'move' ? Math.sin(T * 1.1) * 0.4 : 0 };
  }
  _outside(c, W, H){
    const g = this.g;
    g.introCrew = g.here.map((i, k) => { const a = this._act(i, k); return { i, lane: this._lane(i), rel: RUN_AT, down: 0, ground: 1 - easeOut(this.up[i]), noBar: this.stage !== 'go', pose: a.pose, look: a.look, bob: a.bob || 0 }; });
    g.inIntro = true;
    g._drawPlay(c, W, H);
    g.inIntro = false; g.introCrew = null;
  }
}

/* ---------- what each beat does ---------- */

const BEGIN = {
  answer(){ this.radio.visible = true; this.radio.say(...script('wakeup', this.g), ...script('walk', this.g)); },
  rise(){ this.radio.say(...script('rise', this.g)); },
  move(){ this.radio.say(...script('canMove', this.g)); },
  go(){ this.radio.say(...script('ready', this.g)); }
};
/* Each step: true once it's done. */
const STEP = {
  dark(){ return false; },
  /* the eyes opening by themselves; the suit's display coming on */
  wake(){ if (!this.booted && this.st > WAKE * 0.8){ this.booted = true; sfx.visorOn?.(); } return false; },
  watch(){ return false; },
  notice(){ return false; },
  out(){ if (!this.pulled && this.st >= TURN){ this.pulled = true; sfx.pullBack?.(); } return false; },
  /* on your feet: up they get, one after another */
  rise(dt){ this._getUp(dt, 0.9); if (this.g.here.some((i, k) => this.up[i] > 0.05 && !this.stepped?.[i])){ this.stepped = this.stepped || {}; for (const i of this.g.here) if (this.up[i] > 0.05 && !this.stepped[i]){ this.stepped[i] = true; sfx.step(i, 0.4); } } return this._settled(dt, this.g.here.every(i => this.up[i] >= 1) && !this.radio.busy); },
  /* Nova: can you move? - everyone wiggling, each with their own astronaut */
  move(dt){
    if (this.radio.busy && this.st < 1.2) return false;
    const here = this.g.here;
    for (const i of here){
      const moving = this.moves[i].step(pose.players[i], dt, pose.mouse.active);
      this.stirring = this.stirring || [];
      this.stirring[i] = moving > STIR;
      if (moving > STIR){ this.woke[i] = Math.min(WIGGLE, this.woke[i] + dt); if (Math.random() < dt * 4) sfx.step(i, 0.25); }
      else if (this.woke[i] < WIGGLE) this.woke[i] = Math.max(0, this.woke[i] - dt * DROOP);
    }
    /* (each quarter of the way: a scuff, an effort) */
    const notch = Math.floor(this.wiggled * 4 + 1e-6);
    if (notch > (this.notch || 0)){ this.notch = notch; sfx.step(notch, 0.45); }
    if (notch < (this.notch || 0)) this.notch = notch;
    return this._settled(dt, (here.length > 0 && this.wiggled >= 1) || (!here.length && this.st > 3));
  },
  crash(){ return false; },
  title(){ return false; },
  call(dt){
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
  go(){ return this.st > 0.4 && !this.radio.busy; }
};
/* How open the eyes want to be, in each beat. */
const EYES = {
  /* closed - a flutter open - closed again */
  dark(){ const u = (this.st - 2.6) / 1.4; return u > 0 && u < 1 ? 0.35 * Math.sin(u * Math.PI) * (0.8 + 0.2 * Math.sin(this.t * 20)) : 0; },
  /* coming open by themselves: heavy, a slow blink on the way */
  wake(){ const u = this.st / WAKE, blink = u > 0.35 && u < 0.5 ? Math.sin((u - 0.35) / 0.15 * Math.PI) * 0.6 : 0; return Math.min(1, 0.15 + u * 1.1 - blink); },
  watch(){ return 1; },
  notice(){ return 1; },
  out(){ return 1; },
  rise(){ return 1; },
  move(){ return 1; },
  crash(){ return 0; },
  title(){ return 0; },
  call(){ return 1; },
  answer(){ return 1; },
  go(){ return 1; }
};
/* When a beat's waited as long as it will: as if everyone had done it. */
const FORCE = {
  rise(){ for (const i of this.g.here) this.up[i] = 1; },
  move(){ for (const i of this.g.here) this.woke[i] = WIGGLE; },
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

