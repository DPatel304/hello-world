/* Zubu: the friendly giant of the glade - half ray, half whale. Wide
   wing-fins it glides on through the air, a round whale face, coral with
   star freckles, two little extra eyes (it's from somewhere else), and a
   moss garden on top of its head, with a blossom tree - where the crew
   sit for the ride.

   drawZubuAsleep(c, W, H, light, t) - the sneak (lkp-trap.js): asleep on
     the left of the glade, so big that only its head shows - eyes shut,
     a smile, snoring ZZZUUUU... BBBUUUU...; stirring on yellow, one eye
     peeking; both eyes open on red.
   drawZubu(c, x, y, s, t, o) - the ride (lkp-ride.js): flying, seen from
     behind, hovering over the path at (x, y), size s; riders sit in its
     garden at y - s * 0.93. */

export const ZUBU = { body: '#f0a98a', fin: '#e8907a', deep: '#d77a68', belly: '#fff2e2', line: '#5a2c30', moss: ['#7ec06e', '#5fa25a', '#9bd486'], bloom: '#f2a6bf', bloomD: '#c8708e', trunk: '#7a5236' };
const TAU = Math.PI * 2;

/* A smooth closed (or open) curve through points. */
function path(c, pts, closed = true){
  const n = pts.length, P = (i) => pts[(i + n) % n];
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++){
    const p0 = closed ? P(i - 1) : pts[Math.max(0, i - 1)], p1 = P(i), p2 = P(i + 1), p3 = closed ? P(i + 2) : pts[Math.min(n - 1, i + 2)];
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) c.closePath();
}
/* Unit points placed at (x, y), size s (flipped with f = -1). */
const U = (x, y, s, pts, f = 1) => pts.map(([u, v]) => [x + u * s * f, y + v * s]);
/* A soft painted shape: its colour, lit from the top, darker below, outlined. */
function form(c, pts, col, s, lit = 0.45){
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  path(c, pts); c.fillStyle = col; c.fill();
  c.save(); path(c, pts); c.clip();
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(255,244,230,${lit})`); g.addColorStop(0.5, 'rgba(255,244,230,0)'); g.addColorStop(1, 'rgba(70,30,40,.3)');
  c.fillStyle = g; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.restore();
  path(c, pts); c.strokeStyle = ZUBU.line; c.lineWidth = Math.max(1.5, s * 0.012); c.lineJoin = 'round'; c.stroke();
}
function freckles(c, pts, r){
  for (const [x, y] of pts){
    const g = c.createRadialGradient(x, y, 0, x, y, r * 2.4); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.4, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.4, 0, TAU); c.fill();
  }
}
function blush(c, x, y, r){ const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,120,130,.45)'); g.addColorStop(1, 'rgba(255,120,130,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * 0.65, 0, 0, TAU); c.fill(); }
function flower(c, x, y, r, col){ c.fillStyle = col; for (let j = 0; j < 5; j++){ const a = j / 5 * TAU - 1.57; c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, r * 0.38, a, 0, TAU); c.fill(); } c.fillStyle = '#ffd75a'; c.beginPath(); c.arc(x, y, r * 0.35, 0, TAU); c.fill(); }
/* An open eye: dark and glossy, two highlights. */
function eye(c, x, y, r, look = 0){
  c.fillStyle = '#fffaf2'; c.beginPath(); c.ellipse(x, y, r * 1.08, r * 1.12, 0, 0, TAU); c.fill();
  c.fillStyle = '#3a1a20'; c.beginPath(); c.arc(x + look * r * 0.15, y + r * 0.1, r * 0.85, 0, TAU); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.3, r * 0.28, r * 0.22, -0.5, 0, TAU); c.fill();
  c.beginPath(); c.arc(x + r * 0.3, y + r * 0.35, r * 0.11, 0, TAU); c.fill();
  c.strokeStyle = ZUBU.line; c.lineWidth = Math.max(1.5, r * 0.14); c.lineCap = 'round'; c.beginPath(); c.ellipse(x, y, r * 1.08, r * 1.12, 0, 1.1 * Math.PI, 1.9 * Math.PI); c.stroke();
}
/* Shut: a sleepy curve. */
function shut(c, x, y, r, w){ c.strokeStyle = ZUBU.line; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, r, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke(); }

/* The garden on its head: a cushion of moss, flowers, ferns, and a little
   blossom tree (tree: where, across the garden, -1..1; or null). */
export function garden(c, cx, cy, rx, ry, s, t = 0, tree = 0.3){
  const pts = []; for (let k = 0; k < 18; k++){ const a = k / 18 * TAU; pts.push([cx + Math.cos(a) * rx * (1 + 0.05 * Math.sin(k * 3)), cy + Math.sin(a) * ry * (1 + 0.1 * Math.sin(k * 2))]); }
  path(c, pts); c.fillStyle = ZUBU.moss[0]; c.fill();
  c.save(); path(c, pts); c.clip(); const g = c.createLinearGradient(0, cy - ry, 0, cy + ry); g.addColorStop(0, 'rgba(220,255,200,.45)'); g.addColorStop(1, 'rgba(30,70,30,.35)'); c.fillStyle = g; c.fillRect(cx - rx, cy - ry, rx * 2, ry * 2); c.restore();
  path(c, pts); c.strokeStyle = '#2f5a32'; c.lineWidth = Math.max(1, s * 0.008); c.stroke();
  /* tufts round the top edge */
  c.lineCap = 'round';
  for (let k = 0; k < 22; k++){ const a = Math.PI + k / 21 * Math.PI, x = cx + Math.cos(a) * rx * 0.97, y = cy + Math.sin(a) * ry * 0.97, l = s * (0.025 + 0.012 * ((k * 7) % 3)); c.strokeStyle = ZUBU.moss[k % 3]; c.lineWidth = Math.max(1, s * 0.008); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l * 0.3, y - l * 0.6, x + l * 0.15 + Math.sin(t * 1.5 + k) * l * 0.15, y - l); c.stroke(); }
  /* flowers */
  for (let k = 0; k < 14; k++){ const a = (k * 2.4) % TAU, d = 0.25 + ((k * 37) % 10) / 14; flower(c, cx + Math.cos(a) * rx * d * 0.85, cy + Math.sin(a) * ry * d * 0.6 - ry * 0.15, s * (0.012 + ((k * 13) % 5) * 0.002), ['#ffc4d8', '#fff3d6', '#ffe39a', '#d8c8ff'][k % 4]); }
  /* the blossom tree */
  if (tree != null){
    const tx = cx + rx * tree, ty = cy - ry * 0.3, sway = Math.sin(t * 0.9) * s * 0.006;
    c.fillStyle = ZUBU.trunk; c.beginPath(); c.moveTo(tx - s * 0.012, ty); c.lineTo(tx - s * 0.005 + sway, ty - s * 0.15); c.lineTo(tx + s * 0.005 + sway, ty - s * 0.15); c.lineTo(tx + s * 0.012, ty); c.fill();
    for (const [dx, dy, r] of [[-0.045, -0.15, 0.05], [0.05, -0.155, 0.052], [0, -0.2, 0.06], [0.0, -0.245, 0.042]]){
      const bx = tx + dx * s + sway, by = ty + dy * s;
      c.fillStyle = ZUBU.bloomD; c.beginPath(); c.arc(bx, by + r * s * 0.12, r * s, 0, TAU); c.fill();
      c.fillStyle = ZUBU.bloom; c.beginPath(); c.arc(bx, by, r * s * 0.95, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,230,240,.6)'; c.beginPath(); c.arc(bx - r * s * 0.3, by - r * s * 0.35, r * s * 0.35, 0, TAU); c.fill();
    }
  }
}

/* ---------- asleep, in the glade ---------- */

/* What it snores: in, ZZZUUUU...; out, BBBUUUU... (a breath every SNORE
   seconds) - which is where its name comes from. */
export const SNORE = 3.6;
export function snoreWord(t){ return (t % SNORE) < SNORE / 2 ? 'ZZZUUUU...' : 'BBBUUUU...'; }

/* The sneak, side on (lkp-trap.js): she's a wall behind the crew - her
   great coral side filling the background, rising to the right, her
   sleeping head on the left with its garden. (Trees and the meadow are
   drawn over her lower half, in front.) */
export function drawZubuWall(c, W, H, light, t){
  /* (so big now - five times what she was - that all there is of her is
     one great sleeping eye and her cheek, filling the glade's left side,
     the rest of her going up and away off the screen) */
  /* the rest of her, behind: her great side rising up behind the glade, right across, off the top */
  const breathe = Math.sin(t / SNORE * TAU) * H * 0.006;
  const side = [[-0.05 * W, 0.55 * H], [0.25 * W, 0.04 * H - breathe], [0.62 * W, 0.12 * H - breathe], [0.9 * W, 0.26 * H - breathe], [1.05 * W, 0.36 * H], [1.05 * W, 0.8 * H], [-0.05 * W, 0.8 * H]];
  /* her side is further back and in her own shade - a deeper tone - so her head stands out in front of it;
     and the low sun catches her back's top edge, so her shape reads against the sky */
  form(c, side, '#cf8670', H, 0.25);
  rim(c, side.slice(0, 5), H);
  freckles(c, [[0.45, 0.14], [0.58, 0.16], [0.7, 0.2], [0.82, 0.27], [0.52, 0.28], [0.66, 0.32], [0.88, 0.38]].map(([u, v]) => [u * W, v * H]), H * 0.007);
  const at = { ...WALL, x: (W * EYE[0] + H * WALL.size * 0.4) / W, y: EYE[1] + WALL.size * 0.2, rim: true };
  drawZubuAsleep(c, W, H, light, t, at);
}
/* A line of sunlight just inside an edge, with a dark edge outside it. */
function rim(c, pts, H){
  c.lineJoin = 'round'; c.lineCap = 'round';
  path(c, pts, false); c.strokeStyle = ZUBU.line; c.lineWidth = H * 0.012; c.stroke();
  c.save(); c.translate(0, H * 0.008); path(c, pts, false); c.strokeStyle = 'rgba(255,226,190,.75)'; c.lineWidth = H * 0.006; c.stroke(); c.restore();
}
/* Where her head is, in the wall: and its snore, drawn over the trees.
   (Seen from well back - so all of her head's in view, and her great side
   behind - and everything else in the glade small against her: the
   trees, the crew. Her eye small for her size, as a great creature's is.) */
const WALL = { x: 0.95, y: 0.98, size: 0.85, shadow: false, snore: false, eye: 1.05 };
/* (where her big eye is on the screen, fractions) */
const EYE = [0.345, 0.52];
export function zubuWallSnore(c, W, H, light, t){ zubuSnore(c, H, light, t, W * EYE[0] + H * WALL.size * 0.4, H * (EYE[1] + WALL.size * 0.2), H * 0.6); }
/* Where her eyes are on screen (fractions): kept clear of trees. */
export const WALL_EYES = { x0: 0.29, x1: 0.4, y0: 0.44, y1: 0.6 };

export function drawZubuAsleep(c, W, H, light, t, at = { x: 0.28, y: 0.6, size: 0.44, shadow: true }){
  const S = H * at.size, breathe = Math.sin(t / SNORE * TAU), stir = light === 'yellow' ? Math.sin(t * 26) * S * 0.006 : 0;
  /* its nose, towards the path; the rest of it off the screen */
  const x0 = W * at.x + stir, y0 = H * at.y - breathe * S * 0.01;
  c.save();
  /* its shadow on the grass */
  if (at.shadow){
  const sg = c.createRadialGradient(x0 - S * 0.6, H * 0.72, 0, x0 - S * 0.6, H * 0.72, S * 1.6);
  sg.addColorStop(0, 'rgba(20,40,30,.4)'); sg.addColorStop(1, 'rgba(20,40,30,0)');
  c.fillStyle = sg; c.beginPath(); c.ellipse(x0 - S * 0.6, H * 0.72, S * 1.6, S * 0.22, 0, 0, TAU); c.fill();
  }
  /* the head, side on, facing the path */
  const head = U(x0, y0, S, [[0, 0], [-0.04, -0.3], [-0.25, -0.58], [-0.7, -0.74], [-1.4, -0.76], [-2.4, -0.7], [-2.4, 0.42], [-1.2, 0.44], [-0.5, 0.36], [-0.12, 0.18]]);
  form(c, head, ZUBU.body, S, 0.5);
  c.save(); path(c, head); c.clip();
  path(c, U(x0, y0, S, [[0.02, 0.05], [-0.4, 0.1], [-1.2, 0.12], [-2.4, 0.06], [-2.4, 0.6], [0, 0.6]])); c.fillStyle = ZUBU.belly; c.fill();
  c.strokeStyle = 'rgba(192,144,128,.35)'; c.lineWidth = S * 0.006;
  for (let k = 0; k < 4; k++){ path(c, U(x0, y0, S, [[-0.15, 0.18 + k * 0.045], [-0.7, 0.24 + k * 0.045], [-1.6, 0.22 + k * 0.04]]), false); c.stroke(); }
  c.restore(); path(c, head); c.strokeStyle = ZUBU.line; c.lineWidth = at.rim ? H * 0.012 : S * 0.008; c.stroke();
  /* (seen from far back, as a great dark-edged, sunlit shape: brow and snout) */
  if (at.rim) rim(c, U(x0, y0, S, [[-2.4, -0.7], [-1.4, -0.76], [-0.7, -0.74], [-0.25, -0.58], [-0.04, -0.3], [0, 0]]), H);
  freckles(c, U(x0, y0, S, [[-0.5, -0.45], [-0.82, -0.56], [-1.1, -0.4], [-0.33, -0.3], [-1.4, -0.55], [-0.95, -0.24]]), S * 0.01);
  /* a wing-fin draped on the grass in front */
  form(c, U(x0, y0, S, [[-0.6, 0.32], [-0.2, 0.44], [0.25, 0.52], [0.15, 0.58], [-0.5, 0.57], [-1.2, 0.5]]), ZUBU.fin, S);
  /* the curled lobe at its mouth (the ray in it) */
  form(c, U(x0, y0, S, [[-0.06, 0.12], [0.06, 0.2], [0.05, 0.34], [-0.04, 0.38], [-0.06, 0.26]]), ZUBU.deep, S);
  /* its garden */
  garden(c, x0 - S * 0.95, y0 - S * 0.77, S * 0.6, S * 0.1, S * 0.9, t, -0.1);
  /* its eyes: shut fast asleep; one peeking when it stirs; open on red */
  const big = [x0 - S * 0.4, y0 - S * 0.2], E = S * (at.eye || 1);
  /* (her far eye: hidden round the curve of her head when she's seen side on from far back) */
  const small = at.rim ? [-1e4, -1e4] : [x0 - S * 0.62, y0 - S * 0.42];
  if (light === 'red'){ eye(c, big[0], big[1], E * 0.065, 0.6); eye(c, small[0], small[1], E * 0.035, 0.6); }
  else if (light === 'yellow'){
    shut(c, big[0], big[1], E * 0.07, E * 0.014);
    if (Math.floor(t * 6) % 3){ c.save(); c.translate(small[0], small[1]); c.scale(1, 0.45); eye(c, 0, 0, E * 0.035, 0.6); c.restore(); }
    else shut(c, small[0], small[1], E * 0.04, E * 0.01);
  } else { shut(c, big[0], big[1], E * 0.07, E * 0.014); shut(c, small[0], small[1], E * 0.04, E * 0.01); }
  blush(c, x0 - S * 0.3, y0 - S * 0.06, S * 0.08);
  /* its smile - a little open 'o' on red, surprised */
  c.strokeStyle = ZUBU.line; c.lineWidth = S * 0.01; c.lineCap = 'round';
  if (light === 'red'){ c.fillStyle = '#7a2a3a'; c.beginPath(); c.ellipse(x0 - S * 0.12, y0 + S * 0.05, S * 0.025, S * 0.03, 0, 0, TAU); c.fill(); }
  else { c.beginPath(); c.arc(x0 - S * 0.12, y0 + S * 0.02, S * 0.06, 0.25 * Math.PI, 0.7 * Math.PI); c.stroke(); }
  c.restore();
  /* the snore, drifting up from it: ZZZUUUU... BBBUUUU... (unless it's
     drawn later, over trees in front: zubuSnore) */
  if (at.snore !== false) zubuSnore(c, H, light, t, x0, y0, S);
}

/* The snore's word, drifting up from beside her nose at (x0, y0). */
export function zubuSnore(c, H, light, t, x0, y0, S){
  if (light === 'green'){
    const ph = (t % (SNORE / 2)) / (SNORE / 2), word = snoreWord(t);
    c.save(); c.textAlign = 'left'; c.textBaseline = 'middle';
    c.globalAlpha = Math.sin(Math.min(1, ph * 1.15) * Math.PI);
    const fs = Math.round(H * (0.04 + 0.015 * ph));
    c.font = `700 ${fs}px Fredoka, sans-serif`;
    const tx = x0 + S * (0.12 + ph * 0.1), ty = y0 - S * (0.32 + ph * 0.28);
    c.lineWidth = fs * 0.18; c.strokeStyle = 'rgba(40,40,80,.55)'; c.strokeText(word, tx, ty);
    c.fillStyle = '#ffffff'; c.fillText(word, tx, ty);
    c.restore();
  }
}

/* ---------- far off, in the sky ---------- */

/* Zubu, far away, gliding across the sky above the mountains, side on,
   hazy with distance: wide wing-fins slowly beating, the long tail
   trailing, her garden a smudge of green on her head. (x, y): her
   middle; s: her size; facing right; haze 0..1. */
export function drawZubuFar(c, x, y, s, t, haze = 0.55){
  const col = (a, b = 0) => mixHaze(a, haze + b), L = ZUBU, flap = Math.sin(t * 0.9);
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  /* the tail, a long ribbon behind */
  c.strokeStyle = col(L.deep); c.lineWidth = s * 0.05;
  c.beginPath(); c.moveTo(x - s * 0.5, y + s * 0.02); c.bezierCurveTo(x - s * 0.9, y + s * 0.1 + Math.sin(t * 1.3) * s * 0.06, x - s * 1.2, y - s * 0.05, x - s * 1.55, y + s * 0.05 + Math.sin(t * 1.3 + 1) * s * 0.08); c.stroke();
  /* the far wing */
  c.fillStyle = col(L.fin, 0.08); path(c, [[x - s * 0.1, y - s * 0.08], [x + s * 0.05, y - s * (0.45 + 0.25 * flap)], [x + s * 0.28, y - s * (0.42 + 0.22 * flap)], [x + s * 0.25, y - s * 0.1]]); c.fill();
  /* the body: a long, rounded whale-ray */
  c.fillStyle = col(L.body); path(c, [[x + s * 0.62, y], [x + s * 0.45, y - s * 0.16], [x, y - s * 0.2], [x - s * 0.42, y - s * 0.1], [x - s * 0.58, y + s * 0.02], [x - s * 0.3, y + s * 0.12], [x + s * 0.2, y + s * 0.14], [x + s * 0.55, y + s * 0.08]]); c.fill();
  c.fillStyle = col(L.belly, 0.05); path(c, [[x + s * 0.6, y + s * 0.03], [x + s * 0.2, y + s * 0.13], [x - s * 0.3, y + s * 0.11], [x - s * 0.1, y + s * 0.06], [x + s * 0.3, y + s * 0.05]]); c.fill();
  /* her garden, on her head */
  c.fillStyle = col('#7ec06e'); c.beginPath(); c.ellipse(x + s * 0.32, y - s * 0.17, s * 0.14, s * 0.045, -0.15, 0, TAU); c.fill();
  c.fillStyle = col('#f2a6bf'); c.beginPath(); c.arc(x + s * 0.3, y - s * 0.24, s * 0.04, 0, TAU); c.fill();
  /* the near wing, beating */
  c.fillStyle = col(L.fin); path(c, [[x - s * 0.15, y + s * 0.02], [x - s * 0.05, y + s * (0.15 - 0.55 * flap)], [x + s * 0.22, y + s * (0.12 - 0.5 * flap)], [x + s * 0.25, y + s * 0.03]]); c.fill();
  /* a little eye */
  c.fillStyle = col('#3a1a20', -0.2); c.beginPath(); c.arc(x + s * 0.5, y - s * 0.04, s * 0.015, 0, TAU); c.fill();
  c.restore();
}
/* (a colour, faded toward the sky's haze by k) */
function mixHaze(col, k){
  const h = (x) => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)), a = h(col), b = [214, 230, 242], kk = Math.max(0, Math.min(1, k));
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * kk)).join(',')})`;
}

