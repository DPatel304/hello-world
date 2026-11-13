/* Last Known Position - the hill that wasn't, just after the sneak in level 1.

   Past Zubu's eye, safe, the crew carry on along the path - up and over
   the big green hill in front of her, trees and boulders and all. Then
   the hill moves. It isn't a hill: it's her wing-fin, draped over the
   forest asleep and grown over with moss and trees for who knows how
   long. She shifts in her sleep, and it starts to lift - with them on it.

   Seen side on, like the glade: the crew going right, along the wing,
   towards its tip; her, off to the left, where it joins her.

     in     walking on along the hill... a rumble; birds burst out of its
            trees; it lurches. Uh-oh.
     climb  RUN! It's tipping up - running on the spot climbs it, faster
            the harder they run (a walk at least, so they always get
            there). What's loose on it slides down at them - logs,
            boulders, fruit - hop over (bumped is only a BOING, and a
            little slide back); crystals tumble down too, theirs as they
            pass.
     edge   the tip: JUMP! (or after a moment they leap anyway)
     leap   off it, floating down - this is a light little planet - into
            soft moss: FLUMP. The camera pulling right back as they go...
     look   ...and there it all is: her great wing up in the sky, the
            "hill", over the trees, and her vast side it grows from. It
            settles slowly back down over the forest with a WHUMP, a hill
            again - and she snores on. She never woke.

   World units: one screen height at the normal zoom. The wing is hinged
   at her (0, 0) on the forest floor (y = 0) and runs out right, LW long;
   along it, 0 is her and 1 its tip. Its angle is how far it's lifted. */
import { pose } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { MarchWatch } from '../tracking/gestures.js';
import { drawCrystal, PAL } from './lkp-art.js';
import { treeKind, glow, mix } from './lkp-world.js';
import { ZUBU, snoreWord, SNORE, garden } from './lkp-zubu.js';
import { banner, smooth } from './lkp-zip.js';

/* Seconds: walking on before it moves; the most the climb can take (it
   tops out at its highest after LIFT); waiting at the edge for the jump;
   the leap; the look back. */
export const IN = 5.5, LIFT = 18, EDGE = 3, LEAP = 2.8, LOOK = 10;
/* The wing: how long; how far up it tips (radians), resting and at most. */
export const LW = 3.4, REST = 0, MAX = 0.55;
/* Along the wing: where they are as it starts to move, and where the tip
   is (where they jump from). */
export const START = 0.34, TIP = 0.93;
/* How fast they climb (along a second): walking, and what running all out adds. */
export const WALK = 0.02, RUN = 0.035;
/* Bumped by something sliding down: how far back they slip. */
export const SLIP = 0.012;
/* Things sliding down: every so often (seconds), how fast (along a
   second), and how wide each is (along). */
const EVERY = [1.5, 2.5], SLIDE = 0.11;
const WIDE = { log: 0.014, rock: 0.012, fruit: 0.01, gem: 0.016 };
const KINDS = ['gem', 'log', 'rock', 'gem', 'fruit', 'log', 'gem', 'rock', 'fruit'];
/* The crew, one behind another along the path (along), and how tall. */
const SPACE = 0.032, CREW_H = 0.16;

const rand = ([a, b]) => a + Math.random() * (b - a);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const TAU = Math.PI * 2;

/* How thick the wing is at a point along it (world units): a broad
   mossy hump near her, thinning out to a frilled edge at the tip. */
export function thick(a){ const x = Math.min(1, Math.max(0, a)); return 0.05 + 0.42 * Math.pow(1 - x, 0.8) * Math.sin(Math.min(1, x * 3.2) * Math.PI / 2) + 0.012 * Math.sin(x * 23); }

