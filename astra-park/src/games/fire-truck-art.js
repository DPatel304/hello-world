/* The things in Fire Truck, painted: the truck itself, the helmets, the
   houses, flames, the big tree, the garden, the ducks and the animals that
   end up riding along. Drawing only - where things are and what they are
   doing is the game's business.

   The truck is drawn in its own units, 1000 long from the back bumper to the
   front, with the ground at y = 0 and up negative, then scaled to the screen.
   TRUCK lists the points the game needs to know about. */

export const TRUCK = {
  length: 1000,
  windows: [{ x: 680, y: -420, r: 92 }, { x: 885, y: -420, r: 92 }],
  ladder: { x: 62, y: -372, rest: 380, reach: 1500 },
  cannon: { x: 468, y: -356 },
  stack: { x: 566, y: -530 },
  riders: { from: 130, to: 400, y: -392 },
  wheels: [190, 420, 860], wheelR: 72
};

const RED_HI = '#ff6d5f', RED = '#e8413c', RED_LO = '#b92c28';

/* st: { t, roll (wheel turn, radians), bounce (units), lights 0..1,
         ladder: { ang, len }, aim (cannon angle), riders: [{ kind, hop }],
         face(i, x, y, r) - paints a window's occupant, clipped already } */
export function drawTruck(c, ox, gy, s, st){
  c.save();
  c.translate(ox, gy); c.scale(s, s);

  c.fillStyle = 'rgba(30,30,40,.28)';
  c.beginPath(); c.ellipse(510, 8, 540, 26, 0, 0, 6.2832); c.fill();

  c.save();
  c.translate(0, st.bounce || 0);
  body(c, st);
  c.restore();

  for (const wx of TRUCK.wheels) wheel(c, wx, -TRUCK.wheelR, TRUCK.wheelR, st.roll || 0);
  c.restore();
}

