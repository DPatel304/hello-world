/* Every sound in Astra Park is made here. No files, no fetches: a handful of
   oscillators and a noise buffer, which also means the whole app works with
   the network unplugged. */
let AC = null, master = null, musicGain = null;
let state = { vol: 0.7, muted: false };

try {
  const saved = JSON.parse(localStorage.getItem('astrapark_audio') || 'null');
  if (saved) state = { ...state, ...saved };
} catch (e) {}

function save(){
  try { localStorage.setItem('astrapark_audio', JSON.stringify(state)); } catch (e) {}
}

let delaySend = null;
function ctx(){
  if (!AC){
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = state.muted ? 0 : state.vol;
    /* A full band plus a flurry of pops can stack past full scale; the
       compressor rounds that off instead of letting it crackle. */
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    master.connect(comp); comp.connect(AC.destination);
    musicGain = AC.createGain();
    musicGain.gain.value = 0.6;
    musicGain.connect(master);
    /* Dotted-eighth echo on the lead only. */
    delaySend = AC.createDelay(1);
    delaySend.delayTime.value = SIXTEENTH * 3;
    const fb = AC.createGain(), wet = AC.createGain();
    fb.gain.value = 0.3; wet.gain.value = 0.28;
    delaySend.connect(fb); fb.connect(delaySend);
    delaySend.connect(wet); wet.connect(musicGain);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

let noiseBuf = null;
function noiseBuffer(){
  const c = ctx();
  if (!noiseBuf){
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function noise(){
  const s = ctx().createBufferSource(); s.buffer = noiseBuffer(); return s;
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

function hiss({ dur = 0.18, gain = 0.25, hp = 900, delay = 0, sweep = 0, type = 'highpass', q = 1 }){
  const c = ctx(), t = c.currentTime + delay;
  const s = noise(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(hp, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, hp + sweep), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}

export const sfx = {
  tick(){ blip({ freq: 1500, dur: 0.05, type: 'square', gain: 0.10 }); },
  /* size 0 is the smallest balloon, 1 the biggest. Three layers: the crack
     of the rubber, the low bloop of the air, and a note that climbs the
     song's scale with the combo so a streak plays a little tune. */
  pop(size = 0.5, combo = 0){
    hiss({ dur: 0.05, gain: 0.5, hp: 2800 - size * 1500, type: 'bandpass', q: 0.8 });
    const f = 780 - size * 430;
    blip({ freq: f, to: f * 0.35, dur: 0.09 + size * 0.06, type: 'sine', gain: 0.34 });
    const n = PENTA[combo % 5] + 12 * Math.min(2, Math.floor(combo / 5));
    blip({ freq: 523.25 * Math.pow(2, n / 12), dur: 0.22, type: 'triangle', gain: 0.12, delay: 0.012 });
  },
  rainbow(){
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
      blip({ freq: 1046.5 * Math.pow(2, s / 12), dur: 0.16, type: 'triangle', gain: 0.11, delay: i * 0.045 }));
    hiss({ dur: 0.5, gain: 0.07, hp: 7000 });
  },
  /* A rising swoosh into a bright chord, a step higher for each level. */
  combo(level = 1){
    hiss({ dur: 0.35, gain: 0.16, hp: 400, sweep: 5000 });
    const root = 523.25 * Math.pow(2, (2 * (level - 1)) / 12);
    [0, 4, 7, 12].forEach((s, i) =>
      blip({ freq: root * Math.pow(2, s / 12), dur: 0.42, type: 'square', gain: 0.07, delay: 0.22 + i * 0.03 }));
  },
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

/* ---------- music ----------
   A bouncy eight-bar tune in C over I-V-vi-IV, played by a look-ahead
   scheduler against the audio clock: a timer wakes every 25ms and books the
   next 120ms of notes at exact times, so the beat holds even when a frame
   stalls under the pose model. The intensity knob adds instruments rather
   than changing the tune - the menu hears pad and bass, a round hears the
   whole band, the final seconds add a sparkle on top. */
const BPM = 126, SIXTEENTH = 60 / BPM / 4;
const PENTA = [0, 2, 4, 7, 9];
const CHORDS = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]];   /* C G Am F */

/* [sixteenth, midi note, length in sixteenths], one row per bar. */
const MELODY = [
  [[0,76,2],[2,76,1],[3,79,3],[6,81,2],[8,79,2],[10,76,2],[12,72,2],[14,74,2]],
  [[0,74,2],[2,74,1],[3,79,3],[6,79,2],[8,83,2],[10,81,2],[12,79,4]],
  [[0,76,2],[2,76,1],[3,81,3],[6,84,2],[8,83,2],[10,81,2],[12,79,2],[14,76,2]],
  [[0,77,2],[2,77,1],[3,76,3],[6,74,2],[8,72,4],[12,74,4]],
  [[0,84,3],[3,84,3],[6,83,2],[8,84,2],[10,79,2],[12,76,4]],
  [[0,83,3],[3,83,3],[6,81,2],[8,79,2],[10,74,2],[12,79,4]],
  [[0,81,2],[2,84,2],[4,88,2],[6,86,2],[8,84,2],[10,81,2],[12,84,4]],
  [[0,81,2],[2,79,2],[4,77,2],[6,76,2],[8,74,2],[10,76,2],[12,79,2],[14,83,2]]
];
const BARS = MELODY.length;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

let loopTimer = null, nextT = 0, pos = 0, intensity = 0;

function tone(m, t, dur, { type = 'triangle', gain = 0.1, cutoff = 0, attack = 0.008, echo = false } = {}){
  const c = AC;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(mtof(m), t);
  let head = o;
  if (cutoff){
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff;
    o.connect(f); head = f;
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + Math.max(attack, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  head.connect(g); g.connect(musicGain);
  if (echo) g.connect(delaySend);
  o.start(t); o.stop(t + dur + 0.02);
}

function drum(t, { dur, gain, freq, type = 'highpass', q = 1 }){
  const c = AC, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuffer();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(musicGain);
  s.start(t); s.stop(t + dur + 0.02);
}

function kick(t){
  const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.75, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + 0.3);
}

function snare(t, gain = 0.3){
  drum(t, { dur: 0.14, gain, freq: 1800, type: 'bandpass', q: 0.7 });
  tone(55, t, 0.08, { type: 'triangle', gain: gain * 0.4 });
}

function play(p, t){
  const bar = Math.floor(p / 16), s = p % 16, ch = CHORDS[bar % 4], I = intensity;

  /* Pad: always there, so even the menu has a floor of warmth. */
  if (s === 0) ch.forEach(m => tone(m + 12, t, SIXTEENTH * 16, { type: 'sine', gain: 0.045, attack: 0.25 }));

  /* Bass: slow roots when calm, a bouncing octave line once things move. */
  if (I < 0.25){
    if (s % 8 === 0) tone(ch[0] - 12, t, SIXTEENTH * 7, { gain: 0.2 });
  } else if (s % 2 === 0){
    tone(ch[0] - 12 + (s % 4 === 2 ? 12 : 0), t, SIXTEENTH * 1.7,
         { type: 'square', gain: 0.085, cutoff: 650 });
  }

  if (I > 0.25 && s % 2 === 0) drum(t, { dur: 0.035, gain: s % 4 === 2 ? 0.06 : 0.035, freq: 7500 });
  if (I > 0.3){
    if (s % 4 === 0) kick(t);
    /* Off-beat chord stabs: the bounce in the groove. */
    if (s % 4 === 2) ch.forEach(m => tone(m + 12, t, SIXTEENTH * 1.3, { type: 'square', gain: 0.03, cutoff: 1800 }));
  }

  if (I > 0.6){
    if (s === 4 || s === 12) snare(t);
    if (s % 4 === 2) drum(t, { dur: 0.14, gain: 0.04, freq: 6000 });
    if (bar === BARS - 1 && s >= 12) snare(t, 0.18);
    for (const [at, m, len] of MELODY[bar]){
      if (at !== s) continue;
      const dur = SIXTEENTH * len * 0.92;
      tone(m, t, dur, { type: 'square', gain: 0.05, cutoff: 3200, echo: true });
      tone(m + 12, t, dur, { type: 'triangle', gain: 0.025 });
    }
  }

  /* The last seconds: sixteenth hats and a running arpeggio over the top. */
  if (I > 0.95){
    if (s % 2 === 1) drum(t, { dur: 0.025, gain: 0.03, freq: 9000 });
    tone(ch[s % 3] + 24, t, SIXTEENTH * 0.9, { type: 'square', gain: 0.018, cutoff: 2600 });
  }
}

function schedule(){
  if (!AC) return;
  /* After a long stall (a backgrounded tab) skip ahead rather than firing a
     burst of overdue notes all at once. */
  if (nextT < AC.currentTime - 0.2) nextT = AC.currentTime + 0.05;
  while (nextT < AC.currentTime + 0.12){
    play(pos, nextT);
    nextT += SIXTEENTH;
    pos = (pos + 1) % (16 * BARS);
  }
}

export const music = {
  start(){
    if (loopTimer) return;
    ctx();
    nextT = AC.currentTime + 0.05;
    loopTimer = setInterval(schedule, 25);
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
