import { pose } from './tracking/pose.js';
import { cursor } from './ui/cursor.js';
import { menu, toggleFullscreen } from './ui/menu.js';
import { calibration, splash, results, pauseOverlay, lostOverlay,
         clearUI, drawSkeletons, screen, h } from './ui/screens.js';
import { audio, music, sfx } from './audio/sound.js';
import { scores } from './games/common.js';
import { PLAYER_COLORS } from './tracking/pose.js';

const stage = document.getElementById('stage');
const c = stage.getContext('2d');
const video = document.getElementById('cam');

let W = 0, H = 0, dpr = 1;
function resize(){
  dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  stage.width = Math.round(W * dpr); stage.height = Math.round(H * dpr);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize); resize();

/* ---------- router ---------- */
let scene = null, mode = 'boot';
let game = null, inst = null, players = 1, roundLeft = 0;
let paused = null, lost = null, handsUp = 0;

function go(next, build){
  mode = next;
  clearUI();
  cursor.reset();
  scene = build ? build() : null;
}

function toMenu(){
  music.intensity(0.15);
  go('menu', () => menu({ onPlay: toSplash, onRecalibrate: toCalibration }));
}

function toCalibration(){
  go('calibrate', () => calibration(toMenu));
}

function toSplash(g){
  game = g;
  players = Math.max(1, Math.min(2, pose.personCount || 1));
  music.intensity(0.35);
  go('splash', () => splash(g, players, startRound));
}

function startRound(){
  inst = game.create(players);
  roundLeft = game.secs;
  music.intensity(0.8);
  go('play', null);
}

function endRound(){
  music.intensity(0.3);
  const value = inst.value();
  const best = scores.record(game.id, players, value);
  const rows = inst.tally();
  const winner = inst.winner();
  go('results', () => results(game, rows, { winner, best },
      () => toSplash(game), toMenu));
}

/* ---------- pause by gesture ----------
   Both wrists above the head. It has to be a pose nobody strikes by accident
   mid-game, which is why it is held rather than instant. */
function handsAboveHead(p){
  if (!p.present || !p.lm) return false;
  const head = p.lm[0].y;
  return p.lm[15].y < head - 0.04 && p.lm[16].y < head - 0.04;
}

function checkPause(dt){
  if (mode !== 'play' || paused) { handsUp = 0; return; }
  const any = pose.players.slice(0, players).some(handsAboveHead);
  handsUp = any ? handsUp + dt : 0;
  if (handsUp >= 1.5){
    handsUp = 0;
    paused = pauseOverlay(
      () => { paused.remove(); paused = null; cursor.reset(); },
      () => { paused.remove(); paused = null; toMenu(); });
    sfx.whoosh();
  }
}

function checkLost(){
  if (mode !== 'play'){ if (lost){ lost.remove(); lost = null; } return; }
  const need = players;
  const have = pose.players.slice(0, need).filter(p => p.present).length;
  if (!pose.mouse.active && have < need && !lost) lost = lostOverlay();
  else if ((have >= need || pose.mouse.active) && lost){ lost.remove(); lost = null; }
}

/* ---------- HUD ---------- */
function drawHUD(){
  if (mode !== 'play' || !inst) return;
  const hud = inst.hud();
  const pad = Math.max(14, H * 0.03);
  c.textBaseline = 'top';
  for (let i = 0; i < players; i++){
    c.textAlign = i === 0 ? 'left' : 'right';
    const x = i === 0 ? pad : W - pad;
    c.font = `900 ${Math.round(H * 0.075)}px ui-rounded, system-ui, sans-serif`;
    c.lineWidth = Math.max(4, H * 0.008); c.strokeStyle = 'rgba(0,0,0,.55)';
    c.strokeText(String(hud.score[i]), x, pad);
    c.fillStyle = PLAYER_COLORS[i]; c.fillText(String(hud.score[i]), x, pad);
    if (hud.showLives){
      c.font = `800 ${Math.round(H * 0.034)}px ui-rounded, system-ui, sans-serif`;
      c.fillText('♥'.repeat(hud.lives[i]) || '—', x, pad + H * 0.082);
    }
  }
  c.textAlign = 'center';
  c.font = `900 ${Math.round(H * 0.062)}px ui-monospace, monospace`;
  const t = Math.max(0, Math.ceil(roundLeft));
  c.lineWidth = Math.max(4, H * 0.008); c.strokeStyle = 'rgba(0,0,0,.55)';
  c.strokeText(String(t), W / 2, pad);
  c.fillStyle = t <= 10 ? '#ff5d73' : '#f3f0ff';
  c.fillText(String(t), W / 2, pad);
  c.textAlign = 'start'; c.textBaseline = 'alphabetic';
}

