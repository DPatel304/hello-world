/* Balloon animals: twisted-balloon dog, giraffe and elephant, each a list of
   sausage-shaped balloons in screen pixels. The list is in drawing order -
   far legs first, the face last - and that is also the order the parts pop
   in when one is caught.

   Units are fractions of the animal's size, facing right, with the origin at
   the middle of its body; `dir` mirrors them for walking left. */

export const ANIMALS = {
  dog: {
    size: 0.17, speed: 0.1, y0: [0.58, 0.66], hues: [0, 28, 135, 215, 270, 325],
    /* Trots with a hop. */
    bob: (a) => Math.abs(Math.sin(a * 4.2)) * 0.06,
    parts(a){
      const sw = Math.sin(a * 9) * 0.13, tail = -2.2 + Math.sin(a * 14) * 0.35;
      return [
        { a:[-0.42, -0.02], b:[-0.42 + Math.cos(tail) * 0.45, -0.02 + Math.sin(tail) * 0.45], w:0.19 },
        { a:[-0.38, 0.04], b:[-0.38 + sw, 0.5], w:0.21, far:true },
        { a:[0.34, 0.04],  b:[0.34 - sw, 0.5],  w:0.21, far:true },
        { a:[0.5, -0.44],  b:[0.62, -0.86],     w:0.21, far:true },
        { a:[-0.42, 0],    b:[0.38, 0],         w:0.30 },
        { a:[-0.38, 0.04], b:[-0.38 - sw, 0.5], w:0.21 },
        { a:[0.34, 0.04],  b:[0.34 + sw, 0.5],  w:0.21 },
        { a:[0.38, 0],     b:[0.5, -0.44],      w:0.26 },
        { a:[0.5, -0.44],  b:[0.42, -0.86],     w:0.21 },
        { a:[0.5, -0.44],  b:[0.92, -0.38],     w:0.26, eye:[0.62, -0.5], nose:[0.95, -0.38] }
      ];
    }
  },

  giraffe: {
    size: 0.15, speed: 0.075, y0: [0.64, 0.68], hues: [42], spots: true,
    /* An unhurried, long-legged walk. */
    bob: (a) => Math.abs(Math.sin(a * 3)) * 0.02,
    parts(a){
      const sw = Math.sin(a * 6) * 0.1, swish = Math.sin(a * 5) * 0.12;
      return [
        { a:[-0.42, -0.04], b:[-0.6 + swish, 0.3], w:0.11 },
        { a:[-0.34, 0.06], b:[-0.34 + sw, 0.95], w:0.18, far:true },
        { a:[0.28, 0.04],  b:[0.28 - sw, 0.95],  w:0.18, far:true },
        { a:[0.6, -1.52],  b:[0.56, -1.74],      w:0.10, far:true },
        { a:[-0.42, 0],    b:[0.36, -0.06],      w:0.32, spots:true },
        { a:[-0.34, 0.06], b:[-0.34 - sw, 0.95], w:0.18 },
        { a:[0.28, 0.04],  b:[0.28 + sw, 0.95],  w:0.18 },
        { a:[0.3, -0.08],  b:[0.6, -1.46],       w:0.22, spots:true },
        { a:[0.66, -1.52], b:[0.7, -1.74],       w:0.10 },
        { a:[0.58, -1.5],  b:[0.98, -1.38],      w:0.24, eye:[0.7, -1.56], nose:[1.0, -1.38] }
      ];
    }
  },

  elephant: {
    size: 0.2, speed: 0.065, y0: [0.6, 0.66], hues: [205, 280, 330],
    /* A heavy, rolling plod, trunk swinging. */
    bob: (a) => Math.abs(Math.sin(a * 3.5)) * 0.015,
    parts(a){
      const sw = Math.sin(a * 7) * 0.06, trunk = Math.sin(a * 2) * 0.08, ear = Math.sin(a * 4) * 0.04;
      return [
        { a:[-0.5, -0.06], b:[-0.64, 0.14], w:0.1 },
        { a:[-0.3, 0.12],  b:[-0.3 + sw, 0.52], w:0.26, far:true },
        { a:[0.26, 0.12],  b:[0.26 - sw, 0.52], w:0.26, far:true },
        { a:[-0.45, 0],    b:[0.32, 0],         w:0.5 },
        { a:[-0.3, 0.12],  b:[-0.3 - sw, 0.52], w:0.26 },
        { a:[0.26, 0.12],  b:[0.26 + sw, 0.52], w:0.26 },
        { a:[0.62, -0.18], b:[0.8, 0.0],        w:0.17 },
        { a:[0.8, 0.0],    b:[0.82 + trunk, 0.24], w:0.15 },
        { a:[0.82 + trunk, 0.24], b:[0.94 + trunk * 1.4, 0.22], w:0.13 },
        { a:[0.42, -0.2],  b:[0.6, -0.22],      w:0.4, eye:[0.56, -0.3] },
        { a:[0.4, -0.36 - ear], b:[0.3, -0.02], w:0.3, ear:true }
      ];
    }
  }
};

