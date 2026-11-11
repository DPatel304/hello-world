/* Last Known Position - the summit, at the very start of level 1.

   A cut-scene, played out in one small place - the crash site, high on a
   mountain - everything in it fixed where it is, the crew walking through
   it and the camera taking its shots (not the run's view yet):

     ship   a wide shot: on their feet in the grass, the crew walk over to
            the ship, crashed in a long furrow (SHIP)
     core   closer, at the ship: they look it over - Nova: the Star Core's
            gone, thrown clear; let's get up high and look (CORE at least)
     walk   behind them as they walk on up the slope, through the trees,
            to two boulders on the hilltop (WALK)
     climb  CLIMB! - each reach up, an arm at a time, pulls you up; a
            little by itself as well, and anyone left behind is helped
            up once the others are there (CLIMB at most)
     crest  the camera rising up past them - over the boulders, the whole
            world opening up below (CREST)
     look   a slow look across it; the title over it; Nova: follow the
            river (LOOK)
     slide  and down, onto the trail (SLIDE)

   The world's in metres: x across, z away from where they woke (the
   cliff edge at the far end of the hilltop, the valley below it); the
   camera a point, a height and a heading, looking level at the horizon. */
import { pose, L as LM } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { PAL } from './lkp-art.js';
import { worldOverlook, treeKind } from './lkp-world.js';
import { shipAt } from './lkp-places.js';
import { banner, smooth } from './lkp-zip.js';
import { TITLE } from './lkp-title.js';

export const SHIP = 7, CORE = 4, WALK = 9, CLIMB = 16, CREST = 4.5, LOOK = 16, SLIDE = 2.4;
export const PULL = 0.16, CREEP = 0.025, HELP = 0.35;
const TITLE_AT = 2.5, TITLE_END = 8.5, SAY_AT = 9.5;

/* ---- the place ---- */
export const PLACE = {
  wake: [0, 0],
  ship: { at: [16, 13], len: 15 },                         /* (its middle; nose to tail, metres) */
  byShip: [4, 9],                                    /* where they stop to look at it */
  rocks: [{ at: [13.4, 29], w: 3.6, h: 2.4, n: 1 }, { at: [16.4, 29.6], w: 3.1, h: 2.0, n: 5 }],
  edge: 34,                                               /* the cliff edge, beyond the rocks */
  trees: [[9.5, 27.5, 'pine', 1.1], [11, 31.5, 'round', 1], [19.5, 28, 'pine', 1.2], [20.5, 31, 'round', 0.9], [8.5, 24, 'round', 0.8], [21.5, 25, 'pine', 1],
          [-4, 14, 'round', 1], [-7, 22, 'pine', 1.2], [1, 24, 'round', 0.9], [26, 18, 'pine', 1.3], [28, 24, 'round', 1.1], [30, 14, 'pine', 1], [-10, 6, 'pine', 1.1], [24, 9, 'round', 1]],
  meadows: [[-3, 5, 4, 2.2, ['#ffc2e6', '#fff4c2']], [11, 22, 3, 1.6, ['#c9f7ff', '#fff4c2']], [22, 12, 3.4, 1.8, ['#ffc2e6', '#ffe39a']]],
  stream: [[12, 28], [10, 23], [6, 19], [2, 14], [-1, 8], [-5, 2], [-9, -6]],
  pond: [-6, 8, 2.6, 1.6],
  furrow: [[-6, 0], [2, 7], [8, 11], [12, 13]]
};
const CREW_M = 1.8;                                        /* (how tall they stand, metres) */
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

/* A reach up: either hand going up past the head (from the camera's
   landmarks; with the mouse, the hand going high), one reach at a time. */
export class ReachWatch {
  constructor(){ this.up = { l: false, r: false }; }
  step(p, mouse){
    let l = false, r = false;
    if (p.lm && p.lm[LM.NOSE]){
      const head = p.lm[LM.NOSE].y, wl = p.lm[LM.L_WRIST], wr = p.lm[LM.R_WRIST];
      l = !!(wl && (wl.v == null || wl.v > 0.4) && wl.y < head); r = !!(wr && (wr.v == null || wr.v > 0.4) && wr.y < head);
    } else if (mouse){ r = p.hands.right.y < 0.3; }
    const reached = (l && !this.up.l) || (r && !this.up.r);
    this.up = { l, r };
    return reached;
  }
}

