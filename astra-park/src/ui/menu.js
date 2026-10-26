import { GAMES } from '../games/index.js';
import { scores } from '../games/common.js';
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { audio } from '../audio/sound.js';
import { pose } from '../tracking/pose.js';
import { drawPark } from './backdrop.js';
import { wordmark } from './title.js';

/* Filled and hollow glyphs render near-identically at tile size, so the
   difficulty is carried by colour instead: lit stars gold, the rest faint. */
const stars = (n) => `<b>${'★'.repeat(n)}</b>${'★'.repeat(5 - n)}`;

export function menu({ onPlay, onRecalibrate }){
  clearUI();
  const s = screen('picker');

  /* The same park as the title, stepped back so the tiles can sit on top of
     it. Two screens in one place rather than two designs. */
  const brand = h('div', 'minibrand');
  brand.append(wordmark('ASTRA'), wordmark('PARK'));
  s.appendChild(brand);

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

  const n = Math.max(1, Math.min(2, pose.personCount || 1));
  s.appendChild(h('p', 'pickline', n === 2
    ? 'Two players \u2014 pick a game'
    : 'Pick a game'));

  const grid = h('div', 'tiles');
  grid.style.setProperty('--cols', Math.min(4, GAMES.length));
  for (const g of GAMES){
    const card = button('', 'tile');
    card.style.setProperty('--accent', g.accent);
    card.querySelector('.lbl').innerHTML =
      `<span class="nm">${g.name}</span>` +
      `<span class="meta"><span class="stars">${stars(g.stars)}</span>` +
      `<span class="best">${scores.best(g.id, n) ? 'Best ' + scores.best(g.id, n) : ''}</span></span>`;
    onPick(card, () => onPlay(g));
    grid.appendChild(card);
  }
  s.appendChild(grid);

  let t = 0;
  return {
    tick(dt){ t += dt; },
    draw(c, W, H){ drawPark(c, W, H, t, 0.55); }
  };
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
