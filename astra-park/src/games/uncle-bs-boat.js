import { clamp } from './common.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { FaceCam } from '../ui/faces.js';
import { drawKid, drawPup } from './fire-truck-art.js';
import { SPECIES, byId, pickSpecies, drawFish } from './fishing-fish.js';
import { WATER, SEATS, UNCLE_X, drawLake, drawWeeds, drawSurface, drawBoatBack, drawBoatFront,
         drawUncle, drawCrew, drawRod, drawLine, drawRipple } from './fishing-art.js';

/* Uncle B's Boat, named for the children's uncle, who loves fishing. A calm
   day out on the lake in his rowboat: he sits in the middle in his khaki
   cap, the children either side with their own rods and their real faces
   under bucket hats, and below them the clear water is full of fish to
   watch go by - perch and trout and catfish, and now and then something
   magical: a glowing lantern fish, a rainbow fish, a tiny whale, the golden
   one.

   Fishing is like the real thing. Swing an arm to cast: the harder the
   swing, the further out the line goes. Raise or lower that hand to bring
   the hook up or let it down deeper. Fish come to look; the bobber dips as
   they nibble, then plunges - one's on! Roll your hands round and round to
   reel it in. Up it comes, held big in the middle for everyone to admire,
   while Uncle B cheers; then it's let go, and its picture goes in Uncle B's
   fish book. At the end, the whole book: every fish found, and outlines of
   the ones still out there.

   Uncle B shows how without a word: first thing, he casts, waits, gets a
   bite, reels it in and holds it up. If a child's rod sits still a while, a
   ghostly arc over their seat shows the swing; if a fish is on and nobody's
   reeling, circling arrows show the roll. No fish is ever lost for good -
   one that gets away just swims off, and there are always more. */

export const ROUND = 300;
export const FINALE = ROUND - 12;
export const OPENING = 30;
export const CAST_SPEED = 1.5;       /* screen widths a second: a swing, not a wave */
export const REEL_RATE = 0.42;       /* reel per second at full rolling: about two and a half seconds */
export const ESCAPE = 8;             /* seconds a hooked fish waits for reeling before it swims off */
export const ADMIRE = 3.2;
export const LOOK = 0.16;            /* screen heights: how far a fish notices a hook */
const FLY = 0.6, NIBBLE = 0.7, HINT_AFTER = 6;

export default {
  id: 'uncle-bs-boat', name: "Uncle B's Boat", stars: 1, accent: '#4bb3c9', secs: ROUND,
  create(n){ return new Boat(n); }
};

const rodOf = () => ({ state: 'ready', x: 0, hookY: WATER, fly: 0, fish: null, reel: 0, idle: 0, nibbles: 0, nib: 0, dip: 0, still: 0, turn: 0, lastAng: null, hookFrom: null });

