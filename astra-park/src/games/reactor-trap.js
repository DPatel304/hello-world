/* Reactor Run's trap rooms. The first: red light, green light.

   A long hall seen from high up, the view holding still: the crew start
   along the near end, and across the far end is the finish line, with the
   Watcher - a big security robot - beyond it. While its back is turned
   and its lamp is green, walk or run on the spot to go up the hall -
   walking gets you there, running gets you there quicker (lean to go left
   and right, as ever). When the lamp goes yellow it's turning round;
   red, it's looking - and anyone it sees really moving (after a moment's
   GRACE to stop - and a wobble, a sway or a fidget is fine) gets zapped:
   ZAP health, knocked back a bit, a second's safety. A trap room never
   puts anyone to sleep - 1 health at worst.

   The first over the finish line wins it for everyone: the door opens.
   However it's going, after len seconds the Watcher gives up and lets
   them through anyway.

   Its own view: the hall is drawn by Q(lane, along) here, not the
   corridor's P. */
import { pose } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MarchWatch, MoveWatch } from '../tracking/gestures.js';

/* How long each light lasts (seconds: shortest, longest), and a moment's
   red to start, before the first green. */
export const GREEN = [2, 4], YELLOW = 0.8, RED = [1.5, 3], READY = 1.5;
/* Stopping: this long after red to keep still; moving less than STILL
   (body sizes a second) counts as still. */
export const GRACE = 0.6, STILL = 0.8;
/* Up the hall (0 to 1) a second, running all-out (walking is about half). */
export const STRIDE = 0.16;
export const ZAP = 10, KNOCK = 0.08, ZAP_SAFE = 1.2;
export const CLEAR_COINS = 15;
export const TRAP_MAX = 90;

/* The hall, from up high: the near end low on the screen and wide, the
   far end higher up and narrower. lane -1..1 across, along 0 (start) to
   1 (finish). */
const NEAR_Y = 0.88, FAR_Y = 0.38, NEAR_HALF = 0.4, FAR_HALF = 0.27;
export function Q(lane, along, W, H){
  const u = Math.max(-0.1, Math.min(1.15, along));
  const k = 1 - (1 - FAR_HALF / NEAR_HALF) * u;
  return { x: W * (0.5 + lane * NEAR_HALF * k), y: H * (NEAR_Y + (FAR_Y - NEAR_Y) * u), k };
}

const rand = ([a, b]) => a + Math.random() * (b - a);

export class Lights {
  constructor(game, len = TRAP_MAX){
    this.g = game; this.len = len;
    this.t = 0; this.light = 'red'; this.left = READY; this.redT = Infinity;   /* the first red's only to get ready: nobody's zapped */
    this.done = false; this.clearT = 0; this.fade = 0;
    this.marches = pose.players.map(() => new MarchWatch());
    this.moves = pose.players.map(() => new MoveWatch());
    for (const rn of game.crew){ rn.along = 0; rn.over = false; rn.zapped = 0; rn.marching = 0; }
  }

  step(dt, W, H){
    const g = this.g;
    this.t += dt; this.fade = Math.min(1, this.fade + dt * 2.5);
    for (const rn of g.crew) rn.zapped = Math.max(0, rn.zapped - dt * 2);
    if (this.done){ this.clearT += dt; return; }

    /* The lights going round: green, yellow, red, green ... */
    this.left -= dt;
    if (this.left <= 0){
      if (this.light === 'green'){ this.light = 'yellow'; this.left = YELLOW; sfx.siren(false); }
      else if (this.light === 'yellow'){ this.light = 'red'; this.left = rand(RED); this.redT = this.t; sfx.siren(true); }
      else { this.light = 'green'; this.left = rand(GREEN); sfx.pick(); }
    }
    const looking = this.light === 'red' && this.t - this.redT >= GRACE;

    for (const i of g.here){
      const rn = g.crew[i], p = pose.players[i], mouse = pose.mouse.active;
      const march = this.marches[i].step(p, dt, mouse), moving = this.moves[i].step(p, dt, mouse);
      rn.marching = march;
      if (rn.over) continue;
      if (this.light !== 'red') rn.along = Math.min(1, rn.along + STRIDE * march * dt);
      else if (looking && rn.safe <= 0 && moving > STILL) this._zap(i, W, H);
      if (rn.along >= 1 && !rn.over){ rn.over = true; sfx.twinkle(); }
    }

    if (g.here.some(i => g.crew[i].over)) this._clear(W, H);
    else if (this.t > this.len) this._clear(W, H);
  }

  _zap(i, W, H){
    const g = this.g, rn = g.crew[i];
    rn.hp = Math.max(1, rn.hp - ZAP); rn.hit = 1; rn.zapped = 1; rn.safe = ZAP_SAFE;
    rn.along = Math.max(0, rn.along - KNOCK);
    const p = Q(rn.x, rn.along, W, H);
    g._sparkle(p.x / W, (p.y - H * 0.08) / H, 14, 55);
    g.bits.push({ kind: 'num', x: p.x / W, y: (p.y - H * 0.2) / H, vy: -0.08, age: 0, life: 0.9, text: `-${ZAP}` });
    sfx.zap(); sfx.thud();
  }

