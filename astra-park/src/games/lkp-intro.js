/* Last Known Position's opening: picked from the console, it doesn't throw
   you straight in - it tells you where you are, and lets your body do it.
   A camera of its own: a staged crash site - the crew lying about the
   downed ship - then a whip pan round onto the game's own view, and play
   just carries on.

     title    the game's name over the planet
     dark     black: ears ringing, a heartbeat - knocked out
     pov      through your own eyes, lying there: blinking awake, the world
              swimming into focus, looking round - the sky, the ship
     zoom     the camera pulls back into a low, letterboxed shot of the
              crash site - the ship down behind, toppled but in one piece,
              smoking; the crew lying about it, not in a line
     crash    WIGGLE TO WAKE UP: each astronaut sits up and stands when
              their own player moves
     ring     the radio ringing - CMDR NOVA. A hand to your ear answers
     talk     the same shot while she talks (her opening lines - a wave
              skips them)
     pan      the camera whips round onto the path - the game's view -
              and they're off; she carries on with the
              briefing on the radio as they run (lkp-game.js)

   The waking and the answering wait for the players - but never forever
   (CRASH_MAX, RING_MAX). The game holds still till it's done. */
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MoveWatch } from '../tracking/gestures.js';
import { P, drawCorridor, drawGloom } from './lkp-art.js';
import { glow } from './lkp-world.js';
import { worldShip, worldWreck } from './lkp-places.js';
import { Scene } from './lkp-captain.js';

/* How long each of the first three lasts. */
export const TITLE = 4, DARK = 2.5, POV = 4.5, ZOOM = 2.2, PAN = 2;
/* (The old name for the time to come round: the POV.) */
export const WAKE = POV + ZOOM;
/* Waking up: moving (body sizes a second) more than STIR counts; WIGGLE
   seconds of it and you're up, taking UP seconds to stand. */
export const STIR = 0.45, WIGGLE = 1.2, UP = 0.8;
/* The call: a hand held at the ear HOLD seconds answers it. */
export const HOLD = 0.4;
/* However it's going, on after this long. */
export const CRASH_MAX = 20, RING_MAX = 12;
/* After the last one's up, a moment before the radio rings; after it's
   answered, the static before she's through. */
const AFTER = 1.2, STATIC = 0.9;

export class Intro {
  constructor(game){
    this.g = game; this.kind = 'intro'; this.done = false;
    this.stage = 'title'; this.st = 0; this.t = 0;
    this.moves = pose.players.map(() => new MoveWatch());
    this.woke = pose.players.map(() => 0);       /* how much wiggle, 0..WIGGLE */
    this.up = pose.players.map(() => 0);         /* standing up, 0..1 */
    this.ear = 0; this.answered = -1; this.talk = null; this.beatT = 0; this.ringT = 0;
  }
  _go(stage){ this.stage = stage; this.st = 0; }

