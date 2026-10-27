import { clamp } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { silhouette } from '../ui/avatars.js';
import { drawKid } from './fire-truck-art.js';
import { bodyIn } from './copycat-poses.js';
import { armToward } from './moon-art.js';
import { DRAW } from './copycat-art.js';
import { DANCERS, MOVES, FLOOR, drawStage, drawMirrorBall, drawDancer } from './dance-art.js';

/* Dance Party, with Mama, Auntie K and Harlyn. A disco stage - curtains,
   marquee lights, a mirror ball, spotlights, a floor that lights up - with
   the three of them dancing on it in sparkly outfits, the park's animals
   cheering from the front, and the family's own songs playing loud.

   There are no moves to copy and no way to do it wrong: the children just
   dance, as glowing figures in their colours with their own faces, and the
   more they move, the more the party builds. The lights come up and the
   mirror ball spins faster, the floor lights up, balloons float up, then
   confetti - until the big moment: confetti cannons, streamers, the crowd
   jumping, and all three dancers spinning round together. Then it builds
   again. If the children stand still for a while, the dancers beckon them
   in. At the end, everyone takes a curtsy. */

export const ROUND = 180;
export const FINALE = ROUND - 10;
export const BPM = 112;
export const GAIN = 0.05;         /* party per second, dancing flat out */
export const DECAY = 0.03;        /* party per second, standing still */
export const AFTER_BURST = 0.4;   /* where the party settles after a big moment */
const HINT_AFTER = 6, SPIN = 1.2;
/* The joints whose movement counts as dancing. */
const MOVING = [L.L_WRIST, L.R_WRIST, L.L_ANKLE, L.R_ANKLE, L.NOSE, L.L_HIP, L.R_HIP, L.L_ELBOW, L.R_ELBOW];
const CROWD = [['bunny', 0.06], ['frog', 0.15], ['bird', 0.24], ['elephant', 0.76], ['starfish', 0.85], ['giraffe', 0.94]];

export default {
  id: 'dance-party', name: 'Dance Party', stars: 1, accent: '#ff4fa3', secs: ROUND,
  /* A party wants its music up from the start, and arms go up a lot. */
  loud: true, pauseHold: 4,
  create(n){ return new Party(n); }
};

