/* Last Known Position's characters, drawn properly - for any level with a
   world look (lkp-world.js); the greybox (lkp-art.js) draws them
   otherwise. All lit from the left, like everything else.

     crew     sleek suits all in each player's colour, seen from behind -
              glowing trim at the joints, a pack outlined in light
     beasts   the planet's wildlife: round fluffy puffballs with big amber
              eyes and a glowing flower on top - grumpy, not scary
     robots   gunmetal, on one wheel, a dark visor with one red eye
     Nova     the Commander, on her comms feed */
import { glow, mix, rgba } from './lkp-world.js';

const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, 6.2832); c.fill(); };
const INK = '#1a1830';
/* mix, as #rrggbb (for glow, which wants hex) */
const hexMix = (a, b, k) => '#' + mix(a, b, k).slice(4, -1).split(',').map(v => (+v).toString(16).padStart(2, '0')).join('');

/* ---------- the crew ---------- */

/* A crew member, h tall, feet at (x, base), seen from behind as they run
   into the world: a sleek suit all in their own colour - darker panel
   lines, a glowing trim at the elbows, knees and ankles, a small pack on
   the back outlined in light, a rounded helmet with an antenna. Same st as
   lkp-art.js drawCrew (and st.run, st.runPh: the stride). pose: 'reach'
   (an arm up), 'hug' (arms wrapped round themselves), 'hang' (both arms
   up, holding on overhead), 'stretch' (no arms -
   someone else draws them), 'sit' (sat astride something at (x, base),
   legs hanging down either side, hands resting on it), else at their
   sides - or pumping, running. */
