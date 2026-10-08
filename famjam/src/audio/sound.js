/* Every sound in FamJam is made here. No files, no fetches: a handful of
   oscillators and a noise buffer, which also means the whole app works with
   the network unplugged. */
let AC = null, master = null, musicGain = null;
let state = { vol: 0.7, muted: false };

try {
  const saved = JSON.parse(localStorage.getItem('famjam_audio') || 'null');
  if (saved) state = { ...state, ...saved };
} catch (e) {}

function save(){
  try { localStorage.setItem('famjam_audio', JSON.stringify(state)); } catch (e) {}
}

function ctx(){
  if (!AC){
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = state.muted ? 0 : state.vol;
    master.connect(AC.destination);
    musicGain = AC.createGain();
    musicGain.gain.value = 0.34;
    musicGain.connect(master);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

let noiseBuf = null;
function noise(){
  const c = ctx();
  if (!noiseBuf){
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource(); s.buffer = noiseBuf; return s;
}

function blip({ freq = 440, to = null, dur = 0.16, type = 'sine', gain = 0.3, delay = 0, bend = 0 }){
  const c = ctx(), t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  else if (bend) o.frequency.linearRampToValueAtTime(Math.max(20, freq + bend), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function hiss({ dur = 0.18, gain = 0.25, hp = 900, delay = 0, sweep = 0 }){
  const c = ctx(), t = c.currentTime + delay;
  const s = noise(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'highpass'; f.frequency.setValueAtTime(hp, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, hp + sweep), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}

export const sfx = {
  tick(){ blip({ freq: 1500, dur: 0.05, type: 'square', gain: 0.10 }); },
  pop(){ blip({ freq: 620, to: 1500, dur: 0.11, type: 'sine', gain: 0.34 });
         hiss({ dur: 0.07, gain: 0.14, hp: 2200 }); },
  slice(){ hiss({ dur: 0.2, gain: 0.3, hp: 700, sweep: 5200 }); },
  thud(){ blip({ freq: 180, to: 60, dur: 0.22, type: 'sine', gain: 0.42 });
          hiss({ dur: 0.1, gain: 0.18, hp: 220 }); },
  buzz(){ blip({ freq: 160, to: 90, dur: 0.3, type: 'sawtooth', gain: 0.26 }); },
  gold(){ [0,0.07,0.14,0.21].forEach((d,i) =>
            blip({ freq: 660 * Math.pow(2, i/4), dur: 0.2, type:'triangle', gain:0.28, delay:d })); },
  count(n){ blip({ freq: n > 0 ? 520 : 880, dur: n > 0 ? 0.14 : 0.3,
                   type:'triangle', gain: 0.34 }); },
  fanfare(){ [0,4,7,12].forEach((s,i) =>
               blip({ freq: 392 * Math.pow(2, s/12), dur: 0.5, type:'triangle',
                      gain: 0.26, delay: i * 0.1 })); },
  lose(){ [0,-2,-5].forEach((s,i) =>
            blip({ freq: 330 * Math.pow(2, s/12), dur: 0.42, type:'sawtooth',
                   gain:0.2, delay:i*0.13 })); },
  whoosh(){ hiss({ dur: 0.3, gain: 0.18, hp: 300, sweep: 2600 }); }
};

/* A two-bar groove built from a pentatonic bass line and a sparse top. One
   loop with an intensity knob rather than two tracks: menus sit at 0, a round
   pushes it up, so the change is felt without a crossfade. */
const SCALE = [0, 3, 5, 7, 10];
let loopTimer = null, step = 0, intensity = 0;

function voice(freq, dur, type, gain){
  const c = ctx(), t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + dur + 0.02);
}

export const music = {
  start(){
    if (loopTimer) return;
    ctx();
    const beat = 0.26;
    loopTimer = setInterval(() => {
      const s = step++ % 16;
      const root = 98;                                   /* G2 */
      if (s % 4 === 0) voice(root * Math.pow(2, SCALE[(s / 4) % 5] / 12), 0.34, 'triangle', 0.22);
      if (intensity > 0.3 && s % 2 === 1) hiss({ dur: 0.045, gain: 0.05 * intensity, hp: 6000 });
      if (intensity > 0.55 && (s === 4 || s === 12)) sfx.tick();
      if (intensity > 0.2 && s % 8 === 2){
        const n = SCALE[Math.floor(Math.random() * SCALE.length)];
        voice(392 * Math.pow(2, n / 12), 0.3, 'sine', 0.07 * intensity);
      }
    }, beat * 1000);
  },
  stop(){ clearInterval(loopTimer); loopTimer = null; },
  intensity(v){ intensity = Math.max(0, Math.min(1, v)); }
};

export const audio = {
  get volume(){ return state.vol; },
  get muted(){ return state.muted; },
  setVolume(v){ state.vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = state.muted ? 0 : state.vol; save(); },
  toggleMute(){ state.muted = !state.muted; if (master) master.gain.value = state.muted ? 0 : state.vol; save(); return state.muted; },
  resume(){ ctx(); }
};