export class Wing {
  constructor(game, talk = false, len = LIFT){
    this.g = game; this.talk = talk; this.len = len;
    this.t = 0; this.pt = 0; this.phase = 'in'; this.done = false; this.clearT = 0;
    this.along = START - 0.06; this.angle = REST; this.lurch = 0; this.shake = 0;
    this.team = 0; this.pace = 0; this.bonks = 0; this.count = 0; this.next = 1.4;
    this.mw = pose.players.map(() => new MarchWatch());
    this.march = pose.players.map(() => 0);
    this.sliding = []; this.bits = []; this.birds = [];
    this.leapT = 0; this.landed = false; this.down = 0; this.whump = false;
    this.fade = 0; this.jumpers = new Set();
  }
  _say(key){ const l = this.g.level.lines[key]; if (l && this.talk) this.g.captain.say(l[0][1], l[0][2] || ''); }

  /* How fast their legs go (the game's speed): a walk to start, climbing,
     still at the edge and after. */
  speed(run){
    if (this.phase === 'in') return run * 0.4;
    if (this.phase === 'climb') return run * this.pace;
    return 0;
  }
  /* where along the wing each of them is: one behind another */
  at(k, n){ return this.along - (k - (n - 1) / 2) * SPACE; }

  step(dt, W = 1920, H = 1080){
    const g = this.g;
    this.t += dt; this.pt += dt; this.fade = Math.min(1, this.fade + dt * 2);
    this.shake = Math.max(0, this.shake - dt * 1.6); this.lurch = Math.max(0, this.lurch - dt * 2);
    if (this.done){ this.clearT += dt; return; }
    const here = g.here;
    for (const i of here) this.march[i] = g.marchOf ? g.marchOf(i, dt) : this.mw[i].step(pose.players[i], dt, pose.mouse.active);
    this.team = here.length ? here.reduce((s, i) => s + this.march[i], 0) / here.length : 0;

    if (this.phase === 'in'){
      this.along += dt * 0.012;
      /* a rumble... birds bursting out of the trees on it... a lurch */
      if (this.pt >= 2.2 && !this.rumbled){ this.rumbled = true; sfx.crashRumble?.(3); this.shake = 0.5; }
      if (this.pt >= 3 && !this.flown){ this.flown = true; this._birds(); sfx.chirp?.(2); }
      if (this.pt >= 4 && !this.lurched){ this.lurched = true; this.lurch = 1; this.shake = 1; sfx.farStep?.(1.6); this._clods(10); for (const i of here) g.crew[i].safe = Math.max(g.crew[i].safe, 0.01); }
      if (this.lurched) this.angle += (REST + 0.04 - this.angle) * Math.min(1, dt * 3);
      if (this.pt >= IN){ this.phase = 'climb'; this.pt = 0; this._say('wingStart'); }
    } else if (this.phase === 'climb'){
      /* lifting: slowly at first, then steadily, to its highest */
      const want = REST + 0.04 + (MAX - REST - 0.04) * smooth(Math.min(1, this.pt / this.len));
      this.angle += (want - this.angle) * Math.min(1, dt * 2);
      const pace = 0.45 + 0.55 * this.team;
      this.pace += (pace - this.pace) * Math.min(1, dt * 3);
      this.along = Math.min(TIP, this.along + dt * (WALK + RUN * this.team));
      /* a groan through it now and then, and clods of earth dropping off underneath */
      if (Math.floor(this.t / 2.4) !== Math.floor((this.t - dt) / 2.4)){ sfx.farStep?.(0.7); this.shake = Math.max(this.shake, 0.35); this._clods(4); }
      /* what's loose on it, sliding down */
      this.next -= dt;
      if (this.next <= 0 && this.along < TIP - 0.12){
        this.next = rand(EVERY);
        const kind = KINDS[this.count++ % KINDS.length];
        this.sliding.push({ kind, along: Math.min(1.02, this.along + 0.42), v: SLIDE * (0.8 + 0.5 * hash(this.t)) * (0.5 + this.angle / MAX), spin: 0, up: 0, upV: 0, passed: new Set(), n: this.count });
      }
      if (this.along >= TIP){ this.phase = 'edge'; this.pt = 0; }
    } else if (this.phase === 'edge'){
      /* at the tip: JUMP! - anyone who does, goes; after a moment, all of them */
      for (const i of here) if (g.crew[i].air > 0.2) this.jumpers.add(i);
      if (this.jumpers.size >= here.length || this.pt >= EDGE){ this.phase = 'leap'; this.pt = 0; sfx.spring?.(0); sfx.whoosh?.(); }
    } else if (this.phase === 'leap'){
      this.leapT = Math.min(1, this.pt / LEAP);
      if (this.pt >= LEAP && !this.landed){ this.landed = true; sfx.thud?.(); this.shake = 0.4; this._puff(); }
      if (this.pt >= LEAP + 0.6){ this.phase = 'look'; this.pt = 0; }
    } else if (this.phase === 'look'){
      /* it settles slowly back down over the forest: WHUMP - a hill again */
      this.down = smooth(Math.max(0, Math.min(1, (this.pt - 2.6) / 3.6)));
      this.angle = MAX + (REST - MAX) * this.down;
      if (this.down >= 1 && !this.whump){ this.whump = true; this.shake = 1; sfx.farStep?.(1.8); this._dust(); this._say('wingEnd'); }
      if (this.pt >= LOOK) this.done = true;
    }

    /* what's sliding: down at them, bouncing a little; past each, a BOING (unless they hopped it), or a crystal */
    for (const th of this.sliding){
      th.along -= th.v * dt; th.spin += th.v * dt * (th.kind === 'log' ? 60 : 40);
      th.upV -= dt * 6; th.up += th.upV * dt;
      if (th.up <= 0){ th.up = 0; th.upV = th.kind === 'gem' ? 1.2 : th.kind === 'log' ? 0.2 : 0.6; }
      const n = here.length;
      here.forEach((i, k) => {
        if (th.passed.has(i) || th.along > this.at(k, n)) return;
        th.passed.add(i); this._pass(th, i, W, H);
      });
    }
    this.sliding = this.sliding.filter(th => th.along > 0.05 && !th.got);
    for (const b of this.bits){ b.x += b.vx * dt; b.y += b.vy * dt; b.vy += dt * (b.fall || 0.25); b.age += dt; }
    this.bits = this.bits.filter(b => b.age < b.life);
    for (const b of this.birds){ b.x += b.vx * dt; b.y += b.vy * dt; b.vy += dt * 0.05; b.age += dt; }
    this.birds = this.birds.filter(b => b.age < 6);
  }

