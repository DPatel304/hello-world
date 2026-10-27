/* The park at dusk, painted. Shared by the title and the menu so the two
   screens are obviously the same place.

   Soft and slow on purpose, a picture-book evening: the sun just down behind
   the far hills, big clouds lit pink from underneath, the first star out over
   a great old tree, wind moving through the long grass and a few fireflies
   waking up. Nothing here is an asset: no files to load, and it is sharp on
   any size of television.

   The parts that never move - sky, hills, the tree - are painted once into an
   offscreen layer for each screen size, and the clouds into a strip that
   slides; only the grass, stars, fireflies and petals are drawn each frame. */

const hash = (i, k = 1) => (((i + 1) * 2654435761 * k) % 4294967296) / 4294967296;

const STARS = Array.from({ length: 46 }, (_, i) => ({ x: hash(i, 3), y: hash(i, 5) * 0.34,
                                                      r: i % 8 === 0 ? 1.8 : 1.1, ph: hash(i, 7) * 6.28 }));
const CLOUDS = [[0.08, 0.30, 0.34], [0.36, 0.17, 0.26], [0.58, 0.36, 0.40], [0.86, 0.22, 0.30], [0.24, 0.47, 0.22]];
const BLADES = Array.from({ length: 230 }, (_, i) => ({ x: -0.02 + hash(i, 11) * 1.04, y: 0.93 + hash(i, 13) * 0.09,
                                                        h: 0.035 + hash(i, 17) * 0.05, ph: hash(i, 19) * 6.28,
                                                        tone: i % 11 === 0 ? 2 : i % 3 === 0 ? 1 : 0 }));
const FLIES = Array.from({ length: 12 }, (_, i) => ({ x: 0.05 + hash(i, 23) * 0.9, y: 0.74 + hash(i, 29) * 0.18,
                                                      ph: hash(i, 31) * 6.28, f: 0.25 + hash(i, 37) * 0.3,
                                                      blink: 2.2 + hash(i, 41) * 2 }));
const PETALS = Array.from({ length: 7 }, (_, i) => ({ y: 0.3 + hash(i, 43) * 0.5, ph: hash(i, 47), sp: 0.03 + hash(i, 53) * 0.03 }));
const BLADE_TONES = ['#28493b', '#3f6b4c', '#b9a874'];

/* The tree's crown, as lumps around its centre: [dx, dy, r] in crown radii. */
const CROWN = [[0, 0, 0.62], [-0.55, 0.12, 0.45], [0.55, 0.14, 0.47], [-0.3, -0.38, 0.5], [0.32, -0.36, 0.5],
               [0, -0.62, 0.42], [-0.82, 0.32, 0.3], [0.86, 0.34, 0.3], [-0.2, 0.36, 0.4], [0.3, 0.38, 0.38]];

let cache = null;

function offscreen(w, h){
  try {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
    return cv.getContext && cv.getContext('2d') ? cv : null;
  } catch { return null; }
}

function layers(W, H){
  if (cache && cache.W === W && cache.H === H) return cache;
  const sky = offscreen(W, H), clouds = offscreen(W, H * 0.62), land = offscreen(W, H);
  cache = { W, H, sky, clouds, land };
  if (sky) paintSky(sky.getContext('2d'), W, H);
  if (clouds) paintClouds(clouds.getContext('2d'), W, H);
  if (land) paintLand(land.getContext('2d'), W, H);
  return cache;
}

export function drawPark(c, W, H, t, dim = 0){
  const L = layers(W, H);
  if (L.sky) c.drawImage(L.sky, 0, 0, W, H); else paintSky(c, W, H);
  drawStars(c, W, H, t);
  if (L.clouds){
    /* The clouds drift right and wrap; the strip is drawn twice to cover the seam. */
    const off = (t * W * 0.004) % W, ch = H * 0.62;
    c.drawImage(L.clouds, off, 0, W, ch);
    c.drawImage(L.clouds, off - W, 0, W, ch);
  } else paintClouds(c, W, H);
  if (L.land) c.drawImage(L.land, 0, 0, W, H); else paintLand(c, W, H);
  drawFlies(c, W, H, t);
  drawGrass(c, W, H, t);
  drawPetals(c, W, H, t);

  /* Screens with a lot of interface on top ask for the park to step back. */
  if (dim > 0){
    c.fillStyle = `rgba(14,12,34,${dim})`;
    c.fillRect(0, 0, W, H);
  }
}