/* ---------- loop ---------- */
let last = 0;
function tick(now){
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
  last = now;

  pose.update(now, dt);

  c.fillStyle = '#0d0b1a';
  c.fillRect(0, 0, W, H);

  if (mode === 'play' && inst && !paused && !lost){
    inst.step(dt, W, H);
    roundLeft -= dt;
    if (roundLeft <= 0 || inst.over) endRound();
  }
  if (mode === 'play' && inst) inst.draw(c, W, H);
  if (mode === 'results' && inst) inst.draw(c, W, H);

  /* A scene can navigate during its own tick - the splash countdown ends by
     starting the round - which leaves `scene` null before the draw. Hold the
     reference and check it is still the current one. */
  const live = scene;
  if (live){ live.tick(dt); if (scene === live) live.draw(c, W, H); }

  if (mode === 'play' && showSkeleton) drawSkeletons(c, W, H, 0.22);

  checkPause(dt);
  checkLost();
  cursor.update(dt, document.getElementById('ui'));
  drawHUD();
  cursor.draw(c, W, H);
  drawPerf(dt);

  requestAnimationFrame(tick);
}

let showSkeleton = true, showPerf = false;
let rFps = 0, rN = 0, rAcc = 0;

/* A readout rather than a guess. Pose runs only when the camera hands over a
   new frame, and the games run on their own clock and interpolate between, so
   the two numbers are independent - a low pose rate shows up as a laggy
   cursor long before the picture stutters. */
function drawPerf(dt){
  rAcc += dt; rN++;
  if (rAcc > 0.5){ rFps = rN / rAcc; rN = 0; rAcc = 0; }
  if (!showPerf) return;
  const pad = Math.max(12, H * 0.025), lh = Math.max(16, H * 0.028);
  const rows = [
    'render   ' + rFps.toFixed(0) + ' fps',
    'pose     ' + pose.fps.toFixed(0) + ' fps',
    'inference ' + pose.inferMs.toFixed(1) + ' ms',
    'players  ' + pose.personCount
  ];
  c.save();
  c.font = `700 ${Math.round(lh * 0.72)}px ui-monospace, monospace`;
  const w = Math.max(...rows.map(r => c.measureText(r).width)) + pad;
  c.fillStyle = 'rgba(9,7,20,.82)';
  c.fillRect(pad / 2, H - pad / 2 - lh * rows.length - pad / 2, w + pad / 2, lh * rows.length + pad / 2);
  c.textBaseline = 'top';
  rows.forEach((r, i) => {
    const slow = (i === 0 && rFps < 40) || (i === 1 && pose.fps < 12);
    c.fillStyle = slow ? '#ff8a3d' : '#9bffd0';
    c.fillText(r, pad, H - pad / 2 - lh * (rows.length - i) - pad / 4);
  });
  c.restore();
}
addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  if (e.key === 'k' || e.key === 'K') showSkeleton = !showSkeleton;
  if (e.key === 'p' || e.key === 'P') showPerf = !showPerf;
});

/* ---------- keep the screen alive ----------
   The camera is the controller, so a whole round can pass without a single
   key or mouse event and the machine decides it is idle. Nobody is sitting at
   the laptop to nudge it - that is the entire point - so the TV blanks in the
   middle of a game. The lock is dropped whenever the tab is hidden, so it has
   to be taken again on the way back. */
let wake = null;
async function holdScreen(){
  if (!('wakeLock' in navigator)) return;
  try { wake = await navigator.wakeLock.request('screen'); }
  catch (e) { wake = null; }        /* refused, or not a secure context */
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wake) holdScreen();
});

/* ---------- boot ---------- */
(async function boot(){
  const debug = new URLSearchParams(location.search).has('debug');
  const s = screen('dim');
  s.append(h('h1', '', 'Fam<span class="jam">Jam</span>'));
  s.append(h('p', 'lede', debug ? 'Debug mode — the mouse plays.' : 'Starting the camera…'));

  await pose.start(video, { forceMouse: debug });
  window.__pose = pose; window.__cursor = cursor;   /* a handle for tests; harmless in play */
  audio.resume(); music.start(); music.intensity(0.15);
  holdScreen();

  requestAnimationFrame(tick);
  toCalibration();
})();
