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

   The picture is cleaned up once, when it's taken: webcam grain smoothed
   away without blurring the eyes and mouth, a touch sharper, brighter and
   more colourful (enhance). It's shown cut to a circle around the face, so
   the room behind doesn't come too, with a thick outline in the player's
   colour. */
import { pose, L, MAX_PLAYERS } from '../tracking/pose.js';

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
const SNAP = 160, FLASH = 0.5;
/* How much of the head to take around the face: the crop is this many
   ear-widths across - the whole face and hair, not much more. */
const HEAD = 2;
/* The width of the outline round the face, as a fraction of its radius. */
export const RIM = 0.13;

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

/* One pass of the grain smoothing (see enhance). */
function smooth(src, w, h){
  const out = new Float32Array(src.length), R = 2, NEAR = 2 * 45 * 45;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const i = (y * w + x) * 4;
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -R; dy <= R; dy++){
      const yy = Math.min(h - 1, Math.max(0, y + dy));
      for (let dx = -R; dx <= R; dx++){
        const j = (yy * w + Math.min(w - 1, Math.max(0, x + dx))) * 4;
        const dr = src[j] - src[i], dg = src[j + 1] - src[i + 1], db = src[j + 2] - src[i + 2];
        const k = Math.exp(-(dr * dr + dg * dg + db * db) / NEAR - (dx * dx + dy * dy) / 8);
        r += src[j] * k; g += src[j + 1] * k; b += src[j + 2] * k; n += k;
      }
    }
    out[i] = r / n; out[i + 1] = g / n; out[i + 2] = b / n; out[i + 3] = src[i + 3];
  }
  return out;
}

/* Cleaning up a face photo, in place: data is its RGBA pixels, w x h.
   Webcam grain is smoothed out by averaging each pixel with the
   neighbours that are close to it in colour - so flat skin goes smooth
   while the edges of the eyes, mouth and hair stay sharp - then the edges
   are given back a little crispness, and the whole is stretched to a full
   range of light and dark, a touch brighter, and a touch more colourful. */
export function enhance(data, w, h){
  /* Twice over, for webcam grain. */
  const out = smooth(smooth(Float32Array.from(data), w, h), w, h);
  /* Crisper: each pixel pushed a little away from its neighbours' average
     - only at real edges, so what grain is left isn't sharpened back. */
  const soft = Float32Array.from(out);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++){
    const i = (y * w + x) * 4;
    for (let k = 0; k < 3; k++){
      const around = (soft[i - 4 + k] + soft[i + 4 + k] + soft[i - w * 4 + k] + soft[i + w * 4 + k]) / 4;
      const edge = soft[i + k] - around;
      if (Math.abs(edge) > 8) out[i + k] = soft[i + k] + edge * 0.6;
    }
  }
  /* Full range: the darkest and lightest few percent set nearly black and
     white - but never stretched so far that skin goes flat white. */
  const darks = [], lights = [];
  for (let i = 0; i < out.length; i += 16){
    darks.push(Math.min(out[i], out[i + 1], out[i + 2])); lights.push(Math.max(out[i], out[i + 1], out[i + 2]));
  }
  darks.sort((a, b) => a - b); lights.sort((a, b) => a - b);
  const lo = darks[Math.floor(darks.length * 0.01)], hi = lights[Math.floor(lights.length * 0.99)];
  const gain = Math.min(1.3, 250 / Math.max(1, hi - lo)), base = Math.max(0, lo - 6);
  for (let i = 0; i < out.length; i += 4){
    let r = (out[i] - base) * gain, g = (out[i + 1] - base) * gain, b = (out[i + 2] - base) * gain;
    /* A touch brighter, and more colourful. */
    r = 255 * Math.pow(Math.max(0, r) / 255, 0.9); g = 255 * Math.pow(Math.max(0, g) / 255, 0.9); b = 255 * Math.pow(Math.max(0, b) / 255, 0.9);
    const m = 0.3 * r + 0.59 * g + 0.11 * b;
    data[i] = m + (r - m) * 1.18; data[i + 1] = m + (g - m) * 1.18; data[i + 2] = m + (b - m) * 1.18;
  }
  return data;
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
    try {
      const g = cv.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(v, b.x - b.size / 2, b.y - b.size / 2, b.size, b.size, 0, 0, SNAP, SNAP);
      if (g.getImageData){
        const img = g.getImageData(0, 0, SNAP, SNAP);
        enhance(img.data, SNAP, SNAP);
        g.putImageData(img, 0, 0);
      }
    } catch (e){ return; }
    /* A better one swapped in quietly, without the flash. */
    snaps[i] = { canvas: cv, age: quiet ? FLASH : 0, rough };
  }

  /* Is player i's picture there to draw? */
  has(i){ return !!snaps[i]; }
  roll(i){ return this.boxes[i] ? this.boxes[i].roll : 0; }

  /* Paint player i's picture at (x, y): cut to a circle of radius r,
     mirrored like a mirror, outlined thickly in col, with a white flash
     just after it's taken. */
  draw(c, i, x, y, r, col = '#ffffff'){
    const sn = snaps[i];
    if (!sn) return false;
    const rim = r * RIM, rc = r - rim / 2;
    c.save();
    c.translate(x, y);
    c.save();
    c.beginPath(); c.arc(0, 0, rc, 0, 6.2832); c.clip();
    c.scale(-1, 1);
    c.drawImage(sn.canvas, -rc, -rc, rc * 2, rc * 2);
    if (sn.age < FLASH){ c.globalAlpha = 1 - sn.age / FLASH; c.fillStyle = '#ffffff'; c.fillRect(-r, -r, r * 2, r * 2); }
    c.restore();
    c.strokeStyle = col; c.lineWidth = rim;
    c.beginPath(); c.arc(0, 0, rc, 0, 6.2832); c.stroke();
    c.restore();
    return true;
  }
}
