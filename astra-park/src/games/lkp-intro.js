/* Last Known Position's opening: picked from the console, it doesn't throw
   you straight in - it shows you where you are, and lets your body do it.
   Its own camera, over the crash site (lkp-crashsite.js), then a whip pan
   round onto the game's own view, and play just carries on.

     title    high above the forest: the clearing, the furrow, the ship at
              the end of it, the crew tiny in the grass - and the name
     swoop    the camera drops down out of the sky to the ground, behind
              the crew, the ship ahead of them across the clearing
     crash    the crew lying in the grass - WIGGLE TO WAKE UP: each
              astronaut sits up and stands when their own player moves
     pond     they've been hurt (they start on half health): they walk
              over to the healing pond, and HUG YOURSELF TO HEAL fills them
              up - faster the tighter the hug
     ring     the radio ringing - CMDR NOVA. A hand to your ear answers
     talk     she talks (her opening lines - a wave skips them)
     pan      the camera whips round onto the path - the game's view -
              and they're off; she carries on with the briefing on the
              radio as they run (lkp-game.js)

   The waking, healing and answering wait for the players - but never
   forever (CRASH_MAX, POND_MAX, RING_MAX). The game holds still till it's
   done. */
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MoveWatch, HugWatch } from '../tracking/gestures.js';
import { P, drawGloom } from './lkp-art.js';
import { glow } from './lkp-world.js';
import { drawAbove, drawGround, ABOVE } from './lkp-crashsite.js';
import { Scene } from './lkp-captain.js';

/* The title from above, and the drop to the ground. */
export const TITLE = 5, SWOOP = 2.6, PAN = 2;
/* (How long till the crew are lying there to be woken.) */
export const WAKE = SWOOP;
/* Waking up: moving (body sizes a second) more than STIR counts; WIGGLE
   seconds of it and you're up, taking UP seconds to stand. */
export const STIR = 0.45, WIGGLE = 1.2, UP = 0.8;
/* The pond: WALK seconds over to it; then healing - HEAL a second standing
   in it, HUG_HEAL hugging yourself. They start on START of their health. */
export const WALK = 2.2, HEAL = 4, HUG_HEAL = 30, START = 0.5;
/* The call: a hand held at the ear HOLD seconds answers it. */
export const HOLD = 0.4;
/* However it's going, on after this long. */
export const CRASH_MAX = 20, POND_MAX = 15, RING_MAX = 12;
/* After the last one's up (or healed), a moment; after the call's
   answered, the static before she's through. */
const AFTER = 1.2, STATIC = 0.9;

export class Intro {
  constructor(game){
    this.g = game; this.kind = 'intro'; this.done = false;
    this.stage = 'title'; this.st = 0; this.t = 0;
    this.moves = pose.players.map(() => new MoveWatch());
    this.hugs = pose.players.map(() => new HugWatch());
    this.woke = pose.players.map(() => 0);       /* how much wiggle, 0..WIGGLE */
    this.up = pose.players.map(() => 0);         /* standing up, 0..1 */
    this.hugging = pose.players.map(() => false);
    this.ear = 0; this.answered = -1; this.talk = null; this.ringT = 0; this.hearts = [];
  }
  _go(stage){ this.stage = stage; this.st = 0; this.afterT = 0; }

