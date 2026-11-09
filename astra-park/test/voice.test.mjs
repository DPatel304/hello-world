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
