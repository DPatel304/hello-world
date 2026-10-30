/* Every sound in Astra Park is made here. No files, no fetches: a handful of
   oscillators and a noise buffer, which also means the whole app works with
   the network unplugged. */
import { createSoundtrack } from './soundtrack.js';

let AC = null, master = null, musicGain = null;
let state = { vol: 0.7, muted: false };

try {
  const saved = JSON.parse(localStorage.getItem('astrapark_audio') || 'null');
  if (saved) state = { ...state, ...saved };
} catch (e) {}

/* Songs from the family's music folder, if the launcher found any. */
const songs = createSoundtrack({
  tracks: typeof window !== 'undefined' && Array.isArray(window.ASTRA_MUSIC) ? window.ASTRA_MUSIC : []
});

function save(){
  try { localStorage.setItem('astrapark_audio', JSON.stringify(state)); } catch (e) {}
}

let musicFilter = null, ukeBus = null, reverbIn = null;

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
    musicGain.gain.value = 0.6 * 0.5;
    /* Wide open normally; slow motion softens the top end. */
    musicFilter = AC.createBiquadFilter();
    musicFilter.type = 'lowpass'; musicFilter.frequency.value = 20000;
    musicGain.connect(musicFilter); musicFilter.connect(master);
    /* The ukulele's body: a little warmth low down, the harshest top taken
       off, the way a small wooden box colours a string. */
    ukeBus = AC.createGain();
    const body = AC.createBiquadFilter(), top = AC.createBiquadFilter();
    body.type = 'peaking'; body.frequency.value = 280; body.Q.value = 1; body.gain.value = 3;
    top.type = 'lowpass'; top.frequency.value = 5000;
    ukeBus.connect(body); body.connect(top); top.connect(musicGain);
    /* A small warm room rather than a hall. */
    const verb = AC.createConvolver(), verbOut = AC.createGain();
    verb.buffer = impulse(AC, 1.6);
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

/* The major pentatonic: steps that sound sweet in any order. */
const PENT = [0, 2, 4, 7, 9];

/* A streak nudges each pop's pitch up a little at a time. */
const lift = (combo) => Math.pow(2, Math.min(combo, 12) / 24);

