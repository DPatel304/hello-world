/* The living pictures on the menu tiles: a small window into each game, so a
   child picks by what they see rather than by a name they can't read yet.

   Each poster is painted with the game's own scenery, so it looks like what
   you get, with a few of the game's things moving in front: balloons bobbing
   for Pop Party, fireflies blinking round a glowing jar for Firefly Night. A
   game without a poster gets a soft wash of its accent colour. */
import { Scene } from '../games/pop-party-scene.js';
import { NightScene } from '../games/firefly-scene.js';
import { glow } from './backdrop.js';
import { Town, ROAD, SIDEWALK } from '../games/fire-truck-scene.js';
import { TRUCK, drawTruck, drawHelmet, drawKid, drawHouse, drawFlame } from '../games/fire-truck-art.js';
import { drawMoon, drawStar, drawConstellation, drawAstronaut, standIn, SHAPES } from '../games/moon-art.js';
import { DRAW } from '../games/copycat-art.js';
import { drawLake, drawWeeds, drawSurface, drawBoatBack, drawBoatFront, drawUncle, drawCrew, drawRod, drawLine, WATER } from '../games/fishing-art.js';
import { byId as fishById, drawFish } from '../games/fishing-fish.js';
import { DANCERS, MOVES, FLOOR, drawStage, drawMirrorBall, drawDancer } from '../games/dance-art.js';
import { P as slope, drawSlope, edgeTrees, pine, present as gift, ramp as snowRamp, friendBySlope, drawSled, GIFT_COLOURS } from '../games/snow-art.js';

const hash = (i, k = 1) => (((i + 1) * 2654435761 * k) % 4294967296) / 4294967296;

function popParty(){
  const scene = new Scene();
  const HUES = ['#ff6b9d', '#4aa8ff', '#ffd24a', '#53e59a', '#b06bff', '#ff9f45', '#4ad6d6'];
  const balloons = Array.from({ length: 9 }, (_, i) => ({
    x: 0.08 + (i / 8) * 0.84 + (hash(i, 3) - 0.5) * 0.06, y: 0.2 + hash(i, 5) * 0.42,
    r: i === 4 ? 0.17 : i === 7 ? 0.05 : 0.08 + hash(i, 7) * 0.04, col: HUES[i % HUES.length], ph: hash(i, 11) * 6.28
  }));
  return (c, W, H, t) => {
    scene.step(1 / 60, { t, p: 0.35, storm: false, wind: 0, joy: 0.3, look: 0.5, rainbow: false });
    scene.drawBack(c, W, H);
    scene.drawFront(c, W, H);
    for (const b of balloons){
      const x = (b.x + Math.sin(t * 0.7 + b.ph) * 0.015) * W, y = (b.y + Math.sin(t * 1.1 + b.ph) * 0.03) * H;
      const r = b.r * H;
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1, H * 0.005);
      c.beginPath(); c.moveTo(x, y + r);
      c.quadraticCurveTo(x + r * 0.4 * Math.sin(t + b.ph), y + r * 2, x, y + r * 3); c.stroke();
      c.fillStyle = b.col;
      c.beginPath();
      c.moveTo(x, y - r);
      c.bezierCurveTo(x + r * 1.1, y - r, x + r * 1.1, y + r * 0.45, x, y + r);
      c.bezierCurveTo(x - r * 1.1, y + r * 0.45, x - r * 1.1, y - r, x, y - r);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.45)';
      c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.16, r * 0.26, -0.4, 0, 6.2832); c.fill();
    }
  };
}

function fireflyNight(){
  const scene = new NightScene();
  const flies = Array.from({ length: 14 }, (_, i) => ({ x: 0.06 + hash(i, 13) * 0.88, y: 0.18 + hash(i, 17) * 0.55,
                                                      ph: hash(i, 19) * 6.28, f: 0.3 + hash(i, 23) * 0.3 }));
  return (c, W, H, t) => {
    scene.step(1 / 60, { t, p: 0.62, look: 0.5 });
    scene.drawBack(c, W, H);
    scene.drawFront(c, W, H);
    for (const f of flies){
      const x = (f.x + Math.sin(t * f.f + f.ph) * 0.05) * W, y = (f.y + Math.sin(t * f.f * 1.4 + f.ph) * 0.04) * H;
      glow(c, x, y, H * 0.016, 0.45 + 0.55 * Math.max(0, Math.sin(t * 2 + f.ph)));
    }
    jar(c, W * 0.5, H * 0.66, H * 0.2, t);
  };
}

