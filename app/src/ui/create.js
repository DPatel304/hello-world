/* Create: making your own games - for grown-ups the owner made creators.

   New game: a name, the idea, and what to start from (a starter game:
   Star Catch, or one of the owner's own in the Store). Orlis Play
   makes the game's folder on this PC and opens Claude Code in it, with the
   idea as the first thing to do - on the creator's own Claude account, with
   Orlis Play's rules and guardrails. Your games: each one, to open in
   Claude Code again (or see its folder).

   Sending: a game's .orlis file waits here (the outbox, on this PC) and is
   sent by itself when the family's Orlis server is in reach - on its home
   Wi-Fi - to wait for the owner's OK. Below, what's been sent and how each
   went: waiting, in the Store, or not this time (with the owner's note).

   Everyone else sees what's coming. */
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account } from './account.js';
import { outbox } from './outbox.js';
import { topBar } from './tabs.js';
import { CREATE_SOON, looks } from './menu.js';
import { making } from './making.js';
import { unpack, check, build, pack, nextVersion } from './creator-kit.js';
import { newer } from './store.js';
import { library } from './library.js';
import { PAPER } from './boot.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATE = { waiting: ['Waiting for the owner’s OK', ''], approved: ['In the Store', 'ok'], declined: ['Not this time', 'no'] };

/* Create's banner: the same banner as Home's and the Store's, with its own
   picture - a sparkle on purple and teal. */
const SPARKLE = '<path d="M50 8l9 33 33 9-33 9-9 33-9-33-33-9 33-9z" fill="#fff"/><circle cx="80" cy="20" r="6" fill="#fff"/><circle cx="20" cy="80" r="4" fill="#fff"/>';
function banner(kicker, title, line){
  const hero = h('section', 'shero');
  const art = h('div', 'sheroart', `<svg class="g" viewBox="0 0 100 100" aria-hidden="true">${SPARKLE}</svg>`);
  art.style.setProperty('--c1', '#7c3aed'); art.style.setProperty('--c2', '#06b6d4');
  const text = h('div', 'shtext');
  text.append(h('div', 'skicker', esc(kicker)), h('h1', '', esc(title)), h('p', '', esc(line)));
  hero.append(art, h('div', 'shshade'), text);
  return { hero, text };
}

/* How the last Try it went, to say so on coming back to Create. */
let lastTry = null;