/* How strong the wind is at x right now: a steady sway, and every so often a
   gust that rolls across the meadow from the left. */
export function wind(x, t){
  const gx = ((t * 0.11) % 1.7) - 0.35;
  return Math.sin(t * 1.1 + x * 5) * 0.22 + Math.exp(-Math.pow((x - gx) / 0.13, 2)) * 0.55;
}

function paintSky(c, W, H){
  const g = c.createLinearGradient(0, 0, 0, H * 0.74);
  g.addColorStop(0, '#22336a'); g.addColorStop(0.36, '#4d5597'); g.addColorStop(0.62, '#a3849f');
  g.addColorStop(0.84, '#eba68e'); g.addColorStop(1, '#f9d59c');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  /* The sun, just down: its glow spread along the horizon behind the hills. */
  const sx = W * 0.36, sy = H * 0.7;
  const glow = c.createRadialGradient(sx, sy, 0, sx, sy, H * 0.6);
  glow.addColorStop(0, 'rgba(255,236,190,.85)'); glow.addColorStop(0.35, 'rgba(255,196,150,.3)');
  glow.addColorStop(1, 'rgba(255,190,150,0)');
  c.fillStyle = glow; c.fillRect(0, 0, W, H);
  c.fillStyle = '#fff3d0';
  c.beginPath(); c.arc(sx, H * 0.665, H * 0.045, 0, 6.2832); c.fill();
}

/* Big soft cumulus, lit warm from underneath by the set sun and shaded
   lavender on top. Each is a heap of round lumps with a flat base. */
function paintClouds(c, W, H){
  for (const [cx, cy, s] of CLOUDS){
    const w = H * 0.62 * s, base = H * cy;
    for (const x0 of [cx * W - W, cx * W, cx * W + W]){
      if (x0 + w < 0 || x0 - w > W) continue;
      c.save();
      c.beginPath(); c.rect(x0 - w, base - w, w * 2, w); c.clip();
      const g = c.createLinearGradient(0, base - w * 0.5, 0, base);
      g.addColorStop(0, '#8a86bd'); g.addColorStop(0.6, '#c99db0'); g.addColorStop(1, '#ffc6a4');
      c.fillStyle = g;
      c.beginPath();
      const n = 6;
      for (let k = 0; k < n; k++){
        const f = k / (n - 1), r = w * (0.17 + 0.13 * Math.sin(f * Math.PI)) * (0.85 + hash(k, cx * 97 | 0) * 0.3);
        const x = x0 + (f - 0.5) * w * 0.95, y = base - r * 0.55;
        c.moveTo(x + r, y); c.arc(x, y, r, 0, 6.2832);
      }
      c.fill();
      /* A soft lighter top on each lump, for roundness. */
      c.fillStyle = 'rgba(190,184,226,.35)';
      c.beginPath();
      for (let k = 1; k < n - 1; k++){
        const f = k / (n - 1), r = w * (0.17 + 0.13 * Math.sin(f * Math.PI)) * 0.55;
        const x = x0 + (f - 0.5) * w * 0.95 - r * 0.25, y = base - r * 1.9;
        c.moveTo(x + r, y); c.arc(x, y, r, 0, 6.2832);
      }
      c.fill();
      c.restore();
    }
  }
}

function ridge(c, W, H, y, amp, n, seed, col){
  c.fillStyle = col;
  c.beginPath(); c.moveTo(0, H); c.lineTo(0, H * y);
  for (let i = 0; i <= n; i++){
    const x = W * (i / n), py = H * (y - amp * (0.4 + hash(i, seed) * 0.6));
    const mx = W * ((i + 0.5) / n);
    c.quadraticCurveTo(x, py, mx, H * (y - amp * 0.2));
  }
  c.lineTo(W, H); c.closePath(); c.fill();
}

