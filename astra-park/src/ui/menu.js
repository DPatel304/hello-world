import { GAMES } from '../games/index.js';
import { scores } from '../games/common.js';
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { audio } from '../audio/sound.js';
import { pose } from '../tracking/pose.js';
import { drawPark } from './backdrop.js';
import { logo } from './title.js';
import { poster } from './posters.js';

/* The games, as big living pictures on the same dusk park as the title. A
   child picks the one that looks fun - balloons or fireflies - so there are
   no stars, scores or instructions on them; the name sits small underneath
   for whoever can read it. */
export function menu({ onPlay, onRecalibrate }){
  clearUI();
  const s = screen('picker');
  s.appendChild(logo('small'));

  const tools = h('div', 'corners');
  tools.append(
    onPick(button('?', 'corner'), () => help()),
    onPick(button('\u2699', 'corner'), () => settings(onRecalibrate))
  );
  s.appendChild(tools);

  /* A camera that failed is not a one-off message. Without a standing note
     people land here, wonder why waving does nothing, and have no way back to
     the reason. */
  if (pose.mouse.active && pose.reason !== 'debug'){
    s.appendChild(h('div', 'warnstrip', '\u26a0 No camera \u2014 the mouse is playing'));
  }

  const grid = h('div', 'tiles');
  const cols = Math.min(3, GAMES.length);
  grid.style.setProperty('--cols', cols);
  grid.style.setProperty('--rows', Math.ceil(GAMES.length / cols));
  const pics = [];
  for (const g of GAMES){
    const card = button('', 'tile');
    card.style.setProperty('--accent', g.accent);
    const pic = document.createElement('canvas');
    pic.className = 'pic';
    card.insertBefore(pic, card.firstChild);
    card.querySelector('.lbl').textContent = g.name;
    onPick(card, () => onPlay(g));
    grid.appendChild(card);
    pics.push({ pic, paint: poster(g) });
  }
  s.appendChild(grid);

  let t = 0;
  return {
    tick(dt){ t += dt; },
    draw(c, W, H){
      drawPark(c, W, H, t, 0.3);
      for (const p of pics) paintPoster(p, t);
    }
  };
}

/* Each tile's picture is its own small canvas, sized to the tile as laid out. */
function paintPoster(p, t){
  if (!p.pic.getContext || !p.pic.getBoundingClientRect) return;
  const r = p.pic.getBoundingClientRect();
  if (!r.width) return;
  const k = Math.min(2, devicePixelRatio || 1);
  const w = Math.round(r.width * k), hgt = Math.round(r.height * k);
  if (p.pic.width !== w || p.pic.height !== hgt){ p.pic.width = w; p.pic.height = hgt; }
  const c = p.pic.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  p.paint(c, r.width, r.height, t);
}

function overlay(){
  const s = screen('dim');
  s.style.zIndex = 5;
  return s;
}

function help(){
  const s = overlay();
  s.append(h('h2', '', 'How to play'));
  const bl = h('ul', 'bullets');
  [['✋','Move a hand over a button and hold for a second to press it'],
   ['🙌','Raise both hands above your head to pause'],
   ['📏','Stand about two metres back so your whole body is in frame'],
   ['💡','Lights on — the camera needs to see you'],
   ['⛶','Press F for fullscreen on the TV']]
   .forEach(([ic, t]) => bl.appendChild(h('li','',`<span class="ic">${ic}</span><span>${t}</span>`)));
  s.appendChild(bl);
  s.appendChild(onPick(button('Got it'), () => s.remove()));
}

export { settings as openSettings };

function settings(onRecalibrate){
  const s = overlay();
  s.append(h('h2', '', 'Settings'));

  const lab = h('label', 'slider', '<span>Volume</span>');
  const sl = document.createElement('input');
  sl.type = 'range'; sl.min = 0; sl.max = 1; sl.step = 0.05; sl.value = audio.volume;
  sl.addEventListener('input', () => audio.setVolume(+sl.value));
  lab.appendChild(sl);
  s.appendChild(lab);

  const row = h('div', 'row');
  const mute = onPick(button(audio.muted ? 'Unmute' : 'Mute'), () => {
    const m = audio.toggleMute();
    mute.querySelector('.lbl').textContent = m ? 'Unmute' : 'Mute';
  });
  /* Volume by hand needs buttons, not a slider: you cannot drag with a dwell
     cursor, so quieter and louder are the controls that actually work from
     across a room. */
  const down = onPick(button('Quieter'), () => { audio.setVolume(audio.volume - 0.1); sl.value = audio.volume; });
  const up   = onPick(button('Louder'),  () => { audio.setVolume(audio.volume + 0.1); sl.value = audio.volume; });
  row.append(down, up, mute);
  s.appendChild(row);

  /* Only worth showing when there is a choice to make. */
  if (pose.usingCamera){
    pose.cameras().then(list => {
      if (list.length < 2) return;
      s.insertBefore(h('p', 'lede', 'Camera'), row2);
      const pick = h('div', 'row');
      list.forEach(cam => {
        const b = onPick(button(cam.label.slice(0, 34)), async () => {
          b.querySelector('.lbl').textContent = 'Switching…';
          try { await pose.use(cam.id); onRecalibrate(); }
          catch (e){ b.querySelector('.lbl').textContent = 'Could not open that one'; }
        });
        if (cam.id === pose.activeId) b.style.borderColor = 'var(--good)';
        pick.appendChild(b);
      });
      s.insertBefore(pick, row2);
    });
  }

  const row2 = h('div', 'row');
  row2.append(
    onPick(button('Re-calibrate'), () => { s.remove(); onRecalibrate(); }),
    onPick(button('Fullscreen'), () => toggleFullscreen()),
    onPick(button('Reset scores'), (e) => {
      scores.reset();
      e.currentTarget.querySelector('.lbl').textContent = 'Scores cleared';
    })
  );
  s.appendChild(row2);
  s.appendChild(onPick(button('Close'), () => s.remove()));
}

export function toggleFullscreen(){
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
