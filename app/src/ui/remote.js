/* The TV remote - any plain one that plugs into the laptop and acts as a
   keyboard - or the laptop's own arrow keys. Arrows move a highlight to the
   nearest button that way on whatever's on top (an open window first, else
   the screen), OK (Enter) presses it, and Back (Escape, Backspace, or a
   remote's own Back key) goes back: closes a window, pauses a game, leaves
   the scores.

   It works alongside pointing and waving: the highlight starts from
   whatever the screen has picked (the home screen's tile, say), and a
   button picked by moving to it hears 'remotefocus' so the screen can
   follow along. */
import { sfx } from '../audio/sound.js';

const DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const OK = new Set(['Enter', 'NumpadEnter', ' ', 'Select', 'Accept']);
const BACK = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack', 'Back']);

export const remote = {
  cur: null,
  lastKey: 0,          /* when it was last used (a count, for the screens to notice) */
  back: null,          /* what Back does when nothing's open (main.js) */

  /* The highlighted button. */
  mark(el){
    document.querySelectorAll('.kfocus').forEach(e => { if (e !== el) e.classList.remove('kfocus'); });
    if (el) el.classList.add('kfocus');
    this.cur = el || null;
  },

  /* What's on top: an open window, else the screen. */
  layer(){
    const ui = document.getElementById('ui');
    if (!ui) return null;
    const all = [...ui.children].filter(e => e.classList && e.classList.contains('screen'));
    return all.filter(e => e.classList.contains('dim') && !e.classList.contains('lost')).pop() || all.pop() || null;
  },
  buttons(layer){
    return [...layer.querySelectorAll('.btn')].filter(b => !b.disabled && !b.closest('.hide') && b.getBoundingClientRect().width > 0);
  },
  /* Where to start from in this layer. */
  start(layer, bs){
    if (this.cur && bs.includes(this.cur)) return this.cur;
    return layer.querySelector('.btn.focus') || null;
  },

  /* The nearest button that way: the next row (or column) over first -
     never skipping one - then the closest along it. Left and right stay on
     the same row. */
  nearest(from, bs, [dx, dy]){
    const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const cand = [];
    for (const b of bs){
      if (b === from) continue;
      const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const along = (x - ax) * dx + (y - ay) * dy, side = Math.abs((x - ax) * dy - (y - ay) * dx);
      if (along <= 4) continue;
      if (dx && side > Math.max(a.height, r.height) * 0.6) continue;
      cand.push({ b, along, side, size: dx ? r.width : r.height });
    }
    if (!cand.length) return null;
    const near = Math.min(...cand.map(c => c.along));
    const band = cand.filter(c => c.along <= near + Math.max(a[dx ? 'width' : 'height'], c.size) * 0.5);
    band.sort((p, q) => (p.side - q.side) || (p.along - q.along));
    return band[0].b;
  },

  key(e){
    /* typing in a box (an email, a password): the keys are the box's */
    if (typing(e)) return false;
    const dir = DIRS[e.key];
    if (dir || OK.has(e.key)){
      const layer = this.layer();
      const bs = layer ? this.buttons(layer) : [];
      if (!bs.length) return false;
      e.preventDefault?.();
      this.lastKey++;
      document.body.classList.add('remote');
      const cur = this.start(layer, bs);
      if (OK.has(e.key)){ const b = cur || bs[0]; this.mark(b); b.click(); return true; }
      const next = cur ? this.nearest(cur, bs, dir) : bs[0];
      if (!next) return true;
      this.mark(next);
      if (!next.classList.contains('tvtile')) sfx.nav();
      next.dispatchEvent(new CustomEvent('remotefocus'));
      return true;
    }
    if (BACK.has(e.key)){
      e.preventDefault?.();
      const layer = this.layer();
      const close = layer && layer.classList.contains('dim') && layer.querySelector('.btn.close');
      if (close){ sfx.back(); close.click(); return true; }
      if (this.back) this.back();
      return true;
    }
    return false;
  },

  /* Each frame, once the remote's in use: a new window or screen gets its
     highlight straight away (what it's picked, else its first button). */
  sync(){
    if (typeof document === 'undefined' || !document.body.classList.contains('remote')) return;
    const layer = this.layer(); if (!layer) return;
    if (this.cur && this.cur.isConnected && layer.contains(this.cur)) return;
    const bs = this.buttons(layer);
    if (bs.length) this.mark(layer.querySelector('.btn.focus') || bs[0]);
  },

  install(back){
    this.back = back;
    addEventListener('keydown', (e) => this.key(e));
    if (typeof window !== 'undefined') window.__remote = this;
    /* pointing again: the remote's highlight steps aside */
    addEventListener('pointermove', () => document.body.classList.remove('remote'));
  }
};

/* Whether a key went to a text box being typed in. */
export function typing(e){
  const t = e && e.target;
  if (!t || !t.tagName) return false;
  if (t.isContentEditable) return true;
  if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  return t.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range'].includes((t.type || 'text').toLowerCase());
}
