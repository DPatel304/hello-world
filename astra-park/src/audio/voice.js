/* Spoken lines, in the computer's own voices (the browser's speech
   synthesis - built into Windows, no download, works offline). For the
   games with someone to talk to the players: Last Known Position's ship's
   computer, Nova, and the robots.

   Each speaker has a voice: a woman's voice if the computer has one, at
   her own pitch and pace; the Warden, a man's, low and slow. A new line
   cuts off whatever's being said, unless it's `polite`, when it waits its
   turn. Quiet when the sound's muted, and nothing at all where there's no
   speech (in the tests). */
import { audio } from './sound.js';

/* Who's speaking: which voice they'd like (names to look for, in order),
   and how they say things. */
export const SPEAKERS = {
  captain: { want: ['aria', 'jenny', 'zira', 'samantha', 'female', 'woman', 'susan', 'hazel', 'libby'], pitch: 1.1, rate: 1.05 },
  warden: { want: ['guy', 'david', 'mark', 'male', 'daniel', 'george'], pitch: 0.3, rate: 0.8 }
};

const synth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;
const Utterance = () => (typeof window !== 'undefined' && window.SpeechSynthesisUtterance) || null;

function pick(who){
  const s = synth(), want = SPEAKERS[who].want;
  const voices = s ? s.getVoices().filter(v => /^en/i.test(v.lang)) : [];
  for (const w of want){ const v = voices.find(v => v.name.toLowerCase().includes(w)); if (v) return v; }
  return voices[0] || null;
}

/* About how long a line takes to say, in seconds: for timing scenes the
   same whether or not there's a voice to hear. */
export function lineTime(text, who = 'captain'){
  const words = text.trim().split(/\s+/).length;
  return 0.4 + words / (2.6 * SPEAKERS[who].rate);
}

export const voice = {
  /* Say text, as who. */
  say(text, who = 'captain', polite = false){
    const s = synth(), U = Utterance();
    if (!s || !U || audio.muted) return;
    if (!polite) s.cancel();
    const u = new U(text), sp = SPEAKERS[who];
    const v = pick(who);
    if (v) u.voice = v;
    u.pitch = sp.pitch; u.rate = sp.rate; u.volume = Math.min(1, audio.volume * 1.4);
    s.speak(u);
  },
  hush(){ const s = synth(); if (s) s.cancel(); }
};
