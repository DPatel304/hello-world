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
   for each player with their face. Under it, a grid of everything: the
   games, big and picture-led, with the moves each uses in little pictures
   under its name; and under them the console's own places - the store,
   making a game, the family, settings and help. The tile pointed at comes
   alive and lifts; a wave goes in. Arrows and Enter work too, for the grown-up at the laptop.
   The park behind follows the time of day and the season, and takes on
   the picked game's colour; a soft ambience plays under it all. */
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
/* What was picked last visit. */
let lastFocus = 0;
const HOVER_FOCUS = 0.05;      /* seconds of a hand on a tile to pick it (the cursor's already sticky) */
const LAUNCH = 0.5;            /* seconds of going in */

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

  const bar = new PlayerBar();
  const items = [...GAMES.map(g => ({ kind: 'game', g, accent: g.accent, name: g.name, paint: poster(g) })),
                 ...PLACES.map(p => ({ kind: 'place', p, accent: p.accent, name: p.name, paint: placePoster(p, bar) }))];

  /* The grid: the games, three to a row, and the console's places in a
     slimmer row along the bottom. */
  const grid = h('div', 'grid');
  const games = h('div', 'gamegrid'), places = h('div', 'placerow');
  grid.append(games, places);
  const cards = items.map((it, n) => {
    const card = button('', 'tile' + (it.kind === 'place' ? ' place' : ''));
    card.style.setProperty('--accent', it.accent);
    const pic = document.createElement('canvas');
    pic.className = 'pic';
    card.insertBefore(pic, card.firstChild);
    card.querySelector('.lbl').textContent = it.name;
    if (it.kind === 'game'){
      const mv = h('span', 'tilemoves', (it.g.moves || []).map(m => MOVES[m] ? `<span title="${MOVES[m][1]}">${MOVES[m][0]}</span>` : '').join(''));
      card.appendChild(mv);
    }
    if (it.p?.soon) card.appendChild(h('span', 'soon', '\u{1F512} Coming soon'));
    onPick(card, () => choose(n));
    (it.kind === 'game' ? games : places).appendChild(card);
    return { card, pic, paint: it.paint, hot: 0, it, still: false };
  });
  s.appendChild(grid);

  let focus = Math.min(lastFocus, items.length - 1), t = 0, mix = 0, going = null, family = false, tick = 0;

  function show(){
    cards.forEach(({ card }, n) => card.classList.toggle('focus', n === focus));
  }
  function move(to){
    to = Math.max(0, Math.min(items.length - 1, to));
    if (to === focus) return;
    focus = to; lastFocus = to; sfx.nav(); ambience.lift(); show();
  }
  /* A pick goes straight in. */
  function choose(n){
    if (going || family) return;
    move(n);
    const it = items[n];
    if (it.kind === 'game'){
      sfx.select();
      going = { t: 0, g: it.g };
      cards[n].card.classList.add('launch');
      return;
    }
    if (it.p.soon){ sfx.boing(0.7); const cd = cards[n].card; cd.classList.remove('nope'); void cd.offsetWidth; cd.classList.add('nope'); return; }
    sfx.select();
    if (it.p.id === 'settings') settings(onRecalibrate);
    if (it.p.id === 'help') help();
    if (it.p.id === 'family') openFamily();
  }
  function openFamily(){
    family = true;
    grid.style.visibility = 'hidden';
    const o = overlay(); o.classList.add('family');
    o.append(h('h2', '', 'Family'));
    o.appendChild(h('div', 'familyspace'));
    o.appendChild(onPick(button('Close'), () => { sfx.back(); family = false; o.remove(); grid.style.visibility = ''; }));
  }
  const key = (e) => {
    if (!s.isConnected){ removeEventListener('keydown', key); return; }
    if (family || document.querySelector('.screen.dim')) return;
    const n = GAMES.length, inPlaces = focus >= n;
    if (e.key === 'ArrowRight') move(focus + 1);
    else if (e.key === 'ArrowLeft') move(focus - 1);
    else if (e.key === 'ArrowDown') move(inPlaces ? focus : focus + 3 < n ? focus + 3 : n + Math.min(PLACES.length - 1, Math.round((focus % 3) * 2)));
    else if (e.key === 'ArrowUp') move(inPlaces ? Math.min(n - 1, Math.floor((n - 1) / 3) * 3 + Math.min(2, Math.round((focus - n) / 2))) : focus - 3 >= 0 ? focus - 3 : focus);
    else if (e.key === 'Enter') choose(focus);
  };
  addEventListener('keydown', key);
  show();
  ambience.start();

  return {
    bar,
    get focus(){ return focus; },
    tick(dt){
      t += dt; tick += dt;
      bar.step(dt);
      mix += ((items[focus].kind === 'game' ? 1 : 0.6) - mix) * Math.min(1, dt * 2);
      /* The tile pointed at is the picked one. */
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
      drawBodies(c, W, H);
      /* The picked tile is alive; the rest are still pictures, painted once. */
      cards.forEach((cd, n) => {
        if (n === focus){ paintPoster(cd, t); cd.still = false; }
        else if (!cd.still) cd.still = paintPoster(cd, 1.5);
      });
      if (family){
        const sp = document.querySelector('.familyspace');
        const r = sp ? sp.getBoundingClientRect() : null;
        bar.draw(c, W / 2, r && r.height ? r.top + r.height / 2 : H * 0.5, H * 0.09);
      } else bar.draw(c, W / 2, H * 0.065, H * 0.036);
      if (going){ c.fillStyle = `rgba(13,11,26,${Math.min(1, going.t / LAUNCH)})`; c.fillRect(0, 0, W, H); }
    }
  };
}

/* The players' silhouettes, very faint, behind it all. */
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
  [['👉','Point at a button, then wave to press it (or hold still on it a couple of seconds)'],
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
