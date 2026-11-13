/* The fish of Uncle B's Boat: who lives in the lake, how deep, how often
   they turn up, and how each is drawn.

   Most are real lake fish, drawn friendly - bluegill, perch, goldfish,
   rainbow trout, bass, koi, catfish, pike. A few are magical and rare: a
   lantern fish glowing in the deep, a shimmering rainbow fish, a fish made
   of crystal, a tiny whale, and the golden legend. Every one is drawn by
   the same routine from a handful of settings - shape, colours, pattern,
   tail - so they're consistent, and the book can show each as a silhouette
   until it's caught. */

export const SHALLOW = [0.44, 0.6], MID = [0.58, 0.78], DEEP = [0.76, 0.92];

/* len: body length in screen heights; h: height over length; weight: how
   often it turns up, relative to the others. */
export const SPECIES = [
  { id: 'bluegill', len: 0.1, h: 0.62, depth: SHALLOW, weight: 10, body: '#4f7f6a', belly: '#f2a34a', fin: '#3f6a58', tail: 'round', pattern: 'bars' },
  { id: 'perch', len: 0.11, h: 0.4, depth: SHALLOW, weight: 9, body: '#c9b440', belly: '#f3e7a8', fin: '#ff8a3d', tail: 'fork', pattern: 'stripes' },
  { id: 'goldfish', len: 0.085, h: 0.55, depth: SHALLOW, weight: 8, body: '#ff9a2e', belly: '#ffd27a', fin: '#ff7a2e', tail: 'fan', pattern: 'plain' },
  { id: 'trout', len: 0.14, h: 0.32, depth: MID, weight: 6, body: '#7d8f6a', belly: '#f4ece0', fin: '#9aa77f', tail: 'fork', pattern: 'trout' },
  { id: 'bass', len: 0.15, h: 0.42, depth: MID, weight: 6, body: '#5c7d3a', belly: '#e8ecc8', fin: '#4d6a30', tail: 'fork', pattern: 'blotch', mouth: 'big' },
  { id: 'koi', len: 0.14, h: 0.38, depth: SHALLOW, weight: 5, body: '#fff6ee', belly: '#fffaf5', fin: '#ffe7d6', tail: 'fan', pattern: 'koi', whiskers: 0.08 },
  { id: 'catfish', len: 0.17, h: 0.3, depth: DEEP, weight: 4, body: '#6b6a73', belly: '#d8d3c8', fin: '#57565e', tail: 'fork', pattern: 'plain', whiskers: 0.3 },
  { id: 'pike', len: 0.21, h: 0.2, depth: MID, weight: 3, body: '#6f8a3e', belly: '#efe9c9', fin: '#8f9f4e', tail: 'fork', pattern: 'pike', snout: true },
  { id: 'lantern', len: 0.12, h: 0.55, depth: DEEP, weight: 2, magic: true, body: '#2a3566', belly: '#4b5a99', fin: '#3a4680', tail: 'round', pattern: 'glow', lure: true, mouth: 'big' },
  { id: 'rainbow', len: 0.12, h: 0.48, depth: MID, weight: 2, magic: true, body: '#7fd0ff', belly: '#f5e9ff', fin: '#c49bff', tail: 'fan', pattern: 'rainbow' },
  { id: 'crystal', len: 0.11, h: 0.45, depth: SHALLOW, weight: 2, magic: true, body: '#cfefff', belly: '#ffffff', fin: '#bfe6ff', tail: 'fork', pattern: 'crystal' },
  { id: 'whale', len: 0.26, h: 0.48, depth: DEEP, weight: 1, magic: true, body: '#4f7fc9', belly: '#dce9f7', fin: '#4373bd', tail: 'whale', pattern: 'whale' },
  { id: 'golden', len: 0.18, h: 0.42, depth: MID, weight: 1, magic: true, body: '#ffc93a', belly: '#fff0b0', fin: '#ffb020', tail: 'fan', pattern: 'gold' }
];
/* Drawn a little larger than life: looking at them is the point. */
for (const s of SPECIES) s.len *= 1.25;
export const byId = Object.fromEntries(SPECIES.map(s => [s.id, s]));

