import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';

/* Point and wave. Every button in Astra Park is a DOM .btn; the cursor
   finds the one each player's hand is pointing at and lights it up - and a
   wave of that hand clicks it.

   Pointing is sticky, because a hand held out across a room is never quite
   still: the lit button only moves on to another once the hand has been
   over that one for STICK seconds, and the lit one reaches a little further
   out than the rest (STAY), so wobbling on an edge doesn't flick between
   neighbours. A wave is the hand swinging side to side - WAVE_SWING screen
   widths each way, turning back CLICK_TURNS times within a moment; as soon
   as it starts, the lit button is held, so the waving hand can't wave
   itself off it. Holding still on a button for DWELL seconds clicks it too,
   for anyone who hasn't learnt to wave yet. */
export const DWELL = 2.0, STICK = 0.2, CLICK_TURNS = 3, WAVE_SWING = 0.025;
const STAY = 0.45;          /* how much further out the lit button reaches, of its size */
const TURN_GAP = 0.08;      /* seconds: jitter can't turn faster than a hand */
const WAVE_GONE = 0.6;      /* seconds without a turn and the wave's over */
const DEADZONE = 0.012;   /* hand jitter under this does not reset the dwell */
/* After a pick, whatever replaces the button is usually sitting right under
   the hand that just chose. Without a pause the cursor dwells straight through
   it and fires again, so picking a game would launch the next screen's button
   too. The hand has to leave and come back, or wait this out. */
const COOLDOWN = 0.75;

export const cursor = {
  rings: [],
  enabled: true,
  _state: Array.from({ length: MAX_PLAYERS }, () => fresh()),

  reset(){ for (const s of this._state){ Object.assign(s, fresh()); s.cool = COOLDOWN; } this._clearFills(); },

  /* Ignore the hands for a while: arriving from a wave, they are still up
     and swinging over whatever is now in the middle of the screen. */
  hold(secs){ for (const s of this._state) s.cool = Math.max(s.cool, secs); },

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

    for (let i = 0; i < pose.players.length; i++){
      const p = pose.players[i], s = this._state[i];
      if (!p.present){ s.el = null; s.t = 0; s.cand = null; s.turns = 0; continue; }
      const h = pose.cursorHand(p);
      const x = h.x, y = h.y;
      this.rings.push({ x, y, color: PLAYER_COLORS[i], progress: 0, id: i, waving: 0 });

      if (s.cool > 0){
        s.cool -= dt;
        s.x = x; s.y = y; s.el = null; s.t = 0; s.cand = null; s.turns = 0; s.dir = 0; s.far = x;
        continue;
      }
      /* The wave: turns of the hand back and forth. (Not for the mouse,
         which has a real click.) */
      s.since += dt;
      if (pose.mouse.active){ s.turns = 0; s.dir = 0; s.far = x; }
      else if (!s.dir){ if (Math.abs(x - s.far) > WAVE_SWING){ s.dir = Math.sign(x - s.far); s.far = x; } }
      else if ((x - s.far) * s.dir > 0) s.far = x;
      else if (Math.abs(x - s.far) > WAVE_SWING){
        if (s.since >= TURN_GAP){ s.turns++; s.since = 0; }
        s.dir = -s.dir; s.far = x;
      }
      if (s.turns && s.since > WAVE_GONE){ s.turns = 0; s.dir = 0; s.far = x; }
      const waving = s.turns > 0;
      /* What's pointed at: held still while waving; otherwise sticky. */
      if (!waving){
        const el = this._hit(x, y, root, s.el);
        if (el === s.el){ s.cand = null; s.candT = 0; }
        else if (el === s.cand){
          /* Over another a moment: that's the one now (a little sooner when
             nothing's lit yet). */
          s.candT += dt;
          if (s.candT >= (s.el ? STICK : STICK * 0.5)){ s.el = el; s.t = 0; s.cand = null; s.candT = 0; }
        }
        else { s.cand = el; s.candT = 0; }
      }
      const el = s.el;
      if (el && el.isConnected === false) s.el = null;
      if (el){
        const moved = Math.hypot(x - s.x, y - s.y);
        s.t += dt;
        if (moved > DEADZONE * 6 || waving) s.t = Math.max(0, s.t - dt);   /* moving, not resting */
      }
      s.x = x; s.y = y;

      if (el){
        seen.add(el);
        el.classList.add('hot');
        /* A custom property rather than `color`, so each button decides where
           the player's colour lands. Driving text colour directly put blue
           letters on the green Play button, which was unreadable from the
           sofa - the thing this whole interface is meant to survive. */
        el.style.setProperty('--who', PLAYER_COLORS[i]);
        const f = el.querySelector('.fill');
        const k = Math.max(Math.min(1, s.t / DWELL), Math.min(1, s.turns / CLICK_TURNS));
        if (f) f.style.transform = `scaleX(${k.toFixed(3)})`;
        const ring = this.rings[this.rings.length - 1];
        ring.progress = k; ring.waving = waving ? 1 : 0;
        if (s.lit !== el){ s.lit = el; sfx.tick(); }
        if (s.t >= DWELL || s.turns >= CLICK_TURNS){
          s.t = 0; s.el = null; s.cool = COOLDOWN; s.turns = 0; s.dir = 0; s.lit = null;
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

  _hit(nx, ny, root, lit = null){
    const x = nx * innerWidth, y = ny * innerHeight;
    const btns = [...(root || document).querySelectorAll('.btn')];
    /* The lit one first: it keeps its wider reach. */
    if (lit && btns.includes(lit)){ btns.splice(btns.indexOf(lit), 1); btns.unshift(lit); }
    for (const b of btns){
      if (b.disabled || b.closest('.hide')) continue;
      const r = b.getBoundingClientRect();
      if (r.width === 0) continue;
      /* A little forgiveness around the edge: a hand is not a mouse. */
      const pad = Math.min(r.width, r.height) * (b === lit ? STAY : 0.18);
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
function fresh(){ return { el:null, t:0, x:.5, y:.5, cool:0, cand:null, candT:0, turns:0, dir:0, far:.5, since:9, lit:null }; }

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
