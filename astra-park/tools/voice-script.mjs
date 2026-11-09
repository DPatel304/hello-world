/* Every line Last Known Position's speakers can say, for recording
   (record-voice.mjs) and for the test that checks nothing's missing.

   From the level data (lkp-levels.js: tips and scene lines), the lines
   written straight into the game (each `cap.say('...')` and the other
   quoted lines - found by reading the source, so a new line is picked up
   without touching this file), and the ones built from a template, each
   way it can come out. Lines are recorded a sentence at a time where a
   template joins sentences (the end-of-level praise), and voice.js puts
   them back together. */
import { readFileSync } from 'node:fs';
import { LEVELS } from '../src/games/lkp-levels.js';

const SRC = new URL('../src/games/', import.meta.url);
const NAMES = ['Blue', 'Orange', 'Green', 'Purple'];
const CHEERS = ['great dodging', 'amazing fighting', 'super running', 'brilliant teamwork'];
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);
/* (the Radio strips a "ksssh -" off the front: static, not words) */
export const spoken = (text) => text.replace(/^k+s+h+\s*[-—]\s*/i, '');

/* The quoted lines in a source file that she says: in a say( call, or in
   the lists of lines picked from (a sentence ending ! . or ?, a capital
   at the front). */
export function quoted(src){
  const out = [], str = /'((?:[^'\\\n]|\\.)*)'/g;
  for (const m of src.matchAll(str)){
    const t = m[1].replace(/\\'/g, '\'').replace(/\\u2014/g, '—');
    if (/^[A-Z][^]*[.!?]$/.test(t) && t !== t.toUpperCase() && t.split(' ').length >= 2 && !/[{}()<>=;]/.test(t)) out.push(t);
  }
  return out;
}

export function lines(){
  const all = new Map();
  const add = (who, text) => { text = spoken(text).trim(); if (text) all.set(text, who); };
  for (const lv of LEVELS){
    for (const [text] of Object.values(lv.tips)) add('nova', text);
    for (const scene of Object.values(lv.lines)) for (const l of scene) if (Array.isArray(l)) add(l[0], l[1]);
    const { wildName, awakeName } = lv.enemies;
    for (const foes of [wildName, awakeName]){
      add('nova', `${cap1(foes)}! You'll hit them on your own. Stand close together to hit harder!`);
      add('nova', `More ${foes}! Stick together!`);
    }
    /* the fork, after the first (the doors: elite, traps, mystery) - only
       ever after the robots wake */
    const what = [`the biggest of the ${awakeName}`, 'traps', 'who knows what'];
    for (const a of what) for (const b of what) if (a !== b) add('nova', `${cap1(a)} on the left, ${b} on the right. Your call!`);
  }
  /* the praise, one player at a time */
  for (const n of NAMES) for (const c of CHEERS) add('nova', `${n}, ${c}!`);
  for (const n of NAMES){
    add('nova', `${n}'s asleep! Stand next to them and clap to wake them up!`);
    add('nova', `Clap for ${n}!`);
    add('nova', `${n} missed it! Stand next to their bubble and clap to pop it!`);
    add('nova', `Pop ${n}'s bubble!`);
  }
  for (const f of ['lkp-game.js', 'lkp-scout.js', 'lkp-boss.js', 'lkp-captain.js', 'lkp-intro.js', 'lkp-ride.js'])
    for (const t of quoted(readFileSync(new URL(f, SRC), 'utf8'))) if (!all.has(t)) add('nova', t);
  return [...all].map(([text, who]) => ({ who, text }));
}

if (import.meta.url === `file://${process.argv[1]}`){
  const l = lines();
  for (const x of l) console.log(x.who.padEnd(6), x.text);
  console.log(l.length, 'lines,', l.reduce((n, x) => n + x.text.length, 0), 'characters');
}
