/* Family: the family's own page, from the corner menu - the same for every
   parent. Its name (the title - the pencil changes it), its grown-ups, its
   kids as big picture tiles (pick one to rename it, change its picture or
   remove it; + adds one), and one Invite button for another grown-up.

   Looking after the server itself - every family, who's a creator, the
   Store, backups - isn't here: that's the management page, on the server's
   own laptop (double-click the Orlis cube by the clock). */
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account, AVATARS } from './account.js';
import { topBar } from './tabs.js';
import { PAPER } from './boot.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SURE = 4000;
const MAX = 8;

export function familyPage({ nav = {}, onWho, onRecalibrate }){
  clearUI();
  const s = screen('tvhome familypage');
  const bar = topBar('family', nav, { onWho, onRecalibrate });
  s.appendChild(bar.el);
  const body = h('div', 'fbody');
  s.appendChild(body);
  let pop = null;

  /* a small card in the middle, over the page */
  function popup(...parts){
    closePop();
    pop = screen('dim fpopwrap'); pop.style.zIndex = 6;
    const card = h('div', 'fpop');
    card.append(...parts);
    pop.appendChild(card);
    pop.addEventListener('pointerdown', (e) => { if (e.target === pop){ sfx.back?.(); closePop(); } });
    return card;
  }
  function closePop(){ if (pop){ pop.remove(); pop = null; } }
  const btn = (label, fn, cls = '') => onPick(button(label, 'setbtn ' + cls), fn);
  function sure(label, ask, fn){
    let at = 0;
    const b = btn(label, () => {
      if (Date.now() - at < SURE){ at = 0; fn(); return; }
      at = Date.now(); sfx.select(); b.querySelector('.lbl').textContent = ask;
      setTimeout(() => { if (at && Date.now() - at >= SURE - 50 && b.isConnected){ at = 0; b.querySelector('.lbl').textContent = label; } }, SURE);
    }, 'danger');
    return b;
  }
  const problem = (card) => (e) => { card.querySelector('.ferr')?.remove(); card.appendChild(h('p', 'ferr', esc(e.message || 'That didn’t work.'))); };
  /* the pictures to choose from */
  function pictures(pick, onPick_){
    const grid = h('div', 'avatars');
    const mark = () => [...grid.children].forEach(b => b.classList.toggle('chosen', b.dataset.av === pick));
    for (const [id, em] of Object.entries(AVATARS)){
      const b = onPick(button(em, 'av'), () => { pick = id; mark(); onPick_(id); }); b.dataset.av = id; grid.appendChild(b);
    }
    mark();
    return grid;
  }
  const nameBox = (value = '', max = 20) => {
    const i = document.createElement('input');
    i.type = 'text'; i.maxLength = max; i.value = value; i.placeholder = 'A first name or nickname'; i.className = 'finput';
    return i;
  };

  async function draw(){
    body.innerHTML = '';
    if (!account.signedIn){ body.appendChild(h('p', 'fmsg', 'Sign in to see your family.')); return; }
    let mine, invites;
    try { [mine, invites] = await Promise.all([account.call('GET', '/api/household'), account.call('GET', '/api/invites')]); }
    catch (e){
      body.appendChild(h('p', 'fmsg', esc(e.status === 0 ? 'Can’t reach your Orlis server right now. Is it running, and is this PC on the home Wi-Fi?'
        : e.status === 404 ? 'Your Orlis server needs updating for this page - it updates itself shortly.' : e.message)));
      return;
    }
    await account.refresh();
    const profiles = account.state.profiles || [];

    /* the family's name, and a pencil to change it */
    const title = h('div', 'ftitle');
    const name = h('h1', '', esc(mine.household ? mine.household.name : 'Your family'));
    const pencil = onPick(button('✏️', 'setbtn fpencil'), () => {
      const box = nameBox(mine.household ? mine.household.name : '', 40);
      box.placeholder = 'The family’s name';
      const card = popup(h('h2', '', 'The family’s name'), box);
      const save = async () => {
        try { await account.call('PATCH', '/api/household', { name: box.value }); sfx.select(); closePop(); draw(); } catch (e){ problem(card)(e); }
      };
      box.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
      card.appendChild(h('div', 'fbtns')).append(btn('Cancel', () => { sfx.back?.(); closePop(); }), btn('Save', save, 'go'));
      box.focus(); box.select();
    });
    title.append(name, pencil);
    body.appendChild(title);

    /* the grown-ups */
    const firstOf = new Map();
    for (const p of profiles) if (!firstOf.has(p.accountId)) firstOf.set(p.accountId, p);
    const grown = h('div', 'fgrown');
    for (const a of mine.accounts){
      const p = firstOf.get(a.id);
      const me = a.id === account.state.account.id;
      grown.appendChild(h('div', 'fchip', `<span class="av">${p ? AVATARS[p.avatar] || AVATARS.cube : AVATARS.cube}</span><span><b>${esc(p ? p.name : a.email)}${me ? ' (you)' : ''}</b><small>${esc(a.email)}</small></span>`));
    }
    const waiting = invites.invites.filter(i => !i.usedAt && i.kind === 'join');
    const invite = btn('Invite a grown-up', () => inviteCard(), 'go');
    grown.appendChild(invite);
    if (waiting.length) grown.appendChild(onPick(button(`${waiting.length} invite${waiting.length === 1 ? '' : 's'} waiting`, 'setbtn flink'), () => waitingCard(waiting)));
    body.appendChild(h('h3', 'fsub', 'Grown-ups'));
    body.appendChild(grown);

    /* the kids, as tiles */
    body.appendChild(h('h3', 'fsub', 'Kids'));
    const tiles = h('div', 'whotiles ftiles');
    for (const p of profiles){
      if (firstOf.get(p.accountId) === p) continue;      /* (a grown-up's own) */
      tiles.appendChild(onPick(button(`<span class="av">${AVATARS[p.avatar] || AVATARS.cube}</span><span class="nm">${esc(p.name)}</span>`, 'who'), () => { sfx.select(); kidCard(p); }));
    }
    if (profiles.length < MAX) tiles.appendChild(onPick(button('<span class="av">+</span><span class="nm">Add a kid</span>', 'who add'), () => { sfx.select(); kidCard(null); }));
    body.appendChild(tiles);
  }

  /* a kid: new (p null), or one to change */
  function kidCard(p){
    let pick = p ? p.avatar : 'rocket';
    const box = nameBox(p ? p.name : '');
    const card = popup(h('h2', '', p ? esc(p.name) : 'Add a kid'), box, pictures(pick, (id) => { pick = id; }));
    card.appendChild(h('p', 'fnote', 'Just a name and a picture - nothing else is kept about a child.'));
    const go = async () => {
      const name = box.value.trim(); if (!name) return box.focus();
      try {
        if (p) await account.call('PATCH', `/api/profiles/${encodeURIComponent(p.id)}`, { name, avatar: pick });
        else await account.call('POST', '/api/profiles', { name, avatar: pick });
        sfx.gold?.(); closePop(); draw();
      } catch (e){ problem(card)(e); }
    };
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    const row = h('div', 'fbtns');
    if (p) row.appendChild(sure('Remove', 'Remove? Pick again', async () => {
      try { await account.call('DELETE', `/api/profiles/${encodeURIComponent(p.id)}`); closePop(); draw(); } catch (e){ problem(card)(e); }
    }));
    row.append(btn('Cancel', () => { sfx.back?.(); closePop(); }), btn(p ? 'Save' : 'Add', go, 'go'));
    card.appendChild(row);
    if (!p) box.focus();
  }

  /* an invite for another grown-up: made, and its code shown big */
  async function inviteCard(){
    const card = popup(h('h2', '', 'Invite a grown-up'), h('p', 'fnote', 'A second parent or a grandparent: they share your kids.'));
    try {
      const inv = await account.call('POST', '/api/invites', { household: 'mine' });
      sfx.select();
      card.append(h('div', 'fcode', esc(inv.code)),
        h('p', 'fnote', 'On this Wi-Fi, they set up Orlis Play, choose to join with a code, and type this. It works once.'));
    } catch (e){ problem(card)(e); }
    card.appendChild(h('div', 'fbtns')).appendChild(btn('Done', () => { closePop(); draw(); }, 'go'));
  }
  function waitingCard(list){
    const card = popup(h('h2', '', 'Invites waiting'));
    for (const i of list){
      const r = h('div', 'frow');
      r.append(h('span', 'fcode small', esc(i.code)), sure('Remove', 'Remove? Pick again', async () => {
        try { await account.call('DELETE', `/api/invites/${encodeURIComponent(i.code)}`); closePop(); draw(); } catch (e){ problem(card)(e); }
      }));
      card.appendChild(r);
    }
    card.appendChild(h('div', 'fbtns')).appendChild(btn('Done', () => { closePop(); }, 'go'));
  }

  const esc_ = (e) => { if (e.key === 'Escape' && pop){ e.preventDefault(); closePop(); } };
  addEventListener('keydown', esc_, true);
  draw();

  return {
    tick(dt){ bar.tick(dt); },
    draw(c, W, H){ c.fillStyle = PAPER; c.fillRect(0, 0, W, H); },
    leave(){ removeEventListener('keydown', esc_, true); closePop(); }
  };
}
