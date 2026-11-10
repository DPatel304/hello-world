/* Spoken lines, for the games with someone to talk to the players: Last
   Known Position's ship's computer, Nova, and the robots.

   Recorded first: the lines in voice-lines.js (made once with ElevenLabs,
   tools/record-voice.mjs, and shipped in the game - nothing's fetched),
   so she sounds the same, and human, every time. A line made of recorded
   sentences (the praise: "Blue, great dodging! Green, ...") is played a
   sentence after another. Anything else - a line written since, or one
   built on the fly - in the computer's own voices (the browser's speech
   synthesis - built into Windows, no download, works offline).

   Each speaker has a voice: Nova a woman's voice if the computer has one,
   at her own pitch and pace; the robots, a man's, low and slow. A new line
   cuts off whatever's being said, unless it's `polite`, when it waits its
   turn. Quiet when the sound's muted, and nothing at all where there's no
   speech (in the tests). */
import { audio, isQuiet } from './sound.js';
import { LINES } from './voice-lines.js';

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

/* The recordings, on or off. Off for now, while the script's being
   reworked: every line in the computer's own voice, new ones and old
   alike, so she doesn't change voice from line to line. */
export const RECORDED = { on: false };

/* The recordings that say text: the line's own, or one for each of its
   sentences - or null, when it isn't all recorded. */
export function clipsFor(text, lines = LINES){
  const t = text.trim();
  if (lines[t]) return [lines[t]];
  const parts = t.split(/(?<=[.!?])\s+/);
  if (parts.length < 2) return null;
  const clips = parts.map(p => lines[p]);
  return clips.every(Boolean) ? clips : null;
}

/* GAP: the breath between sentences played one after another. */
const GAP = 0.15;

/* About how long a line takes to say, in seconds: for timing scenes the
   same whether or not there's a voice to hear - the recording's own
   length when there is one. */
export function lineTime(text, who = 'nova'){
  const clips = RECORDED.on ? clipsFor(text) : null;
  if (clips) return clips.reduce((n, c) => n + c.secs, 0) + GAP * (clips.length - 1) + 0.2;
  const words = text.trim().split(/\s+/).length;
  /* (and the pauses the voice takes: at a dash or a trailing-off, and between sentences) */
  const pauses = (text.match(/\u2014|\.\.\.|\u2026/g) || []).length * 0.35 + (text.trim().split(/(?<=[.!?])\s+/).length - 1) * 0.2;
  return 0.4 + words / (2.6 * SPEAKERS[who].rate) + pauses;
}

/* ---------- the recordings ---------- */

const Player = () => (typeof window !== 'undefined' && window.Audio) || (typeof Audio !== 'undefined' ? Audio : null);
/* now: what's playing; later: the lines waiting their turn (polite). */
let now = null, later = [];
/* Play clips, one after another; then whatever's waiting. */
function play(clips){
  const A = Player(); if (!A) return;
  const job = { clips, k: 0, el: null, gap: null };
  now = job;
  const next = () => {
    if (now !== job) return;
    if (job.k >= clips.length){ now = null; const w = later.shift(); if (w) w(); return; }
    const el = job.el = new A('data:audio/mpeg;base64,' + clips[job.k++].mp3);
    el.volume = Math.min(1, audio.volume * 1.4);
    el.onended = () => { job.gap = setTimeout(next, GAP * 1000); };
    el.onerror = () => next();
    const p = el.play && el.play();
    if (p && p.catch) p.catch(() => {});
  };
  next();
}
function stopClips(){
  later = [];
  if (!now) return;
  const job = now; now = null;
  clearTimeout(job.gap);
  if (job.el){ job.el.onended = job.el.onerror = null; job.el.pause && job.el.pause(); }
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
    if (audio.muted || isQuiet()) return;
    const clips = RECORDED.on ? clipsFor(text) : null;
    if (clips && Player()){
      if (polite && now){ later.push(() => play(clips)); return; }
      voice.hush(); play(clips); return;
    }
    const s = synth(), U = Utterance();
    if (!s || !U) return;
    if (!polite) stopClips();
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
  hush(){ stopClips(); waiting = []; const s = synth(); if (s) s.cancel(); },
  /* Whether anything's being said, or about to be: a recording, a line
     waiting for its voice, or the computer still speaking - so a radio
     can let her finish before her next line, however long the computer's
     voice takes over it. */
  get speaking(){ const sy = synth(); return !!now || waiting.length > 0 || !!(sy && (sy.speaking || sy.pending)); },
  /* Whether a recording's playing. */
  get playing(){ return !!now; }
};
