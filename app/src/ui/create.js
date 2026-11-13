/* Create: making your own games - for grown-ups the owner made creators.

   For now: sending a game in. A creator picks a game's .orlis file; it waits
   here (the outbox, on this PC) and is sent by itself when the family's
   Orlis server is in reach - on its home Wi-Fi - to wait for the owner's OK.
   Below, what's been sent and how each went: waiting, in the Store, or not
   this time (with the owner's note).

   Next, making the games themselves here, with Claude. Everyone else sees
   what's coming. */
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account } from './account.js';
import { outbox } from './outbox.js';
import { topBar } from './tabs.js';
import { CREATE_SOON } from './menu.js';
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

export function createPage({ nav = {}, onWho, onRecalibrate }){
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

  const { hero, text } = banner('Create', 'Make a game', 'Making games here, with Claude, is coming next. For now: send a game you’ve made, for the owner to OK for the Store.');
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
    btns.append(sbtn('Send a game…', () => { sfx.select(); pickFile.click(); }, 'get'));
    if (waiting.length) btns.append(sbtn('Send now', () => { sfx.select(); send(); }, 'ghost'));
    said_.textContent = said;
    body.innerHTML = '';

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

  return scene;
}