class Party {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false;
    this.energy = 0.2;
    this.buzz = 0;             /* how hard they're dancing right now, for the lights */
    this.bursts = 0;
    this.burst = 0;            /* seconds since the last big moment began, while it plays */
    this.prev = [null, null];
    this.moving = [0, 0];
    this.idle = 0;
    this.bits = [];
    this.balloonBeat = 0;
    this.faces = new FaceCam();
    this.out = null;
  }

  get beat(){ return this.t * BPM / 60; }

  /* How hard child i is dancing, 0..1: how far their hands, feet, head and
     hips travel each second, in body sizes. */
  _move(i, dt){
    const p = pose.players[i];
    if (!p.present){ this.prev[i] = null; return 0; }
    if (pose.mouse.active){ return clamp((p.hands.right.speed || 0) / 1.2, 0, 1); }
    const lm = p.lm;
    if (!lm) return 0;
    const now = MOVING.map(k => [lm[k].x, lm[k].y, lm[k].v ?? 1]);
    const was = this.prev[i];
    this.prev[i] = now;
    if (!was) return 0;
    let sum = 0, n = 0;
    for (let k = 0; k < now.length; k++){
      if (now[k][2] < 0.4) continue;
      sum += Math.hypot((now[k][0] - was[k][0]) * 16 / 9, now[k][1] - was[k][1]); n++;
    }
    if (!n) return 0;
    const perJoint = sum / n / Math.max(dt, 1e-3) / (p.scale || 0.3);
    return clamp(perJoint / 0.6, 0, 1);
  }

  step(dt, W, H){
    this.t += dt;
    this.faces.step(dt);
    let total = 0, count = 0;
    for (let i = 0; i < this.players; i++){
      const m = this._move(i, dt);
      this.moving[i] += (m - this.moving[i]) * Math.min(1, dt * 4);
      if (pose.players[i].present){ total += this.moving[i]; count++; }
    }
    const dancing = count ? total / count : 0;
    this.buzz = dancing;
    this.idle = dancing > 0.15 ? 0 : this.idle + dt;
    /* Real dancing builds the party; a gentle sway about holds it; standing
       still lets it fade. */
    this.energy = clamp(this.energy + (dancing * GAIN - (1 - dancing) * DECAY) * dt, this.t < 10 ? 0.15 : 0, 1);
    if (this.energy >= 1 && !this.burst) this._bigMoment();
    if (this.burst){ this.burst += dt; if (this.burst > 4) this.burst = 0; }

    /* Balloons and confetti as the party builds. */
    if (this.energy > 0.5 && (this.balloonBeat -= dt) <= 0){ this.balloonBeat = 2.5 - this.energy * 1.5; this._balloon(); }
    if (this.energy > 0.72 && Math.random() < dt * 30 * (this.energy - 0.7)) this._confetti(Math.random(), -0.02, 0);
    this._sparkles(dt, W, H);
    this._stepBits(dt);
  }

  get dancing(){ return this.idle < HINT_AFTER; }

  _bigMoment(){
    this.bursts++;
    this.burst = 0.001;
    this.energy = AFTER_BURST;
    sfx.hooray(); sfx.rainbow();
    for (let k = 0; k < 70; k++){ this._confetti(0.02, 0.85, 1); this._confetti(0.98, 0.85, -1); }
    for (let k = 0; k < 14; k++) this.bits.push({ kind: 'streamer', x: Math.random(), y: -0.05 - Math.random() * 0.2, vx: 0, vy: 0.25 + Math.random() * 0.15, age: 0, life: 4, hue: (Math.random() * 360) | 0, ph: Math.random() * 6 });
  }

  _confetti(x, y, side){
    const b = { kind: 'confetti', x, y, age: 0, life: 3.5, hue: (Math.random() * 360) | 0, r: Math.random() * 6 };
    if (side){ b.vx = side * (0.2 + Math.random() * 0.35); b.vy = -0.7 - Math.random() * 0.5; }
    else { b.vx = (Math.random() - 0.5) * 0.05; b.vy = 0.1 + Math.random() * 0.1; }
    this.bits.push(b);
    if (this.bits.length > 500) this.bits.shift();
  }
  _balloon(){ this.bits.push({ kind: 'balloon', x: 0.15 + Math.random() * 0.7, y: 1.1, vx: 0, vy: -0.12 - Math.random() * 0.06, age: 0, life: 12, hue: (Math.random() * 360) | 0, r: Math.random() * 6 }); }

  /* Fast hands throw off sparkles in the child's colour. */
  _sparkles(dt){
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p.present) continue;
      for (const h of [p.hands.left, p.hands.right]){
        if ((h.speed || 0) > 0.8 && Math.random() < dt * 40) this.bits.push({ kind: 'spark', who: i, x: h.x, y: h.y, vx: (Math.random() - 0.5) * 0.1, vy: (Math.random() - 0.5) * 0.1, age: 0, life: 0.6 });
      }
    }
  }

  _stepBits(dt){
    for (const b of this.bits){
      b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.kind === 'confetti'){ b.vy = Math.min(0.2, b.vy + 1.2 * dt); b.vx *= 1 - dt * 1.5; }
      if (b.kind === 'balloon') b.x += Math.sin(b.age + b.r) * 0.01 * dt;
    }
    this.bits = this.bits.filter(b => b.age < b.life && b.y < 1.2 && b.y > -0.4);
  }

  /* ---------- the ending: a curtsy, and confetti ---------- */

  outro(dt, W, H){
    if (!this.out){ this.out = { t: 0 }; sfx.fanfare(); }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.faces.step(dt);
    if (Math.random() < dt * 40) this._confetti(Math.random(), -0.02, 0);
    this._stepBits(dt);
    return o.t > 6;
  }

  /* ---------- drawing ---------- */

  _lm(i){
    const p = pose.players[i];
    if (!p.present) return null;
    if (pose.mouse.active){
      const lm = bodyIn('stand', clamp(p.hands.right.x, 0.25, 0.75), 0.62, 0.17);
      return armToward(lm, p.hands.right.x, p.hands.right.y, 0.17 * 1.5);
    }
    return p.lm;
  }

  draw(c, W, H){
    const beat = this.beat, n = Math.floor(beat), b = beat - n;
    /* The lights answer straight away; the party itself builds slowly. */
    const e = this.out ? 0.8 : Math.min(1, this.energy + this.buzz * 0.25);
    drawStage(c, W, H, this.t, b, n, e);
    drawMirrorBall(c, W, H, this.t, e);
    for (const bt of this.bits) if (bt.kind === 'balloon') this._drawBalloon(c, bt, W, H);

    /* The three dancers: each on her own move, changing every eight beats;
       spinning together at a big moment; beckoning if nobody's dancing. */
    DANCERS.forEach((d, i) => {
      let move = MOVES[(Math.floor(n / 8) + i * 2) % MOVES.length], spin = 0;
      if (this.out) move = 'bow';
      else if (this.burst && this.burst < SPIN){ spin = this.burst / SPIN; move = 'wave'; }
      else if (this.burst) move = 'pump';
      else if (this.idle > HINT_AFTER) move = 'beckon';
      drawDancer(c, d, d.x * W, FLOOR * H, d.h * H, this.t, move, b, n, e, spin);
    });

    for (let i = 0; i < this.players; i++){ const lm = this._lm(i); if (lm) this._drawChild(c, i, lm, W, H); }
    this._drawCrowd(c, W, H, b);
    for (const bt of this.bits) if (bt.kind !== 'balloon') this._drawBit(c, bt, W, H);
  }

  /* A child, glowing in their colour, with their own face. */
  _drawChild(c, i, lm, W, H){
    const col = PLAYER_COLORS[i];
    const sw = Math.hypot((lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x) * W, (lm[L.L_SHOULDER].y - lm[L.R_SHOULDER].y) * H);
    const cx = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2 * W, cy = (lm[L.L_SHOULDER].y + lm[L.L_HIP].y) / 2 * H;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, sw * 2.2);
    g.addColorStop(0, `${col}66`); g.addColorStop(1, `${col}00`);
    c.fillStyle = g; c.fillRect(cx - sw * 2.2, cy - sw * 2.2, sw * 4.4, sw * 4.4);
    silhouette(c, lm, W, H, col, 0.55);
    const x = lm[L.NOSE].x * W, y = lm[L.NOSE].y * H - sw * 0.08, r = sw * 0.5;
    if (r < 6) return;
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.clip();
    c.fillStyle = col; c.fillRect(x - r, y - r, r * 2, r * 2);
    if (this.faces.has(i)) this.faces.draw(c, i, x, y, r);
    else drawKid(c, x, y + r * 0.1, r, this.t + i, i ? '#c98f6a' : '#e9b892');
    c.restore();
    c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.1; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
  }

  /* The park's animals in the front row, bobbing to the beat, jumping at
     the big moments. */
  _drawCrowd(c, W, H, b){
    CROWD.forEach(([name, x], k) => {
      const jump = this.burst && this.burst < 2.5 ? Math.abs(Math.sin(this.burst * 7 + k)) * 0.05 : 0;
      const bob = Math.abs(Math.sin((b + k * 0.25) * Math.PI)) * 0.012 * (0.4 + this.energy);
      DRAW[name](c, x * W, H * (1.03 - bob - jump), H * 0.2, this.t + k, this.energy > 0.5 || !!this.burst || !!this.out);
    });
  }

  _drawBalloon(c, b, W, H){
    const x = b.x * W, y = b.y * H, r = H * 0.035;
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, y + r); c.quadraticCurveTo(x + r * 0.4, y + r * 2, x, y + r * 3); c.stroke();
    c.fillStyle = `hsl(${b.hue},85%,62%)`;
    c.beginPath(); c.ellipse(x, y, r * 0.85, r, 0, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.35, r * 0.16, r * 0.26, -0.4, 0, 6.2832); c.fill();
  }

  _drawBit(c, b, W, H){
    const k = b.age / b.life, x = b.x * W, y = b.y * H;
    if (b.kind === 'confetti'){
      c.save(); c.translate(x, y); c.rotate(b.age * 7 + b.r);
      c.fillStyle = `hsla(${b.hue},90%,62%,${1 - k * k})`; c.fillRect(-H * 0.008, -H * 0.004, H * 0.016, H * 0.008);
      c.restore();
    } else if (b.kind === 'streamer'){
      c.strokeStyle = `hsla(${b.hue},90%,62%,${1 - k})`; c.lineWidth = H * 0.008; c.lineCap = 'round';
      c.beginPath(); for (let s = 0; s <= 8; s++){ const yy = y - s * H * 0.02, xx = x + Math.sin(b.age * 4 + b.ph + s * 0.8) * H * 0.012; s ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
    } else if (b.kind === 'spark'){
      c.fillStyle = PLAYER_COLORS[b.who] || '#ffffff'; c.globalAlpha = 1 - k;
      c.beginPath(); c.arc(x, y, H * 0.008 * (1 - k * 0.5), 0, 6.2832); c.fill();
      c.globalAlpha = 1;
    }
  }

  /* Cooperative: nothing to show but the clock. */
  hud(){ return { score: [this.bursts, this.bursts], showLives: false, hideScore: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) rows.push({ label: `Player ${i + 1}`, value: this.bursts, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.players < 2 ? null : -1; }
  value(){ return this.bursts; }
}
