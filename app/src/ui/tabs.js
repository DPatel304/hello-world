/* The top bar every page shares - Home, the Store and Create, like the Apple
   TV's: the Orlis Play name (and who's playing) on the left, the three tabs
   in the middle, and the clock and the corner menu on the right.

   topBar(page, nav, opts) gives { el, tick() }: put el on the page and call
   tick() each frame (it keeps the clock right). nav has home(), store() and
   create(); the tab for the page you're on is just a label. */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { pose } from '../tracking/pose.js';
import { mark } from './boot.js';
import { account, AVATARS } from './account.js';
import { openSettings } from './menu.js';

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
  for (const [id, name] of TABS){
    if (id === page){ tabs.appendChild(h('span', 'tvtab on', name)); continue; }
    const t = onPick(button(name, 'tvtab'), () => { if (isBusy()) return; sfx.nav(); keepBanner(top); nav[id] && nav[id](); });
    tabs.appendChild(t);
  }
  const clock = h('span', 'clock', ''), cam = h('span', 'camdot', '');
  let menuOpen = null;
  const burger = onPick(button('<span class="bars"><i></i><i></i><i></i></span>', 'burger'), () => {
    if (menuOpen || isBusy()) return;
    menuOpen = cornerMenu({ onRecalibrate, onFamily: nav.family && account.signedIn ? nav.family : null, onClosed: () => { menuOpen = null; } });
  });
  const sys = h('div', 'tvsys'); sys.append(cam, clock, burger);
  top.append(brand, tabs, sys);

  /* the highlight, one pill under the tabs, sliding from the last one */
  const at = TABS.findIndex(([id]) => id === page), was = TABS.findIndex(([id]) => id === from);
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
      /* (off here: it comes on when a game starts) */
      const ok = !pose.mouse.active;
      cam.className = 'camdot ' + (ok ? 'ok' : 'off');
      cam.title = ok ? 'The camera comes on when a game starts' : 'No camera';
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
  card.appendChild(onPick(button('<span class="pi">\u{2699}\u{FE0F}</span><span class="pn">Settings</span>', 'popitem'), () => {
    sfx.select(); shut(); openSettings(onRecalibrate);
  }));
  /* the family's page (and, for the owner, the server's) */
  if (onFamily) card.appendChild(onPick(button('<span class="pi">\u{1F3E0}</span><span class="pn">Family</span>', 'popitem'), () => {
    sfx.select(); shut(); onFamily();
  }));
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
  if (bits.length) card.appendChild(h('div', 'popfoot', bits.join(' · ').replace(/[&<>]/g, '')));
  open.appendChild(card);
  open.addEventListener('pointerdown', (e) => { if (e.target === open){ sfx.back(); shut(); } });
  return open;
}
