/* Signing in, in the Windows app: finding the family's Orlis server on the
   home Wi-Fi, an account (a grown-up's), and "Who's playing?" - the kids'
   profiles under it.

   Once signed in, a device stays signed in: the account and its profiles are
   kept here, so the games play with no server in reach (it's only needed to
   join, sign in, and - next - to sync games). When the server is reachable,
   the profiles are quietly brought up to date.

   Only in the Windows app (window.__TAURI__). Opened any other way - the
   browser, the tests - there's no account step at all. */
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx } from '../audio/sound.js';

const KEY = 'orlis.account';
export const AVATARS = {
  cube: '\u{1F9CA}', rocket: '\u{1F680}', star: '\u{2B50}', moon: '\u{1F319}', balloon: '\u{1F388}', fish: '\u{1F41F}',
  dino: '\u{1F996}', cat: '\u{1F431}', dog: '\u{1F436}', owl: '\u{1F989}', bee: '\u{1F41D}', leaf: '\u{1F343}'
};
const TIMEOUT = 4000;

const inApp = () => typeof window !== 'undefined' && !!(window.__TAURI__ && window.__TAURI__.core);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const save = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };

export const account = {
  /* { server: { url, name }, token, account: { id, email, role }, household: { id, name }, profiles: [...] (the whole family's), current } */
  state: load(),
  get needed(){ return inApp(); },
  get signedIn(){ return !!(this.state && this.state.token); },
  get current(){ const s = this.state; return s && s.profiles ? s.profiles.find(p => p.id === s.current) || null : null; },
  get role(){ return this.state && this.state.account ? this.state.account.role : null; },
  set(patch){ this.state = { ...(this.state || {}), ...patch }; save(this.state); },
  signOut(){
    const s = this.state;
    if (s && s.token && s.server) call(s.server.url, 'POST', '/api/signout', null, s.token).catch(() => {});
    this.state = s && s.server ? { server: s.server } : null;
    save(this.state);
  },
  /* With the server in reach: the profiles as they are now. Out of reach,
     nothing changes. Signed out somewhere else: signed out here too. */
  async refresh(){
    const s = this.state;
    if (!s || !s.token || !s.server) return;
    try {
      const me = await call(s.server.url, 'GET', '/api/me', null, s.token);
      this.set({ account: me.account, household: me.household || null, profiles: me.profiles });
    } catch (e){ if (e.status === 401) this.signOut(); }
  },
  call: (method, path, body) => {
    const s = account.state;
    return call(s.server.url, method, path, body, s.token);
  }
};

