/* The top bar every page shares - Home, the Store and Create, like the Apple
   TV's: the Orlis Play name (and who's playing) on the left, the three tabs
   in the middle, and the clock and the corner menu on the right.

   topBar(page, nav, opts) gives { el, tick() }: put el on the page and call
   tick() each frame (it keeps the clock right). nav has home(), store() and
   create(); the tab for the page you're on is just a label. */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { mark } from './boot.js';
import { account, AVATARS } from './account.js';
import { openSettings } from './menu.js';

/* The corner menu's icons: simple line drawings, like the rest of the app's. */
const LINE = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const MENU_ICON = {
  settings: LINE('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'),
  family: LINE('<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>'),
  update: LINE('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>'),
  signout: LINE('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/>'),
  exit: LINE('<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>')
};
const item = (icon, label) => `<span class="pi">${MENU_ICON[icon]}</span><span class="pn">${label}</span>`;

export const TABS = [['home', 'Home'], ['store', 'Store'], ['create', 'Create']];

/* The tab you were on last: going to another, its highlight slides over
   and the page comes in from that side - the bar itself stays put. */
let lastTab = null;
/* The banner you're leaving, as a still picture: the new page's banner
   fades in over it, so the background goes from one to the other with no
   blank paper between. */
let behind = null;
function keepBanner(top){
  behind = null;
  const s = top.parentElement, hero = s && s.querySelector('.shero');
  if (!hero || s.classList.contains('paged')) return;
  const r = hero.getBoundingClientRect();
  if (r.bottom <= 0) return;                    /* (scrolled away) */
  const copy = hero.cloneNode(true);
  copy.querySelectorAll('.shtext, .sdots').forEach(x => x.remove());
  /* (a canvas copies without its picture: paint it in) */
  const from = hero.querySelectorAll('canvas'), to = copy.querySelectorAll('canvas');
  to.forEach((c, i) => {
    try { c.width = from[i].width; c.height = from[i].height; c.getContext('2d').drawImage(from[i], 0, 0); } catch (e){}
    c.style.opacity = getComputedStyle(from[i]).opacity;   /* (as it was: its page's styles don't come with it) */
  });
  copy.className += ' tabbehind';
  Object.assign(copy.style, { position: 'absolute', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0 });
  behind = copy;
}

