/* Last Known Position - the team jump: a corridor's event. A gorge across
   the path; coming up to its edge, everything drops into slow motion and
   Nova calls it - JUMP! - with READY seconds to do it. Anyone who really
   jumps has their picture taken, there and then (lkp-faces photo). If at
   least one of them jumped, the whole team leaps it: the camera swings
   round in front of them, and they float across towards us in slow motion
   (HERO seconds), each in their helmet in their own colour, the face in
   it theirs - as they jumped. Then back behind them as they land on the
   far side (LAND), running on. If nobody jumped, they run off the edge
   (FALL): that's the end of the run.

   lkp-game.js holds the corridor for it (speed), skips them over the gorge
   when the shot's done, and draws the shot (view) in place of the run. */
import { PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { glow, mix, rgba } from './lkp-world.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';

export const READY = 3.5, HERO = 3.6, LAND = 0.7, FALL = 1.6;
/* Slow motion: how fast the run goes, waiting for the jump. */
export const CRAWL = 0.06;
/* Everyone jumped: a bonus, for the team. */
export const ALL_BONUS = 5;
/* How high they come down from, landing (hops). */
const FLY = 1.5;

export class TeamJump {
  constructor(game, th){
    this.g = game; this.th = th; this.phase = 'ready'; this.t = 0; this.done = false;
    this.jumped = [];
    sfx.alert?.();
  }
  speed(run){ return this.phase === 'ready' ? run * CRAWL : this.phase === 'fall' ? run * 0.4 : this.phase === 'land' ? run * 0.7 : 0; }
  /* Seconds left to jump. */
  get left(){ return Math.max(0, READY - (this.phase === 'ready' ? this.t : READY)); }

  step(dt, jumped){
    const g = this.g;
    this.t += dt;
    if (this.phase === 'ready'){
      for (const i of jumped) if (!this.jumped.includes(i) && g.here.includes(i)){
        this.jumped.push(i);
        g.faces && g.faces.photo && g.faces.photo(i);
        sfx.pick(); g._sparkle(0.5, 0.75, 6, 50);
      }
      const all = g.here.length && g.here.every(i => this.jumped.includes(i));
      if (this.t >= READY || (all && this.t > 0.6)){
        if (this.jumped.length){
          this.phase = 'hero'; this.t = 0; sfx.whoosh?.();
          if (all && g.here.length > 1) g.gain(ALL_BONUS, 0.5, 0.3);
        } else { this.phase = 'fall'; this.t = 0; sfx.whoosh?.(); }
      }
    } else if (this.phase === 'hero'){
      if (this.t >= HERO){ this.phase = 'land'; this.t = 0; this.across = true; }
    } else if (this.phase === 'land'){
      if (this.t >= LAND){ this.done = true; sfx.thud(); g.shake = Math.min(1, g.shake + 0.4); }
    } else if (this.phase === 'fall'){
      if (this.t >= FALL && !g.over){ g.lost = true; g.over = true; }
    }
  }

  /* How high off the ground (hops) - coming down on the far side. */
  air(){ return this.phase === 'land' ? FLY * (1 - Math.min(1, this.t / LAND)) : 0; }
  fallY(H){ return this.phase === 'fall' ? H * 1.4 * Math.pow(Math.min(1, this.t / FALL), 2) : 0; }

  /* Waiting for the jump: JUMP! and the count, and who's jumped. */
  marks(c, W, H){
    if (this.phase !== 'ready') return;
    const g = this.g, n = Math.ceil(this.left);
    /* slow motion: the edges darkened, a hint of blue */
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.65);
    vg.addColorStop(0, 'rgba(10,20,60,0)'); vg.addColorStop(1, 'rgba(10,20,60,.55)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    banner(c, W, H, 'JUMP!', '#ffd24a', 1.15 + 0.08 * Math.sin(this.t * 10), H * 0.2);
    if (n >= 1){
      const f = this.left - Math.floor(this.left);
      c.save(); c.translate(W / 2, H * 0.4); c.scale(1 + f * 0.4, 1 + f * 0.4); c.globalAlpha = 0.5 + 0.5 * f;
      c.font = `700 ${Math.round(H * 0.15)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = H * 0.02; c.strokeStyle = '#05060f'; c.strokeText(String(n), 0, 0); c.fillStyle = '#ffffff'; c.fillText(String(n), 0, 0);
      c.restore();
    }
    /* who's jumped: a tick in their colour, along the bottom */
    const here = g.here, r = H * 0.025;
    here.forEach((i, k) => {
      const x = W / 2 + (k - (here.length - 1) / 2) * r * 3, y = H * 0.55;
      c.fillStyle = this.jumped.includes(i) ? PLAYER_COLORS[i] : 'rgba(5,6,15,.6)';
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.strokeStyle = PLAYER_COLORS[i]; c.lineWidth = r * 0.2; c.stroke();
      if (this.jumped.includes(i)){ c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.25; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - r * 0.45, y); c.lineTo(x - r * 0.1, y + r * 0.35); c.lineTo(x + r * 0.5, y - r * 0.35); c.stroke(); }
    });
  }

  /* The hero shot: from in front of them, the whole team floating across
     the gorge towards us in slow motion - sky behind, mist far below -
     each in their helmet, their face in it. */
  view(c, W, H, Lw){
    const g = this.g, t = this.t, u = Math.min(1, t / HERO);
    /* the sky, and the far side of the gorge behind them, falling away */
    const sky = c.createLinearGradient(0, 0, 0, H);
    Lw.sky.forEach((col, k) => sky.addColorStop(k / (Lw.sky.length - 1), col));
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    for (const [y0, col, amp, seed] of [[0.6, mix(Lw.hillLit, Lw.haze, 0.4), 0.06, 1], [0.7, mix(Lw.tree[1], Lw.haze, 0.35), 0.05, 2]]){
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 24) c.lineTo(x, H * (y0 + amp * Math.sin(x / W * 9 + seed) + (u * 0.05)));
      c.lineTo(W, H); c.closePath(); c.fill();
    }
    /* the gorge: dark, mist rising */
    const gg = c.createLinearGradient(0, H * 0.72, 0, H);
    gg.addColorStop(0, rgba(Lw.hillDark, 0.9)); gg.addColorStop(1, '#100c22');
    c.fillStyle = gg; c.fillRect(0, H * (0.78 + u * 0.05), W, H);
    for (let k = 0; k < 8; k++) glow(c, W * (k + 0.5) / 8 + Math.sin(t * 0.4 + k) * W * 0.02, H * (0.86 + 0.05 * Math.sin(k * 2)), H * 0.22, '#ffffff', 0.3);
    /* slow-motion streaks, rushing past */
    c.save(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineCap = 'round';
    for (let k = 0; k < 26; k++){
      const a = k / 26 * 6.2832 + 0.3, v = ((t * 0.35 + k * 0.137) % 1), r0 = H * (0.35 + v * 0.9), len = H * 0.08 * (0.4 + v);
      c.lineWidth = Math.max(1, H * 0.004 * v); c.globalAlpha = 0.6 * v;
      c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * r0, H * 0.45 + Math.sin(a) * r0 * 0.7); c.lineTo(W / 2 + Math.cos(a) * (r0 + len), H * 0.45 + Math.sin(a) * (r0 + len) * 0.7); c.stroke();
    }
    c.restore();
    /* the team, floating towards us - growing, drifting, each a little
       different */
    const here = g.here, n = here.length;
    here.forEach((i, k) => {
      const spread = n > 1 ? (k - (n - 1) / 2) / (n - 1) : 0;
      const h = H * (0.36 + 0.12 * u) * (n > 2 ? 0.86 : 1), x = W / 2 + spread * W * (n > 2 ? 0.62 : 0.4) + Math.sin(t * 0.8 + k) * W * 0.008;
      const y = H * (0.62 + 0.06 * Math.sin(k * 2.1) - 0.04 * u) + Math.sin(t * 1.1 + k * 1.7) * H * 0.012;
      crewFront(c, x, y, h, PLAYER_COLORS[i], t + k, -spread * 0.25 + Math.sin(t * 0.7 + k) * 0.04,
        (fx, fy, r) => g.faces && g.faces.drawMoment && g.faces.has(i) ? g.faces.drawMoment(c, i, fx, fy, r, PLAYER_COLORS[i]) : drawKid(c, fx, fy + r * 0.1, r, t + i, KID_SKINS[i]));
    });
    /* letterbox bars: it's a moment */
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H * 0.07); c.fillRect(0, H * 0.93, W, H * 0.07);
    banner(c, W, H, this.jumped.length === n && n > 1 ? 'EVERYONE JUMPED!' : 'TEAM JUMP!', '#ffd24a', 1, H * 0.15);
    /* in and out on a white flash, the camera swinging round */
    const f = Math.max(0, 1 - t / 0.25) + Math.max(0, (t - (HERO - 0.25)) / 0.25);
    if (f > 0){ c.fillStyle = `rgba(255,255,255,${Math.min(1, f)})`; c.fillRect(0, 0, W, H); }
  }
}

/* A crew member from the front, mid-leap, h tall, middle at (x, y),
   turned `tilt`: arms flung out and up, legs kicked, a big round helmet
   in their colour with the face showing through the visor (face(x, y, r)
   draws it). */
export function crewFront(c, x, y, h, col, t, tilt, face){
  const u = h / 400;
  const lite = mix(col, '#ffffff', 0.3), dark = mix(col, '#0a0f2a', 0.4), line = mix(col, '#05081a', 0.62);
  c.save(); c.translate(x, y); c.rotate(tilt);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const limb = (pts, w) => {
    for (const [lw, sc] of [[w + 7 * u, line], [w, col]]){ c.strokeStyle = sc; c.lineWidth = lw; c.beginPath(); pts.forEach(([a, b], k) => (k ? c.lineTo(a, b) : c.moveTo(a, b))); c.stroke(); }
  };
  const flap = Math.sin(t * 2.2) * 8 * u;
  /* legs: kicked out, one bent */
  limb([[-28 * u, 60 * u], [-60 * u, 120 * u], [-50 * u, 175 * u]], 34 * u);
  limb([[28 * u, 60 * u], [70 * u, 100 * u], [110 * u, 130 * u]], 34 * u);
  c.fillStyle = dark; for (const [bx, by] of [[-50, 182], [118, 134]]){ c.beginPath(); c.ellipse(bx * u, by * u, 26 * u, 18 * u, 0.3, 0, 6.2832); c.fill(); }
  /* arms: flung out and up */
  limb([[-62 * u, -40 * u], [-130 * u, -90 * u + flap], [-170 * u, -160 * u + flap]], 30 * u);
  limb([[62 * u, -40 * u], [130 * u, -90 * u - flap], [170 * u, -160 * u - flap]], 30 * u);
  c.fillStyle = dark; for (const [hx, hy] of [[-172, -168 + flap / u], [172, -168 - flap / u]]){ c.beginPath(); c.arc(hx * u, hy * u, 20 * u, 0, 6.2832); c.fill(); }
  /* the body: the suit's front, a glowing panel on the chest */
  const tg = c.createLinearGradient(-70 * u, 0, 70 * u, 0); tg.addColorStop(0, lite); tg.addColorStop(0.5, col); tg.addColorStop(1, dark);
  c.fillStyle = tg; c.beginPath(); c.roundRect(-70 * u, -60 * u, 140 * u, 140 * u, 40 * u); c.fill();
  c.strokeStyle = line; c.lineWidth = 4 * u; c.stroke();
  glow(c, 0, 0, 40 * u, '#9ff6ff', 0.6);
  c.fillStyle = '#e9fbff'; c.beginPath(); c.roundRect(-22 * u, -18 * u, 44 * u, 30 * u, 8 * u); c.fill();
  c.fillStyle = dark; c.fillRect(-70 * u, 50 * u, 140 * u, 16 * u);
  /* the helmet: big and round, in their colour, an antenna, the visor
     open on their face */
  const hy = -150 * u, hr = 112 * u;
  c.strokeStyle = line; c.lineWidth = 6 * u; c.beginPath(); c.moveTo(60 * u, hy - 80 * u); c.lineTo(80 * u, hy - 140 * u); c.stroke();
  glow(c, 80 * u, hy - 145 * u, 22 * u, col, 0.9); c.fillStyle = lite; c.beginPath(); c.arc(80 * u, hy - 145 * u, 10 * u, 0, 6.2832); c.fill();
  const hg = c.createRadialGradient(-35 * u, hy - 45 * u, hr * 0.2, 0, hy, hr);
  hg.addColorStop(0, lite); hg.addColorStop(0.6, col); hg.addColorStop(1, dark);
  c.fillStyle = hg; c.beginPath(); c.arc(0, hy, hr, 0, 6.2832); c.fill();
  c.strokeStyle = line; c.lineWidth = 5 * u; c.stroke();
  /* the visor: dark glass round the face */
  const vr = hr * 0.74;
  c.fillStyle = '#0d1530'; c.beginPath(); c.arc(0, hy + 8 * u, vr, 0, 6.2832); c.fill();
  c.restore();
  /* (the face, upright, not tilted - drawn at the visor's middle) */
  const fx = x - Math.sin(tilt) * (hy + 8 * u), fy = y + Math.cos(tilt) * (hy + 8 * u);
  face(fx, fy, vr * 0.95);
  /* the glass over it: a sheen across the top */
  c.save(); c.translate(fx, fy);
  c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = vr * 0.09; c.lineCap = 'round';
  c.beginPath(); c.arc(0, 0, vr * 0.78, Math.PI * 1.12, Math.PI * 1.45); c.stroke();
  c.fillStyle = 'rgba(160,230,255,.08)'; c.beginPath(); c.arc(0, 0, vr * 0.95, 0, 6.2832); c.fill();
  c.restore();
}

function banner(c, W, H, text, col, s = 1, y = H * 0.2){
  c.save(); c.translate(W / 2, y); c.scale(s, s);
  c.font = `700 ${Math.round(H * 0.08)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = H * 0.015; c.strokeStyle = '#05060f'; c.strokeText(text, 0, 0);
  c.fillStyle = col; c.fillText(text, 0, 0);
  c.restore();
}
