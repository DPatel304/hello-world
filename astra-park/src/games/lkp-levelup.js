/* Levelling up, the Vampire Survivors way: the team shares its XP and
   levels together, and levels up often - from the energy crystals they
   pick up (lkp-game.js gain(): in the corridors, dropped by what they
   knock out, piled up for each room got through, the boss). Level ups can
   come at any time, mid-fight too ("LEVEL UP!" and a star beside the
   level for each one waiting), but they're picked between rooms: as the
   next corridor starts, or at the doors before they're chosen, the game
   stops and, for each level waiting, three cards are drawn at random from
   the six (lkp-weapons.js) - the same three for everyone, now and then one
   gold, worth two levels. Each player takes their own: lean to choose -
   left, middle, right - and wave to take it. Under each card, a row of
   pips for each player shows how far they've taken it (MAX_LEVEL at
   most; a card they've maxed can't be taken). Once everyone has (or after
   `len` seconds, whatever they're leaning towards), on they go. */
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { WaveWatch, handsFrom } from '../tracking/wave.js';
import { CARDS, MAX_LEVEL, draw, level, take, MELEE } from './lkp-weapons.js';

/* The XP from one level to the next: FIRST to level 2, then STEP more
   each level after - often at first, and steadily less often. */
export const FIRST = 55, STEP = 32;
export const PICK_TIME = 30;

/* The XP needed to go from level lvl to the next. */
export const needFor = (lvl) => FIRST + STEP * (lvl - 1);

