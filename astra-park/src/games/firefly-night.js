import { clamp } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { NightScene } from './firefly-scene.js';
import { Avatars } from '../ui/avatars.js';

/* Firefly Night. Dusk in the park, fireflies drifting over the meadow. Bring
   your hands together into a cup to catch them, carry them down to a jar,
   and pour them in; a full jar floats up into the sky as a lantern. Nothing
   is lost: open your hands on the way and the fireflies just fly free again.
   Everyone fills the same jars, there are no scores on screen, and when the
   round ends every firefly collected rises up to become a star. */

export const ROUND = 300;
export const FINALE = ROUND - 10;
export const OPENING = 30;

/* Two hands closer than this - in screen heights - make a cup. */
export const CUP_GAP = 0.14;
/* Hands can drift apart for this long without the cup opening, so a wobble
   on the way to the jar doesn't spill everything. */
export const CUP_GRACE = 0.35;
/* How close a cup must come to a firefly to catch it, and how many it holds. */
export const CATCH_REACH = 0.08;
export const CUP_HOLDS = 5;
/* Fireflies to fill a jar; a golden one counts as several. */
export const JAR_FULL = 12;
export const GOLDEN_WORTH = 3;
export const JAR_X = [0.22, 0.5, 0.78];
const JAR_MOUTH = 0.7, JAR_BASE = 0.9, JAR_W = 0.05;
const STAR_CAP = 150;
/* The game shows itself rather than saying anything: a pair of ghostly hands
   cups a firefly and carries it down to a jar. It plays a few seconds in if
   nobody has filled a jar yet, and again whenever nobody has for a long
   while, so a child who wandered off gets shown again. */
export const HINT_FIRST = 3;
export const HINT_AGAIN = 40;
export const HINT_LOOP = 6;

export default {
  id: 'firefly-night', name: 'Firefly Night', stars: 1, accent: '#ffd86b', secs: ROUND,
  create(n){ return new FireflyNight(n); }
};

class FireflyNight {
  constructor(players){
    this.players = players;
    this.t = 0; this.spawn = 0; this.over = false;
    this.flies = [];
    this.cups = [0, 1].map(() => ({ x: 0.5, y: 0.5, cupped: false, apart: 9, held: [] }));
    this.jars = JAR_X.map(x => this._jar(x));
    this.pours = [];          /* fireflies on their way from a cup into a jar */
    this.sparks = [];
    this.caught = [0, 0];     /* fireflies each player has put in a jar */
    this.collected = 0;       /* every firefly that went into any jar */
    this.ribbons = planRibbons();
    this.scene = new NightScene();
    this.avatars = new Avatars();
    this.out = null;
    this.lastPour = 0;        /* when a firefly last went into a jar */
    this.hint = -1;           /* seconds into the ghost demonstration, or -1 */
  }

  get hinting(){ return this.hint >= 0; }

  _jar(x){ return { x, count: 0, fade: 0, lifting: 0 }; }

  /* How many fireflies should be about: a few gentle ones through the
     opening, building to a dozen, then a swarm for the last ten seconds. */
  target(){
    if (this.t >= FINALE) return 22;
    if (this.t < OPENING) return 3;
    return 3 + 9 * (this.t - OPENING) / (FINALE - OPENING);
  }