export function topBar(page, nav, { onWho, onRecalibrate, isBusy = () => false } = {}){
  const top = h('div', 'tvtop');
  const from = lastTab; lastTab = page;
  const brand = h('div', 'brand', `<span class="mark">${mark()}</span><span>Orlis <i class="play">Play</i></span>`);
  /* who's playing (in the Windows app): their picture and name, and picking
     it goes back to "Who's playing?" */
  const who = account.current;
  if (who && onWho){
    brand.appendChild(onPick(button(`<span class="av">${AVATARS[who.avatar] || AVATARS.cube}</span><span class="nm">${who.name.replace(/[&<>]/g, '')}</span>`, 'whochip'), () => { sfx.select(); onWho(); }));
  }
  const tabs = h('nav', 'tvtabs');
  /* (a child playing sees Home and the Store; Create is for grown-ups) */
  const shown = TABS.filter(([id]) => id !== 'create' || !account.isKid);
  for (const [id, name] of shown){
    if (id === page){ tabs.appendChild(h('span', 'tvtab on', name)); continue; }
    const t = onPick(button(name, 'tvtab'), () => { if (isBusy()) return; sfx.nav(); keepBanner(top); nav[id] && nav[id](); });
    tabs.appendChild(t);
  }
  /* (no camera light here: the camera's off on these pages on purpose, and
     Home says so plainly if there's no camera at all) */
  const clock = h('span', 'clock', '');
  let menuOpen = null;
  const burger = onPick(button('<span class="bars"><i></i><i></i><i></i></span>', 'burger'), () => {
    if (menuOpen || isBusy()) return;
    menuOpen = cornerMenu({ onRecalibrate, onFamily: nav.family && account.signedIn ? nav.family : null, onClosed: () => { menuOpen = null; } });
  });
  const sys = h('div', 'tvsys'); sys.append(clock, burger);
  top.append(brand, tabs, sys);

  /* the highlight, one pill under the tabs, sliding from the last one */
  const at = shown.findIndex(([id]) => id === page), was = shown.findIndex(([id]) => id === from);
  if (at >= 0){
    const pill = h('i', 'tvpill', '');
    tabs.prepend(pill); tabs.classList.add('pilled');
    const place = (i) => { const el = tabs.children[i + 1]; pill.style.left = el.offsetLeft + 'px'; pill.style.width = el.offsetWidth + 'px'; };
    const sliding = was >= 0 && was !== at;
    /* (before the first picture: the page marks itself as arriving from a
       tab, and the old banner goes in underneath) */
    queueMicrotask(() => {
      const s = top.parentElement;
      if (!s || !sliding) return;
      s.classList.add('tabin', was < at ? 'fromright' : 'fromleft');
      if (behind){
        const b = behind; behind = null;
        s.prepend(b);
        setTimeout(() => b.classList.add('gone'), 450);
        setTimeout(() => b.remove(), 800);
      }
    });
    requestAnimationFrame(() => {
      if (!top.isConnected) return;
      if (sliding){ place(was); pill.getBoundingClientRect(); pill.classList.add('slide'); }
      place(at);
    });
  }

  let since = 1;
  return {
    el: top,
    get menuOpen(){ return !!menuOpen; },
    tick(dt = 0){
      since += dt;
      if (since < 1 && clock.textContent) return;
      since = 0;
      clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  };
}

/* Seconds a first pick of Exit waits for the second. */
const EXIT_SURE = 4;
/* The Windows app's own window, when the game is running inside it. */
function appWindow(){
  const w = typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.window;
  return w && w.getCurrentWindow ? w.getCurrentWindow() : null;
}

/* The corner menu: a little card under the button - Settings, Family, a newer version, signing out, and Exit. A click outside it closes it (or Escape). */
export function cornerMenu({ onRecalibrate, onFamily = null, onClosed } = {}){
  sfx.select();
  const open = screen('dim popmenu'); open.style.zIndex = 5;
  const card = h('div', 'popcard');
  const esc = (e) => { if (e.key === 'Escape'){ e.preventDefault(); sfx.back(); shut(); } };
  const shut = () => { if (!open.isConnected) return; open.remove(); removeEventListener('keydown', esc, true); onClosed && onClosed(); };
  addEventListener('keydown', esc, true);
  card.appendChild(onPick(button(item('settings', 'Settings'), 'popitem'), () => {
    sfx.select(); shut(); openSettings(onRecalibrate);
  }));
  /* the family's page (and, for the owner, the server's) */
  if (onFamily) card.appendChild(onPick(button(item('family', 'Family'), 'popitem'), () => {
    sfx.select(); shut(); onFamily();
  }));
  /* In the Windows app: a newer version, now (picked once it checks,
     picked again it installs and restarts on it); and signing out. */
  const appInfo = typeof window !== 'undefined' && window.orlisApp;
  if (appInfo){
    card.appendChild(h('div', 'popline'));
    let next = null, busy = false;
    const up = onPick(button(item('update', 'Check for updates'), 'popitem update'), async () => {
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
    card.appendChild(onPick(button(item('signout', 'Sign out'), 'popitem'), () => { sfx.back(); account.signOut(); location.reload(); }));
  }
  /* In the Windows app, a way out. Picked once it asks; picked again
     (within a few seconds) it closes - so a hand resting there by
     accident doesn't end the evening. */
  const app = appWindow();
  if (app){
    let sure = 0;
    const ex = onPick(button(item('exit', 'Exit'), 'popitem exit'), () => {
      if (performance.now() - sure < EXIT_SURE * 1000){ sfx.back(); app.close(); return; }
      sure = performance.now(); sfx.select();
      ex.querySelector('.pn').textContent = 'Exit? Pick again';
      setTimeout(() => { if (ex.isConnected) ex.querySelector('.pn').textContent = 'Exit'; }, EXIT_SURE * 1000);
    });
    card.appendChild(ex);
  }
  /* small print: the version, and who's signed in */
  const bits = [appInfo ? `Orlis Play ${appInfo.label ? appInfo.label() : appInfo.version}` : '', account.signedIn ? account.state.account.email : ''].filter(Boolean);
  if (bits.length) card.appendChild(h('div', 'popfoot', bits.join(' · ').replace(/[&<>]/g, '')));
  open.appendChild(card);
  open.addEventListener('pointerdown', (e) => { if (e.target === open){ sfx.back(); shut(); } });
  return open;
}