  _clear(W, H){
    const g = this.g;
    this.done = true;
    g.coins += CLEAR_COINS;
    sfx.gold();
    for (let k = 0; k < 6; k++) g._sparkle(0.2 + k * 0.12, 0.25, 8, 120);
  }

  /* The hall, the Watcher, and the crew - drawn by the game's own crew
     drawing, at their places in the hall. */
  draw(c, W, H, drawCrew){
    const g = this.g, red = this.light === 'red', lamp = { green: '#3fcf7f', yellow: '#ffc531', red: '#ff3b3b' }[this.light];
    c.fillStyle = '#141826'; c.fillRect(0, 0, W, H);
    /* The floor, with lines across it every so far up, the start, and the
       finish. */
    const corner = (lane, along) => { const q = Q(lane, along, W, H); return [q.x, q.y]; };
    c.fillStyle = red ? '#2e1d26' : '#232a3c';
    c.beginPath(); c.moveTo(...corner(-1.1, -0.1)); c.lineTo(...corner(1.1, -0.1)); c.lineTo(...corner(1.1, 1.15)); c.lineTo(...corner(-1.1, 1.15)); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2;
    for (let k = 1; k < 10; k++){ c.beginPath(); c.moveTo(...corner(-1.1, k / 10)); c.lineTo(...corner(1.1, k / 10)); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = H * 0.006;
    c.beginPath(); c.moveTo(...corner(-1.1, 0)); c.lineTo(...corner(1.1, 0)); c.stroke();
    /* The finish: a checked strip. */
    for (let k = 0; k < 22; k++){
      c.fillStyle = k % 2 ? '#ffffff' : '#0b0d1c';
      const a = corner(-1.1 + k * 0.1, 1), b = corner(-1.1 + (k + 1) * 0.1, 1.03);
      c.fillRect(a[0], b[1], b[0] - a[0], a[1] - b[1]);
    }
    /* The Watcher, beyond the finish: back turned on green, turning on
       yellow, looking on red. */
    this._watcher(c, W / 2, H * 0.22, H * 0.085, lamp);
    /* Its gaze, on red: a red wash down the hall. */
    if (red){
      c.save(); c.globalAlpha = 0.12 + 0.05 * Math.sin(this.t * 10);
      c.fillStyle = '#ff3b3b';
      c.beginPath(); c.moveTo(W / 2, H * 0.24); c.lineTo(...corner(1.1, -0.1)); c.lineTo(...corner(-1.1, -0.1)); c.closePath(); c.fill();
      c.restore();
    }
    /* The crew, far ones first. */
    const order = g.here.slice().sort((a, b) => g.crew[b].along - g.crew[a].along);
    for (const i of order){
      const rn = g.crew[i], q = Q(rn.x, rn.along, W, H);
      /* Walking, a steady bob; running, a quicker, bigger one. */
      const going = this.light !== 'red' && !this.done ? rn.marching : 0;
      drawCrew(i, q.x, q.y, H * 0.2 * q.k, going > 0.1 ? Math.abs(Math.sin(this.t * (6 + 8 * going) + i)) * H * (0.006 + 0.016 * going) : 0);
    }
    /* In from the door: a quick fade up from black. */
    if (this.fade < 1){ c.fillStyle = `rgba(0,0,0,${1 - this.fade})`; c.fillRect(0, 0, W, H); }
  }

  _watcher(c, x, y, s, lamp){
    const turn = this.light === 'green' ? 0 : this.light === 'yellow' ? 0.5 + 0.5 * Math.sin(this.t * 8) * 0.3 : 1;
    c.save(); c.translate(x, y);
    /* A great round head on a neck, its lamp on top. */
    c.fillStyle = '#4b5563'; c.fillRect(-s * 0.2, s * 0.6, s * 0.4, s * 0.5);
    c.fillStyle = '#9aa3b5'; c.strokeStyle = '#0b0d1c'; c.lineWidth = 4;
    c.beginPath(); c.arc(0, 0, s, 0, 6.2832); c.fill(); c.stroke();
    /* Facing them: one big eye; back turned, a panel of bolts. */
    if (turn > 0.5){
      c.fillStyle = '#0b0d1c'; c.beginPath(); c.ellipse(0, s * 0.05, s * 0.5 * (turn * 2 - 1), s * 0.4, 0, 0, 6.2832); c.fill();
      c.fillStyle = lamp; c.beginPath(); c.ellipse(0, s * 0.05, s * 0.26 * (turn * 2 - 1), s * 0.26, 0, 0, 6.2832); c.fill();
    } else {
      c.fillStyle = '#7a8396'; c.fillRect(-s * 0.45, -s * 0.35, s * 0.9, s * 0.75);
      c.fillStyle = '#5b6375';
      for (const [bx, by] of [[-0.35, -0.25], [0.35, -0.25], [-0.35, 0.3], [0.35, 0.3]]){ c.beginPath(); c.arc(bx * s, by * s, s * 0.05, 0, 6.2832); c.fill(); }
    }
    /* The lamp: big, so it reads from across the room. */
    c.fillStyle = lamp; c.strokeStyle = '#0b0d1c';
    c.beginPath(); c.arc(0, -s * 1.25, s * 0.35, 0, 6.2832); c.fill(); c.stroke();
    c.restore();
  }
}
