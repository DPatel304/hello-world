import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

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

const SMOOTH = 0.45;        /* lerp per detection; higher follows faster, jitters more */
const LOST_AFTER = 0.6;     /* seconds without a detection before a player counts as gone */

export const PLAYER_COLORS = ['#3da9ff', '#ff8a3d'];

function blank(i){
  return {
    id:i, color:PLAYER_COLORS[i], present:false, lostFor:99,
    lm:null, raw:null,
    hands:{ left:{x:.5,y:.5,vx:0,vy:0,speed:0}, right:{x:.5,y:.5,vx:0,vy:0,speed:0} },
    centre:{x:.5,y:.5}, scale:0.3
  };
}

function withTimeout(promise, ms){
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after ' + (ms/1000) + 's')), ms))
  ]);
}

export const pose = {
  ready:false, usingCamera:false, reason:'', detail:'',
  players:[blank(0), blank(1)],
  personCount:0, fps:0,

  /* Mouse stands in for a body when there is no camera: the whole interface is
     hover-driven, so a pointer can reach everything a hand can. Without it the
     app is untestable on any machine that cannot see a person. */
  mouse:{ active:false, x:.5, y:.5 },

  async start(video, { forceMouse = false } = {}){
    this.video = video;
    if (forceMouse){ this.reason = 'debug'; this.enableMouse(); return false; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{ width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30} }, audio:false
      });
      video.srcObject = stream;
      await video.play();
    } catch (e){
      this.reason = (e && e.name) === 'NotAllowedError' ? 'denied' : 'nocamera';
      this.enableMouse();
      return false;
    }
    /* Local copies if `npm run offline` has been run, otherwise the CDN. A
       living-room box should not need the internet, but nobody should have to
       download 40MB before they can try it either.

       Opened straight off the filesystem there is nothing to probe: a fetch of
       a sibling file from a file:// page is refused by CORS, which logs an
       error and tells us nothing. Skip to the CDN. */
    const local = location.protocol === 'file:' ? false
      : await fetch('/wasm/vision_wasm_internal.js', { method:'HEAD' })
              .then(r => r.ok).catch(() => false);
    const wasmDir = local ? '/wasm'
      : 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm';
    const model = local ? '/models/pose_landmarker_lite.task'
      : 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/' +
        'pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
    /* The runtime is tens of megabytes over somebody else's CDN. If it is slow,
       blocked or offline, the app used to sit on "Starting the camera…"
       forever with the camera light on and nothing to show for it. Give it a
       deadline and say what went wrong instead. */
    try {
      const files = await withTimeout(FilesetResolver.forVisionTasks(wasmDir), 25000);
      this.lm = await withTimeout(PoseLandmarker.createFromOptions(files, {
        baseOptions:{ modelAssetPath: model, delegate:'GPU' },
        runningMode:'VIDEO', numPoses:2,
        minPoseDetectionConfidence:0.5, minPosePresenceConfidence:0.5, minTrackingConfidence:0.5
      }), 40000);
    } catch (e){
      this.reason = local ? 'badassets' : 'nonetwork';
      this.detail = (e && e.message) || String(e);
      try { video.srcObject.getTracks().forEach(t => t.stop()); } catch (e2) {}
      this.usingCamera = false;
      this.enableMouse();
      return false;
    }
    this.ready = true; this.usingCamera = true;
    return true;
  },

  enableMouse(){
    if (this.mouse.active) return;
    this.mouse.active = true;
    addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX / innerWidth;
      this.mouse.y = e.clientY / innerHeight;
    });
  },

  /* Called once per animation frame. Detection runs only when the video has a
     new frame, so games keep their own smooth cadence even if pose dips. */
  update(nowMs, dt){
    if (this.mouse.active) return this._mouseUpdate(dt);
    if (!this.ready) return;
    const v = this.video;
    if (v.readyState < 2) return;
    if (v.currentTime === this._lastT) { this._decay(dt); return; }
    this._lastT = v.currentTime;

    let res;
    try { res = this.lm.detectForVideo(v, nowMs); }
    catch (e){ return; }

    const found = (res && res.landmarks) ? res.landmarks : [];
    /* Left-to-right on screen decides who is P1. Stable, and it matches how
       people describe themselves ("I'm on the left"). After mirroring, screen
       left is the player's own left as they face the TV. */
    const sorted = found
      .map(lm => ({ lm, cx: 1 - (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2 }))
      .sort((a,b) => a.cx - b.cx)
      .slice(0,2);

    this.personCount = sorted.length;
    for (let i = 0; i < 2; i++){
      const p = this.players[i], hit = sorted[i];
      if (!hit){ p.lostFor += dt; if (p.lostFor > LOST_AFTER) p.present = false; continue; }
      const mirrored = hit.lm.map(k => ({ x: 1 - k.x, y: k.y, z: k.z, v: k.visibility }));
      this._apply(p, mirrored, dt);
      p.lostFor = 0; p.present = true;
    }
  },

  _apply(p, lm, dt){
    if (!p.lm){ p.lm = lm.map(k => ({...k})); }
    else {
      for (let i = 0; i < lm.length; i++){
        p.lm[i].x += (lm[i].x - p.lm[i].x) * SMOOTH;
        p.lm[i].y += (lm[i].y - p.lm[i].y) * SMOOTH;
        p.lm[i].v  = lm[i].v;
      }
    }
    const hip = { x:(p.lm[L.L_HIP].x + p.lm[L.R_HIP].x)/2, y:(p.lm[L.L_HIP].y + p.lm[L.R_HIP].y)/2 };
    const sh  = { x:(p.lm[L.L_SHOULDER].x + p.lm[L.R_SHOULDER].x)/2,
                  y:(p.lm[L.L_SHOULDER].y + p.lm[L.R_SHOULDER].y)/2 };
    p.centre = { x:(hip.x + sh.x)/2, y:(hip.y + sh.y)/2 };
    p.scale  = Math.max(0.08, Math.hypot(hip.x - sh.x, hip.y - sh.y) * 2.4);

    this._hand(p.hands.left,  p.lm[L.L_WRIST], dt);
    this._hand(p.hands.right, p.lm[L.R_WRIST], dt);
  },

  /* Speed is what Fruit Fury and Bubble Keeper read, so it is kept in
     screen-widths per second rather than pixels: the same swing scores the
     same on any size of television. */
  _hand(h, k, dt){
    const nx = k.x, ny = k.y, d = Math.max(dt, 1/120);
    h.vx = (nx - h.x) / d; h.vy = (ny - h.y) / d;
    h.speed = Math.hypot(h.vx, h.vy);
    h.x = nx; h.y = ny;
  },

  _decay(dt){
    for (const p of this.players){ if (!p.present) continue; p.lostFor += dt; }
  },

  _mouseUpdate(dt){
    const p = this.players[0];
    p.present = true; p.lostFor = 0;
    this._hand(p.hands.right, { x:this.mouse.x, y:this.mouse.y }, dt);
    p.hands.left.x = this.mouse.x; p.hands.left.y = this.mouse.y;
    p.centre = { x:this.mouse.x, y:Math.min(0.9, this.mouse.y + 0.2) };
    p.scale = 0.3;
    this.players[1].present = false;
    this.personCount = 1;
  },

  /* The cursor hand. Right wrist by default, but a hand that has gone missing
     should not drag the cursor into a corner, so fall back to the other. */
  cursorHand(p){
    const r = p.lm ? p.lm[L.R_WRIST] : null, l = p.lm ? p.lm[L.L_WRIST] : null;
    if (this.mouse.active) return p.hands.right;
    if (r && l) return (r.v ?? 1) >= (l.v ?? 1) ? p.hands.right : p.hands.left;
    return p.hands.right;
  },

  /* A body counts as fully in frame when head, hips and at least one ankle are
     visible with room to spare - that is the thing calibration waits for. */
  fullBody(p){
    if (!p.lm || !p.present) return false;
    const seen = (i) => (p.lm[i].v ?? 1) > 0.5;
    const inFrame = (i) => p.lm[i].y > 0.02 && p.lm[i].y < 0.99;
    return seen(L.NOSE) && inFrame(L.NOSE) &&
           seen(L.L_HIP) && seen(L.R_HIP) &&
           (seen(L.L_ANKLE) || seen(L.R_ANKLE));
  }
};