/* Where a band of hills' top edge is at x (0..1), in screen heights: each
   hump is a quadratic with its control point mid-way, which is a parabola. */
export function hillTop(x, y, h, n){
  const u = (x * n) % 1;
  return y - h * u * (1 - u);
}
export const MEADOW = { y: 0.81, h: 0.09, n: 4 };

function hill(c, W, H, y, h, n, col, rim){
  c.beginPath(); c.moveTo(0, H); c.lineTo(0, H * y);
  for (let i = 0; i < n; i++){
    c.quadraticCurveTo(W * ((i + 0.5) / n), H * (y - h * 0.5), W * ((i + 1) / n), H * y);
  }
  c.lineTo(W, H); c.closePath();
  c.fillStyle = col; c.fill();
  /* The last of the sun catching the ridge line. */
  c.save(); c.clip();
  c.strokeStyle = rim; c.lineWidth = H * 0.012;
  c.beginPath(); c.moveTo(0, H * y);
  for (let i = 0; i < n; i++) c.quadraticCurveTo(W * ((i + 0.5) / n), H * (y - h * 0.5), W * ((i + 1) / n), H * y);
  c.stroke();
  c.restore();
}

function paintLand(c, W, H){
  ridge(c, W, H, 0.66, 0.07, 7, 3, '#b496b4');
  ridge(c, W, H, 0.7, 0.06, 5, 5, '#8c86ae');
  const mist = c.createLinearGradient(0, H * 0.6, 0, H * 0.76);
  mist.addColorStop(0, 'rgba(250,206,172,0)'); mist.addColorStop(0.7, 'rgba(250,206,172,.35)');
  mist.addColorStop(1, 'rgba(250,206,172,0)');
  c.fillStyle = mist; c.fillRect(0, H * 0.6, W, H * 0.16);

  hill(c, W, H, 0.74, 0.06, 3, '#6a8580', 'rgba(255,214,170,.28)');
  for (const [fx, s] of [[0.1, 0.7], [0.14, 0.5], [0.5, 0.6], [0.55, 0.45]]){
    /* Little round trees far off on the first hill, sat on its crest. */
    const x = W * fx, y = H * (hillTop(fx, 0.74, 0.06, 3) + 0.004), r = H * 0.02 * s;
    c.fillStyle = '#5a7671';
    c.fillRect(x - r * 0.15, y - r, r * 0.3, r);
    c.beginPath(); c.arc(x, y - r * 1.6, r, 0, 6.2832); c.fill();
  }
  hill(c, W, H, MEADOW.y, MEADOW.h, MEADOW.n, '#4f7564', 'rgba(255,214,160,.3)');
  tree(c, W * 0.8, H * (hillTop(0.8, MEADOW.y, MEADOW.h, MEADOW.n) + 0.01), H);
  hill(c, W, H, 0.9, 0.12, 3, '#3d644f', 'rgba(255,220,160,.22)');
}

/* The great old tree on the hill: a stout trunk and a wide, heaped crown,
   dark underneath and warm where the last light reaches its left side. */
function tree(c, x, ground, H){
  const R = H * 0.17, cy = ground - H * 0.24;
  c.fillStyle = '#34463a';
  c.beginPath();
  c.moveTo(x - H * 0.03, ground + H * 0.01);
  c.quadraticCurveTo(x - H * 0.012, ground - H * 0.1, x - H * 0.05, cy + R * 0.2);
  c.lineTo(x - H * 0.02, cy + R * 0.25);
  c.quadraticCurveTo(x, cy + R * 0.5, x + H * 0.02, cy + R * 0.25);
  c.lineTo(x + H * 0.055, cy + R * 0.2);
  c.quadraticCurveTo(x + H * 0.014, ground - H * 0.1, x + H * 0.034, ground + H * 0.01);
  c.closePath(); c.fill();
  const lumps = (col, dx, dy, k) => {
    c.fillStyle = col; c.beginPath();
    for (const [lx, ly, lr] of CROWN){
      const px = x + (lx + dx) * R * 1.25, py = cy + (ly + dy) * R, r = lr * R * k;
      c.moveTo(px + r, py); c.arc(px, py, r, 0, 6.2832);
    }
    c.fill();
  };
  lumps('#2c4a3b', 0, 0.06, 1);
  lumps('#3f644c', -0.04, -0.03, 0.9);
  lumps('rgba(150,160,110,.55)', -0.12, -0.12, 0.55);
  lumps('rgba(240,200,140,.18)', -0.18, -0.16, 0.35);
}

