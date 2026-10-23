import { Juice } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';

/* Bubble Keeper. Bubbles drift down and you bat them back up. Nothing to
   chase and nothing to dodge: the only way to lose is to let one reach the
   floor, which makes it the game that works when the room is chaos. */
export default {
  id:'bubble-keeper', name:'Bubble Keeper', stars:1, accent:'#4ad6d6', secs:60,
  howto:['Touch a bubble to send it back up', 'Do not let one reach the floor', 'Every bounce scores'],
  create(n){ return new BubbleKeeper(n); }
};

const FLOOR = 0.94;

class BubbleKeeper {
  constructor(players){
    this.players = players;
    this.score = [0, 0];
    this.lives = [3, 3];
    this.bubbles = [];
    this.j = new Juice();
    this.t = 0; this.spawn = 0.4; this.over = false;
  }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);

    /* More bubbles rather than faster ones: a toddler can track three slow
       things far better than one quick one. */
    const want = Math.min(6, 1 + Math.floor(this.t / 11));
    this.spawn -= dt;
    if (this.spawn <= 0 && this.bubbles.length < want){
      this.spawn = 0.8 + Math.random() * 0.7;
      this.bubbles.push({
        x: 0.12 + Math.random() * 0.76, y: -0.1,
        vy: 0.055 + Math.random() * 0.03,
        r: 0.05 + Math.random() * 0.025,
        hue: [185, 265, 325, 45][(Math.random() * 4) | 0],
        cool: 0, bounces: 0, phase: Math.random() * 6.28
      });
    }

    for (const b of this.bubbles){
      b.vy += 0.045 * dt;                       /* gentle gravity */
      b.y += b.vy * dt;
      b.x += Math.sin(this.t * 0.9 + b.phase) * 0.02 * dt;
      b.cool = Math.max(0, b.cool - dt);
    }

    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p.present) continue;
      for (const hand of [p.hands.left, p.hands.right]){
        for (const b of this.bubbles){
          if (b.cool > 0) continue;
          const d = Math.hypot((hand.x - b.x) * (W / H), hand.y - b.y);
          if (d < b.r * 1.3) this._bat(b, i, W, H);
        }
      }
    }

    for (const b of this.bubbles){
      if (b.y <= FLOOR || b.gone) continue;
      b.gone = true;
      /* A dropped bubble costs whoever has lives left. With one player that is
         simply them; with two it is shared, because arguing about whose bubble
         it was is not a game. */
      for (let i = 0; i < this.players; i++) this.lives[i] = Math.max(0, this.lives[i] - 1);
      sfx.lose(); this.j.kick(22);
      this.j.burst(b.x * W, FLOOR * H, `hsl(${b.hue} 70% 55%)`, 18, 1.1);
      this.j.pop(b.x * W, FLOOR * H - H * 0.05, 'dropped!', '#ff5d73');
      if (this.lives.slice(0, this.players).every(l => l <= 0)) this.over = true;
    }
    this.bubbles = this.bubbles.filter(b => !b.gone);
  }

  _bat(b, who, W, H){
    b.vy = -(0.16 + Math.random() * 0.06);
    b.cool = 0.3;
    b.bounces++;
    this.score[who] += 1;
    sfx.pop();
    this.j.burst(b.x * W, b.y * H, `hsl(${b.hue} 85% 65%)`, 8, 0.6);
    this.j.pop(b.x * W, b.y * H, '+1', PLAYER_COLORS[who]);
  }

  draw(c, W, H){
    const shook = this.j.applyShake(c);

    c.strokeStyle = 'rgba(255,93,115,.35)';
    c.lineWidth = Math.max(3, H * 0.006);
    c.setLineDash([H * 0.02, H * 0.02]);
    c.beginPath(); c.moveTo(0, FLOOR * H); c.lineTo(W, FLOOR * H); c.stroke();
    c.setLineDash([]);

    for (const b of this.bubbles){
      const x = b.x * W, y = b.y * H, r = b.r * H;
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, `hsla(${b.hue} 95% 78% / .95)`);
      g.addColorStop(1, `hsla(${b.hue} 85% 52% / .55)`);
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.strokeStyle = `hsla(${b.hue} 95% 85% / .8)`;
      c.lineWidth = Math.max(2, H * 0.004);
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)';
      c.beginPath(); c.ellipse(x - r * 0.33, y - r * 0.36, r * 0.16, r * 0.22, -0.5, 0, 6.2832); c.fill();
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
