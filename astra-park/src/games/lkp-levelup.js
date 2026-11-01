/* Levelling up, the Vampire Survivors way: the team shares its XP and
   levels together, and levels up often - from the things they knock out,
   the rooms they get through, the treasure, the boss (XP). Level ups can
   come at any time, mid-fight too ("LEVEL UP!" and a star beside the
   level for each one waiting), but they're picked between rooms: as the
   next corridor starts, or at the doors before they're chosen, the game
   stops and, for each level waiting, every player gets three cards to
   pick from - upgrades for their weapons and themselves (lkp-weapons.js):
   lean to choose - left, middle, right - and wave to take it. Once everyone has (or after `len` seconds, whatever
   they're leaning towards), the upgrades are theirs, and on they go.
   Picking the same one again stacks it. */
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { WaveWatch, handsFrom } from '../tracking/wave.js';
import { CARDS, cardsFor, cardIcon, take, MELEE } from './lkp-weapons.js';

/* The XP from one level to the next: FIRST to level 2, then STEP more
   each level after - often at first, and steadily less often. */
export const FIRST = 30, STEP = 15;
/* What each thing's worth. */
export const XP = { kill: 10, fight: 50, trap: 75, trapTimeout: 25, treasure: 25, boss: 300 };
export const PICK_TIME = 30;

/* The XP needed to go from level lvl to the next. */
export const needFor = (lvl) => FIRST + STEP * (lvl - 1);

/* Choosing, everyone at once: a title, and for each player a row of two
   or three cards ({ name, icon, take(rn) }) - lean to choose (left,
   middle, right; or left, right) and wave to take it. Once everyone has
   (or after len seconds, whatever they're leaning to), each card's
   taken. For a level up, and for picking a weapon. */
export class Pick {
  constructor(game, len, title, offer){
    this.g = game; this.len = len; this.t = 0; this.done = false; this.title = title;
    this.cards = pose.players.map((_, i) => offer(i, game.crew[i]));
    this.at = this.cards.map(c => (c.length === 3 ? 1 : 0));
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
      this.at[i] = this.cards[i].length === 3 ? (lean < -0.33 ? 0 : lean > 0.33 ? 2 : 1) : (lean < 0 ? 0 : 1);
      this.waves[i].step(dt, handsFrom(pose, g.players).filter(h => h.who === i));
      if (this.waves[i].done){ this.took[i] = this.at[i]; sfx.pick(); }
    }
    if ((g.here.length && g.here.every(i => this.took[i] != null)) || this.t >= this.len) this._finish();
  }

  _finish(){
    const g = this.g;
    for (const i of g.here){
      const k = this.took[i] ?? this.at[i];
      this.cards[i][k].take(g.crew[i]);
    }
    this.done = true; sfx.select();
  }

  /* Over the game, dimmed: the title, and a row of cards for each
     player, in their colour - the one they're leaning to lifted, the one
     they've taken lit with a tick. */
  /* Everyone choosing between the same cards: just those, big, side by
     side - and under each, a dot in the colour of everyone leaning to it,
     with a tick once they've taken it. */
  _drawShared(c, W, H){
    const g = this.g, cards = this.cards[g.here[0] ?? 0], n = cards.length, cw = H * 0.42, ch = H * 0.5, gap = H * 0.12;
    cards.forEach((card, k) => {
      const x = W / 2 + (k - (n - 1) / 2) * (cw + gap), y = H * 0.2;
      const who = g.here.filter(i => (this.took[i] ?? this.at[i]) === k);
      c.fillStyle = who.length ? '#2a3350' : '#151a2c'; c.strokeStyle = who.length ? '#ffd24a' : 'rgba(255,255,255,.2)'; c.lineWidth = who.length ? H * 0.008 : 2;
      c.beginPath(); c.roundRect(x - cw / 2, y, cw, ch, H * 0.04); c.fill(); c.stroke();
      c.fillStyle = '#ffffff';
      c.font = `${Math.round(ch * 0.4)}px sans-serif`; c.fillText(card.icon, x, y + ch * 0.4);
      c.font = `700 ${Math.round(ch * 0.12)}px Fredoka, sans-serif`; c.fillText(card.name, x, y + ch * 0.82);
      who.forEach((i, m) => {
        const dx = x + (m - (who.length - 1) / 2) * H * 0.075, dy = y + ch + H * 0.07;
        c.fillStyle = PLAYER_COLORS[i]; c.beginPath(); c.arc(dx, dy, H * 0.03, 0, 6.2832); c.fill();
        if (this.took[i] != null){
          c.strokeStyle = '#ffffff'; c.lineWidth = H * 0.008; c.lineCap = 'round';
          c.beginPath(); c.moveTo(dx - H * 0.013, dy); c.lineTo(dx - H * 0.003, dy + H * 0.011); c.lineTo(dx + H * 0.015, dy - H * 0.011); c.stroke();
        }
      });
    });
    const u = Math.max(0, 1 - this.t / this.len), w = W * 0.3;
    c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(W / 2 - w / 2, H * 0.965, w, H * 0.012);
    c.fillStyle = '#ffd24a'; c.fillRect(W / 2 - w / 2, H * 0.965, w * u, H * 0.012);
  }

  draw(c, W, H){
    const g = this.g, here = g.here;
    c.save();
    c.fillStyle = 'rgba(5,6,15,.72)'; c.fillRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${Math.round(H * 0.08)}px Fredoka, sans-serif`;
    c.lineWidth = H * 0.012; c.strokeStyle = '#05060f'; c.strokeText(this.title, W / 2, H * 0.1);
    c.fillStyle = '#ffd24a'; c.fillText(this.title, W / 2, H * 0.1);
    if (this.shared){ this._drawShared(c, W, H); c.restore(); return; }
    const rowH = Math.min(H * 0.2, H * 0.78 / Math.max(1, here.length)), cw = rowH * 1.25, gap = cw * 0.25;
    here.forEach((i, r) => {
      const y = H * 0.2 + r * rowH + rowH * 0.05, col = PLAYER_COLORS[i];
      const n = this.cards[i].length;
      c.fillStyle = col; c.beginPath(); c.arc(W / 2 - (cw * n / 2 + gap) - rowH * 0.5, y + rowH * 0.42, rowH * 0.22, 0, 6.2832); c.fill();
      for (let k = 0; k < n; k++){
        const up = this.cards[i][k], x = W / 2 + (k - (n - 1) / 2) * (cw + gap), took = this.took[i] === k, on = this.took[i] == null ? this.at[i] === k : took;
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

/* A level up: three cards each, from what their weapons and they could
   get better at (lkp-weapons.js). */
export function levelUp(game, len){
  return new Pick(game, len, `LEVEL ${game.lvl}!`, (i, rn) => cardsFor(rn).sort(() => Math.random() - 0.5).slice(0, 3)
    .map(key => ({ name: CARDS[key].name, icon: cardIcon(key, rn), take: (r) => take(key, r) })));
}

/* Picking a melee weapon, at the depot: one of MELEE each, theirs for
   good. */
export function meleePick(game, len){
  const pick = new Pick(game, len, 'PICK YOUR WEAPON', () => Object.values(MELEE)
    .map(w => ({ name: w.name, icon: w.icon, take: (r) => { r.melee = w; } })));
  /* The same two for everyone: shown once, big. */
  pick.shared = true;
  return pick;
}
