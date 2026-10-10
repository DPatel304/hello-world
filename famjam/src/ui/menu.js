import { GAMES } from '../games/index.js';
import { scores } from '../games/common.js';
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { audio } from '../audio/sound.js';
import { pose } from '../tracking/pose.js';

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function menu({ onPlay, onRecalibrate }){
  clearUI();
  const s = screen();
  const bar = h('div', 'topbar');
  bar.append(h('div', 'brand', 'Fam<span style="color:var(--p2)">Jam</span>'));
  const tools = h('div', 'tools');
  /* A camera that failed is not a one-off message. Without a standing note
     people land on the menu, wonder why waving does nothing, and have no way
     back to the reason. */
  if (pose.mouse.active && pose.reason !== 'debug'){
    tools.appendChild(h('span', 'warn', '⚠ No camera — mouse only'));
  }
  const bHelp = onPick(button('Help'), () => help());
  const bSet  = onPick(button('Settings'), () => settings(onRecalibrate));
  tools.append(bHelp, bSet);
  bar.append(tools);
  s.appendChild(bar);

  s.appendChild(h('h1', '', 'Pick a game'));

  const n = Math.max(1, Math.min(2, pose.personCount || 1));
  const note = h('p', 'lede', n === 2
    ? 'Two players detected — these are head to head.'
    : 'One player detected. A second person can step in at any time.');
  s.appendChild(note);

  const grid = h('div', 'grid');
  for (const g of GAMES){
    const card = button('', 'card');
    card.style.setProperty('--accent', g.accent);
    card.querySelector('.lbl').innerHTML =
      `<span class="nm">${g.name}</span>` +
      `<span class="meta"><span class="stars">${stars(g.stars)}</span>` +
      `<span class="best">Best ${scores.best(g.id, n) || '—'}</span></span>`;
    onPick(card, () => onPlay(g));
    grid.appendChild(card);
  }
  s.appendChild(grid);
  return { tick(){}, draw(){} };
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
