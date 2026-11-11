/* Last Known Position - the summit, at the very start of level 1.

   On their feet after the crash, the crew are high on a mountain: no
   path yet, just open grass sloping up to its top, two boulders on it
   hiding whatever's beyond - only birds, and light, coming up over them.
   Up they walk (leaning still steers, but the slope keeps them headed
   for the top); up they CLIMB, hand over hand; and over the top, the
   camera rising past them, the whole planet opens up below. A slow look
   across it all, the title coming up over it, Nova's one line; then down
   the far side - WHEEE - onto the old trail by the river, and the run
   begins.

     walk   up the hillside to the boulders (WALK seconds)
     climb  CLIMB! - each reach up, an arm at a time, pulls you up; a
            little by itself as well, and anyone left behind is helped
            up once the others are there (CLIMB at most)
     crest  over the top: the camera rising past them (CREST)
     look   a slow pan across the world; the title fades in over it;
            Nova: follow the river (LOOK)
     slide  down the far side, onto the trail (SLIDE)

   Its own view (like the wing's): drawn instead of the corridor. */
import { pose, L as LM } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { PAL } from './lkp-art.js';
import { worldOverlook } from './lkp-world.js';
import { worldShip } from './lkp-places.js';
import { shipFire } from './lkp-crashsite.js';
import { flutterSwarm } from './lkp-critters.js';
import { banner, smooth } from './lkp-zip.js';
import { TITLE } from './lkp-title.js';

export const WALK = 11, CLIMB = 16, CREST = 4.5, LOOK = 16, SLIDE = 2.4;
/* A pull up the boulder for each reach (of the climb, 0..1); how much it
   climbs by itself a second; how fast anyone behind is helped up. */
export const PULL = 0.16, CREEP = 0.025, HELP = 0.35;
/* When in the look the title comes up, and Nova speaks. */
/* (the title up for a good look, then away before she speaks) */
const TITLE_AT = 2.5, TITLE_END = 8.5, SAY_AT = 9.5;

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const lerp = (a, b, k) => a + (b - a) * k;

/* A reach up: either hand going up past the head (from the camera's
   landmarks; with the mouse, the hand going high), one reach at a time. */
export class ReachWatch {
  constructor(){ this.up = { l: false, r: false }; }
  step(p, mouse){
    let l = false, r = false;
    if (p.lm && p.lm[LM.NOSE]){
      const head = p.lm[LM.NOSE].y, wl = p.lm[LM.L_WRIST], wr = p.lm[LM.R_WRIST];
      l = !!(wl && (wl.v == null || wl.v > 0.4) && wl.y < head); r = !!(wr && (wr.v == null || wr.v > 0.4) && wr.y < head);
    } else if (mouse){ r = p.hands.right.y < 0.3; }
    const reached = (l && !this.up.l) || (r && !this.up.r);
    this.up = { l, r };
    return reached;
  }
}

export class Summit {
  constructor(game, talk = true){
    this.g = game; this.talk = talk;
    this.t = 0; this.pt = 0; this.phase = 'walk'; this.done = false;
    this.climb = pose.players.map(() => 0); this.pulled = pose.players.map(() => -9);
    this.reach = pose.players.map(() => new ReachWatch());
    this.x = pose.players.map((_, i) => 0); this.said = false; this.titled = false;
    sfx.wind?.(0.5);
  }
  /* (nothing to run along yet: the corridor stands still) */
  speed(){ return 0; }