/* A short burst of noise into the room, for a touch of space around a hit. */
function verbHit(amount){
  const c = ctx(), s = noise(), g = c.createGain(), t = c.currentTime;
  g.gain.setValueAtTime(amount, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  s.connect(g); g.connect(reverbIn); s.start(t); s.stop(t + 0.05);
}

export const sfx = {
  tick(){ blip({ freq: 1500, dur: 0.05, type: 'square', gain: 0.10 }); },
  /* A gentle, rounded bloop with the faintest click and a touch of room.
     size 0 is the smallest balloon, 1 the biggest - bigger is lower and
     longer; combo is how far into a streak it is. */
  pop(size = 0.5, combo = 0){
    const f = (560 - size * 300) * lift(combo);
    blip({ freq: f, to: f * 0.38, dur: 0.1 + size * 0.06, type: 'sine', gain: 0.32 });
    hiss({ dur: 0.012, gain: 0.08, hp: 3200, type: 'bandpass', q: 1.2 });
    verbHit(0.12);
  },
  /* ---- Firefly Night ---- */
  /* A firefly caught: a tiny high bell, climbing with each one held. */
  firefly(k = 0){
    bell(84 + PENT[k % 5], ctx().currentTime, 0.06, 0.45, master);
    hiss({ dur: 0.15, gain: 0.03, hp: 8000 });
  },
  /* Fireflies slipping free: a soft falling shimmer. */
  flyaway(){
    const t = ctx().currentTime;
    [0, 1, 2].forEach(i => bell(91 - i * 3, t + i * 0.06, 0.03, 0.5, master));
  },
  /* Into the jar: a glassy plink, stepping up as the jar fills. */
  jar(n = 1){
    bell(72 + PENT[n % 5] + 12 * Math.min(1, Math.floor(n / 5)), ctx().currentTime, 0.07, 0.35, master);
    blip({ freq: 2600, to: 2200, dur: 0.06, type: 'triangle', gain: 0.05 });
  },
  /* A full jar lifting away as a lantern: a warm rising swell and bells. */
  lantern(){
    hiss({ dur: 1.0, gain: 0.08, hp: 300, sweep: 2500 });
    const t = ctx().currentTime + 0.1;
    [0, 4, 7, 12, 16].forEach((s, i) => bell(72 + s, t + i * 0.12, 0.06, 0.6, master));
  },
  /* A firefly arriving in the sky as a star. */
  twinkle(){
    bell(96 + PENT[(Math.random() * 5) | 0], ctx().currentTime, 0.025, 0.6, master);
  },
  /* ---- Uncle B's Boat ---- */
  /* The hook going into the water. */
  plop(){ blip({ freq: 420, to: 160, dur: 0.14, type: 'sine', gain: 0.2 }); hiss({ dur: 0.1, gain: 0.04, hp: 1200, type: 'bandpass', q: 1 }); },
  /* A fish nibbling: a tiny tug on the line. */
  nibble(){ blip({ freq: 880, to: 700, dur: 0.06, type: 'sine', gain: 0.08 }); },
  /* A splash: a fish on, or out of the water. */
  splash(){ hiss({ dur: 0.35, gain: 0.12, hp: 900, sweep: -500, type: 'bandpass', q: 0.8 }); blip({ freq: 300, to: 140, dur: 0.18, type: 'sine', gain: 0.12 }); },
  /* The reel turning: one soft click. */
  reel(){ blip({ freq: 2200, dur: 0.018, type: 'square', gain: 0.025 }); },
  /* ---- Moon Bounce ---- */
  /* Floating back down onto the moon: a soft, low bump. */
  land(){
    blip({ freq: 150, to: 80, dur: 0.18, type: 'sine', gain: 0.18 });
    hiss({ dur: 0.15, gain: 0.04, hp: 400 });
  },
  /* ---- Fire Truck ---- */
  /* One note of the siren's two-tone, high or low: soft, not shrill. */
  siren(hi){ blip({ freq: hi ? 880 : 660, dur: 0.42, type: 'triangle', gain: 0.07 }); },
  /* The water landing: a short splashy hiss, called again and again. */
  spray(){ hiss({ dur: 0.16, gain: 0.035, hp: 1800, type: 'bandpass', q: 0.7 }); },
  /* A flame going out: a falling fizz and a little bell. */
  sizzle(){
    hiss({ dur: 0.5, gain: 0.08, hp: 2500, sweep: -1800 });
    bell(84, ctx().currentTime + 0.05, 0.04, 0.5, master);
  },
  meow(){
    blip({ freq: 700, to: 1050, dur: 0.18, type: 'triangle', gain: 0.12 });
    blip({ freq: 1050, to: 620, dur: 0.3, type: 'triangle', gain: 0.12, delay: 0.17 });
  },
  quack(){
    blip({ freq: 340, to: 260, dur: 0.14, type: 'sawtooth', gain: 0.06 });
    hiss({ dur: 0.12, gain: 0.03, hp: 900, type: 'bandpass', q: 3 });
  },
  /* Beep beep, on the way again. */
  honk(){
    [0, 0.22].forEach(d => {
      blip({ freq: 330, dur: 0.16, type: 'square', gain: 0.045, delay: d });
      blip({ freq: 415, dur: 0.16, type: 'square', gain: 0.035, delay: d });
    });
  },
  /* A job done: a bright run of bells. */
  hooray(){
    const t = ctx().currentTime;
    [0, 4, 7, 12, 16, 19].forEach((s, i) => bell(72 + s, t + i * 0.08, 0.06, 0.5, master));
  },
  /* A flower standing back up, a note higher each time. */
  bloom(k = 0){ bell(79 + PENT[k % 5], ctx().currentTime, 0.05, 0.5, master); },
  /* A glockenspiel run up through the chord. */
  rainbow(){
    const t = ctx().currentTime, ch = music.chord();
    [0, 1, 2, 3, 4, 5].forEach(i => bell(ch[i % 3] + 12 * (1 + Math.floor(i / 3)), t + i * 0.05, 0.09, 0.35, master));
    hiss({ dur: 0.5, gain: 0.05, hp: 7000 });
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
  /* A little marching fanfare on the glockenspiel, with a snare. */
  parade(){
    const t = ctx().currentTime;
    [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => bell(72 + s, t + i * 0.12, 0.08, 0.3, master));
    [0, 0.24, 0.48, 0.72].forEach(d => hiss({ dur: 0.08, gain: 0.14, hp: 1800, type: 'bandpass', q: 0.7, delay: d }));
  },
  /* A balloon joining a bouquet: a soft pluck, climbing through the chord. */
  gather(k = 0){
    const ch = music.chord().slice().sort((a, b) => a - b);
    pluck(ch[k % 3] + 12 + 12 * (Math.floor(k / 3) % 2), ctx().currentTime + 0.01,
          { kind: 'lead', gain: 0.16, verb: 0.3, dest: master });
  },
  /* Everyone lifting off: a rising whoosh into a bright strum and bells. */
  liftoff(){
    hiss({ dur: 1.2, gain: 0.14, hp: 300, sweep: 5000 });
    sfx.combo(3);
    const t = ctx().currentTime + 0.4, ch = music.chord();
    [0, 1, 2, 3, 4, 5].forEach(i => bell(ch[i % 3] + 24 + 12 * Math.floor(i / 3), t + i * 0.09, 0.07, 0.5, master));
  },
  /* The giraffe: the squeak of a twisted balloon, twice. */
  squeak(){
    const c = ctx();
    [0, 0.22].forEach(d => {
      const t = c.currentTime + d, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), w = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(850, t); o.frequency.linearRampToValueAtTime(1350, t + 0.1);
      o.frequency.linearRampToValueAtTime(1000, t + 0.18);
      lfo.frequency.value = 28; w.gain.value = 45; lfo.connect(w); w.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(master);
      o.start(t); lfo.start(t); o.stop(t + 0.22); lfo.stop(t + 0.22);
    });
  },
  /* The elephant: a trumpeting toot that rises and wavers. */
  trumpet(){
    const c = ctx(), t = c.currentTime;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), w = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.25);
    o.frequency.exponentialRampToValueAtTime(360, t + 0.7);
    lfo.frequency.value = 7; w.gain.value = 12; lfo.connect(w); w.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.08);
    g.gain.setValueAtTime(0.45, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); lfo.start(t); o.stop(t + 0.82); lfo.stop(t + 0.82);
    hiss({ dur: 0.3, gain: 0.06, hp: 1500, type: 'bandpass', q: 0.8 });
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
  /* The giant balloon: a deep thump under the ordinary pop. */
  boom(){
    blip({ freq: 110, to: 32, dur: 0.7, type: 'sine', gain: 0.6 });
    hiss({ dur: 0.45, gain: 0.35, hp: 900, type: 'lowpass', q: 0.5 });
  },
  /* A swoosh into a bright strummed chord, a step higher for each level. */
  combo(level = 1){
    hiss({ dur: 0.35, gain: 0.14, hp: 400, sweep: 5000 });
    const t = ctx().currentTime + 0.22, ch = music.chord().map(m => m + 12 + 2 * (level - 1));
    [...ch, ch[0] + 12].forEach((m, i) => pluck(m, t + i * 0.018, { kind: 'lead', gain: 0.3, verb: 0.25, dest: master }));
    bell(ch[0] + 24, t + 0.08, 0.08, 0.4, master);
  },
  slice(){ hiss({ dur: 0.2, gain: 0.3, hp: 700, sweep: 5200 }); },
  thud(){ blip({ freq: 180, to: 60, dur: 0.22, type: 'sine', gain: 0.42 });
          hiss({ dur: 0.1, gain: 0.18, hp: 220 }); },
  buzz(){ blip({ freq: 160, to: 90, dur: 0.3, type: 'sawtooth', gain: 0.26 }); },
  gold(){ [0,0.07,0.14,0.21].forEach((d,i) =>
            blip({ freq: 660 * Math.pow(2, i/4), dur: 0.2, type:'triangle', gain:0.28, delay:d })); },
  fanfare(){ [0,4,7,12].forEach((s,i) =>
               blip({ freq: 392 * Math.pow(2, s/12), dur: 0.5, type:'triangle',
                      gain: 0.26, delay: i * 0.1 })); },
  lose(){ [0,-2,-5].forEach((s,i) =>
            blip({ freq: 330 * Math.pow(2, s/12), dur: 0.42, type:'sawtooth',
                   gain:0.2, delay:i*0.13 })); },
  whoosh(){ hiss({ dur: 0.3, gain: 0.18, hp: 300, sweep: 2600 }); },
  /* Reactor Run's fights: a hit landing on metal, a shot, and a robot
     bursting into scrap. */
  clank(){ blip({ freq: 980, to: 640, dur: 0.09, type: 'square', gain: 0.08 }); hiss({ dur: 0.08, gain: 0.1, hp: 2500 }); },
  /* Something big winding up to hit: a rising growl. */
  windup(){ blip({ freq: 160, to: 420, dur: 0.7, type: 'sawtooth', gain: 0.08 }); },
  zap(){ blip({ freq: 1400, to: 300, dur: 0.18, type: 'square', gain: 0.07 }); hiss({ dur: 0.12, gain: 0.06, hp: 3000 }); },
  /* Falling asleep: a sleepy slide down. */
  yawn(){ blip({ freq: 520, to: 260, dur: 0.6, type: 'sine', gain: 0.14 }); blip({ freq: 390, to: 200, dur: 0.5, type: 'sine', gain: 0.08, delay: 0.25 }); },
  scrap(){ hiss({ dur: 0.45, gain: 0.26, hp: 200, sweep: -150 }); blip({ freq: 140, to: 40, dur: 0.3, type: 'sawtooth', gain: 0.16 }); },
  /* A war drum: the monsters are coming. The last beat is the big one. */
  drum(big = false){
    blip({ freq: big ? 110 : 95, to: 50, dur: big ? 0.5 : 0.32, type: 'sine', gain: big ? 0.6 : 0.45 });
    hiss({ dur: 0.12, gain: big ? 0.22 : 0.14, hp: 260, type: 'lowpass', q: 0.7 });
  },
  /* Hopped clean over something: a swish up and a bright ping. */
  dodge(){
    hiss({ dur: 0.22, gain: 0.16, hp: 500, sweep: 4000 });
    blip({ freq: 700, to: 1600, dur: 0.18, type: 'triangle', gain: 0.18, delay: 0.05 });
  },
  /* Somewhere picked to go to: a soft wooden tock. */
  pick(){ blip({ freq: 1100, to: 850, dur: 0.06, type: 'triangle', gain: 0.09 }); },
  /* The next kind of tower: click-clack. */
  flip(){ blip({ freq: 700, dur: 0.06, type: 'triangle', gain: 0.18 }); blip({ freq: 1050, dur: 0.08, type: 'triangle', gain: 0.18, delay: 0.08 }); },
  /* Got the hang of something: a little rising chime. */
  learnt(){ [0, 4, 7, 12, 16].forEach((st, i) => blip({ freq: 523 * Math.pow(2, st / 12), dur: 0.3, type: 'sine', gain: 0.16, delay: i * 0.07 })); },
  /* The console turning on: a soft swell up into a bright bell chord -
     the same every time, so it becomes the sound of Astra Park. */
  boot(){
    hiss({ dur: 1.1, gain: 0.05, hp: 300, sweep: 3200, type: 'bandpass', q: 0.6 });
    [0, 7, 12, 16, 19, 24].forEach((st, i) => blip({ freq: 262 * Math.pow(2, st / 12), dur: 1.4 - i * 0.12, type: i < 2 ? 'triangle' : 'sine', gain: 0.12, delay: 0.35 + i * 0.09 }));
  },
  /* Moving along the shelf. */
  nav(){ blip({ freq: 520, to: 640, dur: 0.07, type: 'sine', gain: 0.1 }); hiss({ dur: 0.08, gain: 0.03, hp: 2400 }); },
  /* Into a game, or a choice made. */
  select(){ blip({ freq: 660, dur: 0.1, type: 'triangle', gain: 0.16 }); blip({ freq: 990, dur: 0.16, type: 'triangle', gain: 0.14, delay: 0.07 }); hiss({ dur: 0.4, gain: 0.08, hp: 400, sweep: 3000 }); },
  /* Back out again. */
  back(){ blip({ freq: 700, to: 420, dur: 0.14, type: 'triangle', gain: 0.12 }); },
  /* A pennant flying up at the end, each a step higher. */
  pennant(k = 0){ const st = PENT[k % 5] + 12 * Math.floor(k / 5 % 3); blip({ freq: 392 * Math.pow(2, st / 12), dur: 0.22, type: 'triangle', gain: 0.16 }); }
};

