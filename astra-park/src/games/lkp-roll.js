/* Last Known Position - the sleepy roll, just after the sneak in level 1.

   Past Zubu, safe... and she rolls over in her sleep, right off the top
   of the hill, and down it comes after them: curled up in a great soft
   ball, still fast asleep, still snoring, still smiling. Nobody's in
   trouble - she just happens to be rolling the same way they're going.

   Its own view, looking back up the hill: the crew big at the bottom of
   the screen, facing us, running down towards the camera; the hill
   climbing away behind them to the top of the screen, and Zubu up there,
   bouncing down it - in and out of view as she bounces and drifts
   nearer and further, the camera shaking each time she lands (more, the
   closer she is). Logs, boulders and big fruit she's knocked loose roll
   down past the crew too, and crystals shaken out of her garden.

     in     a moment to see it: she tips off the top and starts rolling
     run    RUN! Running on the spot - the team's average - keeps ahead of
            her; stand still and she gains. If she catches up: a big soft
            BOING, she bounces off them and back up the hill a way. Lean
            (or hop) out of the way of whatever's rolling down: bumped is
            only a BOING too. Lean into the crystals for them.
     stop   the hill levels out into a meadow; she rolls slower and
            slower, rocks to a stop - and snores on. Nobody's hurt; nothing
            ever is.

   Distances are up the hill from the crew (R): 0 is where they run, more
   is further up, a little less than 0 is right by the camera. */
import { pose } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MarchWatch } from '../tracking/gestures.js';
import { drawCrystal, PAL } from './lkp-art.js';
import { treeKind, kindOf, glow, mix } from './lkp-world.js';
import { ZUBU, snoreWord, SNORE, drawZubuBall } from './lkp-zubu.js';
import { banner, smooth } from './lkp-zip.js';

/* Seconds: the moment to see her start; the run; rolling to a stop. */
export const IN = 3, ROLL = 30, STOP = 6;
/* How far up the hill she is to start with (distances), as close as she
   gets before the BOING, and where that bounces her back to; how far she
   can drop behind. */
export const START = 3.6, NEAR = 0.85, BACK = 1.8, FAR = 4.5;
/* How fast she gains on them (distances a second), and how fast running
   all-out pulls them away. */
export const GAIN = 0.16, PULL = 0.3;
/* Things rolling down: every so often (seconds), and how wide each is
   (lanes either side of its middle). */
const EVERY = [1.4, 2.4];
const WIDE = { log: 0.42, rock: 0.2, fruit: 0.17, gem: 0.2 };
const KINDS = ['log', 'rock', 'gem', 'fruit', 'gem', 'rock', 'log', 'gem', 'fruit'];

/* Looking up the hill: the crew's feet low on the screen; the top of the
   hill near the top. */
const TOP = 0.13, FEET = 0.9, PERSP = 0.9, HALF = 0.36;
export function R(lane, dist, W, H){
  const k = 1 / (1 + Math.max(-0.45, dist) * PERSP);
  return { x: W * (0.5 + lane * HALF * k), y: H * (TOP + (FEET - TOP) * k), k };
}
/* How big the crew are, at the front. */
export const CREW_H = 0.3;

