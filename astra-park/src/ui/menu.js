import { GAMES } from '../games/index.js';
import { scores } from '../games/common.js';
import { button, onPick, cursor } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { audio, sfx, ambience } from '../audio/sound.js';
import { pose, MAX_PLAYERS } from '../tracking/pose.js';
import { PlayerBar } from './playerbar.js';
import { poster } from './posters.js';
import { MARK, PAPER } from './boot.js';
import { account, AVATARS } from './account.js';
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
const iconOf = (g) => ICONS[g.id] || { cols: [g.accent, g.accent], glyph: 'balloon' };

/* Games kept off the home screen for now (still there, just not shown). */
export const HIDDEN = new Set(['uncle-bs-boat', 'dance-party', 'castle-defense']);
/* What's in the corner menu. */
const MENU = [
  { id: 'settings', name: 'Settings', icon: '\u{2699}\u{FE0F}' },
  { id: 'store', name: 'Store', icon: '\u{1F6CD}\u{FE0F}', soon: true },
  { id: 'make', name: 'Create', icon: '\u{1F58C}\u{FE0F}', soon: true }
];
/* Seconds a first pick of Exit waits for the second. */
const EXIT_SURE = 4;
/* The Windows app's own window, when the game is running inside it. */
function appWindow(){
  const w = typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.window;
  return w && w.getCurrentWindow ? w.getCurrentWindow() : null;
}
/* What was picked last visit. */
let lastFocus = 0;
const HOVER_FOCUS = 0.05;      /* seconds of a hand on a tile to pick it (the cursor's already sticky) */
const LAUNCH = 0.5;            /* seconds of going in */
const POINT_AGAIN = 0.04;      /* how far (of the screen) a hand moves to take over from the remote */
const FLY = 0.7, FLY_STAGGER = 0.05;   /* arriving: each tile's flight, one after another */

