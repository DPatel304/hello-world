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

export function createPage({ nav = {}, onWho, onRecalibrate }){
  clearUI();
  const s = screen('tvhome createpage');
  const bar = topBar('create', nav, { onWho, onRecalibrate });
  s.appendChild(bar.el);
  const creator = account.signedIn && (account.role === 'creator' || account.role === 'owner');

  if (!creator){
    const card = h('div', 'setcard soonpage');
    const m = CREATE_SOON;
    card.append(h('div', 'soonicon', m.icon), h('div', 'soontag', 'Coming soon'), h('h2', '', m.name), h('p', 'soonline', m.line), h('p', 'soonabout', m.about));
    if (account.signedIn) card.appendChild(h('p', 'soonabout', 'Making games is for grown-ups the server’s owner has made creators.'));
    const mid = h('div', 'createmid'); mid.appendChild(card);
    s.appendChild(mid);
    return { tick(dt){ bar.tick(dt); }, draw(c, W, H){ c.fillStyle = PAPER; c.fillRect(0, 0, W, H); } };
  }

  const body = h('div', 'cbody');
  s.appendChild(body);
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

  async function draw(){
    const [waiting, sent] = await Promise.all([outbox.list(), outbox.sent()]);
    body.innerHTML = '';
    body.appendChild(h('div', 'chead', '<h1>Create</h1><p>Making games here, with Claude, is coming next. For now: send a game you’ve made, for the owner to OK for the Store.</p>'));
    const top = h('div', 'crow');
    top.append(btn('Send a game…', () => { sfx.select(); pickFile.click(); }, 'go'));
    if (waiting.length) top.append(btn('Send now', () => { sfx.select(); send(); }));
    body.appendChild(top);
    if (said) body.appendChild(h('p', 'csaid', esc(said)));

    if (waiting.length){
      body.appendChild(h('h3', 'fsub', 'Waiting to send'));
      const list = h('div', 'clist');
      for (const x of waiting){
        const r = h('div', 'citem');
        r.append(h('div', '', `<b>${esc(x.name)}</b> <span class="ctag">version ${esc(x.version)}</span>${x.problem ? `<small class="cbad">${esc(x.problem)}</small>` : '<small>Sends when this PC is on the home Wi-Fi with the Orlis server</small>'}`),
          btn('Remove', async () => { await outbox.remove(x.key); draw(); }, 'quiet'));
        list.appendChild(r);
      }
      body.appendChild(list);
    }

    body.appendChild(h('h3', 'fsub', 'Sent'));
    if (sent === null) body.appendChild(h('p', 'csaid', 'Can’t reach the Orlis server right now to see how they went.'));
    else if (!sent.length) body.appendChild(h('p', 'csaid', 'Nothing sent yet.'));
    else {
      const list = h('div', 'clist');
      for (const x of sent){
        const [label, cls] = STATE[x.state] || [x.state, ''];
        list.appendChild(h('div', 'citem', `<div><b>${esc(x.name)}</b> <span class="ctag">version ${esc(x.version)}</span><small>${esc(new Date(x.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }))}${x.note ? ` · the owner says: “${esc(x.note)}”` : ''}</small></div><span class="cstate ${cls}">${esc(label)}</span>`));
      }
      body.appendChild(list);
    }
  }
  draw();
  send();

  return { tick(dt){ bar.tick(dt); }, draw(c, W, H){ c.fillStyle = PAPER; c.fillRect(0, 0, W, H); } };
}
