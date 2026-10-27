import { clamp } from './common.js';
import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { JumpWatch } from '../tracking/jump.js';
import { WaveWatch, handsFrom } from '../tracking/wave.js';
import { drawKid, drawPup } from './fire-truck-art.js';
import { SLED, P, drawSlope, edgeTrees, pine, present, balloonPresent, ramp, drift, friendBySlope,
         drawSled, cabin, GIFT_COLOURS } from './snow-art.js';

/* Snow Sled. The children ride a wooden sled down a wide, sunny snow run,
   side by side and turned round grinning at us - their real faces, in knit
   hats in their colours. The run rushes up toward the horizon and things
   come down it toward them:

   - presents, glowing in the snow: steer through them to scoop them up,
     and they pile into the sack behind;
   - presents tied to balloons, floating a little off the snow: jump, and
     the sled hops up to catch them;
   - snow ramps: hit one and the sled flies;
   - soft snowdrifts: nothing bad, the sled just puffs through them and
     slows a moment;
   - penguins, snowmen and foxes beside the run, who wave back when you
     wave at them.

   Steering is leaning: both children lean left and the sled goes left; one
   leaning alone moves it halfway. No words, no scores; if presents keep
   going by uncaught, a glowing trail in the snow shows the way to the next.
   At the bottom of the hill is a cabin with a tree, and every present
   collected goes under it. */

export const ROUND = 300;
export const FINALE = ROUND - 10;
export const OPENING = 30;
export const REACH = 0.3;                 /* lanes: how near something must pass to be caught or hit */
export const LEAN = 0.35;                 /* torso-widths of lean for a full turn */
export const HOP = 0.12, FLIGHT = 0.3;    /* screen heights: a jump's hop, a ramp's flight */
const GRAVITY = 2.2;
export const HINT_AFTER = 8;
const FRIENDS = ['penguin', 'snowman', 'fox'];

export default {
  id: 'snow-sled', name: 'Snow Sled', stars: 1, accent: '#7fc8ff', secs: ROUND,
  create(n){ return new SnowSled(n); }
};

