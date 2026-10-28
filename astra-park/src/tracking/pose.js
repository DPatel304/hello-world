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

/* Players and watchers. Everyone the camera can see is looked at, but only
   someone standing up, and about as close to the TV as the nearest person,
   joins in: a grown-up on the sofa is sitting, and further back. Once in, a
   player is followed by where they are rather than by their place in the
   line, so a squat in Animal Copycat doesn't drop them; sitting down or
   stepping back for WATCH_AFTER seconds does. */
export const SEEN_MAX = 4;          /* people the camera looks for at once */
export const CLOSE = 0.6;           /* body size, as a share of the biggest in view, to count as close */
export const SEATED = 0.45;         /* knee drop below the hips, in torso lengths, under which you're sitting */
export const WATCH_AFTER = 4;       /* seconds sitting or back before a player becomes a watcher */
const MATCH = 0.25;                 /* how far a player can move between detections and still be them */
const SAME = 0.5;                   /* torso lengths apart under which two skeletons are one person */
/* One head, one person. Two skeletons whose heads are within HEAD_SAME
   torso lengths are the same person, however their hips disagree; a
   newcomer whose head is within HEAD_TAKEN of a player's is that player,
   not someone new; and a player lost for a moment picks their body up again
   by its head, within REFIND of where it was. */
export const HEAD_SAME = 0.4, HEAD_TAKEN = 0.6, REFIND = 0.35;
/* Joining takes a face and a moment. Phantoms - a coat on a chair, a
   shadow, a reflection, a glitch for a few frames - rarely show a clear
   face and rarely last; a child does both. Once in, a player stays in
   whichever way they face. */
export const JOIN_AFTER = 0.5;      /* seconds seen steadily, face and all, before joining */
const FACE_SEEN = 0.7;              /* landmark confidence that counts as clearly seen */

/* Where a head is: the nose, or between the eyes, or the ears; failing
   all those, just above the shoulders. */
export function headOf(lm){
  const seen = (k) => lm[k] && (lm[k].v ?? lm[k].visibility ?? 1) > 0.5;
  const mid = (a, b) => ({ x: (lm[a].x + lm[b].x) / 2, y: (lm[a].y + lm[b].y) / 2 });
  if (seen(L.NOSE)) return { x: lm[L.NOSE].x, y: lm[L.NOSE].y };
  if (seen(L.L_EYE) && seen(L.R_EYE)) return mid(L.L_EYE, L.R_EYE);
  if (seen(7) && seen(8)) return mid(7, 8);
  const sh = mid(L.L_SHOULDER, L.R_SHOULDER);
  return { x: sh.x, y: sh.y - sizeOf(lm) * 0.35 };
}
const apart = (a, b) => Math.hypot((a.x - b.x) * 16 / 9, a.y - b.y);

/* The model sometimes reports one person twice, two skeletons nearly on top
   of each other - or sharing a head with the hips somewhere else. Keep the
   clearer of any pair whose shoulders and hips both sit within half a torso
   of each other, or whose heads are within HEAD_SAME. */
export function onePerPerson(people){
  const mid = (lm, a, b) => ({ x: (lm[a].x + lm[b].x) / 2, y: (lm[a].y + lm[b].y) / 2 });
  const vis = (lm) => lm.reduce((s, k) => s + (k.v ?? k.visibility ?? 1), 0);
  const kept = [];
  for (const lm of [...people].sort((a, b) => vis(b) - vis(a))){
    const sh = mid(lm, L.L_SHOULDER, L.R_SHOULDER), hp = mid(lm, L.L_HIP, L.R_HIP), size = sizeOf(lm);
    const twin = kept.some(o => {
      const osh = mid(o, L.L_SHOULDER, L.R_SHOULDER), ohp = mid(o, L.L_HIP, L.R_HIP), s = Math.max(size, sizeOf(o)) * SAME;
      if (Math.hypot((sh.x - osh.x) * 16 / 9, sh.y - osh.y) < s && Math.hypot((hp.x - ohp.x) * 16 / 9, hp.y - ohp.y) < s) return true;
      return apart(headOf(lm), headOf(o)) < Math.max(size, sizeOf(o)) * HEAD_SAME;
    });
    if (!twin) kept.push(lm);
  }
  return kept;
}

/* A face the camera can clearly see: the nose and at least one eye, with
   the head above the shoulders. */
