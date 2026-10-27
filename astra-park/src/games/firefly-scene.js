/* The park at nightfall, for Firefly Night. The game owns the fireflies and
   the jars; this owns the world around them:

   - the round's progress, which deepens dusk into night: the warm horizon
     fades, stars come out one by one and the moon climbs;
   - lanterns, one for every jar the players fill, which rise from the jar
     and settle into the sky, so the sky ends up a record of the round;
   - extra stars, which the ending adds as the fireflies fly up;
   - where the players stand, which shifts the layers a little, as in the day
     scene.

   drawBack paints the sky and land behind everything; drawFront the grass in
   front. Lite mode drops the grass and mist if the laptop can't keep up. */

const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hash = (i, k = 1) => (((i + 1) * 2654435761 * k) % 4294967296) / 4294967296;

/* Dusk to night, by progress 0..1: sky top, middle and horizon, then the
   land from far to near. */
const DUSK = [
  { p: 0,   sky: ['#2b3a7a', '#7c5a9c', '#f0a07a'], land: ['#4a4f7e', '#2f4a52', '#22403f', '#183330'] },
  { p: 0.5, sky: ['#151b47', '#2e2f6b', '#6b5a8c'], land: ['#2d3360', '#1d3340', '#172d30', '#112524'] },
  { p: 1,   sky: ['#070a24', '#121a45', '#2b3366'], land: ['#1c2148', '#132634', '#0f2226', '#0b1b1c'] }
].map(k => ({ p: k.p, sky: k.sky.map(hex), land: k.land.map(hex) }));

export function nightfall(p){
  const i = p < DUSK[1].p ? 0 : 1, a = DUSK[i], b = DUSK[i + 1];
  const t = Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p)));
  return { sky: a.sky.map((c, k) => mix(c, b.sky[k], t)), land: a.land.map((c, k) => mix(c, b.land[k], t)) };
}

const STARS = Array.from({ length: 140 }, (_, i) => ({
  x: hash(i, 3), y: hash(i, 5) * 0.62, r: i % 9 === 0 ? 2.2 : 1.2, ph: hash(i, 7) * 6.28,
  /* Each star has its moment to come out, brightest first. */
  at: 0.12 + hash(i, 11) * 0.55 * (i % 9 === 0 ? 0.4 : 1)
}));
const PEAKS = Array.from({ length: 10 }, (_, i) => ({ x: -0.1 + i * 0.13 + hash(i, 13) * 0.05, y: 0.5 + hash(i, 17) * 0.1 }));
const TREES = [[0.08, 0.79, 0.8], [0.27, 0.8, 0.6], [0.62, 0.81, 0.7], [0.9, 0.79, 0.9]];
const TUFTS = Array.from({ length: 40 }, (_, i) => ({ x: -0.05 + hash(i, 19) * 1.1, y: 0.94 + hash(i, 23) * 0.06,
                                                    h: 0.02 + hash(i, 29) * 0.02, ph: hash(i, 31) * 6.28 }));
const LANTERN_CAP = 40;

export class NightScene {
  constructor(){
    this.t = 0; this.p = 0; this.look = 0;
    this.lanterns = [];
    this.stars = [];
    this.lite = false; this.frame = 1 / 60; this.slowFor = 0;
  }

  /* s: { t, p, look } */
  step(dt, s){
    this.t = s.t; this.p = Math.min(1, s.p);
    this.frame += (dt - this.frame) * 0.05;
    this.slowFor = this.frame > 1 / 42 ? this.slowFor + dt : 0;
    if (this.slowFor > 3) this.lite = true;
    this.look += ((s.look - 0.5) - this.look) * Math.min(1, dt * 1.5);

    for (const l of this.lanterns){
      l.age += dt;
      /* Rise quickly at first, then settle into a slow drift. */
      l.y += (l.rest - l.y) * Math.min(1, dt * 0.45);
      l.x += Math.sin(this.t * 0.2 + l.ph) * 0.004 * dt;
    }
    for (const st of this.stars) st.age += dt;
  }

