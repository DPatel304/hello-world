import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';

/* Hover-to-select. Every button in FamJam is a DOM .btn; the cursor finds the
   one under each player's hand and fills a bar across it. One second of dwell
   is long enough not to fire on a passing wave and short enough that nobody
   thinks it is broken. */
const DWELL = 1.0;
const DEADZONE = 0.012;   /* hand jitter under this does not reset the dwell */
/* After a pick, whatever replaces the button is usually sitting right under
   the hand that just chose. Without a pause the cursor dwells straight through
   it and fires again, so picking a game would launch the next screen's button
   too. The hand has to leave and come back, or wait this out. */
const COOLDOWN = 0.75;

export const cursor = {
  rings: [],
  enabled: true,
  _state: [ {el:null,t:0,x:.5,y:.5,cool:0}, {el:null,t:0,x:.5,y:.5,cool:0} ],

  reset(){ for (const s of this._state){ s.el = null; s.t = 0; s.cool = COOLDOWN; } this._clearFills(); },

  _clearFills(){
    document.querySelectorAll('.btn.hot').forEach(b => {
      b.classList.remove('hot');
      const f = b.querySelector('.fill'); if (f) f.style.transform = 'scaleX(0)';
    });
  },

  update(dt, root){
    this.rings.length = 0;
    if (!this.enabled){ this._clearFills(); return; }
    const seen = new Set();

    for (let i = 0; i < 2; i++){
      const p = pose.players[i], s = this._state[i];
      if (!p.present){ s.el = null; s.t = 0; continue; }
      const h = pose.cursorHand(p);
      const x = h.x, y = h.y;
      this.rings.push({ x, y, color: PLAYER_COLORS[i], progress: 0, id: i });

      if (s.cool > 0){
        s.cool -= dt;
        s.x = x; s.y = y; s.el = null; s.t = 0;
        continue;
      }
      const el = this._hit(x, y, root);
      if (el !== s.el){ s.el = el; s.t = 0; }
      else if (el){
        const moved = Math.hypot(x - s.x, y - s.y);
        s.t += dt;
        if (moved > DEADZONE * 6) s.t = Math.max(0, s.t - dt);   /* waving past, not choosing */
      }
      s.x = x; s.y = y;

      if (el){
        seen.add(el);
        el.classList.add('hot');
        el.style.color = PLAYER_COLORS[i];
        const f = el.querySelector('.fill');
        const k = Math.min(1, s.t / DWELL);
        if (f) f.style.transform = `scaleX(${k.toFixed(3)})`;
        this.rings[this.rings.length - 1].progress = k;
        if (s.t === dt || (s.t > 0 && s.t - dt <= 0)) sfx.tick();
        if (s.t >= DWELL){
          s.t = 0; s.el = null; s.cool = COOLDOWN;
          if (f) f.style.transform = 'scaleX(0)';
          el.classList.remove('hot');
          el.dispatchEvent(new CustomEvent('pick', { detail:{ player:i }, bubbles:true }));
        }
      }
    }

    document.querySelectorAll('.btn.hot').forEach(b => {
      if (!seen.has(b)){
        b.classList.remove('hot');
        const f = b.querySelector('.fill'); if (f) f.style.transform = 'scaleX(0)';
      }
    });
  },

  _hit(nx, ny, root){
    const x = nx * innerWidth, y = ny * innerHeight;
    const btns = (root || document).querySelectorAll('.btn');
    for (const b of btns){
      if (b.disabled || b.closest('.hide')) continue;
      const r = b.getBoundingClientRect();
      if (r.width === 0) continue;
      /* A little forgiveness around the edge: a hand is not a mouse. */
      const pad = Math.min(r.width, r.height) * 0.18;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return b;
    }
    return null;
  },

  /* Drawn on the game canvas so it sits above everything, including games. */
  draw(c, W, H){
    for (const r of this.rings){
      const x = r.x * W, y = r.y * H, rad = Math.max(16, H * 0.035);
      c.save();
      c.lineWidth = Math.max(4, H * 0.008);
      c.strokeStyle = 'rgba(0,0,0,.45)';
      c.beginPath(); c.arc(x, y, rad, 0, 6.2832); c.stroke();
      c.strokeStyle = r.color;
      c.beginPath(); c.arc(x, y, rad, 0, 6.2832); c.stroke();
      if (r.progress > 0){
        c.lineWidth = Math.max(6, H * 0.013);
        c.strokeStyle = '#fff';
        c.beginPath(); c.arc(x, y, rad, -Math.PI/2, -Math.PI/2 + r.progress * 6.2832); c.stroke();
      }
      c.fillStyle = r.color; c.globalAlpha = .35;
      c.beginPath(); c.arc(x, y, rad * 0.4, 0, 6.2832); c.fill();
      c.restore();
    }
  }
};

/* Buttons respond to a real click too, so a mouse or a touchscreen works and
   the whole thing stays testable. */
export function onPick(el, fn){
  el.addEventListener('pick', fn);
  el.addEventListener('click', fn);
  return el;
}

export function button(label, cls = ''){
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.innerHTML = '<span class="fill"></span><span class="lbl">' + label + '</span>';
  return b;
}
