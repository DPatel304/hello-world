/* Last Known Position - the move guide: a little stick man at the top
   right, under the XP bar, there only to show the move to make right now -
   clapping when someone needs reviving, hands up before the zip line,
   ducking for a branch, hugging in the healing water... He slides in when
   there's something to do, acts it out over and over with its name under
   him, and steps away again when there isn't.

   guideMove(game) says which move (or null); drawGuide draws him. */
import { RUN } from './lkp-art.js';

/* Each move, and the word under him. */
export const MOVES = {
  clap: 'CLAP!', handsup: 'HANDS UP!', hop: 'HOP!', duck: 'DUCK!', lean: 'LEAN!', hug: 'HUG!',
  roll: 'ROLL YOUR ARMS!', run: 'RUN ON THE SPOT!', freeze: 'FREEZE!', reach: 'REACH!', wiggle: 'WIGGLE!', ear: 'HAND TO EAR', pick: 'LEAN, THEN WAVE'
};

/* What should the crew be doing, right now? The most urgent first. */
export function guideMove(g){
  const sc = g.scene;
  if (sc){
    if (sc.kind !== 'intro') return null;
    const here = g.here;
    if (sc.stage === 'wake' || sc.stage === 'hands') return 'wiggle';
    if (sc.stage === 'call' && here.some(i => !sc.answered[i])) return 'ear';
    return null;
  }
  if (g.over) return null;
  if (g.levelup) return 'pick';
  const crew = g.here.map(i => g.crew[i]);
  /* someone to wake or to pop out of a bubble */
  if (g.fight && !g.fight.done && crew.some(rn => rn.down)) return 'clap';
  /* the tutorial fight: the move of the lesson */
  if (g.fight && g.fight.tutorial && !g.fight.done){ const m = [null, 'hop', 'roll'][Math.min(2, g.fight.wave)]; if (m) return m; }
  const zip = g.zip;
  if (crew.some(rn => rn.bubble) && !(zip && zip.riding)) return 'clap';
  if (zip){
    if (zip.phase === 'ready' || ((zip.phase === 'late' || zip.phase === 'ride') && zip.since < 1.5 && g.here.some(i => !zip.holding(i)))) return 'handsup';
    if (zip.riding) return 'lean';
    return null;
  }
  const ride = g.ride;
  if (ride){
    if (ride.phase === 'chase') return 'run';
    return null;
  }
  if (g.rest) return 'hug';
  if (g.trap && !g.trap.done) return g.trap.light === 'green' ? 'run' : 'freeze';
  if (g.treasure && !g.treasure.done) return g.treasure.pool > 0 ? 'hug' : 'reach';
  if (g.leap) return g.leap.phase === 'ready' ? 'hop' : null;
  const seg = g.seg;
  if (seg.kind === 'cross' && seg.choice == null) return 'lean';
  if (seg.kind === 'corridor'){
    /* the next thing coming, if it's close */
    let best = null, near = 0.55;
    for (const th of g.things){
      const ahead = th.d - g.z - RUN;
      if (ahead < -0.02 || ahead > near || th.got) continue;
      const m = th.kind === 'beam' ? 'duck' : th.kind === 'ravine' && !th.taken ? 'hop' : th.kind === 'blocker' || th.kind === 'roller' ? 'lean' : null;
      if (m){ best = m; near = ahead; }
    }
    return best;
  }
  return null;
}

/* The little man, at (x, y) (his hips), s tall-ish, doing move at time t. */
/* How short his body and legs are (against a plain stick man), and his
   arms. */
