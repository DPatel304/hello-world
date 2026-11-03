/* Last Known Position - the zip line: a corridor's event. One cable, away
   across a valley, that the whole crew share. Nothing stops: running up to
   its platform, Nova counts them in - COUNT seconds of HANDS UP! - and
   everyone with their hands up by GRAB catches the cable, one behind the
   other in the order they put their hands up (the quickest at the front).
   Anyone late has LATE seconds to throw their hands up and jump for it:
   they catch the feet of whoever's last, and dangle - more of them, a
   chain, feet holding feet. Anyone who never does falls - and floats back
   up in a rescue bubble (lkp-game.js: no crystals for them till their
   teammates clap it popped, or it pops at the next fork)... and if nobody
   at all catches the cable, they all run off the edge, and that's the
   end of the run.

   Riding, RIDE seconds out over the valley, the forest far below: leaning
   swings your own body under the cable (the ones dangling swing wider,
   whipping round under the one above), for the crystals hanging along
   the way - the low ones only for the danglers. Then down onto the far
   side (LAND) and running again. */
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { P, RUN } from './lkp-art.js';
import { glow } from './lkp-world.js';

/* Seconds: the count in, how long after it you can still jump for it, how
   long hands have to be up to count, the ride, the landing, and running
   off the edge. */
export const COUNT = 3, LATE = 1.5, HOLD = 0.25, RIDE = 8, LAND = 1.2, FALL = 1.6;
/* Missing it: falling this long, then floating back up in the bubble. */
const BUBBLE_UP = 1.1;
/* How fast along riding (depths a second); how far the ground drops away
   below (screens). (Running, it's the game's own SPEED, RUNNING.) */
export const ZIP_SPEED = 0.55, DROP = 0.3;
const RUNNING = 0.3;
/* The cable: its lane, and its height over the ground (screen heights at
   the crew's depth) - running gently down and away. Riders on it one
   behind the other, GAP apart. */
export const CABLE = 0.3, GAP = 0.07;
const cableH = (rel) => 0.8 - 0.2 * Math.max(0, Math.min(1, rel));
const cableAt = (rel, W, H) => { const p = P(CABLE, rel, W, H); return { x: p.x, y: p.y - cableH(rel) * H * p.k, k: p.k }; };
/* Where a crystal hanging along the line floats, on the screen: at a
   rider's middle - or lower, for the chain (low). */
export const hangY = (th, rel, W, H) => { const c = cableAt(rel, W, H); return c.y + H * 0.19 * c.k * (th.low ? 1.45 : 0.55); };
/* A body, hands to feet, against the crew's height. */
const BODY = 1.02;
/* How near (lanes) a swinging body has to come to take a crystal. */
const REACH = 0.07;
const CREW = 0.19, HALF = 0.36;

export class Zip {
  constructor(game, th){
    this.g = game; this.th = th; this.t = 0; this.done = false;
    this.phase = 'ready';
    this.held = pose.players.map(() => 0);
    this.ready = [];              /* hands up in time, in order */
    this.cable = [];              /* on the cable, front first */
    this.chain = [];              /* dangling under the last of them, top first */
    this.joined = pose.players.map(() => -1);    /* when each got on */
    this.swing = pose.players.map(() => ({ a: 0, v: 0 }));
    this.since = 0;               /* since GRAB */
    this.rideT = 0; this.landT = 0; this.fallT = 0;
    this.fell = new Map();        /* missed it: when they fell */
    this.lastZ = game.z; this.lastLeft = this.left;
  }

  /* ---------- where things are ---------- */