/* A jar half full of fireflies, glowing on the grass. */
function jar(c, x, top, h, t){
  const w = h * 0.36, bot = top + h;
  const g = c.createRadialGradient(x, top + h * 0.6, 0, x, top + h * 0.6, h * 1.1);
  g.addColorStop(0, 'rgba(255,230,140,.6)'); g.addColorStop(1, 'rgba(255,230,140,0)');
  c.fillStyle = g; c.fillRect(x - h * 1.1, top - h * 0.5, h * 2.2, h * 2.2);
  c.fillStyle = 'rgba(255,255,220,.95)';
  for (let n = 0; n < 7; n++){
    const a = t * 1.3 + n * 2.1;
    c.beginPath(); c.arc(x + Math.cos(a) * w * 0.55, bot - h * (0.15 + 0.5 * ((n * 0.37 + Math.sin(a) * 0.1) % 1)), Math.max(1.5, h * 0.03), 0, 6.2832); c.fill();
  }
  c.fillStyle = 'rgba(190,220,255,.14)'; c.strokeStyle = 'rgba(220,240,255,.75)'; c.lineWidth = Math.max(2, h * 0.025);
  c.beginPath();
  c.moveTo(x - w * 0.7, top); c.quadraticCurveTo(x - w * 1.05, top + h * 0.15, x - w, top + h * 0.3);
  c.lineTo(x - w, bot - w * 0.25); c.quadraticCurveTo(x - w, bot, x - w * 0.75, bot);
  c.lineTo(x + w * 0.75, bot); c.quadraticCurveTo(x + w, bot, x + w, bot - w * 0.25);
  c.lineTo(x + w, top + h * 0.3); c.quadraticCurveTo(x + w * 1.05, top + h * 0.15, x + w * 0.7, top);
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#c98f5a';
  c.beginPath(); c.roundRect(x - w * 0.78, top - h * 0.08, w * 1.56, h * 0.09, h * 0.03); c.fill();
}

function fireTruck(){
  const town = new Town();
  const pal = { wall: '#f6d7b0', roof: '#c0504d', trim: '#ffffff', door: '#5b7fb5' };
  return (c, W, H, t) => {
    town.step(1 / 60, { t, p: 0.25, dist: t * 0.02, clear: [[t * 0.02 + 0.6, t * 0.02 + 1.1]] });
    town.drawBack(c, W, H);
    drawHouse(c, W * 0.84, H * SIDEWALK, H * 0.3, H * 0.24, pal);
    drawFlame(c, W * 0.84 + H * 0.078, H * (SIDEWALK - 0.14), H * 0.085, t, 0);
    drawFlame(c, W * 0.84 - H * 0.06, H * (SIDEWALK - 0.255), H * 0.07, t, 2);
    town.drawRoad(c, W, H);
    /* A bigger truck than in the game, so the faces in it read on a tile. */
    const s = W * 0.68 / TRUCK.length;
    drawTruck(c, W * 0.01, H * ROAD, s, {
      t, roll: t * 3, bounce: Math.sin(t * 13) * 2, lights: 1, aim: -0.4,
      face: (i, x, y, r) => drawKid(c, x, y + r * 0.08, r * 0.95, t + i, i ? '#c98f6a' : '#e9b892'),
      helmets: () => TRUCK.windows.forEach((w, i) => drawHelmet(c, w.x, w.y - w.r * 0.42, w.r * 1.45, 0, i ? '#ff8a3d' : '#3da9ff'))
    });
  };
}

function moonBounce(){
  return (c, W, H, t) => {
    drawMoon(c, W, H, t);
    drawConstellation(c, SHAPES[0], W * 0.72, H * 0.3, H * 0.17, SHAPES[0].pts.length, 1, t);
    const lift = Math.abs(Math.sin(t * 1.2)) * 0.18;
    for (const [x, y, k] of [[0.22, 0.3, 0], [0.5, 0.18, 1], [0.86, 0.62, 2]]) drawStar(c, W * x, H * (y + Math.sin(t + k) * 0.02), H * 0.04, t + k);
    drawAstronaut(c, standIn(0.36, 0.48, 0.2 + lift, 0.42), W, H, lift, '#3da9ff',
      (x, y, r) => drawKid(c, x, y + r * 0.1, r, t, '#e9b892'));
  };
}

