import { clamp } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { drawKid, KID_SKINS } from '../ui/kids.js';
import { SPECIES, byId, pickSpecies, drawFish } from './fishing-fish.js';
import { WATER, UNCLE_X, seatsFor, drawLake, drawWeeds, drawSurface, drawBoatBack, drawBoatFront,
         drawUncle, drawCrew, drawRod, drawLine, drawRipple, drawPalm } from './fishing-art.js';

/* Uncle B's Boat, named for the children's uncle, who loves fishing. A calm
   day out on the lake in his rowboat: he sits in the middle in his khaki
   cap with his rod, the children either side with their real faces under
   bucket hats, and below them the clear water is full of fish to watch go
   by - perch and trout and catfish, and now and then something magical: a
   glowing lantern fish, a rainbow fish, a tiny whale, the golden one.

   The children catch them with their hands. Their hands glow in the water
   in their colours; bring both together into a cup and the fish come over
   to look. Close the cup round one to scoop it up, then lift it out of the
   water: up it comes, held big in the middle for everyone to admire, while
   Uncle B cheers; then it's let go, and its picture goes in Uncle B's fish
   book. Open your hands on the way up and it just swims off - there are
   always more. At the end, the whole book: every fish found, and outlines
   of the ones still out there.

   It shows itself without a word: a pair of ghostly hands closes round a
   fish and lifts it out, first thing and again whenever nobody has caught
   one for a while. Uncle B keeps his line in the water for company - the
   catching is the children's - and cheers every fish they bring up. */

export const ROUND = 300;
export const FINALE = ROUND - 12;
export const OPENING = 30;
export const ADMIRE = 3.2;
/* Two hands closer than this - in screen heights - make a cup. */
export const CUP_GAP = 0.14;
/* Hands can drift apart for this long without the cup opening, so a wobble
   on the way up doesn't drop the fish. */
export const CUP_GRACE = 0.35;
/* How close a cup must come to a fish's body to scoop it. */
export const SCOOP = 0.05;
/* How far a fish notices a cupped hand, and swims over to see. */
export const CURIOUS = 0.24;
/* The ghostly hands: a few seconds in, and again after a long while with
   nothing caught. */
export const HINT_FIRST = 1.5, HINT_AGAIN = 40, HINT_LOOP = 6;

export default {
  id: 'uncle-bs-boat', name: "Uncle B's Boat", stars: 1, accent: '#4bb3c9', secs: ROUND,
  /* The moves it uses, shown as pictures on the home screen. */
  moves: ['cup'],
  create(n){ return new Boat(n); }
};

const cupOf = () => ({ x: 0.5, y: 0.5, l: null, r: null, cupped: false, apart: 9, fish: null });

