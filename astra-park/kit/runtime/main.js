/* The Orlis sandbox runtime: what a downloaded game runs inside.

   The game lives in a sealed frame - no internet, no storage, nothing of
   the app's - and talks to the app only through these messages:

     app -> game   create { n }                  start a round for n players
                   frame  { dt, W, H, pose, step, outro }
                                                 (step it,) draw it, send it back
     game -> app   ready  { meta }               its name, round length, music...
                   frame  { bitmap, state }      the picture, and its score etc.
                   sound  { bank, name, args }   a sound it'd like played
                   error  { message }

   The picture is drawn on a canvas of its own and handed over whole, so the
   app puts it on screen - the game never touches the app's screen. */
import { applyPose } from './pose.js';

const plain = (v, depth = 0) => {
  if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (depth > 4 || typeof v === 'function') return undefined;
  if (Array.isArray(v)) return v.slice(0, 64).map(x => plain(x, depth + 1));
  if (typeof v === 'object'){ const o = {}; for (const k of Object.keys(v).slice(0, 64)) o[k] = plain(v[k], depth + 1); return o; }
  return undefined;
};

export function run(game){
  const post = (m, transfer) => parent.postMessage(m, '*', transfer || []);
  const meta = {};
  for (const [k, v] of Object.entries(game)) if (typeof v !== 'function') meta[k] = plain(v);
  let inst = null, canvas = null, ctx = null, outroDone = false;

  const state = () => {
    if (!inst) return null;
    const call = (f) => { try { return typeof inst[f] === 'function' ? plain(inst[f]()) : undefined; } catch { return undefined; } };
    return {
      hud: call('hud'), value: call('value'),
      over: !!inst.over, mood: typeof inst.mood === 'number' ? inst.mood : null,
      pausable: typeof inst.pausable === 'function' ? !!inst.pausable() : true,
      outroDone
    };
  };

  addEventListener('message', (e) => {
    if (e.source !== parent) return;
    const m = e.data || {};
    try {
      if (m.t === 'create'){ inst = game.create(m.n); outroDone = false; return; }
      if (m.t === 'frame' && inst){
        applyPose(m.pose);
        const W = Math.max(1, Math.min(4096, m.W | 0)), H = Math.max(1, Math.min(4096, m.H | 0));
        if (!canvas || canvas.width !== W || canvas.height !== H){ canvas = new OffscreenCanvas(W, H); ctx = canvas.getContext('2d'); }
        if (m.step) inst.step(m.dt, W, H);
        if (m.outro && typeof inst.outro === 'function') outroDone = !!inst.outro(m.dt, W, H);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, W, H);
        inst.draw(ctx, W, H);
        const bitmap = canvas.transferToImageBitmap();
        post({ t: 'frame', bitmap, state: state() }, [bitmap]);
      }
    } catch (err){ post({ t: 'error', message: String(err && err.message || err).slice(0, 300) }); }
  });
  post({ t: 'ready', meta });
}
