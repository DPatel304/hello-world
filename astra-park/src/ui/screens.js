import { pose, BONES } from '../tracking/pose.js';
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

  /* A rolling ratio rather than a stopwatch. Detection flickers frame to frame
     - measured, only about a third of frames clear the gate on a figure the
     camera can plainly see - so any timer that wants an unbroken run never
     finishes. Advance when the body was findable for more than half of a
     couple of seconds, which needs no magic confidence number and survives
     the flicker by construction. */
  let good = 0, total = 0, seenFor = 0;
  const WINDOW = 2.2, NEED = 0.5;
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
        /* Its own counter: the camera path's gate is a ratio of good frames,
           and there are no frames to rate here. */
        seenFor += dt;
        state.style.color = 'var(--dim)';
        const why = {
          denied:   'Camera permission was refused.',
          nocamera: 'No camera was found.',
          nonetwork:'The camera works, but the pose runtime could not be downloaded. ' +
                    'Check the connection, or run `npm run offline` to keep it locally.',
          badassets:'The local pose runtime would not load. Try `npm run offline` again.',
          debug:    'Debug mode.'
        }[pose.reason] || 'No camera.';
        state.textContent = why + ' The mouse will play instead.';
        title.textContent = 'Mouse mode';
        info.textContent = 'Move the pointer; hold it over a button for a second to press it.';
        if (seenFor >= 3) done();
        return;
      }
      const full = pose.players.filter(p => pose.fullBody(p)).length;
      const anybody = pose.personCount > 0 || full > 0;
      seenFor = Math.max(0, seenFor + (anybody ? dt : -dt * 0.5));

      total += dt; if (full >= 1) good += dt;
      if (total > WINDOW){ const k = WINDOW / total; good *= k; total *= k; }
      const ratio = total > 0 ? good / total : 0;

      if (ratio > NEED * 0.6){
        const left = Math.max(0, WINDOW - total) + (ratio > NEED ? 0 : 0.8);
        state.textContent = (full === 2 ? 'Two players' : 'One player') +
                            ` — starting in ${left.toFixed(1)}s`;
        state.style.color = 'var(--good)';
        if (total >= WINDOW * 0.7 && ratio > NEED) done();
      } else {
        /* Decay rather than reset. Detection flickers - a frame where an arm
           crosses the body or the figure blurs drops the landmark confidence -
           and a timer that starts over on every bad frame never finishes even
           though the camera can plainly see someone. */
        state.style.color = 'var(--dim)';
        state.textContent = pose.personCount || ratio > 0.1
          ? 'Almost — step back so your legs are in frame'
          : (pose.mouse.active ? 'No camera. Move the mouse to play.' : 'Looking for you…');
      }
      /* Nobody gets trapped here. If a person has been visible for a while but
         the gate never quite closes, go anyway and say why. */
      if (seenFor > 14){
        state.textContent = 'Close enough — you can always re-calibrate from Settings.';
        done();
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

/* ---------- results ---------- */
/* Pictures on the big buttons, so a child who can't read knows which is
   which: round again, or home. */
const ICON = {
  again: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 0 7.7 10.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 1l4 3.2-4 3.2z" fill="currentColor"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.5L12 4l8.5 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10.5V20h4.5v-5h3v5H18v-9.5" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
};
const bigButton = (icon, label, cls, fn) => onPick(button(`<span class="ic">${ICON[icon]}</span><span class="tx">${label}</span>`, 'big ' + cls), fn);

/* After the round's own ending, just the way on: no scores and no winner.
   The ending scene stays in view behind - the bouquets, the lanterns, the
   sky full of pictures - with two big buttons along the bottom. */
export function results(game, onAgain, onMenu){
  const s = screen('end');
  s.style.setProperty('--accent', game.accent);
  s.append(h('div', 'endname', game.name));
  const row = h('div', 'row bigrow');
  row.append(bigButton('again', 'Play again', 'go', onAgain), bigButton('home', 'Menu', 'home', onMenu));
  s.appendChild(row);
  sfx.fanfare();
  return { tick(){}, draw(){} };
}

/* ---------- pause ---------- */
export function pauseOverlay(onResume, onQuit){
  const s = screen('dim pause');
  const row = h('div', 'row bigrow');
  row.append(bigButton('play', 'Keep playing', 'go', onResume), bigButton('home', 'Menu', 'home', onQuit));
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
