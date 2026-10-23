import { Juice } from './common.js';
import { pose, PLAYER_COLORS, L } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';

/* Copycat Groove. A shape appears and you make it with your arms before the
   bar runs out. The only game that reads the body as a *shape* rather than
   tracking a point, which is why it is the one that works from across a room
   and the one a three-year-old needs an older sibling to demonstrate once. */
export default {
  id:'copycat-groove', name:'Copycat Groove', stars:3, accent:'#ff6b9d', secs:60,
  howto:['Copy the shape with your arms', 'Hold it until the bar runs out', 'Four shapes, and they speed up'],
  create(n){ return new CopycatGroove(n); }
};

export const SHAPES = ['both-up', 'arms-out', 'left-up', 'right-up'];
const LABEL = {
  'both-up':'Both arms up', 'arms-out':'Arms out wide',
  'left-up':'Left arm up',  'right-up':'Right arm up'
};

/* Everything is measured against shoulder width, so it holds whether a child
   is two metres back or six, and whether they are three feet tall or six. */
export function classify(p){
  if (!p || !p.lm || !p.present) return null;
  const lm = p.lm;
  const ls = lm[L.L_SHOULDER], rs = lm[L.R_SHOULDER];
  const lw = lm[L.L_WRIST],    rw = lm[L.R_WRIST];
  if (!ls || !rs || !lw || !rw) return null;

  const sw = Math.abs(ls.x - rs.x);
  if (sw < 0.02) return null;                 /* turned side-on, nothing to read */

  const shoulderY = (ls.y + rs.y) / 2;
  const midX = (ls.x + rs.x) / 2;
  const up = (w) => w.y < shoulderY - sw * 0.30;
  const out = (w) => Math.abs(w.x - midX) > sw * 0.85;

  /* Screen sides, not anatomical ones. "Left arm up" means the arm the child
     sees on their own left, which after mirroring is screen-left. */
  const leftW  = lw.x <= rw.x ? lw : rw;
  const rightW = lw.x <= rw.x ? rw : lw;

  const lUp = up(leftW), rUp = up(rightW);
  if (lUp && rUp) return 'both-up';
  if (lUp) return 'left-up';
  if (rUp) return 'right-up';
  if (out(leftW) && out(rightW)) return 'arms-out';
  return null;
}

