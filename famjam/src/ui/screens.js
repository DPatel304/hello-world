import { pose, BONES, PLAYER_COLORS } from '../tracking/pose.js';
import { button, onPick } from './cursor.js';
import { sfx } from '../audio/sound.js';

const ui = () => document.getElementById('ui');

export function clearUI(){ ui().innerHTML = ''; }

export function screen(cls = ''){
  const d = document.createElement('div');
  d.className = 'screen ' + cls;
  ui().appendChild(d);
  return d;
}

export function h(tag, cls, html){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/* ---------- calibration ----------
   Waits for whole bodies rather than any detection at all: a head and
   shoulders will track, but every game here needs legs, so letting someone
   start too close is a bug that only shows up once they are already playing. */
export function calibration(onDone){
  const s = screen('dim');
  const title = h('h2', '', 'Stand back until we can see all of you');
  const info  = h('p', 'lede', 'Two people can play. Stand side by side, about two metres back.');
  const state = h('p', 'lede', '');
  s.append(title, info, state);

  let held = 0;
  const skip = onPick(button('Skip'), () => { done(); });
  skip.style.marginTop = '2vh';
  s.appendChild(skip);

  let live = true;
  function done(){ if (!live) return; live = false; sfx.gold(); onDone(); }

  return {
    tick(dt){
      if (!live) return;
      /* With no camera there is no body to find, and waiting for one strands
         the whole app on this screen. Mouse mode passes straight through. */
      if (pose.mouse.active){
        held += dt;
        state.style.color = 'var(--dim)';
        state.textContent = pose.reason === 'denied'
          ? 'No camera permission — the mouse will play instead.'
          : 'No camera — the mouse will play instead.';
        title.textContent = 'Mouse mode';
        info.textContent = 'Move the pointer; hold it over a button for a second to press it.';
        if (held >= 1.2) done();
        return;
      }
      const full = pose.players.filter(p => pose.fullBody(p)).length;
      if (full >= 1){
        held += dt;
        state.textContent = full === 2
          ? `Two players — starting in ${Math.max(0, 2 - held).toFixed(1)}s`
          : `One player — starting in ${Math.max(0, 2 - held).toFixed(1)}s`;
        state.style.color = 'var(--good)';
        if (held >= 2) done();
      } else {
        held = 0;
        state.style.color = 'var(--dim)';
        state.textContent = pose.personCount
          ? 'Almost — step back so your feet are in frame'
          : (pose.mouse.active ? 'No camera. Move the mouse to play.' : 'Looking for you…');
      }
    },
    /* The camera feed with the skeleton on top: proof it can see you, which is
       the only thing this screen has to establish. */
    draw(c, W, H){
      if (pose.usingCamera && pose.video && pose.video.readyState >= 2){
        c.save(); c.globalAlpha = 0.5;
        c.translate(W, 0); c.scale(-1, 1);
        c.drawImage(pose.video, 0, 0, W, H);
        c.restore();
      }
      drawSkeletons(c, W, H, 0.95);
    }
  };
}

export function drawSkeletons(c, W, H, alpha = 0.35){
  for (const p of pose.players){
    if (!p.present || !p.lm) continue;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = p.color; c.fillStyle = p.color;
    c.lineWidth = Math.max(3, H * 0.008); c.lineCap = 'round';
    for (const [a, b] of BONES){
      const A = p.lm[a], B = p.lm[b];
      if ((A.v ?? 1) < 0.35 || (B.v ?? 1) < 0.35) continue;
      c.beginPath(); c.moveTo(A.x * W, A.y * H); c.lineTo(B.x * W, B.y * H); c.stroke();
    }
    for (const i of [15, 16]){
      const k = p.lm[i];
      c.beginPath(); c.arc(k.x * W, k.y * H, Math.max(6, H * 0.016), 0, 6.2832); c.fill();
    }
    c.restore();
  }
}

/* ---------- splash ---------- */
export function splash(game, players, onGo){
  const s = screen('dim');
  s.append(h('h1', '', game.name));
  const bl = h('ul', 'bullets');
  game.howto.forEach(t => bl.appendChild(h('li', '', `<span class="ic">▸</span><span>${t}</span>`)));
  s.appendChild(bl);

  const row = h('div', 'row');
  for (let i = 0; i < players; i++){
    row.appendChild(h('span', 'pill',
      `<span class="dot" style="background:${PLAYER_COLORS[i]}"></span>Player ${i + 1}`));
  }
  s.appendChild(row);
  const count = h('h1', '', '3');
  s.appendChild(count);

  let t = 3.2, last = 4;
  return {
    tick(dt){
      t -= dt;
      const n = Math.ceil(t);
      if (n !== last){ last = n; if (n >= 0){ sfx.count(n); count.textContent = n > 0 ? n : 'GO'; } }
      if (t <= -0.4) onGo();
    },
    draw(){}
  };
}

/* ---------- results ---------- */
export function results(game, rows, meta, onAgain, onMenu){
  const s = screen('dim');
  s.append(h('h2', '', game.name));
  if (meta.winner != null){
    s.append(h('h1', '', meta.winner === -1 ? 'A draw!' :
      `<span style="color:${PLAYER_COLORS[meta.winner]}">Player ${meta.winner + 1}</span> wins!`));
  }
  const t = h('div', 'tally');
  rows.forEach(r => {
    const d = h('div');
    d.append(h('dt', '', r.label));
    const dd = h('dd', '', String(r.value));
    if (r.color) dd.style.color = r.color;
    d.appendChild(dd);
    t.appendChild(d);
  });
  s.appendChild(t);
  if (meta.best) s.append(h('span', 'badge', 'NEW BEST!'));

  const row = h('div', 'row');
  row.append(onPick(button('Play again'), onAgain), onPick(button('Main menu'), onMenu));
  s.appendChild(row);
  meta.winner != null && meta.winner >= 0 ? sfx.fanfare() : sfx.fanfare();
  return { tick(){}, draw(){} };
}

/* ---------- pause ---------- */
export function pauseOverlay(onResume, onQuit){
  const s = screen('dim');
  s.append(h('h1', '', 'Paused'));
  const row = h('div', 'row');
  row.append(onPick(button('Resume'), onResume), onPick(button('Quit to menu'), onQuit));
  s.appendChild(row);
  return s;
}

/* ---------- lost player ---------- */
export function lostOverlay(){
  const s = screen('dim');
  s.append(h('h2', '', 'Step back into frame'));
  s.append(h('p', 'lede', 'The camera has lost you. The game will carry on as soon as it can see you again.'));
  return s;
}
