/* The sandbox: where a downloaded game runs - sealed off from the app.

   Each running game is a hidden frame of its own (an iframe with only
   "allow-scripts"): a different, empty origin, so it can't reach this page,
   the account, the app's storage or its files; and a content policy that
   lets it load nothing and connect to nothing, so no internet. Inside, the
   game's code and the Orlis runtime (kit/runtime/) talk to this side only by
   messages:

     this -> game   the players' body points each frame (never camera
                    pictures), and "step", "draw", "start a round"
     game -> this   its picture (a finished image), its score and the like,
                    and sounds it would like - played only if they're the
                    app's own

   To the rest of the app, a sandboxed game is a game like any other: it has
   create(n), and its rounds step, draw, report their score and end. They
   answer a frame late - the picture shown is the one it sent last. */
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx, music, ambience, isQuiet } from '../audio/sound.js';

const POLICY = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:";
const BANKS = { sfx, music, ambience };
const READY_WAIT = 8000;

/* the players, as plain body points (what crosses into the sandbox) */
function snapshot(fake){
  const src = fake || pose;
  return {
    players: src.players.map(p => ({
      id: p.id, color: p.color, present: !!p.present, lostFor: p.lostFor, watching: p.watching,
      lm: p.lm ? p.lm.map(k => ({ x: k.x, y: k.y, z: k.z, v: k.v })) : null,
      hands: { left: { ...p.hands.left }, right: { ...p.hands.right } },
      centre: { ...p.centre }, scale: p.scale
    })),
    mouse: { active: !!src.mouse.active, x: src.mouse.x, y: src.mouse.y },
    personCount: src.personCount || 0, seenCount: src.seenCount || 0
  };
}

/* One sealed frame running the game's code. */
function frame(code, onMessage){
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.setAttribute('aria-hidden', 'true');
  f.tabIndex = -1;
  f.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none';
  /* (a "</script" inside the code would end the script early) */
  const safe = code.replace(/<\/script/gi, '<\\/script');
  f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${POLICY}"></head><body><script>${safe}</script></body></html>`;
  const listen = (e) => { if (e.source === f.contentWindow) onMessage(e.data || {}); };
  addEventListener('message', listen);
  document.body.appendChild(f);
  return {
    send: (m) => { try { f.contentWindow && f.contentWindow.postMessage(m, '*'); } catch {} },
    close: () => { removeEventListener('message', listen); f.remove(); }
  };
}

/* A sound the game asked for: the app's own, and only while it's not meant
   to be quiet (a trailer, say). */
function play(m, quiet){
  if (quiet || isQuiet()) return;
  const bank = BANKS[m.bank];
  if (!bank || typeof m.name !== 'string' || !Object.prototype.hasOwnProperty.call(bank, m.name)) return;
  const fn = bank[m.name];
  if (typeof fn !== 'function') return;
  try { fn.apply(bank, (m.args || []).slice(0, 4)); } catch {}
}

/* A round, run in a frame: the shape the app's shell expects of a game. */
class Round {
  constructor(code, n, { quiet = false, fake = null } = {}){
    this.quiet = quiet; this.fake = fake;
    this.state = null; this.bitmap = null; this.waiting = false; this.dt = 0; this.failed = null;
    this.box = frame(code, (m) => this._hear(m));
    this.started = false; this.n = n;
  }
  _hear(m){
    if (m.t === 'ready' && !this.started){ this.started = true; this.box.send({ t: 'create', n: this.n }); }
    else if (m.t === 'frame'){
      this.waiting = false;
      if (this.bitmap && this.bitmap.close) this.bitmap.close();
      this.bitmap = m.bitmap || null;
      this.state = m.state || this.state;
    }
    else if (m.t === 'sound') play(m, this.quiet);
    else if (m.t === 'error'){ this.failed = m.message; this.waiting = false; }
  }
  _ask(dt, W, H, kind){
    this.dt += dt;
    if (!this.started || this.waiting) return;            /* still busy with the last one: it gets the time next */
    this.waiting = true;
    this.box.send({ t: 'frame', dt: this.dt, W, H, pose: snapshot(this.fake), step: kind === 'step', outro: kind === 'outro' });
    this.dt = 0;
  }
  step(dt, W, H){ this._ask(dt, W, H, 'step'); }
  outro(dt, W, H){ this._ask(dt, W, H, 'outro'); return !!(this.state && this.state.outroDone) || !!this.failed; }
  draw(c, W, H){
    if (this.bitmap) c.drawImage(this.bitmap, 0, 0, W, H);
    else { c.fillStyle = '#0d0b1a'; c.fillRect(0, 0, W, H); }
  }
  get over(){ return !!(this.state && this.state.over) || !!this.failed; }
  get mood(){ return this.state && typeof this.state.mood === 'number' ? this.state.mood : null; }
  pausable(){ return !this.state || this.state.pausable !== false; }
  hud(){
    const h = this.state && this.state.hud;
    return h && typeof h === 'object' ? { score: [], ...h } : { score: [0, 0, 0, 0], hideScore: true };
  }
  value(){ const v = this.state && this.state.value; return typeof v === 'number' ? v : 0; }
  close(){ this.box.close(); if (this.bitmap && this.bitmap.close) this.bitmap.close(); }
}