  /* Something sliding past one of them: a crystal, theirs; anything else,
     a soft BOING and a little slip back down - unless they hopped it. */
  _pass(th, i, W, H){
    const g = this.g, rn = g.crew[i], p = this._crewAt(i, W, H);
    if (th.kind === 'gem'){
      if (th.got) return;
      th.got = true; g.gain(3, p.x / W, p.y / H - 0.12); sfx.jar(1 + (g.crystals % 8)); g._sparkle(p.x / W, p.y / H - 0.12, 8, 185);
      return;
    }
    if (rn.air > 0.25 || rn.safe > 0) return;
    rn.safe = 1; this.bonks++; this.along = Math.max(START - 0.05, this.along - SLIP);
    g.bits.push({ kind: 'num', x: p.x / W, y: p.y / H - 0.2, vy: -0.08, age: 0, life: 0.9, text: 'BOING!', col: '#ffffff' });
    g._sparkle(p.x / W, p.y / H - 0.1, 6, 140);
    sfx.boing(1 + i * 0.2);
  }

  /* ---------- where things are ---------- */

  /* The camera: what it looks at (world) and how near (pixels a world unit). */
  _cam(W, H){
    const near = this._surf(this.along, 0), z = H * 0.8;
    let cx = near.x + 0.35, cy = near.y + 0.12;
    if (this.phase === 'leap' || this.phase === 'look' || this.done){
      /* pulling right back: to see the whole wing, and her */
      const k = this.phase === 'leap' ? smooth(this.leapT) * 0.6 : 0.6 + 0.4 * smooth(Math.min(1, (this.phase === 'look' ? this.pt : LOOK) / 2));
      const far = { x: 0.6, y: -1.0, z: H * 0.27 };
      const tip = this._surf(TIP, 0);
      const from = { x: tip.x + 0.35, y: tip.y + 0.12 };
      return { x: from.x + (far.x - from.x) * k, y: from.y + (far.y - from.y) * k, z: H * 0.8 + (far.z - H * 0.8) * k };
    }
    return { x: cx, y: cy, z };
  }
  _screen(cam, W, H, x, y){ return { x: W * 0.42 + (x - cam.x) * cam.z, y: H * 0.6 + (y - cam.y) * cam.z }; }
  /* a point on the wing's top (or `up` above it): along it, and its angle */
  _surf(a, up = 0, angle = this.angle){
    const u = a * LW, v = -thick(a) - up, cs = Math.cos(angle), sn = Math.sin(angle);
    return { x: u * cs + v * sn, y: -u * sn + v * cs };
  }
  /* where one of them is on the screen: on the wing, or leaping off it */
  _crewAt(i, W, H){
    const cam = this._cam(W, H), here = this.g.here, k = Math.max(0, here.indexOf(i)), n = here.length;
    if (this.phase === 'leap' || this.phase === 'look' || this.done){
      const a = this.at(k, n), from = this._surf(a, 0, MAX), to = { x: this._surf(TIP, 0, MAX).x + 0.7 + k * 0.18, y: 0 };
      const s = this.phase === 'leap' ? Math.min(1, this.pt / LEAP) : 1;
      /* a floaty arc: up first, then a slow drift down */
      const x = from.x + (to.x - from.x) * s, y = from.y + (to.y - from.y) * smooth(s) - Math.sin(s * Math.PI) * 0.45;
      return this._screen(cam, W, H, x, y);
    }
    const p = this._surf(this.at(k, n), 0);
    return this._screen(cam, W, H, p.x, p.y);
  }

