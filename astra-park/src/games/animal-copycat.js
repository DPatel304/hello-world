import { clamp } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { silhouette } from '../ui/avatars.js';
import { Scene } from './pop-party-scene.js';
import { drawKid } from '../ui/kids.js';
import { MATCH, HEAD, ANIMALS, POSES, closest, frameOf, targetOf, bodyIn } from './copycat-poses.js';
import { DRAW, costume } from './copycat-art.js';
import { armToward } from './moon-art.js';

/* Animal Copycat. Animals come one at a time into the park and strike a
   pose - a giraffe stretching tall, a bird with its wings out, a frog in a
   squat, a flamingo on one leg - and the children copy it. A glowing outline
   of the pose stands over each child, warming to gold the closer they get;
   hold it for a moment and it lights up. When everyone has copied it, the
   animal cheers and joins the parade marching along the hills behind, and
   the next one comes along.

   The children see themselves as soft silhouettes with their own faces, in
   a bit of costume for each animal - bunny ears, giraffe horns, a crest of
   feathers. No words and no scores; the outline is the instruction, and an
   animal nobody manages to copy cheers anyway after a while and joins the
   parade, so nobody is ever stuck. */

export const ROUND = 300;
export const FINALE = ROUND - 10;
export const HOLD = 0.6;              /* seconds to hold a pose */
export const PATIENCE = 25;           /* an animal joins the parade after this anyway */
const ENTER = 0.9, CHEER = 1.8, LEAVE = 1.3;
const SIZE = 0.42, BASE = 0.93;       /* the performing animal, in screen heights */
const PARADE_Y = 0.77, PARADE_S = 0.085, PARADE_GAP = 0.085;
const FIRST = ['giraffe', 'bird'];    /* the easiest two open every round */
const SOUND = { elephant: 'trumpet', frog: 'boing', bunny: 'boing', bird: 'twinkle', starfish: 'rainbow', giraffe: 'gold', flamingo: 'squeak' };

export default {
  id: 'animal-copycat', name: 'Animal Copycat', stars: 1, accent: '#53e59a', secs: ROUND,
  /* Giraffe and bunny poses put both hands up; don't mistake them for pausing. */
  pauseHold: 4,
  create(n){ return new Copycat(n); }
};