/* ---------- music ----------
   A cozy acoustic song in C: ukulele, a plucked bass, a whistled tune, and
   hand percussion. The strings are Karplus-Strong - a burst of noise fed
   round a delay line one string-length long, softened a little each time
   round - which is how a plucked string actually behaves, and why it sounds
   like wood and nylon rather than a beeping chip.

   The song runs verse, chorus, verse, chorus, bridge, chorus, about a
   minute and a half before it comes round. A look-ahead scheduler books
   notes against the audio clock, so the beat holds when a frame stalls.

   intensity (0..1) decides who is playing, and how loud. A round opens on
   quiet fingerpicking; strumming and bass join, then shaker, the tune, finger
   snaps, the cajon, a whistle, tambourine and glockenspiel, roughly a layer a
   minute; the storm doubles the strumming and moves everything up a whole
   tone. Events lay their own parts on top: glockenspiel and a marching snare
   for the parade, bells and fingerpicking for slow motion. */
const BPM = 104, SIXTEENTH = 60 / BPM / 4;

/* Ukulele shapes in its re-entrant GCEA tuning, listed in the order a down
   strum meets the strings; a bass root; and the triad pops are drawn from. */
const CH = {
  C:  { uke: [67, 60, 64, 72], root: 36, tri: [60, 64, 67] },
  G:  { uke: [67, 62, 67, 71], root: 43, tri: [55, 59, 62] },
  Am: { uke: [69, 60, 64, 69], root: 45, tri: [57, 60, 64] },
  F:  { uke: [69, 60, 65, 69], root: 41, tri: [53, 57, 60] },
  Em: { uke: [67, 64, 67, 71], root: 40, tri: [52, 55, 59] }
};