function animalCopycat(){
  const scene = new Scene();
  return (c, W, H, t) => {
    scene.step(1 / 60, { t, p: 0.3, storm: false, wind: 0, joy: 0.5, look: 0.5, rainbow: false });
    scene.drawBack(c, W, H);
    ['bird', 'frog', 'elephant', 'bunny'].forEach((n, i) => DRAW[n](c, W * (0.12 + i * 0.09), H * 0.74, H * 0.13, t + i, true));
    DRAW.giraffe(c, W * 0.7, H * 0.95, H * 0.62, t, false);
    DRAW.flamingo(c, W * 0.35, H * 0.95, H * 0.5, t, false);
    scene.drawFront(c, W, H);
  };
}

function snowSled(){
  return (c, W, H, t) => {
    const z = t * 0.12;
    drawSlope(c, W, H, z);
    const things = [...edgeTrees(z), { kind: 'gift', lane: -0.6, rel: 0.35 }, { kind: 'gift', lane: 0.2, rel: 0.6 }, { kind: 'ramp', lane: 0.6, rel: 0.45 }, { kind: 'penguin', lane: 1.25, rel: 0.25 }];
    things.sort((a, b) => b.rel - a.rel).forEach((th, i) => {
      const p = slope(th.lane, th.rel, W, H);
      if (th.kind === 'pine') pine(c, p.x, p.y, H * 0.38 * p.k * th.size);
      else if (th.kind === 'gift') gift(c, p.x, p.y, H * 0.075 * p.k, GIFT_COLOURS[i % 5], t);
      else if (th.kind === 'ramp') snowRamp(c, p.x, p.y, p.k, W, H);
      else friendBySlope(c, 'penguin', p.x, p.y, p.k, H, t, 1);
    });
    drawSled(c, W * 0.5, H * 0.92, W, H * 1.25, {
      t, air: 0, lean: Math.sin(t) * 0.5, riders: [{ coat: '#3da9ff', trim: '#e8413c' }, { coat: '#ff8a3d', trim: '#ffd24a' }],
      face: (i, x, y, r) => drawKid(c, x, y + r * 0.08, r * 0.95, t + i, i ? '#c98f6a' : '#e9b892')
    });
  };
}

function unclesBoat(){
  return (c, W, H, t) => {
    drawLake(c, W, H, t, 0.2);
    for (const [id, x, y, d] of [['trout', 0.2, 0.62, 1], ['koi', 0.75, 0.55, -1], ['catfish', 0.45, 0.82, 1], ['rainbow', 0.82, 0.75, -1]]) drawFish(c, fishById[id], (x + Math.sin(t * 0.4 + x * 9) * 0.03) * W, y * H, fishById[id].len * H * 1.4, t * 5 + x * 9, d);
    drawWeeds(c, W, H, t); drawSurface(c, W, H, t);
    drawBoatBack(c, W, H, t);
    const uh = drawUncle(c, W, H, t, 'idle');
    const kid = (seat, col) => drawCrew(c, W, H, t, seat, col, (x, y, r) => drawKid(c, x, y + r * 0.08, r * 0.95, t + seat, seat ? '#c98f6a' : '#e9b892'));
    const h0 = kid(0, '#3da9ff'), h1 = kid(1, '#ff8a3d');
    drawBoatFront(c, W, H, t);
    for (const [h, ang, x] of [[h0, Math.PI + 0.6, 0.12], [h1, -0.6, 0.88]]){
      const tip = drawRod(c, h, ang, H * 0.22, H);
      drawLine(c, tip, { x: x * W, y: WATER * H }, { x: x * W, y: H * 0.62 }, H, t, 0);
    }
    drawRod(c, uh[1], -0.55, H * 0.2, H);
  };
}

function danceParty(){
  return (c, W, H, t) => {
    const beat = t * 112 / 60, n = Math.floor(beat), b = beat - n;
    drawStage(c, W, H, t, b, n, 0.75);
    drawMirrorBall(c, W, H, t, 0.75);
    DANCERS.forEach((d, i) => drawDancer(c, d, d.x * W, FLOOR * H, d.h * H, t, MOVES[(Math.floor(n / 8) + i * 2) % MOVES.length], b, n, 0.75));
  };
}

function plain(accent){
  return (c, W, H) => {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, accent); g.addColorStop(1, '#1b1636');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  };
}

const POSTERS = { 'pop-party': popParty, 'firefly-night': fireflyNight, 'fire-truck': fireTruck, 'moon-bounce': moonBounce, 'animal-copycat': animalCopycat, 'snow-sled': snowSled, 'uncle-bs-boat': unclesBoat, 'dance-party': danceParty };

export function poster(game){
  return (POSTERS[game.id] || (() => plain(game.accent)))();
}