class Copycat {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false;
    this.scene = new Scene();
    this.faces = new FaceCam();
    this.parade = [];
    this.copied = 0;
    this.queue = [...FIRST];
    this.last = null;
    this.bits = [];
    this.out = null;
    this.cur = this._next();
  }

  _next(){
    if (!this.queue.length){
      let pool = ANIMALS.slice().sort(() => Math.random() - 0.5);
      if (pool[0] === this.last) pool.push(pool.shift());
      this.queue = pool;
    }
    const name = this.queue.shift();
    this.last = name;
    /* Stand where the children aren't. */
    const xs = pose.players.slice(0, this.players).filter(p => p.present && p.centre).map(p => p.centre.x);
    const mid = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5;
    const side = mid < 0.5 ? 1 : -1;
    return { name, t: 0, phase: 'enter', side, x: side > 0 ? 0.84 : 0.16,
             hold: [0, 0], close: [0, 0], matched: [false, false], mirror: [false, false] };
  }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    this.t += dt;
    this.aspect = W / H;
    this.faces.step(dt);
    const a = this.cur;
    a.t += dt;
    if (a.phase === 'enter' && a.t >= ENTER){ a.phase = 'pose'; a.t = 0; sfx.twinkle(); }
    else if (a.phase === 'pose') this._copying(dt, W, H);
    else if (a.phase === 'cheer' && a.t >= CHEER){ a.phase = 'leave'; a.t = 0; }
    else if (a.phase === 'leave' && a.t >= LEAVE){
      this.parade.push({ name: a.name, at: this.t });
      this.cur = this._next();
    }
    for (const b of this.bits){ b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 0.5 * dt; }
    this.bits = this.bits.filter(b => b.age < b.life);
    if (this.t >= FINALE && Math.random() < dt * 25) this._confetti(Math.random(), 0.1);
    this.scene.step(dt, { t: this.t, p: 0.15 + 0.65 * this.t / ROUND, storm: false, wind: 0, joy: a.phase === 'cheer' ? 1 : 0, look: 0.5, rainbow: false });
  }

  _lm(i){
    const p = pose.players[i];
    if (!p.present) return null;
    if (pose.mouse.active){
      /* A made-up body whose arm follows the pointer, as far as an arm
         reaches - far enough for every pose's hands. */
      const lm = bodyIn('stand', clamp(p.hands.right.x, 0.25, 0.75), 0.6, 0.17);
      return armToward(lm, p.hands.right.x, p.hands.right.y, 0.17 * 1.5, this.aspect || 16 / 9);
    }
    return p.lm;
  }

  _copying(dt, W, H){
    const a = this.cur;
    let present = 0;
    for (let i = 0; i < this.players; i++){
      const lm = this._lm(i);
      if (!lm){ a.close[i] = 0; continue; }
      const c = closest(lm, a.name, W, H);
      if (!c){ a.close[i] = 0; continue; }
      present++;
      a.mirror[i] = c.mirror;
      a.close[i] += (clamp((1.3 - c.d) / (1.3 - MATCH), 0, 1) - a.close[i]) * Math.min(1, dt * 8);
      if (a.matched[i]) continue;
      a.hold[i] = c.d < MATCH ? a.hold[i] + dt : Math.max(0, a.hold[i] - dt * 2);
      if (a.hold[i] >= HOLD){
        a.matched[i] = true;
        sfx.firefly(3 + i * 2);
        const f = frameOf(lm, W, H);
        if (f) for (let k = 0; k < 14; k++) this._spark(f.x / W, (f.y - f.u) / H);
      }
    }
    const everyone = present > 0 && a.matched.slice(0, this.players).filter((m, i) => m || !this._lm(i)).length === this.players;
    if (everyone || a.t >= PATIENCE){
      if (everyone) this.copied++;
      a.phase = 'cheer'; a.t = 0;
      sfx.hooray();
      const s = SOUND[a.name]; if (s && sfx[s]) sfx[s](3);
      for (let k = 0; k < 40; k++) this._confetti(a.x + (Math.random() - 0.5) * 0.15, 0.45);
    }
  }

  get copying(){ return this.cur.phase === 'pose'; }

  /* Both hands above the head is how you pause - and also how you copy a
     giraffe, a bunny or a starfish. While one of those is on, it's copying. */
  pausable(){
    const a = this.cur;
    return a.phase === 'leave' || POSES[a.name].wrist[1] > HEAD;
  }

  _spark(x, y){ const r = Math.random() * 6.28; this.bits.push({ kind: 'spark', x, y, vx: Math.cos(r) * 0.15, vy: Math.sin(r) * 0.15 - 0.1, age: 0, life: 0.9 }); }
  _confetti(x, y){ this.bits.push({ kind: 'confetti', x, y, vx: (Math.random() - 0.5) * 0.15, vy: -0.25 - Math.random() * 0.25, age: 0, life: 2.2, hue: (Math.random() * 360) | 0, r: Math.random() * 6 }); if (this.bits.length > 400) this.bits.shift(); }

  /* ---------- the ending: everyone in the parade comes down front ---------- */

  outro(dt, W, H){
    if (!this.out){ this.out = { t: 0 }; sfx.parade && sfx.parade(); }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.faces.step(dt);
    if (Math.random() < dt * 25) this._confetti(Math.random(), 0.05);
    for (const b of this.bits){ b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 0.5 * dt; }
    this.bits = this.bits.filter(b => b.age < b.life);
    this.scene.step(dt, { t: this.t, p: 0.8, storm: false, wind: 0, joy: 1, look: 0.5, rainbow: true });
    return o.t > 7;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    this._drawParade(c, W, H);
    const a = this.cur;
    if (!this.out) this._drawPerformer(c, a, W, H);
    for (let i = 0; i < this.players; i++){
      const lm = this._lm(i);
      if (!lm) continue;
      if (a.phase === 'pose' && !this.out) this._drawOutline(c, i, lm, W, H);
      this._drawChild(c, i, lm, W, H);
    }
    this.scene.drawFront(c, W, H);
    for (const b of this.bits){
      const k = b.age / b.life;
      if (b.kind === 'spark'){ c.fillStyle = `rgba(255,236,150,${1 - k})`; c.beginPath(); c.arc(b.x * W, b.y * H, H * 0.007, 0, 6.2832); c.fill(); }
      else { c.save(); c.translate(b.x * W, b.y * H); c.rotate(b.age * 6 + b.r); c.fillStyle = `hsla(${b.hue},90%,62%,${1 - k * k})`; c.fillRect(-H * 0.008, -H * 0.004, H * 0.016, H * 0.008); c.restore(); }
    }
  }

  _drawPerformer(c, a, W, H){
    let x = a.x, base = BASE, s = SIZE, happy = a.phase === 'cheer';
    if (a.phase === 'enter'){
      /* Hopping in from the side. */
      const k = a.t / ENTER, e = 1 - (1 - k) * (1 - k), from = a.side > 0 ? 1.15 : -0.15;
      x = from + (a.x - from) * e; base = BASE - Math.abs(Math.sin(k * Math.PI * 3)) * 0.04 * (1 - k);
    }
    if (a.phase === 'leave'){
      /* Up and away to the back of the parade. */
      const k = a.t / LEAVE, e = k * k * (3 - 2 * k);
      x = a.x + (this._paradeX(this.parade.length) - a.x) * e;
      base = BASE + (PARADE_Y - BASE) * e - Math.sin(k * Math.PI) * 0.08; s = SIZE + (PARADE_S - SIZE) * e; happy = true;
    }
    const pose = a.phase === 'enter' ? null : a.name;
    DRAW[a.name](c, x * W, base * H, s * H, this.t, happy, pose);
  }

  _paradeX(n){
    /* The parade walks slowly left across the hills, wrapping round. */
    const span = Math.max(1.2, (this.parade.length + 1) * PARADE_GAP + 0.3);
    return ((((0.9 - n * PARADE_GAP - this.t * 0.02) % span) + span) % span) - 0.1;
  }

  _drawParade(c, W, H){
    const outro = this.out ? Math.min(1, this.out.t / 1.5) : 0;
    this.parade.forEach((p, n) => {
      const hop = Math.abs(Math.sin(this.t * 4 + n)) * H * 0.01 * (1 + outro * 3);
      const y = (PARADE_Y + (0.92 - PARADE_Y) * outro) * H - hop, s = (PARADE_S + (0.2 - PARADE_S) * outro) * H;
      const x = outro ? (((n + 0.5) / Math.max(1, this.parade.length)) * 1.0 + Math.sin(this.t + n) * 0.01) * W : this._paradeX(n) * W;
      DRAW[p.name](c, x, y, s, this.t + n, outro > 0 || this.t >= FINALE);
    });
  }

  /* The pose to copy, as a glowing figure standing over the child: white
     at first, warming to gold as they get close, solid gold once copied. */
  _drawOutline(c, i, lm, W, H){
    const f = frameOf(lm, W, H);
    if (!f) return;
    const a = this.cur, tg = targetOf(a.name, a.mirror[i]), done = a.matched[i], k = done ? 1 : a.close[i];
    const P = (tx, ty) => [f.x + tx * f.u, f.y + ty * f.u];
    const col = `rgba(255,${(255 - 40 * k) | 0},${(255 - 175 * k) | 0},${done ? 0.85 : 0.35 + 0.35 * k})`;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    const sL = P(0.45, -1), sR = P(-0.45, -1), hL = P(0.25, 0), hR = P(-0.25, 0), [nx, ny] = P(0, -1.45);
    const figure = (arm, leg, head) => {
      const line = (...pts) => { c.beginPath(); pts.forEach(([x, y], n) => (n ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
      c.lineWidth = arm;
      line(sL, sR, hR, hL, sL);
      line(sL, P(...tg[L.L_ELBOW]), P(...tg[L.L_WRIST]));
      line(sR, P(...tg[L.R_ELBOW]), P(...tg[L.R_WRIST]));
      c.lineWidth = leg;
      line(hL, P(...tg[L.L_KNEE]), P(...tg[L.L_ANKLE]));
      line(hR, P(...tg[L.R_KNEE]), P(...tg[L.R_ANKLE]));
      c.lineWidth = head; c.beginPath(); c.arc(nx, ny, f.u * 0.38, 0, 6.2832); c.stroke();
    };
    /* A soft halo first - a wide, faint copy of the figure - then the figure.
       Cheaper than a blur, which matters with the camera sharing the laptop. */
    c.strokeStyle = done ? 'rgba(255,214,90,.28)' : 'rgba(255,255,255,.16)';
    figure(f.u * 0.55, f.u * 0.62, f.u * 0.34);
    c.strokeStyle = col;
    figure(f.u * 0.3, f.u * 0.36, f.u * 0.12);
    c.restore();
  }

  _drawChild(c, i, lm, W, H){
    silhouette(c, lm, W, H, PLAYER_COLORS[i], 0.55);
    const sw = Math.hypot((lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x) * W, (lm[L.L_SHOULDER].y - lm[L.R_SHOULDER].y) * H);
    const x = lm[L.NOSE].x * W, y = lm[L.NOSE].y * H - sw * 0.08, r = sw * 0.5;
    if (r < 6) return;
    const name = this.out ? (this.parade.length ? this.parade[(i * 3) % this.parade.length].name : 'bunny') : this.cur.name;
    if (name === 'elephant') costume(c, name, x, y, r, this.faces.roll(i));
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.clip();
    c.fillStyle = PLAYER_COLORS[i]; c.fillRect(x - r, y - r, r * 2, r * 2);
    if (this.faces.has(i)) this.faces.draw(c, i, x, y, r);
    else drawKid(c, x, y + r * 0.1, r, this.t + i, i ? '#c98f6a' : '#e9b892');
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = r * 0.08;
    c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
    if (name !== 'elephant') costume(c, name, x, y, r, this.faces.roll(i));
  }

  /* Cooperative: nothing to show but the clock. */
  hud(){ return { score: [this.copied, this.copied], showLives: false, hideScore: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) rows.push({ label: `Player ${i + 1}`, value: this.copied, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.players < 2 ? null : -1; }
  value(){ return this.copied; }
}

export { POSES };
