/* The animals of Animal Copycat, each drawn doing its pose, and the bits of
   costume the children wear while copying them: giraffe horns, bunny ears,
   a crest of feathers. Every animal stands with its feet at (x, base) and
   is about s tall; `happy` is the cheer when the children have copied it. */

function eyes(c, x, y, r, happy, gap = 1){
  for (const d of [-1, 1]){
    const ex = x + d * r * 1.3 * gap;
    if (happy){
      c.strokeStyle = '#2b2440'; c.lineWidth = r * 0.45; c.lineCap = 'round';
      c.beginPath(); c.arc(ex, y + r * 0.3, r * 0.8, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    } else {
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ex, y, r, 0, 6.2832); c.fill();
      c.fillStyle = '#2b2440'; c.beginPath(); c.arc(ex, y + r * 0.1, r * 0.6, 0, 6.2832); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ex + r * 0.2, y - r * 0.15, r * 0.22, 0, 6.2832); c.fill();
    }
  }
}
function cheeks(c, x, y, r, gap){
  c.fillStyle = 'rgba(255,120,140,.45)';
  for (const d of [-1, 1]){ c.beginPath(); c.ellipse(x + d * gap, y, r, r * 0.65, 0, 0, 6.2832); c.fill(); }
}
function smile(c, x, y, r, w){
  c.strokeStyle = '#2b2440'; c.lineWidth = w; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
}
function shadow(c, x, base, w){
  c.fillStyle = 'rgba(30,40,40,.22)'; c.beginPath(); c.ellipse(x, base, w, w * 0.18, 0, 0, 6.2832); c.fill();
}
const limb = (c, col, w, pts) => {
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
};