/* Choose a species to swim in, by weight; `boost` raises the rare ones. */
export function pickSpecies(rand = Math.random, boost = 1){
  const w = SPECIES.map(s => s.weight * (s.weight <= 2 ? boost : 1));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < SPECIES.length; i++){ if ((r -= w[i]) <= 0) return SPECIES[i]; }
  return SPECIES[0];
}

const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

/* One fish at (x, y), L pixels long, facing dir (1 right, -1 left). swim
   is its tail's phase. dark draws it as a silhouette, for the book. */
export function drawFish(c, sp, x, y, L, swim = 0, dir = 1, dark = false){
  const h = L * sp.h;
  c.save(); c.translate(x, y); c.scale(dir, 1);
  const wag = Math.sin(swim) * 0.28;
  const col = (v) => (dark ? 'rgba(20,30,50,.85)' : v);

  if (sp.pattern === 'glow' && !dark){
    const g = c.createRadialGradient(0, 0, 0, 0, 0, L * 0.9);
    g.addColorStop(0, 'rgba(120,200,255,.25)'); g.addColorStop(1, 'rgba(120,200,255,0)');
    c.fillStyle = g; c.fillRect(-L, -L, L * 2, L * 2);
  }
  if (sp.pattern === 'gold' && !dark){
    const g = c.createRadialGradient(0, 0, 0, 0, 0, L * 0.8);
    g.addColorStop(0, 'rgba(255,220,120,.35)'); g.addColorStop(1, 'rgba(255,220,120,0)');
    c.fillStyle = g; c.fillRect(-L, -L, L * 2, L * 2);
  }

  /* Tail first, behind the body. */
  c.save(); c.translate(-L * 0.36, 0); c.rotate(wag);
  c.fillStyle = col(sp.fin);
  c.beginPath();
  if (sp.tail === 'fork'){
    c.moveTo(L * 0.04, 0); c.quadraticCurveTo(-L * 0.12, -h * 0.25, -L * 0.2, -h * 0.55); c.quadraticCurveTo(-L * 0.12, -h * 0.05, -L * 0.1, 0);
    c.quadraticCurveTo(-L * 0.12, h * 0.05, -L * 0.2, h * 0.55); c.quadraticCurveTo(-L * 0.12, h * 0.25, L * 0.04, 0);
  } else if (sp.tail === 'fan'){
    c.moveTo(L * 0.04, 0); c.bezierCurveTo(-L * 0.2, -h * 0.9, -L * 0.34, -h * 0.5, -L * 0.3, 0); c.bezierCurveTo(-L * 0.34, h * 0.5, -L * 0.2, h * 0.9, L * 0.04, 0);
  } else if (sp.tail === 'whale'){
    c.moveTo(L * 0.04, 0); c.quadraticCurveTo(-L * 0.1, -h * 0.1, -L * 0.18, -h * 0.4); c.quadraticCurveTo(-L * 0.12, -h * 0.05, -L * 0.2, h * 0.05);
    c.quadraticCurveTo(-L * 0.12, h * 0.15, -L * 0.18, h * 0.35); c.quadraticCurveTo(-L * 0.08, h * 0.12, L * 0.04, 0);
  } else {
    c.moveTo(L * 0.04, 0); c.quadraticCurveTo(-L * 0.18, -h * 0.55, -L * 0.2, 0); c.quadraticCurveTo(-L * 0.18, h * 0.55, L * 0.04, 0);
  }
  c.fill();
  if (!dark && (sp.tail === 'fan' || sp.tail === 'round')){
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = Math.max(1, L * 0.008);
    c.beginPath(); for (const a of [-0.5, 0, 0.5]){ c.moveTo(0, 0); c.lineTo(-L * 0.24, a * h * 0.9); } c.stroke();
  }
  c.restore();

  /* Fins on top and underneath. */
  c.fillStyle = col(sp.fin);
  const whale = sp.pattern === 'whale';
  c.beginPath();
  if (whale){ c.moveTo(-L * 0.08, -h * 0.4); c.quadraticCurveTo(-L * 0.14, -h * 0.62, -L * 0.2, -h * 0.36); }
  else { c.moveTo(L * 0.12, -h * 0.42); c.quadraticCurveTo(-L * 0.02, -h * (sp.pattern === 'pike' ? 0.75 : 0.95), -L * 0.22, -h * 0.38); }
  c.closePath(); c.fill();
  c.beginPath(); c.moveTo(L * 0.05, h * 0.42); c.quadraticCurveTo(-L * 0.04, h * 0.72, -L * 0.16, h * 0.36); c.closePath(); c.fill();

  /* The body, shaded from back to belly. */
  const body = () => {
    c.beginPath();
    const nose = sp.snout ? 0.56 : 0.5;
    c.moveTo(L * nose, 0);
    c.bezierCurveTo(L * 0.45, -h * 0.55, L * 0.05, -h * 0.62, -L * 0.15, -h * 0.45);
    c.quadraticCurveTo(-L * 0.33, -h * 0.3, -L * 0.38, -h * 0.12);
    c.lineTo(-L * 0.38, h * 0.12);
    c.quadraticCurveTo(-L * 0.33, h * 0.3, -L * 0.15, h * 0.45);
    c.bezierCurveTo(L * 0.05, h * 0.62, L * 0.45, h * 0.55, L * nose, 0);
  };
  if (dark){ c.fillStyle = col(''); body(); c.fill(); c.restore(); return; }
  const g = c.createLinearGradient(0, -h * 0.55, 0, h * 0.55);
  if (sp.pattern === 'rainbow'){
    const k = (swim * 20) % 360;
    g.addColorStop(0, hsl(k, 80, 65)); g.addColorStop(0.35, hsl(k + 60, 80, 68)); g.addColorStop(0.7, hsl(k + 140, 80, 72)); g.addColorStop(1, hsl(k + 220, 70, 85));
  } else { g.addColorStop(0, sp.body); g.addColorStop(0.55, sp.body); g.addColorStop(1, sp.belly); }
  c.globalAlpha = sp.pattern === 'crystal' ? 0.6 : 1;
  c.fillStyle = g; body(); c.fill();
  c.globalAlpha = 1;
  c.save(); body(); c.clip();
  pattern(c, sp, L, h, swim);
  c.restore();
  if (sp.pattern === 'crystal'){ c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = Math.max(1.5, L * 0.012); body(); c.stroke(); }

  if (whale){
    /* A whale: a long smile, a flipper, and a little spout from the top. */
    c.strokeStyle = 'rgba(30,40,80,.55)'; c.lineWidth = Math.max(1.5, L * 0.012); c.lineCap = 'round';
    c.beginPath(); c.moveTo(L * 0.49, h * 0.06); c.quadraticCurveTo(L * 0.36, h * 0.22, L * 0.18, h * 0.16); c.stroke();
    c.fillStyle = sp.fin; c.beginPath(); c.ellipse(L * 0.12, h * 0.3, L * 0.09, h * 0.12, 0.6 + Math.sin(swim) * 0.15, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(220,245,255,.85)';
    for (let k = 0; k < 5; k++){
      const u = ((swim * 0.25 + k / 5) % 1), a = -Math.PI / 2 + (k - 2) * 0.35;
      c.beginPath(); c.arc(L * 0.22 + Math.cos(a) * u * L * 0.12, -h * 0.55 + Math.sin(a) * u * L * 0.16, L * 0.018 * (1 - u * 0.5), 0, 6.2832); c.fill();
    }
    const ex = L * 0.3, ey = h * 0.02, er = Math.max(2, L * 0.03);
    c.fillStyle = '#1d2033'; c.beginPath(); c.arc(ex, ey, er, 0, 6.2832); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ex + er * 0.3, ey - er * 0.35, er * 0.35, 0, 6.2832); c.fill();
    c.restore();
    return;
  }

  /* Gill, eye, mouth; whiskers and a lure for the ones who have them. */
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = Math.max(1, L * 0.01);
  c.beginPath(); c.arc(L * 0.3, 0, h * 0.42, Math.PI * 0.62, Math.PI * 1.38); c.stroke();
  const ex = L * (sp.snout ? 0.38 : 0.34), ey = -h * 0.12, er = Math.max(2, L * 0.045);
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ex, ey, er, 0, 6.2832); c.fill();
  c.fillStyle = '#1d2033'; c.beginPath(); c.arc(ex + er * 0.2, ey, er * 0.62, 0, 6.2832); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ex + er * 0.38, ey - er * 0.3, er * 0.24, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(40,20,20,.55)'; c.lineWidth = Math.max(1, L * 0.012); c.lineCap = 'round';
  c.beginPath();
  if (sp.mouth === 'big'){ c.moveTo(L * 0.5, h * 0.05); c.quadraticCurveTo(L * 0.42, h * 0.16, L * 0.36, h * 0.12); }
  else { c.moveTo(L * (sp.snout ? 0.55 : 0.49), h * 0.04); c.lineTo(L * 0.44, h * 0.08); }
  c.stroke();
  if (sp.whiskers){
    c.strokeStyle = 'rgba(60,50,40,.7)'; c.lineWidth = Math.max(1, L * 0.008);
    for (const d of [-1, 1]){ c.beginPath(); c.moveTo(L * 0.47, h * 0.06); c.quadraticCurveTo(L * (0.5 + sp.whiskers * 0.5), h * (0.1 + d * 0.15), L * (0.45 + sp.whiskers), h * (0.25 + d * 0.2) + Math.sin(swim + d) * h * 0.06); c.stroke(); }
  }
  if (sp.lure){
    c.strokeStyle = sp.fin; c.lineWidth = Math.max(1.5, L * 0.015);
    const lx = L * 0.62, ly = -h * 0.75 + Math.sin(swim * 0.5) * h * 0.05;
    c.beginPath(); c.moveTo(L * 0.3, -h * 0.45); c.quadraticCurveTo(L * 0.42, -h * 0.95, lx, ly); c.stroke();
    const lg = c.createRadialGradient(lx, ly, 0, lx, ly, L * 0.16);
    lg.addColorStop(0, 'rgba(255,255,200,1)'); lg.addColorStop(0.3, 'rgba(160,240,255,.6)'); lg.addColorStop(1, 'rgba(160,240,255,0)');
    c.fillStyle = lg; c.beginPath(); c.arc(lx, ly, L * 0.16, 0, 6.2832); c.fill();
  }
  if (sp.pattern === 'cheek' || sp.id === 'bluegill'){ c.fillStyle = '#2f5fae'; c.beginPath(); c.ellipse(L * 0.22, -h * 0.02, L * 0.035, h * 0.08, 0, 0, 6.2832); c.fill(); }
  c.restore();
}