/* [sixteenth, midi note, length in sixteenths], one row per bar. */
const SECTIONS = {
  /* Verse. */
  A: { chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'], melody: [
    [[0,76,2],[2,76,1],[3,79,3],[6,81,2],[8,79,2],[10,76,2],[12,72,2],[14,74,2]],
    [[0,74,2],[2,74,1],[3,79,3],[6,79,2],[8,83,2],[10,81,2],[12,79,4]],
    [[0,76,2],[2,76,1],[3,81,3],[6,84,2],[8,83,2],[10,81,2],[12,79,2],[14,76,2]],
    [[0,77,2],[2,77,1],[3,76,3],[6,74,2],[8,72,4],[12,74,4]],
    [[0,84,3],[3,84,3],[6,83,2],[8,84,2],[10,79,2],[12,76,4]],
    [[0,83,3],[3,83,3],[6,81,2],[8,79,2],[10,74,2],[12,79,4]],
    [[0,81,2],[2,84,2],[4,88,2],[6,86,2],[8,84,2],[10,81,2],[12,84,4]],
    [[0,81,2],[2,79,2],[4,77,2],[6,76,2],[8,74,2],[10,76,2],[12,79,2],[14,83,2]]
  ] },
  /* Chorus: long notes reaching up. */
  B: { chords: ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'], melody: [
    [[0,81,4],[4,84,4],[8,81,2],[10,79,2],[12,77,4]],
    [[0,79,4],[4,83,4],[8,86,4],[12,83,4]],
    [[0,79,3],[3,76,3],[6,79,2],[8,83,4],[12,79,4]],
    [[0,81,6],[6,79,2],[8,76,4],[12,72,4]],
    [[0,77,2],[2,81,2],[4,84,4],[8,86,2],[10,84,2],[12,81,4]],
    [[0,83,4],[4,86,4],[8,91,4],[12,88,4]],
    [[0,88,6],[6,86,2],[8,84,4],[12,79,4]],
    [[0,84,8],[12,79,2],[14,83,2]]
  ] },
  /* Bridge: call and answer. */
  C: { chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'], melody: [
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
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

let loopTimer = null, nextT = 0, pos = 0, intensity = 0;
let key = 0, dreamUntil = 0, paradeUntil = 0;

function at(p){
  const sec = SECTIONS[SONG[Math.floor(p / 128) % SONG.length]], bar = Math.floor(p / 16) % 8;
  return { sec, bar, s: p % 16, ch: CH[sec.chords[bar]] };
}

/* ---- plucked strings ---- */

/* loss: how much is kept each trip round the string - higher rings longer.
   soft: how hard the excitation is smoothed - a thumb rather than a pick. */
const STRINGS = {
  uke:  { secs: 1.6, loss: 0.996, soft: 0.5 },
  lead: { secs: 1.6, loss: 0.998, soft: 0.65 },
  bass: { secs: 1.6, loss: 0.998, soft: 0.2 }
};
const strings = new Map();

function stringBuffer(m, kind){
  const id = kind + m;
  if (strings.has(id)) return strings.get(id);
  const spec = STRINGS[kind], sr = AC.sampleRate;
  const n = Math.floor(sr * spec.secs), buf = AC.createBuffer(1, n, sr), d = buf.getChannelData(0);
  /* The averaging below adds half a sample of delay, so take it off here. */
  const N = Math.max(2, Math.round(sr / mtof(m) - 0.5)), line = new Float32Array(N);
  let lp = 0, mean = 0;
  for (let i = 0; i < N; i++){ lp += (Math.random() * 2 - 1 - lp) * spec.soft; line[i] = lp; mean += lp; }
  mean /= N;
  for (let i = 0; i < N; i++) line[i] -= mean;
  let i = 0, peak = 1e-6;
  for (let k = 0; k < n; k++){
    const a = line[i], b = line[i + 1 === N ? 0 : i + 1];
    d[k] = a;
    line[i] = spec.loss * (a + b) * 0.5;
    if (Math.abs(a) > peak) peak = Math.abs(a);
    i = i + 1 === N ? 0 : i + 1;
  }
  const tail = Math.min(800, n >> 2);
  for (let k = 0; k < n; k++) d[k] = d[k] / peak * (k > n - tail ? (n - k) / tail : 1);
  strings.set(id, buf);
  return buf;
}

function pluck(m, t, { kind = 'uke', gain = 0.2, dur = 0, verb = 0.15, dest = null } = {}){
  const c = ctx();
  const src = c.createBufferSource(), g = c.createGain();
  src.buffer = stringBuffer(m, kind);
  g.gain.setValueAtTime(gain, t);
  /* A hand coming down on the strings, for the shorter bass notes. */
  if (dur){ g.gain.setValueAtTime(gain, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08); }
  src.connect(g); g.connect(dest || ukeBus);
  if (verb){ const v = c.createGain(); v.gain.value = verb; g.connect(v); v.connect(reverbIn); }
  src.start(t); src.stop(t + (dur ? dur + 0.1 : STRINGS[kind].secs));
}

/* A strum is the four strings a few milliseconds apart; an up-strum meets
   them the other way round, lighter, and often misses the bottom string. */
function strum(ch, t, up, vel){
  const order = up ? [3, 2, 1] : [0, 1, 2, 3], gap = up ? 0.011 : 0.016;
  order.forEach((s, k) => pluck(ch.uke[s] + key, t + k * gap,
    { gain: vel * (up ? 0.6 : 1) * (0.85 + Math.random() * 0.3), verb: 0.12 }));
}

function bell(m, t, gain = 0.05, verb = 0.5, dest = null){
  tone(m, t, 1.4, { type: 'sine', gain, attack: 0.003, verb, dest });
  tone(m + 19, t, 0.4, { type: 'sine', gain: gain * 0.2, attack: 0.002, verb, dest });
}

/* A whistled note: sine, a slightly slow breath in, and a gentle wobble. */
function whistle(m, t, dur, gain){
  const o = AC.createOscillator(), g = AC.createGain(), lfo = AC.createOscillator(), depth = AC.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(mtof(m), t);
  lfo.frequency.value = 5.2; depth.gain.value = mtof(m) * 0.008;
  lfo.connect(depth); depth.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.06);
  g.gain.setValueAtTime(gain, t + Math.max(0.06, dur * 0.7));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  o.connect(g); g.connect(musicGain);
  const v = AC.createGain(); v.gain.value = 0.35; g.connect(v); v.connect(reverbIn);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
}