  /* Seconds till GRAB (the platform at the crew). */
  get left(){ return Math.max(0, (this.th.d - this.g.z - RUN) / RUNNING); }
  holding(i){ return this.cable.includes(i) || this.chain.includes(i); }
  get riding(){ return this.cable.length > 0 && !this.done; }
  speed(run){
    if (this.phase === 'ride') return ZIP_SPEED;
    if (this.phase === 'land') return ZIP_SPEED + (run - ZIP_SPEED) * Math.min(1, this.landT / LAND);
    if (this.phase === 'fall') return run * 0.4;
    return run;
  }
  /* How far the ground's dropped away below, 0..1. */
  get drop(){
    if (this.phase === 'ride') return smooth(this.rideT / 1.2);
    if (this.phase === 'land') return 1 - smooth(this.landT / LAND);
    if (this.phase === 'fall') return smooth(this.fallT / 0.8);
    return 0;
  }
  /* Each rider's depth: the last on at the crew's own, the front ones on
     ahead. */
  depth(i){
    const j = this.cable.indexOf(i);
    return j < 0 ? RUN : RUN + (this.cable.length - 1 - j) * GAP;
  }
  /* The cable at depth rel, on the screen. */
  cableAt(rel, W, H){ return cableAt(rel, W, H); }
  /* A body's length, in lanes (the same at any depth). */
  bodyLanes(W, H){ return BODY * CREW * H / (W * HALF); }
  /* Where each one holding on hangs: hands (x, y), and their angle - the
     riders from the cable, the chain from the feet above. */
  hangs(W, H){
    const out = new Map(), bl = this.bodyLanes(W, H);
    for (const i of this.cable){
      const rel = this.depth(i), c = this.cableAt(rel, W, H);
      out.set(i, { x: c.x, y: c.y, a: this.swing[i].a, h: H * CREW * c.k, rel, lane: CABLE });
    }
    let up = this.cable[this.cable.length - 1];
    for (const i of this.chain){
      const top = out.get(up); if (!top) break;
      const fx = top.x + Math.sin(top.a) * top.h * BODY, fy = top.y + Math.cos(top.a) * top.h * BODY;
      out.set(i, { x: fx, y: fy, a: this.swing[i].a, h: top.h, rel: top.rel, lane: top.lane + Math.sin(top.a) * bl, low: true });
      up = i;
    }
    return out;
  }

  /* Both hands up over the head. (With the mouse, up near the top.) */
  _handsUp(i){
    const p = pose.players[i];
    if (!p || !p.present) return false;
    if (pose.mouse.active) return !!p.hands.right && p.hands.right.y < 0.25;
    const lm = p.lm; if (!lm) return false;
    const head = lm[L.NOSE].y;
    return [L.L_WRIST, L.R_WRIST].every(j => (lm[j].v ?? 1) > 0.4 && lm[j].y < head);
  }

  /* ---------- the loop ---------- */

  step(dt, W = 1920, H = 1080){
    const g = this.g;
    this.t += dt;
    /* Hands up: held a moment, it counts. */
    const raised = [];
    for (const i of g.here){
      this.held[i] = this._handsUp(i) ? this.held[i] + dt : 0;
      if (this.held[i] >= HOLD) raised.push(i);
    }
    if (this.phase === 'ready'){
      for (const i of raised) if (!this.ready.includes(i)){ this.ready.push(i); sfx.pick(); }
      /* (the count: a beep each second) */
      const left = this.left;
      if (Math.ceil(left) !== Math.ceil(this.lastLeft) && left > 0) sfx.beep(false);
      this.lastLeft = left;
      if (left <= 0){
        /* GRAB! */
        for (const i of this.ready) this._on(i, 'cable');
        this.phase = this.cable.length ? 'ride' : 'late';
        sfx.whoosh();
      }
      return this._collect(W, H);
    }
    this.since += dt;
    /* Late: a jump for it - onto the cable if nobody's there yet, else
       onto the feet of the last one. */
    if (this.since < LATE) for (const i of raised) if (!this.holding(i)) this._on(i, this.cable.length ? 'chain' : 'cable');
    if (this.phase === 'late'){
      if (this.cable.length) this.phase = 'ride';
      else if (this.since >= LATE){ this.phase = 'fall'; sfx.whoosh(); }
    }
    /* the rest: missed it - down they go, into a rescue bubble */
    if (this.phase === 'ride' && this.since >= LATE) for (const i of g.here) if (!this.holding(i) && !this.fell.has(i)){
      this.fell.set(i, this.t); g.crew[i].bubble = { t: 0, claps: 0 }; sfx.whoosh();
    }
    if (this.phase === 'ride'){
      this.rideT += dt; this._swing(dt);
      if (this.rideT >= RIDE) this.phase = 'land';
    } else if (this.phase === 'land'){
      this.landT += dt; this._swing(dt);
      if (this.landT >= LAND){ this.done = true; sfx.thud(); g.shake = Math.min(1, g.shake + 0.3); }
    } else if (this.phase === 'fall'){
      this.fallT += dt;
      if (this.fallT >= FALL && !g.over){ g.lost = true; g.over = true; }
    }
    this._collect(W, H);
  }

  _on(i, where){
    if (this.holding(i)) return;
    (where === 'cable' ? this.cable : this.chain).push(i);
    this.joined[i] = this.t;
    sfx.boing(where === 'cable' ? 1.1 : 0.8);
  }

