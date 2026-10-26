/* The soundtrack: real recorded songs the family chose, played straight
   through, shuffled, one after another.

   The songs live on the laptop, not in the game: the Windows launcher lists
   whatever is in the "Astra Park" music folder into playlist.js beside the
   game, which sets window.ASTRA_MUSIC before this runs. With no songs there,
   the game falls back to its own generated music, so it is never silent.

   Plain <audio> elements rather than Web Audio, because a page opened from
   disk can play a local file through one but would get silence routing it
   through Web Audio. Volume is set on the element directly. */

const FADE = 1.5;
/* Seconds for the volume to follow a change of level, so the build through
   a round is a swell and the drop at the end of one isn't a jolt. */
const EASE = 1.5;

export function shuffle(list, rand = Math.random){
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* A shuffled order that runs through every song before any repeats, and
   never plays the same song twice in a row across a reshuffle. */
export function playlist(tracks, rand = Math.random){
  let order = [], last = null;
  return {
    next(){
      if (!tracks.length) return null;
      if (!order.length){
        order = shuffle(tracks, rand);
        if (order.length > 1 && order[0] === last) order.push(order.shift());
      }
      last = order.shift();
      return last;
    }
  };
}

export function createSoundtrack({ tracks = [], makeAudio = (src) => new Audio(src), now = () => performance.now() / 1000 } = {}){
  const list = playlist(tracks);
  let el = null, level = 1, shown = null, eased = 0, master = 0.7, muted = false, started = false;
  let fadeFrom = 0, fadeTo = 0, fadeStart = 0, fadeLen = 0, timer = null;

  const target = () => {
    /* Level follows its setting smoothly rather than jumping to it. */
    const t = now();
    shown = shown == null ? level : shown + (level - shown) * Math.min(1, (t - eased) / EASE);
    eased = t;
    return muted ? 0 : master * shown * 0.6;
  };
  const apply = () => {
    if (!el) return;
    const t = fadeLen ? Math.min(1, (now() - fadeStart) / fadeLen) : 1;
    el.volume = Math.max(0, Math.min(1, (fadeFrom + (fadeTo - fadeFrom) * t) * target()));
    if (t >= 1 && fadeTo === 0 && el._leaving){ el.pause(); el = null; playNext(); }
    else if (t >= 1 && fadeTo === 0 && el._stopping){ el.pause(); el = null; clearInterval(timer); }
  };
  const fade = (from, to, secs) => { fadeFrom = from; fadeTo = to; fadeStart = now(); fadeLen = secs; apply(); };

  function playNext(){
    const src = list.next();
    if (!src) return;
    el = makeAudio(src);
    el.preservesPitch = false;
    el.addEventListener('ended', () => { if (el){ el = null; playNext(); } });
    /* A file that can't be read is skipped rather than ending the music. */
    el.addEventListener('error', () => { el = null; playNext(); });
    fade(0, 1, FADE);
    const p = el.play && el.play();
    /* Opened outside the launcher, the browser waits for a first click or
       key before it lets sound start. */
    if (p && p.catch) p.catch(() => {
      const go = () => { el && el.play && el.play(); removeEventListener('pointerdown', go); removeEventListener('keydown', go); };
      if (typeof addEventListener === 'function'){ addEventListener('pointerdown', go); addEventListener('keydown', go); }
    });
  }

  return {
    get available(){ return tracks.length > 0; },
    get current(){ return el; },
    start(){
      if (started || !tracks.length) return;
      started = true;
      /* A song still fading out from the last stop is cut off cleanly. */
      clearInterval(timer); if (el) el.pause(); el = null;
      playNext();
      timer = setInterval(apply, 100);
    },
    /* How loud the songs sit for what's on screen, 0..1; eased toward. */
    level(v){ level = Math.max(0, Math.min(1, v)); apply(); },
    setVolume(v, isMuted){ master = v; muted = isMuted; apply(); },
    /* Slow motion: the song slows like a tape, then comes back up to speed. */
    slow(secs){
      if (!el) return;
      const e = el;
      e.playbackRate = 0.8;
      setTimeout(() => { e.playbackRate = 1; }, secs * 1000);
    },
    /* Fade the current song out and move on. */
    skip(){ if (el){ el._leaving = true; fade(1, 0, FADE); } },
    /* With a fade time, the song fades out first; either way the next
       start() begins a fresh song. */
    stop(fadeSecs = 0){
      started = false;
      if (el && fadeSecs > 0){ el._stopping = true; fade(1, 0, fadeSecs); return; }
      clearInterval(timer); if (el) el.pause(); el = null;
    }
  };
}