function tone(m, t, dur, { type = 'sine', gain = 0.1, attack = 0.008, verb = 0, dest = null } = {}){
  const o = ctx().createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(mtof(m), t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || musicGain);
  if (verb){ const v = AC.createGain(); v.gain.value = verb; g.connect(v); v.connect(reverbIn); }
  o.start(t); o.stop(t + dur + 0.02);
}

/* ---- hand percussion ---- */

function noiseHit(t, { dur, gain, freq, type = 'bandpass', q = 1, verb = 0 }){
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuffer(); s.loop = true;
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(musicGain);
  if (verb){ const v = AC.createGain(); v.gain.value = verb; g.connect(v); v.connect(reverbIn); }
  s.start(t); s.stop(t + dur + 0.02);
}
const shaker = (t, g) => noiseHit(t, { dur: 0.05, gain: g, freq: 6500, q: 0.8 });
const snap = (t) => noiseHit(t, { dur: 0.03, gain: 0.32, freq: 2600, q: 4, verb: 0.25 });
const tambourine = (t, g) => { for (const d of [0, 0.012, 0.03]) noiseHit(t + d, { dur: 0.09, gain: g, freq: 8000, type: 'highpass' }); };

/* The cajon: a wooden box, low thump in the middle and a slap at the edge. */
function cajonLow(t){
  const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
  g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.22);
  noiseHit(t, { dur: 0.05, gain: 0.12, freq: 400, type: 'lowpass' });
}
function cajonSlap(t, gain = 0.24){
  noiseHit(t, { dur: 0.1, gain, freq: 1900, q: 0.7, verb: 0.15 });
  tone(57, t, 0.06, { type: 'triangle', gain: gain * 0.4 });
}
function clap(t){
  for (const d of [0, 0.011, 0.023]) noiseHit(t + d, { dur: 0.03, gain: 0.24, freq: 1150, q: 1.2 });
  noiseHit(t + 0.03, { dur: 0.18, gain: 0.1, freq: 1150, q: 0.8, verb: 0.3 });
}

