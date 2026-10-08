import { Juice } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';

/* Star Snatch. Stars fall, hands catch them. Catching needs a short hold, so
   it rewards reaching deliberately rather than flailing - which is the thing
   that separates it from Pop Party. */
export default {
  id:'star-snatch', name:'Star Snatch', stars:2, accent:'#ffd24a', secs:60,
  howto:['Touch a star and hold it for a moment', 'Dark stars take points away', 'Fast ones are worth more'],
  create(n){ return new StarSnatch(n); }
};

const HOLD = 0.35;

class StarSnatch {
  constructor(players){
    this.players = players;
    this.score = [0, 0];
    this.stars = [];
    this.j = new Juice();
    this.t = 0; this.spawn = 0; this.over = false;
  }

  step(dt, W, H){
    this.t += dt; this.j.step(dt);
    this.spawn -= dt * (1 + this.t / 50);
    if (this.spawn <= 0){
      this.spawn = 0.5 + Math.random() * 0.45;
      const fast = Math.random() < 0.3;
      this.stars.push({
        x: 0.08 + Math.random() * 0.84, y: -0.1,
        speed: fast ? 0.34 + Math.random() * 0.16 : 0.16 + Math.random() * 0.1,
        worth: fast ? 3 : 1,
        void: Math.random() < 0.15,
        spin: Math.random() * 6.28, held: 0, by: -1, dead: false, r: 0.05
      });
    }

    for (const s of this.stars){
      s.y += s.speed * dt; s.spin += dt * 1.8;
      let toucher = -1;
      for (let i = 0; i < this.players && toucher < 0; i++){
        const p = pose.players[i];
        if (!p.present) continue;
        for (const hand of [p.hands.left, p.hands.right]){
          const d = Math.hypot((hand.x - s.x) * (W / H), hand.y - s.y);
          if (d < s.r * 1.3){ toucher = i; break; }
        }
      }
      if (toucher >= 0){
        if (s.void){ this._void(s, toucher, W, H); continue; }
        if (s.by !== toucher){ s.by = toucher; s.held = 0; }
        s.held += dt;
        if (s.held >= HOLD) this._bank(s, toucher, W, H);
      } else { s.by = -1; s.held = Math.max(0, s.held - dt * 2); }
    }
    this.stars = this.stars.filter(s => !s.dead && s.y < 1.2);
  }

  _bank(s, who, W, H){
    s.dead = true;
    this.score[who] += s.worth;
    sfx.gold(); this.j.kick(8);
    this.j.burst(s.x * W, s.y * H, '#ffd24a', 18, 1.1);
    this.j.pop(s.x * W, s.y * H, '+' + s.worth, PLAYER_COLORS[who]);
  }
  _void(s, who, W, H){
    s.dead = true;
    this.score[who] = Math.max(0, this.score[who] - 2);
    sfx.buzz(); this.j.kick(20);
    this.j.burst(s.x * W, s.y * H, '#5b4b8a', 20, 1.2);
    this.j.pop(s.x * W, s.y * H, '−2', '#ff5d73');
  }

  draw(c, W, H){
    const shook = this.j.applyShake(c);
    for (const s of this.stars){
      const x = s.x * W, y = s.y * H, r = s.r * H;
      c.save(); c.translate(x, y); c.rotate(s.spin);
      c.beginPath();
      for (let i = 0; i < 10; i++){
        const rr = i % 2 ? r * 0.45 : r;
        const a = (i / 10) * 6.2832 - Math.PI / 2;
        i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
          : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
      c.fillStyle = s.void ? '#1b1436' : (s.worth > 1 ? '#fff0a8' : '#ffd24a');
      c.fill();
      c.lineWidth = Math.max(2, H * 0.004);
      c.strokeStyle = s.void ? '#7a5cff' : 'rgba(0,0,0,.35)'; c.stroke();
      c.restore();
      if (s.held > 0 && !s.void){
        c.strokeStyle = PLAYER_COLORS[s.by] || '#fff';
        c.lineWidth = Math.max(4, H * 0.009);
        c.beginPath(); c.arc(x, y, r * 1.5, -Math.PI/2, -Math.PI/2 + (s.held/HOLD) * 6.2832); c.stroke();
      }
    }
    this.j.draw(c, H);
    if (shook) c.restore();
  }

  hud(){ return { score: this.score, showLives: false }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++)
      rows.push({ label:`Player ${i + 1}`, value:this.score[i], color:PLAYER_COLORS[i] });
    return rows;
  }
  winner(){
    if (this.players < 2) return null;
    if (this.score[0] === this.score[1]) return -1;
    return this.score[0] > this.score[1] ? 0 : 1;
  }
  value(){ return Math.max(...this.score.slice(0, this.players)); }
}
