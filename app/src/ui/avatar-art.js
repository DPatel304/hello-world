/* Orlis avatars: each child's own character, drawn on a canvas in Orlis
   Play's look (Last Known Position's: round, chunky, lit from the left,
   with a soft dark outline) and in their own colours.

   A look is a small object - what the avatar maker saves on a profile:
     { skin, hair, hairColor, eyes, mouth, color, outfit, extra }
   Every part has a few choices (PARTS); a missing or unknown one falls
   back to the first, so an old or odd look still draws.

     head(c, x, y, r, look, t)          the head, centred at (x, y), radius r
     body(c, x, base, h, look, t, pose) the whole avatar standing, feet at
                                        (x, base), h tall; pose: 'stand',
                                        'wave', 'cheer', 'reach' (arms up)
     portrait(c, x, y, s, look, t)      a head on a rounded square of their
                                        colour (for tiles and name chips) */

export const PARTS = {
  skin: ['#ffdfc4', '#f3c393', '#dda46d', '#b97c4b', '#8d5524', '#5e3a20'],
  hair: ['short', 'curly', 'ponytail', 'buns', 'long', 'spiky', 'bob', 'none'],
  hairColor: ['#2a1d18', '#5a3825', '#9a4a26', '#e2b65a', '#f08c3a', '#4f7cff', '#ff6fae', '#9b6bff'],
  eyes: ['dots', 'happy', 'sparkle', 'wink'],
  mouth: ['smile', 'grin', 'oh', 'tongue'],
  color: ['#3da9ff', '#ff8a3d', '#22c55e', '#a855f7', '#ff5d8f', '#facc15', '#14b8a6', '#ef4444'],
  outfit: ['plain', 'stripes', 'stars', 'dots', 'hoodie'],
  extra: ['none', 'cap', 'bow', 'glasses', 'headphones', 'crown', 'flower']
};
const INK = '#1f1a3a';
const pick = (look, k) => (look && PARTS[k].includes(look[k]) ? look[k] : PARTS[k][0]);

/* #rrggbb mixed toward another */
function mix(a, b, k){
  const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); };

/* A random look ("Surprise me"). */
export function surprise(rand = Math.random){
  const o = {};
  for (const k of Object.keys(PARTS)) o[k] = PARTS[k][Math.floor(rand() * PARTS[k].length)];
  return o;
}

