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
  const breathe = Math.sin(t / SNORE * TAU) * H * 0.006;
  const side = [[-0.05 * W, 0.5 * H], [0.31 * W, 0.26 * H - breathe], [0.7 * W, 0.12 * H - breathe], [1.05 * W, 0.1 * H - breathe], [1.05 * W, 0.8 * H], [-0.05 * W, 0.8 * H]];
  form(c, side, ZUBU.body, H, 0.4);
  /* freckles */
  freckles(c, [[0.5, 0.25], [0.62, 0.2], [0.78, 0.17], [0.9, 0.22], [0.55, 0.36], [0.95, 0.38], [0.68, 0.45]].map(([u, v]) => [u * W, v * H]), H * 0.008);
  drawZubuAsleep(c, W, H, light, t, { x: 0.42, y: 0.68, size: 0.6, shadow: false });
}

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
  c.restore(); path(c, head); c.strokeStyle = ZUBU.line; c.lineWidth = S * 0.008; c.stroke();
  freckles(c, U(x0, y0, S, [[-0.5, -0.45], [-0.82, -0.56], [-1.1, -0.4], [-0.33, -0.3], [-1.4, -0.55], [-0.95, -0.24]]), S * 0.01);
  /* a wing-fin draped on the grass in front */
  form(c, U(x0, y0, S, [[-0.6, 0.32], [-0.2, 0.44], [0.25, 0.52], [0.15, 0.58], [-0.5, 0.57], [-1.2, 0.5]]), ZUBU.fin, S);
  /* the curled lobe at its mouth (the ray in it) */
  form(c, U(x0, y0, S, [[-0.06, 0.12], [0.06, 0.2], [0.05, 0.34], [-0.04, 0.38], [-0.06, 0.26]]), ZUBU.deep, S);
  /* its garden */
  garden(c, x0 - S * 0.95, y0 - S * 0.77, S * 0.6, S * 0.1, S * 0.9, t, -0.1);
  /* its eyes: shut fast asleep; one peeking when it stirs; open on red */
  const big = [x0 - S * 0.4, y0 - S * 0.2], small = [x0 - S * 0.62, y0 - S * 0.42];
  if (light === 'red'){ eye(c, big[0], big[1], S * 0.065, 0.6); eye(c, small[0], small[1], S * 0.035, 0.6); }
  else if (light === 'yellow'){
    shut(c, big[0], big[1], S * 0.07, S * 0.014);
    if (Math.floor(t * 6) % 3){ c.save(); c.translate(small[0], small[1]); c.scale(1, 0.45); eye(c, 0, 0, S * 0.035, 0.6); c.restore(); }
    else shut(c, small[0], small[1], S * 0.04, S * 0.01);
  } else { shut(c, big[0], big[1], S * 0.07, S * 0.014); shut(c, small[0], small[1], S * 0.04, S * 0.01); }
  blush(c, x0 - S * 0.3, y0 - S * 0.06, S * 0.08);
  /* its smile - a little open 'o' on red, surprised */
  c.strokeStyle = ZUBU.line; c.lineWidth = S * 0.01; c.lineCap = 'round';
  if (light === 'red'){ c.fillStyle = '#7a2a3a'; c.beginPath(); c.ellipse(x0 - S * 0.12, y0 + S * 0.05, S * 0.025, S * 0.03, 0, 0, TAU); c.fill(); }
  else { c.beginPath(); c.arc(x0 - S * 0.12, y0 + S * 0.02, S * 0.06, 0.25 * Math.PI, 0.7 * Math.PI); c.stroke(); }
  c.restore();
  /* the snore, drifting up from it: ZZZUUUU... BBBUUUU... */
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