export class Summit {
  constructor(game, talk = true){
    this.g = game; this.talk = talk;
    this.t = 0; this.pt = 0; this.phase = 'ship'; this.done = false;
    this.climb = pose.players.map(() => 0); this.pulled = pose.players.map(() => -9);
    this.reach = pose.players.map(() => new ReachWatch());
    this.said = false; this.titled = false; this.told = false;
    sfx.wind?.(0.5);
  }
  speed(){ return 0; }

  step(dt){
    const g = this.g, here = g.here;
    this.t += dt; this.pt += dt;
    const walking = this.phase === 'ship' || this.phase === 'walk';
    if (walking && Math.floor(this.t / 0.55) !== Math.floor((this.t - dt) / 0.55)) sfx.step?.(Math.floor(this.t * 2) % 3, 0.1);
    if (this.phase === 'ship'){
      if (this.pt >= SHIP){ this.phase = 'core'; this.pt = 0; }
    } else if (this.phase === 'core'){
      if (this.talk && !this.told && this.pt > 1){ this.told = true; const l = g.level.lines.shipCore; if (l) g.captain.say(l[0][1], l[0][2] || '', { story: true }); }
      if ((this.pt >= CORE && (!this.talk || (this.told && !g.captain.busy))) || this.pt > CORE + 14){ this.phase = 'walk'; this.pt = 0; }
    } else if (this.phase === 'walk'){
      if (this.pt >= WALK){ this.phase = 'climb'; this.pt = 0; sfx.pat?.(); }
    } else if (this.phase === 'climb'){
      for (const i of here){
        if (this.reach[i].step(pose.players[i], pose.mouse.active)){ this.climb[i] = Math.min(1, this.climb[i] + PULL); this.pulled[i] = this.t; sfx.pat?.(); }
        this.climb[i] = Math.min(1, this.climb[i] + CREEP * dt);
      }
      const top = here.filter(i => this.climb[i] >= 1).length;
      if (top > 0) for (const i of here) if (this.climb[i] < 1) this.climb[i] = Math.min(1, this.climb[i] + HELP * dt * top / here.length);
      if (here.every(i => this.climb[i] >= 1) || this.pt >= CLIMB){ for (const i of here) this.climb[i] = 1; this.phase = 'crest'; this.pt = 0; sfx.titleSwell?.(); sfx.whoosh?.(); sfx.wind?.(1); }
    } else if (this.phase === 'crest'){
      if (this.pt >= CREST){ this.phase = 'look'; this.pt = 0; }
    } else if (this.phase === 'look'){
      if (!this.titled && this.pt >= TITLE_AT){ this.titled = true; sfx.chime?.(1); }
      if (this.talk && !this.said && this.pt >= SAY_AT && !g.captain.busy){ this.said = true; const l = g.level.lines.summit; if (l) g.captain.say(l[0][1], l[0][2] || '', { polite: true, story: true }); }
      if (this.pt >= LOOK && (!this.talk || !g.captain.busy)){ this.phase = 'slide'; this.pt = 0; sfx.whoosh?.(); sfx.spring?.(1); }
    } else if (this.phase === 'slide'){
      if (this.pt >= SLIDE) this.done = true;
    }
  }

  /* ---------- where everyone is, and the camera ---------- */

