import { GAMES } from '../games/index.js';
import { scores } from '../games/common.js';
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { audio, sfx, ambience } from '../audio/sound.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { drawPark, drawLiving } from './backdrop.js';
import { PlayerBar } from './playerbar.js';
import { silhouette } from './avatars.js';
import { logo } from './title.js';
import { poster } from './posters.js';

/* Home: the console's front room. Across the top, who's here - a bubble
   for each player with their face. In the middle, a shelf: the picked game
   big and alive in the centre, its neighbours smaller either side, and at
   the end of the row the console's own places - the store, making a game,
   the family, settings and help. Under the picked game, pictures of the
   moves it uses, places for how many can play, and the family's best.

   A hand on a side tile slides the shelf to it; a hand held on the big one
   goes in - the tile grows to fill the screen. Left and right arrows and
   Enter work too, for the grown-up at the laptop. The park behind follows
   the time of day and the season, and takes on the picked game's colour;
   a soft ambience plays under it all. */
export const MOVES = {
  run: ['\u{1F3C3}', 'Run about'], point: ['\u{1F449}', 'Point'], march: ['\u{1F9B5}', 'March on the spot'],
  jump: ['\u{1F438}', 'Jump'], arms: ['\u{1F64C}', 'Arms up'], squat: ['\u{1F9CE}', 'Squat'],
  clap: ['\u{1F44F}', 'Clap'], hug: ['\u{1F917}', 'Hug'], reach: ['\u{270B}', 'Reach'],
  cup: ['\u{1F932}', 'Cup your hands'], dance: ['\u{1F483}', 'Dance'], lean: ['\u{1F3C4}', 'Lean'], duck: ['\u{1F986}', 'Duck']
};
/* The console's own places, after the games. */
const PLACES = [
  { id: 'store', name: 'Store', icon: '\u{1F6CD}\u{FE0F}', accent: '#5b8cff', soon: true },
  { id: 'make', name: 'Make a game', icon: '\u{1F58C}\u{FE0F}', accent: '#ffb02e', soon: true },
  { id: 'family', name: 'Family', icon: '\u{1F46A}', accent: '#53c98f' },
  { id: 'settings', name: 'Settings', icon: '\u{2699}\u{FE0F}', accent: '#8a83b8' },
  { id: 'help', name: 'Help', icon: '\u{2753}', accent: '#c46bff' }
];
/* Where the picked game sits on the shelf after the last visit. */
let lastFocus = 0;
const HOVER_FOCUS = 0.45;      /* seconds of a hand on a side tile to slide to it */
const LAUNCH = 0.5;            /* seconds for the picked tile to grow to fill the screen */