  step(dt){
    const g = this.g, here = g.here;
    this.t += dt; this.pt += dt;
    /* leaning steers them across the slope - and the slope brings them back toward its top */
    for (const i of here){ const want = (g.leanOf ? g.leanOf(i) : g.crew[i].lean || 0) * 0.5; this.x[i] += (want - this.x[i]) * Math.min(1, dt * 2); }
    if (this.phase === 'walk'){
      if (Math.floor(this.t / 0.55) !== Math.floor((this.t - dt) / 0.55)) sfx.step?.(Math.floor(this.t * 2) % 3, 0.1);
      if (this.pt >= WALK){ this.phase = 'climb'; this.pt = 0; sfx.pat?.(); }
    } else if (this.phase === 'climb'){
      for (const i of here){
        if (this.reach[i].step(pose.players[i], pose.mouse.active)){ this.climb[i] = Math.min(1, this.climb[i] + PULL); this.pulled[i] = this.t; sfx.pat?.(); }
        this.climb[i] = Math.min(1, this.climb[i] + CREEP * dt);
      }
      /* (the ones at the top reach down for the rest) */
      const top = here.filter(i => this.climb[i] >= 1).length;
      if (top > 0) for (const i of here) if (this.climb[i] < 1) this.climb[i] = Math.min(1, this.climb[i] + HELP * dt * top / here.length);
      if (here.every(i => this.climb[i] >= 1) || this.pt >= CLIMB){ for (const i of here) this.climb[i] = 1; this.phase = 'crest'; this.pt = 0; sfx.titleSwell?.(); sfx.whoosh?.(); sfx.wind?.(1); }
    } else if (this.phase === 'crest'){
      if (this.pt >= CREST){ this.phase = 'look'; this.pt = 0; }
    } else if (this.phase === 'look'){
      if (!this.titled && this.pt >= TITLE_AT){ this.titled = true; sfx.chime?.(1); }
      if (this.talk && !this.said && this.pt >= SAY_AT && !g.captain.busy){ this.said = true; const l = g.level.lines.summit; if (l) g.captain.say(l[0][1], l[0][2] || '', { polite: true, story: true }); }
      if (this.pt >= LOOK && (!this.talk || !g.captain.busy)){ this.phase = 'slide'; this.pt = 0; sfx.whoosh?.(); sfx.spring?.(1); }
    } else if (this.phase === 'slide'){
      if (this.pt >= SLIDE) this.done = true;
    }
  }

  /* ---------- drawing ---------- */

