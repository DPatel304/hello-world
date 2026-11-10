/* Last Known Position's trap rooms. The first: sneak past the sleeping
   robot - red light, green light, in the story.

   A long hall seen from high up, the view holding still: the crew start
   along the near end, and across the far end is the finish line, with a
   great cleaning robot slumped beyond it. Before the robots have woken
   (the depot) it's asleep - snoring, Z z z; after, it's a sentry,
   recharging. While it is (the light on it green), any movement at all
   - marching, dancing, waving your arms - walks your astronaut straight
   up the hall, and more of it goes quicker; stop, and they stop. Each
   keeps to their own lane: leaning tilts them a little but doesn't move
   them across, and leaning or swaying never counts as moving. When it stirs (yellow), its eye flickering, it's
   about to look; when its eye opens (red) it's looking - and it's
   forgiving: a GRACE to stop, and after that only someone who keeps
   really moving for CAUGHT seconds gets zapped (a wobble, a sway or a
   fidget is fine): ZAP health, knocked back a bit, a second's safety. A trap room
   never puts anyone to sleep - 1 health at worst.

   A pile of crystals waits past the finish line. The first over the line
   wins it - and the crystals - for everyone, and the door opens.
   However it's going, after len seconds the door opens anyway - but
   nobody won the crystals.

   Its own view: the hall is drawn by Q(lane, along) here, not the
   corridor's P.

   In level 1 it's outdoors (giant): a forest glade with the friendly giant
   (lkp-ride.js) fast asleep at the far end - snoring on green, an eye
   peeking on yellow, both eyes open on red. Anyone it catches moving it
   just snorts back down the glade a little: it never hurts. */
import { pose } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MoveWatch } from '../tracking/gestures.js';
import { drawCrystal, PAL } from './lkp-art.js';
import { worldHall, worldSleeper, worldGlade } from './lkp-places.js';
import { drawZubuAsleep } from './lkp-zubu.js';
import { armored } from './lkp-weapons.js';

/* How long each light lasts (seconds: shortest, longest), and a moment's
   red to start, before the first green. */
export const GREEN = [2, 4], YELLOW = 0.8, RED = [1.5, 3], READY = 1.5;
/* Going: moving (body sizes a second) less than GO_MIN is standing still;
   GO_FULL or more is full speed. */
export const GO_MIN = 0.3, GO_FULL = 1.2;
/* Stopping: this long after red to keep still; moving less than STILL
   counts as still; and it takes CAUGHT seconds of moving more than that,
   while it's looking, to be zapped. */
export const GRACE = 0.9, STILL = 1.0, CAUGHT = 0.4;
/* Up the hall (0 to 1) a second, running all-out (walking is about half). */
export const STRIDE = 0.09;
export const ZAP = 10, KNOCK = 0.08, ZAP_SAFE = 1.2;
/* The giant's snort: how far back down the glade it blows you. */
export const SNORT = 0.12;
/* The pile of crystals at the end, everyone's when the first is over. */
export const CLEAR_CRYSTALS = 35;
export const TRAP_MAX = 90;

/* The hall, from up high: the near end low on the screen and wide, the
   far end higher up and narrower. lane -1..1 across, along 0 (start) to
   1 (finish). */
const NEAR_Y = 0.9, FAR_Y = 0.34, NEAR_HALF = 0.4, FAR_HALF = 0.22;
export function Q(lane, along, W, H){
  const u = Math.max(-0.1, Math.min(1.15, along));
  const k = 1 - (1 - FAR_HALF / NEAR_HALF) * u;
  return { x: W * (0.5 + lane * NEAR_HALF * k), y: H * (NEAR_Y + (FAR_Y - NEAR_Y) * u), k };
}

const rand = ([a, b]) => a + Math.random() * (b - a);