const rand = ([a, b]) => a + Math.random() * (b - a);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export class Roll {
  constructor(game, talk = false, len = ROLL){
    this.g = game; this.talk = talk; this.len = len;
    this.t = 0; this.pt = 0; this.phase = 'in'; this.done = false; this.clearT = 0;
    this.gap = START; this.spin = 0; this.hop = 0; this.hopV = 0; this.shake = 0;
    this.team = 0; this.pace = 0; this.slide = 0;   /* how far down the hill they've come, for the scenery */
    this.mw = pose.players.map(() => new MarchWatch());
    this.march = pose.players.map(() => 0);
    this.rolling = [];
    this.next = 1.2; this.bonks = 0; this.count = 0; this.petals = [];
    this.fade = 0;
  }
  _say(key){ const l = this.g.level.lines[key]; if (l && this.talk) this.g.captain.say(l[0][1], l[0][2] || ''); }

  /* How fast they're running (the game's speed): on the spot, and to a
     stop at the end. */
  speed(run){
    if (this.phase === 'stop') return run * this.pace * (1 - smooth(this.pt / 2));
    if (this.done) return 0;
    return run * this.pace;
  }
  /* How far up the hill she looks: where she is, drifting nearer and further. */
  get dist(){ return this.gap + (this.phase === 'run' ? 0.35 * Math.sin(this.t * 0.6) : 0); }

  step(dt, W = 1920, H = 1080){
    const g = this.g;
    this.t += dt; this.pt += dt; this.fade = Math.min(1, this.fade + dt * 2);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.done){ this.clearT += dt; return; }
    const here = g.here;
    for (const i of here) this.march[i] = g.marchOf ? g.marchOf(i, dt) : this.mw[i].step(pose.players[i], dt, pose.mouse.active);
    this.team = here.length ? here.reduce((s, i) => s + this.march[i], 0) / here.length : 0;
    /* (their legs going: a jog at least, running, quicker the harder they run) */
    const want = this.phase === 'stop' ? 0 : 0.45 + 0.55 * this.team;
    this.pace += (want - this.pace) * Math.min(1, dt * 3);
    this.slide += dt * (0.4 + 0.8 * this.pace) * (this.phase === 'stop' ? 1 - smooth(this.pt / 3) : 1);

    /* her roll: spinning, bouncing - each landing a thump and a shake */
    const roll = this.phase === 'stop' ? 1 - smooth(this.pt / (STOP * 0.6)) : 1;
    /* (rolling to a stop face up - her sleepy face towards us) */
    if (this.phase === 'stop' && this.rest != null) this.spin += (this.rest - this.spin) * Math.min(1, dt * 1.5);
    else this.spin += dt * 2.6 * roll;
    this.hopV -= dt * 9; this.hop += this.hopV * dt;
    if (this.hop <= 0){
      this.hop = 0;
      if (roll > 0.15){
        const near = 1 / (1 + this.dist * PERSP);
        this.hopV = (2.2 + 1.2 * hash(Math.floor(this.t * 3))) * roll;
        this.shake = Math.min(1, this.shake + near * 1.6 * roll);
        sfx.farStep?.(0.4 + near * 1.4 * roll);
        this._petals(W, H, 4);
      } else this.hopV = 0;
    }

    if (this.phase === 'in'){
      if (this.pt >= IN){ this.phase = 'run'; this.pt = 0; this._say('rollStart'); }
    } else if (this.phase === 'run'){
      /* she gains, they pull away */
      this.gap = Math.min(FAR, this.gap + (PULL * this.team - GAIN) * dt);
      if (this.gap <= NEAR) this._bonk(W, H);
      /* things she's knocked loose, rolling down */
      this.next -= dt;
      if (this.next <= 0 && this.pt < this.len - 4){
        this.next = rand(EVERY);
        const kind = KINDS[this.count++ % KINDS.length];
        const lane = kind === 'log' ? (hash(this.t) - 0.5) * 0.8 : (hash(this.t * 3.1) * 2 - 1) * 0.85;
        this.rolling.push({ kind, lane, dist: this.dist - 0.1, v: kind === 'gem' ? 0.9 : 1.05 + hash(this.t * 7) * 0.3, spin: 0, up: 0, upV: 2, passed: false, n: this.count });
      }
      if (this.pt >= this.len){ this.phase = 'stop'; this.pt = 0; this.rest = Math.ceil(this.spin / (Math.PI * 2) + 0.4) * Math.PI * 2; this._say('rollEnd'); }
    } else if (this.phase === 'stop'){
      /* rolling to a stop, a little way behind them */
      this.gap += (2.3 - this.gap) * Math.min(1, dt * 0.8);
      if (this.pt >= STOP) this.done = true;
    }

    for (const th of this.rolling){
      th.dist -= th.v * dt; th.spin += th.v * dt * (th.kind === 'log' ? 5 : 3.5);
      th.upV -= dt * 8; th.up += th.upV * dt;
      if (th.up <= 0){ th.up = 0; th.upV = th.kind === 'gem' ? 2.2 : th.kind === 'log' ? 0.6 : 1.4; }
      if (!th.passed && th.dist <= 0){ th.passed = true; this._pass(th, W, H); }
    }
    this.rolling = this.rolling.filter(th => th.dist > -0.5 && !th.got);
    for (const p of this.petals){ p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 0.25; p.age += dt; }
    this.petals = this.petals.filter(p => p.age < p.life);
  }

  /* Something rolling past the crew: a crystal, theirs if they're in its
     way; anything else, a soft BOING for whoever's in its way (unless
     they hopped it). */
  _pass(th, W, H){
    const g = this.g;
    for (const i of g.here){
      const rn = g.crew[i];
      if (Math.abs(rn.x - th.lane) > WIDE[th.kind] + 0.12) continue;
      const p = R(rn.x, 0, W, H);
      if (th.kind === 'gem'){
        if (th.got) continue;
        th.got = true; g.gain(3, p.x / W, (p.y - H * 0.2) / H); sfx.jar(1 + (g.crystals % 8)); g._sparkle(p.x / W, (p.y - H * 0.2) / H, 8, 185);
        continue;
      }
      if (rn.air > 0.25 || rn.safe > 0) continue;
      rn.safe = 1; this.bonks++;
      g.bits.push({ kind: 'num', x: p.x / W, y: (p.y - H * 0.34) / H, vy: -0.08, age: 0, life: 0.9, text: 'BOING!', col: '#ffffff' });
      g._sparkle(p.x / W, (p.y - H * 0.2) / H, 6, 140);
      sfx.boing(1 + i * 0.2);
    }
  }
  /* She's caught up: a great soft BOING off them, and she bounces back up
     the hill. */
  _bonk(W, H){
    const g = this.g;
    this.gap = BACK; this.hopV = 4; this.hop = Math.max(this.hop, 0.01); this.shake = 1; this.bonks++;
    for (const i of g.here) g.crew[i].safe = Math.max(g.crew[i].safe, 0.8);
    g.bits.push({ kind: 'num', x: 0.5, y: 0.3, vy: -0.06, age: 0, life: 1.2, text: 'BOOOING!', col: '#ffe39a' });
    sfx.boing(0.6); sfx.thud();
    this._petals(W, H, 14);
  }
  /* petals and leaves knocked off her garden */
  _petals(W, H, n){
    const z = this._zubuAt(W, H);
    for (let k = 0; k < n; k++){
      const a = Math.random() * Math.PI * 2;
      this.petals.push({ x: (z.x + Math.cos(a) * z.r) / W, y: (z.y - z.r * 0.6 * Math.random()) / H, vx: (Math.random() - 0.5) * 0.25, vy: -0.1 - Math.random() * 0.15, age: 0, life: 1.4 + Math.random(), col: [ZUBU.bloom, '#fff3d6', ZUBU.moss[0], '#ffe39a', ZUBU.moss[2]][k % 5], r: 0.006 + Math.random() * 0.006, spin: Math.random() * 6 });
    }
  }
  /* where she is on the screen, and how big */
  _zubuAt(W, H){
    const p = R(0, this.dist, W, H), r = H * 1.05 * p.k;
    return { x: p.x + Math.sin(this.t * 0.45) * W * 0.06 * p.k, y: p.y - r * 0.92 - this.hop * H * 0.6 * p.k, r, k: p.k };
  }

  /* ---------- drawing ---------- */

  draw(c, W, H, drawCrew){
    const g = this.g, L = PAL.world;
    c.save();
    /* her landings: the camera shaking */
    if (this.shake > 0){ const s = this.shake * this.shake * H * 0.025; c.translate(Math.sin(this.t * 61) * s, Math.cos(this.t * 47) * s * 0.8); }
    /* stopped: the camera easing back, to see all of her, snoring on */
    const back = this.phase === 'stop' || this.done ? smooth((this.phase === 'stop' ? this.pt : STOP) / 3) * 0.32 : 0;
    if (back > 0){ c.translate(W / 2, H); c.scale(1 - back, 1 - back); c.translate(-W / 2, -H); }
    this._hill(c, W, H, L);
    /* far to near: her, the scenery, what's rolling down, the crew */
    const items = [];
    const zb = this._zubuAt(W, H);
    items.push({ dist: this.dist, draw: () => this._zubu(c, W, H, zb) });
    for (const tr of this._trees()) items.push({ dist: tr.dist, draw: () => { const p = R(tr.lane, tr.dist, W, H); if (L) treeKind(c, p.x, p.y, H * 0.0011 * p.k * tr.s, tr.kind, L, Math.min(0.6, Math.max(0, tr.dist * 0.12)), tr.n); } });
    for (const th of this.rolling) items.push({ dist: th.dist, draw: () => this._thing(c, W, H, th) });
    const order = g.here.slice().sort((a, b) => g.crew[a].x - g.crew[b].x);
    items.push({ dist: 0, draw: () => { for (const i of order){ const rn = g.crew[i], p = R(rn.x, 0, W, H); drawCrew(i, p.x, p.y, H * CREW_H, 0); } } });
    items.sort((a, b) => b.dist - a.dist);
    for (const it of items) it.draw();
    /* petals, drifting down over everything */
    for (const p of this.petals){
      c.save(); c.globalAlpha = Math.max(0, 1 - p.age / p.life); c.fillStyle = p.col;
      c.translate(p.x * W, p.y * H); c.rotate(p.spin + p.age * 3); c.beginPath(); c.ellipse(0, 0, p.r * H, p.r * H * 0.5, 0, 0, 6.2832); c.fill(); c.restore();
    }
    c.restore();
    if (this.fade < 1){ c.fillStyle = `rgba(0,0,0,${1 - this.fade})`; c.fillRect(0, 0, W, H); }
  }

  /* The hill, climbing away behind them: sky over the top, grass, a path
     down the middle of it, tufts streaming up it as they run. */
  _hill(c, W, H, L){
    const sky = L ? L.sky : ['#4f9be0', '#8cc4ec', '#cfe6f5', '#ffe6c8'];
    const ground = L ? L.ground : ['#5aa391', '#3f8f78', '#2f7c66'], path = L ? L.path : ['#857a98', '#6c6083'], grass = L ? L.grass : ['#78c8a0', '#328c73'];
    const sg = c.createLinearGradient(0, 0, 0, H * TOP);
    sg.addColorStop(0, sky[0]); sg.addColorStop(1, sky[2]);
    c.fillStyle = sg; c.fillRect(-W * 0.3, -H * 0.6, W * 1.6, H * (TOP + 0.66));
    /* the crest of the hill: a soft curve */
    const gg = c.createLinearGradient(0, H * TOP, 0, H);
    gg.addColorStop(0, mix(ground[0], '#d6e6f2', 0.35)); gg.addColorStop(0.35, ground[0]); gg.addColorStop(1, ground[2]);
    c.fillStyle = gg; c.beginPath(); c.moveTo(-W * 0.3, H * (TOP + 0.03));
    for (let k = 0; k <= 16; k++){ const x = W * (-0.3 + k / 16 * 1.6); c.lineTo(x, H * (TOP + 0.012 * Math.sin(k * 1.3) + 0.02 * Math.abs(k - 8) / 8)); }
    c.lineTo(W * 1.3, H * 1.05); c.lineTo(-W * 0.3, H * 1.05); c.closePath(); c.fill();
    /* the path, wide at the front */
    const a = R(-0.75, 8, W, H), b = R(0.75, 8, W, H), d = R(0.75, -0.45, W, H), e = R(-0.75, -0.45, W, H);
    const pg = c.createLinearGradient(0, H * TOP, 0, H);
    pg.addColorStop(0, mix(path[0], '#d6e6f2', 0.4)); pg.addColorStop(1, path[1]);
    c.fillStyle = pg; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath(); c.fill();
    /* tufts, streaming up the hill as they come down it */
    c.lineCap = 'round';
    for (let n = 0; n < 60; n++){
      const along = ((hash(n) * 6 + this.slide) % 6) - 0.4, lane = (hash(n + 50) * 2 - 1) * 2.2;
      if (Math.abs(lane) < 0.85) continue;
      const p = R(lane, along, W, H), l = H * 0.03 * p.k;
      c.strokeStyle = grass[n % 2]; c.lineWidth = Math.max(1, H * 0.004 * p.k);
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - l * 0.3, p.y - l); c.moveTo(p.x, p.y); c.lineTo(p.x + l * 0.3, p.y - l * 0.9); c.stroke();
    }
    /* pebbles on the path */
    for (let n = 0; n < 24; n++){
      const along = ((hash(n + 200) * 6 + this.slide) % 6) - 0.4, lane = (hash(n + 260) * 2 - 1) * 0.65;
      const p = R(lane, along, W, H);
      c.fillStyle = 'rgba(60,50,80,.35)'; c.beginPath(); c.ellipse(p.x, p.y, H * 0.008 * p.k, H * 0.004 * p.k, 0, 0, 6.2832); c.fill();
    }
  }

  /* trees down both sides, going by - some knocked flat by her already */
  _trees(){
    const out = [];
    for (let n = 0; n < 14; n++){
      const side = n % 2 ? 1 : -1, dist = ((hash(n + 400) * 7 + this.slide * 0.8 + n * 0.5) % 7) - 0.5;
      const kind = ['pine', 'round', 'birch', 'umbrella', 'blossom', 'fir', 'puff'][Math.floor(hash(n + 9) * 7)] || kindOf(n);
      out.push({ lane: side * (1.6 + hash(n + 77) * 1.2), dist, kind, s: 0.8 + hash(n + 33) * 0.5, n });
    }
    return out;
  }

  /* Zubu: curled up in a ball, rolling down at them, fast asleep. */
  _zubu(c, W, H, zb){
    /* her shadow on the hill, staying on the ground as she bounces */
    const g = R(0, this.dist, W, H);
    c.fillStyle = 'rgba(20,40,30,.3)'; c.beginPath(); c.ellipse(zb.x, g.y, zb.r * (0.9 - Math.min(0.4, this.hop * 0.2)), zb.r * 0.16, 0, 0, 6.2832); c.fill();
    drawZubuBall(c, zb.x, zb.y, zb.r, this.spin, this.t, Math.max(0, 0.07 - this.hop * 0.5));
    /* the snore, floating up off her */
    const ph = (this.t % (SNORE / 2)) / (SNORE / 2), word = snoreWord(this.t);
    c.save(); c.globalAlpha = Math.sin(Math.min(1, ph * 1.15) * Math.PI);
    const fs = Math.round(H * (0.045 + 0.02 * ph));
    c.font = `700 ${fs}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const tx = zb.x + zb.r * 0.8 + W * 0.06, ty = Math.max(H * 0.22, zb.y - zb.r * 0.2 - ph * H * 0.08);
    c.lineWidth = fs * 0.18; c.strokeStyle = 'rgba(40,40,80,.55)'; c.strokeText(word, Math.min(W * 0.8, tx), ty);
    c.fillStyle = '#ffffff'; c.fillText(word, Math.min(W * 0.8, tx), ty);
    c.restore();
  }

  /* What's rolling down: a log (across the path), a mossy boulder, a big
     round fruit, or a crystal bouncing along. */
  _thing(c, W, H, th){
    const p = R(th.lane, th.dist, W, H), s = H * p.k, y = p.y - th.up * H * 0.05 * p.k;
    c.fillStyle = 'rgba(20,15,45,.3)'; c.beginPath(); c.ellipse(p.x, p.y, s * (WIDE[th.kind] * HALF * W / H), s * 0.02, 0, 0, 6.2832); c.fill();
    c.save(); c.translate(p.x, y);
    if (th.kind === 'log'){
      const w = WIDE.log * HALF * W * p.k, r = s * 0.055;
      c.fillStyle = '#7a5236'; c.beginPath(); c.roundRect(-w, -r * 2, w * 2, r * 2, r); c.fill();
      c.strokeStyle = '#4f3322'; c.lineWidth = Math.max(1, s * 0.004);
      /* its bark lines, turning as it rolls */
      for (let k = 0; k < 3; k++){ const v = ((th.spin / 6.2832 + k / 3) % 1) * r * 2; c.beginPath(); c.moveTo(-w + r * 0.5, -r * 2 + v); c.lineTo(w - r * 0.5, -r * 2 + v); c.stroke(); }
      for (const d of [-1, 1]){ c.fillStyle = '#e6c48e'; c.beginPath(); c.ellipse(d * w, -r, r * 0.45, r, 0, 0, 6.2832); c.fill(); c.strokeStyle = '#a07a4e'; c.beginPath(); c.ellipse(d * w, -r, r * 0.22, r * 0.5, 0, 0, 6.2832); c.stroke(); }
      /* a tuft of moss on top */
      c.fillStyle = ZUBU.moss[0]; c.beginPath(); c.ellipse(w * 0.2, -r * 2, r * 0.8, r * 0.3, 0, Math.PI, 0); c.fill();
    } else if (th.kind === 'rock'){
      const r = s * 0.075;
      c.rotate(th.spin * 0.4);
      c.fillStyle = '#8f8ab8'; c.beginPath(); c.ellipse(0, -r, r * 1.1, r, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#b3aed8'; c.beginPath(); c.ellipse(-r * 0.3, -r * 1.3, r * 0.5, r * 0.35, -0.4, 0, 6.2832); c.fill();
      c.fillStyle = ZUBU.moss[1]; c.beginPath(); c.ellipse(r * 0.2, -r * 1.8, r * 0.6, r * 0.28, 0.3, 0, 6.2832); c.fill();
    } else if (th.kind === 'fruit'){
      const r = s * 0.06;
      c.rotate(th.spin * 0.3);
      const fg = c.createRadialGradient(-r * 0.4, -r * 1.4, r * 0.1, 0, -r, r * 1.1);
      fg.addColorStop(0, '#ffe0a0'); fg.addColorStop(0.5, '#ff9a6a'); fg.addColorStop(1, '#d0506a');
      c.fillStyle = fg; c.beginPath(); c.arc(0, -r, r, 0, 6.2832); c.fill();
      c.fillStyle = ZUBU.moss[0]; c.beginPath(); c.ellipse(r * 0.25, -r * 2.05, r * 0.4, r * 0.18, 0.5, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-r * 0.35, -r * 1.4, r * 0.18, 0, 6.2832); c.fill();
    } else {
      glow(c, 0, -s * 0.05, s * 0.09, '#bff4ff', 0.7);
      drawCrystal(c, 0, -s * 0.03, s * 0.05, this.t + th.n);
    }
    c.restore();
  }

  /* The words. */
  marks(c, W, H){
    if (this.phase === 'in' && this.pt > 1) banner(c, W, H, 'UH-OH...', '#ffe39a', 1 + 0.03 * Math.sin(this.t * 5));
    if (this.phase === 'run' && this.pt < 5) banner(c, W, H, 'RUN!', '#ffd24a', 1.1 + 0.05 * Math.sin(this.t * 8));
    if (this.phase === 'run' && this.gap < NEAR + 0.5 && this.pt >= 5) banner(c, W, H, 'FASTER!', '#ffd24a', 1 + 0.05 * Math.sin(this.t * 10));
  }
}
