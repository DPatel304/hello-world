/* The Store, in the Windows app: the games on the family's Orlis server.
   Download one and it's in the Library - on the home screen, and playable
   with no server in reach. A newer version on the server shows as an
   update; a downloaded game can be removed again. */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account } from './account.js';
import { library } from './library.js';
import { iconOf, GLYPHS } from './menu.js';
import { byId } from '../games/index.js';

const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kb = (n) => n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

/* onChange: the Library changed (the home screen needs its tiles again);
   onPlay(game): play one straight away. */
export function openStore({ onChange, onPlay }){
  const s = screen('dim setscreen'); s.style.zIndex = 5;
  const card = h('div', 'setcard storecard');
  let changed = false;
  const close = () => { sfx.back?.(); s.remove(); if (changed) onChange(); };
  const head = h('div', 'sethead');
  head.append(h('h2', '', 'Store'), onPick(button('✕', 'setclose'), close));
  const body = h('div', 'storelist');
  card.append(head, body);
  s.appendChild(card);
  s.addEventListener('pointerdown', (e) => { if (e.target === s) close(); });
  const say = (t) => { body.innerHTML = ''; body.appendChild(h('p', 'storemsg', esc(t))); };

  async function list(){
    if (!account.signedIn){ say('Sign in to see the Store.'); return; }
    say('Looking in the Store…');
    let games;
    try { games = (await account.call('GET', '/api/store')).games; }
    catch (e){ say(e.status === 0 ? 'Can\'t reach your Orlis server right now. Is it running, and is this PC on the home Wi-Fi?' : e.message); return; }
    body.innerHTML = '';
    if (!games.length){ say('Nothing in the Store yet.'); return; }
    for (const g of games) body.appendChild(row(g));
  }

  function row(g){
    const r = h('div', 'storerow');
    const ic = iconOf({ id: g.id, accent: (g.icon && g.icon.cols[0]) || '#6d5efc', store: { icon: g.icon } });
    const pic = h('div', 'storeicon', `<svg viewBox="0 0 100 100" aria-hidden="true">${ic.svg || GLYPHS[ic.glyph]}</svg>`);
    pic.style.setProperty('--c1', ic.cols[0]); pic.style.setProperty('--c2', ic.cols[1]);
    const info = h('div', 'storeinfo', `<div class="sname">${esc(g.name)}</div><div class="sblurb">${esc(g.blurb)}</div><div class="smeta">${esc(`Version ${g.version} · ${kb(g.bytes)}${g.by ? ` · ${g.by}` : ''}`)}</div>`);
    const act = h('div', 'storeact');
    r.append(pic, info, act);
    const have = library.installed.get(g.id);
    const bar = h('div', 'sbar', '<i></i>');
    const busy = (k) => { bar.firstChild.style.width = `${Math.round(k * 100)}%`; };
    const get = (label) => onPick(button(label, 'setbtn sget'), async () => {
      sfx.select();
      act.innerHTML = ''; act.appendChild(bar); busy(0.02);
      try { await library.install(g, busy); changed = true; sfx.gold?.(); }
      catch (e){ act.innerHTML = ''; act.appendChild(h('div', 'serr', esc(e.message))); act.appendChild(get('Try again')); return; }
      refresh();
    });
    function refresh(){
      act.innerHTML = '';
      const now = library.installed.get(g.id);
      if (!now) return act.appendChild(get('Download'));
      if (newer(g.version, now)) return act.appendChild(get(`Update to ${g.version}`));
      act.appendChild(onPick(button('Play', 'setbtn splay'), () => { const game = byId(g.id); if (!game) return; sfx.select(); s.remove(); if (changed) onChange(); onPlay(game); }));
      act.appendChild(onPick(button('Remove', 'setbtn sremove'), async () => { sfx.back?.(); await library.remove(g.id); changed = true; refresh(); }));
    }
    refresh();
    void have;
    return r;
  }
  list();
}
