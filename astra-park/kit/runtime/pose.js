/* Inside the sandbox: the camera's players, as the app last told them. The
   game reads pose.players and pose.mouse just as a built-in game does; the
   app refreshes them before every frame (with body points - never camera
   pictures). */
import { L, BONES, MAX_PLAYERS, PLAYER_COLORS } from '../../src/tracking/pose-shared.js';
export { L, BONES, MAX_PLAYERS, PLAYER_COLORS };

const blank = (i) => ({
  id: i, color: PLAYER_COLORS[i], present: false, lostFor: 99, watching: 0, at: null, lm: null,
  hands: { left: { x: .5, y: .5, vx: 0, vy: 0, speed: 0 }, right: { x: .5, y: .5, vx: 0, vy: 0, speed: 0 } },
  centre: { x: .5, y: .5 }, scale: 0.3
});

export const pose = {
  players: Array.from({ length: MAX_PLAYERS }, (_, i) => blank(i)),
  mouse: { active: false, x: 0.5, y: 0.5 },
  personCount: 0, seenCount: 0, usingCamera: true, ready: true,
  /* the hand a player points with (as the app's own pose does) */
  cursorHand(p){ return p.hands.right; }
};

/* The app's latest: copied in place, so anything the game holds stays live. */
export function applyPose(snap){
  if (!snap) return;
  (snap.players || []).forEach((p, i) => { if (pose.players[i]) Object.assign(pose.players[i], p); });
  if (snap.mouse) Object.assign(pose.mouse, snap.mouse);
  pose.personCount = snap.personCount || 0;
  pose.seenCount = snap.seenCount || 0;
}