class Boat {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false;
    this.cups = pose.players.map(() => cupOf());
    this.fish = [];
    this.admire = [];             /* catches waiting to be shown, first is showing */
    this.book = new Set();
    this.caught = 0;
    this.bits = [];
    this.ripples = [];
    this.spawn = 0;
    this.faces = new FaceCam();
    /* Uncle B's own fishing: a short show at the start, again if nobody fishes. */
    this.lastCatch = 0;           /* when a child last lifted a fish out */
    this.hint = -1;               /* seconds into the ghostly hands, or -1 */
    this.out = null;
    for (let i = 0; i < 6; i++) this._fish(true);
  }

  /* ---------- the fish ---------- */

  target(){ return this.t >= FINALE ? 13 : this.t < OPENING ? 7 : 8 + 3 * (this.t - OPENING) / (FINALE - OPENING); }

  _fish(anywhere = false, sp = null){
    sp = sp || pickSpecies(Math.random, this.t >= FINALE ? 5 : this.t > OPENING ? 1.4 : 0.6);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const f = { sp, dir, x: anywhere ? 0.05 + Math.random() * 0.9 : (dir > 0 ? -0.12 : 1.12),
                y: sp.depth[0] + Math.random() * (sp.depth[1] - sp.depth[0]),
                speed: 0.025 + Math.random() * 0.03, swim: Math.random() * 6.28, state: 'swim', rod: null, wob: Math.random() * 6.28 };
    this.fish.push(f);
    return f;
  }

  _swim(dt, W, H){
    for (const f of this.fish){
      f.swim += dt * (f.state === 'held' ? 14 : 5);
      if (f.state === 'swim'){
        /* A cupped hand in the water is interesting: over it comes, slowly,
           to have a look. */
        const cup = this._nearCup(f, W, H);
        if (cup){
          f.dir = cup.x > f.x ? 1 : -1;
          const dx = (cup.x - f.x) * W / H, dy = cup.y - f.y, d = Math.hypot(dx, dy);
          if (d > 0.02){ const v = Math.min(d, 0.07 * dt) / d; f.x += dx * v * H / W; f.y += dy * v; }
          continue;
        }
        f.x += f.dir * f.speed * dt;
        f.y += Math.sin(this.t * 0.6 + f.wob) * 0.004 * dt;
        f.y = clamp(f.y, f.sp.depth[0] - 0.04, f.sp.depth[1] + 0.02);
        if (Math.random() < dt * 0.04) f.dir = -f.dir;
      } else if (f.state === 'held'){
        /* Wriggling in the child's hands. */
        const cup = this.cups[f.who];
        f.x = cup.x + Math.sin(this.t * 11) * 0.003; f.y = cup.y + Math.sin(this.t * 7) * 0.004;
      } else if (f.state === 'away'){
        f.x += f.dir * 0.25 * dt;
      }
    }
    this.fish = this.fish.filter(f => f.state !== 'gone' && f.x > -0.3 && f.x < 1.3);
    this.spawn -= dt;
    if (this.spawn <= 0 && this.fish.filter(f => f.state === 'swim').length < this.target()){ this.spawn = this.t >= FINALE ? 0.4 : 1.5; this._fish(); }
  }

  /* ---------- the loop ---------- */

  step(dt, W, H){
    this.t += dt;
    this.faces.step(dt);
    this._cups(dt, W, H);
    this._swim(dt, W, H);
    this._admire(dt);
    this._stepHint(dt);
    this._stepBits(dt);
    if (this.t >= FINALE && !this.finaleGold){ this.finaleGold = true; const g = this._fish(false, byId.golden); g.y = 0.55; this._fish(false, byId.rainbow); }
  }

  /* ---------- the children's hands ---------- */

  _cups(dt, W, H){
    for (let i = 0; i < this.cups.length; i++){
      const p = pose.players[i], cup = this.cups[i];
      if (i >= this.players || !p.present){ cup.l = cup.r = null; this._open(cup); continue; }
      const l = pose.mouse.active ? p.hands.right : p.hands.left, r = p.hands.right;
      cup.l = l; cup.r = r;
      cup.x = (l.x + r.x) / 2; cup.y = (l.y + r.y) / 2;
      const gap = Math.hypot((l.x - r.x) * W / H, l.y - r.y);
      /* The mouse is one hand, so it is always a cup. */
      if (pose.mouse.active || gap < CUP_GAP){ cup.apart = 0; cup.cupped = true; }
      else { cup.apart += dt; if (cup.apart > CUP_GRACE) this._open(cup); }
      if (!cup.cupped) continue;
      if (!cup.fish){
        if (cup.y < WATER + 0.02) continue;
        const f = this.fish.filter(f => f.state === 'swim' && this._reach(f, cup, W, H) < SCOOP)
          .sort((a, b) => this._reach(a, cup, W, H) - this._reach(b, cup, W, H))[0];
        if (f){
          f.state = 'held'; f.who = i; cup.fish = f;
          sfx.plop();
          for (let k = 0; k < 8; k++) this._bit('bubble', cup.x, cup.y);
        }
      } else if (cup.y < WATER - 0.03){
        /* Out of the water: caught! */
        const f = cup.fish;
        cup.fish = null;
        this.lastCatch = this.t;
        this._land(i, f, cup.x);
      }
    }
  }

  /* How far a cup is from a fish's body - its length, not just its middle. */
  _reach(f, cup, W, H){
    return Math.max(0, Math.hypot((f.x - cup.x) * W / H, f.y - cup.y) - f.sp.len * 0.35);
  }

  /* The cupped hand in the water a fish is close enough to notice, if any. */
  _nearCup(f, W, H){
    let best = null, bd = CURIOUS;
    for (let i = 0; i < this.players; i++){
      const cup = this.cups[i];
      if (!cup.cupped || cup.fish || cup.y < WATER + 0.02) continue;
      const d = this._reach(f, cup, W, H);
      if (d < bd){ bd = d; best = cup; }
    }
    return best;
  }

  /* Hands apart for too long: the fish slips out and swims off. */
  _open(cup){
    const f = cup.fish;
    if (f){
      f.state = 'away'; f.dir = Math.random() < 0.5 ? 1 : -1; f.who = null;
      f.y = Math.max(f.y, WATER + 0.04);
      for (let k = 0; k < 6; k++) this._bit('bubble', f.x, f.y);
      sfx.plop();
    }
    cup.fish = null; cup.cupped = false;
  }

  /* A fish out of the water: held up for everyone, and into the book. */
  _land(who, f, x){
    f.state = 'gone';
    const isNew = !this.book.has(f.sp.id);
    this.book.add(f.sp.id); this.caught++;
    this.admire.push({ sp: f.sp, t: 0, who, isNew });
    sfx.splash(); this._ripple(x, WATER);
    for (let k = 0; k < 14; k++) this._bit('drop', x, WATER);
  }

  /* One catch at a time, held up big, then let go back into the lake. */
  _admire(dt){
    const a = this.admire[0];
    if (!a) return;
    if (a.t === 0) sfx.hooray();
    /* A new page in the book gets its own little run of bells. */
    if (a.isNew && a.t < 0.3 && a.t + dt >= 0.3) sfx.rainbow();
    a.t += dt;
    if (a.t >= ADMIRE){
      this.admire.shift();
      const f = this._fish(false, a.sp); f.x = 0.5; f.y = WATER + 0.08; f.state = 'away'; f.dir = Math.random() < 0.5 ? 1 : -1;
      sfx.plop(); this._ripple(0.5, WATER);
    }
  }

  get showing(){ return this.admire[0] || null; }

  /* ---------- little things ---------- */

  _ripple(x, y){ this.ripples.push({ x, y, age: 0 }); }
  _bit(kind, x, y){
    const a = Math.random() * 6.28;
    const b = { kind, x, y, age: 0, life: kind === 'bubble' ? 1.6 : 0.8, vx: 0, vy: 0, r: Math.random() };
    if (kind === 'bubble'){ b.vx = (Math.random() - 0.5) * 0.02; b.vy = -0.08 - Math.random() * 0.06; }
    else { b.vx = Math.cos(a) * 0.12; b.vy = -0.2 - Math.random() * 0.25; }
    this.bits.push(b);
    if (this.bits.length > 300) this.bits.shift();
  }
  _stepBits(dt){
    for (const b of this.bits){ b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.kind === 'drop') b.vy += 0.9 * dt; if (b.kind === 'bubble' && b.y < WATER) b.age = b.life; }
    this.bits = this.bits.filter(b => b.age < b.life);
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter(r => r.age < 1.6);
    if (Math.random() < dt * 3) this._bit('bubble', Math.random(), 0.95);
  }

  /* ---------- showing how ---------- */

  _stepHint(dt){
    /* Someone with a fish in hand has got it; the ghost gets out of their
       way. A loop that has started otherwise plays to its end. */
    if (this.cups.some(c => c.fish) || this.out){ this.hint = -1; return; }
    /* A short rest between loops, so it doesn't nag. */
    this.hintRest = Math.max(0, (this.hintRest || 0) - dt);
    const due = this.t < FINALE && this.t - this.lastCatch > (this.caught ? HINT_AGAIN : HINT_FIRST)
      && !this.admire.length && !this.hintRest;
    if (this.hint >= 0){
      this.hint += dt;
      if (this.hint >= HINT_LOOP){ this.hint = -1; this.hintRest = 2.5; }
    } else if (due) this.hint = 0;
  }

  get hinting(){ return this.hint >= 0; }

  /* ---------- the ending: Uncle B's fish book ---------- */

  outro(dt, W, H){
    if (!this.out){ this.out = { t: 0, shown: 0 }; this.admire = []; for (const cp of this.cups) this._open(cp); }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.faces.step(dt);
    this._swim(dt, W, H);
    this._stepBits(dt);
    /* The pages fill in one by one, a chime for each fish found. */
    const found = SPECIES.filter(s => this.book.has(s.id));
    const n = Math.min(found.length, Math.floor((o.t - 0.8) / 0.35) + 1);
    if (o.t > 0.8 && n > o.shown){ o.shown = n; sfx.jar(n); }
    return o.t > Math.max(6, 1.5 + found.length * 0.35 + 3);
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    drawLake(c, W, H, this.t, Math.min(1, this.t / ROUND));
    const swimmers = this.fish.filter(f => f.state !== 'gone' && f.state !== 'held').sort((a, b) => b.y - a.y);
    for (const f of swimmers) drawFish(c, f.sp, f.x * W, f.y * H, f.sp.len * H, f.swim, f.dir);
    drawWeeds(c, W, H, this.t);
    for (const b of this.bits) if (b.kind === 'bubble'){ c.strokeStyle = `rgba(255,255,255,${0.6 * (1 - b.age / b.life)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x * W, b.y * H, H * (0.004 + b.r * 0.006), 0, 6.2832); c.stroke(); }
    drawSurface(c, W, H, this.t);
    for (const r of this.ripples) drawRipple(c, r.x * W, r.y * H, r.age, H);

    drawBoatBack(c, W, H, this.t);
    const uh = drawUncle(c, W, H, this.t, this.out || this.admire.length ? 'cheer' : 'idle');
    /* A seat for each child who's here; they hop in and out as they come and
       go, and shuffle along to make room. */
    const aboard = [];
    for (let i = 0; i < this.players; i++) if (pose.players[i].present || (this.admire[0] && this.admire[0].who === i)) aboard.push(i);
    seatsFor(aboard.length).forEach((seat, k) => this._drawSeat(c, aboard[k], seat, W, H));
    drawBoatFront(c, W, H, this.t);

    /* Uncle B's line, out in the water for company, the bobber riding the
       little waves. He puts the rod down to cheer. */
    if (!this.out && !this.admire.length){
      const tip = drawRod(c, uh[1], -1.0, H * 0.18, H), x = (UNCLE_X + 0.34) * W;
      drawLine(c, tip, { x, y: WATER * H }, { x, y: H * 0.56 }, H, this.t, 0.15 + Math.sin(this.t * 1.7) * 0.15);
    }
    for (const b of this.bits) if (b.kind === 'drop'){ c.fillStyle = `rgba(220,245,255,${1 - b.age / b.life})`; c.beginPath(); c.arc(b.x * W, b.y * H, H * 0.006, 0, 6.2832); c.fill(); }

    if (!this.out){
      if (this.hint >= 0) this._drawHint(c, W, H);
      this._drawHands(c, W, H);
      this._drawFound(c, W, H);
    }
    if (this.admire[0]) this._drawAdmire(c, this.admire[0], W, H);
    if (this.out) this._drawBook(c, W, H);
  }

  /* Each child in their seat, with their own face. */
  _drawSeat(c, who, seat, W, H){
    const present = pose.players[who].present;
    const poseName = this.out || (this.admire[0] && this.admire[0].who === who) ? 'cheer' : 'idle';
    drawCrew(c, W, H, this.t, seat, PLAYER_COLORS[who], (x, y, rr) => {
      if (present && this.faces.has(who)) this.faces.draw(c, who, x, y, rr, PLAYER_COLORS[who]);
      else drawKid(c, x, y + rr * 0.08, rr * 0.95, this.t + who, KID_SKINS[who]);
    }, poseName);
  }

  /* Each child's hands, glowing in their colour, with whatever they're
     holding between them; a soft ring round a cup that's ready to scoop. */
  _drawHands(c, W, H){
    const r = H * 0.035;
    for (let i = 0; i < this.players; i++){
      const cup = this.cups[i], col = PLAYER_COLORS[i];
      if (!cup.l) continue;
      if (cup.fish){
        const f = cup.fish;
        drawFish(c, f.sp, f.x * W, f.y * H, f.sp.len * H, f.swim, f.dir);
      } else if (cup.cupped && cup.y > WATER){
        const g = c.createRadialGradient(cup.x * W, cup.y * H, 0, cup.x * W, cup.y * H, H * 0.09);
        g.addColorStop(0, col + '00'); g.addColorStop(0.7, col + '33'); g.addColorStop(1, col + '00');
        c.fillStyle = g; c.beginPath(); c.arc(cup.x * W, cup.y * H, H * 0.09, 0, 6.2832); c.fill();
      }
      /* Holding a fish, the palms sit either side of it, whatever its size. */
      const wide = cup.fish ? cup.fish.sp.len * 0.5 : 0;
      if (pose.mouse.active || cup.fish){
        const half = Math.max(wide, 0.03);
        for (const side of [-1, 1]) drawPalm(c, (cup.x + side * half * H / W) * W, cup.y * H, r, side < 0 ? 0 : Math.PI, col);
      } else {
        const a = Math.atan2((cup.r.y - cup.l.y) * H, (cup.r.x - cup.l.x) * W);
        drawPalm(c, cup.l.x * W, cup.l.y * H, r, a, col);
        drawPalm(c, cup.r.x * W, cup.r.y * H, r, a + Math.PI, col);
      }
    }
  }

  /* The demonstration: ghostly hands either side of a fish close round it
     and lift it up out of the water. */
  _drawHint(c, W, H){
    const u = this.hint, F = { x: 0.7, y: 0.62 }, sp = byId.bluegill;
    const ease = (a, b) => { const k = clamp((u - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    const show = Math.min(ease(0, 0.5), 1 - ease(4.4, 5));
    if (show <= 0) return;
    const close = ease(0.6, 1.4), lift = ease(1.8, 3.4);
    const x = F.x, y = F.y + (WATER - 0.1 - F.y) * lift;
    const gap = 0.16 - (0.16 - sp.len * 0.5) * close;
    c.save(); c.globalAlpha = show * 0.75;
    drawFish(c, sp, x * W + (u < 1.4 ? Math.sin(u * 3) * H * 0.006 : 0), y * H, sp.len * H, this.t * (lift > 0 ? 14 : 5), -1);
    c.restore();
    for (const side of [-1, 1]) drawPalm(c, (x + side * gap * H / W) * W, y * H, H * 0.035, side < 0 ? 0 : Math.PI, '#fff6e2', show * 0.8);
  }

  /* The fish found so far, small along the top: the start of the book. */
  _drawFound(c, W, H){
    const found = SPECIES.filter(s => this.book.has(s.id));
    found.forEach((sp, i) => {
      const x = W * 0.03 + H * 0.02 + i * H * 0.075, y = H * 0.05;
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x + H * 0.02, y, H * 0.032, 0, 6.2832); c.fill();
      drawFish(c, sp, x + H * 0.02, y, H * 0.05, this.t * 2 + i, 1);
    });
  }

  _drawAdmire(c, a, W, H){
    const k = Math.min(1, a.t / 0.4), out = Math.max(0, (a.t - (ADMIRE - 0.5)) / 0.5);
    const e = k * k * (3 - 2 * k), x = W * 0.5, y = H * (0.66 + out * 0.2), L = H * 0.42 * e * (1 - out * 0.5);
    c.save(); c.globalAlpha = 1 - out;
    /* A burst of light behind it. */
    c.save(); c.translate(x, y); c.rotate(this.t * 0.4);
    c.fillStyle = 'rgba(255,250,220,.22)';
    for (let i = 0; i < 12; i++){ c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(H * 0.42, -H * 0.05); c.lineTo(H * 0.42, H * 0.05); c.closePath(); c.fill(); }
    c.restore();
    const g = c.createRadialGradient(x, y, 0, x, y, H * 0.3);
    g.addColorStop(0, 'rgba(255,252,235,.85)'); g.addColorStop(1, 'rgba(255,252,235,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, H * 0.3, 0, 6.2832); c.fill();
    if (a.isNew){
      /* A ring of little stars: a new page in the book. */
      for (let i = 0; i < 10; i++){
        const ang = this.t * 0.8 + i * 0.628, rr = H * 0.26;
        c.fillStyle = '#ffd95a'; c.beginPath();
        for (let j = 0; j < 10; j++){ const aa = -Math.PI / 2 + j * Math.PI / 5, d = (j % 2 ? 0.45 : 1) * H * 0.016; c.lineTo(x + Math.cos(ang) * rr + Math.cos(aa) * d, y + Math.sin(ang) * rr * 0.7 + Math.sin(aa) * d); }
        c.fill();
      }
    }
    drawFish(c, a.sp, x, y + Math.sin(this.t * 2) * H * 0.01, Math.max(1, L), this.t * 4, Math.sin(a.t * 0.8) > -0.2 ? 1 : -1);
    c.restore();
  }

  /* Uncle B's fish book: a page for every fish in the lake, in colour if
     found and as a dark outline if it's still out there. */
  _drawBook(c, W, H){
    const o = this.out, k = Math.min(1, o.t / 0.8), e = k * k * (3 - 2 * k);
    const bw = W * 0.8, bh = H * 0.62, bx = W / 2 - bw / 2, by = H * 0.32 + (1 - e) * H * 0.7;
    c.save();
    c.fillStyle = 'rgba(10,20,40,.35)'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#8a5a3c'; c.beginPath(); c.roundRect(bx - H * 0.02, by - H * 0.02, bw + H * 0.04, bh + H * 0.04, H * 0.03); c.fill();
    c.fillStyle = '#fbf3e0'; c.beginPath(); c.roundRect(bx, by, bw, bh, H * 0.02); c.fill();
    c.strokeStyle = 'rgba(138,90,60,.35)'; c.lineWidth = H * 0.004; c.beginPath(); c.moveTo(W / 2, by + H * 0.02); c.lineTo(W / 2, by + bh - H * 0.02); c.stroke();
    const found = SPECIES.filter(s => this.book.has(s.id));
    const cols = 5, rows = Math.ceil(SPECIES.length / cols), cw = bw / cols, ch = bh / rows;
    SPECIES.forEach((sp, i) => {
      const cx = bx + cw * (i % cols + 0.5), cy = by + ch * (Math.floor(i / cols) + 0.5);
      const n = found.indexOf(sp), shown = n >= 0 && n < o.shown;
      c.fillStyle = shown ? 'rgba(255,236,170,.45)' : 'rgba(138,90,60,.08)';
      c.beginPath(); c.roundRect(cx - cw * 0.44, cy - ch * 0.42, cw * 0.88, ch * 0.84, H * 0.015); c.fill();
      const L = Math.min(cw * 0.75, ch * 1.3, sp.len * H * 2.4);
      drawFish(c, sp, cx, cy, L, this.t * 2 + i, 1, !shown);
    });
    c.restore();
  }

  /* Cooperative: nothing to show but the clock. */
  hud(){ return { score: [this.caught, this.caught], showLives: false, hideScore: true }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++) rows.push({ label: `Player ${i + 1}`, value: this.caught, color: PLAYER_COLORS[i] });
    return rows;
  }
  winner(){ return this.players < 2 ? null : -1; }
  value(){ return this.book.size; }
}