/* The parts in pixels, ready to draw, hit-test or pop. */
export function animalParts(an, W, H){
  const def = ANIMALS[an.kind], s = def.size * H, cx = an.x * W, cy = an.y * H;
  const P = ([x, y]) => [cx + an.dir * x * s, cy + y * s];
  return def.parts(an.age).map(p => ({
    ...p, a: P(p.a), b: P(p.b), w: p.w * s,
    eye: p.eye && P(p.eye), nose: p.nose && P(p.nose), s
  }));
}

/* A hand counts if it touches any part not yet popped, with a little grace. */
export function touches(an, hx, hy, W, H){
  const parts = animalParts(an, W, H), px = hx * W, py = hy * H, grace = H * 0.03;
  for (let i = an.popped; i < parts.length; i++){
    const { a, b, w } = parts[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
    if (Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t)) < w / 2 + grace) return true;
  }
  return false;
}

export const animalCol = (an, far) => `hsl(${an.hue} ${far ? 72 : 85}% ${far ? 46 : 60}%)`;

export function drawAnimal(c, an, W, H){
  const parts = animalParts(an, W, H);
  c.lineCap = 'round';
  for (let i = an.popped; i < parts.length; i++){
    const p = parts[i];
    const [x1, y1] = p.a, [x2, y2] = p.b;
    c.strokeStyle = `hsl(${an.hue} 70% 30%)`; c.lineWidth = p.w + Math.max(3, H * 0.004);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = p.ear ? `hsl(${an.hue} 80% 72%)` : animalCol(an, p.far);
    c.lineWidth = p.w;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    if (p.spots){
      c.fillStyle = 'hsl(25 70% 38%)';
      for (const k of [0.2, 0.45, 0.7]){
        c.beginPath(); c.arc(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k + p.w * 0.12, p.w * 0.16, 0, 6.2832); c.fill();
      }
    }
    /* A streak of shine along the top of each twist. */
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = p.w * 0.2;
    c.beginPath();
    c.moveTo(x1 + (x2 - x1) * 0.2, y1 + (y2 - y1) * 0.2 - p.w * 0.2);
    c.lineTo(x1 + (x2 - x1) * 0.65, y1 + (y2 - y1) * 0.65 - p.w * 0.2);
    c.stroke();
    if (p.nose){
      c.fillStyle = '#1d1430';
      c.beginPath(); c.arc(p.nose[0], p.nose[1], p.s * 0.055, 0, 6.2832); c.fill();
    }
    if (p.eye){
      c.fillStyle = '#1d1430';
      c.beginPath(); c.arc(p.eye[0], p.eye[1], p.s * 0.045, 0, 6.2832); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(p.eye[0] + p.s * 0.015, p.eye[1] - p.s * 0.015, p.s * 0.015, 0, 6.2832); c.fill();
    }
  }
}