  step(dt){
    if (this.done) return;
    this.t += dt; this.st += dt;
    const g = this.g, here = g.here;
    switch (this.stage){
      case 'title':
        if (this.st >= TITLE){ this._go('dark'); sfx.ringing?.(); }
        break;
      case 'dark':
        this.beatT -= dt;
        if (this.beatT <= 0){ sfx.heartbeat(); this.beatT = 1.1; }
        if (this.st >= DARK) this._go('pov');
        break;
      case 'pov':
        if (this.st >= POV){ this._go('zoom'); for (const i of here){ g.crew[i].played = true; g.crew[i].x = g._home(i); } }
        break;
      case 'zoom':
        if (this.st >= ZOOM) this._go('crash');
        break;
      case 'crash': {
        /* Each astronaut gets up when their own player has wiggled enough. */
        for (const i of here){
          const moving = this.moves[i].step(pose.players[i], dt, pose.mouse.active);
          if (this.woke[i] < WIGGLE){
            if (moving > STIR){ this.woke[i] += dt; if (Math.random() < dt * 6) sfx.step(i, 0.3); }
            if (this.woke[i] >= WIGGLE){ sfx.select(); g._sparkle(P(g.crew[i].x, 0.03, 1, 1).x, 0.8, 10, 50); }
          }
        }
        if (this.st >= CRASH_MAX) for (const i of here) this.woke[i] = WIGGLE;
        for (const i of here) if (this.woke[i] >= WIGGLE) this.up[i] = Math.min(1, this.up[i] + dt / UP);
        const allUp = here.length > 0 && here.every(i => this.up[i] >= 1);
        if (allUp || (!here.length && this.st > 3)){ this.upT = (this.upT || 0) + dt; if (this.upT >= AFTER) this._go('ring'); }
        break;
      }
      case 'ring': {
        /* The radio trilling; whoever gets a hand to their ear first answers. */
        this.ringT -= dt;
        if (this.ringT <= 0){ sfx.trill?.(); this.ringT = 1.4; }
        const who = here.find(i => this._atEar(i));
        this.ear = who != null ? this.ear + dt : Math.max(0, this.ear - dt * 2);
        if (who != null && this.ear >= HOLD) this.answered = who;
        if (this.answered >= 0 || this.st >= RING_MAX){ this._go('connect'); sfx.pick(); sfx.spray(); }
        break;
      }
      case 'connect':
        if (Math.random() < dt * 20) sfx.spray();
        if (this.st >= STATIC){ this._go('talk'); this.talk = new Scene('opening', g); this.talk.title = null; this.talk.corner = 'top-left'; }
        break;
      case 'talk':
        this.talk.step(dt);
        if (this.talk.done) this._go('pan');
        break;
      case 'pan':
        if (this.st >= PAN) this.done = true;
        break;
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

  /* The cinematic shot: where each of them is - not in a line. The first
     close to the camera and a little to the right, the second further
     back and well over to the left, the third and fourth further back
     still - and the ship behind them all, front and centre. [lane, depth] */
  _at(i, W, H){
    const k = Math.max(0, this.g.here.indexOf(i));
    const [lane, rel] = SLOTS[k % SLOTS.length], p = P(lane, rel, W, H);
    return { x: p.x, y: p.y, h: H * 0.19 * p.k * CLOSE, rel };
  }

  /* Where the camera is: looking at (cx, cy), s times closer, tilted r. */
  _cam(W, H){
    /* low to the ground, the horizon low in the frame, drifting slowly */
    const cine = { cx: W * (0.5 + 0.015 * Math.sin(this.t * 0.25)), cy: H * 0.5, s: 1.12 + (this.stage === 'talk' ? 0.006 * Math.min(10, this.talk.t) : 0), r: 0.012 * Math.sin(this.t * 0.2) };
    const pov = (u) => {
      /* lying there: up at the sky, down to the ship, a look left, a look right */
      const down = smooth((u - 0.25) / 0.25), look = u < 0.55 ? 0 : u < 0.78 ? -Math.sin((u - 0.55) / 0.23 * Math.PI / 2) : -1 + 1.6 * smooth((u - 0.78) / 0.22);
      return { cx: W * (0.5 + 0.22 * look), cy: H * (0.16 + 0.24 * down), s: 2.3, r: Math.sin(this.t * 0.9) * 0.03 + 0.06 * (1 - Math.min(1, u * 1.5)) };
    };
    const mix = (a, b, k) => ({ cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, s: a.s + (b.s - a.s) * k, r: a.r + (b.r - a.r) * k });
    if (this.stage === 'pov') return pov(this.st / POV);
    if (this.stage === 'zoom') return mix(pov(1), cine, smooth(this.st / ZOOM));
    return cine;
  }

  /* The staged crash site: the land, the ship down behind them, a piece of
     it thrown clear, and the crew where they lie (or stand). */
  _scene(c, W, H, crew){
    const g = this.g;
    drawCorridor(c, W, H, 0, this.t);
    const list = [{ rel: SHIP[1], draw: () => worldShip(c, W, H, SHIP[1], SHIP[0], this.t, SHIP[2]) },
      { rel: 0.34, draw: () => worldWreck(c, W, H, 0.34, 2.7, this.t, 1.1, 1) }];
    if (crew) for (const i of g.here){
      const a = this._at(i, W, H);
      list.push({ rel: a.rel, draw: () => g._drawCrew(c, i, W, H, { x: a.x, y: a.y, h: a.h, bob: 0, down: 1 - easeOut(this.up[i]), noBar: true }) });
    }
    list.sort((a, b) => b.rel - a.rel).forEach(it => it.draw());
    drawGloom(c, W, H);
  }

  draw(c, W, H){
    const g = this.g, s = this.stage;
    if (s === 'title'){ this._title(c, W, H); return; }
    if (s === 'dark'){ c.fillStyle = '#000'; c.fillRect(0, 0, W, H); return; }
    g.inIntro = true;
    if (s === 'pan'){
      /* Swinging round onto the path: the crash site sweeping off to the
         left as the game's own view comes in from the right. */
      const k = smooth(this.st / PAN);
      c.save(); c.translate(-W * k, 0); this._cine(c, W, H); c.restore();
      c.save(); c.translate(W * (1 - k), 0); g._drawPlay(c, W, H); c.restore();
      g.inIntro = false;
      const bars = 1 - k;
      if (bars > 0){ c.fillStyle = '#000'; c.fillRect(0, 0, W, H * 0.11 * bars); c.fillRect(0, H * (1 - 0.11 * bars), W, H * 0.11 * bars); }
      return;
    }
    /* Blurred as they come round (cheaply: drawn small, then stretched). */
    const blur = s === 'pov' ? Math.max(0, 14 * (1 - this.st / (POV * 0.6))) : 0;
    const k = blur > 0.5 ? Math.min(10, 1 + blur * 0.6) : 1;
    const off = k > 1 ? buffer(Math.ceil(W / k), Math.ceil(H / k)) : null;
    const into = off ? off.getContext('2d') : c;
    into.save();
    if (off){ into.setTransform(1, 0, 0, 1, 0, 0); into.clearRect(0, 0, off.width, off.height); into.scale(off.width / W, off.height / H); }
    this._cine(into, W, H);
    into.restore();
    if (off){ c.imageSmoothingEnabled = true; c.drawImage(off, 0, 0, W, H); }
    g.inIntro = false;
    if (s === 'pov') this._lids(c, W, H);
    /* Letterboxed from the moment the camera pulls back. */
    const bars = s === 'zoom' ? smooth(this.st / ZOOM) : s === 'pov' ? 0 : 1;
    if (bars > 0){ c.fillStyle = '#000'; c.fillRect(0, 0, W, H * 0.11 * bars); c.fillRect(0, H * (1 - 0.11 * bars), W, H * 0.11 * bars); }
    if (s === 'crash') this._wiggleBanner(c, W, H);
    if (s === 'ring') this._ring(c, W, H);
    if (s === 'connect') this._static(c, W, H, 1 - this.st / STATIC);
    if (s === 'talk'){ this.talk.draw(c, W, H); if (this.talk.t < 0.4) this._static(c, W, H, 1 - this.talk.t / 0.4); }
  }

  /* The crash site through the camera - the crew in it once it's pulled
     back, dizzy stars and how far each has wiggled. */
  _cine(c, W, H){
    const cam = this._cam(W, H), s = this.stage;
    c.save();
    c.translate(W / 2, H / 2); c.rotate(cam.r); c.scale(cam.s, cam.s); c.translate(-cam.cx, -cam.cy);
    this._scene(c, W, H, s !== 'pov');
    if (s !== 'pov'){ this._dizzy(c, W, H); if (s === 'crash') this._wiggle(c, W, H); }
    c.restore();
  }

  /* The title: the planet, the name. */
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
    const sub = `LEVEL 1 \u00b7 ${this.g.level.name}`.toUpperCase();
    c.strokeText(sub, W / 2, y + H * 0.11); c.fillStyle = '#7ff3ff'; c.fillText(sub, W / 2, y + H * 0.11);
    c.restore();
    if (this.st > TITLE - 0.7){ c.fillStyle = `rgba(0,0,0,${(this.st - (TITLE - 0.7)) / 0.7})`; c.fillRect(0, 0, W, H); }
  }

  /* Dizzy: stars going round the helmet of anyone not up yet. */
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

  /* Eyelids: heavy blinks, opening wider each time. */
  _lids(c, W, H){
    const u = Math.min(1, this.st / (POV * 0.55)), blink = Math.abs(Math.sin(u * Math.PI * 2.5));
    const open = u >= 1 ? 1 : Math.min(1, u * 1.3) * (0.35 + 0.65 * blink);
    if (open >= 1) return;
    const lid = (1 - open) * H * 0.5;
    c.fillStyle = '#000';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, lid); c.quadraticCurveTo(W / 2, lid + H * 0.12 * open, 0, lid); c.fill();
    c.beginPath(); c.moveTo(0, H); c.lineTo(W, H); c.lineTo(W, H - lid); c.quadraticCurveTo(W / 2, H - lid - H * 0.12 * open, 0, H - lid); c.fill();
  }

