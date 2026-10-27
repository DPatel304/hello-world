import { clamp } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { friend } from '../ui/friend.js';
import { JumpWatch } from '../tracking/jump.js';
import { drawKid } from './fire-truck-art.js';
import { GROUND, drawMoon, drawStar, drawConstellation, drawAstronaut, standIn, SHAPES } from './moon-art.js';

/* Moon Bounce. The children are astronauts on the moon - their own faces
   inside glass helmets, their suits moving as they move. Jump, and you float
   up in slow moon gravity and drift back down. Wishing stars drift through
   the sky; touch one with a glove or your helmet and it flies up to its
   place in a picture made of stars - a rocket, a heart, a fish - and when
   the picture is whole, its lines draw themselves in and it fills with
   colour, then floats up to join the others along the top of the sky.

   Everyone builds the same pictures, there are no scores, and nothing is
   explained in words: the first stars float low enough to touch without
   jumping, and if a little while passes without a catch, the park's friend
   bounces up beside them to show how. */

export const ROUND = 300;
export const FINALE = ROUND - 10;
export const OPENING = 30;
/* Moon gravity, in screen heights: a jump goes up about a third of the
   screen and takes over two seconds to come down. */
export const GRAVITY = 0.55, PEAK = 0.36;
export const CATCH = 0.075;          /* screen heights from a glove or helmet */
export const GOLD_WORTH = 3;
export const HINT_AFTER = 8;
const FLY = 0.8;                     /* seconds for a caught star to reach its place */
const SHOW = 2.6;                    /* seconds a finished picture shows off before moving up */
const SKY = { x: 0.5, y: 0.25, r: 0.13 };   /* where the picture being made sits */
const GALLERY = [0.14, 0.86, 0.27, 0.73, 0.06, 0.94, 0.38, 0.62, 0.2, 0.8];

export default {
  id: 'moon-bounce', name: 'Moon Bounce', stars: 1, accent: '#8f7bff', secs: ROUND,
  /* Arms go up with every jump; the pause pose needs a longer hold here. */
  pauseHold: 4,
  create(n){ return new MoonBounce(n); }
};

