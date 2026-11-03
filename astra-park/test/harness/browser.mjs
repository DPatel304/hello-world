/* A DOM small enough to read in one sitting and large enough for the parts of
   Astra Park that touch one. jsdom would do this too, but it is a dependency, and
   the point of these tests is that `npm test` works on a clean checkout with
   nothing installed. */

class ClassList {
  constructor(el){ this.el = el; }
  _set(){ return new Set(this.el.className.split(/\s+/).filter(Boolean)); }
  add(...c){ const s = this._set(); c.forEach(x => s.add(x)); this.el.className = [...s].join(' '); }
  remove(...c){ const s = this._set(); c.forEach(x => s.delete(x)); this.el.className = [...s].join(' '); }
  contains(c){ return this._set().has(c); }
  toggle(c, force){
    const has = this.contains(c);
    const want = force === undefined ? !has : !!force;
    if (want) this.add(c); else this.remove(c);
    return want;
  }
}

/* Real CSSStyleDeclaration has setProperty alongside the camelCase props, and
   cursor.js uses it to hand buttons a player colour. A plain object silently
   has neither, so this is both. */
function makeStyle(){
  const st = {};
  const def = (name, value) => Object.defineProperty(st, name, { value, enumerable:false });
  def('setProperty', (k, v) => { st[k] = String(v); });
  def('getPropertyValue', (k) => st[k] ?? '');
  def('removeProperty', (k) => { const v = st[k]; delete st[k]; return v ?? ''; });
  return st;
}

class FakeEl {
  constructor(tag){
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parent = null;
    this.id = '';
    this.disabled = false;
    this.style = makeStyle();
    this._class = '';
    this._text = '';
    this._listeners = Object.create(null);
    /* Tests set this to place a button on screen. Zero width by default, which
       is exactly how cursor._hit skips elements that are not laid out. */
    this.rect = { left:0, top:0, width:0, height:0, right:0, bottom:0 };
    this.classList = new ClassList(this);
  }

  get className(){ return this._class; }
  set className(v){ this._class = String(v == null ? '' : v); }

  get textContent(){ return this._text; }
  set textContent(v){ this._text = String(v == null ? '' : v); this.children = []; }

  /* Only the markup Astra Park actually writes: a flat run of single-depth tags.
     Enough for button(), which is the one place innerHTML builds structure. */
  get innerHTML(){ return this._text; }
  set innerHTML(html){
    this.children = [];
    this._text = '';
    const re = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
    let m, found = false;
    while ((m = re.exec(String(html)))){
      found = true;
      const el = new FakeEl(m[1]);
      const cls = /class="([^"]*)"/.exec(m[2]);
      if (cls) el.className = cls[1];
      el._text = m[3];
      el.parent = this;
      this.children.push(el);
    }
    if (!found) this._text = String(html);
  }

  appendChild(c){ c.parent = this; this.children.push(c); return c; }
  append(...cs){ cs.forEach(c => this.appendChild(c)); }
  remove(){
    if (!this.parent) return;
    const i = this.parent.children.indexOf(this);
    if (i >= 0) this.parent.children.splice(i, 1);
    this.parent = null;
  }

  getBoundingClientRect(){
    const r = this.rect;
    return { left:r.left, top:r.top, width:r.width, height:r.height,
             right: r.right || r.left + r.width,
             bottom: r.bottom || r.top + r.height };
  }

  _matches(sel){
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    if (sel.startsWith('.')) return sel.slice(1).split('.').every(c => this.classList.contains(c));
    return this.tagName === sel.toUpperCase();
  }

  _walk(out = []){
    for (const c of this.children){ out.push(c); c._walk(out); }
    return out;
  }

  querySelectorAll(sel){ return this._walk().filter(e => e._matches(sel)); }
  querySelector(sel){ return this.querySelectorAll(sel)[0] || null; }

  closest(sel){
    let n = this;
    while (n){ if (n._matches(sel)) return n; n = n.parent; }
    return null;
  }

  addEventListener(type, fn){ (this._listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn){
    const a = this._listeners[type]; if (!a) return;
    const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  }
  dispatchEvent(ev){
    ev.target ||= this;
    for (const fn of this._listeners[ev.type] || []) fn(ev);
    if (ev.bubbles && this.parent) this.parent.dispatchEvent(ev);
    return true;
  }
}

class FakeEvent {
  constructor(type, opts = {}){
    this.type = type;
    this.detail = opts.detail;
    this.bubbles = !!opts.bubbles;
    this.target = null;
  }
}

/* Keys have to be own enumerable properties: scores.reset() clears by
   Object.keys(localStorage), which is how a real Storage behaves. */
function makeStorage(){
  const s = {};
  const def = (name, value) => Object.defineProperty(s, name, { value, enumerable:false });
  def('getItem', (k) => Object.prototype.hasOwnProperty.call(s, k) ? String(s[k]) : null);
  def('setItem', (k, v) => { s[k] = String(v); });
  def('removeItem', (k) => { delete s[k]; });
  def('clear', () => { for (const k of Object.keys(s)) delete s[k]; });
  def('key', (i) => Object.keys(s)[i] ?? null);
  return s;
}

const document = {
  _root: new FakeEl('body'),
  createElement: (tag) => new FakeEl(tag),
  getElementById(id){ return this._root._walk().find(e => e.id === id) || null; },
  querySelectorAll(sel){ return this._root.querySelectorAll(sel); },
  querySelector(sel){ return this._root.querySelector(sel); },
  get body(){ return this._root; }
};

export function resetDom(){
  document._root = new FakeEl('body');
  const ui = new FakeEl('div');
  ui.id = 'ui';
  document._root.appendChild(ui);
  globalThis.localStorage.clear();
  return ui;
}

globalThis.localStorage = makeStorage();
globalThis.document = document;
globalThis.CustomEvent = FakeEvent;
globalThis.Event = FakeEvent;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.location = { protocol: 'http:', href: 'http://localhost/' };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.window = globalThis;

export { FakeEl, FakeEvent, document };
