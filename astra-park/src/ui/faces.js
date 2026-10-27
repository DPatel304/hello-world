/* The children's real faces, cut from the camera picture, for games that
   put them on screen - Fire Truck seats them in the cab windows.

   The pose model already finds each person's nose, eyes and ears, so a face
   is a square around them in the video, sized by how far apart the ears are
   (or the eyes, if the ears are hidden). The square is eased toward where the
   face is rather than snapped to it, so the picture in the window holds
   steady instead of jittering with every frame of tracking.

   Nothing is recorded or kept: each frame is drawn straight from the live
   video and gone with the next one. */
import { pose, L, MAX_PLAYERS } from '../tracking/pose.js';

const EAR_L = 7, EAR_R = 8;
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
  return { x: nose.x, y: nose.y - eyes * 0.35, size, roll };
}

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
      const box = this.live && p.present ? faceBox(p.lm, v.videoWidth, v.videoHeight) : null;
      if (!box){ this.seen[i] = Math.max(0, this.seen[i] - dt * 2); continue; }
      this.seen[i] = Math.min(1, this.seen[i] + dt * 3);
      const b = this.boxes[i];
      if (!b){ this.boxes[i] = { ...box }; continue; }
      b.x += (box.x - b.x) * k; b.y += (box.y - b.y) * k;
      b.size += (box.size - b.size) * k * 0.6; b.roll += (box.roll - b.roll) * k;
    }
  }

  /* Is player i's face available to draw? */
  has(i){ return this.live && !!this.boxes[i] && this.seen[i] > 0.2; }
  roll(i){ return this.boxes[i] ? this.boxes[i].roll : 0; }

  /* Paint player i's face into a circle of radius r at (x, y), mirrored like
     a mirror. The caller has clipped to the window. */
  draw(c, i, x, y, r){
    const b = this.boxes[i], v = this.video;
    if (!b || !v) return false;
    c.save();
    c.globalAlpha = Math.min(1, this.seen[i] * 1.5);
    c.translate(x, y); c.scale(-1, 1);
    try { c.drawImage(v, b.x - b.size / 2, b.y - b.size / 2, b.size, b.size, -r, -r, r * 2, r * 2); }
    catch (e){ c.restore(); return false; }
    c.restore();
    return true;
  }
}
