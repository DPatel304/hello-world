/* Last Known Position's own music: tense and driving, in D minor at 140 -
   a pulsing bass, a hi-hat ticking like a clock, low drums, brass stabs,
   and over the boss a short, urgent theme. All made here with Web Audio,
   nothing recorded.

   It's booked a little ahead against the audio clock (book(from, to)) so
   the beat holds when a frame stalls. intensity (0..1, the game's mood)
   decides who plays:
     0      hushed: a dark pad, the clock ticking, a heartbeat kick
     0.2+   the bass pulse joins, muffled; the kick on 1 and 3
     0.4+   four on the floor, the bass opening up
     0.6+   the snare on 2 and 4, tom hits
     0.7+   brass stabs on each bar
     0.85+  snare rolls into each phrase, the clock in sixteenths
     0.95+  the boss theme over the top */
export const BPM = 140;
const S16 = 60 / BPM / 4, BAR = S16 * 16;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* Eight bars round: Dm Dm Bb C | Dm Dm Bb A - that last A pulling back
   to the D, over and over. */
const ROOTS = [38, 38, 34, 36, 38, 38, 34, 33];
const CHORDS = [[62, 65, 69], [62, 65, 69], [58, 62, 65], [60, 64, 67], [62, 65, 69], [62, 65, 69], [58, 62, 65], [57, 61, 64]];
/* The bass's sixteenths: root, octave, the fifth now and then. */
const BASS = [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 12, 0, 7, 0, 12, 10];
/* The boss theme, one row per bar: [sixteenth, midi, length]. */
const THEME = [
  [[0, 74, 3], [3, 74, 3], [6, 76, 2], [8, 77, 6], [14, 76, 2]],
  [[0, 74, 4], [4, 72, 4], [8, 69, 8]],
  [[0, 70, 3], [3, 70, 3], [6, 72, 2], [8, 74, 6], [14, 72, 2]],
  [[0, 72, 4], [4, 76, 4], [8, 79, 8]],
  [[0, 81, 3], [3, 81, 3], [6, 79, 2], [8, 77, 4], [12, 76, 4]],
  [[0, 74, 4], [4, 77, 4], [8, 81, 8]],
  [[0, 82, 3], [3, 81, 3], [6, 79, 2], [8, 77, 4], [12, 74, 4]],
  [[0, 73, 6], [6, 76, 2], [8, 79, 4], [12, 81, 4]]
];

