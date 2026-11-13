/* Create: making your own games. For now, what's coming - under the same
   top bar and tabs as Home and the Store. */
import { screen, h, clearUI } from './screens.js';
import { topBar } from './tabs.js';
import { CREATE_SOON } from './menu.js';
import { PAPER } from './boot.js';

export function createPage({ nav = {}, onWho, onRecalibrate }){
  clearUI();
  const s = screen('tvhome createpage');
  const bar = topBar('create', nav, { onWho, onRecalibrate });
  s.appendChild(bar.el);
  const card = h('div', 'setcard soonpage');
  const m = CREATE_SOON;
  card.append(h('div', 'soonicon', m.icon), h('div', 'soontag', 'Coming soon'), h('h2', '', m.name), h('p', 'soonline', m.line), h('p', 'soonabout', m.about));
  const mid = h('div', 'createmid'); mid.appendChild(card);
  s.appendChild(mid);
  return {
    tick(dt){ bar.tick(dt); },
    draw(c, W, H){ c.fillStyle = PAPER; c.fillRect(0, 0, W, H); }
  };
}
