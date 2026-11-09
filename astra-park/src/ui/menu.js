import { GAMES } from '../games/index.js';
import { scores } from '../games/common.js';
import { button, onPick, cursor } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { audio, sfx, ambience } from '../audio/sound.js';
import { pose, MAX_PLAYERS } from '../tracking/pose.js';
import { PlayerBar } from './playerbar.js';
import { poster } from './posters.js';
import { MARK, PAPER } from './boot.js';
import { remote } from './remote.js';

/* Home: MoveCube's front room, the way a TV box does it. Along the top, the
   name, who's here (a bubble each, with their face), whether the camera's
   working, and the time. Under it a big banner for the game you're on - its
   living picture, its name, a line about it, how many can play, and Play.
   Under that, all the games in a row, and a row of the console's own places.
   Moving along (pointing, or the remote's arrows) changes the banner; a row
   slides along to keep the one you're on in view, so there's room for as
   many games as there are.

   Arriving from the boot (arrive), the tiles fly out from where the cube
   broke apart, into their places. */
/* A line about each game. */
const BLURB = {
  'pop-party': 'Reach up and pop the balloons before they float away',
  'uncle-bs-boat': 'Cup your hands and catch fish with Uncle B',
  'dance-party': 'Copy the dancers and move to the music',
  'last-known-position': 'Run, jump and explore a strange planet',
  'castle-defense': 'Build towers together and keep the castle safe'
};
/* The console's own places, in the last row. */
const PLACES = [
  { id: 'family', name: 'Family', icon: '\u{1F46A}', accent: '#53c98f', blurb: 'Everyone who\'s here today' },
  { id: 'settings', name: 'Settings', icon: '\u{2699}\u{FE0F}', accent: '#8a83b8', blurb: 'Sound, camera and screen' },
  { id: 'help', name: 'Help', icon: '\u{2753}', accent: '#c46bff', blurb: 'How to play MoveCube' },
  { id: 'store', name: 'Store', icon: '\u{1F6CD}\u{FE0F}', accent: '#5b8cff', soon: true, blurb: 'New games, coming soon' },
  { id: 'make', name: 'Make a game', icon: '\u{1F58C}\u{FE0F}', accent: '#ffb02e', soon: true, blurb: 'Coming soon' }
];
/* What was picked last visit. */
let lastFocus = 0;
const HOVER_FOCUS = 0.05;      /* seconds of a hand on a tile to pick it (the cursor's already sticky) */
const LAUNCH = 0.5;            /* seconds of going in */
const POINT_AGAIN = 0.04;      /* how far (of the screen) a hand moves to take over from the remote */
const FLY = 0.7, FLY_STAGGER = 0.05;   /* arriving: each tile's flight, one after another */

