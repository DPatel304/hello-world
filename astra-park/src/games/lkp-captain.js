/* Last Known Position's voice in your ear: Nova, the crew's ship's
   computer, talking them through it from the wreck over the radio -
   their guide, their teacher and the story's narrator.

   In play she's a small window up in the top left: it slides in, her face
   in it talking, and slides away when she's done. She says it out loud
   (voice.js) - children can't read fast - with no more than a word or
   three under her window. She teaches by noticing: the first fallen tree,
   "Lean!"; the first one asleep, "Clap!" - each tip once a run.

   And there are a few little scenes, the only times the game stops for
   her: the level opening (its name, its goal, the job), the boss showing
   itself, and the ending - level clear, or pulled out asleep. What's said
   in them is the level's (lkp-levels.js). Any player waving skips one.

   Warm and encouraging, a bit of action-film drama, never scary. */
import { pose } from '../tracking/pose.js';
import { PAL } from './lkp-art.js';
import { WaveWatch, handsFrom } from '../tracking/wave.js';
import { voice, lineTime } from '../audio/voice.js';

export const NOVA = 'Nova';
/* Each player by their colour, as she'd call them. */
export const NAMES = ['Blue', 'Orange', 'Green', 'Purple'];
/* After a line's said, it stays up this long. */
const HOLD = 0.5;

/* ---------- in play: the radio window ---------- */

export class Captain {
  constructor(){ this.line = null; this.queue = []; this.said = new Set(); this.show = 0; this.t = 0; }

  /* Say text (words: the few words under her window). once: a tip given
     only once a run. Lines cut in, unless polite, when they wait their
     turn. Returns whether it'll be said. */
  say(text, words = '', { once = null, polite = false, who = 'nova' } = {}){
    if (once){ if (this.said.has(once)) return false; this.said.add(once); }
    const line = { text, words, who, t: 0, len: lineTime(text, who) + HOLD };
    if (polite && this.line){ this.queue.push(line); return true; }
    this.queue = []; this._start(line);
    return true;
  }
  _start(line){ this.line = line; voice.say(line.text, line.who); }

  get talking(){ return !!this.line && this.line.t < this.line.len - HOLD; }
  get busy(){ return !!this.line || this.queue.length > 0; }

  step(dt){
    this.t += dt;
    if (this.line){
      this.line.t += dt;
      if (this.line.t >= this.line.len){ this.line = null; if (this.queue.length) this._start(this.queue.shift()); }
    }
    this.show += ((this.line ? 1 : 0) - this.show) * Math.min(1, dt * 6);
  }