class MoonBounce {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false;
    this.bodies = [0, 1].map(() => ({ lift: 0, vy: 0, air: false, head: null }));
    this.stars = [];          /* wishing stars drifting in the sky */
    this.flying = [];         /* caught stars on their way to the picture */
    this.order = SHAPES.slice().sort(() => Math.random() - 0.5);
    this.made = [];           /* finished pictures, in the gallery */
    this.cur = this._shape(0);
    this.caught = 0;
    this.lastCatch = 0;
    this.spawn = 0;
    this.nextGold = 25 + Math.random() * 20;
    this.bits = [];
    this.helper = { lift: 0, vy: 0, beat: 0 };
    this.faces = new FaceCam();
    this.jumps = new JumpWatch();
    this.out = null;
  }

  _shape(k){ return { shape: this.order[k % this.order.length], k, lit: 0, coming: 0, done: 0, shownFor: 0 }; }

  /* How many stars should be drifting about. */
  target(){
    if (this.t >= FINALE) return 14;
    if (this.t < OPENING) return 3;
    return 4 + 4 * (this.t - OPENING) / (FINALE - OPENING);
  }

  _star(gold = false){
    const fromLeft = Math.random() < 0.5, low = this.t < OPENING;
    const s = {
      x: fromLeft ? -0.05 : 1.05, y: low ? 0.38 + Math.random() * 0.2 : 0.14 + Math.random() * 0.46,
      vx: (fromLeft ? 1 : -1) * (gold ? 0.22 : 0.025 + Math.random() * 0.025), ph: Math.random() * 6.28, gold, age: 0
    };
    if (this.t >= FINALE){ s.x = 0.1 + Math.random() * 0.8; s.y = -0.05; s.vx = 0; s.fall = 0.06 + Math.random() * 0.04; }
    this.stars.push(s);
    return s;
  }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    this.t += dt;
    this.faces.step(dt);
    this._stepBodies(dt, true);
    this._stepStars(dt);
    this._catch(W, H);
    this._stepFlying(dt);
    this._stepPicture(dt);
    for (const m of this.made) m.age += dt;
    this._stepHelper(dt);
    this._stepBits(dt);
  }

  _lm(i){
    const p = pose.players[i];
    if (!p.present) return null;
    if (pose.mouse.active) return standIn(clamp(p.hands.right.x, 0.2, 0.8), p.hands.right.x, p.hands.right.y + this.bodies[i].lift);
    return p.lm;
  }

  _stepBodies(dt, canJump){
    if (canJump){
      for (const i of this.jumps.step(dt, pose.players, this.players)){
        const b = this.bodies[i], lm = this._lm(i);
        if (b.air || !lm) continue;
        /* High enough to float well clear, never so high the helmet leaves the sky. */
        const peak = clamp(lm[L.NOSE].y - 0.12, 0.08, PEAK);
        b.vy = Math.sqrt(2 * GRAVITY * peak); b.air = true;
        sfx.boing(1);
      }
    }
    for (let i = 0; i < 2; i++){
      const b = this.bodies[i];
      if (!b.air) continue;
      b.lift += b.vy * dt; b.vy -= GRAVITY * dt;
      /* Little puffs from the backpack while floating. */
      const lm = this._lm(i);
      if (lm && Math.random() < dt * 30){
        const x = (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2, y = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2 - b.lift;
        this._bit('jet', x + (Math.random() - 0.5) * 0.02, y);
      }
      if (b.lift <= 0){
        b.lift = 0; b.vy = 0; b.air = false;
        sfx.land();
        const lm = this._lm(i);
        if (lm) for (const a of [L.L_ANKLE, L.R_ANKLE]) for (let k = 0; k < 5; k++) this._bit('dust', lm[a].x, lm[a].y);
      }
    }
  }

  _stepStars(dt){
    for (const s of this.stars){
      s.age += dt; s.x += s.vx * dt;
      if (s.fall) s.y += s.fall * dt;
      if (s.gold && Math.random() < dt * 30) this._bit('trail', s.x, s.y);
    }
    this.stars = this.stars.filter(s => s.x > -0.1 && s.x < 1.1 && s.y < GROUND - 0.02 && !s.gone);
    this.spawn -= dt;
    if (this.spawn <= 0 && this.stars.filter(s => !s.gold).length < this.target()){
      this.spawn = this.t >= FINALE ? 0.25 : 1.2; this._star();
    }
    if (this.t >= this.nextGold && this.t < FINALE){
      this.nextGold = this.t + 35 + Math.random() * 25;
      this._star(true); sfx.whoosh();
    }
  }

  /* The places that catch: each glove and helmet, wherever the body has
     floated to. */
  _catchers(){
    const out = [];
    for (let i = 0; i < this.players; i++){
      const lm = this._lm(i);
      if (!lm) continue;
      const lift = this.bodies[i].lift;
      for (const k of [L.L_WRIST, L.R_WRIST, L.NOSE]) out.push({ who: i, x: lm[k].x, y: lm[k].y - lift });
    }
    return out;
  }

  _catch(W, H){
    const by = this._catchers();
    for (const s of this.stars){
      const hit = by.find(p => Math.hypot((p.x - s.x) * W / H, p.y - s.y) < CATCH * (s.gold ? 1.3 : 1));
      if (!hit) continue;
      s.gone = true;
      this.caught += s.gold ? GOLD_WORTH : 1;
      this.lastCatch = this.t;
      for (let k = 0; k < 8; k++) this._bit('spark', s.x, s.y);
      for (let n = 0; n < (s.gold ? GOLD_WORTH : 1); n++){
        /* Each star is promised a place as it's caught. Once the picture has
           all it needs, extras still fly up to it and burst into sparkles. */
        const slot = this.cur.lit + this.cur.coming, spare = slot >= this.cur.shape.pts.length;
        this.flying.push({ x: s.x, y: s.y, from: { x: s.x, y: s.y }, t: -n * 0.15, gold: s.gold, slot, spare });
        if (!spare) this.cur.coming++;
      }
      sfx.firefly(this.cur.lit + this.cur.coming);
    }
    this.stars = this.stars.filter(s => !s.gone);
  }

  _stepFlying(dt){
    for (const f of this.flying){
      f.t += dt;
      const u = clamp(f.t / FLY, 0, 1);
      const slot = f.spare ? { x: SKY.x, y: SKY.y } : this._slot(f.slot);
      const e = u * u * (3 - 2 * u);
      f.x = f.from.x + (slot.x - f.from.x) * e;
      f.y = f.from.y + (slot.y - f.from.y) * e - Math.sin(u * Math.PI) * 0.08;
      if (u >= 1 && !f.done){
        f.done = true;
        if (f.spare){ for (let k = 0; k < 6; k++) this._bit('spark', f.x, f.y); continue; }
        this.cur.coming--;
        if (this.cur.lit < this.cur.shape.pts.length) this.cur.lit++;
        if (this.cur.lit === this.cur.shape.pts.length && !this.cur.done){ this.cur.done = 0.001; sfx.lantern(); }
      }
    }
    this.flying = this.flying.filter(f => !f.done);
  }

  /* Where star n of the picture being made sits, as screen fractions. */
  _slot(n){
    const pts = this.cur.shape.pts, [px, py] = pts[Math.min(n, pts.length - 1)];
    return { x: SKY.x + px * SKY.r * 1.1 * (9 / 16), y: SKY.y + py * SKY.r };
  }

  _stepPicture(dt){
    const cur = this.cur;
    if (!cur.done) return;
    cur.done = Math.min(1, cur.done + dt / 1.2);
    cur.shownFor += dt;
    if (cur.shownFor >= SHOW){
      /* Up to the gallery it goes, and a new picture begins. */
      this.made.push({ shape: cur.shape, x: GALLERY[this.made.length % GALLERY.length], age: 0 });
      this.cur = this._shape(cur.k + 1);
    }
  }

  /* The friend bounces up beside the children to show how, when stars have
     been drifting by uncaught for a while. It only shows; the catching is
     theirs. */
  _stepHelper(dt){
    const someone = pose.players.slice(0, this.players).some(p => p.present);
    const h = this.helper, idle = someone && this.t - this.lastCatch > HINT_AFTER && !this.out;
    if (h.lift > 0 || h.vy > 0){
      h.lift += h.vy * dt; h.vy -= GRAVITY * dt;
      if (h.lift <= 0){ h.lift = 0; h.vy = 0; }
    } else if (idle && (h.beat -= dt) <= 0){
      h.beat = 1.2; h.vy = Math.sqrt(2 * GRAVITY * 0.3);
      sfx.boing(2);
    }
  }

  get helping(){ return this.helper.lift > 0; }

  _bit(kind, x, y){
    const a = Math.random() * 6.28;
    const b = { kind, x, y, age: 0, life: 0.8, vx: 0, vy: 0 };
    if (kind === 'spark'){ b.vx = Math.cos(a) * 0.08; b.vy = Math.sin(a) * 0.12; }
    if (kind === 'dust'){ b.vx = (Math.random() - 0.5) * 0.1; b.vy = -0.02 - Math.random() * 0.03; b.life = 1.2; }
    if (kind === 'trail'){ b.life = 0.6; }
    if (kind === 'jet'){ b.vx = (Math.random() - 0.5) * 0.03; b.vy = 0.12 + Math.random() * 0.06; b.life = 0.55; }
    this.bits.push(b);
    if (this.bits.length > 300) this.bits.shift();
  }
  _stepBits(dt){
    for (const b of this.bits){ b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    this.bits = this.bits.filter(b => b.age < b.life);
  }

  /* ---------- the ending ---------- */

  /* Every picture made lights up together, and the astronauts float up one
     last time to wave at them. */
  outro(dt, W, H){
    if (!this.out){ this.out = { t: 0 }; sfx.lantern(); }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.faces.step(dt);
    /* Everyone drifts gently up off the moon and hangs there, bobbing,
       under the sky they made. */
    this.bodies.forEach((b, i) => {
      b.air = false; b.vy = 0;
      b.lift += (0.14 + Math.sin(o.t * 1.8 + i) * 0.025 - b.lift) * Math.min(1, dt * 1.5);
    });
    this._stepFlying(dt);
    this._stepPicture(dt);
    for (const m of this.made) m.age += dt;
    if (Math.random() < dt * 20) this._bit('spark', Math.random(), Math.random() * 0.5);
    if (Math.floor(o.t * 3) !== Math.floor((o.t - dt) * 3) && o.t < 4) sfx.twinkle();
    this._stepBits(dt);
    return o.t > 6;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    drawMoon(c, W, H, this.t);
    const glowUp = this.out ? Math.min(1, this.out.t / 1.5) : 0;
    const n = this.made.length;
    this.made.forEach((m, i) => {
      const k = Math.min(1, m.age / 1.5), e = k * k * (3 - 2 * k);
      let x = SKY.x + (m.x - SKY.x) * e, y = SKY.y + (0.08 - SKY.y) * e, r = SKY.r * (1 - 0.62 * e);
      if (glowUp){
        /* At the end, every picture spreads out in an arc across the sky. */
        const u = n === 1 ? 0.5 : i / (n - 1), ax = 0.1 + 0.8 * u, ay = 0.13 + 0.12 * Math.pow(2 * u - 1, 2);
        const g = glowUp * glowUp * (3 - 2 * glowUp);
        x += (ax - x) * g; y += (ay - y) * g; r += (Math.min(SKY.r * 0.75, 0.55 / Math.max(1, n)) - r) * g;
      }
      drawConstellation(c, m.shape, x * W, y * H, r * H, m.shape.pts.length, 1, this.t + i, 0.9 + 0.1 * glowUp);
    });
    if (!glowUp || this.cur.lit) drawConstellation(c, this.cur.shape, SKY.x * W, SKY.y * H, SKY.r * H, this.cur.lit, this.cur.done, this.t, 1 - glowUp * 0.6);

    for (const s of this.stars) drawStar(c, s.x * W, (s.y + Math.sin(s.age * 1.6 + s.ph) * 0.01) * H, H * (s.gold ? 0.032 : 0.026), this.t + s.ph, s.gold);
    this._drawBits(c, W, H);
    for (const f of this.flying) drawStar(c, f.x * W, f.y * H, H * 0.022, this.t, f.gold);

    if (this.helper.lift > 0) this._drawHelper(c, W, H);
    for (let i = this.players - 1; i >= 0; i--) this._drawBody(c, i, W, H);
  }

  _drawBody(c, i, W, H){
    const lm = this._lm(i);
    if (!lm) return;
    const b = this.bodies[i];
    /* A soft shadow on the ground that shrinks as they float higher. */
    const fx = (lm[L.L_ANKLE].x + lm[L.R_ANKLE].x) / 2 * W, fy = Math.max(lm[L.L_ANKLE].y, lm[L.R_ANKLE].y) * H;
    const k = 1 - Math.min(1, b.lift / PEAK) * 0.6;
    c.fillStyle = `rgba(40,30,80,${0.35 * k})`;
    c.beginPath(); c.ellipse(fx, fy + H * 0.01, H * 0.07 * k, H * 0.015 * k, 0, 0, 6.2832); c.fill();
    b.head = drawAstronaut(c, lm, W, H, b.lift, PLAYER_COLORS[i], (x, y, r) => {
      if (this.faces.has(i)) this.faces.draw(c, i, x, y, r);
      else drawKid(c, x, y + r * 0.1, r, this.t + i, i ? '#c98f6a' : '#e9b892');
    });
  }

  _drawHelper(c, W, H){
    const x = 0.12 * W, ground = (GROUND + 0.02 - this.helper.lift) * H;
    friend(c, x, ground, H * 0.75, this.t, true);
    /* A bubble helmet over the friend. */
    const r = H * 0.075, y = ground - H * 0.08;
    c.strokeStyle = 'rgba(220,240,255,.8)'; c.lineWidth = H * 0.006;
    c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
    c.fillStyle = 'rgba(200,235,255,.12)'; c.fill();
  }

  _drawBits(c, W, H){
    for (const b of this.bits){
      const k = b.age / b.life;
      if (b.kind === 'dust'){ c.fillStyle = `rgba(210,205,235,${0.6 * (1 - k)})`; c.beginPath(); c.arc(b.x * W, b.y * H, H * (0.008 + k * 0.012), 0, 6.2832); c.fill(); }
      else if (b.kind === 'jet'){ c.fillStyle = `rgba(170,230,255,${0.7 * (1 - k)})`; c.beginPath(); c.arc(b.x * W, b.y * H, H * (0.01 + k * 0.012), 0, 6.2832); c.fill(); }
      else if (b.kind === 'trail'){ c.fillStyle = `rgba(255,180,220,${0.7 * (1 - k)})`; c.beginPath(); c.arc(b.x * W, b.y * H, H * 0.008 * (1 - k), 0, 6.2832); c.fill(); }
      else { c.fillStyle = `rgba(255,236,150,${1 - k})`; c.beginPath(); c.arc(b.x * W, b.y * H, H * 0.006, 0, 6.2832); c.fill(); }
    }
  }

  /* Cooperative: nothing to show but the clock. */
  hud(){ return { score: [this.caught, this.caught], showLives: false, hideScore: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) rows.push({ label: `Player ${i + 1}`, value: this.caught, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.players < 2 ? null : -1; }
  value(){ return this.caught; }
}