  /* Swinging: each body a pendulum towards where its lean wants it; the
     chain looser, pulled round by the one above too. */
  _swing(dt){
    const g = this.g, last = this.cable[this.cable.length - 1];
    let up = last;
    for (const i of [...this.cable, ...this.chain]){
      const s = this.swing[i], lean = Math.max(-1, Math.min(1, g.crew[i].lean || 0)), dangling = this.chain.includes(i);
      const want = dangling ? lean * 0.45 + this.swing[up].a * 0.3 : lean * 0.35;
      const k = dangling ? 6 : 10, damp = dangling ? 1.8 : 3;
      s.v += (-(s.a - want) * k - s.v * damp) * dt; s.a = Math.max(-0.5, Math.min(0.5, s.a + s.v * dt));
      if (dangling) up = i;
    }
  }

  /* Crystals reaching someone's depth, close to where they've swung. */
  _collect(W, H){
    const g = this.g, z0 = this.lastZ; this.lastZ = g.z;
    if (!this.riding) return;
    const hangs = this.hangs(W, H), bl = this.bodyLanes(W, H);
    for (const th of g.things){
      if (!th.hang || th.got) continue;
      const now = th.d - g.z, was = th.d - z0;
      for (const [i, hg] of hangs){
        if (!(was >= hg.rel && now < hg.rel) || !!th.low !== !!hg.low) continue;
        if (Math.abs(th.lane - (hg.lane + Math.sin(hg.a) * bl * 0.85)) > REACH) continue;
        th.got = true;
        const x = hg.x + Math.sin(hg.a) * hg.h * 0.6, y = hg.y + Math.cos(hg.a) * hg.h * 0.6;
        g.gain(1, x / W, y / H); sfx.jar(1 + (g.crystals % 8));
        g._sparkle(x / W, y / H, 6, 185);
        break;
      }
    }
  }

  /* ---------- drawing ---------- */

  /* The cable: from high behind us, over everyone, away down the valley. */
  drawCable(c, W, H){
    if (!this.riding) return;
    const a = this.cableAt(-0.08, W, H), b = this.cableAt(1, W, H);
    c.save(); c.globalAlpha = this.phase === 'land' ? 1 - smooth(this.landT / (LAND * 0.6)) : 1;
    c.strokeStyle = 'rgba(30,25,50,.9)'; c.lineWidth = Math.max(2, H * 0.005);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.stroke();
    c.restore();
  }

  /* Everyone holding on: catching hold (up from where they ran), hanging
     and swinging, then landing (back down to where they'll run).
     drawOne(i, x, y, h, angle) draws one, hands at (x, y). */
  drawRiders(c, W, H, drawOne){
    if (!this.cable.length) return;
    const g = this.g, hangs = this.hangs(W, H);
    for (const i of [...this.cable, ...this.chain]){
      const hg = hangs.get(i); if (!hg) continue;
      const ground = P(g.crew[i].x, RUN, W, H), gh = H * CREW;
      const into = smooth((this.t - this.joined[i]) / 0.45), out = this.phase === 'land' ? smooth(this.landT / LAND) : 0, k = into * (1 - out);
      const gx = ground.x, gy = ground.y - gh * BODY;
      const x = gx + (hg.x - gx) * k, y = gy + (hg.y - gy) * k;
      drawOne(i, x, y, gh + (hg.h - gh) * k, hg.a * k);
      /* the trolley on the cable, for the riders */
      if (this.cable.includes(i) && k > 0.5){
        const w = hg.h * 0.13;
        c.fillStyle = '#3b3f5c'; c.beginPath(); c.roundRect(x - w, y - w * 0.9, w * 2, w * 0.8, w * 0.25); c.fill();
        c.strokeStyle = PLAYER_COLORS[i]; c.lineWidth = Math.max(2, w * 0.25); c.beginPath(); c.moveTo(x - w, y - w * 0.1); c.lineTo(x + w, y - w * 0.1); c.stroke();
      }
    }
  }

  /* How far down someone's fallen, running off the edge - everyone, or
     one who missed it (who then comes back up, in a bubble). */
  fallY(H, i = -1){
    if (this.phase === 'fall') return H * 1.4 * Math.pow(Math.min(1, this.fallT / FALL), 2);
    if (!this.fell.has(i)) return 0;
    const t = this.t - this.fell.get(i);
    return t < BUBBLE_UP ? H * 1.4 * Math.pow(t / BUBBLE_UP, 2) : H * 1.4 * (1 - smooth((t - BUBBLE_UP) / 1.2));
  }
  /* Their bubble showing yet? (Once they've dropped out of sight.) */
  bubbled(i){ return !this.fell.has(i) || this.t - this.fell.get(i) >= BUBBLE_UP; }