export async function call(url, method, path, body, token){
  let r;
  try {
    r = await fetch(url.replace(/\/$/, '') + path, {
      method, signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e){
    const err = new Error('Couldn\'t reach the Orlis server. Is it running, and is this PC on the home Wi-Fi?');
    err.status = 0; throw err;
  }
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok){ const err = new Error(data.message || 'Something went wrong.'); err.status = r.status; err.code = data.error; throw err; }
  return data;
}

/* Orlis servers on the Wi-Fi, found by the app (a broadcast) - each with its
   name and address. */
async function findServers(){
  try { return await window.__TAURI__.core.invoke('find_servers'); }
  catch { return []; }
}
async function hello(url){
  const r = await call(url, 'GET', '/api/hello');
  if (r.app !== 'orlis') throw new Error('That isn\'t an Orlis server.');
  return r;
}

/* ---------- the screens ----------
   One overlay at a time, swapped in place: finding the server, then signing
   in or joining (or, on a brand-new server, setting up as the owner), then
   "Who's playing?". done() once a profile's picked. */
export function welcome(done, { auto = true } = {}){
  clearUI();
  const s = screen('dim account');
  const show = (...nodes) => { s.innerHTML = ''; s.append(...nodes); };
  const msg = h('p', 'lede formmsg', '');
  const say = (t, bad) => { msg.textContent = t || ''; msg.classList.toggle('bad', !!bad); };

  /* a form: labelled boxes, one button that sends, Enter sends too */
  function form(fields, label, send){
    const f = h('form', 'acctform');
    const boxes = {};
    for (const [key, text, type, extra] of fields){
      if (type === 'check'){
        const l = h('label', 'check');
        const c = document.createElement('input'); c.type = 'checkbox'; boxes[key] = c;
        l.append(c, h('span', '', text));
        f.appendChild(l);
        continue;
      }
      const l = h('label', 'field', `<span>${text}</span>`);
      const i = document.createElement('input');
      i.type = type || 'text'; i.autocomplete = extra || 'off'; i.spellcheck = false;
      boxes[key] = i; l.appendChild(i); f.appendChild(l);
    }
    const go = button(label, 'go');
    go.type = 'submit';
    let busy = false;
    const submit = async (e) => {
      e?.preventDefault?.();
      if (busy) return;
      busy = true; go.classList.add('busy'); say('');
      try { await send(Object.fromEntries(Object.entries(boxes).map(([k, b]) => [k, b.type === 'checkbox' ? b.checked : b.value]))); }
      catch (err){ sfx.boing?.(0.6); say(err.message, true); }
      busy = false; go.classList.remove('busy');
    };
    f.addEventListener('submit', submit);
    go.addEventListener('pick', submit);
    f.append(go);
    setTimeout(() => { const first = Object.values(boxes).find(b => b.type !== 'checkbox'); first?.focus(); }, 50);
    return f;
  }

  /* 1: find the server */
  async function find(){
    show(h('h2', '', 'Finding your Orlis server…'), h('p', 'lede', 'Looking on this Wi-Fi.'));
    const saved = account.state && account.state.server;
    let found = [];
    if (saved){ try { const r = await hello(saved.url); found = [{ url: saved.url, name: r.name, setup: r.setup }]; } catch {} }
    if (!found.length){
      const list = await findServers();
      for (const sv of list){ try { const r = await hello(sv.url); found.push({ url: sv.url, name: r.name, setup: r.setup }); } catch {} }
    }
    if (found.length === 1) return connect(found[0]);
    if (found.length > 1) return choose(found);
    notFound();
  }
  function choose(list){
    show(h('h2', '', 'Which Orlis server?'), ...list.map(sv => onPick(button(sv.name, 'wide'), () => connect(sv))));
  }
  function notFound(){
    const addr = form([['url', 'Or type its address (it\'s in the server\'s window)', 'text']], 'Connect', async ({ url }) => {
      let u = url.trim(); if (!/^https?:\/\//.test(u)) u = 'http://' + u;
      if (!/:\d+$/.test(u.replace(/\/$/, ''))) u = u.replace(/\/$/, '') + ':47871';
      const r = await hello(u);
      connect({ url: u, name: r.name, setup: r.setup });
    });
    show(h('h2', '', 'Couldn\'t find an Orlis server'),
      h('p', 'lede', 'Make sure Orlis Server is running on the laptop, and that this PC is on the same home Wi-Fi.'),
      onPick(button('Try again', 'wide'), () => { sfx.select(); find(); }), addr, msg);
  }

  /* 2: in - set up, sign in, or join */
  function connect(sv){
    account.set({ server: { url: sv.url, name: sv.name } });
    if (sv.setup) return setup(sv);
    signIn(sv);
  }
  const device = () => (navigator.userAgent.includes('Windows') ? 'Windows PC' : 'A device');
  const finish = (r) => { account.set({ token: r.token, account: r.account, household: r.household || null, profiles: r.profiles, current: null }); sfx.gold?.(); who(); };

  function setup(sv){
    show(h('h2', '', 'Set up Orlis Play'),
      h('p', 'lede', `A new server: "${sv.name}". The first account is the owner's - yours.`),
      form([
        ['email', 'Your email', 'email', 'email'],
        ['password', 'A password (8 or more characters)', 'password', 'new-password'],
        ['name', 'Your first name (your profile)', 'text'],
        ['adult', 'I\'m a parent or guardian, 18 or over', 'check']
      ], 'Create account', async (v) => finish(await call(sv.url, 'POST', '/api/signup', { ...v, device: device() }))),
      msg);
  }
  function signIn(sv){
    show(h('h2', '', 'Sign in'), h('p', 'lede', `to "${sv.name}"`),
      form([
        ['email', 'Email', 'email', 'email'],
        ['password', 'Password', 'password', 'current-password']
      ], 'Sign in', async (v) => finish(await call(sv.url, 'POST', '/api/signin', { ...v, device: device() }))),
      msg,
      onPick(button('New here? Join with an invite', 'link'), () => { sfx.select(); join(sv); }));
  }
  function join(sv){
    show(h('h2', '', 'Join with an invite'), h('p', 'lede', 'Ask the owner for an invite code.'),
      form([
        ['invite', 'Invite code', 'text'],
        ['email', 'Your email (a grown-up\'s)', 'email', 'email'],
        ['password', 'A password (8 or more characters)', 'password', 'new-password'],
        ['name', 'Your first name (your profile)', 'text'],
        ['adult', 'I\'m a parent or guardian, 18 or over', 'check']
      ], 'Join', async (v) => finish(await call(sv.url, 'POST', '/api/signup', { ...v, device: device() }))),
      msg,
      onPick(button('Already have an account? Sign in', 'link'), () => { sfx.select(); signIn(sv); }));
  }

  /* 3: who's playing - straight past it when there's only one profile to
     pick (on the way in; asked for from the home screen, it always shows,
     so there's a way to add a kid) */
  function who(){
    const list = account.state.profiles || [];
    if (auto && list.length === 1){ account.set({ current: list[0].id }); return done(list[0]); }
    auto = false;
    const tiles = h('div', 'whotiles');
    for (const p of account.state.profiles || []){
      tiles.appendChild(onPick(button(`<span class="av">${AVATARS[p.avatar] || AVATARS.cube}</span><span class="nm">${esc(p.name)}</span>`, 'who'), () => {
        sfx.select(); account.set({ current: p.id }); done(p);
      }));
    }
    if ((account.state.profiles || []).length < 8) tiles.appendChild(onPick(button('<span class="av">+</span><span class="nm">Add a kid</span>', 'who add'), () => { sfx.select(); addKid(); }));
    show(h('h2', '', 'Who\'s playing?'), tiles, msg);
  }
  function addKid(){
    let pick = 'rocket';
    const grid = h('div', 'avatars');
    const mark = () => [...grid.children].forEach(b => b.classList.toggle('chosen', b.dataset.av === pick));
    for (const [id, em] of Object.entries(AVATARS)){
      const b = onPick(button(em, 'av'), () => { pick = id; mark(); }); b.type = 'button'; b.dataset.av = id; grid.appendChild(b);
    }
    mark();
    const f = form([['name', 'Their first name or a nickname', 'text']], 'Add', async ({ name }) => {
      const p = await account.call('POST', '/api/profiles', { name, avatar: pick });
      account.set({ profiles: [...(account.state.profiles || []), p] });
      who();
    });
    f.insertBefore(grid, f.lastChild);
    show(h('h2', '', 'Add a kid'), h('p', 'lede', 'Just a name and a picture - nothing else is needed.'), f, msg,
      onPick(button('Back', 'link'), () => { sfx.back?.(); who(); }));
  }

  if (account.signedIn) who(); else find();
  return { tick(){}, draw(){} };
}

const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
