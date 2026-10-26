import test from 'node:test';
import assert from 'node:assert/strict';
import { playlist, createSoundtrack } from '../src/audio/soundtrack.js';

/* A stand-in for an <audio> element: records what it was asked to do. */
function fakeAudio(log){
  return (src) => {
    const handlers = {};
    const el = { src, volume: 1, playbackRate: 1, paused: true,
      play(){ this.paused = false; log.push(src); return Promise.resolve(); },
      pause(){ this.paused = true; },
      addEventListener(k, f){ handlers[k] = f; },
      fire(k){ handlers[k] && handlers[k](); } };
    return el;
  };
}

test('every song plays before any repeats, and never the same one twice running', () => {
  const songs = ['a', 'b', 'c', 'd', 'e'];
  let seed = 1; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pl = playlist(songs, rand), heard = [];
  for (let i = 0; i < 500; i++) heard.push(pl.next());
  for (let i = 0; i < 500; i += 5) assert.deepEqual(heard.slice(i, i + 5).sort(), songs, 'each pass plays them all');
  for (let i = 1; i < heard.length; i++) assert.notEqual(heard[i], heard[i - 1], 'a song twice in a row');
});

test('with no songs there is no soundtrack, so the built-in music plays instead', () => {
  const st = createSoundtrack({ tracks: [] });
  assert.equal(st.available, false);
  st.start();
  assert.equal(st.current, null);
});

test('songs play one after another, and a broken file is skipped', () => {
  const log = [];
  const st = createSoundtrack({ tracks: ['one.mp3', 'two.mp3', 'three.mp3'], makeAudio: fakeAudio(log) });
  st.start();
  assert.equal(log.length, 1);
  st.current.fire('ended');
  assert.equal(log.length, 2, 'the next song should start when one ends');
  st.current.fire('error');
  assert.equal(log.length, 3, 'an unreadable file should be skipped, not stop the music');
  assert.equal(new Set(log).size, 3);
  st.stop();
});

test('volume and mute from the settings reach the songs', () => {
  let t = 0;
  const st = createSoundtrack({ tracks: ['one.mp3'], makeAudio: fakeAudio([]), now: () => t });
  st.start();
  t = 10;                       /* past the fade-in */
  st.setVolume(1, false); st.level(1);
  const loud = st.current.volume;
  st.setVolume(0.5, false);
  assert.ok(Math.abs(st.current.volume - loud / 2) < 1e-9);
  st.setVolume(0.5, true);
  assert.equal(st.current.volume, 0, 'muted');
  st.stop();
});

test('slow motion slows the song like a tape, then lets it back up to speed', async () => {
  const st = createSoundtrack({ tracks: ['one.mp3'], makeAudio: fakeAudio([]) });
  st.start();
  st.slow(0.05);
  assert.ok(st.current.playbackRate < 1);
  assert.equal(st.current.preservesPitch, false, 'a tape slows down in pitch too');
  await new Promise(r => setTimeout(r, 80));
  assert.equal(st.current.playbackRate, 1);
  st.stop();
});

test('a change of level swells in over a second or two rather than jumping', () => {
  let t = 0;
  const st = createSoundtrack({ tracks: ['one.mp3'], makeAudio: fakeAudio([]), now: () => t });
  st.setVolume(1, false);
  st.level(0.4);
  st.start();
  t = 5; st.level(0.4);                    /* settled, and past the fade-in */
  const quiet = st.current.volume;
  st.level(1);
  assert.ok(st.current.volume < quiet * 1.05, 'no jump the moment the level changes');
  t = 5.5; st.level(1);
  const partway = st.current.volume;
  assert.ok(partway > quiet && partway < quiet * 2.5, 'part of the way there after half a second');
  t = 9; st.level(1);
  assert.ok(Math.abs(st.current.volume - quiet * 2.5) < 0.02, 'all the way there after a few seconds');
  st.stop();
});

test('the first note is already quiet when the level is set before starting', () => {
  let t = 0;
  const st = createSoundtrack({ tracks: ['one.mp3'], makeAudio: fakeAudio([]), now: () => t });
  st.setVolume(1, false);
  st.level(0.3);
  st.start();
  t = 2; st.level(0.3);
  assert.ok(Math.abs(st.current.volume - 0.3 * 0.6) < 1e-6, `volume ${st.current.volume} should sit at the quiet level`);
  st.stop();
});