  /* ---------- bits ---------- */

  _birds(){ for (let k = 0; k < 14; k++){ const a = START + 0.1 + 0.4 * hash(k); const p = this._surf(a, 0.25); this.birds.push({ x: p.x, y: p.y, vx: 0.15 + 0.25 * hash(k + 3), vy: -0.3 - 0.3 * hash(k + 7), age: 0, ph: hash(k) * 6 }); } }
  _clods(n){ for (let k = 0; k < n; k++){ const a = 0.2 + 0.75 * Math.random(), p = this._surf(a, 0); const u = p.y + thick(a) * 1.6; this.bits.push({ x: p.x, y: u, vx: (Math.random() - 0.5) * 0.05, vy: 0, fall: 1.2, age: 0, life: 1.5, col: ['#6b5a46', ZUBU.moss[1], '#8a7258'][k % 3], r: 0.006 + Math.random() * 0.01 }); } }
  _puff(){ const p = this._surf(TIP, 0, MAX); for (let k = 0; k < 24; k++){ const a = Math.random() * Math.PI; this.bits.push({ x: p.x + 0.85, y: -0.02, vx: Math.cos(a) * 0.3, vy: -Math.sin(a) * 0.25, fall: 0.3, age: 0, life: 1.4, col: [ZUBU.bloom, '#fff3d6', ZUBU.moss[0], ZUBU.moss[2]][k % 4], r: 0.008 + Math.random() * 0.008 }); } }
  _dust(){ for (let k = 0; k < 40; k++){ const a = 0.1 + 0.9 * Math.random(), p = this._surf(a, 0); this.bits.push({ x: p.x, y: -0.02, vx: (Math.random() - 0.5) * 0.4, vy: -0.05 - Math.random() * 0.2, fall: 0.05, age: 0, life: 2.5, col: 'rgba(230,220,240,.7)', r: 0.03 + Math.random() * 0.04 }); } }

  /* ---------- drawing ---------- */

