import { GAMES } from '../games/index.js';
import { scores } from '../games/common.js';
import { button, onPick, cursor } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { audio, sfx, ambience } from '../audio/sound.js';
import { pose, MAX_PLAYERS } from '../tracking/pose.js';
import { poster } from './posters.js';
import { MARK, PAPER } from './boot.js';
import { account, AVATARS } from './account.js';
import { theme, setTheme, DARK_PAPER } from './theme.js';
import { remote } from './remote.js';
import { trailer } from './trailer.js';

/* Home: Orlis Play's front room, the way a TV box does it. Along the top, the
   name, who's here (a bubble each, with their face), whether the camera's
   working, and the time. Under it a big banner for the game you're on - its
   living picture, its name, a line about it, how many can play, and Play.
   Under that, the games in a row. The console's own places - settings, the
   store - are in the menu behind the button in the corner. Moving along (pointing, or the remote's arrows) changes the banner; a row
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
/* Each game's icon, in the cube's style: a rounded square in two colours,
   a simple white picture on it. */
export const ICONS = {
  'pop-party': { cols: ['#ff7eb3', '#ffa25a'], glyph: 'balloon' },
  'last-known-position': { cols: ['#4f46e5', '#22d3ee'], glyph: 'rocket' },
  'uncle-bs-boat': { cols: ['#0ea5e9', '#5eead4'], glyph: 'boat' },
  'dance-party': { cols: ['#f43f5e', '#fbbf24'], glyph: 'note' },
  'castle-defense': { cols: ['#10b981', '#a3e635'], glyph: 'tower' }
};
const GLYPHS = {
  balloon: '<path d="M50 14c15 0 25 11 25 26 0 17-14 30-25 33-11-3-25-16-25-33 0-15 10-26 25-26z" fill="#fff"/><path d="M46 73h8l-4 6z" fill="#fff"/><path d="M50 79c-5 6 5 9 0 16" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="41" cy="31" rx="5" ry="8" transform="rotate(-25 41 31)" fill="#000" opacity=".12"/>',
  rocket: '<path d="M50 10c11 9 16 24 16 40 0 9-2 17-5 24H39c-3-7-5-15-5-24 0-16 5-31 16-40z" fill="#fff"/><circle cx="50" cy="40" r="7" fill="#000" opacity=".16"/><path d="M34 56l-11 16 13-3zM66 56l11 16-13-3z" fill="#fff"/><path d="M43 78h14l-7 12z" fill="#fff" opacity=".8"/>',
  boat: '<path d="M18 60h64l-10 16H28z" fill="#fff"/><path d="M50 18v38H24z" fill="#fff"/><path d="M54 26v30h20z" fill="#fff" opacity=".85"/>',
  note: '<ellipse cx="38" cy="72" rx="12" ry="9" transform="rotate(-20 38 72)" fill="#fff"/><path d="M47 70V20l26 8v12l-20-6v36" fill="#fff"/>',
  tower: '<path d="M30 30h8v-8h8v8h8v-8h8v8h8v14H30z" fill="#fff"/><path d="M34 44h32v36H34z" fill="#fff"/><path d="M45 80V64a5 5 0 0 1 10 0v16z" fill="#000" opacity=".15"/>'
};
/* A game's icon: its own, or the one its Store entry gave it (a picture
   drawn in simple shapes - anything that could run code is turned away). */
const safeSvg = (svg) => typeof svg === 'string' && svg.length < 4000 && !/<\s*script|\bon\w+\s*=|javascript:|<\s*foreign|href/i.test(svg) ? svg : null;
export const iconOf = (g) => ICONS[g.id]
  || (g.store && g.store.icon && { cols: g.store.icon.cols.length === 2 ? g.store.icon.cols : [g.accent, g.accent], glyph: 'balloon', svg: safeSvg(g.store.icon.glyph) })
  || { cols: [g.accent, g.accent], glyph: 'balloon' };
export { GLYPHS };