  draw(c, W, H, drawCrew){
    const L = PAL.world, t = this.t, here = this.g.here, n = here.length;
    c.save();
    /* how far the camera's come: walking up (0..1), and risen over the top (0..1) */
    const walk = this.phase === 'walk' ? smooth(this.pt / WALK) : 1;
    const rise = this.phase === 'crest' ? smooth(this.pt / CREST) : this.phase === 'look' || this.phase === 'slide' ? 1 : 0;
    const look = this.phase === 'look' ? this.pt / LOOK : this.phase === 'slide' ? 1 : 0;
    const slide = this.phase === 'slide' ? smooth(this.pt / SLIDE) : 0;
    /* behind it all, the world (seen once they're over the top): a slow look across it */
    worldOverlook(c, W, H, H, t, L, 1, lerp(W * 0.12, -W * 0.12, smooth(look)));
    /* the hillside, the boulders on top - sinking away as the camera rises over them */
    c.save(); c.translate(0, rise * H * 0.26 + slide * H * 0.6);
    const crest = lerp(H * 0.44, H * 0.62, walk);
    this._sky(c, W, H, crest, L, 1 - rise);
    this._hill(c, W, H, crest, L);
    /* the ship, crashed and smoking, right beside them as they set off - left behind as they climb */
    if (this.phase === 'walk'){ const u = this.pt / WALK, rel = lerp(0.55, -0.1, Math.min(1, u * 1.4)); if (rel > -0.08){ worldShip(c, W, H, rel, -2.3, t, 1.25); shipFire(c, W, H, rel, -2.3, t, 1.25); } }
    const bw = lerp(0.085, 0.28, walk), bh = lerp(0.095, 0.36, walk), b1 = { x: W * lerp(0.46, 0.37, walk), y: lerp(crest + H * 0.035, H * 0.9, walk), w: W * bw, h: H * bh }, b2 = { x: W * lerp(0.54, 0.64, walk), y: lerp(crest + H * 0.04, H * 0.92, walk), w: W * bw * 0.86, h: H * bh * 0.84 };
    this._boulder(c, b1.x, b1.y, b1.w, b1.h, 1); this._boulder(c, b2.x, b2.y, b2.w, b2.h, 5);
    if (this.phase === 'walk') flutterSwarm(c, W * 0.6, lerp(H * 0.62, H * 0.5, walk), H * 0.12, t, 0.1, 0);
    /* the crew: walking up the slope; up the boulders' faces; stood on top */
    here.forEach((i, k) => {
      const rn = this.g.crew[i], rock = k % 2 ? b2 : b1, off = (k - (n - 1) / 2) * W * 0.14;
      let x, y, h = H * 0.17, st = {};
      if (this.phase === 'walk'){ x = W * 0.5 + off + this.x[i] * W * 0.18; y = H * (0.97 - 0.02 * Math.abs(k - 1)); rn.run = 0.4; }
      else {
        const u = this.climb[i], foot = rock.y, top = rock.y - rock.h * 0.96;
        /* (each their own spot: two on the bigger rock, one or two on the other) */
        const rx = rock.x + rock.w * [-0.2, 0, 0.18, 0.05][k % 4];
        x = lerp(W * 0.5 + off, rx, Math.min(1, u * 3)); y = lerp(H * 0.97, top, u); h = H * 0.2 * (1 - 0.25 * rise);
        rn.run = 0;
        /* hand over hand, one arm up then the other; at the top, arms up to the view */
        st.pose = u < 1 ? (Math.floor((this.t - this.pulled[i]) * 3) % 2 ? 'reach' : 'hang') : this.phase === 'look' && this.pt > SAY_AT + 3 ? 'hang' : null;
        st.look = u >= 1 ? 0.4 * Math.sin(this.t * 0.3 + k * 1.7) * rise : 0;
      }
      drawCrew(i, x, y, h, st);
    });
    c.restore();
    /* the climb's words */
    if (this.phase === 'climb' && this.pt < CLIMB - 1){
      banner(c, W, H, 'CLIMB!', '#ffd24a', 1.15 + 0.04 * Math.sin(t * 8), H * 0.16);
      c.font = `600 ${H * 0.03}px Fredoka, sans-serif`; c.textAlign = 'center'; c.lineWidth = H * 0.006; c.strokeStyle = 'rgba(20,15,45,.8)';
      c.strokeText('REACH UP - HAND OVER HAND', W / 2, H * 0.25); c.fillStyle = '#fff'; c.fillText('REACH UP - HAND OVER HAND', W / 2, H * 0.25);
    }
    /* the title, fading in over the world - and away as they go */
    if (this.phase === 'look' || this.phase === 'slide'){
      const a = this.phase === 'slide' ? 0 : Math.min(1, Math.max(0, (this.pt - TITLE_AT) / 2.5)) * Math.min(1, Math.max(0, (TITLE_END - this.pt) / 1.2));
      this._title(c, W, H, a);
    }
    c.restore();
    /* sliding down: the trail coming up to meet them */
    if (slide > 0.5){ c.fillStyle = `rgba(255,250,240,${(slide - 0.5) * 2 * 0.9})`; c.fillRect(0, 0, W, H); }
  }

