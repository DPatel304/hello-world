/* Spoken lines, in the computer's own voices (the browser's speech
   synthesis - built into Windows, no download, works offline). For the
   games with someone to talk to the players: Last Known Position's ship's
   computer, Nova, and the robots.

   Each speaker has a voice: Nova a woman's voice if the computer has one,
   at her own pitch and pace; the robots, a man's, low and slow. A new line
   cuts off whatever's being said, unless it's `polite`, when it waits its
   turn. Quiet when the sound's muted, and nothing at all where there's no
   speech (in the tests). */
import { audio } from './sound.js';

/* Who's speaking: which voices they'd like (names to look for, best
   first), and how they say things. The natural-sounding voices - Edge's
   "Natural" ones on Windows, Chrome's online Google ones - come first:
   far more human than the old built-in ones, which are the fallback. (A
   natural voice is said at its own pitch: nudging it sounds wrong.) */
export const SPEAKERS = {
  nova: { want: ['aria', 'jenny', 'ava', 'emma', 'michelle', 'sonia', 'libby', 'natasha', 'google uk english female', 'google us english', 'zira', 'samantha', 'female', 'woman', 'susan', 'hazel'], pitch: 1.1, rate: 1.05 },
  robot: { want: ['guy', 'andrew', 'christopher', 'ryan', 'google uk english male', 'david', 'mark', 'male', 'daniel', 'george'], pitch: 0.3, rate: 0.8 }
};

const synth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;
const Utterance = () => (typeof window !== 'undefined' && window.SpeechSynthesisUtterance) || null;

/* A natural (neural) voice? Edge names them "... Online (Natural) ...";
   Chrome's Google voices are online, and nearly as good. */
export const natural = (v) => /natural|online/i.test(v.name) || (/^google/i.test(v.name) && !v.localService);

/* The best voice for who: a natural one they'd like most, then a natural
   one of any name, then any they'd like, then any English one. */
export function pick(who, list = null){
  const s = synth(), want = SPEAKERS[who].want;
  const voices = (list || (s ? s.getVoices() : [])).filter(v => /^en/i.test(v.lang));
  const liked = (v) => { const n = v.name.toLowerCase(), k = want.findIndex(w => n.includes(w)); return k < 0 ? 99 : k; };
  const score = (v) => (natural(v) ? 0 : 1000) + liked(v) * 10 + (/en-(us|gb)/i.test(v.lang) ? 0 : 1);
  return voices.slice().sort((a, b) => score(a) - score(b))[0] || null;
}

/* About how long a line takes to say, in seconds: for timing scenes the
   same whether or not there's a voice to hear. */
export function lineTime(text, who = 'nova'){
  const words = text.trim().split(/\s+/).length;
  return 0.4 + words / (2.6 * SPEAKERS[who].rate);
}

/* The computer's voices arrive a moment after the browser starts - the
   natural ones last - so a line said straight away would get whatever old
   voice is there first, then the next one the good voice: two Novas. So
   they're asked for as soon as this loads (during the boot), a line waits
   up to WAIT seconds for a natural voice to turn up, and once a speaker has
   a natural voice they keep it. */
export const WAIT = 2.5;
const kept = {};
let ready = false, waiting = [], waitTimer = null;
const naturalHere = () => { const s = synth(); return !!s && s.getVoices().some(v => /^en/i.test(v.lang) && natural(v)); };
function settle(){
  if (ready) return;
  ready = true; clearTimeout(waitTimer);
  const go = waiting; waiting = [];
  go.forEach(f => f());
}
(function warm(){
  const s = synth(); if (!s) return;
  s.getVoices();
  const changed = () => { if (naturalHere()) settle(); };
  if (s.addEventListener) s.addEventListener('voiceschanged', changed); else s.onvoiceschanged = changed;
  if (naturalHere()) ready = true;
})();
/* The voice for who: theirs, once they have a natural one. */
function voiceFor(who){
  const s = synth(), all = s ? s.getVoices() : [];
  if (kept[who] && all.includes(kept[who])) return kept[who];
  const v = pick(who, all);
  if (v && natural(v)) kept[who] = v;
  return v;
}

export const voice = {
  /* Say text, as who. */
  say(text, who = 'nova', polite = false){
    const s = synth(), U = Utterance();
    if (!s || !U || audio.muted) return;
    const speak = () => {
      if (!polite) s.cancel();
      const u = new U(text), sp = SPEAKERS[who];
      const v = voiceFor(who);
      if (v) u.voice = v;
      /* (a natural voice at its own pitch; the robot always made low) */
      u.pitch = v && natural(v) && who !== 'robot' ? 1 : sp.pitch; u.rate = v && natural(v) ? Math.min(1, sp.rate) : sp.rate;
      u.volume = Math.min(1, audio.volume * 1.4);
      s.speak(u);
    };
    if (ready || naturalHere()){ ready = true; speak(); return; }
    /* not yet: wait for the good voice (or WAIT seconds, then the best there is) */
    if (!polite) waiting = [];
    waiting.push(speak);
    if (!waitTimer) waitTimer = setTimeout(settle, WAIT * 1000);
  },
  hush(){ waiting = []; const s = synth(); if (s) s.cancel(); }
};