/* Games kept off the home screen for now (still there, just not shown). */
export const HIDDEN = new Set(['uncle-bs-boat', 'dance-party', 'castle-defense']);
/* What's in the corner menu. */
const MENU = [
  { id: 'settings', name: 'Settings', icon: '\u{2699}\u{FE0F}' },
  { id: 'store', name: 'Store', icon: '\u{1F6CD}\u{FE0F}', soon: true,
    line: 'New games to download',
    about: 'Browse new movement games, download the ones you like, and they keep themselves up to date. Games your friends make can appear here too.' },
  { id: 'make', name: 'Create', icon: '\u{1F58C}\u{FE0F}', soon: true,
    line: 'Make your own games',
    about: 'Build your own movement games from ready-made parts - obstacles, gems, creatures - then play them by moving. Up to five, saved on this PC.' }
];

/* Store and Create, until they're here: what's coming, nicely. */
function comingSoon(m){
  const s = overlay(); s.classList.add('setscreen');
  const card = h('div', 'setcard soonpage');
  card.append(h('div', 'soonicon', m.icon), h('div', 'soontag', 'Coming soon'), h('h2', '', m.name), h('p', 'soonline', m.line), h('p', 'soonabout', m.about));
  const close = () => { sfx.back?.(); s.remove(); };
  card.appendChild(onPick(button('OK', 'setbtn soonok'), close));
  s.appendChild(card);
  s.addEventListener('pointerdown', (e) => { if (e.target === s) close(); });
}
/* Seconds a first pick of Exit waits for the second. */
const EXIT_SURE = 4;
/* The Windows app's own window, when the game is running inside it. */
function appWindow(){
  const w = typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.window;
  return w && w.getCurrentWindow ? w.getCurrentWindow() : null;
}
/* What was picked last - kept between launches, by game. */
const LAST = 'orlis.lastGame';
let lastFocus = null;
const remembered = () => { try { return localStorage.getItem(LAST); } catch { return null; } };
const remember = (id) => { try { localStorage.setItem(LAST, id); } catch {} };
const HOVER_FOCUS = 0.05;      /* seconds of a hand on a tile to pick it (the cursor's already sticky) */
const LAUNCH = 0.5;            /* seconds of going in */
const POINT_AGAIN = 0.04;      /* how far (of the screen) a hand moves to take over from the remote */
const FLY = 0.7, FLY_STAGGER = 0.05;   /* arriving: each tile's flight, one after another */