  step(dt, W, H){
    this.t += dt;
    const free = this.flies.filter(f => f.state === 'free').length;
    this.spawn -= dt;
    if (this.spawn <= 0 && free < this.target()){
      this.spawn = this.t >= FINALE ? 0.12 : 0.7;
      this.flies.push(this._fly());
    }
    for (const r of this.ribbons){
      if (!r.done && this.t >= r.at){ r.done = true; this._ribbon(); }
    }

    for (const f of this.flies) this._move(f, dt);
    this._cups(dt, W, H);
    this._stepPours(dt);
    this._stepHint(dt);
    for (const j of this.jars){
      j.fade = Math.min(1, j.fade + dt * 1.5);
      if (j.lifting){ j.lifting += dt; }
    }
    /* A jar that has lifted away is replaced by a fresh one. */
    this.jars = this.jars.map(j => (j.lifting > 1.2 ? this._jar(j.x) : j));
    this.flies = this.flies.filter(f => f.state !== 'gone');
    this._stepSparks(dt);

    this.scene.step(dt, { t: this.t, p: this.t / ROUND, look: this._look() });
    this.avatars.step(dt, this.players, this.cups.map(c => (c.held.length >= 4 ? 2 : c.held.length >= 2 ? 1 : 0)));
  }

  /* ---------- fireflies ---------- */

  _fly(x, y){
    const golden = Math.random() < 0.06;
    const low = this.t < OPENING;
    return {
      x: x ?? 0.08 + Math.random() * 0.84, y: y ?? 0.95, state: 'free',
      ang: -Math.PI / 2 + (Math.random() - 0.5), sp: 0.04 + Math.random() * 0.03,
      /* Through the opening they stay low and slow, easy to reach. */
      top: low ? 0.38 : 0.16, bottom: low ? 0.62 : 0.64,
      ph: Math.random() * 6.28, blink: 1.2 + Math.random() * 1.6, golden, age: 0
    };
  }

  /* Wandering flight: the heading drifts, and turns back toward the middle
     of the band they live in when they stray out of it. */
  _move(f, dt){
    f.age += dt;
    if (f.state !== 'free') return;
    const speed = f.sp * (1 + Math.min(1, this.t / FINALE) * 0.4) * (this.t >= FINALE ? 1.3 : 1);
    if (f.ribbon){
      f.x += f.ribbon.dir * 0.12 * dt;
      f.y = f.ribbon.y + Math.sin(f.age * 2 + f.ribbon.k * 0.6) * 0.05;
      if (f.x < -0.1 || f.x > 1.1) f.state = 'gone';
      return;
    }
    f.ang += (Math.random() - 0.5) * dt * 2.4;
    const midY = (f.top + f.bottom) / 2;
    if (f.y < f.top || f.y > f.bottom || f.x < 0.06 || f.x > 0.94){
      const want = Math.atan2(midY - f.y, 0.5 - f.x);
      f.ang += Math.sin(want - f.ang) * dt * 3;
    }
    f.x += Math.cos(f.ang) * speed * dt * (9 / 16);
    f.y += Math.sin(f.ang) * speed * dt;
  }

  /* Now and then a ribbon of fireflies streams across the sky. */
  _ribbon(){
    const dir = Math.random() < 0.5 ? 1 : -1, y = 0.25 + Math.random() * 0.25;
    for (let k = 0; k < 14; k++){
      const f = this._fly(dir > 0 ? -0.05 - k * 0.04 : 1.05 + k * 0.04, y);
      f.ribbon = { dir, y, k };
      f.golden = false;
      this.flies.push(f);
    }
    sfx.rainbow();
  }

  /* ---------- cups ---------- */

  _cups(dt, W, H){
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i], cup = this.cups[i];
      if (!p || !p.present){ this._open(cup); continue; }
      const l = pose.mouse.active ? p.hands.right : p.hands.left, r = p.hands.right;
      const gap = Math.hypot((l.x - r.x) * (W / H), l.y - r.y);
      cup.x = (l.x + r.x) / 2; cup.y = (l.y + r.y) / 2;
      /* The mouse is one hand, so it is always a cup. */
      if (pose.mouse.active || gap < CUP_GAP){ cup.apart = 0; cup.cupped = true; }
      else {
        cup.apart += dt;
        if (cup.apart > CUP_GRACE) this._open(cup);
      }
      if (!cup.cupped) continue;