export function menu({ onPlay, onRecalibrate }){
  clearUI();
  const s = screen('picker home');
  s.appendChild(logo('small'));

  /* The corner: the time, and whether the camera's working. */
  const sys = h('div', 'sysbar');
  const clock = h('span', 'clock', ''), cam = h('span', 'camdot', '');
  sys.append(cam, clock);
  s.appendChild(sys);

  if (pose.mouse.active && pose.reason !== 'debug'){
    s.appendChild(h('div', 'warnstrip', '⚠ No camera — the mouse is playing'));
  }

  const items = [...GAMES.map(g => ({ kind: 'game', g, accent: g.accent, name: g.name })),
                 ...PLACES.map(p => ({ kind: 'place', p, accent: p.accent, name: p.name }))];
  const shelf = h('div', 'shelf');
  const bar = new PlayerBar();
  const cards = items.map((it, n) => {
    const card = button('', 'tile' + (it.kind === 'place' ? ' place' : ''));
    card.style.setProperty('--accent', it.accent);
    const pic = document.createElement('canvas');
    pic.className = 'pic';
    card.insertBefore(pic, card.firstChild);
    card.querySelector('.lbl').textContent = it.name;
    if (it.p?.soon) card.appendChild(h('span', 'soon', '\u{1F512} Coming soon'));
    onPick(card, () => choose(n));
    shelf.appendChild(card);
    return { card, pic, paint: it.kind === 'game' ? poster(it.g) : placePoster(it.p, bar), hot: 0, it };
  });
  s.appendChild(shelf);

  /* Under the picked tile: the moves, how many can play, and the best. */
  const info = h('div', 'shelfinfo');
  s.appendChild(info);

  let focus = Math.min(lastFocus, items.length - 1), t = 0, mix = 0, going = null, family = false, tick = 0;

  function layout(){
    cards.forEach(({ card }, n) => {
      const off = n - focus, a = Math.abs(off), side = Math.sign(off);
      const x = side * (a <= 1 ? a * 33 : 33 + (a - 1) * 19);
      const sc = a === 0 ? 1 : a === 1 ? 0.58 : 0.44;
      card.style.transform = `translate(calc(-50% + ${x}vw), -50%) scale(${sc})`;
      card.style.opacity = a > 2 ? 0 : a === 2 ? 0.45 : a === 1 ? 0.8 : 1;
      card.style.zIndex = 10 - a;
      card.style.pointerEvents = a > 2 ? 'none' : '';
      card.classList.toggle('focus', a === 0);
    });
    const it = items[focus];
    info.innerHTML = '';
    if (it.kind === 'game'){
      const moves = h('div', 'moves');
      for (const m of it.g.moves || []){ const mv = MOVES[m]; if (mv) moves.appendChild(h('span', 'move', `<span class="mi">${mv[0]}</span><span class="ml">${mv[1]}</span>`)); }
      const who = h('div', 'who', '\u{1F464}'.repeat(4));
      who.title = 'Up to four play';
      const best = Math.max(...[1, 2, 3, 4].map(n => scores.best(it.g.id, n)));
      info.append(moves, who);
      if (best) info.appendChild(h('div', 'best', `\u{1F3C6} ${best}`));
    } else info.appendChild(h('div', 'placeinfo', it.p.soon ? 'Coming soon' : ''));
  }
  function move(to){
    to = Math.max(0, Math.min(items.length - 1, to));
    if (to === focus) return;
    focus = to; lastFocus = to; sfx.nav(); ambience.lift(); layout();
  }
  /* A pick on a side tile slides to it; on the picked one, goes in. */
  function choose(n){
    if (going) return;
    if (family){ return; }
    if (n !== focus){ move(n); return; }
    const it = items[n];
    if (it.kind === 'game'){
      sfx.select();
      going = { t: 0, card: cards[n].card, g: it.g };
      cards[n].card.classList.add('launch');
      return;
    }
    if (it.p.soon){ sfx.boing(0.7); cards[n].card.classList.remove('nope'); void cards[n].card.offsetWidth; cards[n].card.classList.add('nope'); return; }
    sfx.select();
    if (it.p.id === 'settings') settings(onRecalibrate);
    if (it.p.id === 'help') help();
    if (it.p.id === 'family') openFamily();
  }
  function openFamily(){
    family = true;
    shelf.style.visibility = info.style.visibility = 'hidden';
    const o = overlay(); o.classList.add('family');
    o.append(h('h2', '', 'Family'));
    o.appendChild(h('div', 'familyspace'));
    o.appendChild(onPick(button('Close'), () => { sfx.back(); family = false; o.remove(); shelf.style.visibility = info.style.visibility = ''; }));
  }
  const key = (e) => {
    if (!s.isConnected){ removeEventListener('keydown', key); return; }
    if (family || document.querySelector('.screen.dim')) return;
    if (e.key === 'ArrowRight') move(focus + 1);
    else if (e.key === 'ArrowLeft') move(focus - 1);
    else if (e.key === 'Enter') choose(focus);
  };
  addEventListener('keydown', key);
  layout();
  ambience.start();

  return {
    bar,
    get focus(){ return focus; },
    tick(dt){
      t += dt; tick += dt;
      bar.step(dt);
      mix += ((items[focus].kind === 'game' ? 1 : 0.6) - mix) * Math.min(1, dt * 2);
      /* A hand resting on a side tile a moment slides the shelf to it. */
      for (let n = 0; n < cards.length; n++){
        const cd = cards[n];
        cd.hot = cd.card.classList.contains('hot') && n !== focus ? cd.hot + dt : 0;
        if (cd.hot >= HOVER_FOCUS){ cd.hot = 0; move(n); }
      }
      if (tick >= 1 || !clock.textContent){
        tick = 0;
        clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const ok = pose.usingCamera && pose.ready;
        cam.className = 'camdot ' + (ok ? 'ok' : 'off');
        cam.title = ok ? 'Camera on' : 'No camera';
      }
      if (going){
        going.t += dt;
        if (going.t >= LAUNCH){ removeEventListener('keydown', key); ambience.stop(); const g = going.g; going = null; onPlay(g); }
      }
    },
    draw(c, W, H){
      drawPark(c, W, H, t, 0.22);
      drawLiving(c, W, H, t, { accent: items[focus].accent, mix });
      /* Everyone in view, faintly, in their colours behind it all. */
      drawBodies(c, W, H);
      for (let n = 0; n < cards.length; n++){
        const cd = cards[n], a = Math.abs(n - focus);
        if (a > 2) continue;
        /* The picked one is alive; the others are still pictures, painted
           once. */
        if (a === 0){ paintPoster(cd, t); cd.still = false; }
        else if (!cd.still) cd.still = paintPoster(cd, t);
      }
      if (family){
        const sp = document.querySelector('.familyspace');
        const r = sp ? sp.getBoundingClientRect() : null;
        bar.draw(c, W / 2, r && r.height ? r.top + r.height / 2 : H * 0.5, H * 0.09);
      } else bar.draw(c, W / 2, H * 0.085, H * 0.042);
      /* Going in: the screen fades to dark as the tile grows. */
      if (going){ c.fillStyle = `rgba(13,11,26,${Math.min(1, going.t / LAUNCH)})`; c.fillRect(0, 0, W, H); }
    }
  };
}

