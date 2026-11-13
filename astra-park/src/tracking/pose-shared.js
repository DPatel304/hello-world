/* What every game may know about the camera's players, without the camera
   engine itself: the names of the body's points, the skeleton between them,
   and the four players' colours. (pose.js re-exports these; a downloaded
   game carries its own copy - see astra-park/kit/runtime.) */

/* Landmark indices we actually use. MediaPipe gives 33; naming the handful
   that matter keeps the game code readable. */
export const L = {
  NOSE:0, L_EYE:2, R_EYE:5,
  L_SHOULDER:11, R_SHOULDER:12, L_ELBOW:13, R_ELBOW:14, L_WRIST:15, R_WRIST:16,
  L_HIP:23, R_HIP:24, L_KNEE:25, R_KNEE:26, L_ANKLE:27, R_ANKLE:28
};

/* Drawn skeleton: pairs of landmark indices. */
export const BONES = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]
];

/* Up to four play at once, each in their own colour. */
export const MAX_PLAYERS = 4;
export const PLAYER_COLORS = ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'];