export function menu({ onPlay, onRecalibrate, onWho, arrive = false }){
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
  const players = h('div', 'tvplayers');
  const clock = h('span', 'clock', ''), cam = h('span', 'camdot', '');
  const burger = onPick(button('<span class="bars"><i></i><i></i><i></i></span>', 'burger'), () => openMenu());
  const sys = h('div', 'tvsys'); sys.append(players, cam, clock, burger);
  top.append(brand, sys);
  s.appendChild(top);
  if (pose.mouse.active && pose.reason !== 'debug') s.appendChild(h('div', 'warnstrip', '⚠ No camera — the mouse is playing'));

  const bar = new PlayerBar();
  const items = [];
  for (const g of GAMES) if (!HIDDEN.has(g.id)) items.push({ kind: 'game', g, shelf: 'games', accent: iconOf(g).cols[0], icon: iconOf(g), name: g.name, blurb: BLURB[g.id] || '', paint: poster(g), trailer: undefined });

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
    const pic = h('div', 'icon', `<svg viewBox="0 0 100 100" aria-hidden="true">${GLYPHS[it.icon.glyph]}</svg>`);
    pic.style.setProperty('--c1', it.icon.cols[0]); pic.style.setProperty('--c2', it.icon.cols[1]);
    card.insertBefore(pic, card.firstChild);
    card.querySelector('.lbl').textContent = it.name;
    onPick(card, () => choose(n));
    card.addEventListener('remotefocus', () => move(n));
    rows[it.rowAt].row.appendChild(card);
    return { card, pic, paint: it.paint, hot: 0, it, still: false };
  });
  s.appendChild(h('div', 'buildstamp', typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'));

  let scrollY = 0;
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
    focus = to; lastFocus = to; sfx.nav(); ambience.lift(); show();
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
    const shut = () => { if (!open) return; open.remove(); open = null; };
    for (const m of MENU){
      const b = onPick(button(`<span class="pi">${m.icon}</span><span class="pn">${m.name}</span>${m.soon ? '<span class="soon">Soon</span>' : ''}`, 'popitem'), () => {
        if (m.soon){ sfx.boing(0.7); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
        sfx.select(); shut();
        if (m.id === 'settings') settings(onRecalibrate);
      });
      card.appendChild(b);
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
    card.appendChild(onPick(button('Close', 'popitem close'), () => { sfx.back(); shut(); }));
    open.appendChild(card);
    /* a tap anywhere else closes it too */
    open.addEventListener('pointerdown', (e) => { if (e.target === open){ sfx.back(); shut(); } });
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
      if (!anchor && !open) for (let n = 0; n < cards.length; n++){
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
      c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
      wash(c, W * 0.15, 0, H * 0.9, '#ccfbf1', 0.6);
      wash(c, W * 0.9, H, H * 1.0, items[focus].accent, 0.18);
      /* the banner's living picture; the tiles' still ones */
      const it = items[focus];
      if (it.trailer) paint(heroPic, (c, w, hh) => cover(c, w, hh, it.trailer), t, 1);
      else paint(heroPic, it.paint, t);
      const r = players.getBoundingClientRect();
      if (r.width) bar.draw(c, r.left + r.width / 2, r.top + r.height / 2, r.height * 0.42, 'rgba(40,44,70,.5)');
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

  /* In the Windows app: a window, or Big Picture (full screen, for the
     TV). Kept for next time. In a browser, the browser's own full screen. */
  const display = typeof window !== 'undefined' && window.orlisDisplay;
  if (display){
    s.appendChild(h('p', 'lede', 'Display'));
    const pick = h('div', 'row');
    const modes = [['window', 'Window'], ['bigpicture', 'Big Picture']];
    const mark = () => modes.forEach(([m], i) => pick.children[i].classList.toggle('chosen', display.mode === m));
    for (const [m, name] of modes){
      pick.appendChild(onPick(button(name, 'mode'), async () => {
        if (display.mode === m) return;
        sfx.select();
        try { await display.set(m); } catch (e) {}
        mark();
      }));
    }
    mark();
    s.appendChild(pick);
  }

  /* In the Windows app: the account - who's signed in, signing out, and
     for the owner, invites for family and friends to join. */
  if (account.signedIn){
    const a = account.state.account, srv = account.state.server;
    s.appendChild(h('p', 'lede', `Signed in as ${a.email.replace(/[&<>]/g, '')}${a.role === 'player' ? '' : ` (${a.role})`} on "${(srv?.name || '').replace(/[&<>]/g, '')}"`));
    const arow = h('div', 'row');
    const shown = h('p', 'lede invitecode', '');
    if (a.role === 'owner'){
      for (const [role, label] of [['player', 'Invite a player'], ['creator', 'Invite a creator']]){
        arow.appendChild(onPick(button(label), async () => {
          sfx.select();
          try { const r = await account.call('POST', '/api/invites', { role }); shown.textContent = `Invite code: ${r.code}  (${role}, works once)`; }
          catch (e){ shown.textContent = e.message; }
        }));
      }
    }
    arow.appendChild(onPick(button('Sign out'), () => { account.signOut(); location.reload(); }));
    s.append(arow, shown);
  }

  /* In the Windows app: which version this is, and a way to get a newer
     one now rather than at the next start. */
  const appInfo = typeof window !== 'undefined' && window.orlisApp;
  if (appInfo){
    s.appendChild(h('p', 'lede', `Version ${appInfo.version}`));
    let next = null, busy = false;
    const up = onPick(button('Check for updates', 'update'), async () => {
      if (busy) return;
      const say = (t) => { up.querySelector('.lbl').textContent = t; };
      busy = true; sfx.select();
      try {
        if (next){
          say(`Updating to ${next}…`);
          await appInfo.installUpdate();          /* the app restarts on the new one */
        } else {
          say('Checking…');
          const r = await appInfo.checkUpdate();
          if (r.available){ next = r.version; say(`Update to ${next}`); }
          else say(`Up to date`);
        }
      } catch (e){
        next = null;
        say(`Couldn't check - try again later`);
      }
      busy = false;
    });
    const urow = h('div', 'row'); urow.appendChild(up);
    s.appendChild(urow);
  }

  const row2 = h('div', 'row');
  row2.append(
    onPick(button('Re-calibrate'), () => { s.remove(); onRecalibrate(); }),
    ...(display ? [] : [onPick(button('Fullscreen'), () => toggleFullscreen())]),
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
