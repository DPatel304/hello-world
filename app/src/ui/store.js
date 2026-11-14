/* The Store: the games on the family's Orlis server, as a page of its own,
   like the Apple TV's App Store. At the top, a big banner that turns through
   the featured games - each one playing itself; below it, rows of games
   ("New for your family", "Great for little kids"...), scrolled down
   through. Picking a game opens its page: the art, one clear button
   (Get, Update or Play), what you'll do, and the facts.

   Download a game and it's in the Library - on the home screen, and
   playable with no server in reach. Every game in the Store is one the
   family's owner put there, and all of them are for kids.

   storePage({ nav, onPlay, onChange, onWho, onRecalibrate }) is a scene:
   tick(dt) and draw(c, W, H). nav is the tabs'; onChange() says the
   Library changed (the home screen needs its tiles again); onPlay(game)
   plays one straight away. */
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account } from './account.js';
import { library } from './library.js';
import { looks, cover, paint } from './menu.js';
import { trailer } from './trailer.js';
import { topBar } from './tabs.js';
import { byId } from '../games/index.js';
import { PAPER } from './boot.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kb = (n) => n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
export const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

const FEATURED = 5;          /* games the banner turns through */
const TURN = 9;              /* seconds on each */
const FEW = 4;               /* fewer games than this: the banner and one row */
/* The Store as it was last seen, by whoever's signed in. */
let seen = null, seenBy = null;

/* Words for a game's details. */
const players = (g) => { const [lo, hi] = g.players || [1, 4]; return lo === hi ? `${hi} player${hi > 1 ? 's' : ''}` : `${lo}–${hi} players`; };
const USES = { hands: 'Hands & arms', body: 'Full body' };
const KIND = (g) => [(g.tags || [])[0], USES[g.uses]].filter(Boolean).join(' · ') || players(g);
const ages = (g) => g.ages ? `Ages ${g.ages}+` : '';
const added = (g) => Date.parse(g.added || '') || 0;

/* The rows, top to bottom; a row with nothing in it isn't shown. */
export const ROWS = [
  { name: 'New for your family', sub: 'From your Orlis server', pick: (gs) => [...gs].sort((a, b) => added(b) - added(a)).slice(0, 12) },
  { name: 'Great for little kids', pick: (gs) => gs.filter(g => g.ages && g.ages <= 5) },
  { name: 'Get moving', sub: 'Full-body games', pick: (gs) => gs.filter(g => g.uses === 'body') },
  { name: 'Play together', sub: 'Best with three or four', pick: (gs) => gs.filter(g => (g.tags || []).includes('Together')) },
  { name: 'Made by family & friends', sub: 'From Create', pick: (gs) => gs.filter(g => g.by && g.by !== 'Orlis Play') }
];
/* What the page shows for a list of games: the featured ones, and rows. */
export function layout(games){
  const featured = [...games].sort((a, b) => added(b) - added(a)).slice(0, FEATURED);
  if (games.length < FEW) return { featured, rows: [{ name: 'All games', pick: () => [...games].sort((a, b) => a.name.localeCompare(b.name)), list: [...games].sort((a, b) => a.name.localeCompare(b.name)) }] };
  return { featured, rows: ROWS.map(r => ({ ...r, list: r.pick(games) })).filter(r => r.list.length) };
}