  /* each of them: where they stand (x, z), how high up (y), which way they face (0: away up the hill), walking? */
  _crew(k, n){
    const off = (k - (n - 1) / 2) * 1.3, rock = PLACE.rocks[k % 2], ph = this.phase;
    const nearShip = [PLACE.byShip[0] + off, PLACE.byShip[1] - Math.abs(off) * 0.3];
    if (ph === 'ship'){ const u = smooth(Math.min(1, this.pt / (SHIP * 0.92))); const p = lerp2([PLACE.wake[0] + off, PLACE.wake[1] - Math.abs(off) * 0.3], nearShip, u); return { x: p[0], z: p[1], y: 0, walk: u < 0.99 }; }
    if (ph === 'core') return { x: nearShip[0], z: nearShip[1], y: 0, look: 0.5 + 0.15 * Math.sin(this.t * 0.6 + k) };
    const foot = [rock.at[0] + (k > 1 ? 0.9 : -0.6) * (k % 2 ? -1 : 1), rock.at[1] - rock.w * 0.42];
    if (ph === 'walk'){ const u = smooth(this.pt / WALK); const p = lerp2(nearShip, foot, u); return { x: p[0], z: p[1], y: 0, walk: u < 0.99 }; }
    /* the climb: up its face, to stand on top */
    const u = ph === 'climb' ? this.climb[this.g.here[k]] : 1;
    return { x: foot[0], z: lerp(foot[1], rock.at[1] - rock.w * 0.12, u), y: rock.h * 0.96 * u, climbing: u < 1 };
  }
  /* the camera: [x, z] it's at, how high, where it's looking ([x, z]) - each shot, and the moves between */
  _cam(){
    const ph = this.phase, n = this.g.here.length, mid = (f) => { let x = 0, z = 0; for (let k = 0; k < n; k++){ const p = this._crew(k, n); x += p.x; z += p.z; } return [x / n, z / n]; };
    const SHOTS = {
      /* a wide shot, from behind them and off to the left, low: them, the ship, the hill beyond */
      ship: (u) => ({ at: lerp2([-8, -9], [-5, -4], u), h: lerp(2.4, 2.8, u), to: [12, 16] }),
      /* closer, beside them, the ship filling the frame */
      core: (u) => ({ at: lerp2([-2.5, -0.5], [-1.6, 0.8], u), h: 1.7, to: [13, 13] }),
      /* following behind them up the slope, the boulders ahead */
      walk: (u) => { const m = mid(); return { at: [m[0] - 6, m[1] - 7], h: lerp(2.6, 2.2, u), to: [15, 30] }; },
      /* at the foot of the boulders */
      climb: () => ({ at: [15, 20.5], h: 1.7, to: [15, 30] }),
      /* rising up past them, over the top */
      crest: (u) => ({ at: [15, lerp(20.5, 18, u)], h: lerp(1.7, 5.5, u), to: [15, 60] }),
      look: () => ({ at: [15, 18], h: 5.5, to: [15, 60] }),
      slide: () => ({ at: [15, 18], h: 5.5, to: [15, 60] })
    };
    const T = { ship: SHIP, core: CORE + 4, walk: WALK, climb: CLIMB, crest: CREST, look: LOOK, slide: SLIDE }[ph];
    const u = Math.min(1, this.pt / T), cur = SHOTS[ph](ph === 'crest' ? smooth(u) : u);
    /* (a smooth move from the shot before into this one, its first couple of seconds) */
    const prev = { core: 'ship', walk: 'core', climb: 'walk' }[ph];
    if (prev && this.pt < 2){ const e = smooth(this.pt / 2), was = SHOTS[prev](1); return { at: lerp2(was.at, cur.at, e), h: lerp(was.h, cur.h, e), to: lerp2(was.to, cur.to, e) }; }
    return cur;
  }

  /* ---------- drawing ---------- */

