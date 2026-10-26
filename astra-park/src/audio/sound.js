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

let delaySend = null, musicFilter = null, padBus = null, reverbIn = null;

/* A room for the music to sit in: a burst of noise dying away over a couple
   of seconds is all a convolution reverb needs to sound like a hall. */
function impulse(c, secs){
  const n = Math.floor(c.sampleRate * secs), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++){
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.5);
  }
  return b;
}
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
    /* Wide open normally; slow motion softens the top end. */
    musicFilter = AC.createBiquadFilter();
    musicFilter.type = 'lowpass'; musicFilter.frequency.value = 20000;
    musicGain.connect(musicFilter); musicFilter.connect(master);
    /* Dotted-eighth echo on the lead only. */
    delaySend = AC.createDelay(1);
    delaySend.delayTime.value = SIXTEENTH * 3;
    const fb = AC.createGain(), wet = AC.createGain();
    fb.gain.value = 0.3; wet.gain.value = 0.28;
    delaySend.connect(fb); fb.connect(delaySend);
    delaySend.connect(wet); wet.connect(musicGain);
    /* The pad and chord stabs share a bus the kick can duck. */
    padBus = AC.createGain();
    padBus.connect(musicGain);
    const verb = AC.createConvolver(), verbOut = AC.createGain();
    verb.buffer = impulse(AC, 2.4);
    reverbIn = AC.createGain();
    verbOut.gain.value = 0.32;
    reverbIn.connect(verb); verb.connect(verbOut); verbOut.connect(musicGain);
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
     of the rubber and the low bloop of the air, both at once so the pop
     answers the hand, and a note from the chord the song is on, held to the
     next sixteenth so it lands on the beat. A streak climbs through the
     chord, so whatever the children do, it plays along. */
  pop(size = 0.5, combo = 0){
    hiss({ dur: 0.05, gain: 0.5, hp: 2800 - size * 1500, type: 'bandpass', q: 0.8 });
    const f = 780 - size * 430;
    blip({ freq: f, to: f * 0.35, dur: 0.09 + size * 0.06, type: 'sine', gain: 0.34 });
    const ch = music.chord().slice().sort((a, b) => a - b);
    const n = ch[combo % 3] + 24 + 12 * Math.min(1, Math.floor(combo / 3));
    const wait = Math.max(0.012, music.grid(1) - ctx().currentTime);
    blip({ freq: mtof(n), dur: 0.22, type: 'triangle', gain: 0.12, delay: wait });
  },
  rainbow(){
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
      blip({ freq: 1046.5 * Math.pow(2, s / 12), dur: 0.16, type: 'triangle', gain: 0.11, delay: i * 0.045 }));
    hiss({ dur: 0.5, gain: 0.07, hp: 7000 });
  },
  /* A slap on the giant: a rubbery boing, a little higher each time. */
  boing(n = 1){
    const f = 150 * Math.pow(2, n / 6);
    blip({ freq: f, to: f * 1.9, dur: 0.22, type: 'triangle', gain: 0.32 });
    blip({ freq: f * 0.5, dur: 0.12, type: 'sine', gain: 0.25 });
  },
  /* Into slow motion: everything sags downward. */
  slowmo(){
    blip({ freq: 700, to: 70, dur: 1.0, type: 'sine', gain: 0.32 });
    blip({ freq: 1050, to: 105, dur: 1.0, type: 'triangle', gain: 0.1 });
  },
  /* And back out: the same sweep, quick and upward. */
  speedup(){
    blip({ freq: 90, to: 800, dur: 0.45, type: 'sine', gain: 0.28 });
    hiss({ dur: 0.4, gain: 0.12, hp: 500, sweep: 4000 });
  },
  /* A little marching fanfare. */
  parade(){
    [0, 4, 7, 12, 7, 12, 16].forEach((s, i) =>
      blip({ freq: 523.25 * Math.pow(2, s / 12), dur: i === 6 ? 0.4 : 0.13,
             type: 'square', gain: 0.07, delay: i * 0.12 }));
    [0, 0.24, 0.48, 0.72].forEach(d => hiss({ dur: 0.08, gain: 0.18, hp: 1800, type: 'bandpass', q: 0.7, delay: d }));
  },
  /* Woof woof, on the beat. */
  bark(){
    const c = ctx(), on = Math.max(0, music.grid(2) - c.currentTime);
    [on, on + SIXTEENTH * 2].forEach((d) => {
      const t = c.currentTime + d;
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(170, t + 0.14);
      f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 1.6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.18);
      hiss({ dur: 0.05, gain: 0.12, hp: 1200, type: 'bandpass', q: 1, delay: d });
    });
  },
  /* Thunder for the storm: a crack, then a rumble rolling away. */
  thunder(delay = 0.3){
    const c = ctx(), t = c.currentTime + delay;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuffer(); s.loop = true;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(110, t + 2.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + 2.7);
    hiss({ dur: 0.12, gain: 0.25, hp: 2500, delay });
  },
  /* The giant balloon: a deep thump under the ordinary pop. */
  boom(){
    blip({ freq: 110, to: 32, dur: 0.7, type: 'sine', gain: 0.6 });
    hiss({ dur: 0.45, gain: 0.35, hp: 900, type: 'lowpass', q: 0.5 });
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
   A song in C, about ninety seconds before it comes round again: verse,
   chorus, verse, chorus, bridge, chorus. It is played by a look-ahead
   scheduler against the audio clock - a timer wakes every 25ms and books the
   next 120ms of notes at exact times - so the beat holds even when a frame
   stalls under the pose model.

   intensity (0..1) decides who is playing. The menu hears a pad and slow
   bass; a round starts at 0.45 with the groove and builds a layer roughly
   every minute; at full intensity the song moves up a whole tone for the
   storm. Events lay their own parts over the top: a marching snare and
   glockenspiel for the parade, a drumless, bell-washed version for slow
   motion. */
const BPM = 126, SIXTEENTH = 60 / BPM / 4;
const C_ = [48, 52, 55], G_ = [43, 47, 50], Am = [45, 48, 52], F_ = [41, 45, 48], Em = [40, 43, 47];

/* [sixteenth, midi note, length in sixteenths], one row per bar. */
const SECTIONS = {
  /* Verse: the original tune. */
  A: { chords: [C_, G_, Am, F_, C_, G_, Am, F_], melody: [
    [[0,76,2],[2,76,1],[3,79,3],[6,81,2],[8,79,2],[10,76,2],[12,72,2],[14,74,2]],
    [[0,74,2],[2,74,1],[3,79,3],[6,79,2],[8,83,2],[10,81,2],[12,79,4]],
    [[0,76,2],[2,76,1],[3,81,3],[6,84,2],[8,83,2],[10,81,2],[12,79,2],[14,76,2]],
    [[0,77,2],[2,77,1],[3,76,3],[6,74,2],[8,72,4],[12,74,4]],
    [[0,84,3],[3,84,3],[6,83,2],[8,84,2],[10,79,2],[12,76,4]],
    [[0,83,3],[3,83,3],[6,81,2],[8,79,2],[10,74,2],[12,79,4]],
    [[0,81,2],[2,84,2],[4,88,2],[6,86,2],[8,84,2],[10,81,2],[12,84,4]],
    [[0,81,2],[2,79,2],[4,77,2],[6,76,2],[8,74,2],[10,76,2],[12,79,2],[14,83,2]]
  ] },
  /* Chorus: IV V iii vi | IV V I I, long notes reaching up. */
  B: { chords: [F_, G_, Em, Am, F_, G_, C_, C_], melody: [
    [[0,81,4],[4,84,4],[8,81,2],[10,79,2],[12,77,4]],
    [[0,79,4],[4,83,4],[8,86,4],[12,83,4]],
    [[0,79,3],[3,76,3],[6,79,2],[8,83,4],[12,79,4]],
    [[0,81,6],[6,79,2],[8,76,4],[12,72,4]],
    [[0,77,2],[2,81,2],[4,84,4],[8,86,2],[10,84,2],[12,81,4]],
    [[0,83,4],[4,86,4],[8,91,4],[12,88,4]],
    [[0,88,6],[6,86,2],[8,84,4],[12,79,4]],
    [[0,84,8],[12,79,2],[14,83,2]]
  ] },
  /* Bridge: vi IV I V, call and answer. */
  C: { chords: [Am, F_, C_, G_, Am, F_, G_, G_], melody: [
    [[0,76,2],[2,81,2],[4,84,6],[12,83,2],[14,81,2]],
    [[0,77,4],[4,81,4],[8,77,8]],
    [[0,79,2],[2,84,2],[4,88,6],[12,86,2],[14,84,2]],
    [[0,83,8],[8,79,8]],
    [[0,81,2],[2,84,2],[4,88,4],[8,86,2],[10,84,2],[12,81,4]],
    [[0,81,4],[4,84,4],[8,89,8]],
    [[0,86,4],[4,83,4],[8,79,4],[12,83,4]],
    [[0,86,6],[8,83,2],[10,86,2],[12,91,4]]
  ] }
};
const SONG = ['A', 'B', 'A', 'B', 'C', 'B'];
const STEPS = SONG.length * 8 * 16;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* The note two scale steps below, for the harmony line. */
function thirdBelow(m){
  const pc = ((m % 12) + 12) % 12, i = MAJOR.indexOf(pc);
  if (i < 0) return m - 3;
  const j = (i + 5) % 7;
  return m - (pc - MAJOR[j] + (j > i ? 12 : 0));
}

let loopTimer = null, nextT = 0, pos = 0, intensity = 0;
let key = 0, dreamUntil = 0, paradeUntil = 0;

function at(p){
  const sec = SECTIONS[SONG[Math.floor(p / 128) % SONG.length]], bar = Math.floor(p / 16) % 8;
  return { sec, bar, s: p % 16, chord: sec.chords[bar].map(m => m + key) };
}

function tone(m, t, dur, { type = 'triangle', gain = 0.1, cutoff = 0, attack = 0.008, echo = false,
                           verb = 0, bus = null, detune = 0 } = {}){
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(mtof(m), t);
  if (detune) o.detune.value = detune;
  let head = o;
  if (cutoff){
    const f = AC.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff;
    o.connect(f); head = f;
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + Math.max(attack, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  head.connect(g); g.connect(bus || musicGain);
  if (echo) g.connect(delaySend);
  if (verb){ const v = AC.createGain(); v.gain.value = verb; g.connect(v); v.connect(reverbIn); }
  o.start(t); o.stop(t + dur + 0.02);
}

function drum(t, { dur, gain, freq, type = 'highpass', q = 1, verb = 0 }){
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuffer(); s.loop = true;
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(musicGain);
  if (verb){ const v = AC.createGain(); v.gain.value = verb; g.connect(v); v.connect(reverbIn); }
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
  /* The pad ducks under every kick and swells back: the pulse that makes it
     feel like it is breathing with the beat. */
  padBus.gain.setValueAtTime(0.35, t);
  padBus.gain.linearRampToValueAtTime(1, t + 0.24);
}

function snare(t, gain = 0.3){
  drum(t, { dur: 0.14, gain, freq: 1800, type: 'bandpass', q: 0.7, verb: 0.15 });
  tone(55, t, 0.08, { type: 'triangle', gain: gain * 0.4 });
}

/* Three quick slaps and a tail, the shape of a real clap. */
function clap(t){
  for (const d of [0, 0.011, 0.023]) drum(t + d, { dur: 0.03, gain: 0.28, freq: 1150, type: 'bandpass', q: 1.2 });
  drum(t + 0.03, { dur: 0.2, gain: 0.14, freq: 1150, type: 'bandpass', q: 0.8, verb: 0.3 });
}

/* Square plus a sine an octave down, through a filter that sweeps closed on
   every note once the song is in full flow. */
function bass(m, t, dur, sweep){
  const f = AC.createBiquadFilter(), g = AC.createGain();
  f.type = 'lowpass'; f.Q.value = sweep ? 6 : 1;
  f.frequency.setValueAtTime(sweep ? 2600 : 700, t);
  f.frequency.exponentialRampToValueAtTime(260, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.1, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [type, mm] of [['square', m], ['sine', m - 12]]){
    const o = AC.createOscillator();
    o.type = type; o.frequency.setValueAtTime(mtof(mm), t);
    o.connect(type === 'sine' ? g : f);
    o.start(t); o.stop(t + dur + 0.02);
  }
  f.connect(g); g.connect(musicGain);
}

function bell(m, t, gain = 0.05, verb = 0.6){
  tone(m, t, 1.4, { type: 'sine', gain, attack: 0.004, verb });
  tone(m + 19, t, 0.5, { type: 'sine', gain: gain * 0.25, attack: 0.002, verb });
}

function play(p, t){
  const { sec, bar, s, chord } = at(p), I = intensity;
  const root = chord[0], dream = t < dreamUntil, parade = t < paradeUntil;

  /* Pad: three detuned saws a voice, so it sounds wide rather than thin. */
  if (s === 0) chord.forEach(m => {
    for (const d of [-14, 0, 14]) tone(m + 12, t, SIXTEENTH * 16,
      { type: 'sawtooth', gain: dream ? 0.022 : 0.014, cutoff: dream ? 1600 : 1100, attack: 0.3, verb: 0.35, bus: padBus, detune: d });
  });

  if (dream){
    /* Slow motion: no drums, a low root, and bells drifting through the chord. */
    if (s % 8 === 0) tone(root - 12, t, SIXTEENTH * 8, { type: 'sine', gain: 0.16, attack: 0.05 });
    if (s % 2 === 0) bell(chord[(s / 2) % 3] + 24 + (s % 8 === 4 ? 12 : 0), t);
    return;
  }

  if (I < 0.25){
    if (s % 8 === 0) tone(root - 12, t, SIXTEENTH * 7, { gain: 0.2 });
  } else if (s % 2 === 0){
    bass(root - 12 + (s % 4 === 2 ? 12 : 0), t, SIXTEENTH * 1.8, I > 0.7);
  }

  if (I > 0.25 && s % 2 === 0) drum(t, { dur: 0.035, gain: s % 4 === 2 ? 0.06 : 0.035, freq: 7500 });
  if (I > 0.3){
    if (s % 4 === 0) kick(t);
    if (s % 4 === 2) chord.forEach(m => tone(m + 12, t, SIXTEENTH * 1.3,
      { type: 'square', gain: 0.026, cutoff: 1800, verb: 0.15, bus: padBus }));
  }

  if (I > 0.5){
    if (s === 4 || s === 12) clap(t);
    if (bar === 7 && s >= 12) snare(t, 0.16);
    for (const [st, m, len] of sec.melody[bar]){
      if (st !== s) continue;
      const dur = SIXTEENTH * len * 0.92;
      for (const d of [-8, 8]) tone(m + key, t, dur, { type: 'square', gain: 0.03, cutoff: 3200, echo: true, verb: 0.2, detune: d });
      tone(m + key + 12, t, dur, { type: 'triangle', gain: 0.02 });
      if (I > 0.85) tone(thirdBelow(m) + key, t, dur, { type: 'triangle', gain: 0.03, verb: 0.2 });
      if (parade) bell(m + key + 12, t, 0.04, 0.3);
    }
  }

  /* A shaker on every sixteenth, leaning on the off-beats. */
  if (I > 0.62) drum(t, { dur: 0.04, gain: s % 2 ? 0.035 : 0.018, freq: 9500 });
  /* A plucked arpeggio running through the chord. */
  if (I > 0.62 && (s % 2 === 0 || I > 0.95)) tone(chord[s % 3] + 24, t, SIXTEENTH * 1.6,
    { type: 'triangle', gain: 0.035, attack: 0.004, verb: 0.25 });
  if (I > 0.7 && bar === 0 && s === 0) drum(t, { dur: 1.6, gain: 0.08, freq: 6000, verb: 0.3 });
  if (I > 0.8 && s % 4 === 2) drum(t, { dur: 0.14, gain: 0.04, freq: 6000 });

  /* The parade's marching snare: a drum-corps cadence over everything. */
  if (parade && [0, 2, 3, 4, 6, 8, 10, 11, 12, 14].includes(s)) snare(t, s % 4 === 0 ? 0.2 : 0.1);
}

function schedule(){
  if (!AC) return;
  /* After a long stall (a backgrounded tab) skip ahead rather than firing a
     burst of overdue notes all at once. */
  if (nextT < AC.currentTime - 0.2) nextT = AC.currentTime + 0.05;
  while (nextT < AC.currentTime + 0.12){
    /* Key changes wait for the start of a four-bar phrase. */
    if (pos % 64 === 0) key = intensity >= 0.97 ? 2 : 0;
    play(pos, nextT);
    nextT += SIXTEENTH;
    pos = (pos + 1) % STEPS;
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
  intensity(v){ intensity = Math.max(0, Math.min(1, v)); },

  /* The next point on the song's grid, every `div` sixteenths, so a sound
     can land on the beat. Now, if the music isn't running. */
  grid(div = 1){
    if (!AC) return 0;
    const now = AC.currentTime + 0.004;
    if (!loopTimer) return now;
    const step = SIXTEENTH * div, base = nextT - (pos % div) * SIXTEENTH;
    return base + Math.ceil((now - base) / step) * step;
  },
  /* The chord sounding now, as MIDI notes in the current key. */
  chord(){ return at((pos + STEPS - 1) % STEPS).chord; },

  /* Slow motion: drums out, bells in, the top end softened, all of it
     booked on the audio clock so it ends itself even if the round does
     first. */
  dream(secs){
    if (!AC) return;
    const t = AC.currentTime, f = musicFilter.frequency;
    dreamUntil = t + secs;
    f.cancelScheduledValues(t);
    f.setValueAtTime(f.value, t);
    f.exponentialRampToValueAtTime(2400, t + 0.4);
    f.setValueAtTime(2400, t + secs);
    f.exponentialRampToValueAtTime(20000, t + secs + 0.5);
  },
  parade(secs){ if (AC) paradeUntil = AC.currentTime + secs; }
};

export const audio = {
  get volume(){ return state.vol; },
  get muted(){ return state.muted; },
  setVolume(v){ state.vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = state.muted ? 0 : state.vol; save(); },
  toggleMute(){ state.muted = !state.muted; if (master) master.gain.value = state.muted ? 0 : state.vol; save(); return state.muted; },
  resume(){ ctx(); }
};
