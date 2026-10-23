import { Juice, clamp } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';

/* Goal Guard. Balls come at a goal behind you and you block them with a hand.
   The only defensive game in the set: everything else rewards reaching for
   something, this one rewards getting in the way. */
export default {
  id:'goal-guard', name:'Goal Guard', stars:2, accent:'#4aa8ff', secs:60,
  howto:['Block the balls with either hand', 'Each one you miss is a life', 'Gold shots are worth three'],
  create(n){ return new GoalGuard(n); }
};

const LINE = 0.82;       /* where a shot counts as past you */

class GoalGuard {
  constructor(players){
    this.players = players;
    this.score = [0, 0];
    this.lives = [3, 3];
    this.shots = [];
    this.j = new Juice();
    this.t = 0; this.spawn = 1.0; this.over = false;
  }

  /* With two players the goal is split down the middle and each defends a
     half, which keeps them out of each other's arms. */
  _lane(i){
    if (this.players < 2) return [0.08, 0.92];
    return i === 0 ? [0.06, 0.49] : [0.51, 0.94];
  }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);

    this.spawn -= dt * (1 + this.t / 36);
    if (this.spawn <= 0){
      this.spawn = 0.8 + Math.random() * 0.5;
      const who = this.players < 2 ? 0 : (Math.random() < 0.5 ? 0 : 1);
      const [lo, hi] = this._lane(who);
      const gold = Math.random() < 0.18;
      this.shots.push({
        x: lo + Math.random() * (hi - lo), y: -0.1,
        vy: 0.3 + Math.random() * 0.16,
        drift: (Math.random() - 0.5) * 0.06,
        r: gold ? 0.042 : 0.048,
        gold, target: who, done: false
      });
    }

    for (const s of this.shots){
      s.y += s.vy * dt;
      s.x = clamp(s.x + s.drift * dt, 0.04, 0.96);
    }

    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p.present) continue;
      for (const hand of [p.hands.left, p.hands.right]){
        for (const s of this.shots){
          if (s.done) continue;
          const d = Math.hypot((hand.x - s.x) * (W / H), hand.y - s.y);
          if (d < s.r * 1.6) this._block(s, i, W, H);
        }
      }
    }

    for (const s of this.shots){
      if (s.done || s.y < LINE) continue;
      s.done = true;
      const who = s.target;
      this.lives[who] = Math.max(0, this.lives[who] - 1);
      sfx.lose(); this.j.kick(26);
      this.j.burst(s.x * W, LINE * H, '#ff5d73', 22, 1.2);
      this.j.pop(s.x * W, LINE * H - H * 0.05, 'goal!', '#ff5d73');
      if (this.lives.slice(0, this.players).every(l => l <= 0)) this.over = true;
    }

    this.shots = this.shots.filter(s => !s.done);
  }

  _block(s, who, W, H){
    s.done = true;
    const worth = s.gold ? 3 : 1;
    this.score[who] += worth;
    if (s.gold){ sfx.gold(); this.j.kick(12); } else sfx.thud();
    this.j.burst(s.x * W, s.y * H, s.gold ? '#ffd24a' : '#4aa8ff', worth * 6 + 10);
    this.j.pop(s.x * W, s.y * H, '+' + worth, PLAYER_COLORS[who]);
  }

  draw(c, W, H){
    const shook = this.j.applyShake(c);

    /* The goal line, and the lane each player owns. */
    for (let i = 0; i < this.players; i++){
      const [lo, hi] = this._lane(i);
      c.fillStyle = PLAYER_COLORS[i];
      c.globalAlpha = 0.1;
      c.fillRect(lo * W, LINE * H, (hi - lo) * W, H * 0.18);
      c.globalAlpha = 0.65;
      c.lineWidth = Math.max(4, H * 0.008);
      c.strokeStyle = PLAYER_COLORS[i];
      c.beginPath(); c.moveTo(lo * W, LINE * H); c.lineTo(hi * W, LINE * H); c.stroke();
      c.globalAlpha = 1;
    }

    for (const s of this.shots){
      const x = s.x * W, y = s.y * H, r = s.r * H;
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.beginPath(); c.ellipse(x, y + r * 0.3, r * 1.05, r * 0.9, 0, 0, 6.2832); c.fill();
      c.fillStyle = s.gold ? '#ffd24a' : '#e8edff';
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.strokeStyle = s.gold ? '#b8891f' : '#8a93c4';
      c.lineWidth = Math.max(2, H * 0.004);
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
      c.beginPath(); c.arc(x, y, r * 0.45, 0, 6.2832); c.stroke();
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
