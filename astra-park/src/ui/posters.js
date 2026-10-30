/* The living pictures on the menu tiles: a small window into each game, so a
   child picks by what they see rather than by a name they can't read yet.

   Each poster is painted with the game's own scenery, so it looks like what
   you get, with a few of the game's things moving in front: balloons bobbing
   for Pop Party, fish drifting under Uncle B's boat. A game without a poster gets a soft wash of its accent colour. */
import { Scene } from '../games/pop-party-scene.js';
import { glow } from './backdrop.js';
import { drawKid, KID_SKINS } from './kids.js';
import { drawLake, drawWeeds, drawSurface, drawBoatBack, drawBoatFront, drawUncle, drawCrew, drawRod, drawPalm } from '../games/fishing-art.js';
import { byId as fishById, drawFish } from '../games/fishing-fish.js';
import { P as reactorP, RUN as REACTOR_RUN, drawCorridor, drawGloom, drawBeam, drawCoin, drawBot, drawCrew as drawSpaceCrew, drawBlocker } from '../games/reactor-art.js';
import { PADS as CASTLE_PADS, along as castleAlong, PATHS as CASTLE_PATHS, drawMeadow, drawCastle, drawTower, drawMonster, drawTree as drawCastleTree, TREES, drawTent, inked } from '../games/castle-art.js';
import { DANCERS, MOVES, FLOOR, drawStage, drawMirrorBall, drawDancer } from '../games/dance-art.js';

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

function unclesBoat(){
  return (c, W, H, t) => {
    drawLake(c, W, H, t, 0.2);
    for (const [id, x, y, d] of [['trout', 0.45, 0.66, 1], ['koi', 0.75, 0.55, -1], ['catfish', 0.45, 0.82, 1], ['rainbow', 0.82, 0.75, -1]]) drawFish(c, fishById[id], (x + Math.sin(t * 0.4 + x * 9) * 0.03) * W, y * H, fishById[id].len * H * 1.4, t * 5 + x * 9, d);
    drawWeeds(c, W, H, t); drawSurface(c, W, H, t);
    drawBoatBack(c, W, H, t);
    const uh = drawUncle(c, W, H, t, 'idle');
    const kid = (seat, col) => drawCrew(c, W, H, t, seat, col, (x, y, r) => drawKid(c, x, y + r * 0.08, r * 0.95, t + seat, seat ? '#c98f6a' : '#e9b892'));
    kid(0, '#3da9ff'); kid(1, '#ff8a3d');
    drawBoatFront(c, W, H, t);
    drawRod(c, uh[1], -0.55, H * 0.2, H);
    /* A pair of hands closing round a goldfish. */
    const g = fishById.goldfish, gx = 0.2 * W, gy = (0.6 + Math.sin(t * 1.3) * 0.02) * H, L = g.len * H * 1.4;
    drawFish(c, g, gx, gy, L, t * 12, 1);
    for (const side of [-1, 1]) drawPalm(c, gx + side * L * 0.6, gy, H * 0.05, side < 0 ? 0 : Math.PI, '#3da9ff');
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

function reactorRun(){
  return (c, W, H, t) => {
    const z = t * 0.3;
    drawCorridor(c, W, H, z, t, 0);
    drawBlocker(c, W, H, 0.55, 0.2, 1.05, t, 3);
    drawBeam(c, W, H, 0.32, t);
    for (const k of [-1, 0, 1]){ const p = reactorP(k * 0.45, 0.2, W, H); drawCoin(c, p.x, p.y - H * 0.11 * p.k, H * 0.022 * p.k, t + k); }
    const b = reactorP(-0.3, 0.42, W, H); drawBot(c, b.x, b.y, H * 0.08 * b.k, t, 'fly');
    const hop = Math.max(0, Math.sin(t * 2.2)) * H * 0.08;
    [[0, -0.6], [1, -0.2], [2, 0.2], [3, 0.6]].forEach(([i, lane]) => {
      const p = reactorP(lane, REACTOR_RUN, W, H);
      drawSpaceCrew(c, p.x, p.y, H * 0.25, t + i * 0.4, ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'][i], { air: i === 1 ? hop : 0, duck: 0, lean: 0 }, (x, y, r) => drawKid(c, x, y + r * 0.1, r, t + i, KID_SKINS[i]));
    });
    drawGloom(c, W, H);
  };
}

function castleDefense(){
  return (c, W, H, t) => {
    drawMeadow(c, W, H);
    for (const tr of TREES) drawCastleTree(c, W, H, tr, Math.sin(t * 1.2 + tr.seed) * 0.025);
    inked(c, H * 0.0024, () => drawTent(c, W, H, t));
    const things = [];
    for (const [i, kind, lvl, col] of [[4, 'archer', 5, '#3da9ff'], [7, 'frost', 2, '#ff8a3d'], [9, 'cannon', 3, '#3fcf7f']]){
      const pad = CASTLE_PADS[i]; things.push({ y: pad.y, f: () => drawTower(c, W, H, pad, kind, lvl, -0.6 + Math.sin(t) * 0.3, col, t) });
    }
    for (const [k, kind] of [[0, 'slime'], [1, 'goblin'], [2, 'slime'], [3, 'bat'], [4, 'slime'], [5, 'goblin']]){
      const p = castleAlong((t * 0.03 + k * 0.15) % 1 * CASTLE_PATHS[0].total, 0);
      things.push({ y: p.y, f: () => drawMonster(c, p.x * W, p.y * H, H * 0.065, kind, t + k, p.dir, 0, false, 1) });
    }
    things.push({ y: 0.88, f: () => drawCastle(c, W, H, t, 15, 15, 3, 0, 0, 6) });
    inked(c, H * 0.0024, () => things.sort((a, b) => a.y - b.y).forEach(th => th.f()));
  };
}

function plain(accent){
  return (c, W, H) => {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, accent); g.addColorStop(1, '#1b1636');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  };
}

const POSTERS = { 'pop-party': popParty, 'uncle-bs-boat': unclesBoat, 'dance-party': danceParty, 'reactor-run': reactorRun, 'castle-defense': castleDefense };

export function poster(game){
  return (POSTERS[game.id] || (() => plain(game.accent)))();
}