/* Strum pattern, on sixteenths: down, down-up, up-down-up. */
const STRUM = { 0: 'D', 4: 'D', 6: 'U', 10: 'U', 12: 'D', 14: 'U' };
/* Fingerpicking, on eighths: thumb on the C string, then up and across. */
const PICK = [1, 2, 3, 2, 0, 2, 3, 2];

function play(p, t){
  const { sec, bar, s, ch } = at(p), I = intensity;
  const dream = t < dreamUntil, parade = t < paradeUntil;
  const melody = sec.melody[bar].filter(([st]) => st === s);

  /* A very soft warm bed under it all. */
  if (s === 0 && I > 0.08) ch.tri.forEach(m => tone(m + key, t, SIXTEENTH * 16, { gain: 0.012, attack: 0.5, verb: 0.3 }));

  if (dream){
    /* Slow motion: fingerpicking at half the pace, bells, nothing else. */
    if (s % 4 === 0) pluck(ch.uke[PICK[s / 2]] + key, t, { gain: 0.2, verb: 0.4 });
    if (s % 8 === 0) pluck(ch.root + key, t, { kind: 'bass', gain: 0.35, dur: SIXTEENTH * 7 });
    for (const [, m] of melody) bell(m + key + 12, t, 0.045, 0.6);
    return;
  }

  /* Ukulele: fingerpicked while it's quiet, strummed once it gets going,
     double-time in the storm. */
  if (I < 0.25){
    if (s % 2 === 0) pluck(ch.uke[PICK[s / 2]] + key, t, { gain: 0.3, verb: 0.25 });
  } else if (I >= 0.97){
    strum(ch, t, s % 2 === 1, s % 4 === 0 ? 0.24 : 0.16);
  } else if (STRUM[s]){
    strum(ch, t, STRUM[s] === 'U', s % 4 === 0 ? 0.22 : 0.17);
  }

  /* Bass: roots on one and three, then a walking bounce. */
  if (I >= 0.12){
    const bounce = I >= 0.45 ? [0, 6, 8, 14] : [0, 8];
    if (bounce.includes(s)){
      const m = ch.root + key + (s === 6 || s === 14 ? 7 : 0);
      pluck(m, t, { kind: 'bass', gain: 0.42, dur: SIXTEENTH * (s % 8 === 0 ? 5 : 2), verb: 0.05 });
    }
  }

  if (I >= 0.3 && (s % 2 === 0 || I >= 0.7)) shaker(t, s % 4 === 2 ? 0.05 : 0.025);

  if (I >= 0.5 && I < 0.55 && (s === 4 || s === 12)) snap(t);
  if (I >= 0.55){
    if (s === 0 || s === 8 || s === 7) cajonLow(t);
    if (s === 4 || s === 12) cajonSlap(t);
    if (bar === 7 && s >= 12) cajonSlap(t, 0.12);
  }
  if (I >= 0.75 && (s === 4 || s === 12 || s % 4 === 2)) tambourine(t, s % 4 === 2 ? 0.025 : 0.04);
  if (I >= 0.97 && (s === 4 || s === 12)) clap(t);

  /* The tune: picked on the ukulele, whistled along with later, a
     glockenspiel sparkle on top near the end - and always for the parade. */
  if (I >= 0.4 || parade) for (const [, m, len] of melody){
    const dur = SIXTEENTH * len * 0.95;
    pluck(m + key, t, { kind: 'lead', gain: 0.3, verb: 0.2, dest: musicGain });
    if (I >= 0.65) whistle(m + key, t, dur, 0.05);
    if (I >= 0.85 || parade) bell(m + key + 12, t, 0.035, 0.3);
  }

  /* The parade's marching snare. */
  if (parade && [0, 2, 3, 4, 6, 8, 10, 11, 12, 14].includes(s)) cajonSlap(t, s % 4 === 0 ? 0.2 : 0.09);
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

const band = {
  start(){
    if (loopTimer) return;
    ctx();
    /* Build every string up front: a few dozen short buffers, cheaper now
       than as a hitch the first time each note is needed. */
    for (const c of Object.values(CH)){
      for (const k of [0, 2]){
        c.uke.forEach(m => stringBuffer(m + k, 'uke'));
        stringBuffer(c.root + k, 'bass'); stringBuffer(c.root + k + 7, 'bass');
      }
    }
    for (const sec of Object.values(SECTIONS))
      for (const row of sec.melody) for (const [, m] of row) for (const k of [0, 2]) stringBuffer(m + k, 'lead');
    nextT = AC.currentTime + 0.05;
    loopTimer = setInterval(schedule, 25);
  },
  stop(){ clearInterval(loopTimer); loopTimer = null; },
  /* Louder as well as fuller: the opening is meant to be quiet. */
  intensity(v){
    v = Math.max(0, Math.min(1, v));
    if (AC && musicGain && Math.abs(v - intensity) > 0.005)
      musicGain.gain.setTargetAtTime(0.6 * (0.45 + 0.55 * v), AC.currentTime, 0.8);
    intensity = v;
  },

  /* The next point on the song's grid, every `div` sixteenths, so a sound
     can land on the beat. Now, if the music isn't running. */
  grid(div = 1){
    if (!AC) return 0;
    const now = AC.currentTime + 0.004;
    if (!loopTimer) return now;
    const step = SIXTEENTH * div, base = nextT - (pos % div) * SIXTEENTH;
    return base + Math.ceil((now - base) / step) * step;
  },
  /* The triad sounding now, as MIDI notes in the current key. */
  chord(){ return at((pos + STEPS - 1) % STEPS).ch.tri.map(m => m + key); },

  /* Slow motion: percussion out, bells in, the top end softened, all of it
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

/* What the rest of the game talks to. With songs in the music folder it
   plays those - straight through, building in volume across a round, slowed
   like a tape for slow motion - and otherwise the generated band above. */
/* Home-screen ambience: slow, soft chords drifting under the menus, with a
   bell now and then - there, but never asking for attention. Quiet until
   lift() is asked for a moment. */
let ambT = null, ambStep = 0, ambLift = 0;
const AMB = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
export const ambience = {
  start(){
    if (ambT) return;
    ctx();
    const play = () => {
      if (!AC || state.muted) return;
      const t = AC.currentTime + 0.05, ch = AMB[ambStep++ % AMB.length], g = 0.018 + 0.02 * ambLift;
      ch.forEach((m, i) => tone(m - 12 + (i ? 12 : 0), t + i * 0.12, 4.2, { type: 'sine', gain: g, attack: 0.9, verb: 0.5, dest: master }));
      if (ambStep % 2) bell(ch[ambStep % 3] + 24, t + 1.2, 0.02 + 0.02 * ambLift, 0.6, master);
      ambLift = Math.max(0, ambLift - 0.5);
    };
    play(); ambT = setInterval(play, 3200);
  },
  stop(){ clearInterval(ambT); ambT = null; },
  lift(){ ambLift = 1; }
};

export const music = {
  start(){
    /* Quiet from the first note, rather than starting loud and sinking. */
    if (songs.available){ songs.setVolume(state.vol, state.muted); songs.level(0.3); songs.start(); }
    else band.start();
  },
  /* Fades the song out; the generated band just stops booking notes. */
  stop(){ songs.stop(1.2); band.stop(); },
  /* A song starts a round quietly - about 40% - and swells with the round
     to full volume for the balloon storm, the same arc the generated band
     follows by adding instruments. */
  intensity(v){
    if (songs.available) songs.level(0.3 + 0.7 * v);
    else band.intensity(v);
  },
  grid(div){ return band.grid(div); },
  chord(){ return band.chord(); },
  dream(secs){ if (songs.available) songs.slow(secs); else band.dream(secs); },
  parade(secs){ band.parade(secs); },
  get songs(){ return songs.available; },
  /* The <audio> element playing now, if any: a handle for checks. */
  get track(){ return songs.current; }
};

export const audio = {
  get volume(){ return state.vol; },
  get muted(){ return state.muted; },
  setVolume(v){ state.vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = state.muted ? 0 : state.vol; songs.setVolume(state.vol, state.muted); save(); },
  toggleMute(){ state.muted = !state.muted; if (master) master.gain.value = state.muted ? 0 : state.vol; songs.setVolume(state.vol, state.muted); save(); return state.muted; },
  resume(){ ctx(); }
};
