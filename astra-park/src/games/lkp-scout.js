/* Level 1's boss: the Scout, the first robot the surge woke. A tutorial
   boss - forgiving, hard to be beaten by - that teaches the three things
   every boss after it asks: watch what it's about to do, get out of the
   way, and when it staggers, everyone pile in.

   It's a fight like the others underneath (a Fight without waves, the
   Scout a `part` the crew hit like anything else in reach): standing
   together hits harder, the arm-roll, hugging while it's away, clapping
   the sleepy awake, everyone asleep ends the run. A hop's shot reaches it
   wherever it is.

   Its charge: it picks someone and crouches, eye red, a red stripe down
   their lane - a long TELL to get out of it - then charges down that
   lane: anyone still in it takes CHARGE. Then it stands there, at the
   front, REST seconds - hit it! - and trots back.

   Three phases, at two-thirds and a third of its health. Each time it
   crosses one it STAGGERs: slumped at the front, in everyone's reach,
   taking BURN times the damage - "burn it!".
     1  Slow charges, long warnings.
     2  Quicker charges, and a sweep of its arm at head height - duck
        under it. Dust in the air.
     3  Panicking: quicker still, and clumsy - sometimes a charge
        OVERSHOOTs and it's stuck there twice as long. The warnings
        stay long.

   Down to nothing, it sparks and powers off; the level is done. (However
   it's going, after len seconds it gives up anyway.) */
import { RUN, P, drawCorridor, drawSweep, drawScout } from './lkp-art.js';
import { sfx } from '../audio/sound.js';
import { Fight, FRONT, FIGHT_MAX } from './lkp-combat.js';
import { healthBar, stripe } from './lkp-boss.js';

/* For a crew of four (fewer, less: as a fight's robots). */
export const SCOUT_HP = 240;
/* Its charge: the warning, the charge itself, how wide (lanes) it hits,
   and how hard; then standing at the front, and the trot back. */
export const TELL = 1.2, DASH = [0.5, 0.38, 0.3], CHARGE_W = 0.24, CHARGE = 8, REST = [2.6, 2.2, 2], BACK = 0.8, WAIT = [1.2, 0.9, 0.7];
/* Phase 2 on: a sweep at head height every SWEEP seconds, rolling up at
   ROLL (depth a second). Missed: SWEPT. */
export const SWEEP = 5.5, ROLL = 0.5, SWEPT = 8;
/* Phase 3: how often a charge overshoots. */
export const OVERSHOOT = 0.35;
/* Staggered: how long, and how much harder it's hit. */
export const STAGGER = 4, BURN = 2;
export const PHASES = [0.66, 0.33];
/* Where it stands, away from the crew; how wide it is to hit. */
const HOME = 0.55, WIDE = 0.12;
/* Under a sweep: ducked this far (as under a low branch). */
const DUCKED = 0.5;
export const BOSS_COINS = 30;

export class Scout {
  constructor(game, len = FIGHT_MAX, toughness = 1){
    this.g = game; this.len = len;
    this.fight = new Fight(game, Infinity, { waves: false });
    const hp = Math.round(SCOUT_HP * this.fight.toughness * toughness);
    this.body = { part: 'scout', x: 0, d: HOME, wide: WIDE, hp, max: hp, flash: 0, swing: 0, hitT: 0 };
    this.fight.bots.push(this.body);
    this.t = 0; this.phase = 0; this.done = false; this.clearT = 0;
    this.state = 'wait'; this.st = 0; this.lane = 0; this.over = false;
    this.sweepT = SWEEP; this.blasts = [];
    this.staggered = 0; this.dust = [];
    this.banner = 2;
    sfx.siren(true);
  }

  get lost(){ return this.fight.lost; }
  get bots(){ return this.fight.bots; }

  step(dt, W, H, jumped = []){
    const f = this.fight, b = this.body;
    this.t += dt; this.banner = Math.max(0, this.banner - dt);
    b.flash = Math.max(0, b.flash - dt * 4);
    if (this.done){ this.clearT += dt; f.step(dt, W, H, []); return; }
    f.step(dt, W, H, jumped);
    if (f.lost) return;

    /* A phase crossed: it staggers. */
    const frac = b.hp / b.max;
    if (this.phase < PHASES.length && frac <= PHASES[this.phase]){ this.phase++; this._stagger(); }
    if (this.staggered > 0){
      this.staggered -= dt;
      if (this.staggered <= 0){ b.burn = 1; b.wide = WIDE; this._go('back'); }
    } else this._move(dt, W, H);
    if (this.phase >= 1) this._sweeps(dt, W, H);
    if (this.phase >= 1 && Math.random() < dt * 6) this.dust.push({ x: Math.random() * 2.4 - 1.2, d: Math.random() * 0.9, age: 0 });
    for (const d of this.dust) d.age += dt;
    this.dust = this.dust.filter(d => d.age < 2);
    if (b.hp <= 0 || this.t > this.len) this._win(W, H);
  }

  _go(state){ this.state = state; this.st = 0; }

