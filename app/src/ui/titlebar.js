/* The Windows app's own title bar, in Window mode: a slim bar in Orlis
   Play's style - the cube and the name, and minimise, maximise and close -
   in place of Windows' plain one. Drag it to move the window; double-click
   it to maximise. In Big Picture (full screen) there's no bar. While a game
   is playing it tucks away, and comes back when the mouse goes to the top.

   Only in the Windows app; opened any other way there's no bar. */
import { mark } from './boot.js';

const HEIGHT = 34;            /* px */
let bar = null, playing = false;

const win = () => window.__TAURI__ && window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow();

export function installTitlebar(){
  if (typeof window === 'undefined' || !window.__TAURI__ || !window.orlisDisplay || bar) return;
  bar = document.createElement('div');
  bar.className = 'titlebar';
  bar.setAttribute('data-tauri-drag-region', '');
  bar.innerHTML = `
    <span class="tbmark" data-tauri-drag-region>${mark()}</span>
    <span class="tbname" data-tauri-drag-region>Orlis <i>Play</i></span>
    <span class="tbspace" data-tauri-drag-region></span>
    <button class="tbbtn" data-act="min" title="Minimise" aria-label="Minimise"><svg viewBox="0 0 10 10"><path d="M1 5h8"/></svg></button>
    <button class="tbbtn" data-act="max" title="Maximise" aria-label="Maximise"><svg viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" rx="1"/></svg></button>
    <button class="tbbtn close" data-act="close" title="Close" aria-label="Close"><svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6"/></svg></button>`;
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.tbbtn'); if (!b) return;
    const w = win(); if (!w) return;
    if (b.dataset.act === 'min') w.minimize();
    else if (b.dataset.act === 'max') w.toggleMaximize();
    else w.close();
  });
  document.body.appendChild(bar);
  /* in a game: back when the mouse comes to the top */
  addEventListener('mousemove', (e) => { if (playing) bar.classList.toggle('peek', e.clientY < HEIGHT * 1.5); });
  addEventListener('orlisdisplay', update);
  update();
}

function update(){
  if (!bar) return;
  const on = window.ORLIS_DISPLAY !== 'bigpicture';
  document.body.classList.toggle('titled', on);
  bar.hidden = !on;
  bar.classList.toggle('tucked', playing);
}

/* A game's started (true) or ended (false). */
export function titlebarPlaying(on){
  playing = !!on;
  if (bar){ bar.classList.remove('peek'); update(); }
}
