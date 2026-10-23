import { Juice } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';

/* Dodge Storm. Rocks sweep across and you move your whole body out of the
   way. Nothing is scored by reaching, so it is the one game a child plays
   with their feet - and the one that works best when they cannot yet aim. */
export default {
  id:'dodge-storm', name:'Dodge Storm', stars:2, accent:'#b06bff', secs:60,
  howto:['Move your body out of the way', 'Rocks flash before they fall', 'Stay alive to keep scoring'],
  create(n){ return new DodgeStorm(n); }
};

const WARN = 0.85;       /* telegraph, generous on purpose */
const GRACE = 1.1;       /* seconds of invulnerability after a hit */

class DodgeStorm {
  constructor(players){
    this.players = players;
    this.score = [0, 0];
    this.lives = [3, 3];
    this.hurt = [0, 0];
    this.rocks = [];
    this.j = new Juice();
    this.t = 0; this.spawn = 1.0; this.over = false;
  }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);

    /* Surviving is the score. A second upright is a point, so standing still
       in a safe corner still earns - just far less than a clean round. */
    for (let i = 0; i < this.players; i++){
      if (this.lives[i] > 0 && pose.players[i].present) this.score[i] += dt * 10;
      this.hurt[i] = Math.max(0, this.hurt[i] - dt);
    }

    this.spawn -= dt * (1 + this.t / 32);
    if (this.spawn <= 0){
      this.spawn = 0.75 + Math.random() * 0.5;
      this.rocks.push({
        x: 0.1 + Math.random() * 0.8, y: -0.12,
        vy: 0.34 + Math.random() * 0.18,
        r: 0.055 + Math.random() * 0.03,
        spin: Math.random() * 6.28, spinV: (Math.random() - 0.5) * 3,
        warn: WARN, hit: false
      });
    }

    for (const rk of this.rocks){
      if (rk.warn > 0){ rk.warn -= dt; continue; }
      rk.y += rk.vy * dt;
      rk.spin += rk.spinV * dt;
    }

    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p.present || this.hurt[i] > 0 || this.lives[i] <= 0) continue;
      /* The body, not a hand. scale comes from shoulder-to-hip distance, so a
         child further back is a smaller target in exactly the way they look. */
      const rad = Math.max(0.06, p.scale * 0.42);
      for (const rk of this.rocks){
        if (rk.hit || rk.warn > 0) continue;
        const d = Math.hypot((p.centre.x - rk.x) * (W / H), p.centre.y - rk.y);
        if (d < rad + rk.r) this._strike(rk, i, W, H);
      }
    }

    this.rocks = this.rocks.filter(rk => !rk.hit && rk.y < 1.25);
  }

  _strike(rk, who, W, H){
    rk.hit = true;
    this.hurt[who] = GRACE;
    this.lives[who] = Math.max(0, this.lives[who] - 1);
    sfx.thud(); this.j.kick(32);
    this.j.burst(rk.x * W, rk.y * H, '#8a6bb0', 26, 1.4);
    this.j.pop(rk.x * W, rk.y * H, '−1 life', '#ff5d73');
    if (this.lives.slice(0, this.players).every(l => l <= 0)) this.over = true;
  }

  draw(c, W, H){
    const shook = this.j.applyShake(c);

    for (const rk of this.rocks){
      const x = rk.x * W, r = rk.r * H;
      if (rk.warn > 0){
        /* A column of light down the lane it will fall in. */
        const k = 1 - rk.warn / WARN;
        c.fillStyle = `rgba(255,93,115,${0.07 + k * 0.16})`;
        c.fillRect(x - r * 1.4, 0, r * 2.8, H);
        c.strokeStyle = `rgba(255,93,115,${0.3 + k * 0.5})`;
        c.lineWidth = Math.max(2, H * 0.004);
        c.beginPath(); c.arc(x, H * 0.08, r * (1.5 - k * 0.5), 0, 6.2832); c.stroke();
        continue;
      }
      const y = rk.y * H;
      c.save(); c.translate(x, y); c.rotate(rk.spin);
      c.fillStyle = '#6b5a8f';
      c.beginPath();
      for (let k = 0; k < 7; k++){
        const a = (k / 7) * 6.2832, rr = r * (0.82 + ((k * 37) % 10) / 40);
        k ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
          : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath(); c.fill();
      c.fillStyle = '#8a76b5';
      c.beginPath(); c.arc(-r * 0.22, -r * 0.24, r * 0.3, 0, 6.2832); c.fill();
      c.restore();
    }

    /* A ring around each player while they are still mortal, so "it did not
       hit me" and "I was already hurt" are visibly different. */
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p.present || this.lives[i] <= 0) continue;
      const rad = Math.max(0.06, p.scale * 0.42) * H;
      c.strokeStyle = PLAYER_COLORS[i];
      c.globalAlpha = this.hurt[i] > 0 ? 0.3 + 0.4 * Math.abs(Math.sin(this.t * 18)) : 0.45;
      c.lineWidth = Math.max(3, H * 0.007);
      c.beginPath(); c.arc(p.centre.x * W, p.centre.y * H, rad, 0, 6.2832); c.stroke();
      c.globalAlpha = 1;
    }

    this.j.draw(c, H);
    if (shook) c.restore();
  }

  hud(){
    return { score: this.score.map(s => Math.floor(s)), lives: this.lives, showLives: true };
  }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++)
      rows.push({ label:`Player ${i + 1}`, value:Math.floor(this.score[i]), color:PLAYER_COLORS[i] });
    return rows;
  }
  winner(){
    if (this.players < 2) return null;
    const a = Math.floor(this.score[0]), b = Math.floor(this.score[1]);
    return a === b ? -1 : (a > b ? 0 : 1);
  }
  value(){ return Math.floor(Math.max(...this.score.slice(0, this.players))); }
}