/* The moves a game's page can picture. */
const FIG = (body) => `<svg viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const MOVE_PICS = {
  reach: FIG('<circle cx="40" cy="20" r="7" fill="#fff"/><path d="M40 30v24M40 54l-10 18M40 54l10 18M40 34l-14-22M40 34l14-22"/>'),
  jump: FIG('<circle cx="40" cy="14" r="7" fill="#fff"/><path d="M40 24v22M40 46l-14 10M40 46l14 10M40 30l-16 6M40 30l16 6M24 74h32"/>'),
  duck: FIG('<circle cx="40" cy="36" r="7" fill="#fff"/><path d="M40 46v12M40 58l-12 14M40 58l12 14M40 48l-14 4M40 48l14 4M16 22h48"/>'),
  squat: FIG('<circle cx="40" cy="26" r="7" fill="#fff"/><path d="M40 36v16M40 52l-14 4-2 16M40 52l14 4 2 16M40 40h-18M40 40h18"/>'),
  wave: FIG('<circle cx="34" cy="20" r="7" fill="#fff"/><path d="M34 30v24M34 54l-10 18M34 54l10 18M34 36l-14 10M34 34l18-16M58 12l6-4M60 22l8 0"/>'),
  run: FIG('<circle cx="46" cy="14" r="7" fill="#fff"/><path d="M44 24l-6 22M38 46l-14 8M38 46l10 12 4 14M42 30l-14 4M42 30l14 8"/>'),
  dance: FIG('<circle cx="40" cy="16" r="7" fill="#fff"/><path d="M40 26l-2 24M38 50l-12 20M38 50l14 18M40 32l-16-12M40 32l18 6"/>'),
  together: '<svg viewBox="0 0 80 80" aria-hidden="true"><g fill="#fff"><circle cx="26" cy="22" r="8"/><circle cx="54" cy="22" r="8"/><rect x="18" y="34" width="16" height="30" rx="7"/><rect x="46" y="34" width="16" height="30" rx="7"/></g></svg>'
};

export function storePage({ nav = {}, onPlay, onChange = () => {}, onWho, onRecalibrate }){
  clearUI();
  const s = screen('tvhome storepage');
  const bar = topBar('store', nav, { onWho, onRecalibrate });
  s.appendChild(bar.el);

  /* everything under the top bar scrolls: the banner, then the rows */
  const scroll = h('div', 'sscroll');
  s.appendChild(scroll);
  scroll.addEventListener('scroll', () => s.classList.toggle('scrolled', scroll.scrollTop > 40), { passive: true });
  /* (a message instead of the banner: the top bar's on paper then) */
  const say = (t) => { s.classList.remove('onhero'); scroll.innerHTML = ''; scroll.appendChild(h('div', 'smsg', `<p>${esc(t)}</p>`)); };

  /* Each game's trailer, once asked for: installed games play their own;
     the others are fetched, checked and played in the sandbox, not kept. */
  const keyOf = (g) => g.submission ? `waiting:${g.submission}` : g.id;
  const films = new Map();      /* id -> { tr, failed } */
  function film(g){
    if (films.has(keyOf(g))) return films.get(keyOf(g));
    const f = { tr: null, failed: false };
    films.set(keyOf(g), f);
    library.preview(g).then(game => { f.tr = trailer(game); if (!f.tr) f.failed = true; }, () => { f.failed = true; });
    return f;
  }
  const forget = (id) => { const f = films.get(id); if (f && f.tr && f.tr.close) f.tr.close(); films.delete(id); };
  const closeFilms = () => { for (const f of films.values()) if (f.tr && f.tr.close) f.tr.close(); films.clear(); };

  let games = [], waiting = [], lay = null, feat = 0, featT = 0, featHold = false, page = null, changed = false, t = 0;
  const heroBits = {};

  /* A game's one button: Get, Update or Play - and what's next for it. */
  function action(g, where, { big = false } = {}){
    const box = h('div', big ? 'sact big' : 'sact');
    const bar = h('div', 'sbar', '<i></i>');
    const busy = (k) => { bar.firstChild.style.width = `${Math.round(k * 100)}%`; };
    const btn = (label, cls, fn) => onPick(button(label, 'sbtn ' + cls), fn);
    const get = (label) => btn(label, 'get', async () => {
      sfx.select();
      box.innerHTML = ''; box.appendChild(bar); busy(0.02);
      try { await library.install(g, busy); changed = true; sfx.gold?.(); }
      catch (e){ box.innerHTML = ''; box.appendChild(h('div', 'serr', esc(e.message))); box.appendChild(get('Try again')); return; }
      forget(g.id);
      refresh(); redraw();
    });
    function refresh(){
      box.innerHTML = '';
      /* a game waiting for the owner's OK: tried here, not kept */
      if (g.submission){
        box.appendChild(btn('<span class="tri"></span>Try it', 'play', async () => {
          sfx.select();
          /* (played long enough, it can be approved: main.js tells the server) */
          try { const game = await library.preview(g); game.trial = g.submission; leave(); onPlay(game); }
          catch (e){ box.appendChild(h('div', 'serr', esc(e.message))); }
        }));
        return;
      }
      const now = library.installed.get(g.id);
      if (!now) box.appendChild(get(big ? `Get · ${kb(g.bytes)}` : 'Get'));
      else if (newer(g.version, now)) box.appendChild(get(`Update to ${esc(g.version)}`));
      else box.appendChild(btn('<span class="tri"></span>Play', 'play', () => {
        const game = byId(g.id); if (!game) return;
        sfx.select(); leave(); onPlay(game);
      }));
      if (big && now){
        box.appendChild(btn('Remove', 'ghost', async () => {
          sfx.back?.(); await library.remove(g.id); changed = true; forget(g.id); refresh(); redraw();
        }));
      }
    }
    refresh();
    return box;
  }
  /* (a badge on a card: already on the home screen, or newer here) */
  function badge(g){
    if (g.submission) return '<span class="sbadge wait">Waiting for your OK</span>';
    const now = library.installed.get(g.id);
    if (!now) return '';
    return newer(g.version, now) ? '<span class="sbadge upd">Update</span>' : '<span class="sbadge got">✓ On home</span>';
  }

  /* ---------- the page ---------- */
  function build(){
    scroll.innerHTML = '';
    lay = layout(games);
    /* (nothing in the Store yet, but something waiting: that, in the banner) */
    if (!lay.featured.length && waiting.length){ lay.featured = waiting.slice(0, 1); if (lay.rows.length === 1 && !lay.rows[0].list.length) lay.rows = []; }
    if (!lay.featured.length){ say('Nothing in the Store yet. Games the family adds to the Orlis server show up here.'); return; }
    /* the banner */
    const hero = h('section', 'shero');
    const art = h('div', 'sheroart');
    const pic = document.createElement('canvas'); pic.className = 'sheropic';
    const text = h('div', 'shtext');
    const dots = h('div', 'sdots');
    hero.append(art, pic, h('div', 'shshade'), text, dots);
    hero.addEventListener('mouseenter', () => { featHold = true; });
    hero.addEventListener('mouseleave', () => { featHold = false; });
    lay.featured.forEach((g, i) => {
      const d = onPick(button('', 'sdot'), () => { feat = i; featT = 0; showFeat(); });
      dots.appendChild(d);
    });
    Object.assign(heroBits, { hero, art, pic, text, dots });
    scroll.appendChild(hero);
    s.classList.add('onhero');
    showFeat();

    /* the rows */
    const rows = waiting.length ? [{ name: 'Waiting for your OK', sub: 'Only you see these \u00B7 play each one, then approve it on the management page', list: waiting }, ...lay.rows] : lay.rows;
    for (const r of rows){
      const sec = h('section', 'srow');
      sec.appendChild(h('h3', '', `${esc(r.name)}${r.sub ? ` <span>${esc(r.sub)}</span>` : ''}`));
      const shelf = h('div', 'sshelf');
      for (const g of r.list) shelf.appendChild(lockup(g));
      sec.appendChild(shelf);
      scroll.appendChild(sec);
    }
    scroll.appendChild(h('p', 'snote', 'Every game here was added by your family’s Orlis server owner, and all of them are made for kids. Games get body points from the camera, never pictures, and can’t reach the internet.'));
  }
  function redraw(){ const y = scroll.scrollTop; build(); scroll.scrollTop = y; if (page) page.refresh(); }

  function showFeat(){
    const g = lay.featured[feat], L = looks(g);
    const { art, text, dots, pic } = heroBits;
    art.replaceWith(heroBits.art = L.art('sheroart'));
    pic.style.opacity = 0;
    text.innerHTML = '';
    const chips = h('div', 'schips');
    for (const c of [players(g), USES[g.uses], ages(g), g.by].filter(Boolean)) chips.appendChild(h('span', 'schip', esc(c)));
    const btns = h('div', 'sbtns');
    btns.append(action(g, 'hero'), onPick(button('More', 'sbtn ghost'), () => { sfx.select(); openPage(g); }));
    text.append(h('div', 'skicker', feat === 0 && lay.featured.length > 1 ? 'Featured · Newest' : 'Featured'), h('h1', '', esc(g.name)), h('p', '', esc(g.blurb)), chips, btns);
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === feat));
    dots.style.display = lay.featured.length > 1 ? '' : 'none';
  }

  /* a game in a row: its art, a badge, its icon and name */
  function lockup(g){
    const L = looks(g);
    const b = button('', 'slock');
    const thumb = L.art('sthumb');
    thumb.insertAdjacentHTML('beforeend', badge(g));
    const meta = h('div', 'smeta');
    meta.append(L.icon('sicon'), h('div', 'stxt', `<div class="nm">${esc(g.name)}</div><div class="sub">${esc(KIND(g))}</div>`));
    b.insertBefore(thumb, b.firstChild);
    b.querySelector('.lbl').replaceWith(meta);
    onPick(b, () => { sfx.select(); openPage(g); });
    return b;
  }

  /* ---------- a game's own page ---------- */
  function openPage(g){
    if (page) page.close();
    const L = looks(g);
    const p = h('div', 'spage');
    const bg = L.art('spageart');
    const pic = document.createElement('canvas'); pic.className = 'spagepic';
    const left = h('div', 'spleft');
    const facts = h('div', 'sfacts');
    p.append(bg, pic, h('div', 'spshade'), left, facts);
    const back = onPick(button('← Store', 'sbtn back'), () => { sfx.back?.(); close(); });
    p.appendChild(back);
    function fill(){
      left.innerHTML = '';
      const chips = h('div', 'schips');
      for (const c of [players(g), USES[g.uses], ages(g), ...(g.tags || [])].filter(Boolean)) chips.appendChild(h('span', 'schip', esc(c)));
      left.append(L.icon('sicon big'), h('h1', '', esc(g.name)), h('div', 'sby', esc([g.by, `Version ${g.version}`].filter(Boolean).join(' · '))), chips,
        h('p', 'sdesc', esc(g.about || g.blurb)), action(g, 'page', { big: true }));
      /* (the owner's note, apart from the game's own words: what to do) */
      if (g.submission) left.appendChild(h('p', 'sowner', `Waiting for your OK. Play it for 20 seconds with Try it, then approve it on the management page.`));
      const here = library.installed.get(g.id);
      const rows = [['Made by', g.by || 'Someone in the family'], ['Players', (([lo, hi]) => lo === hi ? String(hi) : `${lo} to ${hi}`)(g.players || [1, 4])], ['You’ll use', USES[g.uses] || 'Hands & arms'],
        ['Ages', g.ages ? `${g.ages} and up` : 'All ages'], ['Size', kb(g.bytes)], ['On this PC', here ? (newer(g.version, here) ? `Version ${here} (update ready)` : 'Yes, on the home screen') : 'Not yet']];
      facts.innerHTML = rows.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('');
      p.querySelector('.smoves')?.remove();
      if ((g.howto || []).length){
        const mv = h('div', 'smoves', '<h3>What you’ll do</h3>');
        const row = h('div', 'smvrow');
        for (const m of g.howto) row.appendChild(h('div', 'smv', `${MOVE_PICS[m.move] || ''}<div class="t">${esc(m.title)}</div><div class="s">${esc(m.line)}</div>`));
        mv.appendChild(row); p.appendChild(mv);
      }
    }
    fill();
    s.appendChild(p); s.classList.add('paged');
    const f = film(g);
    const esc_ = (e) => { if (e.key === 'Escape' || e.key === 'Backspace'){ e.preventDefault(); sfx.back?.(); close(); } };
    addEventListener('keydown', esc_, true);
    function close(){ p.remove(); removeEventListener('keydown', esc_, true); if (page === api){ page = null; s.classList.remove('paged'); } }
    const api = { g, f, pic, close, refresh: fill };
    page = api;
  }

  let left = false;
  function leave(){ if (left) return; left = true; if (page) page.close(); closeFilms(); if (changed) onChange(); }

  async function load(){
    if (!account.needed){ say('The Store is in the Orlis Play app for Windows.'); return; }
    if (!account.signedIn){ say('Sign in to see the Store.'); return; }
    const by = account.state && account.state.token;
    if (by !== seenBy){ seen = null; seenBy = by; }
    /* what it showed last time, straight away (so going to the Store is as
       quick as going Home); then what's there now, if it's changed */
    if (seen){ ({ games, waiting } = seen); build(); }
    else say('Loading…');
    let was = seen && JSON.stringify(seen);
    try {
      games = (await account.call('GET', '/api/store')).games || [];
      /* the owner: games creators have sent, to try before saying OK */
      if (account.role === 'owner'){
        try {
          waiting = ((await account.call('GET', '/api/submissions?all=1')).submissions || []).filter(x => x.state === 'waiting')
            /* (as it would be in the Store - its own icon and words - with
               what to do about it) */
            .map(x => { const d = x.game || {}; return { id: x.gameId, submission: x.id, name: x.name, version: x.version, bytes: x.bytes, sha256: x.sha256, by: x.family,
              icon: d.icon || undefined, players: d.players || [1, 4], uses: d.uses || '', ages: d.ages || null, tags: d.tags || [], howto: d.howto || [],
              blurb: d.blurb || `Sent by ${x.family}`, about: d.about || d.blurb || '' }; });
        } catch { waiting = []; }
      }
    }
    catch (e){ if (!seen) say(e.status === 0 ? 'Can’t reach your Orlis server right now. Is it running, and is this PC on the home Wi-Fi?' : e.message); return; }
    seen = { games, waiting };
    if (left || JSON.stringify(seen) === was) return;
    if (was) redraw(); else build();
  }
  load();

  /* the tabs take you away: tidy up first */
  for (const k of Object.keys(nav)){ const go = nav[k]; nav[k] = () => { leave(); go(); }; }

  return {
    tick(dt){
      t += dt;
      bar.tick(dt);
      if (!lay || !lay.featured.length) return;
      /* the banner turns, unless someone's looking at it or a page is open */
      if (!featHold && !page && lay.featured.length > 1){
        featT += dt;
        if (featT >= TURN){ featT = 0; feat = (feat + 1) % lay.featured.length; showFeat(); }
      }
      /* whichever is showing plays: the page's game, or the banner's */
      const g = page ? page.g : lay.featured[feat];
      const f = film(g);
      if (f.tr) f.tr.step(Math.min(dt, 1 / 20), 1440, 810);
    },
    draw(c, W, H){
      c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
      if (!lay || !lay.featured.length) return;
      const target = page ? page.pic : heroBits.pic;
      const g = page ? page.g : lay.featured[feat];
      const f = films.get(keyOf(g));
      if (target && f && f.tr){
        if (paint(target, (cc, w, hh) => cover(cc, w, hh, f.tr), t, 1)) target.style.opacity = 1;
      }
    },
    leave
  };
}