export function createAction(ac, dest){
  const out = ac.createGain(); out.gain.value = 0.9; out.connect(dest);
  /* A short echo for the brass and the theme. */
  const echo = ac.createDelay(1); echo.delayTime.value = S16 * 3;
  const fb = ac.createGain(); fb.gain.value = 0.28;
  const wet = ac.createGain(); wet.gain.value = 0.22;
  echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(out);
  let noise = null;
  const noiseBuf = () => {
    if (noise) return noise;
    const n = ac.sampleRate, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (noise = b);
  };

  /* An oscillator note: type, from t for dur, through a lowpass at cut,
     shaped by attack and release; sent to the echo too if wetK. */
  const note = (m, t, dur, { type = 'sawtooth', gain = 0.1, cut = 2000, attack = 0.005, rel = 0.08, detune = 0, wetK = 0, sweep = 0 } = {}) => {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = type; o.frequency.value = mtof(m); o.detune.value = detune;
    f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, cut * sweep), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + Math.max(attack, dur - rel)); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f); f.connect(g); g.connect(out); if (wetK){ const s = ac.createGain(); s.gain.value = wetK; g.connect(s); s.connect(echo); }
    o.start(t); o.stop(t + dur + 0.02);
  };
  const hit = (t, { hp = 7000, dur = 0.03, gain = 0.1, bp = false, q = 1 } = {}) => {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf(); f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = hp; f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  };
  const thump = (t, f0, f1, dur, gain) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  };
  const kick = (t, g = 0.5) => thump(t, 150, 42, 0.35, g);
  const tom = (t, g = 0.3) => { thump(t, 110, 70, 0.4, g); hit(t, { hp: 400, dur: 0.12, gain: g * 0.25, bp: true, q: 0.8 }); };
  const snare = (t, g = 0.18) => { hit(t, { hp: 1800, dur: 0.16, gain: g, bp: true, q: 0.6 }); thump(t, 220, 160, 0.1, g * 0.6); };
  /* The clock: a sharp, bright tick. */
  const tick = (t, g = 0.05) => { hit(t, { hp: 8000, dur: 0.025, gain: g }); note(96, t, 0.02, { type: 'square', gain: g * 0.25, cut: 9000, attack: 0.001, rel: 0.015 }); };

  /* Books the sixteenths from step p at time t. */
  function step(p, t, I){
    const s = p % 16, bar = Math.floor(p / 16) % 8, phrase = Math.floor(p / 128);
    const root = ROOTS[bar], ch = CHORDS[bar];
    /* The pad: the chord held through each bar, dark, always there. */
    if (s === 0) for (const m of ch) note(m - 12, t, BAR * 1.02, { type: 'sawtooth', gain: 0.018 + 0.01 * I, cut: 500 + 900 * I, attack: 0.4, rel: 0.3, detune: (m % 3 - 1) * 7 });
    /* The clock. */
    if (s % 4 === 0) tick(t, s === 0 ? 0.06 : 0.045);
    else if (s % 2 === 0 && I >= 0.35) tick(t, 0.03);
    else if (I >= 0.85) tick(t, 0.018);
    /* Hushed: a heartbeat for a kick. */
    if (I < 0.2 && (s === 0 || s === 3)) kick(t, s ? 0.18 : 0.26);
    /* The bass pulse. */
    if (I >= 0.2){
      const m = root + BASS[s];
      note(m, t, S16 * 0.9, { type: 'sawtooth', gain: 0.07 + 0.04 * I, cut: 300 + 1500 * Math.max(0, I - 0.2), attack: 0.003, rel: 0.04 });
      note(m - 12, t, S16 * 0.9, { type: 'square', gain: 0.05, cut: 220, attack: 0.003, rel: 0.04 });
    }
    /* The kick. */
    if (I >= 0.4 ? s % 4 === 0 : I >= 0.2 && s % 8 === 0) kick(t, 0.5);
    /* Snare, toms. */
    if (I >= 0.6){
      if (s === 4 || s === 12) snare(t);
      if (s === 10 || (s === 14 && bar % 2)) tom(t, 0.22);
    }
    if (I >= 0.85 && bar === 7 && s >= 8) snare(t, 0.06 + (s - 8) * 0.015);
    /* Brass stabs: 1, the "and" of 2, 4 - the chord, hard. */
    if (I >= 0.7 && (s === 0 || s === 6 || s === 12) && !(bar % 4 === 3 && s === 12)){
      const len = s === 12 ? S16 * 3 : S16 * 1.6;
      for (const m of ch) for (const d of [-9, 9]) note(m, t, len, { type: 'sawtooth', gain: 0.03, cut: 2600, sweep: 0.35, attack: 0.01, rel: 0.06, detune: d, wetK: 0.5 });
      note(ch[0] - 12, t, len, { type: 'sawtooth', gain: 0.04, cut: 1400, sweep: 0.4, attack: 0.01, rel: 0.06, wetK: 0.3 });
    }
    /* Into the next phrase: a rising swell under the last bar. */
    if (I >= 0.5 && bar === 7 && s === 0) hitSwell(t);
    /* The boss theme, on the second time round each phrase pair. */
    if (I >= 0.95 && phrase % 2 === 1) for (const [at, m, len] of THEME[bar]) if (at === s){
      note(m, t, S16 * len, { type: 'square', gain: 0.045, cut: 3200, attack: 0.01, rel: 0.08, wetK: 0.6 });
      note(m, t, S16 * len, { type: 'sawtooth', gain: 0.03, cut: 2400, attack: 0.01, rel: 0.08, detune: 12, wetK: 0.6 });
    }
  }
  const hitSwell = (t) => {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf(); s.loop = true; f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(6000, t + BAR);
    g.gain.setValueAtTime(0.0008, t); g.gain.exponentialRampToValueAtTime(0.07, t + BAR * 0.97); g.gain.linearRampToValueAtTime(0, t + BAR);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + BAR + 0.02);
  };

  let pos = 0, nextT = null;
  return {
    out,
    /* Book everything due before `until` (audio time); I, or a function of
       the time, for the intensity. */
    book(until, I){
      if (nextT == null) nextT = ac.currentTime + 0.05;
      while (nextT < until){
        step(pos, nextT, typeof I === 'function' ? I(nextT) : I);
        pos++; nextT += S16;
      }
    },
    reset(){ pos = 0; nextT = null; }
  };
}
