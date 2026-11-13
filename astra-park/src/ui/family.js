/* Family: the owner's page, from the corner menu - everything about the
   family's Orlis server in one place, under the same tabs as Home, the
   Store and Create:

     Your family  its name and grown-ups; inviting another
     Kids         the family's profiles, shared by its grown-ups
     The server   its name and version, whether it's up to date (owner)
     Families     every family, who's a creator; new-family invites (owner)
     Store games  what's in the Store, and taking one out
     Backups      the copies the server keeps, making one now, restoring one

   Every parent sees their own family (its name, grown-ups, kids, and
   inviting another grown-up); the owner sees the server too - every
   family, who's a creator, the Store, backups. (The server checks.) Anything that can't be
   undone asks twice: a first pick asks, a second within a few seconds does it. */
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account, AVATARS } from './account.js';
import { topBar } from './tabs.js';
import { iconOf, GLYPHS } from './menu.js';
import { PAPER } from './boot.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SURE = 4000;
const KINDS = { daily: 'Daily', update: 'Before an update', manual: 'Made by you', 'before-restore': 'Before a restore' };
const UPDATE = { 'up to date': 'Up to date', ready: 'A newer version is ready (it switches at a quiet moment)', offline: 'Couldn’t check for updates just now', waiting: 'Checking for updates soon', off: 'Updates itself in the Windows exe' };
const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
const size = (n) => n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export function familyPage({ nav = {}, onWho, onRecalibrate }){
  clearUI();
  const s = screen('tvhome familypage');
  const bar = topBar('family', nav, { onWho, onRecalibrate });
  s.appendChild(bar.el);
  const scroll = h('div', 'fscroll');
  s.appendChild(scroll);
  scroll.addEventListener('scroll', () => s.classList.toggle('scrolled', scroll.scrollTop > 20), { passive: true });

  const small = (label, fn, cls = '') => onPick(button(label, 'setbtn ' + cls), fn);
  /* a button that asks first */
  function sure(label, ask, fn, cls = 'danger'){
    let at = 0;
    const b = small(label, async () => {
      if (Date.now() - at < SURE){ at = 0; await fn(b); return; }
      at = Date.now(); sfx.select();
      b.querySelector('.lbl').textContent = ask;
      setTimeout(() => { if (b.isConnected && at && Date.now() - at >= SURE - 50){ at = 0; b.querySelector('.lbl').textContent = label; } }, SURE);
    }, cls);
    return b;
  }
  const card = (title, sub = '') => {
    const c = h('section', 'fcard');
    c.appendChild(h('h2', '', `${esc(title)}${sub ? ` <span>${esc(sub)}</span>` : ''}`));
    return c;
  };
  const row = (left, ...right) => {
    const r = h('div', 'frow');
    const l = h('div', 'fleft'); if (typeof left === 'string') l.innerHTML = left; else l.append(left);
    const c = h('div', 'setctl'); c.append(...right);
    r.append(l, c);
    return r;
  };
  const note = (c, t, cls = 'fnote') => { const p = h('p', cls, esc(t)); c.appendChild(p); return p; };
  const failed = (c) => (e) => note(c, e.message || 'That didn’t work.', 'ferr');

  /* invites: one shown with its code, and a way to take it back */
  function inviteRow(i, c){
    return row(`<code>${esc(i.code)}</code><small>${i.kind === 'new' ? 'For a new family' : 'To join your family'}${i.role === 'creator' ? ' \u00B7 as a creator' : ''} \u00B7 made ${esc(when(i.createdAt))}</small>`,
      sure('Remove', 'Remove? Pick again', async () => { try { await account.call('DELETE', `/api/invites/${encodeURIComponent(i.code)}`); draw(); } catch (e){ failed(c)(e); } }, 'quiet'));
  }

  async function draw(){
    scroll.innerHTML = '';
    const isOwner = account.role === 'owner';
    const head = h('div', 'fhead', `<h1>Family</h1><p>${isOwner ? 'Your family, and everything on your Orlis server: the families, the Store and backups.' : 'Your family on Orlis Play: its grown-ups and kids.'}</p>`);
    scroll.appendChild(head);
    if (!account.signedIn){ note(scroll, 'Sign in to see your family.', 'fmsg'); return; }
    let mine, invites, server, families, games;
    try {
      [mine, invites] = await Promise.all([account.call('GET', '/api/household'), account.call('GET', '/api/invites')]);
      if (isOwner) [server, families, games] = await Promise.all([account.call('GET', '/api/server'), account.call('GET', '/api/households'), account.call('GET', '/api/store')]);
    } catch (e){
      note(scroll, e.status === 0 ? 'Can\u2019t reach your Orlis server right now. Is it running (the Orlis cube by the clock on its laptop), and is this PC on the home Wi-Fi?'
        : e.status === 404 ? 'Your Orlis server is an older version without this page. It updates itself; or download the newest Orlis-Server.exe.' : e.message, 'fmsg');
      return;
    }
    await account.refresh();
    const grid = h('div', 'fgrid');
    scroll.appendChild(grid);
    const open = invites.invites.filter(i => !i.usedAt);

    /* ---------- your family ---------- */
    const yc = card('Your family');
    const nameIn = document.createElement('input');
    nameIn.type = 'text'; nameIn.maxLength = 40; nameIn.value = mine.household ? mine.household.name : ''; nameIn.className = 'finput';
    const save = small('Rename', async () => {
      try { await account.call('PATCH', '/api/household', { name: nameIn.value }); sfx.select(); save.querySelector('.lbl').textContent = 'Saved'; await account.refresh(); }
      catch (e){ failed(yc)(e); }
    });
    nameIn.addEventListener('input', () => { save.querySelector('.lbl').textContent = 'Rename'; });
    yc.appendChild(row(nameIn, save));
    for (const a of mine.accounts){
      const me = a.id === account.state.account.id;
      yc.appendChild(row(`<b>${esc(a.email)}${me ? ' (you)' : ''}</b><small>A grown-up in the family</small>`, h('span', 'frole', a.role === 'owner' ? 'Owner' : a.role === 'creator' ? 'Creator' : 'Player')));
    }
    for (const i of open.filter(i => i.kind === 'join' && (!i.householdId || i.householdId === (mine.household && mine.household.id)))) yc.appendChild(inviteRow(i, yc));
    yc.appendChild(row('<span>Invite another grown-up</span><small>A second parent or a grandparent, say: they share your kids</small>',
      small('Make an invite', async () => {
        sfx.select();
        try { await account.call('POST', '/api/invites', { household: 'mine' }); draw(); } catch (e){ failed(yc)(e); }
      }, 'go')));
    grid.appendChild(yc);

    /* ---------- kids ---------- */
    const kc = card('Kids', 'Shared by the family\u2019s grown-ups');
    const firstOf = new Map();
    for (const p of account.state.profiles || []) if (!firstOf.has(p.accountId)) firstOf.set(p.accountId, p.id);
    for (const p of account.state.profiles || []){
      const grown = firstOf.get(p.accountId) === p.id;
      const isMe = grown && p.accountId === account.state.account.id;
      kc.appendChild(row(`<span class="fav">${AVATARS[p.avatar] || AVATARS.cube}</span><b>${esc(p.name)}</b>${isMe ? '<small>You</small>' : grown ? '<small>A grown-up</small>' : ''}`,
        ...(grown ? [] : [sure('Remove', 'Remove? Pick again', async () => {
          try { await account.call('DELETE', `/api/profiles/${encodeURIComponent(p.id)}`); await account.refresh(); draw(); } catch (e){ failed(kc)(e); }
        })])));
    }
    const kidIn = document.createElement('input');
    kidIn.type = 'text'; kidIn.maxLength = 20; kidIn.placeholder = 'A first name or nickname'; kidIn.className = 'finput';
    const pics = Object.keys(AVATARS).filter(k => k !== 'cube');
    let pick = pics[Math.floor(Math.random() * pics.length)];
    const av = small(AVATARS[pick], () => { pick = pics[(pics.indexOf(pick) + 1) % pics.length]; av.querySelector('.lbl').textContent = AVATARS[pick]; }, 'avbtn');
    const add = async () => {
      const name = kidIn.value.trim(); if (!name) return kidIn.focus();
      try { await account.call('POST', '/api/profiles', { name, avatar: pick }); sfx.gold?.(); await account.refresh(); draw(); }
      catch (e){ failed(kc)(e); }
    };
    kidIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    kc.appendChild(row(kidIn, av, small('Add a kid', add, 'go')));
    note(kc, 'Just a name and a picture - nothing else is kept about a child.');
    grid.appendChild(kc);

    if (!isOwner) return;

    /* ---------- the server ---------- */
    const sv = card('The server', 'Only you see this');
    const last = server.backups[0];
    sv.append(
      row(`<b>${esc(server.name)}</b><small>Orlis Server ${esc(server.version)}</small>`),
      row(`<span>${esc((UPDATE[server.update && server.update.state] || '') + (server.update && server.update.version && server.update.state === 'ready' ? ` (${server.update.version})` : ''))}</span>`),
      row(`<span>Last backup</span><small>${last ? esc(when(last.at)) : 'None yet - one is made each day'}</small>`)
    );
    if (server.restoring) note(sv, 'A restore is waiting: it happens as the server next starts.', 'fwarn');
    if (server.restored) note(sv, 'The server was restored from a backup when it last started.', 'fnote');
    grid.appendChild(sv);

    /* ---------- every family ---------- */
    const fc = card('Families', 'Everyone on this server');
    for (const hh of families.households){
      const ours = mine.household && hh.id === mine.household.id;
      fc.appendChild(h('div', 'ffam', `<b>${esc(hh.name)}${ours ? ' (yours)' : ''}</b><small>${hh.profiles} profile${hh.profiles === 1 ? '' : 's'}</small>`));
      for (const a of hh.accounts){
        const ctl = [];
        if (a.role === 'owner') ctl.push(h('span', 'frole', 'Owner'));
        else {
          const seg = h('div', 'seg');
          const mark = () => [...seg.children].forEach((b, i) => b.classList.toggle('chosen', ['player', 'creator'][i] === a.role));
          for (const [r, label] of [['player', 'Player'], ['creator', 'Creator']]){
            seg.appendChild(small(label, async () => {
              sfx.select();
              try { await account.call('POST', `/api/accounts/${encodeURIComponent(a.id)}/role`, { role: r }); a.role = r; mark(); }
              catch (e){ failed(fc)(e); }
            }, 'mode'));
          }
          mark(); ctl.push(seg);
        }
        fc.appendChild(row(`<span>${esc(a.email)}</span>`, ...ctl));
      }
    }
    note(fc, 'Creators can make games for the Store with Create (coming soon), which you approve before anyone sees them. Players play.');
    for (const i of open.filter(i => i.kind === 'new')) fc.appendChild(inviteRow(i, fc));
    fc.appendChild(row('<span>Invite a new family</span><small>A friend\u2019s family: their own grown-ups and kids, kept apart from yours</small>',
      small('Make an invite', async () => {
        sfx.select();
        try { await account.call('POST', '/api/invites', { household: 'new' }); draw(); } catch (e){ failed(fc)(e); }
      }, 'go')));
    grid.appendChild(fc);

    /* ---------- the Store's games ---------- */
    const gc = card('Store games', 'What the family can download');
    if (!games.games.length) note(gc, 'Nothing in the Store. Put a game’s .orlis file in the server’s "games" folder to add one.');
    for (const g of games.games){
      const ic = iconOf({ id: g.id, accent: (g.icon && g.icon.cols && g.icon.cols[0]) || '#6d5efc', store: { icon: g.icon || { cols: [] } } });
      const pic = h('span', 'sicon fic', `<svg viewBox="0 0 100 100" aria-hidden="true">${ic.svg || GLYPHS[ic.glyph] || GLYPHS.balloon}</svg>`);
      pic.style.setProperty('--c1', ic.cols[0]); pic.style.setProperty('--c2', ic.cols[1] || ic.cols[0]);
      const left = h('div', 'fgame'); left.append(pic, h('div', '', `<b>${esc(g.name)}</b><small>Version ${esc(g.version)}${g.by ? ` · ${esc(g.by)}` : ''} · ${size(g.bytes)}</small>`));
      gc.appendChild(row(left, sure('Take out', 'Take it out? Pick again', async () => {
        try { await account.call('DELETE', `/api/store/${encodeURIComponent(g.id)}`); draw(); } catch (e){ failed(gc)(e); }
      })));
    }
    note(gc, 'Taking a game out of the Store leaves it on any PC that already downloaded it.');
    grid.appendChild(gc);

    /* ---------- backups ---------- */
    const bc = card('Backups', 'Accounts, kids’ profiles and the Store’s games');
    const now = small('Back up now', async () => {
      sfx.select(); now.querySelector('.lbl').textContent = 'Backing up…';
      try { await account.call('POST', '/api/backups'); sfx.gold?.(); draw(); } catch (e){ failed(bc)(e); }
    }, 'go');
    bc.appendChild(row('<span>One is made every day, and before each update</span>', now));
    for (const b of server.backups.slice(0, 12)){
      const what = [b.accounts != null ? `${b.accounts} account${b.accounts === 1 ? '' : 's'}` : '', b.profiles != null ? `${b.profiles} profile${b.profiles === 1 ? '' : 's'}` : '', `${b.games} game${b.games === 1 ? '' : 's'}`, size(b.bytes)].filter(Boolean).join(' · ');
      bc.appendChild(row(`<b>${esc(when(b.at))}</b><small>${esc(KINDS[b.reason] || b.reason)} · ${esc(what)}</small>`,
        sure('Restore', 'Restore it? Pick again', async (btn) => {
          try {
            const r = await account.call('POST', `/api/backups/${encodeURIComponent(b.id)}/restore`);
            btn.querySelector('.lbl').textContent = r.restarting ? 'Restoring…' : 'Restores at next start';
            note(bc, r.restarting ? 'Restoring: the server restarts in a moment, then this page shows it as it was. (What it had a moment ago is kept as a backup too.)'
              : 'This restore happens the next time the server starts.', 'fwarn');
            if (r.restarting) setTimeout(draw, 6000);
          } catch (e){ failed(bc)(e); }
        }, 'quiet')));
    }
    note(bc, 'Each PC keeps its own downloaded games, scores and settings - those aren’t in these backups.');
    grid.appendChild(bc);
  }
  draw();

  return {
    tick(dt){ bar.tick(dt); },
    draw(c, W, H){ c.fillStyle = PAPER; c.fillRect(0, 0, W, H); }
  };
}