  /* the sky over the hilltop, and the light coming up from beyond it (fading as they rise into the open) */
  _sky(c, W, H, top, L, a){
    if (a <= 0.01) return;
    c.save(); c.globalAlpha = a;
    const sg = c.createLinearGradient(0, -H, 0, top); sg.addColorStop(0, '#3e4fb8'); sg.addColorStop(0.5, L.sky[0]); sg.addColorStop(0.85, L.sky[1]); sg.addColorStop(1, L.sky[2]);
    c.fillStyle = sg; c.fillRect(0, -H, W, top + H * 1.2);
    const lg = c.createRadialGradient(W * 0.5, top, 0, W * 0.5, top, W * 0.5); lg.addColorStop(0, 'rgba(255,248,230,.6)'); lg.addColorStop(1, 'rgba(255,248,230,0)'); c.fillStyle = lg; c.fillRect(0, -H, W, top + H);
    /* birds, bursting up from beyond */
    c.strokeStyle = 'rgba(50,40,80,.7)'; c.lineWidth = 2;
    for (let k = 0; k < 8; k++){ const x = W * (0.42 + 0.16 * hash(k + 50)) + Math.sin(this.t * 0.5 + k) * 10, y = top - H * (0.08 + 0.12 * hash(k + 51)) - ((this.t * 0.02 + hash(k)) % 1) * H * 0.1, w = 9, fl = Math.sin(this.t * 9 + k) * 6; c.beginPath(); c.moveTo(x - w, y - fl); c.lineTo(x, y); c.lineTo(x + w, y - fl); c.stroke(); }
    c.restore();
  }
  /* the open hillside, up to its top - the wind running up the grass toward it */
  _hill(c, W, H, crest, L){
    const gg = c.createLinearGradient(0, crest, 0, H); gg.addColorStop(0, '#9edb98'); gg.addColorStop(0.3, L.grass[0]); gg.addColorStop(1, L.ground[2]);
    c.fillStyle = gg; c.beginPath(); c.moveTo(-10, H * 2); c.lineTo(-10, crest + H * 0.12); c.quadraticCurveTo(W * 0.5, crest - H * 0.06, W + 10, crest + H * 0.12); c.lineTo(W + 10, H * 2); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,245,215,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, crest + H * 0.12); c.quadraticCurveTo(W * 0.5, crest - H * 0.06, W + 10, crest + H * 0.12); c.stroke();
    c.lineCap = 'round';
    for (let k = 0; k < 26; k++){
      const u = hash(k + 7), v = (0.15 + 0.85 * hash(k + 8) + this.t * 0.05) % 1, y = crest + (H - crest) * (1 - v), x = W * (0.5 + (u - 0.5) * (0.4 + 1.2 * (1 - v))), l = H * 0.05 * (1 - v) + 6;
      c.strokeStyle = `rgba(230,255,220,${(0.18 + 0.25 * (1 - v)) * Math.sin(v * Math.PI)})`; c.lineWidth = 1.5 + 3 * (1 - v);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (W * 0.5 - x) * 0.05, y - l * 0.6, x + (W * 0.5 - x) * 0.12, y - l * 1.4); c.stroke();
    }
    for (let k = 0; k < 140; k++){
      const v = Math.pow(hash(k + 90), 0.7), y = crest + H * 0.03 + (H - crest) * v, x = W * hash(k + 91), s = 2 + 14 * v;
      c.strokeStyle = k % 2 ? L.grass[1] : '#5fae86'; c.lineWidth = 1 + s * 0.15; c.beginPath(); c.moveTo(x, y); c.lineTo(x - s * 0.3, y - s); c.moveTo(x, y); c.lineTo(x + s * 0.35, y - s * 0.9); c.stroke();
      if (k % 7 === 0){ c.fillStyle = ['#fff4c2', '#ffc2e6', '#c9f7ff'][k % 3]; c.beginPath(); c.arc(x, y - s, s * 0.22, 0, 6.2832); c.fill(); }
    }
  }
  /* a boulder: dark under, lit on top, the low sun's rim on its left, moss on top */
  _boulder(c, x, y, w, h, n){
    c.fillStyle = '#5d5680'; c.beginPath(); c.moveTo(x - w * 0.5, y); c.bezierCurveTo(x - w * 0.56, y - h * 0.7, x - w * 0.3, y - h * 1.02, x + w * 0.02, y - h); c.bezierCurveTo(x + w * 0.38, y - h * 0.98, x + w * 0.56, y - h * 0.6, x + w * 0.5, y); c.closePath(); c.fill();
    c.fillStyle = '#8f88b0'; c.beginPath(); c.moveTo(x - w * 0.5, y - h * 0.05); c.bezierCurveTo(x - w * 0.54, y - h * 0.7, x - w * 0.3, y - h * 1.0, x + w * 0.02, y - h * 0.98); c.bezierCurveTo(x + w * 0.25, y - h * 0.95, x + w * 0.3, y - h * 0.75, x + w * 0.1, y - h * 0.55); c.bezierCurveTo(x - w * 0.1, y - h * 0.35, x - w * 0.3, y - h * 0.2, x - w * 0.5, y - h * 0.05); c.fill();
    c.strokeStyle = 'rgba(255,240,215,.55)'; c.lineWidth = Math.max(2, w * 0.01); c.beginPath(); c.moveTo(x - w * 0.5, y - h * 0.08); c.bezierCurveTo(x - w * 0.54, y - h * 0.7, x - w * 0.3, y - h * 1.0, x + w * 0.02, y - h * 0.99); c.stroke();
    c.strokeStyle = 'rgba(40,30,70,.35)'; c.lineWidth = Math.max(1.5, w * 0.006);
    for (let k = 0; k < 3; k++){ const sx = x + (hash(n + k) - 0.5) * w * 0.6; c.beginPath(); c.moveTo(sx, y - h * (0.2 + 0.2 * k)); c.lineTo(sx + w * 0.05, y - h * (0.3 + 0.2 * k)); c.lineTo(sx + w * 0.02, y - h * (0.38 + 0.2 * k)); c.stroke(); }
    c.fillStyle = '#5fa25a'; c.beginPath(); c.ellipse(x - w * 0.05, y - h * 0.96, w * 0.26, h * 0.07, -0.08, 0, 6.2832); c.fill();
    c.fillStyle = '#8fd08a'; c.beginPath(); c.ellipse(x - w * 0.09, y - h * 0.98, w * 0.18, h * 0.04, -0.08, 0, 6.2832); c.fill();
    for (let k = 0; k < 5; k++){ c.strokeStyle = '#5c7a4a'; c.lineWidth = Math.max(1, w * 0.004); const vx = x - w * 0.25 + k * w * 0.11; c.beginPath(); c.moveTo(vx, y - h * 0.94); c.quadraticCurveTo(vx + w * 0.02, y - h * 0.8, vx - w * 0.01, y - h * (0.72 - 0.05 * (k % 2))); c.stroke(); }
  }
  /* the game's title, over the world: spaced capitals, the level under it */
  _title(c, W, H, a){
    if (a <= 0.01) return;
    const y = H * 0.3, size = H * 0.075, gap = H * 0.02;
    c.save(); c.font = `600 ${size}px "Cinzel", "Fredoka", serif`; c.textBaseline = 'middle'; c.textAlign = 'left';
    const ws = [...TITLE].map(ch => c.measureText(ch).width + gap), tw = ws.reduce((p, q) => p + q, 0) - gap;
    let x = W / 2 - tw / 2;
    c.shadowColor = 'rgba(30,20,70,.55)'; c.shadowBlur = H * 0.02; c.fillStyle = `rgba(255,255,255,${a})`;
    [...TITLE].forEach((ch, k) => { c.fillText(ch, x, y); x += ws[k]; });
    c.shadowBlur = 0; c.font = `500 ${H * 0.026}px "Fredoka", sans-serif`; c.textAlign = 'center'; c.fillStyle = `rgba(255,255,255,${a * 0.85})`;
    const lv = this.g.level; c.fillText(`LEVEL ${(this.g.levelNo ?? 0) + 1}   |   ${(lv && lv.name || '').toUpperCase()}`, W / 2, y + H * 0.08);
    c.fillStyle = `rgba(255,255,255,${0.6 * a})`; c.fillRect(W * 0.3, y + H * 0.045, W * 0.4, 2);
    c.restore();
  }
}