/* Choosing, everyone at once: a title, and for each player a row of two
   or three cards ({ name, icon, take(rn) } - and, if it's one that can
   be maxed, can(rn)) - lean to choose (left, middle, right; or left,
   right) and wave to take it. Once everyone has (or after len seconds,
   whatever they're leaning to - or, if they can't have that one, the
   first they can), each card's taken. For a level up, and for picking a
   weapon. */
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
      if (this.waves[i].done){
        if (this._can(i, this.at[i])){ this.took[i] = this.at[i]; sfx.pick(); }
        else this.waves[i] = new WaveWatch();
      }
    }
    if ((g.here.length && g.here.every(i => this.took[i] != null)) || this.t >= this.len) this._finish();
  }

  /* Whether player i can take card k (not if they've maxed it). */
  _can(i, k){
    const card = this.cards[i][k];
    return !!card && (!card.can || card.can(this.g.crew[i]));
  }

  _finish(){
    const g = this.g;
    for (const i of g.here){
      let k = this.took[i] ?? this.at[i];
      if (!this._can(i, k)) k = this.cards[i].findIndex((_, m) => this._can(i, m));
      if (k >= 0) this.cards[i][k].take(g.crew[i]);
    }
    this.done = true; sfx.select();
  }

  /* Over the game, dimmed: the title, and a row of cards for each
     player, in their colour - the one they're leaning to lifted, the one
     they've taken lit with a tick. */
  /* Everyone choosing between the same cards: just those, big, side by
     side (a gold one, gold, "x2"). Under each, a dot in the colour of
     everyone leaning to it, with a tick once they've taken it - or, for
     cards that level up, a row for each player: their dot (lit under the
     card they're leaning to), and pips for how far they've taken it. */
  _drawShared(c, W, H){
    const g = this.g, cards = this.cards[g.here[0] ?? 0], n = cards.length, pips = cards.some(cd => cd.key);
    const cw = H * (pips ? 0.4 : 0.42), ch = H * (pips ? 0.4 : 0.5), gap = H * (pips ? 0.08 : 0.12), y = H * 0.18;
    const tick = (dx, dy, r) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.27; c.lineCap = 'round';
      c.beginPath(); c.moveTo(dx - r * 0.43, dy); c.lineTo(dx - r * 0.1, dy + r * 0.37); c.lineTo(dx + r * 0.5, dy - r * 0.37); c.stroke();
    };
    cards.forEach((card, k) => {
      const x = W / 2 + (k - (n - 1) / 2) * (cw + gap);
      const who = g.here.filter(i => (this.took[i] ?? this.at[i]) === k);
      c.fillStyle = card.gold ? '#5a4512' : who.length ? '#2a3350' : '#151a2c';
      c.strokeStyle = card.gold ? '#ffd24a' : who.length ? '#ffffff' : 'rgba(255,255,255,.2)';
      c.lineWidth = card.gold || who.length ? H * 0.008 : 2;
      c.beginPath(); c.roundRect(x - cw / 2, y, cw, ch, H * 0.04); c.fill(); c.stroke();
      c.fillStyle = '#ffffff';
      c.font = `${Math.round(ch * 0.4)}px sans-serif`; c.fillText(card.icon, x, y + ch * 0.42);
      c.font = `700 ${Math.round(ch * 0.12)}px Fredoka, sans-serif`; c.fillStyle = card.gold ? '#ffd24a' : '#ffffff';
      c.fillText(card.name, x, y + ch * 0.84);
      if (card.gold){
        c.font = `700 ${Math.round(ch * 0.11)}px Fredoka, sans-serif`; c.fillStyle = '#ffd24a';
        c.fillText('\u00D72', x + cw * 0.36, y + ch * 0.1);
      }
      if (!pips){
        who.forEach((i, m) => {
          const dx = x + (m - (who.length - 1) / 2) * H * 0.075, dy = y + ch + H * 0.07;
          c.fillStyle = PLAYER_COLORS[i]; c.beginPath(); c.arc(dx, dy, H * 0.03, 0, 6.2832); c.fill();
          if (this.took[i] != null) tick(dx, dy, H * 0.03);
        });
        return;
      }
      /* A row for each player: their dot, their pips. */
      const rowH = H * 0.065, pw = cw * 0.68 / MAX_LEVEL, left = x - cw / 2 + cw * 0.2;
      g.here.forEach((i, r) => {
        const ry = y + ch + H * 0.06 + r * rowH, lv = level(g.crew[i], card.key), on = (this.took[i] ?? this.at[i]) === k;
        const maxed = lv >= MAX_LEVEL;
        c.globalAlpha = on ? 1 : 0.3;
        c.fillStyle = PLAYER_COLORS[i]; c.beginPath(); c.arc(x - cw / 2 + cw * 0.08, ry, rowH * (on ? 0.38 : 0.28), 0, 6.2832); c.fill();
        if (on && this.took[i] != null) tick(x - cw / 2 + cw * 0.08, ry, rowH * 0.38);
        c.globalAlpha = 1;
        if (maxed){
          c.font = `700 ${Math.round(rowH * 0.55)}px Fredoka, sans-serif`; c.fillStyle = 'rgba(255,255,255,.5)';
          c.fillText('MAX', left + pw * MAX_LEVEL / 2, ry);
          return;
        }
        /* What taking it now would add, shown as hollow pips. */
        const adds = on ? Math.min(MAX_LEVEL, lv + (card.gold ? 2 : 1)) : lv;
        for (let p = 0; p < MAX_LEVEL; p++){
          const px = left + p * pw + pw / 2;
          c.fillStyle = p < lv ? PLAYER_COLORS[i] : p < adds ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.15)';
          c.beginPath(); c.roundRect(px - pw * 0.35, ry - rowH * 0.25, pw * 0.7, rowH * 0.5, pw * 0.15); c.fill();
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

/* A level up: three of the six cards, drawn at random - the same three
   for everyone, each picking their own (lkp-weapons.js). */
export function levelUp(game, len, rand = Math.random, title = `LEVEL ${game.lvl}!`, allGold = false){
  const cards = draw(game.here.map(i => game.crew[i]), rand).map(({ key, gold }) => {
    gold = gold || allGold;
    return { key, gold, name: CARDS[key].name, icon: CARDS[key].icon, can: (r) => level(r, key) < MAX_LEVEL, take: (r) => take(key, r, gold) };
  });
  const pick = new Pick(game, len, title, () => cards);
  pick.shared = true;
  /* A gold card turning up: you hear it. */
  if (cards.some(c => c.gold)) sfx.gold();
  return pick;
}

/* A gold pick - every GOLD_EVERY-th level up (lkp-game.js): three cards
   like a level up's, every one gold. */
export function goldPick(game, len, rand = Math.random){
  const pick = levelUp(game, len, rand, 'GOLD PICK!', true);
  pick.goldPick = true;
  return pick;
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
