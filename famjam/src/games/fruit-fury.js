import { Juice } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';

/* Fruit Fury. Fruit is thrown up and you cut it with a swing. The only game
   here that reads hand *speed* rather than position, so resting a palm on
   something does nothing - you have to actually swipe, which is what makes it
   feel different from Pop Party rather than a reskin of it. */
export default {
  id:'fruit-fury', name:'Fruit Fury', stars:3, accent:'#53e59a', secs:60,
  howto:['Swing a hand through the fruit to slice it', 'A slow touch will not cut', 'Do not hit the bombs'],
  create(n){ return new FruitFury(n); }
};

/* Screen-widths per second. Measured against a deliberate swipe rather than
   chosen: a hand resting and drifting sits well under 0.4, a swing clears 1.5. */
const SWING = 1.1;
const G = 0.62;

const FRUIT = [
  { name:'melon',  col:'#53e59a', inner:'#ff6b8a', worth:1 },
  { name:'orange', col:'#ff9f45', inner:'#ffd9a0', worth:1 },
  { name:'plum',   col:'#b06bff', inner:'#ffd4f2', worth:1 },
  { name:'berry',  col:'#ff5d73', inner:'#ffc2cb', worth:2 }
];

class FruitFury {
  constructor(players){
    this.players = players;
    this.score = [0, 0];
    this.lives = [3, 3];
    this.items = [];
    this.trails = [[], []];
    this.j = new Juice();
    this.t = 0; this.spawn = 0.8; this.over = false;
  }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);

    this.spawn -= dt * (1 + this.t / 50);
    if (this.spawn <= 0){
      this.spawn = 0.7 + Math.random() * 0.6;
      const burst = Math.random() < 0.25 ? 3 : 1;
      for (let k = 0; k < burst; k++) this.items.push(this._toss());
    }

    for (const it of this.items){
      it.vy += G * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.spin += it.spinV * dt;
    }

    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p.present){ this.trails[i].length = 0; continue; }
      for (const hand of [p.hands.left, p.hands.right]){
        const fast = hand.speed > SWING;
        if (fast){
          this.trails[i].push({ x:hand.x, y:hand.y, age:0 });
          if (this.trails[i].length > 14) this.trails[i].shift();
        }
        if (!fast) continue;
        for (const it of this.items){
          if (it.cut) continue;
          const d = Math.hypot((hand.x - it.x) * (W / H), hand.y - it.y);
          if (d < it.r * 1.35) this._cut(it, i, W, H);
        }
      }
    }
    for (const tr of this.trails){
      for (const pt of tr) pt.age += dt;
      while (tr.length && tr[0].age > 0.3) tr.shift();
    }

    this.items = this.items.filter(it => it.y < 1.3);
  }

  _toss(){
    const bomb = Math.random() < 0.16;
    const kind = FRUIT[(Math.random() * FRUIT.length) | 0];
    const x = 0.14 + Math.random() * 0.72;
    return {
      x, y: 1.16,
      vx: (0.5 - x) * (0.18 + Math.random() * 0.2),
      vy: -(0.72 + Math.random() * 0.16),
      r: bomb ? 0.055 : 0.06,
      spin: Math.random() * 6.28, spinV: (Math.random() - 0.5) * 5,
      bomb, kind, cut: false
    };
  }

  _cut(it, who, W, H){
    it.cut = true;
    const px = it.x * W, py = it.y * H;
    if (it.bomb){
      this.lives[who] = Math.max(0, this.lives[who] - 1);
      sfx.buzz(); this.j.kick(30);
      this.j.burst(px, py, '#ff5d73', 26, 1.5);
      this.j.pop(px, py, '−1 life', '#ff5d73');
      if (this.lives.slice(0, this.players).every(l => l <= 0)) this.over = true;
      return;
    }
    const worth = it.kind.worth;
    this.score[who] += worth;
    sfx.slice();
    this.j.burst(px, py, it.kind.inner, 14 + worth * 6, 1.1);
    this.j.pop(px, py, '+' + worth, PLAYER_COLORS[who]);
  }

  draw(c, W, H){
    const shook = this.j.applyShake(c);

    /* The swipe trail, so a swing that was too slow is visibly too slow. */
    for (let i = 0; i < this.players; i++){
      const tr = this.trails[i];
      if (tr.length < 2) continue;
      c.strokeStyle = PLAYER_COLORS[i];
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (let k = 1; k < tr.length; k++){
        c.globalAlpha = (k / tr.length) * 0.75;
        c.lineWidth = Math.max(3, H * 0.012 * (k / tr.length));
        c.beginPath();
        c.moveTo(tr[k - 1].x * W, tr[k - 1].y * H);
        c.lineTo(tr[k].x * W, tr[k].y * H);
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    for (const it of this.items){
      if (it.cut) continue;
      const x = it.x * W, y = it.y * H, r = it.r * H;
      c.save(); c.translate(x, y); c.rotate(it.spin);
      if (it.bomb){
        c.fillStyle = '#1a1430';
        c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.fill();
        c.strokeStyle = '#ff5d73'; c.lineWidth = Math.max(3, H * 0.006); c.stroke();
        c.strokeStyle = '#ffd24a'; c.lineWidth = Math.max(2, H * 0.005);
        c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(r * 0.6, -r * 1.5, r * 0.3, -r * 1.8); c.stroke();
      } else {
        c.fillStyle = it.kind.col;
        c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.fill();
        c.fillStyle = it.kind.inner;
        c.beginPath(); c.arc(-r * 0.2, -r * 0.2, r * 0.42, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(255,255,255,.35)';
        c.beginPath(); c.ellipse(-r * 0.35, -r * 0.4, r * 0.16, r * 0.22, -0.5, 0, 6.2832); c.fill();
      }
      c.restore();
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