  /* A filled jar becomes a lantern rising from where the jar stood. */
  addLantern(x, y){
    this.lanterns.push({ x, y, rest: 0.06 + Math.random() * 0.38, ph: Math.random() * 6.28, age: 0,
                         s: 0.7 + Math.random() * 0.4 });
    if (this.lanterns.length > LANTERN_CAP) this.lanterns.shift();
  }

  /* A firefly that flew up at the end, now a star. */
  addStar(x, y){ this.stars.push({ x, y, age: 0, ph: Math.random() * 6.28 }); }

  _shift(depth, W){ return -(this.look + Math.sin(this.t * 0.04) * 0.08) * depth * W; }

  drawBack(c, W, H){
    const L = nightfall(this.p);
    const sky = c.createLinearGradient(0, 0, 0, H * 0.78);
    sky.addColorStop(0, rgb(L.sky[0])); sky.addColorStop(0.55, rgb(L.sky[1])); sky.addColorStop(1, rgb(L.sky[2]));
    c.fillStyle = sky; c.fillRect(0, 0, W, H);

    this._stars(c, W, H);
    this._moon(c, W, H);
    this._lanterns(c, W, H);

    const far = this._shift(0.012, W);
    c.fillStyle = rgb(L.land[0]);
    c.beginPath(); c.moveTo(-W * 0.2, H * 0.8);
    for (let i = 0; i < PEAKS.length; i++){
      const p = PEAKS[i], q = PEAKS[i + 1];
      c.lineTo(p.x * W + far, p.y * H);
      if (q) c.lineTo(((p.x + q.x) / 2) * W + far, Math.max(p.y, q.y) * H + H * 0.05);
    }
    c.lineTo(W * 1.2, H * 0.8); c.closePath(); c.fill();
    if (!this.lite) this._mist(c, W, H, L, 0.52, 0.76, 0.35);

    [[0.72, 0.08, 3, 0.03], [0.8, 0.11, 4, 0.042], [0.9, 0.14, 3, 0.055]].forEach(([y, h, n, depth], b) => {
      const dx = this._shift(depth, W), m = W * 0.08, span = (W + m * 2) / n;
      c.fillStyle = rgb(L.land[b + 1]);
      c.beginPath(); c.moveTo(-m + dx, H); c.lineTo(-m + dx, H * y);
      for (let i = 0; i < n; i++){
        const x0 = -m + dx + i * span;
        c.quadraticCurveTo(x0 + span * 0.5, H * (y - h * 0.5), x0 + span, H * y);
      }
      c.lineTo(W + m + dx, H); c.closePath(); c.fill();
      if (b === 0) for (const [fx, fy, fs] of TREES){
        /* Round treetops in silhouette, a shade darker than the hill. */
        const x = W * fx + dx, ty = H * fy, sc = (H / 900) * fs;
        c.fillStyle = rgb(mix(L.land[1], [0, 0, 0], 0.25));
        c.fillRect(x - 4 * sc, ty, 8 * sc, 40 * sc);
        c.beginPath(); c.arc(x, ty - 8 * sc, 32 * sc, 0, 6.2832); c.fill();
        c.beginPath(); c.arc(x - 12 * sc, ty - 22 * sc, 20 * sc, 0, 6.2832); c.fill();
      }
    });
  }

  drawFront(c, W, H){
    if (this.lite) return;
    const L = nightfall(this.p), dx = this._shift(0.055, W);
    c.lineCap = 'round'; c.lineWidth = Math.max(2, H * 0.004);
    c.strokeStyle = rgb(mix(L.land[3], [120, 160, 200], 0.18));
    c.beginPath();
    for (const tf of TUFTS){
      const x = tf.x * W + dx, y = tf.y * H, h = tf.h * H, bend = Math.sin(this.t * 1.6 + tf.ph) * 0.15 * h;
      for (const off of [-0.35, 0, 0.35]){
        c.moveTo(x + off * h * 0.4, y);
        c.quadraticCurveTo(x + off * h * 0.5 + bend * 0.3, y - h * 0.6, x + off * h * 0.7 + bend, y - h * 0.9);
      }
    }
    c.stroke();
  }