/* ---------- the head ---------- */
export function head(c, x, y, r, look, t = 0){
  const skin = pick(look, 'skin'), hc = pick(look, 'hairColor'), style = pick(look, 'hair');
  const lw = Math.max(1.5, r * 0.07);
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
  const hairDark = mix(hc, '#000000', 0.25), hairLite = mix(hc, '#ffffff', 0.25);

  /* hair behind the head */
  c.fillStyle = hc; c.strokeStyle = INK; c.lineWidth = lw;
  if (style === 'long'){ c.beginPath(); c.moveTo(-r * 1.02, -r * 0.2); c.quadraticCurveTo(-r * 1.15, r * 0.9, -r * 0.7, r * 1.15); c.lineTo(r * 0.7, r * 1.15); c.quadraticCurveTo(r * 1.15, r * 0.9, r * 1.02, -r * 0.2); c.closePath(); c.fill(); c.stroke(); }
  if (style === 'ponytail'){ const sw = Math.sin(t * 3) * r * 0.08; c.beginPath(); c.moveTo(r * 0.75, -r * 0.55); c.quadraticCurveTo(r * 1.55 + sw, -r * 0.2, r * 1.2 + sw, r * 0.75); c.quadraticCurveTo(r * 1.05, r * 0.2, r * 0.6, -r * 0.2); c.closePath(); c.fill(); c.stroke(); }
  if (style === 'bob'){ c.beginPath(); c.moveTo(-r * 1.05, -r * 0.1); c.quadraticCurveTo(-r * 1.12, r * 0.62, -r * 0.82, r * 0.7); c.lineTo(r * 0.82, r * 0.7); c.quadraticCurveTo(r * 1.12, r * 0.62, r * 1.05, -r * 0.1); c.closePath(); c.fill(); c.stroke(); }
  if (style === 'buns'){ for (const d of [-1, 1]){ circle(c, d * r * 0.72, -r * 0.82, r * 0.36); c.fill(); c.stroke(); } }

  /* ears and face: skin, lit from the left */
  const sk = c.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
  sk.addColorStop(0, mix(skin, '#ffffff', 0.18)); sk.addColorStop(0.7, skin); sk.addColorStop(1, mix(skin, '#3a1f10', 0.2));
  c.fillStyle = sk;
  for (const d of [-1, 1]){ circle(c, d * r * 0.96, r * 0.08, r * 0.2); c.fill(); c.stroke(); }
  c.beginPath(); c.ellipse(0, 0, r, r * 0.97, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  /* cheeks */
  c.fillStyle = 'rgba(255,110,120,.28)'; for (const d of [-1, 1]){ c.beginPath(); c.ellipse(d * r * 0.52, r * 0.3, r * 0.17, r * 0.11, 0, 0, Math.PI * 2); c.fill(); }

  /* the face */
  const eyes = pick(look, 'eyes'), mouth = pick(look, 'mouth');
  const blink = (t % 4.2) > 4.05;
  c.fillStyle = INK; c.strokeStyle = INK; c.lineWidth = lw * 1.1;
  for (const d of [-1, 1]){
    const ex = d * r * 0.36, ey = -r * 0.02;
    if (blink || eyes === 'happy' || (eyes === 'wink' && d > 0)){ c.beginPath(); c.arc(ex, ey + r * 0.06, r * 0.13, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); continue; }
    const er = eyes === 'sparkle' ? r * 0.15 : r * 0.11;
    c.beginPath(); c.ellipse(ex, ey, er * 0.85, er, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; circle(c, ex - er * 0.3, ey - er * 0.35, er * 0.32); c.fill();
    if (eyes === 'sparkle'){ circle(c, ex + er * 0.3, ey + er * 0.3, er * 0.16); c.fill(); }
    c.fillStyle = INK;
  }
  /* brows */
  c.lineWidth = lw * 0.9; for (const d of [-1, 1]){ c.beginPath(); c.moveTo(d * r * 0.24, -r * 0.27); c.quadraticCurveTo(d * r * 0.36, -r * 0.34, d * r * 0.48, -r * 0.28); c.stroke(); }
  /* the mouth */
  c.lineWidth = lw * 1.1;
  if (mouth === 'smile'){ c.beginPath(); c.arc(0, r * 0.22, r * 0.22, Math.PI * 0.18, Math.PI * 0.82); c.stroke(); }
  else if (mouth === 'grin' || mouth === 'tongue'){
    c.fillStyle = '#7a1f2b'; c.beginPath(); c.moveTo(-r * 0.27, r * 0.3); c.quadraticCurveTo(0, r * 0.68, r * 0.27, r * 0.3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-r * 0.22, r * 0.32); c.lineTo(r * 0.22, r * 0.32); c.lineTo(r * 0.18, r * 0.39); c.lineTo(-r * 0.18, r * 0.39); c.closePath(); c.fill();
    if (mouth === 'tongue'){ c.fillStyle = '#ff7b93'; c.beginPath(); c.ellipse(r * 0.05, r * 0.5, r * 0.11, r * 0.08, 0, 0, Math.PI * 2); c.fill(); }
  }
  else { c.fillStyle = '#7a1f2b'; c.beginPath(); c.ellipse(0, r * 0.42, r * 0.1, r * 0.13, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }

  /* hair on top */
  c.fillStyle = hc; c.strokeStyle = INK; c.lineWidth = lw;
  const cap = () => { c.beginPath(); c.moveTo(-r * 1.0, -r * 0.05); c.bezierCurveTo(-r * 1.1, -r * 1.25, r * 1.1, -r * 1.25, r * 1.0, -r * 0.05); };
  if (style === 'short' || style === 'ponytail' || style === 'buns' || style === 'long' || style === 'bob'){
    cap(); c.quadraticCurveTo(r * 0.55, -r * 0.62, r * 0.1, -r * 0.5); c.quadraticCurveTo(-r * 0.45, -r * 0.42, -r * 1.0, -r * 0.05); c.closePath(); c.fill(); c.stroke();
  } else if (style === 'curly'){
    for (let k = 0; k < 9; k++){ const a = Math.PI * (1.02 + k * 0.12); circle(c, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.82 - r * 0.08, r * 0.3); c.fill(); c.stroke(); }
    c.beginPath(); c.ellipse(0, -r * 0.62, r * 0.78, r * 0.32, 0, 0, Math.PI * 2); c.fill();
  } else if (style === 'spiky'){
    c.beginPath(); c.moveTo(-r * 1.0, -r * 0.1);
    for (let k = 0; k <= 8; k++){ const a = Math.PI * (1.12 + k * 0.76 / 8); const tip = k % 2 ? 1.32 : 0.95; c.lineTo(Math.cos(a) * r * tip, Math.sin(a) * r * tip - r * 0.05); }
    c.lineTo(r * 1.0, -r * 0.1); c.quadraticCurveTo(0, -r * 0.5, -r * 1.0, -r * 0.1); c.closePath(); c.fill(); c.stroke();
  }
  /* a shine on the hair */
  if (style !== 'none'){ c.strokeStyle = hairLite; c.lineWidth = lw * 1.2; c.beginPath(); c.arc(-r * 0.15, -r * 0.2, r * 0.75, Math.PI * 1.25, Math.PI * 1.45); c.stroke(); }
  void hairDark;

  /* the extra */
  const extra = pick(look, 'extra'), fav = pick(look, 'color');
  c.strokeStyle = INK; c.lineWidth = lw;
  if (extra === 'cap'){
    c.fillStyle = fav; c.beginPath(); c.moveTo(-r * 0.98, -r * 0.3); c.bezierCurveTo(-r * 1.0, -r * 1.3, r * 1.0, -r * 1.3, r * 0.98, -r * 0.3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = mix(fav, '#000000', 0.2); c.beginPath(); c.ellipse(r * 0.55, -r * 0.3, r * 0.75, r * 0.16, -0.08, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#fff'; circle(c, 0, -r * 1.02, r * 0.1); c.fill();
  } else if (extra === 'bow'){
    c.fillStyle = fav; for (const d of [-1, 1]){ c.beginPath(); c.moveTo(r * 0.55, -r * 0.82); c.lineTo(r * 0.55 + d * r * 0.4, -r * 1.05); c.lineTo(r * 0.55 + d * r * 0.4, -r * 0.6); c.closePath(); c.fill(); c.stroke(); }
    circle(c, r * 0.55, -r * 0.82, r * 0.12); c.fill(); c.stroke();
  } else if (extra === 'glasses'){
    c.strokeStyle = INK; c.lineWidth = lw * 1.2; c.fillStyle = 'rgba(200,235,255,.35)';
    for (const d of [-1, 1]){ circle(c, d * r * 0.36, -r * 0.02, r * 0.22); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(-r * 0.14, -r * 0.04); c.lineTo(r * 0.14, -r * 0.04); c.stroke();
  } else if (extra === 'headphones'){
    c.strokeStyle = INK; c.lineWidth = r * 0.16; c.beginPath(); c.arc(0, -r * 0.05, r * 1.08, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    c.strokeStyle = fav; c.lineWidth = r * 0.1; c.stroke();
    c.lineWidth = lw; c.strokeStyle = INK; c.fillStyle = fav;
    for (const d of [-1, 1]){ c.beginPath(); c.ellipse(d * r * 1.02, r * 0.05, r * 0.22, r * 0.32, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
  } else if (extra === 'crown'){
    c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(-r * 0.55, -r * 0.82); c.lineTo(-r * 0.6, -r * 1.35); c.lineTo(-r * 0.3, -r * 1.08); c.lineTo(0, -r * 1.45); c.lineTo(r * 0.3, -r * 1.08); c.lineTo(r * 0.6, -r * 1.35); c.lineTo(r * 0.55, -r * 0.82); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = fav; circle(c, 0, -r * 0.98, r * 0.09); c.fill();
  } else if (extra === 'flower'){
    c.fillStyle = fav; for (let k = 0; k < 5; k++){ const a = k / 5 * Math.PI * 2 + t * 0.5; circle(c, r * 0.62 + Math.cos(a) * r * 0.18, -r * 0.72 + Math.sin(a) * r * 0.18, r * 0.14); c.fill(); c.stroke(); }
    c.fillStyle = '#fde047'; circle(c, r * 0.62, -r * 0.72, r * 0.1); c.fill();
  }
  c.restore();
}

/* ---------- the whole avatar, standing ---------- */
export function body(c, x, base, h, look, t = 0, pose = 'stand'){
  const u = h / 300, fav = pick(look, 'color'), skin = pick(look, 'skin'), outfit = pick(look, 'outfit');
  const lite = mix(fav, '#ffffff', 0.3), dark = mix(fav, '#000000', 0.3);
  const lw = Math.max(1.5, 5 * u);
  c.save(); c.translate(x, base); c.lineJoin = 'round'; c.lineCap = 'round';
  /* shadow */
  c.fillStyle = 'rgba(20,15,45,.22)'; c.beginPath(); c.ellipse(0, 0, 60 * u, 12 * u, 0, 0, Math.PI * 2); c.fill();
  const limb = (pts, w, col) => {
    for (const [ww, sc] of [[w + lw * 2, INK], [w, col]]){ c.strokeStyle = sc; c.lineWidth = ww; c.beginPath(); pts.forEach(([a, b], k) => (k ? c.lineTo(a * u, b * u) : c.moveTo(a * u, b * u))); c.stroke(); }
  };
  const bob = Math.sin(t * 3) * 2;
  /* legs and shoes */
  for (const d of [-1, 1]){ limb([[d * 18, -105], [d * 20, -20]], 26 * u, mix('#3b4a6b', fav, 0.15)); c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = lw; c.beginPath(); c.ellipse(d * 24 * u, -12 * u, 22 * u, 13 * u, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = fav; c.beginPath(); c.ellipse(d * 24 * u, -8 * u, 20 * u, 6 * u, 0, 0, Math.PI); c.fill(); }
  /* arms */
  const arms = {
    stand: (d) => [[d * 44, -200], [d * 56, -150], [d * 54, -112]],
    wave: (d) => d < 0 ? [[-44, -200], [-82, -228], [-96 + Math.sin(t * 10) * 10, -278]] : [[44, -200], [56, -150], [54, -112]],
    cheer: (d) => [[d * 44, -200], [d * 78, -238], [d * 92, -290]],
    reach: (d) => [[d * 44, -200], [d * 60, -250], [d * 66, -305]]
  }[pose] || ((d) => [[d * 44, -200], [d * 56, -150], [d * 54, -112]]);
  for (const d of [-1, 1]){ const a = arms(d); limb(a, 24 * u, outfit === 'hoodie' ? fav : skin); c.fillStyle = skin; c.strokeStyle = INK; c.lineWidth = lw; circle(c, a[2][0] * u, a[2][1] * u, 15 * u); c.fill(); c.stroke(); if (outfit !== 'hoodie'){ limb(a.slice(0, 2), 26 * u, fav); } }
  /* the body: a rounded top in their colour, lit from the left */
  const g = c.createLinearGradient(-60 * u, 0, 60 * u, 0); g.addColorStop(0, lite); g.addColorStop(0.5, fav); g.addColorStop(1, dark);
  c.fillStyle = g; c.strokeStyle = INK; c.lineWidth = lw;
  c.beginPath(); c.moveTo(-46 * u, -208 * u + bob); c.quadraticCurveTo(0, -220 * u + bob, 46 * u, -208 * u + bob); c.quadraticCurveTo(58 * u, -150 * u, 44 * u, -98 * u); c.quadraticCurveTo(0, -88 * u, -44 * u, -98 * u); c.quadraticCurveTo(-58 * u, -150 * u, -46 * u, -208 * u + bob); c.closePath(); c.fill(); c.stroke();
  c.save(); c.clip();
  if (outfit === 'stripes'){ c.fillStyle = 'rgba(255,255,255,.45)'; for (let k = 0; k < 5; k++) c.fillRect(-70 * u, (-196 + k * 22) * u, 140 * u, 9 * u); }
  if (outfit === 'dots'){ c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = -2; i <= 2; i++) for (let j = 0; j < 5; j++) { circle(c, (i * 24 + (j % 2) * 12) * u, (-195 + j * 22) * u, 5 * u); c.fill(); } }
  if (outfit === 'stars'){ c.fillStyle = 'rgba(255,255,255,.9)'; const st = (sx, sy, s) => { c.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? s * 0.45 : s; c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } c.closePath(); c.fill(); }; st(0, -158 * u, 18 * u); }
  if (outfit === 'hoodie'){ c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(-26 * u, -140 * u, 52 * u, 30 * u); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3 * u; for (const d of [-1, 1]){ c.beginPath(); c.moveTo(d * 10 * u, -205 * u); c.lineTo(d * 12 * u, -170 * u); c.stroke(); } }
  c.restore();
  if (outfit === 'hoodie'){ c.fillStyle = dark; c.strokeStyle = INK; c.lineWidth = lw; c.beginPath(); c.ellipse(0, -210 * u + bob, 50 * u, 16 * u, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
  /* the head */
  head(c, 0, -258 * u + bob, 52 * u, look, t);
  c.restore();
}

/* ---------- a portrait: for tiles and name chips ---------- */
export function portrait(c, x, y, s, look, t = 0){
  const fav = pick(look, 'color');
  c.save();
  const r = s * 0.22;
  c.beginPath(); c.roundRect(x - s / 2, y - s / 2, s, s, r);
  const g = c.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2); g.addColorStop(0, mix(fav, '#ffffff', 0.35)); g.addColorStop(1, fav);
  c.fillStyle = g; c.fill(); c.clip();
  /* shoulders, then the head */
  c.fillStyle = mix(fav, '#000000', 0.18); c.beginPath(); c.ellipse(x, y + s * 0.55, s * 0.36, s * 0.22, 0, 0, Math.PI * 2); c.fill();
  head(c, x, y + s * 0.05, s * 0.3, look, t);
  c.restore();
}