/* The players' silhouettes, very faint, behind the shelf. */
function drawBodies(c, W, H){
  pose.players.forEach((p, i) => { if (p.present && p.lm) silhouette(c, p.lm, W, H, PLAYER_COLORS[i], 0.12); });
}

/* A console place's picture: its colour, glowing, with its sign big in the
   middle and a few sparkles drifting up. */
function placePoster(p, bar){
  return (c, W, H, t) => {
    const g = c.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.7);
    g.addColorStop(0, p.accent); g.addColorStop(1, '#1a1534');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 9; k++){
      const u = ((t * 0.12 + k / 9) % 1), x = W * (0.1 + 0.8 * ((k * 0.37) % 1));
      c.fillStyle = `rgba(255,246,226,${0.5 * (1 - u)})`;
      c.beginPath(); c.arc(x, H * (1 - u), H * 0.012, 0, 6.2832); c.fill();
    }
    /* The family: everyone who's here, their faces in their bubbles. */
    if (p.id === 'family' && bar){ bar.draw(c, W / 2, H * 0.5, H * 0.13); return; }
    c.font = `${Math.round(H * 0.5)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.save(); c.translate(W / 2, H * 0.5 + Math.sin(t * 1.5) * H * 0.02);
    c.fillText(p.icon, 0, 0);
    c.restore();
  };
}

/* Each tile's picture is its own small canvas, sized to the tile as laid out. */
function paintPoster(p, t){
  if (!p.pic.getContext || !p.pic.getBoundingClientRect) return false;
  const w0 = p.pic.offsetWidth || p.pic.getBoundingClientRect().width, h0 = p.pic.offsetHeight || p.pic.getBoundingClientRect().height;
  if (!w0) return false;
  const k = Math.min(2, devicePixelRatio || 1);
  const w = Math.round(w0 * k), hgt = Math.round(h0 * k);
  if (p.pic.width !== w || p.pic.height !== hgt){ p.pic.width = w; p.pic.height = hgt; }
  const c = p.pic.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  p.paint(c, w0, h0, t);
  return true;
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