  draw(c, W, H, drawCrew){
    const L = PAL.world, t = this.t, here = this.g.here, n = here.length;
    const cam = this._cam(), yaw = Math.atan2(cam.to[0] - cam.at[0], cam.to[1] - cam.at[1]), cs = Math.cos(yaw), sn = Math.sin(yaw);
    const F = W * 0.75, HZ = H * 0.4;
    /* world (x, y up, z) to the screen: [x, y, px a metre], or null behind the camera */
    const S = (x, y, z) => { const dx = x - cam.at[0], dz = z - cam.at[1], rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; if (rz < 0.4) return null; const k = F / rz; return [W / 2 + rx * k, HZ + (cam.h - y) * k, k, rz]; };
    c.save();
    /* the world beyond the edge: the valley, far below (its own picture), panned with the camera's heading */
    const look = this.phase === 'look' ? this.pt / LOOK : this.phase === 'slide' ? 1 : 0;
    worldOverlook(c, W, H, H, t, L, 1, -yaw * F * 0.35 + lerp(W * 0.1, -W * 0.1, smooth(look)));
    /* the hilltop's ground, up to the cliff edge */
    const reveal = this.phase === 'crest' ? smooth(this.pt / CREST) : this.phase === 'look' || this.phase === 'slide' ? 1 : 0;
    const edge = []; for (let x = -80; x <= 100; x += 4){ const p = S(x, 0, PLACE.edge); if (p){ p[1] = lerp(HZ, p[1], reveal); edge.push(p); } }
    if (edge.length > 1){
      const top = Math.min(...edge.map(p => p[1])), gg = c.createLinearGradient(0, top, 0, H);
      gg.addColorStop(0, '#8ccf98'); gg.addColorStop(0.25, L.grass[0]); gg.addColorStop(1, L.ground[2]);
      c.fillStyle = gg; c.beginPath(); c.moveTo(-10, H + 10); edge.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(W + 10, H + 10); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,245,215,.55)'; c.lineWidth = 3; c.beginPath(); edge.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    }
    /* on the ground: the furrow the ship ploughed, the meadows, the stream, the pond */
    const poly = (pts, fill) => { const q = pts.map(([x, z]) => S(x, 0, z)).filter(Boolean); if (q.length < 3) return; c.fillStyle = fill; c.beginPath(); q.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
    const ellipse = (x, z, rx, rz, fill, m = 24) => poly(Array.from({ length: m }, (_, k) => [x + Math.cos(k / m * 6.2832) * rx, z + Math.sin(k / m * 6.2832) * rz]), fill);
    const ribbon = (line, w, fill) => { const Lf = [], Rt = []; line.forEach(([x, z], k) => { const [a, b] = line[Math.min(line.length - 1, k + 1)], [p0, q0] = line[Math.max(0, k - 1)]; const dx = a - p0, dz = b - q0, d = Math.hypot(dx, dz) || 1; Lf.push([x - dz / d * w, z + dx / d * w]); Rt.push([x + dz / d * w, z - dx / d * w]); }); poly([...Lf, ...Rt.reverse()], fill); };
    ribbon(PLACE.furrow, 1.6, 'rgba(110,90,80,.55)');
    for (const [x, z, rx, rz, cols] of PLACE.meadows){
      ellipse(x, z, rx, rz, '#8ccf8a');
      for (let k = 0; k < 40; k++){ const a = hash(k + x) * 6.28, r = Math.sqrt(hash(k + z)), p = S(x + Math.cos(a) * rx * r * 0.9, 0, z + Math.sin(a) * rz * r * 0.9); if (p){ c.fillStyle = cols[k % 2]; c.beginPath(); c.arc(p[0], p[1], Math.max(1, p[2] * 0.06), 0, 6.2832); c.fill(); } }
    }
    ribbon(PLACE.stream, 0.75, '#e6d6a8'); ribbon(PLACE.stream, 0.45, '#5fe0f0');
    ellipse(PLACE.pond[0], PLACE.pond[1], PLACE.pond[2] * 1.15, PLACE.pond[3] * 1.15, '#e6d6a8'); ellipse(...PLACE.pond, '#5fe0f0');
    /* grass tufts here and there, fixed */
    c.strokeStyle = L.grass[1]; c.lineCap = 'round';
    for (let k = 0; k < 220; k++){ const p = S(-20 + 50 * hash(k + 3), 0, -6 + 40 * hash(k + 4)); if (!p || p[3] > 40) continue; const l = p[2] * 0.25; c.lineWidth = Math.max(1, p[2] * 0.03); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] - l * 0.3, p[1] - l); c.moveTo(p[0], p[1]); c.lineTo(p[0] + l * 0.35, p[1] - l * 0.9); c.stroke(); }
    /* everything standing up: far to near */
    const items = [];
    const sp = S(PLACE.ship.at[0], 0, PLACE.ship.at[1]); if (sp) items.push({ d: sp[3], draw: () => shipAt(c, sp[0], sp[1], sp[2] * PLACE.ship.len / 1530, t) });
    for (const [x, z, kind, s] of PLACE.trees){ const p = S(x, 0, z); if (p) items.push({ d: p[3], draw: () => treeKind(c, p[0], p[1], p[2] * 0.0075 * s, kind, L, Math.min(0.4, p[3] / 120), Math.round(x * 7 + z)) }); }
    for (const r of PLACE.rocks){ const p = S(r.at[0], 0, r.at[1]); if (p) items.push({ d: p[3], draw: () => this._boulder(c, p[0], p[1], r.w * p[2], r.h * p[2], r.n) }); }
    here.forEach((i, k) => {
      const m = this._crew(k, n), p = S(m.x, m.y, m.z); if (!p) return;
      const st = { look: m.look || 0 };
      if (m.climbing) st.pose = Math.floor((this.t - this.pulled[i]) * 3) % 2 ? 'reach' : 'hang';
      else if (this.phase === 'look' && this.pt > SAY_AT + 3) st.pose = 'hang';
      this.g.crew[i].run = m.walk ? 0.35 : 0;
      items.push({ d: p[3] - (m.y > 0 ? 1.5 : 0.01), draw: () => drawCrew(i, p[0], p[1], CREW_M * p[2], st) });
    });
    items.sort((a, b) => b.d - a.d);
    for (const it of items) it.draw();
    c.restore();
    /* the climb's words */
    if (this.phase === 'climb' && this.pt < CLIMB - 1){
      banner(c, W, H, 'CLIMB!', '#ffd24a', 1.15 + 0.04 * Math.sin(t * 8), H * 0.16);
      c.font = `600 ${H * 0.03}px Fredoka, sans-serif`; c.textAlign = 'center'; c.lineWidth = H * 0.006; c.strokeStyle = 'rgba(20,15,45,.8)';
      c.strokeText('REACH UP - HAND OVER HAND', W / 2, H * 0.25); c.fillStyle = '#fff'; c.fillText('REACH UP - HAND OVER HAND', W / 2, H * 0.25);
    }
    /* the title, over the world */
    if (this.phase === 'look'){ const a = Math.min(1, Math.max(0, (this.pt - TITLE_AT) / 2.5)) * Math.min(1, Math.max(0, (TITLE_END - this.pt) / 1.2)); this._title(c, W, H, a); }
    /* a cut-scene's frame: bars top and bottom, till the climb */
    const bars = this.phase === 'ship' || this.phase === 'core' ? 1 : this.phase === 'walk' ? 1 - smooth(Math.max(0, (this.pt - WALK + 1.2) / 1.2)) : this.phase === 'crest' || this.phase === 'look' ? Math.min(1, this.phase === 'look' ? 1 : this.pt / CREST) : 0;
    if (bars > 0){ c.fillStyle = '#05060a'; c.fillRect(0, 0, W, H * 0.09 * bars); c.fillRect(0, H * (1 - 0.09 * bars), W, H * 0.09 * bars); }
    /* down, onto the trail */
    const slide = this.phase === 'slide' ? smooth(this.pt / SLIDE) : 0;
    if (slide > 0.5){ c.fillStyle = `rgba(255,250,240,${(slide - 0.5) * 2 * 0.9})`; c.fillRect(0, 0, W, H); }
  }

  /* A boulder - a real rock: a lumpy, uneven shape, flatter where it sits in
     the ground; lit face, mid face and shadowed side; cracks, lichen, moss
     on its top, grass tufts round its foot, and a smaller stone leaning
     against it. (x, y: the middle of its foot; w, h: how big.) */
  _boulder(c, x, y, w, h, n){
    const rock = (cx, cy, rw, rh, seed) => {
      /* its outline: points round it, each pushed in or out a little - flat underneath */
      const pts = [];
      for (let q = 0; q < 14; q++){
        const a = Math.PI + (q / 13) * Math.PI, j = 0.86 + 0.24 * hash(seed + q);
        pts.push([cx + Math.cos(a) * rw * j, cy + Math.sin(a) * rh * j * (q > 2 && q < 11 ? 1 : 0.8)]);
      }
      pts.unshift([cx - rw * 0.98, cy]); pts.push([cx + rw * 0.98, cy]);
      const path = () => { c.beginPath(); pts.forEach(([px, py], q) => q ? c.lineTo(px, py) : c.moveTo(px, py)); c.closePath(); };
      /* shadowed: the whole rock */
      c.fillStyle = '#56507a'; path(); c.fill();
      /* the mid face, and the lit face toward the low sun on the left */
      c.save(); path(); c.clip();
      c.fillStyle = '#7d76a2'; c.beginPath(); c.moveTo(cx - rw * 1.1, cy); c.lineTo(cx - rw * 1.1, cy - rh * 1.3); c.lineTo(cx + rw * (0.25 + 0.2 * hash(seed + 30)), cy - rh * 1.3); c.lineTo(cx + rw * (0.05 + 0.15 * hash(seed + 31)), cy - rh * 0.35); c.lineTo(cx - rw * 0.2, cy); c.closePath(); c.fill();
      c.fillStyle = '#a49cc8'; c.beginPath(); c.moveTo(cx - rw * 1.1, cy - rh * 0.25); c.lineTo(cx - rw * 1.1, cy - rh * 1.3); c.lineTo(cx - rw * (0.05 - 0.15 * hash(seed + 32)), cy - rh * 1.3); c.lineTo(cx - rw * 0.35, cy - rh * 0.55); c.closePath(); c.fill();
      /* lichen, pale and soft, and a few cracks */
      c.fillStyle = 'rgba(200,220,170,.18)'; for (let q = 0; q < 3; q++){ c.beginPath(); c.ellipse(cx + (hash(seed + q + 40) - 0.5) * rw * 1.2, cy - rh * (0.3 + 0.5 * hash(seed + q + 41)), rw * 0.08, rh * 0.05, 0, 0, 6.2832); c.fill(); }
      c.strokeStyle = 'rgba(30,25,55,.4)'; c.lineWidth = Math.max(1.5, rw * 0.012);
      for (let q = 0; q < 2; q++){ const sx = cx + (hash(seed + q + 50) - 0.3) * rw * 0.8, sy = cy - rh * (0.7 + 0.2 * hash(seed + q)); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + rw * 0.08, sy + rh * 0.2); c.lineTo(sx + rw * 0.03, sy + rh * 0.38); c.stroke(); }
      c.restore();
      c.strokeStyle = 'rgba(255,240,215,.5)'; c.lineWidth = Math.max(2, rw * 0.015); c.beginPath(); pts.slice(1, 8).forEach(([px, py], q) => q ? c.lineTo(px, py) : c.moveTo(px, py)); c.stroke();
      return pts;
    };
    /* the soft shadow it sits in */
    c.fillStyle = 'rgba(20,40,30,.28)'; c.beginPath(); c.ellipse(x + w * 0.08, y, w * 0.62, h * 0.08, 0, 0, 6.2832); c.fill();
    const top = rock(x, y, w * 0.5, h, n * 13);
    /* moss over its top, uneven */
    c.fillStyle = '#5fa25a'; const tp = top.slice(5, 11);
    c.beginPath(); tp.forEach(([px, py], q) => q ? c.lineTo(px, py) : c.moveTo(px, py)); for (let q = tp.length - 1; q >= 0; q--) c.lineTo(tp[q][0], tp[q][1] + h * (0.06 + 0.05 * hash(n + q))); c.closePath(); c.fill();
    c.fillStyle = '#8fd08a'; c.beginPath(); c.ellipse(x - w * 0.08, y - h * 0.96, w * 0.14, h * 0.025, -0.1, 0, 6.2832); c.fill();
    /* a smaller stone leaning on it */
    rock(x + w * (n % 2 ? -0.46 : 0.44), y + h * 0.01, w * 0.2, h * 0.3, n * 13 + 99);
    /* grass tufts round its foot */
    c.strokeStyle = '#4f9a6a'; c.lineWidth = Math.max(1.5, w * 0.01); c.lineCap = 'round';
    for (let q = 0; q < 9; q++){ const gx = x - w * 0.6 + w * 1.2 * hash(n * 7 + q), gl = h * (0.05 + 0.06 * hash(q + n)); c.beginPath(); c.moveTo(gx, y + 1); c.lineTo(gx - gl * 0.3, y - gl); c.moveTo(gx, y + 1); c.lineTo(gx + gl * 0.35, y - gl * 0.9); c.stroke(); }
  }
  /* the game's title, over the world: spaced capitals, the level under it */
  _title(c, W, H, a){
    if (a <= 0.01) return;
    const y = H * 0.3, size = H * 0.075, gap = H * 0.02;
    c.save(); c.font = `600 ${size}px "Cinzel", "Fredoka", serif`; c.textBaseline = 'middle'; c.textAlign = 'left';
    const ws = [...TITLE].map(ch => c.measureText(ch).width + gap), tw = ws.reduce((p, q) => p + q, 0) - gap;
    let x = W / 2 - tw / 2;
    c.shadowColor = 'rgba(30,20,70,.55)'; c.shadowBlur = H * 0.02; c.fillStyle = `rgba(255,255,255,${a})`;
    [...TITLE].forEach((ch, k) => { c.fillText(ch, x, y); x += ws[k]; });
    c.shadowBlur = 0; c.font = `500 ${H * 0.026}px "Fredoka", sans-serif`; c.textAlign = 'center'; c.fillStyle = `rgba(255,255,255,${a * 0.85})`;
    const lv = this.g.level; c.fillText(`LEVEL ${(this.g.levelNo ?? 0) + 1}   |   ${(lv && lv.name || '').toUpperCase()}`, W / 2, y + H * 0.08);
    c.fillStyle = `rgba(255,255,255,${0.6 * a})`; c.fillRect(W * 0.3, y + H * 0.045, W * 0.4, 2);
    c.restore();
  }
}
