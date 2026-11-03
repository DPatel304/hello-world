/* The treasure room - only ever behind the ? door. A crystal grab, played
   like Pop Party's balloons. The room starts empty - CALM seconds to find
   your feet (each player a little astronaut along the bottom, arms
   stretching to their hands) - then crystals drift slowly down from the
   ceiling towards the floor, RAIN a second, and every one a hand touches
   is grabbed - for the team. Big ones are worth BIG. Any that reach the
   floor fade away. After len seconds of it the crystals are done, and the room fills with
   healing water: POOL seconds for the whole team to stand in it, healing
   POOL_HEAL a second - and HUG_HEAL a second hugging themselves. Then on
   they go. (The only healing besides the corridors' springs.) */
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { CRYSTAL_XP } from './lkp-game.js';
import { sfx } from '../audio/sound.js';
import { Avatars } from '../ui/avatars.js';
import { HugWatch } from '../tracking/gestures.js';
import { PAL, drawCrystal } from './lkp-art.js';
import { worldVault, stretchArm, worldPool } from './lkp-places.js';
import { worldCrew } from './lkp-cast.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';

export const TREASURE_TIME = 20;
/* Empty at first, this long; then crystals coming down, RAIN a second
   (no more than CRYSTALS in the room at once), falling FALL screens a
   second; how often one's big, and its worth. */
export const CALM = 2.5, RAIN = 3, CRYSTALS = 36, FALL = [0.05, 0.09], BIG_CHANCE = 0.1, BIG = 5;
/* A crystal's size (screen heights); how near a hand has to come (at least). */
const R = 0.032, REACH = 0.045;
/* Where they reach the floor, and fade. */
const FLOOR = 0.92;
/* The healing water: how long, and how much health a second - standing
   in it, and hugging yourself in it. */
export const POOL = 3, POOL_HEAL = 8, HUG_HEAL = 30;

export class Treasure {
  constructor(game, len = TREASURE_TIME){
    this.g = game; this.len = len; this.t = 0; this.done = false; this.clearT = 0;
    this.avatars = new Avatars();
    this.crystals = []; this.rain = 0;
    this.got = pose.players.map(() => 0);
    this.pool = 0; this.wet = 0;
    this.hugs = pose.players.map(() => new HugWatch());
    sfx.gold();
  }

  /* A crystal coming in at the ceiling, somewhere across, to drift down. */
  _crystal(){
    const big = Math.random() < BIG_CHANCE;
    return { x: 0.05 + Math.random() * 0.9, y: -0.03, r: R * (big ? 1.5 : 1), worth: big ? BIG : 1,
      vx: (Math.random() - 0.5) * 0.04, vy: FALL[0] + Math.random() * (FALL[1] - FALL[0]), ph: Math.random() * 6, born: 0 };
  }

  step(dt, W, H){
    const g = this.g;
    this.t += dt;
    this.avatars.step(dt, g.players);
    if (this.done){ this.clearT += dt; return; }
    if (this.pool > 0){ this._soak(dt, W, H); return; }
    /* After a calm moment, crystals coming down from the ceiling - drifting
       side to side as they fall, fading away at the floor. */
    if (this.t >= CALM){
      this.rain += dt * RAIN;
      while (this.rain >= 1){ this.rain--; if (this.crystals.length < CRYSTALS) this.crystals.push(this._crystal()); }
    }
    for (const cn of this.crystals){
      cn.born = cn.y > FLOOR ? Math.max(0, cn.born - dt * 3) : Math.min(1, cn.born + dt * 3);
      cn.x += (cn.vx + Math.sin(this.t * 1.3 + cn.ph) * 0.03) * dt; cn.y += cn.vy * dt;
      if (cn.x < 0.03 || cn.x > 0.97) cn.vx = -cn.vx;
      cn.x = Math.max(0.03, Math.min(0.97, cn.x));
      if (cn.y > FLOOR && cn.born <= 0) cn.gone = true;
    }
    /* Hands grab what they touch. (The mouse is both hands at once.) */
    for (const i of g.here){
      const p = pose.players[i], hands = pose.mouse.active ? [p.hands.right] : [p.hands.left, p.hands.right];
      for (const h of hands){
        if (!h) continue;
        for (const cn of this.crystals){
          if (cn.gone || cn.born < 0.6) continue;
          if (Math.hypot((h.x - cn.x) * (W / H), h.y - cn.y) < Math.max(cn.r * 1.2, REACH)) this._grab(cn, i, W, H);
        }
      }
    }
    this.crystals = this.crystals.filter(cn => !cn.gone);
    if (this.t >= CALM + this.len){ this.pool = POOL; sfx.select(); sfx.splash(); }
  }

  /* The healing water: everyone in it heals; hugging, faster. */
  _soak(dt, W, H){
    const g = this.g;
    this.pool -= dt; this.wet = Math.min(1, this.wet + dt * 3);
    for (const cn of this.crystals) cn.born = Math.max(0, cn.born - dt * 4);
    for (const i of g.here){
      const rn = g.crew[i], hug = this.hugs[i].step(pose.players[i], dt);
      rn.hugging = hug;
      if (rn.hp < rn.max){
        rn.hp = Math.min(rn.max, rn.hp + (hug ? HUG_HEAL : POOL_HEAL) * dt);
        if (Math.random() < dt * (hug ? 8 : 2)){
          const p = pose.players[i], x = (p.centre?.x ?? 0.5) + (Math.random() - 0.5) * 0.08;
          g.bits.push({ kind: 'heart', x, y: 0.6, vy: -0.1, age: 0, life: 0.9 });
        }
      }
    }
    if (this.pool <= 0){ this.done = true; for (const rn of g.crew) rn.hugging = false; sfx.twinkle(); }
  }