  draw(c, W, H, drawCrew){
    const g = this.g, L = PAL.world;
    c.save();
    const s = this.shake * this.shake * H * 0.02 + this.lurch * H * 0.01;
    if (s > 0) c.translate(Math.sin(this.t * 61) * s, Math.cos(this.t * 47) * s * 0.8);
    const cam = this._cam(W, H), S = (x, y) => this._screen(cam, W, H, x, y), z = cam.z;
    this._sky(c, W, H, L, cam);
    /* the forest beyond, on the floor */
    this._woods(c, W, H, L, cam, -1);
    /* her, where the wing grows from - only seen once the camera pulls back */
    this._her(c, W, H, L, cam);
    /* the wing, and everything on it */
    this._wing(c, W, H, L, cam);
    /* the forest floor, in front of its underside where it lies on the ground */
    const gy = S(0, 0).y;
    const gg = c.createLinearGradient(0, gy, 0, gy + z * 0.4); gg.addColorStop(0, L.ground[0]); gg.addColorStop(1, L.ground[2]);
    c.fillStyle = gg; c.fillRect(-W * 0.2, gy, W * 1.4, H * 2);
    c.strokeStyle = L.grass[0]; c.lineWidth = Math.max(1, z * 0.004); c.lineCap = 'round';
    for (let k = 0; k < 90; k++){ const x = ((k * 0.137 + 0.03) % 1) * W * 1.2 - W * 0.1, l = z * 0.02 * (0.6 + hash(k)); c.beginPath(); c.moveTo(x, gy + 1); c.lineTo(x - l * 0.3, gy - l); c.moveTo(x, gy + 1); c.lineTo(x + l * 0.3, gy - l * 0.9); c.stroke(); }
    /* the near woods, in front */
    this._woods(c, W, H, L, cam, 1);
    /* the moss pile they land in */
    if (this.phase === 'leap' || this.phase === 'look' || this.done){
      const p = S(this._surf(TIP, 0, MAX).x + 0.85, 0);
      c.fillStyle = ZUBU.moss[1]; c.beginPath(); c.ellipse(p.x, p.y, z * 0.32, z * 0.07, 0, Math.PI, TAU); c.fill();
      c.fillStyle = ZUBU.moss[0]; c.beginPath(); c.ellipse(p.x - z * 0.03, p.y - z * 0.01, z * 0.26, z * 0.055, 0, Math.PI, TAU); c.fill();
      for (let k = 0; k < 7; k++){ c.fillStyle = [ZUBU.bloom, '#fff3d6', '#ffe39a'][k % 3]; c.beginPath(); c.arc(p.x + (k - 3) * z * 0.07, p.y - z * 0.03 - (k % 2) * z * 0.015, z * 0.008, 0, TAU); c.fill(); }
    }
    /* the crew */
    const order = g.here.slice();
    for (const i of order){ const p = this._crewAt(i, W, H); drawCrew(i, p.x, p.y, z * CREW_H, 0); }
    /* bits: clods, petals, dust; birds */
    for (const b of this.bits){
      const p = S(b.x, b.y); c.save(); c.globalAlpha = Math.max(0, 1 - b.age / b.life); c.fillStyle = b.col;
      c.beginPath(); c.arc(p.x, p.y, b.r * z, 0, TAU); c.fill(); c.restore();
    }
    c.strokeStyle = 'rgba(50,40,80,.7)'; c.lineWidth = Math.max(1.5, z * 0.004);
    for (const b of this.birds){ const p = S(b.x, b.y), f = Math.sin(this.t * 14 + b.ph) * z * 0.008, w = z * 0.016; c.beginPath(); c.moveTo(p.x - w, p.y - f); c.lineTo(p.x, p.y); c.lineTo(p.x + w, p.y - f); c.stroke(); }
    /* her snore, once it's all settled - she slept through it */
    if (this.phase === 'look' && this.down > 0.6){
      const ph = (this.t % (SNORE / 2)) / (SNORE / 2), word = snoreWord(this.t), at = S(-0.9, -1.55);
      c.save(); c.globalAlpha = Math.sin(Math.min(1, ph * 1.15) * Math.PI) * Math.min(1, (this.down - 0.6) * 3);
      const fs = Math.round(H * (0.04 + 0.015 * ph));
      c.font = `700 ${fs}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = fs * 0.18; c.strokeStyle = 'rgba(40,40,80,.55)'; c.strokeText(word, at.x, at.y - ph * H * 0.06);
      c.fillStyle = '#ffffff'; c.fillText(word, at.x, at.y - ph * H * 0.06); c.restore();
    }
    c.restore();
    if (this.fade < 1){ c.fillStyle = `rgba(0,0,0,${1 - this.fade})`; c.fillRect(0, 0, W, H); }
  }

  /* the sky, and far hazy hills - sliding a little with the camera */
  _sky(c, W, H, L, cam){
    const sk = c.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, L.sky[0]); sk.addColorStop(0.55, L.sky[2]); sk.addColorStop(1, L.sky[3]);
    c.fillStyle = sk; c.fillRect(-W * 0.1, -H * 0.1, W * 1.2, H * 1.2);
    const gy = this._screen(cam, W, H, 0, 0).y, par = 0.25;
    for (const [k, hgt, hz] of [[0, 0.16, 0.55], [1, 0.1, 0.35]]){
      const base = H * 0.6 + (gy - H * 0.6) * par - H * 0.02 * k;
      c.fillStyle = mix(k ? L.hillLit : L.hillDark, L.haze, hz); c.beginPath(); c.moveTo(-W * 0.1, H * 1.2);
      for (let x = 0; x <= 20; x++){ const X = W * (x / 20) * 1.2 - W * 0.1 - cam.x * cam.z * 0.05; c.lineTo(X, base - H * hgt * (0.5 + 0.5 * Math.abs(Math.sin(x * 0.9 + k * 2)))); }
      c.lineTo(W * 1.1, H * 1.2); c.closePath(); c.fill();
    }
    /* the forest floor, far off and hazy, below the hills - a long way down, once it's lifted */
    const fy = H * 0.6 + (gy - H * 0.6) * 0.5;
    c.fillStyle = mix(L.ground[0], L.haze, 0.55); c.fillRect(-W * 0.1, fy, W * 1.2, H * 1.3);
    c.fillStyle = mix(L.tree[1], L.haze, 0.6);
    for (let k = 0; k < 60; k++){ const x = ((k * 0.618 - cam.x * cam.z * 0.0003) % 1 + 1) % 1 * W * 1.2 - W * 0.1, r = H * (0.01 + 0.008 * hash(k)); c.beginPath(); c.arc(x, fy + r * 0.3, r, Math.PI, TAU); c.fill(); }
  }
  /* trees on the forest floor: behind (side -1) or in front (1) of the wing */
  _woods(c, W, H, L, cam, side){
    const n = side < 0 ? 34 : 10;
    for (let k = 0; k < n; k++){
      const x = -5 + 12 * hash(k * 3 + (side < 0 ? 0 : 100)), sc = side < 0 ? 0.00042 : 0.0006, p = this._screen(cam, W, H, x, side < 0 ? -0.01 : 0.06);
      if (p.x < -W * 0.3 || p.x > W * 1.3) continue;
      /* (none in front of the wing where it lies along the ground, or where they land) */
      if (side > 0 && x > -0.5 && x < LW + 1.4) continue;
      treeKind(c, p.x, p.y, cam.z * sc * (0.8 + 0.4 * hash(k + 9)), ['pine', 'round', 'umbrella', 'blossom'][k % 4], L, side < 0 ? 0.35 : 0, 300 + k);
    }
  }
  /* her: the great curve of her side, the wing's root in it, her garden on top */
  _her(c, W, H, L, cam){
    const S = (x, y) => this._screen(cam, W, H, x, y), z = cam.z;
    const pts = [[-4.6, 0.02], [-4.4, -1.1], [-3.4, -1.75], [-1.9, -1.9], [-0.7, -1.4], [0.1, -0.5], [0.35, 0.02]].map(([x, y]) => S(x, y));
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++){ const a = pts[k - 1], b = pts[k]; c.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    c.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); c.closePath();
    const bg = c.createLinearGradient(0, S(0, -1.9).y, 0, S(0, 0).y); bg.addColorStop(0, '#f5b79a'); bg.addColorStop(1, ZUBU.deep);
    c.fillStyle = bg; c.fill(); c.strokeStyle = ZUBU.line; c.lineWidth = Math.max(2, z * 0.01); c.stroke();
    const top = S(-2.6, -1.86); garden(c, top.x, top.y, z * 1.3, z * 0.16, z * 0.9, this.t, 0.3);
  }
  /* the wing: a long mossy hump of a hill, trees and boulders on it - its
     peach underside showing, ribbed, as it lifts, roots and moss hanging off */
  _wing(c, W, H, L, cam){
    const z = cam.z, root = this._screen(cam, W, H, 0, 0), N = 40;
    c.save(); c.translate(root.x, root.y); c.rotate(-this.angle);
    const top = [], bot = [];
    for (let k = 0; k <= N; k++){ const a = k / N; top.push([a * LW * z, -thick(a) * z]); bot.push([a * LW * z, (0.14 + 0.015 * Math.sin(a * 9)) * z * (1 - a * 0.7)]); }
    /* the underside: her skin, ribbed - only seen once it lifts */
    c.fillStyle = ZUBU.fin; c.beginPath(); c.moveTo(0, -0.02 * z);
    for (const [x, y] of bot) c.lineTo(x, y);
    c.lineTo(LW * z * 1.02, -0.01 * z); c.lineTo(top[N][0], -0.02 * z); c.closePath(); c.fill();
    c.strokeStyle = ZUBU.line; c.lineWidth = Math.max(1.5, z * 0.005); c.beginPath(); bot.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.lineTo(LW * z * 1.02, -0.01 * z); c.stroke();
    c.strokeStyle = 'rgba(255,240,226,.45)'; c.lineWidth = Math.max(1, z * 0.004);
    for (let k = 1; k < 10; k++){ const a = k / 10, x = a * LW * z, y = bot[Math.round(a * N)][1]; c.beginPath(); c.moveTo(x - z * 0.25, -0.01 * z); c.quadraticCurveTo(x - z * 0.05, y * 0.4, x + z * 0.05, y * 0.9); c.stroke(); }
    /* the frilled tip */
    c.fillStyle = ZUBU.fin;
    for (let k = 0; k < 4; k++){ const y = -thick(1) * z + k * z * 0.03; c.beginPath(); c.ellipse(LW * z + z * 0.03, y, z * 0.06, z * 0.016, 0.2, 0, TAU); c.fill(); }
    /* the hill over it: earth and moss, grown thick on her - dark down its side, lit along its crest */
    const mg = c.createLinearGradient(0, -0.45 * z, 0, 0); mg.addColorStop(0, '#8fd08a'); mg.addColorStop(0.35, L.ground[0]); mg.addColorStop(1, L.ground[2]);
    c.fillStyle = mg; c.beginPath(); c.moveTo(0, -0.02 * z);
    for (const [x, y] of top) c.lineTo(x, y);
    c.lineTo(LW * z * 1.01, -0.02 * z); c.closePath(); c.fill();
    /* moss hanging over its edge, onto her skin */
    c.fillStyle = L.ground[2];
    for (let k = 0; k < 36; k++){ const x = (k + 0.5) / 36 * LW * z; c.beginPath(); c.ellipse(x, -0.02 * z, z * 0.05, z * (0.015 + 0.012 * hash(k + 60)), 0, 0, Math.PI); c.fill(); }
    c.strokeStyle = 'rgba(255,240,215,.55)'; c.lineWidth = Math.max(1, z * 0.004); c.beginPath(); top.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    /* roots and moss hanging off its edge, swaying as it lifts */
    c.strokeStyle = '#5c7a4a'; c.lineWidth = Math.max(1, z * 0.003);
    for (let k = 0; k < 30; k++){ const a = 0.1 + 0.85 * hash(k + 40), x = a * LW * z, y = bot[Math.round(a * N)][1], l = z * (0.03 + 0.06 * hash(k)) * Math.min(1, (this.angle - REST) * 8 + 0.2); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(this.t * 2 + k) * z * 0.01, y + l * 0.5, x + Math.sin(this.t * 1.5 + k) * z * 0.02, y + l); c.stroke(); }
    /* boulders and trees growing on it (leaning with it as it tips) */
    for (let k = 0; k < 22; k++){
      const a = 0.04 + 0.92 * (k / 21) + (hash(k + 5) - 0.5) * 0.03, x = a * LW * z, y = -thick(a) * z + z * 0.012;
      /* (a gap along the path, where they are) */
      if (k % 3 === 2){ c.fillStyle = '#8f88a8'; c.beginPath(); c.ellipse(x, y - z * 0.02, z * 0.04, z * 0.028, 0, 0, TAU); c.fill(); c.fillStyle = ZUBU.moss[0]; c.beginPath(); c.ellipse(x - z * 0.005, y - z * 0.042, z * 0.028, z * 0.01, 0, 0, TAU); c.fill(); continue; }
      c.save(); c.translate(x, y); c.rotate(Math.sin(this.t * 3 + k) * 0.03 * (this.shake + this.lurch));
      treeKind(c, 0, 0, z * 0.0003 * (0.8 + 0.5 * hash(k + 11)), ['pine', 'round', 'blossom', 'umbrella'][k % 4], L, 0.15, 200 + k);
      c.restore();
    }
    /* what's sliding down it */
    for (const th of this.sliding) this._thing(c, z, th);
    c.restore();
  }
  /* a log, a mossy boulder, a big round fruit, or a crystal - sliding down the wing (in its frame) */
  _thing(c, z, th){
    const x = th.along * LW * z, y = -thick(th.along) * z - th.up * z * 0.05;
    c.fillStyle = 'rgba(20,15,45,.25)'; c.beginPath(); c.ellipse(x, -thick(th.along) * z + z * 0.004, z * 0.05, z * 0.008, 0, 0, TAU); c.fill();
    c.save(); c.translate(x, y);
    if (th.kind === 'log'){
      const r = z * 0.035; c.rotate(-th.spin);
      c.fillStyle = '#e6c48e'; c.beginPath(); c.arc(0, -r, r, 0, TAU); c.fill();
      c.strokeStyle = '#7a5236'; c.lineWidth = Math.max(2, r * 0.25); c.stroke();
      c.strokeStyle = '#a07a4e'; c.lineWidth = Math.max(1, r * 0.08); c.beginPath(); c.arc(0, -r, r * 0.55, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.8, -r); c.stroke();
    } else if (th.kind === 'rock'){
      const r = z * 0.04; c.rotate(-th.spin * 0.5);
      c.fillStyle = '#8f8ab8'; c.beginPath(); c.ellipse(0, -r, r * 1.1, r, 0, 0, TAU); c.fill();
      c.fillStyle = '#b3aed8'; c.beginPath(); c.ellipse(-r * 0.3, -r * 1.3, r * 0.5, r * 0.35, -0.4, 0, TAU); c.fill();
      c.fillStyle = ZUBU.moss[1]; c.beginPath(); c.ellipse(r * 0.2, -r * 1.8, r * 0.6, r * 0.28, 0.3, 0, TAU); c.fill();
    } else if (th.kind === 'fruit'){
      const r = z * 0.03; c.rotate(-th.spin * 0.4);
      c.fillStyle = '#ff9a6a'; c.beginPath(); c.arc(0, -r, r, 0, TAU); c.fill();
      c.fillStyle = '#d0506a'; c.beginPath(); c.arc(r * 0.2, -r * 0.8, r * 0.75, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-r * 0.35, -r * 1.4, r * 0.18, 0, TAU); c.fill();
      c.fillStyle = ZUBU.moss[0]; c.beginPath(); c.ellipse(r * 0.25, -r * 2.05, r * 0.4, r * 0.18, 0.5, 0, TAU); c.fill();
    } else {
      glow(c, 0, -z * 0.04, z * 0.06, '#bff4ff', 0.7);
      drawCrystal(c, 0, -z * 0.025, z * 0.035, this.t + th.n);
    }
    c.restore();
  }

  /* The words. */
  marks(c, W, H){
    if (this.phase === 'in' && this.pt > 4.2) banner(c, W, H, 'WHOA...!', '#ffe39a', 1 + 0.03 * Math.sin(this.t * 5));
    if (this.phase === 'climb' && this.pt < 4) banner(c, W, H, 'RUN UP!', '#ffd24a', 1.1 + 0.05 * Math.sin(this.t * 8));
    if (this.phase === 'edge') banner(c, W, H, 'JUMP!', '#ffd24a', 1.1 + 0.06 * Math.sin(this.t * 10));
    if (this.phase === 'leap' && this.landed) banner(c, W, H, 'FLUMP!', '#ffffff', 1);
  }
}