      for (const f of this.flies){
        if (f.state !== 'free' || cup.held.length >= CUP_HOLDS) continue;
        const reach = CATCH_REACH * (f.golden ? 1.4 : 1);
        if (Math.hypot((f.x - cup.x) * (W / H), f.y - cup.y) < reach){
          f.state = 'held'; f.ribbon = null; f.who = i;
          cup.held.push(f);
          sfx.firefly(cup.held.length - 1);
          this._sparkle(f.x, f.y, f.golden ? 10 : 5, f.golden);
        }
      }
      /* Held fireflies circle just outside the hands, so the mitts never
         hide what a child is carrying. */
      for (let k = 0; k < cup.held.length; k++){
        const f = cup.held[k], a = this.t * 2.5 + k * (6.28 / cup.held.length);
        f.x = cup.x + Math.cos(a) * 0.05 * (H / W); f.y = cup.y + Math.sin(a) * 0.05;
      }

      const jar = this.jars.find(j => !j.lifting && j.fade > 0.5 && this._atMouth(cup, j, W, H));
      if (jar && cup.held.length) this._pour(cup, jar, i);
    }
  }

  _atMouth(cup, jar, W, H){
    return Math.abs(cup.x - jar.x) * (W / H) < JAR_W * 1.8 && cup.y > JAR_MOUTH - 0.1 && cup.y < JAR_BASE;
  }

  /* Hands apart for too long: the fireflies float free again. */
  _open(cup){
    if (cup.held.length) sfx.flyaway();
    for (const f of cup.held){ f.state = 'free'; f.ang = -Math.PI / 2 + (Math.random() - 0.5); f.top = 0.16; f.bottom = 0.64; }
    cup.held = []; cup.cupped = false;
  }

  _pour(cup, jar, who){
    cup.held.forEach((f, k) => {
      f.state = 'pouring';
      this.pours.push({ f, jar, who, from: { x: f.x, y: f.y }, t: -k * 0.08 });
    });
    cup.held = [];
  }

  _stepPours(dt){
    for (const p of this.pours){
      p.t += dt;
      const u = clamp(p.t / 0.35, 0, 1);
      p.f.x = p.from.x + (p.jar.x - p.from.x) * u;
      p.f.y = p.from.y + (JAR_MOUTH + 0.03 - p.from.y) * u;
      if (u >= 1 && !p.done){
        p.done = true; p.f.state = 'gone';
        const worth = p.f.golden ? GOLDEN_WORTH : 1;
        this.caught[p.who] += worth; this.collected += worth;
        this.lastPour = this.t;
        if (p.jar.lifting){ continue; }
        p.jar.count = Math.min(JAR_FULL, p.jar.count + worth);
        sfx.jar(p.jar.count);
        this._sparkle(p.jar.x, JAR_MOUTH, 4, p.f.golden);
        if (p.jar.count >= JAR_FULL){
          p.jar.lifting = 0.001;
          this.scene.addLantern(p.jar.x, JAR_MOUTH);
          sfx.lantern();
        }
      }
    }
    this.pours = this.pours.filter(p => !p.done);
  }

  /* ---------- showing how ---------- */

  _stepHint(dt){
    /* Someone with fireflies in hand has got it; the demonstration gets out
       of their way. A loop that has started otherwise plays to its end, so
       the ghost never vanishes mid-gesture. */
    if (this.cups.some(c => c.held.length) || this.out){ this.hint = -1; return; }
    const due = this.t < FINALE && this.t - this.lastPour > (this.collected ? HINT_AGAIN : HINT_FIRST);
    if (this.hint >= 0){
      this.hint += dt;
      if (this.hint >= HINT_LOOP) this.hint = due ? 0 : -1;
    } else if (due) this.hint = 0;
  }

  /* ---------- the ending: every firefly collected becomes a star ---------- */

  outro(dt, W, H){
    if (!this.out){
      this.out = { t: 0, flights: [] };
      /* One firefly per jar-load collected, flying from the jars up into the
         sky, capped so a huge round stays smooth. */
      const n = Math.min(STAR_CAP, this.collected + this.flies.length);
      for (let k = 0; k < n; k++){
        const jx = JAR_X[k % JAR_X.length];
        this.out.flights.push({ k, x: jx, y: JAR_MOUTH, tx: 0.04 + Math.random() * 0.92, ty: 0.04 + Math.random() * 0.5,
                                at: 0.3 + (k / Math.max(1, n)) * 3.2, done: false });
      }
      for (const c of this.cups) this._open(c);
      for (const f of this.flies) f.state = 'gone';
      sfx.lantern();
    }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.scene.step(dt, { t: this.t, p: 1, look: this._look() });
    this.avatars.step(dt, this.players);
    this._stepSparks(dt);
    for (const f of o.flights){
      if (f.done || o.t < f.at) continue;
      const u = clamp((o.t - f.at) / 1.2, 0, 1), e = 1 - Math.pow(1 - u, 3);
      f.cx = f.x + (f.tx - f.x) * e + Math.sin(u * 6 + f.tx * 10) * 0.02 * (1 - u);
      f.cy = f.y + (f.ty - f.y) * e;
      /* A chime for every fourth star: enough to hear them arrive without
         a hundred bells at once. */
      if (u >= 1){ f.done = true; this.scene.addStar(f.tx, f.ty); if (f.k % 4 === 0) sfx.twinkle(); }
    }
    return o.t > 6.5;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    /* Fainter than by day: at night the silhouettes would outshine the
       fireflies. */
    this.avatars.drawBodies(c, W, H, this.players, [0, 0], 0.2);
    this._drawJarLight(c, W, H);
    this.scene.drawFront(c, W, H);
    /* While anyone is carrying fireflies, the jars breathe a little brighter:
       this is where they go. */
    const beckon = this.cups.some(cp => cp.held.length) ? 0.5 + 0.5 * Math.sin(this.t * 4) : 0;
    for (const j of this.jars) this._drawJar(c, j, W, H, beckon);
    if (this.hint >= 0) this._drawHint(c, W, H);
    for (const f of this.flies) if (f.state === 'free' || f.state === 'pouring') this._drawFly(c, f, W, H);
    if (this.out) for (const f of this.out.flights) if (f.cx != null && !f.done) this._glow(c, f.cx * W, f.cy * H, H * 0.012, 1, false);
    this._drawSparks(c, W, H);
    this._drawCups(c, W, H);
    if (!this.out) this.avatars.drawMitts(c, W, H, this.players);
    for (const f of this.flies) if (f.state === 'held') this._drawFly(c, f, W, H);
  }

  _glow(c, x, y, r, a, golden){
    const g = c.createRadialGradient(x, y, 0, x, y, r * 4.5);
    const col = golden ? '255,210,80' : '215,255,120';
    g.addColorStop(0, `rgba(${col},${0.9 * a})`); g.addColorStop(0.25, `rgba(${col},${0.35 * a})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r * 4.5, 0, 6.2832); c.fill();
    c.fillStyle = `rgba(255,255,230,${a})`;
    c.beginPath(); c.arc(x, y, r * 0.6, 0, 6.2832); c.fill();
  }

  _drawFly(c, f, W, H){
    /* A slow blink, never fully dark, so a child can always find one. */
    const b = f.state === 'free' ? 0.55 + 0.45 * Math.max(0, Math.sin(f.age * (6.28 / f.blink) + f.ph)) : 1;
    this._glow(c, f.x * W, f.y * H, H * (f.golden ? 0.022 : 0.016), b, f.golden);
  }

  _drawCups(c, W, H){
    for (let i = 0; i < this.players; i++){
      const cup = this.cups[i];
      if (!cup.cupped || !cup.held.length) continue;
      const x = cup.x * W, y = cup.y * H, r = H * (0.04 + cup.held.length * 0.008);
      const g = c.createRadialGradient(x, y, 0, x, y, r * 2);
      g.addColorStop(0, 'rgba(230,255,150,.35)'); g.addColorStop(1, 'rgba(230,255,150,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2, 0, 6.2832); c.fill();
    }
  }

  /* The pool of warm light each jar throws on the grass, by how full it is. */
  _drawJarLight(c, W, H){
    for (const j of this.jars){
      const k = j.count / JAR_FULL;
      if (k <= 0) continue;
      const x = j.x * W, y = JAR_BASE * H, r = H * (0.12 + k * 0.12);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,220,120,${0.35 * k})`); g.addColorStop(1, 'rgba(255,220,120,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  /* The demonstration: ghostly hands either side of a firefly come together
     around it, carry it down to the middle jar and let it drop in. */
  _drawHint(c, W, H){
    const u = this.hint, F = { x: 0.64, y: 0.46 }, J = JAR_X[1];
    const ease = (a, b) => { const k = clamp((u - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    const show = Math.min(ease(0, 0.5), 1 - ease(4.2, 4.8));
    if (show <= 0) return;
    const close = ease(0.6, 1.4), carry = ease(1.7, 3.2), drop = ease(3.3, 3.8);
    const cx = F.x + (J - F.x) * carry, cy = F.y + (JAR_MOUTH - 0.06 - F.y) * carry;
    const gap = 0.2 - 0.12 * close + 0.06 * drop;
    if (drop < 1){
      const fx = u < 1.4 ? F.x + Math.sin(u * 3) * 0.008 : cx;
      const fy = u < 1.4 ? F.y + Math.cos(u * 2.3) * 0.008 : cy + (JAR_MOUTH + 0.05 - cy) * drop;
      this._glow(c, fx * W, fy * H, H * 0.02, show * (1 - drop * 0.6), false);
    }
    /* Each hand a curved palm, ( and ), so that apart they read as two
       open hands and together they close round the firefly in a cup. */
    const r = H * 0.04;
    for (const side of [-1, 1]){
      const x = (cx + side * (gap / 2) * (H / W)) * W, y = cy * H;
      const halo = c.createRadialGradient(x, y, r * 0.3, x, y, r * 2);
      halo.addColorStop(0, `rgba(255,246,226,${0.25 * show})`); halo.addColorStop(1, 'rgba(255,246,226,0)');
      c.fillStyle = halo; c.beginPath(); c.arc(x, y, r * 2, 0, 6.2832); c.fill();
      c.strokeStyle = `rgba(255,246,226,${0.75 * show})`; c.lineWidth = r * 0.6; c.lineCap = 'round';
      const mid = side < 0 ? Math.PI : 0;
      c.beginPath(); c.arc(x - side * r, y, r, mid - 1.1, mid + 1.1); c.stroke();
    }
  }

  _drawJar(c, j, W, H, beckon = 0){
    const lift = j.lifting ? Math.pow(j.lifting, 2) * 0.5 : 0;
    const alpha = j.lifting ? Math.max(0, 1 - j.lifting / 1.2) : j.fade;
    if (alpha <= 0) return;
    const w = JAR_W * H, x = j.x * W, top = (JAR_MOUTH - lift) * H, bot = (JAR_BASE - lift) * H;
    c.save(); c.globalAlpha = alpha;
    if (beckon > 0 && !j.lifting){
      const g = c.createRadialGradient(x, top, 0, x, top, w * 3);
      g.addColorStop(0, `rgba(255,236,170,${0.15 + 0.25 * beckon})`); g.addColorStop(1, 'rgba(255,236,170,0)');
      c.fillStyle = g; c.fillRect(x - w * 3, top - w * 3, w * 6, w * 6);
    }
    const k = j.count / JAR_FULL;
    /* Glow inside, then the glass over it. */
    if (k > 0){
      const g = c.createRadialGradient(x, (top + bot) / 2, 0, x, (top + bot) / 2, w * 2);
      g.addColorStop(0, `rgba(255,236,150,${0.25 + 0.6 * k})`); g.addColorStop(1, 'rgba(255,236,150,0)');
      c.fillStyle = g; c.fillRect(x - w * 2, top - w, w * 4, bot - top + w * 2);
      c.fillStyle = 'rgba(255,255,220,.95)';
      for (let n = 0; n < j.count; n++){
        const a = this.t * 1.3 + n * 2.1;
        c.beginPath();
        c.arc(x + Math.cos(a) * w * 0.55, bot - (bot - top) * (0.2 + 0.6 * ((n * 0.37 + Math.sin(a) * 0.1) % 1)), Math.max(1.5, H * 0.003), 0, 6.2832);
        c.fill();
      }
    }
    c.fillStyle = 'rgba(190,220,255,.13)';
    c.strokeStyle = 'rgba(210,235,255,.65)'; c.lineWidth = Math.max(2, H * 0.003);
    c.beginPath();
    c.moveTo(x - w * 0.7, top);
    c.quadraticCurveTo(x - w * 1.05, top + (bot - top) * 0.15, x - w, top + (bot - top) * 0.3);
    c.lineTo(x - w, bot - w * 0.25); c.quadraticCurveTo(x - w, bot, x - w * 0.75, bot);
    c.lineTo(x + w * 0.75, bot); c.quadraticCurveTo(x + w, bot, x + w, bot - w * 0.25);
    c.lineTo(x + w, top + (bot - top) * 0.3);
    c.quadraticCurveTo(x + w * 1.05, top + (bot - top) * 0.15, x + w * 0.7, top);
    c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = Math.max(2, w * 0.12);
    c.beginPath(); c.moveTo(x - w * 0.65, top + (bot - top) * 0.35); c.lineTo(x - w * 0.65, bot - w * 0.4); c.stroke();
    /* The open mouth: a band of twine around the neck. */
    c.fillStyle = 'rgba(190,150,100,.9)';
    c.fillRect(x - w * 0.78, top - w * 0.08, w * 1.56, w * 0.16);
    c.restore();
  }

  _sparkle(x, y, n, golden){
    for (let i = 0; i < n; i++){
      const a = Math.random() * 6.28, s = 0.05 + Math.random() * 0.08;
      this.sparks.push({ x, y, vx: Math.cos(a) * s * 0.56, vy: Math.sin(a) * s, age: 0, life: 0.6, golden });
    }
  }
  _stepSparks(dt){
    for (const s of this.sparks){ s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.sparks = this.sparks.filter(s => s.age < s.life);
  }
  _drawSparks(c, W, H){
    for (const s of this.sparks){
      c.globalAlpha = 1 - s.age / s.life;
      c.fillStyle = s.golden ? '#ffd24a' : '#eaffb0';
      c.beginPath(); c.arc(s.x * W, s.y * H, Math.max(1.5, H * 0.003), 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }

  _look(){
    let sum = 0, n = 0;
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (p.present && p.centre){ sum += p.centre.x; n++; }
    }
    return n ? sum / n : 0.5;
  }

  /* Cooperative: nothing to show but the clock. */
  hud(){ return { score: this.caught, showLives: false, hideScore: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) rows.push({ label: `Player ${i + 1}`, value: this.caught[i], color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.players < 2 ? null : -1; }
  value(){ return this.collected; }
}

/* Two to four ribbons a round, at random moments after the opening, never
   within thirty seconds of each other or in the last stretch. */
export function planRibbons(){
  const n = 2 + Math.floor(Math.random() * 3), out = [];
  for (let k = 0; k < n; k++){
    for (let tries = 0; tries < 20; tries++){
      const at = OPENING + 15 + Math.random() * (FINALE - 30 - OPENING - 15);
      if (out.every(r => Math.abs(r.at - at) >= 30)){ out.push({ at, done: false }); break; }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