  /* WIGGLE TO WAKE UP!, big - */
  _wiggleBanner(c, W, H){
    if (this.g.here.some(i => this.woke[i] < WIGGLE)) banner(c, W, H, 'WIGGLE TO WAKE UP!', '#ffd24a', 1 + 0.04 * Math.sin(this.t * 8));
  }
  /* - and over each one still down, how far they've got. */
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

  /* The radio ringing: a flashing call up where her window will be, and
     how to answer. */
  _ring(c, W, H){
    const on = Math.floor(this.t * 3) % 2 === 0, s = H * 0.17, x = H * 0.03, y = H * 0.03;
    c.save();
    glow(c, x + s / 2, y + s / 2, s * (on ? 1.3 : 1), '#5ff3ff', on ? 0.8 : 0.4);
    c.fillStyle = 'rgba(8,20,40,.9)'; c.beginPath(); c.roundRect(x, y, s, s, s * 0.15); c.fill();
    c.strokeStyle = on ? '#7ff3ff' : 'rgba(127,243,255,.5)'; c.lineWidth = H * 0.005; c.stroke();
    /* a little radio handset, shaking */
    c.translate(x + s / 2 + (on ? Math.sin(this.t * 60) * s * 0.03 : 0), y + s * 0.45);
    c.fillStyle = '#e9ecf8'; c.beginPath(); c.roundRect(-s * 0.12, -s * 0.25, s * 0.24, s * 0.5, s * 0.06); c.fill();
    c.fillStyle = '#7ff3ff'; c.fillRect(-s * 0.08, -s * 0.18, s * 0.16, s * 0.12);
    c.strokeStyle = '#e9ecf8'; c.lineWidth = s * 0.03; c.beginPath(); c.moveTo(s * 0.08, -s * 0.25); c.lineTo(s * 0.12, -s * 0.38); c.stroke();
    for (const k of [1, 2]){ c.strokeStyle = `rgba(127,243,255,${on ? 0.9 / k : 0.3 / k})`; c.beginPath(); c.arc(0, 0, s * (0.22 + 0.1 * k), -0.6, 0.6); c.stroke(); c.beginPath(); c.arc(0, 0, s * (0.22 + 0.1 * k), Math.PI - 0.6, Math.PI + 0.6); c.stroke(); }
    c.restore();
    c.save(); c.font = `700 ${Math.round(H * 0.04)}px Fredoka, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.lineWidth = H * 0.008; c.strokeStyle = '#05060f'; c.strokeText('INCOMING · CMDR NOVA', x + s + H * 0.02, y + s * 0.3);
    c.fillStyle = on ? '#ffffff' : '#7ff3ff'; c.fillText('INCOMING · CMDR NOVA', x + s + H * 0.02, y + s * 0.3); c.restore();
    banner(c, W, H, 'HAND TO YOUR EAR TO ANSWER!', '#7ff3ff', 1 + 0.03 * Math.sin(this.t * 6), this.ear / HOLD);
  }

  /* Radio static, k 0..1. */
  _static(c, W, H, k){
    if (k <= 0) return;
    c.save(); c.globalAlpha = 0.5 * k;
    for (let n = 0; n < 140; n++){ c.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#7ff3ff'; c.fillRect(Math.random() * W, Math.random() * H, W * 0.04 * Math.random(), 2); }
    c.restore();
  }
}

/* A canvas to draw small into, kept (none where there isn't one). */
let BUF = null;
function buffer(w, h){
  if (BUF === false) return null;
  try {
    if (!BUF){
      BUF = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h)
        : typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : false;
      if (!BUF || !BUF.getContext || !BUF.getContext('2d')){ BUF = false; return null; }
    }
    if (BUF.width !== w || BUF.height !== h){ BUF.width = w; BUF.height = h; }
    return BUF;
  } catch (e){ BUF = false; return null; }
}

/* The cinematic shot: the ship [lane, depth, size], and where the crew
   are, near to far. */
const SHIP = [0.1, 0.72, 0.95];
const SLOTS = [[0.5, 0.04], [-1.5, 0.12], [-0.45, 0.2], [1.1, 0.25]];
/* Low and close: the crew loom larger than in play. */
const CLOSE = 1.3;
const smooth = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const easeOut = (k) => 1 - (1 - k) * (1 - k);

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