function pattern(c, sp, L, h, swim){
  const p = sp.pattern;
  if (p === 'bars'){
    c.fillStyle = 'rgba(30,60,50,.25)';
    for (let k = 0; k < 6; k++) c.fillRect(L * (0.25 - k * 0.1), -h, L * 0.045, h * 1.2);
  } else if (p === 'stripes'){
    c.fillStyle = 'rgba(60,90,30,.65)';
    for (let k = 0; k < 6; k++){ c.beginPath(); c.moveTo(L * (0.25 - k * 0.1), -h); c.lineTo(L * (0.2 - k * 0.1), h * 0.2); c.lineTo(L * (0.15 - k * 0.1), h * 0.2); c.lineTo(L * (0.2 - k * 0.1), -h); c.fill(); }
  } else if (p === 'trout'){
    c.fillStyle = 'rgba(240,120,150,.75)'; c.fillRect(-L * 0.4, -h * 0.08, L * 0.85, h * 0.2);
    c.fillStyle = 'rgba(40,40,40,.55)';
    for (let k = 0; k < 18; k++){ const fx = (((k * 0.618) % 1) - 0.4) * L * 0.85, fy = (((k * 0.377) % 1) - 0.75) * h * 0.6; c.beginPath(); c.arc(fx, fy, L * 0.012, 0, 6.2832); c.fill(); }
  } else if (p === 'blotch'){
    c.fillStyle = 'rgba(40,55,25,.6)';
    for (let k = 0; k < 7; k++){ c.beginPath(); c.ellipse(L * (0.2 - k * 0.09), h * 0.02 + Math.sin(k * 1.7) * h * 0.04, L * 0.05, h * 0.08, 0, 0, 6.2832); c.fill(); }
  } else if (p === 'koi'){
    c.fillStyle = '#ff6a2e';
    for (const [fx, fy, r] of [[0.28, -0.25, 0.12], [0.02, -0.35, 0.14], [-0.2, -0.1, 0.1], [0.12, 0.15, 0.08]]){ c.beginPath(); c.ellipse(fx * L, fy * h, r * L, r * L * 0.7, 0.3, 0, 6.2832); c.fill(); }
    c.fillStyle = '#2b2b2b'; c.beginPath(); c.ellipse(-L * 0.08, -h * 0.28, L * 0.04, L * 0.025, 0, 0, 6.2832); c.fill();
  } else if (p === 'pike'){
    c.fillStyle = 'rgba(240,240,200,.55)';
    for (let k = 0; k < 22; k++){ const fx = (((k * 0.618) % 1) - 0.4) * L * 0.85, fy = (((k * 0.377) % 1) - 0.6) * h * 0.9; c.beginPath(); c.ellipse(fx, fy, L * 0.016, L * 0.008, 0, 0, 6.2832); c.fill(); }
  } else if (p === 'glow'){
    for (let k = 0; k < 7; k++){
      const a = 0.5 + 0.5 * Math.sin(swim * 0.7 + k);
      c.fillStyle = `rgba(150,240,255,${0.4 + 0.6 * a})`;
      c.beginPath(); c.arc(L * (0.25 - k * 0.08), h * 0.25, L * 0.018, 0, 6.2832); c.fill();
    }
  } else if (p === 'rainbow'){
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = Math.max(1, L * 0.008);
    for (let k = 0; k < 8; k++){ c.beginPath(); c.arc(L * (0.25 - k * 0.07), 0, h * 0.25, -1.2, 1.2); c.stroke(); }
  } else if (p === 'crystal'){
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = Math.max(1, L * 0.008);
    c.beginPath(); c.moveTo(L * 0.3, -h * 0.5); c.lineTo(L * 0.05, h * 0.5); c.moveTo(0, -h * 0.5); c.lineTo(-L * 0.25, h * 0.4); c.moveTo(L * 0.15, -h * 0.5); c.lineTo(-L * 0.1, h * 0.5); c.stroke();
    c.fillStyle = `hsla(${(swim * 30) % 360},90%,80%,.35)`; c.fillRect(-L * 0.1, -h * 0.5, L * 0.12, h);
  } else if (p === 'whale'){
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = Math.max(1, L * 0.006);
    for (let k = 0; k < 5; k++){ c.beginPath(); c.moveTo(L * 0.45, h * (0.18 + k * 0.06)); c.lineTo(L * 0.05, h * (0.24 + k * 0.06)); c.stroke(); }
  } else if (p === 'gold'){
    for (let k = 0; k < 6; k++){
      const a = 0.5 + 0.5 * Math.sin(swim * 1.3 + k * 1.1);
      c.fillStyle = `rgba(255,255,230,${0.5 * a})`;
      c.beginPath(); c.arc(L * (0.25 - k * 0.1), -h * 0.15 + (k % 2) * h * 0.2, L * 0.03, 0, 6.2832); c.fill();
    }
  }
}