export function menu({ onPlay, onRecalibrate, arrive = false }){
  clearUI();
  const s = screen('tvhome' + (arrive ? ' arrive' : ''));

  /* the top bar */
  const top = h('div', 'tvtop');
  const brand = h('div', 'brand', `<span class="mark">${MARK}</span><span>MoveCube</span>`);
  const players = h('div', 'tvplayers');
  const clock = h('span', 'clock', ''), cam = h('span', 'camdot', '');
  const sys = h('div', 'tvsys'); sys.append(players, cam, clock);
  top.append(brand, sys);
  s.appendChild(top);
  if (pose.mouse.active && pose.reason !== 'debug') s.appendChild(h('div', 'warnstrip', '⚠ No camera — the mouse is playing'));

  const bar = new PlayerBar();
  const items = [];
  for (const g of GAMES) items.push({ kind: 'game', g, shelf: 'games', accent: g.accent, name: g.name, blurb: BLURB[g.id] || '', paint: poster(g) });
  for (const p of PLACES) items.push({ kind: 'place', p, shelf: 'places', accent: p.accent, name: p.name, blurb: p.blurb, paint: placePoster(p, bar) });

  /* the banner */
  const hero = h('div', 'hero');
  const heroPic = document.createElement('canvas'); heroPic.className = 'heropic';
  const hname = h('div', 'hname'), hblurb = h('div', 'hblurb'), hmoves = h('div', 'hmoves');
  const play = onPick(button('<span class="tri"></span>Play', 'play'), () => choose(focus));
  const htext = h('div', 'herotext'); htext.append(hname, hblurb, hmoves, play);
  hero.append(heroPic, h('div', 'heroshade'), htext);
  s.appendChild(hero);

  /* the rows */
  const shelves = h('div', 'shelves'), wrap = h('div', 'shelfwrap');
  shelves.appendChild(wrap); s.appendChild(shelves);
  const rows = [];
  for (const id of ['games', 'places']){
    const list = items.map((it, n) => ({ it, n })).filter(({ it }) => it.shelf === id);
    if (!list.length) continue;
    const sec = h('section', 'shelf' + (id === 'places' ? ' places' : ''));
    const row = h('div', 'shelfrow');
    sec.append(row);
    wrap.appendChild(sec);
    rows.push({ sec, row, ns: list.map(({ n }) => n) });
    for (const { it, n } of list) items[n].rowAt = rows.length - 1;
  }
  const cards = items.map((it, n) => {
    const card = button('', 'tvtile' + (it.kind === 'place' ? ' place' : ''));
    card.style.setProperty('--accent', it.accent);
    const pic = document.createElement('canvas'); pic.className = 'pic';
    card.insertBefore(pic, card.firstChild);
    card.querySelector('.lbl').textContent = it.name;
    if (it.p?.soon) card.appendChild(h('span', 'soon', 'Soon'));
    onPick(card, () => choose(n));
    card.addEventListener('remotefocus', () => move(n));
    rows[it.rowAt].row.appendChild(card);
    return { card, pic, paint: it.paint, hot: 0, it, still: false };
  });
  s.appendChild(h('div', 'buildstamp', typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'));

  let scrollY = 0;
  let focus = Math.min(lastFocus, items.length - 1), t = 0, going = null, family = false, tick = 0, flown = !arrive;
  /* After the remote's used, pointing takes over again only once a hand (or
     the mouse) actually moves - not because the rows slid under one that's
     resting. */
  let keySeen = remote.lastKey, anchor = null;

  function show(){
    const it = items[focus];
    cards.forEach(({ card }, n) => card.classList.toggle('focus', n === focus));
    remote.mark(cards[focus].card);
    hero.style.setProperty('--accent', it.accent);
    hname.textContent = it.name; hblurb.textContent = it.blurb;
    hmoves.innerHTML = it.kind === 'game' ? `<span class="mv who">${howMany(it.g)}</span>` : '';
    play.querySelector('.lbl').innerHTML = it.kind === 'game' ? '<span class="tri"></span>Play' : it.p.soon ? 'Coming soon' : 'Open';
    /* keep the row in view, and the tile along it */
    const r = rows[it.rowAt];
    /* (up only as far as it takes to see the whole row - with everything on
       screen, not at all) */
    const top = r.sec.offsetTop - rows[0].sec.offsetTop, bottom = top + r.sec.offsetHeight, view = shelves.clientHeight - rows[0].sec.offsetTop;
    if (top < scrollY) scrollY = top;
    else if (bottom > scrollY + view) scrollY = Math.min(top, bottom - view);
    wrap.style.transform = `translateY(${-scrollY}px)`;
    const tile = cards[focus].card, over = tile.offsetLeft + tile.offsetWidth - r.row.clientWidth + tile.offsetWidth * 0.3;
    r.row.style.transform = `translateX(${-Math.max(0, over)}px)`;
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
    s.style.visibility = 'hidden';     /* just the room, and everyone's bubbles big in the middle */
    const o = overlay(); o.classList.add('family');
    o.append(h('h2', '', 'Family'));
    o.appendChild(h('div', 'familyspace'));
    o.appendChild(onPick(button('Close', 'close'), () => { sfx.back(); family = false; s.style.visibility = ''; o.remove(); }));
  }
  show();
  ambience.start();

  return {
    bar,
    get focus(){ return focus; },
    tick(dt){
      t += dt; tick += dt;
      bar.step(dt);
      /* arriving: each tile flies out from the middle of the screen, where the cube was */
      if (!flown){
        flown = true;
        const cx = innerWidth / 2, cy = innerHeight * 0.42;
        cards.forEach(({ card }, n) => {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--fx', `${cx - (r.left + r.width / 2)}px`);
          card.style.setProperty('--fy', `${cy - (r.top + r.height / 2)}px`);
          card.style.setProperty('--fr', `${((n * 1.3 + 0.5) % 3) - 1.5}rad`);
          card.style.animationDelay = `${n * FLY_STAGGER}s`;
          card.classList.add('fly');
        });
        setTimeout(() => cards.forEach(({ card }) => card.classList.remove('fly')), (FLY + items.length * FLY_STAGGER) * 1000 + 100);
      }
      if (remote.lastKey !== keySeen){ keySeen = remote.lastKey; anchor = cursor.rings.map(r => [r.x, r.y]); }
      if (anchor && (cursor.rings.length !== anchor.length || cursor.rings.some((r, i) => Math.hypot(r.x - anchor[i][0], r.y - anchor[i][1]) > POINT_AGAIN))) anchor = null;
      /* The tile pointed at is the picked one. */
      if (!anchor) for (let n = 0; n < cards.length; n++){
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
        if (going.t >= LAUNCH){ ambience.stop(); const g = going.g; going = null; onPlay(g); }
      }
    },
    draw(c, W, H){
      /* the room: soft paper, washed with the picked game's colour */
      c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
      wash(c, W * 0.15, 0, H * 0.9, '#ccfbf1', 0.6);
      wash(c, W * 0.9, H, H * 1.0, items[focus].accent, 0.18);
      /* the banner's living picture; the tiles' still ones */
      paint(heroPic, items[focus].paint, t);
      cards.forEach((cd) => { if (!cd.still) cd.still = paint(cd.pic, cd.paint, 1.5); });
      if (family){
        const sp = document.querySelector('.familyspace');
        const r = sp ? sp.getBoundingClientRect() : null;
        bar.draw(c, W / 2, r && r.height ? r.top + r.height / 2 : H * 0.5, H * 0.09, 'rgba(40,44,70,.5)');
      } else {
        const r = players.getBoundingClientRect();
        if (r.width) bar.draw(c, r.left + r.width / 2, r.top + r.height / 2, r.height * 0.42, 'rgba(40,44,70,.5)');
      }
      if (going){ c.fillStyle = `rgba(13,11,26,${Math.min(1, going.t / LAUNCH)})`; c.fillRect(0, 0, W, H); }
    }
  };
}

/* How many can play: '1-4 players', or just the one number. */
function howMany(g){
  const lo = g.minPlayers || 1, hi = g.maxPlayers || MAX_PLAYERS;
  return lo === hi ? `${hi} player${hi > 1 ? 's' : ''}` : `${lo}\u2013${hi} players`;
}

function wash(c, x, y, r, col, a){
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(243,244,247,0)');
  c.save(); c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}

/* A console place's picture: its colour, glowing, with its sign big in the
   middle and a few sparkles drifting up. */
function placePoster(p, bar){
  return (c, W, H, t) => {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, p.accent); g.addColorStop(1, mix(p.accent));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 9; k++){
      const u = ((t * 0.12 + k / 9) % 1), x = W * (0.1 + 0.8 * ((k * 0.37) % 1));
      c.fillStyle = `rgba(255,255,255,${0.5 * (1 - u)})`;
      c.beginPath(); c.arc(x, H * (1 - u), H * 0.012, 0, 6.2832); c.fill();
    }
    /* The family: everyone who's here, their faces in their bubbles. */
    if (p.id === 'family' && bar){ bar.draw(c, W / 2, H * 0.5, H * 0.13); return; }
    c.font = `${Math.round(H * 0.45)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(p.icon, W / 2, H * 0.52 + Math.sin(t * 1.5) * H * 0.02);
  };
}
/* a lighter partner for a colour, for its gradient */
function mix(hex){
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return `rgb(${Math.round(r + (255 - r) * 0.45)},${Math.round(g + (255 - g) * 0.45)},${Math.round(b + (255 - b) * 0.45)})`;
}

/* A picture on its own small canvas, sized to it as laid out. */
function paint(pic, fn, t){
  if (!pic.getContext || !pic.getBoundingClientRect) return false;
  const w0 = pic.offsetWidth || pic.getBoundingClientRect().width, h0 = pic.offsetHeight || pic.getBoundingClientRect().height;
  if (!w0) return false;
  const k = Math.min(2, devicePixelRatio || 1);
  const w = Math.round(w0 * k), hgt = Math.round(h0 * k);
  if (pic.width !== w || pic.height !== hgt){ pic.width = w; pic.height = hgt; }
  const c = pic.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  fn(c, w0, h0, t);
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
  [['👉','Point at something, then wave to press it'],
   ['📺','Or use the remote: arrows to move, OK to pick, Back to go back'],
   ['🙌','Raise both hands above your head to pause (or press Back)'],
   ['📏','Stand about two metres back so your whole body is in frame'],
   ['💡','Lights on — the camera needs to see you'],
   ['⛶','Press F for fullscreen on the TV']]
   .forEach(([ic, t]) => bl.appendChild(h('li','',`<span class="ic">${ic}</span><span>${t}</span>`)));
  s.appendChild(bl);
  s.appendChild(onPick(button('Got it', 'close'), () => s.remove()));
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
  s.appendChild(onPick(button('Close', 'close'), () => s.remove()));
}

export function toggleFullscreen(){
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