export function menu({ onPlay, onRecalibrate, onWho, onStore, arrive = false }){
  clearUI();
  const s = screen('tvhome' + (arrive ? ' arrive' : ''));

  /* the top bar */
  const top = h('div', 'tvtop');
  const brand = h('div', 'brand', `<span class="mark">${MARK}</span><span>Orlis <i class="play">Play</i></span>`);
  /* who's playing (in the Windows app): their picture and name, and picking
     it goes back to "Who's playing?" */
  const who = account.current;
  if (who && onWho){
    brand.appendChild(onPick(button(`<span class="av">${AVATARS[who.avatar] || AVATARS.cube}</span><span class="nm">${who.name.replace(/[&<>]/g, '')}</span>`, 'whochip'), () => { sfx.select(); onWho(); }));
  }
  const clock = h('span', 'clock', ''), cam = h('span', 'camdot', '');
  const burger = onPick(button('<span class="bars"><i></i><i></i><i></i></span>', 'burger'), () => openMenu());
  const sys = h('div', 'tvsys'); sys.append(cam, clock, burger);
  top.append(brand, sys);
  s.appendChild(top);
  if (pose.mouse.active && pose.reason !== 'debug') s.appendChild(h('div', 'warnstrip', '⚠ No camera — the mouse is playing'));

  const items = [];
  for (const g of GAMES) if (!HIDDEN.has(g.id)) items.push({ kind: 'game', g, shelf: 'games', accent: iconOf(g).cols[0], icon: iconOf(g), name: g.name, blurb: BLURB[g.id] || (g.store && g.store.blurb) || '', paint: poster(g), trailer: undefined });

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
  for (const id of ['games']){
    const list = items.map((it, n) => ({ it, n })).filter(({ it }) => it.shelf === id);
    if (!list.length) continue;
    const sec = h('section', 'shelf');
    const row = h('div', 'shelfrow');
    sec.append(row);
    wrap.appendChild(sec);
    rows.push({ sec, row, ns: list.map(({ n }) => n) });
    for (const { it, n } of list) items[n].rowAt = rows.length - 1;
  }
  const cards = items.map((it, n) => {
    const card = button('', 'tvtile');
    card.style.setProperty('--accent', it.accent);
    const pic = h('div', 'icon', `<svg viewBox="0 0 100 100" aria-hidden="true">${it.icon.svg || GLYPHS[it.icon.glyph]}</svg>`);
    pic.style.setProperty('--c1', it.icon.cols[0]); pic.style.setProperty('--c2', it.icon.cols[1]);
    card.insertBefore(pic, card.firstChild);
    card.querySelector('.lbl').innerHTML = `<span class="tn"></span><span class="tvsub">${howMany(it.g)}</span>`;
    card.querySelector('.tn').textContent = it.name;
    onPick(card, () => choose(n));
    card.addEventListener('mouseenter', () => { if (!going && !open) move(n); });
    card.addEventListener('remotefocus', () => move(n));
    rows[it.rowAt].row.appendChild(card);
    return { card, pic, paint: it.paint, hot: 0, it, still: false };
  });
  s.appendChild(h('div', 'buildstamp', typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'));

  let scrollY = 0;
  if (lastFocus === null) lastFocus = Math.max(0, items.findIndex(it => it.g.id === remembered()));
  let focus = Math.min(lastFocus, items.length - 1), t = 0, going = null, open = null, tick = 0, flown = !arrive;
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
    hmoves.innerHTML = `<span class="mv who">${howMany(it.g)}</span>`;
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
    focus = to; lastFocus = to; remember(items[to].g.id); sfx.nav(); ambience.lift(); show();
  }
  /* A pick goes straight in. */
  function choose(n){
    if (going || open) return;
    move(n);
    sfx.select();
    going = { t: 0, g: items[n].g };
    cards[n].card.classList.add('launch');
  }
  /* The corner menu: a little card under the button. */
  function openMenu(){
    if (going || open) return;
    sfx.select();
    open = overlay(); open.classList.add('popmenu');
    const card = h('div', 'popcard');
    const esc = (e) => { if (e.key === 'Escape'){ e.preventDefault(); sfx.back(); shut(); } };
    const shut = () => { if (!open) return; open.remove(); open = null; removeEventListener('keydown', esc, true); };
    addEventListener('keydown', esc, true);
    for (const m of MENU){
      const b = onPick(button(`<span class="pi">${m.icon}</span><span class="pn">${m.name}</span>${m.soon && !(m.id === 'store' && onStore) ? '<span class="soon">Soon</span>' : ''}`, 'popitem'), () => {
        sfx.select(); shut();
        if (m.id === 'store' && onStore) return onStore();
        if (m.soon) return comingSoon(m);
        if (m.id === 'settings') settings(onRecalibrate);
      });
      card.appendChild(b);
    }
    /* In the Windows app: a newer version, now (picked once it checks,
       picked again it installs and restarts on it); and signing out. */
    const appInfo = typeof window !== 'undefined' && window.orlisApp;
    if (appInfo){
      card.appendChild(h('div', 'popline'));
      let next = null, busy = false;
      const up = onPick(button(`<span class="pi">\u{1F504}</span><span class="pn">Check for updates</span>`, 'popitem update'), async () => {
        if (busy) return;
        const say = (t) => { up.querySelector('.pn').textContent = t; };
        busy = true; sfx.select();
        try {
          if (next){ say('Updating…'); await appInfo.installUpdate(); }
          else {
            say('Checking…');
            const r = await appInfo.checkUpdate();
            if (r.available){ next = r.version; say(`Update to ${appInfo.nameOf ? appInfo.nameOf(next) : next}`); }
            else say('Up to date');
          }
        } catch (e){ next = null; say('Couldn\'t check - try later'); }
        busy = false;
      });
      card.appendChild(up);
    }
    if (account.signedIn){
      card.appendChild(onPick(button(`<span class="pi">\u{1F6AA}</span><span class="pn">Sign out</span>`, 'popitem'), () => { sfx.back(); account.signOut(); location.reload(); }));
    }
    /* In the Windows app, a way out. Picked once it asks; picked again
       (within a few seconds) it closes - so a hand resting there by
       accident doesn't end the evening. */
    const app = appWindow();
    if (app){
      let sure = 0;
      const ex = onPick(button(`<span class="pi">\u{1F44B}</span><span class="pn">Exit</span>`, 'popitem exit'), () => {
        if (performance.now() - sure < EXIT_SURE * 1000){ sfx.back(); app.close(); return; }
        sure = performance.now(); sfx.select();
        ex.querySelector('.pn').textContent = 'Exit? Pick again';
        setTimeout(() => { if (ex.isConnected) ex.querySelector('.pn').textContent = 'Exit'; }, EXIT_SURE * 1000);
      });
      card.appendChild(ex);
    }
    /* small print: the version, and who's signed in */
    const bits = [appInfo ? `Orlis Play ${appInfo.label ? appInfo.label() : appInfo.version}` : '', account.signedIn ? account.state.account.email : ''].filter(Boolean);
    if (bits.length) card.appendChild(h('div', 'popfoot', bits.join(' \u00B7 ').replace(/[&<>]/g, '')));
    open.appendChild(card);
    /* a click anywhere outside it closes it (and Escape) */
    open.addEventListener('pointerdown', (e) => { if (e.target === open){ sfx.back(); shut(); } });
  }
  show();
  ambience.start();

  return {
    get focus(){ return focus; },
    tick(dt){
      t += dt; tick += dt;
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
      if (!anchor && !open) for (let n = 0; n < cards.length; n++){
        const cd = cards[n];
        cd.hot = cd.card.classList.contains('hot') && n !== focus ? cd.hot + dt : 0;
        if (cd.hot >= HOVER_FOCUS){ cd.hot = 0; move(n); }
      }
      if (tick >= 1 || !clock.textContent){
        tick = 0;
        clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        /* (off here: it comes on when a game starts) */
        const ok = !pose.mouse.active;
        cam.className = 'camdot ' + (ok ? 'ok' : 'off');
        cam.title = ok ? 'The camera comes on when a game starts' : 'No camera';
      }
      /* the banner's trailer: the picked game, playing itself */
      const it = items[focus];
      if (it.trailer === undefined) it.trailer = trailer(it.g);
      if (it.trailer && !going){
        it.trailer.step(Math.min(dt, 1 / 20), TW, TH);
      }
      if (going){
        going.t += dt;
        if (going.t >= LAUNCH){ ambience.stop(); const g = going.g; going = null; onPlay(g); }
      }
    },
    draw(c, W, H){
      /* the room: soft paper, washed with the picked game's colour */
      const dark = theme() === 'dark';
      c.fillStyle = dark ? DARK_PAPER : PAPER; c.fillRect(0, 0, W, H);
      wash(c, W * 0.15, 0, H * 0.9, dark ? '#134e4a' : '#ccfbf1', dark ? 0.45 : 0.6);
      wash(c, W * 0.9, H, H * 1.0, items[focus].accent, dark ? 0.22 : 0.18);
      /* the banner's living picture; the tiles' still ones */
      const it = items[focus];
      if (it.trailer) paint(heroPic, (c, w, hh) => cover(c, w, hh, it.trailer), t, 1);
      else paint(heroPic, it.paint, t);
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

/* The trailer plays at TV shape, TW x TH, and the banner shows the part of
   it the trailer says (anchor: how far down the middle of the view sits). */
const TW = 1440, TH = 810;
let film = null;
function cover(c, w, h, tr){
  if (!film){ film = document.createElement('canvas'); film.width = TW; film.height = TH; }
  const fc = film.getContext && film.getContext('2d'); if (!fc) return;
  fc.setTransform(1, 0, 0, 1, 0, 0);
  tr.draw(fc, TW, TH);
  const k = w / TW, sh = Math.min(TH, h / k), sy = Math.max(0, Math.min(TH - sh, TH * (tr.anchor ?? 0.5) - sh / 2));
  c.drawImage(film, 0, sy, TW, sh, 0, 0, w, h);
}

/* A picture on its own small canvas, sized to it as laid out. */
function paint(pic, fn, t, sharp = 2){
  if (!pic.getContext || !pic.getBoundingClientRect) return false;
  const w0 = pic.offsetWidth || pic.getBoundingClientRect().width, h0 = pic.offsetHeight || pic.getBoundingClientRect().height;
  if (!w0) return false;
  const k = Math.min(sharp, devicePixelRatio || 1);
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

export { settings as openSettings };

function settings(onRecalibrate){
  const s = overlay(); s.classList.add('setscreen');
  const card = h('div', 'setcard');
  const close = () => { sfx.back?.(); s.remove(); };
  const head = h('div', 'sethead');
  head.append(h('h2', '', 'Settings'), onPick(button('✕', 'setclose'), close));
  card.appendChild(head);
  /* one setting a row: its name on the left, its control on the right */
  const row = (name, ...ctl) => {
    const r = h('div', 'setrow');
    const c = h('div', 'setctl'); c.append(...ctl);
    r.append(h('span', 'setname', name), c);
    card.appendChild(r);
    return c;
  };
  const small = (label, fn, cls = '') => onPick(button(label, 'setbtn ' + cls), fn);

  /* sound */
  const sl = document.createElement('input');
  sl.type = 'range'; sl.min = 0; sl.max = 1; sl.step = 0.05; sl.value = audio.volume; sl.className = 'setslider';
  sl.addEventListener('input', () => audio.setVolume(+sl.value));
  const mute = small(audio.muted ? 'Unmute' : 'Mute', () => {
    const m = audio.toggleMute();
    mute.querySelector('.lbl').textContent = m ? 'Unmute' : 'Mute';
  });
  row('Volume', sl, mute);

  /* the screen: in the Windows app, a window or Big Picture (full screen,
     for the TV), kept for next time; in a browser, its own full screen */
  const display = typeof window !== 'undefined' && window.orlisDisplay;
  if (display){
    const seg = h('div', 'seg');
    const modes = [['window', 'Window'], ['bigpicture', 'Big Picture']];
    const mark = () => modes.forEach(([m], i) => seg.children[i].classList.toggle('chosen', display.mode === m));
    for (const [m, name] of modes){
      seg.appendChild(small(name, async () => {
        if (display.mode === m) return;
        sfx.select();
        try { await display.set(m); } catch (e) {}
        mark();
      }, 'mode'));
    }
    mark();
    row('Display', seg);
  } else row('Display', small('Full screen', () => toggleFullscreen()));

  /* light or dark (for evenings on the TV), kept for next time */
  const tseg = h('div', 'seg');
  const themes = [['light', 'Light'], ['dark', 'Dark']];
  const tmark = () => themes.forEach(([t], i) => tseg.children[i].classList.toggle('chosen', theme() === t));
  for (const [t, name] of themes) tseg.appendChild(small(name, () => { sfx.select(); setTheme(t); tmark(); }, 'mode'));
  tmark();
  row('Theme', tseg);

  /* the camera: which one (when there's a choice), and finding everyone again */
  const camCtl = row('Camera', small('Re-calibrate', () => { s.remove(); onRecalibrate(); }));
  if (pose.reason !== 'debug'){
    pose.cameras().then(list => {
      if (list.length < 2) return;
      const seg = h('div', 'seg');
      list.forEach(cam => {
        const b = small(cam.label.slice(0, 24), async () => {
          b.querySelector('.lbl').textContent = 'Switching…';
          try { await pose.use(cam.id); seg.querySelectorAll('.chosen').forEach(x => x.classList.remove('chosen')); b.classList.add('chosen'); b.querySelector('.lbl').textContent = cam.label.slice(0, 24); }
          catch (e){ b.querySelector('.lbl').textContent = 'Couldn\'t open it'; }
        }, 'mode');
        b.classList.toggle('chosen', cam.id === pose.activeId);
        seg.appendChild(b);
      });
      camCtl.prepend(seg);
    });
  }

  /* scores: cleared only on a second pick */
  let sure = 0;
  const reset = small('Reset', () => {
    if (performance.now() - sure > 4000){ sure = performance.now(); reset.querySelector('.lbl').textContent = 'Sure? Pick again'; return; }
    scores.reset(); sure = 0;
    reset.querySelector('.lbl').textContent = 'Cleared';
  }, 'danger');
  row('Scores', reset);

  s.appendChild(card);
  /* a click outside the card closes it */
  s.addEventListener('pointerdown', (e) => { if (e.target === s) close(); });
}

export function toggleFullscreen(){
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
