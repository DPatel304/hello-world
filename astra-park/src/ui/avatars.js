import { pose, L, PLAYER_COLORS } from '../tracking/pose.js';

/* The players, in the picture. Two layers, drawn by the game at different
   depths:

   - bodies: a soft silhouette of each player in their colour, built from the
     pose landmarks, so a child can see themselves standing in the scene. It
     uses the same coordinates as the hands, so the silhouette's arms end
     exactly where the mitts are.
   - mitts: a glowing hand for each hand, which throws sparkles when it moves
     fast and burns brighter on a streak - the thing a child actually aims
     with.

   Nothing here decides anything about the game; it only shows where people
   are. */

const SWIFT = 0.9;   /* screen-widths per second: fast enough for a trail */

export class Avatars {
  constructor(){
    this.sparks = [];
    this.glow = [0, 0];      /* 0..1 per player, from their streak */
    this.flash = [0, 0];     /* a combo burst, decaying */
    this.t = 0;
    this.layer = null;       /* an offscreen canvas for the bodies, if there is one */
  }

  /* level: each player's streak level, 0 none, 1 for x2, 2 for x3. */
  step(dt, players, levels = [0, 0]){
    this.t += dt;
    for (let i = 0; i < 2; i++){
      this.glow[i] += ((levels[i] || 0) / 2 - this.glow[i]) * Math.min(1, dt * 4);
      this.flash[i] = Math.max(0, this.flash[i] - dt * 1.6);
    }
    for (const [i, hand] of this._hands(players)){
      if (hand.speed > SWIFT && Math.random() < dt * 40){
        this.sparks.push({ x: hand.x + (Math.random() - 0.5) * 0.01, y: hand.y + (Math.random() - 0.5) * 0.01,
                           vx: -(hand.vx || 0) * 0.08, vy: -(hand.vy || 0) * 0.08 + 0.05,
                           who: i, age: 0, life: 0.45, s: 0.6 + Math.random() * 0.6,
                           hue: this.glow[i] > 0.9 ? (Math.random() * 360) | 0 : null });
      }
    }
    for (const s of this.sparks){ s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.sparks = this.sparks.filter(s => s.age < s.life);
    if (this.sparks.length > 220) this.sparks.splice(0, this.sparks.length - 220);
  }

  /* A streak: sparkles burst out of both of that player's hands. */
  burst(i, players){
    this.flash[i] = 1;
    for (const [who, hand] of this._hands(players)){
      if (who !== i) continue;
      for (let k = 0; k < 18; k++){
        const a = (k / 18) * 6.2832, sp = 0.25 + Math.random() * 0.25;
        this.sparks.push({ x: hand.x, y: hand.y, vx: Math.cos(a) * sp * 0.56, vy: Math.sin(a) * sp,
                           who, age: 0, life: 0.7, s: 1 + Math.random() * 0.6,
                           hue: (k * 20) % 360 });
      }
    }
  }

  _hands(players){
    const out = [];
    for (let i = 0; i < players; i++){
      const p = pose.players[i];
      if (!p || !p.present) continue;
      /* The mouse drives both hands at once; show it as one. */
      const hands = pose.mouse.active ? [p.hands.right] : [p.hands.left, p.hands.right];
      for (const h of hands) if (h && h.x >= -0.2 && h.x <= 1.2) out.push([i, h]);
    }
    return out;
  }

  /* lift: how far each player has floated up, in screen heights; alpha: how
     strongly the silhouettes show. */
  drawBodies(c, W, H, players, lift = [0, 0], alpha = 0.32){
    const people = [];
    for (let i = 0; i < players; i++){
      const p = pose.players[i];
      if (p && p.present && p.lm) people.push([i, p.lm]);
    }
    if (!people.length) return;

    /* Drawn solid onto a half-size layer and laid down translucent in one
       go, so where an arm crosses the body it doesn't show a darker seam -
       and the half size softens the edges for free. */
    const layer = this._layer(W, H);
    const lc = layer ? layer.getContext('2d') : c;
    const k = layer ? 0.5 : 1;
    if (layer) lc.clearRect(0, 0, layer.width, layer.height);
    for (const [i, lm] of people){
      lc.save(); lc.translate(0, -(lift[i] || 0) * H * k);
      silhouette(lc, lm, W * k, H * k, PLAYER_COLORS[i], layer ? 1 : alpha);
      lc.restore();
    }
    if (layer){
      c.globalAlpha = alpha;
      c.drawImage(layer, 0, 0, W, H);
      c.globalAlpha = 1;
    }
  }

  _layer(W, H){
    if (this.layer === false) return null;
    try {
      if (!this.layer){
        const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1)
                 : (typeof document !== 'undefined' && document.createElement) ? document.createElement('canvas') : null;
        if (!cv || !cv.getContext || !cv.getContext('2d')) { this.layer = false; return null; }
        this.layer = cv;
      }
      const w = Math.max(1, Math.round(W / 2)), h = Math.max(1, Math.round(H / 2));
      if (this.layer.width !== w || this.layer.height !== h){ this.layer.width = w; this.layer.height = h; }
      return this.layer;
    } catch (e){ this.layer = false; return null; }
  }

