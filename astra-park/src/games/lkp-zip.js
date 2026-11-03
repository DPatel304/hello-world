/* Last Known Position - the zip line: a corridor's event. The crew run up
   to a platform where cables run off across a valley; everyone puts their
   hands up to grab a handle (GRAB seconds of hands up - or, after
   GRAB_MAX, they're on anyway); then they're away, out over the valley,
   RIDE seconds, the forest dropping away below - leaning to swing from
   side to side for the crystals hanging along the way; then down onto the
   far side (LAND seconds) and running again.

   The game holds its corridor still while they grab on, then carries them
   at ZIP_SPEED (lkp-game.js), drawing them hanging (pose 'hang'). */
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { P, RUN, HORIZON } from './lkp-art.js';
import { glow } from './lkp-world.js';

export const GRAB = 0.4, GRAB_MAX = 10, RIDE = 8, LAND = 1.2;
/* How fast along (depths a second), riding; how far the ground drops away
   below (screens); how high they hang (screens, at their depth). */
export const ZIP_SPEED = 0.55, DROP = 0.3, LIFT = 0.2;
/* Once everyone's on, a moment before they push off. */
const PUSH = 0.7;

export class Zip {
  constructor(game, th){
    this.g = game; this.th = th; this.phase = 'grab'; this.t = 0; this.done = false;
    this.held = pose.players.map(() => 0);
    this.on = pose.players.map(() => false);
    this.ready = 0;
  }

  /* How fast the corridor goes by: still while they grab on, quick on
     the line, slowing as they land. */
  speed(run){
    if (this.phase === 'grab') return 0;
    if (this.phase === 'ride') return ZIP_SPEED;
    return ZIP_SPEED + (run - ZIP_SPEED) * Math.min(1, this.t / LAND);
  }
  /* How far the ground's dropped away, 0..1. */
  get drop(){
    if (this.phase === 'grab') return 0;
    if (this.phase === 'ride') return smooth(Math.min(1, this.t / 1.2));
    return 1 - smooth(Math.min(1, this.t / LAND));
  }
  get riding(){ return this.phase !== 'grab' && !this.done; }

  /* Both hands up over the head. (With the mouse, up near the top.) */
  _handsUp(i){
    const p = pose.players[i];
    if (!p || !p.present) return false;
    if (pose.mouse.active) return !!p.hands.right && p.hands.right.y < 0.25;
    const lm = p.lm; if (!lm) return false;
    const head = lm[L.NOSE].y;
    return [L.L_WRIST, L.R_WRIST].every(j => (lm[j].v ?? 1) > 0.4 && lm[j].y < head);
  }

  step(dt){
    const g = this.g;
    this.t += dt;
    if (this.phase === 'grab'){
      for (const i of g.here){
        if (this.on[i]) continue;
        this.held[i] = this._handsUp(i) ? this.held[i] + dt : Math.max(0, this.held[i] - dt * 2);
        if (this.held[i] >= GRAB){ this.on[i] = true; sfx.pick(); }
      }
      if (this.t >= GRAB_MAX) for (const i of g.here) this.on[i] = true;
      this.ready = g.here.every(i => this.on[i]) ? this.ready + dt : 0;
      if (this.ready >= PUSH){ this.phase = 'ride'; this.t = 0; sfx.whoosh(); }
      return;
    }
    if (this.phase === 'ride' && this.t >= RIDE){ this.phase = 'land'; this.t = 0; }
    else if (this.phase === 'land' && this.t >= LAND){
      this.done = true; sfx.thud(); g.shake = Math.min(1, g.shake + 0.3);
      for (const i of g.here) g._sparkle(P(g.crew[i].x, RUN, 1, 1).x, 0.9, 6, 40);
    }
  }

  /* Riding: where each one swings to - leaning all the way across, the
     whole line theirs - and how they swing (lean tilts them). */
  want(i, lean){ return Math.max(-1, Math.min(1, this.g._home(i) * 0.3 + lean * 0.9)); }

  /* How high off the ground they hang, at depth rel (screen px). */
  lift(H, k = 1){ return LIFT * H * k * (this.phase === 'land' ? 1 - smooth(Math.min(1, this.t / LAND)) : this.phase === 'grab' ? 0 : 1); }

  /* Where the line is, in the air, at depth scale k: the handles at the
     crew's own depth (k 1), running gently down and away from there. */
  lineY(W, H, k = 1){
    const hy = P(0, RUN, W, H).y - this.lift(H) - H * 0.19 * 1.04;
    return hy + (1 - k) * H * 0.05;
  }
  /* The cables, from far ahead down to each of them, over the handles. */
  cables(c, W, H){
    if (!this.riding) return;
    const g = this.g, vy = this.lineY(W, H, 0);
    for (const i of g.here){
      const p = P(g.crew[i].x, RUN, W, H), hy = this.lineY(W, H, 1), x = p.x;
      const fx = W / 2 + (x - W / 2) * 0.05;
      c.strokeStyle = 'rgba(30,25,50,.85)'; c.lineWidth = Math.max(2, H * 0.004);
      c.beginPath(); c.moveTo(fx, vy); c.lineTo(x + (x - fx) * 0.6, hy - (vy - hy) * 0.6); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.stroke();
      /* the trolley on the cable */
      c.fillStyle = '#3b3f5c'; c.beginPath(); c.roundRect(x - H * 0.02, hy - H * 0.018, H * 0.04, H * 0.022, H * 0.006); c.fill();
      c.strokeStyle = PLAYER_COLORS[i]; c.lineWidth = H * 0.004; c.beginPath(); c.moveTo(x - H * 0.022, hy + H * 0.008); c.lineTo(x + H * 0.022, hy + H * 0.008); c.stroke();
    }
  }