export function worldCrew(c, x, base, h, t, col, st, face, pose = null){
  const u = h / 330, f = 1 - (st.duck || 0) * 0.4;
  const run = st.run || 0, ph = st.runPh || 0;
  const lite = mix(col, '#ffffff', 0.28), dark = mix(col, '#0a0f2a', 0.38), deep = mix(col, '#05081a', 0.55), line = mix(col, '#05081a', 0.62);
  const gl = hexMix(col, '#ffffff', 0.62);
  if (!st.flying){ c.fillStyle = 'rgba(20,15,45,.4)'; c.beginPath(); c.ellipse(x, base, 70 * u, 15 * u, 0, 0, 6.2832); c.fill(); }
  /* a puff of dust kicked up behind each foot as it pushes off */
  if (run > 0.2 && !st.air) for (const d of [-1, 1]){
    const k = (((ph + (d < 0 ? Math.PI : 0)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / Math.PI;
    if (k > 1) continue;
    c.fillStyle = `rgba(225,215,235,${0.4 * (1 - k) * run})`;
    circ(c, x + d * (24 + 26 * k) * u, base - (6 + 20 * k) * u, (9 + 20 * k) * u);
  }
  if (st.heal > 0) glow(c, x, base - st.air - 160 * u, 200 * u, '#5fe3ff', 0.7 * st.heal);
  const bounce = run * Math.abs(Math.sin(ph)) * 10 * u;
  c.save();
  c.translate(x, base - st.air - bounce); c.rotate(st.lean * 0.2 + run * Math.sin(ph) * 0.04);
  const dn = st.down === true ? 1 : +st.down || 0;
  if (dn > 0){ c.translate(h * 0.42 * dn, -h * 0.14 * dn); c.rotate(-Math.PI / 2 * dn); if (st.down === true) c.globalAlpha = 0.6; }
  if (st.lost) c.globalAlpha = 0.35;
  else if (st.blink && Math.floor(t * 12) % 2) c.globalAlpha = 0.5;
  c.scale(1, f);
  /* (sitting: the seat is where the hips are) */
  if (pose === 'sit') c.translate(0, 120 * u);
  c.lineCap = 'round'; c.lineJoin = 'round';
  /* a limb: a dark edge, its colour, lit down one side */
  const limb = (pts, w, side = -1) => {
    for (const [lw, sc] of [[w + 6 * u, line], [w, col]]){ c.strokeStyle = sc; c.lineWidth = lw; c.beginPath(); pts.forEach(([a, b], k) => (k ? c.lineTo(a, b) : c.moveTo(a, b))); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = w * 0.35;
    c.beginPath(); pts.forEach(([a, b], k) => (k ? c.lineTo(a + side * w * 0.22, b) : c.moveTo(a + side * w * 0.22, b))); c.stroke();
  };
  const trim = (x0, y0, w) => { glow(c, x0, y0, w * 1.4, gl, 0.5); c.strokeStyle = gl; c.lineWidth = 4 * u; c.beginPath(); c.ellipse(x0, y0, w * 0.55, w * 0.18, 0, 0, Math.PI); c.stroke(); };
  /* legs: running, one planted, the other's heel kicking up behind -
     its sole towards us */
  if (pose === 'sit') for (const d of [-1, 1]){
    /* astride: thighs out over its sides, shins hanging down, swinging a little */
    const swing = Math.sin(t * 1.6 + d) * 6 * u;
    const hip = [d * 22 * u, -128 * u], knee = [d * 70 * u, -112 * u], foot = [d * 78 * u + swing, -40 * u];
    limb([hip, knee], 31 * u); limb([knee, foot], 25 * u);
    trim(knee[0], knee[1] + 4 * u, 30 * u);
    c.fillStyle = dark; c.beginPath(); c.ellipse(foot[0], foot[1], 17 * u, 12 * u, 0, 0, 6.2832); c.fill();
  }
  else for (const d of [-1, 1]){
    const lift = run * Math.max(0, Math.sin(ph + (d < 0 ? 0 : Math.PI)));
    const hip = [d * 22 * u, -128 * u], knee = [d * 25 * u, (-68 - 26 * lift) * u], foot = [d * (23 + 4 * lift) * u, (-12 - 78 * lift) * u];
    limb([hip, knee], 31 * u); limb([knee, foot], 25 * u);
    trim(knee[0], knee[1] + 4 * u, 30 * u);
    /* the boot: heel down, or its sole up at us */
    c.fillStyle = lift > 0.3 ? deep : dark;
    c.beginPath(); c.ellipse(foot[0], foot[1] + (lift > 0.3 ? 0 : 4 * u), (17 + 4 * lift) * u, (11 + 9 * lift) * u, 0, 0, 6.2832); c.fill();
    if (lift <= 0.3){ c.strokeStyle = gl; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(foot[0] - 15 * u, foot[1] - 6 * u); c.lineTo(foot[0] + 15 * u, foot[1] - 6 * u); c.stroke(); }
  }
  /* the body: a V from the shoulders to the waist, panel lines down it */
  const tg = c.createLinearGradient(-52 * u, 0, 52 * u, 0); tg.addColorStop(0, lite); tg.addColorStop(0.45, col); tg.addColorStop(1, dark);
  c.fillStyle = tg;
  c.beginPath(); c.moveTo(-50 * u, -232 * u); c.quadraticCurveTo(0, -242 * u, 50 * u, -232 * u); c.lineTo(36 * u, -170 * u); c.lineTo(32 * u, -122 * u); c.quadraticCurveTo(0, -112 * u, -32 * u, -122 * u); c.lineTo(-36 * u, -170 * u); c.closePath(); c.fill();
  c.strokeStyle = line; c.lineWidth = 3 * u; c.stroke();
  c.lineWidth = 2.5 * u; c.beginPath();
  c.moveTo(0, -165 * u); c.lineTo(0, -120 * u);
  c.moveTo(-32 * u, -150 * u); c.lineTo(-10 * u, -160 * u); c.moveTo(32 * u, -150 * u); c.lineTo(10 * u, -160 * u);
  c.moveTo(-28 * u, -128 * u); c.quadraticCurveTo(0, -140 * u, 28 * u, -128 * u);
  c.stroke();
  /* arms: at their sides; pumping, elbows bent, when they run */
  if (pose !== 'stretch') for (const d of [-1, 1]){
    const sh = [d * 46 * u, -222 * u];
    if (pose === 'sit'){ limb([sh, [d * 58 * u, -178 * u], [d * 52 * u, -132 * u]], 26 * u, d); trim(d * 58 * u, -178 * u, 22 * u); c.fillStyle = dark; circ(c, d * 52 * u, -128 * u, 14 * u); continue; }
    if (pose === 'hug'){ limb([sh, [d * 62 * u, -188 * u], [d * 30 * u, -178 * u]], 26 * u, d); trim(d * 62 * u, -186 * u, 22 * u); continue; }
    if (pose === 'hang'){ limb([sh, [d * 52 * u, -282 * u], [d * 26 * u, -334 * u]], 24 * u, d); trim(d * 52 * u, -282 * u, 22 * u); c.fillStyle = dark; circ(c, d * 26 * u, -338 * u, 14 * u); continue; }
    /* dusting themselves off: patting the fronts of their legs, one hand then the other */
    if (pose === 'dust'){ const k = Math.sin(t * 8 + (d < 0 ? 0 : Math.PI)); const elbow = [d * 66 * u, -172 * u], fist = [d * (34 - 6 * k) * u, (-112 + 16 * k) * u]; limb([sh, elbow], 22 * u, d); limb([elbow, fist], 19 * u, d); trim(elbow[0], elbow[1], 22 * u); c.fillStyle = dark; circ(c, fist[0], fist[1], 12 * u); continue; }
    /* checking themselves over: one arm held up in front, turned this way and that */
    if (pose === 'check' && d < 0){ const k = Math.sin(t * 2.2); limb([sh, [-70 * u, -196 * u], [(-34 + 6 * k) * u, -222 * u]], 22 * u, d); trim(-70 * u, -196 * u, 22 * u); c.fillStyle = dark; circ(c, (-34 + 6 * k) * u, -226 * u, 12 * u); continue; }
    /* a hand up at the side of the helmet: on the radio, listening */
    if (pose === 'ear' && d > 0){ limb([sh, [76 * u, -214 * u], [44 * u, -262 * u]], 22 * u, d); trim(76 * u, -214 * u, 22 * u); c.fillStyle = dark; circ(c, 44 * u, -266 * u, 13 * u); continue; }
    if (pose === 'reach' && d < 0){ limb([sh, [-62 * u, -270 * u], [-56 * u, -322 * u]], 26 * u); c.fillStyle = dark; circ(c, -56 * u, -326 * u, 15 * u); continue; }
    const p = run * Math.sin(ph + (d < 0 ? Math.PI : 0));
    const elbow = run > 0.2 ? [d * (66 + 8 * p) * u, (-176 + 12 * p) * u] : [d * 60 * u, -172 * u];
    const fist = run > 0.2 ? [d * (64 - 10 * p) * u, (-146 - 34 * p) * u] : [d * 62 * u, -128 * u];
    limb([sh, elbow], 22 * u, d); limb([elbow, fist], 19 * u, d);
    trim(elbow[0], elbow[1], 22 * u);
    c.fillStyle = dark; circ(c, fist[0], fist[1], 12 * u);
    c.fillStyle = col; circ(c, fist[0] - d * 2.5 * u, fist[1] - 2.5 * u, 7 * u);
  }
  /* the pack, outlined in light, straps over the shoulders */
  c.strokeStyle = line; c.lineWidth = 7 * u; c.beginPath(); c.moveTo(-26 * u, -226 * u); c.lineTo(-40 * u, -232 * u); c.moveTo(26 * u, -226 * u); c.lineTo(40 * u, -232 * u); c.stroke();
  glow(c, 0, -200 * u, 56 * u, gl, 0.35);
  c.fillStyle = dark; c.beginPath(); c.roundRect(-24 * u, -228 * u, 48 * u, 54 * u, 12 * u); c.fill();
  c.fillStyle = col; c.beginPath(); c.roundRect(-19 * u, -223 * u, 38 * u, 44 * u, 9 * u); c.fill();
  c.strokeStyle = gl; c.lineWidth = 3 * u; c.beginPath(); c.roundRect(-21.5 * u, -225.5 * u, 43 * u, 49 * u, 10 * u); c.stroke();
  c.strokeStyle = line; c.lineWidth = 2.5 * u; c.beginPath();
  for (const k of [-7, 0, 7]){ c.moveTo((k - 2.5) * u, -186 * u); c.lineTo((k + 2.5) * u, -186 * u); }
  c.moveTo(-11 * u, -214 * u); c.lineTo(0, -208 * u); c.lineTo(11 * u, -214 * u);
  c.stroke();
  c.restore();
  /* the helmet, on top whatever they're doing: rounded, the back of it
     panelled, an antenna with a glowing tip */
  c.save();
  c.translate(x, base - st.air - bounce); c.rotate(st.lean * 0.2 + run * Math.sin(ph) * 0.04);
  if (dn > 0){ c.translate(h * 0.42 * dn, -h * 0.14 * dn); c.rotate(-Math.PI / 2 * dn); if (st.down === true) c.globalAlpha = 0.6; }
  if (st.lost) c.globalAlpha = 0.35;
  else if (st.blink && Math.floor(t * 12) % 2) c.globalAlpha = 0.5;
  if (pose === 'sit') c.translate(0, 120 * u);
  /* the head turning: looking round (st.look, -1..1), or down at an arm, or at their legs */
  /* (st.nod: looking down at their feet, 0..1) */
  const turn = (st.look || 0) * 0.3 + (pose === 'check' ? -0.28 : 0), nod = (pose === 'dust' ? 10 * u : pose === 'check' ? 4 * u : 0) + (st.nod || 0) * 12 * u;
  if (turn || nod){ c.translate((st.look || 0) * 8 * u, nod); c.translate(0, -238 * u * f); c.rotate(turn); c.translate(0, 238 * u * f); }
  const hy = -238 * u * f - 40 * u, r = 44 * u;
  c.fillStyle = deep; c.beginPath(); c.ellipse(0, -238 * u * f, 26 * u, 10 * u, 0, 0, 6.2832); c.fill();
  const hg = c.createRadialGradient(-16 * u, hy - 18 * u, 4 * u, 0, hy, r); hg.addColorStop(0, lite); hg.addColorStop(0.6, col); hg.addColorStop(1, dark);
  c.fillStyle = hg; circ(c, 0, hy, r);
  c.strokeStyle = line; c.lineWidth = 3 * u; c.beginPath(); c.arc(0, hy, r, 0, 6.2832); c.stroke();
  /* the back panel and its seams */
  c.fillStyle = dark; c.beginPath(); c.moveTo(-26 * u, hy + 30 * u); c.quadraticCurveTo(-30 * u, hy + 4 * u, -14 * u, hy - 4 * u); c.lineTo(14 * u, hy - 4 * u); c.quadraticCurveTo(30 * u, hy + 4 * u, 26 * u, hy + 30 * u); c.quadraticCurveTo(0, hy + 40 * u, -26 * u, hy + 30 * u); c.fill();
  c.strokeStyle = line; c.lineWidth = 2.5 * u; c.beginPath(); c.moveTo(-r * 0.6, hy - r * 0.55); c.quadraticCurveTo(0, hy - r * 0.8, r * 0.6, hy - r * 0.55); c.moveTo(0, hy - r); c.lineTo(0, hy - r * 0.62); c.stroke();
  c.fillStyle = line; for (const k of [-6, 0, 6]) c.fillRect((k - 2) * u, hy + 16 * u, 4 * u, 8 * u);
  /* the antenna */
  c.strokeStyle = dark; c.lineWidth = 4 * u; c.beginPath(); c.moveTo(r * 0.72, hy - r * 0.5); c.lineTo(r * 0.82, hy - r * 1.45); c.stroke();
  glow(c, r * 0.82, hy - r * 1.48, 14 * u, gl, 0.9); c.fillStyle = gl; circ(c, r * 0.82, hy - r * 1.48, 3.5 * u);
  if (st.lost){ c.setLineDash?.([6, 6]); c.strokeStyle = '#ffffff'; c.lineWidth = 3; circ0(c, 0, hy, r * 1.3); c.stroke(); c.setLineDash?.([]); }
  /* hit: a red flash over them; in healing water: a soft blue glow */
  if (st.hit > 0) glow(c, 0, -170 * u, 190 * u, '#ff3b3b', st.hit * 0.8);
  if (st.heal > 0 && !(st.hit > 0.3)) glow(c, 0, -170 * u, 160 * u, '#8ff0ff', 0.35 * st.heal);
  c.restore();
}

/* A crew member seen from the front, running towards us (the sleepy
   roll, lkp-roll.js): the same suit - the chest plate with its glowing
   badge, the belt, the trim at the joints - arms pumping, knees coming
   up at us, and the helmet's big visor with their face in it (face(x, y,
   r): their photo or their kid, as from behind). Same st as worldCrew. */
export function worldCrewFront(c, x, base, h, t, col, st, face){
  const pose = st.pose || null;
  const u = h / 330, run = st.run || 0, ph = st.runPh || 0;
  const lite = mix(col, '#ffffff', 0.28), dark = mix(col, '#0a0f2a', 0.38), deep = mix(col, '#05081a', 0.55), line = mix(col, '#05081a', 0.62);
  const gl = hexMix(col, '#ffffff', 0.62);
  if (!st.flying){ c.fillStyle = 'rgba(20,15,45,.4)'; c.beginPath(); c.ellipse(x, base, 70 * u, 15 * u, 0, 0, 6.2832); c.fill(); }
  const bounce = run * Math.abs(Math.sin(ph)) * 10 * u;
  c.save();
  c.translate(x, base - (st.air || 0) - bounce); c.rotate((st.lean || 0) * 0.2 + run * Math.sin(ph) * 0.03);
  if (st.lost) c.globalAlpha = 0.35;
  else if (st.blink && Math.floor(t * 12) % 2) c.globalAlpha = 0.5;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const limb = (pts, w, side = -1) => {
    for (const [lw, sc] of [[w + 6 * u, line], [w, col]]){ c.strokeStyle = sc; c.lineWidth = lw; c.beginPath(); pts.forEach(([a, b], k) => (k ? c.lineTo(a, b) : c.moveTo(a, b))); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = w * 0.35;
    c.beginPath(); pts.forEach(([a, b], k) => (k ? c.lineTo(a + side * w * 0.22, b) : c.moveTo(a + side * w * 0.22, b))); c.stroke();
  };
  const trim = (x0, y0, w) => { glow(c, x0, y0, w * 1.4, gl, 0.5); c.strokeStyle = gl; c.lineWidth = 4 * u; c.beginPath(); c.ellipse(x0, y0, w * 0.55, w * 0.18, 0, 0, Math.PI); c.stroke(); };
  /* legs: the knee coming up at us, the boot under it, its toe towards us
     (the lifted one bigger: nearer) */
  for (const d of [-1, 1]){
    const lift = run * Math.max(0, Math.sin(ph + (d < 0 ? 0 : Math.PI)));
    const hip = [d * 22 * u, -128 * u], knee = [d * (26 + 4 * lift) * u, (-72 - 48 * lift) * u], foot = [d * (25 + 2 * lift) * u, (-14 - 58 * lift) * u];
    limb([hip, knee], (31 + 4 * lift) * u, d); limb([knee, foot], (25 + 3 * lift) * u, d);
    trim(knee[0], knee[1] + 4 * u, (30 + 4 * lift) * u);
    c.fillStyle = dark; c.beginPath(); c.ellipse(foot[0], foot[1] + 2 * u, (20 + 5 * lift) * u, (13 + 5 * lift) * u, 0, 0, 6.2832); c.fill();
    c.fillStyle = deep; c.beginPath(); c.ellipse(foot[0], foot[1] + 8 * u, (18 + 5 * lift) * u, (6 + 3 * lift) * u, 0, 0, Math.PI); c.fill();
    c.strokeStyle = gl; c.lineWidth = 3 * u; c.beginPath(); c.arc(foot[0], foot[1], (12 + 3 * lift) * u, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  }
  /* the body, and on it the chest plate, the badge, the belt */
  const tg = c.createLinearGradient(-52 * u, 0, 52 * u, 0); tg.addColorStop(0, lite); tg.addColorStop(0.45, col); tg.addColorStop(1, dark);
  c.fillStyle = tg;
  c.beginPath(); c.moveTo(-50 * u, -232 * u); c.quadraticCurveTo(0, -244 * u, 50 * u, -232 * u); c.lineTo(36 * u, -170 * u); c.lineTo(32 * u, -122 * u); c.quadraticCurveTo(0, -112 * u, -32 * u, -122 * u); c.lineTo(-36 * u, -170 * u); c.closePath(); c.fill();
  c.strokeStyle = line; c.lineWidth = 3 * u; c.stroke();
  c.fillStyle = lite; c.beginPath(); c.moveTo(-30 * u, -224 * u); c.quadraticCurveTo(0, -232 * u, 30 * u, -224 * u); c.lineTo(24 * u, -176 * u); c.quadraticCurveTo(0, -168 * u, -24 * u, -176 * u); c.closePath(); c.fill();
  c.strokeStyle = line; c.lineWidth = 2.5 * u; c.stroke();
  glow(c, 0, -200 * u, 26 * u, gl, 0.6);
  c.fillStyle = gl; c.beginPath(); c.arc(0, -200 * u, 9 * u, 0, 6.2832); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-2.5 * u, -203 * u, 3 * u, 0, 6.2832); c.fill();
  c.fillStyle = deep; c.fillRect(-33 * u, -138 * u, 66 * u, 12 * u);
  c.fillStyle = gl; c.fillRect(-7 * u, -136 * u, 14 * u, 8 * u);
  /* arms, pumping: the fist coming forward gets bigger */
  for (const d of [-1, 1]){
    const sh = [d * 46 * u, -222 * u];
    /* (standing about, in the opening: patting the dust off; an arm up
       to look it over; a hand to the helmet, listening to the radio) */
    if (pose === 'dust'){ const k = Math.sin(t * 8 + (d < 0 ? 0 : Math.PI)); const el = [d * 64 * u, -170 * u], fi = [d * (36 - 6 * k) * u, (-112 + 14 * k) * u]; limb([sh, el], 22 * u, d); limb([el, fi], 19 * u, d); trim(el[0], el[1], 22 * u); c.fillStyle = dark; circ(c, fi[0], fi[1], 13 * u); continue; }
    if (pose === 'check' && d < 0){ const k = Math.sin(t * 2.2); const el = [-72 * u, -186 * u], fi = [(-28 + 6 * k) * u, -214 * u]; limb([sh, el], 22 * u, d); limb([el, fi], 19 * u, d); trim(el[0], el[1], 22 * u); c.fillStyle = dark; circ(c, fi[0], fi[1], 14 * u); continue; }
    if (pose === 'ear' && d > 0){ const el = [80 * u, -206 * u], fi = [50 * u, -266 * u]; limb([sh, el], 22 * u, d); limb([el, fi], 19 * u, d); trim(el[0], el[1], 22 * u); c.fillStyle = dark; circ(c, fi[0], fi[1], 14 * u); continue; }
    if (pose === 'dust' || pose === 'check' || pose === 'ear'){ const el = [d * 60 * u, -172 * u], fi = [d * 62 * u, -128 * u]; limb([sh, el], 22 * u, d); limb([el, fi], 19 * u, d); trim(el[0], el[1], 22 * u); c.fillStyle = dark; circ(c, fi[0], fi[1], 13 * u); continue; }
    const p = run * Math.sin(ph + (d < 0 ? Math.PI : 0));
    const elbow = run > 0.2 ? [d * (68 - 4 * p) * u, (-176 + 14 * p) * u] : [d * 60 * u, -172 * u];
    const fist = run > 0.2 ? [d * (52 - 18 * Math.max(0, p)) * u, (-150 - 26 * p) * u] : [d * 62 * u, -128 * u];
    limb([sh, elbow], 22 * u, d); limb([elbow, fist], (19 + 4 * Math.max(0, p)) * u, d);
    trim(elbow[0], elbow[1], 22 * u);
    c.fillStyle = dark; circ(c, fist[0], fist[1], (13 + 5 * Math.max(0, p)) * u);
    c.fillStyle = col; circ(c, fist[0] - d * 2.5 * u, fist[1] - 2.5 * u, (7 + 3 * Math.max(0, p)) * u);
  }
  /* the helmet: the visor with their face in it */
  const turn = (st.look || 0) * 0.2;
  c.translate((st.look || 0) * 6 * u, 0);
  const hy = -238 * u - 40 * u, r = 44 * u;
  c.fillStyle = deep; c.beginPath(); c.ellipse(0, -238 * u, 26 * u, 10 * u, 0, 0, 6.2832); c.fill();
  const hg = c.createRadialGradient(-16 * u, hy - 18 * u, 4 * u, 0, hy, r); hg.addColorStop(0, lite); hg.addColorStop(0.6, col); hg.addColorStop(1, dark);
  c.fillStyle = hg; circ(c, 0, hy, r);
  c.strokeStyle = line; c.lineWidth = 3 * u; c.beginPath(); c.arc(0, hy, r, 0, 6.2832); c.stroke();
  const vx = turn * r * 0.4, vw = r * 0.74, vh = r * 0.62;
  c.fillStyle = '#121a33'; c.beginPath(); c.ellipse(vx, hy + 4 * u, vw, vh, 0, 0, 6.2832); c.fill();
  c.save(); c.beginPath(); c.ellipse(vx, hy + 4 * u, vw * 0.94, vh * 0.92, 0, 0, 6.2832); c.clip();
  if (face) face(vx, hy + 6 * u, vh * 0.95);
  const sg = c.createLinearGradient(vx - vw, hy - vh, vx + vw, hy + vh); sg.addColorStop(0, 'rgba(190,240,255,.35)'); sg.addColorStop(0.4, 'rgba(190,240,255,.05)'); sg.addColorStop(1, 'rgba(60,90,160,.25)');
  c.fillStyle = sg; c.fillRect(vx - vw, hy - vh, vw * 2, vh * 2 + 8 * u);
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(vx - vw * 0.5, hy - vh * 0.45, vw * 0.22, vh * 0.12, -0.5, 0, 6.2832); c.fill();
  c.restore();
  c.strokeStyle = gl; c.lineWidth = 4 * u; c.beginPath(); c.ellipse(vx, hy + 4 * u, vw, vh, 0, 0, 6.2832); c.stroke();
  c.strokeStyle = dark; c.lineWidth = 4 * u; c.beginPath(); c.moveTo(r * 0.72, hy - r * 0.5); c.lineTo(r * 0.82, hy - r * 1.45); c.stroke();
  glow(c, r * 0.82, hy - r * 1.48, 14 * u, gl, 0.9); c.fillStyle = gl; circ(c, r * 0.82, hy - r * 1.48, 3.5 * u);
  if (st.heal > 0) glow(c, 0, -170 * u, 160 * u, '#8ff0ff', 0.35 * st.heal);
  c.restore();
}

const circ0 = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, 6.2832); };

/* ---------- the beasts ---------- */

/* A wild beast, s tall, feet at (x, base): a round fluffy puffball on
   stubby legs, floppy ears, big shiny amber eyes, one tooth, a glowing
   flower sprouting from its head. st as lkp-art.js drawBeast: swing (a
   lunge), flash (just hit), hp. */
export function worldBeast(c, x, base, s, t, st){
  const u = s / 210, bob = Math.abs(Math.sin(t * 6)) * 6 * u, lunge = st.swing > 0 ? Math.sin(st.swing * Math.PI) : 0;
  c.fillStyle = 'rgba(20,15,45,.35)'; c.beginPath(); c.ellipse(x + 20 * u, base, 80 * u, 18 * u, 0, 0, 6.2832); c.fill();
  c.save(); c.translate(x, base - bob + lunge * 14 * u); c.scale(1 + lunge * 0.12, 1 - lunge * 0.1);
  for (const d of [-1, 1]){ c.fillStyle = d < 0 ? '#9b7cc9' : '#6a50a0'; c.beginPath(); c.roundRect((d * 34 - 13) * u, -34 * u, 26 * u, 34 * u, 12 * u); c.fill(); }
  const by = -92 * u, R = 72 * u;
  for (let k = 0; k < 14; k++){ const a = k / 14 * 6.2832; c.fillStyle = Math.cos(a) < -0.2 ? '#c9a8f0' : Math.cos(a) > 0.3 ? '#7a5cb5' : '#a487d8'; circ(c, Math.cos(a) * R * 0.85, by + Math.sin(a) * R * 0.8, 24 * u); }
  const bg = c.createRadialGradient(-25 * u, by - 25 * u, 5 * u, 0, by, R); bg.addColorStop(0, '#e6d4ff'); bg.addColorStop(0.6, '#a98bdc'); bg.addColorStop(1, '#6f53a6');
  c.fillStyle = bg; circ(c, 0, by, R * 0.9);
  c.fillStyle = '#f3e6ff'; c.beginPath(); c.ellipse(0, by + 26 * u, 36 * u, 26 * u, 0, 0, 6.2832); c.fill();
  for (const d of [-1, 1]){
    c.fillStyle = d < 0 ? '#b596e6' : '#7e60b8'; c.beginPath(); c.ellipse(d * 62 * u, by - 30 * u, 16 * u, 30 * u, d * 0.9, 0, 6.2832); c.fill();
    c.fillStyle = '#ffb3d6'; c.beginPath(); c.ellipse(d * 62 * u, by - 30 * u, 7 * u, 18 * u, d * 0.9, 0, 6.2832); c.fill();
  }
  c.strokeStyle = '#4f9f7f'; c.lineWidth = 4 * u; c.beginPath(); c.moveTo(4 * u, by - 62 * u); c.quadraticCurveTo(14 * u, by - 90 * u, 4 * u, by - 104 * u); c.stroke();
  glow(c, 4 * u, by - 108 * u, 34 * u, '#8ff7d6', 0.9);
  c.fillStyle = '#c9fff0'; for (let k = 0; k < 5; k++){ const a = k / 5 * 6.2832; circ(c, 4 * u + Math.cos(a) * 8 * u, by - 108 * u + Math.sin(a) * 8 * u, 6 * u); }
  c.fillStyle = '#ffe58a'; circ(c, 4 * u, by - 108 * u, 5 * u);
  const blink = (t % 3.7) < 0.12;
  for (const d of [-1, 1]){
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(d * 24 * u, by - 8 * u, 19 * u, blink ? 3 * u : 22 * u, 0, 0, 6.2832); c.fill();
    if (!blink){
      c.fillStyle = '#ffb63d'; circ(c, d * 22 * u, by - 4 * u, 13 * u);
      c.fillStyle = '#2a1a10'; circ(c, d * 21 * u, by - 3 * u, 8 * u);
      c.fillStyle = '#ffffff'; circ(c, d * 21 * u - 4 * u, by - 8 * u, 4 * u); circ(c, d * 21 * u + 3 * u, by + u, 2 * u);
    }
    c.strokeStyle = '#4a3577'; c.lineWidth = 4 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(d * 10 * u, by - 32 * u); c.lineTo(d * 34 * u, by - 36 * u); c.stroke();
  }
  c.fillStyle = 'rgba(255,140,190,.55)'; for (const d of [-1, 1]){ c.beginPath(); c.ellipse(d * 44 * u, by + 14 * u, 10 * u, 6 * u, 0, 0, 6.2832); c.fill(); }
  c.strokeStyle = '#4a3577'; c.lineWidth = 3.5 * u; c.beginPath(); c.arc(0, by + 26 * u, 9 * u, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-5 * u, by + 18 * u); c.lineTo(u, by + 28 * u); c.lineTo(5 * u, by + 18 * u); c.fill();
  if (st.flash > 0.3){ c.globalAlpha = Math.min(1, st.flash) * 0.6; c.fillStyle = '#ffffff'; circ(c, 0, by, R); }
  c.restore();
  if (st.hp < 1) hpBar(c, x, base - s * 1.08, s * 0.55, st.hp);
}

/* ---------- the robots ---------- */

/* A robot, s tall, wheel at (x, base): a gunmetal egg on one wheel,
   jointed arms, a dark visor with one red eye. st as drawRustbot: swing
   (its arm coming down), flash, hp. */
export function worldRobot(c, x, base, s, t, st){
  const u = s / 220, wob = Math.sin(t * 5) * 3 * u, swing = st.swing > 0 ? Math.sin(st.swing * Math.PI) : 0;
  c.fillStyle = 'rgba(20,15,45,.4)'; c.beginPath(); c.ellipse(x + 20 * u, base, 80 * u, 16 * u, 0, 0, 6.2832); c.fill();
  c.save(); c.translate(x, base);
  /* the wheel, spinning */
  c.fillStyle = '#23263f'; c.beginPath(); c.ellipse(0, -22 * u, 30 * u, 24 * u, 0, 0, 6.2832); c.fill();
  c.strokeStyle = '#4a4f75'; c.lineWidth = 3 * u; for (let k = 0; k < 3; k++){ const a = t * 8 + k * 2.09; c.beginPath(); c.moveTo(0, -22 * u); c.lineTo(Math.cos(a) * 22 * u, -22 * u + Math.sin(a) * 18 * u); c.stroke(); }
  c.translate(wob, 0);
  /* neck */
  c.fillStyle = '#6c7299'; c.fillRect(-10 * u, -70 * u, 20 * u, 40 * u); c.fillStyle = '#9ea4c8'; c.fillRect(-10 * u, -70 * u, 6 * u, 40 * u);
  /* the shell, gunmetal, lit from the left */
  const fl = st.flash > 0.4;
  const bg = c.createRadialGradient(-45 * u, -175 * u, 5 * u, 10 * u, -130 * u, 110 * u);
  bg.addColorStop(0, fl ? '#ffffff' : '#c9cdd8'); bg.addColorStop(0.45, fl ? '#ffe0e0' : '#7c8295'); bg.addColorStop(1, fl ? '#d9b0b0' : '#2c3042');
  c.fillStyle = bg; c.beginPath(); c.ellipse(0, -135 * u, 72 * u, 78 * u, 0, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(20,20,40,.35)'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(-70 * u, -120 * u); c.quadraticCurveTo(0, -100 * u, 70 * u, -120 * u); c.stroke();
  c.strokeStyle = 'rgba(255,190,140,.85)'; c.lineWidth = 4 * u; c.beginPath(); c.ellipse(0, -135 * u, 71 * u, 77 * u, 0, Math.PI * 0.75, Math.PI * 1.35); c.stroke();
  /* visor and eye */
  c.fillStyle = '#10132a'; c.beginPath(); c.ellipse(6 * u, -158 * u, 54 * u, 24 * u, 0, 0, 6.2832); c.fill();
  glow(c, 16 * u, -158 * u, 46 * u, '#ff3b55', 0.9);
  c.fillStyle = '#ff4d63'; c.beginPath(); c.ellipse(16 * u, -158 * u, 16 * u, 10 * u, 0, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-16 * u, -168 * u, 24 * u, 6 * u, -0.15, 0, 6.2832); c.fill();
  /* arms: the right one chops down as it swings */
  c.lineCap = 'round';
  c.strokeStyle = '#c2c7e2'; c.lineWidth = 9 * u; c.beginPath(); c.moveTo(-66 * u, -120 * u); c.lineTo(-92 * u, -85 * u); c.lineTo(-84 * u, -50 * u); c.stroke();
  c.fillStyle = '#e9ecf8'; circ(c, -84 * u, -46 * u, 9 * u);
  const ra = -swing * 2.2;
  c.save(); c.translate(66 * u, -120 * u); c.rotate(ra);
  c.strokeStyle = '#6c7299'; c.beginPath(); c.moveTo(0, 0); c.lineTo(26 * u, 35 * u); c.lineTo(18 * u, 70 * u); c.stroke();
  c.fillStyle = '#7b81aa'; circ(c, 18 * u, 74 * u, 9 * u);
  c.restore();
  c.restore();
  if (st.hp < 1) hpBar(c, x, base - s * 1.08, s * 0.55, st.hp);
}

function hpBar(c, x, y, w, frac){
  const h = Math.max(3, w * 0.09);
  c.fillStyle = 'rgba(10,8,30,.6)'; c.beginPath(); c.roundRect(x - w / 2 - 2, y - 2, w + 4, h + 4, h); c.fill();
  c.fillStyle = '#ff6b8a'; c.beginPath(); c.roundRect(x - w / 2, y, Math.max(h, w * frac), h, h / 2); c.fill();
}

/* ---------- Commander Nova ---------- */

/* Nova, the ship's Commander, on her comms feed: confident and kind -
   swept hair tied back, a scar through one brow, a half-smile, a dark
   uniform with rank bars, a headset with a boom mic. Her mouth moves as
   she talks; she blinks. r is her head's size. */
export function commanderFace(c, x, y, r, t, talking){
  const k = r / 50;
  c.save();
  /* uniform: a high collar, an epaulette, rank bars */
  const ug = c.createLinearGradient(x - 90 * k, 0, x + 90 * k, 0); ug.addColorStop(0, '#2f4a7a'); ug.addColorStop(1, '#18284a');
  c.fillStyle = '#d9a989'; c.fillRect(x - 15 * k, y + 28 * k, 30 * k, 30 * k);
  c.fillStyle = ug; c.beginPath(); c.ellipse(x, y + 106 * k, 92 * k, 54 * k, 0, Math.PI, 6.2832); c.fill();
  c.fillStyle = '#22355e'; c.beginPath(); c.moveTo(x - 30 * k, y + 50 * k); c.lineTo(x - 22 * k, y + 74 * k); c.lineTo(x, y + 64 * k); c.lineTo(x + 22 * k, y + 74 * k); c.lineTo(x + 30 * k, y + 50 * k); c.fill();
  c.fillStyle = '#e8b830'; c.beginPath(); c.roundRect(x - 86 * k, y + 60 * k, 40 * k, 12 * k, 3 * k); c.fill();
  for (let i = 0; i < 3; i++) c.fillRect(x + 38 * k + i * 10 * k, y + 74 * k, 6 * k, 14 * k);
  /* face, lit from the left */
  const fg = c.createRadialGradient(x - 18 * k, y - 12 * k, 4 * k, x, y, 54 * k); fg.addColorStop(0, '#fbe1cd'); fg.addColorStop(1, '#d9a78a');
  c.fillStyle = fg; c.beginPath(); c.moveTo(x - 40 * k, y - 20 * k); c.quadraticCurveTo(x - 42 * k, y + 30 * k, x - 10 * k, y + 46 * k); c.lineTo(x + 10 * k, y + 46 * k); c.quadraticCurveTo(x + 42 * k, y + 30 * k, x + 40 * k, y - 20 * k); c.quadraticCurveTo(x, y - 62 * k, x - 40 * k, y - 20 * k); c.fill();
  /* hair: a shaved side, a swept top, tied back */
  c.fillStyle = '#1f1530'; c.beginPath(); c.moveTo(x - 44 * k, y - 4 * k); c.quadraticCurveTo(x - 50 * k, y - 60 * k, x + 4 * k, y - 66 * k); c.quadraticCurveTo(x + 52 * k, y - 62 * k, x + 46 * k, y - 10 * k); c.quadraticCurveTo(x + 30 * k, y - 46 * k, x - 6 * k, y - 40 * k); c.quadraticCurveTo(x - 30 * k, y - 36 * k, x - 44 * k, y - 4 * k); c.fill();
  c.fillStyle = 'rgba(31,21,48,.45)'; c.beginPath(); c.ellipse(x + 41 * k, y - 4 * k, 6 * k, 22 * k, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#1f1530'; c.beginPath(); c.ellipse(x + 52 * k, y - 40 * k, 12 * k, 20 * k, 0.6, 0, 6.2832); c.fill();
  /* eyes, one brow raised; the scar */
  const blink = (t % 4.1) < 0.12;
  for (const d of [-1, 1]){
    if (!blink){ c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x + d * 15 * k, y + 2 * k, 8 * k, 5 * k, 0, 0, 6.2832); c.fill(); c.fillStyle = '#2a1810'; circ(c, x + d * 15 * k, y + 2.5 * k, 4.2 * k); c.fillStyle = '#fff'; circ(c, x + d * 15 * k - 1.5 * k, y + k, 1.3 * k); }
    else { c.strokeStyle = '#2a1810'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(x + d * 15 * k - 7 * k, y + 2 * k); c.lineTo(x + d * 15 * k + 7 * k, y + 2 * k); c.stroke(); }
    c.strokeStyle = '#1f1530'; c.lineWidth = 3.5 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + d * 6 * k, y - 8 * k); c.lineTo(x + d * 25 * k, y + (d < 0 ? -14 : -9) * k); c.stroke();
  }
  c.strokeStyle = 'rgba(190,120,110,.8)'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(x + 20 * k, y - 16 * k); c.lineTo(x + 14 * k, y - 4 * k); c.stroke();
  /* the mouth: a half-smile, opening as she talks */
  const open = talking ? Math.abs(Math.sin(t * 14)) : 0;
  if (open > 0.15){ c.fillStyle = '#7a3530'; c.beginPath(); c.ellipse(x + 2 * k, y + 24 * k, 10 * k, 3 * k + open * 5 * k, 0, 0, 6.2832); c.fill(); }
  else { c.strokeStyle = '#a0504a'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x - 10 * k, y + 24 * k); c.quadraticCurveTo(x + 4 * k, y + 28 * k, x + 13 * k, y + 20 * k); c.stroke(); }
  /* headset and boom mic */
  c.strokeStyle = '#d6e4f0'; c.lineWidth = 6 * k; c.beginPath(); c.arc(x, y - 8 * k, 54 * k, Math.PI * 1.06, Math.PI * 1.55); c.stroke();
  c.fillStyle = '#d6e4f0'; c.beginPath(); c.roundRect(x - 58 * k, y - 14 * k, 14 * k, 28 * k, 5 * k); c.fill();
  c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x - 50 * k, y + 12 * k); c.lineTo(x - 18 * k, y + 32 * k); c.stroke();
  c.fillStyle = '#ff5b6b'; circ(c, x - 16 * k, y + 32 * k, 3 * k);
  c.restore();
}