  /* The window, top left: her face and, under it, her few words. */
  draw(c, W, H){
    if (this.show < 0.02) return;
    const s = H * 0.17, x = H * 0.03 - (1 - this.show) * (s + H * 0.05), y = H * 0.03;
    radio(c, x, y, s, s, this.t, this.talking, 1 - this.show);
    const w = this.line && this.line.words;
    if (w){
      c.save(); c.globalAlpha = this.show;
      c.font = `700 ${Math.round(H * 0.04)}px Fredoka, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'top';
      c.lineWidth = H * 0.008; c.strokeStyle = '#05060f'; c.strokeText(w, x, y + s + H * 0.015);
      c.fillStyle = '#ffffff'; c.fillText(w, x, y + s + H * 0.015);
      c.restore();
    }
  }
}

/* A radio window at (x, y), w x h, with Nova in it - or a robot (who),
   called label - talking or not; static, 0..1, over it. */
function radio(c, x, y, w, h, t, talking, staticK = 0, who = 'nova', label = 'ROBOT'){
  c.save();
  c.fillStyle = '#0b1220'; c.strokeStyle = who === 'robot' ? '#ff3b3b' : '#3fd0ff'; c.lineWidth = h * 0.03;
  c.beginPath(); c.roundRect(x, y, w, h, h * 0.08); c.fill();
  c.save(); c.clip();
  if (who === 'robot') robotFace(c, x + w / 2, y + h * 0.5, h * 0.42, t, talking);
  else novaFace(c, x + w / 2, y + h * 0.56, h * 0.36, t, talking);
  /* Scan lines, and a fizz of static. */
  c.fillStyle = 'rgba(0,0,0,.18)';
  for (let k = 0; k < h; k += 4) c.fillRect(x, y + k, w, 1.5);
  if (staticK > 0.05){
    c.globalAlpha = staticK;
    for (let k = 0; k < 80; k++){ c.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#7a8396'; c.fillRect(x + Math.random() * w, y + Math.random() * h, w * 0.06, 2); }
  }
  c.restore();
  c.stroke();
  /* Her name, small, on the frame. */
  c.font = `700 ${Math.round(h * 0.11)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = who === 'robot' ? '#ff3b3b' : '#3fd0ff';
  c.fillText(who === 'robot' ? label : NOVA.toUpperCase(), x + w / 2, y + h * 0.92);
  c.restore();
}

/* Nova, as the ship shows her: short dark hair, warm brown skin, a
   headset with a mic, a teal crew collar - and a smile - with a faint
   hologram shimmer. Her mouth moves while she talks; she blinks now and
   then. r is her head's size. */
export function novaFace(c, x, y, r, t, talking){
  const ink = '#2b2440', skin = '#a8714f', hair = '#2a1a14';
  c.save();
  /* Shoulders, in uniform. */
  c.fillStyle = '#1f8f8a'; c.beginPath(); c.ellipse(x, y + r * 1.55, r * 1.25, r * 0.7, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#ffd35a'; c.beginPath(); c.arc(x - r * 0.55, y + r * 1.25, r * 0.1, 0, 6.2832); c.fill();
  c.fillStyle = skin; c.fillRect(x - r * 0.22, y + r * 0.6, r * 0.44, r * 0.4);
  /* Hair behind, the face, hair in front: a short bob with a side fringe. */
  c.fillStyle = hair; c.beginPath(); c.ellipse(x, y - r * 0.05, r * 0.98, r * 1.02, 0, 0, 6.2832); c.fill();
  c.fillStyle = skin; c.beginPath(); c.ellipse(x, y + r * 0.08, r * 0.78, r * 0.86, 0, 0, 6.2832); c.fill();
  c.fillStyle = hair;
  c.beginPath(); c.moveTo(x - r * 0.85, y - r * 0.1); c.quadraticCurveTo(x - r * 0.6, y - r * 1.05, x + r * 0.2, y - r * 0.92);
  c.quadraticCurveTo(x + r * 0.9, y - r * 0.8, x + r * 0.85, y - r * 0.15); c.quadraticCurveTo(x + r * 0.2, y - r * 0.55, x - r * 0.85, y - r * 0.1); c.fill();
  /* Eyes, brows, cheeks. */
  const blink = (t % 4.1) < 0.12 ? 0.12 : 1;
  for (const s of [-1, 1]){
    c.fillStyle = ink; c.beginPath(); c.ellipse(x + s * r * 0.3, y + r * 0.05, r * 0.09, r * 0.12 * blink, 0, 0, 6.2832); c.fill();
    if (blink === 1){ c.fillStyle = '#fff'; c.beginPath(); c.arc(x + s * r * 0.3 + r * 0.03, y, r * 0.035, 0, 6.2832); c.fill(); }
    c.strokeStyle = hair; c.lineWidth = r * 0.05; c.lineCap = 'round';
    c.beginPath(); c.arc(x + s * r * 0.3, y - r * 0.06, r * 0.15, 1.2 * Math.PI, 1.8 * Math.PI); c.stroke();
    c.fillStyle = 'rgba(255,120,120,.35)'; c.beginPath(); c.ellipse(x + s * r * 0.45, y + r * 0.3, r * 0.12, r * 0.07, 0, 0, 6.2832); c.fill();
  }
  /* The mouth: a smile, opening and closing as she talks. */
  const open = talking ? Math.abs(Math.sin(t * 14)) * 0.1 : 0;
  c.fillStyle = '#6b2b2b'; c.strokeStyle = ink; c.lineWidth = r * 0.05;
  c.beginPath();
  if (open > 0.02){ c.moveTo(x - r * 0.16, y + r * 0.38); c.lineTo(x + r * 0.16, y + r * 0.38); c.ellipse(x, y + r * 0.38, r * 0.16, r * (0.04 + open), 0, 0, Math.PI); c.fill(); }
  else { c.arc(x, y + r * 0.3, r * 0.16, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
  /* The headset: a band over the hair, an earpiece, a mic. */
  c.strokeStyle = '#3a4057'; c.lineWidth = r * 0.12;
  c.beginPath(); c.arc(x, y - r * 0.05, r * 0.98, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
  c.fillStyle = '#3a4057'; c.beginPath(); c.roundRect(x - r * 1.02, y - r * 0.15, r * 0.24, r * 0.4, r * 0.08); c.fill();
  c.lineWidth = r * 0.05; c.beginPath(); c.moveTo(x - r * 0.9, y + r * 0.2); c.quadraticCurveTo(x - r * 0.7, y + r * 0.55, x - r * 0.3, y + r * 0.5); c.stroke();
  c.fillStyle = '#3fd0ff'; c.beginPath(); c.arc(x - r * 0.28, y + r * 0.5, r * 0.06, 0, 6.2832); c.fill();
  /* The shimmer: she's the ship's computer, after all. */
  c.globalAlpha = 0.1 + 0.05 * Math.sin(t * 3); c.fillStyle = '#7ff3ff';
  c.fillRect(x - r * 1.3, y - r * 1.2, r * 2.6, r * 3);
  c.restore();
}

/* A robot on the radio: one great eye, red, pulsing as it speaks. */
function robotFace(c, x, y, r, t, talking){
  c.save();
  c.fillStyle = '#2c3142'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  const k = talking ? 0.5 + 0.12 * Math.sin(t * 18) : 0.45;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#ffb3b3'); g.addColorStop(0.4, '#ff3b3b'); g.addColorStop(1, 'rgba(255,59,59,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * k * 1.6, 0, 6.2832); c.fill();
  c.fillStyle = '#05060a'; c.beginPath(); c.arc(x, y, r * 0.16, 0, 6.2832); c.fill();
  c.restore();
}

/* ---------- the scenes ---------- */

/* What's said in a scene of the level's, in order: [who, text, words].
   'PRAISE' is each player there, by their colour. */
export function script(kind, game){
  const here = game ? game.here : [], cheers = ['great dodging', 'amazing fighting', 'super running', 'brilliant teamwork'];
  const praise = here.map((i, k) => `${NAMES[i]}, ${cheers[(i + k) % cheers.length]}!`).join(' ');
  return ((game && game.level.lines[kind]) || []).flatMap(l => l === 'PRAISE' ? (praise ? [['nova', praise, '']] : []) : [l]);
}

export class Scene {
  constructor(kind, game){
    this.kind = kind; this.t = 0; this.k = -1; this.line = null; this.done = false;
    this.lines = script(kind, game);
    /* The robot on the radio: the boss by name, or just the robots. */
    this.label = (kind === 'boss' && game ? game.level.bossName : 'Robots').toUpperCase();
    /* Opening a level: its name and goal, big, at the top. */
    this.title = kind === 'opening' && game ? [game.level.name, game.level.goal] : null;
    this.waves = new WaveWatch(); this.n = game ? game.players : 4;
    this._next();
  }
  _next(){
    this.k++;
    if (this.k >= this.lines.length){ this.done = true; this.line = null; voice.hush(); return; }
    const [who, text, words] = this.lines[this.k];
    this.line = { who, text, words, t: 0, len: lineTime(text, who) + HOLD };
    voice.say(text, who);
  }
  get talking(){ return !!this.line && this.line.t < this.line.len - HOLD; }
  /* Any player waving skips it. */
  step(dt){
    if (this.done) return;
    this.t += dt;
    this.waves.step(dt, handsFrom(pose, this.n));
    if (this.waves.done){ this.done = true; voice.hush(); return; }
    this.line.t += dt;
    if (this.line.t >= this.line.len) this._next();
  }

  /* The scene, behind - drawn by the caller - then the level's name, her
     (or a robot), big, on the radio, the words, and a hand to wave in
     the corner. */
  draw(c, W, H){
    if (!this.line) return;
    if (this.title){
      c.save(); c.globalAlpha = Math.min(1, this.t * 1.5); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = H * 0.012; c.strokeStyle = '#05060f';
      c.font = `700 ${Math.round(H * 0.09)}px Fredoka, sans-serif`;
      c.strokeText(this.title[0].toUpperCase(), W / 2, H * 0.13); c.fillStyle = '#ffffff'; c.fillText(this.title[0].toUpperCase(), W / 2, H * 0.13);
      c.font = `700 ${Math.round(H * 0.045)}px Fredoka, sans-serif`;
      c.strokeText(this.title[1].toUpperCase(), W / 2, H * 0.23); c.fillStyle = '#ffd24a'; c.fillText(this.title[1].toUpperCase(), W / 2, H * 0.23);
      c.restore();
    }
    const who = this.line.who, s = H * 0.36, x = W * 0.06, y = H * 0.38;
    radio(c, x, y, s, s, this.t, this.talking, Math.max(0, 1 - this.t * 3), who, this.label);
    if (this.line.words){
      c.save();
      c.font = `700 ${Math.round(H * 0.075)}px Fredoka, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.lineWidth = H * 0.012; c.strokeStyle = '#05060f'; c.strokeText(this.line.words, x + s + H * 0.05, y + s * 0.5);
      c.fillStyle = who === 'robot' ? '#ff5b5b' : '#ffffff'; c.fillText(this.line.words, x + s + H * 0.05, y + s * 0.5);
      c.restore();
    }
    /* Wave to skip: a hand, with how much of a wave it's had. */
    const hx = W - H * 0.08, hy = H - H * 0.08, hr = H * 0.035;
    c.save();
    c.globalAlpha = 0.5 + 0.5 * this.waves.meter;
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = H * 0.006;
    c.beginPath(); c.arc(hx, hy, hr * 1.3, 0, 6.2832); c.stroke();
    c.strokeStyle = '#ffffff'; c.beginPath(); c.arc(hx, hy, hr * 1.3, -Math.PI / 2, -Math.PI / 2 + this.waves.meter * 6.2832); c.stroke();
    c.font = `${Math.round(hr * 1.4)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('\u{1F44B}', hx, hy);
    c.restore();
  }
}

/* The backdrops, in the level's colours. The crash site: the forest at
   dawn, the ship's wreck far off on a hill, smoke still rising from it. */
export function drawOpening(c, W, H, t){ landscape(c, W, H, t, 0); }

/* Before a boss: its arena, darkening. (The game draws the arena; this
   darkens it.) */
export function drawBossRising(c, W, H, t){
  c.fillStyle = `rgba(5,6,15,${Math.max(0.35, 0.8 - t * 0.1)})`; c.fillRect(0, 0, W, H);
}

/* The level's end: the same land - lit gold and sparkling for a level
   cleared, dim for a crew pulled out. */
export function drawEnding(c, W, H, t, won){
  landscape(c, W, H, t, won ? 1 : -1);
  if (won) for (let k = 0; k < 8; k++){
    const a = t * 0.5 + k;
    c.fillStyle = `hsl(${(k * 45 + t * 40) % 360},90%,70%)`;
    c.beginPath(); c.arc(W * (0.2 + 0.6 * ((k * 0.37 + t * 0.05) % 1)), H * (0.25 + 0.1 * Math.sin(a)), H * 0.007, 0, 6.2832); c.fill();
  }
}

/* The level's land, from the edge of the forest: sky, far hills, the
   wreck on one with its smoke, and dark trees in front. mood: 0 dawn, 1
   bright, -1 dim. */
function landscape(c, W, H, t, mood){
  const g = c.createLinearGradient(0, 0, 0, H * 0.7);
  g.addColorStop(0, mood < 0 ? '#0b1018' : '#1d2b4a'); g.addColorStop(1, mood < 0 ? '#1a1e26' : mood > 0 ? '#f6c87a' : '#e89a6a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (mood <= 0) stars(c, W, H * 0.4, t);
  c.fillStyle = PAL.floor;
  c.beginPath(); c.moveTo(0, H * 0.62); c.quadraticCurveTo(W * 0.3, H * 0.5, W * 0.6, H * 0.58); c.quadraticCurveTo(W * 0.85, H * 0.5, W, H * 0.6); c.lineTo(W, H); c.lineTo(0, H); c.fill();
  /* The wreck, small and far, and its smoke. */
  const wx = W * 0.74, wy = H * 0.53;
  c.fillStyle = '#9aa3b5'; c.save(); c.translate(wx, wy); c.rotate(-0.2);
  c.beginPath(); c.moveTo(-H * 0.06, 0); c.lineTo(H * 0.05, -H * 0.015); c.quadraticCurveTo(H * 0.08, 0, H * 0.05, H * 0.015); c.closePath(); c.fill();
  c.restore();
  if (mood <= 0) for (let k = 0; k < 6; k++){
    const u = ((t * 0.15 + k / 6) % 1);
    c.fillStyle = `rgba(160,160,170,${0.35 * (1 - u)})`;
    c.beginPath(); c.arc(wx + u * H * 0.06, wy - H * 0.02 - u * H * 0.25, H * (0.015 + u * 0.03), 0, 6.2832); c.fill();
  }
  /* Trees in front. */
  for (let k = 0; k < 14; k++){
    const x = (k / 13) * W, h = H * (0.25 + ((k * 37) % 10) / 40), w = h * 0.4, y = H * 1.02;
    c.fillStyle = PAL.trees || '#1f5a34';
    c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + w / 2, y); c.lineTo(x - w / 2, y); c.fill();
  }
  if (mood < 0){ c.fillStyle = 'rgba(5,6,15,.35)'; c.fillRect(0, 0, W, H); }
}

function stars(c, W, H, t){
  for (let k = 0; k < 90; k++){
    const x = ((k * 0.6180339 + t * 0.004 * (1 + k % 3)) % 1) * W, y = ((k * 0.3819) % 1) * H;
    c.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * ((k * 7) % 10) / 10})`;
    c.fillRect(x, y, 2, 2);
  }
}