const SQUAT = 0.55, ARM = 0.9;
export function figure(c, x, y, s, move, t){
  /* joints, in his own units: hips at 0, head up at -0.58, feet at 0.45 */
  let hip = [0, 0], neck = [0, -0.42], tilt = 0, lift = 0;
  let arms = [[[-0.13, -0.2], [-0.15, 0.02]], [[0.13, -0.2], [0.15, 0.02]]];   /* [elbow, hand] left, right */
  let legs = [[[-0.07, 0.22], [-0.1, 0.45]], [[0.07, 0.22], [0.1, 0.45]]];       /* [knee, foot] */
  const w = (k) => Math.sin(t * k), wa = (k) => Math.abs(Math.sin(t * k));
  switch (move){
    case 'clap': {
      const o = 0.03 + 0.16 * wa(Math.PI * 2);
      arms = [[[-0.16, -0.28], [-o, -0.26]], [[0.16, -0.28], [o, -0.26]]];
      if (o < 0.06){
        /* (the clap: where the hands meet, squashed like the rest of him) */
        const cy = y + (-0.42 * SQUAT + (-0.26 + 0.42) * ARM) * s;
        c.strokeStyle = '#ffd24a'; c.lineWidth = s * 0.025; for (const a of [-0.6, 0, 0.6]){ c.beginPath(); c.moveTo(x + Math.sin(a) * s * 0.1, cy - Math.cos(a) * s * 0.1); c.lineTo(x + Math.sin(a) * s * 0.18, cy - Math.cos(a) * s * 0.18); c.stroke(); }
      }
      break;
    }
    case 'handsup': lift = 0.03 * wa(4); arms = [[[-0.15, -0.62], [-0.1, -0.84]], [[0.15, -0.62], [0.1, -0.84]]]; break;
    case 'hop': {
      const h = Math.max(0, w(Math.PI * 1.6)); lift = 0.28 * h;
      const bend = 1 - h; legs = [[[-0.12, 0.2 - 0.06 * bend], [-0.08, 0.45 - 0.12 * bend]], [[0.12, 0.2 - 0.06 * bend], [0.08, 0.45 - 0.12 * bend]]];
      arms = [[[-0.18, -0.36], [-0.2, -0.55 * h]], [[0.18, -0.36], [0.2, -0.55 * h]]];
      break;
    }
    case 'duck': {
      const d = 0.22 * wa(Math.PI * 0.9);
      hip = [0, d]; neck = [0, -0.42 + d * 1.15];
      legs = [[[-0.2 * (d / 0.22) - 0.07, 0.22], [-0.1, 0.45]], [[0.2 * (d / 0.22) + 0.07, 0.22], [0.1, 0.45]]];
      arms = [[[-0.14, -0.15 + d], [-0.16, 0.05 + d]], [[0.14, -0.15 + d], [0.16, 0.05 + d]]];
      break;
    }
    case 'lean': tilt = 0.38 * w(2.2); arms = [[[-0.18, -0.26], [-0.28, -0.12]], [[0.18, -0.26], [0.28, -0.12]]]; break;
    case 'hug': tilt = 0.06 * w(3); arms = [[[-0.15, -0.24], [0.1, -0.34]], [[0.15, -0.24], [-0.1, -0.32]]]; break;
    case 'run': {
      const a = w(Math.PI * 3);
      legs = [[[-0.07, 0.2 - 0.16 * Math.max(0, a)], [-0.09, 0.45 - 0.22 * Math.max(0, a)]], [[0.07, 0.2 - 0.16 * Math.max(0, -a)], [0.09, 0.45 - 0.22 * Math.max(0, -a)]]];
      arms = [[[-0.15, -0.22], [-0.13 + 0.06 * a, -0.08 - 0.14 * a]], [[0.15, -0.22], [0.13 + 0.06 * a, -0.08 + 0.14 * a]]];
      lift = 0.03 * Math.abs(a);
      break;
    }
    case 'roll': {
      /* arms rolling round each other, in front - the wheels on the bus */
      const a = t * 9;
      arms = [[[-0.16, -0.3], [-0.04 + Math.cos(a) * 0.1, -0.3 + Math.sin(a) * 0.1]], [[0.16, -0.3], [0.04 + Math.cos(a + Math.PI) * 0.1, -0.3 + Math.sin(a + Math.PI) * 0.1]]];
      break;
    }
    case 'freeze': arms = [[[-0.2, -0.3], [-0.32, -0.24]], [[0.2, -0.3], [0.32, -0.24]]]; break;
    case 'reach': {
      const a = w(Math.PI * 1.4);
      arms = [[[-0.18, -0.55 - 0.08 * a], [-0.28, -0.8 - 0.12 * a]], [[0.18, -0.55 + 0.08 * a], [0.28, -0.8 + 0.12 * a]]];
      break;
    }
    case 'wiggle': tilt = 0.25 * w(18); arms = [[[-0.2, -0.3 + 0.1 * w(14)], [-0.3, -0.4 + 0.2 * w(16)]], [[0.2, -0.3 - 0.1 * w(14)], [0.3, -0.4 - 0.2 * w(15)]]]; break;
    case 'ear': arms = [[[-0.13, -0.2], [-0.15, 0.02]], [[0.2, -0.42], [0.1, -0.56]]]; break;
    case 'pick': {
      /* lean a moment, then wave */
      const ph = (t % 2.4) / 2.4;
      if (ph < 0.5) tilt = 0.35 * Math.sin(ph * 2 * Math.PI * 2);
      else arms = [[[-0.13, -0.2], [-0.15, 0.02]], [[0.2, -0.55], [0.22 + 0.12 * w(14), -0.8]]];
      break;
    }
  }
  /* Squat: the body and legs squashed short, the arms kept long - it's the
     arms that show the move. */
  const sq = ([px, py]) => [px * 1.15, py * SQUAT];
  const nk = sq(neck);
  const am = ([px, py]) => [nk[0] + (px - neck[0]) * ARM * 1.1, nk[1] + (py - neck[1]) * ARM];
  arms = arms.map(([e, h]) => [am(e), am(h)]);
  legs = legs.map(([k, f]) => [sq(k), sq(f)]);
  hip = sq(hip); neck = nk; lift *= SQUAT;
  const pt = ([px, py]) => {
    /* tilting at the hips (the upper body), then lifted */
    if (py < hip[1] && tilt){ const dx = px - hip[0], dy = py - hip[1]; return [x + (hip[0] + dx * Math.cos(tilt) - dy * Math.sin(tilt)) * s, y + (hip[1] + dx * Math.sin(tilt) + dy * Math.cos(tilt) - lift) * s]; }
    return [x + px * s, y + (py - lift) * s];
  };
  const line = (pts) => { c.beginPath(); pts.map(pt).forEach(([a, b], k) => (k ? c.lineTo(a, b) : c.moveTo(a, b))); c.stroke(); };
  c.strokeStyle = '#ffffff'; c.lineWidth = s * 0.055; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [k, f] of legs) line([hip, k, f]);
  line([hip, neck]);
  for (const [e, h] of arms) line([neck, e, h]);
  /* hands: dots, so a clap reads */
  c.fillStyle = '#ffffff';
  for (const [, h] of arms){ const q = pt(h); c.beginPath(); c.arc(q[0], q[1], s * 0.04, 0, 6.2832); c.fill(); }
  /* the head, clear of the shoulders, on a short neck */
  line([neck, [neck[0], neck[1] - 0.05]]);
  const hd = pt([neck[0], neck[1] - 0.16]);
  c.beginPath(); c.arc(hd[0], hd[1], s * 0.115, 0, 6.2832); c.fill();
}