  /* Grabbing on: over each one still to grab, their hands-up filling;
     and the call to do it. */
  marks(c, W, H){
    if (this.phase !== 'grab') return;
    const g = this.g;
    for (const i of g.here){
      const p = P(g.crew[i].x, RUN, W, H), r = H * 0.03, x = p.x, y = p.y - H * 0.19 * 1.45;
      c.save();
      if (this.on[i]){
        c.fillStyle = '#22c55e'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
        c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.22; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(x - r * 0.45, y); c.lineTo(x - r * 0.1, y + r * 0.35); c.lineTo(x + r * 0.5, y - r * 0.35); c.stroke();
      } else {
        const on = 0.5 + 0.5 * Math.sin(this.t * 7 + i);
        glow(c, x, y, r * (1.8 + on * 0.5), '#ffd24a', 0.45 + 0.3 * on);
        c.fillStyle = 'rgba(8,12,30,.9)'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
        c.strokeStyle = PLAYER_COLORS[i]; c.lineWidth = r * 0.16; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, this.held[i] / GRAB)); c.stroke();
        /* up! */
        c.fillStyle = '#ffffff'; c.beginPath();
        c.moveTo(x, y - r * 0.6); c.lineTo(x + r * 0.5, y - r * 0.02); c.lineTo(x + r * 0.18, y - r * 0.02); c.lineTo(x + r * 0.18, y + r * 0.55);
        c.lineTo(x - r * 0.18, y + r * 0.55); c.lineTo(x - r * 0.18, y - r * 0.02); c.lineTo(x - r * 0.5, y - r * 0.02); c.closePath(); c.fill();
      }
      c.restore();
    }
    const s = 1 + 0.03 * Math.sin(this.t * 6);
    c.save(); c.translate(W / 2, H * 0.2); c.scale(s, s);
    c.font = `700 ${Math.round(H * 0.075)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = H * 0.014; c.strokeStyle = '#05060f'; c.strokeText('HANDS UP TO GRAB ON!', 0, 0);
    c.fillStyle = '#ffd24a'; c.fillText('HANDS UP TO GRAB ON!', 0, 0);
    c.restore();
  }
}

/* The platform at the top of the zip line, rel ahead: two tall posts
   either side of the path, a beam across, handles hanging off it on
   cables running away down across the valley. */
export function worldZipStart(c, W, H, rel, L, players = 4){
  const l = P(-1.25, rel, W, H), r = P(1.25, rel, W, H), k = l.k, top = l.y - H * 0.62 * k, beam = H * 0.03 * k;
  for (const q of [l, r]){
    c.fillStyle = L.trunk[0]; c.fillRect(q.x - H * 0.014 * k, top, H * 0.028 * k, q.y - top);
    c.fillStyle = L.trunk[1]; c.fillRect(q.x - H * 0.014 * k, top, H * 0.009 * k, q.y - top);
  }
  c.fillStyle = L.wood; c.fillRect(l.x - H * 0.03 * k, top, r.x - l.x + H * 0.06 * k, beam);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(l.x - H * 0.03 * k, top + beam * 0.7, r.x - l.x + H * 0.06 * k, beam * 0.3);
  /* the cables, away across the valley */
  const vx = W / 2, vy = (HORIZON + 0.06) * H;
  for (let j = 0; j < players; j++){
    const x = l.x + (r.x - l.x) * (j + 0.5) / players;
    c.strokeStyle = 'rgba(30,25,50,.8)'; c.lineWidth = Math.max(1.5, 4 * k);
    c.beginPath(); c.moveTo(x, top + beam); c.lineTo(vx + (x - vx) * 0.1, vy); c.stroke();
    /* a handle on a short line */
    c.strokeStyle = '#3b3f5c'; c.lineWidth = Math.max(1, 3 * k); c.beginPath(); c.moveTo(x, top + beam); c.lineTo(x, top + beam + H * 0.1 * k); c.stroke();
    c.strokeStyle = PLAYER_COLORS[j]; c.lineWidth = Math.max(2, 7 * k); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - H * 0.03 * k, top + beam + H * 0.1 * k); c.lineTo(x + H * 0.03 * k, top + beam + H * 0.1 * k); c.stroke(); c.lineCap = 'butt';
  }
}

const smooth = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