  _stars(c, W, H){
    c.fillStyle = '#fff';
    for (const s of STARS){
      const on = Math.max(0, Math.min(1, (this.p - s.at) / 0.12));
      if (on <= 0) continue;
      c.globalAlpha = on * (0.55 + 0.45 * Math.sin(this.t * 1.4 + s.ph));
      c.beginPath(); c.arc(s.x * W, s.y * H, Math.max(1, s.r * H / 900), 0, 6.2832); c.fill();
    }
    /* The stars the fireflies became: brighter, and a little warmer. */
    for (const s of this.stars){
      const grow = Math.min(1, s.age / 0.6);
      c.globalAlpha = grow * (0.7 + 0.3 * Math.sin(this.t * 2 + s.ph));
      c.fillStyle = '#fff6c8';
      c.beginPath(); c.arc(s.x * W, s.y * H, Math.max(1.5, 2.6 * H / 900), 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }

  _moon(c, W, H){
    /* Rises from low on the right to high over the round. */
    const x = W * 0.8 + this._shift(0.008, W), y = H * (0.5 - this.p * 0.34), r = H * 0.055;
    const glow = c.createRadialGradient(x, y, r * 0.8, x, y, r * 4);
    glow.addColorStop(0, 'rgba(255,248,220,.35)'); glow.addColorStop(1, 'rgba(255,248,220,0)');
    c.fillStyle = glow; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    c.fillStyle = '#fbf3d6';
    c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(200,190,160,.35)';
    for (const [cx, cy, cr] of [[-0.3, -0.2, 0.2], [0.25, 0.1, 0.15], [-0.05, 0.4, 0.12]]){
      c.beginPath(); c.arc(x + cx * r, y + cy * r, cr * r, 0, 6.2832); c.fill();
    }
  }

  _lanterns(c, W, H){
    for (const l of this.lanterns){
      /* Smaller the higher it settles: further away. */
      const depth = 1 - Math.min(1, Math.max(0, (0.5 - l.y) / 0.5)) * 0.45;
      const s = H * 0.032 * l.s * depth, x = l.x * W, y = l.y * H;
      const flicker = 0.85 + 0.15 * Math.sin(this.t * 7 + l.ph);
      const halo = c.createRadialGradient(x, y, s * 0.3, x, y, s * 3);
      halo.addColorStop(0, `rgba(255,190,90,${0.45 * flicker})`); halo.addColorStop(1, 'rgba(255,190,90,0)');
      c.fillStyle = halo; c.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
      c.fillStyle = `rgba(255,${(170 + 40 * flicker) | 0},110,1)`;
      c.beginPath();
      c.moveTo(x - s * 0.55, y - s * 0.7); c.lineTo(x + s * 0.55, y - s * 0.7);
      c.quadraticCurveTo(x + s * 0.8, y, x + s * 0.45, y + s * 0.75);
      c.lineTo(x - s * 0.45, y + s * 0.75);
      c.quadraticCurveTo(x - s * 0.8, y, x - s * 0.55, y - s * 0.7);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,250,220,.7)';
      c.beginPath(); c.ellipse(x, y + s * 0.15, s * 0.22, s * 0.35, 0, 0, 6.2832); c.fill();
    }
  }

  _mist(c, W, H, L, from, to, strength){
    const g = c.createLinearGradient(0, H * from, 0, H * to);
    g.addColorStop(0, rgb(L.sky[2], 0)); g.addColorStop(0.75, rgb(L.sky[2], strength)); g.addColorStop(1, rgb(L.sky[2], 0));
    c.fillStyle = g; c.fillRect(0, H * from, W, H * (to - from));
  }
}
