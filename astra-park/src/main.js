import { pose } from './tracking/pose.js';
import { cursor } from './ui/cursor.js';
import { menu, toggleFullscreen, openSettings } from './ui/menu.js';
import { title, logo } from './ui/title.js';
import { calibration, results, pauseOverlay, lostOverlay,
         clearUI, drawSkeletons, screen, h } from './ui/screens.js';
import { audio, music, sfx } from './audio/sound.js';
import { scores } from './games/common.js';
import { PLAYER_COLORS } from './tracking/pose.js';

const stage = document.getElementById('stage');
const c = stage.getContext('2d');
const video = document.getElementById('cam');
const over = document.getElementById('over');
const oc = over.getContext('2d');

let W = 0, H = 0, dpr = 1;
function resize(){
  dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  stage.width = Math.round(W * dpr); stage.height = Math.round(H * dpr);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  over.width = stage.width; over.height = stage.height;
  oc.setTransform(dpr, 0, 0, dpr, 0, 0);
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

/* The menus are quiet: music belongs to playing, so it starts when a game is
   picked and fades away on the way back out. */
function toMenu(){
  music.stop();
  go('menu', () => menu({ onPlay: toGame, onRecalibrate: toCalibration }));
}

function toCalibration(){
  go('calibrate', () => calibration(toMenu));
}

/* The front door. Shown once on boot rather than dropping straight into
   calibration, so the first thing on the television is the name and one
   obvious way in - not an instruction to stand further back. */
function toTitle(){
  music.stop();
  go('title', () => title({
    /* Straight to the games. Calibration used to sit in the way, which meant
       the second thing on the television was an instruction to stand further
       back - and the title screen already answers the only question that
       screen asked, with a dot that says whether anyone can be seen. It is
       still there under Settings for when tracking actually needs sorting. */
    onPlay: () => { toMenu(); cursor.hold(2); },
    onSettings: () => { toMenu(); openSettings(toCalibration); }
  }));
}

/* Straight into the game, no instructions or countdown: every round opens
   gently enough to be its own introduction, and the games show rather than
   tell. */
function toGame(g){
  game = g;
  players = Math.max(1, Math.min(2, pose.personCount || 1));
  music.start();
  startRound();
}

function startRound(){
  inst = game.create(players);
  roundLeft = game.secs;
  music.intensity(0.15);
  go('play', null);
}

/* A game can end on a moment of its own before the scores - Pop Party's
   bouquets - and the shell runs it until it says it's done. */
function endRound(){
  if (inst.outro){ music.intensity(0.25); go('outro', null); return; }
  showResults();
}

function showResults(){
  music.intensity(0.2);
  /* Bests are still kept - the menu tiles show them - just not announced. */
  scores.record(game.id, players, inst.value());
  go('results', () => results(game, () => toGame(game), toMenu));
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
  /* A game can say both hands up means something else right now - copying
     a giraffe, say - and isn't asking to pause. */
  if (mode !== 'play' || paused || (inst && inst.pausable && !inst.pausable())) { handsUp = 0; return; }
  const any = pose.players.slice(0, players).some(handsAboveHead);
  handsUp = any ? handsUp + dt : 0;
  /* A game where reaching up is part of play can ask for a longer hold. */
  if (handsUp >= (game.pauseHold || 1.5)){
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
  /* A cooperative game can keep score privately and show only the clock. */
  for (let i = 0; i < (hud.hideScore ? 0 : players); i++){
    c.textAlign = i === 0 ? 'left' : 'right';
    const x = i === 0 ? pad : W - pad;
    c.font = `700 ${Math.round(H * 0.075)}px Fredoka, ui-rounded, system-ui, sans-serif`;
    pill(c, x, pad, c.measureText(String(hud.score[i])).width, H * 0.075, i === 0 ? 'left' : 'right');
    c.lineWidth = Math.max(4, H * 0.008); c.strokeStyle = 'rgba(0,0,0,.55)';
    c.strokeText(String(hud.score[i]), x, pad);
    c.fillStyle = PLAYER_COLORS[i]; c.fillText(String(hud.score[i]), x, pad);
    if (hud.showLives){
      c.font = `600 ${Math.round(H * 0.034)}px Fredoka, ui-rounded, system-ui, sans-serif`;
      c.fillText('♥'.repeat(hud.lives[i]) || '—', x, pad + H * 0.082);
    }
  }
  c.textAlign = 'center';
  c.font = `600 ${Math.round(H * 0.062)}px Fredoka, ui-rounded, system-ui, sans-serif`;
  const t = Math.max(0, Math.ceil(roundLeft));
  /* Minutes and seconds once a round runs past one; plain seconds below. */
  const clock = t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : String(t);
  pill(c, W / 2, pad, c.measureText(clock).width, H * 0.062, 'center');
  c.lineWidth = Math.max(4, H * 0.008); c.strokeStyle = 'rgba(0,0,0,.55)';
  c.strokeText(clock, W / 2, pad);
  c.fillStyle = t <= 10 ? '#ff5d73' : '#f3f0ff';
  c.fillText(clock, W / 2, pad);
  c.textAlign = 'start'; c.textBaseline = 'alphabetic';
}

/* A game can paint any sky it likes; the numbers on top of it must still
   read from the sofa. */
function pill(c, x, y, w, h, align){
  const px = h * 0.32, left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  c.fillStyle = 'rgba(16,12,40,.42)';
  c.beginPath(); c.roundRect(left - px, y - h * 0.12, w + px * 2, h * 1.12, h * 0.3); c.fill();
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
    /* The band builds with the round: quiet fingerpicking through the
       opening, then strumming, and a new layer about every minute after,
       until everything - up a key - for the last ten seconds. */
    const done = game.secs - roundLeft;
    music.intensity(roundLeft <= 10 ? 1
      : done < 30 ? 0.15
      : 0.2 + 0.72 * Math.min(1, (done - 30) / Math.max(1, game.secs - 40)));
    if (roundLeft <= 0 || inst.over) endRound();
  }
  if (mode === 'outro' && inst && inst.outro(dt, W, H)) showResults();
  if ((mode === 'play' || mode === 'outro' || mode === 'results') && inst) inst.draw(c, W, H);

  /* A scene can navigate during its own tick - the title's wave ends by
     opening the menu - which leaves `scene` null before the draw. Hold the
     reference and check it is still the current one. */
  const live = scene;
  if (live){ live.tick(dt); if (scene === live) live.draw(c, W, H); }

  if (mode === 'play' && showSkeleton) drawSkeletons(c, W, H, 0.22);

  checkPause(dt);
  checkLost();
  cursor.update(dt, document.getElementById('ui'));
  drawHUD();
  oc.clearRect(0, 0, W, H);
  if ((mode !== 'play' && mode !== 'outro') || paused || lost) cursor.draw(oc, W, H);
  drawPerf(dt);

  requestAnimationFrame(tick);
}

/* ?perf in the address shows the frame-rate readout from the start, for a
   phone or tablet with no P key to press. */
let showSkeleton = false, showPerf = new URLSearchParams(location.search).has('perf');
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
  s.append(logo());
  s.append(h('p', 'lede', debug ? 'Debug mode — the mouse plays.' : 'Starting the camera…'));

  await pose.start(video, { forceMouse: debug });
  window.__pose = pose; window.__cursor = cursor; window.__music = music;   /* handles for tests; harmless in play */
  window.__round = () => inst;
  audio.resume();
  holdScreen();

  requestAnimationFrame(tick);
  toTitle();
})();
