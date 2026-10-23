import { Juice } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';

/* Mole Mash. Moles come up out of holes and you bop them. The easiest thing
   here for a three-year-old: the targets sit in fixed places, they announce
   themselves before they count, and nothing moves while you are reaching. */
export default {
  id:'mole-mash', name:'Mole Mash', stars:1, accent:'#9b6b43', secs:60,
  howto:['Touch a mole to bop it', 'Gold moles are worth five', 'Leave the grumpy ones alone'],
  create(n){ return new MoleMash(n); }
};

const COLS = 4, ROWS = 2;
const UP = 1.5;          /* seconds a mole stays reachable */
const PEEK = 0.28;       /* telegraph before it counts, so nobody is ambushed */

class MoleMash {
  constructor(players){
    this.players = players;
    this.score = [0, 0];
    this.lives = [3, 3];
    this.j = new Juice();
    this.t = 0; this.spawn = 0.6; this.over = false;

    this.holes = [];
    for (let r = 0; r < ROWS; r++){
      for (let col = 0; col < COLS; col++){
        this.holes.push({
          x: 0.16 + col * (0.68 / (COLS - 1)),
          y: 0.40 + r * 0.30,
          mole: null
        });
      }
    }
  }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);

    this.spawn -= dt * (1 + this.t / 40);
    if (this.spawn <= 0){
      this.spawn = 0.5 + Math.random() * 0.45;
      const free = this.holes.filter(h => !h.mole);
      if (free.length){
        const hole = free[(Math.random() * free.length) | 0];
        const roll = Math.random();
        hole.mole = {
          kind: roll < 0.14 ? 'grumpy' : (roll < 0.26 ? 'gold' : 'plain'),
          age: 0, up: 0, dead: false
        };
      }
    }

    for (const hole of this.holes){
      const m = hole.mole;
      if (!m) continue;
      m.age += dt;
      /* Rise, hold, duck. The rise is the telegraph; a bop during it still
         counts, because a child who commits early should not be punished. */
      m.up = m.age < PEEK ? m.age / PEEK
           : m.age > UP ? Math.max(0, 1 - (m.age - UP) / 0.3) : 1;
      if (m.age > UP + 0.3) hole.mole = null;
    }

    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p.present) continue;
      for (const hand of [p.hands.left, p.hands.right]){
        for (const hole of this.holes){
          const m = hole.mole;
          if (!m || m.dead || m.up < 0.25) continue;
          const d = Math.hypot((hand.x - hole.x) * (W / H), hand.y - hole.y);
          if (d < 0.085) this._bop(hole, i, W, H);
        }
      }
    }
  }

  _bop(hole, who, W, H){
    const m = hole.mole;
    m.dead = true; hole.mole = null;
    const px = hole.x * W, py = hole.y * H;

    if (m.kind === 'grumpy'){
      this.lives[who] = Math.max(0, this.lives[who] - 1);
      sfx.buzz(); this.j.kick(24);
      this.j.burst(px, py, '#6b4a8f', 20, 1.2);
      this.j.pop(px, py, '−1 life', '#ff5d73');
      if (this.lives.slice(0, this.players).every(l => l <= 0)) this.over = true;
      return;
    }
    const worth = m.kind === 'gold' ? 5 : 1;
    this.score[who] += worth;
    if (m.kind === 'gold'){ sfx.gold(); this.j.kick(10); } else sfx.thud();
    this.j.burst(px, py, m.kind === 'gold' ? '#ffd24a' : '#c08a52', worth * 4 + 10);
    this.j.pop(px, py, '+' + worth, PLAYER_COLORS[who]);
  }

  draw(c, W, H){
    const shook = this.j.applyShake(c);
    const R = H * 0.085;

    for (const hole of this.holes){
      const x = hole.x * W, y = hole.y * H;

      c.fillStyle = '#1b1430';
      c.beginPath(); c.ellipse(x, y + R * 0.45, R, R * 0.42, 0, 0, 6.2832); c.fill();

      const m = hole.mole;
      if (m){
        const rise = R * 1.25 * m.up;
        c.save();
        c.beginPath(); c.ellipse(x, y + R * 0.45, R, R * 0.42, 0, 0, 6.2832);
        c.rect(x - R, y - R * 3, R * 2, R * 3);
        c.clip();

        const my = y + R * 0.4 - rise;
        c.fillStyle = m.kind === 'gold' ? '#ffd24a'
                    : m.kind === 'grumpy' ? '#7a52a8' : '#b07c4b';
        c.beginPath(); c.ellipse(x, my, R * 0.74, R * 0.82, 0, 0, 6.2832); c.fill();

        c.fillStyle = '#fff';
        for (const s of [-1, 1]){
          c.beginPath(); c.arc(x + s * R * 0.27, my - R * 0.14, R * 0.2, 0, 6.2832); c.fill();
        }
        c.fillStyle = '#1a1333';
        for (const s of [-1, 1]){
          c.beginPath(); c.arc(x + s * R * 0.27, my - R * 0.12, R * 0.1, 0, 6.2832); c.fill();
        }
        c.fillStyle = '#1a1333';
        if (m.kind === 'grumpy'){
          c.lineWidth = Math.max(3, R * 0.1); c.strokeStyle = '#1a1333';
          c.beginPath(); c.arc(x, my + R * 0.42, R * 0.26, Math.PI, 0); c.stroke();
        } else {
          c.beginPath(); c.ellipse(x, my + R * 0.3, R * 0.2, R * 0.15, 0, 0, Math.PI); c.fill();
        }
        c.restore();

        /* A ring while it is still rising: something is coming, here. */
        if (m.up < 1){
          c.strokeStyle = 'rgba(255,255,255,.35)';
          c.lineWidth = Math.max(2, H * 0.004);
          c.beginPath(); c.arc(x, y, R * (1.5 - m.up * 0.4), 0, 6.2832); c.stroke();
        }
      }
    }
    this.j.draw(c, H);
    if (shook) c.restore();
  }

  hud(){ return { score: this.score, lives: this.lives, showLives: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++)
      rows.push({ label:`Player ${i + 1}`, value:this.score[i], color:PLAYER_COLORS[i] });
    return rows;
  }
  winner(){
    if (this.players < 2) return null;
    return this.score[0] === this.score[1] ? -1 : (this.score[0] > this.score[1] ? 0 : 1);
  }
  value(){ return Math.max(...this.score.slice(0, this.players)); }
}
