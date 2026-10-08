import { Juice, clamp } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';

/* Pop Party. Balloons rise, hands pop them. The gentlest game in the set and
   the one a two-year-old can play without being told anything. */
export default {
  id:'pop-party', name:'Pop Party', stars:2, accent:'#ff5d9e', secs:60,
  howto:['Touch a balloon to pop it', 'Black balloons cost a life', 'Rainbow balloons are worth five'],
  create(n){ return new PopParty(n); }
};

const HUES = [340, 20, 48, 140, 195, 265];

class PopParty {
  constructor(players){
    this.players = players;
    this.score = [0, 0];
    this.lives = [3, 3];
    this.balloons = [];
    this.j = new Juice();
    this.t = 0; this.spawn = 0; this.over = false;
  }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);

    /* Difficulty ramps across the round rather than sitting flat, so the last
       fifteen seconds feel like they matter. */
    const ramp = 1 + this.t / 45;
    this.spawn -= dt * ramp;
    if (this.spawn <= 0){
      this.spawn = 0.42 + Math.random() * 0.4;
      this.balloons.push(this._make());
    }

    for (const b of this.balloons){
      b.y -= b.speed * dt;
      b.x += Math.sin(this.t * b.wob + b.phase) * 0.035 * dt;
      b.age += dt;
    }

    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p.present) continue;
      for (const hand of [p.hands.left, p.hands.right]){
        for (const b of this.balloons){
          if (b.dead) continue;
          const d = Math.hypot((hand.x - b.x) * (W / H), hand.y - b.y);
          if (d < b.r * 1.15) this._hit(b, i, W, H);
        }
      }
    }

    this.balloons = this.balloons.filter(b => !b.dead && b.y > -0.18);
  }

  _make(){
    const roll = Math.random();
    const kind = roll < 0.12 ? 'doom' : (roll < 0.2 ? 'rainbow' : 'normal');
    return {
      x: 0.08 + Math.random() * 0.84, y: 1.15,
      r: kind === 'rainbow' ? 0.055 : 0.062,
      speed: 0.12 + Math.random() * 0.1,
      hue: HUES[(Math.random() * HUES.length) | 0],
      wob: 1.4 + Math.random() * 1.6, phase: Math.random() * 6.28,
      kind, age: 0, dead: false
    };
  }

  _hit(b, who, W, H){
    b.dead = true;
    const px = b.x * W, py = b.y * H, col = PLAYER_COLORS[who];
    if (b.kind === 'doom'){
      this.lives[who] = Math.max(0, this.lives[who] - 1);
      sfx.buzz(); this.j.kick(26);
      this.j.burst(px, py, '#2a2340', 22, 1.3);
      this.j.pop(px, py, '−1 life', 'var(--bad)');
      if (this.lives.slice(0, this.players).every(l => l <= 0)) this.over = true;
      return;
    }
    const worth = b.kind === 'rainbow' ? 5 : 1;
    this.score[who] += worth;
    if (b.kind === 'rainbow'){ sfx.gold(); this.j.kick(12); }
    else sfx.pop();
    this.j.burst(px, py, b.kind === 'rainbow' ? '#ffd24a' : `hsl(${b.hue} 90% 62%)`, worth * 5 + 10);
    this.j.pop(px, py, '+' + worth, col);
  }

  draw(c, W, H){
    const shook = this.j.applyShake(c);
    for (const b of this.balloons){
      const x = b.x * W, y = b.y * H, r = b.r * H;
      c.beginPath();
      c.moveTo(x, y + r);
      c.lineTo(x - r * 0.12, y + r * 1.3);
      c.lineTo(x + r * 0.12, y + r * 1.3);
      c.closePath();
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fill();

      let fill;
      if (b.kind === 'doom') fill = '#15102b';
      else if (b.kind === 'rainbow'){
        const g = c.createLinearGradient(x - r, y - r, x + r, y + r);
        for (let k = 0; k <= 5; k++) g.addColorStop(k / 5, `hsl(${(k * 60 + this.t * 90) % 360} 92% 62%)`);
        fill = g;
      } else fill = `hsl(${b.hue} 88% 60%)`;

      c.fillStyle = fill;
      c.beginPath(); c.ellipse(x, y, r * 0.86, r, 0, 0, 6.2832); c.fill();
      if (b.kind === 'doom'){
        c.strokeStyle = '#ff5d73'; c.lineWidth = Math.max(3, H * 0.006); c.stroke();
      }
      c.fillStyle = 'rgba(255,255,255,.4)';
      c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.35, r * 0.2, r * 0.26, -0.5, 0, 6.2832); c.fill();
    }
    this.j.draw(c, H);
    if (shook) c.restore();
  }

  hud(){
    return { score: this.score, lives: this.lives, showLives: true };
  }

  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++){
      rows.push({ label: `Player ${i + 1}`, value: this.score[i], color: PLAYER_COLORS[i] });
    }
    return rows;
  }
  winner(){
    if (this.players < 2) return null;
    if (this.score[0] === this.score[1]) return -1;
    return this.score[0] > this.score[1] ? 0 : 1;
  }
  value(){ return Math.max(...this.score.slice(0, this.players)); }
}