  _grab(cn, i, W, H){
    const g = this.g;
    cn.gone = true; g.gain(cn.worth, cn.x, cn.y, CRYSTAL_XP / Math.sqrt(Math.max(1, g.here.length))); this.got[i] += cn.worth;
    sfx.jar(1 + (g.crystals % 8));
    g._sparkle(cn.x, cn.y, cn.worth > 1 ? 14 : 6, 50);
  }

  /* Its own picture: a treasure vault, warm and golden, the players in
     it, the crystals, their hands on top - and the time left across the top. */
  view(c, W, H){
    const world = !!PAL.world;
    if (world){
      worldVault(c, W, H, this.t);
      /* The crew, small along the bottom where they stand, their arms
         stretching comically all the way out to their hands. */
      const gm = this.g;
      for (let i = 0; i < gm.players; i++){
        const p = pose.players[i];
        if (!p || !p.present) continue;
        const col = PLAYER_COLORS[i], h = H * 0.26, u = h / 300;
        const x = Math.max(0.08, Math.min(0.92, p.centre?.x ?? 0.5)) * W, base = H * 0.985;
        const hands = (pose.mouse.active ? [p.hands.right] : [p.hands.left, p.hands.right]).filter(Boolean).sort((a, b) => a.x - b.x);
        hands.forEach((hd, k) => {
          const side = hands.length === 1 ? (hd.x * W < x ? -1 : 1) : (k ? 1 : -1);
          stretchArm(c, x + side * 70 * u, base - 160 * u, hd.x * W, hd.y * H, u, col, side);
        });
        const photo = !!(gm.faces && gm.faces.has(i));
        worldCrew(c, x, base, h, this.t + i, col, { air: 0, duck: 0, lean: 0, hit: 0, heal: this.wet > 0 && !this.done ? 0.5 : 0, photo }, (fx, fy, r) => {
          if (photo) gm.faces.draw(c, i, fx, fy, r, col);
          else drawKid(c, fx, fy + r * 0.1, r, this.t + i, KID_SKINS[i]);
        }, 'stretch');
      }
    } else {
      const g = c.createRadialGradient(W / 2, H * 0.55, H * 0.1, W / 2, H * 0.55, W * 0.7);
      g.addColorStop(0, '#5a4a26'); g.addColorStop(1, PAL.hall);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = PAL.floor; c.fillRect(0, H * 0.88, W, H * 0.12);
      this.avatars.drawBodies(c, W, H, this.g.players);
    }
    for (const cn of this.crystals){
      const s = cn.r * H * cn.born, spin = Math.abs(Math.cos(this.t * 2.5 + cn.ph));
      c.save(); c.translate(cn.x * W, cn.y * H); c.scale(0.35 + 0.65 * spin, 1);
      drawCrystal(c, 0, 0, s, this.t);
      if (cn.worth > 1){ c.strokeStyle = '#fff6c8'; c.lineWidth = s * 0.15; c.beginPath(); c.arc(0, 0, s * 0.65, 0, 6.2832); c.stroke(); }
      c.restore();
    }
    /* The healing water, rising round them. */
    if (this.wet > 0 && world) worldPool(c, W, H, this.wet, this.t);
    else if (this.wet > 0){
      const top = H * (0.95 - 0.22 * this.wet);
      const wg = c.createLinearGradient(0, top, 0, H);
      wg.addColorStop(0, 'rgba(56,189,248,.55)'); wg.addColorStop(1, 'rgba(14,116,144,.75)');
      c.fillStyle = wg; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 24) c.lineTo(x, top + Math.sin(x / W * 12 + this.t * 3) * H * 0.01);
      c.lineTo(W, H); c.closePath(); c.fill();
    }
    this.avatars.drawMitts(c, W, H, this.g.players);
    if (this.pool > 0 || (this.wet > 0 && !this.done)){
      const k = Math.max(0, this.pool) / POOL, w = W * 0.4;
      c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `700 ${Math.round(H * 0.08)}px Fredoka, sans-serif`;
      c.lineWidth = H * 0.012; c.strokeStyle = '#05060f'; c.strokeText('HUG TO HEAL!', W / 2, H * 0.22);
      c.fillStyle = '#7dd3fc'; c.fillText('HUG TO HEAL!', W / 2, H * 0.22);
      c.fillStyle = 'rgba(5,6,15,.75)'; c.fillRect(W / 2 - w / 2, H * 0.145, w, H * 0.018);
      c.fillStyle = '#38bdf8'; c.fillRect(W / 2 - w / 2, H * 0.145, w * k, H * 0.018);
      c.restore();
      return;
    }
    const u = Math.max(0, Math.min(1, 1 - (this.t - CALM) / this.len)), w = W * 0.4;
    c.fillStyle = 'rgba(5,6,15,.75)'; c.fillRect(W / 2 - w / 2, H * 0.145, w, H * 0.018);
    c.fillStyle = u < 0.25 ? '#ff5b5b' : '#ffd24a'; c.fillRect(W / 2 - w / 2, H * 0.145, w * u, H * 0.018);
  }
}
