/* Inside the sandbox: sounds and music. A game calls sfx.pop() or
   music.parade() just as a built-in one does; each call becomes a request
   to the app, which plays it only if it's one of its own sounds. */
const ask = (bank) => new Proxy({}, {
  get: (_, name) => typeof name !== 'string' ? undefined : (...args) => {
    const safe = args.slice(0, 4).filter(a => ['number', 'string', 'boolean'].includes(typeof a)).map(a => typeof a === 'string' ? a.slice(0, 40) : a);
    parent.postMessage({ t: 'sound', bank, name: name.slice(0, 40), args: safe }, '*');
  }
});
export const sfx = ask('sfx');
export const music = ask('music');
export const ambience = ask('ambience');
export const audio = { volume: 1, muted: false, setVolume(){}, toggleMute(){ return false; }, resume(){}, away(){} };
export const isQuiet = () => false;
export function quietly(fn){ return fn(); }