/* ---------- flying, for the ride ---------- */

/* From behind: its wings out wide, rowing slowly; its great round back;
   the garden on top; its long tail trailing down. o: { step, walk,
   crouch, bob } as the ride has them. */
export function drawZubu(c, x, y, s, t, o = {}){
  const flap = Math.sin((o.step || t * 2) * 0.5) * (0.4 + 0.6 * (o.walk ?? 0.5)), crouch = o.crouch || 0;
  const cy = y - s * (0.62 - crouch * 0.06) + (o.bob || 0), L = ZUBU.line;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  /* its shadow on the path, below */
  const sg = c.createRadialGradient(x, y, 0, x, y, s * 1.3);
  sg.addColorStop(0, 'rgba(20,30,30,.35)'); sg.addColorStop(1, 'rgba(20,30,30,0)');
  c.fillStyle = sg; c.beginPath(); c.ellipse(x, y, s * 1.3, s * 0.12, 0, 0, TAU); c.fill();
  /* its tail, trailing down and back towards us */
  const tail = (w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, cy + s * 0.25); c.bezierCurveTo(x + s * 0.1, cy + s * 0.45, x - s * 0.2 + Math.sin(t * 1.3) * s * 0.06, cy + s * 0.5, x + s * 0.08 + Math.sin(t * 1.3 + 1) * s * 0.1, y - s * 0.02); c.stroke(); };
  tail(s * 0.055, L); tail(s * 0.04, ZUBU.deep);
  /* its wings, rowing the air */
  for (const f of [-1, 1]){
    const up = flap * 0.3;
    const wing = U(x, cy, s, [[0.3, -0.1], [0.85, -0.2 - up * 0.6], [1.45, -0.32 - up], [1.55, -0.24 - up], [1.15, 0.04 - up * 0.3], [0.4, 0.2]], f);
    form(c, wing, ZUBU.fin, s, 0.4);
    c.save(); path(c, wing); c.clip(); path(c, U(x, cy, s, [[0.3, 0.06], [0.85, -0.04 - up * 0.4], [1.4, -0.22 - up], [1.6, 0.4], [0.3, 0.4]], f)); c.fillStyle = 'rgba(255,242,226,.45)'; c.fill(); c.restore();
    path(c, wing); c.strokeStyle = L; c.lineWidth = Math.max(1.5, s * 0.01); c.stroke();
    freckles(c, U(x, cy, s, [[0.7, -0.14 - up * 0.4], [1.0, -0.2 - up * 0.6], [1.25, -0.24 - up * 0.8], [0.85, -0.02 - up * 0.3]], f), s * 0.012);
  }
  /* its back: a great soft dome */
  const back = U(x, cy, s, [[-0.5, 0.05], [-0.46, -0.22], [-0.28, -0.34], [0, -0.37], [0.28, -0.34], [0.46, -0.22], [0.5, 0.05], [0.38, 0.26], [0, 0.32], [-0.38, 0.26]]);
  form(c, back, ZUBU.body, s, 0.5);
  freckles(c, U(x, cy, s, [[-0.25, -0.12], [0.2, -0.18], [0.32, 0.02], [-0.35, 0.08], [0.02, 0.1], [-0.1, -0.25]]), s * 0.012);
  /* the garden on its head, up top, where they sit */
  garden(c, x, y - s * (0.93 - crouch * 0.06) + (o.bob || 0) + s * 0.02, s * 0.44, s * 0.09, s, t, 0.62);
  c.restore();
}

