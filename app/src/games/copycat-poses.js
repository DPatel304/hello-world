/* The poses in Animal Copycat, and how close a child is to one.

   A pose is where the elbows, wrists, knees and ankles go, measured from the
   middle of the hips in torso-lengths (hips to shoulders), with up negative
   and the child's own left on the right of the screen, as everywhere else.
   Measuring in torso-lengths makes a small child and a grown-up the same
   size; measuring from the hips means it doesn't matter where in the room
   they stand.

   How close: the average distance from each joint to where the pose wants
   it, wrists counting a little more since they're what children watch.
   Joints the camera can't see are left out, so a child cut off at the knees
   can still match the arms. A one-sided pose - the flamingo - can be done
   on either leg. */
import { L } from '../tracking/pose.js';

export const MATCH = 0.4;    /* torso-lengths: close enough */
export const HEAD = -1.45;   /* where the nose is, in the same measure */

/* Joints compared, with each pose's place for them: [x, y] for the
   child's left side; the right is the mirror unless given. */
const J = { elbow: [L.L_ELBOW, L.R_ELBOW], wrist: [L.L_WRIST, L.R_WRIST], knee: [L.L_KNEE, L.R_KNEE], ankle: [L.L_ANKLE, L.R_ANKLE] };
const WEIGHT = { elbow: 1, wrist: 1.5, knee: 1, ankle: 1 };
const STAND_LEGS = { knee: [0.27, 0.9], ankle: [0.28, 1.8] };

export const POSES = {
  stand:    { elbow: [0.55, -0.45], wrist: [0.6, 0.05], ...STAND_LEGS, use: [] },
  giraffe:  { elbow: [0.4, -1.65], wrist: [0.35, -2.3], ...STAND_LEGS, use: ['elbow', 'wrist'] },
  bird:     { elbow: [1.0, -1.0], wrist: [1.55, -1.0], ...STAND_LEGS, use: ['elbow', 'wrist'] },
  starfish: { elbow: [0.9, -1.3], wrist: [1.4, -1.65], knee: [0.55, 0.85], ankle: [0.85, 1.65], use: ['elbow', 'wrist', 'knee', 'ankle'] },
  bunny:    { elbow: [0.8, -1.5], wrist: [0.25, -1.95], ...STAND_LEGS, use: ['elbow', 'wrist'] },
  /* Hands together low in front: the trunk. Elbows vary too much to judge. */
  elephant: { elbow: [0.3, -0.55], wrist: [0.06, 0.45], ...STAND_LEGS, use: ['wrist'] },
  frog:     { elbow: [0.6, -0.15], wrist: [0.35, 0.75], knee: [0.8, 0.3], ankle: [0.6, 0.95], use: ['wrist', 'knee', 'ankle'] },
  flamingo: { elbow: [0.85, -0.95], wrist: [1.3, -0.8], knee: [0.27, 0.9], ankle: [0.28, 1.8],
              right: { knee: [-0.4, 0.45], ankle: [-0.2, 1.0] }, use: ['elbow', 'wrist', 'knee', 'ankle'],
              /* Wings alone aren't a flamingo: one foot has to be up. */
              need: (lm, f, H) => Math.abs(lm[L.L_ANKLE].y - lm[L.R_ANKLE].y) * H / f.u > 0.4 }
};
export const ANIMALS = Object.keys(POSES).filter(k => k !== 'stand');

/* Where a pose puts each joint, as { index: [x, y] } in torso-lengths. */
export function targetOf(name, mirror = false){
  const P = POSES[name], out = {};
  for (const [part, [li, ri]] of Object.entries(J)){
    const [lx, ly] = P[part];
    const r = P.right && P.right[part] ? P.right[part] : [-lx, ly];
    let left = [lx, ly], right = r;
    if (mirror){ left = [-r[0], r[1]]; right = [-lx, ly]; }
    out[li] = left; out[ri] = right;
  }
  return out;
}

/* A child's frame: the middle of their hips, and their torso length, in
   screen pixels. Null if their body isn't in view. */
export function frameOf(lm, W, H){
  const seen = (i) => lm && lm[i] && (lm[i].v ?? 1) > 0.4;
  if (!seen(L.L_HIP) || !seen(L.R_HIP) || !seen(L.L_SHOULDER) || !seen(L.R_SHOULDER)) return null;
  const hx = (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2 * W, hy = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2 * H;
  const sx = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2 * W, sy = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y) / 2 * H;
  const u = Math.hypot(sx - hx, sy - hy);
  return u > 4 ? { x: hx, y: hy, u } : null;
}

/* How far a child is from a pose, in torso-lengths (lower is closer), or
   null if too little of them is in view to tell. */
export function distance(lm, name, W, H){
  const c = closest(lm, name, W, H);
  return c ? c.d : null;
}

/* The same, with which way round the pose is nearer: { d, mirror }. */
export function closest(lm, name, W, H){
  const f = frameOf(lm, W, H);
  if (!f) return null;
  const P = POSES[name];
  let best = null;
  for (const mirror of P.right ? [false, true] : [false]){
    const tg = targetOf(name, mirror);
    let sum = 0, weight = 0;
    for (const part of P.use){
      for (const i of J[part]){
        if ((lm[i].v ?? 1) < 0.4) continue;
        const x = (lm[i].x * W - f.x) / f.u, y = (lm[i].y * H - f.y) / f.u;
        sum += Math.hypot(x - tg[i][0], y - tg[i][1]) * WEIGHT[part]; weight += WEIGHT[part];
      }
    }
    /* At least both wrists' worth of evidence before calling it either way. */
    if (weight < 3) continue;
    let d = sum / weight;
    if (P.need && !P.need(lm, f, H)) d += MATCH;
    if (best == null || d < best.d) best = { d, mirror };
  }
  return best;
}

/* A made-up body in a pose, for drawing the animals' examples and for
   tests: landmarks placed from the pose's targets around (x, y) with torso
   length u (screen fractions; u in screen heights). */
export function bodyIn(name, x, y, u, W = 1920, H = 1080, mirror = false){
  const lm = Array.from({ length: 33 }, () => ({ x, y, v: 0.9 }));
  const put = (i, tx, ty) => { lm[i] = { x: x + tx * u * H / W, y: y + ty * u, v: 0.9 }; };
  const tg = targetOf(name, mirror);
  for (const [i, [tx, ty]] of Object.entries(tg)) put(+i, tx, ty);
  put(L.L_SHOULDER, 0.45, -1); put(L.R_SHOULDER, -0.45, -1);
  put(L.L_HIP, 0.25, 0); put(L.R_HIP, -0.25, 0);
  put(L.NOSE, 0, HEAD); put(L.L_EYE, 0.08, -1.52); put(L.R_EYE, -0.08, -1.52); put(7, 0.18, -1.48); put(8, -0.18, -1.48);
  return lm;
}