export function createPage({ nav = {}, onPlay = () => {}, onWho, onRecalibrate }){
  clearUI();
  const s = screen('tvhome createpage onhero');
  const bar = topBar('create', nav, { onWho, onRecalibrate });
  s.appendChild(bar.el);
  const scroll = h('div', 'sscroll');
  s.appendChild(scroll);
  scroll.addEventListener('scroll', () => s.classList.toggle('scrolled', scroll.scrollTop > 40), { passive: true });
  const scene = { tick(dt){ bar.tick(dt); }, draw(c, W, H){ c.fillStyle = PAPER; c.fillRect(0, 0, W, H); } };
  const creator = account.signedIn && (account.role === 'creator' || account.role === 'owner');

  if (!creator){
    const m = CREATE_SOON;
    scroll.appendChild(banner('Coming soon', m.name, m.line).hero);
    const sec = h('section', 'srow');
    sec.append(h('p', 'cabout', esc(m.about)));
    if (account.signedIn) sec.append(h('p', 'snote', 'Making games is for grown-ups the server’s owner has made creators.'));
    scroll.appendChild(sec);
    return scene;
  }

  const { hero, text } = banner('Create', 'Make a game', making.available
    ? 'Make your own movement game with Claude, try it, then send it for the Store.'
    : 'Making games is in Orlis Play for Windows. Here: send a game you’ve made, for the owner to OK for the Store.');
  const btns = h('div', 'sbtns'), said_ = h('p', 'csaid', '');
  text.append(btns, said_);
  scroll.appendChild(hero);
  const body = h('div', 'cbody');
  scroll.appendChild(body);
  const sbtn = (label, fn, cls) => onPick(button(label, 'sbtn ' + cls), fn);
  const btn = (label, fn, cls = '') => onPick(button(label, 'setbtn ' + cls), fn);
  const pickFile = document.createElement('input');
  pickFile.type = 'file'; pickFile.accept = '.orlis'; pickFile.style.display = 'none';
  s.appendChild(pickFile);
  let said = '';
  let mine = [];                 /* the games being made on this PC */
  let pop = null;

  /* a small card in the middle, over the page (as on Family) */
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
  const problem = (card) => (e) => { card.querySelector('.ferr')?.remove(); card.appendChild(h('p', 'ferr', esc(e.message || 'That didn’t work.'))); };

  /* What a new game can start from: starter games only - Star Catch (it
     comes with Orlis Play), and games in the Store the owner made (the
     server marks those, and only those, as starters). Never another
     family's game. Each: a label, a line, and how to get its files. */
  async function starts(){
    const list = [{ label: 'Star Catch', line: 'Catch the falling stars', get: async () => null }];
    try {
      const store = (await account.call('GET', '/api/store')).games || [];
      for (const g of store.filter(x => x.starter === true)){
        list.push({ label: g.name, line: g.blurb || 'A starter game', get: async () => {
          const src = await library.source(g);
          const game = unpack(src.code);
          if (!game) throw new Error(`${g.name} can’t be a starting point.`);
          return { name: g.name, game, manifest: src.manifest };
        } });
      }
    } catch {}
    return list;
  }

  /* New game: a name, the idea, what to start from - then Claude Code. */
  async function newGamePop(){
    sfx.select();
    const name = Object.assign(document.createElement('input'), { className: 'finput', maxLength: 40, placeholder: 'Bird Hoops' });
    const idea = Object.assign(document.createElement('textarea'), { className: 'finput fidea', maxLength: 300, rows: 3, placeholder: 'Flap your arms like wings to fly a bird through hoops' });
    const from = h('div', 'cfrom', '<p class="fnote">Looking…</p>');
    let chosen = 0, list = [];
    const go = btn('Make it', async () => {
      if (!name.value.trim()){ name.focus(); return; }
      go.classList.add('busy');
      try {
        const start = await list[chosen].get();
        const made = await making.make({ name: name.value, idea: idea.value, from: start });
        sfx.gold?.();
        await refreshMine();
        await opened(made.folder, made.name, await making.openClaude(made.folder, { first: made.idea }), true);
      } catch (e){ go.classList.remove('busy'); problem(card)(e); }
    }, 'go');
    const card = popup(h('h2', '', 'New game'),
      h('label', 'ffield', '<span>Its name</span>'), name,
      h('label', 'ffield', '<span>The idea - what do you do, and how do you move?</span>'), idea,
      h('label', 'ffield', '<span>Start from a starter game</span>'), from,
      h('div', 'fbtns'));
    card.querySelector('.fbtns').append(btn('Cancel', () => { sfx.back?.(); closePop(); }), go);
    name.focus();
    list = await starts();
    const mark = () => [...from.children].forEach((b, i) => b.classList.toggle('chosen', i === chosen));
    from.innerHTML = '';
    list.forEach((o, i) => from.appendChild(onPick(button(`<b>${esc(o.label)}</b><small>${esc(o.line)}</small>`, 'setbtn cstart'), () => { chosen = i; mark(); })));
    mark();
  }

  /* After opening Claude Code: what's happening, or how to get it. */
  async function opened(folder, gameName, r, isNew){
    if (r && r.opened){
      popup(h('h2', '', isNew ? `${gameName} is ready` : 'Claude Code is opening'),
        h('p', '', 'Claude Code is opening in a window of its own. The first time, it asks you to sign in with your Claude account, and whether you trust this folder - say yes.'),
        h('p', 'fnote', isNew ? 'Claude starts on your idea straight away. Tell it what to change as you go.' : 'Tell Claude what you’d like to change.'),
        h('div', 'fbtns')).querySelector('.fbtns').append(btn('OK', () => { sfx.select(); closePop(); }, 'go'));
      return;
    }
    const cmd = 'irm https://claude.ai/install.ps1 | iex';
    const card = popup(h('h2', '', 'Claude Code isn’t on this PC yet'),
      h('p', '', `${isNew ? `${gameName} is made - ` : ''}to make games, Claude Code needs installing once, and it uses your own Claude account.`),
      h('p', 'fnote', '1. Open PowerShell (search for it in the Start menu).<br>2. Paste this and press Enter:'),
      h('div', 'ccmd', esc(cmd)),
      h('p', 'fnote', '3. When it’s done, close PowerShell and come back here: pick the game under Your games, then Open in Claude Code. (Claude Code’s own setup help: code.claude.com/docs/en/setup)'),
      h('div', 'fbtns'));
    const copy = btn('Copy', async () => { try { await navigator.clipboard.writeText(cmd); copy.querySelector('.lbl').textContent = 'Copied'; } catch {} });
    card.querySelector('.fbtns').append(copy, btn('OK', () => { sfx.select(); closePop(); }, 'go'));
  }

  /* What's wrong, said plainly - and written down for Claude to read. */
  function problemsPop(g, title, problems){
    making.note(g.folder, `${new Date().toLocaleString()} - Orlis Play's check found:\n${problems.map(p => '- ' + p).join('\n')}\n`).catch(() => {});
    const card = popup(h('h2', '', esc(title)), h('ul', 'cprobs', problems.map(p => `<li>${esc(p)}</li>`).join('')),
      h('p', 'fnote', 'Tell Claude: “Fix what Orlis Play’s check found” - it’s written down for Claude to read.'), h('div', 'fbtns'));
    card.querySelector('.fbtns').append(
      btn('Open in Claude Code', async () => { try { await opened(g.folder, g.manifest.name, await making.openClaude(g.folder), false); } catch (e){ problem(card)(e); } }),
      btn('OK', () => { sfx.select(); closePop(); }, 'go'));
  }

  /* Try it: the game as it is now - checked, then played full screen with
     the camera, sealed off like any Store game. Back here after, with a
     note of how it went for Claude. */
  async function tryIt(g, card){
    let now;
    try { now = await making.read(g.folder); } catch (e){ problem(card)(e); return; }
    const problems = check(now);
    if (problems.length) return problemsPop(g, `${g.manifest.name} needs a fix first`, problems);
    let game;
    try { game = await library.tryOut(build(now)); }
    catch (e){
      const why = e.message === 'the game didn\'t start' ? 'It didn’t start: there may be a mistake in game.js that stops it running.' : `It didn’t start: ${e.message}`;
      return problemsPop(g, `${g.manifest.name} didn’t start`, [why]);
    }
    const name = g.manifest.name, folder = g.folder;
    game.back = () => nav.create && nav.create();
    game.onDone = ({ secs, failed }) => {
      lastTry = { name, folder, secs, failed };
      making.note(folder, failed
        ? `${new Date().toLocaleString()} - Tried it: it stopped after ${secs} seconds with this error:\n${failed}\n`
        : `${new Date().toLocaleString()} - Tried it: played ${secs} seconds, no errors.\n`).catch(() => {});
    };
    sfx.select(); closePop(); onPlay(game);
  }

  /* Check and Send: checked, a new version number if this one's been sent
     before, packed, and into the outbox - sent now if the Orlis server's in
     reach, or by itself when it is. */
  async function sendIt(g, card){
    let now;
    try { now = await making.read(g.folder); } catch (e){ problem(card)(e); return; }
    const problems = check(now);
    if (problems.length) return problemsPop(g, `${g.manifest.name} needs a fix before it’s sent`, problems);
    let m = JSON.parse(now.manifest);
    try {
      const before = [...((await outbox.sent()) || []).filter(x => x.gameId === m.id), ...(await outbox.list()).filter(x => x.gameId === m.id)].map(x => x.version);
      const top = before.reduce((a, v) => (!a || newer(v, a) ? v : a), null);
      if (top && !newer(m.version, top)){
        const v = nextVersion(top);
        await making.setVersion(g.folder, v);
        now = await making.read(g.folder); m = JSON.parse(now.manifest);
      }
      const { bytes } = await pack(now);
      await outbox.add(bytes);
      sfx.select();
      said = `${m.name} (version ${m.version}) is ready to send.`;
      closePop();
      await send();
      refreshMine();
    } catch (e){ problem(card)(e); }
  }

  /* One of your games: try it, send it, open it in Claude Code, or see its folder. */
  function gamePop(g){
    sfx.select();
    const L = looks({ id: g.manifest.id, icon: g.manifest.icon });
    const card = popup(L.icon('sicon cpopicon'), h('h2', '', esc(g.manifest.name)), h('p', 'fnote', esc(g.manifest.blurb || '')),
      h('p', 'fnote', `Version ${esc(g.manifest.version || '0.1')} · changed ${esc(new Date(g.changed).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}`),
      h('div', 'cacts'), h('div', 'fbtns'));
    card.querySelector('.cacts').append(
      btn('<span class="tri"></span>Try it', () => tryIt(g, card), 'go cbig'),
      btn('Check and send', () => sendIt(g, card), 'cbig'));
    card.querySelector('.fbtns').append(
      btn('Show the folder', () => making.show(g.folder).catch(problem(card))),
      btn('Open in Claude Code', async () => {
        try { await opened(g.folder, g.manifest.name, await making.openClaude(g.folder), false); } catch (e){ problem(card)(e); }
      }));
  }

  /* back from Try it: how it went */
  function afterTry(){
    const t = lastTry; lastTry = null;
    if (!t) return;
    const g = mine.find(x => x.folder === t.folder) || { folder: t.folder, manifest: { name: t.name } };
    const card = popup(h('h2', '', t.failed ? `${esc(t.name)} stopped` : `How was ${esc(t.name)}?`),
      h('p', '', t.failed ? `It stopped after ${t.secs} seconds because something went wrong. It’s written down for Claude: tell it “It broke when I tried it - have a look”.` : `You played ${t.secs} seconds, with no errors. Tell Claude what to change, or send it when you’re happy.`),
      h('div', 'fbtns'));
    card.querySelector('.fbtns').append(
      btn('Open in Claude Code', async () => { try { await opened(g.folder, t.name, await making.openClaude(g.folder), false); } catch (e){ problem(card)(e); } }),
      ...(t.failed || !mine.length ? [] : [btn('Check and send', () => sendIt(g, card))]),
      btn('OK', () => { sfx.select(); closePop(); }, 'go'));
  }

  async function refreshMine(){
    if (!making.available) return;
    try { mine = await making.list(); } catch { mine = []; }
    draw();
  }
  /* (back from Try it) */
  if (lastTry) refreshMine().then(afterTry);

  pickFile.addEventListener('change', async () => {
    const f = pickFile.files && pickFile.files[0];
    pickFile.value = '';
    if (!f) return;
    try {
      const g = await outbox.add(new Uint8Array(await f.arrayBuffer()));
      sfx.select(); said = `${g.name} is ready to send.`;
      await send();
    } catch (e){ said = e.message; draw(); }
  });

  async function send(){
    const r = await outbox.sync();
    if (r.sent) { said = `Sent ${r.sent === 1 ? 'it' : r.sent + ' games'} for the owner’s OK.`; sfx.gold?.(); }
    else if (!r.reached) said = (said ? said + ' ' : '') + 'It’ll send by itself when this PC is on the home Wi-Fi with the Orlis server.';
    draw();
  }

  /* a row, the Store's way: its name, then what's in it */
  const row = (name, sub) => {
    const sec = h('section', 'srow');
    sec.appendChild(h('h3', '', `${esc(name)}${sub ? ` <span>${esc(sub)}</span>` : ''}`));
    body.appendChild(sec);
    return sec;
  };

  async function draw(){
    const [waiting, sent] = await Promise.all([outbox.list(), outbox.sent()]);
    btns.innerHTML = '';
    if (making.available) btns.append(sbtn('<span class="plus">+</span>New game', newGamePop, 'get'));
    btns.append(sbtn('Send a game…', () => { sfx.select(); pickFile.click(); }, making.available ? 'ghost' : 'get'));
    if (waiting.length) btns.append(sbtn('Send now', () => { sfx.select(); send(); }, 'ghost'));
    said_.textContent = said;
    body.innerHTML = '';

    /* your games, as the Store's cards */
    if (making.available){
      const sec = row('Your games', mine.length ? 'On this PC' : '');
      if (!mine.length) sec.appendChild(h('p', 'cempty', 'None yet - press New game to make your first.'));
      else {
        const shelf = h('div', 'sshelf');
        for (const g of mine){
          const L = looks({ id: g.manifest.id, icon: g.manifest.icon });
          const b = button('', 'slock');
          const meta = h('div', 'smeta');
          meta.append(L.icon('sicon'), h('div', 'stxt', `<div class="nm">${esc(g.manifest.name)}</div><div class="sub">${esc(g.manifest.blurb || '')}</div>`));
          b.insertBefore(L.art('sthumb'), b.firstChild);
          b.querySelector('.lbl').replaceWith(meta);
          onPick(b, () => gamePop(g));
          shelf.appendChild(b);
        }
        sec.appendChild(shelf);
      }
    }

    if (waiting.length){
      const sec = row('Waiting to send', 'Sends when this PC is on the home Wi-Fi with the Orlis server');
      const list = h('div', 'clist');
      for (const x of waiting){
        const r = h('div', 'citem');
        r.append(h('div', '', `<b>${esc(x.name)}</b> <span class="ctag">version ${esc(x.version)}</span>${x.problem ? `<small class="cbad">${esc(x.problem)}</small>` : ''}`),
          btn('Remove', async () => { await outbox.remove(x.key); draw(); }, 'quiet'));
        list.appendChild(r);
      }
      sec.appendChild(list);
    }

    const sec = row('Sent', 'And how each one went');
    if (sent === null) sec.appendChild(h('p', 'cempty', 'Can’t reach the Orlis server right now to see how they went.'));
    else if (!sent.length) sec.appendChild(h('p', 'cempty', 'Nothing sent yet.'));
    else {
      const list = h('div', 'clist');
      for (const x of sent){
        const [label, cls] = STATE[x.state] || [x.state, ''];
        list.appendChild(h('div', 'citem', `<div><b>${esc(x.name)}</b> <span class="ctag">version ${esc(x.version)}</span><small>${esc(new Date(x.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }))}${x.note ? ` · the owner says: “${esc(x.note)}”` : ''}</small></div><span class="cstate ${cls}">${esc(label)}</span>`));
      }
      sec.appendChild(list);
    }
  }
  draw();
  send();
  refreshMine();

  /* (leaving: no card left over the next page) */
  for (const k of Object.keys(nav)){ const go = nav[k]; nav[k] = () => { closePop(); go(); }; }
  return scene;
}
