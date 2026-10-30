/* The children's real faces, for games that put them on screen - in the
   knights' helmets, the runners' hoods, the boat's seats.

   Not the live camera: each child's face is snapped once, like a photo, the
   first time it's seen clearly - looking at the TV, head straight, held
   steady for a moment - with a little white flash, and that picture is used
   from then on, in every game. Someone who joins later is snapped when they
   come in. A child gone from the game for more than FORGET seconds is
   forgotten, so whoever takes their place next gets their own picture.

   The pose model already finds each person's nose, eyes and ears, so a face
   is a square around them in the video, sized by how far apart the ears are
   (or the eyes, if the ears are hidden).

   The pictures are kept in memory only, for as long as the page is open:
   nothing is saved or sent anywhere.

   A child isn't shown as the photo itself but as a cartoon
   drawn from it - the photo is read for their skin tone, their hair colour
   and whether their hair is long, and they're drawn as one of the park's
   own cartoon people with those (lookFrom). (Where a photo can't be read,
   it's shown as it is.) */
import { pose, L, MAX_PLAYERS } from '../tracking/pose.js';
import { drawToon } from './kids.js';

const EAR_L = 7, EAR_R = 8;
/* A good picture: the face held steady (moving less than STILL of its size
   a frame) this long, looking this straight on (nose this near the middle
   of the eyes, in eye-widths) and level (tilt in radians), and this big in
   the video (pixels). Grown-ups marching and pointing, children bouncing:
   nobody holds still for long, so it's forgiving - and if there's still no
   picture after LATE seconds of seeing a face, it takes the first that's
   roughly facing the TV (within ROUGHLY), and swaps it for a better one
   when one comes. */
export const STEADY = 0.3, STILL = 0.15, STRAIGHT = 0.3, LEVEL = 0.4, BIG = 24, FORGET = 5, LATE = 3, ROUGHLY = 0.6;
const SNAP = 128, FLASH = 0.5;
/* How much of the head to show around the face: the crop is this many
   ear-widths across. */
const HEAD = 2.3;

/* Where a face is in the video, as a square in video pixels - { x, y, size }
   centred on the face - plus how far the head is tilted, or null if there's
   no face to find. lm is the mirrored landmark list the game uses. */
export function faceBox(lm, vw, vh){
  if (!lm || !vw || !vh) return null;
  const seen = (i) => lm[i] && (lm[i].v ?? 1) > 0.4;
  if (!seen(L.NOSE) || !seen(L.L_EYE) || !seen(L.R_EYE)) return null;
  /* Landmarks are mirrored for the screen; the video itself is not. */
  const px = (i) => ({ x: (1 - lm[i].x) * vw, y: lm[i].y * vh });
  const nose = px(L.NOSE), le = px(L.L_EYE), re = px(L.R_EYE);
  const eyes = Math.hypot(le.x - re.x, le.y - re.y);
  const ears = seen(EAR_L) && seen(EAR_R) ? Math.hypot(px(EAR_L).x - px(EAR_R).x, px(EAR_L).y - px(EAR_R).y) : 0;
  const size = Math.max(ears * HEAD, eyes * HEAD * 2.2);
  if (size < 8) return null;
  /* Centred a little above the nose, between it and the eyes, so the whole
     face sits in the middle of the window. Tilt is measured on screen, where
     the person's left eye is on the right. */
  const roll = Math.atan2(lm[L.L_EYE].y * vh - lm[L.R_EYE].y * vh, (lm[L.L_EYE].x - lm[L.R_EYE].x) * vw);
  /* Looking straight on: the nose midway between the eyes. */
  const turn = Math.abs(nose.x - (le.x + re.x) / 2) / Math.max(1, eyes);
  return { x: nose.x, y: nose.y - eyes * 0.35, size, roll, turn };
}

/* Reading a face photo for a cartoon. data is RGBA pixels of a w x h
   picture of the face, centred, the head about two-fifths of its width
   (as _snap takes them). Skin from the cheeks; hair from just over the
   forehead; long hair if the sides below the ears are hair-coloured
   rather than skin or background. Returns { skin, hair, long }. */
export function lookFrom(data, w, h){
  const px = (x, y) => { const i = (Math.round(y) * w + Math.round(x)) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  /* The middle colour of a patch, by fractions of the picture: steady
     against a stray highlight or shadow. */
  const patch = (x0, y0, x1, y1) => {
    const pts = [];
    for (let y = y0 * h; y <= y1 * h; y += 2) for (let x = x0 * w; x <= x1 * w; x += 2) pts.push(px(x, y));
    return [0, 1, 2].map(k => pts.map(p => p[k]).sort((a, b) => a - b)[pts.length >> 1]);
  };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const skin = patch(0.38, 0.52, 0.62, 0.66);
  const hair = patch(0.38, 0.14, 0.62, 0.24);
  const sides = [patch(0.1, 0.62, 0.22, 0.8), patch(0.78, 0.62, 0.9, 0.8)];
  const corner = patch(0.02, 0.02, 0.1, 0.1);
  const long = sides.every(sd => dist(sd, hair) < 60 && dist(sd, skin) > 50) && dist(hair, corner) > 30;
  const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  return { skin: css(skin), hair: css(hair), long };
}
/* The pictures, one per player, shared by every game for the session. */
const snaps = Array(MAX_PLAYERS).fill(null);
const gone = Array(MAX_PLAYERS).fill(0), steady = Array(MAX_PLAYERS).fill(0), looked = Array(MAX_PLAYERS).fill(0);
export function forgetFaces(){ snaps.fill(null); gone.fill(0); steady.fill(0); looked.fill(0); }
const makeCanvas = (n) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(n, n)
  : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: n, height: n }) : null;