class CopycatGroove {
  constructor(players){
    this.players = players;
    this.score = [0, 0];
    this.lives = [3, 3];
    this.j = new Juice();
    this.t = 0; this.over = false;
    this.round = 0;
    this.shape = SHAPES[0];
    this.left = 3.0;
    this.window = 3.0;
    this.got = [false, false];
    this.flash = 0;
  }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);
    this.flash = Math.max(0, this.flash - dt);

    for (let i = 0; i < this.players; i++){
      if (this.got[i]) continue;
      if (classify(pose.players[i]) === this.shape){
        this.got[i] = true;
        this.score[i] += 2;
        sfx.gold();
        const p = pose.players[i];
        this.j.burst(p.centre.x * W, p.centre.y * H, PLAYER_COLORS[i], 18, 1.1);
        this.j.pop(p.centre.x * W, p.centre.y * H - H * 0.1, '+2', PLAYER_COLORS[i]);
      }
    }

    this.left -= dt;
    if (this.left <= 0) this._next(W, H);
  }

  _next(W, H){
    for (let i = 0; i < this.players; i++){
      if (this.got[i]) continue;
      this.lives[i] = Math.max(0, this.lives[i] - 1);
      sfx.buzz();
      this.j.pop(W * (this.players < 2 ? 0.5 : (i ? 0.75 : 0.25)), H * 0.3, 'missed', '#ff5d73');
    }
    if (this.lives.slice(0, this.players).every(l => l <= 0)){ this.over = true; return; }

    this.j.kick(10);
    this.flash = 0.3;
    this.round++;
    /* Tightens from three seconds to one and a half, and never below: the
       floor is set by how long it takes to lift an arm, not by difficulty. */
    this.window = Math.max(1.5, 3.0 - this.round * 0.12);
    this.left = this.window;
    this.got = [false, false];
    let next = this.shape;
    while (next === this.shape) next = SHAPES[(Math.random() * SHAPES.length) | 0];
    this.shape = next;
  }

  /* The shape to copy, drawn as a figure rather than written as words: the
     audience for this cannot read. */
  _figure(c, cx, cy, s, shape, col){
    c.strokeStyle = col;
    c.lineWidth = Math.max(5, s * 0.14);
    c.lineCap = 'round'; c.lineJoin = 'round';

    c.beginPath(); c.arc(cx, cy - s * 0.95, s * 0.3, 0, 6.2832);
    c.fillStyle = col; c.fill();

    c.beginPath();
    c.moveTo(cx, cy - s * 0.62); c.lineTo(cx, cy + s * 0.35); c.stroke();

    c.beginPath();
    c.moveTo(cx, cy + s * 0.35); c.lineTo(cx - s * 0.45, cy + s * 1.15);
    c.moveTo(cx, cy + s * 0.35); c.lineTo(cx + s * 0.45, cy + s * 1.15);
    c.stroke();

    const sy = cy - s * 0.45;
    const arm = (side, kind) => {
      c.beginPath(); c.moveTo(cx, sy);
      if (kind === 'up')  c.lineTo(cx + side * s * 0.55, sy - s * 0.8);
      if (kind === 'out') c.lineTo(cx + side * s * 0.95, sy);
      if (kind === 'down')c.lineTo(cx + side * s * 0.4,  sy + s * 0.7);
      c.stroke();
    };
    if (shape === 'both-up'){ arm(-1,'up');   arm(1,'up'); }
    if (shape === 'arms-out'){ arm(-1,'out'); arm(1,'out'); }
    if (shape === 'left-up'){ arm(-1,'up');   arm(1,'down'); }
    if (shape === 'right-up'){ arm(-1,'down');arm(1,'up'); }
  }

  draw(c, W, H){
    const shook = this.j.applyShake(c);

    if (this.flash > 0){
      c.fillStyle = `rgba(255,255,255,${this.flash * 0.25})`;
      c.fillRect(0, 0, W, H);
    }

    const s = H * 0.14;
    this._figure(c, W / 2, H * 0.36, s, this.shape, '#f3f0ff');

    c.fillStyle = '#9b94c4';
    c.font = `800 ${Math.round(H * 0.035)}px ui-rounded, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText(LABEL[this.shape], W / 2, H * 0.60);

    /* The bar. Colour rather than a number, because the number is unreadable
       at the speed this runs. */
    const bw = W * 0.5, bh = H * 0.022, bx = (W - bw) / 2, by = H * 0.66;
    const k = Math.max(0, this.left / this.window);
    c.fillStyle = 'rgba(255,255,255,.12)';
    c.beginPath(); c.roundRect(bx, by, bw, bh, bh / 2); c.fill();
    c.fillStyle = k > 0.4 ? '#53e59a' : k > 0.18 ? '#ffd24a' : '#ff5d73';
    c.beginPath(); c.roundRect(bx, by, bw * k, bh, bh / 2); c.fill();

    /* A tick per player the moment they land it, so a child who got there
       first can see that they did. */
    for (let i = 0; i < this.players; i++){
      const x = W * (this.players < 2 ? 0.5 : (i ? 0.62 : 0.38));
      c.globalAlpha = this.got[i] ? 1 : 0.22;
      c.fillStyle = PLAYER_COLORS[i];
      c.beginPath(); c.arc(x, H * 0.73, H * 0.022, 0, 6.2832); c.fill();
      if (this.got[i]){
        c.strokeStyle = '#0d0b1a'; c.lineWidth = Math.max(3, H * 0.006);
        c.beginPath();
        c.moveTo(x - H * 0.010, H * 0.731);
        c.lineTo(x - H * 0.002, H * 0.739);
        c.lineTo(x + H * 0.011, H * 0.722);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    c.textAlign = 'start';

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
