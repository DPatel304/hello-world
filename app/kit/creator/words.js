/* Finding the words no Orlis Play game may have (words.json - the same
   list as the server's, server/src/words.js). Used by Orlis Play's checks
   (ui/creator-kit.js) and, inside a running game, by the runtime: every
   word a game draws on screen goes through it first. */
import WORDS from './words.json' with { type: 'json' };

const SET = new Set(WORDS);
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };
const plain = (t) => t.toLowerCase().replace(/[0134578@$!|]/g, c => LEET[c]).split(/[^a-z]+/).filter(Boolean);

/* each word whole (kiLLed is killed), and split where a name joins words
   (killZone is kill and zone); numbers and signs for letters too (k1ll) */
export function wordsIn(text){
  /* (colours and hex numbers aren't words: #ff9a55 is no a55) */
  text = String(text).replace(/#[0-9a-fA-F]{3,8}\b|\b0[xX][0-9a-fA-F]+\b/g, ' ');
  return [...plain(text), ...plain(text.replace(/([a-z])([A-Z])/g, '$1 $2'))];
}
export function badWords(text){
  const found = new Set();
  for (const w of wordsIn(text)) if (SET.has(w)) found.add(w);
  return [...found];
}

/* A line of text as it may be shown: a word on the list, and the whole line
   is stars - and so is a line spelling one out with gaps (k i l l). */
export function clean(text){
  const s = String(text);
  if (badWords(s).length || badWords(s.replace(/[\s._\-*]+/g, '')).length) return '★'.repeat(Math.min(12, Math.max(3, s.length)));
  return s;
}