  /* Charge, stand, trot back, wait - round and round. */
  _move(dt, W, H){
    const g = this.g, f = this.fight, b = this.body, ph = this.phase;
    this.st += dt;
    if (this.state === 'wait'){
      b.d += (HOME - b.d) * Math.min(1, dt * 3);
      if (this.st >= WAIT[ph]){
        const up = f.up;
        if (!up.length) return;
        const who = up[Math.floor(Math.random() * up.length)];
        this.lane = g.crew[who].x; this.over = ph >= 2 && Math.random() < OVERSHOOT;
        this._go('tell'); sfx.windup();
      }
    } else if (this.state === 'tell'){
      b.x += (this.lane - b.x) * Math.min(1, dt * 4);
      if (this.st >= TELL){ this._go('dash'); sfx.whoosh(); }
    } else if (this.state === 'dash'){
      const u = Math.min(1, this.st / DASH[ph]);
      b.x = this.lane; b.d = HOME + (FRONT - HOME) * u;
      if (u >= 1){
        g.shake = Math.min(1, g.shake + 0.5); sfx.thud();
        for (const i of f.up) if (Math.abs(g.crew[i].x - this.lane) < CHARGE_W && g.crew[i].safe <= 0) f.hurt(i, CHARGE, W, H);
        this._go('rest');
      }
    } else if (this.state === 'rest'){
      if (this.st >= REST[ph] * (this.over ? 2 : 1)) this._go('back');
    } else if (this.state === 'back'){
      b.d += (HOME - b.d) * Math.min(1, dt / BACK * 3);
      b.x += (0 - b.x) * Math.min(1, dt * 1.5);
      if (this.st >= BACK) this._go('wait');
    }
  }

  _stagger(){
    const b = this.body;
    this.staggered = STAGGER; this.state = 'stagger'; b.burn = BURN; b.wide = 0.6;
    b.x = 0; b.d = FRONT; this.blasts = [];
    this.banner = 1.6; this.g.shake = 1;
    sfx.boom(); sfx.siren(true);
  }

  /* From phase 2: a sweep of its arm, rolling up at head height. */
  _sweeps(dt, W, H){
    const g = this.g, f = this.fight;
    if (this.staggered <= 0 && this.state === 'wait' && (this.sweepT -= dt) <= 0){
      this.sweepT = SWEEP;
      this.blasts.push({ d: this.body.d - 0.02 });
      sfx.windup();
    }
    for (const s of this.blasts){
      const was = s.d;
      s.d -= ROLL * dt;
      if (was >= RUN && s.d < RUN) for (const i of f.up) if (g.crew[i].duck < DUCKED && g.crew[i].safe <= 0) f.hurt(i, SWEPT, W, H);
    }
    this.blasts = this.blasts.filter(s => s.d > -0.1);
  }

  _win(W, H){
    const g = this.g, f = this.fight, b = this.body;
    this.done = true; this.blasts = []; b.burn = 1;
    const p = P(b.x, b.d, W, H);
    for (let k = 0; k < 3; k++) g._sparkle(p.x / W, (p.y - H * 0.1 * k) / H, 16, 40);
    f.bots = []; f._clear(W, H);
    g.coins += BOSS_COINS;
    g.shake = 1; sfx.scrap(); sfx.fanfare();
  }

  /* ---------- what it shows ---------- */

  arena(c, W, H, t){
    drawCorridor(c, W, H, 0, t, this.phase >= 2 ? 0.25 : 0);
    /* Phase 2 on: dust hanging in the air. */
    for (const d of this.dust){
      const p = P(d.x, d.d, W, H);
      c.fillStyle = `rgba(214,190,150,${0.25 * Math.sin(d.age / 2 * Math.PI)})`;
      c.beginPath(); c.arc(p.x, p.y - H * 0.08 * p.k, H * 0.05 * p.k, 0, 6.2832); c.fill();
    }
  }

  items(list){
    const add = (rel, draw) => list.push({ kind: 'boss', rel, draw });
    const b = this.body;
    add(b.d, (c, W, H, t) => {
      const p = P(b.x, b.d, W, H);
      drawScout(c, p.x, p.y, H * 0.3 * p.k, t, {
        flash: b.flash, tell: this.state === 'tell' ? Math.min(1, this.st / TELL) : 0, dash: this.state === 'dash',
        dazed: this.staggered > 0 || (this.state === 'rest' && this.over), panic: this.phase >= 2, off: this.done
      });
    });
    if (this.state === 'tell') add(RUN + 0.002, (c, W, H, t) => stripe(c, W, H, t, this.lane, CHARGE_W));
    for (const s of this.blasts) add(s.d, (c, W, H, t) => drawSweep(c, W, H, s.d, t));
  }

  hud(c, W, H){
    healthBar(c, W, H, this.body.hp / this.body.max, this.phase >= 2, PHASES);
    if (this.staggered > 0){
      c.save();
      c.font = `700 ${Math.round(H * 0.08)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = H * 0.012; c.strokeStyle = '#05060f'; c.strokeText('BURN IT!', W / 2, H * 0.24);
      c.fillStyle = `hsl(${30 + 20 * Math.sin(this.t * 12)},100%,60%)`; c.fillText('BURN IT!', W / 2, H * 0.24);
      c.restore();
    }
  }

  cues(cap){
    if (this.state === 'tell') cap.say('It\'s about to charge! Get out of the red!', 'MOVE!', { once: 'charge' });
    if (this.state === 'rest' && this.staggered <= 0) cap.say('It\'s stopped! Lean in and hit it!', 'HIT IT!', { once: 'rest', polite: true });
    if (this.staggered > 0 && !this.toldBurn){ this.toldBurn = true; cap.say(this.phase === 1 ? 'It\'s staggered! Everyone, hit it now! Roll your arms!' : 'Staggered again! Burn it!', 'BURN IT!'); }
    if (this.staggered <= 0) this.toldBurn = false;
    if (this.blasts.length) cap.say('Its arm\'s sweeping round! Duck!', 'DUCK!', { once: 'sweep' });
    if (this.phase >= 2 && this.staggered <= 0) cap.say('It\'s panicking! Watch it, it might trip over itself.', '', { once: 'panic', polite: true });
  }
}