/* A game from the Store, made ready: its code started once in a frame, to
   hear what it says about itself (name, round length, music...), then a
   game object for the home screen and the shell. */
export function sandboxed(rec){
  return new Promise((ok, no) => {
    let done = false;
    const probe = frame(rec.code, (m) => {
      if (m.t !== 'ready' || done) return;
      done = true; probe.close();
      const meta = m.meta || {};
      if (meta.id !== rec.id) return no(new Error('not this game'));
      let playing = null, showing = null;
      const g = {
        ...meta, id: rec.id, name: String(meta.name || rec.manifest.name).slice(0, 40), sandboxed: true,
        /* (a colour for its tile and banner: its own, its icon's, or Orlis violet) */
        accent: /^#[0-9a-f]{3,8}$/i.test(meta.accent || '') ? meta.accent : ((rec.manifest.icon && rec.manifest.icon.cols && rec.manifest.icon.cols[0]) || '#6d5efc'),
        create(n){ if (playing) playing.close(); playing = new Round(rec.code, n); return playing; },
        /* the home screen's trailer: the game playing itself, quietly, with
           two pretend players reaching about */
        trailer(){ if (showing) showing.close(); showing = new Round(rec.code, 2, { quiet: true, fake: pretend() }); return trailerOf(showing); }
      };
      ok(g);
    });
    setTimeout(() => { if (!done){ done = true; probe.close(); no(new Error('the game didn\'t start')); } }, READY_WAIT);
  });
}

/* Two pretend players for a trailer: present, hands drifting over the
   middle of the screen. */
function pretend(){
  const fake = { players: pose.players.map((p, i) => ({ ...p, id: i, color: PLAYER_COLORS[i], present: i < 2, lm: null, hands: { left: { x: .5, y: .5, vx: 0, vy: 0, speed: 0 }, right: { x: .5, y: .5, vx: 0, vy: 0, speed: 0 } }, centre: { x: .5, y: .5 }, scale: 0.3 })), mouse: { active: true, x: .5, y: .5 }, personCount: 2, seenCount: 2, t: 0 };
  return fake;
}
function trailerOf(round){
  const fake = round.fake;
  return {
    anchor: 0.5,
    step(dt, W, H){
      fake.t += dt;
      fake.players.slice(0, 2).forEach((p, i) => {
        const t = fake.t * (0.6 + i * 0.17) + i * 2;
        const x = 0.5 + Math.sin(t) * 0.25 + i * 0.1 - 0.05, y = 0.45 + Math.sin(t * 1.7) * 0.2;
        p.hands.right = { x, y, vx: 0, vy: 0, speed: 0.5 }; p.hands.left = { x: x - 0.08, y: y + 0.1, vx: 0, vy: 0, speed: 0.3 };
        p.centre = { x, y: 0.6 };
      });
      fake.mouse.x = fake.players[0].hands.right.x; fake.mouse.y = fake.players[0].hands.right.y;
      round.step(Math.min(dt, 1 / 20), W, H);
    },
    draw(c, W, H){ round.draw(c, W, H); },
    close(){ round.close(); }
  };
}