export const DRAW = {
  giraffe(c, x, base, s, t, happy){
    const stretch = 1 + Math.sin(t * 2.2) * 0.04 + (happy ? 0.06 : 0), k = s / 100;
    shadow(c, x, base, 26 * k);
    for (const [dx, ph] of [[-14, 0], [14, 1.5]]) limb(c, '#f0b44c', 7 * k, [[x + dx * k, base - 32 * k], [x + dx * k, base]]);
    c.fillStyle = '#f6c25a'; c.beginPath(); c.ellipse(x, base - 38 * k, 24 * k, 15 * k, 0, 0, 6.2832); c.fill();
    const top = base - (38 + 52 * stretch) * k;
    c.fillStyle = '#f6c25a'; c.beginPath(); c.moveTo(x - 7 * k, base - 45 * k); c.lineTo(x - 5 * k, top); c.lineTo(x + 6 * k, top); c.lineTo(x + 8 * k, base - 45 * k); c.closePath(); c.fill();
    c.fillStyle = '#c97a2c';
    for (const [sx, sy, r] of [[-12, -40, 4], [6, -34, 5], [12, -44, 3.5], [-2, -60, 3], [2, -75, 2.6], [-1, -88, 2.4]]){
      c.beginPath(); c.arc(x + sx * k, base + sy * k * (sy < -50 ? stretch : 1), r * k, 0, 6.2832); c.fill();
    }
    const hy = top - 6 * k;
    c.fillStyle = '#f6c25a'; c.beginPath(); c.ellipse(x + 3 * k, hy, 11 * k, 9 * k, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#ffe2a8'; c.beginPath(); c.ellipse(x + 8 * k, hy + 4 * k, 7 * k, 5 * k, 0, 0, 6.2832); c.fill();
    limb(c, '#c97a2c', 2.5 * k, [[x - 2 * k, hy - 7 * k], [x - 4 * k, hy - 16 * k]]);
    limb(c, '#c97a2c', 2.5 * k, [[x + 6 * k, hy - 7 * k], [x + 7 * k, hy - 16 * k]]);
    c.fillStyle = '#8a4f1c'; for (const dx of [-4, 7]){ c.beginPath(); c.arc(x + dx * k, hy - 17 * k, 2.6 * k, 0, 6.2832); c.fill(); }
    eyes(c, x + 2 * k, hy - 1 * k, 2.2 * k, happy, 1.3);
  },

  bird(c, x, base, s, t, happy){
    const k = s / 100, flap = Math.sin(t * (happy ? 14 : 5)) * 0.12, y = base - 46 * k;
    shadow(c, x, base, 20 * k);
    limb(c, '#ff9f45', 2.5 * k, [[x - 5 * k, y + 22 * k], [x - 6 * k, base]]); limb(c, '#ff9f45', 2.5 * k, [[x + 5 * k, y + 22 * k], [x + 6 * k, base]]);
    c.fillStyle = '#4aa8ff';
    for (const d of [-1, 1]){
      c.save(); c.translate(x + d * 16 * k, y - 4 * k); c.rotate(d * flap);
      c.beginPath(); c.moveTo(0, -6 * k); c.quadraticCurveTo(d * 30 * k, -16 * k, d * 52 * k, -10 * k); c.quadraticCurveTo(d * 34 * k, 4 * k, 0, 10 * k); c.closePath(); c.fill();
      c.fillStyle = '#2f86e0'; for (let f = 0; f < 3; f++){ c.beginPath(); c.ellipse(d * (38 + f * 6) * k, (-6 + f * 4) * k, 7 * k, 3 * k, d * 0.3, 0, 6.2832); c.fill(); }
      c.fillStyle = '#4aa8ff'; c.restore();
    }
    c.beginPath(); c.ellipse(x, y, 22 * k, 25 * k, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#e8f4ff'; c.beginPath(); c.ellipse(x, y + 8 * k, 14 * k, 15 * k, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#4aa8ff'; for (const d of [-1, 0, 1]){ c.beginPath(); c.ellipse(x + d * 5 * k, y - 26 * k, 3 * k, 8 * k, d * 0.4, 0, 6.2832); c.fill(); }
    c.fillStyle = '#ffb347'; c.beginPath(); c.moveTo(x - 4 * k, y - 4 * k); c.lineTo(x + 4 * k, y - 4 * k); c.lineTo(x, y + 3 * k); c.closePath(); c.fill();
    eyes(c, x, y - 11 * k, 3.2 * k, happy, 1.6);
  },

  starfish(c, x, base, s, t, happy){
    const k = s / 100, y = base - 48 * k, wig = Math.sin(t * 3) * 0.06 + (happy ? Math.sin(t * 12) * 0.08 : 0);
    shadow(c, x, base, 26 * k);
    c.fillStyle = '#ff8a5c';
    c.beginPath();
    for (let i = 0; i < 10; i++){
      const a = -Math.PI / 2 + i * Math.PI / 5 + (i % 2 ? 0 : wig * (i < 5 ? 1 : -1)), d = (i % 2 ? 20 : 50) * k;
      c.lineTo(x + Math.cos(a) * d * 1.05, y + Math.sin(a) * d);
    }
    c.closePath(); c.lineJoin = 'round'; c.strokeStyle = '#ff8a5c'; c.lineWidth = 14 * k; c.stroke(); c.fill();
    c.fillStyle = '#ffc09a';
    for (let i = 0; i < 5; i++){ const a = -Math.PI / 2 + i * 2 * Math.PI / 5; for (let d = 18; d < 46; d += 9){ c.beginPath(); c.arc(x + Math.cos(a) * d * k, y + Math.sin(a) * d * k, 2 * k, 0, 6.2832); c.fill(); } }
    eyes(c, x, y - 4 * k, 4 * k, happy, 1.4);
    cheeks(c, x, y + 4 * k, 3.5 * k, 11 * k); smile(c, x, y + 4 * k, 5 * k, 2 * k);
  },

  bunny(c, x, base, s, t, happy){
    const k = s / 100, hop = happy ? Math.abs(Math.sin(t * 7)) * 10 * k : 0, y = base - 36 * k - hop;
    shadow(c, x, base, 22 * k);
    c.fillStyle = '#f7f3ec';
    for (const d of [-1, 1]){ c.beginPath(); c.ellipse(x + d * 10 * k, base - 4 * k - hop, 10 * k, 5 * k, 0, 0, 6.2832); c.fill(); }
    c.beginPath(); c.ellipse(x, y, 20 * k, 26 * k, 0, 0, 6.2832); c.fill();
    const hy = y - 36 * k;
    for (const d of [-1, 1]){
      c.save(); c.translate(x + d * 7 * k, hy - 12 * k); c.rotate(d * (0.15 + Math.sin(t * 2 + d) * 0.06));
      c.fillStyle = '#f7f3ec'; c.beginPath(); c.ellipse(0, -18 * k, 6 * k, 20 * k, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#ffc2cf'; c.beginPath(); c.ellipse(0, -18 * k, 3 * k, 14 * k, 0, 0, 6.2832); c.fill();
      c.restore();
    }
    c.fillStyle = '#f7f3ec'; c.beginPath(); c.arc(x, hy, 17 * k, 0, 6.2832); c.fill();
    /* Paws up by the ears: the pose. */
    limb(c, '#f7f3ec', 8 * k, [[x - 14 * k, y - 16 * k], [x - 22 * k, hy - 8 * k], [x - 12 * k, hy - 18 * k]]);
    limb(c, '#f7f3ec', 8 * k, [[x + 14 * k, y - 16 * k], [x + 22 * k, hy - 8 * k], [x + 12 * k, hy - 18 * k]]);
    eyes(c, x, hy - 2 * k, 3 * k, happy, 1.6);
    c.fillStyle = '#ff9fb3'; c.beginPath(); c.arc(x, hy + 5 * k, 2.4 * k, 0, 6.2832); c.fill();
    cheeks(c, x, hy + 7 * k, 3 * k, 10 * k);
  },

  elephant(c, x, base, s, t, happy){
    const k = s / 100, y = base - 40 * k, sw = Math.sin(t * (happy ? 6 : 2.5)) * (happy ? 0.6 : 0.25);
    shadow(c, x, base, 34 * k);
    c.fillStyle = '#a7aec0';
    for (const dx of [-18, -6, 8, 20]){ c.beginPath(); c.roundRect(x + dx * k - 6 * k, base - 24 * k, 12 * k, 24 * k, 4 * k); c.fill(); }
    c.beginPath(); c.ellipse(x, y, 34 * k, 24 * k, 0, 0, 6.2832); c.fill();
    const hy = y - 26 * k;
    c.fillStyle = '#c4cad8';
    for (const d of [-1, 1]){ c.beginPath(); c.ellipse(x + d * 22 * k, hy, 15 * k, 19 * k, d * 0.2 + sw * 0.15 * d, 0, 6.2832); c.fill(); }
    c.fillStyle = '#ffc2cf'; for (const d of [-1, 1]){ c.beginPath(); c.ellipse(x + d * 22 * k, hy, 9 * k, 12 * k, d * 0.2, 0, 6.2832); c.fill(); }
    c.fillStyle = '#a7aec0'; c.beginPath(); c.arc(x, hy, 20 * k, 0, 6.2832); c.fill();
    /* The trunk, swinging; up and trumpeting when happy. */
    c.save(); c.translate(x, hy + 8 * k); c.rotate(sw + (happy ? Math.PI * 0.9 : 0));
    limb(c, '#a7aec0', 9 * k, [[0, 0], [0, 14 * k], [3 * k, 26 * k], [8 * k, 30 * k]]);
    c.restore();
    eyes(c, x, hy - 4 * k, 3 * k, happy, 2);
    cheeks(c, x, hy + 4 * k, 3 * k, 12 * k);
  },

  frog(c, x, base, s, t, happy){
    const k = s / 100, hop = happy ? Math.abs(Math.sin(t * 6)) * 14 * k : 0, y = base - 22 * k - hop;
    shadow(c, x, base, 30 * k);
    c.fillStyle = '#5fc46d';
    /* Knees wide, hands down between them: a squat. */
    for (const d of [-1, 1]){
      c.beginPath(); c.ellipse(x + d * 24 * k, y + 4 * k, 13 * k, 16 * k, d * 0.5, 0, 6.2832); c.fill();
      c.beginPath(); c.ellipse(x + d * 28 * k, base - 3 * k - hop, 12 * k, 4 * k, 0, 0, 6.2832); c.fill();
    }
    c.beginPath(); c.ellipse(x, y - 4 * k, 26 * k, 20 * k, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#b9ec9a'; c.beginPath(); c.ellipse(x, y + 2 * k, 15 * k, 11 * k, 0, 0, 6.2832); c.fill();
    limb(c, '#5fc46d', 6 * k, [[x - 10 * k, y + 2 * k], [x - 8 * k, base - 2 * k - hop]]);
    limb(c, '#5fc46d', 6 * k, [[x + 10 * k, y + 2 * k], [x + 8 * k, base - 2 * k - hop]]);
    c.fillStyle = '#5fc46d'; for (const d of [-1, 1]){ c.beginPath(); c.arc(x + d * 13 * k, y - 22 * k, 10 * k, 0, 6.2832); c.fill(); }
    eyes(c, x, y - 22 * k, 6 * k, happy, 2.2);
    smile(c, x, y - 10 * k, 12 * k, 2.5 * k);
    cheeks(c, x, y - 8 * k, 3.5 * k, 17 * k);
  },

  flamingo(c, x, base, s, t, happy){
    const k = s / 100, wob = Math.sin(t * 2) * 1.5 * k, y = base - 52 * k;
    shadow(c, x, base, 18 * k);
    limb(c, '#ff8fb1', 3 * k, [[x + wob, y + 14 * k], [x + wob * 0.5, base]]);
    /* The other leg tucked up. */
    limb(c, '#ff8fb1', 3 * k, [[x - 3 * k + wob, y + 14 * k], [x - 12 * k + wob, y + 28 * k], [x - 2 * k + wob, y + 32 * k]]);
    c.fillStyle = '#ff9ec0';
    for (const d of [-1, 1]){
      c.save(); c.translate(x + d * 12 * k + wob, y); c.rotate(d * (-0.25 + Math.sin(t * (happy ? 12 : 3)) * 0.12));
      c.beginPath(); c.moveTo(0, -5 * k); c.quadraticCurveTo(d * 28 * k, -14 * k, d * 42 * k, -2 * k); c.quadraticCurveTo(d * 24 * k, 8 * k, 0, 8 * k); c.closePath(); c.fill();
      c.restore();
    }
    c.beginPath(); c.ellipse(x + wob, y, 18 * k, 14 * k, 0, 0, 6.2832); c.fill();
    limb(c, '#ff9ec0', 5 * k, [[x + 6 * k + wob, y - 8 * k], [x + 10 * k + wob, y - 26 * k], [x + 3 * k + wob, y - 40 * k]]);
    const hx = x + 2 * k + wob, hy = y - 44 * k;
    c.fillStyle = '#ff9ec0'; c.beginPath(); c.arc(hx, hy, 8 * k, 0, 6.2832); c.fill();
    c.fillStyle = '#2b2440'; c.beginPath(); c.moveTo(hx + 6 * k, hy - 1 * k); c.quadraticCurveTo(hx + 16 * k, hy, hx + 13 * k, hy + 8 * k); c.lineTo(hx + 7 * k, hy + 3 * k); c.closePath(); c.fill();
    eyes(c, hx, hy - 2 * k, 2 * k, happy, 1.2);
  }
};

/* A bit of costume on a child's head - centre (x, y), radius r - tilted
   with it. */
export function costume(c, name, x, y, r, roll = 0){
  c.save(); c.translate(x, y); c.rotate(roll);
  const top = -r * 0.9;
  if (name === 'giraffe'){
    for (const d of [-1, 1]){
      limb(c, '#c97a2c', r * 0.14, [[d * r * 0.3, top + r * 0.1], [d * r * 0.36, top - r * 0.4]]);
      c.fillStyle = '#8a4f1c'; c.beginPath(); c.arc(d * r * 0.36, top - r * 0.45, r * 0.13, 0, 6.2832); c.fill();
      c.fillStyle = '#f6c25a'; c.beginPath(); c.ellipse(d * r * 0.85, top + r * 0.35, r * 0.25, r * 0.12, d * 0.4, 0, 6.2832); c.fill();
    }
  } else if (name === 'bird'){
    c.fillStyle = '#4aa8ff';
    for (const d of [-1, 0, 1]){ c.beginPath(); c.ellipse(d * r * 0.18, top - r * 0.2, r * 0.1, r * 0.32, d * 0.4, 0, 6.2832); c.fill(); }
  } else if (name === 'starfish'){
    c.fillStyle = '#ff8a5c';
    c.beginPath();
    for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, d = (i % 2 ? 0.16 : 0.38) * r; c.lineTo(Math.cos(a) * d, top - r * 0.2 + Math.sin(a) * d); }
    c.closePath(); c.fill();
  } else if (name === 'bunny'){
    for (const d of [-1, 1]){
      c.save(); c.translate(d * r * 0.35, top); c.rotate(d * 0.18);
      c.fillStyle = '#f7f3ec'; c.beginPath(); c.ellipse(0, -r * 0.55, r * 0.2, r * 0.65, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#ffc2cf'; c.beginPath(); c.ellipse(0, -r * 0.55, r * 0.1, r * 0.48, 0, 0, 6.2832); c.fill();
      c.restore();
    }
  } else if (name === 'elephant'){
    for (const d of [-1, 1]){
      c.fillStyle = '#a7aec0'; c.beginPath(); c.ellipse(d * r * 1.15, -r * 0.05, r * 0.5, r * 0.68, d * 0.15, 0, 6.2832); c.fill();
      c.fillStyle = '#ffc2cf'; c.beginPath(); c.ellipse(d * r * 1.15, -r * 0.05, r * 0.3, r * 0.45, d * 0.15, 0, 6.2832); c.fill();
    }
  } else if (name === 'frog'){
    for (const d of [-1, 1]){
      c.fillStyle = '#5fc46d'; c.beginPath(); c.arc(d * r * 0.42, top, r * 0.3, 0, 6.2832); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(d * r * 0.42, top - r * 0.03, r * 0.18, 0, 6.2832); c.fill();
      c.fillStyle = '#2b2440'; c.beginPath(); c.arc(d * r * 0.42, top, r * 0.1, 0, 6.2832); c.fill();
    }
  } else if (name === 'flamingo'){
    c.fillStyle = '#ff9ec0';
    for (const [dx, a] of [[-0.1, -0.5], [0.05, 0], [0.2, 0.5]]){ c.beginPath(); c.ellipse(dx * r, top - r * 0.25, r * 0.09, r * 0.34, a * 0.5, 0, 6.2832); c.fill(); }
  }
  c.restore();
}