  step(dt){
    if (this.done) return;
    this.t += dt; this.st += dt;
    const g = this.g, here = g.here;
    /* Knocked about in the crash: half health, till the pond. */
    if (!this.hurt){ this.hurt = true; for (const rn of g.crew) rn.hp = Math.round(rn.max * START); }
    for (const h of this.hearts){ h.age += dt; h.y -= dt * 0.08; }
    this.hearts = this.hearts.filter(h => h.age < 1);
    switch (this.stage){
      case 'title':
        if (this.st >= TITLE) this._go('swoop');
        break;
      case 'swoop':
        if (this.st >= SWOOP){ this._go('crash'); for (const i of here){ g.crew[i].played = true; g.crew[i].x = g._home(i); } }
        break;
      case 'crash': {
        /* Each astronaut gets up when their own player has wiggled enough. */
        for (const i of here){
          const moving = this.moves[i].step(pose.players[i], dt, pose.mouse.active);
          if (this.woke[i] < WIGGLE){
            if (moving > STIR){ this.woke[i] += dt; if (Math.random() < dt * 6) sfx.step(i, 0.3); }
            if (this.woke[i] >= WIGGLE) sfx.select();
          }
        }
        if (this.st >= CRASH_MAX) for (const i of here) this.woke[i] = WIGGLE;
        for (const i of here) if (this.woke[i] >= WIGGLE) this.up[i] = Math.min(1, this.up[i] + dt / UP);
        const allUp = here.length > 0 && here.every(i => this.up[i] >= 1);
        if (allUp || (!here.length && this.st > 3)){ this.afterT += dt; if (this.afterT >= AFTER) this._go('pond'); }
        break;
      }
      case 'pond': {
        /* Over to the pond; then the water heals them, hugging faster. */
        if (this.st < WALK) break;
        for (const i of here){
          const rn = g.crew[i], hug = this.hugs[i].step(pose.players[i], dt);
          this.hugging[i] = hug;
          if (rn.hp < rn.max){
            rn.hp = Math.min(rn.max, rn.hp + (hug ? HUG_HEAL : HEAL) * dt);
            if (Math.random() < dt * (hug ? 8 : 2)) this.hearts.push({ i, x: (Math.random() - 0.5) * 0.5, y: 0, age: 0 });
            if (rn.hp >= rn.max) sfx.twinkle();
          }
        }
        if (this.st >= WALK + POND_MAX) for (const i of here) g.crew[i].hp = g.crew[i].max;
        if (here.every(i => g.crew[i].hp >= g.crew[i].max)){ this.afterT += dt; if (this.afterT >= AFTER){ this._go('ring'); this.hugging = this.hugging.map(() => false); } }
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

  /* Where each of them is, on the ground: in a row across the front,
     their backs to us, the ship out ahead - or, once they've walked over,
     round the pond. [lane, depth] */
  _at(i, W, H){
    const k = Math.max(0, this.g.here.indexOf(i)) % 4;
    let [lane, rel] = CINE.row[k];
    let run = 0;
    if (['pond', 'ring', 'connect', 'talk', 'pan'].includes(this.stage)){
      const u = this.stage === 'pond' ? Math.min(1, this.st / WALK) : 1, [pl, pr] = CINE.pond[k];
      lane += (pl - lane) * smooth(u); rel += (pr - rel) * smooth(u);
      run = this.stage === 'pond' && u < 1 ? 1 : 0;
    }
    const p = P(lane, rel, W, H);
    return { x: p.x, y: p.y, h: H * 0.19 * p.k * CINE.close, rel, run };
  }

  /* The camera on the ground: still, but settling down from the swoop. */
  _cam(W, H){
    const C = CINE.cam, k = this.stage === 'swoop' ? 1 - smooth((this.st - SWOOP * 0.45) / (SWOOP * 0.55)) : this.stage === 'crash' ? Math.max(0, 0.25 - this.st * 0.15) : 0;
    return { cx: W * (C.x + 0.01 * Math.sin(this.t * 0.25)), cy: H * (C.y - 0.1 * k), s: C.s + 0.5 * k, r: C.r };
  }

  draw(c, W, H){
    const g = this.g, s = this.stage;
    if (s === 'title'){ this._title(c, W, H); return; }
    g.inIntro = true;
    if (s === 'swoop'){
      /* Dropping out of the sky: the view from above rushes in on the crew
         as the ground-level view takes over. */
      const k = smooth(this.st / SWOOP), [cx, cy] = ABOVE.crew;
      c.save(); c.translate(cx * W, cy * H); c.scale(1 + 5 * k * k, 1 + 5 * k * k); c.translate(-cx * W, -cy * H);
      drawAbove(c, W, H, this.t, g.level.palette.world);
      c.restore();
      const fade = smooth((this.st - SWOOP * 0.45) / (SWOOP * 0.45));
      if (fade > 0){ c.save(); c.globalAlpha = fade; this._ground(c, W, H); c.restore(); }
      g.inIntro = false;
      return;
    }
    if (s === 'pan'){
      /* Swinging round onto the path: the clearing sweeping off to the left
         as the game's own view comes in from the right. */
      const k = smooth(this.st / PAN);
      c.save(); c.translate(-W * k, 0); this._ground(c, W, H); c.restore();
      c.save(); c.translate(W * (1 - k), 0); g._drawPlay(c, W, H); c.restore();
      g.inIntro = false;
      this._bars(c, W, H, 1 - k);
      return;
    }
    this._ground(c, W, H);
    g.inIntro = false;
    this._bars(c, W, H, 1);
    if (s === 'crash' && this.g.here.some(i => this.woke[i] < WIGGLE)) banner(c, W, H, 'WIGGLE TO WAKE UP!', '#ffd24a', 1 + 0.04 * Math.sin(this.t * 8));
    if (s === 'pond'){
      if (this.st < WALK) banner(c, W, H, 'TO THE HEALING POND!', '#7ff3ff');
      else if (this.g.here.some(i => this.g.crew[i].hp < this.g.crew[i].max)) banner(c, W, H, 'HUG YOURSELF TO HEAL!', '#ff9ccb', 1 + 0.04 * Math.sin(this.t * 6));
    }
    if (s === 'ring') this._ring(c, W, H);
    if (s === 'connect') this._static(c, W, H, 1 - this.st / STATIC);
    if (s === 'talk'){ this.talk.draw(c, W, H); if (this.talk.t < 0.4) this._static(c, W, H, 1 - this.talk.t / 0.4); }
  }

  _bars(c, W, H, k){
    if (k <= 0) return;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H * 0.09 * k); c.fillRect(0, H * (1 - 0.09 * k), W, H * 0.09 * k);
  }

  /* The clearing at their level, through the camera: the crew in it. */
  _ground(c, W, H){
    const g = this.g, cam = this._cam(W, H), s = this.stage, L = g.level.palette.world;
    const showBars = s === 'pond' && this.st >= WALK;
    c.save();
    c.translate(W / 2, H / 2); c.rotate(cam.r); c.scale(cam.s, cam.s); c.translate(-cam.cx, -cam.cy);
    const crew = g.here.map(i => {
      const a = this._at(i, W, H), rn = g.crew[i];
      return { rel: a.rel, draw: () => {
        const keep = [rn.run, rn.runPh];
        rn.run = a.run; rn.runPh = (rn.runPh || 0) + (a.run ? 0.25 : 0);
        g._drawCrew(c, i, W, H, { x: a.x, y: a.y, h: a.h, bob: 0, down: 1 - easeOut(this.up[i]), noBar: !showBars, pose: this.hugging[i] ? 'hug' : null });
        if (!a.run) [rn.run, rn.runPh] = keep;
      } };
    });
    drawGround(c, W, H, this.t, L, crew);
    if (s === 'crash' || s === 'swoop'){ this._dizzy(c, W, H); if (s === 'crash') this._wiggle(c, W, H); }
    /* hearts rising off anyone healing */
    for (const h of this.hearts){
      const a = this._at(h.i, W, H), x = a.x + h.x * a.h, y = a.y - a.h * (1.1 + h.age * 0.6), r = a.h * 0.05;
      c.save(); c.globalAlpha = 1 - h.age; c.fillStyle = '#ff7eb6';
      c.beginPath(); c.moveTo(x, y + r); c.bezierCurveTo(x - r * 2, y - r * 0.5, x - r * 0.8, y - r * 1.8, x, y - r * 0.6);
      c.bezierCurveTo(x + r * 0.8, y - r * 1.8, x + r * 2, y - r * 0.5, x, y + r); c.fill(); c.restore();
    }
    c.restore();
    drawGloom(c, W, H);
  }

  /* The title: high over the forest, looking down on the crash - the name. */
  _title(c, W, H){
    const L = this.g.level.palette.world;
    /* drifting slowly in towards the clearing */
    const k = this.st / TITLE, [cx, cy] = ABOVE.crew;
    c.save(); c.translate(W / 2, H / 2); c.scale(1.05 + 0.08 * k, 1.05 + 0.08 * k); c.translate(-W / 2 + (cx * W - W / 2) * 0.1 * k, -H / 2 + (cy * H - H / 2) * 0.1 * k);
    drawAbove(c, W, H, this.t, L);
    c.restore();
    const a = Math.min(1, this.st / 0.8) * Math.min(1, (TITLE - this.st) / 0.6);
    c.save();
    const sh = c.createLinearGradient(0, 0, 0, H * 0.4); sh.addColorStop(0, 'rgba(5,10,20,.55)'); sh.addColorStop(1, 'rgba(5,10,20,0)');
    c.fillStyle = sh; c.fillRect(0, 0, W, H * 0.4);
    c.globalAlpha = Math.max(0, a); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${Math.round(H * 0.11)}px Fredoka, sans-serif`;
    c.lineWidth = H * 0.016; c.strokeStyle = '#05060f';
    const y = H * 0.14 - (1 - Math.min(1, this.st / 0.8)) * H * 0.03;
    c.strokeText('LAST KNOWN POSITION', W / 2, y); c.fillStyle = '#ffffff'; c.fillText('LAST KNOWN POSITION', W / 2, y);
    c.font = `600 ${Math.round(H * 0.042)}px Fredoka, sans-serif`; c.lineWidth = H * 0.01;
    const sub = `LEVEL 1 \u00b7 ${this.g.level.name}`.toUpperCase();
    c.strokeText(sub, W / 2, y + H * 0.1); c.fillStyle = '#7ff3ff'; c.fillText(sub, W / 2, y + H * 0.1);
    c.restore();
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

/* The shot on the ground: the crew in a row across the front, backs to
   us, the ship out ahead (lkp-crashsite.js GROUND); where they stand at
   the pond; a little larger than in play; the camera. */
export const CINE = {
  row: [[-0.95, 0.09], [-0.32, 0.11], [0.3, 0.11], [0.92, 0.09]],
  pond: [[-2.0, 0.27], [-1.3, 0.28], [-1.85, 0.19], [-1.2, 0.19]],
  close: 1.15,
  cam: { x: 0.5, y: 0.5, s: 1.0, r: 0 }
};

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