export function faceSeen(lm){
  const vis = (k) => (lm[k].v ?? lm[k].visibility ?? 1) > FACE_SEEN;
  const shY = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y) / 2;
  return vis(L.NOSE) && (vis(L.L_EYE) || vis(L.R_EYE)) && lm[L.NOSE].y < shY;
}

/* Torso length: shoulders to hips. Bigger is closer to the camera. */
export function sizeOf(lm){
  const sx = (lm[L.L_SHOULDER].x + lm[L.R_SHOULDER].x) / 2, sy = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y) / 2;
  const hx = (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2, hy = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2;
  return Math.hypot((hx - sx) * 16 / 9, hy - sy);
}

/* Sitting: the knees are nearly level with the hips, because the thighs
   point at the camera. With no knee in sight there's no telling, and it
   counts as standing - a child up close often has their legs out of frame. */
export function seated(lm){
  const vis = (k) => (lm[k].v ?? lm[k].visibility ?? 1) > 0.5;
  const knees = [L.L_KNEE, L.R_KNEE].filter(vis);
  if (!knees.length) return false;
  const hipY = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2;
  const drop = knees.reduce((a, k) => a + lm[k].y, 0) / knees.length - hipY;
  return drop < SEATED * sizeOf(lm);
}

/* Up to four play at once, each in their own colour. */
export const MAX_PLAYERS = 4;
export const PLAYER_COLORS = ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'];