/* Each step: what to show, sliding in when there's a move, out when
   there isn't. (Its state kept on the game.) */
export function stepGuide(g, dt){
  const st = g._guide || (g._guide = { move: null, a: 0, t: 0 });
  const want = guideMove(g);
  if (want){ if (want !== st.move) st.t = 0; st.move = want; }
  st.a = Math.max(0, Math.min(1, st.a + (want ? dt * 4 : -dt * 3)));
  st.t += dt;
}
/* The panel, top right under the XP bar. */
export function drawGuide(c, W, H, g){
  const st = g._guide;
  if (!st || st.a <= 0 || !st.move) return;
  const pw = H * 0.17, ph = H * 0.16, ease = st.a * st.a * (3 - 2 * st.a);
  const x = W - H * 0.04 - pw + (1 - ease) * (pw + H * 0.06), y = H * 0.13;
  c.save(); c.globalAlpha = ease;
  c.fillStyle = 'rgba(5,6,15,.72)'; c.beginPath(); c.roundRect(x, y, pw, ph, H * 0.025); c.fill();
  c.strokeStyle = 'rgba(127,243,255,.5)'; c.lineWidth = Math.max(1.5, H * 0.003); c.stroke();
  figure(c, x + pw / 2, y + ph * 0.56, ph * 0.6, st.move, st.t);
  const word = MOVES[st.move];
  c.font = `700 ${Math.round(H * (word.length > 10 ? 0.016 : 0.022))}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#ffd24a'; c.fillText(word, x + pw / 2, y + ph * 0.88);
  c.restore();
}
