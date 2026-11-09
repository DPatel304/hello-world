/* Stands in for src/audio/sound.js.

   Every sound is synthesised from oscillators against a live AudioContext,
   which there is no sensible way to fake and no real value in asserting on.
   Stubbing it keeps the cursor and screen tests focused on the behaviour that
   has actually regressed before - dwell, cool-down, the calibration gate -
   rather than on a graph of gain nodes. */

const noop = () => {};
/* A test can put a spy in place of a sound, to hear whether it played. */
const recorder = () => new Proxy({}, {
  get(t, k){ return k === 'then' ? undefined : Object.hasOwn(t, k) ? t[k] : noop; }
});

export const sfx = recorder();
export const music = recorder();
/* (muted and quiet can be switched on by a test: stub.muted, stub.quiet) */
export const stub = { muted: false, quiet: false };
const sound = { volume: 0.7, get muted(){ return stub.muted; } };
export const audio = new Proxy({}, { get: (t, k) => k in sound ? sound[k] : k === 'then' ? undefined : noop });
export const ambience = recorder();

export const isQuiet = () => stub.quiet;
export const quietly = (fn) => fn();