export class Lights {
  constructor(game, len = TRAP_MAX, { giant = false } = {}){
    this.g = game; this.len = len; this.giant = giant;
    this.t = 0; this.light = 'red'; this.left = READY; this.redT = Infinity;   /* the first red's only to get ready: nobody's zapped */
    this.done = false; this.clearT = 0; this.fade = 0;
    this.moves = pose.players.map(() => new MoveWatch(true));
    for (const rn of game.crew){ rn.along = 0; rn.over = false; rn.zapped = 0; rn.marching = 0; rn.caught = 0; }
    /* The pile: two heaps past the finish line, either side of the robot. */
    this.pile = Array.from({ length: CLEAR_CRYSTALS }, (_, k) => ({ lane: (k % 2 ? 1 : -1) * (0.55 + Math.random() * 0.3), up: Math.random() * 0.05, z: k / 2 }));
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
      const moving = this.moves[i].step(p, dt, mouse);
      const go = Math.max(0, Math.min(1, (moving - GO_MIN) / (GO_FULL - GO_MIN)));
      rn.marching = go;
      if (rn.over) continue;
      if (this.light !== 'red'){ rn.along = Math.min(1, rn.along + STRIDE * go * dt); rn.caught = 0; }
      else if (looking && rn.safe <= 0){
        rn.caught = moving > STILL ? rn.caught + dt : Math.max(0, rn.caught - dt * 2);
        if (rn.caught >= CAUGHT){ rn.caught = 0; this._zap(i, W, H); }
      }
      if (rn.along >= 1 && !rn.over){ rn.over = true; sfx.twinkle(); }
    }