  drawMitts(c, W, H, players){
    for (const s of this.sparks){
      const k = s.age / s.life, r = H * 0.009 * s.s * (1 - k * 0.5);
      c.globalAlpha = 1 - k;
      c.fillStyle = s.hue == null ? PLAYER_COLORS[s.who] : `hsl(${s.hue} 95% 65%)`;
      star(c, s.x * W, s.y * H, r);
    }
    c.globalAlpha = 1;

    for (const [i, h] of this._hands(players)){
      const x = h.x * W, y = h.y * H, col = PLAYER_COLORS[i];
      const g = this.glow[i], f = this.flash[i];
      const r = H * 0.03 * (1 + g * 0.25 + f * 0.3);
      /* The halo grows with the streak and flares on each new level. */
      const halo = c.createRadialGradient(x, y, r * 0.4, x, y, r * (2.2 + g * 1.2 + f));
      halo.addColorStop(0, hexA(col, 0.55 + g * 0.3));
      halo.addColorStop(1, hexA(col, 0));
      c.fillStyle = halo;
      c.beginPath(); c.arc(x, y, r * (2.2 + g * 1.2 + f), 0, 6.2832); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.lineWidth = Math.max(3, r * 0.28); c.strokeStyle = col;
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
      /* A slow twinkle inside, so it reads as magic rather than a dot. */
      c.fillStyle = hexA(col, 0.9);
      star(c, x, y, r * (0.55 + Math.sin(this.t * 6 + i) * 0.12));
    }
  }
}

export function silhouette(c, lm, W, H, col, alpha){
  const P = (i) => [lm[i].x * W, lm[i].y * H];
  const seen = (i) => (lm[i].v ?? 1) > 0.3;
  const sw = Math.hypot((lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x) * W, (lm[L.L_SHOULDER].y - lm[L.R_SHOULDER].y) * H);
  if (sw < 4) return;
  c.globalAlpha = alpha;
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';

  /* Torso, rounded off by stroking its own outline. */
  const torso = [L.L_SHOULDER, L.R_SHOULDER, L.R_HIP, L.L_HIP].map(P);
  c.lineWidth = sw * 0.35;
  c.beginPath(); torso.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fill(); c.stroke();

  const limb = (a, b, d, w) => {
    if (!seen(a) || !seen(b)) return;
    c.lineWidth = w;
    c.beginPath(); c.moveTo(...P(a)); c.lineTo(...P(b));
    if (seen(d)) c.lineTo(...P(d));
    c.stroke();
  };
  limb(L.L_SHOULDER, L.L_ELBOW, L.L_WRIST, sw * 0.3);
  limb(L.R_SHOULDER, L.R_ELBOW, L.R_WRIST, sw * 0.3);
  limb(L.L_HIP, L.L_KNEE, L.L_ANKLE, sw * 0.38);
  limb(L.R_HIP, L.R_KNEE, L.R_ANKLE, sw * 0.38);

  /* Neck and head. */
  if (seen(L.NOSE)){
    const [nx, ny] = P(L.NOSE);
    const mx = (torso[0][0] + torso[1][0]) / 2, my = (torso[0][1] + torso[1][1]) / 2;
    c.lineWidth = sw * 0.3;
    c.beginPath(); c.moveTo(mx, my); c.lineTo(nx, ny); c.stroke();
    c.beginPath(); c.arc(nx, ny - sw * 0.08, sw * 0.42, 0, 6.2832); c.fill();
  }
  c.globalAlpha = 1;
}

function star(c, x, y, s){
  c.beginPath();
  for (let i = 0; i < 8; i++){
    const a = i * Math.PI / 4, d = i % 2 ? s * 0.38 : s;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath(); c.fill();
}

function hexA(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