/* Riding on her, she's so vast the view's of her back, not of her: the
   crew sat in the moss on its great curve, her wing-fins rising and
   falling at the edges of the screen, and the world far below - the land
   sliding slowly back, clouds drifting under her, sky jellies floating by
   at their height, the glimmerbacks specks in a field, the great legs
   tiny on the land's edge. t: time; u: how far through the ride (0..1);
   L: the level's palette. The crew are drawn after, by the game. */
export const ON_BACK = { y: 0.66 };
export function drawOnZubu(c, W, H, t, u, L){
  const hz = H * 0.5, ridge = H * ON_BACK.y;
  c.save();
  /* the sky, and the low sun */
  const sk = c.createLinearGradient(0, 0, 0, hz); sk.addColorStop(0, L.sky[0]); sk.addColorStop(0.6, L.sky[1]); sk.addColorStop(1, L.sky[3]);
  c.fillStyle = sk; c.fillRect(0, 0, W, hz + 2);
  const sg = c.createRadialGradient(W * 0.18, hz * 0.55, 0, W * 0.18, hz * 0.55, H * 0.4); sg.addColorStop(0, 'rgba(255,240,220,.7)'); sg.addColorStop(1, 'rgba(255,240,220,0)'); c.fillStyle = sg; c.fillRect(0, 0, W, hz);
  /* far below: the land she's carrying them over - hazy blue mountains on
     the edge of the world, then row on row of rolling green hills, woods
     on their crests, a creek winding through, a pond, a meadow where the
     herd grazes - all sliding slowly back under her as she walks. */
  landBelow(c, W, H, t, u, L, hz);
  /* clouds, drifting along under her, below the edge of her back: flat-bottomed, lit on top */
  for (let k = 0; k < 4; k++){
    const a = ((t * 0.015 + k / 4) % 1), x = W * (-0.25 + 1.5 * ((k * 0.37 + a) % 1)), y = hz + H * (0.03 + 0.045 * (k % 3)), r = H * (0.035 + 0.02 * (k % 2));
    const puff = (col, dy) => { c.fillStyle = col; c.beginPath(); c.ellipse(x - r * 1.1, y + dy, r * 0.9, r * 0.55, 0, Math.PI, TAU); c.ellipse(x, y - r * 0.25 + dy, r * 1.1, r * 0.8, 0, Math.PI, TAU); c.ellipse(x + r * 1.2, y + dy, r * 0.8, r * 0.5, 0, Math.PI, TAU); c.fill(); };
    puff('rgba(214,200,240,.8)', 0); puff('rgba(255,248,255,.85)', -r * 0.12);
  }
  /* sky jellies, floating by at their height */
  for (let k = 0; k < 4; k++){
    const a = (t * 0.03 + k * 0.27) % 1, x = W * (k % 2 ? 1.1 - 1.3 * a : -0.1 + 1.3 * a), y = H * (0.18 + 0.08 * k) + Math.sin(t * 0.6 + k) * H * 0.01, sz = H * (0.035 + 0.015 * (k % 2));
    c.fillStyle = mixH(['#d7a6d8', '#a9c4e8', '#c4b4ea'][k % 3], L.haze, 0.3); c.beginPath(); c.ellipse(x, y, sz, sz * 0.62, 0, Math.PI, TAU); c.fill();
    c.strokeStyle = c.fillStyle; c.lineWidth = Math.max(1, sz * 0.06);
    for (let j = 0; j < 4; j++){ c.beginPath(); c.moveTo(x + (j / 3 - 0.5) * sz, y); c.quadraticCurveTo(x + (j / 3 - 0.5) * sz + Math.sin(t * 1.2 + j) * sz * 0.2, y + sz * 0.6, x + (j / 3 - 0.5) * sz, y + sz * 1.1); c.stroke(); }
  }
  /* her wing-fins, vast, reaching out either side far beyond her back, slowly rising and falling */
  const flap = Math.sin(t * 0.45), ry = ridge;
  for (const f of [-1, 1]){
    const root = [W / 2 + f * W * 0.3, ry + H * 0.16], tip = [W / 2 + f * W * 1.1, ry - H * (0.05 + 0.18 * flap)], trail = [W / 2 + f * W * 0.95, ry + H * (0.2 - 0.12 * flap)];
    c.fillStyle = 'rgba(232,144,122,.85)'; c.beginPath(); c.moveTo(root[0], root[1] - H * 0.05);
    c.quadraticCurveTo((root[0] + tip[0]) / 2, tip[1] - H * 0.04, tip[0], tip[1]); c.quadraticCurveTo(tip[0] - f * W * 0.05, (tip[1] + trail[1]) / 2, trail[0], trail[1]); c.quadraticCurveTo((root[0] + trail[0]) / 2, root[1] + H * 0.06, root[0], root[1] + H * 0.05); c.closePath(); c.fill();
    /* its ribs, catching the light */
    c.strokeStyle = 'rgba(255,242,226,.35)'; c.lineWidth = Math.max(1, H * 0.003);
    for (let k = 1; k < 5; k++){ const v = k / 5; c.beginPath(); c.moveTo(root[0], root[1]); c.quadraticCurveTo(root[0] + (tip[0] - root[0]) * 0.5, root[1] + (tip[1] - root[1]) * v * 0.6, tip[0] + (trail[0] - tip[0]) * v, tip[1] + (trail[1] - tip[1]) * v); c.stroke(); }
  }
  /* her back: broad, curving away gently, off past both sides - so big it's the ground they sit on */
  const sway = Math.sin(t * 0.5) * H * 0.008, back = () => { c.beginPath(); c.moveTo(-W * 0.3, H * 1.1); c.quadraticCurveTo(W * 0.05, ry + H * 0.03 + sway, W / 2, ry + sway); c.quadraticCurveTo(W * 0.95, ry + H * 0.03 + sway, W * 1.3, H * 1.1); c.closePath(); };
  c.fillStyle = ZUBU.body; back(); c.fill();
  c.strokeStyle = ZUBU.line; c.lineWidth = H * 0.004; c.stroke();
  /* the moss garden over it - grass, flowers - right out to its edges, and her freckles showing through */
  c.save(); back(); c.clip();
  c.fillStyle = ZUBU.moss[1]; c.beginPath(); c.ellipse(W / 2, H * 1.25, W * 0.75, H * 0.55 - sway, 0, Math.PI, TAU); c.fill();
  c.fillStyle = ZUBU.moss[0]; c.beginPath(); c.ellipse(W * 0.46, H * 1.25, W * 0.6, H * 0.5 - sway, 0, Math.PI, TAU); c.fill();
  for (let k = 0; k < 70; k++){ const x = W * (0.02 + 0.96 * ((k * 0.618) % 1)), y = ry + sway + H * (0.03 + 0.3 * ((k * 0.382) % 1)), sz = 0.5 + (y - ry) / H * 2; c.strokeStyle = ZUBU.moss[2]; c.lineWidth = H * 0.002 * sz; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(t * 1.5 + k) * H * 0.003 * sz, y - H * 0.012 * sz); c.stroke(); if (k % 5 === 0){ c.fillStyle = ['#ffc4d8', '#fff3d6', '#ffe39a', '#d8c8ff'][(k / 5) % 4]; c.beginPath(); c.arc(x, y - H * 0.012 * sz, H * 0.004 * sz, 0, TAU); c.fill(); } }
  c.restore();
  /* the wind, streaming past */
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = Math.max(1, H * 0.002);
  for (let k = 0; k < 8; k++){ const a = (t * 0.6 + k / 8) % 1, y = H * (0.1 + 0.08 * k), x0 = W * (1 - a * 1.4); c.globalAlpha = Math.sin(a * Math.PI) * 0.6; c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + W * 0.12, y); c.stroke(); }
  c.restore();
}
const mixH = (a, b, k) => { const h = (x) => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)), A = h(a), B = h(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };

