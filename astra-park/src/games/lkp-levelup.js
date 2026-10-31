/* Levelling up. The team shares its XP and levels together - from the
   things they knock out, the rooms they get through, the treasure, the
   boss (XP) - at each of THRESHOLDS. Each level up, when things are calm
   (in a corridor, or at the doors before they're chosen - never in the
   middle of a fight), the game stops and every player gets three cards
   to pick from, of UPGRADES: lean to choose - left, middle, right - and
   wave to take it. Once everyone has (or after `len` seconds, whatever
   they're leaning towards), the upgrades are theirs, and on they go.
   Picking the same one again stacks it. */
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { WaveWatch, handsFrom } from '../tracking/wave.js';

/* XP for each level after the first: level 2 at 100, ... */
export const THRESHOLDS = [100, 220, 360, 520, 700, 900, 1120];
/* What each thing's worth. */
export const XP = { kill: 10, fight: 50, trap: 75, trapTimeout: 25, treasure: 25, boss: 300 };
/* The upgrades: what it's called (a word or two), a picture, and what it
   does to a crew member. */
export const UPGRADES = {
  fists: { name: 'STRONGER', icon: '\u{1F44A}', apply: (rn) => { rn.fists = (rn.fists || 1) + 0.25; } },
  wheels: { name: 'ARM ROLL', icon: '\u{1F504}', apply: (rn) => { rn.wheels = (rn.wheels || 1) + 0.3; } },
  vitality: { name: 'HEALTH', icon: '\u{2764}\u{FE0F}', apply: (rn) => { rn.max += 20; rn.hp = Math.min(rn.max, rn.hp + 20); } },
  swift: { name: 'SPEED', icon: '\u{1F45F}', apply: (rn) => { rn.swift = (rn.swift || 1) + 0.2; } }
};
export const PICK_TIME = 30;

/* The XP needed to reach level lvl + 1. */
export const needFor = (lvl) => THRESHOLDS[Math.min(lvl - 1, THRESHOLDS.length - 1)] + Math.max(0, lvl - THRESHOLDS.length) * 250;

export class LevelUp {
  constructor(game, len = PICK_TIME){
    this.g = game; this.len = len; this.t = 0; this.done = false;
    const keys = Object.keys(UPGRADES);
    /* Three of the four for each player, in a random order. */
    this.cards = pose.players.map(() => keys.slice().sort(() => Math.random() - 0.5).slice(0, 3));
    this.at = pose.players.map(() => 1);
    this.took = pose.players.map(() => null);
    this.waves = pose.players.map(() => new WaveWatch());
    sfx.learnt();
  }

  step(dt){
    const g = this.g;
    this.t += dt;
    for (const i of g.here){
      if (this.took[i] != null) continue;
      const lean = g.leanOf(i) ?? 0;
      this.at[i] = lean < -0.33 ? 0 : lean > 0.33 ? 2 : 1;
      this.waves[i].step(dt, handsFrom(pose, g.players).filter(h => h.who === i));
      if (this.waves[i].done){ this.took[i] = this.at[i]; sfx.pick(); }
    }
    if ((g.here.length && g.here.every(i => this.took[i] != null)) || this.t >= this.len) this._finish();
  }

  _finish(){
    const g = this.g;
    for (const i of g.here){
      const k = this.took[i] ?? this.at[i];
      UPGRADES[this.cards[i][k]].apply(g.crew[i]);
    }
    this.done = true; sfx.select();
  }

  /* Over the game, dimmed: LEVEL UP, and a row of three cards for each
     player, in their colour - the one they're leaning to lifted, the one
     they've taken lit with a tick. */
  draw(c, W, H){
    const g = this.g, here = g.here;
    c.save();
    c.fillStyle = 'rgba(5,6,15,.72)'; c.fillRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${Math.round(H * 0.08)}px Fredoka, sans-serif`;
    c.lineWidth = H * 0.012; c.strokeStyle = '#05060f'; c.strokeText(`LEVEL ${g.lvl}!`, W / 2, H * 0.1);
    c.fillStyle = '#ffd24a'; c.fillText(`LEVEL ${g.lvl}!`, W / 2, H * 0.1);
    const rowH = Math.min(H * 0.2, H * 0.78 / Math.max(1, here.length)), cw = rowH * 1.25, gap = cw * 0.25;
    here.forEach((i, r) => {
      const y = H * 0.2 + r * rowH + rowH * 0.05, col = PLAYER_COLORS[i];
      c.fillStyle = col; c.beginPath(); c.arc(W / 2 - (cw * 1.5 + gap) - rowH * 0.5, y + rowH * 0.42, rowH * 0.22, 0, 6.2832); c.fill();
      for (let k = 0; k < 3; k++){
        const up = UPGRADES[this.cards[i][k]], x = W / 2 + (k - 1) * (cw + gap), took = this.took[i] === k, on = this.took[i] == null ? this.at[i] === k : took;
        const lift = on ? -rowH * 0.06 : 0, dim = this.took[i] != null && !took;
        c.globalAlpha = dim ? 0.35 : 1;
        c.fillStyle = took ? col : on ? '#2a3350' : '#151a2c'; c.strokeStyle = on ? col : 'rgba(255,255,255,.2)'; c.lineWidth = on ? H * 0.008 : 2;
        c.beginPath(); c.roundRect(x - cw / 2, y + lift, cw, rowH * 0.84, rowH * 0.1); c.fill(); c.stroke();
        c.font = `${Math.round(rowH * 0.34)}px sans-serif`; c.fillStyle = '#ffffff';
        c.fillText(up.icon, x, y + lift + rowH * 0.32);
        c.font = `700 ${Math.round(rowH * 0.15)}px Fredoka, sans-serif`;
        c.fillText(up.name, x, y + lift + rowH * 0.66);
        if (took){ c.font = `${Math.round(rowH * 0.2)}px sans-serif`; c.fillText('✔️', x + cw * 0.38, y + lift + rowH * 0.12); }
        c.globalAlpha = 1;
      }
    });
    /* The time left. */
    const u = Math.max(0, 1 - this.t / this.len), w = W * 0.3;
    c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(W / 2 - w / 2, H * 0.965, w, H * 0.012);
    c.fillStyle = '#ffd24a'; c.fillRect(W / 2 - w / 2, H * 0.965, w * u, H * 0.012);
    c.restore();
  }
}