function drawStars(c, W, H, t){
  c.fillStyle = '#fff';
  for (const s of STARS){
    /* Fainter lower down, where the sky is still bright. */
    c.globalAlpha = (1 - s.y / 0.36) * (0.5 + 0.5 * Math.sin(t * 1.3 + s.ph));
    c.beginPath(); c.arc(s.x * W, s.y * H, Math.max(1, s.r * H / 900), 0, 6.2832); c.fill();
  }
  /* The evening star: the first one out, and the one the park is named for. */
  const x = W * 0.26, y = H * 0.2, k = 0.85 + 0.15 * Math.sin(t * 1.7), s = H * 0.022 * k;
  c.globalAlpha = 1;
  const g = c.createRadialGradient(x, y, 0, x, y, s * 3);
  g.addColorStop(0, 'rgba(255,248,220,.7)'); g.addColorStop(1, 'rgba(255,248,220,0)');
  c.fillStyle = g; c.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
  c.fillStyle = '#fffaf0';
  c.beginPath();
  for (let i = 0; i < 8; i++){
    const a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? s * 0.22 : s;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath(); c.fill();
}

function drawGrass(c, W, H, t){
  c.lineCap = 'round';
  for (let tone = 0; tone < 3; tone++){
    c.strokeStyle = BLADE_TONES[tone];
    c.lineWidth = Math.max(2, H * (tone === 2 ? 0.003 : 0.006));
    c.beginPath();
    for (const b of BLADES){
      if (b.tone !== tone) continue;
      const x = b.x * W, y = b.y * H, h = b.h * H;
      const bend = (wind(b.x, t) + Math.sin(t * 2.3 + b.ph) * 0.05) * h * 0.5;
      c.moveTo(x, y);
      c.quadraticCurveTo(x + bend * 0.3, y - h * 0.55, x + bend, y - h * Math.sqrt(1 - Math.min(0.5, Math.abs(bend / h)) ** 2));
    }
    c.stroke();
  }
}

function drawFlies(c, W, H, t){
  for (const f of FLIES){
    const x = (f.x + Math.sin(t * f.f + f.ph) * 0.03) * W, y = (f.y + Math.sin(t * f.f * 1.3 + f.ph * 2) * 0.02) * H;
    const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * (6.28 / f.blink) + f.ph));
    glow(c, x, y, H * 0.008, a);
  }
}

export function glow(c, x, y, r, a, col = '220,255,140'){
  const g = c.createRadialGradient(x, y, 0, x, y, r * 4.5);
  g.addColorStop(0, `rgba(${col},${0.85 * a})`); g.addColorStop(0.3, `rgba(${col},${0.3 * a})`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r * 4.5, 0, 6.2832); c.fill();
  c.fillStyle = `rgba(255,255,225,${a})`;
  c.beginPath(); c.arc(x, y, r * 0.6, 0, 6.2832); c.fill();
}

/* A few petals carried along on the wind. */
function drawPetals(c, W, H, t){
  c.fillStyle = 'rgba(255,226,214,.8)';
  for (const p of PETALS){
    const u = (p.ph + t * p.sp) % 1.2 - 0.1;
    const x = u * W, y = (p.y + Math.sin(t * 0.9 + p.ph * 6) * 0.03 + u * 0.06) * H;
    c.save(); c.translate(x, y); c.rotate(t * 1.5 + p.ph * 6);
    c.beginPath(); c.ellipse(0, 0, H * 0.006, H * 0.0035, 0, 0, 6.2832); c.fill();
    c.restore();
  }
}