function blank(i){
  return {
    id:i, color:PLAYER_COLORS[i], present:false, lostFor:99, watching:0, at:null,
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
  ready:false, usingCamera:false, reason:'', detail:'', activeId:'',
  players:Array.from({ length: MAX_PLAYERS }, (_, i) => blank(i)),
  personCount:0,             /* players: people in the game */
  seenCount:0,               /* everyone the camera can see, watchers too */
  /* Measured, not declared. "Will it run on a Pi" is a question about these
     three numbers and nothing else, so the app has to be able to answer it on
     whatever machine it is sitting on. */
  fps:0, inferMs:0, _hits:0, _since:0,

  /* Mouse stands in for a body when there is no camera: the whole interface is
     hover-driven, so a pointer can reach everything a hand can. Without it the
     app is untestable on any machine that cannot see a person. */
  mouse:{ active:false, x:.5, y:.5 },

  async start(video, { forceMouse = false } = {}){
    this.video = video;
    if (forceMouse){ this.reason = 'debug'; this.enableMouse(); return false; }
    try {
      /* Ask for the remembered camera by id. The moment a second one exists -
         a phone running Camo, a USB webcam beside the laptop's built-in -
         whatever Windows calls default is as likely to be the wrong one, and
         without this there is no way to say otherwise. An id that has gone
         away is `ideal`, not `exact`, so an unplugged camera degrades to the
         default instead of refusing to start. */
      const want = this.preferred();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: Object.assign(
          { width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30} },
          want ? { deviceId:{ ideal: want } } : {}),
        audio:false
      });
      this.activeId = stream.getVideoTracks()[0].getSettings().deviceId || '';
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
        runningMode:'VIDEO', numPoses:SEEN_MAX,
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

  /* Labels only come back once permission has been granted, which is why the
     picker lives in Settings rather than in front of the first run. */
  async cameras(){
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter(d => d.kind === 'videoinput')
                .map((d, i) => ({ id:d.deviceId, label:d.label || ('Camera ' + (i + 1)) }));
    } catch (e){ return []; }
  },

  preferred(){
    try { return localStorage.getItem('astrapark_camera') || ''; } catch (e){ return ''; }
  },

  async use(deviceId){
    try { localStorage.setItem('astrapark_camera', deviceId); } catch (e){}
    try { this.video.srcObject.getTracks().forEach(t => t.stop()); } catch (e){}
    const stream = await navigator.mediaDevices.getUserMedia({
      video:{ deviceId:{ exact: deviceId }, width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30} },
      audio:false
    });
    this.video.srcObject = stream;
    await this.video.play();
    this.activeId = deviceId;
    /* The new camera sees a different room: everything learned about the old
       one is wrong, so start the players over. */
    for (const p of this.players){ p.lm = null; p.present = false; p.lostFor = 99; }
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
    /* Wall clock, not dt: the loop clamps dt to 50ms so a frame that really
       took 600ms is reported as 50, which inflated this rate elevenfold and
       had the readout claiming 20fps next to a 570ms inference. */
    const wall = performance.now();
    if (!this._since) this._since = wall;
    if (wall - this._since > 500){
      this.fps = this._hits * 1000 / (wall - this._since);
      this._hits = 0; this._since = wall;
    }
    if (v.currentTime === this._lastT) { this._decay(dt); return; }
    this._lastT = v.currentTime;

    let res;
    const t0 = performance.now();
    try { res = this.lm.detectForVideo(v, nowMs); }
    catch (e){ return; }
    /* Smoothed, because a single inference tells you nothing useful. */
    this.inferMs += (performance.now() - t0 - this.inferMs) * 0.1;
    this._hits++;

    const found = (res && res.landmarks) ? res.landmarks : [];
    this._assign(found.map(lm => lm.map(k => ({ x: 1 - k.x, y: k.y, z: k.z, v: k.visibility }))), dt);
  },

  /* Who's who. Landmarks arrive mirrored, so screen left is the player's own
     left as they face the TV. */
  _assign(people, dt){
    people = onePerPerson(people);
    this.seenCount = people.length;
    const biggest = Math.max(0, ...people.map(sizeOf));
    const dets = people.map(lm => ({
      lm, taken: false,
      x: (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2, y: (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2,
      playing: !seated(lm) && sizeOf(lm) >= CLOSE * biggest,
      close: sizeOf(lm) >= CLOSE * biggest,
      face: faceSeen(lm), head: headOf(lm), size: sizeOf(lm)
    }));

    /* Players already in keep following their own body: whoever is nearest
       to where they were heading. Heading matters when two children cross. */
    const pairs = [];
    this.players.forEach((p, i) => {
      if (!p.present || !p.at) return;
      const k = Math.min(p.lostFor + dt, 0.5), px = p.at.x + p.at.vx * k, py = p.at.y + p.at.vy * k;
      dets.forEach((d, j) => { const dist = Math.hypot(d.x - px, d.y - py); if (dist < MATCH) pairs.push({ i, j, dist }); });
    });
    pairs.sort((a, b) => a.dist - b.dist);
    const matched = new Set();
    for (const { i, j } of pairs){
      if (matched.has(i) || dets[j].taken) continue;
      matched.add(i); dets[j].taken = true;
      const p = this.players[i], d = dets[j];
      p.head = d.head;
      this._apply(p, d.lm, dt);
      this._track(p, d, dt + p.lostFor);
      p.lostFor = 0;
      /* In a game that says so (squats are a move in Tower Defense), a
         player who sits or crouches stays in; stepping back still counts. */
      p.watching = d.playing || (this.keepSitters && d.close) ? 0 : p.watching + dt;
      if (p.watching > WATCH_AFTER){ p.present = false; p.lm = null; p.watching = 0; }
    }
    /* A player not found where their hips were heading - they moved fast,
       or the hips were misread - picks up a body left over by its head. */
    this.players.forEach((p, i) => {
      if (matched.has(i) || !p.present || !p.head) return;
      let best = null, bd = REFIND;
      for (const d of dets){ if (d.taken) continue; const dist = apart(d.head, p.head); if (dist < bd){ bd = dist; best = d; } }
      if (!best) return;
      matched.add(i); best.taken = true; p.head = best.head;
      this._apply(p, best.lm, dt); p.at = null; this._track(p, best, dt);
      p.lostFor = 0;
    });
    /* Everyone in the game who wasn't seen this time ages toward gone. */
    this.players.forEach((p, i) => {
      if (matched.has(i) || !p.present) return;
      p.lostFor += dt;
      if (p.lostFor > LOST_AFTER) p.present = false;
    });
    /* Newcomers: someone standing up front with their face in view is a
       candidate, followed from frame to frame; one seen steadily for
       JOIN_AFTER takes an empty place, left to right. A candidate who
       flickers out for more than a moment starts again. */
    const cands = this._cands || (this._cands = []);
    for (const c of cands) c.hit = null;
    /* A body whose head is a player's - even one lost for a moment - is
       that player, never a newcomer. */
    const heads = this.players.filter(p => p.present && p.head).map(p => p.head);
    for (const d of dets){
      if (d.taken || !d.playing || !d.face) continue;
      if (heads.some(h => apart(h, d.head) < d.size * HEAD_TAKEN)) continue;
      let best = null, bd = MATCH;
      for (const c of cands){ const dist = Math.hypot(d.x - c.x, d.y - c.y); if (!c.hit && dist < bd){ bd = dist; best = c; } }
      if (!best){ best = { x: d.x, y: d.y, seen: 0, miss: 0 }; cands.push(best); }
      best.hit = d; best.x = d.x; best.y = d.y; best.seen += dt; best.miss = 0;
    }
    for (const c of cands) if (!c.hit) c.miss += dt;
    this._cands = cands.filter(c => c.miss < 0.25);
    const free = this.players.filter(p => !p.present);
    const joiners = this._cands.filter(c => c.hit && c.seen >= JOIN_AFTER).map(c => c.hit).sort((a, b) => a.x - b.x);
    for (const d of joiners) this._cands = this._cands.filter(c => c.hit !== d);
    for (const p of free){
      const d = joiners.shift();
      if (!d) break;
      p.lm = null; this._apply(p, d.lm, dt); p.head = d.head;
      p.at = null; this._track(p, d, dt);
      p.present = true; p.lostFor = 0; p.watching = 0;
    }
    this.personCount = this.players.filter(p => p.present).length;
  },

  /* Where a player's hips are and how they're moving, unsmoothed. */
  _track(p, d, dt){
    if (!p.at){ p.at = { x: d.x, y: d.y, vx: 0, vy: 0 }; return; }
    const t = Math.max(dt, 1 / 120), k = 0.5;
    p.at.vx += ((d.x - p.at.x) / t - p.at.vx) * k; p.at.vy += ((d.y - p.at.y) / t - p.at.vy) * k;
    p.at.x = d.x; p.at.y = d.y;
  },

  _apply(p, lm, dt){
    if (!p.lm){ p.lm = lm.map(k => ({...k})); }
    else {
      for (let i = 0; i < lm.length; i++){
        p.lm[i].x += (lm[i].x - p.lm[i].x) * SMOOTH;
        p.lm[i].y += (lm[i].y - p.lm[i].y) * SMOOTH;
        /* Depth too - nearer the camera is smaller - for leaning toward or
           away from the screen. */
        p.lm[i].z = (p.lm[i].z ?? 0) + ((lm[i].z ?? 0) - (p.lm[i].z ?? 0)) * SMOOTH;
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

  /* Speed is for games that care how hard a hand moves, so it is kept in
     screen-widths per second rather than pixels: the same swing scores the
     same on any size of television. */
  _hand(h, k, dt){
    const nx = k.x, ny = k.y, d = Math.max(dt, 1/120);
    h.vx = (nx - h.x) / d; h.vy = (ny - h.y) / d;
    h.speed = Math.hypot(h.vx, h.vy);
    h.x = nx; h.y = ny;
  },

  /* No new video frame means no detection ran. Ageing the players here matters:
     without it a frozen or unplugged camera leaves everyone marked present
     forever, and the game waits for a motionless person who is not there. */
  _decay(dt){
    for (const p of this.players){
      if (!p.present) continue;
      p.lostFor += dt;
      if (p.lostFor > LOST_AFTER * 4) p.present = false;
    }
  },

  _mouseUpdate(dt){
    const p = this.players[0];
    p.present = true; p.lostFor = 0;
    this._hand(p.hands.right, { x:this.mouse.x, y:this.mouse.y }, dt);
    p.hands.left.x = this.mouse.x; p.hands.left.y = this.mouse.y;
    p.centre = { x:this.mouse.x, y:Math.min(0.9, this.mouse.y + 0.2) };
    p.scale = 0.3;
    for (const q of this.players.slice(1)) q.present = false;
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

  /* Enough of a body in frame to play: head, both hips, and a knee or an ankle.
     Measured against live landmarks rather than guessed - ankle visibility on a
     standing figure swings between 0.26 and 0.93 frame to frame, so demanding
     0.5 at both ankles strands people on the calibration screen with the
     camera plainly working. Knees carry the same information (if a knee is in
     frame you are standing back far enough) and are steadier. */
  fullBody(p){
    if (!p.lm || !p.present) return false;
    const seen = (i) => (p.lm[i].v ?? 1) > 0.3;
    const inFrame = (i) => p.lm[i].y > 0.02 && p.lm[i].y < 0.99;
    const legs = seen(L.L_KNEE) || seen(L.R_KNEE) || seen(L.L_ANKLE) || seen(L.R_ANKLE);
    return seen(L.NOSE) && inFrame(L.NOSE) && seen(L.L_HIP) && seen(L.R_HIP) && legs;
  }
};