  /* The count in, and who's ready; then, for anyone late, jump! */
  marks(c, W, H){
    const g = this.g;
    if (this.phase === 'ready'){
      for (const i of g.here){
        const p = P(g.crew[i].x, RUN, W, H);
        tick(c, p.x, p.y - H * CREW * 1.45, H * 0.03, this.ready.includes(i), Math.min(1, this.held[i] / HOLD), PLAYER_COLORS[i], this.t + i);
      }
      banner(c, W, H, 'HANDS UP TO GRAB THE LINE!', '#ffd24a', 1 + 0.03 * Math.sin(this.t * 6));
      const n = Math.ceil(this.left);
      if (n >= 1 && n <= COUNT){
        const f = this.left - Math.floor(this.left);
        c.save(); c.translate(W / 2, H * 0.4); c.scale(1 + f * 0.4, 1 + f * 0.4); c.globalAlpha = 0.5 + 0.5 * f;
        c.font = `700 ${Math.round(H * 0.16)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = H * 0.02; c.strokeStyle = '#05060f'; c.strokeText(String(n), 0, 0); c.fillStyle = '#ffffff'; c.fillText(String(n), 0, 0);
        c.restore();
      }
      return;
    }
    if (this.since < 0.6 && this.cable.length) banner(c, W, H, 'GRAB!', '#7ff3ff', 1.3 - this.since * 0.4, H * 0.4);
    const late = g.here.filter(i => !this.holding(i));
    if (late.length && this.since < LATE && this.phase !== 'fall'){
      banner(c, W, H, this.cable.length ? 'JUMP! HANDS UP!' : 'QUICK! HANDS UP!', '#ff9c5b', 1 + 0.05 * Math.sin(this.t * 12));
      for (const i of late){
        const p = P(g.crew[i].x, RUN, W, H);
        tick(c, p.x, p.y - H * CREW * 1.45, H * 0.03, false, Math.min(1, this.held[i] / HOLD), PLAYER_COLORS[i], this.t * 2 + i);
      }
    }
  }
}

/* The platform at the top of the zip line, rel ahead: two tall posts
   either side of the path, a beam across, and the one cable running off
   it, away down across the valley. */
export function worldZipStart(c, W, H, rel, Lw){
  const l = P(-1.25, rel, W, H), r = P(1.25, rel, W, H), k = l.k, top = l.y - H * cableH(rel) * k, beam = H * 0.03 * k;
  for (const q of [l, r]){
    c.fillStyle = Lw.trunk[0]; c.fillRect(q.x - H * 0.014 * k, top, H * 0.028 * k, q.y - top);
    c.fillStyle = Lw.trunk[1]; c.fillRect(q.x - H * 0.014 * k, top, H * 0.009 * k, q.y - top);
  }
  c.fillStyle = Lw.wood; c.fillRect(l.x - H * 0.03 * k, top, r.x - l.x + H * 0.06 * k, beam);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(l.x - H * 0.03 * k, top + beam * 0.7, r.x - l.x + H * 0.06 * k, beam * 0.3);
  /* the cable, from the beam away across the valley */
  const a = P(CABLE, rel, W, H), b = P(CABLE, 1, W, H);
  c.strokeStyle = 'rgba(30,25,50,.85)'; c.lineWidth = Math.max(2, 5 * k);
  c.beginPath(); c.moveTo(a.x, top + beam); c.lineTo(b.x, b.y - cableH(1) * H * b.k); c.stroke();
}

function tick(c, x, y, r, done, fill, col, t){
  c.save();
  if (done){
    c.fillStyle = '#22c55e'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.22; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - r * 0.45, y); c.lineTo(x - r * 0.1, y + r * 0.35); c.lineTo(x + r * 0.5, y - r * 0.35); c.stroke();
  } else {
    const on = 0.5 + 0.5 * Math.sin(t * 7);
    glow(c, x, y, r * (1.8 + on * 0.5), '#ffd24a', 0.45 + 0.3 * on);
    c.fillStyle = 'rgba(8,12,30,.9)'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    c.strokeStyle = col; c.lineWidth = r * 0.16; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + 6.2832 * fill); c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath();
    c.moveTo(x, y - r * 0.6); c.lineTo(x + r * 0.5, y - r * 0.02); c.lineTo(x + r * 0.18, y - r * 0.02); c.lineTo(x + r * 0.18, y + r * 0.55);
    c.lineTo(x - r * 0.18, y + r * 0.55); c.lineTo(x - r * 0.18, y - r * 0.02); c.lineTo(x - r * 0.5, y - r * 0.02); c.closePath(); c.fill();
  }
  c.restore();
}

function banner(c, W, H, text, col, s = 1, y = H * 0.2){
  c.save(); c.translate(W / 2, y); c.scale(s, s);
  c.font = `700 ${Math.round(H * 0.075)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = H * 0.014; c.strokeStyle = '#05060f'; c.strokeText(text, 0, 0);
  c.fillStyle = col; c.fillText(text, 0, 0);
  c.restore();
}

const smooth = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
