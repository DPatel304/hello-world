/* Stands in for src/audio/sound.js.

   Every sound is synthesised from oscillators against a live AudioContext,
   which there is no sensible way to fake and no real value in asserting on.
   Stubbing it keeps the cursor and screen tests focused on the behaviour that
   has actually regressed before - dwell, cool-down, the calibration gate -
   rather than on a graph of gain nodes. */

const noop = () => {};
const recorder = () => new Proxy({}, {
  get(_, k){ return k === 'then' ? undefined : noop; }
});

export const sfx = recorder();
export const music = recorder();
export const audio = Object.assign(recorder(), {
  get volume(){ return 0.7; },
  get muted(){ return false; },
  get popStyle(){ return 'soft'; }
});