/* The land below, seen from up on Zubu's back: rows of hills, nearest at
   the bottom, each sliding down and growing as she walks on, new ones
   coming up out of the haze at the horizon. */
const hashZ = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function landBelow(c, W, H, t, u, L, hz){
  const N = 8, D = H * 0.26, p = t * 0.06, f = p - Math.floor(p), base = Math.floor(p);
  /* the far mountains, two hazy ranges */
  for (const [k, hgt, hzk] of [[0, 0.07, 0.6], [1, 0.045, 0.45]]){
    c.fillStyle = mixH(k ? L.hillLit : L.hillDark, L.haze, hzk); c.beginPath(); c.moveTo(0, hz + 2);
    for (let x = 0; x <= 24; x++) c.lineTo(W * x / 24, hz - H * hgt * (0.45 + 0.55 * Math.abs(Math.sin(x * (0.9 + k * 0.6) + k * 2)) * (0.6 + 0.4 * Math.sin(x * 0.31))));
    c.lineTo(W, hz + 2); c.closePath(); c.fill();
  }
  c.fillStyle = mixH(L.ground[0], L.haze, 0.8); c.fillRect(0, hz, W, H - hz);
  const rowY = (a) => hz + D * Math.pow(1 - a, 2.1), rowS = (a) => 0.2 + 1.3 * Math.pow(1 - a, 1.6);
  const creekX = (id) => W * (0.5 + 0.28 * Math.sin(id * 0.55) + 0.1 * Math.sin(id * 1.3));
  const crest = (id, a, x) => rowY(a) - H * 0.04 * rowS(a) * (0.6 + 0.4 * Math.sin(x / W * (4 + 3 * hashZ(id)) + id * 1.7));
  for (let j = N; j >= 0; j--){
    const a = (j + 1 - f) / (N + 1), id = base + j, sc = rowS(a), fog = 0.72 - 0.62 * Math.pow(1 - a, 0.7);
    if (a <= 0) continue;
    /* the hill: lit on top, darker below */
    const g = c.createLinearGradient(0, rowY(a) - H * 0.03 * sc, 0, rowY(a) + H * 0.08 * sc);
    g.addColorStop(0, mixH(j % 2 ? L.grass[0] : '#8fd0a0', L.haze, fog)); g.addColorStop(1, mixH(L.ground[2], L.haze, fog));
    c.fillStyle = g; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= 32; x++) c.lineTo(W * x / 32, crest(id, a, W * x / 32)); c.lineTo(W, H); c.closePath(); c.fill();
    /* the creek, winding down this hill to the next one */
    const a2 = Math.max(0, a - 1 / (N + 1)), x1 = creekX(id), x2 = creekX(id - 1), w1 = W * 0.012 * sc, w2 = W * 0.012 * rowS(a2);
    const y1 = crest(id, a, x1) + H * 0.004 * sc, y2 = rowY(a2) + H * 0.01;
    c.fillStyle = mixH(L.water, L.haze, fog * 0.8); c.beginPath(); c.moveTo(x1 - w1, y1); c.bezierCurveTo(x1 - w1, (y1 + y2) / 2, x2 - w2, (y1 + y2) / 2, x2 - w2, y2); c.lineTo(x2 + w2, y2); c.bezierCurveTo(x2 + w2, (y1 + y2) / 2, x1 + w1, (y1 + y2) / 2, x1 + w1, y1); c.closePath(); c.fill();
    const kind = hashZ(id * 3.1);
    /* now and then a pond, shining - or a meadow, with the herd grazing on it */
    if (kind < 0.18){
      const px = W * (0.15 + 0.7 * hashZ(id + 9)), py = rowY(a) + H * 0.025 * sc;
      c.fillStyle = mixH(L.water, L.haze, fog * 0.7); c.beginPath(); c.ellipse(px, py, W * 0.05 * sc, H * 0.012 * sc, 0, 0, TAU); c.fill();
      c.fillStyle = `rgba(255,255,255,${0.5 * (1 - fog)})`; c.beginPath(); c.ellipse(px - W * 0.012 * sc, py - H * 0.003 * sc, W * 0.018 * sc, H * 0.003 * sc, 0, 0, TAU); c.fill();
    } else if (kind > 0.82){
      const mx = W * (0.15 + 0.7 * hashZ(id + 5)), my = rowY(a) + H * 0.02 * sc;
      for (let k = 0; k < 28; k++){
        const dx = (hashZ(id * 7 + k) - 0.5) * W * 0.07 * sc, dy = (hashZ(id * 11 + k) - 0.5) * H * 0.012 * sc, bob = Math.sin(t * 2 + k) * H * 0.001 * sc;
        c.fillStyle = mixH(k % 3 ? '#6a5fc8' : '#8f84e0', L.haze, fog * 0.8); c.beginPath(); c.ellipse(mx + dx, my + dy + bob, H * 0.005 * sc, H * 0.0035 * sc, 0, 0, TAU); c.fill();
      }
    }
    /* woods: groves packed along the crest - a dark mass, lit round tops - and a few lone trees between */
    const grove = (gx0, gw, seed) => {
      const step = H * 0.014 * sc, n = Math.max(2, Math.floor(gw / step));
      const tops = [];
      for (let k = 0; k <= n; k++){ const x = gx0 + gw * k / n, e = Math.sin(k / n * Math.PI); tops.push([x, crest(id, a, x) + H * 0.006 * sc, H * (0.012 + 0.016 * e + 0.008 * hashZ(seed + k)) * sc]); }
      c.fillStyle = mixH(L.tree[1], L.haze, fog); for (const [x, y, r] of tops){ c.beginPath(); c.arc(x, y - r * 0.8, r, 0, TAU); c.fill(); }
      c.fillStyle = mixH(L.tree[0], L.haze, fog); for (const [x, y, r] of tops){ c.beginPath(); c.arc(x - r * 0.25, y - r * 1.05, r * 0.62, 0, TAU); c.fill(); }
    };
    const nG = 1 + Math.floor(hashZ(id + 2) * 3);
    for (let k = 0; k < nG; k++){ const gw = W * (0.12 + 0.25 * hashZ(id * 5 + k)), gx0 = W * (-0.1 + 1.1 * hashZ(id * 7 + k * 3)); if (!(x1 > gx0 && x1 < gx0 + gw)) grove(gx0, gw, id * 31 + k * 7); }
    for (let k = 0; k < 6; k++){
      const x = W * hashZ(id * 13 + k), y = crest(id, a, x) + H * 0.008 * sc, r = H * 0.014 * sc;
      if (Math.abs(x - x1) < W * 0.03 * sc) continue;
      c.fillStyle = mixH(L.tree[1], L.haze, fog); c.beginPath(); c.moveTo(x - r * 0.8, y); c.lineTo(x, y - r * 2.8); c.lineTo(x + r * 0.8, y); c.closePath(); c.fill();
      c.fillStyle = mixH(L.tree[0], L.haze, fog); c.beginPath(); c.moveTo(x - r * 0.1, y - r * 0.5); c.lineTo(x, y - r * 2.8); c.lineTo(x - r * 0.72, y - r * 0.15); c.closePath(); c.fill();
    }
  }
  /* the great legs, far off by the mountains, striding slowly: a long hazy hump of a body over thick legs */
  const gx = W * (0.84 - 0.05 * u), gy = hz + H * 0.006, fogG = 0.62;
  c.fillStyle = 'rgba(40,40,70,.18)'; c.beginPath(); c.ellipse(gx, gy + H * 0.004, H * 0.06, H * 0.006, 0, 0, TAU); c.fill();
  c.fillStyle = mixH('#3d4a66', L.haze, fogG);
  for (const [dx, ph] of [[-0.04, 0], [-0.016, 0.5], [0.014, 0.25], [0.036, 0.75]]){
    const lift = Math.max(0, Math.sin((t / 2.8 + ph) * TAU)) * H * 0.006, lx = gx + dx * H;
    c.beginPath(); c.roundRect(lx - H * 0.006, gy - H * 0.07 - lift, H * 0.012, H * 0.07, H * 0.004); c.fill();
  }
  /* (a long low back, and its neck stretched out ahead, as it lumbers off) */
  c.beginPath(); c.ellipse(gx, gy - H * 0.068, H * 0.075, H * 0.035, 0, Math.PI, TAU); c.ellipse(gx, gy - H * 0.068, H * 0.075, H * 0.01, 0, 0, Math.PI); c.fill();
  c.beginPath(); c.moveTo(gx - H * 0.06, gy - H * 0.08); c.quadraticCurveTo(gx - H * 0.1, gy - H * 0.1, gx - H * 0.12, gy - H * 0.085); c.lineTo(gx - H * 0.115, gy - H * 0.072); c.quadraticCurveTo(gx - H * 0.09, gy - H * 0.08, gx - H * 0.055, gy - H * 0.065); c.closePath(); c.fill();
}