    if (g.here.some(i => g.crew[i].over)) this._clear(W, H, true);
    else if (this.t > this.len) this._clear(W, H, false);
  }

  _zap(i, W, H){
    const g = this.g, rn = g.crew[i];
    if (this.giant){
      /* a great sleepy snort: back down the glade a bit, nothing worse */
      rn.zapped = 1; rn.safe = ZAP_SAFE; rn.along = Math.max(0, rn.along - SNORT);
      const p = Q(rn.x, rn.along, W, H);
      g._sparkle(p.x / W, (p.y - H * 0.08) / H, 10, 140);
      g.bits.push({ kind: 'num', x: p.x / W, y: (p.y - H * 0.2) / H, vy: -0.08, age: 0, life: 0.9, text: 'HUFF!', col: '#ffffff' });
      sfx.whoosh(); sfx.thud();
      return;
    }
    rn.hp = Math.max(1, rn.hp - armored(rn, ZAP)); rn.hit = 1; rn.zapped = 1; rn.safe = ZAP_SAFE;
    g.ouch?.(0.8);
    rn.along = Math.max(0, rn.along - KNOCK);
    const p = Q(rn.x, rn.along, W, H);
    g._sparkle(p.x / W, (p.y - H * 0.08) / H, 14, 55);
    g.bits.push({ kind: 'num', x: p.x / W, y: (p.y - H * 0.2) / H, vy: -0.08, age: 0, life: 0.9, text: `-${ZAP}` });
    sfx.zap(); sfx.thud();
  }

  _clear(W, H, won){
    const g = this.g;
    this.done = true;
    if (!won){ sfx.whoosh(); return; }
    g.gain(CLEAR_CRYSTALS, 0.5, 0.3);
    sfx.gold();
    /* The pile bursts. */
    for (const cn of this.pile){ const q = Q(cn.lane, 1.06 + cn.up, W, H); g._sparkle(q.x / W, q.y / H, 2, 50); }
    this.pile = [];
  }

  /* The hall, the robot, and the crew - drawn by the game's own crew
     drawing, at their places in the hall. */
  draw(c, W, H, drawCrew){
    const g = this.g, red = this.light === 'red', lamp = { green: '#3fcf7f', yellow: '#ffc531', red: '#ff3b3b' }[this.light];
    /* The floor, with lines across it every so far up, the start, and the
       finish. */
    const corner = (lane, along) => { const q = Q(lane, along, W, H); return [q.x, q.y]; };
    if (PAL.world && this.giant) worldGlade(c, W, H, Q, red, this.t, PAL.world);
    else if (PAL.world) worldHall(c, W, H, Q, red, this.t);
    else {
      c.fillStyle = PAL.hall; c.fillRect(0, 0, W, H);
      c.fillStyle = red ? PAL.hallRed : PAL.hallFloor;
      c.beginPath(); c.moveTo(...corner(-1.1, -0.1)); c.lineTo(...corner(1.1, -0.1)); c.lineTo(...corner(1.1, 1.15)); c.lineTo(...corner(-1.1, 1.15)); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2;
      for (let k = 1; k < 16; k++){ c.beginPath(); c.moveTo(...corner(-1.1, k / 16)); c.lineTo(...corner(1.1, k / 16)); c.stroke(); }
    }
    if (!this.giant){
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = H * 0.006;
    c.beginPath(); c.moveTo(...corner(-1.1, 0)); c.lineTo(...corner(1.1, 0)); c.stroke();
    }
    /* The finish: a checked strip - or, in the glade, a row of glowing
       flowers. */
    if (this.giant) for (let k = 0; k < 13; k++){
      const q = Q(-1.05 + k * 0.175, 1, W, H);
      c.fillStyle = 'rgba(255,140,216,.35)'; c.beginPath(); c.arc(q.x, q.y - H * 0.012, H * 0.02, 0, 6.2832); c.fill();
      c.fillStyle = '#ff8cd8'; c.beginPath(); c.arc(q.x, q.y - H * 0.012, H * 0.007, 0, 6.2832); c.fill();
    }
    else for (let k = 0; k < 22; k++){
      c.fillStyle = k % 2 ? '#ffffff' : '#0b0d1c';
      const a = corner(-1.1 + k * 0.1, 1), b = corner(-1.1 + (k + 1) * 0.1, 1.03);
      c.fillRect(a[0], b[1], b[0] - a[0], a[1] - b[1]);
    }
    /* The robot, beyond the finish: asleep (or recharging) on green,
       stirring on yellow, looking on red. */
    if (this.giant) drawZubuAsleep(c, W, H, this.light, this.t);
    else if (PAL.world) worldSleeper(c, W / 2, H * 0.335, H * 0.17, this.light, g.awake, this.t, lamp);
    else this._robot(c, W / 2, H * 0.22, H * 0.085, lamp, g.awake);
    /* Its gaze, on red: a red wash down the hall. */
    if (red && !this.giant){
      c.save(); c.globalAlpha = 0.12 + 0.05 * Math.sin(this.t * 10);
      c.fillStyle = '#ff3b3b';
      c.beginPath(); c.moveTo(W / 2, H * 0.24); c.lineTo(...corner(1.1, -0.1)); c.lineTo(...corner(-1.1, -0.1)); c.closePath(); c.fill();
      c.restore();
    }
    for (const cn of this.pile){
      const q = Q(cn.lane, 1.06 + cn.up, W, H);
      drawCrystal(c, q.x, q.y - H * 0.015 * q.k - cn.z * H * 0.0015, H * 0.02 * q.k, this.t + cn.z);
    }
    /* The crew, far ones first. */
    const order = g.here.slice().sort((a, b) => g.crew[b].along - g.crew[a].along);
    for (const i of order){
      const rn = g.crew[i], q = Q(rn.x, rn.along, W, H);
      /* Walking, a steady bob; running, a quicker, bigger one. */
      const going = this.light !== 'red' && !this.done ? rn.marching : 0;   /* frozen the moment they stop */
      drawCrew(i, q.x, q.y, H * 0.2 * q.k, 0);   /* the stride's drawn by the crew's own run */
    }
    /* In from the door: a quick fade up from black. */
    if (this.fade < 1){ c.fillStyle = `rgba(0,0,0,${1 - this.fade})`; c.fillRect(0, 0, W, H); }
  }

  /* The robot: a great slumped cleaning robot, wide and boxy, a brush
   either side, one eye in its round head - shut and snoring on green
   (before the robots wake), or dark and recharging (after); flickering
   on yellow, its head twitching; wide open and red on red. Its light on
   top in the same colour, big, so it reads from across the room. */
  _robot(c, x, y, s, lamp, awake){
    const twitch = this.light === 'yellow' ? Math.sin(this.t * 30) * s * 0.04 : 0;
    c.save(); c.translate(x, y);
    /* Its body, slumped, and its brushes. */
    c.fillStyle = '#5b6375'; c.strokeStyle = '#0b0d1c'; c.lineWidth = 4;
    c.beginPath(); c.roundRect(-s * 1.6, s * 0.35, s * 3.2, s * 0.9, s * 0.2); c.fill(); c.stroke();
    c.fillStyle = '#c2a14a';
    for (const sd of [-1, 1]){ c.beginPath(); c.ellipse(sd * s * 1.75, s * 1.05, s * 0.35, s * 0.18, 0, 0, 6.2832); c.fill(); c.stroke(); }
    /* Its head. */
    c.translate(twitch, 0);
    c.fillStyle = '#9aa3b5';
    c.beginPath(); c.arc(0, 0, s, 0, 6.2832); c.fill(); c.stroke();
    c.fillStyle = '#0b0d1c'; c.beginPath(); c.ellipse(0, s * 0.05, s * 0.55, s * 0.4, 0, 0, 6.2832); c.fill();
    if (this.light === 'red'){
      c.fillStyle = lamp; c.beginPath(); c.arc(0, s * 0.05, s * 0.28, 0, 6.2832); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-s * 0.08, -s * 0.03, s * 0.07, 0, 6.2832); c.fill();
    } else if (this.light === 'yellow'){
      /* Flickering, half open. */
      if (Math.floor(this.t * 12) % 2){ c.fillStyle = lamp; c.beginPath(); c.ellipse(0, s * 0.05, s * 0.28, s * 0.1, 0, 0, 6.2832); c.fill(); }
    } else {
      /* Shut - a line - or, recharging, a dim glow. */
      c.strokeStyle = awake ? '#3b5c7a' : '#7a8396'; c.lineWidth = s * 0.08; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-s * 0.3, s * 0.08); c.quadraticCurveTo(0, s * 0.2, s * 0.3, s * 0.08); c.stroke();
    }
    /* Its light on top. */
    c.fillStyle = lamp; c.strokeStyle = '#0b0d1c'; c.lineWidth = 4;
    c.beginPath(); c.arc(0, -s * 1.25, s * 0.35, 0, 6.2832); c.fill(); c.stroke();
    c.restore();
    /* Asleep: Z z z. Recharging: a little bolt, pulsing. */
    if (this.light === 'green'){
      c.save(); c.fillStyle = '#ffffff'; c.textAlign = 'center';
      if (!awake) for (let k = 0; k < 3; k++){
        const u = (this.t * 0.5 + k / 3) % 1;
        c.globalAlpha = Math.sin(u * Math.PI);
        c.font = `700 ${Math.round(s * (0.4 + u * 0.5))}px Fredoka, sans-serif`;
        c.fillText('z', x + s * (0.9 + u * 0.7), y - s * (0.6 + u * 1.2));
      } else {
        c.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 4); c.fillStyle = '#7ff3ff';
        c.beginPath(); c.moveTo(x + s * 1.2, y - s * 1.3); c.lineTo(x + s * 0.95, y - s * 0.9); c.lineTo(x + s * 1.12, y - s * 0.9); c.lineTo(x + s * 0.98, y - s * 0.5); c.lineTo(x + s * 1.3, y - s * 1.0); c.lineTo(x + s * 1.12, y - s * 1.0); c.closePath(); c.fill();
      }
      c.restore();
    }
  }

}