class SnowSled {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false;
    this.z = 0; this.v = 0.12;
    this.lane = 0; this.lean = 0;
    this.air = 0; this.airV = 0;
    this.things = [];
    this.nextRow = 0.35; this.nextFriend = 0.5;
    this.presents = 0;
    this.lastGot = 0;
    this.bits = [];
    this.faces = new FaceCam();
    this.jumps = new JumpWatch();
    this.wave = new WaveWatch();
    this.out = null;
  }

  /* ---------- what comes down the hill ---------- */

  speed(){
    if (this.t >= FINALE) return 0.2;
    if (this.t < OPENING) return 0.12;
    return 0.13 + 0.05 * (this.t - OPENING) / (FINALE - OPENING);
  }

  _add(kind, rel, lane, extra = {}){
    const th = { kind, z: this.z + rel, lane, col: GIFT_COLOURS[(Math.random() * GIFT_COLOURS.length) | 0], done: false, wave: 0, poof: 0, ...extra };
    this.things.push(th);
    return th;
  }

  _plan(){
    while (this.nextRow < this.z + 1.05){
      const rel = this.nextRow - this.z, lanes = [-0.65, 0, 0.65], pickLane = () => lanes[(Math.random() * 3) | 0];
      if (this.t >= FINALE){
        /* The last stretch: a shower of presents in every lane. */
        for (const l of lanes) this._add('present', rel, l);
        this.nextRow += 0.09;
      } else if (this.t < OPENING){
        this._add('present', rel, pickLane());
        this.nextRow += 0.2;
      } else {
        const r = Math.random(), lane = pickLane();
        if (r < 0.45) this._add('present', rel, lane);
        else if (r < 0.62){ this._add('drift', rel, lane); if (Math.random() < 0.6) this._add('present', rel, lanes.find(l => l !== lane)); }
        else if (r < 0.77){
          /* A ramp, with presents on balloons to fly through after it. */
          this._add('ramp', rel, lane);
          this._add('balloon', rel + 0.06, lane); this._add('balloon', rel + 0.1, lane);
        } else this._add('balloon', rel, lane);
        this.nextRow += 0.13 + Math.random() * 0.08;
      }
    }
    while (this.nextFriend < this.z + 1.05){
      const side = Math.random() < 0.5 ? -1 : 1;
      this._add('friend', this.nextFriend - this.z, side * 1.25, { who: FRIENDS[(Math.random() * FRIENDS.length) | 0] });
      this.nextFriend += 0.45 + Math.random() * 0.3;
    }
  }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    this.t += dt;
    this.faces.step(dt);
    this._steer(dt, W, H);
    this._hop(dt, true);
    this.v += (this.speed() - this.v) * Math.min(1, dt * 1.5);
    this.z += this.v * dt;
    this._plan();
    this._meet();
    this._waves(dt);
    this._stepBits(dt);
  }

  /* How far a child leans, -1 left to 1 right: shoulders over hips, in
     shoulder-widths. With the mouse, where it is across the screen. */
  leanOf(i, W, H){
    const p = pose.players[i];
    if (!p.present) return null;
    if (pose.mouse.active) return clamp((p.hands.right.x - 0.5) * 2.5, -1, 1);
    const lm = p.lm;
    if (!lm) return null;
    const sx = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2, hx = (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2;
    const sw = Math.abs(lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x) || 0.05;
    return clamp((sx - hx) / sw / LEAN, -1, 1);
  }

  _steer(dt, W, H){
    const leans = [];
    for (let i = 0; i < this.players; i++){ const l = this.leanOf(i, W, H); if (l != null) leans.push(l); }
    const want = leans.length ? leans.reduce((a, b) => a + b, 0) / leans.length : 0;
    const before = this.lane;
    this.lane += (want - this.lane) * Math.min(1, dt * 3);
    this.lean = (this.lane - before) / Math.max(dt, 1e-3) * 0.4;
  }

  _hop(dt, canJump){
    if (canJump && this.jumps.step(dt, pose.players, this.players).length && this.air === 0){
      this.airV = Math.sqrt(2 * GRAVITY * HOP); sfx.boing(2);
    }
    if (this.air > 0 || this.airV > 0){
      this.air += this.airV * dt; this.airV -= GRAVITY * dt;
      if (this.air <= 0){ this.air = 0; this.airV = 0; sfx.land(); this._snow(14); }
    }
  }

  /* Whatever reaches the sled: caught, hit, flown over or passed by. */
  _meet(){
    /* An empty sled still slides, but nothing is gathered without a rider. */
    const someone = pose.players.slice(0, this.players).some(p => p.present);
    for (const th of this.things){
      const rel = th.z - this.z;
      if (th.done || rel > SLED) continue;
      th.done = true;
      if (th.kind === 'friend') continue;
      const near = Math.abs(th.lane - this.lane) < REACH;
      if (!near || !someone) continue;
      if (th.kind === 'present' && this.air < 0.06) this._got(th);
      else if (th.kind === 'balloon' && this.air > 0.05) this._got(th, true);
      else if (th.kind === 'ramp' && this.air < 0.04){ this.airV = Math.sqrt(2 * GRAVITY * FLIGHT); this.air = 0.001; sfx.liftoff(); }
      else if (th.kind === 'drift' && this.air < 0.03){ th.poof = 1; this.v *= 0.7; sfx.whoosh(); this._snow(30); }
    }
    this.things = this.things.filter(th => th.z - this.z > -0.08);
  }

  _got(th, high = false){
    th.got = true;
    this.presents++;
    this.lastGot = this.t;
    sfx.jar(this.presents);
    if (high) sfx.pop(0.3);
    for (let k = 0; k < 10; k++) this.bits.push({ kind: 'spark', x: 0.5 + this.lane * 0.32, y: 0.75 - this.air, vx: (Math.random() - 0.5) * 0.3, vy: -0.2 - Math.random() * 0.3, age: 0, life: 0.8 });
  }

  /* Wave at a friend by the run and they wave back. */
  _waves(dt){
    for (const th of this.things) th.wave = Math.max(0, th.wave - dt * 0.7);
    if (!this.wave.step(dt, handsFrom(pose))) return;
    this.wave.meter = 0; this.wave.turns = 0;
    const f = this.things.filter(th => th.kind === 'friend' && th.z - this.z > 0.05 && th.z - this.z < 0.6).sort((a, b) => a.z - b.z)[0];
    if (!f) return;
    if (f.wave < 0.5) (f.who === 'penguin' ? sfx.squeak : sfx.twinkle)();
    f.wave = 1; f.waved = true;
  }

  get waving(){ return this.things.some(th => th.wave > 0); }

  _snow(n){
    for (let k = 0; k < n; k++){
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      this.bits.push({ kind: 'snow', x: 0.5 + this.lane * 0.32 + (Math.random() - 0.5) * 0.2, y: 0.9, vx: Math.cos(a) * 0.25, vy: Math.sin(a) * 0.35, age: 0, life: 0.9 });
    }
    if (this.bits.length > 300) this.bits.splice(0, this.bits.length - 300);
  }
  _stepBits(dt){
    for (const b of this.bits){ b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 0.9 * dt; }
    this.bits = this.bits.filter(b => b.age < b.life);
    /* A steady spray off the back of the sled while it's on the snow. */
    if (this.air === 0 && Math.random() < dt * 30) this._snow(1);
  }

  /* ---------- the ending: the cabin at the bottom of the hill ---------- */

  outro(dt, W, H){
    if (!this.out){ this.out = { t: 0 }; this.things = this.things.filter(th => th.kind === 'friend'); }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.faces.step(dt);
    this.v += ((o.t < 3 ? 0.1 * (1 - o.t / 3) : 0) - this.v) * Math.min(1, dt * 2);
    this.z += this.v * dt;
    this.lane += (0 - this.lane) * Math.min(1, dt * 2);
    this._hop(dt, false);
    if (o.t > 3 && Math.floor(o.t * 4) !== Math.floor((o.t - dt) * 4) && o.t < 5) sfx.jar(Math.floor(o.t * 4));
    if (o.t > 3 && !o.cheered){ o.cheered = true; sfx.hooray(); }
    this._stepBits(dt);
    return o.t > 7;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    drawSlope(c, W, H, this.z);
    if (this.out){
      /* The cabin slides up out of the distance as the sled comes to it. */
      const k = Math.min(1, this.out.t / 3), e = 1 - (1 - k) * (1 - k);
      const p = P(0.35, 0.7 - 0.52 * e, W, H);
      cabin(c, p.x, p.y, H * 0.42 * p.k, this.t, this.out.t > 3 ? this.presents : 0);
    }
    const list = [...edgeTrees(this.z), ...this.things.map(th => ({ ...th, rel: th.z - this.z, ref: th }))];
    list.sort((a, b) => b.rel - a.rel);
    for (const th of list){
      if (th.rel > 1 || th.rel < -0.08 || th.got) continue;
      const p = P(th.lane, th.rel, W, H);
      if (th.kind === 'pine') pine(c, p.x, p.y, H * 0.38 * p.k * th.size);
      else if (th.kind === 'present') present(c, p.x, p.y, H * 0.09 * p.k, th.col, this.t + th.z * 10);
      else if (th.kind === 'balloon') balloonPresent(c, p.x, p.y, H * 0.08 * p.k, th.col, this.t + th.z * 10, H * 0.1 * p.k);
      else if (th.kind === 'ramp') ramp(c, p.x, p.y, p.k, W, H);
      else if (th.kind === 'drift') drift(c, p.x, p.y, p.k, H, th.ref.poof ? 0.5 : 0);
      else if (th.kind === 'friend') friendBySlope(c, th.who, p.x, p.y, p.k, H, this.t, th.ref.wave);
    }
    if (!this.out && this.t - this.lastGot > HINT_AFTER) this._drawTrail(c, W, H);
    for (const b of this.bits){
      const k = b.age / b.life;
      c.fillStyle = b.kind === 'spark' ? `rgba(255,236,150,${1 - k})` : `rgba(255,255,255,${0.9 * (1 - k)})`;
      c.beginPath(); c.arc(b.x * W, b.y * H, H * (b.kind === 'spark' ? 0.007 : 0.008 + k * 0.006), 0, 6.2832); c.fill();
    }
    const riders = [0, 1].map(i => ({ coat: PLAYER_COLORS[i], trim: i ? '#ffd24a' : '#e8413c' }));
    drawSled(c, W * (0.5 + this.lane * 0.32), H * 0.9, W, H, {
      t: this.t, air: this.air, lean: clamp(this.lean, -1, 1), presents: this.presents, riders,
      cheer: (this.out && this.out.t > 3) || this.air > 0.1 || this.t - this.lastGot < 0.6,
      face: (i, x, y, r) => this._face(c, i, x, y, r)
    });
  }

  /* Who sits where: one child each side; on their own, the left seat is
     theirs and the dalmatian rides on the right. */
  _face(c, seat, x, y, r){
    const who = this.players >= 2 ? (pose.players[seat].present ? seat : -1) : (seat === 0 && pose.players[0].present ? 0 : -1);
    if (who < 0){ drawPup(c, x, y + r * 0.1, r * 0.95, this.t + seat); return; }
    if (this.faces.has(who)) this.faces.draw(c, who, x, y, r);
    else drawKid(c, x, y + r * 0.08, r * 0.95, this.t + who, who ? '#c98f6a' : '#e9b892');
  }

  /* A glowing trail in the snow from the sled to the next present, once a
     few have gone by uncaught. */
  _drawTrail(c, W, H){
    const next = this.things.filter(th => th.kind === 'present' && !th.done && th.z - this.z > 0.1 && th.z - this.z < 0.7).sort((a, b) => a.z - b.z)[0];
    if (!next || Math.abs(next.lane - this.lane) < REACH * 0.6) return;
    const rel = next.z - this.z;
    for (let k = 0; k <= 12; k++){
      const u = k / 12, p = P(this.lane + (next.lane - this.lane) * u * u * (3 - 2 * u), SLED + (rel - SLED) * u, W, H);
      const a = 0.5 + 0.5 * Math.sin(this.t * 6 - k * 0.8);
      c.fillStyle = `rgba(255,226,120,${0.25 + 0.5 * a})`;
      c.beginPath(); c.ellipse(p.x, p.y, H * 0.014 * p.k, H * 0.006 * p.k, 0, 0, 6.2832); c.fill();
    }
  }

  get trail(){ return this.t - this.lastGot > HINT_AFTER; }

  /* Cooperative: nothing to show but the clock. */
  hud(){ return { score: [this.presents, this.presents], showLives: false, hideScore: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) rows.push({ label: `Player ${i + 1}`, value: this.presents, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.players < 2 ? null : -1; }
  value(){ return this.presents; }
}