export class FaceCam {
  constructor(){ this.boxes = Array(MAX_PLAYERS).fill(null); this.seen = Array(MAX_PLAYERS).fill(0); }

  get video(){ return pose.video; }

  /* Is there live video to cut faces from at all? */
  get live(){
    const v = this.video;
    return !!(v && pose.usingCamera && v.readyState >= 2 && v.videoWidth);
  }

  step(dt){
    const v = this.video, k = Math.min(1, dt * 8);
    for (let i = 0; i < MAX_PLAYERS; i++){
      const p = pose.players[i];
      /* Gone a while: forget them, so the next to play here is snapped anew. */
      gone[i] = p.present ? 0 : gone[i] + dt;
      if (gone[i] > FORGET){ snaps[i] = null; this.boxes[i] = null; looked[i] = 0; }
      if (snaps[i]) snaps[i].age += dt;
      const box = this.live && p.present ? faceBox(p.lm, v.videoWidth, v.videoHeight) : null;
      if (!box){ this.seen[i] = Math.max(0, this.seen[i] - dt * 2); steady[i] = 0; continue; }
      this.seen[i] = Math.min(1, this.seen[i] + dt * 3);
      const b = this.boxes[i];
      if (!b){ this.boxes[i] = { ...box }; continue; }
      /* Held still, straight on and level? */
      const still = Math.hypot(box.x - b.x, box.y - b.y) < box.size * STILL;
      const good = box.turn < STRAIGHT && Math.abs(box.roll) < LEVEL && box.size >= BIG;
      steady[i] = still && good ? steady[i] + dt : 0;
      b.x += (box.x - b.x) * k; b.y += (box.y - b.y) * k;
      b.size += (box.size - b.size) * k * 0.6; b.roll += (box.roll - b.roll) * k;
      if (!snaps[i]) looked[i] += dt;
      /* A good one: take it - or swap it in for a rough one. */
      if ((!snaps[i] || snaps[i].rough) && steady[i] >= STEADY) this._snap(i, v, b, false, !!snaps[i]);
      /* Still nothing after a while: the first roughly facing the TV will do. */
      else if (!snaps[i] && looked[i] >= LATE && box.turn < ROUGHLY && box.size >= BIG) this._snap(i, v, { ...box }, true);
    }
  }

  /* Take player i's picture from the video. */
  _snap(i, v, b, rough = false, quiet = false){
    const cv = makeCanvas(SNAP);
    if (!cv) return;
    let look = null;
    try {
      const g = cv.getContext('2d');
      g.drawImage(v, b.x - b.size / 2, b.y - b.size / 2, b.size, b.size, 0, 0, SNAP, SNAP);
      if (g.getImageData) look = lookFrom(g.getImageData(0, 0, SNAP, SNAP).data, SNAP, SNAP);
    } catch (e){ return; }
    /* A better one swapped in quietly, without the flash. */
    snaps[i] = { canvas: cv, age: quiet ? FLASH : 0, rough, look };
  }

  /* Is player i's picture there to draw? */
  has(i){ return !!snaps[i]; }
  roll(i){ return this.boxes[i] ? this.boxes[i].roll : 0; }

  /* Paint player i's picture into a circle of radius r at (x, y), mirrored
     like a mirror, with a white flash just after it's taken. The caller has
     clipped to the window. */
  draw(c, i, x, y, r){
    const sn = snaps[i];
    if (!sn) return false;
    c.save();
    if (sn.look){
      /* As a cartoon of themselves, on a soft backdrop. */
      c.fillStyle = '#fff6e2'; c.fillRect(x - r, y - r, r * 2, r * 2);
      drawToon(c, x, y, r, sn.age + i * 1.3, sn.look);
      c.translate(x, y);
    } else {
      c.translate(x, y); c.scale(-1, 1);
      c.drawImage(sn.canvas, -r, -r, r * 2, r * 2);
    }
    if (sn.age < FLASH){ c.globalAlpha = 1 - sn.age / FLASH; c.fillStyle = '#ffffff'; c.fillRect(-r, -r, r * 2, r * 2); }
    c.restore();
    return true;
  }
}