class Boat {
  constructor(players){
    this.players = players;
    this.t = 0; this.over = false;
    this.rods = [rodOf(), rodOf()];
    this.fish = [];
    this.admire = [];             /* catches waiting to be shown, first is showing */
    this.book = new Set();
    this.caught = 0;
    this.bits = [];
    this.ripples = [];
    this.spawn = 0;
    this.faces = new FaceCam();
    /* Uncle B's own fishing: a short show at the start, again if nobody fishes. */
    this.uncle = { state: 'wait', t: 0, rod: rodOf(), pose: 'idle', k: 0, shows: 0 };
    this.quiet = 0;
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
      f.swim += dt * (f.state === 'hooked' ? 14 : 5);
      if (f.state === 'swim'){
        f.x += f.dir * f.speed * dt;
        f.y += Math.sin(this.t * 0.6 + f.wob) * 0.004 * dt;
        f.y = clamp(f.y, f.sp.depth[0] - 0.04, f.sp.depth[1] + 0.02);
        if (Math.random() < dt * 0.04) f.dir = -f.dir;
      } else if (f.state === 'curious'){
        /* Over to look at the hook, nose first. */
        /* It swims to where its nose meets the hook. */
        const r = f.rod;
        f.dir = r.x > f.x ? 1 : -1;
        const tx = r.x - f.dir * f.sp.len * 0.45 * H / W, ty = r.hookY;
        const dx = (tx - f.x) * W / H, dy = ty - f.y, d = Math.hypot(dx, dy);
        if (d > 0.002){ const v = Math.min(d, 0.14 * dt) / d; f.x += dx * v * H / W; f.y += dy * v; }
        if (r.state !== 'waiting' || r.fish !== f){ f.state = 'swim'; f.rod = null; }
      } else if (f.state === 'hooked'){
        const r = f.rod;
        f.x = r.x - f.dir * f.sp.len * 0.45 * H / W + Math.sin(this.t * 9) * 0.004;
        f.y = r.hookY + Math.sin(this.t * 7) * 0.006;
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
    this._swim(dt, W, H);
    for (let i = 0; i < this.players; i++) this._rod(i, dt, W, H);
    this._uncle(dt, W, H);
    this._admire(dt);
    this._stepBits(dt);
    if (this.t >= FINALE && !this.finaleGold){ this.finaleGold = true; const g = this._fish(false, byId.golden); g.y = 0.55; this._fish(false, byId.rainbow); }
  }

  /* The hand that's doing the fishing: whichever is moving faster. */
  _hand(i){
    const p = pose.players[i];
    if (!p.present) return null;
    return p.hands.right.speed >= p.hands.left.speed || pose.mouse.active ? p.hands.right : p.hands.left;
  }

  /* How hard a child is reeling, 0..1: hands going round. Speed counts, and
     turning - the way the movement keeps changing direction - counts more,
     so a circle reels and a straight push barely does. */
  _reelPower(r, h, dt){
    const ang = Math.atan2(h.vy || 0, h.vx || 0);
    let turn = 0;
    if (r.lastAng != null && (h.speed || 0) > 0.15){
      let d = ang - r.lastAng; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      turn = Math.abs(d) / Math.max(dt, 1e-3);
    }
    r.lastAng = ang;
    r.turn += (Math.min(1, turn / 5) - r.turn) * Math.min(1, dt * 6);
    return Math.min(1, (h.speed || 0) / 0.7) * (0.25 + 0.75 * r.turn);
  }

  _rod(i, dt, W, H){
    const r = this.rods[i], h = this._hand(i), side = SEATS[i].side;
    if (!h){ r.still = 0; return; }
    r.still += dt;
    if (r.state === 'ready'){
      if ((h.speed || 0) > CAST_SPEED){
        /* The harder the swing, the further out it lands. */
        const power = clamp((h.speed - CAST_SPEED) / 2, 0, 1);
        r.x = clamp(SEATS[i].x + side * (0.1 + 0.2 * power), 0.04, 0.96);
        r.state = 'flying'; r.fly = 0; r.still = 0;
        sfx.whoosh();
      }
    } else if (r.state === 'flying'){
      r.fly += dt / FLY;
      if (r.fly >= 1){ r.state = 'waiting'; r.hookY = WATER + 0.02; r.nib = 0; r.nibbles = 0; r.fish = null; sfx.plop(); this._ripple(r.x, WATER); }
    } else if (r.state === 'waiting'){
      /* Lower the hand to let the line down deeper, raise it to bring it up. */
      const want = WATER + 0.06 + clamp((h.y - 0.25) / 0.55, 0, 1) * (0.9 - WATER - 0.06);
      r.hookY += clamp(want - r.hookY, -0.12 * dt, 0.12 * dt);
      this._attract(r, dt, W, H, this.t < OPENING ? 0.6 : 1);
      r.dip = Math.max(0, r.dip - dt * 3);
    } else if (r.state === 'hooked'){
      const power = this._reelPower(r, h, dt);
      if (power > 0.3){ r.reel = Math.min(1, r.reel + power * REEL_RATE * dt); r.idle = 0; r.still = 0; if ((r.click = (r.click || 0) - dt) <= 0){ r.click = 0.1; sfx.reel(); } }
      else r.idle += dt;
      /* Reeling brings the hook - and the fish - up toward the boat. */
      const from = r.hookFrom, to = { x: SEATS[i].x + side * 0.06, y: WATER + 0.02 };
      r.x = from.x + (to.x - from.x) * r.reel; r.hookY = from.y + (to.y - from.y) * r.reel;
      if (r.reel >= 1) this._land(i, r);
      else if (r.idle > ESCAPE){ this._getAway(r); }
    } else if (r.state === 'resting'){
      r.fly -= dt;
      if (r.fly <= 0){ r.state = 'ready'; r.still = 0; }
    }
  }

  /* A fish nearby notices the hook, comes over, nibbles once or twice, and
     bites. */
  _attract(r, dt, W, H, eager){
    if (!r.fish){
      const near = this.fish.filter(f => f.state === 'swim' && Math.hypot((f.x - r.x) * W / H, f.y - r.hookY) < LOOK + f.sp.len)
        .sort((a, b) => Math.abs(a.y - r.hookY) - Math.abs(b.y - r.hookY))[0];
      if (near && Math.random() < dt * 1.5 / eager){ near.state = 'curious'; near.rod = r; r.fish = near; r.nibbles = 1 + Math.floor(Math.random() * 3); r.nib = NIBBLE; }
      return;
    }
    const f = r.fish, close = Math.hypot((f.x + f.dir * f.sp.len * 0.45 * H / W - r.x) * W / H, f.y - r.hookY) < 0.03;
    if (!close) return;
    r.nib -= dt;
    if (r.nib > 0) return;
    if (r.nibbles > 0){ r.nibbles--; r.nib = NIBBLE; r.dip = 0.5; sfx.nibble(); return; }
    /* It's on! */
    f.state = 'hooked'; f.rod = r;
    r.state = 'hooked'; r.reel = 0; r.idle = 0; r.dip = 1; r.hookFrom = { x: r.x, y: r.hookY }; r.lastAng = null; r.turn = 0;
    sfx.splash();
    this._ripple(r.x, WATER);
    for (let k = 0; k < 8; k++) this._bit('bubble', r.x, r.hookY);
  }

  _getAway(r){
    const f = r.fish;
    if (f){ f.state = 'away'; f.rod = null; for (let k = 0; k < 6; k++) this._bit('bubble', f.x, f.y); }
    r.fish = null; r.state = 'waiting'; r.reel = 0; r.idle = 0;
  }

  _land(who, r){
    const f = r.fish;
    f.state = 'gone';
    r.fish = null; r.state = 'resting'; r.fly = ADMIRE * 0.6; r.reel = 0;
    const isNew = who >= 0 && !this.book.has(f.sp.id);
    if (who >= 0){ this.book.add(f.sp.id); this.caught++; }
    this.admire.push({ sp: f.sp, t: 0, who, isNew });
    sfx.splash(); this._ripple(r.x, WATER);
    for (let k = 0; k < 14; k++) this._bit('drop', r.x, WATER);
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

  /* ---------- Uncle B's own fishing, which shows how ---------- */

  _uncle(dt, W, H){
    const u = this.uncle, r = u.rod;
    u.t += dt;
    const anyone = this.rods.slice(0, this.players).some(rd => rd.state !== 'ready');
    this.quiet = anyone ? 0 : this.quiet + dt;
    if (u.state === 'wait'){
      u.pose = this.admire.length ? 'cheer' : 'idle';
      /* First thing in the round, and again whenever nobody has fished for a while. */
      if ((u.shows === 0 && this.t > 1.5) || (this.quiet > 20 && !this.admire.length)){ u.state = 'cast'; u.t = 0; u.shows++; this.quiet = 0; }
    } else if (u.state === 'cast'){
      u.pose = 'cast'; u.k = Math.min(1, u.t / 0.9);
      if (u.t >= 0.9){ u.state = 'line'; u.t = 0; r.x = UNCLE_X + 0.07; r.hookY = WATER + 0.02; sfx.plop(); this._ripple(r.x, WATER); }
    } else if (u.state === 'line'){
      u.pose = 'idle';
      r.hookY = Math.min(0.6, r.hookY + 0.08 * dt);
      /* A friendly bluegill comes along for the demonstration. */
      if (u.t > 1.2 && !r.fish){ const f = this._fish(false, byId.bluegill); f.x = r.x + 0.12; f.y = r.hookY; f.dir = -1; f.state = 'curious'; f.rod = r; r.fish = f; r.state = 'waiting'; r.nibbles = 2; r.nib = NIBBLE; }
      if (r.fish && r.fish.state === 'curious') this._attract(r, dt, W, H, 1);
      if (r.state === 'hooked'){ u.state = 'reel'; u.t = 0; r.hookFrom = { x: r.x, y: r.hookY }; }
      if (u.t > 12){ u.state = 'wait'; r.state = 'ready'; if (r.fish){ r.fish.state = 'swim'; r.fish = null; } }
    } else if (u.state === 'reel'){
      u.pose = 'reel'; u.k += dt * 8;
      r.reel = Math.min(1, u.t / 2.6);
      r.x = r.hookFrom.x + (UNCLE_X + 0.04 - r.hookFrom.x) * r.reel; r.hookY = r.hookFrom.y + (WATER + 0.02 - r.hookFrom.y) * r.reel;
      if ((r.click = (r.click || 0) - dt) <= 0){ r.click = 0.12; sfx.reel(); }
      if (r.reel >= 1){ this._land(-1, r); u.state = 'wait'; r.state = 'ready'; }
    }
    u.rod.dip = Math.max(0, u.rod.dip - dt * 3);
  }

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

  /* ---------- the ending: Uncle B's fish book ---------- */

  outro(dt, W, H){
    if (!this.out){ this.out = { t: 0, shown: 0 }; this.admire = []; }
    const o = this.out;
    o.t += dt; this.t += dt;
    this.faces.step(dt);
    this._swim(dt, W, H);
    this._stepBits(dt);
    /* The pages fill in one by one, a chime for each fish found. */
    const found = SPECIES.filter(s => this.book.has(s.id));
    const n = Math.min(found.length, Math.floor((o.t - 0.8) / 0.35) + 1);
    if (o.t > 0.8 && n > o.shown){ o.shown = n; sfx.jar(n); }
    this.uncle.pose = 'cheer';
    return o.t > Math.max(6, 1.5 + found.length * 0.35 + 3);
  }

  /* ---------- drawing ---------- */

  draw(c, W, H){
    drawLake(c, W, H, this.t, Math.min(1, this.t / ROUND));
    const swimmers = this.fish.filter(f => f.state !== 'gone').sort((a, b) => b.y - a.y);
    for (const f of swimmers) drawFish(c, f.sp, f.x * W, f.y * H, f.sp.len * H, f.swim, f.dir);
    drawWeeds(c, W, H, this.t);
    for (const b of this.bits) if (b.kind === 'bubble'){ c.strokeStyle = `rgba(255,255,255,${0.6 * (1 - b.age / b.life)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x * W, b.y * H, H * (0.004 + b.r * 0.006), 0, 6.2832); c.stroke(); }
    drawSurface(c, W, H, this.t);
    for (const r of this.ripples) drawRipple(c, r.x * W, r.y * H, r.age, H);

    drawBoatBack(c, W, H, this.t);
    const u = this.uncle, uh = drawUncle(c, W, H, this.t, this.out ? 'cheer' : u.pose, u.k);
    const hands = [0, 1].map(seat => this._drawSeat(c, seat, W, H));
    drawBoatFront(c, W, H, this.t);

    /* Uncle B's rod and line, when he's fishing. */
    if (!this.out){
      const tip = drawRod(c, uh[1], u.state === 'cast' ? -2.4 + u.k * 1.5 : -1.0, H * 0.18, H);
      if (u.state === 'line' || u.state === 'reel') drawLine(c, tip, { x: u.rod.x * W, y: WATER * H }, { x: u.rod.x * W, y: u.rod.hookY * H }, H, this.t, u.rod.dip);
      for (let i = 0; i < this.players; i++) if (hands[i]) this._drawRod(c, i, hands[i], W, H);
    }
    for (const b of this.bits) if (b.kind === 'drop'){ c.fillStyle = `rgba(220,245,255,${1 - b.age / b.life})`; c.beginPath(); c.arc(b.x * W, b.y * H, H * 0.006, 0, 6.2832); c.fill(); }

    if (!this.out){ this._drawHints(c, W, H, hands); this._drawFound(c, W, H); }
    if (this.admire[0]) this._drawAdmire(c, this.admire[0], W, H);
    if (this.out) this._drawBook(c, W, H);
  }

  /* Each seat: a child with their face, or with one child, the dalmatian. */
  _drawSeat(c, seat, W, H){
    const who = this.players >= 2 ? seat : (seat === 0 ? 0 : -1);
    const present = who >= 0 && pose.players[who].present;
    const r = this.rods[seat];
    const poseName = this.out || (this.admire[0] && this.admire[0].who === seat) ? 'cheer' : r.state === 'flying' ? 'cast' : r.state === 'hooked' ? 'reel' : 'idle';
    const k = r.state === 'flying' ? r.fly : this.t * 8;
    if (who < 0){ drawCrew(c, W, H, this.t, seat, '#e8413c', (x, y, rr) => drawPup(c, x, y + rr * 0.1, rr * 0.95, this.t + seat), 'idle'); return null; }
    return drawCrew(c, W, H, this.t, seat, PLAYER_COLORS[who], (x, y, rr) => {
      if (present && this.faces.has(who)) this.faces.draw(c, who, x, y, rr);
      else drawKid(c, x, y + rr * 0.08, rr * 0.95, this.t + who, who ? '#c98f6a' : '#e9b892');
    }, poseName, k);
  }

  _drawRod(c, i, hand, W, H){
    const r = this.rods[i], side = SEATS[i].side;
    let ang = side > 0 ? -0.6 : Math.PI + 0.6;
    if (r.state === 'flying') ang = side > 0 ? -2.2 + r.fly * 1.6 : Math.PI + 2.2 - r.fly * 1.6;
    if (r.state === 'hooked') ang += side * Math.sin(this.t * 12) * 0.05 + side * 0.25 * (1 - r.reel);
    const tip = drawRod(c, hand, ang, H * 0.22, H);
    if (r.state === 'flying'){
      /* The hook in flight, arcing out over the water. */
      const u = r.fly, x = tip.x + (r.x * W - tip.x) * u, y = tip.y + (WATER * H - tip.y) * u - Math.sin(u * Math.PI) * H * 0.12;
      drawLine(c, tip, { x, y }, null, H, this.t);
    } else if (r.state === 'waiting' || r.state === 'hooked'){
      const bob = { x: r.x * W, y: WATER * H };
      drawLine(c, tip, bob, { x: r.x * W, y: r.hookY * H }, H, this.t, r.state === 'hooked' ? 0.8 + Math.sin(this.t * 14) * 0.3 : r.dip);
    }
  }

  /* Without words: an arc over a child's seat to show the cast, circling
     arrows round their hands when a fish is on and nobody's reeling. */
  _drawHints(c, W, H, hands){
    for (let i = 0; i < this.players; i++){
      const r = this.rods[i], h = hands[i];
      if (!h || !pose.players[i].present) continue;
      const side = SEATS[i].side;
      c.save(); c.strokeStyle = 'rgba(255,246,226,.85)'; c.fillStyle = 'rgba(255,246,226,.85)'; c.lineWidth = H * 0.008; c.lineCap = 'round';
      if (r.state === 'ready' && r.still > HINT_AFTER && this.uncle.state === 'wait'){
        const u = (this.t % 1.4) / 1.4, cx = h.x, cy = h.y - H * 0.12, R = H * 0.1;
        const a0 = side > 0 ? -2.6 : -0.55, a1 = side > 0 ? -0.4 : -2.75;
        c.globalAlpha = Math.min(1, u * 3) * (1 - Math.max(0, u - 0.8) * 5);
        c.beginPath(); c.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1)); c.stroke();
        const ae = a0 + (a1 - a0) * Math.min(1, u * 1.2), ex = cx + Math.cos(ae) * R, ey = cy + Math.sin(ae) * R;
        c.beginPath(); c.arc(ex, ey, H * 0.016, 0, 6.2832); c.fill();
      } else if (r.state === 'hooked' && r.idle > 1.5){
        const cx = h.x, cy = h.y, R = H * 0.06, a = this.t * 5;
        for (let k = 0; k < 2; k++){
          const s = a + k * Math.PI;
          c.beginPath(); c.arc(cx, cy, R, s, s + 2.2); c.stroke();
          const ex = cx + Math.cos(s + 2.2) * R, ey = cy + Math.sin(s + 2.2) * R;
          c.beginPath(); c.arc(ex, ey, H * 0.012, 0, 6.2832); c.fill();
        }
      }
      c.restore();
    }
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