function body(c, st){
  const paint = c.createLinearGradient(0, -600, 0, -118);
  paint.addColorStop(0, RED_HI); paint.addColorStop(0.45, RED); paint.addColorStop(1, RED_LO);

  /* Chassis and the arches the wheels sit in. */
  c.fillStyle = '#2d2a33';
  c.beginPath(); c.roundRect(28, -128, 975, 40, 10); c.fill();

  /* The exhaust stack, behind the cab. */
  const chrome = c.createLinearGradient(552, 0, 580, 0);
  chrome.addColorStop(0, '#9aa3b5'); chrome.addColorStop(0.45, '#f6f8fc'); chrome.addColorStop(1, '#8b93a6');
  c.fillStyle = chrome;
  c.beginPath(); c.roundRect(556, -530, 22, 200, 8); c.fill();

  /* The rear body. */
  c.fillStyle = paint;
  c.beginPath(); c.roundRect(20, -348, 560, 232, 18); c.fill();

  /* Roll-up lockers, the last one open on the hose reel. */
  for (const [x0, x1] of [[42, 200], [214, 372]]){
    const g = c.createLinearGradient(0, -322, 0, -196);
    g.addColorStop(0, '#d8463f'); g.addColorStop(1, '#b8322d');
    c.fillStyle = g;
    c.beginPath(); c.roundRect(x0, -322, x1 - x0, 128, 10); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 3;
    c.beginPath();
    for (let y = -306; y < -200; y += 16){ c.moveTo(x0 + 8, y); c.lineTo(x1 - 8, y); }
    c.stroke();
    c.fillStyle = '#e9edf3';
    c.beginPath(); c.roundRect((x0 + x1) / 2 - 22, -214, 44, 10, 5); c.fill();
  }
  c.fillStyle = '#3a2b2e';
  c.beginPath(); c.roundRect(386, -322, 170, 128, 10); c.fill();
  hoseReel(c, 471, -258);

  /* The ladder and the water cannon ride on the far side of the cab, so when
     they swing up they pass behind it rather than across the faces. */
  cannon(c, st.aim ?? -0.3);
  ladder(c, st.ladder || { ang: 0, len: TRUCK.ladder.rest });

  /* The cab: tall, with a big rounded nose. */
  c.fillStyle = paint;
  c.beginPath();
  c.moveTo(574, -116); c.lineTo(574, -572);
  c.quadraticCurveTo(574, -600, 604, -600);
  c.lineTo(905, -600); c.quadraticCurveTo(1004, -600, 1004, -500);
  c.lineTo(1004, -116); c.closePath(); c.fill();
  /* A soft highlight along the roof line, and the door seam. */
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(600, -590); c.lineTo(905, -590); c.quadraticCurveTo(994, -590, 994, -500); c.stroke();
  c.beginPath(); c.moveTo(26, -340); c.lineTo(574, -340); c.stroke();
  c.strokeStyle = 'rgba(80,10,10,.25)'; c.lineWidth = 4;
  c.beginPath(); c.roundRect(596, -312, 386, 178, 18); c.stroke();

  /* The stripe that runs the whole length: white, edged in gold. */
  c.fillStyle = '#f7f3ea'; c.fillRect(20, -182, 984, 22);
  c.fillStyle = '#f2c14e'; c.fillRect(20, -186, 984, 5); c.fillRect(20, -161, 984, 5);

  /* The star on the door: the park's evening star, in gold. */
  badge(c, 790, -238, 44);

  /* The nose: grille, headlight, mirror and bumper. */
  const grille = c.createLinearGradient(988, 0, 1016, 0);
  grille.addColorStop(0, '#8d95a7'); grille.addColorStop(0.5, '#f4f6fa'); grille.addColorStop(1, '#a3abbc');
  c.fillStyle = grille; c.beginPath(); c.roundRect(992, -330, 24, 170, 8); c.fill();
  c.strokeStyle = 'rgba(60,60,80,.35)'; c.lineWidth = 3;
  c.beginPath(); for (let y = -315; y < -170; y += 18){ c.moveTo(996, y); c.lineTo(1012, y); } c.stroke();
  const lamp = c.createRadialGradient(1008, -372, 2, 1008, -372, 90);
  lamp.addColorStop(0, 'rgba(255,248,210,.55)'); lamp.addColorStop(1, 'rgba(255,248,210,0)');
  c.fillStyle = lamp; c.fillRect(918, -462, 180, 180);
  c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(1006, -372, 22, 0, 6.2832); c.fill();
  c.strokeStyle = '#d7dbe4'; c.lineWidth = 6; c.stroke();
  c.strokeStyle = '#4a4d58'; c.lineWidth = 8;
  c.beginPath(); c.moveTo(1002, -470); c.lineTo(1040, -470); c.stroke();
  c.fillStyle = '#4a4d58'; c.beginPath(); c.roundRect(1032, -518, 18, 86, 6); c.fill();
  const bumper = c.createLinearGradient(0, -134, 0, -92);
  bumper.addColorStop(0, '#f6f8fc'); bumper.addColorStop(1, '#8b93a6');
  c.fillStyle = bumper; c.beginPath(); c.roundRect(950, -134, 80, 40, 10); c.fill();
  c.beginPath(); c.roundRect(10, -130, 40, 36, 8); c.fill();
  c.fillStyle = bumper; c.beginPath(); c.roundRect(34, -122, 520, 10, 5); c.fill();

  /* The two windows, with whoever is riding in them. */
  TRUCK.windows.forEach((w, i) => {
    c.save();
    c.beginPath(); c.arc(w.x, w.y, w.r, 0, 6.2832); c.clip();
    const sky = c.createLinearGradient(0, w.y - w.r, 0, w.y + w.r);
    sky.addColorStop(0, '#cdeaff'); sky.addColorStop(1, '#9fc9ea');
    c.fillStyle = sky; c.fillRect(w.x - w.r, w.y - w.r, w.r * 2, w.r * 2);
    if (st.face) st.face(i, w.x, w.y, w.r);
    /* Glass: a soft sheen across the top corner. */
    const sheen = c.createLinearGradient(w.x - w.r, w.y - w.r, w.x, w.y);
    sheen.addColorStop(0, 'rgba(255,255,255,.28)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sheen; c.fillRect(w.x - w.r, w.y - w.r, w.r * 2, w.r * 2);
    c.restore();
    c.strokeStyle = '#f4f5f8'; c.lineWidth = 16;
    c.beginPath(); c.arc(w.x, w.y, w.r + 4, 0, 6.2832); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 4;
    c.beginPath(); c.arc(w.x, w.y, w.r + 13, 0, 6.2832); c.stroke();
  });
  if (st.helmets) st.helmets();

  /* The light bar, which flashes red and blue when the siren is on. */
  lights(c, st.t || 0, st.lights || 0);

  /* Anyone who has come along for the ride. */
  riders(c, st.riders || [], st.t || 0);
}

function hoseReel(c, x, y){
  c.fillStyle = '#5b4a3a';
  c.beginPath(); c.arc(x, y, 54, 0, 6.2832); c.fill();
  c.strokeStyle = '#f2c14e'; c.lineWidth = 9;
  for (let r = 18; r <= 48; r += 10){ c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke(); }
  c.fillStyle = '#c9ccd6'; c.beginPath(); c.arc(x, y, 12, 0, 6.2832); c.fill();
}

function badge(c, x, y, r){
  c.fillStyle = '#f2c14e';
  c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  c.strokeStyle = '#fff1c2'; c.lineWidth = 5; c.stroke();
  c.fillStyle = '#fff8e0';
  c.beginPath();
  for (let i = 0; i < 8; i++){
    const a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? r * 0.22 : r * 0.72;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath(); c.fill();
}

function lights(c, t, on){
  c.fillStyle = '#3c3a44';
  c.beginPath(); c.roundRect(640, -626, 290, 28, 10); c.fill();
  const red = on && Math.sin(t * 9) > 0, blue = on && !red;
  for (const [x, col, lit] of [[690, '255,80,80', red], [880, '80,160,255', blue]]){
    if (lit){
      const g = c.createRadialGradient(x, -640, 0, x, -640, 230);
      g.addColorStop(0, `rgba(${col},${0.55 * on})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.fillRect(x - 230, -870, 460, 460);
    }
    c.fillStyle = `rgba(${col},${lit ? 1 : 0.65})`;
    c.beginPath(); c.ellipse(x, -636, 46, 26, 0, Math.PI, 0); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath(); c.ellipse(x - 14, -646, 12, 7, 0, 0, 6.2832); c.fill();
  }
  c.fillStyle = '#f4f5f8';
  c.beginPath(); c.ellipse(785, -634, 40, 18, 0, Math.PI, 0); c.fill();
}

function cannon(c, ang){
  const { x, y } = TRUCK.cannon;
  c.fillStyle = '#6b6f7c';
  c.beginPath(); c.roundRect(x - 24, y - 6, 48, 18, 6); c.fill();
  c.save(); c.translate(x, y - 6); c.rotate(ang);
  const brass = c.createLinearGradient(0, -12, 0, 12);
  brass.addColorStop(0, '#ffe08a'); brass.addColorStop(0.5, '#e0a93a'); brass.addColorStop(1, '#a8761f');
  c.fillStyle = brass;
  c.beginPath(); c.roundRect(-8, -12, 76, 24, 10); c.fill();
  c.beginPath(); c.roundRect(60, -16, 22, 32, 6); c.fill();
  c.restore();
  c.fillStyle = '#e0a93a'; c.beginPath(); c.arc(x, y - 6, 16, 0, 6.2832); c.fill();
}

/* Where the end of the ladder is, in truck units. */
export function ladderTip(l){
  const { x, y } = TRUCK.ladder;
  return { x: x + Math.cos(l.ang) * l.len, y: y + Math.sin(l.ang) * l.len };
}

function ladder(c, l){
  const { x, y } = TRUCK.ladder;
  c.fillStyle = '#7b808e';
  c.beginPath(); c.ellipse(x, y + 18, 40, 16, 0, 0, 6.2832); c.fill();
  c.save(); c.translate(x, y); c.rotate(l.ang);
  const rail = c.createLinearGradient(0, -14, 0, 14);
  rail.addColorStop(0, '#f6f8fc'); rail.addColorStop(1, '#aab2c2');
  c.strokeStyle = '#c3c9d5'; c.lineWidth = 7;
  c.beginPath();
  for (let d = 30; d < l.len - 10; d += 38){ c.moveTo(d, -12); c.lineTo(d, 12); }
  c.stroke();
  c.fillStyle = rail;
  c.beginPath(); c.roundRect(0, -18, l.len, 9, 4); c.fill();
  c.beginPath(); c.roundRect(0, 9, l.len, 9, 4); c.fill();
  c.restore();
  c.fillStyle = '#9aa0ae'; c.beginPath(); c.arc(x, y, 18, 0, 6.2832); c.fill();
}

function riders(c, list, t){
  const { from, to, y } = TRUCK.riders;
  list.forEach((r, i) => {
    const n = Math.max(1, list.length - 1), x = list.length === 1 ? (from + to) / 2 : from + (to - from) * (i / n);
    const hop = Math.max(0, Math.sin(t * 5 + i * 1.7)) * 10 * (r.hop || 0.2);
    animal(c, x, y - hop, 1.6, r.kind, t + i, true);
  });
}

function wheel(c, x, y, r, roll){
  c.fillStyle = '#3b2b2b';
  c.beginPath(); c.arc(x, y, r + 14, Math.PI, 0); c.fill();
  c.fillStyle = '#26252b'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  c.fillStyle = '#3a3942';
  for (let k = 0; k < 14; k++){
    const a = roll + k * Math.PI / 7;
    c.save(); c.translate(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6)); c.rotate(a);
    c.fillRect(-5, -8, 10, 16); c.restore();
  }
  const rim = c.createRadialGradient(x - 10, y - 12, 4, x, y, r * 0.6);
  rim.addColorStop(0, '#ffffff'); rim.addColorStop(1, '#a3abbc');
  c.fillStyle = rim; c.beginPath(); c.arc(x, y, r * 0.58, 0, 6.2832); c.fill();
  c.fillStyle = '#7c8394';
  for (let k = 0; k < 5; k++){
    const a = roll + k * 1.2566;
    c.beginPath(); c.arc(x + Math.cos(a) * r * 0.34, y + Math.sin(a) * r * 0.34, 5, 0, 6.2832); c.fill();
  }
  c.fillStyle = RED; c.beginPath(); c.arc(x, y, 12, 0, 6.2832); c.fill();
}

/* A firefighter's helmet, sitting on a head at (x, y) - the crown of the
   head - w across, tilted with it. Coloured by player, like their mitts, so
   each child knows which window is theirs. */
export function drawHelmet(c, x, y, w, roll, col){
  c.save(); c.translate(x, y); c.rotate(roll);
  const g = c.createLinearGradient(0, -w * 0.55, 0, 0);
  g.addColorStop(0, shade(col, 0.35)); g.addColorStop(1, col);
  c.fillStyle = g;
  c.beginPath(); c.ellipse(0, 0, w * 0.42, w * 0.5, 0, Math.PI, 0); c.fill();
  c.strokeStyle = shade(col, -0.25); c.lineWidth = w * 0.035;
  c.beginPath(); c.moveTo(0, -w * 0.48); c.lineTo(0, -w * 0.06); c.stroke();
  /* The brim, longer at the back, as real ones are. */
  c.fillStyle = shade(col, -0.12);
  c.beginPath(); c.ellipse(-w * 0.04, 0, w * 0.6, w * 0.09, 0, 0, 6.2832); c.fill();
  badge(c, 0, -w * 0.24, w * 0.12);
  c.restore();
}

function shade(hex, k){
  const n = parseInt(hex.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255];
  const out = ch.map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
  return `rgb(${out[0]},${out[1]},${out[2]})`;
}

/* Who rides in an empty seat: a dalmatian, of course. */
export function drawPup(c, x, y, r, t){
  const bob = Math.sin(t * 2.4) * r * 0.03;
  y += bob;
  c.fillStyle = '#ffffff';
  c.beginPath(); c.ellipse(x, y + r * 0.95, r * 0.75, r * 0.5, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.ellipse(x, y + r * 0.08, r * 0.55, r * 0.5, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#2b2733';
  for (const side of [-1, 1]){
    c.save(); c.translate(x + side * r * 0.5, y - r * 0.1); c.rotate(side * (0.25 + Math.sin(t * 3) * 0.06));
    c.beginPath(); c.ellipse(0, r * 0.22, r * 0.16, r * 0.34, 0, 0, 6.2832); c.fill(); c.restore();
  }
  for (const [sx, sy, sr] of [[-0.25, -0.15, 0.08], [0.3, 0.2, 0.06], [0.05, -0.32, 0.05], [-0.4, 0.9, 0.1], [0.35, 1.05, 0.08]]){
    c.beginPath(); c.arc(x + sx * r, y + sy * r, sr * r, 0, 6.2832); c.fill();
  }
  for (const side of [-1, 1]){ c.beginPath(); c.arc(x + side * r * 0.2, y, r * 0.07, 0, 6.2832); c.fill(); }
  c.beginPath(); c.ellipse(x, y + r * 0.2, r * 0.1, r * 0.07, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#ff8a9a';
  c.beginPath(); c.ellipse(x + r * 0.04, y + r * 0.42, r * 0.07, r * 0.1 + Math.max(0, Math.sin(t * 4)) * r * 0.03, 0, 0, 6.2832); c.fill();
}

/* A cartoon child, for when there's no camera to show a real one. */
export function drawKid(c, x, y, r, t, skin = '#e9b892'){
  c.fillStyle = skin;
  c.beginPath(); c.ellipse(x, y + r * 0.95, r * 0.7, r * 0.45, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.ellipse(x, y + r * 0.1, r * 0.5, r * 0.56, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#2b2440';
  const blink = (t % 3.3) < 0.12 ? 0.15 : 1;
  for (const side of [-1, 1]){ c.beginPath(); c.ellipse(x + side * r * 0.18, y + r * 0.02, r * 0.06, r * 0.08 * blink, 0, 0, 6.2832); c.fill(); }
  c.strokeStyle = '#2b2440'; c.lineWidth = r * 0.05;
  c.beginPath(); c.arc(x, y + r * 0.22, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  c.fillStyle = 'rgba(255,120,120,.35)';
  for (const side of [-1, 1]){ c.beginPath(); c.arc(x + side * r * 0.33, y + r * 0.24, r * 0.09, 0, 6.2832); c.fill(); }
}

/* ---------- the town's things ---------- */

/* A house, base centred at x on the ground at `base`, w wide and h tall to
   the eaves. pal: { wall, roof, trim, door }. lit: windows glowing warm. */
export function drawHouse(c, x, base, w, h, pal, lit = 0){
  const l = x - w / 2, top = base - h, rh = w * 0.42;
  /* Chimney first, so the roof overlaps its foot. */
  c.fillStyle = '#9b5d4a'; c.fillRect(l + w * 0.68, top - rh * 0.8, w * 0.1, rh * 0.6);
  c.fillStyle = '#7f4a3b'; c.fillRect(l + w * 0.66, top - rh * 0.84, w * 0.14, rh * 0.08);
  const wall = c.createLinearGradient(l, 0, l + w, 0);
  wall.addColorStop(0, pal.wall); wall.addColorStop(1, shade(pal.wall, -0.08));
  c.fillStyle = wall; c.fillRect(l, top, w, h);
  c.strokeStyle = 'rgba(0,0,0,.05)'; c.lineWidth = Math.max(1, h * 0.008);
  c.beginPath(); for (let y = top + h * 0.08; y < base; y += h * 0.08){ c.moveTo(l, y); c.lineTo(l + w, y); } c.stroke();
  /* Roof, with an overhang, a shadow beneath it and rows of shingles. */
  c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(l, top, w, h * 0.06);
  c.fillStyle = pal.roof;
  c.beginPath(); c.moveTo(l - w * 0.08, top + 2); c.lineTo(x, top - rh); c.lineTo(l + w * 1.08, top + 2); c.closePath(); c.fill();
  c.save(); c.clip();
  c.strokeStyle = shade(pal.roof, -0.18); c.lineWidth = Math.max(1, rh * 0.03);
  c.beginPath(); for (let k = 1; k < 5; k++){ const y = top - rh + rh * k / 5; c.moveTo(l - w * 0.1, y); c.lineTo(l + w * 1.1, y); } c.stroke();
  c.restore();
  c.strokeStyle = shade(pal.roof, -0.3); c.lineWidth = Math.max(2, w * 0.02);
  c.beginPath(); c.moveTo(l - w * 0.08, top + 2); c.lineTo(x, top - rh); c.lineTo(l + w * 1.08, top + 2); c.stroke();
  /* Windows, two up and one beside the door, with flower boxes. */
  for (const [fx, fy] of [[0.24, 0.3], [0.76, 0.3], [0.24, 0.66]]){
    const ww = w * 0.2, wh = h * 0.22, wx = l + w * fx - ww / 2, wy = top + h * fy - wh / 2;
    c.fillStyle = pal.trim; c.fillRect(wx - ww * 0.08, wy - ww * 0.08, ww * 1.16, wh + ww * 0.16);
    const glass = c.createLinearGradient(0, wy, 0, wy + wh);
    glass.addColorStop(0, lit ? '#ffe9a6' : '#bfe0f5'); glass.addColorStop(1, lit ? '#ffc86a' : '#8fbfe0');
    c.fillStyle = glass; c.fillRect(wx, wy, ww, wh);
    c.fillStyle = pal.trim; c.fillRect(wx + ww * 0.46, wy, ww * 0.08, wh); c.fillRect(wx, wy + wh * 0.46, ww, wh * 0.08);
    c.fillStyle = '#a8653f'; c.fillRect(wx - ww * 0.1, wy + wh + ww * 0.06, ww * 1.2, ww * 0.18);
    for (let k = 0; k < 4; k++){
      c.fillStyle = ['#ff7aa8', '#ffd24a', '#ff9f45', '#b06bff'][k];
      c.beginPath(); c.arc(wx + ww * (0.08 + k * 0.28), wy + wh + ww * 0.04, ww * 0.08, 0, 6.2832); c.fill();
    }
  }
  /* The door, arched, with a knob and a step. */
  const dw = w * 0.2, dh = h * 0.42, dx = l + w * 0.68 - dw / 2;
  c.fillStyle = pal.door;
  c.beginPath(); c.moveTo(dx, base); c.lineTo(dx, base - dh + dw / 2); c.arc(dx + dw / 2, base - dh + dw / 2, dw / 2, Math.PI, 0); c.lineTo(dx + dw, base); c.closePath(); c.fill();
  c.fillStyle = '#ffd56b'; c.beginPath(); c.arc(dx + dw * 0.78, base - dh * 0.42, dw * 0.07, 0, 6.2832); c.fill();
  c.fillStyle = '#cfc8ba'; c.fillRect(dx - dw * 0.15, base - h * 0.025, dw * 1.3, h * 0.025);
}

/* A flame: three layers of flickering tongue and a warm glow. s is its
   height; at s = 0 there is nothing left. */
export function drawFlame(c, x, y, s, t, seed = 0){
  if (s <= 1) return;
  const g = c.createRadialGradient(x, y - s * 0.35, 0, x, y - s * 0.35, s * 1.3);
  g.addColorStop(0, 'rgba(255,190,90,.45)'); g.addColorStop(1, 'rgba(255,150,60,0)');
  c.fillStyle = g; c.fillRect(x - s * 1.3, y - s * 1.65, s * 2.6, s * 2.6);
  const wob = Math.sin(t * 7 + seed * 3) * 0.12 * s, lean = Math.sin(t * 3.3 + seed) * 0.06 * s;
  for (const [k, col] of [[1, '#ff6b3d'], [0.7, '#ffa53d'], [0.42, '#ffe58a']]){
    const h = s * k * (0.92 + 0.08 * Math.sin(t * 11 + seed * 5 + k * 4)), w = s * 0.36 * k;
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x - w, y);
    c.bezierCurveTo(x - w * 1.3, y - h * 0.45, x - w * 0.3 + wob * k, y - h * 0.62, x + wob * k + lean, y - h);
    c.bezierCurveTo(x + w * 0.3 + wob * k, y - h * 0.62, x + w * 1.3, y - h * 0.45, x + w, y);
    c.quadraticCurveTo(x, y + w * 0.4, x - w, y);
    c.fill();
  }
  /* A wisp of soft grey smoke rising off the top. */
  for (let k = 0; k < 3; k++){
    const u = (t * 0.5 + k / 3 + seed * 0.13) % 1;
    c.fillStyle = `rgba(120,120,135,${0.22 * (1 - u)})`;
    c.beginPath(); c.arc(x + Math.sin(u * 4 + seed) * s * 0.2, y - s - u * s * 1.4, s * (0.18 + u * 0.3), 0, 6.2832); c.fill();
  }
}

/* The big tree the cats get stuck in. Returns where its branch ends, which is
   where the cat sits. s is the tree's height. */
export function treeBranch(x, base, s){ return { x: x - s * 0.3, y: base - s * 0.8 }; }
export function drawBigTree(c, x, base, s, t){
  const b = treeBranch(x, base, s);
  c.fillStyle = '#7a5434';
  c.beginPath();
  c.moveTo(x - s * 0.07, base); c.quadraticCurveTo(x - s * 0.04, base - s * 0.35, x - s * 0.06, base - s * 0.62);
  c.lineTo(x + s * 0.06, base - s * 0.62); c.quadraticCurveTo(x + s * 0.04, base - s * 0.35, x + s * 0.08, base); c.closePath(); c.fill();
  c.strokeStyle = '#7a5434'; c.lineWidth = s * 0.045; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - s * 0.02, base - s * 0.55); c.quadraticCurveTo(x - s * 0.2, base - s * 0.6, b.x, b.y + s * 0.015); c.stroke();
  const sway = Math.sin(t * 1.2) * s * 0.006;
  const lump = (col, k, dy) => {
    c.fillStyle = col; c.beginPath();
    for (const [lx, ly, lr] of [[0, -0.8, 0.26], [-0.2, -0.72, 0.2], [0.2, -0.72, 0.21], [-0.1, -0.95, 0.2], [0.12, -0.94, 0.19], [0, -0.66, 0.2]]){
      const px = x + lx * s + sway, py = base + (ly + dy) * s, r = lr * s * k;
      c.moveTo(px + r, py); c.arc(px, py, r, 0, 6.2832);
    }
    c.fill();
  };
  lump('#3d8a50', 1, 0.02);
  lump('#4fa863', 0.86, -0.01);
  lump('rgba(150,215,130,.6)', 0.48, -0.06);
  return b;
}

/* A flower in the garden. hp 0 is drooping and grey, 1 upright and open. */
export function drawFlower(c, x, base, s, hp, hue, t){
  const droop = (1 - hp) * 1.25, sway = Math.sin(t * 1.6 + x * 0.01) * 0.05;
  const hx = x + Math.sin(droop + sway) * s * 0.55, hy = base - Math.cos(droop * 0.8) * s;
  c.strokeStyle = hp > 0.5 ? '#3f9a52' : '#7a9a62'; c.lineWidth = Math.max(2, s * 0.05); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x, base - s * 0.6, hx, hy); c.stroke();
  c.fillStyle = '#4fa863';
  c.beginPath(); c.ellipse(x + s * 0.12, base - s * 0.3, s * 0.14, s * 0.06, -0.5, 0, 6.2832); c.fill();
  const r = s * (0.13 + 0.12 * hp), open = 0.45 + 0.55 * hp;
  /* Wilted, the colour is faded but still there, so it's clear what it will be. */
  c.fillStyle = `hsl(${hue} ${35 + 50 * hp}% ${55 + 10 * hp}%)`;
  for (let k = 0; k < 6; k++){
    const a = k * 1.047 + droop * 0.5;
    c.beginPath(); c.ellipse(hx + Math.cos(a) * r * open, hy + Math.sin(a) * r * open, r * 0.62, r * 0.4, a, 0, 6.2832); c.fill();
  }
  c.fillStyle = hp > 0.5 ? '#ffd24a' : '#c9b36a';
  c.beginPath(); c.arc(hx, hy, r * 0.42, 0, 6.2832); c.fill();
}

/* A duck, facing the way it walks (dir 1 right, -1 left, 0 toward us). */
export function drawDuck(c, x, y, s, t, mama, flap = 0){
  const waddle = Math.sin(t * 9) * 0.1;
  c.save(); c.translate(x, y); c.rotate(waddle);
  const body = mama ? '#fbfaf5' : '#ffd84a', wing = mama ? '#e6e3d8' : '#f4c430';
  c.fillStyle = '#ff9f45';
  for (const side of [-1, 1]){ c.beginPath(); c.ellipse(side * s * 0.15, 0, s * 0.12, s * 0.05, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = body;
  c.beginPath(); c.ellipse(0, -s * 0.32, s * 0.36, s * 0.3, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.arc(0, -s * 0.72, s * 0.2, 0, 6.2832); c.fill();
  c.fillStyle = wing;
  for (const side of [-1, 1]){
    c.save(); c.translate(side * s * 0.3, -s * 0.38); c.rotate(side * (0.3 + flap * 0.9));
    c.beginPath(); c.ellipse(0, 0, s * 0.08, s * 0.2, 0, 0, 6.2832); c.fill(); c.restore();
  }
  c.fillStyle = '#ff9f45';
  c.beginPath(); c.ellipse(0, -s * 0.64, s * 0.11, s * 0.06, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#2b2440';
  for (const side of [-1, 1]){ c.beginPath(); c.arc(side * s * 0.08, -s * 0.76, s * 0.035, 0, 6.2832); c.fill(); }
  c.restore();
}

const ANIMALS = {
  cat:    { fur: '#f4a24a', dark: '#d9822e', ears: 'cat' },
  kitten: { fur: '#a9b0bd', dark: '#8a91a0', ears: 'cat' },
  bunny:  { fur: '#f5f1ea', dark: '#e2d9cc', ears: 'bunny' },
  puppy:  { fur: '#c9915e', dark: '#9c6b40', ears: 'pup' }
};
export const ANIMAL_KINDS = Object.keys(ANIMALS);

/* A small animal sitting at (x, y) - y is where it sits - at scale s (about
   40 * s tall). Happy ones close their eyes in a smile and wag. */
export function animal(c, x, y, s, kind, t, happy){
  const A = ANIMALS[kind] || ANIMALS.cat, u = 10 * s;
  const shiver = happy ? 0 : Math.sin(t * 30) * u * 0.06;
  x += shiver;
  c.strokeStyle = A.dark; c.lineWidth = u * 0.5; c.lineCap = 'round';
  const wag = Math.sin(t * (happy ? 8 : 2)) * 0.5;
  if (A.ears !== 'bunny'){ c.beginPath(); c.moveTo(x + u * 1.2, y - u * 0.6); c.quadraticCurveTo(x + u * 2.4, y - u * (1 + wag), x + u * 2 , y - u * (2.4 + wag)); c.stroke(); }
  c.fillStyle = A.fur;
  c.beginPath(); c.ellipse(x, y - u * 1.1, u * 1.4, u * 1.15, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.arc(x, y - u * 2.7, u * 1.15, 0, 6.2832); c.fill();
  if (A.ears === 'cat'){
    for (const side of [-1, 1]){
      c.beginPath(); c.moveTo(x + side * u * 1.05, y - u * 3); c.lineTo(x + side * u * 0.9, y - u * 4.25); c.lineTo(x + side * u * 0.2, y - u * 3.7); c.closePath(); c.fill();
    }
  } else if (A.ears === 'bunny'){
    for (const side of [-1, 1]){ c.beginPath(); c.ellipse(x + side * u * 0.5, y - u * 4.4, u * 0.35, u * 1.3, side * 0.15, 0, 6.2832); c.fill(); }
    c.beginPath(); c.arc(x + u * 1.3, y - u * 0.6, u * 0.5, 0, 6.2832); c.fill();
  } else {
    c.fillStyle = A.dark;
    for (const side of [-1, 1]){ c.beginPath(); c.ellipse(x + side * u * 1.05, y - u * 2.5, u * 0.38, u * 0.9, side * 0.3, 0, 6.2832); c.fill(); }
  }
  c.fillStyle = A.dark;
  if (kind === 'cat') for (const dx of [-0.4, 0.4]){ c.beginPath(); c.ellipse(x + dx * u, y - u * 3.5, u * 0.14, u * 0.3, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = '#2b2440'; c.strokeStyle = '#2b2440'; c.lineWidth = u * 0.16;
  for (const side of [-1, 1]){
    if (happy){ c.beginPath(); c.arc(x + side * u * 0.42, y - u * 2.7, u * 0.22, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    else { c.beginPath(); c.arc(x + side * u * 0.42, y - u * 2.75, u * 0.2, 0, 6.2832); c.fill(); }
  }
  c.fillStyle = '#ff8a9a'; c.beginPath(); c.arc(x, y - u * 2.35, u * 0.15, 0, 6.2832); c.fill();
}
