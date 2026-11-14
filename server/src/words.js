/* Words no Orlis Play game may have - anywhere: on screen, in the Store's
   text, even in the code's names and comments. Orlis Play's games are for
   young children. The same list is in the app (app/kit/creator/words.json:
   a test keeps them equal), where it's checked while Claude works, before a
   game is sent, and as a game draws its words on screen.

   A word is found however it's written: any capitals, joined in a name
   (killZone, kill_zone), or with numbers or signs for letters (k1ll, $hit).
   Change the list here and in words.json together. */
export const WORDS = [
  /* swearing */
  'fuck', 'fucking', 'fucker', 'fucked', 'shit', 'shitty', 'bullshit', 'bitch', 'bitches', 'cunt', 'dick', 'dickhead', 'cock',
  'pussy', 'ass', 'asshole', 'arse', 'arsehole', 'bastard', 'bollocks', 'wanker', 'wank', 'twat', 'prick', 'piss', 'pissed',
  'damn', 'goddamn', 'hell', 'crap', 'slut', 'whore', 'hoe', 'skank', 'douche', 'jerkoff', 'motherfucker', 'wtf', 'stfu',
  /* hate */
  'nigger', 'nigga', 'fag', 'faggot', 'retard', 'retarded', 'spic', 'chink', 'kike', 'gook', 'tranny', 'dyke', 'nazi', 'hitler',
  /* grown-up */
  'sex', 'sexy', 'porn', 'porno', 'nude', 'nudes', 'naked', 'boob', 'boobs', 'tits', 'penis', 'vagina', 'horny', 'stripper',
  'beer', 'vodka', 'whiskey', 'alcohol', 'drunk', 'cocaine', 'heroin', 'meth', 'marijuana', 'cigarette', 'vape', 'casino', 'gamble', 'gambling',
  /* hurting */
  'kill', 'kills', 'killed', 'killing', 'killer', 'murder', 'murdered', 'blood', 'bloody', 'gore', 'gun', 'guns', 'rifle', 'pistol',
  'shotgun', 'knife', 'knives', 'stab', 'stabbed', 'corpse', 'corpses', 'suicide', 'weapon', 'weapons', 'behead', 'torture', 'massacre',
  'slaughter', 'genocide', 'terrorist', 'horror'
];

/* The words in a piece of text, as the list sees them: each word whole
   (kiLLed is killed), and also split where a name joins words (killZone is
   kill and zone). */
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };
const plain = (t) => t.toLowerCase().replace(/[0134578@$!|]/g, c => LEET[c]).split(/[^a-z]+/).filter(Boolean);
export function wordsIn(text){
  /* (colours and hex numbers aren't words: #ff9a55 is no a55) */
  text = String(text).replace(/#[0-9a-fA-F]{3,8}\b|\b0[xX][0-9a-fA-F]+\b/g, ' ');
  return [...plain(text), ...plain(text.replace(/([a-z])([A-Z])/g, '$1 $2'))];
}

/* The listed words in a piece of text (each once), or none. */
const SET = new Set(WORDS);
export function badWords(text){
  const found = new Set();
  for (const w of wordsIn(text)) if (SET.has(w)) found.add(w);
  return [...found];
}
