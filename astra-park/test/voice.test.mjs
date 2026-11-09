import test from 'node:test';
import assert from 'node:assert/strict';
import { pick, natural } from '../src/audio/voice.js';

const V = (name, lang = 'en-US', localService = true) => ({ name, lang, localService });

test('Nova gets a natural-sounding voice when there is one, the old built-in one when there is not', () => {
  const edge = [V('Microsoft David - English (United States)'), V('Microsoft Zira - English (United States)'), V('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false), V('Microsoft Guy Online (Natural) - English (United States)', 'en-US', false)];
  assert.equal(pick('nova', edge).name, 'Microsoft Aria Online (Natural) - English (United States)');
  assert.equal(pick('robot', edge).name, 'Microsoft Guy Online (Natural) - English (United States)');
  const chrome = [V('Microsoft Zira - English (United States)'), V('Google US English', 'en-US', false), V('Google UK English Male', 'en-GB', false)];
  assert.equal(pick('nova', chrome).name, 'Google US English');
  assert.ok(natural(chrome[1]) && !natural(chrome[0]));
  assert.equal(pick('nova', [V('Microsoft David'), V('Microsoft Zira')]).name, 'Microsoft Zira');
  assert.equal(pick('nova', [V('Thomas', 'fr-FR')]), null);
});

test('a line said before the natural voices arrive waits for them, so Nova never starts in the old robotic voice', async () => {
  const said = [];
  let voices = [V('Microsoft Zira - English (United States)')];
  const listeners = [];
  globalThis.speechSynthesis = { getVoices: () => voices, cancel(){}, speak(u){ said.push(u.voice && u.voice.name); }, addEventListener: (k, f) => listeners.push(f) };
  globalThis.SpeechSynthesisUtterance = function(t){ this.text = t; };
  const { voice } = await import('../src/audio/voice.js?fresh=' + Date.now());
  voice.say('Crew, do you read me?');
  assert.deepEqual(said, [], 'not in the old voice');
  voices = [...voices, V('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false)];
  listeners.forEach(f => f());
  assert.deepEqual(said, ['Microsoft Aria Online (Natural) - English (United States)']);
  voice.say('Follow the path.');
  assert.equal(said[1], said[0], 'and the same voice after');
  delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance;
});

/* ---------- the recorded lines (voice-lines.js) ---------- */

import { clipsFor, lineTime, voice as said } from '../src/audio/voice.js';
import { LINES } from '../src/audio/voice-lines.js';
import { lines as script } from '../tools/voice-script.mjs';
import { stub } from '../src/audio/sound.js';

const REC = { 'Low branch! Duck!': { who: 'nova', secs: 1.5, mp3: 'AAA' }, 'Blue, great dodging!': { who: 'nova', secs: 1, mp3: 'BBB' }, 'Green, super running!': { who: 'nova', secs: 1.2, mp3: 'CCC' } };

test('a recorded line is found by its exact words; a line of recorded sentences, a sentence at a time; anything else, not at all', () => {
  assert.deepEqual(clipsFor('Low branch! Duck!', REC).map(c => c.mp3), ['AAA']);
  assert.deepEqual(clipsFor('Blue, great dodging! Green, super running!', REC).map(c => c.mp3), ['BBB', 'CCC']);
  assert.equal(clipsFor('Blue, great dodging! Orange, super running!', REC), null, 'not half recorded, half the computer');
  assert.equal(clipsFor('Low branch!', REC), null);
});

test('every recording is of a line still in the game, by who says it, and timed by its real length', () => {
  const now = new Map(script().map(l => [l.text, l.who]));
  assert.ok(Object.keys(LINES).length > 0);
  for (const [text, r] of Object.entries(LINES)){
    assert.equal(now.get(text), r.who, `"${text}" is no longer said - re-run tools/record-voice.mjs`);
    assert.ok(r.secs > 0.3 && r.mp3.length > 1000, text);
    assert.equal(lineTime(text, r.who), r.secs + 0.2);
  }
});

test('the script has the game\'s lines: the level\'s, the ones written in, and each way a template comes out', () => {
  const all = script().map(l => l.text);
  for (const t of ['Low branch! Duck!', 'Clean. The planet. Of everything.', 'Crew, do you read me? ...You\'re okay! Now, on your feet. Follow the path and I\'ll talk you through it.',
    'Run! Run round the ring!', 'Freeze on red!', 'Purple, brilliant teamwork!', 'Pop Orange\'s bubble!', 'Traps on the left, who knows what on the right. Your call!'])
    assert.ok(all.includes(t), t);
  assert.ok(!all.some(t => t === t.toUpperCase()), 'not the words under her window');
});

test('a recorded line plays the recording, not the computer voice; a new one cuts it off, a polite one waits, hush stops it all', async () => {
  const text = Object.keys(LINES).find(t => LINES[t].who === 'nova');
  const played = [], spoke = [];
  globalThis.Audio = function(src){ this.src = src; this.paused = false; played.push(this); };
  globalThis.Audio.prototype.play = function(){ return Promise.resolve(); };
  globalThis.Audio.prototype.pause = function(){ this.paused = true; };
  globalThis.speechSynthesis = { getVoices: () => [V('Microsoft Aria Online (Natural)', 'en-US', false)], cancel(){ spoke.push('cancel'); }, speak(u){ spoke.push(u.text); }, addEventListener(){} };
  globalThis.SpeechSynthesisUtterance = function(t){ this.text = t; };
  try {
    said.say(text);
    assert.equal(played.length, 1);
    assert.equal(played[0].src, 'data:audio/mpeg;base64,' + LINES[text].mp3);
    assert.ok(!spoke.some(s => s === text), 'not said by the computer too');
    assert.ok(said.playing);

    said.say(text, 'nova', true);
    assert.equal(played.length, 1, 'polite: waits its turn');
    played[0].onended();
    await new Promise(r => setTimeout(r, 200));
    assert.equal(played.length, 2, 'then plays');

    said.say(text);
    assert.ok(played[1].paused, 'a new line cuts in');
    said.hush();
    assert.ok(played[2].paused && !said.playing, 'hush stops it');

    said.say('A line nobody recorded!');
    assert.ok(spoke.includes('A line nobody recorded!'), 'the computer says the rest');

    const n = played.length;
    stub.muted = true; said.say(text); stub.muted = false;
    stub.quiet = true; said.say(text); stub.quiet = false;
    assert.equal(played.length, n, 'nothing while muted, or in a trailer');
  } finally {
    said.hush();
    delete globalThis.Audio; delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance;
  }
});
